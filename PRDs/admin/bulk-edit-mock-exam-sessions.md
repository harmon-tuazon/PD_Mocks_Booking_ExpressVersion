# PRD: Bulk Edit Mock Exam Sessions

**Status**: Draft
**Created**: 2025-01-14
**Last Updated**: 2025-01-14
**Author**: Claude Code
**Confidence Score**: 9/10

---

## 1. Feature Overview

### Purpose
Enable administrators to efficiently edit properties of multiple mock exam sessions simultaneously from the main Mock Exams Dashboard, reducing the time required to update multiple sessions with common property changes.

### Problem Statement
Currently, administrators must individually navigate to each mock exam session's detail page to make property updates. When managing dozens of sessions (e.g., changing location for all sessions in a date range, increasing capacity for multiple sessions), this process is time-consuming and error-prone.

### Solution
Implement a bulk edit modal that allows administrators to select multiple sessions from the dashboard and update shared properties (location, mock type, capacity, exam date, start time, end time, scheduled activation datetime) in a single operation using HubSpot's Batch Update API.

### Success Metrics
- **Time Savings**: 85% reduction in time to update 10+ sessions (from ~5 minutes to <45 seconds)
- **Error Reduction**: 50% fewer incorrect property values due to manual entry errors
- **API Efficiency**: Single batch API call vs. N individual calls
- **User Adoption**: 70% of admins use bulk edit within first month

---

## 2. User Stories

### Primary User Story
**As an** administrator managing mock exam sessions
**I want to** edit properties of multiple sessions at once
**So that** I can efficiently apply common changes without repetitive individual edits

### Detailed User Scenarios

#### Scenario 1: Location Change
> "The Mississauga - Lab D location is temporarily unavailable. I need to move all 15 upcoming Clinical Skills sessions to Mississauga - B9."
- **Current**: Navigate to 15 individual session pages, edit location, save each
- **With Feature**: Select 15 sessions, click "Bulk Edit", change location to "Mississauga - B9", confirm

#### Scenario 2: Capacity Adjustment
> "We've hired additional instructors and can now increase capacity for all Mini-mock sessions in February from 8 to 12."
- **Current**: Navigate to each session, update capacity field, save
- **With Feature**: Filter by Mini-mock + date range, select all, increase capacity to 12, confirm

#### Scenario 3: Time Standardization
> "All online sessions should start at 9:00 AM instead of varying times for consistency."
- **Current**: Edit each session individually
- **With Feature**: Filter by Online location, select sessions, change start_time to "09:00", confirm

#### Scenario 4: Scheduled Activation
> "I need to schedule 20 future sessions to automatically activate on specific dates."
- **Current**: Edit each session's scheduled_activation_datetime individually
- **With Feature**: Select sessions, set is_active to "Scheduled", set activation datetime, confirm

---

## 3. Functional Requirements

### 3.1 Selection Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-1.1 | Reuse existing bulk selection mechanism from Toggle/Delete features | MUST | Use `useBulkSelection` hook |
| FR-1.2 | Support selecting 1-100 sessions for bulk edit | MUST | HubSpot batch API limit |
| FR-1.3 | Display "Bulk Edit" button in `MockExamsSelectionToolbar` when 1+ sessions selected | MUST | Adjacent to Toggle Active and Delete |
| FR-1.4 | Button disabled during submission (`isSubmitting` state) | MUST | Prevent double-submission |
| FR-1.5 | Support bulk edit in both List View and Aggregate View | MUST | Maintain consistency |

### 3.2 Modal UI Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-2.1 | Use Headless UI Dialog with Transition animations | MUST | Match existing modal patterns |
| FR-2.2 | Display pencil/edit icon in blue circular background | MUST | Visual consistency (`PencilSquareIcon`) |
| FR-2.3 | Show selected session count in modal header | MUST | "Edit X sessions" |
| FR-2.4 | Display editable fields in a form layout | MUST | See section 3.3 |
| FR-2.5 | Show validation errors inline per field | MUST | Red text with ExclamationCircleIcon |
| FR-2.6 | Include numeric confirmation input field | MUST | User types session count to confirm |
| FR-2.7 | Show preview of first 10 sessions in scrollable table | SHOULD | Type, Date, Location, Current Values |
| FR-2.8 | Display warning about unchanged fields | MUST | "Fields left blank will not be updated" |
| FR-2.9 | Support ESC key to close (when not submitting) | MUST | Accessibility |
| FR-2.10 | Show loading spinner during API call | MUST | "Updating X sessions..." |

### 3.3 Editable Fields

| Field | Input Type | Required | Validation | Default State |
|-------|-----------|----------|------------|---------------|
| `location` | Select Dropdown | Optional | One of valid locations | Empty (unchanged) |
| `mock_type` | Select Dropdown | Optional | One of valid types | Empty (unchanged) |
| `capacity` | Number Input | Optional | Integer 1-100, cannot be less than any session's `total_bookings` | Empty (unchanged) |
| `exam_date` | Date Picker | Optional | YYYY-MM-DD format, valid date | Empty (unchanged) |
| `start_time` | Time Picker | Optional | HH:MM (24-hour), must be before `end_time` | Empty (unchanged) |
| `end_time` | Time Picker | Optional | HH:MM (24-hour), must be after `start_time` | Empty (unchanged) |
| `is_active` | Select Dropdown | Optional | 'active', 'inactive', 'scheduled' | Empty (unchanged) |
| `scheduled_activation_datetime` | DateTime Picker | Conditional | Required if `is_active='scheduled'`, must be future | Empty (unchanged) |

**Field Behavior**:
- **Empty/Blank fields**: Do NOT update that property (leave unchanged)
- **Populated fields**: Update property to new value for ALL selected sessions
- **Conditional fields**: `scheduled_activation_datetime` only shown/required when `is_active='scheduled'`

### 3.4 Validation Requirements

