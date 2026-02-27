const RedisLockService = require('../../services/redis');
const { db } = require('../../services/supabase');
const { createSuccessResponse } = require('../../services/auth');

/**
 * GET /api/mock-exams/:id/capacity
 * Lightweight capacity check for real-time availability updates
 * Auth: handled by authenticate middleware on route
 */
const capacity = async (req, res, next) => {
  try {
    // Extract mock exam ID from route params
    const mockExamId = req.params.id;

    if (!mockExamId) {
      const error = new Error('Mock exam ID is required');
      error.status = 400;
      error.code = 'MISSING_EXAM_ID';
      throw error;
    }

    // Initialize Redis
    const redis = new RedisLockService();

    let capacityVal = 0;
    let totalBookings = 0;

    // TIER 1: Try Redis first for bookings count
    const redisBookings = await redis.get(`exam:${mockExamId}:bookings`);

    // TIER 2: Get capacity from Supabase
    const { data: examData, error: supabaseError } = await db
      .from('hubspot_mock_exams')
      .select('capacity, total_bookings')
      .eq('hubspot_id', mockExamId)
      .single();

    if (supabaseError || !examData) {
      console.error(`❌ Failed to fetch exam from Supabase:`, supabaseError?.message);
      await redis.close();
      const error = new Error('Mock exam not found');
      error.status = 404;
      error.code = 'EXAM_NOT_FOUND';
      throw error;
    }

    capacityVal = parseInt(examData.capacity) || 0;

    if (redisBookings !== null) {
      totalBookings = parseInt(redisBookings);
      console.log(`📊 Redis hit: exam:${mockExamId}:bookings = ${totalBookings}, capacity from Supabase = ${capacityVal}`);
    } else {
      totalBookings = parseInt(examData.total_bookings) || 0;
      console.log(`📊 Redis miss: using Supabase total_bookings = ${totalBookings}`);

      const TTL_1_WEEK = 7 * 24 * 60 * 60;
      await redis.setex(`exam:${mockExamId}:bookings`, TTL_1_WEEK, totalBookings);
      console.log(`📊 Redis seeded: exam:${mockExamId}:bookings = ${totalBookings}`);
    }

    await redis.close();

    const availableSlots = Math.max(0, capacityVal - totalBookings);
    const isFull = availableSlots <= 0;

    const capacityData = {
      mock_exam_id: mockExamId,
      capacity: capacityVal,
      total_bookings: totalBookings,
      available_slots: availableSlots,
      is_full: isFull,
      last_checked: new Date().toISOString()
    };

    console.log(`✅ Capacity check complete: ${mockExamId} - ${availableSlots}/${capacityVal} slots available`);

    res.status(200).json(createSuccessResponse(capacityData));

  } catch (error) {
    console.error('Error checking mock exam capacity:', error);
    next(error);
  }
};

module.exports = { capacity };
