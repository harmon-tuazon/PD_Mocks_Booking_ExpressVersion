# Product Requirements Document: Attendance Tracking for Mock Exam Sessions

**Version:** 1.0.0
**Created:** October 28, 2025
**Status:** Ready for Implementation
**Confidence Score:** 9/10

---

## Executive Summary

This PRD defines a comprehensive attendance tracking feature that enables administrators to efficiently mark which students attended mock exam sessions. The system uses batch operations to update HubSpot booking records and provides an intuitive UI for bulk attendance marking.

---

## 1. Problem Statement

### Current State
- Administrators have no way to track which students actually attended booked mock exam sessions
- No attendance data exists in HubSpot for reporting and analytics
- Manual tracking outside the system leads to data inconsistencies

### Desired State
- Admins can quickly mark attendance for multiple bookings in a single operation
- Attendance data is stored in HubSpot with full audit trail
- UI provides clear visual feedback for attendance status
- System handles batch operations efficiently within serverless constraints

---

## 2. Goals & Success Metrics

### Primary Goals
1. Enable efficient bulk attendance marking for exam sessions
2. Maintain data integrity with idempotent operations
3. Provide clear audit trail of attendance changes
4. Deliver responsive UX with optimistic updates

### Success Metrics
- **Efficiency**: Mark 50 bookings in < 5 seconds (API + UI time)
- **Accuracy**: 100% data consistency between UI and HubSpot
- **Usability**: < 3 clicks to mark attendance for multiple bookings
- **Reliability**: 99% success rate for batch updates (handling partial failures)

---

## 3. User Stories

### Admin User Stories

**US-1: Enter Attendance Marking Mode**
```
As an admin
I want to toggle into "attendance marking mode"
So that I can mark which students attended the exam
```

**Acceptance Criteria:**
- Toggle button clearly indicates current mode (view vs. attendance)
- Visual changes when entering attendance mode (checkboxes appear)
- Can exit mode at any time (returns to normal view)
- All selections are cleared when exiting mode

**US-2: Select Multiple Bookings**
```
As an admin
I want to select multiple bookings via checkboxes
So that I can mark attendance for many students at once
```

**Acceptance Criteria:**
- Each booking row shows a checkbox in attendance mode
- Click checkbox or row to toggle selection
- Selected rows are visually highlighted
- Selection count is displayed ("5 of 20 selected")
- "Select All" / "Clear" buttons work correctly
- Already attended bookings cannot be selected (shown as "Attended")

**US-3: Mark Attendance in Batch**
```
As an admin
I want to mark all selected bookings as attended in one operation
So that I can efficiently track attendance
```

**Acceptance Criteria:**
- "Mark as Attended" button shows count of selections
- Button is disabled when no selections exist
- Confirmation dialog appears before submission
- Loading state shown during batch update
- Success toast shows number of bookings updated
- Table refreshes to show updated attendance status

**US-4: Handle Errors Gracefully**
```
As an admin
I want clear feedback if some bookings fail to update
So that I can retry failed updates
```

**Acceptance Criteria:**
- Partial failures don't rollback successful updates
- Error toast shows which bookings failed
- Failed bookings remain selected for easy retry
- Full error details logged for debugging

---

## 4. Technical Architecture

### 4.1 HubSpot Schema

#### Booking Object Properties

**Primary Attendance Property:**
```javascript
{
  name: "attendance_status",
  label: "Attendance Status",
  type: "enumeration",
  fieldType: "select",
  groupName: "attendance_tracking",
  options: [
    { value: "No", label: "No" },    // Default: Not attended
    { value: "Yes", label: "Yes" }   // Attended
  ],
  hasUniqueValue: false,
  required: false,
  default: "No"
}
```

**Audit Properties:**
```javascript
{
  attendance_marked_at: {
    name: "attendance_marked_at",
    label: "Attendance Marked At",
    type: "datetime",
    description: "Timestamp when attendance was marked"
  },

  attendance_marked_by: {
    name: "attendance_marked_by",
    label: "Marked By (Admin Email)",
    type: "string",
    description: "Email of admin who marked attendance"
  },

  attendance_notes: {
    name: "attendance_notes",
    label: "Attendance Notes",
    type: "string",
    fieldType: "textarea",
    description: "Optional notes about attendance"
  }
}
```

