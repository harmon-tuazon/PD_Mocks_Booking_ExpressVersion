# PRD: Trainee Booking Rebooking Feature

**Document Version:** 1.2
**Created:** January 8, 2026
**Updated:** January 8, 2026
**Author:** Claude Code Agent
**Status:** Draft
**Confidence Score:** 9/10

---

## Key Architecture Decisions

| Decision | Pattern | Rationale |
|----------|---------|-----------|
| **GET Available Exams** | Supabase-Only | No HubSpot fallback - Supabase is source of truth for reads |
| **PATCH Rebook** | Supabase-First | Update Supabase first (blocking), then sync to HubSpot if `hubspot_id` exists (fire-and-forget) |
| **Location Filter** | Backend + Frontend | Backend provides unique locations list; filtering applied both server-side and client-side |
| **HubSpot Sync** | Conditional | Only sync to HubSpot if `booking.hubspot_id` is not NULL |

---

## 1. Executive Summary

### 1.1 Overview
This PRD defines the implementation of a rebooking feature for the Trainee Dashboard in the admin application. The feature allows administrators to easily rebook non-cancelled bookings to different mock exam sessions without requiring cancellation and re-creation workflows.

### 1.2 Problem Statement
Currently, administrators can only cancel bookings from the Trainee Dashboard. When a trainee needs to be moved to a different exam session (same mock type), the admin must:
1. Cancel the existing booking (potentially refunding tokens)
2. Navigate to the new exam session
3. Manually create a new booking for the trainee

This multi-step process is inefficient and error-prone, especially when handling urgent rebooking requests.

### 1.3 Proposed Solution
Add a "Rebook" action column to the bookings table in the Trainee Dashboard that opens a modal allowing administrators to select a new mock exam session. The modal will display available sessions (same mock type, future dates) in a single-select format similar to the existing PrerequisiteExamSelector component.

### 1.4 Success Criteria
- Rebooking can be completed in 3 clicks (button → select exam → confirm)
- No token refund/deduction required (transfer booking)
- Booking maintains all original properties except exam-related fields
- Audit trail maintained in both Supabase and HubSpot

---

## 2. Scope

### 2.1 In Scope
- New "Actions" column in Trainee Dashboard bookings table
- Rebook button for each non-cancelled booking row
- Rebook modal with single-select exam picker
- Backend API endpoint for rebooking operation
- Supabase and HubSpot synchronization
- Cache invalidation strategy
- Audit logging

### 2.2 Out of Scope
- Bulk rebooking (multiple bookings at once)
- Cross-mock-type rebooking (SJ to CS, etc.)
- Automated conflict detection (capacity is not checked)
- Email notifications to trainees
- Rebooking from Mock Exam Details page (future enhancement)

### 2.3 Dependencies
- Existing `BookingsTable` component
- Existing `PrerequisiteExamSelector` UI pattern
- Supabase `hubspot_bookings` table
- Supabase `hubspot_mock_exams` table
- HubSpot Bookings custom object (2-50158943)
- Redis cache infrastructure

---

## 3. User Stories

### 3.1 Primary User Story
**As an** admin managing trainee bookings,
**I want to** quickly rebook a trainee to a different exam session,
**So that** I can accommodate schedule changes without complex cancellation workflows.

### 3.2 Acceptance Criteria
1. **Given** I am viewing a trainee's bookings in the Trainee Dashboard
   **When** I see an active booking
   **Then** I should see a "Rebook" button in the Actions column

2. **Given** I click the "Rebook" button
   **When** the modal opens
   **Then** I should see a list of available mock exams of the same type with dates after today

3. **Given** I select a new exam session in the modal
   **When** I click "Confirm Rebooking"
   **Then** the booking should be updated with the new exam details

4. **Given** a booking is cancelled
   **When** I view the bookings table
   **Then** the "Rebook" button should be disabled or hidden

5. **Given** the rebooking succeeds
   **When** I view the updated booking
   **Then** it should show the new exam date, start time, end time, and associated mock exam

---

## 4. Technical Specification

### 4.1 Database Schema

#### 4.1.1 Affected Tables

**`hubspot_bookings` (Supabase)**
Fields to be updated during rebooking:
```sql
- associated_mock_exam (TEXT)  -- HubSpot exam ID
- exam_date (DATE)             -- New exam date
- start_time (TIMESTAMPTZ)     -- New start time
- end_time (TIMESTAMPTZ)       -- New end time
- updated_at (TIMESTAMPTZ)     -- Update timestamp
```

**`hubspot_mock_exams` (Supabase)**
Read-only during rebooking - used to fetch available exams:
```sql
- hubspot_id (TEXT)            -- HubSpot exam ID
- mock_type (TEXT)             -- SJ, CS, Mini-mock, Mock Discussion
- exam_date (DATE)
- start_time (TEXT)
- end_time (TEXT)
- location (TEXT)
- capacity (INTEGER)
- total_bookings (INTEGER)
- is_active (TEXT)
```

### 4.2 API Specification

#### 4.2.1 Fetch Available Exams for Rebooking

**Endpoint:** `GET /api/admin/mock-exams/available-for-rebook`

**Data Source:** Supabase (`hubspot_mock_exams` table) - **NO HubSpot fallback**

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `mock_type` | string | Yes | Filter by mock type (must match original booking) |
| `location` | string | Yes | Filter by location (exact match) |
| `exclude_exam_id` | string | No | Exclude current exam from results |

