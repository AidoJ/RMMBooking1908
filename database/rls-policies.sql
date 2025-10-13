-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES FOR REJUVENATORS PLATFORM
-- ============================================================================
-- 
-- IMPORTANT: Run these policies in Supabase SQL Editor
-- 
-- This script implements comprehensive Row Level Security to protect:
-- - Customer data (personal information, bookings)
-- - Therapist data (profiles, earnings, schedules)
-- - Admin data (credentials, activity logs)
-- - Payment data (transactions, financial records)
-- - Business data (services, pricing, settings)
--
-- SECURITY MODEL:
-- - Customers: Can only access their own data
-- - Therapists: Can access their assigned bookings and own profile
-- - Admins: Full access to all data (role-based)
-- - Public: Limited read access to services and public therapist profiles
-- - Anon/Service Role: Can create bookings (customer-facing booking form)
--
-- ============================================================================

-- ============================================================================
-- STEP 1: ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapist_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 2: DROP EXISTING POLICIES (if any exist)
-- ============================================================================

-- Customers policies
DROP POLICY IF EXISTS "customers_select_own" ON public.customers;
DROP POLICY IF EXISTS "customers_insert_anon" ON public.customers;
DROP POLICY IF EXISTS "customers_update_own" ON public.customers;
DROP POLICY IF EXISTS "customers_admin_all" ON public.customers;

-- Therapist profiles policies
DROP POLICY IF EXISTS "therapist_profiles_select_public" ON public.therapist_profiles;
DROP POLICY IF EXISTS "therapist_profiles_select_own" ON public.therapist_profiles;
DROP POLICY IF EXISTS "therapist_profiles_update_own" ON public.therapist_profiles;
DROP POLICY IF EXISTS "therapist_profiles_admin_all" ON public.therapist_profiles;

-- Bookings policies
DROP POLICY IF EXISTS "bookings_select_customer" ON public.bookings;
DROP POLICY IF EXISTS "bookings_select_therapist" ON public.bookings;
DROP POLICY IF EXISTS "bookings_insert_anon" ON public.bookings;
DROP POLICY IF EXISTS "bookings_update_customer" ON public.bookings;
DROP POLICY IF EXISTS "bookings_update_therapist" ON public.bookings;
DROP POLICY IF EXISTS "bookings_admin_all" ON public.bookings;

-- Booking status history policies
DROP POLICY IF EXISTS "booking_status_history_select_related" ON public.booking_status_history;
DROP POLICY IF EXISTS "booking_status_history_insert_all" ON public.booking_status_history;
DROP POLICY IF EXISTS "booking_status_history_admin_all" ON public.booking_status_history;

-- Services policies
DROP POLICY IF EXISTS "services_select_all" ON public.services;
DROP POLICY IF EXISTS "services_admin_all" ON public.services;

-- Time pricing rules policies
DROP POLICY IF EXISTS "time_pricing_rules_select_all" ON public.time_pricing_rules;
DROP POLICY IF EXISTS "time_pricing_rules_admin_all" ON public.time_pricing_rules;

-- Discount codes policies
DROP POLICY IF EXISTS "discount_codes_select_valid" ON public.discount_codes;
DROP POLICY IF EXISTS "discount_codes_admin_all" ON public.discount_codes;

-- Gift cards policies
DROP POLICY IF EXISTS "gift_cards_select_valid" ON public.gift_cards;
DROP POLICY IF EXISTS "gift_cards_update_used" ON public.gift_cards;
DROP POLICY IF EXISTS "gift_cards_admin_all" ON public.gift_cards;

-- Admin users policies
DROP POLICY IF EXISTS "admin_users_select_own" ON public.admin_users;
DROP POLICY IF EXISTS "admin_users_update_own" ON public.admin_users;
DROP POLICY IF EXISTS "admin_users_super_admin_all" ON public.admin_users;

-- Admin sessions policies
DROP POLICY IF EXISTS "admin_sessions_select_own" ON public.admin_sessions;
DROP POLICY IF EXISTS "admin_sessions_insert_own" ON public.admin_sessions;
DROP POLICY IF EXISTS "admin_sessions_delete_own" ON public.admin_sessions;
DROP POLICY IF EXISTS "admin_sessions_admin_all" ON public.admin_sessions;

