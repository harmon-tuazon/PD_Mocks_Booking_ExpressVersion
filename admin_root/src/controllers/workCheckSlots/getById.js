/**
 * GET /api/admin/work-check-slots/:id
 * Get a single work check slot by ID
 * Permission: 'workcheck.view'
 */

const { requirePermission } = require('../../middleware/requirePermission');
const { supabaseAdmin } = require('../../services/supabase');

const getById = async (req, res, next) => {
  try {
    await requirePermission(req, 'workcheck.view');

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

    console.log(`[Get Work Check Slot] Fetching slot ${id}`);

    const { data: slot, error } = await supabaseAdmin
      .from('work_check_slots')
      .select(`
        *,
        instructor:instructors!work_check_slots_instructor_id_fkey (
          id,
          instructor_name,
          email
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Work check slot not found' }
        });
      }
      throw new Error(`Failed to fetch slot: ${error.message}`);
    }

    // Calculate activation status
    const now = new Date();
    const availableFrom = slot.available_from ? new Date(slot.available_from) : null;
    const activationStatus = !availableFrom || availableFrom <= now ? 'immediate' : 'scheduled';

    res.status(200).json({
      success: true,
      data: {
        id: slot.id,
        instructor_id: slot.instructor_id,
        instructor_name: slot.instructor?.instructor_name || null,
        instructor_email: slot.instructor?.email || null,
        group_id: slot.group_id,
        slot_date: slot.slot_date,
        slot_time: slot.slot_time,
        duration_minutes: slot.duration_minutes,
        total_slots: slot.total_slots,
        location: slot.location,
        is_active: slot.is_active,
        available_from: slot.available_from,
        activation_status: activationStatus,
        auto_approve: slot.auto_approve,
        created_at: slot.created_at,
        updated_at: slot.updated_at
      }
    });

  } catch (error) {
    next(error);
  }
};

module.exports = { getById };
