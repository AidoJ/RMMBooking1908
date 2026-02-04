-- Migration: Add fields to store original booking details during reschedule
-- These are used to revert if all therapists are unavailable

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS original_booking_time timestamptz,
ADD COLUMN IF NOT EXISTS original_therapist_id uuid REFERENCES therapist_profiles(id),
ADD COLUMN IF NOT EXISTS original_client_fee decimal(10,2),
ADD COLUMN IF NOT EXISTS pending_payment_intent_id text;

-- Add comment explaining purpose
COMMENT ON COLUMN bookings.original_booking_time IS 'Original booking time before reschedule request - used for revert if reschedule fails';
COMMENT ON COLUMN bookings.original_therapist_id IS 'Original therapist ID before reschedule request - used for revert if reschedule fails';
COMMENT ON COLUMN bookings.original_client_fee IS 'Original client fee before reschedule request - used for revert if reschedule fails';
COMMENT ON COLUMN bookings.pending_payment_intent_id IS 'Stripe Payment Intent ID for additional reschedule payment - captured when therapist accepts';
