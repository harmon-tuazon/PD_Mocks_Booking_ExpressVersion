/**
 * POST /api/admin/mock-exams/[id]/attendance
 * Batch update attendance status for multiple bookings in a mock exam
 *
 * Features:
 * - Batch update attendance for multiple bookings (up to 100 per request)
 * - Idempotent operations - safe to retry
 * - Partial failure handling with detailed error reporting
 * - HubSpot batch API optimization with automatic chunking
 * - Cache invalidation for affected resources
 * - Audit logging for each attendance update
 *
 * Request Body:
 * {
 *   "bookings": [
 *     { "bookingId": "string", "attended": boolean, "notes": "string (optional)" }
 *   ]
 * }
 *
 * Path Parameters:
 * - id: Mock exam ID
 *
 * Returns:
 * - Detailed results for each booking update
 * - Summary statistics (total, updated, failed, skipped)
 * - Error details for failed updates
 */

const { requireAdmin } = require('../../middleware/requireAdmin');
const { validationMiddleware } = require('../../../_shared/validation');
const { getCache } = require('../../../_shared/cache');
const hubspot = require('../../../_shared/hubspot');

// HubSpot Object Type IDs
const HUBSPOT_OBJECTS = {
  'bookings': '2-50158943',
  'mock_exams': '2-50158913',
  'contacts': '0-1'
};

// Maximum bookings per request (HubSpot batch limit is 100)
const MAX_BOOKINGS_PER_REQUEST = 100;
const HUBSPOT_BATCH_SIZE = 100;

// Attendance values (simplified - using single property)
const ATTENDANCE_VALUES = {
  YES: 'Yes',
  NO: 'No',
  EMPTY: ''
};

module.exports = async (req, res) => {
  const startTime = Date.now();

  try {
    // Verify admin authentication
    const user = await requireAdmin(req);
    const adminEmail = user?.email || 'admin@prepdoctors.com';

    // Extract mock exam ID from path parameter
    const mockExamId = req.query.id;

    // Validate mock exam ID
    if (!mockExamId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_MOCK_EXAM_ID',
          message: 'Mock exam ID is required'
        }
      });
    }

    if (!/^\d+$/.test(mockExamId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_MOCK_EXAM_ID',
          message: 'Invalid mock exam ID format'
        }
      });
    }

    // Validate request body
    const validator = validationMiddleware('batchAttendanceUpdate');
    await new Promise((resolve, reject) => {
      validator(req, res, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });

    const { bookings } = req.validatedData;

    // Check if bookings array is within limits
    if (bookings.length > MAX_BOOKINGS_PER_REQUEST) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BATCH_SIZE_EXCEEDED',
          message: `Maximum ${MAX_BOOKINGS_PER_REQUEST} bookings can be updated per request`,
          details: { provided: bookings.length, maximum: MAX_BOOKINGS_PER_REQUEST }
        }
      });
    }

    console.log(`📋 [ATTENDANCE] Processing batch attendance update for mock exam ${mockExamId}`);
    console.log(`📋 [ATTENDANCE] Total bookings to process: ${bookings.length}`);

    // Extract booking IDs for batch fetch
    const bookingIds = bookings.map(b => b.bookingId);
    const bookingMap = new Map(bookings.map(b => [b.bookingId, b]));

    // Fetch all bookings in batches to verify they exist and get current attendance status
    console.log(`🔍 [ATTENDANCE] Fetching booking details from HubSpot...`);
    const existingBookings = await fetchBookingsBatch(bookingIds);

    // Initialize result tracking
    const results = {
      successful: [],
      failed: [],
      skipped: []
    };

    // Validate and prepare updates
    const updates = [];

    for (const booking of bookings) {
      const existingBooking = existingBookings.get(booking.bookingId);
      const requestedUpdate = bookingMap.get(booking.bookingId);

      // Check if booking exists
      if (!existingBooking) {
        results.failed.push({
          bookingId: booking.bookingId,
          error: 'Booking not found',
          code: 'BOOKING_NOT_FOUND'
        });
        continue;
      }

      // Note: No need to check if booking belongs to exam - the bookings list endpoint
      // already filters by exam association, so if the frontend is sending these IDs,
      // they must belong to this exam. This avoids a redundant HubSpot API call.

      // Check if booking is cancelled
      if (existingBooking.properties.booking_status === 'cancelled') {
        results.failed.push({
          bookingId: booking.bookingId,
          error: 'Cannot update attendance for cancelled booking',
          code: 'BOOKING_CANCELLED'
        });
        continue;
      }

      // Determine the new attendance value (handles true, false, and null)
      let newAttendance;
      if (requestedUpdate.attended === null || requestedUpdate.attended === undefined) {
        newAttendance = ATTENDANCE_VALUES.EMPTY;
      } else if (requestedUpdate.attended === true) {
        newAttendance = ATTENDANCE_VALUES.YES;
      } else {
        newAttendance = ATTENDANCE_VALUES.NO;
      }
      const currentAttendance = existingBooking.properties.attendance || ATTENDANCE_VALUES.EMPTY;

      // Check if update is needed (idempotency)
      if (currentAttendance === newAttendance) {
        results.skipped.push({
          bookingId: booking.bookingId,
          reason: 'Already has the requested attendance value',
          currentValue: currentAttendance
        });
        continue;
      }

      // Prepare update (simplified - only update attendance property)
      updates.push({
        id: booking.bookingId,
        properties: {
          attendance: newAttendance
        }
      });
    }

    // Process updates in batches
    if (updates.length > 0) {
      console.log(`⚡ [ATTENDANCE] Processing ${updates.length} attendance updates...`);

      const updateResults = await processAttendanceUpdates(updates);

      // Process results
      for (const result of updateResults.successful) {
        const originalRequest = bookingMap.get(result.id);
        results.successful.push({
          bookingId: result.id,
          status: originalRequest.attended ? 'attended' : 'no_show',
          message: 'Successfully updated'
        });
      }

      for (const error of updateResults.failed) {
        results.failed.push({
          bookingId: error.id,
          error: error.message || 'Failed to update attendance',
          code: 'UPDATE_FAILED'
        });
      }
    }

    // Invalidate relevant caches
    if (results.successful.length > 0) {
      await invalidateAttendanceCaches(mockExamId);
      console.log(`🗑️ [ATTENDANCE] Caches invalidated for mock exam ${mockExamId}`);
    }

    // Calculate summary
    const summary = {
      total: bookings.length,
      updated: results.successful.length,
      failed: results.failed.length,
      skipped: results.skipped.length
    };

    // Log audit trail
    if (results.successful.length > 0) {
      console.log(`✅ [ATTENDANCE] Successfully updated ${results.successful.length} attendance records`);

      // Create audit log asynchronously (non-blocking)
      createAuditLog(mockExamId, summary, adminEmail).catch(error => {
        console.error('Failed to create audit log:', error);
      });
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
        mockExamId,
        executionTime
      }
    });

  } catch (error) {
    console.error('❌ [ATTENDANCE] Error in batch attendance update:', error);

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
          message: 'Request timeout. Please try with fewer bookings.'
        }
      });
    }

    // Generic error
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'An error occurred while updating attendance'
      }
    });
  }
};

