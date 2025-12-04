# RPC Atomic Functions

## Overview

| Field | Value |
|-------|-------|
| **Phase** | Sprint 1 (Day 1-2) |
| **Prerequisites** | Schema migration completed |
| **Related Docs** | [01-database-schema-migration.md](./01-database-schema-migration.md), [03-backend-api-migration.md](./03-backend-api-migration.md) |

---

## Strategy Decisions

### Capacity/total_bookings Management

**DECISION: MAINTAIN EXISTING ARCHITECTURE**

The current architecture already works well:
1. Redis holds real-time counter (`exam:{id}:bookings`) for capacity checks
2. Redis counter is incremented/decremented atomically
3. Webhook (non-blocking) syncs Redis counter → HubSpot total_bookings
4. Supabase total_bookings is updated in parallel (non-blocking)

**Why keep this pattern:**
- Webhooks are already non-blocking (no impact on booking response time)
- Redis provides proven race condition protection
- No need to change a working capacity management system
- Supabase total_bookings is updated via `updateExamBookingCountInSupabase()`

The atomic functions below focus on:
- Booking record creation (hubspot_id = NULL initially)
- Credit deduction from contact
- total_bookings is handled separately via existing Redis + webhook pattern

### Idempotency Key Management

**DECISION: MOVE IDEMPOTENCY CHECK TO SUPABASE**

| Aspect | Current (HubSpot) | New (Supabase) |
|--------|-------------------|----------------|
| Check time | ~200ms | ~5-10ms |
| Improvement | - | 20x faster |
| Duplicate prevention | HubSpot search | UNIQUE index constraint |

**Implementation notes:**
- Add UNIQUE index on idempotency_key column
- Existing key generation logic unchanged (SHA-256 hash)
- 5-minute timestamp buckets still apply
- Cancelled/Failed bookings still get new keys (same logic)
- idempotency_key synced to HubSpot for audit/debugging

**Edge case**: If Supabase unavailable, fallback to HubSpot search (slower but works)

---

## Atomic Transaction Functions

### Create Booking Atomic

```sql
-- Atomic booking creation (Supabase-first for booking records only)
-- Uses existing `id` column as primary identifier
-- Uses student_id + email for contact lookup (already available at booking time)
-- Uses mock_exam_id (HubSpot ID) directly since mock exams are admin-created
-- NOTE: total_bookings is handled by existing Redis counter + webhook pattern
-- NOTE: No per-record sync tracking - batch sync cron handles HubSpot sync
CREATE OR REPLACE FUNCTION hubspot_sync.create_booking_atomic(
  p_booking_id TEXT,
  p_student_id TEXT,  -- Use student_id for contact lookup (already known)
  p_student_email TEXT,  -- Use email for contact lookup (already known)
  p_mock_exam_id TEXT,  -- HubSpot ID - mock exams are admin-created, so ID is always available
  p_student_name TEXT,
  p_token_used TEXT,
  p_attending_location TEXT,
  p_dominant_hand TEXT,
  p_idempotency_key TEXT,
  p_credit_field TEXT,
  p_new_credit_value INTEGER
)
RETURNS JSONB AS $$
DECLARE
  v_booking_uuid UUID;
  v_contact_record RECORD;
  v_exam_date DATE;
  v_result JSONB;
BEGIN
  -- Get contact record by student_id + email (for credit update and hubspot_id)
  SELECT id, hubspot_id INTO v_contact_record
  FROM hubspot_sync.hubspot_contact_credits
  WHERE student_id = p_student_id AND email = p_student_email;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contact not found for student_id: %, email: %', p_student_id, p_student_email;
  END IF;

  -- Get exam date from mock_exam (using HubSpot ID since exams are admin-created)
  SELECT exam_date INTO v_exam_date
  FROM hubspot_sync.hubspot_mock_exams
  WHERE hubspot_id = p_mock_exam_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mock exam not found: %', p_mock_exam_id;
  END IF;

  -- Generate booking UUID (uses existing UUID primary key)
  v_booking_uuid := gen_random_uuid();

  -- Insert booking (hubspot_id is NULL, will be populated by batch sync cron)
  INSERT INTO hubspot_sync.hubspot_bookings (
    id,  -- Existing UUID primary key
    hubspot_id,  -- NULL - populated by batch sync cron
    booking_id,
    student_id,  -- For contact lookup
    student_email,  -- For contact lookup
    contact_id,  -- HubSpot contact ID (for association creation)
    mock_exam_id,  -- HubSpot exam ID (always available for admin-created exams)
    student_name,
    is_active,
    token_used,
    attending_location,
    dominant_hand,
    idempotency_key,
    exam_date,
    created_at,
    synced_at
  ) VALUES (
    v_booking_uuid,
    NULL,  -- hubspot_id populated by batch sync cron
    p_booking_id,
    p_student_id,
    p_student_email,
    v_contact_record.hubspot_id,  -- May be NULL for new contacts
    p_mock_exam_id,  -- HubSpot ID - always available
    p_student_name,
    'Active',
    p_token_used,
    p_attending_location,
    p_dominant_hand,
    p_idempotency_key,
    v_exam_date,
    NOW(),
    NOW()
  );

  -- Update contact credits (batch sync cron will sync to HubSpot)
  EXECUTE format(
    'UPDATE hubspot_sync.hubspot_contact_credits
     SET %I = $1, updated_at = NOW(), synced_at = NOW()
     WHERE id = $2',
    p_credit_field
  ) USING p_new_credit_value, v_contact_record.id;

  -- NOTE: total_bookings is NOT updated here!
  -- The existing Redis counter + webhook pattern handles this:
  --   1. Redis INCR exam:{mock_exam_id}:bookings (done by API before calling this function)
  --   2. Webhook sends new count to HubSpot (non-blocking)
  --   3. updateExamBookingCountInSupabase() syncs to Supabase (non-blocking)

  -- Return result with id (the existing UUID column)
  v_result := jsonb_build_object(
    'success', true,
    'booking_id', v_booking_uuid,  -- UUID primary key
    'booking_code', p_booking_id,  -- Human-readable booking ID (BK-...)
    'contact_hubspot_id', v_contact_record.hubspot_id,
    'mock_exam_hubspot_id', p_mock_exam_id
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;
```

