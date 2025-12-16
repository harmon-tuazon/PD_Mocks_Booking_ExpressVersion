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
    console.log(`🔍 [SEARCH TYPE] ${isEmail ? 'Email detected' : 'Student ID'}`);

    // Step 1: Try Supabase first (read-optimized layer)
    let supabaseContact = null;
    let supabaseFound = false;

    try {
      if (isEmail) {
        console.log(`🗄️ [SUPABASE] Searching by email: ${trimmedQuery}`);
        supabaseContact = await getContactByEmailFromSupabase(trimmedQuery);
      } else {
        console.log(`🗄️ [SUPABASE] Searching by student_id: ${trimmedQuery}`);
        supabaseContact = await getContactByStudentIdFromSupabase(trimmedQuery);
      }

      if (supabaseContact) {
        console.log(`✅ [SUPABASE HIT] Found contact in Supabase: ${supabaseContact.hubspot_id}`);
        supabaseFound = true;
      } else {
        console.log(`📭 [SUPABASE MISS] Contact not found in Supabase, falling back to HubSpot`);
      }
    } catch (supabaseError) {
      console.error(`⚠️ [SUPABASE ERROR] Failed to query Supabase, falling back to HubSpot:`, supabaseError.message);
    }

    // Step 2: If found in Supabase, use that data
    let allContacts = [];
    let dataSource = 'unknown';

    if (supabaseFound && supabaseContact) {
      // Transform Supabase contact to match expected format
      allContacts = [{
        id: supabaseContact.hubspot_id,
        properties: {
          firstname: supabaseContact.firstname,
          lastname: supabaseContact.lastname,
          email: supabaseContact.email,
          student_id: supabaseContact.student_id,
          ndecc_exam_date: supabaseContact.ndecc_exam_date,
          mock_discussion_token: supabaseContact.mock_discussion_token,
          cs_credits: supabaseContact.cs_credits,
          sj_credits: supabaseContact.sj_credits,
          sjmini_credits: supabaseContact.sjmini_credits,
          shared_mock_credits: supabaseContact.shared_mock_credits
        }
      }];
      dataSource = 'supabase';
      console.log(`✅ [DATA SOURCE] Using Supabase data (~50ms)`);
    } else {
      // Step 3: Fallback to HubSpot if not in Supabase
      try {
        if (isEmail) {
          console.log(`📧 [HUBSPOT] Searching by email: ${trimmedQuery}`);

          const emailFilter = {
            filters: [
              {
                propertyName: 'email',
                operator: 'EQ',
                value: trimmedQuery
              }
            ]
          };

          // Search with exact email match
          const emailResponse = await hubspot.apiCall('POST',
            `/crm/v3/objects/${HUBSPOT_OBJECTS.contacts}/search`,
            {
              filterGroups: [emailFilter],
              properties: [
                'firstname', 'lastname', 'email', 'student_id', 'ndecc_exam_date',
                // Token properties
                'mock_discussion_token', 'cs_credits', 'sj_credits', 'sjmini_credits', 'shared_mock_credits'
              ],
              limit: 10
            }
          );

          if (emailResponse.results && emailResponse.results.length > 0) {
            console.log(`✅ [HUBSPOT] Found ${emailResponse.results.length} contact(s) by email`);
            allContacts = emailResponse.results;
            dataSource = 'hubspot';

            // Auto-populate Supabase with HubSpot data (fire-and-forget)
            if (allContacts.length > 0) {
              syncContactToSupabase(allContacts[0]).catch(err => {
                console.error(`⚠️ [SUPABASE SYNC] Failed to auto-populate (non-blocking):`, err.message);
              });
            }
          } else {
            console.log(`❌ [HUBSPOT] No contacts found by email`);
          }
        } else {
          // Search by student_id
          console.log(`🔢 [HUBSPOT] Searching by student_id: ${trimmedQuery}`);

          const studentIdFilter = {
            filters: [
              {
                propertyName: 'student_id',
                operator: 'EQ',
                value: trimmedQuery
              }
            ]
          };

          const studentIdResponse = await hubspot.apiCall('POST',
            `/crm/v3/objects/${HUBSPOT_OBJECTS.contacts}/search`,
            {
              filterGroups: [studentIdFilter],
              properties: [
                'firstname', 'lastname', 'email', 'student_id', 'ndecc_exam_date',
                // Token properties
                'mock_discussion_token', 'cs_credits', 'sj_credits', 'sjmini_credits', 'shared_mock_credits'
              ],
              limit: 10
            }
          );

          if (studentIdResponse.results && studentIdResponse.results.length > 0) {
            console.log(`✅ [HUBSPOT] Found ${studentIdResponse.results.length} contact(s) by student_id`);
            allContacts = studentIdResponse.results;
            dataSource = 'hubspot';

            // Auto-populate Supabase with HubSpot data (fire-and-forget)
            if (allContacts.length > 0) {
              syncContactToSupabase(allContacts[0]).catch(err => {
                console.error(`⚠️ [SUPABASE SYNC] Failed to auto-populate (non-blocking):`, err.message);
              });
            }
          } else {
            console.log(`❌ [HUBSPOT] No contacts found by student_id`);
          }
        }
      } catch (hubspotError) {
        console.error('❌ [HUBSPOT] API error:', hubspotError);
        throw hubspotError; // Re-throw to be handled by outer catch
      }
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