# Security Fix Deployment Instructions

## Overview

This deployment fixes the therapist authentication system to use Supabase Auth properly with comprehensive RLS (Row Level Security) policies.

## What Was Fixed

### 1. **Data Issue (Already Fixed)**
- ✅ All 5 existing therapists now have `auth_id` populated correctly
- ✅ They can all login via therapist app

### 2. **Code Fixed**
- ✅ `enroll-therapist.js` now sets `auth_id` instead of `user_id`
- ✅ Deleted deprecated `therapist-auth.js` function
- ✅ New therapist enrollments will work correctly going forward

### 3. **Security Added**
- ✅ Comprehensive RLS policies created for all therapist tables
- ✅ Therapists can only access their own data
- ✅ Admins can access all data
- ✅ Proper authentication-based access control

## Deployment Steps

### Step 1: Deploy Code Changes (Automatic)

The code changes will deploy automatically via Netlify when you push to GitHub:

```bash
git add netlify/functions/enroll-therapist.js
git add netlify/functions/therapist-auth.js  # This file was deleted
git add database/
git commit -m "Fix therapist authentication and add comprehensive RLS policies

- Fix enroll-therapist.js to set auth_id instead of user_id
- Delete deprecated therapist-auth.js function
- Add comprehensive RLS policies for all therapist tables
- Document security architecture

🤖 Generated with Claude Code"
git push
```

### Step 2: Enable RLS Policies (Manual - Run in Supabase)

**IMPORTANT**: Run this SQL in Supabase SQL Editor:

```sql
-- File: database/migrations/002_enable_comprehensive_rls.sql
```

Copy the entire contents of `database/migrations/002_enable_comprehensive_rls.sql` and run it in Supabase SQL Editor.

This will:
- Enable RLS on all therapist tables
- Create policies for therapists (own data only)
- Create policies for admins (all data)

### Step 3: Verify Deployment

#### 3.1 Verify RLS is Enabled

Run this query in Supabase SQL Editor:

```sql
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
```

**Expected Result**: All should show `rls_enabled = true`

#### 3.2 Verify Policies Exist

Run this query:

```sql
SELECT
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename LIKE 'therapist%'
GROUP BY tablename
ORDER BY tablename;
```

**Expected Result**:
- therapist_availability: 4 policies
- therapist_payments: 4 policies
- therapist_profiles: 5 policies
- therapist_service_rates: 3 policies
- therapist_services: 4 policies
- therapist_time_off: 4 policies

#### 3.3 Test Therapist Login

1. Open therapist app: `https://yoursite.com/therapist/`
2. Login with an existing therapist account
3. Verify you can see your profile
4. Verify you can update your availability
5. Verify you can view your bookings

#### 3.4 Test Admin Access

1. Open admin panel: `https://yoursite.com/admin/`
2. Login with admin account
3. Go to Therapists menu
4. Verify you can see all therapist profiles
5. Verify you can edit any therapist

#### 3.5 Test New Enrollment

1. Submit a new therapist registration
2. Admin approves it
3. Admin clicks "Enroll Therapist"
4. Check the new therapist_profiles record:

```sql
SELECT
  first_name,
  last_name,
  email,
  user_id,
  auth_id,
  registration_id
FROM therapist_profiles
ORDER BY created_at DESC
LIMIT 1;
```

**Expected Result**:
- `auth_id` should be populated (UUID from auth.users)
- `user_id` should be NULL
- `registration_id` should point to the registration record

5. New therapist should receive welcome email with temp password
6. New therapist should be able to login to therapist app

## Security Benefits

After deployment:

✅ **Single Authentication System**: All authentication goes through Supabase Auth
✅ **Row-Level Security**: Therapists can only see their own data
✅ **Admin Access**: Admins can manage all data via proper policies
✅ **No Data Leaks**: RLS prevents unauthorized access
✅ **Audit Trail**: All auth events tracked by Supabase
✅ **Password Security**: Handled by Supabase (bcrypt, secure)
✅ **Session Management**: Handled by Supabase
✅ **Email Verification**: Built into Supabase Auth
✅ **Password Reset**: Built into Supabase Auth

## Rollback Plan

If issues occur after enabling RLS:

### Option 1: Disable RLS Temporarily

```sql
ALTER TABLE public.therapist_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapist_availability DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapist_services DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapist_time_off DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapist_service_rates DISABLE ROW LEVEL SECURITY;
-- Note: therapist_payments RLS was already enabled, leave it as is
```

This will temporarily remove security while you investigate.

### Option 2: Drop Specific Problematic Policies

If only one policy is causing issues:

```sql
-- Example: Drop a specific policy
DROP POLICY IF EXISTS "Therapists can view own profile" ON public.therapist_profiles;
```

Then re-enable RLS and the system will work with remaining policies.

### Option 3: Revert Code Changes

```bash
git revert <commit-hash>
git push
```

Netlify will automatically redeploy the previous version.

## Monitoring

After deployment, monitor:

1. **Netlify Function Logs**: Check for any errors in therapist-related functions
2. **Supabase Auth Logs**: Monitor successful/failed login attempts
3. **Supabase Database Logs**: Check for RLS policy violations
4. **User Reports**: Ask therapists to test their access

## Support

If therapists report login issues:

1. Verify their `auth_id` is set:
   ```sql
   SELECT auth_id, email FROM therapist_profiles WHERE email = 'therapist@example.com';
   ```

2. Verify they exist in auth.users:
   ```sql
   SELECT id, email FROM auth.users WHERE email = 'therapist@example.com';
   ```

3. If `auth_id` is NULL, manually fix it:
   ```sql
   UPDATE therapist_profiles
   SET auth_id = (SELECT id FROM auth.users WHERE email = therapist_profiles.email)
   WHERE email = 'therapist@example.com' AND auth_id IS NULL;
   ```

## Files Changed

- `netlify/functions/enroll-therapist.js` - Fixed to set auth_id
- `netlify/functions/therapist-auth.js` - DELETED (deprecated)
- `database/migrations/002_enable_comprehensive_rls.sql` - NEW (RLS policies)
- `database/SECURITY_ARCHITECTURE.md` - NEW (documentation)
- `database/AUDIT_CURRENT_STATE.sql` - NEW (diagnostic tool)
- `database/SIMPLE_AUDIT.sql` - NEW (diagnostic tool)
- `database/DEPLOYMENT_INSTRUCTIONS.md` - THIS FILE

## Questions?

Refer to `database/SECURITY_ARCHITECTURE.md` for complete technical documentation of the security model.
