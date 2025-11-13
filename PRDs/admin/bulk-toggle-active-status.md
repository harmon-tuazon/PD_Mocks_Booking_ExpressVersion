# PRD: Bulk Toggle Active/Inactive Status for Mock Exam Sessions

**Feature Name:** Bulk Toggle Active/Inactive Status
**Version:** 1.0
**Date:** November 13, 2025
**Status:** Draft
**Confidence Score:** 9/10

---

## 1. Executive Summary

### Problem Statement
Admins need an efficient way to activate or deactivate multiple mock exam sessions simultaneously from the main dashboard. Currently, admins must navigate to individual session detail pages to change the active status, which is time-consuming when managing multiple sessions (e.g., canceling all sessions for a specific date or reactivating sessions after a venue becomes available).

### Proposed Solution
Implement a bulk toggle active/inactive feature that:
- Leverages the existing bulk selection mode infrastructure
- Adds a "Toggle Active Status" button to the selection toolbar
- Opens a confirmation modal before executing the operation
- Intelligently toggles each session's `is_active` property (true → false, false → true)
- Processes updates via HubSpot batch API calls to respect rate limits
- Provides detailed success/failure feedback for each session

### Success Metrics
- Admins can toggle active status for multiple sessions in under 10 seconds
- Batch operations complete successfully with <5% failure rate
- API rate limits are respected (no 429 errors)
- Users receive clear feedback on operation results
- Zero accidental bulk status changes (via confirmation modal)

### Existing Code References
This feature will be modeled on the existing **Mark Attendance** batch operation:
- **Backend Pattern:** `admin_root/api/admin/mock-exams/[id]/attendance.js`
- **Batch Processing:** HubSpot batch API with 100-item chunks
- **Cache Invalidation:** Redis cache pattern for affected resources
- **Error Handling:** Partial failure tracking with detailed reporting

---

## 2. User Stories

### US-1: Bulk Toggle from Dashboard
**As an** admin user
**I want to** select multiple mock exam sessions and toggle their active status
**So that** I can efficiently manage session availability without visiting individual pages

**Acceptance Criteria:**
- Selection toolbar displays "Toggle Active Status" button when 1+ sessions selected
- Button is enabled regardless of current active/inactive state of selected sessions
- Button shows appropriate icon (power/toggle icon)
- Clicking button opens confirmation modal

### US-2: Confirmation Modal
**As an** admin user
**I want to** see a confirmation modal before toggling active status
**So that** I can review my selection and avoid accidental bulk changes

**Acceptance Criteria:**
- Modal displays:
  - Number of sessions to be toggled
  - Breakdown: "X will be activated, Y will be deactivated"
  - Clear warning about the operation
  - "Confirm" and "Cancel" buttons
- Modal shows loading state during API calls
- Modal can be closed with ESC key or Cancel button
- Clicking outside modal closes it (acts as Cancel)

### US-3: Intelligent Toggle Logic
**As an** admin user
**I want to** have each session's status toggled individually
**So that** active sessions become inactive and inactive sessions become active

**Acceptance Criteria:**
- Backend reads current `is_active` value for each session
- Sessions with `is_active: true` are set to `is_active: false`
- Sessions with `is_active: false` are set to `is_active: true`
- Each session is toggled independently (not all set to same state)

### US-4: Result Feedback
**As an** admin user
**I want to** see detailed results after the operation completes
**So that** I know which sessions were successfully updated and which failed

**Acceptance Criteria:**
- Success toast notification shows:
  - "Successfully toggled status for X sessions"
  - Link to view details (optional)
- Error toast notification shows:
  - "Failed to toggle Y sessions. See details."
  - Errors are logged for review
- Table updates to reflect new active/inactive states
- Selection mode exits after operation completes

### US-5: Graceful Failure Handling
**As an** admin user
**I want to** have partial successes handled gracefully
**So that** some sessions can be updated even if others fail

**Acceptance Criteria:**
- Batch operations continue even if some items fail
- Each failure is tracked with session ID and error reason
- Successful updates are committed even if some fail
- User receives breakdown of successes vs failures

---

## 3. Technical Requirements

### 3.1 Frontend Architecture

#### New Component: `BulkToggleActiveModal`
**Purpose:** Confirmation modal for bulk toggle operation

**Location:** `admin_root/admin_frontend/src/components/admin/BulkToggleActiveModal.jsx`

**Props:**
```javascript
{
  isOpen: boolean,
  onClose: () => void,
  onConfirm: () => Promise<void>,
  selectedSessions: Array<Session>,
  isSubmitting: boolean
}
```

