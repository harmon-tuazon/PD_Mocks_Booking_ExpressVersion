# PRD: Batch Booking Cancellation in Mock Exam Details

**Version:** 1.0.0
**Date:** October 31, 2025
**Status:** Draft
**Priority:** High
**Estimated Effort:** 2-3 days

---

## 1. Executive Summary

Enable admin users to cancel multiple bookings simultaneously from the Mock Exam Details page through a safe, confirmation-gated workflow. This feature mirrors the successful Mark Attendance UX pattern, providing consistent interaction patterns while implementing additional safety measures for destructive operations.

### Key Benefits
- **Batch Operations**: Cancel multiple bookings in one action (up to 100 per request)
- **Safety First**: Multi-step confirmation with typed verification prevents accidental cancellations
- **Soft Delete**: Preserves booking data for audit trail (is_active = "Cancelled")
- **Consistent UX**: Mirrors Mark Attendance pattern for familiarity
- **Real-time Updates**: Immediate UI feedback with cache invalidation

---

## 2. Problem Statement

### Current State
- Admins cannot cancel bookings from the admin interface
- No batch cancellation capability exists
- Cancellations may need to happen for:
  - Students who can't attend
  - Duplicate bookings
  - Mock exam cancellations
  - Administrative corrections

### Desired State
- Admins can cancel single or multiple bookings efficiently
- Safe, multi-step confirmation prevents errors
- Audit trail preserved through soft delete
- Consistent with existing admin workflows

---

## 3. User Stories

### Primary User Story
**As an** admin managing mock exam bookings
**I want to** cancel one or more bookings through a safe, confirmed process
**So that** I can manage capacity and handle cancellations without accidentally deleting wrong bookings

### Acceptance Criteria
- [ ] "Cancel Bookings" button appears in Mock Exam Details page
- [ ] Can select multiple bookings via checkboxes
- [ ] Selection count updates in real-time
- [ ] Can proceed or cancel the operation
- [ ] Confirmation modal requires typing exact number of bookings
- [ ] Cannot proceed until correct number is typed
- [ ] Bookings are soft-deleted (is_active = "Cancelled")
- [ ] UI updates immediately after cancellation
- [ ] Success/error feedback shown to user
- [ ] Cache invalidated for affected resources

---

## 4. Functional Requirements

### 4.1 UI Components

#### Cancel Bookings Button
- **Location**: Mock Exam Details page, next to "Mark Attendance" button
- **Appearance**:
  - Default: Outlined button with red accent
  - Label: "Cancel Bookings"
  - Icon: Trash/X icon
- **State**:
  - Disabled when no bookings exist
  - Enabled when bookings are available

#### Selection Mode
- **Trigger**: Clicking "Cancel Bookings" button
- **Behavior**:
  - Enable checkbox column in bookings table
  - Show action bar with selection count
  - Display "Proceed" and "Cancel" buttons
  - Highlight selected rows

#### Action Bar
```
[✓ 3 bookings selected]  [Cancel Selection] [Proceed with Cancellation]
```

#### Confirmation Modal
- **Title**: "Confirm Booking Cancellation"
- **Content**:
  - Warning message about cancellation
  - List of selected booking IDs/names (max 5 shown, "+X more" for rest)
  - Input field: "Type the number of bookings to confirm"
  - Note: "This will mark bookings as cancelled. This action cannot be undone."
- **Buttons**:
  - "Cancel" (secondary, always enabled)
  - "Confirm Cancellation" (primary, red, disabled until correct number typed)

### 4.2 User Flow

```
1. Admin clicks "Cancel Bookings" button
   ↓
2. Table enters selection mode (checkboxes appear)
   ↓
3. Admin selects bookings to cancel (checkboxes)
   ↓
4. Selection count updates in action bar
   ↓
5. Admin clicks "Proceed with Cancellation"
   ↓
6. Confirmation modal appears
   ↓
7. Admin types number of bookings (e.g., "3")
   ↓
8. "Confirm Cancellation" button enables
   ↓
9. Admin clicks "Confirm Cancellation"
   ↓
10. API request sent to backend
    ↓
11. Success: Modal closes, table refreshes, success message shown
    Error: Error message shown in modal, modal stays open
```

### 4.3 Data Requirements

