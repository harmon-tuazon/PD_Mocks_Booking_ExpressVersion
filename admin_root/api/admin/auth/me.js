/**
 * Get Current User Endpoint
 * GET /api/admin/auth/me
 *
 * Note: Only checks authentication, not role-based authorization.
 */

const { verifyToken } = require('../../_shared/supabase');

module.exports = async (req, res) => {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
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
        success: false,
        error: {
          code: 'MISSING_TOKEN',
          message: 'Authorization token required'
        }
      });
    }

    const token = authHeader.substring(7);

    // Verify token with Supabase (authentication only)
    const { user, error } = await verifyToken(token);

    if (error || !user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired token'
        }
      });
    }

    // Return user information (all authenticated users have access)
    res.status(200).json({
      id: user.id,
      email: user.email,
      user_metadata: user.user_metadata || {},
      created_at: user.created_at,
      last_sign_in: user.last_sign_in_at
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while fetching user information'
      }
    });
  }
};