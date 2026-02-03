/**
 * GET/PUT/DELETE /api/admin/groups/[groupId]
 * Single group operations
 * Permissions:
 *   GET: 'groups.view'
 *   PUT: 'groups.edit'
 *   DELETE: 'groups.delete'
 */

const { requirePermission } = require('../middleware/requirePermission');
const { validationMiddleware } = require('../../_shared/validation');
const { getCache } = require('../../_shared/cache');
const { supabaseAdmin } = require('../../_shared/supabase');

module.exports = async (req, res) => {
  const { groupId } = req.query;

  if (!groupId) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_REQUEST', message: 'Group ID is required' }
    });
  }

  try {
    switch (req.method) {
      case 'GET':
        return await handleGet(req, res, groupId);
      case 'PUT':
        return await handlePut(req, res, groupId);
      case 'DELETE':
        return await handleDelete(req, res, groupId);
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

    console.error(`Error in group ${req.method} operation:`, error);

    res.status(error.status || 500).json({
      success: false,
      error: error.message || 'An error occurred'
    });
  }
};

/**
 * GET - Fetch single group with students
 */
async function handleGet(req, res, id) {
  await requirePermission(req, 'groups.view');

  // Try to find by group_id first, then by UUID
  let group;
  let groupError;

  // First try group_id (custom ID like 260301AMGR1)
  const { data: byGroupId, error: error1 } = await supabaseAdmin
    .from('hubspot_sync.groups')
    .select('*')
    .eq('group_id', id)
    .single();

  if (byGroupId) {
    group = byGroupId;
  } else {
    // Try UUID
    const { data: byUuid, error: error2 } = await supabaseAdmin
      .from('hubspot_sync.groups')
      .select('*')
      .eq('id', id)
      .single();

    group = byUuid;
    groupError = error2;
  }

  if (!group) {
    return res.status(404).json({
      success: false,
      error: { code: 'GROUP_NOT_FOUND', message: `Group with ID ${id} not found` }
    });
  }

  // Fetch students for this group with contact details
  const { data: groupStudents, error: studentsError } = await supabaseAdmin
    .from('hubspot_sync.groups_students')
    .select(`
      id,
      contact_id,
      status,
      enrolled_at,
      updated_at
    `)
    .eq('group_id', group.group_id)
    .eq('status', 'active');

  let students = [];
  if (groupStudents && groupStudents.length > 0) {
    // Fetch contact details
    const contactIds = groupStudents.map(gs => gs.contact_id);
    const { data: contacts } = await supabaseAdmin
      .from('hubspot_contact_credits')
      .select('id, student_id, email, firstname, lastname')
      .in('id', contactIds);

    // Merge contact data with student assignments
    const contactMap = (contacts || []).reduce((acc, c) => {
      acc[c.id] = c;
      return acc;
    }, {});

    students = groupStudents.map(gs => ({
      assignment_id: gs.id,
      contact_id: gs.contact_id,
      status: gs.status,
      enrolled_at: gs.enrolled_at,
      student: contactMap[gs.contact_id] || null
    }));
  }

  res.status(200).json({
    success: true,
    data: {
      id: group.id,
      group_id: group.group_id,
      group_name: group.group_name,
      description: group.description,
      time_period: group.time_period,
      start_date: group.start_date,
      end_date: group.end_date,
      max_capacity: group.max_capacity,
      status: group.status,
      created_at: group.created_at,
      updated_at: group.updated_at,
      students: students,
      student_count: students.length
    }
  });
}

/**
 * PUT - Update group
 */
async function handlePut(req, res, id) {
  await requirePermission(req, 'groups.edit');

  // Validate request body
  const validator = validationMiddleware('groupUpdate');
  await new Promise((resolve, reject) => {
    validator(req, res, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });

  const updates = req.validatedData;

  // Build update object with snake_case keys
  const updateData = {};
  if (updates.groupName) updateData.group_name = updates.groupName;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.timePeriod) updateData.time_period = updates.timePeriod;
  if (updates.startDate) updateData.start_date = updates.startDate;
  if (updates.endDate !== undefined) updateData.end_date = updates.endDate;
  if (updates.maxCapacity) updateData.max_capacity = updates.maxCapacity;
  if (updates.status) updateData.status = updates.status;

  // Try to update by group_id first, then by UUID
  let result;
  let updateError;

  const { data: byGroupId, error: error1 } = await supabaseAdmin
    .from('hubspot_sync.groups')
    .update(updateData)
    .eq('group_id', id)
    .select()
    .single();

  if (byGroupId) {
    result = byGroupId;
  } else {
    const { data: byUuid, error: error2 } = await supabaseAdmin
      .from('hubspot_sync.groups')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    result = byUuid;
    updateError = error2;
  }

  if (!result) {
    return res.status(404).json({
      success: false,
      error: { code: 'GROUP_NOT_FOUND', message: `Group with ID ${id} not found` }
    });
  }

  // Invalidate cache
  const cache = getCache();
  await cache.del('admin:groups:*');
  await cache.del('admin:groups:statistics');

  res.status(200).json({
    success: true,
    message: 'Group updated successfully',
    data: result
  });
}

/**
 * DELETE - Delete group
 */
async function handleDelete(req, res, id) {
  await requirePermission(req, 'groups.delete');

  // Try to delete by group_id first, then by UUID
  let deleted;

  const { data: byGroupId, error: error1 } = await supabaseAdmin
    .from('hubspot_sync.groups')
    .delete()
    .eq('group_id', id)
    .select()
    .single();

  if (byGroupId) {
    deleted = byGroupId;
  } else {
    const { data: byUuid, error: error2 } = await supabaseAdmin
      .from('hubspot_sync.groups')
      .delete()
      .eq('id', id)
      .select()
      .single();

    deleted = byUuid;
  }

  if (!deleted) {
    return res.status(404).json({
      success: false,
      error: { code: 'GROUP_NOT_FOUND', message: `Group with ID ${id} not found` }
    });
  }

  // Invalidate cache
  const cache = getCache();
  await cache.del('admin:groups:*');
  await cache.del('admin:groups:statistics');

  res.status(200).json({
    success: true,
    message: 'Group deleted successfully',
    data: { id: deleted.id, group_id: deleted.group_id }
  });
}
