-- Trigger to automatically sync booking_occurrences status with parent bookings table
-- This ensures child records always match parent status

-- Function that syncs occurrence status when parent booking status changes
CREATE OR REPLACE FUNCTION sync_booking_occurrences_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if status actually changed
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) OR TG_OP = 'INSERT' THEN
    -- Update all child occurrences to match parent status
    UPDATE booking_occurrences
    SET
      status = NEW.status,
      updated_at = NOW()
    WHERE booking_id = NEW.booking_id;

    RAISE NOTICE 'Synced % occurrence(s) to status: %',
      (SELECT COUNT(*) FROM booking_occurrences WHERE booking_id = NEW.booking_id),
      NEW.status;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS trigger_sync_booking_occurrences_status ON bookings;

-- Create trigger that fires after booking status update
CREATE TRIGGER trigger_sync_booking_occurrences_status
  AFTER INSERT OR UPDATE OF status
  ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION sync_booking_occurrences_status();

-- Run this to sync any existing mismatched records
UPDATE booking_occurrences bo
SET status = b.status, updated_at = NOW()
FROM bookings b
WHERE bo.booking_id = b.booking_id
  AND bo.status IS DISTINCT FROM b.status;
