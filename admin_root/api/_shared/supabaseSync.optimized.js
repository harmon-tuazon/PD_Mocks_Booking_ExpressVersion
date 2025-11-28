/**
 * OPTIMIZED Supabase Sync Utility
 * Implements incremental sync using hs_lastmodifieddate timestamps
 * Only syncs records that have changed since last sync
 *
 * Performance Improvements:
 * 1. Incremental sync - only fetch modified records
 * 2. Change detection via hs_lastmodifieddate
 * 3. Persistent last_sync tracking in Supabase
 * 4. Skip past exams that won't change
 * 5. Batch contact credit updates efficiently
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
 * Get or create sync metadata table
 * Tracks last successful sync timestamp for incremental syncs
 *
 * GRACEFUL DEGRADATION: If sync_metadata table doesn't exist or has permission issues,
 * returns null to trigger full sync instead of failing
 */
async function getLastSyncTimestamp(syncType) {
  try {
    const { data, error } = await supabaseAdmin
      .from('sync_metadata')
      .select('last_sync_timestamp')
      .eq('sync_type', syncType)
      .single();

    // Handle common error codes:
    // PGRST116 = No rows found (acceptable, first sync)
    // 42P01 = Table doesn't exist
    // 42501 = Permission denied
    if (error) {
      if (error.code === 'PGRST116') {
        // No previous sync found, start fresh
        console.log(`ℹ️ No previous ${syncType} sync found - performing full sync`);
        return null;
      }

      if (error.code === '42P01') {
        console.warn(`⚠️ sync_metadata table doesn't exist - performing full sync`);
        console.warn(`   Run: admin_root/api/_shared/supabaseSync.optimized.js sync-metadata-table.sql to create it`);
        return null;
      }

      if (error.code === '42501') {
        console.warn(`⚠️ Permission denied for sync_metadata table - performing full sync`);
        console.warn(`   Check RLS policies and service role permissions`);
        return null;
      }

      // Unknown error, log but continue with full sync
      console.warn(`⚠️ Could not fetch last sync timestamp for ${syncType}: ${error.message} (code: ${error.code})`);
      return null;
    }

    return data?.last_sync_timestamp || null;
  } catch (error) {
    console.warn(`⚠️ Unexpected error fetching sync timestamp for ${syncType}: ${error.message}`);
    return null;
  }
}

/**
 * Update last sync timestamp
 *
 * GRACEFUL DEGRADATION: If sync_metadata table doesn't exist or has permission issues,
 * logs warning but doesn't fail - next sync will be a full sync
 */
async function updateLastSyncTimestamp(syncType, timestamp) {
  try {
    const { error } = await supabaseAdmin
      .from('sync_metadata')
      .upsert({
        sync_type: syncType,
        last_sync_timestamp: timestamp,
        updated_at: new Date().toISOString()
      }, { onConflict: 'sync_type' });

    if (error) {
      // Log warning but don't fail - graceful degradation
      if (error.code === '42P01') {
        console.warn(`⚠️ Cannot update sync timestamp - sync_metadata table doesn't exist`);
      } else if (error.code === '42501') {
        console.warn(`⚠️ Cannot update sync timestamp - permission denied`);
      } else {
        console.warn(`⚠️ Failed to update sync timestamp for ${syncType}: ${error.message}`);
      }
    } else {
      console.log(`✅ Updated ${syncType} sync timestamp to ${new Date(timestamp).toISOString()}`);
    }
  } catch (error) {
    console.warn(`⚠️ Unexpected error updating sync timestamp for ${syncType}: ${error.message}`);
  }
}

/**
 * OPTIMIZED: Fetch only modified mock exams since last sync
 * Uses hs_lastmodifieddate filter for incremental sync
 *
 * IMPORTANT: exam_date is a STRING property in HubSpot, not a date property
 * Therefore we CANNOT use comparison operators like GTE/LTE on it
 * Instead we:
 * 1. Use hs_lastmodifieddate for incremental sync (timestamp property)
 * 2. Use hs_createdate for filtering recent exams (timestamp property)
 * 3. Filter by actual exam_date in application code after fetching if needed
 */
