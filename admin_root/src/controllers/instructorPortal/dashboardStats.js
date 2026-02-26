/**
 * GET /api/admin/instructor/dashboard/stats
 * Dashboard statistics for the logged-in instructor
 * Role: 'instructor'
 */

const { requireRole } = require('../../middleware/requireRole');
const { getInstructorFromUser } = require('../../services/instructor-helpers');
const { db } = require('../../services/supabase');

const dashboardStats = async (req, res, next) => {
  try {
    const user = await requireRole(req, 'instructor');
    const instructor = await getInstructorFromUser(user);

    // Get all active group assignments for this instructor
    const { data: assignments, error: assignError } = await db
      .from('groups_instructors')
      .select('group_id, status')
      .eq('instructor_id', instructor.id)
      .eq('status', 'active');

    if (assignError) {
      console.error('[Instructor Dashboard] Error fetching assignments:', assignError.message);
      throw new Error('Failed to fetch group assignments');
    }

    const groupIds = (assignments || []).map(a => a.group_id);

    // Get group details for assigned groups
    let activeGroups = 0;
    let totalTrainees = 0;
    let groups = [];

    if (groupIds.length > 0) {
      const { data: groupData, error: groupError } = await db
        .from('groups')
        .select('group_id, group_name, time_period, status, start_date, max_capacity')
        .in('group_id', groupIds);

      if (!groupError && groupData) {
        groups = groupData;
        activeGroups = groupData.filter(g => g.status === 'active').length;
      }

      // Count students across assigned groups (uses groups_students, matching admin pattern)
      const { count, error: traineeError } = await db
        .from('groups_students')
        .select('*', { count: 'exact', head: true })
        .in('group_id', groupIds)
        .eq('status', 'active');

      if (!traineeError) {
        totalTrainees = count || 0;
      }
    }

    // Get upcoming sessions from work_check_slots
    const today = new Date().toISOString().split('T')[0];
    const { data: upcomingSlots, error: slotsError } = await db
      .from('work_check_slots')
      .select('id, slot_date, slot_time, group_id')
      .eq('instructor_id', instructor.id)
      .eq('is_active', true)
      .gte('slot_date', today)
      .order('slot_date', { ascending: true })
      .order('slot_time', { ascending: true })
      .limit(10);

    const upcomingSessions = upcomingSlots?.length || 0;

    // Build next session info
    let nextSession = null;
    if (upcomingSlots && upcomingSlots.length > 0) {
      const next = upcomingSlots[0];
      const nextGroupIds = next.group_id || [];
      // Find the group name for the first group in the slot
      const nextGroup = groups.find(g => nextGroupIds.includes(g.group_id));

      nextSession = {
        date: next.slot_date,
        time: next.slot_time,
        group_name: nextGroup?.group_name || nextGroupIds[0] || 'Unknown',
        group_id: nextGroupIds[0] || null,
        trainee_count: totalTrainees > 0 ? Math.round(totalTrainees / Math.max(activeGroups, 1)) : 0
      };
    }

    return res.status(200).json({
      success: true,
      data: {
        assigned_groups: groupIds.length,
        active_groups: activeGroups,
        total_trainees: totalTrainees,
        upcoming_sessions: upcomingSessions,
        next_session: nextSession
      }
    });

  } catch (error) {
    next(error);
  }
};

module.exports = { dashboardStats };
