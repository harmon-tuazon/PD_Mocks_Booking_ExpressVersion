# Product Requirements Document (PRD)
## Admin Dashboard: Mock Exam Table Aggregation with Accordion View

**Project**: Mock Exam Booking System - Admin Dashboard Enhancement  
**Date**: October 24, 2025  
**Requested By**: Harmon Tuazon  
**Priority**: [X] High  
**Status**: 📋 Planning

---

## 📋 **Feature Summary**

### **Brief Description**
Transform the admin dashboard's main table from displaying individual mock exam sessions as rows to displaying aggregated accordion rows grouped by mock type, exam date, and location. Each accordion row serves as a bucket containing multiple related mock exam objects, providing a cleaner, more organized view while maintaining all existing functionality at the individual session level.

### **Category**
- [X] 🔧 **Enhancement** - Improve existing functionality
- [X] 🎨 **UI/UX** - Frontend design or user experience changes
- [X] ⚡ **Performance** - Speed or efficiency improvements (Redis caching)

### **Business Value**
This enhancement significantly improves the admin dashboard's usability by:
- **Reducing visual clutter**: Instead of displaying 50+ individual rows for the same event across different time slots, admins see a single aggregate row
- **Improving scanability**: Admins can quickly identify available exam dates and locations at a glance
- **Maintaining granular control**: All editing, capacity management, and metrics remain at the individual session level
- **Enhancing performance**: Redis-cached aggregations reduce redundant data processing and improve load times

---

## 🎯 **Current State vs Desired State**

### **What's happening now?**
The admin dashboard table (`MockExamsDashboard.jsx`) currently displays each individual Mock Exam object (`2-50158913`) as a separate row in the table. This means:

- **Example**: A Clinical Skills exam in Mississauga on December 4, 2024 with 10 different time slots (9:00 AM, 10:30 AM, 12:00 PM, etc.) appears as 10 separate rows
- **Scrolling overhead**: Admins must scroll through hundreds of rows to view all sessions
- **Cognitive load**: Difficult to quickly understand which dates/locations have sessions
- **Redundant information**: The same mock type, date, and location are displayed repeatedly
- **Filter complexity**: Filtering by date shows many duplicate-looking entries

### **What should happen instead?**
The dashboard table should display **aggregated rows** where multiple Mock Exam objects are grouped by three criteria: `mock_type`, `exam_date`, and `location`. Each aggregate row should:

**Display Format**:
```
📍 Clinical Skills - Mississauga - December 4, 2024 [▼]
   └─ [Expanded] Shows 10 individual mock exam sessions with all details
   
📍 Situational Judgment - Calgary - December 4, 2024 [▼]
   └─ [Expanded] Shows 6 individual mock exam sessions with all details
```

**Aggregate Row Behavior**:
- **Collapsed state** (default): Shows only mock type, date, location, and expand icon
- **No metrics**: No capacity, utilization, or booking counts at aggregate level
- **No actions**: No edit, delete, or status toggles on the aggregate itself
- **Clickable accordion**: Users click to expand and view underlying sessions

**Expanded State**:
- **Shows all individual sessions**: Displays the actual mock exam objects grouped under this aggregate
- **Full functionality**: Each individual session has edit buttons, capacity info, status badges, metrics, etc.
- **Existing components**: Reuses current table row rendering logic for individual sessions
- **Collapse interaction**: Click again to collapse and hide individual sessions

**Updated Filters & Sorts**:
- **Operate on aggregates**: Filtering by location shows aggregate rows for that location
- **Date range filtering**: Shows all aggregate rows within the date range
- **Mock type filtering**: Shows aggregate rows matching the selected type
- **Sorting**: Sorts aggregate rows by date, location, or type (not individual sessions)
- **Pagination**: Paginates through aggregate rows, not individual sessions

### **Why is this change needed?**
1. **Scalability**: As the system grows (100+ sessions per day), the current flat table becomes unwieldy
2. **User experience**: Admins need to quickly identify which dates have sessions without scrolling through hundreds of individual time slots
3. **Visual organization**: Grouping related sessions reduces cognitive overhead
4. **Performance**: Aggregating data server-side and caching results improves load times
5. **Inspiration from Calendly**: The screenshot provided shows Calendly uses a similar pattern for organizing event types, which is proven to work well

---

## 🔍 **Technical Details**

### **Affected Components**

**Backend Components**:
- ✅ **API Endpoint**: `/api/admin/mock-exams/list.js` (modifications)
- ✅ **NEW API Endpoint**: `/api/admin/mock-exams/aggregates.js` (new)
- ✅ **Cache Service**: `api/_shared/cache.js` (new cache keys)
- ✅ **HubSpot Service**: `api/_shared/hubspot.js` (aggregation query logic)

**Frontend Components**:
- ✅ **Dashboard Page**: `admin_frontend/src/pages/MockExamsDashboard.jsx` (updated to use new API)
- ✅ **Table Component**: `admin_frontend/src/components/MockExamsTable.jsx` (modified for accordions)
- ✅ **NEW Component**: `admin_frontend/src/components/AggregateRow.jsx` (aggregate accordion UI)
- ✅ **NEW Component**: `admin_frontend/src/components/SessionRow.jsx` (refactored from existing table row logic)
- ✅ **Filter Bar**: `admin_frontend/src/components/FilterBar.jsx` (updated for aggregate-level filtering)
- ✅ **Custom Hook**: `admin_frontend/src/hooks/useMockExamsData.js` (updated to fetch aggregates)

### **Data Structure**

