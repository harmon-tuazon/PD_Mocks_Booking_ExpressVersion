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

    console.log(`📋 [Cache MISS] Fetching aggregates...`);

    // Step 1: Try to fetch from Supabase first
    const { getExamsFromSupabase, syncExamsToSupabase } = require('../../_shared/supabase-data');
    let aggregates = [];
    let dataSource = 'unknown';
    let supabaseFound = false;

    try {
      console.log(`🗄️ [SUPABASE] Fetching exams from Supabase`);
      
      // Build Supabase filters
      const supabaseFilters = {};
      if (filter_location) supabaseFilters.location = filter_location;
      if (filter_mock_type) supabaseFilters.mock_type = filter_mock_type;
      if (filter_status) supabaseFilters.is_active = filter_status;
      if (filter_date_from) supabaseFilters.startDate = filter_date_from;
      if (filter_date_to) supabaseFilters.endDate = filter_date_to;

      const supabaseExams = await getExamsFromSupabase(supabaseFilters);

      if (supabaseExams && supabaseExams.length > 0) {
        console.log(`✅ [SUPABASE HIT] Found ${supabaseExams.length} exams in Supabase`);

        // Group exams by type, date, and location for aggregation
        const aggregateMap = new Map();
        
        supabaseExams.forEach(exam => {
          // Ensure exam_date is in YYYY-MM-DD format (strip time if present)
          const dateOnly = exam.exam_date ? exam.exam_date.split(' ')[0].split('T')[0] : null;
          const key = `${exam.mock_type}_${dateOnly}_${exam.location}`;

          if (!aggregateMap.has(key)) {
            aggregateMap.set(key, {
              mock_type: exam.mock_type,
              exam_date: dateOnly, // Store date-only format
              location: exam.location,
              sessions: []
            });
          }

          // Calculate utilization rate for each session
          const capacity = parseInt(exam.capacity) || 0;
          const totalBookings = parseInt(exam.total_bookings) || 0;
          const utilizationRate = capacity > 0
            ? Math.round((totalBookings / capacity) * 100)
            : 0;

          // Add session to aggregate
          // Include parent aggregate properties (mock_type, exam_date, location)
          // so they're available when sessions are selected in bulk operations
          aggregateMap.get(key).sessions.push({
            id: exam.hubspot_id,
            mock_type: exam.mock_type,       // For clone modal preview
            exam_date: dateOnly,              // For clone modal preview
            location: exam.location,          // For clone modal preview
            start_time: exam.start_time,
            end_time: exam.end_time,
            capacity: capacity,
            total_bookings: totalBookings,
            available_slots: Math.max(0, capacity - totalBookings),
            utilization_rate: utilizationRate,
            is_active: exam.is_active
          });
        });

        // Convert map to array
        aggregates = Array.from(aggregateMap.values());
        supabaseFound = true;
        dataSource = 'supabase';
      } else {
        console.log(`📭 [SUPABASE MISS] No exams in Supabase, falling back to HubSpot`);
      }
    } catch (supabaseError) {
      console.error(`⚠️ [SUPABASE ERROR] Failed to query exams (non-blocking):`, supabaseError.message);
    }

    // Step 2: Fallback to HubSpot if not in Supabase
    if (!supabaseFound) {
      console.log(`📧 [HUBSPOT] Fetching exams from HubSpot`);
      aggregates = await hubspot.fetchMockExamsForAggregation(filters);
      dataSource = 'hubspot';

      // Auto-populate Supabase with exams (fire-and-forget)
      if (aggregates.length > 0) {
        // Flatten sessions into individual exam objects for sync
        const allExams = [];
        aggregates.forEach(agg => {
          if (agg.sessions) {
            agg.sessions.forEach(session => {
              allExams.push({
                id: session.id,
                properties: {
                  mock_type: agg.mock_type,
                  exam_date: agg.exam_date,
                  location: agg.location,
                  start_time: session.start_time,
                  end_time: session.end_time,
                  capacity: session.capacity,
                  total_bookings: session.total_bookings,
                  is_active: session.is_active
                }
              });
            });
          }
        });

        if (allExams.length > 0) {
          syncExamsToSupabase(allExams).catch(err => {
            console.error(`⚠️ [SUPABASE SYNC] Failed to auto-populate exams (non-blocking):`, err.message);
          });
          console.log(`✅ [HUBSPOT] Retrieved ${allExams.length} exams, auto-populating Supabase`);
        }
      }
    }

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

    // OPTIMIZED: Sessions are now pre-loaded (either from Supabase or HubSpot aggregation)
    console.log(`📦 Using pre-loaded sessions for ${paginatedAggregates.length} aggregates`);

    // Count total sessions for logging
    const totalSessionCount = paginatedAggregates.reduce((sum, agg) =>
      sum + (agg.sessions?.length || 0), 0);
    console.log(`✅ ${totalSessionCount} sessions already loaded (source: ${dataSource})`);

    // Sort sessions by start_time within each aggregate
    const enrichedAggregates = paginatedAggregates.map(aggregate => {
      const aggregateWithSessions = { ...aggregate };

      // Sessions are already attached from Supabase or HubSpot
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
      data: enrichedAggregates,
      meta: {
        timestamp: new Date().toISOString(),
        data_source: dataSource,
        cached: false
      }
    };

    // Cache for 2 minutes (with preloaded sessions)
    await cacheService.set(cacheKey, response, 120);
    console.log(`💾 [Cached] ${enrichedAggregates.length} aggregates with ${totalSessionCount} preloaded sessions for 2 minutes (source: ${dataSource})`);

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