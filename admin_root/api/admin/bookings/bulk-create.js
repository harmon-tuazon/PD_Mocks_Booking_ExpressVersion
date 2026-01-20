/**
 * POST /api/admin/bookings/bulk-create
 * Bulk create bookings from CSV data with two-step preview and validation
 *
 * This endpoint allows admins to create multiple bookings at once
 * by uploading CSV data with minimal required fields.
 * Missing properties are auto-filled from Supabase.
 *
 * Query Parameters:
 * - preview=true: Returns validation results only without creating bookings
 *
 * Features:
 * - Token name normalization (accepts flexible input like "SJ", "situational judgment", etc.)
 * - Per-row credit validation (checks specific credit type, no shared fallback for bulk)
 * - Preview mode to validate before actual creation
 * - Processes only valid rows, reports all errors
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

// Token aliases for flexible input - maps various inputs to database column names
const TOKEN_ALIASES = {
  // Situational Judgment
  'situational judgment': 'sj_credits',
  'situational judgment token': 'sj_credits',
  'situational judgment credits': 'sj_credits',
  'sj': 'sj_credits',
  'sj token': 'sj_credits',
  'sj tokens': 'sj_credits',
  'sj credit': 'sj_credits',
  'sj_credits': 'sj_credits',

  // Clinical Skills
  'clinical skills': 'cs_credits',
  'clinical skills token': 'cs_credits',
  'clinical skills credits': 'cs_credits',
  'cs': 'cs_credits',
  'cs token': 'cs_credits',
  'cs tokens': 'cs_credits',
  'cs credit': 'cs_credits',
  'cs_credits': 'cs_credits',

  // Mini-mock
  'mini-mock': 'sjmini_credits',
  'mini mock': 'sjmini_credits',
  'minimock': 'sjmini_credits',
  'mini': 'sjmini_credits',
  'sjmini': 'sjmini_credits',
  'sj mini': 'sjmini_credits',
  'situational judgment mini-mock': 'sjmini_credits',
  'situational judgment mini-mock token': 'sjmini_credits',
  'sjmini token': 'sjmini_credits',
  'sjmini_credits': 'sjmini_credits',

  // Mock Discussion
  'mock discussion': 'mock_discussion_token',
  'mock discussion token': 'mock_discussion_token',
  'discussion': 'mock_discussion_token',
  'discussion token': 'mock_discussion_token',
  'md': 'mock_discussion_token',
  'md token': 'mock_discussion_token',
  'mock_discussion_token': 'mock_discussion_token',

  // Shared Credits
  'shared': 'shared_mock_credits',
  'shared token': 'shared_mock_credits',
  'shared tokens': 'shared_mock_credits',
  'shared credits': 'shared_mock_credits',
  'shared credit': 'shared_mock_credits',
  'shared mock': 'shared_mock_credits',
  'shared mock credits': 'shared_mock_credits',
  'shared_mock_credits': 'shared_mock_credits'
};

const MAX_ROWS = 20;
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
 * Normalize token type input to database column name
 * Accepts flexible input like "SJ", "situational judgment", etc.
 * @param {*} input - Token type input
 * @returns {string|null} - Normalized token type or null if invalid
 */
function normalizeTokenType(input) {
  if (!input) return null;
  const normalized = String(input).toLowerCase().trim();
  return TOKEN_ALIASES[normalized] || null;
}

/**
 * Get display name for a token type
 * @param {string} tokenType - Database column name
 * @returns {string} - Human-readable name with "Token" suffix
 */
function getTokenDisplayName(tokenType) {
  const displayNames = {
    'sj_credits': 'Situational Judgment Token',
    'cs_credits': 'Clinical Skills Token',
    'sjmini_credits': 'Mini-mock Token',
    'mock_discussion_token': 'Mock Discussion Token',
    'shared_mock_credits': 'Shared Token'
  };
  return displayNames[tokenType] || tokenType;
}

/**
 * Generate a simple hash for idempotency key
 * @param {string} input - String to hash
 * @returns {string} - Hex hash string
 */
