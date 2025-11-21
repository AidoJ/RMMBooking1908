# Netlify Functions - Where to Edit

## ⚠️ IMPORTANT: Always Edit in `/netlify/functions/` (Root)

Netlify is configured to use functions from the **root** `netlify/functions/` directory, NOT from `booking/netlify/functions/`.

## File Locations

### ✅ ACTIVE (Edit These)
**Location:** `/netlify/functions/`

These are the files Netlify actually deploys and runs:
- admin-auth.js
- admin-data.js
- booking-response.js ← Edit this one
- booking-timeout-handler.js ← Edit this one
- cancel-payment-authorization.js
- capture-payment.js
- create-booking.js ← Edit this one
- create-customer.js
- create-gift-card-payment.js
- create-payment-intent.js
- create-short-link.js
- customer-lookup.js
- generate-invoice-pdf.js
- generate-quote-pdf.js
- get-stripe-key.js
- payment-webhook.js
- quote-response.js
- s.js
- schedule-review-request.js
- send-scheduled-notifications.js
- send-sms.js
- sms-webhook.js
- therapist-auth.js
- therapist-response.js
- therapist-status-update.js
- update-therapist-password.js
- user-management.js

### 📦 LEGACY (Backup Only - Do NOT Edit)
**Location:** `/booking/netlify/functions/*_legacy.js`

These files are backups/archives. They are NOT used by Netlify.

### 📋 Also in Booking Folder (No Duplicate)
**Location:** `/booking/netlify/functions/`
- cancel-booking.js (gets copied to dist during build)

## Why This Structure?

The `netlify.toml` configuration:
```toml
[build]
  publish = "dist"
  functions = "netlify/functions"  ← Relative to repository root
```

This means Netlify looks for functions at `/netlify/functions/`, not `/dist/netlify/functions/`.

## Quick Reference

**Need to edit a function?** → Check `/netlify/functions/` first
**Can't find it there?** → It might be unique to `/booking/netlify/functions/`
**See a `*_legacy.js` file?** → Don't edit it, it's an archive

---
Last Updated: 2025-11-21
