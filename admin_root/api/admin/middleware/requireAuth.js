/**
 * Authentication Middleware
 * Verifies JWT token, validates request timestamp, and adds user to request
 */

const { verifyToken } = require('../../_shared/supabase');
const crypto = require('crypto');

// Maximum allowed age for a request timestamp (5 minutes)
const MAX_REQUEST_AGE_MS = 5 * 60 * 1000;

/**
 * Validate request timestamp to prevent replay attacks
 * Rejects requests older than 5 minutes
 * @param {Request} req - HTTP request object
 */
function validateRequestTimestamp(req) {
  const timestamp = req.headers['x-request-timestamp'];

  // Skip validation if header not present (backwards compatibility)
  if (!timestamp) return;

  const requestTime = parseInt(timestamp, 10);
  if (isNaN(requestTime)) return;

  const age = Math.abs(Date.now() - requestTime);
  if (age > MAX_REQUEST_AGE_MS) {
    throw new Error('Request expired');
  }
}

/**
 * Middleware to require authentication
 * @param {Request} req - HTTP request object
 * @returns {Promise<{user: object}|null>}
 */
async function requireAuth(req) {
  try {
    // Validate request freshness (replay attack prevention)
    validateRequestTimestamp(req);

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

    // Validate device fingerprint (soft check - warn on mismatch)
    // Uses User-Agent only, stored at login time in user_metadata
    const storedFingerprint = user.user_metadata?.device_fingerprint;
    if (storedFingerprint) {
      const userAgent = req.headers['user-agent'] || '';
      const currentFingerprint = crypto
        .createHash('sha256')
        .update(userAgent)
        .digest('hex')
        .substring(0, 16);

      if (currentFingerprint !== storedFingerprint) {
        console.warn(
          `[Auth] Device fingerprint mismatch for user ${user.id}. ` +
          `Expected: ${storedFingerprint}, Got: ${currentFingerprint}`
        );
        // Soft check: log warning but don't block
        // Change to throw new Error('Device fingerprint mismatch') for hard enforcement
      }
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