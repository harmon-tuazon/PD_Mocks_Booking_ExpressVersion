/**
 * POST /api/admin/bookings/bulk-create
 * Bulk create bookings from CSV data
 *
 * This endpoint allows admins to create multiple bookings at once
 * by uploading CSV data with minimal required fields.
 * Missing properties are auto-filled from Supabase.
 */

const { requirePermission } = require('../middleware/requirePermission');
const { supabaseAdmin } = require('../../_shared/supabase');
const { getCache } = require('../../_shared/cache');

// ============== CONSTANTS ==============

const VALID_TOKEN_TYPES = [
  'sj_credits',
  'cs_credits',
  'sjmini_credits',
  'mock_discussion_token',
  'shared_mock_credits'
];

const MAX_ROWS = 500;
const STUDENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,50}$/;
const EXAM_ID_PATTERN = /^[0-9]{1,20}$/;

// ============== INPUT SANITIZATION ==============

/**
 * Sanitize string input to prevent XSS and injection
 * @param {*} value - Input value
 * @param {number} maxLength - Maximum allowed length
 * @returns {string} - Sanitized string
 */
function sanitizeString(value, maxLength = 255) {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'string') {
    value = String(value);
  }
  return value
    .trim()
    .slice(0, maxLength)
    .replace(/[<>\"\'\\;]/g, '') // Remove dangerous chars for HTML/SQL
    .replace(/[\x00-\x1F\x7F]/g, ''); // Remove control characters
}

/**
 * Parse CSV string into rows
 * @param {string} csvData - Raw CSV string
 * @returns {Array<object>} - Array of row objects
 */
function parseCSV(csvData) {
  const lines = csvData.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) {
    return { headers: [], rows: [] };
  }

  const headers = lines[0].split(',').map(h => sanitizeString(h.toLowerCase()));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const row = { _rowNumber: i + 1 }; // 1-indexed for user display

    headers.forEach((header, index) => {
      row[header] = sanitizeString(values[index] || '');
    });

    rows.push(row);
  }

  return { headers, rows };
}

/**
 * Validate a single row
 * @param {object} row - Row object
 * @returns {object} - { isValid, errors }
 */
