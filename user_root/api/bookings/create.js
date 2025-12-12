require('dotenv').config();
const crypto = require('crypto');
const { HubSpotService, HUBSPOT_OBJECTS } = require('../_shared/hubspot');
const { schemas } = require('../_shared/validation');
const { getCache } = require('../_shared/cache');
const RedisLockService = require('../_shared/redis');
const {
  getContactCreditsFromSupabase,
  createBookingAtomic,
  checkIdempotencyKey,
  checkExistingBookingInSupabase
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

    // Validate input
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
      mock_exam_id,
      student_id,
      name,
      email,
      exam_date,
      mock_type,
      attending_location,
      dominant_hand
    } = validatedData;

    // Sanitize inputs
    const sanitizedName = sanitizeInput(name);
    const sanitizedEmail = sanitizeInput(email);
    const sanitizedLocation = sanitizeInput(attending_location || '');
    const sanitizedHand = sanitizeInput(dominant_hand || '');

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

        console.log(`✅ Returning cached response for idempotent request`);

        const cachedResponse = {
          booking_id: existingBooking.properties.booking_id,
          booking_record_id: existingBooking.id,
          confirmation_message: 'Your booking has already been confirmed',
          idempotency_key: idempotencyKey,
          idempotent_request: true,
          exam_details: {
            mock_exam_id,
            exam_date,
            mock_type
          }
        };

        return res.status(200).json(createSuccessResponse(cachedResponse, 'Booking already exists (idempotent request)'));
      }

      // If booking is Cancelled or Failed, generate new idempotency key
      if (bookingStatus === 'Cancelled' || bookingStatus === 'cancelled' ||
          bookingStatus === 'Failed' || bookingStatus === 'failed') {

        const newKeyData = {
          contact_id: validatedData.contact_id,
          mock_exam_id: validatedData.mock_exam_id,
          exam_date: validatedData.exam_date,
          mock_type: validatedData.mock_type,
          timestamp_bucket: Math.floor(Date.now() / (5 * 60 * 1000)) + 1,
          retry_after_cancel: true
        };

        const newKeyString = JSON.stringify(newKeyData, Object.keys(newKeyData).sort());
        idempotencyKey = `idem_${crypto.createHash('sha256').update(newKeyString).digest('hex').substring(0, 28)}`;
      }
    }

    // Step 1: Generate booking ID and check for duplicates BEFORE acquiring lock
    // This prevents race conditions where two users book the same date simultaneously
    const formattedDate = formatBookingDate(exam_date);

    // Generate booking ID with exam type, student ID, and formatted date
    // Format: "MockType-StudentID-Date" ensures uniqueness per student
    // This prevents same-name collision while maintaining duplicate detection
    const bookingId = `${mock_type}-${student_id}-${formattedDate}`;

    // ========================================================================
    // DUAL-TIER DUPLICATE DETECTION - Prevents overbooking for same student+date
    // ========================================================================
    // TIER 1: Check Redis cache for existing Active bookings (fast path ~1ms)
    // TIER 2: Query Supabase to verify no active bookings exist (~50ms)
    //
    // Cache Key Format: booking:{hubspot_contact_id}:{exam_date}
    // Cache Values:
    //   - "{bookingId}:Active" - Active booking exists (TTL: until exam date)
    //
    // WHY NOT "NO_DUPLICATE" CACHE?
    // Previous implementation cached "NO_DUPLICATE" after Supabase check, but this:
    // 1. Gets immediately overwritten with Active status after booking creation
    // 2. If user abandons booking, creates false fast-path approvals for 3 hours
    // 3. Different users booking same exam would incorrectly bypass Supabase check
    // ========================================================================

    // Initialize Redis for duplicate detection cache
    redis = new RedisLockService();

    // Format cache key: Use hubspot_id (numeric HubSpot contact ID) for consistency with cancellation
    const redisKey = `booking:${hubspot_id}:${exam_date}`;
    const cachedResult = await redis.get(redisKey);

    console.log(`[Duplicate Check] Cache key: ${redisKey}, Result: ${cachedResult}`);

    // TIER 1: Check Redis cache for existing Active bookings (fast path)
    if (cachedResult && cachedResult.includes('Active')) {
      // Cache contains booking_id:status (e.g., "Clinical Skills-1599999-March 1, 2026:Active")
      const [cachedBookingId] = cachedResult.split(':');
      console.log(`❌ Redis cache hit: Active booking ${cachedBookingId} found for contact ${hubspot_id} on ${exam_date}`);

      const error = new Error('Duplicate booking detected: You already have an active booking for this exam date');
      error.status = 400;
      error.code = 'DUPLICATE_BOOKING';
      throw error;
    }

    // TIER 2: Cache miss or non-Active status - verify with Supabase
    // Use Supabase-only approach (10x faster than HubSpot: ~50ms vs ~500ms)
    console.log(`⚠️ Redis cache miss or non-Active status - verifying with Supabase for contact ${hubspot_id} on ${exam_date}`);

    const isDuplicate = await checkExistingBookingInSupabase(hubspot_id, exam_date);

    if (isDuplicate) {
      // Active duplicate found in Supabase - cache it for future fast-path rejection
      console.log(`❌ [SUPABASE] Duplicate check: Active booking found for contact ${hubspot_id} on ${exam_date}`);
      const examDateTime = new Date(`${exam_date}T23:59:59Z`);
      const ttlSeconds = Math.max((examDateTime - Date.now()) / 1000, 86400);
      await redis.setex(redisKey, Math.floor(ttlSeconds), `${bookingId}:Active`);

      const error = new Error('Duplicate booking detected: You already have a booking for this exam date');
      error.status = 400;
      error.code = 'DUPLICATE_BOOKING';
      throw error;
    }

    // No duplicate found - proceed with booking creation
    // Active status will be cached after successful booking creation (line 695)
    console.log(`✅ [SUPABASE] Duplicate check passed: No active booking found for contact ${hubspot_id} on ${exam_date}`);

    // ========================================================================
    // REDIS LOCK ACQUISITION - Prevent simultaneous bookings for same exam
    // ========================================================================
    lockToken = await redis.acquireLockWithRetry(mock_exam_id, 5, 100, 10);

    if (!lockToken) {
      const lockError = new Error('Unable to process booking at this time. The system is experiencing high demand. Please try again in a moment.');
      lockError.status = 503;
      lockError.code = 'LOCK_ACQUISITION_FAILED';
      throw lockError;
    }

    console.log(`✅ Lock acquired successfully for exam ${mock_exam_id}`);

    // Step 2: Verify mock exam exists and has capacity
    const mockExam = await hubspot.getMockExam(mock_exam_id);

    if (!mockExam) {
      const error = new Error('Mock exam not found');
      error.status = 404;
      error.code = 'EXAM_NOT_FOUND';
      throw error;
    }

    // Verify mock type matches
    if (mockExam.properties.mock_type !== mock_type) {
      const error = new Error('Mock exam type mismatch');
      error.status = 400;
      error.code = 'EXAM_TYPE_MISMATCH';
      throw error;
    }

    // Check if exam is active
    if (mockExam.properties.is_active !== 'true') {
      const error = new Error('Mock exam is not available for booking');
      error.status = 400;
      error.code = 'EXAM_NOT_ACTIVE';
      throw error;
    }

    // Check capacity using Redis (authoritative source)
    const capacity = parseInt(mockExam.properties.capacity) || 0;

    // TIER 1: Try Redis first (real-time, authoritative source)
    let totalBookings = await redis.get(`exam:${mock_exam_id}:bookings`);

    // TIER 2: Fallback to HubSpot if Redis doesn't have it yet
    if (totalBookings === null) {
      totalBookings = parseInt(mockExam.properties.total_bookings) || 0;
      // Seed Redis with current HubSpot value (TTL: 30 days / 3 months)
      const TTL_30_DAYS = 30 * 24 * 60 * 60;
      await redis.setex(`exam:${mock_exam_id}:bookings`, TTL_30_DAYS, totalBookings);
      console.log(`📊 Seeded Redis counter from HubSpot: exam:${mock_exam_id}:bookings = ${totalBookings}`);
    } else {
      totalBookings = parseInt(totalBookings);
    }

    // CRITICAL: This check now uses real-time Redis data to prevent overbooking
    if (totalBookings >= capacity) {
      const error = new Error('This mock exam is now full');
      error.status = 400;
      error.code = 'EXAM_FULL';
      throw error;
    }

    // Step 3: Verify contact and credits (Supabase-first for performance)
    let contact = null;

    // PHASE 1: Try Supabase secondary database first (fast path ~50ms)
    try {
      const supabaseContact = await getContactCreditsFromSupabase(student_id, email);

      if (supabaseContact && (supabaseContact.id === contact_id ||  // UUID match
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
            shared_mock_credits: supabaseContact.shared_mock_credits?.toString() || '0'
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

      contact = await hubspot.apiCall('GET',
        `/crm/v3/objects/${HUBSPOT_OBJECTS.contacts}/${hubspot_id}?properties=student_id,email,sj_credits,cs_credits,sjmini_credits,shared_mock_credits`
      );

      if (!contact) {
        const error = new Error('Contact not found');
        error.status = 404;
        error.code = 'CONTACT_NOT_FOUND';
        throw error;
      }
    }

    // Determine which credit to use based on mock_type
    let creditField, tokenName, specificCredits, sharedCredits, totalCredits;

    switch (mock_type) {
      case 'Situational Judgment':
        creditField = 'sj_credits';
        tokenName = 'SJ Token';
        specificCredits = parseInt(contact.properties.sj_credits) || 0;
        break;
      case 'Clinical Skills':
        creditField = 'cs_credits';
        tokenName = 'CS Token';
        specificCredits = parseInt(contact.properties.cs_credits) || 0;
        break;
      case 'Mini-mock':
        creditField = 'sjmini_credits';
        tokenName = 'Mini-mock Token';
        specificCredits = parseInt(contact.properties.sjmini_credits) || 0;
        break;
      default:
        const error = new Error('Invalid mock type');
        error.status = 400;
        error.code = 'INVALID_MOCK_TYPE';
        throw error;
    }

    // Get shared credits
    sharedCredits = parseInt(contact.properties.shared_mock_credits) || 0;
    totalCredits = specificCredits + sharedCredits;

    // Verify sufficient credits
    if (totalCredits <= 0) {
      const error = new Error('Insufficient credits for booking');
      error.status = 400;
      error.code = 'INSUFFICIENT_CREDITS';
      throw error;
    }

    // Determine which credit to deduct (specific first, then shared)
    let newSpecificCredits, newSharedCredits;

    if (specificCredits > 0) {
      newSpecificCredits = specificCredits - 1;
      newSharedCredits = sharedCredits;
    } else {
      newSpecificCredits = 0;
      newSharedCredits = sharedCredits - 1;
    }

    // ========================================================================
    // SUPABASE-FIRST ATOMIC BOOKING CREATION
    // ========================================================================
    // Call Supabase atomic RPC function that handles:
    // 1. Create booking record in Supabase
    // 2. Deduct specific or shared credit from contact
    // 3. Increment exam booking count
    // All in ONE database transaction (ACID guarantees)

    const atomicResult = await createBookingAtomic({
      bookingId: bookingId,
      studentId: student_id,
      studentEmail: sanitizedEmail,
      mockExamId: mock_exam_id,
      studentName: sanitizedName,
      tokenUsed: tokenName,
      attendingLocation: sanitizedLocation,
      dominantHand: sanitizedHand,
      idempotencyKey: idempotencyKey,
      creditField: specificCredits > 0 ? creditField : 'shared_mock_credits',
      newCreditValue: specificCredits > 0 ? newSpecificCredits : newSharedCredits
    });

    // If idempotent (duplicate request), return existing booking
    if (atomicResult.idempotent) {
      console.log(`[IDEMPOTENT] Duplicate booking request detected, returning existing booking`);

      // Release lock before returning
      if (lockToken) {
        await redis.releaseLock(mock_exam_id, lockToken);
        lockToken = null;
      }

      return res.status(200).json(createSuccessResponse({
        booking_id: bookingId,
        idempotent: true,
        message: 'Booking already exists (duplicate request prevented)'
      }));
    }

    bookingCreated = true;
    createdBookingId = atomicResult.data.booking_hubspot_id;
    console.log(`Atomic booking created: ${bookingId} (HubSpot ID: ${createdBookingId})`);

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
      sj_credits: mock_type === 'Situational Judgment' ? newSpecificCredits : parseInt(contact.properties.sj_credits) || 0,
      cs_credits: mock_type === 'Clinical Skills' ? newSpecificCredits : parseInt(contact.properties.cs_credits) || 0,
      sjmini_credits: mock_type === 'Mini-mock' ? newSpecificCredits : parseInt(contact.properties.sjmini_credits) || 0,
      mock_discussion_token: parseInt(contact.properties.mock_discussion_token) || 0,
      shared_mock_credits: specificCredits > 0 ? sharedCredits : newSharedCredits
    };

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
          console.log(`[WEBHOOK-CREDITS] HubSpot credits synced: ${creditsSyncResult.message}`);
        } else {
          console.error(`[WEBHOOK-CREDITS] Credits sync failed: ${creditsSyncResult.message}`);
        }

        // If both webhooks fail, log reconciliation reminder
        if (!examSyncResult.success && !creditsSyncResult.success) {
          console.error(`[WEBHOOK] Both webhooks failed - reconciliation cron will fix drift within 2 hours`);
        }
      })().catch(err => {
        console.error('[WEBHOOK] Unexpected error in webhook sync:', err.message);
      });
    });

    // ========================================================================
    // REDIS LOCK RELEASE - Release lock after booking is confirmed
    // ========================================================================
    if (lockToken) {
      await redis.releaseLock(mock_exam_id, lockToken);
      lockToken = null;
      console.log(`✅ Lock released successfully`);
    }

    // ========================================================================
    // HUBSPOT LEGACY OPERATIONS (Notes Only - Fire-and-Forget)
    // Associations removed - will be reconciled by cron job within 2 hours
    // ========================================================================

    // Create Note in Contact timeline (async, fire-and-forget)
    const examDataForNote = {
      exam_date,
      mock_type,
      location: mockExam.properties.location || 'TBD',
      attending_location: sanitizedLocation,
      dominant_hand: sanitizedHand
    };

    process.nextTick(() => {
      hubspot.apiCall('POST', `/crm/v3/objects/notes`, {
        properties: {
          hs_timestamp: new Date().getTime(),
          hs_note_body: `
            <h3>Mock Exam Booking Confirmed</h3>
            <p><strong>Student:</strong> ${sanitizedName}</p>
            <p><strong>Exam Type:</strong> ${mock_type}</p>
            <p><strong>Date:</strong> ${formattedDate}</p>
            <p><strong>Location:</strong> ${examDataForNote.location}</p>
            <p><strong>Attending Location:</strong> ${sanitizedLocation || 'Not specified'}</p>
            ${sanitizedHand ? `<p><strong>Dominant Hand:</strong> ${sanitizedHand}</p>` : ''}
            <p><strong>Booking ID:</strong> ${bookingId}</p>
            <p><strong>Token Used:</strong> ${tokenName}</p>
            <p><strong>Specific Credits Remaining:</strong> ${newSpecificCredits}</p>
            <p><strong>Shared Credits Remaining:</strong> ${newSharedCredits}</p>
            <hr>
            <p style="color: #666; font-size: 0.9em;">Booking created at ${new Date().toISOString()}</p>
          `
        }
      }).then(async (note) => {
        // Associate note with contact
        await hubspot.createAssociation('notes', note.id, HUBSPOT_OBJECTS.contacts, contact_id);
        console.log(`✅ Booking note created successfully for booking ${bookingId}`);
      }).catch(err => {
        console.error(`❌ Error creating booking note for ${bookingId}:`, err.message);
      });
    });

    // Cache booking in Redis to prevent duplicate bookings (until exam date)
    const verifiedRedisKey = `booking:${hubspot_id}:${exam_date}`;
    const examDateTime = new Date(`${exam_date}T23:59:59Z`);
    const ttlSeconds = Math.max((examDateTime - Date.now()) / 1000, 86400);
    await redis.setex(verifiedRedisKey, Math.floor(ttlSeconds), `${atomicResult.data.booking_code}:Active`);
    console.log(`✅ Cached Active booking in Redis: ${verifiedRedisKey} (TTL: ${Math.floor(ttlSeconds)}s)`);

    // Prepare response (simplified - no associations field)
    const responseData = {
      booking_id: bookingId,
      booking_record_id: createdBookingId,
      confirmation_message: `Your ${mock_type} booking for ${formattedDate} has been confirmed`,
      idempotency_key: idempotencyKey,
      exam_details: {
        mock_exam_id,
        exam_date,
        mock_type,
        location: mockExam.properties.location || 'TBD',
        total_bookings: newTotalBookings
      },
      credit_details: {
        specific_credits_before: specificCredits,
        shared_credits_before: sharedCredits,
        total_credits_before: totalCredits,
        credit_type_used: specificCredits > 0 ? 'specific' : 'shared',
        specific_credits_after: newSpecificCredits,
        shared_credits_after: newSharedCredits,
        total_credits_after: newSpecificCredits + newSharedCredits
      }
    };

    console.log('✅ Booking successful - associations will be reconciled by cron job');

    // Invalidate booking list cache for this contact
    // ✅ Use hubspot_id (numeric HubSpot contact ID) to match list.js cache key format
    try {
      const cache = getCache();
      const cachePattern = `bookings:contact:${hubspot_id}:*`;

      const invalidatedCount = await cache.deletePattern(cachePattern);

      if (invalidatedCount > 0) {
        console.log(`[Cache Invalidation] Successfully invalidated ${invalidatedCount} cache entries for contact ${hubspot_id}`);
      } else {
        console.log(`[Cache Invalidation] No cache entries found to invalidate`);
      }
    } catch (cacheError) {
      console.error('[Cache Invalidation] Failed:', cacheError.message);
      // Continue - cache invalidation failure shouldn't block booking
    }

    // CRITICAL: Invalidate contact credits cache after booking creation
    // This ensures frontend useCachedCredits hook doesn't return stale data
    try {
      const cache = getCache();
      const creditsCachePattern = `contact:credits:${student_id}:*`;

      const creditsInvalidatedCount = await cache.deletePattern(creditsCachePattern);

      if (creditsInvalidatedCount > 0) {
        console.log(`[Credits Cache Invalidation] Invalidated ${creditsInvalidatedCount} credits cache entries for student ${student_id}`);
      } else {
        console.log(`[Credits Cache Invalidation] No credits cache entries found (pattern: "${creditsCachePattern}")`);
      }
    } catch (creditsCacheError) {
      console.error('[Credits Cache Invalidation] Failed:', creditsCacheError.message);
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

    const statusCode = error.status || 500;
    const errorResponse = createErrorResponse(error);

    return res.status(statusCode).json(errorResponse);

  } finally {
    // ========================================================================
    // REDIS CLEANUP - Release lock if it hasn't been released
    // ========================================================================
    if (lockToken && redis) {
      try {
        await redis.releaseLock(mock_exam_id, lockToken);
        console.log(`✅ [Finally] Lock released successfully`);
      } catch (finallyError) {
        console.error(`❌ [Finally] Failed to release lock:`, finallyError.message);
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