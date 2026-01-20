# PRD: Admin App Supabase Sync Migration

## Overview

Migrate the admin_root application to sync all write operations to Supabase while maintaining HubSpot as the source of truth. This enables Supabase-first reads across both user and admin applications, eliminating HubSpot 429 rate limit errors.

## Architecture Principle

```
Write Flow: Admin Action → HubSpot (source of truth) → Supabase (sync)
Read Flow: Admin Request → Supabase (primary) → HubSpot (fallback)
```

**Critical Rule**: HubSpot remains the source of truth. Supabase sync failures are logged but never block operations.

## Endpoints to Update

### 1. Mock Exam Details Page Operations

#### 1a. Create Booking (`/api/admin/bookings/create`)
**Current**: Creates booking in HubSpot only
**Required Changes**:
- Import `syncBookingToSupabase` from `_shared/supabase-data`
- After successful HubSpot booking creation, sync to Supabase
- Include `mock_type`, `start_time`, `end_time` from exam in booking sync
- Add `supabase_synced` to response

```javascript
// After HubSpot booking creation
try {
  await syncBookingToSupabase(bookingData, examId);
  supabaseSynced = true;
} catch (err) {
  console.error('❌ Supabase sync failed:', err.message);
}
```

#### 1b. Mark Attendance (`/api/admin/bookings/attendance`)
**Current**: Updates attendance in HubSpot only
**Required Changes**:
- Import `updateBookingInSupabase` or create new function
- After HubSpot attendance update, sync to Supabase
- Update both `attendance` and `is_active` (Completed) fields

```javascript
// After HubSpot update
try {
  await supabaseAdmin
    .from('hubspot_bookings')
    .update({
      attendance: attendanceStatus,
      is_active: attendanceStatus === 'attended' ? 'Completed' : 'No Show',
      updated_at: new Date().toISOString(),
      synced_at: new Date().toISOString()
    })
    .eq('hubspot_id', bookingId);
} catch (err) {
  console.error('❌ Supabase attendance sync failed:', err.message);
}
```

#### 1c. Cancel Bookings (`/api/admin/bookings/cancel`)
**Current**: Soft deletes in HubSpot only
**Required Changes**:
- Import `updateBookingStatusInSupabase`
- After HubSpot soft delete, update Supabase status to 'Cancelled'
- This mirrors the user cancellation flow already implemented

```javascript
try {
  await updateBookingStatusInSupabase(bookingId, 'Cancelled');
  console.log(`✅ Booking ${bookingId} cancelled in Supabase`);
} catch (err) {
  console.error('❌ Supabase cancellation sync failed:', err.message);
}
```

#### 1d. Delete Mock Exam (`/api/admin/mock-exams/delete`)
**Status**: ✅ Already implemented
- Syncs exam deletion to Supabase
- Leaves cancelled bookings orphaned

#### 1e. Edit Mock Exam (`/api/admin/mock-exams/[id]` PUT)
**Current**: Updates exam in HubSpot only
**Required Changes**:
- Import `syncExamToSupabase`
- After HubSpot update, sync all changed properties to Supabase
- Handle property updates: exam_date, start_time, end_time, capacity, location, mock_type, is_active

```javascript
// After HubSpot update
try {
  await syncExamToSupabase({
    id: examId,
    properties: updatedProperties
  });
  console.log(`✅ Exam ${examId} updated in Supabase`);
} catch (err) {
  console.error('❌ Supabase exam update sync failed:', err.message);
}
```

### 2. Mock Dashboard Operations

#### 2a. Toggle Active Status (`/api/admin/mock-exams/toggle-status`)
**Current**: Toggles is_active in HubSpot only
**Required Changes**:
- Import Supabase admin client
- After HubSpot toggle, update `is_active` in Supabase

```javascript
// After HubSpot toggle
try {
  await supabaseAdmin
    .from('hubspot_mock_exams')
    .update({
      is_active: newStatus,
      updated_at: new Date().toISOString(),
      synced_at: new Date().toISOString()
    })
    .eq('hubspot_id', examId);
} catch (err) {
  console.error('❌ Supabase status toggle sync failed:', err.message);
}
```

#### 2b. Bulk Edit (`/api/admin/mock-exams/bulk-edit`)
**Current**: Batch updates exams in HubSpot only
**Required Changes**:
- After HubSpot batch update, sync each exam to Supabase
- Use `Promise.allSettled` for resilience

```javascript
// After HubSpot bulk update
const supabaseResults = await Promise.allSettled(
  examIds.map(async (examId) => {
    await supabaseAdmin
      .from('hubspot_mock_exams')
      .update({
        ...updatedFields,
        updated_at: new Date().toISOString(),
        synced_at: new Date().toISOString()
      })
      .eq('hubspot_id', examId);
  })
);

const syncedCount = supabaseResults.filter(r => r.status === 'fulfilled').length;
console.log(`✅ Synced ${syncedCount}/${examIds.length} exams to Supabase`);
```

