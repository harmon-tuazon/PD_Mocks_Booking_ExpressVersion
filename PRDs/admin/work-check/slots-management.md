# PRD: Work Check Slots Management (Admin CRUD)

**Version:** 1.0.0
**Created:** February 4, 2026
**Status:** Draft
**Confidence Score:** 8/10
**Estimated Effort:** 4-5 days

---

## 1. Overview

### 1.1 Purpose
Provide administrators with the ability to manage work check time slots within the admin portal. This is the core scheduling feature that connects instructors to groups, allowing admins to create, edit, and manage availability slots that trainees can book.

### 1.2 Scope
- Admin API endpoints for slot CRUD operations
- Admin UI page for managing work check slots
- Bulk operations: toggle status, bulk delete, clone, edit
- Scheduled slot activation via cron job (daily at 12:00 PM UTC)
- Filtering by instructor, group, date range, location, status

### 1.3 Out of Scope
- Instructor self-service slot management (covered in Instructor Portal PRD)
- User booking flow (covered in Work Check Booking PRD)
- Group management (covered in Group Management PRD)
- Instructor management (covered in Instructor Management PRD)

### 1.4 Dependencies
- `hubspot_sync.instructors` table (Instructor Management PRD)
- `hubspot_sync.work_check_groups` table (Group Management PRD)
- RBAC permissions system

---

## 2. Database Schema

### 2.1 Table: `hubspot_sync.work_check_slots`

```sql
-- ============================================================
-- CORE ENTITY TABLE: hubspot_sync.work_check_slots
-- Purpose: Time slots for work check sessions
-- Connects instructors to groups with specific time availability
-- ============================================================
CREATE TABLE hubspot_sync.work_check_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instructor_id UUID NOT NULL REFERENCES hubspot_sync.instructors(id) ON DELETE CASCADE,
    group_id VARCHAR(100)[] NOT NULL,  -- Array: multiple groups can book same slot
    slot_date DATE NOT NULL,
    slot_time TIME NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    total_slots INTEGER NOT NULL DEFAULT 1,
    location VARCHAR(255) CHECK (location IN ('Mississauga', 'Vancouver', 'Calgary', 'Montreal', 'Richmond Hill', 'Online')),
    is_active BOOLEAN DEFAULT true,
    available_from TIMESTAMPTZ,  -- Scheduled visibility: NULL = immediately available
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_slot UNIQUE (instructor_id, group_id, slot_date, slot_time)
);

-- Indexes for common queries
CREATE INDEX idx_wcs_group ON hubspot_sync.work_check_slots USING GIN (group_id);
CREATE INDEX idx_wcs_instructor ON hubspot_sync.work_check_slots(instructor_id);
CREATE INDEX idx_wcs_date ON hubspot_sync.work_check_slots(slot_date);
CREATE INDEX idx_wcs_active ON hubspot_sync.work_check_slots(is_active);
CREATE INDEX idx_wcs_available_from ON hubspot_sync.work_check_slots(available_from) WHERE available_from IS NOT NULL;

-- Updated_at trigger
CREATE TRIGGER update_work_check_slots_updated_at
    BEFORE UPDATE ON hubspot_sync.work_check_slots
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### 2.2 Sample Data Structure

```json
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "instructor_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "group_id": ["260128AMGR1", "260128PMGR2"],
  "slot_date": "2026-02-10",
  "slot_time": "09:00:00",
  "duration_minutes": 30,
  "total_slots": 1,
  "location": "Mississauga",
  "is_active": true,
  "available_from": null,
  "created_at": "2026-02-04T10:00:00Z",
  "updated_at": "2026-02-04T10:00:00Z"
}
```

### 2.3 Architecture Notes

**Key Design Decisions:**
- `group_id` is an array to allow a single slot to be bookable by multiple groups
- `instructor_id` uses UUID foreign key with CASCADE delete (deleting instructor removes their slots)
- `available_from` enables scheduled visibility (NULL = immediately active)
- `total_slots` typically 1 for 1-on-1 work checks, but supports group sessions if needed
- `location` uses enum constraint matching mock exam locations

**Relationship Model:**
```
Instructor (1) ───< Slot (N) >─── Group (M)
                      │
                      └── group_id[] array enables M:N relationship
