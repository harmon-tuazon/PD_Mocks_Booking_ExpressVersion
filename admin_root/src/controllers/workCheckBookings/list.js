/**
 * List Work Check Bookings Controller
 * GET /api/admin/work-check-bookings
 * Permission: 'workcheck.view'
 */

const { requirePermission } = require('../../middleware/requirePermission');
const { query: dbQuery, nestRow } = require('../../services/database');

const list = async (req, res, next) => {
  console.log('[Work Check Bookings List] Endpoint hit:', req.method, req.url);

  try {
    // Verify admin authentication and permission
    await requirePermission(req, 'workcheck.view');

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

    // Build raw SQL query with all JOINs and filters in WHERE
    let sql = `
      SELECT b.*,
             s.id AS s__id, s.slot_date AS s__slot_date, s.slot_time AS s__slot_time,
             s.duration_minutes AS s__duration_minutes, s.location AS s__location,
             s.group_id AS s__group_id, s.instructor_id AS s__instructor_id,
             i.id AS i__id, i.instructor_name AS i__instructor_name, i.email AS i__email,
             c.student_id AS c__student_id, c.firstname AS c__firstname,
             c.lastname AS c__lastname, c.email AS c__email,
             COUNT(*) OVER() AS __total_count
      FROM work_check_bookings b
      LEFT JOIN work_check_slots s ON s.id = b.slot_id
      LEFT JOIN instructors i ON i.id = s.instructor_id
      LEFT JOIN hubspot_contact_credits c ON c.student_id = b.student_id
      WHERE 1=1
    `;
    const params = [];
    let paramIdx = 1;

    // Apply ALL filters directly in SQL (no more JavaScript-side filtering)
    if (student_id) {
      sql += ` AND b.student_id = $${paramIdx}`;
      params.push(student_id);
      paramIdx++;
    }
    if (slot_id) {
      sql += ` AND b.slot_id = $${paramIdx}`;
      params.push(slot_id);
      paramIdx++;
    }
    if (status && status !== 'all') {
      sql += ` AND b.status = $${paramIdx}`;
      params.push(status);
      paramIdx++;
    }
    if (type && type !== 'all') {
      sql += ` AND b.type = $${paramIdx}`;
      params.push(type);
      paramIdx++;
    }
    if (instructor_id) {
      sql += ` AND s.instructor_id = $${paramIdx}`;
      params.push(instructor_id);
      paramIdx++;
    }
    if (location) {
      sql += ` AND s.location = $${paramIdx}`;
      params.push(location);
      paramIdx++;
    }
    if (group_id) {
      sql += ` AND $${paramIdx} = ANY(s.group_id)`;
      params.push(group_id);
      paramIdx++;
    }
    if (date_from) {
      sql += ` AND s.slot_date >= $${paramIdx}`;
      params.push(date_from);
      paramIdx++;
    }
    if (date_to) {
      sql += ` AND s.slot_date <= $${paramIdx}`;
      params.push(date_to);
      paramIdx++;
    }

    // Apply sorting in SQL
    const sortColumn = {
      created_at: 'b.created_at',
      slot_date: 's.slot_date',
      student_id: 'b.student_id',
      status: 'b.status',
      type: 'b.type'
    }[sort_by] || 'b.created_at';
    const sortDir = sort_order === 'asc' ? 'ASC' : 'DESC';
    sql += ` ORDER BY ${sortColumn} ${sortDir}`;

    // Apply pagination in SQL
    const offset = (parseInt(page) - 1) * parseInt(limit);
    sql += ` LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
    params.push(parseInt(limit), offset);

    let paginatedBookings, totalRecords;
    try {
      const { rows } = await dbQuery(sql, params);
      totalRecords = rows.length > 0 ? parseInt(rows[0].__total_count) : 0;
      paginatedBookings = rows.map(r => {
        const { __total_count, ...rest } = r;
        return nestRow(rest, { s: 'slot', i: 'instructor', c: 'student' }, { i: 's' });
      });
    } catch (err) {
      console.error('[DB ERROR] Failed to fetch bookings:', err.message);
      throw new Error(`Failed to fetch work check bookings: ${err.message}`);
    }

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
    next(error);
  }
};

module.exports = { list };
