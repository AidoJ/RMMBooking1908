# Testing Guide - Per-Service Rates & Location Filtering

## Quick Test: Service-Specific Rates

### 1. Create a Test Service-Specific Rate (via Supabase SQL Editor)

```sql
-- First, get a therapist ID and service ID
SELECT id, first_name, last_name FROM therapist_profiles WHERE is_active = true LIMIT 1;
SELECT id, name FROM services WHERE is_active = true LIMIT 1;

-- Insert a service-specific rate (use actual IDs from above)
INSERT INTO therapist_service_rates (
  therapist_id,
  service_id,
  normal_rate,
  afterhours_rate,
  notes
)
VALUES (
  'YOUR_THERAPIST_ID_HERE',  -- Replace with actual therapist ID
  'YOUR_SERVICE_ID_HERE',     -- Replace with actual service ID
  95.00,                       -- Higher than their profile default
  110.00,                      -- Higher than their profile default
  'Test rate for service-specific pricing'
);
```

### 2. Verify the Rate is Stored

```sql
SELECT
  tsr.*,
  tp.first_name || ' ' || tp.last_name as therapist_name,
  s.name as service_name
FROM therapist_service_rates tsr
JOIN therapist_profiles tp ON tp.id = tsr.therapist_id
JOIN services s ON s.id = tsr.service_id
WHERE tsr.is_active = true;
```

### 3. Test in Admin Panel (Create Quote)

1. Go to Admin Panel → Quotes → Create New Quote
2. Enter event details
3. Select the SERVICE you set the service-specific rate for
4. Assign the THERAPIST you set the rate for
5. Check the console logs - should say: "✅ Using service-specific rate"
6. Verify the calculated fee uses your custom rate (95 or 110 depending on time)

### 4. Test in Customer Portal

1. Go to customer booking portal
2. Enter an address
3. Select the service with service-specific rate
4. Select date/time
5. Choose the therapist with service-specific rate
6. Check console - should show service-specific rate being used
7. Verify fee calculation is correct

---

## Quick Test: Location-Based Service Filtering

### 1. Test With Valid Address

1. Open customer booking portal
2. Enter an address where therapists are available
3. **Check:** Status message says "Great news, we have therapists available in your area"
4. Proceed to service selection
5. **Check console:** Should say "📍 Filtering services by X available therapists"
6. **Verify:** Only services offered by those therapists appear

### 2. Test With Out-of-Range Address

1. Enter an address far from any therapist
2. **Check:** Status message says "Sorry... we don't have any therapists available"
3. **Check:** Cannot proceed to next step (continue button disabled)

### 3. Test With No Location (Fallback)

1. If you bypass address selection somehow
2. **Check console:** Should say "📋 No location filtering - showing all services"
3. **Verify:** All active services appear

---

## Expected Console Output

### When Service-Specific Rate Exists:
```
✅ Using service-specific rate for therapist [ID], service [ID]: normal=$95, afterhours=$110
```

### When Falling Back to Profile Default:
```
⚠️ No service-specific rate found. Using profile default rates for [Name]: normal=$85, afterhours=$100
```

### When Filtering Services by Location:
```
📍 Filtering services by 3 available therapists
✅ Found 5 services available in this area
```

---

## Common Issues & Solutions

### Issue: Fee calculation not using service-specific rate
**Solution:** Check that:
- Service-specific rate `is_active = true`
- `therapist_id` and `service_id` match exactly
- Console shows which rate is being used

### Issue: All services still showing (not filtered by location)
**Solution:** Check that:
- Address was selected from autocomplete dropdown (has lat/lng)
- `window.availableTherapistIds` is set (check console)
- Therapists have location data (latitude, longitude, service_radius_km)

### Issue: No therapists found error
**Solution:** Check that:
- At least one therapist has `is_active = true`
- Therapists have valid lat/lng coordinates
- Service radius is set (not null)
- Address coordinates are within a therapist's service radius

---

## Database Verification Queries

### Check Profile Rates vs Service-Specific Rates:
```sql
SELECT
  tp.first_name || ' ' || tp.last_name as therapist,
  s.name as service,
  tp.hourly_rate as profile_normal,
  tp.afterhours_rate as profile_afterhours,
  tsr.normal_rate as service_normal,
  tsr.afterhours_rate as service_afterhours,
  CASE
    WHEN tsr.id IS NOT NULL THEN 'Service-Specific'
    ELSE 'Profile Default'
  END as rate_source
FROM therapist_profiles tp
CROSS JOIN services s
LEFT JOIN therapist_service_rates tsr
  ON tsr.therapist_id = tp.id
  AND tsr.service_id = s.id
  AND tsr.is_active = true
WHERE tp.is_active = true
  AND s.is_active = true
ORDER BY therapist, service;
```

### Check Therapist Service Coverage:
```sql
SELECT
  tp.first_name || ' ' || tp.last_name as therapist,
  tp.latitude,
  tp.longitude,
  tp.service_radius_km,
  COUNT(ts.service_id) as services_offered,
  STRING_AGG(s.name, ', ') as services
FROM therapist_profiles tp
LEFT JOIN therapist_services ts ON ts.therapist_id = tp.id
LEFT JOIN services s ON s.id = ts.service_id
WHERE tp.is_active = true
GROUP BY tp.id, tp.first_name, tp.last_name, tp.latitude, tp.longitude, tp.service_radius_km;
```

---

## Success Criteria

✅ Service-specific rates are used when they exist
✅ Profile defaults are used as fallback
✅ Weekend/afterhours rates apply correctly
✅ Location filtering shows only relevant services
✅ Out-of-range addresses are handled gracefully
✅ Existing bookings preserve original fees
✅ Console logs clearly show which rates are being used