| ID | Requirement | Priority | Validation Rule |
|----|-------------|----------|-----------------|
| FR-4.1 | At least ONE field must be populated | MUST | Error: "Please update at least one field" |
| FR-4.2 | `end_time` must be after `start_time` when both provided | MUST | Error: "End time must be after start time" |
| FR-4.3 | `capacity` must be ≥ `total_bookings` for each session | MUST | Show count of sessions that will fail |
| FR-4.4 | `scheduled_activation_datetime` required when `is_active='scheduled'` | MUST | Error: "Scheduled activation required" |
| FR-4.5 | `scheduled_activation_datetime` must be in future | MUST | Error: "Must be a future date" |
| FR-4.6 | `exam_date` must be valid calendar date | MUST | Standard date validation |
| FR-4.7 | Time fields must match `HH:MM` format (24-hour) | MUST | Standard time validation |
| FR-4.8 | Confirmation input must equal selected session count | MUST | Disable confirm button until valid |

### 3.5 Backend Requirements

| ID | Requirement | Priority | Details |
|----|-------------|----------|---------|
| FR-5.1 | Create `POST /api/admin/mock-exams/bulk-update` endpoint | MUST | Accept `sessionIds` + property updates |
| FR-5.2 | Use HubSpot Batch Read API to fetch current state | MUST | `POST /crm/v3/objects/{objectType}/batch/read` |
| FR-5.3 | Validate each session against business rules | MUST | Capacity ≥ bookings, time logic |
| FR-5.4 | Auto-regenerate `mock_exam_name` when components change | MUST | If `mock_type`, `location`, or `exam_date` updated |
| FR-5.5 | Handle timestamp conversion for time fields | MUST | Reuse `convertToTimestamp()` from `hubspot.js` |
| FR-5.6 | Use HubSpot Batch Update API in chunks of 100 | MUST | `POST /crm/v3/objects/{objectType}/batch/update` |
| FR-5.7 | Handle partial failures gracefully | MUST | Return successful + failed session IDs with reasons |
| FR-5.8 | Create audit trail notes for updated sessions | SHOULD | Non-blocking async operation |
| FR-5.9 | Invalidate all relevant cache patterns | MUST | List, aggregates, details, metrics |
| FR-5.10 | Respond within 55 seconds (Vercel timeout buffer) | MUST | Handle timeouts gracefully |

---

## 4. Technical Specifications

### 4.1 Frontend Architecture

#### New Component: `BulkEditModal.jsx`

**Location**: `admin_root/admin_frontend/src/components/admin/BulkEditModal.jsx`

**Props Interface**:
```typescript
interface BulkEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSessions: Session[];
  onSuccess: () => void;
}
```

**State Management**:
```javascript
const [formData, setFormData] = useState({
  location: '',
  mock_type: '',
  capacity: '',
  exam_date: '',
  start_time: '',
  end_time: '',
  is_active: '',
  scheduled_activation_datetime: ''
});
const [confirmationInput, setConfirmationInput] = useState('');
const [validationErrors, setValidationErrors] = useState({});
```

**Component Structure**:
```jsx
<BulkEditModal>
  <Dialog.Panel>
    {/* Header */}
    <ModalHeader icon={PencilSquareIcon} title="Bulk Edit Sessions" />

    {/* Session Count */}
    <SessionCount count={selectedSessions.length} />

    {/* Edit Form */}
    <EditForm>
      <SelectField name="location" options={LOCATIONS} />
      <SelectField name="mock_type" options={MOCK_TYPES} />
      <NumberField name="capacity" min={1} max={100} />
      <DateField name="exam_date" />
      <TimeField name="start_time" />
      <TimeField name="end_time" />
      <SelectField name="is_active" options={ACTIVE_STATES} />
      {formData.is_active === 'scheduled' && (
        <DateTimeField name="scheduled_activation_datetime" />
      )}
    </EditForm>

    {/* Validation Warnings */}
    <ValidationWarnings sessions={sessionsFailingValidation} />

    {/* Session Preview Table */}
    <SessionPreviewTable sessions={selectedSessions.slice(0, 10)} />

    {/* Info Message */}
    <InfoBox message="Fields left blank will not be updated" />

    {/* Confirmation Input */}
    <ConfirmationInput
      value={confirmationInput}
      requiredValue={validSessionCount}
      onChange={setConfirmationInput}
    />

    {/* Actions */}
    <ModalActions>
      <CancelButton onClick={onClose} disabled={isSubmitting} />
      <ConfirmButton
        onClick={handleSubmit}
        disabled={!isConfirmationValid || isSubmitting}
        text={isSubmitting ? "Updating..." : `Update ${validSessionCount} Sessions`}
      />
    </ModalActions>
  </Dialog.Panel>
</BulkEditModal>
```

#### New Hook: `useBulkEdit.js`

**Location**: `admin_root/admin_frontend/src/hooks/useBulkEdit.js`

**Implementation**:
```javascript
const useBulkEdit = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sessionIds, updates }) => {
      const response = await adminApi.post('/admin/mock-exams/bulk-update', {
        sessionIds,
        updates
      });
      return response.data;
    },

    onSuccess: (data) => {
      const { summary } = data;

      // Show success toast
      if (summary.updated > 0) {
        toast.success(
          `✓ Successfully updated ${summary.updated} of ${summary.total} session(s)`,
          { duration: 5000 }
        );
      }

      // Show partial failure warning
      if (summary.failed > 0) {
        toast.error(
          `⚠️ ${summary.failed} session(s) failed validation and were not updated`,
          { duration: 8000 }
        );
      }

      // Invalidate queries
      queryClient.invalidateQueries(['mock-exams']);
      queryClient.invalidateQueries(['mock-exams-list']);
      queryClient.invalidateQueries(['mock-exam-aggregates']);
      queryClient.invalidateQueries(['aggregates']);
      queryClient.invalidateQueries(['metrics']);
    },

    onError: (error) => {
      const message = error?.response?.data?.error?.message || 'Failed to update sessions';
      toast.error(`✗ Bulk Update Failed: ${message}`);
    }
  });
};
```

#### Update: `MockExamsSelectionToolbar.jsx`

