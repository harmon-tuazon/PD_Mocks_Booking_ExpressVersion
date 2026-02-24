# PRD: Booking Status Completion & Instructor Marking

**Version:** 1.0.0
**Created:** February 12, 2026
**Status:** Draft
**Confidence Score:** 9/10
**Estimated Effort:** 2-3 days

---

## 1. Overview

### 1.1 Purpose
Enable instructors to mark work check bookings as completed directly from their dashboard schedule, and extend the booking status system across the admin and user portals to support two new statuses: `marked` and `completed`.

### 1.2 Status Lifecycle
```
pending → confirmed → marked → completed
                   ↘ rejected
                   ↘ cancelled
```

| Status | Meaning | Set By |
|--------|---------|--------|
| `pending` | Awaiting approval | System (on booking creation) |
| `confirmed` | Approved for session | Admin / System (auto_approve) |
| `marked` | Instructor confirmed attendance | Instructor (via dashboard checkbox) |
| `completed` | Admin verified completion | Admin (via bulk status / edit modal) |
| `rejected` | Booking rejected | Admin |
| `cancelled` | Booking cancelled | Admin / Student |

### 1.3 Scope
- **Instructor Portal**: Add action column with checkboxes to the schedule table; new API endpoint to mark bookings
- **Admin Bookings Management** (`/work-check/bookings`): Update bulk change status, clone, edit modal, create modal, stat cards, filters, and aggregates to support `marked` and `completed`
- **User Portal** (`user_root`): Update status badge display and filter logic; lump `marked` + `completed` under "Completed" filter

### 1.4 Out of Scope
- Notification system for status changes
- Automatic status progression (e.g., auto-complete after date passes)
- Instructor portal bulk operations

### 1.5 Database Constraint (Already Applied)
```sql
CONSTRAINT work_check_bookings_status_check CHECK (
  (status)::text = ANY (
    ARRAY['pending', 'confirmed', 'marked', 'completed', 'rejected', 'cancelled']::text[]
  )
)
```

---

## 2. Feature A: Instructor Schedule Action Column

### 2.1 Overview
Add an "Actions" column to the instructor dashboard schedule table with checkboxes that allow instructors to mark individual bookings as `marked` (i.e., instructor-confirmed attendance).

### 2.2 Current Schedule Table Structure
The schedule table in `InstructorDashboard.jsx` (lines 407-467) renders sessions grouped by date with columns: **Date**, **Time**, **Groups**.

### 2.3 Required Changes

#### 2.3.1 Backend: New API Endpoint

**File:** `admin_root/api/admin/instructor/bookings/mark.js`

```
POST /api/admin/instructor/bookings/mark
```

**Purpose:** Allow the logged-in instructor to mark bookings for their slots as `marked`.

**Request Body:**
```json
{
  "booking_ids": ["uuid-1", "uuid-2"],
  "action": "mark"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `booking_ids` | UUID[] | Yes | Array of booking IDs to mark (max 50) |
| `action` | string | Yes | `"mark"` or `"unmark"` |

**Validation Rules:**
- `action` must be `"mark"` or `"unmark"`
- All bookings must belong to slots owned by the authenticated instructor
- Only bookings with status `confirmed` can be marked
- Only bookings with status `marked` can be unmarked (reverts to `confirmed`)
- Max 50 booking IDs per request

**Response:**
```json
{
  "success": true,
  "data": {
    "updated": 3,
    "skipped": 1,
    "details": [
      { "id": "uuid-1", "status": "marked", "marked_at": "2026-02-12T10:00:00Z" },
      { "id": "uuid-2", "status": "marked", "marked_at": "2026-02-12T10:00:00Z" }
    ]
  }
}
```

**Implementation Notes:**
- Use `requireRole(req, 'instructor')` and `getInstructorFromUser(user)`
- Verify each booking's slot belongs to the instructor via join: `work_check_bookings.slot_id → work_check_slots.instructor_id`
- When marking: set `status = 'marked'`, set `marked_at = NOW()`
- When unmarking: set `status = 'confirmed'`, set `marked_at = NULL`
- Use Supabase batch update for efficiency

**Database Column Addition:**
```sql
ALTER TABLE hubspot_sync.work_check_bookings
ADD COLUMN marked_at TIMESTAMPTZ;
```

#### 2.3.2 Backend: Update Schedule API

**File:** `admin_root/api/admin/instructor/schedule.js`

Update the schedule endpoint to include booking details for each session. Currently it returns groups per session but not individual bookings.

**Updated Response Structure:**
```json
{
  "schedule": [
    {
      "date": "2026-02-15",
      "day_of_week": "Sunday",
      "sessions": [
        {
          "slot_id": "uuid",
          "time": "09:00",
          "duration_minutes": 30,
          "groups": [...],
          "bookings": [
            {
              "id": "booking-uuid",
              "student_id": "PREP001",
              "student_name": "John Doe",
              "status": "confirmed",
              "type": "Work Check",
              "marked_at": null
            }
          ]
        }
      ]
    }
  ]
}
```

**Implementation:** After fetching slots, join `work_check_bookings` for each slot with student data from `hubspot_contact_credits`:

```javascript
// For each slot, fetch associated bookings
const slotIds = slots.map(s => s.id);
const { data: bookings } = await supabaseAdmin
  .from('work_check_bookings')
  .select(`
    id, slot_id, student_id, status, type, marked_at,
    student:hubspot_contact_credits!work_check_bookings_student_id_fkey (
      student_id, firstname, lastname
    )
  `)
  .in('slot_id', slotIds)
  .in('status', ['pending', 'confirmed', 'marked']);
