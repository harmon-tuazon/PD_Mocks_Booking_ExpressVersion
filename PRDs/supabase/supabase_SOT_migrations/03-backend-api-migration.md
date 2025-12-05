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
| Lookup method | student_id + email → Supabase → HubSpot fallback | **NO CHANGE** - Keep current architecture |
| Return ID | hubspot_id | **NO CHANGE** - Keep returning hubspot_id |
| HubSpot fallback | Yes | **YES** - Maintain fallback for reliability |

**DECISION: MAINTAIN CURRENT ARCHITECTURE**

The current validate-credits flow works well:
1. Try Supabase first (fast, ~50ms)
2. Fallback to HubSpot if not found (slower, ~500ms)
3. Auto-populate Supabase on cache miss

No changes needed for Sprint 1-3.

### User Root - Booking Cancellation

**File: `user_root/api/bookings/[id].js`**

| Change | Current | New |
|--------|---------|-----|
| Booking lookup | By hubspot_id only | **Cascading lookup**: hubspot_id → id (UUID) → booking_id |
| Credit restore | HubSpot blocking | Supabase blocking |
| HubSpot sync | Blocking | Background |

**DECISION: CASCADING BOOKING LOOKUP**

The `[id].js` endpoint should support multiple ID types for backwards compatibility:

```
Priority 1: hubspot_id (if populated) - for existing bookings
Priority 2: id (UUID) - for new Supabase-first bookings
Priority 3: booking_id (BK-...) - human-readable fallback
```

---

## Files to Modify

### Extend Existing `_shared/supabase-data.js` (Supabase RPC Wrappers Only)

Rather than creating new files, extend the existing `supabase-data.js` in each root with **Supabase RPC wrapper functions only**:

| File Path | New Functions to Add |
|-----------|---------------------|
| `user_root/api/_shared/supabase-data.js` | `createBookingAtomic()`, `cancelBookingAtomic()`, `checkIdempotencyKey()`, `getBookingCascading()`, `getContactCredits()` |
| `admin_root/api/_shared/supabase-data.js` | `getBookingCascading()` (for refund service) |

**Important**: Business logic helpers remain inline in their respective endpoint files.

**Current Helper Function Locations** (NO CHANGES - keep as-is):

| Helper Function | Location | Notes |
|-----------------|----------|-------|
| `generateIdempotencyKey(data)` | `bookings/create.js` | Returns `idem_{hash}` |
| `generateIdempotencyKey(data)` | `mock-discussions/create-booking.js` | Returns `idem_disc_{hash}` (different prefix) |
| `getCreditFieldToDeduct(mockType, creditBreakdown)` | `bookings/create.js` | Determines which credit field to use |
| `mapCreditFieldToTokenUsed(creditField)` | `bookings/create.js` | Maps credit field to token name |
| `formatBookingDate(dateString)` | `bookings/create.js` | Formats date as "Month Day, Year" |
| `formatBookingDate(dateString)` | `mock-discussions/create-booking.js` | Same function (duplicated) |
| `handleDeleteRequest(req, res)` | `bookings/[id].js` | Cancellation handler |
| `handleGetRequest(req, res)` | `bookings/[id].js` | Get booking handler |
| `cancelSingleBooking(bookingId, hubspot, redis)` | `bookings/batch-cancel.js` | Single booking cancel helper |

**Note on Duplication**: `formatBookingDate()` is duplicated between `create.js` and `create-booking.js`. This is acceptable for now since both files have slightly different overall logic. Future optimization could extract to `_shared/utils.js` if desired, but NOT as part of this migration.

The `supabase-data.js` file is only for **Supabase client operations** (queries, RPC calls, syncs), not business logic.

### New Cron File

| File Path | Purpose |
|-----------|---------|
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

## Migration Approach

**No feature flags.** We use a simple phased deployment approach:

