# Supabase Database User Setup Guide
## Minimal Role-Based Access for HubSpot → Zapier → Supabase Sync

**Version**: 1.0
**Created**: 2025-01-24
**Purpose**: Create a secure database user with minimal permissions for the Zapier sync integration

---

## Overview

This guide sets up a Supabase database user with least-privilege access required only for:
- Reading data from sync tables
- Inserting new records
- Updating existing records (upsert operations)

This user will be used by Zapier to safely sync HubSpot data without exposing unnecessary database access.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│           Supabase Security Layers                  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │ 1. Supabase Project (Account/Plan)           │  │
│  │    - Org level access control                │  │
│  └──────────────────────────────────────────────┘  │
│                     ↓                               │
│  ┌──────────────────────────────────────────────┐  │
│  │ 2. Postgres Database Role (User)             │  │
│  │    - Table-level permissions                 │  │
│  │    - Row-level security (RLS)                │  │
│  └──────────────────────────────────────────────┘  │
│                     ↓                               │
│  ┌──────────────────────────────────────────────┐  │
│  │ 3. Database Connection (Limited Scope)       │  │
│  │    - Only access to specific tables          │  │
│  │    - Only specific operations (SELECT/INSERT │  │
│  │      /UPDATE)                                │  │
│  └──────────────────────────────────────────────┘  │
│                     ↓                               │
│  ┌──────────────────────────────────────────────┐  │
│  │ 4. Zapier (Application Layer)                │  │
│  │    - Uses limited credentials               │  │
│  │    - Can only sync allowed tables            │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Prerequisites

- ✅ Supabase project already created
- ✅ Admin access to Supabase project
- ✅ Tables created (hubspot_bookings, hubspot_mock_exams)
- ✅ Supabase CLI or direct SQL access

---

## Step 1: Create Dedicated Sync User

### Option A: Using Supabase Dashboard (Recommended for beginners)

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project
   - Go to **SQL Editor** (left sidebar)

2. **Create New Role**
   - Click **New Query**
   - Name it: "Create Zapier Sync User"
   - Run the following SQL:

```sql
-- Create zapier_sync_user role with limited privileges
CREATE ROLE zapier_sync_user WITH
  LOGIN
  PASSWORD 'YOUR_SECURE_PASSWORD_HERE'
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  INHERIT;

-- Add user to appropriate group (optional but recommended)
-- GRANT zapier_group TO zapier_sync_user;
```

⚠️ **Replace `YOUR_SECURE_PASSWORD_HERE`** with a strong password:
- Minimum 32 characters
- Mix of uppercase, lowercase, numbers, symbols
- Use a password manager to generate it
- Example: `K9@mX2#pL4$vN8!qW6&zY3%bH7^cJ5*F`

### Option B: Using Supabase CLI

```bash
# Connect to your database
supabase db connect --project-id YOUR_PROJECT_ID

# Run the creation script
psql << 'EOF'
CREATE ROLE zapier_sync_user WITH
  LOGIN
  PASSWORD 'YOUR_SECURE_PASSWORD_HERE'
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  INHERIT;
EOF
```

---

## Step 2: Grant Table-Level Permissions

Execute this SQL in the Supabase SQL Editor:

```sql
-- ============================================
-- TABLE: hubspot_bookings
-- ============================================

-- Grant USAGE on schema
GRANT USAGE ON SCHEMA public TO zapier_sync_user;

-- Grant SELECT on table (for checking existing records)
GRANT SELECT ON public.hubspot_bookings TO zapier_sync_user;

-- Grant INSERT (for new records from Zapier)
GRANT INSERT ON public.hubspot_bookings TO zapier_sync_user;

-- Grant UPDATE (for upsert operations)
GRANT UPDATE ON public.hubspot_bookings TO zapier_sync_user;

-- Grant USAGE on sequences (for auto-incrementing IDs)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO zapier_sync_user;

-- ============================================
-- TABLE: hubspot_mock_exams
-- ============================================

-- Grant SELECT on table
GRANT SELECT ON public.hubspot_mock_exams TO zapier_sync_user;

-- Grant INSERT (for new records from Zapier)
GRANT INSERT ON public.hubspot_mock_exams TO zapier_sync_user;

-- Grant UPDATE (for upsert operations)
GRANT UPDATE ON public.hubspot_mock_exams TO zapier_sync_user;

-- ============================================
-- SEQUENCES (for generated UUIDs)
-- ============================================

-- Grant permissions on all sequences in public schema
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO zapier_sync_user;

-- Set defaults for future sequences
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO zapier_sync_user;
```

