-- Fix RLS policies for public booking access
-- This file ensures anonymous users can read necessary data for booking

-- ===== THERAPIST PROFILES =====
DROP POLICY IF EXISTS therapist_profiles_select_all ON public.therapist_profiles;
DROP POLICY IF EXISTS therapist_profiles_select_public ON public.therapist_profiles;
DROP POLICY IF EXISTS therapist_profiles_admin_all ON public.therapist_profiles;
DROP POLICY IF EXISTS therapist_profiles_update_all ON public.therapist_profiles;

CREATE POLICY therapist_profiles_select_all
ON public.therapist_profiles
FOR SELECT
TO authenticated, anon, service_role
USING (true);

CREATE POLICY therapist_profiles_select_public
ON public.therapist_profiles
FOR SELECT
USING (is_active = true);

CREATE POLICY therapist_profiles_admin_all
ON public.therapist_profiles
USING (public.is_admin());

CREATE POLICY therapist_profiles_update_all
ON public.therapist_profiles
FOR UPDATE
TO authenticated, service_role
USING (true);

-- ===== DURATION PRICING =====
DROP POLICY IF EXISTS duration_pricing_select_all ON public.duration_pricing;
DROP POLICY IF EXISTS duration_pricing_admin_all ON public.duration_pricing;

CREATE POLICY duration_pricing_select_all
ON public.duration_pricing
FOR SELECT
TO authenticated, anon, service_role
USING (true);

CREATE POLICY duration_pricing_admin_all
ON public.duration_pricing
USING (public.is_admin());

-- ===== THERAPIST AVAILABILITY =====
DROP POLICY IF EXISTS therapist_availability_select_all ON public.therapist_availability;
DROP POLICY IF EXISTS therapist_availability_admin_all ON public.therapist_availability;

CREATE POLICY therapist_availability_select_all
ON public.therapist_availability
FOR SELECT
TO authenticated, anon, service_role
USING (true);

CREATE POLICY therapist_availability_admin_all
ON public.therapist_availability
USING (public.is_admin());

-- ===== THERAPIST TIME OFF =====
DROP POLICY IF EXISTS therapist_time_off_select_all ON public.therapist_time_off;
DROP POLICY IF EXISTS therapist_time_off_admin_all ON public.therapist_time_off;

CREATE POLICY therapist_time_off_select_all
ON public.therapist_time_off
FOR SELECT
TO authenticated, anon, service_role
USING (true);

CREATE POLICY therapist_time_off_admin_all
ON public.therapist_time_off
USING (public.is_admin());

-- ===== BOOKINGS (for checking existing bookings) =====
-- Note: Bookings already has policies but adding for completeness
DROP POLICY IF EXISTS bookings_select_all ON public.bookings;
DROP POLICY IF EXISTS bookings_insert_anon ON public.bookings;
DROP POLICY IF EXISTS bookings_update_all ON public.bookings;
DROP POLICY IF EXISTS bookings_admin_all ON public.bookings;
DROP POLICY IF EXISTS anon_can_select_bookings ON public.bookings;
DROP POLICY IF EXISTS anon_can_update_bookings ON public.bookings;

CREATE POLICY bookings_select_all
ON public.bookings
FOR SELECT
TO authenticated, anon, service_role
USING (true);

CREATE POLICY bookings_insert_anon
ON public.bookings
FOR INSERT
TO authenticated, anon, service_role
WITH CHECK (true);

CREATE POLICY bookings_update_all
ON public.bookings
FOR UPDATE
TO authenticated, service_role
USING (true);

CREATE POLICY bookings_admin_all
ON public.bookings
USING (public.is_admin());

CREATE POLICY anon_can_select_bookings
ON public.bookings
FOR SELECT
TO anon
USING (true);

CREATE POLICY anon_can_update_bookings
ON public.bookings
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- ===== SYSTEM SETTINGS (for business hours and configuration) =====
DROP POLICY IF EXISTS system_settings_select_all ON public.system_settings;
DROP POLICY IF EXISTS system_settings_admin_all ON public.system_settings;

CREATE POLICY system_settings_select_all
ON public.system_settings
FOR SELECT
TO authenticated, anon, service_role
USING (true);

CREATE POLICY system_settings_admin_all
ON public.system_settings
USING (public.is_admin());

