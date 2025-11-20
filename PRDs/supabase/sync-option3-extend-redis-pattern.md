# PRD: Supabase-First Read Architecture with Redis Cache

**Version**: 2.0
**Created**: 2025-01-20
**Updated**: 2025-01-20
**Complexity**: ⭐⭐ (Low)
**Code Required**: ~100 lines
**Monthly Cost**: $0 (uses existing infrastructure)

---

## Overview

Use Supabase as the **primary read source** to eliminate HubSpot API rate limit (429) issues. Redis remains as the first-level cache, but cache misses fetch from Supabase instead of HubSpot. HubSpot becomes write-only for data mutations.

## Goals

1. **Eliminate HubSpot 429 errors** by removing HubSpot from read path
2. Use Supabase as the read replica for all data
3. Maintain Redis as fast cache layer
4. Keep HubSpot as source of truth for writes only
5. No additional monthly costs

## Architecture

### Read Flow (No HubSpot API calls)

```
┌─────────────────────────────────────────────────────────┐
│         SUPABASE-FIRST READ ARCHITECTURE                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────┐                                      │
│  │   User       │                                      │
│  │   Request    │                                      │
│  └──────┬───────┘                                      │
│         │                                               │
│         │ 1. API call (GET)                             │
│         ▼                                               │
│  ┌──────────────┐                                      │
│  │   API        │                                      │
│  │   Endpoint   │                                      │
│  └──────┬───────┘                                      │
│         │                                               │
│         │ 2. Check Redis cache                          │
│         ▼                                               │
│  ┌──────────────┐     ┌─────────────┐                 │
│  │   Redis      │────►│  Cache Hit  │──► Return data  │
│  │   Cache      │     └─────────────┘                 │
│  └──────┬───────┘                                      │
│         │                                               │
│         │ Cache Miss                                    │
│         ▼                                               │
│  ┌──────────────┐                                      │
│  │   Supabase   │  ◄── Primary read source             │
│  │   Database   │      (NOT HubSpot!)                  │
│  └──────┬───────┘                                      │
│         │                                               │
│         │ 3. Fetch data                                 │
│         ▼                                               │
│  ┌──────────────────────────────────┐                  │
│  │   Cache in Redis (5 min TTL)     │                  │
│  │   Return data to user            │                  │
│  └──────────────────────────────────┘                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Write Flow (HubSpot → Supabase → Invalidate Redis)

```
┌─────────────────────────────────────────────────────────┐
│         WRITE FLOW WITH CACHE INVALIDATION              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────┐                                      │
│  │   User       │                                      │
│  │   Action     │  (create/update/delete)              │
│  └──────┬───────┘                                      │
│         │                                               │
│         │ 1. API call (POST/PUT/DELETE)                 │
│         ▼                                               │
│  ┌──────────────┐                                      │
│  │   HubSpot    │  ◄── Source of truth for writes      │
│  │   API        │                                      │
│  └──────┬───────┘                                      │
│         │                                               │
│         │ 2. Write successful                           │
│         ▼                                               │
│  ┌──────────────┐                                      │
│  │   Supabase   │  ◄── Sync immediately                │
│  │   Upsert     │                                      │
│  └──────┬───────┘                                      │
│         │                                               │
│         │ 3. Invalidate cache                           │
│         ▼                                               │
│  ┌──────────────┐                                      │
│  │   Redis      │  ◄── DELETE key (not update!)        │
│  │   DEL key    │                                      │
│  └──────────────┘                                      │
│                                                         │
│  Next read will: Redis miss → Supabase → Cache         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Why This Architecture?

1. **No HubSpot for reads**: Supabase is always current because writes sync immediately
2. **Invalidate vs Update Redis**: Simpler, avoids race conditions, next read gets fresh data
3. **HubSpot = Source of Truth**: All mutations go to HubSpot first, then propagate

---

## Implementation Steps

### Step 1: Create Supabase Tables (5 minutes)

Run in Supabase SQL Editor:

