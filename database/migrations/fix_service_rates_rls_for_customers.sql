-- ============================================================================
-- FIX RLS POLICY FOR THERAPIST SERVICE RATES - ALLOW CUSTOMER ACCESS
-- Date: 2025-12-08
-- Problem: Customers booking through portal are anonymous (not authenticated)
--          Current RLS policy only allows authenticated users to read rates
--          This blocks customer portal from getting service-specific rates
-- Solution: Allow both authenticated AND anonymous users to SELECT rates
-- ============================================================================

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "therapist_service_rates_select_all" ON public.therapist_service_rates;

-- Create new SELECT policy that allows both authenticated AND anonymous users
CREATE POLICY "therapist_service_rates_select_all"
  ON public.therapist_service_rates
  FOR SELECT
  TO authenticated, anon  -- ✅ NOW ALLOWS BOTH authenticated users AND anonymous customers
  USING (true);

-- Verify the policy was created
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'therapist_service_rates'
ORDER BY policyname;
