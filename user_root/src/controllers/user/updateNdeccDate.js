const { HubSpotService, HUBSPOT_OBJECTS } = require('../../services/hubspot');
const {
  createSuccessResponse,
  sanitizeInput
} = require('../../services/auth');
const { syncContactCreditsToSupabase } = require('../../services/supabase-data');

/**
 * PUT /api/user/update-ndecc-date
 * Update a user's NDECC exam date in HubSpot and Supabase
 */
const updateNdeccDate = async (req, res, next) => {
  try {
    // req.body is already validated and sanitized by route-level validateBody middleware
    const { student_id, email, ndecc_exam_date } = req.body;

    const sanitizedStudentId = sanitizeInput(student_id);
    const sanitizedEmail = sanitizeInput(email);

    const hubspot = new HubSpotService();

    // Step 1: Authenticate user
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

    // Step 3: Sync to Supabase (non-blocking)
    const updatedContactForSync = await hubspot.apiCall(
      'GET',
      `/crm/v3/objects/${HUBSPOT_OBJECTS.contacts}/${contact.id}`,
      null,
      {
        properties: [
          'student_id',
          'email',
          'firstname',
          'lastname',
          'sj_credits',
          'cs_credits',
          'sjmini_credits',
          'mock_discussion_token',
          'shared_mock_credits',
          'ndecc_exam_date',
          'hs_lastmodifieddate'
        ]
      }
    );

    syncContactCreditsToSupabase(updatedContactForSync.data)
      .then(() => {
        console.log(`✅ [SUPABASE SYNC] Contact ${contact.id} NDECC date synced to Supabase`);
      })
      .catch(supabaseError => {
        console.error(`⚠️ [SUPABASE SYNC] Failed to sync contact ${contact.id} to Supabase (non-blocking):`, supabaseError.message);
      });

    // Step 4: Prepare success response
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
    next(error);
  }
};

module.exports = { updateNdeccDate };
