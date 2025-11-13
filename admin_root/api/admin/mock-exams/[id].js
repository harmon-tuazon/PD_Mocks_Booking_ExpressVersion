/**
 * GET /api/admin/mock-exams/[id]
 * Get single mock exam details by ID
 *
 * PATCH /api/admin/mock-exams/[id]
 * Update mock exam properties
 *
 * Implements Redis caching with 2-minute TTL for performance optimization.
 * Returns complete mock exam details including calculated fields.
 */

const { requireAdmin } = require('../middleware/requireAdmin');
const { getCache } = require('../../_shared/cache');
const hubspot = require('../../_shared/hubspot');
const { validateInput } = require('../../_shared/validation');
const { HUBSPOT_OBJECTS } = require('../../_shared/hubspot');

module.exports = async (req, res) => {
  // Handle PATCH request for updating mock exam
  if (req.method === 'PATCH') {
    return handlePatchRequest(req, res);
  }

  // Handle GET request for fetching mock exam details
  if (req.method === 'GET') {
    return handleGetRequest(req, res);
  }

  // Method not allowed
  return res.status(405).json({
    success: false,
    error: `Method ${req.method} not allowed`
  });
};

/**
 * Handle PATCH request to update mock exam
 */
async function handlePatchRequest(req, res) {
  try {
    // Verify admin authentication
    const user = await requireAdmin(req);
    const adminEmail = user?.email || 'admin@prepdoctors.ca';

    // In Vercel serverless functions, dynamic route params come through req.query
    const mockExamId = req.query.id;

    // Validate ID format
    if (!mockExamId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_ID',
          message: 'Mock exam ID is required'
        }
      });
    }

    // Validate ID format (should be numeric)
    if (!/^\d+$/.test(mockExamId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'Invalid mock exam ID format'
        }
      });
    }

    // Create custom validation schema for update with runtime capacity check
    const Joi = require('joi');
    const updateSchema = Joi.object({
      mock_type: Joi.string()
        .valid('Situational Judgment', 'Clinical Skills', 'Mini-mock', 'Mock Discussion')
        .optional(),
      exam_date: Joi.string()
        .pattern(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .custom((value, helpers) => {
          const examDate = new Date(value);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (examDate < today) {
            return helpers.error('custom.dateInPast');
          }
          return value;
        }, 'date validation'),
      start_time: Joi.string()
        .pattern(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/)
        .optional(),
      end_time: Joi.string()
        .pattern(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/)
        .optional(),
      capacity: Joi.number()
        .integer()
        .min(1)
        .optional(),
      location: Joi.string()
        .valid('Mississauga', 'Mississauga - B9', 'Mississauga - Lab D', 'Calgary', 'Vancouver', 'Montreal', 'Richmond Hill', 'Online')
        .optional(),
      address: Joi.string()
        .max(500)
        .optional()
        .allow('', null),
      is_active: Joi.boolean()
        .optional()
    })
    .min(1)
    .custom((value, helpers) => {
      // Validate end_time > start_time if both provided
      if (value.start_time && value.end_time) {
        const startParts = value.start_time.split(':');
        const endParts = value.end_time.split(':');
        const startSeconds = parseInt(startParts[0]) * 3600 + parseInt(startParts[1]) * 60 + parseInt(startParts[2] || 0);
        const endSeconds = parseInt(endParts[0]) * 3600 + parseInt(endParts[1]) * 60 + parseInt(endParts[2] || 0);

        if (endSeconds <= startSeconds) {
          return helpers.error('custom.endTimeBeforeStart');
        }
      }
      return value;
    }, 'time validation')
    .messages({
      'object.min': 'At least one property must be provided for update',
      'custom.endTimeBeforeStart': 'End time must be after start time',
      'custom.dateInPast': 'Exam date cannot be in the past'
    });

    // Validate request body
    const { error: validationError, value: updateData } = updateSchema.validate(req.body);
    if (validationError) {
      const details = {};
      validationError.details.forEach(detail => {
        details[detail.path[0]] = detail.message;
      });

      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
          details
        }
      });
    }

    // Fetch current mock exam data to check constraints
    let currentExam;
    try {
      currentExam = await hubspot.getMockExam(mockExamId);
    } catch (error) {
      if (error.message?.includes('404') || error.message?.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'EXAM_NOT_FOUND',
            message: `Mock exam with ID ${mockExamId} not found`
          }
        });
      }
      throw error;
    }

    // Store original values for audit trail
    const originalValues = { ...currentExam.properties };

    // Check capacity constraint if being updated
    if (updateData.capacity !== undefined) {
      const currentBookings = parseInt(currentExam.properties.total_bookings) || 0;

      if (updateData.capacity < currentBookings) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'BOOKING_CONFLICT',
            message: 'Cannot reduce capacity below current bookings',
            details: {
              requested_capacity: updateData.capacity,
              current_bookings: currentBookings,
              minimum_required: currentBookings
            }
          }
        });
      }
    }

    // Convert time strings to Unix timestamps if provided
    const propertiesToUpdate = {};

    if (updateData.mock_type !== undefined) {
      propertiesToUpdate.mock_type = updateData.mock_type;
    }

    if (updateData.exam_date !== undefined) {
      propertiesToUpdate.exam_date = updateData.exam_date;
    }

    if (updateData.start_time !== undefined) {
      // Convert HH:MM:SS to Unix timestamp
      const examDate = updateData.exam_date || currentExam.properties.exam_date;
      propertiesToUpdate.start_time = hubspot.convertToTimestamp(
        examDate,
        updateData.start_time.substring(0, 5) // Extract HH:MM
      );
    }

    if (updateData.end_time !== undefined) {
      // Convert HH:MM:SS to Unix timestamp
      const examDate = updateData.exam_date || currentExam.properties.exam_date;
      propertiesToUpdate.end_time = hubspot.convertToTimestamp(
        examDate,
        updateData.end_time.substring(0, 5) // Extract HH:MM
      );
    }

    if (updateData.capacity !== undefined) {
      propertiesToUpdate.capacity = updateData.capacity;
    }

    if (updateData.location !== undefined) {
      propertiesToUpdate.location = updateData.location;
    }

    if (updateData.address !== undefined) {
      propertiesToUpdate.address = updateData.address;
    }

    if (updateData.is_active !== undefined) {
      propertiesToUpdate.is_active = updateData.is_active ? 'true' : 'false';
    }

    // Track which fields were actually changed
    const changedFields = [];
    for (const [key, value] of Object.entries(propertiesToUpdate)) {
      if (originalValues[key] !== value) {
        changedFields.push(key);
      }
    }

    // If no actual changes, return success without updating
    if (changedFields.length === 0) {
      return res.status(200).json({
        success: true,
        data: formatMockExamResponse(currentExam),
        meta: {
          timestamp: new Date().toISOString(),
          updated_by: adminEmail,
          changes: []
        }
      });
    }

    // Update mock exam in HubSpot
    const updatedExam = await hubspot.updateMockExam(mockExamId, propertiesToUpdate);

    // Invalidate related caches
    const cache = getCache();

    // Invalidate the specific exam detail cache
    await cache.delete(`admin:mock-exam:details:${mockExamId}`);

    // Invalidate aggregates cache (since capacity/status might have changed)
    await cache.deletePattern('admin:aggregates:*');

    // Invalidate aggregate sessions cache
    await cache.deletePattern(`admin:aggregate:sessions:*`);

    // Invalidate metrics cache
    await cache.deletePattern('admin:metrics:*');

    console.log(`🔄 [Cache Invalidated] Mock exam ${mockExamId} and related caches`);

    // Create audit trail note asynchronously (non-blocking)
    createAuditNote(mockExamId, originalValues, propertiesToUpdate, changedFields, adminEmail, updateData).catch(error => {
      console.error('Failed to create audit note:', error);
      // Don't fail the update if note creation fails
    });

    // Fetch the updated exam with all properties for response
    const refreshedExam = await hubspot.getMockExam(mockExamId);

    // Return success response
    res.status(200).json({
      success: true,
      data: formatMockExamResponse(refreshedExam),
      meta: {
        timestamp: new Date().toISOString(),
        updated_by: adminEmail,
        changes: changedFields
      }
    });

  } catch (error) {
    // Handle authentication errors
    if (error.message?.includes('authorization') ||
        error.message?.includes('token') ||
        error.message?.includes('Authentication')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Valid admin authentication required'
        }
      });
    }

    console.error('Error updating mock exam:', error);

    // Return generic server error
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to update mock exam'
      }
    });
  }
}

