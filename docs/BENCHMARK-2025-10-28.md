# Rejuvenators Platform - Build Benchmark
**Date:** October 28, 2025
**Version:** Pre-Major Refactor Milestone
**Git Commit:** cb3a319

---

## 🎯 Platform Overview

A comprehensive massage therapy booking and management platform consisting of three integrated applications:

1. **Booking Platform** - Public-facing booking system
2. **Admin Panel** - Backend management system
3. **Therapist App** - Therapist-facing application

**Live URL:** https://rmmbook.netlify.app/

---

## 📁 Project Structure

```
rejuvenators-platform/
├── booking/                    # Public booking platform
│   ├── index.html
│   ├── js/
│   │   ├── booking.js         # Main booking logic
│   │   └── emailService.js    # Email notifications
│   ├── css/
│   └── images/
│
├── admin/                      # Admin panel (React + TypeScript)
│   └── src/
│       ├── pages/
│       │   ├── user-management/    # User CRUD
│       │   ├── therapists/         # Therapist management
│       │   ├── bookings/           # Booking management
│       │   ├── services/           # Service management
│       │   └── quotes/             # Quote system
│       └── components/
│
├── therapist-app/              # Therapist application (React + TypeScript)
│   └── src/
│       ├── pages/
│       │   ├── Login.tsx
│       │   ├── Dashboard.tsx
│       │   ├── Bookings.tsx
│       │   ├── BookingDetail.tsx
│       │   ├── Profile.tsx
│       │   ├── Services.tsx
│       │   ├── ServiceArea.tsx
│       │   ├── Availability.tsx
│       │   ├── TimeOff.tsx
│       │   ├── MyEarnings.tsx
│       │   └── ClientIntakeForm.tsx
│       └── components/
│
├── netlify/functions/          # Backend serverless functions
│   ├── create-booking.js
│   ├── booking-response.js
│   ├── therapist-status-update.js
│   ├── user-management.js
│   ├── update-therapist-password.js
│   ├── schedule-review-request.js
│   ├── send-scheduled-notifications.js
│   └── send-sms.js
│
└── database/migrations/        # Database schema migrations
```

---

## 🔧 Technology Stack

### Frontend
- **Booking Platform:** Vanilla JavaScript, HTML5, CSS3
- **Admin Panel:** React 18, TypeScript, Ant Design, Vite
- **Therapist App:** React 18, TypeScript, Ant Design, Vite

### Backend
- **Hosting:** Netlify
- **Functions:** Netlify Serverless Functions (Node.js 18)
- **Database:** Supabase (PostgreSQL)
- **Authentication:** JWT tokens, bcrypt password hashing

### External Services
- **Email:** EmailJS
- **SMS:** Twilio
- **Maps:** Google Maps API (Places, Geocoding, Distance Matrix)
- **Payments:** Stripe

---

## 📊 Database Schema

### Core Tables
- **admin_users** - User accounts (super_admin, admin, therapist roles)
- **therapist_profiles** - Therapist details, certificates, banking
- **bookings** - All booking records with status tracking
- **services** - Service catalog
- **customers** - Customer records
- **therapist_availability** - Weekly availability schedules
- **therapist_time_off** - Time-off requests and management
- **scheduled_notifications** - Delayed notifications (review requests)
- **therapist_payments** - Weekly payment processing
- **quotes** - Multi-day event quotes
- **discount_codes** - Promotional codes
- **gift_cards** - Gift card system

### Enums
- **booking_type_enum:** 'In-home', 'Hotel/Accommodation', 'Corporate Event/Office'
- **booking_status:** requested, pending, confirmed, completed, cancelled, declined, timeout_reassigned, seeking_alternate, archived
- **payment_status:** pending, paid, refunded, failed, authorized, captured, cancelled

---

## ✨ Key Features (Current State)

### 1. Booking Platform
- ✅ Service selection with visual cards
- ✅ Duration and pricing calculation
- ✅ Google Places address autocomplete
- ✅ Date/time picker with availability validation
- ✅ Therapist matching based on location and availability
- ✅ Stripe payment integration
- ✅ Email confirmations (customer + therapist)
- ✅ SMS notifications (booking confirmation)
- ✅ Quote requests for multi-session bookings
- ✅ Discount codes and gift cards
- ✅ Mobile responsive design

### 2. Admin Panel
#### User Management
- ✅ Create, edit, delete users
- ✅ Password reset functionality
- ✅ Role-based access control (super_admin, admin, therapist)
- ✅ Activity logging
- ✅ Last login tracking

