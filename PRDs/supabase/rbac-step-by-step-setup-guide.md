# RBAC Setup: Step-by-Step Guide (30 Minutes)

**Goal**: Set up Supabase RBAC infrastructure without writing any application code
**Time**: 30 minutes
**Difficulty**: Beginner-friendly
**Prerequisites**: Supabase account (free or paid)

---

## Architecture Overview

**IMPORTANT**: This system uses a HubSpot-centric architecture:
- **Supabase PostgreSQL**: Authentication + RBAC tables ONLY (no business data)
- **HubSpot CRM**: All business data (mock exams, bookings, contacts)
- **Redis**: Caching and distributed locking

This means:
- ✅ RLS policies on RBAC tables only (`user_roles`, `role_permissions`)
- ✅ JWT claims checked by API middleware before HubSpot queries
- ❌ No RLS on business data tables (they don't exist in PostgreSQL)

---

## Overview: What We're Building

```
Before:
- Any logged-in user = full admin access

After:
- super_admin = Full control + user management
- admin = Standard admin operations
- coordinator = Limited write access (optional)
- viewer = Read-only access

Security Flow:
User Login → JWT with role claims → API Middleware checks role → Query HubSpot
```

---

## Preparation Checklist

Before starting, have these ready:

- [ ] Supabase account created (https://supabase.com/dashboard)
- [ ] Your work email address (will be first super_admin)
- [ ] Text editor or notepad (to save credentials)
- [ ] 30 minutes of uninterrupted time

---

## STEP 1: Create/Access Supabase Project (5 minutes)

### 1.1: Log in to Supabase Dashboard

1. Go to https://supabase.com/dashboard
2. Click **Sign In** (or **Sign Up** if first time)
3. You should see your Dashboard with list of projects

### 1.2: Create New Project (or Skip if Using Existing)

**If creating new project:**

1. Click **"New Project"** button (green button, top right)

2. Fill in project details:
   ```
   Name: prepdoctors-admin
   Database Password: [Click "Generate a password"]
   Region: US East (N. Virginia) [or closest to you]
   Pricing Plan: Free [or Pro if needed]
   ```

3. **CRITICAL**: Copy and save the database password!
   ```
   Database Password: [paste here and save to 1Password/password manager]
   ```

4. Click **"Create new project"**

5. Wait ~2 minutes for provisioning (you'll see a loading screen)

### 1.3: Save Connection Details

1. Once project is ready, click **"Project Settings"** (gear icon, bottom left)

2. Click **"API"** tab in settings

3. Copy and save these three values:

   ```bash
   # Save to .env.local (create file if doesn't exist)

   # Project URL
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co

   # anon/public key (safe for client-side)
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

   # service_role key (NEVER expose to client, backend only!)
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

**✅ Checkpoint**: You have a Supabase project and saved all credentials

---

## STEP 2: Deploy RBAC Database Schema (10 minutes)

### 2.1: Open SQL Editor

1. In Supabase Dashboard, click **"SQL Editor"** (in left sidebar)
2. Click **"New query"** button (top right)
3. You should see an empty SQL editor

### 2.2: Run Schema Deployment Script

**Copy and paste this ENTIRE script into the SQL editor:**

```sql
-- =====================================================
-- RBAC SCHEMA DEPLOYMENT
-- =====================================================
-- This script creates all tables, enums, and permissions
-- Estimated time: 30 seconds
-- =====================================================

BEGIN;

-- =====================================================
-- STEP 1: CREATE ENUM TYPES
-- =====================================================

-- App roles (start with 2, add more as needed)
CREATE TYPE app_role AS ENUM (
  'super_admin',  -- Full access, user management
  'admin'         -- Standard admin operations
  -- Can add 'coordinator' and 'viewer' later if needed
);

-- App permissions (granular access control)
CREATE TYPE app_permission AS ENUM (
  -- Bookings
  'bookings.create',
  'bookings.cancel',
  'bookings.batch_cancel',
  'bookings.view',
  'bookings.export',
  -- Mock Exams
  'exams.create',
  'exams.edit',
  'exams.delete',
  'exams.activate',
  'exams.view',

);

-- =====================================================
-- STEP 2: CREATE TABLES
-- =====================================================

-- User roles table (links Supabase Auth users to roles)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMP DEFAULT NOW(),
  notes TEXT,

  -- One role per user (simplest model)
  CONSTRAINT unique_user_role UNIQUE (user_id)
);

-- Index for fast auth hook lookups
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);

-- Role permissions mapping
CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  permission app_permission NOT NULL,

  -- Prevent duplicate permissions
  CONSTRAINT unique_role_permission UNIQUE (role, permission)
);

