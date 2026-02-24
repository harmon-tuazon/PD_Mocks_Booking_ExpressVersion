# PRD: Supabase Postgres Integration for PrepDoctors Mock Booking System

**Status**: Draft
**Created**: 2025-01-18
**Owner**: Development Team
**Priority**: High
**Confidence Score**: 8/10

---

## Executive Summary

This PRD outlines the integration of Supabase Postgres as a high-performance read layer and analytics database alongside HubSpot CRM. The goal is to achieve 90% reduction in HubSpot API calls, enable real-time features, support complex analytics, and maintain a reliable hybrid architecture where both systems remain in sync.

### Key Objectives
- Reduce HubSpot API calls by 90% through intelligent caching
- Enable sub-second dashboard load times (currently 3-8 seconds)
- Support complex analytics and reporting impossible in HubSpot
- Implement real-time capacity updates across admin sessions
- Maintain 100% data consistency between HubSpot and Supabase

### Success Metrics
- Dashboard load time: < 500ms (from 3-8 seconds)
- HubSpot API calls: < 100/day (from ~1000/day)
- Sync lag: < 5 seconds for critical data
- Data accuracy: 100% (verified via reconciliation)
- Uptime: 99.9% for read operations

---

## Problem Statement

### Current Architecture Limitations

**Performance Issues:**
- Admin dashboard requires 5-10 HubSpot API calls per page load
- User booking listings need 3-5 API calls with associations
- Search/filter operations trigger new API calls (rate limiting risk)
- Mobile calendar view loads 30+ exams = 30+ API calls

**Analytics Limitations:**
- HubSpot search API doesn't support complex aggregations
- No native JOIN operations
- Time-series analysis requires pulling all data client-side
- Booking trends and forecasting extremely difficult

**Rate Limiting Concerns:**
- HubSpot API: 100 requests per 10 seconds
- Current usage: ~1000 requests/day
- Growth will hit limits quickly
- No guarantee of request completion

**Real-Time Features:**
- No live updates (polling every 30 seconds)
- Multiple admins see stale data
- Capacity changes not reflected immediately

### Why Not Just HubSpot?

HubSpot is excellent for:
- ✅ Contact/CRM management
- ✅ Email workflows and automation
- ✅ Marketing integration
- ✅ Notes and communication history

HubSpot is NOT optimized for:
- ❌ High-frequency reads (dashboards, listings)
- ❌ Complex analytics and reporting
- ❌ Real-time subscriptions
- ❌ Time-series queries
- ❌ Custom JOIN operations

---

## Proposed Solution

### Hybrid Architecture: HubSpot + Supabase

```
┌─────────────────────────────────────────────────────────────┐
│                   HYBRID ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────┐         ┌──────────────────────┐    │
│  │    HubSpot       │         │    Supabase          │    │
│  │    (Source of    │◄───────►│    (Performance      │    │
│  │     Truth)       │         │     Layer)           │    │
│  ├──────────────────┤         ├──────────────────────┤    │
│  │ • Contacts       │         │ • Mock Exams (cache) │    │
│  │ • Workflows      │         │ • Bookings (cache)   │    │
│  │ • Email          │         │ • Analytics Tables   │    │
│  │ • Notes          │         │ • Audit Logs         │    │
│  │ • Associations   │         │ • Real-time Views    │    │
│  └────────┬─────────┘         └──────────┬───────────┘    │
│           │                              │                 │
│           │                              │                 │
│      ┌────▼──────────────────────────────▼─────┐          │
│      │   Vercel Serverless Functions           │          │
│      ├─────────────────────────────────────────┤          │
│      │ • Sync Engine (5 strategies)            │          │
│      │ • Write Router (smart routing)          │          │
│      │ • Read Optimizer (query planner)        │          │
│      │ • Reconciliation Service (hourly)       │          │
│      │ • Conflict Resolver (drift detection)   │          │
│      └─────────────────────────────────────────┘          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Data Ownership Model

| Data Type | Source of Truth | Synced To | Sync Strategy | Lag Tolerance |
|-----------|----------------|-----------|---------------|---------------|
| Contacts | HubSpot | Supabase (read cache) | Webhook + Polling | 30 seconds |
| Mock Exams | HubSpot | Supabase (read cache) | Webhook + Polling | 5 seconds |
| Bookings (new) | Supabase | HubSpot (workflows) | Event-driven | 2 seconds |
| Bookings (existing) | HubSpot | Supabase (migration) | One-time batch | N/A |
| Analytics | Supabase | None | Computed locally | N/A |
| Audit Logs | Supabase | HubSpot (notes) | Async batch | 5 minutes |

---

## Sync Strategies: Comprehensive Analysis

### Strategy 1: Webhook-Based Sync (Primary)

**How It Works:**
```javascript
// HubSpot → Supabase (via webhook)
// HubSpot sends webhook when booking created/updated
app.post('/api/webhooks/hubspot-sync', async (req, res) => {
  const { objectType, eventType, objectId } = req.body;

  // Acknowledge immediately (< 3 seconds required)
  res.status(200).send();

  // Process async
  process.nextTick(async () => {
    const booking = await hubspot.getBooking(objectId);

    await supabase.from('bookings').upsert({
      hubspot_id: booking.id,
      booking_id: booking.properties.booking_id,
      status: booking.properties.status,
      synced_at: new Date()
    }, { onConflict: 'hubspot_id' });

    console.log(`✅ Synced booking ${objectId} via webhook`);
  });
});
```

**Pros:**
- ✅ Real-time (< 5 second lag)
- ✅ Event-driven (no polling overhead)
- ✅ Efficient (only changed data)
- ✅ Native HubSpot support

**Cons:**
- ❌ Webhook failures (network issues, downtime)
- ❌ No guaranteed delivery
- ❌ Requires public endpoint
- ❌ 3-second timeout limit (must be fast)

**Reliability Improvements:**
```javascript
// Webhook with idempotency and retry queue
const WEBHOOK_TIMEOUT = 2500; // 2.5s max processing

