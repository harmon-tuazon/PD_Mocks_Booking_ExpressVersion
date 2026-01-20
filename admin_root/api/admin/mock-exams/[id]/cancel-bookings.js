/**
 * PATCH /api/admin/mock-exams/[id]/cancel-bookings
 * Batch cancel bookings for a mock exam (soft delete)
 *
 * Features:
 * - Batch cancel multiple bookings (up to 100 per request)
 * - Idempotent operations - safe to retry
 * - Soft delete: sets is_active = "Cancelled"
 * - Token refund processing (configurable via refundTokens flag)
 * - Partial failure handling with detailed error reporting
 * - HubSpot batch API optimization with automatic chunking
 * - Supabase-only booking support (bookings not yet synced to HubSpot)
 * - Cache invalidation for affected resources
 * - Audit logging with booking names and refund results
 *
 * Request Body:
 * {
 *   "bookings": [
 *     {
 *       "id": "string (Supabase UUID - primary identifier)",
 *       "hubspot_id": "string (HubSpot numeric ID - may be null for Supabase-only bookings)",
 *       "token_used": "string (optional)",
 *       "associated_contact_id": "string (optional)",
 *       "name": "string (optional)",
 *       "email": "string (optional)"
 *     }
 *   ],
 *   "refundTokens": boolean (optional, default: true)
 * }
 *
 * Path Parameters:
 * - id: Mock exam ID
 *
 * Returns:
 * - Detailed results for each booking cancellation
 * - Summary statistics (total, cancelled, failed, skipped)
 * - Error details for failed cancellations
 */

const { requirePermission } = require('../../middleware/requirePermission');
const { validationMiddleware } = require('../../../_shared/validation');
const { getCache } = require('../../../_shared/cache');
const hubspot = require('../../../_shared/hubspot');
const RedisLockService = require('../../../_shared/redis');
const { updateBookingStatusInSupabase, updateExamBookingCountInSupabase } = require('../../../_shared/supabase-data');

// HubSpot Object Type IDs
const HUBSPOT_OBJECTS = {
  'bookings': '2-50158943',
  'mock_exams': '2-50158913',
  'notes': '0-46'
};

// Maximum bookings per request (HubSpot batch limit is 100)
const MAX_BOOKINGS_PER_REQUEST = 100;
const HUBSPOT_BATCH_SIZE = 100;

