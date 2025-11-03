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

const { requireAdmin } = require('../../middleware/requireAdmin');
const { validationMiddleware } = require('../../../_shared/validation');
const { getCache } = require('../../../_shared/cache');
const hubspot = require('../../../_shared/hubspot');

// HubSpot Object Type IDs
const HUBSPOT_OBJECTS = {
  'bookings': '2-50158943',
  'mock_exams': '2-50158913',
  'contacts': '0-1'
};

module.exports = async (req, res) => {
  try {
    // Verify admin authentication
    const user = await requireAdmin(req);

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

    // Step 1: Verify the contact exists and fetch their details
    let traineeInfo;
    try {
      const contactResponse = await hubspot.apiCall('GET',
        `/crm/v3/objects/${HUBSPOT_OBJECTS.contacts}/${contactId}?properties=firstname,lastname,email,phone,student_id,ndecc_exam_date`
      );

      traineeInfo = {
        id: contactResponse.id,
        firstname: contactResponse.properties.firstname || '',
        lastname: contactResponse.properties.lastname || '',
        email: contactResponse.properties.email || '',
        phone: contactResponse.properties.phone || '',
        student_id: contactResponse.properties.student_id || '',
        ndecc_exam_date: contactResponse.properties.ndecc_exam_date || ''
      };
    } catch (error) {
      if (error.response?.status === 404 || error.message?.includes('404')) {
        return res.status(404).json({
          success: false,
          error: 'Contact not found'
        });
      }
      throw error;
    }

    // Step 2: Get bookings associated with this contact
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

    console.log(`🔍 [DEBUG] Found ${bookingIds.length} bookings for contact ${contactId}`);

    // If there are no bookings, return empty result
    let allBookings = [];
    let mockExamDetails = {};

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
              'booking_status',
              'attendance',
              'attending_location',
              'token_used',
              'is_active',
              'booking_date',
              'hs_createdate',
              'hs_lastmodifieddate'
            ],
            inputs: chunk.map(id => ({ id }))
          });

          if (batchResponse.results) {
            allBookings = allBookings.concat(batchResponse.results);
          }
        } catch (batchError) {
          console.error(`Error fetching booking batch:`, batchError);
        }
      }

      // Filter bookings based on include_inactive parameter
      if (!include_inactive) {
        const totalBookingsFetched = allBookings.length;
        allBookings = allBookings.filter(booking => {
          const status = booking.properties.is_active;
          return status === 'Active' || status === 'active' ||
                 status === 'Completed' || status === 'completed';
        });
        console.log(`🔍 Filtered bookings: ${totalBookingsFetched} total → ${allBookings.length} active/completed`);
      }

      // Get unique mock exam IDs
      const mockExamIds = [...new Set(allBookings.map(b => b.properties.mock_exam_id).filter(Boolean))];

      // Batch fetch mock exam details
      if (mockExamIds.length > 0) {
        for (let i = 0; i < mockExamIds.length; i += 100) {
          const chunk = mockExamIds.slice(i, i + 100);
          try {
            const mockExamResponse = await hubspot.apiCall('POST', `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/batch/read`, {
              properties: ['mock_type', 'exam_date', 'location', 'start_time', 'end_time'],
              inputs: chunk.map(id => ({ id }))
            });

            if (mockExamResponse.results) {
              mockExamResponse.results.forEach(exam => {
                mockExamDetails[exam.id] = exam.properties;
              });
            }
          } catch (error) {
            console.error('Error fetching mock exam batch:', error);
          }
        }
      }
    }

    // Transform bookings with mock exam details
    const transformedBookings = allBookings.map(booking => {
      const props = booking.properties;
      const mockExam = mockExamDetails[props.mock_exam_id] || {};

      // Debug logging for first booking to verify data structure
      if (booking === allBookings[0]) {
        console.log('🔍 [DEBUG] First booking properties:', {
          raw_props: props,
          mock_exam_id: props.mock_exam_id,
          mock_exam_details: mockExam,
          attending_location: props.attending_location,
          booking_date: props.booking_date,
          hs_createdate: props.hs_createdate
        });
      }

      return {
        id: booking.id,
        mock_exam_id: props.mock_exam_id || '',
        mock_exam_type: mockExam.mock_type || '',
        exam_date: mockExam.exam_date || '',
        start_time: mockExam.start_time || '',
        end_time: mockExam.end_time || '',
        booking_date: props.hs_createdate || props.booking_date || '',
        attendance: props.attendance || '',
        attending_location: props.attending_location || mockExam.location || '',
        token_used: props.token_used || '',
        is_active: props.is_active || '',
        // Add trainee info to bookings for display
        name: `${traineeInfo.firstname} ${traineeInfo.lastname}`,
        email: traineeInfo.email,
        student_id: traineeInfo.student_id,
        ndecc_exam_date: traineeInfo.ndecc_exam_date
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
        cached: false
      }
    };

    // Cache for 5 minutes (300 seconds)
    await cacheService.set(cacheKey, response, 300);
    console.log(`💾 [Cached] ${transformedBookings.length} bookings for trainee ${contactId} (5 min TTL)`);

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