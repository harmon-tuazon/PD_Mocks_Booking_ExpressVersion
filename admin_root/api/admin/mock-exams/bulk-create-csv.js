/**
 * POST /api/admin/mock-exams/bulk-create-csv
 * Bulk create mock exams from CSV data with two-step preview and validation
 *
 * This endpoint allows admins to create multiple mock exams at once
 * by uploading CSV data with required and optional fields.
 *
 * Query Parameters:
 * - preview=true: Returns validation results only without creating exams
 *
 * Required CSV Columns:
 * - mock_type: Situational Judgment, Clinical Skills, Mini-mock, Mock Discussion
 * - exam_date: YYYY-MM-DD format
 * - capacity: 1-100
 * - location: Mississauga, Calgary, Vancouver, Montreal, Richmond Hill, Online, etc.
 * - start_time: HH:MM (24-hour format)
 * - end_time: HH:MM (24-hour format)
 *
 * Optional CSV Columns:
 * - mock_set: A-H (not applicable for Mini-mock)
 * - is_active: true, false, scheduled (default: true)
 * - scheduled_activation_datetime: ISO datetime (required if is_active = scheduled)
 */

const { requirePermission } = require('../middleware/requirePermission');
const { HubSpotService } = require('../../_shared/hubspot');
const { syncExamToSupabase } = require('../../_shared/supabase-data');
const { getCache } = require('../../_shared/cache');

// ============== CONSTANTS ==============

const MAX_ROWS = 50;

const VALID_MOCK_TYPES = [
  'Situational Judgment',
  'Clinical Skills',
  'Mini-mock',
  'Mock Discussion'
];

// Mock type aliases for flexible input
const MOCK_TYPE_ALIASES = {
  // Situational Judgment
  'situational judgment': 'Situational Judgment',
  'situational': 'Situational Judgment',
  'sj': 'Situational Judgment',

  // Clinical Skills
  'clinical skills': 'Clinical Skills',
  'clinical': 'Clinical Skills',
  'cs': 'Clinical Skills',

  // Mini-mock
  'mini-mock': 'Mini-mock',
  'mini mock': 'Mini-mock',
  'minimock': 'Mini-mock',
  'mini': 'Mini-mock',
  'sjmini': 'Mini-mock',

  // Mock Discussion
  'mock discussion': 'Mock Discussion',
  'discussion': 'Mock Discussion',
  'md': 'Mock Discussion'
};

const VALID_LOCATIONS = [
  'Mississauga',
  'Mississauga - B9',
  'Mississauga - Lab D',
  'Calgary',
  'Vancouver',
  'Montreal',
  'Richmond Hill',
  'Online'
];

// Location aliases for flexible input
const LOCATION_ALIASES = {
  'mississauga': 'Mississauga',
  'mississauga - b9': 'Mississauga - B9',
  'mississauga b9': 'Mississauga - B9',
  'b9': 'Mississauga - B9',
  'mississauga - lab d': 'Mississauga - Lab D',
  'mississauga lab d': 'Mississauga - Lab D',
  'lab d': 'Mississauga - Lab D',
  'calgary': 'Calgary',
  'vancouver': 'Vancouver',
  'montreal': 'Montreal',
  'richmond hill': 'Richmond Hill',
  'richmondhill': 'Richmond Hill',
  'online': 'Online'
};

const VALID_MOCK_SETS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

const VALID_IS_ACTIVE = ['true', 'false', 'scheduled'];

// ============== INPUT SANITIZATION ==============

/**
 * Sanitize string input to prevent XSS and injection
 */