module.exports = async (req, res) => {
  const startTime = Date.now();

  try {
    // Verify admin authentication and permission
    const user = await requirePermission(req, 'bookings.batch_cancel');
    const adminEmail = user?.email || 'admin@prepdoctors.com';

    // Extract ID from query params (Vercel provides dynamic route params via req.query)
    const mockExamId = req.query.id;

    // Validate mock exam ID
    if (!mockExamId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_MOCK_EXAM_ID',
          message: 'Mock exam ID is required'
        }
      });
    }

    if (!/^\d+$/.test(mockExamId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_MOCK_EXAM_ID',
          message: 'Invalid mock exam ID format'
        }
      });
    }

    // Validate request body
    const validator = validationMiddleware('batchBookingCancellation');
    await new Promise((resolve, reject) => {
      validator(req, res, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });

    const { bookings, refundTokens = true } = req.validatedData;

    // Updated naming convention:
    // - id: Supabase UUID (primary identifier)
    // - hubspot_id: HubSpot numeric ID (may be null for Supabase-only bookings)
    // Separate bookings into HubSpot-synced (has hubspot_id) and Supabase-only (has only id)
    const hubspotBookings = bookings.filter(b => b.hubspot_id);  // Has HubSpot ID
    const supabaseOnlyBookings = bookings.filter(b => !b.hubspot_id && b.id);  // Supabase-first, not synced

    console.log(`🗑️ [CANCEL] Processing batch cancellation for mock exam ${mockExamId}`);
    console.log(`🗑️ [CANCEL] Total bookings: ${bookings.length} (HubSpot: ${hubspotBookings.length}, Supabase-only: ${supabaseOnlyBookings.length})`);
    console.log(`🔄 [CANCEL] Token refunds enabled: ${refundTokens}`);

    // Extract HubSpot booking IDs for processing
    const bookingIds = hubspotBookings.map(b => b.hubspot_id);

    // Check if bookings array is within limits
    if (bookings.length > MAX_BOOKINGS_PER_REQUEST) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BATCH_SIZE_EXCEEDED',
          message: `Maximum ${MAX_BOOKINGS_PER_REQUEST} bookings can be cancelled per request`,
          details: { provided: bookings.length, maximum: MAX_BOOKINGS_PER_REQUEST }
        }
      });
    }

    // Initialize Redis for cache clearing
    const redis = new RedisLockService();

    // Lightweight validation: Fetch is_active and exam_date for cache clearing
    // Note: contact_id comes from frontend (associated_contact_id) since it's not stored as a booking property
    const bookingDataMap = new Map();

    // Only fetch from HubSpot if there are HubSpot-synced bookings
    if (hubspotBookings.length > 0) {
      console.log(`🔍 [CANCEL] Fetching booking data from HubSpot for ${hubspotBookings.length} bookings...`);

      // Fetch is_active, exam_date, and mock_type (needed for Redis cache clearing)
      for (let i = 0; i < bookingIds.length; i += HUBSPOT_BATCH_SIZE) {
        const chunk = bookingIds.slice(i, i + HUBSPOT_BATCH_SIZE);

        try {
          const response = await hubspot.apiCall('POST', `/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}/batch/read`, {
            properties: ['is_active', 'exam_date', 'mock_type'],  // Properties for validation + cache clearing (Option B)
            inputs: chunk.map(id => ({ id }))
          });

          if (response.results) {
            for (const booking of response.results) {
              bookingDataMap.set(booking.id, {
                is_active: booking.properties.is_active,
                exam_date: booking.properties.exam_date,
                mock_type: booking.properties.mock_type
                // Note: contact_id will be added from frontend data below
              });
            }
          }
        } catch (error) {
          console.error(`❌ [CANCEL] Error fetching booking data batch:`, error);
          // Continue processing other batches
        }
      }

      // Merge frontend contact_id into bookingDataMap
      // Frontend provides associated_contact_id which is more reliable than HubSpot property
      for (const booking of hubspotBookings) {
        const hubspotData = bookingDataMap.get(booking.hubspot_id);
        if (hubspotData && booking.associated_contact_id) {
          hubspotData.contact_id = booking.associated_contact_id;
        }
      }

      console.log(`✅ [CANCEL] Fetched data for ${bookingDataMap.size} bookings from HubSpot`);
    }

    // For Supabase-only bookings, fetch data from Supabase
    if (supabaseOnlyBookings.length > 0) {
      console.log(`🔍 [CANCEL] Fetching booking data from Supabase for ${supabaseOnlyBookings.length} Supabase-only bookings...`);
      const { supabaseAdmin } = require('../../../_shared/supabase');

      // Use id (Supabase UUID) for lookup
      const supabaseIds = supabaseOnlyBookings.map(b => b.id);
      const { data: supabaseData, error: supabaseError } = await supabaseAdmin
        .from('hubspot_bookings')
        .select('id, is_active, exam_date, associated_contact_id, mock_type')
        .in('id', supabaseIds);

      if (supabaseError) {
        console.error(`❌ [CANCEL] Error fetching Supabase booking data:`, supabaseError);
      } else if (supabaseData) {
        for (const booking of supabaseData) {
          // Use id (Supabase UUID) as the key (prefixed to distinguish from HubSpot IDs)
          bookingDataMap.set(`supabase:${booking.id}`, {
            is_active: booking.is_active,
            exam_date: booking.exam_date,
            contact_id: booking.associated_contact_id,
            mock_type: booking.mock_type
          });
        }
        console.log(`✅ [CANCEL] Fetched data for ${supabaseData.length} bookings from Supabase`);
      }
    }

    // Initialize result tracking
    const results = {
      successful: [],
      failed: [],
      skipped: []
    };

    console.log(`🔍 [DEBUG] Initializing updates arrays...`);

    // Validate and prepare updates using bookings array from frontend
    const hubspotUpdates = [];       // Updates for HubSpot batch API
    const supabaseOnlyUpdates = [];  // Updates for Supabase-only bookings
    const bookingDetailsForAudit = [];

    console.log(`🔍 [DEBUG] Starting booking validation loop for ${bookings.length} bookings...`);

    for (const booking of bookings) {
      // Determine which ID to use for lookup
      // New naming: id = Supabase UUID, hubspot_id = HubSpot numeric ID
      const isSupabaseOnly = !booking.hubspot_id && booking.id;
      const lookupKey = isSupabaseOnly ? `supabase:${booking.id}` : booking.hubspot_id;
      const displayId = booking.hubspot_id || booking.id;

      console.log(`🔍 [DEBUG] Processing booking ${displayId} (isSupabaseOnly: ${isSupabaseOnly})...`);
      const bookingData = bookingDataMap.get(lookupKey);

      // Check if booking exists
      if (!bookingData) {
        console.log(`❌ [DEBUG] Booking ${displayId} not found in bookingDataMap`);
        results.failed.push({
          bookingId: displayId,
          id: booking.id,  // Supabase UUID
          hubspot_id: booking.hubspot_id,
          error: 'Booking not found',
          code: 'BOOKING_NOT_FOUND'
        });
        continue;
      }

      console.log(`🔍 [DEBUG] Booking ${displayId} status: ${bookingData.is_active}`);

      // Check if already cancelled (idempotent)
      if (bookingData.is_active === 'Cancelled') {
        console.log(`⏭️ [DEBUG] Booking ${displayId} already cancelled, skipping`);
        results.skipped.push({
          bookingId: displayId,
          id: booking.id,  // Supabase UUID
          hubspot_id: booking.hubspot_id,
          reason: 'Already cancelled',
          currentStatus: 'Cancelled'
        });
        continue;
      }

      console.log(`✅ [DEBUG] Booking ${displayId} ready for cancellation`);

      if (isSupabaseOnly) {
        // Prepare Supabase-only update (use id which is Supabase UUID)
        supabaseOnlyUpdates.push({
          id: booking.id,  // Supabase UUID
          contact_id: bookingData.contact_id,
          exam_date: bookingData.exam_date
        });
      } else {
        // Prepare HubSpot update (use hubspot_id)
        hubspotUpdates.push({
          id: booking.hubspot_id,  // HubSpot numeric ID
          supabaseId: booking.id,  // Supabase UUID for Supabase sync
          properties: {
            is_active: 'Cancelled'
          }
        });
      }

      // Store booking details for audit log (using frontend data)
      bookingDetailsForAudit.push({
        id: displayId,
        hubspot_id: booking.hubspot_id,
        supabase_id: booking.id,  // Now id is Supabase UUID
        name: booking.name || 'Unknown',
        email: booking.email || 'No email'
      });
    }

    console.log(`🔍 [DEBUG] Finished validation loop. HubSpot updates: ${hubspotUpdates.length}, Supabase-only updates: ${supabaseOnlyUpdates.length}, Failed: ${results.failed.length}, Skipped: ${results.skipped.length}`);

    // Process HubSpot updates in batches
    if (hubspotUpdates.length > 0) {
      console.log(`🔍 [DEBUG] Entering processCancellations for HubSpot...`);
      console.log(`⚡ [CANCEL] Processing ${hubspotUpdates.length} HubSpot cancellations...`);

      const updateResults = await processCancellations(hubspotUpdates);

      // Process results
      for (const result of updateResults.successful) {
        results.successful.push({
          bookingId: result.id,
          status: 'cancelled',
          message: 'Successfully cancelled in HubSpot'
        });
      }

      for (const error of updateResults.failed) {
        results.failed.push({
          bookingId: error.id,
          error: error.message || 'Failed to cancel booking',
          code: 'UPDATE_FAILED'
        });
      }
    }

    // Process Supabase-only cancellations (bookings not synced to HubSpot)
    if (supabaseOnlyUpdates.length > 0) {
      console.log(`⚡ [CANCEL] Processing ${supabaseOnlyUpdates.length} Supabase-only cancellations...`);
      const { supabaseAdmin } = require('../../../_shared/supabase');

      for (const update of supabaseOnlyUpdates) {
        try {
          const { error: updateError } = await supabaseAdmin
            .from('hubspot_bookings')
            .update({
              is_active: 'Cancelled',
              updated_at: new Date().toISOString()
            })
            .eq('id', update.id);  // Use id which is now Supabase UUID

          if (updateError) {
            throw updateError;
          }

          results.successful.push({
            bookingId: update.id,
            id: update.id,  // Supabase UUID
            status: 'cancelled',
            message: 'Successfully cancelled in Supabase (not yet synced to HubSpot)'
          });
          console.log(`✅ [CANCEL] Cancelled Supabase-only booking ${update.id}`);
        } catch (error) {
          console.error(`❌ [CANCEL] Failed to cancel Supabase-only booking ${update.id}:`, error);
          results.failed.push({
            bookingId: update.id,
            id: update.id,
            error: error.message || 'Failed to cancel booking in Supabase',
            code: 'SUPABASE_UPDATE_FAILED'
          });
        }
      }
    }

    // Clear Redis duplicate detection cache for successfully cancelled bookings (ENHANCED LOGGING)
    if (results.successful.length > 0) {
      console.log(`🗑️ [REDIS] Clearing duplicate detection cache for ${results.successful.length} cancelled bookings...`);
      console.log(`🔍 [REDIS DEBUG] Redis instance exists: ${!!redis}`);
      console.log(`🔍 [REDIS DEBUG] Mock Exam ID: ${mockExamId}`);

      let finalExamCount = null;  // Track final count after all decrements

      for (const result of results.successful) {
        // Determine the correct lookup key based on whether it's a HubSpot or Supabase-only booking
        // result.id is Supabase UUID, result.bookingId could be either HubSpot ID or Supabase UUID
        const isSupabaseOnly = result.id && !result.bookingId?.match(/^\d+$/);
        const lookupKey = isSupabaseOnly
          ? `supabase:${result.id}`
          : result.bookingId;
        const bookingData = bookingDataMap.get(lookupKey);

          console.log(`🔍 [REDIS DEBUG] Processing booking ${result.bookingId}:`);
          console.log(`🔍 [REDIS DEBUG] - contact_id: ${bookingData?.contact_id}`);
          console.log(`🔍 [REDIS DEBUG] - exam_date: ${bookingData?.exam_date}`);
          console.log(`🔍 [REDIS DEBUG] - mock_type: ${bookingData?.mock_type}`);

          if (bookingData?.contact_id && bookingData?.exam_date && bookingData?.mock_type) {
            // Normalize exam_date to YYYY-MM-DD format for consistent cache keys
            const normalizedExamDate = bookingData.exam_date.includes('T')
              ? bookingData.exam_date.split('T')[0]
              : bookingData.exam_date;

            // New cache key format includes mock_type (Option B)
            const redisKey = `booking:${bookingData.contact_id}:${normalizedExamDate}:${bookingData.mock_type}`;
            console.log(`🔍 [REDIS DEBUG] Attempting to delete cache key: "${redisKey}"`);

            try {
              // Check if key exists before deletion
              const keyExistsBefore = await redis.get(redisKey);
              console.log(`🔍 [REDIS DEBUG] Cache key exists before deletion: ${keyExistsBefore !== null} (value: ${keyExistsBefore})`);

              // Delete the cache key using wrapper method
              const deletedCount = await redis.del(redisKey);
              console.log(`🔍 [REDIS DEBUG] redis.del() returned: ${deletedCount} (1 = deleted, 0 = key didn't exist)`);

              // Also try to delete old format key (for backwards compatibility during transition)
              const oldFormatKey = `booking:${bookingData.contact_id}:${normalizedExamDate}`;
              await redis.del(oldFormatKey);

              // Verify deletion
              const keyExistsAfter = await redis.get(redisKey);
              console.log(`🔍 [REDIS DEBUG] Cache key exists after deletion: ${keyExistsAfter !== null} (should be false)`);

              // Decrement exam booking counter (with safety check)
              const counterKey = `exam:${mockExamId}:bookings`;
              const counterBefore = await redis.get(counterKey);
              const currentCount = parseInt(counterBefore) || 0;
              console.log(`🔍 [REDIS DEBUG] Counter before decrement: ${counterBefore}`);

              // Safety check: Don't decrement below 0
              let newCount;
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
              }

              // Track final count for webhook trigger
              finalExamCount = newCount;

              if (keyExistsAfter === null) {
                console.log(`✅ [REDIS] Successfully cleared cache for contact ${bookingData.contact_id} on ${bookingData.exam_date} (${bookingData.mock_type})`);
                console.log(`✅ [REDIS] Updated exam counter: ${counterBefore} → ${newCount}`);
              } else {
                console.error(`❌ [REDIS] CRITICAL: Cache key still exists after deletion! Value: ${keyExistsAfter}`);
              }
            } catch (redisError) {
              console.error(`❌ [REDIS] Cache clearing FAILED for booking ${result.bookingId}:`, {
                error: redisError.message,
                stack: redisError.stack,
                contact_id: bookingData.contact_id,
                exam_date: bookingData.exam_date,
                mock_type: bookingData.mock_type
              });
              // Don't fail the cancellation if Redis clearing fails
            }
          } else {
            console.warn(`⚠️ [REDIS] Missing contact_id, exam_date, or mock_type for booking ${result.bookingId}:`, {
              hasContactId: !!bookingData?.contact_id,
              hasExamDate: !!bookingData?.exam_date,
              hasMockType: !!bookingData?.mock_type,
              bookingData
            });
          }
        }

      // Trigger HubSpot workflow via webhook with final count after all decrements
      if (finalExamCount !== null) {
        const { HubSpotWebhookService } = require('../../../_shared/hubspot-webhook');

        process.nextTick(async () => {
          const webhookResult = await HubSpotWebhookService.syncWithRetry(
            mockExamId,
            finalExamCount,
            3 // 3 retries with exponential backoff
          );

          if (webhookResult.success) {
            console.log(`✅ [WEBHOOK] HubSpot workflow triggered after batch mock exam cancellation: ${webhookResult.message}`);
          } else {
            console.error(`❌ [WEBHOOK] All retry attempts failed: ${webhookResult.message}`);
            console.error(`⏰ [WEBHOOK] Reconciliation cron will fix drift within 2 hours`);
          }
        });
      }
    }

    // Process token refunds if enabled
    let refundResults = null;
    if (refundTokens && results.successful.length > 0) {
      console.log(`🔄 [REFUND] Processing token refunds for ${results.successful.length} bookings`);

      const refundService = require('../../../_shared/refund');

      // Get bookings that were successfully cancelled (match by either HubSpot ID or Supabase UUID)
      // Note: result.bookingId can be HubSpot ID or Supabase UUID, result.id is always Supabase UUID
      const successfulBookingIds = results.successful.map(r => r.bookingId);
      const successfulSupabaseIds = results.successful.filter(r => r.id).map(r => r.id);
      const bookingsToRefund = bookings.filter(b =>
        successfulBookingIds.includes(b.hubspot_id) ||
        successfulBookingIds.includes(b.id) ||
        successfulSupabaseIds.includes(b.id)
      );

      try {
        refundResults = await refundService.processRefunds(bookingsToRefund, adminEmail);

        console.log(`✅ [REFUND] Refunded: ${refundResults.successful.length}, Failed: ${refundResults.failed.length}, Skipped: ${refundResults.skipped.length}`);
      } catch (error) {
        console.error(`❌ [REFUND] Error processing refunds:`, error);
        // Don't fail the entire request if refunds fail
        refundResults = {
          successful: [],
          failed: bookingsToRefund.map(b => ({
            bookingId: b.id,
            error: error.message || 'Refund processing failed',
            code: 'REFUND_ERROR'
          })),
          skipped: []
        };
      }
    }

    // Invalidate relevant caches
    if (results.successful.length > 0) {
      await invalidateCancellationCaches(mockExamId);
      console.log(`🗑️ [CANCEL] Caches invalidated for mock exam ${mockExamId}`);
    }

    // Sync HubSpot cancellations to Supabase (Supabase-only bookings already updated above)
    // Only sync bookings that have HubSpot IDs (numeric IDs)
    let supabaseSynced = false;
    const hubspotCancelledBookings = [
      ...results.successful.filter(r => r.bookingId?.match(/^\d+$/)).map(r => r.bookingId),
      ...results.skipped.filter(r => r.currentStatus === 'Cancelled' && r.bookingId?.match(/^\d+$/)).map(r => r.bookingId)
    ];

    if (hubspotCancelledBookings.length > 0) {
      try {
        console.log(`🔄 [SUPABASE] Syncing ${hubspotCancelledBookings.length} HubSpot cancelled bookings to Supabase`);

        const supabaseUpdates = hubspotCancelledBookings.map(bookingId =>
          updateBookingStatusInSupabase(bookingId, 'Cancelled')
        );

        const supabaseResults = await Promise.allSettled(supabaseUpdates);
        const syncedCount = supabaseResults.filter(r => r.status === 'fulfilled').length;
        console.log(`✅ [CANCEL] Synced ${syncedCount}/${hubspotCancelledBookings.length} HubSpot cancellations to Supabase`);
        supabaseSynced = syncedCount === hubspotCancelledBookings.length;
      } catch (supabaseError) {
        console.error('❌ Supabase cancellation sync failed:', supabaseError.message);
        // Continue - HubSpot is source of truth
      }
    }

    // SUPABASE SYNC: Atomically decrement exam booking count in Supabase
    // Only decrement for newly cancelled bookings (not already-cancelled ones)
    const newlyCancelledCount = results.successful.length;
    if (newlyCancelledCount > 0) {
      try {
        await updateExamBookingCountInSupabase(mockExamId, null, 'decrement', newlyCancelledCount);
      } catch (supabaseError) {
        console.error(`⚠️ Supabase exam count sync failed (non-blocking):`, supabaseError.message);
        // Fallback is built into the function - it will fetch and update if RPC fails
      }
    }

    // Calculate summary
    const summary = {
      total: bookings.length,  // All bookings (both HubSpot and Supabase-only)
      cancelled: results.successful.length,
      failed: results.failed.length,
      skipped: results.skipped.length
    };

    // Create audit trail
    if (results.successful.length > 0) {
      const successfulBookingDetails = bookingDetailsForAudit.filter(b =>
        results.successful.some(s => s.bookingId === b.id)
      );

      // DEBUG: Log what's being passed to createAuditLog
      console.log(`🐛 [DEBUG] Creating audit log with ${successfulBookingDetails.length} successful bookings:`);
      successfulBookingDetails.forEach(detail => {
        console.log(`🐛 [DEBUG] - Booking ${detail.id}: "${detail.name}" (${detail.email})`);
      });

      // Create audit log asynchronously (non-blocking)
      createAuditLog(mockExamId, summary, adminEmail, successfulBookingDetails, refundResults).catch(error => {
        console.error('Failed to create audit log:', error);
      });
    }

    // Return response
    const executionTime = Date.now() - startTime;

    res.status(200).json({
      success: true,
      data: {
        summary,
        refundSummary: refundResults ? {
          enabled: true,
          successful: refundResults.successful.length,
          failed: refundResults.failed.length,
          skipped: refundResults.skipped.length,
          details: refundResults
        } : {
          enabled: false
        },
        results
      },
      meta: {
        timestamp: new Date().toISOString(),
        processedBy: adminEmail,
        mockExamId,
        executionTime
      },
      supabase_synced: supabaseSynced
    });

  } catch (error) {
    console.error('❌ [CANCEL] Error in batch booking cancellation:', error);

    // Handle validation errors
    if (error.validationErrors) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: error.validationErrors
        }
      });
    }

    // Handle auth errors
    if (error.message?.includes('authorization') || error.message?.includes('token')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
    }

    // Handle timeout errors (Vercel 60s limit)
    if (Date.now() - startTime > 55000) {
      return res.status(504).json({
        success: false,
        error: {
          code: 'TIMEOUT',
          message: 'Request timeout. Please try with fewer bookings.'
        }
      });
    }

    // Generic error
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'An error occurred while cancelling bookings'
      }
    });
  }
};

