/**
 * POST /api/admin/mock-exams/bulk-update
 * Bulk update properties for multiple mock exam sessions
 *
 * Features:
 * - Update multiple session properties (location, mock_type, capacity, exam_date, is_active, scheduled_activation_datetime)
 * - Validates capacity constraints when updating sessions with bookings
 * - Auto-regeneration of mock_exam_name when components change
 * - Intelligent clearing of scheduled_activation_datetime when status changes from 'scheduled'
 * - Batch processing with HubSpot API (100 sessions per batch)
 * - Partial failure handling with detailed error reporting
 * - Comprehensive cache invalidation
 * - Audit trail creation for successful updates
 *
 * Request Body:
 * {
 *   "sessionIds": ["123456", "123457", "123458"],
 *   "updates": {
 *     "location": "Calgary",
 *     "capacity": 12,
 *     "is_active": "active"
 *   }
 * }
 *
 * Returns:
 * - Summary statistics (total, updated, failed, skipped)
 * - Detailed results for each session
 * - Error details for blocked/failed sessions
 */

const { requirePermission } = require('../middleware/requirePermission');
const { validationMiddleware } = require('../../_shared/validation');
const { getCache } = require('../../_shared/cache');
const hubspot = require('../../_shared/hubspot');
const { syncExamToSupabase } = require('../../_shared/supabase-data');
const { triggerExamCascade, shouldCascadeUpdate, extractCascadeProperties } = require('../../_shared/supabase-webhook');

// HubSpot Object Type ID for mock exams
const HUBSPOT_OBJECTS = {
  'mock_exams': '2-50158913'
};

// Maximum sessions per request (HubSpot batch limit is 100)
const MAX_SESSIONS_PER_REQUEST = 100;
const HUBSPOT_BATCH_SIZE = 100;

