# PRD: Database Migration — Supabase to AWS RDS with Prisma ORM

**Phase:** 3 (per `migration-checklist.md`)
**Priority:** High
**Risk Level:** High
**Estimated Duration:** 2-3 weeks
**Prerequisites:** Phase 1 (Express.js conversion) complete, Phase 2 (Secrets & Environment) complete
**Author:** Claude Code
**Date:** 2026-02-24

---

## 1. Problem Statement

The application currently accesses PostgreSQL via Supabase's JavaScript client SDK (`@supabase/supabase-js`), which provides an HTTP-based query builder. This works because Supabase bundles the database, query layer, and auth into one service.

When migrating to AWS RDS PostgreSQL:
- The Supabase SDK no longer works (it's coupled to Supabase's PostgREST API)
- There is no model layer — table names, column names, and query logic are scattered across **200+ `.from()` calls** in ~110 files
- All data access goes through two large service files (`supabase-data.js`) with no type safety
- Stored procedures are called via Supabase's `.rpc()` method, which won't exist on raw RDS

We need to replace the Supabase client with a proper ORM that provides schema-as-code, type-safe queries, and connection pooling for a standard PostgreSQL instance.

---

## 2. Proposed Solution: Prisma ORM

### Why Prisma over alternatives

| Criteria | Prisma | Knex.js | pg (raw) |
|----------|--------|---------|----------|
| Schema-as-code | `schema.prisma` (single source of truth) | Migrations only | None |
| Type generation | Auto-generated TypeScript types | Manual | Manual |
| Query builder | Declarative, chainable | SQL-like builder | Raw SQL strings |
| Migration tooling | `prisma migrate` (auto-generated) | Hand-written SQL | Manual |
| Upsert support | Native `prisma.upsert()` | `.onConflict().merge()` | `ON CONFLICT` SQL |
| Relation handling | Declarative `@relation` | Manual JOINs | Manual JOINs |
| Connection pooling | Built-in | Manual via `pg.Pool` | Manual via `pg.Pool` |
| Learning curve | Moderate | Low | Lowest |
| Long-term maintainability | Best | Good | Poor at scale |

**Decision:** Prisma. The 11-table schema with foreign keys, enums, and stored procedures benefits most from schema-as-code. The 200+ query sites benefit from type-safe auto-completion. Migration tooling prevents schema drift between environments.

---

## 3. Current Architecture

### 3.1 Database Access Layer

```
Controllers (200+ endpoints)
    │
    ├── Direct Supabase calls: supabase.from('table').select().eq()
    │
    └── Via service functions: supabase-data.js (centralized reads/writes)
            │
            ├── admin_root/src/services/supabase-data.js (~18 functions)
            └── user_root/src/services/supabase-data.js (~6 functions, read-only)
```

### 3.2 Tables (11 in `hubspot_sync` schema)

| Table | Rows (est.) | Write Frequency | Critical |
|-------|-------------|-----------------|----------|
| `hubspot_bookings` | ~5,000 | High (user + sync) | Yes |
| `hubspot_contact_credits` | ~2,000 | High (credit ops) | Yes |
| `hubspot_mock_exams` | ~500 | Medium (admin + sync) | Yes |
| `groups` | ~100 | Low (admin only) | No |
| `groups_students` | ~1,000 | Medium | No |
| `groups_instructors` | ~200 | Low | No |
| `instructors` | ~50 | Low | No |
| `work_check_bookings` | ~2,000 | Medium | No |
| `work_check_slots` | ~500 | Low | No |
| `sync_metadata` | ~5 | Low (cron only) | Yes |
| `audit_log` | ~10,000 | Auto (triggers) | No |

### 3.3 Stored Procedures (8 in `hubspot_sync` schema)

| Function | Purpose | Called From |
|----------|---------|------------|
| `create_booking_atomic()` | Atomic booking + credit deduction | User booking creation |
| `cancel_booking_atomic()` | Atomic cancel + credit restoration | User/admin booking cancel |
| `check_idempotency_key()` | Duplicate booking prevention | User booking creation |
| `increment_exam_bookings()` | Atomic `total_bookings` counter | After booking create/cancel |
| `update_exam_prerequisites()` | Array add/remove prerequisites | Admin exam management |
| `get_booking()` | Flexible booking lookup (UUID/HubSpot ID/booking_id) | Internal helper |
| `get_contact_credits()` | Flexible contact lookup (multiple key types) | Internal helper |
| `get_changed_fields()` | Diff two JSONB records | Audit triggers |

