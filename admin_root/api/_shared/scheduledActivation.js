/**
 * Shared Scheduled Activation Logic
 * Used by both:
 * 1. Cron job: /api/admin/cron/activate-scheduled-exams
 * 2. Manual trigger: /api/admin/mock-exams/trigger-scheduled-activation
 *
 * This keeps the logic DRY and testable.
 */

const { HubSpotService } = require('./hubspot');
const { getCache } = require('./cache');
const { syncExamToSupabase } = require('./supabase-data');

// HubSpot Object Type IDs
const HUBSPOT_OBJECTS = {
  'mock_exams': '2-50158913'
};

const BATCH_SIZE = 100;

/**
 * Find and activate all scheduled sessions that are due
 * @returns {Promise<Object>} Activation summary
 */
async function activateScheduledSessions() {
  const startTime = Date.now();

  try {
    console.log(`🔍 [SCHEDULED-ACTIVATION] Querying Supabase for sessions to activate...`);

    // Query Supabase for sessions that need activation
    const sessionsToActivate = await findOverdueSessions();

    console.log(`📊 [SCHEDULED-ACTIVATION] Found ${sessionsToActivate.length} session(s) to activate`);

    if (sessionsToActivate.length === 0) {
      return {
        activated: 0,
        failed: 0,
        total: 0,
        timestamp: new Date().toISOString(),
        executionTime: Date.now() - startTime
      };
    }

    // Activate sessions in batches (HubSpot update)
    const results = await batchActivateSessions(sessionsToActivate);

    // Sync activated sessions to Supabase
    // CRITICAL: Use original session properties + updated is_active
    // HubSpot batch response only contains updated fields, not all properties!
    let supabaseSynced = 0;
    if (results.successful.length > 0) {
      console.log(`🔄 [SCHEDULED-ACTIVATION] Syncing ${results.successful.length} activated exams to Supabase...`);

      // Create a map of session IDs to their original data for quick lookup
      const sessionMap = new Map(sessionsToActivate.map(s => [s.id, s]));

      for (const successfulResult of results.successful) {
        try {
          // Get original session data (contains all properties from Supabase query)
          const originalSession = sessionMap.get(successfulResult.id);
          if (!originalSession) {
            console.warn(`⚠️ [SCHEDULED-ACTIVATION] Session ${successfulResult.id} not found in original data`);
            continue;
          }

          // FIXED: Merge original properties with update
          // Original session has all properties (capacity, mock_type, etc.)
          // Only override is_active and clear scheduled_activation_datetime
          const updatedExam = {
            id: successfulResult.id,
            properties: {
              ...originalSession.properties,  // All original properties (capacity, mock_type, etc.)
              is_active: 'true',              // Now active
              scheduled_activation_datetime: null  // Clear the scheduled datetime
            }
          };

          // Sync to Supabase
          await syncExamToSupabase(updatedExam);
          supabaseSynced++;
        } catch (supabaseError) {
          console.error(`❌ [SCHEDULED-ACTIVATION] Failed to sync exam ${successfulResult.id} to Supabase:`, supabaseError.message);
          // Continue with next exam - don't block activation
        }
      }

      console.log(`✅ [SCHEDULED-ACTIVATION] Synced ${supabaseSynced}/${results.successful.length} exams to Supabase`);

      // Invalidate caches after sync
      await invalidateSessionCaches();
      console.log(`🗑️ [SCHEDULED-ACTIVATION] Caches invalidated`);
    }

    const executionTime = Date.now() - startTime;

    console.log(`✅ [SCHEDULED-ACTIVATION] Complete: ${results.successful.length} activated, ${results.failed.length} failed, ${supabaseSynced} synced to Supabase in ${executionTime}ms`);

    return {
      activated: results.successful.length,
      failed: results.failed.length,
      supabase_synced: supabaseSynced,
      total: sessionsToActivate.length,
      successful_ids: results.successful.map(s => s.id),
      failed_ids: results.failed.map(f => f.id),
      timestamp: new Date().toISOString(),
      executionTime
    };

  } catch (error) {
    console.error('❌ [SCHEDULED-ACTIVATION] Error:', error);
    throw error;
  }
}

