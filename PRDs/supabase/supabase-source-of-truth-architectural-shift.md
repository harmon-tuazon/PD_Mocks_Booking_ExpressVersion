# PRD: Supabase as Source of Truth - Architectural Shift

## Document Information

| Field | Value |
|-------|-------|
| **PRD ID** | SUPABASE-SOT-001 |
| **Version** | 2.3.0 |
| **Status** | Draft |
| **Author** | Claude Code |
| **Created** | December 3, 2025 |
| **Last Updated** | December 4, 2025 |
| **Confidence Score** | 9/10 |

---

## Executive Summary

This PRD defines the architectural shift from HubSpot as the single source of truth to **Supabase as the primary data store** for real-time operations, with HubSpot maintained as a secondary system for auditing, compliance, and CRM workflows.

### Problem Statement

The current architecture uses HubSpot as the source of truth for all credit operations. This creates significant performance bottlenecks:

- **Rate Limiting**: HubSpot API limit of 100 requests/10 seconds
- **Response Latency**: ~500ms per HubSpot API call vs ~50ms for Supabase
- **Scalability Issues**: 200 concurrent users would take 13+ minutes to process bookings
- **Blocking Operations**: Credit deductions block user responses

### Critical Schema Constraint (v2.0 Addition)

The current Supabase schema has `hubspot_id` as `NOT NULL` on all tables, which **requires HubSpot to create records first**. This PRD introduces a **Dual-ID System** to resolve this:

- **Local ID (`id`)**: Existing UUID primary key, used for all internal operations
- **External ID (`hubspot_id`)**: Made nullable, populated asynchronously after HubSpot sync completes

### Proposed Solution

Flip the architecture to use Supabase for all real-time read/write operations while maintaining HubSpot as a background audit system:

