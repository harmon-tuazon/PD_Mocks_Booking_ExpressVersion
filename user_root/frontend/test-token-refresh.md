# Token Refresh Test Plan

## Fixes Implemented

### 1. BookingConfirmation Force Refresh
**File:** `user_root/frontend/src/components/BookingConfirmation.jsx`
**Change:** Added `force: true` parameter to `fetchCredits()` call
**Result:** BookingConfirmation now bypasses cache and fetches fresh token data from API

### 2. ExamTypeSelector Event Listener
**File:** `user_root/frontend/src/components/ExamTypeSelector.jsx`
**Changes:**
- Added event listener for `bookingCreated` custom event
- Added localStorage signal check as backup mechanism
- Force refreshes credits when booking is detected

## Test Cases

### Test Case 1: BookingConfirmation Token Display
**Steps:**
1. Note current token count (e.g., 8 CS Tokens, 3 Shared Tokens = 11 total)
2. Book a Clinical Skills exam
3. After booking completes, observe BookingConfirmation page

**Expected Result:**
- Token table should show **decremented values** (e.g., 7 CS Tokens, 3 Shared = 10 total)
- OR if shared token used: 8 CS Tokens, 2 Shared = 10 total
- "Remaining Tokens" count should be accurate

**Before Fix:**
- ❌ Showed old cached values (11 total)

**After Fix:**
- ✅ Should show fresh values (10 total) immediately

### Test Case 2: ExamTypeSelector Refresh After Booking
**Steps:**
1. From BookingConfirmation page, click "Book Another Exam"
2. Returns to ExamTypeSelector page
3. Observe token table in the right sidebar

**Expected Result:**
- Token table should show **updated values** (10 total)
- Should match the values shown in BookingConfirmation

**Before Fix:**
- ❌ Showed old cached values (11 total)

**After Fix:**
- ✅ Should show fresh values (10 total) via event listener

### Test Case 3: Multi-Tab Sync (Advanced)
**Steps:**
1. Open two browser tabs with ExamTypeSelector
2. In Tab 1, book an exam
3. In Tab 2, observe if tokens refresh

**Expected Result:**
- Tab 2 should detect localStorage signal and refresh tokens
- This tests the backup localStorage mechanism

## Technical Details

### Refresh Mechanisms

#### Primary: Custom Event
```javascript
// BookingConfirmation dispatches:
window.dispatchEvent(new CustomEvent('bookingCreated', { detail: refreshSignal }));

// ExamTypeSelector listens:
window.addEventListener('bookingCreated', handleBookingCreated);
```

#### Backup: localStorage Signal
```javascript
// BookingConfirmation sets:
localStorage.setItem('bookingCreated', JSON.stringify(refreshSignal));

// ExamTypeSelector checks on mount:
const refreshSignal = localStorage.getItem('bookingCreated');
```

### Force Refresh Flow

```
1. User completes booking
2. useBookingFlow.submitBooking():
   - invalidateCache() → Clears localStorage & module cache
   - fetchCredits(force: true) → Fetches fresh data
3. Navigate to BookingConfirmation
4. BookingConfirmation.useEffect():
   - fetchCredits(force: true) → Bypasses cache, gets API data
5. User clicks "Book Another Exam"
6. ExamTypeSelector.useEffect():
   - Detects bookingCreated event
   - fetchCredits(force: true) → Refreshes token display
```

## Console Logs to Check

When testing, look for these console logs:

```
🔄 [BookingConfirmation] Fetching fresh credit data for: {...}
📊 BookingConfirmation credit data: {...}
📢 [BookingConfirmation] Dispatched custom bookingCreated event
🔄 [ExamTypeSelector] Processing localStorage refresh signal: {...}
📢 [ExamTypeSelector] Received bookingCreated event: {...}
🔄 [ExamTypeSelector] Refreshing credits after booking...
```

## Redis & Supabase Sync

Backend automatically syncs token deductions to:
- **HubSpot:** Primary source of truth (immediate)
- **Supabase:** Secondary cache (non-blocking sync)
- **Redis:** Booking count cache (immediate)

These syncs happen server-side and don't affect frontend refresh logic.

## Edge Cases Handled

1. ✅ Stale localStorage cache → Cleared by invalidateCache()
2. ✅ Module-level cache → Cleared by invalidateCache()
3. ✅ Network delay → Force refresh ensures API call
4. ✅ Event listener not fired → localStorage backup mechanism
5. ✅ Multi-tab scenarios → localStorage signal works across tabs
