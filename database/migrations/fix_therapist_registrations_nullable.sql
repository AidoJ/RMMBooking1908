-- =====================================================
-- FIX THERAPIST REGISTRATIONS: MAKE FIELDS NULLABLE FOR DRAFTS
-- =====================================================
-- Purpose: Allow partial draft saving by making fields nullable
-- Fields are validated only when status changes to 'submitted'
-- =====================================================

-- Step 1: Personal Information - Make nullable for drafts
ALTER TABLE public.therapist_registrations
  ALTER COLUMN first_name DROP NOT NULL,
  ALTER COLUMN last_name DROP NOT NULL,
  ALTER COLUMN date_of_birth DROP NOT NULL,
  ALTER COLUMN email DROP NOT NULL,
  ALTER COLUMN phone DROP NOT NULL,
  ALTER COLUMN street_address DROP NOT NULL,
  ALTER COLUMN suburb DROP NOT NULL,
  ALTER COLUMN city DROP NOT NULL,
  ALTER COLUMN state DROP NOT NULL,
  ALTER COLUMN postcode DROP NOT NULL;

-- Step 2: Business Details - Make nullable for drafts
ALTER TABLE public.therapist_registrations
  ALTER COLUMN business_structure DROP NOT NULL,
  ALTER COLUMN business_abn DROP NOT NULL,
  ALTER COLUMN bank_account_name DROP NOT NULL,
  ALTER COLUMN bsb DROP NOT NULL,
  ALTER COLUMN bank_account_number DROP NOT NULL;

-- Note: JSONB fields (service_cities, delivery_locations, etc.) already have DEFAULT '[]'::jsonb
-- Note: Boolean fields already have DEFAULT false
-- Date fields (start_date, insurance_expiry_date, etc.) are already nullable

COMMENT ON TABLE public.therapist_registrations IS
  'Stores therapist registration applications. All fields nullable for draft status. Validation enforced when status = submitted.';
