# Product Requirements Document (PRD)
# Mass Delete Mock Exam Sessions

**Version:** 1.0  
**Created:** 2025-01-14  
**Status:** Ready for Implementation  
**Confidence Score:** 8/10

---

## Executive Summary

This PRD outlines the implementation of a mass delete feature for mock exam sessions in the PrepDoctors admin dashboard. Building on the existing bulk toggle active status functionality, this feature enables administrators to efficiently delete multiple mock exam sessions at once with appropriate safeguards and confirmation mechanisms.

**Key Features:**
- Batch deletion of up to 100 mock exam sessions
- Numeric confirmation to prevent accidental deletion
- HubSpot batch archive API integration
- Comprehensive error handling and partial failure support
- Cache invalidation and audit trail logging

**Implementation Time:** 2-3 days (1 developer)

---

## Problem Statement

### Current State
Currently, administrators can only delete mock exam sessions one at a time through the individual session detail page (MockExamDetail). This process is:
- Time-consuming when managing multiple sessions
- Inefficient for bulk cleanup operations
- Lacks a centralized interface for mass operations

### User Pain Points
1. **Time-Intensive:** Deleting 10+ sessions requires navigating to each detail page individually
2. **Error-Prone:** Manual repetition increases risk of accidentally deleting wrong sessions
3. **No Bulk Operations:** Unlike the bulk toggle active status feature, no mass delete option exists
4. **Workflow Disruption:** Forces admins to leave the main dashboard view repeatedly

### Business Impact
- Administrative overhead for session management
- Reduced operational efficiency during exam scheduling cleanup
- Increased frustration with admin tooling


---

## Goals & Success Metrics

### Primary Goals
1. **Efficiency:** Enable admins to delete multiple mock exam sessions in a single operation
2. **Safety:** Prevent accidental bulk deletions through robust confirmation mechanisms
3. **Transparency:** Provide clear feedback on deletion success/failure for each session
4. **Data Integrity:** Protect sessions with active bookings from accidental deletion
5. **Performance:** Complete bulk deletions within Vercel's 60-second timeout limit

### Success Metrics
- **Time Savings:** Reduce time to delete 10 sessions from ~5 minutes to <30 seconds
- **Error Rate:** <2% unintended deletions through confirmation safeguards
- **Completion Rate:** >95% of bulk delete operations complete successfully
- **User Satisfaction:** Admins rate the feature as "very helpful" or "helpful" (>4/5 stars)
- **Performance:** Deletion of 100 sessions completes in <15 seconds

### User Satisfaction Criteria
- Confirmation modal clearly shows what will be deleted
- Numeric input prevents accidental clicks
- Sessions with bookings are protected from deletion
- Clear error messages for sessions that cannot be deleted
- Detailed success/failure breakdown after operation

---

## User Stories

### US-1: Initiate Mass Delete from Dashboard
**As an** admin user  
**I want to** select multiple mock exam sessions and delete them via a toolbar button  
**So that** I can efficiently clean up obsolete or incorrectly created sessions

**Acceptance Criteria:**
- Selection toolbar displays "Delete Selected" button when 1+ sessions selected
- Button shows trash icon and "Delete Selected" text
- Button is disabled while any bulk operation is in progress
- Clicking button opens confirmation modal
- Button color indicates destructive action (red theme)

### US-2: Numeric Confirmation Modal
**As an** admin user  
**I want to** confirm deletion by entering the number of sessions to delete  
**So that** I avoid accidental bulk deletions through a simple "OK" click

**Acceptance Criteria:**
- Modal displays:
  - Total number of sessions to be deleted
  - Session breakdown (with bookings, without bookings, total)
  - Input field requiring user to type the exact number
  - Warning about permanent deletion
  - "Delete" and "Cancel" buttons
- Delete button is disabled until correct number is entered
- Modal shows list of sessions (exam type, date, location) - up to 10, then "...and X more"
- Modal can be closed with ESC key or Cancel button
- Clicking outside modal closes it (acts as Cancel)

### US-3: Booking Protection Logic
**As an** admin user  
**I want to** be prevented from deleting sessions with active bookings  
**So that** I don't accidentally remove sessions that students are enrolled in

**Acceptance Criteria:**
- Backend checks each session for active/completed bookings
- Sessions with active or completed bookings are excluded from deletion
- Modal shows breakdown: "X sessions can be deleted, Y have bookings (will be skipped)"
- Sessions with only cancelled bookings can be deleted
- User sees which specific sessions have bookings in the modal

### US-4: Detailed Result Feedback
**As an** admin user  
**I want to** see comprehensive results after deletion completes  
**So that** I know which sessions were deleted and which failed

**Acceptance Criteria:**
- Success toast shows: "Successfully deleted X of Y sessions"
- Partial success toast shows: "Deleted X sessions. Y failed (Z had bookings)"
- Error toast shows specific failure reasons
- Table refreshes automatically to remove deleted sessions
- Selection mode exits after operation completes
- Cache is invalidated to ensure fresh data

### US-5: Graceful Failure Handling
**As an** admin user
**I want to** have partial successes handled gracefully
**So that** deletable sessions are removed even if some cannot be deleted

**Acceptance Criteria:**
- Each session is deleted independently
- Failures don't prevent other deletions from succeeding
- Each failure is tracked with session ID and reason
- User receives detailed breakdown of successes vs failures
- Deleted sessions are removed from UI immediately

---

## Functional Requirements

### FR-1: Delete Sessions Button in Selection Toolbar

**Location:** `MockExamsSelectionToolbar.jsx` - Right side action buttons area

**Placement:**
- Position: Between "Toggle Active Status" button and "Exit Selection Mode" button (X icon)
- Visibility: Only shown when `selectedCount > 0`
- Disabled state: When `isSubmitting === true` or during any bulk operation

**Button Design:**
```jsx
<button
  onClick={onDeleteSessions}
  disabled={isSubmitting || selectedCount === 0}
  className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-md border-2 transition-colors ${
    isSubmitting
      ? 'bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500 dark:border-gray-500'
      : 'text-white bg-red-600 border-red-600 hover:bg-red-700 hover:border-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:bg-red-700 dark:border-red-700 dark:hover:bg-red-800 dark:hover:border-red-800'
  }`}
  aria-label="Delete selected sessions"
>
  {isSubmitting ? (
    <svg className="animate-spin -ml-1 mr-2 h-4 w-4" ... />
  ) : (
    <TrashIcon className="h-4 w-4 mr-2" />
  )}
  Delete Selected
</button>
```

**Props Required:**
- `onDeleteSessions`: Callback function to open deletion modal
- `isSubmitting`: Boolean indicating if any bulk operation is in progress

**Behavior:**
- Click triggers `MassDeleteModal` to open
- Button remains disabled during all bulk operations (toggle status, delete)
- Red color scheme indicates destructive action

---

### FR-2: Confirmation Modal with Numeric Input

**Component:** `MassDeleteModal.jsx` (New)

**Modal Structure:**
```jsx
<Dialog.Panel>
  {/* Header Section */}
  <div className="flex items-start">
    {/* Warning Icon - Red theme */}
    <div className="bg-red-100 dark:bg-red-900">
      <TrashIcon className="h-6 w-6 text-red-600" />
    </div>

    {/* Title & Description */}
    <Dialog.Title>Delete Mock Exam Sessions</Dialog.Title>
  </div>

  {/* Session Breakdown */}
  <div className="session-breakdown">
    <p>Total: {totalCount} sessions selected</p>
    <div className="breakdown-details">
      <span className="text-green-600">✓ {deletableCount} can be deleted</span>
      <span className="text-amber-600">⚠ {withBookingsCount} have bookings (will be skipped)</span>
    </div>
  </div>

  {/* Session Preview List (up to 10) */}
  <div className="session-list max-h-48 overflow-y-auto">
    {sessionsToShow.map(session => (
      <div key={session.id} className="session-item">
        <span>{session.mock_type}</span>
        <span>{formatDate(session.exam_date)}</span>
        <span>{session.location}</span>
        {session.hasBookings && <Badge variant="warning">Has Bookings</Badge>}
      </div>
    ))}
    {remainingCount > 0 && (
      <p className="text-gray-500">...and {remainingCount} more</p>
    )}
  </div>

  {/* Numeric Confirmation Input */}
  <div className="confirmation-input">
    <label>
      Type <strong>{deletableCount}</strong> to confirm deletion:
    </label>
    <input
      type="number"
      value={confirmNumber}
      onChange={(e) => setConfirmNumber(e.target.value)}
      className="border rounded px-3 py-2"
      placeholder={`Enter ${deletableCount}`}
      autoFocus
    />
    {/* Real-time validation feedback */}
    {confirmNumber && parseInt(confirmNumber) !== deletableCount && (
      <p className="text-red-600 text-sm mt-1">
        Number must match exactly
      </p>
    )}
  </div>

  {/* Warning Message */}
  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 rounded p-3">
    <p className="text-sm text-red-800 dark:text-red-300">
      ⚠️ This action is permanent and cannot be undone. Sessions with active
      or completed bookings will be automatically skipped.
    </p>
  </div>

  {/* Action Buttons */}
  <div className="flex space-x-3">
    <button
      onClick={handleConfirmDelete}
      disabled={parseInt(confirmNumber) !== deletableCount || isDeleting}
      className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400"
    >
      {isDeleting ? 'Deleting...' : `Delete ${deletableCount} Sessions`}
    </button>
    <button onClick={onClose} disabled={isDeleting}>
      Cancel
    </button>
  </div>
</Dialog.Panel>
```

**Modal State Management:**
```javascript
const [isOpen, setIsOpen] = useState(false);
const [confirmNumber, setConfirmNumber] = useState('');
const [isDeleting, setIsDeleting] = useState(false);

// Breakdown calculation
const { deletableCount, withBookingsCount } = useMemo(() => {
  // Filter sessions by booking status
  const withBookings = selectedSessions.filter(s =>
    s.total_bookings > 0 && hasActiveOrCompletedBookings(s)
  );
  return {
    deletableCount: selectedSessions.length - withBookings.length,
    withBookingsCount: withBookings.length
  };
}, [selectedSessions]);

// Validation
const isValid = parseInt(confirmNumber) === deletableCount;
```

**Accessibility Features:**
- ESC key closes modal (when not deleting)
- Auto-focus on numeric input field
- Screen reader announcements for validation errors
- Keyboard navigation support

---

### FR-3: Booking Protection Logic

**Backend Validation:** `/api/admin/mock-exams/batch-delete.js`

**Protection Rules:**
1. **Active Bookings** - Sessions with `is_active === 'Active'` bookings cannot be deleted
2. **Completed Bookings** - Sessions with `is_active === 'Completed'` bookings cannot be deleted
3. **Cancelled Bookings OK** - Sessions with only `is_active === 'Cancelled'` bookings CAN be deleted
4. **No Bookings** - Sessions with zero bookings always deletable

**Implementation:**
```javascript
// Fetch session with associated bookings
const sessionDetails = await hubspot.getMockExamWithBookings(sessionId);

// Filter for active/completed bookings only
const activeOrCompletedBookings = sessionDetails.bookings.filter(booking => {
  const status = booking.properties.is_active;
  return status === 'Active' || status === 'Completed';
});