### 4.2 Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  MockExamDetail Page                                 │  │
│  │  ├─ BookingsTable Component                          │  │
│  │  │  ├─ AttendanceControls                            │  │
│  │  │  ├─ BookingRow (with checkbox)                    │  │
│  │  │  └─ ConfirmationDialog                            │  │
│  │  └─ useAttendanceMarking Hook                        │  │
│  │     ├─ State: selectedBookingIds (Set)               │  │
│  │     ├─ State: isAttendanceMode (boolean)             │  │
│  │     └─ Actions: toggle, select, submit               │  │
│  └──────────────────────────────────────────────────────┘  │
│                           │                                  │
│                           ▼                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  React Query Mutation                                │  │
│  │  ├─ Optimistic Update: Mark as "Yes" in cache        │  │
│  │  ├─ API Call: POST /api/admin/mock-exams/:id/attendance │
│  │  └─ Cache Invalidation: Refetch bookings             │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│               Backend (Express.js Serverless)                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  POST /api/admin/mock-exams/[id]/attendance.js       │  │
│  │  ├─ Middleware: requireAdmin()                       │  │
│  │  ├─ Middleware: validationMiddleware()               │  │
│  │  ├─ Validation: Joi schema                           │  │
│  │  ├─ Fetch: Verify all bookings belong to exam        │  │
│  │  ├─ Transform: Build HubSpot batch payload           │  │
│  │  ├─ Execute: HubSpot batch update (max 100)          │  │
│  │  ├─ Audit: Log to timeline                           │  │
│  │  └─ Cache: Invalidate Redis cache                    │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    HubSpot CRM API                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Batch Update (up to 100 bookings)                   │  │
│  │  POST /crm/v3/objects/2-50158943/batch/update        │  │
│  │  {                                                    │  │
│  │    inputs: [                                          │  │
│  │      {                                                │  │
│  │        id: "booking_123",                             │  │
│  │        properties: {                                  │  │
│  │          attendance_status: "Yes",                    │  │
│  │          attendance_marked_at: "timestamp",           │  │
│  │          attendance_marked_by: "admin@email.com"      │  │
│  │        }                                              │  │
│  │      }                                                │  │
│  │    ]                                                  │  │
│  │  }                                                    │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 State Machine

```
States:
- VIEW: Normal table view, no attendance marking
- SELECTING: Attendance mode active, user selecting bookings
- SUBMITTING: Batch update in progress
- SUCCESS: Update completed successfully
- ERROR: Update failed (partial or complete)

State Transitions:
VIEW ──[Toggle Mode]──> SELECTING
SELECTING ──[Toggle Mode]──> VIEW
SELECTING ──[Submit]──> SUBMITTING
SUBMITTING ──[Success]──> VIEW
SUBMITTING ──[Error]──> ERROR
ERROR ──[Retry]──> SUBMITTING
ERROR ──[Exit]──> VIEW
```

---

## 5. API Specification

### 5.1 Endpoint Definition

```
POST /api/admin/mock-exams/:mockExamId/attendance
```

### 5.2 Request

**Headers:**
```http
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json
```

**Path Parameters:**
- `mockExamId` (string, required): HubSpot ID of the mock exam session

**Body:**
```json
{
  "bookingIds": ["booking_123", "booking_456", "booking_789"],
  "notes": "Optional attendance notes"
}
```

**Validation Rules:**
- `bookingIds`: Array of strings, 1-100 items, each matching pattern `/^\d+$/`
- `notes`: String, max 500 characters, optional

### 5.3 Response

**Success (200):**
```json
{
  "success": true,
  "summary": {
    "total": 50,
    "updated": 48,
    "failed": 2,
    "skipped": 0
  },
  "results": {
    "successful": [
      {
        "bookingId": "booking_123",
        "previousStatus": "No",
        "newStatus": "Yes",
        "markedAt": "2025-10-28T10:30:00.000Z"
      }
    ],
    "failed": [
      {
        "bookingId": "booking_456",
        "error": "Booking not found"
      }
    ],
    "skipped": []
  },
  "timestamp": "2025-10-28T10:30:00.000Z"
}
```

**Error Responses:**

**400 Bad Request:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": [
      {
        "field": "bookingIds",
        "message": "Array must contain between 1 and 100 items"
      }
    ]
  }
}
```

**401 Unauthorized:**
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Valid authentication required"
  }
}
```

**404 Not Found:**
```json
{
  "success": false,
  "error": {
    "code": "EXAM_NOT_FOUND",
    "message": "Mock exam not found"
  }
}
```

