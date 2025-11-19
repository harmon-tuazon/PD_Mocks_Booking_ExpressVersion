/**
 * POST /api/admin/mock-exams/clone
 * Clone multiple mock exam sessions with modified properties
 *
 * Features:
 * - Clone 1-100 sessions at once
 * - Pre-loaded source session properties from frontend (no HubSpot refetch needed)
 * - Required: exam_date (must be different from source)
 * - Optional: All other fields (location, mock_type, capacity, times, status)
 * - Empty fields use source session values
 * - Populated fields override source values for ALL clones
 * - Auto-regeneration of mock_exam_name
 * - Reset total_bookings to 0 for all cloned sessions
 * - Batch processing with HubSpot API (100 sessions per batch)
 * - Partial failure handling with detailed error reporting
 * - Comprehensive cache invalidation
 * - Audit trail creation for source sessions
 *
 * Request Body:
 * {
 *   "cloneSources": [
 *     {
 *       "sourceSessionId": "123456",
 *       "sourceProperties": {
 *         "mock_type": "Clinical Skills",
 *         "location": "Mississauga",
 *         "exam_date": "2025-02-08",
 *         "capacity": "10",
 *         "start_time": "14:00",
 *         "end_time": "16:00",
 *         "is_active": "active",
 *         "scheduled_activation_datetime": ""
 *       }
 *     }
 *   ],
 *   "overrides": {
 *     "exam_date": "2025-03-15",
 *     "location": "Calgary"
 *   }
 * }
 *
 * Returns:
 * - Summary statistics (total, created, failed, skipped)
 * - Detailed results for each cloned session
 * - Error details for validation failures
 */

