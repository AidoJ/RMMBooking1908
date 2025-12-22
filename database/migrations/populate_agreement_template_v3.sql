-- =====================================================
-- POPULATE AGREEMENT TEMPLATE WITH V3 CONTENT
-- (V3 = V2 with Rate Appendix Removed)
-- =====================================================

-- First, run the recruitment status migration if you haven't already
-- (This assumes update_therapist_registrations_add_recruitment.sql has been run)

-- Delete previous versions
DELETE FROM public.agreement_templates WHERE version IN ('v1.0', 'v2.0');

-- Insert the V3 agreement template (Appendix Removed)
INSERT INTO public.agreement_templates (
  version,
  title,
  content_html,
  content_pdf_url,
  summary_points,
  is_active,
  effective_from
) VALUES (
  'v3.0',
  'Independent Contractor Agreement',

  -- Full HTML content for display in registration form (NO RATE APPENDIX)
  $$<div class="agreement-document">
    <div class="agreement-header">
      <h2>INDEPENDENT CONTRACTOR AGREEMENT</h2>
      <p><strong>BETWEEN:</strong> Galdon Training Pty Ltd (ACN 16631329238)<br>
      T/A Rejuvenators Mobile Massage<br>
      PO Box 432, Fortitude Valley QLD 4006</p>
      <p><strong>AND:</strong> [Your Name] ([Your Business Name])</p>
    </div>

    <hr style="margin: 30px 0; border: none; border-top: 2px solid #ddd;">

    <div class="agreement-section">
      <h3>KEY TERMS</h3>
      <ul>
        <li><strong>Contract Period:</strong> 12 months from Execution Date (auto-renews)</li>
        <li><strong>Relationship:</strong> Independent Contractor (NOT employment)</li>
        <li><strong>Payment:</strong> 55% of Job Recommended Retail Price (see website for current rates)</li>
        <li><strong>Notice Period:</strong> 30 days for termination</li>
      </ul>
    </div>

    <div class="agreement-section">
      <h3>YOUR OBLIGATIONS</h3>
      <ul>
        <li>Complete online StressBuster Massage training course</li>
        <li>Download and maintain the Therapist App on your device</li>
        <li>Maintain current insurance ($10,000,000+ public liability required)</li>
        <li>Handle your own tax, superannuation, and GST obligations</li>
        <li>Keep all client information strictly confidential</li>
        <li>Provide your own equipment and supplies (massage table, oils, linens, etc.)</li>
        <li>Submit weekly invoices based on itemized reports</li>
        <li>Maintain current qualifications, licenses, and permits</li>
      </ul>
    </div>

    <div class="agreement-section">
      <h3>CANCELLATION POLICY</h3>

      <h4>If You Cancel or No-Show:</h4>
      <ul>
        <li><strong>Within 1 hour of booking:</strong> You will be charged the full booking amount (deducted from next invoice) + contract review may occur</li>
        <li><strong>Client offered:</strong> Full refund OR free rescheduled session as compensation</li>
        <li><strong>Repeated incidents:</strong> May result in contract termination</li>
      </ul>

      <h4>If Client Cancels or No-Shows:</h4>
      <ul>
        <li><strong>Less than 3 hours notice:</strong> Client charged 100% of session fee - YOU GET FULL PAYMENT</li>
        <li><strong>More than 3 hours notice:</strong> No charge to client - you receive no payment</li>
      </ul>
    </div>

    <div class="agreement-section">
      <h3>NON-COMPETE & RESTRAINT</h3>
      <ul>
        <li><strong>Duration:</strong> 3-12 months after contract termination</li>
        <li><strong>Cannot:</strong> Solicit or provide services to any clients you served through Rejuvenators in the 12 months prior to termination</li>
        <li><strong>Geographic Areas:</strong> Restrictions apply in Australia, Queensland, Brisbane, and Fortitude Valley (in descending order of enforceability)</li>
        <li><strong>Disclosure Required:</strong> You must disclose these restraints to any new employer/client during the restraint period</li>
      </ul>
    </div>

    <div class="agreement-section">
      <h3>INSURANCE REQUIREMENTS</h3>
      <p>You must maintain current insurance covering:</p>
      <ul>
        <li>Workers' Compensation</li>
        <li>Vehicle and Equipment Insurance</li>
        <li>Public and Products Liability ($10,000,000 minimum)</li>
      </ul>
      <p><strong>Note:</strong> Certificates of Currency must be provided upon request</p>
    </div>

    <div class="agreement-section">
      <h3>QUALITY GUARANTEE</h3>
      <p>Rejuvenators provides a 100% money-back guarantee to clients:</p>
      <ul>
        <li>If a client requests a refund, the Principal will not require you to pay any portion</li>
        <li>However, if the Principal issues 3 individual refunds in a 6-month period related to your services, the contract may be terminated immediately</li>
      </ul>
    </div>

    <div class="agreement-section">
      <h3>TERMINATION RIGHTS</h3>

      <h4>Immediate Termination (No Notice) if:</h4>
      <ul>
        <li>Dishonesty, serious misconduct, or gross negligence</li>
        <li>Any sexual activity or indecency with clients</li>
        <li>Promoting your own or another business to Rejuvenators clients</li>
        <li>Unprofessional or rude behavior to clients, hotel staff, or team</li>
        <li>Damaging Rejuvenators reputation</li>
        <li>Causing injury to persons or damage to property</li>
        <li>Late or no-show to bookings more than once without prior notice</li>
      </ul>

      <h4>Termination with 30 Days Notice:</h4>
      <ul>
        <li>Either party may terminate for any reason with 30 days written notice</li>
        <li>Either party may terminate if the other party is in default and fails to remedy within 7 days</li>
      </ul>
    </div>

    <div class="agreement-section">
      <h3>INTELLECTUAL PROPERTY</h3>
      <ul>
        <li>You receive a limited license to use Rejuvenators branding only while providing Services</li>
        <li>You may NOT use the Rejuvenators trademark on your own materials without written consent</li>
        <li>You may access the Contractor Information Manual for service delivery only</li>
        <li>All Rejuvenators IP (trademarks, manuals, branding) remains the exclusive property of the Principal</li>
      </ul>
    </div>

    <div class="agreement-section">
      <h3>DISPUTE RESOLUTION</h3>
      <ol>
        <li>Written notice of dispute to the other party</li>
        <li>Mediation within 21 days with independent mediator</li>
        <li>Court proceedings only if unresolved after 28 days (except urgent matters)</li>
        <li>Mediation costs shared equally between parties</li>
      </ol>
    </div>

    <div class="agreement-notice">
      <p><strong>⚠️ IMPORTANT ACKNOWLEDGEMENT</strong></p>
      <p>By signing this agreement, you acknowledge that:</p>
      <ul>
        <li>This is an INDEPENDENT CONTRACTOR relationship, NOT employment</li>
        <li>You are responsible for your own tax, super, insurance, and equipment</li>
        <li>You have read the ENTIRE agreement (or chosen to waive legal advice)</li>
        <li>All information you provided is accurate and complete</li>
        <li>Payment rates are as per the current rates published on the Rejuvenators website</li>
      </ul>
    </div>

    <div class="agreement-footer">
      <p><em>This summary covers the key points. The full agreement contains additional legal terms, definitions, and conditions. Please download and review the complete PDF document.</em></p>
    </div>
  </div>$$,

  -- PDF URL in Supabase Storage (V3 - no appendix)
  -- IMPORTANT: Update [YOUR-PROJECT-REF] with your actual Supabase project reference
  'https://[YOUR-PROJECT-REF].supabase.co/storage/v1/object/public/Legal%20Agreements/Rejuvenators%20Mobile%20Massage%20-Independent%20Contractor%20Agreement%20V3.pdf',

  -- Summary points as JSON for quick display
  $$
{
    "key_terms": [
      "Contract Period: 12 months (auto-renews)",
      "Relationship: Independent Contractor (NOT employment)",
      "Payment: 55% of Job RRP (see website for current rates)",
      "Notice Period: 30 days for termination"
    ],
    "obligations": [
      "Complete StressBuster Massage training",
      "Maintain Therapist App on your device",
      "Maintain $10M+ public liability insurance",
      "Handle own tax, super, and GST",
      "Keep client information confidential",
      "Provide own equipment & supplies",
      "Submit weekly invoices"
    ],
    "cancellation_policy": [
      "Your late cancel (<1hr): Full charge + review",
      "Client cancel <3hrs: You get FULL payment",
      "Client cancel >3hrs: No payment to you"
    ],
    "non_compete": [
      "Duration: 3-12 months after termination",
      "Cannot solicit clients you served",
      "Geographic restrictions apply",
      "Must disclose restraints to new employers"
    ],
    "insurance_required": [
      "Workers Compensation",
      "Vehicle & Equipment Insurance",
      "Public & Products Liability ($10M+)"
    ],
    "immediate_termination_reasons": [
      "Dishonesty or serious misconduct",
      "Sexual activity/indecency with clients",
      "Promoting own business to clients",
      "Unprofessional behavior",
      "Repeated late/no-shows"
    ]
  }
$$::jsonb,

  true, -- is_active
  '2025-01-01' -- effective_from
);

-- =====================================================
-- VERIFY INSERTION
-- =====================================================
SELECT
  version,
  title,
  is_active,
  effective_from,
  length(content_html) as html_length,
  content_pdf_url
FROM public.agreement_templates
WHERE version = 'v3.0';

-- =====================================================
-- INSTRUCTIONS FOR COMPLETING SETUP
-- =====================================================

-- TODO: Update the PDF URL with your actual Supabase project URL
-- 1. Go to your Supabase Dashboard > Storage > Legal Agreements bucket
-- 2. Find the file: "Rejuvenators Mobile Massage -Independent Contractor Agreement V3.pdf"
-- 3. Click to get the public URL
-- 4. Run this update command with your actual URL:

/*
UPDATE public.agreement_templates
SET content_pdf_url = 'YOUR-ACTUAL-SUPABASE-STORAGE-URL-HERE'
WHERE version = 'v3.0';
*/

-- Example URL format:
-- https://abcdefghijk.supabase.co/storage/v1/object/public/Legal%20Agreements/Rejuvenators%20Mobile%20Massage%20-Independent%20Contractor%20Agreement%20V3.pdf
