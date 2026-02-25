# EC2 Dev Instance Changes Analysis

**Date**: 2026-02-25
**Source**: EC2 dev instance (`15.223.25.180`, user `appuser`)
**Target**: Local repository (main branch, commit `869a38a`)
**Method**: `git diff HEAD` after copying EC2 files over local repo

---

## Summary

The EC2 dev instance contains changes from the **AWS RDS database migration** (Phase 3). The core change is replacing Supabase client SDK data queries with direct PostgreSQL (`pg`) connections to AWS RDS, while keeping Supabase solely for authentication (JWT verification).

**Total**: 19 files with meaningful code changes + 4 new files + ~250 files with line-ending differences (LF vs CRLF, cosmetic only)

---

## 1. New Files (Untracked)

| File | Purpose |
|------|---------|
| `admin_root/src/services/database.js` | PostgreSQL connection pool for admin app (direct `pg` to AWS RDS) |
| `admin_root/src/services/pg-query-builder.js` | Supabase query builder compatibility layer (`.from().select().eq()...` API on top of `pg`) |
| `user_root/src/services/database.js` | PostgreSQL connection pool for user app (same pattern) |
| `user_root/src/services/pg-query-builder.js` | Supabase query builder compatibility layer (same pattern) |

### `database.js` (both apps)
- Creates a `pg.Pool` connected via `DATABASE_URL` env var
- Sets `search_path` to `hubspot_sync` schema on each connection
- Pool config: max 10 connections, 5s connect timeout, 30s idle timeout
- SSL enabled (`rejectUnauthorized: false`) for AWS RDS

### `pg-query-builder.js` (both apps)
- Implements Supabase's chained query API (`.from().select().eq().order().limit()`) using raw SQL
- Allows existing controllers that use `supabaseAdmin.from(...)` to work without modification
- Auth operations (`supabaseAdmin.auth.*`) still proxy to the real Supabase client

---

## 2. Major Changes: Data Access Layer Rewrite

### `admin_root/src/services/supabase-data.js` (+231 / -739 lines)
### `user_root/src/services/supabase-data.js` (+235 / -693 lines)

**What changed**: Every data query function was rewritten from Supabase client SDK calls to raw PostgreSQL queries via the new `database.js` pool.

**Before** (Supabase SDK):
```javascript
const { data, error } = await supabaseAdmin
  .from('hubspot_contact_credits')
  .select('*')
  .ilike('email', email)
  .single();
```

**After** (Direct PostgreSQL):
```javascript
const { rows } = await query(
  'SELECT * FROM hubspot_contact_credits WHERE email ILIKE $1 LIMIT 1',
  [email]
);
return rows[0] || null;
```

**Key patterns**:
- All Supabase `.from().select().eq()` chains replaced with parameterized SQL
- Error handling changed from Supabase error codes (e.g., `PGRST116`) to try/catch
- Helper functions added: `parseTimestamp()`, `parseDateString()` for data normalization
- Significantly fewer lines of code (~50% reduction in both files)

---

## 3. Supabase Client Changes

### `admin_root/src/services/supabase.js` (+44 / -42 lines)
### `user_root/src/services/supabase.js` (+27 / -9 lines)

**What changed**: The Supabase client is now used **only for authentication**. The `pg-query-builder.js` compatibility layer was integrated so that `supabaseAdmin.from(...)` calls are routed to PostgreSQL instead of Supabase's REST API.

---

## 4. Supabase Client Deduplication

Multiple files were creating their own Supabase clients inline. These were all replaced with a shared import:

| File | Change |
|------|--------|
| `admin_root/src/controllers/auth/requestOtp.js` | `createClient(...)` replaced with `require('../../services/supabase')` |
| `admin_root/src/controllers/auth/updatePassword.js` | Same |
| `admin_root/src/controllers/cron/syncBookingsFromSupabase.js` | Same (removed 13 lines of inline client setup) |
| `admin_root/src/controllers/sync/forceSupabase.js` | Same (removed 11 lines) |
| `admin_root/src/jobs/syncBookings.job.js` | Same (removed 13 lines) |
| `admin_root/src/services/supabaseSync.optimized.js` | Same (removed 14 lines) |
| `user_root/src/controllers/bookings/cancel.js` | Same (removed 9 lines) |
| `user_root/src/controllers/mockDiscussions/available.js` | Same (removed 5 lines) |

---

## 5. Infrastructure / Config Changes

### PM2 Ecosystem Configs
| File | Change |
|------|--------|
| `admin_root/ecosystem.config.js` | `instances: 'max'` -> `1`, `exec_mode: 'cluster'` -> `'fork'`, `PORT: 3001` -> `3002` |
| `user_root/ecosystem.config.js` | `instances: 'max'` -> `1`, `exec_mode: 'cluster'` -> `'fork'` |

