# PRD: Cross-Mock-Type Time Conflict Detection for Booking System

**Version:** 1.0
**Status:** Draft
**Created:** 2025-11-05
**Owner:** PrepDoctors Development Team

---

## 1. Executive Summary

Implement a time conflict detection mechanism that prevents students from booking multiple mock exam sessions that overlap in time, regardless of mock type. This feature will utilize existing API data to detect conflicts on the frontend without adding additional API calls.

---

## 2. Problem Statement

### Current Behavior
The booking system currently only prevents duplicate bookings for the **same mock type on the same date** using the `booking_id` format: `MockType-StudentID-Date`.

**Example of Current Limitation:**
- Student books "Clinical Skills" at 9:00 AM - 10:00 AM on Dec 5, 2025
- Student can still book "Situational Judgment" at 9:30 AM - 10:30 AM on Dec 5, 2025
- This creates a scheduling conflict where the student is double-booked

### Why This is a Problem
1. **Scheduling Conflicts**: Students cannot physically attend two sessions at the same time
2. **Resource Waste**: Both sessions are reserved but student can only attend one
3. **Administrative Burden**: Staff must manually resolve conflicts
4. **Poor User Experience**: Students discover conflicts only when they review their bookings

---

## 3. Goals & Success Metrics

### Goals
1. **Prevent Time Conflicts**: Block bookings that overlap with existing bookings (any mock type)
2. **Clear User Communication**: Show informative warning explaining the conflict
3. **Zero Performance Impact**: Implement without additional API calls
4. **Consistent UX**: Match existing duplicate booking warning pattern

### Success Metrics
- **Zero Conflict Bookings**: 0% of bookings have time overlaps after implementation
- **User Awareness**: 100% of users see warning before attempting conflicting bookings
- **Performance**: No increase in API calls or page load time
- **User Satisfaction**: Positive feedback on conflict prevention

---

## 4. Requirements

### 4.1 Functional Requirements

#### FR-1: Time Overlap Detection
**Priority:** P0 (Critical)

The system must detect time overlaps between:
- **New booking attempt** (selected session with `start_time` and `end_time`)
- **Existing active bookings** (all mock types, with `start_time` and `end_time`)

**Overlap Logic:**
Two sessions overlap if:
```javascript
// Overlap condition
(newStart < existingEnd) && (newEnd > existingStart)
```

**Example Scenarios:**

| Scenario | Existing Booking | New Booking Attempt | Result |
|----------|-----------------|---------------------|--------|
| **Exact Match** | 9:00 AM - 10:00 AM | 9:00 AM - 10:00 AM | ❌ CONFLICT |
| **Partial Overlap (Start)** | 9:00 AM - 10:00 AM | 9:30 AM - 10:30 AM | ❌ CONFLICT |
| **Partial Overlap (End)** | 9:00 AM - 10:00 AM | 8:30 AM - 9:30 AM | ❌ CONFLICT |
| **Complete Overlap** | 9:00 AM - 11:00 AM | 9:30 AM - 10:30 AM | ❌ CONFLICT |
| **No Overlap (Before)** | 9:00 AM - 10:00 AM | 7:00 AM - 8:00 AM | ✅ ALLOWED |
| **No Overlap (After)** | 9:00 AM - 10:00 AM | 11:00 AM - 12:00 PM | ✅ ALLOWED |
| **Adjacent (No Gap)** | 9:00 AM - 10:00 AM | 10:00 AM - 11:00 AM | ✅ ALLOWED |

#### FR-2: Warning Modal Display
**Priority:** P0 (Critical)

When a conflict is detected:
1. **Prevent Booking**: Do not allow "Confirm Booking" button to proceed
2. **Show Modal**: Display conflict warning modal similar to duplicate booking warning
3. **Provide Details**: Show conflicting booking details (mock type, date, time)
4. **Action Options**:
   - "View My Bookings" → Navigate to bookings page
   - "Choose Different Session" → Return to session selection
   - "Close" → Dismiss modal

**Modal Content:**
```
⚠️ Time Conflict Detected

You already have a booking at this time:

• [Mock Type]: [Date] at [Start Time] - [End Time]
• Location: [Location]

You cannot book overlapping sessions. Please:
- Cancel your existing booking, or
- Choose a different session time

[View My Bookings]  [Choose Different Session]
```

#### FR-3: Booking Status Filtering
**Priority:** P0 (Critical)

Only check conflicts with **active bookings**:
- **Include**: Bookings with `is_active` = 'Active' or 'Scheduled'
- **Exclude**: Bookings with `is_active` = 'Cancelled', 'Completed', 'Failed'

