# Express Wrapper — Local Development Server

**Date:** 2026-02-23
**Phase:** Option 1 (thin wrapper for startup testing)

---

## Overview

Two Express `server.js` files wrap the existing Vercel serverless function handlers without modifying any endpoint code. This replaces the need for `vercel dev` during local development and migration testing.

## How to Run

```bash
# From monorepo root:

# Admin app (port 3000)
npm run dev:admin:express

# User app (port 3001)
npm run dev:user:express

# Automated startup test (starts both, hits /api/health, reports results)
npm run test:express-startup
```

Or directly:
```bash
cd admin_root && node server.js    # port 3000
cd user_root && node server.js     # port 3001
```

## Architecture

```
                    ┌──────────────────────────────────────┐
 Browser ─────────► │          Express server.js            │
                    │                                      │
                    │  /api/* ──► existing handler files    │
                    │             (zero modifications)      │
                    │                                      │
                    │  /* ──────► static files (SPA)        │
                    │             admin_frontend/dist/      │
                    │             or frontend/dist/         │
                    └──────────────────────────────────────┘
```

Each handler file still exports `module.exports = async (req, res) => {}`. The wrapper simply calls them via `app.all('/api/path', handler)`.

## Param Bridging (Dynamic Routes)

Vercel puts `[id]` path segments into `req.query.id`. Express puts them in `req.params.id`. All existing handlers read `req.query.id`.

The wrapper bridges this automatically:
```javascript
function bridgeParams(handler) {
  return (req, res) => {
    Object.assign(req.query, req.params);
    return handler(req, res);
  };
}
```

**Zero handler files are modified.**

## Route Counts

| App | Static Routes | Dynamic Routes | Total |
|-----|:------------:|:--------------:|:-----:|
| Admin | 37 | 10 | 47 |
| User | 10 | 2 | 12 |
| **Total** | **47** | **12** | **59** |

## Dynamic Route Mapping

### Admin App
| Express Route | Handler File |
|---------------|-------------|
| `/api/admin/mock-exams/:id` | `api/admin/mock-exams/[id].js` |
| `/api/admin/mock-exams/:id/attendance` | `api/admin/mock-exams/[id]/attendance.js` |
| `/api/admin/mock-exams/:id/bookings` | `api/admin/mock-exams/[id]/bookings.js` |
| `/api/admin/mock-exams/:id/cancel-bookings` | `api/admin/mock-exams/[id]/cancel-bookings.js` |
| `/api/admin/mock-exams/:id/prerequisites` | `api/admin/mock-exams/[id]/prerequisites/index.js` |
| `/api/admin/mock-exams/:id/prerequisites/delta` | `api/admin/mock-exams/[id]/prerequisites/delta.js` |
| `/api/admin/mock-exams/:id/prerequisites/:prerequisiteId` | `api/admin/mock-exams/[id]/prerequisites/[prerequisiteId].js` |
| `/api/admin/mock-exams/aggregates/:key/sessions` | `api/admin/mock-exams/aggregates/[key]/sessions.js` |
| `/api/admin/trainees/:contactId/bookings` | `api/admin/trainees/[contactId]/bookings.js` |
| `/api/admin/trainees/:contactId/tokens` | `api/admin/trainees/[contactId]/tokens.js` |

### User App
| Express Route | Handler File |
|---------------|-------------|
| `/api/bookings/:id` | `api/bookings/[id].js` |
| `/api/mock-exams/:id/capacity` | `api/mock-exams/[id]/capacity.js` |

## Known Limitations

1. **No cron scheduling** — The cron endpoints exist and can be called manually, but nothing triggers them on a schedule. For local testing, hit them manually:
   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/admin/cron/activate-scheduled-exams
   ```

2. **Supabase data queries fail** — The `SUPABASE_SERVICE_ROLE_KEY` is currently a placeholder (anon key). Queries against the `hubspot_sync` schema will return 401. See `02-env-verification-results.md`.

3. **No hot reload** — Changing handler files requires restarting `node server.js`. Use `nodemon server.js` for auto-restart during development if desired.

4. **Frontend must be built first** — The wrapper serves static files from `dist/`. If not built, the SPA won't load (API endpoints still work):
   ```bash
   npm run build:admin   # builds admin_frontend/dist/
   npm run build:user    # builds frontend/dist/
   ```

## Files Created

| File | Purpose |
|------|---------|
| `admin_root/server.js` | Express wrapper for admin app (47 routes, port 3000) |
| `user_root/server.js` | Express wrapper for user app (12 routes, port 3001) |
| `migration/scripts/test-express-startup.js` | Automated startup validator |

## Future: Option 2 — Full Express Rewrite

The current wrapper is intentionally thin. A future phase will refactor to a proper Express architecture:

- Replace `app.all()` with specific HTTP method handlers (`app.get`, `app.post`, etc.)
- Convert helper-function middleware to Express middleware chains (`app.use()`, `next()`)
- Add `node-cron` or a job queue for scheduled tasks
- Add request logging middleware (morgan or pino)
- Add centralized error handling middleware
- Remove internal `req.method` checks from handlers (Express routing handles this)

This is tracked as a separate effort and does not block the current migration testing.
