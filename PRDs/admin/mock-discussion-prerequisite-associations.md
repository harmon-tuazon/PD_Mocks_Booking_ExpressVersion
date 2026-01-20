# PRD: Mock Discussion Prerequisite Associations

**Status:** Draft
**Created:** 2025-11-05
**Author:** AI Assistant via Claude Code
**Version:** 1.0.0

---

## Executive Summary

This PRD outlines the implementation of a prerequisite association system for Mock Discussion sessions. Admins will be able to associate multiple Clinical Skills or Situational Judgment mock exam sessions as prerequisites for specific Mock Discussion sessions. This creates a booking eligibility requirement where users can only book a Mock Discussion if they have attended at least one of the associated prerequisite exams.

**Key Deliverables:**
- Multi-select component for associating prerequisite mock exams
- Bulk association creation via HubSpot v4 API
- Integration into existing Mock Exam Details page
- Efficient API call patterns to minimize requests

---

## Problem Statement

### Current State
Currently, there is no mechanism to enforce that trainees must complete a mock exam before booking a Mock Discussion session. This can lead to:
- Trainees booking discussions without adequate preparation
- Inefficient use of discussion time
- No structured learning path from exam → discussion

### Desired State
Admins can define prerequisite requirements by associating specific mock exam sessions with Mock Discussion sessions. The system will:
- Allow admins to select multiple Clinical Skills or Situational Judgment exams as prerequisites
- Store associations using HubSpot's custom association features
- Enable future enforcement of booking eligibility based on attendance records

---

## Goals & Success Metrics

### Primary Goals
1. Enable admins to associate prerequisite exams with Mock Discussion sessions
2. Minimize API calls through bulk operations
3. Seamless integration into existing Mock Exam Details workflow
4. Lay foundation for future booking eligibility enforcement

### Success Metrics
- ✅ Admins can associate multiple prerequisite exams in single action
- ✅ Association creation uses single bulk API call (not individual calls)
- ✅ UI only appears for Mock Discussion type exams
- ✅ No degradation in page load performance
- ✅ All associations visible and manageable

### Out of Scope (Phase 2)
- Frontend booking eligibility checks in user_root app
- Attendance verification automation
- Automated notifications to users about prerequisites

---

## User Stories

### Admin Stories

**Story 1: Associate Prerequisites**
```
As an admin
I want to select multiple Clinical Skills or Situational Judgment exams as prerequisites for a Mock Discussion
So that I can define which exams trainees must attend before booking the discussion
```

**Acceptance Criteria:**
- Multi-select component appears when editing Mock Discussion type exams
- Component does NOT appear for other exam types
- Can select multiple exams from filtered list (only CS/SJ types)
- Selection shows exam date, time, location for easy identification
- Can save associations via "Save" button (same as existing edit flow)

**Story 2: View Associated Prerequisites**
```
As an admin
I want to see which exams are associated as prerequisites
So that I can verify and manage the requirements
```

**Acceptance Criteria:**
- When viewing Mock Discussion details, see list of associated prerequisite exams
- List shows exam type, date, time, location
- Can remove individual associations
- Can add more associations at any time

**Story 3: Efficient Association Management**
```
As an admin
I want the system to perform bulk operations
So that changes are fast and don't make excessive API calls
```

**Acceptance Criteria:**
- Multiple associations created in single API call
- No individual API calls per association
- Loading states shown during API operations
- Error handling with clear messages

---

## Technical Requirements

### Frontend Requirements

#### 1. New Component: `PrerequisiteExamSelector`
**Location:** `admin_root/admin_frontend/src/components/admin/PrerequisiteExamSelector.jsx`

**Props:**
```typescript
interface PrerequisiteExamSelectorProps {
  mockExamId: string;
  currentAssociations: string[]; // Array of associated exam IDs
  onChange: (selectedIds: string[]) => void;
  disabled?: boolean;
  className?: string;
}
```

**Features:**
- Multi-select dropdown/checklist interface
- Search/filter functionality
- Display exam info: `{mock_type} - {location} - {exam_date} at {start_time}-{end_time}`
- Loading states while fetching available exams
- Dark mode support
- Accessibility (ARIA labels, keyboard navigation)

#### 2. Integration into `ExamDetailsForm.jsx`
**Location:** `admin_root/admin_frontend/src/components/admin/ExamDetailsForm.jsx`

