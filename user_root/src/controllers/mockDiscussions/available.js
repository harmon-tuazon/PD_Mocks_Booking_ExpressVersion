const { HubSpotService } = require('../../services/hubspot');
const { getCache } = require('../../services/cache');
const { createSuccessResponse } = require('../../services/auth');
const RedisLockService = require('../../services/redis');

/**
 * GET /api/mock-discussions/available
 * Fetch all active mock discussion sessions with available capacity
 * PUBLIC route - no auth required
 */
const available = async (req, res, next) => {
  try {
    // Parse query parameters with defaults
    const include_capacity = req.query.include_capacity === 'true';
    const realtime = req.query.realtime === 'true';

    const mock_type = 'Mock Discussion';
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
        const discussionIds = searchResult.results.map(discussion => discussion.id);

        const allAssociations = await hubspot.batch.batchReadAssociations(
          '2-50158913',
          discussionIds,
          '2-50158943'
        );
        console.log(`✅ Retrieved ${allAssociations.length} association records`);

        const bookingIds = [...new Set(
          allAssociations.flatMap(assoc => {
            const bookings = assoc.to || [];
            return bookings.map(t => t.toObjectId);
          }).filter(Boolean)
        )];

        const bookings = bookingIds.length > 0
          ? await hubspot.batch.batchReadObjects('2-50158943', bookingIds, ['is_active'])
          : [];

        const bookingStatusMap = new Map();
        for (const booking of bookings) {
          const isActive = booking.properties.is_active !== 'Cancelled' &&
                          booking.properties.is_active !== 'cancelled' &&
                          booking.properties.is_active !== false;
          bookingStatusMap.set(booking.id, isActive);
        }

        const activeBookingCounts = new Map();
        for (const assoc of allAssociations) {
          const discussionId = assoc.from?.id;
          if (!discussionId) continue;

          const associatedBookings = assoc.to || [];
          const activeCount = associatedBookings.filter(bookingAssoc => {
            const bookingId = String(bookingAssoc.toObjectId);
            return bookingStatusMap.get(bookingId) === true;
          }).length;

          activeBookingCounts.set(discussionId, activeCount);
        }

        const updatesToMake = [];
        for (const discussion of searchResult.results) {
          const currentCount = parseInt(discussion.properties.total_bookings) || 0;
          const actualCount = activeBookingCounts.get(discussion.id) || 0;

          if (actualCount !== currentCount) {
            updatesToMake.push({
              id: discussion.id,
              properties: { total_bookings: actualCount.toString() }
            });
            discussion.properties.total_bookings = actualCount.toString();
          }
        }

        if (updatesToMake.length > 0) {
          await hubspot.batch.batchUpdateObjects('2-50158913', updatesToMake);
        }

      } catch (batchError) {
        console.error(`❌ Batch capacity calculation failed, falling back to cached values:`, batchError);
      }
    }

    // Fetch prerequisite associations (Supabase-first)
    const prerequisiteMap = new Map();
    if (searchResult.results.length > 0) {
      try {
        const discussionIds = searchResult.results.map(discussion => discussion.id);
        console.log(`📋 Fetching prerequisites for ${discussionIds.length} discussions (Supabase-first)...`);

        const { createClient } = require('@supabase/supabase-js');
        const supabaseAdmin = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const { data: supabaseExams, error: supabaseError } = await supabaseAdmin
          .from('hubspot_mock_exams')
          .select('hubspot_id, prerequisite_exam_ids')
          .in('hubspot_id', discussionIds);

        if (!supabaseError && supabaseExams && supabaseExams.length > 0) {
          for (const exam of supabaseExams) {
            if (exam.prerequisite_exam_ids && exam.prerequisite_exam_ids.length > 0) {
              prerequisiteMap.set(exam.hubspot_id, exam.prerequisite_exam_ids);
            }
          }

          const supabaseIds = new Set(supabaseExams.map(e => e.hubspot_id));
          const missingIds = discussionIds.filter(id => !supabaseIds.has(id));

          if (missingIds.length > 0) {
            const hubspotPrereqs = await hubspot.batch.batchReadAssociations(
              '2-50158913',
              missingIds,
              '2-50158913',
              1340
            );
            for (const assoc of hubspotPrereqs) {
              const discussionId = assoc.from?.id;
              if (discussionId) {
                const prereqIds = (assoc.to || []).map(t => String(t.toObjectId));
                if (prereqIds.length > 0) {
                  prerequisiteMap.set(discussionId, prereqIds);
                }
              }
            }
          }
        } else {
          const prerequisiteAssociations = await hubspot.batch.batchReadAssociations(
            '2-50158913',
            discussionIds,
            '2-50158913',
            1340
          );

          for (const assoc of prerequisiteAssociations) {
            const discussionId = assoc.from?.id;
            if (discussionId) {
              const prereqIds = (assoc.to || []).map(t => String(t.toObjectId));
              if (prereqIds.length > 0) {
                prerequisiteMap.set(discussionId, prereqIds);
              }
            }
          }
        }
      } catch (prereqError) {
        console.error('❌ Failed to fetch prerequisite associations:', prereqError);
      }
    }

    // Process discussions - Read from Redis for real-time availability
    const redis = new RedisLockService();

    const processedDiscussions = await Promise.all(searchResult.results.map(async (discussion) => {
      const capacity = parseInt(discussion.properties.capacity) || 0;

      let totalBookings = await redis.get(`exam:${discussion.id}:bookings`);

      if (totalBookings === null) {
        totalBookings = parseInt(discussion.properties.total_bookings) || 0;
        const TTL_1_WEEK = 7 * 24 * 60 * 60;
        await redis.setex(`exam:${discussion.id}:bookings`, TTL_1_WEEK, totalBookings);
      } else {
        totalBookings = parseInt(totalBookings);
      }

      const availableSlots = Math.max(0, capacity - totalBookings);

      // Generate fallback times if missing
      if (!discussion.properties.start_time || !discussion.properties.end_time) {
        if (discussion.properties.exam_date) {
          const examDate = discussion.properties.exam_date;
          const examDateObj = new Date(examDate + 'T00:00:00');

          const localStartHour = 14;
          const localEndHour = 16;

          const startDate = new Date(examDateObj);
          startDate.setHours(localStartHour, 0, 0, 0);
          const endDate = new Date(examDateObj);
          endDate.setHours(localEndHour, 0, 0, 0);

          const timeZoneOffset = 4;
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
        mock_type: 'Mock Discussion',
        mock_set: discussion.properties?.mock_set || null,
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

    await redis.close();

    const filteredDiscussions = include_capacity
      ? processedDiscussions
      : processedDiscussions.filter(discussion => discussion.available_slots > 0);

    filteredDiscussions.sort((a, b) => new Date(a.exam_date) - new Date(b.exam_date));

    await cache.set(cacheKey, filteredDiscussions, 5 * 60);
    console.log(`💾 Cached ${filteredDiscussions.length} discussions with key: ${cacheKey}`);

    res.status(200).json(createSuccessResponse(filteredDiscussions));

  } catch (error) {
    console.error('Error fetching available mock discussions:', error);
    next(error);
  }
};

module.exports = { available };
