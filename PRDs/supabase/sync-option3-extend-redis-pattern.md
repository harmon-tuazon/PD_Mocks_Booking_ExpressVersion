# PRD: Supabase-First Read Architecture with Redis Cache (User App)

**Version**: 3.0
**Created**: 2025-01-20
**Updated**: 2025-01-21
**Complexity**: ⭐⭐ (Low)
**Code Required**: ~150 lines
**Monthly Cost**: $0 (uses existing infrastructure)
**Target Application**: **user_root** (Student Booking App)

---

## Overview

Use Supabase as the **primary read source** to eliminate HubSpot API rate limit (429) issues during high-concurrency booking scenarios (250+ concurrent users). Redis remains as the first-level cache, but cache misses fetch from Supabase instead of HubSpot. HubSpot becomes write-only for data mutations.

### Why User App Needs This

The user_root booking app faces critical bottlenecks during exam booking rushes:
- **250 concurrent users** trying to book limited exam slots
- **HubSpot rate limit**: ~10 calls/10 seconds
- **Current result**: 75-125 seconds to serve all users, many see "session full" after waiting

With Supabase-first architecture:
- **Supabase handles**: 1000+ queries/sec
- **Redis atomic counters**: 100k+ ops/sec for capacity checks
- **Result**: <1 second response for all users

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

### Step 1.5: Supabase Connection Setup

#### How Supabase Authentication Works

Supabase uses a mixture of **JWT and API Key authentication**:

- **Without Authorization header**: The API assumes you're making a request as an anonymous user
- **With Authorization header**: Supabase switches to the role of the user making the request, using Row Level Security (RLS) policies

For server-side API routes (our use case), we use the **service role key** which bypasses RLS for admin operations.

#### Environment Variables

Add these to your Vercel environment:

```bash
SUPABASE_URL=https://wjeglmmcbdtrochsmqvz.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here      # For client-side (limited access)
SUPABASE_SERVICE_KEY=your_service_key_here # For server-side (full access)
```

> **Important**: Never expose the service role key to the client. Use it only in serverless functions.

#### Connection Method

Supabase uses a **RESTful API** (not direct PostgreSQL connection):
- Each project has a unique API endpoint
- API keys authenticate requests
- PostgREST handles SQL-to-REST translation
- Perfect for serverless (no connection pooling needed)

#### Initialize Supabase Client

Create `user_root/api/_shared/supabase.js`:

```javascript
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

// Service role client for server-side operations (bypasses RLS)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

module.exports = { supabaseAdmin };
```

---

### Step 2: Create Data Access Layer (20 minutes)

Create new file: `user_root/api/_shared/supabase-data.js`

> **Note**: This file can be shared between admin_root and user_root by placing in a common location, or each app can have its own copy.

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

Update user_root read endpoints to fetch from Supabase instead of HubSpot.

#### Example: `user_root/api/mock-exams/available.js` (READ - Critical for booking)

```javascript
const { getExamsFromSupabase } = require('../_shared/supabase-data');
const redis = require('../_shared/redis');

module.exports = async (req, res) => {
  const cacheKey = `user:exams:available`;

  // 1. Check Redis cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    return res.status(200).json({ success: true, exams: JSON.parse(cached) });
  }

  // 2. Cache miss → Fetch from SUPABASE (not HubSpot!)
  const exams = await getExamsFromSupabase({
    is_active: 'active',
    startDate: new Date().toISOString().split('T')[0] // Only future exams
  });

  // 3. Cache in Redis (shorter TTL for availability - 1 minute)
  await redis.set(cacheKey, JSON.stringify(exams), 'EX', 60);

  return res.status(200).json({ success: true, exams });
};
```

#### Example: `user_root/api/bookings/list.js` (READ - User's bookings)

