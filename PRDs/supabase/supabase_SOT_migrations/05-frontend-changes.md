# Frontend Changes

## Overview

| Field | Value |
|-------|-------|
| **Phase** | Sprint 2 (Day 3-4) |
| **Prerequisites** | Backend API migration (read endpoints) |
| **Related Docs** | [03-backend-api-migration.md](./03-backend-api-migration.md) |

---

## Summary

**Minimal frontend changes required!**

The frontend primarily uses `booking_id` (e.g., `BK-20251203-ABC123`) for display and operations, not `hubspot_id`. The main change is ensuring the frontend handles the new response format where `hubspot_id` may not be present.

---

## ID Reference Changes

| What Changed | Old Value | New Value |
|--------------|-----------|-----------|
| Contact identifier | `hubspot_id` (e.g., "123456789") | `id` (UUID) |
| Booking identifier | `hubspot_id` (e.g., "987654321") | `booking_id` (e.g., "BK-20251203-ABC123") or `id` (UUID) |
| Returned in API | `contact_id: hubspot_id` | `contact_id: uuid` |
| Display to user | `booking_id` (unchanged) | `booking_id` (unchanged) |

---

## API Response Changes

### Credit Validation Response

```javascript
// OLD Response
{
  success: true,
  data: {
    contact_id: "123456789",  // <- hubspot_id
    sj_credits: 5,
    cs_credits: 3,
    ...
  }
}

// NEW Response
{
  success: true,
  data: {
    contact_id: "550e8400-e29b-41d4-a716-446655440000",  // <- UUID
    sj_credits: 5,
    cs_credits: 3,
    // hubspot_id NOT included
    ...
  }
}
```

### Booking Creation Response

```javascript
// OLD Response
{
  success: true,
  data: {
    booking_id: "BK-20251203-ABC123",
    booking_record_id: "123456789",  // <- hubspot_id
    ...
  }
}

// NEW Response
{
  success: true,
  data: {
    booking_id: "BK-20251203-ABC123",
    booking_record_id: "BK-20251203-ABC123",  // <- booking_id (same as above)
    id: "550e8400-e29b-41d4-a716-446655440000",  // <- UUID (optional)
    // hubspot_id NOT included (may not exist yet)
    ...
  }
}
```

---

## Files to Check

### User Frontend - Credit Display

**Files that display credit information:**

```
user_root/user_frontend/src/
├── components/
│   ├── CreditBalance.jsx        # Displays credit counts
│   └── BookingConfirmation.jsx  # Shows booking details
├── pages/
│   ├── Dashboard.jsx            # User dashboard
│   └── BookingHistory.jsx       # Past bookings
└── hooks/
    └── useCredits.js            # Credit fetching hook
```

**What to verify:**
- These files should use credit VALUES (sj_credits, cs_credits, etc.)
- They should NOT depend on `hubspot_id`
- If they store `contact_id`, ensure they work with UUID format

### User Frontend - Booking Display

**Files that display booking information:**

```
user_root/user_frontend/src/
├── components/
│   └── BookingCard.jsx          # Individual booking display
├── pages/
│   └── BookingDetails.jsx       # Booking detail page
└── hooks/
    └── useBookings.js           # Booking fetching hook
```

**What to verify:**
- Display should use `booking_id` (BK-...) for user-facing text
- Internal references can use `id` (UUID) or `booking_id`
- Should NOT depend on `hubspot_id`

---

## Code Changes (If Needed)

### If Frontend Stores Contact ID

```javascript
// OLD: Storing hubspot_id
const handleLogin = async (credentials) => {
  const response = await api.login(credentials);
  setContactId(response.data.contact_id);  // Was hubspot_id
};

// NEW: Works with UUID (no code change needed if just storing)
const handleLogin = async (credentials) => {
  const response = await api.login(credentials);
  setContactId(response.data.contact_id);  // Now UUID - still works!
};
```

