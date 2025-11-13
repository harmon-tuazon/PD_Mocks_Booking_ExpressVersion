# Product Requirements Document (PRD)
## Mock Exam Edit Functionality

**Project**: PrepDoctors Mock Exam Booking System  
**Feature**: Inline Edit for Mock Exam Session Details  
**Date**: January 24, 2025  
**Author**: H  
**Priority**: High  
**Version**: 1.0  
**Status**: Draft  
**Depends On**: Mock Exam Detail View (PRD v1.0)

---

## 📋 Executive Summary

### Brief Description
Add inline editing capability to the Mock Exam Detail View page. When admins click an "Edit" button, the non-editable form becomes editable, allowing modification of mock exam properties. A "Save" button triggers HubSpot API calls to persist changes, with proper validation, error handling, and cache invalidation.

### Business Value
- **Operational Flexibility**: Enables quick corrections to exam details without navigating to HubSpot
- **Time Savings**: Reduces administrative overhead by 70% for exam updates
- **Error Prevention**: Built-in validation prevents invalid data from being saved
- **User Experience**: Inline editing provides immediate feedback and intuitive workflow
- **Data Integrity**: Maintains HubSpot as single source of truth while enabling controlled updates

### Success Criteria
- ✅ Admin can click "Edit" button and all fields become editable within < 500ms
- ✅ Form validation prevents invalid data submission (100% validation coverage)
- ✅ Save operation completes in < 3 seconds
- ✅ Changes reflect immediately in UI (optimistic updates)
- ✅ Cache invalidation ensures data consistency across all views
- ✅ Cancel button reverts all changes without saving
- ✅ Error messages are clear and actionable
- ✅ Edit state persists during accidental refresh (warning dialog)

---

## 🎯 Problem Statement

### Current State
After implementing the Mock Exam Detail View (PRD v1.0), admins can view complete exam session details and associated bookings. However, all fields are non-editable. To make changes to exam details, admins must:
- Navigate to HubSpot directly
- Locate the correct Mock Exam object
- Edit properties manually
- Return to the admin dashboard
- Refresh to see changes

This workflow is time-consuming, requires HubSpot access permissions, and increases the risk of errors from context-switching.

### Desired State
Admins should be able to:
1. Click an "Edit" button on the detail view page
2. Modify any editable field directly in the form
3. See real-time validation feedback
4. Click "Save" to persist changes to HubSpot
5. Receive confirmation of successful update
6. See updated data immediately without page refresh
7. Click "Cancel" to discard changes and revert to original values

### Why This Change is Needed

**Operational Efficiency**: Reduces time to update exam details from ~5 minutes to ~30 seconds

**Reduced Friction**: Eliminates need for HubSpot access and navigation overhead

**Error Reduction**: Built-in validation prevents common mistakes like invalid dates or exceeded capacity

**Audit Trail**: System can log who made what changes and when

**Scalability**: As exam volume grows, centralized editing becomes essential for team operations

---

## 👥 User Impact

### Who Will This Affect?
- [X] PrepDoctors admin staff (Primary users - highest impact)
- [X] System administrators (Secondary users)
- [ ] Students booking exams (No direct impact)
- [ ] All users
- [ ] Other: ___________

### User Personas

**Persona 1: Admin Operations Manager**
- **Current Pain**: Must open HubSpot to fix typos or update exam times
- **Goal**: Make quick corrections without leaving admin dashboard
- **How This Helps**: One-click edit, save, and continue workflow

**Persona 2: Admin Coordinator**
- **Current Pain**: Lacks HubSpot access, must request changes from IT
- **Goal**: Update exam details independently
- **How This Helps**: Self-service editing capability within admin portal

**Persona 3: System Administrator**
- **Current Pain**: Receives frequent requests for minor exam updates
- **Goal**: Delegate routine updates to operations team
- **How This Helps**: Operations team can handle their own updates safely

### User Stories

```
Story 1: Quick Correction
As an admin operations manager,
I want to click "Edit" and fix a typo in the exam location
So that I can correct the error in 30 seconds instead of 5 minutes
Without needing to contact IT or access HubSpot.

Story 2: Capacity Adjustment
As an admin coordinator,
I want to increase the capacity of an exam session
So that I can accommodate additional students
When rooms change or instructors become available.

Story 3: Schedule Change
As an admin operations manager,
I want to update the start and end times of an exam
So that I can reflect instructor availability changes
And notify students of the updated schedule.

Story 4: Mistake Prevention
As an admin user,
I want to see validation errors before saving
So that I don't accidentally create invalid exam data
That could break the booking flow.
```

---

## 🔧 Technical Specifications

### Affected Components
- [X] 🖥️ **Frontend React App** (`/admin_frontend/src/`)
- [X] 📙 **Backend API** (`/api/admin/`)
- [X] 🏢 **HubSpot Integration** (Mock Exams `2-50158913`)
- [X] 💾 **Cache Management** (Redis invalidation)
- [ ] ☁️ **Vercel Deployment** (No config changes needed)
- [X] 🧪 **Tests** (Unit, integration, and E2E tests)
- [X] 📖 **Documentation** (Update admin user guide)

### Modified/New Files

