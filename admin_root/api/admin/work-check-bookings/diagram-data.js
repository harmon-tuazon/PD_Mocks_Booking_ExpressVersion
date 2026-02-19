/**
 * GET /api/admin/work-check-bookings/diagram-data
 * Returns bookings enriched with group_name for seating diagram rendering.
 * Fetches all active bookings for a given date, resolves each student's group,
 * and returns data organized by group with AM/PM sessions.
 * Permission: 'workcheck.view'
 */

const { requirePermission } = require('../middleware/requirePermission');
const { supabaseAdmin } = require('../../_shared/supabase');

module.exports = async (req, res) => {
  console.log('[Diagram Data] Endpoint hit:', req.method, req.url);

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: `Method ${req.method} not allowed` }
    });
  }

  try {
    await requirePermission(req, 'workcheck.view');

    const { date } = req.query;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_DATE', message: 'A valid date parameter (YYYY-MM-DD) is required' }
      });
    }

    console.log('[Diagram Data] Fetching for date:', date);

    // Step 1: Fetch all slots for the date with instructor info
    const { data: slots, error: slotsError } = await supabaseAdmin
      .from('work_check_slots')
      .select(`
        id,
        slot_date,
        slot_time,
        duration_minutes,
        location,
        group_id,
        instructor_id,
        instructor:instructors!work_check_slots_instructor_id_fkey (
          id,
          instructor_name
        )
      `)
      .eq('slot_date', date);

    if (slotsError) {
      throw new Error(`Failed to fetch slots: ${slotsError.message}`);
    }

    console.log(`[Diagram Data] Found ${slots?.length || 0} slots for date ${date}`);

    if (!slots || slots.length === 0) {
      return res.status(200).json({
        success: true,
        data: { date, slot_times: { AM: [], PM: [] }, groups: [] }
      });
    }

    // Build master list of all slot times for the date
    const slotTimesSet = { AM: new Set(), PM: new Set() };
    for (const slot of slots) {
      const time = slot.slot_time.substring(0, 5);
      const hour = parseInt(time.split(':')[0], 10);
      const session = hour < 12 ? 'AM' : 'PM';
      slotTimesSet[session].add(time);
    }
    const slotTimes = {
      AM: [...slotTimesSet.AM].sort(),
      PM: [...slotTimesSet.PM].sort()
    };

    const slotIds = slots.map(s => s.id);
    const slotMap = new Map(slots.map(s => [s.id, s]));

    // Step 2: Fetch bookings with diagram-relevant statuses only
    const { data: bookings, error: bookingsError } = await supabaseAdmin
      .from('work_check_bookings')
      .select(`
        id,
        slot_id,
        student_id,
        status,
        type,
        student:hubspot_contact_credits!work_check_bookings_student_id_fkey (
          student_id,
          firstname,
          lastname
        )
      `)
      .in('slot_id', slotIds)
      .in('status', ['confirmed', 'completed', 'marked']);

    if (bookingsError) {
      throw new Error(`Failed to fetch bookings: ${bookingsError.message}`);
    }

    console.log(`[Diagram Data] Found ${bookings?.length || 0} bookings for ${slotIds.length} slots`);

    if (!bookings || bookings.length === 0) {
      return res.status(200).json({
        success: true,
        data: { date, slot_times: slotTimes, groups: [] }
      });
    }

    // Step 3: Get all student_ids to look up their group memberships
    const studentIds = [...new Set(bookings.map(b => b.student_id).filter(Boolean))];

    // Step 4: Fetch group memberships for these students
    const studentGroupsMap = {}; // student_id -> [group_ids]
    if (studentIds.length > 0) {
      const { data: memberships, error: memberError } = await supabaseAdmin
        .from('groups_students')
        .select('student_id, group_id')
        .in('student_id', studentIds)
        .eq('status', 'active');

      if (!memberError && memberships) {
        for (const m of memberships) {
          if (!studentGroupsMap[m.student_id]) studentGroupsMap[m.student_id] = [];
          studentGroupsMap[m.student_id].push(m.group_id);
        }
      }
    }

    // Step 5: Collect all group_ids and fetch group details
    const allGroupIds = new Set();
    for (const gids of Object.values(studentGroupsMap)) {
      gids.forEach(gid => allGroupIds.add(gid));
    }
    for (const slot of slots) {
      if (slot.group_id && Array.isArray(slot.group_id)) {
        slot.group_id.forEach(gid => allGroupIds.add(gid));
      }
    }

    let groupDetailsMap = {};
    if (allGroupIds.size > 0) {
      const { data: groups, error: groupsError } = await supabaseAdmin
        .from('groups')
        .select('id, group_id, group_name, max_capacity')
        .in('group_id', [...allGroupIds]);

      if (!groupsError && groups) {
        groupDetailsMap = Object.fromEntries(groups.map(g => [g.group_id, g]));
      }
    }

    // Step 6: Also resolve instructor per group from slots
    // Map: group_id -> instructor_name (from slots that serve that group)
    const groupInstructorMap = {};
    for (const slot of slots) {
      if (!slot.group_id || !Array.isArray(slot.group_id)) continue;
      const instructorName = slot.instructor?.instructor_name || null;
      if (!instructorName) continue;
      for (const gid of slot.group_id) {
        if (!groupInstructorMap[gid]) {
          groupInstructorMap[gid] = instructorName;
        }
      }
    }

    // Step 7: Build group columns
    const groupColumns = {};

    for (const booking of bookings) {
      const slot = slotMap.get(booking.slot_id);
      if (!slot) continue;

      const studentName = booking.student
        ? `${booking.student.firstname || ''} ${booking.student.lastname || ''}`.trim()
        : 'Unknown';

      const slotTime = slot.slot_time.substring(0, 5); // "08:00"
      const hour = parseInt(slotTime.split(':')[0], 10);
      const session = hour < 12 ? 'AM' : 'PM';

      // Resolve student's group: intersect student groups with slot groups
      const studentGroups = studentGroupsMap[booking.student_id] || [];
      const slotGroups = slot.group_id || [];
      const matchingGroups = studentGroups.filter(gid => slotGroups.includes(gid));
      const resolvedGroupId = matchingGroups.length > 0 ? matchingGroups[0] : null;

      const groupId = resolvedGroupId || '__unassigned__';
      const groupDetail = groupDetailsMap[resolvedGroupId] || null;

      if (!groupColumns[groupId]) {
        groupColumns[groupId] = {
          group_id: groupId,
          group_name: groupDetail?.group_name || 'Unassigned',
          instructor_name: groupInstructorMap[resolvedGroupId] || 'Unknown',
          max_capacity: groupDetail?.max_capacity || null,
          bookings: { AM: [], PM: [] }
        };
      }

      groupColumns[groupId].bookings[session].push({
        student_name: studentName,
        student_id: booking.student_id,
        slot_time: slotTime,
        type: booking.type,
        status: booking.status
      });
    }

    // Sort bookings within each group by slot_time
    for (const group of Object.values(groupColumns)) {
      group.bookings.AM.sort((a, b) => a.slot_time.localeCompare(b.slot_time));
      group.bookings.PM.sort((a, b) => a.slot_time.localeCompare(b.slot_time));
    }

    // Sort groups alphabetically, "Unassigned" last
    const sortedGroups = Object.values(groupColumns).sort((a, b) => {
      if (a.group_name === 'Unassigned') return 1;
      if (b.group_name === 'Unassigned') return -1;
      return a.group_name.localeCompare(b.group_name);
    });

    console.log(`[Diagram Data] Returning ${sortedGroups.length} groups with bookings for ${date}`);

    res.status(200).json({
      success: true,
      data: {
        date,
        slot_times: slotTimes,
        groups: sortedGroups
      }
    });

  } catch (error) {
    if (error.message.includes('authorization') || error.message.includes('token') || error.message.includes('Permission denied')) {
      const statusCode = error.statusCode || 401;
      return res.status(statusCode).json({
        success: false,
        error: { code: error.code || 'UNAUTHORIZED', message: error.message }
      });
    }

    console.error('Error in diagram data:', error);

    res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Failed to fetch diagram data'
    });
  }
};
