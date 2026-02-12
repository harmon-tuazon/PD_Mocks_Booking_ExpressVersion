/**
 * POST /api/admin/instructors/:id/reset-password
 * Admin resets an instructor's password
 * Permission: 'workcheck.edit'
 *
 * Supabase handles password hashing (bcrypt) internally.
 * The new password is never logged or included in responses.
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
    await requirePermission(req, 'workcheck.edit');

    // Validate request body
    const validator = validationMiddleware('instructorResetPassword');
    await new Promise((resolve, reject) => {
      validator(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    const { id } = req.query;
    const { new_password } = req.validatedData;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!id || !uuidRegex.test(id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Instructor ID must be a valid UUID' }
      });
    }

    // Get instructor record
    const { data: instructor, error: fetchError } = await supabaseAdmin
      .from('instructors')
      .select('id, auth_user_id, instructor_name')
      .eq('id', id)
      .single();

    if (fetchError || !instructor) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Instructor not found' }
      });
    }

    if (!instructor.auth_user_id) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_AUTH_ACCOUNT',
          message: 'This instructor does not have a portal login account. Use "Provision Portal Access" first.'
        }
      });
    }

    // Update password — Supabase handles hashing
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      instructor.auth_user_id,
      { password: new_password }
    );

    if (updateError) {
      console.error('[Auth ERROR] Failed to reset password:', updateError.message);
      throw new Error(`Failed to reset password: ${updateError.message}`);
    }

    console.log(`[Password Reset] Instructor ${instructor.instructor_name} (${id})`);

    res.status(200).json({
      success: true,
      message: `Password updated for ${instructor.instructor_name}`
    });

  } catch (error) {
    if (error.message.includes('authorization') || error.message.includes('token') || error.message.includes('Permission denied')) {
      const statusCode = error.statusCode || 401;
      return res.status(statusCode).json({
        success: false,
        error: { code: error.code || 'UNAUTHORIZED', message: error.message }
      });
    }

    console.error('Error resetting instructor password:', error);

    res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Failed to reset password'
    });
  }
};
