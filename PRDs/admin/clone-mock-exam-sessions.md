# PRD: Clone Mock Exam Sessions

**Status**: Draft
**Created**: 2025-01-17
**Last Updated**: 2025-01-17
**Author**: Claude Code
**Confidence Score**: 9/10

---

## 1. Feature Overview

### Purpose
Enable administrators to efficiently duplicate existing mock exam sessions with modified properties, reducing the time required to create similar sessions and improving operational efficiency in exam scheduling.

### Problem Statement
Currently, administrators must manually create new mock exam sessions from scratch when scheduling similar sessions. When creating multiple sessions that share most properties (location, type, capacity, time slots) but differ only in date or minor details, this process is:
- **Time-consuming**: Creating 10 similar sessions requires entering the same information 10 times
- **Error-prone**: Manual re-entry increases risk of typos and inconsistent values
- **Inefficient**: No ability to leverage existing session configurations

### Solution
Implement a clone feature that allows administrators to select one or multiple existing sessions and create duplicates with modified properties. The feature will:
- Allow selection of 1-100 sessions from the dashboard
- Pre-populate a form with existing session properties
- Require only the date to be changed (other fields optional)
- Use HubSpot's batch create API for efficient processing
- Automatically generate new mock_exam_name based on cloned properties
- Reset total_bookings to 0 for all cloned sessions

### Success Metrics
- **Time Savings**: 90% reduction in time to create 10 similar sessions (from ~10 minutes to <1 minute)
- **Error Reduction**: 70% fewer property value errors due to pre-population
- **API Efficiency**: Single batch API call vs. N individual create calls
- **User Adoption**: 60% of admins use clone feature within first month
- **Session Creation Volume**: 40% increase in sessions created via clone vs. manual creation

---

## 2. User Stories

### Primary User Story
**As an** administrator managing mock exam sessions
**I want to** clone existing sessions with modified dates and properties
**So that** I can quickly create similar sessions without re-entering all details

### Detailed User Scenarios

#### Scenario 1: Weekly Recurring Sessions
> "We run the same Clinical Skills session every Saturday at 2 PM in Mississauga Lab D with capacity 10. I need to create the next 8 weeks of sessions."

- **Current**: Create 8 sessions manually, entering same details 8 times (~10 minutes)
- **With Feature**: Select one session, click "Clone", enter 8 different dates, confirm (~1 minute)

#### Scenario 2: Multi-Location Session Rollout
> "I have a Mini-mock session scheduled for March 15th in Mississauga. I need to offer the same session in Calgary and Vancouver on the same date."

- **Current**: Create 2 new sessions, manually copying all properties except location
- **With Feature**: Select Mississauga session, clone it twice, change location to Calgary and Vancouver

#### Scenario 3: Capacity Testing
> "I want to test higher capacity for a session type by creating a duplicate with increased seats."

- **Current**: Create new session from scratch with modified capacity
- **With Feature**: Clone existing session, modify only the capacity field

#### Scenario 4: Date Rescheduling
> "A session scheduled for Feb 10th needs to be moved to Feb 17th due to venue availability."

- **Current**: Delete old session, create new one with new date
- **With Feature**: Clone session with new date, then delete original (or keep both)

---

## 3. Functional Requirements

### 3.1 Selection Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-1.1 | Reuse existing bulk selection mechanism | MUST | Use `useBulkSelection` hook |
| FR-1.2 | Support selecting 1-100 sessions for cloning | MUST | HubSpot batch API limit |
| FR-1.3 | Display "Clone" button in `MockExamsSelectionToolbar` when 1+ sessions selected | MUST | Adjacent to Bulk Edit and Delete |
| FR-1.4 | Button disabled during submission (`isSubmitting` state) | MUST | Prevent double-submission |
| FR-1.5 | Support clone in both List View and Aggregate View | MUST | Maintain consistency |
| FR-1.6 | Allow cloning sessions with or without bookings | MUST | Unlike edit/delete which blocks sessions with bookings |

### 3.2 Modal UI Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-2.1 | Use Headless UI Dialog with Transition animations | MUST | Match existing modal patterns |
| FR-2.2 | Display copy/clone icon in blue circular background | MUST | Visual consistency (`DocumentDuplicateIcon`) |
| FR-2.3 | Show selected session count in modal header | MUST | "Clone X sessions" |
| FR-2.4 | Pre-populate form fields with source session properties | MUST | Only when single session selected |
| FR-2.5 | Show blank form when multiple sessions selected | MUST | Cannot pre-populate mixed values |
| FR-2.6 | Display validation errors inline per field | MUST | Red text with ExclamationCircleIcon |
| FR-2.7 | NO confirmation input field required | MUST | Unlike bulk edit/delete - simpler UX |
| FR-2.8 | Show preview of selected sessions in scrollable table | SHOULD | Type, Date, Location, Capacity |
| FR-2.9 | Support ESC key to close (when not submitting) | MUST | Accessibility |
| FR-2.10 | Show loading spinner during API call | MUST | "Cloning X sessions..." |

### 3.3 Form Fields

| Field | Input Type | Required | Pre-populate (1 session) | Default (multi-session) | Validation |
|-------|-----------|----------|--------------------------|-------------------------|------------|
| `exam_date` | Date Picker | **MUST** | Source session date + 7 days | Empty | YYYY-MM-DD, must be different from original |
| `location` | Select Dropdown | Optional | Source location | Empty | One of valid locations |
| `mock_type` | Select Dropdown | Optional | Source mock_type | Empty | One of valid types |
| `capacity` | Number Input | Optional | Source capacity | Empty | Integer 1-100 |
| `start_time` | Time Picker | Optional | Source start_time | Empty | HH:MM format, must be before end_time |
| `end_time` | Time Picker | Optional | Source end_time | Empty | HH:MM format, must be after start_time |
| `is_active` | Select Dropdown | Optional | Source is_active | Empty | 'active', 'inactive', 'scheduled' |
| `scheduled_activation_datetime` | DateTime Picker | Conditional | Source value (if scheduled) | Empty | Required if `is_active='scheduled'`, must be future |

**Field Behavior**:
- **Single Session Selected**: All fields pre-populated from source session (except date is +7 days)
- **Multiple Sessions Selected**: All fields empty (cannot pre-populate mixed values)
- **Empty/Blank fields**: Use source session value for each cloned session
- **Populated fields**: Override source value for ALL cloned sessions
- **Date field**: MUST be changed from original (validation error if unchanged)

### 3.4 Validation Requirements

