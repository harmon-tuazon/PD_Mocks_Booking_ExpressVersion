# PRD: Mock Set Property Implementation

**Document Version:** 1.0
**Created:** December 16, 2025
**Status:** Draft
**Priority:** Medium
**Confidence Score:** 9/10

---

## Executive Summary

This PRD outlines the implementation of a new `mock_set` property for mock exams across both admin_root and user_root applications. The property allows categorizing mock exams into sets A through H, which will be displayed on exam session cards for Clinical Skills, Situational Judgment, and Mock Discussion exam types (excluding Mini-mocks).

---

## Background

### Database Schema (Already Applied)

```sql
-- Enum type created in Supabase
CREATE TYPE mock_set_enum AS ENUM ('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H');

-- Column added to hubspot_mock_exams table
ALTER TABLE hubspot_sync.hubspot_mock_exams
ADD COLUMN mock_set mock_set_enum;
```

### Current State

- The `mock_set` column exists in Supabase but is not yet:
  - Exposed in HubSpot as a property
  - Included in API responses
  - Rendered in frontend UIs
  - Supported in validation schemas
  - Synced between HubSpot and Supabase

---

## Requirements

### Scope Definition

| Scope | Included | Notes |
|-------|----------|-------|
| Mock Exam Objects | ✅ Yes | Primary entity receiving this property |
| Booking Objects | ❌ No | Bookings do not need this property |
| Admin Create Flow | ✅ Yes | New exam creation form |
| Admin View/Edit Flow | ✅ Yes | Exam details page |
| Admin Bulk Edit Flow | ✅ Yes | Multi-select bulk operations |
| Admin Clone Flow | ✅ Yes | Clone existing exams |
| User Exam Cards | ✅ Yes | Display on booking page cards |
| Mini-mock Display | ❌ No | Mini-mocks do not show mock_set |

### Valid Values

```
mock_set_enum: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | null
```

- **Optional field** - can be null/empty
- Single character selection (A-H)
- Stored as enum in Supabase, string in HubSpot

---

## Technical Implementation Plan

### Phase 1: HubSpot Property Creation

**Agent:** hubspot-crm-specialist
**Priority:** P0 (Blocking for other phases)

#### 1.1 Create HubSpot Property

Create a new property on the Mock Exams custom object (`2-50158913`):

| Setting | Value |
|---------|-------|
| Property Name | `mock_set` |
| Label | `Mock Set` |
| Type | `enumeration` |
| Field Type | `select` |
| Group | `mock_exam_information` (or default) |
| Options | A, B, C, D, E, F, G, H |
| Required | No |

**Manual Steps via HubSpot UI:**
1. Navigate to Settings > Data Management > Objects > Custom Objects
2. Select "Mock Exams" object
3. Click "Create property"
4. Configure as above

---

### Phase 2: Admin Root - Backend Implementation

**Agent:** express-backend-architect
**Files to Modify:**

#### 2.1 Validation Schemas

**File:** `admin_root/api/_shared/validation.js`

Add `mock_set` to the following schemas:

```javascript
// Add to mockExamCreation schema (lines ~215-314)
mock_set: Joi.string()
  .valid('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H')
  .allow(null, '')
  .optional()
  .messages({
    'any.only': 'Mock set must be one of: A, B, C, D, E, F, G, H'
  }),

// Add to mockExamUpdate schema (lines ~561-658)
mock_set: Joi.string()
  .valid('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H')
  .allow(null, '')
  .optional(),

// Add to bulkUpdate.updates schema (lines ~692-800)
mock_set: Joi.string()
  .valid('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H')
  .allow(null, '')
  .optional(),

// Add to clone.overrides schema (lines ~818-899)
mock_set: Joi.string()
  .valid('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H')
  .allow(null, '')
  .optional(),

// Add to mockExamBulkCreation.commonProperties schema (lines ~317-478)
mock_set: Joi.string()
  .valid('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H')
  .allow(null, '')
  .optional(),
```

#### 2.2 HubSpot Service - Property Fetching

**File:** `admin_root/api/_shared/hubspot.js`

Ensure `mock_set` is included in the properties array when fetching mock exams:

```javascript
// Find the MOCK_EXAM_PROPERTIES array or equivalent and add:
'mock_set',
```

#### 2.3 Supabase Sync Function

**File:** `admin_root/api/_shared/supabase-data.js`

