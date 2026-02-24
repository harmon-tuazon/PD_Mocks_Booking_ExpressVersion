/**
 * POST /api/admin/groups/bulk-toggle-status
 * Bulk toggle active/inactive status for multiple groups
 * Permission: 'groups.edit'
 *
 * Status cycle: active -> inactive, inactive -> active, completed -> active
 */

const { requirePermission } = require('../../middleware/requirePermission');
const { validationMiddleware } = require('../../services/validation');
const { supabaseAdmin } = require('../../services/supabase');
const { getCache } = require('../../services/cache');

const MAX_GROUPS_PER_REQUEST = 100;

/**
 * Create audit log for bulk toggle operation
 */
async function createAuditLog(summary, adminEmail, groupIds) {
  try {
    console.log(`[AUDIT] Bulk toggle group operation:`, {
      summary,
      adminEmail,
      groupCount: groupIds.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
  }
}

const bulkToggleStatus = async (req, res, next) => {
  const startTime = Date.now();

  try {
    const user = await requirePermission(req, 'groups.edit');
    const adminEmail = user?.email || 'admin@prepdoctors.com';

    const validator = validationMiddleware('groupBulkToggleStatus');
    await new Promise((resolve, reject) => {
      validator(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    const { ids } = req.validatedData;

    if (ids.length > MAX_GROUPS_PER_REQUEST) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BATCH_SIZE_EXCEEDED',
          message: `Maximum ${MAX_GROUPS_PER_REQUEST} groups can be toggled per request`,
          details: { provided: ids.length, maximum: MAX_GROUPS_PER_REQUEST }
        }
      });
    }

    console.log(`[BULK-TOGGLE-GROUPS] Processing bulk toggle for ${ids.length} groups`);
    console.log(`[BULK-TOGGLE-GROUPS] Admin: ${adminEmail}`);

    const { data: groups, error: fetchError } = await supabaseAdmin
      .from('groups')
      .select('id, group_id, group_name, status')
      .in('group_id', ids);

    if (fetchError) {
      console.error('[BULK-TOGGLE-GROUPS] Error fetching groups:', fetchError);
      return res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch group details'
        }
      });
    }

    const groupsMap = new Map(groups.map(group => [group.group_id, group]));

    const results = {
      successful: [],
      failed: []
    };

    const summary = {
      total: ids.length,
      updated: 0,
      failed: 0,
      activated: 0,
      deactivated: 0
    };

    const updates = [];

    for (const groupId of ids) {
      const group = groupsMap.get(groupId);

      if (!group) {
        results.failed.push({
          id: groupId,
          error: 'Group not found',
          code: 'NOT_FOUND'
        });
        summary.failed++;
        continue;
      }

      const currentStatus = group.status;
      let newStatus;

      if (currentStatus === 'active') {
        newStatus = 'inactive';
        summary.deactivated++;
      } else {
        newStatus = 'active';
        summary.activated++;
      }

      updates.push({
        id: group.id,
        group_id: groupId,
        group_name: group.group_name,
        previousStatus: currentStatus,
        newStatus: newStatus
      });
    }

    if (updates.length > 0) {
      console.log(`[BULK-TOGGLE-GROUPS] Processing ${updates.length} status toggles...`);

      for (const update of updates) {
        try {
          const { error: updateError } = await supabaseAdmin
            .from('groups')
            .update({
              status: update.newStatus,
              updated_at: new Date().toISOString()
            })
            .eq('id', update.id);

          if (updateError) {
            if (update.newStatus === 'active') {
              summary.activated--;
            } else {
              summary.deactivated--;
            }

            results.failed.push({
              id: update.group_id,
              error: updateError.message || 'Failed to update status',
              code: 'UPDATE_FAILED'
            });
            summary.failed++;
          } else {
            results.successful.push({
              id: update.group_id,
              previousStatus: update.previousStatus,
              newStatus: update.newStatus
            });
            summary.updated++;
          }
        } catch (updateError) {
          if (update.newStatus === 'active') {
            summary.activated--;
          } else {
            summary.deactivated--;
          }

          results.failed.push({
            id: update.group_id,
            error: updateError.message || 'Unexpected error during update',
            code: 'UPDATE_FAILED'
          });
          summary.failed++;
        }
      }
    }

    if (results.successful.length > 0) {
      console.log(`[BULK-TOGGLE-GROUPS] Successfully toggled ${results.successful.length} group(s)`);

      const cache = getCache();
      await cache.deletePattern('admin:groups:*');
      await cache.delete('admin:groups:statistics');

      createAuditLog(summary, adminEmail, ids).catch(error => {
        console.error('Failed to create audit log:', error);
      });
    }

    const executionTime = Date.now() - startTime;

    res.status(200).json({
      success: true,
      summary,
      results,
      meta: {
        timestamp: new Date().toISOString(),
        processedBy: adminEmail,
        executionTime
      }
    });

  } catch (error) {
    if (error.validationErrors) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: error.validationErrors
        }
      });
    }

    if (error.statusCode === 403) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: error.message || 'Permission denied'
        }
      });
    }

    if (error.statusCode === 401 || error.message?.includes('authorization') || error.message?.includes('token')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
    }

    console.error('[BULK-TOGGLE-GROUPS] Error in bulk toggle status:', error);
    next(error);
  }
};

module.exports = { bulkToggleStatus };