**Rationale**: Students should be able to rebook after cancelling a conflicting session.

#### FR-4: Cross-Mock-Type Detection
**Priority:** P0 (Critical)

Conflict detection must work across **ALL mock types**:
- Mock Discussion
- Clinical Skills
- Situational Judgment
- Mini-mock

**Example**:
- Existing: "Clinical Skills" at 9:00 AM - 10:00 AM
- Attempt: "Situational Judgment" at 9:30 AM - 10:30 AM
- **Result**: ❌ CONFLICT DETECTED

### 4.2 Non-Functional Requirements

#### NFR-1: Performance
**Priority:** P0 (Critical)

- **No Additional API Calls**: Use existing `/api/bookings/list` data
- **Client-Side Detection**: All conflict checking done in frontend
- **Response Time**: Conflict detection completes in < 100ms
- **Data Caching**: Leverage existing booking data cache

#### NFR-2: User Experience
**Priority:** P1 (High)

- **Immediate Feedback**: Show conflict warning before API submission
- **Clear Messaging**: Use non-technical language in warnings
- **Consistent Design**: Match existing error modal styling
- **Accessible**: WCAG 2.1 AA compliant modals

#### NFR-3: Maintainability
**Priority:** P1 (High)

- **Reusable Logic**: Create utility function for time overlap detection
- **Unit Testable**: 100% test coverage for overlap logic
- **Well Documented**: JSDoc comments on all conflict detection functions

---

## 5. Technical Design

### 5.1 Architecture Overview

**Component Flow:**
```
User Selects Session
       ↓
[BookingForm Component]
       ↓
Check for Time Conflicts (Frontend)
       ↓
   Conflicts Found?
       ├─ YES → Show Warning Modal
       │          └─ Block Submission
       └─ NO → Allow Booking Submission
                    ↓
              [Backend Validation]
                    ↓
              [Create Booking]
```

### 5.2 Data Sources

#### Existing Booking Data
**Source**: `/api/bookings/list` endpoint
**Availability**: Already fetched for "My Bookings" page
**Data Structure**:
```javascript
{
  bookings: [
    {
      id: "50158943",
      booking_id: "Clinical Skills-199999-December 5, 2025",
      mock_type: "Clinical Skills",
      exam_date: "2025-12-05",
      start_time: "2025-12-05T14:00:00.000Z", // ISO 8601 UTC
      end_time: "2025-12-05T15:00:00.000Z",   // ISO 8601 UTC
      location: "Mississauga",
      is_active: "Active" // or "Cancelled", "Completed"
    }
  ]
}
```

#### Selected Session Data
**Source**: `ExamSessionsList` component
**Availability**: Available when user clicks session
**Data Structure**:
```javascript
{
  mock_exam_id: "12345",
  mock_type: "Situational Judgment",
  exam_date: "2025-12-05",
  start_time: "2025-12-05T14:30:00.000Z",
  end_time: "2025-12-05T15:30:00.000Z",
  location: "Mississauga"
}
```

### 5.3 Implementation Plan

#### Phase 1: Utility Functions (1-2 hours)
**File**: `user_root/frontend/src/utils/timeConflictUtils.js`

```javascript
/**
 * Check if two time ranges overlap
 * @param {string} start1 - ISO 8601 start time of range 1
 * @param {string} end1 - ISO 8601 end time of range 1
 * @param {string} start2 - ISO 8601 start time of range 2
 * @param {string} end2 - ISO 8601 end time of range 2
 * @returns {boolean} - True if ranges overlap
 */
export const checkTimeOverlap = (start1, end1, start2, end2) => {
  const start1Date = new Date(start1);
  const end1Date = new Date(end1);
  const start2Date = new Date(start2);
  const end2Date = new Date(end2);

  // Overlap occurs if: (start1 < end2) AND (end1 > start2)
  return start1Date < end2Date && end1Date > start2Date;
};

/**
 * Find conflicting bookings for a new session
 * @param {Array} existingBookings - User's current active bookings
 * @param {Object} newSession - New session being booked
 * @returns {Array} - Array of conflicting bookings
 */
export const findConflictingBookings = (existingBookings, newSession) => {
  if (!existingBookings || !newSession) return [];

  return existingBookings.filter(booking => {
    // Only check active bookings
    if (booking.is_active === 'Cancelled' ||
        booking.is_active === 'Completed' ||
        booking.is_active === 'Failed') {
      return false;
    }

    // Check if bookings have required time data
    if (!booking.start_time || !booking.end_time ||
        !newSession.start_time || !newSession.end_time) {
      return false;
    }

    // Check for time overlap
    return checkTimeOverlap(
      newSession.start_time,
      newSession.end_time,
      booking.start_time,
      booking.end_time
    );
  });
};

/**
 * Format conflict details for user display
 * @param {Object} conflictingBooking - The conflicting booking
 * @returns {string} - Formatted conflict message
 */
export const formatConflictMessage = (conflictingBooking) => {
  const examDate = new Date(conflictingBooking.exam_date);
  const startTime = new Date(conflictingBooking.start_time);
  const endTime = new Date(conflictingBooking.end_time);

  const dateStr = examDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  const startTimeStr = startTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  const endTimeStr = endTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  return `${conflictingBooking.mock_type} on ${dateStr} at ${startTimeStr} - ${endTimeStr}`;
};
```

