/**
 * POST /api/admin/work-check-slots/bulk-edit
 * Bulk edit multiple work check slots
 * Permission: 'workcheck.edit'
 */

const { requirePermission } = require('../../middleware/requirePermission');
const { supabaseAdmin } = require('../../services/supabase');

const bulkEdit = async (req, res, next) => {
  try {
    // Verify admin authentication and permission
    await requirePermission(req, 'workcheck.edit');

    const { ids, updates } = req.validatedData || req.body;

    console.log(`[Bulk Edit Slots] Updating ${ids.length} slots with:`, Object.keys(updates));

    // Verify all slots exist
    const { data: existingSlots, error: fetchError } = await supabaseAdmin
      .from('work_check_slots')
      .select('id')
      .in('id', ids);

    if (fetchError) {
      console.error('[Supabase ERROR] Failed to fetch slots:', fetchError.message);
      throw new Error('Failed to fetch slots');
    }

    const foundIds = new Set(existingSlots?.map(s => s.id) || []);
    const notFoundIds = ids.filter(id => !foundIds.has(id));

    if (notFoundIds.length > 0) {
      console.warn(`[Bulk Edit Slots] Some slots not found: ${notFoundIds.length}`);
    }

    const idsToUpdate = ids.filter(id => foundIds.has(id));

    if (idsToUpdate.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NO_SLOTS_FOUND', message: 'No matching slots found' }
      });
    }

    // If group_id is being updated, verify all groups exist
    if (updates.group_id) {
      const { data: groups, error: groupsError } = await supabaseAdmin
        .from('groups')
        .select('group_id')
        .in('group_id', updates.group_id);

      if (groupsError) {
        throw new Error('Failed to verify groups');
      }

      const foundGroupIds = new Set(groups?.map(g => g.group_id) || []);
      const missingGroups = updates.group_id.filter(gid => !foundGroupIds.has(gid));

      if (missingGroups.length > 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_GROUPS',
            message: `Groups not found: ${missingGroups.join(', ')}`
          }
        });
      }
    }

    // Perform bulk update
    const { error: updateError } = await supabaseAdmin
      .from('work_check_slots')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .in('id', idsToUpdate);

    if (updateError) {
      // Check for unique constraint violations
      if (updateError.code === '23505') {
        return res.status(409).json({
          success: false,
          error: {
            code: 'DUPLICATE_SLOTS',
            message: 'Update would create duplicate slots'
          }
        });
      }
      console.error('[Supabase ERROR] Failed to update slots:', updateError.message);
      throw new Error(`Failed to update slots: ${updateError.message}`);
    }

    const summary = {
      total: ids.length,
      updated: idsToUpdate.length,
      not_found: notFoundIds.length,
      fields_updated: Object.keys(updates)
    };

    console.log('[Bulk Edit Slots] Completed:', summary);

    res.status(200).json({
      success: true,
      message: `Successfully updated ${summary.updated} slot(s)`,
      data: summary
    });

  } catch (error) {
    next(error);
  }
};

module.exports = { bulkEdit };
