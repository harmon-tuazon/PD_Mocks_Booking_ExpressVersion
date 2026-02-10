# PRD: Work Check Bookings Management (Admin CRUD)

**Version:** 2.1.0
**Created:** February 5, 2026
**Updated:** February 9, 2026
**Status:** Implemented
**Confidence Score:** 9/10
**Estimated Effort:** 5-6 days

---

## 1. Overview

### 1.1 Purpose
Provide administrators with the ability to manage work check bookings within the admin portal. This feature allows admins to view bookings in both **aggregate view** (grouped by date/time/location) and **list view**, create, edit, clone, toggle status, and bulk delete booking records.

### 1.2 Scope
- **Aggregate view**: Group bookings by slot_date + slot_time + location (similar to mock exams)
- Admin API endpoints for booking CRUD operations
- Admin UI page with dual view modes (aggregate/list)
- **Single booking creation** with auto_approve logic
- Bulk operations: toggle status, bulk delete, clone
- Filtering by student, instructor, slot, date range, status, type
- Edit modal for modifying booking properties
- Database view and function for efficient aggregation

### 1.3 Out of Scope
- User-facing booking creation (covered in Work Check Booking PRD)
- Instructor approval/rejection flow (covered in Instructor Portal PRD)
- Slot management (covered in Slots Management PRD)
- Automated booking notifications

### 1.4 Dependencies
- `hubspot_sync.work_check_slots` table (Slots Management PRD)
- `hubspot_sync.hubspot_contact_credits` table (Contact/Student data)
- `hubspot_sync.instructors` table (Instructor Management PRD)
- RBAC permissions system

---

## 2. Database Schema

### 2.1 Table: `hubspot_sync.work_check_bookings`

```sql
-- ============================================================
-- CORE ENTITY TABLE: hubspot_sync.work_check_bookings
-- Purpose: Student bookings for work check sessions
-- Connects students to slots with status tracking
-- ============================================================
CREATE TABLE hubspot_sync.work_check_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slot_id UUID NOT NULL REFERENCES hubspot_sync.work_check_slots(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES hubspot_sync.hubspot_contact_credits(student_id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected', 'cancelled')),
    type TEXT DEFAULT 'Work Check' CHECK (type IN ('Demo', 'Work Check', 'Supervised Session')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,

    CONSTRAINT unique_booking UNIQUE (slot_id, student_id)
);

-- Indexes for common queries
CREATE INDEX idx_wcb_slot ON hubspot_sync.work_check_bookings(slot_id);
CREATE INDEX idx_wcb_student ON hubspot_sync.work_check_bookings(student_id);
CREATE INDEX idx_wcb_status ON hubspot_sync.work_check_bookings(status);
CREATE INDEX idx_wcb_type ON hubspot_sync.work_check_bookings(type);
CREATE INDEX idx_wcb_created ON hubspot_sync.work_check_bookings(created_at);
```

### 2.2 View: `hubspot_sync.booking_details_view`

**Purpose:** Pre-join bookings with slots, instructors, and students for efficient querying.

```sql
-- ============================================================
-- VIEW: hubspot_sync.booking_details_view
-- Purpose: Denormalized view joining bookings with related data
-- Used by: List endpoint and aggregation function
-- ============================================================
CREATE OR REPLACE VIEW hubspot_sync.booking_details_view AS
SELECT
  -- Booking fields
  b.id as booking_id,
  b.slot_id,
  b.student_id,
  b.status,
  b.type,
  b.created_at,
  b.confirmed_at,
  b.cancelled_at,

  -- Slot fields
  s.slot_date,
  s.slot_time,
  s.location,
  s.group_id,
  s.duration_minutes,
  s.instructor_id,
  s.is_active as slot_is_active,

  -- Instructor fields
  i.instructor_name,
  i.email as instructor_email,

  -- Student fields
  c.firstname as student_firstname,
  c.lastname as student_lastname,
  c.email as student_email,

  -- Pre-computed aggregate key for grouping
  CONCAT(
    s.slot_date, '_',
    LOWER(REPLACE(s.location, ' ', '_')), '_',
    TO_CHAR(s.slot_time, 'HH24:MI')
  ) as aggregate_key

FROM hubspot_sync.work_check_bookings b
INNER JOIN hubspot_sync.work_check_slots s ON b.slot_id = s.id
INNER JOIN hubspot_sync.instructors i ON s.instructor_id = i.id
LEFT JOIN hubspot_sync.hubspot_contact_credits c ON b.student_id = c.student_id;
```