// Determine if session is deletable
const isDeletable = activeOrCompletedBookings.length === 0;

// Build result object
if (!isDeletable) {
  return {
    sessionId,
    success: false,
    error: 'HAS_BOOKINGS',
    message: `Session has ${activeOrCompletedBookings.length} active/completed booking(s)`,
    bookingCount: activeOrCompletedBookings.length,
    totalBookings: sessionDetails.bookings.length,
    cancelledBookings: sessionDetails.bookings.length - activeOrCompletedBookings.length
  };
}
```

**Frontend Display:**
```javascript
// Show breakdown in modal
const sessionWithBookingStatus = selectedSessions.map(session => ({
  ...session,
  hasActiveBookings: session.total_bookings > 0 && /* check via API */,
  isDeletable: /* calculated based on booking status */
}));

// Display in modal
<div className="session-item">
  <span>{session.mock_type}</span>
  {session.hasActiveBookings && (
    <Badge variant="warning" className="ml-2">
      {session.total_bookings} booking{session.total_bookings > 1 ? 's' : ''}
    </Badge>
  )}
</div>
```

**Edge Cases:**
- Session not found → Skip with error message
- API timeout during booking check → Mark as failed, don't delete
- Partial booking data → Err on side of caution, don't delete

---

### FR-4: Batch Delete Operation

**HubSpot API Integration:**

**Endpoint:** `POST /crm/v3/objects/2-50158913/batch/archive`

**Request Structure:**
```javascript
{
  inputs: [
    { id: "123456" },
    { id: "123457" },
    { id: "123458" }
    // ... up to 100 per batch
  ]
}
```

**Batch Processing Logic:**
```javascript
// Split into chunks of 100 (HubSpot limit)
const HUBSPOT_BATCH_SIZE = 100;

async function batchDeleteSessions(sessionIds) {
  const results = {
    successful: [],
    failed: []
  };

  // Process in chunks
  for (let i = 0; i < sessionIds.length; i += HUBSPOT_BATCH_SIZE) {
    const chunk = sessionIds.slice(i, i + HUBSPOT_BATCH_SIZE);

    try {
      const response = await hubspot.apiCall(
        'POST',
        `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/batch/archive`,
        { inputs: chunk.map(id => ({ id })) }
      );

      // Process successful deletions
      if (response.results) {
        results.successful.push(...response.results);
      }

      // Process partial failures
      if (response.errors) {
        response.errors.forEach(error => {
          results.failed.push({
            sessionId: error.context?.id || 'unknown',
            error: 'HUBSPOT_ERROR',
            message: error.message
          });
        });
      }
    } catch (error) {
      // Entire batch failed
      chunk.forEach(sessionId => {
        results.failed.push({
          sessionId,
          error: 'BATCH_FAILED',
          message: error.message || 'Batch delete operation failed'
        });
      });
    }
  }

  return results;
}
```

**Sequential vs Parallel Processing:**
- Use **sequential** processing for booking validation (must check before delete)
- Use **parallel batch** processing for actual deletion (HubSpot handles atomicity)
- Maximum 100 sessions per HubSpot batch call
- No overall limit, but recommend UI limit of 100 for UX reasons

**Performance Targets:**
- 10 sessions: < 2 seconds
- 50 sessions: < 8 seconds
- 100 sessions: < 15 seconds
- Vercel timeout: 60 seconds (must complete within 55 seconds)

---

### FR-5: Success/Error Feedback

**Toast Notification System:**

**Success (All Deleted):**
```javascript
toast.success({
  title: 'Sessions Deleted Successfully',
  description: `Successfully deleted ${deletedCount} session${deletedCount > 1 ? 's' : ''}`,
  duration: 5000
});
```

**Partial Success:**
```javascript
toast.warning({
  title: 'Partial Deletion Complete',
  description: `Deleted ${successCount} sessions. ${failedCount} failed (${withBookingsCount} had bookings, ${errorCount} errors)`,
  duration: 8000,
  action: {
    label: 'View Details',
    onClick: () => showDetailedResults(results)
  }
});
```

**Complete Failure:**
```javascript
toast.error({
  title: 'Deletion Failed',
  description: errorMessage || 'Failed to delete sessions. Please try again.',
  duration: 10000
});
```

**Detailed Results Modal (Optional Enhancement):**
```jsx
<Dialog title="Deletion Results">
  <div className="results-summary">
    <div className="success">
      <CheckCircleIcon className="text-green-600" />
      <span>{successCount} Deleted Successfully</span>
    </div>
    <div className="failed">
      <XCircleIcon className="text-red-600" />
      <span>{failedCount} Failed</span>
    </div>
  </div>

  {/* Failed Sessions List */}
  <div className="failed-sessions">
    <h4>Failed Deletions:</h4>
    {failedSessions.map(session => (
      <div key={session.id} className="failed-item">
        <span>{session.mock_type} - {session.exam_date}</span>
        <span className="error-reason">{session.errorMessage}</span>
      </div>
    ))}
  </div>
</Dialog>
```

**UI Updates After Deletion:**
```javascript
// 1. Close modal
setIsModalOpen(false);

// 2. Clear selection
clearSelectedSessions();

// 3. Invalidate cache and refetch
queryClient.invalidateQueries(['admin:mock-exams:list']);

// 4. Exit selection mode
setSelectionMode(false);

// 5. Show toast notification
showToast(results);

// 6. Update URL (remove selection params)
navigate('/admin/mock-exams', { replace: true });
```

---

### FR-6: Edge Cases & Constraints

**Edge Case 1: Zero Deletable Sessions**
```javascript
// Scenario: All selected sessions have active bookings
if (deletableCount === 0) {
  return (
    <Dialog>
      <p className="text-amber-600">
        None of the selected sessions can be deleted because they all have
        active or completed bookings.
      </p>
      <button onClick={onClose}>Close</button>
    </Dialog>
  );
}
```

**Edge Case 2: Session Deleted Between Selection and Confirmation**
```javascript
// Backend validation before delete
const session = await hubspot.getMockExam(sessionId);
if (!session) {
  return {
    sessionId,
    success: false,
    error: 'NOT_FOUND',
    message: 'Session no longer exists'
  };
}
```

**Edge Case 3: Concurrent Booking Creation**
```javascript
// Race condition: Booking created between validation and delete
// Solution: Re-validate immediately before deletion
const latestDetails = await hubspot.getMockExamWithBookings(sessionId);
const hasNewBookings = checkActiveBookings(latestDetails);

if (hasNewBookings) {
  return {
    sessionId,
    success: false,
    error: 'BOOKING_ADDED',
    message: 'New booking was added during deletion process'
  };
}
```

**Edge Case 4: Timeout Approaching**
```javascript
// Monitor execution time
const startTime = Date.now();
const TIMEOUT_THRESHOLD = 55000; // 55 seconds (Vercel limit is 60s)

if (Date.now() - startTime > TIMEOUT_THRESHOLD) {
  // Stop processing remaining sessions
  return {
    success: false,
    error: 'TIMEOUT',
    message: 'Operation timeout. Please try with fewer sessions.',
    processed: results.successful.length + results.failed.length,
    remaining: sessionIds.length - (results.successful.length + results.failed.length)
  };
}
```

**Edge Case 5: Maximum Batch Size Exceeded**
```javascript
// Validation schema
const MAX_SESSIONS_PER_REQUEST = 100;

if (sessionIds.length > MAX_SESSIONS_PER_REQUEST) {
  return res.status(400).json({
    success: false,
    error: {
      code: 'BATCH_SIZE_EXCEEDED',
      message: `Maximum ${MAX_SESSIONS_PER_REQUEST} sessions can be deleted per request`,
      provided: sessionIds.length,
      maximum: MAX_SESSIONS_PER_REQUEST
    }
  });
}
```

**Constraint Summary:**
- **Max Sessions per Request:** 100
- **HubSpot Batch Size:** 100 per API call
- **Vercel Timeout:** 60 seconds (target: 55s)
- **Retry Logic:** None (one-shot operation, user can retry manually)
- **Transaction Support:** None (partial deletions are acceptable)

---

## Technical Requirements

### Files to Create

#### 1. **Backend API Endpoint**
**Path:** `admin_root/api/admin/mock-exams/batch-delete.js`

**Purpose:** Handle bulk deletion of mock exam sessions with booking protection

**Dependencies:**
- `requireAdmin` middleware (authentication)
- `validationMiddleware` (input validation)
- `hubspot` client (HubSpot API calls)
- `cache` service (cache invalidation)

**Exports:**
```javascript
module.exports = async (req, res) => {
  // POST handler for batch delete
};
```

**Key Functions:**
```javascript
async function validateSessionsForDeletion(sessionIds)
async function batchArchiveSessions(sessionIds)
async function invalidateSessionCaches()
async function createAuditLog(summary, adminEmail, sessionIds)
```

---

#### 2. **Frontend Modal Component**
**Path:** `admin_root/admin_frontend/src/components/admin/MassDeleteModal.jsx`

**Purpose:** Confirmation modal with numeric input and session preview

**Props Interface:**
```typescript
interface MassDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  selectedSessions: MockExamSession[];
  isDeleting: boolean;
}
```

**Key Features:**
- Numeric confirmation input
- Session breakdown display
- Real-time validation feedback
- Loading states
- Error display

**Dependencies:**
- `@headlessui/react` (Dialog, Transition)
- `@heroicons/react/24/outline` (TrashIcon, XMarkIcon)
- `date-fns` (date formatting)

---

#### 3. **Custom React Hook**
**Path:** `admin_root/admin_frontend/src/hooks/useMassDelete.js`

**Purpose:** Encapsulate mass delete logic and state management

**Hook Interface:**
```javascript
function useMassDelete() {
  return {
    deleteSessions: (sessionIds) => Promise<DeleteResults>,
    isDeleting: boolean,
    error: Error | null,
    results: DeleteResults | null
  };
}
```

**Implementation:**
```javascript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from '../lib/toast';

