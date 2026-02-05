/**
 * Admin API Service
 * Handles all API calls for admin operations
 */

import axios from 'axios';

// Configure base URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

/**
 * Custom params serializer to handle arrays correctly for Express/Vercel
 * Converts arrays like ['a', 'b'] to 'a,b' format which is easier to parse
 */
function paramsSerializer(params) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      // Serialize arrays as comma-separated values
      searchParams.append(key, value.join(','));
    } else {
      searchParams.append(key, value);
    }
  }
  return searchParams.toString();
}

// Create axios instance with defaults
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  paramsSerializer
});

// Add request interceptor to include auth token
api.interceptors.request.use(
  (config) => {
    // Get token from localStorage (set by AuthContext)
    const token = localStorage.getItem('access_token');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Log errors that aren't handled by AuthContext (non-401 errors)
    if (error.response?.status !== 401 && !error.config?._retry) {
      console.error('❌ API Error:', {
        url: error.config?.url,
        method: error.config?.method?.toUpperCase(),
        status: error.response?.status,
        message: error.response?.data?.message || error.message
      });
    }

    if (error.response) {
      // Server responded with error status
      const errorData = error.response.data;
      const message = errorData?.error?.message || errorData?.message || 'An error occurred';

      throw new Error(message);
    } else if (error.request) {
      // Request made but no response
      throw new Error('No response from server. Please check your connection.');
    } else {
      // Error setting up request
      throw new Error(error.message || 'Request failed');
    }
  }
);

/**
 * Mock Exam API endpoints
 */