function generateHash(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // Convert to hex and pad to ensure consistent length
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  // Create a longer hash by combining multiple variations
  const hash2 = Math.abs((hash * 31) ^ (hash >> 16)).toString(16).padStart(8, '0');
  const hash3 = Math.abs((hash * 17) ^ (hash << 8)).toString(16).padStart(8, '0');
  const hash4 = Math.abs((hash * 13) ^ (hash >> 8)).toString(16).padStart(8, '0');
  return hex + hash2 + hash3 + hash4;
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
 * Validate a single row (basic format validation)
 * @param {object} row - Row object
 * @returns {object} - { isValid, errors, normalizedTokenType }
 */
function validateRow(row) {
  const errors = [];
  let normalizedTokenType = null;

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

  // Validate and normalize token_used
  if (!row.token_used) {
    errors.push({ field: 'token_used', code: 'MISSING_VALUE', message: 'token_used is required' });
  } else {
    normalizedTokenType = normalizeTokenType(row.token_used);
    if (!normalizedTokenType) {
      errors.push({
        field: 'token_used',
        code: 'INVALID_TOKEN_TYPE',
        message: `Invalid token_used '${row.token_used}'. Accepted values include: sj, cs, mini-mock, mock discussion, shared, or exact column names`
      });
    }
  }

  return { isValid: errors.length === 0, errors, normalizedTokenType };
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

    // Check if this is preview mode (validation only)
    const isPreviewMode = req.query.preview === 'true';
    const modeLabel = isPreviewMode ? 'PREVIEW' : 'CREATE';

    // Authenticate admin
    console.log(`[BULK-${modeLabel}] Authenticating admin...`);
    const user = await requirePermission(req, 'bookings.create');
    const adminEmail = user?.email || 'admin@prepdoctors.com';
    console.log(`[BULK-${modeLabel}] Admin authenticated: ${adminEmail}`);

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
    console.log(`[BULK-${modeLabel}] Parsing CSV data...`);
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

    console.log(`[BULK-${modeLabel}] Processing ${rows.length} rows...`);

    // ========== STEP 1: Validate all rows (format validation + token normalization) ==========
    const validationResults = rows.map(row => {
      const validation = validateRow(row);
      return {
        row,
        validation,
        normalizedTokenType: validation.normalizedTokenType
      };
    });

    // Separate format-valid rows from format-invalid rows
    const formatValidRows = validationResults.filter(r => r.validation.isValid);
    const formatInvalidRows = validationResults.filter(r => !r.validation.isValid);

    console.log(`[BULK-${modeLabel}] Format validation: ${formatValidRows.length} valid, ${formatInvalidRows.length} invalid`);

    // ========== STEP 2: Batch fetch contacts with credit balances ==========
    const uniqueStudentIds = [...new Set(formatValidRows.map(r => r.row.student_id))];
    console.log(`[BULK-${modeLabel}] Fetching ${uniqueStudentIds.length} unique contacts...`);

    const { data: contacts, error: contactError } = await supabaseAdmin
      .from('hubspot_contact_credits')
      .select('hubspot_id, student_id, email, firstname, lastname, sj_credits, cs_credits, sjmini_credits, mock_discussion_token, shared_mock_credits')
      .in('student_id', uniqueStudentIds);

    if (contactError) {
      console.error(`[BULK-${modeLabel}] Contact fetch error:`, contactError.message);
      throw contactError;
    }

    // Build contact lookup map
    const contactMap = {};
    (contacts || []).forEach(c => {
      contactMap[c.student_id] = c;
    });

    // ========== STEP 3: Batch fetch exams ==========
    const uniqueExamIds = [...new Set(formatValidRows.map(r => r.row.mock_exam_id))];
    console.log(`[BULK-${modeLabel}] Fetching ${uniqueExamIds.length} unique exams...`);

    const { data: exams, error: examError } = await supabaseAdmin
      .from('hubspot_mock_exams')
      .select('hubspot_id, mock_type, mock_set, exam_date, start_time, end_time, location')
      .in('hubspot_id', uniqueExamIds);

    if (examError) {
      console.error(`[BULK-${modeLabel}] Exam fetch error:`, examError.message);
      throw examError;
    }

    // Build exam lookup map
    const examMap = {};
    (exams || []).forEach(e => {
      examMap[e.hubspot_id] = e;
    });

    // ========== STEP 4: Check for existing bookings ==========
    const potentialBookingIds = formatValidRows.map(r => {
      const exam = examMap[r.row.mock_exam_id];
      if (!exam) return null;
      const formattedDate = formatDateForBookingId(exam.exam_date);
      return `${exam.mock_type}-${r.row.student_id}-${formattedDate}`;
    }).filter(Boolean);

    const { data: existingBookings, error: existingError } = await supabaseAdmin
      .from('hubspot_bookings')
      .select('booking_id')
      .in('booking_id', potentialBookingIds)
      .eq('is_active', 'Active');

    if (existingError) {
      console.error(`[BULK-${modeLabel}] Existing booking check error:`, existingError.message);
      throw existingError;
    }

    const existingBookingIds = new Set((existingBookings || []).map(b => b.booking_id));

    // ========== STEP 5: Full validation with credit checking ==========
    // Track credit usage per contact to handle multiple bookings for same contact
    const creditUsageTracker = {};

    const validRows = [];
    const invalidRows = [
      // Start with format-invalid rows
      ...formatInvalidRows.map(r => ({
        row: r.row._rowNumber,
        student_id: r.row.student_id || '',
        mock_exam_id: r.row.mock_exam_id || '',
        token_used: r.row.token_used || '',
        token_used_normalized: null,
        error_code: r.validation.errors[0]?.code || 'VALIDATION_ERROR',
        error_message: r.validation.errors.map(e => e.message).join('; ')
      }))
    ];

    const now = new Date().toISOString();

    for (const { row, normalizedTokenType } of formatValidRows) {
      const contact = contactMap[row.student_id];
      const exam = examMap[row.mock_exam_id];

      // Check if contact exists
      if (!contact) {
        invalidRows.push({
          row: row._rowNumber,
          student_id: row.student_id,
          mock_exam_id: row.mock_exam_id,
          token_used: row.token_used,
          token_used_normalized: normalizedTokenType,
          error_code: 'CONTACT_NOT_FOUND',
          error_message: `No contact found with student_id '${row.student_id}'`
        });
        continue;
      }

      // Check if exam exists
      if (!exam) {
        invalidRows.push({
          row: row._rowNumber,
          student_id: row.student_id,
          mock_exam_id: row.mock_exam_id,
          token_used: row.token_used,
          token_used_normalized: normalizedTokenType,
          error_code: 'EXAM_NOT_FOUND',
          error_message: `No mock exam found with ID '${row.mock_exam_id}'`
        });
        continue;
      }

      // Build booking_id using full mock type name
      const formattedDate = formatDateForBookingId(exam.exam_date);
      const bookingId = `${exam.mock_type}-${row.student_id}-${formattedDate}`;

      // Check for duplicate in database
      if (existingBookingIds.has(bookingId)) {
        invalidRows.push({
          row: row._rowNumber,
          student_id: row.student_id,
          mock_exam_id: row.mock_exam_id,
          token_used: row.token_used,
          token_used_normalized: normalizedTokenType,
          error_code: 'DUPLICATE_BOOKING',
          error_message: `Active booking already exists for student '${row.student_id}' on this exam`
        });
        continue;
      }

      // Check for duplicate within same upload
      if (existingBookingIds.has(bookingId)) {
        invalidRows.push({
          row: row._rowNumber,
          student_id: row.student_id,
          mock_exam_id: row.mock_exam_id,
          token_used: row.token_used,
          token_used_normalized: normalizedTokenType,
          error_code: 'DUPLICATE_IN_FILE',
          error_message: `Duplicate booking in file - student '${row.student_id}' already has a booking for this exam in this import`
        });
        continue;
      }

      // ========== CREDIT VALIDATION ==========
      // Initialize credit usage tracker for this contact if not exists
      if (!creditUsageTracker[row.student_id]) {
        creditUsageTracker[row.student_id] = {
          sj_credits: contact.sj_credits || 0,
          cs_credits: contact.cs_credits || 0,
          sjmini_credits: contact.sjmini_credits || 0,
          mock_discussion_token: contact.mock_discussion_token || 0,
          shared_mock_credits: contact.shared_mock_credits || 0
        };
      }

      const availableCredits = creditUsageTracker[row.student_id][normalizedTokenType] || 0;

      if (availableCredits < 1) {
        const displayName = getTokenDisplayName(normalizedTokenType);
        invalidRows.push({
          row: row._rowNumber,
          student_id: row.student_id,
          mock_exam_id: row.mock_exam_id,
          token_used: row.token_used,
          token_used_normalized: normalizedTokenType,
          error_code: 'INSUFFICIENT_CREDITS',
          error_message: `Insufficient ${displayName} credits. Available: ${availableCredits}, Required: 1`
        });
        continue;
      }

      // Capture available credits BEFORE decrementing (this is what user currently has)
      const creditsBeforeBooking = creditUsageTracker[row.student_id][normalizedTokenType];

      // Decrement credit in tracker (for subsequent rows in same import)
      creditUsageTracker[row.student_id][normalizedTokenType] -= 1;

      // Credits remaining after this booking
      const creditsAfterBooking = creditUsageTracker[row.student_id][normalizedTokenType];

      // Add to set to prevent duplicates within same upload
      existingBookingIds.add(bookingId);

      // Build valid row object with all needed data
      validRows.push({
        row,
        normalizedTokenType,
        contact,
        exam,
        bookingId,
        creditsBeforeBooking,
        creditsAfterBooking
      });
    }

    console.log(`[BULK-${modeLabel}] Full validation: ${validRows.length} valid, ${invalidRows.length} invalid`);

    // ========== PREVIEW MODE: Return validation results only ==========
    if (isPreviewMode) {
      const duration = Date.now() - startTime;
      console.log(`[BULK-PREVIEW] Completed in ${duration}ms`);

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
          student_id: v.row.student_id,
          student_name: [v.contact.firstname, v.contact.lastname].filter(Boolean).join(' ') || v.row.student_id,
          student_email: v.contact.email,
          mock_exam_id: v.row.mock_exam_id,
          mock_type: v.exam.mock_type,
          exam_date: v.exam.exam_date,
          token_used: v.row.token_used,
          token_used_normalized: v.normalizedTokenType,
          token_display_name: getTokenDisplayName(v.normalizedTokenType),
          booking_id: v.bookingId,
          credits_before: v.creditsBeforeBooking,
          credits_after: v.creditsAfterBooking
        })),
        invalid_rows: invalidRows.sort((a, b) => a.row - b.row),
        meta: {
          validated_by: adminEmail,
          validated_at: now,
          duration_ms: duration
        }
      });
    }

    // ========== CREATE MODE: Process valid rows ==========
    console.log(`[BULK-CREATE] Ready to insert ${validRows.length} bookings`);

    // Build booking objects for insertion
    const bookingsToInsert = validRows.map(v => {
      // Generate idempotency key with idem_ prefix and hash
      const idempotencyInput = `${v.contact.hubspot_id}-${v.row.mock_exam_id}-${v.exam.exam_date}-${v.row.student_id}`;
      const idempotencyKey = `idem_${generateHash(idempotencyInput)}`;

      return {
        booking_id: v.bookingId,
        associated_mock_exam: v.row.mock_exam_id,
        associated_contact_id: v.contact.hubspot_id,
        student_id: v.row.student_id,
        name: [v.contact.firstname, v.contact.lastname].filter(Boolean).join(' ') || v.row.student_id,
        student_email: v.contact.email,
        mock_type: v.exam.mock_type,
        mock_set: v.exam.mock_set || null,
        exam_date: v.exam.exam_date,
        start_time: v.exam.start_time,
        end_time: v.exam.end_time,
        attending_location: v.exam.location,
        token_used: getTokenDisplayName(v.normalizedTokenType), // Use human-readable display name
        is_active: 'Active',
        attendance: null,
        dominant_hand: null,
        idempotency_key: idempotencyKey,
        created_at: now,
        updated_at: now,
        synced_at: now
      };
    });

    // ========== STEP 6: Bulk insert bookings ==========
    let insertedBookings = [];
    if (bookingsToInsert.length > 0) {
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('hubspot_bookings')
        .insert(bookingsToInsert)
        .select('id, booking_id, student_id, associated_mock_exam, token_used');

      if (insertError) {
        console.error('[BULK-CREATE] Insert error:', insertError.message);
        throw insertError;
      }

      insertedBookings = inserted || [];
      console.log(`[BULK-CREATE] Inserted ${insertedBookings.length} bookings`);
    }

    // ========== STEP 7: Decrement credits for each booking ==========
    if (insertedBookings.length > 0) {
      console.log(`[BULK-CREATE] Decrementing credits for ${insertedBookings.length} bookings...`);

      // Group bookings by contact and token type for efficient updates
      // Use validRows data which has the normalized token type (database column name)
      const creditUpdates = {};
      for (const booking of insertedBookings) {
        // Find the corresponding validRow to get the normalized token type
        const validRow = validRows.find(v => v.row.student_id === booking.student_id && v.bookingId === booking.booking_id);
        if (!validRow) continue;

        const tokenType = validRow.normalizedTokenType; // Database column name (e.g., 'sj_credits')
        const key = `${booking.student_id}:${tokenType}`;
        if (!creditUpdates[key]) {
          creditUpdates[key] = {
            student_id: booking.student_id,
            token_type: tokenType,
            count: 0
          };
        }
        creditUpdates[key].count += 1;
      }

      // Apply credit decrements
      for (const update of Object.values(creditUpdates)) {
        const contact = contactMap[update.student_id];
        if (!contact) continue;

        const currentCredits = contact[update.token_type] || 0;
        const newCredits = Math.max(0, currentCredits - update.count);

        try {
          const { error: creditError } = await supabaseAdmin
            .from('hubspot_contact_credits')
            .update({ [update.token_type]: newCredits, updated_at: now })
            .eq('student_id', update.student_id);

          if (creditError) {
            console.warn(`[BULK-CREATE] Failed to update credits for ${update.student_id}:`, creditError.message);
          } else {
            console.log(`[BULK-CREATE] Decremented ${update.token_type} for ${update.student_id}: ${currentCredits} -> ${newCredits}`);
          }
        } catch (creditErr) {
          console.warn(`[BULK-CREATE] Credit update error for ${update.student_id}:`, creditErr.message);
        }
      }
    }

    // ========== STEP 8: Update exam booking counts ==========
    if (bookingsToInsert.length > 0) {
      const examCounts = {};
      bookingsToInsert.forEach(b => {
        examCounts[b.associated_mock_exam] = (examCounts[b.associated_mock_exam] || 0) + 1;
      });

      for (const [examId, count] of Object.entries(examCounts)) {
        try {
          const { error: rpcError } = await supabaseAdmin.rpc('increment_exam_bookings', {
            p_exam_id: examId,
            p_delta: count
          });

          if (rpcError) {
            console.warn(`[BULK-CREATE] Failed to increment exam ${examId} count:`, rpcError.message);
          } else {
            console.log(`[BULK-CREATE] Incremented exam ${examId} bookings by ${count}`);
          }
        } catch (rpcErr) {
          console.warn(`[BULK-CREATE] RPC error for exam ${examId}:`, rpcErr.message);
        }
      }
    }

    // ========== STEP 9: Invalidate caches ==========
    try {
      const cache = getCache();
      await Promise.all([
        cache.deletePattern('admin:aggregates:*'),
        cache.deletePattern('admin:mock-exam:*'),
        cache.deletePattern('contact:credits:*')
      ]);
      console.log(`[BULK-CREATE] Caches invalidated`);
    } catch (cacheErr) {
      console.warn(`[BULK-CREATE] Cache invalidation failed:`, cacheErr.message);
    }

    // ========== STEP 10: Build response ==========
    const duration = Date.now() - startTime;
    console.log(`[BULK-CREATE] Completed in ${duration}ms`);

    return res.status(201).json({
      success: true,
      mode: 'create',
      summary: {
        total_rows: rows.length,
        created: insertedBookings.length,
        skipped: invalidRows.length
      },
      created_bookings: insertedBookings.map(b => {
        const validRow = validRows.find(v => v.row.student_id === b.student_id && v.bookingId === b.booking_id);
        return {
          row: validRow?.row._rowNumber,
          student_id: b.student_id,
          booking_id: b.booking_id,
          id: b.id,
          token_used: b.token_used
        };
      }),
      skipped_rows: invalidRows.sort((a, b) => a.row - b.row),
      meta: {
        created_by: adminEmail,
        created_at: now,
        duration_ms: duration
      }
    });

  } catch (error) {
    console.error('[BULK-CREATE] Error:', {
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
