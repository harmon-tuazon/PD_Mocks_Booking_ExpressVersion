/**
 * GET /api/admin/groups/statistics
 * Get group statistics
 * Permission: 'groups.view'
 */

const { requirePermission } = require('../middleware/requirePermission');
const { getCache } = require('../../_shared/cache');
const { supabaseAdmin } = require('../../_shared/supabase');

module.exports = async (req, res) => {
  try {
    // Verify admin authentication and permission
    const user = await requirePermission(req, 'groups.view');

    // Check for debug mode to bypass cache
    const debugMode = req.query.debug === 'true';

    // Initialize cache
    const cache = getCache();
    const cacheKey = 'admin:groups:statistics';

    // Check cache first (unless debug mode)
    if (!debugMode) {
      const cachedData = await cache.get(cacheKey);
      if (cachedData) {
        console.log(`[Cache HIT] ${cacheKey}`);
        return res.status(200).json(cachedData);
      }
    }

    console.log(`[Cache MISS] Fetching group statistics...`);

    // Get all groups
    const { data: groups, error: groupsError } = await supabaseAdmin
      .from('hubspot_sync.groups')
      .select('id, group_id, status, max_capacity');

    if (groupsError) {
      throw new Error(`Failed to fetch groups: ${groupsError.message}`);
    }

    // Get all active student assignments
    const { data: students, error: studentsError } = await supabaseAdmin
      .from('hubspot_sync.groups_students')
      .select('group_id')
      .eq('status', 'active');

    if (studentsError) {
      throw new Error(`Failed to fetch student assignments: ${studentsError.message}`);
    }

    // Calculate statistics
    const totalGroups = groups.length;
    const activeGroups = groups.filter(g => g.status === 'active').length;
    const inactiveGroups = groups.filter(g => g.status === 'inactive').length;
    const completedGroups = groups.filter(g => g.status === 'completed').length;

    // Count students per group
    const studentCountByGroup = students.reduce((acc, s) => {
      acc[s.group_id] = (acc[s.group_id] || 0) + 1;
      return acc;
    }, {});

    const totalStudents = students.length;
    const uniqueStudentCounts = Object.values(studentCountByGroup);
    const averageSize = totalGroups > 0
      ? uniqueStudentCounts.reduce((a, b) => a + b, 0) / totalGroups
      : 0;

    // Calculate total capacity
    const totalCapacity = groups.reduce((acc, g) => acc + (g.max_capacity || 0), 0);
    const utilizationRate = totalCapacity > 0
      ? Math.round((totalStudents / totalCapacity) * 100)
      : 0;

    const response = {
      success: true,
      data: {
        total: totalGroups,
        active: activeGroups,
        inactive: inactiveGroups,
        completed: completedGroups,
        totalStudents: totalStudents,
        averageSize: Math.round(averageSize * 10) / 10,
        totalCapacity: totalCapacity,
        utilizationRate: utilizationRate
      }
    };

    // Cache the response (2 minutes TTL)
    await cache.set(cacheKey, response, 120);
    console.log(`[Cached] Group statistics for 2 minutes`);

    res.status(200).json(response);

  } catch (error) {
    // Auth-specific error handling
    if (error.message.includes('authorization') || error.message.includes('token') || error.message.includes('Permission denied')) {
      const statusCode = error.statusCode || 401;
      return res.status(statusCode).json({
        success: false,
        error: { code: error.code || 'UNAUTHORIZED', message: error.message }
      });
    }

    console.error('Error fetching group statistics:', error);

    res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Failed to fetch group statistics'
    });
  }
};
