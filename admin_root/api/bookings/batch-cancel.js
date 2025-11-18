/**
 * POST /api/bookings/batch-cancel - Admin batch cancel multiple bookings
 *
 * Admin-authenticated endpoint for batch cancelling bookings from trainee dashboard
 *
 * Request Body:
 * {
 *   bookings: [
 *     {
 *       id: string,           // Booking HubSpot ID
 *       student_id: string,   // For reference only
 *       email: string,        // For reference only
 *       reason?: string       // Optional cancellation reason
 *     }
 *   ]
 * }
 *
 * Returns:
 * - 200: Batch operation completed (may include partial success)
 * - 400: Invalid request or all operations failed
 * - 401: Unauthorized (admin auth required)
 * - 405: Method not allowed
 * - 500: Server error
 */

// Import shared utilities
require('dotenv').config();
const Joi = require('joi');
const { HubSpotService, HUBSPOT_OBJECTS } = require('../_shared/hubspot');
const { requireAdmin } = require('../admin/middleware/requireAdmin');
const RedisLockService = require('../_shared/redis');

// Validation schema for batch cancellation
const batchCancelSchema = Joi.object({
  bookings: Joi.array()
    .items(
      Joi.object({
        id: Joi.string()
          .required()
          .messages({
            'any.required': 'Booking ID is required',
            'string.base': 'Booking ID must be a string'
          }),
        student_id: Joi.string()
          .optional()
          .allow(''),
        email: Joi.string()
          .email()
          .optional()
          .allow(''),
        reason: Joi.string()
          .max(500)
          .optional()
          .allow('')
          .messages({
            'string.max': 'Cancellation reason cannot exceed 500 characters'
          })
      })
    )
    .min(1)
    .max(50)
    .required()
    .messages({
      'array.min': 'At least one booking is required',
      'array.max': 'Cannot cancel more than 50 bookings at once',
      'any.required': 'Bookings array is required'
    })
});

/**
 * Process single booking cancellation (admin version - no authentication per booking)
 */
