-- =====================================================
-- UPDATE THERAPIST REGISTRATIONS TABLE
-- Add recruitment status and agreement template support
-- =====================================================

-- Add recruitment status field
ALTER TABLE public.therapist_registrations
  ADD COLUMN IF NOT EXISTS recruitment_status character varying
    CHECK (recruitment_status IN (
      '1st_interview',
      '2nd_interview',
      'accepted',
      'declined',
      'postponed'
    ));

-- Add recruitment tracking timestamps and notes
ALTER TABLE public.therapist_registrations
  ADD COLUMN IF NOT EXISTS first_interview_scheduled_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS first_interview_completed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS first_interview_notes text,
  ADD COLUMN IF NOT EXISTS second_interview_scheduled_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS second_interview_completed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS second_interview_notes text,
  ADD COLUMN IF NOT EXISTS recruitment_notes text;

-- Add agreement template reference
ALTER TABLE public.therapist_registrations
  ADD COLUMN IF NOT EXISTS agreement_template_id uuid,
  ADD COLUMN IF NOT EXISTS agreement_version character varying,
  ADD COLUMN IF NOT EXISTS agreement_pdf_url text;

-- Add index for recruitment status filtering
CREATE INDEX IF NOT EXISTS idx_therapist_registrations_recruitment_status
  ON public.therapist_registrations(recruitment_status);

-- =====================================================
-- CREATE AGREEMENT TEMPLATES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.agreement_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),

  -- Version tracking
  version character varying NOT NULL UNIQUE,
  title character varying NOT NULL DEFAULT 'Independent Contractor Agreement',

  -- Content storage
  content_html text NOT NULL, -- Full HTML for display in form
  content_pdf_url text, -- Link to PDF in Supabase Storage

  -- Summary for quick display
  summary_points jsonb DEFAULT '{
    "key_terms": [],
    "obligations": [],
    "cancellation_policy": [],
    "non_compete": []
  }'::jsonb,

  -- Status
  is_active boolean DEFAULT false, -- Only one should be active at a time
  effective_from date NOT NULL,
  effective_until date,

  -- Audit
  created_by uuid REFERENCES public.admin_users(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),

  CONSTRAINT agreement_templates_pkey PRIMARY KEY (id)
);

-- Add foreign key constraint
ALTER TABLE public.therapist_registrations
  ADD CONSTRAINT fk_agreement_template
  FOREIGN KEY (agreement_template_id)
  REFERENCES public.agreement_templates(id);

-- Index for finding active template
CREATE INDEX IF NOT EXISTS idx_agreement_templates_active
  ON public.agreement_templates(is_active, effective_from DESC)
  WHERE is_active = true;

-- =====================================================
-- INSERT INITIAL AGREEMENT TEMPLATE (V1.0)
-- =====================================================

INSERT INTO public.agreement_templates (
  version,
  title,
  content_html,
  summary_points,
  is_active,
  effective_from
) VALUES (
  'v1.0',
  'Independent Contractor Agreement',
  '<!-- Full agreement HTML will be inserted here -->
  <div class="agreement-content">
    <h2>INDEPENDENT CONTRACTOR AGREEMENT</h2>
    <p><strong>BETWEEN:</strong> Galdon Training Pty Ltd T/A Rejuvenators Mobile Massage</p>
    <p><strong>AND:</strong> [Contractor Name]</p>

    <h3>KEY TERMS:</h3>
    <ul>
      <li>Contract Period: 12 months (auto-renews)</li>
      <li>Relationship: Independent Contractor</li>
      <li>Payment: As per agreed rates</li>
      <li>Notice Period: 30 days</li>
    </ul>

    <h3>YOUR OBLIGATIONS:</h3>
    <ul>
      <li>Complete StressBuster training</li>
      <li>Maintain Therapist App</li>
      <li>Maintain $10M+ insurance</li>
      <li>Handle own tax & super</li>
      <li>Keep client info confidential</li>
      <li>Provide own equipment & supplies</li>
    </ul>

    <h3>CANCELLATION POLICY:</h3>
    <ul>
      <li>Your late cancel (&lt;1hr): Full charge + review</li>
      <li>Client cancel &lt;3hrs: You get full payment</li>
      <li>Client cancel &gt;3hrs: No payment</li>
    </ul>

    <h3>NON-COMPETE:</h3>
    <ul>
      <li>3-12 months after termination</li>
      <li>Cannot solicit clients you served</li>
      <li>Geographic restrictions apply</li>
    </ul>

    <p><em>Full 16-page agreement available for download</em></p>
  </div>',
  '{
    "key_terms": [
      "Contract Period: 12 months (auto-renews)",
      "Relationship: Independent Contractor",
      "Payment: As per agreed rates",
      "Notice Period: 30 days"
    ],
    "obligations": [
      "Complete StressBuster training",
      "Maintain Therapist App",
      "Maintain $10M+ insurance",
      "Handle own tax & super",
      "Keep client info confidential",
      "Provide own equipment & supplies"
    ],
    "cancellation_policy": [
      "Your late cancel (<1hr): Full charge + review",
      "Client cancel <3hrs: You get full payment",
      "Client cancel >3hrs: No payment"
    ],
    "non_compete": [
      "3-12 months after termination",
      "Cannot solicit clients you served",
      "Geographic restrictions apply"
    ]
  }'::jsonb,
  true,
  '2025-01-01'
);

-- =====================================================
-- UPDATE STATUS FIELD TO INCLUDE RECRUITMENT STAGES
-- =====================================================

-- Drop existing constraint
ALTER TABLE public.therapist_registrations
  DROP CONSTRAINT IF EXISTS therapist_registrations_status_check;

-- Add updated constraint with more status options
ALTER TABLE public.therapist_registrations
  ADD CONSTRAINT therapist_registrations_status_check
  CHECK (status IN (
    'draft',              -- Partially filled, not submitted
    'submitted',          -- Completed and submitted
    'under_review',       -- Admin initial review
    'in_recruitment',     -- Interview/recruitment process
    'approved',           -- Passed all interviews, ready to enroll
    'rejected',           -- Application rejected
    'enrolled'            -- Successfully enrolled as therapist
  ));

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON COLUMN public.therapist_registrations.recruitment_status IS
  'Interview stage: 1st_interview, 2nd_interview, accepted, declined, postponed';

COMMENT ON COLUMN public.therapist_registrations.agreement_template_id IS
  'Links to the agreement template version they agreed to';

COMMENT ON TABLE public.agreement_templates IS
  'Stores versioned contractor agreement templates with HTML and PDF content';

COMMENT ON COLUMN public.agreement_templates.is_active IS
  'Only one template should be active at a time - shown to new registrations';

-- =====================================================
-- FUNCTION: Get active agreement template
-- =====================================================

CREATE OR REPLACE FUNCTION get_active_agreement_template()
RETURNS TABLE (
  id uuid,
  version character varying,
  title character varying,
  content_html text,
  content_pdf_url text,
  summary_points jsonb
)
LANGUAGE sql
STABLE
AS $$
  SELECT id, version, title, content_html, content_pdf_url, summary_points
  FROM public.agreement_templates
  WHERE is_active = true
  ORDER BY effective_from DESC
  LIMIT 1;
$$;

COMMENT ON FUNCTION get_active_agreement_template() IS
  'Returns the currently active agreement template for new registrations';
