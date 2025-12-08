-- Fix foreign key constraint on therapist_service_rates
-- Run this to fix the created_by/updated_by foreign key issue

-- Drop the foreign key constraints
ALTER TABLE public.therapist_service_rates
  DROP CONSTRAINT IF EXISTS therapist_service_rates_created_by_fkey;

ALTER TABLE public.therapist_service_rates
  DROP CONSTRAINT IF EXISTS therapist_service_rates_updated_by_fkey;

-- Make the columns nullable (if they aren't already)
ALTER TABLE public.therapist_service_rates
  ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE public.therapist_service_rates
  ALTER COLUMN updated_by DROP NOT NULL;

-- Verify the changes
SELECT
  column_name,
  is_nullable,
  data_type
FROM information_schema.columns
WHERE table_name = 'therapist_service_rates'
  AND column_name IN ('created_by', 'updated_by');
