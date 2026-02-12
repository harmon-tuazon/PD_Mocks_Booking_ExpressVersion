/**
 * GET /api/admin/instructor/groups/:groupId
 * Get group details with students for an assigned group
 * Role: 'instructor'
 */

const { requireRole } = require('../../middleware/requireRole');
const { getInstructorFromUser } = require('../../../_shared/instructor-helpers');
const { supabaseAdmin } = require('../../../_shared/supabase');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: `Method ${req.method} not allowed` }
    });
  }

  const { groupId } = req.query;

  if (!groupId) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_REQUEST', message: 'Group ID is required' }
    });
  }

  try {
    const user = await requireRole(req, 'instructor');
    const instructor = await getInstructorFromUser(user);

    // Verify this instructor is assigned to the requested group
    const { data: assignment, error: assignError } = await supabaseAdmin
      .from('groups_instructors')
      .select('group_id, status, assigned_date')
      .eq('instructor_id', instructor.id)
      .eq('group_id', groupId)
      .single();

    if (assignError || !assignment) {
      return res.status(403).json({
        success: false,
        error: { code: 'NOT_ASSIGNED', message: 'You are not assigned to this group' }
      });
    }

    // Fetch group details
    const { data: group, error: groupError } = await supabaseAdmin
      .from('groups')
      .select('group_id, group_name, time_period, start_date, end_date, status, max_capacity, location, cycle, phase')
      .eq('group_id', groupId)
      .single();

    if (groupError || !group) {
      return res.status(404).json({
        success: false,
        error: { code: 'GROUP_NOT_FOUND', message: `Group ${groupId} not found` }
      });
    }

    // Fetch students in this group (follows admin pattern from groups/[groupId].js)
    const { data: groupStudents, error: studentsError } = await supabaseAdmin
      .from('groups_students')
      .select('id, student_id, status, enrolled_at')
      .eq('group_id', group.group_id)
      .eq('status', 'active');

    let students = [];
    if (groupStudents && groupStudents.length > 0) {
      // Fetch contact details by student_id
      const studentIds = groupStudents.map(gs => gs.student_id);
      const { data: contacts } = await supabaseAdmin
        .from('hubspot_contact_credits')
        .select('student_id, email, firstname, lastname')
        .in('student_id', studentIds);

      const contactMap = (contacts || []).reduce((acc, c) => {
        acc[c.student_id] = c;
        return acc;
      }, {});

      students = groupStudents.map(gs => {
        const contact = contactMap[gs.student_id];
        return {
          student_id: gs.student_id,
          firstname: contact?.firstname || null,
          lastname: contact?.lastname || null,
          email: contact?.email || null,
          enrolled_at: gs.enrolled_at
        };
      });
    }

    // Fetch upcoming work_check_slots for this group
    const today = new Date().toISOString().split('T')[0];
    const { data: slots } = await supabaseAdmin
      .from('work_check_slots')
      .select('slot_date, slot_time, duration_minutes')
      .contains('group_id', [groupId])
      .eq('instructor_id', instructor.id)
      .eq('is_active', true)
      .gte('slot_date', today)
      .order('slot_date', { ascending: true })
      .order('slot_time', { ascending: true })
      .limit(20);

    const instructionDates = (slots || []).map(s => ({
      date: s.slot_date,
      time: s.slot_time,
      duration_minutes: s.duration_minutes
    }));

    return res.status(200).json({
      success: true,
      data: {
        group_id: group.group_id,
        group_name: group.group_name,
        time_period: group.time_period,
        start_date: group.start_date,
        end_date: group.end_date,
        status: group.status,
        max_capacity: group.max_capacity,
        location: group.location,
        cycle: group.cycle,
        phase: group.phase,
        student_count: students.length,
        students,
        instruction_dates: instructionDates,
        assignment: {
          status: assignment.status,
          assigned_date: assignment.assigned_date
        }
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
