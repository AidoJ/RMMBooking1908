const { createClient } = require('@supabase/supabase-js');
const { getLocalDate } = require('./utils/timezoneHelpers');

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

    // Check if it's a quote based on actual data structure
    const isQuote = booking.quote_only === 'true' || booking.quote_only === true || booking.status === 'quote_requested';
    
    if (!isQuote) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'PDF generation is only available for quote requests' })
      };
    }

    // Generate HTML content for PDF
    const htmlContent = generateQuoteHTML(booking);
    
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
          filename: `Quote-${booking.id.substring(0, 8).toUpperCase()}-${new Date().toLocaleDateString('en-AU').replace(/\//g, '-')}.pdf`
        })
      };
    }

  } catch (error) {
    console.error('Error generating quote:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to generate quote',
        details: error.message 
      })
    };
  }
};

function generateQuoteHTML(booking) {
  // Use the actual booking_id which contains the proper quote reference
  const quoteRef = booking.booking_id || booking.id;
  const quoteDate = new Date(booking.created_at).toLocaleDateString('en-AU');
  const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-AU');

  // Convert UTC to local timezone
  const timezone = booking.booking_timezone || 'Australia/Brisbane';
  const eventDate = getLocalDate(booking.booking_time, timezone);

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
      <title>Quote ${quoteRef} - Rejuvenators Mobile Massage</title>
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
          align-items: center;
        }
        .brand h1 {
          color: #007e8c;
          font-size: 28px;
          font-weight: bold;
          margin-bottom: 5px;
        }
        .brand p {
          color: #007e8c;
          font-style: italic;
          font-size: 14px;
        }
        .quote-title {
          color: #333;
          font-size: 24px;
          font-weight: bold;
        }
        .quote-details {
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
        .investment-box {
          background: #f0f8ff;
          border: 2px solid #007e8c;
          border-radius: 10px;
          padding: 20px;
          text-align: center;
          margin: 20px 0;
        }
        .investment-box .label {
          color: #007e8c;
          font-size: 20px;
          font-weight: bold;
          margin-bottom: 10px;
        }
        .investment-box .amount {
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
        .quote-response {
          background: #f8f9fa;
          border: 2px solid #007e8c;
          border-radius: 10px;
          padding: 30px;
          margin: 40px 0;
          text-align: center;
        }
        .quote-response h2 {
          color: #007e8c;
          margin-top: 0;
          margin-bottom: 10px;
        }
        .response-buttons {
          display: flex;
          gap: 20px;
          justify-content: center;
          margin: 25px 0;
          flex-wrap: wrap;
        }
        .accept-btn, .decline-btn {
          padding: 15px 30px;
          font-size: 18px;
          font-weight: bold;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.3s ease;
          min-width: 180px;
        }
        .accept-btn {
          background: #52c41a;
          color: white;
        }
        .accept-btn:hover {
          background: #389e0d;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(82, 196, 26, 0.3);
        }
        .decline-btn {
          background: #f5222d;
          color: white;
        }
        .decline-btn:hover {
          background: #cf1322;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(245, 34, 45, 0.3);
        }
        .response-note {
          margin-top: 20px;
          color: #666;
        }
        @media print {
          .quote-response {
            display: none !important;
          }
        }
        @media (max-width: 600px) {
          .response-buttons {
            flex-direction: column;
            align-items: center;
          }
        }
      </style>
    </head>
    <body>
      <button class="print-button" onclick="window.print()">💾 Save as PDF</button>
      
      <div class="instructions">
        <strong>📝 Instructions:</strong> Click the "Save as PDF" button or use Ctrl+P (Cmd+P on Mac) to save this quote as a PDF file.
      </div>
      
      <div class="container">
        <div class="header">
          <div class="brand">
            <h1>REJUVENATORS®</h1>
            <p>Mobile Massage</p>
          </div>
          <div class="quote-title">OFFICIAL QUOTE</div>
        </div>

        <div class="quote-details">
          <div class="detail-row">
            <div class="detail-label">Quote Reference:</div>
            <div class="detail-value">${quoteRef}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">Quote Date:</div>
            <div class="detail-value">${quoteDate}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">Valid Until:</div>
            <div class="detail-value">${validUntil}</div>
          </div>
        </div>

        <div class="section">
          <div class="section-header">Contact Information</div>
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
          <div class="section-header">Event Details</div>
          <div class="detail-row">
            <div class="detail-label">Event Date:</div>
            <div class="detail-value">${eventDate}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">Event Address:</div>
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
        </div>

        <div class="section">
          <div class="section-header">Massage Requirements</div>
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
          <div class="detail-row">
            <div class="detail-label">Preferred Therapists:</div>
            <div class="detail-value">${booking.preferred_therapists || 'Let us recommend'}</div>
          </div>
          ${booking.setup_requirements ? `
          <div class="detail-row">
            <div class="detail-label">Setup Requirements:</div>
            <div class="detail-value">${booking.setup_requirements}</div>
          </div>
          ` : ''}
          ${booking.special_requirements ? `
          <div class="detail-row">
            <div class="detail-label">Special Requirements:</div>
            <div class="detail-value">${booking.special_requirements}</div>
          </div>
          ` : ''}
        </div>

        <div class="section">
          <div class="section-header">Investment</div>
          <div class="pricing-breakdown">
            <div class="pricing-row">
              <div class="pricing-label">Estimate Price:</div>
              <div class="pricing-value">$${((booking.price || 0) + (booking.discount_amount || 0)).toFixed(2)}</div>
            </div>
            <div class="pricing-row discount">
              <div class="pricing-label">Applied Discount:</div>
              <div class="pricing-value">$${(booking.discount_amount || 0).toFixed(2)}</div>
            </div>
            <div class="pricing-row gst">
              <div class="pricing-label">GST Component:</div>
              <div class="pricing-value">$${(booking.tax_rate_amount || 0).toFixed(2)}</div>
            </div>
            <div class="pricing-row">
              <div class="pricing-label">Final Quote Price:</div>
              <div class="pricing-value">$${(booking.price || 0).toFixed(2)}</div>
            </div>
          </div>
          <div class="investment-box">
            <div class="label">Final Quote Price</div>
            <div class="amount">$${(booking.price || 0).toFixed(2)}</div>
          </div>
          ${booking.payment_method ? `
          <div class="detail-row">
            <div class="detail-label">Payment Method:</div>
            <div class="detail-value">${formatPaymentMethod(booking.payment_method)}</div>
          </div>
          ` : ''}
          ${booking.po_number ? `
          <div class="detail-row">
            <div class="detail-label">PO Number:</div>
            <div class="detail-value">${booking.po_number}</div>
          </div>
          ` : ''}
        </div>

        <div class="section">
          <div class="section-header">Terms & Conditions</div>
          <div class="terms">
            <ul>
              <li>This quote is valid for 30 days from the date of issue</li>
              <li>Prices include GST where applicable</li>
              <li>Payment is required within 7 days of service completion</li>
              <li>Cancellation must be made at least 24 hours in advance</li>
              <li>All therapists are fully qualified and insured</li>
              <li>Equipment and massage tables will be provided by Rejuvenators</li>
              <li>A suitable private space must be provided for each treatment</li>
            </ul>
          </div>
        </div>

        <div class="quote-response">
          <div class="response-header">
            <h2>Ready to move forward?</h2>
            <p>Please let us know your decision on this quote:</p>
          </div>
          <div class="response-buttons">
            <button class="accept-btn" onclick="respondToQuote('accept')">
              ✅ Accept Quote
            </button>
            <button class="decline-btn" onclick="respondToQuote('decline')">
              ❌ Decline Quote
            </button>
          </div>
          <div class="response-note">
            <p><small>By clicking a button above, you'll be taken to a form to confirm your decision and we'll be notified immediately.</small></p>
          </div>
        </div>

        <div class="footer">
          <p><strong>Thank you for choosing Rejuvenators Mobile Massage</strong></p>
          <p>📧 info@rejuvenators.com | 📞 1300 302 542</p>
        </div>
      </div>
      
      <script>
        // Auto-focus print dialog on mobile devices
        if (/Mobi|Android/i.test(navigator.userAgent)) {
          setTimeout(() => {
            document.querySelector('.print-button').textContent = '📄 Open Print Dialog';
          }, 1000);
        }
        
        // Handle quote response
        function respondToQuote(response) {
          const quoteId = '${booking.id}';
          
          // Simple confirmation dialog
          const message = response === 'accept' 
            ? 'Are you ready to accept this quote? We will contact you within 24 hours to finalize the details.'
            : 'Are you sure you want to decline this quote? You can always contact us directly to discuss alternatives.';
          
          if (confirm(message)) {
            // Create a simple form to submit the response
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = '/.netlify/functions/quote-response';
            form.style.display = 'none';
            
            // Add form fields
            const bookingIdField = document.createElement('input');
            bookingIdField.type = 'hidden';
            bookingIdField.name = 'bookingId';
            bookingIdField.value = quoteId;
            
            const responseField = document.createElement('input');
            responseField.type = 'hidden';
            responseField.name = 'response';
            responseField.value = response;
            
            form.appendChild(bookingIdField);
            form.appendChild(responseField);
            
            // Submit the form
            document.body.appendChild(form);
            form.submit();
          }
        }
      </script>
    </body>
    </html>
  `;
}