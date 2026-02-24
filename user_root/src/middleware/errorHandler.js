/**
 * Global Express error handler
 * Must be registered AFTER all routes (4-argument signature is required)
 */
const errorHandler = (err, req, res, next) => {
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    user: req.user?.hubspot_id
  });

  // Handle known error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: err.message }
    });
  }

  if (err.code === 'RACE_CONDITION' || err.code === 'BOOKING_LOCKED' || err.code === 'LOCK_ACQUISITION_FAILED') {
    return res.status(409).json({
      success: false,
      error: { code: err.code, message: err.message }
    });
  }

  if (err.code === 'INSUFFICIENT_CREDITS') {
    return res.status(402).json({
      success: false,
      error: { code: err.code, message: err.message }
    });
  }

  if (err.status === 429) {
    return res.status(429).json({
      success: false,
      error: { code: 'RATE_LIMITED', message: err.message }
    });
  }

  // Default error response
  const status = err.status || err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'An error occurred processing your request'
    : err.message;

  res.status(status).json({
    success: false,
    error: {
      code: err.code || 'SERVER_ERROR',
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
};

module.exports = errorHandler;