**Rationale**: Fork mode is simpler for development and avoids cluster-mode issues with cron jobs and stateful connections. Admin port moved to 3002 to avoid conflict with the old prepdoc app on 3001.

### Package Dependencies
| File | Change |
|------|--------|
| `admin_root/package.json` | Added `"pg": "^8.18.0"` |
| `user_root/package.json` | Added `"pg": "^8.18.0"`, fixed indentation for `dotenv` |

### Express 5 Wildcard Fix
| File | Change |
|------|--------|
| `admin_root/src/server.js` | `app.get('*', ...)` -> `app.get('/{*splat}', ...)` |
| `user_root/src/server.js` | Same |

**Rationale**: Express 5.x uses `path-to-regexp` v8 which requires named catch-all parameters.

---

## 6. New Environment Variable Required

| Variable | Purpose | Example |
|----------|---------|---------|
| `DATABASE_URL` | PostgreSQL connection string for AWS RDS | `postgresql://user:pass@host:5432/dbname` |
| `DATABASE_SCHEMA` | Schema name (defaults to `hubspot_sync`) | `hubspot_sync` |

**Important**: Without `DATABASE_URL`, all data queries will fail. Auth will still work via Supabase.

---

## 7. Line-Ending Changes (Cosmetic)

~250+ files show as modified due to LF (Linux/EC2) vs CRLF (Windows) line-ending differences. These are cosmetic and do not represent code changes. Files affected include:
- All `.claude/agents/*.md` and `.claude/commands/*.md`
- All `PRDs/**/*.md` and `PRDs/**/*.sql`
- All admin/user frontend components (`.jsx`, `.js`)
- All admin/user backend controllers, routes, middleware, services
- Migration docs, SQL dumps, shell scripts

---

## 8. Architecture Before vs After

```
BEFORE (Supabase SDK):
  Controller -> supabaseAdmin.from('table').select()... -> Supabase REST API -> PostgreSQL

AFTER (Direct pg):
  Controller -> query('SELECT ...', params) -> pg Pool -> AWS RDS PostgreSQL
  Controller -> supabaseAdmin.from('table')... -> pg-query-builder -> pg Pool -> AWS RDS PostgreSQL
  Controller -> supabaseAdmin.auth.* -> Supabase Auth API (unchanged)
```

---

## 9. Files Changed Summary

### Meaningful Code Changes (19 files)
```
+231 -739  admin_root/src/services/supabase-data.js        (rewrite to pg)
+235 -693  user_root/src/services/supabase-data.js         (rewrite to pg)
 +44  -42  admin_root/src/services/supabase.js             (auth-only + pg-query-builder)
 +27   -9  user_root/src/services/supabase.js              (auth-only + pg-query-builder)
  +1  -14  admin_root/src/services/supabaseSync.optimized.js (use shared client)
  +1  -13  admin_root/src/controllers/cron/syncBookingsFromSupabase.js
  +1  -13  admin_root/src/jobs/syncBookings.job.js
  +1  -11  admin_root/src/controllers/sync/forceSupabase.js
  +1   -9  user_root/src/controllers/bookings/cancel.js
  +2   -5  admin_root/src/controllers/auth/requestOtp.js
  +2   -5  admin_root/src/controllers/auth/updatePassword.js
  +1   -5  user_root/src/controllers/mockDiscussions/available.js
  +3   -3  admin_root/ecosystem.config.js                  (fork mode, port 3002)
  +2   -2  user_root/ecosystem.config.js                   (fork mode)
  +1   -0  admin_root/package.json                         (add pg dep)
  +3   -2  user_root/package.json                          (add pg dep)
  +1   -1  admin_root/src/server.js                        (Express 5 wildcard fix)
  +1   -1  user_root/src/server.js                         (Express 5 wildcard fix)
+182    -  package-lock.json                               (lockfile update)
```

### New Files (4)
```
admin_root/src/services/database.js
admin_root/src/services/pg-query-builder.js
user_root/src/services/database.js
user_root/src/services/pg-query-builder.js
```

---

## 10. Risks & Notes

1. **`DATABASE_URL` must be set** in `.env` files for both apps before deploying this change
2. The `pg-query-builder.js` is a compatibility shim - not all Supabase query patterns may be supported
3. PM2 fork mode (1 instance) is appropriate for dev but production may need cluster mode revisited
4. Line-ending normalization should be done with `.gitattributes` to prevent future CRLF/LF noise
5. The raw diff files are preserved at:
   - `migration/documentation/diff_services.txt`
   - `migration/documentation/diff_other.txt`
