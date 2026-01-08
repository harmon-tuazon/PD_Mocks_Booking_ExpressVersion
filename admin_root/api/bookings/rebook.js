/**
 * PATCH /api/bookings/rebook
 * Rebook a booking to a different mock exam session
 *
 * DATA FLOW:
 * 1. Read booking from Supabase (cascading lookup)
 * 2. Read target exam from Supabase
 * 3. Update booking in Supabase (PRIMARY - must succeed)
 * 4. Sync to HubSpot ONLY IF hubspot_id exists (SECONDARY - fire-and-forget)
 *
 * Note: No "reason" field - rebooking doesn't require a reason
 * Note: No HubSpot note creation - audit trail via Supabase updated_at
 *
 * @developer express-backend-architect
 * @depends-on supabase-data.js, hubspot.js, redis.js
 */

require('dotenv').config();
const Joi = require('joi');
const { requireAdmin } = require('../admin/middleware/requireAdmin');
const { supabaseAdmin } = require('../_shared/supabase');
const { getBookingCascading, getExamByIdFromSupabase } = require('../_shared/supabase-data');
const HubSpotService = require('../_shared/hubspot');
const RedisLockService = require('../_shared/redis');

// Initialize services
const hubspot = new HubSpotService();
const redis = new RedisLockService();

// Validation schema for rebooking (no reason field per PRD)
const rebookBookingSchema = Joi.object({
  booking_id: Joi.string()
    .required()
    .messages({
      'any.required': 'Booking ID is required',
      'string.base': 'Booking ID must be a string'
    }),
  new_mock_exam_id: Joi.string()
    .required()
    .messages({
      'any.required': 'New mock exam ID is required',
      'string.base': 'New mock exam ID must be a string'
    })
});

/**
 * Sync booking updates to HubSpot (fire-and-forget)
 * Only called if booking has a hubspot_id
 */
async function syncBookingToHubSpot(bookingHubSpotId, updateData) {
  try {
    console.log(`[HUBSPOT SYNC] Syncing rebook for booking ${bookingHubSpotId}`);

    // Update booking properties in HubSpot
    await hubspot.updateBooking(bookingHubSpotId, {
      associated_mock_exam: updateData.associated_mock_exam,
      exam_date: updateData.exam_date,
      start_time: updateData.start_time,
      end_time: updateData.end_time
    });

    console.log(`[HUBSPOT SYNC] Successfully synced booking ${bookingHubSpotId}`);
  } catch (error) {
    console.error(`[HUBSPOT SYNC] Failed to sync booking ${bookingHubSpotId}:`, error.message);
    // Fire-and-forget - don't throw
  }
}

/**
 * Update HubSpot booking-exam association (fire-and-forget)
 * Removes old association and creates new one
 */
async function updateHubSpotBookingExamAssociation(bookingHubSpotId, oldExamId, newExamId) {
  try {
    console.log(`[HUBSPOT ASSOC] Updating exam association for booking ${bookingHubSpotId}: ${oldExamId} -> ${newExamId}`);

    // Delete old association
    if (oldExamId) {
      try {
        await hubspot.batchDeleteAssociations('2-50158943', '2-50158913', [{
          from: { id: bookingHubSpotId },
          to: { id: oldExamId }
        }]);
      } catch (deleteError) {
        console.warn(`[HUBSPOT ASSOC] Could not delete old association:`, deleteError.message);
        // Continue - old association might not exist
      }
    }

    // Create new association
    await hubspot.createAssociation('2-50158943', bookingHubSpotId, '2-50158913', newExamId);

    console.log(`[HUBSPOT ASSOC] Successfully updated exam association`);
  } catch (error) {
    console.error(`[HUBSPOT ASSOC] Failed to update association:`, error.message);
    // Fire-and-forget - don't throw
  }
}

/**
 * Invalidate caches after rebooking (fire-and-forget)
 */
async function invalidateRebookingCaches(contactId, oldExamId, newExamId) {
  const keysToDelete = [
    // Trainee bookings cache
    `admin:trainee:${contactId}:bookings`,

    // Old exam caches
    `admin:mock-exam:${oldExamId}`,
    `admin:mock-exam:${oldExamId}:bookings`,
    `exam:${oldExamId}:bookings`,

    // New exam caches
    `admin:mock-exam:${newExamId}`,
    `admin:mock-exam:${newExamId}:bookings`,
    `exam:${newExamId}:bookings`
  ];

  console.log(`[CACHE] Invalidating ${keysToDelete.length} cache keys for rebooking`);

  await Promise.all(keysToDelete.map(key =>
    redis.cacheDelete(key).catch(err => {
      console.warn(`[CACHE] Failed to delete key ${key}:`, err.message);
    })
  ));

  // Also delete pattern-based caches
  try {
    await redis.cacheDeletePattern('admin:mock-exams:list:*');
    await redis.cacheDeletePattern('user:mock-exams:list:*');
  } catch (patternError) {
    console.warn(`[CACHE] Pattern deletion failed:`, patternError.message);
  }
}

