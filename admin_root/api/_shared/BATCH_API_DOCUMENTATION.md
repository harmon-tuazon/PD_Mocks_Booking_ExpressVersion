# Batch API Operations for Mock Exams

## Overview
The batch API operations have been added to optimize the admin accordion view feature by reducing the number of API calls to HubSpot.

## New Methods

### 1. `batchFetchMockExams(sessionIds)`
Fetches multiple mock exam sessions in a single API call instead of making individual calls.

**Parameters:**
- `sessionIds` (Array<string>): Array of mock exam session IDs to fetch

**Returns:**
- Array of mock exam objects with their properties

**Benefits:**
- Reduces API calls by 50x (50 sessions = 1 call instead of 50 calls)
- Automatically handles batching (splits into chunks of 50)
- Continues processing even if one batch fails

**Example:**
```javascript
const sessionIds = ['123', '456', '789'];
const mockExams = await hubspot.batchFetchMockExams(sessionIds);
```

### 2. `fetchMockExamsForAggregation(filters)`
Fetches and aggregates mock exams by mock type, location, and exam date.

**Parameters:**
- `filters` (Object): Filter options
  - `filter_location` (string): Location to filter by
  - `filter_mock_type` (string): Mock type to filter by
  - `filter_date_from` (string): Start date (YYYY-MM-DD)
  - `filter_date_to` (string): End date (YYYY-MM-DD)
  - `filter_status` (string): 'active' or 'inactive'

**Returns:**
- Array of aggregated groups with:
  - `aggregate_key`: Unique key for the group
  - `mock_type`: Type of mock exam
  - `exam_date`: Date of the exam
  - `location`: Exam location
  - `session_ids`: Array of session IDs in this group
  - `session_count`: Number of sessions in this group
  - `total_capacity`: Combined capacity of all sessions
  - `total_bookings`: Combined bookings across all sessions

**Example:**
```javascript
const aggregates = await hubspot.fetchMockExamsForAggregation({
  filter_status: 'active',
  filter_location: 'London',
  filter_date_from: '2025-01-01'
});
```

### 3. Rate Limit Monitoring in `apiCall()`
The `apiCall` method now monitors HubSpot rate limit headers and provides warnings:

**Warnings:**
- ⚠️ Warning when < 20 API calls remaining in current second
- 🚨 Critical alert when < 5 API calls remaining
- ⚠️ Daily limit warning when < 1000 calls remaining for the day

## Usage in Admin Dashboard

The accordion view will use these methods as follows:

1. **Initial Load**: Call `fetchMockExamsForAggregation()` to get grouped data
2. **Expand Accordion**: Call `batchFetchMockExams()` with session IDs from the group
3. **Rate Monitoring**: Automatic warnings help prevent hitting rate limits

## Rate Limits
- HubSpot allows 100 API calls per 10 seconds
- Daily limit is 10,000 API calls
- Batch operations use 50 records per call (conservative to stay within limits)

## Error Handling
- Batch operations continue processing even if individual batches fail
- Errors are logged but don't stop the entire operation
- Empty arrays return empty results without making API calls