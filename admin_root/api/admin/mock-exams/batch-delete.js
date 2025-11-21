/**
 * POST /api/admin/mock-exams/batch-delete
 * Batch delete multiple mock exam sessions with booking protection
 *
 * Features:
 * - Delete up to 100 sessions per request
 * - Booking protection - prevents deletion of sessions with active/completed bookings
 * - Idempotent operations - safe to retry
 * - Partial failure handling with detailed error reporting
 * - HubSpot batch archive API optimization
 * - Cache invalidation for affected resources
 * - Audit logging for each bulk operation
 *
 * Request Body:
 * {
 *   "sessionIds": ["123456", "123457", "123458"]
 * }
 *
 * Response Format:
 * {
 *   "success": true,
 *   "deleted": ["123456", "123457"],        // Successfully deleted IDs
 *   "failed": ["123458"],                    // Failed IDs
 *   "errors": [                              // Detailed errors
 *     { "id": "123458", "error": "HAS_BOOKINGS", "message": "Session has 3 active bookings" }
 *   ],
 *   "summary": {
 *     "total": 3,
 *     "deleted": 2,
 *     "failed": 1,
 *     "withBookings": 1,
 *     "notFound": 0,
 *     "errors": 0
 *   },
 *   "meta": {
 *     "timestamp": "2025-01-14T12:00:00Z",
 *     "processedBy": "admin@prepdoctors.com",
 *     "executionTime": 1234
 *   }
 * }
 *
 * Error Codes:
 * - BATCH_SIZE_EXCEEDED: More than 100 sessions requested
 * - NOT_FOUND: Session doesn't exist
 * - HAS_BOOKINGS: Session has active or completed bookings
 * - HUBSPOT_API_ERROR: HubSpot API failure
 * - UNAUTHORIZED: Authentication required
 * - TIMEOUT: Operation timeout (approaching 60s limit)
 */

const { requirePermission } = require('../middleware/requirePermission');
const { validationMiddleware } = require('../../_shared/validation');
const { getCache } = require('../../_shared/cache');
const hubspot = require('../../_shared/hubspot');
const { deleteExamFromSupabase } = require('../../_shared/supabase-data');

// HubSpot Object Type IDs
const HUBSPOT_OBJECTS = {
  'mock_exams': '2-50158913',
  'bookings': '2-50158943'
};

// Maximum sessions per request (HubSpot batch limit is 100)
const MAX_SESSIONS_PER_REQUEST = 100;
const HUBSPOT_BATCH_SIZE = 100;

