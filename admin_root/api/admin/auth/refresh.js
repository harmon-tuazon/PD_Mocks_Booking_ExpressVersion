/**
 * Token Refresh Endpoint
 * POST /api/admin/auth/refresh
 *
 * Note: Only checks authentication, not role-based authorization.
 */

const { supabasePublic } = require('../../_shared/supabase');

module.exports = async (req, res) => {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only POST method is allowed'
      }
    });
  }

  try {
    // Get refresh token from request body or cookie
    let refreshToken = req.body?.refresh_token;

    // Check cookie if not in body
    if (!refreshToken) {
      const cookies = req.headers.cookie?.split(';') || [];
      const refreshCookie = cookies.find(c => c.trim().startsWith('admin_refresh_token='));
      if (refreshCookie) {
        refreshToken = refreshCookie.split('=')[1];
      }
    }

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_REFRESH_TOKEN',
          message: 'Refresh token required'
        }
      });
    }

    // Refresh the session using Supabase (authentication only)
    const { data, error } = await supabasePublic.auth.refreshSession({
      refresh_token: refreshToken
    });

    if (error) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Invalid or expired refresh token'
        }
      });
    }

    const { session } = data;

    // Update refresh token cookie if present
    if (req.headers.cookie?.includes('admin_refresh_token=')) {
      res.setHeader('Set-Cookie', [
        `admin_refresh_token=${session.refresh_token}; HttpOnly; Secure; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}; Path=/`
      ]);
    }

    // Return new session (all authenticated users can refresh)
    res.status(200).json({
      success: true,
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
        expires_in: session.expires_in
      }
    });

  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while refreshing token'
      }
    });
  }
};