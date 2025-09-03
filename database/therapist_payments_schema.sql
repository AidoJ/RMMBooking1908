-- Therapist Weekly Payment System Database Schema
-- This script creates the necessary tables and constraints for tracking therapist payments

-- =============================================================================
-- 1. CREATE THERAPIST_PAYMENTS TABLE
-- =============================================================================
-- This table stores weekly payment summaries for each therapist
CREATE TABLE IF NOT EXISTS therapist_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id UUID NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  
  -- Week period
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  
  -- Payment calculations
  total_assignments INTEGER DEFAULT 0,
  total_hours DECIMAL(5,2) DEFAULT 0,
  total_fee DECIMAL(10,2) DEFAULT 0,
  
  -- Payment status and details
  payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid')),
  paid_amount DECIMAL(10,2),
  payment_date DATE,
  invoice_number VARCHAR(50),
  payment_reference VARCHAR(100),
  notes TEXT,
  
  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  
  -- Constraints
  CONSTRAINT unique_therapist_week UNIQUE (therapist_id, week_start_date, week_end_date),
  CONSTRAINT valid_week_dates CHECK (week_end_date > week_start_date),
  CONSTRAINT valid_payment_amount CHECK (paid_amount IS NULL OR paid_amount >= 0),
  CONSTRAINT valid_totals CHECK (
    total_assignments >= 0 AND 
    total_hours >= 0 AND 
    total_fee >= 0
  )
);

-- =============================================================================
-- 2. ADD WEEKLY_PAYMENT_ID TO THERAPIST_ASSIGNMENTS
-- =============================================================================
-- Link therapist assignments to their weekly payment records
ALTER TABLE therapist_assignments 
ADD COLUMN IF NOT EXISTS weekly_payment_id UUID REFERENCES therapist_payments(id) ON DELETE SET NULL;

-- =============================================================================
-- 3. CREATE INDEXES FOR PERFORMANCE
-- =============================================================================
-- Index for therapist payment queries
CREATE INDEX IF NOT EXISTS idx_therapist_payments_therapist_id ON therapist_payments(therapist_id);
CREATE INDEX IF NOT EXISTS idx_therapist_payments_week_dates ON therapist_payments(week_start_date, week_end_date);
CREATE INDEX IF NOT EXISTS idx_therapist_payments_status ON therapist_payments(payment_status);
CREATE INDEX IF NOT EXISTS idx_therapist_payments_created_at ON therapist_payments(created_at);

-- Index for therapist assignments weekly payment link
CREATE INDEX IF NOT EXISTS idx_therapist_assignments_weekly_payment ON therapist_assignments(weekly_payment_id);

-- Compound index for assignment queries
CREATE INDEX IF NOT EXISTS idx_therapist_assignments_therapist_status ON therapist_assignments(therapist_id, status);

-- =============================================================================
-- 4. CREATE UPDATE TRIGGER FOR UPDATED_AT
-- =============================================================================
-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_therapist_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at field
DROP TRIGGER IF EXISTS trigger_therapist_payments_updated_at ON therapist_payments;
CREATE TRIGGER trigger_therapist_payments_updated_at
  BEFORE UPDATE ON therapist_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_therapist_payments_updated_at();

-- =============================================================================
-- 5. ADD COMMENTS FOR DOCUMENTATION
-- =============================================================================
COMMENT ON TABLE therapist_payments IS 'Weekly payment summaries for therapists - tracks earnings, payment status, and payment details';
COMMENT ON COLUMN therapist_payments.week_start_date IS 'Start date of the payment week (usually Monday)';
COMMENT ON COLUMN therapist_payments.week_end_date IS 'End date of the payment week (usually Sunday)';
COMMENT ON COLUMN therapist_payments.total_assignments IS 'Number of completed assignments in this week';
COMMENT ON COLUMN therapist_payments.total_hours IS 'Total hours worked in this week';
COMMENT ON COLUMN therapist_payments.total_fee IS 'Total fees earned in this week';
COMMENT ON COLUMN therapist_payments.payment_status IS 'Payment status: pending (not yet paid) or paid (payment processed)';
COMMENT ON COLUMN therapist_payments.paid_amount IS 'Actual amount paid (may differ from total_fee due to adjustments)';
COMMENT ON COLUMN therapist_payments.payment_date IS 'Date when payment was processed';
COMMENT ON COLUMN therapist_payments.invoice_number IS 'Reference number for the payment (e.g., bank transfer reference)';
COMMENT ON COLUMN therapist_payments.payment_reference IS 'Additional payment reference or transaction ID';
COMMENT ON COLUMN therapist_payments.notes IS 'Additional notes about the payment';

COMMENT ON COLUMN therapist_assignments.weekly_payment_id IS 'Links assignment to its weekly payment record';

-- =============================================================================
-- 6. INSERT SAMPLE DATA (FOR TESTING - REMOVE IN PRODUCTION)
-- =============================================================================
-- NOTE: This is just for development testing - remove before production deployment

-- Example of how payment records will look (commented out for safety)
/*
INSERT INTO therapist_payments (
  therapist_id,
  week_start_date,
  week_end_date,
  total_assignments,
  total_hours,
  total_fee,
  payment_status
) VALUES (
  (SELECT id FROM therapists LIMIT 1),
  '2024-11-04',
  '2024-11-10',
  5,
  15.0,
  600.00,
  'pending'
);
*/

-- =============================================================================
-- SCHEMA COMPLETE
-- =============================================================================
-- This schema provides:
-- 1. Weekly payment tracking per therapist
-- 2. Links between assignments and payment records
-- 3. Payment status workflow (pending -> paid)
-- 4. Audit trail with created/updated timestamps
-- 5. Performance indexes for efficient queries
-- 6. Data integrity constraints
-- 7. Automatic timestamp updates

-- Next steps:
-- 1. Run this script in your Supabase SQL editor
-- 2. Verify tables are created correctly
-- 3. Proceed to payment calculation logic implementation