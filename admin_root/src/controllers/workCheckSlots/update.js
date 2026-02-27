/**
 * PUT /api/admin/work-check-slots/:id
 * Update a single work check slot
 * Permission: 'workcheck.edit'
 */

const { requirePermission } = require('../../middleware/requirePermission');
const { db } = require('../../services/supabase');

const update = async (req, res, next) => {
  try {
    await requirePermission(req, 'workcheck.edit');

    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_ID', message: 'Slot ID is required' }
      });
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid slot ID format' }
      });
    }

    const updates = req.validatedData || req.body;

    console.log(`[Update Work Check Slot] Updating slot ${id}:`, updates);

    // Check if slot exists
    const { data: existingSlot, error: fetchError } = await db
      .from('work_check_slots')
      .select('id')
      .eq('id', id)
      .single();

    if (fetchError || !existingSlot) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Work check slot not found' }
      });
    }

    // If group_id is being updated, verify all groups exist
    if (updates.group_id) {
      const { data: groups, error: groupsError } = await db
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

    // Update the slot
    const { data: updatedSlot, error: updateError } = await db
      .from('work_check_slots')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        *,
        instructor:instructors!work_check_slots_instructor_id_fkey (
          id,
          instructor_name,
          email
        )
      `)
      .single();

    if (updateError) {
      // Check for unique constraint violation
      if (updateError.code === '23505') {
        return res.status(409).json({
          success: false,
          error: {
            code: 'DUPLICATE_SLOT',
            message: 'A slot already exists for this instructor, groups, date, and time combination'
          }
        });
      }
      throw new Error(`Failed to update slot: ${updateError.message}`);
    }

    console.log(`[Update Work Check Slot] Successfully updated slot ${id}`);

    res.status(200).json({
      success: true,
      message: 'Work check slot updated successfully',
      data: {
        ...updatedSlot,
        instructor_name: updatedSlot.instructor?.instructor_name || null,
        instructor_email: updatedSlot.instructor?.email || null
      }
    });

  } catch (error) {
    next(error);
  }
};

module.exports = { update };
