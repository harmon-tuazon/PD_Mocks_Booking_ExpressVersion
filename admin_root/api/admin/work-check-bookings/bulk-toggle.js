/**
 * POST /api/admin/work-check-bookings/bulk-toggle
 * Bulk toggle status for multiple work check bookings
 * Permission: 'workcheck.edit'
 */

const { requirePermission } = require('../middleware/requirePermission');
const { validationMiddleware } = require('../../_shared/validation');
const { supabaseAdmin } = require('../../_shared/supabase');

module.exports = async (req, res) => {
  console.log('[Work Check Bookings Bulk Toggle] Endpoint hit:', req.method);

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: `Method ${req.method} not allowed` }
    });
  }

  try {
    // Verify admin authentication and permission
    await requirePermission(req, 'workcheck.edit');

    // Validate request body
    const validator = validationMiddleware('workCheckBookingBulkToggle');
    await new Promise((resolve, reject) => {
      validator(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    const { ids, target_status } = req.validatedData || req.body;

    console.log(`[Bulk Toggle Bookings] Setting ${ids.length} bookings to status: ${target_status}`);

    // Fetch current status of all bookings
    const { data: bookings, error: fetchError } = await supabaseAdmin
      .from('work_check_bookings')
      .select('id, status')
      .in('id', ids);

    if (fetchError) {
      console.error('[Supabase ERROR] Failed to fetch bookings:', fetchError.message);
      throw new Error('Failed to fetch bookings');
    }

    if (!bookings || bookings.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NO_BOOKINGS_FOUND', message: 'No matching bookings found' }
      });
    }

    // Track previous statuses for reporting
    const previousStatusCounts = {};
    const updates = [];

    for (const booking of bookings) {
      if (booking.status !== target_status) {
        // Track previous status
        previousStatusCounts[booking.status] = (previousStatusCounts[booking.status] || 0) + 1;

        // Prepare update data
        const updateData = {
          id: booking.id,
          status: target_status
        };

        // Handle status change timestamps
        if (target_status === 'confirmed') {
          updateData.confirmed_at = new Date().toISOString();
        } else if (target_status === 'cancelled') {
          updateData.cancelled_at = new Date().toISOString();
        } else if (target_status === 'marked') {
          updateData.marked_at = new Date().toISOString();
        }

        updates.push(updateData);
      }
    }

    // Perform updates if any
    if (updates.length > 0) {
      for (const update of updates) {
        const { id, ...updateFields } = update;
        const { error: updateError } = await supabaseAdmin
          .from('work_check_bookings')
          .update(updateFields)
          .eq('id', id);

        if (updateError) {
          console.error(`[Supabase ERROR] Failed to update booking ${id}:`, updateError.message);
        }
      }
    }

    const summary = {
      total: ids.length,
      found: bookings.length,
      updated: updates.length,
      target_status: target_status,
      by_previous_status: previousStatusCounts,
      unchanged: bookings.length - updates.length
    };

    console.log('[Bulk Toggle Bookings] Completed:', summary);

    res.status(200).json({
      success: true,
      message: `Successfully updated ${summary.updated} booking(s) to ${target_status}`,
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

    console.error('Error in bulk toggle bookings:', error);

    res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Failed to toggle booking status'
    });
  }
};
