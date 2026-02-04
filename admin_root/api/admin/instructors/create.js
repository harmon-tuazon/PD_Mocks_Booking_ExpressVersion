/**
 * POST /api/admin/instructors/create
 * Create a new instructor
 * Permission: 'workcheck.create'
 */

const { requirePermission } = require('../middleware/requirePermission');
const { validationMiddleware } = require('../../_shared/validation');
const { supabaseAdmin } = require('../../_shared/supabase');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: `Method ${req.method} not allowed` }
    });
  }

  try {
    // Verify admin authentication and permission
    await requirePermission(req, 'workcheck.create');

    // Validate request body
    const validator = validationMiddleware('instructorCreate');
    await new Promise((resolve, reject) => {
      validator(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    const { instructor_name, email } = req.validatedData;

    console.log('[Instructor Create] Creating instructor:', { instructor_name, email });

    // Check for duplicate email
    const { data: existingInstructor, error: checkError } = await supabaseAdmin
      .from('instructors')
      .select('id, email')
      .eq('email', email.toLowerCase())
      .single();

    if (existingInstructor) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'DUPLICATE_EMAIL',
          message: 'An instructor with this email already exists'
        }
      });
    }

    // Insert new instructor
    const { data: newInstructor, error } = await supabaseAdmin
      .from('instructors')
      .insert({
        instructor_name: instructor_name.trim(),
        email: email.toLowerCase().trim(),
        is_active: true
      })
      .select()
      .single();

    if (error) {
      console.error('[Supabase ERROR]', error.message);

      // Handle unique constraint violation
      if (error.code === '23505') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'DUPLICATE_EMAIL',
            message: 'An instructor with this email already exists'
          }
        });
      }

      throw new Error(`Failed to create instructor: ${error.message}`);
    }

    console.log(`[Instructor Created] ${newInstructor.id} - ${instructor_name}`);

    res.status(201).json({
      success: true,
      message: 'Instructor created successfully',
      data: {
        id: newInstructor.id,
        instructor_name: newInstructor.instructor_name,
        email: newInstructor.email,
        is_active: newInstructor.is_active,
        auth_user_id: newInstructor.auth_user_id,
        created_at: newInstructor.created_at,
        updated_at: newInstructor.updated_at
      }
    });

  } catch (error) {
    // Auth-specific error handling
    if (error.message.includes('authorization') || error.message.includes('token') || error.message.includes('Permission denied')) {
      const statusCode = error.statusCode || 401;
      return res.status(statusCode).json({
        success: false,
        error: { code: error.code || 'UNAUTHORIZED', message: error.message }
      });
    }

    console.error('Error creating instructor:', error);

    res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Failed to create instructor'
    });
  }
};
