# 🔒 RLS (Row Level Security) Implementation Guide

## ⚠️ IMPORTANT: READ BEFORE IMPLEMENTING

This guide will help you implement Row Level Security on your Supabase database to protect your customers' data, therapist information, and business data.

---

## 📋 PRE-IMPLEMENTATION CHECKLIST

Before running the RLS policies, ensure:

- [ ] You have a **full database backup**
- [ ] You have **super admin access** to Supabase
- [ ] You have tested the **SQL script in a development environment** (if available)
- [ ] You have read through the **entire RLS policies SQL file**
- [ ] You understand the **security model** (who can access what)
- [ ] You have the **v1.0-stable-working git tag** as a rollback point
- [ ] You have **30-60 minutes** to complete implementation and testing

---

## 🎯 WHAT RLS WILL DO

### ✅ PROTECTIONS ENABLED:

1. **Customer Data Protection:**
   - Customers can only see/edit their own data
   - Other customers cannot access each other's information
   - Admins have full access for support

2. **Booking Privacy:**
   - Customers can only see their own bookings
   - Therapists can only see bookings assigned to them
   - Payment information is protected

3. **Therapist Profile Security:**
   - Public can view basic profiles (for selection)
   - Sensitive data (rates, private contact) hidden from public
   - Therapists can manage their own profiles

4. **Admin Security:**
   - Password hashes protected
   - Role-based access control
   - Activity logging secured

5. **Business Data:**
   - Services, pricing rules remain publicly readable (needed for booking)
   - Discount codes/gift cards: validation only, no browsing
   - System settings readable but only admins can modify

---

## 🚀 IMPLEMENTATION STEPS

### STEP 1: BACKUP YOUR DATABASE (CRITICAL!)

```bash
# In Supabase Dashboard:
1. Go to Database → Backups
2. Click "Create Backup"
3. Wait for completion
4. Download backup locally (optional but recommended)
```

### STEP 2: RUN RLS POLICIES SQL SCRIPT

```bash
# In Supabase Dashboard:
1. Go to SQL Editor
2. Click "New Query"
3. Copy entire contents of database/rls-policies.sql
4. Paste into SQL Editor
5. Click "Run" or press Ctrl+Enter
6. Wait for completion (should take 5-10 seconds)
7. Check for any errors in the output
```

### STEP 3: VERIFY RLS IS ENABLED

```sql
-- Run this query in Supabase SQL Editor:
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
  'customers', 'therapist_profiles', 'bookings', 'booking_status_history',
  'services', 'time_pricing_rules', 'discount_codes', 'gift_cards',
  'admin_users', 'admin_sessions', 'admin_activity_log', 'system_settings'
);
```

**Expected Result:** All tables should show `rowsecurity = true`

### STEP 4: VERIFY POLICIES ARE CREATED

```sql
-- Run this query to see all policies:
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

**Expected Result:** Should see multiple policies per table (select, insert, update, delete)

---

## 🧪 TESTING CHECKLIST

After implementing RLS, test these scenarios:

### Test 1: Customer Booking Flow (Most Critical)
- [ ] Navigate to customer booking page
- [ ] Can select services (should work - public read)
- [ ] Can select therapist (should work - public read)
- [ ] Can submit booking (should work - anon insert)
- [ ] Booking appears in database
- [ ] Customer receives confirmation email

**Expected Result:** ✅ Booking flow should work exactly as before

---

### Test 2: Therapist Accept/Decline
- [ ] Create test booking
- [ ] Click accept link from therapist email
- [ ] Booking status updates to 'confirmed'
- [ ] Confirmation emails sent

**Expected Result:** ✅ Therapist response should work as before

---

### Test 3: Admin Panel Access
- [ ] Log into admin panel
- [ ] View bookings list (should see all bookings)
- [ ] View customer list (should see all customers)
- [ ] View therapist list (should see all therapists)
- [ ] Edit a booking (should work)
- [ ] View system settings (should work)

**Expected Result:** ✅ Admin should have full access to all data

---

### Test 4: Security Verification (Critical)
- [ ] Open browser console (F12)
- [ ] Go to customer booking page (NOT logged in as admin)
- [ ] Try to query all customers directly via Supabase client:
```javascript
// Should FAIL or return empty
const { data, error } = await window.supabase
  .from('customers')
  .select('*');
console.log(data); // Should be empty or error
```
- [ ] Try to query all bookings:
```javascript
// Should FAIL or return empty
const { data, error } = await window.supabase
  .from('bookings')
  .select('*');