### 3.4 Enums

| Enum | Values | Used In |
|------|--------|---------|
| `mock_set_enum` (`hubspot_sync`) | A, B, C, D, E, F, G, H | `hubspot_bookings.mock_set`, `hubspot_mock_exams.mock_set` |
| `app_role` (`public`) | super_admin, admin, viewer, instructor | `user_roles.role` |
| `app_permission` (`public`) | 19 permission strings | `role_permissions.permission` |

### 3.5 Views

| View | Purpose |
|------|---------|
| `booking_details_view` | Joined bookings + slots + students + instructors for work check aggregates |

### 3.6 Triggers

| Trigger | Table | Function |
|---------|-------|----------|
| `bookings_audit_trigger` | `hubspot_bookings` | `log_booking_changes()` |
| `contact_credits_audit_trigger` | `hubspot_contact_credits` | `log_contact_credits_changes()` |
| `exams_audit_trigger` | `hubspot_mock_exams` | `log_exam_changes()` |

---

## 4. Target Architecture

### 4.1 New Data Access Layer

```
Controllers (200+ endpoints)
    │
    ├── Via Prisma Client: prisma.hubspotBooking.findMany({ where: ... })
    │
    └── Via refactored service layer: db.js (thin wrapper around Prisma)
            │
            ├── admin_root/src/services/db.js (replaces supabase-data.js)
            └── user_root/src/services/db.js (replaces supabase-data.js)
```

### 4.2 New File Structure

```
shared/
  prisma/
    schema.prisma            # Single source of truth for all tables
    migrations/              # Auto-generated migration files
    seed.js                  # Optional seed data for dev/staging
admin_root/
  src/
    services/
      db.js                  # Prisma client instance + connection management
      db-helpers.js          # Replaces supabase-data.js (same function signatures)
      supabase-data.js       # DELETED after migration
      supabase.js            # DELETED after migration (auth moved to Phase 5)
user_root/
  src/
    services/
      db.js                  # Prisma client instance
      db-helpers.js          # Replaces supabase-data.js
      supabase-data.js       # DELETED
      supabase.js            # DELETED (auth portion kept until Phase 5)
```

### 4.3 Prisma Schema (complete)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  schemas  = ["hubspot_sync", "public"]
}

// ─── Enums ────────────────────────────────────────────

enum MockSetEnum {
  A
  B
  C
  D
  E
  F
  G
  H

  @@schema("hubspot_sync")
  @@map("mock_set_enum")
}

enum AppRole {
  super_admin
  admin
  viewer
  instructor

  @@schema("public")
  @@map("app_role")
}

enum AppPermission {
  bookings_create    @map("bookings.create")
  bookings_cancel    @map("bookings.cancel")
  bookings_batch_cancel @map("bookings.batch_cancel")
  bookings_view      @map("bookings.view")
  bookings_export    @map("bookings.export")
  exams_create       @map("exams.create")
  exams_edit         @map("exams.edit")
  exams_delete       @map("exams.delete")
  exams_activate     @map("exams.activate")
  exams_view         @map("exams.view")
  contacts_tokens    @map("contacts.tokens")
  workcheck_create   @map("workcheck.create")
  workcheck_view     @map("workcheck.view")
  workcheck_edit     @map("workcheck.edit")
  workcheck_delete   @map("workcheck.delete")
  groups_create      @map("groups.create")
  groups_edit        @map("groups.edit")
  groups_view        @map("groups.view")
  groups_delete      @map("groups.delete")

  @@schema("public")
  @@map("app_permission")
}

// ─── hubspot_sync schema ──────────────────────────────