**New Aggregate Response Format** (`/api/admin/mock-exams/aggregates`):
```javascript
{
  "success": true,
  "pagination": {
    "current_page": 1,
    "total_pages": 5,
    "total_aggregates": 47,
    "per_page": 10
  },
  "data": [
    {
      "aggregate_key": "clinical_skills_mississauga_2024-12-04",
      "mock_type": "Clinical Skills - Mississauga",
      "exam_date": "2024-12-04",
      "location": "Mississauga",
      "session_count": 10,
      "session_ids": [
        "123456789",
        "123456790",
        "123456791",
        // ... 7 more IDs
      ],
      "sessions": null  // Lazy loaded on expand (optional)
    },
    {
      "aggregate_key": "situational_judgment_calgary_2024-12-04",
      "mock_type": "Situational Judgment",
      "exam_date": "2024-12-04",
      "location": "Calgary",
      "session_count": 6,
      "session_ids": [...],
      "sessions": null
    }
    // ... more aggregates
  ]
}
```

**Expanded Session Details** (fetched on demand):
```javascript
{
  "aggregate_key": "clinical_skills_mississauga_2024-12-04",
  "sessions": [
    {
      "id": "123456789",
      "mock_type": "Clinical Skills - Mississauga",
      "exam_date": "2024-12-04",
      "start_time": "09:00 AM",
      "end_time": "11:00 AM",
      "capacity": 25,
      "total_bookings": 18,
      "utilization_rate": 72,
      "status": "active",
      "location": "Mississauga",
      // ... all other existing properties
    },
    // ... all 10 sessions
  ]
}
```

### **Aggregation Logic (Backend)**

**HubSpot Query Strategy**:
```javascript
// In api/_shared/hubspot.js

async function fetchMockExamsForAggregation(filters) {
  // 1. Fetch all mock exams matching filters
  const allExams = await this.searchMockExams({
    filter_location: filters.location,
    filter_mock_type: filters.mock_type,
    filter_date_from: filters.date_from,
    filter_date_to: filters.date_to,
    filter_status: filters.status,
    limit: 1000  // Fetch more to aggregate
  });

  // 2. Group by (mock_type + date + location)
  const aggregates = {};
  
  allExams.results.forEach(exam => {
    const key = `${exam.mock_type}_${exam.location}_${exam.exam_date}`;
    
    if (!aggregates[key]) {
      aggregates[key] = {
        aggregate_key: key,
        mock_type: exam.mock_type,
        exam_date: exam.exam_date,
        location: exam.location,
        session_ids: [],
        session_count: 0
      };
    }
    
    aggregates[key].session_ids.push(exam.id);
    aggregates[key].session_count++;
  });

  // 3. Convert to array and sort
  return Object.values(aggregates).sort((a, b) => {
    return new Date(a.exam_date) - new Date(b.exam_date);
  });
}
```

### **Redis Caching Strategy**

**New Cache Keys**:
```javascript
// Aggregate list cache (2-minute TTL)
`cache:admin:mock-exams:aggregates:${JSON.stringify(filters)}`

// Individual aggregate sessions cache (5-minute TTL) 
`cache:admin:aggregate:sessions:${aggregate_key}`

// Example keys:
"cache:admin:mock-exams:aggregates:{"page":1,"location":"Calgary"}"
"cache:admin:aggregate:sessions:clinical_skills_mississauga_2024-12-04"
```

**Caching Flow**:
```javascript
// In /api/admin/mock-exams/aggregates.js

module.exports = async (req, res) => {
  const cache = getCache();
  const cacheKey = `admin:mock-exams:aggregates:${JSON.stringify(filters)}`;
  
  // Check cache first
  const cachedAggregates = await cache.get(cacheKey);
  if (cachedAggregates) {
    console.log(`🎯 [Cache HIT] Aggregates`);
    return res.json(cachedAggregates);
  }
  
  // Fetch and aggregate from HubSpot
  const aggregates = await hubspot.fetchMockExamsForAggregation(filters);
  const response = { success: true, data: aggregates, pagination: {...} };
  
  // Cache for 2 minutes
  await cache.set(cacheKey, response, 120);
  
  res.json(response);
};
```

**Cache Invalidation**:
```javascript
// When mock exams are created/updated/deleted
await cache.deletePattern('admin:mock-exams:aggregates:*');
await cache.deletePattern('admin:aggregate:sessions:*');
```

### **Frontend Component Architecture**

**Updated Component Hierarchy**:
```
MockExamsDashboard.jsx
├─ FilterBar.jsx (updated: filters aggregates)
├─ DashboardMetrics.jsx (unchanged)
└─ MockExamsTable.jsx (modified)
    └─ For each aggregate:
        ├─ AggregateRow.jsx (NEW)
        │   ├─ Mock Type, Date, Location display
        │   ├─ Expand/Collapse icon
        │   └─ Session count badge
        └─ If expanded:
            └─ SessionRow.jsx (NEW - extracted from current table row)
                ├─ All existing fields (capacity, bookings, status, etc.)
                ├─ Edit/Delete actions
                └─ StatusBadge.jsx
```

