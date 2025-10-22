/**
 * Health check endpoint for monitoring API availability
 */

export default function handler(req, res) {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'mocks-booking-api'
  });
}