async function handler(req, res) {
  // Only allow PATCH requests
  if (req.method !== 'PATCH') {
    return res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Only PATCH method is allowed' }
    });
  }

  try {
    // 1. Require admin authentication
    await requireAdmin(req);

    // 2. Validate request body
    const { error, value } = rebookBookingSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.details[0].message }
      });
    }

    const { booking_id, new_mock_exam_id } = value;

    console.log(`[REBOOK] Starting rebook: booking=${booking_id}, newExam=${new_mock_exam_id}`);

    // 3. Fetch existing booking FROM SUPABASE (cascading lookup: UUID -> HubSpot ID)
    const booking = await getBookingCascading(booking_id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found' }
      });
    }

    console.log(`[REBOOK] Found booking: id=${booking.id}, hubspot_id=${booking.hubspot_id}, mock_type=${booking.mock_type}`);

    // 4. Validate booking is not cancelled
    if (booking.is_active === 'Cancelled' || booking.is_active === 'cancelled') {
      return res.status(400).json({
        success: false,
        error: { code: 'BOOKING_CANCELLED', message: 'Cannot rebook a cancelled booking' }
      });
    }

    // 5. Fetch target exam FROM SUPABASE (no HubSpot fallback)
    const targetExam = await getExamByIdFromSupabase(new_mock_exam_id);
    if (!targetExam) {
      return res.status(404).json({
        success: false,
        error: { code: 'EXAM_NOT_FOUND', message: 'Target exam not found' }
      });
    }

    console.log(`[REBOOK] Found target exam: hubspot_id=${targetExam.hubspot_id}, mock_type=${targetExam.mock_type}, date=${targetExam.exam_date}`);

    // 6. Validate exam type matches
    const bookingMockType = booking.mock_exam_type || booking.mock_type;
    if (targetExam.mock_type !== bookingMockType) {
      return res.status(400).json({
        success: false,
        error: { code: 'EXAM_TYPE_MISMATCH', message: `Target exam type (${targetExam.mock_type}) must match booking type (${bookingMockType})` }
      });
    }

    // 7. Validate exam is in future
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const examDate = new Date(targetExam.exam_date);
    if (examDate < today) {
      return res.status(400).json({
        success: false,
        error: { code: 'EXAM_PAST_DATE', message: 'Target exam date must be in the future' }
      });
    }

    // 8. Validate exam is active
    if (targetExam.is_active !== 'true' && targetExam.is_active !== true) {
      return res.status(400).json({
        success: false,
        error: { code: 'EXAM_INACTIVE', message: 'Target exam is not active' }
      });
    }

    // 9. Store previous exam info for response
    const previousExam = {
      id: booking.associated_mock_exam,
      exam_date: booking.exam_date
    };

    // ============================================================
    // 10. PRIMARY WRITE: Update booking in Supabase (MUST SUCCEED)
    // ============================================================
    const updateData = {
      associated_mock_exam: targetExam.hubspot_id,
      exam_date: targetExam.exam_date,
      start_time: targetExam.start_time,
      end_time: targetExam.end_time,
      updated_at: new Date().toISOString()
    };

    console.log(`[REBOOK] Updating booking in Supabase:`, updateData);

    const { data: updatedBooking, error: updateError } = await supabaseAdmin
      .from('hubspot_bookings')
      .update(updateData)
      .eq('id', booking.id)
      .select()
      .single();

    if (updateError) {
      console.error('[REBOOK] Supabase update error:', updateError);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to update booking' }
      });
    }

    console.log(`[REBOOK] Supabase update successful`);

    // ============================================================
    // 11. SECONDARY SYNC: HubSpot (ONLY if hubspot_id exists)
    // Fire-and-forget - does NOT block response
    // ============================================================
    if (booking.hubspot_id) {
      console.log(`[REBOOK] Syncing to HubSpot for booking ${booking.hubspot_id}`);

      // Sync booking properties (fire-and-forget)
      syncBookingToHubSpot(booking.hubspot_id, {
        associated_mock_exam: targetExam.hubspot_id,
        exam_date: targetExam.exam_date,
        start_time: targetExam.start_time,
        end_time: targetExam.end_time
      }).catch(err => console.error('[REBOOK] HubSpot sync failed (non-blocking):', err.message));

      // Update HubSpot association (old exam -> new exam) (fire-and-forget)
      updateHubSpotBookingExamAssociation(
        booking.hubspot_id,
        previousExam.id,
        targetExam.hubspot_id
      ).catch(err => console.error('[REBOOK] HubSpot association update failed (non-blocking):', err.message));
    } else {
      // Supabase-only booking - no HubSpot sync needed
      console.log(`[REBOOK] Booking ${booking.id} has no hubspot_id - skipping HubSpot sync`);
    }

    // 12. Invalidate caches (fire-and-forget)
    invalidateRebookingCaches(
      booking.associated_contact_id,
      previousExam.id,
      targetExam.hubspot_id
    ).catch(err => console.error('[REBOOK] Cache invalidation failed (non-blocking):', err.message));

    // 13. Return success response
    console.log(`[REBOOK] Rebook completed successfully`);

    return res.status(200).json({
      success: true,
      data: {
        booking: {
          id: updatedBooking.id,
          hubspot_id: updatedBooking.hubspot_id,
          booking_id: updatedBooking.booking_id,
          associated_mock_exam: updatedBooking.associated_mock_exam,
          exam_date: updatedBooking.exam_date,
          start_time: updatedBooking.start_time,
          end_time: updatedBooking.end_time,
          is_active: updatedBooking.is_active
        },
        previous_exam: previousExam,
        hubspot_synced: !!booking.hubspot_id,
        message: 'Booking successfully rebooked'
      }
    });

  } catch (error) {
    console.error('[REBOOK] Error:', {
      message: error.message,
      status: error.status || 500,
      code: error.code || 'INTERNAL_ERROR'
    });

    const statusCode = error.status || 500;
    return res.status(statusCode).json({
      success: false,
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: error.message || 'Internal server error'
      }
    });
  }
}

module.exports = handler;
