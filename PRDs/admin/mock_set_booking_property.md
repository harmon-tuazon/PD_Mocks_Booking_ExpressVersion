# PRD: Add mock_set Property to Booking Objects

## Overview

| Field | Value |
|-------|-------|
| **Feature** | mock_set Property for Bookings |
| **Branch** | `mock_set_props_bookings` |
| **Priority** | Medium |
| **Estimated Effort** | 4-6 hours |

---

## Problem Statement

When a student books a mock exam session, the `mock_set` value (A-H) from the exam session is not being captured or stored with the booking record. This makes it impossible to:
1. Track which exam set a student took
2. Filter or display bookings by exam set
3. Maintain audit trail of which specific exam version was administered

---

## Requirements

### Functional Requirements

1. **Database**: Add `mock_set` column to `hubspot_bookings` table in Supabase
2. **Backend - User Booking Creation**: Copy `mock_set` from session when creating a booking
3. **Backend - Admin Booking Creation**: Same strategy as user booking
4. **Backend - Booking Reads**: Include `mock_set` in all booking read operations
5. **Frontend - User Dashboard**: Display `mock_set` column in My Bookings page
6. **Frontend - Admin Dashboard**: Display `mock_set` column in Trainee Dashboard bookings table

---

## Technical Audit: Current State Analysis

### Database Layer

| Component | File | Has mock_set? | Action Required |
|-----------|------|---------------|-----------------|
| hubspot_bookings table | Supabase schema | ❌ No | Add column via ALTER TABLE |
| create_booking_atomic RPC | [02-rpc-atomic-functions.md](../supabase/supabase_SOT_migrations/02-rpc-atomic-functions.md) | ❌ No | Add parameter and INSERT field |

### Backend - Write Operations

| Component | File | Has mock_set? | Action Required |
|-----------|------|---------------|-----------------|
| user booking creation | [user_root/api/bookings/create.js](../../user_root/api/bookings/create.js) | ❌ No | Pass mock_set to createBookingAtomic |
| admin booking creation | [admin_root/api/admin/bookings/create.js](../../admin_root/api/admin/bookings/create.js) | ❌ No | Include mock_set in syncBookingToSupabase |
| createBookingAtomic | [user_root/api/_shared/supabase-data.js:565-624](../../user_root/api/_shared/supabase-data.js) | ❌ No | Add p_mock_set parameter |
| syncBookingToSupabase (admin) | [admin_root/api/_shared/supabase-data.js:385-435](../../admin_root/api/_shared/supabase-data.js) | ❌ No | Add mock_set to record object |
| syncBookingToSupabase (user) | [user_root/api/_shared/supabase-data.js:183-233](../../user_root/api/_shared/supabase-data.js) | ❌ No | Add mock_set to record object |

### Backend - Read Operations

| Component | File | Has mock_set? | Action Required |
|-----------|------|---------------|-----------------|
| user bookings list | [user_root/api/bookings/list.js](../../user_root/api/bookings/list.js) | ❓ Check | Verify Supabase query includes mock_set |
| admin trainee bookings | [admin_root/api/admin/trainees/[studentId]/bookings.js](../../admin_root/api/admin/trainees/) | ❓ Check | Verify response includes mock_set |
| admin booking details | Various admin endpoints | ❓ Check | Verify all return mock_set |

### Frontend - User App

| Component | File | Has mock_set? | Action Required |
|-----------|------|---------------|-----------------|
| MyBookings component | [user_root/frontend/src/components/MyBookings.jsx](../../user_root/frontend/src/components/MyBookings.jsx) | ❌ No | Add mock_set column to table |
| api.js booking transform | [user_root/frontend/src/services/api.js](../../user_root/frontend/src/services/api.js) | ❓ Check | Ensure mock_set passed through |

### Frontend - Admin App

| Component | File | Has mock_set? | Action Required |
|-----------|------|---------------|-----------------|
| BookingsTable | [admin_root/admin_frontend/src/components/admin/BookingsTable.jsx](../../admin_root/admin_frontend/src/components/admin/BookingsTable.jsx) | ❌ No | Add mock_set column |
| BookingRow | [admin_root/admin_frontend/src/components/admin/BookingRow.jsx](../../admin_root/admin_frontend/src/components/admin/BookingRow.jsx) | ❌ No | Add mock_set cell |
| useColumnVisibility | [admin_root/admin_frontend/src/hooks/useColumnVisibility.js](../../admin_root/admin_frontend/src/hooks/useColumnVisibility.js) | ❌ No | Add mock_set to COLUMN_DEFINITIONS |
| TraineeDashboard | [admin_root/admin_frontend/src/pages/TraineeDashboard.jsx](../../admin_root/admin_frontend/src/pages/TraineeDashboard.jsx) | ❌ No | Inherits from BookingsTable changes |

---

## Implementation Plan

### Phase 1: Database Schema (Sprint 1)

#### Task 1.1: Add Column to Supabase