// Vercel timeout threshold (60s limit, target 55s for safety)
const TIMEOUT_THRESHOLD = 55000;

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
    const user = await requirePermission(req, 'exams.delete');
    const adminEmail = user?.email || 'admin@prepdoctors.com';

    // Validate request body
    const validator = validationMiddleware('batchDeleteSessions');
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
          message: `Maximum ${MAX_SESSIONS_PER_REQUEST} sessions can be deleted per request`,
          details: { provided: sessionIds.length, maximum: MAX_SESSIONS_PER_REQUEST }
        }
      });
    }

    console.log(`🗑️ [BATCH-DELETE] Processing batch delete for ${sessionIds.length} sessions`);
    console.log(`🗑️ [BATCH-DELETE] Admin: ${adminEmail}`);

    // Step 1: Fetch all sessions and validate for deletion
    console.log(`🔍 [BATCH-DELETE] Fetching session details and checking bookings...`);
    const validationResults = await validateSessionsForDeletion(sessionIds);

    // Initialize result tracking
    const results = {
      deleted: [],
      failed: [],
      errors: []
    };

    // Summary statistics
    const summary = {
      total: sessionIds.length,
      deleted: 0,
      failed: 0,
      withBookings: 0,
      notFound: 0,
      errors: 0
    };

    // Check for timeout before processing
    if (Date.now() - startTime > TIMEOUT_THRESHOLD) {
      console.warn(`⚠️ [BATCH-DELETE] Timeout during validation`);
      return res.status(504).json({
        success: false,
        error: {
          code: 'TIMEOUT',
          message: 'Request timeout during validation. Please try with fewer sessions.'
        }
      });
    }

    // Step 2: Separate deletable vs non-deletable sessions
    const deletableSessions = [];

    for (const result of validationResults) {
      if (result.canDelete) {
        deletableSessions.push(result.sessionId);
      } else {
        // Add to failed list immediately
        results.failed.push(result.sessionId);
        results.errors.push({
          id: result.sessionId,
          error: result.error,
          message: result.message
        });

        // Update summary counters
        summary.failed++;
        if (result.error === 'HAS_BOOKINGS') {
          summary.withBookings++;
        } else if (result.error === 'NOT_FOUND') {
          summary.notFound++;
        } else {
          summary.errors++;
        }
      }
    }

    // Step 3: Delete sessions in batches using HubSpot batch archive API
    if (deletableSessions.length > 0) {
      console.log(`⚡ [BATCH-DELETE] Deleting ${deletableSessions.length} sessions...`);

      const deleteResults = await batchArchiveSessions(deletableSessions);

      // Process successful deletions
      for (const sessionId of deleteResults.successful) {
        results.deleted.push(sessionId);
        summary.deleted++;
      }

      // Process deletion failures
      for (const failure of deleteResults.failed) {
        results.failed.push(failure.sessionId);
        results.errors.push({
          id: failure.sessionId,
          error: failure.error,
          message: failure.message
        });
        summary.failed++;
        summary.errors++;
      }
    } else {
      console.log(`⚠️ [BATCH-DELETE] No deletable sessions found`);
    }

    // Step 4: Invalidate relevant caches if any sessions were deleted
    if (results.deleted.length > 0) {
      await invalidateSessionCaches();
      console.log(`🗑️ [BATCH-DELETE] Caches invalidated`);
    }

    // Step 4.5: Sync deletions to Supabase
    let supabaseSynced = false;
    if (results.deleted.length > 0) {
      try {
        const supabaseDeletes = results.deleted.map(sessionId =>
          deleteExamFromSupabase(sessionId)
        );

        const supabaseResults = await Promise.allSettled(supabaseDeletes);
        const syncedCount = supabaseResults.filter(r => r.status === 'fulfilled').length;
        console.log(`✅ [BATCH-DELETE] Deleted ${syncedCount}/${results.deleted.length} exams from Supabase`);
        supabaseSynced = syncedCount === results.deleted.length;
      } catch (supabaseError) {
        console.error('❌ Supabase batch delete sync failed:', supabaseError.message);
        // Continue - HubSpot is source of truth
      }
    }

    // Step 5: Create audit log (non-blocking)
    if (results.deleted.length > 0) {
      console.log(`✅ [BATCH-DELETE] Successfully deleted ${results.deleted.length} session(s)`);

      // Create audit log asynchronously
      createAuditLog(summary, adminEmail, sessionIds, results).catch(error => {
        console.error('Failed to create audit log:', error);
      });
    }

    // Check for timeout before response
    if (Date.now() - startTime > TIMEOUT_THRESHOLD) {
      console.warn(`⚠️ [BATCH-DELETE] Operation approaching timeout`);
    }

    // Return response
    const executionTime = Date.now() - startTime;

    res.status(200).json({
      success: true,
      deleted: results.deleted,
      failed: results.failed,
      errors: results.errors,
      summary,
      meta: {
        timestamp: new Date().toISOString(),
        processedBy: adminEmail,
        executionTime
      },
      supabase_synced: supabaseSynced
    });

  } catch (error) {
    console.error('❌ [BATCH-DELETE] Error in batch delete:', error);

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
    if (Date.now() - startTime > TIMEOUT_THRESHOLD) {
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
        message: 'An error occurred while deleting sessions'
      }
    });
  }
};

/**
 * Validate sessions for deletion by checking bookings
 * Returns array of validation results with canDelete flag
 */
