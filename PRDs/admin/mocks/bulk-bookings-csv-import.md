# PRD: Bulk Bookings CSV Import

## Overview

**Feature Name:** Bulk Bookings CSV Import
**Version:** 1.0.0
**Author:** Claude Code
**Date:** January 15, 2026
**Confidence Score:** 9/10

## Problem Statement

Admins currently need to create bookings one-by-one through the UI or directly in HubSpot. For large cohorts (20-200+ trainees), this is time-consuming and error-prone. We need a bulk import feature that allows admins to upload a CSV file with minimal required fields and have the system auto-fill the rest from existing database records.

## Goals

1. Enable admins to create multiple bookings via CSV upload
2. Minimize CSV complexity - only require 3 essential columns
3. Auto-fill missing booking properties from Supabase
4. Provide clear error feedback with downloadable error report
5. Ensure security through input sanitization
6. Show per-user loading state during processing

## Non-Goals

1. Real-time HubSpot sync (cron handles this every 15 minutes)
2. Credit deduction (admin bulk bookings bypass credit checks)
3. Capacity validation (admin override - they can overbook if needed)
4. File storage (CSV processed in-memory only)

---

## Technical Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         BULK BOOKING FLOW                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐          │
│  │  Admin   │───>│ Frontend │───>│   API    │───>│ Supabase │          │
│  │ Uploads  │    │  Parse   │    │ Validate │    │  Insert  │          │
│  │   CSV    │    │   CSV    │    │ & Enrich │    │ Bookings │          │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘          │
│                                         │                                │
│                                         v                                │
│                               ┌──────────────────┐                      │
│                               │  Cron Job (15m)  │                      │
│                               │  Syncs to        │                      │
│                               │  HubSpot         │                      │
│                               └──────────────────┘                      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### CSV Format

**Required Columns (3 only):**
```csv
student_id,mock_exam_id,token_used
PREP001,123456789,sj_credits
PREP002,123456789,shared_mock_credits
PREP003,987654321,cs_credits
```

**Column Definitions:**
| Column | Type | Description | Validation |
|--------|------|-------------|------------|
| `student_id` | string | Student ID (e.g., "PREP001") | Required, alphanumeric, max 50 chars |
| `mock_exam_id` | string | HubSpot exam ID | Required, numeric string, max 20 chars |
| `token_used` | string | Credit type used | Required, enum: `sj_credits`, `cs_credits`, `sjmini_credits`, `mock_discussion_token`, `shared_mock_credits` |

### Auto-Filled Properties

**From `hubspot_contact_credits` (by student_id):**
- `associated_contact_id` → contact's `hubspot_id`
- `name` → `firstname` + `lastname`
- `student_email` → `email`

**From `hubspot_mock_exams` (by mock_exam_id):**
- `mock_type`
- `exam_date`
- `start_time`
- `end_time`
- `attending_location` → `location`

**Generated/Default:**
- `id` → Auto-generated UUID
- `hubspot_id` → NULL (cron syncs later)
- `booking_id` → `{mock_type}-{student_id}-{formatted_exam_date}`
- `is_active` → `'Active'`
- `attendance` → NULL
- `dominant_hand` → NULL
- `idempotency_key` → `bulk-{contact_hubspot_id}-{exam_hubspot_id}-{timestamp}`
- `created_at` → NOW()
- `updated_at` → NOW()
- `synced_at` → NOW()

---

## API Specification

### Endpoint: POST /api/admin/bookings/bulk-create

**Request:**
```javascript
// Content-Type: application/json
{
  "csv_data": "student_id,mock_exam_id,token_used\nPREP001,123456789,sj_credits\n..."
}
```

**Success Response (200):**
```javascript
{
  "success": true,
  "summary": {
    "total_rows": 100,
    "created": 97,
    "errors": 3
  },
  "created_bookings": [
    {
      "row": 1,
      "student_id": "PREP001",
      "booking_id": "SJ-PREP001-March 15, 2026",
      "id": "uuid-here"
    }
    // ...
  ],
  "errors": [
    {
      "row": 5,
      "student_id": "PREP999",
      "mock_exam_id": "123456789",
      "token_used": "sj_credits",
      "error_code": "CONTACT_NOT_FOUND",
      "error_message": "No contact found with student_id 'PREP999'"
    },
    {
      "row": 12,
      "student_id": "PREP002",
      "mock_exam_id": "999999999",
      "token_used": "cs_credits",
      "error_code": "EXAM_NOT_FOUND",
      "error_message": "No mock exam found with ID '999999999'"
    },
    {
      "row": 45,
      "student_id": "PREP003",
      "mock_exam_id": "123456789",
      "token_used": "invalid_token",
      "error_code": "INVALID_TOKEN_TYPE",
      "error_message": "Invalid token_used value. Must be one of: sj_credits, cs_credits, sjmini_credits, mock_discussion_token, shared_mock_credits"
    }
  ]
}
```

