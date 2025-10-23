/**
 * Admin Login Endpoint
 * POST /api/admin/auth/login
 */

const { supabasePublic } = require('../../_shared/supabase');
const Joi = require('joi');

// Login request validation schema
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  rememberMe: Joi.boolean().default(false)
});

// Rate limiting configuration
const loginAttempts = new Map();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const BLOCK_DURATION = 60 * 60 * 1000; // 1 hour

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
    // Validate request body
    const { error: validationError, value } = loginSchema.validate(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: validationError.details[0].message
        }
      });
    }

    const { email, password, rememberMe } = value;

    // Check rate limiting
    const clientIp = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown';
    const attemptKey = `${clientIp}:${email}`;
    const attemptData = loginAttempts.get(attemptKey) || { count: 0, firstAttempt: Date.now(), blocked: false };

    // Check if blocked
    if (attemptData.blocked && Date.now() - attemptData.blockedAt < BLOCK_DURATION) {
      return res.status(429).json({
        success: false,
        error: {
          code: 'TOO_MANY_ATTEMPTS',
          message: 'Too many failed login attempts. Please try again later.',
          retryAfter: Math.ceil((BLOCK_DURATION - (Date.now() - attemptData.blockedAt)) / 1000)
        }
      });
    }

    // Reset attempts if window has passed
    if (Date.now() - attemptData.firstAttempt > RATE_LIMIT_WINDOW) {
      attemptData.count = 0;
      attemptData.firstAttempt = Date.now();
      attemptData.blocked = false;
    }

    // Sign in with Supabase
    const { data, error } = await supabasePublic.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      // Increment failed attempts
      attemptData.count++;

      // Block if max attempts reached
      if (attemptData.count >= RATE_LIMIT_MAX) {
        attemptData.blocked = true;
        attemptData.blockedAt = Date.now();
      }

      loginAttempts.set(attemptKey, attemptData);

      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
          attemptsRemaining: Math.max(0, RATE_LIMIT_MAX - attemptData.count)
        }
      });
    }

    const { user, session } = data;

    // User is authenticated - no role check needed
    // Any authenticated Supabase user can access the admin panel

    // Clear failed attempts on successful login
    loginAttempts.delete(attemptKey);

    // Set session cookie if Remember Me is checked
    if (rememberMe && session?.refresh_token) {
      res.setHeader('Set-Cookie', [
        `admin_refresh_token=${session.refresh_token}; HttpOnly; Secure; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}; Path=/`
      ]);
    }

    // Return success response
    res.status(200).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        user_metadata: user.user_metadata || {}
      },
      session: {
        access_token: session.access_token,
        refresh_token: rememberMe ? session.refresh_token : undefined,
        expires_at: session.expires_at,
        expires_in: session.expires_in
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred during login'
      }
    });
  }
};