Update `syncExamToSupabase()` function (~line 418-439):

```javascript
const record = {
  hubspot_id: exam.id,
  mock_exam_name: props.mock_exam_name || null,
  mock_type: props.mock_type || null,
  mock_set: props.mock_set || null,  // ADD THIS LINE
  exam_date: props.exam_date || null,
  // ... rest of existing fields
};
```

#### 2.4 Create Endpoint

**File:** `admin_root/api/admin/mock-exams/create.js`

No changes needed if validation schema is updated - the property will flow through automatically.

#### 2.5 Update Endpoint

**File:** `admin_root/api/admin/mock-exams/update.js`

No changes needed - existing update logic handles all validated properties.

#### 2.6 Bulk Update Endpoint

**File:** `admin_root/api/admin/mock-exams/bulk-update.js`

No changes needed - the property will be included in batch updates automatically.

#### 2.7 Clone Endpoint

**File:** `admin_root/api/admin/mock-exams/clone.js`

Ensure `mock_set` is copied from source properties when cloning:

```javascript
// In the properties mapping section (~line 136-159)
mock_set: finalValues.mock_set || sourceProps.mock_set || null,
```

#### 2.8 Bulk Create Endpoint

**File:** `admin_root/api/admin/mock-exams/bulk-create.js`

No changes needed if validation schema is updated.

---

### Phase 3: Admin Root - Frontend Implementation

**Agent:** react-frontend-architect
**Files to Modify:**

#### 3.1 Constants - Mock Set Options

**File:** `admin_root/admin_frontend/src/constants/examOptions.js` (or create if needed)

```javascript
export const MOCK_SET_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'A', label: 'Set A' },
  { value: 'B', label: 'Set B' },
  { value: 'C', label: 'Set C' },
  { value: 'D', label: 'Set D' },
  { value: 'E', label: 'Set E' },
  { value: 'F', label: 'Set F' },
  { value: 'G', label: 'Set G' },
  { value: 'H', label: 'Set H' },
];

// Exam types that show mock_set
export const MOCK_SET_APPLICABLE_TYPES = [
  'Clinical Skills',
  'Situational Judgment',
  'Mock Discussion'
];
// Note: Mini-mock is explicitly excluded
```

#### 3.2 Exam Details Form (View/Edit)

**File:** `admin_root/admin_frontend/src/components/admin/ExamDetailsForm.jsx`

Add a Select field for `mock_set`:

```jsx
// Import the constants
import { MOCK_SET_OPTIONS, MOCK_SET_APPLICABLE_TYPES } from '../../constants/examOptions';

// Inside the form, add after location or capacity field:
{MOCK_SET_APPLICABLE_TYPES.includes(formData.mock_type) && (
  <FormField label="Mock Set">
    <Select
      value={formData.mock_set || ''}
      onChange={(e) => handleChange('mock_set', e.target.value)}
      options={MOCK_SET_OPTIONS}
    />
  </FormField>
)}
```

#### 3.3 Create Mock Exam Form/Modal

**File:** `admin_root/admin_frontend/src/components/admin/CreateMockExamModal.jsx` (or equivalent)

Add similar Select field with conditional rendering based on `mock_type`.

#### 3.4 Bulk Edit Modal

**File:** `admin_root/admin_frontend/src/components/admin/BulkEditModal.jsx` (or equivalent)

Add `mock_set` to the bulk edit options:

```jsx
// Add to the updates state
const [updates, setUpdates] = useState({
  // ... existing fields
  mock_set: '',
});

// Add Select field (visible for applicable exam types)
<FormField label="Mock Set">
  <Select
    value={updates.mock_set}
    onChange={(e) => setUpdates(prev => ({ ...prev, mock_set: e.target.value }))}
    options={[
      { value: 'KEEP_ORIGINAL', label: 'Keep Original' },
      ...MOCK_SET_OPTIONS
    ]}
  />
</FormField>
```

#### 3.5 Clone Mock Exams Modal

**File:** `admin_root/admin_frontend/src/components/admin/CloneMockExamsModal.jsx`

Add `mock_set` to the overrides form:

```jsx
// Add to overrides state
const [overrides, setOverrides] = useState({
  // ... existing fields
  mock_set: 'KEEP_ORIGINAL',
});

// Add Select field
<FormField label="Mock Set">
  <Select
    value={overrides.mock_set}
    onChange={(e) => setOverrides(prev => ({ ...prev, mock_set: e.target.value }))}
    options={[
      { value: 'KEEP_ORIGINAL', label: 'Keep Original' },
      ...MOCK_SET_OPTIONS
    ]}
  />
</FormField>
```

#### 3.6 Mock Exam List/Table Display (Optional)

**File:** `admin_root/admin_frontend/src/pages/MockExams.jsx` or equivalent table component

Consider adding a column to display mock_set in the exam list:

```jsx
// Add to table columns
{
  header: 'Set',
  accessor: 'mock_set',
  cell: (value) => value ? `Set ${value}` : '-',
  sortable: true,
}
```

---

### Phase 4: User Root - Backend Implementation

**Agent:** express-backend-architect
**Files to Modify:**

#### 4.1 Available Exams Endpoint

**File:** `user_root/api/mock-exams/available.js`

Ensure `mock_set` is included in the API response transformation:

```javascript
// In the response mapping section (~lines 183-196)
{
  mock_exam_id: exam.id,
  exam_date: exam.properties.exam_date,
  // ... existing fields
  mock_set: exam.properties.mock_set || null,  // ADD THIS LINE
  status: availableSlots === 0 ? 'full' :
          availableSlots <= 3 ? 'limited' : 'available'
}
```

#### 4.2 Supabase Data Read

**File:** `user_root/api/_shared/supabase-data.js`

Verify the SELECT query includes `mock_set` (should be automatic with `SELECT *`).

---

### Phase 5: User Root - Frontend Implementation

**Agent:** react-frontend-architect
**Files to Modify:**

#### 5.1 Exam Session Cards

**File:** `user_root/frontend/src/components/ExamSessionsList.jsx`

Add `mock_set` display to exam cards:

```jsx
// Constants for applicable types (can be shared or defined locally)
const MOCK_SET_APPLICABLE_TYPES = [
  'Clinical Skills',
  'Situational Judgment',
  'Mock Discussion'
];

// In the card rendering section (both list and calendar views):
{MOCK_SET_APPLICABLE_TYPES.includes(exam.mock_type) && exam.mock_set && (
  <span className="exam-card__mock-set">
    Set {exam.mock_set}
  </span>
)}
```

#### 5.2 Calendar View

**File:** `user_root/frontend/src/components/shared/CalendarView.jsx`

Add `mock_set` badge to calendar event display:

```jsx
// In the session card within calendar
{MOCK_SET_APPLICABLE_TYPES.includes(session.mock_type) && session.mock_set && (
  <Badge variant="secondary">Set {session.mock_set}</Badge>
)}
```

#### 5.3 Styling

**File:** `user_root/frontend/src/styles/ExamSessionsList.css` (or equivalent)

```css
.exam-card__mock-set {
  display: inline-block;
  padding: 2px 8px;
  background-color: #e8f4fd;
  color: #0066cc;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  margin-left: 8px;
}
```

---

### Phase 6: Data Sync & Migration

**Agent:** etl-data-analyst
**Files to Modify:**

#### 6.1 Cron Job - HubSpot to Supabase Sync

**File:** `admin_root/api/admin/cron/sync-exams-backfill-bookings-from-hubspot.js` (or similar)

Ensure the sync includes `mock_set` in the properties fetched from HubSpot.

#### 6.2 Initial Data Population

For existing exams without `mock_set`, the field will be null. Admins can update via:
- Individual exam edit
- Bulk edit functionality
- Direct HubSpot UI

No migration script needed since null is a valid state.

---

## Testing Requirements

**Agent:** validation-gates

### Unit Tests

```javascript
// validation.test.js
describe('mock_set validation', () => {
  it('should accept valid mock_set values A-H', () => {
    const validSets = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    validSets.forEach(set => {
      const result = schemas.mockExamCreation.validate({
        /* required fields */,
        mock_set: set
      });
      expect(result.error).toBeUndefined();
    });
  });

  it('should accept null/empty mock_set', () => {
    const result = schemas.mockExamCreation.validate({
      /* required fields */,
      mock_set: ''
    });
    expect(result.error).toBeUndefined();
  });

  it('should reject invalid mock_set values', () => {
    const result = schemas.mockExamCreation.validate({
      /* required fields */,
      mock_set: 'Z'
    });
    expect(result.error).toBeDefined();
  });
});
```

