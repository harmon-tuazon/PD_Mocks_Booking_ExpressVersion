/**
 * POST /api/admin/groups/bulk-delete
 * Bulk delete multiple groups
 * Permission: 'groups.delete'
 *
 * Note: Groups with students assigned cannot be deleted.
 */

const { requirePermission } = require('../../middleware/requirePermission');
const { validationMiddleware } = require('../../services/validation');
const { getCache } = require('../../services/cache');
const { db } = require('../../services/supabase');

const bulkDelete = async (req, res, next) => {
  try {
    await requirePermission(req, 'groups.delete');

    const validator = validationMiddleware('groupBulkDelete');
    await new Promise((resolve, reject) => {
      validator(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    const { ids } = req.validatedData;

    console.log(`[Bulk Delete Groups] Attempting to delete ${ids.length} groups:`, ids);

    // Check which groups have students assigned
    const { data: groupsWithStudents, error: checkError } = await db
      .from('groups_students')
      .select('group_id')
      .in('group_id', ids)
      .eq('status', 'active');

    if (checkError) {
      console.error('[Supabase ERROR] Failed to check student assignments:', checkError.message);
      throw new Error('Failed to verify group student assignments');
    }

    const blockedGroupIds = new Set(groupsWithStudents?.map(gs => gs.group_id) || []);
    const deletableIds = ids.filter(id => !blockedGroupIds.has(id));
    const blockedIds = ids.filter(id => blockedGroupIds.has(id));

    console.log(`[Bulk Delete Groups] Deletable: ${deletableIds.length}, Blocked: ${blockedIds.length}`);

    if (deletableIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_DELETABLE_GROUPS',
          message: 'All selected groups have students assigned and cannot be deleted'
        },
        data: {
          blocked: blockedIds.length,
          blockedIds: blockedIds
        }
      });
    }

    const { data: deletedGroups, error: deleteError } = await db
      .from('groups')
      .delete()
      .in('group_id', deletableIds)
      .select('id, group_id, group_name');

    if (deleteError) {
      console.error('[Supabase ERROR] Failed to delete groups:', deleteError.message);
      throw new Error(`Failed to delete groups: ${deleteError.message}`);
    }

    // Clean up instructor assignments for deleted groups
    const { error: instructorCleanupError } = await db
      .from('groups_instructors')
      .delete()
      .in('group_id', deletableIds);

    if (instructorCleanupError) {
      console.warn('[Supabase WARNING] Failed to cleanup instructor assignments:', instructorCleanupError.message);
    }

    const cache = getCache();
    await cache.deletePattern('admin:groups:*');
    await cache.delete('admin:groups:statistics');

    const summary = {
      requested: ids.length,
      deleted: deletedGroups?.length || 0,
      blocked: blockedIds.length
    };

    console.log(`[Bulk Delete Groups] Completed:`, summary);

    res.status(200).json({
      success: true,
      message: `Successfully deleted ${summary.deleted} group(s)`,
      data: {
        deleted: summary.deleted,
        blocked: summary.blocked,
        deletedGroups: deletedGroups?.map(g => ({
          id: g.id,
          group_id: g.group_id,
          group_name: g.group_name
        })) || [],
        blockedIds: blockedIds
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

    console.error('Error in bulk delete groups:', error);
    next(error);
  }
};

module.exports = { bulkDelete };
