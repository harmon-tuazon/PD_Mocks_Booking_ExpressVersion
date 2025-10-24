/**
 * Admin Mock Exams Aggregate Sessions Endpoint
 *
 * Fetches full session details for a specific aggregate using batch API
 * Used when expanding accordion items in the admin dashboard
 */

const { requireAdmin } = require('../../../middleware/requireAdmin');
const hubspot = require('../../../../_shared/hubspot');
const { getCache } = require('../../../../_shared/cache');

module.exports = async (req, res) => {
  try {
    // Verify admin authentication
    const user = await requireAdmin(req);

    const { key } = req.query; // Dynamic route parameter from Vercel

    if (!key) {
      return res.status(400).json({
        success: false,
        error: 'Aggregate key is required'
      });
    }

    const cacheService = getCache();
    const cacheKey = `admin:aggregate:sessions:${key}`;

    // Check cache first
    const cachedSessions = await cacheService.get(cacheKey);
    if (cachedSessions) {
      console.log(`🎯 [Cache HIT] Sessions for aggregate: ${key}`);
      return res.status(200).json(cachedSessions);
    }

    console.log(`📋 [Cache MISS] Fetching sessions for aggregate: ${key}`);

    // Parse the key to reconstruct filters
    // Key format: "mock_type_location_date" (e.g., "usmle_step_1_miami_2025-01-15")
    // Note: The date contains hyphens, not underscores

    console.log(`📊 Parsing aggregate key: ${key}`);

    // Find the date pattern (YYYY-MM-DD) at the end of the key
    const datePattern = /\d{4}-\d{2}-\d{2}$/;
    const dateMatch = key.match(datePattern);

    if (!dateMatch) {
      console.error(`❌ Failed to parse date from key: ${key}`);
      return res.status(400).json({
        success: false,
        error: 'Invalid aggregate key format - could not parse date',
        details: `Expected date pattern (YYYY-MM-DD) at end of key, got: ${key}`
      });
    }

    const exam_date = dateMatch[0];
    console.log(`📅 Parsed exam date: ${exam_date}`);

    // Remove the date and trailing underscore to get the prefix
    const prefixWithoutDate = key.substring(0, key.length - exam_date.length - 1);

    // The prefix contains mock_type and location separated by underscores
    // We'll use this to match against the aggregate
    console.log(`🔍 Key prefix (mock_type_location): ${prefixWithoutDate}`);

    // Fetch aggregates matching this key to get session IDs
    const filters = {
      filter_date_from: exam_date,
      filter_date_to: exam_date
    };

    const aggregates = await hubspot.fetchMockExamsForAggregation(filters);
    const aggregate = aggregates.find(agg => agg.aggregate_key === key);

    if (!aggregate) {
      console.warn(`⚠️ Aggregate not found for key: ${key}`);
      console.log(`   Available aggregates for date ${exam_date}:`,
        aggregates.map(a => a.aggregate_key).join(', ') || 'none');

      return res.status(404).json({
        success: false,
        error: 'Aggregate not found',
        details: {
          requested_key: key,
          parsed_date: exam_date,
          available_keys: aggregates.map(a => a.aggregate_key)
        }
      });
    }

    console.log(`✅ Found aggregate: ${aggregate.mock_type} at ${aggregate.location} on ${aggregate.exam_date}`);
    console.log(`   Session count: ${aggregate.session_count}, IDs: ${aggregate.session_ids.join(', ')}`);

    // Check if there are any sessions to fetch
    if (!aggregate.session_ids || aggregate.session_ids.length === 0) {
      console.log(`ℹ️ No sessions found for aggregate: ${key}`);
      const response = {
        success: true,
        aggregate_key: key,
        aggregate_info: {
          mock_type: aggregate.mock_type,
          exam_date: aggregate.exam_date,
          location: aggregate.location,
          session_count: 0,
          total_capacity: 0,
          total_bookings: 0
        },
        sessions: []
      };

      // Cache empty response for 1 minute
      await cacheService.set(cacheKey, response, 60);
      return res.status(200).json(response);
    }

    // Use batch API to fetch all sessions efficiently
    let sessions;
    try {
      sessions = await hubspot.batchFetchMockExams(aggregate.session_ids);
      console.log(`📦 Fetched ${sessions.length} sessions from HubSpot`);
    } catch (batchError) {
      console.error('Error fetching sessions via batch API:', batchError);
      console.error('Session IDs that failed:', aggregate.session_ids);

      return res.status(500).json({
        success: false,
        error: 'Failed to fetch session details from HubSpot',
        details: {
          aggregate_key: key,
          session_count: aggregate.session_ids.length,
          error_message: batchError.message
        }
      });
    }

    // Transform sessions to include additional calculated fields
    const transformedSessions = sessions.map(session => {
      const capacity = parseInt(session.properties.capacity) || 0;
      const totalBookings = parseInt(session.properties.total_bookings) || 0;

      return {
        id: session.id,
        mock_type: session.properties.mock_type,
        exam_date: session.properties.exam_date,
        start_time: session.properties.start_time,
        end_time: session.properties.end_time,
        capacity: capacity,
        total_bookings: totalBookings,
        location: session.properties.location,
        is_active: session.properties.is_active === 'true',
        utilization_rate: capacity > 0
          ? Math.round((totalBookings / capacity) * 100)
          : 0,
        status: session.properties.is_active === 'true' ? 'active' : 'inactive',
        created_at: session.properties.hs_createdate,
        updated_at: session.properties.hs_lastmodifieddate
      };
    });

    const response = {
      success: true,
      aggregate_key: key,
      aggregate_info: {
        mock_type: aggregate.mock_type,
        exam_date: aggregate.exam_date,
        location: aggregate.location,
        session_count: aggregate.session_count,
        total_capacity: aggregate.total_capacity,
        total_bookings: aggregate.total_bookings
      },
      sessions: transformedSessions
    };

    // Cache for 5 minutes
    await cacheService.set(cacheKey, response, 300);
    console.log(`💾 [Cached] ${transformedSessions.length} sessions for 5 minutes`);

    res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching aggregate sessions:', error);

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
      error: error.message || 'Failed to fetch sessions'
    });
  }
};