#### Phase 2: Booking Hook Integration (2-3 hours)
**File**: `user_root/frontend/src/hooks/useBookingFlow.js`

**Add to Hook State:**
```javascript
const [timeConflicts, setTimeConflicts] = useState([]);
```

**Add Conflict Check Function:**
```javascript
// Check for time conflicts before submission
const checkTimeConflicts = useCallback(async (sessionData) => {
  // Fetch user's current bookings
  const bookingsResponse = await apiService.bookings.list({
    filter: 'upcoming' // Only check upcoming bookings
  });

  if (!bookingsResponse.success || !bookingsResponse.data?.bookings) {
    // If we can't fetch bookings, allow submission
    // (Backend will catch any issues)
    return [];
  }

  const conflicts = findConflictingBookings(
    bookingsResponse.data.bookings,
    sessionData
  );

  setTimeConflicts(conflicts);
  return conflicts;
}, []);
```

**Update submitBooking Function:**
```javascript
const submitBooking = useCallback(async (immediateData = {}) => {
  setLoading(true);
  setError(null);

  const mergedData = { ...bookingData, ...immediateData };

  // NEW: Check for time conflicts before submission
  const conflicts = await checkTimeConflicts({
    start_time: mergedData.startTime,
    end_time: mergedData.endTime,
    exam_date: mergedData.examDate,
    mock_type: mergedData.mockType
  });

  if (conflicts.length > 0) {
    // Show conflict warning
    setError({
      code: 'TIME_CONFLICT',
      message: 'You have a time conflict with an existing booking',
      conflicts: conflicts
    });
    setLoading(false);
    return false;
  }

  setStep('confirming');

  // ... rest of existing submitBooking logic
}, [bookingData, checkTimeConflicts]);
```

#### Phase 3: UI Component (2-3 hours)
**File**: `user_root/frontend/src/components/shared/TimeConflictWarning.jsx`

```javascript
import React from 'react';
import { formatConflictMessage } from '../../utils/timeConflictUtils';

const TimeConflictWarning = ({ conflicts, onViewBookings, onChooseDifferent, onClose }) => {
  if (!conflicts || conflicts.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        {/* Warning Icon */}
        <div className="flex items-center justify-center w-12 h-12 mx-auto bg-orange-100 rounded-full mb-4">
          <svg className="w-6 h-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
          Time Conflict Detected
        </h3>

        {/* Message */}
        <p className="text-gray-600 text-center mb-4">
          You already have a booking at this time:
        </p>

        {/* Conflict Details */}
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
          {conflicts.map((conflict, index) => (
            <div key={index} className="flex items-start mb-2 last:mb-0">
              <span className="text-orange-600 mr-2">•</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {formatConflictMessage(conflict)}
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  Location: {conflict.location}
                </p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-sm text-gray-600 text-center mb-6">
          You cannot book overlapping sessions. Please cancel your existing booking or choose a different time.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          <button
            onClick={onViewBookings}
            className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
          >
            View My Bookings
          </button>
          <button
            onClick={onChooseDifferent}
            className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
          >
            Choose Different Session
          </button>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default TimeConflictWarning;
```

#### Phase 4: BookingForm Integration (1-2 hours)
**File**: `user_root/frontend/src/components/BookingForm.jsx`

```javascript
import TimeConflictWarning from './shared/TimeConflictWarning';

// ... in component

const isTimeConflictError = step === 'details' && error && error.code === 'TIME_CONFLICT';

return (
  <div>
    {/* Existing form JSX */}

    {/* Time Conflict Warning Modal */}
    {isTimeConflictError && (
      <TimeConflictWarning
        conflicts={error.conflicts}
        onViewBookings={() => {
          navigate('/bookings');
          clearError();
        }}
        onChooseDifferent={() => {
          goBack();
          clearError();
        }}
        onClose={clearError}
      />
    )}
  </div>
);
```

