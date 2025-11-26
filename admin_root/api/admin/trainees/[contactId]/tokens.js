/**
 * PATCH /api/admin/trainees/[contactId]/tokens
 * Update trainee credit tokens
 *
 * Request body:
 * {
 *   tokens: {
 *     mock_discussion: 5,
 *     clinical_skills: 3,
 *     situational_judgment: 2,
 *     mini_mock: 1,
 *     shared_mock: 0
 *   }
 * }
 *
 * Architecture:
 * 1. Write to HubSpot (source of truth)
 * 2. Sync to Supabase (fire-and-forget)
 * 3. Invalidate Redis cache
 */

const { requirePermission } = require('../../middleware/requirePermission');
const { validateInput } = require('../../../_shared/validation');
const hubspot = require('../../../_shared/hubspot');
const { getCache } = require('../../../_shared/cache');
const { syncContactCreditsToSupabase } = require('../../../_shared/supabaseSync');

module.exports = async (req, res) => {
  try {
    // 1. Auth & permission check (RBAC: contacts.tokens)
    const user = await requirePermission(req, 'contacts.tokens');

    // 2. Validate request body
    const validatedData = await validateInput(
      { ...req.query, ...req.body },
      'updateTraineeTokens'
    );

    // 3. Get contactId from URL and tokens from validated data
    const contactId = req.query.contactId;
    const { tokens } = validatedData;

    if (!contactId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Contact ID is required'
        }
      });
    }

    // 3. Prepare HubSpot properties update
    const properties = {
      mock_discussion_token: tokens.mock_discussion.toString(),
      cs_credits: tokens.clinical_skills.toString(),
      sj_credits: tokens.situational_judgment.toString(),
      sjmini_credits: tokens.mini_mock.toString(),
      shared_mock_credits: tokens.shared_mock.toString()
    };

    // 4. Update HubSpot (source of truth)
    console.log(`[TOKEN UPDATE] Updating tokens for contact ${contactId}:`, properties);

    const updatedContact = await hubspot.updateContact(contactId, properties);

    if (!updatedContact) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Contact not found'
        }
      });
    }

    // 5. Sync to Supabase (fire-and-forget, non-blocking)
    // We need to fetch the full contact to sync all required fields
    const fullContact = await hubspot.getContactById(contactId, [
      'firstname', 'lastname', 'email', 'student_id',
      'mock_discussion_token', 'cs_credits', 'sj_credits',
      'sjmini_credits', 'shared_mock_credits',
      'ndecc_exam_date', 'createdate', 'hs_lastmodifieddate'
    ]);

    // Fire and forget sync to Supabase
    syncContactCreditsToSupabase(fullContact).catch(error => {
      console.error('[TOKEN UPDATE] Supabase sync failed (non-blocking):', error.message);
    });

    // 6. Invalidate related cache keys
    const cache = getCache();
    const cachePatterns = [
      `admin:trainee:search:*`,           // All trainee search results
      `trainee:credits:${contactId}`,     // Specific trainee credits
      `trainee:search:*${contactId}*`,    // Any search containing this contact ID
    ];

    // Delete cache patterns (non-blocking)
    for (const pattern of cachePatterns) {
      cache.deletePattern(pattern).catch(error => {
        console.error(`[TOKEN UPDATE] Failed to delete cache pattern ${pattern}:`, error.message);
      });
    }

    // 7. Return success response with updated tokens
    return res.status(200).json({
      success: true,
      data: {
        contact_id: contactId,
        tokens: {
          mock_discussion: parseInt(properties.mock_discussion_token),
          clinical_skills: parseInt(properties.cs_credits),
          situational_judgment: parseInt(properties.sj_credits),
          mini_mock: parseInt(properties.sjmini_credits),
          shared_mock: parseInt(properties.shared_mock_credits)
        },
        metadata: {
          updated_at: new Date().toISOString(),
          updated_by: user.email,
          cache_invalidated: true,
          supabase_sync_initiated: true
        }
      }
    });

  } catch (error) {
    console.error('[TOKEN UPDATE] Error:', error);

    // Handle specific error types
    if (error.code === 'FORBIDDEN') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: error.message
        }
      });
    }

    if (error.code === 'UNAUTHORIZED') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
    }

    // HubSpot API errors
    if (error.response?.status === 404) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Contact not found in HubSpot'
        }
      });
    }

    // Generic error response
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update trainee tokens'
      }
    });
  }
};
