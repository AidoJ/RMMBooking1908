-- Fix Historic Booking Records - Link to Existing Payment Records
-- This script finds completed bookings without weekly_payment_id and links them to existing payment records

-- Step 1: Show current state (for debugging)
SELECT 
    b.id,
    b.booking_id,
    b.booking_time,
    b.therapist_id,
    b.therapist_fee,
    b.weekly_payment_id,
    tp.first_name || ' ' || tp.last_name as therapist_name
FROM bookings b
LEFT JOIN therapist_profiles tp ON b.therapist_id = tp.id
WHERE b.status = 'completed' 
    AND b.therapist_fee > 0
    AND b.weekly_payment_id IS NULL
ORDER BY b.booking_time DESC;

-- Step 2: Link bookings to payment records based on therapist and date range
-- This finds the appropriate payment record for each orphaned booking
UPDATE bookings 
SET weekly_payment_id = payment_matches.payment_id,
    updated_at = NOW()
FROM (
    SELECT 
        b.id as booking_id,
        tp_pay.id as payment_id
    FROM bookings b
    JOIN therapist_profiles tp ON b.therapist_id = tp.id
    JOIN therapist_payments tp_pay ON tp_pay.therapist_id = b.therapist_id
    WHERE b.status = 'completed' 
        AND b.therapist_fee > 0
        AND b.weekly_payment_id IS NULL
        AND DATE(b.booking_time) >= tp_pay.week_start_date
        AND DATE(b.booking_time) <= tp_pay.week_end_date
) payment_matches
WHERE bookings.id = payment_matches.booking_id;

-- Step 3: Verify the links were created correctly
SELECT 
    b.id,
    b.booking_id,
    b.booking_time,
    b.therapist_fee,
    b.weekly_payment_id,
    tp.first_name || ' ' || tp.last_name as therapist_name,
    tpay.payment_status,
    tpay.invoice_number
FROM bookings b
LEFT JOIN therapist_profiles tp ON b.therapist_id = tp.id  
LEFT JOIN therapist_payments tpay ON b.weekly_payment_id = tpay.id
WHERE b.status = 'completed' 
    AND b.therapist_fee > 0
ORDER BY b.booking_time DESC;