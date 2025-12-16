/**
 * Error message mapping for user-friendly display
 * Maps backend error codes and messages to descriptive, actionable user messages
 */

// Error code to user message mapping
const ERROR_MESSAGES = {
  // Booking-specific errors
  DUPLICATE_BOOKING: {
    title: 'Duplicate Booking Detected',
    message: 'You already have a booking for this exam on this date. Each student can only book one session per exam date. Please view your existing bookings or choose a different date.',
    action: null,  // No action button - user should choose different date
    actionType: null,
    severity: 'warning'
  },

  EXAM_FULL: {
    title: 'Exam Session Full',
    message: 'This exam session is now full. Please select another available date.',
    action: 'Back to Sessions',
    actionType: 'back',
    severity: 'warning'
  },

  INSUFFICIENT_CREDITS: {
    title: 'Insufficient Credits',
    message: 'You don\'t have enough credits to book this exam. Please contact support to purchase more credits.',
    action: 'Contact Support',
    actionType: 'support',
    severity: 'error'
  },

  EXAM_NOT_ACTIVE: {
    title: 'Exam Unavailable',
    message: 'This exam session is no longer available for booking. Please select another date.',
    action: 'Back to Sessions',
    actionType: 'back',
    severity: 'warning'
  },

  EXAM_NOT_FOUND: {
    title: 'Exam Not Found',
    message: 'The selected exam session could not be found. Please try again or select a different session.',
    action: 'Back to Sessions',
    actionType: 'back',
    severity: 'error'
  },

    message: 'You already have a booking that overlaps with this session time.',

  // Validation errors
  VALIDATION_ERROR: {
    title: 'Invalid Information',
    message: 'Please check your information and try again.',
    action: 'Review Form',
    actionType: 'none',
    severity: 'error'
  },

  STUDENT_NOT_FOUND: {
    title: 'Student ID Not Found',
    message: 'Student ID not found in our records. Please check and try again or contact support.',
    action: 'Contact Support',
    actionType: 'support',
    severity: 'error'
  },

  EMAIL_MISMATCH: {
    title: 'Email Mismatch',
    message: 'The email address does not match our records for this Student ID. Please use your registered email.',
    action: 'Try Again',
    actionType: 'none',
    severity: 'error'
  },

  CONTACT_NOT_FOUND: {
    title: 'Account Not Found',
    message: 'We couldn\'t find your account. Please contact support for assistance.',
    action: 'Contact Support',
    actionType: 'support',
    severity: 'error'
  },

  // Network and server errors
  NETWORK_ERROR: {
    title: 'Connection Error',
    message: 'Unable to connect to the server. Please check your internet connection and try again.',
    action: 'Try Again',
    actionType: 'retry',
    severity: 'error'
  },

  TIMEOUT_ERROR: {
    title: 'Request Timeout',
    message: 'The request took too long to complete. Please try again.',
    action: 'Try Again',
    actionType: 'retry',
    severity: 'error'
  },

  SERVER_ERROR: {
    title: 'Server Error',
    message: 'An unexpected error occurred on our servers. Please try again later or contact support if the problem persists.',
    action: 'Contact Support',
    actionType: 'support',
    severity: 'error'
  },

  // Default fallback
  UNKNOWN_ERROR: {
    title: 'Something Went Wrong',
    message: 'An unexpected error occurred. Please try again or contact support if the problem persists.',
    action: 'Contact Support',
    actionType: 'support',
    severity: 'error'
  }
};

/**
 * Parse error response and return user-friendly message
 * @param {Error|Object|string} error - The error from API or catch block
 * @returns {Object} Formatted error object with title, message, action, etc.
 */