```

---

## 3. API Specification

### 3.1 Endpoints Overview

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | `/api/admin/work-check-slots` | List slots with pagination/filters | `workcheck.view` |
| POST | `/api/admin/work-check-slots` | Create new slot | `workcheck.create` |
| GET | `/api/admin/work-check-slots/:id` | Get single slot | `workcheck.view` |
| PUT | `/api/admin/work-check-slots/:id` | Update slot | `workcheck.edit` |
| DELETE | `/api/admin/work-check-slots/:id` | Delete slot | `workcheck.delete` |
| POST | `/api/admin/work-check-slots/bulk-toggle` | Bulk toggle is_active | `workcheck.edit` |
| POST | `/api/admin/work-check-slots/bulk-delete` | Bulk delete slots | `workcheck.delete` |
| POST | `/api/admin/work-check-slots/clone` | Clone slots | `workcheck.create` |
| POST | `/api/admin/work-check-slots/bulk-edit` | Bulk edit slots | `workcheck.edit` |
| GET | `/api/admin/cron/activate-scheduled-slots` | Cron: Activate scheduled slots | CRON_SECRET |

### 3.2 Endpoint Details

#### GET `/api/admin/work-check-slots` - List Slots

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `limit` | integer | 50 | Records per page (max 100) |
| `instructor_id` | UUID | - | Filter by instructor |
| `group_id` | string | - | Filter by group (partial match on array) |
| `location` | string | - | Filter by location |
| `date_from` | date | - | Filter slots from this date |
| `date_to` | date | - | Filter slots up to this date |
| `is_active` | string | 'all' | Filter: 'true', 'false', 'all' |
| `activation_status` | string | 'all' | Filter: 'immediate', 'scheduled', 'all' |
| `sort_by` | string | 'slot_date' | Sort field: 'slot_date', 'slot_time', 'instructor_name', 'location' |
| `sort_order` | string | 'asc' | 'asc' or 'desc' |

**Response:**
```json
{
  "success": true,
  "pagination": {
    "current_page": 1,
    "total_pages": 5,
    "total_records": 243,
    "records_per_page": 50
  },
  "data": [
    {
      "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "instructor_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "instructor_name": "Dr. Ahmad Judeh",
      "instructor_email": "ahmad.judeh@prepdoctors.com",
      "group_id": ["260128AMGR1", "260128PMGR2"],
      "slot_date": "2026-02-10",
      "slot_time": "09:00:00",
      "duration_minutes": 30,
      "total_slots": 1,
      "booked_slots": 0,
      "available_slots": 1,
      "location": "Mississauga",
      "is_active": true,
      "available_from": null,
      "activation_status": "immediate",
      "created_at": "2026-02-04T10:00:00Z",
      "updated_at": "2026-02-04T10:00:00Z"
    }
  ]
}
```

**Query Logic:**
```sql
SELECT
    s.*,
    i.instructor_name,
    i.email as instructor_email,
    COALESCE(b.booked_count, 0) as booked_slots,
    s.total_slots - COALESCE(b.booked_count, 0) as available_slots,
    CASE
        WHEN s.available_from IS NULL THEN 'immediate'
        WHEN s.available_from <= NOW() THEN 'immediate'
        ELSE 'scheduled'
    END as activation_status
FROM hubspot_sync.work_check_slots s
LEFT JOIN hubspot_sync.instructors i ON s.instructor_id = i.id
LEFT JOIN (
    SELECT slot_id, COUNT(*) as booked_count
    FROM hubspot_sync.work_check_bookings
    WHERE status != 'Cancelled'
    GROUP BY slot_id
) b ON s.id = b.slot_id
WHERE ($1::uuid IS NULL OR s.instructor_id = $1)
  AND ($2::text IS NULL OR $2 = ANY(s.group_id))
  AND ($3::text IS NULL OR s.location = $3)
  AND ($4::date IS NULL OR s.slot_date >= $4)
  AND ($5::date IS NULL OR s.slot_date <= $5)
  AND ($6::boolean IS NULL OR s.is_active = $6)
