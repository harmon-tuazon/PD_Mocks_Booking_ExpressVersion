# RBAC Setup & User Management: Operational Guide

**Status**: Implementation Guide
**Created**: 2025-01-18
**Purpose**: Step-by-step guide for configuring Supabase RBAC and managing admin users

---

## Overview

This document provides the **operational playbook** for:
1. Setting up Supabase RBAC infrastructure
2. Provisioning admin users
3. Assigning roles and permissions
4. Managing user lifecycle (onboarding, role changes, offboarding)

### Architecture Note

**IMPORTANT**: This system uses a HubSpot-centric architecture:
- **Supabase PostgreSQL**: Authentication + RBAC tables ONLY (no business data)
- **HubSpot CRM**: All business data (mock exams, bookings, contacts)
- **Redis**: Caching and distributed locking

This means RLS policies are only applied to RBAC tables (`user_roles`, `role_permissions`), not business data tables.

---

## Table of Contents

1. [Pre-Implementation Setup](#pre-implementation-setup)
2. [Supabase Project Configuration](#supabase-project-configuration)
3. [Database Schema Deployment](#database-schema-deployment)
4. [Auth Hook Configuration](#auth-hook-configuration)
5. [Initial User Provisioning](#initial-user-provisioning)
6. [User Management Workflows](#user-management-workflows)
7. [Emergency Access Procedures](#emergency-access-procedures)
8. [Monitoring & Auditing](#monitoring--auditing)

---

## 1. Pre-Implementation Setup

### Prerequisites Checklist

- [ ] Supabase account created
- [ ] Supabase project created (or using existing)
- [ ] Database connection established
- [ ] Admin email addresses collected
- [ ] Role assignments decided

### Decision Points

**Question 1: New Supabase Project or Existing?**
- **New Project**: Clean slate, recommended for RBAC pilot
- **Existing Project**: Already has auth users, need migration plan

**Question 2: Initial Admin Users**
Who needs access on Day 1?

Example:
```
Dr. Faris Marei → super_admin (project owner)
Harmon Tuazon → super_admin (technical lead)
Team Member A → admin
Team Member B → coordinator
Stakeholder X → viewer
```

**Question 3: Admin Users Separate from HubSpot**
- Admin users are stored in Supabase PostgreSQL
- Business data (contacts, bookings, mock exams) is in HubSpot
- These are completely separate - no sync required

**Architecture**: Admin users → Supabase Auth | Business data → HubSpot CRM

---

## 2. Supabase Project Configuration

### Step 1: Create/Access Supabase Project

**Via Supabase Dashboard:**
1. Go to https://supabase.com/dashboard
2. Click "New Project" (or select existing)
3. Fill in project details:
   - **Name**: `prepdoctors-admin` (or similar)
   - **Database Password**: Generate strong password (save in 1Password/password manager)
   - **Region**: Choose closest to your users (e.g., `us-east-1`)
   - **Pricing Plan**: Start with Free tier (can upgrade later)

4. Wait for project provisioning (~2 minutes)

### Step 2: Save Connection Details

```bash
# Save these to .env.local (DO NOT COMMIT)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # Keep secret!
```

**Where to Find:**
- Dashboard → Project Settings → API
- `SUPABASE_URL`: Project URL
- `ANON_KEY`: anon public key (safe for client-side)
- `SERVICE_ROLE_KEY`: service_role key (NEVER expose to client)

---

## 3. Database Schema Deployment

### Step 1: Connect to Database

**Option A: Supabase SQL Editor (Recommended for Beginners)**
1. Dashboard → SQL Editor
2. Click "New Query"
3. Paste SQL scripts below
4. Click "Run"

**Option B: Local psql (Advanced)**
```bash
# Get connection string from Dashboard → Project Settings → Database
psql "postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres"
```

### Step 2: Deploy RBAC Schema

**Run in Supabase SQL Editor:**

```sql
-- =====================================================
-- STEP 1: CREATE ENUM TYPES
-- =====================================================

-- App roles (add more as needed)
CREATE TYPE app_role AS ENUM (
  'super_admin',  -- Full access, user management
  'admin',        -- Standard admin operations
  'coordinator',  -- Limited write access
  'viewer'        -- Read-only access
);

-- App permissions (granular access control)
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

-- =====================================================
-- STEP 2: CREATE TABLES
-- =====================================================

-- User roles table (links Supabase Auth users to roles)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  granted_by UUID REFERENCES auth.users(id), -- Who assigned this role
  granted_at TIMESTAMP DEFAULT NOW(),
  notes TEXT, -- Optional: reason for role assignment

  -- Ensure one role per user (simplest model)
  CONSTRAINT unique_user_role UNIQUE (user_id)
);

-- Index for fast auth hook lookups
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);

-- Role permissions mapping (which roles have which permissions)
CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  permission app_permission NOT NULL,

  -- Prevent duplicate permissions
  CONSTRAINT unique_role_permission UNIQUE (role, permission)
);

-- Admin users metadata (optional but recommended)
CREATE TABLE public.admin_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  department TEXT,
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Audit log for role changes
CREATE TABLE public.role_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL, -- 'role_granted', 'role_revoked', 'role_changed'
  old_role app_role,
  new_role app_role,
  changed_by UUID REFERENCES auth.users(id),
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- STEP 3: SEED ROLE PERMISSIONS
-- =====================================================

INSERT INTO public.role_permissions (role, permission) VALUES
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

-- =====================================================
-- STEP 4: GRANT PERMISSIONS TO AUTH ADMIN
-- =====================================================

-- Allow supabase_auth_admin to read roles (needed for auth hook)
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT SELECT ON public.user_roles TO supabase_auth_admin;
GRANT SELECT ON public.role_permissions TO supabase_auth_admin;

-- Revoke public access for security
REVOKE ALL ON public.user_roles FROM PUBLIC, authenticated;
REVOKE ALL ON public.role_permissions FROM PUBLIC, authenticated;

-- =====================================================
-- STEP 5: ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_audit_log ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own role
CREATE POLICY "Users can view own role"
  ON public.user_roles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Super admins can manage all roles
CREATE POLICY "Super admins can manage roles"
  ON public.user_roles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );

-- Policy: Anyone can read role_permissions (needed for permission checks)
CREATE POLICY "Anyone can read permissions"
  ON public.role_permissions
  FOR SELECT
  USING (true);

-- Policy: Only super admins can modify permissions
CREATE POLICY "Super admins can modify permissions"
  ON public.role_permissions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ RBAC schema deployed successfully!';
  RAISE NOTICE '📋 Next steps:';
  RAISE NOTICE '   1. Create auth hook function';
  RAISE NOTICE '   2. Enable auth hook in Dashboard';
  RAISE NOTICE '   3. Provision initial admin users';
END $$;
```

**Verification:**

```sql
-- Check that tables were created
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('user_roles', 'role_permissions', 'admin_users');

-- Should return 3 rows

-- Check permissions were seeded
SELECT role, COUNT(*) as permission_count
FROM public.role_permissions
GROUP BY role
ORDER BY role;

-- Should show:
-- super_admin: 15
-- admin: 11
-- coordinator: 5
-- viewer: 3
```

---

## 4. Auth Hook Configuration

### Step 1: Create Auth Hook Function

**Run in Supabase SQL Editor:**

```sql
-- =====================================================
-- AUTH HOOK: Inject user role into JWT
-- =====================================================

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
  user_permissions TEXT[];
BEGIN
  -- Fetch user's role from user_roles table
  SELECT role::TEXT INTO user_role
  FROM public.user_roles
  WHERE user_id = (event->>'user_id')::uuid;

  -- Default to 'viewer' if no role assigned
  IF user_role IS NULL THEN
    user_role := 'viewer';
    RAISE NOTICE 'User % has no assigned role, defaulting to viewer', event->>'user_id';
  END IF;

  -- Fetch permissions for this role
  SELECT ARRAY_AGG(permission::TEXT) INTO user_permissions
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

  -- Add metadata (helpful for debugging)
  event := jsonb_set(
    event,
    '{claims, role_assigned_at}',
    to_jsonb(NOW())
  );

  RAISE NOTICE 'Auth hook: User % assigned role % with % permissions',
    event->>'user_id', user_role, array_length(user_permissions, 1);

  RETURN event;
END;
$$;

-- Grant execute permission to auth admin ONLY
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM PUBLIC, authenticated;

-- Verify function was created
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'custom_access_token_hook';
```

### Step 2: Enable Auth Hook in Supabase Dashboard

**Via Supabase Dashboard:**

1. Navigate to **Authentication** → **Hooks** (in left sidebar)

2. Find **Custom Access Token Hook** section

3. Click **Enable Hook**

4. Select hook type: **Postgres Function**

5. Select schema: `public`

6. Select function: `custom_access_token_hook`

7. Click **Save**

**Verify Hook is Enabled:**

You should see:
```
✅ Custom Access Token Hook
   Type: Postgres Function
   Schema: public
   Function: custom_access_token_hook
```

**Testing the Hook:**

```sql
-- Manually test the auth hook (won't actually issue JWT, just tests logic)
SELECT public.custom_access_token_hook(
  jsonb_build_object(
    'user_id', '00000000-0000-0000-0000-000000000000',  -- Replace with real UUID
    'claims', '{}'::jsonb
  )
);

-- Expected output: JSON with user_role and permissions injected
```

---

## 5. Initial User Provisioning

### Step 1: Create Admin Users in Supabase Auth

**Option A: Via Supabase Dashboard (Recommended for First User)**

1. Go to **Authentication** → **Users**
2. Click **Add User**
3. Fill in:
   - **Email**: `admin@prepdoctors.com`
   - **Password**: Generate strong password (or auto-generate)
   - **Auto Confirm User**: ✅ Yes (skip email confirmation)
   - **Email Confirm**: ✅ Yes
4. Click **Create User**
5. **SAVE THE USER ID** (UUID) - you'll need it for role assignment

**Option B: Via SQL (Batch User Creation)**

```sql
-- Create auth user (this is a Supabase-provided function)
-- NOTE: Only super admins should do this in production

-- For single user creation
SELECT auth.create_user(
  jsonb_build_object(
    'email', 'harmon@prepdoctors.com',
    'password', 'temporary-password-change-me',
    'email_confirm', true,
    'user_metadata', jsonb_build_object(
      'full_name', 'Harmon Tuazon',
      'department', 'Engineering'
    )
  )
);

-- SAVE THE RETURNED USER ID!
```

**Option C: Invite Users (Email-based)**

1. Go to **Authentication** → **Users**
2. Click **Invite User**
3. Enter email address
4. User receives invitation email with magic link
5. User clicks link → sets password → account created

### Step 2: Assign Roles to Users

**CRITICAL: Assign your FIRST super_admin before testing!**

```sql
-- =====================================================
-- ASSIGN INITIAL SUPER ADMIN
-- =====================================================

-- Replace with YOUR email and UUID from Step 1
INSERT INTO public.user_roles (user_id, role, granted_by, notes)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'admin@prepdoctors.com'), -- Your email
  'super_admin',
  NULL, -- Bootstrap: no granter for first super_admin
  'Initial super admin - bootstrapped during setup'
);

-- Verify role was assigned
SELECT
  u.email,
  ur.role,
  ur.granted_at
FROM public.user_roles ur
JOIN auth.users u ON u.id = ur.user_id;

-- Expected output:
-- email                  | role        | granted_at
-- ---------------------- | ----------- | -------------------------
-- admin@prepdoctors.com  | super_admin | 2025-01-18 10:30:00
```

**Assign Additional Users:**

```sql
-- Assign admin role to team member
INSERT INTO public.user_roles (user_id, role, granted_by, notes)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'harmon@prepdoctors.com'),
  'admin',
  (SELECT id FROM auth.users WHERE email = 'admin@prepdoctors.com'), -- Granted by super_admin
  'Engineering team lead'
);

-- Assign viewer role to stakeholder
INSERT INTO public.user_roles (user_id, role, granted_by, notes)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'stakeholder@client.com'),
  'viewer',
  (SELECT id FROM auth.users WHERE email = 'admin@prepdoctors.com'),
  'External stakeholder - read-only access'
);
```

### Step 3: Populate admin_users Metadata

```sql
-- Add metadata for all admin users
INSERT INTO public.admin_users (id, email, full_name, department)
SELECT
  id,
  email,
  raw_user_meta_data->>'full_name' as full_name,
  raw_user_meta_data->>'department' as department
FROM auth.users
WHERE email IN (
  'admin@prepdoctors.com',
  'harmon@prepdoctors.com',
  'stakeholder@client.com'
);

-- Verify
SELECT
  au.email,
  au.full_name,
  ur.role
FROM public.admin_users au
LEFT JOIN public.user_roles ur ON ur.user_id = au.id;
```

---

## 6. User Management Workflows

### Workflow 1: Onboarding a New Admin User

**Scenario**: A new team member needs admin access

**Steps:**

1. **Create Supabase Auth User** (via Dashboard or SQL)
   ```sql
   -- Via SQL
   SELECT auth.create_user(
     jsonb_build_object(
       'email', 'newuser@prepdoctors.com',
       'password', 'temporary-password',
       'email_confirm', true
     )
   );
   -- Returns user_id: save this
   ```

2. **Assign Role**
   ```sql
   -- Assign admin role
   INSERT INTO public.user_roles (user_id, role, granted_by, notes)
   VALUES (
     '<user_id_from_step_1>',
     'admin',
     auth.uid(), -- Current user (must be super_admin)
     'New team member - granted by [your name]'
   );
   ```

3. **Add Metadata**
   ```sql
   INSERT INTO public.admin_users (id, email, full_name, department)
   VALUES (
     '<user_id_from_step_1>',
     'newuser@prepdoctors.com',
     'New User Name',
     'Operations'
   );
   ```

4. **Send Credentials** (via secure channel)
   - Email user their temporary password
   - Instruct them to change on first login

5. **Verify Access**
   - User logs in
   - Check JWT contains correct role
   - Test permissions in UI

**Automated Function (Optional):**

```sql
CREATE OR REPLACE FUNCTION public.create_admin_user(
  p_email TEXT,
  p_full_name TEXT,
  p_role app_role,
  p_department TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_temp_password TEXT;
BEGIN
  -- Only super_admins can create users
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Only super_admins can create admin users';
  END IF;

  -- Generate temporary password
  v_temp_password := encode(gen_random_bytes(16), 'base64');

  -- Create auth user
  SELECT auth.create_user(
    jsonb_build_object(
      'email', p_email,
      'password', v_temp_password,
      'email_confirm', true
    )
  )::uuid INTO v_user_id;

  -- Assign role
  INSERT INTO public.user_roles (user_id, role, granted_by)
  VALUES (v_user_id, p_role, auth.uid());

  -- Add metadata
  INSERT INTO public.admin_users (id, email, full_name, department)
  VALUES (v_user_id, p_email, p_full_name, p_department);

  -- Log action
  INSERT INTO public.role_audit_log (user_id, action, new_role, changed_by)
  VALUES (v_user_id, 'user_created', p_role, auth.uid());

  RAISE NOTICE 'User created: % with role % (temp password: %)', p_email, p_role, v_temp_password;

  RETURN v_user_id;
END;
$$;

-- Usage:
SELECT public.create_admin_user(
  'newuser@prepdoctors.com',  -- email
  'New User',                 -- full_name
  'admin',                    -- role
  'Operations'                -- department
);
```

### Workflow 2: Changing User Role

**Scenario**: Promote coordinator to admin

```sql
-- Update role
UPDATE public.user_roles
SET
  role = 'admin',
  granted_by = auth.uid()
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'user@prepdoctors.com');

-- Log the change
INSERT INTO public.role_audit_log (user_id, action, old_role, new_role, changed_by, reason)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'user@prepdoctors.com'),
  'role_changed',
  'coordinator',
  'admin',
  auth.uid(),
  'Promoted due to increased responsibilities'
);

-- User must log out and back in for changes to take effect (JWT refresh)
```

### Workflow 3: Revoking Access (Offboarding)

**Scenario**: User leaving organization

```sql
-- Option 1: Soft delete (recommended - preserves audit trail)
UPDATE public.admin_users
SET is_active = false
WHERE email = 'leaving-user@prepdoctors.com';

-- Downgrade to viewer (can't do anything)
UPDATE public.user_roles
SET role = 'viewer'
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'leaving-user@prepdoctors.com');

-- Option 2: Hard delete (removes all access)
DELETE FROM auth.users
WHERE email = 'leaving-user@prepdoctors.com';
-- Cascade deletes user_roles, admin_users via ON DELETE CASCADE

-- Log the action
INSERT INTO public.role_audit_log (user_id, action, old_role, changed_by, reason)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'leaving-user@prepdoctors.com'),
  'access_revoked',
  'admin',
  auth.uid(),
  'User offboarding - left organization'
);
```

### Workflow 4: Bulk Role Assignment

**Scenario**: Migrate existing admins to RBAC

```sql
-- Batch assign roles based on email patterns
INSERT INTO public.user_roles (user_id, role, granted_by, notes)
SELECT
  id,
  CASE
    WHEN email LIKE '%@prepdoctors.com' THEN 'admin'::app_role
    WHEN email LIKE '%@client.com' THEN 'viewer'::app_role
    ELSE 'viewer'::app_role
  END,
  (SELECT id FROM auth.users WHERE email = 'admin@prepdoctors.com'), -- Your super_admin ID
  'Bulk migration from legacy auth system'
FROM auth.users
WHERE email NOT IN (
  SELECT u.email
  FROM auth.users u
  JOIN public.user_roles ur ON ur.user_id = u.id
);

-- Verify assignments
SELECT
  u.email,
  ur.role
FROM auth.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
ORDER BY ur.role, u.email;
```

---

## 7. Emergency Access Procedures

### Scenario 1: Lost Super Admin Access

**Problem**: Last super_admin account deleted or locked out

**Solution: Database-Level Role Assignment**

```sql
-- Connect directly to Supabase database (requires database password)
psql "postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres"

-- Find your user ID
SELECT id, email FROM auth.users WHERE email = 'your-email@prepdoctors.com';

-- Manually assign super_admin role
INSERT INTO public.user_roles (user_id, role, granted_by, notes)
VALUES (
  '<your_user_id>',
  'super_admin',
  NULL,
  'Emergency access restoration'
);

-- Verify
SELECT u.email, ur.role
FROM auth.users u
JOIN public.user_roles ur ON ur.user_id = u.id
WHERE u.email = 'your-email@prepdoctors.com';
```

### Scenario 2: Auth Hook Not Working

**Problem**: Users can log in but JWT doesn't contain custom claims

**Diagnosis:**

```sql
-- Check if auth hook is enabled
SELECT * FROM supabase_functions.hooks
WHERE hook_name = 'custom_access_token';

-- Test auth hook manually
SELECT public.custom_access_token_hook(
  jsonb_build_object(
    'user_id', (SELECT id FROM auth.users LIMIT 1),
    'claims', '{}'::jsonb
  )
);

-- Check for errors in Supabase logs
-- Dashboard → Database → Logs
```

**Solution:**
1. Re-enable auth hook in Dashboard
2. Verify function permissions
3. Check for syntax errors in function
4. Ensure `supabase_auth_admin` has SELECT access to `user_roles`

### Scenario 3: User Can't Access Despite Correct Role

**Problem**: User has role in database but still getting 403 errors

**Diagnosis:**

1. **Check JWT token:**
   ```javascript
   // In browser console
   const { data: { session } } = await supabase.auth.getSession();
   console.log(jwtDecode(session.access_token));
   // Should see user_role and permissions
   ```

2. **Force token refresh:**
   ```javascript
   await supabase.auth.refreshSession();
   ```

3. **Verify role in database:**
   ```sql
   SELECT u.email, ur.role
   FROM auth.users u
   LEFT JOIN public.user_roles ur ON ur.user_id = u.id
   WHERE u.email = 'problematic-user@prepdoctors.com';
   ```

**Solution:**
- User must log out and back in (JWT refresh)
- Or implement auto-refresh on role change

---

## 8. Monitoring & Auditing

### Audit Log Queries

**View all role changes:**

```sql
SELECT
  u.email as user_email,
  ral.action,
  ral.old_role,
  ral.new_role,
  cu.email as changed_by_email,
  ral.reason,
  ral.created_at
FROM public.role_audit_log ral
JOIN auth.users u ON u.id = ral.user_id
LEFT JOIN auth.users cu ON cu.id = ral.changed_by
ORDER BY ral.created_at DESC
LIMIT 50;
```

**Current role distribution:**

```sql
SELECT
  role,
  COUNT(*) as user_count,
  ARRAY_AGG(u.email ORDER BY u.email) as users
FROM public.user_roles ur
JOIN auth.users u ON u.id = ur.user_id
JOIN public.admin_users au ON au.id = ur.user_id
WHERE au.is_active = true
GROUP BY role
ORDER BY role;
```

**Recently granted roles:**

```sql
SELECT
  u.email,
  ur.role,
  ur.granted_at,
  gu.email as granted_by
FROM public.user_roles ur
JOIN auth.users u ON u.id = ur.user_id
LEFT JOIN auth.users gu ON gu.id = ur.granted_by
WHERE ur.granted_at > NOW() - INTERVAL '30 days'
ORDER BY ur.granted_at DESC;
```

### Dashboard Metrics

Create views for monitoring:

```sql
-- Create view for role metrics
CREATE VIEW admin_role_metrics AS
SELECT
  role,
  COUNT(*) as user_count,
  COUNT(*) FILTER (WHERE au.is_active = true) as active_count,
  COUNT(*) FILTER (WHERE au.last_login > NOW() - INTERVAL '7 days') as active_last_week
FROM public.user_roles ur
JOIN public.admin_users au ON au.id = ur.user_id
GROUP BY role;

-- Query the view
SELECT * FROM admin_role_metrics;
```

---

## 10. User Management UI (Future)

### Recommended: Build Admin Panel

**Features to Include:**

1. **User List**
   - Email, name, role, status
   - Last login timestamp
   - Active/inactive toggle

2. **Role Management**
   - Assign/change roles
   - View permissions per role
   - Audit log of changes

3. **User Creation**
   - Form for new user details
   - Auto-generate temporary password
   - Send invitation email

4. **Bulk Operations**
   - Import users from CSV
   - Batch role assignment
   - Export user list

**Tech Stack:**
- React frontend (admin_frontend)
- Supabase client for queries
- `requireRole(['super_admin'])` middleware

**Example React Component:**

```javascript
// admin_frontend/src/pages/UserManagement.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

function UserManagement() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    async function fetchUsers() {
      const { data } = await supabase
        .from('admin_users')
        .select(`
          *,
          user_roles(role)
        `)
        .order('email');

      setUsers(data);
    }
    fetchUsers();
  }, []);

  return (
    <div>
      <h1>User Management</h1>
      <table>
        <thead>
          <tr>
            <th>Email</th>
            <th>Name</th>
            <th>Role</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map(user => (
            <tr key={user.id}>
              <td>{user.email}</td>
              <td>{user.full_name}</td>
              <td>{user.user_roles?.role}</td>
              <td>{user.is_active ? 'Active' : 'Inactive'}</td>
              <td>
                <button onClick={() => editUser(user)}>Edit</button>
                <button onClick={() => changeRole(user)}>Change Role</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

## Summary Checklist

### Pre-Launch Checklist

- [ ] Supabase project created
- [ ] Database schema deployed
- [ ] Auth hook function created
- [ ] Auth hook enabled in Dashboard
- [ ] Initial super_admin assigned (YOUR account)
- [ ] At least 2 super_admins (redundancy)
- [ ] Test user created with each role (super_admin, admin, coordinator, viewer)
- [ ] JWT tokens verified (contain user_role and permissions)
- [ ] Emergency access procedure documented
- [ ] Team trained on user provisioning workflow

### Production Checklist

- [ ] Backup super_admin account created
- [ ] Database backups enabled (Supabase automatic)
- [ ] Audit logging in place
- [ ] User management UI built (or SQL scripts documented)
- [ ] Role change procedure documented
- [ ] Offboarding procedure documented
- [ ] Monitoring dashboard created

---

## Next Steps

1. **Execute Pre-Launch Checklist** (this document)
2. **Test with real users** (create test accounts for each role)
3. **Verify JWT tokens** (decode and check custom claims)
4. **Update API middleware** (implement requireRole)
5. **Deploy to production** (code changes from RBAC research doc)

---

**End of RBAC Setup & User Management Guide**

_This operational playbook covers everything from Supabase configuration to daily user management workflows._
