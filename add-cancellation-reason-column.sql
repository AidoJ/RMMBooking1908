-- Add cancellation_reason column to bookings table
-- Run this in your Supabase SQL Editor

ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS cancellation_reason text;

-- Optional: Add a comment to document the column
COMMENT ON COLUMN public.bookings.cancellation_reason IS 'Reason provided when therapist cancels a booking';
