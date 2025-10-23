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
    const response = await api.get('/admin/mock-exams/get', { params: { id } });
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

export default api;