function sanitizeString(value, maxLength = 255) {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'string') {
    value = String(value);
  }
  return value
    .trim()
    .slice(0, maxLength)
    .replace(/[<>\"\'\\;]/g, '')
    .replace(/[\x00-\x1F\x7F]/g, '');
}

/**
 * Normalize mock type input
 */
function normalizeMockType(input) {
  if (!input) return null;
  const normalized = String(input).toLowerCase().trim();

  // Check aliases first
  if (MOCK_TYPE_ALIASES[normalized]) {
    return MOCK_TYPE_ALIASES[normalized];
  }

  // Check exact match (case-insensitive)
  const exactMatch = VALID_MOCK_TYPES.find(t => t.toLowerCase() === normalized);
  return exactMatch || null;
}

/**
 * Normalize location input
 */
function normalizeLocation(input) {
  if (!input) return null;
  const normalized = String(input).toLowerCase().trim();

  // Check aliases first
  if (LOCATION_ALIASES[normalized]) {
    return LOCATION_ALIASES[normalized];
  }

  // Check exact match (case-insensitive)
  const exactMatch = VALID_LOCATIONS.find(l => l.toLowerCase() === normalized);
  return exactMatch || null;
}

/**
 * Normalize mock set input
 */
function normalizeMockSet(input) {
  if (!input || input === '') return null;
  const normalized = String(input).toUpperCase().trim();
  return VALID_MOCK_SETS.includes(normalized) ? normalized : null;
}

/**
 * Normalize is_active input
 */
function normalizeIsActive(input) {
  if (!input || input === '') return 'true'; // Default
  const normalized = String(input).toLowerCase().trim();

  // Handle common variations
  if (normalized === 'active' || normalized === 'yes' || normalized === '1') return 'true';
  if (normalized === 'inactive' || normalized === 'no' || normalized === '0') return 'false';
  if (normalized === 'scheduled') return 'scheduled';
  if (normalized === 'true' || normalized === 'false') return normalized;

  return null; // Invalid
}

/**
 * Validate date format (YYYY-MM-DD)
 */
function isValidDate(dateStr) {
  if (!dateStr) return false;
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;

  const date = new Date(dateStr);
  return date instanceof Date && !isNaN(date);
}

/**
 * Validate time format (HH:MM)
 */
function isValidTime(timeStr) {
  if (!timeStr) return false;
  const regex = /^\d{2}:\d{2}$/;
  if (!regex.test(timeStr)) return false;

  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

/**
 * Validate ISO datetime
 */
function isValidISODatetime(datetimeStr) {
  if (!datetimeStr) return false;
  const date = new Date(datetimeStr);
  return date instanceof Date && !isNaN(date);
}

/**
 * Parse CSV string into rows
 */
function parseCSV(csvData) {
  const lines = csvData.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) {
    return { headers: [], rows: [] };
  }

  const headers = lines[0].split(',').map(h => sanitizeString(h.toLowerCase().replace(/\s+/g, '_')));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    // Handle quoted values with commas
    const values = [];
    let current = '';
    let inQuotes = false;

    for (const char of lines[i]) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current);

    const row = { _rowNumber: i + 1 };
    headers.forEach((header, index) => {
      row[header] = sanitizeString(values[index] || '');
    });
    rows.push(row);
  }

  return { headers, rows };
}

/**
 * Validate a single row
 */
