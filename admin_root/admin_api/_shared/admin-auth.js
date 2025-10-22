/**
 * Admin Authentication Middleware
 * Enhanced authentication for admin dashboard with stronger requirements
 */

const jwt = require('jsonwebtoken');

// Verify admin-level JWT token
const verifyAdminToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'NO_TOKEN'
      });
    }

    // Verify JWT with admin secret
    const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);

    // Check admin role
    if (decoded.role !== 'admin' && decoded.role !== 'super_admin') {
      return res.status(403).json({
        error: 'Admin privileges required',
        code: 'INSUFFICIENT_PRIVILEGES'
      });
    }

    // Check session expiry
    if (decoded.exp && Date.now() >= decoded.exp * 1000) {
      return res.status(401).json({
        error: 'Session expired',
        code: 'SESSION_EXPIRED'
      });
    }

    // Attach user to request
    req.admin = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      permissions: decoded.permissions || []
    };

    next();
  } catch (error) {
    console.error('Admin auth error:', error);

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }

    return res.status(500).json({
      error: 'Authentication error',
      code: 'AUTH_ERROR'
    });
  }
};

// Check specific permission
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'NOT_AUTHENTICATED'
      });
    }

    if (req.admin.role === 'super_admin') {
      // Super admin has all permissions
      return next();
    }

    if (!req.admin.permissions?.includes(permission)) {
      return res.status(403).json({
        error: `Permission required: ${permission}`,
        code: 'MISSING_PERMISSION',
        required: permission
      });
    }

    next();
  };
};

// Rate limiting for admin actions
const adminRateLimit = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100,
  requests: new Map()
};

const rateLimitAdmin = (req, res, next) => {
  const key = req.admin?.id || req.ip;
  const now = Date.now();

  // Clean old entries
  for (const [k, v] of adminRateLimit.requests) {
    if (now - v.timestamp > adminRateLimit.windowMs) {
      adminRateLimit.requests.delete(k);
    }
  }

  const userRequests = adminRateLimit.requests.get(key) || { count: 0, timestamp: now };

  if (now - userRequests.timestamp > adminRateLimit.windowMs) {
    userRequests.count = 0;
    userRequests.timestamp = now;
  }

  userRequests.count++;
  adminRateLimit.requests.set(key, userRequests);

  if (userRequests.count > adminRateLimit.maxRequests) {
    return res.status(429).json({
      error: 'Too many requests',
      code: 'RATE_LIMITED',
      retryAfter: adminRateLimit.windowMs / 1000
    });
  }

  next();
};

module.exports = {
  verifyAdminToken,
  requirePermission,
  rateLimitAdmin
};