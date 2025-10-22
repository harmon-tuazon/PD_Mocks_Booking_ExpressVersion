require('dotenv').config();
const crypto = require('crypto');
const { HubSpotService, HUBSPOT_OBJECTS } = require('../_shared/hubspot');
const { schemas } = require('../_shared/validation');
const Joi = require('joi');
const { getCache } = require('../_shared/cache');
const RedisLockService = require('../_shared/redis');
const {
  setCorsHeaders,
  handleOptionsRequest,
  createErrorResponse,
  createSuccessResponse,
  verifyEnvironmentVariables,
  rateLimitMiddleware,
  sanitizeInput
} = require('../_shared/auth');

/**
 * Validation schema specific to Mock Discussion bookings
 */
const discussionBookingSchema = Joi.object({
  mock_exam_id: Joi.string()
    .required()
    .messages({
      'any.required': 'Mock Discussion ID is required'
    }),
  contact_id: Joi.string()
    .required()
    .messages({
      'any.required': 'Contact ID is required'
    }),
  student_id: Joi.string()
    .pattern(/^[A-Z0-9]+$/)
    .required()
    .messages({
      'string.pattern.base': 'Student ID must contain only uppercase letters and numbers',
      'any.required': 'Student ID is required'
    }),
  name: Joi.string()
    .min(2)
    .max(100)
    .required()
    .messages({
      'string.min': 'Name must be at least 2 characters long',
      'string.max': 'Name cannot exceed 100 characters',
      'any.required': 'Name is required'
    }),
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please enter a valid email address',
      'any.required': 'Email is required'
    }),
  exam_date: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .required()
    .messages({
      'string.pattern.base': 'Exam date must be in YYYY-MM-DD format',
      'any.required': 'Exam date is required'
    }),
  // Mock Discussion specific field - preferred discussion format
  discussion_format: Joi.string()
    .valid('Virtual', 'In-Person', 'Hybrid')
    .optional()
    .default('Virtual')
    .messages({
      'any.only': 'Discussion format must be Virtual, In-Person, or Hybrid'
    }),
  // Optional discussion topic preference
  topic_preference: Joi.string()
    .max(200)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Topic preference cannot exceed 200 characters'
    })
});

/**
 * Generate idempotency key from request data for Mock Discussions
 */
function generateIdempotencyKey(data) {
  const keyData = {
    contact_id: data.contact_id,
    mock_exam_id: data.mock_exam_id,
    exam_date: data.exam_date,
    mock_type: 'Mock Discussion',
    timestamp_bucket: Math.floor(Date.now() / (5 * 60 * 1000)) // 5-minute buckets
  };

  const keyString = JSON.stringify(keyData, Object.keys(keyData).sort());
  const hash = crypto.createHash('sha256').update(keyString).digest('hex');
  return `idem_disc_${hash.substring(0, 28)}`;
}

/**
 * Format date to full month name format
 */
function formatBookingDate(dateString) {
  try {
    const dateParts = dateString.split('-');
    if (dateParts.length !== 3) {
      throw new Error('Invalid date format');
    }

    const year = parseInt(dateParts[0]);
    const month = parseInt(dateParts[1]) - 1; // Month is 0-indexed in JavaScript
    const day = parseInt(dateParts[2]);

    const date = new Date(year, month, day);

    if (isNaN(date.getTime())) {
      throw new Error('Invalid date');
    }

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const monthName = monthNames[date.getMonth()];
    const formattedDay = date.getDate();
    const formattedYear = date.getFullYear();

    return `${monthName} ${formattedDay}, ${formattedYear}`;
  } catch (err) {
    console.error('Date formatting error:', err.message, 'for date:', dateString);
    return dateString; // Fallback to original format
  }
}

