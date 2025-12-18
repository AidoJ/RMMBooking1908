-- Enable RLS on client_intake_forms table
-- Run this in Supabase SQL Editor

-- This secures the table so it can only be accessed via:
-- 1. Service role (Netlify functions)
-- 2. Policies you explicitly create (none needed currently)

-- Enable Row Level Security
ALTER TABLE client_intake_forms ENABLE ROW LEVEL SECURITY;

-- No policies needed - all access is via Netlify functions using service role
-- Service role automatically bypasses RLS

-- Verify RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'client_intake_forms';

-- Expected result: rowsecurity = true