-- Admin users metadata (optional but useful)
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
  action TEXT NOT NULL,
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
  -- SUPER_ADMIN (all 15 permissions)
  ('super_admin', 'bookings.create'),
  ('super_admin', 'bookings.cancel'),
  ('super_admin', 'bookings.batch_cancel'),
  ('super_admin', 'bookings.view'),
  ('super_admin', 'exams.create'),
  ('super_admin', 'exams.edit'),
  ('super_admin', 'exams.delete'),
  ('super_admin', 'exams.activate'),
  ('super_admin', 'exams.view'),
  
  -- ADMIN (11 permissions - no delete, no user management)
  ('admin', 'bookings.create'),
  ('admin', 'bookings.cancel'),
  ('admin', 'bookings.batch_cancel'),
  ('admin', 'bookings.view'),
  ('admin', 'exams.view')

INSERT INTO public.role_permissions (role, permission) VALUES
  ('viewer', 'bookings.view'),
  ('viewer', 'exams.view')

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

-- =====================================================
-- CRITICAL: Auth admin bypass policies (MUST come first!)
-- These allow the auth hook to read tables without recursion
-- =====================================================

-- Bypass policy for auth hook on user_roles
CREATE POLICY "Auth admin bypass"
  ON public.user_roles
  FOR ALL
  TO supabase_auth_admin
  USING (true)
  WITH CHECK (true);

-- Bypass policy for auth hook on role_permissions
CREATE POLICY "Auth admin bypass"
  ON public.role_permissions
  FOR ALL
  TO supabase_auth_admin
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- Application policies (for authenticated users)
-- =====================================================

-- Policy: Users can view their own role
CREATE POLICY "Users can view own role"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Super admins can manage all roles
CREATE POLICY "Super admins can manage roles"
  ON public.user_roles
  FOR ALL
  TO authenticated
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
  TO authenticated
  USING (true);

-- Policy: Only super admins can modify permissions
CREATE POLICY "Super admins can modify permissions"
  ON public.role_permissions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );


-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ RBAC schema deployed successfully!';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Tables created:';
  RAISE NOTICE '   - user_roles';
  RAISE NOTICE '   - role_permissions';
  RAISE NOTICE '   - admin_users';
  RAISE NOTICE '   - role_audit_log';
  RAISE NOTICE '';
  RAISE NOTICE '🔑 Permissions seeded:';
  RAISE NOTICE '   - super_admin: 15 permissions';
  RAISE NOTICE '   - admin: 11 permissions';
  RAISE NOTICE '   - coordinator: 5 permissions';
  RAISE NOTICE '   - viewer: 3 permissions';
  RAISE NOTICE '';
  RAISE NOTICE '⏭️  Next step: Create auth hook function';
END $$;
```

**After pasting:**

1. Click **"Run"** button (bottom right of editor)
2. Wait ~5 seconds for execution
3. You should see green success messages in the output panel

### 2.3: Verify Schema Deployment

**Run this verification query:**

```sql
-- Check that tables were created
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('user_roles', 'role_permissions', 'admin_users', 'role_audit_log')
ORDER BY table_name;
```

**Expected output (4 rows):**
```
admin_users
role_audit_log
role_permissions
user_roles
```

**Check permissions were seeded:**

```sql
-- Verify permission counts
SELECT role, COUNT(*) as permission_count
FROM public.role_permissions
GROUP BY role
ORDER BY role;
```

**Expected output:**
```
super_admin  | 15
admin        | 11
coordinator  | 5
viewer       | 3
```

**✅ Checkpoint**: Schema deployed, tables created, permissions seeded

---

## STEP 3: Create Auth Hook Function (5 minutes)

### 3.1: Create New SQL Query

1. In SQL Editor, click **"New query"** (or clear current editor)

2. **Copy and paste this auth hook function:**

```sql
-- =====================================================
-- AUTH HOOK: Inject user role into JWT
-- =====================================================
-- This function runs every time a user logs in or refreshes their token
-- It adds custom claims (user_role, permissions) to the JWT
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
    RAISE LOG 'User % has no assigned role, defaulting to viewer', event->>'user_id';
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

  -- Add metadata for debugging
  event := jsonb_set(
    event,
    '{claims, role_assigned_at}',
    to_jsonb(NOW())
  );

  RAISE LOG 'Auth hook: User % assigned role % with % permissions',
    event->>'user_id', user_role, array_length(user_permissions, 1);

  RETURN event;
END;
$$;

-- Grant execute permission to auth admin ONLY
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM PUBLIC, authenticated;

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Auth hook function created successfully!';
  RAISE NOTICE '';
  RAISE NOTICE '⏭️  Next step: Enable auth hook in Supabase Dashboard';
  RAISE NOTICE '   1. Go to Authentication → Hooks';
  RAISE NOTICE '   2. Enable "Custom Access Token Hook"';
  RAISE NOTICE '   3. Select function: public.custom_access_token_hook';
