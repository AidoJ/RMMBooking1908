# Therapist Registration Form - Setup Instructions

## Files Created

1. **index.html** - Main registration form with 6-step wizard
2. **registration.js** - JavaScript for form functionality, validation, and API integration
3. **Database migrations:**
   - `create_therapist_registrations.sql` - Main registration table
   - `update_therapist_registrations_add_recruitment.sql` - Recruitment tracking + agreement templates
   - `populate_agreement_template_v3.sql` - V3 agreement content (no rate appendix)

## Required Configuration

### 1. Database Setup

Run these SQL files in order in your Supabase SQL Editor:

```sql
-- 1. Create main registration table (if not already run)
-- Run: database/migrations/create_therapist_registrations.sql

-- 2. Add recruitment tracking and agreement templates table
-- Run: database/migrations/update_therapist_registrations_add_recruitment.sql

-- 3. Populate V3 agreement template
-- Run: database/migrations/populate_agreement_template_v3.sql
```

### 2. Update PDF URL in Agreement Template

After running the migrations:

1. Go to Supabase Dashboard > Storage > `Legal Agreements` bucket
2. Upload your V3 PDF file (if not already uploaded)
3. Click the file to get the public URL
4. Run this SQL command with your actual URL:

```sql
UPDATE public.agreement_templates
SET content_pdf_url = 'https://YOUR-PROJECT-REF.supabase.co/storage/v1/object/public/Legal%20Agreements/Rejuvenators%20Mobile%20Massage%20-Independent%20Contractor%20Agreement%20V3.pdf'
WHERE version = 'v3.0';
```

### 3. Create Supabase Storage Bucket

Create a new storage bucket for therapist documents:

1. Go to Supabase Dashboard > Storage
2. Create new bucket: `therapist-documents`
3. Make it **public** (or configure RLS policies)
4. This will store:
   - Profile photos
   - Qualification certificates
   - Insurance certificates
   - First aid certificates

### 4. Update JavaScript Configuration

Edit `registration.js` and update these constants:

```javascript
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
```

Find these values in:
- Supabase Dashboard > Settings > API

### 5. Deploy Netlify Function

The form uses the existing Netlify function:
- `netlify/functions/therapist-registration-submit.js`

Make sure it's deployed and accessible at:
- `/.netlify/functions/therapist-registration-submit`

### 6. Test the Form

Access the form at:
- `https://booking.rejuvenators.com/therapist/registration/`

Or locally:
- `http://localhost:8888/booking/therapist/registration/`

## Features Implemented

### Step 1: Personal Information
- ✅ Name, DOB, contact details
- ✅ Full address fields
- ✅ Optional profile photo upload with drag-and-drop

### Step 2: Business Details
- ✅ Business structure selection (Sole Trader / Pty Ltd)
- ✅ Dynamic form fields based on structure
- ✅ ABN, GST registration
- ✅ Banking details (BSB, Account Number)

### Step 3: Service Locations & Availability
- ✅ Multi-select service cities
- ✅ Delivery location types
- ✅ Weekly availability grid with time slots
- ✅ "Not Available" logic (disables other time slots)
- ✅ Preferred start date

### Step 4: Qualifications & Services
- ✅ Multi-select therapies offered
- ✅ Multiple qualification certificate uploads
- ✅ Drag-and-drop file upload

### Step 5: Insurance & Compliance
- ✅ Public liability insurance (Y/N)
- ✅ Conditional fields for expiry date and certificate
- ✅ First aid certification (Y/N)
- ✅ Conditional fields for expiry date and certificate
- ✅ Work eligibility confirmation checkbox
- ✅ Auto-upload to Supabase Storage

### Step 6: Agreement & Signature
- ✅ Loads active agreement template from database
- ✅ Displays V3 agreement HTML content
- ✅ Download PDF link
- ✅ 5 required acknowledgment checkboxes
- ✅ Digital signature pad (mouse + touch support)
- ✅ Clear signature button
- ✅ Full legal name confirmation
- ✅ Auto-filled date

## Additional Features

- **Auto-save Drafts:** Form automatically saves progress every 2 seconds
- **Resume Draft:** Users can resume incomplete registrations from localStorage
- **Progress Indicator:** Visual 6-step progress bar
- **Real-time Validation:** Validates required fields before moving to next step
- **File Upload:** Direct upload to Supabase Storage with preview
- **Responsive Design:** Mobile-friendly layout
- **Loading States:** Visual feedback during submission
- **Success Page:** Confirmation message with next steps
- **Alert Messages:** User-friendly error and success notifications

## Data Flow

1. **User fills form** → Auto-saves draft to database (status: 'draft')
2. **User clicks Next** → Validates current step → Saves to database
3. **User completes all 6 steps** → Clicks Submit
4. **Backend validates** → Updates status to 'submitted' → Sends emails
5. **Admin reviews** in admin panel → Updates status to 'under_review'
6. **Admin schedules interviews** → Updates recruitment_status
7. **Admin approves** → Status becomes 'approved'
8. **Admin clicks "Enroll Therapist"** → Creates therapist_profile + auth user → Status becomes 'enrolled'

## Next Steps

1. ✅ Registration form UI complete
2. ⏳ Create admin panel registrations management page
3. ⏳ Build enrollment function (one-click create therapist from registration)
4. ⏳ Add email notifications (submission, approval, enrollment)
5. ⏳ Test full workflow end-to-end

## Troubleshooting

### Form not loading?
- Check browser console for errors
- Verify Supabase URL and anon key are correct
- Ensure Supabase client library is loaded (CDN link in HTML)

### File uploads failing?
- Check Supabase Storage bucket exists: `therapist-documents`
- Verify bucket is public or has correct RLS policies
- Check browser console for CORS errors

### Agreement not displaying?
- Verify `update_therapist_registrations_add_recruitment.sql` was run
- Verify `populate_agreement_template_v3.sql` was run
- Check that `get_active_agreement_template()` function exists
- Query database: `SELECT * FROM agreement_templates WHERE is_active = true;`

### Auto-save not working?
- Check Network tab for failed API calls
- Verify Netlify function is deployed
- Check Netlify function logs for errors
- Ensure CORS is configured in Netlify function

## File Structure

```
booking/therapist/registration/
├── index.html          # Main registration form
├── registration.js     # Form logic and API integration
└── README.md          # This file

database/migrations/
├── create_therapist_registrations.sql
├── update_therapist_registrations_add_recruitment.sql
└── populate_agreement_template_v3.sql

netlify/functions/
└── therapist-registration-submit.js  # Backend API handler
```
