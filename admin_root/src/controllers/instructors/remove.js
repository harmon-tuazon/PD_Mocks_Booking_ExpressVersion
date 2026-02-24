/**
 * DELETE /api/admin/instructors/:id
 * Soft delete instructor (set is_active=false)
 * Permission: 'workcheck.delete'
 */

const { requirePermission } = require('../../middleware/requirePermission');
const { supabaseAdmin } = require('../../services/supabase');

const remove = async (req, res, next) => {
  try {
    await requirePermission(req, 'workcheck.delete');

    const { id } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Instructor ID must be a valid UUID' }
      });
    }

    // Soft delete by setting is_active to false
    const { data: deletedInstructor, error } = await supabaseAdmin
      .from('instructors')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error || !deletedInstructor) {
      return res.status(404).json({
        success: false,
        error: { code: 'INSTRUCTOR_NOT_FOUND', message: `Instructor with ID ${id} not found` }
      });
    }

    // Ban auth user to prevent login
    if (deletedInstructor.auth_user_id) {
      const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(
        deletedInstructor.auth_user_id,
        { ban_duration: '876000h' }
      );

      if (banError) {
        console.error('[Auth Sync WARNING] Failed to ban auth user:', banError.message);
      }
    }

    console.log(`[Instructor Soft Deleted] ${id} - ${deletedInstructor.instructor_name}`);

    res.status(200).json({
      success: true,
      message: 'Instructor deactivated successfully',
      data: {
        id: deletedInstructor.id,
        instructor_name: deletedInstructor.instructor_name,
        email: deletedInstructor.email,
        is_active: deletedInstructor.is_active
      }
    });

  } catch (error) {
    next(error);
  }
};

module.exports = { remove };