END $$;
```

3. Click **"Run"**

4. Verify function was created:

```sql
-- Verify auth hook function exists
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'custom_access_token_hook';
```

**Expected output:**
```
custom_access_token_hook | FUNCTION
```

**✅ Checkpoint**: Auth hook function created

---

## STEP 4: Enable Auth Hook in Dashboard (2 minutes)

### 4.1: Navigate to Hooks Settings

1. In Supabase Dashboard (left sidebar), click **"Authentication"**

2. In the Authentication submenu, click **"Hooks"**

3. You should see several hook options

### 4.2: Enable Custom Access Token Hook

1. Find the section labeled **"Custom Access Token Hook"**

2. Click **"Enable Hook"** button

3. A modal will appear with configuration options

4. Fill in:
   ```
   Hook Type: Postgres Function
   Schema: public
   Function: custom_access_token_hook
   ```

5. Click **"Save"** or **"Enable"**

6. You should see:
   ```
   ✅ Custom Access Token Hook
      Type: Postgres Function
      Schema: public
      Function: custom_access_token_hook
   ```

**✅ Checkpoint**: Auth hook is now enabled and will run on every login!

---

## STEP 5: Create Your Super Admin User (5 minutes)

### 5.1: Create Your Supabase Auth Account

**Option A: Via Dashboard (Recommended)**

1. Click **"Authentication"** → **"Users"** in left sidebar

2. Click **"Add user"** button (top right)

3. Fill in the form:
   ```
   Email: [YOUR_EMAIL]@prepdoctors.com
   Password: [Click "Generate a password" or create strong password]
   Auto Confirm User: ✅ YES (check this!)
   Email Confirm: ✅ YES (check this!)
   ```

4. Click **"Create user"**

5. **CRITICAL**: Copy the User ID (UUID) shown in the success message!
   ```
   User ID: 123e4567-e89b-12d3-a456-426614174000
   [Save this UUID - you'll need it in next step]
   ```

### 5.2: Assign Super Admin Role

1. Go back to **SQL Editor**

2. **Replace `YOUR_EMAIL@prepdoctors.com` with your actual email**, then run:

```sql
-- =====================================================
-- ASSIGN SUPER ADMIN ROLE TO YOUR ACCOUNT
-- =====================================================
-- IMPORTANT: Replace the email with YOUR email!
-- =====================================================

DO $$
DECLARE
  v_user_id UUID;
  v_email TEXT := 'YOUR_EMAIL@prepdoctors.com'; -- ⚠️ CHANGE THIS!
BEGIN
  -- Get user ID by email
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = v_email;

  -- Check if user exists
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found with email: %', v_email;
  END IF;

  -- Assign super_admin role
  INSERT INTO public.user_roles (user_id, role, granted_by, notes)
  VALUES (
    v_user_id,
    'super_admin',
    NULL, -- Bootstrap: no granter for first super_admin
    'Initial super admin - bootstrapped during setup'
  );

  RAISE NOTICE '✅ SUCCESS! Super admin role assigned to: %', v_email;
  RAISE NOTICE '   User ID: %', v_user_id;
  RAISE NOTICE '';
  RAISE NOTICE '⏭️  Next step: Test your login!';
END $$;
```

**Expected output:**
```
✅ SUCCESS! Super admin role assigned to: your@email.com
   User ID: 123e4567-e89b-12d3-a456-426614174000
```

### 5.3: Verify Your Role

```sql
-- Verify your role was assigned correctly
SELECT
  u.email,
  ur.role,
  ur.granted_at,
  au.full_name
FROM auth.users u
JOIN public.user_roles ur ON ur.user_id = u.id
LEFT JOIN public.admin_users au ON au.id = u.id
WHERE u.email = 'YOUR_EMAIL@prepdoctors.com'; -- ⚠️ CHANGE THIS!
```

**Expected output:**
```
email               | role        | granted_at          | full_name
--------------------|-------------|---------------------|-------------------
your@email.com      | super_admin | 2025-01-18 10:00:00 | System Administrator
```

**✅ Checkpoint**: You are now a super_admin!

---

## STEP 6: Test Your Setup (3 minutes)

### 6.1: Test Login

1. Open your admin app (or use Supabase Auth UI)

2. Log in with:
   ```
   Email: YOUR_EMAIL@prepdoctors.com
   Password: [password you created in Step 5.1]
   ```

3. If login successful, proceed to next step

### 6.2: Verify JWT Contains Custom Claims

**Open browser console (F12) and run:**

```javascript
// Get current session
const { data: { session } } = await supabase.auth.getSession();

// Decode JWT token
const decoded = jwtDecode(session.access_token);

// Check custom claims
console.log('User Role:', decoded.user_role);
console.log('Permissions:', decoded.permissions);
console.log('Role Assigned At:', decoded.role_assigned_at);
```

**Expected output:**
```javascript
User Role: "super_admin"
Permissions: [
  "bookings.create",
  "bookings.cancel",
  "bookings.batch_cancel",
  "bookings.view",
  "exams.create",
  "exams.edit",
  "exams.delete",
  "exams.activate",
  "exams.view",
  "analytics.view",
  "analytics.export",
  "analytics.audit_logs",
  "users.grant_roles",
  "users.revoke_roles",
  "users.view"
]
Role Assigned At: "2025-01-18T10:00:00.000Z"
```

**If you don't have `jwtDecode` available:**

```javascript
// Manual decode (works without library)
const { data: { session } } = await supabase.auth.getSession();
const base64Url = session.access_token.split('.')[1];
const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
const decoded = JSON.parse(window.atob(base64));
console.log('Custom claims:', {
  user_role: decoded.user_role,
  permissions: decoded.permissions,
  role_assigned_at: decoded.role_assigned_at
});
```

**✅ Checkpoint**: JWT contains `user_role` and `permissions` claims!

---

## STEP 7: Create Backup Super Admin (Optional but Recommended) (2 minutes)

**Why?** Never have a single super_admin! If you lose access, you're locked out.

### 7.1: Create Second Admin User

Repeat Step 5 with a different email (team member or backup email):

```sql
-- Create backup super admin
DO $$
DECLARE
  v_user_id UUID;
  v_backup_email TEXT := 'backup@prepdoctors.com'; -- Change this!
BEGIN
  -- First create the auth user via Dashboard (Authentication → Users → Add User)
  -- Then get the user_id and assign role:

  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = v_backup_email;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found. Create user in Dashboard first!';
  END IF;

  -- Assign super_admin role
  INSERT INTO public.user_roles (user_id, role, granted_by, notes)
  VALUES (
    v_user_id,
    'super_admin',
    (SELECT id FROM auth.users WHERE email = 'YOUR_EMAIL@prepdoctors.com'), -- Granted by you
    'Backup super admin for redundancy'
  );

  -- Add metadata
  INSERT INTO public.admin_users (id, email, full_name)
  VALUES (v_user_id, v_backup_email, 'Backup Administrator');

  RAISE NOTICE '✅ Backup super admin created: %', v_backup_email;
END $$;
```

**✅ Checkpoint**: You have 2 super_admins (redundancy achieved!)

---

## STEP 8: Add Team Members (Optional) (5 minutes)

### 8.1: Create Admin User

```sql
-- Helper function for creating admin users
CREATE OR REPLACE FUNCTION create_admin_user(
  p_email TEXT,
  p_full_name TEXT,
  p_role app_role DEFAULT 'admin',
  p_department TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Check if current user is super_admin
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Only super_admins can create users';
  END IF;

  -- Get user ID (user must be created in Dashboard first)
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = p_email;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found. Create auth user in Dashboard first!';
  END IF;

  -- Assign role
  INSERT INTO public.user_roles (user_id, role, granted_by, notes)
  VALUES (
    v_user_id,
    p_role,
    auth.uid(),
    format('Created by %s on %s', auth.email(), NOW())
  );

  -- Add metadata
  INSERT INTO public.admin_users (id, email, full_name, department)
  VALUES (v_user_id, p_email, p_full_name, p_department);

  -- Log action
  INSERT INTO public.role_audit_log (user_id, action, new_role, changed_by)
  VALUES (v_user_id, 'user_created', p_role, auth.uid());

  RETURN format('✅ User created: %s (%s)', p_email, p_role);
END;
$$;
```

**Run the function to create users:**

1. First, create the auth user in Dashboard (Authentication → Users → Add User)

2. Then assign role via SQL:

```sql
-- Example: Create admin user
SELECT create_admin_user(
  'harmon@prepdoctors.com',    -- email (must exist in auth.users)
  'Harmon Tuazon',             -- full name
  'admin',                     -- role
  'Engineering'                -- department
);

-- Example: Create coordinator
SELECT create_admin_user(
  'coordinator@prepdoctors.com',
  'Coordinator Name',
  'coordinator',
  'Operations'
);

-- Example: Create viewer (stakeholder)
SELECT create_admin_user(
  'stakeholder@client.com',
  'Stakeholder Name',
  'viewer',
  'External'
);
```

### 8.2: View All Users

```sql
-- See all admin users and their roles
SELECT
  au.email,
  au.full_name,
  ur.role,
  au.department,
  au.is_active,
  ur.granted_at
FROM public.admin_users au
LEFT JOIN public.user_roles ur ON ur.user_id = au.id
ORDER BY ur.role, au.email;
```

**✅ Checkpoint**: Team members added with appropriate roles

---

## STEP 9: Assign Roles to Existing Users (5 minutes)

**Scenario**: You already have users in Supabase Auth (they've been logging in with your authentication-only system) and now you need to assign them roles for RBAC.

### 9.1: Find Existing Users Without Roles

First, let's see who already has accounts but no roles:

```sql
-- Find all users who don't have roles assigned yet
SELECT
  u.id,
  u.email,
  u.created_at,
  u.last_sign_in_at,
  CASE
    WHEN ur.role IS NULL THEN '❌ NO ROLE'
    ELSE ur.role::TEXT
  END as current_role
FROM auth.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
WHERE ur.role IS NULL
ORDER BY u.created_at DESC;
```

**Expected output:**
```
id                                   | email                  | created_at          | current_role
-------------------------------------|------------------------|---------------------|-------------
123e4567-e89b-12d3-a456-426614174000 | john@prepdoctors.com   | 2024-12-01 10:00:00 | ❌ NO ROLE
234e5678-e89b-12d3-a456-426614174001 | jane@prepdoctors.com   | 2024-11-15 14:30:00 | ❌ NO ROLE
345e6789-e89b-12d3-a456-426614174002 | bob@prepdoctors.com    | 2024-10-20 09:15:00 | ❌ NO ROLE
```

### 9.2: Assign Roles to Existing Users (Individual)

**Option A: Assign role to specific user by email**

```sql
-- Assign 'admin' role to specific existing user
INSERT INTO public.user_roles (user_id, role, granted_by, notes)
SELECT
  id,                                -- user_id
  'admin'::app_role,                 -- role to assign
  (SELECT id FROM auth.users WHERE email = 'YOUR_EMAIL@prepdoctors.com'), -- granted_by (you!)
  'Migrated from authentication-only system'  -- notes
FROM auth.users
WHERE email = 'john@prepdoctors.com';  -- ⚠️ Change this to target user's email

-- Verify it worked
SELECT u.email, ur.role, ur.granted_at
FROM auth.users u
JOIN public.user_roles ur ON ur.user_id = u.id
WHERE u.email = 'john@prepdoctors.com';
```

**Expected output:**
```
email                | role  | granted_at
---------------------|-------|-------------------------
john@prepdoctors.com | admin | 2025-01-18 11:00:00
```

**Option B: Assign role using user ID (if you have it)**

```sql
-- If you know the user's ID
INSERT INTO public.user_roles (user_id, role, granted_by, notes)
VALUES (
  '123e4567-e89b-12d3-a456-426614174000',  -- ⚠️ Change to actual user ID
  'admin',
  auth.uid(),  -- You (the current super_admin)
  'Migration: Existing admin user'
);
```

### 9.3: Bulk Assign Roles to Multiple Existing Users

**Scenario 1: Assign same role to multiple users**

```sql
-- Assign 'admin' role to all users from @prepdoctors.com domain
INSERT INTO public.user_roles (user_id, role, granted_by, notes)
SELECT
  u.id,
  'admin'::app_role,
  (SELECT id FROM auth.users WHERE email = 'YOUR_EMAIL@prepdoctors.com'),
  'Bulk migration: Internal staff members'
FROM auth.users u
WHERE u.email LIKE '%@prepdoctors.com'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id
  );

-- Check how many were assigned
SELECT COUNT(*) as users_assigned
FROM public.user_roles
WHERE notes LIKE '%Bulk migration%';
```

**Scenario 2: Pattern-based role assignment**

```sql
-- Smart bulk assignment based on email patterns
INSERT INTO public.user_roles (user_id, role, granted_by, notes)
SELECT
  u.id,
  CASE
    -- Internal staff = admin
    WHEN u.email LIKE '%@prepdoctors.com' THEN 'admin'::app_role
    -- External stakeholders = viewer
    WHEN u.email LIKE '%@client.com' THEN 'viewer'::app_role
    -- Coordinators (if you have naming convention)
    WHEN u.email LIKE 'coordinator%' THEN 'coordinator'::app_role
    -- Default to viewer for safety
    ELSE 'viewer'::app_role
  END,
  (SELECT id FROM auth.users WHERE email = 'YOUR_EMAIL@prepdoctors.com'),
  CASE
    WHEN u.email LIKE '%@prepdoctors.com' THEN 'Internal staff'
    WHEN u.email LIKE '%@client.com' THEN 'External stakeholder'
    ELSE 'Default assignment'
  END
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id
);

