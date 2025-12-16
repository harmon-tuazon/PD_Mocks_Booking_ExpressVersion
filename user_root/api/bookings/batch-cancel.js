/**
 * POST /api/bookings/batch-cancel - Batch cancel multiple bookings
 *
 * Request Body:
 * {
 *   bookings: [
 *     {
 *       id: string,           // Booking HubSpot ID
 *       student_id: string,   // For authentication
 *       email: string,        // For authentication
 *       reason?: string       // Optional cancellation reason
 *     }
 *   ]
 * }
 *
 * Returns:
 * - 200: Batch operation completed (may include partial success)
 * - 400: Invalid request or all operations failed
 * - 405: Method not allowed
 * - 500: Server error
 */

// Import shared utilities
require('dotenv').config();
const Joi = require('joi');
const { HubSpotService, HUBSPOT_OBJECTS } = require('../_shared/hubspot');
const RedisLockService = require('../_shared/redis');
const { updateBookingStatusInSupabase, updateExamBookingCountInSupabase, updateContactCreditsInSupabase } = require('../_shared/supabase-data');
const {
  setCorsHeaders,
  handleOptionsRequest,
  createErrorResponse,
  createSuccessResponse,
  verifyEnvironmentVariables,
  rateLimitMiddleware,
  sanitizeInput
} = require('../_shared/auth');

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
          .pattern(/^[A-Z0-9]+$/)
          .required()
          .messages({
            'string.pattern.base': 'Student ID must contain only uppercase letters and numbers',
            'any.required': 'Student ID is required'
          }),
        email: Joi.string()
          .email()
          .required()
          .messages({
            'string.email': 'Please enter a valid email address',
            'any.required': 'Email is required'
          }),
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
 * Process single booking cancellation
 * Extracted from the existing DELETE /api/bookings/[id] endpoint
 */
