# Database Schema Migration - Dual-ID System

## Overview

| Field | Value |
|-------|-------|
| **Phase** | Sprint 1 (Day 1-2) |
| **Prerequisites** | Supabase access, backup completed |
| **Related Docs** | [00-overview.md](./00-overview.md), [02-rpc-atomic-functions.md](./02-rpc-atomic-functions.md) |

---

## The Problem: HubSpot ID Dependency

Current schema constraints that **block Supabase-first writes**:

```sql
-- Current: hubspot_id is required
CREATE TABLE hubspot_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),  -- Already exists
  hubspot_id TEXT UNIQUE NOT NULL,  -- Can't INSERT without HubSpot
  ...
);

CREATE TABLE hubspot_contact_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),  -- Already exists
  hubspot_id TEXT UNIQUE NOT NULL,  -- Can't INSERT without HubSpot
  student_id TEXT NOT NULL,
  email TEXT NOT NULL,
  ...
);

CREATE TABLE hubspot_mock_exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),  -- Already exists
  hubspot_id TEXT UNIQUE NOT NULL,  -- Can't INSERT without HubSpot
  ...
);
```

---

## The Solution: Dual-ID System

**Key Insight**: Tables already have `id UUID PRIMARY KEY` - we don't need a new column. We only need to:
1. Make `hubspot_id` nullable
2. Add `hubspot_last_sync_at` for audit purposes only

```sql
-- SOLUTION: Use existing id (UUID) as primary, make hubspot_id nullable
CREATE TABLE hubspot_bookings (
  -- Primary Identifier (ALREADY EXISTS - no change needed)
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- External Identifier (CHANGE: make nullable)
  hubspot_id TEXT UNIQUE,  -- NULLABLE - populated by batch sync cron

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

**Simplification** (v2.3.0):
- **Contact reference**: Use existing `student_id` + `email` columns (already known at booking time) instead of adding `contact_uuid`
- **Mock exam reference**: Keep existing `mock_exam_id` (HubSpot ID) since mock exams are admin-created in HubSpot first

**Batch Sync Strategy**: Rather than tracking sync status per-record (`pending`, `failed`, etc.), cron jobs perform full dataset batch sync every 2 hours. This is simpler and more reliable for high-frequency data changes.

---

## Complete Schema Migration SQL

Run this in Supabase SQL Editor:

```sql
-- ============================================================================
-- SCHEMA MIGRATION: Dual-ID System for Supabase-First Architecture
-- Run in Supabase SQL Editor
-- ============================================================================

-- ============== PHASE 1: MODIFY TABLES ==============

-- 1.1 hubspot_contact_credits - Make hubspot_id nullable

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

ALTER TABLE hubspot_sync.hubspot_mock_exams
  ADD COLUMN IF NOT EXISTS hubspot_last_sync_at TIMESTAMPTZ;

-- ============== PHASE 2: INITIALIZE AUDIT TIMESTAMPS ==============

-- Set hubspot_last_sync_at for existing records (they were synced when created)
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

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ EXISTING INDEXES (DO NOT CREATE - Already in database)                      │
-- ├─────────────────────────────────────────────────────────────────────────────┤
-- │ hubspot_bookings:                                                           │
-- │   • hubspot_bookings_pkey (id) - PRIMARY KEY                                │
-- │   • hubspot_bookings_hubspot_id_key (hubspot_id) - UNIQUE                   │
-- │   • hubspot_bookings_idempotency_key_key (idempotency_key) - UNIQUE         │
-- │   • idx_bookings_hubspot_id (hubspot_id)                                    │
-- │   • idx_bookings_contact_id (associated_contact_id)                         │
-- │   • idx_bookings_exam_id (associated_mock_exam)                             │
-- │                                                                             │
-- │ hubspot_contact_credits:                                                    │
-- │   • hubspot_contact_credits_pkey (id) - PRIMARY KEY                         │
-- │   • hubspot_contact_credits_hubspot_id_key (hubspot_id) - UNIQUE            │
-- │   • idx_hubspot_id (hubspot_id)                                             │
-- │   • idx_student_id (student_id)                                             │
-- │   • idx_email (email)                                                       │
-- │   • idx_synced_at (synced_at)                                               │
-- │   • unique_student_email (student_id, email) - UNIQUE                       │
-- │                                                                             │
-- │ hubspot_mock_exams:                                                         │
-- │   • hubspot_mock_exams_pkey (id) - PRIMARY KEY                              │
-- │   • hubspot_mock_exams_hubspot_id_key (hubspot_id) - UNIQUE                 │
-- │   • idx_exams_hubspot_id (hubspot_id)                                       │
-- │   • idx_exams_active (is_active)                                            │
-- │   • idx_exams_date (exam_date)                                              │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- NEW INDEXES TO CREATE:

-- Index for booking lookup by student_id (for contact reference)
-- Note: idx_student_id exists on hubspot_contact_credits, but NOT on hubspot_bookings
CREATE INDEX IF NOT EXISTS idx_bookings_student_id
  ON hubspot_sync.hubspot_bookings(student_id);

-- Index for booking lookup by student_email (for contact reference)
CREATE INDEX IF NOT EXISTS idx_bookings_student_email
  ON hubspot_sync.hubspot_bookings(student_email);

