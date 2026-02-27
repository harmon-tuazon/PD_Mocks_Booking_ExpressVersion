const crypto = require('crypto');
const { HubSpotService, HUBSPOT_OBJECTS } = require('../../services/hubspot');
const { getCache } = require('../../services/cache');
const RedisLockService = require('../../services/redis');
const {
  createSuccessResponse,
  sanitizeInput
} = require('../../services/auth');
const {
  createBookingAtomic,
  getContactCreditsFromSupabase,
  checkExistingBookingByMockType,
  db
} = require('../../services/supabase-data');

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
 * POST /api/mock-discussions/create-booking
 * Create a new booking for a mock discussion session
 * Auth + validation handled by route middleware
 */
const createBooking = async (req, res, next) => {
  let bookingCreated = false;
  let createdBookingId = null;
  let redis = null;
  let lockToken = null;
  let userLock = null;

  try {
    // Validated body from route middleware (validateBody(schemas.bookingCreation))
    const {
      contact_id,
      hubspot_id,
      mock_exam_id,
      student_id,
      name,
      email,
      exam_date,
      discussion_format,
      topic_preference
    } = req.body;

    // Sanitize inputs
    const sanitizedName = sanitizeInput(name);
    const sanitizedEmail = sanitizeInput(email);

    // Initialize HubSpot service
    const hubspot = new HubSpotService();

    // Idempotency Check
    let idempotencyKey = req.headers['x-idempotency-key'];

    // If no header provided, generate key from request data
    if (!idempotencyKey) {
      idempotencyKey = generateIdempotencyKey(req.body);
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
          contact_id: req.body.contact_id,
          mock_exam_id: req.body.mock_exam_id,
          exam_date: req.body.exam_date,
          mock_type: 'Mock Discussion',
          timestamp_bucket: Math.floor(Date.now() / (5 * 60 * 1000)) + 1,
          retry_after_cancel: true
        };

        const newKeyString = JSON.stringify(newKeyData, Object.keys(newKeyData).sort());
        idempotencyKey = `idem_disc_${crypto.createHash('sha256').update(newKeyString).digest('hex').substring(0, 28)}`;
      }
    }

    // Step 1: Generate booking ID and check for duplicates BEFORE acquiring lock
    const examDate = new Date(exam_date);
    const formattedDate = examDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const bookingId = `Mock Discussion-${student_id}-${formattedDate}`;

    // ========================================================================
    // DUAL-TIER DUPLICATE DETECTION
    // ========================================================================

    // Initialize Redis for duplicate detection cache
    redis = new RedisLockService();

    // Format cache key
    const examDateStr = String(exam_date);
    const normalizedExamDate = examDateStr.includes('T') ? examDateStr.split('T')[0] : examDateStr;
    const mockType = 'Mock Discussion';
    const redisKey = `booking:${hubspot_id}:${normalizedExamDate}:${mockType}`;
    const cachedResult = await redis.get(redisKey);

    console.log(`[Mock Discussion Duplicate Check] Cache key: ${redisKey}, Result: ${cachedResult}`);

    // TIER 1: Check Redis cache for existing Active bookings (fast path)
    if (cachedResult) {
      console.log(`❌ Redis cache hit: Active Mock Discussion booking found for contact ${hubspot_id} on ${exam_date}`);

      const error = new Error('Duplicate booking detected: You already have an active Mock Discussion booking for this date');
      error.status = 400;
      error.code = 'DUPLICATE_BOOKING';
      throw error;
    }

    // TIER 2: Cache miss - verify with Supabase
    console.log(`⚠️ Redis cache miss - verifying with Supabase for contact ${hubspot_id} on ${exam_date} (${mockType})`);

    const duplicateCheck = await checkExistingBookingByMockType(hubspot_id, normalizedExamDate, mockType);

    if (duplicateCheck.exists) {
      console.log(`❌ [SUPABASE] Duplicate check: Active Mock Discussion booking found for contact ${hubspot_id} on ${exam_date}`);
      const examDateTime = new Date(`${exam_date}T23:59:59Z`);
      const ttlSeconds = Math.max(Math.floor((examDateTime - Date.now()) / 1000), 86400);
      await redis.setex(redisKey, ttlSeconds, duplicateCheck.existingBooking.booking_id);

      const error = new Error(`Duplicate booking detected: You already have a Mock Discussion booking for this date (${duplicateCheck.existingBooking.booking_id})`);
      error.status = 400;
      error.code = 'DUPLICATE_BOOKING';
      throw error;
    }

    console.log(`✅ [SUPABASE] Duplicate check passed: No active Mock Discussion booking found for contact ${hubspot_id} on ${exam_date}`);

    // ========================================================================
    // REDIS LOCK ACQUISITION - Two-phase locking
    // ========================================================================

    // First lock: User + Date specific lock
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

    if (mockDiscussion.properties.mock_type !== 'Mock Discussion') {
      const error = new Error('Invalid session type. This endpoint only accepts Mock Discussion bookings.');
      error.status = 400;
      error.code = 'INVALID_MOCK_TYPE';
      throw error;
    }

    if (mockDiscussion.properties.is_active !== 'true') {
      const error = new Error('Mock Discussion is not available for booking');
      error.status = 400;
      error.code = 'DISCUSSION_NOT_ACTIVE';
      throw error;
    }

    // ========================================================================
    // PREREQUISITE VALIDATION - Supabase-first pattern
    // ========================================================================

    let prerequisiteExamIds = [];

    try {
      const { data: examData, error: examError } = await db
        .from('hubspot_mock_exams')
        .select('prerequisite_exam_ids')
        .eq('hubspot_id', mock_exam_id)
        .single();

      if (!examError && examData?.prerequisite_exam_ids) {
        prerequisiteExamIds = examData.prerequisite_exam_ids;
        console.log(`✅ [SUPABASE] Found ${prerequisiteExamIds.length} prerequisites for ${mock_exam_id}`);
      } else {
        console.log(`📭 [SUPABASE MISS] Falling back to HubSpot for prerequisites`);
        prerequisiteExamIds = await hubspot.getMockExamPrerequisites(mock_exam_id);
      }
    } catch (err) {
      console.error(`⚠️ [PREREQUISITE] Error fetching from Supabase, using HubSpot:`, err.message);
      prerequisiteExamIds = await hubspot.getMockExamPrerequisites(mock_exam_id);
    }

    if (prerequisiteExamIds.length > 0) {
      console.log(`📋 [PREREQUISITE CHECK] Mock Discussion ${mock_exam_id} requires ${prerequisiteExamIds.length} prerequisite exam(s)`);

      const { getBookingsByContactFromSupabase } = require('../../services/supabase-data');
      const userBookings = await getBookingsByContactFromSupabase(hubspot_id);

      const missingPrerequisites = [];

      for (const prereqId of prerequisiteExamIds) {
        const hasPrereqBooking = userBookings.some(booking =>
          booking.associated_mock_exam === prereqId &&
          (booking.is_active === 'Active' || booking.is_active === 'active' ||
           booking.is_active === 'Completed' || booking.is_active === 'completed')
        );

        if (!hasPrereqBooking) {
          missingPrerequisites.push(prereqId);
        }
      }

      if (missingPrerequisites.length > 0) {
        console.log(`❌ [PREREQUISITE CHECK] User ${hubspot_id} missing ${missingPrerequisites.length} prerequisite booking(s): [${missingPrerequisites.join(', ')}]`);

        const error = new Error(
          `You must book the prerequisite exam session(s) before booking this Mock Discussion. ` +
          `Please complete the required Clinical Skills or Situational Judgment booking first.`
        );
        error.status = 400;
        error.code = 'PREREQUISITE_NOT_MET';
        error.details = {
          missing_prerequisites: missingPrerequisites,
          total_required: prerequisiteExamIds.length,
          total_missing: missingPrerequisites.length
        };
        throw error;
      }

      console.log(`✅ [PREREQUISITE CHECK] User ${hubspot_id} has all ${prerequisiteExamIds.length} prerequisite booking(s)`);
    }

    // Check capacity using ACTUAL booking count
    const capacity = parseInt(mockDiscussion.properties.capacity) || 0;
    const propertyBookings = parseInt(mockDiscussion.properties.total_bookings) || 0;

    const { count: actualBookingCount, error: countError } = await db
      .from('hubspot_bookings')
      .select('*', { count: 'exact', head: true })
      .eq('associated_mock_exam', mock_exam_id)
      .eq('is_active', 'Active');

    if (countError) {
      console.error(`⚠️ [DISCUSSION-CREATE] Failed to count bookings, falling back to property:`, countError.message);
    }

    const effectiveBookingCount = countError ? propertyBookings : actualBookingCount;
    console.log(`📊 [DISCUSSION-CREATE] Checking capacity: ${effectiveBookingCount}/${capacity} (actual count: ${actualBookingCount}, property: ${propertyBookings})`);

    if (effectiveBookingCount >= capacity) {
      const error = new Error('This Mock Discussion session is now full');
      error.status = 400;
      error.code = 'DISCUSSION_FULL';
      throw error;
    }

    // Update Redis counter with actual count
    const TTL_1_HOUR = 60 * 60;
    await redis.setex(`exam:${mock_exam_id}:bookings`, TTL_1_HOUR, effectiveBookingCount);
    console.log(`📊 [DISCUSSION-CREATE] Updated Redis counter: exam:${mock_exam_id}:bookings = ${effectiveBookingCount}`);

    // Step 3: Verify contact and credits (Supabase-first)
    let contact = null;

    // PHASE 1: Try Supabase first
    try {
      const supabaseContact = await getContactCreditsFromSupabase(student_id, email);

      if (supabaseContact && (supabaseContact.id === contact_id ||
        supabaseContact.hubspot_id === contact_id
      )) {
        console.log(`✅ [SUPABASE HIT] Reusing cached credit data from validate-credits for student ${student_id}`);

        contact = {
          id: supabaseContact.hubspot_id,
          properties: {
            student_id: supabaseContact.student_id,
            email: supabaseContact.email,
            mock_discussion_token: supabaseContact.mock_discussion_token?.toString() || '0'
          }
        };
      }
    } catch (supabaseError) {
      console.error('[SUPABASE ERROR] Failed to read from secondary DB:', supabaseError.message);
    }

    // PHASE 2: Fallback to HubSpot
    if (!contact) {
      console.log(`⚠️ [HUBSPOT FALLBACK] Reading from source of truth for student ${student_id}`);

      if (!hubspot_id) {
        const error = new Error('Contact data not found in Supabase and no HubSpot ID provided for fallback');
        error.status = 400;
        error.code = 'MISSING_HUBSPOT_ID';
        throw error;
      }

      contact = await hubspot.apiCall('GET',
        `/crm/v3/objects/${HUBSPOT_OBJECTS.contacts}/${hubspot_id}?properties=student_id,email,mock_discussion_token`
      );

      if (!contact) {
        const error = new Error('Contact not found');
        error.status = 404;
        error.code = 'CONTACT_NOT_FOUND';
        throw error;
      }
    }

    // Check mock discussion tokens
    const discussionTokens = parseInt(contact.properties.mock_discussion_token) || 0;

    if (discussionTokens <= 0) {
      const error = new Error('Insufficient Mock Discussion tokens for booking');
      error.status = 400;
      error.code = 'INSUFFICIENT_TOKENS';
      throw error;
    }

    // ========================================================================
    // SUPABASE-FIRST ATOMIC BOOKING CREATION
    // ========================================================================

    const newTokenValue = Math.max(0, discussionTokens - 1);

    const atomicResult = await createBookingAtomic({
      bookingId: bookingId,
      studentId: student_id,
      studentEmail: sanitizedEmail,
      mockExamId: mock_exam_id,
      studentName: sanitizedName,
      tokenUsed: 'Mock Discussion Token',
      attendingLocation: discussion_format || 'Virtual',
      dominantHand: null,
      idempotencyKey: idempotencyKey,
      creditField: 'mock_discussion_token',
      newCreditValue: newTokenValue
    });

    // If idempotent (duplicate request), return existing booking
    if (atomicResult.idempotent) {
      console.log(`[IDEMPOTENT] Duplicate Mock Discussion booking request detected, returning existing booking`);

      if (lockToken) {
        await redis.releaseLock(mock_exam_id, lockToken);
        lockToken = null;
      }
      if (userLock?.token) {
        await redis.releaseLock(userLock.key, userLock.token);
        userLock.token = null;
      }

      return res.status(200).json(createSuccessResponse({
        booking_id: bookingId,
        idempotent: true,
        message: 'Mock Discussion booking already exists (duplicate request prevented)'
      }));
    }

    bookingCreated = true;
    createdBookingId = atomicResult.data.booking_hubspot_id;
    console.log(`Atomic Mock Discussion booking created: ${bookingId} (HubSpot ID: ${createdBookingId})`);

    // Increment Redis booking counter
    const counterKey = `exam:${mock_exam_id}:bookings`;
    const existingCount = await redis.get(counterKey);
    let newTotalBookings;

    if (existingCount === null) {
      const TTL_1_WEEK = 7 * 24 * 60 * 60;
      newTotalBookings = effectiveBookingCount + 1;
      await redis.setex(counterKey, TTL_1_WEEK, newTotalBookings);
      console.log(`✅ [REDIS] Seeded exam counter with TTL: ${counterKey} = ${newTotalBookings}`);
    } else {
      newTotalBookings = await redis.incr(counterKey);
      console.log(`✅ [REDIS] Incremented exam counter: ${counterKey} = ${newTotalBookings}`);
    }
    console.log(`✅ Atomic booking created: ${bookingId}, Total bookings: ${newTotalBookings}`);

    // Cache Active booking status in Redis
    const verifiedRedisKey = `booking:${hubspot_id}:${normalizedExamDate}:${mockType}`;
    const examDateTime = new Date(`${normalizedExamDate}T23:59:59Z`);
    const ttlSeconds = Math.max((examDateTime - Date.now()) / 1000, 86400);
    await redis.setex(verifiedRedisKey, Math.floor(ttlSeconds), bookingId);
    console.log(`✅ Cached Active Mock Discussion booking in Redis: ${verifiedRedisKey} (TTL: ${Math.floor(ttlSeconds)}s)`);

    // ========================================================================
    // SUPABASE ATOMIC INCREMENT
    // ========================================================================
    const { updateExamBookingCountInSupabase } = require('../../services/supabase-data');

    try {
      await updateExamBookingCountInSupabase(mock_exam_id, 1, 'increment');
      console.log(`✅ [SUPABASE] Incremented exam ${mock_exam_id} total_bookings atomically`);
    } catch (supabaseError) {
      console.error(`❌ [SUPABASE] Failed to increment total_bookings:`, supabaseError.message);
    }

    // ========================================================================
    // CONSTRUCT CREDITS AFTER DEDUCTION
    // ========================================================================
    const creditsAfterDeduction = {
      sj_credits: parseInt(contact.properties.sj_credits) || 0,
      cs_credits: parseInt(contact.properties.cs_credits) || 0,
      sjmini_credits: parseInt(contact.properties.sjmini_credits) || 0,
      mock_discussion_token: Math.max(0, discussionTokens - 1),
      shared_mock_credits: parseInt(contact.properties.shared_mock_credits) || 0
    };

    console.log('✅ [CREDITS] Constructed credits after deduction:', creditsAfterDeduction);

    // ========================================================================
    // DUAL WEBHOOK INTEGRATION - Sync to HubSpot (fire-and-forget)
    // ========================================================================
    const { HubSpotWebhookService } = require('../../services/hubspot-webhook');

    process.nextTick(() => {
      (async () => {
        // Webhook 1: Sync exam total_bookings to HubSpot
        const examSyncResult = await HubSpotWebhookService.syncWithRetry(
          'totalBookings',
          mock_exam_id,
          newTotalBookings
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

        if (!examSyncResult.success && !creditsSyncResult.success) {
          console.error(`[WEBHOOK] Both webhooks failed - reconciliation cron will fix drift within 2 hours`);
        }
      })().catch(err => {
        console.error('[WEBHOOK] Unexpected error in webhook sync:', err.message);
      });
    });

    // ========================================================================
    // REDIS LOCK RELEASE
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
    // ========================================================================
    const discussionDataForNote = {
      exam_date,
      mock_type: 'Mock Discussion',
      location: mockDiscussion.properties.location || 'Virtual',
      discussion_format: discussion_format || 'Virtual',
      topic_preference: topic_preference || 'No preference specified'
    };

    process.nextTick(() => {
      hubspot.apiCall('POST', `/crm/v3/objects/notes`, {
        properties: {
          hs_timestamp: new Date().getTime(),
          hs_note_body: `
            <h3>Mock Discussion Booking Confirmed</h3>
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
        await hubspot.createAssociation('notes', note.id, HUBSPOT_OBJECTS.contacts, contact_id);
        console.log(`✅ Mock Discussion booking note created successfully for booking ${bookingId}`);
      }).catch(err => {
        console.error(`❌ Error creating Mock Discussion booking note for ${bookingId}:`, err.message);
      });
    });

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
        discussion_format: discussion_format || 'Virtual',
        total_bookings: newTotalBookings
      },
      token_details: {
        tokens_before: discussionTokens,
        tokens_deducted: 1,
        tokens_remaining: newTokenValue
      }
    };

    if (topic_preference) {
      responseData.exam_details.topic_preference = topic_preference;
    }

    console.log('✅ Mock Discussion booking successful - associations will be reconciled by cron job');

    // Invalidate booking list cache for this contact
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
    }

    // Invalidate contact credits cache
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

    next(error);

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

module.exports = { createBooking };
