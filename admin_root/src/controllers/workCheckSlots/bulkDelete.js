/**
 * POST /api/admin/work-check-slots/bulk-delete
 * Bulk delete multiple work check slots
 * Permission: 'workcheck.delete'
 *
 * Note: Slots with active bookings cannot be deleted.
 */

const { requirePermission } = require('../../middleware/requirePermission');
const { supabaseAdmin } = require('../../services/supabase');

const bulkDelete = async (req, res, next) => {
  try {
    // Verify admin authentication and permission
    await requirePermission(req, 'workcheck.delete');

    const { ids } = req.validatedData || req.body;

    console.log(`[Bulk Delete Slots] Attempting to delete ${ids.length} slots`);

    // Fetch slot details for reporting
    const { data: slots, error: fetchError } = await supabaseAdmin
      .from('work_check_slots')
      .select(`
        id,
        slot_date,
        slot_time,
        instructor:instructors!work_check_slots_instructor_id_fkey (
          instructor_name
        )
      `)
      .in('id', ids);

    if (fetchError) {
      console.error('[Supabase ERROR] Failed to fetch slots:', fetchError.message);
      throw new Error('Failed to fetch slots');
    }

    // Check which slots have active bookings
    const { data: bookingsData, error: bookingsError } = await supabaseAdmin
      .from('work_check_bookings')
      .select('slot_id')
      .in('slot_id', ids)
      .neq('status', 'Cancelled');

    if (bookingsError) {
      console.error('[Supabase ERROR] Failed to check bookings:', bookingsError.message);
      throw new Error('Failed to verify slot bookings');
    }

    // Get unique slot IDs that have active bookings
    const slotsWithBookings = new Set(bookingsData?.map(b => b.slot_id) || []);

    // Separate deletable and blocked slots
    const deletableIds = ids.filter(id => !slotsWithBookings.has(id));
    const blockedIds = ids.filter(id => slotsWithBookings.has(id));

    console.log(`[Bulk Delete Slots] Deletable: ${deletableIds.length}, Blocked: ${blockedIds.length}`);

    // Build blocked details
    const blockedDetails = blockedIds.map(id => {
      const slot = slots?.find(s => s.id === id);
      return {
        id,
        slot_date: slot?.slot_date || 'Unknown',
        slot_time: slot?.slot_time || 'Unknown',
        instructor_name: slot?.instructor?.instructor_name || 'Unknown',
        reason: 'Has active booking(s)'
      };
    });

    if (deletableIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_DELETABLE_SLOTS',
          message: 'All selected slots have active bookings and cannot be deleted'
        },
        data: {
          total: ids.length,
          deleted: 0,
          blocked: blockedIds.length,
          blocked_details: blockedDetails
        }
      });
    }

    // Delete the slots that don't have active bookings
    const { error: deleteError } = await supabaseAdmin
      .from('work_check_slots')
      .delete()
      .in('id', deletableIds);

    if (deleteError) {
      console.error('[Supabase ERROR] Failed to delete slots:', deleteError.message);
      throw new Error(`Failed to delete slots: ${deleteError.message}`);
    }

    const summary = {
      total: ids.length,
      deleted: deletableIds.length,
      blocked: blockedIds.length,
      blocked_details: blockedDetails
    };

    console.log('[Bulk Delete Slots] Completed:', summary);

    res.status(200).json({
      success: true,
      message: `Successfully deleted ${summary.deleted} slot(s)`,
      data: summary
    });

  } catch (error) {
    next(error);
  }
};

module.exports = { bulkDelete };
