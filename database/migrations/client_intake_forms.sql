-- =====================================================
-- CLIENT INTAKE FORMS - DATABASE SCHEMA
-- =====================================================
-- This migration creates the client_intake_forms table
-- and associated triggers, functions, and policies
-- =====================================================

-- =====================================================
-- 1. CREATE MAIN TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS client_intake_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,

  -- Completion tracking
  completed_at TIMESTAMPTZ,
  completed_by TEXT CHECK (completed_by IN ('client', 'therapist')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),

  -- Client info (for reference)
  client_name TEXT,
  client_email TEXT,

  -- Form responses
  medications TEXT,
  allergies TEXT,

  -- Pregnancy section
  is_pregnant BOOLEAN DEFAULT false,
  pregnancy_months INTEGER CHECK (pregnancy_months BETWEEN 1 AND 9),
  pregnancy_due_date DATE,

  -- Medical supervision section
  has_medical_supervision BOOLEAN DEFAULT false,
  medical_supervision_details TEXT,

  -- Medical conditions (stored as JSONB array for flexibility)
  -- Example: ["Autoimmune disorder", "Diabetes", "Heart condition"]
  medical_conditions JSONB DEFAULT '[]'::jsonb,

  -- Skin conditions section
  has_broken_skin BOOLEAN DEFAULT false,
  broken_skin_location TEXT,

  -- Joint replacement section
  has_joint_replacement BOOLEAN DEFAULT false,
  joint_replacement_details TEXT,

  -- Medical history
  recent_injuries TEXT,
  other_conditions TEXT,

  -- Signature (stored as base64 encoded image data)
  signature_data TEXT,
  signature_date TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one intake form per booking
  CONSTRAINT unique_booking_intake_form UNIQUE(booking_id)
);

-- =====================================================
-- 2. CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Index for quick lookups by booking
CREATE INDEX IF NOT EXISTS idx_intake_forms_booking
  ON client_intake_forms(booking_id);

-- Index for filtering by status
CREATE INDEX IF NOT EXISTS idx_intake_forms_status
  ON client_intake_forms(status);

-- Index for date-based queries
CREATE INDEX IF NOT EXISTS idx_intake_forms_completed
  ON client_intake_forms(completed_at);

-- Index for searching by client email
CREATE INDEX IF NOT EXISTS idx_intake_forms_email
  ON client_intake_forms(client_email);

-- =====================================================
-- 3. ADD INTAKE FORM STATUS TO BOOKINGS TABLE
-- =====================================================

-- Add column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings'
    AND column_name = 'intake_form_status'
  ) THEN
    ALTER TABLE bookings
    ADD COLUMN intake_form_status TEXT DEFAULT 'pending'
    CHECK (intake_form_status IN ('pending', 'completed'));
  END IF;
END $$;

-- Add index for bookings intake status
CREATE INDEX IF NOT EXISTS idx_bookings_intake_status
  ON bookings(intake_form_status);

-- =====================================================
-- 4. CREATE TRIGGER FUNCTION TO UPDATE TIMESTAMP
-- =====================================================

CREATE OR REPLACE FUNCTION update_intake_form_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists, then create
DROP TRIGGER IF EXISTS trigger_update_intake_forms_timestamp ON client_intake_forms;

CREATE TRIGGER trigger_update_intake_forms_timestamp
  BEFORE UPDATE ON client_intake_forms
  FOR EACH ROW
  EXECUTE FUNCTION update_intake_form_timestamp();

-- =====================================================
-- 5. CREATE TRIGGER TO UPDATE BOOKING STATUS
-- =====================================================

CREATE OR REPLACE FUNCTION update_booking_intake_status()
RETURNS TRIGGER AS $$
BEGIN
  -- When intake form is completed, update booking status
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    UPDATE bookings
    SET intake_form_status = 'completed'
    WHERE id = NEW.booking_id;
  END IF;

  -- When intake form is set back to pending
  IF NEW.status = 'pending' AND OLD.status = 'completed' THEN
    UPDATE bookings
    SET intake_form_status = 'pending'
    WHERE id = NEW.booking_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists, then create
DROP TRIGGER IF EXISTS trigger_update_booking_intake_status ON client_intake_forms;

CREATE TRIGGER trigger_update_booking_intake_status
  AFTER INSERT OR UPDATE ON client_intake_forms
  FOR EACH ROW
  EXECUTE FUNCTION update_booking_intake_status();

-- =====================================================
-- 6. CREATE NOTIFICATION FUNCTION FOR THERAPISTS
-- =====================================================

CREATE OR REPLACE FUNCTION notify_therapist_intake_complete()
RETURNS TRIGGER AS $$
DECLARE
  booking_record RECORD;
  therapist_record RECORD;