- **Supabase**: Source of truth for credits, bookings, and availability
- **HubSpot**: Background sync via cron jobs for auditing and CRM workflows
- **Dual-ID System**: Existing `id` (UUID) for immediate operations, `hubspot_id` synced later
- **Batch Sync Strategy**: Cron jobs perform full dataset sync (no per-record tracking)

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
3. [Schema Migration - Dual-ID System](#3-schema-migration---dual-id-system)
4. [Technical Architecture](#4-technical-architecture)
5. [Detailed Design](#5-detailed-design)
6. [Migration Strategy](#6-migration-strategy)
7. [Implementation Plan](#7-implementation-plan)
8. [Risk Assessment](#8-risk-assessment)
9. [Testing Strategy](#9-testing-strategy)
10. [Rollback Plan](#10-rollback-plan)
11. [Success Metrics](#11-success-metrics)

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
│   • hubspot_id required before Supabase INSERT                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 Proposed Architecture (with Dual-ID System)

```
┌─────────────────────────────────────────────────────────────────────┐
│            PROPOSED: Supabase as Source of Truth (Dual-ID)          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   User Request                                                      │
│        │                                                            │
│        ▼                                                            │
│   ┌─────────┐     BLOCKING      ┌──────────┐                       │
│   │ Vercel  │ ─────────────────▶│ Supabase │ (Source of Truth)     │
│   │   API   │◀───────────────── │    DB    │                       │
│   └────┬────┘     ~50ms         └────┬─────┘                       │
│        │                              │                             │
│        │                              │ id (UUID, immediate)        │
│        │                              │ hubspot_id = NULL (pending) │
│        │                              │                             │
│        │ NON-BLOCKING                 │                             │
│        ▼                              ▼                             │
│   ┌─────────┐     WEBHOOK       ┌──────────┐                       │
│   │ Webhook │ ─────────────────▶│ HubSpot  │ (Audit/CRM)           │
│   │ Service │                   │   API    │                       │
│   └────┬────┘                   └────┬─────┘                       │
│        │                              │                             │
│        │                              │ Returns hubspot_id          │
│        │                              ▼                             │
│        │                        ┌──────────┐                       │
│        │ UPDATE hubspot_id ────▶│ Supabase │                       │
│        │                        └──────────┘                       │
│        │                                                            │
│        │ BATCH SYNC (every 2 hours)                                │
│        ▼                                                            │
│   ┌─────────┐                                                       │
│   │  Cron   │ Full dataset batch sync to HubSpot                   │
│   │   Job   │ Sync ALL records (no per-record tracking)            │
│   └─────────┘                                                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.3 Systems Affected

| System | Current Role | New Role | Changes Required |
|--------|--------------|----------|------------------|
| **Supabase** | Read cache | Source of truth | Schema migration (make hubspot_id nullable) |
| **HubSpot** | Source of truth | Audit/CRM | Background sync only |
| **Redis** | Locking & counters | Locking & counters | Use existing `id` for keys |
| **Vercel API** | Orchestration | Orchestration | Major refactoring |
| **Frontend** | Consumer | Consumer | Minor changes (use existing `id`) |

---

## 2. Goals & Non-Goals

### 2.1 Goals

1. **G1**: Eliminate HubSpot as a blocking dependency for user-facing operations
2. **G2**: Reduce booking response time from ~800ms to <200ms
3. **G3**: Support 2,000+ concurrent users without rate limiting
4. **G4**: Maintain HubSpot data integrity for auditing and CRM workflows
5. **G5**: Enable sub-second credit validation for all operations
6. **G6**: Zero data loss during architectural transition
7. **G7**: Decouple record creation from HubSpot ID dependency (NEW)

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
| HubSpot Sync Lag | < 2 hours | Batch sync cron |
| Data Consistency | 99.9% | Audit reports |
| Zero Downtime Migration | 100% | Monitoring |
| HubSpot ID Population | 99% within 2 hours | Batch sync cron |

---

## 3. Schema Migration - Dual-ID System

### 3.1 The Problem: HubSpot ID Dependency

Current schema constraints that **block Supabase-first writes**:

```sql
-- Current: hubspot_id is required
CREATE TABLE hubspot_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),  -- ✅ Already exists
  hubspot_id TEXT UNIQUE NOT NULL,  -- ❌ Can't INSERT without HubSpot
  ...
);

CREATE TABLE hubspot_contact_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),  -- ✅ Already exists
  hubspot_id TEXT UNIQUE NOT NULL,  -- ❌ Can't INSERT without HubSpot
  student_id TEXT NOT NULL,
  email TEXT NOT NULL,
  ...
);

CREATE TABLE hubspot_mock_exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),  -- ✅ Already exists
  hubspot_id TEXT UNIQUE NOT NULL,  -- ❌ Can't INSERT without HubSpot
  ...
);
```

### 3.2 The Solution: Dual-ID System (Using Existing `id` Column)

```sql
-- SOLUTION: Use existing id (UUID) as primary, make hubspot_id nullable
CREATE TABLE hubspot_bookings (
  -- Primary Identifier (ALREADY EXISTS - no change needed)
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- External Identifier (CHANGE: make nullable)
  hubspot_id TEXT UNIQUE,  -- ✅ NULLABLE - populated by batch sync cron

  -- Contact Reference (EXISTING - use student_id, already available at booking time)
  student_id TEXT NOT NULL,  -- Already exists! Use for contact lookup
  student_email TEXT NOT NULL,  -- Already exists! Use for contact lookup

  -- Mock Exam Reference (EXISTING - keep mock_exam_id as HubSpot ID)
  mock_exam_id TEXT NOT NULL,  -- Already exists! HubSpot ID - mock exams are admin-created

  -- Legacy References (for HubSpot association creation)
  contact_id TEXT,  -- HubSpot contact ID (for association creation)

  -- Audit column only (NO per-record sync tracking)
  hubspot_last_sync_at TIMESTAMPTZ,  -- When last synced by batch cron

  -- Other fields...
  booking_id TEXT UNIQUE NOT NULL,  -- Our generated booking ID (e.g., BK-20251203-ABC123)
  ...
);
```

**Key Insight**: Tables already have `id UUID PRIMARY KEY` - we don't need a new `supabase_id` column. We only need to:
1. Make `hubspot_id` nullable
2. Add `hubspot_last_sync_at` for audit purposes only

**Simplification** (v2.3.0):
- **Contact reference**: Use existing `student_id` + `email` columns (already known at booking time) instead of adding `contact_uuid`
- **Mock exam reference**: Keep existing `mock_exam_id` (HubSpot ID) since mock exams are admin-created in HubSpot first, so the HubSpot ID is always available

**Batch Sync Strategy**: Rather than tracking sync status per-record (`pending`, `failed`, etc.), cron jobs perform full dataset batch sync every 2 hours. This is simpler and more reliable for high-frequency data changes.

### 3.3 Complete Schema Migration SQL

```sql
-- ============================================================================
-- SCHEMA MIGRATION: Dual-ID System for Supabase-First Architecture
-- Run in Supabase SQL Editor
-- NOTE: Uses existing `id` UUID column - no new supabase_id column needed
-- NOTE: Batch sync strategy - NO per-record sync tracking columns
-- ============================================================================

-- ============== PHASE 1: MAKE hubspot_id NULLABLE & ADD AUDIT COLUMN ==============

-- 1.1 hubspot_contact_credits - Make hubspot_id nullable
-- Note: `id` UUID PRIMARY KEY already exists - we use it as-is

-- Make hubspot_id nullable (critical change!)
ALTER TABLE hubspot_sync.hubspot_contact_credits
  ALTER COLUMN hubspot_id DROP NOT NULL;

-- Add audit column only (no per-record sync tracking)
ALTER TABLE hubspot_sync.hubspot_contact_credits
  ADD COLUMN IF NOT EXISTS hubspot_last_sync_at TIMESTAMPTZ;

-- 1.2 hubspot_bookings - Make hubspot_id nullable

-- Make hubspot_id nullable
ALTER TABLE hubspot_sync.hubspot_bookings
  ALTER COLUMN hubspot_id DROP NOT NULL;

-- NOTE: No new columns needed!
-- - student_id and student_email already exist for contact lookup
-- - mock_exam_id already exists and contains HubSpot ID (mock exams are admin-created)

-- Add audit column only (no per-record sync tracking)
ALTER TABLE hubspot_sync.hubspot_bookings
  ADD COLUMN IF NOT EXISTS hubspot_last_sync_at TIMESTAMPTZ;

-- 1.3 hubspot_mock_exams - Add audit column only
-- Note: Mock exams are created in HubSpot first (admin creates them)
-- So hubspot_id stays NOT NULL for mock_exams

-- Add audit column only (no per-record sync tracking)
ALTER TABLE hubspot_sync.hubspot_mock_exams
  ADD COLUMN IF NOT EXISTS hubspot_last_sync_at TIMESTAMPTZ;

-- ============== PHASE 2: INITIALIZE AUDIT TIMESTAMPS ==============

-- Set initial sync timestamp for existing records
UPDATE hubspot_sync.hubspot_contact_credits
SET hubspot_last_sync_at = NOW()
WHERE hubspot_id IS NOT NULL
  AND hubspot_last_sync_at IS NULL;

UPDATE hubspot_sync.hubspot_bookings
SET hubspot_last_sync_at = NOW()
WHERE hubspot_id IS NOT NULL
  AND hubspot_last_sync_at IS NULL;

UPDATE hubspot_sync.hubspot_mock_exams
SET hubspot_last_sync_at = NOW()
WHERE hubspot_id IS NOT NULL
  AND hubspot_last_sync_at IS NULL;

-- ============== PHASE 3: CREATE INDEXES ==============

-- Index for contact lookup by student_id + email (already may exist)
CREATE INDEX IF NOT EXISTS idx_bookings_student_id
  ON hubspot_sync.hubspot_bookings(student_id);

CREATE INDEX IF NOT EXISTS idx_bookings_student_email
  ON hubspot_sync.hubspot_bookings(student_email);

-- Index for records needing HubSpot ID (batch sync targets)
CREATE INDEX IF NOT EXISTS idx_contact_credits_no_hubspot_id
  ON hubspot_sync.hubspot_contact_credits(id)
  WHERE hubspot_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_no_hubspot_id
  ON hubspot_sync.hubspot_bookings(id)
  WHERE hubspot_id IS NULL;

-- UNIQUE index for idempotency key (Supabase-first duplicate prevention)
-- This provides atomic duplicate prevention - INSERT fails if key exists
-- Much faster than HubSpot search (~5ms vs ~200ms)
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_idempotency_key
  ON hubspot_sync.hubspot_bookings(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ============== PHASE 4: CREATE AUDIT LOG TABLE ==============

CREATE TABLE IF NOT EXISTS hubspot_sync.supabase_audit_log (
  id BIGSERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,  -- References the existing `id` column
  record_hubspot_id TEXT,
  operation TEXT NOT NULL,  -- INSERT, UPDATE, DELETE
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  synced_to_hubspot_at TIMESTAMPTZ  -- Updated by batch sync cron
);

CREATE INDEX IF NOT EXISTS idx_audit_log_not_synced
  ON hubspot_sync.supabase_audit_log(created_at)
  WHERE synced_to_hubspot_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_audit_log_table
  ON hubspot_sync.supabase_audit_log(table_name, created_at);

-- ============== PHASE 5: CREATE HELPER FUNCTIONS ==============

-- Function to get contact by either ID type
CREATE OR REPLACE FUNCTION hubspot_sync.get_contact_credits(
  p_id UUID DEFAULT NULL,  -- Uses existing `id` column
  p_hubspot_id TEXT DEFAULT NULL,
  p_student_id TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL
)
RETURNS hubspot_sync.hubspot_contact_credits AS $$
BEGIN
  IF p_id IS NOT NULL THEN
    RETURN (SELECT * FROM hubspot_sync.hubspot_contact_credits WHERE id = p_id);
  ELSIF p_hubspot_id IS NOT NULL THEN
    RETURN (SELECT * FROM hubspot_sync.hubspot_contact_credits WHERE hubspot_id = p_hubspot_id);
  ELSIF p_student_id IS NOT NULL AND p_email IS NOT NULL THEN
    RETURN (SELECT * FROM hubspot_sync.hubspot_contact_credits WHERE student_id = p_student_id AND email = p_email);
  ELSE
    RAISE EXCEPTION 'Must provide id, hubspot_id, or (student_id + email)';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to get booking by either ID type
CREATE OR REPLACE FUNCTION hubspot_sync.get_booking(
  p_id UUID DEFAULT NULL,  -- Uses existing `id` column
  p_hubspot_id TEXT DEFAULT NULL,
  p_booking_id TEXT DEFAULT NULL
)
RETURNS hubspot_sync.hubspot_bookings AS $$
BEGIN
  IF p_id IS NOT NULL THEN
    RETURN (SELECT * FROM hubspot_sync.hubspot_bookings WHERE id = p_id);
  ELSIF p_hubspot_id IS NOT NULL THEN
    RETURN (SELECT * FROM hubspot_sync.hubspot_bookings WHERE hubspot_id = p_hubspot_id);
  ELSIF p_booking_id IS NOT NULL THEN
    RETURN (SELECT * FROM hubspot_sync.hubspot_bookings WHERE booking_id = p_booking_id);
  ELSE
    RAISE EXCEPTION 'Must provide id, hubspot_id, or booking_id';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to check idempotency key (Supabase-first, ~5ms vs HubSpot ~200ms)
-- Returns existing booking if found, NULL if not found
CREATE OR REPLACE FUNCTION hubspot_sync.check_idempotency_key(
  p_idempotency_key TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_booking hubspot_sync.hubspot_bookings;
BEGIN
  IF p_idempotency_key IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_booking
  FROM hubspot_sync.hubspot_bookings
  WHERE idempotency_key = p_idempotency_key;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Return booking info for cached response
  RETURN jsonb_build_object(
    'found', true,
    'booking_id', v_booking.booking_id,
    'id', v_booking.id,
    'hubspot_id', v_booking.hubspot_id,
    'is_active', v_booking.is_active,
    'student_id', v_booking.student_id,
    'mock_exam_id', v_booking.mock_exam_id,
    'created_at', v_booking.created_at
  );
END;
$$ LANGUAGE plpgsql;

-- ============== PHASE 6: ATOMIC TRANSACTION FUNCTIONS ==============

-- ====================================================================
-- CAPACITY/TOTAL_BOOKINGS MANAGEMENT STRATEGY
-- ====================================================================
--
-- DECISION: MAINTAIN EXISTING ARCHITECTURE FOR total_bookings
--
-- The current architecture already works well:
--   1. Redis holds real-time counter (exam:{id}:bookings) for capacity checks
--   2. Redis counter is incremented/decremented atomically
--   3. Webhook (non-blocking) syncs Redis counter → HubSpot total_bookings
--   4. Supabase total_bookings is updated in parallel (non-blocking)
--
-- Why keep this pattern:
--   • Webhooks are already non-blocking (no impact on booking response time)
--   • Redis provides proven race condition protection
--   • No need to change a working capacity management system
--   • Supabase total_bookings is updated via updateExamBookingCountInSupabase()
--
-- The atomic functions below focus on:
--   • Booking record creation (hubspot_id = NULL initially)
--   • Credit deduction from contact
--   • total_bookings is handled separately via existing Redis + webhook pattern
-- ====================================================================

-- ====================================================================
-- IDEMPOTENCY KEY MANAGEMENT STRATEGY
-- ====================================================================
--
-- DECISION: MOVE IDEMPOTENCY CHECK TO SUPABASE (PERFORMANCE IMPROVEMENT)
--
-- Current architecture (HubSpot-based):
--   1. Generate idempotency key: SHA-256(contact_id, mock_exam_id, exam_date, mock_type, timestamp_bucket)
--   2. Search HubSpot for existing booking with matching idempotency_key (~200ms)
--   3. If found & Active → Return cached response (200)
--   4. If not found → Create booking with idempotency_key
--
-- New architecture (Supabase-first):
--   1. Same key generation logic (no change to algorithm)
--   2. Query Supabase for existing booking with matching idempotency_key (~5-10ms)
--   3. If found & Active → Return cached response (200)
--   4. If not found → Insert booking with idempotency_key (UNIQUE constraint prevents duplicates)
--   5. Batch sync cron syncs idempotency_key to HubSpot for audit
--
-- Performance improvement:
--   • HubSpot search: ~200ms → Supabase query: ~5-10ms
--   • 20x faster idempotency checks
--   • UNIQUE constraint on idempotency_key provides atomic duplicate prevention
--
-- Implementation notes:
--   • Add UNIQUE index on idempotency_key column
--   • Existing key generation logic unchanged (SHA-256 hash)
--   • 5-minute timestamp buckets still apply
--   • Cancelled/Failed bookings still get new keys (same logic)
--   • idempotency_key synced to HubSpot for audit/debugging
--
-- Edge case: Supabase unavailable
--   • Fallback to HubSpot search (slower but works)
--   • Maintains availability over strict consistency
-- ====================================================================

-- Atomic booking creation (Supabase-first for booking records only)
-- Uses existing `id` column as primary identifier
-- Uses student_id + email for contact lookup (already available at booking time)
-- Uses mock_exam_id (HubSpot ID) directly since mock exams are admin-created
-- NOTE: total_bookings is handled by existing Redis counter + webhook pattern
-- NOTE: No per-record sync tracking - batch sync cron handles HubSpot sync
CREATE OR REPLACE FUNCTION hubspot_sync.create_booking_atomic(
  p_booking_id TEXT,
  p_student_id TEXT,  -- Use student_id for contact lookup (already known)
  p_student_email TEXT,  -- Use email for contact lookup (already known)
  p_mock_exam_id TEXT,  -- HubSpot ID - mock exams are admin-created, so ID is always available
  p_student_name TEXT,
  p_token_used TEXT,
  p_attending_location TEXT,
  p_dominant_hand TEXT,
  p_idempotency_key TEXT,
  p_credit_field TEXT,
  p_new_credit_value INTEGER
)
RETURNS JSONB AS $$
DECLARE
  v_booking_uuid UUID;
  v_contact_record RECORD;
  v_exam_date DATE;
  v_result JSONB;
BEGIN
  -- Get contact record by student_id + email (for credit update and hubspot_id)
  SELECT id, hubspot_id INTO v_contact_record
  FROM hubspot_sync.hubspot_contact_credits
  WHERE student_id = p_student_id AND email = p_student_email;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contact not found for student_id: %, email: %', p_student_id, p_student_email;
  END IF;

  -- Get exam date from mock_exam (using HubSpot ID since exams are admin-created)
  SELECT exam_date INTO v_exam_date
  FROM hubspot_sync.hubspot_mock_exams
  WHERE hubspot_id = p_mock_exam_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mock exam not found: %', p_mock_exam_id;
  END IF;

  -- Generate booking UUID (uses existing UUID primary key)
  v_booking_uuid := gen_random_uuid();

  -- Insert booking (hubspot_id is NULL, will be populated by batch sync cron)
  INSERT INTO hubspot_sync.hubspot_bookings (
    id,  -- Existing UUID primary key
    hubspot_id,  -- NULL - populated by batch sync cron
    booking_id,
    student_id,  -- For contact lookup
    student_email,  -- For contact lookup
    contact_id,  -- HubSpot contact ID (for association creation)
    mock_exam_id,  -- HubSpot exam ID (always available for admin-created exams)
    student_name,
    is_active,
    token_used,
    attending_location,
    dominant_hand,
    idempotency_key,
    exam_date,
    created_at,
    synced_at
  ) VALUES (
    v_booking_uuid,
    NULL,  -- hubspot_id populated by batch sync cron
    p_booking_id,
    p_student_id,
    p_student_email,
    v_contact_record.hubspot_id,  -- May be NULL for new contacts
    p_mock_exam_id,  -- HubSpot ID - always available
    p_student_name,
    'Active',
    p_token_used,
    p_attending_location,
    p_dominant_hand,
    p_idempotency_key,
    v_exam_date,
    NOW(),
    NOW()
  );

  -- Update contact credits (batch sync cron will sync to HubSpot)
  EXECUTE format(
    'UPDATE hubspot_sync.hubspot_contact_credits
     SET %I = $1, updated_at = NOW(), synced_at = NOW()
     WHERE id = $2',
    p_credit_field
  ) USING p_new_credit_value, v_contact_record.id;

  -- NOTE: total_bookings is NOT updated here!
  -- The existing Redis counter + webhook pattern handles this:
  --   1. Redis INCR exam:{mock_exam_id}:bookings (done by API before calling this function)
  --   2. Webhook sends new count to HubSpot (non-blocking)
  --   3. updateExamBookingCountInSupabase() syncs to Supabase (non-blocking)

  -- Return result with id (the existing UUID column)
  v_result := jsonb_build_object(
    'success', true,
    'booking_id', v_booking_uuid,  -- UUID primary key
    'booking_code', p_booking_id,  -- Human-readable booking ID (BK-...)
    'contact_hubspot_id', v_contact_record.hubspot_id,
    'mock_exam_hubspot_id', p_mock_exam_id
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Atomic booking cancellation
-- Uses existing `id` column (UUID) as primary identifier
-- Uses student_id + email for contact lookup
-- NOTE: total_bookings is handled by existing Redis counter + webhook pattern
-- NOTE: No per-record sync tracking - batch sync cron handles HubSpot sync
CREATE OR REPLACE FUNCTION hubspot_sync.cancel_booking_atomic(
  p_booking_id UUID,  -- Uses existing `id` column
  p_credit_field TEXT,
  p_restored_credit_value INTEGER
)
RETURNS JSONB AS $$
DECLARE
  v_booking RECORD;
  v_contact_id UUID;
  v_result JSONB;
BEGIN
  -- Get booking details
  SELECT * INTO v_booking
  FROM hubspot_sync.hubspot_bookings
  WHERE id = p_booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found: %', p_booking_id;
  END IF;

  -- Get contact id for credit restore (using student_id + email from booking)
  SELECT id INTO v_contact_id
  FROM hubspot_sync.hubspot_contact_credits
  WHERE student_id = v_booking.student_id AND email = v_booking.student_email;

  -- Update booking status (batch sync cron will sync to HubSpot)
  UPDATE hubspot_sync.hubspot_bookings
  SET is_active = 'Cancelled',
      updated_at = NOW(),
      synced_at = NOW()
  WHERE id = p_booking_id;

  -- Restore contact credits (batch sync cron will sync to HubSpot)
  EXECUTE format(
    'UPDATE hubspot_sync.hubspot_contact_credits
     SET %I = $1, updated_at = NOW(), synced_at = NOW()
     WHERE id = $2',
    p_credit_field
  ) USING p_restored_credit_value, v_contact_id;

  -- NOTE: total_bookings is NOT decremented here!
  -- The existing Redis counter + webhook pattern handles this:
  --   1. Redis DECR exam:{mock_exam_id}:bookings (done by API before calling this function)
  --   2. Webhook sends new count to HubSpot (non-blocking)
  --   3. updateExamBookingCountInSupabase() syncs to Supabase (non-blocking)

  v_result := jsonb_build_object(
    'success', true,
    'booking_id', p_booking_id,  -- UUID primary key
    'booking_hubspot_id', v_booking.hubspot_id,
    'student_id', v_booking.student_id,
    'mock_exam_id', v_booking.mock_exam_id
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ============== PHASE 7: RPC ROLLBACK & LOGGING STRATEGY ==============

-- ====================================================================
-- HOW ROLLBACKS WORK WITH RPC (AUTOMATIC)
-- ====================================================================
--
-- PostgreSQL automatically wraps each function call in a transaction.
-- If ANY statement fails, ALL previous statements are rolled back.
--
-- Example flow for create_booking_atomic:
--   1. SELECT contact record → ✅ Success
--   2. SELECT exam date → ✅ Success
--   3. INSERT booking → ✅ Success
--   4. UPDATE credits → ❌ Fails (e.g., contact not found)
--   5. PostgreSQL automatically undoes step 3 (booking INSERT)
--   6. Function returns error to JavaScript
--
-- YOU DON'T WRITE ROLLBACK CODE - The database handles it automatically.
--
-- ====================================================================
-- HOW ERRORS PROPAGATE TO JAVASCRIPT
-- ====================================================================
--
-- When a function fails (RAISE EXCEPTION or constraint violation):
--
-- JavaScript receives:
--   {
--     data: null,
--     error: {
--       message: "Contact not found for student_id: STU123, email: test@example.com",
--       details: null,
--       hint: null,
--       code: "P0001"  -- PostgreSQL error code
--     }
--   }
--
-- Common error codes:
--   P0001 = RAISE EXCEPTION (custom errors like "Contact not found")
--   23505 = unique_violation (duplicate idempotency_key)
--   23503 = foreign_key_violation
--   23502 = not_null_violation
--
-- ====================================================================
-- LOGGING STRATEGY
-- ====================================================================
--
-- WHERE LOGS APPEAR:
-- ┌────────────────────────┬─────────────────────────────────────────────┐
-- │ Log Type               │ Location                                    │
-- ├────────────────────────┼─────────────────────────────────────────────┤
-- │ console.log (JS)       │ Vercel function logs (easy to access)       │
-- │ console.error (JS)     │ Vercel function logs (easy to access)       │
-- │ RAISE NOTICE (SQL)     │ Supabase Postgres logs (harder to access)   │
-- │ RPC error.message      │ Both - visible in JS error object           │
-- │ Audit log table        │ Supabase (queryable, permanent record)      │
-- └────────────────────────┴─────────────────────────────────────────────┘
--
-- RECOMMENDATION: Do most logging in JavaScript, not SQL
--
-- ====================================================================
-- BACKEND RPC USAGE PATTERN
-- ====================================================================
--
-- // In your API endpoint (e.g., api/user/bookings/create.js)
--
-- const { data, error } = await supabase.rpc('create_booking_atomic', {
--   p_booking_id: 'BK-20251203-ABC123',
--   p_student_id: studentId,
--   p_student_email: studentEmail,
--   p_mock_exam_id: mockExamId,
--   p_student_name: studentName,
--   p_token_used: tokenType,
--   p_attending_location: location,
--   p_dominant_hand: hand,
--   p_idempotency_key: idempotencyKey,
--   p_credit_field: creditField,
--   p_new_credit_value: newCreditValue
-- });
--
-- if (error) {
--   // Booking was NOT created - auto-rolled back
--   console.error('[BOOKING] Atomic operation failed:', {
--     error: error.message,
--     code: error.code,
--     studentId,
--     mockExamId
--   });
--
--   // Handle specific errors
--   if (error.code === '23505') {
--     return res.status(200).json({
--       success: true,
--       message: 'Duplicate request - booking already exists',
--       idempotent: true
--     });
--   }
--
--   if (error.message.includes('Contact not found')) {
--     return res.status(400).json({
--       success: false,
--       error: 'Contact not found in system'
--     });
--   }
--
--   return res.status(500).json({
--     success: false,
--     error: 'Booking failed - please try again'
--   });
-- }
--
-- // If we get here, BOTH booking AND credit update succeeded
-- console.log('[BOOKING] Created successfully:', {
--   bookingId: data.booking_id,
--   bookingCode: data.booking_code,
--   studentId
-- });
--
-- return res.status(201).json({
--   success: true,
--   booking: data
-- });
--
-- ====================================================================
-- DEBUGGING TIPS
-- ====================================================================
--
-- WHAT YOU CAN SEE:
--   ✓ Whether the operation succeeded or failed
--   ✓ Error message (e.g., "Contact not found for student_id: X")
--   ✓ PostgreSQL error code (e.g., 23505 for duplicate)
--   ✓ All your console.log output in Vercel logs
--
-- WHAT YOU CAN'T EASILY SEE:
--   ✗ Which specific line inside the SQL function failed
--   ✗ Intermediate variable values during SQL execution
--   ✗ Step-by-step trace through the function
--
-- HOW TO DEBUG WHEN THINGS GO WRONG:
--   1. Check the error.message - it usually tells you what failed
--   2. Query the database to see current state
--   3. For complex issues, run the SQL manually in Supabase SQL Editor
--   4. Add RAISE NOTICE statements temporarily (but check Supabase logs)
--
-- ====================================================================

-- ============== VERIFICATION QUERIES ==============

-- Check migration status
SELECT
  'hubspot_contact_credits' as table_name,
  COUNT(*) as total_records,
  COUNT(id) as has_id,  -- Should be 100% (existing primary key)
  COUNT(hubspot_id) as has_hubspot_id,
  COUNT(*) FILTER (WHERE hubspot_id IS NULL) as pending_hubspot_sync
FROM hubspot_sync.hubspot_contact_credits
UNION ALL
SELECT
  'hubspot_bookings',
  COUNT(*),
  COUNT(id),
  COUNT(hubspot_id),
  COUNT(*) FILTER (WHERE hubspot_id IS NULL)
FROM hubspot_sync.hubspot_bookings
UNION ALL
SELECT
  'hubspot_mock_exams',
  COUNT(*),
  COUNT(id),
  COUNT(hubspot_id),
  0  -- Mock exams always have hubspot_id (admin-created)
FROM hubspot_sync.hubspot_mock_exams;

-- Verify contact lookups work via student_id + email
SELECT b.id, b.booking_id, b.student_id, b.student_email, c.id as contact_uuid, c.hubspot_id as contact_hubspot_id
FROM hubspot_sync.hubspot_bookings b
LEFT JOIN hubspot_sync.hubspot_contact_credits c ON b.student_id = c.student_id AND b.student_email = c.email
LIMIT 10;
```

### 3.4 ID Reference Migration (Simplified in v2.3.0)

| Current Reference | New Primary Reference | Notes |
|-------------------|----------------------|-------|
| `hubspot_id` (contact) | `id` (existing UUID) | `hubspot_id` for HubSpot ops |
| `hubspot_id` (booking) | `id` (existing UUID) | `hubspot_id` for HubSpot ops |
| `hubspot_id` (exam) | `hubspot_id` (keep as-is) | Admin-created, always has HubSpot ID |
| `contact_id` in bookings | `student_id` + `email` (existing) | No new column - already available at booking time |
| `mock_exam_id` in bookings | `mock_exam_id` (existing HubSpot ID) | No new column - admin-created exams always have HubSpot ID |

---

## 4. Technical Architecture

### 4.1 Data Flow Diagrams

#### 4.1.1 Booking Creation Flow (New - Supabase First)

```
┌────────────────────────────────────────────────────────────────────────────┐
│                    BOOKING CREATION (SUPABASE-FIRST FLOW)                  │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  1. User submits booking                                                   │
│     │                                                                      │
│     ▼                                                                      │
│  2. ┌─────────────────────────────────────────────────────────────┐       │
│     │ VALIDATION (Supabase - ~50ms)                               │       │
│     │ • Get contact by student_id + email (returns id UUID)       │       │
│     │ • Check credit balance from hubspot_contact_credits         │       │
│     │ • Check exam capacity from hubspot_mock_exams (by hubspot_id)│       │
│     │ • Verify no duplicate booking (by student_id + exam_date)   │       │
│     └─────────────────────────────────────────────────────────────┘       │
│     │                                                                      │
│     ▼                                                                      │
│  3. ┌─────────────────────────────────────────────────────────────┐       │
│     │ ACQUIRE LOCKS (Redis - ~5ms)                                │       │
│     │ • User lock: user_booking:{student_id}:{exam_date}           │       │
│     │ • Session lock: exam:{mock_exam_id}                         │       │
│     └─────────────────────────────────────────────────────────────┘       │
│     │                                                                      │
│     ▼                                                                      │
│  4. ┌─────────────────────────────────────────────────────────────┐       │
│     │ ATOMIC WRITE (Supabase Transaction - ~30ms)                 │       │
│     │ SELECT hubspot_sync.create_booking_atomic(                  │       │
│     │   p_booking_id := 'BK-20251203-ABC123',                     │       │
│     │   p_student_id := 'STU123',  -- already known               │       │
│     │   p_student_email := 'student@example.com',                 │       │
│     │   p_mock_exam_id := '12345678',  -- HubSpot ID (admin-created)│       │
│     │   ...                                                       │       │
│     │ );                                                          │       │
│     │                                                             │       │
│     │ Returns: { booking_id (UUID) }                              │       │
│     │ Note: hubspot_id is NULL - populated by batch sync cron     │       │
│     └─────────────────────────────────────────────────────────────┘       │
│     │                                                                      │
│     ▼                                                                      │
│  5. ┌─────────────────────────────────────────────────────────────┐       │
│     │ RELEASE LOCKS & RESPOND (Redis + HTTP - ~10ms)              │       │
│     │ • Release Redis locks                                       │       │
│     │ • Return 201 Created to user                                │       │
│     │ • Response includes booking_id (NOT hubspot_id)             │       │
│     └─────────────────────────────────────────────────────────────┘       │
│                                                                            │
│     ════════════════════════════════════════════════════════════════      │
│      USER RESPONSE COMPLETE (~100ms total)                                │
│      HubSpot sync handled by batch cron (every 2 hours)                   │
│     ════════════════════════════════════════════════════════════════      │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

#### 4.1.2 Contact/Credit First-Time Sync Flow

```
┌────────────────────────────────────────────────────────────────────────────┐
│                     CONTACT FIRST-TIME LOGIN FLOW                          │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  User logs in with student_id + email                                      │
│     │                                                                      │
│     ▼                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐          │
│  │ SUPABASE LOOKUP (by student_id + email)                     │          │
│  │                                                             │          │
│  │ SELECT * FROM hubspot_contact_credits                       │          │
│  │ WHERE student_id = $1 AND email = $2;                       │          │
│  └─────────────────────────────────────────────────────────────┘          │
│     │                                                                      │
│     ├─── FOUND ─────────────────────────────────────────────────────┐     │
│     │                                                               │     │
│     │    Return cached credits (~50ms)                              │     │
│     │    (supabase_id is primary identifier)                        │     │
│     │                                                               │     │
│     └─── NOT FOUND ─────────────────────────────────────────────────┤     │
│                                                                     │     │
│          ┌─────────────────────────────────────────────────────────┐│     │
│          │ HUBSPOT LOOKUP (one-time per contact)                   ││     │
│          │                                                         ││     │
│          │ Search HubSpot by student_id OR email                   ││     │
│          │ Returns: hubspot_id, all credit fields                  ││     │
│          └─────────────────────────────────────────────────────────┘│     │
│               │                                                     │     │
│               ▼                                                     │     │
│          ┌─────────────────────────────────────────────────────────┐│     │
│          │ CREATE SUPABASE RECORD                                  ││     │
│          │                                                         ││     │
│          │ INSERT INTO hubspot_contact_credits (                   ││     │
│          │   id,               -- gen_random_uuid() (existing PK)  ││     │
│          │   hubspot_id,       -- From HubSpot lookup              ││     │
│          │   student_id,                                           ││     │
│          │   email,                                                ││     │
│          │   sj_credits, cs_credits, ...                           ││     │
│          │   hubspot_last_sync_at = NOW()                          ││     │
│          │ )                                                       ││     │
│          └─────────────────────────────────────────────────────────┘│     │
│                                                                     │     │
│     ◄────────────────────────────────────────────────────────────────     │
│     │                                                                      │
│     ▼                                                                      │
│  Return credits to frontend                                               │
│  (Frontend uses id (UUID) for all subsequent operations)                  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

#### 4.1.3 HubSpot Batch Sync Cron (Every 2 Hours)

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

## 5. Detailed Design

### 5.1 Files to Modify

#### 5.1.1 User Root - Booking Creation

**File: `user_root/api/bookings/create.js`**

| Change | Current | New |
|--------|---------|-----|
| Contact lookup | By hubspot_id | By id (UUID) via student_id + email |
| Booking creation | HubSpot first | Supabase first (hubspot_id = NULL) |
| Credit deduction | HubSpot blocking | Supabase blocking |
| HubSpot sync | N/A | Batch cron (every 2 hours) |
| Response ID | hubspot_id | booking_id (id UUID available) |

#### 5.1.2 User Root - Credit Validation

**File: `user_root/api/mock-exams/validate-credits.js`**

| Change | Current | New |
|--------|---------|-----|
| Lookup method | student_id + email → Supabase → HubSpot fallback | student_id + email → Supabase ONLY |
| Return ID | hubspot_id | id (existing UUID) |
| HubSpot fallback | Yes | No (Supabase is authoritative) |

#### 5.1.3 User Root - Booking Cancellation

**File: `user_root/api/bookings/[id].js`**

| Change | Current | New |
|--------|---------|-----|
| Booking lookup | By hubspot_id | By booking_id or id (UUID) |
| Credit restore | HubSpot blocking | Supabase blocking |
| HubSpot sync | Blocking | Background |

### 5.2 New Files to Create

| File Path | Purpose |
|-----------|---------|
| `user_root/api/_shared/supabase-transactions.js` | Atomic transaction wrappers |
| `admin_root/api/admin/cron/batch-sync-hubspot.js` | Batch sync cron (every 2 hours) |

### 5.3 API Response Changes

#### 5.3.1 Booking Creation Response

```javascript
// CURRENT Response
{
  success: true,
  data: {
    booking_id: "BK-20251203-ABC123",
    booking_record_id: "123456789",  // ← This is hubspot_id
    ...
  }
}

// NEW Response (Supabase-first)
{
  success: true,
  data: {
    booking_id: "BK-20251203-ABC123",
    booking_record_id: "BK-20251203-ABC123",  // ← Use booking_id, not hubspot_id
    id: "uuid-...",  // ← Existing UUID primary key
    // hubspot_id is NOT returned (may not exist yet - populated by batch cron)
    ...
  }
}
```

#### 5.3.2 Credit Validation Response

```javascript
// CURRENT Response
{
  success: true,
  data: {
    contact_id: "123456789",  // ← hubspot_id
    ...
  }
}

// NEW Response
{
  success: true,
  data: {
    contact_id: "uuid-...",  // ← existing id (UUID)
    // hubspot_id NOT returned to frontend
    ...
  }
}
```

---

## 6. Migration Strategy

### 6.1 Migration Phases

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          MIGRATION PHASES (REVISED)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Phase 1: Schema Migration (Day 1-2)                                        │
│  ├─ Make hubspot_id NULLABLE (except mock_exams)                           │
│  ├─ Add hubspot_last_sync_at column (audit only, no status tracking)       │
│  ├─ Create atomic transaction functions                                    │
│  ├─ Initialize hubspot_last_sync_at for existing records                   │
│  ├─ Note: No new supabase_id needed - using existing `id` column           │
│  └─ Note: No new columns for contact/exam refs - use student_id/mock_exam_id│
│                                                                             │
│  Phase 2: Read Migration (Day 3-4)                                         │
│  ├─ Update credit validation to return id (UUID)                           │
│  ├─ Update booking lookup to use id (UUID)                                 │
│  ├─ Remove HubSpot fallback from read operations                           │
│  ├─ Update frontend to use id (if displayed)                               │
│  └─ Verify all reads work with existing id column                          │
│                                                                             │
│  Phase 3: Write Migration (Day 5-7)                                        │
│  ├─ Implement batch sync cron job                                          │
│  ├─ Update booking creation to use Supabase transaction                    │
│  ├─ Update booking cancellation to use Supabase transaction                │
│  ├─ Test with hubspot_id = NULL scenarios                                  │
│  └─ Verify batch cron correctly syncs all records to HubSpot               │
│                                                                             │
│  Phase 4: Cron Jobs & Monitoring (Day 8-10)                                │
│  ├─ Deploy batch-sync-hubspot cron (every 2 hours)                         │
│  ├─ Set up Vercel cron monitoring                                          │
│  ├─ Create admin dashboard for sync audit (hubspot_last_sync_at)           │
│  └─ Document runbooks for manual sync if needed                            │
│                                                                             │
│  Phase 5: Cleanup (Day 11-14)                                              │
│  ├─ Remove legacy hubspot_id dependencies from code                        │
│  ├─ Update CLAUDE.md with new architecture                                 │
│  ├─ Update API documentation                                               │
│  └─ Archive old implementation patterns                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Feature Flags

```javascript
// config/feature-flags.js

const MIGRATION_FLAGS = {
  // Phase 2: Read from Supabase only (no HubSpot fallback)
  SUPABASE_ONLY_READ: process.env.FF_SUPABASE_ONLY_READ === 'true',

  // Phase 3: Write to Supabase first
  SUPABASE_PRIMARY_WRITE: process.env.FF_SUPABASE_PRIMARY_WRITE === 'true',

  // Phase 3: Background HubSpot sync
  HUBSPOT_BACKGROUND_SYNC: process.env.FF_HUBSPOT_BACKGROUND_SYNC === 'true',

  // Rollback flag - revert to HubSpot-first
  HUBSPOT_SOURCE_OF_TRUTH: process.env.FF_HUBSPOT_SOURCE_OF_TRUTH === 'true',

  // Use existing id (UUID) as primary identifier
  USE_UUID_PRIMARY: process.env.FF_USE_UUID_PRIMARY === 'true'
};

module.exports = { MIGRATION_FLAGS };
```

---

## 7. Implementation Plan

### 7.1 Sprint Breakdown

| Sprint | Duration | Deliverables |
|--------|----------|--------------|
| **Sprint 1** | 2 days | Schema migration (Dual-ID System) |
| **Sprint 2** | 2 days | Read migration, remove HubSpot fallback |
| **Sprint 3** | 3 days | Write migration, batch sync cron |
| **Sprint 4** | 3 days | Monitoring, cleanup |

### 7.2 Task List

#### Sprint 1: Schema Migration

- [ ] Run schema migration SQL in Supabase
- [ ] Verify hubspot_id is nullable (except mock_exams)
- [ ] Verify hubspot_last_sync_at column added (audit only)
- [ ] Initialize hubspot_last_sync_at for existing records
- [ ] Test helper functions (get_contact_credits, get_booking)
- [ ] Test atomic transaction functions
- [ ] Verify student_id + email can lookup contacts in bookings
- [ ] Verify mock_exam_id (HubSpot ID) works for exam lookups

#### Sprint 2: Read Migration

- [ ] Update `validate-credits.js` to return id (UUID)
- [ ] Update `user/login.js` to return id (UUID)
- [ ] Remove HubSpot fallback from credit validation
- [ ] Update booking lookup to accept id (UUID) or booking_id
- [ ] Update frontend credit display (if showing IDs)
- [ ] Deploy with `SUPABASE_ONLY_READ=true`

#### Sprint 3: Write Migration

- [ ] Create `batch-sync-hubspot.js` cron job
- [ ] Create `supabase-transactions.js` wrappers
- [ ] Update `create.js` to use Supabase atomic transaction
- [ ] Update `[id].js` cancellation to use Supabase atomic transaction
- [ ] Test booking creation with hubspot_id = NULL
- [ ] Verify batch cron correctly syncs all records to HubSpot
- [ ] Deploy with `SUPABASE_PRIMARY_WRITE=true`

#### Sprint 4: Monitoring & Cleanup

- [ ] Set up Vercel cron schedule (every 2 hours)
- [ ] Create admin dashboard for sync audit (hubspot_last_sync_at)
- [ ] Document runbooks for manual sync if needed
- [ ] Update CLAUDE.md with new architecture
- [ ] Update API documentation

---

## 8. Risk Assessment

### 8.1 Risk Matrix

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Schema migration fails** | Low | Critical | Test in staging first, backup data |
| **Batch sync cron fails** | Low | Medium | Vercel monitoring, manual trigger available |
| **Supabase downtime** | Low | Critical | Health checks, graceful degradation |
| **HubSpot sync delay (2 hours)** | Expected | Low | Acceptable for audit purposes |
| **Frontend breaks on ID change** | Low | High | Feature flags, gradual rollout |
| **Data drift between systems** | Low | Medium | Batch sync overwrites HubSpot with Supabase data |

### 8.2 Mitigation: Graceful Degradation

```javascript
// If Supabase is unavailable, temporarily fall back to HubSpot
async function getCreditsWithFallback(studentId, email) {
  try {
    return await getCreditsFromSupabase(studentId, email);
  } catch (error) {
    if (MIGRATION_FLAGS.HUBSPOT_SOURCE_OF_TRUTH) {
      console.warn('[FALLBACK] Supabase unavailable, using HubSpot');
      return await getCreditsFromHubSpot(studentId, email);
    }
    throw error;
  }
}
```

---

## 9. Testing Strategy

### 9.1 Test Scenarios

#### 9.1.1 New Booking (No HubSpot ID Yet)

```javascript
describe('Supabase-First Booking Creation', () => {
  it('should create booking with NULL hubspot_id', async () => {
    const response = await createBooking(validData);

    expect(response.status).toBe(201);
    expect(response.data.booking_id).toBeDefined();
    expect(response.data.id).toBeDefined();  // Existing UUID column

    // Verify Supabase record
    const booking = await getBookingFromSupabase(response.data.id);
    expect(booking.hubspot_id).toBeNull();
    expect(booking.hubspot_sync_status).toBe('pending');

    // Wait for background sync
    await sleep(5000);

    // Verify HubSpot ID populated
    const updatedBooking = await getBookingFromSupabase(response.data.id);
    expect(updatedBooking.hubspot_id).toBeDefined();
    expect(updatedBooking.hubspot_sync_status).toBe('synced');
  });
});
```

#### 9.1.2 Contact Without HubSpot ID

```javascript
describe('New Contact Credit Operations', () => {
  it('should handle contact with NULL hubspot_id', async () => {
    // Create contact in Supabase only
    const contact = await createContactInSupabase({
      // id is auto-generated by gen_random_uuid()
      hubspot_id: null,  // Not synced yet
      student_id: 'TEST001',
      email: 'test@example.com',
      sj_credits: 5
    });

    // Credit validation should work
    const credits = await validateCredits('TEST001', 'test@example.com');
    expect(credits.sj_credits).toBe(5);

    // Booking should work (with NULL contact hubspot_id)
    const booking = await createBooking({
      contact_id: contact.id,  // Uses existing id column
      ...
    });
    expect(booking.success).toBe(true);
  });
});
```

---

## 10. Rollback Plan

### 10.1 Rollback Triggers

| Trigger | Threshold | Action |
|---------|-----------|--------|
| Booking failure rate | >5% | Immediate rollback |
| HubSpot sync abandoned rate | >10% | Investigation + possible rollback |
| Data inconsistency | >1% | Investigation + reconciliation |
| Supabase unavailability | >5 minutes | Enable HubSpot fallback |

### 10.2 Rollback Procedure

```bash
# 1. Set rollback feature flag
vercel env add FF_HUBSPOT_SOURCE_OF_TRUTH true --environment production

# 2. Disable Supabase-first writes
vercel env add FF_SUPABASE_PRIMARY_WRITE false --environment production

# 3. Deploy
vercel --prod

# 4. Run reconciliation (sync any pending Supabase records to HubSpot)
curl -X POST https://production.example.com/api/admin/cron/reconcile-hubspot \
  -H "Authorization: Bearer $CRON_SECRET"
```

---

## 11. Success Metrics

### 11.1 Key Performance Indicators

| KPI | Baseline | Target | Measurement |
|-----|----------|--------|-------------|
| **Booking Response Time (P95)** | 800ms | <200ms | Vercel Analytics |
| **Credit Validation Time (P95)** | 450ms | <100ms | API Logging |
| **Batch Sync Cron Success Rate** | N/A | >99% | Vercel cron logs |
| **Records Awaiting HubSpot ID** | N/A | <50 at any time | Monitoring query |
| **Concurrent User Capacity** | ~100 | 2,000+ | Load testing |
| **Data Consistency Rate** | 100% | 99.9% | Batch sync comparison |

### 11.2 Monitoring Queries

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

## Appendices

### A. Glossary

| Term | Definition |
|------|------------|
| **id** | Existing UUID primary key, used as primary identifier for all operations |
| **hubspot_id** | External ID from HubSpot, populated by batch sync cron (now nullable for contacts/bookings) |
| **Dual-ID System** | Architecture using existing `id` (UUID) for local ops, `hubspot_id` synced later |
| **Batch Sync** | Cron job that syncs ALL records to HubSpot every 2 hours (no per-record tracking) |
| **hubspot_last_sync_at** | Audit timestamp showing when record was last synced to HubSpot |
| **student_id** | Existing column in bookings used for contact lookup (no new UUID column needed) |
| **mock_exam_id** | Existing column in bookings containing HubSpot exam ID (admin-created, always available) |
| **idempotency_key** | SHA-256 hash preventing duplicate bookings; checked in Supabase (~5ms) vs HubSpot (~200ms) |
| **RPC (Remote Procedure Call)** | Calling SQL functions from JavaScript via `supabase.rpc()`; provides automatic transaction rollback with error visibility in JS |

### B. Schema Summary

| Table | Primary ID | External ID | hubspot_id Nullable |
|-------|-----------|-------------|---------------------|
| hubspot_contact_credits | id (UUID) | hubspot_id (TEXT) | Yes |
| hubspot_bookings | id (UUID) | hubspot_id (TEXT) | Yes |
| hubspot_mock_exams | id (UUID) | hubspot_id (TEXT) | No* |

*Mock exams are created in HubSpot first (admin creates them), so hubspot_id is always present.

### C. Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-12-03 | Introduce Dual-ID System | hubspot_id NOT NULL constraint blocks Supabase-first writes |
| 2025-12-03 | Use existing `id` column as primary | Tables already have UUID PKs - no new column needed |
| 2025-12-03 | Keep hubspot_id NOT NULL for mock_exams | Exams are created in HubSpot by admin |
| 2025-12-03 | Return booking_id instead of hubspot_id | Frontend doesn't need HubSpot reference |
| 2025-12-04 | Remove redundant supabase_id column | Existing `id` column serves same purpose |
| 2025-12-04 | Switch to batch sync strategy | Per-record sync tracking doesn't work for high-frequency data changes; batch sync is simpler and more reliable |
| 2025-12-04 | Remove sync tracking columns | hubspot_sync_status, hubspot_sync_attempts, hubspot_last_sync_error removed; keep only hubspot_last_sync_at for audit |
| 2025-12-04 | 2-hour batch sync interval | Balances HubSpot audit freshness with API rate limit efficiency |
| 2025-12-04 | Use student_id instead of contact_uuid | student_id + email already exist in bookings and are known at booking time; no new column needed |
| 2025-12-04 | Keep mock_exam_id (HubSpot ID) | Mock exams are admin-created in HubSpot first, so HubSpot ID is always available; no new column needed |
| 2025-12-04 | Maintain existing total_bookings architecture | Redis counter + webhook pattern is already non-blocking; no need to change working capacity management; Supabase synced via updateExamBookingCountInSupabase() |
| 2025-12-04 | Move idempotency check to Supabase | 20x faster (~5ms vs ~200ms HubSpot search); UNIQUE index on idempotency_key for atomic duplicate prevention; same key generation algorithm; fallback to HubSpot if Supabase unavailable |
| 2025-12-04 | Use RPC approach for atomic operations | PostgreSQL handles rollback automatically; errors propagate to JavaScript with message + code; logging in JS (Vercel logs) not SQL; balance of atomicity guarantee + debugging simplicity |

---

## Sign-Off

| Role | Name | Date | Approval |
|------|------|------|----------|
| **Product Owner** | | | [ ] Approved |
| **Tech Lead** | | | [ ] Approved |
| **Security** | | | [ ] Approved |
| **DevOps** | | | [ ] Approved |

---

*PRD Version: 2.3.0*
*Last Updated: December 4, 2025*
*Confidence Score: 9/10*
