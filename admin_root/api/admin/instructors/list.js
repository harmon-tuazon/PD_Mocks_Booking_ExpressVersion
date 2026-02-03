/**
 * GET /api/admin/instructors/list
 * List all instructors with optional search
 * Permission: 'groups.view'
 */

const { requirePermission } = require('../middleware/requirePermission');
const { supabaseAdmin } = require('../../_shared/supabase');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: `Method ${req.method} not allowed` }
    });
  }

  try {
    // Verify admin authentication and permission
    await requirePermission(req, 'groups.view');

    const { search, limit = 50, page = 1 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build query
    let query = supabaseAdmin
      .from('instructors')
      .select('*', { count: 'exact' });

    // Apply search filter
    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,instructor_id.ilike.%${search}%`);
    }

    // Apply pagination
    query = query
      .order('last_name', { ascending: true })
      .order('first_name', { ascending: true })
      .range(offset, offset + parseInt(limit) - 1);

    const { data: instructors, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch instructors: ${error.message}`);
    }

    res.status(200).json({
      success: true,
      data: instructors || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total_records: count || 0,
        total_pages: Math.ceil((count || 0) / parseInt(limit))
      }
    });

  } catch (error) {
    // Auth-specific error handling
    if (error.message.includes('authorization') || error.message.includes('token') || error.message.includes('Permission denied')) {
      const statusCode = error.statusCode || 401;
      return res.status(statusCode).json({
        success: false,
        error: { code: error.code || 'UNAUTHORIZED', message: error.message }
      });
    }

    console.error('Error listing instructors:', error);

    res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Failed to list instructors'
    });
  }
};