**Add new prop and button**:
```jsx
<MockExamsSelectionToolbar
  // ... existing props
  onBulkEdit={handleBulkEdit}  // NEW
>
  {/* Existing buttons */}
  <ToggleActiveButton ... />
  <DeleteButton ... />

  {/* NEW: Bulk Edit Button */}
  <button
    onClick={onBulkEdit}
    disabled={isSubmitting}
    className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md border-2 border-blue-600 text-blue-600 bg-white hover:bg-blue-50 transition-colors disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-300 disabled:cursor-not-allowed"
  >
    {isSubmitting ? (
      <LoadingSpinner />
    ) : (
      <PencilSquareIcon className="h-5 w-5 mr-2" />
    )}
    Bulk Edit
  </button>

  <ExitButton ... />
</MockExamsSelectionToolbar>
```

#### Update: `MockExamsDashboard.jsx`

**Add state and handlers**:
```javascript
// State for bulk edit modal
const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);

// Handler for opening bulk edit modal
const handleBulkEdit = useCallback(() => {
  setIsBulkEditModalOpen(true);
}, []);

// Handler for successful bulk edit
const handleBulkEditSuccess = useCallback(() => {
  setIsBulkEditModalOpen(false);
  bulkSelection.exitToView();
}, [bulkSelection]);

// Render modal
<BulkEditModal
  isOpen={isBulkEditModalOpen}
  onClose={() => setIsBulkEditModalOpen(false)}
  selectedSessions={bulkSelection.selectedSessions}
  onSuccess={handleBulkEditSuccess}
/>
```

---

### 4.2 Backend Architecture

#### New Endpoint: `bulk-update.js`

**Location**: `admin_root/api/admin/mock-exams/bulk-update.js`

**Request Schema** (validation.js):
```javascript
bulkUpdate: Joi.object({
  sessionIds: Joi.array()
    .items(Joi.string().pattern(/^\d+$/))
    .min(1)
    .max(100)
    .required()
    .messages({
      'array.min': 'At least one session ID is required',
      'array.max': 'Cannot update more than 100 sessions at once'
    }),

  updates: Joi.object({
    location: Joi.string().valid(
      'Mississauga', 'Mississauga - B9', 'Mississauga - Lab D',
      'Calgary', 'Vancouver', 'Montreal', 'Richmond Hill', 'Online'
    ).optional().allow(''),

    mock_type: Joi.string().valid(
      'Situational Judgment', 'Clinical Skills', 'Mini-mock', 'Mock Discussion'
    ).optional().allow(''),

    capacity: Joi.number().integer().min(1).max(100).optional().allow(''),

    exam_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional().allow(''),

    start_time: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):([0-5][0-9])$/).optional().allow(''),

    end_time: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):([0-5][0-9])$/).optional().allow(''),

    is_active: Joi.string().valid('active', 'inactive', 'scheduled').optional().allow(''),

    scheduled_activation_datetime: Joi.date().iso().optional().allow('')
  })
    .min(1)  // At least one field must be present
    .custom((value, helpers) => {
      // Validate end_time > start_time when both provided
      if (value.start_time && value.end_time) {
        const [startH, startM] = value.start_time.split(':').map(Number);
        const [endH, endM] = value.end_time.split(':').map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;

        if (endMinutes <= startMinutes) {
          return helpers.error('custom.endTimeBeforeStart');
        }
      }

      // Validate scheduled_activation_datetime when is_active='scheduled'
      if (value.is_active === 'scheduled') {
        if (!value.scheduled_activation_datetime) {
          return helpers.error('custom.scheduledDateRequired');
        }

        const scheduledDate = new Date(value.scheduled_activation_datetime);
        if (scheduledDate <= new Date()) {
          return helpers.error('custom.scheduledDatePast');
        }
      }

      return value;
    })
    .required()
}).options({ stripUnknown: true })
```