app.post('/api/webhooks/hubspot-sync', async (req, res) => {
  const events = req.body;

  // Respond immediately
  res.status(200).json({ received: events.length });

  // Queue for processing
  for (const event of events) {
    await redis.rpush('webhook_queue', JSON.stringify(event));
  }
});

// Background worker processes queue
async function processWebhookQueue() {
  while (true) {
    const event = await redis.lpop('webhook_queue');
    if (!event) {
      await sleep(1000);
      continue;
    }

    try {
      await syncEventToSupabase(JSON.parse(event));
    } catch (error) {
      // Re-queue for retry
      await redis.rpush('webhook_retry_queue', event);
    }
  }
}
```

**Best For:** Real-time critical updates (bookings, cancellations, capacity changes)

---

### Strategy 2: Polling-Based Sync (Backup/Fallback)

**How It Works:**
```javascript
// Periodic poll for changes (every 5 minutes)
// api/cron/poll-hubspot-changes.js

module.exports = async (req, res) => {
  // Auth check
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const lastPollTime = await redis.get('last_hubspot_poll');
  const now = Date.now();

  // Poll bookings modified since last check
  const modifiedBookings = await hubspot.apiCall('POST',
    '/crm/v3/objects/bookings/search', {
    filterGroups: [{
      filters: [{
        propertyName: 'hs_lastmodifieddate',
        operator: 'GT',
        value: lastPollTime
      }]
    }],
    properties: ['booking_id', 'status', 'email', 'exam_date'],
    limit: 100
  });

  // Batch upsert to Supabase
  if (modifiedBookings.results.length > 0) {
    await supabase.from('bookings').upsert(
      modifiedBookings.results.map(transformHubSpotToPostgres),
      { onConflict: 'hubspot_id' }
    );

    console.log(`✅ Polled and synced ${modifiedBookings.results.length} bookings`);
  }

  // Update last poll time
  await redis.set('last_hubspot_poll', now);

  return res.status(200).json({
    synced: modifiedBookings.results.length,
    next_poll_in: '5 minutes'
  });
};
```

**Vercel Cron Configuration:**
```json
{
  "crons": [
    {
      "path": "/api/cron/poll-hubspot-changes",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

**Pros:**
- ✅ Guaranteed execution (Vercel cron)
- ✅ Simple to implement
- ✅ No webhook dependency
- ✅ Works behind firewalls

**Cons:**
- ❌ Higher latency (up to 5 minutes)
- ❌ More API calls (even if no changes)
- ❌ Less efficient than webhooks
- ❌ Polling interval trade-off (frequency vs cost)

**Optimization: Smart Polling**
```javascript
// Only poll active/recent exams
const recentExams = await hubspot.searchMockExams({
  filters: [{
    propertyName: 'exam_date',
    operator: 'GTE',
    value: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
  }]
});

// Reduce API calls by 80%
```

**Best For:** Non-critical data, webhook backup, historical data sync

---

### Strategy 3: Change Data Capture (CDC) with Database Triggers

**How It Works:**
```sql
-- Supabase-side triggers for Postgres → HubSpot sync

-- 1. Create audit table for tracking changes
CREATE TABLE sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  operation TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
  old_data JSONB,
  new_data JSONB,
  synced BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Trigger on bookings table
CREATE OR REPLACE FUNCTION queue_hubspot_sync()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO sync_queue (table_name, record_id, operation, new_data)
    VALUES (TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(NEW));
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO sync_queue (table_name, record_id, operation, old_data, new_data)
    VALUES (TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(OLD), row_to_json(NEW));
  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO sync_queue (table_name, record_id, operation, old_data)
    VALUES (TG_TABLE_NAME, OLD.id, TG_OP, row_to_json(OLD));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to bookings table
CREATE TRIGGER bookings_sync_trigger
AFTER INSERT OR UPDATE OR DELETE ON bookings
FOR EACH ROW EXECUTE FUNCTION queue_hubspot_sync();
```

**Sync Worker (Vercel Function):**
```javascript
// api/cron/process-sync-queue.js

module.exports = async (req, res) => {
  // Get pending sync operations
  const { data: pendingSyncs } = await supabase
    .from('sync_queue')
    .select('*')
    .eq('synced', false)
    .order('created_at', { ascending: true })
    .limit(50);

  for (const sync of pendingSyncs) {
    try {
      if (sync.operation === 'INSERT') {
        await hubspot.createBooking(sync.new_data);
      } else if (sync.operation === 'UPDATE') {
        await hubspot.updateBooking(sync.new_data.hubspot_id, sync.new_data);
      } else if (sync.operation === 'DELETE') {
        await hubspot.softDeleteBooking(sync.old_data.hubspot_id);
      }

      // Mark as synced
      await supabase
        .from('sync_queue')
        .update({ synced: true })
        .eq('id', sync.id);

    } catch (error) {
      console.error(`Failed to sync ${sync.id}:`, error.message);
      // Keep in queue for retry
    }
  }

  return res.status(200).json({ processed: pendingSyncs.length });
};
```

**Pros:**
- ✅ Database-native (no application logic)
- ✅ Guaranteed capture of all changes
- ✅ Built-in retry queue
- ✅ Ordered processing

**Cons:**
- ❌ Requires Postgres expertise
- ❌ Trigger performance overhead
- ❌ Harder to debug
- ❌ More complex rollback

**Best For:** Guaranteed sync, audit trail, complex transformations

---

### Strategy 4: Event-Driven with Message Queue (Advanced)

**How It Works:**
```javascript
// Use Redis Streams as message queue for async sync

// Publisher (after booking creation)
async function createBooking(data) {
  // 1. Write to Supabase
  const { data: booking } = await supabase
    .from('bookings')
    .insert(data)
    .select()
    .single();

  // 2. Publish event to Redis Stream
  await redis.xadd(
    'sync_events',
    '*', // auto-generate ID
    'event_type', 'booking.created',
    'booking_id', booking.id,
    'payload', JSON.stringify(booking)
  );

  return booking;
}

// Consumer (background worker)
async function consumeSyncEvents() {
  const lastId = await redis.get('sync_consumer_last_id') || '0';

  while (true) {
    const events = await redis.xread(
      'BLOCK', 5000, // 5 second timeout
      'STREAMS', 'sync_events', lastId
    );

    if (!events) continue;

    for (const [stream, messages] of events) {
      for (const [id, fields] of messages) {
        const eventType = fields[1]; // event_type value
        const payload = JSON.parse(fields[3]); // payload value

        try {
          // Sync to HubSpot
          if (eventType === 'booking.created') {
            await hubspot.createBooking(payload);
          }

          // Update last processed ID
          await redis.set('sync_consumer_last_id', id);

        } catch (error) {
          console.error(`Failed to process event ${id}:`, error);
          // Event stays in stream for retry
        }
      }
    }
  }
}
```

**With Dead Letter Queue:**
```javascript
// After 3 failed attempts, move to DLQ
const MAX_RETRIES = 3;

async function processSyncEvent(event) {
  const retryCount = await redis.get(`retry_count:${event.id}`) || 0;

  try {
    await syncToHubSpot(event);
    await redis.del(`retry_count:${event.id}`);
  } catch (error) {
    if (retryCount >= MAX_RETRIES) {
      // Move to dead letter queue
      await redis.xadd(
        'sync_events_dlq',
        '*',
        'original_event', JSON.stringify(event),
        'error', error.message,
        'retry_count', retryCount
      );
      console.error(`⚠️ Event ${event.id} moved to DLQ after ${MAX_RETRIES} failures`);
    } else {
      await redis.incr(`retry_count:${event.id}`);
    }
  }
}
```

**Pros:**
- ✅ Decoupled architecture
- ✅ Built-in retry logic
- ✅ Ordered processing guaranteed
- ✅ High throughput

**Cons:**
- ❌ More complex infrastructure
- ❌ Requires message queue management
- ❌ Additional Redis memory usage
- ❌ Harder to debug

**Best For:** High-volume writes, microservices architecture, guaranteed ordering

---

### Strategy 5: Reconciliation-Based Sync (Safety Net)

**How It Works:**
```javascript
// Hourly reconciliation to catch any missed syncs
// api/cron/reconcile-supabase-hubspot.js

module.exports = async (req, res) => {
  console.log('🔄 Starting Supabase ↔ HubSpot reconciliation');

  const results = {
    supabase_to_hubspot: { checked: 0, missing: 0, synced: 0 },
    hubspot_to_supabase: { checked: 0, missing: 0, synced: 0 },
    conflicts: []
  };

  // ===== DIRECTION 1: Supabase → HubSpot =====

  // Find bookings in Supabase not synced to HubSpot
  const { data: unsyncedBookings } = await supabase
    .from('bookings')
    .select('*')
    .or('hubspot_synced.is.null,hubspot_synced.eq.false')
    .limit(100);

  results.supabase_to_hubspot.checked = unsyncedBookings.length;

  for (const booking of unsyncedBookings) {
    try {
      // Check if exists in HubSpot
      const existsInHubSpot = await hubspot.checkExistingBooking(booking.booking_id);

      if (!existsInHubSpot) {
        // Missing in HubSpot, create it
        const hubspotBooking = await hubspot.createBooking(booking);

        await supabase.from('bookings').update({
          hubspot_id: hubspotBooking.id,
          hubspot_synced: true,
          hubspot_synced_at: new Date()
        }).eq('id', booking.id);

        results.supabase_to_hubspot.missing++;
        results.supabase_to_hubspot.synced++;
      }
    } catch (error) {
      console.error(`Failed to sync booking ${booking.id}:`, error.message);
    }
  }

  // ===== DIRECTION 2: HubSpot → Supabase =====

  // Get recent HubSpot bookings (last 7 days)
  const hubspotBookings = await hubspot.apiCall('POST',
    '/crm/v3/objects/bookings/search', {
    filterGroups: [{
      filters: [{
        propertyName: 'createdate',
        operator: 'GTE',
        value: Date.now() - (7 * 24 * 60 * 60 * 1000)
      }]
    }],
    limit: 100
  });

  results.hubspot_to_supabase.checked = hubspotBookings.results.length;

  for (const hsBooking of hubspotBookings.results) {
    const { data: pgBooking } = await supabase
      .from('bookings')
      .select('id, status, updated_at')
      .eq('hubspot_id', hsBooking.id)
      .single();

    if (!pgBooking) {
      // Missing in Supabase, create it
      await supabase.from('bookings').insert(
        transformHubSpotToPostgres(hsBooking)
      );

      results.hubspot_to_supabase.missing++;
      results.hubspot_to_supabase.synced++;

    } else {
      // Check for conflicts (different status)
      const pgStatus = pgBooking.status;
      const hsStatus = hsBooking.properties.status;

      if (pgStatus !== hsStatus) {
        results.conflicts.push({
          booking_id: hsBooking.properties.booking_id,
          supabase_status: pgStatus,
          hubspot_status: hsStatus,
          resolution: 'HubSpot wins (source of truth)'
        });

        // HubSpot is source of truth, update Supabase
        await supabase.from('bookings').update({
          status: hsStatus,
          hubspot_synced_at: new Date()
        }).eq('id', pgBooking.id);
      }
    }
  }

  console.log('✅ Reconciliation complete:', results);

  return res.status(200).json(results);
};
```

**Conflict Resolution Strategy:**
```javascript
// HubSpot = Source of Truth for existing data
// Supabase = Source of Truth for new bookings

function resolveConflict(supabaseRecord, hubspotRecord) {
  // Rule 1: If HubSpot record is older, HubSpot wins
  if (hubspotRecord.properties.hs_lastmodifieddate > supabaseRecord.updated_at) {
    return 'HUBSPOT_WINS';
  }

  // Rule 2: If Supabase has hubspot_synced = false, Supabase wins
  if (!supabaseRecord.hubspot_synced) {
    return 'SUPABASE_WINS';
  }

  // Rule 3: Status changes - HubSpot wins (workflows may have changed it)
  if (supabaseRecord.status !== hubspotRecord.properties.status) {
    return 'HUBSPOT_WINS';
  }

  // Default: No conflict
  return 'NO_CONFLICT';
}
```

**Pros:**
- ✅ Guaranteed eventual consistency
- ✅ Catches all sync failures
- ✅ Conflict detection and resolution
- ✅ Safety net for all other strategies

**Cons:**
- ❌ Higher latency (hourly)
- ❌ More API calls
- ❌ Requires conflict resolution logic
- ❌ Doesn't prevent drift, only fixes it

**Best For:** Safety net, data integrity verification, drift correction

---

### Strategy 6: Hybrid Multi-Layer Sync (RECOMMENDED)

**Architecture:**
```
┌─────────────────────────────────────────────────────────┐
│              MULTI-LAYER SYNC STRATEGY                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Layer 1: Webhook Sync (Real-time)                     │
│  ├─ HubSpot → Supabase: < 5 second lag                 │
│  └─ Critical: Bookings, Cancellations, Capacity        │
│                                                         │
│  Layer 2: Event Queue (Async)                          │
│  ├─ Supabase → HubSpot: < 10 second lag                │
│  └─ All writes: New bookings, updates                  │
│                                                         │
│  Layer 3: Polling Fallback (5 minutes)                 │
│  ├─ Catches webhook failures                           │
│  └─ Non-critical: Contact updates, exam changes        │
│                                                         │
│  Layer 4: Reconciliation (Hourly)                      │
│  ├─ Bidirectional verification                         │
│  ├─ Conflict detection and resolution                  │
│  └─ Drift correction                                   │
│                                                         │
│  Layer 5: Manual Sync Tools (On-demand)                │
│  ├─ Admin dashboard: "Sync Now" button                 │
│  └─ CLI tools for bulk operations                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Implementation Plan:**
```javascript
// Sync coordinator decides which strategy to use
class SyncCoordinator {
  async syncBooking(booking, context) {
    const strategy = this.selectStrategy(booking, context);

    switch (strategy) {
      case 'WEBHOOK':
        return await this.webhookSync(booking);

      case 'EVENT_QUEUE':
        return await this.queueSync(booking);

      case 'IMMEDIATE':
        return await this.immediateSync(booking);

      case 'BATCH':
        return await this.batchSync([booking]);
    }
  }

  selectStrategy(booking, context) {
    // Critical operation? Use webhook
    if (context.critical || booking.status === 'cancelled') {
      return 'WEBHOOK';
    }

    // Bulk operation? Use batch
    if (context.isBulk) {
      return 'BATCH';
    }

    // Admin action? Immediate feedback
    if (context.isAdmin) {
      return 'IMMEDIATE';
    }

    // Default: Event queue
    return 'EVENT_QUEUE';
  }
}
```

**Pros:**
- ✅ Best of all strategies
- ✅ Automatic failover
- ✅ Optimized for each use case
- ✅ High reliability

**Cons:**
- ❌ Most complex implementation
- ❌ Hardest to debug
- ❌ Requires careful orchestration

**Best For:** Production systems requiring high reliability and performance

---

## Recommended Sync Strategy

### Phase 1 (Week 1-2): Foundation
**Strategy:** Webhook + Polling Fallback

```javascript
// Start simple with proven patterns
// HubSpot → Supabase: Webhooks
// Fallback: 5-minute polling
```

**Rationale:**
- Low complexity
- Proven reliability
- Easy to debug
- Quick to implement

### Phase 2 (Week 3-4): Bidirectional Sync
**Strategy:** Add Event Queue for Supabase → HubSpot

```javascript
// Supabase → HubSpot: Redis Streams + Worker
// Maintains HubSpot workflows
```

**Rationale:**
- Enables write operations in Supabase
- Decoupled architecture
- Built-in retry logic

### Phase 3 (Month 2): Production Hardening
**Strategy:** Add Reconciliation + CDC

```javascript
// Hourly reconciliation for safety
// Database triggers for critical tables
```

**Rationale:**
- Guaranteed consistency
- Audit trail
- Production-ready

---

## Database Schema

### Supabase Tables

```sql
-- =====================================================
-- CORE TABLES (Cached from HubSpot)
-- =====================================================

-- Mock Exams (cached from HubSpot)
CREATE TABLE mock_exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hubspot_id TEXT UNIQUE NOT NULL,
  mock_type TEXT NOT NULL,
  exam_date DATE NOT NULL,
  exam_time_start TIME,
  exam_time_end TIME,
  location TEXT,
  capacity INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  hubspot_synced_at TIMESTAMP
);

-- Bookings (hybrid: new in Supabase, historical from HubSpot)
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hubspot_id TEXT UNIQUE,
  booking_id TEXT UNIQUE NOT NULL,
  exam_id UUID REFERENCES mock_exams(id),
  contact_id UUID REFERENCES contacts(id),
  status TEXT DEFAULT 'active',
  token_used TEXT,
  dominant_hand TEXT,
  attending_location TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  hubspot_synced BOOLEAN DEFAULT false,
  hubspot_synced_at TIMESTAMP,
  sync_attempts INTEGER DEFAULT 0
);

-- Contacts (cached from HubSpot for lookups)
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hubspot_id TEXT UNIQUE NOT NULL,
  student_id TEXT,
  email TEXT NOT NULL,
  firstname TEXT,
  lastname TEXT,
  sj_credits INTEGER DEFAULT 0,
  cs_credits INTEGER DEFAULT 0,
  sjmini_credits INTEGER DEFAULT 0,
  shared_mock_credits INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  hubspot_synced_at TIMESTAMP
);