export function useMassDelete() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (sessionIds) => {
      const response = await api.post('/api/admin/mock-exams/batch-delete', {
        sessionIds
      });
      return response.data;
    },
    onSuccess: (data) => {
      // Invalidate queries
      queryClient.invalidateQueries(['admin:mock-exams:list']);
      queryClient.invalidateQueries(['admin:mock-exams:aggregates']);

      // Show toast notification
      if (data.summary.failed === 0) {
        toast.success(`Successfully deleted ${data.summary.deleted} sessions`);
      } else {
        toast.warning(
          `Deleted ${data.summary.deleted} sessions. ` +
          `${data.summary.failed} failed (${data.summary.skippedBookings} had bookings)`
        );
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete sessions');
    }
  });

  return {
    deleteSessions: mutation.mutate,
    isDeleting: mutation.isPending,
    error: mutation.error,
    results: mutation.data
  };
}
```

---

### Files to Modify

#### 1. **MockExamsSelectionToolbar.jsx**
**Path:** `admin_root/admin_frontend/src/components/admin/MockExamsSelectionToolbar.jsx`

**Changes Required:**

**Add Delete Button Import:**
```javascript
import { XMarkIcon, PowerIcon, TrashIcon } from '@heroicons/react/24/outline';
```

**Add onDeleteSessions Prop:**
```javascript
const MockExamsSelectionToolbar = ({
  selectedCount,
  totalCount,
  onClearAll,
  onExitMode,
  onToggleActiveStatus,
  onDeleteSessions, // NEW PROP
  selectedSessions,
  isSubmitting
}) => {
```

**Add Delete Button (after Toggle Active Status button, before Exit button):**
```jsx
{/* Right side - Action buttons */}
<div className="flex items-center space-x-2">
  {/* Toggle Active Status Button */}
  {selectedCount > 0 && (
    <button
      onClick={onToggleActiveStatus}
      disabled={isSubmitting}
      className={...}
    >
      <PowerIcon className="h-4 w-4 mr-2" />
      Toggle Active Status
    </button>
  )}

  {/* DELETE SESSIONS BUTTON - NEW */}
  {selectedCount > 0 && (
    <button
      onClick={onDeleteSessions}
      disabled={isSubmitting}
      className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-md border-2 transition-colors ${
        isSubmitting
          ? 'bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500 dark:border-gray-500'
          : 'text-white bg-red-600 border-red-600 hover:bg-red-700 hover:border-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:bg-red-700 dark:border-red-700 dark:hover:bg-red-800'
      }`}
      aria-label="Delete selected sessions"
    >
      {isSubmitting ? (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" ... />
      ) : (
        <TrashIcon className="h-4 w-4 mr-2" />
      )}
      Delete Selected
    </button>
  )}

  {/* Exit selection mode button */}
  <div className="group relative">
    ...
  </div>
</div>
```

---

#### 2. **MockExamsDashboard.jsx**
**Path:** `admin_root/admin_frontend/src/pages/MockExamsDashboard.jsx`

**Changes Required:**

**Add Modal State:**
```javascript
const [showMassDeleteModal, setShowMassDeleteModal] = useState(false);
```

**Add useMassDelete Hook:**
```javascript
import { useMassDelete } from '../hooks/useMassDelete';

// Inside component
const { deleteSessions, isDeleting } = useMassDelete();
```

**Add Handler Functions:**
```javascript
// Open mass delete modal
const handleDeleteSessionsClick = () => {
  setShowMassDeleteModal(true);
};

// Confirm mass deletion
const handleConfirmMassDelete = async () => {
  const sessionIds = selectedSessions.map(s => s.id);

  await deleteSessions(sessionIds, {
    onSuccess: () => {
      setShowMassDeleteModal(false);
      setSelectedSessions([]);
      setSelectionMode(false);
    }
  });
};
```

**Update Toolbar Props:**
```jsx
<MockExamsSelectionToolbar
  selectedCount={selectedSessions.length}
  totalCount={sessions.length}
  onClearAll={handleClearSelection}
  onExitMode={handleExitSelectionMode}
  onToggleActiveStatus={handleToggleActiveClick}
  onDeleteSessions={handleDeleteSessionsClick} // NEW PROP
  selectedSessions={selectedSessions}
  isSubmitting={isBulkToggling || isDeleting} // Include isDeleting
/>
```

**Add Modal Component:**
```jsx
{/* Mass Delete Modal */}
<MassDeleteModal
  isOpen={showMassDeleteModal}
  onClose={() => !isDeleting && setShowMassDeleteModal(false)}
  onConfirm={handleConfirmMassDelete}
  selectedSessions={selectedSessions}
  isDeleting={isDeleting}
/>
```

---

#### 3. **validation.js**
**Path:** `admin_root/api/_shared/validation.js`

**Changes Required:**

**Add Validation Schema:**
```javascript
// Schema for batch delete (Admin)
batchDelete: Joi.object({
  sessionIds: Joi.array()
    .items(Joi.string().pattern(/^\d+$/))
    .min(1)
    .max(100)
    .required()
    .messages({
      'array.min': 'At least one session ID is required',
      'array.max': 'Maximum 100 sessions can be deleted at once',
      'string.pattern.base': 'Invalid session ID format',
      'any.required': 'Session IDs are required'
    })
}),
```

**Location:** Add after `batchBookingCancellation` schema (around line 786)

---

## Backend API Specifications

### Endpoint Details

**URL:** `POST /api/admin/mock-exams/batch-delete`

**Authentication:** Required (admin only via `requireAdmin` middleware)

**Rate Limiting:** Standard API rate limits apply (100 requests per 10 seconds to HubSpot)

---

### Request Specification

**Content-Type:** `application/json`

**Request Body:**
```json
{
  "sessionIds": [
    "50158913001",
    "50158913002",
    "50158913003"
  ]
}
```

**Field Validation:**
- `sessionIds`: Array of strings
  - Min length: 1
  - Max length: 100
  - Pattern: Numeric strings only (`/^\d+$/`)
  - Required: Yes

---

### Response Specification

**Success Response (200 OK):**
```json
{
  "success": true,
  "summary": {
    "total": 10,
    "deleted": 8,
    "failed": 2,
    "skippedBookings": 1,
    "errors": 1
  },
  "results": {
    "successful": [
      {
        "sessionId": "50158913001",
        "message": "Deleted successfully"
      },
      {
        "sessionId": "50158913002",
        "message": "Deleted successfully"
      }
    ],
    "failed": [
      {
        "sessionId": "50158913003",
        "error": "HAS_BOOKINGS",
        "message": "Session has 3 active/completed booking(s)",
        "bookingCount": 3,
        "totalBookings": 5,
        "cancelledBookings": 2
      },
      {
        "sessionId": "50158913004",
        "error": "NOT_FOUND",
        "message": "Session not found"
      }
    ]
  },
  "meta": {
    "timestamp": "2025-01-14T10:30:00.000Z",
    "processedBy": "admin@prepdoctors.com",
    "executionTime": 3542
  }
}
```

**Error Response (400 Bad Request):**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": [
      "Session IDs are required",
      "Maximum 100 sessions can be deleted at once"
    ]
  }
}
```

**Error Response (401 Unauthorized):**
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

**Error Response (504 Gateway Timeout):**
```json
{
  "success": false,
  "error": {
    "code": "TIMEOUT",
    "message": "Request timeout. Please try with fewer sessions.",
    "processed": 45,
    "remaining": 55
  }
}
```

---

### Error Codes

| Code | HTTP Status | Description | User Action |
|------|-------------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request format or parameters | Check input and retry |
| `BATCH_SIZE_EXCEEDED` | 400 | More than 100 sessions in request | Reduce selection and retry |
| `UNAUTHORIZED` | 401 | Missing or invalid authentication | Re-login |
| `NOT_FOUND` | 404 (per session) | Session doesn't exist in HubSpot | Session already deleted |
| `HAS_BOOKINGS` | 409 (per session) | Session has active/completed bookings | Cancel bookings first |
| `HUBSPOT_ERROR` | 500 | HubSpot API error | Retry later |
| `BATCH_FAILED` | 500 | Entire batch operation failed | Retry with smaller batch |
| `TIMEOUT` | 504 | Operation exceeded time limit | Reduce selection size |

---

### HubSpot API Sequence

**Step 1: Fetch Session Details with Bookings**
```javascript
// For each session, get details including associated bookings
GET /crm/v3/objects/2-50158913/{sessionId}
  ?associations=bookings
  &properties=mock_type,exam_date,location,capacity,total_bookings,is_active

// Or use batch read for efficiency
POST /crm/v3/objects/2-50158913/batch/read
{
  "properties": ["mock_type", "exam_date", "location", "total_bookings"],
  "inputs": [
    { "id": "50158913001" },
    { "id": "50158913002" }
  ]
}
```

**Step 2: Get Associated Bookings**
```javascript
// Fetch bookings associated with the session
GET /crm/v4/objects/2-50158913/{sessionId}/associations/2-50158943
  ?limit=500

// Then get booking details to check is_active status
POST /crm/v3/objects/2-50158943/batch/read
{
  "properties": ["is_active", "student_id", "email"],
  "inputs": [/* booking IDs */]
}
```

**Step 3: Validate Deletability**
```javascript
// Check each session's bookings
const activeOrCompleted = bookings.filter(b =>
  b.properties.is_active === 'Active' ||
  b.properties.is_active === 'Completed'
);

const isDeletable = activeOrCompleted.length === 0;
```

**Step 4: Batch Archive (Delete)**
```javascript
POST /crm/v3/objects/2-50158913/batch/archive
{
  "inputs": [
    { "id": "50158913001" },
    { "id": "50158913002" },
    { "id": "50158913005" }
    // Only deletable sessions
  ]
}
```

**Step 5: Cache Invalidation**
```javascript
// Invalidate all affected caches
await cache.deletePattern('admin:mock-exams:list:*');
await cache.deletePattern('admin:mock-exams:aggregates:*');
await cache.deletePattern('admin:aggregate:sessions:*');
await cache.deletePattern('admin:metrics:*');

// Invalidate individual session caches
deletedSessionIds.forEach(async (id) => {
  await cache.delete(`admin:mock-exam:${id}`);
  await cache.delete(`admin:mock-exam:details:${id}`);
});
```

---

## Security & Validation

### Authentication & Authorization

**Middleware:** `requireAdmin`

**Implementation:**
```javascript
const { requireAdmin } = require('../middleware/requireAdmin');

module.exports = async (req, res) => {
  try {
    // Verify admin authentication
    const user = await requireAdmin(req);
    const adminEmail = user?.email || 'admin@prepdoctors.com';

    // Continue with deletion logic...
  } catch (error) {
    if (error.message.includes('authorization') || error.message.includes('token')) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: error.message }
      });
    }
    // Handle other errors...
  }
};
```

**Authentication Flow:**
1. Extract JWT token from `Authorization` header
2. Verify token with Supabase
3. Check if user has admin privileges
4. Reject if authentication fails

**Security Headers:**
```javascript
// Required headers in request
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

---

### Input Validation

**Joi Schema:** `batchDelete` (defined in validation.js)

**Validation Rules:**
```javascript
{
  sessionIds: Joi.array()
    .items(Joi.string().pattern(/^\d+$/))  // Numeric strings only
    .min(1)                                 // At least 1 session
    .max(100)                               // Max 100 sessions
    .required()                             // Cannot be null/undefined
    .messages({
      'array.min': 'At least one session ID is required',
      'array.max': 'Maximum 100 sessions can be deleted at once',
      'string.pattern.base': 'Invalid session ID format',
      'any.required': 'Session IDs are required'
    })
}
```

**Middleware Usage:**
```javascript
const validator = validationMiddleware('batchDelete');
await new Promise((resolve, reject) => {
  validator(req, res, (error) => {
    if (error) reject(error);
    else resolve();
  });
});

const { sessionIds } = req.validatedData;
```

**Additional Runtime Validation:**
```javascript
// Check for duplicates
const uniqueIds = [...new Set(sessionIds)];
if (uniqueIds.length !== sessionIds.length) {
  console.warn('Duplicate session IDs detected, deduplicating...');
}

// Verify session IDs are valid HubSpot record IDs
const invalidIds = sessionIds.filter(id => !id.match(/^\d+$/));
if (invalidIds.length > 0) {
  return res.status(400).json({
    success: false,
    error: {
      code: 'INVALID_SESSION_IDS',
      message: 'Some session IDs are invalid',
      invalidIds
    }
  });
}
```

