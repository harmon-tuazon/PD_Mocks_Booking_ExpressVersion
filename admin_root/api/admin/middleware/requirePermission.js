/**
 * Permission-based Authorization Middleware
 * Checks if user has specific permission in JWT claims
 */

const { requireAuth } = require('./requireAuth');

/**
 * Middleware to require specific permission
 * @param {Request} req - HTTP request object
 * @param {string} permission - Required permission (e.g., 'exams.delete')
 * @returns {Promise<object>} - User object with RBAC claims
 * @throws {Error} - 401 if not authenticated, 403 if insufficient permissions
 */
async function requirePermission(req, permission) {
  try {
    // First verify authentication and get user with RBAC claims
    const user = await requireAuth(req);

    // Check if user has the required permission
    const permissions = user.permissions || [];

    if (!permissions.includes(permission)) {
      const error = new Error(`Permission denied: ${permission} required`);
      error.statusCode = 403;
      error.code = 'FORBIDDEN';
      throw error;
    }

    return user;

  } catch (error) {
    // Re-throw with appropriate status code
    if (!error.statusCode) {
      error.statusCode = 401;
      error.code = 'UNAUTHORIZED';
    }
    throw error;
  }
}

/**
 * Express/Vercel middleware wrapper for permission checking
 * @param {string} permission - Required permission
 * @returns {Function} - Middleware function
 */
function permissionMiddleware(permission) {
  return (handler) => {
    return async (req, res) => {
      try {
        const user = await requirePermission(req, permission);
        req.user = user;
        return handler(req, res);
      } catch (error) {
        const statusCode = error.statusCode || 401;
        const code = error.code || (statusCode === 403 ? 'FORBIDDEN' : 'UNAUTHORIZED');

        return res.status(statusCode).json({
          success: false,
          error: {
            code,
            message: error.message || 'Authentication required'
          }
        });
      }
    };
  };
}

module.exports = {
  requirePermission,
  permissionMiddleware
};
