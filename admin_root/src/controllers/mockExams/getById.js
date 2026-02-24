/**
 * GET /api/admin/mock-exams/:id
 * Get single mock exam details by ID
 *
 * Implements Redis caching with 2-minute TTL for performance optimization.
 * Returns complete mock exam details including calculated fields.
 */

const { requirePermission } = require('../../middleware/requirePermission');
const { getCache } = require('../../services/cache');
const hubspot = require('../../services/hubspot');
const { HUBSPOT_OBJECTS } = require('../../services/hubspot');
const { syncExamToSupabase } = require('../../services/supabase-data');

async function getById(req, res) {
  try {
    // Verify admin authentication and permission
    const user = await requirePermission(req, 'exams.view');

    // Extract ID from route params (Express provides dynamic route params via req.params)
    const mockExamId = req.params.id;

    // Validate ID format
    if (!mockExamId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_ID',
          message: 'Mock exam ID is required'
        }
      });
    }

    // Validate ID format (should be numeric)
    if (!/^\d+$/.test(mockExamId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'Invalid mock exam ID format'
        }
      });
    }

    // Initialize cache
    const cache = getCache();
    const cacheKey = `admin:mock-exam:details:${mockExamId}`;

    // Check cache first
    const cachedData = await cache.get(cacheKey);
    if (cachedData) {
      console.log(`🎯 [Cache HIT] Mock exam details ${mockExamId}`);
      return res.status(200).json({
        ...cachedData,
        meta: {
          ...cachedData.meta,
          cached: true
        }
      });
    }

    console.log(`📋 [Cache MISS] Fetching mock exam ${mockExamId}`);

    // Step 1: Try to fetch from Supabase first
    const { getExamByIdFromSupabase } = require('../../services/supabase-data');
    let mockExam = null;
    let dataSource = 'unknown';
    let supabaseFound = false;

    try {
      console.log(`🗄️ [SUPABASE] Fetching exam ${mockExamId}`);
      const supabaseExam = await getExamByIdFromSupabase(mockExamId);

      if (supabaseExam) {
        console.log(`✅ [SUPABASE HIT] Found exam in Supabase`);

        // Transform Supabase data to HubSpot format
        mockExam = {
          id: supabaseExam.hubspot_id,
          properties: {
            mock_type: supabaseExam.mock_type,
            mock_set: supabaseExam.mock_set,
            exam_date: supabaseExam.exam_date,
            start_time: supabaseExam.start_time,
            end_time: supabaseExam.end_time,
            location: supabaseExam.location,
            address: supabaseExam.address,
            capacity: supabaseExam.capacity,
            total_bookings: supabaseExam.total_bookings,
            is_active: supabaseExam.is_active,
            scheduled_activation_datetime: supabaseExam.scheduled_activation_datetime,
            status: supabaseExam.status,
            hs_createdate: supabaseExam.created_at,
            hs_lastmodifieddate: supabaseExam.updated_at
          }
        };

        supabaseFound = true;
        dataSource = 'supabase';
      } else {
        console.log(`📭 [SUPABASE MISS] Exam not found in Supabase, falling back to HubSpot`);
      }
    } catch (supabaseError) {
      console.error(`⚠️ [SUPABASE ERROR] Failed to query exam (non-blocking):`, supabaseError.message);
    }

    // Step 2: Fallback to HubSpot if not in Supabase
    if (!supabaseFound) {
      try {
        console.log(`📧 [HUBSPOT] Fetching exam ${mockExamId}`);
        // Fetch with extended properties including timestamps, address, and scheduled activation
        const response = await hubspot.apiCall('GET',
          `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/${mockExamId}?properties=mock_type,mock_set,exam_date,start_time,end_time,location,address,capacity,total_bookings,is_active,scheduled_activation_datetime,status,hs_createdate,hs_lastmodifieddate`
        );
        mockExam = response;
        dataSource = 'hubspot';

        // Auto-populate Supabase with exam (fire-and-forget)
        syncExamToSupabase({
          id: mockExamId,
          createdAt: mockExam.createdAt,  // From HubSpot GET response
          updatedAt: mockExam.updatedAt,  // From HubSpot GET response
          properties: mockExam.properties
        }).catch(err => {
          console.error(`⚠️ [SUPABASE SYNC] Failed to auto-populate (non-blocking):`, err.message);
        });

        console.log(`✅ [HUBSPOT] Retrieved exam, auto-populating Supabase`);
      } catch (error) {
        // Handle 404 specifically
        if (error.message?.includes('404') || error.message?.includes('not found')) {
          return res.status(404).json({
            success: false,
            error: 'Mock exam not found'
          });
        }
        throw error;
      }
    }

    // Build response using format helper
    const response = formatMockExamResponse(mockExam);

    // Add data source to metadata
    response.meta.data_source = dataSource;

    // If this is a Mock Discussion, fetch prerequisite associations
    if (mockExam.properties.mock_type === 'Mock Discussion') {
      try {
        const PREREQUISITE_ASSOCIATION_TYPE_ID = 1340;
        const prerequisites = await hubspot.getMockExamAssociations(
          mockExamId,
          PREREQUISITE_ASSOCIATION_TYPE_ID
        );

        // Format prerequisite details
        const prerequisiteDetails = prerequisites.map(exam => ({
          id: exam.id,
          mock_type: exam.properties.mock_type,
          exam_date: exam.properties.exam_date,
          location: exam.properties.location || 'Not specified',
          start_time: exam.properties.start_time,
          end_time: exam.properties.end_time,
          capacity: parseInt(exam.properties.capacity || '0'),
          total_bookings: parseInt(exam.properties.total_bookings || '0'),
          is_active: exam.properties.is_active === 'true'
        }));

        // Sort by exam date (earliest first)
        prerequisiteDetails.sort((a, b) => {
          const dateA = new Date(a.exam_date);
          const dateB = new Date(b.exam_date);
          return dateA - dateB;
        });

        // Add prerequisite exams to response data
        response.data.prerequisite_exams = prerequisiteDetails;
        response.data.prerequisite_exam_ids = prerequisites.map(p => p.id);

        console.log(`📚 Included ${prerequisiteDetails.length} prerequisite associations for Mock Discussion ${mockExamId}`);
      } catch (error) {
        console.error('Error fetching prerequisite associations:', error);
        // Don't fail the entire request if prerequisites can't be fetched
        response.data.prerequisite_exams = [];
        response.data.prerequisite_exam_ids = [];
      }
    }

    // Cache the response (2 minutes TTL = 120 seconds)
    await cache.set(cacheKey, response, 120);
    console.log(`💾 [Cached] Mock exam details ${mockExamId} for 2 minutes (source: ${dataSource})`);

    res.status(200).json(response);

  } catch (error) {
    // Handle authentication errors first
    if (error.message?.includes('authorization') ||
        error.message?.includes('token') ||
        error.message?.includes('Authentication')) {
      return res.status(401).json({
        success: false,
        error: 'Authentication failed'
      });
    }

    console.error('Error fetching mock exam details:', error);

    // Return generic server error
    res.status(500).json({
      success: false,
      error: 'Failed to fetch mock exam details'
    });
  }
}

