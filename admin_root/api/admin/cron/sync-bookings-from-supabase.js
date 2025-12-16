/**
 * GET /api/admin/cron/sync-bookings-from-supabase
 * Vercel Cron Job - Create new bookings in HubSpot for Supabase-first bookings
 *
 * Schedule: Runs every 15 minutes (*15 * * * *) - configured in vercel.json
 * Purpose: Creates bookings in HubSpot for records created in Supabase (hubspot_id = NULL)
 *
 * Supabase-First Flow:
 * 1. User creates booking → Supabase record (hubspot_id = NULL)
 * 2. This cron runs every 15 mins → Creates in HubSpot with associations
 * 3. Updates Supabase with hubspot_id
 * 4. Property updates handled by Edge Function webhook (real-time)
 *
 * What This Cron Does:
 * - ✅ Creates new bookings in HubSpot (Step 1-2)
 * - ✅ Creates associations (contact + exam)
 * - ✅ Updates Supabase with hubspot_id
 * - ❌ Does NOT update existing bookings (Edge Function handles updates)
 *
 * Security: Requires CRON_SECRET from Vercel (set in environment variables)
 *
 * Usage:
 * - Automatically triggered by Vercel every 15 minutes
 * - Can be manually triggered: curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain.com/api/admin/cron/sync-bookings-from-supabase
 *
 * See: PRDs/supabase/supabase_SOT_migrations/04-cron-batch-sync.md
 **/

const { createClient } = require('@supabase/supabase-js');
const { HubSpotService } = require('../../_shared/hubspot');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    db: { schema: process.env.SUPABASE_SCHEMA_NAME || 'hubspot_sync' }
  }
);

// HubSpot object type IDs
const OBJECT_TYPES = {
  CONTACTS: '0-1',
  BOOKINGS: '2-50158943',
  MOCK_EXAMS: '2-50158913'
};

/**
 * Batch sync cron job - BOOKINGS ONLY
 * Credits are synced via webhooks in real-time
 * Runs every 2 hours
 */
module.exports = async (req, res) => {
  // Verify cron secret
  if (req.headers['x-vercel-cron'] !== 'true' &&
      req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const startTime = Date.now();
  const summary = {
    bookings: { created: 0, failed: 0 }  // 'updated' removed - Edge Function handles updates
  };

  try {
    console.log('[BATCH SYNC] Starting batch sync to HubSpot (bookings only)...');

    // Sync bookings only (credits handled by webhooks)
    await syncBookings(summary);

    const duration = Date.now() - startTime;
    console.log('[BATCH SYNC] Completed in', duration, 'ms');
    console.log('[BATCH SYNC] Summary:', summary);

    return res.status(200).json({
      success: true,
      duration: `${duration}ms`,
      summary
    });

  } catch (error) {
    console.error('[BATCH SYNC] Failed:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      summary
    });
  }
};

/**
 * Sync all bookings to HubSpot
 */
async function syncBookings(summary) {
  console.log('[BATCH SYNC] Syncing bookings...');
  const hubspot = new HubSpotService();

  // Step 1: Get bookings without hubspot_id (new bookings created in Supabase)
  const { data: newBookings, error: newError } = await supabaseAdmin
    .from('hubspot_bookings')
    .select('*')
    .is('hubspot_id', null);

  if (newError) throw newError;

  console.log(`[BATCH SYNC] Found ${newBookings?.length || 0} new bookings to create in HubSpot`);

  // Step 2: Create new bookings in HubSpot one by one
  for (const booking of newBookings || []) {
    try {
      // Log booking data for debugging
      console.log(`[BATCH SYNC] Processing booking:`, {
        id: booking.id,
        booking_id: booking.booking_id,
        name: booking.name,
        student_email: booking.student_email,
        columns: Object.keys(booking)
      });

      // Validate required fields before attempting HubSpot creation
      if (!booking.booking_id || !booking.name || !booking.student_email) {
        console.error(`[BATCH SYNC] Skipping booking ${booking.id} - missing required fields:`, {
          booking_id: booking.booking_id || 'MISSING',
          name: booking.name || 'MISSING',
          student_email: booking.student_email || 'MISSING'
        });
        summary.bookings.failed++;
        continue;
      }

      // Create booking in HubSpot
      // IMPORTANT: HubSpotService.createBooking expects camelCase field names
      // Supabase columns are snake_case, so we need to map them correctly:
      // - Supabase 'name' → HubSpot 'name' (via bookingData.name)
      // - Supabase 'student_email' → HubSpot 'email' (via bookingData.email)
      // - Supabase 'booking_id' → HubSpot 'booking_id' (via bookingData.bookingId)
      const hubspotBooking = await hubspot.createBooking({
        bookingId: booking.booking_id,           // Supabase column: booking_id
        name: booking.name,                       // Supabase column: name
        email: booking.student_email,             // Supabase column: student_email
        tokenUsed: booking.token_used,           // Supabase column: token_used
        attendingLocation: booking.attending_location,  // Supabase column: attending_location
        dominantHand: booking.dominant_hand,     // Supabase column: dominant_hand
        idempotencyKey: booking.idempotency_key  // Supabase column: idempotency_key
      });

      // Create associations
      if (booking.associated_contact_id) {
        await hubspot.createAssociation(
          OBJECT_TYPES.BOOKINGS,
          hubspotBooking.id,
          OBJECT_TYPES.CONTACTS,
          booking.associated_contact_id
        );
      }

      if (booking.associated_mock_exam) {
        await hubspot.createAssociation(
          OBJECT_TYPES.BOOKINGS,
          hubspotBooking.id,
          OBJECT_TYPES.MOCK_EXAMS,
          booking.associated_mock_exam
        );
      }

      // Update Supabase with hubspot_id
      await supabaseAdmin
        .from('hubspot_bookings')
        .update({
          hubspot_id: hubspotBooking.id,
          hubspot_last_sync_at: new Date().toISOString()
        })
        .eq('id', booking.id);

      summary.bookings.created++;
      console.log(`✅ [BATCH SYNC] Created booking ${booking.booking_id} in HubSpot (ID: ${hubspotBooking.id})`);
    } catch (err) {
      console.error('[BATCH SYNC] Failed to create booking:', booking.id, err.message);
      summary.bookings.failed++;
    }
  }

  // Step 3 & 4 REMOVED: Booking updates are now handled by Edge Function webhook
  // HubSpot rollup fields (attendance, is_active) auto-update from associations
  console.log('⏭️ Skipping booking updates (handled by Edge Function webhook, rollup fields auto-update)');
  console.log('[BATCH SYNC] Bookings synced:', summary.bookings);
}

/**
 * Split array into chunks
 */
function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}