**New Component: `AggregateRow.jsx`**:
```jsx
import React, { useState } from 'react';
import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react';
import SessionRow from './SessionRow';
import { useFetchAggregateSessions } from '../hooks/useFetchAggregateSessions';

const AggregateRow = ({ aggregate }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Lazy load sessions only when expanded
  const { data: sessions, isLoading } = useFetchAggregateSessions(
    aggregate.aggregate_key,
    { enabled: isExpanded }
  );
  
  const handleToggle = () => {
    setIsExpanded(!isExpanded);
  };
  
  return (
    <>
      {/* Aggregate Row - Clickable Header */}
      <tr 
        onClick={handleToggle}
        className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
      >
        <td className="px-6 py-4">
          <div className="flex items-center gap-3">
            {isExpanded ? (
              <ChevronDownIcon className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronRightIcon className="w-5 h-5 text-gray-500" />
            )}
            
            <div>
              <div className="font-semibold text-gray-900 dark:text-white">
                {aggregate.mock_type}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {aggregate.location} · {aggregate.exam_date} · {aggregate.session_count} sessions
              </div>
            </div>
          </div>
        </td>
      </tr>
      
      {/* Expanded Sessions */}
      {isExpanded && (
        <tr>
          <td colSpan="100%" className="p-0">
            <div className="bg-gray-50 dark:bg-gray-900 border-l-4 border-blue-500">
              {isLoading ? (
                <div className="py-8 text-center text-gray-500">
                  Loading sessions...
                </div>
              ) : (
                <table className="w-full">
                  <tbody>
                    {sessions?.map(session => (
                      <SessionRow key={session.id} session={session} />
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

export default AggregateRow;
```

**Refactored Component: `SessionRow.jsx`**:
```jsx
// Extract existing table row logic from MockExamsTable.jsx
import React from 'react';
import StatusBadge from './StatusBadge';

const SessionRow = ({ session }) => {
  return (
    <tr className="border-b border-gray-200 dark:border-gray-700">
      <td className="px-6 py-3">
        <div className="text-sm text-gray-900 dark:text-white">
          {session.start_time} - {session.end_time}
        </div>
      </td>
      <td className="px-6 py-3">
        <div className="text-sm">
          {session.total_bookings} / {session.capacity}
        </div>
      </td>
      <td className="px-6 py-3">
        <div className="text-sm">{session.utilization_rate}%</div>
      </td>
      <td className="px-6 py-3">
        <StatusBadge status={session.status} />
      </td>
      <td className="px-6 py-3">
        <button>Edit</button>
        <button>Delete</button>
      </td>
    </tr>
  );
};

export default SessionRow;
```

### **API Endpoints**

**NEW Endpoint**: `GET /api/admin/mock-exams/aggregates`

**Query Parameters**:
```javascript
{
  page: 1,
  limit: 20,  // Aggregates per page
  filter_location: 'Calgary',
  filter_mock_type: 'Clinical Skills',
  filter_status: 'active',
  filter_date_from: '2024-12-01',
  filter_date_to: '2024-12-31',
  sort_by: 'date',  // 'date', 'location', 'type'
  sort_order: 'asc'
}
```

**Response**: See "Data Structure" section above

**NEW Endpoint**: `GET /api/admin/mock-exams/aggregates/:key/sessions`

**Purpose**: Fetch full session details for a specific aggregate (called when expanding)

**Query Parameters**:
```javascript
{
  aggregate_key: "clinical_skills_mississauga_2024-12-04"
}
```

**Response**:
```javascript
{
  "success": true,
  "aggregate_key": "clinical_skills_mississauga_2024-12-04",
  "sessions": [
    // Array of full mock exam objects
  ]
}
```

---

## 🚨 **HubSpot API Limits & Batch Operation Strategy**

### **HubSpot API Rate Limits**

**Critical Constraint**: HubSpot enforces strict API rate limits that must be respected to avoid service disruption.

**Standard Tier Limits**:
```
┌────────────────────────────────────────────────────┐
│  Primary Limit: 100 API calls per 10 seconds      │
│  Secondary Limit: 10,000 API calls per day        │
│  Burst Protection: 150 calls per 10-second window │
└────────────────────────────────────────────────────┘
```

**What Happens When Limits Are Exceeded**:
- **HTTP 429 (Too Many Requests)**: API returns rate limit error
- **Service Degradation**: Subsequent requests fail until rate limit resets
- **User Impact**: Dashboard fails to load, operations timeout
- **Retry Overhead**: Exponential backoff adds latency (1s → 2s → 4s → 8s)

**Current Implementation**: The codebase already implements exponential backoff in `api/_shared/hubspot.js:apiCall()` to handle 429 errors gracefully.

---

### **Why Batch Operations Are Critical for This Feature**

**Problem Without Batch Operations**:

The aggregation feature needs to fetch details for potentially hundreds of mock exam sessions:

```javascript
// ❌ BAD: Sequential individual API calls
async function fetchSessionDetails(sessionIds) {
  const sessions = [];

  for (const id of sessionIds) {
    // Each call = 1 API request
    const session = await hubspot.getMockExam(id);  // ⚠️ 100+ API calls!
    sessions.push(session);
  }

  return sessions;  // Takes 10+ seconds, hits rate limit
}

// Result:
// - 100 sessions = 100 API calls
// - Exceeds 100 calls/10s limit
// - Triggers 429 errors
// - Requires retry delays
// - Total time: 15-30 seconds
```

**Solution With Batch Operations**:

```javascript
// ✅ GOOD: Single batch API call
async function fetchSessionDetails(sessionIds) {
  // Single batch call fetches up to 100 records
  const response = await hubspot.apiCall('POST',
    `/crm/v3/objects/2-50158913/batch/read`, {
      inputs: sessionIds.map(id => ({ id })),
      properties: ['mock_type', 'exam_date', 'start_time', ...]
    }
  );

  return response.results;  // All sessions in one call
}

// Result:
// - 100 sessions = 1 API call
// - Well within rate limits
// - No retry delays needed
// - Total time: <500ms
```

**Performance Comparison**:

| Approach | API Calls | Time | Rate Limit Risk |
|----------|-----------|------|-----------------|
| Individual | 100 calls | 15-30s | **HIGH** ❌ |
| Batch | 1 call | <500ms | **NONE** ✅ |

---

### **Batch API Best Practices**

#### **1. Batch Read (Retrieving Multiple Records)**

**Endpoint**: `POST /crm/v3/objects/{objectType}/batch/read`

**Limits**:
- **Max records per batch**: 100
- **Recommendation**: Keep batches ≤ 50 for reliability
- **Multiple batches**: Split into chunks if > 100 records needed

**Example Implementation**:
```javascript
async function batchFetchSessions(sessionIds) {
  const BATCH_SIZE = 50;  // Conservative batch size
  const batches = [];

  // Split into chunks of 50
  for (let i = 0; i < sessionIds.length; i += BATCH_SIZE) {
    const chunk = sessionIds.slice(i, i + BATCH_SIZE);
    batches.push(chunk);
  }

  // Execute batches sequentially (avoid parallel rate limit issues)
  const allResults = [];
  for (const batchIds of batches) {
    const response = await this.apiCall('POST',
      `/crm/v3/objects/2-50158913/batch/read`, {
        inputs: batchIds.map(id => ({ id })),
        properties: [
          'mock_type', 'exam_date', 'start_time', 'end_time',
          'capacity', 'total_bookings', 'location', 'is_active'
        ]
      }
    );

    allResults.push(...response.results);
  }

  return allResults;
}
```

#### **2. Batch Create (Creating Multiple Records)**

**Already Implemented**: `api/_shared/hubspot.js:batchCreateMockExams()`

**Usage Example**:
```javascript
// In /api/admin/mock-exams/bulk-create.js
const result = await hubspot.batchCreateMockExams(commonProperties, timeSlots);

// Creates up to 100 mock exams in a single API call
// vs 100 individual calls (100x reduction!)
```

#### **3. Batch Update (Updating Multiple Records)**

**Endpoint**: `POST /crm/v3/objects/{objectType}/batch/update`

**Use Case**: Bulk status changes, capacity adjustments

```javascript
async function batchUpdateSessions(updates) {
  const response = await this.apiCall('POST',
    `/crm/v3/objects/2-50158913/batch/update`, {
      inputs: updates.map(update => ({
        id: update.id,
        properties: update.properties
      }))
    }
  );

  return response.results;
}
```

---

### **Implementation Requirements for This PRD**

#### **Phase 1: Aggregation Endpoint**

**MUST USE**: Batch read when fetching session details for expanded aggregates

**Location**: `api/admin/mock-exams/aggregates/[key]/sessions.js`

```javascript
module.exports = async (req, res) => {
  try {
    const { aggregate_key } = req.params;

    // 1. Get session IDs from aggregate (from cache or query)
    const aggregate = await getAggregate(aggregate_key);
    const sessionIds = aggregate.session_ids;  // e.g., 10-50 IDs

    // ✅ CRITICAL: Use batch read instead of individual calls
    const sessions = await hubspot.batchFetchMockExams(sessionIds);

    res.json({ success: true, sessions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
```

**New Method Required**: `hubspot.batchFetchMockExams(sessionIds)`

```javascript
// In api/_shared/hubspot.js

async batchFetchMockExams(sessionIds) {
  if (!sessionIds || sessionIds.length === 0) {
    return [];
  }

  const BATCH_SIZE = 50;
  const batches = [];

  // Split into chunks
  for (let i = 0; i < sessionIds.length; i += BATCH_SIZE) {
    batches.push(sessionIds.slice(i, i + BATCH_SIZE));
  }

  // Fetch all batches
  const allResults = [];
  for (const batchIds of batches) {
    const response = await this.apiCall('POST',
      `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/batch/read`, {
        properties: [
          'mock_type', 'exam_date', 'start_time', 'end_time',
          'capacity', 'total_bookings', 'location', 'is_active',
          'hs_createdate', 'hs_lastmodifieddate'
        ],
        inputs: batchIds.map(id => ({ id }))
      }
    );

    if (response.results) {
      allResults.push(...response.results);
    }
  }

  return allResults;
}
```

#### **Phase 2: Aggregation Query Optimization**

**Initial Aggregate Fetch**: Use search API (already optimized)

```javascript
// In api/admin/mock-exams/aggregates.js

const allExams = await hubspot.searchMockExams({
  limit: 1000,  // ⚠️ Single search query, not 1000 individual calls
  filters: {...}
});

// HubSpot search API returns up to 1000 results in ONE call
// This is already efficient - no batch operation needed
```

**Key Insight**: The initial aggregation uses HubSpot's **search API**, which is designed for bulk retrieval. This is already optimal.

---

### **Monitoring & Alerting**

#### **Add API Call Tracking**

**Backend Logging**:
```javascript
// In api/_shared/hubspot.js:apiCall()

console.log(`📊 [HubSpot API] ${method} ${endpoint}`);
console.log(`⏱️ [Response Time] ${responseTime}ms`);

// Track rate limit headers
const remaining = response.headers['x-hubspot-ratelimit-remaining'];
const max = response.headers['x-hubspot-ratelimit-limit'];
console.log(`🔢 [Rate Limit] ${remaining}/${max} calls remaining`);
```

**Warning Thresholds**:
```javascript
if (remaining < 20) {
  console.warn(`⚠️ [Rate Limit Warning] Only ${remaining} calls remaining!`);
}

if (remaining < 5) {
  console.error(`🚨 [Rate Limit Critical] Only ${remaining} calls left!`);
  // Consider delaying next request
  await sleep(500);
}
```

