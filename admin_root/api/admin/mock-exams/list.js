/**
 * GET /api/admin/mock-exams
 * List mock exams with pagination, filtering, and sorting
 *
 * Implements Redis caching with 2-minute TTL for performance optimization.
 */

const { requireAdmin } = require('../middleware/requireAdmin');
const { validationMiddleware } = require('../../_shared/validation');
const { getCache } = require('../../_shared/cache');
const hubspot = require('../../_shared/hubspot');

module.exports = async (req, res) => {
  try {
    // Verify admin authentication
    const user = await requireAdmin(req);

    // Validate query parameters
    const validator = validationMiddleware('mockExamList');
    await new Promise((resolve, reject) => {
      validator(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    const {
      page,
      limit,
      sort_by,
      sort_order,
      filter_location,
      filter_mock_type,
      filter_status,
      filter_date_from,
      filter_date_to,
      search
    } = req.validatedData;

    // Build filters object
    const filters = {};
    if (filter_location) filters.location = filter_location;
    if (filter_mock_type) filters.mock_type = filter_mock_type;
    if (filter_status && filter_status !== 'all') filters.status = filter_status;
    if (filter_date_from) filters.date_from = filter_date_from;
    if (filter_date_to) filters.date_to = filter_date_to;

    // Initialize cache
    const cache = getCache();

    // Generate cache key from query parameters
    const cacheKey = `admin:mock-exams:list:${JSON.stringify({
      page,
      limit,
      sort_by,
      sort_order,
      ...filters,
      search
    })}`;

    // Check cache first
    const cachedData = await cache.get(cacheKey);
    if (cachedData) {
      console.log(`🎯 [Cache HIT] ${cacheKey.substring(0, 80)}...`);
      return res.status(200).json(cachedData);
    }

    console.log(`📋 [Cache MISS] Fetching from HubSpot: ${cacheKey.substring(0, 80)}...`);

    // Fetch mock exams from HubSpot
    const result = await hubspot.listMockExams({
      page,
      limit,
      sort_by,
      sort_order,
      filters
    });

    // Transform results to include calculated fields
    const transformedResults = result.results.map(exam => {
      const properties = exam.properties;
      const capacity = parseInt(properties.capacity) || 0;
      const totalBookings = parseInt(properties.total_bookings) || 0;
      const examDate = properties.exam_date;
      const isActive = properties.is_active === 'true';
      const today = new Date().toISOString().split('T')[0];

      // Calculate utilization rate
      const utilizationRate = capacity > 0 ? Math.round((totalBookings / capacity) * 100) : 0;

      // Determine status
      let status = 'upcoming';
      if (!isActive) {
        status = 'inactive';
      } else if (totalBookings >= capacity) {
        status = 'full';
      } else if (examDate < today) {
        status = 'past';
      }

      // Extract time strings directly from HubSpot properties
      // Times are stored as strings like "14:30" in HubSpot
      const startTime = properties.start_time || '';
      const endTime = properties.end_time || '';

      return {
        id: exam.id,
        mock_type: properties.mock_type || '',
        exam_date: examDate || '',
        start_time: startTime,
        end_time: endTime,
        capacity,
        total_bookings: totalBookings,
        utilization_rate: utilizationRate,
        location: properties.location || '',
        is_active: isActive,
        status,
        created_at: properties.hs_createdate || '',
        updated_at: properties.hs_lastmodifieddate || ''
      };
    });

    // Apply client-side search filter if provided
    let filteredResults = transformedResults;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredResults = transformedResults.filter(exam => {
        return (
          exam.mock_type.toLowerCase().includes(searchLower) ||
          exam.location.toLowerCase().includes(searchLower) ||
          exam.exam_date.includes(searchLower) ||
          exam.status.toLowerCase().includes(searchLower)
        );
      });
    }

    // Calculate pagination metadata
    const totalRecords = search ? filteredResults.length : result.total;
    const totalPages = Math.ceil(totalRecords / limit);

    const response = {
      success: true,
      pagination: {
        current_page: page,
        total_pages: totalPages,
        total_records: totalRecords,
        records_per_page: limit
      },
      data: filteredResults
    };

    // Cache the response (2 minutes TTL)
    await cache.set(cacheKey, response, 120);
    console.log(`💾 [Cached] ${filteredResults.length} exams for 2 minutes`);

    res.status(200).json(response);

  } catch (error) {
    // Add auth-specific error handling FIRST
    if (error.message.includes('authorization') || error.message.includes('token')) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: error.message }
      });
    }

    console.error('Error fetching mock exams:', error);

    res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Failed to fetch mock exams'
    });
  }
};
