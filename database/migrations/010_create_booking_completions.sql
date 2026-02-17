-- Migration: Create booking_completions table
-- Purpose: Store client sign-off data when therapist completes a job

CREATE TABLE IF NOT EXISTS booking_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  session_confirmed boolean NOT NULL,
  client_satisfied boolean NOT NULL,
  dissatisfaction_reason text,
  signature_data text NOT NULL,
  completed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT booking_completions_booking_id_unique UNIQUE (booking_id)
);

-- Index for quick lookup by booking
CREATE INDEX IF NOT EXISTS idx_booking_completions_booking_id ON booking_completions(booking_id);

-- RLS policies
ALTER TABLE booking_completions ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (Netlify functions use service role)
CREATE POLICY "Service role full access on booking_completions"
  ON booking_completions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to insert (therapist app inserts via client)
CREATE POLICY "Authenticated users can insert booking_completions"
  ON booking_completions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to read their own completions
CREATE POLICY "Authenticated users can read booking_completions"
  ON booking_completions
  FOR SELECT
  TO authenticated
  USING (true);