**Validation Error Response (400):**
```javascript
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "CSV validation failed",
    "details": "Missing required column: student_id"
  }
}
```

**Server Error Response (500):**
```javascript
{
  "success": false,
  "error": {
    "code": "SERVER_ERROR",
    "message": "Failed to process bulk bookings",
    "details": "Database connection error"
  }
}
```

---

## Security Requirements

### Input Sanitization

**All CSV values MUST be sanitized before database operations:**

1. **String Sanitization:**
   ```javascript
   function sanitizeString(value, maxLength = 255) {
     if (typeof value !== 'string') return '';
     return value
       .trim()
       .slice(0, maxLength)
       .replace(/[<>\"\'\\;]/g, '') // Remove dangerous chars
       .replace(/[\x00-\x1F\x7F]/g, ''); // Remove control chars
   }
   ```

2. **student_id Validation:**
   ```javascript
   // Alphanumeric only, max 50 chars
   const STUDENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,50}$/;
   ```

3. **mock_exam_id Validation:**
   ```javascript
   // Numeric string only, max 20 chars
   const EXAM_ID_PATTERN = /^[0-9]{1,20}$/;
   ```

4. **token_used Validation:**
   ```javascript
   const VALID_TOKENS = [
     'sj_credits',
     'cs_credits',
     'sjmini_credits',
     'mock_discussion_token',
     'shared_mock_credits'
   ];
   ```

5. **SQL Injection Prevention:**
   - Use Supabase parameterized queries (built-in)
   - Never concatenate user input into queries
   - Use `.in()` operator for batch lookups

6. **XSS Prevention:**
   - Sanitize all output displayed in UI
   - Error messages should not echo raw input

### Rate Limiting

- Max 500 rows per upload
- Max 10 bulk imports per hour per user

---

## Frontend Implementation

### Component: BulkBookings.jsx

**States:**
1. `idle` - Initial state, showing upload form
2. `parsing` - CSV file being parsed client-side
3. `processing` - API request in progress
4. `success` - Import completed (with or without partial errors)
5. `error` - Full failure (network error, 5XX, etc.)

### Loading State (Per-User)

The loading state is **per-user session** - stored in React component state, not global. If User A starts an import, only User A sees the loading indicator. User B visiting the same page sees the idle state.

```jsx
// State is local to each user's browser session
const [importState, setImportState] = useState('idle');
const [progress, setProgress] = useState({ current: 0, total: 0 });
```

### UI Components

