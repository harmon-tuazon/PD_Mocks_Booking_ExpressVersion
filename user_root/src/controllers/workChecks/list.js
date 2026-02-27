/**
 * GET /api/work-checks/list
 * List user's work check bookings with filtering
 */

const { schemas } = require('../../services/validation');
const { db } = require('../../services/supabase');
const { query: dbQuery, nestRow } = require('../../services/database');

const list = async (req, res, next) => {
  try {
    // Validate query parameters
    const { error, value } = schemas.workCheckList.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.details[0].message }
      });
    }

    const { student_id, email, filter, page, limit } = value;

    console.log(`[WORK-CHECK] Listing bookings for: ${student_id}, filter: ${filter}`);

    // 1. Validate contact
    const { data: contact, error: contactError } = await db
      .from('hubspot_contact_credits')
      .select('id, student_id')
      .eq('student_id', student_id)
      .ilike('email', email)
      .single();

    if (contactError || !contact) {
      return res.status(401).json({
        success: false,
        error: { code: 'NOT_AUTHENTICATED', message: 'Session invalid. Please log in again.' }
      });
    }

    // 2. Build raw SQL query with JOINs
    const today = new Date().toISOString().split('T')[0];
    const offset = (page - 1) * limit;

    let sql = `
      SELECT b.id, b.slot_id, b.student_id, b.status, b.lab, b.seat,
             b.created_at, b.confirmed_at, b.cancelled_at,
             s.id AS s__id, s.slot_date AS s__slot_date, s.slot_time AS s__slot_time,
             s.duration_minutes AS s__duration_minutes, s.location AS s__location,
             s.group_id AS s__group_id,
             i.id AS i__id, i.instructor_name AS i__instructor_name,
             COUNT(*) OVER() AS __total_count
      FROM work_check_bookings b
      LEFT JOIN work_check_slots s ON s.id = b.slot_id
      LEFT JOIN instructors i ON i.id = s.instructor_id
      WHERE b.student_id = $1
    `;
    const params = [contact.student_id];
    let paramIdx = 2;

    // 3. Apply filter
    switch (filter) {
      case 'upcoming':
        sql += ` AND b.status = ANY($${paramIdx}) AND s.slot_date >= $${paramIdx + 1}`;
        params.push(['pending', 'confirmed'], today);
        paramIdx += 2;
        break;
      case 'pending':
        sql += ` AND b.status = $${paramIdx}`;
        params.push('pending');
        paramIdx++;
        break;
      case 'completed':
        sql += ` AND b.status = ANY($${paramIdx})`;
        params.push(['marked', 'completed']);
        paramIdx++;
        break;
      case 'cancelled':
        sql += ` AND b.status = ANY($${paramIdx})`;
        params.push(['cancelled', 'rejected']);
        paramIdx++;
        break;
      case 'all':
      default:
        break;
    }

    // 4. Apply pagination
    sql += ` ORDER BY b.created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
    params.push(limit, offset);

    let bookings, bookingsError, count;
    try {
      const { rows } = await dbQuery(sql, params);
      count = rows.length > 0 ? parseInt(rows[0].__total_count) : 0;
      bookings = rows.map(r => {
        const { __total_count, ...rest } = r;
        return nestRow(rest, { s: 'work_check_slots', i: 'instructors' }, { i: 's' });
      });
      bookingsError = null;
    } catch (err) {
      bookings = null;
      bookingsError = { message: err.message };
      count = 0;
    }

    if (bookingsError) {
      console.error('[WORK-CHECK] List error:', bookingsError);
      throw bookingsError;
    }

    // 5. Get group names for all bookings
    const groupIds = [...new Set((bookings || []).flatMap(b => {
      const slot = b.work_check_slots;
      if (!slot) return [];
      return Array.isArray(slot.group_id) ? slot.group_id : [slot.group_id];
    }))];

    let groupNames = {};
    if (groupIds.length > 0) {
      const { data: groupsData } = await db
        .from('groups')
        .select('group_id, group_name')
        .in('group_id', groupIds);

      (groupsData || []).forEach(g => {
        groupNames[g.group_id] = g.group_name;
      });
    }

    // 6. Format bookings for response
    const formattedBookings = (bookings || []).map(booking => {
      const slot = booking.work_check_slots;
      if (!slot) return null;

      // Calculate end time
      const [hours, minutes] = (slot.slot_time || '00:00').split(':').map(Number);
      const endDate = new Date();
      endDate.setHours(hours, minutes + (slot.duration_minutes || 30), 0, 0);
      const endTime = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;

      // Get first group ID for display
      const slotGroups = Array.isArray(slot.group_id) ? slot.group_id : [slot.group_id];
      const primaryGroup = slotGroups[0];

      return {
        id: booking.id,
        booking_id: booking.id,
        slot_id: booking.slot_id,
        status: booking.status,
        lab: booking.lab || null,
        seat: booking.seat || null,
        slot_date: slot.slot_date,
        slot_time: slot.slot_time,
        end_time: endTime,
        duration_minutes: slot.duration_minutes,
        instructor_name: slot.instructors?.instructor_name || 'TBD',
        group_id: primaryGroup,
        group_name: groupNames[primaryGroup] || primaryGroup,
        location: slot.location,
        created_at: booking.created_at,
        confirmed_at: booking.confirmed_at,
        cancelled_at: booking.cancelled_at
      };
    }).filter(Boolean);

    // 7. Categorize bookings
    const categorized = {
      upcoming: [],
      pending: [],
      completed: [],
      cancelled: []
    };

    formattedBookings.forEach(booking => {
      const isInFuture = booking.slot_date >= today;

      if (booking.status === 'pending') {
        categorized.pending.push(booking);
        if (isInFuture) categorized.upcoming.push(booking);
      } else if (booking.status === 'confirmed') {
        categorized.upcoming.push(booking);
      } else if (booking.status === 'marked' || booking.status === 'completed') {
        categorized.completed.push(booking);
      } else if (booking.status === 'cancelled' || booking.status === 'rejected') {
        categorized.cancelled.push(booking);
      }
    });

    // Sort upcoming by date
    categorized.upcoming.sort((a, b) => {
      const dateCompare = a.slot_date.localeCompare(b.slot_date);
      if (dateCompare !== 0) return dateCompare;
      return a.slot_time.localeCompare(b.slot_time);
    });

    // Calculate stats
    const stats = {
      upcoming: categorized.upcoming.length,
      pending: categorized.pending.length,
      completed: categorized.completed.length,
      cancelled: categorized.cancelled.length,
      total: formattedBookings.length
    };

    // Determine which bookings to return based on filter
    let bookingsToReturn;
    if (filter === 'all') {
      bookingsToReturn = formattedBookings;
    } else if (categorized[filter]) {
      bookingsToReturn = categorized[filter];
    } else {
      bookingsToReturn = formattedBookings;
    }

    console.log(`[WORK-CHECK] Found ${bookingsToReturn.length} bookings for ${student_id} (filter: ${filter})`);

    return res.status(200).json({
      success: true,
      pagination: {
        current_page: page,
        total_pages: Math.ceil((count || 0) / limit),
        total_records: count || 0,
        records_per_page: limit
      },
      data: {
        bookings: bookingsToReturn,
        stats
      }
    });

  } catch (error) {
    console.error('[WORK-CHECK] List error:', error);
    next(error);
  }
};

module.exports = { list };
