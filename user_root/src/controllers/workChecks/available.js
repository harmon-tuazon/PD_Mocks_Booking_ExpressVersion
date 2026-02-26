/**
 * GET /api/work-checks/available
 * Get available work check slots for user's groups
 * Automatically filters out slots on dates where user already has a booking
 */

const { schemas } = require('../../services/validation');
const { db } = require('../../services/supabase');
const { query: dbQuery, nestRow } = require('../../services/database');

const available = async (req, res, next) => {
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

    console.log(`[WORK-CHECK] Fetching available slots for: ${student_id}, today: ${new Date().toISOString().split('T')[0]}`);

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

    // 2. Get user's active groups
    const { data: groupMemberships, error: groupError } = await db
      .from('groups_students')
      .select('group_id')
      .eq('student_id', contact.student_id)
      .eq('status', 'active');

    if (groupError) {
      console.error('[WORK-CHECK] Error fetching groups:', groupError);
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

    // 3. Get existing booking dates for this user (raw SQL with INNER JOIN)
    let existingBookings;
    try {
      const { rows } = await dbQuery(`
        SELECT b.id, s.slot_date AS s__slot_date
        FROM work_check_bookings b
        INNER JOIN work_check_slots s ON s.id = b.slot_id
        WHERE b.student_id = $1 AND b.status = ANY($2)
      `, [contact.student_id, ['pending', 'confirmed']]);
      existingBookings = rows.map(r => nestRow(r, { s: 'work_check_slots' }));
    } catch (err) {
      existingBookings = [];
    }

    const existingBookingDates = (existingBookings || [])
      .map(b => b.work_check_slots?.slot_date)
      .filter(Boolean);

    // 4. Build query for available slots (raw SQL with LEFT JOIN for instructor)
    const todayStr = new Date().toISOString().split('T')[0];
    const nowIso = new Date().toISOString();
    let slotSql = `
      SELECT s.id, s.instructor_id, s.group_id, s.slot_date, s.slot_time,
             s.duration_minutes, s.total_slots, s.location, s.is_active,
             s.available_from, s.auto_approve,
             i.id AS i__id, i.instructor_name AS i__instructor_name
      FROM work_check_slots s
      LEFT JOIN instructors i ON i.id = s.instructor_id
      WHERE s.is_active = true AND s.slot_date >= $1
        AND (s.available_from IS NULL OR s.available_from <= $2)
    `;
    const slotParams = [todayStr, nowIso];
    let paramIdx = 3;

    if (from_date) {
      slotSql += ` AND s.slot_date >= $${paramIdx}`;
      slotParams.push(from_date);
      paramIdx++;
    }
    if (to_date) {
      slotSql += ` AND s.slot_date <= $${paramIdx}`;
      slotParams.push(to_date);
      paramIdx++;
    }

    slotSql += ` ORDER BY s.slot_date ASC, s.slot_time ASC`;

    let allSlots, slotsError;
    try {
      const { rows } = await dbQuery(slotSql, slotParams);
      allSlots = rows.map(r => nestRow(r, { i: 'instructors' }));
      slotsError = null;
    } catch (err) {
      allSlots = null;
      slotsError = { message: err.message };
    }

    if (slotsError) {
      console.error('[WORK-CHECK] Error fetching slots:', slotsError);
      throw slotsError;
    }

    // 5. Filter slots by group membership (group_id is an array)
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
      const { data: bookings } = await db
        .from('work_check_bookings')
        .select('slot_id')
        .in('slot_id', slotIds)
        .in('status', ['pending', 'confirmed']);

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
      const { data: groups } = await db
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

    console.log(`[WORK-CHECK] Found ${formattedSlots.length} slots for ${student_id}`);

    return res.status(200).json({
      success: true,
      data: {
        groups: userGroups,
        slots: formattedSlots,
        existing_booking_dates: existingBookingDates
      }
    });

  } catch (error) {
    console.error('[WORK-CHECK] Available slots error:', error);
    next(error);
  }
};

module.exports = { available };