| ID | Requirement | Priority | Validation Rule |
|----|-------------|----------|-----------------|
| FR-4.1 | `exam_date` is required | MUST | Error: "Date is required for cloning" |
| FR-4.2 | `exam_date` must differ from source session(s) | MUST | Error: "New date must be different from original" |
| FR-4.3 | `exam_date` must be valid calendar date | MUST | Standard date validation |
| FR-4.4 | `start_time` must be before `end_time` if both provided | MUST | Error: "Start time must be before end time" |
| FR-4.5 | `scheduled_activation_datetime` required when `is_active='scheduled'` | MUST | Error: "Scheduled activation required" |
| FR-4.6 | `scheduled_activation_datetime` must be in future | MUST | Error: "Must be a future date" |
| FR-4.7 | `capacity` must be 1-100 if provided | MUST | Standard capacity validation |

### 3.5 Backend Requirements

| ID | Requirement | Priority | Details |
|----|-------------|----------|---------|
| FR-5.1 | Create `POST /api/admin/mock-exams/clone` endpoint | MUST | Accept `sessionIds` + property overrides |
| FR-5.2 | Accept source session properties from frontend request | MUST | Frontend provides pre-fetched session data (no HubSpot refetch needed) |
| FR-5.3 | Build new session properties by merging source + overrides | MUST | Override takes precedence |
| FR-5.4 | Auto-generate new `mock_exam_name` for each clone | MUST | Format: `{mock_type}-{location}-{exam_date}` |
| FR-5.5 | Set `total_bookings` to 0 for all cloned sessions | MUST | New sessions have no bookings |
| FR-5.6 | Use HubSpot Batch Create API in chunks of 100 | MUST | `POST /crm/v3/objects/{objectType}/batch/create` |
| FR-5.7 | Handle partial failures gracefully | MUST | Return successful + failed session creation results |
| FR-5.8 | Create audit trail notes for source sessions | SHOULD | Log that session was cloned |
| FR-5.9 | Invalidate all relevant cache patterns | MUST | List, aggregates, details, metrics |
| FR-5.10 | Respond within 55 seconds (Vercel timeout buffer) | MUST | Handle timeouts gracefully |

---

## 4. Technical Specifications

### 4.1 Frontend Architecture

#### New Component: `CloneMockExamsModal.jsx`

**Location**: `admin_root/admin_frontend/src/components/admin/CloneMockExamsModal.jsx`

**Props Interface**:
```typescript
interface CloneMockExamsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSessions: Session[];
  onSuccess: () => void;
}
```

**State Management**:
```javascript
const [formData, setFormData] = useState({
  exam_date: '', // Required
  location: '',
  mock_type: '',
  capacity: '',
  start_time: '',
  end_time: '',
  is_active: '',
  scheduled_activation_datetime: ''
});
const [validationErrors, setValidationErrors] = useState({});

// Pre-populate form for single session selection
useEffect(() => {
  if (selectedSessions.length === 1) {
    const source = selectedSessions[0];
    const sourceDate = new Date(source.exam_date);
    sourceDate.setDate(sourceDate.getDate() + 7); // Default to +7 days

    setFormData({
      exam_date: sourceDate.toISOString().split('T')[0],
      location: source.location || '',
      mock_type: source.mock_type || '',
      capacity: source.capacity || '',
      start_time: source.start_time || '',
      end_time: source.end_time || '',
      is_active: source.is_active || '',
      scheduled_activation_datetime: source.scheduled_activation_datetime || ''
    });
  } else {
    // Multiple sessions - start with blank form
    setFormData({
      exam_date: '',
      location: '',
      mock_type: '',
      capacity: '',
      start_time: '',
      end_time: '',
      is_active: '',
      scheduled_activation_datetime: ''
    });
  }
}, [selectedSessions]);
```

**Component Structure**:
```jsx
<CloneMockExamsModal>
  <Dialog.Panel>
    {/* Header */}
    <ModalHeader
      icon={DocumentDuplicateIcon}
      title={`Clone ${selectedSessions.length} Session${selectedSessions.length > 1 ? 's' : ''}`}
    />

    {/* Info Message - Pre-population behavior */}
    {selectedSessions.length === 1 ? (
      <InfoBox
        variant="blue"
        message="Form pre-populated with source session values. Change any field to override."
      />
    ) : (
      <InfoBox
        variant="blue"
        message="Empty fields will use each source session's original value. Fill fields to override."
      />
    )}

    {/* Clone Form */}
    <CloneForm>
      <DateField
        name="exam_date"
        label="New Exam Date *"
        required
        error={validationErrors.exam_date}
      />

      <SelectField
        name="location"
        label="Location (optional)"
        options={LOCATIONS}
        placeholder="Keep original"
      />

      <SelectField
        name="mock_type"
        label="Mock Type (optional)"
        options={MOCK_TYPES}
        placeholder="Keep original"
      />

      <NumberField
        name="capacity"
        label="Capacity (optional)"
        min={1}
        max={100}
        placeholder="Keep original"
      />

      <TimeField
        name="start_time"
        label="Start Time (optional)"
        placeholder="Keep original"
      />

      <TimeField
        name="end_time"
        label="End Time (optional)"
        placeholder="Keep original"
      />

      <SelectField
        name="is_active"
        label="Status (optional)"
        options={ACTIVE_STATES}
        placeholder="Keep original"
      />

      {formData.is_active === 'scheduled' && (
        <DateTimeField
          name="scheduled_activation_datetime"
          label="Scheduled Activation *"
          required
          error={validationErrors.scheduled_activation_datetime}
        />
      )}
    </CloneForm>

    {/* Session Preview Table */}
    <SessionPreviewTable
      sessions={selectedSessions.slice(0, 10)}
      showMore={selectedSessions.length > 10}
      remainingCount={selectedSessions.length - 10}
    />

    {/* Actions - NO CONFIRMATION INPUT REQUIRED */}
    <ModalActions>
      <CancelButton onClick={onClose} disabled={isSubmitting} />
      <ConfirmButton
        onClick={handleSubmit}
        disabled={!formData.exam_date || isSubmitting}
        text={isSubmitting ? "Cloning..." : `Clone ${selectedSessions.length} Session${selectedSessions.length > 1 ? 's' : ''}`}
      />
    </ModalActions>
  </Dialog.Panel>
</CloneMockExamsModal>
```

#### New Hook: `useCloneSessions.js`

**Location**: `admin_root/admin_frontend/src/hooks/useCloneSessions.js`

