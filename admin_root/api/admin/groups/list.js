/**
 * GET /api/admin/groups/list
 * List groups with pagination, filtering, and sorting
 * Permission: 'groups.view'
 */

const { requirePermission } = require('../middleware/requirePermission');
const { validationMiddleware } = require('../../_shared/validation');
const { getCache } = require('../../_shared/cache');
const { supabaseAdmin } = require('../../_shared/supabase');

module.exports = async (req, res) => {
  try {
    // Verify admin authentication and permission
    const user = await requirePermission(req, 'groups.view');

    // Validate query parameters
    const validator = validationMiddleware('groupList');
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
      filter_status,
      search
    } = req.validatedData;

    // Check for debug mode to bypass cache
    const debugMode = req.query.debug === 'true';

    // Initialize cache
    const cache = getCache();

    // Generate cache key from query parameters
    const cacheKey = `admin:groups:list:${JSON.stringify({
      page,
      limit,
      sort_by,
      sort_order,
      filter_status,
      search
    })}`;

    // Check cache first (unless debug mode)
    if (!debugMode) {
      const cachedData = await cache.get(cacheKey);
      if (cachedData) {
        console.log(`[Cache HIT] ${cacheKey.substring(0, 80)}...`);
        return res.status(200).json(cachedData);
      }
    }

    console.log(`[Cache MISS] Fetching groups data...`);

    // Build Supabase query (using hubspot_sync schema)
    let query = supabaseAdmin
      .from('hubspot_sync.groups')
      .select('*', { count: 'exact' });

    // Apply status filter
    if (filter_status && filter_status !== 'all') {
      query = query.eq('status', filter_status);
    }

    // Apply search filter
    if (search && search.trim()) {
      query = query.ilike('group_name', `%${search.trim()}%`);
    }

    // Apply sorting
    const ascending = sort_order === 'asc';
    query = query.order(sort_by, { ascending });

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data: groups, error, count } = await query;

    if (error) {
      console.error('[Supabase ERROR]', error.message);
      throw new Error(`Failed to fetch groups: ${error.message}`);
    }

    // Get student counts for each group
    const groupIds = groups.map(g => g.group_id);

    let studentCounts = {};
    if (groupIds.length > 0) {
      const { data: countData, error: countError } = await supabaseAdmin
        .from('hubspot_sync.groups_students')
        .select('group_id')
        .in('group_id', groupIds)
        .eq('status', 'active');

      if (!countError && countData) {
        // Count students per group
        studentCounts = countData.reduce((acc, item) => {
          acc[item.group_id] = (acc[item.group_id] || 0) + 1;
          return acc;
        }, {});
      }
    }

    // Transform results
    const transformedGroups = groups.map(group => ({
      id: group.id,
      group_id: group.group_id,
      group_name: group.group_name,
      description: group.description,
      time_period: group.time_period,
      start_date: group.start_date,
      end_date: group.end_date,
      max_capacity: group.max_capacity,
      status: group.status,
      student_count: studentCounts[group.group_id] || 0,
      created_at: group.created_at,
      updated_at: group.updated_at
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
      data: transformedGroups
    };

    // Cache the response (2 minutes TTL)
    await cache.set(cacheKey, response, 120);
    console.log(`[Cached] ${transformedGroups.length} groups for 2 minutes`);

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

    console.error('Error fetching groups:', error);

    res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Failed to fetch groups'
    });
  }
};
