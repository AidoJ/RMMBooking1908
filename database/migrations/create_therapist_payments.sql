-- Create therapist_payments table for weekly invoice submissions and payment tracking
-- Workflow: Therapist submits invoice -> Admin reviews -> Admin processes payment

CREATE TABLE IF NOT EXISTS public.therapist_payments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  therapist_id uuid NOT NULL REFERENCES public.therapist_profiles(id) ON DELETE CASCADE,

  -- Week information (Monday to Sunday)
  week_start_date date NOT NULL, -- Monday
  week_end_date date NOT NULL,   -- Sunday (following Wednesday is payment day)

  -- System calculated data (auto-filled, read-only for therapist)
  calculated_fees numeric(10,2) NOT NULL DEFAULT 0, -- SUM(therapist_fee) from completed bookings for the week
  booking_count integer DEFAULT 0, -- Number of completed bookings included
  booking_ids text, -- Comma-separated list of booking_ids for reference (e.g., "RB2510001,RB2510002,RB2510003")

  -- Therapist submitted data
  therapist_invoice_number character varying(100), -- Therapist's own invoice number
  therapist_invoice_date date,
  therapist_invoice_url text, -- Upload: Complete invoice PDF/image
  therapist_invoiced_fees numeric(10,2), -- Amount therapist is claiming for fees (may differ from calculated)
  therapist_parking_amount numeric(10,2) DEFAULT 0, -- Parking reimbursement claimed
  parking_receipt_url text, -- Upload: Parking receipt image
  therapist_total_claimed numeric(10,2), -- invoiced_fees + parking_amount
  therapist_notes text, -- Optional notes from therapist
  submitted_at timestamp with time zone, -- When therapist submitted the invoice

  -- Variance tracking
  variance_fees numeric(10,2) DEFAULT 0, -- therapist_invoiced_fees - calculated_fees (can be positive or negative)
  variance_notes text, -- Explanation for variance (filled by therapist or admin)

  -- Admin review and approval
  admin_approved_fees numeric(10,2), -- Admin confirms/adjusts fee amount
  admin_approved_parking numeric(10,2), -- Admin confirms/adjusts parking amount
  admin_total_approved numeric(10,2), -- fees + parking approved by admin
  admin_notes text, -- Admin comments/notes
  reviewed_by uuid REFERENCES auth.users(id), -- Which admin reviewed
  reviewed_at timestamp with time zone,

  -- Payment processing (filled by admin after approval)
  paid_amount numeric(10,2), -- Actual amount paid (usually = admin_total_approved)
  paid_date date,
  eft_reference character varying(100),
  payment_notes text,
  processed_by uuid REFERENCES auth.users(id), -- Which admin processed payment
  processed_at timestamp with time zone,

  -- Status tracking
  status character varying(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'under_review', 'approved', 'paid', 'disputed', 'rejected')),

  -- Audit fields
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),

  -- Ensure one invoice per therapist per week
  CONSTRAINT unique_therapist_week UNIQUE (therapist_id, week_start_date, week_end_date)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_therapist_payments_therapist_id ON public.therapist_payments(therapist_id);
CREATE INDEX IF NOT EXISTS idx_therapist_payments_week_start ON public.therapist_payments(week_start_date DESC);
CREATE INDEX IF NOT EXISTS idx_therapist_payments_week_end ON public.therapist_payments(week_end_date DESC);
CREATE INDEX IF NOT EXISTS idx_therapist_payments_status ON public.therapist_payments(status);
CREATE INDEX IF NOT EXISTS idx_therapist_payments_paid_date ON public.therapist_payments(paid_date DESC);
CREATE INDEX IF NOT EXISTS idx_therapist_payments_submitted_at ON public.therapist_payments(submitted_at DESC);

-- Enable RLS
ALTER TABLE public.therapist_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Therapists can view only their own payment records
CREATE POLICY "therapist_payments_select_own"
ON public.therapist_payments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.therapist_profiles tp
    WHERE tp.id = therapist_payments.therapist_id
    AND tp.user_id = auth.uid()
  )
);

-- Therapists can insert their own invoice submissions
CREATE POLICY "therapist_payments_insert_own"
ON public.therapist_payments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.therapist_profiles tp
    WHERE tp.id = therapist_payments.therapist_id
    AND tp.user_id = auth.uid()
  )
);