### Integration Tests

1. **Create exam with mock_set** - Verify HubSpot and Supabase both store the value
2. **Update exam mock_set** - Verify change propagates to both systems
3. **Bulk update mock_set** - Verify batch operations work correctly
4. **Clone exam with mock_set** - Verify property is copied or overridden correctly
5. **API response** - Verify user_root API returns mock_set in response

### E2E Tests

1. Admin creates exam with mock_set 'B' → Verify displays correctly
2. Admin bulk edits 3 exams to set mock_set 'D' → Verify all updated
3. User views CS exam cards → Verify mock_set badge shows
4. User views Mini-mock cards → Verify no mock_set badge

---

## Rollout Plan

### Phase 1: Backend First (Day 1)
1. Create HubSpot property manually
2. Deploy backend validation changes
3. Deploy Supabase sync updates
4. Verify API responses include mock_set

### Phase 2: Admin Frontend (Day 2)
1. Deploy admin UI changes
2. Test create/edit/bulk edit/clone flows
3. Verify data persistence

### Phase 3: User Frontend (Day 3)
1. Deploy user UI changes
2. Verify exam cards display mock_set correctly
3. Verify Mini-mock cards do NOT show mock_set

### Rollback Plan

If issues arise:
1. Frontend: Revert UI components (cards will simply not show the field)
2. Backend: Keep validation accepting mock_set but ignore in processing
3. Database: Column can remain - null values are safe

---

## File Change Summary

### Admin Root

| File | Changes |
|------|---------|
| `api/_shared/validation.js` | Add mock_set to 5 schemas |
| `api/_shared/hubspot.js` | Add mock_set to properties array |
| `api/_shared/supabase-data.js` | Add mock_set to syncExamToSupabase |
| `api/admin/mock-exams/clone.js` | Include mock_set in cloning logic |
| `admin_frontend/src/constants/examOptions.js` | Add MOCK_SET_OPTIONS constant |
| `admin_frontend/src/components/admin/ExamDetailsForm.jsx` | Add mock_set Select field |
| `admin_frontend/src/components/admin/CreateMockExamModal.jsx` | Add mock_set Select field |
| `admin_frontend/src/components/admin/BulkEditModal.jsx` | Add mock_set Select field |
| `admin_frontend/src/components/admin/CloneMockExamsModal.jsx` | Add mock_set Select field |

### User Root

| File | Changes |
|------|---------|
| `api/mock-exams/available.js` | Include mock_set in response |
| `frontend/src/components/ExamSessionsList.jsx` | Display mock_set badge |
| `frontend/src/components/shared/CalendarView.jsx` | Display mock_set badge |
| `frontend/src/styles/ExamSessionsList.css` | Add mock_set styling |

---

## Success Criteria

- [ ] HubSpot property created with correct enum values
- [ ] Validation schemas accept mock_set A-H or null
- [ ] Create exam flow saves mock_set to HubSpot and Supabase
- [ ] Edit exam flow updates mock_set correctly
- [ ] Bulk edit updates mock_set for multiple exams
- [ ] Clone exam copies mock_set from source (with override option)
- [ ] User exam cards show mock_set for CS, SJ, Mock Discussion types
- [ ] User exam cards do NOT show mock_set for Mini-mock type
- [ ] Data syncs correctly between HubSpot and Supabase
- [ ] All tests pass with >70% coverage on new code

---

## Open Questions

1. **Display Priority**: Should mock_set be prominently displayed or subtle on exam cards?
2. **Filtering**: Should users be able to filter exams by mock_set in the future?
3. **Default Value**: Should new exams have a default mock_set or null?

---

## Appendix

### A. Mock Set Visual Mockup (User Cards)

```
┌──────────────────────────────────────────────┐
│  March 15, 2026                              │
│  Clinical Skills          [Set B]            │
│  9:00 AM - 5:00 PM                          │
│  Mississauga                                 │
│  ┌──────────────┐                           │
│  │ 8 spots left │ [Book Now]                │
│  └──────────────┘                           │
└──────────────────────────────────────────────┘
```

### B. Admin Form Mockup

```
Mock Type:      [Clinical Skills     ▼]
Mock Set:       [Set B               ▼]  ← Only shows for CS, SJ, MD
Exam Date:      [2026-03-15          📅]
Location:       [Mississauga         ▼]
Capacity:       [50                   ]
```