---

### Booking Count Verification

**Purpose:** Prevent accidental deletion of sessions with active enrollments

**Verification Process:**
```javascript
async function verifySessionDeletability(sessionId) {
  try {
    // Fetch session with associated bookings
    const sessionDetails = await hubspot.getMockExamWithBookings(sessionId);

    if (!sessionDetails) {
      return {
        sessionId,
        isDeletable: false,
        error: 'NOT_FOUND',
        message: 'Session not found'
      };
    }

    // Filter for active/completed bookings only
    const activeOrCompletedBookings = sessionDetails.bookings.filter(booking => {
      const status = booking.properties.is_active;
      return status === 'Active' || status === 'Completed';
    });

    const isDeletable = activeOrCompletedBookings.length === 0;

    return {
      sessionId,
      isDeletable,
      bookingInfo: {
        total: sessionDetails.bookings.length,
        active: activeOrCompletedBookings.filter(b => b.properties.is_active === 'Active').length,
        completed: activeOrCompletedBookings.filter(b => b.properties.is_active === 'Completed').length,
        cancelled: sessionDetails.bookings.length - activeOrCompletedBookings.length
      },
      error: !isDeletable ? 'HAS_BOOKINGS' : null,
      message: !isDeletable
        ? `Session has ${activeOrCompletedBookings.length} active/completed booking(s)`
        : 'Session can be deleted'
    };
  } catch (error) {
    return {
      sessionId,
      isDeletable: false,
      error: 'VERIFICATION_FAILED',
      message: error.message || 'Failed to verify session deletability'
    };
  }
}
```

**Error Handling:**
- If verification fails → Mark as NOT deletable (fail-safe)
- If HubSpot API is down → Abort entire operation
- If booking count is > 0 but all cancelled → Allow deletion

---

### Rate Limiting Considerations

**HubSpot API Limits:**
- **Burst Limit:** 100 requests per 10 seconds
- **Daily Limit:** 500,000 requests per day (shared across app)

**Our Batch Operations:**
- Batch read: 1 request per 100 sessions
- Batch archive: 1 request per 100 sessions
- Total: ~2 requests per 100 sessions (plus booking verification)

**Rate Limit Strategy:**
```javascript
// No explicit rate limiting needed due to:
// 1. Max 100 sessions per request (UI enforced)
// 2. Batch operations minimize API calls
// 3. Single admin user unlikely to exceed burst limit

// But monitor for safety
const startTime = Date.now();
const endTime = Date.now();
const duration = endTime - startTime;

if (duration < 100) {
  // Too fast - might hit rate limit on repeated requests
  console.warn('⚠️ [BATCH-DELETE] Operation completed very quickly, monitor for rate limiting');
}
```

**Future Enhancement:**
- Add exponential backoff if 429 (Too Many Requests) is received
- Track API call count and delay if approaching limit

---

## Error Handling

### Error Categories

#### 1. **Network Errors**
```javascript
// Axios network error
catch (error) {
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return res.status(504).json({
      success: false,
      error: {
        code: 'NETWORK_TIMEOUT',
        message: 'Request to HubSpot timed out. Please try again.'
      }
    });
  }

  if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
    return res.status(503).json({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Unable to connect to HubSpot. Please try again later.'
      }
    });
  }
}
```

#### 2. **Partial Failures**
```javascript
// Some sessions deleted, some failed
const results = await batchDeleteSessions(deletableSessionIds);

return res.status(200).json({
  success: results.failed.length === 0, // true if all succeeded
  summary: {
    total: sessionIds.length,
    deleted: results.successful.length,
    failed: results.failed.length,
    skippedBookings: skippedCount,
    errors: errorCount
  },
  results: {
    successful: results.successful,
    failed: results.failed
  }
});
```

#### 3. **HubSpot API Errors**
```javascript
// HubSpot returns error in response
if (response.errors && response.errors.length > 0) {
  response.errors.forEach(error => {
    results.failed.push({
      sessionId: error.context?.id || 'unknown',
      error: 'HUBSPOT_ERROR',
      message: error.message,
      category: error.category,
      statusCode: error.status
    });
  });
}

// Common HubSpot error codes:
// - OBJECT_NOT_FOUND (404): Session doesn't exist
// - INVALID_OBJECT_ID (400): Malformed session ID
// - RATE_LIMIT_EXCEEDED (429): Too many requests
// - INTERNAL_ERROR (500): HubSpot server error
```

#### 4. **Validation Errors**
```javascript
// Joi validation error
if (error.validationErrors) {
  return res.status(400).json({
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Invalid request data',
      details: error.validationErrors
    }
  });
}
```

#### 5. **Authentication Errors**
```javascript
// Auth middleware error
if (error.message?.includes('authorization') || error.message?.includes('token')) {
  return res.status(401).json({
    success: false,
    error: {
      code: 'UNAUTHORIZED',
      message: 'Authentication required'
    }
  });
}
```

---

### User-Friendly Error Messages

**Error Message Mapping:**
```javascript
const ERROR_MESSAGES = {
  // Client errors (4xx)
  VALIDATION_ERROR: 'Please check your input and try again.',
  BATCH_SIZE_EXCEEDED: 'You can only delete up to 100 sessions at once. Please reduce your selection.',
  UNAUTHORIZED: 'Your session has expired. Please log in again.',
  NOT_FOUND: 'Some sessions could not be found. They may have been already deleted.',
  HAS_BOOKINGS: 'Some sessions have active bookings and cannot be deleted.',

  // Server errors (5xx)
  HUBSPOT_ERROR: 'There was a problem communicating with HubSpot. Please try again.',
  NETWORK_TIMEOUT: 'The request took too long to complete. Please try with fewer sessions.',
  SERVICE_UNAVAILABLE: 'HubSpot is temporarily unavailable. Please try again later.',
  TIMEOUT: 'The operation timed out. Please try deleting fewer sessions at once.',

  // Generic fallback
  UNKNOWN: 'An unexpected error occurred. Please try again or contact support if the problem persists.'
};

function getUserFriendlyMessage(errorCode) {
  return ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.UNKNOWN;
}
```

**Frontend Error Display:**
```javascript
// In useMassDelete hook
onError: (error) => {
  const errorCode = error.response?.data?.error?.code || 'UNKNOWN';
  const userMessage = getUserFriendlyMessage(errorCode);

  toast.error({
    title: 'Deletion Failed',
    description: userMessage,
    duration: 10000,
    action: errorCode === 'UNAUTHORIZED' ? {
      label: 'Log In',
      onClick: () => navigate('/login')
    } : undefined
  });
}
```

---

### Logging Strategy

**Console Logging Levels:**
```javascript
// Start of operation
console.log(`🗑️ [BATCH-DELETE] Processing deletion for ${sessionIds.length} sessions`);
console.log(`🗑️ [BATCH-DELETE] Admin: ${adminEmail}`);

// Validation phase
console.log(`🔍 [BATCH-DELETE] Validating ${sessionIds.length} sessions...`);
console.log(`✅ [BATCH-DELETE] ${deletableCount} sessions can be deleted`);
console.log(`⚠️ [BATCH-DELETE] ${withBookingsCount} sessions skipped (have bookings)`);

// Deletion phase
console.log(`⚡ [BATCH-DELETE] Deleting ${deletableCount} sessions in batches...`);

// Results
console.log(`✅ [BATCH-DELETE] Successfully deleted ${successCount} session(s)`);
console.log(`❌ [BATCH-DELETE] ${failedCount} deletion(s) failed`);

// Errors
console.error('❌ [BATCH-DELETE] Error in batch delete:', error);

// Performance monitoring
console.log(`⏱️ [BATCH-DELETE] Execution time: ${executionTime}ms`);
```

**Audit Trail:**
```javascript
async function createAuditLog(summary, adminEmail, sessionIds) {
  const auditEntry = {
    operation: 'BATCH_DELETE',
    timestamp: new Date().toISOString(),
    admin: adminEmail,
    summary: {
      total: summary.total,
      deleted: summary.deleted,
      failed: summary.failed
    },
    sessionIds: sessionIds,
    executionTime: summary.executionTime
  };

  // Log to console (could also write to database or external service)
  console.log(`📝 [AUDIT] Batch delete operation:`, auditEntry);

  // In production, send to audit logging service
  // await auditService.log(auditEntry);
}
```

---

## Testing Strategy

### Unit Tests

**Test File:** `admin_root/api/admin/mock-exams/__tests__/batch-delete.test.js`

**Test Cases:**

#### 1. **Input Validation Tests**
```javascript
describe('Batch Delete - Input Validation', () => {
  it('should reject empty session IDs array', async () => {
    const response = await request(app)
      .post('/api/admin/mock-exams/batch-delete')
      .send({ sessionIds: [] })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should reject more than 100 session IDs', async () => {
    const sessionIds = Array.from({ length: 101 }, (_, i) => `${i}`);
    const response = await request(app)
      .post('/api/admin/mock-exams/batch-delete')
      .send({ sessionIds })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('BATCH_SIZE_EXCEEDED');
  });

  it('should reject invalid session ID format', async () => {
    const response = await request(app)
      .post('/api/admin/mock-exams/batch-delete')
      .send({ sessionIds: ['abc123', 'invalid'] })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(400);
  });
});
```

#### 2. **Authentication Tests**
```javascript
describe('Batch Delete - Authentication', () => {
  it('should reject requests without auth token', async () => {
    const response = await request(app)
      .post('/api/admin/mock-exams/batch-delete')
      .send({ sessionIds: ['123', '456'] });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('should reject requests with invalid auth token', async () => {
    const response = await request(app)
      .post('/api/admin/mock-exams/batch-delete')
      .send({ sessionIds: ['123', '456'] })
      .set('Authorization', 'Bearer invalid_token');

    expect(response.status).toBe(401);
  });
});
```

#### 3. **Business Logic Tests**
```javascript
describe('Batch Delete - Business Logic', () => {
  beforeEach(() => {
    // Mock HubSpot API
    jest.spyOn(hubspot, 'getMockExamWithBookings').mockImplementation(async (id) => {
      // Return mock session data
      return mockSessionData[id];
    });
  });

  it('should successfully delete sessions without bookings', async () => {
    const response = await request(app)
      .post('/api/admin/mock-exams/batch-delete')
      .send({ sessionIds: ['123', '456'] })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.summary.deleted).toBe(2);
    expect(response.body.summary.failed).toBe(0);
  });

  it('should skip sessions with active bookings', async () => {
    // Mock session 123 has active bookings
    jest.spyOn(hubspot, 'getMockExamWithBookings').mockResolvedValueOnce({
      id: '123',
      bookings: [
        { properties: { is_active: 'Active' } }
      ]
    });

    const response = await request(app)
      .post('/api/admin/mock-exams/batch-delete')
      .send({ sessionIds: ['123'] })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.summary.deleted).toBe(0);
    expect(response.body.summary.failed).toBe(1);
    expect(response.body.results.failed[0].error).toBe('HAS_BOOKINGS');
  });

  it('should handle partial failures gracefully', async () => {
    // Mock: session 123 deletable, session 456 has bookings
    const response = await request(app)
      .post('/api/admin/mock-exams/batch-delete')
      .send({ sessionIds: ['123', '456'] })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.summary.deleted).toBe(1);
    expect(response.body.summary.failed).toBe(1);
  });
});
```