/**
 * Format mock exam data for response
 */
function formatMockExamResponse(mockExam) {
  const properties = mockExam.properties;

  // Parse numeric values with proper defaults
  const capacity = parseInt(properties.capacity) || 0;
  const totalBookings = parseInt(properties.total_bookings) || 0;
  const availableSlots = Math.max(0, capacity - totalBookings);

    // Convert timestamps to readable time format
    const formatTime = (timeValue) => {
      if (!timeValue) return null;

      try {
        // Handle ISO 8601 format (e.g., "2025-12-25T19:00:00Z")
        if (typeof timeValue === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(timeValue)) {
          const date = new Date(timeValue);
          if (!isNaN(date.getTime())) {
            // Convert UTC to Toronto timezone and return HH:mm format
            const torontoTime = date.toLocaleString('en-US', {
              timeZone: 'America/Toronto',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            });
            // Extract just HH:MM (remove any extra formatting)
            const timeParts = torontoTime.split(':');
            return `${timeParts[0]}:${timeParts[1]}`;
          }
        }

        // Handle Unix timestamp (milliseconds)
        const timestamp = typeof timeValue === 'string' ? parseInt(timeValue) : timeValue;
        if (!isNaN(timestamp)) {
          const date = new Date(timestamp);
          if (!isNaN(date.getTime())) {
            // Convert to Toronto timezone and return HH:mm format
            const torontoTime = date.toLocaleString('en-US', {
              timeZone: 'America/Toronto',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            });
            // Extract just HH:MM (remove any extra formatting)
            const timeParts = torontoTime.split(':');
            return `${timeParts[0]}:${timeParts[1]}`;
          }
        }
      } catch (e) {
        console.error('Error formatting time:', e);
      }

      return null;
    };;

    // Format date to ISO string
    const formatDate = (dateValue) => {
      if (!dateValue) return null;

      try {
        // Handle various date formats
        if (typeof dateValue === 'string') {
          // If already in YYYY-MM-DD format, return as is
          if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
            return dateValue;
          }
          // Otherwise parse and format
          const date = new Date(dateValue);
          if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
          }
        }
      } catch (e) {
        console.error('Error formatting date:', e);
      }

      return dateValue;
    };

    // Format timestamps for created_at and updated_at
    const formatTimestamp = (timestamp) => {
      if (!timestamp) return null;

      try {
        const date = new Date(timestamp);
        if (!isNaN(date.getTime())) {
          return date.toISOString();
        }
      } catch (e) {
        console.error('Error formatting timestamp:', e);
      }

      return null;
    };

  // Determine status from is_active if status property not available
  // Handle three-state is_active: 'true', 'false', 'scheduled'
  let status = properties.status;
  if (!status) {
    // Derive status from is_active property
    if (properties.is_active === 'scheduled') {
      status = 'scheduled';
    } else if (properties.is_active === 'true') {
      // Check if exam date has passed
      if (properties.exam_date) {
        const examDate = new Date(properties.exam_date);
        const now = new Date();
        if (examDate < now) {
          status = 'completed';
        } else {
          status = 'active';
        }
      } else {
        status = 'active';
      }
    } else {
      status = 'inactive';
    }
  }

  // Build response
  return {
    success: true,
    data: {
      id: mockExam.id,
      mock_type: properties.mock_type || null,
      mock_set: properties.mock_set || null,
      exam_date: formatDate(properties.exam_date),
      start_time: formatTime(properties.start_time),
      end_time: formatTime(properties.end_time),
      capacity: capacity,
      total_bookings: totalBookings,
      available_slots: availableSlots,
      location: properties.location || null,
      address: properties.address || null,
      is_active: properties.is_active || 'false', // Keep as string: 'true', 'false', or 'scheduled'
      scheduled_activation_datetime: properties.scheduled_activation_datetime || null,
      status: status,
      created_at: formatTimestamp(properties.hs_createdate),
      updated_at: formatTimestamp(properties.hs_lastmodifieddate)
    },
    meta: {
      timestamp: new Date().toISOString(),
      cached: false
    }
  };
}

module.exports = { getById };
