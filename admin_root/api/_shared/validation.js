const Joi = require('joi');

// Validation schemas for different operations
const schemas = {
  // Schema for credit validation
  // Schema for authentication check
  authCheck: Joi.object({
    student_id: Joi.string()
      .pattern(/^[A-Z0-9]+$/)
      .required()
      .messages({
        'string.pattern.base': 'Student ID must contain only uppercase letters and numbers',
        'any.required': 'Student ID is required'
      }),
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.email': 'Please enter a valid email address',
        'any.required': 'Email is required'
      })
  }),

  // Schema for booking cancellation (DELETE)
  bookingCancellation: Joi.object({
    student_id: Joi.string()
      .pattern(/^[A-Z0-9]+$/)
      .required()
      .messages({
        'string.pattern.base': 'Student ID must contain only uppercase letters and numbers',
        'any.required': 'Student ID is required'
      }),
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.email': 'Please enter a valid email address',
        'any.required': 'Email is required'
      }),
    reason: Joi.string()
      .max(500)
      .optional()
      .allow('')
      .messages({
        'string.max': 'Cancellation reason cannot exceed 500 characters'
      })
  }),

  // Schema for credit validation
  creditValidation: Joi.object({
    student_id: Joi.string()
      .pattern(/^[A-Z0-9]+$/)
      .required()
      .messages({
        'string.pattern.base': 'Student ID must contain only uppercase letters and numbers',
        'any.required': 'Student ID is required'
      }),
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.email': 'Please enter a valid email address',
        'any.required': 'Email is required'
      }),
    mock_type: Joi.string()
      .valid('Situational Judgment', 'Clinical Skills', 'Mini-mock', 'Mock Discussion')
      .required()
      .messages({
        'any.only': 'Mock type must be one of: Situational Judgment, Clinical Skills, Mini-mock, or Mock Discussion',
        'any.required': 'Mock type is required'
      })
  }),

  // Schema for booking creation
  bookingCreation: Joi.object({
    mock_exam_id: Joi.string()
      .required()
      .messages({
        'any.required': 'Mock exam ID is required'
      }),
    contact_id: Joi.string()
      .required()
      .messages({
        'any.required': 'Contact ID is required'
      }),
    student_id: Joi.string()
      .pattern(/^[A-Z0-9]+$/)
      .required()
      .messages({
        'string.pattern.base': 'Student ID must contain only uppercase letters and numbers',
        'any.required': 'Student ID is required'
      }),
    name: Joi.string()
      .min(2)
      .max(100)
      .required()
      .messages({
        'string.min': 'Name must be at least 2 characters long',
        'string.max': 'Name cannot exceed 100 characters',
        'any.required': 'Name is required'
      }),
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.email': 'Please enter a valid email address',
        'any.required': 'Email is required'
      }),
    mock_type: Joi.string()
      .valid('Situational Judgment', 'Clinical Skills', 'Mini-mock', 'Mock Discussion')
      .required()
      .messages({
        'any.only': 'Mock type must be one of: Situational Judgment, Clinical Skills, Mini-mock, or Mock Discussion',
        'any.required': 'Mock type is required'
      }),
    exam_date: Joi.string()
      .required()
      .messages({
        'any.required': 'Exam date is required'
      }),
    // Conditional fields based on mock_type
    dominant_hand: Joi.boolean()
      .when('mock_type', {
        is: 'Clinical Skills',
        then: Joi.required().messages({
          'any.required': 'Dominant hand selection is required for Clinical Skills exams'
        }),
        otherwise: Joi.optional().strip()
      }),
    attending_location: Joi.string()
      .valid('mississauga', 'calgary', 'vancouver', 'montreal', 'richmond_hill')
      .when('mock_type', {
        is: Joi.string().valid('Situational Judgment', 'Mini-mock'),
        then: Joi.required().messages({
          'any.required': 'Attending location is required for Situational Judgment and Mini-mock exams',
          'any.only': 'Location must be one of: Mississauga, Calgary, Vancouver, Montreal, or Richmond Hill'
        }),
        otherwise: Joi.optional().strip()
      })
  }),

  // Schema for fetching available exams
  // Schema for listing bookings
  bookingsList: Joi.object({
    student_id: Joi.string()
      .pattern(/^[A-Z0-9]+$/)
      .required()
      .messages({
        'string.pattern.base': 'Student ID must contain only uppercase letters and numbers',
        'any.required': 'Student ID is required'
      }),
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.email': 'Please enter a valid email address',
        'any.required': 'Email is required'
      }),
    filter: Joi.string()
      .valid('all', 'upcoming', 'past')
      .optional()
      .default('all')
      .messages({
        'any.only': 'Filter must be one of: all, upcoming, or past'
      }),
    page: Joi.number()
      .integer()
      .min(1)
      .optional()
      .default(1)
      .messages({
        'number.base': 'Page must be a number',
        'number.integer': 'Page must be an integer',
        'number.min': 'Page must be at least 1'
      }),
    limit: Joi.number()
      .integer()
      .min(1)
      .max(100)
      .optional()
      .default(20)
      .messages({
        'number.base': 'Limit must be a number',
        'number.integer': 'Limit must be an integer',
        'number.min': 'Limit must be at least 1',
        'number.max': 'Limit cannot exceed 100'
      }),
    force: Joi.boolean()
      .optional()
      .default(false)
      .messages({
        'boolean.base': 'Force parameter must be a boolean value'
      })
  }),
  availableExams: Joi.object({
    mock_type: Joi.string()
      .valid('Situational Judgment', 'Clinical Skills', 'Mini-mock', 'Mock Discussion')
      .required()
      .messages({
        'any.only': 'Mock type must be one of: Situational Judgment, Clinical Skills, Mini-mock, or Mock Discussion',
        'any.required': 'Mock type is required'
      }),
    include_capacity: Joi.boolean()
      .optional()
      .default(true),
    realtime: Joi.boolean()
      .optional()
      .default(false)
      .messages({
        'boolean.base': 'Realtime parameter must be a boolean value'
      })
  }),

  // Schema for single mock exam creation (Admin)
  mockExamCreation: Joi.object({
    mock_type: Joi.string()
      .valid('Situational Judgment', 'Clinical Skills', 'Mini-mock', 'Mock Discussion')
      .required()
      .messages({
        'any.only': 'Mock type must be one of: Situational Judgment, Clinical Skills, Mini-mock, or Mock Discussion',
        'any.required': 'Mock type is required'
      }),
    exam_date: Joi.string()
      .pattern(/^\d{4}-\d{2}-\d{2}$/)
      .required()
      .messages({
        'string.pattern.base': 'Exam date must be in YYYY-MM-DD format',
        'any.required': 'Exam date is required'
      }),
    capacity: Joi.number()
      .integer()
      .min(1)
      .max(100)
      .required()
      .messages({
        'number.base': 'Capacity must be a number',
        'number.integer': 'Capacity must be an integer',
        'number.min': 'Capacity must be at least 1',
        'number.max': 'Capacity cannot exceed 100',
        'any.required': 'Capacity is required'
      }),
    location: Joi.string()
      .valid('Mississauga', 'Mississauga - B9', 'Mississauga - Lab D', 'Calgary', 'Vancouver', 'Montreal', 'Richmond Hill', 'Online')
      .required()
      .messages({
        'any.only': 'Location must be one of: Mississauga, Mississauga - B9, Mississauga - Lab D, Calgary, Vancouver, Montreal, Richmond Hill, or Online',
        'any.required': 'Location is required'
      }),
    // Activation mode controls whether session activates immediately or is scheduled
    activation_mode: Joi.string()
      .valid('immediate', 'scheduled')
      .optional()
      .default('immediate')
      .messages({
        'any.only': 'Activation mode must be either "immediate" or "scheduled"'
      }),
    // HubSpot stores ALL values as STRINGS: 'true', 'false', or 'scheduled'
    is_active: Joi.string()
      .valid('true', 'false', 'scheduled')
      .optional()
      .when('activation_mode', {
        is: 'scheduled',
        then: Joi.string().valid('scheduled').default('scheduled'),  // Force 'scheduled' when using scheduled activation mode
        otherwise: Joi.string().valid('true', 'false').default('true')  // Default to 'true' (string) for immediate activation
      })
      .messages({
        'any.only': 'is_active must be "true", "false", or "scheduled"'
      }),
    // Scheduled activation datetime - required when activation_mode is 'scheduled'
    scheduled_activation_datetime: Joi.date()
      .iso()
      .min(new Date(new Date().setHours(0, 0, 0, 0)))  // Allow today onwards (for testing)
      .when('activation_mode', {
        is: 'scheduled',
        then: Joi.required()
          .messages({
            'any.required': 'Scheduled activation date/time is required when using scheduled activation mode',
            'date.min': 'Scheduled activation must be today or in the future'
          }),
        otherwise: Joi.optional().allow(null, '')
      })
      .messages({
        'date.iso': 'Invalid datetime format. Use ISO 8601 format (e.g., 2025-01-20T14:00:00Z)',
        'date.min': 'Scheduled activation date must be today or in the future'
      }),
    start_time: Joi.string()
      .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
      .required()
      .messages({
        'string.pattern.base': 'Start time must be in HH:MM format (24-hour)',
        'any.required': 'Start time is required'
      }),
    end_time: Joi.string()
      .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
      .required()
      .messages({
        'string.pattern.base': 'End time must be in HH:MM format (24-hour)',
        'any.required': 'End time is required'
      })
  }).custom((value, helpers) => {
    // Custom validation: end_time must be after start_time
    const startParts = value.start_time.split(':');
    const endParts = value.end_time.split(':');
    const startMinutes = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
    const endMinutes = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);

    if (endMinutes <= startMinutes) {
      return helpers.error('custom.endTimeBeforeStart');
    }

    return value;
  }, 'time validation').messages({
    'custom.endTimeBeforeStart': 'End time must be after start time'
  }),

  // Schema for bulk mock exam creation (Admin)
  mockExamBulkCreation: Joi.object({
    commonProperties: Joi.object({
      mock_type: Joi.string()
        .valid('Situational Judgment', 'Clinical Skills', 'Mini-mock', 'Mock Discussion')
        .required()
        .messages({
          'any.only': 'Mock type must be one of: Situational Judgment, Clinical Skills, Mini-mock, or Mock Discussion',
          'any.required': 'Mock type is required'
        }),
      exam_date: Joi.string()
        .pattern(/^\d{4}-\d{2}-\d{2}$/)
        .required()
        .messages({
          'string.pattern.base': 'Exam date must be in YYYY-MM-DD format',
          'any.required': 'Exam date is required'
        }),
      // Capacity is now optional - required only when capacityMode is 'global'
      capacity: Joi.number()
        .integer()
        .min(1)
        .max(100)
        .optional()
        .messages({
          'number.base': 'Capacity must be a number',
          'number.integer': 'Capacity must be an integer',
          'number.min': 'Capacity must be at least 1',
          'number.max': 'Capacity cannot exceed 100'
        }),
      location: Joi.string()
        .valid('Mississauga', 'Mississauga - B9', 'Mississauga - Lab D', 'Calgary', 'Vancouver', 'Montreal', 'Richmond Hill', 'Online')
        .required()
        .messages({
          'any.only': 'Location must be one of: Mississauga, Mississauga - B9, Mississauga - Lab D, Calgary, Vancouver, Montreal, Richmond Hill, or Online',
          'any.required': 'Location is required'
        }),
      // Activation mode for bulk creation
      activation_mode: Joi.string()
        .valid('immediate', 'scheduled')
        .optional()
        .default('immediate')
        .messages({
          'any.only': 'Activation mode must be either "immediate" or "scheduled"'
        }),
      // HubSpot stores ALL values as STRINGS: 'true', 'false', or 'scheduled'
      is_active: Joi.string()
        .valid('true', 'false', 'scheduled')
        .optional()
        .when('activation_mode', {
          is: 'scheduled',
          then: Joi.string().valid('scheduled').default('scheduled'),  // Force 'scheduled' when using scheduled activation mode
          otherwise: Joi.string().valid('true', 'false').default('true')  // Default to 'true' (string) for immediate activation
        })
        .messages({
          'any.only': 'is_active must be "true", "false", or "scheduled"'
        }),
      // Scheduled activation datetime for bulk creation
      scheduled_activation_datetime: Joi.date()
        .iso()
        .min(new Date(new Date().setHours(0, 0, 0, 0)))  // Allow today onwards (for testing)
        .when('activation_mode', {
          is: 'scheduled',
          then: Joi.required()
            .messages({
              'any.required': 'Scheduled activation date/time is required when using scheduled activation mode',
              'date.min': 'Scheduled activation must be today or in the future'
            }),
          otherwise: Joi.optional().allow(null, '')
        })
        .messages({
          'date.iso': 'Invalid datetime format. Use ISO 8601 format (e.g., 2025-01-20T14:00:00Z)',
          'date.min': 'Scheduled activation date must be today or in the future'
        })
    }).required(),
    timeSlots: Joi.array()
      .items(
        Joi.object({
          start_time: Joi.string()
            .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
            .required()
            .messages({
              'string.pattern.base': 'Start time must be in HH:MM format (24-hour)',
              'any.required': 'Start time is required for each time slot'
            }),
          end_time: Joi.string()
            .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
            .required()
            .messages({
              'string.pattern.base': 'End time must be in HH:MM format (24-hour)',
              'any.required': 'End time is required for each time slot'
            }),
          // Capacity per slot - required when capacityMode is 'per-slot'
          capacity: Joi.number()
            .integer()
            .min(1)
            .max(100)
            .optional()
            .messages({
              'number.base': 'Slot capacity must be a number',
              'number.integer': 'Slot capacity must be an integer',
              'number.min': 'Slot capacity must be at least 1',
              'number.max': 'Slot capacity cannot exceed 100'
            })
        }).custom((value, helpers) => {
          // Validate end time > start time for each slot
          const startParts = value.start_time.split(':');
          const endParts = value.end_time.split(':');
          const startMinutes = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
          const endMinutes = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);

          if (endMinutes <= startMinutes) {
            return helpers.error('custom.endTimeBeforeStart');
          }

          return value;
        }, 'time slot validation')
      )
      .min(1)
      .max(50)
      .required()
      .messages({
        'array.min': 'At least one time slot is required',
        'array.max': 'Cannot create more than 50 mock exams at once',
        'any.required': 'Time slots are required',
        'custom.endTimeBeforeStart': 'End time must be after start time for all time slots'
      }),
    // New capacity mode parameter
    capacityMode: Joi.string()
      .valid('global', 'per-slot')
      .default('global')
      .messages({
        'any.only': 'Capacity mode must be either "global" or "per-slot"'
      })
  }).custom((value, helpers) => {
    // Custom validation: Ensure capacity is provided based on mode
    if (value.capacityMode === 'global') {
      if (!value.commonProperties.capacity) {
        return helpers.error('custom.globalCapacityRequired');
      }
      // In global mode, time slots should not have individual capacities
      const hasSlotCapacity = value.timeSlots.some(slot => slot.capacity !== undefined);
      if (hasSlotCapacity) {
        return helpers.error('custom.noSlotCapacityInGlobalMode');
      }
    } else if (value.capacityMode === 'per-slot') {
      // In per-slot mode, each slot must have capacity
      const missingCapacity = value.timeSlots.some(slot => !slot.capacity);
      if (missingCapacity) {
        return helpers.error('custom.perSlotCapacityRequired');
      }
      // Common properties should not have capacity in per-slot mode
      if (value.commonProperties.capacity !== undefined) {
        return helpers.error('custom.noGlobalCapacityInPerSlotMode');
      }
    }
    return value;
  }, 'capacity mode validation')
  .messages({
    'custom.globalCapacityRequired': 'Capacity is required in commonProperties when capacityMode is "global"',
    'custom.perSlotCapacityRequired': 'Each time slot must have a capacity when capacityMode is "per-slot"',
    'custom.noSlotCapacityInGlobalMode': 'Time slots should not have individual capacities when capacityMode is "global"',
    'custom.noGlobalCapacityInPerSlotMode': 'Common properties should not have capacity when capacityMode is "per-slot"'
  }),

  // Schema for listing mock exams (Admin Dashboard)
  mockExamList: Joi.object({
    page: Joi.number()
      .integer()
      .min(1)
      .optional()
      .default(1)
      .messages({
        'number.base': 'Page must be a number',
        'number.integer': 'Page must be an integer',
        'number.min': 'Page must be at least 1'
      }),
    limit: Joi.number()
      .integer()
      .min(1)
      .max(100)
      .optional()
      .default(50)
      .messages({
        'number.base': 'Limit must be a number',
        'number.integer': 'Limit must be an integer',
        'number.min': 'Limit must be at least 1',
        'number.max': 'Limit cannot exceed 100'
      }),
    sort_by: Joi.string()
      .valid(
        'exam_date', 'date',          // Accept both mapped and unmapped
        'start_time', 
        'capacity', 
        'total_bookings', 
        'location', 
        'mock_type', 'type',          // Accept both mapped and unmapped
        'is_active', 
        'hs_createdate', 
        'hs_lastmodifieddate'
      )
      .optional()
      .default('exam_date')
      .messages({
        'any.only': 'sort_by must be one of: exam_date, date, start_time, capacity, total_bookings, location, mock_type, type, is_active, hs_createdate, hs_lastmodifieddate'
      }),
    sort_order: Joi.string()
      .valid('asc', 'desc')
      .optional()
      .default('asc')
      .messages({
        'any.only': 'sort_order must be either asc or desc'
      }),
    filter_location: Joi.string()
      .valid('Mississauga', 'Mississauga - B9', 'Mississauga - Lab D', 'Calgary', 'Vancouver', 'Montreal', 'Richmond Hill', 'Online')
      .optional()
      .messages({
        'any.only': 'filter_location must be one of: Mississauga, Mississauga - B9, Mississauga - Lab D, Calgary, Vancouver, Montreal, Richmond Hill, or Online'
      }),
    filter_mock_type: Joi.string()
      .valid('Situational Judgment', 'Clinical Skills', 'Mini-mock', 'Mock Discussion')
      .optional()
      .messages({
        'any.only': 'filter_mock_type must be one of: Situational Judgment, Clinical Skills, Mini-mock, or Mock Discussion'
      }),
    filter_status: Joi.string()
      .valid('all', 'active', 'inactive', 'scheduled')
      .optional()
      .messages({
        'any.only': 'filter_status must be one of: all, active, inactive, or scheduled'
      }),
    filter_date_from: Joi.string()
      .pattern(/^\\d{4}-\\d{2}-\\d{2}$/)
      .optional()
      .messages({
        'string.pattern.base': 'filter_date_from must be in YYYY-MM-DD format'
      }),
    filter_date_to: Joi.string()
      .pattern(/^\\d{4}-\\d{2}-\\d{2}$/)
      .optional()
      .messages({
        'string.pattern.base': 'filter_date_to must be in YYYY-MM-DD format'
      })
  }),

  // Schema for updating mock exams (Admin)
  mockExamUpdate: Joi.object({
    mock_type: Joi.string()
      .valid('Situational Judgment', 'Clinical Skills', 'Mini-mock', 'Mock Discussion')
      .optional()
      .messages({
        'any.only': 'Mock type must be one of: Situational Judgment, Clinical Skills, Mini-mock, or Mock Discussion'
      }),
    exam_date: Joi.string()
      .pattern(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .messages({
        'string.pattern.base': 'Exam date must be in YYYY-MM-DD format'
      }),
    capacity: Joi.number()
      .integer()
      .min(1)
      .max(100)
      .optional()
      .messages({
        'number.base': 'Capacity must be a number',
        'number.integer': 'Capacity must be an integer',
        'number.min': 'Capacity must be at least 1',
        'number.max': 'Capacity cannot exceed 100'
      }),
    location: Joi.string()
      .valid('Mississauga', 'Mississauga - B9', 'Mississauga - Lab D', 'Calgary', 'Vancouver', 'Montreal', 'Richmond Hill', 'Online')
      .optional()
      .messages({
        'any.only': 'Location must be one of: Mississauga, Mississauga - B9, Mississauga - Lab D, Calgary, Vancouver, Montreal, Richmond Hill, or Online'
      }),
    // HubSpot stores ALL values as STRINGS: 'true', 'false', or 'scheduled'
    // But we also accept string values 'active', 'inactive', 'scheduled' and booleans from frontend for compatibility
    is_active: Joi.alternatives()
      .try(
        Joi.boolean(),
        Joi.string().valid('true', 'false', 'scheduled', 'active', 'inactive')
      )
      .optional()
      .messages({
        'any.only': 'is_active must be boolean (true/false) or one of: "true", "false", "scheduled", "active", "inactive"',
        'alternatives.match': 'is_active must be boolean (true/false) or one of: "true", "false", "scheduled", "active", "inactive"'
      }),
    scheduled_activation_datetime: Joi.date()
      .iso()
      .greater('now')
      .when('is_active', {
        is: 'scheduled',
        then: Joi.required(),
        otherwise: Joi.optional().allow(null)
      })
      .messages({
        'date.base': 'Scheduled activation datetime must be a valid date',
        'date.format': 'Scheduled activation datetime must be in ISO format',
        'date.greater': 'Scheduled activation datetime must be in the future',
        'any.required': 'Scheduled activation datetime is required when status is scheduled'
      }),
    start_time: Joi.string()
      .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
      .optional()
      .messages({
        'string.pattern.base': 'Start time must be in HH:MM format (24-hour)'
      }),
    end_time: Joi.string()
      .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
      .optional()
      .messages({
        'string.pattern.base': 'End time must be in HH:MM format (24-hour)'
      })
  }).min(1).custom((value, helpers) => {
    // Custom validation: if both start_time and end_time are provided, end_time must be after start_time
    if (value.start_time && value.end_time) {
      const startParts = value.start_time.split(':');
      const endParts = value.end_time.split(':');
      const startMinutes = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
      const endMinutes = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);

      if (endMinutes <= startMinutes) {
        return helpers.error('custom.endTimeBeforeStart');
      }
    }

    // Custom validation: if is_active is scheduled, scheduled_activation_datetime is required
    if (value.is_active === 'scheduled' && !value.scheduled_activation_datetime) {
      return helpers.error('custom.scheduledDateRequired');
    }

    // Custom validation: if is_active is not scheduled, scheduled_activation_datetime should not be provided
    if (value.is_active && value.is_active !== 'scheduled' && value.scheduled_activation_datetime) {
      return helpers.error('custom.scheduledDateNotAllowed');
    }

    return value;
  }, 'time validation').messages({
    'object.min': 'At least one property must be provided for update',
    'custom.endTimeBeforeStart': 'End time must be after start time',
    'custom.scheduledDateRequired': 'Scheduled activation datetime is required when status is scheduled',
    'custom.scheduledDateNotAllowed': 'Scheduled activation datetime should not be provided when status is not scheduled'
  }),

  // Schema for metrics filters (Admin Dashboard)
  mockExamMetrics: Joi.object({
    date_from: Joi.string()
      .pattern(/^\\d{4}-\\d{2}-\\d{2}$/)
      .optional()
      .messages({
        'string.pattern.base': 'date_from must be in YYYY-MM-DD format'
      }),
    date_to: Joi.string()
      .pattern(/^\\d{4}-\\d{2}-\\d{2}$/)
      .optional()
      .messages({
        'string.pattern.base': 'date_to must be in YYYY-MM-DD format'
      })
  }),

  // Schema for bulk toggle status (Admin)
  bulkToggleStatus: Joi.object({
    sessionIds: Joi.array()
      .items(Joi.string().pattern(/^\d+$/))
      .min(1)
      .max(100)
      .required()
      .messages({
        'array.min': 'At least one session ID is required',
        'array.max': 'Maximum 100 sessions can be toggled at once',
        'string.pattern.base': 'Invalid session ID format',
        'any.required': 'Session IDs are required'
      })
  }),

  // Schema for bulk update mock exams (Admin)
  bulkUpdate: Joi.object({
    // Session IDs to update
    sessionIds: Joi.array()
      .items(Joi.string().pattern(/^\d+$/))
      .min(1)
      .max(100)
      .required()
      .messages({
        'array.min': 'At least one session ID is required',
        'array.max': 'Cannot update more than 100 sessions at once',
        'string.pattern.base': 'Invalid session ID format',
        'any.required': 'Session IDs are required'
      }),

    // Updates to apply to all sessions
    updates: Joi.object({
      location: Joi.string()
        .valid('Mississauga', 'Mississauga - B9', 'Mississauga - Lab D',
               'Calgary', 'Vancouver', 'Montreal', 'Richmond Hill', 'Online')
        .optional()
        .allow('')
        .messages({
          'any.only': 'Invalid location specified'
        }),

      mock_type: Joi.string()
        .valid('Situational Judgment', 'Clinical Skills', 'Mini-mock', 'Mock Discussion')
        .optional()
        .allow('')
        .messages({
          'any.only': 'Invalid mock type specified'
        }),

      capacity: Joi.number()
        .integer()
        .min(1)
        .max(100)
        .optional()
        .allow('')
        .messages({
          'number.base': 'Capacity must be a number',
          'number.integer': 'Capacity must be an integer',
          'number.min': 'Capacity must be at least 1',
          'number.max': 'Capacity cannot exceed 100'
        }),

      exam_date: Joi.string()
        .pattern(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .allow('')
        .messages({
          'string.pattern.base': 'Exam date must be in YYYY-MM-DD format'
        }),

      is_active: Joi.string()
        .valid('active', 'inactive', 'scheduled')
        .optional()
        .allow('')
        .messages({
          'any.only': 'Status must be one of: active, inactive, or scheduled'
        }),

      scheduled_activation_datetime: Joi.date()
        .iso()
        .optional()
        .allow('')
        .messages({
          'date.base': 'Scheduled activation datetime must be a valid date',
          'date.format': 'Scheduled activation datetime must be in ISO format'
        })
    })
      .min(1)  // At least one field must be present
      .custom((value, helpers) => {
        // Remove empty string values for validation
        const nonEmptyUpdates = Object.entries(value).reduce((acc, [key, val]) => {
          if (val !== '' && val !== null && val !== undefined) {
            acc[key] = val;
          }
          return acc;
        }, {});

        // Check that at least one non-empty update field is provided
        if (Object.keys(nonEmptyUpdates).length === 0) {
          return helpers.error('custom.noUpdatesProvided');
        }

        // Validate scheduled_activation_datetime when is_active='scheduled'
        if (nonEmptyUpdates.is_active === 'scheduled') {
          if (!nonEmptyUpdates.scheduled_activation_datetime) {
            return helpers.error('custom.scheduledDateRequired');
          }

          const scheduledDate = new Date(nonEmptyUpdates.scheduled_activation_datetime);
          if (scheduledDate <= new Date()) {
            return helpers.error('custom.scheduledDatePast');
          }
        }

        return value;
      })
      .required()
      .messages({
        'object.min': 'At least one update field must be provided',
        'custom.noUpdatesProvided': 'Please update at least one field',
        'custom.scheduledDateRequired': 'Scheduled activation datetime is required when status is scheduled',
        'custom.scheduledDatePast': 'Scheduled activation datetime must be in the future',
        'any.required': 'Updates object is required'
      })
  }).options({ stripUnknown: true }),

  // Schema for batch delete sessions (Admin)
  batchDeleteSessions: Joi.object({
    sessionIds: Joi.array()
      .items(Joi.string().pattern(/^\d+$/))
      .min(1)
      .max(100)
      .required()
      .messages({
        'array.min': 'At least one session ID is required',
        'array.max': 'Maximum 100 sessions can be deleted at once',
        'string.pattern.base': 'Invalid session ID format',
        'any.required': 'Session IDs are required'
      })
  }),

  // Schema for clone mock exam sessions (Admin)
  clone: Joi.object({
    cloneSources: Joi.array()
      .items(Joi.object({
        sourceSessionId: Joi.string().pattern(/^\d+$/).required(),
        sourceProperties: Joi.object({
          mock_type: Joi.string().allow('').optional(),
          location: Joi.string().allow('').optional(),
          exam_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow('').optional(),
          capacity: Joi.alternatives().try(Joi.string(), Joi.number()).allow('').optional(),
          start_time: Joi.string().allow('').optional(),
          end_time: Joi.string().allow('').optional(),
          is_active: Joi.string().valid('active', 'inactive', 'scheduled', 'Active', 'Inactive', 'Scheduled', 'true', 'false').allow('').optional(),
          scheduled_activation_datetime: Joi.string().allow('', null).optional()
        }).required()
      }))
      .min(1)
      .max(100)
      .required()
      .messages({
        'array.min': 'At least one session is required',
        'array.max': 'Cannot clone more than 100 sessions at once'
      }),

    overrides: Joi.object({
      exam_date: Joi.string()
        .pattern(/^\d{4}-\d{2}-\d{2}$/)
        .required()
        .messages({
          'string.pattern.base': 'Date must be in YYYY-MM-DD format',
          'any.required': 'New exam date is required for cloning'
        }),

      location: Joi.string().valid(
        'Mississauga', 'Mississauga - B9', 'Mississauga - Lab D',
        'Calgary', 'Vancouver', 'Montreal', 'Richmond Hill', 'Online'
      ).optional().allow(''),

      mock_type: Joi.string().valid(
        'Situational Judgment', 'Clinical Skills', 'Mini-mock', 'Mock Discussion'
      ).optional().allow(''),

      capacity: Joi.number().integer().min(1).max(100).optional().allow(''),

      start_time: Joi.string().pattern(/^\d{2}:\d{2}$/).optional().allow(''),

      end_time: Joi.string().pattern(/^\d{2}:\d{2}$/).optional().allow(''),

      is_active: Joi.string().valid('active', 'inactive', 'scheduled').optional().allow(''),

      scheduled_activation_datetime: Joi.date().iso().optional().allow('')
    })
      .custom((value, helpers) => {
        // Validate time range
        if (value.start_time && value.end_time) {
          const start = new Date(`2000-01-01T${value.start_time}`);
          const end = new Date(`2000-01-01T${value.end_time}`);
          if (start >= end) {
            return helpers.error('custom.timeRange');
          }
        }

        // Validate scheduled_activation_datetime when is_active='scheduled'
        if (value.is_active === 'scheduled') {
          if (!value.scheduled_activation_datetime) {
            return helpers.error('custom.scheduledDateRequired');
          }

          const scheduledDate = new Date(value.scheduled_activation_datetime);
          if (scheduledDate <= new Date()) {
            return helpers.error('custom.scheduledDatePast');
          }
        }

        return value;
      })
      .required()
      .messages({
        'custom.timeRange': 'Start time must be before end time',
        'custom.scheduledDateRequired': 'Scheduled activation datetime is required when status is scheduled',
        'custom.scheduledDatePast': 'Scheduled activation datetime must be in the future'
      })
  }).options({ stripUnknown: true }),

  // Schema for batch attendance update (Admin)
  batchAttendanceUpdate: Joi.object({
    bookings: Joi.array()
      .items(
        Joi.object({
          bookingId: Joi.string()
            .pattern(/^\d+$/)
            .required()
            .messages({
              'string.pattern.base': 'Booking ID must be numeric',
              'any.required': 'Booking ID is required'
            }),
          attended: Joi.alternatives()
            .try(
              Joi.boolean(),
              Joi.valid(null)
            )
            .required()
            .messages({
              'alternatives.match': 'Attended must be true, false, or null',
              'any.required': 'Attended status is required'
            }),
          notes: Joi.string()
            .max(500)
            .optional()
            .allow('')
            .messages({
              'string.max': 'Notes cannot exceed 500 characters'
            })
        })
      )
      .min(1)
      .max(100)
      .required()
      .messages({
        'array.min': 'At least one booking must be provided',
        'array.max': 'Maximum 100 bookings can be updated per request',
        'any.required': 'Bookings array is required'
      })
  }),

  // Schema for batch booking cancellation (Admin) - Supports booking objects with refund data
  batchBookingCancellation: Joi.object({
    bookings: Joi.array()
      .items(
        Joi.object({
          id: Joi.string()
            .pattern(/^\d+$/)
            .required()
            .messages({
              'string.pattern.base': 'Booking ID must be numeric',
              'any.required': 'Booking ID is required'
            }),
          token_used: Joi.string()
            .allow('')
            .optional()
            .messages({
              'string.base': 'Token used must be a string'
            }),
          associated_contact_id: Joi.string()
            .pattern(/^\d+$/)
            .allow('')
            .optional()
            .messages({
              'string.pattern.base': 'Associated contact ID must be numeric'
            }),
          name: Joi.string()
            .allow('')
            .optional()
            .messages({
              'string.base': 'Name must be a string'
            }),
          email: Joi.string()
            .email()
            .allow('')
            .optional()
            .messages({
              'string.email': 'Email must be a valid email address'
            })
        })
      )
      .min(1)
      .max(100)
      .required()
      .messages({
        'array.min': 'At least one booking must be provided',
        'array.max': 'Maximum 100 bookings can be cancelled per request',
        'any.required': 'Bookings array is required'
      }),
    refundTokens: Joi.boolean()
      .default(true)
      .optional()
      .messages({
        'boolean.base': 'refundTokens must be a boolean value'
      })
  }),

  // Schema for trainee search (Admin)
  traineeSearch: Joi.object({
    query: Joi.string()
      .min(2)
      .max(100)
      .required()
      .messages({
        'string.min': 'Search query must be at least 2 characters',
        'string.max': 'Search query cannot exceed 100 characters',
        'any.required': 'Search query is required'
      }),
    debug: Joi.boolean()
      .optional()
      .default(false)
      .messages({
        'boolean.base': 'Debug parameter must be a boolean value'
      })
  }),

  // Schema for trainee bookings (Admin)

  // Schema for admin booking creation from mock exam details
  adminBookingCreation: Joi.object({
    mock_exam_id: Joi.string()
      .required()
      .messages({
        'any.required': 'Mock exam ID is required'
      }),
    student_id: Joi.string()
      .pattern(/^[A-Z0-9]+$/)
      .required()
      .messages({
        'string.pattern.base': 'Student ID must contain only uppercase letters and numbers',
        'any.required': 'Student ID is required'
      }),
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.email': 'Please enter a valid email address',
        'any.required': 'Email is required'
      }),
    mock_type: Joi.string()
      .valid('Situational Judgment', 'Clinical Skills', 'Mini-mock', 'Mock Discussion')
      .required()
      .messages({
        'any.only': 'Mock type must be one of: Situational Judgment, Clinical Skills, Mini-mock, or Mock Discussion',
        'any.required': 'Mock type is required'
      }),
    exam_date: Joi.string()
      .pattern(/^\\d{4}-\\d{2}-\\d{2}$/)
      .required()
      .messages({
        'string.pattern.base': 'Exam date must be in YYYY-MM-DD format',
        'any.required': 'Exam date is required'
      }),
    // Conditional fields based on mock_type
    dominant_hand: Joi.alternatives()
      .try(Joi.boolean(), Joi.string().valid('true', 'false', 'Right', 'Left'))
      .when('mock_type', {
        is: 'Clinical Skills',
        then: Joi.required().messages({
          'any.required': 'Dominant hand selection is required for Clinical Skills exams'
        }),
        otherwise: Joi.optional().strip()
      }),
    attending_location: Joi.string()
      .valid('mississauga', 'calgary', 'vancouver', 'montreal', 'richmond_hill', 'Mississauga', 'Calgary', 'Vancouver', 'Montreal', 'Richmond Hill')
      .when('mock_type', {
        is: Joi.string().valid('Situational Judgment', 'Mini-mock'),
        then: Joi.required().messages({
          'any.required': 'Attending location is required for Situational Judgment and Mini-mock exams',
          'any.only': 'Location must be one of: Mississauga, Calgary, Vancouver, Montreal, or Richmond Hill'
        }),
        otherwise: Joi.optional().strip()
      })
  }),

  traineeBookings: Joi.object({
    contactId: Joi.string()
      .pattern(/^\d+$/)
      .required()
      .messages({
        'string.pattern.base': 'Contact ID must be numeric',
        'any.required': 'Contact ID is required'
      }),
    debug: Joi.boolean()
      .optional()
      .default(false)
      .messages({
        'boolean.base': 'Debug parameter must be a boolean value'
      }),
    include_inactive: Joi.boolean()
      .optional()
      .default(false)
      .messages({
        'boolean.base': 'Include inactive parameter must be a boolean value'
      })
  }),

  // Schema for updating trainee tokens (Admin)
  updateTraineeTokens: Joi.object({
    tokens: Joi.object({
      mock_discussion: Joi.number()
        .integer()
        .min(0)
        .max(9999)
        .required()
        .messages({
          'number.base': 'Mock discussion tokens must be a number',
          'number.integer': 'Mock discussion tokens must be an integer',
          'number.min': 'Mock discussion tokens cannot be negative',
          'number.max': 'Mock discussion tokens cannot exceed 9999',
          'any.required': 'Mock discussion tokens is required'
        }),
      clinical_skills: Joi.number()
        .integer()
        .min(0)
        .max(9999)
        .required()
        .messages({
          'number.base': 'Clinical skills credits must be a number',
          'number.integer': 'Clinical skills credits must be an integer',
          'number.min': 'Clinical skills credits cannot be negative',
          'number.max': 'Clinical skills credits cannot exceed 9999',
          'any.required': 'Clinical skills credits is required'
        }),
      situational_judgment: Joi.number()
        .integer()
        .min(0)
        .max(9999)
        .required()
        .messages({
          'number.base': 'Situational judgment credits must be a number',
          'number.integer': 'Situational judgment credits must be an integer',
          'number.min': 'Situational judgment credits cannot be negative',
          'number.max': 'Situational judgment credits cannot exceed 9999',
          'any.required': 'Situational judgment credits is required'
        }),
      mini_mock: Joi.number()
        .integer()
        .min(0)
        .max(9999)
        .required()
        .messages({
          'number.base': 'Mini mock credits must be a number',
          'number.integer': 'Mini mock credits must be an integer',
          'number.min': 'Mini mock credits cannot be negative',
          'number.max': 'Mini mock credits cannot exceed 9999',
          'any.required': 'Mini mock credits is required'
        }),
      shared_mock: Joi.number()
        .integer()
        .min(0)
        .max(9999)
        .optional()
        .default(0)
        .messages({
          'number.base': 'Shared mock credits must be a number',
          'number.integer': 'Shared mock credits must be an integer',
          'number.min': 'Shared mock credits cannot be negative',
          'number.max': 'Shared mock credits cannot exceed 9999'
        })
    }).required()
      .messages({
        'any.required': 'Tokens object is required'
      })
  })

};

