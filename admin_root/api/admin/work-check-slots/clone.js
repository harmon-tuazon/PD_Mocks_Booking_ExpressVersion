/**
 * POST /api/admin/work-check-slots/clone
 * Clone work check slots to a different instructor/groups/date
 * Permission: 'workcheck.create'
 */

const { requirePermission } = require('../middleware/requirePermission');
const { validationMiddleware } = require('../../_shared/validation');
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
    await requirePermission(req, 'workcheck.create');

    // Validate request body
    const validator = validationMiddleware('workCheckSlotClone');
    await new Promise((resolve, reject) => {
      validator(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    const {
      ids,
      target_instructor_id,
      target_groups,
      date_offset_days,
      copy_activation_settings
    } = req.validatedData;

    console.log(`[Clone Slots] Cloning ${ids.length} slots with offset ${date_offset_days} days`);

    // Fetch source slots
    const { data: sourceSlots, error: fetchError } = await supabaseAdmin
      .from('work_check_slots')
      .select('*')
      .in('id', ids);

    if (fetchError) {
      console.error('[Supabase ERROR] Failed to fetch source slots:', fetchError.message);
      throw new Error('Failed to fetch source slots');
    }

    if (!sourceSlots || sourceSlots.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NO_SLOTS_FOUND', message: 'No source slots found' }
      });
    }

    // If target_instructor_id provided, verify it exists
    if (target_instructor_id) {
      const { data: instructor, error: instructorError } = await supabaseAdmin
        .from('instructors')
        .select('id')
        .eq('id', target_instructor_id)
        .single();

      if (instructorError || !instructor) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INSTRUCTOR', message: 'Target instructor not found' }
        });
      }
    }

    // If target_groups provided, verify they exist
    if (target_groups && target_groups.length > 0) {
      const { data: groups, error: groupsError } = await supabaseAdmin
        .from('groups')
        .select('group_id')
        .in('group_id', target_groups);

      if (groupsError) {
        throw new Error('Failed to verify target groups');
      }

      const foundGroupIds = new Set(groups?.map(g => g.group_id) || []);
      const missingGroups = target_groups.filter(gid => !foundGroupIds.has(gid));

      if (missingGroups.length > 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_GROUPS',
            message: `Target groups not found: ${missingGroups.join(', ')}`
          }
        });
      }
    }

    // Prepare new slots
    const newSlots = sourceSlots.map(slot => {
      // Calculate new date
      const originalDate = new Date(slot.slot_date);
      originalDate.setDate(originalDate.getDate() + date_offset_days);
      const newDate = originalDate.toISOString().split('T')[0];

      // Determine activation settings
      let is_active, available_from;
      if (copy_activation_settings) {
        is_active = slot.is_active;
        available_from = slot.available_from;
      } else {
        // Default: inactive (draft state)
        is_active = false;
        available_from = null;
      }

      return {
        instructor_id: target_instructor_id || slot.instructor_id,
        group_id: target_groups && target_groups.length > 0 ? target_groups : slot.group_id,
        slot_date: newDate,
        slot_time: slot.slot_time,
        duration_minutes: slot.duration_minutes,
        total_slots: slot.total_slots,
        location: slot.location,
        is_active,
        available_from
      };
    });

    // Insert new slots
    const { data: createdSlots, error: insertError } = await supabaseAdmin
      .from('work_check_slots')
      .insert(newSlots)
      .select('id');

    if (insertError) {
      // Check for unique constraint violations
      if (insertError.code === '23505') {
        return res.status(409).json({
          success: false,
          error: {
            code: 'DUPLICATE_SLOTS',
            message: 'Some slots already exist for the target instructor, groups, dates, and times'
          }
        });
      }
      console.error('[Supabase ERROR] Failed to create cloned slots:', insertError.message);
      throw new Error(`Failed to create cloned slots: ${insertError.message}`);
    }

    const summary = {
      source_count: ids.length,
      created_count: createdSlots?.length || 0,
      failed_count: ids.length - (createdSlots?.length || 0),
      created_ids: createdSlots?.map(s => s.id) || []
    };

    console.log('[Clone Slots] Completed:', summary);

    res.status(201).json({
      success: true,
      message: `Successfully cloned ${summary.created_count} slot(s)`,
      data: summary
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

    console.error('Error in clone slots:', error);

    res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Failed to clone slots'
    });
  }
};