#### Input Data
```typescript
{
  bookings: [
    {
      bookingId: string,
      reason?: string  // Optional cancellation reason
    }
  ]
}
```

#### Output Data
```typescript
{
  success: boolean,
  summary: {
    total: number,
    cancelled: number,
    failed: number,
    skipped: number
  },
  results: {
    successful: Array<{
      bookingId: string,
      message: string
    }>,
    failed: Array<{
      bookingId: string,
      error: string,
      code: string
    }>,
    skipped: Array<{
      bookingId: string,
      reason: string
    }>
  },
  meta: {
    timestamp: string,
    processedBy: string,
    mockExamId: string,
    executionTime: number
  }
}
```

---

## 5. Technical Requirements

### 5.1 Backend API

#### Endpoint
```
PATCH /api/admin/mock-exams/[id]/cancel-bookings
```

#### Request
```json
{
  "bookings": [
    { "bookingId": "12345678", "reason": "Student requested cancellation" },
    { "bookingId": "23456789", "reason": "Duplicate booking" }
  ]
}
```

#### Response (Success)
```json
{
  "success": true,
  "summary": {
    "total": 2,
    "cancelled": 2,
    "failed": 0,
    "skipped": 0
  },
  "results": {
    "successful": [
      { "bookingId": "12345678", "message": "Successfully cancelled" },
      { "bookingId": "23456789", "message": "Successfully cancelled" }
    ],
    "failed": [],
    "skipped": []
  },
  "meta": {
    "timestamp": "2025-10-31T10:30:00Z",
    "processedBy": "admin@prepdoctors.com",
    "mockExamId": "98765432",
    "executionTime": 1250
  }
}
```

#### Business Logic
1. **Authentication**: Verify admin authentication via `requireAdmin`
2. **Validation**:
   - Validate mock exam ID exists
   - Validate booking IDs format
   - Max 100 bookings per request
   - Validate bookings belong to the mock exam
3. **Fetch Current State**: Batch read bookings from HubSpot
4. **Validation Rules**:
   - Skip already cancelled bookings (is_active = "Cancelled")
   - Skip completed bookings? (TBD - may want to prevent or allow)
5. **Update Operations**:
   - Set `is_active = "Cancelled"`
   - Set `booking_status = "cancelled"` (if different property)
   - Optionally set cancellation timestamp
6. **Batch Processing**: Process in chunks of 100 (HubSpot limit)
7. **Cache Invalidation**: Invalidate affected caches
8. **Audit Trail**: Create note on mock exam record

### 5.2 Frontend Components

#### New Components
1. **CancelBookingsButton.jsx**
   - Initiates cancellation flow
   - Manages selection mode state

2. **CancelBookingsConfirmModal.jsx**
   - Confirmation modal with typed verification
   - Shows selected bookings
   - Handles API submission

#### Modified Components
1. **MockExamDetail.jsx**
   - Add "Cancel Bookings" button
   - Add selection mode state
   - Add action bar for selected bookings

2. **BookingsTable.jsx** (or equivalent)
   - Add checkbox column when in selection mode
   - Manage row selection state
   - Highlight selected rows

### 5.3 API Implementation

#### File: `admin_root/api/admin/mock-exams/[id]/cancel-bookings.js`