**Processing Flow**:
```javascript
module.exports = async (req, res) => {
  try {
    // 1. Authentication
    const user = await requireAdmin(req);

    // 2. Validation
    const validator = validationMiddleware('bulkUpdate');
    await new Promise((resolve, reject) => {
      validator(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    const { sessionIds, updates } = req.validatedData;

    // 3. Fetch current state of all sessions
    console.log(`[Bulk Update] Fetching ${sessionIds.length} sessions from HubSpot...`);
    const sessions = await hubspot.batchFetchMockExams(sessionIds);

    // 4. Validate and prepare updates
    const validUpdates = [];
    const invalidSessions = [];

    for (const session of sessions) {
      const currentProps = session.properties;
      const sessionId = session.id;

      // Check capacity constraint
      if (updates.capacity) {
        const totalBookings = parseInt(currentProps.total_bookings) || 0;
        if (updates.capacity < totalBookings) {
          invalidSessions.push({
            id: sessionId,
            reason: `Capacity (${updates.capacity}) cannot be less than total bookings (${totalBookings})`
          });
          continue;
        }
      }

      // Build update properties object
      const properties = {};

      // Copy provided updates (filter out empty strings)
      Object.keys(updates).forEach(key => {
        if (updates[key] !== '' && updates[key] !== null && updates[key] !== undefined) {
          properties[key] = updates[key];
        }
      });

      // Handle timestamp conversion for time fields
      if (updates.start_time || updates.end_time) {
        const examDate = updates.exam_date || currentProps.exam_date;

        if (updates.start_time) {
          properties.start_time = hubspot.convertToTimestamp(examDate, updates.start_time);
        } else if (updates.exam_date && currentProps.start_time) {
          // Recalculate existing start_time with new date
          const existingTime = hubspot.extractTimeFromTimestamp(currentProps.start_time);
          properties.start_time = hubspot.convertToTimestamp(examDate, existingTime);
        }

        if (updates.end_time) {
          properties.end_time = hubspot.convertToTimestamp(examDate, updates.end_time);
        } else if (updates.exam_date && currentProps.end_time) {
          // Recalculate existing end_time with new date
          const existingTime = hubspot.extractTimeFromTimestamp(currentProps.end_time);
          properties.end_time = hubspot.convertToTimestamp(examDate, existingTime);
        }
      }

      // Auto-regenerate mock_exam_name if components changed
      if (updates.mock_type || updates.location || updates.exam_date) {
        const mockType = updates.mock_type || currentProps.mock_type;
        const location = updates.location || currentProps.location;
        const examDate = updates.exam_date || currentProps.exam_date;

        properties.mock_exam_name = `${mockType}-${location}-${examDate}`;
      }

      // Clear scheduled_activation_datetime if is_active changed from 'scheduled'
      if (updates.is_active && updates.is_active !== 'scheduled' && currentProps.is_active === 'scheduled') {
        properties.scheduled_activation_datetime = '';
      }

      validUpdates.push({
        id: sessionId,
        properties
      });
    }

    // 5. Execute batch updates in chunks of 100
    console.log(`[Bulk Update] Updating ${validUpdates.length} sessions (${invalidSessions.length} skipped)...`);

    const results = {
      successful: [],
      failed: []
    };

    for (let i = 0; i < validUpdates.length; i += 100) {
      const chunk = validUpdates.slice(i, i + 100);

      try {
        const response = await hubspot.apiCall('POST',
          `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/batch/update`,
          { inputs: chunk }
        );

        results.successful.push(...response.results.map(r => r.id));
      } catch (error) {
        console.error(`[Bulk Update] Chunk ${i / 100 + 1} failed:`, error);
        results.failed.push(...chunk.map(c => ({
          id: c.id,
          reason: error.message || 'HubSpot batch update failed'
        })));
      }
    }

    // 6. Create audit trail notes (non-blocking)
    createAuditTrails(results.successful, updates, user).catch(err => {
      console.error('[Bulk Update] Audit trail creation failed:', err);
    });

    // 7. Invalidate caches
    const cache = getCache();
    await cache.deletePattern('admin:mock-exams:list:*');
    await cache.deletePattern('admin:mock-exams:aggregates:*');
    await cache.deletePattern('admin:aggregate:sessions:*');
    await cache.deletePattern('admin:metrics:*');
    await cache.deletePattern('admin:mock-exam:*');

    // 8. Build response
    const summary = {
      total: sessionIds.length,
      updated: results.successful.length,
      failed: results.failed.length + invalidSessions.length,
      skipped: invalidSessions.length
    };

    console.log(`[Bulk Update] Complete: ${summary.updated} updated, ${summary.failed} failed`);

    res.status(200).json({
      success: true,
      summary,
      results: {
        successful: results.successful,
        failed: [...results.failed, ...invalidSessions]
      },
      meta: {
        timestamp: new Date().toISOString(),
        processedBy: user.email,
        executionTime: Date.now() - startTime
      }
    });

  } catch (error) {
    console.error('[Bulk Update] Error:', error);

    res.status(error.status || 500).json({
      success: false,
      error: {
        code: error.code || 'BULK_UPDATE_FAILED',
        message: error.message || 'Failed to update sessions'
      }
    });
  }
};

// Helper function for audit trails
async function createAuditTrails(sessionIds, updates, user) {
  for (const sessionId of sessionIds) {
    const changes = Object.entries(updates)
      .filter(([_, value]) => value !== '' && value !== null)
      .map(([key, value]) => ({ field: key, newValue: value }));

    await hubspot.createMockExamEditNote(sessionId, changes, user);
  }
}
```

---

### 4.3 API Response Format

#### Success Response
```json
{
  "success": true,
  "summary": {
    "total": 15,
    "updated": 13,
    "failed": 2,
    "skipped": 2
  },
  "results": {
    "successful": ["123456", "123457", ...],
    "failed": [
      {
        "id": "123458",
        "reason": "Capacity (8) cannot be less than total bookings (10)"
      },
      {
        "id": "123459",
        "reason": "HubSpot API error: Invalid property value"
      }
    ]
  },
  "meta": {
    "timestamp": "2025-01-14T15:30:00.000Z",
    "processedBy": "admin@prepdoctors.com",
    "executionTime": 2341
  }
}
```

#### Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "At least one field must be updated"
  }
}
```

---

## 5. UI/UX Requirements

### 5.1 Modal Layout

**Dimensions**:
- Width: `max-w-3xl` (768px) - Larger than delete modal to accommodate form
- Max Height: `max-h-[90vh]` with scrollable content area

**Sections** (top to bottom):
1. **Header** (60px fixed)
   - Blue pencil icon (left)
   - Title: "Bulk Edit Sessions"
   - Close button (right)

2. **Session Count Bar** (40px)
   - "Editing X sessions" with blue badge

3. **Form Section** (scrollable)
   - 2-column grid layout on desktop
   - Stack on mobile
   - Fields grouped logically:
     - Row 1: Location, Mock Type
     - Row 2: Capacity, Exam Date
     - Row 3: Start Time, End Time
     - Row 4: Status (is_active)
     - Row 5: Scheduled Activation (conditional)

4. **Info Banner** (auto-height)
   - Blue background
   - Icon + "Fields left blank will not be updated"

5. **Validation Warnings** (conditional, auto-height)
   - Red/yellow background
   - Show sessions that will fail validation
   - Example: "2 sessions cannot be updated (capacity constraint)"

6. **Session Preview Table** (max-h-60, scrollable)
   - Show first 10 sessions
   - Columns: Type, Date, Location, Current Capacity, Current Status
   - Grayed out if will fail validation

7. **Confirmation Input** (60px)
   - Center-aligned
   - Placeholder: "Type X to confirm"

8. **Action Buttons** (60px fixed)
   - Cancel (left)
   - Confirm (right, blue)

### 5.2 Form Field Styles

**Select Dropdowns**:
```jsx
<Select
  value={formData.location}
  onValueChange={(value) => updateField('location', value)}
  className="w-full"
>
  <SelectTrigger>
    <SelectValue placeholder="Select location..." />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="">No change</SelectItem>
    {LOCATIONS.map(loc => (
      <SelectItem key={loc} value={loc}>{loc}</SelectItem>
    ))}
  </SelectContent>
</Select>
```

**Date Picker**:
```jsx
<DatePicker
  selected={formData.exam_date}
  onChange={(date) => updateField('exam_date', date)}
  dateFormat="yyyy-MM-dd"
  placeholderText="Select date..."
  className="w-full px-3 py-2 border rounded-md"
