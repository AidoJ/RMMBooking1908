# Booking Reminders System

## Overview
Automated booking reminder system that sends email and SMS notifications to both clients and therapists before scheduled appointments.

## Components

### 1. Netlify Function
**File:** `netlify/functions/send-booking-reminders.js`
- **Schedule:** Runs every 10 minutes (configured in `netlify.toml`)
- **Function:** Finds confirmed bookings within the reminder window and sends notifications

### 2. Email Templates
Created in EmailJS with the following template IDs:

#### Client Reminder Template
- **Template ID:** `template_remindclient`
- **HTML File:** `EmailTemplatebookingreminderclient.html`
- **Variables:**
  - `customer_name` - Client's first name
  - `booking_id` - Booking reference number
  - `service_name` - Name of the service
  - `duration` - Service duration (e.g., "60 minutes")
  - `booking_date` - Formatted date
  - `booking_time` - Formatted time
  - `address` - Booking location
  - `therapist_name` - Assigned therapist's first name

#### Therapist Reminder Template
- **Template ID:** `template_remindtherapist`
- **HTML File:** `EmailTemplatebookingremindertherapist.html`
- **Variables:**
  - `therapist_name` - Therapist's first name
  - `client_name` - Full client name
  - `booking_id` - Booking reference number
  - `service_name` - Name of the service
  - `duration` - Service duration
  - `booking_date` - Formatted date
  - `booking_time` - Formatted time
  - `address` - Booking location
  - `room_number` - Room number or "N/A"
  - `therapist_fee` - Formatted fee amount (e.g., "$80.00")

### 3. SMS Notifications
SMS messages are sent via Twilio to both clients and therapists with booking details.

## Configuration

### System Settings
The reminder timing is controlled by the `system_settings` table:

**Required Setting:**
```sql
INSERT INTO system_settings (key, value, description)
VALUES (
  'booking_reminder_hours',
  '24',
  'Number of hours before a booking to send reminder notifications'
);
```

**Default:** 24 hours before the appointment

### Database Schema Update Required
Add the `reminder_sent_at` column to the `bookings` table:

```sql
ALTER TABLE bookings
ADD COLUMN reminder_sent_at TIMESTAMP;
```

This field tracks when a reminder was sent to prevent duplicate reminders.

### EmailJS Templates Setup
1. Log in to EmailJS dashboard
2. Create two new templates using the HTML files provided
3. Set the template IDs as specified above:
   - `template_remindclient`
   - `template_remindtherapist`
4. Map the template variables to the parameters sent by the function

### Netlify Deployment
The function is automatically scheduled via `netlify.toml`:

```toml
[functions."send-booking-reminders"]
  schedule = "*/10 * * * *"  # Run every 10 minutes
```

## How It Works

1. **Every 10 minutes**, the scheduled function runs
2. Reads the `booking_reminder_hours` setting from `system_settings`
3. Calculates the target time window (e.g., 24 hours from now ± 5 minutes)
4. Queries for confirmed bookings in that window that haven't received reminders
5. For each booking:
   - Sends email reminder to client
   - Sends SMS reminder to client (if phone number exists)
   - Sends email reminder to therapist
   - Sends SMS reminder to therapist (if phone number exists)
   - Updates `reminder_sent_at` timestamp
6. Logs all activities for monitoring

## Notification Content

### Client Notifications
- Friendly reminder about upcoming massage
- Complete booking details
- Preparation checklist
- Cancellation/rescheduling contact info

### Therapist Notifications
- Appointment reminder
- Client information
- Booking details including fee
- Pre-appointment checklist
- Emergency contact if unable to attend

## Monitoring

Check Netlify function logs for:
- `⏰ Running booking reminder check...` - Function started
- `📬 Found X bookings that need reminders` - Bookings to process
- `✅ Reminders sent for booking XXX` - Successful sends
- `❌ Error sending...` - Any failures

## Testing

To test the reminder system:

1. Set `booking_reminder_hours` to a small value (e.g., `1` for 1 hour)
2. Create a test booking scheduled 1 hour from now
3. Wait for the next 10-minute interval
4. Check function logs in Netlify
5. Verify emails and SMS messages were sent
6. Reset `booking_reminder_hours` to production value (e.g., `24`)

## Notes

- Reminders are only sent for bookings with `status = 'confirmed'`
- The 10-minute run interval ensures reminders are sent within ±5 minutes of the target time
- Both email and SMS failures are logged but don't stop the process
- If either notification fails, the reminder is still marked as sent to avoid repeated failures

---
Last Updated: 2025-11-21
