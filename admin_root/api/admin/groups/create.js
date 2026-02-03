/**
 * POST /api/admin/groups/create
 * Create a new group
 * Permission: 'groups.create'
 */

const { requirePermission } = require('../middleware/requirePermission');
const { validationMiddleware } = require('../../_shared/validation');
const { getCache } = require('../../_shared/cache');
const { supabaseAdmin } = require('../../_shared/supabase');

/**
 * Generate unique group ID
 * Pattern: YYMMDD{AM|PM}{GroupName initials}
 * Examples: 260301AMGR1, 260301PMGR2
 */
function generateGroupId(startDate, timePeriod, groupName) {
  const date = new Date(startDate);
  const year = date.getUTCFullYear().toString().slice(-2);
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = date.getUTCDate().toString().padStart(2, '0');
  const period = timePeriod.toUpperCase();

  // Extract letters from group name
  const cleanName = groupName.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const firstTwo = cleanName.substring(0, 2) || 'GR';
  const lastChar = cleanName.charAt(cleanName.length - 1) || '1';

  return `${year}${month}${day}${period}${firstTwo}${lastChar}`;
}

module.exports = async (req, res) => {
  try {
    // Verify admin authentication and permission
    const user = await requirePermission(req, 'groups.create');

    // Validate request body
    const validator = validationMiddleware('groupCreation');
    await new Promise((resolve, reject) => {
      validator(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    const {
      groupName,
      description,
      timePeriod,
      startDate,
      endDate,
      maxCapacity
    } = req.validatedData;

    // Generate group ID
    let groupId = generateGroupId(startDate, timePeriod, groupName);

    // Check for uniqueness and retry with suffix if needed
    let attempts = 0;
    const maxAttempts = 10;
    let isUnique = false;

    while (!isUnique && attempts < maxAttempts) {
      const { data: existing } = await supabaseAdmin
        .from('groups')
        .select('group_id')
        .eq('group_id', groupId)
        .single();

      if (!existing) {
        isUnique = true;
      } else {
        attempts++;
        groupId = `${generateGroupId(startDate, timePeriod, groupName)}${attempts}`;
      }
    }

    if (!isUnique) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'GROUP_ID_CONFLICT',
          message: 'Unable to generate unique group ID. Please try a different name.'
        }
      });
    }

    // Create group in Supabase
    const { data: newGroup, error } = await supabaseAdmin
      .from('groups')
      .insert({
        group_id: groupId,
        group_name: groupName,
        description: description || null,
        time_period: timePeriod,
        start_date: startDate,
        end_date: endDate || null,
        max_capacity: maxCapacity || 20,
        status: 'active'
      })
      .select()
      .single();

    if (error) {
      console.error('[Supabase ERROR]', error.message);

      if (error.code === '23505') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'GROUP_ID_EXISTS',
            message: 'A group with this ID already exists'
          }
        });
      }

      throw new Error(`Failed to create group: ${error.message}`);
    }

    // Invalidate cache
    const cache = getCache();
    await cache.del('admin:groups:*');
    await cache.del('admin:groups:statistics');

    console.log(`[Group Created] ${groupId} - ${groupName}`);

    res.status(201).json({
      success: true,
      message: 'Group created successfully',
      data: {
        id: newGroup.id,
        group_id: newGroup.group_id,
        group_name: newGroup.group_name,
        description: newGroup.description,
        time_period: newGroup.time_period,
        start_date: newGroup.start_date,
        end_date: newGroup.end_date,
        max_capacity: newGroup.max_capacity,
        status: newGroup.status,
        created_at: newGroup.created_at
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

    console.error('Error creating group:', error);

    res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Failed to create group'
    });
  }
};
