-- =========================================================================
-- SQL Script: Create RPC Functions for Prerequisite Management
-- =========================================================================
-- Two functions:
-- 1. update_exam_prerequisites: Delta-based updates (add/remove)
-- 2. set_exam_prerequisites: Full replacement (for sync/backfill)
-- =========================================================================

-- =========================================================================
-- RPC Function: update_exam_prerequisites (Delta-Based)
-- =========================================================================
-- Supports delta-based updates for checkbox UI pattern:
-- - p_add_ids: Array of exam IDs to add as prerequisites
-- - p_remove_ids: Array of exam IDs to remove from prerequisites
-- - Preserves existing values not in add/remove lists
-- - Returns the updated array after modification
-- =========================================================================

CREATE OR REPLACE FUNCTION hubspot_sync.update_exam_prerequisites(
  p_exam_id TEXT,                    -- HubSpot ID of the exam to update
  p_add_ids TEXT[] DEFAULT '{}',     -- IDs to add (newly checked)
  p_remove_ids TEXT[] DEFAULT '{}'   -- IDs to remove (newly unchecked)
)
RETURNS JSONB AS $$
DECLARE
  v_result TEXT[];
  v_previous TEXT[];
  v_added_count INTEGER := 0;
  v_removed_count INTEGER := 0;
BEGIN
  -- Get current prerequisites for logging
  SELECT COALESCE(prerequisite_exam_ids, '{}')
  INTO v_previous
  FROM hubspot_sync.hubspot_mock_exams
  WHERE hubspot_id = p_exam_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exam % not found in Supabase', p_exam_id;
  END IF;

  -- Perform atomic update with add and remove operations
  UPDATE hubspot_sync.hubspot_mock_exams
  SET
    prerequisite_exam_ids = (
      SELECT COALESCE(array_agg(DISTINCT elem ORDER BY elem), '{}')
      FROM (
        -- Start with existing prerequisites
        SELECT unnest(COALESCE(prerequisite_exam_ids, '{}')) AS elem
        -- Exclude items being removed
        EXCEPT
        SELECT unnest(p_remove_ids)
        -- Union with items being added
        UNION
        SELECT unnest(p_add_ids)
      ) sub
      WHERE elem IS NOT NULL AND elem != ''
    ),
    updated_at = NOW()
  WHERE hubspot_id = p_exam_id
  RETURNING prerequisite_exam_ids INTO v_result;

  -- Ensure v_result is not null
  v_result := COALESCE(v_result, '{}');

  -- Calculate what was actually added
  SELECT COUNT(*) INTO v_added_count
  FROM unnest(v_result) AS elem
  WHERE elem = ANY(p_add_ids) AND NOT elem = ANY(v_previous);

  -- Calculate what was actually removed
  SELECT COUNT(*) INTO v_removed_count
  FROM unnest(v_previous) AS elem
  WHERE elem = ANY(p_remove_ids) AND NOT elem = ANY(v_result);

  -- Return detailed result
  RETURN jsonb_build_object(
    'success', true,
    'exam_id', p_exam_id,
    'prerequisite_exam_ids', v_result,
    'previous_count', COALESCE(array_length(v_previous, 1), 0),
    'current_count', COALESCE(array_length(v_result, 1), 0),
    'added_count', v_added_count,
    'removed_count', v_removed_count,
    'requested_add', p_add_ids,
    'requested_remove', p_remove_ids
  );
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION hubspot_sync.update_exam_prerequisites(TEXT, TEXT[], TEXT[]) TO service_role;


-- =========================================================================
-- RPC Function: set_exam_prerequisites (Full Replacement)
-- =========================================================================
-- For cases where full replacement is needed:
-- - Initial sync from HubSpot (cron job)
-- - Backfill operations
-- - Direct admin override
-- =========================================================================

CREATE OR REPLACE FUNCTION hubspot_sync.set_exam_prerequisites(
  p_exam_id TEXT,
  p_prerequisite_ids TEXT[]
)
RETURNS JSONB AS $$
DECLARE
  v_result TEXT[];
  v_previous_count INTEGER;
BEGIN
  -- Get previous count for logging
  SELECT COALESCE(array_length(prerequisite_exam_ids, 1), 0)
  INTO v_previous_count
  FROM hubspot_sync.hubspot_mock_exams
  WHERE hubspot_id = p_exam_id;

  -- Perform full replacement
  UPDATE hubspot_sync.hubspot_mock_exams
  SET
    prerequisite_exam_ids = COALESCE(p_prerequisite_ids, '{}'),
    updated_at = NOW()
  WHERE hubspot_id = p_exam_id
  RETURNING prerequisite_exam_ids INTO v_result;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exam % not found in Supabase', p_exam_id;
  END IF;

  -- Ensure v_result is not null
  v_result := COALESCE(v_result, '{}');

  RETURN jsonb_build_object(
    'success', true,
    'exam_id', p_exam_id,
    'prerequisite_exam_ids', v_result,
    'previous_count', v_previous_count,
    'current_count', COALESCE(array_length(v_result, 1), 0)
  );
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION hubspot_sync.set_exam_prerequisites(TEXT, TEXT[]) TO service_role;


-- =========================================================================
-- Test Cases (Run manually to verify)
-- =========================================================================
/*
-- Test 1: Delta update - add prerequisites
SELECT hubspot_sync.update_exam_prerequisites(
  '123456',           -- exam_id
  ARRAY['111', '222'],  -- add these
  ARRAY[]::TEXT[]       -- remove none
);

-- Test 2: Delta update - remove prerequisites
SELECT hubspot_sync.update_exam_prerequisites(
  '123456',
  ARRAY[]::TEXT[],      -- add none
  ARRAY['111']          -- remove this
);

-- Test 3: Delta update - add and remove in one operation
SELECT hubspot_sync.update_exam_prerequisites(
  '123456',
  ARRAY['333'],         -- add this
  ARRAY['222']          -- remove this
);

-- Test 4: Full replacement
SELECT hubspot_sync.set_exam_prerequisites(
  '123456',
  ARRAY['444', '555', '666']
);

-- Test 5: Clear all prerequisites
SELECT hubspot_sync.set_exam_prerequisites(
  '123456',
  ARRAY[]::TEXT[]
);
*/


-- =========================================================================
-- Verification Queries
-- =========================================================================

-- Check functions exist
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'hubspot_sync'
  AND routine_name IN ('update_exam_prerequisites', 'set_exam_prerequisites');

-- Check function signatures
SELECT p.proname, pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'hubspot_sync'
  AND p.proname IN ('update_exam_prerequisites', 'set_exam_prerequisites');
