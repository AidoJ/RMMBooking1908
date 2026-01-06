-- ===================================================
-- Migration 006: Add Email Subscription to Customers
-- ===================================================
-- Adds email subscription opt-in field to customers table
-- ===================================================

-- Add email_subscribed column to customers table
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS email_subscribed boolean NOT NULL DEFAULT false;

-- Add index for filtering subscribed customers
CREATE INDEX IF NOT EXISTS idx_customers_email_subscribed
ON public.customers(email_subscribed)
WHERE email_subscribed = true;

-- Add comment
COMMENT ON COLUMN public.customers.email_subscribed IS
  'Whether customer has opted in to receive marketing emails. Set during booking process.';

-- ===================================================
-- Success message
-- ===================================================
DO $$
BEGIN
  RAISE NOTICE '✅ email_subscribed column added to customers table';
  RAISE NOTICE '✅ Index created for subscribed customers';
  RAISE NOTICE '📧 Ready to track customer email preferences!';
END $$;
