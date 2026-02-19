# AWS Migration - Step-by-Step Checklist

## Overview

This is the operational checklist for migrating the Mocks Booking platform from Vercel + Supabase to AWS. It's organized into phases that can be executed sequentially. Each phase has a clear "done when" criteria.

For architectural decisions and target state, see `aws-full-migration-with-shared-architecture.md`.
For Express.js conversion details, see `serverless-to-express-migration_admin.md` and `serverless-to-express-migration_user.md`.
For auth migration, see `auth-migration-supabase-to-self-managed.md`.

---

## Current Architecture Summary

| Component | Current | Target |
|-----------|---------|--------|
| Compute | Vercel Serverless Functions (60s max) | AWS EC2 / ECS (Express.js) |
| Database | Supabase PostgreSQL (HTTP API, `hubspot_sync` schema) | AWS RDS PostgreSQL (connection pool) |
| Cache | Upstash Redis (cloud) | AWS ElastiCache Redis |
| Auth | Supabase Auth (JWT) | Self-managed JWT (jsonwebtoken + bcrypt) |
| Frontend Hosting | Vercel CDN | AWS S3 + CloudFront |
| Cron Jobs | Vercel Cron (vercel.json) | AWS EventBridge + Lambda (or node-cron on EC2) |
| DNS | Vercel Domains | AWS Route 53 |
| Secrets | Vercel Environment Variables | AWS Secrets Manager / SSM Parameter Store |
| File Routing | Vercel file-based routing (`api/endpoint.js`) | Express.js router (`app.get('/api/endpoint', handler)`) |

---

## Phase 0: Pre-Migration Preparation

**Goal:** Set up AWS accounts, tooling, and staging environment without touching production.

| # | Task | Details | Done |
|---|------|---------|------|
| 1 | Create AWS account and configure IAM | Root account, admin IAM user, MFA enabled. Create IAM roles for EC2, RDS, ElastiCache, S3, CloudFront, EventBridge | |
| 2 | Set up AWS CLI locally | `aws configure` with access keys. Test with `aws sts get-caller-identity` | |
| 3 | Choose AWS region | Match your Upstash Redis region (us-east-1) for lowest latency. All services in same region | |
| 4 | Set up VPC and networking | Create VPC with public + private subnets. RDS and ElastiCache in private subnets. EC2 in public subnet (or behind ALB). Security groups for each service | |
| 5 | Create staging environment | Separate from production. Mirror all services. Use for testing before cutover | |
| 6 | Document all current environment variables | Export from Vercel dashboard for both admin and user apps. Store in a secure location (never in git) | |
| 7 | Audit current Supabase database | Export full schema: tables, views, functions, indexes, triggers. Document the `hubspot_sync` schema completely. List all RLS policies (if any) | |
| 8 | Create a migration branch in git | `feature/aws-migration` — all migration work happens here | |

---

## Phase 1: Database Migration (Supabase → RDS PostgreSQL)

**Goal:** Run PostgreSQL on RDS with the same schema. Both environments working in parallel.

| # | Task | Details | Done |
|---|------|---------|------|
| 1 | Provision RDS PostgreSQL instance | Engine: PostgreSQL 15+. Instance: db.t3.medium (staging), db.t3.large (production). Multi-AZ for production. Encrypted storage | |
| 2 | Create the `hubspot_sync` schema on RDS | `CREATE SCHEMA hubspot_sync;` — match exact schema name | |
| 3 | Export Supabase schema DDL | Use `pg_dump --schema-only --schema=hubspot_sync` from Supabase. This gives you all tables, indexes, constraints, views, functions | |
| 4 | Import schema into RDS | Run the DDL export against RDS. Verify all tables, views, and functions exist | |
| 5 | Migrate database functions | Export all stored procedures / SQL functions. Key ones: `create_booking_atomic()`, `get_booking_aggregates()`, `get_booking_aggregates_count()`, `booking_details_view` | |
| 6 | Export and import data | Use `pg_dump --data-only --schema=hubspot_sync` from Supabase. Import into RDS. Verify row counts match | |
| 7 | Replace Supabase client with node-postgres | Install `pg` package. Replace all `supabaseAdmin.from('table').select()` calls with `pool.query('SELECT ...')`. Create a shared `db.js` module with connection pooling | |
| 8 | Update all query patterns | Supabase client uses builder pattern (`.from().select().eq()`). Replace with parameterized SQL queries (`$1`, `$2` placeholders) | |
| 9 | Test all read operations | Run every GET endpoint against RDS. Compare responses to Supabase. Automated: write a script that calls both and diffs | |
| 10 | Test all write operations | Create, update, delete on RDS. Verify data integrity | |
| 11 | Set up automated backups | RDS automated backups: 7-day retention. Point-in-time recovery enabled | |

