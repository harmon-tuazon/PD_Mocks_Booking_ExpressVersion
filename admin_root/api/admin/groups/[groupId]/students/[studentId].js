/**
 * DELETE /api/admin/groups/[groupId]/students/[studentId]
 * Remove a student from a group
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

    const { groupId, studentId } = req.query;

    if (!groupId || !studentId) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'Group ID and Student ID are required' }
      });
    }

    // Verify group exists
    const { data: group } = await supabaseAdmin
      .from('hubspot_sync.groups')
      .select('group_id, group_name')
      .eq('group_id', groupId)
      .single();

    if (!group) {
      return res.status(404).json({
        success: false,
        error: { code: 'GROUP_NOT_FOUND', message: `Group ${groupId} not found` }
      });
    }

    // Find the assignment
    // studentId can be either the assignment id, contact_id (UUID), or we try both
    let assignment;

    // Try by contact_id first (most common use case)
    const { data: byContactId } = await supabaseAdmin
      .from('hubspot_sync.groups_students')
      .select('id, contact_id, status')
      .eq('group_id', groupId)
      .eq('contact_id', studentId)
      .eq('status', 'active')
      .single();

    if (byContactId) {
      assignment = byContactId;
    } else {
      // Try by assignment id
      const { data: byAssignmentId } = await supabaseAdmin
        .from('hubspot_sync.groups_students')
        .select('id, contact_id, status')
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

    // Soft delete - set status to 'removed' instead of hard delete
    const { error: updateError } = await supabaseAdmin
      .from('hubspot_sync.groups_students')
      .update({ status: 'removed', updated_at: new Date().toISOString() })
      .eq('id', assignment.id);

    if (updateError) {
      throw new Error(`Failed to remove student: ${updateError.message}`);
    }

    // Invalidate cache
    const cache = getCache();
    await cache.del('admin:groups:*');
    await cache.del('admin:groups:statistics');

    console.log(`[Student Removed] ${assignment.contact_id} from ${groupId}`);

    res.status(200).json({
      success: true,
      message: 'Student removed from group successfully',
      data: {
        group_id: groupId,
        contact_id: assignment.contact_id,
        assignment_id: assignment.id
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

    console.error('Error removing student from group:', error);

    res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Failed to remove student from group'
    });
  }
};
