import axios from 'axios';

const BASE_URL = '/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  async (config) => {
    // Add any auth tokens if needed
    const token = localStorage.getItem('sessionToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response.data;
  },
  async (error) => {
    // 🔍 DEBUG: Log raw error from axios
    console.log('🔍 [Axios Interceptor] Raw error received:', {
      'error.response?.status': error.response?.status,
      'error.response?.data': error.response?.data,
      'error.message': error.message
    });

    // Handle common errors
    if (error.response) {
      const { status, data } = error.response;

      // 🔍 DEBUG: Log response data structure
      console.log('🔍 [Axios Interceptor] Response data structure:', {
        'data.error': data.error,
        'data.code': data.code,
        'data.success': data.success,
        'data keys': Object.keys(data)
      });

      // Authentication errors
      if (status === 401) {
        error.message = 'Authentication required. Please check your connection.';
      }
      // Rate limiting
      else if (status === 429) {
        const retryAfter = data.retryAfter || 60;
        error.message = `Too many requests. Please try again in ${retryAfter} seconds.`;
      }
      // Not found
      else if (status === 404) {
        error.message = data.error || 'Resource not found';
      }
      // Validation errors
      else if (status === 400 && data.validationErrors) {
        error.message = data.validationErrors.join(', ');
      }
      // Server error
      else if (status >= 500) {
        error.message = 'Server error. Please try again later.';
      }
      // Use server error message
      else if (data.error) {
        error.message = data.error;
      }

      // Add error code if available
      if (data.code) {
        error.code = data.code;
        console.log('🔍 [Axios Interceptor] Set error.code =', error.code, 'from data.code =', data.code);
      }
    } else if (error.request) {
      error.message = 'Network error. Please check your connection.';
    }

    // 🔍 DEBUG: Log final error object being passed to caller
    console.log('🔍 [Axios Interceptor] Final error object:', {
      'error.code': error.code,
      'error.message': error.message,
      'has code': !!error.code
    });

    return Promise.reject(error);
  }
);

// Standalone API functions
export const validateUserCredentials = async (studentId, email) => {
  return api.post('/mock-exams/validate-credits', {
    student_id: studentId,
    email: email,
    mock_type: 'Situational Judgment', // Default type for user validation
  });
};

// API service methods
const apiService = {
  // Mock Exams
  mockExams: {
    /**
     * Get available mock exams by type
     */
    getAvailable: async (mockType, includeCapacity = true) => {
      return api.get('/mock-exams/available', {
        params: {
          mock_type: mockType,
          include_capacity: includeCapacity,
          realtime: true, // Always use real-time capacity calculation for accurate availability
        },
      });
    },

    /**
     * Validate user credits for booking
     */
    validateCredits: async (studentId, email, mockType) => {
      return api.post('/mock-exams/validate-credits', {
        student_id: studentId,
        email: email,
        mock_type: mockType,
      });
    },
  },

  /**
   * Mock Discussions API endpoints
   */
  mockDiscussions: {
    /**
     * Get available mock discussion sessions
     */
    getAvailable: async (includeCapacity = true) => {
      return api.get('/mock-discussions/available', {
        params: {
          include_capacity: includeCapacity,
          realtime: true, // Always use real-time capacity calculation
        },
      });
    },

    /**
     * Validate user credits for discussion booking
     */
    validateCredits: async (studentId, email) => {
      return api.post('/mock-discussions/validate-credits', {
        student_id: studentId,
        email: email,
      });
    },

    /**
     * Create a discussion booking
     */
    createBooking: async (data) => {
      return api.post('/mock-discussions/create-booking', data);
    },
  },

  // Bookings
  bookings: {
    /**
     * Get list of bookings for a user
     */
    list: async (params = {}) => {
      return api.get('/bookings/list', {
        params: {
          student_id: params.student_id,
          email: params.email,
          filter: params.filter, // Changed from 'status' to 'filter' to match API expectation
          search: params.search,
          page: params.page || 1,
          limit: params.limit || 20,
          force: params.force ? 'true' : undefined, // Cache-busting parameter
          _t: params.force ? Date.now() : undefined // Additional cache-busting timestamp
        }
      });
    },

    /**
     * Create a new booking
     */
    create: async (bookingData) => {
      return api.post('/bookings/create', bookingData);
    },

    /**
     * Cancel a booking
     * @param {string} bookingId - The HubSpot booking object ID
     * @param {object} cancelData - Cancellation data including student_id, email, and optional reason
     */
    cancelBooking: async (bookingId, cancelData = {}) => {
      console.log('🔍 [API DEBUG] Cancel booking called:', {
        bookingId,
        bookingIdType: typeof bookingId,
        cancelData
      });

      // Extract user data from localStorage if not provided
      const userData = JSON.parse(localStorage.getItem('userData') || '{}');

      const requestData = {
        student_id: cancelData.student_id || userData.student_id,
        email: cancelData.email || userData.email,
        reason: cancelData.reason || 'User requested cancellation'
      };

      console.log('🔍 [API DEBUG] Making DELETE request to:', `/bookings/${bookingId}`, 'with data:', requestData);

      // Make DELETE request to the booking endpoint
      return api.delete(`/bookings/${bookingId}`, {
        data: requestData
      });
    },

    /**
     * Get single booking details
     * @param {string} bookingId - The HubSpot booking object ID
     * @param {object} params - Query parameters including student_id and email
     */
    get: async (bookingId, params = {}) => {
      // Extract user data from localStorage if not provided
      const userData = JSON.parse(localStorage.getItem('userData') || '{}');

      return api.get(`/bookings/${bookingId}`, {
        params: {
          student_id: params.student_id || userData.student_id,
          email: params.email || userData.email
        }
      });
    },
  },
};

