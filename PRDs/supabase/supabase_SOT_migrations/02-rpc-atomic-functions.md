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

### Complete SQL Transaction Block

Run this entire block in Supabase SQL Editor as a single transaction:

```sql
-- ============================================================================
-- SUPABASE RPC ATOMIC FUNCTIONS - Sprint 1
-- Run this in Supabase SQL Editor as a single transaction
-- Uses helper functions from 01-database-schema-migration.md
-- ============================================================================

BEGIN;

-- ============================================================================
-- HELPER FUNCTIONS (from 01-database-schema-migration.md)
-- ============================================================================

CREATE OR REPLACE FUNCTION hubspot_sync.get_contact_credits(
  p_student_id TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_id UUID DEFAULT NULL,
  p_hubspot_id TEXT DEFAULT NULL
)
RETURNS hubspot_sync.hubspot_contact_credits AS $$
BEGIN
  IF p_id IS NOT NULL THEN
    RETURN (SELECT * FROM hubspot_sync.hubspot_contact_credits WHERE id = p_id);
  ELSIF p_hubspot_id IS NOT NULL THEN
    RETURN (SELECT * FROM hubspot_sync.hubspot_contact_credits WHERE hubspot_id = p_hubspot_id);
  ELSIF p_student_id IS NOT NULL AND p_email IS NOT NULL THEN
    RETURN (SELECT * FROM hubspot_sync.hubspot_contact_credits WHERE student_id = p_student_id AND email = p_email);
  ELSE
    RAISE EXCEPTION 'Must provide id, hubspot_id, or (student_id AND email)';
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION hubspot_sync.get_booking(
  p_id UUID DEFAULT NULL,
  p_hubspot_id TEXT DEFAULT NULL,
  p_booking_id TEXT DEFAULT NULL
)
RETURNS hubspot_sync.hubspot_bookings AS $$
BEGIN
  IF p_id IS NOT NULL THEN
    RETURN (SELECT * FROM hubspot_sync.hubspot_bookings WHERE id = p_id);
  ELSIF p_hubspot_id IS NOT NULL THEN
    RETURN (SELECT * FROM hubspot_sync.hubspot_bookings WHERE hubspot_id = p_hubspot_id);
  ELSIF p_booking_id IS NOT NULL THEN
    RETURN (SELECT * FROM hubspot_sync.hubspot_bookings WHERE booking_id = p_booking_id);
  ELSE
    RAISE EXCEPTION 'Must provide id, hubspot_id, or booking_id';
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION hubspot_sync.check_idempotency_key(
  p_idempotency_key TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_booking hubspot_sync.hubspot_bookings;
BEGIN
  IF p_idempotency_key IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_booking
  FROM hubspot_sync.hubspot_bookings
  WHERE idempotency_key = p_idempotency_key;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'booking_id', v_booking.booking_id,
    'id', v_booking.id,
    'hubspot_id', v_booking.hubspot_id,
    'is_active', v_booking.is_active,
    'student_id', v_booking.student_id,
    'mock_exam_id', v_booking.associated_mock_exam,
    'created_at', v_booking.created_at
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: create_booking_atomic
-- Atomic booking creation with credit deduction
-- Uses helper functions for lookups
-- UUID is auto-generated by DEFAULT gen_random_uuid(), captured via RETURNING
-- ============================================================================
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
  p_new_credit_value INTEGER
)
RETURNS JSONB AS $$
DECLARE
  v_booking_uuid UUID;  -- Populated by RETURNING (auto-generated by DEFAULT)
  v_contact hubspot_sync.hubspot_contact_credits;  -- Full record from helper
  v_exam_date DATE;
  v_result JSONB;
BEGIN
  -- Use helper function to get contact record
  v_contact := hubspot_sync.get_contact_credits(
    p_student_id := p_student_id,
    p_email := p_student_email
  );

  IF v_contact.id IS NULL THEN
    RAISE EXCEPTION 'Contact not found for student_id: %, email: %', p_student_id, p_student_email;
  END IF;

  -- Get exam date from mock_exam (using HubSpot ID since exams are admin-created)
  SELECT exam_date INTO v_exam_date
  FROM hubspot_sync.hubspot_mock_exams
  WHERE hubspot_id = p_mock_exam_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mock exam not found: %', p_mock_exam_id;
  END IF;

  -- Insert booking - let PostgreSQL auto-generate UUID via DEFAULT gen_random_uuid()
  -- hubspot_id is NULL, will be populated by batch sync cron
  INSERT INTO hubspot_sync.hubspot_bookings (
    hubspot_id,
    booking_id,
    student_id,
    student_email,
    associated_contact_id,
    associated_mock_exam,
    name,
    is_active,
    token_used,
    attending_location,
    dominant_hand,
    idempotency_key,
    exam_date,
    created_at,
    synced_at
  ) VALUES (
    NULL,
    p_booking_id,
    p_student_id,
    p_student_email,
    v_contact.hubspot_id,
    p_mock_exam_id,
    p_student_name,
    'Active',
    p_token_used,
    p_attending_location,
    p_dominant_hand,
    p_idempotency_key,
    v_exam_date,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_booking_uuid;  -- Capture auto-generated UUID

  -- Update contact credits using contact.id from helper
  EXECUTE format(
    'UPDATE hubspot_sync.hubspot_contact_credits
     SET %I = $1, updated_at = NOW(), synced_at = NOW()
     WHERE id = $2',
    p_credit_field
  ) USING p_new_credit_value, v_contact.id;

  -- NOTE: total_bookings is NOT updated here!
  -- The existing Redis counter + webhook pattern handles this:
  --   1. Redis INCR exam:{mock_exam_id}:bookings (done by API before calling this function)
  --   2. Webhook sends new count to HubSpot (non-blocking)
  --   3. updateExamBookingCountInSupabase() syncs to Supabase (non-blocking)

  v_result := jsonb_build_object(
    'success', true,
    'booking_id', v_booking_uuid,
    'booking_code', p_booking_id,
    'contact_hubspot_id', v_contact.hubspot_id,
    'mock_exam_hubspot_id', p_mock_exam_id
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: cancel_booking_atomic
-- Atomic booking cancellation with credit restoration
-- Uses helper functions for lookups
-- ============================================================================
CREATE OR REPLACE FUNCTION hubspot_sync.cancel_booking_atomic(
  p_booking_id UUID,
  p_credit_field TEXT,
  p_restored_credit_value INTEGER
)
RETURNS JSONB AS $$
DECLARE
  v_booking hubspot_sync.hubspot_bookings;  -- Full record from helper
  v_contact hubspot_sync.hubspot_contact_credits;  -- Full record from helper
  v_result JSONB;
BEGIN
  -- Use helper function to get booking record
  v_booking := hubspot_sync.get_booking(p_id := p_booking_id);

  IF v_booking.id IS NULL THEN
    RAISE EXCEPTION 'Booking not found: %', p_booking_id;
  END IF;

  -- Use helper function to get contact record (using booking's student info)
  v_contact := hubspot_sync.get_contact_credits(
    p_student_id := v_booking.student_id,
    p_email := v_booking.student_email
  );

  -- Update booking status (batch sync cron will sync to HubSpot)
  UPDATE hubspot_sync.hubspot_bookings
  SET is_active = 'Cancelled',
      updated_at = NOW(),
      synced_at = NOW()
  WHERE id = p_booking_id;

  -- Restore contact credits using contact.id from helper
  EXECUTE format(
    'UPDATE hubspot_sync.hubspot_contact_credits
     SET %I = $1, updated_at = NOW(), synced_at = NOW()
     WHERE id = $2',
    p_credit_field
  ) USING p_restored_credit_value, v_contact.id;

  -- NOTE: total_bookings is NOT decremented here!
  -- The existing Redis counter + webhook pattern handles this:
  --   1. Redis DECR exam:{mock_exam_id}:bookings (done by API before calling this function)
  --   2. Webhook sends new count to HubSpot (non-blocking)
  --   3. updateExamBookingCountInSupabase() syncs to Supabase (non-blocking)

  v_result := jsonb_build_object(
    'success', true,
    'booking_id', p_booking_id,
    'booking_hubspot_id', v_booking.hubspot_id,
    'student_id', v_booking.student_id,
    'mock_exam_id', v_booking.associated_mock_exam
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- ============================================================================
-- VERIFICATION (run after COMMIT)
-- ============================================================================
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'hubspot_sync'
  AND routine_name IN (
    'check_idempotency_key',
    'create_booking_atomic',
    'cancel_booking_atomic',
    'get_contact_credits',
    'get_booking'
  )
ORDER BY routine_name;
```

---

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **UUID auto-generated** | Uses `DEFAULT gen_random_uuid()` - no need to manually call `gen_random_uuid()` |
| **RETURNING clause** | Captures auto-generated UUID after INSERT for response |
| **Helper functions** | Reuses `get_contact_credits()` and `get_booking()` for consistent lookups |
| **Full row types** | Uses `hubspot_sync.hubspot_bookings` instead of RECORD for type safety |
| **Single transaction** | All functions created atomically - if one fails, none are created |

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
