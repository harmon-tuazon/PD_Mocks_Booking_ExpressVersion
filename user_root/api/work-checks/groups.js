/**
 * GET /api/work-checks/groups
 * Get authenticated user's active groups using session credentials
 * Called on page load to populate group filter and validate session
 */

const { schemas } = require('../_shared/validation');
const { supabaseAdmin } = require('../_shared/supabase');
const RedisLockService = require('../_shared/redis');

// Initialize Redis service
let redis;
try {
  redis = new RedisLockService();
} catch (error) {
  console.warn('⚠️ Redis not available for work-checks/groups:', error.message);
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET requests are allowed' }
    });
  }

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

    console.log(`🔍 [WORK-CHECK] Fetching groups for session: ${student_id}`);

    // 1. Find contact in Supabase (validate session credentials)
    const { data: contact, error: contactError } = await supabaseAdmin
      .from('hubspot_contact_credits')
      .select('id, hubspot_id, student_id, email, firstname, lastname')
      .eq('student_id', student_id)
      .ilike('email', email)
      .single();

    if (contactError || !contact) {
      console.log(`❌ [WORK-CHECK] Session invalid - contact not found: ${student_id}`);
      return res.status(401).json({
        success: false,
        error: {
          code: 'NOT_AUTHENTICATED',
          message: 'Session invalid. Please log in again.'
        }
      });
    }

    // 2. Get trainee's active groups (using groups_students table)
    const { data: groupMemberships, error: groupError } = await supabaseAdmin
      .from('groups_students')
      .select(`
        group_id,
        status,
        groups (
          group_id,
          group_name,
          time_period,
          start_date,
          end_date,
          status
        )
      `)
      .eq('student_id', contact.id)
      .eq('status', 'active');

    if (groupError) {
      console.error('❌ [WORK-CHECK] Error fetching groups:', groupError);
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
      console.log(`❌ [WORK-CHECK] No active groups for: ${student_id}`);
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_ACTIVE_GROUPS',
          message: 'You are not enrolled in any active groups. Please contact support.'
        }
      });
    }

    // 3. Get existing booking dates for duplicate prevention
    const { data: existingBookings } = await supabaseAdmin
      .from('work_check_bookings')
      .select(`
        id,
        work_check_slots!inner (slot_date)
      `)
      .eq('student_id', contact.id)
      .in('status', ['pending', 'confirmed']);

    const existingBookingDates = (existingBookings || [])
      .map(b => b.work_check_slots?.slot_date)
      .filter(Boolean);

    // 4. Cache existing booking dates in Redis for fast duplicate check
    if (redis && existingBookingDates.length > 0) {
      for (const date of existingBookingDates) {
        const cacheKey = `wc_booking:${contact.id}:${date}`;
        await redis.setex(cacheKey, 86400, 'exists'); // 24-hour TTL
      }
    }

    console.log(`✅ [WORK-CHECK] Session valid: ${student_id} with ${activeGroups.length} groups, ${existingBookingDates.length} existing bookings`);

    return res.status(200).json({
      success: true,
      data: {
        student_id: contact.id,           // UUID for Supabase operations
        student_code: contact.student_id, // Human-readable student ID (e.g., PREP001)
        firstname: contact.firstname,
        lastname: contact.lastname,
        groups: activeGroups,
        existing_booking_dates: existingBookingDates
      }
    });

  } catch (error) {
    console.error('❌ [WORK-CHECK] Groups fetch error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to load groups' }
    });
  }
};