-- Partial index for records needing HubSpot ID (batch sync targets)
-- These are new - partial indexes for efficient batch sync queries
CREATE INDEX IF NOT EXISTS idx_contact_credits_no_hubspot_id
  ON hubspot_sync.hubspot_contact_credits(id)
  WHERE hubspot_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_no_hubspot_id
  ON hubspot_sync.hubspot_bookings(id)
  WHERE hubspot_id IS NULL;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ IDEMPOTENCY KEY INDEX - ALREADY EXISTS!                                     │
-- ├─────────────────────────────────────────────────────────────────────────────┤
-- │ Existing: hubspot_bookings_idempotency_key_key                              │
-- │ Definition: UNIQUE INDEX ON hubspot_bookings(idempotency_key)               │
-- │                                                                             │
-- │ This ALREADY provides duplicate prevention for idempotency checks.          │
-- │ No additional index needed.                                                 │
-- │                                                                             │
-- │ Note: The existing index is a FULL unique index (not partial).              │
-- │ This means NULL values are allowed but only ONE NULL is permitted.          │
-- │ This should work fine since idempotency_key is always populated for         │
-- │ Active bookings.                                                            │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- ============== PHASE 4: CREATE AUDIT LOG TABLE ==============

CREATE TABLE IF NOT EXISTS hubspot_sync.supabase_audit_log (
  id BIGSERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,  -- References the existing `id` column
  record_hubspot_id TEXT,
  operation TEXT NOT NULL,  -- INSERT, UPDATE, DELETE
  changed_fields JSONB,
  old_values JSONB,
  new_values JSONB,
  performed_by TEXT,
  performed_at TIMESTAMPTZ DEFAULT NOW(),
  synced_to_hubspot_at TIMESTAMPTZ  -- Populated by batch sync cron
);

CREATE INDEX IF NOT EXISTS idx_audit_log_table_record
  ON hubspot_sync.supabase_audit_log(table_name, record_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_pending_sync
  ON hubspot_sync.supabase_audit_log(id)
  WHERE synced_to_hubspot_at IS NULL;
```

---

## Helper Functions

```sql
-- ============== PHASE 5: CREATE HELPER FUNCTIONS ==============

-- Function to get contact credits (supports student_id + email lookup)
CREATE OR REPLACE FUNCTION hubspot_sync.get_contact_credits(
  p_student_id TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_id UUID DEFAULT NULL,
  p_hubspot_id TEXT DEFAULT NULL
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
    RAISE EXCEPTION 'Must provide id, hubspot_id, or (student_id AND email)';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to get booking (supports multiple lookup methods)
CREATE OR REPLACE FUNCTION hubspot_sync.get_booking(
  p_id UUID DEFAULT NULL,
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
```

---

## Verification Queries

Run these after migration to verify success:

```sql
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

-- Check that new columns exist
SELECT column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_schema = 'hubspot_sync'
  AND table_name IN ('hubspot_contact_credits', 'hubspot_bookings', 'hubspot_mock_exams')
  AND column_name IN ('hubspot_id', 'hubspot_last_sync_at')
ORDER BY table_name, column_name;
```

---

## ID Reference Migration

| Current Reference | New Primary Reference | Notes |
|-------------------|----------------------|-------|
| `hubspot_id` (contact) | `id` (existing UUID) | `hubspot_id` for HubSpot ops |
| `hubspot_id` (booking) | `id` (existing UUID) | `hubspot_id` for HubSpot ops |
| `hubspot_id` (exam) | `hubspot_id` (keep as-is) | Admin-created, always has HubSpot ID |
| `contact_id` in bookings | `student_id` + `email` (existing) | No new column needed |
| `mock_exam_id` in bookings | `mock_exam_id` (existing HubSpot ID) | No new column needed |

---

## Sprint 1 Checklist

- [ ] Backup Supabase database
- [ ] Run schema migration SQL in Supabase
- [ ] Verify hubspot_id is nullable (except mock_exams)
- [ ] Verify hubspot_last_sync_at column added (audit only)
- [ ] Initialize hubspot_last_sync_at for existing records
- [ ] Test helper functions (get_contact_credits, get_booking)
- [ ] Verify student_id + email can lookup contacts in bookings
- [ ] Verify mock_exam_id (HubSpot ID) works for exam lookups
- [ ] Run verification queries
- [ ] Document any issues encountered

---

## Rollback SQL

If migration needs to be reverted:

```sql
-- WARNING: Only run if rollback is needed

-- Revert hubspot_id to NOT NULL (will fail if any NULL values exist)
-- First, you must sync all NULL hubspot_ids before running this

ALTER TABLE hubspot_sync.hubspot_contact_credits
  ALTER COLUMN hubspot_id SET NOT NULL;

ALTER TABLE hubspot_sync.hubspot_bookings
  ALTER COLUMN hubspot_id SET NOT NULL;

-- Drop new columns
ALTER TABLE hubspot_sync.hubspot_contact_credits
  DROP COLUMN IF EXISTS hubspot_last_sync_at;

ALTER TABLE hubspot_sync.hubspot_bookings
  DROP COLUMN IF EXISTS hubspot_last_sync_at;

ALTER TABLE hubspot_sync.hubspot_mock_exams
  DROP COLUMN IF EXISTS hubspot_last_sync_at;

-- Drop audit table
DROP TABLE IF EXISTS hubspot_sync.supabase_audit_log;
```

---

*Next: [02-rpc-atomic-functions.md](./02-rpc-atomic-functions.md)*