### 2.3 Function: `hubspot_sync.get_booking_aggregates`

**Purpose:** Aggregate bookings by slot_date + slot_time + location with preloaded booking details.

```sql
-- ============================================================
-- FUNCTION: hubspot_sync.get_booking_aggregates
-- Purpose: Return aggregated booking data grouped by date/time/location
-- Called via: supabaseAdmin.rpc('get_booking_aggregates', params)
--
-- IMPORTANT: Uses explicit type casts to ensure return type matches
-- ============================================================
DROP FUNCTION IF EXISTS hubspot_sync.get_booking_aggregates(TEXT, DATE, DATE, TEXT, TEXT, UUID, INT, INT);

CREATE OR REPLACE FUNCTION hubspot_sync.get_booking_aggregates(
    p_location TEXT DEFAULT NULL,
    p_date_from DATE DEFAULT NULL,
    p_date_to DATE DEFAULT NULL,
    p_status TEXT DEFAULT NULL,
    p_type TEXT DEFAULT NULL,
    p_instructor_id UUID DEFAULT NULL,
    p_limit INT DEFAULT 20,
    p_offset INT DEFAULT 0
  )
  RETURNS TABLE (
    aggregate_key TEXT,
    slot_date DATE,
    slot_time TIME,
    location TEXT,
    total_bookings BIGINT,
    pending_count BIGINT,
    confirmed_count BIGINT,
    rejected_count BIGINT,
    cancelled_count BIGINT,
    work_check_count BIGINT,
    demo_count BIGINT,
    supervised_count BIGINT,
    instructor_names TEXT[],
    groups TEXT[],
    bookings JSON
  ) AS $$
  BEGIN
    RETURN QUERY
    WITH filtered_bookings AS (
      SELECT *
      FROM hubspot_sync.booking_details_view v
      WHERE (p_location IS NULL OR v.location = p_location)
        AND (p_date_from IS NULL OR v.slot_date >= p_date_from)
        AND (p_date_to IS NULL OR v.slot_date <= p_date_to)
        AND (p_status IS NULL OR v.status = p_status)
        AND (p_type IS NULL OR v.type = p_type)
        AND (p_instructor_id IS NULL OR v.instructor_id = p_instructor_id)
    ),
    unnested_groups AS (
      SELECT
        fb.booking_id,
        unnest(fb.group_id)::TEXT as single_group
      FROM filtered_bookings fb
      WHERE fb.group_id IS NOT NULL
    )
    SELECT
      fb.aggregate_key::TEXT,
      fb.slot_date,
      fb.slot_time::TIME,
      fb.location::TEXT,
      COUNT(DISTINCT fb.booking_id)::BIGINT as total_bookings,
      COUNT(DISTINCT fb.booking_id) FILTER (WHERE fb.status = 'pending')::BIGINT as pending_count,
      COUNT(DISTINCT fb.booking_id) FILTER (WHERE fb.status = 'confirmed')::BIGINT as confirmed_count,
      COUNT(DISTINCT fb.booking_id) FILTER (WHERE fb.status = 'rejected')::BIGINT as rejected_count,
      COUNT(DISTINCT fb.booking_id) FILTER (WHERE fb.status = 'cancelled')::BIGINT as cancelled_count,
      COUNT(DISTINCT fb.booking_id) FILTER (WHERE fb.type = 'Work Check')::BIGINT as work_check_count,
      COUNT(DISTINCT fb.booking_id) FILTER (WHERE fb.type = 'Demo')::BIGINT as demo_count,
      COUNT(DISTINCT fb.booking_id) FILTER (WHERE fb.type = 'Supervised Session')::BIGINT as supervised_count,
      ARRAY_AGG(DISTINCT fb.instructor_name::TEXT)::TEXT[] as instructor_names,
      COALESCE(ARRAY_AGG(DISTINCT ug.single_group) FILTER (WHERE ug.single_group IS NOT NULL), ARRAY[]::TEXT[]) as groups,
      JSON_AGG(
        DISTINCT JSONB_BUILD_OBJECT(
          'id', fb.booking_id,
          'slot_id', fb.slot_id,
          'student_id', fb.student_id,
          'student_name', CONCAT(COALESCE(fb.student_firstname, ''), ' ', COALESCE(fb.student_lastname, '')),
          'student_email', fb.student_email,
          'status', fb.status,
          'type', fb.type,
          'instructor_id', fb.instructor_id,
          'instructor_name', fb.instructor_name,
          'group_id', fb.group_id,
          'created_at', fb.created_at,
          'confirmed_at', fb.confirmed_at,
          'cancelled_at', fb.cancelled_at
        )
      )::JSON as bookings
    FROM filtered_bookings fb
    LEFT JOIN unnested_groups ug ON fb.booking_id = ug.booking_id
    GROUP BY fb.aggregate_key, fb.slot_date, fb.slot_time, fb.location
    ORDER BY fb.slot_date DESC, fb.slot_time ASC
    LIMIT p_limit OFFSET p_offset;
  END;
  $$ LANGUAGE plpgsql;
```

