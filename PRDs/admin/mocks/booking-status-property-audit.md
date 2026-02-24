# Booking Status Property Audit

## Overview

This PRD documents all uses of the `booking_status` property in the mocks_booking codebase and identifies dependencies that would break if this property is removed or modified.

## Property Details

- **Property Name**: `booking_status`
- **HubSpot Object**: Bookings (`2-50158943`)
- **Data Type**: String (Enumeration)
- **Valid Values**: `confirmed`, `pending`, `completed`, `cancelled`

## Current Usage Summary

| Category | File Count | Critical |
|----------|------------|----------|
| Frontend Components | 4 | Yes |
| Admin API Endpoints | 7 | Yes |
| Shared Modules | 4 | Yes |
| User API | 1 | Yes |
| Tests | 3 | No |
| PRDs/Documentation | 8 | No |

---

## Detailed Usage Analysis

### 1. Frontend Components (Admin)

#### BookingRow.jsx
**Location**: `admin_root/admin_frontend/src/components/admin/BookingRow.jsx:59`
```javascript
const isCancelled = booking.booking_status === 'cancelled' || booking.is_active === 'Cancelled';
```
**Purpose**: Determines visual styling for cancelled bookings
**Impact if Removed**: UI would not properly style cancelled bookings

#### useAttendanceMarking.js
**Location**: `admin_root/admin_frontend/src/hooks/useAttendanceMarking.js:61`
```javascript
if (booking?.booking_status === 'cancelled') {
```
**Purpose**: Prevents marking attendance on cancelled bookings
**Impact if Removed**: Could allow invalid attendance marking on cancelled bookings

#### useBatchCancellation.js
**Location**: `admin_root/admin_frontend/src/hooks/useBatchCancellation.js:35,86,96,114`
```javascript
booking.booking_status !== 'cancelled'
```
**Purpose**: Filters out already-cancelled bookings from batch operations
**Impact if Removed**: Would attempt to re-cancel already cancelled bookings

#### useCancelBookingsMutation.js
**Location**: `admin_root/admin_frontend/src/hooks/useCancelBookingsMutation.js:65`
```javascript
booking_status: 'cancelled'
```
**Purpose**: Sets status when cancelling a booking
**Impact if Removed**: Cancellation would not update this property

---

### 2. Admin API Endpoints

#### mock-exams/export-csv.js
**Location**: `admin_root/api/admin/mock-exams/export-csv.js:19`
```javascript
booking_status: Joi.string().allow('', null),
```
**Purpose**: Joi validation schema for CSV export
**Impact if Removed**: Validation would fail if property included in export

#### mock-exams/get.js
**Location**: `admin_root/api/admin/mock-exams/get.js:61`
```javascript
booking_status: booking.properties.booking_status || 'confirmed',
```
**Purpose**: Returns booking status in API response with default
**Impact if Removed**: API response would be missing status field

#### mock-exams/[id]/attendance.js
**Location**: `admin_root/api/admin/mock-exams/[id]/attendance.js:150,325`
```javascript
if (existingBooking.properties.booking_status === 'cancelled') {
```
**Purpose**: Validates booking is not cancelled before attendance update
**Impact if Removed**: Could corrupt attendance data on cancelled bookings

#### mock-exams/[id]/bookings.js
**Location**: `admin_root/api/admin/mock-exams/[id]/bookings.js:175,276`
```javascript
booking_status: props.booking_status || '',
```
**Purpose**: Fetches and returns booking_status property
**Impact if Removed**: Bookings list would miss status information

#### mock-exams/[id]/cancel-bookings.js
**Location**: `admin_root/api/admin/mock-exams/[id]/cancel-bookings.js:490`
**Purpose**: Includes in property list for batch operations
**Impact if Removed**: Cancellation operations would not have status context

#### sync/force-supabase.js
**Location**: `admin_root/api/admin/sync/force-supabase.js:91`
```javascript
booking_status: props.booking_status,
```
**Purpose**: Syncs booking_status to Supabase database
**Impact if Removed**: Supabase would have incomplete booking data

#### trainees/[contactId]/bookings.js
**Location**: `admin_root/api/admin/trainees/[contactId]/bookings.js:157`
**Purpose**: Fetches booking_status for trainee's bookings view
**Impact if Removed**: Trainee booking history would miss status

---

### 3. Shared Modules (Critical)

#### admin_root/api/_shared/hubspot.js
**Multiple Locations**: Lines 388, 756, 770, 814, 830, 883, 1640, 1687-1689

**Key Usages**:

1. **Line 756** - Status filter mapping:
```javascript
const statusMap = {
  'upcoming': ['confirmed', 'pending'],
  'completed': ['completed'],
  'cancelled': ['cancelled']
};
```

2. **Line 814** - Cancelled check:
```javascript
if (booking.properties.booking_status === 'cancelled') {
```

3. **Lines 1687-1689** - Statistics calculation:
```javascript
confirmed: bookings.filter(b => b.properties.booking_status === 'confirmed').length,
pending: bookings.filter(b => b.properties.booking_status === 'pending').length,
cancelled: bookings.filter(b => b.properties.booking_status === 'cancelled').length
```

**Impact if Removed**:
- Booking filtering by status would fail
- Statistics would be incorrect
- getBookingsForContact would break