// Helper functions
export const formatDate = (dateString) => {
  if (!dateString) return 'TBD';

  // Handle date string that might not include timezone info
  // If the date string is in YYYY-MM-DD format, treat it as local date
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day); // month is 0-indexed
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  // For other date formats, use normal Date parsing
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export const formatTime = (dateString) => {
  if (!dateString) return '';

  // Handle UTC timestamps properly
  const date = new Date(dateString);

  // Convert UTC to local time for display
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
    // Use user's local timezone instead of hardcoded Toronto
  });
};
// Format time range for exam sessions (start_time - end_time)
export const formatTimeRange = (exam) => {
  if (!exam) return '';

  // If we have start_time and end_time, use them
  if (exam.start_time && exam.end_time) {
    const startTime = formatTime(exam.start_time);
    const endTime = formatTime(exam.end_time);
    return `${startTime} - ${endTime}`;
  }

  // Fallback: if we only have exam_date, create a reasonable time range
  if (exam.exam_date) {
    // For YYYY-MM-DD format, append a time to avoid timezone issues
    const dateStr = exam.exam_date.includes('T') ? exam.exam_date : `${exam.exam_date}T09:00:00`;
    const startDate = new Date(dateStr);
    const endDate = new Date(startDate.getTime() + 3 * 60 * 60 * 1000); // Add 3 hours

    const startTime = formatTime(startDate);
    const endTime = formatTime(endDate);
    return `${startTime} - ${endTime}`;
  }

  return 'Time TBD';
};

// Helper to format booking number from booking_id
export const formatBookingNumber = (booking) => {
  if (booking.booking_number) {
    return booking.booking_number;
  }
  if (booking.booking_id) {
    // Extract last 8 chars of booking_id for display
    return `BK-${booking.booking_id.slice(-8).toUpperCase()}`;
  }
  return 'Booking ID TBD';
};

// Helper to get booking status from is_active flag
export const getBookingStatus = (booking) => {
  // First check explicit status field if it exists
  if (booking.status) {
    return booking.status;
  }

  // Check is_active property for soft delete status
  if (booking.is_active === 'Cancelled' || booking.is_active === 'cancelled' ||
      booking.is_active === false || booking.is_active === 'false') {
    return 'cancelled';
  }

  if (booking.is_active === 'Completed' || booking.is_active === 'completed') {
    return 'completed';
  }

  // If booking is active, determine status based on exam date
  if (booking.exam_date) {
    const examDate = new Date(booking.exam_date);
    const now = new Date();
    if (examDate < now) {
      return 'completed';
    }
  }

  return 'scheduled';
};

// Helper to ensure booking has all necessary properties
export const normalizeBooking = (booking) => {
  return {
    ...booking,
    // Ensure we have an id property
    id: booking.id || booking.booking_id || booking.recordId,
    // Ensure we have booking_number
    booking_number: formatBookingNumber(booking),
    // Ensure we have a status
    status: getBookingStatus(booking),
    // Ensure location is available
    location: booking.location || 'Location TBD',
    // Ensure exam_date is available
    exam_date: booking.exam_date || booking.hs_createdate?.split('T')[0],
    // Ensure times are available
    start_time: booking.start_time || null,
    end_time: booking.end_time || null,
    // Ensure is_active is available for status checking
    is_active: booking.is_active || 'Active'
  };
};

export const getCapacityColor = (availableSlots, capacity) => {
  const percentage = (availableSlots / capacity) * 100;
  if (percentage === 0) return 'error';
  if (percentage <= 20) return 'warning';
  return 'success';
};

export const getCapacityText = (availableSlots) => {
  if (availableSlots === 0) return 'Full';
  if (availableSlots === 1) return '1 slot left';
  if (availableSlots <= 3) return `${availableSlots} slots left`;
  return `${availableSlots} slots available`;
};

export default apiService;