/**
 * DELETE /api/work-checks/:id
 * Cancel a work check booking
 *
 * Body validated by validateBody(schemas.workCheckCancel) middleware in route
 */

const { db } = require('../../services/supabase');
const RedisLockService = require('../../services/redis');

// Initialize Redis service
let redis;
try {
  redis = new RedisLockService();
} catch (error) {
  console.warn('Redis not available for work-checks/cancel:', error.message);
}

const cancel = async (req, res, next) => {
  try {
    // Get booking ID from URL params (Express :id)
    const bookingId = req.params.id;
    if (!bookingId) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_ID', message: 'Booking ID is required' }
      });
    }

    const { student_id, email, reason } = req.body;

    console.log(`[WORK-CHECK] Cancelling booking: ${bookingId} for ${student_id}`);

    // 1. Validate contact
    const { data: contact, error: contactError } = await db
      .from('hubspot_contact_credits')
      .select('id, student_id')
      .eq('student_id', student_id)
      .ilike('email', email)
      .single();

    if (contactError || !contact) {
      return res.status(401).json({
        success: false,
        error: { code: 'NOT_AUTHENTICATED', message: 'Invalid credentials' }
      });
    }

    // 2. Get the booking and verify ownership
    const { data: booking, error: bookingError } = await db
      .from('work_check_bookings')
      .select(`
        id,
        slot_id,
        student_id,
        status,
        work_check_slots (
          slot_date,
          slot_time
        )
      `)
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      return res.status(404).json({
        success: false,
        error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found' }
      });
    }

    // 3. Verify the booking belongs to the user
    if (booking.student_id !== contact.student_id) {
      return res.status(403).json({
        success: false,
        error: { code: 'NOT_AUTHORIZED', message: 'You are not authorized to cancel this booking' }
      });
    }

    // 4. Check if booking can be cancelled
    if (booking.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        error: { code: 'ALREADY_CANCELLED', message: 'This booking has already been cancelled' }
      });
    }

    if (booking.status === 'rejected') {
      return res.status(400).json({
        success: false,
        error: { code: 'ALREADY_REJECTED', message: 'This booking has already been rejected' }
      });
    }

    // 5. Check if the slot date is in the past
    const slotDate = new Date(booking.work_check_slots?.slot_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (slotDate < today) {
      return res.status(400).json({
        success: false,
        error: { code: 'PAST_BOOKING', message: 'Cannot cancel a past booking' }
      });
    }

    // 6. Update the booking status to cancelled
    const { data: updatedBooking, error: updateError } = await db
      .from('work_check_bookings')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString()
      })
      .eq('id', bookingId)
      .select()
      .single();

    if (updateError) {
      console.error('[WORK-CHECK] Cancel update error:', updateError);
      throw updateError;
    }

    // 7. Clear the Redis cache for this date
    if (redis && booking.work_check_slots?.slot_date) {
      const cacheKey = `wc_booking:${contact.student_id}:${booking.work_check_slots.slot_date}`;
      await redis.del(cacheKey);
      console.log(`[WORK-CHECK] Cleared Redis cache: ${cacheKey}`);
    }

    console.log(`[WORK-CHECK] Booking cancelled: ${bookingId}`);

    return res.status(200).json({
      success: true,
      data: {
        booking_id: updatedBooking.id,
        status: 'cancelled',
        message: 'Your work check booking has been cancelled.'
      }
    });

  } catch (error) {
    console.error('[WORK-CHECK] Cancel error:', error);
    next(error);
  }
};

module.exports = { cancel };
