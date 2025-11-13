/**
 * POST /api/admin/mock-exams/trigger-scheduled-activation
 * Manual trigger for scheduled activation (testing & admin override)
 *
 * This endpoint allows admins to manually trigger the scheduled activation
 * process without waiting for the cron job. Useful for:
 * - Testing the activation logic
 * - Manual override when cron fails
 * - Immediate activation of overdue scheduled sessions
 *
 * Security: Requires admin authentication (not CRON_SECRET)
 */

const { requireAdmin } = require('../middleware/requireAdmin');
const { activateScheduledSessions } = require('../../_shared/scheduledActivation');

module.exports = async (req, res) => {
  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return res.status(405).json({
        success: false,
        error: {
          code: 'METHOD_NOT_ALLOWED',
          message: `Method ${req.method} not allowed. Use POST.`
        }
      });
    }

    // Verify admin authentication (NOT CRON_SECRET)
    const user = await requireAdmin(req);
    const adminEmail = user?.email || 'admin@prepdoctors.com';

    console.log(`🔧 [MANUAL-TRIGGER] Admin ${adminEmail} triggered scheduled activation`);

    // Call the shared activation logic (same as cron job uses)
    const result = await activateScheduledSessions();

    // Return result
    return res.status(200).json({
      success: true,
      triggered_by: 'manual',
      admin_email: adminEmail,
      ...result
    });

  } catch (error) {
    console.error('❌ [MANUAL-TRIGGER] Error:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to trigger scheduled activation',
        details: error.message
      }
    });
  }
};
