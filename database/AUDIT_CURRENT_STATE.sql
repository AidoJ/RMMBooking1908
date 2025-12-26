-- ============================================================================
-- AUDIT CURRENT DATABASE STATE
-- Run this in Supabase SQL Editor to understand what data exists
-- ============================================================================

-- 1. Check if any therapists exist and how they're authenticated
SELECT
  'therapist_profiles' as table_name,
  COUNT(*) as total_records,
  COUNT(user_id) as has_user_id,
  COUNT(auth_id) as has_auth_id,
  COUNT(CASE WHEN user_id IS NOT NULL AND auth_id IS NULL THEN 1 END) as old_auth_only,
  COUNT(CASE WHEN user_id IS NULL AND auth_id IS NOT NULL THEN 1 END) as new_auth_only,
  COUNT(CASE WHEN user_id IS NOT NULL AND auth_id IS NOT NULL THEN 1 END) as both_set
FROM therapist_profiles;

-- 2. Check if admin_users table has therapists (old system)
SELECT
  'admin_users with role=therapist' as check_type,
  COUNT(*) as count,
  COUNT(auth_id) as has_auth_id_link
FROM admin_users
WHERE role = 'therapist';

-- 3. Check auth.users table for therapists
SELECT
  'auth.users' as table_name,
  COUNT(*) as total_auth_users,
  COUNT(CASE WHEN raw_user_meta_data->>'role' = 'therapist' THEN 1 END) as therapist_role_in_metadata
FROM auth.users;

-- 4. Check which tables have RLS enabled
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'therapist_profiles',
    'therapist_availability',
    'therapist_services',
    'therapist_time_off',
    'therapist_payments',
    'therapist_service_rates',
    'bookings'
  )
ORDER BY tablename;

-- 5. Check existing RLS policies on therapist tables
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename LIKE 'therapist%'
ORDER BY tablename, policyname;

-- 6. Sample therapist data to understand current structure
SELECT
  id,
  first_name,
  last_name,
  email,
  user_id,
  auth_id,
  is_active,
  created_at
FROM therapist_profiles
LIMIT 5;

-- 7. Check if there are orphaned records
SELECT
  'Profiles with user_id but no matching admin_user' as issue,
  COUNT(*) as count
FROM therapist_profiles tp
LEFT JOIN admin_users au ON tp.user_id = au.id
WHERE tp.user_id IS NOT NULL AND au.id IS NULL

UNION ALL

SELECT
  'Profiles with auth_id but no matching auth.user' as issue,
  COUNT(*) as count
FROM therapist_profiles tp
LEFT JOIN auth.users au ON tp.auth_id = au.id
WHERE tp.auth_id IS NOT NULL AND au.id IS NULL;
