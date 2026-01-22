/**
 * API Endpoint for delta-based prerequisite updates
 *
 * PATCH /api/admin/mock-exams/[id]/prerequisites/delta
 * - Add and/or remove prerequisite associations in a single operation
 * - Uses Supabase RPC for atomic array manipulation
 * - Fire-and-forget sync to HubSpot associations
 */

const { requireAdmin } = require('../../../middleware/requireAdmin');
const { supabaseAdmin } = require('../../../../_shared/supabase');
const hubspot = require('../../../../_shared/hubspot');
const { HUBSPOT_OBJECTS } = require('../../../../_shared/hubspot');
const Joi = require('joi');

// Association type ID for "requires attendance at" relationship
const PREREQUISITE_ASSOCIATION_TYPE_ID = 1340;

// Validation schema for delta update request
const deltaSchema = Joi.object({
  add_prerequisites: Joi.array()
    .items(Joi.string().pattern(/^\d+$/).required())
    .default([])
    .description('Array of mock exam IDs to add as prerequisites'),
  remove_prerequisites: Joi.array()
    .items(Joi.string().pattern(/^\d+$/).required())
    .default([])
    .description('Array of mock exam IDs to remove from prerequisites')
});

module.exports = async (req, res) => {
  try {
    // Only allow PATCH method
    if (req.method !== 'PATCH') {
      return res.status(405).json({
        success: false,
        error: {
          code: 'METHOD_NOT_ALLOWED',
          message: `Method ${req.method} not allowed. Use PATCH.`
        }
      });
    }

    // Require admin authentication
    const user = await requireAdmin(req);
    const adminEmail = user?.email || 'admin@prepdoctors.ca';

    // Extract mock exam ID from query params
    const mockExamId = req.query.id;

    // Validate ID format
    if (!mockExamId || !/^\d+$/.test(mockExamId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'Valid mock exam ID is required'
        }
      });
    }

    // Validate request body
    const { error: validationError, value } = deltaSchema.validate(req.body);
    if (validationError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: validationError.details[0].message
        }
      });
    }

    const { add_prerequisites, remove_prerequisites } = value;

    // Check if there's anything to do
    if (add_prerequisites.length === 0 && remove_prerequisites.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_CHANGES',
          message: 'At least one of add_prerequisites or remove_prerequisites must contain values'
        }
      });
    }

    // Call Supabase RPC for atomic delta update
    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc('update_exam_prerequisites', {
      p_exam_id: mockExamId,
      p_add_ids: add_prerequisites,
      p_remove_ids: remove_prerequisites
    });

    if (rpcError) {
      console.error('Supabase RPC error:', rpcError);

      // Handle exam not found
      if (rpcError.message && rpcError.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Mock exam ${mockExamId} not found in Supabase`
          }
        });
      }

      return res.status(500).json({
        success: false,
        error: {
          code: 'RPC_ERROR',
          message: 'Failed to update prerequisites in Supabase'
        }
      });
    }

    console.log(`Delta update for exam ${mockExamId}:`, {
      added: rpcResult.added_count,
      removed: rpcResult.removed_count,
      total: rpcResult.current_count
    });

    // Fire-and-forget HubSpot sync
    syncToHubSpot(mockExamId, add_prerequisites, remove_prerequisites, adminEmail).catch(err => {
      console.error('HubSpot sync failed (non-blocking):', err.message);
    });

    // Log the operation for audit trail
    console.log(`Admin ${adminEmail} delta-updated prerequisites for exam ${mockExamId}: +${rpcResult.added_count}, -${rpcResult.removed_count}`);

    return res.status(200).json({
      success: true,
      data: {
        prerequisite_exam_ids: rpcResult.prerequisite_exam_ids || [],
        added_count: rpcResult.added_count || 0,
        removed_count: rpcResult.removed_count || 0,
        total_count: rpcResult.current_count || 0
      }
    });

  } catch (error) {
    console.error('Prerequisites delta endpoint error:', error);

    if (error.message === 'Authentication required') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
    }

    return res.status(error.status || 500).json({
      success: false,
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: error.message || 'An error occurred processing the request'
      }
    });
  }
};

/**
 * Fire-and-forget sync to HubSpot associations
 * Creates associations for added prerequisites, deletes associations for removed prerequisites
 * @param {string} mockExamId - The mock exam HubSpot ID
 * @param {string[]} addIds - Prerequisite IDs to add
 * @param {string[]} removeIds - Prerequisite IDs to remove
 * @param {string} adminEmail - Admin performing the action (for logging)
 */
async function syncToHubSpot(mockExamId, addIds, removeIds, adminEmail) {
  const mockExamsObjectType = HUBSPOT_OBJECTS.mock_exams;

  // Create associations for added prerequisites
  if (addIds.length > 0) {
    try {
      const createInputs = addIds.map(prereqId => ({
        from: { id: mockExamId },
        to: { id: prereqId },
        types: [{
          associationCategory: 'USER_DEFINED',
          associationTypeId: PREREQUISITE_ASSOCIATION_TYPE_ID
        }]
      }));

      await hubspot.batchCreateAssociations(mockExamsObjectType, mockExamsObjectType, createInputs);
      console.log(`HubSpot: Created ${addIds.length} prerequisite associations for exam ${mockExamId}`);
    } catch (err) {
      console.error(`HubSpot: Failed to create associations for exam ${mockExamId}:`, err.message);
      // Fire-and-forget: don't throw, just log
    }
  }

  // Delete associations for removed prerequisites
  if (removeIds.length > 0) {
    try {
      const deleteInputs = removeIds.map(prereqId => ({
        from: { id: mockExamId },
        to: [{ id: prereqId }],
        types: [{
          associationCategory: 'USER_DEFINED',
          associationTypeId: PREREQUISITE_ASSOCIATION_TYPE_ID
        }]
      }));

      await hubspot.batchDeleteAssociations(mockExamsObjectType, mockExamsObjectType, deleteInputs);
      console.log(`HubSpot: Deleted ${removeIds.length} prerequisite associations for exam ${mockExamId}`);
    } catch (err) {
      console.error(`HubSpot: Failed to delete associations for exam ${mockExamId}:`, err.message);
      // Fire-and-forget: don't throw, just log
    }
  }

  console.log(`HubSpot sync completed for exam ${mockExamId} by ${adminEmail}`);
}
