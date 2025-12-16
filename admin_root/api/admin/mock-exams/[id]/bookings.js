/**
 * GET /api/admin/mock-exams/[id]/bookings
 * Fetch all bookings associated with a specific mock exam from HubSpot
 *
 * Features:
 * - Fetches bookings associated with a mock exam via HubSpot associations
 * - Supports pagination, sorting, and search filtering
 * - Implements Redis caching with 2-minute TTL
 * - Returns detailed booking information including contact details
 *
 * Query Parameters:
 * - page (number): Page number for pagination (default: 1)
 * - limit (number): Items per page (default: 50, max: 100)
 * - sort_by (string): Sort field - created_at|name|email (default: created_at)
 * - sort_order (string): Sort direction - asc|desc (default: desc)
 * - search (string): Search term for filtering by name or email
 */

const { requirePermission } = require('../../middleware/requirePermission');
const hubspot = require('../../../_shared/hubspot');
const { getCache } = require('../../../_shared/cache');

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

    // Extract mock exam ID from URL path parameter
    // Extract ID from query params (Vercel provides dynamic route params via req.query)
    const mockExamId = req.query.id;

    if (!mockExamId) {
      return res.status(400).json({
        success: false,
        error: 'Mock exam ID is required'
      });
    }

    // Validate ID format (should be numeric)
    if (!/^\d+$/.test(mockExamId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid mock exam ID format'
      });
    }

    // Extract and validate query parameters
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const requestedLimit = parseInt(req.query.limit) || 50;
    const limit = Math.min(Math.max(1, requestedLimit), 100); // Cap at 100
    const sortBy = req.query.sort_by || 'created_at';
    const sortOrder = (req.query.sort_order || 'desc').toLowerCase();
    const searchTerm = req.query.search ? req.query.search.toLowerCase().trim() : '';

    // Validate sort parameters
    const validSortFields = ['created_at', 'name', 'email'];
    const validSortOrders = ['asc', 'desc'];

    if (!validSortFields.includes(sortBy)) {
      return res.status(400).json({
        success: false,
        error: `Invalid sort_by field. Valid options: ${validSortFields.join(', ')}`
      });
    }

    if (!validSortOrders.includes(sortOrder)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid sort_order. Valid options: asc, desc'
      });
    }

    // Create cache key based on all parameters
    const cacheService = getCache();
    const cacheKey = `admin:mock-exam:${mockExamId}:bookings:p${page}:l${limit}:${sortBy}:${sortOrder}${searchTerm ? `:s${Buffer.from(searchTerm).toString('base64')}` : ''}`;

    // Allow bypassing cache with debug=true query parameter
    const bypassCache = req.query.debug === 'true';

    // Check cache first (unless bypassed)
    if (!bypassCache) {
      const cachedData = await cacheService.get(cacheKey);
      if (cachedData) {
        console.log(`🎯 [Cache HIT] Bookings for mock exam ${mockExamId}`);
        return res.status(200).json({
          ...cachedData,
          meta: {
            ...cachedData.meta,
            cached: true
          }
        });
      }
    } else {
      console.log('🔍 [DEBUG MODE] Cache bypassed due to debug=true parameter');
    }

    console.log(`📋 [Cache MISS] Fetching bookings for mock exam ${mockExamId}`);

    // Step 1: Verify the mock exam exists (can use Supabase or HubSpot)
    let mockExam;
    try {
      mockExam = await hubspot.getMockExam(mockExamId);
      if (!mockExam) {
        return res.status(404).json({
          success: false,
          error: 'Mock exam not found'
        });
      }
    } catch (error) {
      if (error.response?.status === 404 || error.message?.includes('404')) {
        return res.status(404).json({
          success: false,
          error: 'Mock exam not found'
        });
      }
      throw error;
    }

    // Step 2: Try to fetch bookings from Supabase first
    const { getBookingsFromSupabase, syncBookingsToSupabase } = require('../../../_shared/supabase-data');
    let allBookings = [];
    let dataSource = 'unknown';
    let supabaseFound = false;

    try {
      console.log(`🗄️ [SUPABASE] Fetching bookings for exam ${mockExamId}`);
      const supabaseBookings = await getBookingsFromSupabase(mockExamId);

      if (supabaseBookings && supabaseBookings.length > 0) {
        console.log(`✅ [SUPABASE HIT] Found ${supabaseBookings.length} bookings in Supabase`);

        // Transform Supabase bookings to HubSpot format
        // Include both hubspot_id and supabase_id for Supabase-first bookings
        allBookings = supabaseBookings.map(booking => ({
          id: booking.hubspot_id,
          supabase_id: booking.id,  // Supabase UUID - used for bookings not yet synced to HubSpot
          properties: {
            booking_id: booking.booking_id,
            name: booking.name,
            email: booking.student_email,
            student_id: booking.student_id,
            dominant_hand: booking.dominant_hand,
            contact_id: booking.associated_contact_id,
            attendance: booking.attendance,
            attending_location: booking.attending_location,
            token_used: booking.token_used,
            associated_contact_id: booking.associated_contact_id,
            ndecc_exam_date: booking.ndecc_exam_date,
            exam_date: booking.exam_date,
            mock_type: booking.mock_type,
            mock_exam_type: booking.mock_type,
            location: booking.attending_location,
            start_time: booking.start_time,
            end_time: booking.end_time,
            is_active: booking.is_active,
            hs_createdate: booking.created_at,
            hs_lastmodifieddate: booking.updated_at
          }
        }));

        supabaseFound = true;
        dataSource = 'supabase';
      } else {
        console.log(`📭 [SUPABASE MISS] No bookings in Supabase, falling back to HubSpot`);
      }
    } catch (supabaseError) {
      console.error(`⚠️ [SUPABASE ERROR] Failed to query bookings (non-blocking):`, supabaseError.message);
    }

    // Step 3: Fallback to HubSpot if not in Supabase
    if (!supabaseFound) {
      console.log(`📧 [HUBSPOT] Fetching bookings from HubSpot for exam ${mockExamId}`);

      // Get mock exam with associations to get all booking IDs
      const mockExamWithAssociations = await hubspot.apiCall('GET',
        `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/${mockExamId}?associations=${HUBSPOT_OBJECTS.bookings}`
      );

      // Extract booking IDs from associations
      const bookingIds = [];
      if (mockExamWithAssociations.associations) {
        // Find the bookings association key (flexible matching)
        const bookingsKey = Object.keys(mockExamWithAssociations.associations).find(key =>
          key === HUBSPOT_OBJECTS.bookings || key.includes('bookings')
        );

        if (bookingsKey && mockExamWithAssociations.associations[bookingsKey]?.results?.length > 0) {
          mockExamWithAssociations.associations[bookingsKey].results.forEach(association => {
            bookingIds.push(association.id);
          });
        }
      }

      // If there are bookings, batch fetch them
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
                'name',
                'email',
                'student_id',
                'dominant_hand',
                'contact_id',
                'attendance',
                'attending_location',
                'token_used',
                'associated_contact_id',
                'ndecc_exam_date',
                'exam_date',
                'mock_type',
                'mock_exam_type',
                'location',
                'start_time',
                'end_time',
                'is_active',
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

        // Auto-populate Supabase with bookings (fire-and-forget)
        if (allBookings.length > 0) {
          syncBookingsToSupabase(allBookings, mockExamId).catch(err => {
            console.error(`⚠️ [SUPABASE SYNC] Failed to auto-populate bookings (non-blocking):`, err.message);
          });
          console.log(`✅ [HUBSPOT] Retrieved ${allBookings.length} bookings, auto-populating Supabase`);
        }

        dataSource = 'hubspot';
      } else {
        console.log(`📭 No bookings found for mock exam ${mockExamId}`);
        dataSource = 'hubspot';
      }
    }

    // Filter to include active and completed bookings (exclude cancelled/failed)
    if (allBookings.length > 0) {
      const totalBookingsFetched = allBookings.length;
      allBookings = allBookings.filter(booking => {
        const status = booking.properties.is_active;
        return status === 'Active' || status === 'active' ||
               status === 'Completed' || status === 'completed';
      });
      console.log(`🔍 Filtered bookings: ${totalBookingsFetched} total → ${allBookings.length} active/completed`);
    }

    // Step 4: Apply search filter if provided
    let filteredBookings = allBookings;
    if (searchTerm) {
      filteredBookings = allBookings.filter(booking => {
        const name = (booking.properties.name || '').toLowerCase();
        const email = (booking.properties.email || '').toLowerCase();
        return name.includes(searchTerm) || email.includes(searchTerm);
      });
    }

    // Step 5: Sort the bookings
    const sortedBookings = [...filteredBookings].sort((a, b) => {
      let aValue, bValue;

      switch (sortBy) {
        case 'name':
          aValue = (a.properties.name || '').toLowerCase();
          bValue = (b.properties.name || '').toLowerCase();
          break;
        case 'email':
          aValue = (a.properties.email || '').toLowerCase();
          bValue = (b.properties.email || '').toLowerCase();
          break;
        case 'created_at':
        default:
          aValue = new Date(a.properties.hs_createdate || 0);
          bValue = new Date(b.properties.hs_createdate || 0);
          break;
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    // Step 6: Apply pagination
    const totalBookings = sortedBookings.length;
    const totalPages = Math.ceil(totalBookings / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = Math.min(startIndex + limit, totalBookings);
    const paginatedBookings = sortedBookings.slice(startIndex, endIndex);

    // Step 7: Transform bookings into response format
    const transformedBookings = paginatedBookings.map(booking => {
      const props = booking.properties;

      // Determine dominant hand value (convert from string to readable format)
      let dominantHand = props.dominant_hand;
      if (dominantHand === 'true' || dominantHand === true) {
        dominantHand = 'right';
      } else if (dominantHand === 'false' || dominantHand === false) {
        dominantHand = 'left';
      } else if (!dominantHand) {
        dominantHand = 'not specified';
      }

      return {
        id: booking.id,
        booking_id: props.booking_id || '',
        name: props.name || '',
        email: props.email || '',
        student_id: props.student_id || '',
        dominant_hand: dominantHand,
        contact_id: props.contact_id || '',
        attendance: props.attendance || '',
        attending_location: props.attending_location || '',
        token_used: props.token_used || '',
        associated_contact_id: props.associated_contact_id || '',
        is_active: props.is_active || '',

        // Add the missing property mappings
        exam_date: props.ndecc_exam_date || props.exam_date || '',
        mock_type: props.mock_type || props.mock_exam_type || '',
        location: props.location || '',
        start_time: props.start_time || '',
        end_time: props.end_time || '',
        booking_date: props.hs_createdate || '',

        created_at: props.hs_createdate || '',
        updated_at: props.hs_lastmodifieddate || props.hs_createdate || ''
      };
    });

    // Calculate attendance counts from ALL bookings (before pagination)
    const attendanceCounts = {
      attended: sortedBookings.filter(b => b.properties.attendance === 'Yes').length,
      no_show: sortedBookings.filter(b => b.properties.attendance === 'No').length,
      unmarked: sortedBookings.filter(b => !b.properties.attendance || b.properties.attendance === '').length
    };

    // Build response
    const response = {
      success: true,
      data: {
        bookings: transformedBookings,
        pagination: {
          page: page,
          limit: limit,
          total_bookings: totalBookings,
          total_pages: totalPages,
          has_next: page < totalPages,
          has_prev: page > 1
        },
        attendance_summary: attendanceCounts
      },
      meta: {
        timestamp: new Date().toISOString(),
        cached: false,
        data_source: dataSource,
        exam_id: mockExamId,
        search_term: searchTerm || null,
        sort: {
          field: sortBy,
          order: sortOrder
        }
      }
    };

    // Cache for 2 minutes (120 seconds)
    await cacheService.set(cacheKey, response, 120);
    console.log(`💾 [Cached] ${transformedBookings.length} bookings for mock exam ${mockExamId} (2 min TTL, source: ${dataSource})`);

    res.status(200).json(response);

  } catch (error) {
    console.error('Error fetching mock exam bookings:', error);

    // Check if it's an authentication error from requireAdmin
    if (error.message && (error.message.includes('Authentication') || error.message.includes('Unauthorized'))) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: error.message || 'Authentication required'
        }
      });
    }

    // Generic server error
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch bookings for mock exam',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }
    });
  }
};
