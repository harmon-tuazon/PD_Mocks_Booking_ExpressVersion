-- =========================================================================
-- Atomic Increment/Decrement RPC Function for exam total_bookings
-- =========================================================================
--
-- Purpose: Provides atomic increment/decrement operations for total_bookings
--          to avoid race conditions when multiple bookings are created/cancelled
--          simultaneously.
--
-- Usage:
--   -- Increment by 1
--   SELECT increment_exam_bookings('42147795619', 1);
--
--   -- Decrement by 1
--   SELECT increment_exam_bookings('42147795619', -1);
--
--   -- Increment by 5
--   SELECT increment_exam_bookings('42147795619', 5);
--
-- Returns: The NEW total_bookings value after increment/decrement
--
-- Safety: Prevents negative counts (minimum value: 0)
-- =========================================================================

CREATE OR REPLACE FUNCTION increment_exam_bookings(
  p_exam_id TEXT,
  p_delta INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_count INTEGER;
BEGIN
  -- Atomic update with RETURNING clause
  UPDATE hubspot_mock_exams
  SET
    total_bookings = GREATEST(0, COALESCE(total_bookings, 0) + p_delta),
    updated_at = NOW(),
    synced_at = NOW()
  WHERE hubspot_id = p_exam_id
  RETURNING total_bookings INTO v_new_count;

  -- If no rows updated, exam doesn't exist in Supabase yet
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exam % not found in Supabase', p_exam_id;
  END IF;

  RETURN v_new_count;
END;
$$;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION increment_exam_bookings(TEXT, INTEGER) TO service_role;

-- Optional: Grant to authenticated users if needed
-- GRANT EXECUTE ON FUNCTION increment_exam_bookings(TEXT, INTEGER) TO authenticated;

-- =========================================================================
-- Test Cases
-- =========================================================================
--
-- 1. Test increment:
--    SELECT increment_exam_bookings('42147795619', 1);
--    -- Should return: current_count + 1
--
-- 2. Test decrement:
--    SELECT increment_exam_bookings('42147795619', -1);
--    -- Should return: current_count - 1
--
-- 3. Test negative prevention:
--    -- Set count to 1 first
--    UPDATE hubspot_mock_exams SET total_bookings = 1 WHERE hubspot_id = '42147795619';
--    -- Try to decrement by 5
--    SELECT increment_exam_bookings('42147795619', -5);
--    -- Should return: 0 (not -4)
--
-- 4. Test non-existent exam:
--    SELECT increment_exam_bookings('nonexistent', 1);
--    -- Should raise exception: Exam nonexistent not found in Supabase
-- =========================================================================