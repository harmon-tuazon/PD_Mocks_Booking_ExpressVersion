# CLAUDE.md - PrepDoctors Mock Exam Booking System

This file provides critical guidance to Claude Code (claude.ai/code) for this project.

## Core Development Philosophy

- **KISS**: Choose straightforward solutions over complex ones. Simple solutions are easier to understand, maintain, and debug.
- **YAGNI**: Implement features only when needed, not on speculation.
- **If it's not broken, don't fix it**: Reuse existing components, endpoints, and logic. Check `documentation/` for existing items before building new ones.
- **Do what has been asked; nothing more, nothing less.**
- NEVER create files unless absolutely necessary. Prefer editing existing files.
- NEVER proactively create documentation files unless explicitly requested.
- ALWAYS keep existing documentation in sync with code changes.
- NEVER use synchronous I/O operations.
- ALWAYS validate inputs with Joi schemas.
- NEVER store secrets in code.

## Monorepo Structure

This is a monorepo with two independently deployed Vercel applications:

| App | Path | Frontend | Deployment |
|-----|------|----------|------------|
| **User App** | `user_root/` | `user_root/frontend/` (React + Vite) | `cd user_root && vercel --prod` |
| **Admin App** | `admin_root/` | `admin_root/admin_frontend/` (React + Vite + shadcn/ui) | `cd admin_root && vercel --prod` |

Shared scripts, tests, and documentation live at the monorepo root.

## Architecture Overview

### Two-Tier Database Architecture

- **Supabase** (Primary for reads 100%, user writes 80%): ~50ms queries
- **HubSpot** (Legacy, admin writes): ~500ms API calls
- **Redis**: Caching layer

**Data Flow:**
- **Reads**: Redis Cache → Supabase → HubSpot Fallback + Auto-Populate
- **User Writes**: Supabase-first → HubSpot sync (fire-and-forget)
- **Admin Writes**: HubSpot-first → Supabase sync (fire-and-forget)

### Cron Jobs (Admin App - `admin_root/vercel.json`)

| Schedule | Job | Direction |
|----------|-----|-----------|
| `0 17,18 * * *` | `activate-scheduled-exams` | Activate exams at 5pm/6pm UTC |
| `*/15 * * * *` | `sync-bookings-from-supabase` | Supabase → HubSpot (new bookings where `hubspot_id IS NULL`) |
| `0 * * * *` | `sync-exams-backfill-bookings-from-hubspot` | HubSpot → Supabase (incremental via `hs_lastmodifieddate`) |

**Edge Function: `cascade-exam-updates`** — Real-time (<1s) property cascade from exam updates to associated bookings via webhook.

### Serverless Constraints (Vercel)

- Maximum **60 seconds** per function execution
- Stateless — every execution is independent
- Minimize dependencies, lazy load when possible
- Use `CRON_SECRET` for scheduled job authentication
- Never hardcode credentials; validate required env vars on startup

## Environment Variables

```bash
HUBSPOT_PRIVATE_APP_TOKEN=...    # HubSpot private app token (NEVER use HS_PRIVATE_APP_TOKEN in new code)
SUPABASE_URL=...                 # Supabase project URL
SUPABASE_SERVICE_ROLE_KEY=...    # Supabase service role key
REDIS_URL=...                    # Redis connection string
CRON_SECRET=...                  # Cron job authentication
CORS_ORIGIN=...                  # Frontend domain for CORS
```

## Authentication Policy

**Authentication-only model — no role-based authorization.**

- `requireAdmin` middleware only verifies Supabase JWT authentication (no role checking)
- Any authenticated user has full admin access
- Flow: `Request → requireAdmin() → requireAuth() → Supabase JWT Validation → Allow/Deny`
- Always use `requireAdmin` for admin endpoints (kept for backward compatibility)
- Do NOT implement custom role checking unless explicitly required

## HubSpot CRM Integration

### Custom Objects (Object Type IDs)

| Object | Type ID | Write Authority |
|--------|---------|----------------|
| Bookings | `2-50158943` | Admin |
| Mock Exams | `2-50158913` | Admin |
| Contacts | `0-1` | Both (credits) |
| Transactions | `2-47045790` | System |
| Payment Schedules | `2-47381547` | System |
| Credit Notes | `2-41609496` | System |
| Deals | `0-3` | System |
| Courses | `0-410` | Admin |
| Campus Venues | `2-41607847` | Admin |
| Enrollments | `2-41701559` | System |
| Lab Stations | `2-41603799` | Admin |

### Rate Limiting

- HubSpot API limit: 100 requests/10 seconds
- Always implement exponential backoff for retries
- Use batch API operations instead of individual calls in loops

## Variable Naming Standards & ID Conventions

The system uses **three parallel identifier systems**:
1. **Supabase UUIDs** — Primary keys in Supabase tables
2. **HubSpot Numeric IDs** — Legacy numeric IDs from HubSpot CRM
3. **Business Identifiers** — Human-readable strings for display (e.g., "SJ-123-March 1, 2026")