**Changes:**
- Add conditional rendering: show `PrerequisiteExamSelector` only when `displayData.mock_type === 'Mock Discussion'`
- Add to edit mode (between Status and Exam Date fields)
- Include in form state management
- Add to validation schema (optional field)

**New Section:**
```jsx
{/* Prerequisite Exams - Only for Mock Discussion */}
{displayData.mock_type === 'Mock Discussion' && (
  <div className="col-span-2">
    <Label>Prerequisite Exams (Optional)</Label>
    {isEditing ? (
      <PrerequisiteExamSelector
        mockExamId={displayData.id}
        currentAssociations={displayData.prerequisite_exams || []}
        onChange={(selectedIds) => onFieldChange('prerequisite_exams', selectedIds)}
        disabled={isSaving}
      />
    ) : (
      <PrerequisiteExamsList exams={displayData.prerequisite_exam_details || []} />
    )}
  </div>
)}
```

#### 3. View Component: `PrerequisiteExamsList`
**Purpose:** Display associated prerequisite exams in view mode

**Features:**
- Badge-style display of each prerequisite
- Shows exam type, date, time
- Click to navigate to prerequisite exam details
- Empty state message if no prerequisites

#### 4. Data Fetching Strategy: Populating Available Exams

**Question:** How do we populate the options in `PrerequisiteExamSelector`?

**Answer:** Fetch eligible mock exams using existing list endpoint with specific filters.

**Endpoint Used:** `GET /api/admin/mock-exams/list`

**Query Parameters:**
```javascript
{
  mock_type: ['Clinical Skills', 'Situational Judgment'],  // Only CS and SJ
  is_active: true,                                         // Only active exams
  exam_date_from: currentDate,                             // Only future exams
  exam_date_to: mockDiscussionExamDate,                    // Before discussion date
  sort_by: 'exam_date',
  sort_order: 'asc',
  limit: 100                                               // Reasonable limit
}
```

**Filtering Logic:**

**Backend Filters (via API):**
1. ✅ `mock_type` IN ['Clinical Skills', 'Situational Judgment']
2. ✅ `is_active = true`
3. ✅ `exam_date >= today` (only future or ongoing exams)
4. ✅ `exam_date < discussion_exam_date` (must occur before discussion)

**Frontend Filters (in component):**
1. ✅ Exclude currently associated exam IDs (prevent duplicates)
2. ✅ Exclude the Mock Discussion exam itself (prevent self-association)
3. ✅ Search/filter by text (user input)

**Implementation in `PrerequisiteExamSelector`:**

```javascript
// usePrerequisiteExams.js
export function usePrerequisiteExams(mockExamId, discussionExamDate) {
  return useQuery({
    queryKey: ['availablePrerequisites', mockExamId, discussionExamDate],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];

      const response = await mockExamsApi.list({
        mock_type: ['Clinical Skills', 'Situational Judgment'],
        is_active: true,
        exam_date_from: today,
        exam_date_to: discussionExamDate,
        sort_by: 'exam_date',
        sort_order: 'asc',
        limit: 100
      });

      return response.data.mock_exams;
    },
    enabled: !!discussionExamDate, // Only fetch when we have discussion date
    staleTime: 5 * 60 * 1000 // 5 minutes cache
  });
}
```

**Example Data Flow:**

```
1. User clicks "Edit" on Mock Discussion (exam_date: 2026-01-15)

2. Component fetches available exams:
   GET /api/admin/mock-exams/list?mock_type=Clinical%20Skills,Situational%20Judgment
       &is_active=true&exam_date_from=2025-11-05&exam_date_to=2026-01-15

3. Backend returns exam objects with IDs (see data structure below)

4. Component filters out:
   - Currently associated exam IDs
   - The Mock Discussion exam itself

5. Remaining exams shown in multi-select (e.g., 23 options)

6. User searches "Vancouver" → filtered to 5 options

7. User selects 2 exams (component stores their IDs)

8. On save, sends only the 2 selected exam IDs to backend
```

**Critical: Record ID Data Structure**

