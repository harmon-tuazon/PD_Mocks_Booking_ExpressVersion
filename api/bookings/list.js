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
      limit: req.query.limit ? parseInt(req.query.limit) : 20,
      force: req.query.force === 'true' || req.query._t !== undefined  // Cache-busting support
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
      limit,
      force
    } = validatedData;

    // Logging
    console.log('📋 Processing bookings list request:', {
      student_id: sanitizeInput(student_id),
      email: sanitizeInput(email),
      filter,
      page,
      limit,
      force: force || false,
      timestamp: new Date().toISOString()
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
      console.error('❌ Contact not found:', {
        student_id: sanitizedStudentId,
        email: sanitizedEmail
      });
      const error = new Error('Authentication failed. Please check your Student ID and email.');
      error.status = 401;
      error.code = 'AUTH_FAILED';
      throw error;
    }

    const contactId = contact.id;
    console.log(`✅ Contact authenticated: ${contactId} - ${contact.properties.firstname} ${contact.properties.lastname}`, {
      contactId,
      studentId: contact.properties.student_id,
      email: contact.properties.email,
      hs_object_id: contact.properties.hs_object_id
    });

    // Extract credits information
    const credits = {
      sj_credits: parseInt(contact.properties.sj_credits) || 0,
      cs_credits: parseInt(contact.properties.cs_credits) || 0,
      sjmini_credits: parseInt(contact.properties.sjmini_credits) || 0,
      shared_mock_credits: parseInt(contact.properties.shared_mock_credits) || 0
    };

    // Create credit_breakdown for TokenCard compatibility
    const credit_breakdown = {
      specific_credits: 0,  // Placeholder - frontend determines based on mock type
      shared_credits: parseInt(contact.properties.shared_mock_credits) || 0
    };

    // Step 2: Get contact's HubSpot object ID for associations API
    const contactHsObjectId = contact.properties.hs_object_id || contactId;
    console.log(`🔗 Using contact HubSpot object ID: ${contactHsObjectId} for associations API`);

    // Step 3: Get bookings using the improved associations-focused approach
    try {
      // Check cache first (unless force refresh is requested)
      const cache = getCache();
      const cacheKey = `bookings:contact:${contactHsObjectId}:${filter}:page${page}:limit${limit}`;

      let bookingsData = null;

      // FIX: Skip cache if force refresh is requested
      if (force) {
        console.log(`🔄 [Cache Bypass] Force refresh requested, skipping cache lookup for ${cacheKey}`);
        // Set no-cache headers
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      } else {
        bookingsData = cache.get(cacheKey);
        if (bookingsData) {
          console.log(`🎯 Cache HIT for ${cacheKey}`);
        }
      }

      if (!bookingsData) {
        console.log(`📋 Cache MISS - Retrieving bookings via HubSpot associations API (filter: ${filter}, page: ${page}, limit: ${limit})`);
        bookingsData = await hubspot.getBookingsForContact(contactHsObjectId, { filter, page, limit });

        // Auto-complete past bookings
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Start of day

        // Check for bookings that should be marked completed
        const bookingsToComplete = bookingsData.bookings.filter(booking => {
          // Only process Active bookings (not Cancelled or Completed)
          const isActiveValue = booking.is_active;
          const isActive = (
            isActiveValue === 'Active' ||
            isActiveValue === 'active' ||
            isActiveValue === true ||
            isActiveValue === 'true'
          );

          if (!isActive) {
            return false; // Skip if not Active
          }

          // Check if exam_date is in the past
          if (booking.exam_date) {
            try {
              // Handle various date formats (YYYY-MM-DD, dd/mm/yyyy, ISO string)
              let examDate;
              const dateStr = booking.exam_date.toString().trim();

              // Check if it's dd/mm/yyyy format
              if (dateStr.includes('/')) {
                const [day, month, year] = dateStr.split('/');
                examDate = new Date(year, month - 1, day); // month is 0-indexed
              } else {
                // Use standard Date parsing for ISO or YYYY-MM-DD formats
                examDate = new Date(dateStr);
              }

              examDate.setHours(0, 0, 0, 0);

              // Check if date is valid
              if (isNaN(examDate.getTime())) {
                console.error(`❌ Invalid exam_date format for booking ${booking.id}:`, booking.exam_date);
                return false;
              }

              const isPast = examDate < today;
              if (isPast) {
                console.log(`📅 Booking ${booking.id} is past (${booking.exam_date}) and Active - will mark as Completed`);
              }
              return isPast;
            } catch (error) {
              console.error(`❌ Error parsing exam_date for booking ${booking.id}:`, booking.exam_date, error.message);
              return false;
            }
          }
          return false;
        });

        // Batch update to "Completed" if any found
        if (bookingsToComplete.length > 0) {
          console.log(`📅 Found ${bookingsToComplete.length} past booking(s) to mark as Completed`);

          try {
            // Prepare batch update payload
            const batchUpdates = bookingsToComplete.map(booking => ({
              id: booking.id,
              properties: {
                is_active: 'Completed'
              }
            }));

            // Split into batches of 100 (HubSpot limit)
            const batchSize = 100;
            for (let i = 0; i < batchUpdates.length; i += batchSize) {
              const batch = batchUpdates.slice(i, i + batchSize);

              console.log(`📤 Updating batch ${Math.floor(i / batchSize) + 1}: ${batch.length} booking(s) to Completed status`);

              await hubspot.apiCall('POST', `/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}/batch/update`, {
                inputs: batch
              });

              console.log(`✅ Updated batch ${Math.floor(i / batchSize) + 1}: ${batch.length} booking(s) marked as Completed`);
            }

            // Update the local data to reflect changes
            bookingsData.bookings.forEach(booking => {
              const shouldUpdate = bookingsToComplete.find(b => b.id === booking.id);
              if (shouldUpdate) {
                booking.is_active = 'Completed';
                console.log(`💾 Updated local booking ${booking.id} to Completed status`);
              }
            });

            // Log summary
            console.log(`🎯 Auto-completion summary: ${bookingsToComplete.length} booking(s) marked as Completed`);

          } catch (updateError) {
            console.error('❌ Error updating bookings to Completed:', {
              message: updateError.message,
              status: updateError.response?.status,
              details: updateError.response?.data
            });
            // Continue without failing - bookings will still be returned
            // They'll be updated on the next request
          }
        } else {
          console.log('📅 No past Active bookings found that need to be marked as Completed');
        }

        // Webhook Reminder: Check for bookings happening tomorrow
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0); // Start of tomorrow

        const tomorrowBookings = bookingsData.bookings.filter(booking => {
          // Only Active bookings
          const isActiveValue = booking.is_active;
          const isActive = (
            isActiveValue === 'Active' ||
            isActiveValue === 'active' ||
            isActiveValue === true ||
            isActiveValue === 'true'
          );

          if (!isActive) return false;

          // Check if exam_date is tomorrow
          if (booking.exam_date) {
            try {
              let examDate;
              const dateStr = booking.exam_date.toString().trim();

              // Handle date format (same logic as auto-complete)
              if (dateStr.includes('/')) {
                const [day, month, year] = dateStr.split('/');
                examDate = new Date(year, month - 1, day);
              } else {
                examDate = new Date(dateStr);
              }

              examDate.setHours(0, 0, 0, 0);

              if (isNaN(examDate.getTime())) {
                return false;
              }

              // Check if exam is tomorrow (exact match)
              const isTomorrow = examDate.getTime() === tomorrow.getTime();
              if (isTomorrow) {
                console.log(`📅 Booking ${booking.id} is happening tomorrow (${booking.exam_date})`);
              }
              return isTomorrow;
            } catch (error) {
              console.error(`❌ Error parsing exam_date for booking ${booking.id}:`, error.message);
              return false;
            }
          }
          return false;
        });

        // Send individual webhook for each tomorrow booking
        if (tomorrowBookings.length > 0) {
          console.log(`📤 Found ${tomorrowBookings.length} booking(s) happening tomorrow - sending webhooks`);

          const webhookUrl = 'https://api-na1.hubapi.com/automation/v4/webhook-triggers/46814382/bYNB8zc';

          // Send webhook for each booking asynchronously
          tomorrowBookings.forEach((booking, index) => {
            const webhookPayload = {
              booking_id: booking.booking_id || booking.id,
              name: booking.name || `${contact.properties.firstname || ''} ${contact.properties.lastname || ''}`.trim(),
              email: booking.email || contact.properties.email,
              exam_date: booking.exam_date,
              start_time: booking.start_time,
              end_time: booking.end_time,
              mock_type: booking.mock_type,
              location: booking.location || 'Not specified'
            };

            console.log(`📤 [${index + 1}/${tomorrowBookings.length}] Sending webhook for booking ${booking.booking_id || booking.id}`);

            // Send webhook (don't wait for response - fire and forget)
            fetch(webhookUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(webhookPayload)
            })
              .then(response => {
                if (response.ok) {
                  console.log(`✅ Webhook sent successfully for booking ${booking.booking_id || booking.id}`);
                } else {
                  console.warn(`⚠️ Webhook returned status ${response.status} for booking ${booking.booking_id || booking.id}`);
                }
              })
              .catch(error => {
                console.error(`❌ Failed to send webhook for booking ${booking.booking_id || booking.id}:`, error.message);
                // Continue - don't fail the entire request
              });
          });
        } else {
          console.log('📅 No bookings happening tomorrow - no webhooks to send');
        }

        // FIX: Use shorter cache TTL for upcoming bookings to ensure immediate updates
        // Upcoming bookings: 30 seconds (users expect immediate updates after booking)
        // Other filters: 5 minutes (less time-sensitive)
        const cacheTTL = filter === 'upcoming' ? 30 : (5 * 60);
        cache.set(cacheKey, bookingsData, cacheTTL);
        console.log(`💾 Cached bookings data with key: ${cacheKey} (TTL: ${cacheTTL}s)`);
      }

      console.log(`📊 [API DEBUG] Booking retrieval summary:`, {
        filter: filter,
        page: page,
        limit: limit,
        force_refresh: force || false,
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
        credits: credits,  // Keep existing for table display
        credit_breakdown: credit_breakdown  // Add this for TokenCard compatibility
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
          credits: credits,  // Keep existing for table display
          credit_breakdown: credit_breakdown  // Add this for TokenCard compatibility
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