ORDER BY s.slot_date, s.slot_time
LIMIT $7 OFFSET $8;
```

---

#### POST `/api/admin/work-check-slots` - Create Slot

**Request Body:**
```json
{
  "instructor_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "group_id": ["260128AMGR1", "260128PMGR2"],
  "slot_date": "2026-02-10",
  "slot_time": "09:00",
  "duration_minutes": 30,
  "total_slots": 1,
  "location": "Mississauga",
  "activation_mode": "immediate",
  "available_from": null
}
```

**Validation Rules:**
- `instructor_id`: Required, must exist in instructors table
- `group_id`: Required, non-empty array, each ID must exist in groups table
- `slot_date`: Required, valid date format (YYYY-MM-DD)
- `slot_time`: Required, valid time format (HH:MM)
- `duration_minutes`: Optional, default 30, range 15-120
- `total_slots`: Optional, default 1, range 1-10
- `location`: Required, must be valid enum value
- `activation_mode`: Optional, 'immediate' or 'scheduled', default 'immediate'
- `available_from`: Required if activation_mode is 'scheduled', must be future datetime

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "new-uuid",
    "instructor_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "group_id": ["260128AMGR1", "260128PMGR2"],
    "slot_date": "2026-02-10",
    "slot_time": "09:00:00",
    "duration_minutes": 30,
    "total_slots": 1,
    "location": "Mississauga",
    "is_active": true,
    "available_from": null,
    "created_at": "2026-02-04T10:00:00Z",
    "updated_at": "2026-02-04T10:00:00Z"
  }
}
```

---

#### PUT `/api/admin/work-check-slots/:id` - Update Slot

**Request Body (partial update supported):**
```json
{
  "group_id": ["260128AMGR1", "260128PMGR2", "260128AMGR3"],
  "slot_time": "10:00",
  "duration_minutes": 45,
  "location": "Online"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "instructor_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "group_id": ["260128AMGR1", "260128PMGR2", "260128AMGR3"],
    "slot_date": "2026-02-10",
    "slot_time": "10:00:00",
    "duration_minutes": 45,
    "total_slots": 1,
    "location": "Online",
    "is_active": true,
    "available_from": null,
    "created_at": "2026-02-04T10:00:00Z",
    "updated_at": "2026-02-04T12:30:00Z"
  }
}
```

---

#### DELETE `/api/admin/work-check-slots/:id` - Delete Slot

**Blocking Logic:**
- Slots with existing bookings (non-cancelled) cannot be deleted
- Return 409 Conflict with booking count

**Response (Success):**
```json
{
  "success": true,
  "message": "Slot deleted successfully"
}
```

**Response (Blocked):**
```json
{
  "success": false,
  "error": {
    "code": "SLOT_HAS_BOOKINGS",
    "message": "Cannot delete slot with 3 active booking(s). Cancel bookings first."
  }
}
```

---

### 3.3 Bulk Operations

#### POST `/api/admin/work-check-slots/bulk-toggle` - Bulk Toggle Status

**Request Body:**
```json
{
  "ids": ["uuid-1", "uuid-2", "uuid-3"],
  "action": "toggle"
}
```

**Response:**
```json
{
  "success": true,
  "summary": {
    "total": 3,
    "updated": 3,
    "activated": 2,
    "deactivated": 1,
    "failed": 0
  }
}
```

---

#### POST `/api/admin/work-check-slots/bulk-delete` - Bulk Delete

**Request Body:**
```json
{
  "ids": ["uuid-1", "uuid-2", "uuid-3"]
}
```

**Blocking Logic:**
- Slots with active bookings are NOT deleted
- Returns breakdown of deletable vs blocked

**Response:**
```json
{
  "success": true,
  "summary": {
    "total": 3,
    "deleted": 2,
    "blocked": 1,
    "blocked_details": [
      {
        "id": "uuid-3",
        "reason": "Has 2 active booking(s)",
        "slot_date": "2026-02-10",
        "slot_time": "09:00:00",
        "instructor_name": "Dr. Ahmad Judeh"
      }
    ]
  }
}
```

---

#### POST `/api/admin/work-check-slots/clone` - Clone Slots

**Request Body:**
```json
{
  "ids": ["uuid-1", "uuid-2"],
  "target_instructor_id": "new-instructor-uuid",
  "target_groups": ["NEW_GROUP_1"],
  "date_offset_days": 7,
  "copy_activation_settings": false
}
```

**Clone Logic:**
1. For each source slot, create a new slot with:
   - Same time, duration, location, total_slots
   - New instructor (if provided) or keep original
   - New groups (if provided) or keep original
   - Date shifted by `date_offset_days`
   - `is_active` based on `copy_activation_settings`:
     - `true`: Copy original is_active and available_from
     - `false`: Set is_active=false, available_from=null (draft state)

