# Backend API Migration

## Overview

| Field | Value |
|-------|-------|
| **Phase** | Sprint 2-3 (Day 3-7) |
| **Prerequisites** | Schema migration, RPC functions deployed |
| **Related Docs** | [02-rpc-atomic-functions.md](./02-rpc-atomic-functions.md), [04-cron-batch-sync.md](./04-cron-batch-sync.md) |

---

## Files to Modify

### User Root - Booking Creation

**File: `user_root/api/bookings/create.js`**

| Change | Current | New |
|--------|---------|-----|
| Contact lookup | By hubspot_id | By id (UUID) via student_id + email |
| Booking creation | HubSpot first | Supabase first (hubspot_id = NULL) |
| Credit deduction | HubSpot blocking | Supabase blocking |
| HubSpot sync | N/A | Batch cron (every 2 hours) |
| Response ID | hubspot_id | booking_id (id UUID available) |

### User Root - Credit Validation

**File: `user_root/api/mock-exams/validate-credits.js`**

| Change | Current | New |
|--------|---------|-----|
| Lookup method | student_id + email → Supabase → HubSpot fallback | student_id + email → Supabase ONLY |
| Return ID | hubspot_id | id (existing UUID) |
| HubSpot fallback | Yes | No (Supabase is authoritative) |

### User Root - Booking Cancellation

**File: `user_root/api/bookings/[id].js`**

| Change | Current | New |
|--------|---------|-----|
| Booking lookup | By hubspot_id | By booking_id or id (UUID) |
| Credit restore | HubSpot blocking | Supabase blocking |
| HubSpot sync | Blocking | Background |

---

## New Files to Create

| File Path | Purpose |
|-----------|---------|
| `user_root/api/_shared/supabase-transactions.js` | Atomic transaction wrappers |
| `admin_root/api/admin/cron/batch-sync-hubspot.js` | Batch sync cron (every 2 hours) |

---

## API Response Changes

### Booking Creation Response

```javascript
// CURRENT Response
{
  success: true,
  data: {
    booking_id: "BK-20251203-ABC123",
    booking_record_id: "123456789",  // <- This is hubspot_id
    ...
  }
}

// NEW Response (Supabase-first)
{
  success: true,
  data: {
    booking_id: "BK-20251203-ABC123",
    booking_record_id: "BK-20251203-ABC123",  // <- Use booking_id, not hubspot_id
    id: "uuid-...",  // <- Existing UUID primary key
    // hubspot_id is NOT returned (may not exist yet - populated by batch cron)
    ...
  }
}
```

### Credit Validation Response

```javascript
// CURRENT Response
{
  success: true,
  data: {
    contact_id: "123456789",  // <- hubspot_id
    ...
  }
}

// NEW Response
{
  success: true,
  data: {
    contact_id: "uuid-...",  // <- existing id (UUID)
    // hubspot_id NOT returned to frontend
    ...
  }
}
```

---

## Feature Flags

```javascript
// config/feature-flags.js

const MIGRATION_FLAGS = {
  // Phase 2: Read from Supabase only (no HubSpot fallback)
  SUPABASE_ONLY_READ: process.env.FF_SUPABASE_ONLY_READ === 'true',

  // Phase 3: Write to Supabase first
  SUPABASE_PRIMARY_WRITE: process.env.FF_SUPABASE_PRIMARY_WRITE === 'true',

  // Phase 3: Background HubSpot sync
  HUBSPOT_BACKGROUND_SYNC: process.env.FF_HUBSPOT_BACKGROUND_SYNC === 'true',

  // Rollback flag - revert to HubSpot-first
  HUBSPOT_SOURCE_OF_TRUTH: process.env.FF_HUBSPOT_SOURCE_OF_TRUTH === 'true',

  // Use existing id (UUID) as primary identifier
  USE_UUID_PRIMARY: process.env.FF_USE_UUID_PRIMARY === 'true'
};

module.exports = { MIGRATION_FLAGS };
```

---

## Supabase Transaction Wrapper

**File: `user_root/api/_shared/supabase-transactions.js`**

