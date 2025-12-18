-- Fix SECURITY DEFINER views by converting to SECURITY INVOKER
-- This removes the security warning while keeping views functional
-- Run this in Supabase SQL Editor

-- 1. booking_pricing_summary
DROP VIEW IF EXISTS booking_pricing_summary;
CREATE VIEW booking_pricing_summary
WITH (security_invoker = true)
AS
SELECT
  b.id,
  b.booking_id,
  b.price AS gross_price,
  b.discount_amount,
  b.gift_card_amount,
  b.tax_rate_amount,
  b.net_price,
  b.price - COALESCE(b.discount_amount, 0::numeric) AS price_after_discount,
  (b.price - COALESCE(b.discount_amount, 0::numeric)) * (COALESCE(b.tax_rate_amount, 0::numeric) / 100::numeric) AS calculated_tax,
  b.price - COALESCE(b.discount_amount, 0::numeric) - COALESCE(b.gift_card_amount, 0::numeric) AS amount_due,
  dc.code AS discount_code_used,
  dc.discount_type,
  dc.discount_value AS discount_code_value,
  gc.code AS gift_card_used,
  gc.current_balance AS gift_card_balance
FROM bookings b
  LEFT JOIN discount_codes dc ON b.discount_code::text = dc.code::text
  LEFT JOIN gift_cards gc ON b.gift_card_code::text = gc.code::text;

-- 2. dashboard_metrics
DROP VIEW IF EXISTS dashboard_metrics;
CREATE VIEW dashboard_metrics
WITH (security_invoker = true)
AS
SELECT
  count(CASE WHEN date(created_at) = CURRENT_DATE THEN 1 ELSE NULL::integer END) AS today_bookings,
  count(CASE WHEN date(created_at) = CURRENT_DATE AND status::text = 'confirmed'::text THEN 1 ELSE NULL::integer END) AS today_confirmed,
  COALESCE(sum(CASE WHEN date(created_at) = CURRENT_DATE AND status::text = 'confirmed'::text THEN price ELSE 0::numeric END), 0::numeric) AS today_revenue,
  count(CASE WHEN created_at >= date_trunc('week'::text, CURRENT_DATE::timestamp with time zone) THEN 1 ELSE NULL::integer END) AS week_bookings,
  COALESCE(sum(CASE WHEN created_at >= date_trunc('week'::text, CURRENT_DATE::timestamp with time zone) AND status::text = 'confirmed'::text THEN price ELSE 0::numeric END), 0::numeric) AS week_revenue,
  count(CASE WHEN created_at >= date_trunc('month'::text, CURRENT_DATE::timestamp with time zone) THEN 1 ELSE NULL::integer END) AS month_bookings,
  COALESCE(sum(CASE WHEN created_at >= date_trunc('month'::text, CURRENT_DATE::timestamp with time zone) AND status::text = 'confirmed'::text THEN price ELSE 0::numeric END), 0::numeric) AS month_revenue,
  avg(EXTRACT(epoch FROM therapist_response_time - created_at) / 60::numeric) AS avg_response_minutes
FROM bookings
WHERE created_at >= (CURRENT_DATE - '30 days'::interval);

-- 3. recent_activity
DROP VIEW IF EXISTS recent_activity;
CREATE VIEW recent_activity
WITH (security_invoker = true)
AS
SELECT
  b.booking_id,
  (b.first_name::text || ' '::text) || b.last_name::text AS customer_name,
  (tp.first_name::text || ' '::text) || tp.last_name::text AS therapist_name,
  b.status,
  b.booking_time,
  b.created_at,
  s.name AS service_name,
  b.price
FROM bookings b
  LEFT JOIN therapist_profiles tp ON b.therapist_id = tp.id
  LEFT JOIN services s ON b.service_id = s.id
ORDER BY b.created_at DESC
LIMIT 50;

-- 4. therapist_performance
DROP VIEW IF EXISTS therapist_performance;
CREATE VIEW therapist_performance
WITH (security_invoker = true)
AS
SELECT
  tp.id,
  (tp.first_name::text || ' '::text) || tp.last_name::text AS therapist_name,
  count(b.id) AS total_bookings,
  count(CASE WHEN b.status::text = 'confirmed'::text THEN 1 ELSE NULL::integer END) AS confirmed_bookings,
  count(CASE WHEN b.status::text = 'declined'::text THEN 1 ELSE NULL::integer END) AS declined_bookings,
  CASE
    WHEN count(b.id) > 0 THEN round(count(CASE WHEN b.status::text = 'confirmed'::text THEN 1 ELSE NULL::integer END)::numeric / count(b.id)::numeric * 100::numeric, 2)
    ELSE 0::numeric
  END AS acceptance_rate,
  COALESCE(sum(CASE WHEN b.status::text = 'confirmed'::text THEN b.therapist_fee ELSE 0::numeric END), 0::numeric) AS total_earnings,
  avg(CASE WHEN b.therapist_response_time IS NOT NULL THEN EXTRACT(epoch FROM b.therapist_response_time - b.created_at) / 60::numeric ELSE NULL::numeric END) AS avg_response_minutes,
  count(CASE WHEN b.created_at >= (CURRENT_DATE - '30 days'::interval) THEN 1 ELSE NULL::integer END) AS bookings_last_30_days
FROM therapist_profiles tp
  LEFT JOIN bookings b ON tp.id = b.therapist_id
WHERE tp.is_active = true
GROUP BY tp.id, tp.first_name, tp.last_name
ORDER BY (COALESCE(sum(CASE WHEN b.status::text = 'confirmed'::text THEN b.therapist_fee ELSE 0::numeric END), 0::numeric)) DESC;

-- Verify the fix
SELECT
  viewname,
  CASE
    WHEN viewowner::regrole::text = current_user THEN 'SECURITY INVOKER'
    ELSE 'SECURITY DEFINER'
  END as security_type
FROM pg_views
WHERE schemaname = 'public'
  AND viewname IN ('booking_pricing_summary', 'dashboard_metrics', 'recent_activity', 'therapist_performance')
ORDER BY viewname;

-- Expected result: All should show SECURITY INVOKER
