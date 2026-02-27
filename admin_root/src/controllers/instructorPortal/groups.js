/**
 * GET /api/admin/instructor/groups
 * List groups assigned to the logged-in instructor
 * Role: 'instructor'
 */

const { requireRole } = require('../../middleware/requireRole');
const { getInstructorFromUser } = require('../../services/instructor-helpers');
const { db } = require('../../services/supabase');

const listGroups = async (req, res, next) => {
  try {
    const user = await requireRole(req, 'instructor');
    const instructor = await getInstructorFromUser(user);

    // Parse query params
    const status = req.query.status || 'active';

    // Get instructor's group assignments
    const assignQuery = db
      .from('groups_instructors')
      .select('group_id, status, assigned_date')
      .eq('instructor_id', instructor.id);

    if (status !== 'all') {
      assignQuery.eq('status', status);
    }

    const { data: assignments, error: assignError } = await assignQuery;

    if (assignError) {
      console.error('[Instructor Groups] Error fetching assignments:', assignError.message);
      throw new Error('Failed to fetch group assignments');
    }

    if (!assignments || assignments.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    const groupIds = assignments.map(a => a.group_id);

    // Fetch group details
    const { data: groups, error: groupError } = await db
      .from('groups')
      .select('group_id, group_name, time_period, start_date, end_date, status, max_capacity, location, cycle, phase')
      .in('group_id', groupIds);

    if (groupError) {
      console.error('[Instructor Groups] Error fetching groups:', groupError.message);
      throw new Error('Failed to fetch group details');
    }

    // Count students per group using groups_students (matches admin pattern)
    const studentCounts = {};
    for (const gid of groupIds) {
      const { count, error: countError } = await db
        .from('groups_students')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', gid)
        .eq('status', 'active');

      studentCounts[gid] = countError ? 0 : (count || 0);
    }

    // Build assignment lookup for assigned_date
    const assignMap = assignments.reduce((acc, a) => {
      acc[a.group_id] = a;
      return acc;
    }, {});

    // Merge and respond
    const result = (groups || []).map(g => ({
      group_id: g.group_id,
      group_name: g.group_name,
      time_period: g.time_period,
      start_date: g.start_date,
      end_date: g.end_date,
      status: g.status,
      max_capacity: g.max_capacity,
      location: g.location,
      cycle: g.cycle,
      phase: g.phase,
      student_count: studentCounts[g.group_id] || 0,
      assigned_date: assignMap[g.group_id]?.assigned_date || null
    }));

    return res.status(200).json({ success: true, data: result });

  } catch (error) {
    next(error);
  }
};

module.exports = { listGroups };
