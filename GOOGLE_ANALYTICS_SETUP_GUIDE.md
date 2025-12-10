# Google Analytics 4 & Google Tag Manager Setup Guide
## Booking Funnel Tracking for Rejuvenators Platform

---

## Overview

This guide will help you set up Google Tag Manager (GTM) and Google Analytics 4 (GA4) to track your booking funnel and identify where users drop off.

**What's Been Implemented:**
- ✅ GTM container code added to `booking/index.html`
- ✅ Analytics tracking utility (`booking/js/analytics.js`)
- ✅ Event tracking throughout booking flow
- ✅ Custom events for each step, service selection, payments, completions

---

## Part 1: Create Google Tag Manager Container

### Step 1: Create GTM Account & Container

1. Go to [Google Tag Manager](https://tagmanager.google.com/)
2. Click **Create Account**
3. Fill in account details:
   - **Account Name:** Rejuvenators
   - **Country:** Australia
   - Click **Continue**
4. Set up container:
   - **Container Name:** Booking Platform
   - **Target Platform:** Web
   - Click **Create**
5. Accept the Terms of Service

### Step 2: Get Your GTM Container ID

1. After creating, you'll see a code snippet with your **GTM ID** (format: `GTM-XXXXXXX`)
2. **Copy this GTM ID** - you'll need it next

### Step 3: Update Your Website Code

1. Open `booking/index.html`
2. Find **line 9** which currently says:
   ```javascript
   })(window,document,'script','dataLayer','GTM-XXXXXXX');</script>
   ```
3. Replace `GTM-XXXXXXX` with your actual GTM ID
4. Find **line 23** which says:
   ```html
   <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-XXXXXXX"
   ```
5. Replace `GTM-XXXXXXX` with your actual GTM ID
6. Save and deploy the changes

---

## Part 2: Create Google Analytics 4 Property

### Step 1: Create GA4 Account

1. Go to [Google Analytics](https://analytics.google.com/)
2. Click **Admin** (gear icon in bottom left)
3. Click **Create Account**
4. Fill in details:
   - **Account name:** Rejuvenators
   - **Data sharing settings:** Keep defaults
   - Click **Next**

### Step 2: Create GA4 Property

1. **Property name:** Rejuvenators Booking Platform
2. **Reporting time zone:** (GMT+10:00) Australian Eastern Time
3. **Currency:** Australian Dollar (AUD)
4. Click **Next**
5. Fill in business details:
   - **Industry:** Health & Fitness
   - **Business size:** Select your size
6. Click **Next**
7. Select **Generate leads** and **Measure customer engagement**
8. Click **Create**
9. Accept the Terms of Service

### Step 3: Create Data Stream

1. Select **Web** platform
2. Enter website details:
   - **Website URL:** `https://booking.rejuvenators.com`
   - **Stream name:** Booking Platform
3. Click **Create stream**
4. **Copy your Measurement ID** (format: `G-XXXXXXXXXX`) - you'll need this

---

## Part 3: Connect GA4 to Google Tag Manager

### Step 1: Create GA4 Configuration Tag in GTM

1. Go back to [Google Tag Manager](https://tagmanager.google.com/)
2. Click on your container
3. Click **Tags** in the left sidebar
4. Click **New**
5. Click **Tag Configuration**
6. Select **Google Analytics: GA4 Configuration**
7. Enter your **Measurement ID** (G-XXXXXXXXXX)
8. Click **Triggering**
9. Select **All Pages**
10. Name the tag: `GA4 Configuration`
11. Click **Save**

### Step 2: Publish GTM Container

1. Click **Submit** (top right)
2. Add version name: `Initial GA4 Setup`
3. Click **Publish**

---

## Part 4: Set Up Custom Event Tracking in GTM

Your booking platform sends custom events to the dataLayer. Now we'll configure GTM to send these to GA4.

### Events Being Tracked:

| Event Name | Description | When It Fires |
|------------|-------------|---------------|
| `booking_page_load` | User lands on booking page | Page load |
| `booking_type_selected` | User selects instant or quote | Step 0 |
| `booking_step_view` | User views a funnel step | Each step navigation |
| `booking_step_complete` | User completes a step | Continue button clicked |
| `address_validated` | Address validation result | After address check |
| `service_selected` | User selects service | Step 2 complete |
| `therapist_selected` | User selects therapist | Step 5 |
| `begin_checkout` | User enters payment details | Step 8 |
| `purchase` | Booking completed | Step 10 |
| `booking_error` | Error occurred | Any error |

### Create Event Tags in GTM

For each event above, create a GA4 Event tag:

1. Go to **Tags** → **New**
2. **Tag Configuration** → **Google Analytics: GA4 Event**
3. **Configuration Tag:** Select your GA4 Configuration tag
4. **Event Name:** Enter the event name (e.g., `booking_step_view`)
5. **Event Parameters** (click + to add):
   - Add parameters based on the event (see table below)
6. **Triggering** → **New Trigger**:
   - **Trigger Type:** Custom Event
   - **Event name:** (same as the event name above)
   - Save trigger
7. Name the tag: `GA4 - [Event Name]`
8. Click **Save**

### Event Parameters to Track:

**booking_step_view:**
- `step_number` → `{{dlv - step_number}}`
- `step_name` → `{{dlv - step_name}}`
- `booking_type` → `{{dlv - booking_type}}`

**booking_type_selected:**
- `booking_type` → `{{dlv - booking_type}}`

**service_selected:**
- `service_name` → `{{dlv - service_name}}`
- `service_duration` → `{{dlv - service_duration}}`

**begin_checkout:**
- `value` → `{{dlv - value}}`
- `currency` → `{{dlv - currency}}`

**purchase:**
- `transaction_id` → `{{dlv - transaction_id}}`
- `value` → `{{dlv - value}}`
- `currency` → `{{dlv - currency}}`

### Creating Data Layer Variables

Before you can use `{{dlv - step_number}}` etc., you need to create these variables:

1. Go to **Variables** → **User-Defined Variables** → **New**
2. **Variable Configuration** → **Data Layer Variable**
3. **Data Layer Variable Name:** Enter the parameter name (e.g., `step_number`)
4. **Data Layer Version:** Version 2
5. Name the variable: `dlv - step_number`
6. Save
7. Repeat for all parameters listed above

---

## Part 5: Set Up Funnel Visualization in GA4

### Step 1: Create Custom Funnel Report

1. Go to [Google Analytics](https://analytics.google.com/)
2. Click **Explore** in left sidebar
3. Click **Funnel exploration**
4. Name your exploration: `Booking Funnel`

### Step 2: Configure Funnel Steps

Add these steps in order:

1. **Step 1:** Booking Page Load
   - Condition: `Event name = booking_page_load`

2. **Step 2:** Booking Type Selected
   - Condition: `Event name = booking_type_selected`

3. **Step 3:** Address Validated
   - Condition: `Event name = address_validated`

4. **Step 4:** Service Selected
   - Condition: `Event name = service_selected`

5. **Step 5:** Date & Time Selected
   - Condition: `Event name = booking_step_view AND step_number = 4`

6. **Step 6:** Payment Initiated
   - Condition: `Event name = begin_checkout`

7. **Step 7:** Booking Complete
   - Condition: `Event name = purchase`

### Step 3: Analyze Drop-Off

- Each step shows **completion rate** and **abandonment rate**
- Click on any step to see where users drop off
- Use filters to segment by booking type, device, etc.

---

## Part 6: Testing Your Setup

### Step 1: Enable GTM Preview Mode

1. In GTM, click **Preview** (top right)
2. Enter your URL: `https://booking.rejuvenators.com`
3. Click **Connect**
4. A new tab opens with your site

### Step 2: Test Booking Flow

1. Go through the entire booking process
2. Watch the GTM debug panel (left side)
3. Verify events fire at each step:
   - `booking_page_load` on page load
   - `booking_type_selected` when clicking instant/quote
   - `booking_step_view` as you navigate
   - `service_selected` when choosing service
   - `begin_checkout` when entering payment
   - `purchase` on completion

### Step 3: Check GA4 Real-Time

1. Go to GA4 → **Reports** → **Realtime**
2. Complete a test booking
3. Verify events appear in real-time report
4. Check event parameters are captured

---

## Part 7: Key Reports to Monitor

### 1. **Funnel Abandonment Report**
- Shows exact step where users drop off
- Located in **Explore** → Your custom funnel

### 2. **Conversions Report**
- Track completed bookings over time
- Go to **Reports** → **Engagement** → **Conversions**
- Mark `purchase` as a conversion event

### 3. **Event Count Report**
- See how many times each event fires
- Go to **Reports** → **Engagement** → **Events**

### 4. **User Flow**
- Visualize the path users take
- Go to **Explore** → **Path exploration**

---

## Troubleshooting

### Events Not Showing in GA4?

1. **Check GTM Preview Mode:** Verify events fire in debug panel
2. **Check GA4 Realtime:** Events may take a few minutes to appear
3. **Verify Measurement ID:** Ensure correct GA4 ID in GTM tag
4. **Check Browser Console:** Look for JavaScript errors
5. **Ad Blockers:** Disable ad blockers during testing

### Events Fire But No Parameters?

1. **Create Data Layer Variables:** Ensure all variables created in GTM
2. **Check Variable Names:** Must match exactly (case-sensitive)
3. **Test in Preview Mode:** Verify variable values populate

### Funnel Shows Zero Users?

1. **Wait 24-48 Hours:** Historical data takes time to process
2. **Check Date Range:** Ensure date range includes test period
3. **Verify Step Conditions:** Event names must match exactly

---

## Quick Reference: Tracked Events

```javascript
// All events are automatically tracked - no additional code needed

// Page Load
window.dataLayer.push({ event: 'booking_page_load' });

// Booking Type Selection
window.analyticsTracker.trackBookingTypeSelection('instant');

// Step Progress
window.analyticsTracker.trackBookingStep(1, 'Address Entry');

// Service Selection
window.analyticsTracker.trackServiceSelection('Deep Tissue Massage', 60);

// Address Validation
window.analyticsTracker.trackAddressValidation(true, true);

// Therapist Selection
window.analyticsTracker.trackTherapistSelection('123', 'Kate Pascoe');

// Payment
window.analyticsTracker.trackPaymentInitiated(150.00);

// Completion
window.analyticsTracker.trackBookingComplete('BK-12345', 150.00, {...});

// Errors
window.analyticsTracker.trackBookingError('payment_failed', 'Card declined', 8);
```

---

## Next Steps After Setup

1. **Run Test Bookings:** Complete 5-10 test bookings
2. **Monitor for 1 Week:** Let data accumulate
3. **Analyze Drop-Off Points:** Identify problem steps
4. **A/B Test Improvements:** Fix high-abandonment steps
5. **Set Up Alerts:** Get notified of unusual drop rates

---

## Support Resources

- **GTM Documentation:** https://support.google.com/tagmanager
- **GA4 Documentation:** https://support.google.com/analytics
- **Funnel Exploration:** https://support.google.com/analytics/answer/9327974

---

## Summary Checklist

- [ ] Create GTM container and get GTM ID
- [ ] Update booking/index.html with GTM ID (lines 9 and 23)
- [ ] Deploy updated code
- [ ] Create GA4 property and get Measurement ID
- [ ] Create GA4 Configuration tag in GTM
- [ ] Create all custom event tags in GTM
- [ ] Create data layer variables in GTM
- [ ] Publish GTM container
- [ ] Test in GTM Preview Mode
- [ ] Verify events in GA4 Realtime
- [ ] Create funnel visualization in GA4 Explore
- [ ] Run test bookings
- [ ] Monitor for 7 days
- [ ] Analyze and optimize

---

**Questions?** Check the console logs - all analytics events are logged with 📊 prefix for debugging.
