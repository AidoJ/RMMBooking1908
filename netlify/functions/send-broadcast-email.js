const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// EmailJS configuration
const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID || 'service_puww2kb';
const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY || 'qfM_qA664E4JddSMN';
const EMAILJS_PRIVATE_KEY = process.env.EMAILJS_PRIVATE_KEY;
const EMAILJS_BROADCAST_TEMPLATE = 'template_broadcast'; // Template for broadcast emails

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    // Verify admin authentication
    const authHeader = event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ success: false, error: 'Missing authorization token' })
      };
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify Supabase Auth token
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !authUser) {
      console.error('❌ Auth verification failed:', authError?.message);
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ success: false, error: 'Invalid or expired token' })
      };
    }

    // Get admin_users record to check role
    const { data: adminUser, error: adminError } = await supabase
      .from('admin_users')
      .select('id, email, role, first_name, last_name')
      .eq('auth_id', authUser.id)
      .eq('is_active', true)
      .single();

    if (adminError || !adminUser || (adminUser.role !== 'super_admin' && adminUser.role !== 'admin')) {
      console.error('❌ Admin user not found or invalid role:', adminError?.message);
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ success: false, error: 'Admin access required' })
      };
    }

    console.log('✅ Admin authenticated:', adminUser.email);

    // Parse request body
    const { subject, body, recipientType, recipientIds } = JSON.parse(event.body);

    if (!subject || !body || !recipientType) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Missing required fields' })
      };
    }

    console.log('📧 Sending broadcast:', { subject, recipientType, recipientIds });

    // Get recipients based on type
    let recipients = [];

    if (recipientType === 'all_therapists') {
      const { data, error } = await supabase
        .from('therapist_profiles')
        .select('id, first_name, last_name, email')
        .eq('is_active', true);

      if (error) throw new Error(`Failed to fetch therapists: ${error.message}`);
      recipients = data.map(t => ({
        id: t.id,
        first_name: t.first_name,
        last_name: t.last_name,
        email: t.email,
        type: 'therapist'
      }));

    } else if (recipientType === 'all_customers') {
      const { data, error } = await supabase
        .from('customers')
        .select('id, first_name, last_name, email')
        .eq('email_subscribed', true);

      if (error) throw new Error(`Failed to fetch customers: ${error.message}`);
      recipients = data.map(c => ({
        id: c.id,
        first_name: c.first_name,
        last_name: c.last_name,
        email: c.email,
        type: 'customer'
      }));

    } else if (recipientType === 'individual_therapists') {
      if (!recipientIds || recipientIds.length === 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'No recipients selected' })
        };
      }

      const { data, error } = await supabase
        .from('therapist_profiles')
        .select('id, first_name, last_name, email')
        .in('id', recipientIds);

      if (error) throw new Error(`Failed to fetch therapists: ${error.message}`);
      recipients = data.map(t => ({
        id: t.id,
        first_name: t.first_name,
        last_name: t.last_name,
        email: t.email,
        type: 'therapist'
      }));

    } else if (recipientType === 'individual_customers') {
      if (!recipientIds || recipientIds.length === 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'No recipients selected' })
        };
      }

      const { data, error } = await supabase
        .from('customers')
        .select('id, first_name, last_name, email')
        .in('id', recipientIds);

      if (error) throw new Error(`Failed to fetch customers: ${error.message}`);
      recipients = data.map(c => ({
        id: c.id,
        first_name: c.first_name,
        last_name: c.last_name,
        email: c.email,
        type: 'customer'
      }));
    }

    if (recipients.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'No recipients found' })
      };
    }

    console.log(`📧 Found ${recipients.length} recipients`);

    // Create broadcast record
    const { data: broadcast, error: broadcastError } = await supabase
      .from('email_broadcasts')
      .insert({
        subject,
        body,
        recipient_type: recipientType,
        recipient_ids: recipientIds ? JSON.stringify(recipientIds) : null,
        total_recipients: recipients.length,
        sent_by: adminUser.id,
        status: 'sending'
      })
      .select('id')
      .single();

    if (broadcastError) {
      console.error('❌ Error creating broadcast record:', broadcastError);
      throw new Error(`Failed to create broadcast: ${broadcastError.message}`);
    }

    console.log('✅ Broadcast record created:', broadcast.id);

    // Send emails to each recipient
    let successCount = 0;
    let failCount = 0;
    const recipientRecords = [];

    for (const recipient of recipients) {
      try {
        // Replace template variables in body
        const personalizedBody = body
          .replace(/\{\{first_name\}\}/g, recipient.first_name)
          .replace(/\{\{last_name\}\}/g, recipient.last_name)
          .replace(/\{\{email\}\}/g, recipient.email);

        // Send email via EmailJS
        await sendBroadcastEmail(recipient.email, `${recipient.first_name} ${recipient.last_name}`, subject, personalizedBody);

        // Track successful send
        recipientRecords.push({
          broadcast_id: broadcast.id,
          recipient_email: recipient.email,
          recipient_name: `${recipient.first_name} ${recipient.last_name}`,
          recipient_type: recipient.type,
          recipient_id: recipient.id,
          status: 'sent',
          sent_at: new Date().toISOString()
        });

        successCount++;
        console.log(`✅ Sent to ${recipient.email}`);

      } catch (emailError) {
        console.error(`❌ Failed to send to ${recipient.email}:`, emailError);

        // Track failed send
        recipientRecords.push({
          broadcast_id: broadcast.id,
          recipient_email: recipient.email,
          recipient_name: `${recipient.first_name} ${recipient.last_name}`,
          recipient_type: recipient.type,
          recipient_id: recipient.id,
          status: 'failed',
          error_message: emailError.message
        });

        failCount++;
      }
    }

    // Save recipient records
    if (recipientRecords.length > 0) {
      await supabase
        .from('email_broadcast_recipients')
        .insert(recipientRecords);
    }

    // Update broadcast status
    const finalStatus = failCount === recipients.length ? 'failed' : 'sent';
    await supabase
      .from('email_broadcasts')
      .update({
        status: finalStatus,
        sent_at: new Date().toISOString(),
        error_message: failCount > 0 ? `${failCount} of ${recipients.length} emails failed` : null
      })
      .eq('id', broadcast.id);

    console.log(`✅ Broadcast complete: ${successCount} sent, ${failCount} failed`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Broadcast sent to ${successCount} of ${recipients.length} recipients`,
        successCount,
        failCount,
        totalRecipients: recipients.length
      })
    };

  } catch (error) {
    console.error('❌ Broadcast error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};

// Send broadcast email using EmailJS
async function sendBroadcastEmail(toEmail, toName, subject, body) {
  if (!EMAILJS_PRIVATE_KEY) {
    throw new Error('EmailJS private key not configured');
  }

  const templateParams = {
    to_email: toEmail,
    to_name: toName,
    subject: subject,
    message: body
  };

  const emailData = {
    service_id: EMAILJS_SERVICE_ID,
    template_id: EMAILJS_BROADCAST_TEMPLATE,
    user_id: EMAILJS_PUBLIC_KEY,
    accessToken: EMAILJS_PRIVATE_KEY,
    template_params: templateParams
  };

  const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(emailData)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`EmailJS error: ${response.status} - ${errorText}`);
  }

  return { success: true };
}
