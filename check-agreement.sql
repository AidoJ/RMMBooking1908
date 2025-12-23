-- Check if agreement template has full content
SELECT
  id,
  version,
  title,
  LENGTH(content_html) as html_length,
  content_pdf_url,
  is_active,
  effective_from
FROM public.agreement_templates
WHERE version = 'v3.0';
