/**
 * Sync Bookings Job
 * Creates new bookings in HubSpot for Supabase-first bookings (hubspot_id = NULL)
 *
 * Original: api/admin/cron/sync-bookings-from-supabase.js
 * Schedule: Every 15 minutes
 */

const { createClient } = require('@supabase/supabase-js');
const { HubSpotService } = require('../services/hubspot');

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

const OBJECT_TYPES = {
  CONTACTS: '0-1',
  BOOKINGS: '2-50158943',
  MOCK_EXAMS: '2-50158913'
};

async function runSyncBookings() {
  const startTime = Date.now();
  const summary = {
    bookings: { created: 0, failed: 0 }
  };

  console.log('[SYNC-BOOKINGS] Starting batch sync to HubSpot (bookings only)...');

  const hubspot = new HubSpotService();

  // Get bookings without hubspot_id (new bookings created in Supabase)
  const { data: newBookings, error: fetchError } = await supabaseAdmin
    .from('hubspot_bookings')
    .select('*')
    .is('hubspot_id', null);

  if (fetchError) throw fetchError;

  console.log(`[SYNC-BOOKINGS] Found ${newBookings?.length || 0} new bookings to create in HubSpot`);

  for (const booking of newBookings || []) {
    try {
      if (!booking.booking_id || !booking.name || !booking.student_email) {
        console.error(`[SYNC-BOOKINGS] Skipping booking ${booking.id} - missing required fields:`, {
          booking_id: booking.booking_id || 'MISSING',
          name: booking.name || 'MISSING',
          student_email: booking.student_email || 'MISSING'
        });
        summary.bookings.failed++;
        continue;
      }

      const hubspotBooking = await hubspot.createBooking({
        bookingId: booking.booking_id,
        name: booking.name,
        email: booking.student_email,
        tokenUsed: booking.token_used,
        attendingLocation: booking.attending_location,
        dominantHand: booking.dominant_hand,
        idempotencyKey: booking.idempotency_key
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
      console.log(`✅ [SYNC-BOOKINGS] Created booking ${booking.booking_id} in HubSpot (ID: ${hubspotBooking.id})`);
    } catch (err) {
      console.error('[SYNC-BOOKINGS] Failed to create booking:', booking.id, err.message);
      summary.bookings.failed++;
    }
  }

  console.log('⏭️ Skipping booking updates (handled by Edge Function webhook, rollup fields auto-update)');

  const duration = Date.now() - startTime;
  console.log(`[SYNC-BOOKINGS] Completed in ${duration}ms:`, summary);

  return {
    success: true,
    duration: `${duration}ms`,
    summary
  };
}

module.exports = { runSyncBookings };