### Contact Identifiers

| Variable | Type | Usage |
|----------|------|-------|
| `hubspot_id` | numeric string | HubSpot contact record ID |
| `contact_id` | UUID string | Supabase PK (user app accepts both UUID and HubSpot ID) |
| `student_id` | alphanumeric | Business identifier for display |
| `associated_contact_id` | numeric string | FK in bookings table (HubSpot ID) |

User app endpoints accept EITHER UUID or HubSpot numeric ID via dual-check:
```javascript
if (supabaseContact.id === contact_id || supabaseContact.hubspot_id === contact_id)
```

**Cache keys ALWAYS use HubSpot numeric ID**: `booking:${hubspot_id}:${exam_date}`

### Booking Identifiers

| Variable | Type | Usage |
|----------|------|-------|
| `id` | UUID | Supabase PK — use for API operations |
| `hubspot_id` | numeric string | HubSpot record ID — use for API operations |
| `booking_id` | string | Human-readable — **DISPLAY ONLY, NEVER as API identifier** |
| `booking_code` | string | Alias for `booking_id` |
| `booking_record_id` | string | **DEPRECATED** — use `hubspot_id` |

### Mock Exam Identifiers

| Variable | Type | Usage |
|----------|------|-------|
| `mock_exam_id` | numeric string | HubSpot exam record ID (primary) |
| `id` | UUID | Supabase PK |
| `associated_mock_exam` | numeric string | FK in bookings (HubSpot ID) |
| `exam_id` | numeric string | **DEPRECATED** — use `mock_exam_id` |

### Credit Field Names (IMMUTABLE HubSpot Properties)

| Property | Exam Type |
|----------|-----------|
| `sj_credits` | Situational Judgment |
| `cs_credits` | Clinical Skills |
| `sjmini_credits` | Mini-mock |
| `mock_discussion_token` | Mock Discussion |
| `shared_mock_credits` | All types (fallback) |

Credit deduction: prioritize specific credits, fallback to `shared_mock_credits`.

### Timestamp Mapping

| HubSpot | Supabase |
|---------|----------|
| `createdate` | `created_at` |
| `hs_lastmodifieddate` | `updated_at` |
| — | `synced_at` (set to `new Date().toISOString()` on sync) |

## Supabase Table Schemas

### `hubspot_bookings`
```sql
id                      UUID PRIMARY KEY
hubspot_id              TEXT (HubSpot numeric ID)
booking_id              TEXT (human-readable)
associated_contact_id   TEXT (HubSpot contact ID)
associated_mock_exam    TEXT (HubSpot exam ID)
student_id              TEXT
name                    TEXT
student_email           TEXT
is_active               TEXT ('Active', 'Cancelled', 'Completed')
exam_date               DATE
start_time              TIMESTAMPTZ
end_time                TIMESTAMPTZ
mock_type               TEXT
token_used              TEXT
dominant_hand           TEXT
attending_location      TEXT
attendance              TEXT
created_at              TIMESTAMPTZ
updated_at              TIMESTAMPTZ
synced_at               TIMESTAMPTZ
```

### `hubspot_contact_credits`
```sql
id                      UUID PRIMARY KEY
hubspot_id              TEXT (HubSpot contact ID)
student_id              TEXT
email                   TEXT
firstname               TEXT
lastname                TEXT
sj_credits              INTEGER
cs_credits              INTEGER
sjmini_credits          INTEGER
mock_discussion_token   INTEGER
shared_mock_credits     INTEGER
created_at              TIMESTAMPTZ
updated_at              TIMESTAMPTZ
synced_at               TIMESTAMPTZ
```

## Supabase Primary Tables

| Table | Synced With | Purpose |
|-------|------------|---------|
| `hubspot_contact_credits` | HubSpot Contacts | Credit balances |
| `hubspot_mock_exams` | HubSpot Mock Exams | Exam sessions (capacity, dates, activation) |
| `hubspot_bookings` | HubSpot Bookings | Student bookings (attendance, tokens, refunds) |
| `sync_metadata` | — | Last sync timestamps for incremental syncing |

## Known Issues & Bugs

### HIGH PRIORITY

1. **Validation Schema Bug** (`user_root/api/bookings/create.js:120`):
   `schemas.booking` does not exist — must use `schemas.bookingCreation`

2. **Ambiguous ID Acceptance** (`user_root/api/bookings/create.js:130`):
   Accepts both UUID and HubSpot numeric ID — dual-check pattern required

3. **Duplicate Response Fields** (`user_root/api/bookings/list.js:188,199`):
   `mock_exam_id` and `associated_mock_exam` return same value

### MEDIUM PRIORITY

4. **Frontend Fallback Chain** (`user_root/frontend/src/services/api.js:386`):
   `id: booking.id || booking.hubspot_id || booking.recordId` — `recordId` is DEPRECATED

## Validation Schema Reference

**Available schemas in `validation.js`:**