export function parseErrorMessage(error) {
  // 🔍 DEBUG: Log raw error received
  console.log('🔍 [parseErrorMessage] Raw error received:', {
    errorType: typeof error,
    error: error,
    'error?.code': error?.code,
    'error?.message': error?.message,
    'error?.error': error?.error
  });

  // Handle different error formats
  let errorCode = null;
  let errorMessage = null;

  if (typeof error === 'string') {
    errorMessage = error;
  } else if (error?.code) {
    errorCode = error.code;
    errorMessage = error.message || error.error || '';
  } else if (error?.message) {
    errorMessage = error.message;
  } else if (error?.error) {
    // Handle nested error object: { error: { code, message } }
    if (typeof error.error === 'object' && error.error !== null) {
      errorCode = error.error.code;
      errorMessage = error.error.message || '';
    } else {
      errorMessage = error.error;
    }
  }

  // 🔍 DEBUG: Log extracted values
  console.log('🔍 [parseErrorMessage] Extracted values:', {
    errorCode: errorCode,
    errorMessage: errorMessage,
    hasErrorCode: !!errorCode,
    errorCodeExists: errorCode && ERROR_MESSAGES[errorCode]
  });

  // Check for specific error codes first
  if (errorCode && ERROR_MESSAGES[errorCode]) {
    console.log('🔍 [parseErrorMessage] Found matching error code:', errorCode);
    return ERROR_MESSAGES[errorCode];
  }

  // Check for specific error message patterns
  if (errorMessage && typeof errorMessage === 'string') {
    const lowerMessage = errorMessage.toLowerCase();

    // Credit-related errors
    if (lowerMessage.includes('credit') || lowerMessage.includes('0 credits available')) {
      console.log('🔍 [parseErrorMessage] Matched: INSUFFICIENT_CREDITS');
      return ERROR_MESSAGES.INSUFFICIENT_CREDITS;
    }

    // Duplicate booking
    if (lowerMessage.includes('duplicate') || lowerMessage.includes('already have a booking')) {
      console.log('🔍 [parseErrorMessage] Matched: DUPLICATE_BOOKING (from message pattern)');
      return ERROR_MESSAGES.DUPLICATE_BOOKING;
    }

    // Session full
    if (lowerMessage.includes('full') || lowerMessage.includes('capacity')) {
      console.log('🔍 [parseErrorMessage] Matched: EXAM_FULL');
      return ERROR_MESSAGES.EXAM_FULL;
    }

    // Student/email validation
    if (lowerMessage.includes('student') && lowerMessage.includes('not found')) {
      console.log('🔍 [parseErrorMessage] Matched: STUDENT_NOT_FOUND');
      return ERROR_MESSAGES.STUDENT_NOT_FOUND;
    }

    if (lowerMessage.includes('email') && (lowerMessage.includes('mismatch') || lowerMessage.includes('not match'))) {
      console.log('🔍 [parseErrorMessage] Matched: EMAIL_MISMATCH');
      return ERROR_MESSAGES.EMAIL_MISMATCH;
    }

    // Network errors
    if (lowerMessage.includes('network') || lowerMessage.includes('fetch')) {
      console.log('🔍 [parseErrorMessage] Matched: NETWORK_ERROR');
      return ERROR_MESSAGES.NETWORK_ERROR;
    }

    if (lowerMessage.includes('timeout')) {
      console.log('🔍 [parseErrorMessage] Matched: TIMEOUT_ERROR');
      return ERROR_MESSAGES.TIMEOUT_ERROR;
    }


    // Validation errors with specific message
    if (lowerMessage.includes('validation') || lowerMessage.includes('invalid')) {
      console.log('🔍 [parseErrorMessage] Matched: VALIDATION_ERROR');
      return {
        ...ERROR_MESSAGES.VALIDATION_ERROR,
        message: errorMessage // Use the specific validation message
      };
    }

    // Server errors
    if (lowerMessage.includes('server') || lowerMessage.includes('internal')) {
      console.log('🔍 [parseErrorMessage] Matched: SERVER_ERROR');
      return ERROR_MESSAGES.SERVER_ERROR;
    }
  }

  // Default fallback with original message if available
  console.log('🔍 [parseErrorMessage] No match found, returning UNKNOWN_ERROR');
  const result = {
    ...ERROR_MESSAGES.UNKNOWN_ERROR,
    message: errorMessage || ERROR_MESSAGES.UNKNOWN_ERROR.message
  };

  console.log('🔍 [parseErrorMessage] Final result:', result);
  return result;
}

/**
 * Get action handler based on action type
 * @param {string} actionType - Type of action to perform
 * @param {Function} navigate - React Router navigate function
 * @returns {Function} Action handler function
 */
export function getErrorActionHandler(actionType, navigate) {
  const handlers = {
    'view-bookings': () => navigate('/bookings'),
    'back': () => navigate(-1),
    'support': () => window.open('https://ca.prepdoctors.com/academic-advisors', '_blank'),
    'retry': () => window.location.reload(),
    'none': () => {}
  };

  return handlers[actionType] || handlers.none;
}

/**
 * Format error for console logging (development)
 * @param {Error} error - Original error object
 * @param {string} context - Context where error occurred
 */
export function logError(error, context = 'Unknown') {
  if (process.env.NODE_ENV === 'development') {
    console.group(`🔴 Error in ${context}`);
    console.error('Error object:', error);
    console.error('Stack trace:', error?.stack);
    console.error('Error code:', error?.code);
    console.error('Error status:', error?.status);
    console.groupEnd();
  }
}

export default {
  parseErrorMessage,
  getErrorActionHandler,
  logError
};