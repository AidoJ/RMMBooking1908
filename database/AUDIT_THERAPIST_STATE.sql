-- ============================================================================
-- COMPREHENSIVE THERAPIST AUDIT - Single Query with All Results
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Create a comprehensive audit report
SELECT
  '1. THERAPIST PROFILES COUNT' as section,
  COUNT(*) as total_therapists,
  COUNT(user_id) as has_user_id_set,
  COUNT(auth_id) as has_auth_id_set,
  COUNT(CASE WHEN user_id IS NOT NULL AND auth_id IS NULL THEN 1 END) as only_user_id,
  COUNT(CASE WHEN user_id IS NULL AND auth_id IS NOT NULL THEN 1 END) as only_auth_id,
  COUNT(CASE WHEN user_id IS NOT NULL AND auth_id IS NOT NULL THEN 1 END) as both_set,
  COUNT(CASE WHEN user_id IS NULL AND auth_id IS NULL THEN 1 END) as neither_set
FROM therapist_profiles

UNION ALL

SELECT
  '2. ADMIN USERS WITH THERAPIST ROLE' as section,
  COUNT(*)::bigint,
  COUNT(auth_id)::bigint,
  NULL, NULL, NULL, NULL, NULL
FROM admin_users
WHERE role = 'therapist'

UNION ALL

SELECT
  '3. AUTH USERS WITH THERAPIST METADATA' as section,
  COUNT(*)::bigint,
  NULL, NULL, NULL, NULL, NULL, NULL
FROM auth.users
WHERE raw_user_meta_data->>'role' = 'therapist'

UNION ALL

SELECT
  '4. RLS STATUS - therapist_profiles' as section,
  CASE WHEN rowsecurity THEN 1 ELSE 0 END::bigint,
  NULL, NULL, NULL, NULL, NULL, NULL
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'therapist_profiles'

UNION ALL

SELECT
  '5. RLS STATUS - therapist_availability' as section,
  CASE WHEN rowsecurity THEN 1 ELSE 0 END::bigint,
  NULL, NULL, NULL, NULL, NULL, NULL
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'therapist_availability'

UNION ALL

SELECT
  '6. RLS STATUS - therapist_services' as section,
  CASE WHEN rowsecurity THEN 1 ELSE 0 END::bigint,
  NULL, NULL, NULL, NULL, NULL, NULL
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'therapist_services'

UNION ALL

SELECT
  '7. RLS STATUS - therapist_time_off' as section,
  CASE WHEN rowsecurity THEN 1 ELSE 0 END::bigint,
  NULL, NULL, NULL, NULL, NULL, NULL
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'therapist_time_off'

UNION ALL

SELECT
  '8. RLS POLICIES COUNT' as section,
  COUNT(*)::bigint,
  NULL, NULL, NULL, NULL, NULL, NULL
FROM pg_policies
WHERE schemaname = 'public' AND tablename LIKE 'therapist%';