```sql
-- Bookings sync table
CREATE TABLE IF NOT EXISTS public.hubspot_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hubspot_id TEXT UNIQUE NOT NULL,
  booking_id TEXT,
  mock_exam_id TEXT,
  contact_id TEXT,
  student_id TEXT,
  student_name TEXT,
  student_email TEXT,
  booking_status TEXT,
  is_active TEXT,
  attendance TEXT,
  attending_location TEXT,
  exam_date TIMESTAMP,
  dominant_hand TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  synced_at TIMESTAMP DEFAULT NOW()
);

-- Mock Exams sync table
CREATE TABLE IF NOT EXISTS public.hubspot_mock_exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hubspot_id TEXT UNIQUE NOT NULL,
  mock_exam_name TEXT,
  mock_type TEXT,
  exam_date DATE,
  start_time TEXT,
  end_time TEXT,
  location TEXT,
  capacity INTEGER,
  total_bookings INTEGER DEFAULT 0,
  is_active TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  synced_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_bookings_hubspot_id ON public.hubspot_bookings(hubspot_id);
CREATE INDEX idx_bookings_exam_id ON public.hubspot_bookings(mock_exam_id);
CREATE INDEX idx_exams_hubspot_id ON public.hubspot_mock_exams(hubspot_id);
```

### Step 2: Create Data Access Layer (20 minutes)

Create new file: `admin_root/api/_shared/supabase-data.js`

```javascript
/**
 * Supabase Data Access Layer
 * Handles reads from Supabase and syncs on writes
 */

const { supabaseAdmin } = require('./supabase');

// ============== READ OPERATIONS (from Supabase) ==============

/**
 * Get bookings for an exam from Supabase
 * @param {string} examId - Mock exam HubSpot ID
 * @returns {Array} - Array of booking objects
 */
async function getBookingsFromSupabase(examId) {
  const { data, error } = await supabaseAdmin
    .from('hubspot_bookings')
    .select('*')
    .eq('mock_exam_id', examId);

  if (error) {
    console.error(`❌ Supabase read error for exam ${examId}:`, error.message);
    throw error;
  }

  return data || [];
}

/**
 * Get all mock exams from Supabase
 * @param {object} filters - Optional filters (is_active, date range, etc.)
 * @returns {Array} - Array of exam objects
 */
async function getExamsFromSupabase(filters = {}) {
  let query = supabaseAdmin.from('hubspot_mock_exams').select('*');

  if (filters.is_active) {
    query = query.eq('is_active', filters.is_active);
  }
  if (filters.startDate) {
    query = query.gte('exam_date', filters.startDate);
  }
  if (filters.endDate) {
    query = query.lte('exam_date', filters.endDate);
  }

  const { data, error } = await query.order('exam_date', { ascending: true });

  if (error) {
    console.error(`❌ Supabase exam read error:`, error.message);
    throw error;
  }

  return data || [];
}

/**
 * Get single exam by ID from Supabase
 * @param {string} examId - HubSpot ID
 * @returns {object|null} - Exam object or null
 */
async function getExamByIdFromSupabase(examId) {
  const { data, error } = await supabaseAdmin
    .from('hubspot_mock_exams')
    .select('*')
    .eq('hubspot_id', examId)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    console.error(`❌ Supabase exam read error:`, error.message);
    throw error;
  }

  return data;
}

// ============== WRITE SYNC OPERATIONS (after HubSpot write) ==============

/**
 * Sync booking to Supabase after HubSpot write
 * @param {object} booking - Booking object from HubSpot
 * @param {string} examId - Mock exam ID
 */
async function syncBookingToSupabase(booking, examId) {
  const record = {
    hubspot_id: booking.id,
    booking_id: booking.booking_id || booking.properties?.booking_id,
    mock_exam_id: examId || booking.properties?.mock_exam_id,
    contact_id: booking.contact_id || booking.properties?.contact_id,
    student_id: booking.student_id || booking.properties?.student_id,
    student_name: booking.name || booking.properties?.student_name,
    student_email: booking.email || booking.properties?.student_email,
    booking_status: booking.booking_status || booking.properties?.booking_status,
    is_active: booking.is_active || booking.properties?.is_active,
    attendance: booking.attendance || booking.properties?.attendance,
    attending_location: booking.attending_location || booking.properties?.attending_location,
    exam_date: booking.exam_date || booking.properties?.exam_date,
    dominant_hand: booking.dominant_hand || booking.properties?.dominant_hand,
    synced_at: new Date().toISOString()
  };

  const { error } = await supabaseAdmin
    .from('hubspot_bookings')
    .upsert(record, { onConflict: 'hubspot_id' });

  if (error) {
    console.error(`❌ Supabase booking sync error:`, error.message);
    throw error;
  }

  console.log(`✅ Synced booking ${booking.id} to Supabase`);
}

/**
 * Sync multiple bookings to Supabase
 * @param {Array} bookings - Array of booking objects
 * @param {string} examId - Mock exam ID
 */
async function syncBookingsToSupabase(bookings, examId) {
  if (!bookings || bookings.length === 0) return;

  const records = bookings.map(booking => ({
    hubspot_id: booking.id,
    booking_id: booking.booking_id || booking.properties?.booking_id,
    mock_exam_id: examId || booking.properties?.mock_exam_id,
    contact_id: booking.contact_id || booking.properties?.contact_id,
    student_id: booking.student_id || booking.properties?.student_id,
    student_name: booking.name || booking.properties?.student_name,
    student_email: booking.email || booking.properties?.student_email,
    booking_status: booking.booking_status || booking.properties?.booking_status,
    is_active: booking.is_active || booking.properties?.is_active,
    attendance: booking.attendance || booking.properties?.attendance,
    attending_location: booking.attending_location || booking.properties?.attending_location,
    exam_date: booking.exam_date || booking.properties?.exam_date,
    dominant_hand: booking.dominant_hand || booking.properties?.dominant_hand,
    synced_at: new Date().toISOString()
  }));

  const { error } = await supabaseAdmin
    .from('hubspot_bookings')
    .upsert(records, { onConflict: 'hubspot_id' });

  if (error) {
    console.error(`❌ Supabase bulk sync error:`, error.message);
    throw error;
  }

  console.log(`✅ Synced ${records.length} bookings to Supabase`);
}

/**
 * Sync exam to Supabase after HubSpot write
 * @param {object} exam - Exam object from HubSpot
 */
async function syncExamToSupabase(exam) {
  const record = {
    hubspot_id: exam.id,
    mock_exam_name: exam.mock_exam_name || exam.properties?.mock_exam_name,
    mock_type: exam.mock_type || exam.properties?.mock_type,
    exam_date: exam.exam_date || exam.properties?.exam_date,
    start_time: exam.start_time || exam.properties?.start_time,
    end_time: exam.end_time || exam.properties?.end_time,
    location: exam.location || exam.properties?.location,
    capacity: parseInt(exam.capacity || exam.properties?.capacity) || 0,
    total_bookings: parseInt(exam.total_bookings || exam.properties?.total_bookings) || 0,
    is_active: exam.is_active || exam.properties?.is_active,
    synced_at: new Date().toISOString()
  };

  const { error } = await supabaseAdmin
    .from('hubspot_mock_exams')
    .upsert(record, { onConflict: 'hubspot_id' });

  if (error) {
    console.error(`❌ Supabase exam sync error:`, error.message);
    throw error;
  }

  console.log(`✅ Synced exam ${exam.id} to Supabase`);
}

/**
 * Delete booking from Supabase
 * @param {string} bookingId - HubSpot ID
 */
async function deleteBookingFromSupabase(bookingId) {
  const { error } = await supabaseAdmin
    .from('hubspot_bookings')
    .delete()
    .eq('hubspot_id', bookingId);

  if (error) {
    console.error(`❌ Supabase booking delete error:`, error.message);
    throw error;
  }

  console.log(`✅ Deleted booking ${bookingId} from Supabase`);
}

module.exports = {
  // Reads
  getBookingsFromSupabase,
  getExamsFromSupabase,
  getExamByIdFromSupabase,
  // Write syncs
  syncBookingToSupabase,
  syncBookingsToSupabase,
  syncExamToSupabase,
  deleteBookingFromSupabase
};
```

