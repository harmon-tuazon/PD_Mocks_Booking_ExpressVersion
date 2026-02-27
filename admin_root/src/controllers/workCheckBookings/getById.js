/**
 * Get Work Check Booking By ID Controller
 * GET /api/admin/work-check-bookings/:id
 * Permission: 'workcheck.view'
 */

const { requirePermission } = require('../../middleware/requirePermission');
const { query: dbQuery, nestRow } = require('../../services/database');

const getById = async (req, res, next) => {
  const { id } = req.params;

  console.log(`[Work Check Booking] GET /api/admin/work-check-bookings/${id}`);

  if (!id) {
    return res.status(400).json({
      success: false,
      error: { code: 'MISSING_ID', message: 'Booking ID is required' }
    });
  }

  try {
    await requirePermission(req, 'workcheck.view');

    let booking, fetchErr;
    try {
      const { rows } = await dbQuery(`
        SELECT b.*,
               s.id AS s__id, s.slot_date AS s__slot_date, s.slot_time AS s__slot_time,
               s.duration_minutes AS s__duration_minutes, s.location AS s__location,
               s.group_id AS s__group_id, s.instructor_id AS s__instructor_id,
               s.is_active AS s__is_active,
               i.id AS i__id, i.instructor_name AS i__instructor_name, i.email AS i__email,
               c.student_id AS c__student_id, c.firstname AS c__firstname,
               c.lastname AS c__lastname, c.email AS c__email
        FROM work_check_bookings b
        LEFT JOIN work_check_slots s ON s.id = b.slot_id
        LEFT JOIN instructors i ON i.id = s.instructor_id
        LEFT JOIN hubspot_contact_credits c ON c.student_id = b.student_id
        WHERE b.id = $1
      `, [id]);
      if (rows.length === 0) {
        booking = null;
        fetchErr = { code: 'PGRST116', message: 'Not found' };
      } else {
        booking = nestRow(rows[0], { s: 'slot', i: 'instructor', c: 'student' }, { i: 's' });
        fetchErr = null;
      }
    } catch (err) {
      booking = null;
      fetchErr = { message: err.message, code: err.code || 'UNKNOWN' };
    }

    if (fetchErr) {
      if (fetchErr.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Booking not found' }
        });
      }
      console.error('[DB ERROR] Failed to fetch booking:', fetchErr.message);
      throw new Error(`Failed to fetch booking: ${fetchErr.message}`);
    }

    // Transform response
    const transformedBooking = {
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
      marked_at: booking.marked_at,
      slot: booking.slot ? {
        id: booking.slot.id,
        slot_date: booking.slot.slot_date,
        slot_time: booking.slot.slot_time,
        duration_minutes: booking.slot.duration_minutes,
        location: booking.slot.location,
        group_id: booking.slot.group_id,
        instructor_id: booking.slot.instructor_id,
        instructor_name: booking.slot.instructor?.instructor_name || null,
        instructor_email: booking.slot.instructor?.email || null,
        is_active: booking.slot.is_active
      } : null
    };

    console.log(`[Work Check Booking] Retrieved booking ${id}`);

    res.status(200).json({
      success: true,
      data: transformedBooking
    });

  } catch (error) {
    next(error);
  }
};

module.exports = { getById };
