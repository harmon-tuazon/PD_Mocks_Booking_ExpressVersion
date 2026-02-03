# PRD: Work Check Booking (User App)

**Version:** 1.0.0
**Created:** January 27, 2026
**Status:** Draft
**Confidence Score:** 8/10
**Estimated Effort:** 3-4 days

---

## 1. Overview

### 1.1 Purpose
Enable trainees to book work check sessions directly through the user portal. Work check slots are pre-configured by admins and assigned to specific groups. Users can only see and book slots that belong to groups they are members of.

### 1.2 Key Differences from Mock Exam Booking

| Aspect | Mock Exam Booking | Work Check Booking |
|--------|-------------------|-------------------|
| **Credits/Tokens** | Required (sj_credits, cs_credits, etc.) | NOT required |
| **Slot Source** | Exam sessions created by admin | Slots assigned to user's group(s) |
| **Eligibility** | Credits + capacity | Group membership + capacity |
| **Duplicate Check** | Same mock_type per date | Per date (across all groups) |
| **Confirmation** | Immediate | Pending → Confirmed/Rejected (optional auto-approve) |

### 1.3 Scope
- **Use existing session authentication** (users already logged in to user_root)
- Display available work check slots for user's groups
- Work check slot selection and booking
- Booking confirmation/pending flow
- View and manage existing work check bookings
- Cancel booking / request changes
- **Multi-tier duplicate prevention** (Redis cache + Supabase query)

### 1.4 Out of Scope
- Admin slot management (covered in Admin PRDs)
- Instructor portal views
- Auto-approval settings management
- Group management (covered in Group Management PRD)

---

## 2. User Flow

### 2.1 Authentication Prerequisite

**IMPORTANT**: Users must be logged in to access work check booking. The user_root app already has authentication via Student ID + Email login. Work check booking uses the existing session.

```
User Login (existing flow in user_root)
    ↓
Navigate to "Book Work Check"
    ↓
System automatically fetches user's groups from session
    ↓
Work Check Booking Flow (2-Step)
```

### 2.2 Booking Journey (2-Step Flow)

```
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1: Select Work Check Slot                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Welcome, John Doe (PREP001)                                 ││
│  │ My Groups: [260128AMGR1] [260128PMGR2]                      ││
│  │ Filter by Group: [All Groups ▼]                             ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ Available Slots                          [Calendar | List]  ││
│  │                                                             ││
│  │ Wednesday, January 29, 2026                                 ││
│  │ ┌─────────────────────────────────────────────────────────┐ ││
│  │ │ 9:00 AM - 9:30 AM │ Dr. Ahmad Judeh │ 260128AMGR1      │ ││
│  │ │ 1 slot available  │ Room 301         │ [Book →]        │ ││
│  │ └─────────────────────────────────────────────────────────┘ ││
│  │ ┌─────────────────────────────────────────────────────────┐ ││
│  │ │ 9:30 AM - 10:00 AM │ Dr. Ahmad Judeh │ 260128AMGR1     │ ││
│  │ │ 1 slot available   │ Room 301         │ [Book →]       │ ││
│  │ └─────────────────────────────────────────────────────────┘ ││
│  │                                                             ││
│  │ Friday, January 31, 2026                                    ││
│  │ ┌─────────────────────────────────────────────────────────┐ ││
│  │ │ 2:00 PM - 2:30 PM │ Dr. Sarah Lee │ 260128PMGR2        │ ││
│  │ │ 1 slot available  │ Room 302       │ [Book →]          │ ││
│  │ └─────────────────────────────────────────────────────────┘ ││
│  │                                                             ││
│  │ ⚠️ You already have a booking on Jan 30 - slots hidden     ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 2: Confirmation                                           │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Work Check Booking Submitted!                               ││
│  │                                                             ││
│  │ ┌─────────────────────────────────────────────────────┐     ││
│  │ │ Date:       Wednesday, January 29, 2026             │     ││
│  │ │ Time:       9:00 AM - 9:30 AM                       │     ││
│  │ │ Instructor: Dr. Ahmad Judeh                         │     ││
│  │ │ Group:      260128AMGR1                             │     ││
│  │ │ Location:   Room 301                                │     ││
│  │ │ Status:     Pending Confirmation                    │     ││
│  │ └─────────────────────────────────────────────────────┘     ││
│  │                                                             ││
│  │ You will be notified when your booking is confirmed.        ││
│  │                                                             ││
│  │ [Book Another Work Check]  [View My Bookings]               ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 My Work Checks Page

```
┌─────────────────────────────────────────────────────────────────┐
│  My Work Checks                                    [+ Book New] │
├─────────────────────────────────────────────────────────────────┤
│  [Upcoming] [Pending] [Completed] [Cancelled] [All]             │
├─────────────────────────────────────────────────────────────────┤
│  Upcoming Work Checks                                           │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Wednesday, January 29, 2026 • 9:00 AM - 9:30 AM             ││
│  │ Dr. Ahmad Judeh • Room 301 • 260128AMGR1                    ││
│  │ Status: Confirmed ✓                                         ││
│  │ [Request Change ▼] [Cancel]                                 ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  Pending Reservations                                           │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Friday, January 31, 2026 • 2:00 PM - 2:30 PM                ││
│  │ Dr. Sarah Lee • Room 302 • 260128PMGR2                      ││
│  │ Status: Awaiting Confirmation ⏳                             ││
│  │ [Cancel Request]                                            ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Database Schema

### 3.1 Approved Tables

#### `hubspot_sync.work_check_slots`
```sql
-- ============================================================
-- WORK CHECK SLOTS (3-way junction: Instructor ↔ Groups ↔ Time)
-- NOTE: group_id is an ARRAY to allow multiple groups per slot
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

CREATE INDEX idx_wcs_group ON hubspot_sync.work_check_slots USING GIN (group_id);
CREATE INDEX idx_wcs_instructor ON hubspot_sync.work_check_slots(instructor_id);
CREATE INDEX idx_wcs_date ON hubspot_sync.work_check_slots(slot_date);
```

