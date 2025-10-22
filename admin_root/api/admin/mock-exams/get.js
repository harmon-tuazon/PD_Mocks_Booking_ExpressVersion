/**
 * GET /api/admin/mock-exams/:id
 * Get single mock exam with details and bookings
 */

const { requireAdmin } = require('../middleware/requireAdmin');
const hubspot = require('../../_shared/hubspot');

module.exports = async (req, res) => {
  await requireAdmin(req, res, async () => {
    try {
      const mockExamId = req.query.id;

      if (!mockExamId) {
        return res.status(400).json({
          success: false,
          error: 'Mock exam ID is required'
        });
      }

      // Fetch mock exam with bookings
      const result = await hubspot.getMockExamWithBookings(mockExamId);

      // Transform mock exam data
      const properties = result.mockExam.properties;
      const capacity = parseInt(properties.capacity) || 0;
      const totalBookings = parseInt(properties.total_bookings) || 0;

      // Convert timestamps to readable time format
      const startTime = properties.start_time
        ? new Date(parseInt(properties.start_time)).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          })
        : '';

      const endTime = properties.end_time
        ? new Date(parseInt(properties.end_time)).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          })
        : '';

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

      res.status(200).json({
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
      });

    } catch (error) {
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
  });
};
