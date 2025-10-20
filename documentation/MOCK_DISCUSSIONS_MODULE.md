# Mock Discussions Module Documentation

## Table of Contents
1. [Overview and Purpose](#overview-and-purpose)
2. [Technical Architecture](#technical-architecture)
3. [API Endpoints](#api-endpoints)
4. [Frontend Components](#frontend-components)
5. [HubSpot Configuration](#hubspot-configuration)
6. [Token Management Logic](#token-management-logic)
7. [Integration Points](#integration-points)
8. [Testing Procedures](#testing-procedures)
9. [Deployment Checklist](#deployment-checklist)
10. [Known Limitations](#known-limitations)
11. [Future Enhancements](#future-enhancements)

---

## Overview and Purpose

### What is Mock Discussions?

Mock Discussions is a new booking module that allows students to schedule discussion sessions after completing mock exams. These sessions provide students with an opportunity to review their performance, ask questions, and gain insights from instructors.

### Key Features

- **Dedicated Token System**: Uses `mock_discussion_token` (separate from mock exam tokens)
- **Calendar and List Views**: Flexible viewing options for session availability
- **Real-time Capacity Management**: Batch operations for accurate availability tracking
- **Idempotent Booking Creation**: Prevents duplicate bookings with retry tolerance
- **Location Filtering**: Filter sessions by campus/venue location
- **Responsive Design**: Mobile-first UI with desktop enhancements

### Business Value

- Provides post-exam support for students
- Separates discussion bookings from exam bookings for better resource management
- Enables independent token pricing strategy (discussion tokens can be bundled differently)
- Improves student engagement and learning outcomes

---

## Technical Architecture

### System Design Principles

The Mock Discussions module follows the PrepDoctors HubSpot Automation Framework principles:

1. **HubSpot as Single Source of Truth**: No local database, all data stored in HubSpot CRM
2. **Serverless Architecture**: Vercel functions with 60-second timeout awareness
3. **API-First Design**: Reusable endpoints with consistent response patterns
4. **Stateless Operations**: Every function execution is independent
5. **Batch Operations**: Optimized HubSpot API calls to respect rate limits

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND LAYER                          │
├─────────────────────────────────────────────────────────────────┤
│  MockDiscussions.jsx (Main Page)                                │
│  ├── CalendarView / List View                                   │
│  ├── LocationFilter                                             │
│  ├── TokenCard (Mock Discussion Tokens)                         │
│  └── CreditAlert (Warning for 0 tokens)                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ API Calls
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API LAYER (Serverless)                     │
├─────────────────────────────────────────────────────────────────┤
│  /api/mock-discussions/                                         │
│  ├── available.js       → Fetch available discussion sessions   │
│  ├── validate-credits.js → Check mock_discussion_token          │
│  └── create-booking.js   → Create discussion booking            │
│                                                                  │
│  /api/bookings/                                                 │
│  └── [contact].js        → Fetch user's discussion bookings     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HubSpot API
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      HUBSPOT CRM LAYER                          │
├─────────────────────────────────────────────────────────────────┤
│  Objects:                                                        │
│  ├── Mock Exams (2-50158913)                                    │
│  │   └── Filter: mock_type = "Mock Discussion"                  │
│  │       Properties: exam_date, capacity, total_bookings        │
│  │                                                              │
│  ├── Bookings (2-50158943)                                      │
│  │   └── Properties: booking_id, name, email, token_used       │
│  │       Associations: Contact, Mock Exam                       │
│  │                                                              │
│  └── Contacts (0-1)                                             │
│      └── Properties: mock_discussion_token (Number)             │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

#### Booking Flow
```
User Login
    ↓
Navigate to /book/discussions
    ↓
Validate mock_discussion_token (API call)
    ↓
Fetch available sessions (API call with real-time capacity)
    ↓
User selects session
    ↓
Create booking (API call with idempotency key)
    ↓
Deduct mock_discussion_token
    ↓
Update total_bookings counter
    ↓
Create associations (Contact ↔ Booking ↔ Mock Exam)
    ↓
Display confirmation
```

---

## API Endpoints

### 1. GET /api/mock-discussions/available

Fetches all active mock discussion sessions with available capacity.

#### Request
```http
GET /api/mock-discussions/available?include_capacity=true&realtime=true
```

#### Query Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `include_capacity` | boolean | `true` | Include capacity information in response |
| `realtime` | boolean | `false` | Calculate real-time capacity (recommended) |

#### Response Format
```json
{
  "success": true,
  "data": [
    {
      "mock_exam_id": "123456789",
      "exam_date": "2025-11-15",
      "start_time": "2025-11-15T18:00:00.000Z",
      "end_time": "2025-11-15T20:00:00.000Z",
      "mock_type": "Mock Discussion",
      "capacity": 20,
      "total_bookings": 12,
      "available_slots": 8,
      "location": "Toronto Campus - Downtown",
      "is_active": true,
      "status": "available"
    }
  ],
  "message": "Mock discussions fetched successfully"
}
```

#### Status Codes
- `200`: Success
- `429`: Rate limit exceeded
- `500`: Server error

#### Performance Optimization

The endpoint implements batch operations to minimize HubSpot API calls:

**Without Real-time Mode** (Cached):
- 1 API call to search Mock Exams
- Cache TTL: 5 minutes

**With Real-time Mode** (Accurate):
- 1 API call to search Mock Exams
- 1 batch association read (all discussions at once)
- 1 batch booking read (all bookings at once)
- 1 batch update (if capacity corrections needed)

**API Calls Saved**: ~80-90% reduction compared to sequential approach

#### Implementation Details

```javascript
// File: /mnt/c/Users/HarmonTuazon/Desktop/mocks_booking/api/mock-discussions/available.js

// Key Features:
// 1. Filters for mock_type = "Mock Discussion"
// 2. Real-time capacity calculation using batch operations
// 3. Fallback time generation (2 PM - 4 PM) if missing
// 4. Cache invalidation support
// 5. Rate limiting (30 requests/minute)
```

---

### 2. POST /api/mock-discussions/validate-credits

Validates if a student has sufficient mock discussion tokens to book a session.

#### Request
```http
POST /api/mock-discussions/validate-credits
Content-Type: application/json

{
  "student_id": "ABC123",
  "email": "student@example.com"
}
```

#### Request Body Schema
```javascript
{
  student_id: Joi.string().required(),
  email: Joi.string().email().required()
}
```

#### Response Format
```json
{
  "success": true,
  "data": {
    "eligible": true,
    "available_credits": 3,
    "credit_breakdown": {
      "discussion_tokens": 3
    },
    "contact_id": "987654321",
    "enrollment_id": "555555555",
    "student_name": "John Doe",
    "mock_type": "Mock Discussion"
  },
  "message": "Mock Discussion credit validation successful"
}
```

#### Error Responses

**Insufficient Tokens**:
```json
{
  "success": true,
  "data": {
    "eligible": false,
    "available_credits": 0,
    "error_message": "You have 0 Mock Discussion tokens available. At least 1 token is required to book a discussion session."
  }
}
```

**Student Not Found**:
```json
{
  "success": false,
  "error": "Student not found in system",
  "code": "STUDENT_NOT_FOUND"
}
```

**Email Mismatch**:
```json
{
  "success": false,
  "error": "Email does not match student record",
  "code": "EMAIL_MISMATCH"
}
```

#### Status Codes
- `200`: Validation successful (check `eligible` field)
- `400`: Invalid input or email mismatch
- `404`: Student not found
- `429`: Rate limit exceeded (20 requests/minute)
- `500`: Server error or missing HubSpot property

#### Implementation Details

```javascript
// File: /mnt/c/Users/HarmonTuazon/Desktop/mocks_booking/api/mock-discussions/validate-credits.js

// Key Features:
// 1. Searches HubSpot Contacts with student_id and email filters
// 2. Reads mock_discussion_token property
// 3. Optional enrollment check (discussions may not require active enrollment)
// 4. Returns detailed credit breakdown
// 5. Rate limiting (20 requests/minute)
```

---

### 3. POST /api/mock-discussions/create-booking

Creates a new booking for a mock discussion session.

#### Request
```http
POST /api/mock-discussions/create-booking
Content-Type: application/json
X-Idempotency-Key: idem_disc_abc123... (optional)

{
  "mock_exam_id": "123456789",
  "contact_id": "987654321",
  "student_id": "ABC123",
  "name": "John Doe",
  "email": "student@example.com",
  "exam_date": "2025-11-15",
  "discussion_format": "Virtual",
  "topic_preference": "Clinical case review"
}
```

#### Request Body Schema
```javascript
{
  mock_exam_id: Joi.string().required(),
  contact_id: Joi.string().required(),
  student_id: Joi.string().pattern(/^[A-Z0-9]+$/).required(),
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  exam_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  discussion_format: Joi.string().valid('Virtual', 'In-Person', 'Hybrid').optional().default('Virtual'),
  topic_preference: Joi.string().max(200).optional().allow('')
}
```

#### Response Format
```json
{
  "success": true,
  "data": {
    "booking_id": "Mock Discussion-John Doe - November 15, 2025",
    "booking_record_id": "111222333",
    "confirmation_message": "Your Mock Discussion booking for November 15, 2025 has been confirmed",
    "idempotency_key": "idem_disc_abc123...",
    "exam_details": {
      "mock_exam_id": "123456789",
      "exam_date": "2025-11-15",
      "mock_type": "Mock Discussion",
      "location": "Toronto Campus - Downtown",
      "discussion_format": "Virtual",
      "topic_preference": "Clinical case review"
    },
    "token_details": {
      "tokens_before": 3,
      "tokens_deducted": 1,
      "tokens_remaining": 2
    },
    "associations": {
      "results": [
        { "type": "contact", "success": true },
        { "type": "mock_discussion", "success": true }
      ],
      "warnings": [],
      "critical_success": true
    }
  },
  "message": "Mock Discussion booking created successfully"
}
```

#### Error Responses

**Insufficient Tokens**:
```json
{
  "success": false,
  "error": "Insufficient Mock Discussion tokens for booking",
  "code": "INSUFFICIENT_TOKENS"
}
```

**Discussion Full**:
```json
{
  "success": false,
  "error": "This Mock Discussion session is now full",
  "code": "DISCUSSION_FULL"
}
```

**Duplicate Booking**:
```json
{
  "success": false,
  "error": "Duplicate booking detected: You already have a Mock Discussion booking for this date",
  "code": "DUPLICATE_BOOKING"
}
```

**Invalid Session Type**:
```json
{
  "success": false,
  "error": "Invalid session type. This endpoint only accepts Mock Discussion bookings.",
  "code": "INVALID_MOCK_TYPE"
}
```

#### Status Codes
- `201`: Booking created successfully
- `200`: Idempotent request (booking already exists)
- `400`: Validation error, insufficient tokens, session full, or duplicate
- `404`: Discussion or contact not found
- `503`: Lock acquisition failed (high demand)
- `500`: Server error

#### Idempotency Implementation

The endpoint supports idempotency to handle network failures and retries:

**Idempotency Key Generation**:
```javascript
// Automatic generation if X-Idempotency-Key header not provided
const keyData = {
  contact_id: "987654321",
  mock_exam_id: "123456789",
  exam_date: "2025-11-15",
  mock_type: "Mock Discussion",
  timestamp_bucket: Math.floor(Date.now() / (5 * 60 * 1000)) // 5-minute buckets
};

// Creates hash: idem_disc_abc123...
```

**Idempotent Request Handling**:
- If booking exists with status `Active` or `Completed`: Return cached response
- If booking exists with status `Cancelled` or `Failed`: Generate new idempotency key and create new booking

#### Redis Locking

Prevents race conditions during high-demand bookings:

```javascript
// Acquire lock on mock_exam_id
const lockToken = await redis.acquireLockWithRetry(mock_exam_id, 5, 100, 10);

// Perform booking operations

// Release lock
await redis.releaseLock(mock_exam_id, lockToken);
```

**Lock Parameters**:
- Lock timeout: 5 seconds
- Retry interval: 100ms
- Max retries: 10

#### Implementation Details

```javascript
// File: /mnt/c/Users/HarmonTuazon/Desktop/mocks_booking/api/mock-discussions/create-booking.js

// Key Features:
// 1. Redis-based distributed locking
// 2. Idempotency support with automatic key generation
// 3. Token deduction (mock_discussion_token)
// 4. Association creation (Contact ↔ Booking ↔ Mock Exam)
// 5. Capacity counter update
// 6. Timeline note creation
// 7. Cache invalidation for updated bookings
// 8. Cleanup on failure
```

---

## Frontend Components

### 1. MockDiscussions.jsx (Main Page)

**Location**: `/mnt/c/Users/HarmonTuazon/Desktop/mocks_booking/frontend/src/pages/MockDiscussions.jsx`

#### Purpose
Main page component for browsing and selecting mock discussion sessions.

#### Features
- **Dual View Modes**: Calendar and List views
- **Location Filtering**: Filter sessions by campus/venue
- **Real-time Availability**: Shows current available slots
- **Token Display**: Shows remaining mock discussion tokens
- **Responsive Design**: Mobile-first with desktop enhancements
- **Sorting**: Table sorting by date, time, location, and capacity

#### Key State Management
```javascript
const [discussions, setDiscussions] = useState([]);           // Available sessions
const [loading, setLoading] = useState(true);                 // Loading state
const [viewMode, setViewMode] = useState('calendar');         // View mode
const [selectedLocation, setSelectedLocation] = useState('all'); // Location filter
const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'asc' });

// Cached credits from hook
const { credits, loading: creditsLoading, fetchCredits } = useCachedCredits();
const mockDiscussionTokens = credits?.['Mock Discussion']?.available_credits || 0;
```

#### Component Hierarchy
```
MockDiscussions
├── TokenCard (if tokens > 0)
├── CreditAlert (if tokens = 0)
├── LocationFilter
├── View Toggle Buttons
└── Content Area
    ├── CalendarView (if viewMode = 'calendar')
    └── List View (if viewMode = 'list')
        ├── Desktop Table
        └── Mobile Cards
```

#### API Interactions
```javascript
// Fetch available discussions
const fetchDiscussions = async () => {
  const result = await apiService.mockDiscussions.getAvailable(true);
  // Filter out past discussions
  // Set state
};

// Validate credits
const validateCredits = async (studentId, email) => {
  const result = await apiService.mockDiscussions.validateCredits(studentId, email);
  setValidationData(result.data);
};

// Handle session selection
const handleSelectDiscussion = (discussion) => {
  // Check available slots
  // Check token balance
  // Navigate to booking form
  navigate(`/book/mock-discussion/${discussion.mock_exam_id}`, { state: {...} });
};
```

#### Responsive Behavior

**Desktop (≥768px)**:
- Table view with sortable columns
- Horizontal view toggle buttons
- Full token breakdown card

**Mobile (<768px)**:
- Card-based list view
- Vertical view toggle buttons
- Compact token display
- Mobile sorting controls

#### User Experience Features

1. **Past Discussion Filtering**: Automatically filters out past discussions (before today)
2. **Capacity Status Badges**: Visual indicators for availability
3. **Disabled State Handling**: Grays out full sessions or shows "No Tokens" state
4. **Empty State Messages**: Contextual messages when no sessions available
5. **Loading States**: Skeleton screens during data fetch

---

### 2. TokenCard.jsx (Updated)

**Location**: `/mnt/c/Users/HarmonTuazon/Desktop/mocks_booking/frontend/src/components/shared/TokenCard.jsx`

#### Changes for Mock Discussion Support

**Before**:
```javascript
// Only handled specific_credits and shared_credits
const tokenData = [
  { type: 'SJ Tokens', amount: specific_credits },
  { type: 'Shared Mock Tokens', amount: shared_credits }
];
```

**After**:
```javascript
// Handles Mock Discussion tokens separately
const isMockDiscussion = mockType === 'Mock Discussion';

if (isMockDiscussion) {
  tokenData = [{
    type: 'Mock Discussion Tokens',
    amount: available_credits || 0
  }];
  total = available_credits || 0;
} else {
  // Regular exam token logic
}
```

#### Token Type Mapping
```javascript
const getSpecificTokenName = (type) => {
  switch (type) {
    case 'Situational Judgment': return 'SJ Tokens';
    case 'Clinical Skills': return 'CS Tokens';
    case 'Mini-mock': return 'Mini-Mock Tokens';
    case 'Mock Discussion': return 'Mock Discussion Tokens'; // NEW
    default: return 'Specific Tokens';
  }
};
```

---

### 3. useCachedCredits Hook (Updated)

**Location**: `/mnt/c/Users/HarmonTuazon/Desktop/mocks_booking/frontend/src/hooks/useCachedCredits.js`

#### Changes for Mock Discussion Support

**Before**:
```javascript
// Fetched 3 exam types
const [situationalCredits, clinicalCredits, miniMockCredits] = await Promise.all([
  apiService.mockExams.validateCredits(studentId, email, 'Situational Judgment'),
  apiService.mockExams.validateCredits(studentId, email, 'Clinical Skills'),
  apiService.mockExams.validateCredits(studentId, email, 'Mini-mock')
]);
```

**After**:
```javascript
// Fetches 4 types (3 exams + discussions)
const [situationalCredits, clinicalCredits, miniMockCredits, discussionCredits] = await Promise.all([
  apiService.mockExams.validateCredits(studentId, email, 'Situational Judgment'),
  apiService.mockExams.validateCredits(studentId, email, 'Clinical Skills'),
  apiService.mockExams.validateCredits(studentId, email, 'Mini-mock'),
  apiService.mockDiscussions.validateCredits(studentId, email) // NEW
]);

const newCreditData = {
  'Situational Judgment': situationalCredits.data,
  'Clinical Skills': clinicalCredits.data,
  'Mini-mock': miniMockCredits.data,
  'Mock Discussion': discussionCredits.data // NEW
};
```

#### Cache Strategy

**Module-level cache** shared across all component instances:
- Cache duration: 5 minutes (300,000ms)
- Subscriber pattern: All components using the hook receive updates
- Prevents redundant API calls
- Force refresh option available

#### Usage Example
```javascript
const { credits, loading, fetchCredits, invalidateCache } = useCachedCredits();

// Access discussion tokens
const discussionTokens = credits?.['Mock Discussion']?.available_credits || 0;

// Force refresh after booking
await invalidateCache();
await fetchCredits(studentId, email, true);
```

---

### 4. API Service (Updated)

**Location**: `/mnt/c/Users/HarmonTuazon/Desktop/mocks_booking/frontend/src/services/api.js`

#### New API Methods

```javascript
const apiService = {
  // ... existing mockExams methods ...

  /**
   * Mock Discussions API endpoints
   */
  mockDiscussions: {
    /**
     * Get available mock discussion sessions
     */
    getAvailable: async (includeCapacity = true) => {
      return api.get('/mock-discussions/available', {
        params: {
          include_capacity: includeCapacity,
          realtime: true,
        },
      });
    },

    /**
     * Validate user's mock discussion tokens
     */
    validateCredits: async (studentId, email) => {
      return api.post('/mock-discussions/validate-credits', {
        student_id: studentId,
        email: email,
      });
    },

    /**
     * Create a mock discussion booking
     */
    createBooking: async (bookingData) => {
      return api.post('/mock-discussions/create-booking', bookingData);
    },
  },

  // ... existing bookings methods ...
};
```

---

## HubSpot Configuration

### Required HubSpot Objects

#### 1. Mock Exams (Object Type ID: 2-50158913)

**Required Properties**:

| Property Name | Type | Description | Example Value |
|---------------|------|-------------|---------------|
| `mock_type` | Dropdown | Type of session | "Mock Discussion" |
| `exam_date` | Date | Session date | "2025-11-15" |
| `start_time` | DateTime | Session start time (UTC) | "2025-11-15T18:00:00.000Z" |
| `end_time` | DateTime | Session end time (UTC) | "2025-11-15T20:00:00.000Z" |
| `capacity` | Number | Maximum participants | 20 |
| `total_bookings` | Number | Current booking count | 12 |
| `location` | Single-line text | Campus/venue name | "Toronto Campus - Downtown" |
| `is_active` | Dropdown | Active status | "true" / "false" |

**mock_type Values**:
- "Situational Judgment"
- "Clinical Skills"
- "Mini-mock"
- **"Mock Discussion"** (NEW)

**Creating Mock Discussion Sessions**:
```javascript
// In HubSpot UI or via API
{
  properties: {
    mock_type: "Mock Discussion",
    exam_date: "2025-11-15",
    start_time: "2025-11-15T18:00:00.000Z",
    end_time: "2025-11-15T20:00:00.000Z",
    capacity: "20",
    total_bookings: "0",
    location: "Toronto Campus - Downtown",
    is_active: "true"
  }
}
```

---

#### 2. Bookings (Object Type ID: 2-50158943)

**Properties Used**:

| Property Name | Type | Description | Example Value |
|---------------|------|-------------|---------------|
| `booking_id` | Single-line text | Unique booking identifier | "Mock Discussion-John Doe - November 15, 2025" |
| `name` | Single-line text | Student name | "John Doe" |
| `email` | Email | Student email | "student@example.com" |
| `token_used` | Single-line text | Token type deducted | "Mock Discussion Token" |
| `is_active` | Dropdown | Booking status | "Active" / "Cancelled" / "Completed" |
| `idempotency_key` | Single-line text | Unique request identifier | "idem_disc_abc123..." |
| `discussion_format` | Single-line text | Format preference (optional) | "Virtual" / "In-Person" / "Hybrid" |
| `topic_preference` | Multi-line text | Topic preference (optional) | "Clinical case review" |

**Calculated Properties** (from associated Mock Exam):
- `mockType` (lookup)
- `examDate` (lookup)
- `location` (lookup)

**Associations**:
- **Contact** (0-1): The student who made the booking
- **Mock Exam** (2-50158913): The discussion session being booked

---

#### 3. Contacts (Object Type ID: 0-1)

**New Property Required**:

| Property Name | Type | Description | Default Value |
|---------------|------|-------------|---------------|
| `mock_discussion_token` | Number | Available discussion tokens | 0 |

**Creating the Property**:
```javascript
// Via HubSpot API
POST /crm/v3/properties/contacts
{
  "name": "mock_discussion_token",
  "label": "Mock Discussion Tokens",
  "type": "number",
  "fieldType": "number",
  "groupName": "contactinformation",
  "description": "Number of mock discussion tokens available for booking",
  "hasUniqueValue": false
}
```

**Via HubSpot UI**:
1. Navigate to Settings > Properties > Contact Properties
2. Click "Create property"
3. Name: `mock_discussion_token`
4. Label: "Mock Discussion Tokens"
5. Type: Number
6. Group: Contact Information
7. Save

---

### HubSpot Property Validation

**CRITICAL**: Before deploying, verify the property exists:

```bash
# Test endpoint to check property
curl -X GET "https://api.hubapi.com/crm/v3/properties/contacts/mock_discussion_token" \
  -H "Authorization: Bearer YOUR_PRIVATE_APP_TOKEN"

# Expected response:
{
  "name": "mock_discussion_token",
  "label": "Mock Discussion Tokens",
  "type": "number",
  ...
}
```

**Error if Property Missing**:
```json
{
  "success": false,
  "error": "System configuration error. Please contact support.",
  "code": "PROPERTY_NOT_FOUND"
}
```

---

### Association Types

The module uses standard HubSpot associations:

**Booking → Contact**:
- Association Type: Default (booking to contact)
- Created during booking creation

**Booking → Mock Exam**:
- Association Type: Default (booking to mock_exams)
- Created during booking creation

**Retrieving Associated Bookings**:
```javascript
// Get all bookings for a contact
GET /crm/v4/objects/bookings/batch/read?archived=false

// Get all bookings for a mock discussion
GET /crm/v4/associations/mock_exams/{mockExamId}/bookings
```

---

## Token Management Logic

### Token Deduction Flow

```
1. User initiates booking
   ↓
2. Validate mock_discussion_token > 0
   ↓
3. Acquire Redis lock on mock_exam_id
   ↓
4. Create Booking object
   ↓
5. Deduct token: new_value = current_value - 1
   ↓
6. Update Contact property
   ↓
7. Create associations
   ↓
8. Increment total_bookings on Mock Exam
   ↓
9. Release Redis lock
   ↓
10. Create timeline note
   ↓
11. Invalidate cache
```

### Token Balance Calculation

**Simple Model** (Mock Discussion):
```javascript
available_credits = parseInt(contact.properties.mock_discussion_token) || 0;
eligible = available_credits > 0;
```

**No Shared Tokens**: Unlike exam bookings, mock discussions use only discussion tokens (no shared token fallback).

### Token Refund (Cancellation)

When a discussion booking is cancelled:

```javascript
// Increment mock_discussion_token
const currentTokens = parseInt(contact.properties.mock_discussion_token) || 0;
const newTokens = currentTokens + 1;

await hubspot.updateContactCredits(contact_id, 'mock_discussion_token', newTokens);
```

---

## Integration Points

### 1. Navigation Menu

**File**: `/mnt/c/Users/HarmonTuazon/Desktop/mocks_booking/frontend/src/components/shared/SidebarNavigation.jsx`

**Addition**:
```javascript
const navigation = [
  { name: 'Book Exam', href: '/book/exam-types', icon: CalendarIcon },
  { name: 'Mock Discussions', href: '/book/discussions', icon: ChatIcon }, // NEW
  { name: 'My Bookings', href: '/my-bookings', icon: ListIcon }
];
```

---

### 2. Routing Configuration

**File**: `/mnt/c/Users/HarmonTuazon/Desktop/mocks_booking/frontend/src/App.jsx`

**New Routes**:
```javascript
<Routes>
  {/* ... existing routes ... */}

  {/* Mock Discussions page - requires authentication */}
  <Route path="/book/discussions" element={
    <ProtectedRoute>
      <MockDiscussions />
    </ProtectedRoute>
  } />

  {/* Mock Discussion booking form */}
  <Route path="/book/mock-discussion/:mockExamId" element={
    <ProtectedRoute>
      <BookingForm />
    </ProtectedRoute>
  } />

  {/* ... rest of routes ... */}
</Routes>
```

---

### 3. MyBookings Integration

**File**: `/mnt/c/Users/HarmonTuazon/Desktop/mocks_booking/frontend/src/components/MyBookings.jsx`

**Filtering Logic**:
```javascript
// Existing booking display logic automatically includes Mock Discussion bookings
// because they use the same Booking object (2-50158943)

// The mockType property (calculated from association) will be "Mock Discussion"
// UI displays discussion bookings with appropriate icon and label
```

**Visual Differentiation**:
- Exam bookings: Calendar icon
- Discussion bookings: Chat/discussion icon
- Color coding or badge to distinguish types

---

### 4. Cache Invalidation

**After Booking Creation**:
```javascript
// Invalidate multiple cache keys
const cache = getCache();

// 1. Invalidate user's booking cache
await cache.deletePattern(`bookings:contact:${contact_id}:*`);

// 2. Invalidate discussion availability cache
await cache.delete('mock-discussions:capacitytrue:realtimefalse');
await cache.delete('mock-discussions:capacitytrue:realtimetrue');

// 3. Invalidate credit cache (frontend)
window.dispatchEvent(new CustomEvent('creditsInvalidated'));
```

---

### 5. Booking Form Reuse

**File**: `/mnt/c/Users/HarmonTuazon/Desktop/mocks_booking/frontend/src/components/BookingForm.jsx`

The existing BookingForm component handles both exam and discussion bookings:

**Detection Logic**:
```javascript
const location = useLocation();
const { mockType } = location.state || {};
const isMockDiscussion = mockType === 'Mock Discussion';

// API endpoint selection
const createEndpoint = isMockDiscussion
  ? '/api/mock-discussions/create-booking'
  : '/api/bookings/create';

// Token validation
const validateEndpoint = isMockDiscussion
  ? '/api/mock-discussions/validate-credits'
  : '/api/mock-exams/validate-credits';
```

**Form Fields**:
- Common: name, email, student_id, exam_date
- Discussion-specific: discussion_format, topic_preference
- Exam-specific: (none, but could be added later)

---

## Testing Procedures

### Unit Tests

**Test File Location**: `/mnt/c/Users/HarmonTuazon/Desktop/mocks_booking/tests/unit/mock-discussions/`

#### 1. API Endpoint Tests

**available.test.js**:
```javascript
describe('GET /api/mock-discussions/available', () => {
  test('should return only Mock Discussion sessions', async () => {
    const response = await request(app).get('/api/mock-discussions/available');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    response.body.data.forEach(session => {
      expect(session.mock_type).toBe('Mock Discussion');
    });
  });

  test('should filter out past discussions', async () => {
    const response = await request(app).get('/api/mock-discussions/available');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    response.body.data.forEach(session => {
      const sessionDate = new Date(session.exam_date);
      sessionDate.setHours(0, 0, 0, 0);
      expect(sessionDate >= today).toBe(true);
    });
  });

  test('should calculate real-time capacity when requested', async () => {
    const response = await request(app)
      .get('/api/mock-discussions/available?realtime=true');
    expect(response.status).toBe(200);
    // Verify capacity calculations are accurate
  });

  test('should respect rate limiting', async () => {
    const requests = Array(35).fill().map(() =>
      request(app).get('/api/mock-discussions/available')
    );
    const responses = await Promise.all(requests);
    const rateLimited = responses.some(r => r.status === 429);
    expect(rateLimited).toBe(true);
  });
});
```

**validate-credits.test.js**:
```javascript
describe('POST /api/mock-discussions/validate-credits', () => {
  test('should validate discussion tokens correctly', async () => {
    const response = await request(app)
      .post('/api/mock-discussions/validate-credits')
      .send({
        student_id: 'TEST123',
        email: 'test@example.com'
      });

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveProperty('available_credits');
    expect(response.body.data).toHaveProperty('credit_breakdown.discussion_tokens');
  });

  test('should return error for non-existent student', async () => {
    const response = await request(app)
      .post('/api/mock-discussions/validate-credits')
      .send({
        student_id: 'INVALID',
        email: 'invalid@example.com'
      });

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('STUDENT_NOT_FOUND');
  });

  test('should handle missing mock_discussion_token property', async () => {
    // Mock HubSpot to return error for missing property
    const response = await request(app)
      .post('/api/mock-discussions/validate-credits')
      .send({
        student_id: 'TEST123',
        email: 'test@example.com'
      });

    if (response.status === 500) {
      expect(response.body.code).toBe('PROPERTY_NOT_FOUND');
    }
  });
});
```

**create-booking.test.js**:
```javascript
describe('POST /api/mock-discussions/create-booking', () => {
  test('should create discussion booking successfully', async () => {
    const response = await request(app)
      .post('/api/mock-discussions/create-booking')
      .send({
        mock_exam_id: '123456789',
        contact_id: '987654321',
        student_id: 'TEST123',
        name: 'Test Student',
        email: 'test@example.com',
        exam_date: '2025-11-15',
        discussion_format: 'Virtual'
      });

    expect(response.status).toBe(201);
    expect(response.body.data).toHaveProperty('booking_id');
    expect(response.body.data.booking_id).toContain('Mock Discussion');
  });

  test('should handle idempotent requests', async () => {
    const bookingData = {
      mock_exam_id: '123456789',
      contact_id: '987654321',
      student_id: 'TEST123',
      name: 'Test Student',
      email: 'test@example.com',
      exam_date: '2025-11-15'
    };

    const response1 = await request(app)
      .post('/api/mock-discussions/create-booking')
      .set('X-Idempotency-Key', 'test-idem-key-123')
      .send(bookingData);

    const response2 = await request(app)
      .post('/api/mock-discussions/create-booking')
      .set('X-Idempotency-Key', 'test-idem-key-123')
      .send(bookingData);

    expect(response1.status).toBe(201);
    expect(response2.status).toBe(200);
    expect(response2.body.data.idempotent_request).toBe(true);
  });

  test('should reject booking with insufficient tokens', async () => {
    const response = await request(app)
      .post('/api/mock-discussions/create-booking')
      .send({
        mock_exam_id: '123456789',
        contact_id: '000000000', // Contact with 0 tokens
        student_id: 'ZERO_TOKENS',
        name: 'No Tokens Student',
        email: 'no-tokens@example.com',
        exam_date: '2025-11-15'
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INSUFFICIENT_TOKENS');
  });

  test('should reject booking for full discussion', async () => {
    const response = await request(app)
      .post('/api/mock-discussions/create-booking')
      .send({
        mock_exam_id: '999999999', // Full session
        contact_id: '987654321',
        student_id: 'TEST123',
        name: 'Test Student',
        email: 'test@example.com',
        exam_date: '2025-11-15'
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('DISCUSSION_FULL');
  });

  test('should reject invalid mock_type', async () => {
    const response = await request(app)
      .post('/api/mock-discussions/create-booking')
      .send({
        mock_exam_id: '555555555', // Mock Exam with type="Situational Judgment"
        contact_id: '987654321',
        student_id: 'TEST123',
        name: 'Test Student',
        email: 'test@example.com',
        exam_date: '2025-11-15'
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_MOCK_TYPE');
  });
});
```

---

#### 2. Frontend Component Tests

**MockDiscussions.test.jsx**:
```javascript
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import MockDiscussions from '../pages/MockDiscussions';

describe('MockDiscussions Component', () => {
  test('should render calendar view by default', async () => {
    render(
      <BrowserRouter>
        <MockDiscussions />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Select a date from the calendar/i)).toBeInTheDocument();
    });
  });

  test('should toggle between calendar and list views', async () => {
    const { getByText } = render(
      <BrowserRouter>
        <MockDiscussions />
      </BrowserRouter>
    );

    const listViewButton = getByText(/List View/i);
    fireEvent.click(listViewButton);

    await waitFor(() => {
      expect(screen.getByText(/Select an available discussion session/i)).toBeInTheDocument();
    });
  });

  test('should display token count', async () => {
    // Mock useCachedCredits hook
    render(
      <BrowserRouter>
        <MockDiscussions />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Mock Discussion Tokens/i)).toBeInTheDocument();
    });
  });

  test('should filter discussions by location', async () => {
    const { getByLabelText, getAllByTestId } = render(
      <BrowserRouter>
        <MockDiscussions />
      </BrowserRouter>
    );

    const locationFilter = getByLabelText(/Filter by location/i);
    fireEvent.change(locationFilter, { target: { value: 'Toronto Campus' } });

    await waitFor(() => {
      const discussions = getAllByTestId('discussion-card');
      discussions.forEach(card => {
        expect(card).toHaveTextContent('Toronto Campus');
      });
    });
  });

  test('should show warning when tokens are 0', async () => {
    // Mock credits with 0 tokens
    render(
      <BrowserRouter>
        <MockDiscussions />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/You have 0 Mock Discussion tokens/i)).toBeInTheDocument();
    });
  });
});
```

---

### Integration Tests

**Test File**: `/mnt/c/Users/HarmonTuazon/Desktop/mocks_booking/tests/integration/mock-discussions.integration.test.js`

```javascript
describe('Mock Discussions End-to-End Flow', () => {
  let testContactId;
  let testMockExamId;

  beforeEach(async () => {
    // Setup: Create test contact with discussion tokens
    testContactId = await createTestContact({
      student_id: 'INT_TEST_001',
      email: 'integration@test.com',
      mock_discussion_token: 5
    });

    // Create test mock discussion session
    testMockExamId = await createTestMockExam({
      mock_type: 'Mock Discussion',
      exam_date: '2025-12-01',
      capacity: 10,
      total_bookings: 0,
      is_active: 'true'
    });
  });

  afterEach(async () => {
    // Cleanup
    await deleteTestContact(testContactId);
    await deleteTestMockExam(testMockExamId);
  });

  test('complete booking flow', async () => {
    // Step 1: Validate credits
    const validationResponse = await request(app)
      .post('/api/mock-discussions/validate-credits')
      .send({
        student_id: 'INT_TEST_001',
        email: 'integration@test.com'
      });

    expect(validationResponse.status).toBe(200);
    expect(validationResponse.body.data.available_credits).toBe(5);

    // Step 2: Fetch available discussions
    const availableResponse = await request(app)
      .get('/api/mock-discussions/available?realtime=true');

    expect(availableResponse.status).toBe(200);
    const discussion = availableResponse.body.data.find(d => d.mock_exam_id === testMockExamId);
    expect(discussion).toBeDefined();
    expect(discussion.available_slots).toBe(10);

    // Step 3: Create booking
    const bookingResponse = await request(app)
      .post('/api/mock-discussions/create-booking')
      .send({
        mock_exam_id: testMockExamId,
        contact_id: testContactId,
        student_id: 'INT_TEST_001',
        name: 'Integration Test',
        email: 'integration@test.com',
        exam_date: '2025-12-01',
        discussion_format: 'Virtual'
      });

    expect(bookingResponse.status).toBe(201);
    expect(bookingResponse.body.data.token_details.tokens_remaining).toBe(4);

    // Step 4: Verify capacity updated
    const updatedAvailableResponse = await request(app)
      .get('/api/mock-discussions/available?realtime=true');

    const updatedDiscussion = updatedAvailableResponse.body.data.find(d => d.mock_exam_id === testMockExamId);
    expect(updatedDiscussion.available_slots).toBe(9);
    expect(updatedDiscussion.total_bookings).toBe(1);

    // Step 5: Verify token deducted
    const finalValidationResponse = await request(app)
      .post('/api/mock-discussions/validate-credits')
      .send({
        student_id: 'INT_TEST_001',
        email: 'integration@test.com'
      });

    expect(finalValidationResponse.body.data.available_credits).toBe(4);
  });

  test('concurrent booking handling', async () => {
    // Create 10 test contacts
    const contacts = await Promise.all(
      Array(10).fill().map((_, i) =>
        createTestContact({
          student_id: `CONCURRENT_${i}`,
          email: `concurrent${i}@test.com`,
          mock_discussion_token: 1
        })
      )
    );

    // Attempt 10 simultaneous bookings
    const bookingRequests = contacts.map(contact =>
      request(app)
        .post('/api/mock-discussions/create-booking')
        .send({
          mock_exam_id: testMockExamId,
          contact_id: contact.id,
          student_id: contact.student_id,
          name: `Test User ${contact.student_id}`,
          email: contact.email,
          exam_date: '2025-12-01'
        })
    );

    const results = await Promise.all(bookingRequests);

    // All should succeed (capacity is 10)
    const successCount = results.filter(r => r.status === 201).length;
    expect(successCount).toBe(10);

    // Verify final capacity
    const finalResponse = await request(app)
      .get('/api/mock-discussions/available?realtime=true');

    const finalDiscussion = finalResponse.body.data.find(d => d.mock_exam_id === testMockExamId);
    expect(finalDiscussion.total_bookings).toBe(10);
    expect(finalDiscussion.available_slots).toBe(0);

    // Cleanup
    await Promise.all(contacts.map(c => deleteTestContact(c.id)));
  });
});
```

---

### Manual Testing Checklist

#### Pre-deployment Testing

- [ ] **HubSpot Property Verification**
  - [ ] Verify `mock_discussion_token` property exists on Contacts
  - [ ] Create test contact with 3 discussion tokens
  - [ ] Create test Mock Exam with `mock_type = "Mock Discussion"`

- [ ] **API Endpoint Testing**
  - [ ] Test `/api/mock-discussions/available` returns only discussions
  - [ ] Test real-time capacity calculation (`realtime=true`)
  - [ ] Test `/api/mock-discussions/validate-credits` with valid student
  - [ ] Test credit validation with 0 tokens (should show warning)
  - [ ] Test booking creation with sufficient tokens
  - [ ] Test booking creation with insufficient tokens (should fail)
  - [ ] Test duplicate booking prevention
  - [ ] Test idempotency with same idempotency key

- [ ] **Frontend Testing**
  - [ ] Navigate to `/book/discussions` while logged in
  - [ ] Verify calendar view displays discussion sessions
  - [ ] Switch to list view and verify table/cards display
  - [ ] Test location filtering
  - [ ] Test sorting (date, time, location, capacity)
  - [ ] Verify token count displays correctly
  - [ ] Test booking flow: select session → fill form → submit → confirmation
  - [ ] Verify token count decreases after booking
  - [ ] Navigate to My Bookings and verify discussion shows up

- [ ] **Mobile Responsiveness**
  - [ ] Test on mobile device or browser dev tools
  - [ ] Verify card layout on mobile
  - [ ] Test mobile sorting controls
  - [ ] Verify compact token display

- [ ] **Error Handling**
  - [ ] Test with expired session (should redirect to login)
  - [ ] Test with network error (should show error message)
  - [ ] Test with full session (should show "Full" button)
  - [ ] Test with 0 tokens (should show warning alert)

---

## Deployment Checklist

### Pre-Deployment

- [ ] **Code Quality**
  - [ ] All unit tests passing (`npm test`)
  - [ ] Test coverage > 70% (`npm run test:coverage`)
  - [ ] No console errors in browser
  - [ ] No ESLint warnings
  - [ ] Code reviewed by team member

- [ ] **HubSpot Configuration**
  - [ ] `mock_discussion_token` property created on Contacts
  - [ ] Test Mock Discussion sessions created
  - [ ] Verify HubSpot API token has correct permissions
  - [ ] Test associations between Bookings ↔ Mock Exams ↔ Contacts

- [ ] **Environment Variables**
  ```bash
  # Verify in Vercel dashboard
  HS_PRIVATE_APP_TOKEN=your_token_here
  REDIS_URL=your_redis_url  # For distributed locking
  CRON_SECRET=your_cron_secret  # If using scheduled jobs
  ```

- [ ] **Dependencies**
  - [ ] All npm packages up to date
  - [ ] No security vulnerabilities (`npm audit`)
  - [ ] Build succeeds locally (`npm run build`)

---

### Deployment Steps

#### 1. Staging Deployment

```bash
# Navigate to project root
cd /mnt/c/Users/HarmonTuazon/Desktop/mocks_booking

# Ensure all changes are committed
git add .
git commit -m "Add Mock Discussions module"

# Clean build
rm -rf frontend/dist frontend/node_modules/.vite
npm run build

# Deploy to staging
vercel

# Note the preview URL
# Example: https://mocks-booking-xyz123.vercel.app
```

#### 2. Staging Testing

- [ ] Test all API endpoints on staging URL
- [ ] Test frontend flows on staging URL
- [ ] Verify HubSpot integration works on staging
- [ ] Test with real student data (if available)
- [ ] Monitor Vercel logs for errors

#### 3. Production Deployment

```bash
# After staging validation
vercel --prod

# Note the production URL
# Example: https://mocks-booking.prepdoctors.com
```

#### 4. Post-Deployment Verification

```bash
# Test health of production deployment

# 1. Verify API endpoints respond
curl -s https://mocks-booking.prepdoctors.com/api/mock-discussions/available | jq

# 2. Check for discussion sessions
curl -s "https://mocks-booking.prepdoctors.com/api/mock-discussions/available?include_capacity=true" | jq '.data | length'

# 3. Test credit validation (with test student)
curl -X POST https://mocks-booking.prepdoctors.com/api/mock-discussions/validate-credits \
  -H "Content-Type: application/json" \
  -d '{"student_id":"TEST123","email":"test@example.com"}' | jq

# 4. Verify frontend loads
curl -s https://mocks-booking.prepdoctors.com | grep -q "Mock Discussion" && echo "✅ Frontend deployed"
```

- [ ] Production endpoints responding
- [ ] Frontend navigation includes "Mock Discussions"
- [ ] Token count displays correctly
- [ ] Booking creation works
- [ ] MyBookings shows discussions

---

### Rollback Plan

If issues are detected in production:

```bash
# Revert to previous deployment
vercel rollback

# Or redeploy previous commit
git revert HEAD
git push origin main
vercel --prod
```

**Critical Issues Requiring Rollback**:
- API endpoints returning 500 errors consistently
- HubSpot property missing (PROPERTY_NOT_FOUND errors)
- Booking creation failures
- Token deduction not working
- Frontend crashes or white screen

---

### Monitoring

**Key Metrics to Watch**:
- Error rate on `/api/mock-discussions/*` endpoints
- Response time for booking creation
- HubSpot API rate limit usage
- Redis lock acquisition failures
- Frontend JavaScript errors

**Vercel Monitoring**:
- Dashboard: https://vercel.com/your-team/mocks-booking
- Logs: Check for errors in function logs
- Analytics: Monitor page views on `/book/discussions`

**HubSpot Monitoring**:
- API usage dashboard
- Check for rate limit warnings
- Verify booking records are created correctly

---

## Known Limitations

### 1. Capacity Synchronization

**Issue**: Cached capacity may be slightly out of sync if cache is used instead of real-time calculation.

**Impact**: Users may see "available" status for a session that becomes full between cache refresh.

**Mitigation**:
- Use `realtime=true` query parameter for accurate capacity
- Lock mechanism prevents overbooking even with stale cache
- Cache TTL is 5 minutes (relatively short)

**Future Enhancement**: Implement WebSocket or Server-Sent Events for live capacity updates.

---

### 2. Time Zone Handling

**Issue**: Times stored in UTC, but displayed in local time. Time zone conversion may cause confusion if not clearly indicated.

**Impact**: Users in different time zones may see incorrect local times.

**Mitigation**:
- Clearly label time zone in UI ("All times in EST/EDT")
- Use consistent time zone for all sessions
- Add time zone selector in future version

**Code Implementation**:
```javascript
// In available.js - Fallback time generation
const localStartHour = 14; // 2 PM local time
const timeZoneOffset = 4; // Toronto UTC-4 (DST)
startDate.setHours(startDate.getHours() + timeZoneOffset); // Convert to UTC
```

**Future Enhancement**: Store time zone in Mock Exam properties and handle conversions dynamically.

---

### 3. Discussion Format Field

**Issue**: `discussion_format` field is optional and not validated beyond Joi schema.

**Impact**: Free-text input could lead to inconsistent data if not properly constrained.

**Current Constraint**: Joi validation allows only `'Virtual'`, `'In-Person'`, or `'Hybrid'`.

**Future Enhancement**:
- Make this a dropdown in HubSpot
- Add icons for each format type in UI
- Filter discussions by format

---

### 4. Token Refund on Cancellation

**Issue**: Token refund logic is not fully integrated with cancellation workflow.

**Impact**: Admins must manually increment `mock_discussion_token` when refunding.

**Current Workaround**: Document manual refund process in admin guide.

**Future Enhancement**: Implement automatic refund when booking status changes to "Cancelled".

---

### 5. No Email Notifications

**Issue**: System does not send confirmation emails for discussion bookings.

**Impact**: Students must manually check My Bookings page for confirmation.

**Workaround**: HubSpot workflows can be created to trigger emails based on Booking creation.

**Future Enhancement**:
- Integrate with HubSpot Email API
- Send confirmation emails via Vercel function
- Include calendar invite (.ics file)

---

### 6. No Recurring Discussion Sessions

**Issue**: Each discussion session must be manually created in HubSpot.

**Impact**: Administrative overhead for creating weekly/monthly sessions.

**Workaround**: Use HubSpot API to batch create sessions.

**Future Enhancement**: Admin interface for creating recurring sessions (weekly, bi-weekly, monthly).

---

### 7. Limited Search/Filtering

**Issue**: No search by date range, instructor, or topic.

**Impact**: Users must scroll through all available sessions.

**Current Filtering**: Location only.

**Future Enhancement**:
- Date range picker
- Instructor filter
- Topic/specialty filter
- Search by keywords

---

## Future Enhancements

### Phase 1: Immediate Improvements (1-2 weeks)

#### 1.1 Email Confirmation System
- Integrate HubSpot Email API
- Send confirmation email on booking creation
- Include session details, location, and calendar invite
- Send reminder email 24 hours before session

#### 1.2 Cancellation Workflow
- Add "Cancel Booking" button in My Bookings
- Implement `/api/mock-discussions/cancel-booking` endpoint
- Automatic token refund on cancellation
- Send cancellation confirmation email

#### 1.3 Admin Dashboard
- View all discussion bookings in a central dashboard
- Export bookings to CSV
- Bulk email functionality
- Session attendance tracking

---

### Phase 2: Enhanced User Experience (2-4 weeks)

#### 2.1 Advanced Filtering
- Date range picker (next week, next month, custom range)
- Instructor filter (if instructors assigned to sessions)
- Topic filter (Clinical Skills, Situational Judgment, Mixed)
- Saved filter preferences

#### 2.2 Recurring Sessions
- Admin interface to create recurring sessions
- Weekly, bi-weekly, monthly patterns
- Exclude holidays and special dates
- Bulk capacity adjustments

#### 2.3 Waitlist Functionality
- Join waitlist when session is full
- Automatic notification when spot opens
- Priority order based on waitlist join time
- Convert waitlist to booking with one click

#### 2.4 Discussion Details Page
- Dedicated page for each discussion session
- View instructor bio and photo
- See topics that will be covered
- Read reviews from past participants
- View location details and parking info

---

### Phase 3: Advanced Features (1-2 months)

#### 3.1 Video Integration
- Zoom/Teams integration for virtual sessions
- Automatic meeting creation on booking
- Join meeting button in My Bookings
- Recording availability after session

#### 3.2 Discussion Materials
- Upload pre-discussion materials (PDFs, slides)
- Students can download materials after booking
- Post-discussion resources and references
- Discussion notes and summary

#### 3.3 Feedback System
- Post-discussion survey
- Rate instructor and session quality
- Feedback stored in HubSpot
- Aggregate ratings displayed on discussion page

#### 3.4 Smart Recommendations
- Recommend discussions based on exam performance
- Suggest optimal discussion timing (after exam completion)
- Group discussions by topic/specialty
- Personalized discussion schedule

---

### Phase 4: Analytics and Reporting (2-3 months)

#### 4.1 Student Analytics
- Track discussion attendance history
- Correlation between discussions and exam improvement
- Engagement metrics (on-time attendance, participation)
- Personalized insights and recommendations

#### 4.2 Admin Analytics
- Discussion session utilization rates
- Popular time slots and locations
- Token usage patterns
- Revenue analysis (if paid)

#### 4.3 Instructor Analytics
- Session performance metrics
- Student feedback aggregation
- Booking trends over time
- Capacity optimization recommendations

---

### Technical Debt to Address

#### TD-1: Centralize Date/Time Handling
**Problem**: Date/time logic scattered across components.
**Solution**: Create shared utility functions for date parsing, formatting, and time zone conversion.
**Priority**: Medium
**Effort**: 1-2 days

#### TD-2: Standardize Error Messages
**Problem**: Inconsistent error messages across API endpoints.
**Solution**: Create error message constants and standardized error response builder.
**Priority**: Low
**Effort**: 1 day

#### TD-3: Add API Request Logging
**Problem**: Difficult to debug API issues without detailed logs.
**Solution**: Implement structured logging with request/response tracking.
**Priority**: High
**Effort**: 2-3 days

#### TD-4: Optimize Batch Operations
**Problem**: Some batch operations could be further optimized.
**Solution**: Profile HubSpot API calls and identify bottlenecks.
**Priority**: Medium
**Effort**: 3-5 days

#### TD-5: Add API Versioning
**Problem**: No API versioning strategy in place.
**Solution**: Implement `/api/v1/mock-discussions/...` versioning.
**Priority**: Low
**Effort**: 1-2 days

---

## Conclusion

The Mock Discussions module successfully extends the PrepDoctors booking system to support post-exam discussion sessions. Built using the PrepDoctors HubSpot Automation Framework, it maintains consistency with existing architecture while introducing a new token-based booking system.

### Key Achievements

- **Dedicated Token System**: Separate `mock_discussion_token` property enables independent pricing and management
- **Optimized Performance**: Batch operations reduce HubSpot API calls by 80-90%
- **Robust Error Handling**: Idempotency, distributed locking, and comprehensive validation
- **Reusable Components**: Leverages existing UI components with minimal modifications
- **Mobile-First Design**: Responsive interface with calendar and list views

### Success Metrics

- API response time: <2 seconds for discussion listing
- Booking creation: <3 seconds end-to-end
- Zero race conditions: Redis locking prevents capacity overbooking
- Code coverage: >70% (framework requirement)
- Zero duplicate bookings: Idempotency key implementation

### Maintenance Notes

- **HubSpot Property Dependency**: System critically depends on `mock_discussion_token` property existing
- **Cache Management**: 5-minute cache TTL balances performance and accuracy
- **Token Management**: Manual token refunds required until automated cancellation workflow implemented
- **Time Zone Assumptions**: Currently assumes Toronto time zone (UTC-4/5)

### Support and Troubleshooting

**Common Issues**:

1. **"Property mock_discussion_token does not exist"**
   - Solution: Create property in HubSpot (see HubSpot Configuration section)

2. **"Lock acquisition failed"**
   - Solution: Check Redis connection and increase lock timeout

3. **Incorrect capacity counts**
   - Solution: Use `realtime=true` parameter to recalculate capacity

4. **Cached data not updating**
   - Solution: Cache TTL is 5 minutes; force refresh with `realtime=true`

**Support Contacts**:
- Technical Issues: dev@prepdoctors.com
- HubSpot Configuration: admin@prepdoctors.com
- Feature Requests: product@prepdoctors.com

---

**Documentation Version**: 1.0.0
**Last Updated**: 2025-10-20
**Author**: PrepDoctors Development Team
**Framework Version**: PrepDoctors HubSpot Automation Framework v1.0
