/**
 * GET /api/admin/trainees/[contactId]/bookings
 * Fetch all bookings associated with a specific trainee (contact)
 *
 * Features:
 * - Fetches bookings associated with a contact via HubSpot associations
 * - Validates contact exists in HubSpot
 * - Returns detailed booking information with mock exam details
 * - Implements Redis caching with 5-minute TTL
 * - Calculates summary statistics
 * - Filters Active and Completed bookings by default
 *
 * Query Parameters:
 * - debug (optional): Set to true to bypass cache
 * - include_inactive (optional): Set to true to include all booking statuses
 */

const { requirePermission } = require('../../middleware/requirePermission');
const { validationMiddleware } = require('../../../_shared/validation');
const { getCache } = require('../../../_shared/cache');
const hubspot = require('../../../_shared/hubspot');
const {
  getBookingsByContactFromSupabase,
  getContactByIdFromSupabase,
  syncBookingsToSupabase,
  syncContactToSupabase
} = require('../../../_shared/supabase-data');

// HubSpot Object Type IDs
const HUBSPOT_OBJECTS = {
  'bookings': '2-50158943',
  'mock_exams': '2-50158913',
  'contacts': '0-1'
};

module.exports = async (req, res) => {
  try {
    // Verify admin authentication and permission
    const user = await requirePermission(req, 'bookings.view');

    // Extract contact ID from URL path parameter
    const contactId = req.query.contactId;

    if (!contactId) {
      return res.status(400).json({
        success: false,
        error: 'Contact ID is required'
      });
    }

    // Prepare validation data
    req.validatedData = {
      contactId,
      debug: req.query.debug === 'true',
      include_inactive: req.query.include_inactive === 'true'
    };

    // Validate parameters
    const validator = validationMiddleware('traineeBookings');
    await new Promise((resolve, reject) => {
      validator(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    const { debug, include_inactive } = req.validatedData;

    // Initialize cache service
    const cacheService = getCache();
    const cacheKey = `admin:trainee:${contactId}:bookings${include_inactive ? ':all' : ''}`;

    // Check cache (unless debug mode)
    if (!debug) {
      const cachedData = await cacheService.get(cacheKey);
      if (cachedData) {
        console.log(`🎯 [Cache HIT] Trainee bookings for contact ${contactId}`);
        return res.status(200).json({
          ...cachedData,
          meta: {
            ...cachedData.meta,
            cached: true
          }
        });
      }
    } else {
      console.log('🔍 [DEBUG MODE] Cache bypassed for trainee bookings');
    }

    console.log(`📋 [Cache MISS] Fetching trainee bookings for contact ${contactId}`);

    // Step 1: Try to get contact info from Supabase first
    let traineeInfo;
    let contactFromSupabase = null;
    let supabaseContactFound = false;

    try {
      console.log(`🗄️ [SUPABASE] Fetching contact info for ${contactId}`);
      contactFromSupabase = await getContactByIdFromSupabase(contactId);

      if (contactFromSupabase) {
        console.log(`✅ [SUPABASE HIT] Found contact in Supabase`);
        traineeInfo = {
          id: contactFromSupabase.hubspot_id,
          firstname: contactFromSupabase.firstname || '',
          lastname: contactFromSupabase.lastname || '',
          email: contactFromSupabase.email || '',
          student_id: contactFromSupabase.student_id || '',
          ndecc_exam_date: contactFromSupabase.ndecc_exam_date || ''
        };
        supabaseContactFound = true;
      } else {
        console.log(`📭 [SUPABASE MISS] Contact not in Supabase, fetching from HubSpot`);
      }
    } catch (supabaseError) {
      console.error(`⚠️ [SUPABASE ERROR] Failed to query contact (non-blocking):`, supabaseError.message);
    }

    // Step 2: Fallback to HubSpot if contact not in Supabase
    if (!supabaseContactFound) {
      try {
        console.log(`📧 [HUBSPOT] Fetching contact info for ${contactId}`);
        const contactResponse = await hubspot.apiCall('GET',
          `/crm/v3/objects/${HUBSPOT_OBJECTS.contacts}/${contactId}?properties=firstname,lastname,email,student_id,ndecc_exam_date`
        );

        traineeInfo = {
          id: contactResponse.id,
          firstname: contactResponse.properties.firstname || '',
          lastname: contactResponse.properties.lastname || '',
          email: contactResponse.properties.email || '',
          student_id: contactResponse.properties.student_id || '',
          ndecc_exam_date: contactResponse.properties.ndecc_exam_date || ''
        };

        // Auto-populate Supabase with contact (fire-and-forget)
        syncContactToSupabase(contactResponse).catch(err => {
          console.error(`⚠️ [SUPABASE SYNC] Failed to auto-populate contact (non-blocking):`, err.message);
        });

        console.log(`✅ [HUBSPOT] Contact info retrieved, auto-populating Supabase`);
      } catch (error) {
        if (error.response?.status === 404 || error.message?.includes('404')) {
          return res.status(404).json({
            success: false,
            error: 'Contact not found'
          });
        }
        throw error;
      }
    }

    // Step 3: Try to get bookings from Supabase first
    let allBookings = [];
    let dataSource = 'unknown';
    let supabaseBookingsFound = false;

    try {
      console.log(`🗄️ [SUPABASE] Fetching bookings for contact ${contactId}`);
      const supabaseBookings = await getBookingsByContactFromSupabase(contactId);

      if (supabaseBookings && supabaseBookings.length > 0) {
        console.log(`✅ [SUPABASE HIT] Found ${supabaseBookings.length} bookings in Supabase`);

        // Transform Supabase bookings - use Supabase UUID as id, hubspot_id separate
        allBookings = supabaseBookings.map(booking => ({
          id: booking.id,  // Supabase UUID as primary identifier
          hubspot_id: booking.hubspot_id,  // HubSpot ID for legacy operations
          properties: {
            booking_id: booking.booking_id,
            mock_exam_id: booking.associated_mock_exam,
            name: booking.name,
            email: booking.student_email,
            student_id: booking.student_id,
            dominant_hand: booking.dominant_hand,
            contact_id: booking.associated_contact_id,
            attendance: booking.attendance,
            attending_location: booking.attending_location,
            token_used: booking.token_used,
            ndecc_exam_date: booking.ndecc_exam_date,
            is_active: booking.is_active,
            booking_date: booking.created_at,
            hs_createdate: booking.created_at,
            hs_lastmodifieddate: booking.updated_at,
            // Mock exam details from Supabase sync
            mock_type: booking.mock_type,
            mock_set: booking.mock_set,
            exam_date: booking.exam_date,
            location: booking.attending_location, // Use attending_location as primary
            start_time: booking.start_time,
            end_time: booking.end_time
          }
        }));

        supabaseBookingsFound = true;
        dataSource = 'supabase';
      } else {
        console.log(`📭 [SUPABASE MISS] No bookings in Supabase, falling back to HubSpot`);
      }
    } catch (supabaseError) {
      console.error(`⚠️ [SUPABASE ERROR] Failed to query bookings (non-blocking):`, supabaseError.message);
    }

    // Step 4: Fallback to HubSpot if bookings not in Supabase
    if (!supabaseBookingsFound) {
      console.log(`📧 [HUBSPOT] Fetching bookings from HubSpot for contact ${contactId}`);

      const contactWithAssociations = await hubspot.apiCall('GET',
        `/crm/v3/objects/${HUBSPOT_OBJECTS.contacts}/${contactId}?associations=${HUBSPOT_OBJECTS.bookings}`
      );

      // Extract booking IDs from associations
      const bookingIds = [];
      if (contactWithAssociations.associations) {
        // Find the bookings association key (flexible matching)
        const bookingsKey = Object.keys(contactWithAssociations.associations).find(key =>
          key === HUBSPOT_OBJECTS.bookings || key.includes('bookings')
        );

        console.log('🔍 [DEBUG] Found bookings key:', bookingsKey);

        if (bookingsKey && contactWithAssociations.associations[bookingsKey]?.results?.length > 0) {
          contactWithAssociations.associations[bookingsKey].results.forEach(association => {
            bookingIds.push(association.id);
          });
        }
      }

      console.log(`🔍 [DEBUG] Found ${bookingIds.length} booking associations`);

      if (bookingIds.length > 0) {
        // Batch fetch booking details (HubSpot batch read supports up to 100 objects)
        const batchChunks = [];
        for (let i = 0; i < bookingIds.length; i += 100) {
          batchChunks.push(bookingIds.slice(i, i + 100));
        }

        for (const chunk of batchChunks) {
          try {
            const batchResponse = await hubspot.apiCall('POST', `/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}/batch/read`, {
              properties: [
                'booking_id',
                'mock_exam_id',
                'name',
                'email',
                'student_id',
                'dominant_hand',
                'contact_id',
                'attendance',
                'attending_location',
                'token_used',
                'ndecc_exam_date',
                'is_active',
                'booking_date',
                'hs_createdate',
                'hs_lastmodifieddate',
                // Mock exam details (read-only calculated properties from associated mock exam)
                'mock_type',
                'exam_date',
                'location',
                'start_time',
                'end_time'
              ],
              inputs: chunk.map(id => ({ id }))
            });

            if (batchResponse.results) {
              // For HubSpot-sourced bookings, use HubSpot ID as both id and hubspot_id
              const hubspotBookings = batchResponse.results.map(b => ({
                id: b.id,  // HubSpot ID as fallback (will be string)
                hubspot_id: b.id,  // Also store as hubspot_id for consistency
                properties: b.properties
              }));
              allBookings = allBookings.concat(hubspotBookings);
            }
          } catch (batchError) {
            console.error(`Error fetching booking batch:`, batchError);
          }
        }

        // Auto-populate Supabase with bookings from HubSpot (fire-and-forget)
        if (allBookings.length > 0) {
          syncBookingsToSupabase(allBookings, null).catch(err => {
            console.error(`⚠️ [SUPABASE SYNC] Failed to auto-populate bookings (non-blocking):`, err.message);
          });
          console.log(`✅ [HUBSPOT] Retrieved ${allBookings.length} bookings, auto-populating Supabase`);
        }

        dataSource = 'hubspot';
      } else {
        console.log(`📭 No bookings found for contact ${contactId}`);
        dataSource = 'hubspot'; // Still HubSpot even if empty
      }
    }

    // Step 5: Filter bookings based on include_inactive parameter
    if (!include_inactive && allBookings.length > 0) {
      const totalBookingsFetched = allBookings.length;
      allBookings = allBookings.filter(booking => {
        const status = booking.properties.is_active;
        return status === 'Active' || status === 'active' ||
               status === 'Completed' || status === 'completed';
      });
      console.log(`🔍 Filtered bookings: ${totalBookingsFetched} total → ${allBookings.length} active/completed`);
    }

    console.log(`✅ [DATA SOURCE: ${dataSource.toUpperCase()}] Total: ${allBookings.length} bookings`);


    // Transform bookings - mock exam details are already on booking as read-only calculated properties
    const transformedBookings = allBookings.map((booking, index) => {
      const props = booking.properties;

      // Debug logging for first 3 bookings to verify mock exam properties are present
      if (index < 3) {
        console.log(`🔍 [BOOKING ${index + 1}] Properties:`, {
          mock_type: props.mock_type,
          exam_date: props.exam_date,
          location: props.location,
          start_time: props.start_time,
          end_time: props.end_time,
          attending_location: props.attending_location
        });
      }

      // Determine dominant hand value (convert from string to readable format)
      let dominantHand = props.dominant_hand;
      if (dominantHand === 'true' || dominantHand === true || dominantHand === 'right' || dominantHand === 'Right') {
        dominantHand = 'Right';
      } else if (dominantHand === 'false' || dominantHand === false || dominantHand === 'left' || dominantHand === 'Left') {
        dominantHand = 'Left';
      } else if (!dominantHand) {
        dominantHand = 'N/A';
      }

      return {
        id: booking.id,  // Supabase UUID (or HubSpot ID for legacy)
        hubspot_id: booking.hubspot_id || null,  // HubSpot ID for legacy operations
        mock_exam_id: props.mock_exam_id || '',
        // Mock exam details (read-only calculated properties from associated mock exam)
        mock_exam_type: props.mock_type || '',
        mock_set: props.mock_set || null,
        exam_date: props.exam_date || '',
        start_time: props.start_time || '',
        end_time: props.end_time || '',
        // Booking-specific properties
        booking_date: props.hs_createdate || props.booking_date || '',
        attendance: props.attendance || '',
        // Location: prefer attending_location (SJ/Mini-mock specific), fallback to exam location (all exams)
        attending_location: props.attending_location || props.location || '',
        token_used: props.token_used || '',
        is_active: props.is_active || '',
        is_cancelled: props.is_active === 'Cancelled' || props.is_active === 'cancelled',
        // Trainee information (from booking or contact fallback)
        name: props.name || `${traineeInfo.firstname} ${traineeInfo.lastname}`,
        first_name: props.name ? props.name.split(' ')[0] : traineeInfo.firstname,
        last_name: props.name ? props.name.split(' ').slice(1).join(' ') : traineeInfo.lastname,
        email: props.email || traineeInfo.email,
        student_id: props.student_id || traineeInfo.student_id,
        dominant_hand: dominantHand,
        ndecc_exam_date: props.ndecc_exam_date || traineeInfo.ndecc_exam_date
      };
    });

    // Sort by booking date descending
    transformedBookings.sort((a, b) => {
      const dateA = new Date(a.booking_date || 0);
      const dateB = new Date(b.booking_date || 0);
      return dateB - dateA;
    });

    // Calculate summary statistics
    const summary = {
      total_bookings: transformedBookings.length,
      active_bookings: transformedBookings.filter(b =>
        b.is_active === 'Active' || b.is_active === 'active'
      ).length,
      completed_bookings: transformedBookings.filter(b =>
        b.is_active === 'Completed' || b.is_active === 'completed'
      ).length,
      attended: transformedBookings.filter(b => b.attendance === 'Yes').length,
      no_show: transformedBookings.filter(b => b.attendance === 'No').length,
      unmarked: transformedBookings.filter(b => !b.attendance || b.attendance === '').length
    };

    // Build response
    const response = {
      success: true,
      data: {
        trainee: traineeInfo,
        bookings: transformedBookings,
        summary
      },
      meta: {
        timestamp: new Date().toISOString(),
        cached: false,
        data_source: dataSource, // 'supabase' or 'hubspot'
        contact_source: supabaseContactFound ? 'supabase' : 'hubspot'
      }
    };

    // Cache for 3 minutes (180 seconds) - moderate TTL for booking lists
    // Booking data changes less frequently than credits but more than exams
    await cacheService.set(cacheKey, response, 180);
    console.log(`💾 [Cached] ${transformedBookings.length} bookings for trainee ${contactId} (3 min TTL, source: ${dataSource})`);

    res.status(200).json(response);

  } catch (error) {
    // Check for authentication errors
    if (error.message && (error.message.includes('Authentication') || error.message.includes('Unauthorized'))) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: error.message || 'Authentication required'
        }
      });
    }

    // Check for validation errors
    if (error.details) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message
        }
      });
    }

    console.error('Error fetching trainee bookings:', error);

    // Generic server error
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch trainee bookings',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }
    });
  }
};