-- CLEAN QUOTES TABLE ONLY
-- Based on your amended CSV with unnecessary triggers/indexes removed

-- Drop existing quotes table
DROP TABLE IF EXISTS public.quotes CASCADE;

-- Create quotes table
CREATE TABLE public.quotes (
  id character varying NOT NULL,
  status character varying NOT NULL DEFAULT 'draft'::character varying,
  created_by uuid NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  updated_at timestamp with time zone NULL DEFAULT now(),

  -- Service reference (from step 1 booking process)
  service_id uuid NULL,
  hourly_rate numeric(10, 2) NOT NULL,

  -- Corporate/Client information
  company_name character varying NULL,
  corporate_contact_name character varying NULL,
  corporate_contact_email character varying NULL,
  corporate_contact_phone character varying NULL,
  billing_address text NULL,

  -- Event structure and timing
  event_structure character varying NOT NULL,
  single_event_date date NULL,
  single_start_time time without time zone NULL,
  number_of_event_days integer NULL,

  -- Event location (defaults from step 1 but editable)
  event_location character varying NULL,
  latitude numeric(10, 8) NULL,
  longitude numeric(11, 8) NULL,
  event_type character varying NULL,
  expected_attendees integer NULL,
  setup_requirements text NULL,
  special_requirements text NULL,
  urgency character varying NULL DEFAULT 'flexible'::character varying,
  payment_method character varying NULL DEFAULT 'invoice'::character varying,
  preferred_time_range text NULL,

  -- Duration calculations
  total_event_duration integer NULL,
  avg_duration_per_attendee integer NOT NULL,

  -- Pricing
  total_amount numeric(10, 2) NOT NULL,
  gst_incl_amount numeric(10, 2) NULL,

  -- ADMIN SECTION
  total_therapist_fees numeric(10, 2) NOT NULL,
  discount_amount numeric(10, 2) NULL DEFAULT 0,
  tax_rate_amount numeric(10, 2) NULL DEFAULT 0,
  final_amount numeric(10, 2) NULL,
  payment_status character varying NULL DEFAULT 'pending'::character varying,
  invoice_number character varying NULL,
  invoice_sent_at timestamp with time zone NULL,
  payment_due_date date NULL,
  paid_amount numeric(10, 2) NULL,
  paid_date date NULL,
  quote_sent_at timestamp with time zone NULL,
  quote_accepted_at timestamp with time zone NULL,
  quote_valid_until date NULL,
  discount_code character varying NULL,
  gift_card_code character varying NULL,
  gift_card_amount numeric(10, 2) NULL DEFAULT 0,
  notes text NULL,

  -- Primary key and foreign keys
  CONSTRAINT quotes_pkey PRIMARY KEY (id),
  CONSTRAINT quotes_service_id_fkey FOREIGN KEY (service_id) REFERENCES services (id),
  CONSTRAINT quotes_created_by_fkey FOREIGN KEY (created_by) REFERENCES admin_users (id),

  -- Payment method check
  CONSTRAINT quotes_payment_method_check CHECK (
    (payment_method)::text = ANY (
      ARRAY[
        'card'::character varying,
        'invoice'::character varying,
        'bank_transfer'::character varying
      ]::text[]
    )
  ),

  -- Payment status check
  CONSTRAINT quotes_payment_status_check CHECK (
    (payment_status)::text = ANY (
      ARRAY[
        'pending'::character varying,
        'paid'::character varying,
        'overdue'::character varying,
        'refunded'::character varying
      ]::text[]
    )
  ),

  -- Status check
  CONSTRAINT quotes_status_check CHECK (
    (status)::text = ANY (
      ARRAY[
        'draft'::character varying,
        'sent'::character varying,
        'accepted'::character varying,
        'confirmed'::character varying,
        'completed'::character varying,
        'cancelled'::character varying
      ]::text[]
    )
  ),

  -- Date range check
  CONSTRAINT check_date_range CHECK (
    (
      (single_event_date IS NULL)
      OR (single_event_date <= (CURRENT_DATE + '1 year'::interval))
    )
    AND (
      (quote_valid_until IS NULL)
      OR (quote_valid_until <= (CURRENT_DATE + '1 year'::interval))
    )
  ),

  -- Urgency check
  CONSTRAINT quotes_urgency_check CHECK (
    (urgency)::text = ANY (
      ARRAY[
        'flexible'::character varying,
        'within_week'::character varying,
        'within_3_days'::character varying,
        'urgent_24h'::character varying
      ]::text[]
    )
  ),

  -- Single vs multi-day validation
  CONSTRAINT check_single_day_fields CHECK (
    (
      ((event_structure)::text = 'single_day'::text)
      AND (single_event_date IS NOT NULL)
      AND (single_start_time IS NOT NULL)
      AND (number_of_event_days IS NULL)
    )
    OR (
      ((event_structure)::text = 'multi_day'::text)
      AND (single_event_date IS NULL)
      AND (single_start_time IS NULL)
      AND (number_of_event_days IS NOT NULL)
    )
  ),

  -- Event structure check
  CONSTRAINT quotes_event_structure_check CHECK (
    (event_structure)::text = ANY (
      ARRAY[
        'single_day'::character varying,
        'multi_day'::character varying
      ]::text[]
    )
  )
) TABLESPACE pg_default;

-- Indexes (cleaned up)
CREATE INDEX IF NOT EXISTS idx_quotes_status ON public.quotes USING btree (status) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_quotes_created_at ON public.quotes USING btree (created_at) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_quotes_corporate_contact_email ON public.quotes USING btree (corporate_contact_email) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_quotes_event_structure ON public.quotes USING btree (event_structure) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_quotes_payment_status ON public.quotes USING btree (payment_status) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_quotes_single_event_date ON public.quotes USING btree (single_event_date) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_quotes_quote_valid_until ON public.quotes USING btree (quote_valid_until) TABLESPACE pg_default;

-- Triggers (only the useful ones)
CREATE OR REPLACE FUNCTION update_quotes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER quotes_updated_at_trigger
BEFORE UPDATE ON quotes
FOR EACH ROW
EXECUTE FUNCTION update_quotes_updated_at();

CREATE OR REPLACE FUNCTION calculate_quote_final_amount()
RETURNS TRIGGER AS $$
BEGIN
    NEW.final_amount = COALESCE(NEW.total_amount, 0)
                      - COALESCE(NEW.discount_amount, 0)
                      + COALESCE(NEW.tax_rate_amount, 0)
                      - COALESCE(NEW.gift_card_amount, 0);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER quotes_calculate_final_amount
BEFORE INSERT OR UPDATE ON quotes
FOR EACH ROW
EXECUTE FUNCTION calculate_quote_final_amount();