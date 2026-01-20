/**
 * Role-based Authorization Middleware
 * Checks if user has one of the allowed roles
 */

const { requireAuth } = require('./requireAuth');

/**
 * Middleware to require specific role(s)
 * @param {Request} req - HTTP request object
 * @param {string|string[]} allowedRoles - Allowed role(s) (e.g., 'super_admin' or ['super_admin', 'admin'])
 * @returns {Promise<object>} - User object with RBAC claims
 * @throws {Error} - 401 if not authenticated, 403 if insufficient role
 */
async function requireRole(req, allowedRoles) {
  try {
    // First verify authentication and get user with RBAC claims
    const user = await requireAuth(req);

    // Normalize to array
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    // Check if user has one of the allowed roles
    const userRole = user.user_role || 'viewer';

    if (!roles.includes(userRole)) {
      const error = new Error(`Role required: ${roles.join(' or ')}`);
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
 * Express/Vercel middleware wrapper for role checking
 * @param {string|string[]} allowedRoles - Allowed role(s)
 * @returns {Function} - Middleware function
 */
function roleMiddleware(allowedRoles) {
  return (handler) => {
    return async (req, res) => {
      try {
        const user = await requireRole(req, allowedRoles);
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
  requireRole,
  roleMiddleware
};