**`available_from` Explanation:**
- `NULL` = Slot is immediately visible and available for booking
- Future timestamp = Slot is hidden until that datetime, then automatically becomes visible
- Use case: Schedule slots in advance but release them for booking at a specific time

#### `hubspot_sync.work_check_bookings`
```sql
-- ============================================================
-- WORK CHECK BOOKINGS (Simplified from work_check_reservations)
-- ============================================================
CREATE TABLE hubspot_sync.work_check_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slot_id UUID NOT NULL REFERENCES hubspot_sync.work_check_slots(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES hubspot_sync.contact_credits(student_id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,

    CONSTRAINT unique_booking UNIQUE (slot_id, student_id)
);

CREATE INDEX idx_wcb_slot ON hubspot_sync.work_check_bookings(slot_id);
CREATE INDEX idx_wcb_student ON hubspot_sync.work_check_bookings(student_id);
CREATE INDEX idx_wcb_status ON hubspot_sync.work_check_bookings(status);
```

### 3.2 Referenced Tables (from Group Management PRD)

#### `hubspot_sync.groups_students` (Junction Table)
```sql
-- This table links students to groups
-- Created in Group Management PRD - NOT duplicated here
-- Uses student_id (UUID) referencing contact_credits.student_id
CREATE TABLE hubspot_sync.groups_students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id VARCHAR(50) NOT NULL REFERENCES hubspot_sync.groups(group_id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES hubspot_sync.contact_credits(student_id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'removed', 'completed')),
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_group_student UNIQUE (group_id, student_id)
);
```

### 3.3 Architecture Notes

**Simplified Design:**
1. **No `work_check_change_requests` table** - Cancellations are handled directly via status update
2. **No `work_check_settings` table** - Auto-approval handled via application config or admin settings table
3. **Renamed `work_check_reservations` to `work_check_bookings`** - Consistent naming
4. **Removed cached fields** - Student details retrieved via JOINs to `contact_credits`
5. **Array `group_id`** - Multiple groups can share the same slot

---

## 4. API Specification

### 4.1 I used the following script for workcheck related permissions:
INSERT INTO public.role_permissions (role, permission)
VALUES 
('instructor', 'workcheck.edit'),
('instructor', 'workcheck.view'),
('super_admin', 'workcheck.create'),
('super_admin', 'workcheck.edit'),
('super_admin', 'workcheck.delete'),
('super_admin', 'workcheck.view'),
('admin', 'workcheck.create'),
('admin', 'workcheck.edit'),
('admin', 'workcheck.delete'),
('admin', 'workcheck.view')
('super_admin', 'groups.create'),
('super_admin', 'groups.edit'),
('super_admin', 'groups.delete'),
('super_admin', 'groups.view'),
('admin', 'groups.create'),
('admin', 'groups.edit'),
('admin', 'groups.delete'),
('admin', 'groups.view'),
('instructor', 'groups.view')



Can you update the PRDs to be aligned with this auth permissions. Look into: PRDs\admin\work-check\group-management.md, PRDs\admin\work-check\instructor-management.md, PRDs\admin\work-check\group-management.mdentication Pattern

**IMPORTANT**: All work check endpoints use the **existing user_root session authentication** pattern.
Users authenticate once via `/api/user/login` (Student ID + Email) and subsequent requests use the cached session.

The session provides:
- `student_id` - from localStorage/sessionStorage
- `email` - from localStorage/sessionStorage
- `contact_id` (Supabase UUID) - fetched on login
- `hubspot_id` - fetched on login

### 4.2 Endpoints Overview

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/work-checks/groups` | Get user's active groups | Session (student_id + email) |
| GET | `/api/work-checks/available` | Get available slots for user's groups | Session (student_id + email) |
| POST | `/api/work-checks/create` | Create work check booking | Session (student_id + email) |
| GET | `/api/work-checks/list` | List user's work check bookings | Session (student_id + email) |
| DELETE | `/api/work-checks/[id]` | Cancel a booking | Session (student_id + email) |

**Removed Endpoints:**
- `/api/work-checks/[id]/request-change` - Change requests handled via direct cancellation
- `/api/work-checks/dismiss-notification` - Notifications handled in UI state

### 4.3 Endpoint Details

#### GET `/api/work-checks/groups` - Get User's Groups

Returns the authenticated user's active groups. Called on page load to populate group filter.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `student_id` | string | Yes | From session |
| `email` | string | Yes | From session |

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "student_id": "uuid-...",
    "student_code": "PREP001",
    "firstname": "John",
    "lastname": "Doe",
    "groups": [
      {
        "group_id": "260128AMGR1",
        "group_name": "January 28 AM Group 1",
        "time_period": "AM",
        "start_date": "2026-01-28",
        "end_date": "2026-03-15",
        "status": "active"
      },
      {
        "group_id": "260128PMGR2",
        "group_name": "January 28 PM Group 2",
        "time_period": "PM",
        "start_date": "2026-01-28",
        "end_date": "2026-03-15",
        "status": "active"
      }
    ],
    "existing_booking_dates": ["2026-01-30"]  // Dates with existing bookings
  }
}
```

**Response (Error - Not in any group):**
```json
{
  "success": false,
  "error": {
    "code": "NO_ACTIVE_GROUPS",
    "message": "You are not enrolled in any active groups. Please contact support."
  }
}
```

---

#### GET `/api/work-checks/available` - Get Available Slots

Returns available work check slots for the user's groups. Automatically filters out slots on dates where user already has a booking.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `student_id` | string | Yes | From session |
| `email` | string | Yes | From session |
| `group_id` | string | No | Filter by specific group |
| `from_date` | string | No | Start date filter (YYYY-MM-DD) |
| `to_date` | string | No | End date filter (YYYY-MM-DD) |

