/**
 * GET /api/admin/instructors/:id/groups
 * Fetch groups assigned to a specific instructor (admin access)
 *
 * Note: Authentication is handled by router-level requireAdmin middleware.
 * No additional auth call needed here.
 */

const { db } = require('../../services/supabase');

const groups = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'Instructor ID is required' }
      });
    }

    const status = req.query.status || 'all';

    // Get instructor's group assignments
    const assignQuery = db
      .from('groups_instructors')
      .select('group_id, status, assigned_date')
      .eq('instructor_id', id);

    if (status !== 'all') {
      assignQuery.eq('status', status);
    }

    const { data: assignments, error: assignError } = await assignQuery;

    if (assignError) {
      console.error('[Admin Instructor Groups] Error fetching assignments:', assignError.message);
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
      console.error('[Admin Instructor Groups] Error fetching groups:', groupError.message);
      throw new Error('Failed to fetch group details');
    }

    const result = (groups || []).map(g => ({
      group_id: g.group_id,
      group_name: g.group_name,
      cycle: g.cycle,
      phase: g.phase,
      status: g.status,
      location: g.location,
      time_period: g.time_period,
      start_date: g.start_date,
      end_date: g.end_date,
      max_capacity: g.max_capacity
    }));

    return res.status(200).json({ success: true, data: result });

  } catch (error) {
    next(error);
  }
};

module.exports = { groups };
