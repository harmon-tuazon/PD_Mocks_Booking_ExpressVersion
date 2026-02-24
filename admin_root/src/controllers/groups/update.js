/**
 * PUT /api/admin/groups/:groupId
 * Update a group
 * Permission: 'groups.edit'
 */

const { requirePermission } = require('../../middleware/requirePermission');
const { validationMiddleware } = require('../../services/validation');
const { getCache } = require('../../services/cache');
const { supabaseAdmin } = require('../../services/supabase');

const update = async (req, res, next) => {
  try {
    await requirePermission(req, 'groups.edit');

    const { groupId } = req.params;

    if (!groupId) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'Group ID is required' }
      });
    }

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
    if (updates.location) updateData.location = updates.location;
    if (updates.timePeriod) updateData.time_period = updates.timePeriod;
    if (updates.startDate) updateData.start_date = updates.startDate;
    if (updates.endDate !== undefined) updateData.end_date = updates.endDate;
    if (updates.maxCapacity) updateData.max_capacity = updates.maxCapacity;
    if (updates.status) updateData.status = updates.status;
    if (updates.cycle !== undefined) updateData.cycle = updates.cycle;
    if (updates.phase) updateData.phase = updates.phase;

    // Try to update by group_id first, then by UUID
    let result;

    const { data: byGroupId } = await supabaseAdmin
      .from('groups')
      .update(updateData)
      .eq('group_id', groupId)
      .select()
      .single();

    if (byGroupId) {
      result = byGroupId;
    } else {
      const { data: byUuid } = await supabaseAdmin
        .from('groups')
        .update(updateData)
        .eq('id', groupId)
        .select()
        .single();

      result = byUuid;
    }

    if (!result) {
      return res.status(404).json({
        success: false,
        error: { code: 'GROUP_NOT_FOUND', message: `Group with ID ${groupId} not found` }
      });
    }

    const cache = getCache();
    await cache.deletePattern('admin:groups:*');
    await cache.delete('admin:groups:statistics');

    res.status(200).json({
      success: true,
      message: 'Group updated successfully',
      data: result
    });

  } catch (error) {
    if (error.message.includes('authorization') || error.message.includes('token') || error.message.includes('Permission denied')) {
      const statusCode = error.statusCode || 401;
      return res.status(statusCode).json({
        success: false,
        error: { code: error.code || 'UNAUTHORIZED', message: error.message }
      });
    }

    console.error('Error updating group:', error);
    next(error);
  }
};

module.exports = { update };
