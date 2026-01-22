# Token Refund System - Product Requirements Document

**Version**: 1.0.0
**Date**: January 2025
**Status**: Draft
**Author**: System Architecture Team
**Stakeholders**: Admin Team, Support Team, Finance Team

---

## Executive Summary

### Overview
This PRD defines the implementation of an automated token refund system for booking cancellations. Currently, when bookings are cancelled (either by admins or through bulk operations), trainees permanently lose their booking tokens without any refund mechanism. This creates customer dissatisfaction, support burden, and fairness issues.

### Problem Statement
**Current State**: When a booking is cancelled:
- ✅ Booking status is updated to "Cancelled"
- ✅ Audit logs are created
- ✅ Caches are invalidated
- ❌ **Tokens are NOT refunded to the trainee**

**Impact**:
- Trainees lose tokens permanently when admins cancel sessions
- No mechanism to distinguish between user-initiated vs admin-initiated cancellations
- Manual token restoration creates support overhead
- No flexibility for scenarios where refunds should/shouldn't occur

### Solution
Implement an admin-controlled token refund system that:
1. **Provides UI toggle** for admins to choose whether to refund tokens (default: YES)
2. **Uses new `associated_contact_id` property** to identify which contact to refund
3. **Batch processes refunds** using HubSpot batch API to preserve rate limits
4. **Maintains audit trail** of all refund operations
5. **Supports both single and bulk cancellations** with the same refund logic

### Success Metrics
- **Primary**: 100% of admin-initiated cancellations offer refund option
- **Secondary**: <5% of refund operations fail due to technical issues
- **Tertiary**: 90% reduction in token-related support tickets

---