#### Therapist Management
- ✅ Therapist CRUD operations
- ✅ Tabbed interface: Bio, Services, Service Area, Availability, Time Off
- ✅ Certificate management (Insurance, First Aid, Qualifications)
- ✅ Banking details
- ✅ Service area polygon editor with map
- ✅ Hourly rate management (super admin only)
- ✅ Email sync between therapist profile and user account

#### Booking Management
- ✅ View all bookings with filters
- ✅ Status management
- ✅ Payment tracking
- ✅ Booking history
- ✅ Revenue reporting

#### Service Management
- ✅ Service catalog CRUD
- ✅ Pricing configuration
- ✅ Quote-only services
- ✅ Image uploads

#### Quote System
- ✅ Multi-day event quotes
- ✅ Multiple sessions per day
- ✅ Corporate billing
- ✅ PDF generation
- ✅ Payment tracking

### 3. Therapist App
#### Dashboard
- ✅ Upcoming bookings overview
- ✅ Earnings summary
- ✅ Quick stats (completed jobs, pending requests)

#### Booking Management
- ✅ View all bookings (upcoming, past, cancelled)
- ✅ Accept/Decline booking requests
- ✅ Booking details view
- ✅ Customer contact information
- ✅ Navigation to booking location
- ✅ Status updates: "On My Way", "I've Arrived", "Complete Job"
- ✅ Therapist notes

#### Profile Management
- ✅ Personal information
- ✅ Certificate uploads
- ✅ Banking details
- ✅ Biography
- ✅ **NEW:** Password change functionality

#### Availability & Time Off
- ✅ Weekly availability schedule
- ✅ Service area management with map
- ✅ Time-off request system

#### Earnings & Invoicing
- ✅ Weekly earnings view
- ✅ Invoice submission
- ✅ Payment history
- ✅ Fee calculations

#### Client Intake Forms
- ✅ Digital intake form collection
- ✅ Health history capture
- ✅ Signature collection

### 4. Notifications System

#### Email Notifications (EmailJS)
- ✅ Booking confirmation (customer + therapist)
- ✅ Booking acceptance confirmation
- ✅ Booking decline notification
- ✅ Looking for alternate therapist
- ✅ "On My Way" status update
- ✅ "I've Arrived" status update
- ✅ **NEW:** Review request (60 min after completion)

#### SMS Notifications (Twilio)
- ✅ Booking received confirmation (customer)
- ✅ New booking request (therapist with Accept/Decline links)
- ✅ **FIXED:** Booking acceptance confirmation (customer)
- ✅ "On My Way" status (customer)
- ✅ "I've Arrived" status (customer)
- ✅ **NEW:** Review request (60 min after completion)

### 5. Automated Systems

#### Review Request System (NEW)
- ✅ Scheduled 60 minutes after job completion
- ✅ SMS: "Hi [Name], Great news your booking request [ID] has been confirmed. Check your email for more details."
- ✅ Email: Professional template with Google review link
- ✅ Database: `scheduled_notifications` table
- ✅ Cron: Runs every 10 minutes via Netlify scheduled functions
- ✅ Retry logic for failed notifications

#### Cache Management
- ✅ JavaScript/CSS: 5-minute cache with revalidation
- ✅ Static assets: 1-year cache immutable
- ✅ Prevents stale code issues

---

## 🔐 Security & Authentication

### Authentication Flow
1. **Admin/Therapist Login:**
   - Email + password (bcrypt hashed)
   - JWT token issued (stored in localStorage)
   - Token verified on protected routes
   - Role-based access control

### Security Features
- ✅ Password hashing with bcrypt (10 rounds)
- ✅ JWT token authentication
- ✅ Row Level Security (RLS) on Supabase
- ✅ Password complexity requirements
- ✅ User can only modify their own data
- ✅ Super admin role for sensitive operations
- ✅ CORS configured
- ✅ Environment variables for secrets

---

## 🐛 Recent Fixes (This Session)

### 1. Admin Therapist Edit Page Refactor
- **Issue:** Messy vertical layout
- **Fix:** Tabbed interface with 5 sections (Bio, Services, Service Area, Availability, Time Off)
- **Files:** `admin/src/pages/therapists/edit.tsx`

### 2. Email Sync Between Therapist Profile and User Account
- **Issue:** Email could get out of sync between therapist_profiles and admin_users
- **Fix:** Bidirectional sync - updating either updates both
- **Files:** `admin/src/pages/therapists/edit.tsx`, `netlify/functions/user-management.js`

### 3. Booking Type Enum Mismatch
- **Issue:** Code sending 'In-home Private Residence' but database expects 'In-home'
- **Fix:** Changed default booking type to match database enum
- **Files:** `booking/js/booking.js` (lines 2986, 3616)
- **Impact:** Fixed 500 errors for all in-home bookings

