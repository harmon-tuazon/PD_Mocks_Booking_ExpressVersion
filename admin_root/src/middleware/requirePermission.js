/**
 * Permission-based Authorization Middleware (Express version)
 */
const { requireAuth } = require('./requireAuth');

async function requirePermission(req, permission) {
  try {
    const user = await requireAuth(req);
    const permissions = user.permissions || [];

    if (!permissions.includes(permission)) {
      const error = new Error(`Permission denied: ${permission} required`);
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

module.exports = { requirePermission };
