/**
 * Update Work Check Booking Controller
 * PUT /api/admin/work-check-bookings/:id
 * Permission: 'workcheck.edit'
 */

const { requirePermission } = require('../../middleware/requirePermission');
const { supabaseAdmin } = require('../../services/supabase');

const update = async (req, res, next) => {
  const { id } = req.params;

  console.log(`[Work Check Booking] PUT /api/admin/work-check-bookings/${id}`);

  if (!id) {
    return res.status(400).json({
      success: false,
      error: { code: 'MISSING_ID', message: 'Booking ID is required' }
    });
  }

  try {
    await requirePermission(req, 'workcheck.edit');

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

  } catch (error) {
    next(error);
  }
};

module.exports = { update };
