/**
 * Bulk Create Mock Exams Endpoint
 * POST /api/admin/mock-exams/bulk-create
 *
 * Allows admin users to create multiple mock exam sessions with different time slots
 * Invalidates related caches after successful creation.
 */

const { HubSpotService } = require('../../_shared/hubspot');
const { validateInput } = require('../../_shared/validation');
const { requireAdmin } = require('../middleware/requireAdmin');
const { getCache } = require('../../_shared/cache');

/**
 * Handler for bulk creating mock exams
 */
async function bulkCreateMockExamsHandler(req, res) {
  try {
    // Validate request body
    const validatedData = await validateInput(req.body, 'mockExamBulkCreation');

    const { commonProperties, timeSlots } = validatedData;

    console.log('📝 Bulk creating mock exams:', {
      mock_type: commonProperties.mock_type,
      exam_date: commonProperties.exam_date,
      location: commonProperties.location,
      time_slots_count: timeSlots.length,
      admin_user: req.user?.email
    });

    // Check overlap in time slots
    const hasOverlap = checkTimeSlotOverlaps(timeSlots);
    if (hasOverlap) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Time slots cannot overlap',
          details: ['Please ensure all time slots are non-overlapping']
        }
      });
    }

    // Initialize HubSpot service
    const hubspot = new HubSpotService();

    // Create mock exams in HubSpot using batch API
    const result = await hubspot.batchCreateMockExams(commonProperties, timeSlots);

    // Check result status
    if (!result.success && result.status === 'PARTIAL') {
      console.warn(`⚠️ Partial success: ${result.created_count}/${timeSlots.length} mock exams created`);

      return res.status(207).json({ // 207 Multi-Status
        success: false,
        created_count: result.created_count,
        mockExams: result.mockExams,
        errors: result.errors,
        message: `Partial success: ${result.created_count} out of ${timeSlots.length} mock exams created`
      });
    }

    // Log success
    console.log(`✅ Bulk created ${result.created_count} mock exams successfully`);

    // Invalidate caches after successful bulk creation
    const cache = getCache();
    await cache.deletePattern('admin:mock-exams:list:*');
    console.log('🗑️ Cache invalidated: admin:mock-exams:list:*');

    // Return success response
    return res.status(201).json({
      success: true,
      created_count: result.created_count,
      mockExams: result.mockExams.map(exam => ({
        id: exam.id,
        properties: exam.properties
      })),
      message: `Successfully created ${result.created_count} mock exam${result.created_count > 1 ? 's' : ''}`
    });

  } catch (error) {
    console.error('❌ Error bulk creating mock exams:', {
      error: error.message,
      stack: error.stack,
      validationErrors: error.validationErrors
    });

    // Handle validation errors
    if (error.status === 400 || error.validationErrors) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message,
          details: error.validationErrors || []
        }
      });
    }

    // Handle HubSpot API errors
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        error: {
          code: 'HUBSPOT_ERROR',
          message: error.message
        }
      });
    }

    // Handle unexpected errors
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while bulk creating mock exams'
      }
    });
  }
}

/**
 * Check if any time slots overlap
 * @param {Array} timeSlots - Array of {start_time, end_time} objects
 * @returns {boolean} True if overlaps exist
 */
function checkTimeSlotOverlaps(timeSlots) {
  // Convert time strings to minutes for easy comparison
  const toMinutes = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Sort time slots by start time
  const sorted = timeSlots.map(slot => ({
    start: toMinutes(slot.start_time),
    end: toMinutes(slot.end_time)
  })).sort((a, b) => a.start - b.start);

  // Check for overlaps
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].end > sorted[i + 1].start) {
      return true; // Overlap detected
    }
  }

  return false;
}

/**
 * Export with admin protection middleware
 */
module.exports = async (req, res) => {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only POST method is allowed'
      }
    });
  }

  try {
    // Require admin authentication
    await requireAdmin(req);

    // Call handler
    return await bulkCreateMockExamsHandler(req, res);
  } catch (error) {
    // Handle auth errors
    const statusCode = error.message.includes('access required') ? 403 : 401;
    return res.status(statusCode).json({
      success: false,
      error: {
        code: statusCode === 403 ? 'FORBIDDEN' : 'UNAUTHORIZED',
        message: error.message || 'Access denied'
      }
    });
  }
};