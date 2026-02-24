/**
 * GET /api/admin/work-check-bookings
 * List work check bookings (flat view) with pagination, filtering, and sorting
 * Permission: 'workcheck.view'
 */

const { requirePermission } = require('../middleware/requirePermission');
const { validationMiddleware } = require('../../_shared/validation');
const { supabaseAdmin } = require('../../_shared/supabase');

module.exports = async (req, res) => {
  console.log('[Work Check Bookings List] Endpoint hit:', req.method, req.url);

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
    const validator = validationMiddleware('workCheckBookingList');
    await new Promise((resolve, reject) => {
      validator(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    const {
      page = 1,
      limit = 50,
      student_id,
      instructor_id,
      slot_id,
      group_id,
      location,
      status,
      type,
      date_from,
      date_to,
      sort_by = 'created_at',
      sort_order = 'desc'
    } = req.validatedData || req.query;

    console.log('[Work Check Bookings List] Fetching with params:', {
      page, limit, student_id, instructor_id, slot_id, group_id, location, status, type, date_from, date_to, sort_by, sort_order
    });

    // Build Supabase query with joins
    let query = supabaseAdmin
      .from('work_check_bookings')
      .select(`
        *,
        slot:work_check_slots!work_check_bookings_slot_id_fkey (
          id,
          slot_date,
          slot_time,
          duration_minutes,
          location,
          group_id,
          instructor_id,
          instructor:instructors!work_check_slots_instructor_id_fkey (
            id,
            instructor_name,
            email
          )
        ),
        student:hubspot_contact_credits!work_check_bookings_student_id_fkey (
          student_id,
          firstname,
          lastname,
          email
        )
      `, { count: 'exact' });

    // Apply filters
    if (student_id) {
      query = query.eq('student_id', student_id);
    }

    if (slot_id) {
      query = query.eq('slot_id', slot_id);
    }

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (type && type !== 'all') {
      query = query.eq('type', type);
    }

    // For filters that require slot data, we need to filter after fetch
    // or use a view. For now, fetch and filter.
    const { data: bookings, error, count } = await query;

    if (error) {
      console.error('[Supabase ERROR] Failed to fetch bookings:', error.message);
      throw new Error(`Failed to fetch work check bookings: ${error.message}`);
    }

    // Apply slot-related filters
    let filteredBookings = bookings || [];

    if (instructor_id) {
      filteredBookings = filteredBookings.filter(b => b.slot?.instructor_id === instructor_id);
    }

    if (location) {
      filteredBookings = filteredBookings.filter(b => b.slot?.location === location);
    }

    if (group_id) {
      filteredBookings = filteredBookings.filter(b =>
        b.slot?.group_id && b.slot.group_id.includes(group_id)
      );
    }

    if (date_from) {
      filteredBookings = filteredBookings.filter(b =>
        b.slot?.slot_date && b.slot.slot_date >= date_from
      );
    }

    if (date_to) {
      filteredBookings = filteredBookings.filter(b =>
        b.slot?.slot_date && b.slot.slot_date <= date_to
      );
    }

    // Apply sorting
    const ascending = sort_order === 'asc';
    filteredBookings.sort((a, b) => {
      let comparison = 0;

      switch (sort_by) {
        case 'created_at':
          comparison = new Date(a.created_at) - new Date(b.created_at);
          break;
        case 'slot_date':
          const dateA = a.slot?.slot_date || '';
          const dateB = b.slot?.slot_date || '';
          comparison = dateA.localeCompare(dateB);
          break;
        case 'student_id':
          comparison = (a.student_id || '').localeCompare(b.student_id || '');
          break;
        case 'status':
          comparison = (a.status || '').localeCompare(b.status || '');
          break;
        case 'type':
          comparison = (a.type || '').localeCompare(b.type || '');
          break;
        default:
          comparison = 0;
      }

      return ascending ? comparison : -comparison;
    });

    // Apply pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const paginatedBookings = filteredBookings.slice(offset, offset + parseInt(limit));

    // Transform results
    const transformedBookings = paginatedBookings.map(booking => ({
      id: booking.id,
      slot_id: booking.slot_id,
      student_id: booking.student_id,
      student_name: booking.student ?
        `${booking.student.firstname || ''} ${booking.student.lastname || ''}`.trim() :
        null,
      student_email: booking.student?.email || null,
      status: booking.status,
      type: booking.type,
      created_at: booking.created_at,
      confirmed_at: booking.confirmed_at,
      cancelled_at: booking.cancelled_at,
      slot: booking.slot ? {
        slot_date: booking.slot.slot_date,
        slot_time: booking.slot.slot_time,
        duration_minutes: booking.slot.duration_minutes,
        location: booking.slot.location,
        group_id: booking.slot.group_id,
        instructor_id: booking.slot.instructor_id,
        instructor_name: booking.slot.instructor?.instructor_name || null
      } : null
    }));

    // Calculate pagination metadata
    const totalRecords = filteredBookings.length;
    const totalPages = Math.ceil(totalRecords / parseInt(limit));

    const response = {
      success: true,
      pagination: {
        current_page: parseInt(page),
        total_pages: totalPages,
        total_records: totalRecords,
        records_per_page: parseInt(limit)
      },
      data: transformedBookings
    };

    console.log(`[Work Check Bookings List] Returning ${transformedBookings.length} of ${totalRecords} bookings`);

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

    console.error('Error in work check bookings list:', error);

    res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Failed to fetch work check bookings'
    });
  }
};
