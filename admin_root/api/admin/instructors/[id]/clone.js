/**
 * POST /api/admin/instructors/[id]/clone
 * Clone an instructor with a new email suffix
 * Permission: 'workcheck.create'
 */

const { requirePermission } = require('../../middleware/requirePermission');
const { validationMiddleware } = require('../../../_shared/validation');
const { supabaseAdmin } = require('../../../_shared/supabase');

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

    const { id } = req.query;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'Source instructor ID is required' }
      });
    }

    // Validate request body
    const validator = validationMiddleware('instructorClone');
    await new Promise((resolve, reject) => {
      validator(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    const {
      instructorName,
      emailSuffix,
      isActive
    } = req.validatedData;

    // Find source instructor
    const { data: sourceInstructor, error: fetchError } = await supabaseAdmin
      .from('instructors')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !sourceInstructor) {
      return res.status(404).json({
        success: false,
        error: { code: 'INSTRUCTOR_NOT_FOUND', message: `Source instructor ${id} not found` }
      });
    }

    // Generate new email with suffix
    const originalEmail = sourceInstructor.email;
    const atIndex = originalEmail.lastIndexOf('@');
    const localPart = originalEmail.substring(0, atIndex);
    const domainPart = originalEmail.substring(atIndex);
    const newEmail = `${localPart}${emailSuffix}${domainPart}`;

    // Check if the new email already exists
    const { data: existingInstructor } = await supabaseAdmin
      .from('instructors')
      .select('id')
      .eq('email', newEmail.toLowerCase())
      .single();

    if (existingInstructor) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'DUPLICATE_EMAIL',
          message: `An instructor with email ${newEmail} already exists. Try a different suffix.`
        }
      });
    }

    // Determine the new instructor name
    const newName = instructorName?.trim() || `${sourceInstructor.instructor_name} (Copy)`;

    // Create new instructor
    const { data: newInstructor, error: createError } = await supabaseAdmin
      .from('instructors')
      .insert({
        instructor_name: newName,
        email: newEmail.toLowerCase(),
        is_active: isActive !== undefined ? isActive : true
      })
      .select()
      .single();

    if (createError) {
      console.error('[Supabase ERROR]', createError.message);

      // Handle unique constraint violation
      if (createError.code === '23505') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'DUPLICATE_EMAIL',
            message: 'An instructor with this email already exists'
          }
        });
      }

      throw new Error(`Failed to clone instructor: ${createError.message}`);
    }

    console.log(`[Instructor Cloned] ${sourceInstructor.id} -> ${newInstructor.id} (${newEmail})`);

    res.status(201).json({
      success: true,
      message: 'Instructor cloned successfully',
      data: {
        id: newInstructor.id,
        instructor_name: newInstructor.instructor_name,
        email: newInstructor.email,
        is_active: newInstructor.is_active,
        created_at: newInstructor.created_at,
        sourceInstructor: {
          id: sourceInstructor.id,
          instructor_name: sourceInstructor.instructor_name,
          email: sourceInstructor.email
        }
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

    console.error('Error cloning instructor:', error);

    res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Failed to clone instructor'
    });
  }
};
