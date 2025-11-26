/**
 * Supabase Sync Utility
 * Syncs mock exams and bookings from HubSpot to Supabase
 * Used by cron jobs and manual sync endpoints
 */

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    db: { schema: process.env.SUPABASE_SCHEMA_NAME || 'public' }
  }
);

// HubSpot API configuration
const HUBSPOT_TOKEN = process.env.HS_PRIVATE_APP_TOKEN || '';
const HUBSPOT_BASE_URL = 'https://api.hubapi.com';

// Object type IDs
const HUBSPOT_OBJECTS = {
  mock_exams: '2-50158913',
  bookings: '2-50158943',
  contacts: '0-1'
};

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
 * Fetch all mock exams from HubSpot with pagination
 */
async function fetchAllMockExams() {
  const allExams = [];
  let after = undefined;
  const properties = [
    'mock_exam_name', 'mock_type', 'exam_date', 'start_time', 'end_time',
    'location', 'capacity', 'total_bookings', 'is_active', 'scheduled_activation_datetime',
    'createdate', 'hs_lastmodifieddate'
  ];

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

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));

  } while (after);

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
    'booking_id', 'associated_mock_exam', 'associated_contact_id', 'student_id', 'name',
    'student_email', 'is_active', 'attendance', 'attending_location',
    'exam_date', 'dominant_hand', 'token_used', 'token_refunded_at', 'token_refund_admin',
    'mock_type', 'start_time', 'end_time', 'ndecc_exam_date', 'idempotency_key',
    'createdate', 'hs_lastmodifieddate'
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
    scheduled_activation_datetime: props.scheduled_activation_datetime,
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
      associated_mock_exam: examId || props.associated_mock_exam,
      associated_contact_id: props.associated_contact_id,
      student_id: props.student_id,
      name: props.name,
      student_email: props.student_email,
      is_active: props.is_active,
      attendance: props.attendance,
      attending_location: props.attending_location,
      exam_date: props.exam_date,
      dominant_hand: props.dominant_hand,
      token_used: props.token_used,
      token_refunded_at: props.token_refunded_at ? new Date(parseInt(props.token_refunded_at)).toISOString() : null,
      token_refund_admin: props.token_refund_admin,
      mock_type: props.mock_type,
      start_time: props.start_time,
      end_time: props.end_time,
      ndecc_exam_date: props.ndecc_exam_date,
      idempotency_key: props.idempotency_key,
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
 * Fetch all contacts with credits from HubSpot
 * Only fetches contacts that have student_id and at least one credit > 0
 */
async function fetchAllContactsWithCredits() {
  const allContacts = [];
  let after = undefined;
  const properties = [
    'student_id', 'email', 'firstname', 'lastname',
    'sj_credits', 'cs_credits', 'sjmini_credits',
    'mock_discussion_token', 'shared_mock_credits',
    'ndecc_exam_date', 'createdate', 'hs_lastmodifieddate'
  ];

  do {
    // CORRECT PATTERN: Multiple filterGroups with student_id AND one credit type in each
    // Creates OR logic: (student_id AND sj > 0) OR (student_id AND cs > 0) OR ...
    // This matches the migration script pattern
    const searchBody = {
      filterGroups: [
        // Filter Group 1: Has student_id AND has SJ credits > 0
        {
          filters: [
            { propertyName: 'student_id', operator: 'HAS_PROPERTY' },
            { propertyName: 'sj_credits', operator: 'GT', value: '0' }
          ]
        },
        // Filter Group 2: Has student_id AND has CS credits > 0
        {
          filters: [
            { propertyName: 'student_id', operator: 'HAS_PROPERTY' },
            { propertyName: 'cs_credits', operator: 'GT', value: '0' }
          ]
        },
        // Filter Group 3: Has student_id AND has Mini-mock credits > 0
        {
          filters: [
            { propertyName: 'student_id', operator: 'HAS_PROPERTY' },
            { propertyName: 'sjmini_credits', operator: 'GT', value: '0' }
          ]
        },
        // Filter Group 4: Has student_id AND has Discussion token > 0
        {
          filters: [
            { propertyName: 'student_id', operator: 'HAS_PROPERTY' },
            { propertyName: 'mock_discussion_token', operator: 'GT', value: '0' }
          ]
        },
        // Filter Group 5: Has student_id AND has Shared credits > 0
        {
          filters: [
            { propertyName: 'student_id', operator: 'HAS_PROPERTY' },
            { propertyName: 'shared_mock_credits', operator: 'GT', value: '0' }
          ]
        }
      ],
      properties,
      limit: 100
    };

    if (after) {
      searchBody.after = after;
    }

    const response = await hubspotApiCall(
      'POST',
      `/crm/v3/objects/${HUBSPOT_OBJECTS.contacts}/search`,
      searchBody
    );

    allContacts.push(...response.results);
    after = response.paging?.next?.after;

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));

  } while (after);

  // No need for client-side filtering - HubSpot already filtered with the correct query
  return allContacts;
}

/**
 * Sync contact credits to Supabase
 */
