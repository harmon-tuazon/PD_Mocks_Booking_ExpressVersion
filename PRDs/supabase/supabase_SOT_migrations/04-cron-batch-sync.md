# Hybrid Sync Architecture: Cron + Webhooks

## Overview

| Field | Value |
|-------|-------|
| **Phase** | Sprint 3-4 (Day 5-10) |
| **Prerequisites** | Schema migration, Backend API migration |
| **Related Docs** | [03-backend-api-migration.md](./03-backend-api-migration.md), [06-testing-rollback.md](./06-testing-rollback.md) |

---

## Three-Cron System Architecture

After migration, the system uses **THREE** cron jobs + **EDGE FUNCTION WEBHOOK** for hybrid sync:

| Sync Method | Direction | Schedule | Purpose | Status |
|-------------|-----------|----------|---------|--------|
| **activate-scheduled-exams** (Cron) | Supabase Read → HubSpot Write | 5am, 5pm daily | Business logic: Auto-activate scheduled exams | ✅ Existing |
| **sync-exams-backfill-bookings-from-hubspot** (Cron) | HubSpot → Supabase | **Every 1 hour** | Sync exams & backfill hubspot_ids (⚠️ NO booking properties or credits) | ✅ Modified |
| **sync-bookings-from-supabase** (Cron) | Supabase → HubSpot | **Every 15 minutes** | Create bookings in HubSpot with associations | ✅ Modified |
| **Edge Function: cascade-exam-updates** | Supabase → Supabase Bookings | Real-time | Cascade exam property changes to bookings | ✅ Implemented |
| **Credit Sync Webhook** | Supabase → HubSpot | Real-time | User credit sync after booking/cancel | ✅ Existing |
| **Admin Token Fire-and-Forget** | HubSpot → Supabase | Immediate | Admin credit updates sync immediately | ✅ Existing |

### Why Hybrid Sync (Cron + Webhooks)?

The hybrid architecture uses **different sync methods** for different data types:

```
┌─────────────────────────────────────────────────────────────────────┐
│                       HYBRID SYNC ARCHITECTURE                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  HUBSPOT → SUPABASE (sync-exams-backfill-bookings - Every 1 Hour)  │
│  ├─ Mock exams (admin creates/edits in HubSpot UI)                 │
│  ├─ Backfills missing hubspot_id via idempotency_key matching      │
│  └─ ⚠️ BOOKING PROPERTIES & CREDITS REMOVED                        │
│                                                                     │
│  SUPABASE → HUBSPOT (sync-bookings-from-supabase - Every 15 Mins)  │
│  ├─ Create new bookings in HubSpot (hubspot_id = NULL)             │
│  ├─ Create associations (contact + exam)                           │
│  └─ ⚠️ Does NOT update existing bookings (Edge Function handles)   │
│                                                                     │
│  SUPABASE EDGE FUNCTION (cascade-exam-updates - REAL-TIME)         │
│  ├─ Webhook triggered by admin exam property updates               │
│  ├─ Cascades changes to all associated bookings in Supabase        │
│  └─ < 1 second latency, batch updates                              │
│                                                                     │
│  SUPABASE → HUBSPOT (Credits via Webhook - REAL-TIME)              │
│  ├─ Credit deductions after booking creation                       │
│  ├─ Credit restorations after cancellation                         │
│  └─ Triggered immediately after RPC operations                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Why Webhooks for Credits?

| Reason | Explanation |
|--------|-------------|
| **Accuracy** | Credits must match immediately - 2-hour delay unacceptable |
| **Real-time validation** | Next booking operation must see correct credit balance |
| **Existing pattern** | Already using webhooks for `total_bookings` sync |
| **Reliability** | Fire-and-forget with retry logic (similar to total_bookings) |

### Why Cron for Bookings?

| Reason | Explanation |
|--------|-------------|
| **Audit purpose** | Bookings are for reporting/audit - 2-hour delay acceptable |
| **Batch efficiency** | HubSpot batch API handles 100 bookings/request |
| **Reduced API calls** | Batch operations reduce HubSpot rate limit impact |

### 🚨 Why Credits Removed from HubSpot → Supabase Cron?

**CRITICAL DECISION**: Credits are **NOT** synced via the HubSpot → Supabase cron to prevent drift and race conditions.

| Issue | Explanation |
|-------|-------------|
| **Triple Sync Redundancy** | Credits already synced via: (1) Admin fire-and-forget (immediate), (2) User webhook (< 1s), (3) Cron would be redundant |
| **Race Condition** | User books at 01:59:50 (Supabase: 5→4, webhook triggers). Cron runs at 02:00:00, reads HubSpot before webhook processes (still 5), overwrites Supabase (4→5) ❌ |
| **Bidirectional Conflict** | User ops: Supabase → HubSpot (webhook). Admin ops: HubSpot → Supabase (fire-and-forget). Cron: HubSpot → Supabase creates last-write-wins conflict |
| **Admin Updates Covered** | Admin token updates already use fire-and-forget sync ([tokens.js:96-98](../../../admin_root/api/admin/trainees/[contactId]/tokens.js#L96-L98)) |
| **Prevents Data Drift** | Cron overwriting user operations would allow double-bookings and credit mismatches |

**Architecture Decision**: Credits use **unidirectional sync** based on operation source:
- **User Operations** (bookings/cancellations): Supabase → HubSpot (webhook, real-time)
- **Admin Operations** (token updates): HubSpot → Supabase (fire-and-forget, immediate)
- **Cron**: Exams & bookings only (NO credits)

---

## Data Flow Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                    HYBRID SYNC: CRON + WEBHOOKS                            │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌─────────────────────────────────────────────────────────────┐          │
│  │ BOOKING CREATION (Cron - Every 2 Hours)                     │          │
│  │                                                             │          │
│  │ a) SELECT * FROM hubspot_bookings WHERE hubspot_id IS NULL; │          │
│  │ b) For each new booking:                                    │          │
│  │    - Create in HubSpot → Get hubspot_id                     │          │
│  │    - Create associations (contact, mock_exam)               │          │
│  │ c) Batch update existing bookings (status changes)          │          │
│  │ d) UPDATE hubspot_id, hubspot_last_sync_at for all          │          │
│  └─────────────────────────────────────────────────────────────┘          │
│                                                                            │
│  ┌─────────────────────────────────────────────────────────────┐          │
│  │ CREDIT SYNC (Webhook - Real-time)                           │          │
│  │                                                             │          │
│  │ Triggered by:                                               │          │
│  │   • create_booking_atomic() → syncContactCredits()          │          │
│  │   • cancel_booking_atomic() → syncContactCredits()          │          │
│  │                                                             │          │
│  │ Webhook payload:                                            │          │
│  │   {                                                         │          │
│  │     contact_id: "123456",                                   │          │
│  │     sj_credits: 4,                                          │          │
│  │     cs_credits: 2,                                          │          │
│  │     sjmini_credits: 0,                                      │          │
│  │     mock_discussion_token: 1,                               │          │
│  │     shared_mock_credits: 0                                  │          │
│  │   }                                                         │          │
│  │                                                             │          │
│  │ HubSpot Workflow: Update contact properties                │          │
│  └─────────────────────────────────────────────────────────────┘          │
│                                                                            │
│  ═══════════════════════════════════════════════════════════════          │
│   BENEFITS OF HYBRID SYNC:                                                │
│   • Credits sync in real-time (< 1 second)                                │
│   • Bookings batch for efficiency (2-hour delay acceptable)               │
│   • Reduced HubSpot API calls via batching                                │
│   • Proven webhook pattern (total_bookings already uses this)             │
│  ═══════════════════════════════════════════════════════════════          │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Vercel Cron Configuration

**File: `admin_root/vercel.json`**

The complete cron configuration includes all three jobs (webhooks and Edge Functions configured separately):

```json
{
  "crons": [
    {
      "path": "/api/admin/cron/activate-scheduled-exams",
      "schedule": "0 5,17 * * *"
    },
    {
      "path": "/api/admin/cron/sync-bookings-from-supabase",
      "schedule": "*/15 * * * *"
    },
    {
      "path": "/api/admin/cron/sync-exams-backfill-bookings-from-hubspot",
      "schedule": "0 * * * *"
    }
  ]
}
```

### Schedule Details

| Cron Job | Schedule | Runs At | Frequency |
|----------|----------|---------|-----------|
| `activate-scheduled-exams` | `0 5,17 * * *` | 5:00 AM, 5:00 PM | Twice daily |
| `sync-bookings-from-supabase` | `*/15 * * * *` | Every 15 minutes | 96 times/day |
| `sync-exams-backfill-bookings-from-hubspot` | `0 * * * *` | 00:00, 01:00, 02:00, 03:00... | Every hour (24 times/day) |

**Note**:
- Credit sync webhooks are triggered in real-time, not on a schedule
- Edge Function `cascade-exam-updates` is triggered via webhook from admin API endpoints (< 1s)

---

## Webhook Implementation

**File: `admin_root/api/_shared/hubspot-webhook.js`**

Add new method to existing `HubSpotWebhookService` class:

```javascript
const { createClient } = require('@supabase/supabase-js');

