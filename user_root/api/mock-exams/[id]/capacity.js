require('dotenv').config();
const { HubSpotService } = require('../../_shared/hubspot');
const RedisLockService = require('../../_shared/redis');
const {
  setCorsHeaders,
  handleOptionsRequest,
  createErrorResponse,
  createSuccessResponse,
  verifyEnvironmentVariables,
  rateLimitMiddleware
} = require('../../_shared/auth');

/**
 * GET /api/mock-exams/[id]/capacity
 * Lightweight capacity check for real-time availability updates
 * Used by BookingForm for background polling and pre-submission validation
 */
module.exports = async (req, res) => {
  // Set CORS headers
  setCorsHeaders(res);

  // Handle OPTIONS request
  if (handleOptionsRequest(req, res)) {
    return;
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json(
      createErrorResponse(new Error('Method not allowed'))
    );
  }

  try {
    // Verify environment variables
    verifyEnvironmentVariables();

    // Apply generous rate limiting (60 requests per minute for polling)
    const rateLimiter = rateLimitMiddleware({
      maxRequests: 60,
      windowMs: 60000 // 1 minute
    });

    if (await rateLimiter(req, res)) {
      return; // Request was rate limited
    }

    // Extract mock exam ID from path
    const mockExamId = req.query.id || req.url.split('/').filter(Boolean).pop().split('?')[0];

    if (!mockExamId) {
      return res.status(400).json(
        createErrorResponse(new Error('Mock exam ID is required'))
      );
    }

    // Initialize services
    const redis = new RedisLockService();
    const hubspot = new HubSpotService();

    let capacity = 0;
    let totalBookings = 0;

    // TIER 1: Try Redis first (real-time, authoritative source ~5ms)
    const redisBookings = await redis.get(`exam:${mockExamId}:bookings`);

    if (redisBookings !== null) {
      // Redis has the booking count, just need capacity from HubSpot
      totalBookings = parseInt(redisBookings);
      console.log(`📊 Redis cache hit: exam:${mockExamId}:bookings = ${totalBookings}`);

      // Fetch capacity from HubSpot (single property, fast)
      try {
        const mockExam = await hubspot.getMockExam(mockExamId);
        capacity = parseInt(mockExam.data?.properties?.capacity || mockExam.properties?.capacity) || 0;
      } catch (hubspotError) {
        console.error(`❌ Failed to fetch capacity from HubSpot:`, hubspotError.message);
        // Close Redis connection before throwing
        await redis.close();
        return res.status(404).json(
          createErrorResponse(new Error('Mock exam not found'))
        );
      }
    } else {
      // TIER 2: Redis cache miss - fetch from HubSpot and seed Redis
      console.log(`📊 Redis cache miss: fetching from HubSpot for exam:${mockExamId}`);

      try {
        const mockExam = await hubspot.getMockExam(mockExamId);
        const mockExamData = mockExam.data || mockExam;

        capacity = parseInt(mockExamData.properties.capacity) || 0;
        totalBookings = parseInt(mockExamData.properties.total_bookings) || 0;

        // Seed Redis with current HubSpot value (TTL: 30 days for self-healing)
        const TTL_30_DAYS = 30 * 24 * 60 * 60; // 2,592,000 seconds
        await redis.setex(`exam:${mockExamId}:bookings`, TTL_30_DAYS, totalBookings);
        console.log(`📊 Redis cache seeded: exam:${mockExamId}:bookings = ${totalBookings} (TTL: 30 days)`);
      } catch (hubspotError) {
        console.error(`❌ Failed to fetch mock exam from HubSpot:`, hubspotError.message);
        // Close Redis connection before throwing
        await redis.close();
        return res.status(404).json(
          createErrorResponse(new Error('Mock exam not found'))
        );
      }
    }

    // Close Redis connection
    await redis.close();

    // Calculate availability
    const availableSlots = Math.max(0, capacity - totalBookings);
    const isFull = availableSlots <= 0;

    // Return capacity data
    const capacityData = {
      mock_exam_id: mockExamId,
      capacity,
      total_bookings: totalBookings,
      available_slots: availableSlots,
      is_full: isFull,
      last_checked: new Date().toISOString()
    };

    console.log(`✅ Capacity check complete: ${mockExamId} - ${availableSlots}/${capacity} slots available`);

    res.status(200).json(createSuccessResponse(capacityData));

  } catch (error) {
    console.error('Error checking mock exam capacity:', error);

    const statusCode = error.status || 500;
    res.status(statusCode).json(createErrorResponse(error));
  }
};
