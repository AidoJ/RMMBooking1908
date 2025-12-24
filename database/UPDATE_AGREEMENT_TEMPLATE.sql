-- =====================================================
-- SIMPLE TEMPLATE FOR UPDATING AGREEMENT CONTENT
-- =====================================================
-- Use this when you want to update the agreement text
-- without creating a new version

-- STEP 1: Update the HTML content
UPDATE public.agreement_templates
SET
  content_html = $$
    <!-- PASTE YOUR NEW AGREEMENT HTML HERE -->
    <!-- Keep the same structure as the current one -->
    <!-- Just update the text/clauses you want to change -->

    <div class="full-agreement">
      <style>
        .full-agreement { font-family: Arial, sans-serif; line-height: 1.6; color: #2c3e50; }
        /* ... keep existing styles ... */
      </style>

      <!-- YOUR UPDATED AGREEMENT CONTENT HERE -->

    </div>
  $$,

  updated_at = NOW()

WHERE version = 'v4.0' AND is_active = true;


-- =====================================================
-- OR: Create a New Version (Recommended for Major Changes)
-- =====================================================
-- This keeps a history of all agreement versions

/*
-- Deactivate current version
UPDATE public.agreement_templates
SET is_active = false
WHERE version = 'v4.0';

-- Insert new version
INSERT INTO public.agreement_templates (
  version,
  title,
  content_html,
  content_pdf_url,
  summary_points,
  is_active,
  effective_from
) VALUES (
  'v5.0',  -- New version number
  'Independent Contractor Agreement',
  $$ <!-- YOUR NEW HTML HERE --> $$,
  'https://your-storage-url/agreement-v5.pdf',  -- If you have a new PDF
  $$ { "key_terms": [...] } $$::jsonb,
  true,
  NOW()
);
*/

-- =====================================================
-- VERIFICATION
-- =====================================================
SELECT
  version,
  title,
  is_active,
  updated_at,
  length(content_html) as content_length
FROM public.agreement_templates
ORDER BY effective_from DESC;
