/**
 * Authentication Middleware
 * Verifies JWT token and adds user to request
 */

const { verifyToken } = require('../../_shared/supabase');

/**
 * Middleware to require authentication
 * @param {Request} req - HTTP request object
 * @returns {Promise<{user: object}|null>}
 */
async function requireAuth(req) {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Missing or invalid authorization header');
    }

    const token = authHeader.substring(7);

    // Verify token with Supabase
    const { user, error } = await verifyToken(token);

    if (error || !user) {
      throw new Error('Invalid or expired token');
    }

    // Return user object
    return user;

  } catch (error) {
    console.error('Auth middleware error:', error.message);
    throw error;
  }
}

/**
 * Express/Vercel middleware wrapper
 * Use this for protecting entire endpoints
 */
function authMiddleware(handler) {
  return async (req, res) => {
    try {
      const user = await requireAuth(req);
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
  requireAuth,
  authMiddleware
};