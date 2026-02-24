/**
 * Activate Scheduled Exams Job
 * Finds sessions where scheduled_activation_datetime <= now() and activates them
 *
 * Original: api/admin/cron/activate-scheduled-exams.js
 * Schedule: Twice daily at 17:00 and 18:00 UTC
 */

const { activateScheduledSessions } = require('../services/scheduledActivation');

async function runActivateScheduled() {
  const startTime = Date.now();

  console.log(`🕐 [ACTIVATE-SCHEDULED] Starting at ${new Date().toISOString()}`);

  const result = await activateScheduledSessions();

  const duration = Date.now() - startTime;
  console.log(`✅ [ACTIVATE-SCHEDULED] Completed in ${duration}ms`);

  return {
    success: true,
    duration: `${duration}ms`,
    ...result
  };
}

module.exports = { runActivateScheduled };
