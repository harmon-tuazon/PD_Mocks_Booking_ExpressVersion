# Trainee Dashboard API Endpoints

## Overview
These API endpoints provide trainee search and booking history functionality for the Admin Dashboard. The endpoints integrate with HubSpot CRM to retrieve contact information and associated bookings.

## Authentication
All endpoints require admin authentication via the `requireAdmin` middleware. Include a valid authentication token in the request headers.

## Endpoints

### 1. Search Trainees
**Endpoint:** `GET /api/admin/trainees/search`

**Description:** Search for trainees in HubSpot CRM by student ID, name, or email.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| query | string | Yes | Search term (min 2, max 100 characters) |
| debug | boolean | No | Set to true to bypass cache (default: false) |

**Features:**
- Exact match on student ID
- Partial match on firstname, lastname, or email
- Returns maximum 10 results
- Redis caching with 5-minute TTL

**Response:**
```json
{
  "success": true,
  "data": {
    "contacts": [
      {
        "id": "12345",
        "firstname": "John",
        "lastname": "Doe",
        "email": "john.doe@example.com",
        "phone": "+1234567890",
        "student_id": "1599999",
        "ndecc_exam_date": "2026-01-15"
      }
    ]
  },
  "meta": {
    "timestamp": "2025-10-31T12:00:00Z",
    "cached": false,
    "total_results": 1
  }
}
```

**Error Responses:**
- `400` - Validation error (query too short/long)
- `401` - Authentication required
- `500` - Server error

### 2. Get Trainee Bookings
**Endpoint:** `GET /api/admin/trainees/[contactId]/bookings`

**Description:** Retrieve all bookings associated with a specific trainee (contact).

**URL Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| contactId | string | Yes | HubSpot contact ID (numeric) |

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| debug | boolean | No | Set to true to bypass cache (default: false) |
| include_inactive | boolean | No | Include inactive/cancelled bookings (default: false) |

**Features:**
- Validates contact exists in HubSpot
- Fetches associated bookings via HubSpot Associations API
- Includes mock exam details for each booking
- Calculates summary statistics
- Filters Active and Completed bookings by default
- Redis caching with 5-minute TTL

**Response:**
```json
{
  "success": true,
  "data": {
    "trainee": {
      "id": "12345",
      "firstname": "John",
      "lastname": "Doe",
      "email": "john.doe@example.com",
      "phone": "+1234567890",
      "student_id": "1599999",
      "ndecc_exam_date": "2026-01-15"
    },
    "bookings": [
      {
        "id": "67890",
        "mock_exam_id": "111",
        "mock_exam_type": "Mini-mock",
        "exam_date": "2026-01-01",
        "booking_date": "2025-12-01",
        "attendance": "Yes",
        "attending_location": "Mississauga",
        "token_used": "Shared Token",
        "is_active": "Completed"
      }
    ],
    "summary": {
      "total_bookings": 5,
      "active_bookings": 2,
      "completed_bookings": 3,
      "attended": 3,
      "no_show": 1,
      "unmarked": 1
    }
  },
  "meta": {
    "timestamp": "2025-10-31T12:00:00Z",
    "cached": false
  }
}
```

**Error Responses:**
- `400` - Validation error (invalid contact ID format)
- `401` - Authentication required
- `404` - Contact not found
- `500` - Server error

## Implementation Details

### Caching Strategy
Both endpoints implement Redis caching with a 5-minute TTL to reduce HubSpot API calls:

- **Search cache key:** `admin:trainee:search:{query}`
- **Bookings cache key:** `admin:trainee:{contactId}:bookings{:all}`

Use the `debug=true` parameter to bypass cache when needed.

### HubSpot Integration
The endpoints use the shared HubSpot service (`admin_root/api/_shared/hubspot.js`) with these object type IDs:
- Contacts: `0-1`
- Bookings: `2-50158943`
- Mock Exams: `2-50158913`

### Batch Operations
- Booking details are fetched in batches of up to 100 records
- Mock exam details are fetched in batches for efficiency

### Performance Considerations
1. **Search Optimization:**
   - First attempts exact match on student_id
   - Falls back to partial matching on name/email if no exact match

2. **Batch Processing:**
   - Uses HubSpot batch read API for efficient data fetching
   - Processes up to 100 records per batch

3. **Caching:**
   - 5-minute TTL balances data freshness with API efficiency
   - Cache keys include query parameters for granular caching

## Testing

### Manual Testing
Use the provided test script:
```bash
node admin_root/api/admin/trainees/test-endpoints.js
```

### cURL Examples

**Search trainees:**
```bash
curl -X GET "http://localhost:3000/api/admin/trainees/search?query=1599999" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Get trainee bookings:**
```bash
curl -X GET "http://localhost:3000/api/admin/trainees/12345/bookings" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Debug mode (bypass cache):**
```bash
curl -X GET "http://localhost:3000/api/admin/trainees/search?query=John&debug=true" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Error Handling
All endpoints follow consistent error response format:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": "Optional additional details (dev mode only)"
  }
}
```

## Dependencies
- `requireAdmin`: Authentication middleware
- `validationMiddleware`: Joi-based validation
- `getCache`: Redis caching service
- `hubspot`: HubSpot API service

## Future Enhancements
1. Add pagination to search results
2. Add sorting options for bookings
3. Add export functionality (CSV/Excel)
4. Add more advanced filtering options
5. Implement webhook updates for real-time data