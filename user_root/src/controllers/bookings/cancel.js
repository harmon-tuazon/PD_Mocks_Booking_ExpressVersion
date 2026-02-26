const { HubSpotService, HUBSPOT_OBJECTS } = require('../../services/hubspot');
const { schemas } = require('../../services/validation');
const {
  createSuccessResponse,
  sanitizeInput
} = require('../../services/auth');
const {
  getBookingCascading,
  cancelBookingAtomic,
  getContactCreditsFromSupabase,
  updateExamBookingCountInSupabase
} = require('../../services/supabase-data');
const { HubSpotWebhookService } = require('../../services/hubspot-webhook');
const RedisLockService = require('../../services/redis');

/**
 * DELETE /api/bookings/:id
 * Cancel a booking with credit restoration and cache invalidation
 *
 * Prerequisites (applied by route middleware):
 *   - authenticate: populates req.user
 */
const cancel = async (req, res, next) => {
  try {
    // Extract booking ID from route params (was req.query.id in Vercel)
    const bookingId = req.params.id;

    if (!bookingId) {
      const error = new Error('Booking ID is required');
      error.status = 400;
      error.code = 'MISSING_BOOKING_ID';
      return next(error);
    }

    // Validate input from body (mixed params + body — kept inline)
    const inputParams = {
      student_id: req.body.student_id,
      email: req.body.email,
      reason: req.body.reason
    };

    const { error, value: validatedData } = schemas.bookingCancellation.validate(inputParams);
    if (error) {
      const validationError = new Error(`Invalid input: ${error.details.map(detail => detail.message).join(', ')}`);
      validationError.status = 400;
      validationError.code = 'VALIDATION_ERROR';
      return next(validationError);
    }

    const { student_id, email, reason } = validatedData;

    console.log(`📋 Processing booking DELETE request:`, {
      bookingId: sanitizeInput(bookingId),
      student_id: sanitizeInput(student_id),
      email: sanitizeInput(email),
      ...(reason ? { reason: sanitizeInput(reason) } : {})
    });

    const sanitizedStudentId = sanitizeInput(student_id);
    const sanitizedEmail = sanitizeInput(email);
    const sanitizedBookingId = sanitizeInput(bookingId);

    const hubspot = new HubSpotService();

    // Step 1: Authenticate user (Supabase-first)
    const contact = await getContactCreditsFromSupabase(sanitizedStudentId, sanitizedEmail);

    if (!contact) {
      const authError = new Error('Authentication failed. Please check your Student ID and email.');
      authError.status = 401;
      authError.code = 'AUTH_FAILED';
      return next(authError);
    }

    const contactHubspotId = contact.hubspot_id;
    console.log(`✅ Contact authenticated (Supabase): ${contactHubspotId} - ${contact.firstname} ${contact.lastname}`);

    // Step 2: Fetch booking
    console.log('🗑️ [DELETE] Processing enhanced booking cancellation:', {
      bookingId: sanitizedBookingId,
      contactId: contactHubspotId,
      reason
    });

    const booking = await getBookingCascading(sanitizedBookingId);
    if (!booking) {
      console.error('❌ Booking not found:', sanitizedBookingId);
      const notFoundError = new Error('Booking not found');
      notFoundError.status = 404;
      notFoundError.code = 'BOOKING_NOT_FOUND';
      return next(notFoundError);
    }

    console.log('✅ Booking found:', {
      id: booking.id,
      booking_id: booking.booking_id,
      is_active: booking.is_active,
      student_id: booking.student_id,
      associated_mock_exam: booking.associated_mock_exam,
      associated_contact_id: booking.associated_contact_id
    });

    // Step 1.5: OWNERSHIP VERIFICATION
    const bookingContactId = booking.associated_contact_id;
    const isOwner = bookingContactId && contactHubspotId &&
                    String(bookingContactId) === String(contactHubspotId);

    console.log('🔐 [OWNERSHIP] Verification:', {
      bookingContactId,
      authenticatedContactId: contactHubspotId,
      isOwner
    });

    if (!isOwner) {
      console.error('❌ [OWNERSHIP] User does not own this booking');
      const forbiddenError = new Error('You do not have permission to cancel this booking');
      forbiddenError.status = 403;
      forbiddenError.code = 'FORBIDDEN';
      return next(forbiddenError);
    }

    const bookingData = booking;

    // Step 2: Check if already cancelled
    if (bookingData.is_active !== 'Active') {
      console.log('⚠️ Booking already cancelled or completed:', bookingData.is_active);
      const alreadyCancelledError = new Error('Booking is already cancelled');
      alreadyCancelledError.status = 409;
      alreadyCancelledError.code = 'ALREADY_CANCELED';
      return next(alreadyCancelledError);
    }

    // Step 3: Determine credit field to restore
    const tokenUsed = bookingData.token_used;

    const tokenToCreditFieldMapping = {
      'Situational Judgment Token': 'sj_credits',
      'Clinical Skills Token': 'cs_credits',
      'Mini-mock Token': 'sjmini_credits',
      'Mock Discussion Token': 'mock_discussion_token',
      'Shared Token': 'shared_mock_credits'
    };

    const creditField = tokenToCreditFieldMapping[tokenUsed];

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
      console.warn(`⚠️ Unknown token type: ${tokenUsed}, skipping credit restoration`);
    }

    // Step 4: Cancel booking (Supabase-first)
    let cancellationResult;
    try {
      if (creditField && restoredCreditValue !== null) {
        cancellationResult = await cancelBookingAtomic({
          bookingId: bookingData.id,
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
        const { db } = require('../../services/supabase');

        const { data, error: updateError } = await db
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
      const failedError = new Error('Failed to cancel booking');
      failedError.status = 500;
      failedError.code = 'CANCEL_FAILED';
      return next(failedError);
    }

    // Step 5: Decrement Supabase total_bookings atomically
    try {
      await updateExamBookingCountInSupabase(bookingData.associated_mock_exam, 1, 'decrement');
      console.log(`✅ [SUPABASE] Decremented exam ${bookingData.associated_mock_exam} total_bookings atomically`);
    } catch (supabaseError) {
      console.error(`❌ [SUPABASE] Failed to decrement total_bookings:`, supabaseError.message);
    }

    // Decrement Redis counter
    const redis = new RedisLockService();
    const newTotalBookings = await redis.decr(`exam:${bookingData.associated_mock_exam}:bookings`);
    console.log(`✅ Decremented Redis counter: exam:${bookingData.associated_mock_exam}:bookings = ${newTotalBookings}`);

    // Fire-and-forget webhook sync
    process.nextTick(() => {
      (async () => {
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

        if (creditField && currentCredits) {
          const restoredCredits = {
            sj_credits: currentCredits?.sj_credits || 0,
            cs_credits: currentCredits?.cs_credits || 0,
            sjmini_credits: currentCredits?.sjmini_credits || 0,
            mock_discussion_token: currentCredits?.mock_discussion_token || 0,
            shared_mock_credits: currentCredits?.shared_mock_credits || 0
          };

          restoredCredits[creditField] = restoredCreditValue;

          const creditsSyncResult = await HubSpotWebhookService.syncContactCredits(
            contactHubspotId,
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
      if (newTotalBookings < 0) {
        console.warn(`⚠️ [REDIS] Negative booking counter detected: ${newTotalBookings}, resetting to 0`);
        const counterKey = `exam:${bookingData.associated_mock_exam}:bookings`;
        const mockExam = await hubspot.getMockExam(bookingData.associated_mock_exam);

        if (mockExam) {
          const correctCount = parseInt(mockExam.properties.total_bookings) || 0;
          const TTL_1_WEEK = 7 * 24 * 60 * 60;
          await redis.setex(counterKey, TTL_1_WEEK, correctCount);
          console.log(`✅ [REDIS] Counter corrected to ${correctCount} from HubSpot`);
        } else {
          const TTL_1_WEEK = 7 * 24 * 60 * 60;
          await redis.setex(counterKey, TTL_1_WEEK, 0);
          console.log(`✅ [REDIS] Reset counter to 0 for exam ${bookingData.associated_mock_exam}`);
        }
      }

      if (bookingData.associated_contact_id && bookingData.exam_date && bookingData.mock_type) {
        const normalizedDate = String(bookingData.exam_date).split('T')[0];

        const duplicateKey = `booking:${bookingData.associated_contact_id}:${normalizedDate}:${bookingData.mock_type}`;
        console.log(`🔍 [DEBUG] Attempting to delete cache key: ${duplicateKey}`);
        const deletedCount = await redis.del(duplicateKey);

        if (deletedCount > 0) {
          console.log(`✅ [REDIS] Invalidated duplicate cache: ${duplicateKey}`);
        } else {
          console.warn(`⚠️ [REDIS] Cache key not found: ${duplicateKey}`);
        }

        const oldFormatKey = `booking:${bookingData.associated_contact_id}:${normalizedDate}`;
        await redis.del(oldFormatKey);
      } else {
        console.error(`❌ [REDIS] Cannot invalidate cache - missing data:`, {
          associated_contact_id: bookingData.associated_contact_id,
          exam_date: bookingData.exam_date,
          mock_type: bookingData.mock_type
        });
      }

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
    console.error('❌ Booking cancellation error:', {
      message: error.message,
      status: error.status || 500,
      code: error.code || 'INTERNAL_ERROR',
      stack: error.stack
    });

    next(error);
  }
};

module.exports = { cancel };
