-- Enhanced Quote System Database Schema - FINAL CORRECTED VERSION
-- Based on current database schema
-- Run this SQL in Supabase SQL Editor

-- 1. Create new quotes table for enhanced multi-day quote system
CREATE TABLE public.quotes (
  id VARCHAR PRIMARY KEY,  -- Quote ID like "Q-240909-001"
  status VARCHAR NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'confirmed', 'completed', 'cancelled')),
  customer_name VARCHAR,
  customer_email VARCHAR,
  customer_phone VARCHAR,
  event_name VARCHAR,
  event_location VARCHAR,
  event_date_start DATE NOT NULL,
  event_date_end DATE NOT NULL,
  total_sessions INTEGER NOT NULL,
  therapists_needed INTEGER NOT NULL,
  sessions_per_day INTEGER NOT NULL,
  session_duration_minutes INTEGER NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  total_therapist_fees DECIMAL(10,2) NOT NULL,
  hourly_rate DECIMAL(10,2) NOT NULL,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  final_amount DECIMAL(10,2), -- total_amount - discount_amount
  payment_status VARCHAR DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'overdue', 'refunded')),
  invoice_number VARCHAR,
  invoice_sent_at TIMESTAMP WITH TIME ZONE,
  payment_due_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES public.admin_users(id)
);

-- 2. Add ONLY the missing columns to existing bookings table
-- Note: The following fields already exist and will NOT be added:
-- - number_of_massages (line 108)
-- - duration_per_massage (line 109)
-- - original_quote_id (line 137)
-- - quote_only, quote_amount, quote_valid_until, quote_sent_at, quote_accepted_at

-- Add new fields for enhanced quote system
ALTER TABLE public.bookings ADD COLUMN parent_quote_id VARCHAR REFERENCES public.quotes(id) ON DELETE CASCADE;
ALTER TABLE public.bookings ADD COLUMN quote_day_number INTEGER; -- Day 1, Day 2, etc.

-- 3. Add indexes for better performance
CREATE INDEX idx_quotes_status ON public.quotes(status);
CREATE INDEX idx_quotes_created_at ON public.quotes(created_at);
CREATE INDEX idx_quotes_payment_status ON public.quotes(payment_status);
CREATE INDEX idx_quotes_event_dates ON public.quotes(event_date_start, event_date_end);
CREATE INDEX idx_bookings_parent_quote_id ON public.bookings(parent_quote_id);
CREATE INDEX idx_bookings_quote_day_number ON public.bookings(quote_day_number);

-- 4. Add updated_at trigger for quotes table
CREATE OR REPLACE FUNCTION update_quotes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER quotes_updated_at_trigger
    BEFORE UPDATE ON public.quotes
    FOR EACH ROW
    EXECUTE FUNCTION update_quotes_updated_at();

-- 5. Add RLS (Row Level Security) policies
-- Enable RLS on quotes table
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to view quotes
CREATE POLICY "Allow authenticated users to view quotes" ON public.quotes
    FOR SELECT USING (auth.role() = 'authenticated');

-- Policy for admin users to manage quotes
CREATE POLICY "Allow admin users to manage quotes" ON public.quotes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE id = auth.uid()
            AND role IN ('super_admin', 'admin')
        )
    );

-- 6. Add comment to document the relationship
COMMENT ON TABLE public.quotes IS 'Enhanced quote system for multi-day events. Parent table for bookings linked via parent_quote_id.';
COMMENT ON COLUMN public.bookings.parent_quote_id IS 'Links child booking to parent quote for multi-day events';
COMMENT ON COLUMN public.bookings.quote_day_number IS 'Day number within quote event (1, 2, 3, etc.)';

-- Success message
SELECT 'Enhanced Quote System database schema created successfully!' as message,
       'New quotes table created with parent-child relationship to bookings table' as details;