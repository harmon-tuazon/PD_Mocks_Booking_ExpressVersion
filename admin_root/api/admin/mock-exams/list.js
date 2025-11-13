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
      filter_date_to
    } = req.validatedData;

    // Check for debug mode to bypass cache
    const debugMode = req.query.debug === 'true';

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
      ...filters
    })}`;

    // Check cache first (unless debug mode)
    if (!debugMode) {
      const cachedData = await cache.get(cacheKey);
      if (cachedData) {
        console.log(`🎯 [Cache HIT] ${cacheKey.substring(0, 80)}...`);
        return res.status(200).json(cachedData);
      }
    } else {
      console.log(`🔍 [DEBUG MODE] Cache bypassed for mock exam list`);
    }

    console.log(`📋 [Cache MISS] Fetching from HubSpot: ${cacheKey.substring(0, 80)}...`);

    // Map frontend column names to HubSpot property names
    const columnMap = {
      'date': 'exam_date',
      'type': 'mock_type'
    };
    const mappedSortBy = columnMap[sort_by] || sort_by;

    // Fetch mock exams from HubSpot
    // Transform parameters to match HubSpot service method expectations
    const result = await hubspot.listMockExams({
      page,
      limit,
      sortBy: mappedSortBy,
      sortOrder: sort_order === 'asc' ? 'ascending' : 'descending',
      location: filters.location,
      mockType: filters.mock_type,
      status: filters.status,
      startDate: filters.date_from,
      endDate: filters.date_to
    });

    // Transform results to include calculated fields
    // Helper function to format time to 12-hour AM/PM format
    const formatTime = (timeValue) => {
      if (!timeValue) return '';
      
      try {
        // Handle Unix timestamp (number in milliseconds)
        if (typeof timeValue === 'number' || !isNaN(Number(timeValue))) {
          const date = new Date(Number(timeValue));
          return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          });
        }
        
        // Handle ISO timestamp format (e.g., "2025-09-26T16:00:00Z")
        if (typeof timeValue === 'string' && (timeValue.includes('T') || timeValue.includes('Z'))) {
          const date = new Date(timeValue);
          return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          });
        }
        
        // Handle HH:MM format (e.g., "14:30")
        if (typeof timeValue === 'string' && timeValue.includes(':')) {
          const [hours, minutes] = timeValue.split(':');
          const hour = parseInt(hours, 10);
          const ampm = hour >= 12 ? 'PM' : 'AM';
          const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
          return `${displayHour}:${minutes} ${ampm}`;
        }
        
        return String(timeValue);
      } catch (error) {
        console.error('Error formatting time:', error);
        return String(timeValue);
      }
    };

    const transformedResults = result.results.map(exam => {
      const properties = exam.properties;
      const capacity = parseInt(properties.capacity) || 0;
      const totalBookings = parseInt(properties.total_bookings) || 0;
      const examDate = properties.exam_date;
      // Handle three-state string values and legacy boolean values
      const isActiveValue = properties.is_active;
      const isActive = isActiveValue === 'active' || isActiveValue === 'true' || isActiveValue === true;
      const isScheduled = isActiveValue === 'scheduled';
      const today = new Date().toISOString().split('T')[0];

      // Calculate utilization rate
      const utilizationRate = capacity > 0 ? Math.round((totalBookings / capacity) * 100) : 0;

      // Determine display status based on the three-state system
      let status = 'upcoming';
      if (isScheduled) {
        status = 'scheduled';
      } else if (!isActive) {
        status = 'inactive';
      } else if (totalBookings >= capacity) {
        status = 'full';
      } else if (examDate < today) {
        status = 'past';
      }

      // Format times to 12-hour AM/PM format
      const startTime = formatTime(properties.start_time);
      const endTime = formatTime(properties.end_time);

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
        is_active: isActiveValue,  // Return the raw string value
        status,
        created_at: properties.hs_createdate || '',
        updated_at: properties.hs_lastmodifieddate || ''
      };
    });

    // Calculate pagination metadata
    const totalRecords = result.total;
    const totalPages = Math.ceil(totalRecords / limit);

    const response = {
      success: true,
      pagination: {
        current_page: page,
        total_pages: totalPages,
        total_records: totalRecords,
        records_per_page: limit
      },
      data: transformedResults
    };

    // Cache the response (2 minutes TTL)
    await cache.set(cacheKey, response, 120);
    console.log(`💾 [Cached] ${transformedResults.length} exams for 2 minutes`);

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
