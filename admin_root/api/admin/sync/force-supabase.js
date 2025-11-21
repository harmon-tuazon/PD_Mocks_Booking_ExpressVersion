/**
 * POST /api/admin/sync/force-supabase
 * Force sync data from HubSpot to Supabase
 *
 * Used for manual recovery if Supabase gets out of sync
 *
 * Query params:
 * - type: 'exams' | 'bookings'
 * - examId: (required for type=bookings) specific exam to sync bookings for
 */

const { requirePermission } = require('../middleware/requirePermission');
const hubspot = require('../../_shared/hubspot');

// Initialize Supabase client
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  }
);

module.exports = async (req, res) => {
  const startTime = Date.now();

  try {
    // Require admin permission
    await requirePermission(req, 'exams.edit');

    // Only allow POST
    if (req.method !== 'POST') {
      return res.status(405).json({
        success: false,
        error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST' }
      });
    }

    const { type, examId } = req.query;

    if (!type || !['exams', 'bookings'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TYPE',
          message: 'Invalid sync type. Use type=exams or type=bookings'
        }
      });
    }

    // Sync bookings for specific exam
    if (type === 'bookings') {
      if (!examId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_EXAM_ID',
            message: 'examId is required for booking sync'
          }
        });
      }

      console.log(`🔄 [SYNC] Forcing sync of bookings for exam ${examId}...`);

      // Get bookings from HubSpot
      const bookings = await hubspot.getBookingsForMockExam(examId);

      if (!bookings || bookings.length === 0) {
        return res.status(200).json({
          success: true,
          message: 'No bookings found for this exam',
          synced: 0
        });
      }

      // Transform and upsert to Supabase
      const records = bookings.map(booking => {
        const props = booking.properties || booking;
        return {
          hubspot_id: booking.id,
          booking_id: props.booking_id,
          mock_exam_id: examId,
          contact_id: props.contact_id,
          student_id: props.student_id,
          student_name: props.student_name || props.name,
          student_email: props.student_email || props.email,
          booking_status: props.booking_status,
          is_active: props.is_active,
          attendance: props.attendance,
          attending_location: props.attending_location,
          exam_date: props.exam_date,
          dominant_hand: props.dominant_hand,
          created_at: props.createdate || props.created_at,
          updated_at: props.hs_lastmodifieddate || props.updated_at,
          synced_at: new Date().toISOString()
        };
      });

      const { error } = await supabaseAdmin
        .from('hubspot_bookings')
        .upsert(records, { onConflict: 'hubspot_id' });

      if (error) {
        throw new Error(`Supabase sync error: ${error.message}`);
      }

      return res.status(200).json({
        success: true,
        message: `Synced ${records.length} bookings for exam ${examId}`,
        synced: records.length,
        executionTime: Date.now() - startTime
      });
    }

    // Sync all exams
    if (type === 'exams') {
      console.log('🔄 [SYNC] Forcing sync of all mock exams...');

      // Get all exams from HubSpot
      const exams = await hubspot.listMockExams({ limit: 1000 });

      if (!exams || exams.length === 0) {
        return res.status(200).json({
          success: true,
          message: 'No exams found to sync',
          synced: 0
        });
      }

      // Transform and upsert to Supabase
      const records = exams.map(exam => {
        const props = exam.properties || exam;
        return {
          hubspot_id: exam.id,
          mock_exam_name: props.mock_exam_name,
          mock_type: props.mock_type,
          exam_date: props.exam_date,
          start_time: props.start_time,
          end_time: props.end_time,
          location: props.location,
          capacity: parseInt(props.capacity) || 0,
          total_bookings: parseInt(props.total_bookings) || 0,
          is_active: props.is_active,
          created_at: props.createdate || props.created_at,
          updated_at: props.hs_lastmodifieddate || props.updated_at,
          synced_at: new Date().toISOString()
        };
      });

      const { error } = await supabaseAdmin
        .from('hubspot_mock_exams')
        .upsert(records, { onConflict: 'hubspot_id' });

      if (error) {
        throw new Error(`Supabase sync error: ${error.message}`);
      }

      return res.status(200).json({
        success: true,
        message: `Synced ${records.length} exams`,
        synced: records.length,
        executionTime: Date.now() - startTime
      });
    }

  } catch (error) {
    console.error('❌ [SYNC] Force sync error:', error);

    return res.status(error.status || 500).json({
      success: false,
      error: {
        code: error.code || 'SYNC_FAILED',
        message: error.message || 'Force sync failed'
      }
    });
  }
};
