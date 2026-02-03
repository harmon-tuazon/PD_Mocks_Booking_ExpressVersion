/**
 * DELETE /api/admin/groups/[groupId]/instructors/[instructorId]
 * Remove an instructor from a group (soft delete)
 * Permission: 'groups.edit'
 */

const { requirePermission } = require('../../../middleware/requirePermission');
const { getCache } = require('../../../../_shared/cache');
const { supabaseAdmin } = require('../../../../_shared/supabase');

module.exports = async (req, res) => {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', ['DELETE']);
    return res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: `Method ${req.method} not allowed` }
    });
  }

  try {
    // Verify admin authentication and permission
    await requirePermission(req, 'groups.edit');

    const { groupId, instructorId } = req.query;

    if (!groupId || !instructorId) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'Group ID and Instructor ID are required' }
      });
    }

    // Find the assignment - try by instructor_id first, then by assignment UUID
    let assignment;

    // Try by instructor_id first (most common use case)
    const { data: byInstructorId } = await supabaseAdmin
      .from('groups_instructors')
      .select('id, instructor_id, status')
      .eq('group_id', groupId)
      .eq('instructor_id', instructorId)
      .eq('status', 'active')
      .single();

    if (byInstructorId) {
      assignment = byInstructorId;
    } else {
      // Try by assignment UUID
      const { data: byAssignmentId } = await supabaseAdmin
        .from('groups_instructors')
        .select('id, instructor_id, status')
        .eq('group_id', groupId)
        .eq('id', instructorId)
        .eq('status', 'active')
        .single();
      assignment = byAssignmentId;
    }

    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: { code: 'ASSIGNMENT_NOT_FOUND', message: 'Instructor assignment not found or already removed' }
      });
    }

    // Soft delete - set status to 'removed' instead of hard delete
    const { error: updateError } = await supabaseAdmin
      .from('groups_instructors')
      .update({ status: 'removed', updated_at: new Date().toISOString() })
      .eq('id', assignment.id);

    if (updateError) {
      throw new Error(`Failed to remove instructor: ${updateError.message}`);
    }

    // Invalidate cache
    const cache = getCache();
    await cache.deletePattern('admin:groups:*');

    console.log(`[Instructor Removed] ${assignment.instructor_id} from Group ${groupId}`);

    res.status(200).json({
      success: true,
      message: 'Instructor removed from group',
      data: {
        assignment_id: assignment.id,
        instructor_id: assignment.instructor_id,
        group_id: groupId
      }
    });

  } catch (error) {
    // Auth-specific error handling
    if (error.message.includes('authorization') || error.message.includes('token') || error.message.includes('Permission denied')) {
      const statusCode = error.statusCode || 401;
      return res.status(statusCode).json({
        success: false,
        error: { code: error.code || 'UNAUTHORIZED', message: error.message }
      });
    }

    console.error('Error removing instructor:', error);

    res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Failed to remove instructor'
    });
  }
};
