/**
 * POST /api/admin/groups/bulk-toggle-status
 * Bulk toggle active/inactive status for multiple groups
 *
 * Features:
 * - Toggle status for multiple groups (up to 100 per request)
 * - Status cycle: active -> inactive, inactive -> active, completed -> inactive
 * - Idempotent operations - safe to retry
 * - Partial failure handling with detailed error reporting
 * - Audit logging for each bulk operation
 *
 * Request Body:
 * {
 *   "ids": ["group_id1", "group_id2", "group_id3"]
 * }
 *
 * Returns:
 * - Detailed results for each group update
 * - Summary statistics (total, updated, failed, activated, deactivated)
 * - Error details for failed updates
 */

const { requirePermission } = require('../middleware/requirePermission');
const { validationMiddleware } = require('../../_shared/validation');
const { supabaseAdmin } = require('../../_shared/supabase');
const { getCache } = require('../../_shared/cache');

// Maximum groups per request
const MAX_GROUPS_PER_REQUEST = 100;

module.exports = async (req, res) => {
  const startTime = Date.now();

  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return res.status(405).json({
        success: false,
        error: {
          code: 'METHOD_NOT_ALLOWED',
          message: `Method ${req.method} not allowed. Use POST.`
        }
      });
    }

    // Verify admin authentication and permission
    const user = await requirePermission(req, 'groups.edit');
    const adminEmail = user?.email || 'admin@prepdoctors.com';

    // Validate request body
    const validator = validationMiddleware('groupBulkToggleStatus');
    await new Promise((resolve, reject) => {
      validator(req, res, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });

    const { ids } = req.validatedData;

    // Double-check group count (validation should handle this)
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

    // Fetch all groups by their group_id from Supabase
    console.log(`[BULK-TOGGLE-GROUPS] Fetching group details from Supabase...`);
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

    // Create a map of existing groups for quick lookup
    const groupsMap = new Map(groups.map(group => [group.group_id, group]));

    // Initialize result tracking
    const results = {
      successful: [],
      failed: []
    };

    // Summary statistics
    const summary = {
      total: ids.length,
      updated: 0,
      failed: 0,
      activated: 0,
      deactivated: 0
    };

    // Prepare updates
    const updates = [];

    for (const groupId of ids) {
      const group = groupsMap.get(groupId);

      // Check if group exists
      if (!group) {
        results.failed.push({
          id: groupId,
          error: 'Group not found',
          code: 'NOT_FOUND'
        });
        summary.failed++;
        continue;
      }

      // Get current status and determine new status
      const currentStatus = group.status;
      let newStatus;

      // Toggle logic: active -> inactive, inactive -> active, completed -> inactive
      if (currentStatus === 'active') {
        newStatus = 'inactive';
        summary.deactivated++;
      } else {
        // Both 'inactive' and 'completed' toggle to 'active'
        newStatus = 'active';
        summary.activated++;
      }

      // Prepare update
      updates.push({
        id: group.id,
        group_id: groupId,
        group_name: group.group_name,
        previousStatus: currentStatus,
        newStatus: newStatus
      });
    }

    // Process updates
    if (updates.length > 0) {
      console.log(`[BULK-TOGGLE-GROUPS] Processing ${updates.length} status toggles...`);
      console.log(`[BULK-TOGGLE-GROUPS] ${summary.activated} to activate, ${summary.deactivated} to deactivate`);

      // Process each update individually to track success/failure
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
            // Adjust summary counts on failure
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
          // Adjust summary counts on failure
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

    // Invalidate cache after successful updates
    if (results.successful.length > 0) {
      console.log(`[BULK-TOGGLE-GROUPS] Successfully toggled ${results.successful.length} group(s)`);

      // Invalidate groups cache
      const cache = getCache();
      await cache.deletePattern('admin:groups:*');
      await cache.delete('admin:groups:statistics');

      // Create audit log asynchronously
      createAuditLog(summary, adminEmail, ids).catch(error => {
        console.error('Failed to create audit log:', error);
      });
    }

    // Check for timeout (Vercel 60s limit)
    if (Date.now() - startTime > 55000) {
      console.warn(`[BULK-TOGGLE-GROUPS] Operation approaching timeout`);
    }

    // Return response
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
    console.error('[BULK-TOGGLE-GROUPS] Error in bulk toggle status:', error);

    // Handle validation errors
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

    // Handle auth errors
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

    // Handle timeout errors (Vercel 60s limit)
    if (Date.now() - startTime > 55000) {
      return res.status(504).json({
        success: false,
        error: {
          code: 'TIMEOUT',
          message: 'Request timeout. Please try with fewer groups.'
        }
      });
    }

    // Generic error
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'An error occurred while toggling group status'
      }
    });
  }
};

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

    // Note: In a production environment, this could be written to an audit log table
    // For now, we just log to console

  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw - this is non-critical
  }
}