```javascript
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Create booking atomically via RPC
 * @param {Object} params - Booking parameters
 * @returns {Promise<Object>} Booking result
 */
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
  newCreditValue
}) {
  console.log('[SUPABASE] Creating booking atomically:', { bookingId, studentId });

  const { data, error } = await supabase.rpc('create_booking_atomic', {
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
    p_new_credit_value: newCreditValue
  });

  if (error) {
    console.error('[SUPABASE] Atomic booking failed:', {
      error: error.message,
      code: error.code,
      bookingId,
      studentId
    });

    // Check for idempotency (duplicate key)
    if (error.code === '23505') {
      return {
        success: true,
        idempotent: true,
        message: 'Duplicate request - booking already exists'
      };
    }

    throw new Error(error.message);
  }

  console.log('[SUPABASE] Booking created successfully:', {
    bookingId: data.booking_id,
    bookingCode: data.booking_code
  });

  return {
    success: true,
    idempotent: false,
    data
  };
}

/**
 * Cancel booking atomically via RPC
 * @param {Object} params - Cancellation parameters
 * @returns {Promise<Object>} Cancellation result
 */
async function cancelBookingAtomic({
  bookingId,  // UUID
  creditField,
  restoredCreditValue
}) {
  console.log('[SUPABASE] Cancelling booking atomically:', { bookingId });

  const { data, error } = await supabase.rpc('cancel_booking_atomic', {
    p_booking_id: bookingId,
    p_credit_field: creditField,
    p_restored_credit_value: restoredCreditValue
  });

  if (error) {
    console.error('[SUPABASE] Atomic cancellation failed:', {
      error: error.message,
      code: error.code,
      bookingId
    });
    throw new Error(error.message);
  }

  console.log('[SUPABASE] Booking cancelled successfully:', {
    bookingId: data.booking_id
  });

  return {
    success: true,
    data
  };
}

/**
 * Check idempotency key via RPC
 * @param {string} idempotencyKey - The key to check
 * @returns {Promise<Object|null>} Existing booking or null
 */
async function checkIdempotencyKey(idempotencyKey) {
  if (!idempotencyKey) return null;

  const { data, error } = await supabase.rpc('check_idempotency_key', {
    p_idempotency_key: idempotencyKey
  });

  if (error) {
    console.warn('[SUPABASE] Idempotency check failed:', error.message);
    return null;  // Treat as not found
  }

  if (data && data.found) {
    console.log('[SUPABASE] Idempotency key found:', {
      bookingId: data.booking_id,
      isActive: data.is_active
    });
    return data;
  }

  return null;
}

/**
 * Get contact credits from Supabase
 * @param {string} studentId - Student ID
 * @param {string} email - Student email
 * @returns {Promise<Object>} Contact credits
 */
async function getContactCredits(studentId, email) {
  const { data, error } = await supabase
    .from('hubspot_contact_credits')
    .select('*')
    .eq('student_id', studentId)
    .eq('email', email)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Not found
      return null;
    }
    throw new Error(`Failed to get contact credits: ${error.message}`);
  }

  return data;
}

module.exports = {
  createBookingAtomic,
  cancelBookingAtomic,
  checkIdempotencyKey,
  getContactCredits
};
```

---

## Updated Credit Validation

**File: `user_root/api/mock-exams/validate-credits.js`** (changes only)

```javascript
const { getContactCredits } = require('../_shared/supabase-transactions');
const { MIGRATION_FLAGS } = require('../../../config/feature-flags');

async function validateCredits(studentId, email) {
  // Try Supabase first (always)
  let contact = await getContactCredits(studentId, email);

  if (!contact && !MIGRATION_FLAGS.SUPABASE_ONLY_READ) {
    // Fallback to HubSpot (only during migration)
    console.warn('[VALIDATE] Contact not in Supabase, checking HubSpot...');
    contact = await getContactFromHubSpot(studentId, email);

    if (contact) {
      // Auto-populate Supabase for next time
      await syncContactToSupabase(contact);
    }
  }

  if (!contact) {
    throw new Error('Contact not found');
  }

  // Return id (UUID) instead of hubspot_id
  return {
    contact_id: contact.id,  // UUID, not hubspot_id
    sj_credits: contact.sj_credits || 0,
    cs_credits: contact.cs_credits || 0,
    sjmini_credits: contact.sjmini_credits || 0,
    mock_discussion_token: contact.mock_discussion_token || 0,
    shared_mock_credits: contact.shared_mock_credits || 0
  };
}
```