#### Phase 5: Error Message Registry (30 min)
**File**: `user_root/frontend/src/utils/errorMessages.js`

```javascript
const ERROR_MESSAGES = {
  // ... existing errors

  TIME_CONFLICT: {
    title: 'Time Conflict Detected',
    message: 'You already have a booking that overlaps with this session time. Please cancel your existing booking or choose a different session.',
    action: 'View My Bookings'
  }
};
```

---

## 6. Testing Strategy

### 6.1 Unit Tests

**File**: `user_root/frontend/src/utils/__tests__/timeConflictUtils.test.js`

```javascript
describe('checkTimeOverlap', () => {
  test('detects exact time match', () => {
    const result = checkTimeOverlap(
      '2025-12-05T14:00:00Z',
      '2025-12-05T15:00:00Z',
      '2025-12-05T14:00:00Z',
      '2025-12-05T15:00:00Z'
    );
    expect(result).toBe(true);
  });

  test('detects partial overlap (start)', () => {
    const result = checkTimeOverlap(
      '2025-12-05T14:00:00Z',
      '2025-12-05T15:00:00Z',
      '2025-12-05T14:30:00Z',
      '2025-12-05T15:30:00Z'
    );
    expect(result).toBe(true);
  });

  test('detects partial overlap (end)', () => {
    const result = checkTimeOverlap(
      '2025-12-05T14:00:00Z',
      '2025-12-05T15:00:00Z',
      '2025-12-05T13:30:00Z',
      '2025-12-05T14:30:00Z'
    );
    expect(result).toBe(true);
  });

  test('detects complete overlap', () => {
    const result = checkTimeOverlap(
      '2025-12-05T14:00:00Z',
      '2025-12-05T15:00:00Z',
      '2025-12-05T13:00:00Z',
      '2025-12-05T16:00:00Z'
    );
    expect(result).toBe(true);
  });

  test('allows non-overlapping sessions (before)', () => {
    const result = checkTimeOverlap(
      '2025-12-05T14:00:00Z',
      '2025-12-05T15:00:00Z',
      '2025-12-05T12:00:00Z',
      '2025-12-05T13:00:00Z'
    );
    expect(result).toBe(false);
  });

  test('allows non-overlapping sessions (after)', () => {
    const result = checkTimeOverlap(
      '2025-12-05T14:00:00Z',
      '2025-12-05T15:00:00Z',
      '2025-12-05T16:00:00Z',
      '2025-12-05T17:00:00Z'
    );
    expect(result).toBe(false);
  });

  test('allows adjacent sessions (no gap)', () => {
    const result = checkTimeOverlap(
      '2025-12-05T14:00:00Z',
      '2025-12-05T15:00:00Z',
      '2025-12-05T15:00:00Z',
      '2025-12-05T16:00:00Z'
    );
    expect(result).toBe(false);
  });
});

describe('findConflictingBookings', () => {
  const mockBookings = [
    {
      id: '1',
      mock_type: 'Clinical Skills',
      start_time: '2025-12-05T14:00:00Z',
      end_time: '2025-12-05T15:00:00Z',
      is_active: 'Active'
    },
    {
      id: '2',
      mock_type: 'Situational Judgment',
      start_time: '2025-12-05T16:00:00Z',
      end_time: '2025-12-05T17:00:00Z',
      is_active: 'Active'
    },
    {
      id: '3',
      mock_type: 'Mock Discussion',
      start_time: '2025-12-05T18:00:00Z',
      end_time: '2025-12-05T19:00:00Z',
      is_active: 'Cancelled' // Should be ignored
    }
  ];

  test('finds conflicting booking (different mock type)', () => {
    const newSession = {
      start_time: '2025-12-05T14:30:00Z',
      end_time: '2025-12-05T15:30:00Z'
    };

    const conflicts = findConflictingBookings(mockBookings, newSession);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].id).toBe('1');
  });

  test('ignores cancelled bookings', () => {
    const newSession = {
      start_time: '2025-12-05T18:30:00Z',
      end_time: '2025-12-05T19:30:00Z'
    };

    const conflicts = findConflictingBookings(mockBookings, newSession);
    expect(conflicts).toHaveLength(0);
  });

  test('allows booking with no conflicts', () => {
    const newSession = {
      start_time: '2025-12-05T20:00:00Z',
      end_time: '2025-12-05T21:00:00Z'
    };

    const conflicts = findConflictingBookings(mockBookings, newSession);
    expect(conflicts).toHaveLength(0);
  });
});
```

