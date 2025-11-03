/**
 * Admin API Service
 * Handles all API calls for admin operations
 */

import axios from 'axios';

// Configure base URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// Create axios instance with defaults
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
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
   * @param {Array} timeSlots - Array of {start_time, end_time} objects
   * @returns {Promise<Object>} Bulk creation results
   */
  createBulk: async (commonProperties, timeSlots) => {
    const response = await api.post('/admin/mock-exams/bulk-create', {
      commonProperties,
      timeSlots
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
   * Cancel multiple bookings for a mock exam
   * @param {string} id - Mock exam ID
   * @param {Array<string>} bookingIds - Array of booking IDs to cancel
   * @returns {Promise<Object>} Cancellation results
   */
  cancelBookings: async (id, bookingIds) => {
    const response = await api.patch(`/admin/mock-exams/${id}/cancel-bookings`, {
      bookingIds
    });
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