-- Find and remove database triggers/functions referencing booking_occurrences table
-- This table was migrated to the bookings table using occurrence_number and request_id fields

-- 1. Find all triggers on bookings table
SELECT
    trigger_name,
    event_manipulation,
    action_statement,
    action_timing
FROM information_schema.triggers
WHERE event_object_table = 'bookings'
AND event_object_schema = 'public';

-- 2. Find all functions that reference booking_occurrences
SELECT
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_definition LIKE '%booking_occurrences%';

-- 3. Check if booking_occurrences table still exists
SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'booking_occurrences'
) AS table_exists;

-- After reviewing the results above, uncomment and run the appropriate DROP commands:

-- Example: Drop a trigger (replace trigger_name)
-- DROP TRIGGER IF EXISTS trigger_name ON bookings;

-- Example: Drop a function (replace function_name)
-- DROP FUNCTION IF EXISTS function_name();
