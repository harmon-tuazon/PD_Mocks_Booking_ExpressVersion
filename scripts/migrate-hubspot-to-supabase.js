/**
 * One-time migration: HubSpot → Supabase
 * Run this script before switching to Supabase-first reads
 *
 * Usage: node scripts/migrate-hubspot-to-supabase.js
 *
 * Required environment variables:
 * - HS_PRIVATE_APP_TOKEN (HubSpot)
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  }
);

// HubSpot API configuration
const HUBSPOT_TOKEN = process.env.HS_PRIVATE_APP_TOKEN;
const HUBSPOT_BASE_URL = 'https://api.hubapi.com';

// Object type IDs
const HUBSPOT_OBJECTS = {
  mock_exams: '2-50158913',
  bookings: '2-50158943',
  contacts: '0-1'
};

/**
 * Make HubSpot API call
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
 * Fetch all mock exams from HubSpot with pagination
 */
async function fetchAllMockExams() {
  const allExams = [];
  let after = undefined;
  const properties = [
    'mock_exam_name', 'mock_type', 'exam_date', 'start_time', 'end_time',
    'location', 'capacity', 'total_bookings', 'is_active', 'createdate',
    'hs_lastmodifieddate'
  ];

  console.log('📋 Fetching all mock exams from HubSpot...');

  do {
    const searchBody = {
      filterGroups: [],
      properties,
      limit: 100
    };

    if (after) {
      searchBody.after = after;
    }

    const response = await hubspotApiCall(
      'POST',
      `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/search`,
      searchBody
    );

    allExams.push(...response.results);
    after = response.paging?.next?.after;

    console.log(`  Fetched ${allExams.length} exams so far...`);

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));

  } while (after);

  console.log(`✅ Fetched ${allExams.length} total mock exams`);
  return allExams;
}

/**
 * Fetch bookings for a specific exam
 */
async function fetchBookingsForExam(examId) {
  // Get associations first
  const associationsResponse = await hubspotApiCall(
    'GET',
    `/crm/v4/objects/${HUBSPOT_OBJECTS.mock_exams}/${examId}/associations/${HUBSPOT_OBJECTS.bookings}`
  );

  const bookingIds = associationsResponse.results?.map(r => r.toObjectId) || [];

  if (bookingIds.length === 0) {
    return [];
  }

  // Fetch booking details in batch
  const properties = [
    'booking_id', 'mock_exam_id', 'contact_id', 'student_id', 'student_name',
    'student_email', 'booking_status', 'is_active', 'attendance', 'attending_location',
    'exam_date', 'dominant_hand', 'createdate', 'hs_lastmodifieddate'
  ];

  const batchResponse = await hubspotApiCall(
    'POST',
    `/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}/batch/read`,
    {
      propertiesWithHistory: [],
      inputs: bookingIds.map(id => ({ id })),
      properties
    }
  );

  return batchResponse.results || [];
}

/**
 * Sync exam to Supabase
 */
async function syncExamToSupabase(exam) {
  const props = exam.properties;

  const record = {
    hubspot_id: exam.id,
    mock_exam_name: props.mock_exam_name,
    mock_type: props.mock_type,
    exam_date: props.exam_date,
    start_time: props.start_time,
    end_time: props.end_time,
    location: props.location,
    capacity: parseInt(props.capacity) || 0,
    total_bookings: parseInt(props.total_bookings) || 0,
    is_active: props.is_active,
    created_at: props.createdate,
    updated_at: props.hs_lastmodifieddate,
    synced_at: new Date().toISOString()
  };

  const { error } = await supabaseAdmin
    .from('hubspot_mock_exams')
    .upsert(record, { onConflict: 'hubspot_id' });

  if (error) {
    throw new Error(`Supabase exam sync error: ${error.message}`);
  }
}

/**
 * Sync bookings to Supabase in bulk
 */
async function syncBookingsToSupabase(bookings, examId) {
  if (!bookings || bookings.length === 0) return;

  const records = bookings.map(booking => {
    const props = booking.properties;
    return {
      hubspot_id: booking.id,
      booking_id: props.booking_id,
      mock_exam_id: examId || props.mock_exam_id,
      contact_id: props.contact_id,
      student_id: props.student_id,
      student_name: props.student_name,
      student_email: props.student_email,
      booking_status: props.booking_status,
      is_active: props.is_active,
      attendance: props.attendance,
      attending_location: props.attending_location,
      exam_date: props.exam_date,
      dominant_hand: props.dominant_hand,
      created_at: props.createdate,
      updated_at: props.hs_lastmodifieddate,
      synced_at: new Date().toISOString()
    };
  });

  const { error } = await supabaseAdmin
    .from('hubspot_bookings')
    .upsert(records, { onConflict: 'hubspot_id' });

  if (error) {
    throw new Error(`Supabase bookings sync error: ${error.message}`);
  }
}

/**
 * Main migration function
 */
async function migrateAllData() {
  console.log('🚀 Starting HubSpot → Supabase migration...\n');
  console.log('=' .repeat(60));

  const startTime = Date.now();
  let totalExams = 0;
  let totalBookings = 0;
  let errors = [];

  try {
    // Step 1: Fetch all mock exams
    const exams = await fetchAllMockExams();
    totalExams = exams.length;

    // Step 2: Sync exams to Supabase
    console.log('\n📤 Syncing mock exams to Supabase...');
    for (let i = 0; i < exams.length; i++) {
      const exam = exams[i];
      try {
        await syncExamToSupabase(exam);
        if ((i + 1) % 10 === 0) {
          console.log(`  Progress: ${i + 1}/${exams.length} exams synced`);
        }
      } catch (error) {
        console.error(`  ❌ Failed to sync exam ${exam.id}: ${error.message}`);
        errors.push({ type: 'exam', id: exam.id, error: error.message });
      }
    }
    console.log(`✅ Synced ${exams.length} mock exams\n`);

    // Step 3: Fetch and sync bookings for each exam
    console.log('📤 Syncing bookings for each exam...');
    for (let i = 0; i < exams.length; i++) {
      const exam = exams[i];
      try {
        const bookings = await fetchBookingsForExam(exam.id);
        if (bookings.length > 0) {
          await syncBookingsToSupabase(bookings, exam.id);
          totalBookings += bookings.length;
        }

        if ((i + 1) % 10 === 0) {
          console.log(`  Progress: ${i + 1}/${exams.length} exams processed, ${totalBookings} total bookings synced`);
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`  ❌ Failed to sync bookings for exam ${exam.id}: ${error.message}`);
        errors.push({ type: 'bookings', examId: exam.id, error: error.message });
      }
    }
    console.log(`✅ Synced ${totalBookings} bookings\n`);

    // Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('=' .repeat(60));
    console.log('🎉 Migration Complete!\n');
    console.log(`📊 Summary:`);
    console.log(`   - Mock Exams: ${totalExams}`);
    console.log(`   - Bookings: ${totalBookings}`);
    console.log(`   - Errors: ${errors.length}`);
    console.log(`   - Duration: ${duration}s`);

    if (errors.length > 0) {
      console.log('\n⚠️ Errors encountered:');
      errors.forEach(err => {
        console.log(`   - ${err.type} ${err.id || err.examId}: ${err.error}`);
      });
    }

    console.log('\n✅ You can now switch to Supabase-first reads!');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Run migration
migrateAllData().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
