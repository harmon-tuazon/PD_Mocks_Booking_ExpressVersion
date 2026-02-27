/**
 * Create Work Check Booking Controller
 * POST /api/admin/work-check-bookings
 * Permission: 'workcheck.create'
 */

const { requirePermission } = require('../../middleware/requirePermission');
const { db } = require('../../services/supabase');
const { query: dbQuery, nestRow } = require('../../services/database');

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
    const { data: slot, error: slotError } = await db
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
    const { data: student, error: studentError } = await db
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

    const { data: groupMembership, error: groupError } = await db
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
    const { count: bookedCount, error: countError } = await db
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
    const { data: existingBooking, error: existingError } = await db
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

    // Insert booking (shim handles simple INSERT fine)
    const { data: insertedBooking, error: insertError } = await db
      .from('work_check_bookings')
      .insert(bookingData)
      .select('*')
      .single();

    if (insertError) {
      console.error('[DB ERROR] Failed to create booking:', insertError.message);
      throw new Error(`Failed to create booking: ${insertError.message}`);
    }

    // Fetch the full booking with slot + instructor via raw SQL
    let newBooking;
    try {
      const { rows } = await dbQuery(`
        SELECT b.*,
               s.id AS s__id, s.slot_date AS s__slot_date, s.slot_time AS s__slot_time,
               s.duration_minutes AS s__duration_minutes, s.location AS s__location,
               s.auto_approve AS s__auto_approve,
               i.id AS i__id, i.instructor_name AS i__instructor_name
        FROM work_check_bookings b
        LEFT JOIN work_check_slots s ON s.id = b.slot_id
        LEFT JOIN instructors i ON i.id = s.instructor_id
        WHERE b.id = $1
      `, [insertedBooking.id]);
      newBooking = rows.length > 0 ? nestRow(rows[0], { s: 'slot', i: 'instructor' }, { i: 's' }) : insertedBooking;
    } catch (err) {
      // Fallback: use the basic inserted data with slot info we already have
      newBooking = {
        ...insertedBooking,
        slot: { id: slot.id, slot_date: slot.slot_date, slot_time: slot.slot_time,
                duration_minutes: null, location: slot.location, auto_approve: slot.auto_approve,
                instructor: null }
      };
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