### Step 3: Update Read Endpoints (Supabase-First)

Update read endpoints to fetch from Supabase instead of HubSpot.

#### Example: `mock-exams/[id]/bookings.js` (READ)

```javascript
const { getBookingsFromSupabase } = require('../../_shared/supabase-data');
const redis = require('../../_shared/redis');

module.exports = async (req, res) => {
  const { id: examId } = req.query;
  const cacheKey = `bookings:${examId}`;

  // 1. Check Redis cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    return res.status(200).json({ success: true, bookings: JSON.parse(cached) });
  }

  // 2. Cache miss → Fetch from SUPABASE (not HubSpot!)
  const bookings = await getBookingsFromSupabase(examId);

  // 3. Cache in Redis
  await redis.set(cacheKey, JSON.stringify(bookings), 'EX', 300);

  return res.status(200).json({ success: true, bookings });
};
```

#### Example: `mock-exams/list.js` (READ)

```javascript
const { getExamsFromSupabase } = require('../_shared/supabase-data');
const redis = require('../_shared/redis');

module.exports = async (req, res) => {
  const cacheKey = `exams:list`;

  // 1. Check Redis cache
  const cached = await redis.get(cacheKey);
  if (cached) {
    return res.status(200).json({ success: true, exams: JSON.parse(cached) });
  }

  // 2. Cache miss → Fetch from SUPABASE
  const exams = await getExamsFromSupabase(req.query);

  // 3. Cache in Redis
  await redis.set(cacheKey, JSON.stringify(exams), 'EX', 300);

  return res.status(200).json({ success: true, exams });
};
```

