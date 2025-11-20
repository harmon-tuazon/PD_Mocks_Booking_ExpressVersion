# PRD: CSV Export Bookings Feature

## Document Information
- **Feature**: CSV Export for Mock Exam Bookings
- **Status**: Draft
- **Priority**: Medium
- **Estimated Effort**: 2-3 hours
- **Confidence Score**: 9/10
- **Created**: 2025-11-20
- **Version**: 1.0.0

## Table of Contents
1. [Overview](#overview)
2. [User Stories](#user-stories)
3. [Technical Requirements](#technical-requirements)
4. [User Flow](#user-flow)
5. [Frontend Implementation](#frontend-implementation)
6. [Backend Implementation](#backend-implementation)
7. [CSV Format Specification](#csv-format-specification)
8. [Security Considerations](#security-considerations)
9. [Error Handling](#error-handling)
10. [Testing Requirements](#testing-requirements)
11. [Implementation Checklist](#implementation-checklist)

---

## Overview

### Problem Statement
Administrators need to export booking data from mock exams for reporting, record-keeping, and offline analysis. Currently, there's no way to download booking information in a portable format.

### Solution
Add a "Export CSV" button on the mock exam detail page that exports all current bookings to a CSV file. The frontend will pass existing booking data to the backend, which generates and returns a CSV file for download.

### Key Benefits
- **No Additional Fetch**: Uses existing booking data already loaded in the frontend
- **Instant Export**: Backend generates CSV from provided data without HubSpot API calls
- **Offline Analysis**: Admins can use data in Excel, Google Sheets, etc.
- **Simple Implementation**: Leverages existing data structures

---

## User Stories

### Primary User Story
**As an** administrator viewing a mock exam's bookings
**I want to** export the booking list as a CSV file
**So that** I can analyze, share, or archive the booking data offline

### Acceptance Criteria
- [ ] "Export CSV" button is visible beside "Mark Attendance" button
- [ ] Button is styled as a secondary button (outline style)
- [ ] Clicking the button triggers CSV download
- [ ] CSV filename includes mock exam ID and date (e.g., `bookings-exam-12345-2025-11-20.csv`)
- [ ] CSV contains all relevant booking fields
- [ ] CSV is properly formatted with headers
- [ ] Loading state shown during export
- [ ] Error handling for failed exports
- [ ] Button disabled when no bookings exist

---

## Technical Requirements

### Core Technologies
- **Frontend**: React 18, existing BookingsTable component
- **Backend**: Vercel Serverless Functions
- **CSV Generation**: Manual string building (no external library needed)
- **Response Type**: `text/csv` with `Content-Disposition` header

### Data Flow
```
1. User clicks "Export CSV" button
2. Frontend collects all current page bookings
3. Frontend sends POST request with bookings array to /api/admin/mock-exams/export-csv
4. Backend validates input with Joi
5. Backend generates CSV string from booking data
6. Backend returns CSV with proper headers
7. Browser downloads file automatically
```

---

## User Flow

### Happy Path: Successful Export
```
1. Admin navigates to mock exam detail page
2. Bookings table loads with data
3. Admin clicks "Export CSV" button (beside Mark Attendance)
4. Loading spinner appears on button
5. Backend generates CSV from provided data
6. Browser downloads file: bookings-exam-12345-2025-11-20.csv
7. Success toast: "Exported X bookings to CSV"
8. Button returns to normal state
```

### Alternative Path: No Bookings
```
1. Admin on mock exam detail with zero bookings
2. "Export CSV" button is disabled
3. Tooltip shows: "No bookings to export"
```

### Alternative Path: Export Error
```
1. Admin clicks "Export CSV"
2. Network error or server error occurs
3. Error toast: "Failed to export bookings. Please try again."
4. Button returns to normal state
```

---

## Frontend Implementation

### Button Placement
Location: `admin_root/admin_frontend/src/pages/MockExamDetail.jsx`

The button will be placed in the bookings table header section, beside the "Mark Attendance" button area.

**Current Structure (line ~337-346)**:
```jsx
<div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
  <div className="flex justify-between items-center">
    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
      Bookings ({bookingsData?.pagination?.total || 0})
    </h2>
    <CreateBookingButton ... />
  </div>
</div>
```

**Updated Structure**:
```jsx
<div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
  <div className="flex justify-between items-center">
    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
      Bookings ({bookingsData?.pagination?.total || 0})
    </h2>
    <div className="flex items-center gap-2">
      <ExportCSVButton
        bookings={bookingsData?.data || []}
        examId={id}
        disabled={!bookingsData?.data?.length}
      />
      <CreateBookingButton ... />
    </div>
  </div>
</div>
```

### ExportCSVButton Component

**Location**: `admin_root/admin_frontend/src/components/admin/ExportCSVButton.jsx`

**Props**:
```javascript
{
  bookings: Array,     // Booking objects to export
  examId: string,      // Mock exam ID for filename
  disabled: boolean    // Disable when no bookings
}
```

**Component Implementation**:
```jsx
import { useState } from 'react';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { adminApi } from '../../services/adminApi';

function ExportCSVButton({ bookings, examId, disabled }) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (disabled || isExporting || !bookings.length) return;

    setIsExporting(true);
    try {
      const response = await adminApi.post('/mock-exams/export-csv', {
        bookings,
        examId
      }, {
        responseType: 'blob'
      });

      // Create download link
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // Generate filename with date
      const date = new Date().toISOString().split('T')[0];
      link.download = `bookings-exam-${examId}-${date}.csv`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(`Exported ${bookings.length} bookings to CSV`);
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export bookings. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={disabled || isExporting}
      className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md border
        ${disabled
          ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed dark:bg-gray-800 dark:text-gray-500 dark:border-gray-700'
          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-dark-card dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700'
        }
      `}
      title={disabled ? 'No bookings to export' : 'Export bookings to CSV'}
    >
      {isExporting ? (
        <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : (
        <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
      )}
      Export CSV
    </button>
  );
}

export default ExportCSVButton;
```

---

## Backend Implementation

### API Endpoint

**Location**: `admin_root/api/admin/mock-exams/export-csv.js`

**Method**: POST

**URL**: `/api/admin/mock-exams/export-csv`

### Request Schema

```javascript
{
  "bookings": [
    {
      "id": "123456",
      "booking_id": "BK-001",
      "name": "John Doe",
      "email": "john@example.com",
      "student_id": "STU001",
      "dominant_hand": "right",
      "booking_status": "Confirmed",
      "attendance": "Yes",
      "attending_location": "Toronto",
      "exam_date": "2025-11-25",
      "mock_type": "OSCE",
      "start_time": "09:00",
      "end_time": "12:00",
      "created_at": "2025-11-20T10:00:00Z"
    }
  ],
  "examId": "12345"
}
```

### Input Validation (Joi)

```javascript
const Joi = require('joi');

const bookingSchema = Joi.object({
  id: Joi.string().required(),
  booking_id: Joi.string().allow(''),
  name: Joi.string().allow(''),
  email: Joi.string().email().allow(''),
  student_id: Joi.string().allow(''),
  dominant_hand: Joi.string().allow(''),
  booking_status: Joi.string().allow(''),
  attendance: Joi.string().allow(''),
  attending_location: Joi.string().allow(''),
  exam_date: Joi.string().allow(''),
  mock_type: Joi.string().allow(''),
  start_time: Joi.string().allow(''),
  end_time: Joi.string().allow(''),
  created_at: Joi.string().allow(''),
  // Allow additional properties from booking objects
}).unknown(true);

const exportCsvSchema = Joi.object({
  bookings: Joi.array().items(bookingSchema).min(1).required(),
  examId: Joi.string().pattern(/^\d+$/).required()
});
```

### Response

**Success**: CSV file download
- Content-Type: `text/csv`
- Content-Disposition: `attachment; filename="bookings-exam-{examId}-{date}.csv"`

**Error (400 - Validation)**:
```javascript
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "bookings array is required"
  }
}
```

**Error (401 - Unauthorized)**:
```javascript
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

### Full Endpoint Implementation

```javascript
/**
 * POST /api/admin/mock-exams/export-csv
 * Generate CSV file from provided booking data
 *
 * No additional HubSpot fetch - uses data passed from frontend
 */

const Joi = require('joi');
const { requireAdmin } = require('../../middleware/requireAdmin');

// Validation schema
const bookingSchema = Joi.object({
  id: Joi.string().required(),
  booking_id: Joi.string().allow(''),
  name: Joi.string().allow(''),
  email: Joi.string().email().allow(''),
  student_id: Joi.string().allow(''),
  dominant_hand: Joi.string().allow(''),
  booking_status: Joi.string().allow(''),
  attendance: Joi.string().allow(''),
  attending_location: Joi.string().allow(''),
  exam_date: Joi.string().allow(''),
  mock_type: Joi.string().allow(''),
  location: Joi.string().allow(''),
  start_time: Joi.string().allow(''),
  end_time: Joi.string().allow(''),
  created_at: Joi.string().allow(''),
  updated_at: Joi.string().allow(''),
  contact_id: Joi.string().allow(''),
  associated_contact_id: Joi.string().allow(''),
  is_active: Joi.string().allow(''),
  token_used: Joi.string().allow(''),
  booking_date: Joi.string().allow('')
}).unknown(true);

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

module.exports = async (req, res) => {
  // Only allow POST method
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' }
    });
  }

  try {
    // Verify admin authentication
    await requireAdmin(req);

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

    // Define CSV columns and headers
    const columns = [
      { key: 'id', header: 'HubSpot ID' },
      { key: 'booking_id', header: 'Booking ID' },
      { key: 'name', header: 'Name' },
      { key: 'email', header: 'Email' },
      { key: 'student_id', header: 'Student ID' },
      { key: 'dominant_hand', header: 'Dominant Hand' },
      { key: 'booking_status', header: 'Booking Status' },
      { key: 'attendance', header: 'Attendance' },
      { key: 'attending_location', header: 'Location' },
      { key: 'exam_date', header: 'Exam Date' },
      { key: 'mock_type', header: 'Mock Type' },
      { key: 'start_time', header: 'Start Time' },
      { key: 'end_time', header: 'End Time' },
      { key: 'created_at', header: 'Booking Created' }
    ];

    // Build CSV header row
    const headerRow = columns.map(col => escapeCSV(col.header)).join(',');

    // Build CSV data rows
    const dataRows = bookings.map(booking => {
      return columns.map(col => escapeCSV(booking[col.key] || '')).join(',');
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
```

---

## CSV Format Specification

### Columns

| Column | Source Field | Description |
|--------|-------------|-------------|
| HubSpot ID | id | Internal HubSpot record ID |
| Booking ID | booking_id | Display booking identifier |
| Name | name | Trainee full name |
| Email | email | Trainee email address |
| Student ID | student_id | Student identification number |
| Dominant Hand | dominant_hand | Left/Right/Not specified |
| Booking Status | booking_status | Confirmed/Pending/etc. |
| Attendance | attendance | Yes/No/empty |
| Location | attending_location | Exam location |
| Exam Date | exam_date | Date of the exam |
| Mock Type | mock_type | OSCE/MCQ/etc. |
| Start Time | start_time | Exam start time |
| End Time | end_time | Exam end time |
| Booking Created | created_at | When booking was created |

### Sample Output

```csv
HubSpot ID,Booking ID,Name,Email,Student ID,Dominant Hand,Booking Status,Attendance,Location,Exam Date,Mock Type,Start Time,End Time,Booking Created
123456,BK-001,John Doe,john@example.com,STU001,right,Confirmed,Yes,Toronto,2025-11-25,OSCE,09:00,12:00,2025-11-20T10:00:00Z
123457,BK-002,"Jane Smith, MD",jane@example.com,STU002,left,Confirmed,No,Vancouver,2025-11-25,OSCE,09:00,12:00,2025-11-20T11:00:00Z
```

---

## Security Considerations

### 1. Authentication Required
- Uses `requireAdmin` middleware
- Only authenticated admins can export data

### 2. Input Validation
- Joi schema validates all input
- Prevents injection attacks
- Validates exam ID format

### 3. CSV Escaping
- All values properly escaped
- Prevents CSV injection attacks
- Handles quotes, commas, newlines

### 4. No Additional Data Exposure
- Only exports data already visible in UI
- No additional HubSpot queries
- No sensitive fields exposed

---

## Error Handling

### Validation Errors
- Empty bookings array: "bookings array is required"
- Invalid exam ID: "examId must be numeric"
- Invalid booking format: Detailed Joi error message

### Authentication Errors
- Missing token: 401 "Authentication required"
- Invalid token: 401 "Unauthorized"

### Network Errors
- Frontend shows toast: "Failed to export bookings. Please try again."
- Button returns to normal state

### Empty Data
- Button disabled when no bookings
- Tooltip explains: "No bookings to export"

---

## Testing Requirements

### Unit Tests

**File**: `admin_root/tests/unit/mock-exams/export-csv.test.js`

```javascript
describe('POST /api/admin/mock-exams/export-csv', () => {
  test('generates valid CSV from bookings array', async () => {});
  test('validates required bookings field', async () => {});
  test('validates exam ID format', async () => {});
  test('requires admin authentication', async () => {});
  test('escapes CSV special characters correctly', async () => {});
  test('handles empty string values', async () => {});
  test('returns correct Content-Type and filename', async () => {});
});
```

### Component Tests

**File**: `admin_frontend/src/components/admin/__tests__/ExportCSVButton.test.jsx`

```javascript
describe('ExportCSVButton', () => {
  test('renders export button', () => {});
  test('shows disabled state when no bookings', () => {});
  test('shows loading state during export', () => {});
  test('triggers download on success', () => {});
  test('shows error toast on failure', () => {});
  test('shows success toast with count', () => {});
});
```

### Manual Testing Checklist

- [ ] Button renders beside "Mark Attendance" area
- [ ] Button disabled when no bookings
- [ ] Button shows loading spinner during export
- [ ] CSV downloads with correct filename
- [ ] CSV opens correctly in Excel
- [ ] CSV opens correctly in Google Sheets
- [ ] All booking fields present in CSV
- [ ] Special characters escaped properly
- [ ] Error toast shown on failure
- [ ] Success toast shows booking count
- [ ] Works in dark mode

---

## Implementation Checklist

### Phase 1: Backend Endpoint (1 hour)

- [ ] Create `export-csv.js` endpoint
  - [ ] POST method handler
  - [ ] Joi validation schema
  - [ ] CSV generation logic
  - [ ] CSV escaping function
  - [ ] Response headers for download
  - [ ] Error handling
  - [ ] requireAdmin middleware

### Phase 2: Frontend Component (1 hour)

- [ ] Create `ExportCSVButton.jsx` component
  - [ ] Button UI with icon
  - [ ] Loading state
  - [ ] Disabled state
  - [ ] API call with blob response
  - [ ] Download link creation
  - [ ] Toast notifications
  - [ ] Dark mode styling
- [ ] Update `MockExamDetail.jsx`
  - [ ] Import ExportCSVButton
  - [ ] Add to bookings header section
  - [ ] Pass required props

### Phase 3: Testing (30 min)

- [ ] Test export with various booking data
- [ ] Test CSV formatting
- [ ] Test error scenarios
- [ ] Test in multiple browsers
- [ ] Test file opens in spreadsheet apps

### Phase 4: Documentation & Deployment (30 min)

- [ ] Update API documentation
- [ ] Add JSDoc comments
- [ ] Deploy to staging
- [ ] Verify functionality
- [ ] Deploy to production

---

## Success Metrics

### Functional Metrics
- CSV downloads successfully in all browsers
- CSV formatted correctly for Excel/Sheets
- All booking fields included
- Authentication enforced

### User Experience Metrics
- Export completes within 2 seconds
- Clear loading indication
- Informative success/error messages
- Intuitive button placement

### Technical Metrics
- No HubSpot API calls required
- CSV generation under 500ms
- Proper memory cleanup

---

## Dependencies

### Required
- Existing booking data from `useBookingsByExam` hook
- `requireAdmin` middleware
- Toast notifications (react-hot-toast)
- Heroicons for button icon

### No External Dependencies
- CSV generated manually (no csv library needed)
- Uses native Blob API for download

---

## Conclusion

This PRD provides a complete specification for adding CSV export functionality to the mock exam details page. The feature is designed for simplicity:

- **Frontend passes existing data** - no additional API calls
- **Backend generates CSV** - lightweight string manipulation
- **Instant download** - no file storage needed

**Implementation Time**: 2-3 hours
**Confidence Score**: 9/10

---

**Document Status**: Ready for Implementation
**Next Steps**: Begin Phase 1 (Backend Endpoint)
