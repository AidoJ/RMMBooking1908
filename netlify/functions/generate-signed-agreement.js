const { createClient } = require('@supabase/supabase-js');
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  let browser = null;

  try {
    const { registrationId } = JSON.parse(event.body);

    if (!registrationId) {
      throw new Error('Registration ID is required');
    }

    console.log(`📄 Generating signed agreement for registration: ${registrationId}`);

    // ===================================================
    // STEP 1: Fetch Registration Data
    // ===================================================
    const { data: registration, error: regError } = await supabase
      .from('therapist_registrations')
      .select('*')
      .eq('id', registrationId)
      .single();

    if (regError) throw regError;
    if (!registration) throw new Error('Registration not found');

    console.log(`✓ Registration data fetched`);

    // ===================================================
    // STEP 2: Fetch Active Agreement Template
    // ===================================================
    const { data: agreementData, error: agreeError } = await supabase
      .rpc('get_active_agreement_template');

    if (agreeError) throw agreeError;
    if (!agreementData || agreementData.length === 0) {
      throw new Error('No active agreement template found');
    }

    const agreement = agreementData[0];
    console.log(`✓ Agreement template fetched: ${agreement.version}`);

    // ===================================================
    // STEP 3: Build Complete HTML Document
    // ===================================================
    const completeHTML = buildCompleteHTML(registration, agreement);

    // ===================================================
    // STEP 4: Generate PDF with Puppeteer
    // ===================================================
    console.log('🖨️ Generating PDF...');

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.setContent(completeHTML, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
      }
    });

    await browser.close();
    browser = null;

    console.log(`✓ PDF generated (${pdfBuffer.length} bytes)`);

    // ===================================================
    // STEP 5: Upload PDF to Supabase Storage
    // ===================================================
    const fileName = `signed-agreements/${registrationId}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from('therapist-documents')
      .upload(fileName, pdfBuffer, {
        contentType: 'application/pdf',
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) throw uploadError;

    console.log(`✓ PDF uploaded to storage`);

    // ===================================================
    // STEP 6: Get Public URL
    // ===================================================
    const { data: { publicUrl } } = supabase.storage
      .from('therapist-documents')
      .getPublicUrl(fileName);

    console.log(`✓ Public URL: ${publicUrl}`);

    // ===================================================
    // STEP 7: Update Registration Record
    // ===================================================
    const { error: updateError } = await supabase
      .from('therapist_registrations')
      .update({
        signed_agreement_pdf_url: publicUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', registrationId);

    if (updateError) throw updateError;

    console.log(`✅ Signed agreement generated successfully`);

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: true,
        pdfUrl: publicUrl,
        message: 'Signed agreement generated successfully'
      }),
    };

  } catch (error) {
    console.error('❌ Error generating signed agreement:', error);

    // Clean up browser if still open
    if (browser) {
      await browser.close().catch(e => console.error('Error closing browser:', e));
    }

    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: false,
        error: error.message || 'Failed to generate signed agreement'
      }),
    };
  }
};

// ===================================================
// HTML TEMPLATE BUILDER
// ===================================================
function buildCompleteHTML(registration, agreement) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Signed Independent Contractor Agreement - ${registration.first_name} ${registration.last_name}</title>
  <style>
    ${getStyles()}
  </style>
</head>
<body>
  <!-- HEADER -->
  <div class="header">
    <div class="header-content">
      <div class="logo">
        <h1>REJUVENATORS<sup>®</sup></h1>
        <p>Mobile Massage Therapy</p>
      </div>
      <div class="document-info">
        <p><strong>Registration ID:</strong> ${registration.id.substring(0, 8)}</p>
        <p><strong>Submitted:</strong> ${formatDate(registration.submitted_at || registration.created_at)}</p>
      </div>
    </div>
  </div>

  <!-- APPLICANT INFORMATION -->
  <div class="section">
    <h2 class="section-title">Applicant Information</h2>

    <h3 class="subsection-title">Personal Details</h3>
    <table class="info-table">
      <tr>
        <td class="label">Name:</td>
        <td class="value">${registration.first_name} ${registration.last_name}</td>
      </tr>
      <tr>
        <td class="label">Date of Birth:</td>
        <td class="value">${formatDate(registration.date_of_birth)}</td>
      </tr>
      <tr>
        <td class="label">Email:</td>
        <td class="value">${registration.email}</td>
      </tr>
      <tr>
        <td class="label">Phone:</td>
        <td class="value">${registration.phone}</td>
      </tr>
      <tr>
        <td class="label">Address:</td>
        <td class="value">${registration.street_address}, ${registration.suburb}, ${registration.city} ${registration.state} ${registration.postcode}</td>
      </tr>
    </table>

    <h3 class="subsection-title">Business Details</h3>
    <table class="info-table">
      <tr>
        <td class="label">Business Structure:</td>
        <td class="value">${formatBusinessStructure(registration.business_structure)}</td>
      </tr>
      ${registration.business_name ? `
      <tr>
        <td class="label">Business Name:</td>
        <td class="value">${registration.business_name}</td>
      </tr>
      ` : ''}
      ${registration.company_name ? `
      <tr>
        <td class="label">Company Name:</td>
        <td class="value">${registration.company_name}</td>
      </tr>
      <tr>
        <td class="label">Company ACN:</td>
        <td class="value">${registration.company_acn}</td>
      </tr>
      ` : ''}
      <tr>
        <td class="label">ABN:</td>
        <td class="value">${registration.business_abn}</td>
      </tr>
      <tr>
        <td class="label">GST Registered:</td>
        <td class="value">${registration.gst_registered ? 'Yes' : 'No'}</td>
      </tr>
    </table>

    <h3 class="subsection-title">Banking Details</h3>
    <table class="info-table">
      <tr>
        <td class="label">Account Name:</td>
        <td class="value">${registration.bank_account_name}</td>
      </tr>
      <tr>
        <td class="label">BSB:</td>
        <td class="value">${registration.bsb}</td>
      </tr>
      <tr>
        <td class="label">Account Number:</td>
        <td class="value">${registration.bank_account_number}</td>
      </tr>
    </table>

    <h3 class="subsection-title">Service Information</h3>
    <table class="info-table">
      <tr>
        <td class="label">Service Cities:</td>
        <td class="value">${formatArray(registration.service_cities)}</td>
      </tr>
      <tr>
        <td class="label">Delivery Locations:</td>
        <td class="value">${formatArray(registration.delivery_locations)}</td>
      </tr>
      <tr>
        <td class="label">Therapies Offered:</td>
        <td class="value">${formatArray(registration.therapies_offered)}</td>
      </tr>
      ${registration.start_date ? `
      <tr>
        <td class="label">Intended Start Date:</td>
        <td class="value">${formatDate(registration.start_date)}</td>
      </tr>
      ` : ''}
    </table>

    <h3 class="subsection-title">Weekly Availability</h3>
    ${formatAvailability(registration.availability_schedule)}

    <h3 class="subsection-title">Compliance</h3>
    <table class="info-table">
      <tr>
        <td class="label">Insurance:</td>
        <td class="value">${registration.has_insurance ? 'Yes - Expires ' + formatDate(registration.insurance_expiry_date) : 'No'}</td>
      </tr>
      <tr>
        <td class="label">First Aid:</td>
        <td class="value">${registration.has_first_aid ? 'Yes - Expires ' + formatDate(registration.first_aid_expiry_date) : 'No'}</td>
      </tr>
      <tr>
        <td class="label">Work Eligibility:</td>
        <td class="value">${registration.work_eligibility_confirmed ? 'Confirmed' : 'Not Confirmed'}</td>
      </tr>
    </table>
  </div>

  <!-- PAGE BREAK -->
  <div class="page-break"></div>

  <!-- AGREEMENT CONTENT FROM DATABASE -->
  <div class="section agreement-section">
    <h2 class="section-title">Independent Contractor Agreement</h2>
    <div class="agreement-content">
      ${agreement.content_html}
    </div>
  </div>

  <!-- PAGE BREAK -->
  <div class="page-break"></div>

  <!-- ACKNOWLEDGEMENTS & SIGNATURE -->
  <div class="section signature-section">
    <h2 class="section-title">Acknowledgements & Signature</h2>

    <div class="acknowledgements">
      <p><strong>I hereby acknowledge and confirm that:</strong></p>
      <ul class="checklist">
        <li>☑ I have read and understood this entire agreement</li>
        <li>☑ I have sought independent legal advice or waived my right to do so</li>
        <li>☑ I understand this is an independent contractor relationship, not employment</li>
        <li>☑ All information provided in this registration is true and accurate</li>
        <li>☑ I accept and agree to be bound by the terms and conditions above</li>
      </ul>
    </div>

    <div class="signature-block">
      ${registration.signature_data ? `
      <div class="signature-image-container">
        <p class="signature-label">Signature:</p>
        <img src="${registration.signature_data}" class="signature-image" alt="Digital Signature" />
      </div>
      ` : ''}

      <table class="signature-details">
        <tr>
          <td class="label">Full Legal Name:</td>
          <td class="value"><strong>${registration.full_legal_name || registration.first_name + ' ' + registration.last_name}</strong></td>
        </tr>
        <tr>
          <td class="label">Date Signed:</td>
          <td class="value"><strong>${formatDate(registration.signed_date || registration.submitted_at)}</strong></td>
        </tr>
      </table>
    </div>
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <p>This is a legally binding document. Document Reference: REG-${registration.id.substring(0, 8).toUpperCase()}</p>
    <p>Generated: ${formatDateTime(new Date())}</p>
  </div>
</body>
</html>
  `;
}