---

## Step 3: Create Row-Level Security (RLS) Policies (Optional but Recommended)

RLS adds an extra security layer to prevent users from accessing rows they shouldn't.

```sql
-- ============================================
-- Enable RLS on sync tables
-- ============================================

-- For hubspot_bookings
ALTER TABLE public.hubspot_bookings ENABLE ROW LEVEL SECURITY;

-- For hubspot_mock_exams
ALTER TABLE public.hubspot_mock_exams ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies for zapier_sync_user
-- ============================================

-- Allow zapier_sync_user to read all booking records
CREATE POLICY "Allow zapier_sync_user to read bookings"
  ON public.hubspot_bookings
  FOR SELECT
  TO zapier_sync_user
  USING (true);

-- Allow zapier_sync_user to insert booking records
CREATE POLICY "Allow zapier_sync_user to insert bookings"
  ON public.hubspot_bookings
  FOR INSERT
  TO zapier_sync_user
  WITH CHECK (true);

-- Allow zapier_sync_user to update booking records
CREATE POLICY "Allow zapier_sync_user to update bookings"
  ON public.hubspot_bookings
  FOR UPDATE
  TO zapier_sync_user
  USING (true)
  WITH CHECK (true);

-- Allow zapier_sync_user to read all exam records
CREATE POLICY "Allow zapier_sync_user to read exams"
  ON public.hubspot_mock_exams
  FOR SELECT
  TO zapier_sync_user
  USING (true);

-- Allow zapier_sync_user to insert exam records
CREATE POLICY "Allow zapier_sync_user to insert exams"
  ON public.hubspot_mock_exams
  FOR INSERT
  TO zapier_sync_user
  WITH CHECK (true);

-- Allow zapier_sync_user to update exam records
CREATE POLICY "Allow zapier_sync_user to update exams"
  ON public.hubspot_mock_exams
  FOR UPDATE
  TO zapier_sync_user
  USING (true)
  WITH CHECK (true);

-- ============================================
-- IMPORTANT: Admin/Service Role Access
-- ============================================
-- If you need to keep admin access via service role or postgres user,
-- add policies for those users as well, or they will be blocked by RLS:

-- CREATE POLICY "Allow postgres user full access to bookings"
--   ON public.hubspot_bookings
--   FOR ALL
--   TO postgres
--   USING (true)
--   WITH CHECK (true);

-- CREATE POLICY "Allow postgres user full access to exams"
--   ON public.hubspot_mock_exams
--   FOR ALL
--   TO postgres
--   USING (true)
--   WITH CHECK (true);
```

⚠️ **RLS WARNING**: Once RLS is enabled, even admin users will be subject to policies unless:
- A policy explicitly grants them access, OR
- They have the `BYPASSRLS` attribute (postgres superuser has this by default)

---

## Step 4: Verify User Permissions

Run these verification queries to ensure permissions are correct:

```sql
-- ============================================
-- Verify user exists and is active
-- ============================================
SELECT * FROM pg_user WHERE usename = 'zapier_sync_user';
-- Should return 1 row with usecreatedb=false, usesuper=false

-- ============================================
-- Verify table permissions
-- ============================================

-- Check hubspot_bookings permissions
SELECT grantee, privilege_type
FROM information_schema.table_privileges
WHERE table_name = 'hubspot_bookings'
  AND grantee = 'zapier_sync_user'
ORDER BY privilege_type;

-- Expected output:
-- grantee             | privilege_type
-- zapier_sync_user    | INSERT
-- zapier_sync_user    | SELECT
-- zapier_sync_user    | UPDATE

-- Check hubspot_mock_exams permissions
SELECT grantee, privilege_type
FROM information_schema.table_privileges
WHERE table_name = 'hubspot_mock_exams'
  AND grantee = 'zapier_sync_user'
ORDER BY privilege_type;

-- Expected output:
-- grantee             | privilege_type
-- zapier_sync_user    | INSERT
-- zapier_sync_user    | SELECT
-- zapier_sync_user    | UPDATE

-- ============================================
-- Verify all permissions for user
-- ============================================
SELECT table_name, privilege_type
FROM information_schema.table_privileges
WHERE grantee = 'zapier_sync_user'
  AND table_schema = 'public'
ORDER BY table_name, privilege_type;
```

