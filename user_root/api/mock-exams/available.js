require('dotenv').config();
const { HubSpotService } = require('../_shared/hubspot');
const { validateInput } = require('../_shared/validation');
const { getCache } = require('../_shared/cache');
const { getExamsFromSupabase } = require('../_shared/supabase-data');
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

    console.log(`📋 Cache MISS - Fetching from Supabase (key: ${cacheKey})`);

    // SUPABASE-FIRST: Fetch from Supabase instead of HubSpot
    // This eliminates HubSpot 429 rate limit errors during booking rushes
    let examResults = [];

    try {
      // Build filters for Supabase query
      const filters = {
        is_active: 'active',
        startDate: new Date().toISOString().split('T')[0] // Only future exams
      };

      if (mock_type && mock_type !== 'all') {
        filters.mock_type = mock_type;
      }

      const supabaseExams = await getExamsFromSupabase(filters);

      // Transform Supabase format to match expected HubSpot format
      examResults = supabaseExams.map(exam => {
        // Normalize exam_date to YYYY-MM-DD format (strip time portion if present)
        let normalizedDate = exam.exam_date;
        if (normalizedDate && normalizedDate.includes(' ')) {
          normalizedDate = normalizedDate.split(' ')[0];
        } else if (normalizedDate && normalizedDate.includes('T')) {
          normalizedDate = normalizedDate.split('T')[0];
        }

        return {
          id: exam.hubspot_id,
          properties: {
            exam_date: normalizedDate,
            start_time: exam.start_time,
            end_time: exam.end_time,
            mock_type: exam.mock_type,
            capacity: exam.capacity?.toString() || '0',
            total_bookings: exam.total_bookings?.toString() || '0',
            location: exam.location,
            is_active: exam.is_active
          }
        };
      });

      console.log(`✅ Fetched ${examResults.length} active exams from Supabase (no HubSpot API calls)`);

    } catch (supabaseError) {
      // Fallback to HubSpot if Supabase fails
      console.error(`❌ Supabase fetch failed, falling back to HubSpot:`, supabaseError.message);

      const hubspot = new HubSpotService();
      const searchResult = await hubspot.searchMockExams(mock_type, true);
      examResults = searchResult.results;

      console.log(`⚠️ Fallback: Fetched ${examResults.length} exams from HubSpot`);
    }

    // Store results in format expected by downstream code
    const searchResult = { results: examResults };

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
        // Seed Redis with HubSpot value (TTL: 30 days for self-healing)
        const TTL_30_DAYS = 30 * 24 * 60 * 60; // 2,592,000 seconds
        await redis.setex(`exam:${exam.id}:bookings`, TTL_30_DAYS, totalBookings);
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