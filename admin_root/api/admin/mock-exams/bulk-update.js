/**
 * POST /api/admin/mock-exams/bulk-update
 * Bulk update properties for multiple mock exam sessions
 *
 * Features:
 * - Update multiple session properties (location, mock_type, capacity, exam_date, is_active, scheduled_activation_datetime)
 * - Automatic filtering of sessions with bookings (total_bookings > 0)
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

    const { sessionIds, updates } = req.validatedData;

    // Remove empty string values from updates
    const cleanedUpdates = Object.entries(updates).reduce((acc, [key, value]) => {
      if (value !== '' && value !== null && value !== undefined) {
        acc[key] = value;
      }
      return acc;
    }, {});

    console.log(`📝 [BULK-UPDATE] Processing ${sessionIds.length} sessions with updates:`, cleanedUpdates);

    // Step 3: Fetch current state of all sessions
    console.log(`🔍 [BULK-UPDATE] Fetching ${sessionIds.length} sessions from HubSpot...`);
    const sessions = await hubspot.batchFetchMockExams(sessionIds);

    if (!sessions || sessions.length === 0) {
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

    for (const session of sessions) {
      const sessionId = session.id;
      const currentProps = session.properties;
      const totalBookings = parseInt(currentProps.total_bookings) || 0;

      // Block sessions with existing bookings
      if (totalBookings > 0) {
        invalidSessions.push({
          id: sessionId,
          reason: `Session has ${totalBookings} booking(s) and cannot be bulk edited`
        });
        continue;
      }

      // Check capacity constraint if capacity is being updated
      if (cleanedUpdates.capacity !== undefined) {
        const newCapacity = parseInt(cleanedUpdates.capacity);
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
      Object.assign(properties, cleanedUpdates);

      // Step 5: Auto-regenerate mock_exam_name if components changed
      if (cleanedUpdates.mock_type || cleanedUpdates.location || cleanedUpdates.exam_date) {
        const mockType = cleanedUpdates.mock_type || currentProps.mock_type;
        const location = cleanedUpdates.location || currentProps.location;
        const examDate = cleanedUpdates.exam_date || currentProps.exam_date;

        properties.mock_exam_name = `${mockType}-${location}-${examDate}`;
        console.log(`📝 [BULK-UPDATE] Regenerated mock_exam_name for session ${sessionId}: ${properties.mock_exam_name}`);
      }

      // Step 6: Clear scheduled_activation_datetime if status changed from 'scheduled' to something else
      if (cleanedUpdates.is_active && cleanedUpdates.is_active !== 'scheduled') {
        // Convert frontend values to HubSpot format
        let hubspotValue;
        if (cleanedUpdates.is_active === 'active') {
          hubspotValue = 'true';
        } else if (cleanedUpdates.is_active === 'inactive') {
          hubspotValue = 'false';
        } else {
          hubspotValue = cleanedUpdates.is_active;
        }
        properties.is_active = hubspotValue;

        // Clear scheduled datetime if current status is 'scheduled'
        if (currentProps.is_active === 'scheduled') {
          properties.scheduled_activation_datetime = '';
          console.log(`📝 [BULK-UPDATE] Clearing scheduled_activation_datetime for session ${sessionId}`);
        }
      } else if (cleanedUpdates.is_active === 'scheduled') {
        // Keep 'scheduled' as is for HubSpot
        properties.is_active = 'scheduled';
      }

      // Convert capacity to string if provided (HubSpot stores numbers as strings)
      if (properties.capacity !== undefined) {
        properties.capacity = properties.capacity.toString();
      }

      validUpdates.push({
        id: sessionId,
        properties
      });
    }

    console.log(`📝 [BULK-UPDATE] Valid updates: ${validUpdates.length}, Invalid sessions: ${invalidSessions.length}`);

    // Check if we have any valid updates to process
    if (validUpdates.length === 0) {
      return res.status(200).json({
        success: true,
        summary: {
          total: sessionIds.length,
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
          results.successful.push(...response.results.map(r => r.id));
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
      total: sessionIds.length,
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
      }
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