**Implementation**:
```javascript
const useCloneSessions = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ selectedSessions, overrides }) => {
      // Transform selected sessions into cloneSources format
      const cloneSources = selectedSessions.map(session => ({
        sourceSessionId: session.id,
        sourceProperties: {
          mock_type: session.mock_type,
          location: session.location,
          exam_date: session.exam_date,
          capacity: session.capacity,
          start_time: session.start_time,
          end_time: session.end_time,
          is_active: session.is_active,
          scheduled_activation_datetime: session.scheduled_activation_datetime || ''
        }
      }));

      const response = await adminApi.post('/admin/mock-exams/clone', {
        cloneSources,
        overrides
      });
      return response.data;
    },

    onSuccess: (data) => {
      const { summary } = data;

      // Show success toast
      if (summary.created > 0) {
        toast.success(
          `✓ Successfully cloned ${summary.created} of ${summary.total} session(s)`,
          { duration: 5000 }
        );
      }

      // Show partial failure warning
      if (summary.failed > 0) {
        toast.error(
          `⚠️ ${summary.failed} session(s) failed to clone`,
          { duration: 8000 }
        );
      }

      // Invalidate queries - ensure dashboard refreshes with new cloned sessions
      queryClient.invalidateQueries(['mock-exams']);
      queryClient.invalidateQueries(['mock-exams-list']);
      queryClient.invalidateQueries(['mock-exam-aggregates']);
      queryClient.invalidateQueries(['aggregates']);
      queryClient.invalidateQueries(['metrics']);

      // Trigger dashboard refresh
      queryClient.refetchQueries(['mock-exams'], { active: true });
    },

    onError: (error) => {
      const message = error?.response?.data?.error?.message || 'Failed to clone sessions';
      toast.error(`✗ Clone Failed: ${message}`);
    }
  });
};
```

#### Update: `MockExamsSelectionToolbar.jsx`

**Add new prop and button**:
```jsx
<MockExamsSelectionToolbar
  // ... existing props
  onClone={handleClone}  // NEW
>
  {/* Existing buttons */}
  <ToggleActiveButton ... />
  <BulkEditButton ... />
  <DeleteButton ... />

  {/* NEW: Clone Button */}
  <button
    onClick={onClone}
    disabled={isSubmitting}
    className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md border-2 border-blue-600 text-blue-600 bg-white hover:bg-blue-50 transition-colors disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-300 disabled:cursor-not-allowed"
  >
    {isSubmitting ? (
      <LoadingSpinner />
    ) : (
      <DocumentDuplicateIcon className="h-5 w-5 mr-2" />
    )}
    Clone
  </button>

  <ExitButton ... />
</MockExamsSelectionToolbar>
```

#### Update: `MockExamsDashboard.jsx`

**Add state and handlers**:
```javascript
// State for clone modal
const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);

// Handler for opening clone modal
const handleClone = useCallback(() => {
  setIsCloneModalOpen(true);
}, []);

// Handler for successful clone
const handleCloneSuccess = useCallback(() => {
  setIsCloneModalOpen(false);
  bulkSelection.exitToView();
}, [bulkSelection]);

// Render modal
<CloneMockExamsModal
  isOpen={isCloneModalOpen}
  onClose={() => setIsCloneModalOpen(false)}
  selectedSessions={bulkSelection.selectedSessions}
  onSuccess={handleCloneSuccess}
/>
```

---

### 4.2 Backend Architecture

#### New Endpoint: `clone.js`

**Location**: `admin_root/api/admin/mock-exams/clone.js`

