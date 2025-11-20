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

    console.log(`📋 [Cache MISS] Searching HubSpot for trainees: ${trimmedQuery}`);

    // Detect if query is an email (contains @)
    const isEmail = trimmedQuery.includes('@');
    console.log(`🔍 [SEARCH TYPE] ${isEmail ? 'Email detected' : 'Student ID'}`);

    // Search HubSpot contacts
    let allContacts = [];

    try {
      // If query looks like an email, skip student_id search and go directly to email
      if (isEmail) {
        console.log(`📧 [EMAIL SEARCH] Searching by email: ${trimmedQuery}`);

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
              'firstname', 'lastname', 'email', 'phone', 'student_id', 'ndecc_exam_date',
              // Token properties
              'mock_discussion_token', 'cs_credits', 'sj_credits', 'sjmini_credits', 'shared_mock_credits'
            ],
            limit: 10
          }
        );

        if (emailResponse.results && emailResponse.results.length > 0) {
          console.log(`✅ [FOUND] ${emailResponse.results.length} contact(s) by email`);
          allContacts = emailResponse.results;
        } else {
          console.log(`❌ [NOT FOUND] No contacts found by email`);
        }
      } else {
        // Search by student_id
        console.log(`🔢 [STUDENT ID SEARCH] Searching by student_id: ${trimmedQuery}`);

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
              'firstname', 'lastname', 'email', 'phone', 'student_id', 'ndecc_exam_date',
              // Token properties
              'mock_discussion_token', 'cs_credits', 'sj_credits', 'sjmini_credits', 'shared_mock_credits'
            ],
            limit: 10
          }
        );

        if (studentIdResponse.results && studentIdResponse.results.length > 0) {
          console.log(`✅ [FOUND] ${studentIdResponse.results.length} contact(s) by student_id`);
          allContacts = studentIdResponse.results;
        } else {
          console.log(`❌ [NOT FOUND] No contacts found by student_id`);
        }
      }

      // Transform the results
      const transformedContacts = allContacts.map(contact => ({
        id: contact.id,
        firstname: contact.properties.firstname || '',
        lastname: contact.properties.lastname || '',
        email: contact.properties.email || '',
        phone: contact.properties.phone || '',
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
          total_results: transformedContacts.length
        }
      };

      // Cache the response for 5 minutes (300 seconds)
      await cacheService.set(cacheKey, response, 300);
      console.log(`💾 [Cached] ${transformedContacts.length} trainees for search "${trimmedQuery}" (5 min TTL)`);

      res.status(200).json(response);

    } catch (hubspotError) {
      console.error('HubSpot API error:', hubspotError);

      // Handle specific HubSpot errors
      if (hubspotError.response?.status === 400) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Invalid search parameters',
            details: hubspotError.response?.data?.message
          }
        });
      }

      throw hubspotError;
    }

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