### 2.4 Function: `hubspot_sync.get_booking_aggregates_count`

**Purpose:** Get total count of aggregates for pagination.

```sql
-- ============================================================
-- FUNCTION: hubspot_sync.get_booking_aggregates_count
-- Purpose: Return count of aggregates for pagination
-- ============================================================
CREATE OR REPLACE FUNCTION hubspot_sync.get_booking_aggregates_count(
  p_location TEXT DEFAULT NULL,
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_type TEXT DEFAULT NULL,
  p_instructor_id UUID DEFAULT NULL
)
RETURNS INT AS $$
DECLARE
  result INT;
BEGIN
  SELECT COUNT(DISTINCT aggregate_key) INTO result
  FROM hubspot_sync.booking_details_view v
  WHERE (p_location IS NULL OR v.location = p_location)
    AND (p_date_from IS NULL OR v.slot_date >= p_date_from)
    AND (p_date_to IS NULL OR v.slot_date <= p_date_to)
    AND (p_status IS NULL OR v.status = p_status)
    AND (p_type IS NULL OR v.type = p_type)
    AND (p_instructor_id IS NULL OR v.instructor_id = p_instructor_id);

  RETURN COALESCE(result, 0);
END;
$$ LANGUAGE plpgsql;
```

### 2.5 Required Database Permissions

```sql
-- ============================================================
-- GRANT PERMISSIONS FOR WORK CHECK SYSTEM
-- Only service_role needed (admin API uses supabaseAdmin)
-- ============================================================

-- Tables
GRANT ALL ON hubspot_sync.work_check_bookings TO service_role;
GRANT ALL ON hubspot_sync.work_check_slots TO service_role;
GRANT SELECT ON hubspot_sync.hubspot_contact_credits TO service_role;

-- View
GRANT SELECT ON hubspot_sync.booking_details_view TO service_role;

-- Functions
GRANT EXECUTE ON FUNCTION hubspot_sync.get_booking_aggregates TO service_role;
GRANT EXECUTE ON FUNCTION hubspot_sync.get_booking_aggregates_count TO service_role;
```

**Note:** We only grant to `service_role` because all admin API endpoints use `supabaseAdmin` (service role key). The `authenticated` role is only used for Supabase Auth operations (login, refresh), not for data queries.

---

## 3. Understanding the Database Function

### 3.1 Function Breakdown

#### Parameters (Optional Filters)

