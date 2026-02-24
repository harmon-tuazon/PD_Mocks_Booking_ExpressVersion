/**
 * GET /api/admin/cron/sync-bookings-from-supabase
 * Create new bookings in HubSpot for Supabase-first bookings
 *
 * Purpose: Creates bookings in HubSpot for records created in Supabase (hubspot_id = NULL)
 * Security: Requires CRON_SECRET
 */

const { createClient } = require('@supabase/supabase-js');
const { HubSpotService } = require('../../services/hubspot');

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
 * Sync all bookings to HubSpot
 */
async function syncBookings(summary) {
  console.log('[BATCH SYNC] Syncing bookings...');
  const hubspot = new HubSpotService();

  const { data: newBookings, error: newError } = await supabaseAdmin
    .from('hubspot_bookings')
    .select('*')
    .is('hubspot_id', null);

  if (newError) throw newError;

  console.log(`[BATCH SYNC] Found ${newBookings?.length || 0} new bookings to create in HubSpot`);

  for (const booking of newBookings || []) {
    try {
      console.log(`[BATCH SYNC] Processing booking:`, {
        id: booking.id,
        booking_id: booking.booking_id,
        name: booking.name,
        student_email: booking.student_email,
        columns: Object.keys(booking)
      });

      if (!booking.booking_id || !booking.name || !booking.student_email) {
        console.error(`[BATCH SYNC] Skipping booking ${booking.id} - missing required fields:`, {
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

      await supabaseAdmin
        .from('hubspot_bookings')
        .update({
          hubspot_id: hubspotBooking.id,
          hubspot_last_sync_at: new Date().toISOString()
        })
        .eq('id', booking.id);

      summary.bookings.created++;
      console.log(`[BATCH SYNC] Created booking ${booking.booking_id} in HubSpot (ID: ${hubspotBooking.id})`);
    } catch (err) {
      console.error('[BATCH SYNC] Failed to create booking:', booking.id, err.message);
      summary.bookings.failed++;
    }
  }

  console.log('[BATCH SYNC] Bookings synced:', summary.bookings);
}

const syncBookingsFromSupabase = async (req, res, next) => {
  // Verify cron secret
  if (req.headers['x-vercel-cron'] !== 'true' &&
      req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const startTime = Date.now();
  const summary = {
    bookings: { created: 0, failed: 0 }
  };

  try {
    console.log('[BATCH SYNC] Starting batch sync to HubSpot (bookings only)...');

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

module.exports = { syncBookingsFromSupabase };
