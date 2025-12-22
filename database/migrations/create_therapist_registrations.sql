-- =====================================================
-- CREATE THERAPIST REGISTRATIONS TABLE
-- Purpose: Store therapist registration applications
-- separate from active therapist_profiles
-- =====================================================

CREATE TABLE public.therapist_registrations (
  -- Primary Key
  id uuid NOT NULL DEFAULT gen_random_uuid(),

  -- ===================================================
  -- STEP 1: PERSONAL INFORMATION
  -- ===================================================
  first_name character varying NOT NULL,
  last_name character varying NOT NULL,
  date_of_birth date NOT NULL,
  email character varying NOT NULL,
  phone character varying NOT NULL,

  -- Address fields (will be combined into home_address when enrolling)
  street_address character varying NOT NULL,
  suburb character varying NOT NULL,
  city character varying NOT NULL,
  state character varying NOT NULL,
  postcode character varying NOT NULL,

  -- Optional profile photo
  profile_photo_url text,

  -- ===================================================
  -- STEP 2: BUSINESS DETAILS
  -- ===================================================
  business_structure character varying NOT NULL
    CHECK (business_structure IN ('sole_trader', 'pty_ltd')),

  -- Sole Trader fields
  business_name character varying,

  -- Pty Ltd Company fields
  company_name character varying,
  company_acn character varying,

  -- Common fields
  business_abn character varying NOT NULL,
  gst_registered boolean NOT NULL DEFAULT false,

  -- Banking details
  bank_account_name character varying NOT NULL,
  bsb character varying NOT NULL,
  bank_account_number character varying NOT NULL,

  -- ===================================================
  -- STEP 3: SERVICE LOCATIONS & AVAILABILITY
  -- ===================================================
  service_cities jsonb NOT NULL DEFAULT '[]'::jsonb,
    -- Example: ["brisbane", "adelaide", "gold-coast"]

  delivery_locations jsonb NOT NULL DEFAULT '[]'::jsonb,
    -- Example: ["hotels", "corporate", "in-home", "events"]

  availability_schedule jsonb NOT NULL DEFAULT '{}'::jsonb,
    -- Example: {
    --   "monday": ["12-5pm", "6-11:30pm"],
    --   "tuesday": ["12-5pm", "6-11:30pm"],
    --   "saturday": ["7-11am", "12-5pm", "6-11:30pm"]
    -- }

  start_date date,

  -- ===================================================
  -- STEP 4: QUALIFICATIONS & SERVICES
  -- ===================================================
  therapies_offered jsonb NOT NULL DEFAULT '[]'::jsonb,
    -- Example: ["stressbuster", "sports", "remedial", "pregnancy"]

  qualification_certificates jsonb NOT NULL DEFAULT '[]'::jsonb,
    -- Example: [
    --   {"url": "https://...", "filename": "cert-iv.pdf"},
    --   {"url": "https://...", "filename": "diploma.pdf"}
    -- ]

  -- ===================================================
  -- STEP 5: INSURANCE & COMPLIANCE
  -- ===================================================
  has_insurance boolean NOT NULL DEFAULT false,
  insurance_expiry_date date,
  insurance_certificate_url text,

  has_first_aid boolean NOT NULL DEFAULT false,
  first_aid_expiry_date date,
  first_aid_certificate_url text,

  work_eligibility_confirmed boolean NOT NULL DEFAULT false,

  -- ===================================================
  -- STEP 6: AGREEMENT & SIGNATURE
  -- ===================================================
  agreement_read_confirmed boolean NOT NULL DEFAULT false,
  legal_advice_confirmed boolean NOT NULL DEFAULT false,
  contractor_relationship_confirmed boolean NOT NULL DEFAULT false,
  information_accurate_confirmed boolean NOT NULL DEFAULT false,
  terms_accepted_confirmed boolean NOT NULL DEFAULT false,

  signature_data text,
  signed_date date,
  full_legal_name character varying,

  -- ===================================================
  -- WORKFLOW & STATUS MANAGEMENT
  -- ===================================================
  status character varying NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft',           -- Partially filled, not submitted
      'submitted',       -- Completed and submitted
      'under_review',    -- Admin is reviewing
      'approved',        -- Admin approved, ready to enroll
      'rejected',        -- Admin rejected
      'enrolled'         -- Successfully enrolled as therapist
    )),

  -- Timestamps for workflow
  submitted_at timestamp with time zone,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamp with time zone,
  review_notes text,
  approved_at timestamp with time zone,
  rejected_at timestamp with time zone,
  rejection_reason text,
  enrolled_at timestamp with time zone,

  -- Link to created therapist profile (set when enrolled)
  therapist_profile_id uuid REFERENCES public.therapist_profiles(id),

  -- Standard timestamps
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),

  -- Primary key constraint
  CONSTRAINT therapist_registrations_pkey PRIMARY KEY (id)
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Index on email for uniqueness checks and lookups
CREATE UNIQUE INDEX idx_therapist_registrations_email
  ON public.therapist_registrations(email);