```sql
p_location TEXT DEFAULT NULL,      -- Filter by location (e.g., 'Toronto')
p_date_from DATE DEFAULT NULL,     -- Filter: slot_date >= this date
p_date_to DATE DEFAULT NULL,       -- Filter: slot_date <= this date
p_status TEXT DEFAULT NULL,        -- Filter by booking status
p_type TEXT DEFAULT NULL,          -- Filter by booking type
p_instructor_id UUID DEFAULT NULL, -- Filter by instructor
p_limit INT DEFAULT 20,            -- Pagination: max rows
p_offset INT DEFAULT 0             -- Pagination: skip rows
```

All parameters have `DEFAULT NULL`, making them optional. When NULL, no filter is applied for that field.

#### CTE 1: `filtered_bookings`

```sql
WITH filtered_bookings AS (
  SELECT *
  FROM hubspot_sync.booking_details_view v
  WHERE (p_location IS NULL OR v.location = p_location)
    AND (p_date_from IS NULL OR v.slot_date >= p_date_from)
    ...
)
```

**Pattern Explanation:** `(param IS NULL OR column = param)`

| Parameter Value | Evaluation | Result |
|-----------------|------------|--------|
| `NULL` (not set) | `NULL IS NULL` = TRUE | **No filter** - all rows pass |
| `'Toronto'` | `'Toronto' IS NULL` = FALSE, check `v.location = 'Toronto'` | **Filter applied** |

This pattern enables **optional filtering** - each UI filter only applies when the user selects a value.

#### CTE 2: `unnested_groups`

```sql
unnested_groups AS (
  SELECT
    fb.booking_id,
    unnest(fb.group_id)::TEXT as single_group
  FROM filtered_bookings fb
  WHERE fb.group_id IS NOT NULL
)
```

The `group_id` column is an **array** (e.g., `['uuid1', 'uuid2']`). The `unnest()` function expands array elements into rows:

```
Before unnest:              After unnest:
booking_id | group_id       booking_id | single_group
-----------+-----------     -----------+--------------
b1         | [g1, g2]  →    b1         | g1
                            b1         | g2
```

The `::TEXT` cast converts UUIDs to TEXT to match the `RETURNS TABLE` declaration.

#### Aggregate Functions

```sql
COUNT(DISTINCT fb.booking_id)::BIGINT as total_bookings,
COUNT(DISTINCT fb.booking_id) FILTER (WHERE fb.status = 'pending')::BIGINT as pending_count,
```

- `COUNT(DISTINCT ...)` - Count unique booking IDs
- `FILTER (WHERE ...)` - Only count rows matching the condition
- `::BIGINT` - Explicit cast to match return type

```sql
ARRAY_AGG(DISTINCT fb.instructor_name::TEXT)::TEXT[] as instructor_names,
```

- `ARRAY_AGG()` - Collect values into an array
- `DISTINCT` - No duplicates
- `::TEXT[]` - Cast to TEXT array

```sql
JSON_AGG(DISTINCT JSONB_BUILD_OBJECT(...))::JSON as bookings
```

- `JSONB_BUILD_OBJECT('key', value, ...)` - Create JSON object
- `JSON_AGG()` - Collect all JSON objects into an array
- `DISTINCT` - No duplicate objects

### 3.2 Sample Data Flow

#### Input: Raw View Data

| booking_id | slot_date | slot_time | location | status | type | instructor_name | group_id |
|------------|-----------|-----------|----------|--------|------|-----------------|----------|
| b1 | 2024-03-15 | 09:00 | Toronto | pending | Work Check | John Smith | ['g1', 'g2'] |
| b2 | 2024-03-15 | 09:00 | Toronto | confirmed | Work Check | John Smith | ['g1', 'g2'] |
| b3 | 2024-03-15 | 09:00 | Toronto | pending | Demo | John Smith | ['g1', 'g2'] |
| b4 | 2024-03-15 | 14:00 | Vancouver | confirmed | Work Check | Jane Doe | ['g3'] |
| b5 | 2024-03-15 | 14:00 | Vancouver | cancelled | Work Check | Jane Doe | ['g3'] |

#### After GROUP BY

Groups created by `slot_date`, `slot_time`, `location`:

1. **Group: Toronto 09:00** (b1, b2, b3)
2. **Group: Vancouver 14:00** (b4, b5)

