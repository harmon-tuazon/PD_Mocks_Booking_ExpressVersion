/**
 * Admin API Health Check Endpoint
 */

module.exports = async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'admin-api',
    environment: process.env.VERCEL_ENV || 'development',
    version: '1.0.0',
    checks: {}
  };

  // Check HubSpot connection
  try {
    const { HubSpotService } = require('./_shared/hubspot');
    await HubSpotService.testConnection();
    health.checks.hubspot = 'connected';
  } catch (error) {
    health.checks.hubspot = 'error';
    health.status = 'degraded';
  }

  // Check Redis connection if configured
  if (process.env.REDIS_URL) {
    try {
      const { redisClient } = require('./_shared/redis');
      await redisClient.ping();
      health.checks.redis = 'connected';
    } catch (error) {
      health.checks.redis = 'error';
      health.status = 'degraded';
    }
  }

  // Check admin auth configuration
  health.checks.adminAuth = process.env.ADMIN_JWT_SECRET ? 'configured' : 'missing';
  if (!process.env.ADMIN_JWT_SECRET) {
    health.status = 'degraded';
  }

  const statusCode = health.status === 'healthy' ? 200 : 503;

  res.status(statusCode).json(health);
};