/**
 * POST /api/admin/groups/[groupId]/clone
 * Clone a group with optional student assignments
 * Permission: 'groups.create'
 */

const { requirePermission } = require('../../middleware/requirePermission');
const { validationMiddleware } = require('../../../_shared/validation');
const { getCache } = require('../../../_shared/cache');
const { supabaseAdmin } = require('../../../_shared/supabase');

/**
 * Generate unique group ID
 */
function generateGroupId(startDate, timePeriod, groupName) {
  const date = new Date(startDate);
  const year = date.getUTCFullYear().toString().slice(-2);
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = date.getUTCDate().toString().padStart(2, '0');
  const period = timePeriod.toUpperCase();

  const cleanName = groupName.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const firstTwo = cleanName.substring(0, 2) || 'GR';
  const lastChar = cleanName.charAt(cleanName.length - 1) || '1';

  return `${year}${month}${day}${period}${firstTwo}${lastChar}`;
}

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
    await requirePermission(req, 'groups.create');

    const { groupId } = req.query;

    if (!groupId) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'Source group ID is required' }
      });
    }

    // Validate request body
    const validator = validationMiddleware('groupClone');
    await new Promise((resolve, reject) => {
      validator(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    const {
      groupName,
      timePeriod,
      startDate,
      endDate,
      maxCapacity,
      includeStudents
    } = req.validatedData;

    // Find source group
    let sourceGroup;
    const { data: byGroupIdResult } = await supabaseAdmin
      .from('groups')
      .select('*')
      .eq('group_id', groupId)
      .single();

    if (byGroupIdResult) {
      sourceGroup = byGroupIdResult;
    } else {
      const { data: byUuid } = await supabaseAdmin
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single();
      sourceGroup = byUuid;
    }

    if (!sourceGroup) {
      return res.status(404).json({
        success: false,
        error: { code: 'GROUP_NOT_FOUND', message: `Source group ${groupId} not found` }
      });
    }

    // Generate new group ID
    let newGroupId = generateGroupId(startDate, timePeriod, groupName);
    let attempts = 0;
    const maxAttempts = 10;
    let isUnique = false;

    while (!isUnique && attempts < maxAttempts) {
      const { data: existing } = await supabaseAdmin
        .from('groups')
        .select('group_id')
        .eq('group_id', newGroupId)
        .single();

      if (!existing) {
        isUnique = true;
      } else {
        attempts++;
        newGroupId = `${generateGroupId(startDate, timePeriod, groupName)}${attempts}`;
      }
    }

    if (!isUnique) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'GROUP_ID_CONFLICT',
          message: 'Unable to generate unique group ID'
        }
      });
    }

    // Create new group
    const { data: newGroup, error: createError } = await supabaseAdmin
      .from('groups')
      .insert({
        group_id: newGroupId,
        group_name: groupName,
        time_period: timePeriod,
        start_date: startDate,
        end_date: endDate || null,
        max_capacity: maxCapacity || sourceGroup.max_capacity,
        status: 'active'
      })
      .select()
      .single();

    if (createError) {
      throw new Error(`Failed to create group: ${createError.message}`);
    }

    let clonedStudents = 0;

    // Clone students if requested
    if (includeStudents) {
      const { data: sourceStudents, error: studentsError } = await supabaseAdmin
        .from('groups_students')
        .select('student_id')
        .eq('group_id', sourceGroup.group_id)
        .eq('status', 'active');

      if (sourceStudents && sourceStudents.length > 0) {
        const studentInserts = sourceStudents.map(s => ({
          group_id: newGroupId,
          student_id: s.student_id,
          status: 'active'
        }));

        const { error: insertError } = await supabaseAdmin
          .from('groups_students')
          .insert(studentInserts);

        if (!insertError) {
          clonedStudents = studentInserts.length;
        } else {
          console.error('Failed to clone students:', insertError.message);
        }
      }
    }

    // Invalidate cache
    const cache = getCache();
    await cache.deletePattern('admin:groups:*');
    await cache.delete('admin:groups:statistics');

    console.log(`[Group Cloned] ${sourceGroup.group_id} -> ${newGroupId} (${clonedStudents} students)`);

    res.status(201).json({
      success: true,
      message: `Group cloned successfully. ${clonedStudents} students copied.`,
      data: {
        id: newGroup.id,
        group_id: newGroup.group_id,
        group_name: newGroup.group_name,
        time_period: newGroup.time_period,
        start_date: newGroup.start_date,
        end_date: newGroup.end_date,
        max_capacity: newGroup.max_capacity,
        status: newGroup.status,
        clonedStudents,
        sourceGroup: {
          id: sourceGroup.id,
          group_id: sourceGroup.group_id,
          group_name: sourceGroup.group_name
        }
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

    console.error('Error cloning group:', error);

    res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Failed to clone group'
    });
  }
};