#### supabase-data.js (admin_root & user_root)
**Locations**:
- `admin_root/api/_shared/supabase-data.js:164,212`
- `user_root/api/_shared/supabase-data.js:164,212`

```javascript
booking_status: props.booking_status,
```
**Purpose**: Maps HubSpot booking_status to Supabase schema
**Impact if Removed**: Supabase sync would fail or have null values

---

### 4. User API

#### user_root/api/bookings/create.js
**Location**: `user_root/api/bookings/create.js:515`
```javascript
booking_status: 'Confirmed',
```
**Purpose**: Sets initial status when creating a booking
**Impact if Removed**: New bookings would have no status

---

### 5. Database Schema (Supabase)

**Location**: `PRDs/supabase/supabase-setup.sql:18`
```sql
booking_status TEXT,
```
**Purpose**: Stores booking_status in Supabase for fast reads
**Impact if Removed**: Database schema mismatch, sync failures

---

## Dependency Chain

```
User Creates Booking
        │
        ▼
create.js sets booking_status = 'Confirmed'
        │
        ▼
supabase-data.js syncs to Supabase
        │
        ▼
Admin views in BookingRow.jsx (checks status for styling)
        │
        ▼
hubspot.js calculates statistics (confirmed/pending/cancelled)
        │
        ▼
Attendance/Cancellation hooks check status before operations
```

---

## Risk Assessment

### Critical Breaks (Application Failure)

1. **hubspot.js:getBookingsForContact** - Would throw errors on status filtering
2. **Statistics calculation** - Would return undefined/null counts
3. **Supabase sync** - Schema mismatch errors
4. **Attendance validation** - Could allow invalid operations

### High Impact (Data Integrity)

1. **useBatchCancellation** - Would re-cancel already cancelled bookings
2. **useAttendanceMarking** - Could mark attendance on cancelled bookings
3. **CSV export** - Would have missing/null status column

### Medium Impact (UI/UX)

1. **BookingRow.jsx** - Visual styling inconsistency
2. **API responses** - Missing status field in JSON responses

---

## Relationship with `is_active` Property

The codebase uses both `booking_status` and `is_active` properties:

| Property | Values | Primary Use |
|----------|--------|-------------|
| `booking_status` | confirmed, pending, completed, cancelled | Filtering, statistics, display |
| `is_active` | Active, Cancelled, Completed | Capacity calculations, availability |

**Redundancy**: There is significant overlap between these properties. The codebase often checks both:
```javascript
const isCancelled = booking.booking_status === 'cancelled' || booking.is_active === 'Cancelled';
```

---

## Recommendations

### If Removing `booking_status`

1. **Migrate all logic to use `is_active`** - Requires updating:
   - 4 frontend components
   - 7 API endpoints
   - 4 shared modules
   - 1 user API endpoint
   - Supabase schema

2. **Update statistics calculation** to use `is_active` values

3. **Update Supabase schema** - Remove column or keep for historical data

4. **Update all tests** - 3 test files reference this property

### If Keeping `booking_status`

1. **Standardize casing** - Currently mixed (`'Confirmed'` vs `'confirmed'`)
2. **Document as source of truth** for booking lifecycle state
3. **Consider deprecating `is_active`** to reduce redundancy

---

## Files Requiring Updates (If Removed)

### Must Update (Will Break)
- [ ] `admin_root/admin_frontend/src/components/admin/BookingRow.jsx`
- [ ] `admin_root/admin_frontend/src/hooks/useAttendanceMarking.js`
- [ ] `admin_root/admin_frontend/src/hooks/useBatchCancellation.js`
- [ ] `admin_root/admin_frontend/src/hooks/useCancelBookingsMutation.js`
- [ ] `admin_root/api/admin/mock-exams/export-csv.js`
- [ ] `admin_root/api/admin/mock-exams/get.js`
- [ ] `admin_root/api/admin/mock-exams/[id]/attendance.js`
- [ ] `admin_root/api/admin/mock-exams/[id]/bookings.js`
- [ ] `admin_root/api/admin/mock-exams/[id]/cancel-bookings.js`
- [ ] `admin_root/api/admin/sync/force-supabase.js`
- [ ] `admin_root/api/admin/trainees/[contactId]/bookings.js`
- [ ] `admin_root/api/_shared/hubspot.js`
- [ ] `admin_root/api/_shared/supabase-data.js`
- [ ] `user_root/api/_shared/supabase-data.js`
- [ ] `user_root/api/bookings/create.js`
- [ ] `scripts/migrate-hubspot-to-supabase.js`

### Should Update (Tests)
- [ ] `admin_root/tests/test-api-optimizations.js`
- [ ] `admin_root/tests/test-mock-exam-details-fix.js`
- [ ] `admin_root/tests/test-mock-exam-get-fix.js`

### Database Schema
- [ ] `PRDs/supabase/supabase-setup.sql`
- [ ] Supabase `hubspot_bookings` table

---

## Conclusion

The `booking_status` property is deeply integrated into the booking lifecycle management system. Removal would require significant refactoring across 16+ code files and database schema changes.

**Recommendation**: If consolidation is desired, migrate to using `is_active` as the single source of truth, but plan for 2-3 days of refactoring and thorough testing.

---

*PRD Version: 1.0*
*Created: 2025-11-21*
*Author: Claude Code Assistant*
