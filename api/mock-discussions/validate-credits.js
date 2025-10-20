require('dotenv').config();
const { HubSpotService } = require('../_shared/hubspot');
const { validateInput } = require('../_shared/validation');
const {
  setCorsHeaders,
  handleOptionsRequest,
  createErrorResponse,
  createSuccessResponse,
  verifyEnvironmentVariables,
  rateLimitMiddleware,
  sanitizeInput
} = require('../_shared/auth');

/**
 * Calculate available mock discussion tokens
 * Mock Discussion uses the mock_discussion_token property from Contact
 */
function calculateDiscussionCredits(contact) {
  if (!contact || !contact.properties) {
    return {
      eligible: false,
      available_credits: 0,
      credit_breakdown: {
        discussion_tokens: 0
      }
    };
  }

  const props = contact.properties;
  const discussionTokens = parseInt(props.mock_discussion_token) || 0;

  return {
    eligible: discussionTokens > 0,
    available_credits: discussionTokens,
    credit_breakdown: {
      discussion_tokens: discussionTokens
    }
  };
}

/**
 * POST /api/mock-discussions/validate-credits
 * Check if user has sufficient mock discussion tokens for booking
 *
 * Request body:
 * - student_id: Student ID to validate
 * - email: Email address to validate
 *
 * Response:
 * - eligible: Boolean indicating if user can book
 * - available_credits: Number of discussion tokens available
 * - credit_breakdown: Object with discussion_tokens count
 * - contact_id: HubSpot contact ID
 * - enrollment_id: Active enrollment ID (if exists)
 * - student_name: Full name of student
 */
module.exports = async (req, res) => {
  // Set CORS headers
  setCorsHeaders(res);

  // Handle OPTIONS request
  if (handleOptionsRequest(req, res)) {
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json(
      createErrorResponse(new Error('Method not allowed'))
    );
  }

  try {
    // Verify environment variables
    verifyEnvironmentVariables();

    // Apply rate limiting
    const rateLimiter = rateLimitMiddleware({
      maxRequests: 20,
      windowMs: 60000 // 1 minute
    });

    if (await rateLimiter(req, res)) {
      return; // Request was rate limited
    }

    // Validate input - mock_type not required as it's always "Mock Discussion"
    const validatedData = await validateInput(req.body, 'authCheck');
    const { student_id, email } = validatedData;

    // Sanitize inputs
    const sanitizedStudentId = sanitizeInput(student_id);
    const sanitizedEmail = sanitizeInput(email);

    // Search for contact in HubSpot
    const hubspot = new HubSpotService();

    // Need to fetch contact with mock_discussion_token property
    const searchPayload = {
      filterGroups: [{
        filters: [
          {
            propertyName: 'student_id',
            operator: 'EQ',
            value: sanitizedStudentId
          },
          {
            propertyName: 'email',
            operator: 'EQ',
            value: sanitizedEmail
          }
        ]
      }],
      properties: [
        'student_id',
        'firstname',
        'lastname',
        'email',
        'mock_discussion_token', // Key property for Mock Discussions
        'hs_object_id'
      ],
      limit: 1
    };

    const result = await hubspot.apiCall('POST', `/crm/v3/objects/0-1/search`, searchPayload);
    const contact = result.results?.[0] || null;

    // Check if contact exists
    if (!contact) {
      const error = new Error('Student not found in system');
      error.status = 404;
      error.code = 'STUDENT_NOT_FOUND';
      throw error;
    }

    // Verify email matches (case-insensitive)
    if (contact.properties.email?.toLowerCase() !== sanitizedEmail.toLowerCase()) {
      const error = new Error('Email does not match student record');
      error.status = 400;
      error.code = 'EMAIL_MISMATCH';
      throw error;
    }

    // Calculate available mock discussion tokens
    const creditInfo = calculateDiscussionCredits(contact);

    // Search for active enrollment (optional - discussions may not require enrollment)
    let enrollmentId = null;
    try {
      const enrollment = await hubspot.searchEnrollments(contact.id, 'Registered');
      enrollmentId = enrollment?.id || null;
    } catch (enrollmentError) {
      console.log('No active enrollment found, continuing without it');
      // Mock Discussions might not require active enrollment
    }

    // Prepare response data
    const responseData = {
      eligible: creditInfo.eligible,
      available_credits: creditInfo.available_credits,
      credit_breakdown: creditInfo.credit_breakdown,
      contact_id: contact.id,
      enrollment_id: enrollmentId,
      student_name: `${contact.properties.firstname || ''} ${contact.properties.lastname || ''}`.trim() || 'Student',
      mock_type: 'Mock Discussion' // Always return this type for clarity
    };

    // Add error message if not eligible
    if (!creditInfo.eligible) {
      responseData.error_message = 'You have 0 Mock Discussion tokens available. At least 1 token is required to book a discussion session.';
    }

    // Log validation attempt
    console.log(`📝 Mock Discussion credit validation for ${sanitizedStudentId}:`, {
      eligible: creditInfo.eligible,
      tokens: creditInfo.available_credits,
      contact_id: contact.id
    });

    // Return response
    res.status(200).json(createSuccessResponse(
      responseData,
      creditInfo.eligible ? 'Mock Discussion credit validation successful' : 'Insufficient Mock Discussion tokens'
    ));

  } catch (error) {
    console.error('Error validating Mock Discussion credits:', error);

    // Handle specific HubSpot API errors
    if (error.message?.includes('Property mock_discussion_token does not exist')) {
      console.error('⚠️ CRITICAL: mock_discussion_token property not found in HubSpot Contacts object');
      error.message = 'System configuration error. Please contact support.';
      error.status = 500;
      error.code = 'PROPERTY_NOT_FOUND';
    }

    const statusCode = error.status || 500;
    res.status(statusCode).json(createErrorResponse(error));
  }
};