# Email Templates Guide for Quote Workflow

## Overview
This guide documents the three new email templates created for the corporate quote workflow system.

---

## 1. Quote Booking Confirmed - Therapist
**Template File:** `quote-booking-confirmed-therapist.html`  
**EmailJS Template Name:** `template_quote_therapist_confirmed`  
**When to Send:** After client accepts quote (from admin "Send Booking Confirmations to Therapists" button)

### Template Variables:
```javascript
{
  therapist_name: "John Smith",
  quote_reference: "Q-2509-001",
  client_name: "Sarah Johnson",
  company_name: "Tech Corp Pty Ltd",
  service_name: "Corporate Chair Massage",
  
  // Generated HTML for therapist's specific schedule
  therapist_schedule: `
    <div class="schedule-item">
      <div class="schedule-date">Monday, 15 January 2025</div>
      <div class="schedule-time">9:00 AM - 1:00 PM</div>
      <div class="schedule-duration">4.0 hours</div>
    </div>
    <div class="schedule-item">
      <div class="schedule-date">Tuesday, 16 January 2025</div>
      <div class="schedule-time">9:00 AM - 12:00 PM</div>
      <div class="schedule-duration">3.0 hours</div>
    </div>
  `,
  
  therapist_fee: "1,120.00",
  event_address: "123 Business St, Sydney NSW 2000",
  parking_info: "Free parking in basement level 2",
  contact_person: "Sarah Johnson",
  contact_phone: "0412 345 678",
  special_requirements: "Please bring portable massage chairs" // Optional
}
```

---

## 2. Quote Booking Confirmed - Client
**Template File:** `quote-booking-confirmed-client.html`  
**EmailJS Template Name:** `template_quote_client_confirmed`  
**When to Send:** Automatically after client accepts quote (or manual resend)

### Template Variables:
```javascript
{
  client_name: "Sarah Johnson",
  company_name: "Tech Corp Pty Ltd",
  quote_reference: "Q-2509-001",
  service_name: "Corporate Chair Massage",
  event_address: "123 Business St, Sydney NSW 2000",
  
  // Generated HTML showing all therapists and their schedules
  therapist_schedule: `
    <div class="therapist-card">
      <div class="therapist-name">John Smith</div>
      <div class="schedule-item">
        <div class="schedule-date">Monday, 15 Jan 2025</div>
        <div class="schedule-time">9:00 AM - 1:00 PM (4.0h)</div>
      </div>
      <div class="schedule-item">
        <div class="schedule-date">Tuesday, 16 Jan 2025</div>
        <div class="schedule-time">9:00 AM - 12:00 PM (3.0h)</div>
      </div>
    </div>
    <div class="therapist-card">
      <div class="therapist-name">Emily Davis</div>
      <div class="schedule-item">
        <div class="schedule-date">Monday, 15 Jan 2025</div>
        <div class="schedule-time">1:00 PM - 5:00 PM (4.0h)</div>
      </div>
    </div>
  `,
  
  subtotal: "1,800.00",
  discount: "100.00", // Optional
  gst: "170.00",
  total_amount: "1,870.00",
  
  payment_method_invoice: true, // Show invoice payment section
  invoice_number: "INV-Q-2509-001-123456",
  payment_due_date: "29 January 2025"
}
```

---

## 3. Official Payment Receipt
**Template File:** `official-receipt-template.html`  
**EmailJS Template Name:** `template_official_receipt`  
**When to Send:** After admin records payment (from "Send Receipt" button)

### Template Variables:
```javascript
{
  client_name: "Sarah Johnson",
  receipt_number: "REC-Q-2509-001-789012",
  receipt_date: "15 January 2025",
  payment_date: "14 January 2025",
  invoice_number: "INV-Q-2509-001-123456",
  quote_reference: "Q-2509-001",
  company_name: "Tech Corp Pty Ltd",
  
  subtotal: "1,800.00",
  discount: "100.00", // Optional
  gst: "170.00",
  total_amount: "1,870.00",
  amount_paid: "1,870.00",
  
  payment_method: "Bank Transfer",
  payment_reference: "REF-123456789", // Optional
  
  service_name: "Corporate Chair Massage",
  event_dates: "15-16 January 2025",
  event_address: "123 Business St, Sydney NSW 2000"
}
```