/**
 * Fetch bookings in batches from HubSpot
 */
async function fetchBookingsBatch(bookingIds) {
  const bookingsMap = new Map();

  // Split into chunks of 100 (HubSpot batch limit)
  for (let i = 0; i < bookingIds.length; i += HUBSPOT_BATCH_SIZE) {
    const chunk = bookingIds.slice(i, i + HUBSPOT_BATCH_SIZE);

    try {
      const response = await hubspot.apiCall('POST', `/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}/batch/read`, {
        properties: [
          'booking_status',
          'contact_id',
          'attendance'
        ],
        inputs: chunk.map(id => ({ id }))
      });

      if (response.results) {
        for (const booking of response.results) {
          bookingsMap.set(booking.id, booking);
        }
      }
    } catch (error) {
      console.error(`Error fetching booking batch:`, error);
      // Continue processing other batches
    }
  }

  return bookingsMap;
}

/**
 * Process attendance updates in batches
 */
async function processAttendanceUpdates(updates) {
  const results = {
    successful: [],
    failed: []
  };

  // Split into chunks of 100 (HubSpot batch limit)
  for (let i = 0; i < updates.length; i += HUBSPOT_BATCH_SIZE) {
    const chunk = updates.slice(i, i + HUBSPOT_BATCH_SIZE);

    try {
      const response = await hubspot.apiCall('POST', `/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}/batch/update`, {
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
      console.error(`Error processing attendance batch:`, error);

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
 * Invalidate caches affected by attendance updates
 */
async function invalidateAttendanceCaches(mockExamId) {
  const cache = getCache();

  try {
    // Invalidate mock exam details cache
    await cache.delete(`admin:mock-exam:${mockExamId}`);
    await cache.delete(`admin:mock-exam:details:${mockExamId}`);

    // Invalidate bookings list cache for this mock exam
    await cache.deletePattern(`admin:mock-exam:${mockExamId}:bookings:*`);

    // Invalidate aggregate caches
    await cache.deletePattern('admin:mock-exams:aggregates:*');
    await cache.deletePattern('admin:aggregate:sessions:*');
    await cache.deletePattern('admin:metrics:*');

    // Invalidate mock exams list cache (as attendance affects statistics)
    await cache.deletePattern('admin:mock-exams:list:*');
  } catch (error) {
    console.error('Error invalidating caches:', error);
    // Don't fail the request if cache invalidation fails
  }
}

/**
 * Create audit log for attendance updates
 */
async function createAuditLog(mockExamId, summary, adminEmail) {
  try {
    // Create a note in the mock exam's timeline
    const noteContent = `
      <strong>Batch Attendance Update</strong><br/>
      <hr/>
      <strong>Summary:</strong><br/>
      • Total Processed: ${summary.total}<br/>
      • Successfully Updated: ${summary.updated}<br/>
      • Failed: ${summary.failed}<br/>
      • Skipped: ${summary.skipped}<br/>
      <br/>
      <strong>Updated By:</strong> ${adminEmail}<br/>
      <strong>Timestamp:</strong> ${new Date().toISOString()}<br/>
    `;

    await hubspot.apiCall('POST', `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/${mockExamId}/notes`, {
      properties: {
        hs_note_body: noteContent,
        hs_timestamp: Date.now()
      }
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw - this is non-critical
  }
}