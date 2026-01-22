-- Supabase secondary database table for HubSpot contact credit information
-- Pattern: Same as bookings/exams - HubSpot is source of truth, Supabase is read replica
-- This eliminates 429 rate limit errors by serving reads from Supabase instead of HubSpot

CREATE TABLE IF NOT EXISTS public.hubspot_contact_credits (
  -- Primary Keys
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

  -- Indexes for fast lookups
  CONSTRAINT unique_student_email UNIQUE(student_id, email)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_contact_credits_student_id ON public.hubspot_contact_credits(student_id);
CREATE INDEX IF NOT EXISTS idx_contact_credits_email ON public.hubspot_contact_credits(email);
CREATE INDEX IF NOT EXISTS idx_contact_credits_hubspot_id ON public.hubspot_contact_credits(hubspot_id);
CREATE INDEX IF NOT EXISTS idx_contact_credits_synced_at ON public.hubspot_contact_credits(synced_at);

-- Row-level security (RLS) - block direct access (service_role bypasses this)
ALTER TABLE public.hubspot_contact_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny direct access to contact_credits"
ON public.hubspot_contact_credits
FOR ALL
TO anon, authenticated
USING (false);

-- Revoke permissions from anon and authenticated users
REVOKE ALL ON public.hubspot_contact_credits FROM anon, authenticated;

-- Comments for documentation
COMMENT ON TABLE hubspot_contact_credits IS 'Secondary database (read replica) for HubSpot contact credit data. Eliminates 429 rate limit errors.';
COMMENT ON COLUMN hubspot_contact_credits.synced_at IS 'Last time this record was synced from HubSpot (source of truth)';
COMMENT ON COLUMN hubspot_contact_credits.sj_credits IS 'Situational Judgment specific credits';
COMMENT ON COLUMN hubspot_contact_credits.cs_credits IS 'Clinical Skills specific credits';
COMMENT ON COLUMN hubspot_contact_credits.sjmini_credits IS 'Mini-mock specific credits (no shared credits)';
COMMENT ON COLUMN hubspot_contact_credits.mock_discussion_token IS 'Mock Discussion specific credits (no shared credits)';
COMMENT ON COLUMN hubspot_contact_credits.shared_mock_credits IS 'Shared credits usable for SJ and CS only';