**Request Schema** (validation.js):
```javascript
clone: Joi.object({
  cloneSources: Joi.array()
    .items(Joi.object({
      sourceSessionId: Joi.string().pattern(/^\d+$/).required(),
      sourceProperties: Joi.object({
        mock_type: Joi.string().required(),
        location: Joi.string().required(),
        exam_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
        capacity: Joi.alternatives().try(Joi.string(), Joi.number()).required(),
        start_time: Joi.string().required(),
        end_time: Joi.string().required(),
        is_active: Joi.string().valid('active', 'inactive', 'scheduled', 'true', 'false').required(),
        scheduled_activation_datetime: Joi.string().allow('', null).optional()
      }).required()
    }))
    .min(1)
    .max(100)
    .required()
    .messages({
      'array.min': 'At least one session is required',
      'array.max': 'Cannot clone more than 100 sessions at once'
    }),

  overrides: Joi.object({
    exam_date: Joi.string()
      .pattern(/^\d{4}-\d{2}-\d{2}$/)
      .required()
      .messages({
        'string.pattern.base': 'Date must be in YYYY-MM-DD format',
        'any.required': 'New exam date is required for cloning'
      }),

    location: Joi.string().valid(
      'Mississauga', 'Mississauga - B9', 'Mississauga - Lab D',
      'Calgary', 'Vancouver', 'Montreal', 'Richmond Hill', 'Online'
    ).optional().allow(''),

    mock_type: Joi.string().valid(
      'Situational Judgment', 'Clinical Skills', 'Mini-mock', 'Mock Discussion'
    ).optional().allow(''),

    capacity: Joi.number().integer().min(1).max(100).optional().allow(''),

    start_time: Joi.string().pattern(/^\d{2}:\d{2}$/).optional().allow(''),

    end_time: Joi.string().pattern(/^\d{2}:\d{2}$/).optional().allow(''),

    is_active: Joi.string().valid('active', 'inactive', 'scheduled').optional().allow(''),

    scheduled_activation_datetime: Joi.date().iso().optional().allow('')
  })
    .custom((value, helpers) => {
      // Validate time range
      if (value.start_time && value.end_time) {
        const start = new Date(`2000-01-01T${value.start_time}`);
        const end = new Date(`2000-01-01T${value.end_time}`);
        if (start >= end) {
          return helpers.error('custom.timeRange');
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
    const validator = validationMiddleware('clone');
    await new Promise((resolve, reject) => {
      validator(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    const { cloneSources, overrides } = req.validatedData;

    // 3. Build properties for cloned sessions using provided source data
    console.log(`[Clone] Processing ${cloneSources.length} clone requests with provided source data...`);
    const clonedSessionInputs = [];
    const validationErrors = [];

    for (const source of cloneSources) {
      const sourceProps = source.sourceProperties;
      const sessionId = source.sourceSessionId;

      // Validate date is different from source
      if (overrides.exam_date === sourceProps.exam_date) {
        validationErrors.push({
          sessionId,
          reason: 'New date must be different from original date'
        });
        continue;
      }

      // Build cloned properties by merging source + overrides
      const clonedProperties = {
        // Copy all source properties (already in clean format from frontend)
        ...sourceProps,

        // Apply overrides (only non-empty values)
        ...(overrides.exam_date && { exam_date: overrides.exam_date }),
        ...(overrides.location && { location: overrides.location }),
        ...(overrides.mock_type && { mock_type: overrides.mock_type }),
        ...(overrides.capacity && { capacity: overrides.capacity }),
        ...(overrides.start_time && { start_time: overrides.start_time }),
        ...(overrides.end_time && { end_time: overrides.end_time }),
        ...(overrides.is_active && { is_active: overrides.is_active }),
        ...(overrides.scheduled_activation_datetime && {
          scheduled_activation_datetime: overrides.scheduled_activation_datetime
        }),

        // Reset booking count to 0
        total_bookings: '0',

        // Auto-generate new mock_exam_name
        mock_exam_name: `${overrides.mock_type || sourceProps.mock_type}-${overrides.location || sourceProps.location}-${overrides.exam_date}`
      };

      // Clear scheduled_activation_datetime if is_active changed from 'scheduled'
      if (overrides.is_active && overrides.is_active !== 'scheduled' && sourceProps.is_active === 'scheduled') {
        clonedProperties.scheduled_activation_datetime = '';
      }

      clonedSessionInputs.push({
        properties: clonedProperties
      });
    }

    // 4. Create cloned sessions using batch API (chunks of 100)
    console.log(`[Clone] Creating ${clonedSessionInputs.length} cloned sessions (${validationErrors.length} skipped)...`);

    const results = {
      successful: [],
      failed: []
    };

    for (let i = 0; i < clonedSessionInputs.length; i += 100) {
      const chunk = clonedSessionInputs.slice(i, i + 100);

      try {
        const response = await hubspot.apiCall('POST',
          `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/batch/create`,
          { inputs: chunk }
        );

        results.successful.push(...response.results);
      } catch (error) {
        console.error(`[Clone] Chunk ${i / 100 + 1} failed:`, error);
        results.failed.push(...chunk.map(c => ({
          reason: error.message || 'HubSpot batch create failed'
        })));
      }
    }

    // 5. Create audit trail notes for source sessions (non-blocking)
    const sourceSessionIds = cloneSources.map(s => s.sourceSessionId);
    createCloneAuditTrails(sourceSessionIds, results.successful.length, user).catch(err => {
      console.error('[Clone] Audit trail creation failed:', err);
    });

    // 7. Invalidate caches - ensure UI shows new cloned sessions
    const cache = getCache();
    await cache.deletePattern('admin:mock-exams:list:*');
    await cache.deletePattern('admin:mock-exams:aggregates:*');
    await cache.deletePattern('admin:aggregate:sessions:*');
    await cache.deletePattern('admin:metrics:*');
    await cache.deletePattern('admin:mock-exam:*');

    // 6. Build response
    const summary = {
      total: cloneSources.length,
      created: results.successful.length,
      failed: results.failed.length + validationErrors.length,
      skipped: validationErrors.length
    };

    console.log(`[Clone] Complete: ${summary.created} created, ${summary.failed} failed`);

    res.status(200).json({
      success: true,
      summary,
      results: {
        successful: results.successful.map(s => ({
          id: s.id,
          properties: s.properties
        })),
        failed: [...results.failed, ...validationErrors]
      },
      meta: {
        timestamp: new Date().toISOString(),
        processedBy: user.email,
        executionTime: Date.now() - startTime
      }
    });

  } catch (error) {
    console.error('[Clone] Error:', error);

    res.status(error.status || 500).json({
      success: false,
      error: {
        code: error.code || 'CLONE_FAILED',
        message: error.message || 'Failed to clone sessions',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    });
  }
};

// Helper function for audit trails
async function createCloneAuditTrails(sourceSessionIds, clonedCount, user) {
  for (const sessionId of sourceSessionIds) {
    await hubspot.createMockExamNote(
      sessionId,
      `🔄 Session cloned ${clonedCount} time(s) by ${user.email}`,
      user
    );
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
    "total": 10,
    "created": 10,
    "failed": 0,
    "skipped": 0
  },
  "results": {
    "successful": [
      {
        "id": "234567",
        "properties": {
          "mock_exam_name": "Clinical Skills-Mississauga-2025-02-15",
          "exam_date": "2025-02-15",
          "location": "Mississauga",
          "mock_type": "Clinical Skills",
          "capacity": "10",
          "total_bookings": "0",
          ...
        }
      },
      ...
    ],
    "failed": []
  },
  "meta": {
    "timestamp": "2025-01-17T15:30:00.000Z",
    "processedBy": "admin@prepdoctors.com",
    "executionTime": 1523
  }
}
```

#### Partial Success Response
```json
{
  "success": true,
  "summary": {
    "total": 10,
    "created": 8,
    "failed": 2,
    "skipped": 2
  },
  "results": {
    "successful": [...],
    "failed": [
      {
        "sessionId": "123458",
        "reason": "New date must be different from original date"
      },
      {
        "reason": "HubSpot batch create failed"
      }
    ]
  },
  "meta": {...}
}
```

#### Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "New exam date is required for cloning"
  }
}
```

---

## 5. UI/UX Requirements

### 5.1 Modal Layout

**Dimensions**:
- Width: `max-w-3xl` (768px) - Same as BulkEditModal
- Max Height: `max-h-[90vh]` with scrollable content area

**Sections** (top to bottom):
1. **Header** (60px fixed)
   - Blue copy/duplicate icon (left)
   - Title: "Clone X Session(s)"
   - Close button (right)

2. **Info Banner** (60px)
   - Blue background with info icon
   - Single session: "Form pre-populated with source values. Change any field to override."
   - Multiple sessions: "Empty fields will use each source session's original value. Fill fields to override."

3. **Form Section** (scrollable)
   - 2-column grid layout on desktop
   - Stack on mobile
   - Fields grouped logically:
     - Row 1: **Exam Date (required)**, Location
     - Row 2: Mock Type, Capacity
     - Row 3: Start Time, End Time
     - Row 4: Status (is_active)
     - Row 5: Scheduled Activation (conditional)

4. **Session Preview Table** (max-h-60, scrollable)
   - Show first 10 selected sessions
   - Columns: Type, Current Date, Location, Capacity, Current Bookings
   - Footer: "...and X more" if >10 sessions

5. **Action Buttons** (60px fixed)
   - Cancel (left, gray)
   - Clone (right, blue) - text shows "Clone X Session(s)"
   - NO confirmation input required (simpler UX than edit/delete)

### 5.2 Form Field Styles

**Date Picker (Required)**:
```jsx
<DatePicker
  selected={formData.exam_date}
  onChange={(date) => updateField('exam_date', date)}
  dateFormat="yyyy-MM-dd"
  placeholderText="Select new date *"
  className="w-full px-3 py-2 border rounded-md"
  required
  minDate={new Date()} // Optional: only future dates