**1. Idle State - Upload Form:**
```
┌─────────────────────────────────────────────────────────────────┐
│  Bulk Bookings Import                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                            │  │
│  │     📁 Drag and drop your CSV file here                   │  │
│  │           or click to browse                               │  │
│  │                                                            │  │
│  │     Accepted format: .csv (max 500 rows)                  │  │
│  │                                                            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  📥 Download Sample CSV Template                                │
│                                                                  │
│  ────────────────────────────────────────────────────────────── │
│                                                                  │
│  Required Columns:                                               │
│  • student_id - Student's ID (e.g., "PREP001")                  │
│  • mock_exam_id - HubSpot mock exam ID                          │
│  • token_used - Credit type (sj_credits, cs_credits, etc.)      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**2. Processing State - Loading Indicator:**
```
┌─────────────────────────────────────────────────────────────────┐
│  Bulk Bookings Import                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│              ┌─────────────────────────────┐                    │
│              │                             │                    │
│              │      ⏳ Processing...       │                    │
│              │                             │                    │
│              │   Creating 150 bookings     │                    │
│              │                             │                    │
│              │   ████████████░░░░░░ 75%   │                    │
│              │                             │                    │
│              │   Please don't close        │                    │
│              │   this page                 │                    │
│              │                             │                    │
│              └─────────────────────────────┘                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**3. Success State - Results Summary:**
```
┌─────────────────────────────────────────────────────────────────┐
│  Bulk Bookings Import                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ✅ Import Completed                                            │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │    150      │  │    147      │  │     3       │             │
│  │   Total     │  │  Created    │  │   Errors    │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                  │
│  ⚠️ 3 rows had errors and were not imported.                   │
│  📥 Download Error Report (CSV)                                 │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ [Import Another File]                                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Error Report CSV (Auto-Download)

When errors occur, automatically download a CSV with the failed rows plus error explanation:

```csv
row_number,student_id,mock_exam_id,token_used,error_code,error_message
5,PREP999,123456789,sj_credits,CONTACT_NOT_FOUND,"No contact found with student_id 'PREP999'"
12,PREP002,999999999,cs_credits,EXAM_NOT_FOUND,"No mock exam found with ID '999999999'"
45,PREP003,123456789,invalid_token,INVALID_TOKEN_TYPE,"Invalid token_used value. Must be one of: sj_credits, cs_credits, sjmini_credits, mock_discussion_token, shared_mock_credits"
```

### Error Handling

**Toast Notifications for System Errors:**

| Error Type | Toast Style | Message |
|------------|-------------|---------|
| 400 Bad Request | Error (red) | "Invalid CSV format: {details}" |
| 401 Unauthorized | Error (red) | "Session expired. Please log in again." |
| 403 Forbidden | Error (red) | "You don't have permission to perform this action." |
| 413 Payload Too Large | Error (red) | "File too large. Maximum 500 rows allowed." |
| 429 Too Many Requests | Warning (yellow) | "Too many imports. Please wait before trying again." |
| 500 Server Error | Error (red) | "Server error. Please try again later." |
| 502/503/504 | Error (red) | "Service temporarily unavailable. Please try again." |
| Network Error | Error (red) | "Network error. Check your connection and try again." |

---

## Backend Implementation

### File: `admin_root/api/admin/bookings/bulk-create.js`

**Processing Steps:**

1. **Authentication** - Verify admin token via `requireAdmin()`
2. **Parse CSV** - Extract rows from CSV string
3. **Validate Headers** - Ensure required columns exist
4. **Sanitize Rows** - Clean all input values
5. **Validate Rows** - Check format of each value
6. **Batch Fetch Contacts** - Single query for all unique student_ids
7. **Batch Fetch Exams** - Single query for all unique mock_exam_ids
8. **Build Bookings** - Construct full booking objects with auto-filled data
9. **Identify Errors** - Separate valid rows from invalid ones
10. **Bulk Insert** - Insert valid bookings to Supabase
11. **Update Exam Counts** - Increment total_bookings for affected exams
12. **Return Response** - Success summary + error details

### Error Codes

| Code | Description |
|------|-------------|
| `CONTACT_NOT_FOUND` | student_id doesn't exist in hubspot_contact_credits |
| `EXAM_NOT_FOUND` | mock_exam_id doesn't exist in hubspot_mock_exams |
| `INVALID_TOKEN_TYPE` | token_used is not a valid enum value |
| `INVALID_STUDENT_ID` | student_id contains invalid characters |
| `INVALID_EXAM_ID` | mock_exam_id is not a valid numeric string |
| `DUPLICATE_BOOKING` | Booking already exists for this contact+exam |
| `MISSING_VALUE` | Required column value is empty |

### Database Query Strategy

**Optimized Batch Approach (3 queries total):**

```javascript
// Query 1: Batch fetch contacts
const { data: contacts } = await supabase
  .from('hubspot_contact_credits')
  .select('hubspot_id, student_id, email, firstname, lastname')
  .in('student_id', uniqueStudentIds);

// Query 2: Batch fetch exams
const { data: exams } = await supabase
  .from('hubspot_mock_exams')
  .select('hubspot_id, mock_type, exam_date, start_time, end_time, location')
  .in('hubspot_id', uniqueExamIds);

// Query 3: Bulk insert bookings
const { data: inserted, error } = await supabase
  .from('hubspot_bookings')
  .insert(validBookings)
  .select();