```javascript
const { getBookingsFromSupabase } = require('../_shared/supabase-data');
const redis = require('../_shared/redis');

module.exports = async (req, res) => {
  const { contactId } = req.query; // User's contact ID
  const cacheKey = `user:bookings:${contactId}`;

  // 1. Check Redis cache
  const cached = await redis.get(cacheKey);
  if (cached) {
    return res.status(200).json({ success: true, bookings: JSON.parse(cached) });
  }

  // 2. Cache miss → Fetch from SUPABASE
  const bookings = await getBookingsByContactFromSupabase(contactId);

  // 3. Cache in Redis
  await redis.set(cacheKey, JSON.stringify(bookings), 'EX', 300);

  return res.status(200).json({ success: true, bookings });
};
```

### Step 4: Update Write Endpoints (HubSpot → Supabase → Invalidate)

Update user_root write endpoints to sync to Supabase and invalidate Redis.

#### Example: `user_root/api/bookings/create.js` (WRITE - Critical booking endpoint)

```javascript
const hubspot = require('../_shared/hubspot');
const { syncBookingToSupabase } = require('../_shared/supabase-data');
const redis = require('../_shared/redis');

module.exports = async (req, res) => {
  const { examId, contactId, ...bookingData } = req.body;

  // 1. Atomic capacity check with Redis (prevents overbooking)
  const capacityKey = `capacity:${examId}`;
  const remaining = await redis.decr(capacityKey);

  if (remaining < 0) {
    // Restore the counter and reject
    await redis.incr(capacityKey);
    return res.status(409).json({
      success: false,
      error: 'Session is full'
    });
  }

  try {
    // 2. Write to HubSpot (source of truth)
    const booking = await hubspot.createBooking({ examId, contactId, ...bookingData });

    // 3. Sync to Supabase
    await syncBookingToSupabase(booking, examId);

    // 4. Invalidate Redis caches
    await Promise.all([
      redis.del(`user:bookings:${contactId}`),
      redis.del(`user:exams:available`)
    ]);

    return res.status(201).json({ success: true, booking });
  } catch (error) {
    // Restore capacity on failure
    await redis.incr(capacityKey);
    throw error;
  }
};
```

#### Example: `user_root/api/bookings/batch-cancel.js` (WRITE)

```javascript
const hubspot = require('../_shared/hubspot');
const { syncBookingToSupabase } = require('../_shared/supabase-data');
const redis = require('../_shared/redis');

module.exports = async (req, res) => {
  const { bookingId, examId, contactId } = req.body;

  // 1. Update in HubSpot
  const booking = await hubspot.cancelBooking(bookingId);

  // 2. Sync updated booking to Supabase
  await syncBookingToSupabase(booking, examId);

  // 3. Restore capacity
  const capacityKey = `capacity:${examId}`;
  await redis.incr(capacityKey);

  // 4. Invalidate caches
  await Promise.all([
    redis.del(`user:bookings:${contactId}`),
    redis.del(`user:exams:available`)
  ]);

  return res.status(200).json({ success: true, booking });
};
```

#### Capacity Initialization (on exam creation/update from admin)

When admin creates or updates exams, initialize Redis capacity counters:

```javascript
// admin_root/api/admin/mock-exams/create.js (ADMIN - triggers user_root cache)
const hubspot = require('../../_shared/hubspot');
const { syncExamToSupabase } = require('../../_shared/supabase-data');
const redis = require('../../_shared/redis');

module.exports = async (req, res) => {
  // 1. Create in HubSpot
  const exam = await hubspot.createMockExam(req.body);

  // 2. Sync to Supabase
  await syncExamToSupabase(exam);

  // 3. Initialize Redis capacity counter
  const capacityKey = `capacity:${exam.id}`;
  await redis.set(capacityKey, exam.properties.capacity);

  // 4. Invalidate caches (both admin and user)
  await Promise.all([
    redis.del(`exams:list`),
    redis.del(`user:exams:available`)
  ]);

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

### user_root Read Endpoints (Change to Supabase)

| Endpoint | Change | Priority |
|----------|--------|----------|
| `user_root/api/mock-exams/available.js` | Read from `getExamsFromSupabase()` | **Critical** |
| `user_root/api/bookings/list.js` | Read from `getBookingsByContactFromSupabase()` | High |
| `user_root/api/bookings/[id].js` | Read from `getBookingByIdFromSupabase()` | Medium |

### user_root Write Endpoints (Add Supabase sync + Redis capacity)

| Endpoint | Changes | Priority |
|----------|---------|----------|
| `user_root/api/bookings/create.js` | Redis atomic DECR + `syncBookingToSupabase()` | **Critical** |
| `user_root/api/bookings/batch-cancel.js` | Redis INCR + `syncBookingToSupabase()` | High |

### admin_root Write Endpoints (Trigger user_root cache invalidation)

| Endpoint | Changes | Why |
|----------|---------|-----|
| `admin_root/api/admin/mock-exams/create.js` | Initialize Redis capacity + invalidate `user:exams:available` | New exams need capacity counters |
| `admin_root/api/admin/mock-exams/update.js` | Update Redis capacity + invalidate `user:exams:available` | Capacity changes affect user app |
| `admin_root/api/admin/mock-exams/delete.js` | Delete Redis capacity + invalidate `user:exams:available` | Deleted exams unavailable |
| `admin_root/api/admin/mock-exams/activate.js` | Invalidate `user:exams:available` | Status changes visibility |

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

## Security: API Keys, RLS & Hardening

This section covers securing the Supabase tables with least privilege access, Row Level Security policies, and hardening techniques.

### API Key Strategy (Least Privilege)

Supabase provides different API key types. For our server-side use case:

| Key Type | Privilege | Our Usage |
|----------|-----------|-----------|
| **`anon` key** | Low - respects RLS | NOT USED - we don't need client-side access |
| **`service_role` key** | High - bypasses RLS | ✅ Used for server-side sync operations |

#### Why Service Role Key?

Our architecture requires the service role key because:
1. **Server-side only**: All Supabase calls happen in Vercel serverless functions (never client-side)
2. **Sync operations need full access**: Upserting HubSpot data requires bypassing RLS
3. **No user authentication context**: Our sync operations don't have a logged-in Supabase user

#### Environment Variables (Updated)

```bash
# Vercel Environment Variables
SUPABASE_URL=https://wjeglmmcbdtrochsmqvz.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key_here  # Server-side only, bypasses RLS

# NOT NEEDED for this architecture (no client-side Supabase access)
# SUPABASE_ANON_KEY=your_anon_key_here
```

#### Security Best Practices for Service Key

1. **Never expose in client code** - Only use in serverless functions
2. **Store encrypted** - Use Vercel's encrypted environment variables
3. **Log safely** - Only log first 6 characters if needed: `console.log('Key: ' + key.substring(0, 6) + '...')`
4. **Rotate if compromised** - Regenerate in Supabase Dashboard → Settings → API

---

### Row Level Security (RLS) Policies

Even though we use the service role key (which bypasses RLS), enabling RLS is still important:
1. **Defense in depth** - Protection if key is ever exposed
2. **Future-proofing** - If we add client-side access later
3. **Best practice** - Supabase warns about tables without RLS

#### Enable RLS on Tables

Run in Supabase SQL Editor:

```sql
-- Enable RLS on all sync tables
ALTER TABLE public.hubspot_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hubspot_mock_exams ENABLE ROW LEVEL SECURITY;
```

#### Create RLS Policies

Since our tables are only accessed by the service role key (server-side), we create restrictive policies that block direct access:

```sql
-- ============== BOOKINGS TABLE POLICIES ==============

-- Policy: Block all direct access (service_role bypasses this)
CREATE POLICY "Deny direct access to bookings"
ON public.hubspot_bookings
FOR ALL
TO anon, authenticated
USING (false);

-- If you later need read access for authenticated users:
-- CREATE POLICY "Users can view their own bookings"
-- ON public.hubspot_bookings
-- FOR SELECT
-- TO authenticated
-- USING (contact_id = auth.jwt() ->> 'contact_id');

-- ============== MOCK EXAMS TABLE POLICIES ==============

-- Policy: Block all direct access (service_role bypasses this)
CREATE POLICY "Deny direct access to mock_exams"
ON public.hubspot_mock_exams
FOR ALL
TO anon, authenticated
USING (false);

