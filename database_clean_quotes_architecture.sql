-- CLEAN QUOTES ARCHITECTURE - Comprehensive Schema
-- This replaces the previous quotes table with a clean, separated design
-- Run this SQL in Supabase SQL Editor

-- 1. DROP existing quotes table if it exists (test data only)
DROP TABLE IF EXISTS public.quotes CASCADE;

-- 2. Create comprehensive quotes table (main quote data)
CREATE TABLE public.quotes (
  id VARCHAR PRIMARY KEY,  -- Quote ID like "Q-240909-001"

  -- Core quote identification
  status VARCHAR NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'confirmed', 'completed', 'cancelled')),
  created_by UUID REFERENCES public.admin_users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Customer details
  customer_name VARCHAR,
  customer_email VARCHAR,
  customer_phone VARCHAR,

  -- Event structure control (KEY FIELD)
  event_structure VARCHAR NOT NULL CHECK (event_structure IN ('single_day', 'multi_day')),

  -- Single day event fields (populated when event_structure = 'single_day')
  single_event_date DATE,
  single_start_time TIME,

  -- Multi day event fields (populated when event_structure = 'multi_day')
  number_of_event_days INTEGER,

  -- Event details
  event_name VARCHAR,
  event_location VARCHAR,
  event_type VARCHAR,

  -- Session specifications
  session_duration_minutes INTEGER NOT NULL,
  total_sessions INTEGER NOT NULL,
  therapists_needed INTEGER NOT NULL,
  sessions_per_day INTEGER,

  -- Massage details (from current system)
  number_of_massages INTEGER,
  duration_per_massage INTEGER,
  expected_attendees INTEGER,
  preferred_therapists INTEGER,

  -- Corporate details (moved from bookings)
  company_name VARCHAR,
  business_name VARCHAR,
  corporate_contact_name VARCHAR,
  corporate_contact_email VARCHAR,
  corporate_contact_phone VARCHAR,
  billing_address TEXT,
  po_number VARCHAR,

  -- Event requirements
  setup_requirements TEXT,
  special_requirements TEXT,
  urgency VARCHAR DEFAULT 'flexible' CHECK (urgency IN ('flexible', 'within_week', 'within_3_days', 'urgent_24h')),
  payment_method VARCHAR DEFAULT 'invoice' CHECK (payment_method IN ('card', 'invoice', 'bank_transfer')),
  preferred_time_range TEXT,

  -- Financial details
  hourly_rate DECIMAL(10,2) NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  total_therapist_fees DECIMAL(10,2) NOT NULL,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  tax_rate_amount DECIMAL(10,2) DEFAULT 0,
  final_amount DECIMAL(10,2), -- total_amount - discount_amount + tax

  -- Payment tracking
  payment_status VARCHAR DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'overdue', 'refunded')),
  invoice_number VARCHAR,
  invoice_sent_at TIMESTAMP WITH TIME ZONE,
  payment_due_date DATE,
  paid_amount DECIMAL(10,2),
  paid_date DATE,

  -- Quote workflow
  quote_sent_at TIMESTAMP WITH TIME ZONE,
  quote_accepted_at TIMESTAMP WITH TIME ZONE,
  quote_valid_until DATE,

  -- Additional fields
  discount_code VARCHAR,
  gift_card_code VARCHAR,
  gift_card_amount DECIMAL(10,2) DEFAULT 0,
  notes TEXT,

  -- Constraints
  CONSTRAINT check_single_day_fields CHECK (
    (event_structure = 'single_day' AND single_event_date IS NOT NULL AND single_start_time IS NOT NULL AND number_of_event_days IS NULL) OR
    (event_structure = 'multi_day' AND single_event_date IS NULL AND single_start_time IS NULL AND number_of_event_days IS NOT NULL)
  ),
  CONSTRAINT check_date_range CHECK (
    (single_event_date IS NULL OR single_event_date <= CURRENT_DATE + INTERVAL '12 months') AND
    (quote_valid_until IS NULL OR quote_valid_until <= CURRENT_DATE + INTERVAL '12 months')
  )
);

-- 3. Create quote_dates table for multi-day events
CREATE TABLE public.quote_dates (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  quote_id VARCHAR NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  event_date DATE NOT NULL,
  start_time TIME NOT NULL,
  day_number INTEGER NOT NULL, -- Day 1, Day 2, etc. for invoice line items
  sessions_count INTEGER DEFAULT 0, -- Sessions planned for this specific day
  notes TEXT, -- Day-specific notes
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT quote_dates_pkey PRIMARY KEY (id),
  CONSTRAINT quote_dates_unique_day UNIQUE (quote_id, day_number),
  CONSTRAINT quote_dates_future_only CHECK (event_date >= CURRENT_DATE),
  CONSTRAINT quote_dates_max_future CHECK (event_date <= CURRENT_DATE + INTERVAL '12 months'),
  CONSTRAINT quote_dates_positive_day CHECK (day_number > 0),
  CONSTRAINT quote_dates_positive_sessions CHECK (sessions_count >= 0)
);