**Done when:** All API endpoints work against RDS with identical responses to Supabase.

---

## Phase 2: Cache Migration (Upstash Redis → ElastiCache)

**Goal:** Redis on AWS with same caching and locking behavior.

| # | Task | Details | Done |
|---|------|---------|------|
| 1 | Provision ElastiCache Redis cluster | Engine: Redis 7.x. Node type: cache.t3.micro (staging), cache.t3.medium (production). Place in private subnet (same VPC as EC2/RDS) | |
| 2 | Update Redis connection string | Change `PD_Bookings_Cache_REDIS_URL` from Upstash URL to ElastiCache endpoint. ElastiCache uses `redis://` protocol (no auth by default in VPC) or `rediss://` with TLS | |
| 3 | Test the `RedisLockService` class | Verify: `acquireLockWithRetry()`, `releaseLock()`, `cacheGet()`, `cacheSet()`, `cacheDelete()`. Lua scripts for atomic lock release must work on ElastiCache | |
| 4 | Test OTP storage and expiry | `setex()` with TTL must work. Verify OTP creation, verification, and auto-expiry | |
| 5 | Test rate limiting | Verify in-memory rate limiting still works (no Redis change needed). If migrating to Redis-based rate limiting, test `incr()` + `expire()` pattern | |
| 6 | Verify no Upstash-specific features used | Upstash has REST API mode — confirm you're using standard Redis protocol only (you are — `ioredis` library) | |

**Done when:** All Redis operations (locking, caching, OTP) work on ElastiCache with same behavior.

---

## Phase 3: Auth Migration (Supabase Auth → Self-Managed)

**Goal:** JWT authentication without Supabase dependency.

See `auth-migration-supabase-to-self-managed.md` for full details. Summary checklist:

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
| 11 | Update frontend `supabaseClient.js` | Remove Supabase auth initialization. Keep only database client (if still using Supabase as DB) or remove entirely if migrated to RDS | |
| 12 | Test full auth flow | Login → get tokens → make authenticated requests → refresh token → logout → verify token is invalid | |
| 13 | Test password reset flow | Request OTP → verify OTP → update password → login with new password | |
| 14 | Test device fingerprint | Login from Chrome → make requests (pass) → replay from different User-Agent (warning logged) | |

**Done when:** All auth flows work without any Supabase Auth dependency.

---

## Phase 4: API Migration (Vercel Serverless → Express.js)

**Goal:** All API endpoints running in Express.js on EC2/ECS.

See `serverless-to-express-migration_admin.md` and `serverless-to-express-migration_user.md` for endpoint-by-endpoint details.