/>
{validationErrors.exam_date && (
  <p className="text-red-600 text-sm mt-1">{validationErrors.exam_date}</p>
)}
```

**Select Dropdowns (Optional)**:
```jsx
<Select
  value={formData.location}
  onValueChange={(value) => updateField('location', value)}
  className="w-full"
>
  <SelectTrigger>
    <SelectValue placeholder="Keep original" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="">Keep original</SelectItem>
    {LOCATIONS.map(loc => (
      <SelectItem key={loc} value={loc}>{loc}</SelectItem>
    ))}
  </SelectContent>
</Select>
```

**Time Pickers (Optional)**:
```jsx
<input
  type="time"
  value={formData.start_time}
  onChange={(e) => updateField('start_time', e.target.value)}
  placeholder="Keep original"
  className="w-full px-3 py-2 border rounded-md"
/>
```

### 5.3 Validation Feedback

**Field-Level Errors**:
```jsx
{validationErrors.exam_date && (
  <p className="mt-1 text-sm text-red-600 flex items-center">
    <ExclamationCircleIcon className="h-4 w-4 mr-1" />
    {validationErrors.exam_date}
  </p>
)}
```

**Form-Level Warnings**:
```jsx
{!formData.exam_date && (
  <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
    <div className="flex">
      <ExclamationTriangleIcon className="h-5 w-5 text-amber-400 mr-2" />
      <p className="text-sm text-amber-800">
        New exam date is required to clone sessions
      </p>
    </div>
  </div>
)}
```

### 5.4 Loading States

**During Submission**:
- Disable all inputs and buttons
- Show spinner in clone button
- Change button text to "Cloning X sessions..."
- Show progress if operation takes >3 seconds: "Cloning 8 of 10 sessions..."

### 5.5 Success/Error Toasts

**Full Success**:
```javascript
toast.success('✓ Successfully cloned 10 sessions', { duration: 5000 });
```

**Partial Success**:
```javascript
toast.success('✓ Cloned 8 of 10 sessions. 2 failed validation.', { duration: 8000 });
```

**Complete Failure**:
```javascript
toast.error('✗ Clone failed: Invalid date format', { duration: 6000 });
```

---

## 6. Error Handling

### 6.1 Validation Errors

| Error Code | Message | User Action |
|-----------|---------|-------------|
| `DATE_REQUIRED` | "New exam date is required for cloning" | Enter a date in the date picker |
| `DATE_UNCHANGED` | "New date must be different from original" | Choose a different date |
| `INVALID_DATE_FORMAT` | "Date must be in YYYY-MM-DD format" | Correct date format |
| `TIME_RANGE_INVALID` | "Start time must be before end time" | Adjust time values |
| `SCHEDULED_DATE_REQUIRED` | "Scheduled activation datetime is required when status is 'Scheduled'" | Provide datetime or change status |
| `SCHEDULED_DATE_PAST` | "Scheduled activation must be a future date" | Choose future datetime |

### 6.2 API Errors

| Scenario | Response | User Experience |
|----------|----------|-----------------|
| Source session not found | Skip session with error | Show partial success toast with count |
| HubSpot rate limit (429) | Retry with exponential backoff | Show "Retrying... (attempt X)" |
| HubSpot API error (500) | Return failed session creation results | Show partial success toast with count |
| Timeout (>55s) | Return sessions created so far | Show "Timed out. X sessions cloned, Y pending" |
| Network error | Abort and rollback (if possible) | Show "Network error. No sessions were cloned" |
| Authentication error (401) | Reject request | Redirect to login |

### 6.3 Edge Cases

| Edge Case | Handling |
|-----------|----------|
| User closes modal during submission | Show "Cloning in background" toast, allow viewing results later |
| Source session deleted by another admin during clone | Mark as failed with reason "Source session not found" |
| User tries to clone session with same date as source | Show validation error, disable clone button |
| `exam_date` set to past date | Allow clone (admin may be creating historical sessions) |
| User changes `is_active` to 'scheduled' without datetime | Show inline error, disable clone button |

---

## 7. Success Criteria

### 7.1 Functional Success

- [ ] Clone button appears in toolbar when 1+ sessions selected
- [ ] Modal opens with form (pre-populated for 1 session, empty for multiple)
- [ ] Date field is required and validated
- [ ] All other fields are optional
- [ ] Empty fields use source session values
- [ ] Populated fields override source values for ALL clones
- [ ] `mock_exam_name` auto-generates correctly
- [ ] `total_bookings` set to 0 for all clones
- [ ] Validation prevents invalid clones (same date, invalid times, etc.)
- [ ] NO confirmation input required (simpler UX)
- [ ] Partial failures handled gracefully with clear feedback
- [ ] Cache and React Query invalidation triggers UI refresh
- [ ] Audit trail created for source sessions

### 7.2 Performance Success

- [ ] Batch API reduces API calls by 95% vs. individual creates
- [ ] Cloning completes in <3 seconds for 10 sessions
- [ ] Cloning completes in <8 seconds for 50 sessions
- [ ] Cloning completes in <15 seconds for 100 sessions
- [ ] No Vercel timeout errors for batches up to 100
- [ ] Cache invalidation completes in <2 seconds

### 7.3 User Experience Success

- [ ] Modal loads in <500ms
- [ ] Form pre-population is instant (<100ms)
- [ ] Form validation provides instant feedback (<200ms)
- [ ] Loading states clearly communicate progress
- [ ] Success/error toasts appear immediately after operation
- [ ] No confusing error messages (all user-friendly)
- [ ] ESC key closes modal (when not submitting)
- [ ] Keyboard navigation works throughout form

### 7.4 Quality Assurance

- [ ] All validation rules tested with edge cases
- [ ] Partial failure scenarios tested (some succeed, some fail)
- [ ] Pre-population tested for single vs. multiple session selection
- [ ] Date validation tested (same date, past date, future date)
- [ ] Time range validation tested (start > end, equal times)
- [ ] `mock_exam_name` generation tested with all field combinations
- [ ] Scheduled activation datetime validation works correctly

---

## 8. Implementation Plan

### Phase 1: Backend Foundation (Days 1-2)

**Tasks**:
1. Create validation schema `clone` in `validation.js`
2. Implement `POST /api/admin/mock-exams/clone` endpoint
3. Add property merging logic (source + overrides)
4. Implement `mock_exam_name` generation
5. Set `total_bookings` to 0 for all clones
6. Implement batch create logic with chunking (100 per batch)
7. Add cache invalidation patterns
8. Add audit trail creation for source sessions (non-blocking)
9. Write unit tests for validation rules and property merging
10. Write integration tests for clone endpoint

**Files Created/Modified**:
- `admin_root/api/_shared/validation.js` (add schema)
- `admin_root/api/admin/mock-exams/clone.js` (new)
- `tests/integration/clone.test.js` (new)

### Phase 2: Frontend Hook & Modal (Days 3-4)

**Tasks**:
1. Create `useCloneSessions` hook with React Query mutation
2. Create `CloneMockExamsModal` component
3. Implement form state management (8 fields)
4. Implement pre-population logic for single session selection
5. Add blank form logic for multiple session selection
6. Add date picker with validation (required field)
7. Add optional fields (location, type, capacity, times, status)
8. Add session preview table
9. Integrate with `useCloneSessions` hook
10. Add loading and error states
11. Style with Tailwind (match existing modals)

**Files Created/Modified**:
- `admin_root/admin_frontend/src/hooks/useCloneSessions.js` (new)
- `admin_root/admin_frontend/src/components/admin/CloneMockExamsModal.jsx` (new)

### Phase 3: Dashboard Integration (Day 5)

**Tasks**:
1. Add "Clone" button to `MockExamsSelectionToolbar`
2. Add modal state to `MockExamsDashboard`
3. Wire up event handlers (`handleClone`, `handleCloneSuccess`)
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
3. Test single vs. multiple session selection pre-population
4. Test partial failures (mix of valid/invalid)
5. Test all field combinations (8 fields)
6. Test date validation (same date, different date)
7. Test time range validation
8. Test cache invalidation
9. Test React Query refetch behavior
10. Test UI responsiveness (mobile, tablet, desktop)
11. Fix bugs and edge cases
12. Performance profiling and optimization

### Phase 5: Documentation & Deployment (Day 8)

**Tasks**:
1. Update API documentation with clone endpoint
2. Update user guide with clone instructions
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

**Backend** (`tests/unit/clone.test.js`):
```javascript
describe('Clone Validation', () => {
  test('requires exam_date field', async () => {
    const result = validate({ sessionIds: ['123'], overrides: {} });
    expect(result.error).toBeDefined();
    expect(result.error.message).toContain('exam date is required');
  });

  test('accepts valid clone request', async () => {
    const result = validate({
      sessionIds: ['123'],
      overrides: { exam_date: '2025-03-15' }
    });
    expect(result.error).toBeUndefined();
  });

  test('validates time range', async () => {
    const result = validate({
      sessionIds: ['123'],
      overrides: {
        exam_date: '2025-03-15',
        start_time: '14:00',
        end_time: '12:00'
      }
    });
    expect(result.error).toBeDefined();
  });

  test('requires scheduled_activation_datetime when is_active=scheduled', () => {
    const result = validate({
      sessionIds: ['123'],
      overrides: {
        exam_date: '2025-03-15',
        is_active: 'scheduled'
      }
    });
    expect(result.error.message).toContain('scheduled activation');
  });
});

