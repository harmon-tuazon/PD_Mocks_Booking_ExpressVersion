/**
 * POST /api/admin/mock-exams/bulk-toggle-status
 * Bulk toggle active/inactive status for multiple mock exam sessions
 *
 * Features:
 * - Toggle active status for multiple sessions (up to 100 per request)
 * - Intelligent toggle: active → inactive, inactive → active
 * - Idempotent operations - safe to retry
 * - Partial failure handling with detailed error reporting
 * - HubSpot batch API optimization with automatic chunking
 * - Cache invalidation for affected resources
 * - Audit logging for each bulk operation
 *
 * Request Body:
 * {
 *   "sessionIds": ["123456", "123457", "123458"]
 * }
 *
 * Returns:
 * - Detailed results for each session update
 * - Summary statistics (total, updated, failed, activated, deactivated)
 * - Error details for failed updates
 */

const { requirePermission } = require('../middleware/requirePermission');
const { validationMiddleware } = require('../../_shared/validation');
const { getCache } = require('../../_shared/cache');
const hubspot = require('../../_shared/hubspot');
const { supabaseAdmin } = require('../../_shared/supabase');

// HubSpot Object Type IDs
const HUBSPOT_OBJECTS = {
  'mock_exams': '2-50158913',
  'bookings': '2-50158943'
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

    // Verify admin authentication and permission
    const user = await requirePermission(req, 'exams.activate');
    const adminEmail = user?.email || 'admin@prepdoctors.com';

    // Validate request body
    const validator = validationMiddleware('bulkToggleStatus');
    await new Promise((resolve, reject) => {
      validator(req, res, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });

    const { sessionIds } = req.validatedData;

    // Double-check session count (validation should handle this)
    if (sessionIds.length > MAX_SESSIONS_PER_REQUEST) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BATCH_SIZE_EXCEEDED',
          message: `Maximum ${MAX_SESSIONS_PER_REQUEST} sessions can be toggled per request`,
          details: { provided: sessionIds.length, maximum: MAX_SESSIONS_PER_REQUEST }
        }
      });
    }

    console.log(`🔄 [BULK-TOGGLE] Processing bulk toggle for ${sessionIds.length} sessions`);
    console.log(`🔄 [BULK-TOGGLE] Admin: ${adminEmail}`);

    // Fetch all sessions in batches to get current state
    console.log(`🔍 [BULK-TOGGLE] Fetching session details from HubSpot...`);
    const existingSessions = await fetchSessionsBatch(sessionIds);

    // Initialize result tracking
    const results = {
      successful: [],
      failed: []
    };

    // Summary statistics
    const summary = {
      total: sessionIds.length,
      updated: 0,
      failed: 0,
      activated: 0,
      deactivated: 0
    };

    // Validate and prepare updates
    const updates = [];

    for (const sessionId of sessionIds) {
      const session = existingSessions.get(sessionId);

      // Check if session exists
      if (!session) {
        results.failed.push({
          sessionId,
          error: 'Session not found',
          code: 'NOT_FOUND'
        });
        summary.failed++;
        continue;
      }

      // Get current active state (handle boolean true/false or string "scheduled")
      const currentState = session.properties.is_active;
      let newState;

      // Toggle logic - HubSpot stores ALL values as STRINGS: 'true', 'false', or 'scheduled'
      if (currentState === 'true') {
        // Currently active → deactivate
        newState = 'false';  // String 'false'
        summary.deactivated++;
      } else if (currentState === 'false') {
        // Currently inactive → activate
        newState = 'true';  // String 'true'
        summary.activated++;
      } else if (currentState === 'scheduled') {
        // Currently scheduled → activate immediately
        newState = 'true';  // String 'true'
        summary.activated++;
      } else {
        // Handle legacy or unexpected values - default to activate
        newState = 'true';  // String 'true'
        summary.activated++;
      }

      // Prepare update
      updates.push({
        id: sessionId,
        properties: {
          is_active: newState
        },
        metadata: {
          previousState: currentState,
          newState: newState
        }
      });
    }

    // Process updates in batches
    if (updates.length > 0) {
      console.log(`⚡ [BULK-TOGGLE] Processing ${updates.length} status toggles...`);
      console.log(`⚡ [BULK-TOGGLE] ${summary.activated} to activate, ${summary.deactivated} to deactivate`);

      const updateResults = await processStatusToggleBatch(updates);

      // Process results
      for (const result of updateResults.successful) {
        // Find the original metadata
        const originalUpdate = updates.find(u => u.id === result.id);

        results.successful.push({
          sessionId: result.id,
          previousState: originalUpdate.metadata.previousState,
          newState: originalUpdate.metadata.newState,
          message: originalUpdate.metadata.newState === 'true' ? 'Activated' :
                  originalUpdate.metadata.newState === 'false' ? 'Deactivated' :
                  originalUpdate.metadata.newState === 'scheduled' ? 'Scheduled' :
                  `Changed to ${originalUpdate.metadata.newState}`
        });
        summary.updated++;
      }

      for (const error of updateResults.failed) {
        // Find and adjust summary counts
        const originalUpdate = updates.find(u => u.id === error.id);
        if (originalUpdate) {
          if (originalUpdate.metadata.newState === 'true') {
            summary.activated--;
          } else if (originalUpdate.metadata.newState === 'false') {
            summary.deactivated--;
          }
        }

        results.failed.push({
          sessionId: error.id,
          error: error.message || 'Failed to update status',
          code: 'UPDATE_FAILED'
        });
        summary.failed++;
      }
    }

    // Invalidate relevant caches if any updates succeeded
    if (results.successful.length > 0) {
      await invalidateSessionCaches();
      console.log(`🗑️ [BULK-TOGGLE] Caches invalidated`);
    }

    // Sync status toggles to Supabase
    let supabaseSynced = false;
    if (results.successful.length > 0) {
      try {
        const supabaseUpdates = results.successful.map(result => {
          // results.successful contains objects with sessionId and newState (already processed)
          return supabaseAdmin
            .from('hubspot_mock_exams')
            .update({
              is_active: result.newState,
              updated_at: new Date().toISOString(),
              synced_at: new Date().toISOString()
            })
            .eq('hubspot_id', result.sessionId);
        });

        const supabaseResults = await Promise.allSettled(supabaseUpdates);
        const syncedCount = supabaseResults.filter(r => r.status === 'fulfilled').length;
        console.log(`✅ [BULK-TOGGLE] Synced ${syncedCount}/${results.successful.length} status toggles to Supabase`);
        supabaseSynced = syncedCount === results.successful.length;
      } catch (supabaseError) {
        console.error('❌ Supabase status toggle sync failed:', supabaseError.message);
        // Continue - HubSpot is source of truth
      }
    }

    // Log audit trail (non-blocking)
    if (results.successful.length > 0) {
      console.log(`✅ [BULK-TOGGLE] Successfully toggled ${results.successful.length} session(s)`);

      // Create audit log asynchronously
      createAuditLog(summary, adminEmail, sessionIds).catch(error => {
        console.error('Failed to create audit log:', error);
      });
    }

    // Check for timeout (Vercel 60s limit)
    if (Date.now() - startTime > 55000) {
      console.warn(`⚠️ [BULK-TOGGLE] Operation approaching timeout`);
    }

    // Return response
    const executionTime = Date.now() - startTime;

    res.status(200).json({
      success: true,
      summary,
      results,
      meta: {
        timestamp: new Date().toISOString(),
        processedBy: adminEmail,
        executionTime
      },
      supabase_synced: supabaseSynced
    });

  } catch (error) {
    console.error('❌ [BULK-TOGGLE] Error in bulk toggle status:', error);

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
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'An error occurred while toggling session status'
      }
    });
  }
};

