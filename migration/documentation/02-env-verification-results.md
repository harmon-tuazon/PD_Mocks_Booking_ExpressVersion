# Environment & Service Verification Results

**Date:** 2026-02-23
**Status:** Anon key used as placeholder for startup testing. HubSpot & Redis fully healthy.
**Decision:** Proceed with anon key to validate app launch; replace with real service_role key before data-flow testing.

---

## Verification Script

**Location:** `migration/scripts/verify-env-connections.js`

**Usage:**
```bash
# Verify admin app environment
node migration/scripts/verify-env-connections.js --app admin

# Verify user app environment
node migration/scripts/verify-env-connections.js --app user
```

**What it checks:**
1. All required environment variables are present
2. `SUPABASE_SERVICE_ROLE_KEY` JWT is valid and has `role: "service_role"` (not `anon`)
3. Supabase REST API connectivity (query `hubspot_mock_exams` via `hubspot_sync` schema)
4. Supabase Auth endpoint reachability
5. HubSpot API authentication + portal ID match + scope verification
6. HubSpot custom object access (mock exams)
7. Redis PING, version, memory, and write/read/delete cycle

---

## Results Summary (2026-02-23)

### Admin App (`admin_root/.env`)

| Check | Result | Detail |
|-------|--------|--------|
| Env vars present | PASS | All 8 required vars set |
| JWT Structure | PASS | Valid 3-part JWT |
| **JWT Role** | **FAIL** | `role = "anon"` — **wrong key!** |
| **Duplicate Key** | **FAIL** | `SUPABASE_SERVICE_ROLE_KEY` is identical to `SUPABASE_ANON_KEY` |
| JWT Project Ref | PASS | Matches `SUPABASE_URL` |
| JWT Expiration | PASS | Expires 2035-10-23 |
| **Supabase REST** | **FAIL** | `401 permission denied for schema hubspot_sync` |
| Supabase Auth | PASS | Auth settings endpoint reachable |
| HubSpot Auth | PASS | Authenticated — Portal 46814382 (204ms) |
| HubSpot Portal ID | PASS | Matches `HUBSPOT_PORTAL_ID` |
| HubSpot Scopes | WARN | Missing named scopes (custom objects still accessible via numeric IDs) |
| HubSpot Mock Exams | PASS | 241 mock exams readable |
| Redis PING | PASS | PONG in 23ms |
| Redis Version | PASS | 7.4.3 |
| Redis Memory | PASS | 2.89M used |
| Redis Write/Read | PASS | Full cycle succeeded |

**Totals:** 20 PASS, 1 WARN, 3 FAIL

### User App (`user_root/.env`)

| Check | Result | Detail |
|-------|--------|--------|
| Env vars present | PASS | All 7 required vars set |
| JWT Structure | PASS | Valid 3-part JWT |
| **JWT Role** | **FAIL** | `role = "anon"` — **wrong key!** |
| JWT Project Ref | PASS | Matches `SUPABASE_URL` |
| JWT Expiration | PASS | Expires 2035-10-23 |
| **Supabase REST** | **FAIL** | `401 permission denied for schema hubspot_sync` |
| HubSpot Auth | PASS | Authenticated — Portal 46814382 (196ms) |
| HubSpot Portal ID | PASS | Matches `HUBSPOT_PORTAL_ID` |
| HubSpot Scopes | WARN | Missing named scopes (custom objects still accessible) |
| HubSpot Mock Exams | PASS | 241 mock exams readable |
| Redis PING | PASS | PONG in 23ms |
| Redis Version | PASS | 7.4.3 |
| Redis Memory | PASS | 2.83M used |
| Redis Write/Read | PASS | Full cycle succeeded |

**Totals:** 18 PASS, 1 WARN, 2 FAIL

---

## Supabase Service Role Key — Placeholder Status

### Current State

`SUPABASE_SERVICE_ROLE_KEY` is set to the **anon key** as a placeholder. This is intentional for the current phase (app startup testing). The Supabase client initializes without validating the key, so the app will boot fine.

### What works with the placeholder

- App startup and Express server boot
- Frontend rendering (Vite dev server)
- HubSpot API calls (fully healthy)
- Redis operations (fully healthy)
- Supabase Auth endpoint (reachable)

### What will NOT work until the real key is set

- Any Supabase query against the `hubspot_sync` schema (returns 401)
- Booking creation, exam listing, credit checks via Supabase
- Cron sync jobs that read/write Supabase

### How to upgrade to the real key later

1. Go to **Supabase Dashboard** → **Settings** → **API**
2. Copy the **service_role** key (marked as secret / dangerous)
3. Replace in both files:
   - `admin_root/.env` → `SUPABASE_SERVICE_ROLE_KEY=<paste here>`
   - `user_root/.env` → `SUPABASE_SERVICE_ROLE_KEY=<paste here>`
4. Verify with: `node migration/scripts/verify-env-connections.js --app admin`

### How to identify the correct key

The **service_role** JWT payload contains `"role": "service_role"`.
The **anon** JWT payload contains `"role": "anon"`.

Quick check:
```bash
echo "<paste-jwt-here>" | cut -d. -f2 | base64 -d 2>/dev/null
```

---

## Non-Blocking Observations

### HubSpot Scopes Warning

The scopes check shows "missing" named scopes (`crm.objects.custom.read`, etc.), but the actual API calls to custom objects succeed (241 mock exams returned). This is because HubSpot private apps use numeric object type IDs which work regardless of named scope labels. **No action needed.**

### Service Latencies

| Service | Latency | Notes |
|---------|---------|-------|
| HubSpot | ~200ms | Normal for external API |
| Redis | ~23ms | Excellent (same AWS region) |
| Supabase | N/A | Blocked by auth error |

---

## Next Steps

1. **Proceed to local Express server setup** (app startup test with anon key placeholder)
2. After startup validated, replace `SUPABASE_SERVICE_ROLE_KEY` with the real service_role key
3. Re-run `node migration/scripts/verify-env-connections.js --app admin` and `--app user` to confirm full connectivity
4. Begin data-flow testing once all checks pass