## Table of Contents
1. [Goals & Objectives](#goals--objectives)
2. [User Stories](#user-stories)
3. [Functional Requirements](#functional-requirements)
4. [Technical Architecture](#technical-architecture)
5. [API Design](#api-design)
6. [Data Model](#data-model)
7. [UI/UX Design](#uiux-design)
8. [Implementation Plan](#implementation-plan)
9. [Testing Strategy](#testing-strategy)
10. [Risk Assessment](#risk-assessment)

---

## Goals & Objectives

### Primary Goals
1. **Enable Token Refunds**: Provide automated token refund capability for cancelled bookings
2. **Admin Control**: Give admins flexibility to refund or not refund on a per-operation basis
3. **Batch Efficiency**: Use HubSpot batch APIs to minimize API calls and respect rate limits
4. **Audit Trail**: Maintain complete audit trail of all refund operations

### Secondary Goals
1. **Support Burden Reduction**: Reduce manual token restoration by support team
2. **Customer Satisfaction**: Improve trainee experience when cancellations occur
3. **System Reliability**: Ensure refunds are idempotent and handle partial failures gracefully

### Non-Goals (Out of Scope)
- ❌ Mock exam deletion functionality (handled separately - system prevents deletion of exams with active bookings)
- ❌ Automated refund policies based on cancellation reason
- ❌ Partial token refunds or token expiration logic
- ❌ User-facing self-service cancellation with refunds
- ❌ Refund notifications to trainees (future enhancement)

---

## User Stories

### Admin Users

**Story 1: Bulk Cancellation with Refund**
```
As an admin,
When I bulk cancel bookings for a mock exam,
I want to choose whether to refund tokens,
So that I can handle different cancellation scenarios appropriately.
```

**Acceptance Criteria**:
- [ ] Cancellation modal shows "Refund Tokens" toggle (default: ON)
- [ ] Refund status is displayed for each booking in results
- [ ] Failed refunds are clearly reported with error details
- [ ] Audit log reflects refund decisions and outcomes

**Story 2: Single Booking Cancellation**
```
As an admin,
When I cancel a single booking from the Mock Exam Detail page,
I want the option to refund the trainee's token,
So that the trainee is compensated for the cancellation.
```

**Acceptance Criteria**:
- [ ] Cancellation confirmation shows "Refund Token" checkbox (default: ON)
- [ ] Refund result is shown in success/error message
- [ ] Token refund is logged in booking audit trail

**Story 3: Review Refund History**
```
As an admin,
When I view a cancelled booking's audit log,
I want to see if tokens were refunded,
So that I can verify refund operations occurred correctly.
```

**Acceptance Criteria**:
- [ ] Audit log shows "Token Refunded: Yes/No"
- [ ] Refund details include token type and quantity
- [ ] Timestamp and admin email are recorded

### Support Team

**Story 4: Troubleshoot Failed Refunds**
```
As a support team member,
When a refund fails during cancellation,
I want clear error messages and logs,
So that I can manually resolve the issue or escalate.
```

**Acceptance Criteria**:
- [ ] Failed refunds show specific error codes
- [ ] Logs include contact ID, booking ID, token type, and error reason
- [ ] Failed bookings are clearly marked in cancellation results

---

## Functional Requirements

### FR-1: Refund Toggle in UI

**Priority**: P0 (Critical)

**Description**: Add a "Refund Tokens" toggle/checkbox to all cancellation interfaces.

**Specifications**:
- **Location**: Cancellation confirmation modals (bulk and single)
- **Default State**: Checked/Enabled (refund will occur)
- **Behavior**:
  - When enabled: Include `refundTokens: true` in API request
  - When disabled: Include `refundTokens: false` in API request
- **Visual Design**: Clear label with explanation tooltip

**Example**:
```
┌─────────────────────────────────────────┐
│  Cancel Booking(s)                      │
├─────────────────────────────────────────┤
│                                         │
│  ☑ Refund tokens to trainees            │
│     ⓘ Tokens will be automatically      │
│       added back to trainee accounts    │
│                                         │
│  [Cancel]  [Confirm Cancellation]      │
└─────────────────────────────────────────┘
```

---

### FR-2: Backend Token Refund Logic

**Priority**: P0 (Critical)

**Description**: Implement server-side token refund processing for cancelled bookings using booking data from frontend with lightweight validation.

**Specifications**:

#### Input Parameters
- `bookings`: Array of booking objects (from frontend)
- `refundTokens`: Boolean flag (default: true)

#### Optimization Strategy
**Frontend sends booking data it already has in memory** (fetched from bookings.js endpoint):
- Eliminates 1 large HubSpot API call (saves ~200ms)
- Frontend data is max 2 minutes old (cache TTL)
- Backend validates only critical state (`is_active`)
- Backend still controls all refund logic
- Safe for admin-only system (authenticated users)

#### Processing Steps

**Step 1: Receive Booking Data from Frontend**
```javascript
// Frontend sends full booking objects from memory
req.body = {
  bookings: [
    {
      id: '123',
      token_used: 'Mock Discussion Token',
      associated_contact_id: '1001',
      name: 'John Doe',
      email: 'john@example.com'
    }
  ],
  refundTokens: true
}
```

**Step 2: Lightweight Validation (Only Verify Current State)**
```javascript
// Validate only critical state: is_active
// Don't re-fetch all properties - trust frontend data
const bookingIds = bookings.map(b => b.id);

const statusCheck = await hubspot.apiCall('POST',
  `/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}/batch/read`, {
    properties: ['is_active'],  // Only 1 property - lightweight!
    inputs: bookingIds.map(id => ({ id }))
  }
);

// Validation Logic:
for (const booking of bookings) {
  const currentStatus = statusCheck.get(booking.id)?.properties.is_active;

  if (!currentStatus) {
    // Booking deleted since frontend loaded
    results.failed.push({ id: booking.id, error: 'Booking not found' });
    continue;
  }

  if (currentStatus === 'Cancelled') {
    // Already cancelled - idempotent
    results.skipped.push({ id: booking.id, reason: 'Already cancelled' });
    continue;
  }

  if (!booking.token_used || !booking.associated_contact_id) {
    // No token to refund
    results.skipped.push({ id: booking.id, reason: 'No token to refund' });
    continue;
  }

  // ✅ PASS: Use frontend data for refund processing
}
```

**Step 3: Group Refunds by Token Type**
```javascript
// Use token_used from frontend data to group by token type
// Use associated_contact_id from frontend data for contact IDs
{
  'mock_discussion_token': [
    { contactId: '1001', bookingId: '123', name: 'John Doe' },
    { contactId: '1002', bookingId: '456', name: 'Jane Smith' }
  ],
  'clinical_skills_token': [
    { contactId: '1003', bookingId: '789', name: 'Bob Johnson' }
  ]
}
```

**Step 4: Batch Fetch Current Token Values**
```javascript
// For each token type, batch fetch contact current token values
const currentTokens = await hubspot.apiCall('POST',
  `/crm/v3/objects/0-1/batch/read`, {
    properties: [tokenPropertyName],  // e.g., 'mock_discussion_token'
    inputs: contactIds.map(id => ({ id }))
  }
);
```

**Step 5: Calculate & Update Contact Token Properties**
```javascript
// Calculate new token values (increment by 1)
const updates = contacts.map(contact => ({
  id: contact.id,
  properties: {
    [tokenPropertyName]: currentValue + 1
  }
}));

// Batch update contacts (max 100 per request)
await hubspot.apiCall('POST',
  `/crm/v3/objects/0-1/batch/update`, {
    inputs: updates
  }
);
```

**Step 6: Update Booking Status with Refund Metadata**
```javascript
// Mark bookings as cancelled with refund tracking
await hubspot.apiCall('POST',
  `/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}/batch/update`, {
    inputs: bookings.map(b => ({
      id: b.id,
      properties: {
        is_active: 'Cancelled',
        token_refunded: refundTokens ? 'true' : 'false',
        token_refunded_at: Date.now(),
        token_refund_admin: adminEmail
      }
    }))
  }
);
```

**Step 7: Create Audit Log**
```javascript
// Use name/email from frontend data for audit logging
const noteContent = `
  🗑️ Batch Booking Cancellation

  Summary:
  • Cancelled: ${summary.cancelled}
  • Tokens Refunded: ${refundTokens ? 'Yes' : 'No'}
  ${refundTokens ? `• Refund Successes: ${refundResults.successful}
  • Refund Failures: ${refundResults.failed}` : ''}

  Cancelled Bookings:
  ${bookings.map(b => `• ${b.name} (${b.email})`).join('\n')}

  Cancelled By: ${adminEmail}
`;
```

---

### FR-3: Batch API Optimization

**Priority**: P0 (Critical)

**Description**: Ensure all refund operations use HubSpot batch APIs to minimize API calls.

**Specifications**:

#### Batch Limits
- **HubSpot Batch Limit**: 100 items per request
- **Rate Limit**: 100 requests per 10 seconds
- **Strategy**: Chunk operations into batches of 100

#### Chunking Logic
```javascript
// Example: Refund 250 bookings
// Chunk 1: Fetch bookings 1-100 (batch read)
// Chunk 2: Fetch bookings 101-200 (batch read)
// Chunk 3: Fetch bookings 201-250 (batch read)

// Then group all contacts by token type
// Chunk 1: Update contacts 1-100 (batch update)
// Chunk 2: Update contacts 101-150 (batch update)

// Finally update all booking statuses
// Chunk 1: Update bookings 1-100 (batch update)
// Chunk 2: Update bookings 101-200 (batch update)
// Chunk 3: Update bookings 201-250 (batch update)
```

#### Error Handling
- **Partial Failures**: Process successful items, log failed items
- **Retry Logic**: Exponential backoff for rate limit errors (429)
- **Idempotency**: Safe to retry entire operation

---

### FR-4: Token Type Mapping

**Priority**: P1 (High)

**Description**: Define mapping between `token_used` values and Contact property names.

**Specifications**:

#### Token Mapping Table
| `token_used` Value (Booking) | Contact Property Name | Notes |
|------------------------------|----------------------|-------|
| Mock Discussion Token | `mock_discussion_token` | Most common |
| Clinical Skills Token | `clinical_skills_token` | Future use |
| Situational Judgment Token | `situational_judgment_token` | Future use |
| Mini-mock Token | `mini_mock_token` | Future use |

#### Implementation
```javascript
const TOKEN_PROPERTY_MAP = {
  'Mock Discussion Token': 'mock_discussion_token',
  'Clinical Skills Token': 'clinical_skills_token',
  'Situational Judgment Token': 'situational_judgment_token',
  'Mini-mock Token': 'mini_mock_token'
};

function getTokenPropertyName(tokenUsedValue) {
  const propertyName = TOKEN_PROPERTY_MAP[tokenUsedValue];

  if (!propertyName) {
    throw new Error(`Unknown token type: ${tokenUsedValue}`);
  }

  return propertyName;
}
```

---

### FR-5: Refund Results Reporting

**Priority**: P1 (High)

**Description**: Provide detailed refund results in API response.

**Response Schema**:
```typescript
{
  success: true,
  data: {
    summary: {
      total: 100,
      cancelled: 95,
      failed: 5,
      skipped: 0
    },
    refundSummary: {
      enabled: true,
      successful: 90,
      failed: 5,
      skipped: 5,  // No token_used or already refunded
      byTokenType: {
        'mock_discussion_token': {
          contactsRefunded: 85,
          tokenCount: 85
        },
        'clinical_skills_token': {
          contactsRefunded: 5,
          tokenCount: 5
        }
      }
    },
    results: {
      successful: [
        {
          bookingId: "123",
          status: "cancelled",
          tokenRefunded: true,
          tokenType: "Mock Discussion Token",
          contactId: "456"
        }
      ],
      failed: [
        {
          bookingId: "789",
          error: "Contact not found",
          code: "CONTACT_NOT_FOUND",
          tokenRefunded: false
        }
      ]
    }
  }
}
```

---

## Technical Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Admin Frontend                          │
│  ┌──────────────────────┐  ┌──────────────────────────┐    │
│  │ MockExamDetail       │  │ CancellationModal        │    │
│  │ - Bulk Cancel Button │  │ - Refund Toggle (ON)     │    │
│  └──────────────────────┘  │ - Confirmation           │    │
│                             └──────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│              API: /admin/mock-exams/[id]/cancel-bookings    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 1. Receive Booking Data from Frontend               │  │
│  │ 2. Lightweight Validation (is_active only)          │  │
│  │ 3. Process Cancellations                             │  │
│  │ 4. IF refundTokens === true:                         │  │
│  │    ├─ Group by Token Type (from frontend data)      │  │
│  │    ├─ Batch Fetch Current Token Values              │  │
│  │    ├─ Calculate New Token Values                    │  │
│  │    ├─ Batch Update Contact Properties               │  │
│  │    └─ Track Refund Results                          │  │
│  │ 5. Update Booking Status (with refund metadata)     │  │
│  │ 6. Create Audit Log (using frontend names/emails)   │  │
│  │ 7. Invalidate Caches                                 │  │
│  │ 8. Return Detailed Results                           │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                      HubSpot CRM API                         │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ Bookings Object  │  │ Contacts Object  │                │
│  │ - Batch Read     │  │ - Batch Read     │                │
│  │ - Batch Update   │  │ - Batch Update   │                │
│  └──────────────────┘  └──────────────────┘                │
└─────────────────────────────────────────────────────────────┘
```

---

### Refund Processing Flow

```
START: Admin Initiates Cancellation
  │
  ├─ UI Presents Refund Toggle (default: ON)
  │
  └─ Admin Confirms
      │
      ▼
┌─────────────────────────────────────┐
│  API Receives Request               │
│  { bookings: [                      │
│      { id, token_used,              │
│        associated_contact_id,       │
│        name, email }                │
│    ],                               │
│    refundTokens: true/false }       │
└─────────────────────────────────────┘
      │
      ├─ Lightweight Validation (is_active only)
      │  └─ Verify booking exists & not already cancelled
      │
      ├─ Filter Out Already Cancelled (Idempotent)
      │
      ├─ Prepare Cancellation Updates
      │
      └─ IF refundTokens === true
          │
          ├─ Validate Each Booking for Refund
          │  ├─ Has token_used? ────────────── No ──→ Skip Refund
          │  ├─ Has associated_contact_id? ── No ──→ Log Error
          │  └─ Token already refunded? ───── Yes ─→ Skip Refund
          │
          ├─ Group Bookings by Token Type
          │  └─ { 'mock_discussion_token': [contact_ids] }
          │
          ├─ For Each Token Type:
          │  │
          │  ├─ Batch Fetch Contact Current Token Values
          │  │  └─ GET /contacts/batch/read
          │  │      properties: [tokenPropertyName]
          │  │
          │  ├─ Calculate New Token Values
          │  │  └─ newValue = currentValue + 1
          │  │
          │  └─ Batch Update Contact Token Properties
          │     └─ POST /contacts/batch/update
          │         inputs: [{ id, properties: {token: newValue} }]
          │
          └─ Collect Refund Results
             ├─ Successful: [{contactId, tokenType, oldValue, newValue}]
             └─ Failed: [{contactId, error, code}]
      │
      ├─ Batch Update Booking Status
      │  └─ POST /bookings/batch/update
      │      inputs: [{
      │        id: bookingId,
      │        properties: {
      │          is_active: 'Cancelled',
      │          token_refunded: refundTokens ? 'true' : 'false',
      │          token_refunded_at: timestamp
      │        }
      │      }]
      │
      ├─ Create Enhanced Audit Log
      │  └─ Include refund summary and results
      │
      ├─ Invalidate Caches
      │
      └─ Return Detailed Response
         └─ { summary, refundSummary, results }
```

---

## API Design

### Endpoint: PATCH /api/admin/mock-exams/[id]/cancel-bookings

**Purpose**: Cancel bookings with optional token refund

**Request**:
```json
{
  "bookings": [
    {
      "id": "booking_id_1",
      "token_used": "Mock Discussion Token",
      "associated_contact_id": "1001",
      "name": "John Doe",
      "email": "john@example.com"
    },
    {
      "id": "booking_id_2",
      "token_used": "Clinical Skills Token",
      "associated_contact_id": "1002",
      "name": "Jane Smith",
      "email": "jane@example.com"
    }
  ],
  "refundTokens": true  // Optional, default true
}
```

**Note**: Frontend sends full booking objects from memory to optimize API calls. Backend validates only critical state (`is_active`).

**Response (Success)**:
```json
{
  "success": true,
  "data": {
    "summary": {
      "total": 10,
      "cancelled": 9,
      "failed": 1,
      "skipped": 0
    },
    "refundSummary": {
      "enabled": true,
      "successful": 8,
      "failed": 1,
      "skipped": 1,
      "byTokenType": {
        "mock_discussion_token": {
          "contactsRefunded": 8,
          "tokenCount": 8,
          "failedContacts": 1
        }
      },
      "details": {
        "successful": [
          {
            "bookingId": "123",
            "contactId": "456",
            "tokenType": "mock_discussion_token",
            "previousValue": 5,
            "newValue": 6
          }
        ],
        "failed": [
          {
            "bookingId": "789",
            "contactId": "999",
            "tokenType": "mock_discussion_token",
            "error": "Contact not found in HubSpot",
            "code": "CONTACT_NOT_FOUND"
          }
        ],
        "skipped": [
          {
            "bookingId": "111",
            "reason": "No token used for this booking"
          }
        ]
      }
    },
    "results": {
      "successful": [...],
      "failed": [...],
      "skipped": [...]
    }
  },
  "meta": {
    "timestamp": "2025-01-14T10:30:00Z",
    "processedBy": "admin@prepdoctors.com",
    "mockExamId": "mock_exam_123",
    "executionTime": 2340
  }
}
```

**Error Response**:
```json
{
  "success": false,
  "error": {
    "code": "PARTIAL_REFUND_FAILURE",
    "message": "Bookings cancelled but some token refunds failed",
    "details": {
      "cancelledBookings": 10,
      "failedRefunds": 3,
      "errors": [
        {
          "bookingId": "123",
          "contactId": "456",
          "error": "Contact property 'mock_discussion_token' not found"
        }
      ]
    }
  }
}
```

---

### Endpoint: PATCH /api/admin/mock-exams/[id]/bookings/[bookingId]/cancel

**Purpose**: Cancel single booking with optional token refund

**Request**:
```json
{
  "refundToken": true  // NEW: Optional, default true
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "bookingId": "123",
    "status": "cancelled",
    "tokenRefund": {
      "refunded": true,
      "contactId": "456",
      "tokenType": "mock_discussion_token",
      "previousValue": 5,
      "newValue": 6
    }
  }
}
```

---

## Data Model

### Booking Object Properties

**Existing Properties**:
- `is_active` - "Active" | "Cancelled" | "Completed"
- `booking_status` - Status enum
- `token_used` - String (e.g., "Mock Discussion Token")
- `associated_contact_id` - Contact hs_object_id (NEW)

**New Properties for Refund Tracking**:
```javascript
{
  token_refunded: 'true' | 'false',  // NEW: Track if refund occurred
  token_refunded_at: '1705234567000', // NEW: Timestamp of refund
  token_refund_admin: 'admin@example.com' // NEW: Who processed refund
}
```

### Contact Object Properties

**Token Properties** (Existing):
- `mock_discussion_token` - Integer (available token count)
- `clinical_skills_token` - Integer
- `situational_judgment_token` - Integer
- `mini_mock_token` - Integer

**Usage**: Increment by 1 when refunding

---

## UI/UX Design

### Bulk Cancellation Modal

**Before (Current)**:
```
┌─────────────────────────────────────────┐
│  Cancel Selected Bookings?              │
├─────────────────────────────────────────┤
│                                         │
│  This will cancel 15 bookings.          │
│  This action cannot be undone.          │
│                                         │
│  [Cancel]  [Confirm]                    │
└─────────────────────────────────────────┘
```

**After (New)**:
```
┌─────────────────────────────────────────┐
│  Cancel Selected Bookings?              │
├─────────────────────────────────────────┤
│                                         │
│  This will cancel 15 bookings.          │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │ ☑ Refund tokens to trainees       │ │
│  │   ⓘ Booking tokens will be auto-  │ │
│  │     matically returned to trainee │ │
│  │     accounts                       │ │
│  └───────────────────────────────────┘ │
│                                         │
│  [Cancel]  [Confirm Cancellation]      │
└─────────────────────────────────────────┘
```

---

### Results Display

**Success with Refunds**:
```
┌─────────────────────────────────────────┐
│  ✅ Cancellation Complete               │
├─────────────────────────────────────────┤
│                                         │
│  Summary:                                │
│  • 15 bookings cancelled                │
│  • 15 tokens refunded                   │
│                                         │
│  Token Refunds:                          │
│  • Mock Discussion Token: 15            │
│                                         │
│  [Close]                                │
└─────────────────────────────────────────┘
```

**Partial Failure**:
```
┌─────────────────────────────────────────┐
│  ⚠️ Cancellation Completed with Errors │
├─────────────────────────────────────────┤
│                                         │
│  Summary:                                │
│  • 15 bookings cancelled                │
│  • 12 tokens refunded                   │
│  • 3 refunds failed                     │
│                                         │
│  Failed Refunds:                         │
│  • John Doe - Contact not found         │
│  • Jane Smith - Token property missing  │
│  • Bob Johnson - API error              │
│                                         │
│  [View Details]  [Close]                │
└─────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Backend Foundation (Week 1)

**Tasks**:
1. ✅ Add new Booking properties: `token_refunded`, `token_refunded_at`, `token_refund_admin`
2. ✅ Implement token mapping logic (`TOKEN_PROPERTY_MAP`)
3. ✅ Create `RefundService` class with core refund methods:
   - `validateRefundEligibility(booking)`
   - `groupBookingsByTokenType(bookings)`
   - `batchRefundTokens(contactTokenMap)`
   - `updateBookingRefundStatus(bookings)`

**Deliverables**:
- [ ] `admin_root/api/_shared/refund.js` - RefundService implementation
- [ ] Unit tests for refund logic
- [ ] HubSpot property schema updates documented

---

### Phase 2: API Integration (Week 1-2)

**Tasks**:
1. ✅ Modify `cancel-bookings.js` endpoint:
   - Add `refundTokens` parameter (default: true)
   - Integrate RefundService
   - Update response schema with refund results
2. ✅ Add single booking cancellation endpoint with refund
3. ✅ Implement batch optimization (chunking logic)
4. ✅ Add comprehensive error handling
5. ✅ Enhance audit logging with refund information

**Deliverables**:
- [ ] Updated `cancel-bookings.js` with refund logic
- [ ] New `cancel-booking.js` for single cancellations
- [ ] Integration tests for refund flows
- [ ] Error handling documentation

---

### Phase 3: Frontend UI (Week 2)

**Tasks**:
1. ✅ Add "Refund Tokens" toggle to `CancellationModal` component
2. ✅ Update `useCancellation` hook to include `refundTokens` parameter
3. ✅ Enhance results display with refund summary
4. ✅ Add loading states and error messages for refunds
5. ✅ Update confirmation text based on toggle state

**Deliverables**:
- [ ] Updated `CancellationModal.jsx`
- [ ] Updated `useCancellation.js` hook
- [ ] Enhanced results UI components
- [ ] Frontend unit tests

---

### Phase 4: Testing & Validation (Week 2-3)

**Tasks**:
1. ✅ End-to-end testing with test HubSpot data
2. ✅ Performance testing with large batches (100+ bookings)
3. ✅ Error scenario testing:
   - Missing `associated_contact_id`
   - Invalid token types
   - HubSpot API failures
   - Partial batch failures
4. ✅ Idempotency testing (retry scenarios)

**Deliverables**:
- [ ] Test plan document
- [ ] Test results report
- [ ] Performance benchmarks

---

### Phase 5: Documentation & Deployment (Week 3)

**Tasks**:
1. ✅ Update API documentation
2. ✅ Create admin user guide
3. ✅ Update support team runbook
4. ✅ Deploy to staging environment
5. ✅ Conduct UAT with admin team
6. ✅ Production deployment

**Deliverables**:
- [ ] API documentation updates
- [ ] Admin user guide
- [ ] Support team documentation
- [ ] Deployment checklist

---

## Testing Strategy

### Unit Tests

**RefundService Tests**:
```javascript
describe('RefundService', () => {
  test('validateRefundEligibility - valid booking', () => {
    const booking = {
      properties: {
        is_active: 'Active',
        token_used: 'Mock Discussion Token',
        associated_contact_id: '123'
      }
    };
    expect(RefundService.validateRefundEligibility(booking)).toBe(true);
  });

  test('validateRefundEligibility - already cancelled', () => {
    const booking = {
      properties: {
        is_active: 'Cancelled',
        token_used: 'Mock Discussion Token',
        associated_contact_id: '123'
      }
    };
    expect(RefundService.validateRefundEligibility(booking)).toBe(false);
  });

  test('groupBookingsByTokenType - groups correctly', () => {
    const bookings = [
      { id: '1', token_used: 'Mock Discussion Token', contact: '123' },
      { id: '2', token_used: 'Mock Discussion Token', contact: '456' },
      { id: '3', token_used: 'Clinical Skills Token', contact: '789' }
    ];

    const result = RefundService.groupBookingsByTokenType(bookings);

    expect(result).toEqual({
      'mock_discussion_token': [
        { contactId: '123', bookingId: '1' },
        { contactId: '456', bookingId: '2' }
      ],
      'clinical_skills_token': [
        { contactId: '789', bookingId: '3' }
      ]
    });
  });
});
```

---

### Integration Tests

**Cancellation with Refund Test**:
```javascript
describe('POST /api/admin/mock-exams/[id]/cancel-bookings', () => {
  test('successfully cancels and refunds tokens', async () => {
    const response = await request(app)
      .patch('/api/admin/mock-exams/123/cancel-bookings')
      .send({
        bookingIds: ['booking_1', 'booking_2'],
        refundTokens: true
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.refundSummary.enabled).toBe(true);
    expect(response.body.data.refundSummary.successful).toBe(2);

    // Verify contacts were updated
    const contact = await hubspot.getContact('contact_1');
    expect(contact.properties.mock_discussion_token).toBe('6'); // Was 5
  });

  test('handles partial refund failures gracefully', async () => {
    // Setup: One valid contact, one invalid contact ID
    const response = await request(app)
      .patch('/api/admin/mock-exams/123/cancel-bookings')
      .send({
        bookingIds: ['booking_valid', 'booking_invalid_contact'],
        refundTokens: true
      })
      .expect(200);

    expect(response.body.data.refundSummary.successful).toBe(1);
    expect(response.body.data.refundSummary.failed).toBe(1);
    expect(response.body.data.refundSummary.details.failed).toHaveLength(1);
  });
});
```

---

### Manual Testing Checklist

**Scenario 1: Bulk Cancellation with Refund**
- [ ] Select 10 bookings for cancellation
- [ ] Ensure "Refund Tokens" is checked (default)
- [ ] Confirm cancellation
- [ ] Verify success message shows refund count
- [ ] Check HubSpot: Bookings marked as cancelled
- [ ] Check HubSpot: Contact token values incremented
- [ ] Check HubSpot: Audit note created with refund info

**Scenario 2: Bulk Cancellation without Refund**
- [ ] Select 5 bookings for cancellation
- [ ] Uncheck "Refund Tokens"
- [ ] Confirm cancellation
- [ ] Verify success message indicates no refunds
- [ ] Check HubSpot: Bookings marked as cancelled
- [ ] Check HubSpot: Contact token values unchanged

**Scenario 3: Mixed Token Types**
- [ ] Select bookings with different token types
- [ ] Confirm cancellation with refund enabled
- [ ] Verify refund summary groups by token type
- [ ] Check HubSpot: Each contact's appropriate token incremented

**Scenario 4: Error Handling**
- [ ] Cancel booking with missing `associated_contact_id`
- [ ] Verify error message is clear and specific
- [ ] Check that other bookings in batch are still processed

---

## Risk Assessment

### High Risks

**Risk 1: Data Inconsistency**
- **Description**: Bookings cancelled but tokens not refunded due to API failure
- **Impact**: Trainees lose tokens, support overhead increases
- **Mitigation**:
  - Implement transaction-like logic with rollback capability
  - Log all failed refunds for manual resolution
  - Provide admin UI to view and retry failed refunds
- **Probability**: Medium | **Impact**: High

**Risk 2: Performance Issues with Large Batches**
- **Description**: Processing 100+ bookings causes timeout
- **Impact**: Admin cannot cancel large batches
- **Mitigation**:
  - Use HubSpot batch APIs (100 items max)
  - Implement progress indicators for long operations
  - Consider async processing for very large batches (future)
- **Probability**: Low | **Impact**: Medium

**Risk 3: Token Type Mismatch**
- **Description**: `token_used` value doesn't match any Contact property
- **Impact**: Refund fails, tokens not returned
- **Mitigation**:
  - Validate token types against mapping table
  - Log unknown token types for investigation
  - Provide clear error messages
  - Support team can manually refund
- **Probability**: Low | **Impact**: Medium

---

### Medium Risks

**Risk 4: HubSpot Rate Limiting**
- **Description**: Batch operations hit HubSpot API rate limits
- **Impact**: Some refunds fail temporarily
- **Mitigation**:
  - Implement exponential backoff retry logic
  - Monitor API usage and optimize batching
  - Consider queueing system for very large operations (future)
- **Probability**: Low | **Impact**: Low

**Risk 5: Admin User Error**
- **Description**: Admin accidentally cancels bookings without refund
- **Impact**: Trainees don't get tokens back
- **Mitigation**:
  - Default toggle to "Refund Enabled"
  - Add confirmation step highlighting refund status
  - Audit log tracks admin decision
  - Support can manually refund if needed
- **Probability**: Medium | **Impact**: Low

---

## Success Metrics

### Primary KPIs

**1. Refund Success Rate**
- **Target**: >95% of refund operations succeed
- **Measurement**: `(successful_refunds / total_refund_attempts) * 100`
- **Tracking**: API response logs, monitoring dashboard

**2. Token Refund Coverage**
- **Target**: 100% of admin cancellations offer refund option
- **Measurement**: UI analytics, feature flag monitoring
- **Tracking**: Frontend event tracking

**3. Support Ticket Reduction**
- **Target**: 90% reduction in token-related support tickets
- **Measurement**: Compare ticket volume pre/post deployment
- **Tracking**: Support ticket system tags

---

### Secondary KPIs

**4. Batch Operation Performance**
- **Target**: <5s for batches of 100 bookings
- **Measurement**: `executionTime` in API responses
- **Tracking**: Performance monitoring logs

**5. Partial Failure Rate**
- **Target**: <5% of batch operations have partial failures
- **Measurement**: `(batches_with_failures / total_batches) * 100`
- **Tracking**: Error logs, monitoring dashboard

**6. Admin Adoption Rate**
- **Target**: >80% of cancellations use new refund system
- **Measurement**: Feature usage analytics
- **Tracking**: Frontend event tracking

---

## Appendix

### A. Token Property Reference

| Token Display Name | HubSpot Property Name | Object Type |
|-------------------|----------------------|-------------|
| Mock Discussion Token | `mock_discussion_token` | Contact (0-1) |
| Clinical Skills Token | `clinical_skills_token` | Contact (0-1) |
| Situational Judgment Token | `situational_judgment_token` | Contact (0-1) |
| Mini-mock Token | `mini_mock_token` | Contact (0-1) |

---

### B. HubSpot Batch API Limits

| Operation | Max Items per Request | Rate Limit |
|-----------|----------------------|------------|
| Batch Read | 100 | 100 requests / 10s |
| Batch Update | 100 | 100 requests / 10s |
| Batch Create | 100 | 100 requests / 10s |

**Best Practices**:
- Chunk operations into groups of 100
- Implement retry with exponential backoff for 429 errors
- Monitor API usage to stay within limits

---

### C. Error Codes

| Code | Description | Resolution |
|------|-------------|------------|
| `CONTACT_NOT_FOUND` | Contact ID doesn't exist in HubSpot | Log error, skip refund, notify support |
| `TOKEN_PROPERTY_NOT_FOUND` | Contact missing token property | Log error, create property, retry |
| `INVALID_TOKEN_TYPE` | Unknown token type in `token_used` | Log error, update mapping, manual refund |
| `REFUND_ALREADY_PROCESSED` | Booking already has refund | Skip (idempotent) |
| `HUBSPOT_API_ERROR` | HubSpot API failure | Retry with backoff, log for manual resolution |
| `BATCH_SIZE_EXCEEDED` | Too many bookings in single request | Split into smaller batches |

---

### D. Audit Log Format

**Enhanced Note Template**:
```html
<strong>🗑️ Batch Booking Cancellation</strong>
<hr/>
<strong>Summary:</strong>
• Total Processed: 15
• Successfully Cancelled: 15
• Failed: 0
• Skipped (already cancelled): 0

<strong>Token Refunds:</strong>
• Refund Enabled: Yes
• Successfully Refunded: 14
• Failed Refunds: 1
• Skipped (no token): 0

<strong>Refund Details by Token Type:</strong>
• Mock Discussion Token: 14 contacts refunded

<strong>Failed Refunds:</strong>
• Booking #123 (John Doe) - Contact not found

<strong>Cancelled Bookings:</strong>
• Jane Smith (jane@example.com)
• Bob Johnson (bob@example.com)
• ... and 13 more

<strong>Cancelled By:</strong> admin@prepdoctors.com
<strong>Timestamp:</strong> 2025-01-14T10:30:00Z
```

---

### E. Future Enhancements (Post-MVP)

**Phase 2 Features**:
1. **Automated Refund Notifications**: Email trainees when tokens are refunded
2. **Refund Retry UI**: Admin interface to retry failed refunds
3. **Partial Token Refunds**: Support fractional refunds (e.g., 0.5 tokens)
4. **Token Expiration Logic**: Set expiration dates on refunded tokens
5. **Refund Analytics Dashboard**: Track refund metrics over time
6. **Webhook Support**: Trigger external systems on refund events

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-01-14 | System Architecture Team | Initial PRD creation |

---

## Approval & Sign-Off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Product Owner | [Pending] | | |
| Tech Lead | [Pending] | | |
| Admin Team Lead | [Pending] | | |
| Support Team Lead | [Pending] | | |

---

**End of Document**
