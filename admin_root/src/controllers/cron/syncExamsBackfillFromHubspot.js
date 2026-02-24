/**
 * GET /api/admin/cron/sync-exams-backfill-bookings-from-hubspot
 * Reconcile HubSpot manual changes and backfill missing hubspot_ids
 *
 * What This Cron Does:
 * - Syncs exam data: HubSpot -> Supabase (incremental sync)
 * - Backfills missing hubspot_id values using idempotency_key matching
 * - Does NOT sync booking properties or credits
 *
 * Security: Requires CRON_SECRET
 */

const { syncAllData } = require('../../services/supabaseSync.optimized');

const syncExamsBackfillFromHubspot = async (req, res, next) => {
  const startTime = Date.now();

  try {
    // Verify CRON_SECRET
    const authHeader = req.headers.authorization;
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

    if (authHeader !== expectedAuth) {
      console.warn('[CRON] Unauthorized attempt to trigger sync-supabase cron job');
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or missing CRON_SECRET'
        }
      });
    }

    console.log(`[CRON] Starting Supabase sync at ${new Date().toISOString()}`);

    const result = await syncAllData();

    if (Date.now() - startTime > 55000) {
      console.warn(`[CRON] Sync operation approaching timeout`);
    }

    console.log(`[CRON] Sync completed:`, result.summary);

    return res.status(200).json({
      success: true,
      triggered_by: 'cron',
      ...result
    });

  } catch (error) {
    console.error('[CRON] Error in Supabase sync:', error);

    if (Date.now() - startTime > 55000) {
      return res.status(504).json({
        success: false,
        error: {
          code: 'TIMEOUT',
          message: 'Sync operation timeout',
          details: 'Operation exceeded 55 second threshold'
        }
      });
    }

    return res.status(500).json({
      success: false,
      error: {
        code: 'SYNC_ERROR',
        message: 'Failed to sync Supabase data',
        details: error.message
      }
    });
  }
};

module.exports = { syncExamsBackfillFromHubspot };
