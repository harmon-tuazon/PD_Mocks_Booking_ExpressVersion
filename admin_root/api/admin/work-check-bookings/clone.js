/**
 * POST /api/admin/work-check-bookings/clone
 * Clone bookings to new target slots
 * Permission: 'workcheck.create'
 */

const { requirePermission } = require('../middleware/requirePermission');
const { validationMiddleware } = require('../../_shared/validation');
const { supabaseAdmin } = require('../../_shared/supabase');

module.exports = async (req, res) => {
  console.log('[Work Check Bookings Clone] Endpoint hit:', req.method);

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: `Method ${req.method} not allowed` }
    });
  }

  try {
    // Verify admin authentication and permission
    await requirePermission(req, 'workcheck.create');

    // Validate request body
    const validator = validationMiddleware('workCheckBookingClone');
    await new Promise((resolve, reject) => {
      validator(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    const {
      ids,
      target_slot_ids,
      preserve_status = false,
      preserve_type = true
    } = req.validatedData || req.body;

    console.log(`[Clone Bookings] Cloning ${ids.length} bookings to ${target_slot_ids.length} slots`);
    console.log(`[Clone Bookings] Options: preserve_status=${preserve_status}, preserve_type=${preserve_type}`);

    // Fetch source bookings
    const { data: sourceBookings, error: fetchError } = await supabaseAdmin
      .from('work_check_bookings')
      .select('*')
      .in('id', ids);

    if (fetchError) {
      console.error('[Supabase ERROR] Failed to fetch source bookings:', fetchError.message);
      throw new Error('Failed to fetch source bookings');
    }

    if (!sourceBookings || sourceBookings.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NO_BOOKINGS_FOUND', message: 'No source bookings found' }
      });
    }

    // Verify target slots exist
    const { data: targetSlots, error: slotError } = await supabaseAdmin
      .from('work_check_slots')
      .select('id')
      .in('id', target_slot_ids);

    if (slotError) {
      console.error('[Supabase ERROR] Failed to fetch target slots:', slotError.message);
      throw new Error('Failed to verify target slots');
    }

    if (!targetSlots || targetSlots.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NO_SLOTS_FOUND', message: 'No target slots found' }
      });
    }

    const validSlotIds = new Set(targetSlots.map(s => s.id));

    // Check for existing bookings to prevent duplicates
    const studentIds = [...new Set(sourceBookings.map(b => b.student_id))];
    const { data: existingBookings, error: existingError } = await supabaseAdmin
      .from('work_check_bookings')
      .select('slot_id, student_id')
      .in('slot_id', target_slot_ids)
      .in('student_id', studentIds);

    if (existingError) {
      console.error('[Supabase ERROR] Failed to check existing bookings:', existingError.message);
    }

    const existingPairs = new Set(
      (existingBookings || []).map(b => `${b.slot_id}:${b.student_id}`)
    );

    // Create cloned bookings
    const clonedBookings = [];
    const skipped = [];
    const invalidSlots = [];

    for (const targetSlotId of target_slot_ids) {
      if (!validSlotIds.has(targetSlotId)) {
        invalidSlots.push(targetSlotId);
        continue;
      }

      for (const sourceBooking of sourceBookings) {
        const pairKey = `${targetSlotId}:${sourceBooking.student_id}`;

        // Skip if booking already exists for this student+slot
        if (existingPairs.has(pairKey)) {
          skipped.push({
            student_id: sourceBooking.student_id,
            slot_id: targetSlotId,
            reason: 'duplicate'
          });
          continue;
        }

        clonedBookings.push({
          slot_id: targetSlotId,
          student_id: sourceBooking.student_id,
          status: preserve_status ? sourceBooking.status : 'pending',
          type: preserve_type ? sourceBooking.type : 'Work Check',
          created_at: new Date().toISOString(),
          // Don't copy timestamps - these are fresh bookings
          confirmed_at: null,
          cancelled_at: null
        });

        // Mark as used to prevent duplicates within same request
        existingPairs.add(pairKey);
      }
    }

    // Insert cloned bookings
    let insertedCount = 0;
    const errors = [];

    if (clonedBookings.length > 0) {
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('work_check_bookings')
        .insert(clonedBookings)
        .select();

      if (insertError) {
        console.error('[Supabase ERROR] Failed to insert cloned bookings:', insertError.message);
        errors.push(insertError.message);
      } else {
        insertedCount = inserted?.length || 0;
      }
    }

    const summary = {
      source_bookings: sourceBookings.length,
      target_slots: target_slot_ids.length,
      valid_slots: validSlotIds.size,
      invalid_slots: invalidSlots.length,
      attempted: clonedBookings.length,
      created: insertedCount,
      skipped: skipped.length,
      skipped_details: skipped.length > 0 ? skipped.slice(0, 10) : [], // Limit details
      errors: errors,
      options: {
        preserve_status,
        preserve_type
      }
    };

    console.log('[Clone Bookings] Completed:', {
      source: summary.source_bookings,
      targets: summary.target_slots,
      created: summary.created,
      skipped: summary.skipped
    });

    res.status(200).json({
      success: true,
      message: `Successfully cloned ${summary.created} booking(s)`,
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

    console.error('Error in clone bookings:', error);

    res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Failed to clone bookings'
    });
  }
};
