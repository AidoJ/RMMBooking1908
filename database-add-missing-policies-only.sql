-- Add only the missing policies (ones that were actually dropped)
-- Use DO blocks to check if policy exists before creating

-- Helper function to check if policy exists
DO $$
BEGIN
    -- Check if discount_codes_select_valid exists (this was the one we meant to recreate)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'discount_codes'
        AND policyname = 'discount_codes_select_valid'
    ) THEN
        CREATE POLICY discount_codes_select_valid ON public.discount_codes FOR SELECT
        USING ((((is_active = true) AND ((valid_until IS NULL) OR (valid_until > now()))
        AND ((usage_limit IS NULL) OR (usage_count < usage_limit))) OR public.is_admin()));
        RAISE NOTICE 'Created policy: discount_codes_select_valid';
    ELSE
        RAISE NOTICE 'Policy already exists: discount_codes_select_valid';
    END IF;
END $$;

-- List all policies to see what's missing
SELECT
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
