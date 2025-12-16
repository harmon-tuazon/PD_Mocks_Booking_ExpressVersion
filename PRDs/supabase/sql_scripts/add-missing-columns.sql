-- SQL to add missing columns and rename existing columns in Supabase tables
-- Run this in Supabase SQL Editor

-- =============================================
-- BOOKINGS TABLE - Rename existing columns
-- =============================================

-- Rename misnamed columns to match HubSpot property names
ALTER TABLE hubspot_bookings
RENAME COLUMN contact_id TO associated_contact_id;

ALTER TABLE hubspot_bookings
RENAME COLUMN mock_exam_id TO associated_mock_exam;

ALTER TABLE hubspot_bookings
RENAME COLUMN student_name TO name;

-- =============================================
-- BOOKINGS TABLE - Add missing columns
-- =============================================

-- Add token-related columns
ALTER TABLE hubspot_bookings
ADD COLUMN IF NOT EXISTS token_used TEXT;

ALTER TABLE hubspot_bookings
ADD COLUMN IF NOT EXISTS token_refunded_at TIMESTAMPTZ;

ALTER TABLE hubspot_bookings
ADD COLUMN IF NOT EXISTS token_refund_admin TEXT;

-- Add time-related columns
ALTER TABLE hubspot_bookings
ADD COLUMN IF NOT EXISTS start_time TEXT;

ALTER TABLE hubspot_bookings
ADD COLUMN IF NOT EXISTS end_time TEXT;

ALTER TABLE hubspot_bookings
ADD COLUMN IF NOT EXISTS ndecc_exam_date DATE;

-- Add idempotency key
ALTER TABLE hubspot_bookings
ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- Add mock_type for exam type (synced from HubSpot)
ALTER TABLE hubspot_bookings
ADD COLUMN IF NOT EXISTS mock_type TEXT;

-- =============================================
-- MOCK EXAMS TABLE - Add missing columns
-- =============================================

ALTER TABLE hubspot_mock_exams
ADD COLUMN IF NOT EXISTS scheduled_activation_datetime TIMESTAMPTZ;

-- =============================================
-- Verify columns were added
-- =============================================

-- Check bookings columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'hubspot_bookings'
ORDER BY ordinal_position;

-- Check mock exams columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'hubspot_mock_exams'
ORDER BY ordinal_position;
