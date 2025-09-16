-- Add latitude and longitude columns to quotes table for Google Maps integration
-- Run this SQL in Supabase SQL Editor

-- Add latitude column
ALTER TABLE public.quotes
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);

-- Add longitude column
ALTER TABLE public.quotes
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- Add comment for documentation
COMMENT ON COLUMN public.quotes.latitude IS 'Google Maps latitude coordinate for event location';
COMMENT ON COLUMN public.quotes.longitude IS 'Google Maps longitude coordinate for event location';

-- Verify the columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'quotes'
  AND column_name IN ('latitude', 'longitude')
ORDER BY column_name;

-- Success message
SELECT 'Location coordinate columns added successfully!' as message;