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

    // Collect all unique group IDs (from target_groups or source slots)
    let allGroupIds = [];
    if (target_groups && target_groups.length > 0) {
      allGroupIds = target_groups;
    } else {
      // Collect all unique group IDs from source slots
      const groupIdSet = new Set();
      sourceSlots.forEach(slot => {
        if (Array.isArray(slot.group_id)) {
          slot.group_id.forEach(gid => groupIdSet.add(gid));
        }
      });
      allGroupIds = Array.from(groupIdSet);
    }

    // Verify groups exist and get their UUIDs for groups_instructors
    let groupUuidMap = {};
    if (allGroupIds.length > 0) {
      const { data: groups, error: groupsError } = await supabaseAdmin
        .from('groups')
        .select('id, group_id')
        .in('group_id', allGroupIds);

      if (groupsError) {
        throw new Error('Failed to verify groups');
      }

      const foundGroupIds = new Set(groups?.map(g => g.group_id) || []);
      const missingGroups = allGroupIds.filter(gid => !foundGroupIds.has(gid));

      if (missingGroups.length > 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_GROUPS',
            message: `Groups not found: ${missingGroups.join(', ')}`
          }
        });
      }

      // Build UUID map for groups_instructors
      groupUuidMap = groups.reduce((acc, g) => {
        acc[g.group_id] = g.id;
        return acc;
      }, {});
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

    // Populate groups_instructors table for each unique instructor-group-date combination
    // This tracks instructor-group assignments with assigned_date matching the cloned slot's date
    if (Object.keys(groupUuidMap).length > 0) {
      // Collect unique (instructor_id, group_uuid, slot_date) combinations from newSlots
      const assignmentSet = new Map(); // Use Map to deduplicate

      newSlots.forEach(slot => {
        const groupIds = Array.isArray(slot.group_id) ? slot.group_id : [slot.group_id];
        groupIds.forEach(gid => {
          const groupUuid = groupUuidMap[gid];
          if (groupUuid) {
            const key = `${slot.instructor_id}|${groupUuid}|${slot.slot_date}`;
            if (!assignmentSet.has(key)) {
              assignmentSet.set(key, {
                group_id: groupUuid,
                instructor_id: slot.instructor_id,
                assigned_date: slot.slot_date,
                status: 'active'
              });
            }
          }
        });
      });

      const potentialAssignments = Array.from(assignmentSet.values());

      if (potentialAssignments.length > 0) {
        // Check which assignments already exist
        const { data: existingAssignments } = await supabaseAdmin
          .from('groups_instructors')
          .select('group_id, instructor_id, assigned_date')
          .in('group_id', potentialAssignments.map(a => a.group_id))
          .in('instructor_id', [...new Set(potentialAssignments.map(a => a.instructor_id))])
          .in('assigned_date', [...new Set(potentialAssignments.map(a => a.assigned_date))]);

        // Create set of existing keys for quick lookup
        const existingKeys = new Set(
          (existingAssignments || []).map(a => `${a.instructor_id}|${a.group_id}|${a.assigned_date}`)
        );

        // Filter to only new assignments
        const newAssignments = potentialAssignments.filter(a => {
          const key = `${a.instructor_id}|${a.group_id}|${a.assigned_date}`;
          return !existingKeys.has(key);
        });

        if (newAssignments.length > 0) {
          const { error: assignmentError } = await supabaseAdmin
            .from('groups_instructors')
            .insert(newAssignments);

          if (assignmentError) {
            // Log but don't fail - the slots were created successfully
            console.warn(`[Clone Slots] Warning: Could not create instructor assignments: ${assignmentError.message}`);
          } else {
            console.log(`[Clone Slots] Created ${newAssignments.length} instructor-group assignments`);
          }
        } else {
          console.log(`[Clone Slots] All instructor-group assignments already exist for the target dates`);
        }
      }
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
