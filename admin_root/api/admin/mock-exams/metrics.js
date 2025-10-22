/**
 * GET /api/admin/mock-exams/metrics
 * Get dashboard metrics for mock exams
 */

const { requireAdmin } = require('../middleware/requireAdmin');
const { validationMiddleware } = require('../../_shared/validation');
const hubspot = require('../../_shared/hubspot');

module.exports = async (req, res) => {
  await requireAdmin(req, res, async () => {
    try {
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
      console.error('Error calculating metrics:', error);

      res.status(error.status || 500).json({
        success: false,
        error: error.message || 'Failed to calculate metrics'
      });
    }
  });
};
