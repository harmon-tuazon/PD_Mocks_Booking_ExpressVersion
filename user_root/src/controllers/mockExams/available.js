const { HubSpotService } = require('../../services/hubspot');
const { validateInput } = require('../../services/validation');
const { getCache } = require('../../services/cache');
const { getExamsFromSupabase } = require('../../services/supabase-data');
const { createSuccessResponse } = require('../../services/auth');
const RedisLockService = require('../../services/redis');

/**
 * GET /api/mock-exams/available
 * Fetch all active mock exam sessions filtered by type with available capacity
 * PUBLIC route - no authentication required
 */
const available = async (req, res, next) => {
  try {
    // Validate query parameters (kept inline - GET query params not covered by route middleware)
    const validatedData = await validateInput(req.query, 'availableExams');
    const { mock_type, include_capacity, realtime } = validatedData;

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
    let examResults = [];

    try {
      const filters = {
        is_active: 'active',
        startDate: new Date().toISOString().split('T')[0]
      };

      if (mock_type && mock_type !== 'all') {
        filters.mock_type = mock_type;
      }

      const supabaseExams = await getExamsFromSupabase(filters);

      examResults = supabaseExams.map(exam => {
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
            is_active: exam.is_active,
            mock_set: exam.mock_set
          }
        };
      });

      console.log(`✅ Fetched ${examResults.length} active exams from Supabase (no HubSpot API calls)`);

    } catch (supabaseError) {
      console.error(`❌ Supabase fetch failed, falling back to HubSpot:`, supabaseError.message);

      const hubspot = new HubSpotService();
      const searchResult = await hubspot.searchMockExams(mock_type, true);
      examResults = searchResult.results;

      console.log(`⚠️ Fallback: Fetched ${examResults.length} exams from HubSpot`);
    }

    const searchResult = { results: examResults };

    // Process exams - Read from Redis for real-time availability
    const redis = new RedisLockService();

    const processedExams = await Promise.all(searchResult.results.map(async (exam) => {
      const capacity = parseInt(exam.properties.capacity) || 0;

      // TIER 1: Try Redis first
      let totalBookings = await redis.get(`exam:${exam.id}:bookings`);

      // TIER 2: Fallback to Supabase if Redis doesn't have it
      if (totalBookings === null) {
        totalBookings = parseInt(exam.properties.total_bookings) || 0;
        const TTL_1_HOUR = 60 * 60;
        await redis.setex(`exam:${exam.id}:bookings`, TTL_1_HOUR, totalBookings);
      } else {
        totalBookings = parseInt(totalBookings);
      }

      const availableSlots = Math.max(0, capacity - totalBookings);

      // Generate fallback times if missing
      if (!exam.properties.start_time || !exam.properties.end_time) {
        if (exam.properties.exam_date) {
          const examDate = exam.properties.exam_date;
          const isAfternoon = exam.id.endsWith('980');
          const examDateObj = new Date(examDate + 'T00:00:00');

          let localStartHour, localEndHour;
          if (isAfternoon) {
            localStartHour = 12;
            localEndHour = 13;
          } else {
            localStartHour = 8;
            localEndHour = 9;
          }

          const startDate = new Date(examDateObj);
          startDate.setHours(localStartHour, 0, 0, 0);
          const endDate = new Date(examDateObj);
          endDate.setHours(localEndHour, 0, 0, 0);

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
        mock_set: exam.properties?.mock_set || null,
        capacity: capacity,
        total_bookings: totalBookings,
        available_slots: availableSlots,
        location: exam.properties.location || 'TBD',
        is_active: exam.properties.is_active === 'true' || exam.properties.is_active === true,
        status: availableSlots === 0 ? 'full' :
                 availableSlots <= 3 ? 'limited' : 'available'
      };
    }));

    await redis.close();

    const filteredExams = include_capacity
      ? processedExams
      : processedExams.filter(exam => exam.available_slots > 0);

    filteredExams.sort((a, b) => new Date(a.exam_date) - new Date(b.exam_date));

    // Cache the results (5-minute TTL)
    await cache.set(cacheKey, filteredExams, 5 * 60);
    console.log(`💾 Cached ${filteredExams.length} exams with key: ${cacheKey}`);

    res.status(200).json(createSuccessResponse(filteredExams));

  } catch (error) {
    console.error('Error fetching available mock exams:', error);
    next(error);
  }
};

module.exports = { available };
