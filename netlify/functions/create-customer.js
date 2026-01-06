const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Service role bypasses RLS
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { firstName, lastName, email, phone, isGuest = false, emailSubscribed = false } = JSON.parse(event.body);

    // Validate required fields
    if (!email || !email.includes('@')) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Valid email is required' })
      };
    }

    if (!firstName || !lastName) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'First name and last name are required' })
      };
    }

    console.log('🔍 Getting or creating customer:', email);

    // Check if customer exists
    const { data: existing, error: fetchError } = await supabase
      .from('customers')
      .select('id, customer_code, first_name, last_name, is_guest')
      .eq('email', email)
      .maybeSingle();

    if (fetchError) {
      console.error('❌ Error fetching customer:', fetchError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Error checking customer' })
      };
    }

    // If customer exists, update email subscription if they're opting in
    if (existing && existing.id) {
      console.log('✅ Existing customer found:', existing.customer_code);

      // If they're opting in to emails, update their subscription preference
      if (emailSubscribed) {
        await supabase
          .from('customers')
          .update({ email_subscribed: true })
          .eq('id', existing.id);
        console.log('📧 Updated email subscription to true');
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          customer_id: existing.id,
          customer_code: existing.customer_code,
          is_new: false
        })
      };
    }

    // Create new customer
    console.log('🆕 Creating new customer...');

    // Generate customer code based on guest status
    let customerCode;
    
    if (isGuest) {
      // Generate guest code using sequential numbering
      const { data: guestCustomers } = await supabase
        .from('customers')
        .select('customer_code')
        .ilike('customer_code', 'GUEST%');
      
      let maxNum = 0;
      if (guestCustomers && guestCustomers.length > 0) {
        guestCustomers.forEach(row => {
          const match = row.customer_code && row.customer_code.match(/GUEST(\d{4})$/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNum) maxNum = num;
          }
        });
      }
      
      const nextNum = (maxNum + 1).toString().padStart(4, '0');
      customerCode = `GUEST${nextNum}`;
    } else {
      // Generate regular customer code based on surname
      const surname = lastName || firstName || 'CUST';
      const prefix = surname.substring(0, 4).toUpperCase().replace(/[^A-Z]/g, '');
      
      // Get existing codes with this prefix
      const { data: existing } = await supabase
        .from('customers')
        .select('customer_code')
        .ilike('customer_code', `${prefix}%`);
      
      let maxNum = 0;
      if (existing && existing.length > 0) {
        existing.forEach(row => {
          const match = row.customer_code && row.customer_code.match(/\d{4}$/);
          if (match) {
            const num = parseInt(match[0], 10);
            if (num > maxNum) maxNum = num;
          }
        });
      }
      
      const nextNum = (maxNum + 1).toString().padStart(4, '0');
      customerCode = `${prefix}${nextNum}`;
    }
    
    console.log('Generated customer code:', customerCode);

    // Insert new customer
    const { data: inserted, error: insertError } = await supabase
      .from('customers')
      .insert([{
        first_name: firstName,
        last_name: lastName,
        email: email,
        phone: phone,
        customer_code: customerCode,
        is_guest: isGuest,
        email_subscribed: emailSubscribed
      }])
      .select('id, customer_code')
      .maybeSingle();

    if (insertError) {
      console.error('❌ Error inserting customer:', insertError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Error creating customer',
          details: insertError.message 
        })
      };
    }

    console.log('✅ New customer created:', inserted.customer_code);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        customer_id: inserted.id,
        customer_code: inserted.customer_code,
        is_new: true
      })
    };

  } catch (error) {
    console.error('❌ Error in create-customer:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      })
    };
  }
};