#### Output: Aggregated Results

```json
[
  {
    "aggregate_key": "2024-03-15_toronto_09:00",
    "slot_date": "2024-03-15",
    "slot_time": "09:00:00",
    "location": "Toronto",
    "total_bookings": 3,
    "pending_count": 2,
    "confirmed_count": 1,
    "rejected_count": 0,
    "cancelled_count": 0,
    "work_check_count": 2,
    "demo_count": 1,
    "instructor_names": ["John Smith"],
    "groups": ["g1", "g2"],
    "bookings": [
      {"id": "b1", "student_name": "Alice Wong", "status": "pending", ...},
      {"id": "b2", "student_name": "Bob Lee", "status": "confirmed", ...},
      {"id": "b3", "student_name": "Carol Chen", "status": "pending", ...}
    ]
  },
  {
    "aggregate_key": "2024-03-15_vancouver_14:00",
    "slot_date": "2024-03-15",
    "slot_time": "14:00:00",
    "location": "Vancouver",
    "total_bookings": 2,
    "pending_count": 0,
    "confirmed_count": 1,
    "cancelled_count": 1,
    "instructor_names": ["Jane Doe"],
    "groups": ["g3"],
    "bookings": [...]
  }
]
```

### 3.3 Why This Design?

1. **Optional Filtering Pattern** - `(param IS NULL OR column = param)` allows flexible filtering from UI
2. **Database-Side Aggregation** - More efficient than aggregating in Node.js
3. **Preloaded Bookings** - No N+1 queries; bookings included in aggregate response
4. **Type Safety** - Explicit casts ensure return type matches declaration

---

## 4. API Specification

### 4.1 Endpoints Overview

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | `/api/admin/work-check-bookings/aggregates` | List aggregates with preloaded bookings | `workcheck.view` |
| GET | `/api/admin/work-check-bookings` | List bookings (flat list) | `workcheck.view` |
| GET | `/api/admin/work-check-bookings/:id` | Get single booking details | `workcheck.view` |
| **POST** | **`/api/admin/work-check-bookings/create`** | **Create single booking** | `workcheck.create` |
| PUT | `/api/admin/work-check-bookings/:id` | Update booking | `workcheck.edit` |
| DELETE | `/api/admin/work-check-bookings/:id` | Delete booking | `workcheck.delete` |
| POST | `/api/admin/work-check-bookings/bulk-toggle` | Bulk toggle status | `workcheck.edit` |
| POST | `/api/admin/work-check-bookings/bulk-delete` | Bulk delete bookings | `workcheck.delete` |
| POST | `/api/admin/work-check-bookings/clone` | Clone bookings to new slots | `workcheck.create` |
| GET | `/api/admin/students/search` | Search students by name/email/ID | `workcheck.view` |

### 4.2 Create Booking Endpoint (NEW)

#### POST `/api/admin/work-check-bookings/create`

**Purpose:** Allow admins to create a single booking with auto_approve logic.

**Request Body:**
```json
{
  "slot_id": "uuid-of-slot",
  "student_id": "uuid-of-student",
  "type": "Work Check"
}
```

**Auto-Approve Logic:**
```javascript
// Determine status based on slot's auto_approve setting
const shouldAutoApprove = slot.auto_approve !== false; // Default true if not set
const bookingStatus = shouldAutoApprove ? 'confirmed' : 'pending';
const confirmedAt = bookingStatus === 'confirmed' ? new Date().toISOString() : null;
```

| Slot `auto_approve` | Booking Status | `confirmed_at` |
|---------------------|----------------|----------------|
| `true` or `null` | `confirmed` | Set to NOW() |
| `false` | `pending` | `null` |

**Response:**
```json
{
  "success": true,
  "message": "Booking created successfully (auto-confirmed)",
  "data": {
    "id": "new-booking-uuid",
    "slot_id": "...",
    "student_id": "...",
    "status": "confirmed",
    "type": "Work Check",
    "created_at": "2026-02-09T10:00:00Z",
    "confirmed_at": "2026-02-09T10:00:00Z",
    "slot": { ... },
    "student": { ... }
  }
}
```

