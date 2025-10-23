/**
 * ADMIN_ROOT HUBSPOT SERVICE - REFACTORED VERSION
 *
 * REMOVED METHODS (not needed for admin operations):
 * - Contact Management: searchContacts(), updateContactCredits(), restoreCredits(),
 *   getContactBookingAssociations(), getContactBookingAssociationsPaginated()
 * - Enrollment Management: searchEnrollments()
 * - Notes/Timeline: createCancellationNote(), createBookingNote(), createBookingCancellationNote()
 * - Helpers: mapLocationToHubSpot(), mapBookingStatus()
 *
 * These methods remain in user_root for student booking flow but are not needed in admin_root.
 * Total methods: 25 retained (from 36 original)
 */

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
        requestUrl: url,
        requestMethod: method
      });

      throw new Error(`HubSpot API Error (${statusCode}): ${errorMessage}`);
    }
  }

  /**
   * Search for available mock exams with optional filtering
   * This is a high-level search used by booking flow
   */
  async searchMockExams(mockType, isActive = true) {
    try {
      const filters = [
        {
          propertyName: 'mock_exam_status',
          operator: 'EQ',
          value: isActive ? 'active' : 'inactive'
        }
      ];

      // Add mock_type filter if specified
      if (mockType) {
        filters.push({
          propertyName: 'mock_type',
          operator: 'EQ',
          value: mockType
        });
      }

      const response = await this.apiCall('POST', `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/search`, {
        filterGroups: [{ filters }],
        properties: ['mock_type', 'date', 'time', 'location', 'slots_available', 'slots_total', 'mock_exam_status'],
        limit: 100
      });

      return response.results || [];
    } catch (error) {
      console.error('Error searching mock exams:', error);
      throw error;
    }
  }

  /**
   * Check if a booking already exists
   * Used to prevent duplicate bookings and validate booking operations
   * @param {string} bookingId - The HubSpot booking ID
   * @returns {Object|null} Booking object if exists, null otherwise
   */
  async checkExistingBooking(bookingId) {
    try {
      const response = await this.apiCall('GET', `/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}/${bookingId}`, null);

      // If we get here, booking exists
      return {
        exists: true,
        booking: response
      };
    } catch (error) {
      // If 404, booking doesn't exist
      if (error.message.includes('404')) {
        return {
          exists: false,
          booking: null
        };
      }
      // Other errors should be thrown
      throw error;
    }
  }

  /**
   * Find a booking by idempotency key
   * Prevents duplicate bookings when requests are retried
   */
  async findBookingByIdempotencyKey(idempotencyKey) {
    try {
      const response = await this.apiCall('POST', `/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}/search`, {
        filterGroups: [{
          filters: [{
            propertyName: 'idempotency_key',
            operator: 'EQ',
            value: idempotencyKey
          }]
        }],
        properties: [
          'contact_id', 'mock_exam_id', 'booking_status',
          'created_at', 'payment_method', 'confirmation_number'
        ],
        limit: 1
      });

      if (response.results && response.results.length > 0) {
        const booking = response.results[0];
        return {
          id: booking.id,
          properties: booking.properties,
          createdAt: booking.createdAt,
          updatedAt: booking.updatedAt
        };
      }

      return null;
    } catch (error) {
      console.error('Error finding booking by idempotency key:', error);
      // Don't throw - return null to indicate not found
      return null;
    }
  }

  /**
   * Create a new booking
   * Main method for creating bookings with all required associations
   */
  async createBooking(bookingData) {
    try {
      // Create the booking object
      const bookingResponse = await this.apiCall('POST', `/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}`, {
        properties: bookingData
      });

      const bookingId = bookingResponse.id;

      // Create associations if provided
      if (bookingData.contact_id) {
        await this.createAssociation(
          HUBSPOT_OBJECTS.bookings,
          bookingId,
          HUBSPOT_OBJECTS.contacts,
          bookingData.contact_id
        );
      }

      if (bookingData.mock_exam_id) {
        await this.createAssociation(
          HUBSPOT_OBJECTS.bookings,
          bookingId,
          HUBSPOT_OBJECTS.mock_exams,
          bookingData.mock_exam_id
        );
      }

      return bookingResponse;
    } catch (error) {
      console.error('Error creating booking:', error);
      throw error;
    }
  }

  /**
   * Update mock exam bookings count
   * Used after creating/cancelling bookings
   */
  async updateMockExamBookings(mockExamId, newTotal) {
    try {
      await this.apiCall('PATCH', `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/${mockExamId}`, {
        properties: {
          slots_available: newTotal
        }
      });
    } catch (error) {
      console.error('Error updating mock exam bookings:', error);
      throw error;
    }
  }

  /**
   * Get the default association type ID between two object types
   * Helper method for creating associations
   */
  getDefaultAssociationTypeId(fromObjectType, toObjectType) {
    // Define known association type IDs (these are HubSpot defaults)
    const associationMap = {
      [`${HUBSPOT_OBJECTS.bookings}_${HUBSPOT_OBJECTS.contacts}`]: 'booking_to_contact',
      [`${HUBSPOT_OBJECTS.bookings}_${HUBSPOT_OBJECTS.mock_exams}`]: 'booking_to_mock_exam',
      [`${HUBSPOT_OBJECTS.mock_exams}_${HUBSPOT_OBJECTS.bookings}`]: 'mock_exam_to_booking',
      [`${HUBSPOT_OBJECTS.contacts}_${HUBSPOT_OBJECTS.bookings}`]: 'contact_to_booking'
    };

    const key = `${fromObjectType}_${toObjectType}`;
    return associationMap[key] || 'default';
  }

  /**
   * Create an association between two HubSpot objects
   * Core method for linking bookings to contacts and mock exams
   */
  async createAssociation(fromObjectType, fromObjectId, toObjectType, toObjectId) {
    try {
      const associationTypeId = this.getDefaultAssociationTypeId(fromObjectType, toObjectType);

      await this.apiCall('PUT', `/crm/v4/objects/${fromObjectType}/${fromObjectId}/associations/${toObjectType}/${toObjectId}`, [
        {
          associationCategory: "HUBSPOT_DEFINED",
          associationTypeId: 1 // Default association type
        }
      ]);

      console.log(`Associated ${fromObjectType}:${fromObjectId} with ${toObjectType}:${toObjectId}`);
      return true;
    } catch (error) {
      // Check if association already exists (not an error)
      if (error.message.includes('already exists')) {
        console.log(`Association already exists between ${fromObjectType}:${fromObjectId} and ${toObjectType}:${toObjectId}`);
        return true;
      }
      console.error('Error creating association:', error);
      throw error;
    }
  }

  /**
   * Remove an association between two HubSpot objects
   * Used when cancelling bookings or cleaning up data
   */
  async removeAssociation(fromObjectType, fromObjectId, toObjectType, toObjectId) {
    try {
      await this.apiCall('DELETE', `/crm/v4/objects/${fromObjectType}/${fromObjectId}/associations/${toObjectType}/${toObjectId}`);
      console.log(`Removed association between ${fromObjectType}:${fromObjectId} and ${toObjectType}:${toObjectId}`);
      return true;
    } catch (error) {
      console.error('Error removing association:', error);
      throw error;
    }
  }

  /**
   * Get a single mock exam by ID
   * Used to fetch mock exam details for display and validation
   */
  async getMockExam(mockExamId) {
    try {
      const response = await this.apiCall('GET',
        `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/${mockExamId}?properties=mock_type,date,time,location,slots_available,slots_total,mock_exam_status`
      );
      return response;
    } catch (error) {
      console.error(`Error getting mock exam ${mockExamId}:`, error);
      throw error;
    }
  }

  /**
   * Get basic booking information
   * Lightweight method for quick booking lookups
   */
  async getBasicBooking(bookingId) {
    try {
      const response = await this.apiCall('GET', `/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}/${bookingId}`);
      return response;
    } catch (error) {
      console.error('Error getting booking:', error);
      throw error;
    }
  }

  /**
   * Get count of active bookings for a mock exam
   * Used to calculate available slots
   */
  async getActiveBookingsCount(mockExamId) {
    try {
      const filters = [
        {
          propertyName: 'mock_exam_id',
          operator: 'EQ',
          value: mockExamId
        },
        {
          propertyName: 'booking_status',
          operator: 'IN',
          values: ['confirmed', 'pending']
        }
      ];

      let allBookings = [];
      let after = null;
      let hasMore = true;

      while (hasMore) {
        const searchBody = {
          filterGroups: [{ filters }],
          properties: ['booking_status'],
          limit: 100
        };

        if (after) {
          searchBody.after = after;
        }

        const response = await this.apiCall('POST', `/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}/search`, searchBody);

        if (response.results) {
          allBookings = allBookings.concat(response.results);
        }

        if (response.paging?.next?.after) {
          after = response.paging.next.after;
        } else {
          hasMore = false;
        }
      }

      return allBookings.length;
    } catch (error) {
      console.error('Error getting active bookings count:', error);
      throw error;
    }
  }

  /**
   * Recalculate and update mock exam bookings count
   * Used to sync booking counts after operations
   */
  async recalculateMockExamBookings(mockExamId) {
    try {
      const activeCount = await this.getActiveBookingsCount(mockExamId);
      const mockExam = await this.getMockExam(mockExamId);
      const totalSlots = parseInt(mockExam.properties.slots_total || 20);
      const availableSlots = Math.max(0, totalSlots - activeCount);

      await this.updateMockExamBookings(mockExamId, availableSlots);

      return { activeCount, availableSlots, totalSlots };
    } catch (error) {
      console.error('Error recalculating mock exam bookings:', error);
      throw error;
    }
  }

  /**
   * Update booking properties
   * Used to change booking status or other properties
   */
  async updateBooking(bookingId, properties) {
    try {
      return await this.apiCall('PATCH', `/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}/${bookingId}`, {
        properties
      });
    } catch (error) {
      console.error('Error updating booking:', error);
      throw error;
    }
  }

  /**
   * Soft delete a booking (set status to cancelled)
   * Preferred method for cancelling bookings
   */
  async softDeleteBooking(bookingId) {
    return this.updateBooking(bookingId, {
      booking_status: 'cancelled'
    });
  }

  /**
   * Get bookings for a specific contact
   * Comprehensive method to retrieve all bookings with filtering and pagination
   * Used by both student portal and admin interfaces
   */
  async getBookingsForContact(contactId, { filter = 'all', page = 1, limit = 10 } = {}) {
    try {
      const filters = [
        {
          propertyName: 'contact_id',
          operator: 'EQ',
          value: contactId
        }
      ];

      // Add status filter if not 'all'
      if (filter !== 'all') {
        const statusMap = {
          'upcoming': ['confirmed', 'pending'],
          'completed': ['completed'],
          'cancelled': ['cancelled']
        };

        if (statusMap[filter]) {
          filters.push({
            propertyName: 'booking_status',
            operator: 'IN',
            values: statusMap[filter]
          });
        }
      }

      // Calculate pagination
      const startIndex = (page - 1) * limit;

      // Search for bookings
      const searchResponse = await this.apiCall('POST', `/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}/search`, {
        filterGroups: [{ filters }],
        properties: [
          'booking_status', 'mock_exam_id', 'created_at',
          'payment_method', 'confirmation_number'
        ],
        sorts: [
          {
            propertyName: 'created_at',
            direction: 'DESCENDING'
          }
        ],
        limit: 100 // Get more to calculate total pages
      });

      const allBookings = searchResponse.results || [];

      // Get unique mock exam IDs
      const mockExamIds = [...new Set(allBookings.map(b => b.properties.mock_exam_id).filter(Boolean))];

      // Batch fetch mock exam details
      let mockExams = {};
      if (mockExamIds.length > 0) {
        const batchResponse = await this.apiCall('POST', `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/batch/read`, {
          propertiesWithHistory: [],
          properties: ['mock_type', 'date', 'time', 'location'],
          inputs: mockExamIds.map(id => ({ id }))
        });

        if (batchResponse.results) {
          batchResponse.results.forEach(exam => {
            mockExams[exam.id] = exam.properties;
          });
        }
      }

      // Process bookings for the current page
      const paginatedBookings = allBookings.slice(startIndex, startIndex + limit);

      const processedBookings = paginatedBookings.map(booking => {
        const mockExamData = mockExams[booking.properties.mock_exam_id] || {};
        const bookingDate = mockExamData.date ? new Date(mockExamData.date) : null;
        const now = new Date();

        // Determine time-based status
        let status = 'unknown';
        if (bookingDate) {
          if (booking.properties.booking_status === 'cancelled') {
            status = 'cancelled';
          } else if (bookingDate < now) {
            status = 'past';
          } else {
            const hoursUntil = (bookingDate - now) / (1000 * 60 * 60);
            if (hoursUntil < 24) {
              status = 'upcoming_soon';
            } else {
              status = 'upcoming';
            }
          }
        }

        return {
          id: booking.id,
          bookingStatus: booking.properties.booking_status,
          mockExamId: booking.properties.mock_exam_id,
          createdAt: booking.properties.created_at,
          paymentMethod: booking.properties.payment_method,
          confirmationNumber: booking.properties.confirmation_number,
          mockExamData: {
            mockType: mockExamData.mock_type || 'Unknown',
            date: mockExamData.date,
            time: mockExamData.time,
            location: mockExamData.location || 'TBD'
          },
          timeStatus: status
        };
      });

      // Calculate pagination metadata
      const totalPages = Math.ceil(allBookings.length / limit);
      const hasMore = page < totalPages;
      const hasPrevious = page > 1;

      return {
        results: processedBookings,
        pagination: {
          page,
          limit,
          totalResults: allBookings.length,
          totalPages,
          hasMore,
          hasPrevious
        }
      };
    } catch (error) {
      console.error('Error getting bookings for contact:', error);
      throw error;
    }
  }

  /**
   * Hard delete a booking from HubSpot
   * Use with caution - this permanently removes the booking
   */
  async deleteBooking(bookingId) {
    return await this.apiCall('DELETE', `/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}/${bookingId}`);
  }

  /**
   * Get a booking with all its associations
   * Comprehensive method to fetch booking with related data
   */
  async getBookingWithAssociations(bookingId) {
    try {
      // Get the booking with associations
      const bookingResponse = await this.apiCall('GET',
        `/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}/${bookingId}?associations=${HUBSPOT_OBJECTS.contacts},${HUBSPOT_OBJECTS.mock_exams}&properties=booking_status,contact_id,mock_exam_id,created_at,payment_method,confirmation_number`
      );

      const result = {
        booking: bookingResponse.properties,
        bookingId: bookingResponse.id,
        contact: null,
        mockExam: null
      };

      // Get associated contact details if exists
      if (bookingResponse.associations?.[HUBSPOT_OBJECTS.contacts]?.results?.length > 0) {
        const contactId = bookingResponse.associations[HUBSPOT_OBJECTS.contacts].results[0].id;
        try {
          const contactResponse = await this.apiCall('GET',
            `/crm/v3/objects/${HUBSPOT_OBJECTS.contacts}/${contactId}?properties=email,firstname,lastname,student_id`
          );
          result.contact = {
            id: contactResponse.id,
            ...contactResponse.properties
          };
        } catch (error) {
          console.error('Error fetching associated contact:', error);
        }
      }

      // Get associated mock exam details if exists
      if (bookingResponse.associations?.[HUBSPOT_OBJECTS.mock_exams]?.results?.length > 0) {
        const mockExamId = bookingResponse.associations[HUBSPOT_OBJECTS.mock_exams].results[0].id;
        try {
          const mockExamResponse = await this.getMockExam(mockExamId);
          result.mockExam = {
            id: mockExamResponse.id,
            ...mockExamResponse.properties
          };
        } catch (error) {
          console.error('Error fetching associated mock exam:', error);
        }
      }

      return result;
    } catch (error) {
      console.error('Error getting booking with associations:', error);
      throw error;
    }
  }

  /**
   * Decrement mock exam bookings count
   * Used when a booking is cancelled
   */
  async decrementMockExamBookings(mockExamId) {
    try {
      // Get current mock exam data
      const mockExam = await this.getMockExam(mockExamId);
      const currentAvailable = parseInt(mockExam.properties.slots_available || 0);
      const totalSlots = parseInt(mockExam.properties.slots_total || 20);

      // Increment available slots (decrement bookings)
      const newAvailable = Math.min(currentAvailable + 1, totalSlots);

      await this.updateMockExamBookings(mockExamId, newAvailable);

      console.log(`Decremented bookings for mock exam ${mockExamId}: ${currentAvailable} -> ${newAvailable}`);
      return newAvailable;
    } catch (error) {
      console.error('Error decrementing mock exam bookings:', error);
      throw error;
    }
  }

  /**
   * Create a new mock exam
   * Core admin functionality for setting up new exam sessions
   */
  async createMockExam(mockExamData) {
    try {
      // Validate required fields
      const requiredFields = ['mock_type', 'date', 'time', 'location', 'slots_total'];
      for (const field of requiredFields) {
        if (!mockExamData[field]) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      // Set defaults
      const examData = {
        ...mockExamData,
        slots_available: mockExamData.slots_available || mockExamData.slots_total,
        mock_exam_status: mockExamData.mock_exam_status || 'active',
        price_credits: mockExamData.price_credits || 1,
        created_at: new Date().toISOString()
      };

      const response = await this.apiCall('POST', `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}`, {
        properties: examData
      });

      console.log(`Created mock exam ${response.id}`);
      return response;
    } catch (error) {
      console.error('Error creating mock exam:', error);
      throw error;
    }
  }

  /**
   * Batch create multiple mock exams
   * Efficient method for creating multiple exam sessions at once
   */
  async batchCreateMockExams(commonProperties, timeSlots) {
    try {
      // Validate inputs
      if (!timeSlots || !Array.isArray(timeSlots) || timeSlots.length === 0) {
        throw new Error('Time slots array is required');
      }

      // Prepare batch inputs
      const inputs = timeSlots.map(slot => {
        const properties = {
          ...commonProperties,
          date: slot.date,
          time: slot.time,
          slots_available: commonProperties.slots_total || 20,
          mock_exam_status: 'active',
          price_credits: commonProperties.price_credits || 1,
          created_at: new Date().toISOString()
        };

        return { properties };
      });

      // Use batch API to create all exams at once
      const response = await this.apiCall('POST', `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/batch/create`, {
        inputs
      });

      if (response.status === 'COMPLETE') {
        console.log(`Successfully created ${response.results.length} mock exams`);
        return response.results;
      } else {
        console.error('Batch creation partially failed:', response);
        throw new Error(`Batch creation failed: ${response.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error batch creating mock exams:', error);
      throw error;
    }
  }

  /**
   * List mock exams with filtering and pagination
   * Core admin functionality for viewing and managing exam sessions
   */
  async listMockExams(options = {}) {
    try {
      const {
        mockType = null,
        status = null,
        startDate = null,
        endDate = null,
        location = null,
        page = 1,
        limit = 20,
        sortBy = 'date',
        sortOrder = 'ascending'
      } = options;

      // Build filters
      const filters = [];

      if (mockType) {
        filters.push({
          propertyName: 'mock_type',
          operator: 'EQ',
          value: mockType
        });
      }

      if (status) {
        filters.push({
          propertyName: 'mock_exam_status',
          operator: 'EQ',
          value: status
        });
      }

      if (startDate) {
        filters.push({
          propertyName: 'date',
          operator: 'GTE',
          value: startDate
        });
      }

      if (endDate) {
        filters.push({
          propertyName: 'date',
          operator: 'LTE',
          value: endDate
        });
      }

      if (location) {
        filters.push({
          propertyName: 'location',
          operator: 'EQ',
          value: location
        });
      }

      // Calculate offset for pagination
      const after = page > 1 ? ((page - 1) * limit) : 0;

      // Build search request
      const searchRequest = {
        properties: [
          'mock_type', 'date', 'time', 'location',
          'slots_available', 'slots_total', 'mock_exam_status',
          'price_credits', 'created_at'
        ],
        limit,
        sorts: [{
          propertyName: sortBy,
          direction: sortOrder.toUpperCase()
        }]
      };

      // Add filters if any
      if (filters.length > 0) {
        searchRequest.filterGroups = [{ filters }];
      }

      // Add pagination if needed
      if (after > 0) {
        searchRequest.after = after;
      }

      const response = await this.apiCall('POST', `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/search`, searchRequest);

      // Format response with pagination info
      return {
        results: response.results || [],
        pagination: {
          page,
          limit,
          total: response.total || 0,
          hasMore: response.paging?.next ? true : false,
          nextPage: response.paging?.next ? page + 1 : null
        }
      };
    } catch (error) {
      console.error('Error listing mock exams:', error);
      throw error;
    }
  }

  /**
   * Update a mock exam
   * Admin functionality for modifying exam details
   */
  async updateMockExam(mockExamId, properties) {
    try {
      const response = await this.apiCall('PATCH', `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/${mockExamId}`, {
        properties
      });

      console.log(`Updated mock exam ${mockExamId}`);
      return response;
    } catch (error) {
      console.error('Error updating mock exam:', error);
      throw error;
    }
  }

  /**
   * Delete a mock exam
   * Admin functionality for removing exam sessions
   */
  async deleteMockExam(mockExamId) {
    try {
      await this.apiCall('DELETE', `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/${mockExamId}`);
      console.log(`Deleted mock exam ${mockExamId}`);
      return true;
    } catch (error) {
      console.error('Error deleting mock exam:', error);
      throw error;
    }
  }

  /**
   * Get mock exam with associated bookings
   * Admin functionality to view exam details with all bookings
   */
  async getMockExamWithBookings(mockExamId) {
    try {
      // Get mock exam details
      const mockExam = await this.getMockExam(mockExamId);

      // Search for all bookings for this mock exam
      const bookingsResponse = await this.apiCall('POST', `/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}/search`, {
        filterGroups: [{
          filters: [{
            propertyName: 'mock_exam_id',
            operator: 'EQ',
            value: mockExamId
          }]
        }],
        properties: [
          'booking_status', 'contact_id', 'created_at',
          'payment_method', 'confirmation_number'
        ],
        limit: 100
      });

      const bookings = bookingsResponse.results || [];

      // Get unique contact IDs
      const contactIds = [...new Set(bookings.map(b => b.properties.contact_id).filter(Boolean))];

      // Batch fetch contact details if there are bookings
      let contacts = {};
      if (contactIds.length > 0) {
        const contactsResponse = await this.apiCall('POST', `/crm/v3/objects/${HUBSPOT_OBJECTS.contacts}/batch/read`, {
          properties: ['email', 'firstname', 'lastname', 'student_id'],
          inputs: contactIds.map(id => ({ id }))
        });

        if (contactsResponse.results) {
          contactsResponse.results.forEach(contact => {
            contacts[contact.id] = contact.properties;
          });
        }
      }

      // Process bookings with contact details
      const processedBookings = bookings.map(booking => ({
        id: booking.id,
        ...booking.properties,
        contact: contacts[booking.properties.contact_id] || null
      }));

      return {
        mockExam: {
          id: mockExam.id,
          ...mockExam.properties
        },
        bookings: processedBookings,
        statistics: {
          total: bookings.length,
          confirmed: bookings.filter(b => b.properties.booking_status === 'confirmed').length,
          pending: bookings.filter(b => b.properties.booking_status === 'pending').length,
          cancelled: bookings.filter(b => b.properties.booking_status === 'cancelled').length
        }
      };
    } catch (error) {
      console.error('Error getting mock exam with bookings:', error);
      throw error;
    }
  }

  /**
   * Calculate metrics for mock exams
   * Admin analytics functionality
   */
  async calculateMetrics(filters = {}) {
    try {
      const { startDate, endDate, mockType, status } = filters;

      // Build filters for mock exams
      const examFilters = [];
      if (startDate) {
        examFilters.push({
          propertyName: 'date',
          operator: 'GTE',
          value: startDate
        });
      }
      if (endDate) {
        examFilters.push({
          propertyName: 'date',
          operator: 'LTE',
          value: endDate
        });
      }
      if (mockType) {
        examFilters.push({
          propertyName: 'mock_type',
          operator: 'EQ',
          value: mockType
        });
      }
      if (status) {
        examFilters.push({
          propertyName: 'mock_exam_status',
          operator: 'EQ',
          value: status
        });
      }

      // Get all mock exams matching filters
      const searchRequest = {
        properties: ['mock_type', 'date', 'slots_available', 'slots_total', 'mock_exam_status'],
        limit: 100
      };

      if (examFilters.length > 0) {
        searchRequest.filterGroups = [{ filters: examFilters }];
      }

      const examsResponse = await this.apiCall('POST', `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/search`, searchRequest);
      const exams = examsResponse.results || [];

      // Calculate metrics
      const metrics = {
        totalExams: exams.length,
        totalSlots: 0,
        bookedSlots: 0,
        availableSlots: 0,
        utilizationRate: 0,
        byType: {},
        byStatus: {}
      };

      exams.forEach(exam => {
        const total = parseInt(exam.properties.slots_total || 0);
        const available = parseInt(exam.properties.slots_available || 0);
        const booked = total - available;

        metrics.totalSlots += total;
        metrics.availableSlots += available;
        metrics.bookedSlots += booked;

        // Group by type
        const type = exam.properties.mock_type || 'Unknown';
        if (!metrics.byType[type]) {
          metrics.byType[type] = { count: 0, totalSlots: 0, bookedSlots: 0 };
        }
        metrics.byType[type].count++;
        metrics.byType[type].totalSlots += total;
        metrics.byType[type].bookedSlots += booked;

        // Group by status
        const examStatus = exam.properties.mock_exam_status || 'unknown';
        if (!metrics.byStatus[examStatus]) {
          metrics.byStatus[examStatus] = 0;
        }
        metrics.byStatus[examStatus]++;
      });

      // Calculate utilization rate
      if (metrics.totalSlots > 0) {
        metrics.utilizationRate = (metrics.bookedSlots / metrics.totalSlots * 100).toFixed(2);
      }

      return metrics;
    } catch (error) {
      console.error('Error calculating metrics:', error);
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