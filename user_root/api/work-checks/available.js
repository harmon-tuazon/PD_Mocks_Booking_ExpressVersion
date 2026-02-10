/**
 * GET /api/work-checks/available
 * Get available work check slots for user's groups
 * Automatically filters out slots on dates where user already has a booking
 */

const { schemas } = require('../_shared/validation');
const { supabaseAdmin } = require('../_shared/supabase');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET requests are allowed' }
    });
  }

  try {
    // Validate query parameters
    const { error, value } = schemas.workCheckAvailable.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.details[0].message }
      });
    }

    const { student_id, email, group_id, from_date, to_date } = value;

    console.log(`🔍 [WORK-CHECK] Fetching available slots for: ${student_id}`);

    // 1. Validate contact
    const { data: contact, error: contactError } = await supabaseAdmin
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

    // 2. Get user's active groups
    const { data: groupMemberships, error: groupError } = await supabaseAdmin
      .from('groups_students')
      .select('group_id')
      .eq('student_id', contact.id)
      .eq('status', 'active');

    if (groupError) {
      console.error('❌ [WORK-CHECK] Error fetching groups:', groupError);
      throw groupError;
    }

    const userGroups = (groupMemberships || []).map(gm => gm.group_id);

    if (userGroups.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          groups: [],
          slots: [],
          existing_booking_dates: []
        }
      });
    }

    // 3. Get existing booking dates for this user
    const { data: existingBookings } = await supabaseAdmin
      .from('work_check_bookings')
      .select(`
        id,
        work_check_slots!inner (slot_date)
      `)
      .eq('student_id', contact.id)
      .in('status', ['pending', 'confirmed']);

    const existingBookingDates = (existingBookings || [])
      .map(b => b.work_check_slots?.slot_date)
      .filter(Boolean);

    // 4. Build query for available slots
    // Use PostgreSQL array overlap operator (&&) to find slots where group_id contains any of user's groups
    let slotsQuery = supabaseAdmin
      .from('work_check_slots')
      .select(`
        id,
        instructor_id,
        group_id,
        slot_date,
        slot_time,
        duration_minutes,
        total_slots,
        location,
        is_active,
        available_from,
        auto_approve,
        instructors (
          id,
          instructor_name
        )
      `)
      .eq('is_active', true)
      .gte('slot_date', new Date().toISOString().split('T')[0]) // Future dates only
      .or(`available_from.is.null,available_from.lte.${new Date().toISOString()}`); // Scheduled visibility

    // Apply date filters if provided
    if (from_date) {
      slotsQuery = slotsQuery.gte('slot_date', from_date);
    }
    if (to_date) {
      slotsQuery = slotsQuery.lte('slot_date', to_date);
    }

    // Order by date and time
    slotsQuery = slotsQuery.order('slot_date', { ascending: true }).order('slot_time', { ascending: true });

    const { data: allSlots, error: slotsError } = await slotsQuery;

    if (slotsError) {
      console.error('❌ [WORK-CHECK] Error fetching slots:', slotsError);
      throw slotsError;
    }

    // 5. Filter slots by group membership (group_id is an array)
    // A slot is available if any of its group_ids is in the user's groups
    let filteredSlots = (allSlots || []).filter(slot => {
      const slotGroups = Array.isArray(slot.group_id) ? slot.group_id : [slot.group_id];
      return slotGroups.some(g => userGroups.includes(g));
    });

    // Apply specific group filter if provided
    if (group_id) {
      filteredSlots = filteredSlots.filter(slot => {
        const slotGroups = Array.isArray(slot.group_id) ? slot.group_id : [slot.group_id];
        return slotGroups.includes(group_id);
      });
    }

    // 6. Get booking counts for each slot
    const slotIds = filteredSlots.map(s => s.id);
    let bookingCounts = {};

    if (slotIds.length > 0) {
      const { data: bookings } = await supabaseAdmin
        .from('work_check_bookings')
        .select('slot_id')
        .in('slot_id', slotIds)
        .in('status', ['pending', 'confirmed']);

      // Count bookings per slot
      (bookings || []).forEach(b => {
        bookingCounts[b.slot_id] = (bookingCounts[b.slot_id] || 0) + 1;
      });
    }

    // 7. Get group names for display
    const uniqueGroupIds = [...new Set(filteredSlots.flatMap(s =>
      Array.isArray(s.group_id) ? s.group_id : [s.group_id]
    ))];

    let groupNames = {};
    if (uniqueGroupIds.length > 0) {
      const { data: groups } = await supabaseAdmin
        .from('groups')
        .select('group_id, group_name')
        .in('group_id', uniqueGroupIds);

      (groups || []).forEach(g => {
        groupNames[g.group_id] = g.group_name;
      });
    }

    // 8. Format slots for response
    const formattedSlots = filteredSlots.map(slot => {
      const bookedCount = bookingCounts[slot.id] || 0;
      const availableSlots = slot.total_slots - bookedCount;
      const slotGroups = Array.isArray(slot.group_id) ? slot.group_id : [slot.group_id];

      // Find which of user's groups can book this slot
      const bookableGroup = slotGroups.find(g => userGroups.includes(g));

      // Calculate end time
      const [hours, minutes] = slot.slot_time.split(':').map(Number);
      const endDate = new Date();
      endDate.setHours(hours, minutes + slot.duration_minutes, 0, 0);
      const endTime = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;

      return {
        slot_id: slot.id,
        instructor_id: slot.instructor_id,
        instructor_name: slot.instructors?.instructor_name || 'TBD',
        group_id: bookableGroup,
        group_name: groupNames[bookableGroup] || bookableGroup,
        slot_date: slot.slot_date,
        slot_time: slot.slot_time,
        end_time: endTime,
        duration_minutes: slot.duration_minutes,
        location: slot.location,
        total_slots: slot.total_slots,
        available_slots: availableSlots,
        is_available: availableSlots > 0,
        has_conflict: existingBookingDates.includes(slot.slot_date),
        auto_approve: slot.auto_approve
      };
    });

    console.log(`✅ [WORK-CHECK] Found ${formattedSlots.length} slots for ${student_id}`);

    return res.status(200).json({
      success: true,
      data: {
        groups: userGroups,
        slots: formattedSlots,
        existing_booking_dates: existingBookingDates
      }
    });

  } catch (error) {
    console.error('❌ [WORK-CHECK] Available slots error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to load available slots' }
    });
  }
};