---

## Step 5: Test Connection with Limited User

Test that the user has exactly the right permissions:

```bash
# Connect as zapier_sync_user (replace with your credentials)
psql -h db.YOUR_PROJECT_ID.supabase.co \
     -U zapier_sync_user \
     -d postgres \
     -W

# You'll be prompted for the password
# Enter: YOUR_SECURE_PASSWORD_HERE
```

Once connected, test these operations:

```sql
-- ✅ Should SUCCEED: Read from sync tables
SELECT COUNT(*) FROM public.hubspot_bookings;
SELECT COUNT(*) FROM public.hubspot_mock_exams;

-- ✅ Should SUCCEED: Insert into sync tables
INSERT INTO public.hubspot_bookings (hubspot_id, booking_id)
VALUES ('test_' || NOW()::text, 'test_booking')
RETURNING *;

-- ✅ Should SUCCEED: Update sync tables
UPDATE public.hubspot_bookings
SET student_email = 'test@example.com'
WHERE hubspot_id LIKE 'test_%'
RETURNING *;

-- ❌ Should FAIL: Cannot delete records
DELETE FROM public.hubspot_bookings
WHERE hubspot_id LIKE 'test_%';
-- Expected error: permission denied

-- ⚠️ Note: Test records will remain in the database since DELETE is blocked.
-- Clean up test records using an admin user:
-- DELETE FROM public.hubspot_bookings WHERE hubspot_id LIKE 'test_%';

-- ❌ Should FAIL: Cannot create tables
CREATE TABLE test_table (id SERIAL PRIMARY KEY);
-- Expected error: permission denied

-- ❌ Should FAIL: Cannot drop tables
DROP TABLE public.hubspot_bookings;
-- Expected error: permission denied

-- ❌ Should FAIL: Cannot access other schemas
SELECT * FROM information_schema.tables;
-- Should only show public schema tables
```

---

## Step 6: Configure Zapier with Limited User Credentials

### 6.1 Get Connection String

From Supabase Dashboard:

1. Go to **Settings** → **Database**
2. Copy the connection string (under "Connection pooler" or "Direct connection")
3. Format should look like:
   ```
   postgresql://zapier_sync_user:YOUR_PASSWORD@db.PROJECT_ID.supabase.co:5432/postgres
   ```

### 6.2 Store Credentials Securely

**IMPORTANT**: Never commit credentials to git or expose in logs.

**Option 1: Zapier Native Supabase Integration**
- Zapier has built-in Supabase connector
- Use Project URL + Service Role Key (more secure for Zapier)
- See Zapier docs for setup

**Option 2: Raw SQL/Connection String**
- Some Zapier apps allow direct Postgres connection
- Use the connection string above
- Never share the password

---

## Step 7: Create Database Backup

Always backup before major changes:

```bash
# Backup the database
pg_dump -h db.YOUR_PROJECT_ID.supabase.co \
        -U postgres \
        -d postgres \
        -F custom \
        -f backup_before_zapier_user.dump

# This backup includes:
# - Schema
# - Data
# - Roles and permissions
# - All sequences and functions
```

---

## Minimal Access Summary

### What zapier_sync_user CAN do:
✅ SELECT data from hubspot_bookings
✅ SELECT data from hubspot_mock_exams
✅ INSERT new records
✅ UPDATE existing records (upsert)
✅ Read sequences/auto-increment IDs

### What zapier_sync_user CANNOT do:
❌ DELETE records
❌ DROP tables
❌ CREATE tables
❌ ALTER schemas
❌ GRANT/REVOKE permissions
❌ Access other schemas (auth, storage, etc.)
❌ Access private tables
❌ Execute arbitrary SQL functions
❌ Create backups

---

## Security Best Practices

### 1. Password Management
```
✅ DO:
- Use 32+ character random passwords
- Store in secure password manager
- Rotate every 90 days
- Never share password

❌ DON'T:
- Use simple passwords like "password123"
- Store in version control
- Use same password as admin
- Email the password
```

### 2. Monitoring & Auditing
```sql
-- View login attempts (if logging enabled)
SELECT * FROM pg_stat_statements
WHERE query LIKE '%zapier_sync_user%';

-- View recent database changes (requires audit_log table setup)
-- SELECT * FROM audit_log
-- WHERE user_id = 'zapier_sync_user'
-- ORDER BY created_at DESC
-- LIMIT 10;
```

