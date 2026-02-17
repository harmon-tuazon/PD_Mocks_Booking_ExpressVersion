/**
 * GET /api/admin/work-check-bookings/aggregates
 * List booking aggregates grouped by slot_date + slot_time + location
 * with preloaded booking details
 * Permission: 'workcheck.view'
 */

const { requirePermission } = require('../middleware/requirePermission');
const { validationMiddleware } = require('../../_shared/validation');
const { supabaseAdmin } = require('../../_shared/supabase');

module.exports = async (req, res) => {
  console.log('[Work Check Booking Aggregates] Endpoint hit:', req.method, req.url);

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
    const validator = validationMiddleware('workCheckBookingAggregates');
    await new Promise((resolve, reject) => {
      validator(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    const {
      page = 1,
      limit = 20,
      location,
      date_from,
      date_to,
      status,
      type,
      instructor_id,
      sort_by = 'slot_date',
      sort_order = 'desc'
    } = req.validatedData || req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Resolve 'active' to its component statuses, otherwise pass as-is
    const ACTIVE_STATUSES = ['pending', 'confirmed', 'marked', 'completed'];
    const resolvedStatuses = status === 'active' ? ACTIVE_STATUSES : (status ? [status] : null);

    console.log('[Work Check Booking Aggregates] Fetching with params:', {
      page, limit, location, date_from, date_to, status, resolvedStatuses, type, instructor_id, sort_by, sort_order
    });

    // If multiple statuses, call RPC for each and merge; otherwise single call
    let aggregates = [];
    let aggError = null;

    if (resolvedStatuses && resolvedStatuses.length > 1) {
      // Fetch for each status in parallel and merge
      const results = await Promise.all(
        resolvedStatuses.map(s =>
          supabaseAdmin.rpc('get_booking_aggregates', {
            p_location: location || null,
            p_date_from: date_from || null,
            p_date_to: date_to || null,
            p_status: s,
            p_type: type || null,
            p_instructor_id: instructor_id || null,
            p_limit: 1000,
            p_offset: 0
          })
        )
      );

      // Check for errors
      for (const r of results) {
        if (r.error) { aggError = r.error; break; }
      }

      if (!aggError) {
        // Merge and deduplicate aggregates by slot_date + slot_time + location
        const mergedMap = new Map();
        for (const r of results) {
          for (const agg of (r.data || [])) {
            const key = `${agg.slot_date}|${agg.slot_time}|${agg.location}`;
            if (!mergedMap.has(key)) {
              mergedMap.set(key, agg);
            }
          }
        }
        // Sort and paginate client-side
        const allAggregates = Array.from(mergedMap.values());
        allAggregates.sort((a, b) => {
          const cmp = sort_order === 'desc'
            ? b.slot_date.localeCompare(a.slot_date)
            : a.slot_date.localeCompare(b.slot_date);
          if (cmp !== 0) return cmp;
          return sort_order === 'desc'
            ? b.slot_time.localeCompare(a.slot_time)
            : a.slot_time.localeCompare(b.slot_time);
        });
        aggregates = allAggregates.slice(offset, offset + parseInt(limit));
      }
    } else {
      // Single status or no status filter - direct RPC call
      const result = await supabaseAdmin.rpc(
        'get_booking_aggregates',
        {
          p_location: location || null,
          p_date_from: date_from || null,
          p_date_to: date_to || null,
          p_status: resolvedStatuses ? resolvedStatuses[0] : null,
          p_type: type || null,
          p_instructor_id: instructor_id || null,
          p_limit: parseInt(limit),
          p_offset: offset
        }
      );
      aggregates = result.data || [];
      aggError = result.error;
    }

    if (aggError) {
      console.error('[Supabase RPC ERROR] Aggregates:', aggError.message);
      throw new Error(`Failed to fetch booking aggregates: ${aggError.message}`);
    }

    // Get total count for pagination
    let totalAggregatesCount = 0;
    if (resolvedStatuses && resolvedStatuses.length > 1) {
      // Count merged unique aggregates
      const countResults = await Promise.all(
        resolvedStatuses.map(s =>
          supabaseAdmin.rpc('get_booking_aggregates_count', {
            p_location: location || null,
            p_date_from: date_from || null,
            p_date_to: date_to || null,
            p_status: s,
            p_type: type || null,
            p_instructor_id: instructor_id || null
          })
        )
      );
      // Sum counts (may overcount due to overlap, but close enough for pagination)
      for (const r of countResults) {
        if (!r.error) totalAggregatesCount += (r.data || 0);
      }
    } else {
      const { data: countResult, error: countError } = await supabaseAdmin.rpc(
        'get_booking_aggregates_count',
        {
          p_location: location || null,
          p_date_from: date_from || null,
          p_date_to: date_to || null,
          p_status: resolvedStatuses ? resolvedStatuses[0] : null,
          p_type: type || null,
          p_instructor_id: instructor_id || null
        }
      );
      if (countError) {
        console.error('[Supabase RPC ERROR] Count:', countError.message);
      }
      totalAggregatesCount = countResult || 0;
    }

    const totalAggregates = totalAggregatesCount;
    const totalBookings = aggregates?.reduce((sum, agg) => sum + (agg.bookings?.length || 0), 0) || 0;

    // Client-side sorting (if different from default)
    let sortedAggregates = aggregates || [];
    if (sort_by !== 'slot_date' || sort_order !== 'desc') {
      sortedAggregates = sortAggregates(sortedAggregates, sort_by, sort_order);
    }

    const response = {
      success: true,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(totalAggregates / parseInt(limit)),
        total_aggregates: totalAggregates,
        per_page: parseInt(limit),
        preloaded_bookings: totalBookings
      },
      data: sortedAggregates
    };

    console.log(`[Work Check Booking Aggregates] Returning ${sortedAggregates.length} aggregates with ${totalBookings} preloaded bookings`);

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

    console.error('Error in work check booking aggregates:', error);

    res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Failed to fetch booking aggregates'
    });
  }
};

/**
 * Sort aggregates by specified field and order
 */
function sortAggregates(aggregates, sortBy, sortOrder) {
  const multiplier = sortOrder === 'desc' ? -1 : 1;

  return [...aggregates].sort((a, b) => {
    switch (sortBy) {
      case 'slot_date':
        const dateCompare = a.slot_date.localeCompare(b.slot_date);
        if (dateCompare !== 0) return dateCompare * multiplier;
        return a.slot_time.localeCompare(b.slot_time) * multiplier;
      case 'slot_time':
        return a.slot_time.localeCompare(b.slot_time) * multiplier;
      case 'location':
        return a.location.localeCompare(b.location) * multiplier;
      case 'total_bookings':
        return (a.total_bookings - b.total_bookings) * multiplier;
      default:
        return 0;
    }
  });
}
