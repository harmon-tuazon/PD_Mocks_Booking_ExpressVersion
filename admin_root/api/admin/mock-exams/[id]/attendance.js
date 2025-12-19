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

const { requirePermission } = require('../../middleware/requirePermission');
const { validationMiddleware } = require('../../../_shared/validation');
const { getCache } = require('../../../_shared/cache');
const hubspot = require('../../../_shared/hubspot');
const { supabaseAdmin } = require('../../../_shared/supabase');
const { getBookingCascading } = require('../../../_shared/supabase-data');

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
    // Verify admin authentication and permission
    const user = await requirePermission(req, 'bookings.cancel');
    const adminEmail = user?.email || 'admin@prepdoctors.com';

    // Extract ID from query params (Vercel provides dynamic route params via req.query)
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

    // Step 1: Resolve HubSpot IDs using cascading lookup
    // Some bookings may only exist in Supabase (hubspot_id is null)
    console.log(`🔍 [ATTENDANCE] Resolving booking IDs via cascading lookup...`);

    const resolvedBookings = [];
    const supabaseOnlyBookings = []; // Bookings without HubSpot IDs

    for (const booking of bookings) {
      // Try to get hubspot_id from the request first
      let hubspotId = booking.hubspot_id;
      let supabaseRecord = null;

      // If no hubspot_id provided, use cascading lookup
      if (!hubspotId) {
        // Use the bookingId (could be UUID or HubSpot ID) for lookup
        const identifier = booking.id || booking.bookingId;
        supabaseRecord = await getBookingCascading(identifier);

        if (supabaseRecord) {
          hubspotId = supabaseRecord.hubspot_id;
          console.log(`  ✓ Resolved ${identifier} → hubspot_id: ${hubspotId || 'NULL (Supabase-only)'}`);
        } else {
          console.warn(`  ⚠ Could not find booking with identifier: ${identifier}`);
        }
      }

      if (hubspotId) {
        // Has HubSpot ID - will update HubSpot + Supabase
        resolvedBookings.push({
          ...booking,
          hubspot_id: hubspotId,
          supabaseRecord
        });
      } else if (supabaseRecord) {
        // Supabase-only booking - will update Supabase directly
        supabaseOnlyBookings.push({
          ...booking,
          supabaseRecord
        });
      } else {
        // Could not find booking at all - will be marked as failed later
        resolvedBookings.push({
          ...booking,
          hubspot_id: null,
          notFound: true
        });
      }
    }

    console.log(`📊 [ATTENDANCE] Resolved: ${resolvedBookings.length} with HubSpot ID, ${supabaseOnlyBookings.length} Supabase-only`);

    // Build booking map using hubspot_id for HubSpot lookups
    const bookingIds = resolvedBookings.filter(b => b.hubspot_id).map(b => b.hubspot_id);
    const bookingMap = new Map(resolvedBookings.map(b => [b.hubspot_id || b.bookingId, b]));

    // Fetch all bookings in batches from HubSpot to verify they exist and get current attendance status
    console.log(`🔍 [ATTENDANCE] Fetching booking details from HubSpot for ${bookingIds.length} bookings...`);
    const existingBookings = bookingIds.length > 0 ? await fetchBookingsBatch(bookingIds) : new Map();

    // Initialize result tracking
    const results = {
      successful: [],
      failed: [],
      skipped: []
    };

    // Validate and prepare updates for HubSpot-synced bookings
    const hubspotUpdates = [];
    const supabaseDirectUpdates = []; // For Supabase-only bookings

    // Process resolved bookings (those with HubSpot IDs)
    for (const booking of resolvedBookings) {
      // Handle bookings that couldn't be found
      if (booking.notFound) {
        results.failed.push({
          bookingId: booking.bookingId,
          error: 'Booking not found in Supabase or HubSpot',
          code: 'BOOKING_NOT_FOUND'
        });
        continue;
      }

      const existingBooking = existingBookings.get(booking.hubspot_id);

      // Check if booking exists in HubSpot
      if (!existingBooking) {
        results.failed.push({
          bookingId: booking.bookingId,
          hubspot_id: booking.hubspot_id,
          error: 'Booking not found in HubSpot',
          code: 'BOOKING_NOT_FOUND'
        });
        continue;
      }

      // Check if booking is cancelled
      if (existingBooking.properties.is_active === 'Cancelled') {
        results.failed.push({
          bookingId: booking.bookingId,
          error: 'Cannot update attendance for cancelled booking',
          code: 'BOOKING_CANCELLED'
        });
        continue;
      }

      // Determine the new attendance value (handles true, false, and null)
      let newAttendance;
      if (booking.attended === null || booking.attended === undefined) {
        newAttendance = ATTENDANCE_VALUES.EMPTY;
      } else if (booking.attended === true) {
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

      // Prepare update - attendance and is_active
      const properties = {
        attendance: newAttendance
      };

      // Set is_active based on attendance status
      if (newAttendance === ATTENDANCE_VALUES.YES || newAttendance === ATTENDANCE_VALUES.NO) {
        properties.is_active = 'Completed';
      } else if (newAttendance === ATTENDANCE_VALUES.EMPTY) {
        properties.is_active = 'Active';
      }

      hubspotUpdates.push({
        id: booking.hubspot_id,  // Use resolved HubSpot ID
        originalBookingId: booking.bookingId,
        supabaseId: booking.supabaseRecord?.id || booking.id,
        attended: booking.attended,
        properties
      });
    }

    // Process Supabase-only bookings (no HubSpot ID)
    for (const booking of supabaseOnlyBookings) {
      const supabaseRecord = booking.supabaseRecord;

      // Check if booking is cancelled
      if (supabaseRecord.is_active === 'Cancelled') {
        results.failed.push({
          bookingId: booking.bookingId,
          error: 'Cannot update attendance for cancelled booking',
          code: 'BOOKING_CANCELLED'
        });
        continue;
      }

      // Determine the new attendance value
      let newAttendance;
      if (booking.attended === null || booking.attended === undefined) {
        newAttendance = ATTENDANCE_VALUES.EMPTY;
      } else if (booking.attended === true) {
        newAttendance = ATTENDANCE_VALUES.YES;
      } else {
        newAttendance = ATTENDANCE_VALUES.NO;
      }
      const currentAttendance = supabaseRecord.attendance || ATTENDANCE_VALUES.EMPTY;

      // Check if update is needed (idempotency)
      if (currentAttendance === newAttendance) {
        results.skipped.push({
          bookingId: booking.bookingId,
          reason: 'Already has the requested attendance value',
          currentValue: currentAttendance
        });
        continue;
      }

      // Determine is_active based on attendance
      let isActive;
      if (newAttendance === ATTENDANCE_VALUES.YES || newAttendance === ATTENDANCE_VALUES.NO) {
        isActive = 'Completed';
      } else {
        isActive = 'Active';
      }

      supabaseDirectUpdates.push({
        supabaseId: supabaseRecord.id,
        originalBookingId: booking.bookingId,
        attended: booking.attended,
        newAttendance,
        isActive
      });
    }

    // Legacy variable for backward compatibility
    const updates = hubspotUpdates;

    // Process HubSpot updates in batches
    if (hubspotUpdates.length > 0) {
      console.log(`⚡ [ATTENDANCE] Processing ${hubspotUpdates.length} HubSpot attendance updates...`);

      const updateResults = await processAttendanceUpdates(hubspotUpdates);

      // Process results - map HubSpot IDs back to original booking IDs
      for (const result of updateResults.successful) {
        // Find the original update request by HubSpot ID
        const originalUpdate = hubspotUpdates.find(u => u.id === result.id);
        results.successful.push({
          bookingId: originalUpdate?.originalBookingId || result.id,
          hubspot_id: result.id,
          supabaseId: originalUpdate?.supabaseId,
          status: originalUpdate?.attended ? 'attended' : 'no_show',
          message: 'Successfully updated in HubSpot'
        });
      }

      for (const error of updateResults.failed) {
        const originalUpdate = hubspotUpdates.find(u => u.id === error.id);
        results.failed.push({
          bookingId: originalUpdate?.originalBookingId || error.id,
          hubspot_id: error.id,
          error: error.message || 'Failed to update attendance in HubSpot',
          code: 'UPDATE_FAILED'
        });
      }
    }

    // Process Supabase-only updates directly
    if (supabaseDirectUpdates.length > 0) {
      console.log(`⚡ [ATTENDANCE] Processing ${supabaseDirectUpdates.length} Supabase-only attendance updates...`);

      for (const update of supabaseDirectUpdates) {
        try {
          const { error } = await supabaseAdmin
            .from('hubspot_bookings')
            .update({
              attendance: update.newAttendance,
              is_active: update.isActive,
              updated_at: new Date().toISOString(),
              synced_at: new Date().toISOString()
            })
            .eq('id', update.supabaseId);

          if (error) {
            results.failed.push({
              bookingId: update.originalBookingId,
              supabaseId: update.supabaseId,
              error: error.message || 'Failed to update attendance in Supabase',
              code: 'SUPABASE_UPDATE_FAILED'
            });
          } else {
            results.successful.push({
              bookingId: update.originalBookingId,
              supabaseId: update.supabaseId,
              status: update.attended ? 'attended' : 'no_show',
              message: 'Successfully updated in Supabase (no HubSpot sync needed)'
            });
          }
        } catch (err) {
          results.failed.push({
            bookingId: update.originalBookingId,
            supabaseId: update.supabaseId,
            error: err.message || 'Unexpected error updating Supabase',
            code: 'SUPABASE_UPDATE_FAILED'
          });
        }
      }
    }

    // Invalidate relevant caches
    if (results.successful.length > 0) {
      await invalidateAttendanceCaches(mockExamId);
      console.log(`🗑️ [ATTENDANCE] Caches invalidated for mock exam ${mockExamId}`);
    }

    // Sync HubSpot-updated bookings to Supabase
    // Note: Supabase-only bookings were already updated directly in the processing section
    let supabaseSynced = false;
    const hubspotSuccessful = results.successful.filter(r => r.hubspot_id);

    if (hubspotSuccessful.length > 0) {
      try {
        console.log(`🔄 [ATTENDANCE] Syncing ${hubspotSuccessful.length} HubSpot updates to Supabase...`);

        const supabaseSyncPromises = hubspotSuccessful.map(result => {
          // Determine attendance value from status
          let newAttendance;
          if (result.status === 'attended') {
            newAttendance = 'Yes';
          } else if (result.status === 'no_show') {
            newAttendance = 'No';
          } else {
            newAttendance = '';
          }

          // Determine is_active based on attendance
          const isActive = (newAttendance === 'Yes' || newAttendance === 'No') ? 'Completed' : 'Active';

          // Prefer Supabase UUID for lookup, fallback to HubSpot ID
          if (result.supabaseId) {
            return supabaseAdmin
              .from('hubspot_bookings')
              .update({
                attendance: newAttendance,
                is_active: isActive,
                updated_at: new Date().toISOString(),
                synced_at: new Date().toISOString()
              })
              .eq('id', result.supabaseId);
          } else {
            return supabaseAdmin
              .from('hubspot_bookings')
              .update({
                attendance: newAttendance,
                is_active: isActive,
                updated_at: new Date().toISOString(),
                synced_at: new Date().toISOString()
              })
              .eq('hubspot_id', result.hubspot_id);
          }
        });

        const supabaseResults = await Promise.allSettled(supabaseSyncPromises);
        const syncedCount = supabaseResults.filter(r => r.status === 'fulfilled').length;
        console.log(`✅ [ATTENDANCE] Synced ${syncedCount}/${hubspotSuccessful.length} HubSpot updates to Supabase`);

        // Consider synced if all HubSpot updates + Supabase-only updates succeeded
        const supabaseOnlyCount = results.successful.filter(r => !r.hubspot_id).length;
        supabaseSynced = (syncedCount + supabaseOnlyCount) === results.successful.length;
      } catch (supabaseError) {
        console.error('❌ Supabase attendance sync failed:', supabaseError.message);
        // Continue - HubSpot is source of truth for HubSpot-synced bookings
      }
    } else {
      // All successful updates were Supabase-only
      supabaseSynced = true;
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
      },
      supabase_synced: supabaseSynced
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
          'contact_id',
          'attendance',
          'is_active'
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