**Features:**
- Calculates how many sessions will be activated vs deactivated
- Shows session breakdown in modal body
- Handles loading state with spinner
- Disables confirm button while submitting
- Auto-closes on successful operation

**Modal Content:**
```
Title: "Toggle Active Status"

Body:
"You are about to toggle the active status for 15 sessions:
• 8 sessions will be activated
• 7 sessions will be deactivated

This action will make active sessions inactive and vice versa."

Buttons: [Cancel] [Confirm Toggle]
```

#### Modified Component: `MockExamsSelectionToolbar`
**Changes:** Add "Toggle Active Status" button

**Location:** `admin_root/admin_frontend/src/components/admin/MockExamsSelectionToolbar.jsx`

**New Props:**
```javascript
{
  // Existing props
  selectedCount: number,
  totalCount: number,
  onClearAll: () => void,
  onExitMode: () => void,
  isSubmitting: boolean,

  // New props
  onToggleActiveStatus: () => void,  // Opens confirmation modal
  selectedSessions: Array<Session>
}
```

**Button Design:**
```jsx
<button
  onClick={onToggleActiveStatus}
  disabled={isSubmitting || selectedCount === 0}
  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
>
  <PowerIcon className="h-4 w-4 mr-2" />
  Toggle Active Status
</button>
```

#### Modified Hook: `useBulkSelection`
**Changes:** Add bulk operation state management

**Location:** `admin_root/admin_frontend/src/hooks/useBulkSelection.js`

**New State:**
```javascript
const [isSubmitting, setIsSubmitting] = useState(false);
const [operationResult, setOperationResult] = useState(null);
```

**New Methods:**
```javascript
const executeBulkToggle = useCallback(async (sessionIds) => {
  setIsSubmitting(true);
  try {
    const response = await fetch('/api/admin/mock-exams/bulk-toggle-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionIds })
    });

    const result = await response.json();
    setOperationResult(result);

    // Invalidate queries to refetch data
    queryClient.invalidateQueries(['mock-exams']);
    queryClient.invalidateQueries(['aggregates']);

    return result;
  } catch (error) {
    console.error('Bulk toggle failed:', error);
    throw error;
  } finally {
    setIsSubmitting(false);
  }
}, []);
```

#### Modified Page: `MockExamsDashboard`
**Changes:** Wire up bulk toggle functionality

**Location:** `admin_root/admin_frontend/src/pages/MockExamsDashboard.jsx`

**New State:**
```javascript
const [isBulkToggleModalOpen, setIsBulkToggleModalOpen] = useState(false);
```

**New Handlers:**
```javascript
const handleToggleActiveStatus = useCallback(() => {
  setIsBulkToggleModalOpen(true);
}, []);

const handleConfirmToggle = useCallback(async () => {
  try {
    const sessionIds = bulkSelection.selectedIds;
    const result = await bulkSelection.executeBulkToggle(sessionIds);

    // Show success/failure toast
    if (result.summary.failed === 0) {
      toast.success(`Successfully toggled status for ${result.summary.updated} sessions`);
    } else {
      toast.warning(`Toggled ${result.summary.updated} sessions. ${result.summary.failed} failed.`);
    }

    // Exit selection mode
    bulkSelection.exitToView();
    setIsBulkToggleModalOpen(false);
  } catch (error) {
    toast.error('Failed to toggle session status. Please try again.');
  }
}, [bulkSelection]);
```

### 3.2 Backend Architecture

#### New API Endpoint: `/api/admin/mock-exams/bulk-toggle-status`
**Method:** POST
**Authentication:** Required (admin only)

**Request Body:**
```json
{
  "sessionIds": ["123456", "123457", "123458"]
}
```

**Validation:**
- `sessionIds`: Required array of strings, 1-100 items, each matching `/^\d+$/`
- Maximum 100 sessions per request (HubSpot batch limit)

**Response (Success):**
```json
{
  "success": true,
  "summary": {
    "total": 15,
    "updated": 13,
    "failed": 2,
    "activated": 8,
    "deactivated": 5
  },
  "results": {
    "successful": [
      {
        "sessionId": "123456",
        "previousState": false,
        "newState": true,
        "message": "Activated"
      }
    ],
    "failed": [
      {
        "sessionId": "123458",
        "error": "Session not found",
        "code": "NOT_FOUND"
      }
    ]
  },
  "meta": {
    "timestamp": "2025-11-13T10:30:00Z",
    "processedBy": "admin@prepdoctors.com",
    "executionTime": 1234
  }
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": [...]
  }
}
```

