# Supabase as Source of Truth - Migration Overview

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

## Related Documents

This overview links to all migration phase documents:

| Document | Description | Status |
|----------|-------------|--------|
| [01-database-schema-migration.md](./01-database-schema-migration.md) | Schema changes, Dual-ID system, indexes | Sprint 1 |
| [02-rpc-atomic-functions.md](./02-rpc-atomic-functions.md) | PostgreSQL atomic functions, RPC patterns | Sprint 1 |
| [03-backend-api-migration.md](./03-backend-api-migration.md) | API endpoint changes, feature flags | Sprint 2-3 |
| [04-cron-batch-sync.md](./04-cron-batch-sync.md) | Batch sync cron job implementation | Sprint 3-4 |
| [05-frontend-changes.md](./05-frontend-changes.md) | Frontend ID handling changes | Sprint 2 |
| [06-testing-rollback.md](./06-testing-rollback.md) | Testing strategy and rollback procedures | All Sprints |

---

## Executive Summary

This migration shifts from **HubSpot as the single source of truth** to **Supabase as the primary data store** for real-time operations. HubSpot remains as a secondary system for auditing, compliance, and CRM workflows.

### Problem Statement

The current architecture uses HubSpot as the source of truth for all credit operations. This creates significant performance bottlenecks:

- **Rate Limiting**: HubSpot API limit of 100 requests/10 seconds
- **Response Latency**: ~500ms per HubSpot API call vs ~50ms for Supabase
- **Scalability Issues**: 200 concurrent users would take 13+ minutes to process bookings
- **Blocking Operations**: Credit deductions block user responses

### Critical Schema Constraint

The current Supabase schema has `hubspot_id` as `NOT NULL` on all tables, which **requires HubSpot to create records first**. This PRD introduces a **Dual-ID System** to resolve this:

- **Local ID (`id`)**: Existing UUID primary key, used for all internal operations
- **External ID (`hubspot_id`)**: Made nullable, populated asynchronously after HubSpot sync completes

### Proposed Solution

Flip the architecture to use Supabase for all real-time read/write operations while maintaining HubSpot as a background audit system:

- **Supabase**: Source of truth for credits, bookings, and availability
- **HubSpot**: Background sync via cron jobs for auditing and CRM workflows
- **Dual-ID System**: Existing `id` (UUID) for immediate operations, `hubspot_id` synced later
- **Batch Sync Strategy**: Cron jobs perform full dataset sync every 2 hours (no per-record tracking)

---

## Expected Outcomes

| Metric | Current | Target | Improvement |
|--------|---------|--------|-------------|
| Booking Response Time | ~800ms | ~150ms | 81% faster |
| Concurrent User Capacity | ~100 users | ~2,000 users | 20x increase |
| HubSpot API Calls (blocking) | 6.5/booking | 0/booking | 100% reduction |
| Credit Validation Time | ~450ms | ~50ms | 89% faster |

---

## Architecture Comparison

### Current Architecture (HubSpot as Source of Truth)

```
User Request
     │
     ▼
┌─────────┐     BLOCKING      ┌──────────┐
│ Vercel  │ ─────────────────▶│ HubSpot  │ (Source of Truth)
│   API   │◀───────────────── │   API    │
└────┬────┘     ~500ms        └──────────┘
     │
     │ NON-BLOCKING
     ▼
┌─────────┐
│Supabase │ (Read Cache Only)
└─────────┘

Problems:
• HubSpot rate limit: 100 req/10s
• Blocking API calls add ~800ms latency
• 200 concurrent users = 13+ minute queue
• Credit updates block user response
• hubspot_id required before Supabase INSERT
```

### Proposed Architecture (Supabase as Source of Truth)

```
User Request
     │
     ▼
┌─────────┐     BLOCKING      ┌──────────┐
│ Vercel  │ ─────────────────▶│ Supabase │ (Source of Truth)
│   API   │◀───────────────── │    DB    │
└────┬────┘     ~50ms         └────┬─────┘
     │                              │
     │                              │ id (UUID, immediate)
     │                              │ hubspot_id = NULL (pending)
     │                              │
     │ NON-BLOCKING                 │
     ▼                              ▼
┌─────────┐     BATCH SYNC    ┌──────────┐
│  Cron   │ ─────────────────▶│ HubSpot  │ (Audit/CRM)
│  Job    │  (every 2 hours)  │   API    │
└─────────┘                   └──────────┘
```

---

## Systems Affected

| System | Current Role | New Role | Changes Required |
|--------|--------------|----------|------------------|
| **Supabase** | Read cache | Source of truth | Schema migration (make hubspot_id nullable) |
| **HubSpot** | Source of truth | Audit/CRM | Background sync only |
| **Redis** | Locking & counters | Locking & counters | Use existing `id` for keys |
| **Vercel API** | Orchestration | Orchestration | Major refactoring |
| **Frontend** | Consumer | Consumer | Minor changes (use existing `id`) |

---

## Goals & Non-Goals

### Goals

