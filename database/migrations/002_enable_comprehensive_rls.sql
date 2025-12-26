-- ============================================================================
-- COMPREHENSIVE RLS POLICIES FOR THERAPIST TABLES
--
-- Security Model:
-- 1. Therapists can read/update ONLY their own data (WHERE auth_id = auth.uid())
-- 2. Admins can read/update ALL data (checked via admin_users table)
-- 3. Service role bypasses RLS (for backend functions that need full access)
-- 4. Public/anon users have NO access
-- ============================================================================

-- ============================================================================
-- TABLE: therapist_profiles
-- ============================================================================

-- Enable RLS
ALTER TABLE public.therapist_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Therapists can view own profile" ON public.therapist_profiles;
DROP POLICY IF EXISTS "Therapists can update own profile" ON public.therapist_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.therapist_profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.therapist_profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.therapist_profiles;

-- Policy: Therapists can view their own profile
CREATE POLICY "Therapists can view own profile"
ON public.therapist_profiles
FOR SELECT
TO authenticated
USING (auth_id = auth.uid());

-- Policy: Therapists can update their own profile
CREATE POLICY "Therapists can update own profile"
ON public.therapist_profiles
FOR UPDATE
TO authenticated
USING (auth_id = auth.uid())
WITH CHECK (auth_id = auth.uid());

-- Policy: Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.therapist_profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE auth_id = auth.uid()
    AND role IN ('admin', 'super_admin')
    AND is_active = true
  )
);

-- Policy: Admins can update all profiles
CREATE POLICY "Admins can update all profiles"
ON public.therapist_profiles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE auth_id = auth.uid()
    AND role IN ('admin', 'super_admin')
    AND is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE auth_id = auth.uid()
    AND role IN ('admin', 'super_admin')
    AND is_active = true
  )
);

-- Policy: Admins can insert new profiles (for manual creation)
CREATE POLICY "Admins can insert profiles"
ON public.therapist_profiles
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE auth_id = auth.uid()
    AND role IN ('admin', 'super_admin')
    AND is_active = true
  )
);

-- ============================================================================
-- TABLE: therapist_availability
-- ============================================================================

-- Enable RLS
ALTER TABLE public.therapist_availability ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Therapists can view own availability" ON public.therapist_availability;
DROP POLICY IF EXISTS "Therapists can manage own availability" ON public.therapist_availability;
DROP POLICY IF EXISTS "Admins can view all availability" ON public.therapist_availability;
DROP POLICY IF EXISTS "Admins can manage all availability" ON public.therapist_availability;

-- Policy: Therapists can view their own availability
CREATE POLICY "Therapists can view own availability"
ON public.therapist_availability
FOR SELECT
TO authenticated
USING (
  therapist_id IN (
    SELECT id FROM public.therapist_profiles
    WHERE auth_id = auth.uid()
  )
);

-- Policy: Therapists can manage their own availability (INSERT, UPDATE, DELETE)
CREATE POLICY "Therapists can manage own availability"
ON public.therapist_availability
FOR ALL
TO authenticated
USING (
  therapist_id IN (
    SELECT id FROM public.therapist_profiles
    WHERE auth_id = auth.uid()
  )
)
WITH CHECK (
  therapist_id IN (
    SELECT id FROM public.therapist_profiles
    WHERE auth_id = auth.uid()
  )
);

-- Policy: Admins can view all availability
CREATE POLICY "Admins can view all availability"
ON public.therapist_availability
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE auth_id = auth.uid()
    AND role IN ('admin', 'super_admin')
    AND is_active = true
  )
);

-- Policy: Admins can manage all availability
CREATE POLICY "Admins can manage all availability"
ON public.therapist_availability
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE auth_id = auth.uid()
    AND role IN ('admin', 'super_admin')
    AND is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE auth_id = auth.uid()
    AND role IN ('admin', 'super_admin')
    AND is_active = true
  )
);

-- ============================================================================
-- TABLE: therapist_services
-- ============================================================================

-- Enable RLS
ALTER TABLE public.therapist_services ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Therapists can view own services" ON public.therapist_services;
DROP POLICY IF EXISTS "Therapists can manage own services" ON public.therapist_services;
DROP POLICY IF EXISTS "Admins can view all therapist services" ON public.therapist_services;
DROP POLICY IF EXISTS "Admins can manage all therapist services" ON public.therapist_services;

-- Policy: Therapists can view their own services
CREATE POLICY "Therapists can view own services"
ON public.therapist_services
FOR SELECT
TO authenticated
USING (
  therapist_id IN (
    SELECT id FROM public.therapist_profiles
    WHERE auth_id = auth.uid()
  )
);

-- Policy: Therapists can manage their own services
CREATE POLICY "Therapists can manage own services"
ON public.therapist_services
FOR ALL
TO authenticated
USING (
  therapist_id IN (
    SELECT id FROM public.therapist_profiles
    WHERE auth_id = auth.uid()
  )
)
WITH CHECK (
  therapist_id IN (
    SELECT id FROM public.therapist_profiles
    WHERE auth_id = auth.uid()
  )
);

-- Policy: Admins can view all therapist services
CREATE POLICY "Admins can view all therapist services"
ON public.therapist_services
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE auth_id = auth.uid()
    AND role IN ('admin', 'super_admin')
    AND is_active = true
  )
);

-- Policy: Admins can manage all therapist services
CREATE POLICY "Admins can manage all therapist services"
ON public.therapist_services
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE auth_id = auth.uid()
    AND role IN ('admin', 'super_admin')
    AND is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE auth_id = auth.uid()
    AND role IN ('admin', 'super_admin')
    AND is_active = true
  )
);

