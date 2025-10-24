/**
 * Admin Mock Exams Aggregate Sessions Endpoint
 *
 * Fetches full session details for a specific aggregate using batch API
 * Used when expanding accordion items in the admin dashboard
 */

const { requireAdmin } = require('../../../middleware/requireAdmin');
const hubspot = require('../../../../_shared/hubspot');
const cache = require('../../../../_shared/cache');

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

    const cacheService = cache;
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
    const keyParts = key.split('_');

    // Find the date pattern (yyyy-mm-dd) in the key
    let dateIndex = -1;
    for (let i = 0; i < keyParts.length; i++) {
      // Check if this part looks like a year (4 digits starting with 20)
      if (keyParts[i].match(/^20\d{2}$/)) {
        // Check if next two parts look like month and day
        if (i + 2 < keyParts.length &&
            keyParts[i + 1].match(/^\d{2}$/) &&
            keyParts[i + 2].match(/^\d{2}$/)) {
          dateIndex = i;
          break;
        }
      }
    }

    if (dateIndex === -1) {
      return res.status(400).json({
        success: false,
        error: 'Invalid aggregate key format - could not parse date'
      });
    }

    const exam_date = `${keyParts[dateIndex]}-${keyParts[dateIndex + 1]}-${keyParts[dateIndex + 2]}`;

    // Extract location (everything between mock type and date)
    // The first parts before location are the mock type
    // Everything after date is ignored
    const locationParts = keyParts.slice(0, dateIndex);

    // Fetch aggregates matching this key to get session IDs
    const filters = {
      filter_date_from: exam_date,
      filter_date_to: exam_date
    };

    const aggregates = await hubspot.fetchMockExamsForAggregation(filters);
    const aggregate = aggregates.find(agg => agg.aggregate_key === key);

    if (!aggregate) {
      return res.status(404).json({
        success: false,
        error: 'Aggregate not found'
      });
    }

    // Use batch API to fetch all sessions efficiently
    const sessions = await hubspot.batchFetchMockExams(aggregate.session_ids);

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