```javascript
/**
 * PATCH /api/admin/mock-exams/[id]/cancel-bookings
 * Batch cancel bookings for a mock exam (soft delete)
 */

const { requireAdmin } = require('../../middleware/requireAdmin');
const { validationMiddleware } = require('../../../_shared/validation');
const { getCache } = require('../../../_shared/cache');
const hubspot = require('../../../_shared/hubspot');

const HUBSPOT_OBJECTS = {
  'bookings': '2-50158943',
  'mock_exams': '2-50158913'
};

const MAX_BOOKINGS_PER_REQUEST = 100;
const HUBSPOT_BATCH_SIZE = 100;

module.exports = async (req, res) => {
  const startTime = Date.now();

  try {
    // Verify admin authentication
    const user = await requireAdmin(req);
    const adminEmail = user?.email || 'admin@prepdoctors.com';

    // Extract mock exam ID
    const mockExamId = req.query.id;

    // Validate mock exam ID
    if (!mockExamId || !/^\d+$/.test(mockExamId)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_MOCK_EXAM_ID', message: 'Valid mock exam ID is required' }
      });
    }

    // Validate request body
    const validator = validationMiddleware('batchBookingCancellation');
    await new Promise((resolve, reject) => {
      validator(req, res, (error) => error ? reject(error) : resolve());
    });

    const { bookings } = req.validatedData;

    // Check batch size limit
    if (bookings.length > MAX_BOOKINGS_PER_REQUEST) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BATCH_SIZE_EXCEEDED',
          message: `Maximum ${MAX_BOOKINGS_PER_REQUEST} bookings can be cancelled per request`,
          details: { provided: bookings.length, maximum: MAX_BOOKINGS_PER_REQUEST }
        }
      });
    }

    console.log(`🗑️ [CANCEL] Processing batch cancellation for mock exam ${mockExamId}`);
    console.log(`🗑️ [CANCEL] Total bookings to cancel: ${bookings.length}`);

    // Fetch existing bookings to validate
    const bookingIds = bookings.map(b => b.bookingId);
    const existingBookings = await fetchBookingsBatch(bookingIds);

    // Initialize result tracking
    const results = { successful: [], failed: [], skipped: [] };
    const updates = [];

    // Validate and prepare updates
    for (const booking of bookings) {
      const existingBooking = existingBookings.get(booking.bookingId);

      // Check if booking exists
      if (!existingBooking) {
        results.failed.push({
          bookingId: booking.bookingId,
          error: 'Booking not found',
          code: 'BOOKING_NOT_FOUND'
        });
        continue;
      }

      // Check if already cancelled (idempotency)
      if (existingBooking.properties.is_active === 'Cancelled') {
        results.skipped.push({
          bookingId: booking.bookingId,
          reason: 'Already cancelled'
        });
        continue;
      }

      // Prepare update
      updates.push({
        id: booking.bookingId,
        properties: {
          is_active: 'Cancelled',
          booking_status: 'cancelled'
        }
      });
    }

    // Process updates in batches
    if (updates.length > 0) {
      console.log(`⚡ [CANCEL] Processing ${updates.length} cancellations...`);
      const updateResults = await processCancellations(updates);

      for (const result of updateResults.successful) {
        results.successful.push({
          bookingId: result.id,
          message: 'Successfully cancelled'
        });
      }

      for (const error of updateResults.failed) {
        results.failed.push({
          bookingId: error.id,
          error: error.message || 'Failed to cancel booking',
          code: 'UPDATE_FAILED'
        });
      }
    }

    // Invalidate caches
    if (results.successful.length > 0) {
      await invalidateCancellationCaches(mockExamId);
      console.log(`🗑️ [CANCEL] Caches invalidated for mock exam ${mockExamId}`);
    }

    // Calculate summary
    const summary = {
      total: bookings.length,
      cancelled: results.successful.length,
      failed: results.failed.length,
      skipped: results.skipped.length
    };

    // Log audit trail
    if (results.successful.length > 0) {
      console.log(`✅ [CANCEL] Successfully cancelled ${results.successful.length} bookings`);
      createAuditLog(mockExamId, summary, adminEmail).catch(error => {
        console.error('Failed to create audit log:', error);
      });
    }

    // Return response
    const executionTime = Date.now() - startTime;

    res.status(200).json({
      success: true,
      summary,
      results,
      meta: {
        timestamp: new Date().toISOString(),
        processedBy: adminEmail,
        mockExamId,
        executionTime
      }
    });

  } catch (error) {
    console.error('❌ [CANCEL] Error in batch cancellation:', error);

    // Handle validation errors
    if (error.validationErrors) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: error.validationErrors
        }
      });
    }

    // Handle auth errors
    if (error.message?.includes('authorization') || error.message?.includes('token')) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      });
    }

    // Generic error
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'An error occurred while cancelling bookings'
      }
    });
  }
};

async function fetchBookingsBatch(bookingIds) {
  const bookingsMap = new Map();

  for (let i = 0; i < bookingIds.length; i += HUBSPOT_BATCH_SIZE) {
    const chunk = bookingIds.slice(i, i + HUBSPOT_BATCH_SIZE);

    try {
      const response = await hubspot.apiCall('POST', `/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}/batch/read`, {
        properties: ['is_active', 'booking_status'],
        inputs: chunk.map(id => ({ id }))
      });

      if (response.results) {
        for (const booking of response.results) {
          bookingsMap.set(booking.id, booking);
        }
      }
    } catch (error) {
      console.error('Error fetching booking batch:', error);
    }
  }

  return bookingsMap;
}

async function processCancellations(updates) {
  const results = { successful: [], failed: [] };

  for (let i = 0; i < updates.length; i += HUBSPOT_BATCH_SIZE) {
    const chunk = updates.slice(i, i + HUBSPOT_BATCH_SIZE);

    try {
      const response = await hubspot.apiCall('POST', `/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}/batch/update`, {
        inputs: chunk
      });

      if (response.results) {
        results.successful.push(...response.results);
      }

      if (response.errors) {
        for (const error of response.errors) {
          results.failed.push({
            id: error.context?.id || 'unknown',
            message: error.message
          });
        }
      }
    } catch (error) {
      console.error('Error processing cancellation batch:', error);
      for (const update of chunk) {
        results.failed.push({
          id: update.id,
          message: error.message || 'Batch update failed'
        });
      }
    }
  }

  return results;
}

async function invalidateCancellationCaches(mockExamId) {
  const cache = getCache();

  try {
    await cache.delete(`admin:mock-exam:${mockExamId}`);
    await cache.delete(`admin:mock-exam:details:${mockExamId}`);
    await cache.deletePattern(`admin:mock-exam:${mockExamId}:bookings:*`);
    await cache.deletePattern('admin:mock-exams:aggregates:*');
    await cache.deletePattern('admin:aggregate:sessions:*');
    await cache.deletePattern('admin:metrics:*');
    await cache.deletePattern('admin:mock-exams:list:*');
  } catch (error) {
    console.error('Error invalidating caches:', error);
  }
}

async function createAuditLog(mockExamId, summary, adminEmail) {
  // Implementation for audit log creation
  // Similar to attendance audit log
}
```

