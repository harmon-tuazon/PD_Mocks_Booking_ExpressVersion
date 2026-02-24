/**
 * Admin Authorization Middleware (Express version)
 * Simplified to only verify authentication (no role checking)
 */
const { requireAuth } = require('./requireAuth');

/**
 * Express middleware — verifies auth and sets req.user
 */
const requireAdmin = async (req, res, next) => {
  try {
    const user = await requireAuth(req);
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: error.message || 'Authentication required'
      }
    });
  }
};

module.exports = { requireAdmin };
