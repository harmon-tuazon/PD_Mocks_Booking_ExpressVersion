require('dotenv').config();
const {
  setCorsHeaders,
  handleOptionsRequest,
  createErrorResponse,
  createSuccessResponse,
  verifyEnvironmentVariables,
  rateLimitMiddleware,
  sanitizeInput
} = require('../_shared/auth');
const { validateInput } = require('../_shared/validation');
const { HubSpotService } = require('../_shared/hubspot');
const {
  getContactCreditsFromSupabase,
  syncContactCreditsToSupabase
} = require('../_shared/supabase-data');
const { CacheService } = require('../_shared/cache');

/**
 * POST /api/user/login
 * Authenticate student login with 4-tier caching strategy
 *
 * Flow:
 * 1. Try Redis distributed cache first (~10-20ms) - fastest path
 * 2. Try Supabase secondary DB (~50ms) - fast path
 * 3. Fallback to HubSpot (~500ms) if not cached - source of truth
 * 4. Auto-populate Redis and Supabase for future requests
 *
 * Returns: Student profile with all credit balances
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
      maxRequests: 10,
      windowMs: 60000 // 1 minute - stricter for login
    });

    if (await rateLimiter(req, res)) {
      return; // Request was rate limited
    }

    // Validate input - requires student_id and email
    const validatedData = await validateInput(req.body, 'authCheck');
    const { student_id, email } = validatedData;

    // Sanitize inputs
    const sanitizedStudentId = sanitizeInput(student_id);
    const sanitizedEmail = sanitizeInput(email);

    let contact = null;
    let dataSource = null;

    // Initialize cache service
    const cache = new CacheService();
    const cacheKey = `contact:credits:${sanitizedStudentId}:${sanitizedEmail}`;

    // PHASE 0: Try Redis distributed cache first (fastest path ~10-20ms)
    try {
      const cachedContact = await cache.get(cacheKey);
      if (cachedContact) {
        console.log(`✅ [REDIS LOGIN] Reading from distributed cache for student ${sanitizedStudentId}`);
        dataSource = 'redis';
        contact = cachedContact;
      }
    } catch (redisError) {
      console.error('[REDIS ERROR] Failed to read from cache during login:', redisError.message);
      // Continue to Supabase fallback
    }

    // PHASE 1: Try Supabase secondary database if not in Redis (fast path ~50ms)
    if (!contact) {
      try {
        const supabaseContact = await getContactCreditsFromSupabase(sanitizedStudentId, sanitizedEmail);

        if (supabaseContact) {
          console.log(`✅ [SUPABASE LOGIN] Reading from secondary DB for student ${sanitizedStudentId}`);
          dataSource = 'supabase';

          // Convert Supabase format to HubSpot format for compatibility
          contact = {
            id: supabaseContact.hubspot_id,
            uuid: supabaseContact.id,
            properties: {
              student_id: supabaseContact.student_id,
              email: supabaseContact.email,
              firstname: supabaseContact.firstname,
              lastname: supabaseContact.lastname,
              sj_credits: supabaseContact.sj_credits?.toString() || '0',
              cs_credits: supabaseContact.cs_credits?.toString() || '0',
              sjmini_credits: supabaseContact.sjmini_credits?.toString() || '0',
              mock_discussion_token: supabaseContact.mock_discussion_token?.toString() || '0',
              shared_mock_credits: supabaseContact.shared_mock_credits?.toString() || '0',
              ndecc_exam_date: supabaseContact.ndecc_exam_date
            }
          };

          // Cache in Redis for future requests (5-minute TTL)
          await cache.set(cacheKey, contact, 5 * 60).catch(cacheError => {
            console.error('[REDIS ERROR] Failed to cache Supabase contact:', cacheError.message);
            // Non-blocking - continue even if Redis cache fails
          });
        }
      } catch (supabaseError) {
        console.error('[SUPABASE ERROR] Failed to read from secondary DB during login:', supabaseError.message);
        // Continue to HubSpot fallback
      }
    }

    // PHASE 2: Fallback to HubSpot (source of truth) if not in Supabase
    if (!contact) {
      console.log(`⚠️ [HUBSPOT LOGIN] Reading from source of truth for student ${sanitizedStudentId}`);
      dataSource = 'hubspot';

      const hubspot = new HubSpotService();
      contact = await hubspot.searchContacts(sanitizedStudentId, sanitizedEmail);

      // Check if contact exists
      if (!contact) {
        const error = new Error('Student not found in system. Please check your Student ID and email.');
        error.status = 404;
        error.code = 'STUDENT_NOT_FOUND';
        throw error;
      }

      // Verify email matches
      if (contact.properties.email?.toLowerCase() !== sanitizedEmail.toLowerCase()) {
        const error = new Error('Email does not match student record. Please verify your credentials.');
        error.status = 400;
        error.code = 'EMAIL_MISMATCH';
        throw error;
      }

      // AUTO-POPULATE: Async sync to Supabase for future requests (fire-and-forget)
      syncContactCreditsToSupabase(contact).catch(syncError => {
        console.error('[SYNC ERROR] Failed to cache contact during login:', syncError.message);
        // Non-blocking - don't fail the request if sync fails
      });

      // Cache in Redis for future requests (5-minute TTL)
      await cache.set(cacheKey, contact, 5 * 60).catch(cacheError => {
        console.error('[REDIS ERROR] Failed to cache HubSpot contact:', cacheError.message);
        // Non-blocking - continue even if Redis cache fails
      });
    }

    // Prepare student profile response
    const studentProfile = {
      hubspot_id: contact.id,
      contact_id: contact.uuid,
      student_id: contact.properties.student_id,
      email: contact.properties.email,
      name: `${contact.properties.firstname || ''} ${contact.properties.lastname || ''}`.trim() || 'Student',
      firstname: contact.properties.firstname,
      lastname: contact.properties.lastname,
      ndecc_exam_date: contact.properties.ndecc_exam_date || null,

      // Credit balances
      credits: {
        sj_credits: parseInt(contact.properties.sj_credits) || 0,
        cs_credits: parseInt(contact.properties.cs_credits) || 0,
        sjmini_credits: parseInt(contact.properties.sjmini_credits) || 0,
        mock_discussion_token: parseInt(contact.properties.mock_discussion_token) || 0,
        shared_mock_credits: parseInt(contact.properties.shared_mock_credits) || 0
      },

      // Metadata for debugging/monitoring
      _metadata: {
        data_source: dataSource,
        timestamp: new Date().toISOString()
      }
    };

    // Return success response
    res.status(200).json(createSuccessResponse(
      studentProfile,
      'Login successful'
    ));

  } catch (error) {
    console.error('Error during student login:', error);

    const statusCode = error.status || 500;
    res.status(statusCode).json(createErrorResponse(error));
  }
};