**Response:**
```json
{
  "success": true,
  "data": {
    "groups": ["260128AMGR1", "260128PMGR2"],
    "slots": [
      {
        "slot_id": "uuid-...",
        "instructor_id": "uuid-...",
        "instructor_name": "Dr. Ahmad Judeh",
        "group_id": "260128AMGR1",
        "group_name": "January 28 AM Group 1",
        "slot_date": "2026-01-29",
        "slot_time": "09:00",
        "end_time": "09:30",
        "duration_minutes": 30,
        "location": "Room 301",
        "total_slots": 1,
        "available_slots": 1,
        "is_available": true
      },
      {
        "slot_id": "uuid-...",
        "instructor_id": "uuid-...",
        "instructor_name": "Dr. Sarah Lee",
        "group_id": "260128PMGR2",
        "group_name": "January 28 PM Group 2",
        "slot_date": "2026-01-31",
        "slot_time": "14:00",
        "end_time": "14:30",
        "duration_minutes": 30,
        "location": "Room 302",
        "total_slots": 1,
        "available_slots": 0,
        "is_available": false
      }
    ]
  }
}
```

**Business Logic:**
1. Validate user session (student_id + email)
2. Get user's active groups from `hubspot_sync.groups_students`
3. **TIER 1 Duplicate Check**: Get user's existing booking dates (for visual filtering)
4. Fetch slots where:
   - `group_id` array OVERLAPS with user's groups (PostgreSQL `&&` operator)
   - `is_active = true`
   - `slot_date >= CURRENT_DATE`
   - `available_from IS NULL OR available_from <= NOW()`
5. Calculate `available_slots = total_slots - booked_count`
6. Mark slots on existing booking dates as `has_conflict: true`
7. Return `existing_booking_dates` array for frontend to show warning

**PostgreSQL Query for Array Overlap:**
```sql
-- Find slots where group_id array contains any of user's groups
SELECT * FROM hubspot_sync.work_check_slots
WHERE group_id && ARRAY['260128AMGR1', '260128PMGR2']  -- User's groups
  AND is_active = true
  AND slot_date >= CURRENT_DATE
  AND (available_from IS NULL OR available_from <= NOW());
```

---

#### POST `/api/work-checks/create` - Create Reservation

Creates a work check reservation (pending or auto-confirmed).

**Request:**
```json
{
  "student_id": "PREP001",
  "email": "john.doe@example.com",
  "slot_id": "uuid-..."
}
```

**Response (Pending):**
```json
{
  "success": true,
  "data": {
    "reservation_id": "uuid-...",
    "status": "pending",
    "slot": {
      "slot_date": "2026-01-29",
      "slot_time": "09:00",
      "end_time": "09:30",
      "instructor_name": "Dr. Ahmad Judeh",
      "group_name": "January 28 AM Group 1",
      "location": "Room 301"
    },
    "message": "Your booking request has been submitted. You will be notified when it is confirmed."
  }
}
```

**Response (Auto-Approved):**
```json
{
  "success": true,
  "data": {
    "reservation_id": "uuid-...",
    "status": "confirmed",
    "auto_approved": true,
    "slot": {
      "slot_date": "2026-01-29",
      "slot_time": "09:00",
      "end_time": "09:30",
      "instructor_name": "Dr. Ahmad Judeh",
      "group_name": "January 28 AM Group 1",
      "location": "Room 301"
    },
    "message": "Your work check has been booked successfully!"
  }
}
```

**Business Logic (with Multi-Tier Duplicate Prevention):**
1. Validate user session (student_id + email)
2. Verify user is in the slot's group
3. Acquire distributed lock on slot (`wc_slot:{slot_id}`)
4. Check slot availability (capacity)
5. **MULTI-TIER DUPLICATE CHECK:**
   - **TIER 1 (Fast)**: Redis cache check for `wc_booking:{student_id}:{slot_date}`
   - **TIER 2 (Authoritative)**: Supabase query for existing booking on same date
6. Create booking with status:
   - `confirmed` if auto-approve enabled
   - `pending` if auto-approve disabled
7. **Cache the booking** in Redis: `wc_booking:{student_id}:{slot_date}` (TTL: 24 hours)
8. Release lock

**Duplicate Check Details:**
```javascript
// TIER 1: Redis cache check (fast path)
const cacheKey = `wc_booking:${contact.student_id}:${slot.slot_date}`;
const cachedBooking = await redis.get(cacheKey);
if (cachedBooking) {
  return res.status(400).json({
    success: false,
    error: { code: 'DUPLICATE_BOOKING', message: 'You already have a work check scheduled for this date' }
  });
}

// TIER 2: Supabase query (authoritative)
const { data: existingBooking } = await supabaseAdmin
  .from('hubspot_sync.work_check_bookings')
  .select('id, work_check_slots!inner(slot_date)')
  .eq('student_id', contact.student_id)
  .eq('work_check_slots.slot_date', slot.slot_date)
  .in('status', ['pending', 'confirmed'])
  .maybeSingle();

if (existingBooking) {
  // Cache for fast path next time
  await redis.setex(cacheKey, 86400, existingBooking.id);
  return res.status(400).json({
    success: false,
    error: { code: 'DUPLICATE_BOOKING', message: 'You already have a work check scheduled for this date' }
  });
}
```

**Error Responses:**
- `SLOT_FULL` - No available slots
- `DUPLICATE_BOOKING` - Already have a work check on this date
- `NOT_IN_GROUP` - User not in slot's group
- `SLOT_NOT_FOUND` - Slot doesn't exist or inactive
- `SLOT_EXPIRED` - Slot date is in the past
- `NOT_AUTHENTICATED` - Session invalid

---

#### GET `/api/work-checks/list` - List Bookings

Returns user's work check bookings.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `student_id` | string | Yes | From session |
| `email` | string | Yes | From session |
| `filter` | string | No | Filter: upcoming, pending, completed, cancelled, all (default: all) |
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Items per page (default: 20) |

