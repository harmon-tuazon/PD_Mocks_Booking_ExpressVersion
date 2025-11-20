/**
 * Create Single Mock Exam Endpoint
 * POST /api/admin/mock-exams/create
 *
 * Allows admin users to create a single mock exam session
 * Invalidates related caches after successful creation.
 */

const { HubSpotService } = require('../../_shared/hubspot');
const { validateInput } = require('../../_shared/validation');
const { requirePermission } = require('../middleware/requirePermission');
const { getCache } = require('../../_shared/cache');

/**
 * Handler for creating a single mock exam
 */
async function createMockExamHandler(req, res) {
  try {
    // Validate request body
    const validatedData = await validateInput(req.body, 'mockExamCreation');

    // Handle scheduled activation mode
    if (validatedData.activation_mode === 'scheduled') {
      // Set status to "scheduled" (string) when scheduling activation
      validatedData.is_active = "scheduled";

      console.log('📝 Creating SCHEDULED mock exam:', {
        mock_type: validatedData.mock_type,
        exam_date: validatedData.exam_date,
        location: validatedData.location,
        start_time: validatedData.start_time,
        end_time: validatedData.end_time,
        scheduled_activation: validatedData.scheduled_activation_datetime,
        is_active: validatedData.is_active,
        admin_user: req.user?.email
      });
    } else {
      // For immediate activation, set status to 'true' (string)
      validatedData.is_active = 'true';
      // Clear any scheduled activation datetime
      validatedData.scheduled_activation_datetime = null;

      console.log('📝 Creating IMMEDIATE mock exam:', {
        mock_type: validatedData.mock_type,
        exam_date: validatedData.exam_date,
        location: validatedData.location,
        start_time: validatedData.start_time,
        end_time: validatedData.end_time,
        is_active: validatedData.is_active,
        admin_user: req.user?.email
      });
    }

    // Initialize HubSpot service
    const hubspot = new HubSpotService();

    // Create mock exam in HubSpot
    const result = await hubspot.createMockExam(validatedData);

    // Log success
    console.log(`✅ Mock exam created successfully:`, {
      id: result.id,
      mock_type: validatedData.mock_type,
      exam_date: validatedData.exam_date
    });

    // Invalidate caches after successful creation
    const cache = getCache();
    await cache.deletePattern('admin:mock-exams:list:*');
    await cache.deletePattern('admin:mock-exams:aggregates:*');
    await cache.deletePattern('admin:aggregate:sessions:*');
    console.log('🗑️ Cache invalidated: admin:mock-exams:list:*');
    console.log('🔄 [Cache] Invalidated aggregate caches after mutation');

    // Return success response
    return res.status(201).json({
      success: true,
      mockExam: {
        id: result.id,
        properties: result.properties
      },
      message: 'Mock exam created successfully'
    });

  } catch (error) {
    console.error('❌ Error creating mock exam:', {
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
        message: 'An error occurred while creating the mock exam'
      }
    });
  }
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
    // Require admin authentication and permission
    await requirePermission(req, 'exams.create');

    // Call handler
    return await createMockExamHandler(req, res);
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