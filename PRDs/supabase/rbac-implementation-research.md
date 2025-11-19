# RBAC Implementation Research: Supabase Role-Based Access Control for PrepDoctors Admin

**Status**: Research
**Created**: 2025-01-18
**Purpose**: Explore Supabase RBAC implementation to replace current authentication-only model

---

## Executive Summary

This document explores migrating from the current **authentication-only** model (any authenticated user = full admin access) to a **role-based access control (RBAC)** system using Supabase's custom claims and JWT-based middleware authorization.

### Architecture Overview

**IMPORTANT**: This system uses a HubSpot-centric architecture:
- **Supabase PostgreSQL**: Authentication + RBAC tables ONLY (no business data)
- **HubSpot CRM**: All business data (mock exams, bookings, contacts)
- **Redis**: Caching and distributed locking

This means **RLS policies are only needed for RBAC tables**, not for business data (which lives in HubSpot).

### Current State
- ✅ Authentication via Supabase (JWT tokens)
- ✅ `requireAdmin` middleware (checks authentication only)
- ❌ No role differentiation (all authenticated users = admin)
- ❌ No permission granularity

### Target State
- ✅ Role-based authentication (super_admin, admin, viewer, etc.)
- ✅ Permission-level access control (create, delete, view)
- ✅ JWT claims checked by API middleware before HubSpot queries
- ✅ RLS only on RBAC tables (user_roles, permissions)
- ✅ Backward compatible migration path

---

## Current Architecture Analysis

### Existing Authentication Flow

```javascript
// admin_root/api/admin/middleware/requireAdmin.js
async function requireAdmin(req) {
  // Only verifies authentication, not roles
  const user = await requireAuth(req);
  return user;  // No role validation
}
```

**Current Behavior:**
- Any authenticated user → Full admin access
- No distinction between admin types
- Simple, but not scalable for team management

### CLAUDE.md Documentation Excerpt

```markdown
### Authentication-Only Model (No Role-Based Authorization)

The admin system uses a simplified authentication model without role-based
authorization. This means:

✅ Authentication: Verifies user identity (logged in via Supabase)
❌ Authorization: No role-based permissions or access control levels
✅ Access Model: Any authenticated user has full admin access
✅ Simplicity: Reduces complexity, easier to maintain
```

**Why Change?**
- Team growth requires access tiers
- Audit requirements (who did what)
- Risk mitigation (limit damage from compromised accounts)
- Client requests (view-only access for stakeholders)

---

## Supabase RBAC Architecture

### How Supabase RBAC Works

