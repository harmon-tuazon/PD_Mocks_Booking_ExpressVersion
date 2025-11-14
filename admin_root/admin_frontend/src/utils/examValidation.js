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
      const validTypes = ['Situational Judgment', 'Clinical Skills', 'Mini-mock', 'Mock Discussion'];
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
        'Mississauga - B9',
        'Mississauga - Lab D',
        'Vancouver',
        'Montreal',
        'Calgary',
        'Richmond Hill',
        'Online'
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
      // Accept string values: 'true', 'false', or 'scheduled'
      return ['true', 'false', 'scheduled'].includes(value);
    },
    errorMessage: 'Status must be active, inactive, or scheduled'
  },

  scheduled_activation_datetime: {
    required: false,
    validate: (value, formData) => {
      // Only validate if is_active is 'scheduled'
      if (formData?.is_active === 'scheduled') {
        if (!value) {
          return 'Scheduled activation date/time is required when status is scheduled';
        }

        try {
          const date = typeof value === 'string' ? parseISO(value) : value;
          if (!isValid(date)) {
            return 'Please enter a valid date/time';
          }

          // Must be in the future
          const now = new Date();
          if (isBefore(date, now)) {
            return 'Scheduled activation must be in the future';
          }

          return true;
        } catch {
          return 'Please enter a valid date/time';
        }
      }

      return true;
    },
    errorMessage: 'Please enter a valid scheduled activation date/time'
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

  // Check standard validation fields
  for (const field of fieldsToCheck) {
    if (original[field] !== current[field]) {
      return true;
    }
  }

  // Check prerequisite_exam_ids array (for Mock Discussion)
  if (original.prerequisite_exam_ids || current.prerequisite_exam_ids) {
    const originalIds = original.prerequisite_exam_ids || [];
    const currentIds = current.prerequisite_exam_ids || [];
    
    // Compare array lengths
    if (originalIds.length !== currentIds.length) {
      return true;
    }
    
    // Compare array contents (order-independent)
    const sortedOriginal = [...originalIds].sort();
    const sortedCurrent = [...currentIds].sort();
    
    for (let i = 0; i < sortedOriginal.length; i++) {
      if (sortedOriginal[i] !== sortedCurrent[i]) {
        return true;
      }
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

  // Handle is_active status (now a string: 'active', 'inactive', 'scheduled')
  // Keep the original value as-is since it's now a string
  // No conversion needed

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

  // Check standard validation fields
  Object.keys(validationRules).forEach(field => {
    if (original[field] !== current[field]) {
      changes[field] = current[field];
    }
  });

  // Check prerequisite_exam_ids array (for Mock Discussion)
  if (original.prerequisite_exam_ids || current.prerequisite_exam_ids) {
    const originalIds = original.prerequisite_exam_ids || [];
    const currentIds = current.prerequisite_exam_ids || [];
    
    // Compare array contents
    const sortedOriginal = [...originalIds].sort();
    const sortedCurrent = [...currentIds].sort();
    
    const hasChanged = sortedOriginal.length !== sortedCurrent.length ||
      sortedOriginal.some((id, index) => id !== sortedCurrent[index]);
    
    if (hasChanged) {
      changes.prerequisite_exam_ids = currentIds;
    }
  }

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