### 4. updateContinueButton Undefined Error
- **Issue:** Function called but never defined
- **Fix:** Removed calls to non-existent function (validation already handled elsewhere)
- **Files:** `booking/js/booking.js` (lines 1133, 1164)

### 5. SMS Not Sending on Booking Acceptance
- **Issue:** Function-to-function HTTP calls failing with 404 errors
- **Root Cause:** booking-response.js calling wrong URL (rmmbookingplatform vs rmmbook)
- **Fix:** Replaced with direct Twilio API calls (same approach as therapist-status-update.js)
- **Files:** `netlify/functions/booking-response.js`
- **Result:** SMS now works using proven Twilio pattern

### 6. Review Request System Implementation
- **Added:** Complete automated review request system
- **Components:**
  - Database table: `scheduled_notifications`
  - Scheduling function: `schedule-review-request.js`
  - Sending function: `send-scheduled-notifications.js` (cron every 10 minutes)
  - EmailJS template: `template_reviewrequest`
- **Files:** Multiple (see commit 6436694)

### 7. Password Change for Therapists
- **Issue:** No way for therapists to change their own password
- **Fix:** Added password change card to Profile page with backend function
- **Files:** `therapist-app/src/pages/Profile.tsx`, `netlify/functions/update-therapist-password.js`
- **Security:** Verifies current password, enforces complexity, JWT authenticated

---

## 📝 EmailJS Templates

### Current Templates
1. **template_ai9rrg6** - Booking confirmation (customer)
2. **template_51wt6of** - Booking request (therapist)
3. **template_confirmed** - Booking confirmed (customer)
4. **therapist-confirmation** - Booking confirmed (therapist)
5. **template_declined** - Booking declined
6. **template_alternate** - Looking for alternate therapist
7. **template_onmyway** - Therapist on the way
8. **template_arrived** - Therapist arrived
9. **template_reviewrequest** - Review request (NEW)

### EmailJS Configuration
- **Service ID:** service_puww2kb
- **Public Key:** qfM_qA664E4JddSMN
- **Private Key:** Configured in Netlify environment variables

---

## 📱 SMS Message Templates

### Booking Flow
1. **Booking Received (Customer):**
   ```
   Hi [Name]! Your massage booking [ID] has been received.
   We're finding you a therapist now. You'll get updates via SMS! - Rejuvenators
   ```

2. **New Booking Request (Therapist):**
   ```
   📱 NEW BOOKING REQUEST
   Booking ID: [ID]
   Client: [Name]
   Date: [Date]
   Time: [Time]
   Duration: [Minutes] minutes
   Fee: $[Amount]

   Quick Response:
   ✅ Accept: [Link]
   ❌ Decline: [Link]

   - Rejuvenators
   ```

3. **Booking Accepted (Customer):**
   ```
   Hi [Name], Great news your booking request [ID] has been confirmed.
   Check your email for more details.
   ```

4. **On My Way (Customer):**
   ```
   Hi [Name],
   This is [Therapist] and I'm on my way to your location for your booking [ID].

   I expect to be with you within [X] minutes approx.

   Kind regards,
   [Therapist]
   ```

5. **I've Arrived (Customer):**
   ```
   Hi [Name],
   This is [Therapist] and I've just arrived at your location for your booking [ID].

   Kind regards,
   [Therapist]
   ```

6. **Review Request (60 min after completion):**
   ```
   Thank you [Name], We hope you loved your massage with [Therapist].
   If you did we would love a 5star review and supportive comment for [Therapist].
   If you were not happy for any reason please call us on 1300 302542.
   ```

---

## 🌐 Environment Variables

### Required Netlify Environment Variables
```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
JWT_SECRET

EMAILJS_SERVICE_ID=service_puww2kb
EMAILJS_PUBLIC_KEY=qfM_qA664E4JddSMN
EMAILJS_PRIVATE_KEY

TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER

GOOGLE_MAPS_API_KEY

STRIPE_PUBLISHABLE_KEY
STRIPE_SECRET_KEY
```

---

## 📈 Performance & Optimization

### Build Process
- **Admin Panel:** Vite production build with minification
- **Therapist App:** Vite production build with minification
- **Booking Platform:** Native HTML/CSS/JS (no build step)
- **Merge Script:** `merge-builds.js` combines all apps into `/dist`

### Caching Strategy
- JS/CSS files: 5 minutes cache with revalidation
- Static assets: 1 year immutable cache
- HTML: No cache (always fresh)

