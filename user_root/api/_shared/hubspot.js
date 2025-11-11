const axios = require('axios');
const { HubSpotBatchService } = require('./batch');

// HubSpot Object Type IDs
const HUBSPOT_OBJECTS = {
  'contacts': '0-1',
  'deals': '0-3',
  'courses': '0-410',
  'transactions': '2-47045790',
  'payment_schedules': '2-47381547',
  'credit_notes': '2-41609496',
  'campus_venues': '2-41607847',
  'enrollments': '2-41701559',
  'lab_stations': '2-41603799',
  'bookings': '2-50158943',      // PRIMARY for this feature
  'mock_exams': '2-50158913'     // PRIMARY for this feature
};

class HubSpotService {
  constructor() {
    this.token = process.env.HS_PRIVATE_APP_TOKEN;
    this.baseURL = 'https://api.hubapi.com';
    this.retryDelay = 1000;
    this.maxRetries = 3;

    if (!this.token) {
      throw new Error('HS_PRIVATE_APP_TOKEN environment variable is required');
    }

    // Initialize batch service for optimized operations
    this.batch = new HubSpotBatchService(this);
  }

  /**
   * Make API call with automatic retry on rate limit errors
   * Supports both object style and parameter style calls
   */
  async apiCall(methodOrConfig, path, data = null, attempt = 1) {
    let method, url, requestData, currentAttempt;

    // Handle object-style call (for backward compatibility)
    if (typeof methodOrConfig === 'object' && methodOrConfig !== null) {
      const config = methodOrConfig;
      method = config.method;
      url = config.url;
      requestData = config.data || null;
      currentAttempt = config.attempt || 1;

      // Handle params for GET requests
      if (config.params && method === 'GET') {
        const queryString = new URLSearchParams(config.params).toString();
        url = `${url}${queryString ? '?' + queryString : ''}`;
      }
    } else {
      // Handle traditional parameter-style call
      method = methodOrConfig;
      url = `${this.baseURL}${path}`;
      requestData = data;
      currentAttempt = attempt;
    }

    // Ensure URL has base URL if not already present
    if (!url.startsWith('http')) {
      url = `${this.baseURL}${url}`;
    }

    try {
      const response = await axios({
        method,
        url,
        data: requestData,
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } catch (error) {
      // Handle rate limiting with exponential backoff
      if (error.response?.status === 429 && currentAttempt < this.maxRetries) {
        const delay = this.retryDelay * Math.pow(2, currentAttempt - 1);
        console.log(`Rate limited, retrying after ${delay}ms (attempt ${currentAttempt + 1}/${this.maxRetries})`);
        await new Promise(r => setTimeout(r, delay));

        // Retry with incremented attempt
        if (typeof methodOrConfig === 'object') {
          return this.apiCall({ ...methodOrConfig, attempt: currentAttempt + 1 });
        } else {
          return this.apiCall(method, path, requestData, currentAttempt + 1);
        }
      }

      // Handle other errors
      const errorMessage = error.response?.data?.message || error.message;
      const statusCode = error.response?.status || 500;

      console.error('HubSpot API Error Details:', {
        status: statusCode,
        message: errorMessage,
        fullResponse: error.response?.data,
        url: error.config?.url,
        method: error.config?.method
      });

      const customError = new Error(errorMessage);
      customError.status = statusCode;
      throw customError;
    }
  }

  /**
   * Search for contacts by student_id and email
   */
  async searchContacts(studentId, email, mockType = null) {
    // Build properties list based on mock type
    const baseProperties = [
      'student_id',
      'firstname',
      'lastname',
      'email',
      'hs_object_id',
      'ndecc_exam_date'
    ];
    
    let creditProperties = [];
    if (mockType) {
      switch (mockType) {
        case 'Mock Discussion':
          creditProperties = ['mock_discussion_token'];
          break;
        case 'Situational Judgment':
          creditProperties = ['sj_credits', 'shared_mock_credits'];
          break;
        case 'Clinical Skills':
          creditProperties = ['cs_credits', 'shared_mock_credits'];
          break;
        case 'Mini-mock':
          creditProperties = ['sjmini_credits'];
          break;
        default:
          // If unknown type, fetch all credit properties as fallback
          creditProperties = ['sj_credits', 'cs_credits', 'sjmini_credits', 'mock_discussion_token', 'shared_mock_credits'];
      }
    } else {
      // If no type specified, fetch all credit properties (for backward compatibility)
      creditProperties = ['sj_credits', 'cs_credits', 'sjmini_credits', 'mock_discussion_token', 'shared_mock_credits'];
    }
    
    const searchPayload = {
      filterGroups: [{
        filters: [
          {
            propertyName: 'student_id',
            operator: 'EQ',
            value: studentId
          },
          {
            propertyName: 'email',
            operator: 'EQ',
            value: email
          }
        ]
      }],
      properties: [...baseProperties, ...creditProperties],
      limit: 1
    };

    const result = await this.apiCall('POST', `/crm/v3/objects/${HUBSPOT_OBJECTS.contacts}/search`, searchPayload);
    return result.results?.[0] || null;
  }

  /**
   * Search for available mock exams
   */
  async searchMockExams(mockType, isActive = true) {
    const searchPayload = {
      filterGroups: [{
        filters: [
          {
            propertyName: 'is_active',
            operator: 'EQ',
            value: isActive.toString()
          },
          {
            propertyName: 'mock_type',
            operator: 'EQ',
            value: mockType
          }
        ]
      }],
      properties: [
        'exam_date',
        'start_time',
        'end_time',
        'capacity',
        'total_bookings',
        'mock_type',
        'location',
        'is_active',
        'hs_object_id'
      ],
      sorts: [{
        propertyName: 'exam_date',
        direction: 'ASCENDING'
      }],
      limit: 20
    };

    return await this.apiCall('POST', `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/search`, searchPayload);
  }

  /**
   * Check if an ACTIVE booking already exists with the same booking_id
   * Only returns true if there's an active booking (is_active = 'Active')
   * Cancelled bookings (is_active = 'Cancelled') are ignored
   * This allows users to rebook for the same exam date after cancelling
   */
  async checkExistingBooking(bookingId) {
    const searchPayload = {
      filterGroups: [{
        filters: [{
          propertyName: 'booking_id',
          operator: 'EQ',
          value: bookingId
        }]
      }],
      properties: ['booking_id', 'is_active', 'hs_object_id'],
      limit: 10  // Get more results in case there are multiple bookings
    };

    const result = await this.apiCall('POST', `/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}/search`, searchPayload);

    // Filter for only active bookings
    const activeBookings = result.results?.filter(booking => {
      const isActive = booking.properties?.is_active;
      // Only consider booking as duplicate if it's explicitly 'Active'
      return isActive === 'Active';
    }) || [];

    // Only return true if there's at least one active booking
    return activeBookings.length > 0;
  }

  /**
   * Find a booking by idempotency key
   * @param {string} idempotencyKey - The idempotency key to search for
   * @returns {Promise<object|null>} - Existing booking object or null if not found
   */
  async findBookingByIdempotencyKey(idempotencyKey) {
    try {
      const searchPayload = {
        filterGroups: [{
          filters: [{
            propertyName: 'idempotency_key',
            operator: 'EQ',
            value: idempotencyKey
          }]
        }],
        properties: [
          'booking_id',
          'idempotency_key',
          'is_active',
          'name',
          'email',
          'token_used',
          'hs_createdate',
          'hs_object_id'
        ],
        sorts: [{
          propertyName: 'hs_createdate',
          direction: 'DESCENDING'  // Most recent first
        }],
        limit: 1  // Only need the most recent match
      };

      const result = await this.apiCall('POST', `/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}/search`, searchPayload);

      if (result.results && result.results.length > 0) {
        const booking = result.results[0];
        console.log(`✅ Found existing booking with idempotency key ${idempotencyKey}:`, {
          booking_id: booking.properties.booking_id,
          hs_object_id: booking.id,
          is_active: booking.properties.is_active,
          created_date: booking.properties.hs_createdate
        });
        return booking;
      } else {
        return null;
      }
    } catch (error) {
      console.error(`❌ Error searching for booking by idempotency key:`, {
        idempotencyKey,
        error: error.message,
        status: error.status
      });

      // Don't throw the error, return null to allow new booking creation
      // This ensures the system remains available even if search fails
      return null;
    }
  }

  /**
   * Map frontend location values to HubSpot expected values
   */
  mapLocationToHubSpot(location) {
    // Ensure we handle the input safely
    if (!location) {
      console.warn(`⚠️ No location value provided`);
      return null;
    }

    // Convert to lowercase for consistent matching
    const normalizedLocation = location.toLowerCase();

    const locationMapping = {
      'mississauga': 'Mississauga',
      'calgary': 'Calgary',
      'vancouver': 'Vancouver',
      'montreal': 'Montreal',
      'richmond_hill': 'Richmond Hill',
      'online': 'Online'  // Add support for Online option (used by HubSpot)
    };

    const mappedLocation = locationMapping[normalizedLocation];

    if (!mappedLocation) {
      console.warn(`⚠️ Unknown location value: ${location}, using original value`);
      return location;
    }

    return mappedLocation;
  }

  /**
   * Create a new booking
   */
  async createBooking(bookingData) {
    const properties = {
      booking_id: bookingData.bookingId,
      name: bookingData.name,
      email: bookingData.email,
      is_active: 'Active',  // Set booking as active when created
      ...(bookingData.tokenUsed ? { token_used: bookingData.tokenUsed } : {})
    };

    // Add idempotency key if provided
    if (bookingData.idempotencyKey) {
      properties.idempotency_key = bookingData.idempotencyKey;
    }

    // FIX: Removed calculated properties (mock_type, exam_date, location, start_time, end_time)
    // These are now calculated/rollup properties in HubSpot from the associated Mock Exam
    // Setting them directly causes "READ_ONLY_VALUE" errors

    // Add conditional fields based on what's provided
    if (bookingData.dominantHand !== undefined) {
      properties.dominant_hand = bookingData.dominantHand.toString();
    }

    if (bookingData.attendingLocation) {
      // Transform the location value to match HubSpot's expected format
      const originalLocation = bookingData.attendingLocation;
      const mappedLocation = this.mapLocationToHubSpot(originalLocation);
      properties.attending_location = mappedLocation;
    }

    const payload = { properties };

    return await this.apiCall('POST', `/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}`, payload);
  }

  /**
   * Update contact credits
   */
  async updateContactCredits(contactId, creditType, newValue) {
    const payload = {
      properties: {
        [creditType]: newValue.toString()
      }
    };

    return await this.apiCall('PATCH', `/crm/v3/objects/${HUBSPOT_OBJECTS.contacts}/${contactId}`, payload);
  }

  /**
   * Update mock exam total bookings
   */
  async updateMockExamBookings(mockExamId, newTotal) {
    const payload = {
      properties: {
        total_bookings: newTotal.toString()
      }
    };

    return await this.apiCall('PATCH', `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/${mockExamId}`, payload);
  }


  /**
   * Get default association type ID for standard object relationships
   */
  getDefaultAssociationTypeId(fromObjectType, toObjectType) {
    // Specific association type IDs from HubSpot for this instance
    const defaultTypes = {
      // Bookings to other objects (using HUBSPOT_DEFINED IDs from the improvement request)
      [`${HUBSPOT_OBJECTS.bookings}_${HUBSPOT_OBJECTS.contacts}`]: 1289,    // Bookings → Contacts
      [`${HUBSPOT_OBJECTS.bookings}_${HUBSPOT_OBJECTS.mock_exams}`]: 1291,  // Bookings → Mock Exams

      // Reverse relationships (same IDs work bidirectionally)
      [`${HUBSPOT_OBJECTS.contacts}_${HUBSPOT_OBJECTS.bookings}`]: 1289,
      [`${HUBSPOT_OBJECTS.mock_exams}_${HUBSPOT_OBJECTS.bookings}`]: 1291,
    };

    const key = `${fromObjectType}_${toObjectType}`;
    const typeId = defaultTypes[key];

    if (typeId) {
      console.log(`✅ Using association type ID ${typeId} for ${fromObjectType} → ${toObjectType}`);
      return typeId;
    }

    console.log(`⚠️ No specific association type found for ${fromObjectType} → ${toObjectType}, using default: 1`);
    return 1;
  }

  /**
   * Create association between objects
   */
  async createAssociation(fromObjectType, fromObjectId, toObjectType, toObjectId) {
    const path = `/crm/v4/objects/${fromObjectType}/${fromObjectId}/associations/${toObjectType}/${toObjectId}`;

    // IMPORTANT: After thorough testing, we've determined:
    // - Type 1292 ("Mock Bookings") creates associations BUT breaks retrieval
    // - Type 1277 (unlabeled/default) works for both creation AND retrieval
    // - Using empty payload defaults to Type 1277 which works correctly

    // For ALL associations, use empty payload to let HubSpot use the default Type 1277
    const payload = [];

    // Log specific details for Booking ↔ Mock Exam associations
    const isBookingToMockExam = (
      (fromObjectType === HUBSPOT_OBJECTS.bookings && toObjectType === HUBSPOT_OBJECTS.mock_exams) ||
      (fromObjectType === HUBSPOT_OBJECTS.mock_exams && toObjectType === HUBSPOT_OBJECTS.bookings)
    );

    try {
      const result = await this.apiCall('PUT', path, payload);
      console.log(`✅ Association created successfully:`, result);
      return result;
    } catch (error) {
      console.error(`❌ Failed to create association:`, {
        from: `${fromObjectType}(${fromObjectId})`,
        to: `${toObjectType}(${toObjectId})`,
        error: error.message,
        status: error.response?.status,
        details: error.response?.data
      });
      throw error;
    }
  }

  /**
   * Remove association between two objects
   * @param {string} fromObjectType - Source object type (e.g., 'bookings')
   * @param {string} fromObjectId - Source object ID
   * @param {string} toObjectType - Target object type (e.g., 'mock_exams')
   * @param {string} toObjectId - Target object ID
   */
  async removeAssociation(fromObjectType, fromObjectId, toObjectType, toObjectId) {
    const path = `/crm/v4/objects/${fromObjectType}/${fromObjectId}/associations/${toObjectType}/${toObjectId}`;

    try {
      const result = await this.apiCall('DELETE', path);
      console.log(`✅ Association removed successfully between ${fromObjectType}(${fromObjectId}) and ${toObjectType}(${toObjectId})`);
      return result;
    } catch (error) {
      console.error(`❌ Failed to remove association:`, error);
      throw error;
    }
  }


  /**
   * Search enrollments for a contact
   */
  async searchEnrollments(contactId, status = 'Registered') {
    const searchPayload = {
      filterGroups: [{
        filters: [
          {
            propertyName: 'contact_record_id',
            operator: 'EQ',
            value: contactId
          },
          {
            propertyName: 'enrollment_status',
            operator: 'EQ',
            value: status
          }
        ]
      }],
      properties: [
        'enrollment_id',
        'course_id',
        'enrollment_status',
        'hs_object_id'
      ],
      limit: 10
    };

    const result = await this.apiCall('POST', `/crm/v3/objects/${HUBSPOT_OBJECTS.enrollments}/search`, searchPayload);
    return result.results?.[0] || null;
  }

  /**
   * Get a single mock exam by ID
   */
  async getMockExam(mockExamId) {
    const properties = [
      'exam_date',
      'start_time',
      'end_time',
      'capacity',
      'total_bookings',
      'mock_type',
      'location',
      'is_active'
    ].join(',');

    return await this.apiCall('GET', `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/${mockExamId}?properties=${properties}`);
  }

  /**
   * Get basic booking information without associations (simplified)
   * @param {string} bookingId - The booking ID
   * @returns {Promise<object>} Basic booking object
   */
  async getBasicBooking(bookingId) {
    const properties = [
      'booking_id',
      'status',
      'is_active',
      'name',
      'email'
    ].join(',');

    const result = await this.apiCall('GET', `/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}/${bookingId}?properties=${properties}`);
    return result.data || result;
  }

  /**
   * Get active bookings count for a mock exam by querying actual associations
   * This ensures we only count non-deleted bookings
   */
  async getActiveBookingsCount(mockExamId) {
    try {
      // Get mock exam with associations to get all booking IDs
      const mockExamResponse = await this.apiCall('GET',
        `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/${mockExamId}?associations=${HUBSPOT_OBJECTS.bookings}`
      );

      // Extract booking IDs from associations (using flexible key matching)
      const bookingIds = [];
      const bookingsKey = this.findAssociationKey(mockExamResponse.associations, HUBSPOT_OBJECTS.bookings, 'bookings');

      if (bookingsKey && mockExamResponse.associations[bookingsKey]?.results?.length > 0) {
        mockExamResponse.associations[bookingsKey].results.forEach(association => {
          bookingIds.push(association.id);
        });
      }

      // If no bookings, return 0
      if (bookingIds.length === 0) {
        return 0;
      }

      // Batch fetch booking details to check is_active status (HubSpot batch read supports up to 100 objects)
      let activeCount = 0;
      const batchChunks = [];
      for (let i = 0; i < bookingIds.length; i += 100) {
        batchChunks.push(bookingIds.slice(i, i + 100));
      }

      for (const chunk of batchChunks) {
        try {
          const batchResponse = await this.apiCall('POST', `/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}/batch/read`, {
            properties: ['is_active'],
            inputs: chunk.map(id => ({ id }))
          });

          if (batchResponse.results) {
            // Count active bookings (Active or Completed status)
            // This preserves capacity count for past sessions while excluding cancelled bookings
            batchResponse.results.forEach(booking => {
              const status = booking.properties.is_active;
              if (status === 'Active' || status === 'active' || 
                  status === 'Completed' || status === 'completed') {
                activeCount++;
              }
            });
          }
        } catch (batchError) {
          console.error(`Error fetching booking batch for count:`, batchError);
        }
      }

      return activeCount;
    } catch (error) {
      console.error('Error getting active bookings count:', error);
      throw error;
    }
  }

  /**
   * Recalculate and update the total_bookings property for a mock exam
   * This should be called when bookings are deleted or to sync the count
   */
  async recalculateMockExamBookings(mockExamId) {
    try {
      const activeCount = await this.getActiveBookingsCount(mockExamId);

      // Update the mock exam's total_bookings property
      await this.updateMockExamBookings(mockExamId, activeCount);

      console.log(`✅ Updated mock exam ${mockExamId} total_bookings to ${activeCount}`);
      return activeCount;
    } catch (error) {
      console.error(`Error recalculating bookings for mock exam ${mockExamId}:`, error);
      throw error;
    }
  }

  /**
   * Update booking properties (for soft delete and other updates)
   */
  async updateBooking(bookingId, properties) {
    const payload = {
      properties: properties
    };

    return await this.apiCall('PATCH', `/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}/${bookingId}`, payload);
  }

  /**
   * Soft delete a booking by setting is_active to 'Cancelled'
   */
  async softDeleteBooking(bookingId) {
    return await this.updateBooking(bookingId, {
      is_active: 'Cancelled'
    });
  }

  /**
   * Delete a booking
   */
  /**
   * Get bookings for a contact with associated mock exam details
   * @param {string} contactId - The HubSpot contact ID
   * @param {string} filter - Filter type: 'all', 'upcoming', 'past'
   * @param {number} page - Page number for pagination
   * @param {number} limit - Number of results per page
   * @returns {Object} - Bookings with pagination info
   */
  /**
   * Map booking status based on is_active property and exam date
   * @param {Object} booking - The booking object
   * @param {Object} mockExamData - The mock exam data
   * @param {string} timeStatus - 'upcoming' or 'past' based on date comparison
   * @returns {string} - Final status: 'scheduled', 'completed', or 'cancelled'
   */
  mapBookingStatus(booking, mockExamData, timeStatus) {
    // First check is_active property for cancelled bookings
    const isActive = booking.properties?.is_active || mockExamData?.is_active;

    if (isActive === 'Cancelled' || isActive === 'cancelled' || isActive === false || isActive === 'false') {
      return 'cancelled';
    }

    if (isActive === 'Completed' || isActive === 'completed') {
      return 'completed';
    }

    // If booking is active, determine status based on time
    if (timeStatus === 'upcoming') {
      return 'scheduled';
    } else if (timeStatus === 'past') {
      return 'completed';
    }

    // Default to scheduled for active bookings
    return 'scheduled';
  }

  /**
   * Get contact's booking associations using HubSpot associations API
   * @param {string} contactId - The HubSpot contact ID
   * @returns {Promise<Array>} - Array of booking object IDs associated with the contact
   */
  async getContactBookingAssociations(contactId) {
    try {
      // Use HubSpot Associations API to get all bookings associated with this contact
      const apiUrl = `/crm/v4/objects/${HUBSPOT_OBJECTS.contacts}/${contactId}/associations/${HUBSPOT_OBJECTS.bookings}?limit=100`;

      const associations = await this.apiCall(
        'GET',
        apiUrl
      );

      if (!associations?.results || associations.results.length === 0) {
        console.log(`⚠️ No booking associations found for contact ${contactId}`);
        return [];
      }

      // Extract booking IDs from associations
      const bookingIds = associations.results.map(assoc => assoc.toObjectId);
      console.log(`✅ Found ${bookingIds.length} booking associations for contact ${contactId}:`, bookingIds);

      return bookingIds;

    } catch (error) {
      console.error(`❌ Error getting booking associations for contact ${contactId}:`, {
        message: error.message,
        status: error.status,
        response: error.response,
        stack: error.stack
      });
      
      // Handle specific association API errors
      if (error.response?.status === 404) {
        console.log(`Contact ${contactId} not found or has no booking associations`);
        return [];
      }
      
      throw error;
    }
  }

  /**
   * Get paginated booking associations for a contact with HubSpot after-token support
   * 
   * @param {string} contactId - Contact ID
   * @param {Object} options - Pagination options
   * @param {number} options.limit - Max associations to fetch (default: 100, max: 500)
   * @param {string} options.after - HubSpot after token for pagination
   * @returns {Promise<{bookingIds: string[], paging: Object}>} - Booking IDs and paging info
   */
  async getContactBookingAssociationsPaginated(contactId, { limit = 100, after = null } = {}) {
    try {
      // Ensure limit doesn't exceed HubSpot max
      const fetchLimit = Math.min(limit, 500);
      
      let url = `/crm/v4/objects/${HUBSPOT_OBJECTS.contacts}/${contactId}/associations/${HUBSPOT_OBJECTS.bookings}?limit=${fetchLimit}`;
      
      if (after) {
        url += `&after=${after}`;
      }

      const associations = await this.apiCall('GET', url);

      if (!associations?.results || associations.results.length === 0) {
        console.log(`No booking associations found for contact ${contactId}`);
        return {
          bookingIds: [],
          paging: null
        };
      }

      // Extract booking IDs from associations
      const bookingIds = associations.results.map(assoc => assoc.toObjectId);

      console.log(`✅ Found ${bookingIds.length} booking associations for contact ${contactId}`);

      return {
        bookingIds,
        paging: associations.paging || null
      };

    } catch (error) {
      console.error(`❌ Error getting paginated booking associations for contact ${contactId}:`, error);
      
      if (error.response?.status === 404) {
        console.log(`Contact ${contactId} not found or has no booking associations`);
        return { bookingIds: [], paging: null };
      }
      
      throw error;
    }
  }

  /**
   * Get bookings for a contact with associated mock exam details - OPTIMIZED VERSION
   * @param {string} contactId - The HubSpot contact ID
   * @param {Object} options - Query options
   * @param {string} options.filter - Filter type: 'all', 'upcoming', 'past'
   * @param {number} options.page - Page number for pagination
   * @param {number} options.limit - Number of results per page
   * @returns {Object} - Bookings with pagination info
   */
  async getBookingsForContact(contactId, { filter = 'all', page = 1, limit = 10 } = {}) {
    try {
      // Step 1: Get all booking IDs associated with this contact using the dedicated method
      const bookingIds = await this.getContactBookingAssociations(contactId);

      if (bookingIds.length === 0) {
        return {
          bookings: [],
          total: 0,
          pagination: {
            current_page: page,
            total_pages: 0,
            total_bookings: 0,
            has_next: false,
            has_previous: false
          }
        };
      }

      // Step 2: Batch retrieve booking objects with CORRECTED properties
      // Fetch mock exam details directly if they're stored on booking, otherwise we'll need associations
      const bookingProperties = [
        'booking_id',
        'mock_type',      // Fetch directly from booking if available
        'location',       // Fetch directly from booking if available
        'start_time',     // Fetch directly from booking if available
        'end_time',       // Fetch directly from booking if available
        'exam_date',      // Fetch directly from booking if available
        'is_active',      // Fetch directly from booking if available
        'associated_mock_exam',  // HubSpot object ID of the associated mock exam (for prerequisite validation)
        'attendance',     // Required for prerequisite validation (Yes/No/null)
        'name',
        'email',
        'dominant_hand',
        'hs_createdate',
        'hs_object_id'
      ];

      const batchReadPayload = {
        inputs: bookingIds.map(id => ({ id })),
        properties: bookingProperties
      };

      const bookingsResponse = await this.apiCall(
        'POST',
        `/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}/batch/read`,
        batchReadPayload
      );

      if (!bookingsResponse?.results || bookingsResponse.results.length === 0) {
        console.log(`No active booking objects found for contact ${contactId}`);
        return {
          bookings: [],
          total: 0,
          pagination: {
            current_page: page,
            total_pages: 0,
            total_bookings: 0,
            has_next: false,
            has_previous: false
          }
        };
      }

      // Step 3: Process bookings - check if we have mock exam data directly on bookings
      const bookingsWithExams = [];
      const now = new Date();
      const nowISOString = now.toISOString();
      const nowTimestamp = now.getTime();

      // Collect booking IDs that need mock exam association fetching
      const bookingsNeedingMockExamData = [];
      const processedBookings = [];

      for (const booking of bookingsResponse.results) {
        // Check if booking already has mock exam properties
        if (booking.properties.mock_type && booking.properties.exam_date) {
          // We have the data directly on the booking - no need for additional queries!
          const examDateRaw = booking.properties.exam_date;
          let examDate;
          let isValidDate = false;

          // Try multiple date parsing approaches to handle different formats
          try {
            // First try direct parsing
            examDate = new Date(examDateRaw);

            // Check if the parsed date is valid
            if (!isNaN(examDate.getTime())) {
              isValidDate = true;
            } else {
              // Try parsing as timestamp if it's a number
              if (!isNaN(Number(examDateRaw))) {
                examDate = new Date(Number(examDateRaw));
                isValidDate = !isNaN(examDate.getTime());
              }
            }

            // If still invalid, try parsing as ISO string with timezone handling
            if (!isValidDate && typeof examDateRaw === 'string') {
              // Handle potential timezone issues
              examDate = new Date(examDateRaw.replace(' ', 'T'));
              isValidDate = !isNaN(examDate.getTime());
            }
          } catch (dateError) {
            console.error(`❌ [DATE ERROR] Failed to parse exam_date for booking ${booking.id}:`, {
              raw_date: examDateRaw,
              error: dateError.message
            });
            isValidDate = false;
          }

          if (!isValidDate) {
            console.error(`❌ [DATE ERROR] Invalid exam_date for booking ${booking.id}, excluding from results:`, {
              raw_date: examDateRaw,
              type: typeof examDateRaw
            });
            // Skip this booking if we can't parse the date
            continue;
          }

          const examDateTimestamp = examDate.getTime();
          const isUpcoming = examDateTimestamp >= nowTimestamp;
          const status = isUpcoming ? 'upcoming' : 'past';

          // FIX: Improve is_active handling to be more robust
          const isActive = booking.properties.is_active;
          
          // Check if booking is cancelled (handle various formats)
          const isCancelled = isActive === 'Cancelled' || 
                            isActive === 'cancelled' || 
                            isActive === false || 
                            isActive === 'false' ||
                            isActive === 'False' ||
                            isActive === '0';
          
          // FIX: Handle various active states properly
          const isActiveBooking = !isCancelled && (
            isActive === true || 
            isActive === 'true' || 
            isActive === 'True' ||
            isActive === '1' ||
            isActive === 'Active' ||
            isActive === 'active' ||
            isActive === 'Scheduled' ||
            isActive === 'scheduled' ||
            isActive === undefined ||  // FIX: Treat undefined as active
            isActive === null ||        // FIX: Treat null as active
            isActive === ''             // FIX: Treat empty string as active
          );
          
          let shouldInclude = false;
          if (filter === 'all') {
            shouldInclude = true;  // All filter shows everything
          } else if (filter === 'cancelled') {
            shouldInclude = isCancelled;  // Cancelled filter shows only cancelled
          } else if (filter === 'upcoming' || filter === 'past') {
            // FIX: Use isActiveBooking instead of !isCancelled for better handling
            shouldInclude = (filter === status) && isActiveBooking;
          }

          if (shouldInclude) {
            const mockExamData = {
              mock_type: booking.properties.mock_type,
              exam_date: booking.properties.exam_date,
              location: booking.properties.location || 'Mississauga',
              start_time: booking.properties.start_time,
              end_time: booking.properties.end_time,
              is_active: booking.properties.is_active
            };
            processedBookings.push({
              booking,
              mockExamData,
              status,
              finalStatus: this.mapBookingStatus(booking, mockExamData, status)
            });
          }
        } else {
          // We need to fetch mock exam data via associations
          bookingsNeedingMockExamData.push(booking);
        }
      }

      // Step 4: If any bookings need mock exam data, batch fetch the associations
      if (bookingsNeedingMockExamData.length > 0) {
        // Batch get all mock exam associations
        const mockExamIds = new Set();
        const bookingToMockExamMap = new Map();

        try {
          // Batch read all associations in 1-2 API calls instead of N calls
          const bookingIds = bookingsNeedingMockExamData.map(b => b.id);
          const associations = await this.batch.batchReadAssociations(
            HUBSPOT_OBJECTS.bookings,
            bookingIds,
            HUBSPOT_OBJECTS.mock_exams
          );

          // Build maps from association results
          for (const assoc of associations) {
            if (assoc.to && assoc.to.length > 0) {
              const mockExamId = assoc.to[0].toObjectId;
              mockExamIds.add(mockExamId);
              bookingToMockExamMap.set(assoc.from.id, mockExamId);
            } else {
              const bookingId = assoc.from?.id;
              if (bookingId) {
                console.warn(`⚠️ No mock exam association found for booking ${bookingId}`);
              }
            }
          }

          console.log(`✅ Found ${mockExamIds.size} mock exam associations`);
        } catch (error) {
          console.error(`❌ Failed to batch read associations:`, error.message);
          // Continue with empty associations rather than failing completely
        }

        // Batch fetch all unique mock exams
        if (mockExamIds.size > 0) {
          const mockExamBatchPayload = {
            inputs: Array.from(mockExamIds).map(id => ({ id })),
            properties: ['exam_date', 'start_time', 'end_time', 'capacity', 'total_bookings', 'mock_type', 'location', 'is_active']
          };

          try {
            const mockExamsResponse = await this.apiCall(
              'POST',
              `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/batch/read`,
              mockExamBatchPayload
            );

            // Create a map of mock exam data
            const mockExamDataMap = new Map();
            if (mockExamsResponse?.results) {
              for (const mockExam of mockExamsResponse.results) {
                mockExamDataMap.set(mockExam.id, mockExam);
              }
              console.log(`✅ Retrieved ${mockExamsResponse.results.length} mock exam details`);
            } else {
              console.error(`❌ No mock exam data returned from batch read`);
            }

            // Process bookings with fetched mock exam data
            for (const booking of bookingsNeedingMockExamData) {
              const mockExamId = bookingToMockExamMap.get(booking.id);
              // Convert mockExamId to string since the map keys are strings
              const mockExam = mockExamId ? mockExamDataMap.get(String(mockExamId)) : null;


            if (mockExam) {
              const examDateRaw = mockExam.properties.exam_date;
              let examDate;
              let isValidDate = false;

              // Apply the same robust date parsing as above
              try {
                examDate = new Date(examDateRaw);

                if (!isNaN(examDate.getTime())) {
                  isValidDate = true;
                } else {
                  if (!isNaN(Number(examDateRaw))) {
                    examDate = new Date(Number(examDateRaw));
                    isValidDate = !isNaN(examDate.getTime());
                  }
                }

                if (!isValidDate && typeof examDateRaw === 'string') {
                  examDate = new Date(examDateRaw.replace(' ', 'T'));
                  isValidDate = !isNaN(examDate.getTime());
                }
              } catch (dateError) {
                console.error(`❌ [DATE ERROR] Failed to parse mock exam date for booking ${booking.id}:`, {
                  raw_date: examDateRaw,
                  error: dateError.message
                });
                isValidDate = false;
              }

              if (!isValidDate) {
                console.error(`❌ [DATE ERROR] Invalid mock exam date for booking ${booking.id}, excluding:`, {
                  raw_date: examDateRaw,
                  mock_exam_id: mockExamId
                });
                continue;
              }

              const examDateTimestamp = examDate.getTime();
              const isUpcoming = examDateTimestamp >= nowTimestamp;
              const status = isUpcoming ? 'upcoming' : 'past';

              // FIX: Same improved is_active handling for association-fetched bookings
              const isActive = booking.properties.is_active || mockExam.properties.is_active;
              
              const isCancelled = isActive === 'Cancelled' || 
                                isActive === 'cancelled' || 
                                isActive === false || 
                                isActive === 'false' ||
                                isActive === 'False' ||
                                isActive === '0';
              
              const isActiveBooking = !isCancelled && (
                isActive === true || 
                isActive === 'true' || 
                isActive === 'True' ||
                isActive === '1' ||
                isActive === 'Active' ||
                isActive === 'active' ||
                isActive === 'Scheduled' ||
                isActive === 'scheduled' ||
                isActive === undefined ||
                isActive === null ||
                isActive === ''
              );
              
              let shouldInclude = false;
              if (filter === 'all') {
                shouldInclude = true;  // All filter shows everything
              } else if (filter === 'cancelled') {
                shouldInclude = isCancelled;  // Cancelled filter shows only cancelled
              } else if (filter === 'upcoming' || filter === 'past') {
                // FIX: Use isActiveBooking for better handling
                shouldInclude = (filter === status) && isActiveBooking;
              }

              if (shouldInclude) {
                const mockExamData = {
                  id: mockExamId,
                  mock_type: mockExam.properties.mock_type,
                  exam_date: mockExam.properties.exam_date,
                  location: mockExam.properties.location || 'Mississauga',
                  start_time: mockExam.properties.start_time,
                  end_time: mockExam.properties.end_time,
                  capacity: parseInt(mockExam.properties.capacity) || 0,
                  total_bookings: parseInt(mockExam.properties.total_bookings) || 0,
                  is_active: mockExam.properties.is_active
                };
                processedBookings.push({
                  booking,
                  mockExamData,
                  status,
                  finalStatus: this.mapBookingStatus(booking, mockExamData, status)
                });
              }
            } else {
              console.warn(`❌ No mock exam data found for booking ${booking.id} (${booking.properties.booking_id}), excluding from results`);
            }
          }
          } catch (batchError) {
            console.error(`❌ [BATCH ERROR] Failed to batch read mock exams:`, {
              error_message: batchError.message,
              error_status: batchError.response?.status,
              error_data: batchError.response?.data,
              mock_exam_ids: mockExamIdArray
            });
          }
        } else {
          console.warn(`⚠️ No mock exam associations found for any of the ${bookingsNeedingMockExamData.length} bookings`);
        }
      }

      // Step 5: Format all processed bookings for output
      for (const { booking, mockExamData, status, finalStatus} of processedBookings) {
        bookingsWithExams.push({
          id: booking.id,
          booking_id: booking.properties.booking_id,
          mock_exam_id: booking.properties.associated_mock_exam || mockExamData.id, // HubSpot mock exam object ID (for prerequisite validation)
          attendance: booking.properties.attendance || null, // Required for prerequisite validation
          name: booking.properties.name,
          email: booking.properties.email,
          dominant_hand: booking.properties.dominant_hand === 'true',
          // Flattened fields for frontend
          mock_type: mockExamData.mock_type,
          exam_date: mockExamData.exam_date,
          location: mockExamData.location,
          start_time: mockExamData.start_time,
          end_time: mockExamData.end_time,
          is_active: mockExamData.is_active,  // Include is_active for frontend use
          status: finalStatus,  // Use the properly mapped status
          created_at: booking.properties.hs_createdate
        });
      }

      // Step 6: Sort bookings by exam date (with error handling)
      bookingsWithExams.sort((a, b) => {
        try {
          const dateA = new Date(a.exam_date);
          const dateB = new Date(b.exam_date);

          // Ensure both dates are valid before comparison
          if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) {
            console.warn(`⚠️ [SORT WARNING] Invalid date in booking sort:`, {
              booking_a: { id: a.id, exam_date: a.exam_date },
              booking_b: { id: b.id, exam_date: b.exam_date }
            });
            return 0; // Keep original order if dates are invalid
          }

          return filter === 'past' ? dateB - dateA : dateA - dateB; // Past: newest first, Upcoming: soonest first
        } catch (sortError) {
          console.error(`❌ [SORT ERROR] Failed to sort bookings:`, sortError.message);
          return 0;
        }
      });

      // Step 7: Apply pagination
      const totalBookings = bookingsWithExams.length;
      const totalPages = Math.ceil(totalBookings / limit);
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedBookings = bookingsWithExams.slice(startIndex, endIndex);

      // ℹ️ FILTER INFO: Log when all bookings are filtered out (expected behavior for certain filters)
      if ((bookingsResponse?.results?.length > 0) && (totalBookings === 0)) {
        // This is often expected behavior, not an error
        console.log(`ℹ️ [FILTER INFO] Found ${bookingsResponse.results.length} booking(s), after applying filter '${filter}': 0 bookings matched`);

        // Only log details if in debug mode or if we think there might be an issue
        const hasInvalidDates = bookingsResponse.results.some(b => !b.properties.exam_date);
        const allCancelled = bookingsResponse.results.every(b =>
          b.properties.is_active === 'Cancelled' ||
          b.properties.is_active === 'cancelled' ||
          b.properties.is_active === false
        );

        if (hasInvalidDates) {
          console.warn('⚠️ [DATA WARNING] Some bookings have missing or invalid exam dates');
        }

        if (filter === 'upcoming' || filter === 'past') {
          console.log(`   This is expected if all bookings are ${filter === 'upcoming' ? 'in the past' : 'upcoming'}`);
        } else if (filter === 'cancelled' && !allCancelled) {
          console.log('   No cancelled bookings found (all bookings are active)');
        } else if (filter === 'all') {
          // Only warn if filter is 'all' and we still got 0 results
          console.warn('⚠️ [DATA WARNING] Filter is "all" but no bookings were processed. Possible data issues:');
          console.warn('   - Invalid or missing exam dates');
          console.warn('   - Missing mock exam associations');

          // Log booking details for debugging only in this case
          bookingsResponse.results.forEach((booking, idx) => {
            console.debug(`[DEBUG ${idx + 1}] Booking ${booking.id}:`, {
              booking_id: booking.properties.booking_id,
              has_mock_type: !!booking.properties.mock_type,
              has_exam_date: !!booking.properties.exam_date,
              exam_date: booking.properties.exam_date,
              mock_type: booking.properties.mock_type,
              is_active: booking.properties.is_active
            });
          });
        }
      }

      console.log(`✅ Successfully processed ${totalBookings} bookings (filter: ${filter}), returning ${paginatedBookings.length} for page ${page}`);

      return {
        bookings: paginatedBookings,
        total: totalBookings,
        pagination: {
          current_page: page,
          total_pages: totalPages,
          total_bookings: totalBookings,
          has_next: page < totalPages,
          has_previous: page > 1
        }
      };

    } catch (error) {
      console.error(`❌ Error getting bookings for contact ${contactId}:`, error);

      // Handle rate limiting and other API errors gracefully
      if (error.response?.status === 429) {
        throw new Error('API rate limit exceeded. Please try again in a moment.');
      }

      if (error.response?.status === 404) {
        throw new Error(`Contact not found or has no booking associations.`);
      }

      // Re-throw with more context
      throw new Error(`Failed to retrieve bookings: ${error.message}`);
    }
  }

  async deleteBooking(bookingId) {
    return await this.apiCall('DELETE', `/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}/${bookingId}`);
  }

  /**
   * Get a single booking by ID with associations
   * @param {string} bookingId - The booking ID
   * @returns {Promise<object>} Booking object with associations
   */
  async getBookingWithAssociations(bookingId) {
    try {
      // Get booking properties with V3 API
      const bookingResult = await this.apiCall({
        method: 'GET',
        url: `/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}/${bookingId}`,
        params: {
          properties: [
            'booking_id',
            'name',
            'email',
            'dominant_hand',
            'status',
            'is_active',
            'token_used',
            'createdate',
            'hs_lastmodifieddate'
          ]
        }
      });

      // Get associations using V4 API for better reliability
      let contactAssocs = { results: [] };
      let mockExamAssocs = { results: [] };

      try {
        contactAssocs = await this.apiCall({
          method: 'GET',
          url: `/crm/v4/objects/${HUBSPOT_OBJECTS.bookings}/${bookingId}/associations/${HUBSPOT_OBJECTS.contacts}`
        });
      } catch (e) {
        console.log('No contact associations found');
      }

      try {
        mockExamAssocs = await this.apiCall({
          method: 'GET',
          url: `/crm/v4/objects/${HUBSPOT_OBJECTS.bookings}/${bookingId}/associations/${HUBSPOT_OBJECTS.mock_exams}`
        });
      } catch (e) {
        console.log('No mock exam associations found');
      }

      // CRITICAL FIX: Properly map V4 association response to expected format
      // V4 API returns associations with 'toObjectId' as the target ID
      const result = {
        ...bookingResult,
        data: bookingResult.data || bookingResult,
        associations: {
          [HUBSPOT_OBJECTS.contacts]: {
            results: contactAssocs.results?.map(a => {
              return {
                id: a.toObjectId,  // This is the contact ID we want to match against
                toObjectId: a.toObjectId,  // Keep for backward compatibility
                type: 'booking_to_contact',
                associationTypeId: a.associationSpec?.associationTypeId
              };
            }) || []
          },
          [HUBSPOT_OBJECTS.mock_exams]: {
            results: mockExamAssocs.results?.map(a => ({
              id: a.toObjectId,  // This is the mock exam ID
              toObjectId: a.toObjectId,  // Keep for backward compatibility
              type: 'booking_to_mock_exam',
              associationTypeId: a.associationSpec?.associationTypeId
            })) || []
          }
        }
      };

      return result;
    } catch (error) {
      console.error('❌ [HUBSPOT ERROR] Failed to fetch booking:', {
        bookingId,
        error: error.message,
        status: error.status || error.response?.status,
        details: error.response?.data
      });
      throw error;
    }
  }

  /**
   * Restore credits to contact based on mock type
   * @param {string} contactId - The contact ID
   * @param {string} mockType - The mock type
   * @param {object} currentCredits - Current credit values
   * @returns {Promise<object>} Result of credit restoration
   */
  async restoreCredits(contactId, tokenUsed, currentCredits) {
    const creditUpdate = {};
    let creditType = '';
    let amount = 1;

    // Map token_used value to credit field
    const tokenToCreditFieldMapping = {
      'Situational Judgment Token': 'sj_credits',
      'Clinical Skills Token': 'cs_credits',
      'Mini-mock Token': 'sjmini_credits',
      'Mock Discussion Token': 'mock_discussion_token',
      'Shared Token': 'shared_mock_credits'
    };

    creditType = tokenToCreditFieldMapping[tokenUsed];

    if (!creditType) {
      throw new Error(`Unknown token type: ${tokenUsed}`);
    }

    // Restore the credit to the appropriate field
    const currentValue = parseInt(currentCredits[creditType]) || 0;
    creditUpdate[creditType] = currentValue + 1;

    console.log('💳 Restoring credit:', {
      tokenUsed,
      creditType,
      currentValue,
      newValue: creditUpdate[creditType]
    });

    // Update contact with restored credits
    await this.apiCall({
      method: 'PATCH',
      url: `/crm/v3/objects/contacts/${contactId}`,
      data: {
        properties: creditUpdate
      }
    });

    return {
      credit_type: creditType,
      amount: amount,
      new_balance: creditUpdate[creditType]
    };
  }

  /**
   * Decrement mock exam booking count
   * @param {string} mockExamId - The mock exam ID
   * @returns {Promise<object>} Updated mock exam info
   */
  async decrementMockExamBookings(mockExamId) {
    // First get current booking count
    const mockExamResponse = await this.getMockExam(mockExamId);
    if (!mockExamResponse || !mockExamResponse.data) {
      throw new Error('Mock exam not found');
    }

    const currentBookings = parseInt(mockExamResponse.data.properties.total_bookings) || 0;
    const capacity = parseInt(mockExamResponse.data.properties.capacity) || 0;
    const newBookings = Math.max(0, currentBookings - 1);

    // Update the mock exam
    await this.apiCall({
      method: 'PATCH',
      url: `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/${mockExamId}`,
      data: {
        properties: {
          total_bookings: newBookings
        }
      }
    });

    return {
      id: mockExamId,
      new_total_bookings: newBookings,
      available_slots: capacity - newBookings
    };
  }

  /**
   * Create a cancellation note on the associated deal 
   * @param {string} dealId - The deal ID
   * @param {object} cancellationData - Cancellation details
   * @returns {Promise<void>}
   */
  async createCancellationNote(dealId, cancellationData) {
    const timestamp = new Date().toISOString();
    const noteContent = `
❌ <strong>Booking Canceled</strong>
━━━━━━━━━━━━━━━━━━━━━━
<strong>Booking ID:</strong> ${cancellationData.booking_id}
<strong>Mock Type:</strong> ${cancellationData.mock_type}
<strong>Exam Date:</strong> ${cancellationData.exam_date}
<strong>Canceled At:</strong> ${timestamp}
${cancellationData.reason ? `<strong>Reason:</strong> ${cancellationData.reason}` : ''}
<strong>Credits Restored:</strong> ${cancellationData.credits_restored.amount} ${cancellationData.credits_restored.credit_type}
━━━━━━━━━━━━━━━━━━━━━━
<em>Automated cancellation via booking system</em>`;

    await this.apiCall({
      method: 'POST',
      url: `/crm/v3/objects/notes`,
      data: {
        properties: {
          hs_timestamp: timestamp,
          hs_note_body: noteContent
        },
        associations: [
          {
            to: { id: dealId },
            types: [
              {
                associationCategory: 'HUBSPOT_DEFINED',
                associationTypeId: 214  // Note to Deal association
              }
            ]
          }
        ]
      }
    });
  }

  /**
   * Create a Note on Contact timeline for booking confirmation
   * @param {Object} bookingData - The booking details
   * @param {string} contactId - The HubSpot contact ID
   * @param {Object} mockExamData - The mock exam details
   * @returns {Object|null} - Created note object or null if failed
   */
  async createBookingNote(bookingData, contactId, mockExamData) {
    try {
      // Format the date nicely
      const examDate = new Date(mockExamData.exam_date);
      const formattedExamDate = examDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      const bookedOnDate = new Date().toISOString();

      // Create HTML formatted note body for better readability
      const noteBody = `
        <h3>📅 Booking Confirmed</h3>

        <p><strong>Booking Details:</strong></p>
        <ul>
          <li><strong>Booking ID:</strong> ${bookingData.bookingId}</li>
          <li><strong>Exam Type:</strong> ${mockExamData.mock_type}</li>
          <li><strong>Exam Date:</strong> ${formattedExamDate}</li>
          <li><strong>Location:</strong> ${mockExamData.location || 'Mississauga'}</li>
          <li><strong>Booked On:</strong> ${bookedOnDate}</li>
        </ul>

        <p><strong>Student Information:</strong></p>
        <ul>
          <li><strong>Name:</strong> ${bookingData.name}</li>
          <li><strong>Email:</strong> ${bookingData.email}</li>
        </ul>

        <p><strong>Credit Information:</strong></p>
        <ul>
          <li><strong>Token Used:</strong> ${bookingData.tokenUsed || 'Not specified'}</li>
        </ul>

        <hr style="margin: 15px 0; border: 0; border-top: 1px solid #e0e0e0;">
        <p style="font-size: 12px; color: #666;">
          <em>This booking was automatically confirmed through the Prep Doctors Booking System.</em>
        </p>
      `;

      // Create the Note with association to Contact
      const notePayload = {
        properties: {
          hs_note_body: noteBody,
          hs_timestamp: Date.now()
        },
        associations: [
          {
            to: { id: contactId },
            types: [
              {
                associationCategory: "HUBSPOT_DEFINED",
                associationTypeId: 202 // Note to Contact association type ID
              }
            ]
          }
        ]
      };

      const noteResponse = await this.apiCall('POST', '/crm/v3/objects/notes', notePayload);

      console.log(`✅ Note created successfully with ID: ${noteResponse.id}`);
      return noteResponse;

    } catch (error) {
      // Log the error but don't throw - Note creation should not block booking
      console.error('Failed to create booking note:', {
        error: error.message,
        contactId,
        bookingId: bookingData.bookingId,
        status: error.response?.status,
        details: error.response?.data
      });

      // Implement retry logic for transient failures
      if (error.response?.status === 429 || error.response?.status >= 500) {
        console.log('🔄 Will retry Note creation in background...');
        // Could implement async retry here or queue for later processing
      }

      return null;
    }
  }

  /**
   * Create a cancellation note on Contact timeline
   * @param {string} contactId - HubSpot Contact ID
   * @param {object} cancellationData - Booking and cancellation details
   */
  async createBookingCancellationNote(contactId, cancellationData) {
    const timestamp = new Date().toISOString();
    const formattedDate = cancellationData.exam_date ?
      new Date(cancellationData.exam_date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }) : 'Date TBD';

    const noteContent = `
      <h3>❌ Booking Cancelled</h3>
      <p><strong>Booking Details:</strong></p>
      <ul>
      <li><strong>Booking ID:</strong> ${cancellationData.booking_id || 'N/A'}</li>
      <li><strong>Mock Type:</strong> ${cancellationData.mock_type || 'Mock Exam'}</li>
      <li><strong>Exam Date:</strong> ${formattedDate}</li>
      <li><strong>Location:</strong> ${cancellationData.location || 'Location TBD'}</li>
      <li><strong>Cancelled At:</strong> ${new Date(timestamp).toLocaleString('en-US', { timeZone: 'America/Toronto'})}</li>
      ${cancellationData.reason ? `<li><strong>Reason:</strong> ${cancellationData.reason}</li>` : ''}
      </ul>

      <p><strong>Student Information:</strong></p>
      <ul>
      <li><strong>Student:</strong> ${cancellationData.name || cancellationData.email || 'Student'}</li>
      </ul>

      <p><strong>Credit Information:</strong></p>
      <ul>
      <li><strong>Token Restored:</strong> ${cancellationData.token_used || 'Not specified'}</li>
      </ul>

      <hr style="margin: 15px 0; border: 0; border-top: 1px solid #e0e0e0;">
      <p style="font-size: 12px; color: #666;">
          <em>🔄 Booking automatically marked as cancelled via booking management system. Credit has been restored to your account.</em>
      </p>`;

    const notePayload = {
      properties: {
        hs_timestamp: Date.now(),
        hs_note_body: noteContent
      },
      associations: [

        {
          to: { id: contactId },
          types: [
            {
              associationCategory: 'HUBSPOT_DEFINED',
              associationTypeId: 202  // Note to Contact association type
            }
          ]
        }
      ]
    };

    try {
      const result = await this.apiCall('POST', '/crm/v3/objects/notes', notePayload);
      console.log(`✅ Cancellation note created successfully: Note ID ${result.id}`);
      return result;
    } catch (error) {
      console.error(`❌ Failed to create cancellation note:`, error);
      throw error;
    }
  }

}

// Create singleton instance lazily for backward compatibility
let hubspotInstance = null;

// Create a proxy that lazily initializes the HubSpotService instance
const hubspotProxy = new Proxy({}, {
  get(target, prop) {
    // Always export the class and objects directly
    if (prop === 'HubSpotService') return HubSpotService;
    if (prop === 'HUBSPOT_OBJECTS') return HUBSPOT_OBJECTS;

    // For any other property, create the instance if needed and delegate
    if (!hubspotInstance) {
      hubspotInstance = new HubSpotService();
    }

    const value = hubspotInstance[prop];
    if (typeof value === 'function') {
      // Bind methods to the instance
      return value.bind(hubspotInstance);
    }
    return value;
  }
});

// Export the proxy as default, with class and objects as properties
module.exports = hubspotProxy;
module.exports.HubSpotService = HubSpotService;
module.exports.HUBSPOT_OBJECTS = HUBSPOT_OBJECTS;