**Response:**
```json
{
  "success": true,
  "pagination": {
    "current_page": 1,
    "total_pages": 1,
    "total_records": 3,
    "records_per_page": 20
  },
  "data": {
    "upcoming": [
      {
        "reservation_id": "uuid-...",
        "slot_id": "uuid-...",
        "status": "confirmed",
        "slot_date": "2026-01-29",
        "slot_time": "09:00",
        "end_time": "09:30",
        "instructor_name": "Dr. Ahmad Judeh",
        "group_id": "260128AMGR1",
        "group_name": "January 28 AM Group 1",
        "location": "Room 301",
        "confirmed_at": "2026-01-27T10:00:00Z"
      }
    ],
    "pending": [
      {
        "reservation_id": "uuid-...",
        "slot_id": "uuid-...",
        "status": "pending",
        "slot_date": "2026-01-31",
        "slot_time": "14:00",
        "end_time": "14:30",
        "instructor_name": "Dr. Sarah Lee",
        "group_id": "260128PMGR2",
        "group_name": "January 28 PM Group 2",
        "location": "Room 302",
        "created_at": "2026-01-27T09:00:00Z"
      }
    ],
    "rejected_notifications": [
      {
        "request_id": "uuid-...",
        "reservation_id": "uuid-...",
        "request_type": "reschedule",
        "reason": "Schedule conflict",
        "admin_notes": "Please select a different time slot",
        "rejected_at": "2026-01-26T15:00:00Z"
      }
    ],
    "confirmed_notifications": [
      {
        "reservation_id": "uuid-...",
        "slot_date": "2026-01-29",
        "slot_time": "09:00",
        "confirmed_at": "2026-01-27T10:00:00Z"
      }
    ]
  }
}
```

---

#### DELETE `/api/work-checks/[id]` - Cancel Reservation

Cancels a pending or confirmed reservation.

**Request:**
```json
{
  "student_id": "PREP001",
  "email": "john.doe@example.com",
  "reason": "Schedule conflict"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "reservation_id": "uuid-...",
    "status": "cancelled",
    "message": "Your work check booking has been cancelled."
  }
}
```

---

#### POST `/api/work-checks/[id]/request-change` - Request Change

Request a reschedule or cancellation (requires admin approval).

**Request (Reschedule):**
```json
{
  "student_id": "PREP001",
  "email": "john.doe@example.com",
  "request_type": "reschedule",
  "new_slot_id": "uuid-...",
  "reason": "Medical appointment conflict"
}
```

**Request (Cancel):**
```json
{
  "student_id": "PREP001",
  "email": "john.doe@example.com",
  "request_type": "cancel",
  "reason": "Personal emergency"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "request_id": "uuid-...",
    "status": "pending",
    "message": "Your change request has been submitted. You will be notified when it is processed."
  }
}
```

---

## 5. Validation Schemas

Add to `user_root/api/_shared/validation.js`:

```javascript
// =====================================================
// WORK CHECK BOOKING SCHEMAS
// Uses existing authCheck pattern for session validation
// =====================================================

// Reuse existing authCheck schema for session validation
// authCheck: Joi.object({
//   student_id: Joi.string().uppercase().pattern(/^[A-Z0-9]+$/).required(),
//   email: Joi.string().email().required()
// })

workCheckGroups: Joi.object({
  student_id: Joi.string()
    .uppercase()
    .pattern(/^[A-Z0-9]+$/)
    .required()
    .messages({
      'string.pattern.base': 'Student ID must contain only letters and numbers',
      'any.required': 'Student ID is required'
    }),
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please enter a valid email address',
      'any.required': 'Email is required'
    })
}),

workCheckAvailable: Joi.object({
  student_id: Joi.string()
    .uppercase()
    .pattern(/^[A-Z0-9]+$/)
    .required(),
  email: Joi.string()
    .email()
    .required(),
  group_id: Joi.string()
    .max(50)
    .optional(),
  from_date: Joi.date()
    .iso()
    .optional(),
  to_date: Joi.date()
    .iso()
    .min(Joi.ref('from_date'))
    .optional()
}),

workCheckCreate: Joi.object({
  student_id: Joi.string()
    .uppercase()
    .pattern(/^[A-Z0-9]+$/)
    .required()
    .messages({
      'any.required': 'Student ID is required'
    }),
  email: Joi.string()
    .email()
    .required()
    .messages({
      'any.required': 'Email is required'
    }),
  slot_id: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Invalid slot ID format',
      'any.required': 'Slot ID is required'
    })
}),

workCheckList: Joi.object({
  student_id: Joi.string()
    .uppercase()
    .pattern(/^[A-Z0-9]+$/)
    .required(),
  email: Joi.string()
    .email()
    .required(),
  filter: Joi.string()
    .valid('upcoming', 'pending', 'completed', 'cancelled', 'all')
    .optional()
    .default('all'),
  page: Joi.number()
    .integer()
    .min(1)
    .optional()
    .default(1),
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .optional()
    .default(20)
}),

workCheckCancel: Joi.object({
  student_id: Joi.string()
    .uppercase()
    .pattern(/^[A-Z0-9]+$/)
    .required(),
  email: Joi.string()
    .email()
    .required(),
  reason: Joi.string()
    .max(500)
    .optional()
    .allow('')
})

// NOTE: workCheckChangeRequest schema removed
// Change requests handled via direct cancellation and rebooking
```

---

## 6. Frontend Architecture

### 6.1 File Structure