#### 2c. Clone (`/api/admin/mock-exams/clone`)
**Current**: Creates new exam in HubSpot only
**Required Changes**:
- Import `syncExamToSupabase`
- After HubSpot clone, sync new exam to Supabase
- Ensure all properties are copied including capacity, location, times

```javascript
// After HubSpot clone
try {
  await syncExamToSupabase({
    id: clonedExamId,
    properties: clonedExamProperties
  });
  console.log(`✅ Cloned exam ${clonedExamId} synced to Supabase`);
} catch (err) {
  console.error('❌ Supabase clone sync failed:', err.message);
}
```

#### 2d. Delete Sessions (Bulk) (`/api/admin/mock-exams/bulk-delete`)
**Current**: Batch deletes exams in HubSpot only
**Required Changes**:
- Import `deleteExamFromSupabase`
- After HubSpot bulk delete, delete each from Supabase
- Leave orphaned bookings (consistent with single delete)

```javascript
// After HubSpot bulk delete
const deleteResults = await Promise.allSettled(
  examIds.map(async (examId) => {
    await deleteExamFromSupabase(examId);
  })
);

const deletedCount = deleteResults.filter(r => r.status === 'fulfilled').length;
console.log(`✅ Deleted ${deletedCount}/${examIds.length} exams from Supabase`);
```

## Implementation Checklist

### Phase 1: Mock Exam Details Page
- [ ] 1a. Create Booking - add Supabase sync
- [ ] 1b. Mark Attendance - add Supabase sync
- [ ] 1c. Cancel Bookings - add Supabase sync
- [x] 1d. Delete Mock Exam - already implemented
- [ ] 1e. Edit Mock Exam - add Supabase sync

### Phase 2: Mock Dashboard
- [ ] 2a. Toggle Active Status - add Supabase sync
- [ ] 2b. Bulk Edit - add Supabase sync
- [ ] 2c. Clone - add Supabase sync
- [ ] 2d. Delete Sessions (Bulk) - add Supabase sync

### Phase 3: Validation
- [ ] Test each operation individually
- [ ] Verify Supabase data matches HubSpot
- [ ] Test Supabase failure scenarios (should not block operations)
- [ ] Verify response includes `supabase_synced` status

## Shared Utilities Required

The following functions from `admin_root/api/_shared/supabase-data.js` will be used:

**Already Available**:
- `syncBookingToSupabase(booking, examId)`
- `syncExamToSupabase(exam)`
- `updateBookingStatusInSupabase(bookingId, newStatus)`
- `deleteExamFromSupabase(examId)`

**May Need to Add**:
- `updateBookingAttendanceInSupabase(bookingId, attendance, isActive)` - specific attendance update

## Error Handling Pattern

All Supabase sync operations should follow this pattern:

```javascript
let supabaseSynced = false;
try {
  await supabaseOperation();
  console.log(`✅ [Operation] synced to Supabase`);
  supabaseSynced = true;
} catch (supabaseError) {
  console.error('❌ Supabase sync failed:', supabaseError.message);
  // Continue - HubSpot is source of truth
}

// Include in response
res.json({
  success: true,
  // ... other fields
  supabase_synced: supabaseSynced
});
```

## Testing Strategy

1. **Unit Tests**: Mock Supabase client, verify sync functions called
2. **Integration Tests**:
   - Perform admin operation
   - Verify HubSpot updated
   - Verify Supabase synced
   - Verify response includes sync status
3. **Failure Tests**:
   - Simulate Supabase down
   - Verify HubSpot operation succeeds
   - Verify graceful error logging

## Rollback Plan

If issues arise:
1. Remove Supabase sync imports
2. Remove try/catch sync blocks
3. Remove `supabase_synced` from responses
4. Deploy previous version

Since HubSpot is source of truth, data integrity is maintained regardless of Supabase state.

## Success Metrics

- All admin write operations sync to Supabase
- Zero HubSpot 429 errors during admin operations
- Admin reads can use Supabase-first pattern
- Response times improved (Supabase reads faster than HubSpot)

## Timeline Estimate

- Phase 1 (Details Page): 4-6 hours
- Phase 2 (Dashboard): 3-4 hours
- Phase 3 (Validation): 2-3 hours
- Total: ~10-13 hours

## Dependencies

- `admin_root/api/_shared/supabase-data.js` - sync utilities
- `admin_root/api/_shared/supabase.js` - Supabase client
- Environment variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
