/**
 * GET /api/admin/instructor/analytics
 * Instructor analytics: KPIs, status/type breakdowns, weekly trends,
 * group performance, busiest days/times.
 * Role: 'instructor' (own analytics) or 'admin' (any instructor via instructor_id param)
 */

const { requireRole } = require('../../middleware/requireRole');
const { requireAuth } = require('../../middleware/requireAuth');
const { getInstructorFromUser } = require('../../services/instructor-helpers');
const { db } = require('../../services/supabase');
const { instructorAnalytics } = require('../../services/validation');

const analytics = async (req, res, next) => {
  try {
    // ---- Validate query params ----
    // (validate first so instructor_id is available for auth routing)
    const { error: validationError, value } = instructorAnalytics.validate(req.query);
    if (validationError) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: validationError.details[0].message }
      });
    }

    // ---- Auth ----
    let instructor;

    if (value.instructor_id) {
      // Admin path: admin user viewing a specific instructor's analytics
      // Verify the caller is authenticated (admin-level)
      await requireAuth(req);

      const { data: instructorData, error: instructorError } = await db
        .from('instructors')
        .select('id, instructor_name, email, is_active')
        .eq('id', value.instructor_id)
        .single();

      if (instructorError || !instructorData) {
        return res.status(404).json({
          success: false,
          error: { code: 'INSTRUCTOR_NOT_FOUND', message: 'Instructor not found' }
        });
      }

      instructor = instructorData;
    } else {
      // Instructor portal path: instructor viewing their own analytics
      const user = await requireRole(req, 'instructor');
      instructor = await getInstructorFromUser(user);
    }

    const today = new Date().toISOString().split('T')[0];

    const dateFrom = value.date_from || null;
    const dateTo = value.date_to || null;
    const filterGroupId = value.group_id || null;
    const filterCycle = value.cycle || null;

    // ---- Cycle -> group_ids resolution ----
    let cycleGroupIds = null;
    if (filterCycle) {
      const { data: cycleGroups, error: cycleErr } = await db
        .from('groups')
        .select('group_id')
        .eq('cycle', filterCycle);

      if (cycleErr) {
        console.error('[Instructor Analytics] Error fetching cycle groups:', cycleErr.message);
        throw new Error('Failed to fetch groups for the specified cycle');
      }
      cycleGroupIds = (cycleGroups || []).map(g => g.group_id);

      // If no groups match the cycle, return early with zeros
      if (cycleGroupIds.length === 0) {
        return res.status(200).json({
          success: true,
          data: buildEmptyResponse(dateFrom, dateTo)
        });
      }
    }

    // ---- Fetch instructor's slots ----
    let slotsQuery = db
      .from('work_check_slots')
      .select('id, slot_date, slot_time, group_id, duration_minutes, location, total_slots')
      .eq('instructor_id', instructor.id)
      .eq('is_active', true);

    if (dateFrom) slotsQuery = slotsQuery.gte('slot_date', dateFrom);
    if (dateTo) slotsQuery = slotsQuery.lte('slot_date', dateTo);

    if (filterGroupId) {
      slotsQuery = slotsQuery.contains('group_id', [filterGroupId]);
    }
    if (cycleGroupIds) {
      slotsQuery = slotsQuery.overlaps('group_id', cycleGroupIds);
    }

    const { data: slots, error: slotsError } = await slotsQuery;

    if (slotsError) {
      console.error('[Instructor Analytics] Error fetching slots:', slotsError.message);
      throw new Error('Failed to fetch work check slots');
    }

    if (!slots || slots.length === 0) {
      return res.status(200).json({
        success: true,
        data: buildEmptyResponse(dateFrom, dateTo)
      });
    }

    const slotIds = slots.map(s => s.id);

    // ---- Fetch bookings for those slots ----
    const { data: bookings, error: bookingsError } = await db
      .from('work_check_bookings')
      .select('id, slot_id, student_id, status, type, created_at, confirmed_at, cancelled_at, marked_at')
      .in('slot_id', slotIds);

    if (bookingsError) {
      console.error('[Instructor Analytics] Error fetching bookings:', bookingsError.message);
      throw new Error('Failed to fetch bookings');
    }

    const allBookings = bookings || [];

    // Build a slot lookup for quick access
    const slotMap = {};
    for (const slot of slots) {
      slotMap[slot.id] = slot;
    }

    // ---- KPIs ----
    const totalSessions = slots.length;
    const totalBookings = allBookings.length;

    const markedCount = allBookings.filter(b => b.status === 'marked').length;
    const completedCount = allBookings.filter(b => b.status === 'completed').length;
    const cancelledCount = allBookings.filter(b => b.status === 'cancelled').length;
    const confirmedCount = allBookings.filter(b => b.status === 'confirmed').length;

    // attendance_rate = (marked + completed) / (confirmed + marked + completed) * 100
    const attendedDenom = confirmedCount + markedCount + completedCount;
    const attendanceRate = attendedDenom > 0
      ? round1((markedCount + completedCount) / attendedDenom * 100)
      : 0.0;

    // cancellation_rate = cancelled / total * 100
    const cancellationRate = totalBookings > 0
      ? round1(cancelledCount / totalBookings * 100)
      : 0.0;

    // no_show_rate: confirmed bookings on past dates / (confirmed on past + marked on past) * 100
    const pastConfirmed = allBookings.filter(b => {
      const slot = slotMap[b.slot_id];
      return b.status === 'confirmed' && slot && slot.slot_date < today;
    }).length;
    const pastMarked = allBookings.filter(b => {
      const slot = slotMap[b.slot_id];
      return b.status === 'marked' && slot && slot.slot_date < today;
    }).length;
    const pastCompleted = allBookings.filter(b => {
      const slot = slotMap[b.slot_id];
      return b.status === 'completed' && slot && slot.slot_date < today;
    }).length;
    const noShowDenom = pastConfirmed + pastMarked + pastCompleted;
    const noShowRate = noShowDenom > 0
      ? round1(pastConfirmed / noShowDenom * 100)
      : 0.0;

    // ---- Status breakdown ----
    const statusBreakdown = {};
    for (const b of allBookings) {
      statusBreakdown[b.status] = (statusBreakdown[b.status] || 0) + 1;
    }

    // ---- Type breakdown ----
    const typeBreakdown = {};
    for (const b of allBookings) {
      if (b.type) {
        typeBreakdown[b.type] = (typeBreakdown[b.type] || 0) + 1;
      }
    }

    // ---- Weekly trends ----
    // Group bookings by ISO week (week_start = Monday)
    const weekMap = {};
    for (const b of allBookings) {
      const slot = slotMap[b.slot_id];
      if (!slot) continue;
      const weekStart = getMonday(slot.slot_date);
      if (!weekMap[weekStart]) {
        weekMap[weekStart] = { bookings: 0, marked: 0, cancelled: 0, attendedDenom: 0, attended: 0 };
      }
      weekMap[weekStart].bookings += 1;
      if (b.status === 'marked' || b.status === 'completed') {
        weekMap[weekStart].marked += 1;
        weekMap[weekStart].attended += 1;
        weekMap[weekStart].attendedDenom += 1;
      }
      if (b.status === 'cancelled') {
        weekMap[weekStart].cancelled += 1;
      }
      if (b.status === 'confirmed') {
        weekMap[weekStart].attendedDenom += 1;
      }
    }

    const weeklyTrends = Object.keys(weekMap)
      .sort()
      .map(weekStart => {
        const w = weekMap[weekStart];
        return {
          week_start: weekStart,
          bookings: w.bookings,
          marked: w.marked,
          cancelled: w.cancelled,
          attendance_rate: w.attendedDenom > 0
            ? round1(w.attended / w.attendedDenom * 100)
            : 0.0
        };
      });

    // ---- Group performance ----
    // Collect group_ids from slots AND from instructor's assigned groups
    const uniqueGroupIds = new Set();
    for (const slot of slots) {
      if (Array.isArray(slot.group_id)) {
        for (const gid of slot.group_id) {
          uniqueGroupIds.add(gid);
        }
      }
    }

    // Also fetch all groups assigned to this instructor (may include groups without slots)
    const { data: instructorAssignments } = await db
      .from('groups_instructors')
      .select('group_id')
      .eq('instructor_id', instructor.id)
      .eq('status', 'active');

    for (const a of (instructorAssignments || [])) {
      uniqueGroupIds.add(a.group_id);
    }

    const groupPerformance = [];
    if (uniqueGroupIds.size > 0) {
      const groupIdArray = [...uniqueGroupIds];

      // Fetch group info
      const { data: groupsData } = await db
        .from('groups')
        .select('group_id, group_name')
        .in('group_id', groupIdArray);

      const groupNameMap = {};
      for (const g of (groupsData || [])) {
        groupNameMap[g.group_id] = g.group_name;
      }

      // Fetch enrolled student counts per group
      const { data: enrollments } = await db
        .from('groups_students')
        .select('group_id, student_id')
        .in('group_id', groupIdArray)
        .eq('status', 'active');

      const enrolledCountMap = {};
      for (const e of (enrollments || [])) {
        enrolledCountMap[e.group_id] = (enrolledCountMap[e.group_id] || 0) + 1;
      }

      // Count bookings per group
      for (const gid of groupIdArray) {
        // Find slots that contain this group_id
        const groupSlotIds = slots
          .filter(s => Array.isArray(s.group_id) && s.group_id.includes(gid))
          .map(s => s.id);

        const groupBookings = allBookings.filter(b => groupSlotIds.includes(b.slot_id));
        const gTotalBookings = groupBookings.length;
        const gAttended = groupBookings.filter(b => b.status === 'marked' || b.status === 'completed').length;
        const gCancelled = groupBookings.filter(b => b.status === 'cancelled').length;
        const gConfirmed = groupBookings.filter(b => b.status === 'confirmed').length;
        const enrolled = enrolledCountMap[gid] || 0;

        // participation_rate = unique students who booked / enrolled * 100
        const uniqueStudents = new Set(groupBookings.map(b => b.student_id)).size;
        const participationRate = enrolled > 0
          ? round1(uniqueStudents / enrolled * 100)
          : 0.0;

        // attendance_rate = attended / (confirmed + attended) * 100
        const gAttDenom = gConfirmed + gAttended;
        const gAttendanceRate = gAttDenom > 0
          ? round1(gAttended / gAttDenom * 100)
          : 0.0;

        groupPerformance.push({
          group_id: gid,
          group_name: groupNameMap[gid] || gid,
          enrolled_students: enrolled,
          total_bookings: gTotalBookings,
          attended: gAttended,
          cancelled: gCancelled,
          participation_rate: participationRate,
          attendance_rate: gAttendanceRate
        });
      }
    }

    // ---- Busiest days ----
    // Average bookings per day of week across the date range
    const dayBookingsMap = {}; // day name -> total bookings
    const dayWeeksMap = {}; // day name -> set of week identifiers

    for (const b of allBookings) {
      const slot = slotMap[b.slot_id];
      if (!slot) continue;
      const dayName = getDayName(slot.slot_date);
      const weekKey = getMonday(slot.slot_date);

      if (!dayBookingsMap[dayName]) {
        dayBookingsMap[dayName] = 0;
        dayWeeksMap[dayName] = new Set();
      }
      dayBookingsMap[dayName] += 1;
      dayWeeksMap[dayName].add(weekKey);
    }

    const busiestDays = Object.keys(dayBookingsMap)
      .map(day => {
        const weeksCount = dayWeeksMap[day].size || 1;
        return {
          day,
          avg_bookings: round1(dayBookingsMap[day] / weeksCount)
        };
      })
      .sort((a, b) => b.avg_bookings - a.avg_bookings);

    // ---- Busiest times ----
    const timeBookingsMap = {};
    const timeWeeksMap = {};

    for (const b of allBookings) {
      const slot = slotMap[b.slot_id];
      if (!slot) continue;
      // Normalize time to HH:MM
      const time = (slot.slot_time || '').substring(0, 5);
      const weekKey = getMonday(slot.slot_date);

      if (!timeBookingsMap[time]) {
        timeBookingsMap[time] = 0;
        timeWeeksMap[time] = new Set();
      }
      timeBookingsMap[time] += 1;
      timeWeeksMap[time].add(weekKey);
    }

    const busiestTimes = Object.keys(timeBookingsMap)
      .map(time => {
        const weeksCount = timeWeeksMap[time].size || 1;
        return {
          time,
          avg_bookings: round1(timeBookingsMap[time] / weeksCount)
        };
      })
      .sort((a, b) => b.avg_bookings - a.avg_bookings);

    // ---- Return response ----
    return res.status(200).json({
      success: true,
      data: {
        period: { date_from: dateFrom || 'all', date_to: dateTo || today },
        kpis: {
          total_sessions: totalSessions,
          total_bookings: totalBookings,
          attendance_rate: attendanceRate,
          cancellation_rate: cancellationRate,
          no_show_rate: noShowRate
        },
        status_breakdown: statusBreakdown,
        type_breakdown: typeBreakdown,
        weekly_trends: weeklyTrends,
        group_performance: groupPerformance,
        busiest_days: busiestDays,
        busiest_times: busiestTimes
      }
    });

  } catch (error) {
    next(error);
  }
};

// ---- Helper functions ----

/**
 * Round a number to 1 decimal place.
 */
function round1(val) {
  return Math.round(val * 10) / 10;
}

/**
 * Get the Monday (ISO week start) for a given date string (YYYY-MM-DD).
 * Returns YYYY-MM-DD string.
 */
function getMonday(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  const day = d.getUTCDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? 6 : day - 1; // days since Monday
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().split('T')[0];
}

/**
 * Get the English day name for a date string (YYYY-MM-DD).
 */
function getDayName(dateStr) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const d = new Date(dateStr + 'T00:00:00Z');
  return days[d.getUTCDay()];
}

/**
 * Build an empty analytics response when no data matches filters.
 */
function buildEmptyResponse(dateFrom, dateTo) {
  return {
    period: { date_from: dateFrom, date_to: dateTo },
    kpis: {
      total_sessions: 0,
      total_bookings: 0,
      attendance_rate: 0.0,
      cancellation_rate: 0.0,
      no_show_rate: 0.0
    },
    status_breakdown: {},
    type_breakdown: {},
    weekly_trends: [],
    group_performance: [],
    busiest_days: [],
    busiest_times: []
  };
}

module.exports = { analytics };
