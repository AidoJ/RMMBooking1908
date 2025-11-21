# Legacy Netlify Functions

**⚠️ IMPORTANT: These files are NOT used by Netlify**

## Why These Files Exist

These `*_legacy.js` files are backups from when the project had duplicate functions in two locations.

## Active Functions Location

**Netlify uses functions from:** `netlify/functions/` (at repository root)

**NOT from:** `booking/netlify/functions/` (this folder)

## What To Edit

Always edit files in: `/netlify/functions/` (root level)

These legacy files are kept as reference only in case we need to recover something.

## Files Renamed to Legacy

- booking-response_legacy.js
- booking-timeout-handler_legacy.js
- cancel-payment-authorization_legacy.js
- capture-payment_legacy_legacy.js
- create-payment-intent_legacy.js
- get-stripe-key_legacy.js
- payment-webhook_legacy.js
- send-sms_legacy.js
- sms-webhook_legacy.js
- therapist-status-update_legacy.js

## Active Files (Still in This Folder)

These files do NOT have duplicates in root, so they remain active:
- cancel-booking.js

Date: 2025-11-21
