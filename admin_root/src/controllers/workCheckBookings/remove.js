/**
 * Delete Work Check Booking Controller
 * DELETE /api/admin/work-check-bookings/:id
 * Permission: 'workcheck.delete'
 */

const { requirePermission } = require('../../middleware/requirePermission');
const { supabaseAdmin } = require('../../services/supabase');

const remove = async (req, res, next) => {
  const { id } = req.params;

  console.log(`[Work Check Booking] DELETE /api/admin/work-check-bookings/${id}`);

  if (!id) {
    return res.status(400).json({
      success: false,
      error: { code: 'MISSING_ID', message: 'Booking ID is required' }
    });
  }

  try {
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

  } catch (error) {
    next(error);
  }
};

module.exports = { remove };
