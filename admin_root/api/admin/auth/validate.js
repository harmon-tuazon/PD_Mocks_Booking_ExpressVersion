/**
 * Session Validation Endpoint
 * GET /api/admin/auth/validate
 */

const { verifyToken, isAdmin } = require('../../_shared/supabase');

module.exports = async (req, res) => {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({
      valid: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only GET method is allowed'
      }
    });
  }

  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        valid: false,
        error: {
          code: 'MISSING_TOKEN',
          message: 'Authorization token required'
        }
      });
    }

    const token = authHeader.substring(7);

    // Verify token with Supabase
    const { user, error } = await verifyToken(token);

    if (error || !user) {
      return res.status(401).json({
        valid: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired token'
        }
      });
    }

    // Verify user has admin role
    if (!isAdmin(user)) {
      return res.status(403).json({
        valid: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Admin access required'
        }
      });
    }

    // Return validation result
    res.status(200).json({
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.user_metadata?.role || 'admin'
      }
    });

  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({
      valid: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred during validation'
      }
    });
  }
};