console.log(data); // Should be empty or error
```

**Expected Result:** ✅ Queries should return empty arrays or errors (access denied)

---

### Test 5: Netlify Functions
- [ ] Create new booking (uses Netlify functions with service role)
- [ ] Timeout handler runs (check logs)
- [ ] Email/SMS notifications send

**Expected Result:** ✅ All server-side functions should work (service role bypasses RLS)

---

## 🚨 TROUBLESHOOTING

### Issue 1: "Error: new row violates row-level security policy"

**Cause:** Policy is too restrictive  
**Solution:** Check the `WITH CHECK` clause in the policy - may need to adjust

### Issue 2: Booking form doesn't work anymore

**Cause:** Anonymous users can't insert bookings  
**Solution:** Verify `bookings_insert_anon` policy exists:
```sql
SELECT * FROM pg_policies 
WHERE tablename = 'bookings' 
AND policyname = 'bookings_insert_anon';
```

### Issue 3: Admin panel shows no data

**Cause:** Admin user not in admin_users table or is_active = false  
**Solution:** 
```sql
-- Check admin user exists:
SELECT * FROM admin_users WHERE email = 'your-admin-email@example.com';

-- If not active, update:
UPDATE admin_users 
SET is_active = true 
WHERE email = 'your-admin-email@example.com';
```

### Issue 4: Therapist can't accept bookings

**Cause:** Therapist policies too restrictive  
**Solution:** Verify therapist has correct ID in therapist_profiles table

### Issue 5: Services don't show on booking form

**Cause:** Services RLS policy blocking public read  
**Solution:** Verify `services_select_all` policy exists and allows public read

---

## 🔄 ROLLBACK PROCEDURE

If RLS causes critical issues, you can temporarily disable it:

### OPTION 1: Disable RLS Temporarily (Quick Fix)

```sql
-- Disable RLS on problematic table(s):
ALTER TABLE public.bookings DISABLE ROW LEVEL SECURITY;

-- Or disable all:
ALTER TABLE public.customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapist_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_status_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.services DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_pricing_rules DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_codes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_cards DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_activity_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings DISABLE ROW LEVEL SECURITY;
```

**WARNING:** This removes all security protections!

### OPTION 2: Drop All Policies (Clean Slate)

```sql
-- Drop all RLS policies:
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
            r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;
```

### OPTION 3: Restore from Backup

```bash
# In Supabase Dashboard:
1. Go to Database → Backups
2. Find the backup before RLS implementation
3. Click "Restore"
4. Confirm restoration
5. Wait for completion (may take several minutes)
```

---

## 📊 MONITORING RLS PERFORMANCE

After implementation, monitor:

1. **Query Performance:**
   - Check if booking queries are slower
   - Monitor admin panel load times
   - Watch Netlify function execution times

2. **Error Rates:**
   - Check Supabase logs for RLS policy violations
   - Monitor Netlify function errors
   - Check customer booking success rate

3. **User Feedback:**
   - Test with real users if possible
   - Monitor support tickets for access issues
   - Check therapist feedback on acceptance flow

---

## ✅ POST-IMPLEMENTATION CHECKLIST

After implementing and testing RLS:

- [ ] All tests passed
- [ ] No critical errors in Supabase logs
- [ ] Customer booking flow works
- [ ] Therapist acceptance works
- [ ] Admin panel fully functional
- [ ] Netlify functions operational
- [ ] Security verified (can't access other users' data)
- [ ] Performance is acceptable
- [ ] Backup verified and stored safely
- [ ] Team notified of security update
- [ ] Documentation updated

---

## 📞 SUPPORT

If you encounter issues during RLS implementation:

1. **Check Supabase Logs:** Database → Logs
2. **Review Policy Definitions:** SQL Editor → Run verification queries
3. **Test with Service Role:** Temporarily bypass RLS using service role key
4. **Rollback if Critical:** Use rollback procedures above
5. **Restore from Backup:** Last resort if rollback doesn't work

---

## 🎯 NEXT STEPS AFTER RLS

Once RLS is implemented and tested:

1. **Rotate API Keys** - Change exposed keys (especially anon key)
2. **Add Input Validation** - Server-side validation in Netlify functions
3. **Implement Rate Limiting** - Protect against abuse
4. **Add CSRF Protection** - Secure admin panel forms
5. **Enable Audit Logging** - Track all data access

---

**REMEMBER:** Security is a process, not a one-time task. Keep monitoring and updating!


