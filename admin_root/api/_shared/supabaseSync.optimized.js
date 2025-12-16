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
    db: { schema: process.env.SUPABASE_SCHEMA_NAME || 'hubspot_sync' }
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
    'location', 'capacity', 'is_active', 'scheduled_activation_datetime',
    'hs_createdate', 'hs_lastmodifieddate'
    // NOTE: total_bookings removed - we calculate it from actual bookings count
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
 * Sync exam to Supabase
 * NOTE: total_bookings is NOT synced - it's managed by atomic increment/decrement operations
 * The cron job does NOT update total_bookings to avoid overwriting real-time counts
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
    // Do NOT sync total_bookings - it's managed by atomic operations in booking endpoints
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
 * Parse timestamp value from HubSpot (handles empty strings, null, undefined)
 */
function parseTimestamp(value) {
  if (!value || value === '' || value === 'null' || value === 'undefined') {
    return null;
  }
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
 * Parse date/string value (handles empty strings)
 */
function parseDateString(value) {
  if (!value || value === '' || value === 'null' || value === 'undefined') {
    return null;
  }
  return value;
}

/**
 * Sync bookings to Supabase in bulk
 * Property mappings aligned with scripts/sync-bookings-hubspot-to-supabase.js
 */
async function syncBookingsToSupabase(bookings, examId) {
  if (!bookings || bookings.length === 0) return;

  const records = bookings.map(booking => {
    const props = booking.properties;
    return {
      hubspot_id: booking.id,
      booking_id: props.booking_id || null,
      associated_mock_exam: examId || props.associated_mock_exam || null,
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
 * Backfill hubspot_id for bookings created in Supabase that now exist in HubSpot
 *
 * IMPORTANT: This function ONLY updates hubspot_id and synced_at.
 * It does NOT overwrite any other Supabase data (Supabase is source of truth for bookings).
 *
 * Matches by idempotency_key (unique identifier for booking operations):
 * - Generated at booking creation time with contact_id, exam_id, date, type, timestamp
 * - Same value exists in both Supabase and HubSpot
 * - More reliable than booking_id for matching
 *
 * Use Case:
 * 1. User creates booking at 10:00 AM → Supabase record (hubspot_id = NULL)
 * 2. Cron sync-bookings-from-supabase runs at 12:00 PM → Creates in HubSpot
 * 3. BUT if update fails, Supabase still has hubspot_id = NULL
 * 4. This function runs during sync-supabase cron → Backfills missing hubspot_id
 *
 * @param {Array} bookings - HubSpot bookings with id and properties.idempotency_key
 * @returns {number} - Count of backfilled records
 */
async function backfillBookingHubSpotIds(bookings) {
  if (!bookings || bookings.length === 0) return 0;

  let backfilledCount = 0;

  for (const booking of bookings) {
    const props = booking.properties;
    const idempotencyKey = props.idempotency_key;
    const hubspotId = booking.id;

    // Skip if missing required fields
    if (!idempotencyKey || !hubspotId) {
      continue;
    }

    try {
      // Find Supabase record by idempotency_key WITHOUT hubspot_id
      const { data: existing, error: findError } = await supabaseAdmin
        .from('hubspot_bookings')
        .select('id, hubspot_id, booking_id')
        .eq('idempotency_key', idempotencyKey)
        .is('hubspot_id', null)  // Only records missing hubspot_id
        .single();

      // Handle errors
      if (findError) {
        if (findError.code === 'PGRST116') {
          // No rows found - either:
          // 1. Record doesn't exist in Supabase (created in HubSpot first - rare)
          // 2. Record already has hubspot_id (already synced)
          // Both cases are fine, skip silently
          continue;
        }

        console.warn(`⚠️ [BACKFILL] Error checking for existing booking with key ${idempotencyKey}: ${findError.message}`);
        continue;
      }

      // Match found! Backfill hubspot_id ONLY (preserve all other Supabase data)
      if (existing) {
        const { error: updateError } = await supabaseAdmin
          .from('hubspot_bookings')
          .update({
            hubspot_id: hubspotId,  // Only update hubspot_id
            synced_at: new Date().toISOString()  // Update sync timestamp
            // ⚠️ DO NOT update any other fields - Supabase is source of truth!
          })
          .eq('id', existing.id);

        if (updateError) {
          console.error(`❌ [BACKFILL] Failed to backfill hubspot_id for idempotency_key ${idempotencyKey}: ${updateError.message}`);
        } else {
          console.log(`✅ [BACKFILL] Backfilled hubspot_id=${hubspotId} for booking_id=${existing.booking_id} (idempotency_key=${idempotencyKey.substring(0, 20)}...)`);
          backfilledCount++;
        }
      }
    } catch (error) {
      console.error(`❌ [BACKFILL] Error backfilling booking with key ${idempotencyKey}:`, error.message);
    }
  }

  if (backfilledCount > 0) {
    console.log(`✅ [BACKFILL] Successfully backfilled ${backfilledCount} booking hubspot_ids`);
  }

  return backfilledCount;
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
  let totalBackfilled = 0;  // Track backfilled hubspot_ids
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
      // Step 2: Sync exams to Supabase (WITHOUT total_bookings - managed by atomic operations)
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

      // Step 3.5: Backfill hubspot_ids for Supabase-first bookings
      // This step ONLY updates hubspot_id field, does NOT overwrite Supabase data
      console.log('🔄 Backfilling HubSpot IDs for Supabase-first bookings...');

      const bookingBatchSize = 10;
      for (let i = 0; i < exams.length; i += bookingBatchSize) {
        const examBatch = exams.slice(i, i + bookingBatchSize);

        const backfillResults = await Promise.allSettled(
          examBatch.map(async (exam) => {
            try {
              const bookings = await fetchBookingsForExam(exam.id);
              if (bookings.length > 0) {
                return await backfillBookingHubSpotIds(bookings);
              }
              return 0;
            } catch (error) {
              console.error(`[BACKFILL] Failed to backfill for exam ${exam.id}: ${error.message}`);
              errors.push({ type: 'backfill', examId: exam.id, error: error.message });
              return 0;
            }
          })
        );

        backfillResults.forEach(result => {
          if (result.status === 'fulfilled') {
            totalBackfilled += result.value;
          }
        });

        await new Promise(resolve => setTimeout(resolve, 200));
      }

      if (totalBackfilled > 0) {
        console.log(`✅ [BACKFILL] Backfilled ${totalBackfilled} booking hubspot_ids`);
      } else {
        console.log(`ℹ️ [BACKFILL] No hubspot_ids needed backfilling`);
      }
    }

    // Step 5: Update last sync timestamps (only if no critical errors)
    if (errors.filter(e => e.type === 'exam').length === 0) {
      await updateLastSyncTimestamp('mock_exams', syncTimestamp);
      // Note: contact_credits timestamp update removed (credits not synced via cron)
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
        hubspot_ids_backfilled: totalBackfilled,  // Only backfill tracking remains
        errors_count: errors.length,
        duration_seconds: duration,
        completed_at: new Date().toISOString(),
        note: 'Bookings handled by Edge Function, Credits via webhook/fire-and-forget'
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
  backfillBookingHubSpotIds,  // New: backfill function for external use
  getLastSyncTimestamp,
  updateLastSyncTimestamp
};