#### Frontend Changes
```
admin_frontend/src/
├── pages/
│   └── MockExamDetail.jsx          # MODIFIED: Add edit state management
│
├── components/
│   └── admin/
│       ├── ExamDetailsForm.jsx     # MODIFIED: Add editable mode
│       ├── EditControls.jsx        # NEW: Edit/Save/Cancel buttons
│       └── ValidationMessage.jsx   # NEW: Inline validation feedback
│
├── hooks/
│   ├── useExamEdit.js              # NEW: Edit state and save logic
│   └── useFormValidation.js        # NEW: Real-time validation hook
│
└── utils/
    └── examValidation.js           # NEW: Validation rules
```

#### Backend Changes
```
api/admin/
├── mock-exams/
│   └── [id].js                     # MODIFIED: Add PATCH handler
│
└── services/
    └── mockExamDetailsService.js   # MODIFIED: Add update method
```

### API Endpoint Specification

#### Update Mock Exam
```
PATCH /api/admin/mock-exams/:id

Purpose: Update properties of an existing mock exam session
Auth: Required (Bearer token, Admin role)
Rate Limit: 50 req/min per user

Request:
  Path Parameters:
    - id: string (Required) - HubSpot Mock Exam object ID

  Headers:
    - Authorization: Bearer <token>
    - Content-Type: application/json

  Body:
    {
      "mock_type": "Situational Judgment",      // Optional
      "exam_date": "2025-02-15",                // Optional (ISO date)
      "start_time": "09:00:00",                 // Optional (HH:MM:SS)
      "end_time": "12:00:00",                   // Optional (HH:MM:SS)
      "capacity": 25,                           // Optional (integer, min: 1)
      "location": "Mississauga",                // Optional (enum)
      "address": "123 Main St...",              // Optional (string)
      "is_active": true                         // Optional (boolean)
    }

  Validation Rules:
    - At least one property must be provided
    - exam_date: Must be ISO format (YYYY-MM-DD), cannot be in the past
    - start_time: Must be valid time format (HH:MM:SS)
    - end_time: Must be after start_time
    - capacity: Must be >= total_bookings (cannot reduce below current bookings)
    - location: Must be one of: Mississauga, Vancouver, Montreal, Calgary, Richmond Hill
    - is_active: Boolean only

Response 200 (Success):
{
  "success": true,
  "data": {
    "id": "12345678901",
    "mock_type": "Situational Judgment",
    "exam_date": "2025-02-15",
    "start_time": "09:00:00",
    "end_time": "12:00:00",
    "capacity": 25,
    "total_bookings": 15,
    "available_slots": 10,
    "location": "Mississauga",
    "address": "123 Main St, Mississauga, ON",
    "is_active": true,
    "updated_at": "2025-01-24T11:30:00Z"
  },
  "meta": {
    "timestamp": "2025-01-24T11:30:00Z",
    "updated_by": "admin@prepdoctors.ca",
    "changes": ["capacity", "start_time", "end_time"]
  }
}

Response 400 (Validation Error):
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": {
      "capacity": "Capacity (10) cannot be less than current bookings (15)",
      "end_time": "End time must be after start time"
    }
  }
}

Response 404 (Not Found):
{
  "success": false,
  "error": {
    "code": "EXAM_NOT_FOUND",
    "message": "Mock exam with ID 12345678901 not found"
  }
}

Response 409 (Conflict):
{
  "success": false,
  "error": {
    "code": "BOOKING_CONFLICT",
    "message": "Cannot reduce capacity below current bookings",
    "details": {
      "requested_capacity": 10,
      "current_bookings": 15,
      "minimum_required": 15
    }
  }
}

Response 401 (Unauthorized):
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Valid admin authentication required"
  }
}
```

### Audit Trail - HubSpot Note Creation

**Purpose**: Create a comprehensive audit trail for all mock exam edits by creating a HubSpot note associated with the edited Mock Exam object.

**Implementation Pattern**: Reuse the existing note creation pattern from `user_root/api/_shared/hubspot.js` (lines 1503-1595, 1598-1666).

#### Note Creation Specification

**When to Create Note**: After successfully updating mock exam properties in HubSpot (PATCH operation succeeds).

**Note Association**: Associate the note with the Mock Exam object that was edited.

**Note Content Structure**:
```html
<h3>📝 Mock Exam Updated</h3>

<p><strong>Edit Details:</strong></p>
<ul>
  <li><strong>Mock Exam ID:</strong> {mock_exam_object_id}</li>
  <li><strong>Mock Type:</strong> {mock_type}</li>
  <li><strong>Exam Date:</strong> {formatted_exam_date}</li>
  <li><strong>Updated At:</strong> {timestamp}</li>
  <li><strong>Updated By:</strong> {admin_email or admin_id}</li>
</ul>

<p><strong>Changes Made:</strong></p>
<ul>
  {for each changed field:}
  <li><strong>{field_name}:</strong> {old_value} → {new_value}</li>
</ul>

<hr style="margin: 15px 0; border: 0; border-top: 1px solid #e0e0e0;">
<p style="font-size: 12px; color: #666;">
  <em>This mock exam was updated via the PrepDoctors Admin Dashboard.</em>
</p>
```

