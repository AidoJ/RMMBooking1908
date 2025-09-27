-- Unified Event Structure Cleanup
-- Remove single day specific fields and unused event_name field
-- This unifies all events to use the same date/time structure

-- Remove single day specific fields and unused event_name
ALTER TABLE quotes
DROP COLUMN IF EXISTS single_event_date,
DROP COLUMN IF EXISTS single_start_time,
DROP COLUMN IF EXISTS event_name;