module.exports = async (req, res) => {
  const startTime = Date.now();

  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return res.status(405).json({
        success: false,
        error: {
          code: 'METHOD_NOT_ALLOWED',
          message: `Method ${req.method} not allowed. Use POST.`
        }
      });
    }

    // Step 1: Authentication and Permission
    const user = await requirePermission(req, 'exams.edit');
    const adminEmail = user?.email || 'admin@prepdoctors.com';

    console.log(`📝 [BULK-UPDATE] Processing bulk update request from ${adminEmail}`);

    // Step 2: Validation
    const validator = validationMiddleware('bulkUpdate');
    await new Promise((resolve, reject) => {
      validator(req, res, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });

    const { sessionIds, updates, sessions: sessionsWithState } = req.validatedData;

    // Extract session IDs and updates from either format
    let targetSessionIds;
    let cleanedUpdates;

    if (sessionsWithState) {
      // New format: sessions array (extract IDs and updates)
      targetSessionIds = sessionsWithState.map(s => s.id);
      // For bulk updates, all sessions get the same updates (from first session or updates field)
      cleanedUpdates = sessionsWithState[0]?.updates || {};
      console.log(`📝 [BULK-UPDATE] Extracted ${targetSessionIds.length} session IDs from sessions array`);
    } else {
      // Legacy format: sessionIds + updates
      targetSessionIds = sessionIds;
      cleanedUpdates = updates || {};
      console.log(`📝 [BULK-UPDATE] Using ${targetSessionIds.length} session IDs with updates`);
    }

    // Remove empty/null/undefined values from updates
    // EXCEPTION: mock_set can be empty string (to clear the value)
    cleanedUpdates = Object.entries(cleanedUpdates).reduce((acc, [key, value]) => {
      // Allow empty string for mock_set (clearing the value)
      if (key === 'mock_set') {
        if (value !== null && value !== undefined) {
          acc[key] = value;  // Keep empty string for clearing
        }
      } else if (value !== '' && value !== null && value !== undefined) {
        acc[key] = value;
      }
      return acc;
    }, {});

    // Always fetch current state from HubSpot (simplifies code, avoids frontend pass-through complexity)
    console.log(`🔍 [BULK-UPDATE] Fetching ${targetSessionIds.length} sessions from HubSpot...`);
    const fetchedSessions = await hubspot.batchFetchMockExams(targetSessionIds);

    // Transform to processing format
    const processSessions = fetchedSessions.map(session => ({
      id: session.id,
      currentState: session.properties,
      updates: cleanedUpdates,
      // Keep original HubSpot response for timestamps
      _hubspotRecord: session
    }));

    if (!processSessions || processSessions.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SESSIONS_NOT_FOUND',
          message: 'No sessions found with the provided IDs'
        }
      });
    }

    // Step 4: Filter and validate sessions
    const validUpdates = [];
    const invalidSessions = [];

    for (const sessionData of processSessions) {
      const sessionId = sessionData.id;
      const currentProps = sessionData.currentState;
      const sessionUpdates = sessionData.updates || {};
      const totalBookings = parseInt(currentProps.total_bookings) || 0;

      // Remove empty/null/undefined values from updates
      // EXCEPTION: mock_set can be empty string (to clear the value)
      const cleanedSessionUpdates = Object.entries(sessionUpdates).reduce((acc, [key, value]) => {
        // Allow empty string for mock_set (clearing the value)
        if (key === 'mock_set') {
          if (value !== null && value !== undefined) {
            acc[key] = value;  // Keep empty string for clearing
          }
        } else if (value !== '' && value !== null && value !== undefined) {
          acc[key] = value;
        }
        return acc;
      }, {});

      // Log warning if editing session with bookings (for audit purposes)
      if (totalBookings > 0) {
        console.log(`⚠️ [BULK-UPDATE] Editing session ${sessionId} with ${totalBookings} existing booking(s)`);
      }

      // Check capacity constraint if capacity is being updated
      if (cleanedSessionUpdates.capacity !== undefined) {
        const newCapacity = parseInt(cleanedSessionUpdates.capacity);
        if (newCapacity < totalBookings) {
          invalidSessions.push({
            id: sessionId,
            reason: `Capacity (${newCapacity}) cannot be less than total bookings (${totalBookings})`
          });
          continue;
        }
      }

      // Build properties object for update
      const properties = {};

      // Copy cleaned updates
      Object.assign(properties, cleanedSessionUpdates);

      // Step 5: Auto-regenerate mock_exam_name if components changed
      if (cleanedSessionUpdates.mock_type || cleanedSessionUpdates.location || cleanedSessionUpdates.exam_date) {
        const mockType = cleanedSessionUpdates.mock_type || currentProps.mock_type;
        const location = cleanedSessionUpdates.location || currentProps.location;
        const examDate = cleanedSessionUpdates.exam_date || currentProps.exam_date;

        properties.mock_exam_name = `${mockType}-${location}-${examDate}`;
        console.log(`📝 [BULK-UPDATE] Regenerated mock_exam_name for session ${sessionId}: ${properties.mock_exam_name}`);
      }

      // Step 6: Clear scheduled_activation_datetime if status changed from 'scheduled' to something else
      if (cleanedSessionUpdates.is_active && cleanedSessionUpdates.is_active !== 'scheduled') {
        // Convert frontend values to HubSpot format
        let hubspotValue;
        if (cleanedSessionUpdates.is_active === 'active') {
          hubspotValue = 'true';
        } else if (cleanedSessionUpdates.is_active === 'inactive') {
          hubspotValue = 'false';
        } else {
          hubspotValue = cleanedSessionUpdates.is_active;
        }
        properties.is_active = hubspotValue;

        // Clear scheduled datetime if current status is 'scheduled'
        if (currentProps.is_active === 'scheduled') {
          properties.scheduled_activation_datetime = '';
          console.log(`📝 [BULK-UPDATE] Clearing scheduled_activation_datetime for session ${sessionId}`);
        }
      } else if (cleanedSessionUpdates.is_active === 'scheduled') {
        // Keep 'scheduled' as is for HubSpot
        properties.is_active = 'scheduled';
      }

      // Convert capacity to string if provided (HubSpot stores numbers as strings)
      if (properties.capacity !== undefined) {
        properties.capacity = properties.capacity.toString();
      }

      validUpdates.push({
        id: sessionId,
        properties,
        currentState: currentProps  // Store for Supabase sync
      });
    }

    console.log(`📝 [BULK-UPDATE] Valid updates: ${validUpdates.length}, Invalid sessions: ${invalidSessions.length}`);

    // Check if we have any valid updates to process
    if (validUpdates.length === 0) {
      return res.status(200).json({
        success: true,
        summary: {
          total: targetSessionIds.length,
          updated: 0,
          failed: invalidSessions.length,
          skipped: invalidSessions.length
        },
        results: {
          successful: [],
          failed: invalidSessions
        },
        meta: {
          timestamp: new Date().toISOString(),
          processedBy: adminEmail,
          executionTime: Date.now() - startTime
        }
      });
    }

    // Step 7: Execute batch updates in chunks of 100
    console.log(`⚡ [BULK-UPDATE] Updating ${validUpdates.length} sessions via HubSpot batch API...`);

    const results = {
      successful: [],
      failed: []
    };

    for (let i = 0; i < validUpdates.length; i += HUBSPOT_BATCH_SIZE) {
      const chunk = validUpdates.slice(i, i + HUBSPOT_BATCH_SIZE);
      const chunkNumber = Math.floor(i / HUBSPOT_BATCH_SIZE) + 1;

      try {
        console.log(`⚡ [BULK-UPDATE] Processing chunk ${chunkNumber} with ${chunk.length} sessions...`);

        const response = await hubspot.apiCall('POST',
          `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/batch/update`,
          { inputs: chunk }
        );

        if (response.results) {
          // Store full objects for Supabase sync (includes createdAt/updatedAt)
          results.successful.push(...response.results.map(r => r.id));
          // Store full response objects for later use
          results.successfulObjects = results.successfulObjects || [];
          results.successfulObjects.push(...response.results);
          console.log(`✅ [BULK-UPDATE] Chunk ${chunkNumber} successful: ${response.results.length} sessions updated`);
        }

        // Handle partial failures within successful batch call
        if (response.errors) {
          for (const error of response.errors) {
            results.failed.push({
              id: error.context?.id || 'unknown',
              reason: error.message || 'HubSpot API error'
            });
          }
        }
      } catch (error) {
        console.error(`❌ [BULK-UPDATE] Chunk ${chunkNumber} failed:`, error);

        // Mark all items in this chunk as failed
        results.failed.push(...chunk.map(c => ({
          id: c.id,
          reason: error.message || 'HubSpot batch update failed'
        })));
      }
    }

    // Step 8: Create audit trail notes (non-blocking)
    if (results.successful.length > 0) {
      createAuditTrails(results.successful, cleanedUpdates, user).catch(err => {
        console.error('[BULK-UPDATE] Audit trail creation failed:', err);
      });
    }

    // Step 8.5: Sync updates to Supabase
    // Use already-fetched session data (from batchFetchMockExams at line 108)
    // This avoids redundant fetches or frontend pass-through complexity
    let supabaseSynced = false;
    if (results.successful.length > 0) {
      try {
        const supabaseUpdates = results.successfulObjects.map(examObject => {
          // Find the corresponding session data to get currentState (already fetched from HubSpot)
          const sessionData = validUpdates.find(s => s.id === examObject.id);
          const propertiesForSync = {
            ...sessionData?.currentState,     // From HubSpot fetch at line 108
            ...examObject.properties          // Updated values from batch update
          };

          // Ensure mock_exam_name is always populated for Supabase sync
          // Generate it if missing (could be null from HubSpot if never set)
          if (!propertiesForSync.mock_exam_name) {
            const mockType = propertiesForSync.mock_type;
            const location = propertiesForSync.location;
            const examDate = propertiesForSync.exam_date;
            if (mockType && location && examDate) {
              propertiesForSync.mock_exam_name = `${mockType}-${location}-${examDate}`;
            }
          }

          return syncExamToSupabase({
            id: examObject.id,
            createdAt: examObject.createdAt,
            updatedAt: examObject.updatedAt,
            properties: propertiesForSync
          });
        });

        const supabaseResults = await Promise.allSettled(supabaseUpdates);
        const syncedCount = supabaseResults.filter(r => r.status === 'fulfilled').length;
        console.log(`✅ [BULK-UPDATE] Synced ${syncedCount}/${results.successful.length} exams to Supabase`);
        supabaseSynced = syncedCount === results.successful.length;

        // 🆕 Trigger webhook cascade for affected exams (if relevant properties changed)
        if (shouldCascadeUpdate(cleanedUpdates)) {
          const cascadeProps = extractCascadeProperties(cleanedUpdates);
          console.log(`🔔 [BULK-UPDATE] Triggering cascade for ${results.successful.length} exams`);
          console.log(`🔔 [BULK-UPDATE] Properties to cascade:`, Object.keys(cascadeProps));

          // Trigger cascade for each successfully updated exam
          results.successful.forEach(sessionId => {
            triggerExamCascade(sessionId, cascadeProps);
          });
        }
      } catch (supabaseError) {
        console.error('❌ Supabase bulk update sync failed:', supabaseError.message);
        // Continue - HubSpot is source of truth
      }
    }

    // Step 9: Invalidate caches
    console.log(`🗑️ [BULK-UPDATE] Invalidating caches...`);
    const cache = getCache();

    await Promise.all([
      cache.deletePattern('admin:mock-exams:list:*'),
      cache.deletePattern('admin:mock-exams:aggregates:*'),
      cache.deletePattern('admin:aggregate:sessions:*'),
      cache.deletePattern('admin:metrics:*'),
      cache.deletePattern('admin:mock-exam:*'),
      cache.deletePattern('admin:bookings:*')
    ]).catch(err => {
      console.error('[BULK-UPDATE] Cache invalidation error:', err);
      // Don't fail the request if cache invalidation fails
    });

    // Step 10: Build response
    const summary = {
      total: targetSessionIds.length,
      updated: results.successful.length,
      failed: results.failed.length + invalidSessions.length,
      skipped: invalidSessions.length
    };

    console.log(`✅ [BULK-UPDATE] Complete: ${summary.updated} updated, ${summary.failed} failed (${Date.now() - startTime}ms)`);

    res.status(200).json({
      success: true,
      summary,
      results: {
        successful: results.successful,
        failed: [...results.failed, ...invalidSessions]
      },
      meta: {
        timestamp: new Date().toISOString(),
        processedBy: adminEmail,
        executionTime: Date.now() - startTime
      },
      supabase_synced: supabaseSynced
    });

  } catch (error) {
    console.error('❌ [BULK-UPDATE] Error:', error);

    // Handle validation errors
    if (error.validationErrors) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: error.validationErrors
        }
      });
    }

    // Handle auth errors
    if (error.message?.includes('authorization') || error.message?.includes('token')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
    }

    // Handle timeout errors (Vercel 60s limit)
    if (Date.now() - startTime > 55000) {
      return res.status(504).json({
        success: false,
        error: {
          code: 'TIMEOUT',
          message: 'Request timeout. Please try with fewer sessions.'
        }
      });
    }

    // Generic error
    res.status(error.status || 500).json({
      success: false,
      error: {
        code: error.code || 'BULK_UPDATE_FAILED',
        message: error.message || 'Failed to update sessions'
      }
    });
  }
};