**504 Gateway Timeout:**
```json
{
  "success": false,
  "error": {
    "code": "TIMEOUT",
    "message": "Request exceeded 55 second limit. Please reduce batch size."
  }
}
```

---

## 6. UI/UX Specifications

### 6.1 Component Hierarchy

```
MockExamDetail.jsx
└── BookingsTable.jsx
    ├── AttendanceControls.jsx
    │   ├── Toggle Mode Button
    │   ├── Selection Counter
    │   ├── Select All / Clear Buttons
    │   └── Mark as Attended Button
    ├── SearchBar.jsx (hidden in attendance mode)
    ├── BookingRow.jsx (enhanced)
    │   ├── Checkbox (attendance mode only)
    │   ├── Student Details
    │   ├── Attendance Status Badge
    │   └── Selected Highlight
    └── ConfirmationDialog.jsx
        ├── Warning Icon
        ├── Selected Count
        └── Confirm/Cancel Buttons
```

### 6.2 Visual States

**Normal View Mode:**
- Standard table layout
- No checkboxes visible
- Search and pagination enabled
- "Mark Attendance" button in primary color

**Attendance Mode (Active):**
- Toggle button changes to "Exit Attendance Mode" with X icon
- Checkboxes appear in first column
- Selected rows highlighted with primary-50 background
- Selection counter shows "X of Y selected"
- "Mark as Attended" button appears (green, with count)
- Search and pagination disabled
- Already attended bookings show green badge ("Attended")

**Submitting State:**
- Loading spinner on "Mark as Attended" button
- All interactions disabled
- Optimistic UI: Selected rows immediately show "Attended" badge

**Success State:**
- Success toast: "Successfully marked X booking(s) as attended"
- Table refreshes with updated data
- Mode exits to normal view
- Selections cleared

**Error State:**
- Error toast with failure details
- Failed bookings remain selected
- Can retry or exit mode

### 6.3 Interaction Patterns

**Keyboard Shortcuts:**
- `Escape`: Exit attendance mode
- `Ctrl+A`: Select all unattended bookings
- `Enter/Space` (on row): Toggle selection

**Mouse Interactions:**
- Click checkbox: Toggle selection
- Click row (attendance mode): Toggle selection
- Click "Select All": Select all unattended bookings
- Click "Clear": Deselect all

**Touch Interactions:**
- Tap row: Toggle selection
- Long press: Show context menu (future enhancement)

### 6.4 Accessibility

**ARIA Labels:**
```html
<button aria-pressed="true" aria-label="Exit attendance mode">
<input type="checkbox" aria-label="Select booking for John Doe">
<div role="status" aria-live="polite">5 bookings selected</div>
```

**Keyboard Navigation:**
- All interactive elements focusable
- Visible focus indicators
- Logical tab order

**Screen Reader Support:**
- Status announcements for mode changes
- Selection count announcements
- Success/error message announcements

---

## 7. Implementation Plan

### Phase 1: Backend Foundation (Day 1-2)

**Tasks:**
1. Create HubSpot properties for attendance tracking
2. Implement `/api/admin/mock-exams/:id/attendance` endpoint
3. Add Joi validation schema
4. Implement batch update logic with chunking
5. Add error handling for partial failures
6. Implement cache invalidation

**Files Created/Modified:**
- `admin_root/api/admin/mock-exams/[id]/attendance.js` (new)
- `admin_root/api/_shared/validation.js` (modified)
- `admin_root/api/_shared/hubspot.js` (modified - add batch method)

**Testing:**
- Unit tests for validation
- Integration tests for batch updates
- Test partial failure scenarios
- Test timeout handling

### Phase 2: Frontend State Management (Day 3)

**Tasks:**
1. Create `useAttendanceMarking` hook
2. Create `useMarkAttendanceMutation` hook
3. Implement state machine logic
4. Add optimistic updates
5. Add keyboard shortcut handlers

**Files Created:**
- `admin_root/admin_frontend/src/hooks/useAttendanceMarking.js`
- `admin_root/admin_frontend/src/hooks/useMarkAttendanceMutation.js`

**Testing:**
- Test state transitions
- Test selection/deselection logic
- Test optimistic update rollback

### Phase 3: UI Components (Day 4-5)

**Tasks:**
1. Create `AttendanceControls` component
2. Create `ConfirmationDialog` component
3. Create `Checkbox` component
4. Enhance `BookingRow` component
5. Enhance `BookingsTable` component
6. Update `MockExamDetail` page