```

#### 2.3.3 Frontend: Update Schedule Table

**File:** `admin_root/admin_frontend/src/pages/instructor/InstructorDashboard.jsx`

**Changes to the schedule table:**

1. **Add "Actions" column header** after "Groups":
```jsx
<th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
  Students
</th>
```

2. **Expand each session row** to show individual bookings with checkboxes:
   - Each session row shows the date, time, and groups as before
   - Below each session (or as nested rows), display each booking with:
     - Checkbox (checked = `marked`, unchecked = `confirmed`)
     - Student name
     - Booking type badge
     - Status badge

3. **Checkbox behavior:**
   - Disabled for bookings with status `pending` (not yet confirmed)
   - Checked for bookings with status `marked`
   - Unchecked for bookings with status `confirmed`
   - On click: call `POST /api/admin/instructor/bookings/mark` with `action: "mark"` or `"unmark"`
   - Show loading spinner on the checkbox while API call is in progress
   - Invalidate schedule query on success

4. **Visual design** (matching admin table patterns):
```jsx
<td className="px-6 py-4">
  <div className="space-y-2">
    {session.bookings.map((booking) => (
      <div key={booking.id} className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={booking.status === 'marked'}
          disabled={booking.status === 'pending' || isMarking}
          onChange={() => handleToggleMark(booking)}
          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded disabled:opacity-50"
        />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {booking.student_name}
        </span>
        <span className={statusBadgeClass}>
          {booking.status}
        </span>
      </div>
    ))}
  </div>
</td>
```

#### 2.3.4 Frontend: Service & Hooks

**File:** `admin_root/admin_frontend/src/services/adminApi.js`

Add to `instructorPortalApi`:
```javascript
markBookings: async (bookingIds, action) => {
  const response = await api.post('/admin/instructor/bookings/mark', {
    booking_ids: bookingIds,
    action
  });
  return response.data;
}
```

**File:** `admin_root/admin_frontend/src/hooks/useInstructorPortalData.js`

Add mutation hook:
```javascript
export function useMarkBookings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingIds, action }) =>
      instructorPortalApi.markBookings(bookingIds, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructor', 'schedule'] });
      queryClient.invalidateQueries({ queryKey: ['instructor', 'dashboard-stats'] });
    }
  });
}
```

#### 2.3.5 Validation Schema

**File:** `admin_root/api/_shared/validation.js`

Add schema:
```javascript
instructorMarkBookings: Joi.object({
  booking_ids: Joi.array()
    .items(Joi.string().uuid())
    .min(1)
    .max(50)
    .required()
    .messages({
      'array.min': 'At least one booking ID is required',
      'array.max': 'Cannot mark more than 50 bookings at once'
    }),
  action: Joi.string()
    .valid('mark', 'unmark')
    .required()
    .messages({
      'any.only': 'Action must be either mark or unmark'
    })
})
```

---

## 3. Feature B: Admin Bookings Management Status Updates

### 3.1 Overview
Update all status-related components in `/work-check/bookings` to include the new `marked` and `completed` statuses.

### 3.2 Files to Update

#### 3.2.1 Status Filter Options

**File:** `admin_root/admin_frontend/src/components/admin/WorkCheckBookingFilters.jsx` (line 28-34)

```javascript
// BEFORE
const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' }
];