#### **Cache Strategy to Reduce API Calls**

**Aggressive Caching for Aggregates**:
```javascript
// Aggregate lists: 2-minute TTL
await cache.set(`admin:mock-exams:aggregates:${filters}`, data, 120);

// Individual aggregate sessions: 5-minute TTL
await cache.set(`admin:aggregate:sessions:${key}`, sessions, 300);

// Result: 95%+ cache hit rate = 95% fewer API calls
```

---

### **Success Metrics**

**API Call Efficiency Targets**:

| Scenario | Max API Calls | Current | With Batch | Improvement |
|----------|---------------|---------|------------|-------------|
| Load aggregates | 1 | 1 | 1 | No change (already optimal) |
| Expand 1 aggregate (50 sessions) | 1 | 50 | 1 | **50x reduction** ✅ |
| Expand 5 aggregates (250 sessions) | 5 | 250 | 5 | **50x reduction** ✅ |
| Bulk create 100 sessions | 1 | 100 | 1 | **100x reduction** ✅ |

**Rate Limit Compliance**:
- ✅ Stay below 80 calls per 10-second window (20% safety buffer)
- ✅ Monitor daily usage stays below 5,000 calls (50% of limit)
- ✅ Zero 429 rate limit errors in production

**Performance Targets**:
- ✅ Aggregate expansion: <500ms (including batch API call)
- ✅ Bulk operations: <2s for 100 records
- ✅ Cache hit rate: >90% for session details

---

### **Testing Requirements**

**Load Testing with API Call Monitoring**:

```javascript
// Test script: tests/load/api-limits.test.js

describe('API Rate Limit Compliance', () => {
  test('Expanding aggregate uses batch API (1 call, not N)', async () => {
    const apiCallsSpy = jest.spyOn(hubspot, 'apiCall');

    const aggregate = { session_ids: Array(50).fill().map((_, i) => `id_${i}`) };
    await fetchAggregateSessions(aggregate.aggregate_key);

    // Should be exactly 1 batch call, not 50 individual calls
    expect(apiCallsSpy).toHaveBeenCalledTimes(1);
    expect(apiCallsSpy).toHaveBeenCalledWith('POST',
      expect.stringContaining('batch/read'),
      expect.objectContaining({ inputs: expect.arrayContaining([{ id: 'id_0' }]) })
    );
  });

  test('Large aggregate (100+ sessions) uses multiple batches', async () => {
    const apiCallsSpy = jest.spyOn(hubspot, 'apiCall');

    const aggregate = { session_ids: Array(120).fill().map((_, i) => `id_${i}`) };
    await fetchAggregateSessions(aggregate.aggregate_key);

    // Should use 3 batches (50 + 50 + 20)
    expect(apiCallsSpy).toHaveBeenCalledTimes(3);
  });
});
```

---

### **Rollback Plan**

**If Rate Limits Are Hit in Production**:

1. **Immediate**: Increase cache TTL to 5 minutes
   ```javascript
   await cache.set(key, data, 300);  // Was 120, now 300
   ```

2. **Short-term**: Add request queuing
   ```javascript
   const queue = new PQueue({ concurrency: 1, interval: 100 });
   await queue.add(() => hubspot.apiCall(...));
   ```

3. **Long-term**: Upgrade HubSpot tier for higher limits
   - Professional: 150 calls/10s
   - Enterprise: 200 calls/10s

---

## 👥 **User Impact**

### **Who will this affect?**
- [X] PrepDoctors admin staff (primary users)
- [X] System administrators

### **User Stories**

**As an admin**, I want to see a clean overview of all exam dates and locations at a glance, so that I can quickly identify scheduling gaps without scrolling through hundreds of individual time slots.

**As an admin**, I want to expand a specific date to see all individual session details, so that I can manage capacity, bookings, and statuses for each time slot.

**As an admin**, I want filters to operate on the aggregate level, so that when I select "Calgary" as location, I see all dates that have Calgary sessions without duplicates.

### **User Experience Flow**

1. **Dashboard Load**: Admin navigates to `/dashboard`
   - Table shows ~20 aggregate rows per page
   - Each row shows: Mock Type, Date, Location, Session Count
   - Collapsed by default (faster initial load)

2. **Filtering**: Admin filters by "Calgary" + "December 2024"
   - Table updates to show only aggregates matching filters
   - Pagination resets to page 1
   - Each aggregate still collapsed

3. **Expanding**: Admin clicks on "Clinical Skills - Calgary - Dec 4"
   - Loading indicator appears briefly
   - Individual sessions load and display in nested table
   - Shows all 10 time slots with full details
   - Admin can edit, view metrics, change status on individual sessions

4. **Collapsing**: Admin clicks again on the same aggregate
   - Sessions collapse back into single row
   - Faster navigation through other dates

---

## 🧪 **Testing Requirements**

### **Backend Testing**

