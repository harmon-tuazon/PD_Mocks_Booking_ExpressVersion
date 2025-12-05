# PRD: Business Logic Helper Optimization

**Status**: Draft (Investigation Complete)
**Priority**: Low
**Sprint**: Backlog (Not scheduled)
**Author**: Claude Code
**Created**: 2025-12-04

---

## Executive Summary

This PRD documents optimization opportunities identified in the existing business logic handlers across `user_root/api/bookings`, `user_root/api/mock-discussions`, and `admin_root/api/bookings`. The investigation was conducted using Serena's symbolic analysis tools.

**Recommendation**: Per the project's KISS principle and "if it's not broken, don't fix it" philosophy, **no immediate action is required**. These optimizations should only be implemented when:
1. A bug fix requires touching this code
2. A new feature requires modifying the cancellation flow
3. Performance testing reveals bottlenecks

---

## Investigation Results

### 1. Duplicated Helper Functions

#### `formatBookingDate()` - 6 Copies

| Location | Type | Lines |
|----------|------|-------|
| `user_root/api/bookings/create.js:221-258` | Inline const | 37 lines |
| `user_root/api/mock-discussions/create-booking.js:100-131` | Function | 32 lines |
| `admin_root/api/admin/bookings/create.js:133-159` | Inline const | 27 lines |
| `admin_root/admin_frontend/src/components/admin/BookingRow.jsx:41-49` | Const (different impl) | 9 lines |
| `admin_root/tests/manual/test-admin-booking-creation.js:92-103` | Test helper | 12 lines |

**Implementation Differences**:
- Backend versions: Parse `YYYY-MM-DD` → `"Month Day, Year"` format
- Frontend version: Uses `formatDistanceToNow` from date-fns (relative time)

**Impact**: Low - Simple utility with identical logic in backend files.

#### `generateIdempotencyKey()` - 2 Variants

| Location | Prefix | Hash Length |
|----------|--------|-------------|
| `user_root/api/bookings/create.js:28-40` | `idem_` | 32 chars |
| `user_root/api/mock-discussions/create-booking.js:83-95` | `idem_disc_` | 28 chars |

**Difference**: Intentionally different prefixes to distinguish booking types. The mock discussion version also hardcodes `mock_type: 'Mock Discussion'` in the key data.

**Impact**: None - Different prefixes are by design.

---

### 2. Large Duplicated Functions

#### `cancelSingleBooking()` - 2 Implementations (~300 lines each)

| Location | Lines | Key Differences |
|----------|-------|-----------------|
| `user_root/api/bookings/batch-cancel.js:86-393` | 308 | Includes user authentication (Step 1), ownership verification (Step 3) |
| `admin_root/api/bookings/batch-cancel.js:73-394` | 322 | Admin version - no auth check, `redis` passed as parameter |

**Shared Logic (Candidates for Extraction)**:

```
┌─────────────────────────────────────────────────────────────────┐
│                    DUPLICATED CODE BLOCKS                        │
├─────────────────────────────────────────────────────────────────┤
│ 1. Credit Restoration Logic (~50 lines)                         │
│    - tokenToMockTypeMapping object                              │
│    - Calculate new credit values                                │
│    - updateContactCreditsInSupabase() call                      │
├─────────────────────────────────────────────────────────────────┤
│ 2. Redis Cache Clearing (~40 lines)                             │
│    - Delete booking cache key                                   │
│    - Decrement exam counter with safety check                   │
│    - Trigger HubSpot webhook                                    │
├─────────────────────────────────────────────────────────────────┤
│ 3. Soft Delete + Status Update (~20 lines)                      │
│    - hubspot.softDeleteBooking()                                │
│    - updateBookingStatusInSupabase()                            │
│    - updateExamBookingCountInSupabase()                         │
└─────────────────────────────────────────────────────────────────┘
```

**Impact**: Medium - Maintenance overhead when updating cancellation logic.

---

### 3. Repeated Inline Patterns

#### Token-to-MockType Mapping Object

```javascript
const tokenToMockTypeMapping = {
  'Situational Judgment Token': 'Situational Judgment',
  'Clinical Skills Token': 'Clinical Skills',
  'Mini-mock Token': 'Mini-mock',
  'Mock Discussion Token': 'Mock Discussion',
  'Shared Token': mockExamDetails?.mock_type || bookingProperties.mock_type || 'Situational Judgment'
};
```

**Locations**:
- `user_root/api/bookings/batch-cancel.js` (lines 296-302)
- `admin_root/api/bookings/batch-cancel.js` (lines 218-224)

**Impact**: Low - Static mapping, rarely changes.

#### Redis Counter Logic with TTL

```javascript
const TTL_30_DAYS = 30 * 24 * 60 * 60; // 2,592,000 seconds
await redis.setex(`exam:${mock_exam_id}:bookings`, TTL_30_DAYS, totalBookings);
```

**Locations**:
- `user_root/api/bookings/create.js` (lines 382-384, 653-654)
- `user_root/api/mock-discussions/create-booking.js` (lines 351-354)
- `user_root/api/bookings/batch-cancel.js` (lines 221-223)
- `admin_root/api/bookings/batch-cancel.js` (lines 280-282)

**Impact**: Low - Could be encapsulated in `RedisLockService`.

---

## Proposed Refactoring (If/When Needed)

