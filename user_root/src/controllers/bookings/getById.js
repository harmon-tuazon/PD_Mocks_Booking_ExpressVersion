const { HubSpotService, HUBSPOT_OBJECTS } = require('../../services/hubspot');
const { schemas } = require('../../services/validation');
const {
  createSuccessResponse,
  sanitizeInput
} = require('../../services/auth');
const {
  getContactCreditsFromSupabase
} = require('../../services/supabase-data');

/**
 * GET /api/bookings/:id
 * Fetch detailed information about a specific booking
 *
 * Prerequisites (applied by route middleware):
 *   - authenticate: populates req.user
 */
const getById = async (req, res, next) => {
  try {
    // Extract booking ID from route params (was req.query.id in Vercel)
    const bookingId = req.params.id;

    if (!bookingId) {
      const error = new Error('Booking ID is required');
      error.status = 400;
      error.code = 'MISSING_BOOKING_ID';
      return next(error);
    }

    // Validate input from query params (kept inline)
    const inputParams = {
      student_id: req.query.student_id,
      email: req.query.email
    };

    const { error, value: validatedData } = schemas.authCheck.validate(inputParams);
    if (error) {
      const validationError = new Error(`Invalid input: ${error.details.map(detail => detail.message).join(', ')}`);
      validationError.status = 400;
      validationError.code = 'VALIDATION_ERROR';
      return next(validationError);
    }

    const { student_id, email } = validatedData;

    console.log(`📋 Processing booking GET request:`, {
      bookingId: sanitizeInput(bookingId),
      student_id: sanitizeInput(student_id),
      email: sanitizeInput(email)
    });

    const sanitizedStudentId = sanitizeInput(student_id);
    const sanitizedEmail = sanitizeInput(email);
    const sanitizedBookingId = sanitizeInput(bookingId);

    const hubspot = new HubSpotService();

    // Step 1: Authenticate user (Supabase-first)
    const contact = await getContactCreditsFromSupabase(sanitizedStudentId, sanitizedEmail);

    if (!contact) {
      const authError = new Error('Authentication failed. Please check your Student ID and email.');
      authError.status = 401;
      authError.code = 'AUTH_FAILED';
      return next(authError);
    }

    const contactId = contact.hubspot_id;
    console.log(`✅ Contact authenticated (Supabase): ${contactId} - ${contact.firstname} ${contact.lastname}`);

    // Step 2: Fetch the booking with associations
    const bookingResponse = await hubspot.apiCall({
      method: 'GET',
      url: `/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}/${sanitizedBookingId}`,
      params: {
        properties: [
          'booking_id',
          'name',
          'email',
          'dominant_hand',
          'status',
          'createdate',
          'hs_lastmodifieddate'
        ],
        associations: [
          HUBSPOT_OBJECTS.contacts,
          HUBSPOT_OBJECTS.mock_exams
        ]
      }
    });

    if (!bookingResponse || !bookingResponse.data) {
      const notFoundError = new Error('Booking not found');
      notFoundError.status = 404;
      notFoundError.code = 'BOOKING_NOT_FOUND';
      return next(notFoundError);
    }

    const booking = bookingResponse.data;

    // Step 3: Verify booking ownership
    const contactAssociations = booking.associations?.[HUBSPOT_OBJECTS.contacts]?.results || [];

    const belongsToUser = contactAssociations.some(assoc => {
      const contactIdStr = String(contactId);
      const assocIdStr = String(assoc.id);
      const assocToObjectIdStr = String(assoc.toObjectId);

      return assocIdStr === contactIdStr ||
             assocToObjectIdStr === contactIdStr;
    });

    if (!belongsToUser) {
      console.error('❌ [OWNERSHIP DEBUG] Access denied - no matching associations found');
      const accessError = new Error('Access denied. This booking does not belong to you.');
      accessError.status = 403;
      accessError.code = 'ACCESS_DENIED';
      return next(accessError);
    }

    console.log('✅ [OWNERSHIP DEBUG] Booking ownership verified');

    // Step 4: Get associated Mock Exam details
    let mockExamDetails = null;
    const mockExamAssociations = booking.associations?.[HUBSPOT_OBJECTS.mock_exams]?.results || [];

    if (mockExamAssociations.length > 0) {
      const mockExamId = mockExamAssociations[0].id;
      try {
        const mockExamResponse = await hubspot.getMockExam(mockExamId);
        if (mockExamResponse && mockExamResponse.data) {
          const examData = mockExamResponse.data.properties;
          mockExamDetails = {
            id: mockExamResponse.data.id,
            exam_date: examData.exam_date,
            mock_type: examData.mock_type,
            location: examData.location,
            capacity: parseInt(examData.capacity) || 0,
            total_bookings: parseInt(examData.total_bookings) || 0,
            address: examData.address || '',
            start_time: examData.start_time || '',
            end_time: examData.end_time || ''
          };
        }
      } catch (examError) {
        console.warn('⚠️ Failed to fetch mock exam details:', examError.message);
      }
    }

    // Step 6: Prepare response data
    const responseData = {
      booking: {
        id: booking.id,
        booking_id: booking.properties.booking_id || '',
        name: booking.properties.name || '',
        email: booking.properties.email || '',
        dominant_hand: booking.properties.dominant_hand === 'true',
        status: booking.properties.status || 'unknown',
        created_at: booking.properties.createdate || '',
        updated_at: booking.properties.hs_lastmodifieddate || ''
      },
      mock_exam: mockExamDetails,
      contact: {
        id: contactId,
        firstname: contact.firstname || '',
        lastname: contact.lastname || '',
        student_id: contact.student_id || ''
      },
      enrollment: null
    };

    console.log(`✅ Successfully retrieved booking details for ${sanitizedBookingId}`);

    return res.status(200).json(createSuccessResponse(
      responseData,
      'Successfully retrieved booking details'
    ));

  } catch (error) {
    console.error('❌ Booking GET error:', {
      message: error.message,
      status: error.status || 500,
      code: error.code || 'INTERNAL_ERROR',
      stack: error.stack
    });

    next(error);
  }
};

module.exports = { getById };
