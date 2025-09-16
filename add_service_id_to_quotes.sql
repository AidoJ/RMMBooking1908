-- Add service_id column to quotes table for service reference
-- Run this SQL in Supabase SQL Editor

-- Add service_id column with foreign key reference
ALTER TABLE public.quotes
ADD COLUMN IF NOT EXISTS service_id UUID;

-- Add foreign key constraint to services table
ALTER TABLE public.quotes
ADD CONSTRAINT quotes_service_id_fkey
FOREIGN KEY (service_id) REFERENCES public.services(id);

-- Add comment for documentation
COMMENT ON COLUMN public.quotes.service_id IS 'Reference to the service selected in the quote request';

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'quotes'
  AND column_name = 'service_id';

-- Success message
SELECT 'Service ID column added successfully!' as message;