/**
 * GET /api/admin/cron/sync-exams-backfill-bookings-from-hubspot
 * Vercel Cron Job - Reconcile HubSpot manual changes and backfill missing hubspot_ids
 * ⚠️ NOTE: Booking properties and credits are NOT synced via this cron (see hybrid sync architecture)
 *
 * Schedule: Runs every 1 hour - configured in vercel.json
 * Purpose: Keeps Supabase exams synchronized with HubSpot manual admin changes
 *
 * What This Cron Does:
 * - ✅ Syncs exam data: HubSpot → Supabase (incremental sync using hs_lastmodifieddate)
 * - ✅ Backfills missing hubspot_id values in Supabase using idempotency_key matching
 * - ❌ Does NOT sync booking properties (Edge Function handles updates)
 * - ❌ Does NOT sync credits (webhooks + fire-and-forget handle credits)
 *
 * Hybrid Sync Architecture:
 * - Exams: HubSpot → Supabase (this cron, every 1 hour for manual admin changes)
 * - Bookings: Created in Supabase first, synced by sync-bookings-from-supabase cron
 * - Booking Updates: Edge Function webhook (real-time < 1s)
 * - Credits (User ops): Supabase → HubSpot (real-time webhook < 1s after booking/cancel)
 * - Credits (Admin ops): HubSpot → Supabase (fire-and-forget sync after token updates)
 *
 * Security: Requires CRON_SECRET from Vercel (set in environment variables)
 *
 * Usage:
 * - Automatically triggered by Vercel every 1 hour
 * - Can be manually triggered: curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain.com/api/admin/cron/sync-exams-backfill-bookings-from-hubspot
 *
 * See: PRDs/supabase/supabase_SOT_migrations/04-cron-batch-sync.md
 **/

const { syncAllData } = require('../../_shared/supabaseSync.optimized');

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
      console.warn('⚠️ [CRON] Unauthorized attempt to trigger sync-supabase cron job');
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or missing CRON_SECRET'
        }
      });
    }

    console.log(`🔄 [CRON] Starting Supabase sync at ${new Date().toISOString()}`);

    // Execute sync
    const result = await syncAllData();

    // Check for timeout (Vercel 60s limit)
    if (Date.now() - startTime > 55000) {
      console.warn(`⚠️ [CRON] Sync operation approaching timeout`);
    }

    console.log(`✅ [CRON] Sync completed:`, result.summary);

    // Return success response
    return res.status(200).json({
      success: true,
      triggered_by: 'cron',
      ...result
    });

  } catch (error) {
    console.error('❌ [CRON] Error in Supabase sync:', error);

    // Handle timeout errors
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

    // Generic error
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