#### 4. **Cache Invalidation Tests**
```javascript
describe('Batch Delete - Cache Invalidation', () => {
  it('should invalidate relevant caches after successful deletion', async () => {
    const cacheDeletePatternSpy = jest.spyOn(cache, 'deletePattern');

    await request(app)
      .post('/api/admin/mock-exams/batch-delete')
      .send({ sessionIds: ['123', '456'] })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(cacheDeletePatternSpy).toHaveBeenCalledWith('admin:mock-exams:list:*');
    expect(cacheDeletePatternSpy).toHaveBeenCalledWith('admin:mock-exams:aggregates:*');
  });
});
```

---

### Integration Tests

**Test File:** `admin_root/api/admin/mock-exams/__tests__/batch-delete.integration.test.js`

**Test Cases:**

#### 1. **End-to-End Deletion Flow**
```javascript
describe('Batch Delete - E2E Flow', () => {
  let createdSessionIds;

  beforeAll(async () => {
    // Create test sessions in HubSpot sandbox
    createdSessionIds = await createTestSessions(5);
  });

  afterAll(async () => {
    // Cleanup any remaining sessions
    await cleanupTestSessions();
  });

  it('should complete full deletion workflow', async () => {
    // Step 1: Verify sessions exist
    const sessionsBefore = await hubspot.listMockExams();
    expect(sessionsBefore.length).toBeGreaterThanOrEqual(5);

    // Step 2: Delete sessions
    const response = await request(app)
      .post('/api/admin/mock-exams/batch-delete')
      .send({ sessionIds: createdSessionIds })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.summary.deleted).toBe(5);

    // Step 3: Verify sessions are deleted
    for (const id of createdSessionIds) {
      await expect(hubspot.getMockExam(id)).rejects.toThrow('not found');
    }

    // Step 4: Verify cache is invalidated
    const cachedData = await cache.get('admin:mock-exams:list:page-1');
    expect(cachedData).toBeNull();
  });
});
```

#### 2. **HubSpot API Integration**
```javascript
describe('Batch Delete - HubSpot Integration', () => {
  it('should use HubSpot batch archive API correctly', async () => {
    const hubspotSpy = jest.spyOn(hubspot, 'apiCall');

    await request(app)
      .post('/api/admin/mock-exams/batch-delete')
      .send({ sessionIds: ['123', '456', '789'] })
      .set('Authorization', `Bearer ${adminToken}`);

    // Verify batch archive API was called
    expect(hubspotSpy).toHaveBeenCalledWith(
      'POST',
      '/crm/v3/objects/2-50158913/batch/archive',
      expect.objectContaining({
        inputs: expect.arrayContaining([
          { id: '123' },
          { id: '456' },
          { id: '789' }
        ])
      })
    );
  });
});
```

---

### Manual Test Scenarios

**Test Scenario Document:** `PRDs/admin/mass-delete-mock-exam-sessions-test-scenarios.md`

#### Scenario 1: Happy Path - Delete Multiple Sessions
**Pre-conditions:**
- 10 mock exam sessions exist without bookings
- Admin user is logged in
- Dashboard shows all sessions

**Steps:**
1. Navigate to Mock Exams Dashboard
2. Click "Select" button to enter selection mode
3. Select 5 sessions (checkboxes appear)
4. Click "Delete Selected" button in toolbar
5. Verify modal shows:
   - "5 sessions selected"
   - "5 can be deleted"
   - "0 have bookings"
6. Type "5" in confirmation input
7. Click "Delete 5 Sessions" button
8. Wait for operation to complete

**Expected Results:**
- Modal closes automatically
- Success toast appears: "Successfully deleted 5 sessions"
- Table refreshes, showing 5 remaining sessions
- Selection mode exits
- Deleted sessions no longer appear in list

---

#### Scenario 2: Partial Deletion - Some Sessions Have Bookings
**Pre-conditions:**
- 10 sessions exist
- 3 sessions have active bookings
- 7 sessions have no bookings

**Steps:**
1. Enter selection mode
2. Select all 10 sessions
3. Click "Delete Selected"
4. Modal shows: "7 can be deleted, 3 have bookings (will be skipped)"
5. Type "7" in confirmation input
6. Click "Delete 7 Sessions"

**Expected Results:**
- Modal closes
- Warning toast: "Deleted 7 sessions. 3 failed (3 had bookings)"
- Table refreshes
- 7 sessions deleted, 3 remain (those with bookings)
- Selection cleared

---

#### Scenario 3: No Deletable Sessions
**Pre-conditions:**
- All selected sessions have active bookings

**Steps:**
1. Select 5 sessions (all with bookings)
2. Click "Delete Selected"

**Expected Results:**
- Modal shows: "0 can be deleted, 5 have bookings"
- Confirmation input is disabled
- Delete button is disabled
- Message: "None of the selected sessions can be deleted"
- Only "Close" button is available

---

#### Scenario 4: Concurrent Operations
**Pre-conditions:**
- Multiple sessions selected

**Steps:**
1. Click "Delete Selected"
2. While modal is open, another admin deletes one of the sessions
3. Confirm deletion in modal

**Expected Results:**
- API returns partial success
- Toast shows: "Deleted X sessions. 1 failed (not found)"
- No errors thrown

---

#### Scenario 5: Network Error During Deletion
**Pre-conditions:**
- Sessions selected
- Network connection unstable

**Steps:**
1. Click "Delete Selected"
2. Confirm deletion
3. Simulate network disconnect during API call

**Expected Results:**
- Modal stays open with loading spinner
- After timeout: Error toast appears
- Modal closes
- Sessions remain selected
- User can retry operation

---

### Edge Case Coverage

**Edge Cases to Test:**

1. **Session ID Format Validation**
   - Input: `['abc', '123', 'xyz']`
   - Expected: Validation error, operation aborted

2. **Duplicate Session IDs**
   - Input: `['123', '123', '456']`
   - Expected: Deduplicated automatically, 2 sessions deleted

3. **Session Deleted Between Selection and Confirmation**
   - Select session → Another admin deletes it → Confirm deletion
   - Expected: Partial failure, "Session not found" error for that session

4. **Exactly 100 Sessions**
   - Input: 100 session IDs
   - Expected: Successful deletion (at batch limit)

5. **101 Sessions**
   - Input: 101 session IDs
   - Expected: Validation error: "Maximum 100 sessions can be deleted at once"

6. **All Sessions Have Bookings**
   - Select 10 sessions, all with bookings
   - Expected: Modal shows "0 can be deleted", delete button disabled

7. **Booking Added During Deletion Process**
   - Session validation passes → Student books session → Deletion attempted
   - Expected: Re-validation catches new booking, session skipped

8. **HubSpot API Rate Limit Hit**
   - Delete 100 sessions rapidly, trigger rate limit
   - Expected: Retry with exponential backoff (future enhancement)

---

## Implementation Plan

### Day 1: Backend Endpoint Development

**Duration:** 6-8 hours

**Tasks:**

#### Morning (Hours 1-4):

**Task 1.1: Create Validation Schema** (30 min)
- [ ] Open `admin_root/api/_shared/validation.js`
- [ ] Add `batchDelete` schema after `batchBookingCancellation`
- [ ] Test validation with sample inputs
- [ ] Commit: `feat(validation): add batch delete validation schema`

**Task 1.2: Create API Endpoint File** (1 hour)
- [ ] Create `admin_root/api/admin/mock-exams/batch-delete.js`
- [ ] Set up basic structure:
  - Import dependencies (requireAdmin, validation, hubspot, cache)
  - Export async handler function
  - Add method check (POST only)
  - Add authentication check
  - Add validation middleware
- [ ] Test endpoint responds with 405 for GET requests
- [ ] Commit: `feat(api): create batch delete endpoint structure`

**Task 1.3: Implement Session Validation Logic** (2 hours)
- [ ] Create `validateSessionsForDeletion()` function
- [ ] Fetch sessions using HubSpot batch read API
- [ ] Fetch associated bookings for each session
- [ ] Filter for active/completed bookings
- [ ] Return deletability status for each session
- [ ] Add comprehensive error handling
- [ ] Test with mock HubSpot responses
- [ ] Commit: `feat(api): implement session deletability validation`

**Task 1.4: Add Logging** (30 min)
- [ ] Add console.log statements for each phase
- [ ] Add performance monitoring (execution time)
- [ ] Add audit log creation function
- [ ] Commit: `feat(api): add logging and audit trail`

#### Afternoon (Hours 5-8):

**Task 1.5: Implement Batch Delete Logic** (2 hours)
- [ ] Create `batchArchiveSessions()` function
- [ ] Implement HubSpot batch archive API calls
- [ ] Add chunking logic (100 per batch)
- [ ] Handle partial failures in batches
- [ ] Test with various batch sizes (1, 10, 50, 100)
- [ ] Commit: `feat(api): implement batch archive logic`

**Task 1.6: Add Cache Invalidation** (1 hour)
- [ ] Create `invalidateSessionCaches()` function
- [ ] Invalidate list caches with pattern matching
- [ ] Invalidate individual session caches
- [ ] Invalidate aggregate caches
- [ ] Test cache patterns are correct
- [ ] Commit: `feat(api): add cache invalidation`

**Task 1.7: Error Handling & Response** (1 hour)
- [ ] Add try-catch blocks for all async operations
- [ ] Map HubSpot errors to user-friendly messages
- [ ] Build response object with summary and results
- [ ] Add timeout detection (55s limit)
- [ ] Test error scenarios
- [ ] Commit: `feat(api): add comprehensive error handling`

**End of Day 1 Checklist:**
- [ ] Backend endpoint fully functional
- [ ] Validation working correctly
- [ ] Booking protection logic verified
- [ ] Cache invalidation tested
- [ ] Error handling complete
- [ ] Code committed and pushed

---

### Day 2: Frontend Modal and Integration

**Duration:** 6-8 hours

**Tasks:**

#### Morning (Hours 1-4):

**Task 2.1: Create MassDeleteModal Component** (2 hours)
- [ ] Create `admin_root/admin_frontend/src/components/admin/MassDeleteModal.jsx`
- [ ] Set up basic modal structure using Headless UI Dialog
- [ ] Add state management (confirmNumber, isDeleting)
- [ ] Implement session breakdown calculation
- [ ] Add numeric input field with validation
- [ ] Style with Tailwind CSS (red theme for destructive action)
- [ ] Test modal open/close functionality
- [ ] Commit: `feat(frontend): create mass delete modal component`

**Task 2.2: Add Session Preview List** (1 hour)
- [ ] Implement session list display (up to 10 items)
- [ ] Add "...and X more" message for > 10 sessions
- [ ] Show session details (type, date, location)
- [ ] Add booking badges for sessions with bookings
- [ ] Style list with scrollable area
- [ ] Commit: `feat(frontend): add session preview to modal`

**Task 2.3: Implement Real-time Validation** (1 hour)
- [ ] Add onChange handler for numeric input
- [ ] Validate input matches deletable count
- [ ] Show validation feedback (error message)
- [ ] Enable/disable delete button based on validation
- [ ] Add loading state UI
- [ ] Test edge cases (empty input, negative numbers, decimals)
- [ ] Commit: `feat(frontend): add real-time validation to modal`