### Cancel Booking Atomic

```sql
-- Atomic booking cancellation
-- Uses existing `id` column (UUID) as primary identifier
-- Uses student_id + email for contact lookup
-- NOTE: total_bookings is handled by existing Redis counter + webhook pattern
-- NOTE: No per-record sync tracking - batch sync cron handles HubSpot sync
CREATE OR REPLACE FUNCTION hubspot_sync.cancel_booking_atomic(
  p_booking_id UUID,  -- Uses existing `id` column
  p_credit_field TEXT,
  p_restored_credit_value INTEGER
)
RETURNS JSONB AS $$
DECLARE
  v_booking RECORD;
  v_contact_id UUID;
  v_result JSONB;
BEGIN
  -- Get booking details
  SELECT * INTO v_booking
  FROM hubspot_sync.hubspot_bookings
  WHERE id = p_booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found: %', p_booking_id;
  END IF;

  -- Get contact id for credit restore (using student_id + email from booking)
  SELECT id INTO v_contact_id
  FROM hubspot_sync.hubspot_contact_credits
  WHERE student_id = v_booking.student_id AND email = v_booking.student_email;

  -- Update booking status (batch sync cron will sync to HubSpot)
  UPDATE hubspot_sync.hubspot_bookings
  SET is_active = 'Cancelled',
      updated_at = NOW(),
      synced_at = NOW()
  WHERE id = p_booking_id;

  -- Restore contact credits (batch sync cron will sync to HubSpot)
  EXECUTE format(
    'UPDATE hubspot_sync.hubspot_contact_credits
     SET %I = $1, updated_at = NOW(), synced_at = NOW()
     WHERE id = $2',
    p_credit_field
  ) USING p_restored_credit_value, v_contact_id;

  -- NOTE: total_bookings is NOT decremented here!
  -- The existing Redis counter + webhook pattern handles this:
  --   1. Redis DECR exam:{mock_exam_id}:bookings (done by API before calling this function)
  --   2. Webhook sends new count to HubSpot (non-blocking)
  --   3. updateExamBookingCountInSupabase() syncs to Supabase (non-blocking)

  v_result := jsonb_build_object(
    'success', true,
    'booking_id', p_booking_id,  -- UUID primary key
    'booking_hubspot_id', v_booking.hubspot_id,
    'student_id', v_booking.student_id,
    'mock_exam_id', v_booking.mock_exam_id
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;
```

---

## How Rollbacks Work with RPC (Automatic)

PostgreSQL automatically wraps each function call in a transaction. If ANY statement fails, ALL previous statements are rolled back.

**Example flow for create_booking_atomic:**
```
1. SELECT contact record → Success
2. SELECT exam date → Success
3. INSERT booking → Success
4. UPDATE credits → Fails (e.g., contact not found)
5. PostgreSQL automatically undoes step 3 (booking INSERT)
6. Function returns error to JavaScript
```

**YOU DON'T WRITE ROLLBACK CODE - The database handles it automatically.**

---

## How Errors Propagate to JavaScript

