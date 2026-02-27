/**
 * DELETE /api/admin/groups/:groupId
 * Delete a group
 * Permission: 'groups.delete'
 */

const { requirePermission } = require('../../middleware/requirePermission');
const { getCache } = require('../../services/cache');
const { db } = require('../../services/supabase');

const deleteGroup = async (req, res, next) => {
  try {
    await requirePermission(req, 'groups.delete');

    const { groupId } = req.params;

    if (!groupId) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'Group ID is required' }
      });
    }

    // Try to delete by group_id first, then by UUID
    let deleted;

    const { data: byGroupId } = await db
      .from('groups')
      .delete()
      .eq('group_id', groupId)
      .select()
      .single();

    if (byGroupId) {
      deleted = byGroupId;
    } else {
      const { data: byUuid } = await db
        .from('groups')
        .delete()
        .eq('id', groupId)
        .select()
        .single();

      deleted = byUuid;
    }

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: { code: 'GROUP_NOT_FOUND', message: `Group with ID ${groupId} not found` }
      });
    }

    const cache = getCache();
    await cache.deletePattern('admin:groups:*');
    await cache.delete('admin:groups:statistics');

    res.status(200).json({
      success: true,
      message: 'Group deleted successfully',
      data: { id: deleted.id, group_id: deleted.group_id }
    });

  } catch (error) {
    if (error.message.includes('authorization') || error.message.includes('token') || error.message.includes('Permission denied')) {
      const statusCode = error.statusCode || 401;
      return res.status(statusCode).json({
        success: false,
        error: { code: error.code || 'UNAUTHORIZED', message: error.message }
      });
    }

    console.error('Error deleting group:', error);
    next(error);
  }
};

module.exports = { deleteGroup };