**Implementation:** `admin_root/api/admin/work-check-bookings/create.js`

### 4.3 Student Search Endpoint (NEW)

#### GET `/api/admin/students/search`

**Purpose:** Search students for the booking creation form.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | string | Search query (name, email, or student_id) |
| `limit` | integer | Max results (default 20) |
| `group_id` | UUID | Optional: filter by group membership |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "student-uuid",
      "student_id": "PREP001",
      "firstname": "John",
      "lastname": "Smith",
      "full_name": "John Smith",
      "email": "john.smith@example.com"
    }
  ]
}
```

**Implementation:** `admin_root/api/admin/students/search.js`

### 4.4 Clone Endpoint - Updated Validation

#### POST `/api/admin/work-check-bookings/clone`

**Updated Behavior:**
- `target_slot_ids` is now **required** (not optional)
- UI enforces selection before allowing clone submission
- Clone respects target slot's `auto_approve` setting

**Request Body:**
```json
{
  "ids": ["booking-uuid-1", "booking-uuid-2"],
  "target_slot_ids": ["slot-uuid-1"],  // REQUIRED
  "preserve_status": false,
  "preserve_type": true
}
```

---

## 5. Validation Schemas

### 5.1 New Schema: `workCheckBookingCreation`

```javascript
// Work Check Booking Creation (Admin)
workCheckBookingCreation: Joi.object({
  slot_id: Joi.string().uuid().required().messages({
    'any.required': 'Slot is required',
    'string.guid': 'Invalid slot ID format'
  }),
  student_id: Joi.string().uuid().required().messages({
    'any.required': 'Student is required',
    'string.guid': 'Invalid student ID format'
  }),
  type: Joi.string()
    .valid('Demo', 'Work Check', 'Supervised Session')
    .default('Work Check')
}),
```

### 5.2 Updated Schema: `workCheckBookingClone`

```javascript
// Work Check Booking Clone - target_slot_ids now required
workCheckBookingClone: Joi.object({
  ids: Joi.array()
    .items(Joi.string().uuid())
    .min(1)
    .max(50)
    .required(),
  target_slot_ids: Joi.array()
    .items(Joi.string().uuid())
    .min(1)
    .required()  // Changed from optional to required
    .messages({
      'any.required': 'Target slot selection is required',
      'array.min': 'At least one target slot must be selected'
    }),
  preserve_status: Joi.boolean().default(false),
  preserve_type: Joi.boolean().default(true)
}).required(),
```

---

## 6. Frontend Components

### 6.1 WorkCheckBookingFormModal (Create/Edit)

**File:** `admin_root/admin_frontend/src/components/admin/WorkCheckBookingFormModal.jsx`

**Modes:**
- **Create Mode** (`booking=null`): Shows slot selector and student search
- **Edit Mode** (`booking=object`): Shows status and type editors

**Key Features:**

#### Button-Triggered Student Search

The student search uses a **button-triggered pattern** (not auto-search on keystroke):

```jsx
// Two state variables for controlled search
const [studentSearch, setStudentSearch] = useState('');           // Input value
const [submittedStudentSearch, setSubmittedStudentSearch] = useState(''); // Submitted query

// Search only triggers on button click
const handleSearchStudents = (e) => {
  e.preventDefault();
  if (studentSearch.trim().length >= 2) {
    setSubmittedStudentSearch(studentSearch.trim());
    setSelectedStudent(null);
  }
};

// UI shows search button
<div className="flex gap-2">
  <input
    value={studentSearch}
    onChange={(e) => setStudentSearch(e.target.value)}
  />
  <button onClick={handleSearchStudents}>Search</button>
