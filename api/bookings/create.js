require('dotenv').config();
const { HubSpotService, HUBSPOT_OBJECTS } = require('../_shared/hubspot');
const { schemas } = require('../_shared/validation');
const { getCache } = require('../_shared/cache');
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
 * Determine which credit to deduct based on mock type
 */
function getCreditFieldToDeduct(mockType, creditBreakdown) {
  if (!creditBreakdown) {
    throw new Error('Credit breakdown not provided');
  }

  // For Mini-mock, only use specific credits
  if (mockType === 'Mini-mock') {
    return 'sjmini_credits';
  }

  // For other types, prefer specific credits, then shared
  if (mockType === 'Situational Judgment') {
    return creditBreakdown.specific_credits > 0 ? 'sj_credits' : 'shared_mock_credits';
  }

  if (mockType === 'Clinical Skills') {
    return creditBreakdown.specific_credits > 0 ? 'cs_credits' : 'shared_mock_credits';
  }

  throw new Error('Invalid mock type for credit deduction');
}

/**
 * Map credit field to token_used property value
 */
function mapCreditFieldToTokenUsed(creditField) {
  const mapping = {
    'sj_credits': 'Situational Judgment Token',
    'cs_credits': 'Clinical Skills Token',
    'sjmini_credits': 'Mini-mock Token',
    'shared_mock_credits': 'Shared Token'
  };
  
  return mapping[creditField] || 'Unknown Token';
}

/**
 * POST /api/bookings/create
 * Create a new booking for a mock exam slot and handle all associations
 */
