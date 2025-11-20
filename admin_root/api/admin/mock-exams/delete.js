/**
 * DELETE /api/admin/mock-exams/:id
 * Delete a mock exam
 *
 * Invalidates related caches after successful deletion.
 */

const { requirePermission } = require('../middleware/requirePermission');
const { getCache } = require('../../_shared/cache');
const hubspot = require('../../_shared/hubspot');

module.exports = async (req, res) => {
  try {
    // Verify admin authentication and permission
    const user = await requirePermission(req, 'exams.delete');

    const mockExamId = req.query.id;

    if (!mockExamId) {
      return res.status(400).json({
        success: false,
        error: 'Mock exam ID is required'
      });
    }

    // Check if mock exam has active or completed bookings before deleting
    const mockExamDetails = await hubspot.getMockExamWithBookings(mockExamId);

    // Filter for only Active or Completed bookings (exclude Cancelled)
    const activeOrCompletedBookings = mockExamDetails.bookings.filter(booking => {
      const status = booking.properties.is_active;
      return status === 'Active' || status === 'Completed';
    });

    if (activeOrCompletedBookings.length > 0) {
      const totalBookings = mockExamDetails.bookings.length;
      const cancelledCount = totalBookings - activeOrCompletedBookings.length;

      return res.status(409).json({
        success: false,
        error: `Cannot delete mock exam with ${activeOrCompletedBookings.length} active or completed booking(s). Please cancel all bookings first.`,
        booking_count: activeOrCompletedBookings.length,
        total_bookings: totalBookings,
        cancelled_bookings: cancelledCount
      });
    }

    // Log deletion details
    const totalBookings = mockExamDetails.bookings.length;
    const cancelledCount = totalBookings - activeOrCompletedBookings.length;

    if (totalBookings > 0) {
      console.log(`🗑️ Deleting mock exam ${mockExamId} with ${totalBookings} total bookings (${cancelledCount} cancelled, ${activeOrCompletedBookings.length} active/completed)`);
    } else {
      console.log(`🗑️ Deleting mock exam ${mockExamId} with no bookings`);
    }

    // Delete mock exam from HubSpot
    await hubspot.deleteMockExam(mockExamId);

    // Invalidate caches after successful deletion
    const cache = getCache();
    await cache.deletePattern('admin:mock-exams:list:*');
    await cache.delete(`admin:mock-exam:${mockExamId}`);
    await cache.deletePattern('admin:mock-exams:aggregates:*');
    await cache.deletePattern('admin:aggregate:sessions:*');
    console.log(`🗑️ Cache invalidated for deleted mock exam ${mockExamId}`);
    console.log('🔄 [Cache] Invalidated aggregate caches after mutation');

    res.status(200).json({
      success: true,
      message: totalBookings > 0 && cancelledCount > 0
        ? `Mock exam deleted successfully (${cancelledCount} cancelled booking(s) removed)`
        : 'Mock exam deleted successfully',
      deleted_id: mockExamId,
      bookings_info: {
        total: totalBookings,
        cancelled: cancelledCount,
        active_or_completed: activeOrCompletedBookings.length
      }
    });

  } catch (error) {
    // Add auth-specific error handling FIRST
    if (error.message.includes('authorization') || error.message.includes('token')) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: error.message }
      });
    }

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
};