**Response:**
```json
{
  "success": true,
  "summary": {
    "source_count": 2,
    "created_count": 2,
    "failed_count": 0,
    "created_ids": ["new-uuid-1", "new-uuid-2"]
  }
}
```

---

#### POST `/api/admin/work-check-slots/bulk-edit` - Bulk Edit

**Request Body:**
```json
{
  "ids": ["uuid-1", "uuid-2", "uuid-3"],
  "updates": {
    "location": "Online",
    "duration_minutes": 45,
    "is_active": true
  }
}
```

**Editable Fields (bulk):**
- `location`
- `duration_minutes`
- `total_slots`
- `is_active`
- `group_id` (add or replace)
- `available_from`

**Response:**
```json
{
  "success": true,
  "summary": {
    "total": 3,
    "updated": 3,
    "failed": 0
  }
}
```

---

## 4. Scheduled Activation (Cron Job)

### 4.1 Overview

Similar to mock exam scheduled activation, work check slots can be created in advance with a scheduled visibility date. A daily cron job activates slots whose `available_from` timestamp has passed.

### 4.2 Cron Endpoint

#### GET `/api/admin/cron/activate-scheduled-slots`

**Schedule:** Daily at 12:00 PM UTC (7:00 AM EST / 8:00 AM EDT)

**Vercel Configuration (`admin_root/vercel.json`):**
```json
{
  "crons": [
    {
      "path": "/api/admin/cron/activate-scheduled-slots",
      "schedule": "0 12 * * *"
    }
  ]
}
```

**Authentication:**
```javascript
const authHeader = req.headers.authorization;
if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  return res.status(401).json({ error: 'Unauthorized' });
}
```

**Logic Flow:**
```javascript
1. Query Supabase for slots where:
   - is_active = false
   - available_from IS NOT NULL
   - available_from <= NOW()

2. If slots found:
   - Batch update is_active = true
   - Clear available_from (optional, for cleanup)

3. Log activation summary

4. Return response:
   {
     success: true,
     activated: 15,
     failed: 0,
     timestamp: "2026-02-04T12:00:00Z",
     executionTime: 523
   }
```

### 4.3 Activation Query

```sql
-- Find slots to activate
SELECT id, instructor_id, slot_date, slot_time
FROM hubspot_sync.work_check_slots
WHERE is_active = false
  AND available_from IS NOT NULL
  AND available_from <= NOW();

-- Batch activate
UPDATE hubspot_sync.work_check_slots
SET is_active = true,
    available_from = NULL,
    updated_at = NOW()
WHERE id = ANY($1::uuid[]);
```

### 4.4 Error Handling

- **Partial failures:** Log failed IDs, continue with remaining
- **Database errors:** Return 500 with error details
- **Timeout protection:** Log warning at 55 seconds
- **Idempotency:** Safe to run multiple times (already-active slots ignored)

---

## 5. Validation Schemas

### 5.1 File: `admin_root/api/_shared/validation.js`

