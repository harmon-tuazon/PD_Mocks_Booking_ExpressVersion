/**
 * GET /api/admin/instructor/me
 * Get current instructor's profile
 * Role: 'instructor'
 */

const { requireRole } = require('../middleware/requireRole');
const { getInstructorFromUser } = require('../../_shared/instructor-helpers');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: `Method ${req.method} not allowed` }
    });
  }

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
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      error: { code: error.code || 'INTERNAL_ERROR', message: error.message }
    });
  }
};