**Response:**
```json
{
  "success": true,
  "data": {
    "exams": [
      {
        "id": "uuid-from-supabase",
        "hubspot_id": "123456789",
        "mock_type": "Clinical Skills",
        "exam_date": "2026-03-15",
        "start_time": "09:00:00",
        "end_time": "11:00:00",
        "location": "Mississauga",
        "capacity": 20,
        "total_bookings": 15,
        "available_slots": 5,
        "is_active": "true"
      }
    ],
    "locations": ["Mississauga", "Vancouver", "Montreal", "Richmond Hill", "Calgary"],
    "total_count": 12
  },
  "meta": {
    "data_source": "supabase"
  }
}
```

**Supabase Query Implementation:**
```javascript
// Query directly from Supabase - no HubSpot fallback
let query = supabaseAdmin
  .from('hubspot_mock_exams')
  .select('*')
  .eq('mock_type', mock_type)
  .eq('is_active', 'true')
  .gt('exam_date', new Date().toISOString().split('T')[0])
  .order('exam_date', { ascending: true })
  .order('start_time', { ascending: true });

// Apply required location filter
query = query.eq('location', location);

// Exclude current exam if provided
if (exclude_exam_id) {
  query = query.neq('hubspot_id', exclude_exam_id);
}

const { data: exams, error } = await query;
```

**Filtering Logic:**
1. `mock_type` matches the provided parameter (required)
2. `location` matches the provided parameter (required)
3. `exam_date > TODAY` (future dates only)
4. `is_active = 'true'`
5. Exclude `exclude_exam_id` if provided
6. Order by `exam_date ASC, start_time ASC`

**Unique Locations Extraction:**
The response includes a `locations` array containing all unique locations from the filtered exams (before location filter is applied) to populate the frontend location dropdown filter.

#### 4.2.2 Rebook Booking

**Endpoint:** `PATCH /api/admin/bookings/rebook`

**Data Flow:** **Supabase-First** → HubSpot Sync (conditional, fire-and-forget)

**Write Strategy:**
1. **Primary Write:** Update Supabase `hubspot_bookings` table (blocking, must succeed)
2. **Secondary Sync:** Sync to HubSpot **ONLY IF** `booking.hubspot_id` exists (non-blocking, fire-and-forget)
3. **Supabase-Only Bookings:** If `hubspot_id` is NULL, skip HubSpot sync entirely

**Request Body:**
```json
{
  "booking_id": "uuid-or-hubspot-id",
  "new_mock_exam_id": "123456789"
}
```

**Validation Schema (Joi):**
```javascript
const rebookBookingSchema = Joi.object({
  booking_id: Joi.string().required()
    .description('Booking ID (UUID or HubSpot ID)'),
  new_mock_exam_id: Joi.string().required()
    .description('New mock exam HubSpot ID')
});
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "booking": {
      "id": "uuid",
      "hubspot_id": "987654321",
      "booking_id": "CS-PREP001-March 15, 2026",
      "associated_mock_exam": "123456789",
      "exam_date": "2026-03-15",
      "start_time": "09:00:00",
      "end_time": "11:00:00",
      "is_active": "Active"
    },
    "previous_exam": {
      "id": "111222333",
      "exam_date": "2026-03-01"
    },
    "message": "Booking successfully rebooked"
  }
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": {
    "code": "BOOKING_NOT_FOUND",
    "message": "Booking with ID xyz not found"
  }
}
```

**Error Codes:**
| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid input parameters |
| `BOOKING_NOT_FOUND` | 404 | Booking does not exist |
| `BOOKING_CANCELLED` | 400 | Cannot rebook a cancelled booking |
| `EXAM_NOT_FOUND` | 404 | Target exam does not exist |
| `EXAM_TYPE_MISMATCH` | 400 | Target exam type differs from booking |
| `EXAM_PAST_DATE` | 400 | Target exam date is in the past |
| `EXAM_INACTIVE` | 400 | Target exam is not active |
| `INTERNAL_ERROR` | 500 | Server error during rebooking |

### 4.3 Backend Implementation

#### 4.3.1 File Structure
```
admin_root/api/
├── admin/
│   └── mock-exams/
│       ├── available-for-rebook.js        # NEW - Fetch exams with required location
│       └── available-locations-for-rebook.js  # NEW - Fetch available locations
├── bookings/
│   └── rebook.js                          # NEW
└── _shared/
    └── validation.js                      # Add rebookBookingSchema
```

#### 4.3.2 Rebook Endpoint Logic (`/api/bookings/rebook.js`)

**Architecture Pattern:** Supabase-First with Conditional HubSpot Sync

