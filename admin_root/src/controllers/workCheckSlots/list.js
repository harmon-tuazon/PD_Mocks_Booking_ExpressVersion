/**
 * GET /api/admin/work-check-slots
 * List work check slots with pagination, filtering, and sorting
 * Permission: 'workcheck.view'
 */

const { requirePermission } = require('../../middleware/requirePermission');
const { query: dbQuery } = require('../../services/database');

const list = async (req, res, next) => {
  try {
    // Verify admin authentication and permission
    await requirePermission(req, 'workcheck.view');

    const {
      page,
      limit,
      instructor_id,
      group_id,
      location,
      date_from,
      date_to,
      is_active,
      activation_status,
      sort_by,
      sort_order
    } = req.validatedData || req.query;

    console.log('[Work Check Slots List] Fetching with params:', {
      page, limit, instructor_id, group_id, location, date_from, date_to, is_active, activation_status, sort_by, sort_order
    });

    // Build raw SQL query with LEFT JOIN for instructor data
    let sql = `
      SELECT s.*,
             i.id AS i__id, i.instructor_name AS i__instructor_name, i.email AS i__email,
             COUNT(*) OVER() AS __total_count
      FROM work_check_slots s
      LEFT JOIN instructors i ON i.id = s.instructor_id
      WHERE 1=1
    `;
    const params = [];
    let paramIdx = 1;

    // Apply instructor filter
    if (instructor_id) {
      sql += ` AND s.instructor_id = $${paramIdx}`;
      params.push(instructor_id);
      paramIdx++;
    }

    // Apply group filter (array contains)
    if (group_id) {
      sql += ` AND s.group_id @> $${paramIdx}`;
      params.push(JSON.stringify([group_id]));
      paramIdx++;
    }

    // Apply location filter
    if (location) {
      sql += ` AND s.location = $${paramIdx}`;
      params.push(location);
      paramIdx++;
    }

    // Apply date range filters
    if (date_from) {
      sql += ` AND s.slot_date >= $${paramIdx}`;
      params.push(date_from);
      paramIdx++;
    }
    if (date_to) {
      sql += ` AND s.slot_date <= $${paramIdx}`;
      params.push(date_to);
      paramIdx++;
    }

    // Apply active status filter
    if (is_active && is_active !== 'all') {
      sql += ` AND s.is_active = $${paramIdx}`;
      params.push(is_active === 'true');
      paramIdx++;
    }

    // Apply activation status filter
    if (activation_status && activation_status !== 'all') {
      const now = new Date().toISOString();
      if (activation_status === 'scheduled') {
        sql += ` AND s.available_from IS NOT NULL AND s.available_from > $${paramIdx}`;
        params.push(now);
        paramIdx++;
      } else if (activation_status === 'immediate') {
        sql += ` AND (s.available_from IS NULL OR s.available_from <= $${paramIdx})`;
        params.push(now);
        paramIdx++;
      }
    }

    // Apply sorting
    const allowedSortColumns = ['slot_date', 'slot_time', 'location', 'is_active', 'created_at', 'updated_at', 'instructor_name'];
    let sortColumn = allowedSortColumns.includes(sort_by) ? sort_by : 'slot_date';
    const sortDir = sort_order === 'asc' ? 'ASC' : 'DESC';

    // Handle instructor_name sorting via joined table
    if (sortColumn === 'instructor_name') {
      sql += ` ORDER BY i.instructor_name ${sortDir}`;
    } else {
      sql += ` ORDER BY s.${sortColumn} ${sortDir}`;
    }

    // Secondary sort by slot_time for consistency
    if (sortColumn === 'slot_date') {
      sql += `, s.slot_time ASC`;
    }

    // Apply pagination
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 50;
    const offset = (pageNum - 1) * limitNum;
    sql += ` LIMIT ${parseInt(limitNum)} OFFSET ${parseInt(offset)}`;

    const result = await dbQuery(sql, params);
    const rows = result.rows;

    // Extract total count and transform results
    const totalRecords = rows.length > 0 ? parseInt(rows[0].__total_count || 0) : 0;

    const transformedSlots = rows.map(slot => {
      // Calculate activation status
      const now = new Date();
      const availableFrom = slot.available_from ? new Date(slot.available_from) : null;
      const activationStatus = !availableFrom || availableFrom <= now ? 'immediate' : 'scheduled';

      return {
        id: slot.id,
        instructor_id: slot.instructor_id,
        instructor_name: slot.i__instructor_name || null,
        instructor_email: slot.i__email || null,
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
      };
    });

    const totalPages = Math.ceil(totalRecords / limitNum);

    const response = {
      success: true,
      pagination: {
        current_page: pageNum,
        total_pages: totalPages,
        total_records: totalRecords,
        records_per_page: limitNum
      },
      data: transformedSlots
    };

    console.log(`[Work Check Slots List] Returning ${transformedSlots.length} of ${totalRecords} slots`);

    res.status(200).json(response);

  } catch (error) {
    next(error);
  }
};

module.exports = { list };