describe('Property Merging', () => {
  test('merges source and override properties correctly', () => {
    const source = {
      mock_type: 'Clinical Skills',
      location: 'Mississauga',
      exam_date: '2025-02-08',
      capacity: '10'
    };
    const overrides = {
      exam_date: '2025-02-15',
      location: 'Calgary'
    };

    const result = mergeProperties(source, overrides);

    expect(result.mock_type).toBe('Clinical Skills'); // Kept from source
    expect(result.location).toBe('Calgary'); // Overridden
    expect(result.exam_date).toBe('2025-02-15'); // Overridden
    expect(result.capacity).toBe('10'); // Kept from source
    expect(result.total_bookings).toBe('0'); // Reset
  });

  test('generates new mock_exam_name', () => {
    const result = mergeProperties(
      { mock_type: 'Mini-mock', location: 'Mississauga', exam_date: '2025-02-08' },
      { exam_date: '2025-02-15' }
    );

    expect(result.mock_exam_name).toBe('Mini-mock-Mississauga-2025-02-15');
  });
});
```

**Frontend** (`tests/unit/CloneMockExamsModal.test.js`):
```javascript
describe('CloneMockExamsModal Pre-population', () => {
  test('pre-populates form when single session selected', () => {
    const session = {
      id: '123',
      mock_type: 'Clinical Skills',
      location: 'Mississauga',
      exam_date: '2025-02-08',
      capacity: '10'
    };

    const { getByLabelText } = render(
      <CloneMockExamsModal selectedSessions={[session]} />
    );

    // Date should be +7 days from source
    expect(getByLabelText('New Exam Date *').value).toBe('2025-02-15');
    expect(getByLabelText('Location').value).toBe('Mississauga');
    expect(getByLabelText('Mock Type').value).toBe('Clinical Skills');
  });

  test('shows blank form when multiple sessions selected', () => {
    const sessions = [
      { id: '123', exam_date: '2025-02-08' },
      { id: '124', exam_date: '2025-02-09' }
    ];

    const { getByLabelText } = render(
      <CloneMockExamsModal selectedSessions={sessions} />
    );

    // All fields should be empty
    expect(getByLabelText('New Exam Date *').value).toBe('');
    expect(getByLabelText('Location').value).toBe('');
  });
});

