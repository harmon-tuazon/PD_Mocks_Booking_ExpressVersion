/**
 * Admin Logout Controller
 * POST /api/admin/auth/logout
 */

const { db } = require('../../services/supabase');

async function logout(req, res) {
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

    // Sign out user using Supabase admin client
    const { error } = await db.auth.admin.signOut(token);

    if (error) {
      console.error('Logout error:', error);
      // Still return success even if Supabase logout fails
      // The client should clear local tokens regardless
    }

    // Clear refresh token cookie
    res.setHeader('Set-Cookie', [
      'admin_refresh_token=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/'
    ]);

    // Return success response
    res.status(200).json({
      success: true,
      message: 'Successfully logged out'
    });

  } catch (error) {
    console.error('Logout error:', error);
    // Still return success to ensure client clears tokens
    res.status(200).json({
      success: true,
      message: 'Successfully logged out'
    });
  }
}

module.exports = { logout };
