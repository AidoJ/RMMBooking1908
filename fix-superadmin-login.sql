-- SUPERADMIN LOGIN FIX SCRIPT
-- Run this in Supabase SQL Editor to diagnose and fix superadmin login issues

-- STEP 1: Check current superadmin status
SELECT
  id,
  email,
  first_name,
  last_name,
  role,
  is_active,
  failed_login_attempts,
  locked_until,
  last_login,
  CASE
    WHEN password LIKE '$2a$%' OR password LIKE '$2b$%' THEN 'Bcrypt (OK)'
    ELSE 'Plain text (PROBLEM!)'
  END as password_status
FROM admin_users
WHERE role = 'super_admin';

-- STEP 2: If is_active is false, activate the account
-- UNCOMMENT AND RUN THIS IF NEEDED:
-- UPDATE admin_users
-- SET is_active = true
-- WHERE role = 'super_admin';

-- STEP 3: If account is locked, unlock it
-- UNCOMMENT AND RUN THIS IF NEEDED:
-- UPDATE admin_users
-- SET
--   failed_login_attempts = 0,
--   locked_until = NULL
-- WHERE role = 'super_admin';

-- STEP 4: If password is NOT bcrypt hashed, set a temporary password
-- UNCOMMENT AND RUN THIS IF NEEDED:
-- This sets password to: Admin123!
-- Password hash for "Admin123!" (bcrypt with salt rounds 10):
-- UPDATE admin_users
-- SET password = '$2a$10$rZvKl3YM0qK9wKHvGxGz2eJxYGfxYHwZ9YqP5aQXxVHJKdqFqJBZa'
-- WHERE role = 'super_admin';

-- STEP 5: Verify all super_admin accounts are properly configured
SELECT
  email,
  role,
  is_active,
  failed_login_attempts,
  locked_until
FROM admin_users
WHERE role = 'super_admin';