/**
 * Fetch bookings in batches from HubSpot
 * Reusing pattern from attendance.js lines 313-345
 */
async function fetchBookingsBatch(bookingIds) {
  const bookingsMap = new Map();

  // Split into chunks of 100 (HubSpot batch limit)
  for (let i = 0; i < bookingIds.length; i += HUBSPOT_BATCH_SIZE) {
    const chunk = bookingIds.slice(i, i + HUBSPOT_BATCH_SIZE);

    try {
      const response = await hubspot.apiCall('POST', `/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}/batch/read`, {
        properties: [
          'is_active',
          'name',
          'email'
        ],
        inputs: chunk.map(id => ({ id }))
      });

      if (response.results) {
        for (const booking of response.results) {
          bookingsMap.set(booking.id, booking);
        }
      }
    } catch (error) {
      console.error(`Error fetching booking batch:`, error);
      // Continue processing other batches
    }
  }

  return bookingsMap;
}

/**
 * Process cancellations in batches
 * Reusing pattern from attendance.js lines 350-391
 */
async function processCancellations(updates) {
  const results = {
    successful: [],
    failed: []
  };

  // Split into chunks of 100 (HubSpot batch limit)
  for (let i = 0; i < updates.length; i += HUBSPOT_BATCH_SIZE) {
    const chunk = updates.slice(i, i + HUBSPOT_BATCH_SIZE);

    try {
      const response = await hubspot.apiCall('POST', `/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}/batch/update`, {
        inputs: chunk
      });

      if (response.results) {
        results.successful.push(...response.results);
      }

      // Handle partial failures
      if (response.errors) {
        for (const error of response.errors) {
          results.failed.push({
            id: error.context?.id || 'unknown',
            message: error.message
          });
        }
      }
    } catch (error) {
      console.error(`Error processing cancellation batch:`, error);

      // Mark all items in this chunk as failed
      for (const update of chunk) {
        results.failed.push({
          id: update.id,
          message: error.message || 'Batch update failed'
        });
      }
    }
  }

  return results;
}

