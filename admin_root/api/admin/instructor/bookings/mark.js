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
const { getInstructorFromUser } = require('../../../_shared/instructor-helpers');
const { supabaseAdmin } = require('../../../_shared/supabase');
const { validationMiddleware } = require('../../../_shared/validation');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: `Method ${req.method} not allowed` }
    });
  }

  try {
    // Verify instructor authentication
    const user = await requireRole(req, 'instructor');
    const instructor = await getInstructorFromUser(user);

    // Validate request body
    const validator = validationMiddleware('instructorMarkBookings');
    await new Promise((resolve, reject) => {
      validator(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    const { booking_ids, action } = req.validatedData;

    console.log(`[Instructor Mark Bookings] instructor=${instructor.id}, action=${action}, booking_ids=${booking_ids.length}`);

    // Fetch bookings with a join to work_check_slots to verify instructor ownership
    const { data: bookings, error: fetchError } = await supabaseAdmin
      .from('work_check_bookings')
      .select('id, status, marked_at, slot_id, work_check_slots!inner(instructor_id)')
      .in('id', booking_ids)
      .eq('work_check_slots.instructor_id', instructor.id);

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

      const { data: updatedRows, error: updateError } = await supabaseAdmin
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
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      error: { code: error.code || 'INTERNAL_ERROR', message: error.message }
    });
  }
};