model HubspotBooking {
  id                   String        @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  hubspot_id           String?       @unique
  booking_id           String?
  associated_mock_exam String?
  associated_contact_id String?
  student_id           String?
  name                 String?
  student_email        String?
  is_active            String?
  attendance           String?
  dominant_hand        String?
  created_at           DateTime?     @db.Timestamp(6)
  updated_at           DateTime?     @db.Timestamp(6)
  synced_at            DateTime?     @default(now()) @db.Timestamp(6)
  token_used           String?
  token_refunded_at    DateTime?     @db.Timestamptz(6)
  token_refund_admin   String?
  start_time           String?
  end_time             String?
  ndecc_exam_date      DateTime?     @db.Date
  idempotency_key      String?       @unique
  attending_location   String?
  exam_date            DateTime?     @db.Timestamptz(6)
  mock_type            String?
  hubspot_last_sync_at DateTime?     @db.Timestamptz(6)
  mock_set             MockSetEnum?
  token_refunded       String?

  @@schema("hubspot_sync")
  @@map("hubspot_bookings")
  @@index([associated_contact_id], map: "idx_bookings_contact_id")
  @@index([associated_mock_exam], map: "idx_bookings_exam_id")
  @@index([hubspot_id], map: "idx_bookings_hubspot_id")
  @@index([student_email], map: "idx_bookings_student_email")
  @@index([student_id], map: "idx_bookings_student_id")
}

model HubspotContactCredits {
  id                   String    @db.Uuid
  hubspot_id           String?   @unique
  student_id           String    @unique
  email                String
  firstname            String?
  lastname             String?
  sj_credits           Int       @default(0)
  cs_credits           Int       @default(0)
  sjmini_credits       Int       @default(0)
  mock_discussion_token Int      @default(0)
  shared_mock_credits  Int       @default(0)
  ndecc_exam_date      String?
  created_at           DateTime? @default(now()) @db.Timestamp(6)
  updated_at           DateTime? @default(now()) @db.Timestamp(6)
  synced_at            DateTime? @default(now()) @db.Timestamp(6)
  hubspot_last_sync_at DateTime? @db.Timestamptz(6)

  groupStudents        GroupStudent[]
  workCheckBookings    WorkCheckBooking[]

  @@id([id, student_id])
  @@unique([student_id, email], map: "unique_student_email")
  @@schema("hubspot_sync")
  @@map("hubspot_contact_credits")
  @@index([email], map: "idx_email")
  @@index([hubspot_id], map: "idx_hubspot_id")
  @@index([student_id], map: "idx_student_id")
  @@index([synced_at], map: "idx_synced_at")
}

model HubspotMockExam {
  id                             String        @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  hubspot_id                     String        @unique
  mock_exam_name                 String?
  mock_type                      String?
  exam_date                      DateTime?     @db.Timestamp(6)
  start_time                     String?
  end_time                       String?
  location                       String?
  capacity                       Int?
  total_bookings                 Int           @default(0)
  is_active                      String?
  created_at                     DateTime?     @db.Timestamp(6)
  updated_at                     DateTime?     @db.Timestamp(6)
  synced_at                      DateTime?     @default(now()) @db.Timestamp(6)
  scheduled_activation_datetime  DateTime?     @db.Timestamptz(6)
  hubspot_last_sync_at           DateTime?     @db.Timestamptz(6)
  mock_set                       MockSetEnum?
  prerequisite_exam_ids          String[]      @default([])

  @@schema("hubspot_sync")
  @@map("hubspot_mock_exams")
  @@index([is_active], map: "idx_exams_active")
  @@index([exam_date], map: "idx_exams_date")
  @@index([hubspot_id], map: "idx_exams_hubspot_id")
}

model Group {
  id           String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  group_id     String    @unique @db.VarChar(50)
  group_name   String    @db.VarChar(100)
  time_period  String    @db.VarChar(10)
  start_date   DateTime  @db.Date
  end_date     DateTime? @db.Date
  max_capacity Int       @default(20)
  status       String?   @default("active") @db.VarChar(20)
  created_at   DateTime? @default(now()) @db.Timestamptz(6)
  updated_at   DateTime? @default(now()) @db.Timestamptz(6)
  location     String    @default("Mississauga")
  cycle        String?
  phase        String?   @default("Learning")

  students     GroupStudent[]
  instructors  GroupInstructor[]

  @@schema("hubspot_sync")
  @@map("groups")
  @@index([start_date], map: "idx_groups_start_date")
  @@index([status], map: "idx_groups_status")
}

