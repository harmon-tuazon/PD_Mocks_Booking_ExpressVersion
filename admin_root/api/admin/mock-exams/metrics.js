/**
 * GET /api/admin/mock-exams/metrics
 * Get dashboard metrics for mock exams
 *
 * Architecture: Redis → Supabase → HubSpot
 * - First checks Redis cache (2 min TTL)
 * - Then tries Supabase for fast calculation
 * - Falls back to HubSpot if needed
 */

const { requirePermission } = require('../middleware/requirePermission');
const { validationMiddleware } = require('../../_shared/validation');
const hubspot = require('../../_shared/hubspot');

module.exports = async (req, res) => {
  try {
    // Verify admin authentication and permission
    const user = await requirePermission(req, 'exams.view');

    // Validate query parameters
    const validator = validationMiddleware('mockExamMetrics');
    await new Promise((resolve, reject) => {
      validator(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    const { date_from, date_to } = req.validatedData;

    // Build filters object
    const filters = {};
    if (date_from) filters.date_from = date_from;
    if (date_to) filters.date_to = date_to;

    // Step 1: Check Redis cache
    const { getCache } = require('../../_shared/cache');
    const cacheService = getCache();
    const cacheKey = `admin:mock-exams:metrics:${JSON.stringify(filters)}`;

    const cachedMetrics = await cacheService.get(cacheKey);
    if (cachedMetrics) {
      console.log(`🎯 [Cache HIT] Metrics`);
      return res.status(200).json({
        ...cachedMetrics,
        cached: true
      });
    }

    console.log(`📋 [Cache MISS] Calculating metrics`);

    // Step 2: Try to calculate from Supabase first
    const { getExamsFromSupabase } = require('../../_shared/supabase-data');
    let metrics = null;
    let dataSource = 'unknown';

    try {
      console.log(`🗄️ [SUPABASE] Calculating metrics from Supabase`);

      // Build Supabase filters
      const supabaseFilters = {};
      if (date_from) supabaseFilters.startDate = date_from;
      if (date_to) supabaseFilters.endDate = date_to;

      const supabaseExams = await getExamsFromSupabase(supabaseFilters);

      if (supabaseExams && supabaseExams.length > 0) {
        console.log(`✅ [SUPABASE HIT] Found ${supabaseExams.length} exams for metrics`);

        // Calculate metrics from Supabase data
        const today = new Date().toISOString().split('T')[0];
        let totalSessions = supabaseExams.length;
        let upcomingSessions = 0;
        let fullyBooked = 0;
        let totalCapacity = 0;
        let totalBookings = 0;

        supabaseExams.forEach(exam => {
          // Strip time from exam_date if present
          const examDate = exam.exam_date ? exam.exam_date.split(' ')[0].split('T')[0] : '';
          const capacity = parseInt(exam.capacity) || 0;
          const bookings = parseInt(exam.total_bookings) || 0;
          const isActive = exam.is_active === 'true' || exam.is_active === true;

          // Count upcoming sessions (today or future, and active)
          if (examDate >= today && isActive) {
            upcomingSessions++;
          }

          // Count fully booked sessions
          if (capacity > 0 && bookings >= capacity) {
            fullyBooked++;
          }

          // Sum for utilization calculation
          totalCapacity += capacity;
          totalBookings += bookings;
        });

        // Calculate average utilization
        const averageUtilization = totalCapacity > 0
          ? Math.round((totalBookings / totalCapacity) * 100)
          : 0;

        metrics = {
          total_sessions: totalSessions,
          upcoming_sessions: upcomingSessions,
          fully_booked: fullyBooked,
          average_utilization: averageUtilization
        };

        dataSource = 'supabase';
      } else {
        console.log(`📭 [SUPABASE MISS] No exams found, falling back to HubSpot`);
      }
    } catch (supabaseError) {
      console.error(`⚠️ [SUPABASE ERROR] Failed to calculate metrics (non-blocking):`, supabaseError.message);
    }

    // Step 3: Fallback to HubSpot if not in Supabase
    if (!metrics) {
      console.log(`📧 [HUBSPOT] Calculating metrics from HubSpot`);
      metrics = await hubspot.calculateMetrics(filters);
      dataSource = 'hubspot';
    }

    const response = {
      success: true,
      metrics,
      meta: {
        timestamp: new Date().toISOString(),
        data_source: dataSource,
        cached: false
      }
    };

    // Cache for 2 minutes (120 seconds)
    await cacheService.set(cacheKey, response, 120);
    console.log(`💾 [Cached] Metrics for 2 minutes (source: ${dataSource})`);

    res.status(200).json(response);

  } catch (error) {
    // Add auth-specific error handling FIRST
    if (error.message.includes('authorization') || error.message.includes('token')) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: error.message }
      });
    }

    console.error('Error calculating metrics:', error);

    res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Failed to calculate metrics'
    });
  }
};