describe('CloneMockExamsModal Validation', () => {
  test('disables clone button when date is empty', () => {
    const { getByText } = render(<CloneMockExamsModal selectedSessions={[mockSession]} />);
    expect(getByText(/Clone \d+ Session/)).toBeDisabled();
  });

  test('enables clone button when date is provided', () => {
    const { getByText, getByLabelText } = render(<CloneMockExamsModal selectedSessions={[mockSession]} />);
    fireEvent.change(getByLabelText('New Exam Date *'), { target: { value: '2025-03-15' } });
    expect(getByText(/Clone \d+ Session/)).not.toBeDisabled();
  });

  test('shows error for same date as source', () => {
    const session = { id: '123', exam_date: '2025-02-08' };
    const { getByLabelText, getByText } = render(<CloneMockExamsModal selectedSessions={[session]} />);

    fireEvent.change(getByLabelText('New Exam Date *'), { target: { value: '2025-02-08' } });
    expect(getByText(/must be different from original/)).toBeInTheDocument();
  });
});
```

### 9.2 Integration Tests

**Backend** (`tests/integration/clone-api.test.js`):
```javascript
describe('POST /api/admin/mock-exams/clone', () => {
  test('clones single session with new date', async () => {
    const response = await request(app)
      .post('/api/admin/mock-exams/clone')
      .send({
        sessionIds: ['123456'],
        overrides: { exam_date: '2025-03-15' }
      })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.summary.created).toBe(1);
    expect(response.body.results.successful).toHaveLength(1);

    // Verify cloned session has new date and 0 bookings
    const cloned = response.body.results.successful[0];
    expect(cloned.properties.exam_date).toBe('2025-03-15');
    expect(cloned.properties.total_bookings).toBe('0');
  });

  test('clones multiple sessions with overrides', async () => {
    const response = await request(app)
      .post('/api/admin/mock-exams/clone')
      .send({
        sessionIds: ['123456', '123457', '123458'],
        overrides: {
          exam_date: '2025-03-20',
          location: 'Calgary',
          capacity: 15
        }
      })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.summary.created).toBe(3);

    // Verify all clones have override values
    response.body.results.successful.forEach(clone => {
      expect(clone.properties.exam_date).toBe('2025-03-20');
      expect(clone.properties.location).toBe('Calgary');
      expect(clone.properties.capacity).toBe('15');
      expect(clone.properties.total_bookings).toBe('0');
    });
  });

  test('rejects clone with same date as source', async () => {
    const response = await request(app)
      .post('/api/admin/mock-exams/clone')
      .send({
        sessionIds: ['123456'], // Has exam_date: '2025-02-08'
        overrides: { exam_date: '2025-02-08' } // Same date
      })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.summary.created).toBe(0);
    expect(response.body.summary.failed).toBe(1);
    expect(response.body.results.failed[0].reason).toContain('different from original');
  });

  test('regenerates mock_exam_name correctly', async () => {
    const response = await request(app)
      .post('/api/admin/mock-exams/clone')
      .send({
        sessionIds: ['123456'],
        overrides: {
          exam_date: '2025-03-15',
          mock_type: 'Clinical Skills',
          location: 'Calgary'
        }
      })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);

    // Verify cloned session has new name
    const cloned = response.body.results.successful[0];
    expect(cloned.properties.mock_exam_name).toBe('Clinical Skills-Calgary-2025-03-15');
  });
});
```

### 9.3 Manual Test Cases

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| **Basic Clone** | 1. Select 1 session<br>2. Click "Clone"<br>3. Change date to +7 days<br>4. Click "Clone Session" | Session cloned successfully, toast shows success |
| **Multiple Clone** | 1. Select 5 sessions<br>2. Click "Clone"<br>3. Enter new date<br>4. Confirm | All 5 sessions cloned with new date |
| **Override Properties** | 1. Select 1 session<br>2. Clone with new date, location, capacity<br>3. Confirm | Cloned session has all overridden values |
| **Keep Original Values** | 1. Select 1 session<br>2. Clone with only new date (leave other fields empty)<br>3. Confirm | Cloned session keeps all original values except date |
| **Pre-population (Single)** | 1. Select 1 session<br>2. Open clone modal | Form pre-populated with source values (date +7 days) |
| **Blank Form (Multiple)** | 1. Select 5 sessions<br>2. Open clone modal | Form is blank (cannot pre-populate mixed values) |
| **Same Date Validation** | 1. Clone session with same date as source<br>2. Attempt to submit | Error: "New date must be different from original" |
| **Time Range Validation** | 1. Set start_time="14:00", end_time="12:00"<br>2. Attempt to submit | Error: "Start time must be before end time" |
| **Scheduled Activation** | 1. Set is_active="scheduled"<br>2. Leave scheduled_activation_datetime empty<br>3. Attempt to submit | Error shown, datetime picker highlighted |
| **Max Session Limit** | 1. Select 101 sessions<br>2. Attempt to open modal | Error: "Cannot clone more than 100 sessions at once" |

---

## 10. Security Considerations

### 10.1 Authentication & Authorization

- **Requirement**: All clone requests MUST pass through `requireAdmin` middleware
- **Token Validation**: Verify Supabase JWT token on every request
- **Rate Limiting**: Enforce per-user rate limits (e.g., max 10 clone operations per minute)

### 10.2 Input Validation

- **Server-Side Validation**: NEVER trust client-side validation alone
- **Joi Schema Enforcement**: All requests validated against `clone` schema
- **Date Validation**: Ensure date is different from source (prevent accidental same-date clones)
- **XSS Prevention**: Sanitize all user inputs before logging or displaying

### 10.3 Data Integrity

- **Total Bookings Reset**: ALWAYS set `total_bookings` to 0 for cloned sessions
- **Name Generation**: Auto-generate `mock_exam_name` to ensure uniqueness
- **Property Merging**: Validate merged properties meet all business rules
- **Audit Trail**: Log all clone operations with source session, cloned count, and admin user

---

## 11. Monitoring & Observability

### 11.1 Logging

**Log Events**:
```javascript
// Request received
console.log(`[Clone] Request from ${user.email}: ${sessionIds.length} sessions`);

// Property merging
console.log(`[Clone] Merging properties: ${Object.keys(overrides).length} overrides`);

// HubSpot API calls
console.log(`[Clone] Batch ${batchNum}: Creating ${chunk.length} cloned sessions`);

// Success
console.log(`[Clone] Complete: ${summary.created} created, ${summary.failed} failed (${executionTime}ms)`);

