# AWS Migration - Step-by-Step Checklist

## Overview

This is the operational checklist for migrating the Mocks Booking platform from Vercel + Supabase to AWS. It's organized into phases that should be executed sequentially, each changing **one layer at a time** to minimize risk. Each phase has a clear "done when" criteria.

**Key architectural decision:** Express serves both frontend static files and API routes on a single port per app. No S3/CloudFront for frontend hosting. No CORS needed (same-origin).

For architectural decisions and target state, see `aws-full-migration-with-shared-architecture.md`.
For Express.js conversion details, see `serverless-to-express-migration_admin.md` and `serverless-to-express-migration_user.md`.
For auth migration, see `auth-migration-supabase-to-self-managed.md`.

---

## Current Architecture Summary

| Component | Current | Target |
|-----------|---------|--------|
| Compute | Vercel Serverless Functions (60s max) | AWS EC2 (Express.js, no timeout) |
| Frontend Hosting | Vercel CDN (separate build output) | Express.js `express.static()` (same origin as API) |
| Database | Supabase PostgreSQL (HTTP API, `hubspot_sync` schema) | AWS RDS PostgreSQL (connection pool via `pg`) |
| Cache | Upstash Redis (cloud) | AWS ElastiCache Redis |
| Auth | Supabase Auth (JWT) | Self-managed JWT (`jsonwebtoken` + `bcrypt`) |
| Cron Jobs | Vercel Cron (`vercel.json`) | `node-cron` inside Express.js process |
| DNS / TLS | Vercel Domains | AWS Route 53 + ACM + ALB |
| Secrets | Vercel Environment Variables | AWS Secrets Manager / SSM Parameter Store |
| File Routing | Vercel file-based routing (`api/endpoint.js`) | Express.js router (`app.get('/api/endpoint', handler)`) |

### Target Deployment Topology

```
                        ┌─────────────────────────┐
                        │      AWS ALB (HTTPS)     │
                        │   (ACM TLS termination)  │
                        └──────────┬──────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
        admin.prepdoctors.com          booking.prepdoctors.com
                    │                             │
                    ▼                             ▼
        ┌──────────────────┐          ┌──────────────────┐
        │  EC2: Admin App  │          │  EC2: User App   │
        │  Express :3001   │          │  Express :3000   │
        │  API + Frontend  │          │  API + Frontend  │
        │  + node-cron     │          │                  │
        └──────────────────┘          └──────────────────┘
                    │                             │
              ┌─────┴─────┐                ┌─────┴─────┐
              ▼           ▼                ▼           ▼
        ┌──────────┐ ┌──────────┐   ┌──────────┐ ┌──────────┐
        │ RDS      │ │ElastiCache│  │ RDS      │ │ElastiCache│
        │ Postgres │ │ Redis    │   │ Postgres │ │ Redis    │
        └──────────┘ └──────────┘   └──────────┘ └──────────┘
```

---

## Phase 0: Pre-Migration Preparation

**Goal:** Set up AWS accounts, tooling, and staging environment without touching production.

| # | Task | Details | Done |
|---|------|---------|------|
| 1 | Create AWS account and configure IAM | Root account, admin IAM user, MFA enabled. Create IAM roles for EC2, RDS, ElastiCache, Secrets Manager, SSM, Route 53 | |
| 2 | Set up AWS CLI locally | `aws configure` with access keys. Test with `aws sts get-caller-identity` | |
| 3 | Choose AWS region | Match your Upstash Redis region (us-east-1) for lowest latency. All services in same region | |
| 4 | Set up VPC and networking | Create VPC with public + private subnets. RDS and ElastiCache in private subnets. EC2 in public subnet (or behind ALB). Security groups for each service | |
| 5 | Create staging environment | Separate from production. Mirror all services. Use for testing before cutover | |
| 6 | Document all current environment variables | Export from Vercel dashboard for both admin and user apps. Store in a secure location (never in git) | |
| 7 | Audit current Supabase database | Export full schema: tables, views, functions, indexes, triggers. Document the `hubspot_sync` schema completely. List all RLS policies (if any) | |
| 8 | Create a migration branch in git | `feature/aws-migration` — all migration work happens here | |

