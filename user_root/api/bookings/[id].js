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
const { getCache } = require('../_shared/cache');

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

    // Initialize HubSpot service
    const hubspot = new HubSpotService();

    // Step 1: Authenticate user by finding contact
    const contact = await hubspot.searchContacts(sanitizedStudentId, sanitizedEmail);

    if (!contact) {
      const error = new Error('Authentication failed. Please check your Student ID and email.');
      error.status = 401;
      error.code = 'AUTH_FAILED';
      throw error;
    }

    const contactId = contact.id;
    console.log(`✅ Contact authenticated: ${contactId} - ${contact.properties.firstname} ${contact.properties.lastname}`);

    // Handle GET request
    if (req.method === 'GET') {
      return await handleGetRequest(req, res, hubspot, sanitizedBookingId, contactId, contact);
    }

    // Handle DELETE request
    if (req.method === 'DELETE') {
      return await handleDeleteRequest(req, res, hubspot, sanitizedBookingId, contactId, contact, reason, sanitizedStudentId);
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
      associated_contact_id: booking.associated_contact_id // For cache invalidation
    });
   

    // Normalize booking data structure
    const bookingData = booking;

    // Step 2: Check if already cancelled (Supabase uses boolean is_active)
    if (!bookingData.is_active) {
      console.log('⚠️ Booking already cancelled');
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

    if (!creditField) {
      console.warn(`⚠️ Unknown token type: ${tokenUsed}, cannot restore credits`);
    }

    // Get current credits to calculate restored value
    const currentCredits = await getContactCreditsFromSupabase(
      bookingData.student_id,
      bookingData.student_email
    );

    const restoredCreditValue = (currentCredits?.[creditField] || 0) + 1;

    console.log('💳 Credit restoration plan:', {
      tokenUsed,
      creditField,
      currentValue: currentCredits?.[creditField] || 0,
      restoredValue: restoredCreditValue
    });

    // Step 4: Cancel booking atomically (Supabase-first)
    let cancellationResult;
    try {
      cancellationResult = await cancelBookingAtomic({
        bookingId: bookingData.id,  // UUID primary key
        creditField,
        restoredCreditValue
      });

      console.log('✅ Booking cancelled atomically:', {
        bookingId: bookingData.id,
        booking_code: bookingData.booking_id,
        creditField,
        restoredValue: restoredCreditValue
      });
    } catch (cancelError) {
      console.error('❌ Atomic cancellation failed:', cancelError.message);
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
    const redis = new RedisLockService();
    const newTotalBookings = await redis.decr(`exam:${bookingData.associated_mock_exam}:bookings`);
    console.log(`✅ Decremented Redis counter: exam:${bookingData.associated_mock_exam}:bookings = ${newTotalBookings}`);

    // Fire-and-forget webhook sync
    process.nextTick(() => {
      (async () => {
        // Webhook 1: Sync exam total_bookings to HubSpot
        const examSyncResult = await HubSpotWebhookService.syncWithRetry(
          bookingData.associated_mock_exam,
          newTotalBookings,
          3 // 3 retries with exponential backoff
        );

        if (examSyncResult.success) {
          console.log(`✅ [WEBHOOK-EXAM] HubSpot exam count synced after cancellation: ${examSyncResult.message}`);
        } else {
          console.error(`❌ [WEBHOOK-EXAM] Exam sync failed after cancellation: ${examSyncResult.message}`);
        }

        // Webhook 2: Sync contact credits to HubSpot (restore credit)
        const restoredCredits = {
          sj_credits: currentCredits?.sj_credits || 0,
          cs_credits: currentCredits?.cs_credits || 0,
          sjmini_credits: currentCredits?.sjmini_credits || 0,
          mock_discussion_token: currentCredits?.mock_discussion_token || 0,
          shared_mock_credits: currentCredits?.shared_mock_credits || 0
        };

        // Update the restored field
        if (creditField) {
          restoredCredits[creditField] = restoredCreditValue;
        }

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
          const TTL_30_DAYS = 30 * 24 * 60 * 60;
          await redis.setex(counterKey, TTL_30_DAYS, correctCount);
          console.log(`✅ [REDIS] Counter corrected to ${correctCount} from HubSpot`);
        } else {
          // Reset to 0 if counter is invalid
          const TTL_30_DAYS = 30 * 24 * 60 * 60;
          await redis.setex(counterKey, TTL_30_DAYS, 0);
          console.log(`✅ [REDIS] Reset counter to 0 for exam ${bookingData.associated_mock_exam}`);
        }
      }

      // 6.2. Invalidate duplicate detection cache (allows immediate rebooking)
      // ✅ FIX: Use associated_contact_id (HubSpot numeric ID) to match create.js format
      if (bookingData.associated_contact_id && bookingData.exam_date) {
        const duplicateKey = `booking:${bookingData.associated_contact_id}:${bookingData.exam_date}`;
        const deletedCount = await redis.del(duplicateKey);
        
        if (deletedCount > 0) {
          console.log(`✅ [REDIS] Invalidated duplicate cache: ${duplicateKey}`);
        }
      }

      // 6.3. Invalidate contact credits cache (ensures frontend gets updated tokens)
      if (bookingData.student_id) {
        const cache = getCache();
        const creditsCachePattern = `contact:credits:${bookingData.student_id}:*`;
        const creditsInvalidatedCount = await cache.deletePattern(creditsCachePattern);
        
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