async function cancelSingleBooking(hubspot, bookingData) {
  const { id: bookingId, student_id, email, reason } = bookingData;
  const result = {
    booking_id: bookingId,
    success: false,
    error: null,
    actions_completed: {
      soft_delete: false,
      note_created: false,
      bookings_decremented: false,
      credits_restored: false,
      cache_invalidated: false
    }
  };

  try {
    console.log(`🗑️ Processing cancellation for booking ${bookingId}`);

    // Step 1: Authenticate user by finding contact
    const contact = await hubspot.searchContacts(student_id, email);

    if (!contact) {
      result.error = 'Authentication failed. Please check your Student ID and email.';
      result.error_code = 'AUTH_FAILED';
      return result;
    }

    const contactId = contact.id;
    console.log(`✅ Contact authenticated: ${contactId}`);

    // Step 2: Get comprehensive booking data with associations
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

    // Step 3: Verify booking ownership
    const contactAssociations = booking.associations?.[HUBSPOT_OBJECTS.contacts]?.results || [];

    const belongsToUser = contactAssociations.some(assoc => {
      const contactIdStr = String(contactId);
      const assocIdStr = String(assoc.id);
      const assocToObjectIdStr = String(assoc.toObjectId);

      return assocIdStr === contactIdStr || assocToObjectIdStr === contactIdStr;
    });

    if (!belongsToUser) {
      console.error(`❌ Access denied - booking ${bookingId} does not belong to user`);
      result.error = 'Access denied. This booking does not belong to you.';
      result.error_code = 'ACCESS_DENIED';
      return result;
    }

    // Step 4: Check if already cancelled
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

    // Step 5: Get Mock Exam details if associated
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

    // Step 6: Prepare cancellation data for note
    const cancellationData = {
      booking_id: bookingProperties.booking_id || bookingDataObj.id,
      mock_type: mockExamDetails?.mock_type || bookingProperties.mock_type || 'Mock Exam',
      exam_date: mockExamDetails?.exam_date || bookingProperties.exam_date,
      location: mockExamDetails?.location || bookingProperties.location || 'Location TBD',
      name: bookingProperties.name || contact.properties?.firstname + ' ' + contact.properties?.lastname,
      email: bookingProperties.email || contact.properties?.email,
      reason: reason || 'User requested cancellation',
      token_used: bookingProperties.token_used || 'Not specified'
    };

    // Step 7: Create cancellation note on Contact timeline
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

    // Step 8: Redis operations - Decrement counter AND invalidate duplicate detection cache
    let bookingsDecremented = false;
    if (mockExamId) {
      try {
        const redis = new RedisLockService();
        const counterKey = `exam:${mockExamId}:bookings`;
        const counterBefore = await redis.get(counterKey);
        const currentCount = parseInt(counterBefore) || 0;

        let newCount;
        // Safety check: Don't decrement below 0
        if (currentCount <= 0) {
          console.warn(`⚠️ [REDIS] Counter is already at ${currentCount}, resetting to 0 (drift detected)`);

          // Preserve TTL when resetting to 0
          const TTL_30_DAYS = 30 * 24 * 60 * 60;
          await redis.setex(counterKey, TTL_30_DAYS, 0);
          newCount = 0;
        } else {
          newCount = await redis.decr(counterKey);
          console.log(`✅ Redis counter decremented for exam ${mockExamId}: ${counterBefore} → ${newCount}`);
        }

        // CRITICAL FIX: Invalidate duplicate detection cache (allows rebooking same date)
        const exam_date = mockExamDetails?.exam_date || bookingProperties.exam_date;
        if (contactId && exam_date) {
          const redisKey = `booking:${contactId}:${exam_date}`;
          console.log(`🔍 [REDIS] Invalidating duplicate cache key: "${redisKey}"`);

          const deletedCount = await redis.del(redisKey);
          if (deletedCount > 0) {
            console.log(`✅ [REDIS] Successfully invalidated duplicate cache: ${redisKey}`);
            result.actions_completed.cache_invalidated = true;
          } else {
            console.log(`ℹ️ [REDIS] No cache entry found for key: ${redisKey}`);
          }
        } else {
          console.warn(`⚠️ [REDIS] Cannot invalidate cache - missing contactId or exam_date`);
        }

        // Trigger HubSpot workflow via webhook (async, non-blocking)
        const { HubSpotWebhookService } = require('../_shared/hubspot-webhook');

        process.nextTick(async () => {
          const webhookResult = await HubSpotWebhookService.syncWithRetry(
            'totalBookings',
            mockExamId,
            newCount
          );

          if (webhookResult.success) {
            console.log(`✅ [WEBHOOK] HubSpot workflow triggered after user batch cancellation: ${webhookResult.message}`);
          } else {
            console.error(`❌ [WEBHOOK] All retry attempts failed: ${webhookResult.message}`);
            console.error(`⏰ [WEBHOOK] Reconciliation cron will fix drift within 2 hours`);
          }
        });

        await redis.close();
        bookingsDecremented = true;
        result.actions_completed.bookings_decremented = true;
      } catch (decrementError) {
        console.error(`❌ Failed to decrement Redis counter: ${decrementError.message}`);
      }
    }

    // Step 9: Restore credits to contact
    let creditsRestored = null;
    const tokenUsed = bookingProperties.token_used;

    if (contactId && tokenUsed) {
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

        // Sync credit restoration to Supabase (non-blocking)
        if (creditsRestored) {
          // Map token to mock_type for Supabase sync
          const tokenToMockTypeMapping = {
            'Situational Judgment Token': 'Situational Judgment',
            'Clinical Skills Token': 'Clinical Skills',
            'Mini-mock Token': 'Mini-mock',
            'Mock Discussion Token': 'Mock Discussion',
            'Shared Token': mockExamDetails?.mock_type || bookingProperties.mock_type || 'Situational Judgment'
          };

          const mockTypeForSync = tokenToMockTypeMapping[tokenUsed] || mockExamDetails?.mock_type || bookingProperties.mock_type;

          // Calculate new credit values for Supabase sync
          const newCredits = { ...currentCredits };
          newCredits[creditsRestored.credit_type] = creditsRestored.new_balance;

          // Determine specific and shared credits based on credit_type
          let newSpecificCredits = 0;
          let newSharedCredits = newCredits.shared_mock_credits;

          if (creditsRestored.credit_type === 'sj_credits') {
            newSpecificCredits = newCredits.sj_credits;
          } else if (creditsRestored.credit_type === 'cs_credits') {
            newSpecificCredits = newCredits.cs_credits;
          } else if (creditsRestored.credit_type === 'sjmini_credits') {
            newSpecificCredits = newCredits.sjmini_credits;
            newSharedCredits = 0;
          } else if (creditsRestored.credit_type === 'mock_discussion_token') {
            newSpecificCredits = newCredits.mock_discussion_token;
            newSharedCredits = 0;
          } else if (creditsRestored.credit_type === 'shared_mock_credits') {
            newSharedCredits = newCredits.shared_mock_credits;
            if (mockTypeForSync === 'Situational Judgment') {
              newSpecificCredits = newCredits.sj_credits;
            } else if (mockTypeForSync === 'Clinical Skills') {
              newSpecificCredits = newCredits.cs_credits;
            }
          }

          updateContactCreditsInSupabase(contactId, mockTypeForSync, newSpecificCredits, newSharedCredits)
            .then(() => {
              console.log(`✅ [SUPABASE SYNC] Contact credits synced for ${contactId} (batch cancel)`);
            })
            .catch(supabaseError => {
              console.error(`⚠️ [SUPABASE SYNC] Failed to sync contact credits (non-blocking):`, supabaseError.message);
            });
        }
      } catch (creditError) {
        console.error(`❌ Failed to restore credits: ${creditError.message}`);
      }
    } else {
      console.warn(`⚠️ Cannot restore credits: missing contactId or tokenUsed property`);
    }

    // Step 10: Perform soft delete (mark as cancelled)
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

    // Step 11: SUPABASE SYNC - Update booking status and atomically decrement exam count
    try {
      // Update booking status in Supabase
      await updateBookingStatusInSupabase(bookingId, 'Cancelled');

      // Atomically decrement exam booking count if we have mockExamId
      if (mockExamId) {
        await updateExamBookingCountInSupabase(mockExamId, null, 'decrement');
        console.log(`✅ [SUPABASE] Atomically decremented exam ${mockExamId} total_bookings`);
      }

      console.log(`✅ Supabase synced for cancelled booking ${bookingId}`);
    } catch (supabaseError) {
      // Non-blocking - log but don't fail
      console.error(`⚠️ Supabase sync failed (non-blocking):`, supabaseError.message);
    }

    // Success!
    result.success = true;
    result.status = 'cancelled';
    result.cancelled_at = new Date().toISOString();

    console.log(`✅ Booking ${bookingId} cancellation completed successfully`);
    return result;

  } catch (error) {
    console.error(`❌ Error cancelling booking ${bookingId}:`, error.message);
    result.error = error.message || 'Internal server error';
    result.error_code = error.code || 'INTERNAL_ERROR';
    return result;
  }
}

