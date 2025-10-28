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
  try {
    // Verify admin authentication
    const user = await requireAdmin(req);

    console.log('🔧 [UPDATE-ENDPOINT] ===== UPDATE REQUEST RECEIVED =====');
    console.log('🔧 [UPDATE-ENDPOINT] Request method:', req.method);
    console.log('🔧 [UPDATE-ENDPOINT] Request query:', req.query);
    console.log('🔧 [UPDATE-ENDPOINT] Request body:', req.body);
    console.log('🔧 [UPDATE-ENDPOINT] Request headers:', {
      'content-type': req.headers['content-type'],
      'content-length': req.headers['content-length']
    });

    const mockExamId = req.query.id;
    console.log('🔧 [UPDATE-ENDPOINT] Mock Exam ID:', mockExamId);

    if (!mockExamId) {
      console.error('❌ [UPDATE-ENDPOINT] Missing mock exam ID');
      return res.status(400).json({
        success: false,
        error: 'Mock exam ID is required'
      });
    }

    console.log('🔧 [UPDATE-ENDPOINT] Starting validation...');
    console.log('🔧 [UPDATE-ENDPOINT] Data being validated:', {
      query: req.query,
      body: req.body,
      combined: { ...req.query, ...req.body }
    });

    // Validate update data
    const validator = validationMiddleware('mockExamUpdate');
    await new Promise((resolve, reject) => {
      validator(req, res, (error) => {
        if (error) {
          console.error('❌ [UPDATE-ENDPOINT] Validation error:', error);
          console.error('❌ [UPDATE-ENDPOINT] Error message:', error.message);
          console.error('❌ [UPDATE-ENDPOINT] Validation details:', error.validationErrors);
          reject(error);
        } else {
          console.log('✅ [UPDATE-ENDPOINT] Validation passed');
          resolve();
        }
      });
    });

    const updateData = req.validatedData;
    console.log('🔧 [UPDATE-ENDPOINT] Validated data:', updateData);
    console.log('🔧 [UPDATE-ENDPOINT] Validated data keys:', Object.keys(updateData || {}));
    console.log('🔧 [UPDATE-ENDPOINT] Validated data types:', Object.keys(updateData || {}).map(k => `${k}: ${typeof updateData[k]}`));

    // Transform time fields if provided
    const properties = { ...updateData };

    if (updateData.start_time || updateData.end_time) {
      console.log('🕐 [UPDATE] Converting timestamps with timezone fix');

      // Initialize HubSpot service to access convertToTimestamp method
      const { HubSpotService } = require('../../_shared/hubspot');
      const hubspotService = new HubSpotService();

      // exam_date should be provided by frontend when updating times
      const examDate = updateData.exam_date;

      if (!examDate) {
        console.error('❌ [UPDATE] exam_date missing for time conversion');
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

    // Handle auth errors first
    if (error.message?.includes('authorization') || error.message?.includes('token')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: error.message
        }
      });
    }

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
};
