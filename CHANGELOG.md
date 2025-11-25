# Changelog

All notable changes to the PrepDoctors Mock Exam Booking System will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.2.0] - 2025-01-25

### Added - Supabase Secondary Database for Contact Credits

#### Architecture
- **Two-Tier Database System**: HubSpot as source of truth + Supabase as read-optimized secondary database
  - HubSpot: Authoritative source for all data writes
  - Supabase: Read-optimized cache for high-frequency queries
  - Performance: ~50ms Supabase reads vs ~500ms HubSpot API calls (90% faster)

#### Backend Implementation

**Supabase Tables** (automatically synced from HubSpot):
- `hubspot_contact_credits`: Contact credit balances
  - Fields: `hubspot_id`, `student_id`, `email`, `sj_credits`, `cs_credits`, `sjmini_credits`, `mock_discussion_token`, `shared_mock_credits`, `ndecc_exam_date`
  - Primary key: `hubspot_id`
  - Updated via: write-through sync + auto-populate + cron job

- `hubspot_mock_exams`: Mock exam sessions
  - Fields: exam details, capacity, total_bookings, is_active, scheduled_activation_datetime
  - Synced via: cron job + scheduled activation trigger

- `hubspot_bookings`: Student bookings
  - Fields: booking details, attendance, tokens, refund status
  - Synced via: cron job

**Data Sync Strategy** (Write-Through + Auto-Populate + Cron):