async function cancelSingleBooking(hubspot, bookingData, redis) {
  const { id: bookingId, reason } = bookingData;
  const result = {
    booking_id: bookingId,
    success: false,
    error: null,
    actions_completed: {
      soft_delete: false,
      note_created: false,
      bookings_decremented: false,
      credits_restored: false,
      redis_cache_cleared: false
    }
  };

  try {
    console.log(`🗑️ [Admin] Processing cancellation for booking ${bookingId}`);

    // Step 1: Get comprehensive booking data with associations
    let booking;
    try {
      booking = await hubspot.getBookingWithAssociations(bookingId);
    } catch (error) {
      console.error(`❌ Booking not found: ${bookingId}`);
      result.error = 'Booking not found';
      result.error_code = 'BOOKING_NOT_FOUND';
      return result;
    }

    // Normalize booking data structure
    const bookingDataObj = booking.data || booking;
    const bookingProperties = bookingDataObj.properties || {};

    // Step 2: Check if already cancelled
    const currentStatus = bookingProperties.status;
    const isActive = bookingProperties.is_active;

    if (currentStatus === 'canceled' || currentStatus === 'cancelled' ||
        isActive === 'Cancelled' || isActive === 'cancelled' ||
        isActive === false || isActive === 'false') {
      console.log(`⚠️ Booking ${bookingId} already cancelled`);
      result.error = 'Booking is already cancelled';
      result.error_code = 'ALREADY_CANCELED';
      return result;
    }

    // Step 3: Get associated Contact ID
    let contactId = null;
    let contact = null;
    const contactAssociations = booking.associations?.[HUBSPOT_OBJECTS.contacts]?.results || [];

    if (contactAssociations.length > 0) {
      contactId = contactAssociations[0].id || contactAssociations[0].toObjectId;
      console.log(`📞 Found Contact association: ${contactId}`);

      try {
        const contactResponse = await hubspot.apiCall('GET', `/crm/v3/objects/contacts/${contactId}`, null, {
          properties: ['firstname', 'lastname', 'email', 'sj_credits', 'cs_credits', 'sjmini_credits', 'shared_mock_credits']
        });
        contact = contactResponse;
      } catch (contactError) {
        console.warn(`⚠️ Failed to fetch Contact details: ${contactError.message}`);
      }
    }

    // Fallback: Use associated_contact_id from frontend if association lookup failed
    if (!contactId && bookingData.associated_contact_id) {
      contactId = bookingData.associated_contact_id;
      console.log(`📞 Using Contact ID from frontend data: ${contactId}`);

      // Try to fetch contact details with fallback ID
      try {
        const contactResponse = await hubspot.apiCall('GET', `/crm/v3/objects/contacts/${contactId}`, null, {
          properties: ['firstname', 'lastname', 'email', 'sj_credits', 'cs_credits', 'sjmini_credits', 'shared_mock_credits']
        });
        contact = contactResponse;
      } catch (contactError) {
        console.warn(`⚠️ Failed to fetch Contact details with fallback ID: ${contactError.message}`);
      }
    }

    // Step 4: Get Mock Exam details if associated
    let mockExamId = null;
    let mockExamDetails = null;

    const mockExamAssociations = booking.associations?.[HUBSPOT_OBJECTS.mock_exams]?.results || [];
    if (mockExamAssociations.length > 0) {
      mockExamId = mockExamAssociations[0].id || mockExamAssociations[0].toObjectId;
      console.log(`📚 Found Mock Exam association: ${mockExamId}`);

      try {
        const mockExamResponse = await hubspot.getMockExam(mockExamId);
        if (mockExamResponse?.data) {
          mockExamDetails = mockExamResponse.data.properties;
        }
      } catch (examError) {
        console.warn(`⚠️ Failed to fetch Mock Exam details: ${examError.message}`);
      }
    }

    // Step 5: Prepare cancellation data for note
    const cancellationData = {
      booking_id: bookingProperties.booking_id || bookingDataObj.id,
      mock_type: mockExamDetails?.mock_type || bookingProperties.mock_type || 'Mock Exam',
      exam_date: mockExamDetails?.exam_date || bookingProperties.exam_date,
      location: mockExamDetails?.location || bookingProperties.location || 'Location TBD',
      name: bookingProperties.name || (contact?.properties ? `${contact.properties.firstname} ${contact.properties.lastname}` : 'N/A'),
      email: bookingProperties.email || contact?.properties?.email,
      reason: reason || 'Admin cancelled from trainee dashboard',
      token_used: bookingProperties.token_used || 'Not specified'
    };

    // Step 6: Create cancellation note on Contact timeline
    let noteCreated = false;
    if (contactId) {
      try {
        await hubspot.createBookingCancellationNote(contactId, cancellationData);
        console.log(`✅ Cancellation note created for Contact ${contactId}`);
        noteCreated = true;
        result.actions_completed.note_created = true;
      } catch (noteError) {
        console.error(`❌ Failed to create cancellation note: ${noteError.message}`);
      }
    }

    // Step 7: Decrement Mock Exam total_bookings if associated
    let bookingsDecremented = false;
    if (mockExamId) {
      try {
        const currentTotal = parseInt(mockExamDetails?.total_bookings) || 0;

        if (currentTotal > 0) {
          const newTotal = currentTotal - 1;
          await hubspot.updateMockExamBookings(mockExamId, newTotal);
          console.log(`✅ Decremented Mock Exam ${mockExamId} total_bookings from ${currentTotal} to ${newTotal}`);
          bookingsDecremented = true;
          result.actions_completed.bookings_decremented = true;
        } else {
          console.log(`⚠️ Mock Exam ${mockExamId} total_bookings is already 0, skipping decrement`);
        }
      } catch (decrementError) {
        console.error(`❌ Failed to decrement Mock Exam total_bookings: ${decrementError.message}`);
      }
    }

    // Step 8: Restore credits to contact
    let creditsRestored = null;
    const tokenUsed = bookingProperties.token_used;

    if (contactId && contact && tokenUsed) {
      try {
        console.log(`💳 Restoring credits for cancelled booking ${bookingId}`);

        const currentCredits = {
          sj_credits: parseInt(contact.properties?.sj_credits) || 0,
          cs_credits: parseInt(contact.properties?.cs_credits) || 0,
          sjmini_credits: parseInt(contact.properties?.sjmini_credits) || 0,
          shared_mock_credits: parseInt(contact.properties?.shared_mock_credits) || 0
        };

        creditsRestored = await hubspot.restoreCredits(contactId, tokenUsed, currentCredits);
        console.log(`✅ Credits restored successfully for booking ${bookingId}`);
        result.actions_completed.credits_restored = true;
        result.credit_restoration = creditsRestored;
      } catch (creditError) {
        console.error(`❌ Failed to restore credits: ${creditError.message}`);
      }
    } else {
      console.warn(`⚠️ Cannot restore credits: missing contactId or tokenUsed property`);
    }

    // Step 9: Perform soft delete (mark as cancelled)
    try {
      await hubspot.softDeleteBooking(bookingId);
      console.log(`✅ Booking ${bookingId} marked as cancelled`);
      result.actions_completed.soft_delete = true;
    } catch (deleteError) {
      console.error(`❌ Failed to soft delete booking: ${deleteError}`);
      result.error = 'Failed to cancel booking';
      result.error_code = 'SOFT_DELETE_FAILED';
      return result;
    }

    // Step 10: Clear Redis duplicate detection cache (ENHANCED LOGGING)
    console.log(`🔍 [REDIS DEBUG] Starting cache invalidation for booking ${bookingId}`);
    console.log(`🔍 [REDIS DEBUG] - Redis instance exists: ${!!redis}`);
    console.log(`🔍 [REDIS DEBUG] - contactId: ${contactId}`);
    console.log(`🔍 [REDIS DEBUG] - exam_date: ${cancellationData.exam_date}`);
    console.log(`🔍 [REDIS DEBUG] - mockExamId: ${mockExamId}`);

    if (redis && contactId && cancellationData.exam_date) {
      try {
        const redisKey = `booking:${contactId}:${cancellationData.exam_date}`;
        console.log(`🔍 [REDIS DEBUG] Attempting to delete cache key: "${redisKey}"`);

        // Check if key exists before deletion
        const keyExistsBefore = await redis.get(redisKey);
        console.log(`🔍 [REDIS DEBUG] Cache key exists before deletion: ${keyExistsBefore !== null} (value: ${keyExistsBefore})`);

        // Delete the cache key
        const deletedCount = await redis.del(redisKey);
        console.log(`🔍 [REDIS DEBUG] redis.del() returned: ${deletedCount} (1 = deleted, 0 = key didn't exist)`);

        // Verify deletion
        const keyExistsAfter = await redis.get(redisKey);
        console.log(`🔍 [REDIS DEBUG] Cache key exists after deletion: ${keyExistsAfter !== null} (should be false)`);

        if (keyExistsAfter === null) {
          console.log(`✅ [REDIS] Successfully cleared duplicate detection cache for contact ${contactId} on ${cancellationData.exam_date}`);
        } else {
          console.error(`❌ [REDIS] CRITICAL: Cache key still exists after deletion! Value: ${keyExistsAfter}`);
        }

        // Decrement exam booking counter
        if (mockExamId) {
          const counterKey = `exam:${mockExamId}:bookings`;
          const counterBefore = await redis.get(counterKey);
          console.log(`🔍 [REDIS DEBUG] Counter before decrement: ${counterBefore}`);

          const newCount = await redis.decr(counterKey);
          console.log(`🔍 [REDIS DEBUG] Counter after decrement: ${newCount}`);
          console.log(`✅ [REDIS] Decremented exam counter for ${mockExamId}: ${counterBefore} → ${newCount}`);
        }

        result.actions_completed.redis_cache_cleared = true;
      } catch (redisError) {
        console.error(`❌ [REDIS] Cache clearing FAILED:`, {
          error: redisError.message,
          stack: redisError.stack,
          contactId,
          exam_date: cancellationData.exam_date,
          mockExamId
        });
      }
    } else {
      console.warn(`⚠️ [REDIS] Cannot clear cache - missing required data:`, {
        hasRedis: !!redis,
        hasContactId: !!contactId,
        hasExamDate: !!cancellationData.exam_date
      });
    }

    // Success!
    result.success = true;
    result.status = 'cancelled';
    result.cancelled_at = new Date().toISOString();

    console.log(`✅ [Admin] Booking ${bookingId} cancellation completed successfully`);
    return result;

  } catch (error) {
    console.error(`❌ Error cancelling booking ${bookingId}:`, error.message);
    result.error = error.message || 'Internal server error';
    result.error_code = error.code || 'INTERNAL_ERROR';
    return result;
  }
}