// AFTER
const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'marked', label: 'Marked' },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' }
];
```

#### 3.2.2 Stat Cards

**File:** `admin_root/admin_frontend/src/pages/WorkCheckBookings.jsx` (lines 118-140, 310-351)

Add two new stat cards:

| Card | Icon | Color | Count Source |
|------|------|-------|-------------|
| Marked | `ClipboardDocumentCheckIcon` | Amber/Yellow | `agg.marked_count` |
| Completed | `CheckBadgeIcon` | Blue | `agg.completed_count` |

Update the stats `useMemo`:
```javascript
const stats = useMemo(() => {
  let total = 0, pending = 0, confirmed = 0, marked = 0, completed = 0, rejected = 0, cancelled = 0;
  data.forEach(agg => {
    total += agg.total_bookings || 0;
    pending += agg.pending_count || 0;
    confirmed += agg.confirmed_count || 0;
    marked += agg.marked_count || 0;
    completed += agg.completed_count || 0;
    rejected += agg.rejected_count || 0;
    cancelled += agg.cancelled_count || 0;
  });
  return { total, pending, confirmed, marked, completed, rejected, cancelled };
}, [aggregates]);
```

#### 3.2.3 Edit Modal - Status Dropdown

**File:** `admin_root/admin_frontend/src/components/admin/WorkCheckBookingFormModal.jsx` (lines 18-23)

```javascript
// BEFORE
const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' }
];

// AFTER
const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'marked', label: 'Marked' },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' }
];
```

#### 3.2.4 Bulk Status Change - Selection Toolbar

**File:** `admin_root/admin_frontend/src/components/admin/WorkCheckBookingSelectionToolbar.jsx` (lines 15-20)

```javascript
// BEFORE
const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' }
];

// AFTER
const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'marked', label: 'Marked' },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' }
];
```

#### 3.2.5 Status Badge Colors

Add to any status badge rendering across the aggregates table:

| Status | Light Mode | Dark Mode |
|--------|-----------|-----------|
| `pending` | `bg-amber-100 text-amber-800` | `dark:bg-amber-900/30 dark:text-amber-300` |
| `confirmed` | `bg-green-100 text-green-800` | `dark:bg-green-900/30 dark:text-green-300` |
| `marked` | `bg-yellow-100 text-yellow-800` | `dark:bg-yellow-900/30 dark:text-yellow-300` |
| `completed` | `bg-blue-100 text-blue-800` | `dark:bg-blue-900/30 dark:text-blue-300` |
| `rejected` | `bg-red-100 text-red-800` | `dark:bg-red-900/30 dark:text-red-300` |
| `cancelled` | `bg-gray-100 text-gray-800` | `dark:bg-gray-700 dark:text-gray-300` |

#### 3.2.6 Clone Modal

**File:** `admin_root/admin_frontend/src/components/admin/WorkCheckBookingCloneModal.jsx`

If the clone modal has a "Preserve Status" option, the cloned booking should preserve `marked` or `completed` when enabled.

No additional UI changes needed - the existing preserve_status logic handles any valid status value.

### 3.3 Backend Changes

#### 3.3.1 Validation Schemas

**File:** `admin_root/api/_shared/validation.js`

Update ALL status validation to include the new values:

```javascript
// Aggregates query (line ~2001)
status: Joi.string().valid('pending', 'confirmed', 'marked', 'completed', 'rejected', 'cancelled')

// Update operation (line ~2061)
status: Joi.string()
  .valid('pending', 'confirmed', 'marked', 'completed', 'rejected', 'cancelled')

// Bulk toggle (line ~2087)
target_status: Joi.string()
  .valid('pending', 'confirmed', 'marked', 'completed', 'rejected', 'cancelled')
  .required()
