-- =====================================================
-- THERAPIST PROFILES - ADD CERTIFICATES AND BANKING FIELDS
-- =====================================================
-- This migration adds insurance, first aid, qualification
-- certificates, banking details, and hourly rates
-- =====================================================

-- Add insurance certificate fields
ALTER TABLE therapist_profiles
ADD COLUMN IF NOT EXISTS insurance_expiry_date DATE;

ALTER TABLE therapist_profiles
ADD COLUMN IF NOT EXISTS insurance_certificate_url TEXT;

-- Add first aid certificate fields
ALTER TABLE therapist_profiles
ADD COLUMN IF NOT EXISTS first_aid_expiry_date DATE;

ALTER TABLE therapist_profiles
ADD COLUMN IF NOT EXISTS first_aid_certificate_url TEXT;

-- Add qualification certificate
ALTER TABLE therapist_profiles
ADD COLUMN IF NOT EXISTS qualification_certificate_url TEXT;

-- Add banking details (ABN already exists)
ALTER TABLE therapist_profiles
ADD COLUMN IF NOT EXISTS bank_account_name TEXT;

ALTER TABLE therapist_profiles
ADD COLUMN IF NOT EXISTS bsb TEXT;

ALTER TABLE therapist_profiles
ADD COLUMN IF NOT EXISTS bank_account_number TEXT;

-- Add hourly rates (will be populated with defaults from system_settings)
ALTER TABLE therapist_profiles
ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(10,2);

ALTER TABLE therapist_profiles
ADD COLUMN IF NOT EXISTS afterhours_rate DECIMAL(10,2);

-- Verify the columns were added
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'therapist_profiles'
    AND column_name = 'insurance_expiry_date'
  ) THEN
    RAISE NOTICE 'SUCCESS: insurance_expiry_date column added successfully';
  ELSE
    RAISE EXCEPTION 'ERROR: insurance_expiry_date column was not added';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'therapist_profiles'
    AND column_name = 'hourly_rate'
  ) THEN
    RAISE NOTICE 'SUCCESS: hourly_rate column added successfully';
  ELSE
    RAISE EXCEPTION 'ERROR: hourly_rate column was not added';
  END IF;
END $$;

-- =====================================================
-- ROLLBACK COMMANDS (For reference - DO NOT RUN)
-- =====================================================

-- To rollback this migration, run the following:
/*
ALTER TABLE therapist_profiles DROP COLUMN IF EXISTS insurance_expiry_date;
ALTER TABLE therapist_profiles DROP COLUMN IF EXISTS insurance_certificate_url;
ALTER TABLE therapist_profiles DROP COLUMN IF EXISTS first_aid_expiry_date;
ALTER TABLE therapist_profiles DROP COLUMN IF EXISTS first_aid_certificate_url;
ALTER TABLE therapist_profiles DROP COLUMN IF EXISTS qualification_certificate_url;
ALTER TABLE therapist_profiles DROP COLUMN IF EXISTS bank_account_name;
ALTER TABLE therapist_profiles DROP COLUMN IF EXISTS bsb;
ALTER TABLE therapist_profiles DROP COLUMN IF EXISTS bank_account_number;
ALTER TABLE therapist_profiles DROP COLUMN IF EXISTS hourly_rate;
ALTER TABLE therapist_profiles DROP COLUMN IF EXISTS afterhours_rate;
*/
