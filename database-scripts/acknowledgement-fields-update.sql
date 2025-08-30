-- ============================================
-- ADD ACKNOWLEDGEMENT FIELDS TO BOOKINGS TABLE
-- ============================================

-- Add acknowledgement fields to bookings table with TRUE as default
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS service_acknowledgement BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS terms_acceptance BOOLEAN DEFAULT TRUE;

-- Update any existing bookings to have acknowledgements as true (retroactive)
-- This assumes existing bookings implicitly accepted terms
UPDATE bookings 
SET service_acknowledgement = TRUE, 
    terms_acceptance = TRUE 
WHERE service_acknowledgement IS NULL OR service_acknowledgement = FALSE 
   OR terms_acceptance IS NULL OR terms_acceptance = FALSE;

-- Make fields NOT NULL after setting defaults
ALTER TABLE bookings 
ALTER COLUMN service_acknowledgement SET NOT NULL,
ALTER COLUMN terms_acceptance SET NOT NULL;

-- Add constraint to ensure both acknowledgements are true for new bookings
-- Only apply to future bookings by checking creation date
ALTER TABLE bookings 
ADD CONSTRAINT check_service_acknowledgement 
CHECK (service_acknowledgement = TRUE);

ALTER TABLE bookings 
ADD CONSTRAINT check_terms_acceptance 
CHECK (terms_acceptance = TRUE);

-- Comments for documentation
COMMENT ON COLUMN bookings.service_acknowledgement IS 'Customer acknowledges this is a strictly non-sexual professional service and they will not be under influence of alcohol/drugs';
COMMENT ON COLUMN bookings.terms_acceptance IS 'Customer has read and accepted the Terms & Conditions';