### 5.4 Validation Schema

#### File: `admin_root/api/_shared/validation.js`

Add new schema:

```javascript
// Schema for batch booking cancellation (Admin)
batchBookingCancellation: Joi.object({
  bookings: Joi.array()
    .items(
      Joi.object({
        bookingId: Joi.string()
          .pattern(/^\d+$/)
          .required()
          .messages({
            'string.pattern.base': 'Booking ID must be a valid numeric string',
            'any.required': 'Booking ID is required'
          }),
        reason: Joi.string()
          .max(500)
          .optional()
          .messages({
            'string.max': 'Reason cannot exceed 500 characters'
          })
      })
    )
    .min(1)
    .max(100)
    .required()
    .messages({
      'array.min': 'At least one booking must be provided',
      'array.max': 'Cannot cancel more than 100 bookings at once',
      'any.required': 'Bookings array is required'
    })
}).messages({
  'object.unknown': 'Unknown field in request body'
})
```

---

## 6. UI/UX Specifications

### 6.1 Visual Design

#### Cancel Bookings Button
```
┌─────────────────────────────┐
│  🗑️  Cancel Bookings       │ ← Red outline, gray background
└─────────────────────────────┘
```

#### Selection Mode Action Bar
```
┌──────────────────────────────────────────────────────────────┐
│ ✓ 3 bookings selected     [Cancel Selection] [Proceed →]    │
└──────────────────────────────────────────────────────────────┘
```

#### Confirmation Modal
```
┌─────────────────────────────────────────────────────────┐
│  ⚠️  Confirm Booking Cancellation                   ✕  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  You are about to cancel 3 booking(s):                │
│                                                         │
│  • John Doe (john@example.com)                         │
│  • Jane Smith (jane@example.com)                       │
│  • Bob Johnson (bob@example.com)                       │
│                                                         │
│  ⚠️ This will mark these bookings as cancelled.        │
│     This action cannot be undone.                      │
│                                                         │
│  Type the number of bookings to confirm:               │
│  ┌─────────────────────────────────────────────┐      │
│  │                                             │      │
│  └─────────────────────────────────────────────┘      │
│  Enter "3" to confirm                                  │
│                                                         │
│              [Cancel]  [Confirm Cancellation]          │
│                         (disabled until "3" typed)     │
└─────────────────────────────────────────────────────────┘
```

### 6.2 Interaction States