// ===================================================
// STYLES
// ===================================================
function getStyles() {
  return `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Arial', 'Helvetica', sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #333;
    }

    .header {
      background: #007e8c;
      color: white;
      padding: 20px;
      margin-bottom: 30px;
    }

    .header-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .logo h1 {
      font-size: 28pt;
      margin: 0;
      letter-spacing: 2px;
    }

    .logo sup {
      font-size: 12pt;
    }

    .logo p {
      font-size: 12pt;
      font-style: italic;
      margin: 5px 0 0 0;
    }

    .document-info {
      text-align: right;
      font-size: 10pt;
    }

    .document-info p {
      margin: 2px 0;
    }

    .section {
      margin-bottom: 30px;
    }

    .section-title {
      font-size: 18pt;
      color: #007e8c;
      border-bottom: 3px solid #007e8c;
      padding-bottom: 10px;
      margin-bottom: 20px;
    }

    .subsection-title {
      font-size: 14pt;
      color: #007e8c;
      margin: 20px 0 10px 0;
    }

    .info-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }

    .info-table tr {
      border-bottom: 1px solid #e0e0e0;
    }

    .info-table td {
      padding: 8px 10px;
    }

    .info-table .label {
      width: 200px;
      font-weight: 600;
      color: #555;
    }

    .info-table .value {
      color: #333;
    }

    .agreement-content {
      font-size: 10pt;
      line-height: 1.8;
    }

    .agreement-content h2,
    .agreement-content h3,
    .agreement-content h4 {
      color: #007e8c;
      margin-top: 20px;
      margin-bottom: 10px;
    }

    .agreement-content ul,
    .agreement-content ol {
      margin-left: 25px;
      margin-bottom: 15px;
    }

    .agreement-content li {
      margin-bottom: 8px;
    }

    .agreement-content p {
      margin-bottom: 12px;
    }

    .acknowledgements {
      background: #f5f7fa;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 30px;
    }

    .checklist {
      list-style: none;
      margin-top: 15px;
    }

    .checklist li {
      padding: 8px 0;
      font-size: 11pt;
    }

    .signature-block {
      border: 2px solid #007e8c;
      padding: 20px;
      border-radius: 8px;
      background: white;
    }

    .signature-image-container {
      margin-bottom: 20px;
    }

    .signature-label {
      font-weight: 600;
      margin-bottom: 5px;
    }

    .signature-image {
      max-width: 400px;
      height: auto;
      border: 1px solid #ddd;
      padding: 10px;
      background: white;
    }

    .signature-details {
      width: 100%;
      border-collapse: collapse;
    }

    .signature-details td {
      padding: 10px;
      border-bottom: 1px solid #e0e0e0;
    }

    .footer {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 2px solid #007e8c;
      text-align: center;
      font-size: 9pt;
      color: #666;
    }

    .footer p {
      margin: 5px 0;
    }

    .page-break {
      page-break-after: always;
    }

    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  `;
}