```
┌─────────────────────────────────────────────────────────────┐
│                 SUPABASE RBAC FLOW                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. User Login                                              │
│     ↓                                                       │
│  ┌──────────────────────────────────────────┐              │
│  │ Auth Hook (PL/pgSQL Function)            │              │
│  │ - Queries user_roles table               │              │
│  │ - Fetches role: super_admin/admin/viewer │              │
│  │ - Injects into JWT as custom claim       │              │
│  └────────────────────┬─────────────────────┘              │
│                       │                                     │
│  2. JWT Token Issued  ▼                                     │
│  {                                                          │
│    "sub": "user-uuid",                                      │
│    "email": "admin@prepdoctors.com",                        │
│    "user_role": "super_admin",  ← Custom Claim             │
│    "permissions": ["bookings.create", "exams.delete"]       │
│  }                                                          │
│                       │                                     │
│  3. API Request       ▼                                     │
│  Authorization: Bearer <JWT with custom claims>             │
│                       │                                     │
│  4. Middleware        ▼                                     │
│  ┌──────────────────────────────────────────┐              │
│  │ requireRole(['super_admin', 'admin'])    │              │
│  │ - Decodes JWT                            │              │
│  │ - Checks user_role claim                 │              │
│  │ - Returns 403 if unauthorized            │              │
│  └────────────────────┬─────────────────────┘              │
│                       │                                     │
│  5. Database Access   ▼                                     │
│  ┌──────────────────────────────────────────┐              │
│  │ RLS Policies (Postgres)                  │              │
│  │ - Evaluate auth.jwt() claims             │              │
│  │ - Filter rows based on role              │              │
│  │ - Enforce permissions at database level  │              │
│  └──────────────────────────────────────────┘              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Key Components

**1. Custom Claims** (JWT Token Enrichment)
- Attached to JWT during authentication
- Available in all API requests
- No database queries needed per request

**2. Auth Hooks** (PL/pgSQL Functions)
- Execute before token issuance
- Query role from database
- Inject custom claims into JWT

**3. Row Level Security (RLS)** (RBAC Tables Only)
- Postgres policies enforced at row level
- Used ONLY on `user_roles` and `role_permissions` tables
- Business data (mock exams, bookings) lives in HubSpot, NOT PostgreSQL

**4. API Middleware** (Permission Enforcement)
- Decodes JWT to extract `user_role` and `permissions`
- Checks permissions before querying HubSpot
- This is your primary security enforcement layer

---

## Proposed Role Structure for PrepDoctors Admin

### Role Hierarchy

```
┌─────────────────────────────────────────────────────────┐
│              ADMIN ROLE HIERARCHY                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  SUPER_ADMIN (Full Access)                             │
│  ├─ All permissions                                     │
│  ├─ User management (grant/revoke roles)               │
│  ├─ System configuration                               │
│  └─ Audit log access                                   │
│                                                         │
│  ADMIN (Standard Admin)                                │
│  ├─ Create/cancel bookings                             │
│  ├─ Manage mock exams                                  │
│  ├─ View analytics                                     │
│  └─ Export data                                        │
│                                                         │
│  COORDINATOR (Limited Write)                           │
│  ├─ Create bookings                                    │
│  ├─ View exam schedules                                │
│  └─ Export attendance lists                            │
│                                                         │
│  VIEWER (Read-Only)                                    │
│  ├─ View dashboards                                    │
│  ├─ View bookings                                      │
│  └─ View analytics                                     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Permission Matrix

| Action | SUPER_ADMIN | ADMIN | COORDINATOR | VIEWER |
|--------|-------------|-------|-------------|--------|
| **Bookings** |
| Create booking | ✅ | ✅ | ✅ | ❌ |
| Cancel booking | ✅ | ✅ | ❌ | ❌ |
| Batch cancel | ✅ | ✅ | ❌ | ❌ |
| View bookings | ✅ | ✅ | ✅ | ✅ |
| **Mock Exams** |
| Create exam | ✅ | ✅ | ❌ | ❌ |
| Edit exam | ✅ | ✅ | ❌ | ❌ |
| Delete exam | ✅ | ❌ | ❌ | ❌ |
| Activate/deactivate | ✅ | ✅ | ❌ | ❌ |
| View exams | ✅ | ✅ | ✅ | ✅ |
| **Analytics** |
| View dashboards | ✅ | ✅ | ✅ | ✅ |
| Export data | ✅ | ✅ | ✅ | ❌ |
| View audit logs | ✅ | ❌ | ❌ | ❌ |
| **User Management** |
| Grant roles | ✅ | ❌ | ❌ | ❌ |
| Revoke roles | ✅ | ❌ | ❌ | ❌ |
| View users | ✅ | ✅ | ❌ | ❌ |

---

## Database Schema Design

### Tables Required