#### Implementation Structure

**File:** `admin_root/api/admin/mock-exams/bulk-toggle-status.js`

**Pattern:** Based on `attendance.js`

**Key Functions:**

1. **Main Handler**
```javascript
module.exports = async (req, res) => {
  // 1. Verify admin authentication
  // 2. Validate request body (sessionIds array)
  // 3. Fetch current state of all sessions (batch read)
  // 4. Determine toggle action for each session
  // 5. Process updates in batches of 100
  // 6. Track successes/failures
  // 7. Invalidate caches
  // 8. Return detailed results
};
```

2. **fetchSessionsBatch(sessionIds)**
- Fetches session details from HubSpot in chunks of 100
- Returns Map of sessionId → session object
- Includes `is_active` property

3. **processStatusToggleBatch(updates)**
- Sends batch update requests to HubSpot (chunks of 100)
- Returns { successful: [], failed: [] }
- Handles partial failures gracefully

4. **invalidateSessionCaches()**
- Clears affected Redis caches:
  - `admin:mock-exams:list:*`
  - `admin:mock-exams:aggregates:*`
  - `admin:aggregate:sessions:*`
  - `admin:metrics:*`
  - Individual session caches

5. **createAuditLog(summary, adminEmail)**
- Logs bulk toggle operation to audit trail
- Non-blocking (async, doesn't fail request)

#### HubSpot Integration

**Object Type:** Mock Exams (`2-50158913`)

**Property Updated:** `is_active` (boolean)

**Batch API Endpoints:**
- **Batch Read:** `POST /crm/v3/objects/2-50158913/batch/read`
- **Batch Update:** `POST /crm/v3/objects/2-50158913/batch/update`

**Rate Limiting:**
- HubSpot allows 100 items per batch call
- Maximum 4 requests per second (burst)
- Implement exponential backoff on 429 errors

**Update Logic:**
```javascript
const updates = [];

for (const sessionId of sessionIds) {
  const session = sessionsMap.get(sessionId);

  if (!session) {
    results.failed.push({
      sessionId,
      error: 'Session not found',
      code: 'NOT_FOUND'
    });
    continue;
  }

  // Toggle is_active
  const currentState = session.properties.is_active === 'true' || session.properties.is_active === true;
  const newState = !currentState;

  updates.push({
    id: sessionId,
    properties: {
      is_active: newState
    }
  });

  // Track for summary
  if (newState) {
    summary.activated++;
  } else {
    summary.deactivated++;
  }
}

// Process updates in batches of 100
const updateResults = await processStatusToggleBatch(updates);
```

### 3.3 Validation Schema

**File:** `admin_root/api/_shared/validation.js`

**Add New Schema:**
```javascript
const bulkToggleStatusSchema = Joi.object({
  sessionIds: Joi.array()
    .items(Joi.string().pattern(/^\d+$/))
    .min(1)
    .max(100)
    .required()
    .messages({
      'array.min': 'At least one session ID is required',
      'array.max': 'Maximum 100 sessions can be toggled at once',
      'string.pattern.base': 'Invalid session ID format'
    })
}).required();

// Export in schemas object
schemas.bulkToggleStatus = bulkToggleStatusSchema;
```

### 3.4 Error Handling

**Error Codes:**

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request body |
| `UNAUTHORIZED` | 401 | Missing/invalid authentication |
| `NOT_FOUND` | 404 | One or more sessions not found |
| `BATCH_SIZE_EXCEEDED` | 400 | More than 100 sessions provided |
| `HUBSPOT_ERROR` | 500 | HubSpot API error |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `TIMEOUT` | 504 | Request took longer than 55 seconds |

**Partial Failure Handling:**
- Each session is updated independently
- Failures don't prevent other updates from succeeding
- Failed updates are tracked with session ID and error reason
- Response includes both successful and failed items

**Timeout Protection:**
```javascript
// Vercel function timeout is 60s
// Fail fast if approaching limit
if (Date.now() - startTime > 55000) {
  return res.status(504).json({
    success: false,
    error: {
      code: 'TIMEOUT',
      message: 'Request timeout. Please try with fewer sessions.'
    }
  });
}
```

### 3.5 Cache Invalidation Strategy

**Affected Caches:**
1. Mock exams list (all pages)
2. Mock exams aggregates (all filters)
3. Aggregate sessions (specific aggregates)
4. Dashboard metrics
5. Individual session details

**Implementation:**
```javascript
async function invalidateSessionCaches() {
  const cache = getCache();

  try {
    // Invalidate list caches (affects pagination)
    await cache.deletePattern('admin:mock-exams:list:*');

    // Invalidate aggregates (affects group view)
    await cache.deletePattern('admin:mock-exams:aggregates:*');
    await cache.deletePattern('admin:aggregate:sessions:*');

    // Invalidate metrics (affects dashboard stats)
    await cache.deletePattern('admin:metrics:*');

    console.log('✅ [BULK-TOGGLE] Caches invalidated');
  } catch (error) {
    console.error('❌ [BULK-TOGGLE] Cache invalidation failed:', error);
    // Don't fail request if cache invalidation fails
  }
}
```

---

## 4. User Interface Design

### 4.1 Selection Toolbar Button

**Position:** Between selection count and action buttons

**States:**
- **Default:** Blue button with power icon
- **Disabled:** Gray button (when no sessions selected or submitting)
- **Loading:** Spinner icon replacing power icon

**Styling:**
```jsx
<button
  onClick={onToggleActiveStatus}
  disabled={selectedCount === 0 || isSubmitting}
  className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors ${
    selectedCount === 0 || isSubmitting
      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
      : 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500'
  }`}