#### Button States
- **Idle**: Red outline, white background
- **Hover**: Red background, white text
- **Active**: Darker red background
- **Disabled**: Gray outline, gray text, no cursor

#### Table Row States
- **Normal**: White background
- **Hover**: Light gray background
- **Selected**: Light blue background, blue border
- **Processing**: Animated loading overlay

### 6.3 Responsive Behavior
- Mobile: Stack action buttons vertically
- Tablet: Maintain horizontal layout
- Desktop: Full layout with all features

---

## 7. Error Handling

### 7.1 User-Facing Errors

| Error Scenario | User Message | Recovery Action |
|----------------|--------------|-----------------|
| No bookings selected | "Please select at least one booking to cancel" | Enable selection |
| Network timeout | "Request timed out. Please try again with fewer bookings." | Retry with smaller batch |
| Server error | "An error occurred. Please try again." | Retry operation |
| Partial failure | "3 of 5 bookings cancelled successfully. 2 failed." | Show detailed results |
| Already cancelled | "Some bookings are already cancelled and will be skipped." | Show skipped items |
| Booking not found | "Some bookings could not be found and were skipped." | Show failed items |

### 7.2 Technical Error Codes

```javascript
{
  INVALID_MOCK_EXAM_ID: 'Mock exam ID is invalid or missing',
  BOOKING_NOT_FOUND: 'One or more bookings do not exist',
  ALREADY_CANCELLED: 'Booking is already cancelled',
  BATCH_SIZE_EXCEEDED: 'Too many bookings in single request',
  VALIDATION_ERROR: 'Request data validation failed',
  UNAUTHORIZED: 'Authentication required',
  SERVER_ERROR: 'Internal server error occurred',
  TIMEOUT: 'Request exceeded time limit'
}
```

---

## 8. Performance Requirements

### 8.1 Response Time Targets
- **Small batch (1-10 bookings)**: < 2 seconds
- **Medium batch (11-50 bookings)**: < 5 seconds
- **Large batch (51-100 bookings)**: < 10 seconds

### 8.2 Optimization Strategies
- Batch API calls (100 items per batch)
- Parallel processing where possible
- Efficient cache invalidation
- Minimal data transfer (only required properties)

---

## 9. Security Requirements

### 9.1 Authentication & Authorization
- ✅ Admin authentication required (`requireAdmin`)
- ✅ Token validation on every request
- ✅ Session timeout enforcement

### 9.2 Input Validation
- ✅ Joi schema validation for all inputs
- ✅ Booking ID format validation (numeric string)
- ✅ Batch size limits (max 100)
- ✅ SQL injection prevention (using HubSpot API)

### 9.3 Audit Trail
- ✅ Log all cancellation attempts
- ✅ Record admin email who performed action
- ✅ Timestamp all operations
- ✅ Create HubSpot notes on mock exam record

---

## 10. Testing Requirements

### 10.1 Unit Tests
- [ ] Validation schema tests
- [ ] fetchBookingsBatch function
- [ ] processCancellations function
- [ ] invalidateCancellationCaches function
- [ ] Error handling logic

### 10.2 Integration Tests
- [ ] API endpoint with valid data
- [ ] API endpoint with invalid data
- [ ] Batch processing with 100 items
- [ ] Partial failure scenarios
- [ ] Idempotency (cancelling already cancelled bookings)

### 10.3 E2E Tests
- [ ] Complete cancellation flow (UI → API → HubSpot)
- [ ] Confirmation modal interaction
- [ ] Success and error message display
- [ ] Table refresh after cancellation
- [ ] Cache invalidation verification

### 10.4 Manual Testing Checklist
- [ ] Select single booking and cancel
- [ ] Select multiple bookings and cancel
- [ ] Try to cancel without selection (should fail)
- [ ] Type wrong number in confirmation (button stays disabled)
- [ ] Type correct number (button enables)
- [ ] Cancel operation at each step
- [ ] Verify soft delete (booking still exists with is_active = "Cancelled")
- [ ] Verify bookings no longer appear in active list
- [ ] Verify attendance cannot be marked on cancelled bookings

---

## 11. Success Metrics

### 11.1 Functional Metrics
- ✅ 100% of valid cancellation requests succeed
- ✅ 0% accidental cancellations (confirmed by typed verification)
- ✅ < 1% error rate for valid requests
- ✅ 100% cache invalidation success rate