When a function fails (RAISE EXCEPTION or constraint violation), JavaScript receives:

```javascript
{
  data: null,
  error: {
    message: "Contact not found for student_id: STU123, email: test@example.com",
    details: null,
    hint: null,
    code: "P0001"  // PostgreSQL error code
  }
}
```

### Common Error Codes

| Code | Meaning | Example |
|------|---------|---------|
| P0001 | RAISE EXCEPTION | "Contact not found" |
| 23505 | unique_violation | Duplicate idempotency_key |
| 23503 | foreign_key_violation | Invalid reference |
| 23502 | not_null_violation | Required field missing |

---

## Logging Strategy

### Where Logs Appear

| Log Type | Location | Ease of Access |
|----------|----------|----------------|
| `console.log` (JS) | Vercel function logs | Easy |
| `console.error` (JS) | Vercel function logs | Easy |
| `RAISE NOTICE` (SQL) | Supabase Postgres logs | Harder |
| RPC error.message | Both (JS error object) | Easy |
| Audit log table | Supabase | Queryable |

**RECOMMENDATION: Do most logging in JavaScript, not SQL**

---

## Backend RPC Usage Pattern

```javascript
// In your API endpoint (e.g., api/user/bookings/create.js)

const { data, error } = await supabase.rpc('create_booking_atomic', {
  p_booking_id: 'BK-20251203-ABC123',
  p_student_id: studentId,
  p_student_email: studentEmail,
  p_mock_exam_id: mockExamId,
  p_student_name: studentName,
  p_token_used: tokenType,
  p_attending_location: location,
  p_dominant_hand: hand,
  p_idempotency_key: idempotencyKey,
  p_credit_field: creditField,
  p_new_credit_value: newCreditValue
});

if (error) {
  // Booking was NOT created - auto-rolled back
  console.error('[BOOKING] Atomic operation failed:', {
    error: error.message,
    code: error.code,
    studentId,
    mockExamId
  });

  // Handle specific errors
  if (error.code === '23505') {
    return res.status(200).json({
      success: true,
      message: 'Duplicate request - booking already exists',
      idempotent: true
    });
  }

  if (error.message.includes('Contact not found')) {
    return res.status(400).json({
      success: false,
      error: 'Contact not found in system'
    });
  }

  return res.status(500).json({
    success: false,
    error: 'Booking failed - please try again'
  });
}

// If we get here, BOTH booking AND credit update succeeded
console.log('[BOOKING] Created successfully:', {
  bookingId: data.booking_id,
  bookingCode: data.booking_code,
  studentId
});

return res.status(201).json({
  success: true,
  booking: data
});
```

---

## Debugging Tips

### What You CAN See
- Whether the operation succeeded or failed
- Error message (e.g., "Contact not found for student_id: X")
- PostgreSQL error code (e.g., 23505 for duplicate)
- All your console.log output in Vercel logs

### What You CAN'T Easily See
- Which specific line inside the SQL function failed
- Intermediate variable values during SQL execution
- Step-by-step trace through the function

### How to Debug When Things Go Wrong
1. Check the `error.message` - it usually tells you what failed
2. Query the database to see current state
3. For complex issues, run the SQL manually in Supabase SQL Editor
4. Add `RAISE NOTICE` statements temporarily (but check Supabase logs)

---

## Testing the Functions

```sql
-- Test create_booking_atomic (dry run - will fail without real data)
SELECT hubspot_sync.create_booking_atomic(
  'BK-TEST-001',
  'STU123',
  'student@test.com',
  '12345678',
  'Test Student',
  'sj_credits',
  'Online',
  'Right',
  'test-idempotency-key-123',
  'sj_credits',
  4
);

-- Test cancel_booking_atomic
SELECT hubspot_sync.cancel_booking_atomic(
  'uuid-of-booking-to-cancel',
  'sj_credits',
  5
);

-- Test idempotency check
SELECT hubspot_sync.check_idempotency_key('test-idempotency-key-123');
```

---

## Sprint 1 Checklist (RPC Functions)

- [ ] Deploy create_booking_atomic function
- [ ] Deploy cancel_booking_atomic function
- [ ] Deploy check_idempotency_key function
- [ ] Test create_booking_atomic with valid data
- [ ] Test create_booking_atomic with invalid contact
- [ ] Test create_booking_atomic with invalid exam
- [ ] Test cancel_booking_atomic with valid booking
- [ ] Test cancel_booking_atomic with non-existent booking
- [ ] Verify automatic rollback on failure
- [ ] Test idempotency key duplicate detection

---

*Previous: [01-database-schema-migration.md](./01-database-schema-migration.md)*
*Next: [03-backend-api-migration.md](./03-backend-api-migration.md)*