/**
 * Invalidate caches affected by booking cancellations
 * Reusing pattern from attendance.js lines 397-419
 */
async function invalidateCancellationCaches(mockExamId) {
  const cache = getCache();

  try {
    // Invalidate mock exam details cache
    await cache.delete(`admin:mock-exam:${mockExamId}`);
    await cache.delete(`admin:mock-exam:details:${mockExamId}`);

    // Invalidate bookings list cache for this mock exam
    await cache.deletePattern(`admin:mock-exam:${mockExamId}:bookings:*`);

    // Invalidate aggregate caches
    await cache.deletePattern('admin:mock-exams:aggregates:*');
    await cache.deletePattern('admin:aggregate:sessions:*');
    await cache.deletePattern('admin:metrics:*');

    // Invalidate mock exams list cache (as cancellations affect statistics)
    await cache.deletePattern('admin:mock-exams:list:*');
  } catch (error) {
    console.error('Error invalidating caches:', error);
    // Don't fail the request if cache invalidation fails
  }
}

/**
 * Create audit log for booking cancellations
 * Following Section 5.5 of PRD for audit trail with booking names
 */
async function createAuditLog(mockExamId, summary, adminEmail, bookingDetails, refundResults) {
  try {
    // DEBUG: Log what createAuditLog receives
    const timestamp = new Date().toISOString();
    console.log(`🐛 [DEBUG] createAuditLog called at ${timestamp} with:`);
    console.log(`🐛 [DEBUG] - mockExamId: ${mockExamId}`);
    console.log(`🐛 [DEBUG] - adminEmail: ${adminEmail}`);
    console.log(`🐛 [DEBUG] - bookingDetails (${bookingDetails.length} items):`);
    bookingDetails.forEach(detail => {
      console.log(`🐛 [DEBUG]   - ID: ${detail.id}, Name: "${detail.name}", Email: ${detail.email}`);
    });

    // Format booking details for display (max 5 shown, rest as count)
    let bookingsList = '';
    if (bookingDetails.length <= 5) {
      bookingsList = bookingDetails
        .map(b => `• ${b.name} (${b.email})`)
        .join('<br/>');
    } else {
      const firstFive = bookingDetails.slice(0, 5);
      bookingsList = firstFive
        .map(b => `• ${b.name} (${b.email})`)
        .join('<br/>');
      bookingsList += `<br/>• ... and ${bookingDetails.length - 5} more`;
    }

    // Create a note in the mock exam's timeline
    const noteContent = `
      <strong>🗑️ Batch Booking Cancellation</strong><br/>
      <hr/>
      <strong>Summary:</strong><br/>
      • Total Processed: ${summary.total}<br/>
      • Successfully Cancelled: ${summary.cancelled}<br/>
      • Failed: ${summary.failed}<br/>
      • Skipped (already cancelled): ${summary.skipped}<br/>
      <br/>
      ${refundResults ? `<strong>Token Refunds:</strong><br/>
      • Refund Enabled: Yes<br/>
      • Successfully Refunded: ${refundResults.successful.length}<br/>
      • Failed Refunds: ${refundResults.failed.length}<br/>
      • Skipped (no token): ${refundResults.skipped.length}<br/>
      <br/>` : ''}
      <strong>Cancelled Bookings:</strong><br/>
      ${bookingsList}<br/>
      <br/>
      <strong>Cancelled By:</strong> ${adminEmail}<br/>
      <strong>Timestamp:</strong> ${new Date().toISOString()}<br/>
    `;

    // Create the note
    const noteResponse = await hubspot.apiCall('POST', `/crm/v3/objects/notes`, {
      properties: {
        hs_note_body: noteContent,
        hs_timestamp: Date.now()
      }
    });

    // Associate the mock exam with the note (reversed direction - Mock Exam → Note)
    if (noteResponse?.id) {
      console.log(`🔗 [AUDIT] Associating mock exam ${mockExamId} with note ${noteResponse.id}`);
      try {
        await hubspot.createAssociation('2-50158913', mockExamId, '0-46', noteResponse.id);
        console.log(`✅ [AUDIT] Note successfully associated with mock exam ${mockExamId}`);
      } catch (assocError) {
        console.error(`❌ [AUDIT] CRITICAL: Failed to associate note with mock exam:`, {
          noteId: noteResponse.id,
          mockExamId,
          error: assocError.message,
          statusCode: assocError.statusCode,
          response: assocError.response?.data
        });
        // Log but continue - note was created even if association failed
      }
    }
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw - this is non-critical
  }
}