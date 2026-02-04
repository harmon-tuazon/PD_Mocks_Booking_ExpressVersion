/**
 * GET /api/admin/instructors/list
 * List instructors with pagination, filtering, and sorting
 * Permission: 'workcheck.view'
 */

const { requirePermission } = require('../middleware/requirePermission');
const { validationMiddleware } = require('../../_shared/validation');
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
    await requirePermission(req, 'workcheck.view');

    // Validate query parameters
    const validator = validationMiddleware('instructorList');
    await new Promise((resolve, reject) => {
      validator(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    const {
      page,
      limit,
      sort_by,
      sort_order,
      is_active,
      search
    } = req.validatedData;

    console.log('[Instructors List] Fetching instructors with params:', {
      page, limit, sort_by, sort_order, is_active, search
    });

    // Build Supabase query (using hubspot_sync.instructors table)
    let query = supabaseAdmin
      .from('instructors')
      .select('*', { count: 'exact' });

    // Apply active status filter
    if (is_active && is_active !== 'all') {
      const isActiveBoolean = is_active === 'true';
      query = query.eq('is_active', isActiveBoolean);
    }

    // Apply search filter (name or email)
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      query = query.or(`instructor_name.ilike.${searchTerm},email.ilike.${searchTerm}`);
    }

    // Apply sorting
    const sortColumn = sort_by || 'instructor_name';
    const ascending = sort_order === 'asc';
    query = query.order(sortColumn, { ascending });

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data: instructors, error, count } = await query;

    if (error) {
      console.error('[Supabase ERROR]', error.message);
      throw new Error(`Failed to fetch instructors: ${error.message}`);
    }

    // Transform results
    const transformedInstructors = (instructors || []).map(instructor => ({
      id: instructor.id,
      instructor_name: instructor.instructor_name,
      email: instructor.email,
      is_active: instructor.is_active,
      auth_user_id: instructor.auth_user_id,
      created_at: instructor.created_at,
      updated_at: instructor.updated_at
    }));

    // Calculate pagination metadata
    const totalRecords = count || 0;
    const totalPages = Math.ceil(totalRecords / limit);

    const response = {
      success: true,
      pagination: {
        current_page: page,
        total_pages: totalPages,
        total_records: totalRecords,
        records_per_page: limit
      },
      data: transformedInstructors
    };

    console.log(`[Instructors List] Returning ${transformedInstructors.length} instructors`);

    res.status(200).json(response);

  } catch (error) {
    // Auth-specific error handling
    if (error.message.includes('authorization') || error.message.includes('token') || error.message.includes('Permission denied')) {
      const statusCode = error.statusCode || 401;
      return res.status(statusCode).json({
        success: false,
        error: { code: error.code || 'UNAUTHORIZED', message: error.message }
      });
    }

    console.error('Error fetching instructors:', error);

    res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Failed to fetch instructors'
    });
  }
};