**Example Note Body**:
```html
<h3>📝 Mock Exam Updated</h3>

<p><strong>Edit Details:</strong></p>
<ul>
  <li><strong>Mock Exam ID:</strong> 12345678901</li>
  <li><strong>Mock Type:</strong> Situational Judgment</li>
  <li><strong>Exam Date:</strong> Friday, February 15, 2025</li>
  <li><strong>Updated At:</strong> January 24, 2025 at 11:30 AM EST</li>
  <li><strong>Updated By:</strong> admin@prepdoctors.ca</li>
</ul>

<p><strong>Changes Made:</strong></p>
<ul>
  <li><strong>Capacity:</strong> 20 → 25</li>
  <li><strong>Start Time:</strong> 09:00:00 → 10:00:00</li>
  <li><strong>End Time:</strong> 12:00:00 → 13:00:00</li>
</ul>

<hr style="margin: 15px 0; border: 0; border-top: 1px solid #e0e0e0;">
<p style="font-size: 12px; color: #666;">
  <em>This mock exam was updated via the PrepDoctors Admin Dashboard.</em>
</p>
```

#### API Implementation Details

**HubSpot API Endpoint**: `POST /crm/v3/objects/notes`

**Request Payload Structure**:
```json
{
  "properties": {
    "hs_note_body": "<html formatted note content>",
    "hs_timestamp": 1706107800000
  },
  "associations": [
    {
      "to": { "id": "<mock_exam_id>" },
      "types": [
        {
          "associationCategory": "HUBSPOT_DEFINED",
          "associationTypeId": <mock_exam_note_association_type_id>
        }
      ]
    }
  ]
}
```

**Association Type ID**:
- For Mock Exam to Note associations, use the appropriate `associationTypeId`
- Reference pattern from `user_root/api/_shared/hubspot.js` line 1565 (Contact to Note uses `202`)
- You may need to determine the correct association type ID for Mock Exam objects (`2-50158913`)

**Error Handling**:
- Note creation should be non-blocking (async operation)
- If note creation fails, log the error but DO NOT fail the update operation
- The mock exam update should succeed even if note creation fails
- Log note creation failures for monitoring and manual follow-up

**Reference Implementation**:
- File: `user_root/api/_shared/hubspot.js`
- Method: `createBookingNote` (lines 1503-1595)
- Method: `createBookingCancellationNote` (lines 1598-1666)

**Implementation Notes**:
1. Reuse existing HubSpot service methods from shared code
2. Extract and format only the fields that actually changed
3. Use HTML formatting for better readability in HubSpot timeline
4. Include timestamp in both human-readable and machine-readable formats
5. Track admin user who made the change for accountability
6. Log note creation success/failure for audit purposes

### Data Requirements

**HubSpot Properties (Mock Exams `2-50158913`):**

All properties already exist; no schema changes needed.

**Editable Properties:**
- ✅ `mock_type` - Type of exam (dropdown)
- ✅ `exam_date` - Date of session (date picker)
- ✅ `start_time` - Session start time (time picker)
- ✅ `end_time` - Session end time (time picker)
- ✅ `capacity` - Maximum slots (number input)
- ✅ `location` - Physical location (dropdown)
- ✅ `is_active` - Active status (toggle)

**Read-Only Properties (Display Only):**
- `total_bookings` - Cannot be manually edited (auto-incremented)
- `available_slots` - Calculated field (capacity - total_bookings)
- `created_at` - System timestamp
- `updated_at` - System timestamp

**Validation Constraints:**

| Property | Validation Rule |
|----------|----------------|
| mock_type | Required, must be valid enum value |
| exam_date | Required, ISO format, cannot be before today |
| start_time | Required, valid time format (HH:MM:SS) |
| end_time | Required, must be after start_time |
| capacity | Required, integer >= 1, must be >= total_bookings |
| location | Required, must match allowed locations |
| is_active | Boolean |

---

## 🎨 User Interface Design

### Edit Mode Layout

**Default State (Non-editable):**
```
┌──────────────────────────────────────────────────────────┐
│  [← Back to Dashboard]           [Edit] [Dark Mode 🌙]  │
├──────────────────────────────────────────────────────────┤
│  Mock Exam Session Details                               │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Mock Type: [Situational Judgment    ] (grayed)    │ │
│  │  Date:      [February 15, 2025       ] (grayed)    │ │
│  │  Start Time:[9:00 AM                 ] (grayed)    │ │
│  │  End Time:  [12:00 PM                ] (grayed)    │ │
│  │  Capacity:  [20 slots                ] (grayed)    │ │
│  │  Booked:    [15 / 20 slots           ] (read-only) │ │
│  └────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

**Edit Mode State:**
```
┌──────────────────────────────────────────────────────────┐
│  [← Back]                  [Save] [Cancel] [Dark Mode 🌙]│
├──────────────────────────────────────────────────────────┤
│  Editing Mock Exam Session                               │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Mock Type: [Situational Judgment ▼] (enabled)     │ │
│  │  Date:      [📅 February 15, 2025  ] (enabled)     │ │
│  │  Start Time:[🕐 09:00 AM           ] (enabled)     │ │
│  │  End Time:  [🕐 12:00 PM           ] (enabled)     │ │
│  │             ⚠️ Must be after start time             │ │
│  │  Capacity:  [ 20 ]                   (enabled)     │ │
│  │             ℹ️ Cannot be less than 15 (booked)     │ │
│  │  Booked:    [15 / 20 slots           ] (read-only) │ │
│  │  Location:  [Mississauga           ▼] (enabled)    │ │
│  │  Address:   [123 Main St...         ] (enabled)    │ │
│  │  Status:    [🟢 Active    Toggle   ] (enabled)     │ │
│  └────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

