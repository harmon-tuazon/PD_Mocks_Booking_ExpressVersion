# Supabase-First Architecture - Manual Testing Checklist

## Pre-Testing Setup

### Environment Variables (Vercel)
- [X] `SUPABASE_URL` configured
- [X] `SUPABASE_SERVICE_ROLE_KEY` configured

### Database Setup (Supabase SQL Editor)
- [X] Run `supabase-setup.sql` (Steps 1-5)
- [X] Verify tables created: `hubspot_bookings`, `hubspot_mock_exams`
- [X] Verify RLS enabled on both tables
- [X] Verify policies created

### Initial Data Migration
- [X] Run: `node scripts/migrate-hubspot-to-supabase.js`
- [X] Verify exam count matches HubSpot
- [X] Verify booking count matches HubSpot

---

## Test Cases

### 1. Available Exams Endpoint (Supabase-First Read)

**Endpoint:** `GET /api/mock-exams/available`

| Test | Steps | Expected Result | Pass? |
|------|-------|-----------------|-------|
| Basic fetch | Call endpoint without cache | Log shows: `✅ Fetched X exams from Supabase` | [ ] |
| Cache hit | Call endpoint again within 5 min | Log shows: `🎯 Cache HIT` | [ ] |
| Filter by type | Add `?mock_type=Clinical Skills` | Only Clinical Skills exams returned | [ ] |
| Supabase fallback | Temporarily break Supabase URL | Log shows: `⚠️ Fallback: Fetched X exams from HubSpot` | [ ] |
| Response format | Check response structure | Matches existing format (mock_exam_id, capacity, available_slots, etc.) | [ ] |

### 2. Create Booking (Supabase Sync)

**Endpoint:** `POST /api/bookings/create`

| Test | Steps | Expected Result | Pass? |
|------|-------|-----------------|-------|
| Create booking | Submit valid booking | Log shows: `✅ Booking synced to Supabase` | [ ] |
| Verify in Supabase | Check `hubspot_bookings` table | New row with correct data | [ ] |
| Exam count updated | Check `hubspot_mock_exams` table | `total_bookings` incremented | [ ] |
| Redis counter | Check Redis key `exam:{id}:bookings` | Counter incremented | [ ] |
| Sync failure resilient | Temporarily break Supabase | Booking still succeeds, log shows warning | [ ] |

### 3. Cancel Booking (Supabase Sync)

**Endpoint:** `POST /api/bookings/batch-cancel`

| Test | Steps | Expected Result | Pass? |
|------|-------|-----------------|-------|
| Cancel booking | Submit valid cancellation | Log shows: `✅ Supabase synced for cancelled booking` | [ ] |
| Verify in Supabase | Check `hubspot_bookings` table | `is_active` = 'Cancelled' | [ ] |
| Exam count updated | Check `hubspot_mock_exams` table | `total_bookings` decremented | [ ] |
| Redis counter | Check Redis key | Counter decremented | [ ] |

### 4. Admin Create Exam (Supabase Sync)

**Endpoint:** `POST /api/admin/mock-exams/create`

| Test | Steps | Expected Result | Pass? |
|------|-------|-----------------|-------|
| Create exam | Submit valid exam data | Log shows: `✅ Exam synced to Supabase` | [ ] |
| Verify in Supabase | Check `hubspot_mock_exams` table | New row with correct data | [ ] |
| Available in user app | Call `/api/mock-exams/available` | New exam appears in list | [ ] |

### 5. Admin Clone Exams (Supabase Sync)

**Endpoint:** `POST /api/admin/mock-exams/clone`

| Test | Steps | Expected Result | Pass? |
|------|-------|-----------------|-------|
| Clone single exam | Clone 1 exam | Cloned exam in Supabase | [ ] |
| Clone multiple | Clone 5 exams | All 5 in Supabase | [ ] |
| Verify properties | Check cloned exam data | Correct date, location, capacity | [ ] |

### 6. Force Sync Endpoint (Recovery)

**Endpoint:** `POST /api/admin/sync/force-supabase`

| Test | Steps | Expected Result | Pass? |
|------|-------|-----------------|-------|
| Sync all exams | `?type=exams` | All exams synced to Supabase | [ ] |
| Sync bookings | `?type=bookings&examId=123` | Bookings for exam synced | [ ] |
| Auth required | Call without admin token | 401 Unauthorized | [ ] |

---

## Performance Tests

### Load Test Simulation

| Scenario | Method | Expected Result | Pass? |
|----------|--------|-----------------|-------|
| 10 concurrent available requests | Use load testing tool | All return <500ms, no 429 errors | [ ] |
| 50 concurrent available requests | Use load testing tool | All return <1s, no 429 errors | [ ] |
| HubSpot API calls | Monitor HubSpot logs | Zero calls for cached reads | [ ] |

---

## Data Integrity Checks

### After All Tests

| Check | Query/Method | Expected | Pass? |
|-------|--------------|----------|-------|
| Exam count match | Compare Supabase vs HubSpot | Counts equal | [ ] |
| Booking count match | Compare Supabase vs HubSpot | Counts equal | [ ] |
| No orphaned bookings | Bookings reference valid exams | All valid | [ ] |
| Redis vs Supabase | Compare capacity counters | Values match | [ ] |

### Verification Queries (Supabase SQL Editor)

```sql
-- Count exams
SELECT COUNT(*) FROM hubspot_mock_exams;

-- Count bookings
SELECT COUNT(*) FROM hubspot_bookings;

-- Check recent syncs
SELECT hubspot_id, mock_exam_name, synced_at
FROM hubspot_mock_exams
ORDER BY synced_at DESC
LIMIT 10;

-- Find bookings not synced in last hour
SELECT * FROM hubspot_bookings
WHERE synced_at < NOW() - INTERVAL '1 hour';
```

---

## Rollback Plan

If issues occur:

1. **Disable Supabase reads**: In `available.js`, swap Supabase try/catch to force HubSpot fallback
2. **Clear caches**: Delete Redis keys `mock-exams:*` and `user:exams:*`
3. **Re-run migration**: `node scripts/migrate-hubspot-to-supabase.js`
4. **Force sync specific data**: Use `/api/admin/sync/force-supabase`

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Developer | | | |
| QA | | | |
| Product Owner | | | |

---

## Notes

_Add any issues, observations, or follow-up items here:_

-
-
-