### If Frontend Displays Contact ID (Unlikely)

```javascript
// If you were showing hubspot_id somewhere (unlikely)
// OLD
<span>Contact: {contactId}</span>  // "123456789"

// NEW - probably hide this since UUID is not user-friendly
// Or just let it show UUID if needed for debugging
<span>Contact: {contactId}</span>  // "550e8400-e29b-41d4-a716-446655440000"
```

### If Frontend Passes ID to API

```javascript
// OLD: Using hubspot_id for API calls
const cancelBooking = async (hubspotId) => {
  await api.delete(`/bookings/${hubspotId}`);
};

// NEW: Use booking_id instead
const cancelBooking = async (bookingId) => {
  await api.delete(`/bookings/${bookingId}`);  // "BK-20251203-ABC123"
};
```

---

## Validation Checklist

### Credit Display
- [ ] CreditBalance component displays credit VALUES correctly
- [ ] Dashboard shows correct credit counts
- [ ] No dependency on hubspot_id for display

### Booking Display
- [ ] BookingCard shows `booking_id` (BK-...) correctly
- [ ] Booking history uses `booking_id` for display
- [ ] Booking details page works with new response format

### API Calls
- [ ] Login/auth works with UUID contact_id
- [ ] Booking creation works with new response
- [ ] Booking cancellation uses booking_id (not hubspot_id)
- [ ] Credit validation works with UUID response

### Error Handling
- [ ] Handle case where hubspot_id is not present
- [ ] Graceful fallback if expected fields are missing

---

## Testing Scenarios

### Scenario 1: New User Login
```
1. User logs in for first time
2. API returns contact with id (UUID), may have hubspot_id = null
3. Frontend should:
   - Display credit values correctly
   - Store contact_id (UUID) for future requests
   - NOT fail if hubspot_id is missing
```

### Scenario 2: Create Booking
```
1. User creates a booking
2. API returns:
   - booking_id: "BK-20251203-ABC123"
   - id: "uuid-..."
   - NO hubspot_id (not synced yet)
3. Frontend should:
   - Show confirmation with booking_id
   - Store booking reference for future operations
   - NOT fail if hubspot_id is missing
```

### Scenario 3: View Booking History
```
1. User views their bookings
2. Some bookings may have hubspot_id, some may not
3. Frontend should:
   - Display all bookings correctly
   - Use booking_id for display
   - Handle mixed hubspot_id states
```

---

## Admin Frontend (If Applicable)

The admin frontend may have more exposure to IDs. Check:

```
admin_root/admin_frontend/src/
├── components/
│   ├── BookingTable.jsx         # Booking list
│   └── ExamSessionCard.jsx      # Exam display
└── pages/
    ├── BookingManagement.jsx    # Booking admin
    └── ExamManagement.jsx       # Exam admin
```

**What to verify:**
- Admin views may show hubspot_id for debugging
- Ensure they handle NULL hubspot_id gracefully
- Links to HubSpot may not work until sync completes

---

## Sprint 2 Checklist (Frontend)

- [ ] Review CreditBalance component
- [ ] Review BookingCard component
- [ ] Review booking history page
- [ ] Test login with new response format
- [ ] Test booking creation with new response
- [ ] Test booking cancellation
- [ ] Verify no hubspot_id dependencies in critical paths
- [ ] Add fallback handling for missing hubspot_id
- [ ] Test with new user (no hubspot_id initially)

---

## Low Risk Assessment

**Why frontend changes are minimal:**

1. **User never sees hubspot_id** - It's an internal reference
2. **booking_id is the display ID** - This stays the same
3. **Credit values unchanged** - sj_credits, cs_credits, etc.
4. **UUID vs string** - JavaScript handles both the same way
5. **API contract preserved** - Same field names, just different values

---

*Previous: [04-cron-batch-sync.md](./04-cron-batch-sync.md)*
*Next: [06-testing-rollback.md](./06-testing-rollback.md)*
