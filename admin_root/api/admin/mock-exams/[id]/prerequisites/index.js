/**
 * API Endpoints for managing Mock Discussion prerequisite associations
 *
 * POST /api/admin/mock-exams/[id]/prerequisites
 * - Create batch associations for prerequisite mock exams
 *
 * GET /api/admin/mock-exams/[id]/prerequisites
 * - Retrieve all prerequisite associations for a mock exam
 */

const { requireAdmin } = require('../../../middleware/requireAdmin');
const { validateInput } = require('../../../../_shared/validation');
const hubspot = require('../../../../_shared/hubspot');
const { HUBSPOT_OBJECTS } = require('../../../../_shared/hubspot');
const Joi = require('joi');

// Association type ID for "requires attendance at" relationship
const PREREQUISITE_ASSOCIATION_TYPE_ID = 1340;
const { getCache } = require('../../../../_shared/cache');

module.exports = async (req, res) => {
  try {
    // Verify admin authentication
    const user = await requireAdmin(req);
    const adminEmail = user?.email || 'admin@prepdoctors.ca';

    // Extract mock exam ID from path params
    const mockExamId = req.params.id;

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

    // Route to appropriate handler based on method
    switch (req.method) {
      case 'POST':
        return handlePostRequest(req, res, mockExamId, adminEmail);
      case 'GET':
        return handleGetRequest(req, res, mockExamId);
      default:
        return res.status(405).json({
          success: false,
          error: `Method ${req.method} not allowed`
        });
    }
  } catch (error) {
    console.error('Prerequisites endpoint error:', error);

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
 * Handle POST request to create prerequisite associations
 */
async function handlePostRequest(req, res) {
  try {
    // Verify admin authentication
    const user = await requireAdmin(req);
    const adminEmail = user?.email || 'admin@prepdoctors.ca';

    // Extract mock exam ID from path params
    const mockExamId = req.params.id;

    // Validate mock exam ID format
    if (!mockExamId || !/^\d+$/.test(mockExamId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'Valid mock exam ID is required'
        }
      });
    }

    // Parse request body
    const { prerequisite_exam_ids = [] } = req.body;

    // Validate that prerequisite_exam_ids is an array
    if (!Array.isArray(prerequisite_exam_ids)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'prerequisite_exam_ids must be an array'
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
          message: 'Prerequisites can only be set for Mock Discussion exams'
        }
      });
    }

    // If empty array, delete all associations
    if (prerequisite_exam_ids.length === 0) {
      // Get existing associations
      const existingPrereqs = await hubspot.getMockExamAssociations(mockExamId, PREREQUISITE_ASSOCIATION_TYPE_ID);

      if (existingPrereqs.length > 0) {
        // Delete all existing associations
        const deleteInputs = existingPrereqs.map(prereq => ({
          from: { id: mockExamId },
          to: [{ id: prereq.id }],
          types: [{
            associationCategory: "USER_DEFINED",
            associationTypeId: PREREQUISITE_ASSOCIATION_TYPE_ID
          }]
        }));

        await hubspot.batchDeleteAssociations(
          HUBSPOT_OBJECTS.mock_exams,
          HUBSPOT_OBJECTS.mock_exams,
          deleteInputs
        );
      }

      // CRITICAL: Invalidate cache after prerequisites change
      const cache = getCache();
      const cacheKey = `admin:mock-exam:details:${mockExamId}`;
      await cache.delete(cacheKey);
      console.log(`🗑️ Cache invalidated for mock exam ${mockExamId}`);

      console.log(`Admin ${adminEmail} cleared all prerequisites from Mock Discussion ${mockExamId}`);

      return res.status(200).json({
        success: true,
        data: {
          mock_exam_id: mockExamId,
          prerequisite_exam_ids: [],
          prerequisite_exams: []
        },
        message: 'All prerequisite associations removed successfully'
      });
    }

    // Validate that prerequisite IDs are valid numbers
    for (const prereqId of prerequisite_exam_ids) {
      if (!/^\d+$/.test(prereqId)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PREREQUISITE_ID',
            message: `Invalid prerequisite exam ID: ${prereqId}`
          }
        });
      }
    }

    // Verify all prerequisite exams exist and are Clinical Skills or Situational Judgment
    const validPrerequisites = [];
    for (const prereqId of prerequisite_exam_ids) {
      try {
        const prereqExam = await hubspot.getMockExam(prereqId);
        
        if (!prereqExam) {
          return res.status(404).json({
            success: false,
            error: {
              code: 'PREREQUISITE_NOT_FOUND',
              message: `Prerequisite exam ${prereqId} not found`
            }
          });
        }

        // Only allow Clinical Skills and Situational Judgment as prerequisites
        const mockType = prereqExam.properties.mock_type;
        if (mockType !== 'Clinical Skills' && mockType !== 'Situational Judgment') {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_PREREQUISITE_TYPE',
              message: `Only Clinical Skills and Situational Judgment exams can be prerequisites (exam ${prereqId} is ${mockType})`
            }
          });
        }

        // Verify prerequisite is scheduled before the Discussion exam
        const discussionDate = new Date(mockExam.properties.exam_date);
        const prereqDate = new Date(prereqExam.properties.exam_date);

        if (prereqDate >= discussionDate) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_PREREQUISITE_DATE',
              message: `Prerequisite exam ${prereqId} must be scheduled before the Discussion exam`
            }
          });
        }

        validPrerequisites.push({ id: prereqId, exam: prereqExam });
      } catch (error) {
        console.error(`Error fetching prerequisite exam ${prereqId}:`, error);
        return res.status(500).json({
          success: false,
          error: {
            code: 'PREREQUISITE_FETCH_ERROR',
            message: `Failed to verify prerequisite exam ${prereqId}`
          }
        });
      }
    }

    // Get existing associations to handle updates properly
    const existingPrereqs = await hubspot.getMockExamAssociations(mockExamId, PREREQUISITE_ASSOCIATION_TYPE_ID);
    const existingIds = new Set(existingPrereqs.map(p => p.id));
    const newIds = new Set(prerequisite_exam_ids);

    // Determine which associations to create and delete
    const toCreate = prerequisite_exam_ids.filter(id => !existingIds.has(id));
    const toDelete = existingPrereqs.filter(p => !newIds.has(p.id)).map(p => p.id);

    // Delete removed associations
    if (toDelete.length > 0) {
      const deleteInputs = toDelete.map(prereqId => ({
        from: { id: mockExamId },
        to: [{ id: prereqId }],
        types: [{
          associationCategory: "USER_DEFINED",
          associationTypeId: PREREQUISITE_ASSOCIATION_TYPE_ID
        }]
      }));

      await hubspot.batchDeleteAssociations(
        HUBSPOT_OBJECTS.mock_exams,
        HUBSPOT_OBJECTS.mock_exams,
        deleteInputs
      );
    }

    // Create new associations
    if (toCreate.length > 0) {
      // Build batch association inputs
      const batchInputs = toCreate.map(prereqId => ({
        from: { id: mockExamId },
        to: { id: prereqId },
        types: [{
          associationCategory: "USER_DEFINED",
          associationTypeId: PREREQUISITE_ASSOCIATION_TYPE_ID
        }]
      }));

      // Make single batch API call to create all associations
      await hubspot.batchCreateAssociations(
        HUBSPOT_OBJECTS.mock_exams,
        HUBSPOT_OBJECTS.mock_exams,
        batchInputs
      );
    }

    // Format response with prerequisite exam details
    const prerequisiteDetails = validPrerequisites.map(({ exam }) => ({
      id: exam.id,
      mock_type: exam.properties.mock_type,
      exam_date: exam.properties.exam_date,
      location: exam.properties.location || 'Not specified',
      start_time: exam.properties.start_time,
      end_time: exam.properties.end_time,
      capacity: parseInt(exam.properties.capacity || '0'),
      total_bookings: parseInt(exam.properties.total_bookings || '0')
    }));

    // Sort prerequisite details by exam date (earliest first)
    prerequisiteDetails.sort((a, b) => {
      const dateA = new Date(a.exam_date);
      const dateB = new Date(b.exam_date);
      return dateA - dateB;
    });

    // CRITICAL: Invalidate cache after prerequisites change
    const cache = getCache();
    const cacheKey = `admin:mock-exam:details:${mockExamId}`;
    await cache.delete(cacheKey);
    console.log(`🗑️ Cache invalidated for mock exam ${mockExamId}`);

    // Log the operation for audit trail
    console.log(`Admin ${adminEmail} updated prerequisites for Mock Discussion ${mockExamId}: added ${toCreate.length}, removed ${toDelete.length}`);

    return res.status(200).json({
      success: true,
      data: {
        mock_exam_id: mockExamId,
        prerequisite_exam_ids: prerequisite_exam_ids,
        prerequisite_exams: prerequisiteDetails,
        changes: {
          created: toCreate.length,
          deleted: toDelete.length
        }
      },
      message: 'Prerequisite associations updated successfully'
    });

  } catch (error) {
    console.error('Error creating prerequisite associations:', error);

    if (error.message === 'Authentication required') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
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
        message: 'An error occurred while creating prerequisite associations'
      }
    });
  }
}

