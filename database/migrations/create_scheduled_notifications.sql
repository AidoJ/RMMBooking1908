-- ============================================================================
-- SCHEDULED NOTIFICATIONS TABLE
-- Date: 2025-10-28
-- Description: Table for scheduling delayed notifications (review requests, etc.)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.scheduled_notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Reference data
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
  therapist_id uuid REFERENCES public.therapist_profiles(id) ON DELETE SET NULL,

  -- Notification details
  notification_type character varying(50) NOT NULL, -- 'review_request', 'follow_up', etc.
  scheduled_time timestamp with time zone NOT NULL,
  status character varying(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),

  -- Contact information (denormalized for reliability)
  customer_email character varying(255),
  customer_phone character varying(50),
  customer_first_name character varying(100),
  therapist_first_name character varying(100),

  -- Notification content data (JSON for flexibility)
  notification_data jsonb,

  -- Execution tracking
  sent_at timestamp with time zone,
  failed_at timestamp with time zone,
  error_message text,
  retry_count integer DEFAULT 0,

  -- Audit
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),

  -- Index for efficient querying of pending notifications
  CONSTRAINT idx_scheduled_notifications_status_time
    CHECK (scheduled_time IS NOT NULL)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_status
  ON public.scheduled_notifications(status);

CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_scheduled_time
  ON public.scheduled_notifications(scheduled_time)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_booking_id
  ON public.scheduled_notifications(booking_id);

CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_type
  ON public.scheduled_notifications(notification_type);

-- RLS (Row Level Security)
ALTER TABLE public.scheduled_notifications ENABLE ROW LEVEL SECURITY;

-- Only admins can manage scheduled notifications
CREATE POLICY "scheduled_notifications_admin_all"
  ON public.scheduled_notifications
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_scheduled_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS scheduled_notifications_updated_at
  ON public.scheduled_notifications;

CREATE TRIGGER scheduled_notifications_updated_at
  BEFORE UPDATE ON public.scheduled_notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_scheduled_notifications_updated_at();

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
