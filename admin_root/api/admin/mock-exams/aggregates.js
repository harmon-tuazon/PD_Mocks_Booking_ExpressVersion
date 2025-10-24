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
      sort_order = 'asc'
    } = req.query;

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

    // Check cache first
    const cachedAggregates = await cacheService.get(cacheKey);
    if (cachedAggregates) {
      console.log(`🎯 [Cache HIT] Aggregates: ${cacheKey.substring(0, 80)}...`);
      return res.status(200).json(cachedAggregates);
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

    const response = {
      success: true,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(sortedAggregates.length / limit),
        total_aggregates: sortedAggregates.length,
        per_page: parseInt(limit)
      },
      data: paginatedAggregates
    };

    // Cache for 2 minutes
    await cacheService.set(cacheKey, response, 120);
    console.log(`💾 [Cached] ${paginatedAggregates.length} aggregates for 2 minutes`);

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