```sql
-- =====================================================
-- RBAC TABLES
-- =====================================================

-- 1. Enum Types (Valid Roles and Permissions)
CREATE TYPE app_role AS ENUM (
  'super_admin',
  'admin',
  'coordinator',
  'viewer'
);

CREATE TYPE app_permission AS ENUM (
  -- Bookings
  'bookings.create',
  'bookings.cancel',
  'bookings.batch_cancel',
  'bookings.view',

  -- Mock Exams
  'exams.create',
  'exams.edit',
  'exams.delete',
  'exams.activate',
  'exams.view',

  -- Analytics
  'analytics.view',
  'analytics.export',
  'analytics.audit_logs',

  -- User Management
  'users.grant_roles',
  'users.revoke_roles',
  'users.view'
);

-- 2. User Roles (Links Supabase Auth Users to Roles)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMP DEFAULT NOW(),

  -- Ensure one role per user
  CONSTRAINT unique_user_role UNIQUE (user_id, role)
);

-- Index for fast lookups in auth hook
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);

-- 3. Role Permissions (Maps Roles to Permissions)
CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  permission app_permission NOT NULL,

  -- Prevent duplicate permission assignments
  CONSTRAINT unique_role_permission UNIQUE (role, permission)
);

-- Seed role permissions
INSERT INTO role_permissions (role, permission) VALUES
  -- SUPER_ADMIN (all permissions)
  ('super_admin', 'bookings.create'),
  ('super_admin', 'bookings.cancel'),
  ('super_admin', 'bookings.batch_cancel'),
  ('super_admin', 'bookings.view'),
  ('super_admin', 'exams.create'),
  ('super_admin', 'exams.edit'),
  ('super_admin', 'exams.delete'),
  ('super_admin', 'exams.activate'),
  ('super_admin', 'exams.view'),
  ('super_admin', 'analytics.view'),
  ('super_admin', 'analytics.export'),
  ('super_admin', 'analytics.audit_logs'),
  ('super_admin', 'users.grant_roles'),
  ('super_admin', 'users.revoke_roles'),
  ('super_admin', 'users.view'),

  -- ADMIN (standard admin permissions)
  ('admin', 'bookings.create'),
  ('admin', 'bookings.cancel'),
  ('admin', 'bookings.batch_cancel'),
  ('admin', 'bookings.view'),
  ('admin', 'exams.create'),
  ('admin', 'exams.edit'),
  ('admin', 'exams.activate'),
  ('admin', 'exams.view'),
  ('admin', 'analytics.view'),
  ('admin', 'analytics.export'),
  ('admin', 'users.view'),

  -- COORDINATOR (limited write)
  ('coordinator', 'bookings.create'),
  ('coordinator', 'bookings.view'),
  ('coordinator', 'exams.view'),
  ('coordinator', 'analytics.view'),
  ('coordinator', 'analytics.export'),

  -- VIEWER (read-only)
  ('viewer', 'bookings.view'),
  ('viewer', 'exams.view'),
  ('viewer', 'analytics.view');

-- 4. Admin Users Table (Optional - for admin metadata)
CREATE TABLE public.admin_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  department TEXT,
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- SECURITY GRANTS
-- =====================================================

-- Grant auth admin access to query roles
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT SELECT ON public.user_roles TO supabase_auth_admin;
GRANT SELECT ON public.role_permissions TO supabase_auth_admin;

-- Revoke public access (security!)
REVOKE ALL ON public.user_roles FROM PUBLIC, authenticated;
REVOKE ALL ON public.role_permissions FROM PUBLIC, authenticated;
```

---

## Auth Hook Implementation

### Custom Access Token Hook

```sql
-- =====================================================
-- AUTH HOOK: Inject User Role into JWT
-- =====================================================

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  user_role TEXT;
  user_permissions TEXT[];
BEGIN
  -- Fetch user's primary role
  SELECT role INTO user_role
  FROM public.user_roles
  WHERE user_id = (event->>'user_id')::uuid
  LIMIT 1;

  -- Default to 'viewer' if no role assigned
  IF user_role IS NULL THEN
    user_role := 'viewer';
  END IF;

  -- Fetch permissions for this role
  SELECT ARRAY_AGG(permission::text) INTO user_permissions
  FROM public.role_permissions
  WHERE role = user_role::app_role;

  -- Inject custom claims into JWT
  event := jsonb_set(
    event,
    '{claims, user_role}',
    to_jsonb(user_role)
  );

  event := jsonb_set(
    event,
    '{claims, permissions}',
    to_jsonb(user_permissions)
  );

  -- Add metadata
  event := jsonb_set(
    event,
    '{claims, role_assigned_at}',
    to_jsonb(NOW())
  );

  RETURN event;
END;
$$;

-- Grant execute permission to auth admin only
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM PUBLIC, authenticated;
```

