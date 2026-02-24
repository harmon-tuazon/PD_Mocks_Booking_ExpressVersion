/**
 * Authentication Middleware (Express version)
 * Verifies JWT token and adds user to request
 */
const { verifyToken } = require('../services/supabase');

async function requireAuth(req) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Missing or invalid authorization header');
    }

    const token = authHeader.substring(7);
    const { user, error } = await verifyToken(token);

    if (error || !user) {
      throw new Error('Invalid or expired token');
    }

    return user;
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    throw error;
  }
}

module.exports = { requireAuth };
