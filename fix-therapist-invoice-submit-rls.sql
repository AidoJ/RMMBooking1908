-- Fix: Allow therapists to submit invoices without RLS errors
-- Problem: When therapists click "Submit Invoice", they get 401 error
-- trying to insert/update therapist_payments table

-- Enable RLS on therapist_payments (if not already enabled)
ALTER TABLE therapist_payments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Therapists can insert their own payment records" ON therapist_payments;
DROP POLICY IF EXISTS "Therapists can update their own payment records" ON therapist_payments;
DROP POLICY IF EXISTS "Therapists can view their own payment records" ON therapist_payments;
DROP POLICY IF EXISTS "Admins can view all payment records" ON therapist_payments;
DROP POLICY IF EXISTS "Admins can update all payment records" ON therapist_payments;

-- Policy 1: Allow therapists to INSERT their own payment records
-- When submitting a new invoice
CREATE POLICY "Therapists can insert their own payment records"
ON therapist_payments
FOR INSERT
TO authenticated
WITH CHECK (
  -- Check if the user is a therapist and the therapist_id matches their profile
  EXISTS (
    SELECT 1 FROM therapist_profiles
    WHERE therapist_profiles.id = therapist_payments.therapist_id
    AND therapist_profiles.user_id = auth.uid()
  )
);

-- Policy 2: Allow therapists to UPDATE their own payment records
-- When editing draft invoices or resubmitting
CREATE POLICY "Therapists can update their own payment records"
ON therapist_payments
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM therapist_profiles
    WHERE therapist_profiles.id = therapist_payments.therapist_id
    AND therapist_profiles.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM therapist_profiles
    WHERE therapist_profiles.id = therapist_payments.therapist_id
    AND therapist_profiles.user_id = auth.uid()
  )
);

-- Policy 3: Allow therapists to VIEW their own payment records
CREATE POLICY "Therapists can view their own payment records"
ON therapist_payments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM therapist_profiles
    WHERE therapist_profiles.id = therapist_payments.therapist_id
    AND therapist_profiles.user_id = auth.uid()
  )
);

-- Policy 4: Allow admins to view all payment records
CREATE POLICY "Admins can view all payment records"
ON therapist_payments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
    AND admin_users.role IN ('super_admin', 'admin')
  )
);

-- Policy 5: Allow admins to update all payment records
-- For review, approval, payment processing
CREATE POLICY "Admins can update all payment records"
ON therapist_payments
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
    AND admin_users.role IN ('super_admin', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
    AND admin_users.role IN ('super_admin', 'admin')
  )
);

-- Verify the policies are created
SELECT
  schemaname,
  tablename,
  policyname,
  cmd as command,
  qual as using_expression,
  with_check as check_expression
FROM pg_policies
WHERE tablename = 'therapist_payments'
ORDER BY policyname;
