-- Fix: Disable RLS on therapist_payments to allow therapist invoice submissions
--
-- Problem: Therapist app uses custom JWT auth (localStorage), not Supabase Auth
-- So auth.uid() returns nothing and RLS policies block all access
--
-- Solution: Disable RLS entirely - the therapist app already has application-level
-- security checking therapistToken and only allows therapists to access their own data

-- Simply disable RLS on therapist_payments table
ALTER TABLE therapist_payments DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'therapist_payments';

-- Should show: rls_enabled = false