// Failure
console.error(`[Clone] Error: ${error.message}`, { sessionIds, overrides });
```

### 11.2 Metrics

**Track**:
- Clone request count (per day/week/month)
- Average session count per clone request
- Success rate (%)
- Partial failure rate (%)
- Average execution time (ms)
- HubSpot API call count (per clone)
- Most commonly overridden fields
- Pre-population vs. blank form usage ratio

**Alerts**:
- Success rate drops below 90%
- Average execution time exceeds 20 seconds
- HubSpot API errors exceed 5% of calls
- More than 3 timeouts per day

---

## 12. Future Enhancements

### Phase 2 Features (Post-MVP)

1. **Clone to Multiple Dates**
   - Enter multiple dates in modal (e.g., "Every Saturday for 8 weeks")
   - Auto-generate date sequence based on interval
   - Clone source session to all specified dates

2. **Clone Templates**
   - Save common clone configurations as templates
   - "Clone to next week with same time"
   - "Clone to all locations on same date"

3. **Smart Date Suggestions**
   - Suggest next available date based on existing sessions
   - Detect gaps in weekly schedule and suggest filling
   - Warn if cloning to date with existing session

4. **Bulk Clone from Detail Page**
   - Add "Clone" button to individual session detail page
   - Quick clone: +7 days, same properties
   - Advanced clone: Open modal with pre-population

5. **Clone History**
   - Show clone lineage (source → clone 1, clone 2, etc.)
   - "View all clones of this session"
   - Audit trail with clone relationships

6. **Clone with Associations**
   - Option to clone associated records (e.g., prerequisites)
   - Bulk copy session relationships

---

## 13. Dependencies & Risks

### 13.1 Dependencies

| Dependency | Purpose | Risk Level | Mitigation |
|------------|---------|-----------|------------|
| HubSpot Batch Create API | Core functionality | High | Use exponential backoff, handle rate limits |
| HubSpot Batch Read API | Fetch source sessions | High | Implement retry logic |
| Headless UI Dialog | Modal component | Low | Well-established library, stable |
| React Query | State management | Low | Already used extensively |
| Joi Validation | Request validation | Low | Core validation library |
| Redis Cache | Cache invalidation | Medium | Handle cache failures gracefully |

### 13.2 Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| HubSpot API rate limit hit | High | Medium | Chunk requests, add delays, retry with backoff |
| Timeout on large batches (100 sessions) | High | Low | Monitor execution time, warn at 55s |
| User clones with same date as source | Medium | Medium | Validation prevents, clear error message |
| Invalid data causing HubSpot API rejection | Medium | Medium | Comprehensive validation before API calls |
| Cache invalidation failures | Low | Low | Non-critical, eventual consistency acceptable |
| Modal rendering performance issues | Low | Very Low | Optimize with React.memo, virtualize preview if needed |

---

## 14. Acceptance Criteria

### 14.1 Must Have (MVP)

- [ ] Admin can select 1-100 sessions from dashboard
- [ ] "Clone" button appears in toolbar
- [ ] Modal displays with 8 fields (1 required, 7 optional)
- [ ] Form pre-populates when 1 session selected (date +7 days)
- [ ] Form is blank when multiple sessions selected
- [ ] Date field is required and validated (must differ from source)
- [ ] Empty fields use source session values
- [ ] Populated fields override source values for ALL clones
- [ ] `mock_exam_name` auto-generates correctly
- [ ] `total_bookings` set to 0 for all clones
- [ ] All validation rules enforced (date, times, scheduled activation)
- [ ] NO confirmation input required (simpler UX)
- [ ] Success toast shows cloned count
- [ ] Partial failures handled with clear feedback
- [ ] Cache and React Query invalidated after cloning
- [ ] Dashboard refreshes with cloned sessions
- [ ] Audit trail created for source sessions
- [ ] Cloning completes in <20 seconds for 100 sessions
- [ ] No Vercel timeout errors

### 14.2 Should Have

- [ ] Session preview table shows selected sessions
- [ ] Info banner explains pre-population behavior
- [ ] Progress indicator for operations >3 seconds
- [ ] ESC key closes modal (when not submitting)
- [ ] Form field tooltips with helpful hints
- [ ] Keyboard navigation works throughout
- [ ] Mobile-responsive layout
- [ ] Dark mode support

### 14.3 Could Have (Future)

- [ ] Clone to multiple dates feature
- [ ] Clone templates
- [ ] Smart date suggestions
- [ ] Clone from detail page
- [ ] Clone history tracking

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

**Request Example (Single Session)**:
```bash
curl -X POST https://app.prepdoctors.com/api/admin/mock-exams/clone \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "cloneSources": [
      {
        "sourceSessionId": "123456",
        "sourceProperties": {
          "mock_type": "Clinical Skills",
          "location": "Mississauga",
          "exam_date": "2025-02-08",
          "capacity": "10",
          "start_time": "14:00",
          "end_time": "16:00",
          "is_active": "active",
          "scheduled_activation_datetime": ""
        }
      }
    ],
    "overrides": {
      "exam_date": "2025-03-15",
      "location": "Calgary"
    }
  }'
```

**Request Example (Multiple Sessions)**:
```bash
curl -X POST https://app.prepdoctors.com/api/admin/mock-exams/clone \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "cloneSources": [
      {
        "sourceSessionId": "123456",
        "sourceProperties": {
          "mock_type": "Clinical Skills",
          "location": "Mississauga",
          "exam_date": "2025-02-08",
          "capacity": "10",
          "start_time": "14:00",
          "end_time": "16:00",
          "is_active": "active"
        }
      },
      {
        "sourceSessionId": "123457",
        "sourceProperties": {
          "mock_type": "Clinical Skills",
          "location": "Calgary",
          "exam_date": "2025-02-08",
          "capacity": "8",
          "start_time": "10:00",
          "end_time": "12:00",
          "is_active": "active"
        }
      }
    ],
    "overrides": {
      "exam_date": "2025-03-20",
      "capacity": 15
    }
  }'
```

**Response Example**:
```json
{
  "success": true,
  "summary": {
    "total": 3,
    "created": 3,
    "failed": 0,
    "skipped": 0
  },
  "results": {
    "successful": [
      {
        "id": "234567",
        "properties": {
          "mock_exam_name": "Clinical Skills-Calgary-2025-03-20",
          "exam_date": "2025-03-20",
          "location": "Calgary",
          "capacity": "15",
          "total_bookings": "0",
          ...
        }
      },
      ...
    ],
    "failed": []
  },
  "meta": {
    "timestamp": "2025-01-17T15:30:00.000Z",
    "processedBy": "admin@prepdoctors.com",
    "executionTime": 1523
  }
}
```

### C. Related Documentation

- [HubSpot Batch Create API](https://developers.hubspot.com/docs/api/crm/objects#batch-create-objects)
- [HubSpot Batch Read API](https://developers.hubspot.com/docs/api/crm/objects#batch-read-objects)
- [BulkEditModal Component](admin_root/admin_frontend/src/components/admin/BulkEditModal.jsx)
- [BulkCreateModal Component](admin_root/admin_frontend/src/components/admin/BulkCreateModal.jsx)
- [Clone Endpoint Documentation](admin_root/api/admin/mock-exams/clone.js)
- [Validation Schemas](admin_root/api/_shared/validation.js)

---

**End of PRD**

_Confidence Score: 9/10_

_This PRD is comprehensive and actionable, based on thorough analysis of existing bulk edit, bulk create, and mass delete features. The architecture has been optimized to eliminate unnecessary HubSpot API refetches by leveraging pre-loaded session data from the frontend. The design supports cloning multiple sessions with different properties - each clone inherits its source session's unique properties, and overrides are applied additively on top. Minor unknowns: exact HubSpot API rate limits under load, optimal date pre-population strategy (+7 days vs. user preference)._

---

## 📝 PRD Revision History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2025-01-17 | 1.0 | Initial PRD creation | Claude Code |
| 2025-01-17 | 1.1 | **Performance Optimization**: Removed unnecessary HubSpot Batch Read API call - frontend now provides source session properties directly. Updated request schema to `cloneSources` format. Backend uses provided session data instead of refetching from HubSpot. | Claude Code |