function validateRow(row) {
  const errors = [];

  // Validate student_id
  if (!row.student_id) {
    errors.push({ field: 'student_id', code: 'MISSING_VALUE', message: 'student_id is required' });
  } else if (!STUDENT_ID_PATTERN.test(row.student_id)) {
    errors.push({
      field: 'student_id',
      code: 'INVALID_STUDENT_ID',
      message: `Invalid student_id '${row.student_id}'. Must be alphanumeric, max 50 characters`
    });
  }

  // Validate mock_exam_id
  if (!row.mock_exam_id) {
    errors.push({ field: 'mock_exam_id', code: 'MISSING_VALUE', message: 'mock_exam_id is required' });
  } else if (!EXAM_ID_PATTERN.test(row.mock_exam_id)) {
    errors.push({
      field: 'mock_exam_id',
      code: 'INVALID_EXAM_ID',
      message: `Invalid mock_exam_id '${row.mock_exam_id}'. Must be numeric`
    });
  }

  // Validate token_used
  if (!row.token_used) {
    errors.push({ field: 'token_used', code: 'MISSING_VALUE', message: 'token_used is required' });
  } else if (!VALID_TOKEN_TYPES.includes(row.token_used)) {
    errors.push({
      field: 'token_used',
      code: 'INVALID_TOKEN_TYPE',
      message: `Invalid token_used '${row.token_used}'. Must be one of: ${VALID_TOKEN_TYPES.join(', ')}`
    });
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Format date for booking_id display (e.g., "March 15, 2026")
 * @param {string} dateString - Date string (YYYY-MM-DD)
 * @returns {string} - Formatted date
 */
function formatDateForBookingId(dateString) {
  if (!dateString) return 'Unknown Date';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Get mock type abbreviation for booking_id
 * @param {string} mockType - Full mock type name
 * @returns {string} - Abbreviation
 */
function getMockTypeAbbreviation(mockType) {
  const map = {
    'Situational Judgment': 'SJ',
    'Clinical Skills': 'CS',
    'Mini-mock': 'MINI',
    'Mock Discussion': 'MD'
  };
  return map[mockType] || mockType?.substring(0, 2)?.toUpperCase() || 'XX';
}

// ============== MAIN HANDLER ==============

async function bulkCreateBookingsHandler(req, res) {
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

    // Authenticate admin
    console.log('🔐 [BULK-CREATE] Authenticating admin...');
    const user = await requirePermission(req, 'bookings.create');
    const adminEmail = user?.email || 'admin@prepdoctors.com';
    console.log(`✅ [BULK-CREATE] Admin authenticated: ${adminEmail}`);

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
    console.log('📄 [BULK-CREATE] Parsing CSV data...');
    const { headers, rows } = parseCSV(csv_data);

    // Validate headers
    const requiredHeaders = ['student_id', 'mock_exam_id', 'token_used'];
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

    console.log(`📊 [BULK-CREATE] Processing ${rows.length} rows...`);

    // ========== STEP 1: Validate all rows ==========
    const validationResults = rows.map(row => ({
      row,
      validation: validateRow(row)
    }));

    const validRows = validationResults.filter(r => r.validation.isValid).map(r => r.row);
    const invalidRows = validationResults.filter(r => !r.validation.isValid);

    console.log(`✅ [BULK-CREATE] Validation: ${validRows.length} valid, ${invalidRows.length} invalid`);

    // ========== STEP 2: Batch fetch contacts ==========
    const uniqueStudentIds = [...new Set(validRows.map(r => r.student_id))];
    console.log(`🔍 [BULK-CREATE] Fetching ${uniqueStudentIds.length} unique contacts...`);

    const { data: contacts, error: contactError } = await supabaseAdmin
      .from('hubspot_contact_credits')
      .select('hubspot_id, student_id, email, firstname, lastname')
      .in('student_id', uniqueStudentIds);

    if (contactError) {
      console.error('❌ [BULK-CREATE] Contact fetch error:', contactError.message);
      throw contactError;
    }

    // Build contact lookup map
    const contactMap = {};
    (contacts || []).forEach(c => {
      contactMap[c.student_id] = c;
    });

    // ========== STEP 3: Batch fetch exams ==========
    const uniqueExamIds = [...new Set(validRows.map(r => r.mock_exam_id))];
    console.log(`🔍 [BULK-CREATE] Fetching ${uniqueExamIds.length} unique exams...`);

    const { data: exams, error: examError } = await supabaseAdmin
      .from('hubspot_mock_exams')
      .select('hubspot_id, mock_type, mock_set, exam_date, start_time, end_time, location')
      .in('hubspot_id', uniqueExamIds);

    if (examError) {
      console.error('❌ [BULK-CREATE] Exam fetch error:', examError.message);
      throw examError;
    }

    // Build exam lookup map
    const examMap = {};
    (exams || []).forEach(e => {
      examMap[e.hubspot_id] = e;
    });

    // ========== STEP 4: Check for existing bookings ==========
    // Build potential booking_ids to check for duplicates
    const potentialBookingIds = validRows.map(row => {
      const exam = examMap[row.mock_exam_id];
      if (!exam) return null;
      const mockTypeAbbr = getMockTypeAbbreviation(exam.mock_type);
      const formattedDate = formatDateForBookingId(exam.exam_date);
      return `${mockTypeAbbr}-${row.student_id}-${formattedDate}`;
    }).filter(Boolean);

    const { data: existingBookings, error: existingError } = await supabaseAdmin
      .from('hubspot_bookings')
      .select('booking_id')
      .in('booking_id', potentialBookingIds)
      .eq('is_active', 'Active');

    if (existingError) {
      console.error('❌ [BULK-CREATE] Existing booking check error:', existingError.message);
      throw existingError;
    }

    const existingBookingIds = new Set((existingBookings || []).map(b => b.booking_id));

    // ========== STEP 5: Build booking objects and track errors ==========
    const bookingsToInsert = [];
    const rowErrors = [...invalidRows.map(r => ({
      row: r.row._rowNumber,
      student_id: r.row.student_id,
      mock_exam_id: r.row.mock_exam_id,
      token_used: r.row.token_used,
      error_code: r.validation.errors[0]?.code || 'VALIDATION_ERROR',
      error_message: r.validation.errors.map(e => e.message).join('; ')
    }))];

    const now = new Date().toISOString();

    for (const row of validRows) {
      const contact = contactMap[row.student_id];
      const exam = examMap[row.mock_exam_id];

      // Check if contact exists
      if (!contact) {
        rowErrors.push({
          row: row._rowNumber,
          student_id: row.student_id,
          mock_exam_id: row.mock_exam_id,
          token_used: row.token_used,
          error_code: 'CONTACT_NOT_FOUND',
          error_message: `No contact found with student_id '${row.student_id}'`
        });
        continue;
      }

      // Check if exam exists
      if (!exam) {
        rowErrors.push({
          row: row._rowNumber,
          student_id: row.student_id,
          mock_exam_id: row.mock_exam_id,
          token_used: row.token_used,
          error_code: 'EXAM_NOT_FOUND',
          error_message: `No mock exam found with ID '${row.mock_exam_id}'`
        });
        continue;
      }

      // Build booking_id
      const mockTypeAbbr = getMockTypeAbbreviation(exam.mock_type);
      const formattedDate = formatDateForBookingId(exam.exam_date);
      const bookingId = `${mockTypeAbbr}-${row.student_id}-${formattedDate}`;

      // Check for duplicate
      if (existingBookingIds.has(bookingId)) {
        rowErrors.push({
          row: row._rowNumber,
          student_id: row.student_id,
          mock_exam_id: row.mock_exam_id,
          token_used: row.token_used,
          error_code: 'DUPLICATE_BOOKING',
          error_message: `Active booking already exists for student '${row.student_id}' on exam '${row.mock_exam_id}'`
        });
        continue;
      }

      // Add to set to prevent duplicates within same upload
      existingBookingIds.add(bookingId);

      // Build full booking object
      const booking = {
        // hubspot_id is NULL - cron will sync to HubSpot
        booking_id: bookingId,
        associated_mock_exam: row.mock_exam_id,
        associated_contact_id: contact.hubspot_id,
        student_id: row.student_id,
        name: [contact.firstname, contact.lastname].filter(Boolean).join(' ') || row.student_id,
        student_email: contact.email,
        mock_type: exam.mock_type,
        mock_set: exam.mock_set || null,
        exam_date: exam.exam_date,
        start_time: exam.start_time,
        end_time: exam.end_time,
        attending_location: exam.location,
        token_used: row.token_used,
        is_active: 'Active',
        attendance: null,
        dominant_hand: null,
        idempotency_key: `bulk-${contact.hubspot_id}-${row.mock_exam_id}-${Date.now()}`,
        created_at: now,
        updated_at: now,
        synced_at: now
      };

      bookingsToInsert.push(booking);
    }

    console.log(`📝 [BULK-CREATE] Ready to insert ${bookingsToInsert.length} bookings`);

    // ========== STEP 6: Bulk insert bookings ==========
    let insertedBookings = [];
    if (bookingsToInsert.length > 0) {
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('hubspot_bookings')
        .insert(bookingsToInsert)
        .select('id, booking_id, student_id, associated_mock_exam');

      if (insertError) {
        console.error('❌ [BULK-CREATE] Insert error:', insertError.message);
        throw insertError;
      }

      insertedBookings = inserted || [];
      console.log(`✅ [BULK-CREATE] Inserted ${insertedBookings.length} bookings`);
    }

    // ========== STEP 7: Update exam booking counts ==========
    if (bookingsToInsert.length > 0) {
      // Count bookings per exam
      const examCounts = {};
      bookingsToInsert.forEach(b => {
        examCounts[b.associated_mock_exam] = (examCounts[b.associated_mock_exam] || 0) + 1;
      });

      // Update each exam's total_bookings atomically
      for (const [examId, count] of Object.entries(examCounts)) {
        try {
          const { error: rpcError } = await supabaseAdmin.rpc('increment_exam_bookings', {
            p_exam_id: examId,
            p_delta: count
          });

          if (rpcError) {
            console.warn(`⚠️ [BULK-CREATE] Failed to increment exam ${examId} count:`, rpcError.message);
            // Non-blocking - cron will reconcile
          } else {
            console.log(`✅ [BULK-CREATE] Incremented exam ${examId} bookings by ${count}`);
          }
        } catch (rpcErr) {
          console.warn(`⚠️ [BULK-CREATE] RPC error for exam ${examId}:`, rpcErr.message);
        }
      }
    }

    // ========== STEP 8: Invalidate caches ==========
    try {
      const cache = getCache();
      await Promise.all([
        cache.deletePattern('admin:aggregates:*'),
        cache.deletePattern('admin:mock-exam:*')
      ]);
      console.log(`🗑️ [BULK-CREATE] Caches invalidated`);
    } catch (cacheErr) {
      console.warn(`⚠️ [BULK-CREATE] Cache invalidation failed:`, cacheErr.message);
    }

    // ========== STEP 9: Build response ==========
    const duration = Date.now() - startTime;
    console.log(`✅ [BULK-CREATE] Completed in ${duration}ms`);

    return res.status(201).json({
      success: true,
      summary: {
        total_rows: rows.length,
        created: insertedBookings.length,
        errors: rowErrors.length
      },
      created_bookings: insertedBookings.map(b => ({
        row: validRows.find(r => r.student_id === b.student_id)?._rowNumber,
        student_id: b.student_id,
        booking_id: b.booking_id,
        id: b.id
      })),
      errors: rowErrors.sort((a, b) => a.row - b.row),
      meta: {
        created_by: adminEmail,
        created_at: now,
        duration_ms: duration
      }
    });

  } catch (error) {
    console.error('❌ [BULK-CREATE] Error:', {
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
        message: error.message || 'Failed to process bulk bookings',
        ...(error.details && { details: error.details })
      }
    });
  }
}

module.exports = bulkCreateBookingsHandler;
