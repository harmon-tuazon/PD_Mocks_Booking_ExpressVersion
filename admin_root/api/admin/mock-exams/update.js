/**
 * PATCH /api/admin/mock-exams/:id
 * Update a mock exam
 *
 * Invalidates related caches after successful update.
 */

const { requireAdmin } = require('../middleware/requireAdmin');
const { validationMiddleware } = require('../../_shared/validation');
const { getCache } = require('../../_shared/cache');
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

      // Validate update data
      const validator = validationMiddleware('mockExamUpdate');
      await new Promise((resolve, reject) => {
        validator(req, res, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });

      const updateData = req.validatedData;

      // Transform time fields if provided
      const properties = { ...updateData };

      if (updateData.start_time || updateData.end_time) {
        const examDate = new Date(updateData.exam_date || new Date().toISOString().split('T')[0]);

        if (updateData.start_time) {
          const [startHour, startMinute] = updateData.start_time.split(':');
          const startDateTime = new Date(examDate);
          startDateTime.setHours(parseInt(startHour), parseInt(startMinute), 0, 0);
          properties.start_time = startDateTime.getTime().toString();
        }

        if (updateData.end_time) {
          const [endHour, endMinute] = updateData.end_time.split(':');
          const endDateTime = new Date(examDate);
          endDateTime.setHours(parseInt(endHour), parseInt(endMinute), 0, 0);
          properties.end_time = endDateTime.getTime().toString();
        }
      }

      // Convert boolean and number fields to strings for HubSpot
      if (updateData.is_active !== undefined) {
        properties.is_active = updateData.is_active.toString();
      }
      if (updateData.capacity !== undefined) {
        properties.capacity = updateData.capacity.toString();
      }

      // Update mock exam in HubSpot
      const updatedMockExam = await hubspot.updateMockExam(mockExamId, properties);

      // Invalidate caches after successful update
      const cache = getCache();
      await cache.deletePattern('admin:mock-exams:list:*');
      await cache.delete(`admin:mock-exam:${mockExamId}`);
      console.log(`🗑️ Cache invalidated for mock exam ${mockExamId}`);

      res.status(200).json({
        success: true,
        message: 'Mock exam updated successfully',
        mockExam: {
          id: updatedMockExam.id,
          properties: updatedMockExam.properties
        }
      });

    } catch (error) {
      console.error('Error updating mock exam:', error);

      // Handle 404 for non-existent mock exam
      if (error.message?.includes('not found') || error.status === 404) {
        return res.status(404).json({
          success: false,
          error: 'Mock exam not found'
        });
      }

      res.status(error.status || 500).json({
        success: false,
        error: error.message || 'Failed to update mock exam'
      });
    }
  });
};