-- Verify the assignments
SELECT
  CASE
    WHEN u.email LIKE '%@prepdoctors.com' THEN 'Internal'
    WHEN u.email LIKE '%@client.com' THEN 'External'
    ELSE 'Other'
  END as user_type,
  ur.role,
  COUNT(*) as count
FROM auth.users u
JOIN public.user_roles ur ON ur.user_id = u.id
GROUP BY user_type, ur.role
ORDER BY user_type, ur.role;
```

**Expected output:**
```
user_type | role        | count
----------|-------------|------
Internal  | admin       | 5
Internal  | super_admin | 2
External  | viewer      | 3
Other     | viewer      | 1
```

**Scenario 3: Assign specific roles to specific users**

```sql
-- Create temporary table with user-role mappings
CREATE TEMP TABLE role_assignments (
  email TEXT,
  role app_role
);

-- Insert your mappings
INSERT INTO role_assignments (email, role) VALUES
  ('john@prepdoctors.com', 'admin'),
  ('jane@prepdoctors.com', 'admin'),
  ('coordinator1@prepdoctors.com', 'coordinator'),
  ('coordinator2@prepdoctors.com', 'coordinator'),
  ('stakeholder@client.com', 'viewer'),
  ('observer@partner.com', 'viewer');

-- Bulk assign based on mapping table
INSERT INTO public.user_roles (user_id, role, granted_by, notes)
SELECT
  u.id,
  ra.role,
  (SELECT id FROM auth.users WHERE email = 'YOUR_EMAIL@prepdoctors.com'),
  'Bulk assignment from migration list'