---

## Phase 1: Express.js Conversion (Keep Supabase + Upstash)

**Goal:** Convert both apps from Vercel serverless to Express.js while keeping the existing data layer (Supabase, Upstash Redis) unchanged. This is the safest first step — only the request/response layer changes.

See `serverless-to-express-migration_admin.md` and `serverless-to-express-migration_user.md` for endpoint-by-endpoint details.

| # | Task | Details | Done |
|---|------|---------|------|
| 1 | Install Express dependencies | `express`, `helmet`, `compression`, `morgan`, `node-cron` (admin only), `express-rate-limit` (user only). **No `cors` needed** — same-origin architecture | |
| 2 | Create `src/server.js` for each app | Admin on port 3001, User on port 3000. API routes → static file serving → SPA fallback. See migration PRDs for exact code | |
| 3 | Port security headers to helmet | Replace `vercel.json` headers with `helmet()` middleware. `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, HSTS, XSS protection | |
| 4 | Convert file-based routes to Express router | Vercel `api/admin/mock-exams/[id].js` → Express `router.get('/:id', handler)`. Group by domain into route files | |
| 5 | Convert all handlers to controllers | Remove `if (req.method !== 'POST')` checks (router handles). Change `module.exports = async (req, res) => {}` to named exports with `next(error)`. Change `req.query.id` to `req.params.id` for dynamic routes | |
| 6 | Convert auth middleware to Express pattern | `requireAdmin(req)` called inside handler → `requireAdmin` as `(req, res, next)` middleware on router. Populate `req.user` | |
| 7 | Create global error handler | `(err, req, res, next)` middleware. Handle known error types (validation, race condition, insufficient credits). Never expose stack traces in production | |
| 8 | Create validation middleware | `validateBody(schema)` returns `(req, res, next)`. Replaces inline `schemas.x.validate(req.body)` calls | |
| 9 | Move `_shared/` to `services/` | Rename directory. Update all import paths: `require('../_shared/` → `require('../services/` | |
| 10 | Serve frontend static files | `app.use(express.static(path.join(__dirname, '../frontend/dist')))` (user) or `../admin_frontend/dist` (admin). Add SPA catch-all: `app.get('*', (req, res) => res.sendFile('index.html'))` | |
| 11 | **Admin only:** Port cron jobs to `node-cron` | `activate-scheduled-exams`: `0 17,18 * * *`. `sync-bookings-from-supabase`: `*/15 * * * *`. `sync-exams-backfill-bookings-from-hubspot`: `0 * * * *`. Start scheduler in `server.js` after `app.listen()` | |
| 12 | Add graceful shutdown | Handle `SIGTERM`/`SIGINT`: close Redis connection, stop accepting requests, drain active connections | |
| 13 | Add health check endpoint | `GET /api/health` → returns 200 with timestamp. Used by ALB target group health checks | |
| 14 | **Admin API:** Port all 48 endpoints | Auth (8), bookings (2), mock-exams (18), trainees (4), sync (1), cron (3), public bookings (2), health (1). See admin migration PRD for full route list | |
| 15 | **User API:** Port all 12 endpoints | Bookings (3), mock-exams (3), mock-discussions (3), user (2), health (1). See user migration PRD for full route list | |
| 16 | Update `package.json` scripts | `"start": "node src/server.js"`, `"dev": "nodemon src/server.js"` | |
| 17 | Test locally against existing Supabase + Upstash | Run Express apps locally. They still connect to Supabase and Upstash (same env vars). Compare every endpoint's response to the live Vercel deployment | |
| 18 | Build frontends and verify static serving | `cd admin_frontend && npm run build`. `cd frontend && npm run build`. Verify Express serves the apps correctly at `http://localhost:3001` and `http://localhost:3000` | |

**Done when:** Both Express apps run locally, serve their frontends, all endpoints return identical responses to Vercel, and cron jobs execute on schedule. Data layer is still Supabase + Upstash — unchanged.

---

## Phase 2: Secrets & Environment Management

**Goal:** All secrets in AWS Secrets Manager, all config in SSM Parameter Store. This must be done before deploying Express to EC2.

| # | Task | Details | Done |
|---|------|---------|------|
| 1 | Create secrets in AWS Secrets Manager | `HS_PRIVATE_APP_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `CRON_SECRET`, future RDS credentials | |
| 2 | Create parameters in SSM Parameter Store | `SUPABASE_URL`, `REDIS_URL`, `NODE_ENV`, HubSpot object type IDs, cache TTL values | |
| 3 | Create a config loader module | `src/config/environment.js` — reads from Secrets Manager + SSM on startup, caches locally. Falls back to `process.env` for local development | |
| 4 | Set up IAM roles for EC2 | EC2 instance profile with permission to read from Secrets Manager and SSM. No access keys in application code | |
| 5 | Ensure `.env` is in `.gitignore` | Application reads from AWS services in production, `.env` file for local dev only | |
| 6 | Test Express apps with AWS secrets | Deploy to staging EC2 instance. Verify apps start and read secrets correctly. Verify they still connect to Supabase + Upstash | |

**Done when:** Express apps running on EC2 read all config from AWS services. No hardcoded credentials.

---

## Phase 3: Database Migration (Supabase → RDS PostgreSQL)

**Goal:** Run PostgreSQL on RDS with the same schema. Express apps swap from Supabase client to `pg` connection pool.

| # | Task | Details | Done |
|---|------|---------|------|
| 1 | Provision RDS PostgreSQL instance | Engine: PostgreSQL 15+. Instance: db.t3.medium (staging), db.t3.large (production). Multi-AZ for production. Encrypted storage. Place in private subnet (same VPC as EC2) | |
| 2 | Create the `hubspot_sync` schema on RDS | `CREATE SCHEMA hubspot_sync;` — match exact schema name from Supabase | |
| 3 | Export Supabase schema DDL | Use `pg_dump --schema-only --schema=hubspot_sync` from Supabase. This gives all tables, indexes, constraints, views, functions | |
| 4 | Import schema into RDS | Run the DDL export against RDS. Verify all tables, views, and functions exist | |
| 5 | Migrate database functions | Export all stored procedures / SQL functions. Key ones: `create_booking_atomic()`, `get_booking_aggregates()`, `get_booking_aggregates_count()`, `booking_details_view` | |
| 6 | Export and import data | Use `pg_dump --data-only --schema=hubspot_sync` from Supabase. Import into RDS. Verify row counts match | |
| 7 | Replace Supabase client with `pg` | Install `pg` package. Create a shared `db.js` module with connection pooling. Replace all `supabaseAdmin.from('table').select()` calls with parameterized SQL queries (`$1`, `$2`) | |
| 8 | Update all query patterns | Supabase builder pattern (`.from().select().eq()`) → parameterized SQL. This is the bulk of the work | |
| 9 | Test all read operations | Run every GET endpoint against RDS. Compare responses to Supabase-backed version | |
| 10 | Test all write operations | Create, update, delete on RDS. Verify data integrity. Test booking creation atomic function | |
| 11 | Set up automated backups | RDS automated backups: 7-day retention. Point-in-time recovery enabled | |
| 12 | Store RDS credentials in Secrets Manager | Update the secret created in Phase 2. Enable automatic rotation | |

**Done when:** All API endpoints work against RDS with identical responses to the Supabase-backed version.

---

## Phase 4: Cache Migration (Upstash Redis → ElastiCache)

**Goal:** Redis on AWS with same caching and locking behavior. Can run in parallel with Phase 3.

| # | Task | Details | Done |
|---|------|---------|------|
| 1 | Provision ElastiCache Redis cluster | Engine: Redis 7.x. Node type: cache.t3.micro (staging), cache.t3.medium (production). Place in private subnet (same VPC as EC2/RDS) | |
| 2 | Update Redis connection string | Change `REDIS_URL` from Upstash URL to ElastiCache endpoint. ElastiCache uses `redis://` protocol (no auth by default in VPC) or `rediss://` with TLS | |
| 3 | Update SSM Parameter Store | Update `REDIS_URL` parameter to ElastiCache endpoint | |
| 4 | Test the `RedisLockService` class | Verify: `acquireLockWithRetry()`, `releaseLock()`, `cacheGet()`, `cacheSet()`, `cacheDelete()`. Lua scripts for atomic lock release must work on ElastiCache | |
| 5 | Test OTP storage and expiry | `setex()` with TTL must work. Verify OTP creation, verification, and auto-expiry | |
| 6 | Verify no Upstash-specific features used | Upstash has REST API mode — confirm only standard Redis protocol is used (`ioredis` library — yes, standard) | |

**Done when:** All Redis operations (locking, caching, OTP) work on ElastiCache with same behavior.

---

## Phase 5: Auth Migration (Supabase Auth → Self-Managed)

**Goal:** JWT authentication without Supabase dependency. This is the highest-risk phase — do it after infrastructure is stable.

See `auth-migration-supabase-to-self-managed.md` for full details.

| # | Task | Details | Done |
|---|------|---------|------|
| 1 | Create a `users` table in RDS | Columns: id (UUID), email, password_hash, user_role, permissions, user_metadata, device_fingerprint, created_at, updated_at | |
| 2 | Migrate existing users | Export from Supabase Auth. Passwords are already bcrypt-hashed — insert directly. Verify count matches | |
| 3 | Install auth packages | `jsonwebtoken` (JWT signing/verification), `bcrypt` (password hashing). Replace `@supabase/supabase-js` auth calls | |
| 4 | Create JWT signing key | Generate RSA key pair or use HS256 with a strong secret. Store in AWS Secrets Manager | |
| 5 | Rewrite `login.js` | Replace `supabasePublic.auth.signInWithPassword()` with: query user by email → `bcrypt.compare(password, hash)` → `jwt.sign(payload, secret)` | |
| 6 | Rewrite `requireAuth.js` | Replace `supabaseAdmin.auth.getUser(token)` with: `jwt.verify(token, secret)`. Keep timestamp validation and device fingerprint check | |
| 7 | Rewrite `refresh.js` | Replace Supabase refresh with: verify refresh token from DB → issue new access + refresh token pair → rotate refresh token | |
| 8 | Rewrite `logout.js` | Replace `supabaseAdmin.auth.admin.signOut()` with: delete refresh token from DB (or add to blacklist table) | |
| 9 | Update `verifyToken()` in `supabase.js` | This is the core function used everywhere. Replace Supabase verification with `jwt.verify()`. Keep the same return signature `{ user, error }` | |
| 10 | Update frontend `AuthContext.jsx` | Replace Supabase auth listeners with custom token management. Keep localStorage storage pattern. Update refresh interceptor | |
| 11 | Update frontend `supabaseClient.js` | Remove Supabase auth initialization. Remove entirely since DB is now RDS | |
| 12 | Rebuild frontends | `npm run build` for both apps after auth changes. Express serves the updated `dist/` | |
| 13 | Test full auth flow | Login → get tokens → make authenticated requests → refresh token → logout → verify token is invalid | |
| 14 | Test password reset flow | Request OTP → verify OTP → update password → login with new password | |
| 15 | Test device fingerprint | Login from Chrome → make requests (pass) → replay from different User-Agent (warning logged) | |

**Done when:** All auth flows work without any Supabase Auth dependency.

---

## Phase 6: DNS & Domain Cutover

**Goal:** Production domains point to AWS infrastructure via ALB.

| # | Task | Details | Done |
|---|------|---------|------|
| 1 | Set up Route 53 hosted zone | Import existing domain. Configure NS records with your registrar | |
| 2 | Create ACM SSL certificates | Request certificates for `admin.prepdoctors.com` and `booking.prepdoctors.com`. DNS validation. Must be in same region as ALB | |
| 3 | Create Application Load Balancer | Place in public subnet. Attach ACM certificate. HTTP → HTTPS redirect. Two target groups: admin-tg (port 3001) and user-tg (port 3000) | |
| 4 | Configure ALB listener rules | Host-based routing: `admin.prepdoctors.com` → admin-tg, `booking.prepdoctors.com` → user-tg | |
| 5 | Configure target group health checks | Admin: `GET /api/health` on port 3001. User: `GET /api/health` on port 3000. Healthy threshold: 2, interval: 30s | |
| 6 | Test ALB routing on staging | Verify both apps accessible via ALB DNS name. Verify health checks passing. Verify SPA routing works (direct URL navigation to `/dashboard` etc.) | |
| 7 | Plan cutover window | Schedule during low-traffic period. Lower DNS TTL to 60 seconds 48 hours before cutover. Notify team | |
| 8 | Update DNS records | Point `admin.prepdoctors.com` and `booking.prepdoctors.com` A/AAAA records (alias) to ALB | |
| 9 | Verify propagation | Use `dig` / `nslookup` to confirm DNS resolves to ALB. Test from multiple locations | |
| 10 | Monitor for 24 hours | Watch CloudWatch dashboards, error rates, latency. Keep Vercel deployment running as fallback | |

**Done when:** All production traffic flows through ALB → EC2 (Express). DNS fully propagated. Vercel is standby-only.

---

## Phase 7: Monitoring & Observability

**Goal:** Equivalent or better visibility than Vercel dashboard.

| # | Task | Details | Done |
|---|------|---------|------|
| 1 | Set up CloudWatch log groups | One per service: `/app/admin-api`, `/app/user-api`. Log retention: 30 days | |
| 2 | Configure structured logging | Use `winston` or `pino` logger. JSON format. Include: timestamp, level, request_id, user_id, duration | |
| 3 | Set up CloudWatch alarms | 5xx error rate > 1%, API latency p99 > 5s, cron job failure, RDS CPU > 80%, Redis memory > 80% | |
| 4 | Create CloudWatch dashboard | Panels: request count, error rate, latency percentiles, DB connections, cache hit rate, cron job status | |
| 5 | Set up health check monitoring | Route 53 health checks on `/api/health` for both apps. Auto-alert on failure | |
| 6 | Configure SNS notifications | Alarm notifications to email / Slack. Critical: 5xx errors, DB failures. Warning: high latency, cache misses | |

**Done when:** Dashboard provides full visibility. Alarms fire correctly on test failures.

---

## Phase 8: Decommission Vercel & Supabase

**Goal:** Clean shutdown of old infrastructure.

| # | Task | Details | Done |
|---|------|---------|------|
| 1 | Verify AWS is stable for 1 week | No critical errors. Latency within acceptable range. All cron jobs completing. Auth working for all users | |
| 2 | Disable Vercel cron jobs | Remove `crons` from `vercel.json` and redeploy. Prevents duplicate cron execution | |
| 3 | Redirect Vercel domains | Set up redirects from old Vercel URLs to new AWS domains (for any bookmarked links) | |
| 4 | Export Vercel deployment logs | Download any logs you want to keep for audit purposes | |
| 5 | Export Supabase data (final backup) | Full `pg_dump` of all schemas. Store in S3 for archival | |
| 6 | Delete Vercel projects | Remove admin and user projects from Vercel dashboard | |
| 7 | Delete Supabase project | After confirming RDS has all data and auth is fully migrated | |
| 8 | Cancel Vercel and Supabase subscriptions | If on paid plans, cancel billing | |
| 9 | Update documentation | Update `CLAUDE.md`, `README.md`, deployment docs to reflect AWS architecture. Remove all Vercel and Supabase references | |
| 10 | Update CI/CD | Remove Vercel GitHub integration. Finalize GitHub Actions for AWS deployment (build frontend → deploy to EC2) | |

**Done when:** Vercel and Supabase fully decommissioned. All documentation reflects AWS-only architecture.

---

## Rollback Plan

If any phase fails critically:

| Scenario | Rollback Action |
|----------|----------------|
| Express conversion bugs | Keep Vercel running. Fix Express issues on staging. Vercel is still production |
| RDS data corruption | Restore from automated RDS snapshot (point-in-time recovery). Revert Express config to use Supabase |
| ElastiCache issues | Revert `REDIS_URL` to Upstash. Restart Express |
| Auth migration breaks logins | Revert `requireAuth.js` to use Supabase Auth. Rebuild frontend with Supabase auth. Users re-login |
| DNS cutover issues | Switch DNS back to Vercel (low TTL enables fast rollback) |
| Cron job failures | Admin crons run inside Express — check logs. If critical, re-enable Vercel crons temporarily |
| Full rollback | Revert DNS to Vercel. All data still in Supabase. Vercel project still exists until Phase 8 |

**Critical rule:** Keep Vercel running in parallel until Phase 8. Never decommission until AWS is proven stable for 1+ week.

---

## Timeline Estimate

| Phase | Duration | Can parallelize with | Risk Level |
|-------|----------|---------------------|------------|
| Phase 0: Preparation | 1 week | — | Low |
| Phase 1: Express Conversion | 2-3 weeks | — | Medium |
| Phase 2: Secrets & Environment | 3 days | Phase 1 (late stage) | Low |
| Phase 3: Database (Supabase → RDS) | 2 weeks | — | High |
| Phase 4: Cache (Upstash → ElastiCache) | 3 days | Phase 3 | Low |
| Phase 5: Auth Migration | 1-2 weeks | — | High |
| Phase 6: DNS & Domain Cutover | 1 day | Phase 5 done | Medium |
| Phase 7: Monitoring | 1 week | Phase 6 | Low |
| Phase 8: Decommission | 1 day (after 1-week soak) | — | Low |
| **Total** | **8-11 weeks** | | |

**Why this order:**
1. **Express first** — only changes the request/response layer. Keeps Supabase + Upstash. Lowest risk, highest confidence.
2. **Secrets before EC2 deploy** — Express needs config to start on AWS.
3. **Database before auth** — auth migration needs the `users` table in RDS.
4. **Cache in parallel with database** — just a connection string swap, independent of DB schema work.
5. **Auth last (before cutover)** — highest risk change. Everything else should be stable first.
6. **DNS cutover only after all services migrated** — one clean switch, not incremental.

---

## Key Risks

| Risk | Mitigation |
|------|-----------|
| Supabase query builder → raw SQL conversion errors | Extensive integration testing. Run both in parallel and compare responses |
| Auth migration locks users out | Test with staging users first. Keep Supabase Auth running until validated |
| HubSpot sync breaks during cron migration | Idempotency keys prevent duplicates. Test cron jobs thoroughly in Phase 1 |
| DNS propagation delays | Lower TTL to 60s 48 hours before cutover |
| ElastiCache Lua script incompatibility | Test all distributed lock operations in Phase 4. Redis protocol is standard |
| Express SPA fallback intercepts API routes | API routes MUST be registered before the `*` catch-all. Test all endpoints after frontend serving is added |
| Frontend build not included in Docker image | Multi-stage Dockerfile builds frontend first. Verify `dist/` exists in container |

---

*Created: January 2026*
*Revised: February 2026 — Reordered phases (Express-first), removed S3/CloudFront (Express serves frontend), removed CORS (same-origin), absorbed cron jobs into Express conversion*
*Author: Claude Code*
*Status: Draft*
