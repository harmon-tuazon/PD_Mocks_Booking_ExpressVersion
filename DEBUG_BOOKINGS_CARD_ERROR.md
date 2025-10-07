# Debug Report: "Unable to load bookings" Error in My Upcoming Mocks Card

## Problem Summary
The "My Upcoming Mocks" card was showing "Unable to load bookings" error that persisted even after cache refresh for user Test Harmon (ID: 1599999, email: htuazon@prepdoctors.com).

## Root Cause Analysis

### The Issue
The API endpoint `/api/bookings/list` was returning a **400 Bad Request** error with the generic message:
```json
{
  "success": false,
  "error": "An error occurred",
  "code": "ERROR"
}
```

### Root Cause
The validation schema in `api/_shared/validation.js` was **missing the `force` parameter** in the `bookingsList` schema. When the frontend passed `force: true` to bust the cache, the validation failed because `force` was not defined as an allowed parameter.

### The Fix
Added the `force` parameter to the `bookingsList` Joi validation schema:

```javascript
// api/_shared/validation.js line 188-193
force: Joi.boolean()
  .optional()
  .default(false)
  .messages({
    'boolean.base': 'Force parameter must be a boolean value'
  })
```

## Investigation Process

### Step 1: Enhanced Logging
Added comprehensive debug logging to trace the error through the entire flow:
- **Frontend** (`ExistingBookingsCard.jsx`): Log API calls, responses, and error details
- **Backend** (`api/bookings/list.js`): Log request parameters, contact authentication, and booking retrieval
- **HubSpot Service** (`api/_shared/hubspot.js`): Log association API calls and responses

### Step 2: Reproduced the Error
Created a test script (`test-bookings-api.js`) that simulated the exact API call the frontend makes:
```javascript
const params = {
  student_id: '1599999',
  email: 'htuazon@prepdoctors.com',
  filter: 'upcoming',
  limit: 10,
  force: true  // <-- This parameter caused validation to fail
};
```

### Step 3: Identified the Validation Error
The API returned 400 status with generic error because:
1. Frontend sent `force: true` parameter
2. Joi validation schema didn't include `force` field
3. Validation failed with unknown field error
4. Error was caught and returned as generic "An error occurred"

### Step 4: Deployed the Fix
- Added `force` parameter to validation schema
- Deployed to production
- Verified API now returns 200 with booking data

## Test Results

### Before Fix
```bash
📥 Response Status: 400
📥 Response Data:
{
  "success": false,
  "error": "An error occurred",
  "code": "ERROR"
}
```

### After Fix
```bash
📥 Response Status: 200
✅ API call successful
📊 Bookings count: 2
📊 Total bookings: 2

📋 Bookings:
  1. Situational Judgment-Test Harmon - 2025-10-31
  2. Clinical Skills-Test Harmon - 2025-12-04
```

## Files Modified

### 1. `api/_shared/validation.js`
**Change**: Added `force` parameter to `bookingsList` schema
**Lines**: 188-193
**Purpose**: Allow frontend to pass cache-busting `force` parameter

### 2. `frontend/src/components/shared/ExistingBookingsCard.jsx`
**Change**: Enhanced error logging in `fetchBookings` function
**Lines**: 49-118
**Purpose**: Better visibility into API errors for debugging

### 3. `api/bookings/list.js`
**Change**: Enhanced logging for request parameters and contact authentication
**Lines**: 77-115
**Purpose**: Track request flow and identify failure points

### 4. `api/_shared/hubspot.js`
**Change**: Enhanced logging in `getContactBookingAssociations` method
**Lines**: 656-688
**Purpose**: Trace association API calls and responses

## Prevention

### Lessons Learned
1. **Always include optional parameters in validation schemas** - Even if they have default values, they should be explicitly defined
2. **Validation errors should be more specific** - The generic "An error occurred" made debugging difficult
3. **Log validation failures with detail** - Include which field failed and why

### Recommendations
1. ✅ **Add validation logging** - Log which fields fail validation and why
2. ✅ **Test with all parameter combinations** - Test with optional parameters both present and absent
3. ✅ **Use descriptive error messages** - Avoid generic error messages in production
4. ✅ **Document all API parameters** - Especially optional ones like `force`, `_t`, etc.

## Impact
- **User Experience**: "Unable to load bookings" error is now resolved
- **Cache Refresh**: Force refresh now works correctly with `force=true` parameter
- **Debugging**: Enhanced logging helps identify future issues faster

## Verification Steps
1. ✅ API returns 200 status for valid requests
2. ✅ Bookings are returned correctly (2 active bookings found)
3. ✅ Force refresh parameter works as expected
4. ✅ No validation errors with `force` parameter

## Related Files
- Test script: `test-bookings-api.js`
- This debug report: `DEBUG_BOOKINGS_CARD_ERROR.md`

---

**Debug Session Date**: October 7, 2025
**Fixed By**: Claude Code
**Status**: ✅ RESOLVED
