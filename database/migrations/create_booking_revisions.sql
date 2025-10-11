-- Create booking_revisions table for audit trail
-- This table stores historical snapshots of bookings before they are modified

CREATE TABLE IF NOT EXISTS booking_revisions (
  id BIGSERIAL PRIMARY KEY,
  booking_id VARCHAR(50) NOT NULL,
  revision_number INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  modified_by VARCHAR(255),
  change_reason TEXT,

  -- Snapshot of booking data at time of revision
  snapshot JSONB NOT NULL,

  -- Summary of what changed
  changes JSONB,

  -- Index for fast lookup by booking_id
  CONSTRAINT fk_booking FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE
);

-- Create index for efficient queries
CREATE INDEX idx_booking_revisions_booking_id ON booking_revisions(booking_id);
CREATE INDEX idx_booking_revisions_created_at ON booking_revisions(created_at DESC);
CREATE UNIQUE INDEX idx_booking_revisions_unique ON booking_revisions(booking_id, revision_number);

-- Add revision tracking fields to bookings table
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS revision_number INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_modified_by VARCHAR(255),
ADD COLUMN IF NOT EXISTS last_modified_at TIMESTAMP WITH TIME ZONE;

-- Add comment for documentation
COMMENT ON TABLE booking_revisions IS 'Stores historical snapshots of bookings for audit trail and dispute resolution';
COMMENT ON COLUMN booking_revisions.snapshot IS 'Complete booking state as JSON before the change';
COMMENT ON COLUMN booking_revisions.changes IS 'Summary of what fields changed in this revision';
