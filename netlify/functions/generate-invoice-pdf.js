const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (!['GET', 'POST'].includes(event.httpMethod)) {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    let bookingId;
    
    if (event.httpMethod === 'GET') {
      // Handle GET requests (URL parameters from email links)
      const params = event.queryStringParameters || {};
      bookingId = params.id;
    } else {
      // Handle POST requests (JSON body from admin panel)
      const { bookingId: postBookingId } = JSON.parse(event.body);
      bookingId = postBookingId;
    }
    
    if (!bookingId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Booking ID is required' })
      };
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Fetch booking data
    const { data: booking, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (error || !booking) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Booking not found' })
      };
    }

    // Check if it has an invoice number (converted to invoice)
    if (!booking.invoice_number) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invoice PDF generation is only available for invoiced bookings' })
      };
    }

    // Fetch system settings for business details
    const { data: settings, error: settingsError } = await supabase
      .from('system_settings')
      .select('*')
      .in('key', ['business_name', 'business_address', 'business_abn', 'bank_account_name', 'bank_account_bsb', 'bank_account_no']);

    if (settingsError) {
      console.error('Error fetching system settings:', settingsError);
    }

    // Convert settings array to object
    const systemSettings = {};
    if (settings) {
      settings.forEach(setting => {
        systemSettings[setting.key] = setting.value;
      });
    }

    // Generate HTML content for PDF
    const htmlContent = generateInvoiceHTML(booking, systemSettings);
    
    if (event.httpMethod === 'GET') {
      // For GET requests (email links), return HTML directly
      return {
        statusCode: 200,
        headers: {
          ...headers,
          'Content-Type': 'text/html; charset=utf-8'
        },
        body: htmlContent
      };
    } else {
      // For POST requests (admin panel), return JSON
      return {
        statusCode: 200,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: true,
          html: htmlContent,
          filename: `Invoice-${booking.invoice_number}-${new Date().toLocaleDateString('en-AU').replace(/\//g, '-')}.pdf`
        })
      };
    }

  } catch (error) {
    console.error('Error generating invoice:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to generate invoice',
        details: error.message 
      })
    };
  }
};

