-- ============================================================
-- Supabase Setup for Supabase-First Read Architecture
-- Run these commands in Supabase SQL Editor
-- ============================================================

-- ============== STEP 1: CREATE TABLES ==============

-- Bookings sync table
CREATE TABLE IF NOT EXISTS public.hubspot_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hubspot_id TEXT UNIQUE NOT NULL,
  booking_id TEXT,
  mock_exam_id TEXT,
  contact_id TEXT,
  student_id TEXT,
  student_name TEXT,
  student_email TEXT,
  booking_status TEXT,
  is_active TEXT,
  attendance TEXT,
  attending_location TEXT,
  exam_date TIMESTAMP,
  dominant_hand TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  synced_at TIMESTAMP DEFAULT NOW()
);

-- Mock Exams sync table
CREATE TABLE IF NOT EXISTS public.hubspot_mock_exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hubspot_id TEXT UNIQUE NOT NULL,
  mock_exam_name TEXT,
  mock_type TEXT,
  exam_date DATE,
  start_time TEXT,
  end_time TEXT,
  location TEXT,
  capacity INTEGER,
  total_bookings INTEGER DEFAULT 0,
  is_active TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  synced_at TIMESTAMP DEFAULT NOW()
);

-- ============== STEP 2: CREATE INDEXES ==============

CREATE INDEX idx_bookings_hubspot_id ON public.hubspot_bookings(hubspot_id);
CREATE INDEX idx_bookings_exam_id ON public.hubspot_bookings(mock_exam_id);
CREATE INDEX idx_bookings_contact_id ON public.hubspot_bookings(contact_id);
CREATE INDEX idx_exams_hubspot_id ON public.hubspot_mock_exams(hubspot_id);
CREATE INDEX idx_exams_date ON public.hubspot_mock_exams(exam_date);
CREATE INDEX idx_exams_active ON public.hubspot_mock_exams(is_active);

-- ============== STEP 3: ENABLE ROW LEVEL SECURITY ==============

ALTER TABLE public.hubspot_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hubspot_mock_exams ENABLE ROW LEVEL SECURITY;

-- ============== STEP 4: CREATE RLS POLICIES ==============

-- Policy: Block all direct access to bookings (service_role bypasses this)
CREATE POLICY "Deny direct access to bookings"
ON public.hubspot_bookings
FOR ALL
TO anon, authenticated
USING (false);

-- Policy: Block all direct access to mock_exams (service_role bypasses this)
CREATE POLICY "Deny direct access to mock_exams"
ON public.hubspot_mock_exams
FOR ALL
TO anon, authenticated
USING (false);

-- ============== STEP 5: REVOKE PERMISSIONS ON HUBSPOT SYNC TABLES ==============

-- Only revoke from HubSpot sync tables (preserves access to existing RBAC tables like admin_users)
REVOKE ALL ON public.hubspot_bookings FROM anon, authenticated;
REVOKE ALL ON public.hubspot_mock_exams FROM anon, authenticated;

-- ============== OPTIONAL: AUDIT LOGGING ==============

-- Uncomment the following if you want to track data changes

/*
-- Create audit table
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL,
  record_id TEXT,
  performed_at TIMESTAMP DEFAULT NOW(),
  performed_by TEXT
);

-- Add trigger to bookings table
CREATE OR REPLACE FUNCTION log_booking_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_log (table_name, operation, record_id, performed_by)
  VALUES (
    'hubspot_bookings',
    TG_OP,
    COALESCE(NEW.hubspot_id, OLD.hubspot_id),
    current_user
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bookings_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.hubspot_bookings
FOR EACH ROW EXECUTE FUNCTION log_booking_changes();

-- Add trigger to mock_exams table
CREATE OR REPLACE FUNCTION log_exam_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_log (table_name, operation, record_id, performed_by)
  VALUES (
    'hubspot_mock_exams',
    TG_OP,
    COALESCE(NEW.hubspot_id, OLD.hubspot_id),
    current_user
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER exams_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.hubspot_mock_exams
FOR EACH ROW EXECUTE FUNCTION log_exam_changes();
*/

-- ============== OPTIONAL: CUSTOM SCHEMA (Advanced) ==============

-- Uncomment if you want tables in a private schema instead of public


-- Create private schema
CREATE SCHEMA IF NOT EXISTS hubspot_sync;

-- Move tables to private schema
ALTER TABLE public.hubspot_bookings SET SCHEMA hubspot_sync;
ALTER TABLE public.hubspot_mock_exams SET SCHEMA hubspot_sync;

-- Note: You'll need to update all code references to use hubspot_sync.table_name


-- ============== VERIFICATION QUERIES ==============

-- Check tables were created
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('hubspot_bookings', 'hubspot_mock_exams');

-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('hubspot_bookings', 'hubspot_mock_exams');

-- Check policies exist
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public';

-- Check for unprotected tables (should return empty)
SELECT schemaname, tablename
FROM pg_tables
WHERE schemaname = 'public'
AND tablename NOT IN (
  SELECT tablename FROM pg_policies WHERE schemaname = 'public'
);