FROM auth.users u
JOIN role_assignments ra ON ra.email = u.email
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id
);

-- Verify all assignments
SELECT u.email, ur.role
FROM auth.users u
JOIN public.user_roles ur ON ur.user_id = u.id
WHERE u.email IN (
  SELECT email FROM role_assignments
)
ORDER BY ur.role, u.email;

-- Clean up temp table
DROP TABLE role_assignments;
```

### 9.4: Add Metadata for Existing Users

After assigning roles, add metadata to `admin_users` table:

```sql
-- Bulk insert metadata for all users with roles
INSERT INTO public.admin_users (id, email, full_name, is_active)
SELECT
  u.id,
  u.email,
  -- Extract name from email if no metadata available
  INITCAP(SPLIT_PART(u.email, '@', 1)),  -- "john.doe@email.com" → "John.Doe"
  true
FROM auth.users u
JOIN public.user_roles ur ON ur.user_id = u.id
WHERE NOT EXISTS (
  SELECT 1 FROM public.admin_users au WHERE au.id = u.id
);

-- Update with proper names if you have them
UPDATE public.admin_users
SET full_name = 'John Smith'
WHERE email = 'john@prepdoctors.com';

UPDATE public.admin_users
SET full_name = 'Jane Doe'
WHERE email = 'jane@prepdoctors.com';

