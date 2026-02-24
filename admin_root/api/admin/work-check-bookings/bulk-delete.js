/**
 * POST /api/admin/work-check-bookings/bulk-delete
 * Bulk delete multiple work check bookings
 * Permission: 'workcheck.delete'
 */

const { requirePermission } = require('../middleware/requirePermission');
const { validationMiddleware } = require('../../_shared/validation');
const { supabaseAdmin } = require('../../_shared/supabase');

module.exports = async (req, res) => {
  console.log('[Work Check Bookings Bulk Delete] Endpoint hit:', req.method);

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: `Method ${req.method} not allowed` }
    });
  }

  try {
    // Verify admin authentication and permission
    await requirePermission(req, 'workcheck.delete');

    // Validate request body
    const validator = validationMiddleware('workCheckBookingBulkDelete');
    await new Promise((resolve, reject) => {
      validator(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    const { ids } = req.validatedData || req.body;

    console.log(`[Bulk Delete Bookings] Attempting to delete ${ids.length} bookings`);

    // Verify bookings exist before deletion
    const { data: existingBookings, error: fetchError } = await supabaseAdmin
      .from('work_check_bookings')
      .select('id, student_id, status')
      .in('id', ids);

    if (fetchError) {
      console.error('[Supabase ERROR] Failed to fetch bookings:', fetchError.message);
      throw new Error('Failed to verify bookings');
    }

    if (!existingBookings || existingBookings.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NO_BOOKINGS_FOUND', message: 'No matching bookings found' }
      });
    }

    const foundIds = existingBookings.map(b => b.id);
    const notFoundIds = ids.filter(id => !foundIds.includes(id));

    // Track status breakdown for reporting
    const deletedByStatus = {};
    for (const booking of existingBookings) {
      deletedByStatus[booking.status] = (deletedByStatus[booking.status] || 0) + 1;
    }

    // Perform deletion
    const { error: deleteError, count } = await supabaseAdmin
      .from('work_check_bookings')
      .delete()
      .in('id', foundIds);

    if (deleteError) {
      console.error('[Supabase ERROR] Failed to delete bookings:', deleteError.message);
      throw new Error('Failed to delete bookings');
    }

    const summary = {
      requested: ids.length,
      found: existingBookings.length,
      deleted: existingBookings.length,
      not_found: notFoundIds.length,
      by_status: deletedByStatus
    };

    console.log('[Bulk Delete Bookings] Completed:', summary);

    res.status(200).json({
      success: true,
      message: `Successfully deleted ${summary.deleted} booking(s)`,
      data: summary
    });

  } catch (error) {
    // Auth-specific error handling
    if (error.message.includes('authorization') || error.message.includes('token') || error.message.includes('Permission denied')) {
      const statusCode = error.statusCode || 401;
      return res.status(statusCode).json({
        success: false,
        error: { code: error.code || 'UNAUTHORIZED', message: error.message }
      });
    }

    console.error('Error in bulk delete bookings:', error);

    res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Failed to delete bookings'
    });
  }
};