const { requireAdmin } = require('../middleware/requireAdmin');
const { validationMiddleware } = require('../../_shared/validation');
const { getCache } = require('../../_shared/cache');
const hubspot = require('../../_shared/hubspot');

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

    // Step 1: Authentication
    const user = await requireAdmin(req);
    const adminEmail = user?.email || 'admin@prepdoctors.com';

    console.log(`📋 [CLONE] Processing clone request from ${adminEmail}`);

    // Step 2: Validation
    const validator = validationMiddleware('clone');
    await new Promise((resolve, reject) => {
      validator(req, res, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });

    const { cloneSources, overrides } = req.validatedData;

    console.log(`📋 [CLONE] Processing ${cloneSources.length} clone requests with provided source data...`);

    // Step 3: Get max mock_exam_id for auto-incrementing new IDs
    console.log(`🔢 [CLONE] Fetching max mock_exam_id for ID generation...`);
    const maxMockExamId = await hubspot.getMaxMockExamIndex();
    console.log(`🔢 [CLONE] Current max mock_exam_id: ${maxMockExamId}, will assign starting from ${maxMockExamId + 1}`);

    // Step 4: Build properties for cloned sessions using provided source data
    const clonedSessionInputs = [];
    const validationErrors = [];

    for (let i = 0; i < cloneSources.length; i++) {
      const source = cloneSources[i];
      const sourceProps = source.sourceProperties;
      const sessionId = source.sourceSessionId;

      // Validate date is different from source
      if (overrides.exam_date === sourceProps.exam_date) {
        validationErrors.push({
          sessionId,
          reason: 'New date must be different from original date'
        });
        continue;
      }

      // Generate new unique mock_exam_id for this clone
      const newMockExamId = maxMockExamId + i + 1;

      // Build cloned properties by merging source + overrides
      const clonedProperties = {
        // Copy all source properties (already in clean format from frontend)
        ...sourceProps,

        // Apply overrides (only non-empty values)
        ...(overrides.exam_date && { exam_date: overrides.exam_date }),
        ...(overrides.location && { location: overrides.location }),
        ...(overrides.mock_type && { mock_type: overrides.mock_type }),
        ...(overrides.capacity && { capacity: overrides.capacity.toString() }),
        ...(overrides.start_time && { start_time: overrides.start_time }),
        ...(overrides.end_time && { end_time: overrides.end_time }),
        ...(overrides.is_active && { is_active: overrides.is_active }),
        ...(overrides.scheduled_activation_datetime && {
          scheduled_activation_datetime: overrides.scheduled_activation_datetime
        }),

        // CRITICAL: Generate new unique mock_exam_id (required by HubSpot)
        mock_exam_id: newMockExamId.toString(),

        // Reset booking count to 0
        total_bookings: '0',

        // Auto-generate new mock_exam_name
        mock_exam_name: `${overrides.mock_type || sourceProps.mock_type}-${overrides.location || sourceProps.location}-${overrides.exam_date}`
      };

      // Clear scheduled_activation_datetime if is_active changed from 'scheduled'
      if (overrides.is_active && overrides.is_active !== 'scheduled' && sourceProps.is_active === 'scheduled') {
        clonedProperties.scheduled_activation_datetime = '';
      }

      // Convert capacity to string if it's a number
      if (typeof clonedProperties.capacity === 'number') {
        clonedProperties.capacity = clonedProperties.capacity.toString();
      }

      clonedSessionInputs.push({
        properties: clonedProperties
      });
    }

    console.log(`📋 [CLONE] Creating ${clonedSessionInputs.length} cloned sessions (${validationErrors.length} skipped)...`);

    // Step 5: Create cloned sessions using batch API (chunks of 100)
    const results = {
      successful: [],
      failed: []
    };

    for (let i = 0; i < clonedSessionInputs.length; i += HUBSPOT_BATCH_SIZE) {
      const chunk = clonedSessionInputs.slice(i, i + HUBSPOT_BATCH_SIZE);
      const chunkNumber = Math.floor(i / HUBSPOT_BATCH_SIZE) + 1;

      try {
        console.log(`⚡ [CLONE] Processing chunk ${chunkNumber} with ${chunk.length} sessions...`);

        const response = await hubspot.apiCall('POST',
          `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/batch/create`,
          { inputs: chunk }
        );

        if (response.results) {
          results.successful.push(...response.results);
          console.log(`✅ [CLONE] Chunk ${chunkNumber} successful: ${response.results.length} sessions cloned`);
        }

        // Handle partial failures within successful batch call
        if (response.errors) {
          for (const error of response.errors) {
            results.failed.push({
              reason: error.message || 'HubSpot API error'
            });
          }
        }
      } catch (error) {
        console.error(`❌ [CLONE] Chunk ${chunkNumber} failed:`, error);

        // Mark all items in this chunk as failed
        results.failed.push(...chunk.map(() => ({
          reason: error.message || 'HubSpot batch create failed'
        })));
      }
    }

    // Step 6: Create audit trail notes for source sessions (non-blocking)
    if (results.successful.length > 0) {
      const sourceSessionIds = cloneSources.map(s => s.sourceSessionId);
      createCloneAuditTrails(sourceSessionIds, results.successful.length, user).catch(err => {
        console.error('[CLONE] Audit trail creation failed:', err);
      });
    }

    // Step 7: Invalidate caches - ensure UI shows new cloned sessions
    console.log(`🗑️ [CLONE] Invalidating caches...`);
    const cache = getCache();

    await Promise.all([
      cache.deletePattern('admin:mock-exams:list:*'),
      cache.deletePattern('admin:mock-exams:aggregates:*'),
      cache.deletePattern('admin:aggregate:sessions:*'),
      cache.deletePattern('admin:metrics:*'),
      cache.deletePattern('admin:mock-exam:*')
    ]).catch(err => {
      console.error('[CLONE] Cache invalidation error:', err);
      // Don't fail the request if cache invalidation fails
    });

    // Step 8: Build response
    const summary = {
      total: cloneSources.length,
      created: results.successful.length,
      failed: results.failed.length + validationErrors.length,
      skipped: validationErrors.length
    };

    console.log(`✅ [CLONE] Complete: ${summary.created} created, ${summary.failed} failed (${Date.now() - startTime}ms)`);

    res.status(200).json({
      success: true,
      summary,
      results: {
        successful: results.successful.map(s => ({
          id: s.id,
          properties: s.properties
        })),
        failed: [...results.failed, ...validationErrors]
      },
      meta: {
        timestamp: new Date().toISOString(),
        processedBy: adminEmail,
        executionTime: Date.now() - startTime
      }
    });

  } catch (error) {
    console.error('❌ [CLONE] Error:', error);

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
        code: error.code || 'CLONE_FAILED',
        message: error.message || 'Failed to clone sessions',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    });
  }
};

/**
 * Helper function for audit trails
 * @param {Array<string>} sourceSessionIds - Array of source session IDs
 * @param {number} clonedCount - Number of sessions cloned
 * @param {Object} user - The user who performed the clone
 */
async function createCloneAuditTrails(sourceSessionIds, clonedCount, user) {
  try {
    console.log(`📝 [AUDIT] Creating audit trail for ${sourceSessionIds.length} source sessions`);

    // Note: We create a summary log rather than individual notes to avoid overwhelming the system
    console.log(`📝 [AUDIT] Clone operation:`, {
      sourceSessionCount: sourceSessionIds.length,
      clonedCount,
      adminEmail: user.email,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Failed to create audit trails:', error);
    // Don't throw - this is non-critical
  }
}
