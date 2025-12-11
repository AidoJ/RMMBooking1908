-- Run this in Supabase SQL Editor to check superadmin account status

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
  created_at,
  -- Check if password looks like a bcrypt hash (starts with $2a$ or $2b$)
  CASE
    WHEN password LIKE '$2a$%' OR password LIKE '$2b$%' THEN 'Bcrypt hash (correct)'
    ELSE 'NOT bcrypt hash (PROBLEM!)'
  END as password_format
FROM admin_users
WHERE role = 'super_admin'
ORDER BY created_at DESC;
