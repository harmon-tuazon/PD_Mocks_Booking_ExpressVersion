const {
  createSuccessResponse,
  sanitizeInput
} = require('../../services/auth');
const { validateInput } = require('../../services/validation');
const { HubSpotService } = require('../../services/hubspot');
const {
  getContactCreditsFromSupabase,
  syncContactCreditsToSupabase
} = require('../../services/supabase-data');
const { CacheService } = require('../../services/cache');

/**
 * POST /api/user/login
 * Authenticate student login with 4-tier caching strategy
 */
const login = async (req, res, next) => {
  try {
    // Validate input
    const validatedData = await validateInput(req.body, 'authCheck');
    const { student_id, email } = validatedData;

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
    }

    // PHASE 1: Try Supabase if not in Redis (fast path ~50ms)
    if (!contact) {
      try {
        const supabaseContact = await getContactCreditsFromSupabase(sanitizedStudentId, sanitizedEmail);

        if (supabaseContact) {
          console.log(`✅ [SUPABASE LOGIN] Reading from secondary DB for student ${sanitizedStudentId}`);
          dataSource = 'supabase';

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

          // Cache in Redis
          await cache.set(cacheKey, contact, 5 * 60).catch(cacheError => {
            console.error('[REDIS ERROR] Failed to cache Supabase contact:', cacheError.message);
          });
        }
      } catch (supabaseError) {
        console.error('[SUPABASE ERROR] Failed to read from secondary DB during login:', supabaseError.message);
      }
    }

    // PHASE 2: Fallback to HubSpot
    if (!contact) {
      console.log(`⚠️ [HUBSPOT LOGIN] Reading from source of truth for student ${sanitizedStudentId}`);
      dataSource = 'hubspot';

      const hubspot = new HubSpotService();
      contact = await hubspot.searchContacts(sanitizedStudentId, sanitizedEmail);

      if (!contact) {
        const error = new Error('Student not found in system. Please check your Student ID and email.');
        error.status = 404;
        error.code = 'STUDENT_NOT_FOUND';
        throw error;
      }

      if (contact.properties.email?.toLowerCase() !== sanitizedEmail.toLowerCase()) {
        const error = new Error('Email does not match student record. Please verify your credentials.');
        error.status = 400;
        error.code = 'EMAIL_MISMATCH';
        throw error;
      }

      // AUTO-POPULATE: Async sync to Supabase
      syncContactCreditsToSupabase(contact).catch(syncError => {
        console.error('[SYNC ERROR] Failed to cache contact during login:', syncError.message);
      });

      // Cache in Redis
      await cache.set(cacheKey, contact, 5 * 60).catch(cacheError => {
        console.error('[REDIS ERROR] Failed to cache HubSpot contact:', cacheError.message);
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

      credits: {
        sj_credits: parseInt(contact.properties.sj_credits) || 0,
        cs_credits: parseInt(contact.properties.cs_credits) || 0,
        sjmini_credits: parseInt(contact.properties.sjmini_credits) || 0,
        mock_discussion_token: parseInt(contact.properties.mock_discussion_token) || 0,
        shared_mock_credits: parseInt(contact.properties.shared_mock_credits) || 0
      },

      _metadata: {
        data_source: dataSource,
        timestamp: new Date().toISOString()
      }
    };

    res.status(200).json(createSuccessResponse(
      studentProfile,
      'Login successful'
    ));

  } catch (error) {
    next(error);
  }
};

module.exports = { login };
