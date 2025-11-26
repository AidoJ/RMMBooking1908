-- Restore critical RLS policies for public booking functionality
-- These were accidentally dropped during timezone migration

-- Drop and recreate policies to avoid "already exists" errors

-- SERVICES - Public booking page needs read access
DROP POLICY IF EXISTS services_select_all ON public.services;
CREATE POLICY services_select_all ON public.services FOR SELECT TO authenticated, anon, service_role USING (true);

DROP POLICY IF EXISTS services_admin_all ON public.services;
CREATE POLICY services_admin_all ON public.services USING (public.is_admin());

-- THERAPIST PROFILES - Public needs to see active therapists
CREATE POLICY therapist_profiles_select_all ON public.therapist_profiles FOR SELECT TO authenticated, anon, service_role USING (true);
CREATE POLICY therapist_profiles_select_public ON public.therapist_profiles FOR SELECT USING ((is_active = true));
CREATE POLICY therapist_profiles_admin_all ON public.therapist_profiles USING (public.is_admin());
CREATE POLICY therapist_profiles_update_all ON public.therapist_profiles FOR UPDATE TO authenticated, service_role USING (true);

-- THERAPIST SERVICES - Public needs to see what services therapists offer
CREATE POLICY therapist_services_select_all ON public.therapist_services FOR SELECT TO authenticated, anon, service_role USING (true);

-- THERAPIST AVAILABILITY - Public needs to check availability
CREATE POLICY therapist_availability_select_all ON public.therapist_availability FOR SELECT TO authenticated, anon, service_role USING (true);

-- THERAPIST TIME OFF - Public needs to check time off
CREATE POLICY therapist_time_off_select_all ON public.therapist_time_off FOR SELECT TO authenticated, anon, service_role USING (true);

-- BOOKINGS - Public can create and view bookings
CREATE POLICY bookings_select_all ON public.bookings FOR SELECT TO authenticated, anon, service_role USING (true);
CREATE POLICY bookings_insert_anon ON public.bookings FOR INSERT TO authenticated, anon, service_role WITH CHECK (true);
CREATE POLICY bookings_update_all ON public.bookings FOR UPDATE TO authenticated, service_role USING (true);
CREATE POLICY bookings_admin_all ON public.bookings USING (public.is_admin());
CREATE POLICY anon_can_select_bookings ON public.bookings FOR SELECT TO anon USING (true);
CREATE POLICY anon_can_update_bookings ON public.bookings FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- CUSTOMERS - Public can create customer records
CREATE POLICY customers_select_all ON public.customers FOR SELECT TO authenticated, anon, service_role USING (true);
CREATE POLICY customers_insert_anon ON public.customers FOR INSERT TO authenticated, anon, service_role WITH CHECK (true);
CREATE POLICY customers_update_all ON public.customers FOR UPDATE TO authenticated, service_role USING (true);
CREATE POLICY customers_admin_all ON public.customers USING (public.is_admin());

-- PRICING RULES - Public needs to see pricing
CREATE POLICY duration_pricing_select_all ON public.duration_pricing FOR SELECT TO authenticated, anon, service_role USING (true);
CREATE POLICY duration_pricing_admin_all ON public.duration_pricing USING (public.is_admin());

CREATE POLICY time_pricing_rules_select_all ON public.time_pricing_rules FOR SELECT TO authenticated, anon, service_role USING (true);
CREATE POLICY time_pricing_rules_admin_all ON public.time_pricing_rules USING (public.is_admin());

-- DISCOUNT CODES - Public can view and validate
CREATE POLICY discount_codes_select_all ON public.discount_codes FOR SELECT TO authenticated, anon, service_role USING (true);
CREATE POLICY discount_codes_admin_all ON public.discount_codes USING (public.is_admin());

-- GIFT CARDS - Public can view and validate
CREATE POLICY gift_cards_select_all ON public.gift_cards FOR SELECT TO authenticated, anon, service_role USING (true);
CREATE POLICY gift_cards_admin_all ON public.gift_cards USING (public.is_admin());

-- SYSTEM SETTINGS - Public needs access to some settings
CREATE POLICY system_settings_select_all ON public.system_settings FOR SELECT TO authenticated, anon, service_role USING (true);
CREATE POLICY system_settings_admin_all ON public.system_settings USING (public.is_admin());

-- BOOKING STATUS HISTORY
CREATE POLICY booking_status_history_select_all ON public.booking_status_history FOR SELECT TO authenticated, anon, service_role USING (true);
CREATE POLICY booking_status_history_insert_all ON public.booking_status_history FOR INSERT TO authenticated, anon, service_role WITH CHECK (true);
CREATE POLICY booking_status_history_admin_all ON public.booking_status_history USING (public.is_admin());

-- QUOTES - Public can create quotes
CREATE POLICY quotes_select_all ON public.quotes FOR SELECT TO authenticated, anon, service_role USING (true);
CREATE POLICY quotes_insert_anon ON public.quotes FOR INSERT TO authenticated, anon, service_role WITH CHECK (true);
CREATE POLICY quotes_update_all ON public.quotes FOR UPDATE TO authenticated, service_role USING (true);
CREATE POLICY quotes_admin_all ON public.quotes USING (public.is_admin());

-- QUOTE DATES
CREATE POLICY quote_dates_select_all ON public.quote_dates FOR SELECT TO authenticated, anon, service_role USING (true);
CREATE POLICY quote_dates_insert_all ON public.quote_dates FOR INSERT TO authenticated, anon, service_role WITH CHECK (true);
CREATE POLICY quote_dates_admin_all ON public.quote_dates USING (public.is_admin());

-- SHORT LINKS
CREATE POLICY "Public can read short links" ON public.short_links FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Service role can manage short links" ON public.short_links TO service_role USING (true) WITH CHECK (true);