/**
 * Validate input data against a schema
 * @param {object} data - Data to validate
 * @param {string} schemaName - Name of the schema to use
 * @returns {object} Validated data
 * @throws {Error} Validation error with details
 */
async function validateInput(data, schemaName) {
  const schema = schemas[schemaName];

  if (!schema) {
    throw new Error(`Validation schema '${schemaName}' not found`);
  }

  const { error, value } = schema.validate(data, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const errorMessages = error.details.map(detail => detail.message);
    const validationError = new Error(errorMessages.join(', '));
    validationError.status = 400;
    validationError.validationErrors = errorMessages;
    throw validationError;
  }

  return value;
}

/**
 * Express middleware for request validation
 * @param {string} schemaName - Name of the schema to validate against
 */
function validationMiddleware(schemaName) {
  return async (req, res, next) => {
    try {
      console.log(`🔍 [VALIDATION-MIDDLEWARE] Validating with schema: ${schemaName}`);

      // Combine query params and body for validation
      const dataToValidate = {
        ...req.query,
        ...req.body
      };

      console.log('🔍 [VALIDATION-MIDDLEWARE] Data to validate:', dataToValidate);
      console.log('🔍 [VALIDATION-MIDDLEWARE] Data keys:', Object.keys(dataToValidate));
      console.log('🔍 [VALIDATION-MIDDLEWARE] Data types:', Object.keys(dataToValidate).map(k => `${k}: ${typeof dataToValidate[k]}`));

      const validatedData = await validateInput(dataToValidate, schemaName);

      console.log('✅ [VALIDATION-MIDDLEWARE] Validation successful');
      console.log('✅ [VALIDATION-MIDDLEWARE] Validated data:', validatedData);

      // Store validated data for use in route handler
      req.validatedData = validatedData;
      next();
    } catch (error) {
      console.error('❌ [VALIDATION-MIDDLEWARE] Validation failed');
      console.error('❌ [VALIDATION-MIDDLEWARE] Error message:', error.message);
      console.error('❌ [VALIDATION-MIDDLEWARE] Validation errors:', error.validationErrors);
      console.error('❌ [VALIDATION-MIDDLEWARE] Full error:', error);

      res.status(error.status || 400).json({
        success: false,
        error: error.message,
        validationErrors: error.validationErrors || []
      });
    }
  };
}

