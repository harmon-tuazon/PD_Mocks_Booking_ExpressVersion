/**
 * POST /api/bookings/batch-cancel - Admin batch cancel multiple bookings
 *
 * Admin-authenticated endpoint for batch cancelling bookings from trainee dashboard
 *
 * Request Body:
 * {
 *   bookings: [
 *     {
 *       id: string,                    // Supabase UUID (primary identifier)
 *       hubspot_id?: string,           // HubSpot numeric ID (may be null for Supabase-only bookings)
 *       student_id?: string,           // For reference only
 *       email?: string,                // For reference only
 *       associated_contact_id?: string,// Contact ID for note creation
 *       reason?: string                // Optional cancellation reason
 *     }
 *   ],
 *   refundTokens?: boolean  // Whether to refund tokens (default: true)
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
const hubspotModule = require('../_shared/hubspot');
const { HubSpotService, HUBSPOT_OBJECTS } = require('../_shared/hubspot');
const { requireAdmin } = require('../admin/middleware/requireAdmin');
const RedisLockService = require('../_shared/redis');
const refundService = require('../_shared/refund');
const {
  updateContactCreditsInSupabase,
  updateBookingStatusInSupabase,
  updateExamBookingCountInSupabase,
  getBookingCascading
} = require('../_shared/supabase-data');

// Validation schema for batch cancellation
// Updated to support cascading lookup pattern:
// - id: Supabase UUID (primary identifier)
// - hubspot_id: HubSpot numeric ID (may be null for Supabase-only bookings)
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
        hubspot_id: Joi.string()
          .optional()
          .allow(null, '')
          .messages({
            'string.base': 'HubSpot ID must be a string'
          }),
        student_id: Joi.string()
          .optional()
          .allow(''),
        email: Joi.string()
          .email()
          .optional()
          .allow(''),
        associated_contact_id: Joi.string()
          .optional()
          .allow('', null),
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
    }),
  refundTokens: Joi.boolean()
    .optional()
    .default(true)
    .messages({
      'boolean.base': 'refundTokens must be a boolean'
    })
});

/**
 * Process single booking cancellation (admin version - no authentication per booking)
 * Updated to support cascading lookup pattern:
 * - First checks if hubspot_id is provided
 * - Falls back to Supabase lookup if only Supabase UUID is provided
 * - Supports Supabase-only bookings (those not yet synced to HubSpot)
 *
 * @param {Object} hubspot - HubSpot service instance
 * @param {Object} bookingData - Booking data with id, hubspot_id, reason
 * @param {Object} redis - Redis service instance
 * @param {boolean} refundTokens - Whether to refund tokens (default: true)
 */
