/**
 * Sync Exams Job
 * Reconciles HubSpot manual changes → Supabase and backfills missing hubspot_ids
 *
 * Original: api/admin/cron/sync-exams-backfill-bookings-from-hubspot.js
 * Schedule: Every 1 hour
 */

const { syncAllData } = require('../services/supabaseSync.optimized');

async function runSyncExams() {
  const startTime = Date.now();

  console.log(`🔄 [SYNC-EXAMS] Starting at ${new Date().toISOString()}`);

  const result = await syncAllData();

  const duration = Date.now() - startTime;
  console.log(`✅ [SYNC-EXAMS] Completed in ${duration}ms:`, result.summary);

  return {
    success: true,
    duration: `${duration}ms`,
    ...result
  };
}

module.exports = { runSyncExams };
