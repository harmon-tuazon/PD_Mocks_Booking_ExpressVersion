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
const {
  getContactCreditsFromSupabase,
  syncContactCreditsToSupabase
} = require('../_shared/supabase-data');

/**
 * Calculate available credits based on mock type
 */
function calculateCredits(contact, mockType) {
  if (!contact || !contact.properties) {
    console.error('[CREDITS] Contact or properties missing:', { contact: !!contact, properties: !!contact?.properties });
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

  // Log raw property values for debugging (using console.error so it appears in Vercel logs)
  console.error('[CREDITS] Raw property values:', {
    mockType,
    sj_credits: props.sj_credits,
    cs_credits: props.cs_credits,
    sjmini_credits: props.sjmini_credits,
    mock_discussion_token: props.mock_discussion_token,
    shared_mock_credits: props.shared_mock_credits
  });

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
      specificCredits = parseInt(props.mock_discussion_token) || 0;
      sharedCredits = 0; // Don't use shared credits for mock discussion
      break;
    default:
      throw new Error('Invalid mock type');
  }

  const totalCredits = specificCredits + sharedCredits;

  // Log calculated credits (using console.error so it appears in Vercel logs)
  console.error('[CREDITS] Calculated credits:', {
    mockType,
    specificCredits,
    sharedCredits,
    totalCredits,
    eligible: totalCredits > 0
  });

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

    // PHASE 1: Try to read from Supabase cache (fast, no rate limits)
    let cachedContact = await getContactCreditsFromSupabase(sanitizedStudentId, sanitizedEmail);

    let contact;
    if (cachedContact) {
      // Use cached data - convert to HubSpot format
      console.log(`✅ [CACHE HIT] Using Supabase cache for ${sanitizedStudentId}`);
      contact = {
        id: cachedContact.hubspot_id,
        properties: {
          student_id: cachedContact.student_id,
          email: cachedContact.email,
          firstname: cachedContact.firstname,
          lastname: cachedContact.lastname,
          sj_credits: cachedContact.sj_credits?.toString(),
          cs_credits: cachedContact.cs_credits?.toString(),
          sjmini_credits: cachedContact.sjmini_credits?.toString(),
          mock_discussion_token: cachedContact.mock_discussion_token?.toString(),
          shared_mock_credits: cachedContact.shared_mock_credits?.toString(),
          ndecc_exam_date: cachedContact.ndecc_exam_date
        }
      };
    } else {
      // PHASE 2: Cache miss - read from HubSpot and sync to Supabase
      console.log(`⚠️ [CACHE MISS] Fetching from HubSpot for ${sanitizedStudentId}`);
      const hubspot = new HubSpotService();
      contact = await hubspot.searchContacts(sanitizedStudentId, sanitizedEmail, mock_type);

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

      // Sync to Supabase for future requests (fire-and-forget, don't wait)
      syncContactCreditsToSupabase(contact).catch(err => {
        console.error('[SYNC ERROR] Failed to cache contact credits:', err.message);
      });
    }

    // Calculate available credits
    const creditInfo = calculateCredits(contact, mock_type);

    // Enrollment ID not required for booking (optimized - removed unnecessary API call)
    let enrollmentId = null;

    // Prepare response data
    const responseData = {
      eligible: creditInfo.eligible,
      available_credits: creditInfo.available_credits,
      credit_breakdown: creditInfo.credit_breakdown,
      contact_id: contact.id,
      enrollment_id: enrollmentId,
      student_name: `${contact.properties.firstname || ''} ${contact.properties.lastname || ''}`.trim() || 'Student',
      ndecc_exam_date: contact.properties.ndecc_exam_date || null
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