```sql
-- Run in Supabase SQL Editor

-- NOTE: mock_set_enum already exists in hubspot_sync schema (created for hubspot_mock_exams)
-- We reuse the same enum type for consistency

-- Step 1: Add mock_set column using the existing mock_set_enum type
-- (Same pattern as hubspot_mock_exams table)
ALTER TABLE hubspot_sync.hubspot_bookings
ADD COLUMN IF NOT EXISTS mock_set mock_set_enum DEFAULT NULL;

-- Step 2: Add comment explaining the column purpose
COMMENT ON COLUMN hubspot_sync.hubspot_bookings.mock_set IS
  'Exam set identifier (A-H) copied from the mock exam at booking time. Only applies to SJ and CS types.';

-- Step 3: Create index for filtering bookings by mock_set (optional, for performance)
CREATE INDEX IF NOT EXISTS idx_hubspot_bookings_mock_set
ON hubspot_sync.hubspot_bookings(mock_set)
WHERE mock_set IS NOT NULL;

-- Step 4: Verify the column was added correctly
SELECT column_name, data_type, udt_name, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'hubspot_sync'
  AND table_name = 'hubspot_bookings'
  AND column_name = 'mock_set';
```

**Note**: The `mock_set_enum` type already exists in the `hubspot_sync` schema (created for `hubspot_mock_exams`). We reuse it here for consistency and data integrity. Valid values are A-H only.

#### Task 1.2: Update create_booking_atomic RPC Function

```sql
-- Update the RPC function to accept mock_set parameter
-- Note: Parameter is TEXT but cast to mock_set_enum when inserting
-- (Same pattern used in hubspot_mock_exams for consistency)
CREATE OR REPLACE FUNCTION hubspot_sync.create_booking_atomic(
  p_booking_id TEXT,
  p_student_id TEXT,
  p_student_email TEXT,
  p_mock_exam_id TEXT,
  p_student_name TEXT,
  p_token_used TEXT,
  p_attending_location TEXT,
  p_dominant_hand TEXT,
  p_idempotency_key TEXT,
  p_credit_field TEXT,
  p_new_credit_value INTEGER,
  p_mock_set TEXT DEFAULT NULL  -- NEW PARAMETER (TEXT, cast to enum on insert)
)
RETURNS JSONB AS $$
DECLARE
  -- ... existing declarations
BEGIN
  -- ... existing code ...

  -- In the INSERT statement, add mock_set with explicit cast:
  INSERT INTO hubspot_sync.hubspot_bookings (
    -- ... existing columns ...,
    mock_set
  ) VALUES (
    -- ... existing values ...,
    p_mock_set::mock_set_enum  -- Cast TEXT to enum (NULL-safe)
  );

  -- ... rest of function
END;
$$ LANGUAGE plpgsql;
```

**Important**: The `p_mock_set` parameter is TEXT to allow NULL values and easy API integration, but is cast to `mock_set_enum` during INSERT. Invalid values (not A-H) will cause a database error, ensuring data integrity.

---

### Phase 2: Backend Write Operations (Sprint 1)

#### Task 2.1: Update createBookingAtomic in user_root

**File**: `user_root/api/_shared/supabase-data.js`

```javascript
async function createBookingAtomic({
  bookingId,
  studentId,
  studentEmail,
  mockExamId,
  studentName,
  tokenUsed,
  attendingLocation,
  dominantHand,
  idempotencyKey,
  creditField,
  newCreditValue,
  mockSet  // NEW PARAMETER
}) {
  const { data, error } = await supabaseAdmin.rpc('create_booking_atomic', {
    p_booking_id: bookingId,
    p_student_id: studentId,
    p_student_email: studentEmail,
    p_mock_exam_id: mockExamId,
    p_student_name: studentName,
    p_token_used: tokenUsed,
    p_attending_location: attendingLocation,
    p_dominant_hand: dominantHand,
    p_idempotency_key: idempotencyKey,
    p_credit_field: creditField,
    p_new_credit_value: newCreditValue,
    p_mock_set: mockSet  // NEW PARAMETER
  });
  // ... rest of function
}
```

#### Task 2.2: Update user booking creation endpoint

**File**: `user_root/api/bookings/create.js`

Pass `mock_set` from the exam session to `createBookingAtomic`:

```javascript
// After fetching exam data, extract mock_set
const mockSet = examData.mock_set || null;

// Pass to atomic function
const atomicResult = await createBookingAtomic({
  bookingId,
  studentId,
  studentEmail,
  mockExamId,
  studentName,
  tokenUsed,
  attendingLocation,
  dominantHand,
  idempotencyKey,
  creditField,
  newCreditValue,
  mockSet  // NEW
});
```

#### Task 2.3: Update syncBookingToSupabase (both admin and user)

**Files**:
- `admin_root/api/_shared/supabase-data.js`
- `user_root/api/_shared/supabase-data.js`

Add `mock_set` to the record object:

```javascript
const record = {
  hubspot_id: booking.id,
  booking_id: props.booking_id,
  // ... existing fields ...
  mock_type: props.mock_type || null,
  mock_set: props.mock_set || null,  // NEW FIELD
  // ... rest of fields ...
};
```

