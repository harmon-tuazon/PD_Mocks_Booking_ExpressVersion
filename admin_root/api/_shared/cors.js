/**
 * CORS Middleware for Admin API
 *
 * Implements secure Cross-Origin Resource Sharing (CORS) configuration
 * for the PrepDoctors admin application.
 *
 * Security Considerations:
 * - Uses origin allowlist instead of wildcard (*)
 * - Validates request origin against known frontend URLs
 * - Enables credentials to support cookie-based authentication
 * - Restricts allowed HTTP methods to required operations only
 * - Limits allowed headers to prevent header injection attacks
 * - Implements proper preflight (OPTIONS) request handling
 *
 * PCI DSS Compliance:
 * - Requirement 6.5.9: Protects against CSRF by validating origins
 * - Requirement 6.6: Implements security controls for web applications
 */

/**
 * Get allowed origins based on environment
 * @returns {string[]} Array of allowed origin URLs
 */
function getAllowedOrigins() {
  const origins = [
    // Development environments
    'http://localhost:5173',         // Vite dev server
    'http://localhost:3000',         // Alternative dev port
    'http://127.0.0.1:5173',        // Localhost alias
    'http://127.0.0.1:3000',        // Alternative localhost alias
  ];

  // Production frontend URL from environment variable
  if (process.env.FRONTEND_URL) {
    origins.push(process.env.FRONTEND_URL);
  }

  // Vercel deployment URLs (production and preview)
  if (process.env.VERCEL_URL) {
    origins.push(`https://${process.env.VERCEL_URL}`);
  }

  // Additional production URLs can be added via environment variable
  // Format: ADDITIONAL_ALLOWED_ORIGINS=https://app1.com,https://app2.com
  if (process.env.ADDITIONAL_ALLOWED_ORIGINS) {
    const additionalOrigins = process.env.ADDITIONAL_ALLOWED_ORIGINS
      .split(',')
      .map(origin => origin.trim())
      .filter(origin => origin.startsWith('http'));
    origins.push(...additionalOrigins);
  }

  return origins;
}

/**
 * Allowed HTTP methods for API endpoints
 * Restricts to only necessary methods for security
 */
const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'];

/**
 * Allowed request headers
 * Restricts to only necessary headers to prevent header injection
 */
const ALLOWED_HEADERS = [
  'Authorization',      // For JWT tokens
  'Content-Type',       // For request body format
  'X-Requested-With',   // For AJAX requests
];

/**
 * Maximum age for preflight cache (in seconds)
 * 24 hours = 86400 seconds
 */
const MAX_AGE = 86400;

/**
 * Apply CORS headers to response
 *
 * @param {Object} req - Incoming request object
 * @param {Object} res - Response object
 * @returns {boolean} True if origin is allowed, false otherwise
 */
function applyCors(req, res) {
  const requestOrigin = req.headers.origin;
  const allowedOrigins = getAllowedOrigins();

  // Log CORS attempt for security monitoring
  if (process.env.NODE_ENV !== 'production') {
    console.log('[CORS] Request from origin:', requestOrigin);
  }

  // Check if origin is in allowlist
  const isAllowedOrigin = allowedOrigins.includes(requestOrigin);

  // Only set CORS headers if origin is allowed
  if (isAllowedOrigin) {
    // Set the specific origin that made the request (not wildcard)
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);

    // Allow credentials (cookies, authorization headers)
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // Set allowed methods
    res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS.join(', '));

    // Set allowed headers
    res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS.join(', '));

    // Set preflight cache duration
    res.setHeader('Access-Control-Max-Age', MAX_AGE.toString());

    // Additional security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');

    return true;
  }

  // Origin not allowed - log security event
  if (requestOrigin) {
    console.warn('[CORS] Blocked request from unauthorized origin:', requestOrigin);
  }

  return false;
}

/**
 * CORS middleware wrapper for serverless functions
 *
 * Usage in API endpoints:
 * ```javascript
 * const { corsMiddleware } = require('../_shared/cors');
 *
 * module.exports = async (req, res) => {
 *   // Apply CORS - handles OPTIONS and validates origin
 *   if (!corsMiddleware(req, res)) {
 *     return; // CORS handled the response
 *   }
 *
 *   // Your endpoint logic here
 *   res.json({ success: true });
 * };
 * ```
 *
 * @param {Object} req - Incoming request object
 * @param {Object} res - Response object
 * @returns {boolean} True if request should continue, false if handled (OPTIONS)
 */
function corsMiddleware(req, res) {
  // Apply CORS headers
  const isAllowed = applyCors(req, res);

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    if (isAllowed) {
      res.status(200).end();
    } else {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Origin not allowed'
        }
      });
    }
    return false; // Request handled, don't continue
  }

  // For non-OPTIONS requests, block if origin not allowed
  if (!isAllowed && req.headers.origin) {
    res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Origin not allowed'
      }
    });
    return false;
  }

  // Continue processing request
  return true;
}

/**
 * Express-compatible CORS middleware
 * For use with Express apps or middleware chains
 *
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next function
 */
function corsExpressMiddleware(req, res, next) {
  const shouldContinue = corsMiddleware(req, res);
  if (shouldContinue) {
    next();
  }
  // If shouldContinue is false, response already sent
}

module.exports = {
  applyCors,
  corsMiddleware,
  corsExpressMiddleware,
  getAllowedOrigins, // Exported for testing
  ALLOWED_METHODS,
  ALLOWED_HEADERS
};
