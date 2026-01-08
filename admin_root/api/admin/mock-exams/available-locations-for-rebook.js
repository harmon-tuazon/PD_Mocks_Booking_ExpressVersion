/**
 * GET /api/admin/mock-exams/available-locations-for-rebook
 * Fetch unique locations for a mock type - lightweight query for dropdown
 *
 * DATA FLOW:
 * 1. Query Supabase hubspot_mock_exams table for distinct locations
 * 2. NO HubSpot fallback - Supabase is source of truth for reads
 *
 * Query Parameters:
 * - mock_type (required): Filter by mock type
 *
 * Returns:
 * - 200: Success with locations array
 * - 400: Invalid request (missing mock_type)
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
    const { mock_type } = req.query;

    if (!mock_type) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'mock_type is required' }
      });
    }

    console.log(`🔍 [REBOOK] Fetching locations for mock_type: ${mock_type}`);

    // 3. Get today's date for filtering
    const today = new Date().toISOString().split('T')[0];

    // 4. Fetch distinct locations for the mock type
    const { data: exams, error: queryError } = await supabaseAdmin
      .from('hubspot_mock_exams')
      .select('location')
      .eq('mock_type', mock_type)
      .eq('is_active', 'true')
      .gt('exam_date', today);

    if (queryError) {
      console.error('❌ Supabase query error:', queryError);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch locations' }
      });
    }

    // 5. Extract unique locations
    const uniqueLocations = [...new Set(
      (exams || [])
        .map(exam => exam.location)
        .filter(loc => loc && loc !== 'N/A')
    )].sort();

    console.log(`✅ [REBOOK] Found ${uniqueLocations.length} unique locations for ${mock_type}`);

    // 6. Return response
    return res.status(200).json({
      success: true,
      data: {
        locations: uniqueLocations,
        total_count: uniqueLocations.length
      },
      meta: {
        data_source: 'supabase',
        mock_type
      }
    });

  } catch (error) {
    console.error('❌ [REBOOK] Error fetching locations:', {
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
