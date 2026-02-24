/**
 * GET/PUT/DELETE /api/admin/work-check-slots/:id
 * Get, update, or delete a single work check slot
 */

const { requirePermission } = require('../middleware/requirePermission');
const { validationMiddleware } = require('../../_shared/validation');
const { supabaseAdmin } = require('../../_shared/supabase');

module.exports = async (req, res) => {
  console.log('[Work Check Slots [id] API] Endpoint hit:', req.method, req.url, 'id:', req.query.id);

  const { id } = req.query;

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

  try {
    switch (req.method) {
      case 'GET':
        return await handleGet(req, res, id);
      case 'PUT':
        return await handlePut(req, res, id);
      case 'DELETE':
        return await handleDelete(req, res, id);
      default:
        res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
        return res.status(405).json({
          success: false,
          error: { code: 'METHOD_NOT_ALLOWED', message: `Method ${req.method} not allowed` }
        });
    }
  } catch (error) {
    // Auth-specific error handling
    if (error.message.includes('authorization') || error.message.includes('token') || error.message.includes('Permission denied')) {
      const statusCode = error.statusCode || 401;
      return res.status(statusCode).json({
        success: false,
        error: { code: error.code || 'UNAUTHORIZED', message: error.message }
      });
    }

    console.error(`Error in work check slot ${req.method}:`, error);

    res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Operation failed'
    });
  }
};

/**
 * GET - Fetch single slot
 */
async function handleGet(req, res, id) {
  await requirePermission(req, 'workcheck.view');

  console.log(`[Get Work Check Slot] Fetching slot ${id}`);

  const { data: slot, error } = await supabaseAdmin
    .from('work_check_slots')
    .select(`
      *,
      instructor:instructors!work_check_slots_instructor_id_fkey (
        id,
        instructor_name,
        email
      )
    `)
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Work check slot not found' }
      });
    }
    throw new Error(`Failed to fetch slot: ${error.message}`);
  }

  // Calculate activation status
  const now = new Date();
  const availableFrom = slot.available_from ? new Date(slot.available_from) : null;
  const activationStatus = !availableFrom || availableFrom <= now ? 'immediate' : 'scheduled';

  res.status(200).json({
    success: true,
    data: {
      id: slot.id,
      instructor_id: slot.instructor_id,
      instructor_name: slot.instructor?.instructor_name || null,
      instructor_email: slot.instructor?.email || null,
      group_id: slot.group_id,
      slot_date: slot.slot_date,
      slot_time: slot.slot_time,
      duration_minutes: slot.duration_minutes,
      total_slots: slot.total_slots,
      location: slot.location,
      is_active: slot.is_active,
      available_from: slot.available_from,
      activation_status: activationStatus,
      auto_approve: slot.auto_approve,
      created_at: slot.created_at,
      updated_at: slot.updated_at
    }
  });
}

/**
 * PUT - Update slot
 */
async function handlePut(req, res, id) {
  await requirePermission(req, 'workcheck.edit');

  // Validate request body
  const validator = validationMiddleware('workCheckSlotUpdate');
  await new Promise((resolve, reject) => {
    validator(req, res, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });

  const updates = req.validatedData;

  console.log(`[Update Work Check Slot] Updating slot ${id}:`, updates);

  // Check if slot exists
  const { data: existingSlot, error: fetchError } = await supabaseAdmin
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

  // Update the slot
  const { data: updatedSlot, error: updateError } = await supabaseAdmin
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
}

/**
 * DELETE - Delete slot
 */
async function handleDelete(req, res, id) {
  await requirePermission(req, 'workcheck.delete');

  console.log(`[Delete Work Check Slot] Attempting to delete slot ${id}`);

  // Check if slot exists
  const { data: existingSlot, error: fetchError } = await supabaseAdmin
    .from('work_check_slots')
    .select('id, slot_date, slot_time')
    .eq('id', id)
    .single();

  if (fetchError || !existingSlot) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Work check slot not found' }
    });
  }

  // Check for active bookings
  const { data: bookings, error: bookingsError } = await supabaseAdmin
    .from('work_check_bookings')
    .select('id')
    .eq('slot_id', id)
    .neq('status', 'Cancelled');

  if (bookingsError) {
    console.error('[Supabase ERROR] Failed to check bookings:', bookingsError.message);
    throw new Error('Failed to verify slot bookings');
  }

  if (bookings && bookings.length > 0) {
    return res.status(409).json({
      success: false,
      error: {
        code: 'SLOT_HAS_BOOKINGS',
        message: `Cannot delete slot with ${bookings.length} active booking(s). Cancel bookings first.`
      }
    });
  }

  // Delete the slot
  const { error: deleteError } = await supabaseAdmin
    .from('work_check_slots')
    .delete()
    .eq('id', id);

  if (deleteError) {
    throw new Error(`Failed to delete slot: ${deleteError.message}`);
  }

  console.log(`[Delete Work Check Slot] Successfully deleted slot ${id}`);

  res.status(200).json({
    success: true,
    message: 'Work check slot deleted successfully'
  });
}