### Enable Auth Hook in Supabase

**Via Supabase Dashboard:**
1. Go to **Authentication > Hooks**
2. Select **Custom Access Token Hook**
3. Choose `public.custom_access_token_hook`
4. Enable the hook

**Via SQL (alternative):**
```sql
-- Enable via Supabase config
SELECT supabase_functions.enable_hook(
  'custom_access_token',
  'public.custom_access_token_hook'
);
```

---

## Authorization Functions

### Permission Check Function

```sql
-- =====================================================
-- AUTHORIZATION FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION public.authorize(
  requested_permission app_permission
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.role_permissions
    WHERE role = (auth.jwt()->>'user_role')::app_role
      AND permission = requested_permission
  );
$$;

-- Usage in RLS policies:
-- CREATE POLICY ... USING (authorize('bookings.create'));
```

### Role Check Function

```sql
CREATE OR REPLACE FUNCTION public.has_role(
  required_role app_role
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT (auth.jwt()->>'user_role')::app_role = required_role;
$$;

-- Usage:
-- CREATE POLICY ... USING (has_role('super_admin'));
```

### Multi-Role Check Function

```sql
CREATE OR REPLACE FUNCTION public.has_any_role(
  required_roles app_role[]
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT (auth.jwt()->>'user_role')::app_role = ANY(required_roles);
$$;

-- Usage:
-- CREATE POLICY ... USING (has_any_role(ARRAY['super_admin', 'admin']::app_role[]));
```

---

## Row Level Security (RLS) Policies

### Important: RLS Only on RBAC Tables

**Since business data (mock exams, bookings) lives in HubSpot, NOT PostgreSQL, you only need RLS on RBAC management tables:**

```sql
-- =====================================================
-- RBAC TABLES ONLY - No business data in PostgreSQL!
-- =====================================================

-- Enable RLS on RBAC tables
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- USER ROLES TABLE POLICIES (Critical!)
-- =====================================================

-- Policy: View own role (any authenticated user)
CREATE POLICY "Users can view own role"
  ON user_roles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Super admin can view all roles
CREATE POLICY "Super admin can view all roles"
  ON user_roles
  FOR SELECT
  USING (has_role('super_admin'));

-- Policy: Super admin can grant/revoke roles
CREATE POLICY "Super admin can manage roles"
  ON user_roles
  FOR ALL
  USING (has_role('super_admin'))
  WITH CHECK (has_role('super_admin'));

-- =====================================================
-- ROLE PERMISSIONS TABLE POLICIES
-- =====================================================

-- Policy: Anyone can read permissions (needed for checks)
CREATE POLICY "Anyone can read permissions"
  ON role_permissions
  FOR SELECT
  USING (true);

-- Policy: Only super admins can modify permissions
CREATE POLICY "Super admins can modify permissions"
  ON role_permissions
  FOR ALL
  USING (has_role('super_admin'))
  WITH CHECK (has_role('super_admin'));

-- =====================================================
-- ADMIN USERS TABLE POLICIES
-- =====================================================

-- Policy: View own metadata
CREATE POLICY "Users can view own metadata"
  ON admin_users
  FOR SELECT
  USING (auth.uid() = id);

-- Policy: Super admins can manage all admin users
CREATE POLICY "Super admins can manage admin users"
  ON admin_users
  FOR ALL
  USING (has_role('super_admin'))
  WITH CHECK (has_role('super_admin'));
```

### Business Data Security (HubSpot)

**Since mock exams, bookings, and contacts live in HubSpot:**

