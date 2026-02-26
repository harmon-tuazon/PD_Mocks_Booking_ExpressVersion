/**
 * Work Check Booking Diagram Data Controller
 * GET /api/admin/work-check-bookings/diagram-data
 * Returns bookings enriched with group_name for seating diagram rendering.
 * Permission: 'workcheck.view'
 */

const { requirePermission } = require('../../middleware/requirePermission');
const { db } = require('../../services/supabase');
const { query: dbQuery, nestRow } = require('../../services/database');

const diagramData = async (req, res, next) => {
  console.log('[Diagram Data] Endpoint hit:', req.method, req.url);

  try {
    await requirePermission(req, 'workcheck.view');

    const { date } = req.validatedData || req.query;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_DATE', message: 'A valid date parameter (YYYY-MM-DD) is required' }
      });
    }

    console.log('[Diagram Data] Fetching for date:', date);

    // Step 1: Fetch bookings with slot + student data via raw SQL (date filter in WHERE)
    let bookings, bookingsError;
    try {
      const { rows } = await dbQuery(`
        SELECT b.id, b.slot_id, b.student_id, b.status, b.type,
               s.id AS s__id, s.slot_date AS s__slot_date, s.slot_time AS s__slot_time,
               s.duration_minutes AS s__duration_minutes, s.location AS s__location,
               s.group_id AS s__group_id, s.instructor_id AS s__instructor_id,
               i.id AS i__id, i.instructor_name AS i__instructor_name,
               c.student_id AS c__student_id, c.firstname AS c__firstname, c.lastname AS c__lastname
        FROM work_check_bookings b
        LEFT JOIN work_check_slots s ON s.id = b.slot_id
        LEFT JOIN instructors i ON i.id = s.instructor_id
        LEFT JOIN hubspot_contact_credits c ON c.student_id = b.student_id
        WHERE b.status = ANY($1) AND s.slot_date = $2
      `, [['confirmed', 'completed', 'marked'], date]);
      bookings = rows.map(r => nestRow(r, { s: 'slot', i: 'instructor', c: 'student' }, { i: 's' }));
      bookingsError = null;
    } catch (err) {
      bookings = null;
      bookingsError = { message: err.message };
    }

    if (bookingsError) {
      throw new Error(`Failed to fetch bookings: ${bookingsError.message}`);
    }

    console.log(`[Diagram Data] Bookings matching date ${date}: ${bookings?.length || 0}`);

    if (bookings.length === 0) {
      return res.status(200).json({
        success: true,
        data: { date, slot_times: { AM: [], PM: [] }, groups: [] }
      });
    }

    // Build slot map and time list from matched bookings' slots
    const slotMap = new Map();
    const slotTimesSet = { AM: new Set(), PM: new Set() };

    for (const booking of bookings) {
      if (!booking.slot) continue;
      slotMap.set(booking.slot.id, booking.slot);
      const time = booking.slot.slot_time.substring(0, 5);
      const hour = parseInt(time.split(':')[0], 10);
      slotTimesSet[hour < 12 ? 'AM' : 'PM'].add(time);
    }

    const slotTimes = {
      AM: [...slotTimesSet.AM].sort(),
      PM: [...slotTimesSet.PM].sort()
    };

    // Step 3: Get all student_ids to look up their group memberships
    const studentIds = [...new Set(bookings.map(b => b.student_id).filter(Boolean))];

    // Step 4: Fetch group memberships for these students
    const studentGroupsMap = {};
    if (studentIds.length > 0) {
      const { data: memberships, error: memberError } = await db
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
    for (const slot of slotMap.values()) {
      if (slot.group_id && Array.isArray(slot.group_id)) {
        slot.group_id.forEach(gid => allGroupIds.add(gid));
      }
    }

    let groupDetailsMap = {};
    if (allGroupIds.size > 0) {
      const { data: groups, error: groupsError } = await db
        .from('groups')
        .select('id, group_id, group_name, max_capacity')
        .in('group_id', [...allGroupIds]);

      if (!groupsError && groups) {
        groupDetailsMap = Object.fromEntries(groups.map(g => [g.group_id, g]));
      }
    }

    // Step 6: Resolve instructor per group from slots
    const groupInstructorMap = {};
    for (const slot of slotMap.values()) {
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
      const slot = booking.slot;
      if (!slot) continue;

      const studentName = booking.student
        ? `${booking.student.firstname || ''} ${booking.student.lastname || ''}`.trim()
        : 'Unknown';

      const slotTime = slot.slot_time.substring(0, 5);
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
    next(error);
  }
};

module.exports = { diagramData };
