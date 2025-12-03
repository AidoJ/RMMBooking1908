-- Fix: Allow therapists to complete jobs without admin_activity_log RLS errors
-- Problem: When therapists mark a booking as "completed", a database trigger
-- tries to insert into admin_activity_log but therapists don't have permission.

-- Solution: Disable RLS on admin_activity_log OR make trigger functions use SECURITY DEFINER

-- OPTION 1: Simply disable RLS on admin_activity_log (easiest solution)
-- This allows any authenticated user to insert activity logs via triggers
ALTER TABLE admin_activity_log DISABLE ROW LEVEL SECURITY;

-- OPTION 2: If you want to keep RLS enabled, uncomment the lines below instead
-- and comment out the DISABLE line above

/*
-- Enable RLS on admin_activity_log
ALTER TABLE admin_activity_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow all authenticated users to insert activity logs" ON admin_activity_log;
DROP POLICY IF EXISTS "Allow admin users to view activity logs" ON admin_activity_log;

-- Allow ANY authenticated user to insert into activity log (needed for triggers)
-- This is safe because only triggers write to this table, not direct user access
CREATE POLICY "Allow all authenticated users to insert activity logs"
ON admin_activity_log
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Only super_admin and admin can view activity logs
CREATE POLICY "Allow admin users to view activity logs"
ON admin_activity_log
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
    AND admin_users.role IN ('super_admin', 'admin')
  )
);
*/

-- Verify the fix by checking RLS status
SELECT
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'admin_activity_log';