-- Therapists can update their own draft/submitted invoices (before admin review)
CREATE POLICY "therapist_payments_update_own_draft"
ON public.therapist_payments
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.therapist_profiles tp
    WHERE tp.id = therapist_payments.therapist_id
    AND tp.user_id = auth.uid()
  )
  AND status IN ('draft', 'submitted')
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.therapist_profiles tp
    WHERE tp.id = therapist_payments.therapist_id
    AND tp.user_id = auth.uid()
  )
  AND status IN ('draft', 'submitted')
);

-- Admins have full access
CREATE POLICY "therapist_payments_admin_all"
ON public.therapist_payments
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_therapist_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER therapist_payments_updated_at
BEFORE UPDATE ON public.therapist_payments
FOR EACH ROW
EXECUTE FUNCTION update_therapist_payments_updated_at();

-- Function to auto-calculate therapist_total_claimed
CREATE OR REPLACE FUNCTION calculate_therapist_total_claimed()
RETURNS TRIGGER AS $$
BEGIN
  NEW.therapist_total_claimed = COALESCE(NEW.therapist_invoiced_fees, 0) + COALESCE(NEW.therapist_parking_amount, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate therapist_total_claimed on insert/update
CREATE TRIGGER therapist_payments_calculate_claimed_total
BEFORE INSERT OR UPDATE ON public.therapist_payments
FOR EACH ROW
EXECUTE FUNCTION calculate_therapist_total_claimed();

-- Function to auto-calculate variance_fees
CREATE OR REPLACE FUNCTION calculate_variance_fees()
RETURNS TRIGGER AS $$
BEGIN
  NEW.variance_fees = COALESCE(NEW.therapist_invoiced_fees, 0) - COALESCE(NEW.calculated_fees, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate variance_fees on insert/update
CREATE TRIGGER therapist_payments_calculate_variance
BEFORE INSERT OR UPDATE ON public.therapist_payments
FOR EACH ROW
EXECUTE FUNCTION calculate_variance_fees();

-- Function to auto-calculate admin_total_approved
CREATE OR REPLACE FUNCTION calculate_admin_total_approved()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.admin_approved_fees IS NOT NULL OR NEW.admin_approved_parking IS NOT NULL THEN
    NEW.admin_total_approved = COALESCE(NEW.admin_approved_fees, 0) + COALESCE(NEW.admin_approved_parking, 0);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate admin_total_approved on insert/update
CREATE TRIGGER therapist_payments_calculate_approved_total
BEFORE INSERT OR UPDATE ON public.therapist_payments
FOR EACH ROW
EXECUTE FUNCTION calculate_admin_total_approved();

-- Add helpful comments
COMMENT ON TABLE public.therapist_payments IS 'Weekly invoice submissions and payment tracking for therapists';
COMMENT ON COLUMN public.therapist_payments.week_start_date IS 'Monday of the week being invoiced';
COMMENT ON COLUMN public.therapist_payments.week_end_date IS 'Sunday of the week being invoiced (payment processed following Wednesday)';
COMMENT ON COLUMN public.therapist_payments.calculated_fees IS 'Auto-calculated: SUM(therapist_fee) from completed bookings for the week';
COMMENT ON COLUMN public.therapist_payments.booking_ids IS 'Comma-separated list of booking_ids included in this invoice';
COMMENT ON COLUMN public.therapist_payments.therapist_invoiced_fees IS 'Amount therapist is claiming for fees (may differ from calculated_fees due to time adjustments)';
COMMENT ON COLUMN public.therapist_payments.variance_fees IS 'Auto-calculated: therapist_invoiced_fees - calculated_fees (positive = therapist claiming more, negative = less)';
COMMENT ON COLUMN public.therapist_payments.status IS 'draft: therapist working on it, submitted: therapist submitted, under_review: admin reviewing, approved: admin approved, paid: payment processed, disputed: variance needs resolution, rejected: admin rejected';
COMMENT ON COLUMN public.therapist_payments.paid_amount IS 'Actual amount paid (if different from admin_total_approved, explain in payment_notes)';

-- Prevent submission before week end
COMMENT ON COLUMN public.therapist_payments.week_end_date IS 'System prevents submission if current date <= week_end_date (must wait until week is complete)';
