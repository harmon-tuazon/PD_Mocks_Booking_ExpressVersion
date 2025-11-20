/**
 * GET /api/admin/mock-exams/metrics
 * Get dashboard metrics for mock exams
 */

const { requirePermission } = require('../middleware/requirePermission');
const { validationMiddleware } = require('../../_shared/validation');
const hubspot = require('../../_shared/hubspot');

module.exports = async (req, res) => {
  try {
    // Verify admin authentication and permission
    const user = await requirePermission(req, 'exams.view');

    // Validate query parameters
    const validator = validationMiddleware('mockExamMetrics');
    await new Promise((resolve, reject) => {
      validator(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    const { date_from, date_to } = req.validatedData;

    // Build filters object
    const filters = {};
    if (date_from) filters.date_from = date_from;
    if (date_to) filters.date_to = date_to;

    // Calculate metrics
    const metrics = await hubspot.calculateMetrics(filters);

    res.status(200).json({
      success: true,
      metrics
    });

  } catch (error) {
    // Add auth-specific error handling FIRST
    if (error.message.includes('authorization') || error.message.includes('token')) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: error.message }
      });
    }

    console.error('Error calculating metrics:', error);

    res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Failed to calculate metrics'
    });
  }
};