### Step 4: Update Write Endpoints (HubSpot → Supabase → Invalidate)

Update write endpoints to sync to Supabase and invalidate Redis.

#### Example: `bookings/create.js` (WRITE)

```javascript
const hubspot = require('../../_shared/hubspot');
const { syncBookingToSupabase } = require('../../_shared/supabase-data');
const redis = require('../../_shared/redis');

module.exports = async (req, res) => {
  const { examId, ...bookingData } = req.body;

  // 1. Write to HubSpot (source of truth)
  const booking = await hubspot.createBooking(bookingData);

  // 2. Sync to Supabase
  await syncBookingToSupabase(booking, examId);

  // 3. Invalidate Redis cache (DELETE, not update!)
  await redis.del(`bookings:${examId}`);
  await redis.del(`exams:list`); // Invalidate exam list too (booking count changed)

  return res.status(201).json({ success: true, booking });
};
```

#### Example: `bookings/cancel.js` (WRITE)

```javascript
const hubspot = require('../../_shared/hubspot');
const { syncBookingToSupabase } = require('../../_shared/supabase-data');
const redis = require('../../_shared/redis');

module.exports = async (req, res) => {
  const { bookingId, examId } = req.body;

  // 1. Update in HubSpot
  const booking = await hubspot.cancelBooking(bookingId);

  // 2. Sync updated booking to Supabase
  await syncBookingToSupabase(booking, examId);

  // 3. Invalidate Redis
  await redis.del(`bookings:${examId}`);

  return res.status(200).json({ success: true, booking });
};
```

#### Example: `mock-exams/create.js` (WRITE)

```javascript
const hubspot = require('../../_shared/hubspot');
const { syncExamToSupabase } = require('../../_shared/supabase-data');
const redis = require('../../_shared/redis');

module.exports = async (req, res) => {
  // 1. Create in HubSpot
  const exam = await hubspot.createMockExam(req.body);

  // 2. Sync to Supabase
  await syncExamToSupabase(exam);

  // 3. Invalidate exams list cache
  await redis.del(`exams:list`);

  return res.status(201).json({ success: true, exam });
};
```

### Step 5: Initial Data Migration (One-time)

Before switching to Supabase-first reads, you need to populate Supabase with existing HubSpot data.

Create migration script: `scripts/migrate-hubspot-to-supabase.js`

```javascript
/**
 * One-time migration: HubSpot → Supabase
 * Run this before switching to Supabase-first reads
 */

const hubspot = require('../admin_root/api/_shared/hubspot');
const { syncBookingsToSupabase, syncExamToSupabase } = require('../admin_root/api/_shared/supabase-data');

async function migrateAllData() {
  console.log('🚀 Starting HubSpot → Supabase migration...\n');

  // 1. Migrate all mock exams
  console.log('📋 Fetching all mock exams from HubSpot...');
  const exams = await hubspot.listAllMockExams(); // Fetch ALL, not paginated

  for (const exam of exams) {
    await syncExamToSupabase(exam);
  }
  console.log(`✅ Migrated ${exams.length} mock exams\n`);

  // 2. Migrate bookings for each exam
  console.log('📋 Fetching bookings for each exam...');
  for (const exam of exams) {
    const bookings = await hubspot.getBookingsForExam(exam.id);
    if (bookings.length > 0) {
      await syncBookingsToSupabase(bookings, exam.id);
    }
  }
  console.log(`✅ Migrated all bookings\n`);

  console.log('🎉 Migration complete!');
}

migrateAllData().catch(console.error);
```

Run once: `node scripts/migrate-hubspot-to-supabase.js`

### Step 6: Add Force Sync Endpoint (Optional)

For manual re-sync from HubSpot if needed:

```javascript
// api/admin/sync/force-supabase.js
const { requirePermission } = require('../middleware/requirePermission');
const hubspot = require('../../_shared/hubspot');
const { syncBookingsToSupabase, syncExamToSupabase } = require('../../_shared/supabase-data');

module.exports = async (req, res) => {
  try {
    await requirePermission(req, 'exams.edit');

    const { type, examId } = req.query;

    if (type === 'bookings' && examId) {
      const bookings = await hubspot.getBookingsForExam(examId);
      await syncBookingsToSupabase(bookings, examId);
      return res.status(200).json({
        success: true,
        message: `Synced ${bookings.length} bookings`
      });
    }

    if (type === 'exams') {
      const exams = await hubspot.listMockExams();
      for (const exam of exams) {
        await syncExamToSupabase(exam);
      }
      return res.status(200).json({
        success: true,
        message: `Synced ${exams.length} exams`
      });
    }

    return res.status(400).json({
      success: false,
      error: 'Invalid sync type. Use type=exams or type=bookings&examId=xxx'
    });
  } catch (error) {
    console.error('Force sync error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
```

