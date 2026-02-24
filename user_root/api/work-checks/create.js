/**
 * POST /api/work-checks/create
 * Create a work check reservation with multi-tier duplicate prevention
 */

const { schemas } = require('../_shared/validation');
const { supabaseAdmin } = require('../_shared/supabase');
const RedisLockService = require('../_shared/redis');

// Initialize Redis service
let redis;
try {
  redis = new RedisLockService();
} catch (error) {
  console.warn('⚠️ Redis not available for work-checks/create:', error.message);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Only POST requests are allowed' }
    });
  }

  let lockToken = null;
  let lockKey = null;

  try {
    // Validate request body
    const { error, value } = schemas.workCheckCreate.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.details[0].message }
      });
    }

    const { student_id, email, slot_id, work_check_type, lab, seat } = value;

    console.log(`📝 [WORK-CHECK] Creating booking: ${student_id} -> ${slot_id} (${work_check_type})`);

    // 1. Validate contact
    const { data: contact, error: contactError } = await supabaseAdmin
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

    // 2. Get slot details
    const { data: slot, error: slotError } = await supabaseAdmin
      .from('work_check_slots')
      .select(`
        *,
        instructors (id, instructor_name)
      `)
      .eq('id', slot_id)
      .eq('is_active', true)
      .single();

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
    // Note: groups_students.student_id references hubspot_contact_credits.student_id (string), not id (UUID)
    const slotGroups = Array.isArray(slot.group_id) ? slot.group_id : [slot.group_id];

    const { data: groupMembership } = await supabaseAdmin
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
    const { count: bookedCount, error: countError } = await supabaseAdmin
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
        console.log(`⚠️ [WORK-CHECK] Duplicate blocked by Redis cache: ${student_id} on ${slot.slot_date}`);
        return res.status(400).json({
          success: false,
          error: {
            code: 'DUPLICATE_BOOKING',
            message: 'You already have a work check scheduled for this date'
          }
        });
      }
    }

    // TIER 2: Check for existing ACTIVE booking on the same SLOT (pending/confirmed only)
    const { data: existingSlotBooking } = await supabaseAdmin
      .from('work_check_bookings')
      .select('id, status')
      .eq('student_id', contact.student_id)
      .eq('slot_id', slot_id)
      .in('status', ['pending', 'confirmed'])
      .maybeSingle();

    if (existingSlotBooking) {
      // Existing active booking - block with friendly message
      if (redis && lockToken) await redis.releaseLock(slot_id, lockToken);
      console.log(`⚠️ [WORK-CHECK] Duplicate blocked: ${student_id} already has active booking for slot ${slot_id}`);
      return res.status(400).json({
        success: false,
        error: {
          code: 'DUPLICATE_BOOKING',
          message: 'You already have a booking for this time slot'
        }
      });
    }

    // TIER 3: Check for existing booking on the same DATE (different slot)
    const { data: existingDateBooking } = await supabaseAdmin
      .from('work_check_bookings')
      .select(`
        id,
        work_check_slots!inner (slot_date)
      `)
      .eq('student_id', contact.student_id)
      .eq('work_check_slots.slot_date', slot.slot_date)
      .in('status', ['pending', 'confirmed'])
      .maybeSingle();

    if (existingDateBooking) {
      // Cache for fast path next time
      if (redis) {
        const cacheKey = `wc_booking:${contact.student_id}:${slot.slot_date}`;
        await redis.setex(cacheKey, 86400, existingDateBooking.id); // 24-hour TTL
        await redis.releaseLock(slot_id, lockToken);
      }
      console.log(`⚠️ [WORK-CHECK] Duplicate blocked by Supabase: ${student_id} on ${slot.slot_date}`);
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
      type: work_check_type,  // Column is named 'type' in work_check_bookings table
      status: autoApprove ? 'confirmed' : 'pending',
      ...(autoApprove && { confirmed_at: new Date().toISOString() }),
      ...(lab && { lab: lab.toUpperCase() }),
      ...(seat && { seat })
    };

    const { data: booking, error: insertError } = await supabaseAdmin
      .from('work_check_bookings')
      .insert(bookingData)
      .select()
      .single();

    if (insertError) {
      if (redis && lockToken) await redis.releaseLock(slot_id, lockToken);
      console.error('❌ [WORK-CHECK] Insert error:', insertError);

      // Handle unique constraint violation with user-friendly message
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
      await redis.setex(bookingCacheKey, 86400, booking.id); // 24-hour TTL
      console.log(`📦 [WORK-CHECK] Cached booking in Redis: ${bookingCacheKey}`);
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
    const { data: groupInfo } = await supabaseAdmin
      .from('groups')
      .select('group_name')
      .eq('group_id', groupMembership.group_id)
      .single();

    console.log(`✅ [WORK-CHECK] Booking created: ${booking.id} (${booking.status})`);

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
    console.error('❌ [WORK-CHECK] Create error:', error);

    // Handle specific database errors with user-friendly messages
    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'DUPLICATE_BOOKING',
          message: 'You already have a booking for this time slot. Please choose a different slot.'
        }
      });
    }

    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Unable to complete your booking. Please try again.' }
    });
  }
};
