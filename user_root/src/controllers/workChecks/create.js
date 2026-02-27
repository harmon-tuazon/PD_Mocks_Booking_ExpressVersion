/**
 * POST /api/work-checks/create
 * Create a work check reservation with multi-tier duplicate prevention
 *
 * Body validated by validateBody(schemas.workCheckCreate) middleware in route
 */

const { db } = require('../../services/supabase');
const { query: dbQuery, nestRow } = require('../../services/database');
const RedisLockService = require('../../services/redis');

// Initialize Redis service
let redis;
try {
  redis = new RedisLockService();
} catch (error) {
  console.warn('Redis not available for work-checks/create:', error.message);
}

const create = async (req, res, next) => {
  let lockToken = null;
  let lockKey = null;

  try {
    const { student_id, email, slot_id, work_check_type, lab, seat } = req.body;

    console.log(`[WORK-CHECK] Creating booking: ${student_id} -> ${slot_id} (${work_check_type})`);

    // 1. Validate contact
    const { data: contact, error: contactError } = await db
      .from('hubspot_contact_credits')
      .select('id, hubspot_id, student_id, firstname, lastname')
      .eq('student_id', student_id)
      .ilike('email', email)
      .single();

    if (contactError || !contact) {
      return res.status(401).json({
        success: false,
        error: { code: 'NOT_AUTHENTICATED', message: 'Invalid credentials' }
      });
    }

    // 2. Get slot details (raw SQL with LEFT JOIN for instructor)
    let slot, slotError;
    try {
      const { rows } = await dbQuery(`
        SELECT s.*, i.id AS i__id, i.instructor_name AS i__instructor_name
        FROM work_check_slots s
        LEFT JOIN instructors i ON i.id = s.instructor_id
        WHERE s.id = $1 AND s.is_active = true
      `, [slot_id]);
      slot = rows.length > 0 ? nestRow(rows[0], { i: 'instructors' }) : null;
      slotError = null;
    } catch (err) {
      slot = null;
      slotError = { message: err.message };
    }

    if (slotError || !slot) {
      return res.status(404).json({
        success: false,
        error: { code: 'SLOT_NOT_FOUND', message: 'Slot not found or unavailable' }
      });
    }

    // 3. Check slot date is in future
    const slotDate = new Date(slot.slot_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (slotDate < today) {
      return res.status(400).json({
        success: false,
        error: { code: 'SLOT_EXPIRED', message: 'This slot is no longer available' }
      });
    }

    // 4. Verify trainee is in one of the slot's groups (group_id is array)
    const slotGroups = Array.isArray(slot.group_id) ? slot.group_id : [slot.group_id];

    const { data: groupMembership } = await db
      .from('groups_students')
      .select('id, group_id')
      .eq('student_id', contact.student_id)
      .in('group_id', slotGroups)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (!groupMembership) {
      return res.status(403).json({
        success: false,
        error: { code: 'NOT_IN_GROUP', message: 'You are not enrolled in any group that can book this slot' }
      });
    }

    // 5. Acquire distributed lock
    if (redis) {
      lockKey = `wc_slot:${slot_id}`;
      lockToken = await redis.acquireLockWithRetry(slot_id, 5, 100, 10);
      if (!lockToken) {
        return res.status(429).json({
          success: false,
          error: { code: 'BUSY', message: 'Please try again in a moment' }
        });
      }
    }

    // 6. Check slot capacity
    const { count: bookedCount, error: countError } = await db
      .from('work_check_bookings')
      .select('*', { count: 'exact', head: true })
      .eq('slot_id', slot_id)
      .in('status', ['pending', 'confirmed']);

    if (countError) throw countError;

    if (bookedCount >= slot.total_slots) {
      if (redis && lockToken) await redis.releaseLock(slot_id, lockToken);
      return res.status(400).json({
        success: false,
        error: { code: 'SLOT_FULL', message: 'This slot is no longer available' }
      });
    }

    // 7. MULTI-TIER DUPLICATE CHECK (one booking per date per student)
    // TIER 1: Redis cache check (fast path)
    if (redis) {
      const cacheKey = `wc_booking:${contact.student_id}:${slot.slot_date}`;
      const cachedBooking = await redis.get(cacheKey);

      if (cachedBooking) {
        await redis.releaseLock(slot_id, lockToken);
        console.log(`[WORK-CHECK] Duplicate blocked by Redis cache: ${student_id} on ${slot.slot_date}`);
        return res.status(400).json({
          success: false,
          error: {
            code: 'DUPLICATE_BOOKING',
            message: 'You already have a work check scheduled for this date'
          }
        });
      }
    }

    // TIER 2: Check for existing ACTIVE booking on the same SLOT
    const { data: existingSlotBooking } = await db
      .from('work_check_bookings')
      .select('id, status')
      .eq('student_id', contact.student_id)
      .eq('slot_id', slot_id)
      .in('status', ['pending', 'confirmed'])
      .maybeSingle();

    if (existingSlotBooking) {
      if (redis && lockToken) await redis.releaseLock(slot_id, lockToken);
      console.log(`[WORK-CHECK] Duplicate blocked: ${student_id} already has active booking for slot ${slot_id}`);
      return res.status(400).json({
        success: false,
        error: {
          code: 'DUPLICATE_BOOKING',
          message: 'You already have a booking for this time slot'
        }
      });
    }

    // TIER 3: Check for existing booking on the same DATE (different slot)
    let existingDateBooking;
    try {
      const { rows } = await dbQuery(`
        SELECT b.id
        FROM work_check_bookings b
        INNER JOIN work_check_slots s ON s.id = b.slot_id
        WHERE b.student_id = $1 AND s.slot_date = $2 AND b.status = ANY($3)
        LIMIT 1
      `, [contact.student_id, slot.slot_date, ['pending', 'confirmed']]);
      existingDateBooking = rows.length > 0 ? rows[0] : null;
    } catch (err) {
      existingDateBooking = null;
    }

    if (existingDateBooking) {
      if (redis) {
        const cacheKey = `wc_booking:${contact.student_id}:${slot.slot_date}`;
        await redis.setex(cacheKey, 86400, existingDateBooking.id);
        await redis.releaseLock(slot_id, lockToken);
      }
      console.log(`[WORK-CHECK] Duplicate blocked by Supabase: ${student_id} on ${slot.slot_date}`);
      return res.status(400).json({
        success: false,
        error: {
          code: 'DUPLICATE_BOOKING',
          message: 'You already have a work check scheduled for this date'
        }
      });
    }

    // 8. Determine booking status (auto-approve if slot has it enabled)
    const autoApprove = slot.auto_approve === true;

    // 9. Create booking
    const bookingData = {
      slot_id: slot.id,
      student_id: contact.student_id,
      type: work_check_type,
      status: autoApprove ? 'confirmed' : 'pending',
      ...(autoApprove && { confirmed_at: new Date().toISOString() }),
      ...(lab && { lab: lab.toUpperCase() }),
      ...(seat && { seat })
    };

    const { data: booking, error: insertError } = await db
      .from('work_check_bookings')
      .insert(bookingData)
      .select()
      .single();

    if (insertError) {
      if (redis && lockToken) await redis.releaseLock(slot_id, lockToken);
      console.error('[WORK-CHECK] Insert error:', insertError);

      if (insertError.code === '23505') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'DUPLICATE_BOOKING',
            message: 'You already have a booking for this time slot. Please choose a different slot.'
          }
        });
      }

      throw insertError;
    }

    // 10. Cache the new booking in Redis for fast duplicate prevention
    if (redis) {
      const bookingCacheKey = `wc_booking:${contact.student_id}:${slot.slot_date}`;
      await redis.setex(bookingCacheKey, 86400, booking.id);
      console.log(`[WORK-CHECK] Cached booking in Redis: ${bookingCacheKey}`);
    }

    // 11. Release lock
    if (redis && lockToken) {
      await redis.releaseLock(slot_id, lockToken);
    }

    // Calculate end time
    const [hours, minutes] = slot.slot_time.split(':').map(Number);
    const endDate = new Date();
    endDate.setHours(hours, minutes + slot.duration_minutes, 0, 0);
    const endTimeStr = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;

    // Get group name for response
    const { data: groupInfo } = await db
      .from('groups')
      .select('group_name')
      .eq('group_id', groupMembership.group_id)
      .single();

    console.log(`[WORK-CHECK] Booking created: ${booking.id} (${booking.status})`);

    return res.status(201).json({
      success: true,
      data: {
        booking_id: booking.id,
        status: booking.status,
        work_check_type: work_check_type,
        auto_approved: autoApprove,
        slot: {
          slot_date: slot.slot_date,
          slot_time: slot.slot_time,
          end_time: endTimeStr,
          instructor_name: slot.instructors?.instructor_name || 'TBD',
          group_id: groupMembership.group_id,
          group_name: groupInfo?.group_name || groupMembership.group_id,
          location: slot.location
        },
        message: autoApprove
          ? 'Your work check has been booked successfully!'
          : 'Your booking request has been submitted. You will be notified when it is confirmed.'
      }
    });

  } catch (error) {
    if (redis && lockToken && lockKey) {
      await redis.releaseLock(lockKey.replace('wc_slot:', ''), lockToken);
    }
    console.error('[WORK-CHECK] Create error:', error);

    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'DUPLICATE_BOOKING',
          message: 'You already have a booking for this time slot. Please choose a different slot.'
        }
      });
    }

    next(error);
  }
};

module.exports = { create };
