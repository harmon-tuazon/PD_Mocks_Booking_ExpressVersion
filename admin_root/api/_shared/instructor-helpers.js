/**
 * Instructor Portal Helpers
 * Shared utilities for instructor portal endpoints
 */

const { supabaseAdmin } = require('./supabase');

/**
 * Get instructor record from authenticated user via reverse lookup.
 * Uses instructors.auth_user_id = user.id (JWT 'sub' claim).
 * No app_metadata or JWT claims needed for instructor_id.
 *
 * @param {Object} user - User object from requireRole middleware (contains user.id from JWT sub)
 * @returns {Promise<Object>} instructor record
 * @throws {Error} 403 if instructor not found or inactive
 */
async function getInstructorFromUser(user) {
  const { data: instructor, error: dbError } = await supabaseAdmin
    .from('instructors')
    .select('id, instructor_name, email, is_active, auth_user_id, created_at, updated_at')
    .eq('auth_user_id', user.id)
    .single();

  if (dbError || !instructor) {
    const error = new Error('Instructor profile not linked to user account');
    error.statusCode = 403;
    error.code = 'INSTRUCTOR_NOT_FOUND';
    throw error;
  }

  if (!instructor.is_active) {
    const error = new Error('Instructor account is inactive');
    error.statusCode = 403;
    error.code = 'INSTRUCTOR_INACTIVE';
    throw error;
  }

  return instructor;
}

module.exports = { getInstructorFromUser };
