-- ============================================================================
-- FIX THERAPIST PROFILE UPDATE RLS POLICY
-- Date: 2025-10-18
-- Description: Allow therapists to update their own profile information
-- ============================================================================

-- Enable RLS on therapist_profiles (in case it wasn't already enabled)
ALTER TABLE public.therapist_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "therapist_profiles_update_own" ON public.therapist_profiles;
DROP POLICY IF EXISTS "therapists_can_update_own_profile" ON public.therapist_profiles;

-- Create policy allowing therapists to update their own profile
-- Therapists can update their profile if their user_id matches auth.uid()
CREATE POLICY "therapists_can_update_own_profile"
ON public.therapist_profiles
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Note: Admin policies should already exist from the admin panel setup
-- This policy allows therapists to update:
-- - home_address
-- - latitude, longitude
-- - service_radius_km
-- - service_area_polygon
-- - address_verified
-- - and other profile fields

COMMENT ON POLICY "therapists_can_update_own_profile" ON public.therapist_profiles
IS 'Allows therapists to update their own profile information including service area';