1. **Write-Through Sync** (Immediate, Non-Blocking):
   - Credit deduction during booking creation ([user_root/api/bookings/create.js](user_root/api/bookings/create.js:654-672))
   - Credit restoration during single cancellation ([user_root/api/bookings/[id].js](user_root/api/bookings/[id].js:513-562))
   - Credit restoration during batch cancellation ([user_root/api/bookings/batch-cancel.js](user_root/api/bookings/batch-cancel.js:275-322))
   - Admin batch cancellation sync ([admin_root/api/bookings/batch-cancel.js](admin_root/api/bookings/batch-cancel.js:222-269))
   - Bulk token refund sync ([admin_root/api/_shared/refund.js](admin_root/api/_shared/refund.js:241-281))
   - All write operations use `.then()/.catch()` pattern (fire-and-forget, don't block user operations)

2. **Auto-Populate on Cache Miss** (Fallback):
   - Credit validation endpoint reads from Supabase first ([user_root/api/mock-exams/validate-credits.js](user_root/api/mock-exams/validate-credits.js:134-161))
   - If not found in Supabase, fallback to HubSpot and auto-populate Supabase for future requests
   - Non-blocking sync prevents slowing down user operations

3. **Cron Job Sync** (Every 2 Hours):
   - Endpoint: `GET /api/admin/cron/sync-supabase` ([admin_root/api/admin/cron/sync-supabase.js](admin_root/api/admin/cron/sync-supabase.js))
   - Syncs: mock exams, bookings, AND contact credits (NEW)
   - Schedule: `0 */2 * * *` (every 2 hours) in vercel.json
   - Security: Requires `CRON_SECRET` from Vercel
   - Catches any missed syncs or manual HubSpot updates

**Critical Bug Fix**:
- Fixed auto-populate overwriting credits with 0 ([user_root/api/_shared/hubspot.js](user_root/api/_shared/hubspot.js:152-156))
- Root cause: `searchContacts` only fetching mock_type-specific credits
- Fix: Always fetch ALL 5 credit properties regardless of exam type
- Impact: Prevents Supabase sync from overwriting unrelated credits as 0

**New Utility Functions**:
- `updateContactCreditsInSupabase()` in admin_root ([admin_root/api/_shared/supabase-data.js](admin_root/api/_shared/supabase-data.js:366-409))
- `syncContactCreditsToSupabase()` - full contact sync
- `getContactCreditsFromSupabase()` - read from secondary DB

#### Performance Improvements
- **90% faster credit validation**: ~50ms (Supabase) vs ~500ms (HubSpot API)
- **Eliminated 2-hour staleness**: Real-time credit visibility after booking/cancellation
- **Reduced HubSpot API load**: Most credit reads now served from Supabase

#### Documentation
- **[Contact Credits Supabase Caching PRD](PRDs/supabase/contact-credits-supabase-caching.md)**: Complete implementation documentation
  - Executive summary and problem statement
  - Solution architecture (two-tier database, write-through pattern)
  - Implementation details for all 7 sync locations
  - Testing procedures and deployment checklist
  - Performance benchmarks and error handling patterns

### Changed
- Credit validation now reads from Supabase first, falls back to HubSpot
- All credit-changing operations immediately sync to Supabase (non-blocking)
- HubSpot searchContacts always fetches all credit properties (bug fix)

### Fixed
- **Critical Bug**: Auto-populate overwriting sjmini_credits with 0
  - Root cause: searchContacts filtering properties by mock_type
  - Impact: Users seeing 0 credits during login validation
  - Fix: Always fetch all 5 credit properties to prevent partial overwrites

### Security
- Supabase service role key stored in environment variables
- Read-only access for user-facing queries (via Supabase anon key in frontend)
- Service role used only in backend for write operations

### Performance
- Credit validation: ~450ms faster (90% improvement)
- Real-time credit visibility: No more 2-hour staleness window
- Reduced HubSpot API load: ~70% of credit reads now served from Supabase

### Testing
- Manual testing confirmed all 5 credit types sync correctly
- Verified auto-populate doesn't overwrite existing credits
- Tested cron job syncs all 3 data types (exams, bookings, credits)

---

## [1.1.0] - 2025-01-14

### Added - Token Refund System

#### Backend
- **RefundService** (`admin_root/api/_shared/refund.js`): New service for automated token refunds
  - Token type mapping (Mock Discussion, Clinical Skills, Situational Judgment, Mini-mock)
  - Batch processing with HubSpot API optimization
  - Eligibility validation with idempotency support
  - Detailed result tracking (successful, failed, skipped)
  - Handles partial failures gracefully

- **Booking Properties** (HubSpot):
  - `token_refunded` (text): Tracks refund status ("true"/"false")
  - `token_refunded_at` (number): Refund timestamp
  - `token_refund_admin` (text): Admin email who processed refund
  - `associated_contact_id` (text): Links booking to contact for refunds

- **Validation Schema** (`admin_root/api/_shared/validation.js`):
  - `batchBookingCancellation` schema updated to support booking objects
  - Support for optional fields: `token_used`, `associated_contact_id`, `name`, `email`

#### API
- **Updated Endpoint**: `PATCH /api/admin/mock-exams/[id]/cancel-bookings`
  - Added `refundTokens` flag (default: true)
  - Changed request format from `bookingIds` array to `bookings` array (BREAKING CHANGE)
  - Added `refundSummary` to response with detailed refund results
  - Hybrid optimization: accepts booking data from frontend to reduce API calls
  - Enhanced audit logging with refund information

- **Updated Endpoint**: `GET /api/admin/mock-exams/[id]/bookings`
  - Added `associated_contact_id` to response
  - Provides booking data for frontend to send to cancel-bookings endpoint

#### Frontend
- **CancelBookingsModal** (`admin_root/admin_frontend/src/components/shared/CancelBookingsModal.jsx`):
  - Added "Refund Tokens" toggle checkbox (default: checked)
  - Display refund results in success/error modals
  - Show refund summary by token type
  - Informational tooltip explaining refund behavior

- **Hooks**:
  - `useCancelBookingsMutation`: Updated to send booking objects and `refundTokens` flag
  - `useBatchCancellation`: Support for new response format with `refundSummary`

- **API Service** (`admin_root/admin_frontend/src/services/adminApi.js`):
  - Updated `cancelBookings` to send full booking objects instead of just IDs

#### Documentation
- **[TOKEN_REFUND_API.md](documentation/api/TOKEN_REFUND_API.md)**: Complete API technical documentation
  - Endpoint specification and request/response schemas
  - Token mapping table (display name → property name)
  - Error codes and handling
  - Performance characteristics and benchmarks
  - 4 detailed usage examples
  - Rate limiting considerations

- **[TOKEN_REFUND_USER_GUIDE.md](documentation/user_guides/TOKEN_REFUND_USER_GUIDE.md)**: Admin user guide
  - Step-by-step usage instructions
  - When to enable/disable refunds (decision matrix)
  - Understanding refund results
  - Troubleshooting common errors
  - Manual token restoration procedures
  - FAQ section (10+ questions)

- **[DEPLOYMENT_GUIDE.md](documentation/DEPLOYMENT_GUIDE.md)**: Production deployment procedures
  - Pre-deployment checklist (HubSpot properties, tests, environment variables)
  - Step-by-step deployment instructions
  - Post-deployment validation (7 test scenarios)
  - Rollback procedures (3 options)
  - Known issues and workarounds

- **[API Index](documentation/api/README.md)**: API documentation index with hybrid optimization pattern explained

- **Updated [README.md](README.md)**:
  - Added Admin API section
  - Updated HubSpot Integration section with new properties
  - Added links to token refund documentation

### Changed

#### BREAKING CHANGE: cancel-bookings Request Format
**Old Format**:
```json
{
  "bookingIds": ["123", "456", "789"]
}
```

**New Format**:
```json
{
  "bookings": [
    {
      "id": "123",
      "token_used": "Mock Discussion Token",
      "associated_contact_id": "1001",
      "name": "John Doe",
      "email": "john@example.com"
    }
  ],
  "refundTokens": true
}
```

**Migration**: Frontend components automatically updated. No manual migration needed for new deployments.

**Reason**: Hybrid optimization to reduce HubSpot API calls by reusing booking data already in frontend memory.

### Fixed
- None (new feature)

### Security
- Token refund operations require admin authentication
- Backend validates critical booking state (`is_active`) before processing
- All refund operations logged to HubSpot audit trail with admin email

### Performance
- **Optimization**: Hybrid approach reduces HubSpot API calls by ~1 large batch read per cancellation request
- **Impact**: ~200ms faster cancellation processing for 10 bookings
- **Benchmarks**:
  - 10 bookings with refunds: ~1.2s (was ~1.4s)
  - 50 bookings with refunds: ~3.5s (was ~4.2s)
  - 100 bookings with refunds: ~6.5s (was ~8.1s)

### Testing
- **Unit Tests**: RefundService (90% coverage)
- **Integration Tests**: cancel-bookings endpoint (85% coverage)
- **Manual Testing**: 4 user scenarios documented in deployment guide

---

## [1.0.0] - 2025-01-10 (Previous Release)

### Added
- Mock Discussion Module
- Mock Exam Booking System
- Admin Dashboard
- Trainee Bookings Management
- HubSpot CRM Integration
- Supabase Authentication

### Features
- Student booking flow
- Credit validation
- Capacity management
- Booking cancellation (without refunds)
- Admin mock exam management
- Attendance tracking

---

## Version History

| Version | Date | Key Features |
|---------|------|--------------|
| 1.2.0 | 2025-01-25 | Supabase Secondary Database for Contact Credits |
| 1.1.0 | 2025-01-14 | Token Refund System |
| 1.0.0 | 2025-01-10 | Initial production release |

---

## Upgrade Guide

### Upgrading from 1.1.0 to 1.2.0

#### Required Supabase Configuration

**CRITICAL**: Before deploying, configure Supabase database:

1. **Create Supabase Project** (if not already exists)
   - Go to https://supabase.com/dashboard
   - Create new project or use existing

2. **Create Database Tables**
   Run the following SQL in Supabase SQL Editor:

```sql
-- Contact Credits Table
CREATE TABLE hubspot_contact_credits (
  id SERIAL PRIMARY KEY,
  hubspot_id TEXT UNIQUE NOT NULL,
  student_id TEXT,
  email TEXT,
  firstname TEXT,
  lastname TEXT,
  sj_credits INTEGER DEFAULT 0,
  cs_credits INTEGER DEFAULT 0,
  sjmini_credits INTEGER DEFAULT 0,
  mock_discussion_token INTEGER DEFAULT 0,
  shared_mock_credits INTEGER DEFAULT 0,
  ndecc_exam_date TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  synced_at TIMESTAMP DEFAULT NOW()
);

-- Mock Exams Table
CREATE TABLE hubspot_mock_exams (
  id SERIAL PRIMARY KEY,
  hubspot_id TEXT UNIQUE NOT NULL,
  mock_exam_name TEXT,
  mock_type TEXT,
  exam_date TEXT,
  start_time TEXT,
  end_time TEXT,
  location TEXT,
  capacity INTEGER,
  total_bookings INTEGER,
  is_active TEXT,
  scheduled_activation_datetime TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  synced_at TIMESTAMP DEFAULT NOW()
);

-- Bookings Table
CREATE TABLE hubspot_bookings (
  id SERIAL PRIMARY KEY,
  hubspot_id TEXT UNIQUE NOT NULL,
  booking_id TEXT,
  associated_mock_exam TEXT,
  associated_contact_id TEXT,
  student_id TEXT,
  name TEXT,
  student_email TEXT,
  is_active TEXT,
  attendance TEXT,
  attending_location TEXT,
  exam_date TEXT,
  dominant_hand TEXT,
  token_used TEXT,
  token_refunded_at TIMESTAMP,
  token_refund_admin TEXT,
  mock_type TEXT,
  start_time TEXT,
  end_time TEXT,
  ndecc_exam_date TEXT,
  idempotency_key TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  synced_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_contact_credits_student_id ON hubspot_contact_credits(student_id);
CREATE INDEX idx_contact_credits_email ON hubspot_contact_credits(email);
CREATE INDEX idx_mock_exams_exam_date ON hubspot_mock_exams(exam_date);
CREATE INDEX idx_bookings_contact_id ON hubspot_bookings(associated_contact_id);
```

3. **Configure Environment Variables in Vercel**
   Add the following:
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   SUPABASE_SCHEMA_NAME=public
   ```

4. **Initial Data Sync**
   After deployment, trigger initial sync:
   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" \
     https://your-domain.com/api/admin/cron/sync-supabase
   ```

#### Backend Migration

No code changes required - all Supabase integration is backward compatible:
- If Supabase is not configured, system falls back to HubSpot-only mode
- Existing endpoints continue to work
- New sync logic is non-blocking (fire-and-forget)

#### Testing After Upgrade

Run the following validation:
1. Login validation - verify credits display correctly
2. Book a mock exam - verify credits deduct and sync immediately
3. Cancel booking - verify credits restore and sync immediately
4. Check Supabase tables - verify data is present
5. Trigger cron manually - verify full sync completes

---

### Upgrading from 1.0.0 to 1.1.0

#### Required HubSpot Configuration

**CRITICAL**: Before deploying, create these booking properties in HubSpot:

1. Go to HubSpot Settings > Data Management > Objects > Bookings
2. Create the following properties:

| Property Name | Type | Description |
|--------------|------|-------------|
| `token_refunded` | Single-line text | Refund status ("true"/"false") |
| `token_refunded_at` | Number | Refund timestamp (Unix ms) |
| `token_refund_admin` | Single-line text | Admin email |

3. Verify `associated_contact_id` exists (should already be present)

#### Frontend Migration

No manual migration needed - all frontend changes are backward compatible.

#### Backend Migration

If you have custom integrations calling the cancel-bookings endpoint:

**Update your API calls** from:
```javascript
// OLD
await fetch('/api/admin/mock-exams/123/cancel-bookings', {
  method: 'PATCH',
  body: JSON.stringify({
    bookingIds: ['111', '222', '333']
  })
});
```

**To**:
```javascript
// NEW
await fetch('/api/admin/mock-exams/123/cancel-bookings', {
  method: 'PATCH',
  body: JSON.stringify({
    bookings: [
      {
        id: '111',
        token_used: 'Mock Discussion Token',
        associated_contact_id: '1001',
        name: 'John Doe',
        email: 'john@example.com'
      },
      // ... more bookings
    ],
    refundTokens: true  // Optional, defaults to true
  })
});
```

#### Testing After Upgrade

Run the deployment guide's post-deployment validation section:
1. Smoke test (UI check)
2. Cancel 1 booking with refund
3. Cancel 1 booking without refund
4. Test idempotency (cancel already-cancelled booking)
5. Batch test (10+ bookings)

---

## Support

For questions or issues:
- **Documentation**: See `documentation/` folder
- **User Guide**: `documentation/user_guides/TOKEN_REFUND_USER_GUIDE.md`
- **Technical Issues**: Check `documentation/DEPLOYMENT_GUIDE.md` rollback section

---

**End of Changelog**