export const mockExamsApi = {
  /**
   * Create a single mock exam
   * @param {Object} mockExamData - Mock exam properties
   * @returns {Promise<Object>} Created mock exam
   */
  createSingle: async (mockExamData) => {
    const response = await api.post('/admin/mock-exams/create', mockExamData);
    return response.data;
  },

  /**
   * Create multiple mock exams with different time slots
   * @param {Object} commonProperties - Properties shared across all exams
   * @param {Array} timeSlots - Array of {start_time, end_time, capacity?} objects
   * @param {string} capacityMode - Either 'global' or 'per-slot'
   * @returns {Promise<Object>} Bulk creation results
   */
  createBulk: async (commonProperties, timeSlots, capacityMode = 'global') => {
    const response = await api.post('/admin/mock-exams/bulk-create', {
      commonProperties,
      timeSlots,
      capacityMode
    });
    return response.data;
  },

  /**
   * List mock exams with pagination, filtering, and sorting
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Paginated mock exams
   */
  list: async (params = {}) => {
    const response = await api.get('/admin/mock-exams/list', { params });
    return response.data;
  },

  /**
   * Get dashboard metrics
   * @param {Object} params - Optional date range filters
   * @returns {Promise<Object>} Dashboard metrics
   */
  getMetrics: async (params = {}) => {
    const response = await api.get('/admin/mock-exams/metrics', { params });
    return response.data;
  },

  /**
   * Get single mock exam with details
   * @param {string} id - Mock exam ID
   * @returns {Promise<Object>} Mock exam details with bookings
   */
  getById: async (id) => {
    const response = await api.get(`/admin/mock-exams/${id}`);
    return response.data;
  },

  /**
   * Get bookings for a specific mock exam
   * @param {string} id - Mock exam ID
   * @param {Object} params - Query parameters for filtering, sorting, pagination
   * @returns {Promise<Object>} Bookings with pagination metadata
   */
  getBookings: async (id, params = {}) => {
    const response = await api.get(`/admin/mock-exams/${id}/bookings`, { params });
    return response.data;
  },

  /**
   * Update a mock exam
   * @param {string} id - Mock exam ID
   * @param {Object} updateData - Properties to update
   * @returns {Promise<Object>} Updated mock exam
   */
  update: async (id, updateData) => {
    const response = await api.patch('/admin/mock-exams/update', updateData, { params: { id } });
    return response.data;
  },

  /**
   * Delete a mock exam
   * @param {string} id - Mock exam ID
   * @returns {Promise<Object>} Deletion result
   */
  delete: async (id) => {
    const response = await api.delete('/admin/mock-exams/delete', { params: { id } });
    return response.data;
  },

  /**
   * Get aggregated mock exams
   * @param {Object} filters - Optional filters
   * @returns {Promise<Object>} Aggregated mock exams
   */
  getAggregates: async (filters = {}) => {
    const response = await api.get('/admin/mock-exams/aggregates', { params: filters });
    return response.data;
  },

  /**
   * Get sessions for a specific aggregate
   * @param {string} aggregateKey - The aggregate key to get sessions for
   * @returns {Promise<Object>} Sessions for the aggregate
   */
  getAggregateSessions: async (aggregateKey) => {
    const response = await api.get(`/admin/mock-exams/aggregates/${aggregateKey}/sessions`);
    return response.data;
  },

  /**
   * Cancel multiple bookings for a mock exam with optional token refund
   * @param {string} id - Mock exam ID
   * @param {Object} requestBody - Request body with bookings array and refundTokens flag
   * @returns {Promise<Object>} Cancellation results
   */
  cancelBookings: async (id, requestBody) => {
    const response = await api.patch(`/admin/mock-exams/${id}/cancel-bookings`, requestBody);
    return response.data;
  },

  /**
   * Update prerequisite exams for a Mock Discussion
   * @param {string} id - Mock exam ID (must be Mock Discussion type)
   * @param {Array} prerequisiteIds - Array of prerequisite exam IDs
   * @returns {Promise<Object>} Update result with associated exams
   */
  updatePrerequisites: async (id, prerequisiteIds) => {
    const response = await api.post(`/admin/mock-exams/${id}/prerequisites`, {
      prerequisite_exam_ids: prerequisiteIds
    });
    return response.data;
  },

  /**
   * Get prerequisite exams for a Mock Discussion
   * @param {string} id - Mock exam ID
   * @returns {Promise<Object>} List of prerequisite exams
   */
  getPrerequisites: async (id) => {
    const response = await api.get(`/admin/mock-exams/${id}/prerequisites`);
    return response.data;
  },

  /**
   * Remove a prerequisite association from a Mock Discussion
   * @param {string} id - Mock exam ID
   * @param {string} prerequisiteId - Prerequisite exam ID to remove
   * @returns {Promise<Object>} Removal result
   */
  removePrerequisite: async (id, prerequisiteId) => {
    const response = await api.delete(`/admin/mock-exams/${id}/prerequisites/${prerequisiteId}`);
    return response.data;
  },

  /**
   * Get prerequisite exams for a mock exam (alias for getPrerequisites)
   * @param {string} examId - Mock exam ID
   * @returns {Promise<Object>} List of prerequisite exams
   */
  getExamPrerequisites: async (examId) => {
    const response = await api.get(`/admin/mock-exams/${examId}/prerequisites`);
    return response.data;
  },

  /**
   * Update prerequisites using delta (add/remove) operations
   * @param {string} examId - Mock exam ID
   * @param {Array<string>} addIds - Array of prerequisite exam IDs to add
   * @param {Array<string>} removeIds - Array of prerequisite exam IDs to remove
   * @returns {Promise<Object>} Update result with current prerequisites
   */
  updatePrerequisitesDelta: async (examId, addIds = [], removeIds = []) => {
    const response = await api.patch(`/admin/mock-exams/${examId}/prerequisites/delta`, {
      add_prerequisites: addIds,
      remove_prerequisites: removeIds
    });
    return response.data;
  },

  /**
   * Get available exams that can be used as prerequisites (SJ/CS types before a date)
   * @param {string} beforeDate - ISO date string; only exams before this date are returned
   * @returns {Promise<Object>} List of eligible prerequisite exams
   */
  getAvailablePrerequisiteExams: async (beforeDate) => {
    const response = await api.get('/admin/mock-exams/list', {
      params: {
        filter_mock_type: ['Clinical Skills', 'Situational Judgment'],
        filter_date_to: beforeDate,
        filter_status: 'active',
        limit: 100,
        sort_by: 'exam_date',
        sort_order: 'desc'
      }
    });
    return response.data;
  },

  /**
   * Create a booking on behalf of a trainee (admin-authenticated)
   * @param {Object} bookingData - Booking creation data
   * @returns {Promise<Object>} Created booking result
   */
  createBookingFromExam: async (bookingData) => {
    if (!bookingData || !bookingData.mock_exam_id || !bookingData.student_id || !bookingData.email) {
      throw new Error('Mock exam ID, student ID, and email are required');
    }
    const response = await api.post('/admin/bookings/create', bookingData);
    return response.data;
  }
};
/**
 * Trainee API endpoints
 * For searching trainees and fetching their booking history
 */