async function fetchModifiedMockExams(sinceTimestamp) {
  const allExams = [];
  let after = undefined;
  const properties = [
    'mock_exam_name', 'mock_type', 'exam_date', 'start_time', 'end_time',
    'location', 'capacity', 'total_bookings', 'is_active', 'scheduled_activation_datetime',
    'hs_createdate', 'hs_lastmodifieddate'
  ];

  // Calculate cutoff timestamp (30 days ago) for hs_createdate filter
  // This helps reduce the dataset by excluding very old exams
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoffTimestamp = thirtyDaysAgo.getTime(); // Unix timestamp in milliseconds

  do {
    const filters = [];

    // Filter 1: Modified since last sync (incremental sync)
    if (sinceTimestamp) {
      filters.push({
        propertyName: 'hs_lastmodifieddate',
        operator: 'GTE',
        value: sinceTimestamp.toString()
      });
    }

    // Filter 2: Only fetch exams created in last 30 days OR modified recently
    // This prevents syncing ancient exams that will never change
    // Use hs_createdate (datetime property) instead of exam_date (string property)
    if (!sinceTimestamp) {
      // On full sync, only get exams created in last 30 days
      filters.push({
        propertyName: 'hs_createdate',
        operator: 'GTE',
        value: cutoffTimestamp.toString()
      });
    }
    // Note: If doing incremental sync, we already filtered by hs_lastmodifieddate
    // so we don't need the createdate filter (modified exams might be old but recently updated)

    const searchBody = {
      properties,
      limit: 100,
      sorts: [{ propertyName: 'hs_lastmodifieddate', direction: 'DESCENDING' }]
    };

    // Add filters only if we have any
    if (filters.length > 0) {
      searchBody.filterGroups = [{ filters }];
    }

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

  console.log(`📊 Incremental sync: Found ${allExams.length} modified exams ${sinceTimestamp ? 'since ' + new Date(parseInt(sinceTimestamp)).toISOString() : '(initial sync - last 30 days)'}`);

  return allExams;
}

/**
 * Fetch bookings for a specific exam (unchanged - already efficient with batch read)
 */
async function fetchBookingsForExam(examId) {
  const associationsResponse = await hubspotApiCall(
    'GET',
    `/crm/v4/objects/${HUBSPOT_OBJECTS.mock_exams}/${examId}/associations/${HUBSPOT_OBJECTS.bookings}`
  );

  const bookingIds = associationsResponse.results?.map(r => r.toObjectId) || [];

  if (bookingIds.length === 0) {
    return [];
  }

  const properties = [
    'booking_id', 'associated_mock_exam', 'associated_contact_id', 'student_id', 'name',
    'email', 'is_active', 'attendance', 'attending_location',
    'exam_date', 'dominant_hand', 'token_used', 'token_refunded_at', 'token_refund_admin',
    'mock_type', 'start_time', 'end_time', 'ndecc_exam_date', 'idempotency_key',
    'hs_createdate', 'hs_lastmodifieddate'
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
 * Sync exam to Supabase (unchanged)
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
    scheduled_activation_datetime: props.scheduled_activation_datetime || null,
    created_at: props.hs_createdate,
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
 * Sync bookings to Supabase in bulk (unchanged)
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
      student_email: props.email,
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
      created_at: props.hs_createdate,
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
 * OPTIMIZED: Fetch only modified contacts since last sync
 * Uses hs_lastmodifieddate for incremental sync
 */
async function fetchModifiedContactsWithCredits(sinceTimestamp) {
  const allContacts = [];
  let after = undefined;
  const properties = [
    'student_id', 'email', 'firstname', 'lastname',
    'sj_credits', 'cs_credits', 'sjmini_credits',
    'mock_discussion_token', 'shared_mock_credits',
    'ndecc_exam_date', 'hs_createdate', 'hs_lastmodifieddate'
  ];

  do {
    const filterGroups = [];

    if (sinceTimestamp) {
      // Incremental sync: Get contacts modified since last sync AND have credits
      // Using OR logic: (modified since X AND has any credit type > 0)
      filterGroups.push(
        {
          filters: [
            { propertyName: 'hs_lastmodifieddate', operator: 'GTE', value: sinceTimestamp.toString() },
            { propertyName: 'student_id', operator: 'HAS_PROPERTY' },
            { propertyName: 'sj_credits', operator: 'GT', value: '0' }
          ]
        },
        {
          filters: [
            { propertyName: 'hs_lastmodifieddate', operator: 'GTE', value: sinceTimestamp.toString() },
            { propertyName: 'student_id', operator: 'HAS_PROPERTY' },
            { propertyName: 'cs_credits', operator: 'GT', value: '0' }
          ]
        },
        {
          filters: [
            { propertyName: 'hs_lastmodifieddate', operator: 'GTE', value: sinceTimestamp.toString() },
            { propertyName: 'student_id', operator: 'HAS_PROPERTY' },
            { propertyName: 'sjmini_credits', operator: 'GT', value: '0' }
          ]
        },
        {
          filters: [
            { propertyName: 'hs_lastmodifieddate', operator: 'GTE', value: sinceTimestamp.toString() },
            { propertyName: 'student_id', operator: 'HAS_PROPERTY' },
            { propertyName: 'mock_discussion_token', operator: 'GT', value: '0' }
          ]
        },
        {
          filters: [
            { propertyName: 'hs_lastmodifieddate', operator: 'GTE', value: sinceTimestamp.toString() },
            { propertyName: 'student_id', operator: 'HAS_PROPERTY' },
            { propertyName: 'shared_mock_credits', operator: 'GT', value: '0' }
          ]
        }
      );
    } else {
      // Initial sync: Get all contacts with credits (same as before)
      filterGroups.push(
        {
          filters: [
            { propertyName: 'student_id', operator: 'HAS_PROPERTY' },
            { propertyName: 'sj_credits', operator: 'GT', value: '0' }
          ]
        },
        {
          filters: [
            { propertyName: 'student_id', operator: 'HAS_PROPERTY' },
            { propertyName: 'cs_credits', operator: 'GT', value: '0' }
          ]
        },
        {
          filters: [
            { propertyName: 'student_id', operator: 'HAS_PROPERTY' },
            { propertyName: 'sjmini_credits', operator: 'GT', value: '0' }
          ]
        },
        {
          filters: [
            { propertyName: 'student_id', operator: 'HAS_PROPERTY' },
            { propertyName: 'mock_discussion_token', operator: 'GT', value: '0' }
          ]
        },
        {
          filters: [
            { propertyName: 'student_id', operator: 'HAS_PROPERTY' },
            { propertyName: 'shared_mock_credits', operator: 'GT', value: '0' }
          ]
        }
      );
    }

    const searchBody = {
      filterGroups,
      properties,
      limit: 100,
      sorts: [{ propertyName: 'hs_lastmodifieddate', direction: 'DESCENDING' }]
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

  console.log(`📊 Incremental sync: Found ${allContacts.length} modified contacts ${sinceTimestamp ? 'since ' + new Date(parseInt(sinceTimestamp)).toISOString() : '(initial sync)'}`);

  return allContacts;
}

/**
 * Sync contact credits to Supabase (unchanged)
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
    created_at: props.hs_createdate,
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
 * OPTIMIZED: Main sync function with incremental sync support
 * Only syncs records that changed since last successful sync
 *
 * Performance improvements:
 * - Uses hs_lastmodifieddate filters to fetch only changed records
 * - Tracks last sync timestamp in Supabase
 * - Skips old exams (>30 days ago) that won't change
 * - Significantly reduces API calls and sync time
 */
async function syncAllData() {
  const startTime = Date.now();
  const syncTimestamp = Date.now(); // Current timestamp for this sync
  let totalExams = 0;
  let totalBookings = 0;
  let totalContactCredits = 0;
  let errors = [];

  try {
    // OPTIMIZATION: Get last sync timestamps for incremental sync
    const lastExamSync = await getLastSyncTimestamp('mock_exams');
    const lastContactSync = await getLastSyncTimestamp('contact_credits');

    const syncMode = (lastExamSync && lastContactSync) ? 'incremental' : 'full';
    console.log(`🔄 Starting ${syncMode} sync...`);
    console.log(`   Last exam sync: ${lastExamSync ? new Date(parseInt(lastExamSync)).toISOString() : 'Never (full sync - last 30 days)'}`);
    console.log(`   Last contact sync: ${lastContactSync ? new Date(parseInt(lastContactSync)).toISOString() : 'Never (full sync)'}`);

    if (!lastExamSync || !lastContactSync) {
      console.log(`ℹ️ Note: sync_metadata table may not exist. To enable incremental syncing:`);
      console.log(`   Run: PRDs/supabase/sync-metadata-table.sql in Supabase SQL Editor`);
    }

    // Step 1: Fetch only MODIFIED exams since last sync
    const exams = await fetchModifiedMockExams(lastExamSync);
    totalExams = exams.length;

    if (exams.length === 0) {
      console.log('✨ No modified exams found - skipping exam sync');
    } else {
      // Step 2: Sync modified exams to Supabase in parallel batches
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

      // Step 3: Fetch and sync bookings ONLY for modified exams
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

        bookingResults.forEach(result => {
          if (result.status === 'fulfilled') {
            totalBookings += result.value;
          }
        });

        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // Step 4: Fetch and sync MODIFIED contact credits since last sync
    console.log('🔄 Starting incremental contact credits sync...');
    try {
      const contacts = await fetchModifiedContactsWithCredits(lastContactSync);
      totalContactCredits = contacts.length;

      if (contacts.length === 0) {
        console.log('✨ No modified contacts found - skipping contact credits sync');
      } else {
        console.log(`📊 Found ${totalContactCredits} modified contacts to sync`);

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

          // Log progress
          if ((i + contactBatchSize) % 100 === 0 || (i + contactBatchSize) >= contacts.length) {
            const progress = Math.min(i + contactBatchSize, contacts.length);
            console.log(`   Progress: ${progress}/${totalContactCredits} contacts synced`);
          }

          await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log(`✅ Contact credits sync completed: ${totalContactCredits} contacts synced`);
      }
    } catch (error) {
      console.error(`❌ Failed to sync contact credits: ${error.message}`);
      errors.push({ type: 'contact_credits_fetch', error: error.message });
    }

    // Step 5: Update last sync timestamps (only if no critical errors)
    if (errors.filter(e => e.type === 'exam' || e.type === 'contact_credits_fetch').length === 0) {
      await updateLastSyncTimestamp('mock_exams', syncTimestamp);
      await updateLastSyncTimestamp('contact_credits', syncTimestamp);
      console.log(`✅ Updated sync timestamps to ${new Date(syncTimestamp).toISOString()}`);
    } else {
      console.warn(`⚠️ Skipping timestamp update due to ${errors.length} errors`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    return {
      success: true,
      summary: {
        sync_mode: lastExamSync ? 'incremental' : 'full',
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
  fetchModifiedMockExams,
  fetchBookingsForExam,
  syncExamToSupabase,
  syncBookingsToSupabase,
  fetchModifiedContactsWithCredits,
  syncContactCreditsToSupabase,
  getLastSyncTimestamp,
  updateLastSyncTimestamp
};