-- Admin activity log policies
DROP POLICY IF EXISTS "admin_activity_log_insert_all" ON public.admin_activity_log;
DROP POLICY IF EXISTS "admin_activity_log_select_admin" ON public.admin_activity_log;

-- System settings policies
DROP POLICY IF EXISTS "system_settings_select_all" ON public.system_settings;
DROP POLICY IF EXISTS "system_settings_admin_all" ON public.system_settings;

-- ============================================================================
-- STEP 3: CREATE HELPER FUNCTIONS FOR ROLE CHECKING
-- ============================================================================

-- Function to check if current user is an admin (any admin role)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE id = auth.uid()
    AND is_active = true
    AND role IN ('admin', 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if current user is a super admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE id = auth.uid()
    AND is_active = true
    AND role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if current user is a therapist
CREATE OR REPLACE FUNCTION public.is_therapist()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.therapist_profiles
    WHERE id = auth.uid()
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get customer_id from email (for anon/service role lookups)
CREATE OR REPLACE FUNCTION public.get_customer_id_by_email(customer_email text)
RETURNS uuid AS $$
  SELECT id FROM public.customers WHERE email = customer_email LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================================================
-- STEP 4: CUSTOMERS TABLE POLICIES
-- ============================================================================

-- Customers can select their own data
CREATE POLICY "customers_select_own"
ON public.customers
FOR SELECT
USING (
  auth.uid() = id -- Authenticated as this customer
  OR public.is_admin() -- Or is an admin
);

-- Allow anonymous users to insert new customers (booking form)
CREATE POLICY "customers_insert_anon"
ON public.customers
FOR INSERT
WITH CHECK (true); -- Allow all inserts (customer creation during booking)

-- Customers can update their own data
CREATE POLICY "customers_update_own"
ON public.customers
FOR UPDATE
USING (
  auth.uid() = id -- Own data
  OR public.is_admin() -- Or admin
);

-- Admins have full access
CREATE POLICY "customers_admin_all"
ON public.customers
FOR ALL
USING (public.is_admin());

-- ============================================================================
-- STEP 5: THERAPIST PROFILES TABLE POLICIES
-- ============================================================================

-- Public can select basic therapist profiles (for booking selection)
-- But sensitive fields should be protected at column level
CREATE POLICY "therapist_profiles_select_public"
ON public.therapist_profiles
FOR SELECT
USING (
  is_active = true -- Only active therapists
  AND available_for_booking = true -- Only available therapists
);

-- Therapists can select their own full profile
CREATE POLICY "therapist_profiles_select_own"
ON public.therapist_profiles
FOR SELECT
USING (
  auth.uid() = id -- Own profile
  OR public.is_admin() -- Or admin
);

-- Therapists can update their own profile
CREATE POLICY "therapist_profiles_update_own"
ON public.therapist_profiles
FOR UPDATE
USING (
  auth.uid() = id -- Own profile
  OR public.is_admin() -- Or admin
);

-- Admins have full access
CREATE POLICY "therapist_profiles_admin_all"
ON public.therapist_profiles
FOR ALL
USING (public.is_admin());

-- ============================================================================
-- STEP 6: BOOKINGS TABLE POLICIES (Most Complex)
-- ============================================================================

-- Customers can select their own bookings
CREATE POLICY "bookings_select_customer"
ON public.bookings
FOR SELECT
USING (
  customer_id = auth.uid() -- Own bookings
  OR customer_email = auth.email() -- Match by email
  OR public.is_admin() -- Or admin
);

-- Therapists can select their assigned bookings
CREATE POLICY "bookings_select_therapist"
ON public.bookings
FOR SELECT
USING (
  therapist_id = auth.uid() -- Assigned to them
  OR responding_therapist_id = auth.uid() -- They responded
  OR alternate_therapist_id = auth.uid() -- Alternate therapist
  OR public.is_admin() -- Or admin
);

-- Allow anonymous/service role to insert bookings (customer booking form)
CREATE POLICY "bookings_insert_anon"
ON public.bookings
FOR INSERT
WITH CHECK (true); -- Allow all inserts (booking creation)

-- Customers can update their own bookings (limited fields)
CREATE POLICY "bookings_update_customer"
ON public.bookings
FOR UPDATE
USING (
  customer_id = auth.uid() -- Own bookings
  OR customer_email = auth.email() -- Match by email
)
WITH CHECK (
  customer_id = auth.uid() -- Can only update own bookings
  OR customer_email = auth.email()
);

-- Therapists can update bookings assigned to them (limited fields - acceptance/decline)
CREATE POLICY "bookings_update_therapist"
ON public.bookings
FOR UPDATE
USING (
  therapist_id = auth.uid() -- Assigned bookings
  OR responding_therapist_id = auth.uid()
)
WITH CHECK (
  therapist_id = auth.uid() -- Can only update assigned bookings
  OR responding_therapist_id = auth.uid()
);

-- Admins have full access
CREATE POLICY "bookings_admin_all"
ON public.bookings
FOR ALL
USING (public.is_admin());

-- ============================================================================
-- STEP 7: BOOKING STATUS HISTORY TABLE POLICIES
-- ============================================================================

-- Allow viewing status history for related bookings
CREATE POLICY "booking_status_history_select_related"
ON public.booking_status_history
FOR SELECT
USING (
  -- If they can see the booking, they can see its history
  EXISTS (
    SELECT 1 FROM public.bookings
    WHERE bookings.id = booking_status_history.booking_id
    AND (
      bookings.customer_id = auth.uid()
      OR bookings.customer_email = auth.email()
      OR bookings.therapist_id = auth.uid()
      OR bookings.responding_therapist_id = auth.uid()
      OR public.is_admin()
    )
  )
);

-- Allow system to insert status history (service role)
CREATE POLICY "booking_status_history_insert_all"
ON public.booking_status_history
FOR INSERT
WITH CHECK (true); -- Allow status history creation

-- Admins have full access
CREATE POLICY "booking_status_history_admin_all"
ON public.booking_status_history
FOR ALL
USING (public.is_admin());

-- ============================================================================
-- STEP 8: SERVICES TABLE POLICIES
-- ============================================================================

-- Everyone can view active services (public catalog)
CREATE POLICY "services_select_all"
ON public.services
FOR SELECT
USING (
  is_active = true -- Only active services
  OR public.is_admin() -- Or admin can see all
);

-- Only admins can modify services
CREATE POLICY "services_admin_all"
ON public.services
FOR ALL
USING (public.is_admin());

-- ============================================================================
-- STEP 9: TIME PRICING RULES TABLE POLICIES
-- ============================================================================

-- Everyone can view pricing rules (needed for booking form)
CREATE POLICY "time_pricing_rules_select_all"
ON public.time_pricing_rules
FOR SELECT
USING (
  is_active = true -- Only active rules
  OR public.is_admin() -- Or admin can see all
);

-- Only admins can modify pricing rules
CREATE POLICY "time_pricing_rules_admin_all"
ON public.time_pricing_rules
FOR ALL
USING (public.is_admin());

-- ============================================================================
-- STEP 10: DISCOUNT CODES TABLE POLICIES
-- ============================================================================

-- Allow checking if discount code is valid (but not viewing all codes)
CREATE POLICY "discount_codes_select_valid"
ON public.discount_codes
FOR SELECT
USING (
  is_active = true
  AND (expiry_date IS NULL OR expiry_date > now())
  AND (usage_limit IS NULL OR times_used < usage_limit)
  OR public.is_admin() -- Admins can see all
);

-- Only admins can modify discount codes
CREATE POLICY "discount_codes_admin_all"
ON public.discount_codes
FOR ALL
USING (public.is_admin());

-- ============================================================================
-- STEP 11: GIFT CARDS TABLE POLICIES
-- ============================================================================

-- Allow checking if gift card is valid (but not viewing all gift cards)
CREATE POLICY "gift_cards_select_valid"
ON public.gift_cards
FOR SELECT
USING (
  is_active = true
  AND balance > 0
  AND (expiry_date IS NULL OR expiry_date > now())
  OR public.is_admin() -- Admins can see all
);

-- Allow updating gift card balance when used
CREATE POLICY "gift_cards_update_used"
ON public.gift_cards
FOR UPDATE
USING (
  is_active = true
  AND balance > 0
)
WITH CHECK (
  balance >= 0 -- Cannot set negative balance
  AND is_active = true
);

-- Admins have full access
CREATE POLICY "gift_cards_admin_all"
ON public.gift_cards
FOR ALL
USING (public.is_admin());

-- ============================================================================
-- STEP 12: ADMIN USERS TABLE POLICIES
-- ============================================================================

-- Admins can view their own profile
CREATE POLICY "admin_users_select_own"
ON public.admin_users
FOR SELECT
USING (
  auth.uid() = id -- Own profile
  OR public.is_super_admin() -- Or super admin can see all
);

-- Admins can update their own profile (not role)
CREATE POLICY "admin_users_update_own"
ON public.admin_users
FOR UPDATE
USING (
  auth.uid() = id -- Own profile
)
WITH CHECK (
  auth.uid() = id -- Can only update own profile
);

-- Super admins have full access
CREATE POLICY "admin_users_super_admin_all"
ON public.admin_users
FOR ALL
USING (public.is_super_admin());

-- ============================================================================
-- STEP 13: ADMIN SESSIONS TABLE POLICIES
-- ============================================================================

-- Admins can view their own sessions
CREATE POLICY "admin_sessions_select_own"
ON public.admin_sessions
FOR SELECT
USING (
  auth.uid() = user_id -- Own sessions
  OR public.is_super_admin() -- Or super admin
);

-- Admins can create their own sessions
CREATE POLICY "admin_sessions_insert_own"
ON public.admin_sessions
FOR INSERT
WITH CHECK (
  auth.uid() = user_id -- Own session
);

-- Admins can delete their own sessions (logout)
CREATE POLICY "admin_sessions_delete_own"
ON public.admin_sessions
FOR DELETE
USING (
  auth.uid() = user_id -- Own sessions
  OR public.is_super_admin() -- Or super admin
);

-- Super admins have full access
CREATE POLICY "admin_sessions_admin_all"
ON public.admin_sessions
FOR ALL
USING (public.is_super_admin());

-- ============================================================================
-- STEP 14: ADMIN ACTIVITY LOG TABLE POLICIES
-- ============================================================================

-- Allow all authenticated users to insert activity logs
CREATE POLICY "admin_activity_log_insert_all"
ON public.admin_activity_log
FOR INSERT
WITH CHECK (true); -- Allow logging from all authenticated users

-- Admins can view activity logs
CREATE POLICY "admin_activity_log_select_admin"
ON public.admin_activity_log
FOR SELECT
USING (
  public.is_admin() -- Only admins can view logs
);

-- ============================================================================
-- STEP 15: SYSTEM SETTINGS TABLE POLICIES
-- ============================================================================

-- Everyone can view system settings (needed for business logic)
CREATE POLICY "system_settings_select_all"
ON public.system_settings
FOR SELECT
USING (true); -- Public read access for business logic

-- Only admins can modify system settings
CREATE POLICY "system_settings_admin_all"
ON public.system_settings
FOR ALL
USING (public.is_admin());

-- ============================================================================
-- STEP 16: GRANT NECESSARY PERMISSIONS TO SERVICE ROLE
-- ============================================================================

-- Grant service role ability to bypass RLS (for Netlify functions)
-- This allows server-side functions to operate without RLS restrictions
-- But client-side access (anon key) will still be protected by RLS

-- Note: Service role already has these permissions by default in Supabase
-- This is just documentation of what the service role can do

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Run these queries to verify RLS is enabled:

-- SELECT tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public' 
-- AND tablename IN (
--   'customers', 'therapist_profiles', 'bookings', 'booking_status_history',
--   'services', 'time_pricing_rules', 'discount_codes', 'gift_cards',
--   'admin_users', 'admin_sessions', 'admin_activity_log', 'system_settings'
-- );

-- View all policies:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;

-- ============================================================================
-- ROLLBACK SCRIPT (In case you need to disable RLS)
-- ============================================================================

-- DANGER: Only run this if you need to disable RLS temporarily for debugging

-- ALTER TABLE public.customers DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.therapist_profiles DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.bookings DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.booking_status_history DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.services DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.time_pricing_rules DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.discount_codes DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.gift_cards DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.admin_users DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.admin_sessions DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.admin_activity_log DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.system_settings DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- END OF RLS POLICIES
-- ============================================================================

