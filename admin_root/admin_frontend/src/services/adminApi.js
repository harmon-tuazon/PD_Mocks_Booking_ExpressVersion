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
        mock_type: ['Clinical Skills', 'Situational Judgment'],
        exam_date_before: beforeDate,
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

  batchCancelBookings: async (bookings) => {
    if (!bookings || bookings.length === 0) {
      throw new Error('Bookings array is required');
    }
    const response = await api.post('/bookings/batch-cancel', {
      bookings
    });
    return response.data;
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

// Export the axios instance as adminApi for direct use in hooks
export const adminApi = api;

export default api;