1. **G1**: Eliminate HubSpot as a blocking dependency for user-facing operations
2. **G2**: Reduce booking response time from ~800ms to <200ms
3. **G3**: Support 2,000+ concurrent users without rate limiting
4. **G4**: Maintain HubSpot data integrity for auditing and CRM workflows
5. **G5**: Enable sub-second credit validation for all operations
6. **G6**: Zero data loss during architectural transition
7. **G7**: Decouple record creation from HubSpot ID dependency

### Non-Goals

1. **NG1**: Removing HubSpot entirely (it remains for auditing/CRM)
2. **NG2**: Changing frontend architecture or state management
3. **NG3**: Modifying HubSpot object schemas or properties
4. **NG4**: Real-time bi-directional sync (Supabase → HubSpot is async)
5. **NG5**: Replacing Redis for locking mechanisms

---

## Success Criteria

| Criteria | Threshold | Measurement |
|----------|-----------|-------------|
| Booking Response Time | < 200ms P95 | Vercel analytics |
| Credit Validation Time | < 100ms P95 | API logging |
| HubSpot Sync Lag | < 2 hours | Batch sync cron |
| Data Consistency | 99.9% | Audit reports |
| Zero Downtime Migration | 100% | Monitoring |
| HubSpot ID Population | 99% within 2 hours | Batch sync cron |

---

## Migration Timeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          MIGRATION PHASES                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Phase 1: Schema Migration (Day 1-2)                                        │
│  ├─ Make hubspot_id NULLABLE (except mock_exams)                           │
│  ├─ Add hubspot_last_sync_at column (audit only)                           │
│  ├─ Create atomic transaction functions                                    │
│  └─ Initialize hubspot_last_sync_at for existing records                   │
│                                                                             │
│  Phase 2: Read Migration (Day 3-4)                                         │
│  ├─ Update credit validation to return id (UUID)                           │
│  ├─ Update booking lookup to use id (UUID)                                 │
│  ├─ Remove HubSpot fallback from read operations                           │
│  └─ Update frontend to use id (if displayed)                               │
│                                                                             │
│  Phase 3: Write Migration (Day 5-7)                                        │
│  ├─ Implement batch sync cron job                                          │
│  ├─ Update booking creation to use Supabase transaction                    │
│  └─ Update booking cancellation to use Supabase transaction                │
│                                                                             │
│  Phase 4: Cron Jobs & Monitoring (Day 8-10)                                │
│  ├─ Deploy batch-sync-hubspot cron (every 2 hours)                         │
│  ├─ Set up Vercel cron monitoring                                          │
│  └─ Create admin dashboard for sync audit                                  │
│                                                                             │
│  Phase 5: Cleanup (Day 11-14)                                              │
│  ├─ Remove legacy hubspot_id dependencies from code                        │
│  ├─ Update CLAUDE.md with new architecture                                 │
│  └─ Update API documentation                                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-12-03 | Introduce Dual-ID System | hubspot_id NOT NULL constraint blocks Supabase-first writes |
| 2025-12-03 | Use existing `id` column as primary | Tables already have UUID PKs - no new column needed |
| 2025-12-03 | Keep hubspot_id NOT NULL for mock_exams | Exams are created in HubSpot by admin |
| 2025-12-03 | Return booking_id instead of hubspot_id | Frontend doesn't need HubSpot reference |
| 2025-12-04 | Remove redundant supabase_id column | Existing `id` column serves same purpose |
| 2025-12-04 | Switch to batch sync strategy | Per-record sync tracking doesn't work for high-frequency data changes |
| 2025-12-04 | 2-hour batch sync interval | Balances HubSpot audit freshness with API rate limit efficiency |
| 2025-12-04 | Use student_id instead of contact_uuid | student_id + email already exist - no new column needed |
| 2025-12-04 | Keep mock_exam_id (HubSpot ID) | Mock exams are admin-created, HubSpot ID always available |
| 2025-12-04 | Maintain existing total_bookings architecture | Redis counter + webhook pattern already works |
| 2025-12-04 | Move idempotency check to Supabase | 20x faster (~5ms vs ~200ms HubSpot search) |
| 2025-12-04 | Use RPC approach for atomic operations | PostgreSQL handles rollback automatically |

---

## Glossary

| Term | Definition |
|------|------------|
| **id** | Existing UUID primary key, used as primary identifier for all operations |
| **hubspot_id** | External ID from HubSpot, populated by batch sync cron (now nullable) |
| **Dual-ID System** | Architecture using existing `id` (UUID) for local ops, `hubspot_id` synced later |
| **Batch Sync** | Cron job that syncs ALL records to HubSpot every 2 hours |
| **hubspot_last_sync_at** | Audit timestamp showing when record was last synced to HubSpot |
| **RPC (Remote Procedure Call)** | Calling SQL functions from JavaScript via `supabase.rpc()` |

---

## Schema Summary

| Table | Primary ID | External ID | hubspot_id Nullable |
|-------|-----------|-------------|---------------------|
| hubspot_contact_credits | id (UUID) | hubspot_id (TEXT) | Yes |
| hubspot_bookings | id (UUID) | hubspot_id (TEXT) | Yes |
| hubspot_mock_exams | id (UUID) | hubspot_id (TEXT) | No* |

*Mock exams are created in HubSpot first (admin creates them), so hubspot_id is always present.

---

*PRD Version: 2.3.0*
*Last Updated: December 4, 2025*
