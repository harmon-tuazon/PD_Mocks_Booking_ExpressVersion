/**
 * GET /api/work-checks/groups
 * Get authenticated user's active groups using session credentials
 * Called on page load to populate group filter and validate session
 */

const { schemas } = require('../../services/validation');
const { db } = require('../../services/supabase');
const { query: dbQuery, nestRow } = require('../../services/database');
const RedisLockService = require('../../services/redis');

// Initialize Redis service
let redis;
try {
  redis = new RedisLockService();
} catch (error) {
  console.warn('Redis not available for work-checks/groups:', error.message);
}

const groups = async (req, res, next) => {
  try {
    // Validate query parameters (session credentials)
    const { error, value } = schemas.workCheckGroups.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.details[0].message }
      });
    }

    const { student_id, email } = value;

    console.log(`[WORK-CHECK] Fetching groups for session: ${student_id}`);

    // 1. Find contact in Supabase (validate session credentials)
    const { data: contact, error: contactError } = await db
      .from('hubspot_contact_credits')
      .select('id, hubspot_id, student_id, email, firstname, lastname')
      .eq('student_id', student_id)
      .ilike('email', email)
      .single();

    if (contactError || !contact) {
      console.log(`[WORK-CHECK] Session invalid - contact not found: ${student_id}`);
      return res.status(401).json({
        success: false,
        error: {
          code: 'NOT_AUTHENTICATED',
          message: 'Session invalid. Please log in again.'
        }
      });
    }

    // 2. Get trainee's active groups (raw SQL with LEFT JOIN)
    let groupMemberships, groupError;
    try {
      const { rows } = await dbQuery(`
        SELECT gs.group_id, gs.status,
               g.group_id AS g__group_id, g.group_name AS g__group_name,
               g.time_period AS g__time_period, g.start_date AS g__start_date,
               g.end_date AS g__end_date, g.status AS g__status
        FROM groups_students gs
        LEFT JOIN groups g ON g.group_id = gs.group_id
        WHERE gs.student_id = $1 AND gs.status = $2
      `, [contact.student_id, 'active']);
      groupMemberships = rows.map(r => nestRow(r, { g: 'groups' }));
      groupError = null;
    } catch (err) {
      groupMemberships = null;
      groupError = { message: err.message };
    }

    if (groupError) {
      console.error('[WORK-CHECK] Error fetching groups:', groupError);
      throw groupError;
    }

    // Filter to active groups only
    const activeGroups = (groupMemberships || [])
      .filter(gm => gm.groups?.status === 'active')
      .map(gm => ({
        group_id: gm.groups.group_id,
        group_name: gm.groups.group_name,
        time_period: gm.groups.time_period,
        start_date: gm.groups.start_date,
        end_date: gm.groups.end_date,
        status: gm.groups.status
      }));

    if (activeGroups.length === 0) {
      console.log(`[WORK-CHECK] No active groups for: ${student_id}`);
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_ACTIVE_GROUPS',
          message: 'You are not enrolled in any active groups. Please contact support.'
        }
      });
    }

    // 3. Get existing booking dates for duplicate prevention (raw SQL with INNER JOIN)
    let existingBookings;
    try {
      const { rows } = await dbQuery(`
        SELECT b.id, s.slot_date AS s__slot_date
        FROM work_check_bookings b
        INNER JOIN work_check_slots s ON s.id = b.slot_id
        WHERE b.student_id = $1 AND b.status = ANY($2)
      `, [contact.student_id, ['pending', 'confirmed']]);
      existingBookings = rows.map(r => nestRow(r, { s: 'work_check_slots' }));
    } catch (err) {
      existingBookings = [];
    }

    const existingBookingDates = (existingBookings || [])
      .map(b => b.work_check_slots?.slot_date)
      .filter(Boolean);

    // 4. Cache existing booking dates in Redis for fast duplicate check
    if (redis && existingBookingDates.length > 0) {
      for (const date of existingBookingDates) {
        const cacheKey = `wc_booking:${contact.student_id}:${date}`;
        await redis.setex(cacheKey, 86400, 'exists');
      }
    }

    console.log(`[WORK-CHECK] Session valid: ${student_id} with ${activeGroups.length} groups, ${existingBookingDates.length} existing bookings`);

    return res.status(200).json({
      success: true,
      data: {
        student_id: contact.student_id,
        uuid: contact.id,
        firstname: contact.firstname,
        lastname: contact.lastname,
        groups: activeGroups,
        existing_booking_dates: existingBookingDates
      }
    });

  } catch (error) {
    console.error('[WORK-CHECK] Groups fetch error:', error);
    next(error);
  }
};

module.exports = { groups };
