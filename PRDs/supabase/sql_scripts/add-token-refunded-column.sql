-- SQL to add missing token_refunded column to hubspot_bookings table
-- Run this in Supabase SQL Editor
--
-- Error: Could not find the 'token_refunded' column of 'hubspot_bookings' in the schema cache
-- This column is needed for refundService.refundToken() to track refund status

-- Set the schema (use the correct schema for your environment)
SET search_path TO hubspot_sync;

-- Add the missing token_refunded column
ALTER TABLE hubspot_bookings
ADD COLUMN IF NOT EXISTS token_refunded TEXT DEFAULT NULL;

-- Add token_refunded_at if not exists (should exist from previous migration)
ALTER TABLE hubspot_bookings
ADD COLUMN IF NOT EXISTS token_refunded_at TIMESTAMPTZ DEFAULT NULL;

-- Add token_refund_admin if not exists (should exist from previous migration)
ALTER TABLE hubspot_bookings
ADD COLUMN IF NOT EXISTS token_refund_admin TEXT DEFAULT NULL;

-- Verify the columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'hubspot_sync'
  AND table_name = 'hubspot_bookings'
  AND column_name LIKE 'token%'
ORDER BY column_name;

-- Expected output:
-- column_name          | data_type                   | is_nullable
-- token_refund_admin   | text                        | YES
-- token_refunded       | text                        | YES
-- token_refunded_at    | timestamp with time zone    | YES
-- token_used           | text                        | YES