**Unit Tests** (`api/admin/mock-exams/aggregates.test.js`):
```javascript
describe('Mock Exam Aggregation API', () => {
  test('Groups exams by type, date, and location', async () => {
    const mockExams = [
      { id: '1', mock_type: 'Clinical', date: '2024-12-04', location: 'Calgary' },
      { id: '2', mock_type: 'Clinical', date: '2024-12-04', location: 'Calgary' },
      { id: '3', mock_type: 'Clinical', date: '2024-12-05', location: 'Calgary' }
    ];
    
    const aggregates = await aggregateMockExams(mockExams);
    
    expect(aggregates).toHaveLength(2);  // 2 unique combinations
    expect(aggregates[0].session_count).toBe(2);
  });
  
  test('Caches aggregate results for 2 minutes', async () => {
    const filters = { page: 1, location: 'Calgary' };
    
    await request(app).get('/api/admin/mock-exams/aggregates').query(filters);
    
    const cacheKey = `admin:mock-exams:aggregates:${JSON.stringify(filters)}`;
    const cached = await cache.get(cacheKey);
    
    expect(cached).not.toBeNull();
  });
  
  test('Returns paginated aggregate results', async () => {
    const response = await request(app)
      .get('/api/admin/mock-exams/aggregates')
      .query({ page: 1, limit: 10 });
    
    expect(response.body.data).toHaveLength(10);
    expect(response.body.pagination.total_pages).toBeGreaterThan(1);
  });
});
```

**Integration Tests**:
```javascript
describe('Aggregate Sessions Endpoint', () => {
  test('Fetches full session details for aggregate key', async () => {
    const key = 'clinical_skills_mississauga_2024-12-04';
    
    const response = await request(app)
      .get(`/api/admin/mock-exams/aggregates/${key}/sessions`);
    
    expect(response.body.sessions).toHaveLength(10);
    expect(response.body.sessions[0]).toHaveProperty('capacity');
  });
  
  test('Caches individual aggregate sessions', async () => {
    const key = 'clinical_skills_mississauga_2024-12-04';
    
    await request(app).get(`/api/admin/mock-exams/aggregates/${key}/sessions`);
    
    const cached = await cache.get(`admin:aggregate:sessions:${key}`);
    expect(cached).not.toBeNull();
  });
});
```

### **Frontend Testing**

**Component Tests** (`AggregateRow.test.jsx`):
```javascript
describe('AggregateRow Component', () => {
  test('Renders collapsed aggregate row by default', () => {
    const aggregate = {
      mock_type: 'Clinical Skills',
      location: 'Calgary',
      exam_date: '2024-12-04',
      session_count: 10
    };
    
    render(<AggregateRow aggregate={aggregate} />);
    
    expect(screen.getByText('Clinical Skills')).toBeInTheDocument();
    expect(screen.getByText(/10 sessions/)).toBeInTheDocument();
  });
  
  test('Expands to show sessions when clicked', async () => {
    const aggregate = { aggregate_key: 'test_key', ... };
    
    render(<AggregateRow aggregate={aggregate} />);
    
    const row = screen.getByRole('row');
    fireEvent.click(row);
    
    await waitFor(() => {
      expect(screen.getByText('09:00 AM - 11:00 AM')).toBeInTheDocument();
    });
  });
  
  test('Collapses sessions when clicked again', async () => {
    const aggregate = { aggregate_key: 'test_key', ... };
    
    render(<AggregateRow aggregate={aggregate} />);
    
    const row = screen.getByRole('row');
    
    // Expand
    fireEvent.click(row);
    await waitFor(() => expect(screen.getByText('09:00 AM')).toBeInTheDocument());
    
    // Collapse
    fireEvent.click(row);
    await waitFor(() => expect(screen.queryByText('09:00 AM')).not.toBeInTheDocument());
  });
});
```

### **Manual Testing Checklist**

- [ ] Load dashboard with 100+ mock exam sessions (verify performance)
- [ ] Verify aggregates display correct session counts
- [ ] Test expanding/collapsing multiple aggregates simultaneously
- [ ] Verify filters update aggregates correctly (location, type, date, status)
- [ ] Test sorting aggregates by date, location, mock type
- [ ] Verify pagination works at aggregate level (not session level)
- [ ] Test cache hit/miss scenarios (check browser console logs)
- [ ] Verify Redis cache invalidation after creating/updating/deleting exams
- [ ] Test accessibility (keyboard navigation to expand/collapse)
- [ ] Verify mobile responsive design for accordion UI
- [ ] Test dark mode rendering

---

## 🚀 **Implementation Phases**

### **Phase 1: Backend Aggregation Logic** (Week 1: Days 1-3)

**Tasks**:
1. ✅ Create `api/_shared/aggregation.js` utility
   - `aggregateMockExams(exams)` function
   - Grouping logic by type + date + location

2. ✅ Create `api/admin/mock-exams/aggregates.js` endpoint
   - Implement filtering, sorting, pagination for aggregates
   - Add Redis caching with 2-minute TTL
   - Write comprehensive error handling

3. ✅ **CRITICAL**: Create `api/admin/mock-exams/aggregates/[key]/sessions.js` endpoint
   - **MUST USE**: Batch API for fetching session details (see Batch API section)
   - Implement `hubspot.batchFetchMockExams(sessionIds)` method
   - Batch size: 50 records per API call (conservative limit)
   - Add Redis caching with 5-minute TTL
   - **API Call Target**: 1 call per 50 sessions (vs 50 individual calls)

4. ✅ Implement `hubspot.batchFetchMockExams()` in `api/_shared/hubspot.js`
   - Split session IDs into batches of 50
   - Use `POST /crm/v3/objects/2-50158913/batch/read`
   - Handle multiple batches sequentially
   - Return all results combined

5. ✅ Update cache invalidation logic
   - In `create.js`, `update.js`, `delete.js`, `bulk-create.js`
   - Add `await cache.deletePattern('admin:mock-exams:aggregates:*')`
   - Add `await cache.deletePattern('admin:aggregate:sessions:*')`

6. ✅ Add rate limit monitoring to `hubspot.js:apiCall()`
   - Log remaining API calls from response headers
   - Warn when < 20 calls remaining
   - Alert when < 5 calls remaining