-- 4. Add indexes for performance
CREATE INDEX idx_quotes_status ON public.quotes(status);
CREATE INDEX idx_quotes_created_at ON public.quotes(created_at);
CREATE INDEX idx_quotes_customer_email ON public.quotes(customer_email);
CREATE INDEX idx_quotes_event_structure ON public.quotes(event_structure);
CREATE INDEX idx_quotes_payment_status ON public.quotes(payment_status);
CREATE INDEX idx_quotes_single_event_date ON public.quotes(single_event_date);
CREATE INDEX idx_quotes_quote_valid_until ON public.quotes(quote_valid_until);

CREATE INDEX idx_quote_dates_quote_id ON public.quote_dates(quote_id);
CREATE INDEX idx_quote_dates_event_date ON public.quote_dates(event_date);
CREATE INDEX idx_quote_dates_day_number ON public.quote_dates(quote_id, day_number);

-- 5. Add updated_at trigger for quotes table
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

-- 6. Add RLS (Row Level Security) policies
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_dates ENABLE ROW LEVEL SECURITY;

-- Quotes policies
CREATE POLICY "Allow authenticated users to view quotes" ON public.quotes
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow admin users to manage quotes" ON public.quotes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE id = auth.uid()
            AND role IN ('super_admin', 'admin')
        )
    );

-- Quote dates policies
CREATE POLICY "Allow authenticated users to view quote dates" ON public.quote_dates
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow admin users to manage quote dates" ON public.quote_dates
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE id = auth.uid()
            AND role IN ('super_admin', 'admin')
        )
    );

-- 7. Add helpful functions

-- Function to calculate final amount automatically
CREATE OR REPLACE FUNCTION calculate_quote_final_amount()
RETURNS TRIGGER AS $$
BEGIN
    NEW.final_amount = (NEW.total_amount - COALESCE(NEW.discount_amount, 0) - COALESCE(NEW.gift_card_amount, 0) + COALESCE(NEW.tax_rate_amount, 0));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER quotes_calculate_final_amount
    BEFORE INSERT OR UPDATE ON public.quotes
    FOR EACH ROW
    EXECUTE FUNCTION calculate_quote_final_amount();

-- Function to validate quote_dates consistency
CREATE OR REPLACE FUNCTION validate_quote_dates_consistency()
RETURNS TRIGGER AS $$
DECLARE
    quote_event_structure VARCHAR;
    expected_days INTEGER;
    actual_days INTEGER;
BEGIN
    -- Get quote details
    SELECT event_structure, number_of_event_days
    INTO quote_event_structure, expected_days
    FROM public.quotes
    WHERE id = NEW.quote_id;

    -- Only validate for multi-day events
    IF quote_event_structure = 'multi_day' THEN
        -- Count actual days for this quote
        SELECT COUNT(*) INTO actual_days
        FROM public.quote_dates
        WHERE quote_id = NEW.quote_id;

        -- Allow up to expected_days (but not exceed)
        IF actual_days > expected_days THEN
            RAISE EXCEPTION 'Cannot add more than % days to this quote', expected_days;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER quote_dates_consistency_check
    BEFORE INSERT ON public.quote_dates
    FOR EACH ROW
    EXECUTE FUNCTION validate_quote_dates_consistency();

-- 8. Add documentation
COMMENT ON TABLE public.quotes IS 'Clean quotes table - comprehensive quote management separated from booking execution';
COMMENT ON TABLE public.quote_dates IS 'Multi-day event dates with individual scheduling per day';
COMMENT ON COLUMN public.quotes.event_structure IS 'Controls whether single_day fields or quote_dates table is used';
COMMENT ON COLUMN public.quotes.final_amount IS 'Auto-calculated: total_amount - discount - gift_card + tax';
COMMENT ON COLUMN public.quote_dates.day_number IS 'Sequential day number for invoice line items (Day 1, Day 2, etc.)';

-- 9. Sample data for testing (optional - remove if not needed)
/*
-- Single day quote example
INSERT INTO public.quotes (
    id, event_structure, customer_name, customer_email,
    single_event_date, single_start_time,
    session_duration_minutes, total_sessions, therapists_needed,
    hourly_rate, total_amount, total_therapist_fees
) VALUES (
    'Q-TEST-001', 'single_day', 'Test Customer', 'test@company.com',
    '2024-09-20', '10:00',
    150, 4, 2, 160.00, 1600.00, 900.00
);

-- Multi day quote example
INSERT INTO public.quotes (
    id, event_structure, customer_name, customer_email,
    number_of_event_days, session_duration_minutes, total_sessions, therapists_needed,
    hourly_rate, total_amount, total_therapist_fees
) VALUES (
    'Q-TEST-002', 'multi_day', 'Multi Day Corp', 'events@corp.com',
    2, 150, 8, 2, 160.00, 3200.00, 1800.00
);

-- Multi day dates
INSERT INTO public.quote_dates (quote_id, event_date, start_time, day_number, sessions_count) VALUES
('Q-TEST-002', '2024-09-16', '10:00', 1, 4),
('Q-TEST-002', '2024-09-20', '14:00', 2, 4);
*/

-- Success message
SELECT 'Clean Quotes Architecture created successfully!' as message,
       'Quotes table with event_structure control and quote_dates table for multi-day events' as details;