**Files Created/Modified:**
- `admin_root/admin_frontend/src/components/admin/AttendanceControls.jsx` (new)
- `admin_root/admin_frontend/src/components/admin/ConfirmationDialog.jsx` (new)
- `admin_root/admin_frontend/src/components/ui/Checkbox.jsx` (new)
- `admin_root/admin_frontend/src/components/admin/BookingRow.jsx` (modified)
- `admin_root/admin_frontend/src/components/admin/BookingsTable.jsx` (modified)
- `admin_root/admin_frontend/src/pages/MockExamDetail.jsx` (modified)

**Testing:**
- Component unit tests
- Interaction tests
- Accessibility tests
- Visual regression tests

### Phase 4: Integration & Testing (Day 6)

**Tasks:**
1. End-to-end testing
2. Performance testing (large batches)
3. Accessibility audit
4. Cross-browser testing
5. Error scenario testing

### Phase 5: Documentation & Deployment (Day 7)

**Tasks:**
1. Update API documentation
2. Create user guide for admins
3. Deploy to staging
4. Admin training session
5. Deploy to production
6. Monitor metrics

---

## 8. Edge Cases & Error Handling

### Edge Case 1: Concurrent Attendance Marking
**Scenario:** Two admins mark attendance for the same exam simultaneously

