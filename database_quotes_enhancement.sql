-- Enhanced Quote System Database Schema
-- Run this SQL in Supabase SQL Editor

-- 1. Create quotes table
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

-- 2. Add new columns to existing bookings table for quote integration
ALTER TABLE public.bookings ADD COLUMN parent_quote_id VARCHAR REFERENCES public.quotes(id) ON DELETE CASCADE;
ALTER TABLE public.bookings ADD COLUMN quote_day_number INTEGER;
ALTER TABLE public.bookings ADD COLUMN number_of_massages INTEGER;
ALTER TABLE public.bookings ADD COLUMN massage_duration INTEGER; -- duration of each individual massage in minutes

-- 3. Add indexes for better performance
CREATE INDEX idx_quotes_status ON public.quotes(status);
CREATE INDEX idx_quotes_created_at ON public.quotes(created_at);
CREATE INDEX idx_quotes_payment_status ON public.quotes(payment_status);
CREATE INDEX idx_bookings_parent_quote_id ON public.bookings(parent_quote_id);

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

-- 5. Add RLS (Row Level Security) policies if needed
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

-- 6. Sample data for testing (optional - remove if not needed)
/*
INSERT INTO public.quotes (
    id, status, customer_name, customer_email, event_name, event_location,
    event_date_start, event_date_end, total_sessions, therapists_needed,
    sessions_per_day, session_duration_minutes, total_amount, total_therapist_fees,
    hourly_rate, final_amount
) VALUES (
    'Q-240909-001', 'draft', 'Corporate Client', 'events@company.com',
    'Corporate Wellness Day', 'Company HQ Level 5',
    '2024-09-15', '2024-09-16', 20, 2, 10, 30,
    1600.00, 900.00, 160.00, 1600.00
);
*/

-- Success message
SELECT 'Enhanced Quote System database schema created successfully!' as message;