/**
 * Cron Job Scheduler
 * Replaces Vercel cron configuration with node-cron for Express
 *
 * Schedules:
 * - syncExams: Every hour (HubSpot → Supabase exam sync + hubspot_id backfill)
 * - syncBookings: Every 15 minutes (Supabase → HubSpot new booking creation)
 * - activateScheduled: Twice daily at 17:00 and 18:00 UTC (activate scheduled exams)
 */

const cluster = require('cluster');
const cron = require('node-cron');
const { runSyncExams } = require('./syncExams.job');
const { runSyncBookings } = require('./syncBookings.job');
const { runActivateScheduled } = require('./activateScheduled.job');

function initScheduler() {
  // In PM2 cluster mode, only run cron jobs on worker 0 to prevent duplicates
  const instanceId = process.env.NODE_APP_INSTANCE || '0';
  if (instanceId !== '0') {
    console.log(`[SCHEDULER] Skipping cron init on worker ${instanceId} (only worker 0 runs crons)`);
    return;
  }

  console.log('[SCHEDULER] Initializing cron jobs (worker 0)...');

  // Sync exams from HubSpot → Supabase (every hour)
  cron.schedule('0 * * * *', async () => {
    console.log(`[SCHEDULER] Running syncExams at ${new Date().toISOString()}`);
    try {
      const result = await runSyncExams();
      console.log('[SCHEDULER] syncExams completed:', result);
    } catch (error) {
      console.error('[SCHEDULER] syncExams failed:', error.message);
    }
  });

  // Sync bookings from Supabase → HubSpot (every 15 minutes)
  cron.schedule('*/15 * * * *', async () => {
    console.log(`[SCHEDULER] Running syncBookings at ${new Date().toISOString()}`);
    try {
      const result = await runSyncBookings();
      console.log('[SCHEDULER] syncBookings completed:', result);
    } catch (error) {
      console.error('[SCHEDULER] syncBookings failed:', error.message);
    }
  });

  // Activate scheduled exams at 17:00 UTC
  cron.schedule('0 17 * * *', async () => {
    console.log(`[SCHEDULER] Running activateScheduled (17:00 UTC) at ${new Date().toISOString()}`);
    try {
      const result = await runActivateScheduled();
      console.log('[SCHEDULER] activateScheduled completed:', result);
    } catch (error) {
      console.error('[SCHEDULER] activateScheduled failed:', error.message);
    }
  });

  // Activate scheduled exams at 18:00 UTC
  cron.schedule('0 18 * * *', async () => {
    console.log(`[SCHEDULER] Running activateScheduled (18:00 UTC) at ${new Date().toISOString()}`);
    try {
      const result = await runActivateScheduled();
      console.log('[SCHEDULER] activateScheduled completed:', result);
    } catch (error) {
      console.error('[SCHEDULER] activateScheduled failed:', error.message);
    }
  });

  console.log('[SCHEDULER] Cron jobs registered:');
  console.log('  - syncExams: every hour (0 * * * *)');
  console.log('  - syncBookings: every 15 min (*/15 * * * *)');
  console.log('  - activateScheduled: 17:00 & 18:00 UTC');
}

module.exports = { initScheduler };
