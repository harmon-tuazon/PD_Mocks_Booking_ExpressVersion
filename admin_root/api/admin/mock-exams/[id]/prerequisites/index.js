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
async function handlePostRequest(req, res, mockExamId, adminEmail) {
  try {
    // Validate request body
    const schema = Joi.object({
      prerequisite_exam_ids: Joi.array()
        .items(Joi.string().pattern(/^\d+$/))
        .min(0)
        .max(50) // Reasonable limit to prevent excessive API calls
        .required()
        .messages({
          'array.base': 'prerequisite_exam_ids must be an array',
          'array.min': 'prerequisite_exam_ids can be an empty array',
          'array.max': 'Cannot associate more than 50 prerequisites at once',
          'string.pattern.base': 'Each exam ID must be numeric'
        })
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message
        }
      });
    }

    const { prerequisite_exam_ids } = value;

    // If empty array, clear all associations (intentional)
    if (prerequisite_exam_ids.length === 0) {
      // Get existing associations
      const existingPrereqs = await hubspot.getMockExamAssociations(mockExamId, PREREQUISITE_ASSOCIATION_TYPE_ID);

      if (existingPrereqs.length > 0) {
        // Delete all existing associations
        const deleteInputs = existingPrereqs.map(prereq => ({
          from: { id: mockExamId },
          to: { id: prereq.id }
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
      console.log(`🗑️ Cache invalidated for mock exam ${mockExamId} after clearing prerequisites`);

      return res.status(200).json({
        success: true,
        data: {
          mock_exam_id: mockExamId,
          associations_created: 0,
          associations_deleted: existingPrereqs.length,
          prerequisite_exams: []
        },
        message: 'All prerequisite associations removed'
      });
    }

    // Fetch the mock exam to verify it exists and check its type
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
          message: 'Prerequisites can only be associated with Mock Discussion exams'
        }
      });
    }

    // Fetch all prerequisite exams to validate
    const prereqPromises = prerequisite_exam_ids.map(id => hubspot.getMockExam(id));
    const prerequisiteExams = await Promise.all(prereqPromises);

    // Validate all prerequisites exist and are correct type
    const validPrerequisites = [];
    const errors = [];

    for (let i = 0; i < prerequisiteExams.length; i++) {
      const prereqExam = prerequisiteExams[i];
      const prereqId = prerequisite_exam_ids[i];

      if (!prereqExam) {
        errors.push(`Exam ID ${prereqId} not found`);
        continue;
      }

      const prereqType = prereqExam.properties.mock_type;
      if (prereqType !== 'Clinical Skills' && prereqType !== 'Situational Judgment') {
        errors.push(`Exam ID ${prereqId} is type "${prereqType}" - only Clinical Skills and Situational Judgment exams can be prerequisites`);
        continue;
      }

      // Prevent self-association
      if (prereqId === mockExamId) {
        errors.push('Cannot associate an exam as its own prerequisite');
        continue;
      }

      validPrerequisites.push({
        id: prereqId,
        exam: prereqExam
      });
    }

    // If there were validation errors, return them
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Some prerequisites could not be validated',
          details: errors
        }
      });
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
        to: { id: prereqId }
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

    // CRITICAL: Invalidate cache after prerequisites change
    const cache = getCache();
    const cacheKey = `admin:mock-exam:details:${mockExamId}`;
    await cache.delete(cacheKey);
    console.log(`🗑️ Cache invalidated for mock exam ${mockExamId} after updating prerequisites`);

    // Log the operation for audit trail
    console.log(`Admin ${adminEmail} updated prerequisites for Mock Discussion ${mockExamId}:`, {
      created: toCreate.length,
      deleted: toDelete.length,
      total: prerequisite_exam_ids.length
    });

    return res.status(200).json({
      success: true,
      data: {
        mock_exam_id: mockExamId,
        associations_created: toCreate.length,
        associations_deleted: toDelete.length,
        total_prerequisites: prerequisite_exam_ids.length,
        prerequisite_exams: prerequisiteDetails
      },
      message: `Successfully updated prerequisites: ${toCreate.length} added, ${toDelete.length} removed`
    });

  } catch (error) {
    console.error('Error creating prerequisite associations:', error);

    // Handle HubSpot API errors
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

    throw error;
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