| # | Task | Details | Done |
|---|------|---------|------|
| 1 | Create Express.js project structure | Two apps: `admin-api/` and `user-api/` (or unified). Install Express, cors, helmet, compression, morgan | |
| 2 | Set up Express middleware chain | Order: `helmet()` → `cors()` → `compression()` → `express.json()` → `morgan()` → routes → error handler | |
| 3 | Port security headers to helmet | Replace `vercel.json` headers with `helmet({ frameguard: { action: 'deny' }, contentSecurityPolicy: {...}, hsts: {...} })` | |
| 4 | Port CORS configuration | Move `cors.js` allowlist logic into Express `cors()` middleware config. Keep same origin allowlist | |
| 5 | Convert file-based routes to Express router | Vercel: `api/admin/groups/create.js` → Express: `router.post('/admin/groups/create', handler)`. Each `[id].js` becomes `:id` parameter | |
| 6 | **Admin API:** Port all 107 endpoints | Group by domain: auth (8), groups (10+), instructors (10+), mock-exams (25+), work-check-slots, work-check-bookings, cron (4), instructor portal (5) | |
| 7 | **User API:** Port all 27 endpoints | Domains: bookings (3), mock-exams (3), work-checks (5), user (2), health (1), dashboard (1), mock-discussions (3) | |
| 8 | Port `_shared/` utilities | `cors.js`, `supabase.js` (→ `db.js`), `redis.js`, `validation.js`, `sanitize.js`, `cache.js`, `auth.js` | |
| 9 | Port validation middleware | Keep Joi schemas. Adapt `validationMiddleware()` for Express `(req, res, next)` pattern | |
| 10 | Port auth middleware | Convert `requireAuth`, `requireAdmin`, `requirePermission`, `requireRole` to Express middleware `(req, res, next)` | |
| 11 | Add health check endpoint | `GET /health` → returns 200 with DB and Redis connection status | |
| 12 | Add graceful shutdown | Handle `SIGTERM`/`SIGINT`: close DB pool, close Redis, stop accepting requests, drain active connections | |
| 13 | Test every endpoint | Automated: Postman collection or integration test suite. Compare responses to Vercel deployment | |

**Done when:** `npm start` runs Express.js server locally, all endpoints return identical responses to Vercel deployment.

---

## Phase 5: Cron Job Migration (Vercel Cron → EventBridge + Lambda)

**Goal:** All 4 scheduled jobs running on AWS.

| # | Task | Details | Done |
|---|------|---------|------|
| 1 | Choose cron strategy | **Option A:** AWS EventBridge rules → Lambda functions (serverless, closest to current). **Option B:** `node-cron` inside Express.js (simpler, runs on EC2). **Option C:** EventBridge → API Gateway → Express endpoint (hybrid) | |
| 2 | Port `activate-scheduled-exams` | Runs twice daily (5 PM + 6 PM UTC). Activates exams where `scheduled_activation_datetime <= now()` | |
| 3 | Port `sync-bookings-from-supabase` | Runs every 15 minutes. Creates HubSpot bookings for Supabase records missing `hubspot_id` | |
| 4 | Port `sync-exams-backfill-bookings-from-hubspot` | Runs every hour. Syncs exam data from HubSpot to database | |
| 5 | Port `activate-scheduled-slots` | Runs daily at noon UTC. Activates work check slots with `available_from <= now()` | |
| 6 | Replace CRON_SECRET authentication | Vercel sends `Authorization: Bearer {CRON_SECRET}`. On AWS: if using Lambda, IAM role handles auth. If using API call, keep CRON_SECRET pattern | |
| 7 | Set up CloudWatch monitoring | Alarms for: cron job failures, execution duration > threshold, error rate > 0 | |
| 8 | Test each job manually | Trigger each job and verify it completes successfully against RDS + HubSpot | |
| 9 | Run on schedule for 48 hours alongside Vercel crons | Both environments running. Compare sync results. Verify no duplicate operations (idempotency keys protect this) | |

**Done when:** All 4 cron jobs run on schedule on AWS, producing identical results to Vercel crons.

---

## Phase 6: Frontend Hosting (Vercel CDN → S3 + CloudFront)

**Goal:** Both React apps served from AWS with CDN caching and SPA routing.

| # | Task | Details | Done |
|---|------|---------|------|
| 1 | Create S3 buckets | Two buckets: `mocks-booking-admin` and `mocks-booking-user`. Enable static website hosting. Block all public access (CloudFront will access via OAI) | |
| 2 | Build both frontends | `cd admin_root/admin_frontend && npm run build` → `dist/`. `cd user_root/frontend && npm run build` → `dist/` | |
| 3 | Upload build output to S3 | `aws s3 sync dist/ s3://bucket-name/`. Set `Cache-Control` headers: `max-age=31536000, immutable` for `assets/`, `no-cache` for `index.html` | |
| 4 | Create CloudFront distributions | One per app. Origin: S3 bucket. Default root object: `index.html`. Error pages: 403/404 → `/index.html` (SPA routing). HTTPS only. TLS 1.2+ | |
| 5 | Configure SPA routing | CloudFront custom error responses: 404 → `/index.html` with 200 status. This replaces Vercel's `rewrites` for SPA routing | |
| 6 | Configure API routing | CloudFront behavior: `/api/*` → ALB/EC2 origin (Express.js). Everything else → S3 origin. This replaces Vercel's dual serving | |
| 7 | Update VITE environment variables | `VITE_API_BASE_URL` → point to CloudFront distribution URL or custom domain. `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` → remove if fully migrated off Supabase | |
| 8 | Set up CI/CD for frontend deployments | GitHub Actions: on push to main → build → `aws s3 sync` → CloudFront invalidation (`/*`) | |
| 9 | Test SPA routing | Navigate to `/work-check/instructors/some-uuid` directly → should load correctly (not 404) | |
| 10 | Test asset caching | Verify `assets/*.js` returns `Cache-Control: max-age=31536000`. Verify `index.html` returns `Cache-Control: no-cache` | |

