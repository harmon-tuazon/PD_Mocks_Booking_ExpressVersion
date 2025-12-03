/**
 * GET /api/admin/mock-exams
 * List mock exams with pagination, filtering, and sorting
 *
 * Data source hierarchy (Supabase-first for performance):
 * 1. Redis cache (2-minute TTL)
 * 2. Supabase (read-optimized secondary database)
 * 3. HubSpot (source of truth - fallback with auto-sync to Supabase)
 */

const { requirePermission } = require('../middleware/requirePermission');
const { validationMiddleware } = require('../../_shared/validation');
const { getCache } = require('../../_shared/cache');
const hubspot = require('../../_shared/hubspot');
const { getExamsFromSupabase, syncExamToSupabase } = require('../../_shared/supabase-data');

module.exports = async (req, res) => {
  try {
    // Verify admin authentication and permission
    const user = await requirePermission(req, 'exams.view');

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

    console.log(`📋 [Cache MISS] Fetching data: ${cacheKey.substring(0, 80)}...`);

    // Map frontend column names to HubSpot property names
    const columnMap = {
      'date': 'exam_date',
      'type': 'mock_type'
    };
    const mappedSortBy = columnMap[sort_by] || sort_by;

    // Try Supabase first (read-optimized secondary database)
    let result;
    let dataSource = 'supabase';

    try {
      // Build Supabase-compatible filters
      const supabaseFilters = {};
      if (filters.status) supabaseFilters.is_active = filters.status;
      if (filters.date_from) supabaseFilters.startDate = filters.date_from;
      if (filters.date_to) supabaseFilters.endDate = filters.date_to;
      if (filters.mock_type) supabaseFilters.mock_type = filters.mock_type;
      if (filters.location) supabaseFilters.location = filters.location;

      console.log(`🔵 [Supabase] Attempting read with filters:`, supabaseFilters);
      const supabaseExams = await getExamsFromSupabase(supabaseFilters);

      if (supabaseExams && supabaseExams.length > 0) {
        console.log(`✅ [Supabase HIT] Found ${supabaseExams.length} exams`);

        // Transform Supabase data to match expected format
        // Apply sorting (Supabase returns ordered by exam_date ascending by default)
        const sortedExams = [...supabaseExams].sort((a, b) => {
          const aVal = a[mappedSortBy] || '';
          const bVal = b[mappedSortBy] || '';
          const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
          return sort_order === 'asc' ? comparison : -comparison;
        });

        // Apply pagination
        const startIndex = (page - 1) * limit;
        const paginatedExams = sortedExams.slice(startIndex, startIndex + limit);

        // Transform to expected format (matching HubSpot response structure)
        result = {
          results: paginatedExams.map(exam => ({
            id: exam.hubspot_id,
            properties: {
              mock_type: exam.mock_type,
              exam_date: exam.exam_date,
              start_time: exam.start_time,
              end_time: exam.end_time,
              capacity: String(exam.capacity || 0),
              total_bookings: String(exam.total_bookings || 0),
              location: exam.location,
              is_active: exam.is_active,
              hs_createdate: exam.created_at,
              hs_lastmodifieddate: exam.updated_at
            }
          })),
          total: sortedExams.length
        };
      } else {
        console.log(`⚠️ [Supabase MISS] No exams found, falling back to HubSpot`);
        dataSource = 'hubspot';
      }
    } catch (supabaseError) {
      console.error(`❌ [Supabase ERROR] ${supabaseError.message}, falling back to HubSpot`);
      dataSource = 'hubspot';
    }

    // Fallback to HubSpot if Supabase didn't return data
    if (dataSource === 'hubspot') {
      console.log(`🟠 [HubSpot] Fetching from source of truth...`);
      result = await hubspot.listMockExams({
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

      // Auto-sync to Supabase for future reads (non-blocking)
      if (result.results && result.results.length > 0) {
        console.log(`🔄 [Sync] Auto-syncing ${result.results.length} exams to Supabase`);
        Promise.all(
          result.results.map(exam => syncExamToSupabase(exam).catch(err => {
            console.error(`⚠️ [Sync] Failed to sync exam ${exam.id}:`, err.message);
          }))
        ).catch(err => console.error(`⚠️ [Sync] Batch sync error:`, err.message));
      }
    }

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

      // Pass raw time values - frontend handles formatting
      // This avoids timezone issues with server-side Date conversion
      return {
        id: exam.id,
        mock_type: properties.mock_type || '',
        exam_date: examDate || '',
        start_time: properties.start_time || '',
        end_time: properties.end_time || '',
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