export const traineeApi = {
  /**
   * Search for trainees by name, email, or student ID
   * @param {string} query - Search query string
   * @returns {Promise<Object>} Search results with trainee data
   */
  search: async (query) => {
    if (!query || query.trim().length === 0) {
      return { success: true, data: null };
    }
    const response = await api.get('/admin/trainees/search', {
      params: { query }
    });
    return response.data;
  },

  /**
   * Get bookings for a specific trainee
   * @param {string} contactId - HubSpot contact ID
   * @returns {Promise<Object>} Bookings data with summary
   */
  getBookings: async (contactId) => {
    if (!contactId) {
      throw new Error('Contact ID is required');
    }
    const response = await api.get(`/admin/trainees/${contactId}/bookings`, {
      params: { include_inactive: true }
    });
    return response.data;
  },

  /**
   * Batch cancel multiple bookings (admin-authenticated)
   * @param {Array} bookings - Array of booking objects with id, student_id, email, reason
   * @returns {Promise<Object>} Cancellation results
   */
  /**
   * Update token balances for a specific trainee
   * @param {string} contactId - HubSpot contact ID
   * @param {Object} tokens - Token balances to update
   * @returns {Promise<Object>} Update result with new token values
   */
  updateTokens: async (contactId, tokens) => {
    if (!contactId) {
      throw new Error('Contact ID is required');
    }
    if (!tokens) {
      throw new Error('Token data is required');
    }

    // Note: Authentication token is automatically added by axios interceptor
    const response = await api.patch(
      `/admin/trainees/${contactId}/tokens`,
      { tokens }
    );

    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Failed to update tokens');
    }

    return response.data;
  },

  batchCancelBookings: async (bookings, refundTokens = true) => {
    if (!bookings || bookings.length === 0) {
      throw new Error('Bookings array is required');
    }
    const response = await api.post('/bookings/batch-cancel', {
      bookings,
      refundTokens
    });
    return response.data;
  },

  /**
   * Get available exams for rebooking
   * Reads from Supabase - no HubSpot fallback
   * Location and mock_type are passed from the original booking
   *
   * @param {string} mockType - Filter by mock type (from original booking)
   * @param {string} location - Filter by location (from original booking)
   * @param {string} excludeExamId - Exclude current exam from results (optional)
   * @returns {Promise<Object>} Response with exams array
   */
  getAvailableExamsForRebook: async (mockType, location, excludeExamId = null) => {
    if (!mockType) {
      throw new Error('Mock type is required');
    }
    if (!location) {
      throw new Error('Location is required');
    }
    const params = new URLSearchParams({
      mock_type: mockType,
      location: location
    });
    if (excludeExamId) {
      params.append('exclude_exam_id', excludeExamId);
    }

    const response = await api.get(
      `/admin/mock-exams/available-for-rebook?${params}`
    );
    return response.data.data;
  },

  /**
   * Rebook a booking to a different exam session
   * Writes to Supabase first, then syncs to HubSpot if hubspot_id exists
   *
   * @param {string} bookingId - Booking UUID or HubSpot ID
   * @param {string} newMockExamId - Target exam HubSpot ID
   * @returns {Promise<Object>} Response with updated booking data
   */
  rebookBooking: async (bookingId, newMockExamId) => {
    if (!bookingId) {
      throw new Error('Booking ID is required');
    }
    if (!newMockExamId) {
      throw new Error('New mock exam ID is required');
    }
    const response = await api.patch('/bookings/rebook', {
      booking_id: bookingId,
      new_mock_exam_id: newMockExamId
    });
    return response.data.data;
  }
};

/**
 * Auth API endpoints (for validation, etc.)
 */
export const authApi = {
  /**
   * Validate admin session
   * @returns {Promise<Object>} Validation result
   */
  validate: async () => {
    const response = await api.get('/admin/auth/validate');
    return response.data;
  },

  /**
   * Get current user details
   * @returns {Promise<Object>} User details
   */
  me: async () => {
    const response = await api.get('/admin/auth/me');
    return response.data;
  }
};

/**
 * Bulk Mock Exams API endpoints
 */
export const bulkMockExamsApi = {
  /**
   * Preview/validate bulk mock exams from CSV data without creating them
   * @param {string} csvData - CSV string with required columns
   * @returns {Promise<Object>} Validation result with valid_rows and invalid_rows
   */
  previewFromCSV: async (csvData) => {
    const response = await api.post('/admin/mock-exams/bulk-create-csv?preview=true', { csv_data: csvData });
    return response.data;
  },

  /**
   * Create multiple mock exams from CSV data
   * @param {string} csvData - CSV string with required columns
   * @returns {Promise<Object>} Result with created exams and skipped rows
   */
  createFromCSV: async (csvData) => {
    const response = await api.post('/admin/mock-exams/bulk-create-csv', { csv_data: csvData });
    return response.data;
  }
};

