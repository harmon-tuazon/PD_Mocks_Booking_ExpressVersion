/**
 * Structured JSON request logger middleware
 * Logs method, path, status, duration, and user info on response finish
 */
const requestLogger = (req, res, next) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('user-agent'),
      ip: req.ip,
      userId: req.user?.hubspot_id || 'anonymous'
    }));
  });

  next();
};

module.exports = requestLogger;