**Saving State:**
```
┌──────────────────────────────────────────────────────────┐
│  [← Back]              [💾 Saving...] [Cancel (disabled)]│
├──────────────────────────────────────────────────────────┤
│  Saving Changes...                                       │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  [Form fields disabled during save]                 │ │
│  │  [Loading spinner overlay]                          │ │
│  └────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### Component Specifications

#### 1. Edit/Save/Cancel Button Group

**Location**: Top-right of page (replaces View-only buttons)

**States:**
- **Default**: `[Edit]` button only
- **Edit Mode**: `[Save] [Cancel]` buttons
- **Saving**: `[💾 Saving...]` button (disabled) + disabled Cancel

**Styling:**
- Edit button: Blue background (`bg-primary-600`)
- Save button: Green background (`bg-green-600`)
- Cancel button: Gray outline (`border-gray-400`)
- Saving state: Disabled appearance with spinner

**Behavior:**
- Edit: Enables all editable fields, switches button group
- Save: Validates → Shows errors OR submits → Shows success
- Cancel: Confirms if changes made → Reverts to original values

#### 2. Form Field States

**Visual Indicators:**

**Non-editable (Default):**
- Background: Light gray (`bg-gray-50`)
- Border: None or subtle gray
- Cursor: `not-allowed`
- Text: Regular color

**Editable (Edit Mode):**
- Background: White (`bg-white`)
- Border: Blue on focus (`border-primary-500`)
- Cursor: `text` or `pointer`
- Text: Black with proper contrast

**Error State:**
- Border: Red (`border-red-500`)
- Background: Light red (`bg-red-50`)
- Icon: ⚠️ next to field
- Message: Red text below field

**Success State (after save):**
- Brief green highlight animation
- Success toast notification
- Return to non-editable state

#### 3. Inline Validation Messages

**Location**: Directly below each field with validation

**Types:**

**Error Messages (Red):**
```
⚠️ Capacity cannot be less than current bookings (15)
⚠️ End time must be after start time
⚠️ Exam date cannot be in the past
```

**Info Messages (Blue):**
```
ℹ️ Currently 15 bookings for this session
ℹ️ Time must be in HH:MM AM/PM format
```

**Success Messages (Green):**
```
✅ Changes saved successfully
```

#### 4. Confirmation Dialogs

**Unsaved Changes Warning:**
```
┌─────────────────────────────────────────────┐
│  ⚠️  Unsaved Changes                        │
│                                             │
│  You have unsaved changes. Are you sure     │
│  you want to leave without saving?          │
│                                             │
│  [Discard Changes]    [Continue Editing]    │
└─────────────────────────────────────────────┘
```

**Save Confirmation (Optional):**
```
┌─────────────────────────────────────────────┐
│  ✅ Success                                  │
│                                             │
│  Mock exam updated successfully!            │
│                                             │
│              [OK]                           │
└─────────────────────────────────────────────┘
```

---

## 🔄 User Flow

### Happy Path: Edit and Save

**Step 1: Enter Edit Mode**
```
User is on Mock Exam Detail View page
→ Clicks "Edit" button in top-right
→ Page transitions to edit mode (< 500ms)
→ All editable fields become enabled
→ Buttons change to "Save" and "Cancel"
→ Focus moves to first editable field
```

**Step 2: Make Changes**
```
User modifies fields
→ Real-time validation provides feedback
→ Invalid entries show error messages immediately
→ User can navigate between fields
→ Changes are tracked internally
```

**Step 3: Attempt to Save**
```
User clicks "Save" button
→ Client-side validation runs
→ All fields validated simultaneously
→ IF errors exist:
  → Scroll to first error
  → Show error messages
  → Prevent submission
  → Keep edit mode active
→ IF validation passes:
  → Continue to Step 4
```

**Step 4: Submit Changes**
```
Form submits to backend
→ Buttons disabled (prevent double-submit)
→ "Saving..." indicator shows
→ PATCH request sent to /api/admin/mock-exams/:id
→ Backend validates and updates HubSpot
→ Response received
```

**Step 5: Success Handling**
```
Save successful (200 response)
→ Show success toast notification
→ Update local state with new data (optimistic UI)
→ Invalidate relevant caches
→ Return form to non-editable state
→ Buttons revert to "Edit" only
→ Brief success animation on form
```

### Alternative Flows

#### Cancel Without Changes
```
User clicks "Edit"
→ Makes no changes
→ Clicks "Cancel"
→ Immediately revert to view mode (no confirmation needed)
```

#### Cancel With Changes
```
User clicks "Edit"
→ Modifies fields
→ Clicks "Cancel"
→ Show confirmation dialog: "You have unsaved changes..."
→ User chooses:
  → "Discard Changes": Revert all fields, exit edit mode
  → "Continue Editing": Close dialog, stay in edit mode
```

#### Validation Errors
```
User clicks "Edit"
→ Changes capacity from 20 to 10
→ Current bookings = 15
→ Clicks "Save"
→ Client validation catches error:
  "Capacity (10) cannot be less than current bookings (15)"
