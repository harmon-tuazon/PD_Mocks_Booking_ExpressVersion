-- Fix sync_metadata table RLS permissions
-- Run this to ensure service role has proper access

-- First, disable RLS temporarily to clean up
ALTER TABLE public.sync_metadata DISABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Service role can manage sync metadata" ON public.sync_metadata;
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.sync_metadata;

-- Re-enable RLS
ALTER TABLE public.sync_metadata ENABLE ROW LEVEL SECURITY;

-- Create policy for service_role (for cron jobs using service role key)
CREATE POLICY "service_role_all_access"
  ON public.sync_metadata
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Grant explicit permissions to service_role
GRANT ALL ON public.sync_metadata TO service_role;
GRANT USAGE ON SCHEMA public TO service_role;

-- Also grant to authenticated for dashboard viewing (optional)
GRANT SELECT ON public.sync_metadata TO authenticated;

-- Verify permissions
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'sync_metadata';

SELECT
  policyname,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'sync_metadata';
