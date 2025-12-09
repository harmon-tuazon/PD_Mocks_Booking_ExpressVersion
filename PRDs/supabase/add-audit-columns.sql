-- ============================================================
-- Add Enhanced Columns to Existing Audit Log
-- Simply adds old_values, new_values, changed_fields columns
-- ============================================================

-- Add new columns to existing audit_log table
ALTER TABLE hubspot_sync.audit_log
ADD COLUMN IF NOT EXISTS old_values JSONB,
ADD COLUMN IF NOT EXISTS new_values JSONB,
ADD COLUMN IF NOT EXISTS changed_fields TEXT[];

-- ============================================================
-- Helper Function: Get Changed Fields
-- ============================================================

CREATE OR REPLACE FUNCTION hubspot_sync.get_changed_fields(old_row JSONB, new_row JSONB)
RETURNS TEXT[] AS $$
DECLARE
  changed TEXT[] := ARRAY[]::TEXT[];
  field TEXT;
BEGIN
  IF old_row IS NULL OR new_row IS NULL THEN
    RETURN changed;
  END IF;

  FOR field IN SELECT jsonb_object_keys(new_row)
  LOOP
    IF field NOT IN ('synced_at', 'updated_at') THEN
      IF old_row->field IS DISTINCT FROM new_row->field THEN
        changed := array_append(changed, field);
      END IF;
    END IF;
  END LOOP;

  RETURN changed;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================
-- Updated Trigger Function for Bookings
-- ============================================================

CREATE OR REPLACE FUNCTION hubspot_sync.log_booking_changes()
RETURNS TRIGGER AS $$
DECLARE
  old_json JSONB;
  new_json JSONB;
  changed_fields TEXT[];
BEGIN
  -- Convert rows to JSONB
  IF TG_OP = 'DELETE' THEN
    old_json := to_jsonb(OLD);
    new_json := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    old_json := NULL;
    new_json := to_jsonb(NEW);
  ELSE -- UPDATE
    old_json := to_jsonb(OLD);
    new_json := to_jsonb(NEW);
    changed_fields := hubspot_sync.get_changed_fields(old_json, new_json);
  END IF;

  -- Insert audit record with new columns
  INSERT INTO hubspot_sync.audit_log (
    table_name,
    operation,
    record_id,
    performed_by,
    old_values,
    new_values,
    changed_fields
  ) VALUES (
    'hubspot_bookings',
    TG_OP,
    COALESCE(NEW.hubspot_id, OLD.hubspot_id),
    current_user,
    old_json,
    new_json,
    changed_fields
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Updated Trigger Function for Contact Credits
-- ============================================================

CREATE OR REPLACE FUNCTION hubspot_sync.log_contact_credits_changes()
RETURNS TRIGGER AS $$
DECLARE
  old_json JSONB;
  new_json JSONB;
  changed_fields TEXT[];
BEGIN
  IF TG_OP = 'DELETE' THEN
    old_json := to_jsonb(OLD);
    new_json := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    old_json := NULL;
    new_json := to_jsonb(NEW);
  ELSE -- UPDATE
    old_json := to_jsonb(OLD);
    new_json := to_jsonb(NEW);
    changed_fields := hubspot_sync.get_changed_fields(old_json, new_json);
  END IF;

  INSERT INTO hubspot_sync.audit_log (
    table_name,
    operation,
    record_id,
    performed_by,
    old_values,
    new_values,
    changed_fields
  ) VALUES (
    'hubspot_contact_credits',
    TG_OP,
    COALESCE(NEW.hubspot_id, OLD.hubspot_id),
    current_user,
    old_json,
    new_json,
    changed_fields
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Updated Trigger Function for Mock Exams
-- ============================================================

CREATE OR REPLACE FUNCTION hubspot_sync.log_exam_changes()
RETURNS TRIGGER AS $$
DECLARE
  old_json JSONB;
  new_json JSONB;
  changed_fields TEXT[];
BEGIN
  IF TG_OP = 'DELETE' THEN
    old_json := to_jsonb(OLD);
    new_json := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    old_json := NULL;
    new_json := to_jsonb(NEW);
  ELSE -- UPDATE
    old_json := to_jsonb(OLD);
    new_json := to_jsonb(NEW);
    changed_fields := hubspot_sync.get_changed_fields(old_json, new_json);
  END IF;

  INSERT INTO hubspot_sync.audit_log (
    table_name,
    operation,
    record_id,
    performed_by,
    old_values,
    new_values,
    changed_fields
  ) VALUES (
    'hubspot_mock_exams',
    TG_OP,
    COALESCE(NEW.hubspot_id, OLD.hubspot_id),
    current_user,
    old_json,
    new_json,
    changed_fields
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Step 4: Drop Old Triggers (if they exist)
-- ============================================================

DROP TRIGGER IF EXISTS bookings_audit_trigger ON hubspot_sync.hubspot_bookings;
DROP TRIGGER IF EXISTS contact_credits_audit_trigger ON hubspot_sync.hubspot_contact_credits;
DROP TRIGGER IF EXISTS exams_audit_trigger ON hubspot_sync.hubspot_mock_exams;

-- ============================================================
-- Step 5: Create New Triggers with Enhanced Logging
-- ============================================================

-- Trigger for hubspot_bookings
CREATE TRIGGER bookings_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON hubspot_sync.hubspot_bookings
FOR EACH ROW EXECUTE FUNCTION hubspot_sync.log_booking_changes();

-- Trigger for hubspot_contact_credits
CREATE TRIGGER contact_credits_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON hubspot_sync.hubspot_contact_credits
FOR EACH ROW EXECUTE FUNCTION hubspot_sync.log_contact_credits_changes();

-- Trigger for hubspot_mock_exams
CREATE TRIGGER exams_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON hubspot_sync.hubspot_mock_exams
FOR EACH ROW EXECUTE FUNCTION hubspot_sync.log_exam_changes();

-- ============================================================
-- Verification
-- ============================================================

-- Check triggers are installed
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'hubspot_sync'
  AND trigger_name LIKE '%audit%';

-- ============================================================
-- Original Verification (Columns)
-- ============================================================

-- Check columns were added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'hubspot_sync'
  AND table_name = 'audit_log'
  AND column_name IN ('old_values', 'new_values', 'changed_fields');

-- Test the helper function
SELECT hubspot_sync.get_changed_fields(
  '{"name": "John", "age": 30}'::jsonb,
  '{"name": "John", "age": 31}'::jsonb
);
-- Should return: {age}
