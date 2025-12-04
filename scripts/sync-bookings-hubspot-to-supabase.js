/**
 * Sync Bookings: HubSpot → Supabase
 * Fetches all bookings from HubSpot and syncs them to Supabase
 *
 * Usage: node scripts/sync-bookings-hubspot-to-supabase.js
 *
 * Required environment variables:
 * - HS_PRIVATE_APP_TOKEN (HubSpot)
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - SUPABASE_SCHEMA_NAME (optional, defaults to 'hubspot_sync')
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase
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

// HubSpot API configuration
const HUBSPOT_TOKEN = process.env.HS_PRIVATE_APP_TOKEN;
const HUBSPOT_BASE_URL = 'https://api.hubapi.com';

// Object type IDs
const HUBSPOT_OBJECTS = {
  bookings: '2-50158943'
};

// Booking properties to fetch from HubSpot
const BOOKING_PROPERTIES = [
  'booking_id',
  'associated_mock_exam',
  'associated_contact_id',
  'student_id',
  'name',
  'email',
  'is_active',
  'attendance',
  'attending_location',
  'exam_date',
  'dominant_hand',
  'token_used',
  'token_refunded_at',
  'token_refund_admin',
  'mock_type',
  'start_time',
  'end_time',
  'ndecc_exam_date',
  'idempotency_key',
  'hs_createdate',
  'hs_lastmodifieddate'
];

/**
 * Make HubSpot API call with error handling
 */
async function hubspotApiCall(method, endpoint, body = null) {
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${HUBSPOT_TOKEN}`,
      'Content-Type': 'application/json'
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${HUBSPOT_BASE_URL}${endpoint}`, options);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HubSpot API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Fetch all bookings from HubSpot with pagination
 */
async function fetchAllBookings() {
  const allBookings = [];
  let after = undefined;

  console.log('📋 Fetching all bookings from HubSpot...');

  do {
    const searchBody = {
      filterGroups: [],
      properties: BOOKING_PROPERTIES,
      limit: 100
    };

    if (after) {
      searchBody.after = after;
    }

    const response = await hubspotApiCall(
      'POST',
      `/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}/search`,
      searchBody
    );

    allBookings.push(...response.results);
    after = response.paging?.next?.after;

    console.log(`  Fetched ${allBookings.length} bookings so far...`);

    // Rate limiting - respect HubSpot's rate limits
    await new Promise(resolve => setTimeout(resolve, 100));

  } while (after);

  console.log(`✅ Fetched ${allBookings.length} total bookings from HubSpot`);
  return allBookings;
}

/**
 * Parse timestamp value from HubSpot (handles empty strings, null, undefined)
 */
function parseTimestamp(value) {
  if (!value || value === '' || value === 'null' || value === 'undefined') {
    return null;
  }
  // HubSpot timestamps are Unix milliseconds
  const parsed = parseInt(value);
  if (isNaN(parsed)) {
    return null;
  }
  try {
    return new Date(parsed).toISOString();
  } catch {
    return null;
  }
}

/**
 * Parse date string (handles empty strings)
 */
function parseDateString(value) {
  if (!value || value === '' || value === 'null' || value === 'undefined') {
    return null;
  }
  return value;
}

/**
 * Transform HubSpot booking to Supabase format
 */
function transformBookingForSupabase(booking) {
  const props = booking.properties;

  return {
    hubspot_id: booking.id,
    booking_id: props.booking_id || null,
    associated_mock_exam: props.associated_mock_exam || null,
    associated_contact_id: props.associated_contact_id || null,
    student_id: props.student_id || null,
    name: props.name || null,
    student_email: props.email || null,
    is_active: props.is_active || null,
    attendance: props.attendance || null,
    attending_location: props.attending_location || props.location || null,
    exam_date: parseDateString(props.exam_date),
    dominant_hand: props.dominant_hand || null,
    token_used: props.token_used || null,
    token_refunded_at: parseTimestamp(props.token_refunded_at),
    token_refund_admin: props.token_refund_admin || null,
    mock_type: props.mock_type || null,
    start_time: props.start_time || null,
    end_time: props.end_time || null,
    ndecc_exam_date: parseDateString(props.ndecc_exam_date),
    idempotency_key: props.idempotency_key || null,
    created_at: parseDateString(props.hs_createdate),
    updated_at: parseDateString(props.hs_lastmodifieddate),
    synced_at: new Date().toISOString(),
    hubspot_last_sync_at: new Date().toISOString()
  };
}

