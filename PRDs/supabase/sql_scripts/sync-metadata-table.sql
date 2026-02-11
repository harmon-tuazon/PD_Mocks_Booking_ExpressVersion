-- Create sync_metadata table for tracking incremental sync timestamps
-- This enables efficient incremental syncs by only fetching changed records

CREATE TABLE IF NOT EXISTS public.sync_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type TEXT UNIQUE NOT NULL,  -- 'mock_exams', 'contact_credits', 'bookings'
  last_sync_timestamp BIGINT NOT NULL,  -- Unix timestamp in milliseconds
  updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for fast lookups by sync_type
CREATE INDEX IF NOT EXISTS idx_sync_metadata_type ON public.sync_metadata(sync_type);

-- Enable RLS (Row Level Security)
ALTER TABLE public.sync_metadata ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role full access
CREATE POLICY "Service role can manage sync metadata"
  ON public.sync_metadata
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Initial seed data (optional - will be created on first sync if not exists)
INSERT INTO public.sync_metadata (sync_type, last_sync_timestamp)
VALUES
  ('mock_exams', 0),
  ('contact_credits', 0),
  ('bookings', 0)
ON CONFLICT (sync_type) DO NOTHING;

-- Comments for documentation
COMMENT ON TABLE public.sync_metadata IS 'Tracks last successful sync timestamps for incremental HubSpot syncs';
COMMENT ON COLUMN public.sync_metadata.sync_type IS 'Type of sync: mock_exams, contact_credits, or bookings';
COMMENT ON COLUMN public.sync_metadata.last_sync_timestamp IS 'Unix timestamp (ms) of last successful sync - used for hs_lastmodifieddate filter';
COMMENT ON COLUMN public.sync_metadata.updated_at IS 'Last time this sync was updated';
