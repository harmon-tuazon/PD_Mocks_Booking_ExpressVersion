/**
 * GET /api/admin/mock-exams/[id]
 * Get single mock exam details by ID
 *
 * Implements Redis caching with 2-minute TTL for performance optimization.
 * Returns complete mock exam details including calculated fields.
 */

const { requireAdmin } = require('../middleware/requireAdmin');
const { getCache } = require('../../_shared/cache');
const hubspot = require('../../_shared/hubspot');

module.exports = async (req, res) => {
  try {
    // Verify admin authentication
    const user = await requireAdmin(req);

    // Extract exam ID from query params
    const mockExamId = req.query.id;

    // Validate ID format
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

    console.log(`📋 [Cache MISS] Fetching mock exam ${mockExamId} from HubSpot`);

    // Fetch mock exam from HubSpot with all required properties
    let mockExam;
    try {
      // Fetch with extended properties including timestamps and address
      const { HUBSPOT_OBJECTS } = require('../../_shared/hubspot');
      const response = await hubspot.apiCall('GET',
        `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/${mockExamId}?properties=mock_type,exam_date,start_time,end_time,location,address,capacity,total_bookings,is_active,status,hs_createdate,hs_lastmodifieddate`
      );
      mockExam = response;
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

    // Transform mock exam data
    const properties = mockExam.properties;

    // Parse numeric values with proper defaults
    const capacity = parseInt(properties.capacity) || 0;
    const totalBookings = parseInt(properties.total_bookings) || 0;
    const availableSlots = Math.max(0, capacity - totalBookings);

    // Convert timestamps to readable time format
    const formatTime = (timeValue) => {
      if (!timeValue) return null;

      try {
        // Handle Unix timestamp (milliseconds)
        const timestamp = typeof timeValue === 'string' ? parseInt(timeValue) : timeValue;
        if (!isNaN(timestamp)) {
          const date = new Date(timestamp);
          return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          });
        }
      } catch (e) {
        console.error('Error formatting time:', e);
      }

      return null;
    };

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
    let status = properties.status || 'active';
    if (!properties.status) {
      // Derive status from is_active and exam date
      const isActive = properties.is_active === 'true';
      if (!isActive) {
        status = 'inactive';
      } else if (properties.exam_date) {
        const examDate = new Date(properties.exam_date);
        const now = new Date();
        if (examDate < now) {
          status = 'completed';
        } else {
          status = 'active';
        }
      }
    }

    // Build response
    const response = {
      success: true,
      data: {
        id: mockExam.id,
        mock_type: properties.mock_type || null,
        exam_date: formatDate(properties.exam_date),
        start_time: formatTime(properties.start_time),
        end_time: formatTime(properties.end_time),
        capacity: capacity,
        total_bookings: totalBookings,
        available_slots: availableSlots,
        location: properties.location || null,
        address: properties.address || null,
        is_active: properties.is_active === 'true',
        status: status,
        created_at: formatTimestamp(properties.hs_createdate),
        updated_at: formatTimestamp(properties.hs_lastmodifieddate)
      },
      meta: {
        timestamp: new Date().toISOString(),
        cached: false
      }
    };

    // Cache the response (2 minutes TTL = 120 seconds)
    await cache.set(cacheKey, response, 120);
    console.log(`💾 [Cached] Mock exam details ${mockExamId} for 2 minutes`);

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
};