/>
```

**Time Picker**:
```jsx
<TimePickerSelect
  value={formData.start_time}
  onChange={(time) => updateField('start_time', time)}
  minuteStep={15}
  placeholder="Select time..."
  className="w-full"
/>
```

**Number Input**:
```jsx
<input
  type="number"
  value={formData.capacity}
  onChange={(e) => updateField('capacity', e.target.value)}
  min="1"
  max="100"
  placeholder="Enter capacity..."
  className="w-full px-3 py-2 border rounded-md"
/>
```

### 5.3 Validation Feedback

**Field-Level Errors**:
```jsx
{validationErrors.end_time && (
  <p className="mt-1 text-sm text-red-600 flex items-center">
    <ExclamationCircleIcon className="h-4 w-4 mr-1" />
    {validationErrors.end_time}
  </p>
)}
```

**Session-Level Warnings**:
```jsx
{sessionsFailingValidation.length > 0 && (
  <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
    <div className="flex">
      <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 mr-2" />
      <div>
        <p className="text-sm font-medium text-yellow-800">
          {sessionsFailingValidation.length} session(s) cannot be updated:
        </p>
        <ul className="mt-2 text-sm text-yellow-700">
          {sessionsFailingValidation.map(s => (
            <li key={s.id}>• {s.mock_type} - {s.exam_date}: {s.reason}</li>
          ))}
        </ul>
      </div>
    </div>
  </div>
)}
```

### 5.4 Loading States

**During Validation**:
- Show subtle spinner next to "Calculate" or "Validate" text
- Disable form inputs temporarily

**During Submission**:
- Disable all inputs and buttons
- Show spinner in confirm button
- Change button text to "Updating X sessions..."
- Show progress if operation takes >3 seconds: "Updating 13 of 15 sessions..."

### 5.5 Success/Error Toasts

**Full Success**:
```javascript
toast.success('✓ Successfully updated 15 sessions', { duration: 5000 });
```

**Partial Success**:
```javascript
toast.success('✓ Updated 13 of 15 sessions. 2 failed validation.', { duration: 8000 });
```

**Complete Failure**:
```javascript
toast.error('✗ Bulk update failed: Invalid field values', { duration: 6000 });
```

---

## 6. Error Handling

### 6.1 Validation Errors

| Error Code | Message | User Action |
|-----------|---------|-------------|
| `NO_FIELDS_UPDATED` | "Please update at least one field" | Populate at least one field |
| `END_TIME_BEFORE_START` | "End time must be after start time" | Adjust time values |
| `CAPACITY_TOO_LOW` | "Capacity cannot be less than existing bookings for X session(s)" | Increase capacity or deselect sessions |
| `SCHEDULED_DATE_REQUIRED` | "Scheduled activation datetime is required when status is 'Scheduled'" | Provide datetime or change status |
| `SCHEDULED_DATE_PAST` | "Scheduled activation must be a future date" | Choose future datetime |
| `INVALID_DATE_FORMAT` | "Date must be in YYYY-MM-DD format" | Correct date format |
| `INVALID_TIME_FORMAT` | "Time must be in HH:MM format (24-hour)" | Correct time format |

### 6.2 API Errors

| Scenario | Response | User Experience |
|----------|----------|-----------------|
| HubSpot rate limit (429) | Retry with exponential backoff | Show "Retrying... (attempt X)" |
| HubSpot API error (500) | Return failed session IDs | Show partial success toast with count |
| Timeout (>55s) | Return sessions processed so far | Show "Timed out. X sessions updated, Y pending" |
| Network error | Abort and rollback | Show "Network error. No sessions were updated" |
| Authentication error (401) | Reject request | Redirect to login |

### 6.3 Edge Cases

| Edge Case | Handling |
|-----------|----------|
| User closes modal during submission | Show "Updating in background" toast, allow viewing results later |
| Session deleted by another admin during update | Mark as failed with reason "Session not found" |
| Capacity increased but bookings added meanwhile | Allow update (new capacity > old bookings) |
| `exam_date` changed to past date | Allow update (admin may be fixing historical data) |
| All selected sessions fail validation | Show error, prevent submission, highlight issues |
| User changes `is_active` to 'scheduled' without datetime | Show inline error, disable confirm button |

---

## 7. Success Criteria

### 7.1 Functional Success

- [ ] Bulk edit button appears in toolbar when 1+ sessions selected
- [ ] Modal opens with all 8 fields editable
- [ ] Empty fields do NOT update corresponding properties
- [ ] Populated fields update ALL selected sessions
- [ ] `mock_exam_name` auto-regenerates when components change
- [ ] Validation prevents invalid updates (capacity, times, dates)
- [ ] Confirmation input required before submission
- [ ] Partial failures handled gracefully with clear feedback
- [ ] Cache invalidation triggers UI refresh
- [ ] Audit trail created for successful updates

### 7.2 Performance Success

- [ ] Batch API reduces API calls by 95% vs. individual updates
- [ ] Updates complete in <5 seconds for 50 sessions
- [ ] Updates complete in <15 seconds for 100 sessions
- [ ] No Vercel timeout errors for batches up to 100
- [ ] Cache invalidation completes in <2 seconds

### 7.3 User Experience Success

- [ ] Modal loads in <500ms
- [ ] Form validation provides instant feedback (<200ms)
- [ ] Loading states clearly communicate progress
- [ ] Success/error toasts appear immediately after operation
- [ ] No confusing error messages (all user-friendly)
- [ ] ESC key closes modal (when not submitting)
- [ ] Keyboard navigation works throughout form

### 7.4 Quality Assurance

- [ ] All validation rules tested with edge cases
- [ ] Partial failure scenarios tested (some succeed, some fail)
- [ ] Concurrent edit conflict scenarios tested
- [ ] Timezone handling tested for time fields
- [ ] `mock_exam_name` regeneration tested with all combinations
- [ ] Capacity constraint enforced correctly
- [ ] Scheduled activation datetime validation works

---

## 8. Implementation Plan

### Phase 1: Backend Foundation (Days 1-2)

**Tasks**:
1. Create validation schema `bulkUpdate` in `validation.js`
2. Implement `POST /api/admin/mock-exams/bulk-update` endpoint
3. Add helper method `extractTimeFromTimestamp()` to `hubspot.js` if not exists
4. Implement batch update logic with chunking (100 per batch)
5. Add `mock_exam_name` regeneration logic
6. Implement cache invalidation patterns
7. Add audit trail creation (non-blocking)
8. Write unit tests for validation rules
9. Write integration tests for bulk update endpoint

**Files Created/Modified**:
- `admin_root/api/_shared/validation.js` (add schema)
- `admin_root/api/admin/mock-exams/bulk-update.js` (new)
- `admin_root/api/_shared/hubspot.js` (add helper method)
- `tests/integration/bulk-update.test.js` (new)

### Phase 2: Frontend Hook & Modal (Days 3-4)

**Tasks**:
1. Create `useBulkEdit` hook with React Query mutation
2. Create `BulkEditModal` component
3. Implement form state management
4. Implement client-side validation
5. Add session preview table
6. Add confirmation input logic
7. Integrate with `useBulkEdit` hook
8. Add loading and error states
9. Style with Tailwind (match existing modals)

**Files Created/Modified**:
- `admin_root/admin_frontend/src/hooks/useBulkEdit.js` (new)
- `admin_root/admin_frontend/src/components/admin/BulkEditModal.jsx` (new)

### Phase 3: Dashboard Integration (Day 5)

**Tasks**:
1. Add "Bulk Edit" button to `MockExamsSelectionToolbar`
2. Add modal state to `MockExamsDashboard`
3. Wire up event handlers (`handleBulkEdit`, `handleBulkEditSuccess`)
4. Add modal to dashboard render
5. Test in both List View and Aggregate View
6. Verify bulk selection state management

**Files Modified**:
- `admin_root/admin_frontend/src/components/admin/MockExamsSelectionToolbar.jsx`
- `admin_root/admin_frontend/src/pages/MockExamsDashboard.jsx`

### Phase 4: Testing & Refinement (Days 6-7)

**Tasks**:
1. Manual testing of all validation rules
2. Test with 1, 10, 50, 100 sessions
3. Test partial failures (mix of valid/invalid)
4. Test all field combinations
5. Test timezone handling
6. Test concurrent edit scenarios
7. Test cache invalidation
8. Test UI responsiveness (mobile, tablet, desktop)
9. Fix bugs and edge cases
10. Performance profiling and optimization

### Phase 5: Documentation & Deployment (Day 8)

**Tasks**:
1. Update API documentation with bulk-update endpoint
2. Update user guide with bulk edit instructions
3. Add code comments and JSDoc
4. Create demo video for team training
5. Deploy to staging environment
6. Conduct UAT with 2-3 admins
7. Address feedback
8. Deploy to production
9. Monitor for errors in first 24 hours
10. Collect usage metrics

---

## 9. Testing Strategy

### 9.1 Unit Tests

**Backend** (`tests/unit/bulk-update.test.js`):
```javascript
describe('Bulk Update Validation', () => {
  test('rejects empty updates object', async () => {
    const result = validate({ sessionIds: ['123'], updates: {} });
    expect(result.error).toBeDefined();
  });

  test('accepts valid location update', async () => {
    const result = validate({
      sessionIds: ['123'],
      updates: { location: 'Calgary' }
    });
    expect(result.error).toBeUndefined();
  });

  test('rejects end_time before start_time', async () => {
    const result = validate({
      sessionIds: ['123'],
      updates: { start_time: '14:00', end_time: '12:00' }
    });
    expect(result.error.message).toContain('end time');
  });

  test('requires scheduled_activation_datetime when is_active=scheduled', () => {
    const result = validate({
      sessionIds: ['123'],
      updates: { is_active: 'scheduled' }
    });
    expect(result.error.message).toContain('scheduled activation');
  });
});

