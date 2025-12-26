# Security Architecture - Comprehensive Fix Plan

## Current State Analysis

### ✅ What's Working (Frontend)
Both admin and therapist apps are **correctly** using Supabase Auth:

**Admin Panel (`admin/src/authProvider.ts`)**:
```typescript
// Line 16-19: Correct Supabase Auth
await realSupabaseClient.auth.signInWithPassword({ email, password });

// Line 43-47: Correct profile lookup
const { data: adminUser } = await realSupabaseClient
  .from('admin_users')
  .select('*')
  .eq('auth_id', data.user.id)  // ✓ Uses auth_id
  .single();
```

**Therapist App (`therapist-app/src/pages/Login.tsx`)**:
```typescript
// Line 18-21: Correct Supabase Auth
await supabaseClient.auth.signInWithPassword({ email, password });

// Line 34-38: Correct profile lookup
const { data: therapistProfile } = await supabaseClient
  .from('therapist_profiles')
  .select('*')
  .eq('auth_id', data.user.id)  // ✓ Uses auth_id
  .single();
```

### ❌ What's Broken (Backend)

#### 1. **enroll-therapist.js Sets Wrong Field**
```javascript
// Line 99-135: WRONG - Sets user_id instead of auth_id
const therapistProfileData = {
  user_id: authUser.user.id,  // ❌ WRONG FIELD!
  // Should be: auth_id: authUser.user.id
  ...
};
```

**Impact**: When new therapists are enrolled, their profile gets `user_id` set to auth.users.id instead of `auth_id`. Then when they try to login, the therapist app looks for `auth_id` and finds nothing, causing "Access denied".

#### 2. **therapist-auth.js Exists (Deprecated)**
This function authenticates against `admin_users` table using bcrypt passwords instead of Supabase Auth. It should NOT be used anymore and should be deleted.

#### 3. **No RLS Policies Exist**
According to schema audit:
- `therapist_profiles` - NO RLS ❌
- `therapist_availability` - NO RLS ❌
- `therapist_services` - NO RLS ❌
- `therapist_time_off` - NO RLS ❌
- `therapist_payments` - NO RLS ❌
- `therapist_service_rates` - NO RLS ❌

**Impact**: All therapist data is accessible to anyone with database access.

#### 4. **Functions Use SERVICE_ROLE_KEY (Bypassing RLS)**
39 functions use `SUPABASE_SERVICE_ROLE_KEY` which bypasses RLS completely. This was done as a workaround instead of implementing proper RLS policies.

## Target Architecture

### Authentication Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    SUPABASE AUTH                            │
│                    (auth.users)                             │
│              - Single source of truth                        │
│              - Handles passwords, sessions, tokens          │
└──────────────┬────────────────────────┬─────────────────────┘
               │                        │
               ▼                        ▼
      ┌────────────────┐      ┌────────────────────┐
      │  admin_users   │      │ therapist_profiles │
      │                │      │                    │
      │ auth_id ──────────────── auth_id           │
      │ role           │      │ therapist data     │
      │ admin data     │      │                    │
      └────────────────┘      └────────────────────┘
               │                        │
               │                        │
               ▼                        ▼
      Admin operations          Therapist operations
      (via RLS policies)        (via RLS policies)