```javascript
// Work Check Slot Creation
workCheckSlotCreation: Joi.object({
  instructor_id: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Invalid instructor ID format',
      'any.required': 'Instructor is required'
    }),

  group_id: Joi.array()
    .items(Joi.string().max(100))
    .min(1)
    .max(20)
    .required()
    .messages({
      'array.min': 'At least one group is required',
      'array.max': 'Maximum 20 groups per slot'
    }),

  slot_date: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .required()
    .messages({
      'string.pattern.base': 'Date must be in YYYY-MM-DD format'
    }),

  slot_time: Joi.string()
    .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .required()
    .messages({
      'string.pattern.base': 'Time must be in HH:MM format'
    }),

  duration_minutes: Joi.number()
    .integer()
    .min(15)
    .max(120)
    .default(30),

  total_slots: Joi.number()
    .integer()
    .min(1)
    .max(10)
    .default(1),

  location: Joi.string()
    .valid('Mississauga', 'Vancouver', 'Calgary', 'Montreal', 'Richmond Hill', 'Online')
    .required(),

  activation_mode: Joi.string()
    .valid('immediate', 'scheduled')
    .default('immediate'),

  available_from: Joi.date()
    .iso()
    .min('now')
    .when('activation_mode', {
      is: 'scheduled',
      then: Joi.required()
        .messages({
          'any.required': 'Scheduled activation date/time is required'
        }),
      otherwise: Joi.optional().allow(null)
    })
}).required(),

// Work Check Slot Update
workCheckSlotUpdate: Joi.object({
  group_id: Joi.array()
    .items(Joi.string().max(100))
    .min(1)
    .max(20),

  slot_date: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/),

  slot_time: Joi.string()
    .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/),

  duration_minutes: Joi.number()
    .integer()
    .min(15)
    .max(120),

  total_slots: Joi.number()
    .integer()
    .min(1)
    .max(10),

  location: Joi.string()
    .valid('Mississauga', 'Vancouver', 'Calgary', 'Montreal', 'Richmond Hill', 'Online'),

  is_active: Joi.boolean(),

  available_from: Joi.date()
    .iso()
    .min('now')
    .allow(null)
}).min(1),

// Work Check Slot Bulk Toggle
workCheckSlotBulkToggle: Joi.object({
  ids: Joi.array()
    .items(Joi.string().uuid())
    .min(1)
    .max(100)
    .required(),

  action: Joi.string()
    .valid('toggle', 'activate', 'deactivate')
    .default('toggle')
}).required(),

// Work Check Slot Bulk Delete
workCheckSlotBulkDelete: Joi.object({
  ids: Joi.array()
    .items(Joi.string().uuid())
    .min(1)
    .max(100)
    .required()
}).required(),

// Work Check Slot Clone
workCheckSlotClone: Joi.object({
  ids: Joi.array()
    .items(Joi.string().uuid())
    .min(1)
    .max(50)
    .required(),

  target_instructor_id: Joi.string()
    .uuid()
    .optional(),

  target_groups: Joi.array()
    .items(Joi.string().max(100))
    .optional(),

  date_offset_days: Joi.number()
    .integer()
    .min(-365)
    .max(365)
    .default(7),

  copy_activation_settings: Joi.boolean()
    .default(false)
}).required(),

// Work Check Slot Bulk Edit
workCheckSlotBulkEdit: Joi.object({
  ids: Joi.array()
    .items(Joi.string().uuid())
    .min(1)
    .max(100)
    .required(),

  updates: Joi.object({
    location: Joi.string()
      .valid('Mississauga', 'Vancouver', 'Calgary', 'Montreal', 'Richmond Hill', 'Online'),

    duration_minutes: Joi.number()
      .integer()
      .min(15)
      .max(120),

    total_slots: Joi.number()
      .integer()
      .min(1)
      .max(10),

    is_active: Joi.boolean(),

    group_id: Joi.array()
      .items(Joi.string().max(100))
      .min(1)
      .max(20),

    available_from: Joi.date()
      .iso()
      .allow(null)
  }).min(1).required()
}).required(),

// Work Check Slot List Query
workCheckSlotList: Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
  instructor_id: Joi.string().uuid(),
  group_id: Joi.string().max(100),
  location: Joi.string().valid('Mississauga', 'Vancouver', 'Calgary', 'Montreal', 'Richmond Hill', 'Online'),
  date_from: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/),
  date_to: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/),
  is_active: Joi.string().valid('true', 'false', 'all').default('all'),
  activation_status: Joi.string().valid('immediate', 'scheduled', 'all').default('all'),
  sort_by: Joi.string().valid('slot_date', 'slot_time', 'instructor_name', 'location', 'created_at').default('slot_date'),
  sort_order: Joi.string().valid('asc', 'desc').default('asc')
})
```

---

## 6. Frontend Specification

### 6.1 Page: Work Check Slots (`/work-check/slots`)

**File:** `admin_root/admin_frontend/src/pages/WorkCheckSlots.jsx`

