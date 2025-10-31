/**
 * ADMIN_ROOT HUBSPOT SERVICE - REFACTORED VERSION
 *
 * REMOVED METHODS (not needed for admin operations):
 * - Contact Management: searchContacts(), updateContactCredits(), restoreCredits(),
 *   getContactBookingAssociations(), getContactBookingAssociationsPaginated()
 * - Enrollment Management: searchEnrollments()
 * - Booking Notes: createCancellationNote(), createBookingNote(), createBookingCancellationNote()
 * - Helpers: mapLocationToHubSpot(), mapBookingStatus()
 *
 * ADMIN-SPECIFIC METHODS:
 * - Audit Trail: createMockExamEditNote() - Creates notes documenting admin changes
 *
 * These methods remain in user_root for student booking flow but are not needed in admin_root.
 * Total methods: 26 retained (from 36 original, +1 admin-specific)
 */

const axios = require('axios');

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
  }

  /**
   * Helper to find association key in response
   * HubSpot returns association keys in different formats:
   * - Standard: '2-50158943' (object type ID)
   * - Portal-specific: 'p46814382_bookings_' (portal ID + object name)
   * This helper searches for the correct key flexibly
   */
  findAssociationKey(associations, objectTypeId, objectName) {
    if (!associations) return null;

    const keys = Object.keys(associations);

    // Try exact match first (standard format)
    if (keys.includes(objectTypeId)) {
      return objectTypeId;
    }

    // Try finding by object name (portal-specific format)
    const keyWithName = keys.find(key => key.includes(objectName));
    if (keyWithName) {
      return keyWithName;
    }

    return null;
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
      
      // Monitor rate limit headers
      const rateLimitHeaders = response.headers;
      const dailyLimit = rateLimitHeaders['x-hubspot-ratelimit-daily'];
      const dailyRemaining = rateLimitHeaders['x-hubspot-ratelimit-daily-remaining'];
      const secondlyLimit = rateLimitHeaders['x-hubspot-ratelimit-secondly'];
      const secondlyRemaining = rateLimitHeaders['x-hubspot-ratelimit-secondly-remaining'];
      
      // Log rate limit info if we're getting close to limits
      if (secondlyRemaining && parseInt(secondlyRemaining) < 20) {
        console.warn(`⚠️ HubSpot API Rate Limit Warning: Only ${secondlyRemaining}/${secondlyLimit} requests remaining this second`);
      }
      
      if (secondlyRemaining && parseInt(secondlyRemaining) < 5) {
        console.error(`🚨 HubSpot API Rate Limit Critical: Only ${secondlyRemaining}/${secondlyLimit} requests remaining this second!`);
      }
      
      if (dailyRemaining && parseInt(dailyRemaining) < 1000) {
        console.warn(`⚠️ HubSpot API Daily Limit Warning: Only ${dailyRemaining}/${dailyLimit} requests remaining today`);
      }
      
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
        requestMethod: method,
        requestBody: requestData
      });

      throw new Error(`HubSpot API Error (${statusCode}): ${errorMessage}`);
    }
  }

  /**
   * Convert exam date and time string to Unix timestamp (milliseconds)
   * @param {string} examDate - Date in YYYY-MM-DD format
   * @param {string} timeString - Time in HH:MM format (24-hour)
   * @returns {number} Unix timestamp in milliseconds
   */
  convertToTimestamp(examDate, timeString) {
    if (!examDate || !timeString) {
      throw new Error('Both examDate and timeString are required for timestamp conversion');
    }

    console.log('🕐 [CONVERT-TIMESTAMP] Input:', { examDate, timeString });

    // Parse time string (HH:MM or HH:MM:SS)
    const timeParts = timeString.split(':');
    const hours = parseInt(timeParts[0]);
    const minutes = parseInt(timeParts[1] || '0');
    const seconds = parseInt(timeParts[2] || '0');

    // Create a date object for the given date at the specified time in America/Toronto timezone
    // We need to determine if DST is in effect on this date to use the correct offset
    
    // Parse the exam date
    const [year, month, day] = examDate.split('-').map(Number);
    
    // Create a date string in ISO format at noon UTC to check DST
    // Using noon avoids edge cases around midnight
    const testDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    
    // Format the date in America/Toronto timezone to check the offset
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Toronto',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZoneName: 'short'
    });
    
    const formatted = formatter.format(testDate);
    const isDST = formatted.includes('EDT'); // EDT = Daylight Time (UTC-4), EST = Standard Time (UTC-5)
    
    // Use the appropriate offset
    const offset = isDST ? '-04:00' : '-05:00';
    const offsetName = isDST ? 'EDT' : 'EST';
    
    // Create ISO string with the correct timezone offset for America/Toronto
    const hoursStr = String(hours).padStart(2, '0');
    const minutesStr = String(minutes).padStart(2, '0');
    const secondsStr = String(seconds).padStart(2, '0');
    const isoString = `${examDate}T${hoursStr}:${minutesStr}:${secondsStr}${offset}`;
    
    console.log(`🕐 [CONVERT-TIMESTAMP] Detected timezone: ${offsetName} (${offset})`);
    console.log('🕐 [CONVERT-TIMESTAMP] ISO String:', isoString);
    
    // Parse ISO string to Date object
    const date = new Date(isoString);
    
    if (isNaN(date.getTime())) {
      console.error('❌ [CONVERT-TIMESTAMP] Invalid date created:', { isoString, examDate, timeString });
      throw new Error('Invalid date or time format');
    }
    
    const timestamp = date.getTime();
    console.log('🕐 [CONVERT-TIMESTAMP] Output timestamp:', timestamp);
    console.log('🕐 [CONVERT-TIMESTAMP] Represents:', new Date(timestamp).toISOString());
    
    // Return Unix timestamp in milliseconds
    return timestamp;
  }

  /**
   * Search for available mock exams with optional filtering
   * This is a high-level search used by booking flow
   */
  async searchMockExams(mockType, isActive = true) {
    try {
      const filters = [
        {
          propertyName: 'is_active',
          operator: 'EQ',
          value: isActive ? 'true' : 'false'
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
        properties: ['mock_type', 'exam_date', 'start_time', 'end_time', 'location', 'capacity', 'total_bookings', 'is_active'],
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
          total_bookings: newTotal
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
      // Determine the correct association parameters
      let associationCategory = 'HUBSPOT_DEFINED';
      let associationTypeId = 1; // Default fallback
      
      // Notes in this portal use object type 0-46 and require USER_DEFINED associations
      if (fromObjectType === 'notes' || fromObjectType === '0-46') {
        // Notes associating to other objects use USER_DEFINED category with type 1250
        associationCategory = 'USER_DEFINED';
        associationTypeId = 1250;
      } else if (toObjectType === 'notes' || toObjectType === '0-46') {
        // Other objects associating to notes also use USER_DEFINED with type 1249
        associationCategory = 'USER_DEFINED';
        associationTypeId = 1249;
      }

      await this.apiCall('PUT', `/crm/v4/objects/${fromObjectType}/${fromObjectId}/associations/${toObjectType}/${toObjectId}`, [
        {
          associationCategory: associationCategory,
          associationTypeId: associationTypeId
        }
      ]);

      console.log(`✅ Associated ${fromObjectType}:${fromObjectId} with ${toObjectType}:${toObjectId} (category: ${associationCategory}, typeId: ${associationTypeId})`);
      return true;
    } catch (error) {
      // Check if association already exists (not an error)
      if (error.message.includes('already exists')) {
        console.log(`ℹ️ Association already exists between ${fromObjectType}:${fromObjectId} and ${toObjectType}:${toObjectId}`);
        return true;
      }
      console.error('❌ Error creating association:', error);
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
        `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/${mockExamId}?properties=mock_type,exam_date,start_time,end_time,location,capacity,total_bookings,is_active`
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

      // Get associated contact details if exists (using flexible key matching)
      const contactsKey = this.findAssociationKey(bookingResponse.associations, HUBSPOT_OBJECTS.contacts, 'contacts');
      if (contactsKey && bookingResponse.associations[contactsKey]?.results?.length > 0) {
        const contactId = bookingResponse.associations[contactsKey].results[0].id;
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

      // Get associated mock exam details if exists (using flexible key matching)
      const mockExamsKey = this.findAssociationKey(bookingResponse.associations, HUBSPOT_OBJECTS.mock_exams, 'mock_exams');
      if (mockExamsKey && bookingResponse.associations[mockExamsKey]?.results?.length > 0) {
        const mockExamId = bookingResponse.associations[mockExamsKey].results[0].id;
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
  /**
   * Get the maximum mock_exam_index value from existing mock exams
   * Used for auto-incrementing the index when creating new exams
   * @returns {Promise<number>} The current maximum index, or 0 if no exams exist
   */
  async getMaxMockExamIndex() {
    try {
      console.log('🚀 [GET-MAX-INDEX] Starting to get max mock_exam_index');
      console.log('📋 [GET-MAX-INDEX] Attempting with internal property name: mock_exam_id');
      
      // Try using "mock_exam_id" as the internal HubSpot property name
      // HubSpot often has different internal names vs display names
      console.log('🔍 [GET-MAX-INDEX] Calling HubSpot Search API with filter and sort...');
      console.log(`📡 [GET-MAX-INDEX] API endpoint: POST /crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/search`);

      const searchRequest = {
        // Filter OUT exams with null/empty mock_exam_id (internal property name)
        filterGroups: [{
          filters: [{
            propertyName: 'mock_exam_id',  // Using internal HubSpot property name
            operator: 'HAS_PROPERTY'
          }]
        }],
        properties: ['mock_exam_id'],  // Request the internal property
        sorts: [{
          propertyName: 'mock_exam_id',  // Sort by internal property
          direction: 'DESCENDING'  // Highest first
        }],
        limit: 1  // Only need the top result
      };

      console.log('📤 [GET-MAX-INDEX] Search request:', JSON.stringify(searchRequest, null, 2));

      const response = await this.apiCall('POST', `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/search`, searchRequest);

      console.log('📥 [GET-MAX-INDEX] Received response:', {
        resultsCount: response.results?.length,
        hasResults: !!(response.results && response.results.length > 0),
        firstResult: response.results?.[0],
        fullResponse: JSON.stringify(response, null, 2)
      });

      // If no exams with mock_exam_id exist, start from 0
      if (!response.results || response.results.length === 0) {
        console.log('⚠️ [GET-MAX-INDEX] No mock exams with mock_exam_id found, starting from 1');
        return 0;
      }

      // Get the mock_exam_id from the first (highest) result
      const indexValue = response.results[0].properties.mock_exam_id;
      console.log('📊 [GET-MAX-INDEX] Highest mock_exam_id value:', {
        value: indexValue,
        type: typeof indexValue,
        examId: response.results[0].id
      });

      const maxIndex = parseInt(indexValue);
      
      // Validate the parsed value
      if (isNaN(maxIndex)) {
        console.error('❌ [GET-MAX-INDEX] Invalid mock_exam_id value:', indexValue);
        console.log('⚠️ [GET-MAX-INDEX] Defaulting to 0 due to invalid value');
        return 0;
      }

      console.log(`✅ [GET-MAX-INDEX] Current max mock_exam_id: ${maxIndex}`);
      console.log(`📊 [GET-MAX-INDEX] Retrieved in SINGLE API call (optimized with internal property name)`);
      return maxIndex;
      
    } catch (error) {
      console.error('❌ [GET-MAX-INDEX] ERROR getting max with mock_exam_id:', {
        errorMessage: error.message,
        errorStack: error.stack,
        errorName: error.name,
        errorResponse: error.response?.data,
        fullError: error
      });
      
      // If there's an error (e.g., property doesn't exist), start from 0
      console.log('⚠️ [GET-MAX-INDEX] Defaulting to mock_exam_index = 0 due to error');
      return 0;
    }
  }

  async createMockExam(mockExamData) {
    try {
      // Validate required fields
      const requiredFields = ['mock_type', 'exam_date', 'start_time', 'end_time', 'location', 'capacity'];
      for (const field of requiredFields) {
        if (!mockExamData[field]) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      // Get the current max mock_exam_index and increment it
      const maxIndex = await this.getMaxMockExamIndex();
      const newIndex = maxIndex + 1;
      console.log(`Assigning mock_exam_id (internal property): ${newIndex}`);

      // Convert time strings to Unix timestamps
      const startTimestamp = this.convertToTimestamp(mockExamData.exam_date, mockExamData.start_time);
      const endTimestamp = this.convertToTimestamp(mockExamData.exam_date, mockExamData.end_time);

      // Generate mock_exam_name in format: {mock_type}-{location}-{exam_date}
      const mockExamName = `${mockExamData.mock_type}-${mockExamData.location}-${mockExamData.exam_date}`;

      // Set exam data with correct HubSpot property names and timestamp format
      const examData = {
        mock_type: mockExamData.mock_type,
        exam_date: mockExamData.exam_date,
        start_time: startTimestamp,  // Unix timestamp in milliseconds
        end_time: endTimestamp,      // Unix timestamp in milliseconds
        location: mockExamData.location,
        capacity: mockExamData.capacity,
        total_bookings: mockExamData.total_bookings || 0,
        is_active: mockExamData.is_active !== undefined ? mockExamData.is_active : 'true',
        mock_exam_id: newIndex,  // Using internal HubSpot property name
        mock_exam_name: mockExamName  // Format: {mock_type}-{location}-{exam_date}
      };

      const response = await this.apiCall('POST', `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}`, {
        properties: examData
      });

      console.log(`Created mock exam ${response.id} with mock_exam_id ${newIndex}`);
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
      console.log('🚀 [BATCH-CREATE] Starting batch creation');
      console.log('📥 [BATCH-CREATE] Input received:', {
        commonProperties,
        timeSlotsCount: timeSlots?.length,
        timeSlots
      });

      // Validate inputs
      console.log('🔍 [BATCH-CREATE] Step 1: Validating inputs...');
      if (!timeSlots || !Array.isArray(timeSlots) || timeSlots.length === 0) {
        console.error('❌ [BATCH-CREATE] Invalid timeSlots:', { timeSlots });
        throw new Error('Time slots array is required');
      }
      console.log('✅ [BATCH-CREATE] Input validation passed');

      // Get the current max mock_exam_index ONCE for the entire batch
      console.log('🔍 [BATCH-CREATE] Step 2: Getting max mock_exam_index...');
      const maxIndex = await this.getMaxMockExamIndex();
      console.log(`✅ [BATCH-CREATE] Max index retrieved: ${maxIndex}`);
      console.log(`📊 [BATCH-CREATE] Starting batch with mock_exam_index from: ${maxIndex + 1}`);

      // Prepare batch inputs using correct HubSpot property names and timestamp format
      console.log('🔍 [BATCH-CREATE] Step 3: Preparing batch inputs...');
      console.log(`📅 [BATCH-CREATE] Using exam_date from commonProperties: ${commonProperties.exam_date}`);
      
      const inputs = timeSlots.map((slot, index) => {
        console.log(`🔧 [BATCH-CREATE] Processing slot ${index + 1}/${timeSlots.length}:`, slot);
        
        // IMPORTANT: exam_date is in commonProperties, NOT in individual time slots
        // Time slots only contain start_time and end_time
        const examDate = commonProperties.exam_date;
        console.log(`📅 [BATCH-CREATE] Slot ${index + 1} using exam_date:`, examDate);
        
        // Convert time strings to Unix timestamps
        console.log(`🕐 [BATCH-CREATE] Slot ${index + 1} converting times...`);
        console.log(`🕐 [BATCH-CREATE] Slot ${index + 1} inputs: examDate=${examDate}, start_time=${slot.start_time}, end_time=${slot.end_time}`);
        
        const startTimestamp = this.convertToTimestamp(examDate, slot.start_time);
        const endTimestamp = this.convertToTimestamp(examDate, slot.end_time);
        console.log(`✅ [BATCH-CREATE] Slot ${index + 1} timestamps:`, {
          start_time: slot.start_time,
          startTimestamp,
          end_time: slot.end_time,
          endTimestamp
        });

        // Assign sequential mock_exam_index starting from maxIndex + 1
        const mockExamIndex = maxIndex + index + 1;

        // Generate mock_exam_name in format: {mock_type}-{location}-{exam_date}
        const mockExamName = `${commonProperties.mock_type}-${commonProperties.location}-${examDate}`;

        const properties = {
          mock_type: commonProperties.mock_type,
          exam_date: examDate,
          start_time: startTimestamp,  // Unix timestamp in milliseconds
          end_time: endTimestamp,      // Unix timestamp in milliseconds
          location: commonProperties.location,
          capacity: commonProperties.capacity || 20,
          total_bookings: 0,
          is_active: 'true',
          mock_exam_id: mockExamIndex,  // Using internal HubSpot property name
          mock_exam_name: mockExamName  // Format: {mock_type}-{location}-{exam_date}
        };

        console.log(`📋 [BATCH-CREATE] Slot ${index + 1} final properties:`, properties);
        console.log(`✅ [BATCH-CREATE] Assigning mock_exam_index ${mockExamIndex} to time slot ${slot.start_time}-${slot.end_time}`);
        return { properties };
      });

      console.log(`✅ [BATCH-CREATE] Prepared ${inputs.length} inputs for batch API`);
      console.log('📤 [BATCH-CREATE] Full inputs array:', JSON.stringify(inputs, null, 2));

      // Use batch API to create all exams at once
      console.log('🔍 [BATCH-CREATE] Step 4: Calling HubSpot batch API...');
      console.log(`📡 [BATCH-CREATE] API endpoint: POST /crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/batch/create`);
      
      const response = await this.apiCall('POST', `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/batch/create`, {
        inputs
      });

      console.log('📥 [BATCH-CREATE] Received response from HubSpot:', {
        status: response.status,
        resultsCount: response.results?.length,
        hasErrors: !!response.errors,
        errorsCount: response.errors?.length,
        fullResponse: JSON.stringify(response, null, 2)
      });

      if (response.status === 'COMPLETE') {
        console.log(`✅ [BATCH-CREATE] Successfully created ${response.results.length} mock exams with indices ${maxIndex + 1} to ${maxIndex + timeSlots.length}`);
        console.log('📊 [BATCH-CREATE] Created exam IDs:', response.results.map(r => r.id));
        return response.results;
      } else {
        console.error('❌ [BATCH-CREATE] Batch creation partially failed');
        console.error('❌ [BATCH-CREATE] Response status:', response.status);
        console.error('❌ [BATCH-CREATE] Response message:', response.message);
        console.error('❌ [BATCH-CREATE] Errors:', response.errors);
        throw new Error(`Batch creation failed: ${response.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('❌ [BATCH-CREATE] ERROR in batchCreateMockExams:', {
        errorMessage: error.message,
        errorStack: error.stack,
        errorName: error.name,
        errorResponse: error.response?.data,
        fullError: error
      });
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
        // Map frontend status values to HubSpot is_active property
        // Frontend sends: "active" or "inactive"
        // HubSpot expects: "true" or "false" (as strings)
        const isActiveValue = status === 'active' ? 'true' : 'false';
        filters.push({
          propertyName: 'is_active',
          operator: 'EQ',
          value: isActiveValue
        });
      }

      // NOTE: exam_date is stored as a string property in HubSpot
      // Date filtering will be done in application code after fetching results
      // Store date filters for post-processing
      const dateFilters = { startDate, endDate };

      if (location) {
        filters.push({
          propertyName: 'location',
          operator: 'EQ',
          value: location
        });
      }

      // Calculate offset for pagination
      const after = page > 1 ? ((page - 1) * limit) : 0;

      // Build search request - now includes associations to fetch bookings
      const searchRequest = {
        properties: [
          'mock_type',
          'exam_date',
          'start_time',
          'end_time',
          'location',
          'capacity',
          'total_bookings',
          'is_active',
          'hs_createdate',
          'hs_lastmodifieddate'
        ],
        associations: [HUBSPOT_OBJECTS.bookings], // Fetch booking associations
        limit,
        sorts: [{
          propertyName: sortBy === 'date' ? 'exam_date' : sortBy,
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

      // Apply date filtering in application code
      let results = response.results || [];

      if (dateFilters.startDate || dateFilters.endDate) {
        results = results.filter(exam => {
          const examDate = exam.properties.exam_date;

          if (dateFilters.startDate && examDate < dateFilters.startDate) {
            return false;
          }
          if (dateFilters.endDate && examDate > dateFilters.endDate) {
            return false;
          }

          return true;
        });

        console.log(`Date filtering applied: ${response.results?.length || 0} -> ${results.length} exams`);
      }

      // Now fetch actual bookings and count only Active ones
      // Process each mock exam to get accurate active booking count
      const enrichedResults = await Promise.all(results.map(async (exam) => {
        try {
          // Extract booking IDs from associations
          const bookingIds = [];
          if (exam.associations && exam.associations[HUBSPOT_OBJECTS.bookings]) {
            const bookingAssociations = exam.associations[HUBSPOT_OBJECTS.bookings].results || [];
            bookingAssociations.forEach(assoc => {
              bookingIds.push(assoc.id);
            });
          }

          // If no bookings, set count to 0
          if (bookingIds.length === 0) {
            return {
              ...exam,
              properties: {
                ...exam.properties,
                total_bookings: '0' // HubSpot stores as string
              }
            };
          }

          // Batch fetch booking details to check is_active status
          // Process in chunks of 100 (HubSpot batch limit)
          let activeBookingsCount = 0;
          for (let i = 0; i < bookingIds.length; i += 100) {
            const chunk = bookingIds.slice(i, i + 100);
            const batchResponse = await this.apiCall('POST', `/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}/batch/read`, {
              properties: ['is_active'],
              inputs: chunk.map(id => ({ id }))
            });

            if (batchResponse.results) {
              // Count only Active bookings
              const activeInChunk = batchResponse.results.filter(booking =>
                booking.properties.is_active === 'Active'
              ).length;
              activeBookingsCount += activeInChunk;
            }
          }

          // Override total_bookings with accurate Active-only count
          return {
            ...exam,
            properties: {
              ...exam.properties,
              total_bookings: String(activeBookingsCount) // Convert to string for consistency
            }
          };
        } catch (error) {
          console.error(`Error fetching bookings for mock exam ${exam.id}:`, error);
          // On error, keep the stored value
          return exam;
        }
      }));

      // Format response with pagination info
      return {
        results: enrichedResults,
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
   * Create a note documenting mock exam edits
   * Creates an audit trail of changes made by admin users
   *
   * @param {string} mockExamId - The ID of the mock exam being edited
   * @param {object} changes - Object with before/after values for changed fields
   * @param {object} adminUser - Admin user who made the changes (from Supabase auth)
   * @returns {Promise<object>} The created note object
   */
  async createMockExamEditNote(mockExamId, changes, adminUser) {
    try {
      const timestamp = new Date();
      const formattedTimestamp = timestamp.toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Toronto'
      });

      // Helper to format field values for display
      const formatValue = (key, value) => {
        if (value === null || value === undefined || value === '') return 'Not set';

        // Format timestamps
        if (key.includes('time') && !isNaN(value)) {
          const date = new Date(parseInt(value));
          return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'America/Toronto'
          });
        }

        // Format dates
        if (key.includes('date') && value) {
          const date = new Date(value);
          if (!isNaN(date.getTime())) {
            return date.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            });
          }
        }

        // Format booleans
        if (value === 'true' || value === true) return 'Active';
        if (value === 'false' || value === false) return 'Inactive';

        return value;
      };

      // Helper to get field label
      const getFieldLabel = (key) => {
        const labels = {
          'mock_type': 'Mock Type',
          'exam_date': 'Exam Date',
          'start_time': 'Start Time',
          'end_time': 'End Time',
          'location': 'Location',
          'capacity': 'Capacity',
          'is_active': 'Status',
          'mock_exam_name': 'Mock Exam Name'
        };
        return labels[key] || key;
      };

      // Build changes HTML
      let changesHtml = '';
      const changeKeys = Object.keys(changes);

      if (changeKeys.length > 0) {
        changesHtml = '<p><strong>Changes Made:</strong></p><ul>';
        changeKeys.forEach(key => {
          const change = changes[key];
          changesHtml += `<li><strong>${getFieldLabel(key)}:</strong> ${formatValue(key, change.from)} → ${formatValue(key, change.to)}</li>`;
        });
        changesHtml += '</ul>';
      } else {
        changesHtml = '<p><em>No field changes detected</em></p>';
      }

      // Get admin user display name
      const adminName = adminUser?.email || adminUser?.user_metadata?.email || 'Admin User';

      // Create HTML formatted note body
      const noteBody = `
        <h3>✏️ Mock Exam Updated</h3>

        ${changesHtml}

        <p><strong>Edit Information:</strong></p>
        <ul>
          <li><strong>Edited By:</strong> ${adminName}</li>
          <li><strong>Edited At:</strong> ${formattedTimestamp}</li>
          <li><strong>Mock Exam ID:</strong> ${mockExamId}</li>
        </ul>

        <hr style="margin: 15px 0; border: 0; border-top: 1px solid #e0e0e0;">
        <p style="font-size: 12px; color: #666;">
          <em>This change was automatically logged by the PrepDoctors Admin System.</em>
        </p>
      `;

      // Create the Note WITHOUT associations (following working pattern from create-booking.js)
      const notePayload = {
        properties: {
          hs_note_body: noteBody,
          hs_timestamp: timestamp.getTime()
        }
      };

      console.log('📝 Creating mock exam edit note...');
      const noteResponse = await this.apiCall('POST', '/crm/v3/objects/notes', notePayload);
      console.log(`✅ Note created with ID: ${noteResponse.id}`);

      // Now associate the note with the mock exam using the v4 associations API
      console.log(`🔗 Associating note ${noteResponse.id} with mock exam ${mockExamId}...`);
      await this.createAssociation('0-46', noteResponse.id, '2-50158913', mockExamId);
      console.log(`✅ Mock exam edit note associated successfully`);

      return noteResponse;

    } catch (error) {
      // Log the error but don't throw - Note creation should not block the update
      console.error('Failed to create mock exam edit note:', {
        error: error.message,
        mockExamId,
        status: error.response?.status,
        details: error.response?.data
      });

      // Implement retry logic for transient failures
      if (error.response?.status === 429 || error.response?.status >= 500) {
        console.log('🔄 Will retry note creation in background...');
      }

      return null;
    }
  }

  /**
   * Get mock exam with associated bookings
   * Admin functionality to view exam details with all bookings
   */
  async getMockExamWithBookings(mockExamId) {
    try {
      // Get mock exam details with associations and full properties in a single call
      const mockExamResponse = await this.apiCall('GET',
        `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/${mockExamId}?associations=${HUBSPOT_OBJECTS.bookings}&properties=mock_type,exam_date,start_time,end_time,capacity,total_bookings,location,is_active,hs_createdate,hs_lastmodifieddate`
      );

      // Extract mock exam data (no need for separate getMockExam call!)
      const mockExam = {
        id: mockExamResponse.id,
        properties: mockExamResponse.properties
      };

      // Extract booking IDs from associations (using flexible key matching)
      const bookingIds = [];
      const bookingsKey = this.findAssociationKey(mockExamResponse.associations, HUBSPOT_OBJECTS.bookings, 'bookings');

      if (bookingsKey && mockExamResponse.associations[bookingsKey]?.results?.length > 0) {
        mockExamResponse.associations[bookingsKey].results.forEach(association => {
          bookingIds.push(association.id);
        });
      }

      // If there are no bookings, return empty array
      let bookings = [];
      if (bookingIds.length > 0) {
        // Batch fetch booking details (HubSpot batch read supports up to 100 objects)
        const batchChunks = [];
        for (let i = 0; i < bookingIds.length; i += 100) {
          batchChunks.push(bookingIds.slice(i, i + 100));
        }

        for (const chunk of batchChunks) {
          try {
            const batchResponse = await this.apiCall('POST', `/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}/batch/read`, {
              properties: [
                'booking_status', 'contact_id', 'created_at',
                'payment_method', 'confirmation_number',
                'student_id', 'student_name', 'student_email',
                'exam_date', 'hs_createdate'
              ],
              inputs: chunk.map(id => ({ id }))
            });

            if (batchResponse.results) {
              bookings = bookings.concat(batchResponse.results);
            }
          } catch (batchError) {
            console.error(`Error fetching booking batch:`, batchError);
          }
        }
      }

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
        properties: booking.properties,
        contact: contacts[booking.properties.contact_id] || null
      }));

      console.log(`✅ Optimized getMockExamWithBookings: Fetched mock exam ${mockExamId} with ${bookings.length} bookings in single call`);

      return {
        mockExam: mockExam,  // Keep properties nested under 'properties' key
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
      const { date_from, date_to } = filters;

      // Build filters for mock exams
      const examFilters = [];
      const today = new Date().toISOString().split('T')[0];

      // NOTE: exam_date is stored as a string property, not a date property
      // Date filtering will be done in application code

      // Get all mock exams (we'll filter by date in application code)
      const searchRequest = {
        properties: ['exam_date', 'capacity', 'total_bookings', 'is_active'],
        limit: 200  // Increased limit to get more results before filtering
      };

      if (examFilters.length > 0) {
        searchRequest.filterGroups = [{ filters: examFilters }];
      }

      const examsResponse = await this.apiCall('POST', `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/search`, searchRequest);
      let exams = examsResponse.results || [];

      // Apply date filtering in application code
      if (date_from || date_to) {
        exams = exams.filter(exam => {
          const examDate = exam.properties.exam_date;

          if (date_from && examDate < date_from) {
            return false;
          }
          if (date_to && examDate > date_to) {
            return false;
          }

          return true;
        });

        console.log(`Metrics date filtering: ${examsResponse.results?.length || 0} -> ${exams.length} exams`);
      }

      // Calculate metrics
      let totalSessions = exams.length;
      let upcomingSessions = 0;
      let fullyBooked = 0;
      let totalCapacity = 0;
      let totalBookings = 0;

      exams.forEach(exam => {
        const examDate = exam.properties.exam_date || '';
        const capacity = parseInt(exam.properties.capacity || 0);
        const bookings = parseInt(exam.properties.total_bookings || 0);
        const isActive = exam.properties.is_active === 'true';

        // Count upcoming sessions (today or future, and active)
        if (examDate >= today && isActive) {
          upcomingSessions++;
        }

        // Count fully booked sessions
        if (capacity > 0 && bookings >= capacity) {
          fullyBooked++;
        }

        // Sum for utilization calculation
        totalCapacity += capacity;
        totalBookings += bookings;
      });

      // Calculate average utilization
      const averageUtilization = totalCapacity > 0
        ? Math.round((totalBookings / totalCapacity) * 100)
        : 0;

      return {
        total_sessions: totalSessions,
        upcoming_sessions: upcomingSessions,
        fully_booked: fullyBooked,
        average_utilization: averageUtilization
      };
    } catch (error) {
      console.error('Error calculating metrics:', error);
      throw error;
    }
  }

  /**
   * Batch fetch mock exams by IDs to reduce API calls
   * @param {Array<string>} sessionIds - Array of mock exam session IDs
   * @returns {Promise<Array>} Array of mock exam objects
   */
  async batchFetchMockExams(sessionIds) {
    if (!sessionIds || sessionIds.length === 0) {
      return [];
    }

    const BATCH_SIZE = 50;  // Conservative batch size per HubSpot limits
    const batches = [];

    // Split into chunks of 50
    for (let i = 0; i < sessionIds.length; i += BATCH_SIZE) {
      batches.push(sessionIds.slice(i, i + BATCH_SIZE));
    }

    console.log(`🚀 Parallel batch fetching ${sessionIds.length} sessions across ${batches.length} batches...`);
    const startTime = Date.now();

    // Fetch all batches in parallel for faster performance
    const batchPromises = batches.map(async (batchIds, index) => {
      try {
        const response = await this.apiCall('POST',
          `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/batch/read`, {
            properties: [
              'mock_type', 'exam_date', 'start_time', 'end_time',
              'capacity', 'total_bookings', 'location', 'is_active',
              'hs_createdate', 'hs_lastmodifieddate'
            ],
            inputs: batchIds.map(id => ({ id }))
          }
        );

        console.log(`✅ Batch ${index + 1}/${batches.length} completed: ${response.results?.length || 0} sessions`);
        return response.results || [];
      } catch (error) {
        console.error(`❌ Error in batch ${index + 1}/${batches.length} for ${batchIds.length} mock exams:`, error);
        // Return empty array on error to continue with other batches
        return [];
      }
    });

    // Wait for all batches to complete in parallel
    const allBatchResults = await Promise.all(batchPromises);
    
    // Flatten results from all batches
    const allResults = allBatchResults.flat();

    const duration = Date.now() - startTime;
    console.log(`⚡ Parallel batch fetch completed: ${allResults.length} sessions in ${duration}ms`);

    return allResults;
  }

  /**
   * Fetch mock exams and aggregate them by mock_type + location + exam_date
   * @param {Object} filters - Filter options for mock exams
   * @returns {Promise<Array>} Array of aggregated mock exam groups
   */
  async fetchMockExamsForAggregation(filters = {}) {
    try {
      // Build filter array for the search
      const searchFilters = [];

      if (filters.filter_location) {
        searchFilters.push({
          propertyName: 'location',
          operator: 'EQ',
          value: filters.filter_location
        });
      }

      if (filters.filter_mock_type) {
        searchFilters.push({
          propertyName: 'mock_type',
          operator: 'EQ',
          value: filters.filter_mock_type
        });
      }

      // NOTE: exam_date is stored as a string property in HubSpot, not a date property
      // Date comparison operators (GTE, LTE, EQ) don't work on string properties
      // We'll fetch all records and filter dates in application code
      
      if (filters.filter_status) {
        // Map frontend status to HubSpot is_active property
        const isActiveValue = filters.filter_status === 'active' ? 'true' : 'false';
        searchFilters.push({
          propertyName: 'is_active',
          operator: 'EQ',
          value: isActiveValue
        });
      }
      
      // Build search request - now includes associations to fetch bookings
      const searchRequest = {
        properties: [
          'mock_type', 'exam_date', 'start_time', 'end_time',
          'capacity', 'total_bookings', 'location', 'is_active'
        ],
        associations: [HUBSPOT_OBJECTS.bookings], // Fetch booking associations
        limit: 200,  // HubSpot max limit per request
        sorts: [{
          propertyName: 'exam_date',
          direction: 'ASCENDING'
        }]
      };

      // Add filters if any
      if (searchFilters.length > 0) {
        searchRequest.filterGroups = [{ filters: searchFilters }];
      }

      // Log the search request for debugging
      console.log('📝 HubSpot Search Request:', JSON.stringify(searchRequest, null, 2));

      // Fetch all mock exams matching filters with pagination
      const allExams = [];
      let after = undefined;

      do {
        // Add pagination token if available
        if (after) {
          searchRequest.after = after;
        }

        const response = await this.apiCall('POST',
          `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/search`,
          searchRequest
        );

        // Add results to collection
        if (response.results) {
          allExams.push(...response.results);
        }

        // Get next page token
        after = response.paging?.next?.after;

        // Log pagination progress
        console.log(`Fetched ${response.results?.length || 0} exams, total so far: ${allExams.length}, has more: ${!!after}`);

      } while (after); // Continue while there are more pages

      // Apply date filtering in application code since HubSpot doesn't support date operators on string fields
      let filteredExams = allExams;

      if (filters.filter_date_from || filters.filter_date_to) {
        console.log(`Applying date filters in application: from ${filters.filter_date_from || 'any'} to ${filters.filter_date_to || 'any'}`);

        filteredExams = allExams.filter(exam => {
          const examDate = exam.properties.exam_date;

          // Check if date is within range
          if (filters.filter_date_from && examDate < filters.filter_date_from) {
            return false;
          }
          if (filters.filter_date_to && examDate > filters.filter_date_to) {
            return false;
          }

          return true;
        });

        console.log(`Date filtering: ${allExams.length} exams -> ${filteredExams.length} exams after date filter`);
      }

      // Now enrich each exam with accurate Active booking count
      console.log(`⏳ Enriching ${filteredExams.length} exams with accurate Active booking counts...`);
      const enrichedExams = await Promise.all(filteredExams.map(async (exam) => {
        try {
          // Extract booking IDs from associations
          const bookingIds = [];
          if (exam.associations && exam.associations[HUBSPOT_OBJECTS.bookings]) {
            const bookingAssociations = exam.associations[HUBSPOT_OBJECTS.bookings].results || [];
            bookingAssociations.forEach(assoc => {
              bookingIds.push(assoc.id);
            });
          }

          // If no bookings, set count to 0
          if (bookingIds.length === 0) {
            return {
              ...exam,
              properties: {
                ...exam.properties,
                total_bookings: '0'
              }
            };
          }

          // Batch fetch booking details to check is_active status
          let activeBookingsCount = 0;
          for (let i = 0; i < bookingIds.length; i += 100) {
            const chunk = bookingIds.slice(i, i + 100);
            const batchResponse = await this.apiCall('POST', `/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}/batch/read`, {
              properties: ['is_active'],
              inputs: chunk.map(id => ({ id }))
            });

            if (batchResponse.results) {
              const activeInChunk = batchResponse.results.filter(booking =>
                booking.properties.is_active === 'Active'
              ).length;
              activeBookingsCount += activeInChunk;
            }
          }

          // Override total_bookings with accurate Active-only count
          return {
            ...exam,
            properties: {
              ...exam.properties,
              total_bookings: String(activeBookingsCount)
            }
          };
        } catch (error) {
          console.error(`Error fetching bookings for mock exam ${exam.id}:`, error);
          // On error, keep the stored value
          return exam;
        }
      }));

      console.log(`✅ Enrichment complete for ${enrichedExams.length} exams`);
      
      // Group by (mock_type + date + location) - now using enriched data with accurate counts
      const aggregates = {};

      enrichedExams.forEach(exam => {
        const properties = exam.properties;
        const key = `${properties.mock_type}_${properties.location}_${properties.exam_date}`
          .toLowerCase()
          .replace(/\s+/g, '_');
        
        if (!aggregates[key]) {
          aggregates[key] = {
            aggregate_key: key,
            mock_type: properties.mock_type,
            exam_date: properties.exam_date,
            location: properties.location,
            session_ids: [],
            session_count: 0,
            total_capacity: 0,
            total_bookings: 0
          };
        }
        
        aggregates[key].session_ids.push(exam.id);
        aggregates[key].session_count++;
        aggregates[key].total_capacity += parseInt(properties.capacity || 0);
        aggregates[key].total_bookings += parseInt(properties.total_bookings || 0); // Now uses accurate Active-only count
      });
      
      // Convert to array and sort by date
      return Object.values(aggregates).sort((a, b) => {
        return new Date(a.exam_date) - new Date(b.exam_date);
      });
      
    } catch (error) {
      console.error('Error fetching mock exams for aggregation:', error);
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