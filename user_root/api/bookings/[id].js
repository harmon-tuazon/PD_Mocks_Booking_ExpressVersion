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
      return await handleDeleteRequest(req, res, hubspot, sanitizedBookingId, contactId, contact, reason);
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
async function handleDeleteRequest(req, res, hubspot, bookingId, contactId, contact, reason) {
  try {
    console.log('🗑️ [DELETE] Processing enhanced booking cancellation:', {
      bookingId,
      contactId,
      reason
    });

    // Step 1: Get comprehensive booking data with associations
    let booking;
    try {
      booking = await hubspot.getBookingWithAssociations(bookingId);
      console.log('✅ Booking found with associations:', {
        id: booking.id || booking.data?.id,
        booking_id: booking.data?.properties?.booking_id || booking.properties?.booking_id,
        status: booking.data?.properties?.status || booking.properties?.status,
        is_active: booking.data?.properties?.is_active || booking.properties?.is_active,
        hasContactAssoc: !!(booking.associations?.[HUBSPOT_OBJECTS.contacts]?.results?.length),
        hasMockExamAssoc: !!(booking.associations?.[HUBSPOT_OBJECTS.mock_exams]?.results?.length)
      });
    } catch (error) {
      console.error('❌ Booking not found:', bookingId);
      const notFoundError = new Error('Booking not found');
      notFoundError.status = 404;
      notFoundError.code = 'BOOKING_NOT_FOUND';
      throw notFoundError;
    }

    // Normalize booking data structure
    const bookingData = booking.data || booking;
    const bookingProperties = bookingData.properties || {};

    // Step 2: Check if already cancelled
    const currentStatus = bookingProperties.status;
    const isActive = bookingProperties.is_active;

    // Check both status field and is_active field for cancelled state
    if (currentStatus === 'canceled' || currentStatus === 'cancelled' ||
        isActive === 'Cancelled' || isActive === 'cancelled' ||
        isActive === false || isActive === 'false') {
      console.log('⚠️ Booking already cancelled');
      const error = new Error('Booking is already cancelled');
      error.status = 409;
      error.code = 'ALREADY_CANCELED';
      throw error;
    }

    // Step 3: Get Mock Exam details if associated
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
          console.log('✅ Mock Exam details retrieved:', {
            id: mockExamId,
            mock_type: mockExamDetails.mock_type,
            exam_date: mockExamDetails.exam_date,
            location: mockExamDetails.location
          });
        }
      } catch (examError) {
        console.warn('⚠️ Failed to fetch Mock Exam details:', examError.message);
        // Continue without Mock Exam details
      }
    }

    // Step 4: Prepare cancellation data for note
    const cancellationData = {
      booking_id: bookingProperties.booking_id || bookingData.id,
      mock_type: mockExamDetails?.mock_type || bookingProperties.mock_type || 'Mock Exam',
      exam_date: mockExamDetails?.exam_date || bookingProperties.exam_date,
      location: mockExamDetails?.location || bookingProperties.location || 'Location TBD',
      name: bookingProperties.name || contact.properties?.firstname + ' ' + contact.properties?.lastname,
      email: bookingProperties.email || contact.properties?.email,
      reason: reason || 'User requested cancellation',
      token_used: bookingProperties.token_used || 'Not specified'
    };

    console.log('📝 Cancellation data prepared:', cancellationData);

    // Step 5: Create cancellation note on Contact timeline
    let noteCreated = false;
    if (contactId) {
      try {
        await hubspot.createBookingCancellationNote(contactId, cancellationData);
        console.log(`✅ Cancellation note created for Contact ${contactId}`);
        noteCreated = true;
      } catch (noteError) {
        console.error('❌ Failed to create cancellation note:', noteError.message);
        // Continue with deletion even if note creation fails
      }
    } else {
      console.warn('⚠️ No Contact ID available for note creation');
    }

    // Step 6: Decrement Mock Exam total_bookings if associated
    let bookingsDecremented = false;
    if (mockExamId) {
      try {
        // Get current total_bookings value
        const currentTotal = parseInt(mockExamDetails?.total_bookings) || 0;

        // Only decrement if there are bookings to decrement
        if (currentTotal > 0) {
          const newTotal = currentTotal - 1;
          await hubspot.updateMockExamBookings(mockExamId, newTotal);
          console.log(`✅ Decremented Mock Exam ${mockExamId} total_bookings from ${currentTotal} to ${newTotal}`);
          bookingsDecremented = true;
        } else {
          console.log(`⚠️ Mock Exam ${mockExamId} total_bookings is already 0, skipping decrement`);
        }
      } catch (decrementError) {
        console.error('❌ Failed to decrement Mock Exam total_bookings:', decrementError.message);
        // Continue with deletion even if decrement fails
      }
    }

    // Step 6.5: Restore credits to contact
    let creditsRestored = null;
    const tokenUsed = bookingProperties.token_used;

    if (contactId && tokenUsed) {
      try {
        console.log('💳 Restoring credits for cancelled booking:', {
          contactId,
          tokenUsed,
          currentCredits: {
            sj_credits: parseInt(contact.properties?.sj_credits) || 0,
            cs_credits: parseInt(contact.properties?.cs_credits) || 0,
            sjmini_credits: parseInt(contact.properties?.sjmini_credits) || 0,
            shared_mock_credits: parseInt(contact.properties?.shared_mock_credits) || 0
          }
        });

        const currentCredits = {
          sj_credits: parseInt(contact.properties?.sj_credits) || 0,
          cs_credits: parseInt(contact.properties?.cs_credits) || 0,
          sjmini_credits: parseInt(contact.properties?.sjmini_credits) || 0,
          shared_mock_credits: parseInt(contact.properties?.shared_mock_credits) || 0
        };

        creditsRestored = await hubspot.restoreCredits(contactId, tokenUsed, currentCredits);
        console.log('✅ Credits restored successfully:', creditsRestored);
      } catch (creditError) {
        console.error('❌ Failed to restore credits:', creditError.message);
        // Continue with cancellation even if credit restoration fails
        // This ensures booking is still cancelled but admin may need to manually restore credits
      }
    } else {
      console.warn('⚠️ Cannot restore credits: missing contactId or tokenUsed property');
    }

    // Step 7: Perform soft delete (mark as cancelled)
    try {
      await hubspot.softDeleteBooking(bookingId);
      console.log(`✅ Booking ${bookingId} marked as cancelled`);
    } catch (deleteError) {
      console.error('❌ Failed to soft delete booking:', deleteError);
      const softDeleteError = new Error('Failed to cancel booking');
      softDeleteError.status = 500;
      softDeleteError.code = 'SOFT_DELETE_FAILED';
      throw softDeleteError;
    }

    // Step 7.5: Update Redis counters and invalidate cache (CRITICAL for eventual consistency + ENHANCED LOGGING)
    console.log(`🔍 [REDIS DEBUG] Starting user cancellation cache invalidation for booking ${bookingId}`);
    console.log(`🔍 [REDIS DEBUG] - contactId: ${contactId}`);
    console.log(`🔍 [REDIS DEBUG] - mockExamId: ${mockExamId}`);

    const RedisLockService = require('../_shared/redis');
    const redis = new RedisLockService();

    try {
      console.log(`🔍 [REDIS DEBUG] Redis instance created successfully`);

      // 1. Decrement Redis counter immediately (real-time availability update)
      if (mockExamId) {
        const counterKey = `exam:${mockExamId}:bookings`;
        const counterBefore = await redis.get(counterKey);
        const currentCount = parseInt(counterBefore) || 0;
        console.log(`🔍 [REDIS DEBUG] Counter before decrement: ${counterBefore}`);

        // Safety check: Don't decrement below 0 (indicates counter drift)
        if (currentCount <= 0) {
          console.warn(`⚠️ [REDIS] Counter is already at ${currentCount}, cannot decrement. Setting to 0.`);
          console.warn(`⚠️ [REDIS] This indicates counter drift - reconciliation cron will fix this.`);

          // Preserve TTL when resetting to 0
          const TTL_90_DAYS = 90 * 24 * 60 * 60; // 7,776,000 seconds
          await redis.setex(counterKey, TTL_90_DAYS, 0);
          console.log(`✅ Redis counter reset to 0 for exam ${mockExamId} (TTL preserved: 90 days)`);
        } else {
          const newCount = await redis.decr(counterKey);
          console.log(`🔍 [REDIS DEBUG] Counter after decrement: ${newCount}`);
          console.log(`✅ Redis counter decremented for exam ${mockExamId}: ${counterBefore} → ${newCount}`);
        }
      } else {
        console.warn(`⚠️ [REDIS DEBUG] No mockExamId found, skipping counter decrement`);
      }

      // 2. Invalidate duplicate detection cache (CRITICAL for rebooking)
      // This allows the user to immediately book the same date again
      const exam_date = mockExamDetails?.exam_date || bookingProperties.exam_date;
      console.log(`🔍 [REDIS DEBUG] - exam_date: ${exam_date}`);

      if (contactId && exam_date) {
        const redisKey = `booking:${contactId}:${exam_date}`;
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
          console.log(`✅ [REDIS] Successfully invalidated duplicate cache: ${redisKey}`);
        } else {
          console.error(`❌ [REDIS] CRITICAL: Cache key still exists after deletion! Value: ${keyExistsAfter}`);
        }
      } else {
        console.warn(`⚠️ [REDIS DEBUG] Cannot invalidate cache - missing data:`, {
          hasContactId: !!contactId,
          hasExamDate: !!exam_date
        });
      }

      await redis.close();
      console.log(`🔍 [REDIS DEBUG] Redis connection closed successfully`);
    } catch (redisError) {
      console.error('❌ [REDIS] Cache invalidation FAILED:', {
        error: redisError.message,
        stack: redisError.stack,
        contactId,
        mockExamId,
        exam_date: mockExamDetails?.exam_date || bookingProperties.exam_date
      });
      // Continue - Redis failure shouldn't block cancellation
      // Reconciliation cron job will fix any drift
    }

    // Step 8: Return success response with detailed actions
    const responseData = {
      booking_id: bookingProperties.booking_id || bookingId,
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      actions_completed: {
        soft_delete: true,
        note_created: noteCreated,
        bookings_decremented: bookingsDecremented,
        credits_restored: !!creditsRestored
      },
      ...(creditsRestored ? { credit_restoration: creditsRestored } : {}),
      ...(reason ? { reason } : {})
    };

    console.log('✅ Booking cancellation completed successfully with enhanced actions:', responseData.actions_completed);

    return res.status(200).json(createSuccessResponse(
      responseData,
      'Booking cancelled successfully'
    ));

  } catch (error) {
    throw error;  // Re-throw to be handled by main handler
  }
}

module.exports = handler;