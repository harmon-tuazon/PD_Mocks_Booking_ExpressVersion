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
    is_active: Joi.boolean()
      .optional()
      .default(true)
      .messages({
        'boolean.base': 'is_active must be a boolean value'
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
      is_active: Joi.boolean()
        .optional()
        .default(true)
        .messages({
          'boolean.base': 'is_active must be a boolean value'
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
      })
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
      .valid('exam_date', 'start_time', 'capacity', 'total_bookings', 'location', 'mock_type', 'is_active', 'hs_createdate', 'hs_lastmodifieddate')
      .optional()
      .default('exam_date')
      .messages({
        'any.only': 'sort_by must be one of: exam_date, start_time, capacity, total_bookings, location, mock_type, is_active, hs_createdate, hs_lastmodifieddate'
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
      .valid('all', 'active', 'inactive')
      .optional()
      .messages({
        'any.only': 'filter_status must be one of: all, active, or inactive'
      }),
    filter_date_from: Joi.string()
      .pattern(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .messages({
        'string.pattern.base': 'filter_date_from must be in YYYY-MM-DD format'
      }),
    filter_date_to: Joi.string()
      .pattern(/^\d{4}-\d{2}-\d{2}$/)
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
    is_active: Joi.boolean()
      .optional()
      .messages({
        'boolean.base': 'is_active must be a boolean value'
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

    return value;
  }, 'time validation').messages({
    'object.min': 'At least one property must be provided for update',
    'custom.endTimeBeforeStart': 'End time must be after start time'
  }),

  // Schema for metrics filters (Admin Dashboard)
  mockExamMetrics: Joi.object({
    date_from: Joi.string()
      .pattern(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .messages({
        'string.pattern.base': 'date_from must be in YYYY-MM-DD format'
      }),
    date_to: Joi.string()
      .pattern(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .messages({
        'string.pattern.base': 'date_to must be in YYYY-MM-DD format'
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
  schemas,
  validateInput,
  validationMiddleware
};