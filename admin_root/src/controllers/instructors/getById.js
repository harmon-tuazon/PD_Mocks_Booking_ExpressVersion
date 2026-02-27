/**
 * GET /api/admin/instructors/:id
 * Fetch single instructor by UUID
 * Permission: 'workcheck.view'
 */

const { requirePermission } = require('../../middleware/requirePermission');
const { db } = require('../../services/supabase');

const getById = async (req, res, next) => {
  try {
    await requirePermission(req, 'workcheck.view');

    const { id } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Instructor ID must be a valid UUID' }
      });
    }

    const { data: instructor, error } = await db
      .from('instructors')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !instructor) {
      return res.status(404).json({
        success: false,
        error: { code: 'INSTRUCTOR_NOT_FOUND', message: `Instructor with ID ${id} not found` }
      });
    }

    res.status(200).json({
      success: true,
      data: {
        id: instructor.id,
        instructor_name: instructor.instructor_name,
        email: instructor.email,
        is_active: instructor.is_active,
        auth_user_id: instructor.auth_user_id,
        created_at: instructor.created_at,
        updated_at: instructor.updated_at
      }
    });

  } catch (error) {
    next(error);
  }
};

module.exports = { getById };