**Backend API Response Structure:**
```json
{
  "success": true,
  "data": {
    "mock_exams": [
      {
        "id": "18440533951",  // ← THIS is the HubSpot record ID (hs_object_id)
        "properties": {
          "mock_type": "Clinical Skills",
          "exam_date": "2025-12-15",
          "start_time": "1734271200000",
          "end_time": "1734303600000",
          "location": "Mississauga",
          "capacity": "15",
          "total_bookings": "8",
          "is_active": "true"
        },
        "createdAt": "2025-11-01T10:30:00.000Z",
        "updatedAt": "2025-11-04T15:45:00.000Z"
      },
      {
        "id": "18440533952",  // ← Another exam's record ID
        "properties": {
          "mock_type": "Situational Judgment",
          "exam_date": "2025-12-20",
          // ...
        }
      }
    ]
  }
}
```

**Key Points:**
- ✅ Each exam object has an `id` field - this is the HubSpot record ID
- ✅ This `id` is what we use for creating associations
- ✅ The `id` is automatically returned by HubSpot's Search API
- ✅ No additional lookup needed - the ID is already there!

**Frontend Component State:**

```javascript
// PrerequisiteExamSelector component
const [selectedExamIds, setSelectedExamIds] = useState([]);

// When user clicks checkbox
const handleExamSelect = (examId) => {
  setSelectedExamIds(prev => {
    if (prev.includes(examId)) {
      return prev.filter(id => id !== examId);  // Unselect
    }
    return [...prev, examId];  // Select
  });
};

// Display each exam in the list
{availableExams.map(exam => (
  <div key={exam.id}>
    <Checkbox
      checked={selectedExamIds.includes(exam.id)}
      onCheckedChange={() => handleExamSelect(exam.id)}  // ← Stores exam.id
    />
    <span>{exam.properties.mock_type} - {exam.properties.location}</span>
  </div>
))}

// On save
const handleSave = () => {
  // Send array of selected IDs to backend
  onChange(selectedExamIds);  // ["18440533951", "18440533952"]
};
```

**Backend Association Creation:**

```javascript
// POST /api/admin/mock-exams/[id]/prerequisites
// Request body: { prerequisite_exam_ids: ["18440533951", "18440533952"] }

const batchAssociationInputs = prerequisiteExamIds.map(prereqId => ({
  from: { id: mockDiscussionId },       // e.g., "18440533960"
  to: { id: prereqId },                 // e.g., "18440533951"
  types: [{
    associationCategory: "USER_DEFINED",
    associationTypeId: 1340
  }]
}));

// Single batch API call to HubSpot
await hubspot.apiCall('POST',
  '/crm/v4/associations/mock_exams/mock_exams/batch/create',
  { inputs: batchAssociationInputs }
);
```

**Complete ID Flow:**

```
1. HubSpot Database
   └─> Mock Exam Record (hs_object_id: "18440533951")

2. Backend GET /api/admin/mock-exams/list
   └─> Returns { id: "18440533951", properties: {...} }

3. Frontend Component State
   └─> selectedExamIds = ["18440533951", "18440533952"]

4. Frontend POST to Backend
   └─> { prerequisite_exam_ids: ["18440533951", "18440533952"] }

5. Backend Batch Association
   └─> HubSpot API creates associations using these IDs

6. HubSpot Database
   └─> Association created: Discussion("18440533960") → Prerequisite("18440533951")
```

**No Additional Lookups Required:**
- ✅ The `id` field from the list API response IS the record ID
- ✅ No need to query HubSpot again to get the ID
- ✅ No need to parse or transform the ID
- ✅ Just pass it directly to the association API

**Edge Cases:**

**No Available Exams:**
```
- Show: "No eligible prerequisite exams found"
- Suggest: "Create Clinical Skills or Situational Judgment exams
           scheduled before this discussion date"
```

**Discussion Date Not Set:**
```
- Disable selector
- Show: "Set exam date first to see available prerequisites"
```

**Discussion in Past:**
```
- Show all CS/SJ exams before discussion date (even if past)
- Allow association (for historical records)
```

### Backend Requirements

#### 1. New API Endpoint: Bulk Associate Prerequisites
**Endpoint:** `POST /api/admin/mock-exams/[id]/prerequisites`

**Request Body:**
```json
{
  "prerequisite_exam_ids": ["exam_id_1", "exam_id_2", "exam_id_3"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "mock_exam_id": "123456",
    "associations_created": 3,
    "prerequisite_exams": [
      {
        "id": "exam_id_1",
        "mock_type": "Clinical Skills",
        "exam_date": "2025-12-15",
        "location": "Mississauga"
      }
    ]
  },
  "message": "Successfully associated 3 prerequisite exams"
}
```

