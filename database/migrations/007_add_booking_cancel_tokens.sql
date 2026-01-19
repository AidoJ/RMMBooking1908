-- Migration: Add cancel/reschedule tokens to bookings table
-- Date: 2026-01-19
-- Purpose: Enable secure client-facing cancel and reschedule links

-- Add token columns to bookings table
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS cancel_token UUID DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS reschedule_token UUID DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS cancellation_fee DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS refund_amount DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS refund_id TEXT,
ADD COLUMN IF NOT EXISTS client_cancelled_at TIMESTAMP WITH TIME ZONE;

-- Create index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_bookings_cancel_token ON bookings(cancel_token);
CREATE INDEX IF NOT EXISTS idx_bookings_reschedule_token ON bookings(reschedule_token);

-- Update existing bookings to have tokens (if they don't already)
UPDATE bookings
SET cancel_token = gen_random_uuid()
WHERE cancel_token IS NULL;

UPDATE bookings
SET reschedule_token = gen_random_uuid()
WHERE reschedule_token IS NULL;

-- Add NOT NULL constraint after populating
ALTER TABLE bookings
ALTER COLUMN cancel_token SET NOT NULL,
ALTER COLUMN reschedule_token SET NOT NULL;

COMMENT ON COLUMN bookings.cancel_token IS 'Secure token for client-facing cancellation link';
COMMENT ON COLUMN bookings.reschedule_token IS 'Secure token for client-facing reschedule link';
COMMENT ON COLUMN bookings.cancellation_fee IS 'Cancellation fee charged (if any)';
COMMENT ON COLUMN bookings.refund_amount IS 'Amount refunded to client';
COMMENT ON COLUMN bookings.refund_id IS 'Stripe refund ID';
COMMENT ON COLUMN bookings.client_cancelled_at IS 'Timestamp when client cancelled';
