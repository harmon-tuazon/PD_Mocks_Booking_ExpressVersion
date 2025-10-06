/**
 * API Endpoint: GET /api/bookings/list
 * Purpose: List all bookings for an authenticated student with pagination and filtering
 */

// Import dependencies
require('dotenv').config();
const { HubSpotService, HUBSPOT_OBJECTS } = require('../_shared/hubspot');
const { getCache } = require('../_shared/cache');
const { schemas, validateInput } = require('../_shared/validation');
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
 * Main handler for listing bookings
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function handler(req, res) {
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

    // Only allow GET method
    if (req.method !== 'GET') {
      const error = new Error('Method not allowed');
      error.status = 405;
      throw error;
    }

    // Parse query parameters
    const queryParams = {
      student_id: req.query.student_id,
      email: req.query.email,
      filter: req.query.filter || 'all',
      page: req.query.page ? parseInt(req.query.page) : 1,
      limit: req.query.limit ? parseInt(req.query.limit) : 20
    };

    // Validate input
    const { error, value: validatedData } = schemas.bookingsList.validate(queryParams);
    if (error) {
      const validationError = new Error(`Invalid input: ${error.details.map(detail => detail.message).join(', ')}`);
      validationError.status = 400;
      validationError.code = 'VALIDATION_ERROR';
      throw validationError;
    }

    const {
      student_id,
      email,
      filter,
      page,
      limit
    } = validatedData;

    // Logging
    console.log('📋 Processing bookings list request:', {
      student_id: sanitizeInput(student_id),
      email: sanitizeInput(email),
      filter,
      page,
      limit
    });

    // Sanitize inputs
    const sanitizedStudentId = sanitizeInput(student_id);
    const sanitizedEmail = sanitizeInput(email);

    // Initialize HubSpot service
    const hubspot = new HubSpotService();

    // Step 1: Authenticate user by finding contact
    console.log('🔐 Authenticating user via HubSpot contact search...');
    const contact = await hubspot.searchContacts(sanitizedStudentId, sanitizedEmail);

    if (!contact) {
      const error = new Error('Authentication failed. Please check your Student ID and email.');
      error.status = 401;
      error.code = 'AUTH_FAILED';
      throw error;
    }

    const contactId = contact.id;
    console.log(`✅ Contact authenticated: ${contactId} - ${contact.properties.firstname} ${contact.properties.lastname}`);

    // Extract credits information
    const credits = {
      sj_credits: parseInt(contact.properties.sj_credits) || 0,
      cs_credits: parseInt(contact.properties.cs_credits) || 0,
      sjmini_credits: parseInt(contact.properties.sjmini_credits) || 0,
      shared_mock_credits: parseInt(contact.properties.shared_mock_credits) || 0
    };

    // Step 2: Get contact's HubSpot object ID for associations API
    const contactHsObjectId = contact.properties.hs_object_id || contactId;
    console.log(`🔗 Using contact HubSpot object ID: ${contactHsObjectId} for associations API`);

    // Step 3: Get bookings using the improved associations-focused approach
    try {
      // Check cache first
      const cache = getCache();
      const cacheKey = `bookings:contact:${contactHsObjectId}:${filter}:page${page}:limit${limit}`;

      let bookingsData = cache.get(cacheKey);

      if (bookingsData) {
        console.log(`🎯 Cache HIT for ${cacheKey}`);
      } else {
        console.log(`📋 Cache MISS - Retrieving bookings via HubSpot associations API (filter: ${filter}, page: ${page}, limit: ${limit})`);
        bookingsData = await hubspot.getBookingsForContact(contactHsObjectId, { filter, page, limit });

        // Store in cache with 5-minute TTL
        cache.set(cacheKey, bookingsData, 5 * 60);
        console.log(`💾 Cached bookings data with key: ${cacheKey}`);
      }

      console.log(`📊 [API DEBUG] Booking retrieval summary:`, {
        filter: filter,
        page: page,
        limit: limit,
        total_bookings: bookingsData.total,
        returned_bookings: bookingsData.bookings.length,
        total_pages: bookingsData.pagination.total_pages,
        has_bookings: bookingsData.bookings.length > 0
      });

      console.log(`📊 Successfully retrieved ${bookingsData.total} total bookings (filter: ${filter}, page: ${page}/${bookingsData.pagination.total_pages})`);

      // Step 4: Prepare response
      const responseData = {
        bookings: bookingsData.bookings,
        pagination: bookingsData.pagination,
        credits: credits
      };

      // Return success response
      return res.status(200).json(createSuccessResponse(
        responseData,
        `Successfully retrieved ${bookingsData.bookings.length} bookings`
      ));

    } catch (bookingError) {
      console.error('❌ Error retrieving bookings via associations API:', {
        contactId: contactHsObjectId,
        error: bookingError.message,
        status: bookingError.response?.status,
        details: bookingError.response?.data
      });

      // Handle specific booking retrieval errors
      if (bookingError.message.includes('API rate limit exceeded')) {
        const error = new Error('Service temporarily unavailable due to high demand. Please try again in a moment.');
        error.status = 503;
        error.code = 'RATE_LIMITED';
        throw error;
      }

      if (bookingError.message.includes('Contact not found or has no booking associations')) {
        // Return empty bookings list instead of error for better UX
        console.log(`📋 No bookings found for contact ${contactHsObjectId}, returning empty list`);
        
        const responseData = {
          bookings: [],
          pagination: {
            current_page: page,
            total_pages: 0,
            total_bookings: 0,
            has_next: false,
            has_previous: false
          },
          credits: credits
        };

        return res.status(200).json(createSuccessResponse(
          responseData,
          'No bookings found for this student'
        ));
      }

      // Re-throw other booking errors
      throw bookingError;
    }

  } catch (error) {
    console.error('❌ Bookings list error:', {
      message: error.message,
      status: error.status || 500,
      code: error.code || 'INTERNAL_ERROR',
      stack: error.stack
    });

    const statusCode = error.status || 500;
    return res.status(statusCode).json(createErrorResponse(
      error.message || 'Internal server error',
      error.code || 'INTERNAL_ERROR'
    ));
  }
}

// Export handler for Vercel serverless function
module.exports = handler;