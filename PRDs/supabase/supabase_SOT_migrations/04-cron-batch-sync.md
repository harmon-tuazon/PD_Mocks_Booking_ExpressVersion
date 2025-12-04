# Cron Batch Sync to HubSpot

## Overview

| Field | Value |
|-------|-------|
| **Phase** | Sprint 3-4 (Day 5-10) |
| **Prerequisites** | Schema migration, Backend API migration |
| **Related Docs** | [03-backend-api-migration.md](./03-backend-api-migration.md), [06-testing-rollback.md](./06-testing-rollback.md) |

---

## Batch Sync Strategy

**DECISION: Full dataset batch sync every 2 hours (no per-record tracking)**

### Why Batch Sync?
- Simpler architecture (no per-record status tracking)
- More reliable (no partial sync states)
- Handles high-frequency data changes
- HubSpot batch API reduces rate limit impact

### What Gets Synced
1. **Contact Credits** - All credit field values
2. **Bookings** - Status changes, new bookings (get hubspot_id)
3. **Mock Exams** - total_bookings counts

---

## Data Flow Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                    HUBSPOT BATCH SYNC CRON (Every 2 Hours)                 │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  Triggered by: Vercel Cron (every 2 hours)                                 │
│  Strategy: Full dataset batch sync (no per-record tracking)                │
│                                                                            │
│  ┌─────────────────────────────────────────────────────────────┐          │
│  │ STEP 1: SYNC CONTACTS TO HUBSPOT                            │          │
│  │                                                             │          │
│  │ a) SELECT * FROM hubspot_contact_credits;                   │          │
│  │ b) For each contact:                                        │          │
│  │    - If hubspot_id IS NULL: Create in HubSpot               │          │
│  │    - If hubspot_id exists: Batch update credits             │          │
│  │ c) Use HubSpot batch API (100 records/request)              │          │
│  │ d) UPDATE hubspot_last_sync_at = NOW() for all records      │          │
│  └─────────────────────────────────────────────────────────────┘          │
│     │                                                                      │
│     ▼                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐          │
│  │ STEP 2: SYNC BOOKINGS TO HUBSPOT                            │          │
│  │                                                             │          │
│  │ a) SELECT * FROM hubspot_bookings WHERE hubspot_id IS NULL; │          │
│  │ b) For each new booking:                                    │          │
│  │    - Create in HubSpot → Get hubspot_id                     │          │
│  │    - Create associations (contact, mock_exam)               │          │
│  │ c) Batch update existing bookings (status changes)          │          │
│  │ d) UPDATE hubspot_id, hubspot_last_sync_at for all          │          │
│  └─────────────────────────────────────────────────────────────┘          │
│     │                                                                      │
│     ▼                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐          │
│  │ STEP 3: SYNC MOCK EXAMS TO HUBSPOT                          │          │
│  │                                                             │          │
│  │ a) SELECT * FROM hubspot_mock_exams;                        │          │
│  │ b) Batch update total_bookings counts in HubSpot            │          │
│  │ c) UPDATE hubspot_last_sync_at = NOW() for all records      │          │
│  └─────────────────────────────────────────────────────────────┘          │
│     │                                                                      │
│     ▼                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐          │
│  │ STEP 4: MARK AUDIT LOG AS SYNCED                            │          │
│  │                                                             │          │
│  │ UPDATE supabase_audit_log                                   │          │
│  │ SET synced_to_hubspot_at = NOW()                            │          │
│  │ WHERE synced_to_hubspot_at IS NULL;                         │          │
│  └─────────────────────────────────────────────────────────────┘          │
│     │                                                                      │
│     ▼                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐          │
│  │ ERROR HANDLING                                              │          │
│  │                                                             │          │
│  │ • Log errors to console (for Vercel logs)                   │          │
│  │ • Continue with remaining records on individual failures    │          │
│  │ • Report summary: X created, Y updated, Z failed            │          │
│  │ • Failed records will be retried in next cron run           │          │
│  └─────────────────────────────────────────────────────────────┘          │
│                                                                            │
│  ═══════════════════════════════════════════════════════════════          │
│   BENEFITS OF BATCH SYNC:                                                 │
│   • Simpler architecture (no per-record status tracking)                  │
│   • More reliable (no partial sync states)                                │
│   • Handles high-frequency data changes                                   │
│   • HubSpot batch API reduces rate limit impact                           │
│  ═══════════════════════════════════════════════════════════════          │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Vercel Cron Configuration