**Implementation:**
1. Validate mock exam exists and is type "Mock Discussion"
2. Validate all prerequisite exam IDs exist
3. Validate all prerequisites are type "Clinical Skills" or "Situational Judgment"
4. Build batch association request
5. Call HubSpot API: `POST /crm/v4/associations/mock_exams/mock_exams/batch/create`
6. Return formatted response with exam details

#### 2. HubSpot API Integration

**Association Details:**
- **Association Type:** `USER_DEFINED`
- **Association Label ID:** `1340`
- **Direction:** Mock Discussion → Prerequisite Mock Exam
- **From Object:** Mock Exams (Discussion)
- **To Object:** Mock Exams (Prerequisites)

**Batch Create Request Format:**
```json
{
  "inputs": [
    {
      "from": { "id": "mock_discussion_id" },
      "to": { "id": "prerequisite_exam_id_1" },
      "types": [
        {
          "associationCategory": "USER_DEFINED",
          "associationTypeId": 1340
        }
      ]
    },
    {
      "from": { "id": "mock_discussion_id" },
      "to": { "id": "prerequisite_exam_id_2" },
      "types": [
        {
          "associationCategory": "USER_DEFINED",
          "associationTypeId": 1340
        }
      ]
    }
  ]
}
```

#### 3. API Endpoint: Get Prerequisite Exams
**Endpoint:** `GET /api/admin/mock-exams/[id]/prerequisites`

**Response:**
```json
{
  "success": true,
  "data": {
    "prerequisite_exams": [
      {
        "id": "exam_id_1",
        "mock_type": "Clinical Skills",
        "exam_date": "2025-12-15",
        "start_time": "08:00",
        "end_time": "17:00",
        "location": "Mississauga",
        "capacity": 15,
        "total_bookings": 12
      }
    ]
  }
}
```

#### 4. API Endpoint: Remove Prerequisite Association
**Endpoint:** `DELETE /api/admin/mock-exams/[id]/prerequisites/[prerequisiteId]`

**Response:**
```json
{
  "success": true,
  "message": "Prerequisite association removed"
}
```

#### 5. Update Existing Endpoint: Get Mock Exam Details
**Endpoint:** `GET /api/admin/mock-exams/[id]`

**Changes:** Add prerequisite exams to response when exam type is "Mock Discussion"

```json
{
  "success": true,
  "data": {
    "id": "123456",
    "mock_type": "Mock Discussion",
    "exam_date": "2026-01-10",
    // ... existing fields
    "prerequisite_exams": [
      {
        "id": "exam_id_1",
        "mock_type": "Clinical Skills",
        "exam_date": "2025-12-15",
        "location": "Mississauga"
      }
    ]
  }
}
```

### Data Model

**HubSpot Objects:**
- **From:** Mock Exams (Mock Discussion type)
- **To:** Mock Exams (Clinical Skills or Situational Judgment types)
- **Association:** Custom, USER_DEFINED, Label ID 1340

**Association Semantics:**
- **Label:** "requires attendance at" or "prerequisite for"
- **Direction:** Unidirectional (Discussion → Prerequisite)
- **Cardinality:** One-to-Many (one discussion can have many prerequisites)

---

## UI/UX Design

### Multi-Select Component Design

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│ Prerequisite Exams (Optional)                           │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 🔍 Search exams...                                  │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                           │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ☑ Clinical Skills - Mississauga - Dec 15, 2025     │ │
│ │    8:00 AM - 5:00 PM                                │ │
│ ├─────────────────────────────────────────────────────┤ │
│ │ ☑ Situational Judgment - Online - Dec 20, 2025     │ │
│ │    9:00 AM - 12:00 PM                               │ │
│ ├─────────────────────────────────────────────────────┤ │
│ │ ☐ Clinical Skills - Vancouver - Dec 22, 2025       │ │
│ │    10:00 AM - 6:00 PM                               │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                           │
│ 📋 2 exams selected                                      │
└─────────────────────────────────────────────────────────┘
```

**View Mode Display:**
```
┌─────────────────────────────────────────────────────────┐
│ Prerequisite Exams                                       │
│ ┌───────────────────────────────────────────────┐      │
│ │ 🎯 Clinical Skills                             │      │
│ │ Mississauga • December 15, 2025 • 8:00-5:00  │      │
│ │ [View Details →]                               │      │
│ └───────────────────────────────────────────────┘      │
│ ┌───────────────────────────────────────────────┐      │
│ │ 📝 Situational Judgment                        │      │
│ │ Online • December 20, 2025 • 9:00-12:00       │      │
│ │ [View Details →]                               │      │
│ └───────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────┘
```

**States:**
1. **Empty:** "No prerequisite exams required for this discussion"
2. **Loading:** Skeleton loaders
3. **Error:** "Failed to load available exams. Please try again."
4. **No Results:** "No Clinical Skills or Situational Judgment exams found"

---

## API Efficiency Strategy

### Minimizing API Calls

**Association Creation - Current Pattern (Inefficient):**
```
For each exam to associate:
  - POST /associations/[fromId]/[toId] × N times