model GroupStudent {
  id          String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  group_id    String    @db.VarChar(50)
  student_id  String
  status      String?   @default("active") @db.VarChar(20)
  enrolled_at DateTime? @default(now()) @db.Timestamptz(6)
  updated_at  DateTime? @default(now()) @db.Timestamptz(6)

  group       Group     @relation(fields: [group_id], references: [group_id])
  student     HubspotContactCredits @relation(fields: [student_id], references: [student_id])

  @@unique([group_id, student_id], map: "unique_group_student")
  @@schema("hubspot_sync")
  @@map("groups_students")
  @@index([group_id], map: "idx_gs_group")
  @@index([student_id], map: "idx_gs_student")
}

model GroupInstructor {
  id            String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  group_id      String    @db.VarChar(50)
  instructor_id String    @db.Uuid
  status        String    @default("active")
  created_at    DateTime  @default(now()) @db.Timestamptz(6)
  updated_at    DateTime  @default(now()) @db.Timestamptz(6)
  assigned_date DateTime  @db.Date

  group         Group      @relation(fields: [group_id], references: [group_id])
  instructor    Instructor @relation(fields: [instructor_id], references: [id])

  @@unique([group_id, instructor_id, assigned_date], map: "unique_group_instructor_date")
  @@schema("hubspot_sync")
  @@map("groups_instructors")
  @@index([group_id], map: "idx_groups_instructors_group_id")
  @@index([instructor_id], map: "idx_groups_instructors_instructor_id")
  @@index([status], map: "idx_groups_instructors_status")
  @@index([group_id, status], map: "idx_groups_instructors_group_status")
}

model Instructor {
  id              String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  instructor_name String    @db.VarChar(100)
  email           String    @unique @db.VarChar(255)
  is_active       Boolean   @default(true)
  auth_user_id    String?   @db.Uuid
  created_at      DateTime? @default(now()) @db.Timestamptz(6)
  updated_at      DateTime? @default(now()) @db.Timestamptz(6)

  groupAssignments GroupInstructor[]
  workCheckSlots   WorkCheckSlot[]

  @@schema("hubspot_sync")
  @@map("instructors")
  @@index([auth_user_id], map: "idx_instructors_auth_user_id")
  @@index([email], map: "idx_instructors_email")
  @@index([is_active], map: "idx_instructors_is_active")
}

model WorkCheckSlot {
  id               String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  instructor_id    String    @db.Uuid
  group_id         String[]  @db.VarChar
  slot_date        DateTime  @db.Date
  slot_time        DateTime  @db.Time(6)
  duration_minutes Int       @default(30)
  total_slots      Int       @default(1)
  location         String?   @db.VarChar(255)
  is_active        Boolean   @default(true)
  available_from   DateTime? @db.Timestamptz(6)
  created_at       DateTime? @default(now()) @db.Timestamptz(6)
  updated_at       DateTime? @default(now()) @db.Timestamptz(6)
  auto_approve     Boolean   @default(true)

  instructor       Instructor @relation(fields: [instructor_id], references: [id])
  bookings         WorkCheckBooking[]

  @@unique([instructor_id, group_id, slot_date, slot_time], map: "unique_slot")
  @@schema("hubspot_sync")
  @@map("work_check_slots")
  @@index([slot_date], map: "idx_wcs_date")
  @@index([instructor_id], map: "idx_wcs_instructor")
}

model WorkCheckBooking {
  id           String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  slot_id      String    @db.Uuid
  student_id   String
  status       String    @default("pending") @db.VarChar(20)
  created_at   DateTime? @default(now()) @db.Timestamptz(6)
  confirmed_at DateTime? @db.Timestamptz(6)
  cancelled_at DateTime? @db.Timestamptz(6)
  type         String?   @default("Work Check")
  marked_at    DateTime? @db.Timestamptz(6)
  seat         Int?      @db.SmallInt
  lab          String?

  slot         WorkCheckSlot @relation(fields: [slot_id], references: [id])
  student      HubspotContactCredits @relation(fields: [student_id], references: [student_id])

  @@schema("hubspot_sync")
  @@map("work_check_bookings")
  @@index([slot_id], map: "idx_wcb_slot")
  @@index([status], map: "idx_wcb_status")
  @@index([student_id], map: "idx_wcb_student")
}