**Layout:**
```
┌─────────────────────────────────────────────────────────────────┐
│ Work Check Slots Management                    [+ Create Slot]  │
│ Manage instructor time slots for work check sessions            │
├─────────────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐             │
│ │ Total    │ │ Active   │ │ Scheduled│ │ Inactive │             │
│ │   243    │ │   180    │ │    45    │ │    18    │             │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘             │
├─────────────────────────────────────────────────────────────────┤
│ Filters:                                                        │
│ [Instructor ▼] [Groups ▼] [Location ▼] [Date Range] [Status ▼] │
│ [Sort By ▼] [Sort Order ▼]              [Search...] [Clear]    │
├─────────────────────────────────────────────────────────────────┤
│ [Selection Toolbar - appears when items selected]               │
│ 5 of 243 slots selected [Clear] [Toggle Status] [Clone] [Delete]│
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ □ │ Date       │ Time  │ Instructor    │ Groups │ Location │ │
│ ├───┼────────────┼───────┼───────────────┼────────┼──────────┤ │
│ │ ☑ │ Feb 10     │ 09:00 │ Dr. Judeh     │ 2      │ Mssga    │ │
│ │ □ │ Feb 10     │ 09:30 │ Dr. Judeh     │ 2      │ Mssga    │ │
│ │ ☑ │ Feb 10     │ 10:00 │ Dr. Lee       │ 1      │ Online   │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ Page 1 of 5  [<] [1] [2] [3] [>]                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Components

#### SlotTable.jsx
- Columns: Checkbox, Date, Time, Duration, Instructor, Groups (count + tooltip), Location, Status, Booked/Total, Actions
- Row click enters selection mode
- Sortable columns: Date, Time, Instructor, Location

#### SlotFilters.jsx
- Instructor dropdown (searchable)
- Group dropdown (searchable, multi-select)
- Location dropdown
- Date range picker (from/to)
- Status filter (All, Active, Scheduled, Inactive)
- Sort by / Sort order

#### SlotSelectionToolbar.jsx
- Shows when slots selected
- Actions: Clear, Toggle Status, Clone, Bulk Edit, Delete
- Similar pattern to InstructorSelectionToolbar

#### SlotFormModal.jsx
- Create/Edit form
- Instructor selector (required)
- Group multi-select (required)
- Date picker
- Time picker
- Duration selector (15/30/45/60/90/120 minutes)
- Total slots (1-10)
- Location dropdown
- Activation mode toggle (Immediate / Scheduled)
- Scheduled datetime picker (conditional)

#### DeleteSlotsModal.jsx
- Type-in confirmation (type count to delete)
- Shows breakdown: deletable vs blocked (with bookings)
- Similar pattern to DeleteInstructorsModal

#### CloneSlotsModal.jsx
- Source slots preview
- Target instructor (optional override)
- Target groups (optional override)
- Date offset (days +/-)
- Copy activation settings toggle

#### BulkEditSlotsModal.jsx
- Fields to update (checkboxes to enable each)
- Location dropdown
- Duration selector
- Total slots
- Status toggle
- Groups multi-select (add/replace mode)

### 6.3 Hooks

#### useWorkCheckSlotsData.js
```javascript
// List slots with React Query
export function useWorkCheckSlotsData(params) {
  return useQuery({
    queryKey: ['work-check-slots', params],
    queryFn: () => workCheckSlotsApi.list(params),
    keepPreviousData: true
  });
}
```

#### useWorkCheckSlotMutations.js
```javascript
export function useWorkCheckSlotMutations() {
  const queryClient = useQueryClient();

  const createSlot = useMutation({
    mutationFn: workCheckSlotsApi.create,
    onSuccess: () => queryClient.invalidateQueries(['work-check-slots'])
  });

  const updateSlot = useMutation({...});
  const deleteSlot = useMutation({...});
  const bulkToggle = useMutation({...});
  const bulkDelete = useMutation({...});
  const cloneSlots = useMutation({...});
  const bulkEdit = useMutation({...});

  return { createSlot, updateSlot, deleteSlot, bulkToggle, bulkDelete, cloneSlots, bulkEdit };
}
```

#### useSlotBulkSelection.js
- Similar pattern to useInstructorBulkSelection
- Manages Set-based selection state

### 6.4 API Service

**File:** `admin_root/admin_frontend/src/services/adminApi.js`

```javascript
export const workCheckSlotsApi = {
  list: (params) => apiClient.get('/admin/work-check-slots', { params }),
  get: (id) => apiClient.get(`/admin/work-check-slots/${id}`),
  create: (data) => apiClient.post('/admin/work-check-slots', data),
  update: (id, data) => apiClient.put(`/admin/work-check-slots/${id}`, data),
  delete: (id) => apiClient.delete(`/admin/work-check-slots/${id}`),
  bulkToggle: (ids, action) => apiClient.post('/admin/work-check-slots/bulk-toggle', { ids, action }),
  bulkDelete: (ids) => apiClient.post('/admin/work-check-slots/bulk-delete', { ids }),
  clone: (data) => apiClient.post('/admin/work-check-slots/clone', data),
  bulkEdit: (ids, updates) => apiClient.post('/admin/work-check-slots/bulk-edit', { ids, updates })
};
```

---

## 7. Navigation & Routing

### 7.1 Sidebar Navigation

Add under "Work Check" section:
```
Work Check
├── Groups
├── Instructors
└── Slots         ← NEW
```

### 7.2 Route Configuration

**File:** `admin_root/admin_frontend/src/App.jsx`

```javascript
{
  path: '/work-check/slots',
  element: <ProtectedRoute permission="workcheck.view"><WorkCheckSlots /></ProtectedRoute>
}
```

---

## 8. Testing Strategy

### 8.1 Unit Tests

- Validation schema tests for all slot operations
- Date/time parsing and formatting
- Group array handling
- Activation status calculation

### 8.2 Integration Tests

- CRUD operations via API
- Bulk operations with mixed success/failure
- Cron job execution
- Permission checks

### 8.3 Manual Testing Checklist

- [ ] Create slot with immediate activation
- [ ] Create slot with scheduled activation
- [ ] Edit slot (single and bulk)
- [ ] Delete slot (with and without bookings)
- [ ] Bulk toggle status
- [ ] Clone slots to different instructor
- [ ] Clone slots with date offset
- [ ] Filter by instructor, group, date range, status
- [ ] Pagination and sorting
- [ ] Cron job activates scheduled slots

---

## 9. Rollout Plan

### Phase 1: Backend (Day 1-2)
- [ ] Create validation schemas
- [ ] Implement CRUD endpoints
- [ ] Implement bulk operation endpoints
- [ ] Implement cron job endpoint
- [ ] Add to vercel.json crons

### Phase 2: Frontend - Core (Day 2-3)
- [ ] Create WorkCheckSlots page
- [ ] Implement SlotTable component
- [ ] Implement SlotFilters component
- [ ] Implement SlotFormModal (create/edit)
- [ ] Add hooks for data fetching and mutations

### Phase 3: Frontend - Bulk Operations (Day 3-4)
- [ ] Implement SlotSelectionToolbar
- [ ] Implement useSlotBulkSelection hook
- [ ] Implement DeleteSlotsModal
- [ ] Implement CloneSlotsModal
- [ ] Implement BulkEditSlotsModal

### Phase 4: Integration & Testing (Day 4-5)
- [ ] Add API service methods
- [ ] Add navigation/routing
- [ ] End-to-end testing
- [ ] Cron job testing in staging
- [ ] Deploy to production

---

## 10. Security Considerations

1. **Permission Checks**
   - All endpoints require `workcheck.*` permissions
   - Cron endpoint requires valid `CRON_SECRET`

2. **Input Validation**
   - All inputs validated with Joi schemas
   - UUID format validation for IDs
   - Array bounds checking for group_id

3. **Data Integrity**
   - Foreign key constraints prevent orphaned slots
   - Booking check before deletion
   - Unique constraint on instructor + groups + date + time

4. **Audit Trail**
   - `created_at` and `updated_at` timestamps
   - Consider adding `created_by` and `updated_by` for accountability

---

## 11. Future Enhancements (V2)

1. **Recurring Slots**
   - Weekly recurring patterns
   - "Every Monday 9:00 AM" template

2. **Conflict Detection**
   - Alert when creating overlapping slots for same instructor

3. **Instructor Self-Service**
   - Allow instructors to manage their own slots (via Instructor Portal)

4. **Bulk Import/Export**
   - CSV import for mass slot creation
   - CSV export for reporting

5. **Calendar View**
   - Visual calendar interface for slot management

6. **Slot Templates**
   - Save and apply slot patterns

---

## Sign-off

- [ ] Technical Review: Backend Lead
- [ ] UX Review: Product Designer
- [ ] Security Review: Security Team
- [ ] Stakeholder Approval: Admin Team Lead

**Estimated Effort**: 4-5 days (32-40 hours)
**Risk Level**: Low (follows established patterns from Instructor Management)
**Priority**: High (core feature for Work Check system)
