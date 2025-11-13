/**
 * Admin Mock Exams Aggregates Endpoint
 *
 * Fetches and returns aggregated mock exams grouped by type, date, and location
 * for the accordion view in the admin dashboard
 */

const { requireAdmin } = require('../middleware/requireAdmin');
const hubspot = require('../../_shared/hubspot');
const { getCache } = require('../../_shared/cache');

module.exports = async (req, res) => {
  try {
    // Verify admin authentication
    const user = await requireAdmin(req);

    const {
      page = 1,
      limit = 20,
      filter_location,
      filter_mock_type,
      filter_status,
      filter_date_from,
      filter_date_to,
      sort_by = 'date',
      sort_order = 'asc',
      debug
    } = req.query;

    // Check for debug mode to bypass cache
    const debugMode = debug === 'true';

    const cacheService = getCache();
    const filters = {
      filter_location,
      filter_mock_type,
      filter_status,
      filter_date_from,
      filter_date_to
    };

    // Create deterministic cache key
    const cacheKey = `admin:mock-exams:aggregates:${JSON.stringify({
      page, limit, sort_by, sort_order, ...filters
    })}`;

    // Check cache first (unless debug mode)
    if (!debugMode) {
      const cachedAggregates = await cacheService.get(cacheKey);
      if (cachedAggregates) {
        console.log(`🎯 [Cache HIT] Aggregates: ${cacheKey.substring(0, 80)}...`);
        return res.status(200).json(cachedAggregates);
      }
    } else {
      console.log(`🔍 [DEBUG MODE] Cache bypassed for mock exam aggregates`);
    }

    console.log(`📋 [Cache MISS] Fetching aggregates from HubSpot...`);

    // Fetch and aggregate from HubSpot
    const aggregates = await hubspot.fetchMockExamsForAggregation(filters);

    // Sort aggregates
    const sortedAggregates = aggregates.sort((a, b) => {
      let comparison = 0;
      switch (sort_by) {
        case 'date':
          comparison = new Date(a.exam_date) - new Date(b.exam_date);
          break;
        case 'location':
          comparison = a.location.localeCompare(b.location);
          break;
        case 'type':
          comparison = a.mock_type.localeCompare(b.mock_type);
          break;
        default:
          comparison = new Date(a.exam_date) - new Date(b.exam_date);
      }
      return sort_order === 'desc' ? -comparison : comparison;
    });

    // Paginate
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedAggregates = sortedAggregates.slice(startIndex, endIndex);

    // Preload session details for all aggregates on the current page
    console.log(`📦 Preloading sessions for ${paginatedAggregates.length} aggregates...`);

    // Collect all unique session IDs from paginated aggregates
    const allSessionIds = [];
    paginatedAggregates.forEach(aggregate => {
      if (aggregate.session_ids && aggregate.session_ids.length > 0) {
        allSessionIds.push(...aggregate.session_ids);
      }
    });

    console.log(`🔢 Total session IDs to fetch: ${allSessionIds.length}`);

    // Fetch all sessions using batch API if there are any
    let sessionDetailsMap = {};
    if (allSessionIds.length > 0) {
      try {
        const sessions = await hubspot.batchFetchMockExams(allSessionIds);
        console.log(`✅ Successfully fetched ${sessions.length} sessions`);

        // Create a map of session ID to transformed session details
        sessions.forEach(session => {
          const capacity = parseInt(session.properties.capacity) || 0;
          const totalBookings = parseInt(session.properties.total_bookings) || 0;

          sessionDetailsMap[session.id] = {
            id: session.id,
            mock_type: session.properties.mock_type,
            exam_date: session.properties.exam_date,
            start_time: session.properties.start_time,
            end_time: session.properties.end_time,
            capacity: capacity,
            total_bookings: totalBookings,
            location: session.properties.location,
            is_active: session.properties.is_active,
            scheduled_activation_datetime: session.properties.scheduled_activation_datetime,
            utilization_rate: capacity > 0
              ? Math.round((totalBookings / capacity) * 100)
              : 0,
            status: session.properties.is_active,
            created_at: session.properties.hs_createdate,
            updated_at: session.properties.hs_lastmodifieddate
          };
        });
      } catch (batchError) {
        console.error('Error batch fetching sessions:', batchError);
        // Continue without session details rather than failing the entire request
        console.warn('⚠️ Continuing without preloaded session details');
      }
    }

    // Attach session details to each aggregate
    const enrichedAggregates = paginatedAggregates.map(aggregate => {
      const aggregateWithSessions = { ...aggregate };

      // Add sessions array with full details if available
      if (aggregate.session_ids && aggregate.session_ids.length > 0) {
        aggregateWithSessions.sessions = aggregate.session_ids
          .map(id => sessionDetailsMap[id])
          .filter(Boolean); // Remove any undefined sessions

        // Sort sessions by start_time
        aggregateWithSessions.sessions.sort((a, b) => {
          const timeA = a.start_time || '';
          const timeB = b.start_time || '';
          return timeA.localeCompare(timeB);
        });
      } else {
        aggregateWithSessions.sessions = [];
      }

      return aggregateWithSessions;
    });

    const response = {
      success: true,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(sortedAggregates.length / limit),
        total_aggregates: sortedAggregates.length,
        per_page: parseInt(limit),
        preloaded_sessions: allSessionIds.length
      },
      data: enrichedAggregates
    };

    // Cache for 2 minutes (with preloaded sessions)
    await cacheService.set(cacheKey, response, 120);
    console.log(`💾 [Cached] ${enrichedAggregates.length} aggregates with ${allSessionIds.length} preloaded sessions for 2 minutes`);

    res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching aggregates:', error);

    // Check if it's an authentication error from requireAdmin
    if (error.message && error.message.includes('Authentication') || error.message.includes('Unauthorized')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: error.message || 'Authentication required'
        }
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch aggregates'
    });
  }
};