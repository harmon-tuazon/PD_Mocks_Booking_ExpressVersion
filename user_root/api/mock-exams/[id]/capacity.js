require('dotenv').config();
const RedisLockService = require('../../_shared/redis');
const { supabaseAdmin } = require('../../_shared/supabase');
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

    // Initialize Redis
    const redis = new RedisLockService();

    let capacity = 0;
    let totalBookings = 0;

    // TIER 1: Try Redis first for bookings count (real-time, authoritative ~5ms)
    const redisBookings = await redis.get(`exam:${mockExamId}:bookings`);

    // TIER 2: Get capacity from Supabase (fast ~50ms, no HubSpot API call)
    const { data: examData, error: supabaseError } = await supabaseAdmin
      .from('hubspot_mock_exams')
      .select('capacity, total_bookings')
      .eq('hubspot_id', mockExamId)
      .single();

    if (supabaseError || !examData) {
      console.error(`❌ Failed to fetch exam from Supabase:`, supabaseError?.message);
      await redis.close();
      return res.status(404).json(
        createErrorResponse(new Error('Mock exam not found'))
      );
    }

    capacity = parseInt(examData.capacity) || 0;

    if (redisBookings !== null) {
      // Redis has authoritative booking count
      totalBookings = parseInt(redisBookings);
      console.log(`📊 Redis hit: exam:${mockExamId}:bookings = ${totalBookings}, capacity from Supabase = ${capacity}`);
    } else {
      // Redis cache miss - use Supabase value and seed Redis
      totalBookings = parseInt(examData.total_bookings) || 0;
      console.log(`📊 Redis miss: using Supabase total_bookings = ${totalBookings}`);

      // Seed Redis with Supabase value (TTL: 1 week for self-healing)
      const TTL_1_WEEK = 7 * 24 * 60 * 60; // 604,800 seconds
      await redis.setex(`exam:${mockExamId}:bookings`, TTL_1_WEEK, totalBookings);
      console.log(`📊 Redis seeded: exam:${mockExamId}:bookings = ${totalBookings}`);
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
