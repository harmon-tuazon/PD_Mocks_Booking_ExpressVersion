require('dotenv').config();
const { HubSpotService } = require('../_shared/hubspot');
const { validateInput } = require('../_shared/validation');
const { getCache } = require('../_shared/cache');
const {
  setCorsHeaders,
  handleOptionsRequest,
  createErrorResponse,
  createSuccessResponse,
  verifyEnvironmentVariables,
  rateLimitMiddleware
} = require('../_shared/auth');

/**
 * GET /api/mock-discussions/available
 * Fetch all active mock discussion sessions with available capacity
 *
 * This endpoint specifically filters for Mock Exam objects where:
 * - mock_type = "Mock Discussion"
 * - is_active = true
 * - Optionally filters by available capacity
 */
module.exports = async (req, res) => {
  // Set CORS headers
  setCorsHeaders(res);

  // Handle OPTIONS request
  if (handleOptionsRequest(req, res)) {
    return;
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json(
      createErrorResponse(new Error('Method not allowed'))
    );
  }

  try {
    // Verify environment variables
    verifyEnvironmentVariables();

    // Apply rate limiting
    const rateLimiter = rateLimitMiddleware({
      maxRequests: 30,
      windowMs: 60000 // 1 minute
    });

    if (await rateLimiter(req, res)) {
      return; // Request was rate limited
    }

    // Parse query parameters with defaults
    const include_capacity = req.query.include_capacity === 'true';
    const realtime = req.query.realtime === 'true';

    // Hard-code mock_type as "Mock Discussion" for this endpoint
    const mock_type = 'Mock Discussion';

    // Check if real-time capacity calculation is requested
    const useRealTimeCapacity = realtime;

    // Generate cache key
    const cache = getCache();
    const cacheKey = `mock-discussions:capacity${include_capacity}:realtime${useRealTimeCapacity}`;

    // Check cache first (skip cache if real-time is requested)
    if (!useRealTimeCapacity) {
      const cachedData = await cache.get(cacheKey);
      if (cachedData) {
        console.log(`🎯 Cache HIT for ${cacheKey}`);
        return res.status(200).json(createSuccessResponse(cachedData));
      }
    }

    console.log(`📋 Cache MISS - Fetching Mock Discussions from HubSpot (key: ${cacheKey})`);

    // Fetch from HubSpot
    const hubspot = new HubSpotService();
    const searchResult = await hubspot.searchMockExams(mock_type, true);

    // OPTIMIZED: Batch process real-time capacity if requested
    if (useRealTimeCapacity && searchResult.results.length > 0) {
      console.log(`🔄 Real-time capacity requested for ${searchResult.results.length} discussions - using batch operations`);

      try {
        // Step 1: Collect all discussion IDs
        const discussionIds = searchResult.results.map(discussion => discussion.id);

        // Step 2: Batch read all booking associations for all discussions at once
        console.log(`📊 Batch reading associations for ${discussionIds.length} discussion(s)...`);
        const allAssociations = await hubspot.batch.batchReadAssociations(
          '2-50158913', // mock_exams (same object type for discussions)
          discussionIds,
          '2-50158943'  // bookings
        );
        console.log(`✅ Retrieved ${allAssociations.length} association records`);

        // Step 3: Extract unique booking IDs
        const bookingIds = [...new Set(
          allAssociations.flatMap(assoc => {
            const bookings = assoc.to || [];
            if (!assoc.to) {
              console.warn(`⚠️ Association for discussion ${assoc.from?.id} has no 'to' property`);
            }
            return bookings.map(t => t.toObjectId);
          }).filter(Boolean)
        )];
        console.log(`📝 Extracted ${bookingIds.length} unique booking IDs from ${allAssociations.length} associations`);

        // Step 4: Batch read all bookings to check is_active status
        const bookings = bookingIds.length > 0
          ? await hubspot.batch.batchReadObjects('2-50158943', bookingIds, ['is_active'])
          : [];

        console.log(`📦 Batch read returned ${bookings.length} booking(s) from ${bookingIds.length} requested IDs`);

        // CRITICAL VALIDATION: Check for silent failure
        if (bookingIds.length > 0 && bookings.length === 0) {
          console.error(`🚨 CRITICAL: Batch read returned 0 bookings despite ${bookingIds.length} valid IDs!`);
          console.error('   This indicates a batch read failure or all bookings are archived/deleted');
        }

        // Step 5: Build booking status map
        const bookingStatusMap = new Map();
        for (const booking of bookings) {
          const isActive = booking.properties.is_active !== 'Cancelled' &&
                          booking.properties.is_active !== 'cancelled' &&
                          booking.properties.is_active !== false;
          bookingStatusMap.set(booking.id, isActive);
          console.log(`  Booking ${booking.id}: is_active="${booking.properties.is_active}" → counted as ${isActive ? 'ACTIVE' : 'INACTIVE'}`);
        }
        console.log(`🗺️ Built status map with ${bookingStatusMap.size} entries`);

        // Step 6: Count active bookings per discussion
        const activeBookingCounts = new Map();
        for (const assoc of allAssociations) {
          const discussionId = assoc.from?.id;
          if (!discussionId) {
            console.error('⚠️ Association missing discussion ID:', assoc);
            continue;
          }

          const associatedBookings = assoc.to || [];

          const activeCount = associatedBookings.filter(bookingAssoc => {
            // Convert toObjectId to string for map lookup
            const bookingId = String(bookingAssoc.toObjectId);
            const isActive = bookingStatusMap.get(bookingId);

            if (isActive === undefined) {
              console.warn(`⚠️ Booking ${bookingId} not found in status map`);
            }

            return isActive === true;
          }).length;

          console.log(`  Discussion ${discussionId}: ${activeCount} active booking(s) out of ${associatedBookings.length} total`);
          activeBookingCounts.set(discussionId, activeCount);
        }
        console.log(`🔢 Calculated counts for ${activeBookingCounts.size} discussion(s)`);

        // Step 7: Collect discussions that need updating
        const updatesToMake = [];
        for (const discussion of searchResult.results) {
          const currentCount = parseInt(discussion.properties.total_bookings) || 0;
          const actualCount = activeBookingCounts.get(discussion.id) || 0;

          if (actualCount !== currentCount) {
            console.log(`📊 Discussion ${discussion.id}: stored=${currentCount}, actual=${actualCount}`);
            updatesToMake.push({
              id: discussion.id,
              properties: { total_bookings: actualCount.toString() }
            });
            // Update the discussion object for processing
            discussion.properties.total_bookings = actualCount.toString();
          }
        }

        // Step 8: Batch update all changed discussions at once
        if (updatesToMake.length > 0) {
          console.log(`✏️ Batch updating ${updatesToMake.length} discussions with corrected booking counts`);
          await hubspot.batch.batchUpdateObjects('2-50158913', updatesToMake);
        }

        const apiCallsSaved = (discussionIds.length * 2) - (2 + (bookingIds.length > 100 ? 2 : 1) + (updatesToMake.length > 0 ? 1 : 0));
        console.log(`✅ Real-time capacity completed (saved ~${apiCallsSaved} API calls)`);
      } catch (batchError) {
        console.error(`❌ Batch capacity calculation failed, falling back to cached values:`, batchError);
        // Continue with cached values on error
      }
    }


    // Fetch prerequisite associations for all discussions (PRD v2.1.0)
    const prerequisiteMap = new Map();
    if (searchResult.results.length > 0) {
      try {
        const discussionIds = searchResult.results.map(discussion => discussion.id);
        console.log('Fetching prerequisite associations for ' + discussionIds.length + ' discussions...');

        // Batch read prerequisite associations using association type ID 1340 ("requires attendance at")
        const prerequisiteAssociations = await hubspot.batch.batchReadAssociations(
          '2-50158913', // mock_exams (discussions)
          discussionIds,
          '2-50158913', // mock_exams (prerequisites - same object type)
          1340          // "requires attendance at" association type
        );

        console.log('Retrieved ' + prerequisiteAssociations.length + ' prerequisite association records');

        // Build prerequisite map: discussion ID -> array of prerequisite exam IDs
        for (const assoc of prerequisiteAssociations) {
          const discussionId = assoc.from?.id;
          if (discussionId) {
            const prereqIds = (assoc.to || []).map(t => String(t.toObjectId));
            if (prereqIds.length > 0) {
              prerequisiteMap.set(discussionId, prereqIds);
              console.log('  Discussion ' + discussionId + ': ' + prereqIds.length + ' prerequisite(s)');
            }
          }
        }

        console.log('Built prerequisite map with ' + prerequisiteMap.size + ' discussions having prerequisites');
      } catch (prereqError) {
        console.error('Failed to fetch prerequisite associations:', prereqError);
        // Continue without prerequisites on error (fail-safe behavior)
      }
    }

    // Process discussions for response - Read from Redis for real-time availability
    const RedisLockService = require('../_shared/redis');
    const redis = new RedisLockService();

    const processedDiscussions = await Promise.all(searchResult.results.map(async (discussion) => {
      const capacity = parseInt(discussion.properties.capacity) || 0;

      // TIER 1: Try Redis first (real-time count - authoritative source)
      let totalBookings = await redis.get(`exam:${discussion.id}:bookings`);

      // TIER 2: Fallback to HubSpot if Redis doesn't have it
      if (totalBookings === null) {
        totalBookings = parseInt(discussion.properties.total_bookings) || 0;
        // Seed Redis with HubSpot value (TTL: 1 week for self-healing)
        const TTL_1_WEEK = 7 * 24 * 60 * 60; // 604,800 seconds
        await redis.setex(`exam:${discussion.id}:bookings`, TTL_1_WEEK, totalBookings);
      } else {
        totalBookings = parseInt(totalBookings);
      }

      const availableSlots = Math.max(0, capacity - totalBookings);

      // Generate fallback times if missing from HubSpot
      if (!discussion.properties.start_time || !discussion.properties.end_time) {
        if (discussion.properties.exam_date) {
          const examDate = discussion.properties.exam_date;
          const examDateObj = new Date(examDate + 'T00:00:00');

          // Default time for Mock Discussions (e.g., 2 PM - 4 PM)
          const localStartHour = 14; // 2 PM
          const localEndHour = 16;   // 4 PM

          const startDate = new Date(examDateObj);
          startDate.setHours(localStartHour, 0, 0, 0);
          const endDate = new Date(examDateObj);
          endDate.setHours(localEndHour, 0, 0, 0);

          // Convert to UTC (Toronto is UTC-4 during DST, UTC-5 during standard time)
          const timeZoneOffset = 4; // Adjust based on current DST status
          startDate.setHours(startDate.getHours() + timeZoneOffset);
          endDate.setHours(endDate.getHours() + timeZoneOffset);

          discussion.properties.start_time = startDate.toISOString();
          discussion.properties.end_time = endDate.toISOString();
        }
      }

      return {
        mock_exam_id: discussion.id,
        exam_date: discussion.properties.exam_date,
        start_time: discussion.properties.start_time,
        end_time: discussion.properties.end_time,
        mock_type: 'Mock Discussion', // Always "Mock Discussion" for this endpoint
        capacity: capacity,
        total_bookings: totalBookings,
        available_slots: availableSlots,
        location: discussion.properties.location || 'Virtual/TBD',
        is_active: true,
        status: availableSlots === 0 ? 'full' :
                 availableSlots <= 3 ? 'limited' : 'available',
        prerequisite_exam_ids: prerequisiteMap.get(discussion.id) || []
      };
    }));

    // Close Redis connection
    await redis.close();

    // Filter out full discussions unless specifically requested
    const filteredDiscussions = include_capacity
      ? processedDiscussions
      : processedDiscussions.filter(discussion => discussion.available_slots > 0);

    // Sort by date (already sorted by HubSpot, but ensure consistency)
    filteredDiscussions.sort((a, b) => new Date(a.exam_date) - new Date(b.exam_date));

    // Cache the results (5-minute TTL)
    await cache.set(cacheKey, filteredDiscussions, 5 * 60);
    console.log(`💾 Cached ${filteredDiscussions.length} discussions with key: ${cacheKey}`);

    // Return response
    res.status(200).json(createSuccessResponse(filteredDiscussions));

  } catch (error) {
    console.error('Error fetching available mock discussions:', error);

    const statusCode = error.status || 500;
    res.status(statusCode).json(createErrorResponse(error));
  }
};