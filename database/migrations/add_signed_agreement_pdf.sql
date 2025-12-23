-- =====================================================
-- ADD SIGNED AGREEMENT PDF URL TO THERAPIST REGISTRATIONS
-- =====================================================
-- Purpose: Store the URL of the generated signed agreement PDF
-- This is the legally binding document with all applicant data + signature
-- =====================================================

ALTER TABLE public.therapist_registrations
ADD COLUMN IF NOT EXISTS signed_agreement_pdf_url text;

COMMENT ON COLUMN public.therapist_registrations.signed_agreement_pdf_url IS
  'URL to the complete signed agreement PDF with all applicant data and digital signature';
