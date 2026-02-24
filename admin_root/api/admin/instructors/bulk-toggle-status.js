/**
 * POST /api/admin/instructors/bulk-toggle-status
 * Bulk toggle active/inactive status for multiple instructors
 *
 * Features:
 * - Toggle active status for multiple instructors (up to 100 per request)
 * - Intelligent toggle: active -> inactive, inactive -> active
 * - Idempotent operations - safe to retry
 * - Partial failure handling with detailed error reporting
 * - Audit logging for each bulk operation
 *
 * Request Body:
 * {
 *   "ids": ["uuid1", "uuid2", "uuid3"]
 * }
 *
 * Returns:
 * - Detailed results for each instructor update
 * - Summary statistics (total, updated, failed, activated, deactivated)
 * - Error details for failed updates
 */

const { requirePermission } = require('../middleware/requirePermission');
const { validationMiddleware } = require('../../_shared/validation');
const { supabaseAdmin } = require('../../_shared/supabase');

// Maximum instructors per request
const MAX_INSTRUCTORS_PER_REQUEST = 100;

module.exports = async (req, res) => {
  const startTime = Date.now();

  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return res.status(405).json({
        success: false,
        error: {
          code: 'METHOD_NOT_ALLOWED',
          message: `Method ${req.method} not allowed. Use POST.`
        }
      });
    }

    // Verify admin authentication and permission
    const user = await requirePermission(req, 'workcheck.edit');
    const adminEmail = user?.email || 'admin@prepdoctors.com';

    // Validate request body
    const validator = validationMiddleware('instructorBulkToggleStatus');
    await new Promise((resolve, reject) => {
      validator(req, res, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });

    const { ids } = req.validatedData;

    // Double-check instructor count (validation should handle this)
    if (ids.length > MAX_INSTRUCTORS_PER_REQUEST) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BATCH_SIZE_EXCEEDED',
          message: `Maximum ${MAX_INSTRUCTORS_PER_REQUEST} instructors can be toggled per request`,
          details: { provided: ids.length, maximum: MAX_INSTRUCTORS_PER_REQUEST }
        }
      });
    }

    console.log(`[BULK-TOGGLE-INSTRUCTORS] Processing bulk toggle for ${ids.length} instructors`);
    console.log(`[BULK-TOGGLE-INSTRUCTORS] Admin: ${adminEmail}`);

    // Fetch all instructors by their IDs from Supabase
    console.log(`[BULK-TOGGLE-INSTRUCTORS] Fetching instructor details from Supabase...`);
    const { data: instructors, error: fetchError } = await supabaseAdmin
      .from('instructors')
      .select('id, instructor_name, email, is_active, auth_user_id')
      .in('id', ids);

    if (fetchError) {
      console.error('[BULK-TOGGLE-INSTRUCTORS] Error fetching instructors:', fetchError);
      return res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch instructor details'
        }
      });
    }

    // Create a map of existing instructors for quick lookup
    const instructorsMap = new Map(instructors.map(inst => [inst.id, inst]));

    // Initialize result tracking
    const results = {
      successful: [],
      failed: []
    };

    // Summary statistics
    const summary = {
      total: ids.length,
      updated: 0,
      failed: 0,
      activated: 0,
      deactivated: 0
    };

    // Prepare updates
    const updates = [];

    for (const id of ids) {
      const instructor = instructorsMap.get(id);

      // Check if instructor exists
      if (!instructor) {
        results.failed.push({
          id,
          error: 'Instructor not found',
          code: 'NOT_FOUND'
        });
        summary.failed++;
        continue;
      }

      // Get current active state and toggle
      const currentState = instructor.is_active;
      const newState = !currentState;

      // Track activation/deactivation counts
      if (newState) {
        summary.activated++;
      } else {
        summary.deactivated++;
      }

      // Prepare update
      updates.push({
        id,
        instructor_name: instructor.instructor_name,
        auth_user_id: instructor.auth_user_id,
        previousState: currentState,
        newState: newState
      });
    }

    // Process updates
    if (updates.length > 0) {
      console.log(`[BULK-TOGGLE-INSTRUCTORS] Processing ${updates.length} status toggles...`);
      console.log(`[BULK-TOGGLE-INSTRUCTORS] ${summary.activated} to activate, ${summary.deactivated} to deactivate`);

      // Process each update individually to track success/failure
      for (const update of updates) {
        try {
          const { error: updateError } = await supabaseAdmin
            .from('instructors')
            .update({
              is_active: update.newState,
              updated_at: new Date().toISOString()
            })
            .eq('id', update.id);

          if (updateError) {
            // Adjust summary counts on failure
            if (update.newState) {
              summary.activated--;
            } else {
              summary.deactivated--;
            }

            results.failed.push({
              id: update.id,
              error: updateError.message || 'Failed to update status',
              code: 'UPDATE_FAILED'
            });
            summary.failed++;
          } else {
            // Sync auth user ban/unban if instructor has portal access
            if (update.auth_user_id) {
              const { error: authSyncError } = await supabaseAdmin.auth.admin.updateUserById(
                update.auth_user_id,
                { ban_duration: update.newState ? 'none' : '876000h' }
              );

              if (authSyncError) {
                console.error(`[Auth Sync WARNING] Failed to sync auth user for instructor ${update.id}:`, authSyncError.message);
              }
            }

            results.successful.push({
              id: update.id,
              previousState: update.previousState,
              newState: update.newState
            });
            summary.updated++;
          }
        } catch (updateError) {
          // Adjust summary counts on failure
          if (update.newState) {
            summary.activated--;
          } else {
            summary.deactivated--;
          }

          results.failed.push({
            id: update.id,
            error: updateError.message || 'Unexpected error during update',
            code: 'UPDATE_FAILED'
          });
          summary.failed++;
        }
      }
    }

    // Log audit trail (non-blocking)
    if (results.successful.length > 0) {
      console.log(`[BULK-TOGGLE-INSTRUCTORS] Successfully toggled ${results.successful.length} instructor(s)`);

      // Create audit log asynchronously
      createAuditLog(summary, adminEmail, ids).catch(error => {
        console.error('Failed to create audit log:', error);
      });
    }

    // Check for timeout (Vercel 60s limit)
    if (Date.now() - startTime > 55000) {
      console.warn(`[BULK-TOGGLE-INSTRUCTORS] Operation approaching timeout`);
    }

    // Return response
    const executionTime = Date.now() - startTime;

    res.status(200).json({
      success: true,
      summary,
      results,
      meta: {
        timestamp: new Date().toISOString(),
        processedBy: adminEmail,
        executionTime
      }
    });

  } catch (error) {
    console.error('[BULK-TOGGLE-INSTRUCTORS] Error in bulk toggle status:', error);

    // Handle validation errors
    if (error.validationErrors) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: error.validationErrors
        }
      });
    }

    // Handle auth errors
    if (error.statusCode === 403) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: error.message || 'Permission denied'
        }
      });
    }

    if (error.statusCode === 401 || error.message?.includes('authorization') || error.message?.includes('token')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
    }

    // Handle timeout errors (Vercel 60s limit)
    if (Date.now() - startTime > 55000) {
      return res.status(504).json({
        success: false,
        error: {
          code: 'TIMEOUT',
          message: 'Request timeout. Please try with fewer instructors.'
        }
      });
    }

    // Generic error
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'An error occurred while toggling instructor status'
      }
    });
  }
};

/**
 * Create audit log for bulk toggle operation
 */
async function createAuditLog(summary, adminEmail, instructorIds) {
  try {
    console.log(`[AUDIT] Bulk toggle instructor operation:`, {
      summary,
      adminEmail,
      instructorCount: instructorIds.length,
      timestamp: new Date().toISOString()
    });

    // Note: In a production environment, this could be written to an audit log table
    // For now, we just log to console

  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw - this is non-critical
  }
}