async function syncContactCreditsToSupabase(contact) {
  if (!contact || !contact.properties) {
    console.error('[SYNC] Cannot sync contact - missing properties');
    return;
  }

  const props = contact.properties;

  const record = {
    hubspot_id: contact.id,
    student_id: props.student_id,
    email: props.email?.toLowerCase(),
    firstname: props.firstname,
    lastname: props.lastname,
    sj_credits: parseInt(props.sj_credits) || 0,
    cs_credits: parseInt(props.cs_credits) || 0,
    sjmini_credits: parseInt(props.sjmini_credits) || 0,
    mock_discussion_token: parseInt(props.mock_discussion_token) || 0,
    shared_mock_credits: parseInt(props.shared_mock_credits) || 0,
    ndecc_exam_date: props.ndecc_exam_date,
    created_at: props.createdate,
    updated_at: props.hs_lastmodifieddate,
    synced_at: new Date().toISOString()
  };

  const { error } = await supabaseAdmin
    .from('hubspot_contact_credits')
    .upsert(record, { onConflict: 'hubspot_id' });

  if (error) {
    throw new Error(`Supabase contact credits sync error: ${error.message}`);
  }
}

/**
 * Main sync function - Syncs all mock exams, bookings, and contact credits
 * Returns summary of sync operation
 */
async function syncAllData() {
  const startTime = Date.now();
  let totalExams = 0;
  let totalBookings = 0;
  let totalContactCredits = 0;
  let errors = [];

  try {
    // Step 1: Fetch all mock exams
    const exams = await fetchAllMockExams();
    totalExams = exams.length;

    // Step 2: Sync exams to Supabase in parallel batches (OPTIMIZED)
    const examBatchSize = 10;
    for (let i = 0; i < exams.length; i += examBatchSize) {
      const batch = exams.slice(i, i + examBatchSize);
      await Promise.allSettled(
        batch.map(async (exam) => {
          try {
            await syncExamToSupabase(exam);
          } catch (error) {
            console.error(`Failed to sync exam ${exam.id}: ${error.message}`);
            errors.push({ type: 'exam', id: exam.id, error: error.message });
          }
        })
      );
    }

    // Step 3: Fetch and sync bookings in parallel (OPTIMIZED)
    // Process bookings for multiple exams concurrently to reduce total time
    const bookingBatchSize = 10;
    for (let i = 0; i < exams.length; i += bookingBatchSize) {
      const examBatch = exams.slice(i, i + bookingBatchSize);
      
      const bookingResults = await Promise.allSettled(
        examBatch.map(async (exam) => {
          try {
            const bookings = await fetchBookingsForExam(exam.id);
            if (bookings.length > 0) {
              await syncBookingsToSupabase(bookings, exam.id);
              return bookings.length;
            }
            return 0;
          } catch (error) {
            console.error(`Failed to sync bookings for exam ${exam.id}: ${error.message}`);
            errors.push({ type: 'bookings', examId: exam.id, error: error.message });
            return 0;
          }
        })
      );

      // Sum up bookings count from this batch
      bookingResults.forEach(result => {
        if (result.status === 'fulfilled') {
          totalBookings += result.value;
        }
      });

      // Small delay between batches to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Step 4: Fetch and sync contact credits in parallel batches (OPTIMIZED)
    console.log('🔄 Starting contact credits sync...');
    try {
      const contacts = await fetchAllContactsWithCredits();
      totalContactCredits = contacts.length;
      console.log(`📊 Found ${totalContactCredits} contacts with credits to sync`);

      // Process contacts in parallel batches
      const contactBatchSize = 20;
      for (let i = 0; i < contacts.length; i += contactBatchSize) {
        const batch = contacts.slice(i, i + contactBatchSize);
        
        await Promise.allSettled(
          batch.map(async (contact) => {
            try {
              await syncContactCreditsToSupabase(contact);
            } catch (error) {
              console.error(`Failed to sync contact ${contact.id}: ${error.message}`);
              errors.push({ type: 'contact_credits', id: contact.id, error: error.message });
            }
          })
        );

        // Log progress every 100 contacts
        if ((i + contactBatchSize) % 100 === 0 || (i + contactBatchSize) >= contacts.length) {
          const progress = Math.min(i + contactBatchSize, contacts.length);
          console.log(`   Progress: ${progress}/${totalContactCredits} contacts synced`);
        }

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log(`✅ Contact credits sync completed: ${totalContactCredits} contacts synced`);
    } catch (error) {
      console.error(`❌ Failed to sync contact credits: ${error.message}`);
      errors.push({ type: 'contact_credits_fetch', error: error.message });
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    return {
      success: true,
      summary: {
        exams_synced: totalExams,
        bookings_synced: totalBookings,
        contact_credits_synced: totalContactCredits,
        errors_count: errors.length,
        duration_seconds: duration,
        completed_at: new Date().toISOString()
      },
      errors: errors.length > 0 ? errors : undefined
    };

  } catch (error) {
    console.error('Sync failed:', error.message);
    throw error;
  }
}

module.exports = {
  syncAllData,
  fetchAllMockExams,
  fetchBookingsForExam,
  syncExamToSupabase,
  syncBookingsToSupabase,
  fetchAllContactsWithCredits,
  syncContactCreditsToSupabase
};
