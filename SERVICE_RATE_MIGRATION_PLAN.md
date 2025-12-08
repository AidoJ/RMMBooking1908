# Service-Specific Rate Migration Plan

## Summary
Migrating from therapist-level rates to per-service rates with profile-level fallback.

## Core Logic (COMPLETED ✅)
- `admin/src/services/feeCalculation.ts` - Updated calculateTherapistFee() to accept service_id and query service-specific rates

## Files Requiring Updates

### 1. availabilityService.ts (PRIORITY 1)
**File:** `admin/src/services/availabilityService.ts`
**Status:** ❌ Not Updated
**Required Changes:**
- Function `getAvailableTherapists()` (line 209) - Fetch service-specific rates when service_id is available
- Function `checkQuoteAvailability()` - Pass service_id to rate queries
- Update returned `TherapistAvailability` interface to include both normal and afterhours rates

**Current Code Pattern:**
```typescript
const { data: therapists } = await supabaseClient
  .from('therapist_profiles')
  .select('id, first_name, last_name, email, gender, rating, is_active, hourly_rate, afterhours_rate, ...')
  .eq('is_active', true);
```

**Needs to become:**
```typescript
// Query therapist_service_rates JOIN therapist_profiles
// Fallback to profile rates if no service-specific rate
```

---

### 2. booking.js (Customer Booking Portal) (PRIORITY 2)
**File:** `booking/js/booking.js`
**Status:** ❌ Not Updated
**Required Changes:**
- Function `calculateTherapistFee()` (line 111) - Already queries therapist_profiles, needs to query therapist_service_rates first
- Pass service_id to fee calculation (already available as window.selectedServiceId)

**Current Code (Line 111-169):**
```javascript
async function calculateTherapistFee(dateVal, timeVal, durationVal, therapistId) {
  const { data: therapist } = await window.supabase
    .from('therapist_profiles')
    .select('hourly_rate, afterhours_rate, first_name, last_name')
    .eq('id', therapistId)
    .single();
  // ... uses therapist.hourly_rate and therapist.afterhours_rate
}
```

**Needs:** Add service_id parameter and query therapist_service_rates first

---

### 3. QuoteAvailabilityChecker.tsx (PRIORITY 3)
**File:** `admin/src/components/QuoteAvailabilityChecker.tsx`
**Status:** ⚠️  Partially Ready
**Required Changes:**
- **NO CODE CHANGES NEEDED** - This component uses rates from availabilityService
- Once availabilityService is updated, this will automatically use service-specific rates

---

### 4. bookingCreationService.ts
**File:** `admin/src/services/bookingCreationService.ts`
**Status:** ✅ Already Correct
**Why:** Uses `assignment.hourly_rate` which comes from QuoteAvailabilityChecker → availabilityService
- Once availabilityService is fixed, this automatically uses service-specific rates

---

### 5. edit-platform.tsx (Booking Edit Page)
**File:** `admin/src/pages/bookings/edit-platform.tsx`
**Status:** ⚠️ Needs Investigation
**Note:** Imports calculateTherapistFee but doesn't appear to call it
**Action:** Need to check if there's manual fee calculation happening that needs updating

---

## Implementation Order

### Phase 1: Core Updates (Do First)
1. ✅ Update feeCalculation.ts (DONE)
2. ❌ Update availabilityService.ts
3. ❌ Update booking.js (customer portal)

### Phase 2: Testing
4. Test quote creation with service-specific rates
5. Test customer booking with service-specific rates
6. Test fallback to profile defaults

### Phase 3: Admin UI
7. Create rate management UI in therapist edit page
8. Create bulk rate setting tools
9. Add therapist portal rate viewing/request

---

## Key Concepts

### Rate Lookup Priority:
1. **First:** Check `therapist_service_rates` WHERE therapist_id AND service_id AND is_active = true
2. **Fallback:** Use `therapist_profiles.hourly_rate` and `afterhours_rate`
3. **Error:** If neither exists, throw error

### Time-Based Selection:
- Weekend (Saturday/Sunday) → Use afterhours_rate
- After business hours (before 9am or after 5pm) → Use afterhours_rate
- Normal hours → Use normal_rate

---

## Testing Checklist

- [ ] Create a service-specific rate for a therapist
- [ ] Create a quote with that therapist+service → should use service-specific rate
- [ ] Create a quote with same therapist but different service → should use profile default
- [ ] Customer books service with service-specific rate → fee correct
- [ ] Weekend booking → afterhours_rate applied
- [ ] Normal hours booking → normal_rate applied

---

## Migration Notes

- Existing bookings have therapist_fee already calculated and stored (**DO NOT RECALCULATE**)
- New bookings will use service-specific rates automatically
- No data migration needed for existing therapist profiles (profile rates remain as fallback)
- Service-specific rates are opt-in (only set them for therapists who need different rates per service)

