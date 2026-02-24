# Local Environment Analysis - AWS Migration Prep

**Date:** 2026-02-22
**Status:** Analysis complete, 1 blocker identified (deferred — anon key placeholder used for startup testing, see 02-env-verification-results.md)

---

## Project Structure Overview

This is a **monorepo** with two independent applications:

```
PD_Mocks_Booking_ExpressVersion/
├── admin_root/                  # Admin dashboard (Express API + React frontend)
│   ├── api/                     # Serverless API endpoints (Vercel functions)
│   │   └── _shared/            # Shared services (HubSpot, Supabase, Redis, CORS, etc.)
│   ├── admin_frontend/          # React + Vite (port 5174)
│   ├── package.json
│   ├── vercel.json
│   └── .env                     # <-- CREATED
│
├── user_root/                   # Student-facing booking app (Express API + React frontend)
│   ├── api/                     # Serverless API endpoints
│   │   └── _shared/            # Shared services
│   ├── frontend/                # React + Vite (port 3000)
│   ├── package.json
│   ├── vercel.json
│   └── .env                     # <-- CREATED
│
├── package.json                 # Monorepo root (workspaces)
└── migration/
    └── vercel_app_env.txt       # Source of truth for env vars
```

## External Service Dependencies

| Service | Purpose | Required For |
|---------|---------|-------------|
| **Supabase** | Primary database (PostgreSQL), Auth (JWT) | Both apps |
| **HubSpot CRM** | Legacy CRM, admin writes, audit trail | Both apps |
| **Redis Cloud** | Distributed caching, booking locks | Both apps |
| **Supabase Edge Functions** | Real-time exam update cascades | Admin only |

## Environment Variables - Complete Inventory

### BLOCKER: Missing Variable

| Variable | Status | Impact |
|----------|--------|--------|
| `SUPABASE_SERVICE_ROLE_KEY` | **MISSING from Vercel export** | **BLOCKS ALL Supabase operations** |

**Action Required:** Retrieve from Supabase Dashboard -> Settings -> API -> `service_role` key.
Both `admin_root/api/_shared/supabase.js` and `user_root/api/_shared/supabase.js` require this key.

### Backend Environment Variables (admin_root + user_root)

| Variable | Source | admin_root | user_root | Notes |
|----------|--------|:----------:|:---------:|-------|
| `HS_PRIVATE_APP_TOKEN` | Vercel export | Yes | Yes | HubSpot private app token |
| `HUBSPOT_PORTAL_ID` | Vercel export | Yes | Yes | Portal identifier |
| `SUPABASE_URL` | Vercel export | Yes | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | Vercel export | Yes | Yes (auth only) | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | **MISSING** | **Yes** | **Yes** | **Service role key (bypasses RLS)** |
| `SUPABASE_SCHEMA_NAME` | Vercel export | Yes | Yes | Value: `hubspot_sync` |
| `PD_Bookings_Cache_REDIS_URL` | Vercel export | Yes | Yes | Redis Cloud connection string |
| `CRON_SECRET` | Vercel export | Yes | Yes | Auth for cron jobs |
| `SHAKY_MOCKS_KEY` | Vercel export | Yes | No | Webhook secret for Edge Functions |
| `SUPABASE_EDGE_FUNCTION_URL` | Vercel export | Yes | No | Edge Function endpoint |
| `NODE_ENV` | Set manually | Yes | Yes | `development` for local |
| `VERCEL_URL` | Set manually | Yes | Yes | Used by CORS |
| `ALLOWED_ORIGIN` | Set manually | Yes | Yes | CORS origins |
| `ADMIN_MODE` | vercel.json | Yes | No | `true` for admin app |

### HubSpot Object Type IDs (both apps)