-- ============================================================================
-- TABLE: therapist_time_off
-- ============================================================================

-- Enable RLS
ALTER TABLE public.therapist_time_off ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Therapists can view own time off" ON public.therapist_time_off;
DROP POLICY IF EXISTS "Therapists can manage own time off" ON public.therapist_time_off;
DROP POLICY IF EXISTS "Admins can view all time off" ON public.therapist_time_off;
DROP POLICY IF EXISTS "Admins can manage all time off" ON public.therapist_time_off;

-- Policy: Therapists can view their own time off
CREATE POLICY "Therapists can view own time off"
ON public.therapist_time_off
FOR SELECT
TO authenticated
USING (
  therapist_id IN (
    SELECT id FROM public.therapist_profiles
    WHERE auth_id = auth.uid()
  )
);

-- Policy: Therapists can manage their own time off
CREATE POLICY "Therapists can manage own time off"
ON public.therapist_time_off
FOR ALL
TO authenticated
USING (
  therapist_id IN (
    SELECT id FROM public.therapist_profiles
    WHERE auth_id = auth.uid()
  )
)
WITH CHECK (
  therapist_id IN (
    SELECT id FROM public.therapist_profiles
    WHERE auth_id = auth.uid()
  )
);

-- Policy: Admins can view all time off
CREATE POLICY "Admins can view all time off"
ON public.therapist_time_off
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE auth_id = auth.uid()
    AND role IN ('admin', 'super_admin')
    AND is_active = true
  )
);

-- Policy: Admins can manage all time off
CREATE POLICY "Admins can manage all time off"
ON public.therapist_time_off
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE auth_id = auth.uid()
    AND role IN ('admin', 'super_admin')
    AND is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE auth_id = auth.uid()
    AND role IN ('admin', 'super_admin')
    AND is_active = true
  )
);

-- ============================================================================
-- TABLE: therapist_service_rates
-- ============================================================================

-- Enable RLS
ALTER TABLE public.therapist_service_rates ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Therapists can view own service rates" ON public.therapist_service_rates;
DROP POLICY IF EXISTS "Admins can view all service rates" ON public.therapist_service_rates;
DROP POLICY IF EXISTS "Admins can manage all service rates" ON public.therapist_service_rates;

-- Policy: Therapists can view their own service rates (READ ONLY)
CREATE POLICY "Therapists can view own service rates"
ON public.therapist_service_rates
FOR SELECT
TO authenticated
USING (
  therapist_id IN (
    SELECT id FROM public.therapist_profiles
    WHERE auth_id = auth.uid()
  )
);

-- Policy: Admins can view all service rates
CREATE POLICY "Admins can view all service rates"
ON public.therapist_service_rates
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE auth_id = auth.uid()
    AND role IN ('admin', 'super_admin')
    AND is_active = true
  )
);

-- Policy: Admins can manage all service rates
CREATE POLICY "Admins can manage all service rates"
ON public.therapist_service_rates
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE auth_id = auth.uid()
    AND role IN ('admin', 'super_admin')
    AND is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE auth_id = auth.uid()
    AND role IN ('admin', 'super_admin')
    AND is_active = true
  )
);

-- ============================================================================
-- TABLE: therapist_payments (ALREADY HAS RLS ENABLED)
-- Just add/update policies
-- ============================================================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Therapists can view own payments" ON public.therapist_payments;
DROP POLICY IF EXISTS "Therapists can manage draft payments" ON public.therapist_payments;
DROP POLICY IF EXISTS "Admins can view all payments" ON public.therapist_payments;
DROP POLICY IF EXISTS "Admins can manage all payments" ON public.therapist_payments;

-- Policy: Therapists can view their own payments
CREATE POLICY "Therapists can view own payments"
ON public.therapist_payments
FOR SELECT
TO authenticated
USING (
  therapist_id IN (
    SELECT id FROM public.therapist_profiles
    WHERE auth_id = auth.uid()
  )
);

-- Policy: Therapists can create and update ONLY their draft payments
CREATE POLICY "Therapists can manage draft payments"
ON public.therapist_payments
FOR ALL
TO authenticated
USING (
  therapist_id IN (
    SELECT id FROM public.therapist_profiles
    WHERE auth_id = auth.uid()
  )
  AND status IN ('draft', 'submitted')
)
WITH CHECK (
  therapist_id IN (
    SELECT id FROM public.therapist_profiles
    WHERE auth_id = auth.uid()
  )
  AND status IN ('draft', 'submitted')
);

-- Policy: Admins can view all payments
CREATE POLICY "Admins can view all payments"
ON public.therapist_payments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE auth_id = auth.uid()
    AND role IN ('admin', 'super_admin')
    AND is_active = true
  )
);

-- Policy: Admins can manage all payments (including approve/pay)
CREATE POLICY "Admins can manage all payments"
ON public.therapist_payments
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE auth_id = auth.uid()
    AND role IN ('admin', 'super_admin')
    AND is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE auth_id = auth.uid()
    AND role IN ('admin', 'super_admin')
    AND is_active = true
  )
);

-- ============================================================================
-- VERIFICATION QUERIES
-- Run these to test that RLS is working correctly
-- ============================================================================

-- Check RLS is enabled on all tables
SELECT
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'therapist_profiles',
    'therapist_availability',
    'therapist_services',
    'therapist_time_off',
    'therapist_payments',
    'therapist_service_rates'
  )
ORDER BY tablename;

-- Count policies per table
SELECT
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename LIKE 'therapist%'
GROUP BY tablename
ORDER BY tablename;

-- ============================================================================
-- MIGRATION COMPLETE
-- All therapist tables now have comprehensive RLS policies
-- ============================================================================