| Phase | Action | Rollback |
|-------|--------|----------|
| Sprint 2 | Migrate read endpoints → Deploy → Verify | `git revert` + redeploy (~2 min) |
| Sprint 3 | Migrate write endpoints → Deploy → Verify | `git revert` + redeploy (~2 min) |
| Sprint 4 | Remove HubSpot fallbacks → Deploy → Verify | `git revert` + redeploy (~2 min) |

**Why no feature flags?**
- Small team, small user base - granular toggles add unnecessary complexity
- Vercel deploys are fast (~2 minutes) - rollback is trivial
- YAGNI - we aren't gonna need runtime toggle control

---

## Extend Existing supabase-data.js

**Add to: `user_root/api/_shared/supabase-data.js`**

Add the following functions to the existing file (which already has `supabaseAdmin` initialized):

```javascript
// ============== SUPABASE-FIRST ATOMIC OPERATIONS ==============

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

/**
 * Get booking with cascading lookup
 * Priority: hubspot_id → id (UUID) → booking_id
 *
 * @param {string} identifier - The booking identifier (could be any of the 3 types)
 * @returns {Promise<Object|null>} Booking record or null
 */
async function getBookingCascading(identifier) {
  if (!identifier) return null;

  console.log('[SUPABASE] Cascading booking lookup:', { identifier });

  // Determine identifier type and build query
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
  const isBookingId = /^BK-/.test(identifier);
  const isHubSpotId = /^\d+$/.test(identifier);  // HubSpot IDs are numeric strings

  let booking = null;

  // Priority 1: Try as hubspot_id (if it looks like a HubSpot ID)
  if (isHubSpotId) {
    const { data, error } = await supabase
      .from('hubspot_bookings')
      .select('*')
      .eq('hubspot_id', identifier)
      .single();

    if (!error && data) {
      console.log('[SUPABASE] Found by hubspot_id:', identifier);
      return data;
    }
  }

  // Priority 2: Try as id (UUID)
  if (isUUID) {
    const { data, error } = await supabase
      .from('hubspot_bookings')
      .select('*')
      .eq('id', identifier)
      .single();

    if (!error && data) {
      console.log('[SUPABASE] Found by id (UUID):', identifier);
      return data;
    }
  }

  // Priority 3: Try as booking_id (BK-...)
  if (isBookingId || !booking) {
    const { data, error } = await supabase
      .from('hubspot_bookings')
      .select('*')
      .eq('booking_id', identifier)
      .single();

    if (!error && data) {
      console.log('[SUPABASE] Found by booking_id:', identifier);
      return data;
    }
  }

  // Not found in any lookup
  console.warn('[SUPABASE] Booking not found with identifier:', identifier);
  return null;
}

// Add to existing module.exports:
//   createBookingAtomic,
//   cancelBookingAtomic,
//   checkIdempotencyKey,
//   getContactCredits,
//   getBookingCascading
```

---

## Updated Credit Validation

**File: `user_root/api/mock-exams/validate-credits.js`**

**NO CHANGES REQUIRED** - Keep current implementation.

The existing flow already works optimally:
1. Supabase lookup first (fast path)
2. HubSpot fallback if not found
3. Auto-populate Supabase on cache miss
4. Returns `hubspot_id` (keep as-is for compatibility)

---

## Updated Booking Creation

**File: `user_root/api/bookings/create.js`** (key changes)

**Note**: The existing helper functions (`generateIdempotencyKey`, `getCreditFieldToDeduct`, `mapCreditFieldToTokenUsed`, `formatBookingDate`) remain in the file - they're already defined there. Only the Supabase RPC calls are imported from `supabase-data.js`.

