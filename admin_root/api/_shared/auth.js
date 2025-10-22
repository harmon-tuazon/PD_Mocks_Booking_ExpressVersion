const crypto = require('crypto');

/**
 * Generate a secure token for session management
 * @param {number} length - Length of the token in characters
 * @returns {string} Hex token
 */
function generateSecureToken(length = 48) {
  return crypto.randomBytes(length / 2).toString('hex');
}

/**
 * Verify CRON secret for scheduled jobs
 * @param {string} providedSecret - Secret provided in request
 * @returns {boolean} Is valid
 */
function verifyCronSecret(providedSecret) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('CRON_SECRET not configured');
    return false;
  }

  return providedSecret === cronSecret;
}

/**
 * CORS configuration for Vercel functions
 */
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'false');
  res.setHeader('Access-Control-Max-Age', '86400');

  // Force no caching - CRITICAL FOR DEBUGGING
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
}

/**
 * Handle OPTIONS requests for CORS preflight
 */
function handleOptionsRequest(req, res) {
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res);
    res.status(200).end();
    return true;
  }
  return false;
}

/**
 * Rate limiting implementation using in-memory store
 * Note: This is simplified for serverless. In production, use Redis or similar
 */
const rateLimitStore = new Map();

function rateLimit(key, maxRequests = 10, windowMs = 10000) {
  const now = Date.now();
  const windowStart = now - windowMs;

  // Get or create rate limit entry
  let entry = rateLimitStore.get(key) || { requests: [], blocked: false };

  // Clean old requests
  entry.requests = entry.requests.filter(time => time > windowStart);

  // Check if currently blocked
  if (entry.blocked && entry.blockedUntil > now) {
    const retryAfter = Math.ceil((entry.blockedUntil - now) / 1000);
    const error = new Error('Too many requests, please try again later');
    error.status = 429;
    error.retryAfter = retryAfter;
    throw error;
  }

  // Check if limit exceeded
  if (entry.requests.length >= maxRequests) {
    entry.blocked = true;
    entry.blockedUntil = now + windowMs;
    rateLimitStore.set(key, entry);

    const error = new Error('Too many requests, please try again later');
    error.status = 429;
    error.retryAfter = Math.ceil(windowMs / 1000);
    throw error;
  }

  // Add current request
  entry.requests.push(now);
  entry.blocked = false;
  rateLimitStore.set(key, entry);

  // Clean up old entries periodically
  if (rateLimitStore.size > 1000) {
    for (const [k, v] of rateLimitStore.entries()) {
      if (v.requests.length === 0 && (!v.blocked || v.blockedUntil < now)) {
        rateLimitStore.delete(k);
      }
    }
  }
}

/**
 * Express-style middleware for rate limiting in Vercel functions
 */
function rateLimitMiddleware(options = {}) {
  const {
    keyGenerator = (req) => req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown',
    maxRequests = 10,
    windowMs = 10000
  } = options;

  return async (req, res) => {
    try {
      const key = keyGenerator(req);
      rateLimit(key, maxRequests, windowMs);
    } catch (error) {
      if (error.status === 429) {
        res.setHeader('Retry-After', error.retryAfter);
        res.status(429).json({
          success: false,
          error: error.message,
          retryAfter: error.retryAfter
        });
        return true; // Request handled
      }
      throw error;
    }
    return false; // Continue processing
  };
}

/**
 * Sanitize user input to prevent XSS
 * @param {string} input - User input to sanitize
 * @returns {string} Sanitized input
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') {
    return input;
  }

  // Basic HTML entity encoding
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Create a standardized error response
 */
function createErrorResponse(error, includeStack = false) {
  const response = {
    success: false,
    error: error.message || 'An error occurred',
    code: error.code || 'ERROR'
  };

  if (error.validationErrors) {
    response.validationErrors = error.validationErrors;
  }

  if (includeStack && process.env.NODE_ENV !== 'production') {
    response.stack = error.stack;
  }

  return response;
}

/**
 * Create a standardized success response
 */
function createSuccessResponse(data, message = 'Success') {
  return {
    success: true,
    message,
    data
  };
}

/**
 * Verify that required environment variables are set
 */
function verifyEnvironmentVariables(required = []) {
  const missing = [];

  const defaultRequired = ['HS_PRIVATE_APP_TOKEN'];
  const allRequired = [...defaultRequired, ...required];

  for (const varName of allRequired) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

module.exports = {
  generateSecureToken,
  verifyCronSecret,
  setCorsHeaders,
  handleOptionsRequest,
  rateLimit,
  rateLimitMiddleware,
  sanitizeInput,
  createErrorResponse,
  createSuccessResponse,
  verifyEnvironmentVariables
};