### 11.2 Performance Metrics
- ✅ 95th percentile response time < 5 seconds
- ✅ 99th percentile response time < 10 seconds
- ✅ Successful batch processing of 100 bookings

### 11.3 User Experience Metrics
- ✅ Users can complete cancellation flow in < 30 seconds
- ✅ Clear feedback at every step
- ✅ No confusion about which bookings were cancelled

---

## 12. Rollout Plan

### 12.1 Phase 1: Development (2 days)
- [ ] Implement backend API endpoint
- [ ] Add validation schema
- [ ] Create frontend components
- [ ] Implement confirmation modal
- [ ] Add selection mode to table

### 12.2 Phase 2: Testing (1 day)
- [ ] Unit tests
- [ ] Integration tests
- [ ] Manual testing with test data
- [ ] Edge case testing

### 12.3 Phase 3: Deployment
- [ ] Deploy to staging
- [ ] Smoke test on staging
- [ ] Deploy to production
- [ ] Monitor for errors

### 12.4 Phase 4: Monitoring (Ongoing)
- [ ] Monitor error rates
- [ ] Track usage patterns
- [ ] Collect user feedback
- [ ] Performance monitoring

---

## 13. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Accidental mass cancellation | High | Low | Typed confirmation modal prevents accidents |
| HubSpot API rate limits | Medium | Medium | Batch processing with delays if needed |
| Network timeout for large batches | Medium | Medium | 100-item limit, recommend smaller batches |
| Cache invalidation failure | Low | Low | Graceful degradation, eventual consistency |
| Partial batch failure | Medium | Low | Detailed error reporting, retry mechanism |

---

## 14. Future Enhancements

### 14.1 Short-term (Next Quarter)
- Add cancellation reason dropdown (optional)
- Bulk cancel by filter (e.g., "cancel all no-shows")
- Export cancelled bookings list
- Email notification to cancelled students

### 14.2 Long-term (6-12 months)
- Undo cancellation feature (within time window)
- Automatic cancellation based on rules
- Waitlist integration (auto-fill from waitlist)
- Cancellation analytics dashboard

---

## 15. Dependencies

### 15.1 Technical Dependencies
- HubSpot API (batch update operations)
- Redis cache (for invalidation)
- Existing authentication system
- Validation library (Joi)

### 15.2 Team Dependencies
- Backend developer for API implementation
- Frontend developer for UI components
- QA for testing
- Product owner for acceptance

### 15.3 External Dependencies
- HubSpot API availability
- Network connectivity
- Redis server availability

---

## 16. Open Questions

1. **Should we allow cancelling completed bookings?**
   - Recommendation: No, prevent cancelling after exam is completed
   - Rationale: Attendance already marked, cancellation doesn't make sense

2. **Should we send email notifications to cancelled students?**
   - Recommendation: Phase 2 feature
   - Rationale: Adds complexity, can be added later

3. **Should cancellation reason be required or optional?**
   - Recommendation: Optional for MVP
   - Rationale: Don't add friction, can be enhanced later

4. **Should we have a "cancel all" shortcut?**
   - Recommendation: No for MVP (too risky)
   - Rationale: Typed verification prevents this anyway

5. **How long should we keep cancelled booking data?**
   - Recommendation: Keep indefinitely (soft delete)
   - Rationale: Audit trail and reporting needs

---

## 17. Appendix

### A. Related Documents
- Mark Attendance Feature Specification
- Admin Dashboard PRD
- HubSpot Integration Documentation
- API Security Guidelines

### B. Wireframes
See `/design/mockups/booking-cancellation-flow.fig`

### C. API Contract
See Section 5.1 for complete API specification

### D. Component Tree
```
MockExamDetail
├── CancelBookingsButton
├── BookingsTable (with selection mode)
│   └── BookingRow (with checkbox)
└── CancelBookingsConfirmModal
    ├── SelectedBookingsList
    ├── TypedConfirmationInput
    └── ActionButtons
```

---

## 18. Approval

**Product Owner:** _________________________  Date: __________

**Engineering Lead:** _________________________  Date: __________

**QA Lead:** _________________________  Date: __________

---

**PRD Status:** Ready for Implementation
**Confidence Score:** 9/10
**Next Steps:** Begin Phase 1 development

