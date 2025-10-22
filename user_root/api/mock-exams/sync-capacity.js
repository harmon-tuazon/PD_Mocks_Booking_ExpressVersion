require('dotenv').config();
const { HubSpotService, HUBSPOT_OBJECTS } = require('../_shared/hubspot');
const { validateInput } = require('../_shared/validation');
const {
  setCorsHeaders,
  handleOptionsRequest,
  createErrorResponse,
  createSuccessResponse,
  verifyEnvironmentVariables,
  rateLimitMiddleware
} = require('../_shared/auth');

/**
 * POST /api/mock-exams/sync-capacity
 * Recalculate and sync the capacity for one or more mock exams
 * This ensures total_bookings reflects only active (non-deleted) bookings
 *
 * Body parameters:
 * - mock_exam_ids: Array of mock exam IDs to sync (optional, syncs all if not provided)
 * - dry_run: Boolean to preview changes without updating (optional, default false)
 */
module.exports = async (req, res) => {
  // Set CORS headers
  setCorsHeaders(res);

  // Handle OPTIONS request
  if (handleOptionsRequest(req, res)) {
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json(
      createErrorResponse(new Error('Method not allowed'))
    );
  }

  try {
    // Verify environment variables
    verifyEnvironmentVariables();

    // Apply rate limiting
    const rateLimiter = rateLimitMiddleware({
      maxRequests: 5, // Limited to prevent abuse
      windowMs: 60000 // 1 minute
    });

    if (await rateLimiter(req, res)) {
      return; // Request was rate limited
    }

    // Parse request body
    const { mock_exam_ids, dry_run = false } = req.body || {};

    // Initialize HubSpot service
    const hubspot = new HubSpotService();

    let examsToSync = [];

    if (mock_exam_ids && Array.isArray(mock_exam_ids) && mock_exam_ids.length > 0) {
      // Sync specific exams
      console.log(`Syncing capacity for ${mock_exam_ids.length} specific mock exams`);

      // Limit to 20 exams per request to prevent timeout
      if (mock_exam_ids.length > 20) {
        const error = new Error('Maximum 20 mock exams can be synced per request');
        error.status = 400;
        error.code = 'TOO_MANY_EXAMS';
        throw error;
      }

      examsToSync = mock_exam_ids;
    } else {
      // Sync all active mock exams
      console.log('Syncing capacity for all active mock exams');

      // Fetch all active mock exams
      const searchPayload = {
        filterGroups: [{
          filters: [{
            propertyName: 'is_active',
            operator: 'EQ',
            value: 'true'
          }]
        }],
        properties: ['hs_object_id'],
        limit: 100 // Reasonable limit for sync operation
      };

      const searchResult = await hubspot.apiCall(
        'POST',
        `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/search`,
        searchPayload
      );

      examsToSync = searchResult.results?.map(exam => exam.id) || [];
    }

    if (examsToSync.length === 0) {
      return res.status(200).json(createSuccessResponse({
        synced: 0,
        message: 'No mock exams to sync'
      }));
    }

    console.log(`Processing ${examsToSync.length} mock exams for capacity sync`);

    // Process each exam
    const syncResults = await Promise.allSettled(
      examsToSync.map(async examId => {
        try {
          // Get current stored count
          const exam = await hubspot.getMockExam(examId);
          const currentCount = parseInt(exam.properties.total_bookings) || 0;

          // Get actual active bookings count
          const actualCount = await hubspot.getActiveBookingsCount(examId);

          const result = {
            examId,
            examDate: exam.properties.exam_date,
            mockType: exam.properties.mock_type,
            previousCount: currentCount,
            actualCount,
            difference: actualCount - currentCount,
            needsUpdate: actualCount !== currentCount
          };

          // Update if needed and not a dry run
          if (result.needsUpdate && !dry_run) {
            await hubspot.updateMockExamBookings(examId, actualCount);
            result.updated = true;
            console.log(`✅ Updated mock exam ${examId}: ${currentCount} → ${actualCount}`);
          } else if (result.needsUpdate) {
            result.updated = false;
            console.log(`🔍 DRY RUN: Would update mock exam ${examId}: ${currentCount} → ${actualCount}`);
          } else {
            console.log(`✓ Mock exam ${examId} already accurate: ${currentCount}`);
          }

          return result;
        } catch (error) {
          console.error(`Failed to sync mock exam ${examId}:`, error.message);
          throw {
            examId,
            error: error.message
          };
        }
      })
    );

    // Compile results
    const successful = syncResults
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);

    const failed = syncResults
      .filter(r => r.status === 'rejected')
      .map(r => r.reason);

    const updated = successful.filter(r => r.updated);
    const wouldUpdate = successful.filter(r => r.needsUpdate && !r.updated);
    const unchanged = successful.filter(r => !r.needsUpdate);

    // Calculate summary statistics
    const totalCorrections = successful
      .filter(r => r.needsUpdate)
      .reduce((sum, r) => sum + Math.abs(r.difference), 0);

    const response = {
      summary: {
        processed: examsToSync.length,
        successful: successful.length,
        failed: failed.length,
        updated: dry_run ? 0 : updated.length,
        wouldUpdate: dry_run ? wouldUpdate.length : 0,
        unchanged: unchanged.length,
        totalCorrections: dry_run ? 0 : totalCorrections
      },
      mode: dry_run ? 'dry_run' : 'live',
      results: {
        updated: dry_run ? [] : updated,
        wouldUpdate: dry_run ? wouldUpdate : [],
        unchanged: unchanged.map(r => ({
          examId: r.examId,
          examDate: r.examDate,
          mockType: r.mockType,
          count: r.actualCount
        })),
        failed: failed
      }
    };

    console.log('Capacity sync complete:', response.summary);

    res.status(200).json(createSuccessResponse(
      response,
      dry_run
        ? `Dry run complete: ${wouldUpdate.length} exams would be updated`
        : `Sync complete: ${updated.length} exams updated`
    ));

  } catch (error) {
    console.error('Error syncing mock exam capacity:', error);

    const statusCode = error.status || 500;
    res.status(statusCode).json(createErrorResponse(error));
  }
};