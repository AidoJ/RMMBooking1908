-- Migrate Therapist App to Supabase Auth
-- This script creates Supabase auth users for therapists and sets up proper RLS

-- Step 1: Create auth.users for each therapist in admin_users with role='therapist'
-- NOTE: Run this in Supabase SQL Editor with admin privileges

-- For each therapist in admin_users, create a Supabase auth user
-- You'll need to do this manually in Supabase Dashboard:
-- 1. Go to Authentication → Users
-- 2. Click "Add user" → "Create new user"
-- 3. For each therapist, enter:
--    - Email: (from admin_users.email)
--    - Password: (create a temporary password, they can change it later)
--    - Auto Confirm User: YES
-- 4. After creating, note the auth.users.id
-- 5. Update therapist_profiles.user_id with the new auth.users.id

-- Step 2: Enable RLS on critical tables
ALTER TABLE therapist_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE therapist_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Step 3: Create RLS policies for therapist_payments

-- Allow therapists to INSERT their own payment records
CREATE POLICY "Therapists can insert their own payment records"
ON therapist_payments
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM therapist_profiles
    WHERE therapist_profiles.id = therapist_payments.therapist_id
    AND therapist_profiles.user_id = auth.uid()
  )
);

-- Allow therapists to UPDATE their own payment records
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

-- Allow therapists to VIEW their own payment records
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

-- Allow admins to view all payment records
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

-- Allow admins to update all payment records
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

-- Step 4: Create RLS policies for therapist_profiles

-- Allow therapists to VIEW their own profile
CREATE POLICY "Therapists can view their own profile"
ON therapist_profiles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Allow therapists to UPDATE their own profile
CREATE POLICY "Therapists can update their own profile"
ON therapist_profiles
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Allow admins to view all profiles
CREATE POLICY "Admins can view all therapist profiles"
ON therapist_profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
    AND admin_users.role IN ('super_admin', 'admin')
  )
);

-- Allow admins to update all profiles
CREATE POLICY "Admins can update all therapist profiles"
ON therapist_profiles
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

-- Step 5: Create RLS policies for bookings

-- Allow therapists to VIEW their assigned bookings
CREATE POLICY "Therapists can view their assigned bookings"
ON bookings
FOR SELECT
TO authenticated
USING (
  therapist_id IN (
    SELECT id FROM therapist_profiles WHERE user_id = auth.uid()
  )
  OR
  alternate_therapist_id IN (
    SELECT id FROM therapist_profiles WHERE user_id = auth.uid()
  )
  OR
  responding_therapist_id IN (
    SELECT id FROM therapist_profiles WHERE user_id = auth.uid()
  )
);

-- Allow therapists to UPDATE their assigned bookings (status, notes, etc.)
CREATE POLICY "Therapists can update their assigned bookings"
ON bookings
FOR UPDATE
TO authenticated
USING (
  therapist_id IN (
    SELECT id FROM therapist_profiles WHERE user_id = auth.uid()
  )
  OR
  alternate_therapist_id IN (
    SELECT id FROM therapist_profiles WHERE user_id = auth.uid()
  )
  OR
  responding_therapist_id IN (
    SELECT id FROM therapist_profiles WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  therapist_id IN (
    SELECT id FROM therapist_profiles WHERE user_id = auth.uid()
  )
  OR
  alternate_therapist_id IN (
    SELECT id FROM therapist_profiles WHERE user_id = auth.uid()
  )
  OR
  responding_therapist_id IN (
    SELECT id FROM therapist_profiles WHERE user_id = auth.uid()
  )
);

-- Allow admins to view all bookings
CREATE POLICY "Admins can view all bookings"
ON bookings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
    AND admin_users.role IN ('super_admin', 'admin')
  )
);

-- Allow admins to update all bookings
CREATE POLICY "Admins can update all bookings"
ON bookings
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

-- Verify all policies are created
SELECT
  schemaname,
  tablename,
  policyname,
  cmd as command
FROM pg_policies
WHERE tablename IN ('therapist_payments', 'therapist_profiles', 'bookings')
ORDER BY tablename, policyname;

-- MANUAL STEPS REQUIRED:
-- 1. Create Supabase auth users for each therapist via Dashboard
-- 2. Update therapist_profiles.user_id with the new auth.users.id
-- 3. Test login with new Supabase Auth credentials
-- 4. Delete old admin_users records with role='therapist' (after confirming everything works)
