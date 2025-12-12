# Fix Email Button Contrast Issue

## Problem
The email buttons have poor contrast on mobile - blue/teal text on teal background makes them hard to read.

**Affected Buttons:**
1. "Leave a 5-Star Review" (Review request email)
2. "Complete Health Intake Form" (Booking confirmation email)

## Solution
Update the button text color to WHITE in EmailJS templates.

---

## How to Fix in EmailJS Dashboard

### Step 1: Login to EmailJS
Go to: https://dashboard.emailjs.com/

### Step 2: Navigate to Email Templates
Click **"Email Templates"** in the left sidebar

### Step 3: Fix Each Template

#### Template 1: Review Request Email
**Template ID:** `template_review` (or similar - check your review request template)

**Find the button code that looks like:**
```html
<a href="{{google_review_url}}"
   style="display: inline-block; padding: 15px 40px; background-color: #007e8c; color: #5F7BC7; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold;">
  Leave a 5-Star Review
</a>
```

**Change the `color` property from `#5F7BC7` (blue) to `#ffffff` (white):**
```html
<a href="{{google_review_url}}"
   style="display: inline-block; padding: 15px 40px; background-color: #007e8c; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold;">
  Leave a 5-Star Review
</a>
```

#### Template 2: Booking Confirmation Email
**Template ID:** `template_confirmed` (or your confirmation template)

**Find the button code:**
```html
<a href="{{intake_form_url}}"
   style="display: inline-block; padding: 15px 40px; background-color: #007e8c; color: #5F7BC7; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold;">
  Complete Health Intake Form
</a>
```

**Change to:**
```html
<a href="{{intake_form_url}}"
   style="display: inline-block; padding: 15px 40px; background-color: #007e8c; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold;">
  Complete Health Intake Form
</a>
```

---

## Find and Replace Method (Faster)

If you have many templates, you can use Find & Replace:

### In Each Template:

**Find:**
```
color: #5F7BC7
```

**Replace with:**
```
color: #ffffff
```

**OR Find:**
```
color: #1FBFBF
```

**Replace with:**
```
color: #ffffff
```

---

## All Templates to Check

Make sure to check ALL button links in these templates:

1. ✅ **Review Request** (`template_review`)
2. ✅ **Booking Confirmation** (`template_confirmed`)
3. ✅ **Therapist Booking Request** (`template_51wt6of`)
4. ✅ **Therapist Confirmed** (`template_therapist_ok`)
5. ✅ **Booking Declined** (`template_declined`)
6. ✅ **Looking for Alternate** (`template_alternate`)
7. ✅ **Any other templates with buttons**

---

## Button Color Standards

For all email buttons going forward:

| Element | Color | Hex Code |
|---------|-------|----------|
| Button Background | Teal | `#007e8c` |
| Button Text | **White** | `#ffffff` |
| Button Hover Background | Light Teal | `#1FBFBF` |
| Button Border | Same as background | `#007e8c` |

---

## Testing After Fix

### Step 1: Send Test Email
In EmailJS dashboard:
1. Click **"Test It"** button
2. Fill in sample data
3. Send to your phone's email
4. Open on mobile device

### Step 2: Verify Contrast
- Button text should be clearly readable
- White text on teal background = good contrast
- Test in both light and dark mode (if phone supports)

---

## Additional Improvements (Optional)

### Add Hover Effect
```html
<a href="{{url}}"
   style="display: inline-block; padding: 15px 40px; background-color: #007e8c; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold; transition: background-color 0.3s;"
   onmouseover="this.style.backgroundColor='#1FBFBF'"
   onmouseout="this.style.backgroundColor='#007e8c'">
  Button Text
</a>
```

### Add Shadow for Depth
```html
<a href="{{url}}"
   style="display: inline-block; padding: 15px 40px; background-color: #007e8c; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold; box-shadow: 0 2px 8px rgba(0, 126, 140, 0.3);">
  Button Text
</a>
```

---

## Quick Reference: Color Values

**NEVER use these colors for button text:**
- ❌ `#5F7BC7` (Blue-purple - hard to read on teal)
- ❌ `#1FBFBF` (Light teal - hard to read on teal)
- ❌ `#007e8c` (Teal - invisible on teal!)

**ALWAYS use these colors for button text:**
- ✅ `#ffffff` (White - perfect contrast)
- ✅ `#f0f8f9` (Very light teal - good contrast)

---

## Accessibility Standards

According to WCAG 2.1:
- **Minimum contrast ratio:** 4.5:1 for normal text
- **White (#ffffff) on Teal (#007e8c):** 4.52:1 ✅ PASSES
- **Blue (#5F7BC7) on Teal (#007e8c):** 1.8:1 ❌ FAILS

Using white text ensures accessibility compliance!

---

## Need Help?

If you can't find the templates or need assistance:
1. Check EmailJS dashboard → Email Templates
2. Look for templates with IDs mentioned above
3. Search for "Leave a 5-Star Review" or "Complete Health" in template content
4. Update any button with teal background to use white text