```javascript
/**
 * PATCH /api/bookings/rebook
 * Rebook a booking to a different mock exam session
 *
 * DATA FLOW:
 * 1. Read booking from Supabase (cascading lookup)
 * 2. Read target exam from Supabase
 * 3. Update booking in Supabase (PRIMARY - must succeed)
 * 4. Sync to HubSpot ONLY IF hubspot_id exists (SECONDARY - fire-and-forget)
 *
 * @developer express-backend-architect
 * @depends-on supabase-data.js, hubspot.js, redis.js
 */

async function handler(req, res) {
  // 1. Require admin authentication
  const user = await requireAdmin(req);

  // 2. Validate request body
  const { error, value } = rebookBookingSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: error.details[0].message }
    });
  }

  const { booking_id, new_mock_exam_id } = value;

  // 3. Fetch existing booking FROM SUPABASE (cascading lookup: UUID → HubSpot ID)
  // This queries Supabase directly, trying id first, then hubspot_id
  const booking = await getBookingCascading(booking_id);
  if (!booking) {
    return res.status(404).json({
      success: false,
      error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found' }
    });
  }

  // 4. Validate booking is not cancelled
  if (booking.is_active === 'Cancelled') {
    return res.status(400).json({
      success: false,
      error: { code: 'BOOKING_CANCELLED', message: 'Cannot rebook a cancelled booking' }
    });
  }

  // 5. Fetch target exam FROM SUPABASE (no HubSpot fallback)
  const targetExam = await getExamByIdFromSupabase(new_mock_exam_id);
  if (!targetExam) {
    return res.status(404).json({
      success: false,
      error: { code: 'EXAM_NOT_FOUND', message: 'Target exam not found' }
    });
  }

  // 6. Validate exam type matches
  const bookingMockType = booking.mock_exam_type || booking.mock_type;
  if (targetExam.mock_type !== bookingMockType) {
    return res.status(400).json({
      success: false,
      error: { code: 'EXAM_TYPE_MISMATCH', message: 'Target exam type must match booking type' }
    });
  }

  // 7. Validate exam is in future
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const examDate = new Date(targetExam.exam_date);
  if (examDate < today) {
    return res.status(400).json({
      success: false,
      error: { code: 'EXAM_PAST_DATE', message: 'Target exam date must be in the future' }
    });
  }

  // 8. Validate exam is active
  if (targetExam.is_active !== 'true' && targetExam.is_active !== true) {
    return res.status(400).json({
      success: false,
      error: { code: 'EXAM_INACTIVE', message: 'Target exam is not active' }
    });
  }

  // 9. Store previous exam info for response
  const previousExam = {
    id: booking.associated_mock_exam,
    exam_date: booking.exam_date
  };

  // ============================================================
  // 10. PRIMARY WRITE: Update booking in Supabase (MUST SUCCEED)
  // ============================================================
  const updateData = {
    associated_mock_exam: targetExam.hubspot_id,
    exam_date: targetExam.exam_date,
    start_time: targetExam.start_time,
    end_time: targetExam.end_time,
    updated_at: new Date().toISOString()
  };

  const { data: updatedBooking, error: updateError } = await supabaseAdmin
    .from('hubspot_bookings')
    .update(updateData)
    .eq('id', booking.id)
    .select()
    .single();

  if (updateError) {
    console.error('Supabase update error:', updateError);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update booking' }
    });
  }

  // ============================================================
  // 11. SECONDARY SYNC: HubSpot (ONLY if hubspot_id exists)
  // Fire-and-forget - does NOT block response
  // ============================================================
  if (booking.hubspot_id) {
    console.log(`Syncing rebook to HubSpot for booking ${booking.hubspot_id}`);
    syncBookingToHubSpot(booking.hubspot_id, {
      associated_mock_exam: targetExam.hubspot_id,
      exam_date: targetExam.exam_date,
      start_time: targetExam.start_time,
      end_time: targetExam.end_time
    }).catch(err => console.error('HubSpot sync failed (non-blocking):', err));

    // Also update HubSpot association (old exam → new exam)
    updateHubSpotBookingExamAssociation(
      booking.hubspot_id,
      previousExam.id,
      targetExam.hubspot_id
    ).catch(err => console.error('HubSpot association update failed (non-blocking):', err));
  } else {
    // Supabase-only booking - no HubSpot sync needed
    console.log(`Booking ${booking.id} has no hubspot_id - skipping HubSpot sync`);
  }

  // 12. Invalidate caches (fire-and-forget)
  invalidateRebookingCaches(
    booking.associated_contact_id,
    previousExam.id,
    targetExam.hubspot_id
  ).catch(err => console.error('Cache invalidation failed:', err));

  // 13. Return success response
  return res.status(200).json({
    success: true,
    data: {
      booking: {
        id: updatedBooking.id,
        hubspot_id: updatedBooking.hubspot_id,
        booking_id: updatedBooking.booking_id,
        associated_mock_exam: updatedBooking.associated_mock_exam,
        exam_date: updatedBooking.exam_date,
        start_time: updatedBooking.start_time,
        end_time: updatedBooking.end_time,
        is_active: updatedBooking.is_active
      },
      previous_exam: previousExam,
      hubspot_synced: !!booking.hubspot_id, // Indicates if HubSpot sync was attempted
      message: 'Booking successfully rebooked'
    }
  });
}
```

#### 4.3.3 Available Exams Endpoint Logic (`/api/admin/mock-exams/available-for-rebook.js`)

**Architecture Pattern:** Supabase-Only (No HubSpot Fallback)

```javascript
/**
 * GET /api/admin/mock-exams/available-for-rebook
 * Fetch available exams for rebooking - reads directly from Supabase
 *
 * DATA FLOW:
 * 1. Query Supabase hubspot_mock_exams table
 * 2. NO HubSpot fallback - Supabase is source of truth for reads
 *
 * @developer express-backend-architect
 * @depends-on supabase-data.js
 */

async function handler(req, res) {
  // 1. Require admin authentication
  await requireAdmin(req);

  // 2. Validate query parameters
  const { mock_type, location, exclude_exam_id } = req.query;

  if (!mock_type) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'mock_type is required' }
    });
  }

  if (!location) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'location is required' }
    });
  }

  // 3. Get today's date for filtering
  const today = new Date().toISOString().split('T')[0];

  // 4. Build Supabase query - filter by mock_type and location (both required)
  let query = supabaseAdmin
    .from('hubspot_mock_exams')
    .select('*')
    .eq('mock_type', mock_type)
    .eq('location', location)
    .eq('is_active', 'true')
    .gt('exam_date', today)
    .order('exam_date', { ascending: true })
    .order('start_time', { ascending: true });

  // Exclude current exam if provided
  if (exclude_exam_id) {
    query = query.neq('hubspot_id', exclude_exam_id);
  }

  const { data: exams, error: queryError } = await query;

  if (queryError) {
    console.error('Supabase query error:', queryError);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch available exams' }
    });
  }

  // 5. Fetch all locations for the mock_type (for dropdown - separate query)
  const { data: allExamsForLocations } = await supabaseAdmin
    .from('hubspot_mock_exams')
    .select('location')
    .eq('mock_type', mock_type)
    .eq('is_active', 'true')
    .gt('exam_date', today);

  const uniqueLocations = [...new Set(
    (allExamsForLocations || [])
      .map(exam => exam.location)
      .filter(loc => loc && loc !== 'N/A')
  )].sort();

  // 6. Calculate available slots for each exam
  const examsWithSlots = exams.map(exam => ({
    ...exam,
    available_slots: Math.max(0, (exam.capacity || 0) - (exam.total_bookings || 0))
  }));

  // 7. Return response
  return res.status(200).json({
    success: true,
    data: {
      exams: examsWithSlots,
      locations: uniqueLocations,
      total_count: examsWithSlots.length
    },
    meta: {
      data_source: 'supabase',
      filters_applied: {
        mock_type,
        location,
        exclude_exam_id: exclude_exam_id || null,
        future_only: true
      }
    }
  });
}
```