/**
 * Main handler for admin batch cancellation
 */
async function handler(req, res) {
  console.log('🔍 [ADMIN HANDLER] Batch cancel API called:', {
    method: req.method,
    url: req.url
  });

  try {
    // Admin authentication required
    await requireAdmin(req);
    console.log('✅ Admin authentication successful');

    // Only allow POST method
    if (req.method !== 'POST') {
      return res.status(405).json({
        success: false,
        error: {
          code: 'METHOD_NOT_ALLOWED',
          message: 'Method not allowed'
        }
      });
    }

    // Validate input using Joi schema
    const { error, value: validatedData } = batchCancelSchema.validate(req.body);
    if (error) {
      console.error('❌ [VALIDATION ERROR]:', {
        error: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value
        }))
      });
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid input: ${error.details.map(detail => detail.message).join(', ')}`
        }
      });
    }

    console.log(`✅ [VALIDATION SUCCESS] Processing ${validatedData.bookings.length} booking(s)`);

    // Initialize HubSpot service and Redis
    const hubspot = new HubSpotService();
    const redis = new RedisLockService();

    // Process each booking cancellation
    const results = [];
    let successCount = 0;
    let failedCount = 0;

    for (const booking of validatedData.bookings) {
      const result = await cancelSingleBooking(hubspot, booking, redis);

      if (result.success) {
        successCount++;
      } else {
        failedCount++;
      }

      results.push(result);
    }

    // Prepare response summary
    const summary = {
      total: validatedData.bookings.length,
      successful: successCount,
      failed: failedCount
    };

    console.log(`📊 [Admin] Batch cancellation summary:`, summary);

    // Determine response status based on results
    let statusCode = 200;
    let message = 'Batch cancellation completed';

    if (failedCount === validatedData.bookings.length) {
      // All failed
      statusCode = 400;
      message = 'All booking cancellations failed';
    } else if (failedCount > 0) {
      // Partial success
      message = `Batch cancellation completed with ${failedCount} failure(s)`;
    } else {
      // All succeeded
      message = 'All bookings cancelled successfully';
    }

    // Return response
    return res.status(statusCode).json({
      success: true,
      data: {
        summary,
        results
      },
      message
    });

  } catch (error) {
    console.error('❌ [Admin] Batch cancellation error:', {
      message: error.message,
      status: error.status || 500,
      code: error.code || 'INTERNAL_ERROR',
      stack: error.stack
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
