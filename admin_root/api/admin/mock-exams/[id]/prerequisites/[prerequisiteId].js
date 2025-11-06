/**
 * DELETE /api/admin/mock-exams/[id]/prerequisites/[prerequisiteId]
 * Remove a single prerequisite association from a Mock Discussion exam
 */

const { requireAdmin } = require('../../../../middleware/requireAdmin');
const hubspot = require('../../../../../_shared/hubspot');
const { HUBSPOT_OBJECTS } = require('../../../../../_shared/hubspot');

// Association type ID for "requires attendance at" relationship
const PREREQUISITE_ASSOCIATION_TYPE_ID = 1340;

module.exports = async (req, res) => {
  // Only handle DELETE requests
  if (req.method !== 'DELETE') {
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} not allowed`
    });
  }

  try {
    // Verify admin authentication
    const user = await requireAdmin(req);
    const adminEmail = user?.email || 'admin@prepdoctors.ca';

    // Extract IDs from query params
    const mockExamId = req.query.id;
    const prerequisiteId = req.query.prerequisiteId;

    // Validate ID formats
    if (!mockExamId || !/^\d+$/.test(mockExamId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'Valid mock exam ID is required'
        }
      });
    }

    if (!prerequisiteId || !/^\d+$/.test(prerequisiteId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PREREQUISITE_ID',
          message: 'Valid prerequisite exam ID is required'
        }
      });
    }

    // Verify the mock exam exists
    const mockExam = await hubspot.getMockExam(mockExamId);

    if (!mockExam) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Mock exam not found'
        }
      });
    }

    // Verify this is a Mock Discussion exam
    if (mockExam.properties.mock_type !== 'Mock Discussion') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_EXAM_TYPE',
          message: 'Prerequisites can only be removed from Mock Discussion exams'
        }
      });
    }

    // Verify the prerequisite association exists
    const existingPrerequisites = await hubspot.getMockExamAssociations(
      mockExamId,
      PREREQUISITE_ASSOCIATION_TYPE_ID
    );

    const prerequisiteExists = existingPrerequisites.some(p => p.id === prerequisiteId);

    if (!prerequisiteExists) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ASSOCIATION_NOT_FOUND',
          message: 'This prerequisite association does not exist'
        }
      });
    }

    // Delete the association using batch delete API (even for single deletion)
    const deleteInputs = [{
      from: { id: mockExamId },
      to: { id: prerequisiteId }
    }];

    await hubspot.batchDeleteAssociations(
      HUBSPOT_OBJECTS.mock_exams,
      HUBSPOT_OBJECTS.mock_exams,
      deleteInputs
    );

    // Log the operation for audit trail
    console.log(`Admin ${adminEmail} removed prerequisite ${prerequisiteId} from Mock Discussion ${mockExamId}`);

    // Get updated list of prerequisites
    const remainingPrerequisites = existingPrerequisites.filter(p => p.id !== prerequisiteId);

    return res.status(200).json({
      success: true,
      data: {
        mock_exam_id: mockExamId,
        removed_prerequisite_id: prerequisiteId,
        remaining_prerequisites_count: remainingPrerequisites.length
      },
      message: 'Prerequisite association removed successfully'
    });

  } catch (error) {
    console.error('Error removing prerequisite association:', error);

    if (error.message === 'Authentication required') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
    }

    if (error.response?.status === 404) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Mock exam or prerequisite not found'
        }
      });
    }

    if (error.response?.status === 429) {
      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'HubSpot API rate limit exceeded. Please try again in a few moments.'
        }
      });
    }

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while removing the prerequisite association'
      }
    });
  }
};