model SyncMetadata {
  id                  String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  sync_type           String    @unique
  last_sync_timestamp BigInt
  updated_at          DateTime? @default(now()) @db.Timestamp(6)
  created_at          DateTime? @default(now()) @db.Timestamp(6)

  @@schema("hubspot_sync")
  @@map("sync_metadata")
  @@index([sync_type], map: "idx_sync_metadata_type")
}

model AuditLog {
  id             String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  table_name     String
  operation      String
  record_id      String?
  performed_at   DateTime? @default(now()) @db.Timestamp(6)
  performed_by   String?
  old_values     Json?
  new_values     Json?
  changed_fields String[]

  @@schema("hubspot_sync")
  @@map("audit_log")
}

// ─── public schema ────────────────────────────────────

model UserRole {
  id         String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  user_id    String    @unique @db.Uuid
  role       AppRole
  granted_by String?   @db.Uuid
  granted_at DateTime? @db.Timestamptz(6)
  notes      String?

  @@schema("public")
  @@map("user_roles")
}

model RolePermission {
  id         String        @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  role       AppRole
  permission AppPermission

  @@unique([role, permission], map: "unique_role_permission")
  @@schema("public")
  @@map("role_permissions")
}
```

---

## 5. Implementation Plan

### Step 1: Provision RDS and set up Prisma (Day 1-2)

1. Provision RDS PostgreSQL 15+ instance in private subnet (same VPC as EC2)
2. Create `hubspot_sync` and `public` schemas on RDS
3. Import existing schema DDL from `hubspot_sync_schema.sql` and `public_schema.sql`
4. Import stored procedures, triggers, and views
5. Import data via `pg_dump --data-only`
6. Verify row counts match Supabase

```bash
# Install Prisma in both apps
cd admin_root && npm install prisma @prisma/client
cd user_root && npm install @prisma/client

# Or shared at monorepo root
npm install prisma @prisma/client
```

7. Create `shared/prisma/schema.prisma` with the schema above
8. Run `npx prisma db pull` to validate schema matches RDS
9. Run `npx prisma generate` to create the client

### Step 2: Create the database service layer (Day 2-3)

Create `db.js` in both apps — a thin wrapper around the Prisma client:

```javascript
// admin_root/src/services/db.js
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
  datasources: {
    db: { url: process.env.DATABASE_URL }
  }
});

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

module.exports = { prisma };
```

### Step 3: Create db-helpers.js — same API, Prisma internals (Day 3-6)

Replace `supabase-data.js` functions one-by-one with Prisma equivalents. **Keep the exact same function signatures** so controllers don't need changes yet.

**Example conversions:**

```javascript
// BEFORE (supabase-data.js)
async function getExamsFromSupabase(filters = {}) {
  let query = supabaseAdmin.from('hubspot_mock_exams').select('*');
  if (filters.is_active) query = query.eq('is_active', filters.is_active);
  if (filters.date_from) query = query.gte('exam_date', filters.date_from);
  if (filters.mock_type) query = query.eq('mock_type', filters.mock_type);
  const { data, error } = await query;
  return { data, error };
}

