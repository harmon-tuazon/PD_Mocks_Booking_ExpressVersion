/**
 * GET /api/admin/mock-exams/:id
 * Get single mock exam with details and bookings
 *
 * Implements Supabase-first architecture with HubSpot fallback:
 * 1. Check Redis cache (3-minute TTL)
 * 2. Try Supabase (read-optimized secondary database)
 * 3. Fallback to HubSpot if not in Supabase
 * 4. Auto-populate Supabase on cache miss (fire-and-forget)
 */

const { requirePermission } = require('../middleware/requirePermission');
const { getCache } = require('../../_shared/cache');
const hubspot = require('../../_shared/hubspot');
const { getExamByIdFromSupabase, getBookingsFromSupabase, syncExamToSupabase, syncBookingsToSupabase } = require('../../_shared/supabase-data');

module.exports = async (req, res) => {
  try {
    // Verify admin authentication and permission
    const user = await requirePermission(req, 'exams.view');

    const mockExamId = req.query.id;

    if (!mockExamId) {
      return res.status(400).json({
        success: false,
        error: 'Mock exam ID is required'
      });
    }

    // Initialize cache
    const cache = getCache();
    const cacheKey = `admin:mock-exam:${mockExamId}`;

    // Step 1: Check Redis cache first
    const cachedData = await cache.get(cacheKey);
    if (cachedData) {
      console.log(`🎯 [Cache HIT] Mock exam ${mockExamId}`);
      return res.status(200).json(cachedData);
    }

    console.log(`📋 [Cache MISS] Fetching mock exam ${mockExamId}`);

    // Step 2: Try Supabase first (read-optimized)
    let examData = null;
    let bookingsData = [];
    let dataSource = 'unknown';

    try {
      console.log(`🗄️ [SUPABASE] Fetching exam ${mockExamId} from Supabase`);
      examData = await getExamByIdFromSupabase(mockExamId);

      if (examData) {
        console.log(`✅ [SUPABASE HIT] Found exam ${mockExamId} in Supabase`);

        // Also fetch bookings from Supabase
        bookingsData = await getBookingsFromSupabase(mockExamId);
        console.log(`✅ [SUPABASE] Found ${bookingsData.length} bookings in Supabase`);

        dataSource = 'supabase';
      }
    } catch (supabaseError) {
      console.error(`⚠️ [SUPABASE ERROR] Non-blocking error:`, supabaseError.message);
      // Continue to HubSpot fallback
    }

    // Step 3: Fallback to HubSpot if not in Supabase
    let result;
    if (!examData) {
      console.log(`📧 [HUBSPOT] Falling back to HubSpot for exam ${mockExamId}`);
      result = await hubspot.getMockExamWithBookings(mockExamId);
      dataSource = 'hubspot';

      // Step 4: Auto-populate Supabase (fire-and-forget)
      console.log(`🔄 [AUTO-POPULATE] Syncing exam ${mockExamId} to Supabase`);
      syncExamToSupabase(result.mockExam).catch(err => {
        console.error(`❌ Failed to auto-populate exam to Supabase (non-blocking):`, err.message);
      });

      if (result.bookings && result.bookings.length > 0) {
        syncBookingsToSupabase(result.bookings, mockExamId).catch(err => {
          console.error(`❌ Failed to auto-populate bookings to Supabase (non-blocking):`, err.message);
        });
      }

      // Use HubSpot data
      examData = result.mockExam;
      bookingsData = result.bookings;
    }

    // Transform mock exam data - handle both Supabase and HubSpot formats
    let properties, examId, createdAt, updatedAt;

    if (dataSource === 'supabase') {
      // Supabase format: flat column structure
      properties = examData;
      examId = examData.hubspot_id;
      createdAt = examData.created_at;
      updatedAt = examData.updated_at;
    } else {
      // HubSpot format: nested properties structure
      properties = examData.properties;
      examId = examData.id;
      createdAt = properties.hs_createdate || '';
      updatedAt = properties.hs_lastmodifieddate || '';
    }

    const capacity = parseInt(properties.capacity) || 0;
    const totalBookings = parseInt(properties.total_bookings) || 0;

    // Pass start_time and end_time RAW (no conversion)
    // Frontend will handle formatting using formatTime() which accepts:
    // - Unix timestamps (milliseconds)
    // - ISO strings
    // - HH:mm strings (will need special handling)
    const startTime = properties.start_time || '';
    const endTime = properties.end_time || '';

    // Transform bookings data - handle both Supabase and HubSpot formats
    const transformedBookings = bookingsData.map(booking => {
      if (dataSource === 'supabase') {
        // Supabase format: flat columns
        return {
          booking_id: booking.hubspot_id,
          student_id: booking.student_id || '',
          student_name: booking.name || '',
          student_email: booking.student_email || '',
          is_active: booking.is_active || 'Active',
          booking_date: booking.created_at || '',
          exam_date: booking.exam_date || ''
        };
      } else {
        // HubSpot format: nested properties
        return {
          booking_id: booking.id,
          student_id: booking.properties.student_id || '',
          student_name: booking.properties.student_name || '',
          student_email: booking.properties.student_email || '',
          is_active: booking.properties.is_active || 'Active',
          booking_date: booking.properties.hs_createdate || '',
          exam_date: booking.properties.exam_date || ''
        };
      }
    });

    const response = {
      success: true,
      mockExam: {
        id: examId,
        properties: {
          mock_type: properties.mock_type || '',
          exam_date: properties.exam_date || '',
          start_time: startTime,
          end_time: endTime,
          capacity,
          total_bookings: totalBookings,
          location: properties.location || '',
          is_active: properties.is_active === 'true'
        },
        bookings: transformedBookings,
        metadata: {
          created_at: createdAt,
          updated_at: updatedAt
        }
      },
      meta: {
        timestamp: new Date().toISOString(),
        cached: false,
        data_source: dataSource
      }
    };

    // Cache the response (3 minutes TTL)
    await cache.set(cacheKey, response, 180);
    console.log(`💾 [Cached] Mock exam ${mockExamId} for 3 minutes (source: ${dataSource})`);

    res.status(200).json(response);

  } catch (error) {
    // Add auth-specific error handling FIRST
    if (error.message.includes('authorization') || error.message.includes('token')) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: error.message }
      });
    }

    console.error('Error fetching mock exam details:', error);

    // Handle 404 for non-existent mock exam
    if (error.message?.includes('not found') || error.status === 404) {
      return res.status(404).json({
        success: false,
        error: 'Mock exam not found'
      });
    }

    res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Failed to fetch mock exam details'
    });
  }
};