| Schema | Endpoint |
|--------|----------|
| `bookingCreation` | POST /api/bookings/create |
| `bookingCancellation` | DELETE /api/bookings/[id] |
| `bookingsList` | GET /api/bookings/list |
| `creditValidation` | POST /api/mock-exams/validate-credits |
| `availableExams` | GET /api/mock-exams/available |
| `authCheck` | Authentication validation |
| `updateNdeccDate` | PUT /api/user/update-ndecc-date |

**`booking` schema DOES NOT EXIST** — always use `bookingCreation`.

```javascript
const { schemas } = require('../_shared/validation');
const { error, value } = schemas.bookingCreation.validate(req.body);
```

## Deployment

### Commands
```bash
# Deploy user app
cd user_root && vercel --prod

# Deploy admin app
cd admin_root && vercel --prod

# Staging
cd user_root && vercel    # or cd admin_root && vercel

# Use --force only when cached builds cause issues
vercel --prod --force
```

### Pre-Deployment Checklist
- [ ] All tests passing
- [ ] Environment variables configured in Vercel
- [ ] Clean rebuild (`rm -rf frontend/dist && npm run build`)
- [ ] Upload size is large (200MB+ = full monorepo, <10MB = incomplete)

### Post-Deployment Verification
- [ ] `/api/health` responds
- [ ] Login flow works
- [ ] Key UI components render
- [ ] Cron jobs executing (check Vercel dashboard)

## Development Workflow

### Essential Commands
```bash
primer                          # Load context (START EVERY SESSION)
generate-prd features/[x].md   # Generate PRD
execute-prd PRDs/[x].md        # Execute implementation

npm run build:user              # Build user app
npm run build:admin             # Build admin app
npm test                        # Run all tests
npm run test:coverage           # Check coverage (>70% required)
vercel dev                      # Local serverless development
```

### PRD Organization
All PRDs go in `/PRDs/admin/` or `/PRDs/user/` (kebab-case filenames, committed to git).

### Testing Requirements
- Minimum 70% coverage for critical paths
- Mock external API calls (Supabase, HubSpot, Stripe) in unit tests
- Test Supabase queries with realistic data volumes
- Test cache invalidation and sync behavior
- Test HubSpot integration with dry-run modes

### Security Requirements
- Always validate access tokens
- Use existing `validation.js` Joi patterns
- Sanitize HTML with `xss` library
- Validate all HubSpot object IDs
- Never expose internal errors to users

## Performance Guidelines

- **Batch operations**: Use Supabase bulk upserts and HubSpot batch API — never individual API calls in loops
- **Exponential backoff**: Always implement for HubSpot API retries (rate limit: 100 req/10s)
- **Supabase-first reads**: Redis → Supabase → HubSpot fallback + auto-populate
- **Fire-and-forget sync**: Immediate non-blocking sync after all mutations

## Common Pitfalls

1. Creating duplicate HubSpot properties — always check existing first
2. Forgetting record associations — critical for data integrity
3. Not handling rate limits — implement exponential backoff
4. Exposing internal errors — sanitize for users
5. Blocking operations — everything must be async
6. Missing CRON_SECRET — always authenticate cron jobs
7. React component structure — ensure proper JSX closure, single export per component

## Documentation References

- `documentation/HUBSPOT_SCHEMA_DOCUMENTATION.md` — HubSpot CRM integration reference
- `documentation/MOCK_DISCUSSIONS_MODULE.md` — Mock discussions system
- `documentation/api/TOKEN_REFUND_API.md` — Token refund API docs
- `documentation/DEPLOYMENT_GUIDE.md` — Production deployment procedures
- `documentation/AGENT_DEVELOPER_COORDINATION_RULES.md` — Agent coordination protocols

## MCP Servers

Use MCPs when available before manual implementation:

| MCP | Command | Use For |
|-----|---------|---------|
| **Serena** | `claude mcp add serena -- uvx --from git+https://github.com/oraios/serena serena start-mcp-server --context ide-assistant --project $(pwd)` | Code generation, refactoring, debugging |
| **Vercel** | `claude mcp add --transport http vercel https://mcp.vercel.com/` | Deployment, env vars, serverless config |
| **HubSpot** | TBD | CRM operations when available |

## Agent Development Team

Specialized agents write code (not execute runtime functions):

| Agent | Responsibility |
|-------|---------------|
| data-flow-architect | State flow design |
| hubspot-crm-specialist | HubSpot integration code |
| security-compliance-auditor | Validation schemas, security review |
| serverless-infra-engineer | Vercel config, deployment |
| react-frontend-engineer | Frontend components |
| node-backend-engineer | API endpoints |
| documentation-manager | Docs sync |
| validation-gates | Tests (>70% coverage) |

**Rules**: One developer per file. Code reviews by domain experts. Explicit handoffs.

---

_Framework Version: 1.0.0 | Last updated: September 7, 2025 | Created by Dr. Faris Marei_
