/**
 * Create Work Check Booking Controller
 * POST /api/admin/work-check-bookings
 * Permission: 'workcheck.create'
 */

const { requirePermission } = require('../../middleware/requirePermission');
const { supabaseAdmin } = require('../../services/supabase');

const create = async (req, res, next) => {
  console.log('[Work Check Booking Create] Endpoint hit:', req.method);

  try {
    // Verify admin authentication and permission
    await requirePermission(req, 'workcheck.create');

    const {
      slot_id,
      student_id,
      type = 'Work Check'
    } = req.validatedData || req.body;

    console.log(`[Work Check Booking Create] Creating booking for student ${student_id} in slot ${slot_id}`);

    // Fetch the slot to check auto_approve setting and capacity
    const { data: slot, error: slotError } = await supabaseAdmin
      .from('work_check_slots')
      .select('id, auto_approve, slot_date, slot_time, location, is_active, group_id, total_slots')
      .eq('id', slot_id)
      .single();

    if (slotError || !slot) {
      console.error('[Supabase ERROR] Slot not found:', slotError?.message);
      return res.status(404).json({
        success: false,
        error: { code: 'SLOT_NOT_FOUND', message: 'The selected slot does not exist' }
      });
    }

    // Verify slot is active
    if (!slot.is_active) {
      return res.status(400).json({
        success: false,
        error: { code: 'SLOT_INACTIVE', message: 'Cannot create booking for an inactive slot' }
      });
    }

    // Check slot date is not in the past
    const slotDate = new Date(slot.slot_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (slotDate < today) {
      return res.status(400).json({
        success: false,
        error: { code: 'SLOT_EXPIRED', message: 'Cannot create booking for a past date' }
      });
    }

    // Verify student exists
    const { data: student, error: studentError } = await supabaseAdmin
      .from('hubspot_contact_credits')
      .select('id, student_id, firstname, lastname, email')
      .eq('id', student_id)
      .single();

    if (studentError || !student) {
      console.error('[Supabase ERROR] Student not found:', studentError?.message);
      return res.status(404).json({
        success: false,
        error: { code: 'STUDENT_NOT_FOUND', message: 'The selected student does not exist' }
      });
    }

    // Verify student is in one of the slot's groups
    const slotGroups = Array.isArray(slot.group_id) ? slot.group_id : [slot.group_id];

    const { data: groupMembership, error: groupError } = await supabaseAdmin
      .from('groups_students')
      .select('id, group_id')
      .eq('student_id', student.student_id)  // Use student_id string, not UUID
      .in('group_id', slotGroups)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (groupError) {
      console.error('[Supabase ERROR] Failed to check group membership:', groupError.message);
    }

    if (!groupMembership) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'NOT_IN_GROUP',
          message: 'Student is not enrolled in any group assigned to this slot'
        }
      });
    }

    // Check slot capacity
    const { count: bookedCount, error: countError } = await supabaseAdmin
      .from('work_check_bookings')
      .select('*', { count: 'exact', head: true })
      .eq('slot_id', slot_id)
      .in('status', ['pending', 'confirmed']);

    if (countError) {
      console.error('[Supabase ERROR] Failed to count bookings:', countError.message);
      throw new Error('Failed to check slot capacity');
    }

    if (bookedCount >= slot.total_slots) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'SLOT_FULL',
          message: `Slot is at capacity (${bookedCount}/${slot.total_slots} booked)`
        }
      });
    }

    // Check for existing booking (prevent duplicates)
    // Note: work_check_bookings.student_id is the string ID, not UUID
    const { data: existingBooking, error: existingError } = await supabaseAdmin
      .from('work_check_bookings')
      .select('id')
      .eq('slot_id', slot_id)
      .eq('student_id', student.student_id)
      .maybeSingle();

    if (existingError) {
      console.error('[Supabase ERROR] Failed to check existing booking:', existingError.message);
    }

    if (existingBooking) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_BOOKING',
          message: 'A booking already exists for this student in the selected slot'
        }
      });
    }

    // Determine status based on slot's auto_approve setting
    const shouldAutoApprove = slot.auto_approve !== false;
    const bookingStatus = shouldAutoApprove ? 'confirmed' : 'pending';
    const confirmedAt = bookingStatus === 'confirmed' ? new Date().toISOString() : null;

    console.log(`[Work Check Booking Create] Slot auto_approve: ${slot.auto_approve}, setting status: ${bookingStatus}`);

    // Create the booking
    // Note: work_check_bookings.student_id references hubspot_contact_credits.student_id (string), not id (UUID)
    const bookingData = {
      slot_id,
      student_id: student.student_id,
      status: bookingStatus,
      type,
      created_at: new Date().toISOString(),
      confirmed_at: confirmedAt,
      cancelled_at: null
    };

    const { data: newBooking, error: insertError } = await supabaseAdmin
      .from('work_check_bookings')
      .insert(bookingData)
      .select(`
        *,
        slot:work_check_slots!work_check_bookings_slot_id_fkey (
          id,
          slot_date,
          slot_time,
          duration_minutes,
          location,
          auto_approve,
          instructor:instructors!work_check_slots_instructor_id_fkey (
            id,
            instructor_name
          )
        )
      `)
      .single();

    if (insertError) {
      console.error('[Supabase ERROR] Failed to create booking:', insertError.message);
      throw new Error(`Failed to create booking: ${insertError.message}`);
    }

    // Transform response
    const responseData = {
      id: newBooking.id,
      slot_id: newBooking.slot_id,
      student_id: newBooking.student_id,
      student_name: `${student.firstname || ''} ${student.lastname || ''}`.trim(),
      student_email: student.email,
      status: newBooking.status,
      type: newBooking.type,
      created_at: newBooking.created_at,
      confirmed_at: newBooking.confirmed_at,
      cancelled_at: newBooking.cancelled_at,
      slot: newBooking.slot ? {
        id: newBooking.slot.id,
        slot_date: newBooking.slot.slot_date,
        slot_time: newBooking.slot.slot_time,
        duration_minutes: newBooking.slot.duration_minutes,
        location: newBooking.slot.location,
        auto_approve: newBooking.slot.auto_approve,
        instructor_name: newBooking.slot.instructor?.instructor_name || null
      } : null
    };

    console.log(`[Work Check Booking Create] Successfully created booking ${newBooking.id} with status: ${bookingStatus}`);

    res.status(201).json({
      success: true,
      message: `Booking created successfully${shouldAutoApprove ? ' and auto-confirmed' : ' (pending approval)'}`,
      data: responseData
    });

  } catch (error) {
    next(error);
  }
};

module.exports = { create };