>
  {isSubmitting ? (
    <SpinnerIcon className="h-4 w-4 mr-2 animate-spin" />
  ) : (
    <PowerIcon className="h-4 w-4 mr-2" />
  )}
  Toggle Active Status
</button>
```

### 4.2 Confirmation Modal

**Size:** Medium (max-w-md)

**Layout:**
```
┌─────────────────────────────────────┐
│  Toggle Active Status           [X] │
├─────────────────────────────────────┤
│                                     │
│  You are about to toggle the       │
│  active status for 15 sessions:    │
│                                     │
│  • 8 sessions will be activated    │
│  • 7 sessions will be deactivated  │
│                                     │
│  Active sessions will become       │
│  inactive and vice versa.          │
│                                     │
│  This action cannot be undone.     │
│                                     │
├─────────────────────────────────────┤
│                  [Cancel] [Confirm] │
└─────────────────────────────────────┘
```

**Interaction:**
- ESC key closes modal
- Clicking backdrop closes modal
- Cancel button closes modal
- Confirm button triggers API call and shows loading state
- Modal stays open during API call with disabled buttons
- Modal auto-closes on success

### 4.3 Result Notifications

**Success Toast:**
```
✅ Successfully toggled status for 13 sessions
   8 activated, 5 deactivated
```

**Partial Success Toast:**
```
⚠️ Toggled 13 of 15 sessions
   2 sessions failed to update
   [View Details]
```

**Error Toast:**
```
❌ Failed to toggle session status
   Please try again or contact support
