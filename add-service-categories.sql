-- Add category field to services table for easier navigation in booking form
-- Categories: Massage, Alternative Therapies, Group Events, Corporate Events

-- Add category column
ALTER TABLE public.services
ADD COLUMN IF NOT EXISTS category VARCHAR(50);

-- Set default categories based on service names
-- You can adjust these after running the migration

-- Massage services (common massage types)
UPDATE public.services
SET category = 'Massage'
WHERE category IS NULL
AND (
  name ILIKE '%massage%'
  OR name ILIKE '%swedish%'
  OR name ILIKE '%deep tissue%'
  OR name ILIKE '%sports%'
  OR name ILIKE '%remedial%'
  OR name ILIKE '%relaxation%'
);

-- Alternative Therapies
UPDATE public.services
SET category = 'Alternative Therapies'
WHERE category IS NULL
AND (
  name ILIKE '%reiki%'
  OR name ILIKE '%acupuncture%'
  OR name ILIKE '%reflexology%'
  OR name ILIKE '%aromatherapy%'
  OR name ILIKE '%healing%'
);

-- Corporate Events
UPDATE public.services
SET category = 'Corporate Events'
WHERE category IS NULL
AND (
  name ILIKE '%corporate%'
  OR name ILIKE '%workplace%'
  OR name ILIKE '%office%'
  OR name ILIKE '%business%'
  OR name ILIKE '%chair massage%'
);

-- Group Events
UPDATE public.services
SET category = 'Group Events'
WHERE category IS NULL
AND (
  name ILIKE '%group%'
  OR name ILIKE '%party%'
  OR name ILIKE '%event%'
  OR name ILIKE '%wedding%'
);

-- Set any remaining services to 'Massage' as default
UPDATE public.services
SET category = 'Massage'
WHERE category IS NULL;

-- Add index for faster category filtering
CREATE INDEX IF NOT EXISTS idx_services_category ON public.services(category);

-- Verify categorization
SELECT category, COUNT(*) as service_count, string_agg(name, ', ') as services
FROM public.services
GROUP BY category
ORDER BY category;
