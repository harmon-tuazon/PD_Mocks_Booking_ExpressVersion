/**
 * GET /api/admin/cron/activate-scheduled-exams
 * Vercel Cron Job - Automatically activate scheduled mock exam sessions
 *
 * Schedule: Runs twice daily - configured in vercel.json
 *   - 5:00 PM UTC (0 17 * * *) = 12:00 PM EST / 1:00 PM EDT
 *   - 6:00 PM UTC (0 18 * * *) = 1:00 PM EST / 2:00 PM EDT
 * Purpose: Finds sessions where scheduled_activation_datetime <= now() and activates them
 *
 * Security: Requires CRON_SECRET from Vercel (set in environment variables)
 */

const { activateScheduledSessions } = require('../../_shared/scheduledActivation');

module.exports = async (req, res) => {
  const startTime = Date.now();

  try {
    // Only allow GET requests (Vercel cron uses GET)
    if (req.method !== 'GET') {
      return res.status(405).json({
        success: false,
        error: {
          code: 'METHOD_NOT_ALLOWED',
          message: `Method ${req.method} not allowed. Use GET.`
        }
      });
    }

    // Verify CRON_SECRET (Vercel automatically adds this header)
    const authHeader = req.headers.authorization;
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

    if (authHeader !== expectedAuth) {
      console.warn('⚠️ [CRON] Unauthorized attempt to trigger cron job');
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or missing CRON_SECRET'
        }
      });
    }

    console.log(`🕐 [CRON] Starting scheduled activation check at ${new Date().toISOString()}`);

    // Call shared activation logic
    const result = await activateScheduledSessions();

    // Check for timeout (Vercel 60s limit)
    if (Date.now() - startTime > 55000) {
      console.warn(`⚠️ [CRON] Operation approaching timeout`);
    }

    // Return success response
    return res.status(200).json({
      success: true,
      triggered_by: 'cron',
      ...result
    });

  } catch (error) {
    console.error('❌ [CRON] Error in scheduled activation:', error);

    // Handle timeout errors
    if (Date.now() - startTime > 55000) {
      return res.status(504).json({
        success: false,
        error: {
          code: 'TIMEOUT',
          message: 'Cron job timeout'
        }
      });
    }

    // Generic error
    return res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to activate scheduled sessions',
        details: error.message
      }
    });
  }
};