#### 4.3.4 Available Locations Endpoint Logic (`/api/admin/mock-exams/available-locations-for-rebook.js`)

**Architecture Pattern:** Supabase-Only - Lightweight location lookup

```javascript
/**
 * GET /api/admin/mock-exams/available-locations-for-rebook
 * Fetch unique locations for a mock type - lightweight query for dropdown
 *
 * DATA FLOW:
 * 1. Query Supabase hubspot_mock_exams table for distinct locations
 * 2. NO HubSpot fallback - Supabase is source of truth
 *
 * @developer express-backend-architect
 * @depends-on supabase-data.js
 */

async function handler(req, res) {
  // 1. Require admin authentication
  await requireAdmin(req);

  // 2. Validate query parameters
  const { mock_type } = req.query;

  if (!mock_type) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'mock_type is required' }
    });
  }

  // 3. Get today's date for filtering
  const today = new Date().toISOString().split('T')[0];

  // 4. Fetch distinct locations for the mock type
  const { data: exams, error: queryError } = await supabaseAdmin
    .from('hubspot_mock_exams')
    .select('location')
    .eq('mock_type', mock_type)
    .eq('is_active', 'true')
    .gt('exam_date', today);

  if (queryError) {
    console.error('Supabase query error:', queryError);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch locations' }
    });
  }

  // 5. Extract unique locations
  const uniqueLocations = [...new Set(
    (exams || [])
      .map(exam => exam.location)
      .filter(loc => loc && loc !== 'N/A')
  )].sort();

  // 6. Return response
  return res.status(200).json({
    success: true,
    data: {
      locations: uniqueLocations,
      total_count: uniqueLocations.length
    },
    meta: {
      data_source: 'supabase',
      mock_type
    }
  });
}
```

#### 4.3.5 Cache Invalidation Strategy

```javascript
async function invalidateRebookingCaches(contactId, oldExamId, newExamId) {
  const keysToDelete = [
    // Trainee bookings cache
    `admin:trainee:${contactId}:bookings`,

    // Old exam caches
    `admin:mock-exam:${oldExamId}`,
    `admin:mock-exam:${oldExamId}:bookings:*`,
    `exam:${oldExamId}:bookings`,

    // New exam caches
    `admin:mock-exam:${newExamId}`,
    `admin:mock-exam:${newExamId}:bookings:*`,
    `exam:${newExamId}:bookings`,

    // General list caches
    `admin:mock-exams:list:*`,
    `user:mock-exams:list:*`
  ];

  await Promise.all(keysToDelete.map(key =>
    redis.del(key).catch(() => {})
  ));
}
```

### 4.4 Frontend Implementation

#### 4.4.1 File Structure
```
admin_root/admin_frontend/src/
├── components/
│   └── admin/
│       ├── BookingsTable.jsx          # MODIFY - Add Actions column
│       ├── BookingRow.jsx             # MODIFY - Add Rebook button
│       └── RebookModal.jsx            # NEW
├── hooks/
│   └── useRebooking.js                # NEW
└── services/
    └── adminApi.js                    # MODIFY - Add rebook methods
```

#### 4.4.2 RebookModal Component

**File:** `admin_root/admin_frontend/src/components/admin/RebookModal.jsx`