describe('mock_exam_name Regeneration', () => {
  test('regenerates when mock_type changes', () => {
    const name = generateMockExamName(
      'Clinical Skills',  // new
      'Mississauga',      // current
      '2025-02-15'        // current
    );
    expect(name).toBe('Clinical Skills-Mississauga-2025-02-15');
  });

  test('regenerates when location changes', () => {
    const name = generateMockExamName(
      'Mini-mock',        // current
      'Calgary',          // new
      '2025-02-15'        // current
    );
    expect(name).toBe('Mini-mock-Calgary-2025-02-15');
  });

  test('regenerates when exam_date changes', () => {
    const name = generateMockExamName(
      'Mini-mock',        // current
      'Mississauga',      // current
      '2025-03-01'        // new
    );
    expect(name).toBe('Mini-mock-Mississauga-2025-03-01');
  });
});
```

**Frontend** (`tests/unit/BulkEditModal.test.js`):
```javascript
describe('BulkEditModal Validation', () => {
  test('disables confirm button when no fields filled', () => {
    const { getByText } = render(<BulkEditModal selectedSessions={[mockSession]} />);
    expect(getByText(/Update \d+ Sessions/)).toBeDisabled();
  });

  test('enables confirm button when at least one field filled', () => {
    const { getByText, getByLabelText } = render(<BulkEditModal selectedSessions={[mockSession]} />);
    fireEvent.change(getByLabelText('Location'), { target: { value: 'Calgary' } });
    expect(getByText(/Update \d+ Sessions/)).not.toBeDisabled();
  });

  test('shows error for end_time before start_time', () => {
    const { getByLabelText, getByText } = render(<BulkEditModal selectedSessions={[mockSession]} />);
    fireEvent.change(getByLabelText('Start Time'), { target: { value: '14:00' } });
    fireEvent.change(getByLabelText('End Time'), { target: { value: '12:00' } });
    expect(getByText(/must be after start time/)).toBeInTheDocument();
  });

  test('requires confirmation input to match session count', () => {
    const { getByPlaceholderText, getByText } = render(
      <BulkEditModal selectedSessions={[mockSession1, mockSession2]} />
    );
    const input = getByPlaceholderText(/Type 2 to confirm/);
    fireEvent.change(input, { target: { value: '2' } });
    expect(getByText(/Update 2 Sessions/)).not.toBeDisabled();
  });
});
```

### 9.2 Integration Tests

**Backend** (`tests/integration/bulk-update-api.test.js`):
```javascript
describe('POST /api/admin/mock-exams/bulk-update', () => {
  test('updates location for multiple sessions', async () => {
    const response = await request(app)
      .post('/api/admin/mock-exams/bulk-update')
      .send({
        sessionIds: ['123456', '123457'],
        updates: { location: 'Calgary' }
      })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.summary.updated).toBe(2);
    expect(response.body.results.successful).toHaveLength(2);
  });

  test('handles partial failures gracefully', async () => {
    // Session 1: valid (capacity 10, bookings 5)
    // Session 2: invalid (capacity 5, bookings 8)
    const response = await request(app)
      .post('/api/admin/mock-exams/bulk-update')
      .send({
        sessionIds: ['123456', '123457'],
        updates: { capacity: 6 }
      })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.summary.updated).toBe(1);
    expect(response.body.summary.failed).toBe(1);
    expect(response.body.results.failed[0].reason).toContain('bookings');
  });

  test('regenerates mock_exam_name when components change', async () => {
    const response = await request(app)
      .post('/api/admin/mock-exams/bulk-update')
      .send({
        sessionIds: ['123456'],
        updates: {
          mock_type: 'Clinical Skills',
          location: 'Calgary',
          exam_date: '2025-03-15'
        }
      })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);

    // Verify updated session has new name
    const session = await hubspot.getMockExam('123456');
    expect(session.properties.mock_exam_name).toBe('Clinical Skills-Calgary-2025-03-15');
  });

  test('converts times to timestamps correctly', async () => {
    const response = await request(app)
      .post('/api/admin/mock-exams/bulk-update')
      .send({
        sessionIds: ['123456'],
        updates: {
          exam_date: '2025-03-15',
          start_time: '09:00',
          end_time: '11:00'
        }
      })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);

    // Verify timestamps are Unix milliseconds
    const session = await hubspot.getMockExam('123456');
    expect(typeof session.properties.start_time).toBe('number');
    expect(typeof session.properties.end_time).toBe('number');
  });
});
```

### 9.3 Manual Test Cases

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| **Basic Update** | 1. Select 5 sessions<br>2. Click "Bulk Edit"<br>3. Change location to "Calgary"<br>4. Type "5" to confirm<br>5. Click "Update" | All 5 sessions updated, toast shows success |
| **Multiple Fields** | 1. Select 10 sessions<br>2. Update location, capacity, and exam_date<br>3. Confirm and submit | All fields updated, `mock_exam_name` regenerated |
| **Capacity Constraint** | 1. Select session with 8 bookings<br>2. Try to set capacity to 5<br>3. Attempt to submit | Validation error shown, confirm button disabled |
| **Time Validation** | 1. Set start_time to "14:00"<br>2. Set end_time to "12:00"<br>3. Attempt to submit | Inline error shown, confirm button disabled |
| **Scheduled Activation** | 1. Set is_active to "Scheduled"<br>2. Leave scheduled_activation_datetime empty<br>3. Attempt to submit | Error shown, datetime picker highlighted |
| **Partial Failure** | 1. Select 10 sessions (5 valid, 5 invalid for capacity)<br>2. Update capacity<br>3. Submit | 5 updated, 5 failed, toast shows partial success |
| **Empty Form** | 1. Select sessions<br>2. Open modal<br>3. Leave all fields empty<br>4. Attempt to submit | Error: "Update at least one field", button disabled |
| **Modal Close During Submit** | 1. Start bulk update<br>2. Press ESC during API call | Modal stays open, operation continues |
| **Max Session Limit** | 1. Select 101 sessions<br>2. Attempt to open modal | Error: "Cannot edit more than 100 sessions at once" |

---

## 10. Security Considerations

### 10.1 Authentication & Authorization

- **Requirement**: All bulk update requests MUST pass through `requireAdmin` middleware
- **Token Validation**: Verify Supabase JWT token on every request
- **Rate Limiting**: Enforce per-user rate limits (e.g., max 10 bulk updates per minute)

### 10.2 Input Validation

- **Server-Side Validation**: NEVER trust client-side validation alone
- **Joi Schema Enforcement**: All requests validated against `bulkUpdate` schema
- **SQL Injection Prevention**: Use parameterized queries (N/A for HubSpot API)
- **XSS Prevention**: Sanitize all user inputs before logging or displaying

### 10.3 Data Integrity

- **Capacity Constraint**: Enforce `capacity >= total_bookings` server-side
- **Optimistic Locking**: Handle concurrent edits with "last write wins" strategy
- **Audit Trail**: Log all bulk updates with user, timestamp, and changes
- **Rollback Strategy**: Manual rollback via HubSpot UI if needed (no automated rollback)

---

## 11. Monitoring & Observability

### 11.1 Logging

**Log Events**:
```javascript
// Request received
console.log(`[Bulk Update] Request from ${user.email}: ${sessionIds.length} sessions`);

