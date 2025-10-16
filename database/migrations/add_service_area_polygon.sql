-- Add service_area_polygon column to therapist_profiles
-- Upgrades from simple radius to custom drawn polygon on map

-- Add JSONB column to store GeoJSON polygon data
ALTER TABLE public.therapist_profiles
ADD COLUMN IF NOT EXISTS service_area_polygon jsonb;

-- Add index for polygon queries (GIN index for JSONB)
CREATE INDEX IF NOT EXISTS idx_therapist_profiles_service_area_polygon
ON public.therapist_profiles USING gin(service_area_polygon);

-- Add helpful comments
COMMENT ON COLUMN public.therapist_profiles.service_area_polygon IS 'GeoJSON polygon defining therapist service area. Format: {"type":"Polygon","coordinates":[[[lng,lat],...]]}';
COMMENT ON COLUMN public.therapist_profiles.service_radius_km IS 'Legacy radius-based service area (kept for backwards compatibility). New profiles should use service_area_polygon';

-- Example GeoJSON polygon structure for reference:
-- {
--   "type": "Polygon",
--   "coordinates": [
--     [
--       [151.2093, -33.8688],  -- [longitude, latitude] for each point
--       [151.2500, -33.8688],
--       [151.2500, -33.8000],
--       [151.2093, -33.8000],
--       [151.2093, -33.8688]   -- First and last point must be the same (closes the polygon)
--     ]
--   ]
-- }

-- Note: service_radius_km is retained for:
-- 1. Backwards compatibility with existing therapists
-- 2. Fallback if polygon is not defined
-- 3. Quick proximity checks before detailed polygon validation
