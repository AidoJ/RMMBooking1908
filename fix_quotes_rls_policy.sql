-- Fix Row Level Security policies for quotes table
-- Allow public users to insert quote requests
-- Run this SQL in Supabase SQL Editor

-- First, check current RLS policies on quotes table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'quotes';

-- Create a policy to allow anyone to insert quotes (for quote requests)
CREATE POLICY "Allow public quote insertion" ON public.quotes
FOR INSERT
TO public
WITH CHECK (true);

-- Create a policy to allow users to read their own quotes (optional - for future use)
CREATE POLICY "Users can read own quotes" ON public.quotes
FOR SELECT
TO public
USING (customer_email = current_setting('request.jwt.claims', true)::json->>'email');

-- Verify RLS is enabled
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'quotes';

-- Show all policies after creation
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'quotes';

-- Success message
SELECT 'RLS policies for quotes table updated successfully!' as message,
       'Public users can now insert quote requests' as details;