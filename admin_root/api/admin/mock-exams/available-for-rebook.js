/**
 * GET /api/admin/mock-exams/available-for-rebook
 * Fetch available exams for rebooking - reads directly from Supabase
 *
 * DATA FLOW:
 * 1. Query Supabase hubspot_mock_exams table filtered by mock_type and location
 * 2. NO HubSpot fallback - Supabase is source of truth for reads
 *
 * Query Parameters:
 * - mock_type (required): Filter by mock type (from original booking)
 * - location (required): Filter by location (from original booking)
 * - exclude_exam_id (optional): Exclude current exam from results
 *
 * Returns:
 * - 200: Success with exams array (filtered by location)
 * - 400: Invalid request (missing required params)
 * - 401: Unauthorized (admin auth required)
 * - 500: Server error
 *
 * @developer express-backend-architect
 * @depends-on supabase.js
 */

require('dotenv').config();
const { requireAdmin } = require('../middleware/requireAdmin');
const { supabaseAdmin } = require('../../_shared/supabase');

async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET method is allowed' }
    });
  }

  try {
    // 1. Require admin authentication
    await requireAdmin(req);

    // 2. Validate query parameters
    const { mock_type, location, exclude_exam_id } = req.query;

    if (!mock_type) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'mock_type is required' }
      });
    }

    if (!location) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'location is required' }
      });
    }

    console.log(`🔍 [REBOOK] Fetching available exams for: mock_type=${mock_type}, location=${location}`);

    // 3. Get today's date for filtering
    const today = new Date().toISOString().split('T')[0];

    // 4. Build Supabase query - filter by mock_type and location
    let query = supabaseAdmin
      .from('hubspot_mock_exams')
      .select('*')
      .eq('mock_type', mock_type)
      .eq('location', location)
      .eq('is_active', 'true')
      .gt('exam_date', today)
      .order('exam_date', { ascending: true })
      .order('start_time', { ascending: true });

    // Exclude current exam if provided
    if (exclude_exam_id) {
      query = query.neq('hubspot_id', exclude_exam_id);
    }

    const { data: exams, error: queryError } = await query;

    if (queryError) {
      console.error('❌ Supabase query error:', queryError);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch available exams' }
      });
    }

    // 5. Calculate available slots for each exam
    const examsWithSlots = (exams || []).map(exam => ({
      ...exam,
      available_slots: Math.max(0, (exam.capacity || 0) - (exam.total_bookings || 0))
    }));

    console.log(`✅ [REBOOK] Found ${examsWithSlots.length} available exams in ${location}`);

    // 6. Return response
    return res.status(200).json({
      success: true,
      data: {
        exams: examsWithSlots,
        total_count: examsWithSlots.length
      },
      meta: {
        data_source: 'supabase',
        filters_applied: {
          mock_type,
          location,
          exclude_exam_id: exclude_exam_id || null,
          future_only: true
        }
      }
    });

  } catch (error) {
    console.error('❌ [REBOOK] Error fetching available exams:', {
      message: error.message,
      status: error.status || 500,
      code: error.code || 'INTERNAL_ERROR'
    });

    const statusCode = error.status || 500;
    return res.status(statusCode).json({
      success: false,
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: error.message || 'Internal server error'
      }
    });
  }
}

module.exports = handler;
