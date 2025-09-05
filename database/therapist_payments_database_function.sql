-- =============================================================================
-- THERAPIST PAYMENTS DATABASE FUNCTION (Option 2)
-- =============================================================================
-- This replaces the complex TypeScript service logic with a simple database function
-- that automatically aggregates RB (booking) and RQ (quote) therapist fees into 
-- the therapist_payments table.

-- Step 1: Add missing weekly_payment_id column to bookings table
-- =============================================================================
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS weekly_payment_id UUID;

-- Add foreign key constraint
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'bookings_weekly_payment_id_fkey'
    ) THEN
        ALTER TABLE public.bookings 
        ADD CONSTRAINT bookings_weekly_payment_id_fkey 
            FOREIGN KEY (weekly_payment_id) 
            REFERENCES public.therapist_payments(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Step 2: Create the main payment aggregation function
-- =============================================================================
CREATE OR REPLACE FUNCTION generate_weekly_payments_for_date_range(
    start_date DATE DEFAULT CURRENT_DATE - INTERVAL '7 days',
    end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
    therapist_id UUID, 
    therapist_name TEXT,
    week_start DATE, 
    week_end DATE,
    total_assignments BIGINT,
    total_hours NUMERIC,
    total_fee NUMERIC,
    payment_id UUID
) AS $$
DECLARE
    payment_record_id UUID;
    therapist_record RECORD;
BEGIN
    -- Create a temporary table to hold our aggregated data
    CREATE TEMP TABLE temp_weekly_aggregation AS
    WITH weekly_data AS (
        -- Get RB fees from completed bookings (regular bookings)
        SELECT 
            b.therapist_id,
            tp.first_name || ' ' || tp.last_name as therapist_name,
            date_trunc('week', b.completed_at::date)::date + 1 as week_start_calc,
            (date_trunc('week', b.completed_at::date)::date + 1) + 6 as week_end_calc,
            b.therapist_fee,
            b.id as source_booking_id,
            NULL::uuid as source_assignment_id,
            1 as assignment_count,
            0.0 as hours_worked,
            'booking' as source_type
        FROM bookings b
        JOIN therapist_profiles tp ON b.therapist_id = tp.id
        WHERE b.status = 'completed' 
            AND b.therapist_fee > 0
            AND b.completed_at IS NOT NULL
            AND b.completed_at::date BETWEEN start_date AND end_date
            AND b.weekly_payment_id IS NULL -- Only unlinked fees
            AND b.therapist_id IS NOT NULL
        
        UNION ALL
        
        -- Get RQ fees from completed assignments (quote work)
        SELECT 
            bta.therapist_id,
            tp.first_name || ' ' || tp.last_name as therapist_name,
            date_trunc('week', bta.confirmed_at::date)::date + 1 as week_start_calc,
            (date_trunc('week', bta.confirmed_at::date)::date + 1) + 6 as week_end_calc,
            bta.therapist_fee,
            bta.booking_id as source_booking_id,
            bta.id as source_assignment_id,
            1 as assignment_count,
            COALESCE(bta.hours_worked, 0) as hours_worked,
            'assignment' as source_type
        FROM booking_therapist_assignments bta
        JOIN bookings b ON bta.booking_id = b.id
        JOIN therapist_profiles tp ON bta.therapist_id = tp.id
        WHERE bta.status = 'completed' 
            AND bta.therapist_fee > 0
            AND b.quote_only = true -- Only quote work
            AND bta.confirmed_at IS NOT NULL
            AND bta.confirmed_at::date BETWEEN start_date AND end_date
            AND bta.weekly_payment_id IS NULL -- Only unlinked fees
            AND bta.therapist_id IS NOT NULL
    )
    -- Aggregate by therapist and week
    SELECT 
        wd.therapist_id,
        wd.therapist_name,
        wd.week_start_calc as week_start,
        wd.week_end_calc as week_end,
        SUM(wd.assignment_count) as total_assignments,
        SUM(wd.hours_worked) as total_hours,
        SUM(wd.therapist_fee) as total_fee,
        -- Collect source IDs for linking later
        array_agg(wd.source_booking_id) FILTER (WHERE wd.source_type = 'booking') as booking_ids,
        array_agg(wd.source_assignment_id) FILTER (WHERE wd.source_type = 'assignment') as assignment_ids
    FROM weekly_data wd
    GROUP BY wd.therapist_id, wd.therapist_name, wd.week_start_calc, wd.week_end_calc
    HAVING SUM(wd.therapist_fee) > 0; -- Only create payments for therapists with fees

    -- Process each aggregated record
    FOR therapist_record IN SELECT * FROM temp_weekly_aggregation LOOP
        -- Insert or update the therapist_payments record
        INSERT INTO therapist_payments (
            therapist_id, 
            week_start_date, 
            week_end_date,
            total_assignments,
            total_hours,
            total_fee,
            payment_status,
            created_at,
            updated_at
        ) VALUES (
            therapist_record.therapist_id,
            therapist_record.week_start,
            therapist_record.week_end,
            therapist_record.total_assignments::integer,
            therapist_record.total_hours,
            therapist_record.total_fee,
            'pending',
            NOW(),
            NOW()
        )
        ON CONFLICT (therapist_id, week_start_date, week_end_date) 
        DO UPDATE SET
            total_assignments = therapist_record.total_assignments::integer,
            total_hours = therapist_record.total_hours,
            total_fee = therapist_record.total_fee,
            payment_status = CASE 
                WHEN therapist_payments.payment_status = 'paid' THEN 'paid'
                ELSE 'pending'
            END,
            updated_at = NOW()
        RETURNING id INTO payment_record_id;

        -- Link the source records to this payment
        -- Update bookings (RB fees)
        IF therapist_record.booking_ids IS NOT NULL THEN
            UPDATE bookings 
            SET weekly_payment_id = payment_record_id,
                updated_at = NOW()
            WHERE id = ANY(therapist_record.booking_ids)
                AND weekly_payment_id IS NULL; -- Don't overwrite existing links
        END IF;

        -- Update assignments (RQ fees)
        IF therapist_record.assignment_ids IS NOT NULL THEN
            UPDATE booking_therapist_assignments 
            SET weekly_payment_id = payment_record_id,
                updated_at = NOW()
            WHERE id = ANY(therapist_record.assignment_ids)
                AND weekly_payment_id IS NULL; -- Don't overwrite existing links
        END IF;

        -- Return the result row
        therapist_id := therapist_record.therapist_id;
        therapist_name := therapist_record.therapist_name;
        week_start := therapist_record.week_start;
        week_end := therapist_record.week_end;
        total_assignments := therapist_record.total_assignments;
        total_hours := therapist_record.total_hours;
        total_fee := therapist_record.total_fee;
        payment_id := payment_record_id;
        
        RETURN NEXT;
    END LOOP;

    -- Clean up
    DROP TABLE temp_weekly_aggregation;
    
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create convenience functions
-- =============================================================================

-- Generate payments for current week
CREATE OR REPLACE FUNCTION generate_weekly_payments_current_week()
RETURNS TABLE(
    therapist_id UUID, 
    therapist_name TEXT,
    week_start DATE, 
    week_end DATE,
    total_assignments BIGINT,
    total_hours NUMERIC,
    total_fee NUMERIC,
    payment_id UUID
) AS $$
BEGIN
    RETURN QUERY 
    SELECT * FROM generate_weekly_payments_for_date_range(
        (date_trunc('week', CURRENT_DATE)::date + 1) - 7, -- Start of last week
        date_trunc('week', CURRENT_DATE)::date + 7        -- End of current week
    );
END;
$$ LANGUAGE plpgsql;

-- Generate payments for a specific week
CREATE OR REPLACE FUNCTION generate_weekly_payments_for_week(
    target_week_start DATE
)
RETURNS TABLE(
    therapist_id UUID, 
    therapist_name TEXT,
    week_start DATE, 
    week_end DATE,
    total_assignments BIGINT,
    total_hours NUMERIC,
    total_fee NUMERIC,
    payment_id UUID
) AS $$
BEGIN
    RETURN QUERY 
    SELECT * FROM generate_weekly_payments_for_date_range(
        target_week_start,
        target_week_start + 6
    );
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create indexes for performance
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_bookings_weekly_payment_id ON bookings(weekly_payment_id);
CREATE INDEX IF NOT EXISTS idx_bookings_completed_therapist ON bookings(therapist_id, status, completed_at) 
    WHERE status = 'completed' AND therapist_fee > 0;
CREATE INDEX IF NOT EXISTS idx_assignments_completed_therapist ON booking_therapist_assignments(therapist_id, status, confirmed_at) 
    WHERE status = 'completed' AND therapist_fee > 0;

-- Step 5: Add helpful comments
-- =============================================================================
COMMENT ON FUNCTION generate_weekly_payments_for_date_range IS 
'Aggregates completed RB (booking) and RQ (assignment) therapist fees into weekly payment records. Links source records via weekly_payment_id.';

COMMENT ON FUNCTION generate_weekly_payments_current_week IS 
'Convenience function to generate payments for the current week period.';

COMMENT ON FUNCTION generate_weekly_payments_for_week IS 
'Generate payments for a specific week starting on the given date.';

-- =============================================================================
-- USAGE EXAMPLES:
-- =============================================================================

-- Example 1: Generate payments for last 7 days
-- SELECT * FROM generate_weekly_payments_for_date_range(CURRENT_DATE - 7, CURRENT_DATE);

-- Example 2: Generate payments for current week  
-- SELECT * FROM generate_weekly_payments_current_week();

-- Example 3: Generate payments for specific week (e.g., week starting Sept 2, 2025)
-- SELECT * FROM generate_weekly_payments_for_week('2025-09-02');

-- Example 4: Check what fees are pending aggregation
-- SELECT 
--   'booking' as source,
--   b.booking_id,
--   b.therapist_fee,
--   b.completed_at,
--   tp.first_name || ' ' || tp.last_name as therapist
-- FROM bookings b 
-- JOIN therapist_profiles tp ON b.therapist_id = tp.id
-- WHERE b.status = 'completed' 
--   AND b.therapist_fee > 0 
--   AND b.weekly_payment_id IS NULL
-- UNION ALL
-- SELECT 
--   'assignment' as source,
--   bk.booking_id,
--   bta.therapist_fee,
--   bta.confirmed_at,
--   tp.first_name || ' ' || tp.last_name as therapist
-- FROM booking_therapist_assignments bta
-- JOIN bookings bk ON bta.booking_id = bk.id 
-- JOIN therapist_profiles tp ON bta.therapist_id = tp.id
-- WHERE bta.status = 'completed' 
--   AND bta.therapist_fee > 0 
--   AND bta.weekly_payment_id IS NULL
--   AND bk.quote_only = true;

-- =============================================================================
-- DEPLOYMENT COMPLETE
-- =============================================================================
-- This function replaces the complex TypeScript service logic.
-- The admin panel will now call this function instead of the application code.