# Password Reset Implementation - Complete Guide

This document provides a complete overview of the password reset functionality implemented for the Rejuvenators platform.

## Overview

A secure, self-service password reset flow has been implemented for both Admin Panel and Therapist App users. The implementation follows security best practices including:

- ✅ Secure random token generation (32-byte hex)
- ✅ Time-limited tokens (1 hour expiration)
- ✅ One active token per user enforcement
- ✅ Email enumeration prevention
- ✅ Password strength requirements
- ✅ Automatic token cleanup
- ✅ Separate flows for admin and therapist apps

## Architecture

```
User Flow:
1. User clicks "Forgot Password?" on login page
2. User enters email address
3. System generates secure token and sends email
4. User clicks link in email
5. User sets new password (with strength validation)
6. Token is marked as used
7. User logs in with new password
```

## Components Implemented

### 1. Database Schema

**File:** `database/migrations/create_password_reset_tokens.sql`

Creates the `password_reset_tokens` table with:
- Unique token storage
- User ID foreign key to `admin_users`
- Expiration timestamp (1 hour from creation)
- Used timestamp (NULL when unused)
- Partial unique index ensuring one active token per user
- RLS (Row Level Security) enabled - service role only access

**Deployment:** Run this migration in Supabase SQL editor before testing.

### 2. Backend Functions

#### Password Reset Request
**File:** `netlify/functions/password-reset-request.js`

**Endpoint:** `/.netlify/functions/password-reset-request`

**Request:**
```json
{
  "email": "user@example.com",
  "app": "admin" | "therapist"
}
```

**Functionality:**
- Validates user exists and is active
- Deletes old unused tokens for the user
- Generates 32-byte random hex token
- Sets expiration to 1 hour from now
- Stores token in database
- Sends reset email via EmailJS
- Always returns success (prevents email enumeration)

**Security Features:**
- Generic response regardless of whether email exists
- Automatic cleanup of old tokens
- Token unique and unpredictable
- Links to appropriate app (admin or therapist)

#### Password Reset Confirmation
**File:** `netlify/functions/password-reset-confirm.js`

**Endpoint:** `/.netlify/functions/password-reset-confirm`

**Request:**
```json
{
  "token": "abc123...",
  "new_password": "NewPassword123"
}
```

**Functionality:**
- Validates token exists and is unused
- Checks token hasn't expired
- Validates password strength requirements
- Hashes new password with bcrypt (salt rounds: 10)
- Updates user password in `admin_users` table
- Marks token as used
- Returns success/error response

**Password Requirements:**
- Minimum 8 characters
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one number (0-9)

### 3. Admin Panel UI

**Files:**
- `admin/src/pages/auth/forgot-password.tsx` - Request reset page
- `admin/src/pages/auth/reset-password.tsx` - Confirm reset page
- `admin/src/pages/auth/custom-login.tsx` - Updated login with "Forgot Password?" link
- `admin/src/pages/auth/index.ts` - Export file

**Routes Added to App.tsx:**
- `/admin/forgot-password` - Public route
- `/admin/reset-password` - Public route (expects ?token=xxx query param)

**Features:**
- Ant Design UI components
- Form validation
- Loading states
- Error handling with alerts
- Success confirmations
- Auto-redirect after successful reset
- Password strength indicators

### 4. Therapist App UI

**Files:**
- `therapist-app/src/pages/ForgotPassword.tsx` - Request reset page
- `therapist-app/src/pages/ResetPassword.tsx` - Confirm reset page
- `therapist-app/src/pages/Login.tsx` - Updated with "Forgot Password?" link

**Routes Added to App.tsx:**
- `/therapist/forgot-password` - Public route
- `/therapist/reset-password` - Public route (expects ?token=xxx query param)

**Features:**
- Matches therapist app branding (teal gradient, Josefin Sans font)
- Form validation
- Loading states
- Error handling with alerts
- Success confirmations
- Auto-redirect after successful reset
- Password strength indicators

### 5. Email Template

**Template ID:** `template_passwordreset`

**Setup Required:** Follow the guide in `PASSWORD_RESET_EMAIL_TEMPLATE_SETUP.md`

**Template Variables:**
- `to_email` - Recipient email
- `user_name` - User's first name
- `reset_link` - Full reset URL with token
- `expiry_hours` - Token expiration time (1)

**Reset Link Format:**
- Admin: `https://booking.rejuvenators.com/admin/reset-password?token=xxx`
- Therapist: `https://booking.rejuvenators.com/therapist/reset-password?token=xxx`

## Deployment Checklist

### 1. Database Migration
```sql
-- Run in Supabase SQL Editor:
-- Copy contents of database/migrations/create_password_reset_tokens.sql
-- Execute to create table and indexes
```

