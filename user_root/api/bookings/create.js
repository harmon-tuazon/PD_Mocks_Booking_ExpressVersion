require('dotenv').config();
const crypto = require('crypto');
const { HubSpotService, HUBSPOT_OBJECTS } = require('../_shared/hubspot');
const { schemas } = require('../_shared/validation');
const { getCache } = require('../_shared/cache');
const RedisLockService = require('../_shared/redis');
const {
  getContactCreditsFromSupabase,
  createBookingAtomic,
  checkIdempotencyKey
} = require('../_shared/supabase-data');
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
 * Generate idempotency key from request data
 * Uses SHA-256 hash of deterministic request components
 * @param {object} data - Request data
 * @returns {string} - Idempotency key
 */
function generateIdempotencyKey(data) {
  const keyData = {
    contact_id: data.contact_id,
    mock_exam_id: data.mock_exam_id,
    exam_date: data.exam_date,
    mock_type: data.mock_type,
    timestamp_bucket: Math.floor(Date.now() / (5 * 60 * 1000)) // 5-minute buckets
  };

  const keyString = JSON.stringify(keyData, Object.keys(keyData).sort());
  const hash = crypto.createHash('sha256').update(keyString).digest('hex');
  return `idem_${hash.substring(0, 32)}`;
}

/**
 * Determine which credit to deduct based on mock type
 */
function getCreditFieldToDeduct(mockType, creditBreakdown) {
  if (!creditBreakdown) {
    throw new Error('Credit breakdown not provided');
  }

  // For Mini-mock, only use specific credits
  if (mockType === 'Mini-mock') {
    return 'sjmini_credits';
  }

  // For Mock Discussion, only use specific credits
  if (mockType === 'Mock Discussion') {
    return 'mock_discussion_token';
  }

  // For other types, prefer specific credits, then shared
  if (mockType === 'Situational Judgment') {
    return creditBreakdown.specific_credits > 0 ? 'sj_credits' : 'shared_mock_credits';
  }

  if (mockType === 'Clinical Skills') {
    return creditBreakdown.specific_credits > 0 ? 'cs_credits' : 'shared_mock_credits';
  }

  throw new Error('Invalid mock type for credit deduction');
}

/**
 * Map credit field to token_used property value
 */
function mapCreditFieldToTokenUsed(creditField) {
  const mapping = {
    'sj_credits': 'Situational Judgment Token',
    'cs_credits': 'Clinical Skills Token',
    'sjmini_credits': 'Mini-mock Token',
    'mock_discussion_token': 'Mock Discussion Token',
    'shared_mock_credits': 'Shared Token'
  };

  return mapping[creditField] || 'Unknown Token';
}

/**
 * POST /api/bookings/create
 * Create a new booking for a mock exam slot and handle all associations
 */
