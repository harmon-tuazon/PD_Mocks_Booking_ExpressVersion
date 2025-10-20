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
 * Calculate available credits based on mock type
 */
function calculateCredits(contact, mockType) {
  if (!contact || !contact.properties) {
    return {
      eligible: false,
      available_credits: 0,
      credit_breakdown: {
        specific_credits: 0,
        shared_credits: 0
      }
    };
  }

  const props = contact.properties;
  let specificCredits = 0;
  let sharedCredits = parseInt(props.shared_mock_credits) || 0;

  switch (mockType) {
    case 'Situational Judgment':
      specificCredits = parseInt(props.sj_credits) || 0;
      break;
    case 'Clinical Skills':
      specificCredits = parseInt(props.cs_credits) || 0;
      break;
    case 'Mini-mock':
      // Mini-mock only uses specific credits
      specificCredits = parseInt(props.sjmini_credits) || 0;
      sharedCredits = 0; // Don't use shared credits for mini-mock
      break;
    case 'Mock Discussion':
      // Mock Discussion only uses specific credits
      specificCredits = parseInt(props.md_credits) || 0;
      sharedCredits = 0; // Don't use shared credits for mock discussion
      break;
    default:
      throw new Error('Invalid mock type');
  }

  const totalCredits = specificCredits + sharedCredits;

  return {
    eligible: totalCredits > 0,
    available_credits: totalCredits,
    credit_breakdown: {
      specific_credits: specificCredits,
      shared_credits: sharedCredits
    }
  };
}

/**
 * POST /api/mock-exams/validate-credits
 * Check if user has sufficient credits for the selected mock exam type
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

    // Validate input
    const validatedData = await validateInput(req.body, 'creditValidation');
    const { student_id, email, mock_type } = validatedData;

    // Sanitize inputs
    const sanitizedStudentId = sanitizeInput(student_id);
    const sanitizedEmail = sanitizeInput(email);

    // Search for contact in HubSpot
    const hubspot = new HubSpotService();
    const contact = await hubspot.searchContacts(sanitizedStudentId, sanitizedEmail);

    // Check if contact exists
    if (!contact) {
      const error = new Error('Student not found in system');
      error.status = 404;
      error.code = 'STUDENT_NOT_FOUND';
      throw error;
    }

    // Verify email matches
    if (contact.properties.email?.toLowerCase() !== sanitizedEmail.toLowerCase()) {
      const error = new Error('Email does not match student record');
      error.status = 400;
      error.code = 'EMAIL_MISMATCH';
      throw error;
    }

    // Calculate available credits
    const creditInfo = calculateCredits(contact, mock_type);

    // Search for active enrollment (if needed)
    let enrollmentId = null;
    try {
      const enrollment = await hubspot.searchEnrollments(contact.id, 'Registered');
      enrollmentId = enrollment?.id || null;
    } catch (enrollmentError) {
      console.log('No active enrollment found, continuing without it');
    }

    // Prepare response data
    const responseData = {
      eligible: creditInfo.eligible,
      available_credits: creditInfo.available_credits,
      credit_breakdown: creditInfo.credit_breakdown,
      contact_id: contact.id,
      enrollment_id: enrollmentId,
      student_name: `${contact.properties.firstname || ''} ${contact.properties.lastname || ''}`.trim() || 'Student'
    };

    // Add error message if not eligible
    if (!creditInfo.eligible) {
      responseData.error_message = `You have 0 credits available for ${mock_type} exams. At least 1 credit is required to book.`;
    }

    // Return response
    res.status(200).json(createSuccessResponse(
      responseData,
      creditInfo.eligible ? 'Credit validation successful' : 'Insufficient credits'
    ));

  } catch (error) {
    console.error('Error validating credits:', error);

    const statusCode = error.status || 500;
    res.status(statusCode).json(createErrorResponse(error));
  }
};