/**
 * Sync bookings to Supabase in batches
 */
async function syncBookingsToSupabase(bookings) {
  if (!bookings || bookings.length === 0) {
    console.log('⚠️ No bookings to sync');
    return { synced: 0, errors: [] };
  }

  const BATCH_SIZE = 50; // Supabase batch upsert limit
  let synced = 0;
  const errors = [];

  console.log(`\n📤 Syncing ${bookings.length} bookings to Supabase...`);

  for (let i = 0; i < bookings.length; i += BATCH_SIZE) {
    const batch = bookings.slice(i, i + BATCH_SIZE);
    const records = batch.map(transformBookingForSupabase);

    try {
      const { error } = await supabaseAdmin
        .from('hubspot_bookings')
        .upsert(records, {
          onConflict: 'hubspot_id',
          ignoreDuplicates: false
        });

      if (error) {
        console.error(`  ❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} failed: ${error.message}`);
        errors.push({
          batch: Math.floor(i / BATCH_SIZE) + 1,
          error: error.message,
          bookingIds: batch.map(b => b.id)
        });
      } else {
        synced += batch.length;
      }

      // Progress logging
      const progress = Math.min(i + BATCH_SIZE, bookings.length);
      console.log(`  Progress: ${progress}/${bookings.length} bookings processed`);

    } catch (err) {
      console.error(`  ❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} exception: ${err.message}`);
      errors.push({
        batch: Math.floor(i / BATCH_SIZE) + 1,
        error: err.message,
        bookingIds: batch.map(b => b.id)
      });
    }

    // Small delay between batches
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  return { synced, errors };
}

/**
 * Verify sync by comparing counts
 */
async function verifySyncCounts() {
  console.log('\n🔍 Verifying sync...');

  // Get Supabase count
  const { count: supabaseCount, error } = await supabaseAdmin
    .from('hubspot_bookings')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error(`  ⚠️ Could not verify Supabase count: ${error.message}`);
    return null;
  }

  console.log(`  Supabase hubspot_bookings count: ${supabaseCount}`);
  return supabaseCount;
}

/**
 * Main sync function
 */
async function syncAllBookings() {
  console.log('🚀 Starting Bookings Sync: HubSpot → Supabase\n');
  console.log('='.repeat(60));

  const startTime = Date.now();

  // Validate environment
  if (!HUBSPOT_TOKEN) {
    console.error('❌ Missing HS_PRIVATE_APP_TOKEN environment variable');
    process.exit(1);
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
    process.exit(1);
  }

  console.log('✅ Environment variables validated\n');

  try {
    // Step 1: Fetch all bookings from HubSpot
    const bookings = await fetchAllBookings();

    if (bookings.length === 0) {
      console.log('\n⚠️ No bookings found in HubSpot');
      return;
    }

    // Step 2: Sync to Supabase
    const { synced, errors } = await syncBookingsToSupabase(bookings);

    // Step 3: Verify
    const supabaseCount = await verifySyncCounts();

    // Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n' + '='.repeat(60));
    console.log('🎉 Sync Complete!\n');
    console.log('📊 Summary:');
    console.log(`   - HubSpot Bookings Fetched: ${bookings.length}`);
    console.log(`   - Successfully Synced: ${synced}`);
    console.log(`   - Errors: ${errors.length}`);
    console.log(`   - Supabase Total Count: ${supabaseCount || 'Unknown'}`);
    console.log(`   - Duration: ${duration}s`);

    if (errors.length > 0) {
      console.log('\n⚠️ Errors encountered:');
      errors.forEach(err => {
        console.log(`   - Batch ${err.batch}: ${err.error}`);
        console.log(`     Affected booking IDs: ${err.bookingIds.slice(0, 5).join(', ')}${err.bookingIds.length > 5 ? '...' : ''}`);
      });
    }

    // Status check
    if (synced === bookings.length) {
      console.log('\n✅ All bookings synced successfully!');
    } else {
      console.log(`\n⚠️ ${bookings.length - synced} bookings failed to sync. Review errors above.`);
    }

  } catch (error) {
    console.error('\n❌ Sync failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run sync
syncAllBookings().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
