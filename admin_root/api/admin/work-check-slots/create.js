/**
 * POST /api/admin/work-check-slots
 * Create a new work check slot
 * Permission: 'workcheck.create'
 */

const { requirePermission } = require('../middleware/requirePermission');
const { validationMiddleware } = require('../../_shared/validation');
const { supabaseAdmin } = require('../../_shared/supabase');

module.exports = async (req, res) => {
  console.log('[Work Check Slots Create API] Endpoint hit:', req.method, req.url);

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
    const validator = validationMiddleware('workCheckSlotCreation');
    await new Promise((resolve, reject) => {
      validator(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    const {
      instructor_id,
      group_id,
      slot_date,
      slot_time,
      duration_minutes,
      total_slots,
      location,
      activation_mode,
      available_from
    } = req.validatedData;

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
      available_from: activation_mode === 'scheduled' ? available_from : null
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

    res.status(201).json({
      success: true,
      message: 'Work check slot created successfully',
      data: {
        ...newSlot,
        instructor_name: instructor.instructor_name
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

    console.error('Error in create work check slot:', error);

    res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Failed to create work check slot'
    });
  }
};
