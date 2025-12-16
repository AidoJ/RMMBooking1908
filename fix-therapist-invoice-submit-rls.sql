-- Quick fix: Allow therapists to submit invoices to therapist_payments table
-- Run this in Supabase SQL Editor

-- Drop existing policies if they exist (safe to run even if they don't exist)
DROP POLICY IF EXISTS "therapists_can_insert_own_invoices" ON therapist_payments;
DROP POLICY IF EXISTS "therapists_can_view_own_payments" ON therapist_payments;

-- Allow therapists to INSERT their own invoices
CREATE POLICY "therapists_can_insert_own_invoices"
ON therapist_payments
FOR INSERT
TO authenticated
WITH CHECK (
  therapist_id IN (
    SELECT id FROM therapist_profiles
    WHERE user_id = auth.uid()
  )
);

-- Allow therapists to SELECT their own payments
CREATE POLICY "therapists_can_view_own_payments"
ON therapist_payments
FOR SELECT
TO authenticated
USING (
  therapist_id IN (
    SELECT id FROM therapist_profiles
    WHERE user_id = auth.uid()
  )
);

-- Verify the policies work
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename = 'therapist_payments';