→ Field shows red border
→ Error message appears below field
→ Focus returns to capacity field
→ User corrects to 20 or higher
→ Error clears immediately
→ User can save successfully
```

#### Network/Server Error
```
User makes valid changes
→ Clicks "Save"
→ Network request fails (timeout, 500 error, etc.)
→ Show error toast: "Failed to save changes. Please try again."
→ Keep form in edit mode with changes intact
→ Enable "Save" and "Cancel" buttons
→ User can retry or cancel
```

#### Concurrent Update Conflict
```
User A opens exam detail page
→ User A clicks "Edit"
→ Meanwhile, User B updates same exam in HubSpot
→ User A clicks "Save"
→ Backend detects conflict (updated_at timestamp changed)
→ Return 409 Conflict response
→ Show message: "This exam was updated by another user. Please refresh to see latest data."
→ Provide "Refresh" button
→ Keep current changes in memory (optional: allow merge)
```

#### Page Refresh with Unsaved Changes
```
User is in edit mode with changes
→ User attempts to refresh page or navigate away
→ Browser shows built-in warning: "Changes you made may not be saved"
→ User chooses to stay
→ Edit mode preserved with current changes
```

---

## 🚀 Implementation Plan

### Phase 1: Backend API Development (Days 1-2)
**Timeline**: 2 days  
**Priority**: Critical

**Tasks:**

1.1. Update API endpoint: `PATCH /api/admin/mock-exams/:id`
- [ ] Add PATCH method handler to existing `[id].js` file
- [ ] Implement request body validation (Joi schema)
- [ ] Add business logic validation (capacity >= bookings, end_time > start_time)
- [ ] Create error response formatting

1.2. Update service layer: `mockExamDetailsService.js`
- [ ] Create `updateMockExam(id, updates)` method
- [ ] Implement HubSpot PATCH API call
- [ ] Add optimistic locking (check updated_at timestamp)
- [ ] Handle partial updates (only changed fields)
- [ ] Add audit logging (create HubSpot note on Mock Exam - see "Audit Trail - HubSpot Note Creation" section)

1.3. Implement cache invalidation
- [ ] Invalidate exam detail cache on update
- [ ] Invalidate exam list cache on update
- [ ] Invalidate metrics cache if relevant
- [ ] Test cache behavior

1.4. Write comprehensive tests
- [ ] Unit tests for validation logic
- [ ] Unit tests for update service method
- [ ] Integration tests for API endpoint
- [ ] Test error scenarios (404, 400, 409)
- [ ] Test concurrent update handling

**Deliverables:**
- ✅ Working PATCH endpoint with full validation
- ✅ Service layer update method
- ✅ Cache invalidation logic
- ✅ > 85% test coverage

### Phase 2: Frontend Edit State Management (Days 3-4)
**Timeline**: 2 days  
**Priority**: Critical

**Tasks:**

2.1. Create edit state hook: `useExamEdit.js`
- [ ] Implement edit mode toggle
- [ ] Track form changes (dirty state)
- [ ] Handle form submission
- [ ] Manage loading/error states
- [ ] Implement optimistic updates

2.2. Create validation hook: `useFormValidation.js`
- [ ] Real-time field validation
- [ ] Cross-field validation (start_time < end_time)
- [ ] Async validation (capacity check)
- [ ] Error message management
- [ ] Validation on blur and submit

2.3. Create validation utility: `examValidation.js`
- [ ] Validation rules for each field
- [ ] Error message templates
- [ ] Custom validators (date, time, capacity)
- [ ] Export reusable validation functions

2.4. Write tests for hooks and utilities
- [ ] Test edit state transitions
- [ ] Test validation rules
- [ ] Test edge cases
- [ ] Test error handling

**Deliverables:**
- ✅ Reusable edit state management hook
- ✅ Comprehensive validation system
- ✅ > 80% test coverage for hooks

### Phase 3: Frontend UI Components (Days 4-5)
**Timeline**: 2 days  
**Priority**: High

**Tasks:**

3.1. Modify `MockExamDetail.jsx`
- [ ] Integrate edit state hook
- [ ] Add edit mode toggle logic
- [ ] Implement unsaved changes warning
- [ ] Handle save success/error
- [ ] Add loading states

3.2. Modify `ExamDetailsForm.jsx`
- [ ] Add editable/non-editable states
- [ ] Implement field enable/disable logic
- [ ] Add visual state indicators
- [ ] Integrate validation messages
- [ ] Make form responsive in edit mode

3.3. Create `EditControls.jsx` component
- [ ] Edit/Save/Cancel button group
- [ ] Button state management
- [ ] Loading indicators
- [ ] Accessibility (keyboard shortcuts)

3.4. Create `ValidationMessage.jsx` component
- [ ] Error message display
- [ ] Info message display
- [ ] Icon rendering
- [ ] Accessibility (ARIA labels)

3.5. Implement confirmation dialogs
- [ ] Unsaved changes dialog
- [ ] Save success notification (toast)
- [ ] Error notification (toast)

3.6. Style all components
- [ ] Tailwind CSS classes
- [ ] Dark mode support
- [ ] Responsive design
- [ ] Animations and transitions

**Deliverables:**
- ✅ Fully functional edit UI
- ✅ Polished user experience
- ✅ Mobile responsive
- ✅ Accessibility compliant

### Phase 4: Integration & Testing (Days 6-7)
**Timeline**: 2 days  
**Priority**: High

**Tasks:**

4.1. Integration testing
- [ ] Test full edit → save flow
- [ ] Test validation behavior
- [ ] Test error handling
- [ ] Test cancel behavior
- [ ] Test concurrent updates
- [ ] Test cache invalidation

4.2. E2E testing
- [ ] Write Playwright/Cypress tests
- [ ] Test all user flows
- [ ] Test edge cases
- [ ] Test mobile behavior

4.3. Performance testing
- [ ] Test edit mode transition speed
- [ ] Test save operation latency
- [ ] Test with slow network
- [ ] Optimize if needed

4.4. Cross-browser testing
- [ ] Chrome, Firefox, Safari, Edge
- [ ] Mobile browsers
- [ ] Fix compatibility issues

4.5. Accessibility audit
- [ ] Keyboard navigation
- [ ] Screen reader testing
- [ ] Color contrast verification
- [ ] ARIA labels verification

**Deliverables:**
- ✅ All integration tests passing
- ✅ E2E test suite complete
- ✅ Performance benchmarks met
- ✅ WCAG 2.1 AA compliant

### Phase 5: Documentation & Deployment (Day 8)
**Timeline**: 1 day  
**Priority**: Medium

**Tasks:**

5.1. Update documentation
- [ ] API endpoint documentation
- [ ] Admin user guide
- [ ] Code comments
- [ ] Inline help text

5.2. Create training materials
- [ ] Video walkthrough (optional)
- [ ] Screenshot guide
- [ ] FAQ for common issues

5.3. Deploy to staging
- [ ] Test in staging environment
- [ ] Verify environment variables
- [ ] Run smoke tests
- [ ] Get stakeholder approval

5.4. Deploy to production
- [ ] Schedule deployment window
- [ ] Deploy backend updates
- [ ] Deploy frontend updates
- [ ] Run post-deployment checks
- [ ] Monitor for errors

5.5. Post-launch monitoring
- [ ] Monitor error logs
- [ ] Track usage metrics
- [ ] Gather user feedback
- [ ] Fix critical issues immediately

**Deliverables:**
- ✅ Complete documentation
- ✅ Successfully deployed to production
- ✅ Monitoring in place

---

## 🧪 Testing Strategy

### Unit Tests

**Backend Tests:**
```javascript
describe('PATCH /api/admin/mock-exams/:id', () => {
  it('should update exam properties', async () => {
    const updates = { capacity: 25 };
    const response = await request(app)
      .patch('/api/admin/mock-exams/12345')
      .set('Authorization', 'Bearer valid-token')
      .send(updates);
    
    expect(response.status).toBe(200);
    expect(response.body.data.capacity).toBe(25);
  });

  it('should reject capacity less than bookings', async () => {
    const updates = { capacity: 5 }; // Less than 15 bookings
    const response = await request(app)
      .patch('/api/admin/mock-exams/12345')
      .send(updates);
    
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('BOOKING_CONFLICT');
  });

  it('should validate end_time after start_time', async () => {
    const updates = {
      start_time: '14:00:00',
      end_time: '13:00:00'
    };
    const response = await request(app)
      .patch('/api/admin/mock-exams/12345')
      .send(updates);
    
    expect(response.status).toBe(400);
    expect(response.body.error.details.end_time).toBeTruthy();
  });

  it('should invalidate cache after update', async () => {
    await request(app)
      .patch('/api/admin/mock-exams/12345')
      .send({ capacity: 25 });
    
    const cacheValue = await cache.get('exam:12345');
    expect(cacheValue).toBeNull();
  });
});