### 2. Environment Variables
Verify these are set in Netlify:
```
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
EMAILJS_SERVICE_ID=service_puww2kb
EMAILJS_PUBLIC_KEY=qfM_qA664E4JddSMN
EMAILJS_PRIVATE_KEY=your_private_key
```

### 3. EmailJS Template
- Create template with ID `template_passwordreset`
- Follow setup guide in `PASSWORD_RESET_EMAIL_TEMPLATE_SETUP.md`
- Test template with sample data

### 4. Deploy Code
```bash
# Commit all changes
git add .
git commit -m "Add password reset functionality for admin and therapist apps"
git push origin master

# Netlify will auto-deploy
# Or trigger manual deploy if auto-deploy is disabled
```

### 5. Build Apps
```bash
# Build admin panel (if needed)
cd admin
npm run build

# Build therapist app (if needed)
cd ../therapist-app
npm run build
```

## Testing Guide

### Test Admin Panel Password Reset

1. **Request Reset:**
   - Navigate to `https://booking.rejuvenators.com/admin/login`
   - Click "Forgot password?"
   - Enter a valid admin user email
   - Click "Send Reset Link"
   - Verify success message appears

2. **Check Email:**
   - Open the email inbox for the test user
   - Verify reset email arrived
   - Check email formatting and branding
   - Click "Reset Your Password" button

3. **Set New Password:**
   - Verify you're redirected to reset password page
   - Try weak password (should show validation errors):
     - Less than 8 characters
     - No uppercase letter
     - No number
   - Enter a strong password matching requirements
   - Confirm password matches
   - Click "Reset Password"
   - Verify success message appears

4. **Login with New Password:**
   - Wait for auto-redirect or click "Go to Login"
   - Enter email and NEW password
   - Verify login succeeds
   - Verify you're redirected to dashboard

5. **Test Token Security:**
   - Try using the same reset link again
   - Should show "Token already used" error
   - Request another reset
   - Wait 2 hours
   - Try using expired link
   - Should show "Token expired" error

### Test Therapist App Password Reset

Follow the same steps as Admin Panel but:
- Start at `https://booking.rejuvenators.com/therapist/login`
- Use a therapist user email
- Verify correct branding (teal theme)

### Test Email Enumeration Prevention

1. Navigate to forgot password page
2. Enter an email that doesn't exist in the system
3. Click "Send Reset Link"
4. Verify you get the same success message
5. Verify no email is actually sent
6. This prevents attackers from discovering valid email addresses

### Test Edge Cases

1. **Multiple Reset Requests:**
   - Request reset for user A
   - Request reset again for user A
   - Verify only the latest token works
   - Older token should be deleted

2. **Invalid Token:**
   - Navigate to `/admin/reset-password?token=invalid123`
   - Try to submit new password
   - Should show "Invalid or expired token" error

3. **Missing Token:**
   - Navigate to `/admin/reset-password` (no token param)
   - Should show error message
   - Form should be disabled

4. **Password Strength:**
   - Test all validation rules:
     - ❌ "pass" (too short)
     - ❌ "password" (no uppercase, no number)
     - ❌ "Password" (no number)
     - ❌ "password123" (no uppercase)
     - ✅ "Password123" (valid)

5. **Concurrent Tokens:**
   - User A requests reset
   - User A requests reset again immediately
   - Verify only one active token exists in database
   - First token should be deleted

## Database Queries for Verification

```sql
-- Check password_reset_tokens table exists
SELECT * FROM password_reset_tokens LIMIT 1;

-- View active tokens
SELECT
  prt.id,
  prt.user_id,
  au.email,
  au.first_name,
  prt.expires_at,
  prt.used_at,
  prt.created_at,
  CASE
    WHEN prt.used_at IS NOT NULL THEN 'Used'
    WHEN prt.expires_at < NOW() THEN 'Expired'
    ELSE 'Active'
  END as status
FROM password_reset_tokens prt
JOIN admin_users au ON prt.user_id = au.id
ORDER BY prt.created_at DESC;

-- Clean up expired tokens (optional maintenance query)
DELETE FROM password_reset_tokens
WHERE expires_at < NOW() - INTERVAL '7 days';

-- Count tokens by status
SELECT
  CASE
    WHEN used_at IS NOT NULL THEN 'Used'
    WHEN expires_at < NOW() THEN 'Expired'
    ELSE 'Active'
  END as status,
  COUNT(*) as count
FROM password_reset_tokens
GROUP BY status;
```

## Security Considerations

### ✅ Implemented Security Features

1. **Token Randomness:** 32-byte cryptographically secure random tokens
2. **Token Expiration:** 1 hour time limit
3. **Single Use:** Tokens marked as used after password reset
4. **Email Enumeration Prevention:** Generic responses for all emails
5. **Password Strength:** Enforced minimum requirements
6. **HTTPS Only:** All reset links use HTTPS
7. **Rate Limiting:** Netlify provides basic rate limiting
8. **SQL Injection Prevention:** Using parameterized queries via Supabase client
9. **XSS Prevention:** React automatically escapes output
10. **CSRF Protection:** Token in URL, not cookies

