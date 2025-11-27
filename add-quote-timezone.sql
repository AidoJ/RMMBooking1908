-- Add timezone field to quotes table for consistency with bookings
-- This ensures quote_dates can be properly converted to timezone-aware booking_time timestamps

-- Add quote_timezone column
ALTER TABLE public.quotes
ADD COLUMN IF NOT EXISTS quote_timezone VARCHAR(50);

-- Set default timezone for existing quotes based on latitude/longitude if available
-- Using Brisbane as fallback since most existing events are likely in Queensland
UPDATE public.quotes
SET quote_timezone = CASE
  -- Western Australia (Perth - no DST)
  WHEN longitude >= 112.5 AND longitude < 129 THEN 'Australia/Perth'
  -- Northern Territory (Darwin - no DST)
  WHEN latitude > -26 AND longitude >= 129 AND longitude < 138 THEN 'Australia/Darwin'
  -- South Australia (Adelaide - has DST)
  WHEN latitude <= -26 AND longitude >= 129 AND longitude < 141 THEN 'Australia/Adelaide'
  -- Queensland (Brisbane - no DST)
  WHEN latitude > -29 AND longitude >= 138 AND longitude < 154 THEN 'Australia/Brisbane'
  -- Victoria (Melbourne - has DST)
  WHEN latitude <= -34 AND longitude >= 141 AND longitude < 150 THEN 'Australia/Melbourne'
  -- Tasmania (Hobart - has DST)
  WHEN latitude <= -40 THEN 'Australia/Hobart'
  -- NSW/ACT (Sydney - has DST) - default for eastern Australia
  WHEN longitude >= 141 THEN 'Australia/Sydney'
  -- Default to Brisbane for NULL coordinates
  ELSE 'Australia/Brisbane'
END
WHERE quote_timezone IS NULL;

COMMENT ON COLUMN public.quotes.quote_timezone IS 'IANA timezone for the quote event location (e.g., Australia/Brisbane)';
