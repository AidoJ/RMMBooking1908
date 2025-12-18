-- Inspect SECURITY DEFINER views to understand what they do
-- Run this in Supabase SQL Editor to see view definitions

-- View 1: booking_pricing_summary
SELECT
  'booking_pricing_summary' as view_name,
  pg_get_viewdef('booking_pricing_summary', true) as definition;

-- View 2: therapist_performance
SELECT
  'therapist_performance' as view_name,
  pg_get_viewdef('therapist_performance', true) as definition;

-- View 3: recent_activity
SELECT
  'recent_activity' as view_name,
  pg_get_viewdef('recent_activity', true) as definition;

-- View 4: dashboard_metrics
SELECT
  'dashboard_metrics' as view_name,
  pg_get_viewdef('dashboard_metrics', true) as definition;

-- Check if they're materialized views (store data) or regular views (don't store data)
SELECT
  schemaname,
  matviewname as name,
  'materialized' as type
FROM pg_matviews
WHERE schemaname = 'public'
  AND matviewname IN ('booking_pricing_summary', 'therapist_performance', 'recent_activity', 'dashboard_metrics')
UNION ALL
SELECT
  schemaname,
  viewname as name,
  'regular' as type
FROM pg_views
WHERE schemaname = 'public'
  AND viewname IN ('booking_pricing_summary', 'therapist_performance', 'recent_activity', 'dashboard_metrics');