/**
 * Handle GET request to retrieve prerequisite associations
 */
async function handleGetRequest(req, res, mockExamId) {
  try {
    // Fetch the mock exam to verify it exists
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

    // Get prerequisite associations
    const prerequisites = await hubspot.getMockExamAssociations(mockExamId, PREREQUISITE_ASSOCIATION_TYPE_ID);

    // Format prerequisite details
    const prerequisiteDetails = prerequisites.map(exam => ({
      id: exam.id,
      mock_type: exam.properties.mock_type,
      exam_date: exam.properties.exam_date,
      location: exam.properties.location || 'Not specified',
      start_time: exam.properties.start_time,
      end_time: exam.properties.end_time,
      capacity: parseInt(exam.properties.capacity || '0'),
      total_bookings: parseInt(exam.properties.total_bookings || '0'),
      is_active: exam.properties.is_active === 'true'
    }));

    // Sort by exam date (earliest first)
    prerequisiteDetails.sort((a, b) => {
      const dateA = new Date(a.exam_date);
      const dateB = new Date(b.exam_date);
      return dateA - dateB;
    });

    return res.status(200).json({
      success: true,
      data: {
        mock_exam_id: mockExamId,
        mock_exam_type: mockExam.properties.mock_type,
        total_prerequisites: prerequisiteDetails.length,
        prerequisite_exams: prerequisiteDetails
      }
    });

  } catch (error) {
    console.error('Error retrieving prerequisite associations:', error);

    if (error.response?.status === 404) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Mock exam not found'
        }
      });
    }

    throw error;
  }
}