describe('mockExamDetailsService.updateMockExam', () => {
  it('should call HubSpot API with correct payload', async () => {
    const updates = { capacity: 25 };
    await service.updateMockExam('12345', updates);
    
    expect(hubspotApiCall).toHaveBeenCalledWith(
      'patch',
      expect.stringContaining('/objects/2-50158913/12345'),
      expect.objectContaining({ properties: updates })
    );
  });

  it('should handle HubSpot API errors', async () => {
    hubspotApiCall.mockRejectedValue(new Error('HubSpot error'));
    
    await expect(
      service.updateMockExam('12345', { capacity: 25 })
    ).rejects.toThrow('HubSpot error');
  });
});
```

**Frontend Tests:**
```javascript
describe('useExamEdit hook', () => {
  it('should toggle edit mode', () => {
    const { result } = renderHook(() => useExamEdit(mockData));
    
    act(() => {
      result.current.toggleEdit();
    });
    
    expect(result.current.isEditing).toBe(true);
  });

  it('should track form changes', () => {
    const { result } = renderHook(() => useExamEdit(mockData));
    
    act(() => {
      result.current.updateField('capacity', 25);
    });
    
    expect(result.current.isDirty).toBe(true);
    expect(result.current.formData.capacity).toBe(25);
  });

  it('should validate fields on change', () => {
    const { result } = renderHook(() => useExamEdit(mockData));
    
    act(() => {
      result.current.updateField('capacity', 5); // Less than bookings
    });
    
    expect(result.current.errors.capacity).toBeTruthy();
  });

  it('should handle save success', async () => {
    const { result } = renderHook(() => useExamEdit(mockData));
    mockApi.updateExam.mockResolvedValue({ success: true });
    
    await act(async () => {
      await result.current.save();
    });
    
    expect(result.current.isEditing).toBe(false);
    expect(result.current.isDirty).toBe(false);
  });
});

