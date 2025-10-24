# HubSpot API 400 Error Fix - Mock Exam Details

## Problem Summary
When viewing a specific mock exam's details, the admin dashboard was encountering a HubSpot API 400 error with the message "There was a problem with the request."

### Error Details
- **Endpoint**: `/api/admin/mock-exams/get?id=34613479980`
- **HubSpot Object**: Bookings (`2-50158943`)
- **Error Code**: 400 Bad Request
- **Root Cause**: Attempting to search bookings using a `mock_exam_id` property that doesn't exist on the bookings object

## Root Cause Analysis

The code was trying to search for bookings using:
```javascript
// INCORRECT - mock_exam_id is not a property on bookings
filterGroups: [{
  filters: [{
    propertyName: 'mock_exam_id',
    operator: 'EQ',
    value: mockExamId
  }]
}]
```

In HubSpot, the relationship between Mock Exams and Bookings is managed through **associations**, not through a property on the booking object. When a booking is created, it's associated with a mock exam, but `mock_exam_id` is not stored as a searchable property.

## Solution Implementation

### Files Fixed
1. `/admin_root/api/_shared/hubspot.js`
   - `getMockExamWithBookings()` method (line 993)
   - `getActiveBookingsCount()` method (line 418)

2. `/admin_root/api/admin/mock-exams/[id]/bookings.js`
   - Fixed booking search logic (line 118)

### Fix Approach

Instead of searching bookings by a non-existent property, we now:

1. **Get Mock Exam with Associations**
   ```javascript
   const mockExamResponse = await this.apiCall('GET',
     `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/${mockExamId}?associations=${HUBSPOT_OBJECTS.bookings}`
   );
   ```

2. **Extract Booking IDs from Associations**
   ```javascript
   const bookingIds = [];
   if (mockExamResponse.associations?.[HUBSPOT_OBJECTS.bookings]?.results?.length > 0) {
     mockExamResponse.associations[HUBSPOT_OBJECTS.bookings].results.forEach(association => {
       bookingIds.push(association.id);
     });
   }
   ```

3. **Batch Fetch Booking Details**
   ```javascript
   const batchResponse = await this.apiCall('POST',
     `/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}/batch/read`, {
     properties: ['booking_status', 'contact_id', 'created_at', ...],
     inputs: bookingIds.map(id => ({ id }))
   });
   ```

## Benefits of the Fix

1. **Correct API Usage**: Uses HubSpot's associations API as intended
2. **Better Performance**: Batch fetching reduces API calls
3. **Scalable**: Handles pagination for large numbers of bookings
4. **Error Resilient**: Continues processing even if individual batches fail

## Testing

Created test script: `/admin_root/tests/test-mock-exam-details-fix.js`

Test results:
- ✅ Successfully retrieves mock exam details without 400 error
- ✅ Correctly fetches associated bookings
- ✅ Properly counts active bookings
- ✅ Handles mock exams with no bookings gracefully

## Deployment Notes

1. **No Database Changes Required**: This is purely a code fix
2. **No HubSpot Schema Changes**: Uses existing associations
3. **Backward Compatible**: Works with all existing data
4. **Cache Compatible**: Works with existing Redis caching layer

## Monitoring

After deployment, monitor for:
- Absence of 400 errors in logs for mock exam endpoints
- Successful retrieval of booking data in admin dashboard
- Proper display of booking counts and statistics

## Related Endpoints

These endpoints are now working correctly:
- `GET /api/admin/mock-exams/get?id={mockExamId}`
- `GET /api/admin/mock-exams/[id]/bookings`
- Any endpoint using `getActiveBookingsCount()`
- Any endpoint using `getMockExamWithBookings()`

## Lessons Learned

1. **HubSpot Associations vs Properties**: Always use associations for relationships between objects
2. **Search API Limitations**: Can only search on actual properties, not association references
3. **Batch Operations**: Use batch read for better performance when fetching multiple objects
4. **Error Messages**: HubSpot's generic 400 errors require careful debugging to identify the actual issue

---

**Fix Completed**: January 24, 2025
**Fixed By**: Express Backend Architect
**Test Status**: ✅ Verified Working