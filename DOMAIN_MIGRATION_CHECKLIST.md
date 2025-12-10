# Domain Migration Checklist
## From rmmbook.netlify.app → booking.rejuvenators.com

### ✅ Code Updates (COMPLETED)
All hardcoded domain references have been updated in the codebase.

---

## 🔧 External Service Updates Required

### 1. **Supabase Configuration**
**Why:** Allow API requests from the new domain

**Steps:**
1. Go to Supabase Dashboard → Project Settings → API
2. Update **Site URL** to: `https://booking.rejuvenators.com`
3. Go to Authentication → URL Configuration
4. Update **Redirect URLs** to include:
   - `https://booking.rejuvenators.com/**`
5. Go to Settings → API → CORS
6. Add to allowed origins: `https://booking.rejuvenators.com`

---

### 2. **Stripe Configuration**
**Why:** Webhooks and payment redirects need the new domain

**Steps:**
1. Go to Stripe Dashboard → Developers → Webhooks
2. Find your existing webhook endpoint
3. Update endpoint URL from:
   - `https://rmmbook.netlify.app/.netlify/functions/stripe-webhook`
   - **TO:** `https://booking.rejuvenators.com/.netlify/functions/stripe-webhook`
4. Check Payment Links/Checkout Sessions
   - If any hardcoded success/cancel URLs exist, update them

---

### 3. **Google Maps API**
**Why:** HTTP referrer restrictions need the new domain

**Steps:**
1. Go to Google Cloud Console → APIs & Services → Credentials
2. Find your Maps API Key
3. Click Edit
4. Under "Application restrictions" → "HTTP referrers"
5. Add: `https://booking.rejuvenators.com/*`
6. Keep the old domain temporarily during migration testing
7. Remove old domain after confirming everything works

---

### 4. **Twilio Configuration** (If using SMS)
**Why:** Webhook URLs for SMS responses need updating

**Steps:**
1. Go to Twilio Console → Phone Numbers
2. Select your phone number
3. Update webhook URLs:
   - Messaging → "A MESSAGE COMES IN"
   - Update to: `https://booking.rejuvenators.com/.netlify/functions/sms-webhook`
4. Save changes

---

### 5. **Netlify Environment Variables**
**Why:** Update the URL environment variable

**Steps:**
1. Go to Netlify → Site Settings → Environment Variables
2. Find the `URL` variable
3. Update value to: `https://booking.rejuvenators.com`
4. Redeploy the site for changes to take effect

---

### 6. **DNS/Domain Verification**
**Why:** Ensure the new domain is properly configured

**Check:**
- [ ] Domain points to correct Netlify site
- [ ] SSL certificate is active (HTTPS works)
- [ ] Both `www.booking.rejuvenators.com` and `booking.rejuvenators.com` redirect properly (if applicable)

---

### 7. **Email Service Provider** (If using SendGrid, etc.)
**Why:** Email links and tracking domains

**Steps:**
1. Check if your email provider uses domain authentication
2. Update any hardcoded links in email templates
3. Update sender domain if needed

---

### 8. **Analytics & Monitoring** (Google Analytics, etc.)
**Action:** PENDING - Will set up GA4/GTM after external services are updated

---

## 🧪 Testing Checklist

After updating external services, test these critical flows:

- [ ] **Booking Flow**
  - [ ] Address validation works
  - [ ] Therapist selection loads
  - [ ] Payment processing completes
  - [ ] Confirmation emails sent with correct URLs

- [ ] **Therapist App**
  - [ ] SMS links work (accept/decline bookings)
  - [ ] Client intake form accessible
  - [ ] Status updates work

- [ ] **Admin Panel**
  - [ ] "View Booking Site" button opens correct URL
  - [ ] SMS sending works
  - [ ] Short links generate correctly

- [ ] **Webhooks**
  - [ ] Stripe webhook receives events
  - [ ] Twilio webhook processes SMS
  - [ ] All serverless functions accessible

---

## 📝 Notes

- Keep old domain references in Netlify deployment for a transition period
- Monitor error logs after migration
- Test all payment flows thoroughly before removing old domain from Stripe
- Update any marketing materials, social media links, or documentation with new domain
