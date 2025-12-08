-- ============================================================================
-- CREATE THERAPIST SERVICE RATES TABLE
-- Date: 2025-12-08
-- Description: Per-service rate structure for therapists supporting multiple
--              therapy types with different pay rates
-- ============================================================================

-- 1. CREATE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.therapist_service_rates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Foreign Keys
  therapist_id uuid NOT NULL REFERENCES public.therapist_profiles(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,

  -- Rates
  normal_rate DECIMAL(10,2) NOT NULL CHECK (normal_rate >= 0),
  afterhours_rate DECIMAL(10,2) NOT NULL CHECK (afterhours_rate >= 0),

  -- Status and metadata
  is_active BOOLEAN DEFAULT true,
  notes TEXT,

  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by uuid,
  updated_by uuid,

  -- Ensure one rate record per therapist-service combination
  CONSTRAINT unique_therapist_service UNIQUE(therapist_id, service_id)
);

-- 2. CREATE INDEXES
-- ============================================================================

-- Primary lookup index for fee calculation (therapist + service)
CREATE INDEX IF NOT EXISTS idx_therapist_service_rates_lookup
  ON public.therapist_service_rates(therapist_id, service_id)
  WHERE is_active = true;

-- Index for finding all services a therapist has rates for
CREATE INDEX IF NOT EXISTS idx_therapist_service_rates_therapist
  ON public.therapist_service_rates(therapist_id)
  WHERE is_active = true;

-- Index for finding all therapists who have rates for a specific service
CREATE INDEX IF NOT EXISTS idx_therapist_service_rates_service
  ON public.therapist_service_rates(service_id)
  WHERE is_active = true;

-- 3. CREATE TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_therapist_service_rates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS therapist_service_rates_updated_at ON public.therapist_service_rates;

CREATE TRIGGER therapist_service_rates_updated_at
  BEFORE UPDATE ON public.therapist_service_rates
  FOR EACH ROW
  EXECUTE FUNCTION update_therapist_service_rates_updated_at();

-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.therapist_service_rates ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "therapist_service_rates_select_all" ON public.therapist_service_rates;
DROP POLICY IF EXISTS "therapist_service_rates_insert_admin" ON public.therapist_service_rates;
DROP POLICY IF EXISTS "therapist_service_rates_update_admin" ON public.therapist_service_rates;
DROP POLICY IF EXISTS "therapist_service_rates_delete_admin" ON public.therapist_service_rates;

-- Allow all authenticated users to SELECT (needed for fee calculation)
CREATE POLICY "therapist_service_rates_select_all"
  ON public.therapist_service_rates
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can INSERT
CREATE POLICY "therapist_service_rates_insert_admin"
  ON public.therapist_service_rates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.role IN ('super_admin', 'admin')
    )
  );

-- Only admins can UPDATE
CREATE POLICY "therapist_service_rates_update_admin"
  ON public.therapist_service_rates
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.role IN ('super_admin', 'admin')
    )
  );

-- Only admins can DELETE
CREATE POLICY "therapist_service_rates_delete_admin"
  ON public.therapist_service_rates
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.role IN ('super_admin', 'admin')
    )
  );

-- 5. COMMENTS
-- ============================================================================

COMMENT ON TABLE public.therapist_service_rates IS
  'Per-service hourly rates for therapists. Allows therapists who offer multiple therapy types to have different rates per service. Falls back to therapist_profiles.hourly_rate/afterhours_rate if no service-specific rate exists.';

COMMENT ON COLUMN public.therapist_service_rates.therapist_id IS
  'Reference to the therapist';

COMMENT ON COLUMN public.therapist_service_rates.service_id IS
  'Reference to the service';

COMMENT ON COLUMN public.therapist_service_rates.normal_rate IS
  'Hourly rate for this therapist-service combination during normal business hours';

COMMENT ON COLUMN public.therapist_service_rates.afterhours_rate IS
  'Hourly rate for this therapist-service combination during after hours/weekends';

COMMENT ON COLUMN public.therapist_service_rates.is_active IS
  'Whether this rate is currently active. Inactive rates are ignored in fee calculations.';

COMMENT ON COLUMN public.therapist_service_rates.notes IS
  'Admin notes about this rate (e.g., reason for special pricing, certification requirements)';

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================

-- Run this to verify the table was created correctly:
/*
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'therapist_service_rates'
ORDER BY ordinal_position;
*/

-- ============================================================================
-- EXAMPLE DATA (OPTIONAL - FOR TESTING)
-- ============================================================================

-- Uncomment to insert sample data for testing:
/*
INSERT INTO public.therapist_service_rates
  (therapist_id, service_id, normal_rate, afterhours_rate, notes)
VALUES
  (
    (SELECT id FROM therapist_profiles LIMIT 1),
    (SELECT id FROM services WHERE name ILIKE '%massage%' LIMIT 1),
    95.00,
    110.00,
    'Sample rate for testing'
  );
*/

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