-- =====================================================
-- ANALYTICS TABLES (Supabase-only)
-- =====================================================

-- Booking analytics materialized view
CREATE MATERIALIZED VIEW booking_analytics AS
SELECT
  DATE_TRUNC('week', e.exam_date) as week,
  e.mock_type,
  COUNT(b.id) as total_bookings,
  COUNT(CASE WHEN b.status = 'cancelled' THEN 1 END) as cancellations,
  AVG(e.capacity::NUMERIC) as avg_capacity,
  AVG((COUNT(b.id)::NUMERIC / NULLIF(e.capacity, 0)) * 100) as avg_utilization
FROM mock_exams e
LEFT JOIN bookings b ON b.exam_id = e.id
WHERE e.exam_date >= NOW() - INTERVAL '6 months'
GROUP BY week, e.mock_type;

-- Refresh daily
CREATE INDEX idx_booking_analytics_week ON booking_analytics(week DESC);

-- =====================================================
-- AUDIT TABLES (Supabase-only)
-- =====================================================

-- Booking events audit log
CREATE TABLE booking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id),
  event_type TEXT NOT NULL, -- 'created', 'cancelled', 'modified', 'no_show'
  admin_email TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Sync error log
CREATE TABLE sync_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  direction TEXT NOT NULL, -- 'hubspot_to_supabase', 'supabase_to_hubspot'
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- SYNC INFRASTRUCTURE TABLES
-- =====================================================