**Deliverables**:
- 2 new API endpoints fully functional
- Batch API implementation for session fetching
- Redis caching implemented
- Rate limit monitoring active
- Unit tests passing (>80% coverage)
- API call efficiency: 50x reduction confirmed

**Testing**:
- Run `npm test -- api/admin/mock-exams/aggregates.test.js`
- Run `npm test -- tests/load/api-limits.test.js` (batch API verification)

---

### **Phase 2: Frontend Components** (Week 1: Days 4-5)

**Tasks**:
1. ✅ Create `admin_frontend/src/components/AggregateRow.jsx`
   - Accordion UI with expand/collapse
   - Display mock type, date, location, session count
   - Integrate with session fetching on expand

2. ✅ Create `admin_frontend/src/components/SessionRow.jsx`
   - Extract existing table row logic from `MockExamsTable.jsx`
   - Refactor to accept `session` prop
   - Maintain all existing functionality (edit, delete, status)

3. ✅ Update `admin_frontend/src/hooks/useMockExamsData.js`
   - Create new hook: `useFetchAggregates(filters)`
   - Create new hook: `useFetchAggregateSessions(key, { enabled })`
   - Use React Query for caching

**Deliverables**:
- 2 new React components
- 2 new custom hooks
- Existing SessionRow logic refactored

**Testing**: Run `npm test -- AggregateRow.test.jsx SessionRow.test.jsx`

---

### **Phase 3: Table Integration** (Week 2: Days 1-2)

**Tasks**:
1. ✅ Update `admin_frontend/src/components/MockExamsTable.jsx`
   - Replace individual row rendering with `AggregateRow` components
   - Update infinite scroll to work with aggregate pagination
   - Handle loading and error states

2. ✅ Update `admin_frontend/src/pages/MockExamsDashboard.jsx`
   - Use `useFetchAggregates` instead of `useMockExamsData`
   - Update metrics calculation to work with aggregates (optional)

3. ✅ Update `admin_frontend/src/components/FilterBar.jsx`
   - Ensure filters work correctly with aggregate API
   - Update filter state management if needed

**Deliverables**:
- Dashboard displays aggregate rows successfully
- All existing filters work with new structure
- Metrics dashboard updated (if needed)

**Testing**: Manual testing of full user flow

---

### **Phase 4: Performance Optimization** (Week 2: Days 3-4)

**Tasks**:
1. ✅ Implement query key normalization
   - Sort filter parameters to ensure cache hits
   - `JSON.stringify(sortedParams)` in cache keys

2. ✅ Add loading skeletons
   - Skeleton UI while aggregates are loading
   - Skeleton UI while sessions are expanding

3. ✅ Optimize React Query settings
   - Set appropriate `staleTime` and `cacheTime`
   - Implement prefetching for adjacent pages

4. ✅ Performance monitoring
   - Add console logs for cache hits/misses
   - Monitor Redis memory usage
   - Track API response times

**Deliverables**:
- Cache hit rate >85%
- Initial page load <500ms (with cache)
- Session expansion <300ms (with cache)

**Testing**: Load test with 500+ mock exam sessions

---

### **Phase 5: Polish & Documentation** (Week 2: Day 5)

**Tasks**:
1. ✅ Update documentation
   - Update `README.md` with aggregate API details
   - Update `CURRENT_APP_STATE.md` with new component architecture
   - Update `CACHING_STRATEGY.md` with new cache keys

2. ✅ Accessibility improvements
   - ARIA labels for expand/collapse buttons
   - Keyboard navigation (Enter/Space to toggle)
   - Screen reader announcements for state changes

3. ✅ Mobile responsiveness
   - Test accordion UI on mobile devices
   - Adjust padding/spacing for smaller screens

4. ✅ Dark mode verification
   - Verify all UI elements render correctly in dark mode

**Deliverables**:
- Complete documentation
- Accessibility compliance (WCAG 2.1 AA)
- Mobile-responsive design verified

**Testing**: Full regression testing on staging

---

## ✅ **Success Criteria**

### **Functional Requirements**
- ✅ Dashboard displays aggregate rows grouped by type, date, and location
- ✅ Each aggregate row can be expanded to show individual sessions
- ✅ All existing functionality (edit, delete, status, capacity) works on individual sessions
- ✅ Filters operate on aggregates (not individual sessions)
- ✅ Pagination works at the aggregate level
- ✅ Cache invalidation works correctly after mutations

### **Performance Requirements**
- ✅ Initial dashboard load: <500ms (cached aggregates)
- ✅ Session expansion: <300ms (cached sessions)
- ✅ Cache hit rate: >85% for aggregate queries
- ✅ Redis memory usage: <50MB for aggregate caches

### **API Efficiency Requirements** (Critical for HubSpot Rate Limits)
- ✅ **Batch API Usage**: Session expansion uses batch/read endpoint (1 call vs N calls)
- ✅ **API Call Reduction**: 50x reduction confirmed (50 sessions = 1 call, not 50)
- ✅ **Rate Limit Compliance**: Stay below 80 calls per 10-second window
- ✅ **Zero 429 Errors**: No rate limit errors in production
- ✅ **Daily API Budget**: Stay below 5,000 calls/day (50% of limit)
- ✅ **Rate Limit Monitoring**: Active logging of remaining API calls

### **User Experience Requirements**
- ✅ Clicking an aggregate row expands/collapses smoothly
- ✅ Visual indication of expanded vs collapsed state (icon rotation)
- ✅ Session count badge visible on each aggregate
- ✅ Loading states display during data fetching
- ✅ Accordion UI is intuitive and requires no training

---

## 📊 **Metrics & Monitoring**