```javascript
// ADD this import (Supabase RPC wrappers)
const { createBookingAtomic, checkIdempotencyKey } = require('../_shared/supabase-data');

// KEEP existing imports
const { syncBookingToSupabase, updateExamBookingCountInSupabase, ... } = require('../_shared/supabase-data');

// KEEP existing inline helper functions (already in file)
// - generateIdempotencyKey(data)
// - getCreditFieldToDeduct(mockType, creditBreakdown)
// - mapCreditFieldToTokenUsed(creditField)
// - formatBookingDate(dateString)

module.exports = async (req, res) => {
  try {
    const { studentId, studentEmail, mockExamId, ... } = req.body;

    // Generate idempotency key (USES EXISTING HELPER - no change)
    const idempotencyKey = generateIdempotencyKey(validatedData);

    // CHANGE: Check for duplicate via Supabase RPC (~5ms vs HubSpot ~200ms)
    // REPLACES: const existingBooking = await hubspot.findBookingByIdempotencyKey(idempotencyKey);
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

    // Generate booking ID (USES EXISTING PATTERN - no change)
    const formattedDate = formatBookingDate(exam_date);
    const bookingId = `${mock_type}-${student_id}-${formattedDate}`;

    // Calculate credit field (USES EXISTING HELPER - no change)
    const creditField = getCreditFieldToDeduct(mock_type, creditBreakdown);
    const tokenUsed = mapCreditFieldToTokenUsed(creditField);
    const newCreditValue = currentCredits - 1;

    // CHANGE: Atomic create via Supabase RPC
    // REPLACES: const createdBooking = await hubspot.createBooking(bookingData);
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

    // Increment Redis counter (EXISTING PATTERN - no change)
    await redis.incr(`exam:${mockExamId}:bookings`);

    // Trigger webhook for HubSpot sync (EXISTING PATTERN - no change)
    // This updates total_bookings in HubSpot

    // CHANGE: Return UUID instead of hubspot_id
    return res.status(201).json({
      success: true,
      data: {
        booking_id: bookingId,
        booking_record_id: bookingId,  // Use booking_id, not hubspot_id
        id: result.data.booking_id     // UUID from Supabase
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

## Updated Booking Cancellation

**File: `user_root/api/bookings/[id].js`** (key changes)

Uses cascading lookup: `hubspot_id` → `id` (UUID) → `booking_id`

```javascript
const { cancelBookingAtomic, getBookingCascading, getContactCredits } = require('../_shared/supabase-data');

