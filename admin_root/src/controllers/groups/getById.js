/**
 * GET /api/admin/groups/:groupId
 * Fetch single group with students and instructors
 * Permission: 'groups.view'
 */

const { requirePermission } = require('../../middleware/requirePermission');
const { db } = require('../../services/supabase');

const getById = async (req, res, next) => {
  try {
    await requirePermission(req, 'groups.view');

    const { groupId } = req.params;

    if (!groupId) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'Group ID is required' }
      });
    }

    // Try to find by group_id first, then by UUID
    let group;

    const { data: byGroupId } = await db
      .from('groups')
      .select('*')
      .eq('group_id', groupId)
      .single();

    if (byGroupId) {
      group = byGroupId;
    } else {
      const { data: byUuid } = await db
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single();

      group = byUuid;
    }

    if (!group) {
      return res.status(404).json({
        success: false,
        error: { code: 'GROUP_NOT_FOUND', message: `Group with ID ${groupId} not found` }
      });
    }

    // Fetch students for this group with contact details
    const { data: groupStudents } = await db
      .from('groups_students')
      .select(`
        id,
        student_id,
        status,
        enrolled_at,
        updated_at
      `)
      .eq('group_id', group.group_id)
      .eq('status', 'active');

    let students = [];
    if (groupStudents && groupStudents.length > 0) {
      const studentIds = groupStudents.map(gs => gs.student_id);
      const { data: contacts } = await db
        .from('hubspot_contact_credits')
        .select('id, student_id, email, firstname, lastname')
        .in('student_id', studentIds);

      const contactMap = (contacts || []).reduce((acc, c) => {
        acc[c.student_id] = c;
        return acc;
      }, {});

      students = groupStudents.map(gs => ({
        assignment_id: gs.id,
        student_id: gs.student_id,
        status: gs.status,
        enrolled_at: gs.enrolled_at,
        student: contactMap[gs.student_id] || null
      }));
    }

    // Fetch instructors for this group
    const { data: groupInstructors } = await db
      .from('groups_instructors')
      .select(`
        id,
        instructor_id,
        status,
        assigned_date,
        created_at,
        updated_at
      `)
      .eq('group_id', group.group_id)
      .eq('status', 'active');

    let instructors = [];
    if (groupInstructors && groupInstructors.length > 0) {
      const instructorIds = groupInstructors.map(gi => gi.instructor_id);
      const { data: instructorDetails } = await db
        .from('instructors')
        .select('id, instructor_name, email')
        .in('id', instructorIds);

      const instructorMap = (instructorDetails || []).reduce((acc, i) => {
        acc[i.id] = i;
        return acc;
      }, {});

      instructors = groupInstructors.map(gi => ({
        assignment_id: gi.id,
        id: gi.instructor_id,
        instructor_id: gi.instructor_id,
        status: gi.status,
        assigned_date: gi.assigned_date,
        instructor: instructorMap[gi.instructor_id] || null
      }));
    }

    res.status(200).json({
      success: true,
      data: {
        id: group.id,
        group_id: group.group_id,
        group_name: group.group_name,
        location: group.location,
        time_period: group.time_period,
        cycle: group.cycle,
        phase: group.phase,
        start_date: group.start_date,
        end_date: group.end_date,
        max_capacity: group.max_capacity,
        status: group.status,
        created_at: group.created_at,
        updated_at: group.updated_at,
        students: students,
        student_count: students.length,
        instructors: instructors,
        instructor_count: instructors.length
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

    console.error('Error fetching group:', error);
    next(error);
  }
};

module.exports = { getById };