```

---

## Sample CSV Template

**File: `bulk-bookings-template.csv`**

```csv
student_id,mock_exam_id,token_used
PREP001,123456789,sj_credits
PREP002,123456789,shared_mock_credits
PREP003,987654321,cs_credits
```

**Template Download Implementation:**
```javascript
const downloadTemplate = () => {
  const template = 'student_id,mock_exam_id,token_used\nPREP001,123456789,sj_credits\n';
  const blob = new Blob([template], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'bulk-bookings-template.csv';
  a.click();
  URL.revokeObjectURL(url);
};
```

---

## Testing Requirements

### Unit Tests

1. **CSV Parsing**
   - Valid CSV with all columns
   - CSV with extra columns (should ignore)
   - CSV with missing required columns
   - Empty CSV
   - CSV with only headers

2. **Input Sanitization**
   - XSS attempt in student_id
   - SQL injection attempt in mock_exam_id
   - Special characters in all fields
   - Very long strings (boundary testing)
   - Unicode characters

3. **Validation**
   - Valid token types
   - Invalid token types
   - Empty values
   - Whitespace-only values

### Integration Tests

1. **Happy Path**
   - 10 valid rows → all created
   - 100 valid rows → all created

2. **Partial Success**
   - 10 rows, 2 invalid contacts → 8 created, 2 errors
   - 10 rows, 3 invalid exams → 7 created, 3 errors

3. **Full Failure**
   - All rows have invalid student_ids
   - All rows have invalid exam_ids

4. **Edge Cases**
   - Exactly 500 rows (max limit)
   - 501 rows (should reject)
   - Duplicate bookings in same upload

---

## Implementation Checklist

### Backend

- [ ] Create `/api/admin/bookings/bulk-create.js` endpoint
- [ ] Add Joi validation schema for CSV data
- [ ] Implement CSV parsing with `csv-parse` or manual parsing
- [ ] Implement input sanitization functions
- [ ] Implement batch contact lookup
- [ ] Implement batch exam lookup
- [ ] Implement booking object builder
- [ ] Implement bulk insert with error handling
- [ ] Implement exam count increment (atomic)
- [ ] Add rate limiting (10 imports/hour/user)
- [ ] Add row limit validation (max 500)

### Frontend

- [ ] Update `BulkBookings.jsx` with full implementation
- [ ] Implement file upload with drag-and-drop
- [ ] Implement CSV parsing client-side (for preview)
- [ ] Implement loading state with progress
- [ ] Implement success state with summary cards
- [ ] Implement error CSV auto-download
- [ ] Implement toast notifications for system errors
- [ ] Implement sample template download
- [ ] Add file size/row count validation

### Testing

- [ ] Unit tests for sanitization functions
- [ ] Unit tests for CSV parsing
- [ ] Integration tests for API endpoint
- [ ] E2E tests for full upload flow

---

## Dependencies

### NPM Packages (if needed)

**Backend:**
- `csv-parse` (optional) - CSV parsing library
- Or use simple `split()` parsing for minimal overhead

**Frontend:**
- `papaparse` (optional) - Client-side CSV parsing
- Or use simple `split()` parsing

**Note:** Both can be implemented with vanilla JS to minimize bundle size.

---

## Rollout Plan

### Phase 1: Backend API
1. Implement and test `/api/admin/bookings/bulk-create.js`
2. Deploy to staging
3. Test with sample CSVs

### Phase 2: Frontend UI
1. Implement full `BulkBookings.jsx` component
2. Test upload flow end-to-end
3. Deploy to staging

### Phase 3: Production
1. Deploy to production
2. Monitor for errors
3. Gather admin feedback

---

## Success Metrics

1. **Time Saved**: Bulk import of 100 bookings should take < 30 seconds (vs 30+ minutes manually)
2. **Error Rate**: < 5% of imports should fail due to system errors
3. **User Adoption**: > 80% of bulk booking operations use CSV import within 1 month

---

## Open Questions

1. Should we support Excel files (.xlsx) in addition to CSV?
   - **Recommendation**: No, CSV only for simplicity. Excel can export to CSV.

2. Should we add a "preview" step before final import?
   - **Recommendation**: Optional for v1.1. Start with direct import for v1.0.

3. Should bulk bookings deduct credits?
   - **Recommendation**: No, admin bulk imports are manual overrides. Credit management is separate.

---

## Appendix

### Error Message Catalog

```javascript
const ERROR_MESSAGES = {
  CONTACT_NOT_FOUND: (studentId) =>
    `No contact found with student_id '${studentId}'`,
  EXAM_NOT_FOUND: (examId) =>
    `No mock exam found with ID '${examId}'`,
  INVALID_TOKEN_TYPE: (token) =>
    `Invalid token_used value '${token}'. Must be one of: sj_credits, cs_credits, sjmini_credits, mock_discussion_token, shared_mock_credits`,
  INVALID_STUDENT_ID: (studentId) =>
    `Invalid student_id '${studentId}'. Must be alphanumeric, max 50 characters`,
  INVALID_EXAM_ID: (examId) =>
    `Invalid mock_exam_id '${examId}'. Must be numeric`,
  DUPLICATE_BOOKING: (studentId, examId) =>
    `Booking already exists for student '${studentId}' on exam '${examId}'`,
  MISSING_VALUE: (column) =>
    `Missing required value for column '${column}'`
};
```

### Valid Token Types

```javascript
const VALID_TOKEN_TYPES = [
  'sj_credits',           // Situational Judgment
  'cs_credits',           // Clinical Skills
  'sjmini_credits',       // Mini-mock (SJ only)
  'mock_discussion_token', // Mock Discussion
  'shared_mock_credits'   // Shared (SJ or CS)
];
```