// Webhook URLs (configured in Vercel env vars)
const BOOKING_COUNT_WEBHOOK_URL = process.env.HUBSPOT_BOOKING_COUNT_WEBHOOK_URL;
const CREDIT_SYNC_WEBHOOK_URL = process.env.HUBSPOT_CREDIT_SYNC_WEBHOOK_URL; // NEW

class HubSpotWebhookService {
  /**
   * Existing method - Sync total_bookings count to HubSpot
   */
  static async syncTotalBookings(mockExamId, totalBookings) {
    try {
      const payload = {
        mock_exam_id: mockExamId,
        total_bookings: parseInt(totalBookings),
      };

      const response = await fetch(BOOKING_COUNT_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.statusText}`);
      }

      return {
        success: true,
        message: `Successfully synced total_bookings=${totalBookings} for exam ${mockExamId}`
      };
    } catch (error) {
      console.error('[WEBHOOK] Failed to sync total_bookings:', error.message);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * NEW METHOD - Sync contact credits to HubSpot in real-time
   * @param {string} contactHubSpotId - HubSpot contact ID
   * @param {object} credits - Credit values { sj_credits, cs_credits, etc. }
   */
  static async syncContactCredits(contactHubSpotId, credits) {
    try {
      const payload = {
        contact_id: contactHubSpotId,
        sj_credits: parseInt(credits.sj_credits || 0),
        cs_credits: parseInt(credits.cs_credits || 0),
        sjmini_credits: parseInt(credits.sjmini_credits || 0),
        mock_discussion_token: parseInt(credits.mock_discussion_token || 0),
        shared_mock_credits: parseInt(credits.shared_mock_credits || 0)
      };

      console.log('[WEBHOOK] Syncing credits to HubSpot:', payload);

      const response = await fetch(CREDIT_SYNC_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.statusText}`);
      }