// Validation phase
console.log(`[Bulk Update] Validated: ${validUpdates.length} valid, ${invalidSessions.length} invalid`);

// HubSpot API calls
console.log(`[Bulk Update] Batch ${batchNum}: Updating ${chunk.length} sessions`);

// Success
console.log(`[Bulk Update] Complete: ${summary.updated} updated, ${summary.failed} failed (${executionTime}ms)`);

// Failure
console.error(`[Bulk Update] Error: ${error.message}`, { sessionIds, updates });
```

### 11.2 Metrics

**Track**:
- Bulk update request count (per day/week/month)
- Average session count per request
- Success rate (%)
- Partial failure rate (%)
- Average execution time (ms)
- HubSpot API call count (per bulk update)
- Most commonly updated fields
- Validation failure reasons (frequency)

**Alerts**:
- Success rate drops below 90%
- Average execution time exceeds 20 seconds
- HubSpot API errors exceed 5% of calls
- More than 3 timeouts per day

---

## 12. Future Enhancements

### Phase 2 Features (Post-MVP)

1. **Undo Bulk Update**
   - Store before/after states
   - Allow reverting last bulk update within 5 minutes
   - "Undo" button in success toast

2. **Advanced Filters in Modal**
   - "Update only sessions with capacity < 10"
   - "Update only inactive sessions"
   - Smart filtering before submission

3. **Preview Before/After**
   - Show table with "Current Value" and "New Value" columns
   - Highlight changed cells
   - Calculate impact (e.g., "Total capacity increased by 40")

4. **Bulk Update Templates**
   - Save common update patterns
   - "Increase all Calgary sessions capacity by 2"
   - "Move all online sessions to 9 AM start"

5. **Scheduled Bulk Updates**
   - "Update these sessions on Feb 1st at 12 PM"
   - Queue system for delayed bulk operations

6. **CSV Import for Bulk Updates**
   - Upload CSV with session IDs and new values
   - Map columns to properties
   - Validate and apply updates

---

## 13. Dependencies & Risks

### 13.1 Dependencies

| Dependency | Purpose | Risk Level | Mitigation |
|------------|---------|-----------|------------|
| HubSpot Batch Update API | Core functionality | High | Use exponential backoff, handle rate limits |
| Headless UI Dialog | Modal component | Low | Well-established library, stable |
| React Query | State management | Low | Already used extensively |
| Joi Validation | Request validation | Low | Core validation library |
| Redis Cache | Cache invalidation | Medium | Handle cache failures gracefully |

### 13.2 Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| HubSpot API rate limit hit | High | Medium | Chunk requests, add delays, retry with backoff |
| Timeout on large batches (100 sessions) | High | Low | Monitor execution time, warn at 55s, implement resume logic |
| Concurrent edits by multiple admins | Medium | Low | Use optimistic locking, show "Session updated by X" warning |
| Invalid data causing HubSpot API rejection | Medium | Medium | Comprehensive validation before API calls |
| Cache invalidation failures | Low | Low | Non-critical, eventual consistency acceptable |
| Modal rendering performance issues | Low | Very Low | Optimize with React.memo, virtualize preview table if needed |

---

## 14. Acceptance Criteria

### 14.1 Must Have (MVP)

- [ ] Admin can select 1-100 sessions from dashboard
- [ ] "Bulk Edit" button appears in toolbar
- [ ] Modal displays with 8 editable fields
- [ ] Empty fields do not trigger updates
- [ ] All validation rules enforced (capacity, times, dates)
- [ ] `mock_exam_name` auto-regenerates correctly
- [ ] Confirmation input required before submission
- [ ] Success toast shows updated count
- [ ] Partial failures handled with clear feedback
- [ ] Cache and React Query invalidated after updates
- [ ] Audit trail created for successful updates
- [ ] Updates complete in <20 seconds for 100 sessions
- [ ] No Vercel timeout errors

### 14.2 Should Have

- [ ] Session preview table shows first 10 sessions
- [ ] Validation warnings shown before submission
- [ ] Progress indicator for operations >3 seconds
- [ ] ESC key closes modal (when not submitting)
- [ ] Form field tooltips with helpful hints
- [ ] Keyboard navigation works throughout
- [ ] Mobile-responsive layout
- [ ] Dark mode support

### 14.3 Could Have (Future)

- [ ] Undo bulk update feature
- [ ] Before/after preview table
- [ ] Bulk update templates
- [ ] CSV import for updates
- [ ] Scheduled bulk updates

---

## 15. Stakeholder Sign-off

| Stakeholder | Role | Approval | Date | Comments |
|-------------|------|----------|------|----------|
| _Pending_ | Product Owner | ☐ Approved ☐ Changes Requested | | |
| _Pending_ | Tech Lead | ☐ Approved ☐ Changes Requested | | |
| _Pending_ | Admin User Rep | ☐ Approved ☐ Changes Requested | | |
| _Pending_ | QA Lead | ☐ Approved ☐ Changes Requested | | |

---

## 16. Appendix

### A. Constants & Enums

**Valid Locations**:
```javascript
const LOCATIONS = [
  'Mississauga',
  'Mississauga - B9',
  'Mississauga - Lab D',
  'Calgary',
  'Vancouver',
  'Montreal',
  'Richmond Hill',
  'Online'
];
```

**Valid Mock Types**:
```javascript
const MOCK_TYPES = [
  'Situational Judgment',
  'Clinical Skills',
  'Mini-mock',
  'Mock Discussion'
];
```

**Valid Active States**:
```javascript
const ACTIVE_STATES = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'scheduled', label: 'Scheduled' }
];
```

### B. Example API Calls

**Request Example**:
```bash
curl -X POST https://app.prepdoctors.com/api/admin/mock-exams/bulk-update \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "sessionIds": ["123456", "123457", "123458"],
    "updates": {
      "location": "Calgary",
      "capacity": 12,
      "start_time": "09:00",
      "end_time": "11:00"
    }
  }'
```

**Response Example**:
```json
{
  "success": true,
  "summary": {
    "total": 3,
    "updated": 3,
    "failed": 0,
    "skipped": 0
  },
  "results": {
    "successful": ["123456", "123457", "123458"],
    "failed": []
  },
  "meta": {
    "timestamp": "2025-01-14T15:30:00.000Z",
    "processedBy": "admin@prepdoctors.com",
    "executionTime": 1852
  }
}
```

### C. Related Documentation

- [HubSpot Batch Update API](https://developers.hubspot.com/docs/api/crm/objects#batch-update-objects)
- [BulkToggleActiveModal Component](admin_root/admin_frontend/src/components/admin/BulkToggleActiveModal.jsx)
- [MassDeleteModal Component](admin_root/admin_frontend/src/components/admin/MassDeleteModal.jsx)
- [Update Endpoint Documentation](admin_root/api/admin/mock-exams/update.js)
- [Validation Schemas](admin_root/api/_shared/validation.js)

---

**End of PRD**

_Confidence Score: 9/10_
_This PRD is comprehensive and actionable, based on thorough codebase analysis. The architecture patterns match existing implementations. Minor unknowns: exact HubSpot API rate limits under load, Vercel timeout behavior with 100-session batches._
