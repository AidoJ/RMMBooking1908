-- ===================================================
-- Migration 005: Email Broadcasts System
-- ===================================================
-- Creates tables for admin email broadcast functionality
-- ===================================================

-- Create enum for recipient types
CREATE TYPE recipient_type AS ENUM (
  'all_therapists',
  'all_customers',
  'individual_therapists',
  'individual_customers'
);

-- Create enum for broadcast status
CREATE TYPE broadcast_status AS ENUM (
  'draft',
  'sending',
  'sent',
  'failed'
);

-- ===================================================
-- Table: email_broadcasts
-- ===================================================
-- Stores email broadcast campaigns sent by admins
CREATE TABLE IF NOT EXISTS public.email_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Email content
  subject text NOT NULL,
  body text NOT NULL,

  -- Recipients
  recipient_type recipient_type NOT NULL,
  recipient_ids jsonb, -- Array of therapist/customer IDs if individual send
  total_recipients integer NOT NULL DEFAULT 0,

  -- Tracking
  sent_by uuid NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
  sent_at timestamptz,
  status broadcast_status NOT NULL DEFAULT 'draft',

  -- Metadata
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ===================================================
-- Table: email_broadcast_recipients
-- ===================================================
-- Tracks individual email sends within a broadcast
CREATE TABLE IF NOT EXISTS public.email_broadcast_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  broadcast_id uuid NOT NULL REFERENCES public.email_broadcasts(id) ON DELETE CASCADE,

  -- Recipient info
  recipient_email text NOT NULL,
  recipient_name text,
  recipient_type text NOT NULL, -- 'therapist' or 'customer'
  recipient_id uuid, -- ID of therapist or customer

  -- Send tracking
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'failed'
  sent_at timestamptz,
  error_message text,

  created_at timestamptz NOT NULL DEFAULT now()
);

-- ===================================================
-- Indexes
-- ===================================================
CREATE INDEX idx_email_broadcasts_sent_by ON public.email_broadcasts(sent_by);
CREATE INDEX idx_email_broadcasts_status ON public.email_broadcasts(status);
CREATE INDEX idx_email_broadcasts_created_at ON public.email_broadcasts(created_at DESC);

CREATE INDEX idx_broadcast_recipients_broadcast_id ON public.email_broadcast_recipients(broadcast_id);
CREATE INDEX idx_broadcast_recipients_status ON public.email_broadcast_recipients(status);

-- ===================================================
-- Row Level Security (RLS)
-- ===================================================

-- Enable RLS
ALTER TABLE public.email_broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_broadcast_recipients ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Admins can view all broadcasts" ON public.email_broadcasts;
DROP POLICY IF EXISTS "Admins can create broadcasts" ON public.email_broadcasts;
DROP POLICY IF EXISTS "Admins can update own broadcasts" ON public.email_broadcasts;
DROP POLICY IF EXISTS "Admins can delete own broadcasts" ON public.email_broadcasts;

DROP POLICY IF EXISTS "Admins can view all recipients" ON public.email_broadcast_recipients;
DROP POLICY IF EXISTS "Admins can manage recipients" ON public.email_broadcast_recipients;

-- Policies for email_broadcasts
CREATE POLICY "Admins can view all broadcasts"
ON public.email_broadcasts
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE auth_id = auth.uid()
    AND role IN ('admin', 'super_admin')
    AND is_active = true
  )
);

CREATE POLICY "Admins can create broadcasts"
ON public.email_broadcasts
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE auth_id = auth.uid()
    AND role IN ('admin', 'super_admin')
    AND is_active = true
  )
);

CREATE POLICY "Admins can update own broadcasts"
ON public.email_broadcasts
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE auth_id = auth.uid()
    AND role IN ('admin', 'super_admin')
    AND is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE auth_id = auth.uid()
    AND role IN ('admin', 'super_admin')
    AND is_active = true
  )
);

CREATE POLICY "Admins can delete own broadcasts"
ON public.email_broadcasts
FOR DELETE
TO authenticated
USING (
  sent_by IN (
    SELECT id FROM public.admin_users
    WHERE auth_id = auth.uid()
    AND role IN ('admin', 'super_admin')
    AND is_active = true
  )
);

-- Policies for email_broadcast_recipients
CREATE POLICY "Admins can view all recipients"
ON public.email_broadcast_recipients
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE auth_id = auth.uid()
    AND role IN ('admin', 'super_admin')
    AND is_active = true
  )
);

CREATE POLICY "Admins can manage recipients"
ON public.email_broadcast_recipients
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE auth_id = auth.uid()
    AND role IN ('admin', 'super_admin')
    AND is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE auth_id = auth.uid()
    AND role IN ('admin', 'super_admin')
    AND is_active = true
  )
);

-- ===================================================
-- Comments
-- ===================================================
COMMENT ON TABLE public.email_broadcasts IS 'Email broadcast campaigns sent by admins to therapists and/or customers';
COMMENT ON TABLE public.email_broadcast_recipients IS 'Individual email sends tracking for each broadcast';

COMMENT ON COLUMN public.email_broadcasts.recipient_type IS 'Type of recipients: all_therapists, all_customers, individual_therapists, individual_customers';
COMMENT ON COLUMN public.email_broadcasts.recipient_ids IS 'JSON array of specific recipient IDs when sending to individuals';
COMMENT ON COLUMN public.email_broadcasts.status IS 'Broadcast status: draft, sending, sent, failed';

-- ===================================================
-- Success message
-- ===================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Email broadcasts tables created successfully';
  RAISE NOTICE '✅ RLS policies applied';
  RAISE NOTICE '📧 Ready to send broadcast emails!';
END $$;