### **Key Performance Indicators (KPIs)**
1. **Cache Efficiency**
   - Aggregate cache hit rate: Target >85%
   - Session cache hit rate: Target >90%
   - Redis memory usage: Monitor daily

2. **User Engagement**
   - Average aggregates viewed per session
   - Percentage of aggregates expanded
   - Time spent on dashboard (should decrease with better organization)

3. **API Performance**
   - Average aggregate API response time: <100ms (cached), <400ms (uncached)
   - Average session API response time: <80ms (cached), <300ms (uncached)

### **Monitoring Strategy**
```javascript
// Backend logging
console.log(`🎯 [Cache HIT] Aggregates: ${cacheKey.substring(0, 80)}...`);
console.log(`📋 [Cache MISS] Fetching aggregates from HubSpot...`);
console.log(`💾 [Cached] ${aggregates.length} aggregates for 2 minutes`);

// Frontend logging (in useFetchAggregates hook)
console.log(`📊 Aggregate API call: ${queryTime}ms`);
console.log(`🔄 Expanded aggregate: ${aggregate_key}`);
```

---

## ⚠️ **Risks & Mitigations**

### **Risk 1: Performance Degradation with Large Datasets**
**Scenario**: Aggregating 1000+ mock exams takes >5 seconds
**Likelihood**: Medium  
**Impact**: High  
**Mitigation**:
- Implement Redis caching with 2-minute TTL
- Limit HubSpot query to 1000 results per request
- Use indexed properties in HubSpot for faster queries
- Add pagination at aggregate level

### **Risk 2: Complex State Management**
**Scenario**: Multiple aggregates expanded simultaneously causes memory issues
**Likelihood**: Low  
**Impact**: Medium  
**Mitigation**:
- Lazy load session details only when expanded
- Collapse previous aggregate when opening new one (optional UX pattern)
- Use React Query's garbage collection to clean up unused data

### **Risk 3: Cache Inconsistency**
**Scenario**: User creates exam but aggregate doesn't update immediately
**Likelihood**: Medium  
**Impact**: Medium  
**Mitigation**:
- Invalidate ALL aggregate caches on create/update/delete
- Use React Query's `invalidateQueries` on frontend
- Add manual "Refresh" button as fallback

### **Risk 4: Breaking Existing Functionality**
**Scenario**: Refactoring table breaks edit/delete actions
**Likelihood**: Low  
**Impact**: High  
**Mitigation**:
- Extract SessionRow component without changing logic
- Comprehensive testing of all CRUD operations
- Staged rollout: Test in staging for 1 week before production

---

## 🎨 **Design Specifications**

### **Visual Design (Inspired by Calendly, but using PrepDoctors styling)**

**Aggregate Row (Collapsed)**:
```
┌────────────────────────────────────────────────────────────┐
│ ▶  Clinical Skills - Mississauga                           │
│    December 4, 2024 · 10 sessions                          │
└────────────────────────────────────────────────────────────┘
```

**Aggregate Row (Expanded)**:
```
┌────────────────────────────────────────────────────────────┐
│ ▼  Clinical Skills - Mississauga                           │
│    December 4, 2024 · 10 sessions                          │
├────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐ │
│  │ 09:00 AM - 11:00 AM  | 18/25 | 72% | Active | [Edit]│ │
│  ├──────────────────────────────────────────────────────┤ │
│  │ 11:30 AM - 01:30 PM  | 20/25 | 80% | Active | [Edit]│ │
│  ├──────────────────────────────────────────────────────┤ │
│  │ 02:00 PM - 04:00 PM  | 15/25 | 60% | Active | [Edit]│ │
│  └──────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

**Color Palette** (from existing PrepDoctors theme):
- Primary Blue: `#0A74DA` (from PrepDoctors Brand Guide)
- Teal/Cyan: `#4ECDC4` (accent color from Brand Guide)
- Dark Mode Background: `#1a1a1a`
- Light Mode Background: `#ffffff`

### **Styling Guidelines**
- **DO**: Use existing Tailwind utility classes from current components
- **DO**: Maintain consistent spacing with `px-6 py-4` padding
- **DO**: Use existing hover states (`hover:bg-gray-50 dark:hover:bg-gray-800`)
- **DON'T**: Create new color classes outside the PrepDoctors palette
- **DON'T**: Copy Calendly's exact visual design (use it as functional inspiration only)

---

## 📝 **Appendix**

### **Alternative Approaches Considered**

**Option 1: Client-Side Aggregation**
- **Pros**: Simpler backend, no new endpoints
- **Cons**: Slower initial load, more memory usage, no caching benefits
- **Decision**: Rejected due to performance concerns

**Option 2: Server-Side Rendering (SSR)**
- **Pros**: Faster initial page load
- **Cons**: Requires major architecture change, complex state management
- **Decision**: Rejected due to high implementation cost

**Option 3: GraphQL Aggregation**
- **Pros**: Flexible querying, reduce over-fetching
- **Cons**: Requires new GraphQL layer, steep learning curve
- **Decision**: Deferred to future optimization phase

---

## 🔗 **Related Documents**

- `CURRENT_APP_STATE.md` - Current dashboard architecture
- `CACHING_STRATEGY.md` - Redis caching implementation details
- `README.md` - Project overview and tech stack
- `HUBSPOT_SCHEMA_DOCUMENTATION.md` - Mock Exam object schema

---

## ✍️ **Sign-off**

**Product Owner**: ____________________ Date: ___________  
**Technical Lead**: ____________________ Date: ___________  
**QA Lead**: ____________________ Date: ___________

---

**End of PRD**