function validateRow(row) {
  const errors = [];
  const normalized = {};

  // ========== REQUIRED FIELDS ==========

  // mock_type (required)
  if (!row.mock_type) {
    errors.push({ field: 'mock_type', code: 'MISSING_VALUE', message: 'mock_type is required' });
  } else {
    const mockType = normalizeMockType(row.mock_type);
    if (!mockType) {
      errors.push({
        field: 'mock_type',
        code: 'INVALID_MOCK_TYPE',
        message: `Invalid mock_type '${row.mock_type}'. Valid types: ${VALID_MOCK_TYPES.join(', ')}`
      });
    } else {
      normalized.mock_type = mockType;
    }
  }

  // exam_date (required)
  if (!row.exam_date) {
    errors.push({ field: 'exam_date', code: 'MISSING_VALUE', message: 'exam_date is required' });
  } else if (!isValidDate(row.exam_date)) {
    errors.push({
      field: 'exam_date',
      code: 'INVALID_DATE',
      message: `Invalid exam_date '${row.exam_date}'. Format: YYYY-MM-DD`
    });
  } else {
    normalized.exam_date = row.exam_date;
  }

  // capacity (required)
  if (!row.capacity) {
    errors.push({ field: 'capacity', code: 'MISSING_VALUE', message: 'capacity is required' });
  } else {
    const capacity = parseInt(row.capacity, 10);
    if (isNaN(capacity) || capacity < 1 || capacity > 100) {
      errors.push({
        field: 'capacity',
        code: 'INVALID_CAPACITY',
        message: `Invalid capacity '${row.capacity}'. Must be a number between 1 and 100`
      });
    } else {
      normalized.capacity = capacity;
    }
  }

  // location (required)
  if (!row.location) {
    errors.push({ field: 'location', code: 'MISSING_VALUE', message: 'location is required' });
  } else {
    const location = normalizeLocation(row.location);
    if (!location) {
      errors.push({
        field: 'location',
        code: 'INVALID_LOCATION',
        message: `Invalid location '${row.location}'. Valid locations: ${VALID_LOCATIONS.join(', ')}`
      });
    } else {
      normalized.location = location;
    }
  }

  // start_time (required)
  if (!row.start_time) {
    errors.push({ field: 'start_time', code: 'MISSING_VALUE', message: 'start_time is required' });
  } else if (!isValidTime(row.start_time)) {
    errors.push({
      field: 'start_time',
      code: 'INVALID_TIME',
      message: `Invalid start_time '${row.start_time}'. Format: HH:MM (24-hour)`
    });
  } else {
    normalized.start_time = row.start_time;
  }

  // end_time (required)
  if (!row.end_time) {
    errors.push({ field: 'end_time', code: 'MISSING_VALUE', message: 'end_time is required' });
  } else if (!isValidTime(row.end_time)) {
    errors.push({
      field: 'end_time',
      code: 'INVALID_TIME',
      message: `Invalid end_time '${row.end_time}'. Format: HH:MM (24-hour)`
    });
  } else {
    normalized.end_time = row.end_time;
  }

  // Validate start_time < end_time
  if (normalized.start_time && normalized.end_time) {
    const start = new Date(`2000-01-01T${normalized.start_time}`);
    const end = new Date(`2000-01-01T${normalized.end_time}`);
    if (start >= end) {
      errors.push({
        field: 'end_time',
        code: 'INVALID_TIME_RANGE',
        message: 'end_time must be after start_time'
      });
    }
  }

  // ========== OPTIONAL FIELDS ==========

  // mock_set (optional)
  if (row.mock_set && row.mock_set !== '') {
    const mockSet = normalizeMockSet(row.mock_set);
    if (!mockSet) {
      errors.push({
        field: 'mock_set',
        code: 'INVALID_MOCK_SET',
        message: `Invalid mock_set '${row.mock_set}'. Valid sets: ${VALID_MOCK_SETS.join(', ')}`
      });
    } else {
      // Mini-mock doesn't use mock sets
      if (normalized.mock_type === 'Mini-mock') {
        errors.push({
          field: 'mock_set',
          code: 'INVALID_MOCK_SET_FOR_TYPE',
          message: 'mock_set is not applicable for Mini-mock exams'
        });
      } else {
        normalized.mock_set = mockSet;
      }
    }
  }

  // is_active (optional, default: 'true')
  if (row.is_active && row.is_active !== '') {
    const isActive = normalizeIsActive(row.is_active);
    if (!isActive) {
      errors.push({
        field: 'is_active',
        code: 'INVALID_IS_ACTIVE',
        message: `Invalid is_active '${row.is_active}'. Valid values: true, false, scheduled`
      });
    } else {
      normalized.is_active = isActive;
    }
  } else {
    normalized.is_active = 'true'; // Default
  }

  // scheduled_activation_datetime (optional, required if is_active = 'scheduled')
  if (row.scheduled_activation_datetime && row.scheduled_activation_datetime !== '') {
    if (!isValidISODatetime(row.scheduled_activation_datetime)) {
      errors.push({
        field: 'scheduled_activation_datetime',
        code: 'INVALID_DATETIME',
        message: `Invalid scheduled_activation_datetime '${row.scheduled_activation_datetime}'. Use ISO format (e.g., 2026-03-15T09:00:00Z)`
      });
    } else {
      const scheduledDate = new Date(row.scheduled_activation_datetime);
      if (scheduledDate <= new Date()) {
        errors.push({
          field: 'scheduled_activation_datetime',
          code: 'DATETIME_PAST',
          message: 'scheduled_activation_datetime must be in the future'
        });
      } else {
        normalized.scheduled_activation_datetime = scheduledDate.toISOString();
      }
    }
  }

  // Validate scheduled datetime is provided when is_active = 'scheduled'
  if (normalized.is_active === 'scheduled' && !normalized.scheduled_activation_datetime) {
    errors.push({
      field: 'scheduled_activation_datetime',
      code: 'MISSING_VALUE',
      message: 'scheduled_activation_datetime is required when is_active is "scheduled"'
    });
  }

  return { isValid: errors.length === 0, errors, normalized };
}

// ============== MAIN HANDLER ==============