/**
 * Main handler for batch cancellation
 */
async function handler(req, res) {
  setCorsHeaders(res);

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return handleOptionsRequest(req, res);
  }

  console.log('🔍 [HANDLER] Batch cancel API called:', {
    method: req.method,
    url: req.url
  });

  try {
    // Security check
    await rateLimitMiddleware(req, res);

    // Environment validation
    verifyEnvironmentVariables();

    // Only allow POST method
    if (req.method !== 'POST') {
      const error = new Error('Method not allowed');
      error.status = 405;
      throw error;
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
      const validationError = new Error(`Invalid input: ${error.details.map(detail => detail.message).join(', ')}`);
      validationError.status = 400;
      validationError.code = 'VALIDATION_ERROR';
      throw validationError;
    }

    console.log(`✅ [VALIDATION SUCCESS] Processing ${validatedData.bookings.length} booking(s)`);

    // Initialize HubSpot service
    const hubspot = new HubSpotService();

    // Process each booking cancellation
    const results = [];
    let successCount = 0;
    let failedCount = 0;

    for (const booking of validatedData.bookings) {
      const result = await cancelSingleBooking(hubspot, booking);

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

    console.log(`📊 Batch cancellation summary:`, summary);

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
    return res.status(statusCode).json(createSuccessResponse(
      {
        summary,
        results
      },
      message
    ));

  } catch (error) {
    console.error('❌ Batch cancellation error:', {
      message: error.message,
      status: error.status || 500,
      code: error.code || 'INTERNAL_ERROR',
      stack: error.stack
    });

    const statusCode = error.status || 500;
    return res.status(statusCode).json(createErrorResponse(
      error.message || 'Internal server error',
      error.code || 'INTERNAL_ERROR'
    ));
  }
}

module.exports = handler;
