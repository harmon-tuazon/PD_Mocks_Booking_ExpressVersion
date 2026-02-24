/**
 * PUT /api/admin/instructors/:id
 * Update instructor
 * Permission: 'workcheck.edit'
 */

const { requirePermission } = require('../../middleware/requirePermission');
const { validationMiddleware } = require('../../services/validation');
const { supabaseAdmin } = require('../../services/supabase');

const update = async (req, res, next) => {
  try {
    await requirePermission(req, 'workcheck.edit');

    const { id } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Instructor ID must be a valid UUID' }
      });
    }

    // Validate request body
    const validator = validationMiddleware('instructorUpdate');
    await new Promise((resolve, reject) => {
      validator(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    const updates = req.validatedData;

    // Build update object
    const updateData = {
      updated_at: new Date().toISOString()
    };

    if (updates.instructor_name !== undefined) {
      updateData.instructor_name = updates.instructor_name.trim();
    }
    if (updates.email !== undefined) {
      updateData.email = updates.email.toLowerCase().trim();
    }
    if (updates.is_active !== undefined) {
      updateData.is_active = updates.is_active;
    }

    // Check if email is being changed and if it already exists
    if (updates.email) {
      const { data: existingInstructor } = await supabaseAdmin
        .from('instructors')
        .select('id')
        .eq('email', updates.email.toLowerCase())
        .neq('id', id)
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
    }

    const { data: updatedInstructor, error } = await supabaseAdmin
      .from('instructors')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error || !updatedInstructor) {
      if (error?.code === '23505') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'DUPLICATE_EMAIL',
            message: 'An instructor with this email already exists'
          }
        });
      }

      return res.status(404).json({
        success: false,
        error: { code: 'INSTRUCTOR_NOT_FOUND', message: `Instructor with ID ${id} not found` }
      });
    }

    // Sync auth user if instructor has portal access
    if (updatedInstructor.auth_user_id) {
      const authUpdates = {};

      // Sync email change
      if (updates.email !== undefined) {
        authUpdates.email = updates.email.toLowerCase().trim();
      }

      // Sync active status (ban/unban)
      if (updates.is_active !== undefined) {
        authUpdates.ban_duration = updates.is_active ? 'none' : '876000h';
      }

      if (Object.keys(authUpdates).length > 0) {
        const { error: authSyncError } = await supabaseAdmin.auth.admin.updateUserById(
          updatedInstructor.auth_user_id,
          authUpdates
        );

        if (authSyncError) {
          // Non-fatal: log but don't fail the request
          console.error('[Auth Sync WARNING] Failed to sync auth user:', authSyncError.message);
        }
      }
    }

    console.log(`[Instructor Updated] ${id}`);

    res.status(200).json({
      success: true,
      message: 'Instructor updated successfully',
      data: {
        id: updatedInstructor.id,
        instructor_name: updatedInstructor.instructor_name,
        email: updatedInstructor.email,
        is_active: updatedInstructor.is_active,
        auth_user_id: updatedInstructor.auth_user_id,
        created_at: updatedInstructor.created_at,
        updated_at: updatedInstructor.updated_at
      }
    });

  } catch (error) {
    next(error);
  }
};

module.exports = { update };
