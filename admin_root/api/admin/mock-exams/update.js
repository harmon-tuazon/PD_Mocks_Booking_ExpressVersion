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
        console.log('🕐 [UPDATE] Converting timestamps with timezone fix');

        // Initialize HubSpot service to access convertToTimestamp method
        const { HubSpotService } = require('../../_shared/hubspot');
        const hubspotService = new HubSpotService();

        // Use exam_date from update or fall back to existing (we need the date for conversion)
        const examDate = updateData.exam_date;

        if (!examDate) {
          throw new Error('exam_date is required when updating start_time or end_time');
        }

        if (updateData.start_time) {
          console.log('🕐 [UPDATE] Converting start_time:', { examDate, time: updateData.start_time });
          properties.start_time = hubspotService.convertToTimestamp(examDate, updateData.start_time).toString();
          console.log('🕐 [UPDATE] Converted start_time to timestamp:', properties.start_time);
        }

        if (updateData.end_time) {
          console.log('🕐 [UPDATE] Converting end_time:', { examDate, time: updateData.end_time });
          properties.end_time = hubspotService.convertToTimestamp(examDate, updateData.end_time).toString();
          console.log('🕐 [UPDATE] Converted end_time to timestamp:', properties.end_time);
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
      await cache.deletePattern('admin:mock-exams:aggregates:*');
      await cache.deletePattern('admin:aggregate:sessions:*');
      console.log(`🗑️ Cache invalidated for mock exam ${mockExamId}`);
      console.log('🔄 [Cache] Invalidated aggregate caches after mutation');

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