/**
 * Handle GET request to fetch mock exam details
 */
async function handleGetRequest(req, res) {
  try {
    // Verify admin authentication
    const user = await requireAdmin(req);

    // In Vercel serverless functions, dynamic route params come through req.query
    const mockExamId = req.query.id;

    // Validate ID format
    if (!mockExamId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_ID',
          message: 'Mock exam ID is required'
        }
      });
    }

    // Validate ID format (should be numeric)
    if (!/^\d+$/.test(mockExamId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'Invalid mock exam ID format'
        }
      });
    }

    // Initialize cache
    const cache = getCache();
    const cacheKey = `admin:mock-exam:details:${mockExamId}`;

    // Check cache first
    const cachedData = await cache.get(cacheKey);
    if (cachedData) {
      console.log(`🎯 [Cache HIT] Mock exam details ${mockExamId}`);
      return res.status(200).json({
        ...cachedData,
        meta: {
          ...cachedData.meta,
          cached: true
        }
      });
    }

    console.log(`📋 [Cache MISS] Fetching mock exam ${mockExamId} from HubSpot`);

    // Fetch mock exam from HubSpot with all required properties
    let mockExam;
    try {
      // Fetch with extended properties including timestamps and address
      const response = await hubspot.apiCall('GET',
        `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/${mockExamId}?properties=mock_type,exam_date,start_time,end_time,location,address,capacity,total_bookings,is_active,status,hs_createdate,hs_lastmodifieddate`
      );
      mockExam = response;
    } catch (error) {
      // Handle 404 specifically
      if (error.message?.includes('404') || error.message?.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: 'Mock exam not found'
        });
      }
      throw error;
    }

    // Build response using format helper
    const response = formatMockExamResponse(mockExam);

    // If this is a Mock Discussion, fetch prerequisite associations
    if (mockExam.properties.mock_type === 'Mock Discussion') {
      try {
        const PREREQUISITE_ASSOCIATION_TYPE_ID = 1340;
        const prerequisites = await hubspot.getMockExamAssociations(
          mockExamId,
          PREREQUISITE_ASSOCIATION_TYPE_ID
        );

        // Format prerequisite details
        const prerequisiteDetails = prerequisites.map(exam => ({
          id: exam.id,
          mock_type: exam.properties.mock_type,
          exam_date: exam.properties.exam_date,
          location: exam.properties.location || 'Not specified',
          start_time: exam.properties.start_time,
          end_time: exam.properties.end_time,
          capacity: parseInt(exam.properties.capacity || '0'),
          total_bookings: parseInt(exam.properties.total_bookings || '0'),
          is_active: exam.properties.is_active === 'true'
        }));

        // Sort by exam date (earliest first)
        prerequisiteDetails.sort((a, b) => {
          const dateA = new Date(a.exam_date);
          const dateB = new Date(b.exam_date);
          return dateA - dateB;
        });

        // Add prerequisite exams to response data
        response.data.prerequisite_exams = prerequisiteDetails;
        response.data.prerequisite_exam_ids = prerequisites.map(p => p.id);

        console.log(`📚 Included ${prerequisiteDetails.length} prerequisite associations for Mock Discussion ${mockExamId}`);
      } catch (error) {
        console.error('Error fetching prerequisite associations:', error);
        // Don't fail the entire request if prerequisites can't be fetched
        response.data.prerequisite_exams = [];
        response.data.prerequisite_exam_ids = [];
      }
    }

    // Cache the response (2 minutes TTL = 120 seconds)
    await cache.set(cacheKey, response, 120);
    console.log(`💾 [Cached] Mock exam details ${mockExamId} for 2 minutes`);

    res.status(200).json(response);

  } catch (error) {
    // Handle authentication errors first
    if (error.message?.includes('authorization') ||
        error.message?.includes('token') ||
        error.message?.includes('Authentication')) {
      return res.status(401).json({
        success: false,
        error: 'Authentication failed'
      });
    }

    console.error('Error fetching mock exam details:', error);

    // Return generic server error
    res.status(500).json({
      success: false,
      error: 'Failed to fetch mock exam details'
    });
  }
}