= N API calls for N associations
```

**Association Creation - New Pattern (Efficient):**
```
Single batch request:
  - POST /crm/v4/associations/mock_exams/mock_exams/batch/create
= 1 API call for N associations
```

### Complete API Call Breakdown

**Scenario:** Admin edits Mock Discussion with 3 prerequisite associations

**Total API Calls Required: 3**

1. **GET Mock Exam Details** (on page load)
   ```
   GET /api/admin/mock-exams/[id]?associations=mock_exams:1340
   ```
   Returns: Exam details + existing prerequisite associations

2. **GET Available Exams** (when entering edit mode)
   ```
   GET /api/admin/mock-exams/list?mock_type=Clinical Skills,Situational Judgment
       &is_active=true&exam_date_from=2025-11-05&exam_date_to=2026-01-15
   ```
   Returns: Filtered list of eligible prerequisite exams

3. **POST Create Associations** (on save)
   ```
   POST /api/admin/mock-exams/[id]/prerequisites
   Body: { prerequisite_exam_ids: ["id1", "id2", "id3"] }
   ```
   Internally makes 1 HubSpot batch API call for all 3 associations

**Alternative (Less Efficient) Would Be:**
```
- GET exam details: 1 call
- GET each available exam individually: 25+ calls
- POST each association individually: 3 calls
= 29+ API calls total (vs. 3 calls with our approach)
```

**Load Optimization:**
1. **Initial Load:** Mock exam details fetched (includes associations)
2. **Lazy Load:** Available exams only fetched when "Edit" button clicked
3. **Cache:** Store fetched exam list in React Query cache (5 min staleTime)
4. **Debounce:** Search filter debounced at 300ms (no API calls)
5. **Component State:** Search filtering done client-side (no API calls)

**Association Retrieval:**
1. Include prerequisite associations in main exam details GET request
2. Use HubSpot's `associations` parameter: `?associations=mock_exams:1340`
3. Single request returns exam + associations
4. No separate API call needed to get associated exam details (included in response)

---

## Implementation Plan with Agent Assignments

### Phase 1: Foundation (Backend) - 4-6 hours
**Agent:** `express-backend-architect`

**Tasks:**
1. Create `POST /api/admin/mock-exams/[id]/prerequisites` endpoint
2. Create `GET /api/admin/mock-exams/[id]/prerequisites` endpoint
3. Create `DELETE /api/admin/mock-exams/[id]/prerequisites/[prerequisiteId]` endpoint
4. Add HubSpot batch association helper to `hubspot.js`
5. Update existing GET `/api/admin/mock-exams/[id]` to include associations

**Deliverables:**
- `admin_root/api/admin/mock-exams/[id]/prerequisites/index.js` (POST, GET)
- `admin_root/api/admin/mock-exams/[id]/prerequisites/[prerequisiteId].js` (DELETE)
- Updated `admin_root/api/_shared/hubspot.js` with `batchCreateAssociations()` method

### Phase 2: Frontend Components - 4-6 hours
**Agent:** `react-frontend-architect`

**Tasks:**
1. Create `PrerequisiteExamSelector` component
2. Create `PrerequisiteExamsList` component
3. Create custom hook `usePrerequisiteExams` for data fetching
4. Add Shadcn UI components if needed (Combobox, Command)
5. Implement search/filter logic

**Deliverables:**
- `admin_root/admin_frontend/src/components/admin/PrerequisiteExamSelector.jsx`
- `admin_root/admin_frontend/src/components/admin/PrerequisiteExamsList.jsx`
- `admin_root/admin_frontend/src/hooks/usePrerequisiteExams.js`

### Phase 3: Integration - 2-3 hours
**Agent:** `react-frontend-architect`

**Tasks:**
1. Integrate `PrerequisiteExamSelector` into `ExamDetailsForm.jsx`
2. Update form state management in `useExamEdit` hook
3. Add API service methods in `adminApi.js`
4. Handle save/update logic in edit flow

**Deliverables:**
- Updated `ExamDetailsForm.jsx`
- Updated `admin_root/admin_frontend/src/hooks/useExamEdit.js`
- Updated `admin_root/admin_frontend/src/services/adminApi.js`

### Phase 4: Testing & Validation - 3-4 hours
**Agent:** `validation-gates`

**Tasks:**
1. Write unit tests for backend endpoints
2. Write integration tests for HubSpot API calls
3. Write component tests for React components
4. Manual testing of full workflow
5. Test error handling scenarios

**Test Scenarios:**
- ✅ Create associations for Mock Discussion
- ✅ Component hidden for non-Mock Discussion exams
- ✅ Validation prevents associating non-CS/SJ exams
- ✅ Bulk API call creates all associations
- ✅ Error handling for failed API calls
- ✅ UI updates correctly after save
- ✅ Remove individual associations
- ✅ Search/filter works correctly
- ✅ Loading states display properly
- ✅ Dark mode styling correct

**Deliverables:**
- Test files in `admin_root/api/__tests__/`
- Test files in `admin_root/admin_frontend/src/__tests__/`
- Test coverage report (target: >80%)

### Phase 5: Security & Documentation - 2 hours
**Agent:** `security-compliance-auditor` + `documentation-manager`

**Security Tasks:**
1. Validate admin authentication on all endpoints
2. Verify input sanitization (exam IDs, array length limits)
3. Check for SQL injection vectors (N/A - HubSpot API)
4. Verify authorization (only admins can create associations)
5. Rate limiting considerations

**Documentation Tasks:**
1. Update API documentation
2. Add code comments
3. Update admin user guide
4. Create troubleshooting guide

**Deliverables:**
- Security audit report
- Updated API documentation in `documentation/api/`
- Updated `MOCKS_BOOKING_README.md`

---

## Testing Strategy

### Unit Tests

**Backend:**
```javascript
// admin_root/api/__tests__/mock-exams-prerequisites.test.js
describe('POST /api/admin/mock-exams/[id]/prerequisites', () => {
  test('creates associations for valid prerequisite exam IDs', async () => {
    // Test bulk association creation
  });

  test('rejects non-CS/SJ exam types', async () => {
    // Test validation
  });

  test('returns 404 for non-existent mock exam', async () => {
    // Test error handling
  });

  test('prevents associating prerequisites to non-Discussion exams', async () => {
    // Test business logic validation
  });
});
```

**Frontend:**
```javascript
// admin_root/admin_frontend/src/__tests__/PrerequisiteExamSelector.test.jsx
describe('PrerequisiteExamSelector', () => {
  test('renders exam list with checkboxes', () => {
    // Test rendering
  });

  test('filters exams by search term', () => {
    // Test search functionality
  });

  test('calls onChange with selected IDs', () => {
    // Test event handlers
  });

  test('shows loading state while fetching', () => {
    // Test loading states
  });
});
```

### Integration Tests

**API Integration:**
```javascript
describe('HubSpot Batch Association Integration', () => {
  test('creates multiple associations in single API call', async () => {
    // Test HubSpot v4 batch API
  });

  test('handles partial failures gracefully', async () => {
    // Test error scenarios
  });
});
```

### Manual Testing Checklist

**Admin Workflow:**
- [ ] Navigate to Mock Discussion exam details
- [ ] Click "Edit" button
- [ ] Verify Prerequisite Exams section appears
- [ ] Search for exams in selector
- [ ] Select multiple Clinical Skills exams
- [ ] Select multiple Situational Judgment exams
- [ ] Verify selection count updates
- [ ] Click "Save Changes"
- [ ] Verify success message
- [ ] Refresh page and verify associations persist
- [ ] Click individual prerequisite to view details
- [ ] Remove one prerequisite
- [ ] Verify update succeeds

**Edge Cases:**
- [ ] Attempt to associate prerequisites to non-Discussion exam (should fail/hide UI)
- [ ] Attempt to associate 0 exams (should allow - optional field)
- [ ] Attempt to associate 20+ exams (should work - no hard limit yet)
- [ ] Network error during save (should show error message)
- [ ] HubSpot API timeout (should handle gracefully)

---

## Risk Assessment

### Technical Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| HubSpot API rate limits | High | Low | Use batch operations; implement retry logic |
| Association type ID conflicts | High | Low | Verify 1340 is correct for our portal; document in code |
| Large data sets (1000+ exams) | Medium | Medium | Implement pagination in selector; add search |
| Network latency on save | Low | Medium | Show loading states; implement optimistic UI |
| Association retrieval slow | Medium | Low | Cache associations; lazy load only when needed |

### Business Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Admins create incorrect associations | Medium | Medium | Add confirmation dialog; allow easy removal |
| No exams match date range | Low | Low | Show helpful empty state message |
| Confusion about prerequisite meaning | Low | High | Clear UI labels; add tooltip explanations |

---

## Timeline

**Total Estimated Time:** 15-21 hours

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Backend | 4-6 hours | None |
| Phase 2: Frontend Components | 4-6 hours | None (can parallel with Phase 1) |
| Phase 3: Integration | 2-3 hours | Phases 1 & 2 complete |
| Phase 4: Testing | 3-4 hours | Phase 3 complete |
| Phase 5: Security & Docs | 2 hours | Phase 4 complete |

**Critical Path:** Backend → Integration → Testing
**Parallel Work:** Frontend components can be developed alongside backend

---

## Future Enhancements (Phase 2)

### User-Facing Booking Restrictions
1. Check user's booking history when attempting to book Mock Discussion
2. Verify attendance at least one prerequisite exam
3. Display helpful message: "You must attend [prerequisite exam] before booking this discussion"
4. Show list of available prerequisite exams with booking links

### Admin Features
1. Bulk association management (associate same prerequisites to multiple discussions)
2. Template system (save common prerequisite sets)
3. Analytics: % of users who meet prerequisites
4. Auto-suggest prerequisites based on discussion date

### Automation
1. Automatically suggest prerequisites for new Mock Discussions
2. Notify users when they become eligible (after attending prerequisite)
3. Waiting list system for users who haven't met prerequisites yet

---

## Appendix

### A. HubSpot API Reference

**Batch Create Associations:**
```
POST https://api.hubapi.com/crm/v4/associations/{fromObjectType}/{toObjectType}/batch/create
```

**Documentation:** https://developers.hubspot.com/docs/api/crm/associations

**Request Example:**
```bash
curl --request POST \
  --url 'https://api.hubapi.com/crm/v4/associations/mock_exams/mock_exams/batch/create' \
  --header 'authorization: Bearer YOUR_ACCESS_TOKEN' \
  --header 'content-type: application/json' \
  --data '{
    "inputs": [
      {
        "from": {"id": "discussion_exam_id"},
        "to": {"id": "prerequisite_exam_id"},
        "types": [{
          "associationCategory": "USER_DEFINED",
          "associationTypeId": 1340
        }]
      }
    ]
  }'
