# HubSpot Date Filter Fix - October 24, 2025

## Problem
The HubSpot API was returning 400 errors when trying to filter mock exams by date using the search API. The error occurred specifically when fetching aggregate sessions.

### Error Details
```
HubSpot API Error (400): "There was a problem with the request."
```

This occurred when calling `fetchMockExamsForAggregation` with date filters like:
```javascript
{
  filter_date_from: '2025-09-26',
  filter_date_to: '2025-09-26'
}
```

## Root Cause
The `exam_date` property in HubSpot is stored as a **string property** (format: "YYYY-MM-DD"), not as a date/datetime property. HubSpot's search API does not support date comparison operators (`GTE`, `LTE`, `EQ`) on string properties.

### Discovery Process
Testing revealed:
- ✅ Fetching without filters works
- ❌ Using `EQ` operator on exam_date fails with 400
- ❌ Using `GTE`/`LTE` operators on exam_date fails with 400
- ❌ Using `CONTAINS_TOKEN` operator fails with 400
- ❌ Using `IN` operator fails with 400
- ✅ Using `HAS_PROPERTY` works but doesn't filter
- ✅ Fetching all and filtering in code works

## Solution
Modified the date filtering approach to fetch records from HubSpot without date filters, then apply date filtering in application code.

### Files Modified
1. **`admin_root/api/_shared/hubspot.js`**
   - Updated `fetchMockExamsForAggregation()` method
   - Updated `listMockExams()` method
   - Updated `calculateMetrics()` method
   - Added better error logging with request body details

### Key Changes

#### 1. fetchMockExamsForAggregation Method
```javascript
// OLD: Tried to use GTE/LTE operators (caused 400 error)
if (filters.filter_date_from) {
  searchFilters.push({
    propertyName: 'exam_date',
    operator: 'GTE',
    value: filters.filter_date_from
  });
}

// NEW: Fetch all, then filter in application code
let filteredExams = allExams;
if (filters.filter_date_from || filters.filter_date_to) {
  filteredExams = allExams.filter(exam => {
    const examDate = exam.properties.exam_date;
    if (filters.filter_date_from && examDate < filters.filter_date_from) {
      return false;
    }
    if (filters.filter_date_to && examDate > filters.filter_date_to) {
      return false;
    }
    return true;
  });
}
```

#### 2. Enhanced Error Logging
Added request body to error logs for better debugging:
```javascript
console.error('HubSpot API Error Details:', {
  status: statusCode,
  message: errorMessage,
  fullResponse: error.response?.data,
  requestUrl: url,
  requestMethod: method,
  requestBody: requestData  // Added this
});
```

## Testing
Created comprehensive test files:
- `test-hubspot-search.js` - Tests different search operators
- `test-date-filter.js` - Tests date filtering approaches
- `test-sessions-fix.js` - Validates the fix works

### Test Results
✅ All tests passing:
- Aggregates fetch successfully
- Sessions fetch successfully
- Date filtering works correctly
- No more 400 errors

## Impact
- **Fixed**: Admin dashboard can now expand aggregate rows to view sessions
- **Fixed**: Date range filtering in admin dashboard
- **Fixed**: Metrics calculation with date ranges
- **Improved**: Error logging for better debugging

## Recommendations
1. **Long-term**: Consider migrating `exam_date` to a proper date property in HubSpot
2. **Performance**: When fetching large datasets, consider implementing pagination before date filtering
3. **Caching**: Date-filtered results are good candidates for caching since dates are immutable

## Lessons Learned
- Always verify the data type of HubSpot properties before using operators
- String properties in HubSpot don't support date comparison operators
- Application-level filtering is a valid fallback when API filtering isn't available
- Comprehensive error logging with request details speeds up debugging

## References
- HubSpot Search API Documentation: https://developers.hubspot.com/docs/api/crm/search
- Property operator limitations for different data types