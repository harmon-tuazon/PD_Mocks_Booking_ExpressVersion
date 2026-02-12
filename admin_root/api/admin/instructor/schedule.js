/**
 * GET /api/admin/instructor/schedule
 * Upcoming instruction schedule for the logged-in instructor
 * Role: 'instructor'
 */

const { requireRole } = require('../middleware/requireRole');
const { getInstructorFromUser } = require('../../_shared/instructor-helpers');
const { supabaseAdmin } = require('../../_shared/supabase');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: `Method ${req.method} not allowed` }
    });
  }

  try {
    const user = await requireRole(req, 'instructor');
    const instructor = await getInstructorFromUser(user);

    // Parse query params with defaults
    const days = Math.min(Math.max(parseInt(req.query.days) || 30, 1), 90);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);

    // Calculate date range
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + days);

    const todayStr = today.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // Fetch upcoming work_check_slots for this instructor
    const { data: slots, error: slotsError } = await supabaseAdmin
      .from('work_check_slots')
      .select('id, slot_date, slot_time, duration_minutes, group_id, is_active')
      .eq('instructor_id', instructor.id)
      .eq('is_active', true)
      .gte('slot_date', todayStr)
      .lte('slot_date', endDateStr)
      .order('slot_date', { ascending: true })
      .order('slot_time', { ascending: true })
      .limit(limit);

    if (slotsError) {
      console.error('[Instructor Schedule] Error fetching slots:', slotsError.message);
      throw new Error('Failed to fetch schedule');
    }

    if (!slots || slots.length === 0) {
      return res.status(200).json({
        success: true,
        data: { schedule: [], total_sessions: 0 }
      });
    }

    // Collect all unique group IDs from slots (group_id is VARCHAR array)
    const allGroupIds = new Set();
    for (const slot of slots) {
      const gids = slot.group_id || [];
      gids.forEach(gid => allGroupIds.add(gid));
    }

    // Fetch group details for all referenced groups
    let groupMap = {};
    if (allGroupIds.size > 0) {
      const { data: groups } = await supabaseAdmin
        .from('groups')
        .select('group_id, group_name, time_period, status')
        .in('group_id', Array.from(allGroupIds));

      groupMap = (groups || []).reduce((acc, g) => {
        acc[g.group_id] = g;
        return acc;
      }, {});
    }

    // Count students per group
    const studentCounts = {};
    for (const gid of allGroupIds) {
      const { count } = await supabaseAdmin
        .from('groups_students')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', gid)
        .eq('status', 'active');
      studentCounts[gid] = count || 0;
    }

    // Group slots by date
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dateMap = new Map();

    for (const slot of slots) {
      const dateKey = slot.slot_date;
      if (!dateMap.has(dateKey)) {
        const d = new Date(dateKey + 'T00:00:00');
        dateMap.set(dateKey, {
          date: dateKey,
          day_of_week: dayNames[d.getUTCDay()],
          sessions: []
        });
      }

      const groupIds = slot.group_id || [];
      const groups = groupIds.map(gid => {
        const g = groupMap[gid];
        return {
          group_id: gid,
          group_name: g?.group_name || gid,
          time_period: g?.time_period || null,
          status: g?.status || null,
          student_count: studentCounts[gid] || 0
        };
      });

      dateMap.get(dateKey).sessions.push({
        slot_id: slot.id,
        time: slot.slot_time,
        duration_minutes: slot.duration_minutes,
        groups
      });
    }

    const schedule = Array.from(dateMap.values());

    return res.status(200).json({
      success: true,
      data: {
        schedule,
        total_sessions: slots.length
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
