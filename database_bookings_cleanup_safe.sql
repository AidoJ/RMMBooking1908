-- SAFE BOOKINGS TABLE CLEANUP - Remove Quote-Only Fields
-- Preserves all CC booking functionality (discounts, gift cards, tax, etc.)
-- Run this SQL in Supabase SQL Editor

-- 1. Remove quote-specific fields ONLY (safe to remove)
-- These fields are now handled by the quotes table and quote_dates table

-- Corporate event fields (not used in CC bookings)
ALTER TABLE public.bookings DROP COLUMN IF EXISTS event_type;
ALTER TABLE public.bookings DROP COLUMN IF EXISTS expected_attendees;
ALTER TABLE public.bookings DROP COLUMN IF EXISTS number_of_massages;
ALTER TABLE public.bookings DROP COLUMN IF EXISTS duration_per_massage;
ALTER TABLE public.bookings DROP COLUMN IF EXISTS preferred_therapists;
ALTER TABLE public.bookings DROP COLUMN IF EXISTS company_name;
ALTER TABLE public.bookings DROP COLUMN IF EXISTS corporate_contact_name;
ALTER TABLE public.bookings DROP COLUMN IF EXISTS corporate_contact_email;
ALTER TABLE public.bookings DROP COLUMN IF EXISTS corporate_contact_phone;
ALTER TABLE public.bookings DROP COLUMN IF EXISTS billing_address;
ALTER TABLE public.bookings DROP COLUMN IF EXISTS po_number;
ALTER TABLE public.bookings DROP COLUMN IF EXISTS urgency;
ALTER TABLE public.bookings DROP COLUMN IF EXISTS setup_requirements;
ALTER TABLE public.bookings DROP COLUMN IF EXISTS special_requirements;
ALTER TABLE public.bookings DROP COLUMN IF EXISTS preferred_time_range;

-- Quote workflow fields (replaced by quotes table)
ALTER TABLE public.bookings DROP COLUMN IF EXISTS quote_only;
ALTER TABLE public.bookings DROP COLUMN IF EXISTS quote_amount;
ALTER TABLE public.bookings DROP COLUMN IF EXISTS quote_valid_until;
ALTER TABLE public.bookings DROP COLUMN IF EXISTS quote_sent_at;
ALTER TABLE public.bookings DROP COLUMN IF EXISTS quote_accepted_at;
ALTER TABLE public.bookings DROP COLUMN IF EXISTS original_quote_id;

-- Quote invoicing fields (handled at quote level)
ALTER TABLE public.bookings DROP COLUMN IF EXISTS invoice_number;
ALTER TABLE public.bookings DROP COLUMN IF EXISTS invoice_date;
ALTER TABLE public.bookings DROP COLUMN IF EXISTS invoice_sent_at;
ALTER TABLE public.bookings DROP COLUMN IF EXISTS paid_date;

-- Remove unnecessary constraints that may reference dropped fields
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_weekly_payment_id_fkey;
ALTER TABLE public.bookings DROP COLUMN IF EXISTS weekly_payment_id;

-- 2. KEEP these fields (CRITICAL for CC booking functionality):
-- ✅ discount_amount - Used by booking platform discount system
-- ✅ tax_rate_amount - GST calculations for all bookings
-- ✅ net_price - Final calculated price after discounts/tax
-- ✅ discount_code - Tracks which discount was applied
-- ✅ gift_card_code - Gift card redemption system
-- ✅ gift_card_amount - Gift card value applied
-- ✅ service_acknowledgement - Terms acceptance
-- ✅ terms_acceptance - Service acknowledgement
-- ✅ payment_method - Card/invoice/bank transfer
-- ✅ All core booking fields (address, notes, therapist_id, etc.)

-- 3. Update booking status constraint to remove quote-specific statuses
-- Remove quote statuses since quotes now have their own workflow
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check
    CHECK (status::text = ANY (ARRAY[
        'requested'::character varying,
        'confirmed'::character varying,
        'completed'::character varying,
        'cancelled'::character varying,
        'declined'::character varying,
        'timeout_reassigned'::character varying,
        'seeking_alternate'::character varying
    ]::text[]));

-- 4. Add documentation
COMMENT ON TABLE public.bookings IS 'Clean bookings table - execution tracking only. Quote data moved to quotes table.';
COMMENT ON COLUMN public.bookings.parent_quote_id IS 'Links to quotes table for multi-day events (nullable)';
COMMENT ON COLUMN public.bookings.quote_day_number IS 'Day number within parent quote (1, 2, 3, etc.)';
COMMENT ON COLUMN public.bookings.discount_amount IS 'KEEP: Used by CC booking discount system';
COMMENT ON COLUMN public.bookings.net_price IS 'KEEP: Final price after discounts, gift cards, and tax';
COMMENT ON COLUMN public.bookings.gift_card_amount IS 'KEEP: Gift card value applied to booking';

-- 5. Verify cleanup by showing remaining columns
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'bookings'
ORDER BY ordinal_position;

-- Success message
SELECT 'Bookings table cleaned successfully!' as message,
       'Removed quote-specific fields while preserving all CC booking functionality' as details;