async function cancelSingleBooking(hubspot, bookingData, redis, refundTokens = true) {
  const { id: supabaseId, hubspot_id: providedHubspotId, reason } = bookingData;
  const result = {
    booking_id: supabaseId,
    hubspot_id: providedHubspotId || null,
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
    console.log(`🗑️ [Admin] Processing cancellation for booking ${supabaseId} (hubspot_id: ${providedHubspotId || 'none'})`);

    // Step 0: Resolve HubSpot ID using cascading lookup
    let hubspotId = providedHubspotId;
    let supabaseRecord = null;
    let isSupabaseOnly = false;

    if (!hubspotId) {
      // No HubSpot ID provided - use cascading lookup
      console.log(`🔍 [CASCADING] Looking up booking ${supabaseId} in Supabase...`);
      supabaseRecord = await getBookingCascading(supabaseId);

      if (supabaseRecord) {
        hubspotId = supabaseRecord.hubspot_id;
        if (hubspotId) {
          console.log(`  ✓ Resolved ${supabaseId} → hubspot_id: ${hubspotId}`);
        } else {
          console.log(`  ✓ Found Supabase-only booking ${supabaseId} (no HubSpot ID)`);
          isSupabaseOnly = true;
        }
      } else {
        console.error(`❌ Booking not found in Supabase: ${supabaseId}`);
        result.error = 'Booking not found';
        result.error_code = 'BOOKING_NOT_FOUND';
        return result;
      }
    }

    result.hubspot_id = hubspotId;

    // Step 1: Get comprehensive booking data with associations
    let booking;
    let bookingProperties;

    if (isSupabaseOnly) {
      // Supabase-only booking - use Supabase data directly
      console.log(`📦 [SUPABASE-ONLY] Using Supabase data for booking ${supabaseId}`);
      bookingProperties = {
        booking_id: supabaseRecord.booking_id,
        is_active: supabaseRecord.is_active,
        status: supabaseRecord.is_active === 'Cancelled' ? 'cancelled' : 'active',
        token_used: supabaseRecord.token_used,
        name: supabaseRecord.name,
        email: supabaseRecord.student_email,
        mock_type: supabaseRecord.mock_type,
        exam_date: supabaseRecord.exam_date,
        location: supabaseRecord.attending_location
      };
      booking = {
        id: supabaseId,
        properties: bookingProperties,
        associations: {}
      };
    } else {
      // Has HubSpot ID - fetch from HubSpot
      try {
        booking = await hubspot.getBookingWithAssociations(hubspotId);
      } catch (error) {
        console.error(`❌ Booking not found in HubSpot: ${hubspotId}`);
        result.error = 'Booking not found in HubSpot';
        result.error_code = 'BOOKING_NOT_FOUND';
        return result;
      }
    }

    // Normalize booking data structure
    const bookingDataObj = booking.data || booking;
    if (!bookingProperties) {
      bookingProperties = bookingDataObj.properties || {};
    }

    // Step 2: Check if already cancelled
    const currentStatus = bookingProperties.status;
    const isActive = bookingProperties.is_active;

    if (currentStatus === 'canceled' || currentStatus === 'cancelled' ||
        isActive === 'Cancelled' || isActive === 'cancelled' ||
        isActive === false || isActive === 'false') {
      console.log(`⚠️ Booking ${supabaseId} already cancelled`);
      result.error = 'Booking is already cancelled';
      result.error_code = 'ALREADY_CANCELED';
      return result;
    }

    // Step 3: Get associated Contact ID
    let contactId = null;
    let contact = null;

    if (isSupabaseOnly) {
      // Supabase-only booking - use associated_contact_id from Supabase record
      contactId = supabaseRecord.associated_contact_id || bookingData.associated_contact_id;
      if (contactId) {
        console.log(`📞 Using Contact ID from Supabase: ${contactId}`);
        // Try to fetch contact details from HubSpot for credit restoration
        try {
          const contactResponse = await hubspot.apiCall('GET', `/crm/v3/objects/contacts/${contactId}`, null, {
            properties: ['firstname', 'lastname', 'email', 'sj_credits', 'cs_credits', 'sjmini_credits', 'shared_mock_credits']
          });
          contact = contactResponse;
        } catch (contactError) {
          console.warn(`⚠️ Failed to fetch Contact details: ${contactError.message}`);
        }
      }
    } else {
      // HubSpot booking - get from associations
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
    }

    // Step 4: Get Mock Exam details if associated
    let mockExamId = null;
    let mockExamDetails = null;

    if (isSupabaseOnly) {
      // Supabase-only booking - use associated_mock_exam from Supabase record
      mockExamId = supabaseRecord.associated_mock_exam;
      if (mockExamId) {
        console.log(`📚 Using Mock Exam ID from Supabase: ${mockExamId}`);
        try {
          const mockExamResponse = await hubspot.getMockExam(mockExamId);
          if (mockExamResponse?.data) {
            mockExamDetails = mockExamResponse.data.properties;
          }
        } catch (examError) {
          console.warn(`⚠️ Failed to fetch Mock Exam details: ${examError.message}`);
        }
      }
    } else {
      // HubSpot booking - get from associations
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

    // Step 6: Create cancellation note on Contact timeline (using direct HubSpot API)
    let noteCreated = false;
    if (contactId) {
      try {
        const noteContent = `
          <strong>🗑️ Booking Cancelled</strong><br/>
          <hr/>
          <strong>Booking Details:</strong><br/>
          • Booking ID: ${cancellationData.booking_id}<br/>
          • Mock Type: ${cancellationData.mock_type}<br/>
          • Exam Date: ${cancellationData.exam_date || 'N/A'}<br/>
          • Location: ${cancellationData.location}<br/>
          • Token Used: ${cancellationData.token_used}<br/>
          <br/>
          <strong>Reason:</strong> ${cancellationData.reason}<br/>
          <strong>Timestamp:</strong> ${new Date().toISOString()}<br/>
        `;

        // Create note using HubSpot API (hubspotModule is the module export with apiCall)
        const noteResponse = await hubspotModule.apiCall('POST', '/crm/v3/objects/notes', {
          properties: {
            hs_note_body: noteContent,
            hs_timestamp: Date.now()
          }
        });

        // Associate note with contact
        if (noteResponse?.id) {
          await hubspotModule.createAssociation('0-46', noteResponse.id, '0-1', contactId);
          console.log(`✅ Cancellation note created for Contact ${contactId}`);
          noteCreated = true;
          result.actions_completed.note_created = true;
        }
      } catch (noteError) {
        console.error(`❌ Failed to create cancellation note: ${noteError.message}`);
      }
    }

    // Step 7: Trigger webhook to sync total_bookings (will be done after Redis decrement in Step 10)
    let bookingsDecremented = false;

    // Step 8: Restore credits to contact using refundService (Supabase-first pattern)
    // Only refund if refundTokens flag is true (controlled by checkbox in UI)
    let creditsRestored = null;
    const tokenUsed = bookingProperties.token_used;

    if (!refundTokens) {
      console.log(`⏭️ Token refund skipped for booking ${supabaseId} (refundTokens=false)`);
      result.actions_completed.credits_restored = false;
      result.credit_restoration = { skipped: true, reason: 'Refund not requested' };
    } else if (tokenUsed && supabaseId) {
      try {
        console.log(`💳 Restoring credits for cancelled booking ${supabaseId}`);

        // Use refundService.refundToken which handles:
        // - Cascading lookup (Supabase UUID → HubSpot ID)
        // - Supabase-first credit update
        // - HubSpot sync (fire-and-forget)
        const refundResult = await refundService.refundToken(supabaseId, 'admin@prepdoctors.com');

        if (refundResult.success) {
          console.log(`✅ Credits restored successfully for booking ${supabaseId}`);
          result.actions_completed.credits_restored = true;
          result.credit_restoration = {
            credit_type: refundResult.token_type,
            previous_balance: refundResult.previous_credits,
            new_balance: refundResult.credits_restored
          };
        }
      } catch (creditError) {
        // Non-blocking - booking cancellation should still proceed
        console.error(`❌ Failed to restore credits: ${creditError.message}`);
      }
    } else {
      console.warn(`⚠️ Cannot restore credits: missing tokenUsed (${tokenUsed}) or supabaseId (${supabaseId})`);
    }

    // Step 9: Perform soft delete (mark as cancelled)
    if (isSupabaseOnly) {
      // Supabase-only booking - update directly in Supabase
      try {
        await updateBookingStatusInSupabase(supabaseId, 'Cancelled');
        console.log(`✅ Supabase-only booking ${supabaseId} marked as cancelled`);
        result.actions_completed.soft_delete = true;
      } catch (supabaseError) {
        console.error(`❌ Failed to cancel Supabase-only booking: ${supabaseError.message}`);
        result.error = 'Failed to cancel booking in Supabase';
        result.error_code = 'SUPABASE_DELETE_FAILED';
        return result;
      }
    } else {
      // Has HubSpot ID - soft delete in HubSpot
      try {
        await hubspot.softDeleteBooking(hubspotId);
        console.log(`✅ Booking ${hubspotId} marked as cancelled in HubSpot`);
        result.actions_completed.soft_delete = true;
      } catch (deleteError) {
        console.error(`❌ Failed to soft delete booking: ${deleteError}`);
        result.error = 'Failed to cancel booking';
        result.error_code = 'SOFT_DELETE_FAILED';
        return result;
      }

      // Step 9.5: Sync booking cancellation to Supabase (for HubSpot bookings)
      try {
        // Use Supabase ID if available, otherwise fall back to HubSpot ID
        const idForSupabase = supabaseId || hubspotId;
        await updateBookingStatusInSupabase(idForSupabase, 'Cancelled');
        console.log(`✅ [SUPABASE] Updated booking ${idForSupabase} status to Cancelled`);
      } catch (supabaseError) {
        console.error(`⚠️ [SUPABASE] Failed to sync booking status (non-blocking):`, supabaseError.message);
        // Non-blocking - cron will reconcile
      }
    }

    // Step 10: Clear Redis duplicate detection cache (ENHANCED LOGGING)
    console.log(`🔍 [REDIS DEBUG] Starting cache invalidation for booking ${supabaseId}`);
    console.log(`🔍 [REDIS DEBUG] - Redis instance exists: ${!!redis}`);
    console.log(`🔍 [REDIS DEBUG] - contactId: ${contactId}`);
    console.log(`🔍 [REDIS DEBUG] - exam_date: ${cancellationData.exam_date}`);
    console.log(`🔍 [REDIS DEBUG] - mockExamId: ${mockExamId}`);

    if (redis && contactId && cancellationData.exam_date) {
      try {
        // Normalize exam_date to YYYY-MM-DD format for consistent cache keys
        const normalizedExamDate = cancellationData.exam_date.includes('T')
          ? cancellationData.exam_date.split('T')[0]
          : cancellationData.exam_date;
        const redisKey = `booking:${contactId}:${normalizedExamDate}`;
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

        // Decrement exam booking counter (with safety check)
        if (mockExamId) {
          const counterKey = `exam:${mockExamId}:bookings`;
          const counterBefore = await redis.get(counterKey);
          const currentCount = parseInt(counterBefore) || 0;
          console.log(`🔍 [REDIS DEBUG] Counter before decrement: ${counterBefore}`);

          let newCount;
          // Safety check: Don't decrement below 0
          if (currentCount <= 0) {
            console.warn(`⚠️ [REDIS] Counter is already at ${currentCount}, resetting to 0 (drift detected)`);

            // Preserve TTL when resetting to 0
            const TTL_1_WEEK = 7 * 24 * 60 * 60; // 604,800 seconds
            await redis.setex(counterKey, TTL_1_WEEK, 0);
            newCount = 0;
            console.log(`✅ [REDIS] Counter reset to 0 for exam ${mockExamId} (TTL: 1 week)`);
          } else {
            newCount = await redis.decr(counterKey);
            console.log(`🔍 [REDIS DEBUG] Counter after decrement: ${newCount}`);
            console.log(`✅ [REDIS] Decremented exam counter for ${mockExamId}: ${counterBefore} → ${newCount}`);
          }

          // SUPABASE SYNC: Atomically decrement exam booking count in Supabase
          try {
            await updateExamBookingCountInSupabase(mockExamId, null, 'decrement');
            console.log(`✅ [SUPABASE] Atomically decremented exam ${mockExamId} total_bookings`);
          } catch (supabaseError) {
            console.error(`⚠️ [SUPABASE] Exam count sync failed (non-blocking):`, supabaseError.message);
            // Fallback is built into the function - cron will reconcile
          }

          // Trigger HubSpot workflow via webhook (async, non-blocking)
          const { HubSpotWebhookService } = require('../_shared/hubspot-webhook');

          process.nextTick(async () => {
            const webhookResult = await HubSpotWebhookService.syncWithRetry(
              mockExamId,
              newCount,
              3 // 3 retries with exponential backoff
            );

            if (webhookResult.success) {
              console.log(`✅ [WEBHOOK] HubSpot workflow triggered after batch cancellation: ${webhookResult.message}`);
              bookingsDecremented = true;
              result.actions_completed.bookings_decremented = true;
            } else {
              console.error(`❌ [WEBHOOK] All retry attempts failed: ${webhookResult.message}`);
              console.error(`⏰ [WEBHOOK] Reconciliation cron will fix drift within 2 hours`);
            }
          });
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

    console.log(`✅ [Admin] Booking ${supabaseId} cancellation completed successfully`);
    return result;

  } catch (error) {
    console.error(`❌ Error cancelling booking ${supabaseId}:`, error.message);
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

    // Extract refundTokens flag (defaults to true if not provided)
    const { bookings, refundTokens = true } = validatedData;

    console.log(`✅ [VALIDATION SUCCESS] Processing ${bookings.length} booking(s)`);
    console.log(`🔄 [CANCEL] Token refunds enabled: ${refundTokens}`);

    // Initialize HubSpot service and Redis
    const hubspot = new HubSpotService();
    const redis = new RedisLockService();

    // Process each booking cancellation
    const results = [];
    let successCount = 0;
    let failedCount = 0;

    for (const booking of bookings) {
      const result = await cancelSingleBooking(hubspot, booking, redis, refundTokens);

      if (result.success) {
        successCount++;
      } else {
        failedCount++;
      }

      results.push(result);
    }

    // Prepare response summary
    const summary = {
      total: bookings.length,
      successful: successCount,
      failed: failedCount,
      refundTokensEnabled: refundTokens
    };

    console.log(`📊 [Admin] Batch cancellation summary:`, summary);

    // Determine response status based on results
    let statusCode = 200;
    let message = 'Batch cancellation completed';

    if (failedCount === bookings.length) {
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
