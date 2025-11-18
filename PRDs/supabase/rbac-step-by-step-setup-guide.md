# RBAC Setup: Step-by-Step Guide (30 Minutes)

**Goal**: Set up Supabase RBAC infrastructure without writing any application code
**Time**: 30 minutes
**Difficulty**: Beginner-friendly
**Prerequisites**: Supabase account (free or paid)

---

## Overview: What We're Building

```
Before:
- Any logged-in user = full admin access

After:
- super_admin = Full control + user management
- admin = Standard admin operations
- coordinator = Limited write access
- viewer = Read-only access
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

-- App roles (4 roles for now, can add more later)
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
  ('super_admin', 'analytics.view'),
  ('super_admin', 'analytics.export'),
  ('super_admin', 'analytics.audit_logs'),
  ('super_admin', 'users.grant_roles'),
  ('super_admin', 'users.revoke_roles'),
  ('super_admin', 'users.view'),

  -- ADMIN (11 permissions - no delete, no user management)
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

  -- COORDINATOR (5 permissions - limited write)
  ('coordinator', 'bookings.create'),
  ('coordinator', 'bookings.view'),
  ('coordinator', 'exams.view'),
  ('coordinator', 'analytics.view'),
  ('coordinator', 'analytics.export'),

  -- VIEWER (3 permissions - read-only)
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

-- Policy: Users can view their own admin metadata
CREATE POLICY "Users can view own metadata"
  ON public.admin_users
  FOR SELECT
  USING (auth.uid() = id);

-- Policy: Super admins can manage all admin users
CREATE POLICY "Super admins can manage admin users"
  ON public.admin_users
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );

COMMIT;

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

  -- Add to admin_users metadata
  INSERT INTO public.admin_users (id, email, full_name, is_active)
  VALUES (
    v_user_id,
    v_email,
    'System Administrator', -- Change this if you want
    true
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

## Troubleshooting

### Problem: Auth hook not working (JWT doesn't have custom claims)

**Solution:**

1. Verify hook is enabled:
   - Dashboard → Authentication → Hooks
   - Should show "Custom Access Token Hook: Enabled"

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
   - Database schema deployed
   - Auth hook configured
   - RLS policies enabled

✅ User Management Ready
   - Super admin(s) created
   - Role assignment working
   - JWT claims injecting correctly

✅ Ready for Code Implementation
   - Can now build requireRole middleware
   - Can add RLS policies to app tables
   - Can build user management UI
```

---

## Next Steps

**Now that infrastructure is set up, you can:**

1. **Implement API Middleware** (from RBAC research doc)
   - `requireRole(['super_admin', 'admin'])`
   - `requirePermission('bookings.create')`

2. **Add RLS Policies to App Tables** (if using Supabase for data)
   - `bookings` table policies
   - `mock_exams` table policies

3. **Update Frontend** (from RBAC research doc)
   - `useUserRole()` hook
   - Conditional UI rendering
   - Protected routes

4. **Build User Management UI**
   - List all admin users
   - Assign/change roles
   - View audit log

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
