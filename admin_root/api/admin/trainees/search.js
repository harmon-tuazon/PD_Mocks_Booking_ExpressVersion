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

const { requireAdmin } = require('../middleware/requireAdmin');
const { validationMiddleware } = require('../../_shared/validation');
const { getCache } = require('../../_shared/cache');
const hubspot = require('../../_shared/hubspot');

// HubSpot Object Type IDs
const HUBSPOT_OBJECTS = {
  'contacts': '0-1'
};

module.exports = async (req, res) => {
  try {
    // Verify admin authentication
    const user = await requireAdmin(req);

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

    // Search HubSpot contacts
    let allContacts = [];

    try {
      // First, try exact match on student_id
      const exactMatchFilter = {
        filters: [
          {
            propertyName: 'student_id',
            operator: 'EQ',
            value: trimmedQuery
          }
        ]
      };

      const exactMatchResponse = await hubspot.apiCall('POST',
        `/crm/v3/objects/${HUBSPOT_OBJECTS.contacts}/search`,
        {
          filterGroups: [exactMatchFilter],
          properties: ['firstname', 'lastname', 'email', 'phone', 'student_id', 'ndecc_exam_date'],
          limit: 10
        }
      );

      if (exactMatchResponse.results && exactMatchResponse.results.length > 0) {
        console.log(`✅ [FOUND] ${exactMatchResponse.results.length} contact(s) by student_id`);
        allContacts = exactMatchResponse.results;
      } else {
        console.log(`⚠️ [NOT FOUND] No contacts found by student_id, trying email...`);

        // If no exact match on student_id, try exact match on email
        const emailFilter = {
          filters: [
            {
              propertyName: 'email',
              operator: 'EQ',
              value: trimmedQuery
            }
          ]
        };

        // Search with exact email match only
        const searchResponse = await hubspot.apiCall('POST',
          `/crm/v3/objects/${HUBSPOT_OBJECTS.contacts}/search`,
          {
            filterGroups: [emailFilter],
            properties: ['firstname', 'lastname', 'email', 'phone', 'student_id', 'ndecc_exam_date'],
            limit: 10
          }
        );

        if (searchResponse.results && searchResponse.results.length > 0) {
          console.log(`✅ [FOUND] ${searchResponse.results.length} contact(s) by email`);
          allContacts = searchResponse.results;
        } else {
          console.log(`❌ [NOT FOUND] No contacts found by email either`);
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
        ndecc_exam_date: contact.properties.ndecc_exam_date || ''
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