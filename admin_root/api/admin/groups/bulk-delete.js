/**
 * POST /api/admin/groups/bulk-delete
 * Bulk delete multiple groups
 * Permission: 'groups.delete'
 *
 * Note: Groups with students assigned cannot be deleted.
 * The frontend should filter these out before calling this endpoint.
 */

const { requirePermission } = require('../middleware/requirePermission');
const { validationMiddleware } = require('../../_shared/validation');
const { getCache } = require('../../_shared/cache');
const { supabaseAdmin } = require('../../_shared/supabase');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: `Method ${req.method} not allowed` }
    });
  }

  try {
    // Verify admin authentication and permission
    await requirePermission(req, 'groups.delete');

    // Validate request body
    const validator = validationMiddleware('groupBulkDelete');
    await new Promise((resolve, reject) => {
      validator(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    const { ids } = req.validatedData;

    console.log(`[Bulk Delete Groups] Attempting to delete ${ids.length} groups:`, ids);

    // First, check which groups have students assigned
    const { data: groupsWithStudents, error: checkError } = await supabaseAdmin
      .from('groups_students')
      .select('group_id')
      .in('group_id', ids)
      .eq('status', 'active');

    if (checkError) {
      console.error('[Supabase ERROR] Failed to check student assignments:', checkError.message);
      throw new Error('Failed to verify group student assignments');
    }

    // Get unique group IDs that have students
    const blockedGroupIds = new Set(groupsWithStudents?.map(gs => gs.group_id) || []);

    // Filter out groups that have students
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

    // Delete the groups that don't have students
    const { data: deletedGroups, error: deleteError } = await supabaseAdmin
      .from('groups')
      .delete()
      .in('group_id', deletableIds)
      .select('id, group_id, group_name');

    if (deleteError) {
      console.error('[Supabase ERROR] Failed to delete groups:', deleteError.message);
      throw new Error(`Failed to delete groups: ${deleteError.message}`);
    }

    // Also clean up any instructor assignments for deleted groups
    const { error: instructorCleanupError } = await supabaseAdmin
      .from('groups_instructors')
      .delete()
      .in('group_id', deletableIds);

    if (instructorCleanupError) {
      console.warn('[Supabase WARNING] Failed to cleanup instructor assignments:', instructorCleanupError.message);
      // Don't fail the operation, just log the warning
    }

    // Invalidate cache
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
    // Auth-specific error handling
    if (error.message.includes('authorization') || error.message.includes('token') || error.message.includes('Permission denied')) {
      const statusCode = error.statusCode || 401;
      return res.status(statusCode).json({
        success: false,
        error: { code: error.code || 'UNAUTHORIZED', message: error.message }
      });
    }

    console.error('Error in bulk delete groups:', error);

    res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Failed to delete groups'
    });
  }
};
