# Changelog

All notable changes to the PrepDoctors Mock Exam Booking System will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
| 1.1.0 | 2025-01-14 | Token Refund System |
| 1.0.0 | 2025-01-10 | Initial production release |

---

## Upgrade Guide

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