/**
 * Format mock exam data for response
 */
function formatMockExamResponse(mockExam) {
  const properties = mockExam.properties;

  // Parse numeric values with proper defaults
  const capacity = parseInt(properties.capacity) || 0;
  const totalBookings = parseInt(properties.total_bookings) || 0;
  const availableSlots = Math.max(0, capacity - totalBookings);

    // Convert timestamps to readable time format
    const formatTime = (timeValue) => {
      if (!timeValue) return null;

      try {
        // Handle ISO 8601 format (e.g., "2025-12-25T19:00:00Z")
        if (typeof timeValue === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(timeValue)) {
          const date = new Date(timeValue);
          if (!isNaN(date.getTime())) {
            // Convert UTC to Toronto timezone and return HH:mm format
            const torontoTime = date.toLocaleString('en-US', {
              timeZone: 'America/Toronto',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            });
            // Extract just HH:MM (remove any extra formatting)
            const timeParts = torontoTime.split(':');
            return `${timeParts[0]}:${timeParts[1]}`;
          }
        }

        // Handle Unix timestamp (milliseconds)
        const timestamp = typeof timeValue === 'string' ? parseInt(timeValue) : timeValue;
        if (!isNaN(timestamp)) {
          const date = new Date(timestamp);
          if (!isNaN(date.getTime())) {
            // Convert to Toronto timezone and return HH:mm format
            const torontoTime = date.toLocaleString('en-US', {
              timeZone: 'America/Toronto',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            });
            // Extract just HH:MM (remove any extra formatting)
            const timeParts = torontoTime.split(':');
            return `${timeParts[0]}:${timeParts[1]}`;
          }
        }
      } catch (e) {
        console.error('Error formatting time:', e);
      }

      return null;
    };;

    // Format date to ISO string
    const formatDate = (dateValue) => {
      if (!dateValue) return null;

      try {
        // Handle various date formats
        if (typeof dateValue === 'string') {
          // If already in YYYY-MM-DD format, return as is
          if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
            return dateValue;
          }
          // Otherwise parse and format
          const date = new Date(dateValue);
          if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
          }
        }
      } catch (e) {
        console.error('Error formatting date:', e);
      }

      return dateValue;
    };

    // Format timestamps for created_at and updated_at
    const formatTimestamp = (timestamp) => {
      if (!timestamp) return null;

      try {
        const date = new Date(timestamp);
        if (!isNaN(date.getTime())) {
          return date.toISOString();
        }
      } catch (e) {
        console.error('Error formatting timestamp:', e);
      }

      return null;
    };

  // Determine status from is_active if status property not available
  let status = properties.status || 'active';
  if (!properties.status) {
    // Derive status from is_active and exam date
    const isActive = properties.is_active === 'true';
    if (!isActive) {
      status = 'inactive';
    } else if (properties.exam_date) {
      const examDate = new Date(properties.exam_date);
      const now = new Date();
      if (examDate < now) {
        status = 'completed';
      } else {
        status = 'active';
      }
    }
  }

  // Build response
  return {
    success: true,
    data: {
      id: mockExam.id,
      mock_type: properties.mock_type || null,
      exam_date: formatDate(properties.exam_date),
      start_time: formatTime(properties.start_time),
      end_time: formatTime(properties.end_time),
      capacity: capacity,
      total_bookings: totalBookings,
      available_slots: availableSlots,
      location: properties.location || null,
      address: properties.address || null,
      is_active: properties.is_active === 'true',
      status: status,
      created_at: formatTimestamp(properties.hs_createdate),
      updated_at: formatTimestamp(properties.hs_lastmodifieddate)
    },
    meta: {
      timestamp: new Date().toISOString(),
      cached: false
    }
  };
}

