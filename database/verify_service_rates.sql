-- ============================================================================
-- VERIFY SERVICE-SPECIFIC RATES DATA
-- Run this in Supabase SQL Editor to check your service rates
-- ============================================================================

-- 1. Check if therapist_service_rates table exists and has data
SELECT
  'therapist_service_rates' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN is_active = true THEN 1 END) as active_records
FROM therapist_service_rates;

-- 2. View all active service-specific rates with therapist and service names
SELECT
  tsr.id,
  tp.first_name || ' ' || tp.last_name as therapist_name,
  tp.id as therapist_id,
  s.name as service_name,
  s.id as service_id,
  tsr.normal_rate,
  tsr.afterhours_rate,
  tp.hourly_rate as profile_normal_rate,
  tp.afterhours_rate as profile_afterhours_rate,
  tsr.notes,
  tsr.created_at
FROM therapist_service_rates tsr
JOIN therapist_profiles tp ON tsr.therapist_id = tp.id
JOIN services s ON tsr.service_id = s.id
WHERE tsr.is_active = true
ORDER BY tp.last_name, s.name;

-- 3. Check for Kate Pascoe specifically (since that was mentioned in console logs)
SELECT
  tsr.id,
  tp.first_name || ' ' || tp.last_name as therapist_name,
  tp.id as therapist_id,
  s.name as service_name,
  s.id as service_id,
  tsr.normal_rate as service_normal_rate,
  tsr.afterhours_rate as service_afterhours_rate,
  tp.hourly_rate as profile_normal_rate,
  tp.afterhours_rate as profile_afterhours_rate,
  tsr.is_active
FROM therapist_service_rates tsr
JOIN therapist_profiles tp ON tsr.therapist_id = tp.id
JOIN services s ON tsr.service_id = s.id
WHERE tp.first_name = 'Kate' AND tp.last_name = 'Pascoe';

-- 4. Show therapist IDs and service IDs for debugging
SELECT
  'Therapists' as type,
  tp.id,
  tp.first_name || ' ' || tp.last_name as name
FROM therapist_profiles tp
ORDER BY tp.last_name;

SELECT
  'Services' as type,
  s.id,
  s.name
FROM services s
ORDER BY s.name;
