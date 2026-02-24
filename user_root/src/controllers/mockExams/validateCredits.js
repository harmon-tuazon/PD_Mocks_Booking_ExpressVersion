const { HubSpotService } = require('../../services/hubspot');
const {
  createSuccessResponse,
  sanitizeInput
} = require('../../services/auth');
const {
  getContactCreditsFromSupabase,
  syncContactCreditsToSupabase
} = require('../../services/supabase-data');

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
      specificCredits = parseInt(props.sjmini_credits) || 0;
      sharedCredits = 0;
      break;
    case 'Mock Discussion':
      specificCredits = parseInt(props.mock_discussion_token) || 0;
      sharedCredits = 0;
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
 * Auth: handled by authenticate middleware on route
 * Body validation: handled by validateBody(schemas.creditValidation) on route
 */
const validateCredits = async (req, res, next) => {
  try {
    // Body already validated by route middleware (validateBody)
    const { student_id, email, mock_type } = req.body;

    const sanitizedStudentId = sanitizeInput(student_id);
    const sanitizedEmail = sanitizeInput(email);

    let contact = null;

    // PHASE 1: Try Supabase first (fast path ~50ms)
    try {
      const supabaseContact = await getContactCreditsFromSupabase(sanitizedStudentId, sanitizedEmail);

      if (supabaseContact) {
        console.log(`✅ [SUPABASE] Reading from secondary DB for student ${sanitizedStudentId}`);

        contact = {
          id: supabaseContact.hubspot_id,
          properties: {
            student_id: supabaseContact.student_id,
            email: supabaseContact.email,
            firstname: supabaseContact.firstname,
            lastname: supabaseContact.lastname,
            sj_credits: supabaseContact.sj_credits?.toString() || '0',
            cs_credits: supabaseContact.cs_credits?.toString() || '0',
            sjmini_credits: supabaseContact.sjmini_credits?.toString() || '0',
            mock_discussion_token: supabaseContact.mock_discussion_token?.toString() || '0',
            shared_mock_credits: supabaseContact.shared_mock_credits?.toString() || '0',
            ndecc_exam_date: supabaseContact.ndecc_exam_date
          }
        };
      }
    } catch (supabaseError) {
      console.error('[SUPABASE ERROR] Failed to read from secondary DB:', supabaseError.message);
    }

    // PHASE 2: Fallback to HubSpot
    if (!contact) {
      console.log(`⚠️ [HUBSPOT] Reading from source of truth for student ${sanitizedStudentId}`);

      const hubspot = new HubSpotService();
      contact = await hubspot.searchContacts(sanitizedStudentId, sanitizedEmail, mock_type);

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

      // AUTO-POPULATE: Async sync to Supabase
      syncContactCreditsToSupabase(contact).catch(syncError => {
        console.error('[SYNC ERROR] Failed to cache contact credits:', syncError.message);
      });
    }

    // Calculate available credits
    const creditInfo = calculateCredits(contact, mock_type);

    let enrollmentId = null;

    const responseData = {
      eligible: creditInfo.eligible,
      available_credits: creditInfo.available_credits,
      credit_breakdown: creditInfo.credit_breakdown,
      contact_id: contact.id,
      enrollment_id: enrollmentId,
      student_name: `${contact.properties.firstname || ''} ${contact.properties.lastname || ''}`.trim() || 'Student',
      ndecc_exam_date: contact.properties.ndecc_exam_date || null
    };

    if (!creditInfo.eligible) {
      responseData.error_message = `You have 0 credits available for ${mock_type} exams. At least 1 credit is required to book.`;
    }

    res.status(200).json(createSuccessResponse(
      responseData,
      creditInfo.eligible ? 'Credit validation successful' : 'Insufficient credits'
    ));

  } catch (error) {
    console.error('Error validating credits:', error);
    next(error);
  }
};

module.exports = { validateCredits };
