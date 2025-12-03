# PRD: Supabase as Source of Truth - Architectural Shift

## Document Information

| Field | Value |
|-------|-------|
| **PRD ID** | SUPABASE-SOT-001 |
| **Version** | 1.0.0 |
| **Status** | Draft |
| **Author** | Claude Code |
| **Created** | December 3, 2025 |
| **Last Updated** | December 3, 2025 |
| **Confidence Score** | 8/10 |

---

## Executive Summary

This PRD defines the architectural shift from HubSpot as the single source of truth to **Supabase as the primary data store** for real-time operations, with HubSpot maintained as a secondary system for auditing, compliance, and CRM workflows.

### Problem Statement

The current architecture uses HubSpot as the source of truth for all credit operations. This creates significant performance bottlenecks:

- **Rate Limiting**: HubSpot API limit of 100 requests/10 seconds
- **Response Latency**: ~500ms per HubSpot API call vs ~50ms for Supabase
- **Scalability Issues**: 200 concurrent users would take 13+ minutes to process bookings
- **Blocking Operations**: Credit deductions block user responses

### Proposed Solution

Flip the architecture to use Supabase for all real-time read/write operations while maintaining HubSpot as a background audit system:

- **Supabase**: Source of truth for credits, bookings, and availability
- **HubSpot**: Background sync via webhooks for auditing and CRM workflows
- **Reconciliation**: Periodic cron jobs to ensure consistency

### Expected Outcomes

| Metric | Current | Target | Improvement |
|--------|---------|--------|-------------|
| Booking Response Time | ~800ms | ~150ms | 81% faster |
| Concurrent User Capacity | ~100 users | ~2,000 users | 20x increase |
| HubSpot API Calls (blocking) | 6.5/booking | 0/booking | 100% reduction |
| Credit Validation Time | ~450ms | ~50ms | 89% faster |

---

## Table of Contents

