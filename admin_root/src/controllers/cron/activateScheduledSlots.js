/**
 * GET /api/admin/cron/activate-scheduled-slots
 * Activate work check slots that have reached their scheduled activation time
 *
 * Security: Requires CRON_SECRET (Bearer token in Authorization header)
 */

const { db } = require('../../services/supabase');

const activateScheduledSlots = async (req, res, next) => {
  const startTime = Date.now();

  try {
    // Verify CRON_SECRET
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('[CRON-ACTIVATE-SLOTS] CRON_SECRET not configured');
      return res.status(500).json({
        success: false,
        error: { code: 'CONFIG_ERROR', message: 'CRON_SECRET not configured' }
      });
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.warn('[CRON-ACTIVATE-SLOTS] Unauthorized access attempt');
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid or missing CRON_SECRET' }
      });
    }

    const now = new Date().toISOString();
    console.log(`[CRON-ACTIVATE-SLOTS] Starting check at ${now}`);

    // Find slots that need activation
    const { data: slotsToActivate, error: fetchError } = await db
      .from('work_check_slots')
      .select('id, instructor_id, slot_date, slot_time, available_from')
      .eq('is_active', false)
      .not('available_from', 'is', null)
      .lte('available_from', now);

    if (fetchError) {
      console.error('[CRON-ACTIVATE-SLOTS] Error fetching slots:', fetchError.message);
      throw new Error(`Failed to fetch scheduled slots: ${fetchError.message}`);
    }

    const slotsCount = slotsToActivate?.length || 0;
    console.log(`[CRON-ACTIVATE-SLOTS] Found ${slotsCount} slots to activate`);

    if (slotsCount === 0) {
      const executionTime = Date.now() - startTime;
      return res.status(200).json({
        success: true,
        message: 'No slots to activate',
        data: {
          activated: 0,
          failed: 0,
          timestamp: now,
          executionTime
        }
      });
    }

    const slotIds = slotsToActivate.map(s => s.id);

    const { data: updatedSlots, error: updateError } = await db
      .from('work_check_slots')
      .update({
        is_active: true,
        available_from: null,
        updated_at: now
      })
      .in('id', slotIds)
      .select('id');

    if (updateError) {
      console.error('[CRON-ACTIVATE-SLOTS] Error activating slots:', updateError.message);
      throw new Error(`Failed to activate slots: ${updateError.message}`);
    }

    const activatedCount = updatedSlots?.length || 0;
    const failedCount = slotsCount - activatedCount;

    console.log(`[CRON-ACTIVATE-SLOTS] Successfully activated ${activatedCount} slots`);

    if (failedCount > 0) {
      console.warn(`[CRON-ACTIVATE-SLOTS] Failed to activate ${failedCount} slots`);
    }

    const executionTime = Date.now() - startTime;
    console.log(`[CRON-ACTIVATE-SLOTS] Completed in ${executionTime}ms`);

    if (activatedCount > 0) {
      const activatedDetails = slotsToActivate
        .filter(s => updatedSlots.some(u => u.id === s.id))
        .map(s => `${s.slot_date} ${s.slot_time}`)
        .slice(0, 10);

      console.log(`[CRON-ACTIVATE-SLOTS] Activated slots: ${activatedDetails.join(', ')}${activatedCount > 10 ? ` ... and ${activatedCount - 10} more` : ''}`);
    }

    res.status(200).json({
      success: true,
      message: `Activated ${activatedCount} work check slot(s)`,
      data: {
        activated: activatedCount,
        failed: failedCount,
        timestamp: now,
        executionTime
      }
    });

  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error('[CRON-ACTIVATE-SLOTS] Critical error:', error.message);

    res.status(500).json({
      success: false,
      error: {
        code: 'ACTIVATION_FAILED',
        message: error.message
      },
      data: {
        timestamp: new Date().toISOString(),
        executionTime
      }
    });
  }
};

module.exports = { activateScheduledSlots };
