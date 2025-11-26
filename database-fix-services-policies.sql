-- Fix services table policies (accidentally dropped during timezone migration)

-- Allow public read access to services (required for booking page)
CREATE POLICY services_select_all ON public.services FOR SELECT TO authenticated, anon, service_role USING (true);

-- Admin can manage all services
CREATE POLICY services_admin_all ON public.services USING (public.is_admin());