#### Afternoon (Hours 5-8):

**Task 2.4: Create useMassDelete Hook** (1.5 hours)
- [ ] Create `admin_root/admin_frontend/src/hooks/useMassDelete.js`
- [ ] Implement React Query mutation
- [ ] Add API call to `/api/admin/mock-exams/batch-delete`
- [ ] Handle success (cache invalidation, toast notification)
- [ ] Handle errors (error messages, toast)
- [ ] Add loading state management
- [ ] Test hook with mock API responses
- [ ] Commit: `feat(frontend): create useMassDelete hook`

**Task 2.5: Update MockExamsSelectionToolbar** (1 hour)
- [ ] Open `MockExamsSelectionToolbar.jsx`
- [ ] Import TrashIcon from Heroicons
- [ ] Add `onDeleteSessions` prop
- [ ] Add Delete Selected button (red theme, between Toggle and Exit)
- [ ] Update prop types and documentation
- [ ] Test button visibility and disabled states
- [ ] Commit: `feat(frontend): add delete button to selection toolbar`

**Task 2.6: Integrate Modal into Dashboard** (1.5 hours)
- [ ] Open `MockExamsDashboard.jsx`
- [ ] Import MassDeleteModal component
- [ ] Import useMassDelete hook
- [ ] Add modal state (showMassDeleteModal)
- [ ] Add handleDeleteSessionsClick handler
- [ ] Add handleConfirmMassDelete handler
- [ ] Update toolbar props (add onDeleteSessions)
- [ ] Add modal component to JSX
- [ ] Test full flow (select → click button → modal opens → confirm → delete)
- [ ] Commit: `feat(frontend): integrate mass delete into dashboard`

**Task 2.7: Polish & Accessibility** (1 hour)
- [ ] Add ESC key handler to close modal
- [ ] Add auto-focus to numeric input
- [ ] Test keyboard navigation
- [ ] Add ARIA labels and roles
- [ ] Test with screen reader
- [ ] Add dark mode support
- [ ] Verify all transitions are smooth
- [ ] Commit: `feat(frontend): add accessibility features to modal`

**End of Day 2 Checklist:**
- [ ] Modal component complete and styled
- [ ] Hook implemented with React Query
- [ ] Toolbar button added
- [ ] Dashboard integration complete
- [ ] Accessibility features working
- [ ] Code committed and pushed

---

### Day 3: Testing, Polish, and Deployment

**Duration:** 4-6 hours

**Tasks:**

#### Morning (Hours 1-3):

**Task 3.1: Integration Testing** (1.5 hours)
- [ ] Test happy path (select → delete → success)
- [ ] Test partial deletion (some with bookings)
- [ ] Test zero deletable sessions
- [ ] Test concurrent operations
- [ ] Test error scenarios (network error, timeout)
- [ ] Test with different selection sizes (1, 10, 50, 100)
- [ ] Document any bugs found

**Task 3.2: Bug Fixes** (1 hour)
- [ ] Fix any bugs discovered during testing
- [ ] Verify fixes work correctly
- [ ] Re-test affected flows
- [ ] Commit: `fix: resolve issues found in integration testing`

**Task 3.3: Performance Testing** (30 min)
- [ ] Test deletion of 10 sessions (should be < 2s)
- [ ] Test deletion of 50 sessions (should be < 8s)
- [ ] Test deletion of 100 sessions (should be < 15s)
- [ ] Monitor network tab for API calls
- [ ] Check for memory leaks
- [ ] Verify cache invalidation performance

#### Afternoon (Hours 4-6):

**Task 3.4: Code Review & Refactoring** (1 hour)
- [ ] Review all new code for best practices
- [ ] Ensure consistent error handling
- [ ] Check for code duplication (DRY principle)
- [ ] Verify all comments are accurate
- [ ] Ensure TypeScript types are correct (if using TS)
- [ ] Run linter and fix any issues
- [ ] Commit: `refactor: improve code quality and consistency`

**Task 3.5: Documentation** (1 hour)
- [ ] Update API documentation with new endpoint
- [ ] Add JSDoc comments to functions
- [ ] Update component prop documentation
- [ ] Add usage examples to README (if needed)
- [ ] Document any known limitations
- [ ] Commit: `docs: add documentation for mass delete feature`

**Task 3.6: Final Testing & QA** (30 min)
- [ ] Run through all test scenarios one more time
- [ ] Test in different browsers (Chrome, Firefox, Safari)
- [ ] Test on different screen sizes (mobile, tablet, desktop)
- [ ] Verify dark mode works correctly
- [ ] Check console for any warnings or errors
- [ ] Get peer review from another developer

**Task 3.7: Deployment** (30 min)
- [ ] Build frontend: `npm run build` (from monorepo root)
- [ ] Test build locally with `vercel dev`
- [ ] Deploy to staging: `vercel`
- [ ] Test on staging environment
- [ ] Deploy to production: `vercel --prod`
- [ ] Verify production deployment
- [ ] Monitor logs for errors

**End of Day 3 Checklist:**
- [ ] All tests passing
- [ ] No critical bugs
- [ ] Performance meets targets
- [ ] Documentation complete
- [ ] Deployed to production
- [ ] Feature is live and working

---

### Post-Deployment Tasks

**Monitoring (Week 1):**
- [ ] Monitor error logs daily
- [ ] Check API performance metrics
- [ ] Gather user feedback
- [ ] Track usage statistics

**Iteration (Week 2):**
- [ ] Address any user-reported issues
- [ ] Optimize based on performance data
- [ ] Consider enhancements based on feedback

---

## Code Reuse Strategy

### Reference: Bulk Toggle Status Endpoint

**File:** `admin_root/api/admin/mock-exams/bulk-toggle-status.js`

**Reusable Patterns:**

#### 1. **Request Handler Structure**
```javascript
// REUSE THIS PATTERN FOR batch-delete.js
module.exports = async (req, res) => {
  const startTime = Date.now();

  try {
    // 1. Method check
    if (req.method !== 'POST') {
      return res.status(405).json({
        success: false,
        error: {
          code: 'METHOD_NOT_ALLOWED',
          message: `Method ${req.method} not allowed. Use POST.`
        }
      });
    }

    // 2. Authentication
    const user = await requireAdmin(req);
    const adminEmail = user?.email || 'admin@prepdoctors.com';

    // 3. Validation
    const validator = validationMiddleware('batchDelete'); // Change to 'batchDelete'
    await new Promise((resolve, reject) => {
      validator(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    const { sessionIds } = req.validatedData;

    // 4. Batch size check
    if (sessionIds.length > MAX_SESSIONS_PER_REQUEST) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BATCH_SIZE_EXCEEDED',
          message: `Maximum ${MAX_SESSIONS_PER_REQUEST} sessions can be deleted per request`,
          details: { provided: sessionIds.length, maximum: MAX_SESSIONS_PER_REQUEST }
        }
      });
    }

    // 5. Process operations...

    // 6. Return response
    const executionTime = Date.now() - startTime;
    res.status(200).json({
      success: true,
      summary,
      results,
      meta: {
        timestamp: new Date().toISOString(),
        processedBy: adminEmail,
        executionTime
      }
    });

  } catch (error) {
    // Error handling (see bulk-toggle-status.js lines 239-284)
  }
};
```

**Adapt for batch-delete:**
- Change validation schema from `bulkToggleStatus` to `batchDelete`
- Replace toggle logic with deletion validation and archive
- Keep same error handling patterns

---

#### 2. **Batch Processing Functions**
```javascript
// FROM bulk-toggle-status.js - ADAPT FOR batch-delete.js

// Fetch sessions in batches
async function fetchSessionsBatch(sessionIds) {
  const sessionsMap = new Map();

  for (let i = 0; i < sessionIds.length; i += HUBSPOT_BATCH_SIZE) {
    const chunk = sessionIds.slice(i, i + HUBSPOT_BATCH_SIZE);

    try {
      const response = await hubspot.apiCall('POST', `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/batch/read`, {
        properties: ['is_active', 'mock_type', 'exam_date', 'location', 'total_bookings'],
        inputs: chunk.map(id => ({ id }))
      });

      if (response.results) {
        for (const session of response.results) {
          sessionsMap.set(session.id, session);
        }
      }
    } catch (error) {
      console.error(`Error fetching session batch:`, error);
    }
  }

  return sessionsMap;
}
```

**Adapt for batch-delete:**
- Add booking fetch step after fetching sessions
- Filter for active/completed bookings
- Return deletability status with each session

---

#### 3. **Cache Invalidation**
```javascript
// FROM bulk-toggle-status.js (lines 380-402) - REUSE AS-IS

async function invalidateSessionCaches() {
  const cache = getCache();

  try {
    // Invalidate mock exams list cache (all pages)
    await cache.deletePattern('admin:mock-exams:list:*');

    // Invalidate aggregate caches
    await cache.deletePattern('admin:mock-exams:aggregates:*');
    await cache.deletePattern('admin:aggregate:sessions:*');

    // Invalidate metrics and dashboard caches
    await cache.deletePattern('admin:metrics:*');

    // Invalidate individual session caches
    await cache.deletePattern('admin:mock-exam:*');
    await cache.deletePattern('admin:mock-exam:details:*');

  } catch (error) {
    console.error('Error invalidating caches:', error);
    // Don't fail the request if cache invalidation fails
  }
}
```

**Use exactly as-is** - no changes needed for batch-delete

---

#### 4. **Audit Logging**
```javascript
// FROM bulk-toggle-status.js (lines 407-443) - ADAPT CONTENT

async function createAuditLog(summary, adminEmail, sessionIds) {
  try {
    // CHANGE: Update note content for deletion instead of toggle
    const noteContent = `
      <strong>🗑️ Bulk Delete Mock Exam Sessions</strong><br/>
      <hr/>
      <strong>Summary:</strong><br/>
      • Total Processed: ${summary.total}<br/>
      • Successfully Deleted: ${summary.deleted}<br/>
      • Failed: ${summary.failed}<br/>
      • Skipped (Had Bookings): ${summary.skippedBookings}<br/>
      <br/>
      <strong>Session IDs:</strong><br/>
      ${sessionIds.slice(0, 10).join(', ')}${sessionIds.length > 10 ? ` ... and ${sessionIds.length - 10} more` : ''}<br/>
      <br/>
      <strong>Deleted By:</strong> ${adminEmail}<br/>
      <strong>Timestamp:</strong> ${new Date().toISOString()}<br/>
    `;

    console.log(`📝 [AUDIT] Bulk delete operation:`, {
      summary,
      adminEmail,
      sessionCount: sessionIds.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw - this is non-critical
  }
}
```

---

### Reference: BulkToggleActiveModal Component

**File:** `admin_root/admin_frontend/src/components/admin/BulkToggleActiveModal.jsx`

**Reusable Patterns:**

