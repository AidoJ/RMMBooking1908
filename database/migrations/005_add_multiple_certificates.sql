-- Migration: Add support for multiple qualification certificates
-- Date: 2026-02-10
-- Matches the structure used in therapist_registrations table

-- Add jsonb column for multiple qualification certificates (same structure as registrations)
ALTER TABLE public.therapist_profiles
ADD COLUMN IF NOT EXISTS qualification_certificates jsonb DEFAULT '[]'::jsonb;

-- Migrate existing single certificate URL to the new array column
-- Format: [{url: "...", filename: "..."}]
UPDATE public.therapist_profiles
SET qualification_certificates = jsonb_build_array(
  jsonb_build_object(
    'url', qualification_certificate_url,
    'filename', 'qualification_certificate.pdf'
  )
)
WHERE qualification_certificate_url IS NOT NULL
  AND qualification_certificate_url != ''
  AND (qualification_certificates IS NULL OR qualification_certificates = '[]'::jsonb);

-- Add comment
COMMENT ON COLUMN public.therapist_profiles.qualification_certificates IS 'Array of qualification certificates [{url, filename}] - matches therapist_registrations structure';
