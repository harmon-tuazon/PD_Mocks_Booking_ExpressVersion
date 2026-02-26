# PostgreSQL (pg) Database Migration

**Date**: 2026-02-25
**Scope**: Replace Supabase REST API data queries with direct PostgreSQL connections via `pg`
**Status**: Implemented on EC2 dev instance, merged to `aws-dev_version` branch

---

## 1. Why This Change Was Made

Previously, all database operations went through the **Supabase JavaScript SDK**, which communicates via Supabase's PostgREST API over HTTPS:

```
Controller -> supabaseAdmin.from('table').select()... -> HTTPS -> Supabase REST API -> PostgreSQL
```

With the database migrated to **AWS RDS**, going through Supabase's REST layer adds unnecessary latency and a dependency on Supabase for data operations. The new architecture connects directly:

```
Controller -> pg Pool -> AWS RDS PostgreSQL (direct TCP)
```

Supabase remains **only for authentication** (JWT verification, user management).

---

## 2. New Files Created

### `database.js` (both apps — identical)

**Locations:**
- `admin_root/src/services/database.js`
- `user_root/src/services/database.js`

**Purpose:** Simple PostgreSQL connection pool for raw SQL queries.

**How it works:**
```javascript
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },  // Required for AWS RDS
  max: 10,                              // Max 10 concurrent connections
  idleTimeoutMillis: 30000,             // Close idle connections after 30s
  connectionTimeoutMillis: 5000         // Fail if can't connect in 5s
});

// Set schema on every new connection
pool.on('connect', (client) => {
  client.query('SET search_path TO "hubspot_sync", public');
});

const query = (text, params) => pool.query(text, params);
module.exports = { pool, query };
```

**Usage in `supabase-data.js`:**
```javascript
const { query } = require('./database');

async function getContactByEmail(email) {
  const { rows } = await query(
    'SELECT * FROM hubspot_contact_credits WHERE email ILIKE $1 LIMIT 1',
    [email]
  );
  return rows[0] || null;
}
```

**Key design decisions:**
- Uses `DATABASE_URL` env var (standard PostgreSQL convention)
- SSL enabled with `rejectUnauthorized: false` (AWS RDS uses Amazon-issued certs)
- Schema set via `SET search_path` on each connection (not per-query)
- Pool size of 10 is appropriate for a single-instance fork-mode app

---

### `pg-query-builder.js` (both apps — identical)

**Locations:**
- `admin_root/src/services/pg-query-builder.js`
- `user_root/src/services/pg-query-builder.js`

**Purpose:** Supabase query builder compatibility layer. Allows existing code that uses `supabaseAdmin.from('table').select().eq()...` to work **without modification** — the chained API is preserved but executes raw SQL against PostgreSQL instead of calling Supabase's REST API.

**Architecture:**
```
supabaseAdmin.from('table')  ->  new QueryBuilder(pool, 'table')
  .select('*')               ->  stores SELECT columns
  .eq('id', '123')           ->  stores WHERE condition
  .order('created_at')       ->  stores ORDER BY
  .single()                  ->  stores result shape
  // awaited                 ->  builds SQL, executes via pg pool
```

**Components:**

#### `QueryBuilder` class
Supports all Supabase operations:

| Operation | Supabase API | Generated SQL |
|-----------|-------------|---------------|
| **SELECT** | `.from('t').select('*').eq('id', 1)` | `SELECT * FROM "t" WHERE "id" = $1` |
| **INSERT** | `.from('t').insert({ name: 'x' })` | `INSERT INTO "t" ("name") VALUES ($1)` |
| **UPDATE** | `.from('t').update({ name: 'x' }).eq('id', 1)` | `UPDATE "t" SET "name" = $1 WHERE "id" = $2` |
| **DELETE** | `.from('t').delete().eq('id', 1)` | `DELETE FROM "t" WHERE "id" = $1` |
| **UPSERT** | `.from('t').upsert(data, { onConflict: 'id' })` | `INSERT ... ON CONFLICT ("id") DO UPDATE SET ...` |

Supported filter methods:
- `.eq()`, `.neq()`, `.gt()`, `.gte()`, `.lt()`, `.lte()`
- `.ilike()`, `.like()`
- `.in()` — uses `= ANY($1)` with array parameter
- `.is()` — handles `NULL`, `TRUE`, `FALSE`
- `.not()` — negation of other operators
- `.contains()` — uses `@>` (JSONB containment)
- `.or()` — parses Supabase OR filter string syntax