module.exports = async (req, res) => {
  try {
    const { id } = req.query;  // Could be hubspot_id, UUID, or booking_id

    // Cascading lookup: hubspot_id → id (UUID) → booking_id
    const booking = await getBookingCascading(id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    // Check if already cancelled
    if (booking.is_active === 'Cancelled') {
      return res.status(200).json({
        success: true,
        message: 'Booking already cancelled',
        idempotent: true
      });
    }

    // Get credit field and calculate restored value
    const creditField = getCreditFieldForMockType(booking.mock_type);
    const contact = await getContactCredits(booking.student_id, booking.student_email);
    const restoredValue = (contact[creditField] || 0) + 1;

    // Atomic cancel (Supabase transaction) - uses UUID
    const result = await cancelBookingAtomic({
      bookingId: booking.id,  // Always use UUID for RPC
      creditField,
      restoredCreditValue: restoredValue
    });

    // Decrement Redis counter (existing pattern)
    await redis.decr(`exam:${booking.associated_mock_exam}:bookings`);

    // Trigger webhook for HubSpot sync (existing non-blocking pattern)

    return res.status(200).json({
      success: true,
      data: {
        booking_id: booking.booking_id,
        id: booking.id,
        hubspot_id: booking.hubspot_id  // May be null for new bookings
      }
    });

  } catch (error) {
    console.error('[BOOKING] Cancellation failed:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
```

### Cascading Lookup Logic

| Input Format | Detection | Lookup Column |
|--------------|-----------|---------------|
| `123456789` | `/^\d+$/` | `hubspot_id` |
| `a1b2c3d4-...` | UUID regex | `id` |
| `BK-20251203-ABC` | `/^BK-/` | `booking_id` |

**Why this order?**
1. **hubspot_id first**: Existing bookings (created before migration) have hubspot_id populated
2. **id (UUID) second**: New Supabase-first bookings may not have hubspot_id yet
3. **booking_id last**: Human-readable fallback, always populated

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
// If Supabase is unavailable, fall back to HubSpot
// This is a simple try-catch pattern, no feature flags needed
async function getCreditsWithFallback(studentId, email) {
  try {
    const credits = await getContactCredits(studentId, email);
    if (credits) return credits;

    // Not found in Supabase - try HubSpot and auto-populate
    console.log('[FALLBACK] Contact not in Supabase, checking HubSpot');
    return await getCreditsFromHubSpotAndSync(studentId, email);
  } catch (error) {
    console.error('[ERROR] Supabase query failed:', error.message);
    // Last resort: try HubSpot directly
    return await getCreditsFromHubSpot(studentId, email);
  }
}
```

**Rollback procedure**: If migration causes issues, `git revert` the commits and redeploy. No runtime flags needed.

---

## Mock Discussions Support

### Overview

Mock discussions are a separate booking type that uses the same underlying `hubspot_bookings` table but with different:
- Credit field: `mock_discussion_token`
- Booking ID format: `"Mock Discussion-{StudentID}-{FormattedDate}"`
- Idempotency key prefix: `idem_disc_{hash}`

### Files to Modify

| File | Current State | Required Changes |
|------|---------------|------------------|
| `user_root/api/mock-discussions/create-booking.js` | HubSpot-first | Supabase-first via `create_booking_atomic` RPC |
| `user_root/api/mock-discussions/validate-credits.js` | Supabase + HubSpot fallback | **NO CHANGE** - Keep current architecture |
| `user_root/api/mock-discussions/available.js` | Supabase-first | **NO CHANGE** - Already optimized |

### RPC Compatibility

The existing `create_booking_atomic` RPC already supports mock discussions:

```javascript
// Mock exam booking
await createBookingAtomic({
  bookingId: 'BK-20251203-ABC123',
  creditField: 'sj_credits',  // or 'cs_credits', 'sjmini_credits', 'shared_mock_credits'
  ...
});

// Mock DISCUSSION booking - same RPC, different credit field
await createBookingAtomic({
  bookingId: 'Mock Discussion-STU001-2025-12-03',  // Different format
  creditField: 'mock_discussion_token',  // Discussion-specific token
  ...
});
```

### Booking ID Format Differences

| Type | Format | Example |
|------|--------|---------|
| Mock Exam | `{mock_type}-{student_id}-{formatted exam_date}` | `Clinical Skills-1599999-October 23, 2026` |
| Mock Discussion | `Mock Discussion-{StudentID}-{FormattedDate}` | `Mock Discussion-159999-October 23, 2026` |

### Idempotency Key Differences

| Type | Format | Example |
|------|--------|---------|
| Mock Exam | `idem_{hash}` | `idem_a1b2c3d4e5f6` |
| Mock Discussion | `idem_disc_{hash}` | `idem_disc_a1b2c3d4e5f6` |

Both formats are supported by the existing `check_idempotency_key` RPC and cascading lookup functions.

### Updated Mock Discussion Creation

**File: `user_root/api/mock-discussions/create-booking.js`** (key changes)

**Note**: Similar to `create.js`, the existing helper functions (`generateIdempotencyKey`, `formatBookingDate`) remain inline in this file. Only the Supabase RPC calls are imported.

```javascript
// ADD this import (Supabase RPC wrappers)
const { createBookingAtomic, checkIdempotencyKey } = require('../../_shared/supabase-data');

// KEEP existing imports
const { syncBookingToSupabase, updateExamBookingCountInSupabase } = require('../_shared/supabase-data');

// KEEP existing inline helper functions (already in file)
// - generateIdempotencyKey(data) - returns idem_disc_{hash}
// - formatBookingDate(dateString)

module.exports = async (req, res) => {
  try {
    const { studentId, studentEmail, sessionId, attendingLocation, ... } = req.body;

    // Generate mock discussion idempotency key (USES EXISTING HELPER - no change)
    const idempotencyKey = generateIdempotencyKey(validatedData);  // Returns: idem_disc_{hash}

    // CHANGE: Check for duplicate via Supabase RPC
    // REPLACES: const existingBooking = await hubspot.findBookingByIdempotencyKey(idempotencyKey);
    const existingBooking = await checkIdempotencyKey(idempotencyKey);
    if (existingBooking && existingBooking.is_active === 'Active') {
      return res.status(200).json({
        success: true,
        message: 'Booking already exists',
        data: {
          booking_id: existingBooking.booking_id,
          id: existingBooking.id
        }
      });
    }

    // Generate mock discussion booking ID (USES EXISTING PATTERN - no change)
    const formattedDate = formatBookingDate(exam_date);
    const bookingId = `Mock Discussion-${studentId}-${formattedDate}`;

    // CHANGE: Atomic create via Supabase RPC
    // REPLACES: const createdBooking = await hubspot.createBooking(bookingData);
    const result = await createBookingAtomic({
      bookingId,
      studentId,
      studentEmail,
      mockExamId: sessionId,
      studentName,
      tokenUsed: 'mock_discussion_token',
      attendingLocation,
      dominantHand: null,
      idempotencyKey,
      creditField: 'mock_discussion_token',
      newCreditValue: currentCredits - 1
    });

    // CHANGE: Return UUID instead of hubspot_id
    return res.status(201).json({
      success: true,
      data: {
        booking_id: bookingId,
        booking_record_id: bookingId,  // Use booking_id, not hubspot_id
        id: result.data.booking_id     // UUID from Supabase
      }
    });

  } catch (error) {
    console.error('[DISCUSSION] Creation failed:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
```

### Validate Credits - NO CHANGE

**File: `user_root/api/mock-discussions/validate-credits.js`**

The current implementation already works optimally:
1. Uses Supabase lookup by `student_id` + `email`
2. Checks `mock_discussion_token` credit field
3. Falls back to HubSpot if not found
4. Auto-populates Supabase on cache miss

No changes needed - same architecture as mock exam validation.

### Refund Service Compatibility

**File: `admin_root/api/_shared/refund.js`**

The refund service already supports mock discussions via the `tokenType` parameter:

```javascript
// Current implementation already handles:
async function refundToken(bookingId, adminEmail, tokenType) {
  // tokenType can be:
  // - 'sj_credits', 'cs_credits', 'sjmini_credits', 'shared_mock_credits' (mock exams)
  // - 'mock_discussion_token' (discussions)

  // ... existing logic works for all token types
}
```

**No changes needed** - the cascading lookup and credit restore logic applies to all token types.

---

## Sprint 2-3 Checklist

### Sprint 2: Read Migration
- [ ] Extend existing `_shared/supabase-data.js` with new helper functions
- [ ] Add `getBookingCascading()` function to existing `supabase-data.js`
- [ ] **NO CHANGE**: Keep `validate-credits.js` as-is (Supabase + HubSpot fallback)
- [ ] Update `[id].js` to use cascading booking lookup (hubspot_id → id → booking_id)
- [ ] Test cascading lookup with all three ID types
- [ ] Deploy and monitor for errors

### Sprint 3: Write Migration
- [ ] Update `create.js` to use Supabase atomic transaction
- [ ] Update `[id].js` cancellation to use Supabase atomic transaction
- [ ] Update `mock-discussions/create-booking.js` to use Supabase atomic transaction
- [ ] Implement idempotency check via Supabase RPC
- [ ] Test booking creation with hubspot_id = NULL
- [ ] Test mock discussion creation with hubspot_id = NULL
- [ ] Test cancellation with hubspot_id, UUID, and booking_id inputs
- [ ] Deploy and verify
- [ ] Monitor for errors (rollback via `git revert` if needed)

---

*Previous: [02-rpc-atomic-functions.md](./02-rpc-atomic-functions.md)*
*Next: [04-cron-batch-sync.md](./04-cron-batch-sync.md)*
