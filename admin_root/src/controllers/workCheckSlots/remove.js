/**
 * DELETE /api/admin/work-check-slots/:id
 * Delete a single work check slot
 * Permission: 'workcheck.delete'
 */

const { requirePermission } = require('../../middleware/requirePermission');
const { supabaseAdmin } = require('../../services/supabase');

const remove = async (req, res, next) => {
  try {
    await requirePermission(req, 'workcheck.delete');

    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_ID', message: 'Slot ID is required' }
      });
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid slot ID format' }
      });
    }

    console.log(`[Delete Work Check Slot] Attempting to delete slot ${id}`);

    // Check if slot exists
    const { data: existingSlot, error: fetchError } = await supabaseAdmin
      .from('work_check_slots')
      .select('id, slot_date, slot_time')
      .eq('id', id)
      .single();

    if (fetchError || !existingSlot) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Work check slot not found' }
      });
    }

    // Check for active bookings
    const { data: bookings, error: bookingsError } = await supabaseAdmin
      .from('work_check_bookings')
      .select('id')
      .eq('slot_id', id)
      .neq('status', 'Cancelled');

    if (bookingsError) {
      console.error('[Supabase ERROR] Failed to check bookings:', bookingsError.message);
      throw new Error('Failed to verify slot bookings');
    }

    if (bookings && bookings.length > 0) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'SLOT_HAS_BOOKINGS',
          message: `Cannot delete slot with ${bookings.length} active booking(s). Cancel bookings first.`
        }
      });
    }

    // Delete the slot
    const { error: deleteError } = await supabaseAdmin
      .from('work_check_slots')
      .delete()
      .eq('id', id);

    if (deleteError) {
      throw new Error(`Failed to delete slot: ${deleteError.message}`);
    }

    console.log(`[Delete Work Check Slot] Successfully deleted slot ${id}`);

    res.status(200).json({
      success: true,
      message: 'Work check slot deleted successfully'
    });

  } catch (error) {
    next(error);
  }
};

module.exports = { remove };
