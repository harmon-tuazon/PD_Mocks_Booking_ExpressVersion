# PRD: Monthly Status Cleanup Cron Jobs

**Status**: Draft
**Author**: Claude Code
**Date**: December 17, 2025
**Priority**: Low-Medium
**Confidence Score**: 8/10

---

## 1. Executive Summary

This PRD defines two monthly cron jobs for data hygiene purposes:

1. **Auto-Complete Bookings**: Updates passed 'Active' bookings to 'Completed' status
2. **Auto-Deactivate Mock Exams**: Updates mock exams with past dates to `is_active = 'false'`

Both cron jobs run **once per month** and update **both HubSpot and Supabase** to maintain data consistency.

---

## 2. Background & Investigation Summary

### Why These Cron Jobs?

#### Bookings Analysis
- **Current behavior**: Bookings only transition to 'Completed' when admin marks attendance (Yes/No)
- **Frontend display**: Shows "Completed" based on `exam_date < today`, NOT database status
- **Query patterns**: Use `neq('is_active', 'Cancelled')` - Active and Completed are treated identically
- **Benefit**: **DATA CONSISTENCY** only - no query efficiency gain
- Ensures database reflects actual state for reporting and data integrity

#### Mock Exams Analysis
- **Current behavior**: `is_active` stays 'true' even after exam date passes
- **Query patterns**: Use `is_active = 'true' AND exam_date >= today`
- **Benefit**: **LOW-MEDIUM** - smaller dataset for active exam queries, cleaner semantics
- Available exam list already filters by date, so minimal performance impact

### Sync Architecture Decision

**Recommendation: Update BOTH HubSpot and Supabase**

Based on existing cron patterns analysis:

| Cron Job | Read From | Write To | Pattern |
|----------|-----------|----------|---------|
| activate-scheduled-exams | Supabase | HubSpot → Supabase | Both updated |
| sync-exams-backfill (1hr) | HubSpot | Supabase | HubSpot → Supabase |
| sync-bookings-from-supabase (15min) | Supabase | HubSpot | Supabase → HubSpot |

**Rationale for updating both:**
1. **Consistency with existing patterns** - activate-scheduled-exams already updates both
2. **Admin visibility** - Admins use HubSpot UI and expect accurate status
3. **Monthly frequency too long** - Can't rely on hourly sync; data would be stale for up to 30 days
4. **Data integrity** - Both systems should always reflect the true state

---

## 3. Technical Specification

### 3.1 Cron Job 1: Auto-Complete Passed Bookings

**Endpoint**: `GET /api/admin/cron/auto-complete-bookings`

**Schedule**: `0 0 1 * *` (1st of every month at midnight UTC)

**Logic**:
```
1. Query Supabase for bookings where:
   - is_active = 'Active'
   - exam_date < TODAY

2. For each matching booking:
   a. Update HubSpot: is_active = 'Completed'
   b. Update Supabase: is_active = 'Completed', updated_at = NOW()

3. Log results and invalidate caches
```

**Supabase Query**:
```sql
SELECT * FROM hubspot_bookings
WHERE is_active = 'Active'
  AND exam_date < CURRENT_DATE
LIMIT 500;
```

**Expected Volume**: ~50-200 bookings per month (based on typical throughput)

### 3.2 Cron Job 2: Auto-Deactivate Passed Mock Exams

**Endpoint**: `GET /api/admin/cron/auto-deactivate-exams`

**Schedule**: `0 0 1 * *` (1st of every month at midnight UTC)

**Logic**:
```
1. Query Supabase for mock exams where:
   - is_active = 'true'
   - exam_date < TODAY

2. For each matching exam:
   a. Update HubSpot: is_active = 'false'
   b. Update Supabase: is_active = 'false', updated_at = NOW()

3. Log results and invalidate caches
```

**Supabase Query**:
```sql
SELECT * FROM hubspot_mock_exams
WHERE is_active = 'true'
  AND exam_date < CURRENT_DATE
LIMIT 100;
```

**Expected Volume**: ~20-50 exams per month (based on typical scheduling)

---

## 4. Implementation Details

### 4.1 File Structure

```
admin_root/
├── api/
│   └── admin/
│       └── cron/
│           ├── auto-complete-bookings.js     (NEW)
│           └── auto-deactivate-exams.js      (NEW)
└── vercel.json                                (UPDATE - add cron schedules)
```

### 4.2 vercel.json Configuration

Add to existing `crons` array:

```json
{
  "path": "/api/admin/cron/auto-complete-bookings",
  "schedule": "0 0 1 * *"
},
{
  "path": "/api/admin/cron/auto-deactivate-exams",
  "schedule": "0 0 1 * *"
}
```

### 4.3 Implementation Pattern (Follow activate-scheduled-exams)

```javascript
/**
 * Pattern for both cron jobs:
 * 1. Verify CRON_SECRET authentication
 * 2. Query Supabase for records to update (read-first pattern)
 * 3. Batch update HubSpot (100 records per batch)
 * 4. Sync each updated record to Supabase
 * 5. Invalidate relevant caches
 * 6. Return summary with counts and timing
 */
```

### 4.4 Shared Dependencies

Reuse existing modules:
- `@supabase/supabase-js` - Supabase client
- `./hubspot` - HubSpotService for batch updates
- `./cache` - Redis cache invalidation
- `./supabase-data` - syncBookingToSupabase, syncExamToSupabase

---

## 5. Error Handling

