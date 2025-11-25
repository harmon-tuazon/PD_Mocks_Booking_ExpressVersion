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
    console.log(`🔍 [SCHEDULED-ACTIVATION] Querying for sessions to activate...`);

    // Query HubSpot for sessions that need activation
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

    // Activate sessions in batches
    const results = await batchActivateSessions(sessionsToActivate);

    // Sync activated sessions to Supabase (direct update, no re-fetch needed)
    let supabaseSynced = 0;
    if (results.successful.length > 0) {
      console.log(`🔄 [SCHEDULED-ACTIVATION] Syncing ${results.successful.length} activated exams to Supabase...`);

      // Create a map of session IDs to their original data for quick lookup
      const sessionMap = new Map(sessionsToActivate.map(s => [s.id, s]));

      for (const successfulResult of results.successful) {
        try {
          // Get original session data
          const originalSession = sessionMap.get(successfulResult.id);
          if (!originalSession) {
            console.warn(`⚠️ [SCHEDULED-ACTIVATION] Session ${successfulResult.id} not found in original data`);
            continue;
          }

          // Build exam object with updated is_active property (no HubSpot API call needed!)
          const updatedExam = {
            id: successfulResult.id,
            properties: {
              ...successfulResult.properties, // Properties from HubSpot batch update response
              is_active: 'true' // We know it's now active
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
 * Query HubSpot for sessions that are overdue for activation
 * @returns {Promise<Array>} Array of session objects
 */
async function findOverdueSessions() {
  const now = Date.now(); // Current timestamp in milliseconds

  const searchRequest = {
    filterGroups: [{
      filters: [
        {
          propertyName: 'is_active',
          operator: 'EQ',
          value: 'scheduled'
        },
        {
          propertyName: 'scheduled_activation_datetime',
          operator: 'LTE',
          value: now.toString()
        },
        {
          propertyName: 'scheduled_activation_datetime',
          operator: 'HAS_PROPERTY'
        }
      ]
    }],
    properties: [
      'is_active',
      'scheduled_activation_datetime',
      'mock_type',
      'exam_date',
      'start_time',
      'end_time',
      'location',
      'capacity'
    ],
    limit: 100 // Process up to 100 per execution
  };

  try {
    const hubspot = new HubSpotService();
    const response = await hubspot.apiCall('POST',
      `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/search`,
      searchRequest
    );

    return response.results || [];
  } catch (error) {
    console.error('Error querying overdue sessions:', error);
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