/**
 * POST /api/mock-discussions/create-booking
 * Create a new booking for a mock discussion session
 *
 * Request body:
 * - mock_exam_id: ID of the Mock Discussion (Mock Exam object with type="Mock Discussion")
 * - contact_id: HubSpot contact ID
 * - student_id: Student identifier
 * - name: Student name
 * - email: Student email
 * - exam_date: Date in YYYY-MM-DD format
 * - discussion_format: Virtual/In-Person/Hybrid (optional, defaults to Virtual)
 * - topic_preference: Optional topic preference text
 *
 * Creates a Booking object and:
 * 1. Associates it with the Contact
 * 2. Associates it with the Mock Exam (Discussion)
 * 3. Deducts one mock_discussion_token
 * 4. Updates total_bookings counter
 * 5. Creates a note in the contact timeline
 */
module.exports = async function handler(req, res) {
  let bookingCreated = false;
  let createdBookingId = null;
  let redis = null;
  let lockToken = null;
  let userLock = null; // For user-specific lock to prevent duplicates

  setCorsHeaders(res);

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return handleOptionsRequest(req, res);
  }

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

    // Validate input using the discussion-specific schema
    const { error, value: validatedData } = discussionBookingSchema.validate(req.body);
    if (error) {
      const validationError = new Error(`Invalid input: ${error.details.map(detail => detail.message).join(', ')}`);
      validationError.status = 400;
      validationError.code = 'VALIDATION_ERROR';
      throw validationError;
    }

    const {
      contact_id,
      mock_exam_id,
      student_id,
      name,
      email,
      exam_date,
      discussion_format,
      topic_preference
    } = validatedData;

    // Sanitize inputs
    const sanitizedName = sanitizeInput(name);
    const sanitizedEmail = sanitizeInput(email);

    // Initialize HubSpot service
    const hubspot = new HubSpotService();

    // Idempotency Check
    let idempotencyKey = req.headers['x-idempotency-key'];

    // If no header provided, generate key from request data
    if (!idempotencyKey) {
      idempotencyKey = generateIdempotencyKey(validatedData);
    }

    // Check for existing booking with this idempotency key
    const existingBooking = await hubspot.findBookingByIdempotencyKey(idempotencyKey);

    if (existingBooking) {
      const bookingStatus = existingBooking.properties.is_active;

      // If booking is Active or Completed, return cached response
      if (bookingStatus === 'Active' || bookingStatus === 'active' ||
          bookingStatus === 'Completed' || bookingStatus === 'completed') {

        console.log(`✅ Returning cached response for idempotent Mock Discussion request`);

        const cachedResponse = {
          booking_id: existingBooking.properties.booking_id,
          booking_record_id: existingBooking.id,
          confirmation_message: 'Your Mock Discussion booking has already been confirmed',
          idempotency_key: idempotencyKey,
          idempotent_request: true,
          exam_details: {
            mock_exam_id,
            exam_date,
            mock_type: 'Mock Discussion'
          }
        };

        return res.status(200).json(createSuccessResponse(cachedResponse, 'Mock Discussion booking already exists (idempotent request)'));
      }

      // If booking is Cancelled or Failed, generate new idempotency key
      if (bookingStatus === 'Cancelled' || bookingStatus === 'cancelled' ||
          bookingStatus === 'Failed' || bookingStatus === 'failed') {

        const newKeyData = {
          contact_id: validatedData.contact_id,
          mock_exam_id: validatedData.mock_exam_id,
          exam_date: validatedData.exam_date,
          mock_type: 'Mock Discussion',
          timestamp_bucket: Math.floor(Date.now() / (5 * 60 * 1000)) + 1,
          retry_after_cancel: true
        };

        const newKeyString = JSON.stringify(newKeyData, Object.keys(newKeyData).sort());
        idempotencyKey = `idem_disc_${crypto.createHash('sha256').update(newKeyString).digest('hex').substring(0, 28)}`;
      }
    }

    // Step 1: Generate booking ID and check for duplicates BEFORE acquiring lock
    // This prevents race conditions where two users book the same date simultaneously
    const formattedDate = formatBookingDate(exam_date);

    // Generate booking ID with Mock Discussion prefix, student ID, and formatted date
    // Format: "MockType-StudentID-Date" ensures uniqueness per student
    // This prevents same-name collision while maintaining duplicate detection
    const bookingId = `Mock Discussion-${student_id}-${formattedDate}`;

    // Check for duplicate booking BEFORE acquiring lock (prevents race condition)
    const isDuplicate = await hubspot.checkExistingBooking(bookingId);
    if (isDuplicate) {
      const error = new Error('Duplicate booking detected: You already have a Mock Discussion booking for this date');
      error.status = 400;
      error.code = 'DUPLICATE_BOOKING';
      throw error;
    }

    // ========================================================================
    // REDIS LOCK ACQUISITION - Two-phase locking for complete duplicate prevention
    // ========================================================================
    redis = new RedisLockService();

    // First lock: User + Date specific lock to prevent duplicate bookings by same user
    const userLockKey = `user_booking:${contact_id}:${exam_date}`;
    const userLockToken = await redis.acquireLockWithRetry(userLockKey, 3, 100, 5);

    if (!userLockToken) {
      const lockError = new Error('You are already processing a booking for this date. Please wait a moment.');
      lockError.status = 409;
      lockError.code = 'USER_BOOKING_IN_PROGRESS';
      throw lockError;
    }

    // Second lock: Session-level lock for capacity management
    lockToken = await redis.acquireLockWithRetry(mock_exam_id, 5, 100, 10);

    if (!lockToken) {
      // Release user lock if we can't get session lock
      await redis.releaseLock(userLockKey, userLockToken);

      const lockError = new Error('Unable to process Mock Discussion booking at this time. The system is experiencing high demand. Please try again in a moment.');
      lockError.status = 503;
      lockError.code = 'LOCK_ACQUISITION_FAILED';
      throw lockError;
    }

    console.log(`✅ Locks acquired successfully - User lock: ${userLockKey}, Session lock: ${mock_exam_id}`);

    // Store user lock info for cleanup
    userLock = { key: userLockKey, token: userLockToken };

    // Step 2: Verify mock discussion exists and has capacity
    const mockDiscussion = await hubspot.getMockExam(mock_exam_id);

    if (!mockDiscussion) {
      const error = new Error('Mock Discussion not found');
      error.status = 404;
      error.code = 'DISCUSSION_NOT_FOUND';
      throw error;
    }

    // Verify this is actually a Mock Discussion type
    if (mockDiscussion.properties.mock_type !== 'Mock Discussion') {
      const error = new Error('Invalid session type. This endpoint only accepts Mock Discussion bookings.');
      error.status = 400;
      error.code = 'INVALID_MOCK_TYPE';
      throw error;
    }

    // Check if discussion is active
    if (mockDiscussion.properties.is_active !== 'true') {
      const error = new Error('Mock Discussion is not available for booking');
      error.status = 400;
      error.code = 'DISCUSSION_NOT_ACTIVE';
      throw error;
    }

    // Check capacity
    const capacity = parseInt(mockDiscussion.properties.capacity) || 0;
    const totalBookings = parseInt(mockDiscussion.properties.total_bookings) || 0;

    if (totalBookings >= capacity) {
      const error = new Error('This Mock Discussion session is now full');
      error.status = 400;
      error.code = 'DISCUSSION_FULL';
      throw error;
    }

    // Step 3: Verify contact and mock discussion tokens
    const contact = await hubspot.apiCall('GET',
      `/crm/v3/objects/${HUBSPOT_OBJECTS.contacts}/${contact_id}?properties=student_id,email,mock_discussion_token`
    );

    if (!contact) {
      const error = new Error('Contact not found');
      error.status = 404;
      error.code = 'CONTACT_NOT_FOUND';
      throw error;
    }

    // Check mock discussion tokens
    const discussionTokens = parseInt(contact.properties.mock_discussion_token) || 0;

    if (discussionTokens <= 0) {
      const error = new Error('Insufficient Mock Discussion tokens for booking');
      error.status = 400;
      error.code = 'INSUFFICIENT_TOKENS';
      throw error;
    }

    // Step 4: Create booking with Mock Discussion specific data
    const bookingData = {
      bookingId,
      name: sanitizedName,
      email: sanitizedEmail,
      tokenUsed: 'Mock Discussion Token',
      idempotencyKey: idempotencyKey
      // Note: Calculated properties (mockType, examDate, location, etc.)
      // come from the associated Mock Exam object
    };

    // Add optional Mock Discussion fields if provided
    if (discussion_format && discussion_format !== 'Virtual') {
      bookingData.discussionFormat = discussion_format;
    }
    if (topic_preference) {
      bookingData.topicPreference = topic_preference;
    }

    const createdBooking = await hubspot.createBooking(bookingData);
    bookingCreated = true;
    createdBookingId = createdBooking.id;
    console.log(`✅ Mock Discussion booking created successfully with ID: ${createdBookingId}`);

    const associationResults = [];

    // Associate with Contact
    try {
      const contactAssociation = await hubspot.createAssociation(
        HUBSPOT_OBJECTS.bookings,
        createdBookingId,
        HUBSPOT_OBJECTS.contacts,
        contact_id
      );
      console.log('✅ Contact association created successfully:', contactAssociation);
      associationResults.push({ type: 'contact', success: true, result: contactAssociation });
    } catch (err) {
      console.error('❌ Failed to associate with contact:', err.message);
      associationResults.push({ type: 'contact', success: false, error: err.message });
    }

    // Associate with Mock Discussion (Mock Exam)
    try {
      const mockExamAssociation = await hubspot.createAssociation(
        HUBSPOT_OBJECTS.bookings,
        createdBookingId,
        HUBSPOT_OBJECTS.mock_exams,
        mock_exam_id
      );
      console.log('✅ Mock Discussion association created successfully:', mockExamAssociation);
      associationResults.push({ type: 'mock_discussion', success: true, result: mockExamAssociation });
    } catch (err) {
      console.error('❌ Failed to associate with mock discussion:', err);
      associationResults.push({ type: 'mock_discussion', success: false, error: err.message });
    }

    // Check critical associations
    const contactAssocSuccess = associationResults.find(r => r.type === 'contact')?.success || false;
    const mockDiscussionAssocSuccess = associationResults.find(r => r.type === 'mock_discussion')?.success || false;

    // Step 5: Update total bookings counter
    const newTotalBookings = totalBookings + 1;
    await hubspot.updateMockExamBookings(mock_exam_id, newTotalBookings);

    // ========================================================================
    // REDIS LOCK RELEASE - Release both locks after booking is confirmed
    // ========================================================================
    if (lockToken) {
      await redis.releaseLock(mock_exam_id, lockToken);
      lockToken = null;
      console.log(`✅ Session lock released successfully`);
    }

    if (userLock?.token) {
      await redis.releaseLock(userLock.key, userLock.token);
      userLock.token = null;
      console.log(`✅ User lock released successfully`);
    }

    // Step 6: Deduct mock discussion token
    const newTokenValue = Math.max(0, discussionTokens - 1);

    await hubspot.updateContactCredits(contact_id, 'mock_discussion_token', newTokenValue);

    // Step 7: Create Note in Contact timeline
    const discussionDataForNote = {
      exam_date,
      mock_type: 'Mock Discussion',
      location: mockDiscussion.properties.location || 'Virtual',
      discussion_format: discussion_format || 'Virtual',
      topic_preference: topic_preference || 'No preference specified'
    };

    // Create a custom note for Mock Discussion
    hubspot.apiCall('POST', `/crm/v3/objects/notes`, {
      properties: {
        hs_timestamp: new Date().getTime(),
        hs_note_body: `
          <h3>📝 Mock Discussion Booking Confirmed</h3>
          <p><strong>Student:</strong> ${sanitizedName}</p>
          <p><strong>Date:</strong> ${formattedDate}</p>
          <p><strong>Format:</strong> ${discussion_format || 'Virtual'}</p>
          <p><strong>Location:</strong> ${discussionDataForNote.location}</p>
          ${topic_preference ? `<p><strong>Topic Preference:</strong> ${topic_preference}</p>` : ''}
          <p><strong>Booking ID:</strong> ${bookingId}</p>
          <p><strong>Token Used:</strong> Mock Discussion Token</p>
          <p><strong>Remaining Tokens:</strong> ${newTokenValue}</p>
          <hr>
          <p style="color: #666; font-size: 0.9em;">Booking created at ${new Date().toISOString()}</p>
        `
      }
    }).then(async (note) => {
      // Associate note with contact
      await hubspot.createAssociation('notes', note.id, HUBSPOT_OBJECTS.contacts, contact_id);
      console.log(`✅ Mock Discussion booking note created successfully`);
    }).catch(err => {
      console.error(`❌ Error creating Mock Discussion booking note:`, err.message);
    });

    // Determine overall success
    const associationWarnings = [];

    if (!contactAssocSuccess) {
      associationWarnings.push('Contact association failed - booking may not appear in student records');
    }
    if (!mockDiscussionAssocSuccess) {
      associationWarnings.push('Mock Discussion association failed - session may not show booking count update');
    }

    // Prepare response
    const responseData = {
      booking_id: bookingId,
      booking_record_id: createdBookingId,
      confirmation_message: `Your Mock Discussion booking for ${formattedDate} has been confirmed`,
      idempotency_key: idempotencyKey,
      exam_details: {
        mock_exam_id,
        exam_date,
        mock_type: 'Mock Discussion',
        location: mockDiscussion.properties.location || 'Virtual',
        discussion_format: discussion_format || 'Virtual'
      },
      token_details: {
        tokens_before: discussionTokens,
        tokens_deducted: 1,
        tokens_remaining: newTokenValue
      },
      associations: {
        results: associationResults,
        warnings: associationWarnings,
        critical_success: contactAssocSuccess && mockDiscussionAssocSuccess
      }
    };

    if (topic_preference) {
      responseData.exam_details.topic_preference = topic_preference;
    }

    if (associationWarnings.length > 0) {
      console.log('⚠️ Mock Discussion booking successful with association warnings:', associationWarnings);
    } else {
      console.log('✅ Mock Discussion booking and all associations successful');
    }

    // Invalidate cache for this contact
    try {
      const cache = getCache();
      const cachePattern = `bookings:contact:${contact_id}:*`;

      const invalidatedCount = await cache.deletePattern(cachePattern);

      if (invalidatedCount > 0) {
        console.log(`✅ [Cache Invalidation] Successfully invalidated ${invalidatedCount} cache entries for contact ${contact_id}`);
      } else {
        console.log(`ℹ️ [Cache Invalidation] No cache entries found to invalidate`);
      }
    } catch (cacheError) {
      console.error('❌ Cache invalidation failed:', cacheError.message);
      // Continue - cache invalidation failure shouldn't block booking
    }

    return res.status(201).json(createSuccessResponse(responseData, 'Mock Discussion booking created successfully'));

  } catch (error) {
    console.error('❌ Mock Discussion booking creation error:', {
      message: error.message,
      status: error.status || 500,
      code: error.code || 'INTERNAL_ERROR',
      stack: error.stack
    });

    // Cleanup if needed
    if (bookingCreated && createdBookingId) {
      try {
        const hubspot = new HubSpotService();
        await hubspot.deleteBooking(createdBookingId);
        console.log(`✅ Cleanup successful: Mock Discussion booking ${createdBookingId} deleted`);
      } catch (cleanupError) {
        console.error('❌ Cleanup failed:', cleanupError.message);
      }
    }

    const statusCode = error.status || 500;
    const errorResponse = createErrorResponse(error);

    return res.status(statusCode).json(errorResponse);

  } finally {
    // ========================================================================
    // REDIS CLEANUP - Release both locks if they haven't been released
    // ========================================================================
    if (lockToken && redis) {
      try {
        await redis.releaseLock(mock_exam_id, lockToken);
        console.log(`✅ [Finally] Session lock released successfully`);
      } catch (finallyError) {
        console.error(`❌ [Finally] Failed to release session lock:`, finallyError.message);
      }
    }

    if (userLock?.token && redis) {
      try {
        await redis.releaseLock(userLock.key, userLock.token);
        console.log(`✅ [Finally] User lock released successfully`);
      } catch (finallyError) {
        console.error(`❌ [Finally] Failed to release user lock:`, finallyError.message);
      }
    }

    if (redis) {
      try {
        await redis.close();
      } catch (closeError) {
        console.error(`❌ [Finally] Failed to close Redis connection:`, closeError.message);
      }
    }
  }
};