/**
 * GET /api/admin/instructor/me
 * Get current instructor's profile
 * Role: 'instructor'
 */

const { requireRole } = require('../../middleware/requireRole');
const { getInstructorFromUser } = require('../../services/instructor-helpers');

const me = async (req, res, next) => {
  try {
    const user = await requireRole(req, 'instructor');
    const instructor = await getInstructorFromUser(user);

    return res.status(200).json({
      success: true,
      data: {
        id: instructor.id,
        instructor_name: instructor.instructor_name,
        email: instructor.email,
        is_active: instructor.is_active
      }
    });

  } catch (error) {
    next(error);
  }
};

module.exports = { me };
