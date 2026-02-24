/**
 * DELETE /api/admin/groups/:groupId/students/:studentId
 * Remove a student from a group (soft delete)
 * Permission: 'groups.edit'
 */

const { requirePermission } = require('../../middleware/requirePermission');
const { getCache } = require('../../services/cache');
const { supabaseAdmin } = require('../../services/supabase');

const removeStudent = async (req, res, next) => {
  try {
    await requirePermission(req, 'groups.edit');

    const { groupId, studentId } = req.params;

    if (!groupId || !studentId) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'Group ID and Student ID are required' }
      });
    }

    // Verify group exists
    const { data: group } = await supabaseAdmin
      .from('groups')
      .select('group_id, group_name')
      .eq('group_id', groupId)
      .single();

    if (!group) {
      return res.status(404).json({
        success: false,
        error: { code: 'GROUP_NOT_FOUND', message: `Group ${groupId} not found` }
      });
    }

    // Find the assignment by student_id first, then by assignment UUID
    let assignment;

    const { data: byStudentId } = await supabaseAdmin
      .from('groups_students')
      .select('id, student_id, status')
      .eq('group_id', groupId)
      .eq('student_id', studentId)
      .eq('status', 'active')
      .single();

    if (byStudentId) {
      assignment = byStudentId;
    } else {
      const { data: byAssignmentId } = await supabaseAdmin
        .from('groups_students')
        .select('id, student_id, status')
        .eq('group_id', groupId)
        .eq('id', studentId)
        .eq('status', 'active')
        .single();

      assignment = byAssignmentId;
    }

    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: { code: 'ASSIGNMENT_NOT_FOUND', message: 'Student is not assigned to this group' }
      });
    }

    // Soft delete
    const { error: updateError } = await supabaseAdmin
      .from('groups_students')
      .update({ status: 'removed', updated_at: new Date().toISOString() })
      .eq('id', assignment.id);

    if (updateError) {
      throw new Error(`Failed to remove student: ${updateError.message}`);
    }

    const cache = getCache();
    await cache.deletePattern('admin:groups:*');
    await cache.delete('admin:groups:statistics');

    console.log(`[Student Removed] ${assignment.student_id} from ${groupId}`);

    res.status(200).json({
      success: true,
      message: 'Student removed from group successfully',
      data: {
        group_id: groupId,
        student_id: assignment.student_id,
        assignment_id: assignment.id
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

    console.error('Error removing student from group:', error);
    next(error);
  }
};

module.exports = { removeStudent };
