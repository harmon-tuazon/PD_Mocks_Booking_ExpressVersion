/**
 * POST /api/admin/instructor/bookings/mark
 * Mark or unmark work check bookings for the logged-in instructor
 * Role: 'instructor'
 *
 * Request body:
 *   booking_ids  - array of booking UUIDs (min 1, max 50)
 *   action       - 'mark' | 'unmark'
 *
 * Security:
 *   - Verifies instructor authentication via requireRole
 *   - Joins work_check_bookings -> work_check_slots to confirm instructor ownership
 *   - Skips bookings that are not in the expected source status (no error, just skip)
 *
 * Response:
 *   { success: true, data: { updated: N, skipped: N, details: [{id, status, marked_at}] } }
 */

const { requireRole } = require('../../middleware/requireRole');
const { getInstructorFromUser } = require('../../services/instructor-helpers');
const { db } = require('../../services/supabase');
const { query: dbQuery } = require('../../services/database');
const { schemas } = require('../../services/validation');

const markBookings = async (req, res, next) => {
  try {
    // Verify instructor authentication
    const user = await requireRole(req, 'instructor');
    const instructor = await getInstructorFromUser(user);

    // Validate request body
    const { error: validationError, value } = schemas.instructorMarkBookings.validate(
      req.validatedData || req.body
    );
    if (validationError) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: validationError.details[0].message }
      });
    }

    const { booking_ids, action } = value;

    console.log(`[Instructor Mark Bookings] instructor=${instructor.id}, action=${action}, booking_ids=${booking_ids.length}`);

    // Fetch bookings with INNER JOIN to verify instructor ownership
    let bookings, fetchError;
    try {
      const { rows } = await dbQuery(`
        SELECT b.id, b.status, b.marked_at, b.slot_id
        FROM work_check_bookings b
        INNER JOIN work_check_slots s ON s.id = b.slot_id
        WHERE b.id = ANY($1) AND s.instructor_id = $2
      `, [booking_ids, instructor.id]);
      bookings = rows;
      fetchError = null;
    } catch (err) {
      bookings = null;
      fetchError = { message: err.message, code: err.code || 'UNKNOWN' };
    }

    if (fetchError) {
      console.error('[Instructor Mark Bookings] Error fetching bookings:', fetchError.message);
      throw new Error('Failed to fetch bookings');
    }

    // Determine the expected source status based on action
    const expectedStatus = action === 'mark' ? 'confirmed' : 'marked';
    const targetStatus = action === 'mark' ? 'marked' : 'confirmed';

    // Separate bookings into eligible and skipped
    const ownedBookingIds = new Set((bookings || []).map(b => b.id));
    const eligible = [];
    const skipped = [];

    for (const id of booking_ids) {
      if (!ownedBookingIds.has(id)) {
        // Booking not found or does not belong to this instructor - skip
        skipped.push(id);
        continue;
      }

      const booking = bookings.find(b => b.id === id);
      if (booking.status !== expectedStatus) {
        // Booking is not in the expected source status - skip
        skipped.push(id);
        continue;
      }

      eligible.push(id);
    }

    // Perform the update for eligible bookings
    const details = [];

    if (eligible.length > 0) {
      const now = new Date().toISOString();
      const updatePayload = action === 'mark'
        ? { status: targetStatus, marked_at: now }
        : { status: targetStatus, marked_at: null };

      const { data: updatedRows, error: updateError } = await db
        .from('work_check_bookings')
        .update(updatePayload)
        .in('id', eligible)
        .select('id, status, marked_at');

      if (updateError) {
        console.error('[Instructor Mark Bookings] Error updating bookings:', updateError.message);
        throw new Error('Failed to update bookings');
      }

      for (const row of (updatedRows || [])) {
        details.push({
          id: row.id,
          status: row.status,
          marked_at: row.marked_at
        });
      }
    }

    console.log(`[Instructor Mark Bookings] Updated ${details.length}, skipped ${skipped.length}`);

    return res.status(200).json({
      success: true,
      data: {
        updated: details.length,
        skipped: skipped.length,
        details
      }
    });

  } catch (error) {
    next(error);
  }
};

module.exports = { markBookings };
