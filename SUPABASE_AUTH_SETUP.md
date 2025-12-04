# Supabase Auth Setup Guide

## What Changed:

The therapist app now uses proper Supabase Authentication instead of custom JWT tokens in localStorage.

## Benefits:

✅ Secure httpOnly cookies (no XSS vulnerabilities)
✅ Database-level security with RLS policies
✅ No more "unrestricted table" warnings
✅ Automatic session management
✅ Therapists can only access their own data

## Setup Steps:

### 1. Add Environment Variable to Netlify

1. Go to your Netlify Dashboard
2. Navigate to: Site Settings → Environment Variables
3. Add new variable:
   - **Key:** `SUPABASE_SERVICE_ROLE_KEY`
   - **Value:** Your Supabase service role key (find in Supabase Dashboard → Project Settings → API → service_role key)
   - **Scopes:** Select "All" or at minimum "Functions"

### 2. Run SQL Script to Enable RLS

1. Go to Supabase Dashboard → SQL Editor
2. Copy and paste entire contents of `migrate-therapists-to-supabase-auth.sql`
3. Click "Run"
4. Verify policies are created

### 3. Creating New Therapists (Admin Panel)

**It's now automatic!** When you create a new therapist in the admin panel:

1. Admin creates therapist with email/password
2. System automatically creates Supabase auth user
3. System creates therapist_profiles record linked to auth user
4. Done! Therapist can login immediately

No manual steps needed in Supabase Dashboard.

### 4. Migrating Existing Test Therapists (One-Time)

For each existing test therapist:

1. Go to Supabase Dashboard → Authentication → Users
2. Click "Add user" → "Create new user"
3. Enter:
   - Email: (therapist's email)
   - Password: (create a temp password, they can change it)
   - Auto Confirm User: YES
4. After creating, copy the user ID
5. Run this SQL:
   ```sql
   UPDATE therapist_profiles
   SET user_id = 'PASTE_USER_ID_HERE'
   WHERE email = 'therapist@email.com';
   ```

### 5. Test Login

1. Go to therapist app login page
2. Login with therapist email + password
3. Should see dashboard
4. Try submitting an invoice - should work with proper security!

## Troubleshooting:

**"new row violates row-level security"**
- Make sure you ran the SQL script from step 2
- Check therapist_profiles.user_id matches their auth user ID

**"Failed to create auth user"**
- Check SUPABASE_SERVICE_ROLE_KEY is set in Netlify
- Redeploy admin panel after adding environment variable

**"This account is not registered as a therapist"**
- Make sure therapist_profiles record exists with correct user_id

## Security Notes:

- Service role key is kept server-side only (Netlify functions)
- Never exposed to client browser
- Auth tokens stored in secure httpOnly cookies
- RLS policies enforce data access at database level