```jsx
/**
 * RebookModal Component
 * Single-select modal for rebooking a booking to a different exam session
 *
 * UI Pattern: Based on PrerequisiteExamSelector (single-select variant)
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { DatePicker } from '@/components/ui/date-picker';
import { Spinner } from '@/components/ui/spinner';
import {
  CalendarIcon,
  ClockIcon,
  MapPinIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { useAvailableExamsForRebook } from '@/hooks/useRebooking';
import { formatDateLong } from '@/utils/dateUtils';
import { formatTime } from '@/utils/timeFormatters';

const RebookModal = ({
  isOpen,
  onClose,
  booking,
  onConfirm,
  isSubmitting = false
}) => {
  // Selected exam state (single selection)
  const [selectedExamId, setSelectedExamId] = useState(null);

  // Filter state
  const [filters, setFilters] = useState({
    dateFrom: '',
    location: ''
  });

  // Fetch available exams from Supabase (no HubSpot fallback)
  // Location is REQUIRED - exams only fetched when location is selected
  const mockType = booking?.mock_exam_type || booking?.mock_type;
  const currentExamId = booking?.associated_mock_exam;
  const currentLocation = booking?.attending_location || booking?.location;

  // Initialize location filter with current booking's location
  useEffect(() => {
    if (isOpen && currentLocation) {
      setFilters(prev => ({ ...prev, location: currentLocation }));
    }
  }, [isOpen, currentLocation]);

  // Fetch locations for dropdown (separate lightweight query)
  const { data: locationsData } = useAvailableLocations(mockType, isOpen);
  const uniqueLocations = locationsData?.locations || [];

  // Fetch exams ONLY when location is selected (location is required)
  const {
    data: examData,
    isLoading,
    isError
  } = useAvailableExamsForRebook(mockType, filters.location, currentExamId, isOpen && !!filters.location);

  // Extract exams from API response
  const availableExams = examData?.exams || [];

  // Apply date filter client-side (location is already filtered server-side)
  const filteredExams = useMemo(() => {
    return availableExams.filter(exam => {
      // Date filter (applied client-side)
      if (filters.dateFrom) {
        const examDate = new Date(exam.exam_date);
        const fromDate = new Date(filters.dateFrom);
        if (examDate < fromDate) return false;
      }
      return true;
    });
  }, [availableExams, filters.dateFrom]);

  // Handle exam selection (single select)
  const handleExamSelect = useCallback((examId) => {
    setSelectedExamId(prev => prev === examId ? null : examId);
  }, []);

  // Handle confirm
  const handleConfirm = useCallback(() => {
    if (selectedExamId) {
      onConfirm(selectedExamId);
    }
  }, [selectedExamId, onConfirm]);

  // Reset state when modal closes
  const handleClose = useCallback(() => {
    setSelectedExamId(null);
    setFilters({ dateFrom: '', location: '' });
    onClose();
  }, [onClose]);

  // Get mock type badge variant
  const getMockTypeVariant = (type) => {
    switch (type) {
      case 'Clinical Skills': return 'success';
      case 'Situational Judgment': return 'info';
      case 'Mini-mock': return 'warning';
      case 'Mock Discussion': return 'purple';
      default: return 'default';
    }
  };

  if (!booking) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
              <ArrowPathIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <DialogTitle>Rebook Booking</DialogTitle>
              <DialogDescription>
                Select a new exam session for {booking.name || booking.student_id}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Current Booking Info */}
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 mb-4">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Current Booking
          </p>
          <div className="flex items-center gap-2 text-sm">
            <Badge variant={getMockTypeVariant(mockType)}>{mockType}</Badge>
            <span className="text-gray-600 dark:text-gray-300">
              {formatDateLong(booking.exam_date)} at {formatTime(booking.start_time)}
            </span>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">
              From Date
            </label>
            <DatePicker
              value={filters.dateFrom}
              onChange={(date) => setFilters(prev => ({ ...prev, dateFrom: date }))}
              placeholder="Filter by date"
              disabled={isLoading}
              className="h-8 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">
              Location
            </label>
            <select
              value={filters.location}
              onChange={(e) => setFilters(prev => ({ ...prev, location: e.target.value }))}
              disabled={isLoading || uniqueLocations.length === 0}
              className="w-full h-8 text-sm px-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Locations</option>
              {uniqueLocations.map(location => (
                <option key={location} value={location}>{location}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Available Exams List */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Available {mockType} Sessions ({filteredExams.length})
            </p>
          </div>

          <ScrollArea className="h-[250px]">
            <div className="p-2 space-y-1">
              {filters.location && isLoading && (
                <div className="flex items-center justify-center py-8">
                  <Spinner className="h-6 w-6" />
                  <span className="ml-2 text-sm text-gray-500">Loading available exams...</span>
                </div>
              )}

              {filters.location && isError && (
                <div className="text-center py-8">
                  <ExclamationTriangleIcon className="mx-auto h-8 w-8 text-red-400" />
                  <p className="mt-2 text-sm text-red-600">Failed to load available exams</p>
                </div>
              )}

              {!filters.location && (
                <div className="text-center py-8">
                  <MapPinIcon className="mx-auto h-8 w-8 text-gray-400" />
                  <p className="mt-2 text-sm text-gray-500">
                    Select a location to view available {mockType} sessions
                  </p>
                </div>
              )}

              {filters.location && !isLoading && !isError && filteredExams.length === 0 && (
                <div className="text-center py-8">
                  <CalendarIcon className="mx-auto h-8 w-8 text-gray-400" />
                  <p className="mt-2 text-sm text-gray-500">
                    No available {mockType} sessions found in {filters.location}
                  </p>
                </div>
              )}

              {filters.location && !isLoading && !isError && filteredExams.map(exam => {
                const isSelected = selectedExamId === exam.hubspot_id;
                const availableSlots = (exam.capacity || 0) - (exam.total_bookings || 0);

                return (
                  <div
                    key={exam.hubspot_id}
                    className={`
                      flex items-center p-2 rounded-lg border cursor-pointer transition-colors
                      ${isSelected
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 ring-2 ring-blue-500'
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'}
                    `}
                    onClick={() => handleExamSelect(exam.hubspot_id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleExamSelect(exam.hubspot_id);
                      }
                    }}
                  >
                    {/* Radio-style indicator */}
                    <div className="mr-3">
                      <div className={`
                        w-4 h-4 rounded-full border-2 flex items-center justify-center
                        ${isSelected
                          ? 'border-blue-500 bg-blue-500'
                          : 'border-gray-300 dark:border-gray-600'}
                      `}>
                        {isSelected && (
                          <div className="w-2 h-2 rounded-full bg-white" />
                        )}
                      </div>
                    </div>

                    {/* Exam Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        {/* Location */}
                        <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                          <MapPinIcon className="h-3.5 w-3.5" />
                          <span>{exam.location || 'N/A'}</span>
                        </div>
                        {/* Date */}
                        <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                          <CalendarIcon className="h-3.5 w-3.5" />
                          <span>{formatDateLong(exam.exam_date)}</span>
                        </div>
                        {/* Time */}
                        <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                          <ClockIcon className="h-3.5 w-3.5" />
                          <span>{formatTime(exam.start_time)} - {formatTime(exam.end_time)}</span>
                        </div>
                        {/* Capacity */}
                        <span className={`text-xs ${availableSlots <= 3 ? 'text-orange-600' : 'text-gray-500'}`}>
                          ({exam.total_bookings || 0}/{exam.capacity || 0} booked)
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Warning */}
        {selectedExamId && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg mt-4">
            <ExclamationTriangleIcon className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700 dark:text-amber-300">
              This will update the booking to the selected exam session. No tokens will be refunded or deducted.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-4">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedExamId || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Spinner className="h-4 w-4 mr-2" />
                Rebooking...
              </>
            ) : (
              'Confirm Rebooking'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RebookModal;
```

#### 4.4.3 useRebooking Hook

**File:** `admin_root/admin_frontend/src/hooks/useRebooking.js`

```javascript
/**
 * useRebooking Hook
 * Handles fetching available exams and rebooking mutations
 *
 * Data Source: Supabase (no HubSpot fallback for reads)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { traineeApi } from '@/services/adminApi';
import { toast } from 'sonner';

/**
 * Fetch available locations for a mock type
 * Used to populate the location dropdown before exams are fetched
 *
 * @param {string} mockType - Filter by mock type (required)
 * @param {boolean} enabled - Whether to enable the query
 * @returns {Object} Query result with locations array
 */
export function useAvailableLocations(mockType, enabled = true) {
  return useQuery({
    queryKey: ['available-locations-rebook', mockType],
    queryFn: () => traineeApi.getAvailableLocationsForRebook(mockType),
    enabled: enabled && !!mockType,
    staleTime: 60 * 1000, // 1 minute cache for locations
    select: (data) => ({
      locations: data?.locations || []
    })
  });
}

/**
 * Fetch available exams for rebooking
 * Reads directly from Supabase - no HubSpot fallback
 *
 * @param {string} mockType - Filter by mock type (required)
 * @param {string} location - Filter by location (required)
 * @param {string} excludeExamId - Exclude current exam from results
 * @param {boolean} enabled - Whether to enable the query
 * @returns {Object} Query result with exams and locations
 */
export function useAvailableExamsForRebook(mockType, location, excludeExamId, enabled = true) {
  return useQuery({
    queryKey: ['available-exams-rebook', mockType, location, excludeExamId],
    queryFn: () => traineeApi.getAvailableExamsForRebook(mockType, location, excludeExamId),
    enabled: enabled && !!mockType && !!location,
    staleTime: 30 * 1000, // 30 seconds
    select: (data) => ({
      exams: data?.exams || [],
      locations: data?.locations || [],
      total_count: data?.total_count || 0
    })
  });
}

/**
 * Rebooking mutation hook
 * Writes to Supabase first, then syncs to HubSpot if hubspot_id exists
 */
export function useRebookBooking(options = {}) {
  const queryClient = useQueryClient();
  const { onSuccess, contactId } = options;

  return useMutation({
    mutationFn: ({ bookingId, newMockExamId }) =>
      traineeApi.rebookBooking(bookingId, newMockExamId),

    onSuccess: (data, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['trainee-bookings'] });
      if (contactId) {
        queryClient.invalidateQueries({ queryKey: ['trainee-bookings', contactId] });
      }
      // Also invalidate available exams cache
      queryClient.invalidateQueries({ queryKey: ['available-exams-rebook'] });

      const syncedMsg = data.hubspot_synced
        ? 'Booking rebooked and synced to HubSpot'
        : 'Booking rebooked (Supabase only)';
      toast.success(syncedMsg);
      onSuccess?.(data, variables);
    },

    onError: (error) => {
      const message = error?.response?.data?.error?.message || 'Failed to rebook booking';
      toast.error(message);
    }
  });
}
```

#### 4.4.4 API Client Methods

**File:** `admin_root/admin_frontend/src/services/adminApi.js` (additions)

```javascript
// Add to traineeApi object

/**
 * Get available locations for rebooking a specific mock type
 * Lightweight query to populate location dropdown
 *
 * @param {string} mockType - Filter by mock type (required)
 */
getAvailableLocationsForRebook: async (mockType) => {
  const params = new URLSearchParams({ mock_type: mockType });
  const response = await apiClient.get(
    `/api/admin/mock-exams/available-locations-for-rebook?${params}`
  );
  return response.data.data;
},

/**
 * Get available exams for rebooking
 * Reads from Supabase - no HubSpot fallback
 *
 * @param {string} mockType - Filter by mock type (required)
 * @param {string} location - Filter by location (required)
 * @param {string} excludeExamId - Exclude current exam from results (optional)
 */
getAvailableExamsForRebook: async (mockType, location, excludeExamId = null) => {
  const params = new URLSearchParams({
    mock_type: mockType,
    location: location
  });
  if (excludeExamId) {
    params.append('exclude_exam_id', excludeExamId);
  }

  const response = await apiClient.get(
    `/api/admin/mock-exams/available-for-rebook?${params}`
  );
  return response.data.data;
},

/**
 * Rebook a booking to a different exam session
 * Writes to Supabase first, then syncs to HubSpot if hubspot_id exists
 *
 * @param {string} bookingId - Booking UUID or HubSpot ID
 * @param {string} newMockExamId - Target exam HubSpot ID
 */
rebookBooking: async (bookingId, newMockExamId) => {
  const response = await apiClient.patch('/api/admin/bookings/rebook', {
    booking_id: bookingId,
    new_mock_exam_id: newMockExamId
  });
  return response.data.data;
}
```

#### 4.4.5 BookingsTable Integration

**Modifications to:** `admin_root/admin_frontend/src/components/admin/BookingsTable.jsx`

Add new "Actions" column after the existing columns:

```jsx
// In table header (after attendance column if present)
{hideTraineeInfo && (
  <NonSortableHeader column="actions" align="center">
    Actions
  </NonSortableHeader>
)}

// In BookingRow component - add Actions cell
{hideTraineeInfo && (
  <td className="px-4 py-3 text-center">
    <Button
      size="sm"
      variant="outline"
      onClick={() => onRebook(booking)}
      disabled={booking.is_active === 'Cancelled' || booking.is_cancelled}
      className="text-xs"
    >
      <ArrowPathIcon className="h-3.5 w-3.5 mr-1" />
      Rebook
    </Button>
  </td>
)}
```

#### 4.4.6 BookingsSection Integration

**Modifications to:** `admin_root/admin_frontend/src/components/admin/BookingsSection.jsx`

```jsx
// Add state for rebook modal
const [rebookModalOpen, setRebookModalOpen] = useState(false);
const [selectedBookingForRebook, setSelectedBookingForRebook] = useState(null);

// Add rebook mutation
const rebookMutation = useRebookBooking({
  contactId,
  onSuccess: () => {
    setRebookModalOpen(false);
    setSelectedBookingForRebook(null);
    refetch(); // Refetch bookings list
  }
});

// Handler for opening rebook modal
const handleRebookClick = useCallback((booking) => {
  setSelectedBookingForRebook(booking);
  setRebookModalOpen(true);
}, []);

// Handler for confirming rebook
const handleRebookConfirm = useCallback((newExamId) => {
  rebookMutation.mutate({
    bookingId: selectedBookingForRebook.id,
    newMockExamId: newExamId
  });
}, [selectedBookingForRebook, rebookMutation]);

// Add modal to render
<RebookModal
  isOpen={rebookModalOpen}
  onClose={() => {
    setRebookModalOpen(false);
    setSelectedBookingForRebook(null);
  }}
  booking={selectedBookingForRebook}
  onConfirm={handleRebookConfirm}
  isSubmitting={rebookMutation.isPending}
/>
```

---

## 5. UI/UX Specifications

### 5.1 Rebook Button
- **Location:** New "Actions" column in bookings table (Trainee Dashboard only)
- **Style:** Outline button, small size (`size="sm"`)
- **Icon:** ArrowPathIcon (Heroicons)
- **States:**
  - Default: Blue outline, enabled
  - Disabled: Grayed out for cancelled bookings
  - Hover: Darker blue background

### 5.2 Rebook Modal
- **Size:** Max width 2xl (672px)
- **Layout:**
  1. Header with icon and title
  2. Current booking info card
  3. Filter controls (date, location)
  4. Scrollable exam list (250px height)
  5. Warning message (when exam selected)
  6. Action buttons (Cancel, Confirm)

### 5.3 Exam Selection List
- **Pattern:** Radio-style single select (not checkboxes)
- **Item Display:**
  - Radio indicator (left)
  - Location with MapPinIcon
  - Date with CalendarIcon
  - Time range with ClockIcon
  - Capacity info (X/Y booked)
- **Selected State:** Blue background, blue ring, filled radio

### 5.4 Keyboard Navigation
- Tab: Navigate between interactive elements
- Enter/Space: Select/deselect exam
- Escape: Close modal

---

## 6. Testing Requirements

### 6.1 Unit Tests

#### 6.1.1 Backend Tests (`admin_root/tests/bookings/rebook.test.js`)

```javascript
describe('POST /api/bookings/rebook', () => {
  it('should rebook an active booking to a new exam', async () => {
    // Test successful rebooking
  });

  it('should reject rebooking cancelled bookings', async () => {
    // Expect 400 error with BOOKING_CANCELLED code
  });

  it('should reject rebooking to different mock type', async () => {
    // Expect 400 error with EXAM_TYPE_MISMATCH code
  });

  it('should reject rebooking to past date exam', async () => {
    // Expect 400 error with EXAM_PAST_DATE code
  });

  it('should reject rebooking to inactive exam', async () => {
    // Expect 400 error with EXAM_INACTIVE code
  });

  it('should handle non-existent booking', async () => {
    // Expect 404 error with BOOKING_NOT_FOUND code
  });

  it('should handle non-existent target exam', async () => {
    // Expect 404 error with EXAM_NOT_FOUND code
  });

  it('should invalidate relevant caches after rebooking', async () => {
    // Verify cache invalidation calls
  });
});
```

#### 6.1.2 Frontend Tests

```javascript
describe('RebookModal', () => {
  it('should display current booking information', () => {});
  it('should load available exams on open', () => {});
  it('should filter exams by date', () => {});
  it('should filter exams by location', () => {});
  it('should allow single exam selection', () => {});
  it('should enable confirm button when exam selected', () => {});
  it('should disable confirm button when no exam selected', () => {});
  it('should show loading state', () => {});
  it('should handle API errors gracefully', () => {});
  it('should reset state on close', () => {});
});

describe('useRebooking', () => {
  it('should fetch available exams correctly', () => {});
  it('should handle rebooking mutation success', () => {});
  it('should handle rebooking mutation error', () => {});
  it('should invalidate queries on success', () => {});
});
```

### 6.2 Integration Tests

1. **End-to-end rebooking flow**
   - Search trainee → View bookings → Click Rebook → Select exam → Confirm
   - Verify booking updated in table

2. **Cross-app validation**
   - Rebook via admin → Verify in Supabase → Verify in HubSpot (if synced)

3. **Cache validation**
   - Rebook booking → Verify fresh data on next fetch

### 6.3 Manual Testing Checklist

- [ ] Rebook button visible for active bookings
- [ ] Rebook button disabled/hidden for cancelled bookings
- [ ] Modal opens correctly with booking info
- [ ] Available exams filtered by mock type
- [ ] Available exams exclude past dates
- [ ] Available exams exclude current exam
- [ ] Date filter works correctly
- [ ] Location filter works correctly
- [ ] Single selection works (radio behavior)
- [ ] Confirm button enables when exam selected
- [ ] Successful rebooking shows toast notification
- [ ] Bookings table refreshes after rebooking
- [ ] Error states display correctly
- [ ] Keyboard navigation works
- [ ] ESC closes modal

---

## 7. Security Considerations

### 7.1 Authentication
- All endpoints require admin authentication via `requireAdmin` middleware
- JWT token validated against Supabase auth

### 7.2 Authorization
- Only authenticated admins can perform rebooking
- No additional role checks (per Authentication-Only Model)

### 7.3 Input Validation
- All inputs validated with Joi schemas
- Booking ID validated as string (UUID or HubSpot ID)
- Mock exam ID validated as string

### 7.4 Data Protection
- No sensitive data exposed in error messages
- Supabase `updated_at` timestamp tracks changes
- Fire-and-forget operations don't block response

---

## 8. Performance Considerations

### 8.1 API Performance
- Supabase queries optimized with proper indexes
- HubSpot sync is non-blocking (fire-and-forget)
- Cache invalidation is non-blocking

### 8.2 Frontend Performance
- Available exams query cached for 30 seconds
- Modal state reset on close (prevents memory leaks)
- Filtered list memoized to prevent re-renders

### 8.3 Caching Strategy
- Available exams: 30-second stale time
- Trainee bookings: Invalidated on rebooking success
- Exam details: Invalidated for both old and new exam

---

## 9. Rollout Plan

### Phase 1: Development (2-3 days)
1. Backend API endpoints
2. Joi validation schemas
3. Frontend modal component
4. React Query hooks
5. BookingsTable integration

### Phase 2: Testing (1 day)
1. Unit tests (backend + frontend)
2. Integration tests
3. Manual testing checklist

### Phase 3: Deployment
1. Deploy to staging
2. QA validation
3. Deploy to production
4. Monitor for errors

---

## 10. Agent Assignments

| Component | Assigned Agent | Priority |
|-----------|----------------|----------|
| Backend API (rebook.js) | express-backend-architect | HIGH |
| Backend API (available-for-rebook.js) | express-backend-architect | HIGH |
| Validation Schema | security-compliance-auditor | HIGH |
| RebookModal Component | react-frontend-engineer | HIGH |
| useRebooking Hook | react-frontend-engineer | HIGH |
| BookingsTable Integration | react-frontend-engineer | MEDIUM |
| Unit Tests | validation-gates | MEDIUM |
| Documentation | documentation-manager | LOW |

---

## 11. Success Metrics

### 11.1 Functional Metrics
- 100% of rebooking operations complete successfully
- Zero data inconsistencies between Supabase and HubSpot
- Proper cache invalidation verified

### 11.2 Performance Metrics
- Rebooking API response < 500ms
- Modal load time < 200ms
- Available exams query < 100ms (cached)

### 11.3 User Experience Metrics
- Rebooking workflow completes in < 10 seconds
- Clear error messages for all failure scenarios
- Intuitive single-select behavior

---

## 12. Appendix

### A. Variable Naming Conventions

Per project standards (VARIABLE_NAMING_STANDARDS):

| Variable | Type | Usage |
|----------|------|-------|
| `booking.id` | UUID | Supabase primary key |
| `booking.hubspot_id` | numeric string | HubSpot record ID |
| `booking.associated_mock_exam` | numeric string | HubSpot exam ID FK |
| `exam.hubspot_id` | numeric string | HubSpot exam ID |

### B. Related PRDs
- [TRAINEE_DASHBOARD_PRD.md](./TRAINEE_DASHBOARD_PRD.md)
- [batch-booking-cancellation.md](./batch-booking-cancellation.md)
- [mock-discussion-prerequisite-associations.md](./mock-discussion-prerequisite-associations.md)

### C. Related Files
- `admin_root/admin_frontend/src/pages/TraineeDashboard.jsx`
- `admin_root/admin_frontend/src/components/admin/BookingsSection.jsx`
- `admin_root/admin_frontend/src/components/admin/BookingsTable.jsx`
- `admin_root/admin_frontend/src/components/admin/PrerequisiteExamSelector.jsx`
- `admin_root/api/bookings/batch-cancel.js`

---

**Document End**

*PRD Version: 1.2 | Confidence Score: 9/10*

---

## Changelog

### v1.2 (January 8, 2026)
- Made `location` a **REQUIRED** query parameter in GET `/api/admin/mock-exams/available-for-rebook`
- Removed `reason` field from PATCH endpoint (request body, validation schema, backend handler)
- Removed HubSpot note creation (audit log) from PATCH operations
- Simplified backend handler to return success without creating timeline notes
- Updated frontend hook and API client to remove reason parameter
- Updated security considerations section

### v1.1 (January 8, 2026)
- Added `location` query parameter to GET `/api/admin/mock-exams/available-for-rebook`
- Clarified GET endpoint reads from Supabase only (no HubSpot fallback)
- Added explicit Supabase query implementation for available exams endpoint
- Clarified PATCH endpoint: Supabase-first with conditional HubSpot sync
- Added `hubspot_synced` field to response indicating if HubSpot sync was attempted
- Backend now returns `locations` array for frontend dropdown
- Updated hook to return both `exams` and `locations` from API response
- Added Key Architecture Decisions summary table

### v1.0 (January 8, 2026)
- Initial PRD creation