-- Index on status for filtering
CREATE INDEX idx_therapist_registrations_status
  ON public.therapist_registrations(status);

-- Index on submitted_at for sorting
CREATE INDEX idx_therapist_registrations_submitted_at
  ON public.therapist_registrations(submitted_at DESC);

-- Index on therapist_profile_id for linking
CREATE INDEX idx_therapist_registrations_profile_id
  ON public.therapist_registrations(therapist_profile_id);

-- =====================================================
-- ADD REFERENCE BACK TO therapist_profiles
-- =====================================================

-- Add optional reference from therapist_profiles back to registration
ALTER TABLE public.therapist_profiles
  ADD COLUMN IF NOT EXISTS registration_id uuid
  REFERENCES public.therapist_registrations(id);

-- Index for the reverse lookup
CREATE INDEX IF NOT EXISTS idx_therapist_profiles_registration_id
  ON public.therapist_profiles(registration_id);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE public.therapist_registrations ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert (public registration)
CREATE POLICY "public_can_register"
  ON public.therapist_registrations
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Policy: Users can update their own draft registrations
CREATE POLICY "users_can_update_own_draft"
  ON public.therapist_registrations
  FOR UPDATE
  TO anon, authenticated
  USING (status = 'draft')
  WITH CHECK (status = 'draft');

-- Policy: Users can view their own registrations
CREATE POLICY "users_can_view_own"
  ON public.therapist_registrations
  FOR SELECT
  TO authenticated
  USING (email = auth.jwt()->>'email');

-- Policy: Admins can view all registrations
CREATE POLICY "admins_can_view_all"
  ON public.therapist_registrations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE auth_id = auth.uid()
      AND role IN ('admin', 'superadmin')
    )
  );

-- Policy: Admins can update any registration
CREATE POLICY "admins_can_update_all"
  ON public.therapist_registrations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE auth_id = auth.uid()
      AND role IN ('admin', 'superadmin')
    )
  );

-- =====================================================
-- TRIGGER: Update updated_at timestamp
-- =====================================================

CREATE OR REPLACE FUNCTION update_therapist_registrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_therapist_registrations_updated_at
  BEFORE UPDATE ON public.therapist_registrations
  FOR EACH ROW
  EXECUTE FUNCTION update_therapist_registrations_updated_at();

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE public.therapist_registrations IS
  'Stores therapist registration applications before enrollment into therapist_profiles';

COMMENT ON COLUMN public.therapist_registrations.status IS
  'Workflow status: draft, submitted, under_review, approved, rejected, enrolled';

COMMENT ON COLUMN public.therapist_registrations.therapist_profile_id IS
  'Links to therapist_profiles.id when registration is enrolled';

COMMENT ON COLUMN public.therapist_registrations.service_cities IS
  'JSON array of city codes where therapist will provide services';

COMMENT ON COLUMN public.therapist_registrations.delivery_locations IS
  'JSON array of delivery location types: hotels, corporate, in-home, events';

COMMENT ON COLUMN public.therapist_registrations.availability_schedule IS
  'JSON object with day_of_week as keys and time slots as values';

COMMENT ON COLUMN public.therapist_registrations.therapies_offered IS
  'JSON array of therapy/service IDs the therapist is qualified to provide';

COMMENT ON COLUMN public.therapist_registrations.qualification_certificates IS
  'JSON array of uploaded certificate file URLs and metadata';
