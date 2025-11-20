/**
 * Admin Mock Exams Aggregates Endpoint
 *
 * Fetches and returns aggregated mock exams grouped by type, date, and location
 * for the accordion view in the admin dashboard
 */

const { requirePermission } = require('../middleware/requirePermission');
const hubspot = require('../../_shared/hubspot');
const { getCache } = require('../../_shared/cache');

module.exports = async (req, res) => {
  try {
    // Verify admin authentication and permission
    const user = await requirePermission(req, 'exams.view');

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

    // OPTIMIZED: Sessions are now pre-loaded in fetchMockExamsForAggregation
    // No need for additional HubSpot API calls - eliminates 40+ API calls per request
    console.log(`📦 Using pre-loaded sessions for ${paginatedAggregates.length} aggregates`);

    // Count total sessions for logging
    const totalSessionCount = paginatedAggregates.reduce((sum, agg) =>
      sum + (agg.sessions?.length || 0), 0);
    console.log(`✅ ${totalSessionCount} sessions already loaded (no additional API calls)`);

    // Sort sessions by start_time within each aggregate
    const enrichedAggregates = paginatedAggregates.map(aggregate => {
      const aggregateWithSessions = { ...aggregate };

      // Sessions are already attached from fetchMockExamsForAggregation
      if (aggregateWithSessions.sessions && aggregateWithSessions.sessions.length > 0) {
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
        preloaded_sessions: totalSessionCount
      },
      data: enrichedAggregates
    };

    // Cache for 2 minutes (with preloaded sessions)
    await cacheService.set(cacheKey, response, 120);
    console.log(`💾 [Cached] ${enrichedAggregates.length} aggregates with ${totalSessionCount} preloaded sessions for 2 minutes`);

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