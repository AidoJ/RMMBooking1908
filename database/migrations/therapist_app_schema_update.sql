-- ============================================================================
-- THERAPIST APP SCHEMA UPDATE
-- Date: 2025-10-16
-- Description: Add therapist_payments table and service_area_polygon column
-- ============================================================================

-- 1. CREATE THERAPIST_PAYMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.therapist_payments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  therapist_id uuid NOT NULL REFERENCES public.therapist_profiles(id) ON DELETE CASCADE,

  -- Week information (Monday to Sunday)
  week_start_date date NOT NULL,
  week_end_date date NOT NULL,

  -- System calculated data (auto-filled, read-only for therapist)
  calculated_fees numeric(10,2) NOT NULL DEFAULT 0,
  booking_count integer DEFAULT 0,
  booking_ids text,

  -- Therapist submitted data
  therapist_invoice_number character varying(100),
  therapist_invoice_date date,
  therapist_invoice_url text,
  therapist_invoiced_fees numeric(10,2),
  therapist_parking_amount numeric(10,2) DEFAULT 0,
  parking_receipt_url text,
  therapist_total_claimed numeric(10,2),
  therapist_notes text,
  submitted_at timestamp with time zone,

  -- Variance tracking
  variance_fees numeric(10,2) DEFAULT 0,
  variance_notes text,

  -- Admin review and approval
  admin_approved_fees numeric(10,2),
  admin_approved_parking numeric(10,2),
  admin_total_approved numeric(10,2),
  admin_notes text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamp with time zone,

  -- Payment processing
  paid_amount numeric(10,2),
  paid_date date,
  eft_reference character varying(100),
  payment_notes text,
  processed_by uuid REFERENCES auth.users(id),
  processed_at timestamp with time zone,

  -- Status
  status character varying(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'under_review', 'approved', 'paid', 'disputed', 'rejected')),

  -- Audit
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),

  CONSTRAINT unique_therapist_week UNIQUE (therapist_id, week_start_date, week_end_date)
);

-- Indexes (using IF NOT EXISTS equivalent - drop first if exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_therapist_payments_therapist_id') THEN
    CREATE INDEX idx_therapist_payments_therapist_id ON public.therapist_payments(therapist_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_therapist_payments_week_start') THEN
    CREATE INDEX idx_therapist_payments_week_start ON public.therapist_payments(week_start_date DESC);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_therapist_payments_week_end') THEN
    CREATE INDEX idx_therapist_payments_week_end ON public.therapist_payments(week_end_date DESC);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_therapist_payments_status') THEN
    CREATE INDEX idx_therapist_payments_status ON public.therapist_payments(status);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_therapist_payments_paid_date') THEN
    CREATE INDEX idx_therapist_payments_paid_date ON public.therapist_payments(paid_date DESC);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_therapist_payments_submitted_at') THEN
    CREATE INDEX idx_therapist_payments_submitted_at ON public.therapist_payments(submitted_at DESC);
  END IF;
END $$;

-- RLS
ALTER TABLE public.therapist_payments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "therapist_payments_select_own" ON public.therapist_payments;
DROP POLICY IF EXISTS "therapist_payments_insert_own" ON public.therapist_payments;
DROP POLICY IF EXISTS "therapist_payments_update_own_draft" ON public.therapist_payments;
DROP POLICY IF EXISTS "therapist_payments_admin_all" ON public.therapist_payments;

CREATE POLICY "therapist_payments_select_own" ON public.therapist_payments FOR SELECT
USING (EXISTS (SELECT 1 FROM public.therapist_profiles tp WHERE tp.id = therapist_payments.therapist_id AND tp.user_id = auth.uid()));

CREATE POLICY "therapist_payments_insert_own" ON public.therapist_payments FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.therapist_profiles tp WHERE tp.id = therapist_payments.therapist_id AND tp.user_id = auth.uid()));

CREATE POLICY "therapist_payments_update_own_draft" ON public.therapist_payments FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.therapist_profiles tp WHERE tp.id = therapist_payments.therapist_id AND tp.user_id = auth.uid()) AND status IN ('draft', 'submitted'))
WITH CHECK (EXISTS (SELECT 1 FROM public.therapist_profiles tp WHERE tp.id = therapist_payments.therapist_id AND tp.user_id = auth.uid()) AND status IN ('draft', 'submitted'));

CREATE POLICY "therapist_payments_admin_all" ON public.therapist_payments FOR ALL
USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Triggers
DROP TRIGGER IF EXISTS therapist_payments_updated_at ON public.therapist_payments;
CREATE OR REPLACE FUNCTION update_therapist_payments_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER therapist_payments_updated_at BEFORE UPDATE ON public.therapist_payments
FOR EACH ROW EXECUTE FUNCTION update_therapist_payments_updated_at();

DROP TRIGGER IF EXISTS therapist_payments_calculate_claimed_total ON public.therapist_payments;
CREATE OR REPLACE FUNCTION calculate_therapist_total_claimed() RETURNS TRIGGER AS $$
BEGIN NEW.therapist_total_claimed = COALESCE(NEW.therapist_invoiced_fees, 0) + COALESCE(NEW.therapist_parking_amount, 0); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER therapist_payments_calculate_claimed_total BEFORE INSERT OR UPDATE ON public.therapist_payments
FOR EACH ROW EXECUTE FUNCTION calculate_therapist_total_claimed();

DROP TRIGGER IF EXISTS therapist_payments_calculate_variance ON public.therapist_payments;
CREATE OR REPLACE FUNCTION calculate_variance_fees() RETURNS TRIGGER AS $$
BEGIN NEW.variance_fees = COALESCE(NEW.therapist_invoiced_fees, 0) - COALESCE(NEW.calculated_fees, 0); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER therapist_payments_calculate_variance BEFORE INSERT OR UPDATE ON public.therapist_payments
FOR EACH ROW EXECUTE FUNCTION calculate_variance_fees();

DROP TRIGGER IF EXISTS therapist_payments_calculate_approved_total ON public.therapist_payments;
CREATE OR REPLACE FUNCTION calculate_admin_total_approved() RETURNS TRIGGER AS $$
BEGIN IF NEW.admin_approved_fees IS NOT NULL OR NEW.admin_approved_parking IS NOT NULL THEN
  NEW.admin_total_approved = COALESCE(NEW.admin_approved_fees, 0) + COALESCE(NEW.admin_approved_parking, 0); END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER therapist_payments_calculate_approved_total BEFORE INSERT OR UPDATE ON public.therapist_payments
FOR EACH ROW EXECUTE FUNCTION calculate_admin_total_approved();

-- 2. ADD SERVICE_AREA_POLYGON COLUMN
-- ============================================================================

ALTER TABLE public.therapist_profiles
ADD COLUMN IF NOT EXISTS service_area_polygon jsonb;

CREATE INDEX IF NOT EXISTS idx_therapist_profiles_service_area_polygon
ON public.therapist_profiles USING gin(service_area_polygon);

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