#### Task 2.4: Update admin booking creation endpoint

**File**: `admin_root/api/admin/bookings/create.js`

Include `mock_set` when calling `syncBookingToSupabase`:

```javascript
await syncBookingToSupabase({
  id: createdBookingId,
  properties: {
    booking_id: bookingId,
    // ... existing properties ...
    mock_type: mockExam.mock_type,
    mock_set: mockExam.mock_set || null,  // NEW PROPERTY
    // ... rest of properties ...
  }
}, mock_exam_id);
```

---

### Phase 3: Backend Read Operations (Sprint 1)

#### Task 3.1: Verify user bookings list endpoint

**File**: `user_root/api/bookings/list.js`

Ensure Supabase query returns `mock_set` and it's included in the response transformation.

#### Task 3.2: Verify admin trainee bookings endpoint

Ensure `mock_set` is included in all admin booking read responses.

---

### Phase 4: Frontend - User Dashboard (Sprint 2)

#### Task 4.1: Update MyBookings.jsx

**File**: `user_root/frontend/src/components/MyBookings.jsx`

Add `mock_set` display after mock_type:

```jsx
// Desktop table header
<th>Type</th>
<th>Set</th>  {/* NEW */}
<th>Date</th>

// Desktop table row
<td>{booking.mock_type || 'Mock Exam'}</td>
<td>{booking.mock_set || '-'}</td>  {/* NEW */}
<td>{formatDate(booking.exam_date)}</td>

// Mobile card
<p className="text-lg font-medium">{booking.mock_type || 'Mock Exam'}</p>
{booking.mock_set && (
  <span className="text-sm text-gray-500">Set {booking.mock_set}</span>
)}
```

---

### Phase 5: Frontend - Admin Dashboard (Sprint 2)

#### Task 5.1: Add mock_set to Column Definitions

**File**: `admin_root/admin_frontend/src/hooks/useColumnVisibility.js`

```javascript
export const COLUMN_DEFINITIONS = [
  { id: 'exam_date', label: 'Exam Date', defaultVisible: false, minWidth: '120px' },
  { id: 'mock_set', label: 'Set', defaultVisible: false, minWidth: '60px' },  // NEW
  { id: 'time', label: 'Time', defaultVisible: true, minWidth: '150px' },
  // ... rest of columns
];
```

#### Task 5.2: Update BookingsTable.jsx

**File**: `admin_root/admin_frontend/src/components/admin/BookingsTable.jsx`

Add mock_set column header and switch case for rendering.

#### Task 5.3: Update BookingRow.jsx

**File**: `admin_root/admin_frontend/src/components/admin/BookingRow.jsx`

Add mock_set cell rendering:

```jsx
case 'mock_set':
  return (
    <td key={columnId} className={cellClasses}>
      <span className={`px-2 py-1 rounded text-xs font-medium ${
        booking.mock_set
          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
          : 'text-gray-400'
      }`}>
        {booking.mock_set || '-'}
      </span>
    </td>
  );
```

---

## Testing Checklist

### Database
- [ ] Column exists in hubspot_bookings table
- [ ] Index created successfully
- [ ] Existing bookings have NULL mock_set (expected)

### Backend Write
- [ ] User booking creation saves mock_set from exam session
- [ ] Admin booking creation saves mock_set from exam session
- [ ] Bookings for Mini-mock type have NULL mock_set
- [ ] Bookings for SJ/CS with set value have correct mock_set

### Backend Read
- [ ] User bookings list returns mock_set
- [ ] Admin trainee bookings returns mock_set
- [ ] All booking detail endpoints return mock_set

### Frontend User
- [ ] MyBookings shows mock_set column
- [ ] Set displays correctly (A-H or dash for null)
- [ ] Mobile view shows set when present

### Frontend Admin
- [ ] mock_set appears in column visibility options
- [ ] Column can be toggled on/off
- [ ] BookingRow renders mock_set correctly
- [ ] Sorting works on mock_set column

---

## Rollback Plan

If issues occur:
1. Frontend changes can be reverted without data loss
2. Backend changes are backward compatible (mock_set defaults to NULL)
3. Database column can remain (harmless if unused)

---

## Future Considerations

1. **Backfill existing bookings**: Consider a one-time migration to populate mock_set for historical bookings based on associated exam's mock_set
2. **HubSpot sync**: Add mock_set to booking sync with HubSpot if needed for admin visibility there
3. **Reports**: Include mock_set in any booking analytics or reports

---

## Dependencies

- SQL script must be run before backend changes are deployed
- Backend changes must be deployed before frontend changes
- Frontend changes are safe to deploy after backend is ready

---

## Acceptance Criteria

1. ✅ New user bookings capture mock_set from session
2. ✅ New admin bookings capture mock_set from session
3. ✅ User My Bookings page shows mock_set column
4. ✅ Admin Trainee Dashboard shows mock_set in bookings table
5. ✅ mock_set is NULL for Mini-mock types
6. ✅ mock_set is A-H for SJ and CS types when set exists on exam