```

### Table Structure

**admin_users**:
- `id` (uuid, PK) - admin_users table primary key
- `auth_id` (uuid, FK → auth.users.id) - Links to Supabase Auth
- `email`, `first_name`, `last_name`, `role`
- Legacy `password` field (will be ignored, auth handled by Supabase)

**therapist_profiles**:
- `id` (uuid, PK) - therapist_profiles table primary key
- `auth_id` (uuid, FK → auth.users.id) - Links to Supabase Auth
- `user_id` (uuid, FK → admin_users.id) - LEGACY field, will be NULL going forward
- `registration_id` (uuid, FK → therapist_registrations.id)
- All therapist profile data

### RLS Policy Strategy

#### Public Tables (No RLS):
- `services` - Public service catalog
- `duration_pricing` - Public pricing rules
- `time_pricing_rules` - Public pricing rules
- `system_settings` (some)- Only read-only settings

#### Protected with RLS:
All therapist tables must have RLS:

**therapist_profiles**:
- Therapists can read/update ONLY their own profile (WHERE auth_id = auth.uid())
- Admins can read/update ALL profiles
- Service role can do everything (for admin functions)

**therapist_availability, therapist_time_off, therapist_services, therapist_service_rates**:
- Therapists can read/update ONLY their own records (WHERE therapist_id = (SELECT id FROM therapist_profiles WHERE auth_id = auth.uid()))
- Admins can read/update ALL records
- Service role can do everything

**therapist_payments**:
- Therapists can read ONLY their own payments
- Therapists can insert/update their own draft payments
- Only admins can approve/process payments
- Service role can do everything

**bookings**:
- Therapists can read ONLY bookings assigned to them
- Therapists can update booking status (limited fields)
- Customers can read their own bookings
- Admins can read/update ALL bookings

## Implementation Plan

### Phase 1: Data Migration (Fix Existing Records)

**File**: `database/migrations/fix_therapist_auth_migration.sql`

1. For existing therapists in `therapist_profiles`:
   - If `user_id` is set and `auth_id` is NULL:
     - Find corresponding `auth.users` record via `admin_users` where `admin_users.id = therapist_profiles.user_id`
     - Set `therapist_profiles.auth_id` to `admin_users.auth_id`
   - If both are set, prioritize `auth_id`
   - Log any orphaned records

### Phase 2: Fix Enrollment Function

**File**: `netlify/functions/enroll-therapist.js`

Change line 100:
```javascript
// BEFORE:
user_id: authUser.user.id,

// AFTER:
auth_id: authUser.user.id,
user_id: null,  // Legacy field, not used anymore
```

### Phase 3: Create Comprehensive RLS Policies

**File**: `database/migrations/enable_rls_policies.sql`

For each protected table:
1. Enable RLS
2. Create policy for therapists (own data only)
3. Create policy for admins (all data)
4. Create policy for service role (bypass)

### Phase 4: Update Functions to Use Proper Auth

**Categories**:

**A. Admin Functions (Continue using SERVICE_ROLE_KEY)**:
- `admin-data.js`
- `admin-auth.js`
- `user-management.js`
- `enroll-therapist.js` (admin action)
- All admin panel CRUD operations

**B. Therapist Functions (Use Authenticated Client with RLS)**:
- `therapist-get-intake-form.js` - Should use auth token
- `therapist-get-invoices.js` - Should use auth token
- `therapist-submit-invoice.js` - Should use auth token
- `therapist-response.js` - Should use auth token
- `therapist-status-update.js` - Should use auth token
- Any therapist app API calls

**C. Public Functions (Use ANON_KEY)**:
- `create-booking.js` - Public booking creation
- `get-system-settings.js` - Public settings
- `therapist-registration-submit.js` - Public registration

### Phase 5: Remove Deprecated Code

1. Delete `netlify/functions/therapist-auth.js`
2. Update any code that references it

### Phase 6: Testing

1. Enroll new therapist → verify `auth_id` is set correctly
2. Login as therapist → verify can access own data only
3. Login as admin → verify can access all data
4. Verify therapist cannot access other therapist's data
5. Run security audit queries

## Security Benefits

After implementation:
- ✅ Single authentication system (Supabase Auth)
- ✅ Row-level security prevents data leaks
- ✅ Therapists can only access their own data
- ✅ Admins have full access via proper policies
- ✅ No more SERVICE_ROLE_KEY workarounds for therapist functions
- ✅ Audit trail via auth.users
- ✅ Password management handled by Supabase (secure, tested)
- ✅ Session management handled by Supabase
- ✅ Email verification, password reset, etc. all built-in

## Rollback Plan

If issues occur:
1. Database migration includes rollback script
2. Keep SERVICE_ROLE_KEY functions unchanged initially
3. Test RLS policies with SELECT queries before enabling
4. Can disable RLS temporarily if needed: `ALTER TABLE table_name DISABLE ROW LEVEL SECURITY;`
