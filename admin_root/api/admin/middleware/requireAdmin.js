/**
 * Admin Authorization Middleware
 * Simplified to only verify authentication (no role checking)
 *
 * NOTE: Role-based permissions removed - any authenticated user can access admin endpoints
 */

const { requireAuth } = require('./requireAuth');

/**
 * Middleware to require authentication (simplified from requireAdmin)
 * @param {Request} req - HTTP request object
 * @returns {Promise<{user: object}|null>}
 */
async function requireAdmin(req) {
  try {
    // Just verify authentication - no role checking
    const user = await requireAuth(req);
    return user;

  } catch (error) {
    console.error('Auth middleware error:', error.message);
    throw error;
  }
}

/**
 * Express/Vercel middleware wrapper for authentication
 * Legacy name kept for backward compatibility
 */
function adminMiddleware(handler) {
  return async (req, res) => {
    try {
      const user = await requireAdmin(req);
      req.user = user;
      return handler(req, res);
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: error.message || 'Authentication required'
        }
      });
    }
  };
}

module.exports = {
  requireAdmin,
  adminMiddleware
};