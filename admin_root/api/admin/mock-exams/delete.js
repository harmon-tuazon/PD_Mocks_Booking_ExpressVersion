/**
 * DELETE /api/admin/mock-exams/:id
 * Delete a mock exam
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

      // Check if mock exam has bookings before deleting
      const mockExamDetails = await hubspot.getMockExamWithBookings(mockExamId);

      if (mockExamDetails.bookings && mockExamDetails.bookings.length > 0) {
        return res.status(409).json({
          success: false,
          error: `Cannot delete mock exam with existing bookings. This exam has ${mockExamDetails.bookings.length} booking(s). Please cancel all bookings first.`,
          booking_count: mockExamDetails.bookings.length
        });
      }

      // Delete mock exam from HubSpot
      await hubspot.deleteMockExam(mockExamId);

      res.status(200).json({
        success: true,
        message: 'Mock exam deleted successfully',
        deleted_id: mockExamId
      });

    } catch (error) {
      console.error('Error deleting mock exam:', error);

      // Handle 404 for non-existent mock exam
      if (error.message?.includes('not found') || error.status === 404) {
        return res.status(404).json({
          success: false,
          error: 'Mock exam not found'
        });
      }

      res.status(error.status || 500).json({
        success: false,
        error: error.message || 'Failed to delete mock exam'
      });
    }
  });
};
