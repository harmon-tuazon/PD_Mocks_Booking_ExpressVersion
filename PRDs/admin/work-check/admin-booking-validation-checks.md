# PRD: Admin Work Check Booking Validation Parity

## Overview

Add missing validation checks to admin work check booking creation to match user-facing safeguards and prevent data integrity issues.

## Problem Statement

The admin work check booking endpoint (`/api/admin/work-check-bookings/create`) lacks several validation checks present in the user endpoint:

| Check | User Endpoint | Admin Endpoint |
|-------|:-------------:|:--------------:|
| Slot date in future | ✅ | ❌ |
| Group membership | ✅ | ❌ |
| Slot capacity | ✅ | ❌ |

This can lead to:
- Overbooking slots beyond capacity
- Booking past slots accidentally
- Assigning students to slots for groups they don't belong to

## Success Criteria

- Admin cannot create bookings for past slot dates
- Admin cannot create bookings that exceed slot capacity
- Admin cannot assign students to slots unless student belongs to one of the slot's groups
- Clear error messages for each validation failure
- Minimal performance impact

## Scope

### In Scope
- Add slot date validation (must be today or future)
- Add slot capacity check (pending + confirmed < total_slots)
- Add group membership verification

### Out of Scope
- Redis distributed locking (admin operations are less frequent)
- Redis caching (admin creates are infrequent)
- Duplicate per-date check (keep current per-slot logic for admin flexibility)

## Technical Design

### File to Modify
`admin_root/api/admin/work-check-bookings/create.js`

### Implementation

#### Check 1: Slot Date Validation
**Location:** After slot fetch (line 56), before student verification

```javascript
// Check slot date is not in the past
const slotDate = new Date(slot.slot_date);
const today = new Date();
today.setHours(0, 0, 0, 0);

if (slotDate < today) {
  return res.status(400).json({
    success: false,
    error: {
      code: 'SLOT_EXPIRED',
      message: 'Cannot create booking for a past date'
    }
  });
}
```

#### Check 2: Group Membership Verification
**Location:** After student verification (line 79), before duplicate check

```javascript
// Verify student is in one of the slot's groups
const slotGroups = Array.isArray(slot.group_id) ? slot.group_id : [slot.group_id];

const { data: groupMembership } = await supabaseAdmin
  .from('groups_students')
  .select('id, group_id')
  .eq('student_id', student.student_id)  // Use student_id string, not UUID
  .in('group_id', slotGroups)
  .eq('status', 'active')
  .limit(1)
  .maybeSingle();

if (!groupMembership) {
  return res.status(403).json({
    success: false,
    error: {
      code: 'NOT_IN_GROUP',
      message: 'Student is not enrolled in any group assigned to this slot'
    }
  });
}
```

**Note:** Requires adding `group_id` to the slot select query.

#### Check 3: Slot Capacity
**Location:** After group membership check, before duplicate check

```javascript
// Check slot capacity
const { count: bookedCount, error: countError } = await supabaseAdmin
  .from('work_check_bookings')
  .select('*', { count: 'exact', head: true })
  .eq('slot_id', slot_id)
  .in('status', ['pending', 'confirmed']);

if (countError) {
  console.error('[Supabase ERROR] Failed to count bookings:', countError.message);
  throw new Error('Failed to check slot capacity');
}

if (bookedCount >= slot.total_slots) {
  return res.status(400).json({
    success: false,
    error: {
      code: 'SLOT_FULL',
      message: `Slot is at capacity (${bookedCount}/${slot.total_slots} booked)`
    }
  });
}
```

**Note:** Requires adding `total_slots` to the slot select query.

### Updated Slot Query

```javascript
const { data: slot, error: slotError } = await supabaseAdmin
  .from('work_check_slots')
  .select('id, auto_approve, slot_date, slot_time, location, is_active, group_id, total_slots')
  .eq('id', slot_id)
  .single();
```

## Validation Order

1. Slot exists ✓ (existing)
2. Slot is active ✓ (existing)
3. **Slot date in future** (new)
4. Student exists ✓ (existing)
5. **Group membership** (new)
6. **Slot capacity** (new)
7. Duplicate check ✓ (existing)
8. Create booking ✓ (existing)

## Error Responses

| Error Code | HTTP Status | Message |
|------------|-------------|---------|
| `SLOT_EXPIRED` | 400 | Cannot create booking for a past date |
| `NOT_IN_GROUP` | 403 | Student is not enrolled in any group assigned to this slot |
| `SLOT_FULL` | 400 | Slot is at capacity (X/Y booked) |

## Testing Checklist

- [ ] Booking succeeds for valid future slot with capacity and group membership
- [ ] Booking fails for past date slot
- [ ] Booking fails for today's slot (boundary test - should pass if same day)
- [ ] Booking fails when student not in slot's group
- [ ] Booking fails when slot is at capacity
- [ ] Booking fails when slot is over capacity (edge case)
- [ ] Error messages are clear and actionable

## Confidence Score: 9/10

High confidence due to:
- Direct port of existing user endpoint logic
- Clear validation requirements
- Simple database queries with indexed columns

## Estimated Effort

- Implementation: ~30 minutes
- Testing: ~20 minutes
- **Total: ~50 minutes**