-- Sync queue (for database triggers)
CREATE TABLE sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  operation TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
  old_data JSONB,
  new_data JSONB,
  synced BOOLEAN DEFAULT false,
  sync_attempts INTEGER DEFAULT 0,
  last_sync_attempt TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Sync status tracking
CREATE TABLE sync_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  last_hubspot_poll TIMESTAMP,
  last_reconciliation TIMESTAMP,
  total_synced INTEGER DEFAULT 0,
  total_errors INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Bookings
CREATE INDEX idx_bookings_exam_id ON bookings(exam_id);
CREATE INDEX idx_bookings_contact_id ON bookings(contact_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_hubspot_synced ON bookings(hubspot_synced) WHERE hubspot_synced = false;
CREATE INDEX idx_bookings_created_at ON bookings(created_at DESC);

-- Mock Exams
CREATE INDEX idx_mock_exams_date ON mock_exams(exam_date);
CREATE INDEX idx_mock_exams_active ON mock_exams(is_active) WHERE is_active = true;
CREATE INDEX idx_mock_exams_type_date ON mock_exams(mock_type, exam_date);

-- Contacts
CREATE INDEX idx_contacts_student_id ON contacts(student_id);
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_hubspot_id ON contacts(hubspot_id);

-- Sync Queue
CREATE INDEX idx_sync_queue_unsynced ON sync_queue(synced, created_at) WHERE synced = false;

-- Booking Events (for audit queries)
CREATE INDEX idx_booking_events_booking_id ON booking_events(booking_id);
CREATE INDEX idx_booking_events_type ON booking_events(event_type);
CREATE INDEX idx_booking_events_created_at ON booking_events(created_at DESC);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE mock_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_events ENABLE ROW LEVEL SECURITY;

-- Admin users can read all
CREATE POLICY "Admin read all" ON bookings
  FOR SELECT USING (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM admin_users
    )
  );