```

#### 3.3.2 Update Endpoint - Timestamp Handling

**File:** `admin_root/api/admin/work-check-bookings/[id].js` (lines 178-185)

Add timestamp handling for new statuses:
```javascript
if (updates.status) {
  if (updates.status === 'confirmed' && existingBooking.status !== 'confirmed') {
    updateData.confirmed_at = new Date().toISOString();
  }
  if (updates.status === 'marked' && existingBooking.status !== 'marked') {
    updateData.marked_at = new Date().toISOString();
  }
  if (updates.status === 'cancelled' && existingBooking.status !== 'cancelled') {
    updateData.cancelled_at = new Date().toISOString();
  }
}
```

#### 3.3.3 Bulk Toggle Endpoint

**File:** `admin_root/api/admin/work-check-bookings/bulk-toggle.js` (lines 61-95)

Add timestamp handling:
```javascript
if (target_status === 'confirmed') {
  updateData.confirmed_at = new Date().toISOString();
} else if (target_status === 'marked') {
  updateData.marked_at = new Date().toISOString();
} else if (target_status === 'cancelled') {
  updateData.cancelled_at = new Date().toISOString();
}
```

#### 3.3.4 Aggregates RPC Function

**Database:** Update `get_booking_aggregates` RPC function to return `marked_count` and `completed_count`:

```sql
-- Add to the aggregate SELECT:
COUNT(*) FILTER (WHERE b.status = 'marked') AS marked_count,
COUNT(*) FILTER (WHERE b.status = 'completed') AS completed_count,
```

Also update `get_booking_aggregates_count` if it filters by status.

---

## 4. Feature C: User Portal Status Updates

### 4.1 Overview
Update the user-facing work check bookings page (`user_root/frontend/src/pages/MyWorkChecks.jsx`) to support the new statuses. The key requirement: **`marked` and `completed` are treated identically from the user's perspective and lumped under a single "Completed" filter.**

### 4.2 Files to Update

#### 4.2.1 Status Badge Display

**File:** `user_root/frontend/src/pages/MyWorkChecks.jsx` (lines 316-333)

Add `marked` to the status config:
```javascript
const getStatusBadge = (status) => {
  const statusConfig = {
    confirmed: {
      color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      label: 'Confirmed',
      icon: '✓'
    },
    pending: {
      color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
      label: 'Pending',
      icon: '⏳'
    },
    cancelled: {
      color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
      label: 'Cancelled',
      icon: '✕'
    },
    marked: {
      color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      label: 'Completed',  // Display as "Completed" to users
      icon: '✓'
    },
    completed: {
      color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      label: 'Completed',
      icon: '✓'
    },
    no_show: {
      color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
      label: 'No Show',
      icon: '⚠'
    }
  };
  // ...
};
```

**Key:** Both `marked` and `completed` display as "Completed" to the user with the same blue styling.

#### 4.2.2 Filter Logic

**File:** `user_root/api/work-checks/list.js` (lines 75-96)

Update the `completed` filter to include both `marked` and `completed` statuses:

```javascript
// BEFORE
case 'completed':
  query = query
    .eq('status', 'confirmed')
    .lt('work_check_slots.slot_date', today);
  break;

// AFTER
case 'completed':
  query = query
    .in('status', ['marked', 'completed']);
  break;
```

**Note:** Previously, "completed" was inferred as `confirmed` + past date. With explicit `marked`/`completed` statuses, we no longer need date-based inference. A booking is completed when an instructor marks it or an admin confirms completion.

#### 4.2.3 Status Categorization

**File:** `user_root/api/work-checks/list.js` (lines 165-187)

Update the categorization logic:

```javascript
// BEFORE
} else if (booking.status === 'confirmed') {
  if (isInFuture) {
    categorized.upcoming.push(booking);
  } else {
    categorized.completed.push(booking);
  }
}