```

---

## 5. Testing Requirements

### 5.1 Unit Tests

**Frontend:**
- `BulkToggleActiveModal` component rendering
- Toggle button enable/disable logic
- Session breakdown calculations (activated vs deactivated)
- Modal open/close behaviors

**Backend:**
- Request validation (valid/invalid sessionIds)
- Batch size limits (1-100 sessions)
- Toggle logic (true→false, false→true)
- Error handling for missing sessions
- Cache invalidation calls

### 5.2 Integration Tests

**API Endpoint:**
- Toggle single session
- Toggle multiple sessions (10, 50, 100)
- Toggle mixed active/inactive sessions
- Handle partial failures gracefully
- Rate limiting compliance
- Timeout handling (>55s)

**End-to-End:**
- Select sessions in List View → Toggle → Verify UI updates
- Select sessions in Aggregate View → Toggle → Verify UI updates
- Toggle while filtering is active
- Toggle across multiple pages
- Cancel operation from modal

### 5.3 Performance Tests

**Benchmarks:**
- 10 sessions: < 2 seconds
- 50 sessions: < 5 seconds
- 100 sessions: < 10 seconds

**Load Testing:**
- 5 concurrent bulk toggles
- Verify no rate limit errors (429)
- Verify cache invalidation doesn't cause performance issues

---

## 6. Security Considerations

### 6.1 Authorization
- Only authenticated admin users can toggle session status
- Session ownership verification (sessions must exist in HubSpot)
- Rate limiting to prevent abuse

### 6.2 Input Validation
- Joi schema validation on all inputs
- Session ID format validation (numeric strings only)
- Batch size limits (max 100)
- SQL injection prevention (parameterized queries)

### 6.3 Audit Trail
- Log all bulk toggle operations
- Include: timestamp, admin email, session IDs, results
- Store in audit log for compliance

---

## 7. Rollout Plan

### Phase 1: Backend Implementation (Day 1)
- [ ] Create validation schema
- [ ] Implement API endpoint
- [ ] Add batch processing logic
- [ ] Add cache invalidation
- [ ] Write unit tests
- [ ] Manual API testing

### Phase 2: Frontend Implementation (Day 2)
- [ ] Create `BulkToggleActiveModal` component
- [ ] Update `MockExamsSelectionToolbar` with toggle button
- [ ] Wire up API calls in `useBulkSelection`
- [ ] Integrate in `MockExamsDashboard`
- [ ] Add toast notifications
- [ ] Write component tests

### Phase 3: Integration Testing (Day 3)
- [ ] End-to-end testing (List View)
- [ ] End-to-end testing (Aggregate View)
- [ ] Performance testing (10, 50, 100 sessions)
- [ ] Error scenario testing
- [ ] UAT with admin users

### Phase 4: Production Deployment (Day 4)
- [ ] Deploy backend to staging
- [ ] Deploy frontend to staging
- [ ] Smoke testing on staging
- [ ] Deploy to production
- [ ] Monitor logs for errors
- [ ] Gather user feedback

---

## 8. Success Criteria

### Must Have (MVP)
- ✅ Admins can select multiple sessions and toggle active status
- ✅ Confirmation modal prevents accidental bulk changes
- ✅ Each session is toggled individually (active→inactive, inactive→active)
- ✅ Batch API calls respect HubSpot rate limits
- ✅ Partial failures are handled gracefully
- ✅ Cache invalidation ensures UI reflects changes

### Should Have (Phase 2)
- ⭕ View details link in partial failure toast
- ⭕ Audit log viewer for admins
- ⭕ Retry failed sessions individually
- ⭕ Export operation results to CSV

### Could Have (Future)
- ⭕ Bulk edit other properties (location, capacity, etc.)
- ⭕ Schedule bulk status changes (activate on future date)
- ⭕ Undo bulk operation within 5 minutes
- ⭕ Email notification to admins on completion

---

## 9. Dependencies

### External Dependencies
- HubSpot CRM API (batch read/update endpoints)
- Redis cache (for cache invalidation)
- React Query (for query invalidation)

### Internal Dependencies
- Bulk selection infrastructure (already implemented)
- Mock exams list/aggregate endpoints
- Admin authentication middleware

---

## 10. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| HubSpot rate limiting | Medium | High | Implement exponential backoff, limit batch size to 100 |
| Vercel timeout (60s) | Low | High | Process in batches, fail fast at 55s |
| Partial failures confuse users | Medium | Medium | Clear UI feedback with success/failure breakdown |
| Cache invalidation delays | Low | Low | Non-blocking cache invalidation, accept eventual consistency |
| Accidental bulk toggles | Medium | Medium | Confirmation modal with clear breakdown |

---

## 11. Open Questions

1. **Q:** Should we prevent toggling sessions that have bookings?
   **A:** No - active status is independent of bookings. Admins may need to deactivate sessions even with bookings.

2. **Q:** Should we add an "undo" feature?
   **A:** Not in MVP. Consider for Phase 2 if requested by users.

3. **Q:** Should we limit toggle operations based on session date (e.g., can't toggle past sessions)?
   **A:** No - admins may need to update historical data for reporting purposes.

4. **Q:** Should we send email notifications after bulk operations?
   **A:** Not in MVP. Consider for Phase 2 if managing >100 sessions at once becomes common.

---

## 12. Appendix

### A. Code Reuse from Mark Attendance Feature

**Functions to Reuse:**
1. `fetchBookingsBatch()` → Adapt as `fetchSessionsBatch()`
2. `processAttendanceUpdates()` → Adapt as `processStatusToggleBatch()`
3. `invalidateAttendanceCaches()` → Adapt as `invalidateSessionCaches()`
4. `createAuditLog()` → Reuse directly

**Validation Patterns:**
- Request body validation with Joi
- Batch size limits (100)
- Error response formats
- Partial failure tracking

### B. Related Documentation
- [Bulk Selection Toolbar PRD](./bulk-selection-toolbar.md)
- [HubSpot API Documentation](../../documentation/HUBSPOT_SCHEMA_DOCUMENTATION.md)
- [Cache Strategy](../../documentation/api/REDIS_CACHE.md)

---

**Document Status:** Ready for Review
**Next Steps:** Review with team → Approve → Begin Phase 1 Implementation
**Estimated Timeline:** 4 days (backend + frontend + testing + deployment)