describe('ExamDetailsForm component', () => {
  it('should render in non-editable mode by default', () => {
    render(<ExamDetailsForm data={mockData} isEditing={false} />);
    
    const inputs = screen.getAllByRole('textbox');
    inputs.forEach(input => {
      expect(input).toBeDisabled();
    });
  });

  it('should enable fields in edit mode', () => {
    render(<ExamDetailsForm data={mockData} isEditing={true} />);
    
    const capacityInput = screen.getByLabelText(/capacity/i);
    expect(capacityInput).not.toBeDisabled();
  });

  it('should display validation errors', () => {
    const errors = { capacity: 'Cannot be less than bookings' };
    render(
      <ExamDetailsForm 
        data={mockData} 
        isEditing={true} 
        errors={errors} 
      />
    );
    
    expect(screen.getByText(/cannot be less than bookings/i)).toBeInTheDocument();
  });
});

describe('EditControls component', () => {
  it('should show Edit button when not editing', () => {
    render(<EditControls isEditing={false} />);
    expect(screen.getByText(/edit/i)).toBeInTheDocument();
  });

  it('should show Save and Cancel when editing', () => {
    render(<EditControls isEditing={true} />);
    expect(screen.getByText(/save/i)).toBeInTheDocument();
    expect(screen.getByText(/cancel/i)).toBeInTheDocument();
  });

  it('should disable buttons while saving', () => {
    render(<EditControls isEditing={true} isSaving={true} />);
    
    const saveButton = screen.getByText(/saving/i);
    expect(saveButton).toBeDisabled();
  });
});
```

### Integration Tests

```javascript
describe('Mock Exam Edit Integration', () => {
  it('should complete full edit flow', async () => {
    // 1. Navigate to detail page
    const { user } = setup();
    await navigateToExamDetail('12345');
    
    // 2. Click Edit button
    await user.click(screen.getByText(/edit/i));
    expect(screen.getByText(/save/i)).toBeInTheDocument();
    
    // 3. Modify capacity
    const capacityInput = screen.getByLabelText(/capacity/i);
    await user.clear(capacityInput);
    await user.type(capacityInput, '25');
    
    // 4. Click Save
    await user.click(screen.getByText(/save/i));
    
    // 5. Verify success
    await waitFor(() => {
      expect(screen.getByText(/saved successfully/i)).toBeInTheDocument();
    });
    
    // 6. Verify UI updated
    expect(screen.getByText(/25 slots/i)).toBeInTheDocument();
  });

  it('should handle validation errors', async () => {
    const { user } = setup();
    await navigateToExamDetail('12345');
    
    await user.click(screen.getByText(/edit/i));
    
    // Set invalid capacity
    const capacityInput = screen.getByLabelText(/capacity/i);
    await user.clear(capacityInput);
    await user.type(capacityInput, '5'); // Less than 15 bookings
    
    await user.click(screen.getByText(/save/i));
    
    // Should show error, not save
    expect(screen.getByText(/cannot be less than/i)).toBeInTheDocument();
    expect(screen.getByText(/save/i)).toBeInTheDocument(); // Still in edit mode
  });

  it('should confirm before discarding changes', async () => {
    const { user } = setup();
    await navigateToExamDetail('12345');
    
    await user.click(screen.getByText(/edit/i));
    
    // Make changes
    await user.type(screen.getByLabelText(/capacity/i), '25');
    
    // Click Cancel
    await user.click(screen.getByText(/cancel/i));
    
    // Should show confirmation
    expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument();
    
    // Discard changes
    await user.click(screen.getByText(/discard/i));
    
    // Should exit edit mode
    expect(screen.queryByText(/save/i)).not.toBeInTheDocument();
  });
});
```

### Manual Testing Checklist

**Functional Tests:**
- [ ] Click Edit button → fields become editable
- [ ] Modify each field → changes reflected in form state
- [ ] Click Save with valid data → updates persist
- [ ] Click Save with invalid data → shows errors, prevents save
- [ ] Click Cancel without changes → exits edit mode immediately
- [ ] Click Cancel with changes → shows confirmation dialog
- [ ] Make change → refresh page → shows unsaved changes warning
- [ ] Reduce capacity below bookings → shows validation error
- [ ] Set end_time before start_time → shows validation error
- [ ] Save successfully → see success notification
- [ ] Save fails → see error notification, stay in edit mode

**Performance Tests:**
- [ ] Edit mode activates in < 500ms
- [ ] Field validation responds in < 100ms
- [ ] Save operation completes in < 3 seconds
- [ ] Optimistic UI update feels instant

**Accessibility Tests:**
- [ ] Tab through all fields in logical order
- [ ] Press Enter to save from any field
- [ ] Press Escape to cancel edit mode
- [ ] Screen reader announces field states
- [ ] Error messages have proper ARIA labels
- [ ] Color contrast meets WCAG AA standards

**Responsive Tests:**
- [ ] Mobile (375px): All fields accessible and usable
- [ ] Tablet (768px): Comfortable editing experience
- [ ] Desktop (1280px+): Optimal layout

---

## 🔒 Security Considerations

### Authentication & Authorization
- Only authenticated admin users can access edit functionality
- Log all update operations with user ID and timestamp
- Implement rate limiting to prevent abuse (50 updates/min per user)

### Input Validation
- Server-side validation is mandatory (never trust client)
- Sanitize all string inputs to prevent XSS
- Validate data types strictly (string, number, boolean, date)
- Reject requests with unexpected properties
- Use parameterized queries to prevent injection attacks

### Data Integrity
- Implement optimistic locking (check updated_at timestamp)
- Prevent concurrent edits from overwriting each other
- Validate capacity >= total_bookings server-side
- Log all changes for audit trail (create HubSpot note with before/after values - see "Audit Trail - HubSpot Note Creation" section)
- Implement rollback mechanism for failed updates

### Error Handling
- Never expose internal error details to client
- Log detailed errors server-side for debugging
- Return generic error messages to users
- Rate limit error responses to prevent enumeration attacks

---

## 📊 Success Metrics

### Performance Metrics
- **Edit Mode Activation**: < 500ms (target: 300ms)
- **Field Validation**: < 100ms per field
- **Save Operation**: < 3 seconds (target: 2 seconds)
- **Cache Invalidation**: < 1 second

### User Experience Metrics
- **Time to Complete Edit**: < 60 seconds (vs 5 minutes manual)
- **Error Rate**: < 5% of save attempts
- **Abandon Rate**: < 10% (users who enter edit mode but cancel)
- **User Satisfaction**: > 4.0/5.0 rating

### Business Metrics (Track Post-Launch)
- Number of exams edited per day
- Average time saved per edit operation
- Reduction in HubSpot direct access
- Reduction in support tickets for exam updates
- Number of validation errors caught (preventing bad data)

### Technical Metrics
- API response time (P50, P95, P99)
- Error rate (target: < 1%)
- Cache hit rate (target: > 80%)
- Concurrent update conflicts (monitor frequency)

---

## 🔄 Future Enhancements

### Phase 2 Features (Post-MVP)
1. **Batch Edit**: Edit multiple exams simultaneously
2. **Version History**: View and rollback previous changes
3. **Draft Mode**: Save changes as draft before publishing
4. **Approval Workflow**: Require approval for certain changes
5. **Change Notifications**: Email admins when exams are updated
6. **Conflict Resolution**: Visual diff view for concurrent edits
7. **Keyboard Shortcuts**: Save with Ctrl+S, cancel with Esc
8. **Auto-save Draft**: Save changes automatically every 30 seconds

### Long-term Improvements
1. **Undo/Redo**: Support for multi-step undo/redo
2. **Bulk Operations**: Copy settings from one exam to others
3. **Templates**: Save exam configurations as templates
4. **Smart Validation**: Suggest corrections for invalid inputs
5. **Mobile App**: Native mobile app with offline edit capability
6. **Real-time Collaboration**: See who else is viewing/editing

---

## 📝 Open Questions

1. **Permission Granularity**: Should some admins have read-only access?
   - **Recommendation**: Implement role-based permissions in Phase 2

2. **Audit Logging**: What level of detail should we log?
   - **Resolution**: Log all changes with before/after values via HubSpot notes (see "Audit Trail - HubSpot Note Creation" section for complete specification)

3. **Booking Impact**: Should we notify students when exam details change?
   - **Recommendation**: Add notification system in Phase 2

4. **Capacity Reduction**: What if admin needs to reduce capacity below bookings?
   - **Recommendation**: Block in MVP, add force-reduction with warning in Phase 2

5. **Multi-field Validation**: Should we validate all fields on every change?
   - **Recommendation**: Validate on blur + validate all before save

---

## 📚 References

### Related Documentation
- [Mock Exam Detail View PRD](./prd_mock_exam_detail_view.md) - Prerequisite feature
- [Mock Exam Booking System README](documentation/MOCKS_BOOKING_README.md)
- [Admin Dashboard Architecture](documentation/CURRENT_APP_STATE.md)
- [HubSpot API Integration Guide](documentation/api/README.md)

### External Resources
- [HubSpot Objects API - Update](https://developers.hubspot.com/docs/api/crm/objects)
- [React Hook Form - Validation](https://react-hook-form.com/get-started#Applyvalidation)
- [Optimistic UI Updates Best Practices](https://www.apollographql.com/docs/react/performance/optimistic-ui/)
- [Form Validation UX Patterns](https://www.nngroup.com/articles/errors-forms-design-guidelines/)

---

## ✅ Approval & Sign-off

### Stakeholder Approval

| Role | Name | Approval Date | Status |
|------|------|---------------|--------|
| Product Owner | H | Pending | ⏳ |
| Tech Lead | H | Pending | ⏳ |
| Admin Operations | TBD | Pending | ⏳ |
| UX Lead | TBD | Pending | ⏳ |

### Development Sign-off

- [ ] PRD reviewed by development team
- [ ] Technical approach validated
- [ ] Dependencies identified (Mock Exam Detail View complete)
- [ ] Complexity estimated (T-shirt size: M)
- [ ] Ready for implementation

### Pre-Implementation Checklist

- [ ] Mock Exam Detail View feature complete (dependency)
- [ ] Design mockups approved
- [ ] API specifications finalized
- [ ] Test scenarios documented
- [ ] Timeline approved by stakeholders

---

*PRD Version: 1.0 | Created: January 24, 2025 | Framework: PrepDoctors HubSpot Automation*
*Depends On: Mock Exam Detail View (PRD v1.0)*