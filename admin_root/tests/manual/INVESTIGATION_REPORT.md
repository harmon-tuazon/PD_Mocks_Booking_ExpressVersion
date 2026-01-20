# Investigation Report: Mock Discussion Exam Issues

## Executive Summary

Investigation of Mock Discussion exam ID 37367871482 revealed two critical issues:
1. **Exam ID does not exist** - likely a typo (should be 37367871402)
2. **Time display issue** - Times stored as ISO 8601 strings but frontend expects Unix timestamps

---

## Issue 1: Prerequisites Not Showing

### ROOT CAUSE: Exam ID Does Not Exist

**User Reported**: Exam ID `37367871482`
**HubSpot Response**: 404 Not Found

**Investigation Results**:
```
GET /crm/v3/objects/2-50158913/37367871482
Response: 404 - Resource not found
```

### Similar Exam Found

**Correct Exam ID**: `37367871402` (last digits: 02 instead of 82)

**Exam Details**:
- Type: Mock Discussion
- Date: 2025-12-25
- Location: Online
- Start Time: 2025-12-25T19:00:00Z (UTC)
- End Time: 2025-12-26T00:00:00Z (UTC)
- Capacity: 30
- Active: true
- **Prerequisites**: 0 (none associated)

### December 4 Clinical Skills Exam

**Exam ID**: 35864533276

This is likely the exam that should be associated as a prerequisite:
- Type: Clinical Skills
- Date: 2025-12-04
- Location: Online
- Start Time: 2025-12-04T14:00:00Z
- End Time: 2025-12-04T22:00:00Z
- Capacity: 13
- Active: true

**Timezone Conversion**:
- UTC 14:00 = Toronto 9:00 AM (EST) or 10:00 AM (EDT)
- UTC 22:00 = Toronto 5:00 PM (EST) or 6:00 PM (EDT)

**Note**: This does NOT match the expected 2:00PM-7:00PM Toronto time.

### Expected 2:00PM-7:00PM Times in UTC

For Toronto (America/Toronto) times:
- **2:00 PM Toronto** = 19:00 UTC (EST) or 18:00 UTC (EDT)
- **7:00 PM Toronto** = 00:00 UTC next day (EST) or 23:00 UTC (EDT)

**No exams found** with exactly 2:00PM-7:00PM Toronto time in the database.

---

## Issue 2: Wrong Time Display

### ROOT CAUSE: Data Format Mismatch

**HubSpot Storage Format**: ISO 8601 strings in UTC timezone
```
"start_time": "2025-12-25T19:00:00Z"
```

**Frontend Expectation**: Unix timestamps (milliseconds)
```javascript
// formatTime function expects:
1735156800000  // Unix timestamp
```

### Current Frontend formatTime Function

**Location**: `admin_root/admin_frontend/src/utils/timeFormatters.js`

**Current Logic**:
1. Checks if already formatted (HH:MM AM/PM) → return as-is
2. Checks if HH:mm format → convert to 12-hour
3. Checks if Unix timestamp → convert to local time

**Problem**: Step 3 fails for ISO 8601 strings because the regex `/^\d+$/` doesn't match ISO format.

### Fix Required

The formatTime function needs to handle ISO 8601 strings:

```javascript
export const formatTime = (dateString) => {
  if (!dateString) return '';

  // Special case: If it's already formatted as 12-hour time
  if (typeof dateString === 'string' && /^\d{1,2}:\d{2}\s?(AM|PM)$/i.test(dateString)) {
    return dateString;
  }

  // Special case: If it's already in HH:mm or HH:mm:ss format
  if (typeof dateString === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(dateString)) {
    const [hours, minutes] = dateString.split(':').map(Number);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    return `${displayHour}:${String(minutes).padStart(2, '0')} ${ampm}`;
  }

  // NEW: Handle ISO 8601 format (e.g., "2025-12-25T19:00:00Z")
  if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(dateString)) {
    const date = new Date(dateString);

    if (isNaN(date.getTime())) {
      console.warn('Invalid ISO date string:', dateString);
      return 'Invalid Date';
    }

    // Convert to Toronto timezone and format as 12-hour time
    return date.toLocaleTimeString('en-US', {
      timeZone: 'America/Toronto',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  // Handle UTC timestamps and ISO strings
  const date = new Date(typeof dateString === 'string' && /^\d+$/.test(dateString) ? parseInt(dateString) : dateString);

  if (isNaN(date.getTime())) {
    console.warn('Invalid date string:', dateString);
    return 'Invalid Date';
  }

  // Convert to local time for display
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};
```

---

