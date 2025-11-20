/**
 * GET /api/admin/mock-exams/:id
 * Get single mock exam with details and bookings
 *
 * Implements Redis caching with 3-minute TTL for performance optimization.
 */

const { requirePermission } = require('../middleware/requirePermission');
const { getCache } = require('../../_shared/cache');
const hubspot = require('../../_shared/hubspot');

module.exports = async (req, res) => {
  try {
    // Verify admin authentication and permission
    const user = await requirePermission(req, 'exams.view');

    const mockExamId = req.query.id;

    if (!mockExamId) {
      return res.status(400).json({
        success: false,
        error: 'Mock exam ID is required'
      });
    }

    // Initialize cache
    const cache = getCache();
    const cacheKey = `admin:mock-exam:${mockExamId}`;

    // Check cache first
    const cachedData = await cache.get(cacheKey);
    if (cachedData) {
      console.log(`🎯 [Cache HIT] Mock exam ${mockExamId}`);
      return res.status(200).json(cachedData);
    }

    console.log(`📋 [Cache MISS] Fetching mock exam ${mockExamId} from HubSpot`);

    // Fetch mock exam with bookings
    const result = await hubspot.getMockExamWithBookings(mockExamId);

    // Transform mock exam data
    const properties = result.mockExam.properties;
    const capacity = parseInt(properties.capacity) || 0;
    const totalBookings = parseInt(properties.total_bookings) || 0;

    // Pass start_time and end_time RAW from HubSpot (no conversion)
    // Frontend will handle formatting using formatTime() which accepts:
    // - Unix timestamps (milliseconds)
    // - ISO strings
    // - HH:mm strings (will need special handling)
    const startTime = properties.start_time || '';
    const endTime = properties.end_time || '';

    // Transform bookings data
    const transformedBookings = result.bookings.map(booking => ({
      booking_id: booking.id,
      student_id: booking.properties.student_id || '',
      student_name: booking.properties.student_name || '',
      student_email: booking.properties.student_email || '',
      booking_status: booking.properties.booking_status || 'confirmed',
      booking_date: booking.properties.hs_createdate || '',
      exam_date: booking.properties.exam_date || ''
    }));

    const response = {
      success: true,
      mockExam: {
        id: result.mockExam.id,
        properties: {
          mock_type: properties.mock_type || '',
          exam_date: properties.exam_date || '',
          start_time: startTime,
          end_time: endTime,
          capacity,
          total_bookings: totalBookings,
          location: properties.location || '',
          is_active: properties.is_active === 'true'
        },
        bookings: transformedBookings,
        metadata: {
          created_at: properties.hs_createdate || '',
          updated_at: properties.hs_lastmodifieddate || ''
        }
      }
    };

    // Cache the response (3 minutes TTL)
    await cache.set(cacheKey, response, 180);
    console.log(`💾 [Cached] Mock exam ${mockExamId} for 3 minutes`);

    res.status(200).json(response);

  } catch (error) {
    // Add auth-specific error handling FIRST
    if (error.message.includes('authorization') || error.message.includes('token')) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: error.message }
      });
    }

    console.error('Error fetching mock exam details:', error);

    // Handle 404 for non-existent mock exam
    if (error.message?.includes('not found') || error.status === 404) {
      return res.status(404).json({
        success: false,
        error: 'Mock exam not found'
      });
    }

    res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Failed to fetch mock exam details'
    });
  }
};