// AFTER (db-helpers.js)
async function getExamsFromSupabase(filters = {}) {
  try {
    const where = {};
    if (filters.is_active) where.is_active = filters.is_active;
    if (filters.date_from) where.exam_date = { gte: new Date(filters.date_from) };
    if (filters.mock_type) where.mock_type = filters.mock_type;
    const data = await prisma.hubspotMockExam.findMany({ where });
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
}
```

**Priority order for conversion (by dependency + risk):**

| # | Function | Complexity | Notes |
|---|----------|------------|-------|
| 1 | `getExamsFromSupabase` | Low | Simple filtered read |
| 2 | `getExamByIdFromSupabase` | Low | Single record lookup |
| 3 | `getExamsByIdsFromSupabase` | Low | Batch read (`findMany({ where: { hubspot_id: { in: ids } } })`) |
| 4 | `getBookingsFromSupabase` | Low | Filtered read |
| 5 | `getBookingByIdFromSupabase` | Low | Single record lookup |
| 6 | `getBookingsByContactFromSupabase` | Low | Filtered read |
| 7 | `getActiveBookingsCountFromSupabase` | Low | `count()` query |
| 8 | `getContactByEmailFromSupabase` | Low | Case-insensitive (use `mode: 'insensitive'`) |
| 9 | `getContactByStudentIdFromSupabase` | Low | Simple lookup |
| 10 | `getContactByIdFromSupabase` | Low | HubSpot ID lookup |
| 11 | `searchContactFromSupabase` | Low | Dual-field search |
| 12 | `checkExistingActiveBookingFromSupabase` | Low | Active booking check |
| 13 | `syncExamToSupabase` | Medium | Upsert with timestamp conversion |
| 14 | `syncContactToSupabase` | Medium | Upsert on `hubspot_id` |
| 15 | `syncBookingToSupabase` | Medium | Upsert with field mapping |
| 16 | `syncBookingsToSupabase` | Medium | Batch upsert (loop `prisma.upsert`) |
| 17 | `updateBookingStatusInSupabase` | Medium | UUID vs HubSpot ID dual lookup |
| 18 | `updateExamBookingCountInSupabase` | High | Atomic increment — use `prisma.$executeRaw` to call `increment_exam_bookings()` |

### Step 4: Handle stored procedures (Day 6-8)

Stored procedures stay in PostgreSQL on RDS — they're database-level logic. Call them via Prisma's raw query API:

```javascript
// Atomic booking creation (replaces supabase.rpc('create_booking_atomic', ...))
async function createBookingAtomic(params) {
  const result = await prisma.$queryRaw`
    SELECT hubspot_sync.create_booking_atomic(
      ${params.bookingId}::text,
      ${params.studentId}::text,
      ${params.studentEmail}::text,
      ${params.mockExamId}::text,
      ${params.studentName}::text,
      ${params.tokenUsed}::text,
      ${params.attendingLocation}::text,
      ${params.dominantHand}::text,
      ${params.idempotencyKey}::text,
      ${params.creditField}::text,
      ${params.newCreditValue}::integer,
      ${params.mockSet}::text
    ) as result
  `;
  return result[0]?.result;
}

// Atomic booking cancellation
async function cancelBookingAtomic(bookingId, creditField, restoredCreditValue) {
  const result = await prisma.$queryRaw`
    SELECT hubspot_sync.cancel_booking_atomic(
      ${bookingId}::uuid,
      ${creditField}::text,
      ${restoredCreditValue}::integer
    ) as result
  `;
  return result[0]?.result;
}

// Idempotency check
async function checkIdempotencyKey(key) {
  const result = await prisma.$queryRaw`
    SELECT hubspot_sync.check_idempotency_key(${key}::text) as result
  `;
  return result[0]?.result;
}

// Atomic exam booking count increment
async function incrementExamBookings(examId, delta) {
  const result = await prisma.$queryRaw`
    SELECT hubspot_sync.increment_exam_bookings(${examId}::text, ${delta}::integer) as result
  `;
  return result[0]?.result;
}

// Prerequisites delta update
async function updateExamPrerequisites(examId, addIds, removeIds) {
  const result = await prisma.$queryRaw`
    SELECT hubspot_sync.update_exam_prerequisites(
      ${examId}::text,
      ${addIds}::text[],
      ${removeIds}::text[]
    ) as result
  `;
  return result[0]?.result;
}
```

### Step 5: Migrate direct Supabase calls in controllers (Day 8-12)

Many controllers call `supabaseAdmin.from()` directly instead of going through `supabase-data.js`. These need to be converted to Prisma calls.

**Search pattern:** `supabase` + `.from(` across all controller files.

**Conversion checklist by domain:**

| Domain | Files | Direct Supabase Calls | Difficulty |
|--------|-------|----------------------|------------|
| Mock Exams | 18 controllers | ~40 calls | Medium |
| Bookings | 4 controllers | ~15 calls | High (atomics) |
| Groups | 14 controllers | ~30 calls | Low |
| Instructors | 12 controllers | ~20 calls | Low |
| Work Check Slots | 8 controllers | ~15 calls | Low |
| Work Check Bookings | 10 controllers | ~20 calls | Low |
| Cron | 4 controllers | ~10 calls | Medium (sync logic) |
| Auth | 8 controllers | ~10 calls | Deferred to Phase 5 |
| Trainees | 4 controllers | ~8 calls | Low |
| User App | 12 controllers | ~25 calls | Medium |

**Common Supabase → Prisma translations:**

| Supabase | Prisma |
|----------|--------|
| `.from('table').select('*')` | `prisma.model.findMany()` |
| `.from('table').select('*').eq('col', val)` | `prisma.model.findMany({ where: { col: val } })` |
| `.from('table').select('*').single()` | `prisma.model.findFirst({ where: ... })` |
| `.from('table').select('col1, col2')` | `prisma.model.findMany({ select: { col1: true, col2: true } })` |
| `.from('table').select('*, other_table(*)')` | `prisma.model.findMany({ include: { otherTable: true } })` |
| `.eq('col', val)` | `{ col: val }` |
| `.neq('col', val)` | `{ col: { not: val } }` |
| `.gt()` / `.gte()` / `.lt()` / `.lte()` | `{ gt: }` / `{ gte: }` / `{ lt: }` / `{ lte: }` |
| `.in('col', [vals])` | `{ col: { in: [vals] } }` |
| `.ilike('col', '%val%')` | `{ col: { contains: val, mode: 'insensitive' } }` |
| `.is('col', null)` | `{ col: null }` |
| `.order('col', { ascending: false })` | `{ orderBy: { col: 'desc' } }` |
| `.range(offset, offset + limit - 1)` | `{ skip: offset, take: limit }` |
| `.upsert(data, { onConflict: 'hubspot_id' })` | `prisma.model.upsert({ where: { hubspot_id: x }, create: data, update: data })` |
| `.insert(data)` | `prisma.model.create({ data })` |
| `.update(data).eq('id', id)` | `prisma.model.update({ where: { id }, data })` |
| `.delete().eq('id', id)` | `prisma.model.delete({ where: { id } })` |
| `.rpc('function_name', params)` | `prisma.$queryRaw\`SELECT function_name(...)\`` |

### Step 6: Handle the booking_details_view (Day 12)

The `booking_details_view` is used by `get_booking_aggregates()` function. Two options:

**Option A (recommended):** Keep the view and stored procedure on RDS. Call via `prisma.$queryRaw`:
```javascript
const aggregates = await prisma.$queryRaw`
  SELECT * FROM hubspot_sync.get_booking_aggregates(
    ${location}::text, ${dateFrom}::date, ${dateTo}::date,
    ${status}::text, ${type}::text, ${instructorId}::uuid,
    ${limit}::integer, ${offset}::integer
  )
`;
```

**Option B:** Recreate the view as a Prisma query with joins. Not recommended — the SQL is complex and the stored procedure already works.

### Step 7: Remove Supabase dependencies (Day 12-13)

1. Delete `admin_root/src/services/supabase-data.js`
2. Delete `user_root/src/services/supabase-data.js`
3. Keep `supabase.js` temporarily — auth uses it (deferred to Phase 5)
4. Update all import statements
5. Remove `@supabase/supabase-js` from `package.json` **only after Phase 5 (auth migration)**

### Step 8: Testing (Day 13-15)

| Test | Method |
|------|--------|
| Schema validation | `prisma db pull` matches `schema.prisma` |
| All read endpoints | Hit every GET endpoint, compare JSON response to Supabase-backed version |
| All write endpoints | Create, update, delete operations on staging data |
| Atomic operations | Booking creation + credit deduction in single transaction |
| Idempotency | Duplicate booking attempts return existing booking |
| Booking count increment | Concurrent booking creation doesn't lose counts |
| Prerequisites delta | Add/remove prerequisite IDs atomically |
| Audit triggers | Verify `audit_log` entries after mutations |
| Sync operations | Run all 3 cron jobs against RDS, verify data integrity |
| Cache integration | Redis cache + Prisma reads work together |
| Error handling | Invalid IDs, missing records, constraint violations |
| Connection pool | Sustained load test (50 concurrent connections) |

---

## 6. Environment Variables

### New

| Variable | Example | Where |
|----------|---------|-------|
| `DATABASE_URL` | `postgresql://user:pass@rds-endpoint:5432/prepdoctors?schema=hubspot_sync` | AWS Secrets Manager |

### Removed (after Phase 5)

| Variable | Reason |
|----------|--------|
| `SUPABASE_URL` | No longer using Supabase API |
| `SUPABASE_SERVICE_ROLE_KEY` | No longer using Supabase service role |
| `SUPABASE_ANON_KEY` | No longer using Supabase public client |
| `SUPABASE_SCHEMA_NAME` | Schema is in Prisma config |

### Unchanged

| Variable | Notes |
|----------|-------|
| `REDIS_URL` | Cache layer unchanged (until Phase 4) |
| `HUBSPOT_PRIVATE_APP_TOKEN` | HubSpot sync unchanged |
| `CRON_SECRET` | Cron auth unchanged |

---

## 7. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Supabase query → Prisma translation bugs | Data corruption, wrong results | Run both in parallel, compare responses on staging |
| Prisma doesn't support multi-schema well | Build failures | Use `previewFeatures = ["multiSchema"]` (GA in Prisma 5.x) |
| Stored procedure parameter type mismatches | Runtime errors | Test each RPC call individually with known inputs |
| Connection pool exhaustion under load | 500 errors | Configure `connection_limit` in Prisma, monitor RDS connections |
| Prisma's batch upsert is sequential | Slower sync operations | Use `prisma.$transaction()` for bulk operations, or raw SQL `INSERT ... ON CONFLICT` |
| Trigger/view missing on RDS | Silent data integrity loss | Validate with `pg_dump --schema-only` comparison before cutover |
| `booking_details_view` references missing | Aggregate endpoints break | Import view DDL before any queries |

---

## 8. Rollback Plan

If the Prisma migration fails:

1. **Revert `db-helpers.js` → `supabase-data.js`** (git revert)
2. **Revert controller imports** (git revert)
3. **Re-enable Supabase env vars** in AWS Secrets Manager
4. **Restart Express apps** — they reconnect to Supabase
5. **Data is safe** — Supabase is still running in parallel until Phase 8

**Critical rule:** Do NOT delete Supabase data or shut down Supabase until the RDS migration has been validated for 1+ week in production.

---

## 9. Success Criteria

- [ ] All 200+ endpoints return identical JSON responses against RDS as they did against Supabase
- [ ] All 8 stored procedures callable via `prisma.$queryRaw`
- [ ] All 3 audit triggers fire on RDS mutations
- [ ] Cron jobs (sync, activation) run successfully against RDS
- [ ] No `@supabase/supabase-js` calls remain in data access code (auth calls exempt until Phase 5)
- [ ] `prisma db pull` matches `schema.prisma` exactly
- [ ] Connection pool handles 50 concurrent requests without errors
- [ ] Staging environment validated for 48 hours minimum before production cutover

---

## 10. Dependencies on Other Phases

| Depends On | Why |
|-----------|-----|
| Phase 1 (Express) | Controllers must be in Express format before refactoring data layer |
| Phase 2 (Secrets) | `DATABASE_URL` must be in AWS Secrets Manager before EC2 can connect to RDS |

| Blocks | Why |
|--------|-----|
| Phase 5 (Auth) | Auth migration needs `users` table in RDS + Prisma client ready |
| Phase 8 (Decommission) | Cannot remove Supabase until RDS is validated |

---

*This PRD corresponds to Phase 3 of the AWS migration checklist (`migration-checklist.md`).*
*Related PRDs: `auth-migration-supabase-to-self-managed.md` (Phase 5), `serverless-to-express-migration_admin.md` (Phase 1)*