### 6.2 Integration Tests

**Test Scenarios:**
1. **Scenario 1**: User with no bookings → Allow any session
2. **Scenario 2**: User with morning booking → Block overlapping afternoon attempt
3. **Scenario 3**: User cancels conflict → Allow rebooking same time
4. **Scenario 4**: User with multiple bookings → Block any overlaps
5. **Scenario 5**: User selects adjacent session → Allow booking

### 6.3 Manual Testing Checklist

- [ ] Conflict detected for exact time match
- [ ] Conflict detected for partial overlap (start)
- [ ] Conflict detected for partial overlap (end)
- [ ] Conflict detected for complete overlap
- [ ] Conflict detected across different mock types
- [ ] No conflict for non-overlapping sessions
- [ ] No conflict for adjacent sessions
- [ ] Cancelled bookings ignored
- [ ] Modal displays correct conflict details
- [ ] "View My Bookings" button navigates correctly
- [ ] "Choose Different Session" button returns to selection
- [ ] Error message is clear and actionable

---

## 7. Edge Cases & Error Handling

### 7.1 Edge Cases

| Case | Handling |
|------|----------|
| **Missing Time Data** | If `start_time` or `end_time` is null/undefined, skip conflict check |
| **Invalid Date Format** | Log error, skip that booking in conflict check |
| **Timezone Differences** | All times stored as UTC in ISO 8601 format, convert for display only |
| **Multiple Conflicts** | Show all conflicting bookings in modal |
| **Booking List API Failure** | Allow submission (backend will validate) |

### 7.2 Error Scenarios

| Scenario | User Experience |
|----------|----------------|
| **Conflict Check Fails** | Allow booking submission (optimistic approach) |
| **Network Error During Check** | Allow booking submission, backend validates |
| **Slow API Response** | Show loading indicator, timeout after 5 seconds |
| **No Booking Data Available** | Skip conflict check, proceed to submission |

---

## 8. Implementation Timeline

**Total Estimate**: 8-12 hours

| Phase | Task | Est. Time | Priority |
|-------|------|-----------|----------|
| **1** | Utility Functions (timeConflictUtils.js) | 1-2 hours | P0 |
| **2** | Booking Hook Integration (useBookingFlow.js) | 2-3 hours | P0 |
| **3** | UI Component (TimeConflictWarning.jsx) | 2-3 hours | P0 |
| **4** | BookingForm Integration | 1-2 hours | P0 |
| **5** | Error Message Registry | 30 min | P1 |
| **6** | Unit Tests | 2-3 hours | P0 |
| **7** | Integration Tests | 1-2 hours | P1 |
| **8** | Manual Testing & QA | 1-2 hours | P0 |

---

## 9. Dependencies & Risks

### Dependencies
- ✅ `/api/bookings/list` endpoint returns `start_time` and `end_time`
- ✅ Booking data available in "My Bookings" page
- ✅ Session selection provides `start_time` and `end_time`
- ✅ Existing duplicate booking warning UI pattern

### Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Booking data not cached** | Medium | Fetch on demand if needed |
| **Time parsing errors** | Low | Robust date parsing with fallbacks |
| **Modal blocks legitimate bookings** | High | Test extensively, allow override if needed |
| **Performance on large booking lists** | Low | Optimize with early returns, most users have < 10 bookings |

---

## 10. Future Enhancements

### Post-Launch Improvements (Not in V1)
1. **Backend Validation**: Add server-side time conflict check as additional safety layer
2. **Smart Suggestions**: Suggest alternative time slots when conflict detected
3. **Calendar View**: Show visual timeline of all bookings
4. **Grace Period**: Allow 15-minute buffer between sessions for travel time
5. **Multi-Day Conflicts**: Check conflicts across multiple days for exam series

---

## 11. Approval & Sign-Off

### Stakeholders
- [ ] Product Owner: _________________
- [ ] Development Lead: _________________
- [ ] QA Lead: _________________
- [ ] UX Designer: _________________

### Acceptance Criteria
- [ ] All unit tests pass with 100% coverage
- [ ] Manual testing completed successfully
- [ ] No performance degradation (0 additional API calls)
- [ ] User sees clear warning for all conflict scenarios
- [ ] Code review completed and approved

---

**Document End**
