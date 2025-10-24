/**
 * Exam Validation Utilities
 * Provides validation rules and error messages for mock exam fields
 */

import { format, isValid, parseISO, isBefore, startOfDay } from 'date-fns';

/**
 * Validation rules for each field
 */
export const validationRules = {
  mock_type: {
    required: true,
    validate: (value) => {
      const validTypes = ['Situational Judgment', 'Clinical Skills', 'Mini-mock'];
      return validTypes.includes(value);
    },
    errorMessage: 'Please select a valid mock type'
  },

  exam_date: {
    required: true,
    validate: (value) => {
      if (!value) return false;

      try {
        const date = typeof value === 'string' ? parseISO(value) : value;
        if (!isValid(date)) return false;

        // Cannot be before today
        const today = startOfDay(new Date());
        if (isBefore(date, today)) {
          return 'Exam date cannot be in the past';
        }

        return true;
      } catch {
        return false;
      }
    },
    errorMessage: 'Please enter a valid date (cannot be in the past)'
  },

  start_time: {
    required: true,
    validate: (value) => {
      if (!value) return false;

      // Accept HH:MM:SS or HH:MM format
      const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])(:[0-5][0-9])?$/;
      return timeRegex.test(value);
    },
    errorMessage: 'Please enter a valid time (HH:MM or HH:MM:SS)'
  },

  end_time: {
    required: true,
    validate: (value, formData) => {
      if (!value) return false;

      // Check valid time format
      const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])(:[0-5][0-9])?$/;
      if (!timeRegex.test(value)) {
        return 'Please enter a valid time (HH:MM or HH:MM:SS)';
      }

      // Check if end_time is after start_time
      if (formData?.start_time) {
        const start = parseTime(formData.start_time);
        const end = parseTime(value);

        if (end <= start) {
          return 'End time must be after start time';
        }
      }

      return true;
    },
    errorMessage: 'Please enter a valid end time'
  },

  capacity: {
    required: true,
    validate: (value, formData) => {
      const capacity = parseInt(value);

      if (isNaN(capacity) || capacity < 1) {
        return 'Capacity must be at least 1';
      }

      // Check against current bookings
      const bookingCount = formData?.booked_count || formData?.total_bookings || 0;
      if (capacity < bookingCount) {
        return `Capacity (${capacity}) cannot be less than current bookings (${bookingCount})`;
      }

      return true;
    },
    errorMessage: 'Please enter a valid capacity'
  },

  location: {
    required: true,
    validate: (value) => {
      const validLocations = [
        'Mississauga',
        'Vancouver',
        'Montreal',
        'Calgary',
        'Richmond Hill'
      ];
      return validLocations.includes(value);
    },
    errorMessage: 'Please select a valid location'
  },

  address: {
    required: false,
    validate: (value) => {
      // Optional field, but if provided must be non-empty
      if (value && value.trim().length === 0) {
        return 'Address cannot be empty';
      }
      return true;
    },
    errorMessage: 'Please enter a valid address'
  },

  is_active: {
    required: false,
    validate: (value) => {
      return typeof value === 'boolean';
    },
    errorMessage: 'Status must be active or inactive'
  }
};

/**
 * Parse time string to minutes for comparison
 */
function parseTime(timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Validate a single field
 */
export function validateField(fieldName, value, formData = {}) {
  const rule = validationRules[fieldName];

  if (!rule) {
    return { isValid: true, error: null };
  }

  // Check required
  if (rule.required && !value) {
    return { isValid: false, error: rule.errorMessage };
  }

  // Run validation
  if (rule.validate && value !== undefined && value !== '') {
    const result = rule.validate(value, formData);

    if (typeof result === 'string') {
      // Validation returned a custom error message
      return { isValid: false, error: result };
    } else if (result === false) {
      // Validation failed, use default error message
      return { isValid: false, error: rule.errorMessage };
    }
  }

  return { isValid: true, error: null };
}

/**
 * Validate entire form
 */
export function validateForm(formData) {
  const errors = {};
  let isValid = true;

  Object.keys(validationRules).forEach(fieldName => {
    const result = validateField(fieldName, formData[fieldName], formData);

    if (!result.isValid) {
      errors[fieldName] = result.error;
      isValid = false;
    }
  });

  return { isValid, errors };
}

/**
 * Check if form has changes
 */
export function hasFormChanges(original, current) {
  if (!original || !current) return false;

  const fieldsToCheck = Object.keys(validationRules);

  for (const field of fieldsToCheck) {
    if (original[field] !== current[field]) {
      return true;
    }
  }

  return false;
}

/**
 * Format form data for API submission
 */
export function formatFormDataForApi(formData) {
  const formatted = {};

  // Only include fields that are defined and not empty
  Object.keys(validationRules).forEach(field => {
    if (formData[field] !== undefined && formData[field] !== '') {
      formatted[field] = formData[field];
    }
  });

  // Ensure boolean values are properly formatted
  if (formatted.is_active !== undefined) {
    formatted.is_active = Boolean(formatted.is_active);
  }

  // Ensure capacity is a number
  if (formatted.capacity !== undefined) {
    formatted.capacity = parseInt(formatted.capacity);
  }

  return formatted;
}

/**
 * Get only changed fields between original and current data
 */
export function getChangedFields(original, current) {
  const changes = {};

  Object.keys(validationRules).forEach(field => {
    if (original[field] !== current[field]) {
      changes[field] = current[field];
    }
  });

  return changes;
}

/**
 * Info messages for fields
 */
export const fieldInfoMessages = {
  capacity: (bookingCount) => `Currently ${bookingCount} bookings for this session`,
  start_time: 'Time must be in HH:MM format',
  end_time: 'Must be after the start time',
  exam_date: 'Cannot be set to a past date'
};