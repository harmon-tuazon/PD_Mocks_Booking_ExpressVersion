require('dotenv').config();
const { HubSpotService, HUBSPOT_OBJECTS } = require('../_shared/hubspot');
const { schemas } = require('../_shared/validation');
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
 * PUT /api/user/update-ndecc-date
 * Update a user's NDECC exam date in HubSpot
 *
 * Authentication: User must provide student_id and email
 * Input validation: student_id, email, and ndecc_exam_date (YYYY-MM-DD, today or future)
 *
 * @param {Object} req.body - Request body
 * @param {string} req.body.student_id - Student ID for authentication
 * @param {string} req.body.email - Email for authentication
 * @param {string} req.body.ndecc_exam_date - NDECC exam date (YYYY-MM-DD format)
 * @returns {Object} Success response with updated date or error response
 */
module.exports = async function handler(req, res) {
  setCorsHeaders(res);

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return handleOptionsRequest(req, res);
  }

  try {
    // Security check - rate limiting
    await rateLimitMiddleware(req, res);

    // Environment validation
    verifyEnvironmentVariables();

    // Only allow PUT method
    if (req.method !== 'PUT') {
      const error = new Error('Method not allowed');
      error.status = 405;
      error.code = 'METHOD_NOT_ALLOWED';
      throw error;
    }

    // Validate input using the updateNdeccDate schema
    const { error, value: validatedData } = schemas.updateNdeccDate.validate(req.body);
    if (error) {
      const validationError = new Error(`Invalid input: ${error.details.map(detail => detail.message).join(', ')}`);
      validationError.status = 400;
      validationError.code = 'VALIDATION_ERROR';
      throw validationError;
    }

    const { student_id, email, ndecc_exam_date } = validatedData;

    // Sanitize inputs
    const sanitizedStudentId = sanitizeInput(student_id);
    const sanitizedEmail = sanitizeInput(email);

    // Initialize HubSpot service
    const hubspot = new HubSpotService();

    // Step 1: Authenticate user by finding contact in HubSpot
    console.log(`🔍 Authenticating user: ${sanitizedStudentId} / ${sanitizedEmail}`);

    const contact = await hubspot.searchContacts(sanitizedStudentId, sanitizedEmail);

    if (!contact) {
      const error = new Error('Contact not found. Please verify your Student ID and email address.');
      error.status = 404;
      error.code = 'CONTACT_NOT_FOUND';
      throw error;
    }

    console.log(`✅ User authenticated: Contact ID ${contact.id}`);

    // Step 2: Update the contact's ndecc_exam_date property
    const updatePayload = {
      properties: {
        ndecc_exam_date: ndecc_exam_date
      }
    };

    console.log(`📝 Updating NDECC exam date for contact ${contact.id} to ${ndecc_exam_date}`);

    const updatedContact = await hubspot.apiCall(
      'PATCH',
      `/crm/v3/objects/${HUBSPOT_OBJECTS.contacts}/${contact.id}`,
      updatePayload
    );

    console.log(`✅ NDECC exam date updated successfully for contact ${contact.id}`);

    // Step 3: Prepare success response
    const responseData = {
      contact_id: contact.id,
      student_id: sanitizedStudentId,
      email: sanitizedEmail,
      ndecc_exam_date: ndecc_exam_date,
      updated_at: new Date().toISOString()
    };

    return res.status(200).json(
      createSuccessResponse(
        responseData,
        'NDECC exam date updated successfully'
      )
    );

  } catch (error) {
    console.error('❌ NDECC exam date update error:', {
      message: error.message,
      status: error.status || 500,
      code: error.code || 'INTERNAL_ERROR',
      stack: error.stack
    });

    const statusCode = error.status || 500;
    const errorResponse = createErrorResponse(error);

    return res.status(statusCode).json(errorResponse);
  }
};