/**
 * Helper function to create audit trails for successful updates
 * @param {Array} sessionIds - Array of successfully updated session IDs
 * @param {Object} updates - The updates that were applied
 * @param {Object} user - The user who performed the update
 */
async function createAuditTrails(sessionIds, updates, user) {
  try {
    console.log(`📝 [AUDIT] Creating audit trail for ${sessionIds.length} sessions`);

    // Format the changes for logging
    const changes = Object.entries(updates)
      .filter(([_, value]) => value !== '' && value !== null && value !== undefined)
      .map(([field, newValue]) => ({
        field,
        newValue: typeof newValue === 'object' ? JSON.stringify(newValue) : newValue.toString()
      }));

    // Create a formatted note content
    const noteContent = `
      <strong>📝 Bulk Edit - Mock Exam Sessions</strong><br/>
      <hr/>
      <strong>Changes Applied:</strong><br/>
      ${changes.map(c => `• ${c.field}: ${c.newValue}`).join('<br/>')}<br/>
      <br/>
      <strong>Sessions Updated:</strong> ${sessionIds.length}<br/>
      <strong>Session IDs:</strong> ${sessionIds.slice(0, 5).join(', ')}${sessionIds.length > 5 ? ` ... and ${sessionIds.length - 5} more` : ''}<br/>
      <br/>
      <strong>Updated By:</strong> ${user.email}<br/>
      <strong>Timestamp:</strong> ${new Date().toISOString()}<br/>
    `;

    // Log to console for audit trail (in production, this could be written to a database or external service)
    console.log(`📝 [AUDIT] Bulk update operation:`, {
      sessionCount: sessionIds.length,
      changes,
      adminEmail: user.email,
      timestamp: new Date().toISOString()
    });

    // Note: We don't create individual notes on each session for bulk operations
    // as this could create hundreds of notes and overwhelm the system.
    // Instead, we log the operation for audit purposes.

  } catch (error) {
    console.error('Failed to create audit trails:', error);
    // Don't throw - this is non-critical
  }
}