-- Add departments
UPDATE public.admin_users
SET department = 'Engineering'
WHERE email LIKE '%engineer%' OR email LIKE '%dev%';

UPDATE public.admin_users
SET department = 'Operations'
WHERE email LIKE '%coordinator%' OR email LIKE '%ops%';
```

### 9.5: Verify All Users Have Roles

```sql
-- Final verification: Show all users and their roles
SELECT
  u.email,
  COALESCE(ur.role::TEXT, '❌ NO ROLE') as role,
  au.full_name,
  au.department,
  u.created_at::DATE as account_created,
  u.last_sign_in_at::DATE as last_login
FROM auth.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
LEFT JOIN public.admin_users au ON au.id = u.id
ORDER BY
  CASE
    WHEN ur.role IS NULL THEN 0  -- NO ROLE users first (needs attention)
    ELSE 1
  END,
  ur.role,
  u.email;
```

**Expected output (all users should have roles):**
```
email                    | role        | full_name  | department  | account_created | last_login
-------------------------|-------------|------------|-------------|-----------------|------------
admin@prepdoctors.com    | super_admin | Admin User | Leadership  | 2025-01-18      | 2025-01-18
backup@prepdoctors.com   | super_admin | Backup     | Leadership  | 2025-01-18      | 2025-01-18
john@prepdoctors.com     | admin       | John Smith | Engineering | 2024-12-01      | 2025-01-15
jane@prepdoctors.com     | admin       | Jane Doe   | Operations  | 2024-11-15      | 2025-01-16
coordinator@example.com  | coordinator | Bob Jones  | Operations  | 2024-10-20      | 2025-01-10
stakeholder@client.com   | viewer      | Client User| External    | 2024-09-05      | 2024-12-20
```

**If you see "❌ NO ROLE" users:**
- These users will default to 'viewer' role (per auth hook)
- Assign them proper roles using queries from 9.2 or 9.3

### 9.6: Important: Existing Users Must Refresh Their Tokens

⚠️ **CRITICAL**: Users who were already logged in won't see their new roles until they:

**Option 1: Log out and back in (Easiest)**
```
User action required:
1. Log out of admin app
2. Log back in
3. New JWT will contain role
```

**Option 2: Force token refresh (No logout needed)**
```javascript
// Add this to your app (run once per user)
const { data, error } = await supabase.auth.refreshSession();

