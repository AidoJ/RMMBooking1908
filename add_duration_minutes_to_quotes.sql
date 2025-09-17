-- Add duration_minutes calculated field to quotes table
-- This will store session_duration_minutes * total_sessions for easier booking/payment calculations

ALTER TABLE quotes
ADD COLUMN duration_minutes INTEGER;

-- Add comment explaining the field
COMMENT ON COLUMN quotes.duration_minutes IS 'Total duration in minutes (session_duration_minutes * total_sessions) used for booking creation and therapist fee calculations';

-- Update existing records to calculate duration_minutes
UPDATE quotes
SET duration_minutes = session_duration_minutes * total_sessions
WHERE session_duration_minutes IS NOT NULL AND total_sessions IS NOT NULL;

-- Add a trigger to automatically calculate duration_minutes when session details change
CREATE OR REPLACE FUNCTION calculate_quote_duration()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate duration_minutes when session_duration_minutes or total_sessions change
    IF NEW.session_duration_minutes IS NOT NULL AND NEW.total_sessions IS NOT NULL THEN
        NEW.duration_minutes = NEW.session_duration_minutes * NEW.total_sessions;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-calculate on INSERT/UPDATE
DROP TRIGGER IF EXISTS trigger_calculate_quote_duration ON quotes;
CREATE TRIGGER trigger_calculate_quote_duration
    BEFORE INSERT OR UPDATE OF session_duration_minutes, total_sessions
    ON quotes
    FOR EACH ROW
    EXECUTE FUNCTION calculate_quote_duration();