module.exports = {
  // Schema for updating trainee tokens (Admin)
  updateTraineeTokens: Joi.object({
    tokens: Joi.object({
      mock_discussion: Joi.number()
        .integer()
        .min(0)
        .max(9999)
        .required()
        .messages({
          'number.base': 'Mock discussion tokens must be a number',
          'number.integer': 'Mock discussion tokens must be an integer',
          'number.min': 'Mock discussion tokens cannot be negative',
          'number.max': 'Mock discussion tokens cannot exceed 9999',
          'any.required': 'Mock discussion tokens is required'
        }),
      clinical_skills: Joi.number()
        .integer()
        .min(0)
        .max(9999)
        .required()
        .messages({
          'number.base': 'Clinical skills credits must be a number',
          'number.integer': 'Clinical skills credits must be an integer',
          'number.min': 'Clinical skills credits cannot be negative',
          'number.max': 'Clinical skills credits cannot exceed 9999',
          'any.required': 'Clinical skills credits is required'
        }),
      situational_judgment: Joi.number()
        .integer()
        .min(0)
        .max(9999)
        .required()
        .messages({
          'number.base': 'Situational judgment credits must be a number',
          'number.integer': 'Situational judgment credits must be an integer',
          'number.min': 'Situational judgment credits cannot be negative',
          'number.max': 'Situational judgment credits cannot exceed 9999',
          'any.required': 'Situational judgment credits is required'
        }),
      mini_mock: Joi.number()
        .integer()
        .min(0)
        .max(9999)
        .required()
        .messages({
          'number.base': 'Mini mock credits must be a number',
          'number.integer': 'Mini mock credits must be an integer',
          'number.min': 'Mini mock credits cannot be negative',
          'number.max': 'Mini mock credits cannot exceed 9999',
          'any.required': 'Mini mock credits is required'
        }),
      shared_mock: Joi.number()
        .integer()
        .min(0)
        .max(9999)
        .optional()
        .default(0)
        .messages({
          'number.base': 'Shared mock credits must be a number',
          'number.integer': 'Shared mock credits must be an integer',
          'number.min': 'Shared mock credits cannot be negative',
          'number.max': 'Shared mock credits cannot exceed 9999'
        })
    }).required()
      .messages({
        'any.required': 'Tokens object is required'
      })
  }),
  schemas,
  validateInput,
  validationMiddleware
};