/**
 * POST /api/admin/work-check-slots
 * Create a new work check slot
 * Permission: 'workcheck.create'
 */

const { requirePermission } = require('../../middleware/requirePermission');
const { supabaseAdmin } = require('../../services/supabase');

const create = async (req, res, next) => {
  try {
    // Verify admin authentication and permission
    await requirePermission(req, 'workcheck.create');

    const {
      instructor_id,
      group_id,
      slot_date,
      slot_time,
      duration_minutes,
      total_slots,
      location,
      activation_mode,
      available_from,
      auto_approve
    } = req.validatedData || req.body;

    console.log('[Create Work Check Slot] Creating slot:', {
      instructor_id, group_id, slot_date, slot_time, location, activation_mode
    });

    // Verify instructor exists
    const { data: instructor, error: instructorError } = await supabaseAdmin
      .from('instructors')
      .select('id, instructor_name')
      .eq('id', instructor_id)
      .single();

    if (instructorError || !instructor) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INSTRUCTOR',
          message: 'Instructor not found'
        }
      });
    }

    // Verify all groups exist
    const { data: groups, error: groupsError } = await supabaseAdmin
      .from('groups')
      .select('group_id')
      .in('group_id', group_id);

    if (groupsError) {
      console.error('[Supabase ERROR] Failed to verify groups:', groupsError.message);
      throw new Error('Failed to verify groups');
    }

    const foundGroupIds = new Set(groups?.map(g => g.group_id) || []);
    const missingGroups = group_id.filter(gid => !foundGroupIds.has(gid));

    if (missingGroups.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_GROUPS',
          message: `Groups not found: ${missingGroups.join(', ')}`
        }
      });
    }

    // Determine is_active based on activation_mode
    const is_active = activation_mode === 'immediate';

    // Prepare slot data
    const slotData = {
      instructor_id,
      group_id,
      slot_date,
      slot_time,
      duration_minutes: duration_minutes || 30,
      total_slots: total_slots || 1,
      location,
      is_active,
      available_from: activation_mode === 'scheduled' ? available_from : null,
      auto_approve: auto_approve !== undefined ? auto_approve : true
    };

    // Insert slot
    const { data: newSlot, error: insertError } = await supabaseAdmin
      .from('work_check_slots')
      .insert(slotData)
      .select()
      .single();

    if (insertError) {
      // Check for unique constraint violation
      if (insertError.code === '23505') {
        return res.status(409).json({
          success: false,
          error: {
            code: 'DUPLICATE_SLOT',
            message: 'A slot already exists for this instructor, groups, date, and time combination'
          }
        });
      }
      console.error('[Supabase ERROR] Failed to create slot:', insertError.message);
      throw new Error(`Failed to create slot: ${insertError.message}`);
    }

    console.log(`[Create Work Check Slot] Created slot ${newSlot.id} for instructor ${instructor.instructor_name}`);

    // Populate groups_instructors table for each group
    // This tracks instructor-group assignments with assigned_date matching slot_date
    // Note: groups_instructors.group_id is now VARCHAR referencing groups(group_id)

    // Check which assignments already exist for this instructor/date combination
    const { data: existingAssignments } = await supabaseAdmin
      .from('groups_instructors')
      .select('group_id')
      .eq('instructor_id', instructor_id)
      .eq('assigned_date', slot_date)
      .in('group_id', group_id);

    const existingGroupIds = new Set(existingAssignments?.map(a => a.group_id) || []);

    // Only insert assignments that don't already exist
    const newAssignments = group_id
      .filter(gid => !existingGroupIds.has(gid))
      .map(gid => ({
        group_id: gid,
        instructor_id: instructor_id,
        assigned_date: slot_date,
        status: 'active'
      }));

    if (newAssignments.length > 0) {
      const { error: assignmentError } = await supabaseAdmin
        .from('groups_instructors')
        .insert(newAssignments);

      if (assignmentError) {
        // Log but don't fail - the slot was created successfully
        console.warn(`[Create Work Check Slot] Warning: Could not create instructor assignments: ${assignmentError.message}`);
      } else {
        console.log(`[Create Work Check Slot] Created ${newAssignments.length} instructor-group assignments`);
      }
    } else {
      console.log(`[Create Work Check Slot] All instructor-group assignments already exist for this date`);
    }

    res.status(201).json({
      success: true,
      message: 'Work check slot created successfully',
      data: {
        ...newSlot,
        instructor_name: instructor.instructor_name
      }
    });

  } catch (error) {
    next(error);
  }
};

module.exports = { create };
