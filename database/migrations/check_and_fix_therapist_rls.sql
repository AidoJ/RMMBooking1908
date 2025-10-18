-- ============================================================================
-- CHECK AND FIX ALL THERAPIST PROFILE RLS POLICIES
-- Date: 2025-10-18
-- Description: Complete RLS setup for therapist_profiles table
-- ============================================================================

-- Enable RLS
ALTER TABLE public.therapist_profiles ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies to start fresh
DROP POLICY IF EXISTS "therapist_profiles_select_own" ON public.therapist_profiles;
DROP POLICY IF EXISTS "therapist_profiles_update_own" ON public.therapist_profiles;
DROP POLICY IF EXISTS "therapists_can_update_own_profile" ON public.therapist_profiles;
DROP POLICY IF EXISTS "therapists_can_view_own_profile" ON public.therapist_profiles;
DROP POLICY IF EXISTS "admin_all_therapist_profiles" ON public.therapist_profiles;

-- 1. Therapists can SELECT (view) their own profile
CREATE POLICY "therapists_can_view_own_profile"
ON public.therapist_profiles
FOR SELECT
USING (user_id = auth.uid());

-- 2. Therapists can UPDATE their own profile
CREATE POLICY "therapists_can_update_own_profile"
ON public.therapist_profiles
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 3. Admins have full access (SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY "admin_all_therapist_profiles"
ON public.therapist_profiles
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Verify policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'therapist_profiles'
ORDER BY policyname;
