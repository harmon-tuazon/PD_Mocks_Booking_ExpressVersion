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

const { requireAdmin } = require('../../middleware/requireAdmin');
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
    // Verify admin authentication
    const user = await requireAdmin(req);

    // Extract mock exam ID from URL path parameter
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

    // Step 1: Verify the mock exam exists
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

    // Step 2: Get bookings associated with this mock exam via associations
    // Get mock exam with associations to get all booking IDs
    const mockExamWithAssociations = await hubspot.apiCall('GET',
      `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/${mockExamId}?associations=${HUBSPOT_OBJECTS.bookings}`
    );

    // DEBUG: Log the full associations response
    console.log('🔍 [DEBUG] Full HubSpot associations response:', JSON.stringify(mockExamWithAssociations, null, 2));
    console.log('🔍 [DEBUG] Associations object:', mockExamWithAssociations.associations);
    console.log('🔍 [DEBUG] Association keys available:', Object.keys(mockExamWithAssociations.associations || {}));

    // Extract booking IDs from associations
    // HubSpot returns association keys in various formats depending on portal configuration:
    // - Standard format: '2-50158943' (object type ID)
    // - Portal-specific format: 'p46814382_bookings_' (portal ID + object name)
    // We need to check for both formats
    const bookingIds = [];
    if (mockExamWithAssociations.associations) {
      // Find the bookings association key (flexible matching)
      const bookingsKey = Object.keys(mockExamWithAssociations.associations).find(key =>
        key === HUBSPOT_OBJECTS.bookings || key.includes('bookings')
      );

      console.log('🔍 [DEBUG] Found bookings key:', bookingsKey);

      if (bookingsKey && mockExamWithAssociations.associations[bookingsKey]?.results?.length > 0) {
        mockExamWithAssociations.associations[bookingsKey].results.forEach(association => {
          bookingIds.push(association.id);
        });
      }
    }

    console.log('🔍 [DEBUG] Extracted booking IDs:', bookingIds);

    // If there are no bookings, return empty result
    let allBookings = [];
    if (bookingIds.length === 0) {
      console.log(`No bookings found for mock exam ${mockExamId}`);
    } else {
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
              'booking_status',
              'attendance',
              'attending_location',
              'token_used',
              'ndecc_exam_date',
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

      // Filter to only include active bookings
      const totalBookingsFetched = allBookings.length;
      allBookings = allBookings.filter(booking =>
        booking.properties.is_active === 'Active'
      );
      console.log(`🔍 Filtered bookings: ${totalBookingsFetched} total → ${allBookings.length} active`);
    }

    // Step 3: Apply search filter if provided
    let filteredBookings = allBookings;
    if (searchTerm) {
      filteredBookings = allBookings.filter(booking => {
        const name = (booking.properties.name || '').toLowerCase();
        const email = (booking.properties.email || '').toLowerCase();
        return name.includes(searchTerm) || email.includes(searchTerm);
      });
    }

    // Step 4: Sort the bookings
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

    // Step 5: Apply pagination
    const totalBookings = sortedBookings.length;
    const totalPages = Math.ceil(totalBookings / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = Math.min(startIndex + limit, totalBookings);
    const paginatedBookings = sortedBookings.slice(startIndex, endIndex);

    // Step 6: Transform bookings into response format
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
        booking_status: props.booking_status || '',
        attendance: props.attendance || '',
        attending_location: props.attending_location || '',
        token_used: props.token_used || '',
        is_active: props.is_active || '',
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
    console.log(`💾 [Cached] ${transformedBookings.length} bookings for mock exam ${mockExamId} (2 min TTL)`);

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