### Option A: Extract Shared Helpers to `_shared/booking-helpers.js`

```javascript
// user_root/api/_shared/booking-helpers.js

/**
 * Format date to "Month Day, Year" format
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @returns {string} Formatted date string
 */
function formatBookingDate(dateString) {
  // ... implementation
}

/**
 * Map token type to mock type for Supabase sync
 */
const TOKEN_TO_MOCK_TYPE = {
  'Situational Judgment Token': 'Situational Judgment',
  'Clinical Skills Token': 'Clinical Skills',
  'Mini-mock Token': 'Mini-mock',
  'Mock Discussion Token': 'Mock Discussion'
};

/**
 * Restore credits for cancelled booking
 */
async function restoreCreditsForCancellation(hubspot, contactId, tokenUsed, currentCredits, mockType) {
  // ... extracted from cancelSingleBooking
}

/**
 * Clear Redis cache after booking cancellation
 */
async function clearRedisCacheOnCancellation(redis, contactId, examDate, mockExamId) {
  // ... extracted from cancelSingleBooking
}

module.exports = {
  formatBookingDate,
  TOKEN_TO_MOCK_TYPE,
  restoreCreditsForCancellation,
  clearRedisCacheOnCancellation
};
```

### Option B: Enhance RedisLockService

```javascript
// Add to user_root/api/_shared/redis.js

class RedisLockService {
  // ... existing methods

  /**
   * Increment exam booking counter with TTL
   * @param {string} mockExamId - HubSpot mock exam ID
   * @param {number} ttlDays - TTL in days (default: 30)
   */
  async incrExamCounter(mockExamId, ttlDays = 30) {
    const key = `exam:${mockExamId}:bookings`;
    const newValue = await this.incr(key);
    await this.expire(key, ttlDays * 24 * 60 * 60);
    return newValue;
  }

  /**
   * Decrement exam booking counter (floor at 0)
   * @param {string} mockExamId - HubSpot mock exam ID
   */
  async decrExamCounter(mockExamId) {
    const key = `exam:${mockExamId}:bookings`;
    const current = parseInt(await this.get(key)) || 0;

    if (current <= 0) {
      console.warn(`[REDIS] Counter already at ${current}, resetting to 0`);
      await this.setex(key, 30 * 24 * 60 * 60, 0);
      return 0;
    }

    return await this.decr(key);
  }
}
```

---

## Decision Matrix

| Category | Current State | Effort to Fix | Risk of Change | Recommendation |
|----------|---------------|---------------|----------------|----------------|
| `formatBookingDate` | 6 copies | Low (1 hour) | Low | **No change** - acceptable duplication |
| `generateIdempotencyKey` | 2 variants | N/A | N/A | **No change** - intentional difference |
| `cancelSingleBooking` | 2 large functions | Medium (4-6 hours) | Medium | **Refactor when touched** |
| Token mappings | Duplicated literals | Low (30 min) | Low | **No change** - static data |
| Redis counter logic | Repeated inline | Low (1 hour) | Low | **Optional enhancement** |

---

## When to Implement

### Trigger Conditions

1. **Bug in cancellation flow** - If fixing a bug requires modifying `cancelSingleBooking`, extract shared logic first
2. **New cancellation feature** - If adding partial refund or other cancel-related feature, refactor first
3. **Performance issues** - If Redis operations become a bottleneck, enhance `RedisLockService`
4. **New booking type** - If adding a third booking type (beyond mock exam and discussion), extract shared helpers

### Do NOT Implement If

- Just doing routine maintenance
- No active development in these files
- Supabase SOT migration is in progress (wait until complete)

---

## Relationship to Supabase SOT Migration

The Supabase SOT migration (PRDs 01-04) will:
1. Add new RPC functions to `supabase-data.js` ✓
2. Keep existing inline helpers unchanged ✓
3. Not touch `cancelSingleBooking` implementations

**After migration completes**, the cancellation flow will use:
- `cancelBookingAtomic()` RPC for atomic operations
- Existing inline logic for Redis cache management
- Existing inline logic for webhook triggers

The optimization opportunities identified here remain valid post-migration.

---

## Acceptance Criteria (If Implemented)

- [ ] All tests pass after refactoring
- [ ] No change in API response format
- [ ] No change in booking/cancellation behavior
- [ ] Code coverage maintained or improved
- [ ] Both user and admin cancellation flows work identically

---

## Files Affected (Potential)

| File | Current Lines | After Refactor |
|------|---------------|----------------|
| `user_root/api/_shared/booking-helpers.js` | (new) | ~100 lines |
| `user_root/api/bookings/batch-cancel.js` | 520 | ~350 lines |
| `admin_root/api/bookings/batch-cancel.js` | 530 | ~280 lines |
| `user_root/api/_shared/redis.js` | ~200 | ~250 lines |

---

## References

- Investigation conducted: 2025-12-04
- Tools used: Serena MCP (`find_symbol`, `search_for_pattern`)
- Related PRDs:
  - [03-backend-api-migration.md](../supabase/supabase_SOT_migrations/03-backend-api-migration.md)
  - [03.5-admin-api-migration.md](../supabase/supabase_SOT_migrations/03.5-admin-api-migration.md)

---

*This PRD documents technical debt for future reference. No immediate action required.*
