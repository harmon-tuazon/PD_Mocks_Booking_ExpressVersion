/**
 * GET /api/admin/work-check-slots
 * List work check slots with pagination, filtering, and sorting
 * Permission: 'workcheck.view'
 */

const { requirePermission } = require('../middleware/requirePermission');
const { validationMiddleware } = require('../../_shared/validation');
const { supabaseAdmin } = require('../../_shared/supabase');

module.exports = async (req, res) => {
  console.log('[Work Check Slots API] Endpoint hit:', req.method, req.url);

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
    const validator = validationMiddleware('workCheckSlotList');
    await new Promise((resolve, reject) => {
      validator(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    const {
      page,
      limit,
      instructor_id,
      group_id,
      location,
      date_from,
      date_to,
      is_active,
      activation_status,
      sort_by,
      sort_order
    } = req.validatedData;

    console.log('[Work Check Slots List] Fetching with params:', {
      page, limit, instructor_id, group_id, location, date_from, date_to, is_active, activation_status, sort_by, sort_order
    });

    // Build Supabase query with instructor join
    let query = supabaseAdmin
      .from('work_check_slots')
      .select(`
        *,
        instructor:instructors!work_check_slots_instructor_id_fkey (
          id,
          instructor_name,
          email
        )
      `, { count: 'exact' });

    // Apply instructor filter
    if (instructor_id) {
      query = query.eq('instructor_id', instructor_id);
    }

    // Apply group filter (array contains)
    if (group_id) {
      query = query.contains('group_id', [group_id]);
    }

    // Apply location filter
    if (location) {
      query = query.eq('location', location);
    }

    // Apply date range filters
    if (date_from) {
      query = query.gte('slot_date', date_from);
    }
    if (date_to) {
      query = query.lte('slot_date', date_to);
    }

    // Apply active status filter
    if (is_active && is_active !== 'all') {
      const isActiveBoolean = is_active === 'true';
      query = query.eq('is_active', isActiveBoolean);
    }

    // Apply activation status filter
    if (activation_status && activation_status !== 'all') {
      const now = new Date().toISOString();
      if (activation_status === 'scheduled') {
        // Scheduled: available_from is not null AND in the future
        query = query.not('available_from', 'is', null).gt('available_from', now);
      } else if (activation_status === 'immediate') {
        // Immediate: available_from is null OR in the past
        query = query.or(`available_from.is.null,available_from.lte.${now}`);
      }
    }

    // Apply sorting
    let sortColumn = sort_by || 'slot_date';
    const ascending = sort_order === 'asc';

    // Handle instructor_name sorting via nested field
    if (sortColumn === 'instructor_name') {
      // Sort by slot_date as fallback since we can't sort by nested field directly
      sortColumn = 'slot_date';
    }

    query = query.order(sortColumn, { ascending });

    // Secondary sort by slot_time for consistency
    if (sortColumn === 'slot_date') {
      query = query.order('slot_time', { ascending: true });
    }

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data: slots, error, count } = await query;

    if (error) {
      console.error('[Supabase ERROR]', error.message);
      throw new Error(`Failed to fetch work check slots: ${error.message}`);
    }

    // Transform results
    const transformedSlots = (slots || []).map(slot => {
      // Calculate activation status
      const now = new Date();
      const availableFrom = slot.available_from ? new Date(slot.available_from) : null;
      const activationStatus = !availableFrom || availableFrom <= now ? 'immediate' : 'scheduled';

      return {
        id: slot.id,
        instructor_id: slot.instructor_id,
        instructor_name: slot.instructor?.instructor_name || null,
        instructor_email: slot.instructor?.email || null,
        group_id: slot.group_id,
        slot_date: slot.slot_date,
        slot_time: slot.slot_time,
        duration_minutes: slot.duration_minutes,
        total_slots: slot.total_slots,
        location: slot.location,
        is_active: slot.is_active,
        available_from: slot.available_from,
        activation_status: activationStatus,
        auto_approve: slot.auto_approve,
        created_at: slot.created_at,
        updated_at: slot.updated_at
      };
    });

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
      data: transformedSlots
    };

    console.log(`[Work Check Slots List] Returning ${transformedSlots.length} of ${totalRecords} slots`);

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

    console.error('Error in work check slots list:', error);

    res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Failed to fetch work check slots'
    });
  }
};
