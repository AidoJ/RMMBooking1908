-- CLEANUP: Remove all references to legacy booking_occurrences table
-- Run this AFTER reviewing results from find-and-remove-booking-occurrences-triggers.sql

-- WARNING: Only run this if you've confirmed you want to remove booking_occurrences completely
-- This assumes all recurring bookings now use occurrence_number in the bookings table

-- Drop the table if it still exists (this will cascade drop any dependent triggers/functions)
DROP TABLE IF EXISTS public.booking_occurrences CASCADE;

-- List common trigger names that might exist (uncomment specific ones after verification)
-- DROP TRIGGER IF EXISTS handle_recurring_booking ON bookings;
-- DROP TRIGGER IF EXISTS create_booking_occurrences ON bookings;
-- DROP TRIGGER IF EXISTS sync_booking_occurrences ON bookings;

-- List common function names that might exist (uncomment specific ones after verification)
-- DROP FUNCTION IF EXISTS create_recurring_occurrences() CASCADE;
-- DROP FUNCTION IF EXISTS handle_recurring_booking() CASCADE;
-- DROP FUNCTION IF EXISTS sync_booking_to_occurrences() CASCADE;

-- Verify cleanup
SELECT
    'No triggers found on bookings table' AS status
WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE event_object_table = 'bookings'
    AND event_object_schema = 'public'
    AND action_statement LIKE '%booking_occurrences%'
);

SELECT
    'No functions found referencing booking_occurrences' AS status
WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public'
    AND routine_definition LIKE '%booking_occurrences%'
);

SELECT
    'booking_occurrences table removed' AS status
WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'booking_occurrences'
);
