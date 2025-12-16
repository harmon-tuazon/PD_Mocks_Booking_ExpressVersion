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
  checkExistingBookingInSupabase,
  supabaseAdmin
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
 * POST /api/bookings/create
 * Create a new booking for a mock exam slot and handle all associations
 */
module.exports = async (req, res) => {
  const redis = new RedisLockService();
  let lockToken = null;

  try {
    // Accept both snake_case (frontend) and camelCase (legacy) field names
    const studentId = req.body.student_id || req.body.studentId;
    const email = req.body.email;
    const mockExamId = req.body.mock_exam_id || req.body.mockExamId;
    const location = req.body.attending_location || req.body.location;
    const dominantHand = req.body.dominant_hand ?? req.body.dominantHand;

    // Validate required fields
    if (!studentId || !email || !mockExamId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields: student_id, email, mock_exam_id'
        }
      });
    }

    // Sanitize email to lowercase for consistency
    const sanitizedEmail = email.toLowerCase().trim();

    // ========================================================================
    // STEP 1: Retrieve mock exam details (Supabase-first)
    // ========================================================================
    console.log(`📋 [BOOKING-CREATE] Retrieving mock exam details for exam ID: ${mockExamId}`);

    const { data: examData, error: examError } = await supabaseAdmin
      .from('hubspot_mock_exams')
      .select('*')
      .eq('hubspot_id', mockExamId)
      .single();

    if (examError || !examData) {
      console.error(`❌ [BOOKING-CREATE] Mock exam not found in Supabase:`, examError);
      return res.status(404).json({
        success: false,
        error: {
          code: 'EXAM_NOT_FOUND',
          message: 'Mock exam not found'
        }
      });
    }

    const {
      mock_type,
      exam_date,
      start_time,
      end_time,
      location: examLocation,
      capacity,
      total_bookings: currentTotalBookings,
      hubspot_id: mock_exam_id
    } = examData;

    console.log(`✅ [BOOKING-CREATE] Exam details retrieved: ${mock_type} on ${exam_date}`);

    // ========================================================================
    // STEP 2: Retrieve contact details (Supabase-first)
    // ========================================================================
    console.log(`👤 [BOOKING-CREATE] Retrieving contact for student: ${studentId}`);

    const { data: contacts, error: contactError } = await supabaseAdmin
      .from('hubspot_contact_credits')
      .select('*')
      .eq('student_id', studentId.toUpperCase())
      .eq('email', sanitizedEmail);

    if (contactError || !contacts || contacts.length === 0) {
      console.error(`❌ [BOOKING-CREATE] Contact not found in Supabase:`, contactError);
      return res.status(404).json({
        success: false,
        error: {
          code: 'CONTACT_NOT_FOUND',
          message: 'Student not found. Please ensure you are registered.'
        }
      });
    }

    const contact = contacts[0];
    const contact_id = contact.hubspot_id;

    console.log(`✅ [BOOKING-CREATE] Contact found: ${contact.student_name} (ID: ${contact_id})`);

    // ========================================================================
    // STEP 3: Acquire distributed lock for race condition prevention
    // ========================================================================
    console.log(`🔒 [BOOKING-CREATE] Acquiring distributed lock for exam: ${mock_exam_id}`);

    lockToken = await redis.acquireLock(mock_exam_id, 10000); // 10 second lock
    if (!lockToken) {
      console.error(`❌ [BOOKING-CREATE] Failed to acquire lock - another booking in progress`);
      return res.status(409).json({
        success: false,
        error: {
          code: 'LOCK_ACQUISITION_FAILED',
          message: 'Another booking is in progress for this exam. Please try again.'
        }
      });
    }

    console.log(`✅ [BOOKING-CREATE] Lock acquired: ${lockToken}`);

    // ========================================================================
    // STEP 4: Check capacity (Supabase-first)
    // ========================================================================
    console.log(`📊 [BOOKING-CREATE] Checking capacity: ${currentTotalBookings}/${capacity}`);

    if (currentTotalBookings >= capacity) {
      await redis.releaseLock(mock_exam_id, lockToken);
      lockToken = null;
      console.error(`❌ [BOOKING-CREATE] Exam is full`);
      return res.status(409).json({
        success: false,
        error: {
          code: 'EXAM_FULL',
          message: 'This exam is fully booked'
        }
      });
    }

    // ========================================================================
    // STEP 5: Check for duplicate bookings using Redis cache
    // ========================================================================
    const cacheKey = `booking:${contact_id}:${exam_date}`;
    console.log(`🔍 [BOOKING-CREATE] Checking for duplicate booking: ${cacheKey}`);

    const existingBooking = await redis.get(cacheKey);
    if (existingBooking) {
      await redis.releaseLock(mock_exam_id, lockToken);
      lockToken = null;
      console.error(`❌ [BOOKING-CREATE] Duplicate booking detected in cache`);
      return res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_BOOKING',
          message: 'You already have a booking for this date'
        }
      });
    }

    // ========================================================================
    // STEP 6: Validate student has sufficient credits
    // ========================================================================
    console.log(`💳 [BOOKING-CREATE] Validating credits for ${mock_type}`);

    let creditField, tokenName;
    let specificCredits = 0;
    let sharedCredits = parseInt(contact.shared_mock_credits) || 0;

    // Map mock type to credit field and get specific credits
    switch (mock_type) {
      case 'Situational Judgment':
        creditField = 'sj_credits';
        tokenName = 'Situational Judgment Token';
        specificCredits = parseInt(contact.sj_credits) || 0;
        break;
      case 'Clinical Skills':
        creditField = 'cs_credits';
        tokenName = 'Clinical Skills Token';
        specificCredits = parseInt(contact.cs_credits) || 0;
        break;
      case 'Mini-mock':
        creditField = 'sjmini_credits';
        tokenName = 'Mini-mock Token';
        specificCredits = parseInt(contact.sjmini_credits) || 0;
        break;
      default:
        await redis.releaseLock(mock_exam_id, lockToken);
        lockToken = null;
        console.error(`❌ [BOOKING-CREATE] Invalid exam type: ${mock_type}`);
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_EXAM_TYPE',
            message: `Invalid exam type: ${mock_type}`
          }
        });
    }

    // Check if student has credits (specific OR shared for non-mini-mock)
    const hasCredits = mock_type === 'Mini-mock'
      ? specificCredits > 0
      : (specificCredits > 0 || sharedCredits > 0);

    if (!hasCredits) {
      await redis.releaseLock(mock_exam_id, lockToken);
      lockToken = null;
      console.error(`❌ [BOOKING-CREATE] Insufficient credits`);
      return res.status(402).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_CREDITS',
          message: 'You do not have sufficient credits to book this exam'
        }
      });
    }

    console.log(`✅ [BOOKING-CREATE] Credits validated: ${specificCredits} specific, ${sharedCredits} shared`);

    // ========================================================================
    // STEP 7: Determine which credit to deduct (specific first, then shared)
    // ========================================================================
    let creditToDeduct, tokenUsed;

    if (specificCredits > 0) {
      // Use specific credit
      creditToDeduct = creditField;
      tokenUsed = tokenName;
      console.log(`💰 [BOOKING-CREATE] Deducting specific credit: ${tokenName}`);
    } else if (sharedCredits > 0 && mock_type !== 'Mini-mock') {
      // Use shared credit (only for SJ/CS, not Mini-mock)
      creditToDeduct = 'shared_mock_credits';
      tokenUsed = 'Shared Token';
      console.log(`💰 [BOOKING-CREATE] Deducting shared credit`);
    } else {
      await redis.releaseLock(mock_exam_id, lockToken);
      lockToken = null;
      console.error(`❌ [BOOKING-CREATE] No valid credits to deduct`);
      return res.status(402).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_CREDITS',
          message: 'You do not have sufficient credits to book this exam'
        }
      });
    }

    // ========================================================================
    // STEP 8: Generate booking ID
    // ========================================================================
    const examDate = new Date(exam_date);
    const formattedDate = examDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const bookingId = `${mock_type}-${studentId}-${formattedDate}`;

    console.log(`🎫 [BOOKING-CREATE] Generated booking ID: ${bookingId}`);

    // ========================================================================
    // STEP 9: Create atomic booking in Supabase with credit deduction
    // ========================================================================
    console.log(`📝 [BOOKING-CREATE] Creating atomic booking in Supabase`);

    const { data: bookingResult, error: bookingError } = await supabaseAdmin.rpc(
      'create_booking_atomic',
      {
        p_booking_id: bookingId,
        p_mock_exam_id: mock_exam_id,
        p_contact_id: contact_id,
        p_student_id: studentId.toUpperCase(),
        p_student_name: contact.student_name,
        p_student_email: sanitizedEmail,
        p_booking_status: 'Confirmed',
        p_is_active: 'true',
        p_attendance: 'Pending',
        p_attending_location: location || examLocation || 'TBD',
        p_dominant_hand: dominantHand || 'Right',
        p_token_used: tokenUsed,
        p_credit_field: creditToDeduct
      }
    );

    if (bookingError) {
      await redis.releaseLock(mock_exam_id, lockToken);
      lockToken = null;
      console.error(`❌ [BOOKING-CREATE] Supabase atomic booking failed:`, bookingError);
      return res.status(500).json({
        success: false,
        error: {
          code: 'BOOKING_CREATION_FAILED',
          message: bookingError.message || 'Failed to create booking'
        }
      });
    }

    console.log(`✅ [BOOKING-CREATE] Atomic booking created: ${bookingResult.hubspot_id}`);

    // ========================================================================
    // STEP 10: Increment exam total_bookings in Supabase
    // ========================================================================
    const newTotalBookings = currentTotalBookings + 1;

    const { error: examUpdateError } = await supabaseAdmin
      .from('hubspot_mock_exams')
      .update({ total_bookings: newTotalBookings })
      .eq('hubspot_id', mock_exam_id);

    if (examUpdateError) {
      console.error(`⚠️ [BOOKING-CREATE] Failed to update exam total_bookings:`, examUpdateError);
      // Non-blocking - cron will reconcile
    } else {
      console.log(`✅ [BOOKING-CREATE] Exam total_bookings updated: ${newTotalBookings}`);
    }

    // ========================================================================
    // STEP 11: Cache booking to prevent duplicates
    // ========================================================================
    await redis.set(cacheKey, bookingResult.hubspot_id, 86400); // 24-hour cache
    console.log(`✅ [BOOKING-CREATE] Booking cached: ${cacheKey}`);

    // ========================================================================
    // STEP 12: Get updated credits after deduction
    // ========================================================================
    const { data: updatedContact, error: creditsFetchError } = await supabaseAdmin
      .from('hubspot_contact_credits')
      .select('*')
      .eq('hubspot_id', contact_id)
      .single();

    if (creditsFetchError) {
      console.error(`⚠️ [BOOKING-CREATE] Failed to fetch updated credits:`, creditsFetchError);
    }

    const creditsAfterDeduction = updatedContact ? {
      sj_credits: parseInt(updatedContact.sj_credits) || 0,
      cs_credits: parseInt(updatedContact.cs_credits) || 0,
      sjmini_credits: parseInt(updatedContact.sjmini_credits) || 0,
      mock_discussion_token: parseInt(updatedContact.mock_discussion_token) || 0,
      shared_mock_credits: parseInt(updatedContact.shared_mock_credits) || 0
    } : null;

    console.log(`💳 [BOOKING-CREATE] Credits after deduction:`, creditsAfterDeduction);

    // ========================================================================
    // STEP 13: Return success response
    // ========================================================================
    const response = {
      success: true,
      data: {
        bookingId: bookingResult.hubspot_id,
        examType: mock_type,
        examDate: exam_date,
        startTime: start_time,
        endTime: end_time,
        location: location || examLocation,
        tokenUsed: tokenUsed,
        creditsAfterDeduction
      },
      message: 'Booking created successfully'
    };

    // ========================================================================
    // DUAL WEBHOOK INTEGRATION - Sync to HubSpot (fire-and-forget)
    // ========================================================================
    const { HubSpotWebhookService } = require('../_shared/hubspot-webhook');

    process.nextTick(() => {
      // Fire-and-forget webhook sync (async operations run independently)
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

    return res.status(201).json(response);

  } catch (error) {
    // Release lock on error
    if (lockToken) {
      try {
        await redis.releaseLock(mock_exam_id, lockToken);
        console.log(`✅ Lock released after error`);
      } catch (releaseError) {
        console.error(`❌ Failed to release lock:`, releaseError);
      }
    }

    console.error('❌ Booking creation error:', {
      message: error.message,
      status: error.status || 500,
      code: error.code || 'INTERNAL_ERROR',
      stack: error.stack
    });

    return res.status(error.status || 500).json({
      success: false,
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: error.message || 'An unexpected error occurred'
      }
    });
  }
};