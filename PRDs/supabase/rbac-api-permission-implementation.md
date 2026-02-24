# PRD: RBAC API Permission Implementation

**Version**: 1.0
**Created**: 2025-01-20
**Branch**: supabase-rbac-migration
**Confidence Score**: 8/10

---

## Overview

Implement permission-based access control on all admin API endpoints using JWT claims from Supabase RBAC system.

## Goals

1. Protect destructive operations (delete) to super_admin only
2. Restrict write operations to admin+ roles
3. Allow read operations for all authenticated roles
4. Maintain backward compatibility with existing authentication

## Technical Approach

### New Middleware

Create two middleware functions in `admin_root/api/admin/middleware/`:

1. **requirePermission.js** - Check specific permission in JWT
2. **requireRole.js** - Check role membership in JWT

### JWT Claims Structure

```javascript
{
  user_role: "admin",
  permissions: ["bookings.view", "exams.view", "exams.create", ...],
  role_assigned_at: "2025-01-20T10:00:00Z"
}
```

---

## Implementation Plan

### Phase 1: Middleware Creation

Create `requirePermission` middleware:

```javascript
// admin_root/api/admin/middleware/requirePermission.js
async function requirePermission(req, permission) {
  const user = await requireAuth(req);
  const permissions = user.permissions || [];

  if (!permissions.includes(permission)) {
    throw new Error(`Permission denied: ${permission} required`);
  }

  return user;
}
```

### Phase 2: High Priority Endpoints (super_admin only)

| Endpoint | Permission | Priority |
|----------|------------|----------|
| mock-exams/delete.js | `exams.delete` | Critical |
| mock-exams/batch-delete.js | `exams.delete` | Critical |

### Phase 3: Write Operation Endpoints (admin+)

| Endpoint | Permission |
|----------|------------|
| bookings/create.js | `bookings.create` |
| mock-exams/create.js | `exams.create` |
| mock-exams/bulk-create.js | `exams.create` |
| mock-exams/clone.js | `exams.create` |
| mock-exams/update.js | `exams.edit` |
| mock-exams/bulk-update.js | `exams.edit` |
| mock-exams/[id].js (PATCH) | `exams.edit` |
| mock-exams/bulk-toggle-status.js | `exams.activate` |
| mock-exams/[id]/cancel-bookings.js | `bookings.batch_cancel` |
| mock-exams/[id]/attendance.js | `bookings.cancel` |
| mock-exams/[id]/prerequisites/* | `exams.edit` |
| mock-exams/export-csv.js | `bookings.export` |

### Phase 4: Read Operation Endpoints (all roles)

| Endpoint | Permission |
|----------|------------|
| mock-exams/list.js | `exams.view` |
| mock-exams/get.js | `exams.view` |
| mock-exams/[id].js (GET) | `exams.view` |
| mock-exams/metrics.js | `exams.view` |
| mock-exams/aggregates.js | `exams.view` |
| mock-exams/[id]/bookings.js | `bookings.view` |
| trainees/search.js | `bookings.view` |
| trainees/[contactId]/bookings.js | `bookings.view` |

---

## Endpoint Migration Pattern

### Before (Current)
```javascript
const { requireAdmin } = require('../middleware/requireAdmin');

module.exports = async (req, res) => {
  const user = await requireAdmin(req);
  // ... endpoint logic
};
```

### After (With RBAC)
```javascript
const { requirePermission } = require('../middleware/requirePermission');

module.exports = async (req, res) => {
  const user = await requirePermission(req, 'exams.delete');
  // ... endpoint logic
};
```

---

## Error Responses

### 401 Unauthorized (Not authenticated)
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

### 403 Forbidden (Insufficient permissions)
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Permission denied: exams.delete required"
  }
}
```

---

## Exclusions (No RBAC Changes)

- **Auth endpoints** (8): login, logout, me, refresh, request-otp, update-password, validate, verify-otp
- **Cron endpoint** (1): activate-scheduled-exams (uses CRON_SECRET)

---

## Testing Requirements

1. Verify super_admin can access all endpoints
2. Verify admin cannot access delete operations
3. Verify viewer can only access read operations
4. Verify unauthenticated users get 401
5. Verify insufficient permissions get 403

---

## Success Criteria

- [ ] requirePermission middleware created
- [ ] requireRole middleware created
- [ ] All 23 endpoints updated with permission checks
- [ ] Error responses return correct status codes (401/403)
- [ ] Backward compatible with existing auth flow
- [ ] All tests passing

---

## Statistics

- **Total admin endpoints**: 32
- **Need permission checks**: 23
- **No changes needed**: 9 (auth + cron)

---

## Dependencies

- Supabase RBAC schema deployed (rbac-step-by-step-setup-guide.md)
- Auth hook injecting JWT claims
- User roles assigned in database

---

## Related Documents

- [RBAC Setup Guide](rbac-step-by-step-setup-guide.md)
- Serena Memory: RBAC_PERMISSION_AUDIT