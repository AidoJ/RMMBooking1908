-- Therapist Weekly Payment System - Clean SQL for Supabase
-- Run this script in your Supabase SQL Editor

-- Create therapist_payments table
CREATE TABLE IF NOT EXISTS therapist_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id UUID NOT NULL REFERENCES therapist_profiles(id) ON DELETE CASCADE,
  
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

-- Add weekly_payment_id to booking_therapist_assignments
ALTER TABLE booking_therapist_assignments 
ADD COLUMN IF NOT EXISTS weekly_payment_id UUID REFERENCES therapist_payments(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_therapist_payments_therapist_id ON therapist_payments(therapist_id);
CREATE INDEX IF NOT EXISTS idx_therapist_payments_week_dates ON therapist_payments(week_start_date, week_end_date);
CREATE INDEX IF NOT EXISTS idx_therapist_payments_status ON therapist_payments(payment_status);
CREATE INDEX IF NOT EXISTS idx_therapist_payments_created_at ON therapist_payments(created_at);

-- Index for therapist assignments weekly payment link
CREATE INDEX IF NOT EXISTS idx_booking_therapist_assignments_weekly_payment ON booking_therapist_assignments(weekly_payment_id);

-- Compound index for assignment queries
CREATE INDEX IF NOT EXISTS idx_booking_therapist_assignments_therapist_status ON booking_therapist_assignments(therapist_id, status);

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