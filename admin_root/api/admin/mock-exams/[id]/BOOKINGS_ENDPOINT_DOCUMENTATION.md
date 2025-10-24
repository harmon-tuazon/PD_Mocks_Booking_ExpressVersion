# Mock Exam Bookings Endpoint Documentation

## Endpoint: GET /api/admin/mock-exams/[id]/bookings

Fetches all bookings associated with a specific mock exam from HubSpot.

### Features
- ✅ Fetches bookings linked to a mock exam via HubSpot associations
- ✅ Supports pagination with configurable page size
- ✅ Supports sorting by multiple fields
- ✅ Implements search filtering by name or email
- ✅ Redis caching with 2-minute TTL for performance
- ✅ Returns detailed booking information including contact details
- ✅ Proper 404 handling for non-existent mock exams

### Authentication
- **Required**: Admin authentication via `requireAdmin` middleware
- **Headers**: `Authorization: Bearer <admin-token>`

### URL Parameters
- `id` (required): The HubSpot ID of the mock exam (numeric string)

### Query Parameters

| Parameter | Type | Default | Description | Valid Options |
|-----------|------|---------|-------------|---------------|
| `page` | number | 1 | Page number for pagination | Any positive integer |
| `limit` | number | 50 | Number of items per page | 1-100 (capped at 100) |
| `sort_by` | string | "created_at" | Field to sort by | "created_at", "name", "email" |
| `sort_order` | string | "desc" | Sort direction | "asc", "desc" |
| `search` | string | null | Search term for filtering | Any string (searches name and email) |

### Response Format

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "bookings": [
      {
        "id": "35610479159",
        "booking_id": "USMLE Step 1-John Doe - 2025-01-15",
        "name": "John Doe",
        "email": "john.doe@example.com",
        "student_id": "STU123456",
        "dominant_hand": "right",
        "contact_id": "12345",
        "created_at": "2025-01-10T14:30:00Z",
        "updated_at": "2025-01-10T14:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total_bookings": 127,
      "total_pages": 3,
      "has_next": true,
      "has_prev": false
    }
  },
  "meta": {
    "timestamp": "2025-01-15T10:00:00Z",
    "cached": false,
    "exam_id": "123456789",
    "search_term": null,
    "sort": {
      "field": "created_at",
      "order": "desc"
    }
  }
}
```

### Field Descriptions

#### Booking Object
- `id`: HubSpot record ID for the booking
- `booking_id`: Display name format "MockType-Name - Date"
- `name`: Student's full name
- `email`: Student's email address
- `student_id`: PrepDoctors student identifier
- `dominant_hand`: "right", "left", or "not specified" (for clinical skills bookings)
- `contact_id`: Associated HubSpot contact ID
- `created_at`: ISO timestamp when booking was created
- `updated_at`: ISO timestamp of last modification

#### Pagination Object
- `page`: Current page number
- `limit`: Items per page
- `total_bookings`: Total number of bookings for this exam
- `total_pages`: Total number of pages available
- `has_next`: Boolean indicating if there's a next page
- `has_prev`: Boolean indicating if there's a previous page

#### Meta Object
- `timestamp`: Response generation timestamp
- `cached`: Boolean indicating if response was served from cache
- `exam_id`: The mock exam ID requested
- `search_term`: Search term used (null if no search)
- `sort`: Object containing sort field and order used

### Error Responses

#### 400 Bad Request
```json
{
  "success": false,
  "error": "Invalid sort_by field. Valid options: created_at, name, email"
}
```
Possible reasons:
- Missing mock exam ID
- Invalid ID format (non-numeric)
- Invalid sort_by field
- Invalid sort_order value

#### 401 Unauthorized
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```
Reason: Missing or invalid authentication token

#### 404 Not Found
```json
{
  "success": false,
  "error": "Mock exam not found"
}
```
Reason: The specified mock exam ID doesn't exist in HubSpot

#### 500 Server Error
```json
{
  "success": false,
  "error": {
    "code": "SERVER_ERROR",
    "message": "Failed to fetch bookings for mock exam",
    "details": "Error details (development mode only)"
  }
}
```
Reason: Unexpected server error or HubSpot API issue

### Usage Examples

#### Basic Request
```bash
curl -X GET "https://api.example.com/api/admin/mock-exams/123456789/bookings" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

#### With Pagination
```bash
curl -X GET "https://api.example.com/api/admin/mock-exams/123456789/bookings?page=2&limit=20" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

#### With Search and Sorting
```bash
curl -X GET "https://api.example.com/api/admin/mock-exams/123456789/bookings?search=john&sort_by=name&sort_order=asc" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Implementation Details

#### HubSpot Integration
- Uses HubSpot Search API to find bookings with `mock_exam_id` property matching the requested ID
- Fetches booking properties: booking_id, name, email, student_id, dominant_hand, contact_id, timestamps
- Handles HubSpot pagination internally to retrieve all bookings before applying filters

#### Caching Strategy
- Cache key format: `admin:mock-exam:{id}:bookings:p{page}:l{limit}:{sort_by}:{sort_order}[:s{searchBase64}]`
- TTL: 120 seconds (2 minutes)
- Cache is parameter-specific to ensure accurate results for different queries
- Search terms are base64-encoded in cache keys to handle special characters

#### Performance Considerations
- All bookings are fetched from HubSpot first (using pagination if needed)
- Filtering and sorting are performed in-memory for better control
- Client-side pagination is applied after filtering and sorting
- Redis caching significantly improves response times for repeated queries

### Testing

Use the provided test script to verify functionality:
```bash
node admin_root/tests/test-mock-exam-bookings-endpoint.js [mockExamId]
```

The test suite includes:
- Basic functionality tests
- Pagination tests
- Sorting tests
- Search filtering tests
- Cache behavior verification
- Error handling tests
- 404 response validation

### Related Endpoints
- `GET /api/admin/mock-exams/list` - List all mock exams
- `GET /api/admin/mock-exams/[id]` - Get single mock exam details
- `GET /api/admin/mock-exams/aggregates` - Get aggregated mock exam data
- `GET /api/admin/mock-exams/aggregates/[key]/sessions` - Get sessions for an aggregate