1. [Background & Context](#1-background--context)
2. [Goals & Non-Goals](#2-goals--non-goals)
3. [Technical Architecture](#3-technical-architecture)
4. [Detailed Design](#4-detailed-design)
5. [Migration Strategy](#5-migration-strategy)
6. [Implementation Plan](#6-implementation-plan)
7. [Risk Assessment](#7-risk-assessment)
8. [Testing Strategy](#8-testing-strategy)
9. [Rollback Plan](#9-rollback-plan)
10. [Success Metrics](#10-success-metrics)

---

## 1. Background & Context

### 1.1 Current Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CURRENT: HubSpot as Source of Truth              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   User Request                                                      │
│        │                                                            │
│        ▼                                                            │
│   ┌─────────┐     BLOCKING      ┌──────────┐                       │
│   │ Vercel  │ ─────────────────▶│ HubSpot  │ (Source of Truth)     │
│   │   API   │◀───────────────── │   API    │                       │
│   └────┬────┘     ~500ms        └──────────┘                       │
│        │                                                            │
│        │ NON-BLOCKING                                               │
│        ▼                                                            │
│   ┌─────────┐                                                       │
│   │Supabase │ (Read Cache Only)                                     │
│   └─────────┘                                                       │
│                                                                     │
│   Problems:                                                         │
│   • HubSpot rate limit: 100 req/10s                                │
│   • Blocking API calls add ~800ms latency                          │
│   • 200 concurrent users = 13+ minute queue                        │
│   • Credit updates block user response                             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 Proposed Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                  PROPOSED: Supabase as Source of Truth              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   User Request                                                      │
│        │                                                            │
│        ▼                                                            │
│   ┌─────────┐     BLOCKING      ┌──────────┐                       │
│   │ Vercel  │ ─────────────────▶│ Supabase │ (Source of Truth)     │
│   │   API   │◀───────────────── │    DB    │                       │
│   └────┬────┘     ~50ms         └──────────┘                       │
│        │                                                            │
│        │ NON-BLOCKING (process.nextTick)                           │
│        ▼                                                            │
│   ┌─────────┐     WEBHOOK       ┌──────────┐                       │
│   │ Webhook │ ─────────────────▶│ HubSpot  │ (Audit/CRM)           │
│   │ Service │                   │   API    │                       │
│   └─────────┘                   └──────────┘                       │
│        │                                                            │
│        │ RECONCILIATION (every 2 hours)                            │
│        ▼                                                            │
│   ┌─────────┐                                                       │
│   │  Cron   │ Sync Supabase → HubSpot                              │
│   │   Job   │ Handle drift and failures                            │
│   └─────────┘                                                       │
│                                                                     │
│   Benefits:                                                         │
│   • No rate limiting for user operations                           │
│   • ~150ms total response time                                     │
│   • Unlimited concurrent users                                     │
│   • Background HubSpot sync doesn't block users                    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.3 Systems Affected

| System | Current Role | New Role | Changes Required |
|--------|--------------|----------|------------------|
| **Supabase** | Read cache | Source of truth | Schema updates, new tables |
| **HubSpot** | Source of truth | Audit/CRM | Background sync only |
| **Redis** | Locking & counters | Locking & counters | No change |
| **Vercel API** | Orchestration | Orchestration | Major refactoring |
| **Frontend** | Consumer | Consumer | Minor changes |

---

## 2. Goals & Non-Goals

### 2.1 Goals

1. **G1**: Eliminate HubSpot as a blocking dependency for user-facing operations
2. **G2**: Reduce booking response time from ~800ms to <200ms
3. **G3**: Support 2,000+ concurrent users without rate limiting
4. **G4**: Maintain HubSpot data integrity for auditing and CRM workflows
5. **G5**: Enable sub-second credit validation for all operations
6. **G6**: Zero data loss during architectural transition

### 2.2 Non-Goals

1. **NG1**: Removing HubSpot entirely (it remains for auditing/CRM)
2. **NG2**: Changing frontend architecture or state management
3. **NG3**: Modifying HubSpot object schemas or properties
4. **NG4**: Real-time bi-directional sync (Supabase → HubSpot is async)
5. **NG5**: Replacing Redis for locking mechanisms

### 2.3 Success Criteria

| Criteria | Threshold | Measurement |
|----------|-----------|-------------|
| Booking Response Time | < 200ms P95 | Vercel analytics |
| Credit Validation Time | < 100ms P95 | API logging |
| HubSpot Sync Lag | < 30 minutes | Reconciliation cron |
| Data Consistency | 99.9% | Audit reports |
| Zero Downtime Migration | 100% | Monitoring |

---

## 3. Technical Architecture

### 3.1 Data Flow Diagrams

#### 3.1.1 Booking Creation Flow (New)

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         BOOKING CREATION (NEW FLOW)                        │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  1. User submits booking                                                   │
│     │                                                                      │
│     ▼                                                                      │
│  2. ┌─────────────────────────────────────────────────────────────┐       │
│     │ VALIDATION (Supabase - ~50ms)                               │       │
│     │ • Check credit balance from hubspot_contact_credits         │       │
│     │ • Check exam capacity from hubspot_mock_exams               │       │
│     │ • Verify no duplicate booking                               │       │
│     └─────────────────────────────────────────────────────────────┘       │
│     │                                                                      │
│     ▼                                                                      │
│  3. ┌─────────────────────────────────────────────────────────────┐       │
│     │ ACQUIRE LOCKS (Redis - ~5ms)                                │       │
│     │ • User lock: user_booking:{contact_id}:{exam_date}          │       │
│     │ • Session lock: {mock_exam_id}                              │       │
│     └─────────────────────────────────────────────────────────────┘       │
│     │                                                                      │
│     ▼                                                                      │
│  4. ┌─────────────────────────────────────────────────────────────┐       │
│     │ ATOMIC WRITE (Supabase Transaction - ~30ms)                 │       │
│     │ BEGIN TRANSACTION;                                          │       │
│     │   • INSERT into hubspot_bookings                            │       │
│     │   • UPDATE hubspot_contact_credits (decrement)              │       │
│     │   • UPDATE hubspot_mock_exams (increment total_bookings)    │       │
│     │ COMMIT;                                                     │       │
│     └─────────────────────────────────────────────────────────────┘       │
│     │                                                                      │
│     ▼                                                                      │
│  5. ┌─────────────────────────────────────────────────────────────┐       │
│     │ UPDATE REDIS (Redis - ~5ms)                                 │       │
│     │ • Increment exam:{mock_exam_id}:bookings counter            │       │
│     │ • Cache booking:{contact_id}:{exam_date} = Active           │       │
│     └─────────────────────────────────────────────────────────────┘       │
│     │                                                                      │
│     ▼                                                                      │
│  6. ┌─────────────────────────────────────────────────────────────┐       │
│     │ RELEASE LOCKS & RESPOND (Redis + HTTP - ~10ms)              │       │
│     │ • Release Redis locks                                       │       │
│     │ • Return 201 Created to user                                │       │
│     └─────────────────────────────────────────────────────────────┘       │
│     │                                                                      │
│     │ ════════════════════════════════════════════════════════════       │
│     │  USER RESPONSE COMPLETE (~100ms total)                              │
│     │ ════════════════════════════════════════════════════════════       │
│     │                                                                      │
│     ▼ (process.nextTick - NON-BLOCKING)                                   │
│  7. ┌─────────────────────────────────────────────────────────────┐       │
│     │ BACKGROUND HUBSPOT SYNC (Webhook - fire-and-forget)         │       │
│     │ • Create booking in HubSpot                                 │       │
│     │ • Create contact association                                │       │
│     │ • Create mock exam association                              │       │
│     │ • Update contact credits                                    │       │
│     │ • Update mock exam total_bookings                           │       │
│     │ • Create timeline note                                      │       │
│     │ (3 retries with exponential backoff)                        │       │
│     └─────────────────────────────────────────────────────────────┘       │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

#### 3.1.2 Credit Validation Flow (New)

```
┌────────────────────────────────────────────────────────────────────────────┐
│                       CREDIT VALIDATION (NEW FLOW)                         │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  User Request: POST /api/mock-exams/validate-credits                       │
│     │                                                                      │
│     ▼                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐          │
│  │ SUPABASE QUERY (Single Source - ~50ms)                      │          │
│  │                                                             │          │
│  │ SELECT sj_credits, cs_credits, sjmini_credits,              │          │
│  │        mock_discussion_token, shared_mock_credits           │          │
│  │ FROM hubspot_contact_credits                                │          │
│  │ WHERE student_id = $1 AND email = $2;                       │          │
│  │                                                             │          │
│  └─────────────────────────────────────────────────────────────┘          │
│     │                                                                      │
│     ▼                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐          │
│  │ RETURN CREDITS (No HubSpot Fallback)                        │          │
│  │                                                             │          │
│  │ {                                                           │          │
│  │   "credits": { ... },                                       │          │
│  │   "source": "supabase",                                     │          │
│  │   "latency_ms": 48                                          │          │
│  │ }                                                           │          │
│  └─────────────────────────────────────────────────────────────┘          │
│                                                                            │
│  NOTE: HubSpot fallback REMOVED - Supabase is authoritative               │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

#### 3.1.3 Booking Cancellation Flow (New)

```
┌────────────────────────────────────────────────────────────────────────────┐
│                      BOOKING CANCELLATION (NEW FLOW)                       │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  1. User requests cancellation: DELETE /api/bookings/{id}                  │
│     │                                                                      │
│     ▼                                                                      │
│  2. ┌─────────────────────────────────────────────────────────────┐       │
│     │ VALIDATE OWNERSHIP (Supabase - ~30ms)                       │       │
│     │ • Verify booking exists                                     │       │
│     │ • Verify booking belongs to user (contact_id match)         │       │
│     │ • Verify booking is Active (not already cancelled)          │       │
│     └─────────────────────────────────────────────────────────────┘       │
│     │                                                                      │
│     ▼                                                                      │
│  3. ┌─────────────────────────────────────────────────────────────┐       │
│     │ ATOMIC WRITE (Supabase Transaction - ~30ms)                 │       │
│     │ BEGIN TRANSACTION;                                          │       │
│     │   • UPDATE hubspot_bookings SET is_active = 'Cancelled'     │       │
│     │   • UPDATE hubspot_contact_credits (restore credit +1)      │       │
│     │   • UPDATE hubspot_mock_exams (decrement total_bookings)    │       │
│     │ COMMIT;                                                     │       │
│     └─────────────────────────────────────────────────────────────┘       │
│     │                                                                      │
│     ▼                                                                      │
│  4. ┌─────────────────────────────────────────────────────────────┐       │
│     │ UPDATE REDIS (~5ms)                                         │       │
│     │ • Decrement exam:{mock_exam_id}:bookings counter            │       │
│     │ • Delete booking:{contact_id}:{exam_date} cache             │       │
│     └─────────────────────────────────────────────────────────────┘       │
│     │                                                                      │
│     ▼                                                                      │
│  5. Return 200 OK to user (~70ms total)                                   │
│     │                                                                      │
│     │ ════════════════════════════════════════════════════════════       │
│     │  USER RESPONSE COMPLETE                                             │
│     │ ════════════════════════════════════════════════════════════       │
│     │                                                                      │
│     ▼ (process.nextTick - NON-BLOCKING)                                   │
│  6. ┌─────────────────────────────────────────────────────────────┐       │
│     │ BACKGROUND HUBSPOT SYNC                                     │       │
│     │ • Update booking status to Cancelled                        │       │
│     │ • Restore contact credits                                   │       │
│     │ • Update mock exam total_bookings                           │       │
│     │ • Create cancellation note on timeline                      │       │
│     └─────────────────────────────────────────────────────────────┘       │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Database Schema Updates

#### 3.2.1 Supabase Schema Changes

```sql
-- ============================================================================
-- SUPABASE SCHEMA UPDATES FOR SOURCE OF TRUTH MIGRATION
-- ============================================================================

-- Add sync tracking columns to all tables
ALTER TABLE hubspot_contact_credits ADD COLUMN IF NOT EXISTS
  hubspot_sync_status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE hubspot_contact_credits ADD COLUMN IF NOT EXISTS
  hubspot_sync_attempts INTEGER DEFAULT 0;
ALTER TABLE hubspot_contact_credits ADD COLUMN IF NOT EXISTS
  hubspot_last_sync_error TEXT;
ALTER TABLE hubspot_contact_credits ADD COLUMN IF NOT EXISTS
  hubspot_last_sync_at TIMESTAMPTZ;

ALTER TABLE hubspot_bookings ADD COLUMN IF NOT EXISTS
  hubspot_sync_status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE hubspot_bookings ADD COLUMN IF NOT EXISTS
  hubspot_sync_attempts INTEGER DEFAULT 0;
ALTER TABLE hubspot_bookings ADD COLUMN IF NOT EXISTS
  hubspot_last_sync_error TEXT;
ALTER TABLE hubspot_bookings ADD COLUMN IF NOT EXISTS
  hubspot_last_sync_at TIMESTAMPTZ;

ALTER TABLE hubspot_mock_exams ADD COLUMN IF NOT EXISTS
  hubspot_sync_status VARCHAR(20) DEFAULT 'synced';
-- Mock exams are created in HubSpot first, so default to 'synced'

-- Create enum for sync status
DO $$ BEGIN
  CREATE TYPE hubspot_sync_status AS ENUM (
    'pending',      -- Needs to be synced to HubSpot
    'syncing',      -- Currently being synced
    'synced',       -- Successfully synced to HubSpot
    'failed',       -- Sync failed (will retry)
    'abandoned'     -- Max retries exceeded (manual intervention needed)
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Index for finding records that need syncing
CREATE INDEX IF NOT EXISTS idx_contact_credits_sync_pending
  ON hubspot_contact_credits(hubspot_sync_status)
  WHERE hubspot_sync_status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_bookings_sync_pending
  ON hubspot_bookings(hubspot_sync_status)
  WHERE hubspot_sync_status IN ('pending', 'failed');

-- Add primary key generation for new bookings
-- (Currently bookings are created in HubSpot first and get HubSpot ID)
CREATE SEQUENCE IF NOT EXISTS booking_id_seq START 1000000;

ALTER TABLE hubspot_bookings ADD COLUMN IF NOT EXISTS
  local_id BIGINT DEFAULT nextval('booking_id_seq');

-- Create audit log table for tracking all changes
CREATE TABLE IF NOT EXISTS supabase_audit_log (
  id BIGSERIAL PRIMARY KEY,
  table_name VARCHAR(100) NOT NULL,
  record_id VARCHAR(100) NOT NULL,
  operation VARCHAR(20) NOT NULL,  -- INSERT, UPDATE, DELETE
  old_data JSONB,
  new_data JSONB,
  hubspot_sync_status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  synced_to_hubspot_at TIMESTAMPTZ
);

CREATE INDEX idx_audit_log_pending
  ON supabase_audit_log(hubspot_sync_status)
  WHERE hubspot_sync_status = 'pending';

-- Function to automatically log changes
CREATE OR REPLACE FUNCTION audit_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO supabase_audit_log (table_name, record_id, operation, new_data)
    VALUES (TG_TABLE_NAME, NEW.hubspot_id::TEXT, 'INSERT', to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO supabase_audit_log (table_name, record_id, operation, old_data, new_data)
    VALUES (TG_TABLE_NAME, NEW.hubspot_id::TEXT, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO supabase_audit_log (table_name, record_id, operation, old_data)
    VALUES (TG_TABLE_NAME, OLD.hubspot_id::TEXT, 'DELETE', to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Attach audit triggers
DROP TRIGGER IF EXISTS audit_contact_credits ON hubspot_contact_credits;
CREATE TRIGGER audit_contact_credits
  AFTER INSERT OR UPDATE OR DELETE ON hubspot_contact_credits
  FOR EACH ROW EXECUTE FUNCTION audit_changes();

DROP TRIGGER IF EXISTS audit_bookings ON hubspot_bookings;
CREATE TRIGGER audit_bookings
  AFTER INSERT OR UPDATE OR DELETE ON hubspot_bookings
  FOR EACH ROW EXECUTE FUNCTION audit_changes();
```

### 3.3 New API Services

#### 3.3.1 HubSpot Background Sync Service

**File: `user_root/api/_shared/hubspot-background-sync.js`**

```javascript
/**
 * HubSpot Background Sync Service
 *
 * Handles non-blocking synchronization from Supabase (source of truth)
 * to HubSpot (audit/CRM system)
 */

const { HubSpotService, HUBSPOT_OBJECTS } = require('./hubspot');
const { createClient } = require('@supabase/supabase-js');

const MAX_RETRIES = 5;
const RETRY_DELAYS = [1000, 2000, 5000, 15000, 30000]; // Exponential backoff

class HubSpotBackgroundSync {
  constructor() {
    this.hubspot = new HubSpotService();
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }

  /**
   * Sync a new booking to HubSpot (fire-and-forget with retries)
   */
  async syncBookingToHubSpot(bookingData, contactId, mockExamId) {
    const syncId = `booking_${bookingData.booking_id}_${Date.now()}`;
    console.log(`[BACKGROUND SYNC] Starting booking sync: ${syncId}`);

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        // Step 1: Create booking in HubSpot
        const hubspotBooking = await this.hubspot.apiCall(
          'POST',
          `/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}`,
          {
            properties: {
              booking_id: bookingData.booking_id,
              name: bookingData.name,
              email: bookingData.email,
              is_active: bookingData.is_active,
              token_used: bookingData.token_used,
              attending_location: bookingData.attending_location,
              dominant_hand: bookingData.dominant_hand,
              idempotency_key: bookingData.idempotency_key
            }
          }
        );

        const hubspotBookingId = hubspotBooking.id;
        console.log(`[BACKGROUND SYNC] Booking created in HubSpot: ${hubspotBookingId}`);

        // Step 2: Create associations
        await Promise.all([
          this.hubspot.createAssociation(
            HUBSPOT_OBJECTS.bookings,
            hubspotBookingId,
            HUBSPOT_OBJECTS.contacts,
            contactId
          ),
          this.hubspot.createAssociation(
            HUBSPOT_OBJECTS.bookings,
            hubspotBookingId,
            HUBSPOT_OBJECTS.mock_exams,
            mockExamId
          )
        ]);

        // Step 3: Update Supabase with HubSpot ID and sync status
        await this.supabase
          .from('hubspot_bookings')
          .update({
            hubspot_id: hubspotBookingId,
            hubspot_sync_status: 'synced',
            hubspot_last_sync_at: new Date().toISOString()
          })
          .eq('booking_id', bookingData.booking_id);

        console.log(`[BACKGROUND SYNC] Booking sync complete: ${syncId}`);
        return { success: true, hubspotId: hubspotBookingId };

      } catch (error) {
        console.error(`[BACKGROUND SYNC] Attempt ${attempt}/${MAX_RETRIES} failed:`, error.message);

        // Update sync status
        await this.supabase
          .from('hubspot_bookings')
          .update({
            hubspot_sync_status: attempt >= MAX_RETRIES ? 'abandoned' : 'failed',
            hubspot_sync_attempts: attempt,
            hubspot_last_sync_error: error.message
          })
          .eq('booking_id', bookingData.booking_id);

        if (attempt < MAX_RETRIES) {
          const delay = RETRY_DELAYS[attempt - 1];
          console.log(`[BACKGROUND SYNC] Retrying in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }

    console.error(`[BACKGROUND SYNC] All retries exhausted for ${syncId}`);
    return { success: false, error: 'Max retries exceeded' };
  }

  /**
   * Sync credit changes to HubSpot
   */
  async syncCreditsToHubSpot(contactId, creditField, newValue, operation) {
    const syncId = `credits_${contactId}_${creditField}_${Date.now()}`;
    console.log(`[BACKGROUND SYNC] Starting credit sync: ${syncId}`);

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        await this.hubspot.updateContactCredits(contactId, creditField, newValue);

        // Update sync status
        await this.supabase
          .from('hubspot_contact_credits')
          .update({
            hubspot_sync_status: 'synced',
            hubspot_last_sync_at: new Date().toISOString()
          })
          .eq('hubspot_id', contactId);

        console.log(`[BACKGROUND SYNC] Credit sync complete: ${syncId}`);
        return { success: true };

      } catch (error) {
        console.error(`[BACKGROUND SYNC] Credit sync attempt ${attempt}/${MAX_RETRIES} failed:`, error.message);

        if (attempt < MAX_RETRIES) {
          const delay = RETRY_DELAYS[attempt - 1];
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }

    // Log to audit for manual reconciliation
    await this.supabase
      .from('supabase_audit_log')
      .insert({
        table_name: 'hubspot_contact_credits',
        record_id: contactId,
        operation: 'CREDIT_SYNC_FAILED',
        new_data: { creditField, newValue, operation }
      });

    return { success: false };
  }

  /**
   * Sync booking cancellation to HubSpot
   */
  async syncCancellationToHubSpot(hubspotBookingId, contactId, creditRestoration) {
    const syncId = `cancel_${hubspotBookingId}_${Date.now()}`;
    console.log(`[BACKGROUND SYNC] Starting cancellation sync: ${syncId}`);

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        // Step 1: Update booking status
        await this.hubspot.softDeleteBooking(hubspotBookingId);

        // Step 2: Restore credits
        if (creditRestoration) {
          await this.hubspot.restoreCredits(
            contactId,
            creditRestoration.token_used,
            creditRestoration.current_credits
          );
        }

        // Step 3: Create cancellation note
        await this.hubspot.createBookingCancellationNote(contactId, {
          booking_id: hubspotBookingId,
          reason: creditRestoration?.reason || 'User requested cancellation'
        });

        console.log(`[BACKGROUND SYNC] Cancellation sync complete: ${syncId}`);
        return { success: true };

      } catch (error) {
        console.error(`[BACKGROUND SYNC] Cancellation sync attempt ${attempt}/${MAX_RETRIES} failed:`, error.message);

        if (attempt < MAX_RETRIES) {
          const delay = RETRY_DELAYS[attempt - 1];
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }

    return { success: false };
  }
}

module.exports = { HubSpotBackgroundSync };
```

---

## 4. Detailed Design

### 4.1 Files to Modify

#### 4.1.1 User Root - Booking Creation

**File: `user_root/api/bookings/create.js`**

| Line Range | Current Behavior | New Behavior |
|------------|------------------|--------------|
| 398-465 | Validate credits from Supabase, fallback to HubSpot | Validate credits from Supabase ONLY |
| 556 | `await hubspot.createBooking()` (blocking) | Create booking in Supabase (blocking) |
| 561-596 | Sync booking to Supabase (non-blocking) | REMOVED - Supabase is primary |
| 605-643 | Create HubSpot associations (blocking) | Move to background sync |
| 703 | `await hubspot.updateContactCredits()` (blocking) | Update Supabase credits (blocking) |
| 716-723 | Sync credits to Supabase (non-blocking) | REMOVED - Supabase is primary |
| NEW | N/A | Trigger HubSpot background sync via `process.nextTick` |

#### 4.1.2 User Root - Booking Cancellation

**File: `user_root/api/bookings/[id].js`**

| Line Range | Current Behavior | New Behavior |
|------------|------------------|--------------|
| 203-337 | Get booking from HubSpot with associations | Get booking from Supabase |
| 512 | `await hubspot.restoreCredits()` (blocking) | Update Supabase credits (blocking) |
| 350 | `await hubspot.softDeleteBooking()` (blocking) | Update Supabase status (blocking) |
| NEW | N/A | Trigger HubSpot background sync |

#### 4.1.3 User Root - Credit Validation

**File: `user_root/api/mock-exams/validate-credits.js`**

| Current Behavior | New Behavior |
|------------------|--------------|
| Try Supabase → Fallback to HubSpot | Supabase ONLY (no fallback) |

#### 4.1.4 Admin Root - Token Management

**File: `admin_root/api/admin/trainees/[contactId]/tokens.js`**

| Current Behavior | New Behavior |
|------------------|--------------|
| Update HubSpot → Sync to Supabase | Update Supabase → Background sync to HubSpot |

#### 4.1.5 Admin Root - Batch Refunds

**File: `admin_root/api/_shared/refund.js`**

| Current Behavior | New Behavior |
|------------------|--------------|
| Batch update HubSpot → Sync each to Supabase | Batch update Supabase → Queue HubSpot syncs |

### 4.2 New Files to Create

| File Path | Purpose |
|-----------|---------|
| `user_root/api/_shared/hubspot-background-sync.js` | Background sync service |
| `user_root/api/_shared/supabase-transactions.js` | Atomic transaction helpers |
| `admin_root/api/admin/cron/reconcile-hubspot.js` | Reconciliation cron job |
| `admin_root/api/admin/cron/retry-failed-syncs.js` | Failed sync retry cron |

### 4.3 Supabase Transaction Patterns

#### 4.3.1 Booking Creation Transaction

```javascript
// user_root/api/_shared/supabase-transactions.js

async function createBookingTransaction(supabase, {
  bookingData,
  contactId,
  mockExamId,
  creditField,
  newCreditValue,
  newTotalBookings
}) {
  // Use Supabase RPC for atomic transaction
  const { data, error } = await supabase.rpc('create_booking_atomic', {
    p_booking_data: bookingData,
    p_contact_id: contactId,
    p_mock_exam_id: mockExamId,
    p_credit_field: creditField,
    p_new_credit_value: newCreditValue,
    p_new_total_bookings: newTotalBookings
  });

  if (error) {
    throw new Error(`Transaction failed: ${error.message}`);
  }

  return data;
}
```

#### 4.3.2 Supabase Stored Procedure

```sql
-- Atomic booking creation function
CREATE OR REPLACE FUNCTION create_booking_atomic(
  p_booking_data JSONB,
  p_contact_id TEXT,
  p_mock_exam_id TEXT,
  p_credit_field TEXT,
  p_new_credit_value INTEGER,
  p_new_total_bookings INTEGER
)
RETURNS JSONB AS $$
DECLARE
  v_booking_id TEXT;
  v_result JSONB;
BEGIN
  -- Generate local booking ID
  v_booking_id := p_booking_data->>'booking_id';

  -- Insert booking
  INSERT INTO hubspot_bookings (
    booking_id,
    associated_contact_id,
    associated_mock_exam,
    name,
    student_email,
    is_active,
    token_used,
    attending_location,
    dominant_hand,
    idempotency_key,
    hubspot_sync_status,
    created_at
  ) VALUES (
    v_booking_id,
    p_contact_id,
    p_mock_exam_id,
    p_booking_data->>'name',
    p_booking_data->>'email',
    'Active',
    p_booking_data->>'token_used',
    p_booking_data->>'attending_location',
    p_booking_data->>'dominant_hand',
    p_booking_data->>'idempotency_key',
    'pending',
    NOW()
  );

  -- Update contact credits
  EXECUTE format(
    'UPDATE hubspot_contact_credits SET %I = $1, hubspot_sync_status = ''pending'', updated_at = NOW() WHERE hubspot_id = $2',
    p_credit_field
  ) USING p_new_credit_value, p_contact_id;

  -- Update mock exam total bookings
  UPDATE hubspot_mock_exams
  SET total_bookings = p_new_total_bookings,
      updated_at = NOW()
  WHERE hubspot_id = p_mock_exam_id;

  -- Return result
  v_result := jsonb_build_object(
    'booking_id', v_booking_id,
    'success', true
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;
```

---

## 5. Migration Strategy

### 5.1 Migration Phases

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          MIGRATION PHASES                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Phase 1: Schema Preparation (Day 1-2)                                      │
│  ├─ Add sync tracking columns to Supabase tables                           │
│  ├─ Create audit log table and triggers                                    │
│  ├─ Create atomic transaction stored procedures                            │
│  └─ Deploy schema changes (no code changes yet)                            │
│                                                                             │
│  Phase 2: Dual-Write Mode (Day 3-5)                                        │
│  ├─ Update booking creation to write Supabase FIRST, then HubSpot         │
│  ├─ Keep HubSpot writes BLOCKING for data integrity verification          │
│  ├─ Monitor for discrepancies                                              │
│  └─ Run comparison reports daily                                           │
│                                                                             │
│  Phase 3: Read from Supabase Only (Day 6-7)                                │
│  ├─ Remove HubSpot fallback from credit validation                         │
│  ├─ Remove HubSpot fallback from booking retrieval                         │
│  ├─ All reads come from Supabase only                                      │
│  └─ HubSpot writes still blocking (verify sync accuracy)                   │
│                                                                             │
│  Phase 4: Background HubSpot Writes (Day 8-10)                             │
│  ├─ Move HubSpot booking creation to process.nextTick                      │
│  ├─ Move HubSpot credit updates to process.nextTick                        │
│  ├─ Implement retry logic with exponential backoff                         │
│  └─ Deploy reconciliation cron job                                         │
│                                                                             │
│  Phase 5: Monitoring & Optimization (Day 11-14)                            │
│  ├─ Monitor sync lag metrics                                               │
│  ├─ Tune retry intervals                                                   │
│  ├─ Optimize batch sizes for reconciliation                                │
│  └─ Document runbooks for manual intervention                              │
│                                                                             │
│  Phase 6: Cleanup (Day 15+)                                                │
│  ├─ Remove deprecated HubSpot-first code paths                             │
│  ├─ Update CLAUDE.md with new architecture                                 │
│  ├─ Update documentation                                                   │
│  └─ Archive old implementation                                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Feature Flags

```javascript
// config/feature-flags.js

const MIGRATION_FLAGS = {
  // Phase 2: Write to Supabase first
  SUPABASE_PRIMARY_WRITE: process.env.FF_SUPABASE_PRIMARY_WRITE === 'true',

  // Phase 3: Read from Supabase only
  SUPABASE_ONLY_READ: process.env.FF_SUPABASE_ONLY_READ === 'true',

  // Phase 4: Background HubSpot sync
  HUBSPOT_BACKGROUND_SYNC: process.env.FF_HUBSPOT_BACKGROUND_SYNC === 'true',

  // Rollback flag
  HUBSPOT_SOURCE_OF_TRUTH: process.env.FF_HUBSPOT_SOURCE_OF_TRUTH === 'true'
};

module.exports = { MIGRATION_FLAGS };
```

### 5.3 Data Consistency Verification

```javascript
// admin_root/api/admin/cron/verify-data-consistency.js

/**
 * Cron job to verify Supabase and HubSpot data consistency
 * Run every 4 hours during migration, daily after stabilization
 */

async function verifyDataConsistency() {
  const discrepancies = [];

  // 1. Compare contact credits
  const supabaseCredits = await getSupabaseCredits();
  const hubspotCredits = await getHubSpotCredits();

  for (const contact of supabaseCredits) {
    const hsContact = hubspotCredits.find(c => c.id === contact.hubspot_id);
    if (hsContact) {
      const fields = ['sj_credits', 'cs_credits', 'sjmini_credits', 'mock_discussion_token', 'shared_mock_credits'];
      for (const field of fields) {
        if (contact[field] !== parseInt(hsContact[field])) {
          discrepancies.push({
            type: 'CREDIT_MISMATCH',
            contact_id: contact.hubspot_id,
            field,
            supabase_value: contact[field],
            hubspot_value: hsContact[field]
          });
        }
      }
    }
  }

  // 2. Compare booking counts
  // ... similar logic

  // 3. Alert if discrepancies found
  if (discrepancies.length > 0) {
    console.error(`[CONSISTENCY CHECK] Found ${discrepancies.length} discrepancies`);
    // Send alert to admin
  }

  return discrepancies;
}
```

---

## 6. Implementation Plan

### 6.1 Sprint Breakdown

| Sprint | Duration | Deliverables |
|--------|----------|--------------|
| **Sprint 1** | 3 days | Schema updates, audit logging, stored procedures |
| **Sprint 2** | 4 days | Dual-write mode, background sync service |
| **Sprint 3** | 3 days | Remove HubSpot fallbacks, read from Supabase only |
| **Sprint 4** | 4 days | Background HubSpot writes, reconciliation cron |

### 6.2 Task List

#### Sprint 1: Schema & Infrastructure

- [ ] Add sync tracking columns to Supabase tables
- [ ] Create `supabase_audit_log` table
- [ ] Create audit trigger functions
- [ ] Create `create_booking_atomic` stored procedure
- [ ] Create `cancel_booking_atomic` stored procedure
- [ ] Deploy schema changes to Supabase
- [ ] Write migration verification tests

#### Sprint 2: Dual-Write Mode

- [ ] Create `hubspot-background-sync.js` service
- [ ] Create `supabase-transactions.js` helpers
- [ ] Modify `create.js` to write Supabase first
- [ ] Keep HubSpot write blocking for verification
- [ ] Add comparison logging
- [ ] Deploy with `SUPABASE_PRIMARY_WRITE=true`
- [ ] Monitor for 48 hours

#### Sprint 3: Supabase-Only Reads

- [ ] Remove HubSpot fallback from `validate-credits.js`
- [ ] Remove HubSpot fallback from booking retrieval
- [ ] Update `getBookingWithAssociations` to use Supabase
- [ ] Deploy with `SUPABASE_ONLY_READ=true`
- [ ] Monitor for 48 hours

#### Sprint 4: Background HubSpot Sync

- [ ] Move HubSpot booking creation to `process.nextTick`
- [ ] Move HubSpot credit updates to `process.nextTick`
- [ ] Implement retry logic with exponential backoff
- [ ] Create `reconcile-hubspot.js` cron job
- [ ] Create `retry-failed-syncs.js` cron job
- [ ] Deploy with `HUBSPOT_BACKGROUND_SYNC=true`
- [ ] Monitor sync lag for 1 week

---

## 7. Risk Assessment

### 7.1 Risk Matrix

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Data inconsistency during migration** | Medium | High | Feature flags, dual-write verification |
| **HubSpot sync queue backup** | Medium | Medium | Rate limiting, batch processing |
| **Supabase downtime** | Low | Critical | Health checks, graceful degradation |
| **Lost HubSpot updates** | Medium | Medium | Audit log, reconciliation cron |
| **Performance regression** | Low | High | A/B testing, canary deployment |

### 7.2 Mitigation Strategies

#### 7.2.1 Data Inconsistency

```javascript
// Verification before going live with background sync
async function verifyDualWriteConsistency(bookingId) {
  const supabaseBooking = await getBookingFromSupabase(bookingId);
  const hubspotBooking = await getBookingFromHubSpot(bookingId);

  const fields = ['booking_id', 'is_active', 'token_used'];
  for (const field of fields) {
    if (supabaseBooking[field] !== hubspotBooking[field]) {
      console.error(`MISMATCH: ${field} - Supabase: ${supabaseBooking[field]}, HubSpot: ${hubspotBooking[field]}`);
      // Alert and log for investigation
    }
  }
}
```

#### 7.2.2 Supabase Downtime

```javascript
// Graceful degradation - fall back to HubSpot if Supabase unavailable
async function getCreditsWithFallback(studentId, email) {
  try {
    const supabaseCredits = await getCreditsFromSupabase(studentId, email);
    return { source: 'supabase', ...supabaseCredits };
  } catch (error) {
    if (error.code === 'SUPABASE_UNAVAILABLE') {
      console.warn('[FALLBACK] Supabase unavailable, falling back to HubSpot');
      const hubspotCredits = await getCreditsFromHubSpot(studentId, email);
      return { source: 'hubspot_fallback', ...hubspotCredits };
    }
    throw error;
  }
}
```

---

## 8. Testing Strategy

### 8.1 Test Categories

| Category | Focus | Tools |
|----------|-------|-------|
| **Unit Tests** | Transaction functions, sync service | Jest |
| **Integration Tests** | Supabase + HubSpot flow | Jest + Supertest |
| **Load Tests** | 200+ concurrent bookings | k6 |
| **Consistency Tests** | Data verification | Custom scripts |

### 8.2 Test Scenarios

#### 8.2.1 Happy Path

```javascript
describe('Supabase-First Booking Creation', () => {
  it('should create booking in Supabase and queue HubSpot sync', async () => {
    const response = await request(app)
      .post('/api/bookings/create')
      .send(validBookingData);

    expect(response.status).toBe(201);
    expect(response.body.data.source).toBe('supabase');

    // Verify Supabase has the booking
    const supabaseBooking = await getBookingFromSupabase(response.body.data.booking_id);
    expect(supabaseBooking).toBeDefined();
    expect(supabaseBooking.hubspot_sync_status).toBe('pending');

    // Wait for background sync
    await sleep(5000);

    // Verify HubSpot has the booking
    const hubspotBooking = await getBookingFromHubSpot(response.body.data.booking_id);
    expect(hubspotBooking).toBeDefined();
  });
});
```

#### 8.2.2 Failure Scenarios

```javascript
describe('HubSpot Sync Failure Handling', () => {
  it('should mark sync as failed and queue for retry', async () => {
    // Mock HubSpot to fail
    mockHubSpotAPI.onPost().reply(429); // Rate limited

    const response = await request(app)
      .post('/api/bookings/create')
      .send(validBookingData);

    // Booking should succeed (Supabase is authoritative)
    expect(response.status).toBe(201);

    // Wait for retry attempts
    await sleep(10000);

    // Verify sync status
    const booking = await getBookingFromSupabase(response.body.data.booking_id);
    expect(booking.hubspot_sync_status).toBe('failed');
    expect(booking.hubspot_sync_attempts).toBeGreaterThan(0);
  });
});
```

### 8.3 Load Testing

```javascript
// k6 load test script
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 50 },   // Ramp up
    { duration: '3m', target: 200 },  // Peak load
    { duration: '1m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'], // 95% of requests under 200ms
    http_req_failed: ['rate<0.01'],   // <1% failure rate
  },
};

export default function () {
  const payload = JSON.stringify({
    contact_id: `test_${__VU}_${__ITER}`,
    mock_exam_id: 'test_exam_123',
    // ... other required fields
  });

  const response = http.post(
    'https://staging.example.com/api/bookings/create',
    payload,
    { headers: { 'Content-Type': 'application/json' } }
  );

  check(response, {
    'status is 201': (r) => r.status === 201,
    'response time < 200ms': (r) => r.timings.duration < 200,
  });

  sleep(1);
}
```

---

## 9. Rollback Plan

### 9.1 Rollback Triggers

| Trigger | Threshold | Action |
|---------|-----------|--------|
| Booking failure rate | >5% | Immediate rollback |
| Data inconsistency | >1% | Investigation + possible rollback |
| Supabase unavailability | >5 minutes | Enable HubSpot fallback |
| HubSpot sync lag | >2 hours | Increase cron frequency |

### 9.2 Rollback Procedure

```bash
# 1. Set rollback feature flag
vercel env add FF_HUBSPOT_SOURCE_OF_TRUTH true --environment production

# 2. Deploy rollback code
vercel --prod

# 3. Verify rollback
curl https://production.example.com/api/health | jq '.architecture'
# Expected: "hubspot_source_of_truth"

# 4. Run data reconciliation (HubSpot → Supabase)
curl -X POST https://production.example.com/api/admin/cron/sync-supabase \
  -H "Authorization: Bearer $CRON_SECRET"
```

### 9.3 Data Recovery

```sql
-- Recover from audit log if needed
INSERT INTO hubspot_contact_credits (hubspot_id, sj_credits, cs_credits, ...)
SELECT
  record_id,
  (old_data->>'sj_credits')::INTEGER,
  (old_data->>'cs_credits')::INTEGER,
  ...
FROM supabase_audit_log
WHERE table_name = 'hubspot_contact_credits'
  AND operation = 'UPDATE'
  AND created_at > '2025-12-01'
ORDER BY created_at DESC;
```

---

## 10. Success Metrics

### 10.1 Key Performance Indicators

| KPI | Baseline | Target | Measurement |
|-----|----------|--------|-------------|
| **Booking Response Time (P95)** | 800ms | <200ms | Vercel Analytics |
| **Credit Validation Time (P95)** | 450ms | <100ms | API Logging |
| **Concurrent User Capacity** | ~100 | 2,000+ | Load Testing |
| **HubSpot API Calls (blocking)** | 6.5/booking | 0/booking | API Logging |
| **Data Consistency Rate** | 100% | 99.9% | Reconciliation Reports |
| **HubSpot Sync Lag (P95)** | N/A | <30 min | Cron Monitoring |

### 10.2 Monitoring Dashboard

```javascript
// Metrics to track
const metrics = {
  // Response times
  'booking_create_duration_ms': histogram,
  'credit_validation_duration_ms': histogram,

  // Throughput
  'bookings_created_total': counter,
  'bookings_cancelled_total': counter,

  // Sync health
  'hubspot_sync_pending_count': gauge,
  'hubspot_sync_failed_count': gauge,
  'hubspot_sync_lag_seconds': gauge,

  // Error rates
  'supabase_errors_total': counter,
  'hubspot_sync_errors_total': counter
};
```

---

## Appendices

### A. Glossary

| Term | Definition |
|------|------------|
| **Source of Truth** | The authoritative system for data reads and writes |
| **Background Sync** | Non-blocking data synchronization after user response |
| **Reconciliation** | Periodic process to ensure data consistency between systems |
| **Dual-Write** | Writing to both systems during migration for verification |

### B. Related Documents

- [CLAUDE.md](../../CLAUDE.md) - Framework principles (to be updated)
- [HUBSPOT_SCHEMA_DOCUMENTATION.md](../../documentation/HUBSPOT_SCHEMA_DOCUMENTATION.md) - HubSpot object schemas
- [REDIS_LOCKING_RACE_CONDITION_FIX.md](../../.serena/memories/REDIS_LOCKING_RACE_CONDITION_FIX.md) - Redis locking patterns
- [TOKEN_SYNC_MULTI_LAYER_CACHE_FIX.md](../../.serena/memories/TOKEN_SYNC_MULTI_LAYER_CACHE_FIX.md) - Current sync patterns

### C. Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-12-03 | Use Supabase transactions for atomicity | Ensures data integrity without distributed transactions |
| 2025-12-03 | Keep HubSpot for audit/CRM | Maintains existing workflows and compliance |
| 2025-12-03 | 5 retry attempts with exponential backoff | Balances persistence with resource usage |
| 2025-12-03 | 2-hour reconciliation interval | Matches existing cron schedule |

---

## Sign-Off

| Role | Name | Date | Approval |
|------|------|------|----------|
| **Product Owner** | | | [ ] Approved |
| **Tech Lead** | | | [ ] Approved |
| **Security** | | | [ ] Approved |
| **DevOps** | | | [ ] Approved |

---

*PRD Version: 1.0.0*
*Last Updated: December 3, 2025*
*Confidence Score: 8/10*