-- Service role can do everything (for sync workers)
CREATE POLICY "Service role full access" ON bookings
  FOR ALL USING (
    auth.role() = 'service_role'
  );
```

---

## API Design

### Read Operations (Postgres-First)

```javascript
// GET /api/bookings - Fast listing from Postgres
module.exports = async (req, res) => {
  const { exam_date, mock_type, status, limit = 50, offset = 0 } = req.query;

  let query = supabase
    .from('bookings')
    .select(`
      *,
      exam:mock_exams(*),
      contact:contacts(student_id, email, firstname, lastname)
    `)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (exam_date) {
    query = query.eq('exam.exam_date', exam_date);
  }

  if (mock_type) {
    query = query.eq('exam.mock_type', mock_type);
  }

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error, count } = await query;

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({
    success: true,
    data,
    pagination: {
      total: count,
      limit,
      offset,
      hasMore: offset + limit < count
    }
  });
};
```

### Write Operations (Dual-Write Pattern)

```javascript
// POST /api/bookings - Write to both systems
module.exports = async (req, res) => {
  const validatedData = await validateInput(req.body, 'bookingCreation');

  try {
    // STEP 1: Write to Supabase (fast, local)
    const { data: booking, error } = await supabase
      .from('bookings')
      .insert({
        booking_id: validatedData.booking_id,
        exam_id: validatedData.exam_id,
        contact_id: validatedData.contact_id,
        status: 'active',
        hubspot_synced: false
      })
      .select()
      .single();

    if (error) throw error;

    // STEP 2: Return immediately to user
    res.status(201).json({
      success: true,
      data: booking,
      message: 'Booking created successfully'
    });

    // STEP 3: Async sync to HubSpot (non-blocking)
    process.nextTick(async () => {
      try {
        const hubspotBooking = await hubspot.createBooking(booking);

        // Update with HubSpot ID
        await supabase.from('bookings').update({
          hubspot_id: hubspotBooking.id,
          hubspot_synced: true,
          hubspot_synced_at: new Date()
        }).eq('id', booking.id);

        console.log(`✅ Booking ${booking.id} synced to HubSpot: ${hubspotBooking.id}`);

      } catch (syncError) {
        console.error(`❌ Failed to sync to HubSpot:`, syncError);

        // Log for reconciliation
        await supabase.from('sync_errors').insert({
          entity_type: 'booking',
          entity_id: booking.id,
          direction: 'supabase_to_hubspot',
          error_message: syncError.message
        });
      }
    });

  } catch (error) {
    console.error('Booking creation error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
```

---

## Migration Strategy

### Phase 1: Setup (Week 1)
- [ ] Create Supabase project
- [ ] Set up database schema
- [ ] Configure RLS policies
- [ ] Set environment variables in Vercel

### Phase 2: Read-Only Sync (Week 2)
- [ ] Implement HubSpot → Supabase webhook
- [ ] Implement 5-minute polling fallback
- [ ] Migrate historical data (one-time batch)
- [ ] Update dashboard to read from Postgres

### Phase 3: Bidirectional Sync (Week 3-4)
- [ ] Implement Supabase → HubSpot event queue
- [ ] Add sync worker function
- [ ] Implement reconciliation cron
- [ ] Add monitoring and alerts

### Phase 4: Write Migration (Month 2)
- [ ] Migrate booking creation to Supabase-first
- [ ] Add conflict resolution logic
- [ ] Implement manual sync tools
- [ ] Production testing and validation

---

## Monitoring & Alerts

### Key Metrics to Track

```javascript
// Sync health dashboard
const syncMetrics = {
  webhook_success_rate: '98.5%',
  average_sync_lag: '3.2 seconds',
  pending_sync_queue: 12,
  sync_errors_last_hour: 2,
  reconciliation_drift: 0,
  hubspot_api_calls_saved: '87%'
};

// Alert thresholds
const alerts = {
  sync_lag_critical: 30, // seconds
  pending_queue_critical: 100,
  error_rate_warning: 0.05, // 5%
  reconciliation_drift_critical: 10 // records
};
```

### Supabase Dashboard Queries

```sql
-- Sync lag by entity type
SELECT
  table_name,
  AVG(EXTRACT(epoch FROM (NOW() - created_at))) as avg_lag_seconds,
  COUNT(*) FILTER (WHERE synced = false) as pending_count
FROM sync_queue
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY table_name;

-- Sync error rate
SELECT
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as total_errors,
  COUNT(DISTINCT entity_id) as affected_entities
FROM sync_errors
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;

-- Data drift detection
SELECT
  COUNT(*) as unsynced_bookings,
  MIN(created_at) as oldest_unsynced
FROM bookings
WHERE hubspot_synced = false
  AND created_at < NOW() - INTERVAL '10 minutes';
```

---

## Risk Mitigation

### Risk 1: Data Loss During Sync Failure
**Mitigation:**
- Retry queue with exponential backoff
- Dead letter queue for persistent failures
- Hourly reconciliation catches all gaps
- Manual sync tools for immediate fixes

### Risk 2: Data Drift Between Systems
**Mitigation:**
- HubSpot designated as source of truth for conflicts
- Reconciliation cron runs hourly
- Conflict resolution logs for audit
- Monitoring alerts for drift > 10 records

### Risk 3: Performance Degradation
**Mitigation:**
- Database indexes on all query patterns
- Materialized views for analytics
- Connection pooling (Supabase handles this)
- Read replicas for high-traffic queries (future)

### Risk 4: Increased Complexity
**Mitigation:**
- Comprehensive documentation
- Automated tests for sync logic
- Monitoring dashboard for visibility
- Gradual rollout with fallback to HubSpot

---

## Success Criteria

### Performance Targets
- ✅ Dashboard load time: < 500ms (from 3-8 seconds)
- ✅ Booking list load: < 300ms (from 2-5 seconds)
- ✅ Analytics queries: < 1 second
- ✅ HubSpot API calls: < 100/day (from ~1000/day)

### Reliability Targets
- ✅ Sync success rate: > 99%
- ✅ Average sync lag: < 10 seconds
- ✅ Maximum drift: < 5 records at any time
- ✅ System uptime: 99.9%

### Business Metrics
- ✅ Admin productivity: +50% (faster dashboards)
- ✅ Cost savings: -80% HubSpot API usage
- ✅ User experience: Real-time updates
- ✅ Analytics capability: Unlimited complex queries

---

## Open Questions

1. **HubSpot Webhook Reliability**
   - What's the actual delivery success rate?
   - How do we handle webhook endpoint downtime?
   - Should we use signature verification?

2. **Data Retention**
   - How long to keep sync error logs?
   - Should we archive old bookings to separate table?
   - What's the policy for deleted records?

3. **Real-Time Features**
   - Should we use Supabase Realtime for live updates?
   - What's the bandwidth cost for real-time subscriptions?
   - Which data needs real-time vs polling?

4. **Backup Strategy**
   - Daily Postgres backups sufficient?
   - Point-in-time recovery needed?
   - How to restore from HubSpot if Postgres fails?

5. **Multi-Tenancy**
   - Future: Multiple organizations using the system?
   - Does schema support multi-tenant architecture?
   - RLS policies scalable?

---

## Next Steps

1. **Review this PRD** with team
2. **Choose initial sync strategy** (recommend: Webhook + Polling)
3. **Create Supabase project** and configure
4. **Implement Phase 1** (read-only sync)
5. **Measure and iterate** based on metrics

---

## Appendix A: Sync Strategy Comparison Matrix

| Strategy | Latency | Reliability | Complexity | API Cost | Best For |
|----------|---------|-------------|------------|----------|----------|
| **Webhooks** | < 5s | 95% | Low | Low | Real-time critical |
| **Polling** | 1-5m | 100% | Low | High | Non-critical |
| **CDC Triggers** | < 10s | 100% | High | Low | Guaranteed sync |
| **Message Queue** | < 10s | 99% | High | Low | High volume |
| **Reconciliation** | 1h | 100% | Medium | High | Safety net |
| **Hybrid (All)** | < 5s | 99.9% | Very High | Low | Production |

---

## Appendix B: Cost Estimate

### Supabase Costs
- **Pro Plan**: $25/month
  - 8GB database
  - 50GB bandwidth
  - 2GB file storage
  - Daily backups

### Estimated Savings
- **HubSpot API Calls**: -87% = ~900 fewer calls/day
- **Vercel Function Executions**: +20% (sync workers)
- **Redis Storage**: +100MB (sync queue)

**Net Cost**: +$25/month, -$0 (HubSpot free tier)
**Performance Gain**: 10x faster, unlimited analytics

---

**End of PRD**

_This PRD will be updated as implementation progresses and new requirements emerge._
