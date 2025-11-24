/**
 * Bulk Create Mock Exams Endpoint
 * POST /api/admin/mock-exams/bulk-create
 *
 * Allows admin users to create multiple mock exam sessions with different time slots
 * Invalidates related caches after successful creation.
 */

const { HubSpotService } = require('../../_shared/hubspot');
const { validateInput } = require('../../_shared/validation');
const { requirePermission } = require('../middleware/requirePermission');
const { getCache } = require('../../_shared/cache');
const { syncExamToSupabase } = require('../../_shared/supabase-data');

/**
 * Handler for bulk creating mock exams
 */
async function bulkCreateMockExamsHandler(req, res) {
  try {
    console.log('🚀 [BULK-CREATE] Starting bulk creation request');
    console.log('🚀 [BULK-CREATE] Request body:', JSON.stringify(req.body, null, 2));

    // Validate request body
    console.log('🔍 [BULK-CREATE] Step 1: Validating input...');
    const validatedData = await validateInput(req.body, 'mockExamBulkCreation');
    console.log('✅ [BULK-CREATE] Validation passed:', {
      commonProperties: validatedData.commonProperties,
      timeSlotsCount: validatedData.timeSlots.length,
      capacityMode: validatedData.capacityMode,
      timeSlots: validatedData.timeSlots
    });

    const { commonProperties, timeSlots, capacityMode = 'global' } = validatedData;

    // Handle scheduled activation mode for bulk creation
    if (commonProperties.activation_mode === 'scheduled') {
      // Set status to "scheduled" (string) when scheduling activation
      commonProperties.is_active = "scheduled";

      console.log('📝 [BULK-CREATE] Bulk creating SCHEDULED mock exams:', {
        mock_type: commonProperties.mock_type,
        exam_date: commonProperties.exam_date,
        location: commonProperties.location,
        capacity_mode: capacityMode,
        time_slots_count: timeSlots.length,
        scheduled_activation: commonProperties.scheduled_activation_datetime,
        is_active: commonProperties.is_active,
        admin_user: req.user?.email
      });
    } else {
      // For immediate activation, set status to 'true' (string)
      commonProperties.is_active = 'true';
      // Clear any scheduled activation datetime
      commonProperties.scheduled_activation_datetime = null;

      console.log('📝 [BULK-CREATE] Bulk creating IMMEDIATE mock exams:', {
        mock_type: commonProperties.mock_type,
        exam_date: commonProperties.exam_date,
        location: commonProperties.location,
        capacity_mode: capacityMode,
        time_slots_count: timeSlots.length,
        is_active: commonProperties.is_active,
        admin_user: req.user?.email
      });
    }

    // Check overlap in time slots
    console.log('🔍 [BULK-CREATE] Step 2: Checking time slot overlaps...');
    const hasOverlap = checkTimeSlotOverlaps(timeSlots);
    if (hasOverlap) {
      console.error('❌ [BULK-CREATE] Time slot overlap detected');
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Time slots cannot overlap',
          details: ['Please ensure all time slots are non-overlapping']
        }
      });
    }
    console.log('✅ [BULK-CREATE] No time slot overlaps detected');

    // Initialize HubSpot service
    console.log('🔍 [BULK-CREATE] Step 3: Initializing HubSpot service...');
    const hubspot = new HubSpotService();
    console.log('✅ [BULK-CREATE] HubSpot service initialized');

    // Create mock exams in HubSpot using batch API
    console.log('🔍 [BULK-CREATE] Step 4: Calling batchCreateMockExams...');
    console.log('📤 [BULK-CREATE] Sending to HubSpot:', {
      commonProperties,
      capacityMode,
      timeSlots
    });

    const result = await hubspot.batchCreateMockExams(commonProperties, timeSlots, capacityMode);
    
    console.log('📥 [BULK-CREATE] Received result from HubSpot:', {
      resultType: typeof result,
      isArray: Array.isArray(result),
      length: Array.isArray(result) ? result.length : 'N/A',
      firstItem: Array.isArray(result) && result.length > 0 ? result[0] : 'N/A'
    });

    // Check result status
    if (!result.success && result.status === 'PARTIAL') {
      console.warn(`⚠️ [BULK-CREATE] Partial success: ${result.created_count}/${timeSlots.length} mock exams created`);

      return res.status(207).json({ // 207 Multi-Status
        success: false,
        created_count: result.created_count,
        mockExams: result.mockExams,
        errors: result.errors,
        message: `Partial success: ${result.created_count} out of ${timeSlots.length} mock exams created`
      });
    }

    // Log success
    console.log(`✅ [BULK-CREATE] Bulk created ${result.length || 0} mock exams successfully`);

    // Sync all created exams to Supabase (non-blocking)
    console.log('🔍 [BULK-CREATE] Step 5: Syncing to Supabase...');
    let supabaseSynced = false;
    const mockExamsArray = Array.isArray(result) ? result : [];
    if (mockExamsArray.length > 0) {
      try {
        const syncResults = await Promise.allSettled(
          mockExamsArray.map(exam => syncExamToSupabase({
            id: exam.id,
            properties: exam.properties
          }))
        );
        const syncedCount = syncResults.filter(r => r.status === 'fulfilled').length;
        console.log(`✅ [BULK-CREATE] Synced ${syncedCount}/${mockExamsArray.length} exams to Supabase`);
        supabaseSynced = syncedCount === mockExamsArray.length;
      } catch (supabaseError) {
        console.error('❌ [BULK-CREATE] Supabase bulk sync failed:', supabaseError.message);
        // Continue - HubSpot is source of truth
      }
    }

    // Invalidate caches after successful bulk creation
    console.log('🔍 [BULK-CREATE] Step 6: Invalidating caches...');
    const cache = getCache();
    await cache.deletePattern('admin:mock-exams:list:*');
    await cache.deletePattern('admin:mock-exams:aggregates:*');
    await cache.deletePattern('admin:aggregate:sessions:*');
    console.log('✅ [BULK-CREATE] Cache invalidated successfully');

    // Return success response
    const mockExams = Array.isArray(result) ? result : [];
    console.log('📤 [BULK-CREATE] Sending success response with', mockExams.length, 'exams');

    return res.status(201).json({
      success: true,
      created_count: mockExams.length,
      capacity_mode: capacityMode,
      mockExams: mockExams.map(exam => ({
        id: exam.id,
        properties: exam.properties
      })),
      message: `Successfully created ${mockExams.length} mock exam${mockExams.length > 1 ? 's' : ''}`,
      supabase_synced: supabaseSynced
    });

  } catch (error) {
    console.error('❌ [BULK-CREATE] ERROR CAUGHT:', {
      errorMessage: error.message,
      errorStack: error.stack,
      errorName: error.name,
      errorStatus: error.status,
      validationErrors: error.validationErrors,
      fullError: error
    });

    // Handle validation errors
    if (error.status === 400 || error.validationErrors) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message,
          details: error.validationErrors || []
        }
      });
    }

    // Handle HubSpot API errors
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        error: {
          code: 'HUBSPOT_ERROR',
          message: error.message
        }
      });
    }

    // Handle unexpected errors
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while bulk creating mock exams',
        debug: {
          errorMessage: error.message,
          errorName: error.name
        }
      }
    });
  }
}

/**
 * Check if any time slots overlap
 * @param {Array} timeSlots - Array of {start_time, end_time} objects
 * @returns {boolean} True if overlaps exist
 */
function checkTimeSlotOverlaps(timeSlots) {
  // Convert time strings to minutes for easy comparison
  const toMinutes = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Sort time slots by start time
  const sorted = timeSlots.map(slot => ({
    start: toMinutes(slot.start_time),
    end: toMinutes(slot.end_time)
  })).sort((a, b) => a.start - b.start);

  // Check for overlaps
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].end > sorted[i + 1].start) {
      return true; // Overlap detected
    }
  }

  return false;
}

/**
 * Export with admin protection middleware
 */
module.exports = async (req, res) => {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only POST method is allowed'
      }
    });
  }

  try {
    // Require admin authentication and permission
    await requirePermission(req, 'exams.create');

    // Call handler
    return await bulkCreateMockExamsHandler(req, res);
  } catch (error) {
    // Handle auth errors
    const statusCode = error.message.includes('access required') ? 403 : 401;
    return res.status(statusCode).json({
      success: false,
      error: {
        code: statusCode === 403 ? 'FORBIDDEN' : 'UNAUTHORIZED',
        message: error.message || 'Access denied'
      }
    });
  }
};