## All Mock Discussion Exams in HubSpot

### Current State

Total Mock Discussion exams: **2**

#### 1. Exam 37319154582
- Date: 2025-12-21
- Location: Mississauga
- Start Time: 2025-12-21T13:00:00Z (8:00 AM Toronto EST)
- End Time: 2025-12-21T22:00:00Z (5:00 PM Toronto EST)
- Prerequisites: **0** (none associated)

#### 2. Exam 37367871402
- Date: 2025-12-25
- Location: Online
- Start Time: 2025-12-25T19:00:00Z (2:00 PM Toronto EST)
- End Time: 2025-12-26T00:00:00Z (7:00 PM Toronto EST)
- Prerequisites: **0** (none associated)

**This exam DOES match 2:00PM-7:00PM Toronto time!**

---

## Recommended Actions

### Immediate Actions

1. **Verify Correct Exam ID**
   - Confirm with user if exam 37367871402 is the correct exam
   - User reported 37367871482 (does not exist)
   - Only 2-digit difference (82 vs 02)

2. **Associate Prerequisites**
   - If exam 37367871402 is correct, associate December 4 Clinical Skills exam (35864533276)
   - Use association type 1340 ("requires attendance at")

3. **Fix Time Display**
   - Update formatTime function to handle ISO 8601 strings
   - Ensure proper timezone conversion (UTC → America/Toronto)

### Code Changes Required

#### 1. Update timeFormatters.js

**File**: `admin_root/admin_frontend/src/utils/timeFormatters.js`

Add ISO 8601 handling before the current timestamp logic.

#### 2. Optionally Update Backend Time Formatting

**File**: `admin_root/api/admin/mock-exams/[id].js` (lines 475-493)

Currently the backend attempts to format times, but since HubSpot stores ISO strings,
the backend should either:
- Pass ISO strings as-is and let frontend handle conversion
- OR convert ISO to HH:mm format consistently

**Current backend formatTime**:
```javascript
const formatTime = (timestamp) => {
  if (!timestamp) return null;

  // Handle ISO timestamp format
  if (typeof timestamp === 'string' && timestamp.includes('T')) {
    // Already an ISO timestamp, extract time portion
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'America/Toronto'
    });
  }

  // ... rest of function
};
```

**Issues with current backend**:
- Uses `hour12: false` but frontend expects 12-hour
- Returns HH:mm format but frontend needs proper conversion
- Inconsistent timezone handling

**Recommendation**: Let frontend handle ALL time formatting. Backend should just pass ISO strings.

---

## Testing Checklist

### After Fixes

- [ ] Verify formatTime handles ISO 8601 strings correctly
- [ ] Check timezone conversion (UTC → Toronto)
- [ ] Test with exam 37367871402
  - [ ] Times display as "2:00 PM" and "7:00 PM"
  - [ ] Edit mode shows correct times
- [ ] Associate prerequisite exam 35864533276 to 37367871402
  - [ ] Association type 1340
  - [ ] Verify prerequisites show in view mode
  - [ ] Verify prerequisites show in edit mode
- [ ] Clear cache (Redis) to ensure fresh data
- [ ] Test on production deployment

### Test Scripts Created

1. `debug-exam-37367871482.js` - Deep diagnostic for specific exam
2. `find-mock-discussion-exams.js` - Find all Mock Discussion exams
3. `list-all-exams.js` - List all exams by type
4. `check-hubspot-connection.js` - Verify HubSpot connectivity
5. `direct-hubspot-search.js` - Direct search with time analysis
6. `find-exams-by-time.js` - Find exams by specific time range

All scripts located in: `admin_root/tests/manual/`

---

## Summary

### Issue 1: Prerequisites Not Showing
**Root Cause**: Exam ID 37367871482 does not exist (404)
**Likely Cause**: Typo in exam ID (should be 37367871402)
**Solution**: Verify correct exam ID with user and associate prerequisites

### Issue 2: Wrong Time Display
**Root Cause**: Data format mismatch (ISO 8601 vs Unix timestamp)
**Solution**: Update formatTime function to handle ISO 8601 strings with timezone conversion

### Key Findings
- Only 2 Mock Discussion exams exist in HubSpot
- Exam 37367871402 DOES have correct 2:00PM-7:00PM times (in Toronto timezone)
- Neither Mock Discussion exam has prerequisites associated
- December 4 Clinical Skills exam exists and should be associated

---

**Report Generated**: 2025-11-06
**Investigation By**: Claude Code
**HubSpot Connection**: Verified (40 exams total)
**Status**: Complete - Ready for fixes