/**
 * Bulk Bookings API endpoints
 */
export const bulkBookingsApi = {
  /**
   * Preview/validate bulk bookings from CSV data without creating them
   * @param {string} csvData - CSV string with student_id, mock_exam_id, token_used columns
   * @returns {Promise<Object>} Validation result with valid_rows and invalid_rows
   */
  previewFromCSV: async (csvData) => {
    const response = await api.post('/admin/bookings/bulk-create?preview=true', { csv_data: csvData });
    return response.data;
  },

  /**
   * Create multiple bookings from CSV data
   * @param {string} csvData - CSV string with student_id, mock_exam_id, token_used columns
   * @returns {Promise<Object>} Result with created bookings and skipped rows
   */
  createFromCSV: async (csvData) => {
    const response = await api.post('/admin/bookings/bulk-create', { csv_data: csvData });
    return response.data;
  }
};

/**
 * Groups API endpoints
 * For Workcheck Group Management
 */
export const groupsApi = {
  /**
   * List groups with pagination, filtering, and sorting
   * @param {Object} params - Query parameters (page, limit, sort_by, sort_order, filter_status, search)
   * @returns {Promise<Object>} Paginated groups
   */
  list: async (params = {}) => {
    const response = await api.get('/admin/groups/list', { params });
    return response.data;
  },

  /**
   * Create a new group
   * @param {Object} data - Group data (groupName, description, timePeriod, startDate, endDate, maxCapacity)
   * @returns {Promise<Object>} Created group
   */
  create: async (data) => {
    const response = await api.post('/admin/groups/create', data);
    return response.data;
  },

  /**
   * Get single group with details and students
   * @param {string} id - Group ID (group_id or UUID)
   * @returns {Promise<Object>} Group details with students
   */
  getById: async (id) => {
    const response = await api.get(`/admin/groups/${id}`);
    return response.data;
  },

  /**
   * Update a group
   * @param {string} id - Group ID (group_id or UUID)
   * @param {Object} data - Update data
   * @returns {Promise<Object>} Updated group
   */
  update: async (id, data) => {
    const response = await api.put(`/admin/groups/${id}`, data);
    return response.data;
  },

  /**
   * Delete a group
   * @param {string} id - Group ID (group_id or UUID)
   * @returns {Promise<Object>} Deletion confirmation
   */
  delete: async (id) => {
    const response = await api.delete(`/admin/groups/${id}`);
    return response.data;
  },

  /**
   * Get group statistics
   * @returns {Promise<Object>} Statistics (total, active, totalStudents, averageSize)
   */
  getStatistics: async () => {
    const response = await api.get('/admin/groups/statistics');
    return response.data;
  },

  /**
   * Assign a student to a group
   * @param {Object} data - { groupId, contactId }
   * @returns {Promise<Object>} Assignment result
   */
  assignStudent: async (data) => {
    const response = await api.post('/admin/groups/assign-student', data);
    return response.data;
  },

  /**
   * Bulk assign students to a group
   * @param {Object} data - { groupId, contactIds }
   * @returns {Promise<Object>} Bulk assignment result
   */
  bulkAssignStudents: async (data) => {
    const response = await api.post('/admin/groups/bulk-assign-students', data);
    return response.data;
  },

  /**
   * Remove a student from a group
   * @param {string} groupId - Group ID
   * @param {string} studentId - Contact ID or assignment ID
   * @returns {Promise<Object>} Removal confirmation
   */
  removeStudent: async (groupId, studentId) => {
    const response = await api.delete(`/admin/groups/${groupId}/students/${studentId}`);
    return response.data;
  },

  /**
   * Clone a group
   * @param {string} id - Source group ID
   * @param {Object} data - Clone data (groupName, timePeriod, startDate, endDate, maxCapacity, includeStudents)
   * @returns {Promise<Object>} Cloned group
   */
  clone: async (id, data) => {
    const response = await api.post(`/admin/groups/${id}/clone`, data);
    return response.data;
  },

  /**
   * Assign an instructor to a group
   * @param {Object} data - { groupId, instructorId }
   * @returns {Promise<Object>} Assignment result
   */
  assignInstructor: async (data) => {
    const response = await api.post('/admin/groups/assign-instructor', data);
    return response.data;
  },

  /**
   * Remove an instructor from a group
   * @param {string} groupId - Group ID
   * @param {string} instructorId - Instructor ID or assignment ID
   * @returns {Promise<Object>} Removal confirmation
   */
  removeInstructor: async (groupId, instructorId) => {
    const response = await api.delete(`/admin/groups/${groupId}/instructors/${instructorId}`);
    return response.data;
  },

  /**
   * Bulk toggle status for multiple groups
   * @param {Array<string>} ids - Array of group IDs (group_id, not UUID)
   * @returns {Promise<Object>} Result with summary and details
   */
  bulkToggleStatus: async (ids) => {
    const response = await api.post('/admin/groups/bulk-toggle-status', { ids });
    return response.data;
  },

  /**
   * Bulk delete multiple groups
   * @param {Array<string>} ids - Array of group IDs (group_id, not UUID)
   * @returns {Promise<Object>} Result with deleted and blocked counts
   */
  bulkDelete: async (ids) => {
    const response = await api.post('/admin/groups/bulk-delete', { ids });
    return response.data;
  }
};

