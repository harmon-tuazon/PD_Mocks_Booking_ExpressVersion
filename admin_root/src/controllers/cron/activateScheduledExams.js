/**
 * GET /api/admin/cron/activate-scheduled-exams
 * Automatically activate scheduled mock exam sessions
 *
 * Security: Requires CRON_SECRET (Bearer token in Authorization header)
 */

const { activateScheduledSessions } = require('../../services/scheduledActivation');

const activateScheduledExams = async (req, res, next) => {
  const startTime = Date.now();

  try {
    // Verify CRON_SECRET
    const authHeader = req.headers.authorization;
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

    if (authHeader !== expectedAuth) {
      console.warn('[CRON] Unauthorized attempt to trigger cron job');
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or missing CRON_SECRET'
        }
      });
    }

    console.log(`[CRON] Starting scheduled activation check at ${new Date().toISOString()}`);

    const result = await activateScheduledSessions();

    if (Date.now() - startTime > 55000) {
      console.warn(`[CRON] Operation approaching timeout`);
    }

    return res.status(200).json({
      success: true,
      triggered_by: 'cron',
      ...result
    });

  } catch (error) {
    console.error('[CRON] Error in scheduled activation:', error);

    if (Date.now() - startTime > 55000) {
      return res.status(504).json({
        success: false,
        error: {
          code: 'TIMEOUT',
          message: 'Cron job timeout'
        }
      });
    }

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

module.exports = { activateScheduledExams };
