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
const {
  getBookingsByContactFromSupabase,
  getExamByIdFromSupabase,
  getContactCreditsFromSupabase
} = require('../_shared/supabase-data');

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

    // Initialize HubSpot service (only for fallback)
    const hubspot = new HubSpotService();

    // Step 1: Authenticate user via Supabase (fast path ~50ms)
    // Falls back to HubSpot if not found in Supabase
    console.log('🔐 Authenticating user via Supabase...');

    let contact = null;
    let contactId = null;
    let contactHsObjectId = null;
    let credits = null;

    try {
      // Try Supabase first (fast, no HubSpot API call)
      const supabaseContact = await getContactCreditsFromSupabase(sanitizedStudentId, sanitizedEmail);

      if (supabaseContact) {
        console.log(`✅ Contact authenticated from Supabase: ${supabaseContact.hubspot_id} - ${supabaseContact.firstname} ${supabaseContact.lastname}`);

        contactId = supabaseContact.hubspot_id;
        contactHsObjectId = supabaseContact.hubspot_id;

        // Extract credits from Supabase
        credits = {
          sj_credits: parseInt(supabaseContact.sj_credits) || 0,
          cs_credits: parseInt(supabaseContact.cs_credits) || 0,
          sjmini_credits: parseInt(supabaseContact.sjmini_credits) || 0,
          shared_mock_credits: parseInt(supabaseContact.shared_mock_credits) || 0
        };

        // Create contact object for compatibility
        contact = {
          id: supabaseContact.hubspot_id,
          properties: {
            firstname: supabaseContact.firstname,
            lastname: supabaseContact.lastname,
            student_id: supabaseContact.student_id,
            email: supabaseContact.email,
            hs_object_id: supabaseContact.hubspot_id,
            ...credits
          }
        };
      }
    } catch (supabaseError) {
      console.warn('⚠️ Supabase authentication failed, falling back to HubSpot:', supabaseError.message);
    }

    // Fallback to HubSpot if not found in Supabase
    if (!contact) {
      console.log('🔄 Supabase lookup failed, trying HubSpot (slow path ~500ms)...');

      contact = await hubspot.searchContacts(sanitizedStudentId, sanitizedEmail);

      if (!contact) {
        console.error('❌ Contact not found in either Supabase or HubSpot:', {
          student_id: sanitizedStudentId,
          email: sanitizedEmail
        });
        const error = new Error('Authentication failed. Please check your Student ID and email.');
        error.status = 401;
        error.code = 'AUTH_FAILED';
        throw error;
      }

      contactId = contact.id;
      contactHsObjectId = contact.properties.hs_object_id || contactId;

      console.log(`✅ Contact authenticated from HubSpot: ${contactId} - ${contact.properties.firstname} ${contact.properties.lastname}`);

      // Extract credits from HubSpot
      credits = {
        sj_credits: parseInt(contact.properties.sj_credits) || 0,
        cs_credits: parseInt(contact.properties.cs_credits) || 0,
        sjmini_credits: parseInt(contact.properties.sjmini_credits) || 0,
        shared_mock_credits: parseInt(contact.properties.shared_mock_credits) || 0
      };
    }

    console.log(`🔗 Using contact HubSpot object ID: ${contactHsObjectId}`);

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
        bookingsData = await cache.get(cacheKey);
        if (bookingsData) {
          console.log(`🎯 Cache HIT for ${cacheKey}`);
        }
      }

      if (!bookingsData) {
        console.log(`📋 Cache MISS - Retrieving bookings from Supabase (filter: ${filter}, page: ${page}, limit: ${limit})`);

        // SUPABASE-FIRST: Get bookings from Supabase instead of HubSpot
        let supabaseBookings = [];
        try {
          supabaseBookings = await getBookingsByContactFromSupabase(contactHsObjectId);
          console.log(`✅ Fetched ${supabaseBookings.length} bookings from Supabase (no HubSpot API calls)`);
        } catch (supabaseErr) {
          console.error('❌ Supabase booking fetch failed, falling back to HubSpot:', supabaseErr.message);
          // Fallback to HubSpot
          const hubspotData = await hubspot.getBookingsForContact(contactHsObjectId, { filter, page, limit });
          bookingsData = hubspotData;
        }

        // If we got Supabase bookings, transform and filter them
        if (supabaseBookings.length > 0 || !bookingsData) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          // Transform Supabase format to expected format
          let transformedBookings = supabaseBookings.map(booking => {
            // Normalize exam_date to YYYY-MM-DD
            let normalizedDate = booking.exam_date;
            if (normalizedDate && normalizedDate.includes(' ')) {
              normalizedDate = normalizedDate.split(' ')[0];
            } else if (normalizedDate && normalizedDate.includes('T')) {
              normalizedDate = normalizedDate.split('T')[0];
            }

            return {
              id: booking.hubspot_id,
              booking_id: booking.booking_id,
              name: booking.name,
              email: booking.student_email,
              exam_date: normalizedDate,
              start_time: booking.start_time,
              end_time: booking.end_time,
              mock_type: booking.mock_type || '',
              location: booking.attending_location || booking.location || 'TBD',
              is_active: booking.is_active,
              attendance: booking.attendance,
              dominant_hand: booking.dominant_hand,
              mock_exam_id: booking.associated_mock_exam
            };
          });

          // Apply filter
          if (filter === 'upcoming') {
            transformedBookings = transformedBookings.filter(booking => {
              if (!booking.exam_date) return false;
              const examDate = new Date(booking.exam_date);
              examDate.setHours(0, 0, 0, 0);
              const isActive = booking.is_active === 'Active' || booking.is_active === 'active' || booking.is_active === 'true' || booking.is_active === true;
              return examDate >= today && isActive;
            });
          } else if (filter === 'past') {
            transformedBookings = transformedBookings.filter(booking => {
              if (!booking.exam_date) return false;
              const examDate = new Date(booking.exam_date);
              examDate.setHours(0, 0, 0, 0);
              return examDate < today;
            });
          } else if (filter === 'cancelled') {
            transformedBookings = transformedBookings.filter(booking => {
              return booking.is_active === 'Cancelled' || booking.is_active === 'cancelled';
            });
          }

          // Sort by exam_date descending (most recent first)
          transformedBookings.sort((a, b) => {
            const dateA = new Date(a.exam_date || 0);
            const dateB = new Date(b.exam_date || 0);
            return dateB - dateA;
          });

          // Pagination
          const total = transformedBookings.length;
          const startIndex = (page - 1) * limit;
          const paginatedBookings = transformedBookings.slice(startIndex, startIndex + limit);

          bookingsData = {
            bookings: paginatedBookings,
            total,
            pagination: {
              current_page: page,
              total_pages: Math.ceil(total / limit),
              total_bookings: total,
              has_next: startIndex + limit < total,
              has_previous: page > 1
            }
          };
        }

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

        // FIX: Use shorter cache TTL for upcoming bookings to ensure immediate updates
        // Upcoming bookings: 30 seconds (users expect immediate updates after booking)
        // Other filters: 5 minutes (less time-sensitive)
        const cacheTTL = filter === 'upcoming' ? 30 : (5 * 60);
        await cache.set(cacheKey, bookingsData, cacheTTL);
        console.log(`💾 Cached bookings data with key: ${cacheKey} (TTL: ${cacheTTL}s)`);
      }

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