### 3. Regular Security Checks

**Monthly**: Check for unauthorized access
```sql
SELECT usename, usesuper FROM pg_user WHERE usename LIKE '%sync%';
```

**Quarterly**: Verify role permissions haven't changed
```sql
SELECT table_name, privilege_type
FROM information_schema.table_privileges
WHERE grantee = 'zapier_sync_user';
```

**Annually**: Rotate password
```sql
ALTER USER zapier_sync_user WITH PASSWORD 'NEW_SECURE_PASSWORD';
```

### 4. Disable User if Needed
```sql
-- Temporarily disable login
ALTER USER zapier_sync_user WITH NOLOGIN;

-- Re-enable login
ALTER USER zapier_sync_user WITH LOGIN;

-- Delete user (after reassigning objects)
DROP ROLE zapier_sync_user;
```

---

## Troubleshooting

### Connection Refused
```
Error: "could not connect to server: Connection refused"

Solution:
1. Verify IP is whitelisted in Supabase (Settings → Network)
2. Check password is correct
3. Verify database URL is correct
4. Check database is not in maintenance mode
```

### Permission Denied
```
Error: "permission denied for schema public"

Solution:
Run this as admin:
GRANT USAGE ON SCHEMA public TO zapier_sync_user;
```

### Upsert Not Working
```
Error: "Duplicate key value violates unique constraint"

Solution:
Ensure hubspot_id is properly set as UNIQUE constraint
Zapier must provide hubspot_id for upsert to work
```

### Cannot See New Records
```
Error: "SELECT returned 0 rows"

Solution:
1. Verify RLS policies allow zapier_sync_user to SELECT
2. Check that rows have proper timestamps
3. Verify user permissions with verification queries above
```

---

## Migration Steps (If Changing from Admin User)

If you're currently using the admin user/service role key with Zapier, migrate safely:

```sql
-- Step 1: Create new limited user (this guide)
CREATE ROLE zapier_sync_user ...

-- Step 2: Grant permissions (this guide)
GRANT SELECT, INSERT, UPDATE ON public.hubspot_bookings TO zapier_sync_user;

-- Step 3: Test in Zapier with new credentials

-- Step 4: Once verified working, optionally revoke admin permissions
-- (But keep admin user active for emergencies)

-- Step 5: Monitor for 1 week for issues
```

---

## Reference: SQL Syntax

### Create User
```sql
CREATE ROLE role_name WITH LOGIN PASSWORD 'password';
```

### Grant Permissions
```sql
GRANT { SELECT | INSERT | UPDATE | DELETE | TRUNCATE | REFERENCES | TRIGGER }
  ON { TABLE table_name | ALL TABLES IN SCHEMA schema_name }
  TO role_name;
```

### Revoke Permissions
```sql
REVOKE { SELECT | INSERT | UPDATE | DELETE }
  ON { TABLE table_name }
  FROM role_name;
```

### List All Users
```sql
\du+
```

### List User Permissions
```sql
SELECT grantee, privilege_type
FROM role_table_grants
WHERE grantee = 'zapier_sync_user';
```

---

## Related Documents

- [HubSpot → Zapier → Supabase Sync PRD](sync-option1-hubspot-zapier-supabase.md)
- [Supabase Official Docs - Database Users](https://supabase.com/docs/guides/database)
- [Supabase RLS (Row Level Security)](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Role Management](https://www.postgresql.org/docs/current/user-manag.html)

---

## Checklist: Setup Complete ✅

- [ ] Created `zapier_sync_user` role with LOGIN
- [ ] Set secure password (32+ characters)
- [ ] Granted USAGE on public schema
- [ ] Granted SELECT, INSERT, UPDATE on hubspot_bookings
- [ ] Granted SELECT, INSERT, UPDATE on hubspot_mock_exams
- [ ] Granted USAGE on all sequences
- [ ] Enabled RLS policies (optional but recommended)
- [ ] Tested user permissions with verification queries
- [ ] Tested connection string works
- [ ] Backed up database
- [ ] Stored credentials securely (not in git)
- [ ] Documented password location
- [ ] Ready to configure Zapier with new credentials

---

**Version**: 1.0
**Last Updated**: 2025-01-24
**Status**: Ready for Production