---

## Endpoints to Update

### Read Endpoints (Change to Supabase)

| Endpoint | Change |
|----------|--------|
| `mock-exams/list.js` | Read from `getExamsFromSupabase()` |
| `mock-exams/[id]/bookings.js` | Read from `getBookingsFromSupabase()` |
| `mock-exams/get.js` | Read from `getExamByIdFromSupabase()` |
| `mock-exams/aggregates.js` | Read from `getExamsFromSupabase()` |

### Write Endpoints (Add Supabase sync + Redis invalidation)

| Endpoint | Changes |
|----------|---------|
| `bookings/create.js` | Add `syncBookingToSupabase()` + `redis.del()` |
| `bookings/cancel.js` | Add `syncBookingToSupabase()` + `redis.del()` |
| `bookings/batch-cancel.js` | Add `syncBookingsToSupabase()` + `redis.del()` |
| `mock-exams/create.js` | Add `syncExamToSupabase()` + `redis.del()` |
| `mock-exams/update.js` | Add `syncExamToSupabase()` + `redis.del()` |
| `mock-exams/delete.js` | Add `deleteExamFromSupabase()` + `redis.del()` |
| `mock-exams/activate.js` | Add `syncExamToSupabase()` + `redis.del()` |

---

## Testing Checklist

### Setup
- [ ] Supabase tables created with indexes
- [ ] `supabase-data.js` helper created
- [ ] Initial migration script run successfully

### Read Flow
- [ ] Read endpoint returns data from Supabase
- [ ] Redis cache hit returns cached data
- [ ] Redis cache miss fetches from Supabase
- [ ] No HubSpot API calls on reads

### Write Flow
- [ ] Write goes to HubSpot first
- [ ] Supabase synced after HubSpot success
- [ ] Redis cache invalidated (key deleted)
- [ ] Next read fetches fresh data from Supabase

### Edge Cases
- [ ] Force sync endpoint works
- [ ] Handle Supabase connection errors gracefully
- [ ] Test concurrent write operations

---

## Maintenance

### Minimal
- Monitor Supabase table growth monthly
- Check console logs for sync errors
- No external services to manage
- Periodic verification that Supabase matches HubSpot (optional)

---

## Pros & Cons

**Pros:**
- ✅ **Eliminates HubSpot 429 errors** - No HubSpot reads!
- ✅ Zero additional cost
- ✅ Uses existing infrastructure
- ✅ Fast reads (Supabase < HubSpot)
- ✅ Redis still provides sub-millisecond cache hits
- ✅ Simple invalidation pattern (no race conditions)
- ✅ Easy to understand and debug

**Cons:**
- ❌ Requires initial data migration
- ❌ One-way sync (HubSpot → Supabase)
- ❌ Small delay on first read after write (cache miss)
- ❌ Need to update multiple endpoints

---

## Data Flow Summary

| Operation | Flow |
|-----------|------|
| **Read** | Redis → (miss) → Supabase → Cache |
| **Write** | HubSpot → Supabase → Invalidate Redis |
| **Migration** | HubSpot → Supabase (one-time) |

---

## Success Criteria

- [ ] **Zero HubSpot 429 errors** on read operations
- [ ] All reads come from Supabase (not HubSpot)
- [ ] Writes sync to Supabase within same request
- [ ] Redis cache invalidation working
- [ ] Force sync endpoint available for recovery
- [ ] Zero additional monthly costs
- [ ] Migration completed successfully

---

## Future Enhancements

1. **Supabase Realtime subscriptions** - Push updates to frontend
2. **Sync status dashboard** - Show last sync times per record
3. **Automated reconciliation** - Periodic check that Supabase matches HubSpot
4. **Soft deletes** - Mark deleted instead of hard delete for audit trail

---

## Related Documents

- [Alternative Sync Methods](alternative-sync-methods-no-cron-no-webhooks.md)
- [Redis Implementation](../../.serena/memories/REDIS_APPLICATION_CACHE_IMPLEMENTATION.md)
