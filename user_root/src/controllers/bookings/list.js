const { HubSpotService, HUBSPOT_OBJECTS } = require('../../services/hubspot');
const { getCache } = require('../../services/cache');
const { schemas } = require('../../services/validation');
const {
  createSuccessResponse,
  sanitizeInput
} = require('../../services/auth');
const {
  getBookingsByContactFromSupabase,
  getExamByIdFromSupabase,
  getContactCreditsFromSupabase
} = require('../../services/supabase-data');

/**
 * GET /api/bookings/list
 * List all bookings for an authenticated student with pagination and filtering
 *
 * Prerequisites (applied by route middleware):
 *   - authenticate: populates req.user
 */
const list = async (req, res, next) => {
  try {
    // Parse query parameters
    const queryParams = {
      student_id: req.query.student_id,
      email: req.query.email,
      filter: req.query.filter || 'all',
      page: req.query.page ? parseInt(req.query.page) : 1,
      limit: req.query.limit ? parseInt(req.query.limit) : 20,
      force: req.query.force === 'true' || req.query._t !== undefined
    };

    // Validate input (query params — kept inline)
    const { error, value: validatedData } = schemas.bookingsList.validate(queryParams);
    if (error) {
      const validationError = new Error(`Invalid input: ${error.details.map(detail => detail.message).join(', ')}`);
      validationError.status = 400;
      validationError.code = 'VALIDATION_ERROR';
      return next(validationError);
    }

    const {
      student_id,
      email,
      filter,
      page,
      limit,
      force
    } = validatedData;

    console.log('📋 Processing bookings list request:', {
      student_id: sanitizeInput(student_id),
      email: sanitizeInput(email),
      filter,
      page,
      limit,
      force: force || false,
      timestamp: new Date().toISOString()
    });

    const sanitizedStudentId = sanitizeInput(student_id);
    const sanitizedEmail = sanitizeInput(email);

    const hubspot = new HubSpotService();

    // Step 1: Authenticate user via Supabase (fast path ~50ms)
    console.log('🔐 Authenticating user via Supabase...');

    let contact = null;
    let contactId = null;
    let contactHsObjectId = null;
    let credits = null;

    try {
      const supabaseContact = await getContactCreditsFromSupabase(sanitizedStudentId, sanitizedEmail);

      if (supabaseContact) {
        console.log(`✅ Contact authenticated from Supabase: ${supabaseContact.hubspot_id} - ${supabaseContact.firstname} ${supabaseContact.lastname}`);

        contactId = supabaseContact.hubspot_id;
        contactHsObjectId = supabaseContact.hubspot_id;

        credits = {
          sj_credits: parseInt(supabaseContact.sj_credits) || 0,
          cs_credits: parseInt(supabaseContact.cs_credits) || 0,
          sjmini_credits: parseInt(supabaseContact.sjmini_credits) || 0,
          shared_mock_credits: parseInt(supabaseContact.shared_mock_credits) || 0
        };

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
        const authError = new Error('Authentication failed. Please check your Student ID and email.');
        authError.status = 401;
        authError.code = 'AUTH_FAILED';
        return next(authError);
      }

      contactId = contact.id;
      contactHsObjectId = contact.properties.hs_object_id || contactId;

      console.log(`✅ Contact authenticated from HubSpot: ${contactId} - ${contact.properties.firstname} ${contact.properties.lastname}`);

      credits = {
        sj_credits: parseInt(contact.properties.sj_credits) || 0,
        cs_credits: parseInt(contact.properties.cs_credits) || 0,
        sjmini_credits: parseInt(contact.properties.sjmini_credits) || 0,
        shared_mock_credits: parseInt(contact.properties.shared_mock_credits) || 0
      };
    }

    console.log(`🔗 Using contact HubSpot object ID: ${contactHsObjectId}`);

    // Step 3: Get bookings
    try {
      const cache = getCache();
      const cacheKey = `bookings:contact:${contactHsObjectId}:${filter}:page${page}:limit${limit}`;

      let bookingsData = null;

      if (force) {
        console.log(`🔄 [Cache Bypass] Force refresh requested, skipping cache lookup for ${cacheKey}`);
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

        let supabaseBookings = [];
        try {
          supabaseBookings = await getBookingsByContactFromSupabase(contactHsObjectId);
          console.log(`✅ Fetched ${supabaseBookings.length} bookings from Supabase (no HubSpot API calls)`);
        } catch (supabaseErr) {
          console.error('❌ Supabase booking fetch failed, falling back to HubSpot:', supabaseErr.message);
          const hubspotData = await hubspot.getBookingsForContact(contactHsObjectId, { filter, page, limit });
          bookingsData = hubspotData;
        }

        if (supabaseBookings.length > 0 || !bookingsData) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          let transformedBookings = supabaseBookings.map(booking => {
            let normalizedDate = booking.exam_date;
            if (normalizedDate && normalizedDate.includes(' ')) {
              normalizedDate = normalizedDate.split(' ')[0];
            } else if (normalizedDate && normalizedDate.includes('T')) {
              normalizedDate = normalizedDate.split('T')[0];
            }

            return {
              id: booking.id || booking.hubspot_id,
              hubspot_id: booking.hubspot_id,
              booking_id: booking.booking_id,
              name: booking.name,
              email: booking.student_email,
              exam_date: normalizedDate,
              start_time: booking.start_time,
              end_time: booking.end_time,
              mock_type: booking.mock_type || '',
              mock_set: booking.mock_set || null,
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

          // Sort by exam_date descending
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
        today.setHours(0, 0, 0, 0);

        const bookingsToComplete = bookingsData.bookings.filter(booking => {
          const isActiveValue = booking.is_active;
          const isActive = (
            isActiveValue === 'Active' ||
            isActiveValue === 'active' ||
            isActiveValue === true ||
            isActiveValue === 'true'
          );

          if (!isActive) return false;

          if (booking.exam_date) {
            try {
              let examDate;
              const dateStr = booking.exam_date.toString().trim();

              if (dateStr.includes('/')) {
                const [day, month, year] = dateStr.split('/');
                examDate = new Date(year, month - 1, day);
              } else {
                examDate = new Date(dateStr);
              }

              examDate.setHours(0, 0, 0, 0);

              if (isNaN(examDate.getTime())) {
                console.error(`❌ Invalid exam_date format for booking ${booking.id}:`, booking.exam_date);
                return false;
              }

              const isPast = examDate < today;
              if (isPast) {
                console.log(`📅 Booking ${booking.id} is past (${booking.exam_date}) and Active - will mark as Completed`);
              }
              return isPast;
            } catch (parseError) {
              console.error(`❌ Error parsing exam_date for booking ${booking.id}:`, booking.exam_date, parseError.message);
              return false;
            }
          }
          return false;
        });

        if (bookingsToComplete.length > 0) {
          console.log(`📅 Found ${bookingsToComplete.length} past booking(s) to mark as Completed`);

          try {
            const batchUpdates = bookingsToComplete.map(booking => ({
              id: booking.id,
              properties: { is_active: 'Completed' }
            }));

            const batchSize = 100;
            for (let i = 0; i < batchUpdates.length; i += batchSize) {
              const batch = batchUpdates.slice(i, i + batchSize);

              console.log(`📤 Updating batch ${Math.floor(i / batchSize) + 1}: ${batch.length} booking(s) to Completed status`);

              await hubspot.apiCall('POST', `/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}/batch/update`, {
                inputs: batch
              });

              console.log(`✅ Updated batch ${Math.floor(i / batchSize) + 1}: ${batch.length} booking(s) marked as Completed`);
            }

            bookingsData.bookings.forEach(booking => {
              const shouldUpdate = bookingsToComplete.find(b => b.id === booking.id);
              if (shouldUpdate) {
                booking.is_active = 'Completed';
                console.log(`💾 Updated local booking ${booking.id} to Completed status`);
              }
            });

            console.log(`🎯 Auto-completion summary: ${bookingsToComplete.length} booking(s) marked as Completed`);

          } catch (updateError) {
            console.error('❌ Error updating bookings to Completed:', {
              message: updateError.message,
              status: updateError.response?.status,
              details: updateError.response?.data
            });
          }
        } else {
          console.log('📅 No past Active bookings found that need to be marked as Completed');
        }

        const cacheTTL = filter === 'upcoming' ? 30 : (5 * 60);
        await cache.set(cacheKey, bookingsData, cacheTTL);
        console.log(`💾 Cached bookings data with key: ${cacheKey} (TTL: ${cacheTTL}s)`);
      }

      console.log(`📊 Successfully retrieved ${bookingsData.total} total bookings (filter: ${filter}, page: ${page}/${bookingsData.pagination.total_pages})`);

      const responseData = {
        bookings: bookingsData.bookings,
        pagination: bookingsData.pagination,
        credits: credits
      };

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

      if (bookingError.message.includes('API rate limit exceeded')) {
        const rateLimitError = new Error('Service temporarily unavailable due to high demand. Please try again in a moment.');
        rateLimitError.status = 503;
        rateLimitError.code = 'RATE_LIMITED';
        return next(rateLimitError);
      }

      if (bookingError.message.includes('Contact not found or has no booking associations')) {
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

      throw bookingError;
    }

  } catch (error) {
    console.error('❌ Bookings list error:', {
      message: error.message,
      status: error.status || 500,
      code: error.code || 'INTERNAL_ERROR',
      stack: error.stack
    });

    next(error);
  }
};

module.exports = { list };