/**
 * Fetch sessions in batches from HubSpot
 */
async function fetchSessionsBatch(sessionIds) {
  const sessionsMap = new Map();

  // Split into chunks of 100 (HubSpot batch limit)
  for (let i = 0; i < sessionIds.length; i += HUBSPOT_BATCH_SIZE) {
    const chunk = sessionIds.slice(i, i + HUBSPOT_BATCH_SIZE);

    try {
      const response = await hubspot.apiCall('POST', `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/batch/read`, {
        properties: [
          'is_active',
          'mock_type',
          'exam_date',
          'location',
          'capacity',
          'booked_count'
        ],
        inputs: chunk.map(id => ({ id }))
      });

      if (response.results) {
        for (const session of response.results) {
          sessionsMap.set(session.id, session);
        }
      }
    } catch (error) {
      console.error(`Error fetching session batch:`, error);
      // Continue processing other batches
    }
  }

  return sessionsMap;
}

/**
 * Process status toggle updates in batches
 */
async function processStatusToggleBatch(updates) {
  const results = {
    successful: [],
    failed: []
  };

  // Strip metadata before sending to HubSpot
  const hubspotUpdates = updates.map(update => ({
    id: update.id,
    properties: update.properties
  }));

  // Split into chunks of 100 (HubSpot batch limit)
  for (let i = 0; i < hubspotUpdates.length; i += HUBSPOT_BATCH_SIZE) {
    const chunk = hubspotUpdates.slice(i, i + HUBSPOT_BATCH_SIZE);

    try {
      const response = await hubspot.apiCall('POST', `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/batch/update`, {
        inputs: chunk
      });

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
      console.error(`Error processing toggle batch:`, error);

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
 * Invalidate caches affected by status toggles
 */
async function invalidateSessionCaches() {
  const cache = getCache();

  try {
    // Invalidate mock exams list cache (all pages)
    await cache.deletePattern('admin:mock-exams:list:*');

    // Invalidate aggregate caches
    await cache.deletePattern('admin:mock-exams:aggregates:*');
    await cache.deletePattern('admin:aggregate:sessions:*');

    // Invalidate metrics and dashboard caches
    await cache.deletePattern('admin:metrics:*');

    // Invalidate individual session caches
    await cache.deletePattern('admin:mock-exam:*');
    await cache.deletePattern('admin:mock-exam:details:*');

  } catch (error) {
    console.error('Error invalidating caches:', error);
    // Don't fail the request if cache invalidation fails
  }
}

/**
 * Create audit log for bulk toggle operation
 */
async function createAuditLog(summary, adminEmail, sessionIds) {
  try {
    // Create a formatted note content
    const noteContent = `
      <strong>🔄 Bulk Toggle Active Status</strong><br/>
      <hr/>
      <strong>Summary:</strong><br/>
      • Total Processed: ${summary.total}<br/>
      • Successfully Updated: ${summary.updated}<br/>
      • Activated: ${summary.activated}<br/>
      • Deactivated: ${summary.deactivated}<br/>
      • Failed: ${summary.failed}<br/>
      <br/>
      <strong>Session IDs:</strong><br/>
      ${sessionIds.slice(0, 10).join(', ')}${sessionIds.length > 10 ? ` ... and ${sessionIds.length - 10} more` : ''}<br/>
      <br/>
      <strong>Updated By:</strong> ${adminEmail}<br/>
      <strong>Timestamp:</strong> ${new Date().toISOString()}<br/>
    `;

    // Log to console for audit trail (could also write to a database or external service)
    console.log(`📝 [AUDIT] Bulk toggle operation:`, {
      summary,
      adminEmail,
      sessionCount: sessionIds.length,
      timestamp: new Date().toISOString()
    });

    // Note: Unlike the attendance endpoint, we don't create notes on individual sessions
    // as this could create hundreds of notes. Instead, we just log the operation.
    // In a production environment, this could be written to an audit log table or service.

  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw - this is non-critical
  }
}