---

## Updated Booking Creation

**File: `user_root/api/bookings/create.js`** (key changes)

```javascript
const { createBookingAtomic, checkIdempotencyKey } = require('../_shared/supabase-transactions');
const { generateBookingId, generateIdempotencyKey } = require('../_shared/utils');

module.exports = async (req, res) => {
  try {
    const { studentId, studentEmail, mockExamId, ... } = req.body;

    // Generate idempotency key
    const idempotencyKey = generateIdempotencyKey(
      studentId,
      mockExamId,
      examDate,
      mockType
    );

    // Check for duplicate (Supabase-first, ~5ms vs HubSpot ~200ms)
    const existingBooking = await checkIdempotencyKey(idempotencyKey);
    if (existingBooking && existingBooking.is_active === 'Active') {
      console.log('[BOOKING] Idempotent request - returning cached response');
      return res.status(200).json({
        success: true,
        message: 'Booking already exists',
        data: {
          booking_id: existingBooking.booking_id,
          id: existingBooking.id
        }
      });
    }

    // Generate booking ID
    const bookingId = generateBookingId();

    // Calculate new credit value
    const newCreditValue = currentCredits - 1;

    // Atomic create (Supabase transaction)
    const result = await createBookingAtomic({
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
      newCreditValue
    });

    if (result.idempotent) {
      return res.status(200).json({
        success: true,
        message: result.message
      });
    }

    // Increment Redis counter (existing pattern)
    await redis.incr(`exam:${mockExamId}:bookings`);

    // Trigger webhook for HubSpot sync (existing non-blocking pattern)
    // This updates total_bookings in HubSpot

    return res.status(201).json({
      success: true,
      data: {
        booking_id: bookingId,
        booking_record_id: bookingId,  // Use booking_id, not hubspot_id
        id: result.data.booking_id     // UUID
      }
    });

  } catch (error) {
    console.error('[BOOKING] Creation failed:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
```

---

## Data Flow Diagrams

### Booking Creation Flow (Supabase-First)