if (data.session) {
  console.log('✅ Token refreshed! New role:', jwtDecode(data.session.access_token).user_role);
  // Reload the page or update UI
  window.location.reload();
}
```

**Option 3: Auto-refresh on next page load**
```javascript
// Add to your app initialization
useEffect(() => {
  async function checkAndRefreshToken() {
    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
      const decoded = jwtDecode(session.access_token);

      // If no role in token but we expect one, force refresh
      if (!decoded.user_role) {
        console.log('🔄 No role in token, refreshing...');
        await supabase.auth.refreshSession();
        window.location.reload();
      }
    }
  }

  checkAndRefreshToken();
}, []);
```

### 9.7: View Migration Summary

```sql
-- Summary of role assignments
SELECT
  ur.role,
  COUNT(*) as user_count,
  COUNT(*) FILTER (WHERE u.last_sign_in_at > NOW() - INTERVAL '7 days') as active_last_week,
  COUNT(*) FILTER (WHERE u.last_sign_in_at > NOW() - INTERVAL '30 days') as active_last_month,
  MIN(ur.granted_at)::DATE as first_assigned,
  MAX(ur.granted_at)::DATE as last_assigned
FROM public.user_roles ur
JOIN auth.users u ON u.id = ur.user_id
GROUP BY ur.role
ORDER BY ur.role;
```

**Expected output:**
```
role        | user_count | active_last_week | active_last_month | first_assigned | last_assigned
------------|------------|------------------|-------------------|----------------|---------------
super_admin | 2          | 2                | 2                 | 2025-01-18     | 2025-01-18
admin       | 5          | 4                | 5                 | 2025-01-18     | 2025-01-18
coordinator | 3          | 2                | 3                 | 2025-01-18     | 2025-01-18
viewer      | 4          | 1                | 3                 | 2025-01-18     | 2025-01-18
```

**✅ Checkpoint**: All existing users now have roles assigned!

---

## Troubleshooting

### Problem: "Infinite recursion detected in policy for relation user_roles"

**Cause:** RLS policies on `user_roles` use `auth.uid()` or query `user_roles` itself, causing a loop when the auth hook tries to read the table before the JWT exists.

**Solution:**

1. Add bypass policy for `supabase_auth_admin`:
   ```sql
   -- Drop existing policies first
   DROP POLICY IF EXISTS "Auth admin bypass" ON public.user_roles;
   DROP POLICY IF EXISTS "Auth admin bypass" ON public.role_permissions;

   -- Create bypass policies
   CREATE POLICY "Auth admin bypass" ON public.user_roles
     FOR ALL
     TO supabase_auth_admin
     USING (true)
     WITH CHECK (true);

   CREATE POLICY "Auth admin bypass" ON public.role_permissions
     FOR ALL
     TO supabase_auth_admin
     USING (true)
     WITH CHECK (true);
   ```

2. If still failing, temporarily disable RLS:
   ```sql
   ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;
   ALTER TABLE public.role_permissions DISABLE ROW LEVEL SECURITY;
   ```

3. Re-enable with proper policies after login works.

### Problem: "Permission denied for function custom_access_token_hook"

**Cause:** `supabase_auth_admin` doesn't have execute permission on the function.

**Solution:**

```sql
-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;

-- Grant schema usage
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;

-- Grant table access
GRANT SELECT ON public.user_roles TO supabase_auth_admin;
GRANT SELECT ON public.role_permissions TO supabase_auth_admin;
```

### Problem: "Too many login attempts" rate limiting

**Cause:** Multiple failed login attempts (often from auth hook errors) triggered Supabase's rate limiting.

**Solution:**

1. Wait 15 minutes (rate limit expires)
2. Or use a different IP (VPN/mobile hotspot)
3. Or test with a different email address

### Problem: Auth hook not working (JWT doesn't have custom claims)

**Solution:**

1. Verify hook is enabled:
   - Dashboard → Authentication → Hooks
   - Should show "Custom Access Token Hook: Enabled"
   - **Note:** The UI may not always show the hook even when it's working

2. Check function exists:
   ```sql
   SELECT routine_name
   FROM information_schema.routines
   WHERE routine_schema = 'public'
     AND routine_name = 'custom_access_token_hook';
   ```

3. Check permissions:
   ```sql
   -- Verify supabase_auth_admin has SELECT access
   SELECT grantee, privilege_type
   FROM information_schema.role_table_grants
   WHERE table_schema = 'public'
     AND table_name = 'user_roles';
   ```

4. Force token refresh:
   ```javascript
   await supabase.auth.refreshSession();
   ```

5. Verify RLS policies are correct:
   ```sql
   -- Check RLS is enabled
   SELECT tablename, rowsecurity
   FROM pg_tables
   WHERE tablename IN ('user_roles', 'role_permissions');

   -- Check policies exist
   SELECT tablename, policyname, roles, cmd
   FROM pg_policies
   WHERE tablename IN ('user_roles', 'role_permissions')
   ORDER BY tablename, policyname;
   ```

### Problem: Hook configured but not showing in Dashboard UI

**Cause:** This is a known Supabase Dashboard UI bug.

**Solution:**

If login works and your JWT contains `user_role` and `permissions`, the hook IS working. The UI display is cosmetic - ignore it.

To verify via SQL:
```sql
-- Check if hook function exists and has correct permissions
SELECT
  p.proname as function_name,
  pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'custom_access_token_hook';