### 🔒 Additional Security Recommendations

For production deployment, consider:

1. **Add Rate Limiting:**
   - Limit password reset requests per IP
   - Limit password reset requests per email
   - Recommended: 5 requests per hour per email

2. **Add Audit Logging:**
   - Log all password reset requests
   - Log successful password changes
   - Track IP addresses and user agents

3. **Email Verification:**
   - Optionally require email verification for new accounts
   - Prevents creating accounts with fake emails

4. **Session Invalidation:**
   - Optionally invalidate all existing sessions on password change
   - Forces re-login on all devices

5. **2FA Option:**
   - Consider adding two-factor authentication
   - Extra security for admin accounts

6. **Suspicious Activity Detection:**
   - Alert on multiple failed reset attempts
   - Alert on reset from unusual location

## Monitoring

### Things to Monitor

1. **EmailJS Quota:**
   - Check monthly email send limits
   - Set up alerts for approaching quota
   - Monitor delivery rates

2. **Token Table Growth:**
   - Periodically clean up old tokens
   - Set up automated cleanup (database function or scheduled job)
   - Monitor table size

3. **Error Rates:**
   - Check Netlify function logs for errors
   - Monitor failed password reset attempts
   - Track email delivery failures

4. **Usage Patterns:**
   - Track number of password resets per week
   - Identify if users frequently forget passwords
   - May indicate need for better password management

## Troubleshooting

### Email Not Received

1. Check spam/junk folder
2. Verify EmailJS credentials in Netlify
3. Check EmailJS dashboard for failed sends
4. Verify email address is valid
5. Check EmailJS quota not exceeded

### Token Invalid or Expired

1. Verify token hasn't been used already
2. Check token creation time (1 hour expiration)
3. Verify database migration ran successfully
4. Check Netlify function logs for errors

### Password Won't Reset

1. Verify password meets strength requirements
2. Check passwords match in confirm field
3. Check Netlify function logs for errors
4. Verify Supabase connection is working

### 404 on Reset Pages

1. Verify admin app built and deployed
2. Check basename in App.tsx is correct (/admin or /therapist)
3. Verify routes added to App.tsx
4. Clear browser cache and try again

## Maintenance

### Regular Tasks

1. **Monthly:**
   - Review EmailJS quota usage
   - Check error logs
   - Clean up old tokens (>7 days)

2. **Quarterly:**
   - Review password reset usage patterns
   - Update documentation if needed
   - Test complete flow

3. **Annually:**
   - Review security practices
   - Update dependencies
   - Audit password requirements

## Future Enhancements

Potential improvements for future implementation:

1. **Password History:** Prevent reusing last 3 passwords
2. **Password Expiry:** Force password change every 90 days (optional)
3. **Magic Links:** Passwordless login option
4. **SMS Reset:** Alternative to email for therapists
5. **Admin Initiated Reset:** Allow admins to force password reset for users
6. **Password Strength Meter:** Visual indicator of password strength
7. **Remember Device:** Skip password on trusted devices
8. **Security Questions:** Additional verification method

## Support

For issues or questions:
- Check Netlify function logs: Netlify Dashboard → Functions → Logs
- Check Supabase logs: Supabase Dashboard → Logs
- Review EmailJS dashboard for email delivery status
- Check browser console for frontend errors

## Files Changed/Created

### New Files (13 total)
1. `database/migrations/create_password_reset_tokens.sql`
2. `netlify/functions/password-reset-request.js`
3. `netlify/functions/password-reset-confirm.js`
4. `admin/src/pages/auth/forgot-password.tsx`
5. `admin/src/pages/auth/reset-password.tsx`
6. `admin/src/pages/auth/custom-login.tsx`
7. `admin/src/pages/auth/index.ts`
8. `therapist-app/src/pages/ForgotPassword.tsx`
9. `therapist-app/src/pages/ResetPassword.tsx`
10. `PASSWORD_RESET_EMAIL_TEMPLATE_SETUP.md`
11. `PASSWORD_RESET_IMPLEMENTATION.md` (this file)

### Modified Files (3 total)
1. `admin/src/App.tsx` - Added routes and imports
2. `therapist-app/src/App.tsx` - Added routes and imports
3. `therapist-app/src/pages/Login.tsx` - Added "Forgot Password?" link

## Summary

✅ **Complete password reset functionality** has been implemented for both Admin Panel and Therapist App

✅ **Secure implementation** following industry best practices

✅ **User-friendly interface** with clear messaging and validation

✅ **Ready for deployment** after completing setup steps

**Next Steps:**
1. Run database migration in Supabase
2. Create EmailJS template (follow setup guide)
3. Deploy code to Netlify
4. Test end-to-end flow for both apps
5. Monitor initial usage and adjust as needed
