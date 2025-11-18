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
 * GET /api/mock-exams/available
 * Fetch all active mock exam sessions filtered by type with available capacity
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

    // Validate query parameters
    const validatedData = await validateInput(req.query, 'availableExams');
    const { mock_type, include_capacity, realtime } = validatedData;

    // Check if real-time capacity calculation is requested
    const useRealTimeCapacity = realtime;

    // Generate cache key
    const cache = getCache();
    const cacheKey = `mock-exams:${mock_type}:capacity${include_capacity}:realtime${useRealTimeCapacity}`;

    // Check cache first (skip cache if real-time is requested)
    if (!useRealTimeCapacity) {
      const cachedData = await cache.get(cacheKey);
      if (cachedData) {
        console.log(`🎯 Cache HIT for ${cacheKey}`);
        return res.status(200).json(createSuccessResponse(cachedData));
      }
    }

    console.log(`📋 Cache MISS - Fetching from HubSpot (key: ${cacheKey})`);

    // Fetch from HubSpot
    const hubspot = new HubSpotService();
    const searchResult = await hubspot.searchMockExams(mock_type, true);

    // OPTIMIZED: Batch process real-time capacity if requested
    if (useRealTimeCapacity && searchResult.results.length > 0) {
      console.log(`🔄 Real-time capacity requested for ${searchResult.results.length} exams - using batch operations`);

      try {
        // Step 1: Collect all exam IDs
        const examIds = searchResult.results.map(exam => exam.id);

        // Step 2: Batch read all booking associations for all exams at once (1-2 API calls)
        console.log(`📊 Batch reading associations for ${examIds.length} exam(s)...`);
        const allAssociations = await hubspot.batch.batchReadAssociations(
          '2-50158913', // mock_exams
          examIds,
          '2-50158943'  // bookings
        );
        console.log(`✅ Retrieved ${allAssociations.length} association records`);

        // Debug: Log first association structure
        if (allAssociations.length > 0) {
          console.log('📋 Sample association structure:', JSON.stringify(allAssociations[0], null, 2));
        }

        // Step 3: Extract unique booking IDs
        const bookingIds = [...new Set(
          allAssociations.flatMap(assoc => {
            const bookings = assoc.to || [];
            if (!assoc.to) {
              console.warn(`⚠️ Association for exam ${assoc.from?.id} has no 'to' property`);
            }
            return bookings.map(t => t.toObjectId);
          }).filter(Boolean)
        )];
        console.log(`📝 Extracted ${bookingIds.length} unique booking IDs from ${allAssociations.length} associations`);

        // Step 4: Batch read all bookings to check is_active status (1-2 API calls)
        const bookings = bookingIds.length > 0
          ? await hubspot.batch.batchReadObjects('2-50158943', bookingIds, ['is_active'])
          : [];

        console.log(`📦 Batch read returned ${bookings.length} booking(s) from ${bookingIds.length} requested IDs`);

        // CRITICAL VALIDATION: Check for silent failure
        if (bookingIds.length > 0 && bookings.length === 0) {
          console.error(`🚨 CRITICAL: Batch read returned 0 bookings despite ${bookingIds.length} valid IDs!`);
          console.error('   Requested IDs:', bookingIds);
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

        // Step 6: Count active bookings per exam
        const activeBookingCounts = new Map();
        for (const assoc of allAssociations) {
          const examId = assoc.from?.id;
          if (!examId) {
            console.error('⚠️ Association missing exam ID:', assoc);
            continue;
          }

          const associatedBookings = assoc.to || [];

          const activeCount = associatedBookings.filter(bookingAssoc => {
            // FIX: Convert toObjectId to string for map lookup (booking.id is a string)
            const bookingId = String(bookingAssoc.toObjectId);
            const isActive = bookingStatusMap.get(bookingId);

            // Debug: Log lookup results
            if (isActive === undefined) {
              console.warn(`⚠️ Booking ${bookingId} not found in status map (toObjectId type: ${typeof bookingAssoc.toObjectId})`);
            }

            return isActive === true;
          }).length;

          console.log(`  Exam ${examId}: ${activeCount} active booking(s) out of ${associatedBookings.length} total`);
          activeBookingCounts.set(examId, activeCount);
        }
        console.log(`🔢 Calculated counts for ${activeBookingCounts.size} exam(s)`);

        // Step 7: Collect exams that need updating
        const updatesToMake = [];
        for (const exam of searchResult.results) {
          const currentCount = parseInt(exam.properties.total_bookings) || 0;
          const actualCount = activeBookingCounts.get(exam.id) || 0;

          if (actualCount !== currentCount) {
            console.log(`📊 Exam ${exam.id}: stored=${currentCount}, actual=${actualCount}`);
            updatesToMake.push({
              id: exam.id,
              properties: { total_bookings: actualCount.toString() }
            });
            // Update the exam object for processing
            exam.properties.total_bookings = actualCount.toString();
          }
        }

        // Step 8: Batch update all changed exams at once (1 API call)
        if (updatesToMake.length > 0) {
          console.log(`✏️ Batch updating ${updatesToMake.length} exams with corrected booking counts`);
          await hubspot.batch.batchUpdateObjects('2-50158913', updatesToMake);
        }

        const apiCallsSaved = (examIds.length * 2) - (2 + (bookingIds.length > 100 ? 2 : 1) + (updatesToMake.length > 0 ? 1 : 0));
        console.log(`✅ Real-time capacity completed (saved ~${apiCallsSaved} API calls)`);
      } catch (batchError) {
        console.error(`❌ Batch capacity calculation failed, falling back to cached values:`, batchError);
        // Continue with cached values on error
      }
    }

    // Process exams for response - Read from Redis for real-time availability
    const RedisLockService = require('../_shared/redis');
    const redis = new RedisLockService();

    const processedExams = await Promise.all(searchResult.results.map(async (exam) => {
      const capacity = parseInt(exam.properties.capacity) || 0;

      // TIER 1: Try Redis first (real-time count - authoritative source)
      let totalBookings = await redis.get(`exam:${exam.id}:bookings`);

      // TIER 2: Fallback to HubSpot if Redis doesn't have it
      if (totalBookings === null) {
        totalBookings = parseInt(exam.properties.total_bookings) || 0;
        // Seed Redis with HubSpot value (no TTL - persist forever)
        await redis.set(`exam:${exam.id}:bookings`, totalBookings);
      } else {
        totalBookings = parseInt(totalBookings);
      }

      const availableSlots = Math.max(0, capacity - totalBookings);

      // Generate fallback times if missing from HubSpot
      if (!exam.properties.start_time || !exam.properties.end_time) {

        if (exam.properties.exam_date) {
          const examDate = exam.properties.exam_date;
          const isAfternoon = exam.id.endsWith('980');
          const examDateObj = new Date(examDate + 'T00:00:00');

          let localStartHour, localEndHour;
          if (isAfternoon) {
            localStartHour = 12; // 12 PM
            localEndHour = 13;   // 1 PM
          } else {
            localStartHour = 8;  // 8 AM
            localEndHour = 9;    // 9 AM
          }

          const startDate = new Date(examDateObj);
          startDate.setHours(localStartHour, 0, 0, 0);
          const endDate = new Date(examDateObj);
          endDate.setHours(localEndHour, 0, 0, 0);

          // Convert to UTC (Toronto is UTC-4 during DST)
          const timeZoneOffset = 4;
          startDate.setHours(startDate.getHours() + timeZoneOffset);
          endDate.setHours(endDate.getHours() + timeZoneOffset);

          exam.properties.start_time = startDate.toISOString();
          exam.properties.end_time = endDate.toISOString();
        }
      }

      return {
        mock_exam_id: exam.id,
        exam_date: exam.properties.exam_date,
        start_time: exam.properties.start_time,
        end_time: exam.properties.end_time,
        mock_type: exam.properties.mock_type,
        capacity: capacity,
        total_bookings: totalBookings,
        available_slots: availableSlots,
        location: exam.properties.location || 'TBD',
        is_active: exam.properties.is_active === 'true' || exam.properties.is_active === true,
        status: availableSlots === 0 ? 'full' :
                 availableSlots <= 3 ? 'limited' : 'available'
      };
    }));

    // Close Redis connection
    await redis.close();

    // Filter out full exams unless specifically requested
    const filteredExams = include_capacity
      ? processedExams
      : processedExams.filter(exam => exam.available_slots > 0);

    // Sort by date (already sorted by HubSpot, but ensure consistency)
    filteredExams.sort((a, b) => new Date(a.exam_date) - new Date(b.exam_date));

    // Cache the results (5-minute TTL)
    await cache.set(cacheKey, filteredExams, 5 * 60);
    console.log(`💾 Cached ${filteredExams.length} exams with key: ${cacheKey}`);

    // Return response
    res.status(200).json(createSuccessResponse(filteredExams));

  } catch (error) {
    console.error('Error fetching available mock exams:', error);

    const statusCode = error.status || 500;
    res.status(statusCode).json(createErrorResponse(error));
  }
};