**Done when:** Both apps load from CloudFront URLs with correct SPA routing and API proxying.

---

## Phase 7: DNS & Domain Cutover

**Goal:** Production domains point to AWS infrastructure.

| # | Task | Details | Done |
|---|------|---------|------|
| 1 | Set up Route 53 hosted zone | Import existing domain. Configure NS records with your registrar | |
| 2 | Create ACM SSL certificates | Request certificates in ACM for your domains. Use DNS validation. Must be in us-east-1 for CloudFront | |
| 3 | Attach certificates to CloudFront | Associate ACM cert with each CloudFront distribution. Configure alternate domain names (CNAMEs) | |
| 4 | Set up ALB with SSL | Application Load Balancer in front of EC2/ECS. ACM certificate attached. HTTP → HTTPS redirect | |
| 5 | Update CORS origins | Add new domain URLs to the CORS allowlist in Express.js config. Keep old Vercel URLs during transition | |
| 6 | Plan cutover window | Schedule during low-traffic period. DNS TTL: lower to 60 seconds 48 hours before cutover. Notify team | |
| 7 | Update DNS records | Point A/AAAA records to CloudFront distribution. Point API subdomain to ALB (if separate) | |
| 8 | Verify propagation | Use `dig` / `nslookup` to confirm DNS resolves to AWS. Test from multiple locations | |
| 9 | Monitor for 24 hours | Watch CloudWatch dashboards, error rates, latency. Keep Vercel deployment running as fallback | |
| 10 | Remove old Vercel URLs from CORS | Once confirmed stable, remove Vercel preview URLs from CORS allowlist | |

**Done when:** All production traffic flows through AWS. DNS fully propagated. Vercel is standby-only.

---

## Phase 8: Secrets & Environment Management

**Goal:** All secrets in AWS Secrets Manager, all config in SSM Parameter Store.