#### 1. **Modal Structure**
```jsx
// REUSE THIS STRUCTURE FOR MassDeleteModal.jsx

import { Fragment, useEffect, useMemo } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, TrashIcon } from '@heroicons/react/24/outline'; // Change icon

const MassDeleteModal = ({
  isOpen,
  onClose,
  onConfirm,
  selectedSessions,
  isDeleting // Renamed from isSubmitting
}) => {
  // Calculate session breakdown (ADAPT THIS)
  const sessionBreakdown = useMemo(() => {
    if (!selectedSessions || selectedSessions.length === 0) {
      return { deletable: 0, withBookings: 0, total: 0 };
    }

    // NEW LOGIC: Check for bookings instead of active status
    const withBookings = selectedSessions.filter(s =>
      s.total_bookings > 0 // Simplified - actual check happens in backend
    ).length;

    return {
      deletable: selectedSessions.length - withBookings,
      withBookings,
      total: selectedSessions.length
    };
  }, [selectedSessions]);

  // ESC key handler (KEEP AS-IS)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !isDeleting) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, isDeleting, onClose]);

  // Rest of modal JSX...
};
```

**Key Changes:**
- Change icon from PowerIcon to TrashIcon
- Change color scheme from blue to red (destructive action)
- Add numeric input field (not in BulkToggleActiveModal)
- Change breakdown logic from activate/deactivate to deletable/with bookings

---

#### 2. **Transition Animation**
```jsx
// KEEP THIS EXACT PATTERN - It's perfect

<Transition.Root show={isOpen} as={Fragment}>
  <Dialog
    as="div"
    className="relative z-50"
    onClose={isDeleting ? () => {} : onClose}
  >
    {/* Backdrop with transition */}
    <Transition.Child
      as={Fragment}
      enter="ease-out duration-300"
      enterFrom="opacity-0"
      enterTo="opacity-100"
      leave="ease-in duration-200"
      leaveFrom="opacity-100"
      leaveTo="opacity-0"
    >
      <div className="fixed inset-0 bg-gray-500 dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-75 transition-opacity" />
    </Transition.Child>

    {/* Modal with transition */}
    <div className="fixed inset-0 z-10 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
          enterTo="opacity-100 translate-y-0 sm:scale-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100 translate-y-0 sm:scale-100"
          leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
        >
          <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-md sm:p-6">
            {/* Modal content */}
          </Dialog.Panel>
        </Transition.Child>
      </div>
    </div>
  </Dialog>
</Transition.Root>
```

---

#### 3. **Button Styling**
```jsx
// ADAPT: Change from blue to red for destructive action

{/* Confirm Button - CHANGE TO RED */}
<button
  type="button"
  className={`inline-flex w-full justify-center items-center rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm sm:ml-3 sm:w-auto transition-colors ${
    isDeleting
      ? 'bg-gray-400 cursor-not-allowed'
      : 'bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2' // Changed from blue to red
  }`}
  onClick={handleConfirm}
  disabled={isDeleting || !isValid} // Add !isValid for numeric input check
>
  {isDeleting ? (
    <>
      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" ... />
      Deleting...
    </>
  ) : (
    `Delete ${sessionBreakdown.deletable} Sessions` // More specific text
  )}
</button>
```

---

### Reference: DeleteControls Component

**File:** `admin_root/admin_frontend/src/components/admin/DeleteControls.jsx`

**Reusable Patterns:**

#### 1. **Confirmation Modal Layout**
```jsx
// FROM DeleteControls.jsx (lines 65-149) - REUSE STRUCTURE

<div className="fixed inset-0 z-50 overflow-y-auto">
  <div className="flex items-center justify-center min-h-screen px-4">
    {/* Background overlay */}
    <div className="fixed inset-0 transition-opacity" onClick={handleCancel}>
      <div className="absolute inset-0 bg-gray-500 opacity-75 dark:bg-gray-900"></div>
    </div>

    {/* Modal panel */}
    <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
      {/* Warning Icon */}
      <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900">
        <svg className="h-6 w-6 text-red-600 dark:text-red-400" ... >
          {/* Warning triangle icon */}
        </svg>
      </div>

      {/* Modal Content */}
      <div className="mt-3 text-center sm:mt-5">
        <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100">
          Delete Mock Exam Sessions?
        </h3>
        <div className="mt-2">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Are you sure you want to delete these sessions? This action cannot be undone.
          </p>

          {/* Session Details Box - ADD THIS */}
          <div className="mt-4 bg-gray-50 dark:bg-gray-700 rounded-md p-4 text-left">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Session Details:
            </h4>
            {/* List of sessions */}
          </div>

          {/* Error Message Display */}
          {error && (
            <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
              <p className="text-sm text-red-800 dark:text-red-300">{error.message}</p>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
        {/* Delete button */}
        {/* Cancel button */}
      </div>
    </div>
  </div>
</div>
```

**Adapt for MassDeleteModal:**
- Keep warning icon and red color scheme
- Add session list display
- Add numeric input field between details and error message
- Keep action button layout

---

#### 2. **Loading State in Button**
```jsx
// FROM DeleteControls.jsx (lines 165-169) - REUSE EXACTLY

{isDeleting ? (
  <>
    <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
    Deleting...
  </>
) : (
  <>
    Delete Sessions
  </>
)}
```

---

#### 3. **Error Display**
```jsx
// FROM DeleteControls.jsx (lines 141-147) - KEEP PATTERN

{error && (
  <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
    <p className="text-sm text-red-800 dark:text-red-300">
      {error?.message || 'Failed to delete sessions'}
    </p>
  </div>
)}
```

---

## Code Snippets to Adapt

### Snippet 1: Booking Validation (from delete.js)

```javascript
// FROM admin_root/api/admin/mock-exams/delete.js (lines 26-46)
// ADAPT THIS FOR batch-delete.js

// Check if mock exam has active or completed bookings before deleting
const mockExamDetails = await hubspot.getMockExamWithBookings(mockExamId);

// Filter for only Active or Completed bookings (exclude Cancelled)
const activeOrCompletedBookings = mockExamDetails.bookings.filter(booking => {
  const status = booking.properties.is_active;
  return status === 'Active' || status === 'Completed';
});

if (activeOrCompletedBookings.length > 0) {
  const totalBookings = mockExamDetails.bookings.length;
  const cancelledCount = totalBookings - activeOrCompletedBookings.length;

  return {
    sessionId: mockExamId,
    success: false,
    error: 'HAS_BOOKINGS',
    message: `Cannot delete mock exam with ${activeOrCompletedBookings.length} active or completed booking(s)`,
    bookingCount: activeOrCompletedBookings.length,
    totalBookings: totalBookings,
    cancelledBookings: cancelledCount
  };
}
```

**Use this pattern for each session in batch-delete**

---

### Snippet 2: Numeric Input Validation

```jsx
// NEW CODE FOR MassDeleteModal.jsx

const [confirmNumber, setConfirmNumber] = useState('');

// Validation
const isValid = parseInt(confirmNumber) === sessionBreakdown.deletable;

// Input field
<div className="mt-4">
  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
    Type <strong className="text-red-600">{sessionBreakdown.deletable}</strong> to confirm deletion:
  </label>
  <input
    type="number"
    value={confirmNumber}
    onChange={(e) => setConfirmNumber(e.target.value)}
    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:text-gray-100"
    placeholder={`Enter ${sessionBreakdown.deletable}`}
    autoFocus
  />
  {confirmNumber && !isValid && (
    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
      Please enter exactly {sessionBreakdown.deletable}
    </p>
  )}
</div>
```

---

## Risks & Mitigations

### Risk 1: Accidental Bulk Deletion

**Risk Level:** HIGH

**Description:** Admin accidentally deletes important sessions due to UI error or misclick

**Mitigations:**
1. **Numeric Confirmation:** Require typing exact number of sessions
2. **Session Preview:** Show list of sessions to be deleted
3. **Booking Protection:** Automatically skip sessions with bookings
4. **No Undo:** Make clear this action is permanent
5. **Audit Trail:** Log all deletions with admin email and timestamp

**Residual Risk:** LOW (multiple safeguards in place)

---

### Risk 2: Performance Degradation with Large Batches

**Risk Level:** MEDIUM

**Description:** Deleting 100 sessions could timeout or slow down system

**Mitigations:**
1. **Batch Size Limit:** Hard cap at 100 sessions
2. **HubSpot Batch API:** Use efficient batch archive endpoint
3. **Timeout Monitoring:** Track execution time, abort before 55s
4. **Chunking:** Process in chunks of 100 for HubSpot API
5. **Performance Testing:** Test with 100 sessions before production

**Residual Risk:** LOW (batch operations are optimized)

---

### Risk 3: Race Condition - Booking Created During Deletion

**Risk Level:** MEDIUM

**Description:** Student books session between validation and deletion

**Mitigations:**
1. **Re-validation:** Check bookings immediately before archive
2. **Acceptable Failure:** Deletion fails for that session (safe outcome)
3. **Error Handling:** Session marked as failed with clear reason
4. **User Communication:** Show "Session has new booking" error

**Residual Risk:** LOW (safe failure mode)

---

### Risk 4: Partial Failure Confusion

**Risk Level:** MEDIUM

**Description:** Some sessions delete, some fail - user confused about state

**Mitigations:**
1. **Clear Breakdown:** Show "X deleted, Y failed (Z had bookings)"
2. **Detailed Results:** List which sessions failed and why
3. **Immediate UI Update:** Remove deleted sessions from table
4. **Toast Notification:** Clear success/failure messaging
5. **Audit Log:** Record partial successes for admin review

**Residual Risk:** LOW (comprehensive user feedback)

---

### Risk 5: Cache Inconsistency

**Risk Level:** LOW

**Description:** Deleted sessions still appear in cached list

**Mitigations:**
1. **Aggressive Invalidation:** Delete all relevant cache patterns
2. **Individual Cache Deletion:** Remove each session's cache
3. **Force Refresh:** React Query refetch after mutation
4. **Pattern Matching:** Use wildcards to catch all variations

**Residual Risk:** VERY LOW (tested cache patterns)

---

### Risk 6: HubSpot API Downtime

**Risk Level:** LOW (external dependency)

**Description:** HubSpot API unavailable during deletion attempt

**Mitigations:**
1. **Error Detection:** Catch network errors and API errors
2. **User Communication:** Show "HubSpot temporarily unavailable"
3. **Retry Guidance:** Suggest trying again later
4. **No Data Loss:** No sessions deleted if API fails
5. **Graceful Degradation:** Modal stays open, allows retry

**Residual Risk:** LOW (clear error messaging, safe failure)

---

### Risk 7: Unauthorized Access

**Risk Level:** LOW

**Description:** Non-admin user attempts to access batch delete endpoint

**Mitigations:**
1. **requireAdmin Middleware:** Authentication check on every request
2. **JWT Validation:** Verify Supabase token
3. **401 Response:** Clear unauthorized error
4. **Frontend Protection:** UI only shown to authenticated admins
5. **Audit Logging:** Track all deletion attempts with user email

**Residual Risk:** VERY LOW (multiple auth layers)

---

## Open Questions

### Q1: Should we add an "Undo" feature?

**Context:** Deletions are permanent, no built-in undo

**Options:**
- **A:** No undo - deletions are final (current design)
- **B:** Soft delete - mark as archived, allow restore within 30 days
- **C:** Backup before delete - store session data in separate table

**Recommendation:** **Option A** (No undo)