async function validateSessionsForDeletion(sessionIds) {
  const validationResults = [];

  // Fetch sessions in batches
  const sessionsMap = await fetchSessionsBatch(sessionIds);

  // Check each session for bookings
  for (const sessionId of sessionIds) {
    const session = sessionsMap.get(sessionId);

    // Check if session exists
    if (!session) {
      validationResults.push({
        sessionId,
        canDelete: false,
        error: 'NOT_FOUND',
        message: 'Session not found or already deleted'
      });
      continue;
    }

    // Check total_bookings property (faster than fetching all bookings)
    // Note: total_bookings includes ALL bookings (active, completed, cancelled)
    const totalBookings = parseInt(session.properties.total_bookings || '0', 10);

    if (totalBookings > 0) {
      // Session has bookings - need to check if any are active/completed
      // Fetch full booking details to verify status
      try {
        const sessionDetails = await hubspot.getMockExamWithBookings(sessionId);

        // Filter for only Active or Completed bookings (exclude Cancelled)
        const activeOrCompletedBookings = sessionDetails.bookings.filter(booking => {
          const status = booking.properties.is_active;
          return status === 'Active' || status === 'Completed';
        });

        if (activeOrCompletedBookings.length > 0) {
          validationResults.push({
            sessionId,
            canDelete: false,
            error: 'HAS_BOOKINGS',
            message: `Session has ${activeOrCompletedBookings.length} active or completed booking(s). Cancel bookings first.`
          });
          continue;
        }

        // Only cancelled bookings - safe to delete
        validationResults.push({
          sessionId,
          canDelete: true
        });
      } catch (error) {
        console.error(`Error fetching bookings for session ${sessionId}:`, error);
        validationResults.push({
          sessionId,
          canDelete: false,
          error: 'VALIDATION_ERROR',
          message: 'Failed to validate booking status'
        });
      }
    } else {
      // No bookings - safe to delete
      validationResults.push({
        sessionId,
        canDelete: true
      });
    }
  }

  return validationResults;
}

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
          'mock_type',
          'exam_date',
          'location',
          'capacity',
          'total_bookings',
          'is_active'
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
      // Continue processing other batches - non-fetched sessions will be marked as NOT_FOUND
    }
  }

  return sessionsMap;
}

/**
 * Delete sessions using HubSpot batch archive API
 * Returns { successful: string[], failed: object[] }
 */
async function batchArchiveSessions(sessionIds) {
  const results = {
    successful: [],
    failed: []
  };

  // Split into chunks of 100 (HubSpot batch limit)
  for (let i = 0; i < sessionIds.length; i += HUBSPOT_BATCH_SIZE) {
    const chunk = sessionIds.slice(i, i + HUBSPOT_BATCH_SIZE);

    try {
      const response = await hubspot.apiCall(
        'POST',
        `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/batch/archive`,
        { inputs: chunk.map(id => ({ id })) }
      );

      // Process successful deletions
      if (response.results) {
        for (const result of response.results) {
          results.successful.push(result.id);
        }
      }

      // Process partial failures
      if (response.errors) {
        for (const error of response.errors) {
          results.failed.push({
            sessionId: error.context?.id || 'unknown',
            error: 'HUBSPOT_API_ERROR',
            message: error.message || 'Failed to delete session'
          });
        }
      }
    } catch (error) {
      console.error(`Error deleting session batch:`, error);

      // Mark all items in this chunk as failed
      for (const sessionId of chunk) {
        results.failed.push({
          sessionId,
          error: 'BATCH_DELETE_FAILED',
          message: error.message || 'Batch delete operation failed'
        });
      }
    }
  }

  return results;
}

/**
 * Invalidate caches affected by session deletions
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
 * Create audit log for batch delete operation
 */
async function createAuditLog(summary, adminEmail, sessionIds, results) {
  try {
    // Create a formatted audit log entry
    const auditEntry = {
      operation: 'BATCH_DELETE_SESSIONS',
      summary: {
        total: summary.total,
        deleted: summary.deleted,
        failed: summary.failed,
        withBookings: summary.withBookings,
        notFound: summary.notFound,
        errors: summary.errors
      },
      sessionIds: sessionIds,
      deletedIds: results.deleted,
      failedIds: results.failed,
      errors: results.errors,
      adminEmail: adminEmail,
      timestamp: new Date().toISOString()
    };

    // Log to console for audit trail
    console.log(`📝 [AUDIT] Batch delete operation:`, JSON.stringify(auditEntry, null, 2));

    // Note: In production, this could be written to:
    // - External logging service (e.g., Datadog, LogTail)
    // - HubSpot notes on affected sessions
    // - Dedicated audit log database/table
    // - S3 bucket for long-term audit storage

  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw - this is non-critical
  }
}
