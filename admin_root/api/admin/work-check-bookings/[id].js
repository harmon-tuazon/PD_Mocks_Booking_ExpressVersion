/**
 * /api/admin/work-check-bookings/[id]
 * GET - Get single booking details
 * PUT - Update booking
 * DELETE - Delete booking
 * Permission: 'workcheck.view', 'workcheck.edit', 'workcheck.delete'
 */

const { requirePermission } = require('../middleware/requirePermission');
const { validationMiddleware } = require('../../_shared/validation');
const { supabaseAdmin } = require('../../_shared/supabase');

module.exports = async (req, res) => {
  const { id } = req.query;

  console.log(`[Work Check Booking] ${req.method} /api/admin/work-check-bookings/${id}`);

  if (!id) {
    return res.status(400).json({
      success: false,
      error: { code: 'MISSING_ID', message: 'Booking ID is required' }
    });
  }

  try {
    switch (req.method) {
      case 'GET':
        return await getBooking(req, res, id);
      case 'PUT':
        return await updateBooking(req, res, id);
      case 'DELETE':
        return await deleteBooking(req, res, id);
      default:
        res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
        return res.status(405).json({
          success: false,
          error: { code: 'METHOD_NOT_ALLOWED', message: `Method ${req.method} not allowed` }
        });
    }
  } catch (error) {
    // Auth-specific error handling
    if (error.message.includes('authorization') || error.message.includes('token') || error.message.includes('Permission denied')) {
      const statusCode = error.statusCode || 401;
      return res.status(statusCode).json({
        success: false,
        error: { code: error.code || 'UNAUTHORIZED', message: error.message }
      });
    }

    console.error('Error in work check booking endpoint:', error);

    res.status(error.status || 500).json({
      success: false,
      error: error.message || 'An error occurred'
    });
  }
};

/**
 * GET - Get single booking details
 */
async function getBooking(req, res, id) {
  await requirePermission(req, 'workcheck.view');

  const { data: booking, error } = await supabaseAdmin
    .from('work_check_bookings')
    .select(`
      *,
      slot:work_check_slots!work_check_bookings_slot_id_fkey (
        id,
        slot_date,
        slot_time,
        duration_minutes,
        location,
        group_id,
        instructor_id,
        is_active,
        instructor:instructors!work_check_slots_instructor_id_fkey (
          id,
          instructor_name,
          email
        )
      ),
      student:hubspot_contact_credits!work_check_bookings_student_id_fkey (
        student_id,
        firstname,
        lastname,
        email
      )
    `)
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Booking not found' }
      });
    }
    console.error('[Supabase ERROR] Failed to fetch booking:', error.message);
    throw new Error(`Failed to fetch booking: ${error.message}`);
  }

  // Transform response
  const transformedBooking = {
    id: booking.id,
    slot_id: booking.slot_id,
    student_id: booking.student_id,
    student_name: booking.student ?
      `${booking.student.firstname || ''} ${booking.student.lastname || ''}`.trim() :
      null,
    student_email: booking.student?.email || null,
    status: booking.status,
    type: booking.type,
    created_at: booking.created_at,
    confirmed_at: booking.confirmed_at,
    cancelled_at: booking.cancelled_at,
    marked_at: booking.marked_at,
    slot: booking.slot ? {
      id: booking.slot.id,
      slot_date: booking.slot.slot_date,
      slot_time: booking.slot.slot_time,
      duration_minutes: booking.slot.duration_minutes,
      location: booking.slot.location,
      group_id: booking.slot.group_id,
      instructor_id: booking.slot.instructor_id,
      instructor_name: booking.slot.instructor?.instructor_name || null,
      instructor_email: booking.slot.instructor?.email || null,
      is_active: booking.slot.is_active
    } : null
  };

  console.log(`[Work Check Booking] Retrieved booking ${id}`);

  res.status(200).json({
    success: true,
    data: transformedBooking
  });
}

/**
 * PUT - Update booking
 */
async function updateBooking(req, res, id) {
  await requirePermission(req, 'workcheck.edit');

  // Validate request body
  const validator = validationMiddleware('workCheckBookingUpdate');
  await new Promise((resolve, reject) => {
    validator(req, res, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });

  const updates = req.validatedData || req.body;

  console.log(`[Work Check Booking] Updating booking ${id}:`, updates);

  // Check if booking exists
  const { data: existingBooking, error: fetchError } = await supabaseAdmin
    .from('work_check_bookings')
    .select('id, status')
    .eq('id', id)
    .single();

  if (fetchError || !existingBooking) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Booking not found' }
    });
  }

  // Prepare update data
  const updateData = { ...updates };

  // Handle status change timestamps
  if (updates.status) {
    if (updates.status === 'confirmed' && existingBooking.status !== 'confirmed') {
      updateData.confirmed_at = new Date().toISOString();
    }
    if (updates.status === 'cancelled' && existingBooking.status !== 'cancelled') {
      updateData.cancelled_at = new Date().toISOString();
    }
    if (updates.status === 'marked' && existingBooking.status !== 'marked') {
      updateData.marked_at = new Date().toISOString();
    }
  }

  // Perform update
  const { data: updatedBooking, error: updateError } = await supabaseAdmin
    .from('work_check_bookings')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (updateError) {
    console.error('[Supabase ERROR] Failed to update booking:', updateError.message);
    throw new Error(`Failed to update booking: ${updateError.message}`);
  }

  console.log(`[Work Check Booking] Successfully updated booking ${id}`);

  res.status(200).json({
    success: true,
    message: 'Booking updated successfully',
    data: updatedBooking
  });
}

/**
 * DELETE - Delete booking
 */
async function deleteBooking(req, res, id) {
  await requirePermission(req, 'workcheck.delete');

  console.log(`[Work Check Booking] Deleting booking ${id}`);

  // Check if booking exists
  const { data: existingBooking, error: fetchError } = await supabaseAdmin
    .from('work_check_bookings')
    .select('id')
    .eq('id', id)
    .single();

  if (fetchError || !existingBooking) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Booking not found' }
    });
  }

  // Perform delete
  const { error: deleteError } = await supabaseAdmin
    .from('work_check_bookings')
    .delete()
    .eq('id', id);

  if (deleteError) {
    console.error('[Supabase ERROR] Failed to delete booking:', deleteError.message);
    throw new Error(`Failed to delete booking: ${deleteError.message}`);
  }

  console.log(`[Work Check Booking] Successfully deleted booking ${id}`);

  res.status(200).json({
    success: true,
    message: 'Booking deleted successfully'
  });
}