```
user_root/frontend/src/
├── components/
│   └── work-checks/
│       ├── WorkCheckBookingPage.jsx      # Main 2-step flow (select → confirm)
│       ├── WorkCheckSlotSelector.jsx     # Step 1: Select slot
│       ├── WorkCheckConfirmation.jsx     # Step 2: Success screen
│       ├── WorkCheckSlotCard.jsx         # Individual slot display
│       ├── WorkCheckSlotCalendar.jsx     # Calendar view of slots
│       ├── MyWorkChecks.jsx              # List/manage bookings
│       ├── WorkCheckBookingCard.jsx      # Individual booking display
│       └── WorkCheckChangeRequestModal.jsx # Change request form
├── hooks/
│   └── useWorkCheckBooking.js            # Booking flow state (uses session)
├── services/
│   └── (add to api.js)                   # API client methods
└── pages/
    └── book/
        └── work-check/
            └── page.jsx                  # Route: /book/work-check
```

### 6.2 Service Integration

**Add to `user_root/frontend/src/services/api.js`:**

```javascript
// Work Check Booking API
// NOTE: Uses session data (studentId, email) from existing user login
workChecks: {
  /**
   * Get user's active groups (uses session credentials)
   * Called on page load to populate group filter
   */
  getGroups: async (studentId, email) => {
    const params = new URLSearchParams({ student_id: studentId, email });
    const response = await api.get(`/work-checks/groups?${params}`);
    return response.data;
  },

  /**
   * Get available work check slots for user's groups
   */
  getAvailable: async (studentId, email, options = {}) => {
    const params = new URLSearchParams({
      student_id: studentId,
      email,
      ...(options.group_id && { group_id: options.group_id }),
      ...(options.from_date && { from_date: options.from_date }),
      ...(options.to_date && { to_date: options.to_date })
    });
    const response = await api.get(`/work-checks/available?${params}`);
    return response.data;
  },

  /**
   * Create work check reservation
   */
  create: async (studentId, email, slotId) => {
    const response = await api.post('/work-checks/create', {
      student_id: studentId,
      email,
      slot_id: slotId
    });
    return response.data;
  },

  /**
   * List user's work check bookings
   */
  list: async (studentId, email, options = {}) => {
    const params = new URLSearchParams({
      student_id: studentId,
      email,
      ...(options.filter && { filter: options.filter }),
      ...(options.page && { page: options.page }),
      ...(options.limit && { limit: options.limit })
    });
    const response = await api.get(`/work-checks/list?${params}`);
    return response.data;
  },

  /**
   * Cancel a reservation
   */
  cancel: async (reservationId, studentId, email, reason = '') => {
    const response = await api.delete(`/work-checks/${reservationId}`, {
      data: { student_id: studentId, email, reason }
    });
    return response.data;
  },

  /**
   * Request a change (reschedule/cancel)
   */
  requestChange: async (reservationId, studentId, email, requestType, options = {}) => {
    const response = await api.post(`/work-checks/${reservationId}/request-change`, {
      student_id: studentId,
      email,
      request_type: requestType,
      ...(options.new_slot_id && { new_slot_id: options.new_slot_id }),
      ...(options.reason && { reason: options.reason })
    });
    return response.data;
  },

  /**
   * Dismiss notification
   */
  dismissNotification: async (type, id, studentId, email) => {
    const response = await api.post('/work-checks/dismiss-notification', {
      type, // 'confirmed' or 'rejected'
      id,
      student_id: studentId,
      email
    });
    return response.data;
  }
}
```

### 6.3 Custom Hook

**Create `user_root/frontend/src/hooks/useWorkCheckBooking.js`:**

```javascript
import { useState, useCallback, useEffect } from 'react';
import { apiService } from '../services/api';
import { getStoredCredentials } from '../utils/auth'; // Existing auth utility

/**
 * Hook for work check booking flow
 * Uses existing session credentials (student_id + email from login)
 */
export function useWorkCheckBooking() {
  const [step, setStep] = useState('loading'); // loading, select, confirming, confirmed, error
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // User data from session
  const [userData, setUserData] = useState(null);
  const [groups, setGroups] = useState([]);
  const [existingBookingDates, setExistingBookingDates] = useState([]);

  // Slot data
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('all');

  // Booking result
  const [bookingResult, setBookingResult] = useState(null);

  // Initialize on mount - fetch user groups using session credentials
  useEffect(() => {
    const initializeBooking = async () => {
      setLoading(true);
      setError(null);

      try {
        // Get credentials from existing session (same pattern as mock booking)
        const credentials = getStoredCredentials();
        if (!credentials?.studentId || !credentials?.email) {
          setError('Please log in to book a work check');
          setStep('error');
          return;
        }

        // Fetch user's groups
        const groupsResponse = await apiService.workChecks.getGroups(
          credentials.studentId,
          credentials.email
        );

        if (groupsResponse.success) {
          setUserData({
            studentId: credentials.studentId,
            email: credentials.email,
            studentUuid: groupsResponse.data.student_id,
            firstName: groupsResponse.data.firstname,
            lastName: groupsResponse.data.lastname
          });
          setGroups(groupsResponse.data.groups);
          setExistingBookingDates(groupsResponse.data.existing_booking_dates || []);

          // Fetch available slots
          const slotsResponse = await apiService.workChecks.getAvailable(
            credentials.studentId,
            credentials.email
          );
          if (slotsResponse.success) {
            setAvailableSlots(slotsResponse.data.slots);
          }

          setStep('select');
        }
      } catch (err) {
        console.error('Failed to initialize work check booking:', err);
        setError(err.response?.data?.error?.message || 'Failed to load booking page');
        setStep('error');
      } finally {
        setLoading(false);
      }
    };

    initializeBooking();
  }, []);

  // Filter by group
  const filteredSlots = selectedGroupFilter === 'all'
    ? availableSlots
    : availableSlots.filter(slot => slot.group_id === selectedGroupFilter);

  // Select slot
  const selectSlot = useCallback((slot) => {
    // Check if slot date conflicts with existing booking
    if (existingBookingDates.includes(slot.slot_date)) {
      setError('You already have a work check scheduled for this date');
      return;
    }
    setSelectedSlot(slot);
    setError(null);
  }, [existingBookingDates]);

  // Submit booking
  const submitBooking = useCallback(async () => {
    if (!userData || !selectedSlot) return;

    setLoading(true);
    setStep('confirming');
    setError(null);

    try {
      const response = await apiService.workChecks.create(
        userData.studentId,
        userData.email,
        selectedSlot.slot_id
      );

      if (response.success) {
        setBookingResult(response.data);
        setStep('confirmed');
        // Add the booked date to existing dates to prevent immediate re-booking
        setExistingBookingDates(prev => [...prev, selectedSlot.slot_date]);
      }
    } catch (err) {
      const errorCode = err.response?.data?.error?.code;
      const errorMessage = err.response?.data?.error?.message || 'Booking failed';

      // Handle duplicate booking error specifically
      if (errorCode === 'DUPLICATE_BOOKING') {
        setExistingBookingDates(prev =>
          prev.includes(selectedSlot.slot_date) ? prev : [...prev, selectedSlot.slot_date]
        );
      }

      setError(errorMessage);
      setStep('select');
    } finally {
      setLoading(false);
    }
  }, [userData, selectedSlot]);

  // Refresh available slots
  const refreshSlots = useCallback(async () => {
    if (!userData) return;

    try {
      const response = await apiService.workChecks.getAvailable(
        userData.studentId,
        userData.email
      );
      if (response.success) {
        setAvailableSlots(response.data.slots);
      }
    } catch (err) {
      console.error('Failed to refresh slots:', err);
    }
  }, [userData]);

  // Auto-refresh slots every 30 seconds when on select step
  useEffect(() => {
    if (step !== 'select') return;

    const interval = setInterval(refreshSlots, 30000);
    return () => clearInterval(interval);
  }, [step, refreshSlots]);

  // Reset for another booking
  const reset = useCallback(() => {
    setSelectedSlot(null);
    setBookingResult(null);
    setError(null);
    setStep('select');
    refreshSlots();
  }, [refreshSlots]);

  return {
    // State
    step,
    loading,
    error,
    userData,
    groups,
    existingBookingDates,
    availableSlots: filteredSlots,
    allSlots: availableSlots,
    selectedSlot,
    selectedGroupFilter,
    bookingResult,

    // Actions
    setSelectedGroupFilter,
    selectSlot,
    submitBooking,
    refreshSlots,
    reset,
    clearError: () => setError(null),
    clearSelectedSlot: () => setSelectedSlot(null)
  };
}
```

