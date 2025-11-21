/**
 * Find bookings in HubSpot that weren't synced to Supabase
 *
 * Usage: node scripts/find-missing-bookings.js
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
    db: { schema: process.env.SUPABASE_SCHEMA_NAME }
  }
);

// HubSpot API configuration
const HUBSPOT_TOKEN = process.env.HS_PRIVATE_APP_TOKEN;
const HUBSPOT_BASE_URL = 'https://api.hubapi.com';
const BOOKINGS_OBJECT_ID = '2-50158943';

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

async function fetchAllHubSpotBookings() {
  const allBookings = [];
  let after = undefined;

  console.log('📋 Fetching all bookings from HubSpot...');

  do {
    const searchBody = {
      filterGroups: [],
      properties: ['booking_id', 'name', 'associated_mock_exam', 'is_active'],
      limit: 100
    };

    if (after) {
      searchBody.after = after;
    }

    const response = await hubspotApiCall(
      'POST',
      `/crm/v3/objects/${BOOKINGS_OBJECT_ID}/search`,
      searchBody
    );

    allBookings.push(...response.results);
    after = response.paging?.next?.after;

    console.log(`  Fetched ${allBookings.length} bookings so far...`);
    await new Promise(resolve => setTimeout(resolve, 100));

  } while (after);

  console.log(`✅ Total HubSpot bookings: ${allBookings.length}`);
  return allBookings;
}

async function fetchSupabaseBookingIds() {
  console.log('📋 Fetching booking IDs from Supabase...');

  const { data, error } = await supabaseAdmin
    .from('hubspot_bookings')
    .select('hubspot_id');

  if (error) {
    throw new Error(`Supabase error: ${error.message}`);
  }

  const ids = new Set(data.map(b => b.hubspot_id));
  console.log(`✅ Total Supabase bookings: ${ids.size}`);
  return ids;
}

async function findMissingBookings() {
  console.log('🔍 Finding missing bookings...\n');

  const hubspotBookings = await fetchAllHubSpotBookings();
  const supabaseIds = await fetchSupabaseBookingIds();

  const missing = hubspotBookings.filter(b => !supabaseIds.has(b.id));

  console.log(`\n📊 Results:`);
  console.log(`   HubSpot: ${hubspotBookings.length}`);
  console.log(`   Supabase: ${supabaseIds.size}`);
  console.log(`   Missing: ${missing.length}\n`);

  if (missing.length > 0) {
    console.log('Missing bookings:');
    missing.forEach(b => {
      const props = b.properties;
      console.log(`   - ID: ${b.id}, Name: ${props.name || 'N/A'}, Exam: ${props.associated_mock_exam || 'NONE'}, Status: ${props.is_active || 'N/A'}`);
    });

    // Count by reason
    const noExam = missing.filter(b => !b.properties.associated_mock_exam);
    console.log(`\n⚠️ Bookings without exam association: ${noExam.length}`);
  }
}

findMissingBookings().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
