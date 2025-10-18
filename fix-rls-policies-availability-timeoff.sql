-- RLS Policies for Therapist Availability and Time Off Tables
-- Run this in your Supabase SQL Editor

-- These policies allow the anon role (used by admin panel proxy) to manage availability and time off

-- ============================================
-- THERAPIST AVAILABILITY POLICIES
-- ============================================

-- Drop existing policies first (ignore errors if they don't exist)
DROP POLICY IF EXISTS "anon_can_select_availability" ON public.therapist_availability;
DROP POLICY IF EXISTS "anon_can_insert_availability" ON public.therapist_availability;
DROP POLICY IF EXISTS "anon_can_update_availability" ON public.therapist_availability;
DROP POLICY IF EXISTS "anon_can_delete_availability" ON public.therapist_availability;

-- Allow anon to select availability
CREATE POLICY "anon_can_select_availability"
ON public.therapist_availability
FOR SELECT
TO anon
USING (true);

-- Allow anon to insert availability
CREATE POLICY "anon_can_insert_availability"
ON public.therapist_availability
FOR INSERT
TO anon
WITH CHECK (true);

-- Allow anon to update availability
CREATE POLICY "anon_can_update_availability"
ON public.therapist_availability
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- Allow anon to delete availability
CREATE POLICY "anon_can_delete_availability"
ON public.therapist_availability
FOR DELETE
TO anon
USING (true);

-- ============================================
-- THERAPIST TIME OFF POLICIES
-- ============================================

-- Drop existing policies first (ignore errors if they don't exist)
DROP POLICY IF EXISTS "anon_can_select_timeoff" ON public.therapist_time_off;
DROP POLICY IF EXISTS "anon_can_insert_timeoff" ON public.therapist_time_off;
DROP POLICY IF EXISTS "anon_can_update_timeoff" ON public.therapist_time_off;
DROP POLICY IF EXISTS "anon_can_delete_timeoff" ON public.therapist_time_off;

-- Allow anon to select time off
CREATE POLICY "anon_can_select_timeoff"
ON public.therapist_time_off
FOR SELECT
TO anon
USING (true);

-- Allow anon to insert time off
CREATE POLICY "anon_can_insert_timeoff"
ON public.therapist_time_off
FOR INSERT
TO anon
WITH CHECK (true);

-- Allow anon to update time off
CREATE POLICY "anon_can_update_timeoff"
ON public.therapist_time_off
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- Allow anon to delete time off
CREATE POLICY "anon_can_delete_timeoff"
ON public.therapist_time_off
FOR DELETE
TO anon
USING (true);

-- Verify policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename IN ('therapist_availability', 'therapist_time_off')
ORDER BY tablename, policyname;