**Handling:**
- Last write wins (HubSpot's default behavior)
- Both operations succeed independently
- Audit trail shows both admin actions with timestamps
- No data corruption possible

### Edge Case 2: Already Attended Bookings
**Scenario:** Admin tries to select booking that's already marked attended

**Handling:**
- Booking row shows green "Attended" badge
- Checkbox is replaced with checkmark icon + "Attended" text
- Clicking row shows toast: "This booking is already marked as attended"
- Cannot be selected

### Edge Case 3: Booking List Changes During Selection
**Scenario:** Bookings are added/removed while admin is selecting

**Handling:**
- React Query refetches data on interval
- Selections based on booking IDs (persist across re-renders)
- If selected booking disappears, it's removed from selection
- Admin notified if selections were adjusted

### Edge Case 4: Partial Batch Failure
**Scenario:** 48 of 50 bookings update successfully, 2 fail

**Handling:**
- Successful updates are NOT rolled back
- Error toast shows: "Marked 48 attendees. 2 failed."
- Failed booking IDs remain selected for easy retry
- Full error details logged to console
- Response includes which bookings failed and why

### Edge Case 5: Network Timeout
**Scenario:** Batch update takes > 55 seconds (Vercel limit)

**Handling:**
- Backend responds with 504 Gateway Timeout
- Error toast: "Request exceeded time limit. Please reduce batch size."
- No partial state (either all updates complete or none)
- Admin can retry with smaller batch

### Edge Case 6: Empty Selection Submission
**Scenario:** Admin clicks "Mark as Attended" with no selections

**Handling:**
- Button is disabled when `selectedCount === 0`
- Clicking does nothing (button not clickable)
- No API call made

### Edge Case 7: Cancelled Booking Attendance
**Scenario:** Admin tries to mark attendance for cancelled booking

**Handling:**
- Backend validation rejects cancelled bookings
- Error response: "Cannot mark attendance for cancelled booking"
- Booking excluded from successful updates
- Admin notified via error toast

---

## 9. Performance Considerations

### Batch Size Optimization
- **Frontend**: No hard limit on selection count
- **Backend**: Automatically chunks into batches of 100 (HubSpot limit)
- **Recommended**: Admins should mark < 100 at a time for best UX
- **Maximum**: 100 bookings per request (enforced by validation)

### Expected Performance
| Operation | Time | Notes |
|-----------|------|-------|
| Validation | < 100ms | Joi schema validation |
| Fetch bookings | < 500ms | Verify ownership |
| HubSpot batch update | 500-2000ms | 1-100 bookings |
| Cache invalidation | < 200ms | Redis pattern delete |
| **Total (100 bookings)** | **~2-3 seconds** | User perceives as instant with optimistic UI |

### Optimization Techniques
1. **Optimistic Updates**: UI shows "Attended" immediately
2. **Batch API Calls**: 100x reduction in API calls vs. individual updates
3. **Parallel Processing**: Multiple batches processed concurrently
4. **Smart Caching**: Only invalidate affected cache keys
5. **Early Validation**: Fail fast for invalid data

---

## 10. Security & Compliance

### Authentication & Authorization
- **Required**: Valid admin JWT token (Supabase)
- **Middleware**: `requireAdmin()` validates token
- **Scope**: Any authenticated admin can mark attendance
- **Audit**: Admin email logged with every attendance change

### Input Validation & Sanitization
- **Joi Schema**: Validates all request parameters
- **HTML Sanitization**: Remove any HTML/scripts from notes field
- **SQL Injection**: N/A (no SQL, only HubSpot API)
- **XSS Prevention**: React's built-in escaping

### Rate Limiting
- **Global**: Vercel's built-in rate limiting
- **Endpoint-Specific**: 10 requests/minute per admin user
- **Response**: 429 Too Many Requests with retry-after header

### Data Privacy
- **PII Handling**: Student names/emails visible only to authenticated admins
- **Audit Trail**: Complete history of who marked attendance when
- **Retention**: Follows HubSpot data retention policies
- **GDPR Compliance**: Student data can be deleted per GDPR requirements

---

## 11. Monitoring & Analytics

### Metrics to Track
1. **Usage Metrics**:
   - Number of attendance marking operations per day
   - Average batch size
   - Time to mark attendance per exam
   - Adoption rate by admins

2. **Performance Metrics**:
   - API response time (p50, p95, p99)
   - Success rate (successful updates / total attempts)
   - Partial failure rate
   - Cache hit rate

3. **Error Metrics**:
   - Error rate by type (validation, timeout, HubSpot API)
   - Failed booking IDs (for pattern detection)
   - Retry success rate

### Alerts
- **Critical**: Success rate < 95%
- **Warning**: Average response time > 5 seconds
- **Info**: > 50 bookings marked in single operation (consider UX guidance)

### Logging
```javascript
// Successful operation
logger.info('Attendance marked', {
  examId,
  adminEmail,
  totalBookings: 50,
  successful: 48,
  failed: 2,
  duration: 2341
});

// Failed operation
logger.error('Attendance marking failed', {
  examId,
  adminEmail,
  error: error.message,
  bookingIds: failedIds
});
```

---

## 12. Rollback Plan

### If Critical Issues Arise

**Phase 1: Immediate Actions (< 5 minutes)**
1. Disable attendance marking in UI (feature flag)
2. Return endpoint to maintenance mode (503 response)
3. Notify admins via toast message

**Phase 2: Investigation (< 30 minutes)**
1. Check error logs for failure patterns
2. Verify HubSpot API status
3. Check cache consistency
4. Review recent deployments

**Phase 3: Rollback (< 60 minutes)**
1. Revert to previous deployment if code issue
2. Manually correct any data inconsistencies in HubSpot
3. Clear affected Redis cache keys
4. Re-enable feature once stable

**Phase 4: Post-Mortem (< 24 hours)**
1. Document root cause
2. Identify prevention measures
3. Update tests to catch issue
4. Deploy fix

---

## 13. Future Enhancements

### Phase 2 Features (Future Scope)
1. **Undo Attendance**: Allow marking as "No" after marking "Yes"
2. **Bulk Absence Marking**: Mark multiple bookings as absent
3. **Late Arrival Time**: Record arrival time for late students
4. **Partial Attendance**: Mark as "Partial" with time ranges
5. **Attendance Reports**: Export attendance data to CSV/PDF
6. **Attendance Statistics**: Dashboard showing attendance trends
7. **Mobile Optimization**: Dedicated mobile UI for on-site marking
8. **QR Code Scanning**: Students scan QR code to self-mark attendance
9. **Email Notifications**: Auto-email no-show students
10. **Attendance Analytics**: Correlate attendance with exam performance

---

## 14. Appendix

### A. Glossary
- **Attendance Mode**: UI state where admin can select and mark attendance
- **Batch Operation**: Updating multiple HubSpot records in single API call
- **Optimistic Update**: Updating UI before server confirms change
- **Partial Failure**: Some updates succeed while others fail in a batch
- **Idempotent**: Operation that can be retried safely without side effects

### B. Related Documents
- `/documentation/HUBSPOT_SCHEMA_DOCUMENTATION.md`: HubSpot object schema
- `/documentation/API_DOCUMENTATION.md`: API endpoint reference
- `/admin_root/api/_shared/hubspot.js`: HubSpot service implementation

### C. Open Questions
None - all requirements clarified.

---

## Approval & Sign-off

**Product Owner:** _________________________
**Tech Lead:** _________________________
**Date:** _________________________

---

**END OF PRD**