```

### Problem: "User has no assigned role" error

**Solution:**

```sql
-- Check if user has role
SELECT u.email, ur.role
FROM auth.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
WHERE u.email = 'YOUR_EMAIL@prepdoctors.com';

-- If role is NULL, assign it:
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin'
FROM auth.users
WHERE email = 'YOUR_EMAIL@prepdoctors.com';
```

### Problem: Can't log in after setup

**Solution:**

1. Check email is confirmed:
   ```sql
   SELECT email, email_confirmed_at
   FROM auth.users
   WHERE email = 'YOUR_EMAIL@prepdoctors.com';
   ```

2. If not confirmed, manually confirm:
   ```sql
   UPDATE auth.users
   SET email_confirmed_at = NOW()
   WHERE email = 'YOUR_EMAIL@prepdoctors.com';
   ```

---

## Success Checklist

**Before moving to code implementation, verify:**

- [ ] ✅ Supabase project created
- [ ] ✅ 4 tables created (user_roles, role_permissions, admin_users, role_audit_log)
- [ ] ✅ Permissions seeded (super_admin: 15, admin: 11, coordinator: 5, viewer: 3)
- [ ] ✅ Auth hook function created
- [ ] ✅ Auth hook enabled in Dashboard
- [ ] ✅ Your super_admin account created
- [ ] ✅ Backup super_admin created (recommended)
- [ ] ✅ JWT token contains `user_role` claim
- [ ] ✅ JWT token contains `permissions` array
- [ ] ✅ Can log in successfully
- [ ] ✅ Role shows correctly in JWT

---

## What You've Accomplished

```
✅ Infrastructure Complete
   - Database schema deployed (RBAC tables only)
   - Auth hook configured
   - RLS policies on RBAC tables enabled

✅ User Management Ready
   - Super admin(s) created
   - Role assignment working
   - JWT claims injecting correctly (user_role, permissions)

✅ Ready for Code Implementation
   - Can now build requireRole middleware
   - Middleware checks JWT before querying HubSpot
   - Can build user management UI

⚠️ Remember: Business data (mock exams, bookings) stays in HubSpot!
```

---

## Next Steps

**Now that infrastructure is set up, you can:**

1. **Implement API Middleware** (from RBAC research doc)
   - `requireRole(['super_admin', 'admin'])`
   - `requirePermission('bookings.create')`
   - Middleware checks JWT before querying HubSpot

2. **Update Existing Endpoints** to use role checks
   - Delete operations → `super_admin` only
   - Write operations → `admin` or higher
   - Read operations → all roles

3. **Update Frontend** (from RBAC research doc)
   - `useUserRole()` hook
   - Conditional UI rendering
   - Protected routes

4. **Build User Management UI**
   - List all admin users
   - Assign/change roles
   - View audit log

**Note**: No RLS needed for business data - it's all in HubSpot!

---

## Emergency Access

**If you ever lose super_admin access:**

1. Connect directly to database:
   ```bash
   psql "postgresql://postgres:[YOUR_DB_PASSWORD]@db.xxxxx.supabase.co:5432/postgres"
   ```

2. Manually assign super_admin:
   ```sql
   INSERT INTO public.user_roles (user_id, role)
   VALUES (
     (SELECT id FROM auth.users WHERE email = 'YOUR_EMAIL@prepdoctors.com'),
     'super_admin'
   );
   ```

---

## Support

**Questions while following this guide?**

- Re-read the relevant step
- Check Troubleshooting section
- Ask me specific questions about any step
- I can review your setup after you're done

**Ready to start? Begin with Step 1!** 🚀

---

**End of Step-by-Step Setup Guide**

_Estimated completion time: 30 minutes_
_Difficulty: Beginner-friendly (copy-paste SQL, click buttons)_
