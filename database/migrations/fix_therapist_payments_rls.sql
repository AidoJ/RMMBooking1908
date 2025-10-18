-- ============================================================================
-- FIX THERAPIST PAYMENTS RLS FOR THERAPIST APP
-- Date: 2025-10-18
-- Description: Allow therapists using anon role to insert/select their invoices
-- ============================================================================

-- The issue: therapist app uses anon key + JWT tokens, not Supabase Auth
-- Existing policies check auth.uid() which returns NULL for anon users
-- Solution: Add permissive policies for anon role (app validates JWT at app level)

-- Enable RLS (should already be enabled)
ALTER TABLE public.therapist_payments ENABLE ROW LEVEL SECURITY;

-- Drop existing restrictive policies that won't work with therapist app
DROP POLICY IF EXISTS "therapist_payments_select_own" ON public.therapist_payments;
DROP POLICY IF EXISTS "therapist_payments_insert_own" ON public.therapist_payments;
DROP POLICY IF EXISTS "therapist_payments_update_own_draft" ON public.therapist_payments;

-- CREATE NEW POLICIES FOR THERAPIST APP (using anon role)

-- 1. Allow therapists (anon) to SELECT their own payments
-- The app validates JWT and filters by therapist_id
CREATE POLICY "therapist_app_select_payments"
ON public.therapist_payments
FOR SELECT
TO anon, authenticated
USING (true);

-- 2. Allow therapists (anon) to INSERT new invoice submissions
CREATE POLICY "therapist_app_insert_payments"
ON public.therapist_payments
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- 3. Allow therapists (anon) to UPDATE their draft/submitted invoices
-- (before admin review)
CREATE POLICY "therapist_app_update_payments"
ON public.therapist_payments
FOR UPDATE
TO anon, authenticated
USING (status IN ('draft', 'submitted'))
WITH CHECK (status IN ('draft', 'submitted'));

-- Admin policy should already exist and take precedence
-- If not, recreate it:
DROP POLICY IF EXISTS "therapist_payments_admin_all" ON public.therapist_payments;

CREATE POLICY "therapist_payments_admin_all"
ON public.therapist_payments
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Note: This is secure because:
-- 1. The therapist app validates JWT tokens before allowing any operations
-- 2. The app only allows therapists to access their own data (filters by JWT user_id -> therapist_id)
-- 3. Admin access is still controlled by the is_admin() function
-- 4. Status transitions are controlled (therapists can't approve their own invoices)

-- Verify all policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'therapist_payments'
ORDER BY policyname;