      return {
        success: true,
        message: `Successfully synced credits for contact ${contactHubSpotId}`
      };
    } catch (error) {
      console.error('[WEBHOOK] Failed to sync credits:', error.message);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * Sync with retry logic (3 attempts with exponential backoff)
   */
  static async syncWithRetry(type, ...args) {
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      let result;

      if (type === 'totalBookings') {
        result = await this.syncTotalBookings(...args);
      } else if (type === 'contactCredits') {
        result = await this.syncContactCredits(...args);
      } else {
        throw new Error(`Unknown sync type: ${type}`);
      }

      if (result.success) {
        return result;
      }

      if (attempt < maxRetries) {
        const delay = attempt * 1000; // 1s, 2s, 3s
        console.log(`[WEBHOOK] Retry ${attempt}/${maxRetries} after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    return {
      success: false,
      message: `Failed after ${maxRetries} attempts`
    };
  }
}

module.exports = HubSpotWebhookService;
```

---

## API Integration (Webhook Triggers)

### Booking Creation API

**File: `admin_root/api/admin/bookings/create.js`**

```javascript
const HubSpotWebhookService = require('../../_shared/hubspot-webhook');

module.exports = async (req, res) => {
  try {
    // ... existing booking creation logic using RPC ...

    // Call Supabase RPC to create booking atomically
    const { data, error } = await supabaseAdmin.rpc('create_booking_atomic', {
      p_booking_id: bookingId,
      p_student_id: student_id,
      p_student_email: student_email,
      // ... other params
    });

    if (error) throw error;

    // 🆕 WEBHOOK: Sync credits to HubSpot immediately (fire-and-forget)
    if (data.contact_hubspot_id) {
      HubSpotWebhookService.syncWithRetry(
        'contactCredits',
        data.contact_hubspot_id,
        {
          sj_credits: data.new_sj_credits,
          cs_credits: data.new_cs_credits,
          sjmini_credits: data.new_sjmini_credits,
          mock_discussion_token: data.new_mock_discussion_token,
          shared_mock_credits: data.new_shared_mock_credits
        }
      ).catch(err => {
        console.error('[BOOKING CREATE] Credit sync webhook failed:', err.message);
        // Continue - cron will eventually reconcile
      });
    }

    // Existing total_bookings webhook (unchanged)
    const newCount = parseInt(await redis.get(`exam:${mockExamId}:bookings`)) || 0;
    HubSpotWebhookService.syncWithRetry('totalBookings', mockExamId, newCount)
      .catch(err => console.error('[BOOKING CREATE] Count webhook failed:', err.message));

    return res.status(201).json({
      success: true,
      booking: data
    });

  } catch (error) {
    // ... error handling
  }
};
```

### Booking Cancellation API

**File: `admin_root/api/bookings/batch-cancel.js`**

```javascript
const HubSpotWebhookService = require('../_shared/hubspot-webhook');

module.exports = async (req, res) => {
  try {
    // ... existing batch cancel logic ...

    for (const bookingId of bookingIds) {
      // Call Supabase RPC to cancel booking atomically
      const { data, error } = await supabaseAdmin.rpc('cancel_booking_atomic', {
        p_booking_id: bookingId,
        p_restore_credits: true
      });

      if (error) throw error;

      // 🆕 WEBHOOK: Sync restored credits to HubSpot immediately
      if (data.contact_hubspot_id) {
        HubSpotWebhookService.syncWithRetry(
          'contactCredits',
          data.contact_hubspot_id,
          {
            sj_credits: data.restored_sj_credits,
            cs_credits: data.restored_cs_credits,
            sjmini_credits: data.restored_sjmini_credits,
            mock_discussion_token: data.restored_mock_discussion_token,
            shared_mock_credits: data.restored_shared_mock_credits
          }
        ).catch(err => {
          console.error('[BATCH CANCEL] Credit sync webhook failed:', err.message);
        });
      }

      // Existing total_bookings webhook (unchanged)
      const newCount = parseInt(await redis.get(`exam:${mockExamId}:bookings`)) || 0;
      HubSpotWebhookService.syncWithRetry('totalBookings', mockExamId, newCount)
        .catch(err => console.error('[BATCH CANCEL] Count webhook failed:', err.message));
    }

    return res.status(200).json({ success: true, cancelled: bookingIds.length });

  } catch (error) {
    // ... error handling
  }
};
```

---

## Cron Job Implementation (Bookings Only)

**File: `admin_root/api/admin/cron/batch-sync-hubspot.js`**

```javascript
const { createClient } = require('@supabase/supabase-js');
const hubspot = require('../../_shared/hubspot');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// HubSpot object type IDs
const OBJECT_TYPES = {
  CONTACTS: '0-1',
  BOOKINGS: '2-50158943',
  MOCK_EXAMS: '2-50158913'
};

/**
 * Simplified batch sync cron job - BOOKINGS ONLY
 * Credits are synced via webhooks in real-time
 * Runs every 2 hours
 */
module.exports = async (req, res) => {
  // Verify cron secret
  if (req.headers['x-vercel-cron'] !== 'true' &&
      req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const startTime = Date.now();
  const summary = {
    bookings: { created: 0, updated: 0, failed: 0 }
  };

  try {
    console.log('[BATCH SYNC] Starting batch sync to HubSpot (bookings only)...');

    // Sync bookings only (credits handled by webhooks)
    await syncBookings(summary);

    const duration = Date.now() - startTime;
    console.log('[BATCH SYNC] Completed in', duration, 'ms');
    console.log('[BATCH SYNC] Summary:', summary);

    return res.status(200).json({
      success: true,
      duration: `${duration}ms`,
      summary
    });

  } catch (error) {
    console.error('[BATCH SYNC] Failed:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      summary
    });
  }
};

/**
 * Sync all bookings to HubSpot
 */
async function syncBookings(summary) {
  console.log('[BATCH SYNC] Syncing bookings...');

  // Get bookings without hubspot_id (new bookings)
  const { data: newBookings, error: newError } = await supabase
    .from('hubspot_bookings')
    .select('*')
    .is('hubspot_id', null);

  if (newError) throw newError;

  // Create new bookings in HubSpot
  for (const booking of newBookings || []) {
    try {
      const hubspotBooking = await hubspot.createBooking({
        booking_id: booking.booking_id,
        student_id: booking.student_id,
        student_name: booking.student_name,
        student_email: booking.student_email,
        mock_exam_id: booking.mock_exam_id,
        is_active: booking.is_active,
        token_used: booking.token_used,
        attending_location: booking.attending_location,
        dominant_hand: booking.dominant_hand,
        exam_date: booking.exam_date,
        idempotency_key: booking.idempotency_key
      });

      // Create associations
      if (booking.contact_id) {
        await hubspot.createAssociation(
          OBJECT_TYPES.BOOKINGS,
          hubspotBooking.id,
          OBJECT_TYPES.CONTACTS,
          booking.contact_id
        );
      }

      await hubspot.createAssociation(
        OBJECT_TYPES.BOOKINGS,
        hubspotBooking.id,
        OBJECT_TYPES.MOCK_EXAMS,
        booking.mock_exam_id
      );

      // Update Supabase with hubspot_id
      await supabase
        .from('hubspot_bookings')
        .update({
          hubspot_id: hubspotBooking.id,
          hubspot_last_sync_at: new Date().toISOString()
        })
        .eq('id', booking.id);

      summary.bookings.created++;
    } catch (err) {
      console.error('[BATCH SYNC] Failed to create booking:', booking.id, err.message);
      summary.bookings.failed++;
    }
  }

  // Get existing bookings that were updated
  const { data: existingBookings, error: existError } = await supabase
    .from('hubspot_bookings')
    .select('*')
    .not('hubspot_id', 'is', null)
    .or(`updated_at.gt.hubspot_last_sync_at,hubspot_last_sync_at.is.null`);

  if (existError) throw existError;

  // Batch update existing bookings
  if (existingBookings && existingBookings.length > 0) {
    const batches = chunkArray(existingBookings, 100);

    for (const batch of batches) {
      try {
        await hubspot.batchUpdateBookings(batch.map(b => ({
          id: b.hubspot_id,
          properties: {
            is_active: b.is_active,
            attendance: b.attendance
          }
        })));

        // Update hubspot_last_sync_at
        const ids = batch.map(b => b.id);
        await supabase
          .from('hubspot_bookings')
          .update({ hubspot_last_sync_at: new Date().toISOString() })
          .in('id', ids);

        summary.bookings.updated += batch.length;
      } catch (err) {
        console.error('[BATCH SYNC] Failed to update booking batch:', err.message);
        summary.bookings.failed += batch.length;
      }
    }
  }

  console.log('[BATCH SYNC] Bookings synced:', summary.bookings);
}

/**
 * Split array into chunks
 */
function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
```

---

## HubSpot Workflow Configuration

### Workflow 1: Total Bookings Sync (Existing)

**Purpose**: Update mock_exams.total_bookings when triggered by API

**Trigger**: Webhook receives POST request
**Action**: Update Custom Object (Mock Exams)

```
Webhook Payload:
{
  "mock_exam_id": "123456",
  "total_bookings": 25
}

HubSpot Action:
- Find Mock Exam by mock_exam_id
- Update property: total_bookings = {{ total_bookings }}
```

### Workflow 2: Credit Sync (NEW)

**Purpose**: Update contact credits when triggered by booking/cancellation

**Trigger**: Webhook receives POST request
**Action**: Update Contact Properties

```
Webhook Payload:
{
  "contact_id": "789012",
  "sj_credits": 4,
  "cs_credits": 2,
  "sjmini_credits": 0,
  "mock_discussion_token": 1,
  "shared_mock_credits": 0
}

HubSpot Action:
- Find Contact by contact_id
- Update properties:
  - sj_credits = {{ sj_credits }}
  - cs_credits = {{ cs_credits }}
  - sjmini_credits = {{ sjmini_credits }}
  - mock_discussion_token = {{ mock_discussion_token }}
  - shared_mock_credits = {{ shared_mock_credits }}
```

**HubSpot Workflow URL**: Copy URL after creation and set as `HUBSPOT_CREDIT_SYNC_WEBHOOK_URL` in Vercel env vars

---

## Monitoring Queries

```sql
-- Records awaiting HubSpot ID (batch sync targets)
SELECT
  'bookings' as table_name,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE hubspot_id IS NULL) as awaiting_hubspot_id,
  MAX(created_at) FILTER (WHERE hubspot_id IS NULL) as oldest_pending
FROM hubspot_sync.hubspot_bookings;

-- Last sync timestamps for bookings
SELECT
  'bookings' as table_name,
  MAX(hubspot_last_sync_at) as last_sync,
  COUNT(*) FILTER (WHERE hubspot_last_sync_at > NOW() - INTERVAL '2 hours') as synced_recently
FROM hubspot_sync.hubspot_bookings;

-- Credit sync via webhook (check audit log)
SELECT
  'credit_updates_via_webhook' as operation,
  COUNT(*) as total_operations,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') as last_hour
FROM hubspot_sync.supabase_audit_log
WHERE operation_type IN ('booking_created', 'booking_cancelled');
```

---

## Manual Trigger

### Cron Job (Bookings)
```bash
curl -X POST https://your-domain.com/api/admin/cron/batch-sync-hubspot \
  -H "Authorization: Bearer $CRON_SECRET"
```

### Webhook Test (Credits)
```bash
# Test credit sync webhook
curl -X POST $HUBSPOT_CREDIT_SYNC_WEBHOOK_URL \
  -H "Content-Type: application/json" \
  -d '{
    "contact_id": "123456",
    "sj_credits": 5,
    "cs_credits": 3,
    "sjmini_credits": 0,
    "mock_discussion_token": 1,
    "shared_mock_credits": 0
  }'
```

---

## Error Recovery

### Cron Job Failures (Bookings)
1. Failed records are NOT marked as synced
2. Next cron run (in 2 hours) will retry them automatically
3. Check Vercel logs for specific errors
4. Use manual trigger if immediate sync is needed

### Webhook Failures (Credits)
1. Webhook retries 3 times with exponential backoff (1s, 2s, 3s)
2. If all retries fail, operation continues (fire-and-forget)
3. Cron `sync-supabase` (HubSpot → Supabase) will eventually reconcile
4. Manual reconciliation available via admin dashboard

---

## Architecture Comparison

### Before (Full Batch Sync)

```
CRON JOB (Every 2 hours):
├─ Sync contacts (all credit fields)
├─ Sync bookings (new + updated)
└─ Sync mock exams (total_bookings)

Problems:
• Credit updates delayed by up to 2 hours
• Risk of credit mismatch during high-traffic periods
• Users could double-book if credits not updated
```

### After (Hybrid: Cron + Webhooks)

```
WEBHOOK (Real-time):
├─ Sync credits immediately after booking/cancel
└─ < 1 second latency

CRON JOB (Every 2 hours):
├─ Sync bookings only (audit trail)
└─ 2-hour delay acceptable

Benefits:
✅ Credit accuracy guaranteed in real-time
✅ Reduced cron complexity (bookings only)
✅ Proven webhook pattern (total_bookings already works)
✅ Better separation of concerns
```

---

## Timeline: Hybrid Sync in Action

```
Time    | User Action              | Webhook (Credits)      | Cron (Bookings)
--------|--------------------------|------------------------|------------------
00:00   | User books exam          | ✅ Credit sync < 1s    | [Waits for cron]
00:01   | User cancels booking     | ✅ Credit restore < 1s | [Waits for cron]
02:00   | [Cron runs]              | -                      | ✅ 2 bookings synced
04:00   | User books exam          | ✅ Credit sync < 1s    | [Waits for cron]
04:00   | [Cron runs]              | -                      | ✅ 1 booking synced
06:00   | User cancels booking     | ✅ Credit restore < 1s | [Waits for cron]
06:00   | [Cron runs]              | -                      | ✅ 1 cancellation synced
```

**Key Insight**: Credits sync immediately via webhook, bookings sync every 2 hours via cron. This hybrid approach provides real-time accuracy where needed (credits) while maintaining efficiency for audit data (bookings).

---

## Required Changes to sync-supabase Cron

### File: `admin_root/api/_shared/supabaseSync.optimized.js`

**Current Behavior** (lines 624-665):
- Syncs contact credits from HubSpot → Supabase every 2 hours
- Uses incremental sync with `hs_lastmodifieddate` filter

**Required Change**:
Remove or comment out Step 4 (contact credits sync):

```javascript
// Step 4: Fetch and sync MODIFIED contact credits since last sync
// ⚠️ REMOVED: Credits now synced via:
//   - User operations: Real-time webhook (< 1s) - Supabase → HubSpot
//   - Admin operations: Fire-and-forget sync (tokens.js:96-98) - HubSpot → Supabase
//
// Removing this prevents race conditions where cron overwrites user operations:
// Example: User books at 01:59:50 (credits: 5→4, webhook triggers)
//          Cron runs at 02:00:00, reads HubSpot before webhook processes (still 5)
//          Cron overwrites Supabase (4→5) ❌ - allows double-booking
//
// console.log('🔄 Starting incremental contact credits sync...');
// try {
//   const contacts = await fetchModifiedContactsWithCredits(lastContactSync);
//   // ... sync logic removed
// } catch (error) {
//   console.error(`❌ Failed to sync contact credits: ${error.message}`);
// }
```

**Updated Summary Response**:
```javascript
return {
  success: true,
  summary: {
    sync_mode: lastExamSync ? 'incremental' : 'full',
    exams_synced: totalExams,
    bookings_synced: totalBookings,
    // contact_credits_synced: totalContactCredits, // REMOVED
    errors_count: errors.length,
    duration_seconds: duration,
    completed_at: new Date().toISOString(),
    note: 'Credits synced via webhook/fire-and-forget only'
  },
  errors: errors.length > 0 ? errors : undefined
};
```

### File: `admin_root/api/admin/cron/sync-supabase.js`

**Update Documentation** (lines 3-6):
```javascript
/**
 * GET /api/admin/cron/sync-supabase
 * Vercel Cron Job - Sync mock exams and bookings from HubSpot to Supabase
 * ⚠️ NOTE: Contact credits are NOT synced via cron (see hybrid sync architecture)
 *
 * Schedule: Runs every 2 hours (0 */2 * * *) - configured in vercel.json
 * Purpose: Keeps Supabase exams & bookings synchronized with HubSpot data
 *
 * Credits Sync:
 *   - User operations: Real-time webhook (< 1s) after booking/cancel
 *   - Admin operations: Fire-and-forget sync after token updates
 *
 * Security: Requires CRON_SECRET from Vercel (set in environment variables)
 */
```

---

## Sprint 3-4 Checklist

### Sprint 3: Development
- [ ] Add `syncContactCredits()` method to `HubSpotWebhookService`
- [ ] Create HubSpot workflow for credit sync webhook
- [ ] Get webhook URL and set `HUBSPOT_CREDIT_SYNC_WEBHOOK_URL` env var
- [ ] Update booking creation API to trigger credit webhook
- [ ] Update cancellation API to trigger credit webhook
- [ ] Simplify `batch-sync-hubspot.js` to bookings only
- [ ] **Remove contact credits sync from `sync-supabase` cron** (see below)
- [ ] Test webhook with manual POST requests
- [ ] Test cron job with manual trigger

### Sprint 4: Deployment & Monitoring
- [ ] Deploy to staging and verify webhooks fire
- [ ] Deploy to production
- [ ] Monitor first few webhook triggers (check HubSpot workflow history)
- [ ] Monitor first few cron runs (check Vercel logs)
- [ ] Set up alerting for webhook failures
- [ ] Create admin dashboard showing credit sync status
- [ ] Document runbooks for webhook troubleshooting

---

## Architecture Summary

### The Complete Hybrid Picture

```
┌─────────────────────────────────────────────────────────────────────┐
│                   HYBRID SYNC SYSTEM OVERVIEW                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  CRON 1: activate-scheduled-exams (5am, 5pm)                        │
│  Purpose: Business logic - activate scheduled exams                 │
│  Flow: Supabase Read → HubSpot Write → Supabase Sync               │
│                                                                     │
│  CRON 2: sync-supabase (every 2 hours)                             │
│  Purpose: Sync exams & bookings from HubSpot                        │
│  Flow: HubSpot → Supabase                                           │
│  Syncs:                                                             │
│    • Mock exams (admin creates in HubSpot)                          │
│    • Bookings (attendance updates)                                  │
│    • ⚠️ CREDITS REMOVED - prevents race conditions                  │
│                                                                     │
│  CRON 3: batch-sync-hubspot (every 2 hours)                        │
│  Purpose: Push bookings to HubSpot for audit trail                 │
│  Flow: Supabase → HubSpot                                           │
│  Syncs:                                                             │
│    • User booking creations (hubspot_id = NULL)                     │
│    • Booking status updates                                         │
│                                                                     │
│  WEBHOOK: User Credit Sync (real-time)                             │
│  Purpose: Immediate credit accuracy after booking/cancel           │
│  Flow: Supabase → HubSpot (< 1 second)                             │
│  Syncs:                                                             │
│    • Credit deductions after booking                                │
│    • Credit restorations after cancellation                         │
│    • Triggered by RPC functions                                     │
│                                                                     │
│  FIRE-AND-FORGET: Admin Credit Sync (immediate)                    │
│  Purpose: Admin token updates sync immediately                     │
│  Flow: HubSpot → Supabase (< 1 second)                             │
│  Syncs:                                                             │
│    • Admin token adjustments via admin app                          │
│    • Triggered after HubSpot update (tokens.js:96-98)              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Benefits of Hybrid Architecture

| Benefit | Description |
|---------|-------------|
| **Real-time Credit Accuracy** | Credits sync < 1s via webhook (vs 2-hour cron delay) |
| **Proven Pattern** | Reuses existing total_bookings webhook architecture |
| **Efficient Batching** | Bookings use HubSpot batch API (100 records/request) |
| **Separation of Concerns** | Real-time data (credits) vs audit data (bookings) |
| **Simple Error Recovery** | Webhook retries + cron fallback ensures consistency |
| **Reduced API Calls** | Batch bookings reduce HubSpot rate limit impact |

### Performance Comparison

| Operation | Before (Full Cron) | After (Hybrid) | Improvement |
|-----------|-------------------|----------------|-------------|
| Credit Deduction Sync | Up to 2 hours | < 1 second | **7,200x faster** |
| Credit Restoration Sync | Up to 2 hours | < 1 second | **7,200x faster** |
| Booking Creation Sync | Up to 2 hours | Up to 2 hours | Same (acceptable) |
| HubSpot API Calls | Many individual | Batched (100/req) | 100x reduction |

---

*Previous: [03-backend-api-migration.md](./03-backend-api-migration.md)*
*Next: [05-frontend-changes.md](./05-frontend-changes.md)*