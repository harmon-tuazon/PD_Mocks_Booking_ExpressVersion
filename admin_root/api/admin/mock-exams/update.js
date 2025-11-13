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

    // Initialize HubSpot service (used for timestamp conversion)
    const { HubSpotService } = require('../../_shared/hubspot');
    const hubspotService = new HubSpotService();

    // Get current mock exam data BEFORE updating (needed for timestamp recalculation and change tracking)
    console.log('📊 [UPDATE] Fetching current mock exam data');
    const currentMockExam = await hubspot.getMockExam(mockExamId);
    const currentProps = currentMockExam.properties;

    if (updateData.start_time || updateData.end_time) {
      console.log('🕐 [UPDATE] Converting timestamps with timezone fix');

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

    // CRITICAL FIX: If exam_date changed but times weren't provided, recalculate timestamps with new date
    // HubSpot timestamps include both date AND time, so changing the date requires updating the timestamps
    if (updateData.exam_date && !updateData.start_time && !updateData.end_time) {
      console.log('📅 [UPDATE] Exam date changed - need to recalculate start_time and end_time timestamps');

      const currentStartTimestamp = currentProps.start_time;
      const currentEndTimestamp = currentProps.end_time;

      if (currentStartTimestamp && currentEndTimestamp) {
        // Extract time components from current timestamps (in America/Toronto timezone)
        const extractTime = (timestamp) => {
          const date = new Date(parseInt(timestamp));
          return date.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZone: 'America/Toronto'
          });
        };

        const startTime = extractTime(currentStartTimestamp);
        const endTime = extractTime(currentEndTimestamp);

        console.log('🕐 [UPDATE] Extracted times from current timestamps:', { startTime, endTime });

        // Recalculate timestamps with new date and existing times
        properties.start_time = hubspotService.convertToTimestamp(updateData.exam_date, startTime).toString();
        properties.end_time = hubspotService.convertToTimestamp(updateData.exam_date, endTime).toString();

        console.log('✅ [UPDATE] Recalculated timestamps with new date:', {
          start_time: properties.start_time,
          end_time: properties.end_time
        });
      } else {
        console.warn('⚠️ [UPDATE] Current timestamps not found - cannot recalculate');
      }
    }

    // Regenerate mock_exam_name if any of its components changed
    // Format: {mock_type}-{location}-{exam_date}
    if (updateData.mock_type || updateData.location || updateData.exam_date) {
      console.log('📝 [UPDATE] Regenerating mock_exam_name due to change in mock_type, location, or exam_date');

      // Use updated values if provided, otherwise fall back to current values
      const mockType = updateData.mock_type || currentProps.mock_type;
      const location = updateData.location || currentProps.location;
      const examDate = updateData.exam_date || currentProps.exam_date;

      properties.mock_exam_name = `${mockType}-${location}-${examDate}`;
      console.log('✅ [UPDATE] New mock_exam_name:', properties.mock_exam_name);
    }

    // Handle is_active - HubSpot stores ALL values as STRINGS: 'true', 'false', or 'scheduled'
    if (updateData.is_active !== undefined) {
      // Convert frontend values to HubSpot string format
      if (updateData.is_active === 'active' || updateData.is_active === true) {
        properties.is_active = 'true';  // String 'true'
      } else if (updateData.is_active === 'inactive' || updateData.is_active === false) {
        properties.is_active = 'false';  // String 'false'
      } else if (updateData.is_active === 'scheduled') {
        properties.is_active = 'scheduled';  // String 'scheduled'
      } else if (updateData.is_active === 'true' || updateData.is_active === 'false') {
        // Already in correct string format
        properties.is_active = updateData.is_active;
      } else {
        // Default to string 'false' for any unexpected values
        properties.is_active = 'false';
      }

      // If changing from scheduled to something else, clear the scheduled_activation_datetime
      if (properties.is_active !== 'scheduled') {
        properties.scheduled_activation_datetime = '';
      }
    }

    // Handle scheduled_activation_datetime
    if (updateData.scheduled_activation_datetime !== undefined) {
      if (updateData.scheduled_activation_datetime === null || updateData.scheduled_activation_datetime === '') {
        properties.scheduled_activation_datetime = '';
      } else {
        // Convert ISO string to Unix timestamp (milliseconds) for HubSpot
        const dateObj = new Date(updateData.scheduled_activation_datetime);
        properties.scheduled_activation_datetime = dateObj.getTime().toString();
      }
    }

    if (updateData.capacity !== undefined) {
      properties.capacity = updateData.capacity.toString();
    }

    // Track changes between old and new values
    const changes = {};
    const fieldsToTrack = ['mock_type', 'exam_date', 'start_time', 'end_time', 'location', 'capacity', 'is_active', 'scheduled_activation_datetime', 'mock_exam_name'];

    fieldsToTrack.forEach(field => {
      if (properties[field] !== undefined) {
        const oldValue = currentProps[field];
        const newValue = properties[field];

        // Only track if value actually changed
        if (oldValue !== newValue) {
          changes[field] = {
            from: oldValue,
            to: newValue
          };
        }
      }
    });

    console.log('📝 [UPDATE] Changes detected:', Object.keys(changes).length > 0 ? changes : 'No changes');

    // Update mock exam in HubSpot
    const updatedMockExam = await hubspot.updateMockExam(mockExamId, properties);

    // Create audit trail note if there were changes (non-blocking)
    if (Object.keys(changes).length > 0) {
      console.log('📝 [UPDATE] Creating audit trail note for changes');
      hubspot.createMockExamEditNote(mockExamId, changes, user)
        .then(noteResult => {
          if (noteResult) {
            console.log(`✅ Audit trail note created successfully for mock exam ${mockExamId}`);
          } else {
            console.log(`⚠️ Audit trail note creation failed for mock exam ${mockExamId}, but update was successful`);
          }
        })
        .catch(err => {
          console.error(`❌ Error creating audit trail note for ${mockExamId}:`, err.message);
        });
    } else {
      console.log('ℹ️ [UPDATE] No changes detected, skipping audit trail note');
    }

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
