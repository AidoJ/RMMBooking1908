-- =====================================================
-- CLIENT INTAKE FORMS - ADD YES/NO FIELDS
-- =====================================================
-- This migration adds has_* boolean fields for medications,
-- allergies, recent injuries, and other conditions
-- =====================================================

-- Add has_medications field
ALTER TABLE client_intake_forms
ADD COLUMN IF NOT EXISTS has_medications BOOLEAN DEFAULT false;

-- Add has_allergies field
ALTER TABLE client_intake_forms
ADD COLUMN IF NOT EXISTS has_allergies BOOLEAN DEFAULT false;

-- Add has_recent_injuries field
ALTER TABLE client_intake_forms
ADD COLUMN IF NOT EXISTS has_recent_injuries BOOLEAN DEFAULT false;

-- Add has_other_conditions field
ALTER TABLE client_intake_forms
ADD COLUMN IF NOT EXISTS has_other_conditions BOOLEAN DEFAULT false;

-- Update existing data: Set has_* to true where text fields are not empty/null
UPDATE client_intake_forms
SET has_medications = (medications IS NOT NULL AND medications != '')
WHERE medications IS NOT NULL;

UPDATE client_intake_forms
SET has_allergies = (allergies IS NOT NULL AND allergies != '')
WHERE allergies IS NOT NULL;

UPDATE client_intake_forms
SET has_recent_injuries = (recent_injuries IS NOT NULL AND recent_injuries != '')
WHERE recent_injuries IS NOT NULL;

UPDATE client_intake_forms
SET has_other_conditions = (other_conditions IS NOT NULL AND other_conditions != '')
WHERE other_conditions IS NOT NULL;

-- Verify the columns were added
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_intake_forms'
    AND column_name = 'has_medications'
  ) THEN
    RAISE NOTICE 'SUCCESS: has_medications column added successfully';
  ELSE
    RAISE EXCEPTION 'ERROR: has_medications column was not added';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_intake_forms'
    AND column_name = 'has_allergies'
  ) THEN
    RAISE NOTICE 'SUCCESS: has_allergies column added successfully';
  ELSE
    RAISE EXCEPTION 'ERROR: has_allergies column was not added';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_intake_forms'
    AND column_name = 'has_recent_injuries'
  ) THEN
    RAISE NOTICE 'SUCCESS: has_recent_injuries column added successfully';
  ELSE
    RAISE EXCEPTION 'ERROR: has_recent_injuries column was not added';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_intake_forms'
    AND column_name = 'has_other_conditions'
  ) THEN
    RAISE NOTICE 'SUCCESS: has_other_conditions column added successfully';
  ELSE
    RAISE EXCEPTION 'ERROR: has_other_conditions column was not added';
  END IF;
END $$;

-- =====================================================
-- ROLLBACK COMMANDS (For reference - DO NOT RUN)
-- =====================================================

-- To rollback this migration, run the following:
/*
ALTER TABLE client_intake_forms DROP COLUMN IF EXISTS has_medications;
ALTER TABLE client_intake_forms DROP COLUMN IF EXISTS has_allergies;
ALTER TABLE client_intake_forms DROP COLUMN IF EXISTS has_recent_injuries;
ALTER TABLE client_intake_forms DROP COLUMN IF EXISTS has_other_conditions;
*/
