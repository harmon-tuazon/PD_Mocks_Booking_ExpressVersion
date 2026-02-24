/**
 * Role-based Authorization Middleware (Express version)
 */
const { requireAuth } = require('./requireAuth');

async function requireRole(req, allowedRoles) {
  try {
    const user = await requireAuth(req);
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    const userRole = user.user_role || 'viewer';

    if (!roles.includes(userRole)) {
      const error = new Error(`Role required: ${roles.join(' or ')}`);
      error.statusCode = 403;
      error.code = 'FORBIDDEN';
      throw error;
    }

    return user;
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 401;
      error.code = 'UNAUTHORIZED';
    }
    throw error;
  }
}

module.exports = { requireRole };
