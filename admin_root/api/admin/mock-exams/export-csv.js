/**
 * POST /api/admin/mock-exams/export-csv
 * Generate CSV file from provided booking data
 *
 * No additional HubSpot fetch - uses data passed from frontend
 */

const Joi = require('joi');
const { requirePermission } = require('../middleware/requirePermission');

// Validation schema
const bookingSchema = Joi.object({
  id: Joi.string().allow('', null),  // Allow null for Supabase-first bookings without hubspot_id
  booking_id: Joi.string().allow('', null),
  name: Joi.string().allow('', null),
  email: Joi.string().allow('', null),
  student_id: Joi.string().allow('', null),
  dominant_hand: Joi.string().allow('', null),
  attendance: Joi.string().allow('', null),
  attending_location: Joi.string().allow('', null),
  exam_date: Joi.string().allow('', null),
  mock_type: Joi.string().allow('', null),
  location: Joi.string().allow('', null),
  start_time: Joi.string().allow('', null),
  end_time: Joi.string().allow('', null),
  created_at: Joi.string().allow('', null),
  updated_at: Joi.string().allow('', null),
  contact_id: Joi.string().allow('', null),
  associated_contact_id: Joi.string().allow('', null),
  is_active: Joi.string().allow('', null),
  token_used: Joi.string().allow('', null),
  booking_date: Joi.string().allow('', null),
  ndecc_exam_date: Joi.string().allow('', null)
}).unknown(true);;

const exportCsvSchema = Joi.object({
  bookings: Joi.array().items(bookingSchema).min(1).required(),
  examId: Joi.string().pattern(/^\d+$/).required()
});

// Helper function to escape CSV values
function escapeCSV(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Escape quotes and wrap in quotes if contains comma, quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Helper function to format time to EST (e.g., "8:30 AM EST")
function formatTimeEST(timeStr) {
  if (!timeStr) return '';

  // If it's already a simple time string like "8:30 AM", return as-is with EST
  if (/^\d{1,2}:\d{2}\s*(AM|PM)?$/i.test(timeStr)) {
    return timeStr.toUpperCase().includes('AM') || timeStr.toUpperCase().includes('PM')
      ? `${timeStr} EST`
      : timeStr;
  }

  // Try to parse as date/time and format
  try {
    const date = new Date(timeStr);
    if (isNaN(date.getTime())) return timeStr;

    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/New_York'
    }) + ' EST';
  } catch {
    return timeStr;
  }
}

// Helper function to format date only (no time)
function formatDateOnly(dateStr) {
  if (!dateStr) return '';

  // If it's already just a date (YYYY-MM-DD), format it nicely
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split('-');
    return `${month}/${day}/${year}`;
  }

  // Try to parse and extract date portion
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;

    return date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      timeZone: 'America/New_York'
    });
  } catch {
    return dateStr;
  }
}

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST method
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' }
    });
  }

  try {
    // Verify admin authentication and permission
    await requirePermission(req, 'bookings.export');

    // Validate input
    const { error, value } = exportCsvSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message
        }
      });
    }

    const { bookings, examId } = value;

    // Define CSV columns and headers (simplified per user request)
    const columns = [
      { key: 'name', header: 'Name' },
      { key: 'email', header: 'Email' },
      { key: 'student_id', header: 'Student ID' },
      { key: 'dominant_hand', header: 'Dominant Hand' },
      { key: 'is_active', header: 'Booking Status' },
      { key: 'attendance', header: 'Attendance' },
      { key: 'attending_location', header: 'Attending Location' },
      { key: 'mock_type', header: 'Mock Type' },
      { key: 'ndecc_exam_date', header: 'NDECC Exam Date' },
      { key: 'start_time', header: 'Start Time' },
      { key: 'end_time', header: 'End Time' },
      { key: 'created_at', header: 'Booking Created' },
      { key: 'exam_date', header: 'Exam Date' }
    ];

    // Build CSV header row
    const headerRow = columns.map(col => escapeCSV(col.header)).join(',');

    // Build CSV data rows with formatting
    const dataRows = bookings.map(booking => {
      return columns.map(col => {
        const value = booking[col.key];

        // Apply formatting based on column type
        if (col.key === 'start_time' || col.key === 'end_time') {
          return escapeCSV(formatTimeEST(value));
        }
        if (col.key === 'exam_date' || col.key === 'ndecc_exam_date' || col.key === 'created_at') {
          return escapeCSV(formatDateOnly(value));
        }

        return escapeCSV(value || '');
      }).join(',');
    });

    // Combine header and data rows
    const csvContent = [headerRow, ...dataRows].join('\n');

    // Generate filename
    const date = new Date().toISOString().split('T')[0];
    const filename = `bookings-exam-${examId}-${date}.csv`;

    // Set response headers for file download
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', Buffer.byteLength(csvContent, 'utf8'));

    console.log(`📥 CSV Export: ${bookings.length} bookings for exam ${examId}`);

    // Send CSV content
    return res.status(200).send(csvContent);

  } catch (error) {
    console.error('Error exporting CSV:', error);

    // Check for authentication error
    if (error.message && (error.message.includes('Authentication') || error.message.includes('Unauthorized'))) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: error.message || 'Authentication required'
        }
      });
    }

    // Generic server error
    return res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to generate CSV export'
      }
    });
  }
};
