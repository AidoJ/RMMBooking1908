# Per-Service Rates & Location Filtering - Implementation Summary

## ✅ COMPLETED CHANGES

### 1. Database (COMPLETED ✅)
**File:** `database/migrations/create_therapist_service_rates.sql`
- Created `therapist_service_rates` table with:
  - `therapist_id` + `service_id` (unique constraint)
  - `normal_rate` + `afterhours_rate`
  - `is_active` flag
  - Proper indexes for fast lookups
  - RLS policies (authenticated users can SELECT, only admins can INSERT/UPDATE/DELETE)

### 2. Core Fee Calculation Logic (COMPLETED ✅)
**File:** `admin/src/services/feeCalculation.ts`
- Updated `calculateTherapistFee()` function:
  - Now accepts `service_id` parameter
  - Queries `therapist_service_rates` first
  - Falls back to `therapist_profiles.hourly_rate/afterhours_rate` if no service-specific rate
  - Logs which rate is being used for debugging

### 3. Availability Service (COMPLETED ✅)
**File:** `admin/src/services/availabilityService.ts`
- Updated `getAvailableTherapists()`:
  - Accepts optional `service_id` parameter
  - Fetches service-specific rates in bulk for all therapists
  - Returns service-specific rates when available, profile defaults otherwise
- Updated `checkQuoteAvailability()`:
  - Passes `quote.service_id` to `getAvailableTherapists()`
  - Quote availability checking now uses service-specific rates

### 4. Customer Booking Portal (COMPLETED ✅)
**File:** `booking/js/booking.js`
**Changes:**
- Updated `calculateTherapistFee()` function (line 111):
  - Accepts `service_id` parameter
  - Queries `therapist_service_rates` first
  - Falls back to profile defaults
- Updated function calls (lines 3524, 4202):
  - Pass `window.selectedServiceId` to fee calculation

### 5. Location-Based Service Filtering (COMPLETED ✅)
**File:** `booking/js/booking.js`
**Changes:**
- `checkTherapistCoverageForAddress()` (line 2485):
  - Now STORES filtered therapist IDs in `window.availableTherapistIds`
  - Changed from `.some()` to `.filter()` to capture which therapists are available

- `populateTherapyOptions()` (line 809):
  - Checks if `window.availableTherapistIds` exists
  - If yes: queries `therapist_services` to get services from available therapists only
  - If no: shows all services (fallback)
  - **Result:** Customers only see services actually available in their area

---

## 📊 HOW IT WORKS NOW

### Fee Calculation Flow:
```
1. Booking/Quote Created with service_id + therapist_id
   ↓
2. Query therapist_service_rates WHERE therapist_id AND service_id
   ↓
3a. IF FOUND → Use service-specific rates
3b. IF NOT FOUND → Use therapist_profiles.hourly_rate/afterhours_rate
   ↓
4. Determine time of day (weekend/afterhours/normal)
   ↓
5. Calculate fee = hours × selected_rate
   ↓
6. Store in bookings.therapist_fee (never recalculated)
```

### Service Filtering Flow (Customer Portal):
```
1. Customer enters address
   ↓
2. System finds therapists who service that location
   ↓
3. Stores therapist IDs in window.availableTherapistIds
   ↓
4. Customer proceeds to service selection
   ↓
5. System loads ONLY services offered by available therapists
   ↓
6. Customer sees relevant services only
```

---

## 🔧 STILL TO DO

### Admin UI for Rate Management
**Status:** ⏳ Pending
**What's Needed:**
- Add "Service Rates" section to therapist edit page (`admin/src/pages/therapists/edit.tsx`)
- Table showing:
  - Service name
  - Normal rate (editable)
  - After hours rate (editable)
  - Status (active/inactive)
  - Actions (Edit, Delete, Add)
- Ability to add new service-specific rates
- Validation to ensure rates are positive numbers

### Therapist Portal Updates
**Status:** ⏳ Pending
**What's Needed:**
- Show service-specific rates in therapist profile page (read-only)
- Add "Request Rate Change" button
- Create simple form to request rate adjustments

---

## 🧪 TESTING CHECKLIST

### Database Testing:
- [ ] Create a service-specific rate via SQL
- [ ] Verify it appears in queries
- [ ] Test RLS policies (non-admin cannot INSERT/UPDATE)

### Admin Panel Testing:
- [ ] Create a quote with therapist who has service-specific rate
- [ ] Verify quote uses service-specific rate in calculations
- [ ] Create a quote with therapist who has NO service-specific rate
- [ ] Verify quote falls back to profile default rates
- [ ] Check therapist assignment table shows correct rates

### Customer Portal Testing:
- [ ] Enter address → verify therapist count message
- [ ] Proceed to services → verify ONLY services from available therapists shown
- [ ] Select service → verify correct services appear
- [ ] Book with therapist who has service-specific rate → verify fee correct
- [ ] Weekend booking → verify afterhours rate applied
- [ ] Normal hours booking → verify normal rate applied

### Edge Cases:
- [ ] Therapist offers service but has no service-specific rate → uses profile default
- [ ] Service-specific rate set to inactive → should use profile default
- [ ] No therapists available in area → should show appropriate message
- [ ] Therapist has service-specific rate for Service A but not Service B → mixed rates

---

## 📝 MIGRATION NOTES

- **Existing bookings:** Have `therapist_fee` already calculated - NOT affected
- **Existing therapist profiles:** Keep `hourly_rate` and `afterhours_rate` as fallback defaults
- **No data migration required:** System works with empty `therapist_service_rates` table (uses defaults)
- **Service-specific rates are opt-in:** Only create them for therapists who need different rates per service

---

## 🎯 BENEFITS

### For Business:
✅ Support therapists who offer multiple therapy types at different rates
✅ Flexible pricing per service type (e.g., massage vs osteopathy)
✅ Accurate cost tracking per service category
✅ Better matching of customer needs to available services

### For Customers:
✅ Only see services actually available in their area (no disappointment)
✅ Faster booking process (less scrolling through unavailable options)
✅ Transparent pricing based on service type

### For Therapists:
✅ Fair compensation based on service complexity
✅ Can see their rates per service in portal
✅ Can request rate adjustments

---

## 🔐 SECURITY NOTES

- RLS enabled on `therapist_service_rates` table
- Only admins can modify rates
- All users can SELECT (needed for fee calculation)
- Follows same security model as `therapist_profiles`

---

**Implementation Date:** 2025-12-08
**Status:** Core logic complete, Admin UI pending