```

### B. Mock Types Reference

**Valid Prerequisite Types:**
- Clinical Skills
- Situational Judgment

**Excluded Types:**
- Mini-mock (not eligible as prerequisite)
- Mock Discussion (cannot be prerequisite for itself)

### C. Component Dependencies

**New NPM Packages (if needed):**
- None (using existing Shadcn UI components)

**Shadcn Components:**
- `Checkbox` (existing)
- `Command` (may need to add for search/filter)
- `Popover` (may need for dropdown)
- `Badge` (existing, for exam type display)
- `ScrollArea` (existing, for long lists)

### D. Database Schema (HubSpot)

**No schema changes required** - Using existing Mock Exams object with custom associations.

**Association Definition:**
```
From: Mock Exams (id: 2-50158913)
To: Mock Exams (id: 2-50158913)
Type: USER_DEFINED
Label ID: 1340
Label Name: "requires attendance at" (or configured name in HubSpot)
```

---

## Sign-off

**PRD Approval Required From:**
- [ ] Product Owner: _________________
- [ ] Tech Lead: _________________
- [ ] UX Designer: _________________

**Development Sign-off:**
- [ ] Backend Implementation Complete
- [ ] Frontend Implementation Complete
- [ ] Testing Complete (>80% coverage)
- [ ] Security Audit Complete
- [ ] Documentation Complete

---

**End of PRD**
