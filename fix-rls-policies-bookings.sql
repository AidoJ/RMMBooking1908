-- RLS Policies for Bookings Table (Therapist App Updates)
-- Run this in your Supabase SQL Editor

-- Note: This assumes therapists are NOT authenticated via Supabase Auth
-- but rather use localStorage tokens from the therapist-auth function
-- So we need to allow anonymous access OR disable RLS temporarily

-- Option 1: Allow anon key to update bookings (LESS SECURE but works)
-- This allows updates from the client using the anon key

CREATE POLICY IF NOT EXISTS "anon_can_update_bookings"
ON public.bookings
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "anon_can_select_bookings"
ON public.bookings
FOR SELECT
TO anon
USING (true);

-- Option 2: Disable RLS temporarily (LEAST SECURE - only for testing)
-- ALTER TABLE public.bookings DISABLE ROW LEVEL SECURITY;

-- Option 3: Better approach - Use service role key in a Netlify function
-- This would require creating a new function like:
-- /.netlify/functions/update-booking-status
-- That uses the SERVICE_ROLE_KEY to bypass RLS
-- Then call that function from the therapist app instead of direct Supabase calls
