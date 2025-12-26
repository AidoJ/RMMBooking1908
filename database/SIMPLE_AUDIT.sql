-- ============================================================================
-- SIMPLE AUDIT - Run each query ONE AT A TIME in Supabase SQL Editor
-- Copy/paste and run individually, share each result
-- ============================================================================

-- QUERY 1: How many therapist profiles exist and which fields are populated?
-- Copy and run this first:
SELECT
  COUNT(*) as total_therapists,
  COUNT(user_id) as has_user_id,
  COUNT(auth_id) as has_auth_id,
  COUNT(CASE WHEN user_id IS NOT NULL AND auth_id IS NULL THEN 1 END) as only_user_id,
  COUNT(CASE WHEN user_id IS NULL AND auth_id IS NOT NULL THEN 1 END) as only_auth_id,
  COUNT(CASE WHEN user_id IS NOT NULL AND auth_id IS NOT NULL THEN 1 END) as both_set
FROM therapist_profiles;

-- QUERY 2: Is RLS enabled on therapist tables?
-- Copy and run this second:
SELECT
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('therapist_profiles', 'therapist_availability', 'therapist_services', 'therapist_time_off', 'therapist_payments')
ORDER BY tablename;

-- QUERY 3: Sample of therapist data (first 3 records)
-- Copy and run this third:
SELECT
  id,
  first_name,
  last_name,
  email,
  user_id,
  auth_id,
  is_active
FROM therapist_profiles
ORDER BY created_at DESC
LIMIT 3;