**Reasoning:**
- Aligns with HubSpot archive behavior (no native undo)
- Multiple safeguards prevent accidental deletion
- Complexity of soft delete not justified for admin tool
- Can recreate sessions if truly needed

**Decision Required By:** Day 1 of implementation

---

### Q2: Should we support deletion of sessions with cancelled bookings?

**Context:** Current design allows deletion if only cancelled bookings exist

**Options:**
- **A:** Allow deletion (current design)
- **B:** Block deletion if ANY bookings exist (even cancelled)
- **C:** Ask admin to confirm separately if cancelled bookings exist

**Recommendation:** **Option A** (Allow deletion)

**Reasoning:**
- Cancelled bookings don't represent active enrollment
- Credits already refunded, no data integrity risk
- Simplifies cleanup of old sessions
- Reduces unnecessary session retention

**Decision Required By:** Day 1 of implementation

---

### Q3: Should we add a "Select All" for batch deletion?

**Context:** Current design requires manual selection of sessions

**Options:**
- **A:** No select all - manual selection only (safer)
- **B:** Add "Select All" button (faster but riskier)
- **C:** Add "Select All Deletable" (excludes those with bookings)

**Recommendation:** **Option C** (Select All Deletable)

**Reasoning:**
- Useful for cleanup scenarios
- "Deletable" filter reduces risk
- Still requires numeric confirmation
- Faster for bulk operations

**Implementation:** Add to FilterBar or SelectionToolbar

**Decision Required By:** Day 2 of implementation

---

### Q4: Should we show a detailed results modal after deletion?

**Context:** Currently only toast notification for results

**Options:**
- **A:** Toast only (current design)
- **B:** Toast + optional detailed modal (click to expand)
- **C:** Always show detailed modal with results

**Recommendation:** **Option B** (Toast + optional modal)

**Reasoning:**
- Toast sufficient for simple successes
- Modal useful for partial failures
- Doesn't force admin to read details every time
- Provides transparency when needed

**Implementation:** Add "View Details" button to toast, opens results modal

**Decision Required By:** Day 3 (polish phase)

---

### Q5: Should we add export/download of deletion results?

**Context:** No way to export list of deleted sessions

**Options:**
- **A:** No export (current design)
- **B:** Export CSV of deleted sessions
- **C:** Export CSV of all results (success + failures)

**Recommendation:** **Option A** (No export) - but consider for future

**Reasoning:**
- Not critical for MVP
- Audit log in console provides record
- Can add later if requested by users
- Adds complexity to implementation

**Future Enhancement:** If admins request it

---

### Q6: What should happen if admin navigates away during deletion?

**Context:** User might close browser tab while deletion is in progress

**Options:**
- **A:** Allow navigation - operation continues on backend
- **B:** Block navigation with "Are you sure?" prompt
- **C:** Cancel operation if user navigates away

**Recommendation:** **Option B** (Block navigation)

**Reasoning:**
- Prevents accidental cancellation
- Matches user expectation (operation in progress)
- Native browser prompt is familiar
- Backend completes regardless

**Implementation:** Use `beforeunload` event listener

**Decision Required By:** Day 2 of implementation

---

## Appendices

### Appendix A: HubSpot Object Schema Reference

**Mock Exam Sessions Object:**
- **Object Type ID:** `2-50158913`
- **Object Name:** `mock_exams`

**Relevant Properties:**
```javascript
{
  mock_type: 'Situational Judgment' | 'Clinical Skills' | 'Mini-mock' | 'Mock Discussion',
  exam_date: 'YYYY-MM-DD',
  location: 'Mississauga' | 'Calgary' | 'Vancouver' | 'Montreal' | 'Richmond Hill' | 'Online',
  capacity: number,
  total_bookings: number,
  is_active: 'true' | 'false' | 'scheduled',
  start_time: 'HH:MM',
  end_time: 'HH:MM',
  hs_createdate: timestamp,
  hs_lastmodifieddate: timestamp
}
```

**Bookings Object:**
- **Object Type ID:** `2-50158943`
- **Object Name:** `bookings`
- **Association to Mock Exams:** `bookings_to_mock_exams`

**Relevant Properties:**
```javascript
{
  is_active: 'Active' | 'Completed' | 'Cancelled',
  student_id: string,
  email: string,
  name: string,
  associated_contact_id: string,
  token_used: string
}
```

---

### Appendix B: API Endpoint Summary

| Endpoint | Method | Purpose | Auth Required |
|----------|--------|---------|---------------|
| `/api/admin/mock-exams/list` | GET | List all sessions | Yes (Admin) |
| `/api/admin/mock-exams/get` | GET | Get single session | Yes (Admin) |
| `/api/admin/mock-exams/delete` | DELETE | Delete single session | Yes (Admin) |
| `/api/admin/mock-exams/bulk-toggle-status` | POST | Toggle active status | Yes (Admin) |
| `/api/admin/mock-exams/batch-delete` | POST | **Delete multiple sessions** | Yes (Admin) |

---

### Appendix C: Frontend Component Hierarchy

```
MockExamsDashboard
├── FilterBar (when not in selection mode)
├── MockExamsSelectionToolbar (when in selection mode)
│   └── Delete Selected Button (new)
├── MockExamsTable
│   ├── SessionRow (with checkbox)
│   └── AggregateRow (if enabled)
├── BulkToggleActiveModal
└── MassDeleteModal (new)
    ├── Session Breakdown
    ├── Session Preview List
    ├── Numeric Input Field
    └── Action Buttons
```

---

### Appendix D: Validation Schema Details

**Schema Name:** `batchDelete`

**Full Schema Definition:**
```javascript
batchDelete: Joi.object({
  sessionIds: Joi.array()
    .items(
      Joi.string()
        .pattern(/^\d+$/)
        .messages({
          'string.pattern.base': 'Invalid session ID format. Must be numeric.'
        })
    )
    .min(1)
    .max(100)
    .required()
    .messages({
      'array.min': 'At least one session ID is required',
      'array.max': 'Maximum 100 sessions can be deleted at once',
      'any.required': 'Session IDs are required'
    })
})
```

**Validation Behavior:**
- **Strip Unknown Fields:** Yes
- **Abort Early:** No (returns all validation errors)
- **Convert Types:** No (strings remain strings)

---

### Appendix E: Cache Invalidation Patterns

**Patterns to Invalidate After Deletion:**

| Pattern | Description |
|---------|-------------|
| `admin:mock-exams:list:*` | All paginated lists |
| `admin:mock-exams:aggregates:*` | Aggregate statistics |
| `admin:aggregate:sessions:*` | Session aggregates |
| `admin:metrics:*` | Dashboard metrics |
| `admin:mock-exam:{id}` | Individual session (each deleted ID) |
| `admin:mock-exam:details:{id}` | Session details (each deleted ID) |

**Cache Service Methods:**
```javascript
cache.deletePattern(pattern)  // Deletes all keys matching pattern
cache.delete(key)             // Deletes single key
```

---

### Appendix F: Environment Variables

**Required Environment Variables:**

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | API base URL | `https://api.prepdoctors.com` |
| `SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase anon key | `eyJhbGc...` |
| `HS_PRIVATE_APP_TOKEN` | HubSpot private app token | `pat-na1-...` |

**Note:** All environment variables must be configured in Vercel dashboard

---

### Appendix G: Testing Checklist

**Pre-Deployment Testing:**

- [ ] **Unit Tests**
  - [ ] Validation schema rejects invalid inputs
  - [ ] Validation schema accepts valid inputs
  - [ ] Booking protection logic works correctly
  - [ ] Batch processing handles chunks correctly
  - [ ] Cache invalidation patterns are correct

- [ ] **Integration Tests**
  - [ ] End-to-end deletion flow completes successfully
  - [ ] HubSpot batch archive API is called correctly
  - [ ] Partial failures are handled gracefully
  - [ ] Cache is invalidated after successful deletion
  - [ ] Audit log is created with correct data

- [ ] **Manual Tests**
  - [ ] Happy path: Delete multiple sessions without bookings
  - [ ] Partial deletion: Some sessions have bookings
  - [ ] Zero deletable: All sessions have bookings
  - [ ] Concurrent operations: Multiple admins deleting simultaneously
  - [ ] Network error: HubSpot API unavailable
  - [ ] Timeout: Deletion of 100 sessions completes in < 55s

- [ ] **UI/UX Tests**
  - [ ] Modal opens and closes correctly
  - [ ] Numeric input validates in real-time
  - [ ] Session preview list displays correctly
  - [ ] Loading states show appropriately
  - [ ] Toast notifications appear with correct messages
  - [ ] Table refreshes after deletion
  - [ ] Selection mode exits after operation

- [ ] **Accessibility Tests**
  - [ ] Keyboard navigation works (Tab, Enter, ESC)
  - [ ] Screen reader announces modal and errors
  - [ ] Focus management is correct (auto-focus input)
  - [ ] ARIA labels are present and accurate
  - [ ] Color contrast meets WCAG AA standards

- [ ] **Cross-Browser Tests**
  - [ ] Chrome (latest)
  - [ ] Firefox (latest)
  - [ ] Safari (latest)
  - [ ] Edge (latest)

- [ ] **Responsive Tests**
  - [ ] Desktop (1920x1080)
  - [ ] Laptop (1366x768)
  - [ ] Tablet (768x1024)
  - [ ] Mobile (375x667)

---

### Appendix H: Related Documentation

**Internal Documentation:**
- `documentation/MOCKS_BOOKING_README.md` - Overall system documentation
- `documentation/api/mock-exams.md` - Mock exams API reference
- `documentation/frontend/components.md` - Frontend component guide

**External References:**
- [HubSpot Batch Archive API](https://developers.hubspot.com/docs/api/crm/objects/batch-archive)
- [HubSpot Rate Limits](https://developers.hubspot.com/docs/api/usage-details)
- [React Query Mutations](https://tanstack.com/query/latest/docs/react/guides/mutations)
- [Headless UI Dialog](https://headlessui.com/react/dialog)

**Code References:**
- `admin_root/api/admin/mock-exams/bulk-toggle-status.js` - Similar bulk operation
- `admin_root/api/admin/mock-exams/delete.js` - Single session deletion
- `admin_root/admin_frontend/src/components/admin/BulkToggleActiveModal.jsx` - Modal pattern
- `admin_root/admin_frontend/src/components/admin/DeleteControls.jsx` - Delete confirmation pattern

---

## Summary

This PRD provides a **comprehensive, implementation-ready specification** for the Mass Delete Mock Exam Sessions feature. It includes:

- **Detailed functional requirements** with code examples
- **Complete technical specifications** for backend and frontend
- **Step-by-step implementation plan** (3-day timeline)
- **Extensive code reuse strategy** leveraging existing components
- **Robust error handling and security measures**
- **Comprehensive testing strategy** with specific test cases
- **Risk analysis with mitigations**
- **Open questions for team decision**

**Confidence Score: 9/10**

**Ready for Implementation:** Yes

**Estimated Effort:** 2-3 developer days

**Dependencies:** None (all required infrastructure exists)

---

**Document Version:** 1.0
**Last Updated:** 2025-01-14
**Author:** AI Assistant (Claude)
**Reviewed By:** [Pending]
**Approved By:** [Pending]

---

*End of PRD*