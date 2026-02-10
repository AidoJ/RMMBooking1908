-- Migration: Add support for multiple certificates
-- Date: 2026-02-10

-- Add jsonb columns for multiple first aid and qualification certificates
ALTER TABLE public.therapist_profiles
ADD COLUMN IF NOT EXISTS first_aid_certificates jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS qualification_certificates jsonb DEFAULT '[]'::jsonb;

-- Migrate existing single certificate URLs to the new array columns
UPDATE public.therapist_profiles
SET first_aid_certificates = jsonb_build_array(first_aid_certificate_url)
WHERE first_aid_certificate_url IS NOT NULL
  AND first_aid_certificate_url != ''
  AND (first_aid_certificates IS NULL OR first_aid_certificates = '[]'::jsonb);

UPDATE public.therapist_profiles
SET qualification_certificates = jsonb_build_array(qualification_certificate_url)
WHERE qualification_certificate_url IS NOT NULL
  AND qualification_certificate_url != ''
  AND (qualification_certificates IS NULL OR qualification_certificates = '[]'::jsonb);

-- Add comments
COMMENT ON COLUMN public.therapist_profiles.first_aid_certificates IS 'Array of first aid certificate URLs';
COMMENT ON COLUMN public.therapist_profiles.qualification_certificates IS 'Array of qualification certificate URLs';