Pagination/ordering:
- `.order(col, { ascending: false })` — `ORDER BY "col" DESC`
- `.limit(n)` — `LIMIT n`
- `.range(from, to)` — `OFFSET from LIMIT (to - from + 1)`

Result shape:
- `.single()` — returns first row or error if no rows (matches Supabase `PGRST116`)
- `.maybeSingle()` — returns first row or `null` (no error)
- `.select()` after mutation — adds `RETURNING` clause
- `{ count: 'exact' }` — uses `COUNT(*) OVER()` window function

#### `RpcBuilder` class
Calls PostgreSQL stored functions (replaces `supabaseAdmin.rpc()`):

```javascript
// Supabase API:
const { data } = await supabaseAdmin.rpc('increment_exam_bookings', { exam_id: '123' });

// Generated SQL:
SELECT * FROM "increment_exam_bookings"("exam_id" => $1)
```

- Supports named parameters
- Unwraps scalar return values (e.g., integer counts)
- `.single()` support

#### `createPgClient()` factory
Creates a hybrid client object:
```javascript
function createPgClient(pool) {
  return {
    from(table) { return new QueryBuilder(pool, table); },
    rpc(fnName, params) { return new RpcBuilder(pool, fnName, params); }
  };
}
```

**Security:**
- All identifiers (table names, column names) are sanitized via `qid()` which strips non-alphanumeric characters and wraps in double quotes
- All values use parameterized queries (`$1`, `$2`, ...) — no string interpolation of user data
- SQL injection is prevented at both the identifier and value levels

---

## 3. Modified Files: `supabase.js` (Hybrid Client)

**Locations:**
- `admin_root/src/services/supabase.js`
- `user_root/src/services/supabase.js`

**What changed:** The `supabaseAdmin` export is now a **hybrid object** that routes auth to Supabase and data to PostgreSQL:

```javascript
const { createClient } = require('@supabase/supabase-js');
const { createPgClient, getPool } = require('./pg-query-builder');

// Real Supabase — auth only
const _supabaseAuth = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

// pg-backed — data only
const _pgClient = createPgClient(getPool());

// Hybrid export
const supabaseAdmin = {
  auth: _supabaseAuth.auth,                      // -> Supabase
  from(table) { return _pgClient.from(table); },  // -> PostgreSQL
  rpc(fn, params) { return _pgClient.rpc(fn, params); }  // -> PostgreSQL
};
```

**Why this design:** Every controller in the codebase uses `supabaseAdmin.from(...)` and `supabaseAdmin.auth...`. By making `supabaseAdmin` a hybrid, **zero controller files need to change their imports or API calls**.

---

## 4. Modified Files: `supabase-data.js` (Data Access Layer)

**Locations:**
- `admin_root/src/services/supabase-data.js` (+231 / -739 lines)
- `user_root/src/services/supabase-data.js` (+235 / -693 lines)

**What changed:** Every function was rewritten from Supabase SDK chains to raw parameterized SQL via `database.js`.

**Example — Before (Supabase SDK):**
```javascript
async function getContactByEmailFromSupabase(email) {
  const { data, error } = await supabaseAdmin
    .from('hubspot_contact_credits')
    .select('*')
    .ilike('email', email)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Supabase contact read error:', error.message);
    throw error;
  }
  return data;
}
```

**Example — After (Direct pg):**
```javascript
async function getContactByEmailFromSupabase(email) {
  const { rows } = await query(
    'SELECT * FROM hubspot_contact_credits WHERE email ILIKE $1 LIMIT 1',
    [email]
  );
  return rows[0] || null;
}
```

**Key patterns in the rewrite:**
- Supabase error code `PGRST116` (no rows) replaced with simple `rows[0] || null`
- All queries use `$1, $2...` parameterized placeholders
- Helper functions added: `parseTimestamp()`, `parseDateString()` for data normalization
- ~50% reduction in lines of code

---

## 5. Supabase Client Deduplication

Multiple controllers were creating their own Supabase clients inline. All replaced with the shared import:

| File | Lines Removed |
|------|:---:|
| `admin_root/src/controllers/auth/requestOtp.js` | 4 |
| `admin_root/src/controllers/auth/updatePassword.js` | 4 |
| `admin_root/src/controllers/cron/syncBookingsFromSupabase.js` | 13 |
| `admin_root/src/controllers/sync/forceSupabase.js` | 11 |
| `admin_root/src/jobs/syncBookings.job.js` | 13 |
| `admin_root/src/services/supabaseSync.optimized.js` | 14 |
| `user_root/src/controllers/bookings/cancel.js` | 9 |
| `user_root/src/controllers/mockDiscussions/available.js` | 5 |

Each now uses:
```javascript
const { supabaseAdmin } = require('../../services/supabase');
```

---

## 6. Two Query Approaches in the Codebase

After the migration, there are **two ways** data queries are made:

### Approach A: Raw SQL via `database.js`
Used in `supabase-data.js` — the data access layer functions that were fully rewritten.

```javascript
const { query } = require('./database');
const { rows } = await query('SELECT * FROM hubspot_bookings WHERE id = $1', [id]);
```

### Approach B: Supabase-compatible chaining via `pg-query-builder.js`
Used by controllers that call `supabaseAdmin.from(...)` directly. These work without code changes because the hybrid client routes `.from()` to the query builder.

```javascript
const { supabaseAdmin } = require('./supabase');
const { data, error } = await supabaseAdmin
  .from('hubspot_bookings')
  .select('*')
  .eq('id', id)
  .single();
```

Both approaches connect to the same PostgreSQL pool targeting the same AWS RDS database.

---

## 7. Environment Variables

### New (Required)
| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string for AWS RDS | `postgresql://user:pass@rds-host.amazonaws.com:5432/prepdoc` |
| `DATABASE_SCHEMA` | Schema name (optional, defaults to `hubspot_sync`) | `hubspot_sync` |

### Unchanged (Still Required)
| Variable | Description | Used For |
|----------|-------------|----------|
| `SUPABASE_URL` | Supabase project URL | Authentication only |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Authentication only |

### Connection Flow
```
Data queries:
  DATABASE_URL -> pg Pool -> AWS RDS PostgreSQL -> hubspot_sync schema

Authentication:
  SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY -> Supabase Auth API -> JWT verification
```

---

## 8. Pool Configuration

Both `database.js` and `pg-query-builder.js` create PostgreSQL pools with identical settings:

| Setting | Value | Purpose |
|---------|-------|---------|
| `max` | 10 | Maximum concurrent connections |
| `idleTimeoutMillis` | 30000 (30s) | Close idle connections after 30s |
| `connectionTimeoutMillis` | 5000 (5s) | Fail if can't connect within 5s |
| `ssl.rejectUnauthorized` | false | Accept AWS RDS SSL certificates |

**Note:** There are currently **two pools** created per app (one in `database.js`, one lazy-initialized in `pg-query-builder.js`). Both connect to the same `DATABASE_URL`. This is an area for potential optimization (sharing a single pool).

---

## 9. Unsupported Supabase Features

The `pg-query-builder.js` does **not** support:
- **Relation joins** — Supabase syntax like `.select('*, groups_students(student_id)')` is skipped (columns with parentheses are filtered out)
- **Real-time subscriptions** — Not applicable for server-side queries
- **Storage** — Not implemented (not used in this project)
- **Edge Functions** — Still called via HTTP (unchanged)

---

## 10. Files Reference

| File | App | Purpose |
|------|-----|---------|
| `admin_root/src/services/database.js` | Admin | pg connection pool (raw SQL) |
| `admin_root/src/services/pg-query-builder.js` | Admin | Supabase API compatibility layer |
| `admin_root/src/services/supabase.js` | Admin | Hybrid client (auth=Supabase, data=pg) |
| `admin_root/src/services/supabase-data.js` | Admin | Data access functions (rewritten to raw SQL) |
| `user_root/src/services/database.js` | User | pg connection pool (raw SQL) |
| `user_root/src/services/pg-query-builder.js` | User | Supabase API compatibility layer |
| `user_root/src/services/supabase.js` | User | Hybrid client (auth=Supabase, data=pg) |
| `user_root/src/services/supabase-data.js` | User | Data access functions (rewritten to raw SQL) |