```
┌────────────────────────────────────────────────────────────────────────────┐
│                    BOOKING CREATION (SUPABASE-FIRST FLOW)                  │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  1. User submits booking                                                   │
│     │                                                                      │
│     ▼                                                                      │
│  2. ┌─────────────────────────────────────────────────────────────┐       │
│     │ VALIDATION (Supabase - ~50ms)                               │       │
│     │ • Get contact by student_id + email (returns id UUID)       │       │
│     │ • Check credit balance from hubspot_contact_credits         │       │
│     │ • Check exam capacity from hubspot_mock_exams               │       │
│     │ • Verify no duplicate booking (idempotency check)           │       │
│     └─────────────────────────────────────────────────────────────┘       │
│     │                                                                      │
│     ▼                                                                      │
│  3. ┌─────────────────────────────────────────────────────────────┐       │
│     │ ACQUIRE LOCKS (Redis - ~5ms)                                │       │
│     │ • User lock: user_booking:{student_id}:{exam_date}          │       │
│     │ • Session lock: exam:{mock_exam_id}                         │       │
│     └─────────────────────────────────────────────────────────────┘       │
│     │                                                                      │
│     ▼                                                                      │
│  4. ┌─────────────────────────────────────────────────────────────┐       │
│     │ ATOMIC WRITE (Supabase RPC - ~30ms)                         │       │
│     │ supabase.rpc('create_booking_atomic', {...})                │       │
│     │                                                             │       │
│     │ Returns: { booking_id (UUID) }                              │       │
│     │ Note: hubspot_id is NULL - populated by batch sync cron     │       │
│     └─────────────────────────────────────────────────────────────┘       │
│     │                                                                      │
│     ▼                                                                      │
│  5. ┌─────────────────────────────────────────────────────────────┐       │
│     │ RELEASE LOCKS & RESPOND (Redis + HTTP - ~10ms)              │       │
│     │ • Release Redis locks                                       │       │
│     │ • Return 201 Created to user                                │       │
│     │ • Response includes booking_id (NOT hubspot_id)             │       │
│     └─────────────────────────────────────────────────────────────┘       │
│                                                                            │
│     ════════════════════════════════════════════════════════════════      │
│      USER RESPONSE COMPLETE (~100ms total)                                │
│      HubSpot sync handled by batch cron (every 2 hours)                   │
│     ════════════════════════════════════════════════════════════════      │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### Contact First-Time Login Flow

```
┌────────────────────────────────────────────────────────────────────────────┐
│                     CONTACT FIRST-TIME LOGIN FLOW                          │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  User logs in with student_id + email                                      │
│     │                                                                      │
│     ▼                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐          │
│  │ SUPABASE LOOKUP (by student_id + email)                     │          │
│  │                                                             │          │
│  │ SELECT * FROM hubspot_contact_credits                       │          │
│  │ WHERE student_id = $1 AND email = $2;                       │          │
│  └─────────────────────────────────────────────────────────────┘          │
│     │                                                                      │
│     ├─── FOUND ─────────────────────────────────────────────────────┐     │
│     │                                                               │     │
│     │    Return cached credits (~50ms)                              │     │
│     │    (id UUID is primary identifier)                            │     │
│     │                                                               │     │
│     └─── NOT FOUND ─────────────────────────────────────────────────┤     │
│                                                                     │     │
│          ┌─────────────────────────────────────────────────────────┐│     │
│          │ HUBSPOT LOOKUP (one-time per contact)                   ││     │
│          │                                                         ││     │
│          │ Search HubSpot by student_id OR email                   ││     │
│          │ Returns: hubspot_id, all credit fields                  ││     │
│          └─────────────────────────────────────────────────────────┘│     │
│               │                                                     │     │
│               ▼                                                     │     │
│          ┌─────────────────────────────────────────────────────────┐│     │
│          │ CREATE SUPABASE RECORD                                  ││     │
│          │                                                         ││     │
│          │ INSERT INTO hubspot_contact_credits (                   ││     │
│          │   id,               -- gen_random_uuid() (existing PK)  ││     │
│          │   hubspot_id,       -- From HubSpot lookup              ││     │
│          │   student_id, email, sj_credits, ...                    ││     │
│          │   hubspot_last_sync_at = NOW()                          ││     │
│          │ )                                                       ││     │
│          └─────────────────────────────────────────────────────────┘│     │
│                                                                     │     │
│     ◄────────────────────────────────────────────────────────────────     │
│     │                                                                      │
│     ▼                                                                      │
│  Return credits to frontend                                               │
│  (Frontend uses id (UUID) for all subsequent operations)                  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Graceful Degradation

```javascript
// If Supabase is unavailable, temporarily fall back to HubSpot
async function getCreditsWithFallback(studentId, email) {
  try {
    return await getContactCredits(studentId, email);
  } catch (error) {
    if (MIGRATION_FLAGS.HUBSPOT_SOURCE_OF_TRUTH) {
      console.warn('[FALLBACK] Supabase unavailable, using HubSpot');
      return await getCreditsFromHubSpot(studentId, email);
    }
    throw error;
  }
}
```

---

## Sprint 2-3 Checklist

### Sprint 2: Read Migration
- [ ] Create `supabase-transactions.js`
- [ ] Update `validate-credits.js` to return id (UUID)
- [ ] Update `user/login.js` to return id (UUID)
- [ ] Remove HubSpot fallback from credit validation
- [ ] Update booking lookup to accept id (UUID) or booking_id
- [ ] Deploy with `SUPABASE_ONLY_READ=true`
- [ ] Monitor for errors

### Sprint 3: Write Migration
- [ ] Update `create.js` to use Supabase atomic transaction
- [ ] Update `[id].js` cancellation to use Supabase atomic transaction
- [ ] Implement idempotency check via Supabase RPC
- [ ] Test booking creation with hubspot_id = NULL
- [ ] Deploy with `SUPABASE_PRIMARY_WRITE=true`
- [ ] Monitor for errors

---

*Previous: [02-rpc-atomic-functions.md](./02-rpc-atomic-functions.md)*
*Next: [04-cron-batch-sync.md](./04-cron-batch-sync.md)*
