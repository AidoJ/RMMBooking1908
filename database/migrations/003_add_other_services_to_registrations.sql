-- ============================================================================
-- ADD OTHER SERVICES FIELD TO THERAPIST REGISTRATIONS
-- ============================================================================

-- Add column for other/additional services not in the main services list
ALTER TABLE public.therapist_registrations
ADD COLUMN IF NOT EXISTS other_services text;

-- Add comment for documentation
COMMENT ON COLUMN public.therapist_registrations.other_services IS
  'Additional services the therapist offers that are not in the main services list';

-- Verification query
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'therapist_registrations'
  AND column_name = 'other_services';