BEGIN
  -- Only proceed if form was just completed
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN

    -- Get booking details
    SELECT * INTO booking_record
    FROM bookings
    WHERE id = NEW.booking_id;

    -- Get therapist details
    SELECT * INTO therapist_record
    FROM therapist_profiles
    WHERE id = booking_record.therapist_id;

    -- Insert notification into notifications table (if it exists)
    -- This will be picked up by the therapist app
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
      INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        booking_id,
        read,
        created_at
      ) VALUES (
        booking_record.therapist_id,
        'intake_form_completed',
        'Client Intake Form Completed',
        NEW.client_name || ' has completed their health intake form for booking ' || NEW.booking_id::text || '. You can now review it before the appointment.',
        NEW.booking_id,
        false,
        NOW()
      );
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists, then create
DROP TRIGGER IF EXISTS trigger_notify_therapist_intake ON client_intake_forms;

CREATE TRIGGER trigger_notify_therapist_intake
  AFTER INSERT OR UPDATE ON client_intake_forms
  FOR EACH ROW
  EXECUTE FUNCTION notify_therapist_intake_complete();

-- =====================================================
-- 7. ENABLE ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE client_intake_forms ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 8. CREATE RLS POLICIES
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Enable read access for all users" ON client_intake_forms;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON client_intake_forms;
DROP POLICY IF EXISTS "Enable update for pending forms" ON client_intake_forms;
DROP POLICY IF EXISTS "Therapists can read their booking forms" ON client_intake_forms;
DROP POLICY IF EXISTS "Therapists can insert forms" ON client_intake_forms;
DROP POLICY IF EXISTS "Therapists can update forms" ON client_intake_forms;

-- Policy 1: Allow public read access (secured via unique booking URL)
-- In production, this should be combined with URL token validation
CREATE POLICY "Public read access for intake forms"
  ON client_intake_forms
  FOR SELECT
  USING (true);

-- Policy 2: Allow public insert (for client submissions)
CREATE POLICY "Public insert for intake forms"
  ON client_intake_forms
  FOR INSERT
  WITH CHECK (true);

-- Policy 3: Allow public update only for pending forms
CREATE POLICY "Public update for pending forms"
  ON client_intake_forms
  FOR UPDATE
  USING (status = 'pending')
  WITH CHECK (status = 'pending' OR status = 'completed');

-- Policy 4: Therapists can read forms for their bookings
CREATE POLICY "Therapists read their booking forms"
  ON client_intake_forms
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT therapist_id
      FROM bookings
      WHERE id = booking_id
    )
  );

-- Policy 5: Therapists can insert forms for their bookings
CREATE POLICY "Therapists insert forms for bookings"
  ON client_intake_forms
  FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT therapist_id
      FROM bookings
      WHERE id = booking_id
    )
  );

-- Policy 6: Therapists can update forms for their bookings
CREATE POLICY "Therapists update their booking forms"
  ON client_intake_forms
  FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT therapist_id
      FROM bookings
      WHERE id = booking_id
    )
  );

-- =====================================================
-- 9. HELPER FUNCTION TO GET INTAKE FORM STATUS
-- =====================================================

CREATE OR REPLACE FUNCTION get_intake_form_status(p_booking_id UUID)
RETURNS TEXT AS $$
DECLARE
  form_status TEXT;
BEGIN
  SELECT status INTO form_status
  FROM client_intake_forms
  WHERE booking_id = p_booking_id;

  -- Return 'pending' if no form exists yet
  RETURN COALESCE(form_status, 'pending');
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 10. HELPER FUNCTION TO CHECK IF FORM IS COMPLETED
-- =====================================================

CREATE OR REPLACE FUNCTION is_intake_form_completed(p_booking_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM client_intake_forms
    WHERE booking_id = p_booking_id
    AND status = 'completed'
  );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- Verify the table was created
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'client_intake_forms'
  ) THEN
    RAISE NOTICE 'SUCCESS: client_intake_forms table created successfully';
  ELSE
    RAISE EXCEPTION 'ERROR: client_intake_forms table was not created';
  END IF;
END $$;

-- =====================================================
-- ROLLBACK COMMANDS (For reference - DO NOT RUN)
-- =====================================================

-- To rollback this migration, run the following:
/*
DROP TRIGGER IF EXISTS trigger_update_intake_forms_timestamp ON client_intake_forms;
DROP TRIGGER IF EXISTS trigger_update_booking_intake_status ON client_intake_forms;
DROP TRIGGER IF EXISTS trigger_notify_therapist_intake ON client_intake_forms;
DROP FUNCTION IF EXISTS update_intake_form_timestamp();
DROP FUNCTION IF EXISTS update_booking_intake_status();
DROP FUNCTION IF EXISTS notify_therapist_intake_complete();
DROP FUNCTION IF EXISTS get_intake_form_status(UUID);
DROP FUNCTION IF EXISTS is_intake_form_completed(UUID);
DROP TABLE IF EXISTS client_intake_forms CASCADE;
ALTER TABLE bookings DROP COLUMN IF EXISTS intake_form_status;
*/
