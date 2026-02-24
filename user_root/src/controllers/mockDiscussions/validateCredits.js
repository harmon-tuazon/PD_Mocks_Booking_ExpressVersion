const { HubSpotService } = require('../../services/hubspot');
const {
  createSuccessResponse,
  sanitizeInput
} = require('../../services/auth');

/**
 * Calculate available mock discussion tokens
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
 * Auth + validation handled by route middleware
 */
const validateCredits = async (req, res, next) => {
  try {
    // Validated body from route middleware (validateBody(schemas.creditValidation))
    const { student_id, email } = req.body;

    const sanitizedStudentId = sanitizeInput(student_id);
    const sanitizedEmail = sanitizeInput(email);

    // Search for contact in HubSpot
    const hubspot = new HubSpotService();

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
        'mock_discussion_token',
        'hs_object_id'
      ],
      limit: 1
    };

    const result = await hubspot.apiCall('POST', `/crm/v3/objects/0-1/search`, searchPayload);
    const contact = result.results?.[0] || null;

    if (!contact) {
      const error = new Error('Student not found in system');
      error.status = 404;
      error.code = 'STUDENT_NOT_FOUND';
      throw error;
    }

    if (contact.properties.email?.toLowerCase() !== sanitizedEmail.toLowerCase()) {
      const error = new Error('Email does not match student record');
      error.status = 400;
      error.code = 'EMAIL_MISMATCH';
      throw error;
    }

    const creditInfo = calculateDiscussionCredits(contact);

    let enrollmentId = null;

    const responseData = {
      eligible: creditInfo.eligible,
      available_credits: creditInfo.available_credits,
      credit_breakdown: creditInfo.credit_breakdown,
      contact_id: contact.id,
      enrollment_id: enrollmentId,
      student_name: `${contact.properties.firstname || ''} ${contact.properties.lastname || ''}`.trim() || 'Student',
      mock_type: 'Mock Discussion'
    };

    if (!creditInfo.eligible) {
      responseData.error_message = 'You have 0 Mock Discussion tokens available. At least 1 token is required to book a discussion session.';
    }

    console.log(`📝 Mock Discussion credit validation for ${sanitizedStudentId}:`, {
      eligible: creditInfo.eligible,
      tokens: creditInfo.available_credits,
      contact_id: contact.id
    });

    res.status(200).json(createSuccessResponse(
      responseData,
      creditInfo.eligible ? 'Mock Discussion credit validation successful' : 'Insufficient Mock Discussion tokens'
    ));

  } catch (error) {
    console.error('Error validating Mock Discussion credits:', error);

    if (error.message?.includes('Property mock_discussion_token does not exist')) {
      console.error('⚠️ CRITICAL: mock_discussion_token property not found in HubSpot Contacts object');
      error.message = 'System configuration error. Please contact support.';
      error.status = 500;
      error.code = 'PROPERTY_NOT_FOUND';
    }

    next(error);
  }
};

module.exports = { validateCredits };
