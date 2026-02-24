/**
 * GET /api/admin/trainees/search
 * Search for trainees in HubSpot CRM
 *
 * Features:
 * - Search by student ID (exact match) or name/email (partial match)
 * - Redis caching with 5-minute TTL
 * - Returns up to 10 results
 * - Debug mode to bypass cache
 *
 * Query Parameters:
 * - query (required): Search term (min 2, max 100 characters)
 * - debug (optional): Set to true to bypass cache
 */

const { requirePermission } = require('../middleware/requirePermission');
const { validationMiddleware } = require('../../_shared/validation');
const { getCache } = require('../../_shared/cache');
const hubspot = require('../../_shared/hubspot');
const {
  getContactByEmailFromSupabase,
  getContactByStudentIdFromSupabase,
  syncContactToSupabase
} = require('../../_shared/supabase-data');

// HubSpot Object Type IDs
const HUBSPOT_OBJECTS = {
  'contacts': '0-1'
};

module.exports = async (req, res) => {
  try {
    // Verify admin authentication and permission
    const user = await requirePermission(req, 'bookings.view');

    // Validate query parameters
    const validator = validationMiddleware('traineeSearch');
    await new Promise((resolve, reject) => {
      validator(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    const { query, debug } = req.validatedData;

    // Trim whitespace from search query
    const trimmedQuery = query.trim();

    // Log search attempt for debugging
    console.log(`🔍 [SEARCH] Query: "${trimmedQuery}" (original: "${query}")`);

    // Initialize cache service
    const cacheService = getCache();
    const cacheKey = `admin:trainee:search:${trimmedQuery.toLowerCase()}`;

    // Check cache (unless debug mode)
    if (!debug) {
      const cachedData = await cacheService.get(cacheKey);
      if (cachedData) {
        console.log(`🎯 [Cache HIT] Trainee search: ${query}`);
        return res.status(200).json({
          ...cachedData,
          meta: {
            ...cachedData.meta,
            cached: true
          }
        });
      }
    } else {
      console.log('🔍 [DEBUG MODE] Cache bypassed for trainee search');
    }

    console.log(`📋 [Cache MISS] Searching for trainees: ${trimmedQuery}`);

    // Detect if query is an email (contains @)
    const isEmail = trimmedQuery.includes('@');
    console.log(`🔍 [SEARCH TYPE] ${isEmail ? 'Email detected' : 'Name/Student ID'}`);

    // Search Supabase directly (primary source of truth)
    let allContacts = [];
    let dataSource = 'supabase';

    try {
      const { supabaseAdmin } = require('../../_shared/supabase');

      if (isEmail) {
        // Exact email match
        console.log(`🗄️ [SUPABASE] Searching by email: ${trimmedQuery}`);
        const { data: emailResults, error: emailError } = await supabaseAdmin
          .from('hubspot_contact_credits')
          .select('*')
          .ilike('email', trimmedQuery)
          .limit(10);

        if (!emailError && emailResults?.length > 0) {
          console.log(`✅ [SUPABASE] Found ${emailResults.length} contact(s) by email`);
          allContacts = emailResults.map(c => ({
            id: c.hubspot_id,
            properties: {
              firstname: c.firstname,
              lastname: c.lastname,
              email: c.email,
              student_id: c.student_id,
              ndecc_exam_date: c.ndecc_exam_date,
              mock_discussion_token: c.mock_discussion_token,
              cs_credits: c.cs_credits,
              sj_credits: c.sj_credits,
              sjmini_credits: c.sjmini_credits,
              shared_mock_credits: c.shared_mock_credits
            }
          }));
        }
      } else {
        // Search by student_id (exact) OR name (partial match)
        console.log(`🗄️ [SUPABASE] Searching by student_id or name: ${trimmedQuery}`);
        const searchPattern = `%${trimmedQuery}%`;

        const { data: results, error: searchError } = await supabaseAdmin
          .from('hubspot_contact_credits')
          .select('*')
          .or(`student_id.ilike.${searchPattern},firstname.ilike.${searchPattern},lastname.ilike.${searchPattern},email.ilike.${searchPattern}`)
          .limit(10);

        if (!searchError && results?.length > 0) {
          console.log(`✅ [SUPABASE] Found ${results.length} contact(s) by name/student_id`);
          allContacts = results.map(c => ({
            id: c.hubspot_id,
            properties: {
              firstname: c.firstname,
              lastname: c.lastname,
              email: c.email,
              student_id: c.student_id,
              ndecc_exam_date: c.ndecc_exam_date,
              mock_discussion_token: c.mock_discussion_token,
              cs_credits: c.cs_credits,
              sj_credits: c.sj_credits,
              sjmini_credits: c.sjmini_credits,
              shared_mock_credits: c.shared_mock_credits
            }
          }));
        } else {
          console.log(`📭 [SUPABASE] No contacts found matching: ${trimmedQuery}`);
        }
      }
    } catch (supabaseError) {
      console.error(`⚠️ [SUPABASE ERROR] Search failed:`, supabaseError.message);
      // Don't throw - just return empty results
    }

    // Step 4: Transform the results
    const transformedContacts = allContacts.map(contact => ({
      id: contact.id,
      firstname: contact.properties.firstname || '',
      lastname: contact.properties.lastname || '',
      email: contact.properties.email || '',
      student_id: contact.properties.student_id || '',
      ndecc_exam_date: contact.properties.ndecc_exam_date || '',
      // Include token properties
      tokens: {
        mock_discussion: parseInt(contact.properties.mock_discussion_token, 10) || 0,
        clinical_skills: parseInt(contact.properties.cs_credits, 10) || 0,
        situational_judgment: parseInt(contact.properties.sj_credits, 10) || 0,
        mini_mock: parseInt(contact.properties.sjmini_credits, 10) || 0,
        shared_mock: parseInt(contact.properties.shared_mock_credits, 10) || 0
      }
    }));

    // Build response
    const response = {
      success: true,
      data: {
        contacts: transformedContacts
      },
      meta: {
        timestamp: new Date().toISOString(),
        cached: false,
        data_source: dataSource, // 'supabase' or 'hubspot'
        total_results: transformedContacts.length
      }
    };

    // Cache the response for 2 minutes (120 seconds) - shorter TTL for search results
    // Searches are less frequent and data changes more often with credits
    await cacheService.set(cacheKey, response, 120);
    console.log(`💾 [Cached] ${transformedContacts.length} trainees for search "${trimmedQuery}" (2 min TTL, source: ${dataSource})`);

    res.status(200).json(response);

  } catch (error) {
    // Check for authentication errors
    if (error.message && (error.message.includes('Authentication') || error.message.includes('Unauthorized'))) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: error.message || 'Authentication required'
        }
      });
    }

    // Check for validation errors
    if (error.details) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message
        }
      });
    }

    console.error('Error searching for trainees:', error);

    // Generic server error
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to search for trainees',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }
    });
  }
};