</div>
<p className="text-xs text-gray-500">Type at least 2 characters and click Search</p>
```

**Why This Pattern:**
- Reduces unnecessary API calls
- Matches pattern used in GroupDetail page
- Better UX for slower connections

#### Auto-Approve Indicator

Shows whether the selected slot will auto-confirm bookings:

```jsx
{selectedSlot && (
  <div className={`mt-2 flex items-center text-sm ${
    selectedSlot.auto_approve !== false
      ? 'text-green-600'
      : 'text-yellow-600'
  }`}>
    {selectedSlot.auto_approve !== false ? (
      <>
        <CheckCircleIcon className="h-4 w-4 mr-1" />
        Booking will be auto-confirmed
      </>
    ) : (
      <>
        <ClockIcon className="h-4 w-4 mr-1" />
        Booking will require approval (pending)
      </>
    )}
  </div>
)}
```

### 6.2 CloneWorkCheckBookingsModal - Required Target Slot

**Validation Message:**
```jsx
{/* Required indicator */}
<label>
  Target Slot <span className="text-red-500">*</span>
</label>

{/* Validation message when no slot selected */}
{!targetSlotId && (
  <p className="mt-2 text-sm text-red-500">
    Please select a target slot to clone bookings to.
  </p>
)}

{/* Submit button disabled without target */}
<button disabled={!targetSlotId || isCloning}>
  Clone Bookings
</button>
```

### 6.3 Page Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Work Check Bookings                                    [+ Create Booking]   │
│ Manage student bookings for work check sessions                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│ │ Total    │ │ Pending  │ │ Confirmed│ │ Rejected │ │ Cancelled│           │
│ │   243    │ │    45    │ │   180    │ │    8     │ │    10    │           │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
├─────────────────────────────────────────────────────────────────────────────┤
│ Filters: [Location ▼] [Instructor ▼] [Date Range] [Status ▼] [Type ▼]      │
├─────────────────────────────────────────────────────────────────────────────┤
│ [Selection Toolbar when bookings selected]                                  │
│ 5 bookings selected [Clear] [Change Status ▼] [Clone] [Delete]             │
├─────────────────────────────────────────────────────────────────────────────┤
│ │ Date       │ Time  │ Location    │ Instructors  │ Bookings      │ ▼    │ │
│ ├────────────┴───────┴─────────────┴──────────────┴───────────────┴──────┤ │
│ │  Expanded aggregate showing nested bookings...                         │ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Hooks

### 7.1 useWorkCheckBookingMutations

```javascript
export function useWorkCheckBookingMutations() {
  const queryClient = useQueryClient();

  const invalidateBookings = () => {
    queryClient.invalidateQueries(['work-check-bookings']);
    queryClient.invalidateQueries(['work-check-booking-aggregates']);
  };

  // NEW: Create booking mutation
  const createBooking = useMutation({
    mutationFn: (data) => workCheckBookingsApi.create(data),
    onSuccess: (data) => {
      const message = data.message || 'Booking created successfully';
      toast.success(message);
      invalidateBookings();
    },
    onError: (error) => {
      const message = error.response?.data?.error?.message || 'Failed to create booking';
      toast.error(message);
    }
  });

  const updateBooking = useMutation({...});
  const deleteBooking = useMutation({...});
  const bulkToggle = useMutation({...});
  const bulkDelete = useMutation({...});
  const cloneBookings = useMutation({...});

  return {
    createBooking,  // NEW
    updateBooking,
    deleteBooking,
    bulkToggle,
    bulkDelete,
    cloneBookings
  };
}
```

### 7.2 API Service

```javascript
export const workCheckBookingsApi = {
  // NEW: Create single booking
  create: async (data) => {
    const response = await api.post('/admin/work-check-bookings/create', data);
    return response.data;
  },

  // Existing methods...
  aggregates: (params) => api.get('/admin/work-check-bookings/aggregates', { params }),
  list: (params) => api.get('/admin/work-check-bookings', { params }),
  update: (id, data) => api.put(`/admin/work-check-bookings/${id}`, data),
  delete: (id) => api.delete(`/admin/work-check-bookings/${id}`),
  bulkToggle: (ids, targetStatus) => api.post('/admin/work-check-bookings/bulk-toggle', { ids, target_status: targetStatus }),
  bulkDelete: (ids) => api.post('/admin/work-check-bookings/bulk-delete', { ids }),
  clone: (data) => api.post('/admin/work-check-bookings/clone', data)
};

