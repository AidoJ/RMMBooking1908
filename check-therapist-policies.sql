-- Check what policies exist for therapist_profiles table
SELECT
    policyname,
    cmd,
    roles,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'therapist_profiles'
ORDER BY policyname;
