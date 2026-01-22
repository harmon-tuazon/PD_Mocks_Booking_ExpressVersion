-- =========================================================================
-- SQL Script: Add prerequisite_exam_ids Column to hubspot_mock_exams
-- =========================================================================
-- Purpose: Store prerequisite exam IDs as a TEXT[] array for fast reads
-- This enables Supabase-first prerequisite validation (~50ms vs ~500ms HubSpot)
-- =========================================================================

-- Step 1: Add prerequisite_exam_ids array column
-- Uses TEXT[] to store HubSpot exam IDs (numeric strings)
ALTER TABLE hubspot_sync.hubspot_mock_exams
ADD COLUMN IF NOT EXISTS prerequisite_exam_ids TEXT[] DEFAULT '{}';

-- Step 2: Add comment explaining the column purpose
COMMENT ON COLUMN hubspot_sync.hubspot_mock_exams.prerequisite_exam_ids IS
  'Array of HubSpot mock exam IDs that are prerequisites for this exam (Mock Discussions only). Synced from HubSpot association type 1340.';

-- Step 3: Create GIN index for efficient array operations
-- GIN indexes are optimized for array containment queries (@>, &&, etc.)
CREATE INDEX IF NOT EXISTS idx_hubspot_mock_exams_prerequisite_ids
ON hubspot_sync.hubspot_mock_exams USING GIN (prerequisite_exam_ids)
WHERE prerequisite_exam_ids IS NOT NULL AND array_length(prerequisite_exam_ids, 1) > 0;

-- Step 4: Verify the column was added correctly
SELECT column_name, data_type, udt_name, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'hubspot_sync'
  AND table_name = 'hubspot_mock_exams'
  AND column_name = 'prerequisite_exam_ids';

-- =========================================================================
-- Verification Query
-- =========================================================================
-- Check that the index was created
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'hubspot_sync'
  AND tablename = 'hubspot_mock_exams'
  AND indexname LIKE '%prerequisite%';