-- If you later need public read access for available exams:
-- CREATE POLICY "Anyone can view active exams"
-- ON public.hubspot_mock_exams
-- FOR SELECT
-- TO anon, authenticated
-- USING (is_active = 'active');
```

#### Why Block Direct Access?

Our architecture routes ALL data access through the API:
```
User → API Endpoint → Service Role Key → Supabase
```

Direct Supabase access (using anon key from browser) is NOT part of our design. The restrictive policies ensure:
- **No accidental exposure** if someone tries to connect directly
- **API is the single entry point** for all data access
- **Service role key** handles all operations server-side

---

### Hardening Techniques

#### 1. Custom Schema (Optional - Advanced)

Instead of using the `public` schema, create a dedicated `api` schema:

```sql
-- Create private schema
CREATE SCHEMA IF NOT EXISTS hubspot_sync;

-- Move tables to private schema
ALTER TABLE public.hubspot_bookings SET SCHEMA hubspot_sync;
ALTER TABLE public.hubspot_mock_exams SET SCHEMA hubspot_sync;

-- Grant access only to service role (implicitly has all access)
-- No grants needed for anon/authenticated since service_role bypasses
```

**Benefits**:
- Tables are hidden from default Data API exposure
- Explicit control over what's accessible
- Reduces attack surface

**Trade-off**: Requires updating all table references in code to use `hubspot_sync.table_name`.

#### 2. Revoke Public Schema Defaults (Recommended)

Prevent accidental access by revoking default permissions:

```sql
-- Revoke default public schema permissions for anon and authenticated
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

-- Re-grant only to specific tables if needed later
-- GRANT SELECT ON public.hubspot_mock_exams TO anon;
```

#### 3. Monitor for Unprotected Tables

Supabase sends daily emails warning about tables without RLS. Additionally:

1. **Check Security Advisor**: Supabase Dashboard → Database → Security Advisor
2. **Query unprotected tables**:
   ```sql
   SELECT schemaname, tablename
   FROM pg_tables
   WHERE schemaname = 'public'
   AND tablename NOT IN (
     SELECT tablename FROM pg_policies WHERE schemaname = 'public'
   );
   ```

#### 4. Audit Logging (Optional)

Track who accesses data:

```sql
-- Create audit table
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL,
  record_id TEXT,
  performed_at TIMESTAMP DEFAULT NOW(),
  performed_by TEXT
);

-- Add trigger to bookings table
CREATE OR REPLACE FUNCTION log_booking_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_log (table_name, operation, record_id, performed_by)
  VALUES (
    'hubspot_bookings',
    TG_OP,
    COALESCE(NEW.hubspot_id, OLD.hubspot_id),
    current_user
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bookings_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.hubspot_bookings
FOR EACH ROW EXECUTE FUNCTION log_booking_changes();
```

---

### Security Checklist

- [ ] **Service role key** stored in Vercel encrypted env vars
- [ ] **RLS enabled** on `hubspot_bookings` and `hubspot_mock_exams`
- [ ] **Restrictive policies** created to block direct access
- [ ] **No anon key** exposed to client (not needed)
- [ ] **Security Advisor** checked in Supabase Dashboard
- [ ] **Default permissions revoked** from public schema
- [ ] **Audit logging** enabled (optional)

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

### Performance Targets (250 concurrent users)
- [ ] **<1 second** response time for availability checks
- [ ] **Zero HubSpot 429 errors** during booking rush
- [ ] **Zero overbookings** with Redis atomic counters
- [ ] **<50ms** average read latency from Supabase

### Technical Requirements
- [ ] All user_root reads come from Supabase (not HubSpot)
- [ ] Redis capacity counters initialized for all exams
- [ ] Writes sync to Supabase within same request
- [ ] Cache invalidation working across admin/user apps
- [ ] Force sync endpoint available for recovery
- [ ] Zero additional monthly costs
- [ ] Initial migration completed successfully

### User Experience
- [ ] Instant feedback on slot availability
- [ ] No "session full" errors after waiting
- [ ] Accurate real-time capacity display

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
