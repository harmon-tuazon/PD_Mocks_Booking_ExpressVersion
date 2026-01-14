/**
 * GET /api/bookings/[id] - Fetches detailed information about a specific booking
 * DELETE /api/bookings/[id] - Cancels a booking with enhanced tracking
 *
 * Query Parameters (GET):
 * - student_id: The student's ID (required)
 * - email: The student's email (required)
 *
 * Body Parameters (DELETE):
 * - student_id: The student's ID (required)
 * - email: The student's email (required)
 * - reason: Cancellation reason (optional)
 *
 * URL Parameters:
 * - id: The HubSpot booking object ID
 *
 * Returns:
 * - 200: Success (booking details for GET, cancellation confirmation for DELETE)
 * - 400: Invalid request parameters
 * - 401: Authentication failed
 * - 403: Booking doesn't belong to authenticated user (GET only)
 * - 404: Booking not found
 * - 405: Method not allowed
 * - 409: Booking already cancelled
 * - 500: Server error
 *
 * DELETE operation enhancements:
 * - Creates cancellation note on Contact's timeline
 * - Decrements Mock Exam's total_bookings property
 * - Performs soft delete (sets is_active to 'Cancelled')
 * - Returns detailed actions_completed status
 */

// Import shared utilities
require('dotenv').config();
const { HubSpotService, HUBSPOT_OBJECTS } = require('../_shared/hubspot');
const { schemas } = require('../_shared/validation');
const {
  setCorsHeaders,
  handleOptionsRequest,
  createErrorResponse,
  createSuccessResponse,
  verifyEnvironmentVariables,
  rateLimitMiddleware,
  sanitizeInput
} = require('../_shared/auth');
const {
  getBookingCascading,
  cancelBookingAtomic,
  getContactCreditsFromSupabase,
  getBookingsFromSupabase,
  getExamByIdFromSupabase
} = require('../_shared/supabase-data');
const { HubSpotWebhookService } = require('../_shared/hubspot-webhook');