/**
 * Instructor API endpoints
 */
export const instructorsApi = {
  /**
   * List instructors with pagination and filtering
   */
  list: async (params = {}) => {
    const response = await api.get('/admin/instructors/list', { params });
    return response.data;
  },

  /**
   * Get single instructor by ID
   */
  getById: async (id) => {
    const response = await api.get(`/admin/instructors/${id}`);
    return response.data;
  },

  /**
   * Create a new instructor
   */
  create: async (data) => {
    const response = await api.post('/admin/instructors/create', data);
    return response.data;
  },

  /**
   * Update an instructor
   */
  update: async (id, data) => {
    const response = await api.put(`/admin/instructors/${id}`, data);
    return response.data;
  },

  /**
   * Delete (deactivate) an instructor
   */
  delete: async (id) => {
    const response = await api.delete(`/admin/instructors/${id}`);
    return response.data;
  },

  /**
   * Get instructors for dropdown (active only, minimal fields)
   */
  getDropdown: async () => {
    const response = await api.get('/admin/instructors/dropdown');
    return response.data;
  },

  /**
   * Bulk toggle status for multiple instructors
   * @param {Array<string>} ids - Array of instructor IDs to toggle
   * @returns {Promise<Object>} Toggle result with updated instructors
   */
  bulkToggleStatus: async (ids) => {
    const response = await api.post('/admin/instructors/bulk-toggle-status', { ids });
    return response.data;
  },

  /**
   * Clone an instructor with a new email suffix
   * @param {string} id - Source instructor ID
   * @param {Object} data - Clone data (instructorName, emailSuffix, isActive)
   * @returns {Promise<Object>} Cloned instructor data
   */
  clone: async (id, data) => {
    const response = await api.post(`/admin/instructors/${id}/clone`, data);
    return response.data;
  },

  /**
   * Bulk delete multiple instructors
   * @param {Array<string>} ids - Array of instructor IDs (UUIDs)
   * @returns {Promise<Object>} Result with deleted and blocked counts
   */
  bulkDelete: async (ids) => {
    const response = await api.post('/admin/instructors/bulk-delete', { ids });
    return response.data;
  }
};

/**
 * Work Check Slots API endpoints
 * For managing instructor time slots
 */