---

## 7. API File Structure

```
user_root/api/work-checks/
├── groups.js             # GET /api/work-checks/groups
├── available.js          # GET /api/work-checks/available
├── create.js             # POST /api/work-checks/create
├── list.js               # GET /api/work-checks/list
└── [id].js               # DELETE /api/work-checks/:id (cancel)

# NOTE: Simplified from original design
# - Removed request-change.js - cancellations handled directly
# - Removed dismiss-notification.js - handled in UI state
```

---

## 8. Sample API Implementation

### 8.1 groups.js

```javascript
/**
 * GET /api/work-checks/groups
 * Get authenticated user's active groups using session credentials
 * Called on page load to populate group filter and validate session
 */

const { schemas } = require('../_shared/validation');
const { supabaseAdmin } = require('../_shared/supabase');
const redis = require('../_shared/redis');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED' } });
  }

  try {
    // Validate query parameters (session credentials)
    const { error, value } = schemas.workCheckGroups.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.details[0].message }
      });
    }

    const { student_id, email } = value;

    console.log(`🔍 [WORK-CHECK] Fetching groups for session: ${student_id}`);

    // 1. Find contact in Supabase (validate session credentials)
    const { data: contact, error: contactError } = await supabaseAdmin
      .from('hubspot_sync.contact_credits')
      .select('id, hubspot_id, student_id, email, firstname, lastname')
      .eq('student_id', student_id)
      .ilike('email', email)
      .single();

    if (contactError || !contact) {
      console.log(`❌ [WORK-CHECK] Session invalid - contact not found: ${student_id}`);
      return res.status(401).json({
        success: false,
        error: {
          code: 'NOT_AUTHENTICATED',
          message: 'Session invalid. Please log in again.'
        }
      });
    }

    // 2. Get trainee's active groups (using groups_students table)
    const { data: groupMemberships, error: groupError } = await supabaseAdmin
      .from('hubspot_sync.groups_students')
      .select(`
        group_id,
        status,
        groups (
          group_id,
          group_name,
          time_period,
          start_date,
          end_date,
          status
        )
      `)
      .eq('student_id', contact.student_id)
      .eq('status', 'active');

    if (groupError) {
      console.error('❌ [WORK-CHECK] Error fetching groups:', groupError);
      throw groupError;
    }

    // Filter to active groups only
    const activeGroups = (groupMemberships || [])
      .filter(gm => gm.groups?.status === 'active')
      .map(gm => ({
        group_id: gm.groups.group_id,
        group_name: gm.groups.group_name,
        time_period: gm.groups.time_period,
        start_date: gm.groups.start_date,
        end_date: gm.groups.end_date,
        status: gm.groups.status
      }));

    if (activeGroups.length === 0) {
      console.log(`❌ [WORK-CHECK] No active groups for: ${student_id}`);
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_ACTIVE_GROUPS',
          message: 'You are not enrolled in any active groups. Please contact support.'
        }
      });
    }

    // 3. Get existing booking dates for duplicate prevention
    const { data: existingBookings } = await supabaseAdmin
      .from('hubspot_sync.work_check_bookings')
      .select(`
        id,
        work_check_slots!inner (slot_date)
      `)
      .eq('student_id', contact.student_id)
      .in('status', ['pending', 'confirmed']);

    const existingBookingDates = (existingBookings || [])
      .map(b => b.work_check_slots?.slot_date)
      .filter(Boolean);

    // 4. Cache existing booking dates in Redis for fast duplicate check
    if (existingBookingDates.length > 0) {
      for (const date of existingBookingDates) {
        const cacheKey = `wc_booking:${contact.id}:${date}`;
        await redis.setex(cacheKey, 86400, 'exists'); // 24-hour TTL
      }
    }

    console.log(`✅ [WORK-CHECK] Session valid: ${student_id} with ${activeGroups.length} groups, ${existingBookingDates.length} existing bookings`);

    return res.status(200).json({
      success: true,
      data: {
        student_id: contact.student_id,   // UUID for Supabase operations
        student_code: contact.student_id,  // Human-readable student ID (e.g., PREP001)
        firstname: contact.firstname,
        lastname: contact.lastname,
        groups: activeGroups,
        existing_booking_dates: existingBookingDates
      }
    });

  } catch (error) {
    console.error('❌ [WORK-CHECK] Groups fetch error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to load groups' }
    });
  }
};
```

