-- new-therapist-payment-schema.sql
-- Minimal, idempotent changes required for therapist payments and job completion

-- 1) Bookings: capture tips and completion timestamp
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS tip_amount numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completion_timestamp timestamptz;

-- 2) Therapist profiles: optional polygon service area (radius remains primary)
ALTER TABLE public.therapist_profiles
  ADD COLUMN IF NOT EXISTS service_area_type varchar(20) DEFAULT 'radius' CHECK (service_area_type IN ('radius','polygon')),
  ADD COLUMN IF NOT EXISTS service_area_polygon jsonb;

-- 3) Reuse therapist_payments: extend to track therapist-submitted invoices
ALTER TABLE public.therapist_payments
  ADD COLUMN IF NOT EXISTS invoice_number varchar(50),
  ADD COLUMN IF NOT EXISTS invoice_pdf_url text,
  ADD COLUMN IF NOT EXISTS parking_amount numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS parking_receipt_url text,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.admin_users(id),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_reference varchar(100),
  ADD COLUMN IF NOT EXISTS payment_date date,
  ADD COLUMN IF NOT EXISTS admin_notes text;

-- 4) Uniqueness: one payment record per therapist per week
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'uniq_therapist_week'
  ) THEN
    CREATE UNIQUE INDEX uniq_therapist_week
      ON public.therapist_payments (therapist_id, week_start_date, week_end_date);
  END IF;
END $$;