### 5.1 Partial Failure Strategy

Following the pattern from `activate-scheduled-exams.js`:

```javascript
// Continue processing even if individual updates fail
for (const record of recordsToUpdate) {
  try {
    // Update HubSpot
    // Sync to Supabase
    successCount++;
  } catch (error) {
    console.error(`Failed to update ${record.id}:`, error.message);
    failedCount++;
    // Continue with next record
  }
}
```

### 5.2 Timeout Handling

- Vercel function limit: 60 seconds
- Implement 55-second threshold check
- Batch processing to avoid timeouts
- Return partial results if approaching timeout

---

## 6. Monitoring & Logging

### 6.1 Console Logging Format

```
🔍 [AUTO-COMPLETE-BOOKINGS] Querying Supabase for passed active bookings...
📊 [AUTO-COMPLETE-BOOKINGS] Found 45 booking(s) to update
✅ [AUTO-COMPLETE-BOOKINGS] Updated booking ABC123 in HubSpot (ID: 987654321)
🔄 [AUTO-COMPLETE-BOOKINGS] Syncing 45 bookings to Supabase...
🗑️ [AUTO-COMPLETE-BOOKINGS] Caches invalidated
✅ [AUTO-COMPLETE-BOOKINGS] Complete: 43 updated, 2 failed in 12340ms
```

### 6.2 Response Format

```json
{
  "success": true,
  "triggered_by": "cron",
  "updated": 43,
  "failed": 2,
  "total": 45,
  "successful_ids": ["id1", "id2", ...],
  "failed_ids": ["id3", "id4"],
  "timestamp": "2025-12-01T00:00:00.000Z",
  "executionTime": 12340
}
```

---

## 7. Cache Invalidation

### 7.1 Auto-Complete Bookings

```javascript
// Invalidate booking-related caches
await cache.deletePattern('admin:mock-exam:*:bookings:*');
await cache.deletePattern('admin:mock-exam:*');
await cache.deletePattern('user:bookings:*');
```

### 7.2 Auto-Deactivate Exams

```javascript
// Invalidate exam-related caches
await cache.deletePattern('admin:mock-exams:list:*');
await cache.deletePattern('admin:mock-exams:metrics:*');
await cache.deletePattern('admin:mock-exam:*');
await cache.deletePattern('user:mock-exams:list:*');
```

---

## 8. Testing Strategy

### 8.1 Manual Testing

```bash
# Test auto-complete bookings
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://your-domain.com/api/admin/cron/auto-complete-bookings

# Test auto-deactivate exams
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://your-domain.com/api/admin/cron/auto-deactivate-exams
```

### 8.2 Verification Steps

1. Check Supabase before/after for status changes
2. Check HubSpot records for matching status
3. Verify cache invalidation occurred
4. Check console logs for expected output

---

## 9. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Timeout with large dataset | Low | Medium | Batch processing, 55s threshold |
| HubSpot API rate limits | Low | Low | Batch updates (100/request) |
| Partial sync failure | Low | Low | Continue processing, log failures |
| Incorrect status updates | Very Low | Medium | Clear criteria (exam_date < today) |

---

## 10. Success Metrics

- **Data Consistency**: 100% of passed bookings have 'Completed' status
- **Data Hygiene**: 100% of passed exams have `is_active = 'false'`
- **Error Rate**: < 5% failure rate per monthly run
- **Execution Time**: < 30 seconds for typical monthly volume

---

## 11. Implementation Checklist

- [ ] Create `auto-complete-bookings.js` cron endpoint
- [ ] Create `auto-deactivate-exams.js` cron endpoint
- [ ] Update `vercel.json` with monthly cron schedules
- [ ] Test with curl and CRON_SECRET
- [ ] Verify HubSpot and Supabase sync
- [ ] Monitor first automated run on the 1st of the month
- [ ] Document in API documentation

---

## 12. Future Considerations

1. **Configurable Schedule**: Could be changed to weekly if needed
2. **Dry Run Mode**: Add `?dry_run=true` parameter for testing
3. **Metrics Dashboard**: Track monthly cleanup statistics
4. **Email Notifications**: Alert admin team of monthly cleanup results

---

## Appendix A: Existing Cron Job Reference

| Cron Job | Schedule | Purpose | Sync Direction |
|----------|----------|---------|----------------|
| activate-scheduled-exams | Daily 6PM UTC | Activate scheduled exams | Both |
| sync-exams-backfill | Every 1 hour | Reconcile HubSpot changes | HubSpot → Supabase |
| sync-bookings-from-supabase | Every 15 min | Create bookings in HubSpot | Supabase → HubSpot |
| **auto-complete-bookings** | Monthly 1st | Complete passed bookings | **Both** |
| **auto-deactivate-exams** | Monthly 1st | Deactivate passed exams | **Both** |

---

## Appendix B: Query Patterns Reference

### Booking Queries (Why Completed Status Doesn't Affect Performance)

```javascript
// Active bookings count - queries BOTH Active and Completed
.neq('is_active', 'Cancelled')

// This pattern is used throughout the codebase
// Active and Completed bookings count toward capacity
```

### Mock Exam Queries (Why Deactivation Has Minimal Impact)

```javascript
// Available exams - already filters by date
.eq('is_active', 'true')
.gte('exam_date', today)  // Date filter already excludes passed exams

// Deactivation provides cleaner semantics but minimal query improvement
```

---

**Document Version**: 1.0
**Last Updated**: December 17, 2025