/**
 * Create an audit trail note in HubSpot for mock exam changes
 * This follows the pattern from user_root createBookingNote and createBookingCancellationNote
 *
 * @param {string} mockExamId - The HubSpot mock exam object ID
 * @param {object} originalValues - Original property values before update
 * @param {object} updatedValues - New property values being set
 * @param {array} changedFields - List of field names that were changed
 * @param {string} adminEmail - Email of admin making the change
 * @param {object} requestData - Original request data for formatting display values
 */
async function createAuditNote(mockExamId, originalValues, updatedValues, changedFields, adminEmail, requestData) {
  try {
    // Format date for display
    const updateTimestamp = new Date();
    const formattedTimestamp = updateTimestamp.toLocaleString('en-US', {
      timeZone: 'America/Toronto',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    // Format exam date if it was changed or exists
    const examDate = requestData.exam_date || originalValues.exam_date;
    const formattedExamDate = examDate ? new Date(examDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }) : 'Date TBD';

    // Helper function to format time from Unix timestamp to HH:MM:SS
    const formatTimeFromTimestamp = (timestamp) => {
      if (!timestamp) return 'Not set';
      const date = new Date(parseInt(timestamp));
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    };

    // Build the changes list HTML
    let changesHtml = '';
    changedFields.forEach(field => {
      let oldValue = originalValues[field];
      let newValue = updatedValues[field];

      // Special formatting for different field types
      if (field === 'start_time' || field === 'end_time') {
        oldValue = formatTimeFromTimestamp(oldValue);
        newValue = requestData[field] || formatTimeFromTimestamp(newValue);
      } else if (field === 'is_active') {
        oldValue = oldValue === 'true' ? 'Active' : 'Inactive';
        newValue = newValue === 'true' ? 'Active' : 'Inactive';
      } else if (field === 'capacity' || field === 'total_bookings') {
        oldValue = oldValue || '0';
        newValue = newValue || '0';
      }

      // Format field name for display
      const fieldDisplayName = field
        .replace(/_/g, ' ')
        .replace(/\b\w/g, char => char.toUpperCase());

      changesHtml += `<li><strong>${fieldDisplayName}:</strong> ${oldValue} → ${newValue}</li>`;
    });

    // Create the full HTML note body
    const noteBody = `
      <h3>📝 Mock Exam Updated</h3>

      <p><strong>Edit Details:</strong></p>
      <ul>
        <li><strong>Mock Exam ID:</strong> ${mockExamId}</li>
        <li><strong>Mock Type:</strong> ${originalValues.mock_type || 'Not specified'}</li>
        <li><strong>Exam Date:</strong> ${formattedExamDate}</li>
        <li><strong>Updated At:</strong> ${formattedTimestamp}</li>
        <li><strong>Updated By:</strong> ${adminEmail}</li>
      </ul>

      <p><strong>Changes Made:</strong></p>
      <ul>
        ${changesHtml}
      </ul>

      <hr style="margin: 15px 0; border: 0; border-top: 1px solid #e0e0e0;">
      <p style="font-size: 12px; color: #666;">
        <em>This mock exam was updated via the PrepDoctors Admin Dashboard.</em>
      </p>
    `;

    // Create the note in HubSpot
    const notePayload = {
      properties: {
        hs_note_body: noteBody,
        hs_timestamp: updateTimestamp.getTime()
      }
    };

    // Create the note
    const noteResponse = await hubspot.apiCall('POST', '/crm/v3/objects/notes', notePayload);

    // Associate the mock exam with the note (reversed direction - Mock Exam → Note, type 1249)
    await hubspot.apiCall('PUT',
      `/crm/v4/objects/${HUBSPOT_OBJECTS.mock_exams}/${mockExamId}/associations/0-46/${noteResponse.id}`,
      [{
        associationCategory: 'USER_DEFINED',
        associationTypeId: 1249 // Correct type for Mock Exams → Notes
      }]
    );

    console.log(`✅ [Audit Note Created] for mock exam ${mockExamId} update`);

  } catch (error) {
    console.error('Error creating audit note:', error);
    // Don't throw - this is a non-blocking operation
  }
}