/**
 * Query Supabase for sessions that are overdue for activation
 * Uses Supabase instead of HubSpot for better read performance (~50ms vs ~500ms)
 * @returns {Promise<Array>} Array of session objects in HubSpot format
 */
async function findOverdueSessions() {
  const now = new Date().toISOString(); // Current time in ISO format for Supabase

  try {
    // Query Supabase instead of HubSpot for better performance
    const { supabaseAdmin } = require('./supabase');
    
    const { data, error } = await supabaseAdmin
      .from('hubspot_mock_exams')
      .select('*')
      .eq('is_active', 'scheduled')
      .not('scheduled_activation_datetime', 'is', null)
      .lte('scheduled_activation_datetime', now)
      .limit(100);

    if (error) {
      console.error('Error querying Supabase for overdue sessions:', error);
      throw error;
    }

    // Transform Supabase records to match HubSpot format expected by batchActivateSessions
    const sessions = (data || []).map(record => ({
      id: record.hubspot_id,
      properties: {
        is_active: record.is_active,
        scheduled_activation_datetime: record.scheduled_activation_datetime,
        mock_type: record.mock_type,
        mock_exam_name: record.mock_exam_name,
        exam_date: record.exam_date,
        start_time: record.start_time,
        end_time: record.end_time,
        location: record.location,
        capacity: record.capacity?.toString(),
        total_bookings: record.total_bookings?.toString()
      }
    }));

    console.log(`📊 [SCHEDULED-ACTIVATION] Found ${sessions.length} sessions from Supabase`);
    return sessions;
  } catch (error) {
    console.error('Error querying overdue sessions from Supabase:', error);
    throw error;
  }
}

/**
 * Activate sessions in batches
 * @param {Array} sessions - Sessions to activate
 * @returns {Promise<Object>} Results with successful and failed arrays
 */
async function batchActivateSessions(sessions) {
  const results = {
    successful: [],
    failed: []
  };

  // Prepare batch updates
  // HubSpot stores ALL values as STRINGS: 'true' for active
  const updates = sessions.map(session => ({
    id: session.id,
    properties: {
      is_active: 'true'  // Set to string 'true' for active
    }
  }));

  // Process in batches of 100 (HubSpot limit)
  const hubspot = new HubSpotService();

  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const chunk = updates.slice(i, i + BATCH_SIZE);

    try {
      const response = await hubspot.apiCall('POST',
        `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/batch/update`,
        { inputs: chunk }
      );

      if (response.results) {
        results.successful.push(...response.results);
      }

      // Handle partial failures
      if (response.errors) {
        for (const error of response.errors) {
          results.failed.push({
            id: error.context?.id || 'unknown',
            message: error.message
          });
        }
      }
    } catch (error) {
      console.error(`Error activating batch:`, error);

      // Mark all items in this chunk as failed
      for (const update of chunk) {
        results.failed.push({
          id: update.id,
          message: error.message || 'Batch update failed'
        });
      }
    }
  }

  return results;
}

/**
 * Invalidate all caches affected by session activation
 */
async function invalidateSessionCaches() {
  const cache = getCache();

  try {
    await cache.deletePattern('admin:mock-exams:list:*');
    await cache.deletePattern('admin:mock-exams:aggregates:*');
    await cache.deletePattern('admin:aggregate:sessions:*');
    await cache.deletePattern('admin:metrics:*');
    await cache.deletePattern('admin:mock-exam:*');
    await cache.deletePattern('admin:mock-exam:details:*');
  } catch (error) {
    console.error('Error invalidating caches:', error);
    // Don't throw - cache invalidation failure shouldn't break activation
  }
}

module.exports = {
  activateScheduledSessions,
  findOverdueSessions,
  batchActivateSessions,
  invalidateSessionCaches
};
