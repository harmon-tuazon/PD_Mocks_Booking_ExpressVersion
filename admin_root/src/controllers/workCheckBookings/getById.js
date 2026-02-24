/**
 * Get Work Check Booking By ID Controller
 * GET /api/admin/work-check-bookings/:id
 * Permission: 'workcheck.view'
 */

const { requirePermission } = require('../../middleware/requirePermission');
const { supabaseAdmin } = require('../../services/supabase');

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

    const { data: booking, error } = await supabaseAdmin
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
          is_active,
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
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Booking not found' }
        });
      }
      console.error('[Supabase ERROR] Failed to fetch booking:', error.message);
      throw new Error(`Failed to fetch booking: ${error.message}`);
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
