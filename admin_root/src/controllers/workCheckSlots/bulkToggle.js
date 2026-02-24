/**
 * POST /api/admin/work-check-slots/bulk-toggle
 * Bulk toggle is_active status for multiple work check slots
 * Permission: 'workcheck.edit'
 */

const { requirePermission } = require('../../middleware/requirePermission');
const { supabaseAdmin } = require('../../services/supabase');

const bulkToggle = async (req, res, next) => {
  try {
    // Verify admin authentication and permission
    await requirePermission(req, 'workcheck.edit');

    const { ids, action } = req.validatedData || req.body;

    console.log(`[Bulk Toggle Slots] Action: ${action} for ${ids.length} slots`);

    // Fetch current status of all slots
    const { data: slots, error: fetchError } = await supabaseAdmin
      .from('work_check_slots')
      .select('id, is_active')
      .in('id', ids);

    if (fetchError) {
      console.error('[Supabase ERROR] Failed to fetch slots:', fetchError.message);
      throw new Error('Failed to fetch slots');
    }

    if (!slots || slots.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NO_SLOTS_FOUND', message: 'No matching slots found' }
      });
    }

    // Determine updates based on action
    let activatedCount = 0;
    let deactivatedCount = 0;
    const updates = [];

    for (const slot of slots) {
      let newStatus;

      if (action === 'toggle') {
        newStatus = !slot.is_active;
      } else if (action === 'activate') {
        newStatus = true;
      } else if (action === 'deactivate') {
        newStatus = false;
      }

      if (newStatus !== slot.is_active) {
        updates.push({
          id: slot.id,
          is_active: newStatus
        });

        if (newStatus) {
          activatedCount++;
        } else {
          deactivatedCount++;
        }
      }
    }

    // Perform updates if any
    if (updates.length > 0) {
      // Update each slot individually (Supabase doesn't support bulk updates with different values)
      for (const update of updates) {
        const { error: updateError } = await supabaseAdmin
          .from('work_check_slots')
          .update({
            is_active: update.is_active,
            updated_at: new Date().toISOString()
          })
          .eq('id', update.id);

        if (updateError) {
          console.error(`[Supabase ERROR] Failed to update slot ${update.id}:`, updateError.message);
        }
      }
    }

    const summary = {
      total: ids.length,
      found: slots.length,
      updated: updates.length,
      activated: activatedCount,
      deactivated: deactivatedCount,
      unchanged: slots.length - updates.length
    };

    console.log('[Bulk Toggle Slots] Completed:', summary);

    res.status(200).json({
      success: true,
      message: `Successfully updated ${summary.updated} slot(s)`,
      data: summary
    });

  } catch (error) {
    next(error);
  }
};

module.exports = { bulkToggle };
