-- ============================================================
-- Supabase Setup for Contact Credits Secondary Database
-- Pattern: Same as bookings/exams - HubSpot is source of truth
-- Run this in Supabase SQL Editor
-- ============================================================

-- ============== STEP 1: CREATE TABLE ==============

CREATE TABLE IF NOT EXISTS public.hubspot_contact_credits (
  -- Primary Keys (UUID to avoid sequence permission issues)
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hubspot_id TEXT UNIQUE NOT NULL, -- HubSpot contact ID

  -- Contact Identification
  student_id TEXT NOT NULL,
  email TEXT NOT NULL,
  firstname TEXT,
  lastname TEXT,

  -- Credit Properties
  sj_credits INTEGER DEFAULT 0,
  cs_credits INTEGER DEFAULT 0,
  sjmini_credits INTEGER DEFAULT 0,
  mock_discussion_token INTEGER DEFAULT 0,
  shared_mock_credits INTEGER DEFAULT 0,

  -- Additional Contact Properties
  ndecc_exam_date TEXT,

  -- Sync Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  synced_at TIMESTAMP DEFAULT NOW(),

  -- Unique constraint for student_id + email
  CONSTRAINT unique_student_email UNIQUE(student_id, email)
);

-- ============== STEP 2: CREATE INDEXES ==============

CREATE INDEX IF NOT EXISTS idx_contact_credits_student_id ON public.hubspot_contact_credits(student_id);
CREATE INDEX IF NOT EXISTS idx_contact_credits_email ON public.hubspot_contact_credits(email);
CREATE INDEX IF NOT EXISTS idx_contact_credits_hubspot_id ON public.hubspot_contact_credits(hubspot_id);
CREATE INDEX IF NOT EXISTS idx_contact_credits_synced_at ON public.hubspot_contact_credits(synced_at);

-- ============== STEP 3: ENABLE ROW LEVEL SECURITY ==============

ALTER TABLE public.hubspot_contact_credits ENABLE ROW LEVEL SECURITY;

-- ============== STEP 4: CREATE RLS POLICY ==============

-- Block all direct access (service_role bypasses this automatically)
CREATE POLICY "Deny direct access to contact_credits"
ON public.hubspot_contact_credits
FOR ALL
TO anon, authenticated
USING (false);

-- ============== STEP 5: REVOKE PERMISSIONS ==============

REVOKE ALL ON public.hubspot_contact_credits FROM anon, authenticated;

-- ============== STEP 6: ADD COMMENTS ==============

COMMENT ON TABLE public.hubspot_contact_credits IS 'Secondary database (read replica) for HubSpot contact credit data. Eliminates 429 rate limit errors.';
COMMENT ON COLUMN public.hubspot_contact_credits.synced_at IS 'Last time this record was synced from HubSpot (source of truth)';
COMMENT ON COLUMN public.hubspot_contact_credits.sj_credits IS 'Situational Judgment specific credits';
COMMENT ON COLUMN public.hubspot_contact_credits.cs_credits IS 'Clinical Skills specific credits';
COMMENT ON COLUMN public.hubspot_contact_credits.sjmini_credits IS 'Mini-mock specific credits (no shared credits)';
COMMENT ON COLUMN public.hubspot_contact_credits.mock_discussion_token IS 'Mock Discussion specific credits (no shared credits)';
COMMENT ON COLUMN public.hubspot_contact_credits.shared_mock_credits IS 'Shared credits usable for SJ and CS only';

-- ============== VERIFICATION QUERIES ==============

-- Check table was created
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name = 'hubspot_contact_credits';

-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = 'hubspot_contact_credits';

-- Check policy exists
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'hubspot_contact_credits';

-- ============== SUCCESS MESSAGE ==============

DO $$
BEGIN
  RAISE NOTICE '✅ Contact credits table created successfully!';
  RAISE NOTICE 'Table: public.hubspot_contact_credits';
  RAISE NOTICE 'ID Type: UUID (auto-generated, no sequence issues)';
  RAISE NOTICE 'RLS: Enabled (service_role bypasses)';
  RAISE NOTICE 'Ready for migration script!';
END $$;