| # | Task | Details | Done |
|---|------|---------|------|
| 1 | Create secrets in AWS Secrets Manager | `HS_PRIVATE_APP_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY` (if still used), `JWT_SECRET`, `CRON_SECRET`, RDS credentials | |
| 2 | Create parameters in SSM Parameter Store | `SUPABASE_URL`, `REDIS_URL`, `FRONTEND_URL`, `NODE_ENV`, HubSpot object type IDs, cache TTL values | |
| 3 | Update application to read from AWS | Use `@aws-sdk/client-secrets-manager` for secrets. Use `@aws-sdk/client-ssm` for parameters. Cache locally on startup (don't fetch per-request) | |
| 4 | Set up IAM roles for EC2/Lambda | EC2 instance profile with permission to read from Secrets Manager and SSM. No access keys in application code | |
| 5 | Remove `.env` files from deployment | Ensure `.env` is in `.gitignore`. Application reads from AWS services, not filesystem | |
| 6 | Set up secret rotation | Enable automatic rotation for RDS credentials. Schedule rotation for API keys (manual, quarterly) | |

**Done when:** Application starts and reads all config from AWS services. No `.env` file needed.

---

## Phase 9: Monitoring & Observability

**Goal:** Equivalent or better visibility than Vercel dashboard.

| # | Task | Details | Done |
|---|------|---------|------|
| 1 | Set up CloudWatch log groups | One per service: `/app/admin-api`, `/app/user-api`, `/app/cron-jobs`. Log retention: 30 days | |
| 2 | Configure structured logging | Use `winston` or `pino` logger. JSON format. Include: timestamp, level, request_id, user_id, duration | |
| 3 | Set up CloudWatch alarms | 5xx error rate > 1%, API latency p99 > 5s, cron job failure, RDS CPU > 80%, Redis memory > 80% | |
| 4 | Create CloudWatch dashboard | Panels: request count, error rate, latency percentiles, DB connections, cache hit rate, cron job status | |
| 5 | Set up health check monitoring | Route 53 health checks on `/health` endpoint. Auto-alert on failure | |
| 6 | Configure SNS notifications | Alarm notifications to email / Slack. Critical: 5xx errors, DB failures. Warning: high latency, cache misses | |

**Done when:** Dashboard provides full visibility. Alarms fire correctly on test failures.

---

## Phase 10: Decommission Vercel

**Goal:** Clean shutdown of Vercel infrastructure.

| # | Task | Details | Done |
|---|------|---------|------|
| 1 | Verify AWS is stable for 1 week | No critical errors. Latency within acceptable range. All cron jobs completing. Auth working for all users | |
| 2 | Disable Vercel cron jobs | Remove `crons` from `vercel.json` and redeploy. Prevents duplicate cron execution | |
| 3 | Redirect Vercel domains | Set up redirects from old Vercel URLs to new AWS domains (for any bookmarked links) | |
| 4 | Export Vercel deployment logs | Download any logs you want to keep for audit purposes | |
| 5 | Delete Vercel projects | Remove admin and user projects from Vercel dashboard | |
| 6 | Cancel Vercel subscription | If on a paid plan, cancel billing | |
| 7 | Update documentation | Update `CLAUDE.md`, `README.md`, deployment docs to reflect AWS architecture. Remove all Vercel references | |
| 8 | Update CI/CD | Remove Vercel GitHub integration. Finalize GitHub Actions for AWS deployment | |

**Done when:** Vercel fully decommissioned. All documentation reflects AWS-only architecture.

---

## Rollback Plan

If any phase fails critically:

| Scenario | Rollback Action |
|----------|----------------|
| RDS data corruption | Restore from automated RDS snapshot (point-in-time recovery) |
| Auth migration breaks logins | Revert `requireAuth.js` to use Supabase Auth. Users re-login |
| Express.js API errors | DNS switch back to Vercel (if still running). Lower DNS TTL beforehand |
| Cron job failures | Re-enable Vercel crons in `vercel.json` and redeploy |
| Frontend not loading | Switch CloudFront to maintenance page. Revert DNS to Vercel |
| Full rollback | Revert DNS to Vercel. All data still in Supabase. Vercel project still exists until Phase 10 |

**Critical rule:** Keep Vercel running in parallel until Phase 10. Never decommission until AWS is proven stable for 1+ week.

---

## Timeline Estimate

| Phase | Duration | Can parallelize with |
|-------|----------|---------------------|
| Phase 0: Preparation | 1 week | — |
| Phase 1: Database | 2 weeks | — |
| Phase 2: Cache | 3 days | Phase 1 |
| Phase 3: Auth | 1-2 weeks | Phase 2 |
| Phase 4: API | 2-3 weeks | Phase 3 |
| Phase 5: Cron Jobs | 3 days | Phase 4 |
| Phase 6: Frontend | 1 week | Phase 4 |
| Phase 7: DNS Cutover | 1 day | Phase 5 + 6 done |
| Phase 8: Secrets | 3 days | Phase 4 |
| Phase 9: Monitoring | 1 week | Phase 7 |
| Phase 10: Decommission | 1 day (after 1 week soak) | — |
| **Total** | **8-12 weeks** | |

---

## Key Risks

| Risk | Mitigation |
|------|-----------|
| Supabase query builder → raw SQL conversion errors | Extensive integration testing. Run both in parallel and compare responses |
| Auth migration locks users out | Test with staging users first. Keep Supabase Auth running until validated |
| HubSpot sync breaks during cron migration | Idempotency keys prevent duplicates. Run both Vercel + AWS crons briefly |
| DNS propagation delays | Lower TTL to 60s 48 hours before cutover |
| ElastiCache Lua script incompatibility | Test all distributed lock operations. Redis protocol is standard |
| Frontend environment variable mismatch | Build and test on staging CloudFront before production cutover |