function generateInvoiceHTML(booking, systemSettings) {
  const invoiceNumber = booking.invoice_number;
  const quoteRef = booking.booking_id || booking.id;
  const invoiceDate = new Date(booking.invoice_date || booking.created_at).toLocaleDateString('en-AU');
  const paymentDueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-AU');
  
  const eventDate = new Date(booking.booking_time).toLocaleDateString('en-AU', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const totalMinutes = booking.number_of_massages * booking.duration_per_massage;
  const totalDuration = `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;

  const formatPaymentMethod = (method) => {
    const methodMap = {
      'credit_card': 'Credit Card',
      'invoice': 'Invoice (Net 30)',
      'bank_transfer': 'Bank Transfer/EFT'
    };
    return methodMap[method] || method;
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Invoice ${invoiceNumber} - ${systemSettings.business_name || 'Rejuvenators Mobile Massage'}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        @media screen {
          body {
            font-family: 'Helvetica', Arial, sans-serif;
            color: #333;
            line-height: 1.6;
            padding: 40px;
            background: #f5f5f5;
          }
          .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          }
          .print-button {
            position: fixed;
            top: 20px;
            right: 20px;
            background: #007e8c;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            z-index: 1000;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          }
          .print-button:hover {
            background: #005f6b;
          }
          .instructions {
            background: #e8f4f5;
            border: 1px solid #007e8c;
            border-radius: 5px;
            padding: 15px;
            margin-bottom: 30px;
            color: #005f6b;
          }
        }
        
        @media print {
          body {
            font-family: 'Helvetica', Arial, sans-serif;
            color: #333;
            line-height: 1.6;
            padding: 0;
            background: white;
          }
          .container {
            max-width: none;
            margin: 0;
            background: white;
            padding: 20px;
            border-radius: 0;
            box-shadow: none;
          }
          .print-button, .instructions {
            display: none !important;
          }
          .page-break {
            page-break-before: always;
          }
        }
        
        .header {
          border-bottom: 2px solid #007e8c;
          padding-bottom: 20px;
          margin-bottom: 30px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        .brand h1 {
          color: #007e8c;
          font-size: 28px;
          font-weight: bold;
          margin-bottom: 5px;
        }
        .brand .address {
          color: #666;
          font-size: 12px;
          margin-bottom: 3px;
        }
        .brand .abn {
          color: #666;
          font-size: 12px;
          font-weight: bold;
        }
        .invoice-title {
          color: #333;
          font-size: 32px;
          font-weight: bold;
          text-align: right;
        }
        .invoice-details {
          background: #f8f9fa;
          padding: 15px;
          border-radius: 5px;
          margin-bottom: 30px;
        }
        .section {
          margin-bottom: 30px;
        }
        .section-header {
          color: #007e8c;
          font-size: 18px;
          font-weight: bold;
          border-bottom: 1px solid #ddd;
          padding-bottom: 5px;
          margin-bottom: 15px;
        }
        .detail-row {
          display: flex;
          margin-bottom: 8px;
        }
        .detail-label {
          font-weight: bold;
          width: 150px;
          min-width: 150px;
        }
        .detail-value {
          flex: 1;
        }
        .amount-due-box {
          background: #f0f8ff;
          border: 2px solid #007e8c;
          border-radius: 10px;
          padding: 20px;
          text-align: center;
          margin: 20px 0;
        }
        .amount-due-box .label {
          color: #007e8c;
          font-size: 20px;
          font-weight: bold;
          margin-bottom: 10px;
        }
        .amount-due-box .amount {
          color: #007e8c;
          font-size: 32px;
          font-weight: bold;
        }
        .pricing-breakdown {
          background: #f9f9f9;
          border: 1px solid #d9d9d9;
          border-radius: 8px;
          padding: 15px;
          margin: 15px 0;
        }
        .pricing-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px solid #e8e8e8;
        }
        .pricing-row:last-child {
          border-bottom: none;
          border-top: 2px solid #007e8c;
          font-weight: bold;
          font-size: 16px;
        }
        .pricing-row.discount .pricing-label {
          color: #52c41a;
          font-weight: bold;
        }
        .pricing-row.discount .pricing-value {
          color: #52c41a;
          font-weight: bold;
        }
        .pricing-row.gst .pricing-label {
          color: #666;
          font-size: 12px;
        }
        .pricing-row.gst .pricing-value {
          color: #666;
          font-size: 12px;
        }
        .pricing-label {
          font-weight: 500;
          color: #333;
        }
        .pricing-value {
          font-weight: bold;
          color: #333;
        }
        .payment-details {
          background: #e8f5e8;
          border: 1px solid #4caf50;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .payment-details h3 {
          color: #2e7d32;
          margin-bottom: 15px;
        }
        .bank-detail {
          display: flex;
          margin-bottom: 8px;
        }
        .bank-label {
          font-weight: bold;
          width: 120px;
          min-width: 120px;
          color: #2e7d32;
        }
        .bank-value {
          flex: 1;
          color: #2e7d32;
          font-weight: 500;
        }
        .terms {
          background: #f8f9fa;
          padding: 15px;
          border-radius: 5px;
          font-size: 12px;
        }
        .terms ul {
          list-style-type: none;
          padding-left: 0;
        }
        .terms li {
          margin-bottom: 5px;
          padding-left: 15px;
          position: relative;
        }
        .terms li:before {
          content: "•";
          color: #007e8c;
          position: absolute;
          left: 0;
        }
        .footer {
          border-top: 1px solid #ddd;
          padding-top: 20px;
          margin-top: 40px;
          text-align: center;
          color: #007e8c;
        }
        .due-notice {
          background: #fff3cd;
          border: 1px solid #ffc107;
          border-radius: 8px;
          padding: 15px;
          margin: 20px 0;
          text-align: center;
        }
        .due-notice .due-date {
          font-size: 18px;
          font-weight: bold;
          color: #856404;
        }
      </style>
    </head>
    <body>
      <button class="print-button" onclick="window.print()">💾 Save as PDF</button>
      
      <div class="instructions">
        <strong>📝 Instructions:</strong> Click the "Save as PDF" button or use Ctrl+P (Cmd+P on Mac) to save this invoice as a PDF file.
      </div>
      
      <div class="container">
        <div class="header">
          <div class="brand">
            <h1>${systemSettings.business_name || 'REJUVENATORS®'}</h1>
            <div class="address">${systemSettings.business_address || ''}</div>
            <div class="abn">ABN: ${systemSettings.business_abn || ''}</div>
          </div>
          <div class="invoice-title">INVOICE</div>
        </div>

        <div class="invoice-details">
          <div class="detail-row">
            <div class="detail-label">Invoice Number:</div>
            <div class="detail-value">${invoiceNumber}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">Quote Reference:</div>
            <div class="detail-value">${quoteRef}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">Invoice Date:</div>
            <div class="detail-value">${invoiceDate}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">Service Date:</div>
            <div class="detail-value">${eventDate}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">Payment Terms:</div>
            <div class="detail-value">Net 30 Days</div>
          </div>
        </div>

        <div class="due-notice">
          <div class="due-date">Payment Due: ${paymentDueDate}</div>
        </div>

        <div class="section">
          <div class="section-header">Bill To</div>
          <div class="detail-row">
            <div class="detail-label">Contact Name:</div>
            <div class="detail-value">${booking.corporate_contact_name || 'Not specified'}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">Company:</div>
            <div class="detail-value">${booking.business_name || 'Not specified'}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">Email:</div>
            <div class="detail-value">${booking.corporate_contact_email || 'Not specified'}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">Phone:</div>
            <div class="detail-value">${booking.corporate_contact_phone || 'Not specified'}</div>
          </div>
        </div>

        <div class="section">
          <div class="section-header">Service Details</div>
          <div class="detail-row">
            <div class="detail-label">Service Location:</div>
            <div class="detail-value">${booking.address || 'Not specified'}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">Event Type:</div>
            <div class="detail-value">${booking.event_type || 'Corporate Event'}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">Expected Attendees:</div>
            <div class="detail-value">${booking.expected_attendees || 'Not specified'}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">Number of Massages:</div>
            <div class="detail-value">${booking.number_of_massages}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">Duration per Massage:</div>
            <div class="detail-value">${booking.duration_per_massage} minutes</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">Total Event Duration:</div>
            <div class="detail-value">${totalDuration}</div>
          </div>
        </div>

        <div class="section">
          <div class="section-header">Amount Due</div>
          <div class="pricing-breakdown">
            <div class="pricing-row">
              <div class="pricing-label">Subtotal:</div>
              <div class="pricing-value">$${((booking.price || 0) + (booking.discount_amount || 0)).toFixed(2)}</div>
            </div>
            ${(booking.discount_amount && booking.discount_amount > 0) ? `
            <div class="pricing-row discount">
              <div class="pricing-label">Applied Discount:</div>
              <div class="pricing-value">-$${(booking.discount_amount || 0).toFixed(2)}</div>
            </div>
            ` : ''}
            <div class="pricing-row gst">
              <div class="pricing-label">GST Component (10%):</div>
              <div class="pricing-value">$${(booking.tax_rate_amount || 0).toFixed(2)}</div>
            </div>
            <div class="pricing-row">
              <div class="pricing-label">Total Amount Due:</div>
              <div class="pricing-value">$${(booking.price || 0).toFixed(2)}</div>
            </div>
          </div>
          
          <div class="amount-due-box">
            <div class="label">Total Amount Due</div>
            <div class="amount">$${(booking.price || 0).toFixed(2)}</div>
          </div>
        </div>

        <div class="payment-details">
          <h3>🏦 Payment Details</h3>
          <div class="bank-detail">
            <div class="bank-label">Account Name:</div>
            <div class="bank-value">${systemSettings.bank_account_name || 'Not available'}</div>
          </div>
          <div class="bank-detail">
            <div class="bank-label">BSB:</div>
            <div class="bank-value">${systemSettings.bank_account_bsb || 'Not available'}</div>
          </div>
          <div class="bank-detail">
            <div class="bank-label">Account Number:</div>
            <div class="bank-value">${systemSettings.bank_account_no || 'Not available'}</div>
          </div>
          <div class="bank-detail">
            <div class="bank-label">Reference:</div>
            <div class="bank-value">${invoiceNumber}</div>
          </div>
          ${booking.payment_method ? `
          <div class="bank-detail">
            <div class="bank-label">Payment Method:</div>
            <div class="bank-value">${formatPaymentMethod(booking.payment_method)}</div>
          </div>
          ` : ''}
          ${booking.po_number ? `
          <div class="bank-detail">
            <div class="bank-label">PO Number:</div>
            <div class="bank-value">${booking.po_number}</div>
          </div>
          ` : ''}
        </div>

        <div class="section">
          <div class="section-header">Payment Instructions</div>
          <p style="margin-bottom: 15px;">
            Please transfer the payment to the bank account details above using your invoice number 
            <strong>${invoiceNumber}</strong> as the reference.
          </p>
          <p style="margin-bottom: 15px;">
            <strong>Payment is due within 30 days of invoice date (${paymentDueDate}).</strong>
          </p>
          <p>
            If you have any questions about this invoice, please contact us at info@rejuvenators.com 
            or 1300 302 542.
          </p>
        </div>

        <div class="section">
          <div class="section-header">Terms & Conditions</div>
          <div class="terms">
            <ul>
              <li>Payment is due within 30 days of invoice date</li>
              <li>Late payment fees may apply after the due date</li>
              <li>All prices include GST where applicable</li>
              <li>Services were performed as agreed in the original quote</li>
              <li>Please use the invoice number as your payment reference</li>
              <li>For payment queries, contact our accounts department</li>
            </ul>
          </div>
        </div>

        <div class="footer">
          <p><strong>Thank you for your business with ${systemSettings.business_name || 'Rejuvenators Mobile Massage'}</strong></p>
          <p>📧 info@rejuvenators.com | 📞 1300 302 542</p>
          <p style="margin-top: 10px; font-size: 12px;">Invoice Number: ${invoiceNumber}</p>
        </div>
      </div>
      
      <script>
        // Auto-focus print dialog on mobile devices
        if (/Mobi|Android/i.test(navigator.userAgent)) {
          setTimeout(() => {
            document.querySelector('.print-button').textContent = '📄 Open Print Dialog';
          }, 1000);
        }
      </script>
    </body>
    </html>
  `;
}