### 8.2 create.js

```javascript
/**
 * POST /api/work-checks/create
 * Create a work check reservation
 */

const { schemas } = require('../_shared/validation');
const { supabaseAdmin } = require('../_shared/supabase');
const redis = require('../_shared/redis');
const { acquireLock, releaseLock } = redis;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED' } });
  }

  let lockKey = null;

  try {
    // Validate request body
    const { error, value } = schemas.workCheckCreate.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.details[0].message }
      });
    }

    const { student_id, email, slot_id } = value;

    console.log(`📝 [WORK-CHECK] Creating reservation: ${student_id} -> ${slot_id}`);

    // 1. Validate contact
    const { data: contact, error: contactError } = await supabaseAdmin
      .from('hubspot_sync.contact_credits')
      .select('id, hubspot_id, student_id')
      .eq('student_id', student_id)
      .ilike('email', email)
      .single();

    if (contactError || !contact) {
      return res.status(404).json({
        success: false,
        error: { code: 'CONTACT_NOT_FOUND', message: 'Invalid credentials' }
      });
    }

    // 2. Get slot details (note: group_id is an array)
    const { data: slot, error: slotError } = await supabaseAdmin
      .from('hubspot_sync.work_check_slots')
      .select(`
        *,
        instructors (id, instructor_name)
      `)
      .eq('id', slot_id)
      .eq('is_active', true)
      .single();

    if (slotError || !slot) {
      return res.status(404).json({
        success: false,
        error: { code: 'SLOT_NOT_FOUND', message: 'Slot not found or unavailable' }
      });
    }

    // 3. Verify trainee is in one of the slot's groups (group_id is array)
    const { data: groupMembership } = await supabaseAdmin
      .from('hubspot_sync.groups_students')
      .select('id, group_id')
      .eq('student_id', contact.student_id)
      .in('group_id', slot.group_id)  // Check if student's group is in slot's group array
      .eq('status', 'active')
      .limit(1)
      .single();

    if (!groupMembership) {
      return res.status(403).json({
        success: false,
        error: { code: 'NOT_IN_GROUP', message: 'You are not enrolled in any group that can book this slot' }
      });
    }

    // 4. Check slot date is in future
    const slotDate = new Date(slot.slot_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (slotDate < today) {
      return res.status(400).json({
        success: false,
        error: { code: 'SLOT_EXPIRED', message: 'This slot is no longer available' }
      });
    }

    // 5. Acquire distributed lock
    lockKey = `wc_slot:${slot_id}`;
    const lockAcquired = await acquireLock(lockKey, 10000);
    if (!lockAcquired) {
      return res.status(429).json({
        success: false,
        error: { code: 'BUSY', message: 'Please try again in a moment' }
      });
    }

    // 6. Check slot capacity
    const { count: bookedCount } = await supabaseAdmin
      .from('hubspot_sync.work_check_bookings')
      .select('*', { count: 'exact', head: true })
      .eq('slot_id', slot_id)
      .in('status', ['pending', 'confirmed']);

    if (bookedCount >= slot.total_slots) {
      await releaseLock(lockKey);
      return res.status(400).json({
        success: false,
        error: { code: 'SLOT_FULL', message: 'This slot is no longer available' }
      });
    }

    // 7. MULTI-TIER DUPLICATE CHECK (one booking per date per student)
    // TIER 1: Redis cache check (fast path)
    const cacheKey = `wc_booking:${contact.student_id}:${slot.slot_date}`;
    const cachedBooking = await redis.get(cacheKey);

    if (cachedBooking) {
      await releaseLock(lockKey);
      console.log(`⚠️ [WORK-CHECK] Duplicate blocked by Redis cache: ${student_id} on ${slot.slot_date}`);
      return res.status(400).json({
        success: false,
        error: {
          code: 'DUPLICATE_BOOKING',
          message: 'You already have a work check scheduled for this date'
        }
      });
    }

    // TIER 2: Supabase query (authoritative)
    const { data: existingBooking } = await supabaseAdmin
      .from('hubspot_sync.work_check_bookings')
      .select(`
        id,
        work_check_slots!inner (slot_date)
      `)
      .eq('student_id', contact.student_id)
      .eq('work_check_slots.slot_date', slot.slot_date)
      .in('status', ['pending', 'confirmed'])
      .maybeSingle();

    if (existingBooking) {
      // Cache for fast path next time
      await redis.setex(cacheKey, 86400, existingBooking.id); // 24-hour TTL
      await releaseLock(lockKey);
      console.log(`⚠️ [WORK-CHECK] Duplicate blocked by Supabase: ${student_id} on ${slot.slot_date}`);
      return res.status(400).json({
        success: false,
        error: {
          code: 'DUPLICATE_BOOKING',
          message: 'You already have a work check scheduled for this date'
        }
      });
    }

    // 8. Determine booking status (auto-approve can be configured externally)
    // For simplicity, all bookings start as 'pending' unless auto-approve is enabled
    const autoApprove = false; // TODO: Configure via system settings or ENV

    // 9. Create booking
    const bookingData = {
      slot_id: slot.id,
      student_id: contact.student_id,
      status: autoApprove ? 'confirmed' : 'pending',
      ...(autoApprove && { confirmed_at: new Date().toISOString() })
    };

    const { data: booking, error: insertError } = await supabaseAdmin
      .from('hubspot_sync.work_check_bookings')
      .insert(bookingData)
      .select()
      .single();

    if (insertError) {
      await releaseLock(lockKey);
      console.error('❌ [WORK-CHECK] Insert error:', insertError);
      throw insertError;
    }

    // 10. Cache the new booking in Redis for fast duplicate prevention
    const bookingCacheKey = `wc_booking:${contact.student_id}:${slot.slot_date}`;
    await redis.setex(bookingCacheKey, 86400, booking.id); // 24-hour TTL
    console.log(`📦 [WORK-CHECK] Cached booking in Redis: ${bookingCacheKey}`);

    // 11. Release lock
    await releaseLock(lockKey);

    // Calculate end time
    const [hours, minutes] = slot.slot_time.split(':');
    const endTime = new Date();
    endTime.setHours(parseInt(hours), parseInt(minutes) + slot.duration_minutes, 0, 0);
    const endTimeStr = `${String(endTime.getHours()).padStart(2, '0')}:${String(endTime.getMinutes()).padStart(2, '0')}`;

    console.log(`✅ [WORK-CHECK] Booking created: ${booking.id} (${booking.status})`);

    // Get group name for response (from user's group membership)
    const groupName = groupMembership.group_id; // The group through which they booked

    return res.status(201).json({
      success: true,
      data: {
        booking_id: booking.id,
        status: booking.status,
        auto_approved: autoApprove,
        slot: {
          slot_date: slot.slot_date,
          slot_time: slot.slot_time,
          end_time: endTimeStr,
          instructor_name: slot.instructors.instructor_name,
          group_id: groupName,
          location: slot.location
        },
        message: autoApprove
          ? 'Your work check has been booked successfully!'
          : 'Your booking request has been submitted. You will be notified when it is confirmed.'
      }
    });

  } catch (error) {
    if (lockKey) await releaseLock(lockKey);
    console.error('❌ [WORK-CHECK] Create error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to create reservation' }
    });
  }
};
```