---

## EmailJS Setup Instructions

### 1. Create Templates in EmailJS Dashboard
1. Go to https://dashboard.emailjs.com/
2. Navigate to "Email Templates"
3. Click "Create New Template"
4. For each template:
   - Paste the HTML content
   - Set the template name as specified above
   - Configure subject line (suggestions below)
   - Save and note the Template ID

### 2. Suggested Subject Lines
- **Therapist Confirmation:** `✅ Booking Confirmed: {{quote_reference}} - {{company_name}}`
- **Client Confirmation:** `🎉 Your Booking is Confirmed! - {{company_name}} Corporate Wellness`
- **Receipt:** `💚 Payment Receipt: {{receipt_number}} - Rejuvenators`

### 3. Add Template IDs to emailService.ts
```typescript
const TEMPLATE_IDS = {
  CORPORATE_QUOTE: 'template_corporate_quote',
  CORPORATE_INVOICE: 'template_corporate_invoice',
  THERAPIST_CONFIRMED: 'template_quote_therapist_confirmed', // NEW
  CLIENT_CONFIRMED: 'template_quote_client_confirmed',      // NEW
  OFFICIAL_RECEIPT: 'template_official_receipt'             // NEW
};
```

---

## HTML Generation for Dynamic Content

### Therapist Schedule (for Therapist Email)
```typescript
function generateTherapistScheduleHTML(therapistBookings) {
  return therapistBookings.map(booking => `
    <div class="schedule-item">
      <div class="schedule-date">${formatDate(booking.event_date)}</div>
      <div class="schedule-time">${booking.start_time} - ${booking.finish_time}</div>
      <div class="schedule-duration">${booking.duration_minutes / 60} hours</div>
    </div>
  `).join('');
}
```

### Full Team Schedule (for Client Email)
```typescript
function generateFullTeamScheduleHTML(allBookings) {
  // Group by therapist
  const byTherapist = groupBy(allBookings, 'therapist_id');
  
  return Object.entries(byTherapist).map(([therapistId, bookings]) => `
    <div class="therapist-card">
      <div class="therapist-name">${bookings[0].therapist_name}</div>
      ${bookings.map(b => `
        <div class="schedule-item">
          <div class="schedule-date">${formatDate(b.event_date)}</div>
          <div class="schedule-time">${b.start_time} - ${b.finish_time} (${b.duration_minutes/60}h)</div>
        </div>
      `).join('')}
    </div>
  `).join('');
}
```

---

## Design Features

### Color Scheme
- **Therapist Email:** Teal (`#007e8c`) - professional, work-focused
- **Client Email:** Teal (`#007e8c`) - matches quote branding
- **Receipt:** Green (`#4caf50`) - payment success, positive

### Mobile Responsive
All templates include responsive CSS that:
- Stacks columns on mobile
- Adjusts font sizes
- Maintains readability on small screens

### Consistent Branding
- Rejuvenators logo/name prominent
- Contact details in footer
- Professional styling throughout
- Clear hierarchy and readability

---

## Testing Checklist

Before going live, test each template with:
- [ ] Single day booking
- [ ] Multi-day booking
- [ ] Multiple therapists
- [ ] With and without discount
- [ ] With and without special requirements
- [ ] Mobile device rendering
- [ ] Email client compatibility (Gmail, Outlook, Apple Mail)

---

## Notes for Implementation
1. Generate receipt numbers sequentially: `REC-{quoteId}-{timestamp}`
2. Always include quote_reference for easy lookup
3. Calculate therapist_fee per therapist (sum of their bookings)
4. Format all currency with 2 decimal places and commas
5. Use Australian date format: DD/MM/YYYY or "15 January 2025"
6. Include ABN and GST registration in receipt footer (update with actual values)

---

## Future Enhancements
- PDF attachment generation for receipts
- Multi-language support
- Client logo inclusion for white-label experience
- Automatic reminder emails for overdue payments