export const workCheckSlotsApi = {
  /**
   * List slots with pagination, filtering, and sorting
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Paginated slots
   */
  list: async (params = {}) => {
    const response = await api.get('/admin/work-check-slots/list', { params });
    return response.data;
  },

  /**
   * Get a single slot by ID
   * @param {string} id - Slot ID (UUID)
   * @returns {Promise<Object>} Slot data
   */
  get: async (id) => {
    const response = await api.get(`/admin/work-check-slots/${id}`);
    return response.data;
  },

  /**
   * Create a new slot
   * @param {Object} data - Slot data
   * @returns {Promise<Object>} Created slot
   */
  create: async (data) => {
    const response = await api.post('/admin/work-check-slots/create', data);
    return response.data;
  },

  /**
   * Update a slot
   * @param {string} id - Slot ID
   * @param {Object} data - Update data
   * @returns {Promise<Object>} Updated slot
   */
  update: async (id, data) => {
    const response = await api.put(`/admin/work-check-slots/${id}`, data);
    return response.data;
  },

  /**
   * Delete a slot
   * @param {string} id - Slot ID
   * @returns {Promise<Object>} Delete result
   */
  delete: async (id) => {
    const response = await api.delete(`/admin/work-check-slots/${id}`);
    return response.data;
  },

  /**
   * Bulk toggle status for multiple slots
   * @param {Array<string>} ids - Array of slot IDs
   * @param {string} action - 'toggle', 'activate', or 'deactivate'
   * @returns {Promise<Object>} Toggle result
   */
  bulkToggle: async (ids, action = 'toggle') => {
    const response = await api.post('/admin/work-check-slots/bulk-toggle', { ids, action });
    return response.data;
  },

  /**
   * Bulk delete multiple slots
   * @param {Array<string>} ids - Array of slot IDs
   * @returns {Promise<Object>} Delete result with blocked details
   */
  bulkDelete: async (ids) => {
    const response = await api.post('/admin/work-check-slots/bulk-delete', { ids });
    return response.data;
  },

  /**
   * Clone slots to different instructor/groups/dates
   * @param {Object} data - Clone configuration
   * @returns {Promise<Object>} Clone result
   */
  clone: async (data) => {
    const response = await api.post('/admin/work-check-slots/clone', data);
    return response.data;
  },

  /**
   * Bulk edit multiple slots
   * @param {Array<string>} ids - Array of slot IDs
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Edit result
   */
  bulkEdit: async (ids, updates) => {
    const response = await api.post('/admin/work-check-slots/bulk-edit', { ids, updates });
    return response.data;
  }
};

/**
 * Work Check Bookings API endpoints
 * For managing work check booking records
 */
export const workCheckBookingsApi = {
  /**
   * List booking aggregates grouped by date/time/location
   * @param {Object} params - Query parameters (page, limit, location, date_from, date_to, status, type, instructor_id)
   * @returns {Promise<Object>} Paginated aggregates with preloaded bookings
   */
  getAggregates: async (params = {}) => {
    const response = await api.get('/admin/work-check-bookings/aggregates', { params });
    return response.data;
  },

  /**
   * List bookings (flat view) with pagination, filtering, and sorting
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Paginated bookings
   */
  list: async (params = {}) => {
    const response = await api.get('/admin/work-check-bookings/list', { params });
    return response.data;
  },

  /**
   * Get a single booking by ID
   * @param {string} id - Booking ID (UUID)
   * @returns {Promise<Object>} Booking data
   */
  get: async (id) => {
    const response = await api.get(`/admin/work-check-bookings/${id}`);
    return response.data;
  },

  /**
   * Update a booking
   * @param {string} id - Booking ID
   * @param {Object} data - Update data (status, type)
   * @returns {Promise<Object>} Updated booking
   */
  update: async (id, data) => {
    const response = await api.put(`/admin/work-check-bookings/${id}`, data);
    return response.data;
  },

  /**
   * Delete a booking
   * @param {string} id - Booking ID
   * @returns {Promise<Object>} Delete result
   */
  delete: async (id) => {
    const response = await api.delete(`/admin/work-check-bookings/${id}`);
    return response.data;
  },

  /**
   * Bulk toggle status for multiple bookings
   * @param {Array<string>} ids - Array of booking IDs
   * @param {string} targetStatus - 'pending', 'confirmed', 'rejected', 'cancelled'
   * @returns {Promise<Object>} Toggle result
   */
  bulkToggle: async (ids, targetStatus) => {
    const response = await api.post('/admin/work-check-bookings/bulk-toggle', {
      ids,
      target_status: targetStatus
    });
    return response.data;
  },

  /**
   * Bulk delete multiple bookings
   * @param {Array<string>} ids - Array of booking IDs
   * @returns {Promise<Object>} Delete result
   */
  bulkDelete: async (ids) => {
    const response = await api.post('/admin/work-check-bookings/bulk-delete', { ids });
    return response.data;
  },

  /**
   * Clone bookings to new target slots
   * @param {Object} data - Clone configuration { ids, target_slot_ids, preserve_status, preserve_type }
   * @returns {Promise<Object>} Clone result
   */
  clone: async (data) => {
    const response = await api.post('/admin/work-check-bookings/clone', data);
    return response.data;
  }
};

// Export the axios instance as adminApi for direct use in hooks
export const adminApi = api;

export default api;