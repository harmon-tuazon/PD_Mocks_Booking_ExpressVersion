# PRD: Work Check Time Conflict Detection

## Overview

Add time conflict detection to work check booking to prevent students from booking a work check that overlaps with an existing mock exam booking.

## Problem Statement

Currently, a student can book a work check slot that overlaps with a mock exam they've already booked. This creates scheduling conflicts that require manual intervention to resolve.

## Success Criteria

- Students cannot book work checks that overlap with existing mock bookings
- Clear error message indicates the conflicting booking
- No noticeable increase in booking confirmation time (use parallel queries)
- Edge cases handled correctly (adjacent sessions allowed)

## Scope

### In Scope
- Check work check slot time against existing mock exam bookings
- Block booking if time overlap detected
- Return user-friendly error with conflict details

### Out of Scope (Future)
- Check against other work check bookings (could be added later)
- Calendar visualization of conflicts
- Suggested alternative slots

## Technical Design

### Data Structures

**Mock Bookings (`hubspot_bookings`):**
- `exam_date`: DATE (YYYY-MM-DD)
- `start_time`: TIMESTAMPTZ (ISO format: `2025-10-31T18:30:00Z`)
- `end_time`: TIMESTAMPTZ (ISO format: `2025-10-31T20:00:00Z`)
- `associated_contact_id`: TEXT (HubSpot contact ID)
- `is_active`: TEXT ('Active', 'Cancelled', etc.)

**Work Check Slots (`work_check_slots`):**
- `slot_date`: DATE
- `slot_time`: TIME (HH:MM format: `09:00`)
- `duration_minutes`: INTEGER

### Implementation

**File:** `user_root/api/work-checks/create.js`

**Location:** After duplicate check (Step 7), before booking creation (Step 8)

**Algorithm:**
1. Convert work check slot to timestamp range:
   ```javascript
   const wcStart = new Date(`${slot.slot_date}T${slot.slot_time}:00Z`);
   const wcEnd = new Date(wcStart.getTime() + slot.duration_minutes * 60000);
   ```

2. Query mock bookings for conflicts:
   ```javascript
   const { data: mockConflicts } = await supabaseAdmin
     .from('hubspot_bookings')
     .select('id, booking_id, start_time, end_time, mock_type')
     .eq('associated_contact_id', contact.hubspot_id)
     .eq('exam_date', slot.slot_date)
     .in('is_active', ['Active', 'active']);
   ```

3. Check for time overlap in application code:
   ```javascript
   const conflicts = mockConflicts?.filter(mock => {
     const mockStart = new Date(mock.start_time);
     const mockEnd = new Date(mock.end_time);
     // Overlap: NOT (wcEnd <= mockStart OR wcStart >= mockEnd)
     return !(wcEnd <= mockStart || wcStart >= mockEnd);
   });
   ```

4. Return error if conflicts found:
   ```javascript
   if (conflicts?.length > 0) {
     return res.status(409).json({
       success: false,
       error: {
         code: 'TIME_CONFLICT',
         message: `This slot conflicts with your ${conflicts[0].mock_type} exam booking`
       }
     });
   }
   ```

### Performance Optimization

Run conflict check in parallel with duplicate check to avoid adding latency:

```javascript
// Step 7: Run duplicate and conflict checks in parallel
const [duplicateResult, conflictResult] = await Promise.all([
  checkDuplicateBooking(contact.id, slot.slot_date),
  checkTimeConflicts(contact.hubspot_id, slot)
]);

if (duplicateResult.exists) {
  // Handle duplicate...
}

if (conflictResult.hasConflict) {
  // Handle conflict...
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "TIME_CONFLICT",
    "message": "This slot conflicts with your Clinical Skills exam booking at 2:30 PM"
  }
}
```

## Frontend Changes

**File:** `user_root/frontend/src/components/work-checks/WorkCheckConfirmPage.jsx`

Handle `TIME_CONFLICT` error code and display user-friendly message:
```javascript
if (errorCode === 'TIME_CONFLICT') {
  setError('You have a mock exam scheduled at this time. Please choose a different slot.');
}
```

## Testing Checklist

- [ ] No conflict: Work check books successfully when no mock on same date
- [ ] No conflict: Work check books when mock is on different date
- [ ] No conflict: Adjacent sessions allowed (mock ends at 10:00, work check starts at 10:00)
- [ ] Conflict detected: Work check overlaps with mock start time
- [ ] Conflict detected: Work check overlaps with mock end time
- [ ] Conflict detected: Work check fully within mock time range
- [ ] Conflict detected: Mock fully within work check time range
- [ ] Cancelled mocks don't trigger conflicts
- [ ] Performance: Booking time not noticeably increased

## Confidence Score: 9/10

High confidence due to:
- Clear, well-defined scope
- Simple database query with indexed columns
- Straightforward time comparison logic
- Parallel execution eliminates performance concerns

## Estimated Effort

- Backend implementation: ~30 minutes
- Frontend error handling: ~15 minutes
- Testing: ~30 minutes
- **Total: ~1.5 hours**