// AFTER
} else if (booking.status === 'confirmed') {
  if (isInFuture) {
    categorized.upcoming.push(booking);
  } else {
    categorized.upcoming.push(booking); // Past confirmed stays in upcoming (not yet marked)
  }
} else if (booking.status === 'marked' || booking.status === 'completed') {
  categorized.completed.push(booking);
}
```

#### 4.2.4 Filter Buttons (No Change Needed)

The existing filter buttons already have a "Completed" option:
```javascript
{ key: 'completed', label: 'Completed' }
```

No new filter button needed since `marked` + `completed` are lumped under "Completed".

---

## 5. File Change Summary

### New Files
| File | Purpose |
|------|---------|
| `admin_root/api/admin/instructor/bookings/mark.js` | POST endpoint for instructor marking |

### Modified Files - Admin Frontend
| File | Changes |
|------|---------|
| `admin_root/admin_frontend/src/pages/instructor/InstructorDashboard.jsx` | Add students/actions column to schedule table with checkboxes |
| `admin_root/admin_frontend/src/pages/WorkCheckBookings.jsx` | Add `marked` and `completed` stat cards, update stats useMemo |
| `admin_root/admin_frontend/src/components/admin/WorkCheckBookingFormModal.jsx` | Add `marked` and `completed` to STATUS_OPTIONS |
| `admin_root/admin_frontend/src/components/admin/WorkCheckBookingSelectionToolbar.jsx` | Add `marked` and `completed` to STATUS_OPTIONS |
| `admin_root/admin_frontend/src/components/admin/WorkCheckBookingFilters.jsx` | Add `marked` and `completed` to STATUS_OPTIONS |
| `admin_root/admin_frontend/src/components/admin/WorkCheckBookingAggregatesTable.jsx` | Add `marked`/`completed` badge colors |
| `admin_root/admin_frontend/src/services/adminApi.js` | Add `markBookings` to `instructorPortalApi` |
| `admin_root/admin_frontend/src/hooks/useInstructorPortalData.js` | Add `useMarkBookings` mutation hook |

### Modified Files - Admin Backend
| File | Changes |
|------|---------|
| `admin_root/api/admin/instructor/schedule.js` | Include bookings with student data per session |
| `admin_root/api/admin/work-check-bookings/[id].js` | Add `marked_at` timestamp handling |
| `admin_root/api/admin/work-check-bookings/bulk-toggle.js` | Add `marked_at` timestamp handling |
| `admin_root/api/_shared/validation.js` | Add `marked`, `completed` to all status validations |

### Modified Files - User Root
| File | Changes |
|------|---------|
| `user_root/frontend/src/pages/MyWorkChecks.jsx` | Add `marked` status badge (displayed as "Completed") |
| `user_root/api/work-checks/list.js` | Update `completed` filter to include `marked` + `completed`; update categorization |

### Database Changes
| Change | Description |
|--------|-------------|
| `ALTER TABLE` | Add `marked_at TIMESTAMPTZ` column to `work_check_bookings` |
| `ALTER FUNCTION` | Update `get_booking_aggregates` to return `marked_count`, `completed_count` |

---

## 6. Implementation Checklist

### Phase 1: Database & Validation (0.5 day)
- [ ] Add `marked_at` column to `work_check_bookings` table
- [ ] Update `get_booking_aggregates` RPC to include `marked_count` and `completed_count`
- [ ] Update all Joi validation schemas in `validation.js` to include `marked` and `completed`
- [ ] Verify the existing status CHECK constraint includes all 6 values

### Phase 2: Admin Backend (0.5 day)
- [ ] Create `admin_root/api/admin/instructor/bookings/mark.js` endpoint
- [ ] Update `schedule.js` to include bookings with student data per session
- [ ] Update `[id].js` update endpoint with `marked_at` timestamp handling
- [ ] Update `bulk-toggle.js` with `marked_at` timestamp handling

### Phase 3: Instructor Frontend (0.5 day)
- [ ] Add `markBookings` to `instructorPortalApi` in `adminApi.js`
- [ ] Add `useMarkBookings` mutation hook to `useInstructorPortalData.js`
- [ ] Update `InstructorDashboard.jsx` schedule table with students column and checkboxes
- [ ] Handle loading/error states for mark operations
- [ ] Test checkbox mark/unmark flow

### Phase 4: Admin Bookings Frontend (0.5 day)
- [ ] Update `WorkCheckBookingFilters.jsx` - add `marked` and `completed` to STATUS_OPTIONS
- [ ] Update `WorkCheckBookingFormModal.jsx` - add to STATUS_OPTIONS dropdown
- [ ] Update `WorkCheckBookingSelectionToolbar.jsx` - add to bulk status options
- [ ] Update `WorkCheckBookings.jsx` - add stat cards for marked/completed, update stats useMemo
- [ ] Update `WorkCheckBookingAggregatesTable.jsx` - add badge colors for new statuses

### Phase 5: User Portal (0.5 day)
- [ ] Update `MyWorkChecks.jsx` - add `marked` badge config (displayed as "Completed")
- [ ] Update `user_root/api/work-checks/list.js` - update `completed` filter and categorization logic

### Phase 6: Testing & Validation
- [ ] `npm run build` from `admin_root/admin_frontend/` passes
- [ ] Instructor can mark confirmed bookings via schedule checkboxes
- [ ] Instructor cannot mark pending bookings (checkbox disabled)
- [ ] Admin can change status to `marked`/`completed` via edit modal
- [ ] Admin can bulk change to `marked`/`completed` via toolbar
- [ ] Admin stat cards show correct counts for all 6 statuses
- [ ] User portal "Completed" filter shows both `marked` and `completed` bookings
- [ ] User portal displays both `marked` and `completed` as "Completed" badge
- [ ] Clone preserves `marked`/`completed` status when preserve_status is enabled

---

## 7. Security Considerations

1. **Instructor Scope**: The mark endpoint must verify that ALL bookings belong to slots owned by the authenticated instructor. No cross-instructor marking.
2. **Status Transition Guards**: Only `confirmed` bookings can be marked by instructors. Only `marked` bookings can be unmarked.
3. **Admin Override**: Admins can set any status via edit modal or bulk operations without transition restrictions.
4. **Rate Limiting**: Mark endpoint limited to 50 bookings per request to prevent abuse.

---

## 8. Dependencies

### Requires
- Instructor Portal PRD (implemented)
- Bookings Management PRD (implemented)
- Slots Management PRD (implemented)
- `marked_at` column added to database

### Required By
- None (standalone enhancement)
