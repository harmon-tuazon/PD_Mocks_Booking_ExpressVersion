-- Supabase table for caching HubSpot contact credit information
-- This eliminates 429 rate limit errors by serving reads from Supabase

CREATE TABLE IF NOT EXISTS hubspot_contact_credits (
  -- Primary Keys
  id BIGSERIAL PRIMARY KEY,
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
CREATE INDEX IF NOT EXISTS idx_student_id ON hubspot_contact_credits(student_id);
CREATE INDEX IF NOT EXISTS idx_email ON hubspot_contact_credits(email);
CREATE INDEX IF NOT EXISTS idx_hubspot_id ON hubspot_contact_credits(hubspot_id);
CREATE INDEX IF NOT EXISTS idx_synced_at ON hubspot_contact_credits(synced_at);

-- Row-level security (RLS) - allow service role full access
ALTER TABLE hubspot_contact_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access" ON hubspot_contact_credits
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Grant necessary permissions to service role
GRANT ALL ON hubspot_contact_credits TO service_role;
GRANT USAGE, SELECT ON SEQUENCE hubspot_contact_credits_id_seq TO service_role;

-- Comments for documentation
COMMENT ON TABLE hubspot_contact_credits IS 'Cached HubSpot contact credit data to avoid 429 rate limit errors';
COMMENT ON COLUMN hubspot_contact_credits.synced_at IS 'Last time this record was synced from HubSpot';
COMMENT ON COLUMN hubspot_contact_credits.sj_credits IS 'Situational Judgment specific credits';
COMMENT ON COLUMN hubspot_contact_credits.cs_credits IS 'Clinical Skills specific credits';
COMMENT ON COLUMN hubspot_contact_credits.sjmini_credits IS 'Mini-mock specific credits (no shared credits)';
COMMENT ON COLUMN hubspot_contact_credits.mock_discussion_token IS 'Mock Discussion specific credits (no shared credits)';
COMMENT ON COLUMN hubspot_contact_credits.shared_mock_credits IS 'Shared credits usable for SJ and CS only';