**File: `vercel.json`**

```json
{
  "crons": [
    {
      "path": "/api/admin/cron/batch-sync-hubspot",
      "schedule": "0 */2 * * *"
    }
  ]
}
```

This runs at minute 0 of every 2nd hour (00:00, 02:00, 04:00, etc.)

---

## Cron Job Implementation

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
 * Batch sync cron job - runs every 2 hours
 * Syncs all Supabase records to HubSpot
 */
module.exports = async (req, res) => {
  // Verify cron secret
  if (req.headers['x-vercel-cron'] !== 'true' &&
      req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const startTime = Date.now();
  const summary = {
    contacts: { created: 0, updated: 0, failed: 0 },
    bookings: { created: 0, updated: 0, failed: 0 },
    mockExams: { updated: 0, failed: 0 }
  };

  try {
    console.log('[BATCH SYNC] Starting batch sync to HubSpot...');

    // Step 1: Sync contacts
    await syncContacts(summary);

    // Step 2: Sync bookings
    await syncBookings(summary);

    // Step 3: Sync mock exams
    await syncMockExams(summary);

    // Step 4: Mark audit log as synced
    await markAuditLogSynced();

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
 * Sync all contacts to HubSpot
 */
async function syncContacts(summary) {
  console.log('[BATCH SYNC] Syncing contacts...');

  // Get all contacts from Supabase
  const { data: contacts, error } = await supabase
    .from('hubspot_contact_credits')
    .select('*');

  if (error) throw error;
  if (!contacts || contacts.length === 0) return;

  // Separate new contacts (no hubspot_id) from existing
  const newContacts = contacts.filter(c => !c.hubspot_id);
  const existingContacts = contacts.filter(c => c.hubspot_id);

  // Create new contacts in HubSpot
  for (const contact of newContacts) {
    try {
      const hubspotContact = await hubspot.createContact({
        student_id: contact.student_id,
        email: contact.email,
        firstname: contact.firstname,
        lastname: contact.lastname,
        sj_credits: contact.sj_credits,
        cs_credits: contact.cs_credits,
        sjmini_credits: contact.sjmini_credits,
        mock_discussion_token: contact.mock_discussion_token,
        shared_mock_credits: contact.shared_mock_credits
      });

      // Update Supabase with hubspot_id
      await supabase
        .from('hubspot_contact_credits')
        .update({
          hubspot_id: hubspotContact.id,
          hubspot_last_sync_at: new Date().toISOString()
        })
        .eq('id', contact.id);

      summary.contacts.created++;
    } catch (err) {
      console.error('[BATCH SYNC] Failed to create contact:', contact.id, err.message);
      summary.contacts.failed++;
    }
  }

  // Batch update existing contacts
  if (existingContacts.length > 0) {
    const batches = chunkArray(existingContacts, 100);

    for (const batch of batches) {
      try {
        await hubspot.batchUpdateContacts(batch.map(c => ({
          id: c.hubspot_id,
          properties: {
            sj_credits: String(c.sj_credits || 0),
            cs_credits: String(c.cs_credits || 0),
            sjmini_credits: String(c.sjmini_credits || 0),
            mock_discussion_token: String(c.mock_discussion_token || 0),
            shared_mock_credits: String(c.shared_mock_credits || 0)
          }
        })));

        // Update hubspot_last_sync_at
        const ids = batch.map(c => c.id);
        await supabase
          .from('hubspot_contact_credits')
          .update({ hubspot_last_sync_at: new Date().toISOString() })
          .in('id', ids);

        summary.contacts.updated += batch.length;
      } catch (err) {
        console.error('[BATCH SYNC] Failed to update contact batch:', err.message);
        summary.contacts.failed += batch.length;
      }
    }
  }

  console.log('[BATCH SYNC] Contacts synced:', summary.contacts);
}

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
 * Sync mock exam counts to HubSpot
 */
async function syncMockExams(summary) {
  console.log('[BATCH SYNC] Syncing mock exams...');

  const { data: exams, error } = await supabase
    .from('hubspot_mock_exams')
    .select('*');

  if (error) throw error;
  if (!exams || exams.length === 0) return;

  const batches = chunkArray(exams, 100);

  for (const batch of batches) {
    try {
      await hubspot.batchUpdateMockExams(batch.map(e => ({
        id: e.hubspot_id,
        properties: {
          total_bookings: String(e.total_bookings || 0)
        }
      })));

      // Update hubspot_last_sync_at
      const ids = batch.map(e => e.id);
      await supabase
        .from('hubspot_mock_exams')
        .update({ hubspot_last_sync_at: new Date().toISOString() })
        .in('id', ids);

      summary.mockExams.updated += batch.length;
    } catch (err) {
      console.error('[BATCH SYNC] Failed to update exam batch:', err.message);
      summary.mockExams.failed += batch.length;
    }
  }

  console.log('[BATCH SYNC] Mock exams synced:', summary.mockExams);
}

/**
 * Mark audit log entries as synced
 */
async function markAuditLogSynced() {
  await supabase
    .from('supabase_audit_log')
    .update({ synced_to_hubspot_at: new Date().toISOString() })
    .is('synced_to_hubspot_at', null);
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

## Monitoring Queries

```sql
-- Records awaiting HubSpot ID (batch sync targets)
SELECT
  'contact_credits' as table_name,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE hubspot_id IS NULL) as awaiting_hubspot_id,
  MAX(created_at) FILTER (WHERE hubspot_id IS NULL) as oldest_pending
FROM hubspot_sync.hubspot_contact_credits
UNION ALL
SELECT
  'bookings',
  COUNT(*),
  COUNT(*) FILTER (WHERE hubspot_id IS NULL),
  MAX(created_at) FILTER (WHERE hubspot_id IS NULL)
FROM hubspot_sync.hubspot_bookings;

-- Last sync timestamps (audit trail)
SELECT
  'contact_credits' as table_name,
  MAX(hubspot_last_sync_at) as last_sync,
  COUNT(*) FILTER (WHERE hubspot_last_sync_at > NOW() - INTERVAL '2 hours') as synced_recently
FROM hubspot_sync.hubspot_contact_credits
UNION ALL
SELECT
  'bookings',
  MAX(hubspot_last_sync_at),
  COUNT(*) FILTER (WHERE hubspot_last_sync_at > NOW() - INTERVAL '2 hours')
FROM hubspot_sync.hubspot_bookings
UNION ALL
SELECT
  'mock_exams',
  MAX(hubspot_last_sync_at),
  COUNT(*) FILTER (WHERE hubspot_last_sync_at > NOW() - INTERVAL '2 hours')
FROM hubspot_sync.hubspot_mock_exams;
```

---

## Manual Trigger

For testing or emergency sync:

```bash
curl -X POST https://your-domain.com/api/admin/cron/batch-sync-hubspot \
  -H "Authorization: Bearer $CRON_SECRET"
```

---

## Error Recovery

If the cron job fails:
1. Failed records are NOT marked as synced
2. Next cron run (in 2 hours) will retry them automatically
3. Check Vercel logs for specific errors
4. Use manual trigger if immediate sync is needed

---

## Sprint 3-4 Checklist

### Sprint 3: Cron Job Development
- [ ] Create `batch-sync-hubspot.js`
- [ ] Test contact sync (create + update)
- [ ] Test booking sync (create + update + associations)
- [ ] Test mock exam sync
- [ ] Verify hubspot_id population
- [ ] Verify hubspot_last_sync_at updates

### Sprint 4: Deployment & Monitoring
- [ ] Add cron to vercel.json
- [ ] Deploy to production
- [ ] Monitor first few cron runs
- [ ] Set up alerting for failures
- [ ] Create admin dashboard for sync audit
- [ ] Document runbooks for manual intervention

---

*Previous: [03-backend-api-migration.md](./03-backend-api-migration.md)*
*Next: [05-frontend-changes.md](./05-frontend-changes.md)*