// NEW: Students API
export const studentsApi = {
  search: async (params = {}) => {
    const response = await api.get('/admin/students/search', { params });
    return response.data;
  }
};
```

---

## 8. Implementation Checklist

### Database (Completed)
- [x] Create `booking_details_view`
- [x] Create `get_booking_aggregates` function with type casts
- [x] Create `get_booking_aggregates_count` function
- [x] Grant permissions to service_role

### Backend API (Completed)
- [x] `/api/admin/work-check-bookings/aggregates.js`
- [x] `/api/admin/work-check-bookings/list.js`
- [x] `/api/admin/work-check-bookings/[id].js` (GET, PUT, DELETE)
- [x] `/api/admin/work-check-bookings/create.js` (NEW)
- [x] `/api/admin/work-check-bookings/bulk-toggle.js`
- [x] `/api/admin/work-check-bookings/bulk-delete.js`
- [x] `/api/admin/work-check-bookings/clone.js` (with required target_slot_ids)
- [x] `/api/admin/students/search.js` (NEW)
- [x] Validation schemas in validation.js

### Frontend (Completed)
- [x] WorkCheckBookings page with aggregate view
- [x] WorkCheckBookingFormModal (create/edit modes)
- [x] Button-triggered student search pattern
- [x] Auto-approve indicator in create form
- [x] CloneWorkCheckBookingsModal with required target slot
- [x] DeleteWorkCheckBookingsModal
- [x] Selection toolbar for bulk operations
- [x] React Query hooks and mutations

---

## 9. Troubleshooting

### Common Errors

#### "permission denied for view booking_details_view"

**Cause:** Missing GRANT statement for service_role.

**Fix:**
```sql
GRANT SELECT ON hubspot_sync.booking_details_view TO service_role;
```

#### "structure of query does not match function result type"

**Cause:** Type mismatch between `RETURNS TABLE` and `SELECT` columns.

**Common mismatches:**
- `location VARCHAR` vs actual `TEXT`
- `groups TEXT[]` vs actual `UUID[]` (from unnesting UUID array)

**Fix:** Add explicit type casts in SELECT:
```sql
fb.location::TEXT,
ARRAY_AGG(DISTINCT ug.single_group)::TEXT[] as groups,
```

#### "cannot change return type of existing function"

**Cause:** Trying to use `CREATE OR REPLACE` when changing return type.

**Fix:** Must DROP function first, then CREATE:
```sql
DROP FUNCTION IF EXISTS hubspot_sync.get_booking_aggregates(...);
CREATE OR REPLACE FUNCTION hubspot_sync.get_booking_aggregates(...) ...;
```

---

## 10. Security Considerations

1. **Permission Checks**
   - All endpoints require `workcheck.*` permissions
   - View: `workcheck.view`
   - Create: `workcheck.create`
   - Edit/Toggle: `workcheck.edit`
   - Delete: `workcheck.delete`

2. **Service Role Only**
   - All data operations use `supabaseAdmin` (service role key)
   - No grants needed for `authenticated` role
   - Supabase Public client only used for auth operations

3. **Input Validation**
   - All inputs validated with Joi schemas
   - UUID format validation for IDs
   - Enum validation for status and type

---

## 11. Changelog

### Version 2.1.0 (February 9, 2026)
- Added single booking creation with auto_approve logic
- Added student search endpoint
- Added button-triggered search pattern (matches GroupDetail)
- Added auto-approve indicator in create form
- Made target_slot_ids required for clone operation
- Added detailed database function explanation
- Added sample data flow documentation
- Added troubleshooting section for common errors
- Fixed function type casting issues

### Version 2.0.0 (February 5, 2026)
- Initial PRD with aggregate view
- Database view and functions
- Bulk operations (toggle, delete, clone)

---

## Sign-off

- [x] Technical Review: Backend Lead
- [x] UX Review: Product Designer
- [ ] Security Review: Security Team
- [ ] Stakeholder Approval: Admin Team Lead

**Status**: Implemented
**Risk Level**: Low
**Priority**: High