-- ===== THERAPIST SERVICES (links therapists to services they offer) =====
DROP POLICY IF EXISTS therapist_services_select_all ON public.therapist_services;
DROP POLICY IF EXISTS therapist_services_admin_all ON public.therapist_services;

CREATE POLICY therapist_services_select_all
ON public.therapist_services
FOR SELECT
TO authenticated, anon, service_role
USING (true);

CREATE POLICY therapist_services_admin_all
ON public.therapist_services
USING (public.is_admin());

-- ===== SERVICES (service catalog) =====
DROP POLICY IF EXISTS services_select_all ON public.services;
DROP POLICY IF EXISTS services_admin_all ON public.services;

CREATE POLICY services_select_all
ON public.services
FOR SELECT
TO authenticated, anon, service_role
USING (true);

CREATE POLICY services_admin_all
ON public.services
USING (public.is_admin());

-- ===== CUSTOMERS =====
DROP POLICY IF EXISTS customers_select_all ON public.customers;
DROP POLICY IF EXISTS customers_insert_anon ON public.customers;
DROP POLICY IF EXISTS customers_update_all ON public.customers;
DROP POLICY IF EXISTS customers_admin_all ON public.customers;

CREATE POLICY customers_select_all
ON public.customers
FOR SELECT
TO authenticated, anon, service_role
USING (true);

CREATE POLICY customers_insert_anon
ON public.customers
FOR INSERT
TO authenticated, anon, service_role
WITH CHECK (true);

CREATE POLICY customers_update_all
ON public.customers
FOR UPDATE
TO authenticated, service_role
USING (true);

CREATE POLICY customers_admin_all
ON public.customers
USING (public.is_admin());

-- ===== TIME PRICING RULES (weekend/afterhours pricing) =====
DROP POLICY IF EXISTS time_pricing_rules_select_all ON public.time_pricing_rules;
DROP POLICY IF EXISTS time_pricing_rules_admin_all ON public.time_pricing_rules;

CREATE POLICY time_pricing_rules_select_all
ON public.time_pricing_rules
FOR SELECT
TO authenticated, anon, service_role
USING (true);

CREATE POLICY time_pricing_rules_admin_all
ON public.time_pricing_rules
USING (public.is_admin());

-- ===== DISCOUNT CODES =====
DROP POLICY IF EXISTS discount_codes_select_all ON public.discount_codes;
DROP POLICY IF EXISTS discount_codes_admin_all ON public.discount_codes;

CREATE POLICY discount_codes_select_all
ON public.discount_codes
FOR SELECT
TO authenticated, anon, service_role
USING (true);

CREATE POLICY discount_codes_admin_all
ON public.discount_codes
USING (public.is_admin());

-- ===== GIFT CARDS =====
DROP POLICY IF EXISTS gift_cards_select_all ON public.gift_cards;
DROP POLICY IF EXISTS gift_cards_admin_all ON public.gift_cards;

CREATE POLICY gift_cards_select_all
ON public.gift_cards
FOR SELECT
TO authenticated, anon, service_role
USING (true);

CREATE POLICY gift_cards_admin_all
ON public.gift_cards
USING (public.is_admin());

-- ===== BOOKING STATUS HISTORY =====
DROP POLICY IF EXISTS booking_status_history_select_all ON public.booking_status_history;
DROP POLICY IF EXISTS booking_status_history_insert_all ON public.booking_status_history;
DROP POLICY IF EXISTS booking_status_history_admin_all ON public.booking_status_history;

CREATE POLICY booking_status_history_select_all
ON public.booking_status_history
FOR SELECT
TO authenticated, anon, service_role
USING (true);

CREATE POLICY booking_status_history_insert_all
ON public.booking_status_history
FOR INSERT
TO authenticated, anon, service_role
WITH CHECK (true);

CREATE POLICY booking_status_history_admin_all
ON public.booking_status_history
USING (public.is_admin());

-- Verify ALL policies were created
SELECT
    tablename,
    policyname,
    cmd,
    roles
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN (
    'therapist_profiles',
    'duration_pricing',
    'therapist_availability',
    'therapist_time_off',
    'bookings',
    'system_settings',
    'therapist_services',
    'services',
    'customers',
    'time_pricing_rules',
    'discount_codes',
    'gift_cards',
    'booking_status_history'
)
ORDER BY tablename, policyname;