module.exports = async function handler(req, res) {
  let bookingCreated = false;
  let createdBookingId = null;
  let redis = null;
  let lockToken = null;
  let userLock = null; // For user-specific lock to prevent duplicates
  let mock_exam_id = null; // Declare at function scope for finally block access

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

    // Validate input using the bookingCreation schema
    const { error, value: validatedData } = schemas.bookingCreation.validate(req.body);
    if (error) {
      const validationError = new Error(`Invalid input: ${error.details.map(detail => detail.message).join(', ')}`);
      validationError.status = 400;
      validationError.code = 'VALIDATION_ERROR';
      throw validationError;
    }

    const {
      contact_id,
      hubspot_id,  // ✅ Extract hubspot_id from request (numeric HubSpot ID)
      student_id,
      name,
      email,
      exam_date,
      mock_type,
      dominant_hand,
      attending_location
    } = validatedData;

    // Assign to function-scoped variable for finally block access
    mock_exam_id = validatedData.mock_exam_id;

    // Transform location to proper display name
    const locationDisplayNames = {
      'mississauga': 'Mississauga',
      'calgary': 'Calgary',
      'vancouver': 'Vancouver',
      'montreal': 'Montreal',
      'richmond_hill': 'Richmond Hill'
    };
    const formattedLocation = attending_location ? (locationDisplayNames[attending_location] || attending_location) : null;

    // Sanitize inputs
    const sanitizedName = sanitizeInput(name);
    const sanitizedEmail = sanitizeInput(email);

    // Initialize HubSpot service
    const hubspot = new HubSpotService();

    // Idempotency Check: Check for duplicate requests within 5-minute window
    let idempotencyKey = req.headers['x-idempotency-key'];

    // If no header provided, generate key from request data
    if (!idempotencyKey) {
      idempotencyKey = generateIdempotencyKey(validatedData);
    }

    // Check for existing booking with this idempotency key
    const existingBooking = await hubspot.findBookingByIdempotencyKey(idempotencyKey);

    if (existingBooking) {
      const bookingStatus = existingBooking.properties.is_active;

      // If booking is Active or Completed, return cached response (not 201 but 200)
      if (bookingStatus === 'Active' || bookingStatus === 'active' ||
          bookingStatus === 'Completed' || bookingStatus === 'completed') {

        console.log(`✅ Returning cached response for idempotent request`);

        // Build response similar to successful creation
        const cachedResponse = {
          booking_id: existingBooking.properties.booking_id,
          booking_record_id: existingBooking.id,
          confirmation_message: `Your booking has already been confirmed`,
          idempotency_key: idempotencyKey,
          idempotent_request: true,
          exam_details: {
            mock_exam_id,
            exam_date,
            mock_type
          }
        };

        // Return 200 OK (not 201 Created) for idempotent cached response
        return res.status(200).json(createSuccessResponse(cachedResponse, 'Booking already exists (idempotent request)'));
      }

      // If booking is Cancelled or Failed, generate new idempotency key and proceed
      if (bookingStatus === 'Cancelled' || bookingStatus === 'cancelled' ||
          bookingStatus === 'Failed' || bookingStatus === 'failed') {

        // Generate new key with different timestamp bucket to allow rebooking
        const newKeyData = {
          contact_id: validatedData.contact_id,
          mock_exam_id: validatedData.mock_exam_id,
          exam_date: validatedData.exam_date,
          mock_type: validatedData.mock_type,
          timestamp_bucket: Math.floor(Date.now() / (5 * 60 * 1000)) + 1, // Force different bucket
          retry_after_cancel: true
        };

        const newKeyString = JSON.stringify(newKeyData, Object.keys(newKeyData).sort());
        idempotencyKey = `idem_${crypto.createHash('sha256').update(newKeyString).digest('hex').substring(0, 32)}`;
      }
    }

    // Step 1: Generate booking ID and check for duplicates BEFORE acquiring lock
    // This prevents race conditions where two users book the same date simultaneously

    // Function to convert YYYY-MM-DD to "Month Day, Year" format
    const formatBookingDate = (dateString) => {
      try {
        // Parse the date string (expecting YYYY-MM-DD format)
        const dateParts = dateString.split('-');
        if (dateParts.length !== 3) {
          throw new Error('Invalid date format');
        }

        const year = parseInt(dateParts[0]);
        const month = parseInt(dateParts[1]) - 1; // Month is 0-indexed in JavaScript
        const day = parseInt(dateParts[2]);

        // Create date object using local timezone
        const date = new Date(year, month, day);

        // Verify the date is valid
        if (isNaN(date.getTime())) {
          throw new Error('Invalid date');
        }

        // Format the date with full month name
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
        // Fallback to original format if parsing fails
        return dateString;
      }
    };

    // Format the date for the booking ID
    const formattedDate = formatBookingDate(exam_date);

    // Generate booking ID with mock type, student ID, and formatted date
    // Format: "MockType-StudentID-Date" ensures uniqueness per student
    // This prevents same-name collision while maintaining duplicate detection
    const bookingId = `${mock_type}-${student_id}-${formattedDate}`;

    // ========================================================================
    // REDIS-BASED DUPLICATE DETECTION - Two-tier system for 80-90% API call reduction
    // ========================================================================
    redis = new RedisLockService();

    const redisKey = `booking:${hubspot_id}:${exam_date}`;
    const cachedResult = await redis.get(redisKey);

    // TIER 1: Check Redis first (fast path - no HubSpot API call)
    if (cachedResult === 'NO_DUPLICATE') {
      // Redis confirms no duplicate within cache window - fast approval
      console.log(`✅ Redis cache hit: No duplicate found for contact ${contact_id} on ${exam_date}`);
    } else if (cachedResult && cachedResult !== 'NO_DUPLICATE') {
      // Cache contains booking_id:status (e.g., "12345:Active")
      const [cachedBookingId, status] = cachedResult.split(':');

      if (status === 'Active') {
        // Active booking exists - fast rejection (no HubSpot call needed)
        console.log(`❌ Redis cache hit: Active booking ${cachedBookingId} found for contact ${contact_id} on ${exam_date}`);
        const error = new Error('Duplicate booking detected: You already have an active booking for this exam date');
        error.status = 400;
        error.code = 'DUPLICATE_BOOKING';
        throw error;
      } else {
        // Booking exists but is cancelled - fall through to HubSpot verification
        console.log(`⚠️ Redis cache: Cancelled booking ${cachedBookingId} found, verifying with HubSpot`);
      }
    } else {
      console.log(`⚠️ Redis cache miss: No cache entry found for contact ${contact_id} on ${exam_date}`);
    }

    // TIER 2: Redis cache miss OR cancelled booking - verify with HubSpot for data integrity
    if (!cachedResult || (cachedResult && cachedResult !== 'NO_DUPLICATE' && !cachedResult.includes('Active'))) {
      const isDuplicate = await hubspot.checkExistingBooking(bookingId);
      if (isDuplicate) {
        // Active duplicate found in HubSpot - cache it
        console.log(`❌ HubSpot verification: Active booking found for ${bookingId}`);
        const examDateTime = new Date(`${exam_date}T23:59:59Z`);
        const ttlSeconds = Math.max((examDateTime - Date.now()) / 1000, 86400);
        await redis.setex(redisKey, Math.floor(ttlSeconds), `${bookingId}:Active`);

        const error = new Error('Duplicate booking detected: You already have a booking for this exam date');
        error.status = 400;
        error.code = 'DUPLICATE_BOOKING';
        throw error;
      }

      // No active duplicate - cache negative result (3-hour TTL for negative cache)
      console.log(`✅ HubSpot verification: No duplicate found for ${bookingId}, caching result`);
      await redis.setex(redisKey, 10800, 'NO_DUPLICATE');  // 3 hours
    }

    // ========================================================================
    // REDIS LOCK ACQUISITION - Two-phase locking for complete duplicate prevention
    // ========================================================================

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

      const lockError = new Error('Unable to process booking at this time. The system is experiencing high demand. Please try again in a moment.');
      lockError.status = 503;
      lockError.code = 'LOCK_ACQUISITION_FAILED';
      throw lockError;
    }

    console.log(`✅ Locks acquired successfully - User lock: ${userLockKey}, Session lock: ${mock_exam_id}`);

    // Store user lock info for cleanup
    userLock = { key: userLockKey, token: userLockToken };

    // Step 2: Verify mock exam exists and has capacity
    // CRITICAL: Re-fetch exam data AFTER acquiring lock to ensure fresh capacity data
    const mockExam = await hubspot.getMockExam(mock_exam_id);

    if (!mockExam) {
      const error = new Error('Mock exam not found');
      error.status = 404;
      error.code = 'EXAM_NOT_FOUND';
      throw error;
    }

    // Check if exam is active
    if (mockExam.properties.is_active !== 'true') {
      const error = new Error('Mock exam is not available for booking');
      error.status = 400;
      error.code = 'EXAM_NOT_ACTIVE';
      throw error;
    }

    // Check capacity - CRITICAL: Read from Redis for real-time accuracy (prevents overbooking)
    const capacity = parseInt(mockExam.properties.capacity) || 0;

    // TIER 1: Try Redis first (real-time, authoritative source)
    let totalBookings = await redis.get(`exam:${mock_exam_id}:bookings`);

    // TIER 2: Fallback to HubSpot if Redis doesn't have it yet
    if (totalBookings === null) {
      totalBookings = parseInt(mockExam.properties.total_bookings) || 0;
      // Seed Redis with current HubSpot value (TTL: 30 days for self-healing)
      const TTL_30_DAYS = 30 * 24 * 60 * 60; // 2,592,000 seconds
      await redis.setex(`exam:${mock_exam_id}:bookings`, TTL_30_DAYS, totalBookings);
      console.log(`📊 Redis cache seeded: exam:${mock_exam_id}:bookings = ${totalBookings} (TTL: 30 days)`);
    } else {
      totalBookings = parseInt(totalBookings);
      console.log(`📊 Redis cache hit: exam:${mock_exam_id}:bookings = ${totalBookings}`);
    }

    // CRITICAL: This check now uses real-time Redis data to prevent overbooking
    if (totalBookings >= capacity) {
      const error = new Error('This mock exam session is now full');
      error.status = 400;
      error.code = 'EXAM_FULL';
      throw error;
    }

    // Step 3: Verify contact and credits (Supabase-first for performance)
    let contact = null;

    // PHASE 1: Try Supabase secondary database first (fast path ~50ms)
    try {
      const supabaseContact = await getContactCreditsFromSupabase(student_id, email);

      if (supabaseContact && ( supabaseContact.id === contact_id ||  // UUID match
        supabaseContact.hubspot_id === contact_id  // Numeric HubSpot ID match (legacy)
      )) {
        console.log(`✅ [SUPABASE HIT] Reusing cached credit data from validate-credits for student ${student_id}`);

        // Convert Supabase format to HubSpot format for compatibility
        contact = {
          id: supabaseContact.hubspot_id,
          properties: {
            student_id: supabaseContact.student_id,
            email: supabaseContact.email,
            sj_credits: supabaseContact.sj_credits?.toString() || '0',
            cs_credits: supabaseContact.cs_credits?.toString() || '0',
            sjmini_credits: supabaseContact.sjmini_credits?.toString() || '0',
            mock_discussion_token: supabaseContact.mock_discussion_token?.toString() || '0',
            shared_mock_credits: supabaseContact.shared_mock_credits?.toString() || '0',
            ndecc_exam_date: supabaseContact.ndecc_exam_date || null
          }
        };
      }
    } catch (supabaseError) {
      console.error('[SUPABASE ERROR] Failed to read from secondary DB:', supabaseError.message);
      // Continue to HubSpot fallback
    }

    // PHASE 2: Fallback to HubSpot (source of truth) if not in Supabase
    if (!contact) {
      console.log(`⚠️ [HUBSPOT FALLBACK] Reading from source of truth for student ${student_id}`);

      // Ensure we have a numeric HubSpot ID for the API call
      if (!hubspot_id) {
        const error = new Error('Contact data not found in Supabase and no HubSpot ID provided for fallback');
        error.status = 400;
        error.code = 'MISSING_HUBSPOT_ID';
        throw error;
      }

      // Build properties list based on mock type for efficiency
      const baseProperties = ['student_id', 'email', 'ndecc_exam_date'];
      let creditProperties = [];

      switch (mock_type) {
        case 'Mock Discussion':
          creditProperties = ['mock_discussion_token'];
          break;
        case 'Situational Judgment':
          creditProperties = ['sj_credits', 'shared_mock_credits'];
          break;
        case 'Clinical Skills':
          creditProperties = ['cs_credits', 'shared_mock_credits'];
          break;
        case 'Mini-mock':
          creditProperties = ['sjmini_credits'];
          break;
        default:
          // Fallback: fetch all credit properties
          creditProperties = ['sj_credits', 'cs_credits', 'sjmini_credits', 'mock_discussion_token', 'shared_mock_credits'];
      }

      const properties = [...baseProperties, ...creditProperties].join(',');
      contact = await hubspot.apiCall('GET',
        `/crm/v3/objects/${HUBSPOT_OBJECTS.contacts}/${hubspot_id}?properties=${properties}`
      );

      if (!contact) {
        const error = new Error('Contact not found');
        error.status = 404;
        error.code = 'CONTACT_NOT_FOUND';
        throw error;
      }
    }

    // Calculate available credits
    let specificCredits = 0;
    let sharedCredits = parseInt(contact.properties.shared_mock_credits) || 0;

    // Debug logging for Mock Discussion credits
    if (mock_type === 'Mock Discussion') {
      console.log('🔍 [DEBUG] Mock Discussion Credit Check:', {
        mock_type,
        contact_id: contact.id,
        raw_token_value: contact.properties.mock_discussion_token,
        all_contact_properties: Object.keys(contact.properties),
        properties_with_values: Object.entries(contact.properties).filter(([k, v]) => v !== null && v !== undefined && v !== '')
      });
    }

    switch (mock_type) {
      case 'Situational Judgment':
        specificCredits = parseInt(contact.properties.sj_credits) || 0;
        break;
      case 'Clinical Skills':
        specificCredits = parseInt(contact.properties.cs_credits) || 0;
        break;
      case 'Mini-mock':
        specificCredits = parseInt(contact.properties.sjmini_credits) || 0;
        sharedCredits = 0; // Don't use shared credits for mini-mock
        break;
      case 'Mock Discussion':
        specificCredits = parseInt(contact.properties.mock_discussion_token) || 0;
        sharedCredits = 0; // Don't use shared credits for mock discussion
        console.log('🔍 [DEBUG] Mock Discussion Credits Calculated:', {
          specificCredits,
          sharedCredits,
          totalWillBe: specificCredits + sharedCredits
        });
        break;
    }

    const totalCredits = specificCredits + sharedCredits;

    console.log(`📊 Credit validation for ${mock_type}:`, {
      specificCredits,
      sharedCredits,
      totalCredits,
      contact_id
    });

    if (totalCredits <= 0) {
      const error = new Error('Insufficient credits for booking');
      error.status = 400;
      error.code = 'INSUFFICIENT_CREDITS';
      throw error;
    }

    // Step 4: Determine which credit will be used (before creating booking)
    const creditBreakdown = {
      specific_credits: specificCredits,
      shared_credits: sharedCredits
    };

    const creditField = getCreditFieldToDeduct(mock_type, creditBreakdown);
    const tokenUsed = mapCreditFieldToTokenUsed(creditField);

    // Step 5: Create booking with token_used property, idempotency key, and conditional fields
    const bookingData = {
      bookingId,
      name: sanitizedName,
      email: sanitizedEmail,
      tokenUsed: tokenUsed,
      idempotencyKey: idempotencyKey  // Add idempotency key for duplicate prevention
      // FIX: Removed calculated properties (mockType, examDate, location, startTime, endTime)
      // These are now calculated/rollup properties in HubSpot from the associated Mock Exam
      // Setting them directly causes "READ_ONLY_VALUE" errors
    };

    // Add conditional fields based on exam type
    if (mock_type === 'Clinical Skills') {
      bookingData.dominantHand = dominant_hand;

      // CRITICAL FIX: For Clinical Skills, default attending_location to mock exam's location
      // Clinical Skills bookings don't ask for user location preference in the booking form,
      // so we automatically use the mock exam's location to ensure consistency between
      // HubSpot and Supabase. This prevents null values from overwriting Supabase data during cron sync.
      bookingData.attendingLocation = mockExam.properties.location || null;
      console.log(`✅ [Clinical Skills] Defaulting attending_location to exam location: ${bookingData.attendingLocation}`);

    } else if (mock_type === 'Situational Judgment' || mock_type === 'Mini-mock') {
      bookingData.attendingLocation = formattedLocation;
    }

    // ========================================================================
    // SUPABASE-FIRST ATOMIC BOOKING CREATION
    // ========================================================================
    // Call Supabase atomic RPC function that handles:
    // 1. Create booking record in Supabase
    // 2. Deduct credit from contact
    // 3. Increment exam booking count
    // All in ONE database transaction (ACID guarantees)

    const currentCreditValue = parseInt(contact.properties[creditField]) || 0;
    const newCreditValue = Math.max(0, currentCreditValue - 1);

    const atomicResult = await createBookingAtomic({
      bookingId: bookingId,  // UUID primary key
      studentId: student_id,
      studentEmail: sanitizedEmail,
      mockExamId: mock_exam_id,
      studentName: sanitizedName,
      tokenUsed: tokenUsed,
      attendingLocation: bookingData.attendingLocation,
      dominantHand: dominant_hand || null,
      idempotencyKey: idempotencyKey,
      creditField: creditField,
      newCreditValue: newCreditValue
    });

    // If idempotent (duplicate request), return existing booking
    if (atomicResult.idempotent) {
      console.log(`✅ [IDEMPOTENT] Duplicate booking request detected, returning existing booking`);
      return res.status(200).json(createSuccessResponse({
        booking_id: bookingId,
        idempotent: true,
        message: 'Booking already exists (duplicate request prevented)'
      }));
    }

    bookingCreated = true;
    
    // Increment Redis booking counter for real-time capacity tracking
    const newTotalBookings = await redis.incr(`exam:${mock_exam_id}:bookings`);
    console.log(`✅ Atomic booking created: ${bookingId}, Total bookings: ${newTotalBookings}`);

    // ========================================================================
    // SUPABASE ATOMIC INCREMENT - Update total_bookings in Supabase
    // ========================================================================
    const { updateExamBookingCountInSupabase } = require('../_shared/supabase-data');

    try {
      await updateExamBookingCountInSupabase(mock_exam_id, 1, 'increment');
      console.log(`✅ [SUPABASE] Incremented exam ${mock_exam_id} total_bookings atomically`);
    } catch (supabaseError) {
      console.error(`❌ [SUPABASE] Failed to increment total_bookings:`, supabaseError.message);
      // Non-blocking - continue even if Supabase update fails
      // Cron job will reconcile any drift
    }

    // ========================================================================
    // CONSTRUCT CREDITS AFTER DEDUCTION (Option 2: Build from existing data)
    // ========================================================================
    // Since the RPC function doesn't return credits_after_deduction,
    // we construct it from the contact data we already have
    const creditsAfterDeduction = {
      sj_credits: parseInt(contact.properties.sj_credits) || 0,
      cs_credits: parseInt(contact.properties.cs_credits) || 0,
      sjmini_credits: parseInt(contact.properties.sjmini_credits) || 0,
      mock_discussion_token: parseInt(contact.properties.mock_discussion_token) || 0,
      shared_mock_credits: parseInt(contact.properties.shared_mock_credits) || 0
    };

    // Update the deducted field with new value
    creditsAfterDeduction[creditField] = newCreditValue;

    console.log('✅ [CREDITS] Constructed credits after deduction:', creditsAfterDeduction);

    // ========================================================================
    // DUAL WEBHOOK INTEGRATION - Sync to HubSpot (fire-and-forget)
    // ========================================================================
    const { HubSpotWebhookService } = require('../_shared/hubspot-webhook');

    process.nextTick(() => {
      // Fire-and-forget webhook sync (async operations run independently)
      (async () => {
        // Webhook 1: Sync exam total_bookings to HubSpot
        const examSyncResult = await HubSpotWebhookService.syncWithRetry(
          mock_exam_id,
          newTotalBookings,
          3 // 3 retries with exponential backoff
        );

        if (examSyncResult.success) {
          console.log(`✅ [WEBHOOK-EXAM] HubSpot exam count synced: ${examSyncResult.message}`);
        } else {
          console.error(`❌ [WEBHOOK-EXAM] Exam sync failed: ${examSyncResult.message}`);
        }

        // Webhook 2: Sync ALL contact credits to HubSpot
        const creditsSyncResult = await HubSpotWebhookService.syncContactCredits(
          contact_id,
          sanitizedEmail,
          creditsAfterDeduction
        );

        if (creditsSyncResult.success) {
          console.log(`✅ [WEBHOOK-CREDITS] HubSpot credits synced: ${creditsSyncResult.message}`);
        } else {
          console.error(`❌ [WEBHOOK-CREDITS] Credits sync failed: ${creditsSyncResult.message}`);
        }

        // If both webhooks fail, log reconciliation reminder
        if (!examSyncResult.success && !creditsSyncResult.success) {
          console.error(`⏰ [WEBHOOK] Both webhooks failed - reconciliation cron will fix drift within 2 hours`);
        }
      })().catch(err => {
        console.error('❌ [WEBHOOK] Unexpected error in webhook sync:', err.message);
      });
    });

    // Cache booking in Redis to prevent duplicate bookings (until exam date)
    const examDateTime = new Date(`${exam_date}T23:59:59Z`);
    const ttlSeconds = Math.max((examDateTime - Date.now()) / 1000, 86400);
    await redis.setex(redisKey, Math.floor(ttlSeconds), `${atomicResult.data.booking_id}:Active`);
    console.log(`✅ Booking cached in Redis with key: ${redisKey}, expires in ${Math.floor(ttlSeconds / 3600)} hours`);

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

    // ========================================================================
    // HUBSPOT LEGACY OPERATIONS (Notes Only - Fire-and-Forget)
    // Associations removed - will be reconciled by cron job within 2 hours
    // ========================================================================

    // Create Note in Contact timeline (async, fire-and-forget)
    const mockExamDataForNote = {
      exam_date,
      mock_type,
      location: mockExam.properties.location || 'Mississauga'
    };

    process.nextTick(() => {
      hubspot.createBookingNote(bookingData, contact_id, mockExamDataForNote)
        .then(noteResult => {
          if (noteResult) {
            console.log(`✅ Booking note created successfully for booking ${bookingId}`);
          } else {
            console.log(`⚠️ Booking note creation failed for booking ${bookingId}, but booking was successful`);
          }
        })
        .catch(err => {
          console.error(`❌ Error creating booking note for ${bookingId}:`, err.message);
        });
    });

    // Calculate AFTER deduction credit breakdown for TokenCard display
    let specificCreditsAfter = specificCredits;
    let sharedCreditsAfter = sharedCredits;

    if (creditField === 'shared_mock_credits') {
      sharedCreditsAfter = creditsAfterDeduction.shared_mock_credits;
    } else {
      // For specific credit types (sj_credits, cs_credits, sjmini_credits)
      specificCreditsAfter = creditsAfterDeduction[creditField];
    }

    // Prepare response with exam timing data
    const responseData = {
      booking_id: bookingId,
      booking_record_id: atomicResult.data.booking_id,
      confirmation_message: `Your booking for ${mock_type} on ${formattedDate} has been confirmed`,
      idempotency_key: idempotencyKey,
      exam_details: {
        mock_exam_id,
        exam_date,
        mock_type,
        location: mockExam.properties.location || 'Mississauga',
        start_time: mockExam.properties.start_time || null,
        end_time: mockExam.properties.end_time || null,
        total_bookings: newTotalBookings
      },
      user_details: {
        ndecc_exam_date: contact.properties.ndecc_exam_date || null
      },
      credit_details: {
        credit_field_deducted: creditField,
        remaining_credits: newCreditValue,
        credit_breakdown: {
          specific_credits: specificCreditsAfter,
          shared_credits: sharedCreditsAfter
        },
        deduction_details: {
          specific_credits_before: specificCredits,
          shared_credits_before: sharedCredits,
          field_used: creditField,
          amount_deducted: 1
        }
      }
    };

    if (!responseData.credit_details || !responseData.credit_details.credit_breakdown) {
      console.error('🚨 CRITICAL: credit_details or credit_breakdown is missing from response!', responseData);
      throw new Error('Internal error: credit_details not properly generated');
    }

    console.log('✅ Booking successful - associations will be reconciled by cron job');

    // FIX: Invalidate booking list cache for this contact using Redis pattern deletion
    // ✅ Use hubspot_id (numeric HubSpot contact ID) to match list.js cache key format
    try {
      const cache = getCache();
      const cachePattern = `bookings:contact:${hubspot_id}:*`;

      const invalidatedCount = await cache.deletePattern(cachePattern);

      if (invalidatedCount > 0) {
        console.log(`✅ [Cache Invalidation] Successfully invalidated ${invalidatedCount} cache entries for contact ${hubspot_id}`);
      } else {
        console.log(`ℹ️ [Cache Invalidation] No cache entries found to invalidate (pattern: "${cachePattern}")`);
      }
    } catch (cacheError) {
      console.error('❌ Cache invalidation failed:', {
        error: cacheError.message,
        stack: cacheError.stack
      });
      // Continue - cache invalidation failure shouldn't block booking creation
    }

    // CRITICAL: Invalidate contact credits cache after booking creation
    // This ensures frontend useCachedCredits hook doesn't return stale data
    try {
      const cache = getCache();
      const creditsCachePattern = `contact:credits:${student_id}:*`;

      const creditsInvalidatedCount = await cache.deletePattern(creditsCachePattern);

      if (creditsInvalidatedCount > 0) {
        console.log(`✅ [Credits Cache Invalidation] Invalidated ${creditsInvalidatedCount} credits cache entries for student ${student_id}`);
      } else {
        console.log(`ℹ️ [Credits Cache Invalidation] No credits cache entries found (pattern: "${creditsCachePattern}")`);
      }
    } catch (creditsCacheError) {
      console.error('❌ Credits cache invalidation failed:', {
        error: creditsCacheError.message,
        stack: creditsCacheError.stack
      });
      // Non-blocking - continue even if Redis cache invalidation fails
    }

    return res.status(201).json(createSuccessResponse(responseData, 'Booking created successfully'));

  } catch (error) {
    console.error('❌ Booking creation error:', {
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
        console.log(`✅ Cleanup successful: Booking ${createdBookingId} deleted`);
      } catch (cleanupError) {
        console.error('❌ Cleanup failed:', cleanupError.message);
      }
    }

    // Determine appropriate status code and user-friendly message
    let statusCode = error.status || 500;
    let userMessage = error.message;
    
    // Improve error messages for common database/system errors
    if (error.message && error.message.includes('function') && error.message.includes('is not unique')) {
      // PostgreSQL function ambiguity error
      statusCode = 500;
      userMessage = 'A system error occurred while processing your booking. Please try again in a moment.';
      error.code = 'DATABASE_ERROR';
    } else if (error.message && (error.message.includes('Contact not found') || error.message.includes('MISSING_HUBSPOT_ID'))) {
      // Contact lookup failure
      statusCode = 400;
      userMessage = 'We could not verify your account. Please contact support for assistance.';
      error.code = 'CONTACT_NOT_FOUND';
    } else if (error.message && error.message.includes('INSUFFICIENT_CREDITS')) {
      // Insufficient credits - keep the original message as it's user-friendly
      statusCode = 400;
      userMessage = 'You don\'t have enough credits to book this exam. Please contact support to purchase more credits.';
      error.code = 'INSUFFICIENT_CREDITS';
    }

    // Update error object with user-friendly message
    const enhancedError = new Error(userMessage);
    enhancedError.status = statusCode;
    enhancedError.code = error.code || 'INTERNAL_ERROR';

    const errorResponse = createErrorResponse(enhancedError);

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