| Variable | Value |
|----------|-------|
| `CONTACTS_OBJECT_ID` | `0-1` |
| `DEALS_OBJECT_ID` | `0-3` |
| `COURSES_OBJECT_ID` | `0-410` |
| `TRANSACTIONS_OBJECT_ID` | `2-47045790` |
| `PAYMENT_SCHEDULES_OBJECT_ID` | `2-47381547` |
| `CREDIT_NOTES_OBJECT_ID` | `2-41609496` |
| `CAMPUS_VENUES_OBJECT_ID` | `2-41607847` |
| `ENROLLMENTS_OBJECT_ID` | `2-41701559` |
| `LAB_STATIONS_OBJECT_ID` | `2-41603799` |
| `BOOKINGS_OBJECT_ID` | `2-50158943` |
| `MOCK_EXAMS_OBJECT_ID` | `2-50158913` |

Note: These IDs are also hardcoded in `admin_root/api/_shared/hubspot.js` and `user_root/api/_shared/hubspot.js` as the `HUBSPOT_OBJECTS` constant. The env vars are not currently used by the code - the objects are hardcoded. This is fine for now.

### Frontend Environment Variables

| Variable | admin_frontend | user_frontend | Notes |
|----------|:--------------:|:-------------:|-------|
| `VITE_SUPABASE_URL` | Yes | Yes | Build-time embedded |
| `VITE_SUPABASE_ANON_KEY` | Yes | Yes | Build-time embedded |
| `VITE_API_BASE_URL` | Optional | Optional | Defaults to `/api` |
| `VITE_API_URL` | Optional | Optional | Defaults to empty |

### Vercel-Specific Variables (NOT needed locally)

| Variable | Why Not Needed |
|----------|---------------|
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Vercel-specific deployment bypass |
| `VERCEL_OIDC_TOKEN` | Vercel OpenID Connect token |

## .env Files Created

| File | Location | Status |
|------|----------|--------|
| `admin_root/.env` | Backend env vars | Created (needs SERVICE_ROLE_KEY) |
| `admin_root/admin_frontend/.env` | Frontend VITE_ vars | Created |
| `user_root/.env` | Backend env vars | Created (needs SERVICE_ROLE_KEY) |
| `user_root/frontend/.env` | Frontend VITE_ vars | Created |

All `.env` files are in `.gitignore` and will not be committed.

## Local Development Ports

| Component | Port | Command |
|-----------|------|---------|
| Admin frontend (Vite) | 5174 | `npm run dev:admin` |
| Admin API | 3000 | `npm run dev:admin:api` (requires `vercel dev`) |
| User frontend (Vite) | 3000 | `npm run dev:user` |
| User API | 3001 | `npm run dev:user:api` (requires `vercel dev`) |

**Note:** There is a port conflict - both admin API and user frontend default to port 3000. The Vite proxy in `user_root/frontend/vite.config.js` forwards `/api` to `localhost:3001`.

## Current Dev Command Dependencies

The `dev:api` scripts use `vercel dev` which requires the Vercel CLI. For the AWS migration, these will need to be replaced with Express.js local servers or a similar solution.

## Key Architectural Notes for Migration

1. **API endpoints are Vercel serverless functions** - Each file in `api/` is an independent function, not Express routes. They export a single `(req, res) => {}` handler.

2. **No Express server** - Despite `express` being in `package.json`, the APIs are structured as individual Vercel functions, not a running Express server. There is no `app.listen()` entry point.

3. **Cron jobs are Vercel-managed** - Defined in `vercel.json` with `crons` array. These hit HTTP endpoints with `CRON_SECRET` auth. On AWS, these would need to be converted to CloudWatch Events / EventBridge rules.

4. **Supabase Edge Functions** - `cascade-exam-updates` runs on Supabase infrastructure, triggered by webhooks. This is independent of the hosting platform.

5. **Redis Cloud** - Currently hosted on Redis Cloud (AWS us-east-1). This is already cloud-agnostic and will continue to work from AWS.

## Next Steps

1. **BLOCKER:** Retrieve `SUPABASE_SERVICE_ROLE_KEY` from Supabase Dashboard
2. Install dependencies: `npm run install:all`
3. Verify local API startup (currently requires Vercel CLI)
4. Plan Express.js server wrapper for local development without Vercel CLI
5. Plan AWS infrastructure (Lambda, API Gateway, CloudFront, or ECS)