// ===================================================
// HELPER FUNCTIONS
// ===================================================
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-AU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function formatDateTime(date) {
  return date.toLocaleString('en-AU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });
}

function formatBusinessStructure(structure) {
  const structures = {
    'sole_trader': 'Sole Trader',
    'pty_ltd': 'Pty Ltd Company'
  };
  return structures[structure] || structure;
}

function formatArray(arr) {
  if (!arr || arr.length === 0) return 'None specified';
  return arr.map(item => item.charAt(0).toUpperCase() + item.slice(1).replace(/-/g, ' ')).join(', ');
}

function formatAvailability(schedule) {
  if (!schedule || Object.keys(schedule).length === 0) {
    return '<p style="color: #999;">No availability specified</p>';
  }

  const dayNames = {
    'monday': 'Monday',
    'tuesday': 'Tuesday',
    'wednesday': 'Wednesday',
    'thursday': 'Thursday',
    'friday': 'Friday',
    'saturday': 'Saturday',
    'sunday': 'Sunday'
  };

  const timeSlotLabels = {
    '7-11am': '7:00 AM - 11:00 AM',
    '12-5pm': '12:00 PM - 5:00 PM',
    '6-11:30pm': '6:00 PM - 11:30 PM'
  };

  let html = '<table class="info-table" style="width: 100%; border-collapse: collapse;">';
  html += '<thead><tr style="background: #f5f5f5;"><th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Day</th><th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Available Times</th></tr></thead>';
  html += '<tbody>';

  const orderedDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  orderedDays.forEach(day => {
    const dayLabel = dayNames[day];
    const timeSlots = schedule[day];

    if (timeSlots && timeSlots.length > 0) {
      const formattedSlots = timeSlots.map(slot => timeSlotLabels[slot] || slot).join(', ');
      html += `<tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>${dayLabel}</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${formattedSlots}</td></tr>`;
    } else {
      html += `<tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>${dayLabel}</strong></td><td style="padding: 8px; border: 1px solid #ddd; color: #999;">Not available</td></tr>`;
    }
  });

  html += '</tbody></table>';
  return html;
}