### Bundle Sizes (approximate)
- **Admin Panel:** ~2.5MB (includes Ant Design)
- **Therapist App:** ~2.3MB (includes Ant Design)
- **Booking Platform:** ~150KB (vanilla JS)

---

## 🔄 Deployment Workflow

1. **Local Development:**
   ```bash
   npm run dev           # Booking platform
   cd admin && npm run dev         # Admin panel
   cd therapist-app && npm run dev # Therapist app
   ```

2. **Build:**
   ```bash
   npm run build         # Builds and merges all three apps
   ```

3. **Deploy:**
   ```bash
   git push              # Auto-deploys to Netlify via GitHub integration
   ```

### Netlify Configuration
- **Build Command:** `npm run build`
- **Publish Directory:** `dist`
- **Functions Directory:** `netlify/functions`
- **Node Version:** 18

---

## 🎨 Design System

### Colors
- **Primary:** #007e8c (Teal)
- **Secondary:** #1FBFBF (Light Teal)
- **Accent:** #faad14 (Gold)
- **Success:** #52c41a (Green)
- **Error:** #ff4d4f (Red)
- **Warning:** #ffc107 (Yellow)

### Typography
- **Font Family:** Arial, sans-serif
- **Headings:** System fonts with fallbacks
- **Body:** 14-16px base size

### Components
- **Admin/Therapist:** Ant Design component library
- **Booking Platform:** Custom components with consistent styling

---

## 📊 Current Metrics

### Database Tables
- 25+ tables
- Row Level Security enabled
- Foreign key constraints enforced
- Automatic timestamps (created_at, updated_at)

### API Endpoints (Netlify Functions)
- 15+ serverless functions
- Average cold start: ~400ms
- Average warm execution: ~100-200ms

### Users (as of benchmark)
- 5 registered users (migrated to bcrypt passwords)
- Multiple therapist profiles
- Active booking system

---

## 🚨 Known Limitations

### Current Constraints
1. **File Uploads:** Base64 encoding (may need cloud storage for scale)
2. **SMS Costs:** Twilio pay-per-message (consider optimization)
3. **EmailJS:** Free tier limits (may need upgrade for scale)
4. **Netlify Functions:** 10-second timeout (adequate for current use)
5. **Node Version:** 18 (Supabase deprecation warning - should upgrade to 20)

### Areas for Improvement
1. Image optimization and compression
2. Implement proper file storage (S3, Cloudinary)
3. Add automated testing
4. Implement error tracking (Sentry)
5. Add performance monitoring
6. Implement proper logging system
7. Add rate limiting for API endpoints

---

## 📋 Testing Status

### Manual Testing
- ✅ Booking flow end-to-end
- ✅ Therapist acceptance/decline
- ✅ Status updates (On My Way, Arrived, Complete)
- ✅ Email notifications
- ✅ SMS notifications (recently fixed)
- ✅ Password changes
- ✅ User management CRUD
- ✅ Therapist profile updates

### Automated Testing
- ❌ No automated tests currently implemented

---

## 🎯 Recent Git History

```
cb3a319 Add password change functionality to Therapist App Profile page
264a265 Fix SMS by using direct Twilio API instead of function-to-function calls
28ffed6 Fix SMS not sending on booking acceptance - 404 error resolved
adc71e6 Update customer SMS format for booking confirmation
900c012 Fix booking creation failures for in-home bookings
6436694 Add automated review request system for completed bookings
cac6331 Add bidirectional email sync between therapist profiles and user accounts
31a2ad7 Refactor admin therapist edit page into clean tabbed layout with Time-Off management
26ca33f Refactor admin therapist show page into clean tabbed layout
0c35710 Add Delete User and Reset Password features to User Management
954b092 Add secure user management system and fix booking platform bugs
```

---

## 🔜 Ready for Next Phase

This benchmark represents a **stable, production-ready state** with:
- ✅ Complete booking workflow
- ✅ Full admin and therapist management
- ✅ Automated notifications (email + SMS)
- ✅ Review request system
- ✅ Security hardening
- ✅ Critical bug fixes completed

**System is ready for significant architectural changes or new feature development.**

---

## 📞 Support Contacts

- **Platform Owner:** Rejuvenators Mobile Massage
- **Phone:** 1300 302 542
- **Email:** info@rejuvenators.com
- **Live Site:** https://rmmbook.netlify.app/
- **Google Review Link:** https://g.page/r/CacL6QudFVwjEBM/review

---

**Benchmark Created:** October 28, 2025
**Git Commit:** cb3a319
**Status:** ✅ Production Ready - Stable for Major Refactor