---

## 9. Implementation Checklist

### Phase 1: Database Setup (0.5 day)
- [ ] Create `hubspot_sync.work_check_slots` table (with array group_id)
- [ ] Create `hubspot_sync.work_check_bookings` table
- [ ] Create GIN index on group_id array
- [ ] Create indexes for performance
- [ ] Verify `hubspot_sync.groups_students` table exists (from Group Management PRD)
- [ ] Verify `hubspot_sync.instructors` table exists (from Instructor Management PRD)

### Phase 2: Backend API (1 day)
- [ ] Add validation schemas to `validation.js`
- [ ] Create `/api/work-checks/groups.js`
- [ ] Create `/api/work-checks/available.js`
- [ ] Create `/api/work-checks/create.js`
- [ ] Create `/api/work-checks/list.js`
- [ ] Create `/api/work-checks/[id].js` (cancel)
- [ ] Add rate limiting middleware

### Phase 3: Frontend Components (1.5 days)
- [ ] Add work check API methods to `api.js`
- [ ] Create `useWorkCheckBooking.js` hook
- [ ] Create `WorkCheckBookingPage.jsx` (main wizard)
- [ ] Create `WorkCheckIdentityStep.jsx`
- [ ] Create `WorkCheckSlotSelector.jsx`
- [ ] Create `WorkCheckSlotCard.jsx`
- [ ] Create `WorkCheckConfirmation.jsx`
- [ ] Create `MyWorkChecks.jsx`
- [ ] Create `WorkCheckBookingCard.jsx`
- [ ] Add route `/book/work-check`

### Phase 4: Testing (0.5 day)
- [ ] Test identity verification flow
- [ ] Test slot availability filtering by group
- [ ] Test booking creation (pending and auto-approve)
- [ ] Test duplicate booking prevention
- [ ] Test slot capacity enforcement
- [ ] Test cancellation flow
- [ ] Test change request flow
- [ ] Test notification dismissal

---

## 10. Success Criteria

1. Trainees can verify identity with Student ID + Email
2. Only slots for user's assigned groups are displayed (using array overlap check)
3. Slots respect `available_from` scheduled visibility
4. Bookings are created as pending (or auto-confirmed if enabled)
5. One work check per date is enforced
6. Slot capacity is correctly enforced
7. Trainees can view their pending and confirmed work checks
8. Trainees can cancel bookings
9. Rate limiting prevents abuse

---

## 11. Dependencies

### Requires
- **Group Management PRD** - `hubspot_sync.groups` and `hubspot_sync.groups_students` tables
- **Instructor Management PRD** - `hubspot_sync.instructors` table
- **Work Check Slot Management (Admin PRD)** - `hubspot_sync.work_check_slots` table (slots created by admin)

### Required By
- None (standalone user feature)

---

## 12. Security Considerations

1. **Rate Limiting**: All public endpoints rate-limited (10-30 requests/15 min)
2. **Identity Verification**: Student ID + Email must match
3. **Group Authorization**: Users can only book slots for their groups
4. **Email Masking**: Public API returns masked emails
5. **Distributed Locking**: Prevents race conditions on slot capacity
6. **Input Validation**: All inputs validated with Joi schemas
7. **No Credit Exposure**: Unlike mock booking, no credit data involved

---

## 13. Future Considerations

1. **Email Notifications**: Notify users when booking is confirmed/rejected
2. **SMS Notifications**: Optional SMS alerts
3. **Calendar Integration**: Export to Google Calendar / iCal
4. **Waitlist**: Allow users to join waitlist for full slots
5. **Recurring Bookings**: Book multiple slots at once
6. **Mobile App**: Native mobile experience