1. **API Middleware** checks JWT claims before querying HubSpot
2. **HubSpot Private App Scopes** limit what the API can access
3. **No RLS needed** for business data (it's not in PostgreSQL)

```javascript
// Example: Security enforced in API middleware, then query HubSpot
module.exports = async (req, res) => {
  // 1. Check JWT role (this is your security layer)
  await requireRole(['admin', 'coordinator'])(req, res, async () => {

    // 2. Query HubSpot (not PostgreSQL)
    const bookings = await hubspot.crm.objects.basicApi.getPage(
      '2-50158943', // Bookings object type ID
      { properties: ['booking_date', 'contact_id', 'status'] }
    );

    return res.json({ success: true, data: bookings });
  });
};
```

---

## API Middleware Implementation

### Updated `requireRole` Middleware

```javascript
// admin_root/api/admin/middleware/requireRole.js
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

/**
 * Require specific role(s) for admin endpoints
 *
 * @param {string|string[]} allowedRoles - Single role or array of roles
 * @returns {Function} Middleware function
 */
function requireRole(allowedRoles) {
  // Normalize to array
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return async function(req, res, next) {
    try {
      // Get JWT from Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Missing or invalid authorization header'
          }
        });
      }

      const token = authHeader.split(' ')[1];

      // Decode JWT (don't verify - Supabase already did that)
      const decoded = jwt.decode(token);

      if (!decoded) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid JWT token'
          }
        });
      }

      // Extract custom claims
      const userRole = decoded.user_role;
      const permissions = decoded.permissions || [];

      // Check if user has required role
      if (!roles.includes(userRole)) {
        console.warn(`❌ Access denied: User has role '${userRole}', requires one of: ${roles.join(', ')}`);

        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: `Insufficient permissions. Required role: ${roles.join(' or ')}`,
            user_role: userRole
          }
        });
      }

      // Attach user info to request
      req.user = {
        id: decoded.sub,
        email: decoded.email,
        role: userRole,
        permissions: permissions
      };

      console.log(`✅ Access granted: ${decoded.email} (${userRole})`);
      next();

    } catch (error) {
      console.error('❌ Role check error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Error validating role'
        }
      });
    }
  };
}

/**
 * Check if user has specific permission
 *
 * @param {string} requiredPermission - Permission to check
 */
function requirePermission(requiredPermission) {
  return async function(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'No authorization header' }
        });
      }

      const token = authHeader.split(' ')[1];
      const decoded = jwt.decode(token);

      const permissions = decoded.permissions || [];

      if (!permissions.includes(requiredPermission)) {
        console.warn(`❌ Permission denied: User lacks '${requiredPermission}'`);

        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: `Missing required permission: ${requiredPermission}`,
            user_permissions: permissions
          }
        });
      }

      req.user = {
        id: decoded.sub,
        email: decoded.email,
        role: decoded.user_role,
        permissions: permissions
      };

      next();

    } catch (error) {
      console.error('❌ Permission check error:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Error validating permission' }
      });
    }
  };
}

module.exports = { requireRole, requirePermission };
```

### Usage in Endpoints

```javascript
// admin_root/api/admin/bookings/create.js
const { requireRole } = require('../middleware/requireRole');

module.exports = async (req, res) => {
  try {
    // Check role first (super_admin, admin, or coordinator can create)
    await requireRole(['super_admin', 'admin', 'coordinator'])(req, res, async () => {

      console.log(`🔧 [ADMIN BOOKING] Initiated by: ${req.user.email} (${req.user.role})`);

      // ... rest of booking creation logic

    });
  } catch (error) {
    // ... error handling
  }
};
```

**Alternative: Permission-based check:**

```javascript
// admin_root/api/admin/mock-exams/delete.js
const { requirePermission } = require('../middleware/requireRole');

module.exports = async (req, res) => {
  // Only users with 'exams.delete' permission can access
  await requirePermission('exams.delete')(req, res, async () => {

    console.log(`🗑️ [DELETE EXAM] By: ${req.user.email}`);

    // ... delete logic

  });
};
```

---

## Client-Side Implementation

### Decode JWT in React

```javascript
// admin_frontend/src/hooks/useUserRole.js
import { jwtDecode } from 'jwt-decode';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function useUserRole() {
  const [role, setRole] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRole() {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setRole(null);
        setPermissions([]);
        setLoading(false);
        return;
      }

      try {
        const decoded = jwtDecode(session.access_token);

        setRole(decoded.user_role || 'viewer');
        setPermissions(decoded.permissions || []);

        console.log('👤 User role:', decoded.user_role);
        console.log('🔑 Permissions:', decoded.permissions);

      } catch (error) {
        console.error('Failed to decode JWT:', error);
      }

      setLoading(false);
    }

    fetchRole();

    // Re-fetch when auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchRole();
    });

    return () => subscription.unsubscribe();
  }, []);

  return {
    role,
    permissions,
    loading,
    hasRole: (requiredRole) => role === requiredRole,
    hasAnyRole: (requiredRoles) => requiredRoles.includes(role),
    hasPermission: (permission) => permissions.includes(permission),
    isSuperAdmin: role === 'super_admin',
    isAdmin: role === 'admin' || role === 'super_admin',
    isCoordinator: role === 'coordinator',
    isViewer: role === 'viewer'
  };
}
```

### Conditional UI Rendering

```javascript
// admin_frontend/src/pages/BookingDashboard.jsx
import { useUserRole } from '../hooks/useUserRole';

function BookingDashboard() {
  const { hasPermission, isAdmin, loading } = useUserRole();

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h1>Booking Dashboard</h1>

      {/* Only show create button to users with permission */}
      {hasPermission('bookings.create') && (
        <button onClick={handleCreateBooking}>
          Create New Booking
        </button>
      )}

      {/* Only admins can batch cancel */}
      {isAdmin && (
        <button onClick={handleBatchCancel}>
          Batch Cancel
        </button>
      )}

      {/* Everyone can view */}
      <BookingList />
    </div>
  );
}
```

### Role-Based Routing

```javascript
// admin_frontend/src/components/ProtectedRoute.jsx
import { Navigate } from 'react-router-dom';
import { useUserRole } from '../hooks/useUserRole';

function ProtectedRoute({ children, requiredRole, requiredPermission }) {
  const { role, hasPermission, loading } = useUserRole();

  if (loading) {
    return <div>Checking permissions...</div>;
  }

  // Check role if specified
  if (requiredRole && role !== requiredRole) {
    return <Navigate to="/unauthorized" />;
  }

  // Check permission if specified
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to="/unauthorized" />;
  }

  return children;
}

// Usage in routes
<Route
  path="/admin/users"
  element={
    <ProtectedRoute requiredRole="super_admin">
      <UserManagementPage />
    </ProtectedRoute>
  }
/>

<Route
  path="/admin/exams/delete/:id"
  element={
    <ProtectedRoute requiredPermission="exams.delete">
      <DeleteExamPage />
    </ProtectedRoute>
  }
/>
```

---

## Migration Path

### Phase 1: Setup Database Schema (Week 1)

```sql
-- 1. Create enum types
CREATE TYPE app_role AS ENUM (...);
CREATE TYPE app_permission AS ENUM (...);

-- 2. Create tables
CREATE TABLE user_roles (...);
CREATE TABLE role_permissions (...);

-- 3. Seed permissions
INSERT INTO role_permissions VALUES (...);

-- 4. Grant super_admin to initial user
INSERT INTO user_roles (user_id, role, granted_by)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'admin@prepdoctors.com'),
  'super_admin',
  NULL
);
```

### Phase 2: Implement Auth Hook (Week 1)

```sql
-- Create custom access token hook
CREATE FUNCTION custom_access_token_hook ...

-- Enable via Supabase Dashboard
-- Authentication > Hooks > Custom Access Token Hook
```

### Phase 3: Add Middleware (Week 2)

```javascript
// Create requireRole.js
// Update existing endpoints to use requireRole(['admin'])
// Test with different roles
```

### Phase 4: RLS on RBAC Tables (Week 2)

```sql
-- Enable RLS on RBAC tables only (not business tables!)
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Add policies for role management
CREATE POLICY "Super admins can manage roles" ...

-- NOTE: No RLS needed for mock_exams/bookings - they're in HubSpot!
```

### Phase 5: Frontend Updates (Week 3)

```javascript
// Add useUserRole hook
// Conditional UI rendering
// Role-based routing
```

### Phase 6: Backward Compatibility (Week 3-4)

```javascript
// Keep old requireAdmin as alias to requireRole(['admin'])
async function requireAdmin(req) {
  return requireRole(['super_admin', 'admin'])(req);
}
```

---

## Testing Strategy

### Unit Tests for Middleware

```javascript
// tests/middleware/requireRole.test.js
const { requireRole } = require('../../admin_root/api/admin/middleware/requireRole');

describe('requireRole middleware', () => {
  it('should allow super_admin access', async () => {
    const req = {
      headers: {
        authorization: 'Bearer <super_admin_jwt>'
      }
    };
    const res = {};
    const next = jest.fn();

    await requireRole('super_admin')(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should deny viewer access to admin endpoint', async () => {
    const req = {
      headers: {
        authorization: 'Bearer <viewer_jwt>'
      }
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const next = jest.fn();

    await requireRole('admin')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
```

### Integration Tests for API Middleware

```javascript
// tests/integration/api-role-check.test.js
describe('API Role-Based Access - HubSpot Operations', () => {
  it('viewer should be able to read bookings via API', async () => {
    const response = await fetch('/api/admin/bookings/list', {
      headers: {
        'Authorization': `Bearer ${VIEWER_JWT}`
      }
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });

  it('viewer should NOT be able to delete bookings', async () => {
    const response = await fetch(`/api/admin/bookings/${TEST_BOOKING_ID}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${VIEWER_JWT}`
      }
    });

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error.code).toBe('FORBIDDEN');
  });

  it('admin should be able to cancel bookings', async () => {
    const response = await fetch('/api/admin/bookings/cancel', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ADMIN_JWT}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ bookingIds: [TEST_BOOKING_ID] })
    });

    expect(response.status).toBe(200);
  });
});

// Note: These tests verify API middleware role checks
// The actual booking data is fetched from HubSpot, not PostgreSQL
```

---

## Security Considerations

### ✅ Best Practices

1. **SECURITY DEFINER Functions**
   - Auth hook uses `SECURITY DEFINER` to access restricted tables
   - Revoke execute permissions from `PUBLIC` and `authenticated`

2. **Enum Types**
   - PostgreSQL enforces valid roles/permissions at database level
   - Prevents typos and invalid values

3. **RLS Policies**
   - Enforce at database level (cannot be bypassed by client)
   - Use `USING` for SELECT/DELETE, `WITH CHECK` for INSERT/UPDATE

4. **JWT Validation**
   - Supabase validates JWT signature server-side
   - Middleware only needs to decode (not verify)

5. **Principle of Least Privilege**
   - Default to `viewer` role if none assigned
   - Grant minimal permissions per role

### ⚠️ Potential Pitfalls

1. **Auth Hook Performance**
   - Executes on every token issuance (login, refresh)
   - Keep queries simple and indexed

2. **Token Refresh**
   - Custom claims only update on token refresh
   - Role changes won't reflect until next login/refresh

3. **Client-Side Checks**
   - UI hiding is NOT security
   - Always enforce at API and database level

4. **Super Admin Lock-Out**
   - Don't delete last super_admin
   - Implement safeguards in user management UI

---

## Monitoring & Audit

### Audit Log Table

```sql
CREATE TABLE admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  user_email TEXT,
  user_role app_role,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for queries
CREATE INDEX idx_audit_log_user ON admin_audit_log(user_id, created_at DESC);
CREATE INDEX idx_audit_log_action ON admin_audit_log(action, created_at DESC);
```

### Audit Trigger Function

```sql
CREATE OR REPLACE FUNCTION log_admin_action()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO admin_audit_log (
    user_id,
    user_email,
    user_role,
    action,
    resource_type,
    resource_id,
    metadata
  ) VALUES (
    auth.uid(),
    auth.jwt()->>'email',
    (auth.jwt()->>'user_role')::app_role,
    TG_OP,
    TG_TABLE_NAME,
    NEW.id,
    jsonb_build_object(
      'old', to_jsonb(OLD),
      'new', to_jsonb(NEW)
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach to sensitive tables
CREATE TRIGGER audit_booking_changes
AFTER INSERT OR UPDATE OR DELETE ON bookings
FOR EACH ROW EXECUTE FUNCTION log_admin_action();
```

---

## Cost Analysis

### Supabase Pricing Impact

**Free Tier Limits:**
- Database: 500 MB
- Auth: Unlimited users
- RLS Policies: Unlimited

**Pro Tier ($25/month):**
- Database: 8 GB
- Daily backups
- No noticeable performance impact from RLS

**Expected Overhead:**
- Auth hook: +10ms per login
- RLS evaluation: +5ms per query
- Total: Negligible for < 1000 daily logins

---

## Comparison: RBAC vs Authentication-Only

| Aspect | Authentication-Only | RBAC |
|--------|---------------------|------|
| **Security** | Basic (all-or-nothing) | Granular (role-based) |
| **Complexity** | Simple | Medium |
| **Scalability** | Limited | High |
| **Audit Trail** | Who logged in | Who did what |
| **Team Management** | Manual | Role assignment |
| **Cost** | $0 | $0 (on free tier) |
| **Setup Time** | 1 day | 1-2 weeks |

---

## Recommended Implementation

### Start Simple, Scale Smart

**Phase 1 (Week 1): Foundation**
- ✅ Create database schema
- ✅ Implement auth hook
- ✅ Assign super_admin to yourself

**Phase 2 (Week 2): API Security**
- ✅ Add requireRole middleware
- ✅ Update critical endpoints (delete, batch operations)
- ✅ Keep requireAdmin as alias for backward compatibility

**Phase 3 (Week 3): Database Security**
- ✅ Enable RLS on sensitive tables
- ✅ Add policies for bookings, exams
- ✅ Test with different roles

**Phase 4 (Week 4): Frontend**
- ✅ Add useUserRole hook
- ✅ Conditional UI rendering
- ✅ Role-based routing

**Phase 5 (Ongoing): Expansion**
- ✅ Add more roles as needed
- ✅ Implement audit logging
- ✅ User management UI

---

## Open Questions

1. **Default Role Assignment**
   - Should new admins default to `viewer`?
   - Manual approval process for role upgrades?

2. **Role Changes**
   - How to handle mid-session role changes?
   - Force logout and re-login?

3. **Multiple Roles**
   - Should users have multiple roles?
   - Current design: one role per user

4. **Permission Inheritance**
   - Should `super_admin` automatically inherit all permissions?
   - Current design: Yes (explicit in seed data)

5. **External Users**
   - Should clients/stakeholders have read-only access?
   - Separate from internal admin roles?

---

## Next Steps

1. **Review this research** with team
2. **Decide on role structure** (use proposed or modify)
3. **Create migration plan** (4-week timeline recommended)
4. **Set up development environment** (test Supabase project)
5. **Implement Phase 1** (database schema + auth hook)

---

## Conclusion

This HubSpot-centric RBAC implementation provides a secure authorization system optimized for your architecture:

- **Custom JWT Claims** (no DB queries per request)
- **Auth Hooks** (role injection at login)
- **API Middleware** (primary security enforcement before HubSpot queries)
- **RLS Policies** (only on RBAC tables - user_roles, permissions)

### Key Architecture Points

| Component | Used For | NOT Used For |
|-----------|----------|--------------|
| **Supabase PostgreSQL** | ✅ User authentication<br>✅ Role storage (`user_roles`)<br>✅ Permission definitions | ❌ Mock exams<br>❌ Bookings<br>❌ Business data |
| **RLS Policies** | ✅ Protect `user_roles` table<br>✅ Protect `permissions` table | ❌ Business data (none in PostgreSQL) |
| **JWT Claims** | ✅ Carry role & permissions<br>✅ Used by API middleware | ❌ Direct database queries |
| **HubSpot** | ✅ ALL business data<br>✅ Mock exams, bookings, contacts | ❌ User authentication |

**Recommended Approach:**
Start with **2 roles** (admin, viewer) and expand as needed. This provides immediate value (read-only stakeholder access) without overwhelming complexity.

---

**End of RBAC Implementation Research**

_This research document provides a complete roadmap from current authentication-only model to full RBAC implementation using Supabase._