async function bulkCreateMockExamsCSVHandler(req, res) {
  const startTime = Date.now();

  try {
    // Only allow POST
    if (req.method !== 'POST') {
      return res.status(405).json({
        success: false,
        error: {
          code: 'METHOD_NOT_ALLOWED',
          message: `Method ${req.method} not allowed. Use POST.`
        }
      });
    }

    // Check if this is preview mode
    const isPreviewMode = req.query.preview === 'true';
    const modeLabel = isPreviewMode ? 'PREVIEW' : 'CREATE';

    // Authenticate admin
    console.log(`[BULK-EXAMS-${modeLabel}] Authenticating admin...`);
    const user = await requirePermission(req, 'exams.create');
    const adminEmail = user?.email || 'admin@prepdoctors.com';
    console.log(`[BULK-EXAMS-${modeLabel}] Admin authenticated: ${adminEmail}`);

    // Validate request body
    const { csv_data } = req.body;
    if (!csv_data || typeof csv_data !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'csv_data is required and must be a string'
        }
      });
    }

    // Parse CSV
    console.log(`[BULK-EXAMS-${modeLabel}] Parsing CSV data...`);
    const { headers, rows } = parseCSV(csv_data);

    // Validate required headers
    const requiredHeaders = ['mock_type', 'exam_date', 'capacity', 'location', 'start_time', 'end_time'];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    if (missingHeaders.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Missing required columns: ${missingHeaders.join(', ')}`
        }
      });
    }

    // Validate row count
    if (rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'CSV file contains no data rows'
        }
      });
    }

    if (rows.length > MAX_ROWS) {
      return res.status(413).json({
        success: false,
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: `CSV exceeds maximum of ${MAX_ROWS} rows. Got ${rows.length} rows.`
        }
      });
    }

    console.log(`[BULK-EXAMS-${modeLabel}] Processing ${rows.length} rows...`);

    // ========== STEP 1: Validate all rows ==========
    const validationResults = rows.map(row => {
      const validation = validateRow(row);
      return {
        row,
        validation
      };
    });

    const validRows = validationResults.filter(r => r.validation.isValid);
    const invalidRows = validationResults
      .filter(r => !r.validation.isValid)
      .map(r => ({
        row: r.row._rowNumber,
        mock_type: r.row.mock_type || '',
        exam_date: r.row.exam_date || '',
        capacity: r.row.capacity || '',
        location: r.row.location || '',
        start_time: r.row.start_time || '',
        end_time: r.row.end_time || '',
        mock_set: r.row.mock_set || '',
        is_active: r.row.is_active || '',
        error_code: r.validation.errors[0]?.code || 'VALIDATION_ERROR',
        error_message: r.validation.errors.map(e => e.message).join('; ')
      }));

    console.log(`[BULK-EXAMS-${modeLabel}] Validation: ${validRows.length} valid, ${invalidRows.length} invalid`);

    const now = new Date().toISOString();

    // ========== PREVIEW MODE: Return validation results only ==========
    if (isPreviewMode) {
      const duration = Date.now() - startTime;
      console.log(`[BULK-EXAMS-PREVIEW] Completed in ${duration}ms`);

      return res.status(200).json({
        success: true,
        mode: 'preview',
        summary: {
          total_rows: rows.length,
          valid_count: validRows.length,
          invalid_count: invalidRows.length
        },
        valid_rows: validRows.map(v => ({
          row: v.row._rowNumber,
          mock_type: v.validation.normalized.mock_type,
          exam_date: v.validation.normalized.exam_date,
          capacity: v.validation.normalized.capacity,
          location: v.validation.normalized.location,
          start_time: v.validation.normalized.start_time,
          end_time: v.validation.normalized.end_time,
          mock_set: v.validation.normalized.mock_set || null,
          is_active: v.validation.normalized.is_active,
          scheduled_activation_datetime: v.validation.normalized.scheduled_activation_datetime || null
        })),
        invalid_rows: invalidRows.sort((a, b) => a.row - b.row),
        meta: {
          validated_by: adminEmail,
          validated_at: now,
          duration_ms: duration
        }
      });
    }

    // ========== CREATE MODE: Create exams in HubSpot ==========
    console.log(`[BULK-EXAMS-CREATE] Ready to create ${validRows.length} mock exams`);

    if (validRows.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_VALID_ROWS',
          message: 'No valid rows to create'
        },
        invalid_rows: invalidRows
      });
    }

    // Initialize HubSpot service
    const hubspot = new HubSpotService();

    // Build exam objects for HubSpot
    const examsToCreate = validRows.map(v => ({
      mock_type: v.validation.normalized.mock_type,
      exam_date: v.validation.normalized.exam_date,
      capacity: v.validation.normalized.capacity,
      location: v.validation.normalized.location,
      start_time: v.validation.normalized.start_time,
      end_time: v.validation.normalized.end_time,
      mock_set: v.validation.normalized.mock_set || null,
      is_active: v.validation.normalized.is_active,
      scheduled_activation_datetime: v.validation.normalized.scheduled_activation_datetime || null,
      total_bookings: 0
    }));

    // Create exams one by one using createMockExam
    console.log(`[BULK-EXAMS-CREATE] Creating ${examsToCreate.length} exams in HubSpot...`);

    let createdExams = [];
    const creationErrors = [];

    for (let i = 0; i < examsToCreate.length; i++) {
      const exam = examsToCreate[i];
      const validRow = validRows[i];

      try {
        const created = await hubspot.createMockExam({
          mock_type: exam.mock_type,
          exam_date: exam.exam_date,
          capacity: exam.capacity,
          location: exam.location,
          start_time: exam.start_time,
          end_time: exam.end_time,
          mock_set: exam.mock_set,
          is_active: exam.is_active,
          scheduled_activation_datetime: exam.scheduled_activation_datetime,
          total_bookings: 0
        });

        createdExams.push(created);
        console.log(`[BULK-EXAMS-CREATE] Created exam ${i + 1}/${examsToCreate.length}: ${exam.mock_type} on ${exam.exam_date}`);
      } catch (individualError) {
        console.error(`[BULK-EXAMS-CREATE] Failed to create exam row ${validRow.row._rowNumber}:`, individualError.message);
        creationErrors.push({
          row: validRow.row._rowNumber,
          error_code: 'CREATION_FAILED',
          error_message: individualError.message
        });
      }
    }

    // ========== STEP 2: Sync to Supabase ==========
    let supabaseSynced = 0;
    if (createdExams.length > 0) {
      console.log(`[BULK-EXAMS-CREATE] Syncing ${createdExams.length} exams to Supabase...`);

      const syncResults = await Promise.allSettled(
        createdExams.map(exam => syncExamToSupabase({
          id: exam.id,
          createdAt: exam.createdAt,
          updatedAt: exam.updatedAt,
          properties: exam.properties
        }))
      );

      supabaseSynced = syncResults.filter(r => r.status === 'fulfilled').length;
      console.log(`[BULK-EXAMS-CREATE] Synced ${supabaseSynced}/${createdExams.length} exams to Supabase`);
    }

    // ========== STEP 3: Invalidate caches ==========
    try {
      const cache = getCache();
      await Promise.all([
        cache.deletePattern('admin:mock-exams:list:*'),
        cache.deletePattern('admin:mock-exams:aggregates:*'),
        cache.deletePattern('admin:aggregate:sessions:*')
      ]);
      console.log(`[BULK-EXAMS-CREATE] Caches invalidated`);
    } catch (cacheErr) {
      console.warn(`[BULK-EXAMS-CREATE] Cache invalidation failed:`, cacheErr.message);
    }

    // ========== STEP 4: Build response ==========
    const duration = Date.now() - startTime;
    console.log(`[BULK-EXAMS-CREATE] Completed in ${duration}ms`);

    // Combine invalid rows with creation errors
    const allErrors = [
      ...invalidRows,
      ...creationErrors
    ].sort((a, b) => a.row - b.row);

    return res.status(201).json({
      success: true,
      mode: 'create',
      summary: {
        total_rows: rows.length,
        created: createdExams.length,
        skipped: allErrors.length
      },
      created_exams: createdExams.map((exam, idx) => {
        const validRow = validRows[idx];
        return {
          row: validRow?.row._rowNumber,
          hubspot_id: exam.id,
          mock_type: exam.properties?.mock_type,
          exam_date: exam.properties?.exam_date,
          location: exam.properties?.location,
          start_time: exam.properties?.start_time,
          end_time: exam.properties?.end_time
        };
      }),
      skipped_rows: allErrors,
      supabase_synced: supabaseSynced,
      meta: {
        created_by: adminEmail,
        created_at: now,
        duration_ms: duration
      }
    });

  } catch (error) {
    console.error('[BULK-EXAMS-CREATE] Error:', {
      message: error.message,
      status: error.status || 500,
      code: error.code || 'INTERNAL_ERROR',
      stack: error.stack
    });

    const statusCode = error.status || 500;
    const errorCode = error.code || 'SERVER_ERROR';

    return res.status(statusCode).json({
      success: false,
      error: {
        code: errorCode,
        message: error.message || 'Failed to process bulk mock exams',
        ...(error.details && { details: error.details })
      }
    });
  }
}

module.exports = bulkCreateMockExamsCSVHandler;
