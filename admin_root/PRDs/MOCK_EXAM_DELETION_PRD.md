# PRD: Mock Exam Deletion Feature

## Document Information
- **Feature**: Mock Exam Deletion
- **Status**: Draft
- **Priority**: High
- **Estimated Effort**: 4-6 hours
- **Confidence Score**: 9/10
- **Created**: 2025-10-29
- **Version**: 1.0.0

## Table of Contents
1. [Overview](#overview)
2. [User Stories](#user-stories)
3. [Technical Requirements](#technical-requirements)
4. [Frontend Components](#frontend-components)
5. [Backend Requirements](#backend-requirements)
6. [User Flow](#user-flow)
7. [Edge Cases & Error Handling](#edge-cases--error-handling)
8. [Testing Requirements](#testing-requirements)
9. [Implementation Checklist](#implementation-checklist)
10. [Success Metrics](#success-metrics)

---

## Overview

### Problem Statement
Currently, administrators can create and edit mock exams, but there is no way to delete mock exams through the admin interface. This creates administrative overhead when exams need to be removed due to scheduling errors, cancellations, or other reasons.

### Solution
Implement a delete button alongside the existing edit button on the Mock Exam Details page. When clicked, show a confirmation modal to prevent accidental deletions. Upon confirmation, the exam will be removed from HubSpot and the user will be redirected to the main dashboard with updated data.

### Key Benefits
- Reduces administrative burden
- Provides complete CRUD operations for mock exams
- Prevents orphaned or invalid exam data
- Maintains data integrity by checking for existing bookings

---

## User Stories

### Primary User Story
**As an** administrator
**I want to** delete mock exams that are no longer needed
**So that** I can maintain a clean and accurate exam schedule

### Acceptance Criteria
- [ ] Delete button is visible next to the Edit button on Mock Exam Details page
- [ ] Clicking Delete button shows a confirmation modal
- [ ] Modal displays warning about permanent deletion
- [ ] Modal shows exam details (type, date, location) for verification
- [ ] If exam has bookings, deletion is blocked with clear error message
- [ ] If exam has no bookings, deletion proceeds successfully
- [ ] After deletion, user is redirected to main dashboard
- [ ] Dashboard automatically updates to reflect deleted exam
- [ ] Cache is invalidated to ensure data consistency
- [ ] Appropriate error messages are shown for all failure scenarios

---

## Technical Requirements

### Core Technologies
- **Frontend**: React 18, React Router, Heroicons
- **Backend**: Vercel Serverless Functions, Node.js
- **Data Source**: HubSpot CRM API (Custom Object: Mock Exams)
- **Cache**: Redis (for cache invalidation)
- **State Management**: React Query (for mutations and cache updates)

### API Integration
**HubSpot CRM Custom Objects API**
- **Endpoint**: `DELETE /crm/v3/objects/{objectType}/{objectId}`
- **Object Type**: `2-50158913` (Mock Exams)
- **Authentication**: Private App token
- **Response**: 204 No Content (success) or error details
- **Behavior**: Archives object to recycling bin (soft delete)

### Data Flow
```
User clicks Delete → Confirmation Modal → Confirm Delete
    ↓
Frontend: mockExamsApi.delete(id) via React Query mutation
    ↓
Backend: /api/admin/mock-exams/delete (existing endpoint)
    ↓
HubSpot: Check for bookings → Archive exam → Return success
    ↓
Cache: Invalidate related caches (list, aggregates, metrics)
    ↓
Frontend: Navigate to dashboard → Query invalidation → Refresh data
```

---

## Frontend Components

### 1. Delete Button Component (New)

**Location**: `admin_frontend/src/components/admin/DeleteControls.jsx`

**Purpose**: Provides a Delete button with confirmation modal

**Props**:
```javascript
{
  examId: string,           // HubSpot Mock Exam ID
  examDetails: {            // Exam details for confirmation display
    mock_type: string,
    exam_date: string,
    location: string,
    total_bookings: number
  },
  onDeleteSuccess: () => void,  // Callback after successful deletion
  disabled: boolean,        // Disable during edit mode
  className: string         // Additional CSS classes
}
```

**State**:
```javascript
{
  showConfirmDialog: boolean,    // Toggle confirmation modal
  isDeleting: boolean,           // Loading state during deletion
  error: string | null           // Error message if deletion fails
}
```

**Features**:
- Red "Delete" button with trash icon
- Disabled during edit mode
- Confirmation modal with:
  - Warning icon (red)
  - Exam details summary
  - Clear warning about permanent deletion
  - Two-button layout: "Cancel" (left) and "Delete Exam" (right, red)
  - Overlay dismisses on click (closes modal)
- Loading spinner during deletion
- Toast notification on success/error

**UI Design**:
```
┌─────────────────────────────────────────┐
│  [Edit Button] [Delete Button]         │
└─────────────────────────────────────────┘

Confirmation Modal:
┌─────────────────────────────────────────┐
│              ⚠️                         │
│        Delete Mock Exam?                │
│                                         │
│  Are you sure you want to delete this  │
│  mock exam? This action cannot be      │
│  undone.                                │
│                                         │
│  Exam Details:                          │
│  • Type: Mini-mock                      │
│  • Date: Saturday, December 14, 2030   │
│  • Location: Mississauga - B9          │
│                                         │
│  [Cancel]     [Delete Exam]             │
└─────────────────────────────────────────┘
```

### 2. Update MockExamDetail Page

**Location**: `admin_frontend/src/pages/MockExamDetail.jsx`

**Changes Required**:
- Import `DeleteControls` component
- Add `useNavigate` hook for redirection
- Create `handleDeleteSuccess` callback function
- Update header layout to include delete button next to edit button
- Disable delete button when `isEditing` is true

**Updated Layout** (lines 189-202):
```jsx
<div className="flex justify-between items-center mb-4">
  <h1 className="font-headline text-3xl font-bold text-navy-900 dark:text-gray-100">
    {examEdit.isEditing ? 'Editing Mock Exam' : 'Mock Exam Details'}
  </h1>
  <div className="flex items-center gap-2">
    {/* Edit Controls */}
    <EditControls
      isEditing={examEdit.isEditing}
      isSaving={examEdit.isSaving}
      isDirty={examEdit.isDirty}
      onEdit={examEdit.toggleEdit}
      onSave={examEdit.saveChanges}
      onCancel={examEdit.forceCancelEdit}
    />
    {/* Delete Controls */}
    <DeleteControls
      examId={exam.id}
      examDetails={{
        mock_type: exam.mock_type,
        exam_date: exam.exam_date,
        location: exam.location,
        total_bookings: exam.total_bookings || 0
      }}
      onDeleteSuccess={handleDeleteSuccess}
      disabled={examEdit.isEditing}
    />
  </div>
</div>
```

### 3. Update adminApi.js

**Location**: `admin_frontend/src/services/adminApi.js`

**Changes**: The `delete` method already exists (lines 151-154), but needs to be integrated with React Query mutation.

**Existing Implementation**:
```javascript
delete: async (id) => {
  const response = await api.delete('/admin/mock-exams/delete', { params: { id } });
  return response.data;
}
```

✅ **No changes needed** - API method already properly defined.

### 4. Create Delete Mutation Hook

**Location**: `admin_frontend/src/hooks/useDeleteMockExam.js` (New File)

**Purpose**: Handles deletion mutation with React Query

**Implementation**:
```javascript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { mockExamsApi } from '../services/adminApi';

export function useDeleteMockExam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (examId) => {
      return await mockExamsApi.delete(examId);
    },
    onSuccess: (data, examId) => {
      // Invalidate all related queries
      queryClient.invalidateQueries(['mockExams']);
      queryClient.invalidateQueries(['mockExamMetrics']);
      queryClient.invalidateQueries(['mockExamAggregates']);

      // Remove specific exam from cache
      queryClient.removeQueries(['mockExam', examId]);

      toast.success('Mock exam deleted successfully');
    },
    onError: (error) => {
      const message = error.message || 'Failed to delete mock exam';
      toast.error(message);
    }
  });
}
```

---

## Backend Requirements

### Existing Endpoint: DELETE /api/admin/mock-exams/delete

**Location**: `admin_root/api/admin/mock-exams/delete.js`

**Current Features** ✅:
- Admin authentication check
- Validates mock exam ID
- Checks for existing bookings (blocks deletion if bookings exist)
- Deletes mock exam from HubSpot
- Invalidates Redis caches
- Returns success/error responses

**Analysis**: The existing endpoint is **COMPLETE** and handles all requirements:

✅ Prevents deletion of exams with bookings
✅ Properly authenticates admin users
✅ Invalidates all related caches
✅ Returns appropriate error codes (400, 401, 404, 409, 500)
✅ Logs deletion activity

**No backend changes needed** - existing endpoint fully supports the feature.

### HubSpot Service Integration

**Location**: `admin_root/api/_shared/hubspot.js`

**Required Methods** (verify existence):
- `getMockExamWithBookings(mockExamId)` - ✅ Used in delete.js (line 27)
- `deleteMockExam(mockExamId)` - ✅ Used in delete.js (line 38)

Both methods already implemented and working.

---

## User Flow

### Happy Path: Successful Deletion

```
1. User navigates to Mock Exam Details page
2. User sees [Edit] and [Delete] buttons in header
3. User clicks [Delete] button
4. Confirmation modal appears:
   - Shows warning icon
   - Displays exam details (type, date, location)
   - Shows "This action cannot be undone" warning
   - Shows [Cancel] and [Delete Exam] buttons
5. User clicks [Delete Exam]
6. Button shows loading spinner: "Deleting..."
7. Backend checks for bookings → None found
8. Backend deletes exam from HubSpot
9. Backend invalidates caches
10. Frontend receives success response
11. Success toast appears: "Mock exam deleted successfully"
12. User is redirected to /mock-exams (dashboard)
13. Dashboard data automatically refreshes
14. Deleted exam no longer appears in list
```

### Alternative Path: Deletion Blocked (Exam Has Bookings)

```
1-5. [Same as happy path]
6. Button shows loading spinner: "Deleting..."
7. Backend checks for bookings → Found 3 bookings
8. Backend returns 409 Conflict error:
   "Cannot delete mock exam with existing bookings.
    This exam has 3 booking(s).
    Please cancel all bookings first."
9. Frontend receives error
10. Error toast appears with message
11. Modal closes
12. User remains on exam details page
13. User can navigate to bookings section to see/cancel bookings
```

### Alternative Path: User Cancels

```
1-4. [Same as happy path]
5. User clicks [Cancel] or clicks overlay
6. Modal closes
7. No changes made
8. User remains on exam details page
```

---

## Edge Cases & Error Handling

### 1. Exam Has Active Bookings
**Scenario**: Admin attempts to delete exam with existing bookings
**Backend Check**: `delete.js` lines 26-35
**Response**: 409 Conflict
**Error Message**: "Cannot delete mock exam with existing bookings. This exam has {count} booking(s). Please cancel all bookings first."
**Frontend Behavior**: Show error toast, keep modal open with error message

### 2. Exam Not Found
**Scenario**: Exam was already deleted or ID is invalid
**Backend Check**: `delete.js` lines 67-72
**Response**: 404 Not Found
**Error Message**: "Mock exam not found"
**Frontend Behavior**: Show error toast, redirect to dashboard

### 3. Authentication Failure
**Scenario**: User's auth token expired or invalid
**Backend Check**: `delete.js` lines 57-62
**Response**: 401 Unauthorized
**Error Message**: Auth-specific message
**Frontend Behavior**: AuthContext handles redirect to login

### 4. HubSpot API Error
**Scenario**: HubSpot API is down or rate limited
**Backend Check**: `delete.js` lines 74-78
**Response**: 500 Internal Server Error
**Error Message**: "Failed to delete mock exam"
**Frontend Behavior**: Show error toast, keep user on page

### 5. Network Timeout
**Scenario**: Request takes longer than expected
**Frontend Behavior**: Show loading state, allow user to retry if timeout occurs

### 6. User In Edit Mode
**Scenario**: User has unsaved changes and tries to delete
**Frontend Behavior**: Delete button is disabled until user exits edit mode
**UI State**: Button shows disabled state with cursor-not-allowed

### 7. Cache Invalidation Failure
**Scenario**: Redis cache fails to invalidate
**Backend Behavior**: Log warning but continue with deletion
**Impact**: User may see stale data briefly until cache expires

---

## Testing Requirements

### Unit Tests

#### Frontend Tests
**File**: `admin_frontend/src/components/admin/__tests__/DeleteControls.test.jsx`

```javascript
describe('DeleteControls', () => {
  test('renders delete button', () => {});
  test('shows confirmation modal on click', () => {});
  test('closes modal on cancel', () => {});
  test('calls onDeleteSuccess on successful deletion', () => {});
  test('shows error message on deletion failure', () => {});
  test('disables button when disabled prop is true', () => {});
  test('shows loading state during deletion', () => {});
  test('displays exam details in modal', () => {});
});
```

**File**: `admin_frontend/src/hooks/__tests__/useDeleteMockExam.test.js`

```javascript
describe('useDeleteMockExam', () => {
  test('calls mockExamsApi.delete with correct ID', () => {});
  test('invalidates queries on success', () => {});
  test('shows success toast on deletion', () => {});
  test('shows error toast on failure', () => {});
});
```

#### Backend Tests
**File**: `admin_root/api/admin/mock-exams/__tests__/delete.test.js`

```javascript
describe('DELETE /api/admin/mock-exams/delete', () => {
  test('successfully deletes exam with no bookings', async () => {});
  test('blocks deletion of exam with bookings', async () => {});
  test('returns 404 for non-existent exam', async () => {});
  test('returns 400 when ID is missing', async () => {});
  test('returns 401 when not authenticated', async () => {});
  test('invalidates correct cache keys', async () => {});
});
```

### Integration Tests

**File**: `admin_root/tests/integration/test-exam-deletion-flow.js`

```javascript
describe('Mock Exam Deletion Flow', () => {
  test('full deletion flow: no bookings', async () => {
    // 1. Create test exam
    // 2. Call delete endpoint
    // 3. Verify exam no longer exists in HubSpot
    // 4. Verify cache invalidated
  });

  test('deletion blocked: exam has bookings', async () => {
    // 1. Create test exam
    // 2. Create test booking
    // 3. Attempt deletion
    // 4. Verify 409 error
    // 5. Verify exam still exists
  });
});
```

### Manual Testing Checklist

- [ ] Delete button appears next to Edit button
- [ ] Delete button is disabled during edit mode
- [ ] Clicking Delete shows modal with correct exam details
- [ ] Modal displays properly in light and dark mode
- [ ] Clicking Cancel closes modal without deletion
- [ ] Clicking overlay closes modal without deletion
- [ ] Successful deletion redirects to dashboard
- [ ] Dashboard shows updated list without deleted exam
- [ ] Success toast appears on deletion
- [ ] Error toast appears when deletion fails
- [ ] Deletion blocked when exam has bookings
- [ ] Error message clearly explains why deletion blocked
- [ ] Loading spinner shows during deletion
- [ ] Button states (enabled/disabled) work correctly
- [ ] Navigation works correctly after deletion
- [ ] Browser back button doesn't break after deletion

---

## Implementation Checklist

### Phase 1: Frontend UI Components (2 hours)

- [ ] Create `DeleteControls.jsx` component
  - [ ] Add delete button with trash icon
  - [ ] Implement confirmation modal
  - [ ] Add loading states
  - [ ] Add error handling UI
  - [ ] Implement dark mode support
- [ ] Create `useDeleteMockExam.js` hook
  - [ ] Implement mutation with React Query
  - [ ] Add query invalidation logic
  - [ ] Add toast notifications
- [ ] Update `MockExamDetail.jsx` page
  - [ ] Import DeleteControls
  - [ ] Add handleDeleteSuccess callback
  - [ ] Update layout to include delete button
  - [ ] Add navigation logic
  - [ ] Disable delete during edit mode

### Phase 2: Integration & Testing (1.5 hours)

- [ ] Test deletion flow end-to-end
  - [ ] Test with exam with no bookings
  - [ ] Test with exam with bookings
  - [ ] Test with invalid exam ID
  - [ ] Test during edit mode
- [ ] Verify cache invalidation works
- [ ] Test error scenarios
  - [ ] Network errors
  - [ ] Authentication errors
  - [ ] HubSpot API errors
- [ ] Test UI in both light and dark modes
- [ ] Test on different screen sizes

### Phase 3: Code Review & Polish (0.5 hours)

- [ ] Review component code
- [ ] Check for accessibility (ARIA labels, keyboard nav)
- [ ] Verify error messages are user-friendly
- [ ] Check console for warnings/errors
- [ ] Verify no memory leaks
- [ ] Test performance (should be instant)

### Phase 4: Documentation & Deployment (1 hour)

- [ ] Update component documentation
- [ ] Add JSDoc comments
- [ ] Update API documentation if needed
- [ ] Create migration notes if any
- [ ] Build and test production build
- [ ] Deploy to staging
- [ ] Run smoke tests on staging
- [ ] Deploy to production
- [ ] Monitor for errors

---

## Success Metrics

### Functional Metrics
- ✅ Delete button visible and functional on all mock exam detail pages
- ✅ Deletion succeeds for exams with no bookings (100% success rate)
- ✅ Deletion blocked for exams with bookings (0% false positives)
- ✅ Dashboard updates correctly after deletion (100% refresh rate)
- ✅ Cache invalidation works (no stale data issues)

### User Experience Metrics
- ⏱️ Modal appears within 100ms of button click
- ⏱️ Deletion completes within 2 seconds
- ⏱️ Redirect happens within 500ms of success
- 📊 Zero accidental deletions (confirmation modal prevents)
- 📊 Clear error messages for all failure scenarios

### Technical Metrics
- 🔒 All error cases handled gracefully
- 🔒 No console errors or warnings
- 🔒 Passes all unit and integration tests
- 🔒 Accessible (WCAG 2.1 AA compliant)
- 🔒 Works in light and dark modes

---

## Dependencies & Constraints

### Dependencies
- Existing admin authentication system
- Existing HubSpot integration
- Existing cache infrastructure
- React Query for state management
- Heroicons for icons

### Constraints
- Cannot delete exams with existing bookings (business rule)
- Soft delete only (HubSpot archives to recycling bin)
- Must maintain cache consistency
- Must not break existing edit functionality

### Assumptions
- Admin users have proper permissions in HubSpot
- Redis cache is available and functioning
- HubSpot API is available and responsive
- React Query is properly configured

---

## Reference Files

### Frontend Files
- `admin_frontend/src/pages/MockExamDetail.jsx` - Main detail page
- `admin_frontend/src/components/admin/EditControls.jsx` - Edit button reference
- `admin_frontend/src/services/adminApi.js` - API service (delete method exists)
- `admin_frontend/src/hooks/useExamEdit.js` - Edit hook reference

### Backend Files
- `admin_root/api/admin/mock-exams/delete.js` - Deletion endpoint (complete)
- `admin_root/api/_shared/hubspot.js` - HubSpot service
- `admin_root/api/_shared/cache.js` - Cache service
- `user_root/api/bookings/[id].js` - Booking deletion reference

### HubSpot API Documentation
- DELETE endpoint: https://developers.hubspot.com/docs/api-reference/crm-custom-objects-v3/basic/delete-crm-v3-objects-objectType-objectId

---

## Risk Assessment

### High Risk
❌ **None** - Feature is well-scoped with existing backend support

### Medium Risk
⚠️ **Cache invalidation complexity** - Multiple cache keys need invalidation
*Mitigation*: Backend already handles this correctly (delete.js lines 41-47)

⚠️ **User confusion about soft delete** - Exam goes to recycling bin, not permanently deleted
*Mitigation*: Use clear messaging in modal: "remove" rather than "permanently delete"

### Low Risk
✅ **Modal dismissal** - User might accidentally close modal
*Mitigation*: Only Cancel button and overlay click dismiss modal, not Delete button

✅ **Edit mode conflict** - User in edit mode tries to delete
*Mitigation*: Disable delete button during edit mode

---

## Post-Launch Monitoring

### Week 1 After Launch
- Monitor deletion success/failure rates
- Check for any unexpected errors in logs
- Verify cache invalidation is working
- Collect user feedback

### Week 2-4 After Launch
- Analyze deletion patterns (how often used)
- Check if users are hitting "has bookings" error often
- Optimize error messages based on feedback
- Consider adding bulk deletion if needed

---

## Future Enhancements (Out of Scope)

### Phase 2 Potential Features
- Bulk deletion (select multiple exams)
- Deletion with cascade (delete bookings automatically)
- Undo deletion (restore from recycling bin)
- Deletion history/audit log
- Email notification to admins on deletion
- Soft delete warning (recoverable within 90 days)

---

## Conclusion

This PRD provides a comprehensive plan for implementing mock exam deletion functionality. The feature is well-scoped, leverages existing backend infrastructure, and follows established patterns from the booking deletion flow.

**Key Advantages**:
- Backend endpoint already exists and is fully functional
- Clear user flow with confirmation prevents accidents
- Comprehensive error handling for all edge cases
- Follows existing UI patterns (modal similar to EditControls)
- Complete cache invalidation ensures data consistency

**Implementation Time**: 4-6 hours (primarily frontend work)

**Confidence Score**: 9/10
- High confidence due to existing backend support
- Low risk due to well-defined requirements
- Clear reference implementation (booking deletion)
- Comprehensive testing strategy

---

**Document Status**: Ready for Implementation
**Next Steps**: Begin Phase 1 (Frontend UI Components)