module.exports = module.exports = async function handler(req, res) {
  let bookingCreated = false;
  let createdBookingId = null;

  setCorsHeaders(res);

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return handleOptionsRequest(req, res);
  }

  try {
    // Security check
    await rateLimitMiddleware(req, res);

    // Environment validation
    verifyEnvironmentVariables();

    // Only allow POST method
    if (req.method !== 'POST') {
      const error = new Error('Method not allowed');
      error.status = 405;
      throw error;
    }

    // Validate input using the bookingCreation schema
    const { error, value: validatedData } = schemas.bookingCreation.validate(req.body);
    if (error) {
      const validationError = new Error(`Invalid input: ${error.details.map(detail => detail.message).join(', ')}`);
      validationError.status = 400;
      validationError.code = 'VALIDATION_ERROR';
      throw validationError;
    }

    const {
      contact_id,
      mock_exam_id,
      student_id,
      name,
      email,
      exam_date,
      mock_type,
      dominant_hand,
      attending_location
    } = validatedData;

    // Logging
    console.log('📝 Processing booking request:', {
      contact_id,
      mock_exam_id,
      name: sanitizeInput(name),
      email: sanitizeInput(email),
      exam_date,
      mock_type,
      dominant_hand: dominant_hand !== undefined ? dominant_hand : null,
      attending_location: attending_location || null
    });

    // Sanitize inputs
    const sanitizedName = sanitizeInput(name);
    const sanitizedEmail = sanitizeInput(email);

    // Initialize HubSpot service
    const hubspot = new HubSpotService();

    // Step 1: Verify mock exam exists and has capacity
    const mockExam = await hubspot.getMockExam(mock_exam_id);

    if (!mockExam) {
      const error = new Error('Mock exam not found');
      error.status = 404;
      error.code = 'EXAM_NOT_FOUND';
      throw error;
    }

    // Check if exam is active
    if (mockExam.properties.is_active !== 'true') {
      const error = new Error('Mock exam is not available for booking');
      error.status = 400;
      error.code = 'EXAM_NOT_ACTIVE';
      throw error;
    }

    // Check capacity
    const capacity = parseInt(mockExam.properties.capacity) || 0;
    const totalBookings = parseInt(mockExam.properties.total_bookings) || 0;

    if (totalBookings >= capacity) {
      const error = new Error('This mock exam session is now full');
      error.status = 400;
      error.code = 'EXAM_FULL';
      throw error;
    }

    // Step 2: Generate booking ID with full mock type name and check for duplicates
    const bookingId = `${mock_type}-${sanitizedName} - ${exam_date}`;

    const isDuplicate = await hubspot.checkExistingBooking(bookingId);
    if (isDuplicate) {
      const error = new Error('Duplicate booking detected: You already have a booking for this exam date');
      error.status = 400;
      error.code = 'DUPLICATE_BOOKING';
      throw error;
    }

    // Step 3: Verify contact and credits (double-check)
    const contact = await hubspot.apiCall('GET',
      `/crm/v3/objects/${HUBSPOT_OBJECTS.contacts}/${contact_id}?properties=student_id,email,sj_credits,cs_credits,sjmini_credits,shared_mock_credits`
    );

    if (!contact) {
      const error = new Error('Contact not found');
      error.status = 404;
      error.code = 'CONTACT_NOT_FOUND';
      throw error;
    }

    // FIX: Log the raw credit values fetched from HubSpot for debugging
    console.log('💳 Raw HubSpot Credit Properties:', {
      contact_id,
      student_id: contact.properties.student_id,
      sj_credits: contact.properties.sj_credits,
      cs_credits: contact.properties.cs_credits,
      sjmini_credits: contact.properties.sjmini_credits,
      shared_mock_credits: contact.properties.shared_mock_credits
    });

    // Calculate available credits
    let specificCredits = 0;
    let sharedCredits = parseInt(contact.properties.shared_mock_credits) || 0;

    switch (mock_type) {
      case 'Situational Judgment':
        specificCredits = parseInt(contact.properties.sj_credits) || 0;
        break;
      case 'Clinical Skills':
        specificCredits = parseInt(contact.properties.cs_credits) || 0;
        break;
      case 'Mini-mock':
        specificCredits = parseInt(contact.properties.sjmini_credits) || 0;
        sharedCredits = 0; // Don't use shared credits for mini-mock
        break;
    }

    // FIX: Log parsed credit values
    console.log('💳 Parsed Credit Values:', {
      mock_type,
      specificCredits,
      sharedCredits,
      totalCredits: specificCredits + sharedCredits
    });

    const totalCredits = specificCredits + sharedCredits;

    if (totalCredits <= 0) {
      const error = new Error('Insufficient credits for booking');
      error.status = 400;
      error.code = 'INSUFFICIENT_CREDITS';
      throw error;
    }

    // Step 4: Determine which credit will be used (before creating booking)
    const creditBreakdown = {
      specific_credits: specificCredits,
      shared_credits: sharedCredits
    };

    const creditField = getCreditFieldToDeduct(mock_type, creditBreakdown);
    const tokenUsed = mapCreditFieldToTokenUsed(creditField);

    console.log('💳 Credit to be deducted:', {
      creditField,
      tokenUsed,
      currentValue: parseInt(contact.properties[creditField]) || 0
    });

    // Step 5: Create booking with token_used property, conditional fields, AND mock exam data
    const bookingData = {
      bookingId,
      name: sanitizedName,
      email: sanitizedEmail,
      tokenUsed: tokenUsed,
      // FIX: Include mock exam data directly on booking for immediate retrieval
      mockType: mock_type,
      examDate: exam_date,
      location: mockExam.properties.location || 'Mississauga',
      startTime: mockExam.properties.start_time,
      endTime: mockExam.properties.end_time
    };

    // Add conditional fields based on exam type
    if (mock_type === 'Clinical Skills') {
      bookingData.dominantHand = dominant_hand;
    } else if (mock_type === 'Situational Judgment' || mock_type === 'Mini-mock') {
      bookingData.attendingLocation = attending_location;
    }

    const createdBooking = await hubspot.createBooking(bookingData);
    bookingCreated = true;
    createdBookingId = createdBooking.id;

    // Step 6: Create associations with detailed logging
    console.log(`Creating associations for booking ${createdBookingId}`);
    console.log(`Contact ID: ${contact_id}, Mock Exam ID: ${mock_exam_id}`);

    const associationResults = [];

    // Associate with Contact
    try {
      console.log(`Attempting to associate booking ${createdBookingId} with contact ${contact_id}`);
      console.log(`📊 Association details: Booking(${createdBookingId}) → Contact(${contact_id})`);

      const contactAssociation = await hubspot.createAssociation(
        HUBSPOT_OBJECTS.bookings,
        createdBookingId,
        HUBSPOT_OBJECTS.contacts,
        contact_id
      );
      console.log('✅ Contact association created successfully:', contactAssociation);
      associationResults.push({ type: 'contact', success: true, result: contactAssociation });
    } catch (err) {
      console.error('❌ Failed to associate with contact:', err.message);
      console.error('🔍 CRITICAL: Contact association error details:', {
        fromObject: HUBSPOT_OBJECTS.bookings,
        fromId: createdBookingId,
        toObject: HUBSPOT_OBJECTS.contacts,
        toId: contact_id,
        error: err.message,
        status: err.response?.status,
        data: err.response?.data,
        context: err.response?.data?.context
      });
      associationResults.push({ type: 'contact', success: false, error: err.message });
    }

    // Associate with Mock Exam
    try {
      console.log(`Attempting to associate booking ${createdBookingId} with mock exam ${mock_exam_id}`);
      const mockExamAssociation = await hubspot.createAssociation(
        HUBSPOT_OBJECTS.bookings,
        createdBookingId,
        HUBSPOT_OBJECTS.mock_exams,
        mock_exam_id
      );
      console.log('✅ Mock exam association created successfully:', mockExamAssociation);
      associationResults.push({ type: 'mock_exam', success: true, result: mockExamAssociation });
    } catch (err) {
      console.error('❌ Failed to associate with mock exam:', err);
      console.error('Mock exam association error details:', {
        fromObject: HUBSPOT_OBJECTS.bookings,
        fromId: createdBookingId,
        toObject: HUBSPOT_OBJECTS.mock_exams,
        toId: mock_exam_id,
        error: err.message,
        status: err.response?.status,
        data: err.response?.data
      });
      associationResults.push({ type: 'mock_exam', success: false, error: err.message });
    }

    console.log('Association results summary:', associationResults);

    // Check critical associations - Contact and Mock Exam are required for booking integrity
    const contactAssocSuccess = associationResults.find(r => r.type === 'contact')?.success || false;
    const mockExamAssocSuccess = associationResults.find(r => r.type === 'mock_exam')?.success || false;

    // Log association status for monitoring
    console.log('Critical associations status:', {
      contact: contactAssocSuccess ? '✅' : '❌',
      mock_exam: mockExamAssocSuccess ? '✅' : '❌'
    });

    // Step 7: Update total bookings counter
    const newTotalBookings = totalBookings + 1;
    await hubspot.updateMockExamBookings(mock_exam_id, newTotalBookings);

    // Step 8: Deduct credits (creditField already calculated in Step 4)
    const currentCreditValue = parseInt(contact.properties[creditField]) || 0;
    const newCreditValue = Math.max(0, currentCreditValue - 1);

    // FIX: Log credit deduction details
    console.log('💳 Credit Deduction:', {
      creditField,
      currentValue: currentCreditValue,
      newValue: newCreditValue,
      deducted: currentCreditValue - newCreditValue
    });

    await hubspot.updateContactCredits(contact_id, creditField, newCreditValue);

    // Step 9: Create Note in Contact timeline (async, non-blocking)
    // This happens after booking is created but doesn't block the response
    const mockExamDataForNote = {
      exam_date,
      mock_type,
      location: mockExam.properties.location || 'Mississauga'
    };

    // Create Note asynchronously - don't wait for it to complete
    hubspot.createBookingNote(bookingData, contact_id, mockExamDataForNote)
      .then(noteResult => {
        if (noteResult) {
          console.log(`✅ Booking note created successfully for booking ${bookingId}`);
        } else {
          console.log(`⚠️ Booking note creation failed for booking ${bookingId}, but booking was successful`);
        }
      })
      .catch(err => {
        console.error(`❌ Error creating booking note for ${bookingId}:`, err.message);
        // Don't throw - booking is already successful
      });

    // Determine overall success - booking succeeds if core operations complete
    const bookingSuccess = true; // Booking was created successfully
    const associationWarnings = [];

    if (!contactAssocSuccess) {
      associationWarnings.push('Contact association failed - booking may not appear in student records');
    }
    if (!mockExamAssocSuccess) {
      associationWarnings.push('Mock exam association failed - exam may not show booking count update');
    }

    // Calculate AFTER deduction credit breakdown for TokenCard display
    let specificCreditsAfter = specificCredits;
    let sharedCreditsAfter = sharedCredits;

    // Determine which credit was deducted and update accordingly
    if (creditField === 'shared_mock_credits') {
      // Shared credit was deducted
      sharedCreditsAfter = newCreditValue;
    } else {
      // Specific credit was deducted (sj_credits, cs_credits, or sjmini_credits)
      specificCreditsAfter = newCreditValue;
    }

    // FIX: Log the AFTER deduction credit breakdown for debugging
    console.log('💳 Credit Breakdown AFTER Deduction:', {
      creditField,
      specificCredits_BEFORE: specificCredits,
      sharedCredits_BEFORE: sharedCredits,
      specificCredits_AFTER: specificCreditsAfter,
      sharedCredits_AFTER: sharedCreditsAfter,
      newCreditValue,
      totalAfter: specificCreditsAfter + sharedCreditsAfter
    });

    // Prepare response - booking is successful regardless of association issues
    const responseData = {
      booking_id: bookingId,
      booking_record_id: createdBookingId,
      confirmation_message: `Your booking for ${mock_type} on ${exam_date} has been confirmed`,
      exam_details: {
        mock_exam_id,
        exam_date,
        mock_type,
        location: mockExam.properties.location || 'Mississauga'
      },
      credit_details: {
        credit_field_deducted: creditField,
        remaining_credits: newCreditValue,
        credit_breakdown: {
          // Use correct property names for TokenCard component
          specific_credits: specificCreditsAfter,  // AFTER deduction
          shared_credits: sharedCreditsAfter       // AFTER deduction
        },
        // Keep detailed info for logging/debugging
        deduction_details: {
          specific_credits_before: specificCredits,
          shared_credits_before: sharedCredits,
          field_used: creditField,
          amount_deducted: 1
        }
      },
      associations: {
        results: associationResults,
        warnings: associationWarnings,
        critical_success: contactAssocSuccess && mockExamAssocSuccess
      }
    };

    // FIX: Validate that credit_details is properly structured before sending response
    if (!responseData.credit_details || !responseData.credit_details.credit_breakdown) {
      console.error('🚨 CRITICAL: credit_details or credit_breakdown is missing from response!', responseData);
      throw new Error('Internal error: credit_details not properly generated');
    }

    // FIX: Log the complete credit_details being sent to frontend
    console.log('📤 Sending credit_details to frontend:', {
      remaining_credits: responseData.credit_details.remaining_credits,
      credit_breakdown: responseData.credit_details.credit_breakdown,
      deduction_details: responseData.credit_details.deduction_details
    });

    // Log success with any warnings
    if (associationWarnings.length > 0) {
      console.log('⚠️ Booking successful with association warnings:', associationWarnings);
    } else {
      console.log('✅ Booking and all associations successful');
    }

    // FIX: Invalidate booking cache for this contact to ensure immediate updates
    try {
      const cache = getCache();
      // Invalidate all booking caches for this contact (all filters, pages)
      const cacheKeyPatterns = [
        `bookings:contact:${contact_id}:all:`,
        `bookings:contact:${contact_id}:upcoming:`,
        `bookings:contact:${contact_id}:past:`,
        `bookings:contact:${contact_id}:cancelled:`
      ];

      // Get all cache keys
      const allKeys = cache.keys();
      let invalidatedCount = 0;

      console.log(`🔍 Searching for cache keys matching patterns for contact ${contact_id}:`, cacheKeyPatterns);
      console.log(`📋 Total cache keys to check: ${allKeys.length}`);

      // Delete matching keys
      for (const key of allKeys) {
        for (const pattern of cacheKeyPatterns) {
          if (key.startsWith(pattern)) {
            cache.delete(key);  // FIX: Changed from cache.del() to cache.delete()
            invalidatedCount++;
            console.log(`  🗑️ Deleted cache key: ${key}`);
          }
        }
      }

      console.log(`🗑️ Successfully invalidated ${invalidatedCount} cache entries for contact ${contact_id}`);

      if (invalidatedCount === 0) {
        console.warn(`⚠️ No cache entries found to invalidate. This may indicate a cache key mismatch.`);
      }
    } catch (cacheError) {
      console.error('❌ Cache invalidation failed:', {
        error: cacheError.message,
        stack: cacheError.stack
      });
      // Don't throw - cache invalidation is nice-to-have, not critical
    }

    // FIXED: Correct parameter order - (data, message) not (message, data)
    console.log('📤 API Response Structure:', {
      success: true,
      message: 'Booking created successfully',
      data: {
        booking_id: responseData.booking_id,
        booking_record_id: responseData.booking_record_id,
        // ... other data fields
      }
    });

    return res.status(201).json(createSuccessResponse(responseData, 'Booking created successfully'));

  } catch (error) {
    console.error('❌ Booking creation error:', {
      message: error.message,
      status: error.status || 500,
      code: error.code || 'INTERNAL_ERROR',
      stack: error.stack
    });

    // Cleanup: If booking was created but subsequent steps failed, attempt cleanup
    if (bookingCreated && createdBookingId) {
      console.log(`🧹 Attempting cleanup for booking ${createdBookingId} due to error: ${error.message}`);
      try {
        const hubspot = new HubSpotService();
        await hubspot.deleteBooking(createdBookingId);
        console.log(`✅ Cleanup successful: Booking ${createdBookingId} deleted`);
      } catch (cleanupError) {
        console.error(`❌ Cleanup failed for booking ${createdBookingId}:`, cleanupError.message);
        // Don't throw cleanup error - return original error
      }
    }

    const statusCode = error.status || 500;
    return res.status(statusCode).json(createErrorResponse(
      error.message || 'Internal server error',
      error.code || 'INTERNAL_ERROR'
    ));
  }
};