// Handler function for GET /api/bookings/[id]
async function handler(req, res) {
  setCorsHeaders(res);

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return handleOptionsRequest(req, res);
  }

  console.log('🔍 [HANDLER DEBUG] Booking API called:', {
    method: req.method,
    url: req.url,
    query: req.query,
    bookingId: req.query.id,
    bookingIdType: typeof req.query.id
  });

  try {
    // Security check
    await rateLimitMiddleware(req, res);

    // Environment validation
    verifyEnvironmentVariables();

    // Only allow GET and DELETE methods
    if (req.method !== 'GET' && req.method !== 'DELETE') {
      const error = new Error('Method not allowed');
      error.status = 405;
      throw error;
    }

    // Extract booking ID from URL path
    const { id: bookingId } = req.query;

    if (!bookingId) {
      const error = new Error('Booking ID is required');
      error.status = 400;
      error.code = 'MISSING_BOOKING_ID';
      throw error;
    }

    // Parse parameters based on method
    let inputParams;
    let schemaName;

    console.log('🔍 [VALIDATION DEBUG] Request details:', {
      method: req.method,
      hasBody: !!req.body,
      bodyKeys: req.body ? Object.keys(req.body) : null,
      body: req.body,
      hasQuery: !!req.query,
      queryKeys: req.query ? Object.keys(req.query) : null,
      query: req.query
    });

    if (req.method === 'GET') {
      inputParams = {
        student_id: req.query.student_id,
        email: req.query.email
      };
      schemaName = 'authCheck';
    } else if (req.method === 'DELETE') {
      inputParams = {
        student_id: req.body.student_id,
        email: req.body.email,
        reason: req.body.reason
      };
      schemaName = 'bookingCancellation';
    }

    console.log('🔍 [VALIDATION DEBUG] Parsed input params:', {
      inputParams,
      schemaName
    });

    // Validate input using appropriate schema
    const { error, value: validatedData } = schemas[schemaName].validate(inputParams);
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

    console.log('✅ [VALIDATION SUCCESS] Validated data:', validatedData);

    const { student_id, email, reason } = validatedData;

    // Logging
    console.log(`📋 Processing booking ${req.method} request:`, {
      bookingId: sanitizeInput(bookingId),
      student_id: sanitizeInput(student_id),
      email: sanitizeInput(email),
      ...(req.method === 'DELETE' && reason ? { reason: sanitizeInput(reason) } : {})
    });

    // Sanitize inputs
    const sanitizedStudentId = sanitizeInput(student_id);
    const sanitizedEmail = sanitizeInput(email);
    const sanitizedBookingId = sanitizeInput(bookingId);

    // Initialize HubSpot service (still needed for GET request associations)
    const hubspot = new HubSpotService();

    // Step 1: Authenticate user by finding contact (Supabase-first)
    const contact = await getContactCreditsFromSupabase(sanitizedStudentId, sanitizedEmail);

    if (!contact) {
      const error = new Error('Authentication failed. Please check your Student ID and email.');
      error.status = 401;
      error.code = 'AUTH_FAILED';
      throw error;
    }

    // Use hubspot_id for HubSpot operations, store both for ownership verification
    const contactHubspotId = contact.hubspot_id;
    console.log(`✅ Contact authenticated (Supabase): ${contactHubspotId} - ${contact.firstname} ${contact.lastname}`);

    // Handle GET request
    if (req.method === 'GET') {
      return await handleGetRequest(req, res, hubspot, sanitizedBookingId, contactHubspotId, contact);
    }

    // Handle DELETE request
    if (req.method === 'DELETE') {
      return await handleDeleteRequest(req, res, hubspot, sanitizedBookingId, contactHubspotId, contact, reason, sanitizedStudentId);
    }

  } catch (error) {
    console.error('❌ Booking operation error:', {
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

/**
 * Handle GET request for booking details
 */
async function handleGetRequest(req, res, hubspot, bookingId, contactId, contact) {
  try {
    // Step 2: Fetch the booking with associations
    const bookingResponse = await hubspot.apiCall({
      method: 'GET',
      url: `/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}/${bookingId}`,
      params: {
        properties: [
          'booking_id',
          'name',
          'email',
          'dominant_hand',
          'status',
          'createdate',
          'hs_lastmodifieddate'
        ],
        associations: [
          HUBSPOT_OBJECTS.contacts,
          HUBSPOT_OBJECTS.mock_exams
        ]
      }
    });

    if (!bookingResponse || !bookingResponse.data) {
      const error = new Error('Booking not found');
      error.status = 404;
      error.code = 'BOOKING_NOT_FOUND';
      throw error;
    }

    const booking = bookingResponse.data;

    // Step 3: Verify booking ownership with enhanced debugging
    const contactAssociations = booking.associations?.[HUBSPOT_OBJECTS.contacts]?.results || [];

    console.log('🔍 [OWNERSHIP DEBUG] Verifying booking ownership:', {
      contactId,
      contactIdType: typeof contactId,
      associationsCount: contactAssociations.length,
      contactAssociations: contactAssociations.map(assoc => ({
        id: assoc.id,
        idType: typeof assoc.id,
        toObjectId: assoc.toObjectId,
        toObjectIdType: typeof assoc.toObjectId,
        type: assoc.type,
        allKeys: Object.keys(assoc)
      }))
    });

    const belongsToUser = contactAssociations.some(assoc => {
      // ROBUST COMPARISON: Handle both numeric and string IDs from HubSpot
      const contactIdStr = String(contactId);
      const contactIdNum = Number(contactId);

      const assocIdStr = String(assoc.id);
      const assocIdNum = Number(assoc.id);
      const assocToObjectIdStr = String(assoc.toObjectId);
      const assocToObjectIdNum = Number(assoc.toObjectId);

      // Multiple comparison strategies to handle HubSpot's inconsistent ID types
      const matches = [
        // Direct equality (works if both are same type)
        assoc.id === contactId,
        assoc.toObjectId === contactId,

        // String comparison
        assocIdStr === contactIdStr,
        assocToObjectIdStr === contactIdStr,

        // Numeric comparison (if both are valid numbers)
        !isNaN(assocIdNum) && !isNaN(contactIdNum) && assocIdNum === contactIdNum,
        !isNaN(assocToObjectIdNum) && !isNaN(contactIdNum) && assocToObjectIdNum === contactIdNum,

        // Handle prefixed IDs (remove common HubSpot prefixes)
        assocIdStr.replace(/^0-1[_-]?/, '') === contactIdStr.replace(/^0-1[_-]?/, ''),
        assocToObjectIdStr.replace(/^0-1[_-]?/, '') === contactIdStr.replace(/^0-1[_-]?/, '')
      ];

      const hasMatch = matches.some(Boolean);

      console.log('🔍 [OWNERSHIP DEBUG] Enhanced association check:', {
        contactId: contactId,
        contactIdType: typeof contactId,
        assoc: {
          id: assoc.id,
          idType: typeof assoc.id,
          toObjectId: assoc.toObjectId,
          toObjectIdType: typeof assoc.toObjectId
        },
        stringComparisons: {
          'assoc.id vs contactId': `"${assocIdStr}" === "${contactIdStr}" = ${assocIdStr === contactIdStr}`,
          'assoc.toObjectId vs contactId': `"${assocToObjectIdStr}" === "${contactIdStr}" = ${assocToObjectIdStr === contactIdStr}`
        },
        hasMatch
      });

      return hasMatch;
    });

    if (!belongsToUser) {
      console.error('❌ [OWNERSHIP DEBUG] Access denied - no matching associations found');
      const error = new Error('Access denied. This booking does not belong to you.');
      error.status = 403;
      error.code = 'ACCESS_DENIED';
      throw error;
    }

    console.log('✅ [OWNERSHIP DEBUG] Booking ownership verified');

    // Step 4: Get associated Mock Exam details
    let mockExamDetails = null;
    const mockExamAssociations = booking.associations?.[HUBSPOT_OBJECTS.mock_exams]?.results || [];

    if (mockExamAssociations.length > 0) {
      const mockExamId = mockExamAssociations[0].id;
      try {
        const mockExamResponse = await hubspot.getMockExam(mockExamId);
        if (mockExamResponse && mockExamResponse.data) {
          const examData = mockExamResponse.data.properties;
          mockExamDetails = {
            id: mockExamResponse.data.id,
            exam_date: examData.exam_date,
            mock_type: examData.mock_type,
            location: examData.location,
            capacity: parseInt(examData.capacity) || 0,
            total_bookings: parseInt(examData.total_bookings) || 0,
            address: examData.address || '',
            start_time: examData.start_time || '',
            end_time: examData.end_time || ''
          };
        }
      } catch (examError) {
        console.warn('⚠️ Failed to fetch mock exam details:', examError.message);
      }
    }

    // Enrollment details not required for booking display (optimized - removed unnecessary API call)
    let enrollmentDetails = null;

    // Step 6: Prepare response data
    const responseData = {
      booking: {
        id: booking.id,
        booking_id: booking.properties.booking_id || '',
        name: booking.properties.name || '',
        email: booking.properties.email || '',
        dominant_hand: booking.properties.dominant_hand === 'true',
        status: booking.properties.status || 'unknown',
        created_at: booking.properties.createdate || '',
        updated_at: booking.properties.hs_lastmodifieddate || ''
      },
      mock_exam: mockExamDetails,
      contact: {
        id: contactId,
        firstname: contact.properties.firstname || '',
        lastname: contact.properties.lastname || '',
        student_id: contact.properties.student_id || ''
      },
      enrollment: enrollmentDetails
    };

    console.log(`✅ Successfully retrieved booking details for ${bookingId}`);

    // Return success response
    return res.status(200).json(createSuccessResponse(
      responseData,
      'Successfully retrieved booking details'
    ));

  } catch (error) {
    throw error;  // Re-throw to be handled by main handler
  }
}

/**
 * Handle DELETE request for booking cancellation (ENHANCED)
 * Includes note creation and association removal
 */
async function handleDeleteRequest(req, res, hubspot, bookingId, contactId, contact, reason, studentId) {
  try {
    console.log('🗑️ [DELETE] Processing enhanced booking cancellation:', {
      bookingId,
      contactId,
      reason
    });

    const booking = await getBookingCascading(bookingId);
    if (!booking) {
      console.error('❌ Booking not found:', bookingId);
      const notFoundError = new Error('Booking not found');
      notFoundError.status = 404;
      notFoundError.code = 'BOOKING_NOT_FOUND';
      throw notFoundError;
    }

    console.log('✅ Booking found:', {
      id: booking.id,
      booking_id: booking.booking_id,
      is_active: booking.is_active,
      student_id: booking.student_id,
      associated_mock_exam: booking.associated_mock_exam,
      associated_contact_id: booking.associated_contact_id
    });

    // Step 1.5: OWNERSHIP VERIFICATION - Ensure booking belongs to authenticated user
    // Compare booking's associated_contact_id with authenticated user's hubspot_id
    const bookingContactId = booking.associated_contact_id;
    const isOwner = bookingContactId && contactId &&
                    String(bookingContactId) === String(contactId);

    console.log('🔐 [OWNERSHIP] Verification:', {
      bookingContactId,
      authenticatedContactId: contactId,
      isOwner
    });

    if (!isOwner) {
      console.error('❌ [OWNERSHIP] User does not own this booking');
      const error = new Error('You do not have permission to cancel this booking');
      error.status = 403;
      error.code = 'FORBIDDEN';
      throw error;
    }

    // Normalize booking data structure
    const bookingData = booking;

    // Step 2: Check if already cancelled (is_active is TEXT: 'Active', 'Cancelled', 'Completed')
    if (bookingData.is_active !== 'Active') {
      console.log('⚠️ Booking already cancelled or completed:', bookingData.is_active);
      const error = new Error('Booking is already cancelled');
      error.status = 409;
      error.code = 'ALREADY_CANCELED';
      throw error;
    }

    // Step 3: Determine credit field to restore based on token_used
    const tokenUsed = bookingData.token_used;

    const tokenToCreditFieldMapping = {
      'Situational Judgment Token': 'sj_credits',
      'Clinical Skills Token': 'cs_credits',
      'Mini-mock Token': 'sjmini_credits',
      'Mock Discussion Token': 'mock_discussion_token',
      'Shared Token': 'shared_mock_credits'
    };

    const creditField = tokenToCreditFieldMapping[tokenUsed];

    // Get current credits to calculate restored value (only if we have a valid credit field)
    let currentCredits = null;
    let restoredCreditValue = null;

    if (creditField) {
      currentCredits = await getContactCreditsFromSupabase(
        bookingData.student_id,
        bookingData.student_email
      );
      restoredCreditValue = (currentCredits?.[creditField] || 0) + 1;

      console.log('💳 Credit restoration plan:', {
        tokenUsed,
        creditField,
        currentValue: currentCredits?.[creditField] || 0,
        restoredValue: restoredCreditValue
      });
    } else {
      console.warn(`⚠️ Unknown token type: ${tokenUsed}, skipping credit restoration (Admin Override or legacy booking)`);
    }

    // Step 4: Cancel booking (Supabase-first)
    // Use atomic RPC if credit restoration needed, otherwise simple update
    let cancellationResult;
    try {
      if (creditField && restoredCreditValue !== null) {
        // Standard cancellation with credit restoration via atomic RPC
        cancellationResult = await cancelBookingAtomic({
          bookingId: bookingData.id,  // UUID primary key
          creditField,
          restoredCreditValue
        });

        console.log('✅ Booking cancelled atomically with credit restoration:', {
          bookingId: bookingData.id,
          booking_code: bookingData.booking_id,
          creditField,
          restoredValue: restoredCreditValue
        });
      } else {
        // Admin Override or unknown token - cancel without credit restoration
        // Direct Supabase update (no RPC needed)
        const { createClient } = require('@supabase/supabase-js');
        const supabaseAdmin = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY,
          {
            auth: { persistSession: false, autoRefreshToken: false },
            db: { schema: process.env.SUPABASE_SCHEMA_NAME || 'hubspot_sync' }
          }
        );

        const { data, error: updateError } = await supabaseAdmin
          .from('hubspot_bookings')
          .update({
            is_active: 'Cancelled',
            updated_at: new Date().toISOString(),
            synced_at: new Date().toISOString()
          })
          .eq('id', bookingData.id)
          .select()
          .single();

        if (updateError) {
          throw new Error(updateError.message);
        }

        cancellationResult = {
          success: true,
          data: {
            booking_id: data.id,
            booking_hubspot_id: data.hubspot_id,
            student_id: data.student_id,
            mock_exam_id: data.associated_mock_exam
          }
        };

        console.log('✅ Booking cancelled (no credit restoration - Admin Override):', {
          bookingId: bookingData.id,
          booking_code: bookingData.booking_id,
          tokenUsed
        });
      }
    } catch (cancelError) {
      console.error('❌ Booking cancellation failed:', cancelError.message);
      const error = new Error('Failed to cancel booking');
      error.status = 500;
      error.code = 'CANCEL_FAILED';
      throw error;
    }

    // Step 5: Decrement Supabase total_bookings atomically
    const { updateExamBookingCountInSupabase } = require('../_shared/supabase-data');

    try {
      await updateExamBookingCountInSupabase(bookingData.associated_mock_exam, 1, 'decrement');
      console.log(`✅ [SUPABASE] Decremented exam ${bookingData.associated_mock_exam} total_bookings atomically`);
    } catch (supabaseError) {
      console.error(`❌ [SUPABASE] Failed to decrement total_bookings:`, supabaseError.message);
      // Non-blocking - continue even if Supabase update fails
    }

    // ========================================================================
    // DUAL WEBHOOK INTEGRATION - Sync to HubSpot (fire-and-forget)
    // ========================================================================
    const { HubSpotWebhookService } = require('../_shared/hubspot-webhook');

    // Decrement Redis counter for real-time capacity tracking
    const RedisLockService = require('../_shared/redis');
    const redis = new RedisLockService();
    const newTotalBookings = await redis.decr(`exam:${bookingData.associated_mock_exam}:bookings`);
    console.log(`✅ Decremented Redis counter: exam:${bookingData.associated_mock_exam}:bookings = ${newTotalBookings}`);

    // Fire-and-forget webhook sync
    process.nextTick(() => {
      (async () => {
        // Webhook 1: Sync exam total_bookings to HubSpot
        const examSyncResult = await HubSpotWebhookService.syncWithRetry(
          'totalBookings',
          bookingData.associated_mock_exam,
          newTotalBookings
        );

        if (examSyncResult.success) {
          console.log(`✅ [WEBHOOK-EXAM] HubSpot exam count synced after cancellation: ${examSyncResult.message}`);
        } else {
          console.error(`❌ [WEBHOOK-EXAM] Exam sync failed after cancellation: ${examSyncResult.message}`);
        }

        // Webhook 2: Sync contact credits to HubSpot (restore credit)
        // Only sync if we actually restored credits (skip for Admin Override bookings)
        if (creditField && currentCredits) {
          const restoredCredits = {
            sj_credits: currentCredits?.sj_credits || 0,
            cs_credits: currentCredits?.cs_credits || 0,
            sjmini_credits: currentCredits?.sjmini_credits || 0,
            mock_discussion_token: currentCredits?.mock_discussion_token || 0,
            shared_mock_credits: currentCredits?.shared_mock_credits || 0
          };

          // Update the restored field
          restoredCredits[creditField] = restoredCreditValue;

          const creditsSyncResult = await HubSpotWebhookService.syncContactCredits(
            contactId,
            bookingData.student_email,
            restoredCredits
          );

          if (creditsSyncResult.success) {
            console.log(`✅ [WEBHOOK-CREDITS] HubSpot credits synced after cancellation: ${creditsSyncResult.message}`);
          } else {
            console.error(`❌ [WEBHOOK-CREDITS] Credits sync failed after cancellation: ${creditsSyncResult.message}`);
          }
        } else {
          console.log(`ℹ️ [WEBHOOK-CREDITS] Skipping credit sync - no credit restoration for Admin Override booking`);
        }
      })().catch(err => {
        console.error('❌ [WEBHOOK] Unexpected error in webhook sync:', err.message);
      });
    });

    // Step 6: Invalidate caches
    try {
      // 6.1. Decrement counter was already done above

      // Validate counter value (ensure it's not negative due to race conditions)
      if (newTotalBookings < 0) {
        console.warn(`⚠️ [REDIS] Negative booking counter detected: ${newTotalBookings}, resetting to 0`);
        const counterKey = `exam:${bookingData.associated_mock_exam}:bookings`;
        const hubspot = new HubSpotService();
        const mockExam = await hubspot.getMockExam(bookingData.associated_mock_exam);

        if (mockExam) {
          const correctCount = parseInt(mockExam.properties.total_bookings) || 0;
          const TTL_1_WEEK = 7 * 24 * 60 * 60; // 604,800 seconds
          await redis.setex(counterKey, TTL_1_WEEK, correctCount);
          console.log(`✅ [REDIS] Counter corrected to ${correctCount} from HubSpot`);
        } else {
          // Reset to 0 if counter is invalid
          const TTL_1_WEEK = 7 * 24 * 60 * 60; // 604,800 seconds
          await redis.setex(counterKey, TTL_1_WEEK, 0);
          console.log(`✅ [REDIS] Reset counter to 0 for exam ${bookingData.associated_mock_exam}`);
        }
      }

      // 6.2. Invalidate duplicate detection cache (allows immediate rebooking)
      // Use associated_contact_id (numeric HubSpot contact ID) to match create.js format
      // Format: booking:{hubspot_contact_id}:{exam_date}
      // CRITICAL: Normalize exam_date to YYYY-MM-DD format to match create.js
      console.log(`🔍 [DEBUG] Cache invalidation check:`, {
        associated_contact_id: bookingData.associated_contact_id,
        exam_date: bookingData.exam_date,
        hasContactId: !!bookingData.associated_contact_id,
        hasExamDate: !!bookingData.exam_date
      });

      if (bookingData.associated_contact_id && bookingData.exam_date) {
        // Normalize date to YYYY-MM-DD format (Supabase returns ISO timestamp)
        // Extract just the date portion: "2026-03-01T00:00:00+00:00" -> "2026-03-01"
        const normalizedDate = bookingData.exam_date.split('T')[0];

        const duplicateKey = `booking:${bookingData.associated_contact_id}:${normalizedDate}`;
        console.log(`🔍 [DEBUG] Attempting to delete cache key: ${duplicateKey} (normalized date: ${normalizedDate})`);
        const deletedCount = await redis.del(duplicateKey);

        if (deletedCount > 0) {
          console.log(`✅ [REDIS] Invalidated duplicate cache: ${duplicateKey}`);
        } else {
          console.warn(`⚠️ [REDIS] Cache key not found: ${duplicateKey} (may have already expired or never existed)`);
        }
      } else {
        console.error(`❌ [REDIS] Cannot invalidate cache - missing data:`, {
          associated_contact_id: bookingData.associated_contact_id,
          exam_date: bookingData.exam_date
        });
      }

      // 6.3. Invalidate contact credits cache (ensures frontend gets updated tokens)
      if (bookingData.student_id) {
        const creditsCachePattern = `contact:credits:${bookingData.student_id}:*`;
        const creditsInvalidatedCount = await redis.cacheDeletePattern(creditsCachePattern);

        if (creditsInvalidatedCount > 0) {
          console.log(`✅ [CACHE] Invalidated ${creditsInvalidatedCount} credits cache entries`);
        }
      }

      await redis.close();
      console.log('✅ [CACHE] All cache invalidations complete');

    } catch (cacheError) {
      console.error('⚠️ [CACHE] Cache invalidation failed (non-blocking):', cacheError.message);
      // Continue - cache invalidation failures are non-critical
      // Cron job will eventually reconcile any stale cache data
    }

    // Step 7: Return success response
    return res.status(200).json(createSuccessResponse(
      {
        booking_id: bookingData.booking_id,
        student_id: bookingData.student_id,
        cancelled_at: new Date().toISOString(),
        credits_restored: creditField ? 1 : 0
      },
      'Booking cancelled successfully'
    ));

  } catch (error) {
    throw error;  // Re-throw to be handled by main handler
  }
}

module.exports = handler;