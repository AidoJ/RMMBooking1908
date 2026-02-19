const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

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

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { registrationId } = JSON.parse(event.body);

    if (!registrationId) {
      throw new Error('Registration ID is required');
    }

    console.log(`🎓 Starting enrollment for registration: ${registrationId}`);

    // ===================================================
    // STEP 1: Fetch Registration Data
    // ===================================================
    const { data: registration, error: fetchError } = await supabase
      .from('therapist_registrations')
      .select('*')
      .eq('id', registrationId)
      .single();

    if (fetchError) throw fetchError;

    if (!registration) {
      throw new Error('Registration not found');
    }

    if (registration.status !== 'approved') {
      throw new Error('Registration must be approved before enrollment');
    }

    if (registration.therapist_profile_id) {
      throw new Error('Registration has already been enrolled');
    }

    console.log(`📋 Found registration for: ${registration.first_name} ${registration.last_name}`);

    // ===================================================
    // STEP 2: Create Supabase Auth User
    // ===================================================

    // Generate a random password
    const tempPassword = crypto.randomBytes(16).toString('hex');

    console.log(`👤 Creating auth user for: ${registration.email}`);

    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: registration.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        first_name: registration.first_name,
        last_name: registration.last_name,
        role: 'therapist'
      }
    });

    if (authError) {
      console.error('❌ Auth user creation failed:', authError);
      throw new Error(`Failed to create auth user: ${authError.message}`);
    }

    console.log(`✅ Auth user created: ${authUser.user.id}`);

    // ===================================================
    // STEP 3: Create Admin User Record
    // ===================================================

    console.log(`👤 Creating admin_users record...`);

    const { data: adminUser, error: adminUserError } = await supabase
      .from('admin_users')
      .insert({
        auth_id: authUser.user.id,
        email: registration.email,
        first_name: registration.first_name,
        last_name: registration.last_name,
        role: 'therapist',
        is_active: true,
        password: '' // Not used - auth handled by Supabase
      })
      .select()
      .single();

    if (adminUserError) {
      console.error('❌ Admin user creation failed:', adminUserError);

      // Rollback: Delete the auth user
      await supabase.auth.admin.deleteUser(authUser.user.id);

      throw new Error(`Failed to create admin user: ${adminUserError.message}`);
    }

    console.log(`✅ Admin user created: ${adminUser.id}`);

    // ===================================================
    // STEP 4: Create Therapist Profile
    // ===================================================

    const therapistProfileData = {
      auth_id: authUser.user.id,  // Links to auth.users(id) - for Supabase Auth login
      user_id: adminUser.id,  // Links to admin_users(id) - maintains system compatibility
      registration_id: registration.id,  // Link back to registration record
      first_name: registration.first_name,
      last_name: registration.last_name,
      email: registration.email,
      phone: registration.phone,

      // Combine address fields
      home_address: `${registration.street_address}, ${registration.suburb}, ${registration.city} ${registration.state} ${registration.postcode}`,

      // Profile
      profile_pic: registration.profile_photo_url,

      // Business details
      business_abn: registration.business_abn,
      bank_account_name: registration.bank_account_name,
      bsb: registration.bsb,
      bank_account_number: registration.bank_account_number,

      // Insurance
      insurance_expiry_date: registration.insurance_expiry_date,
      insurance_certificate_url: registration.insurance_certificate_url,
      first_aid_expiry_date: registration.first_aid_expiry_date,
      first_aid_certificate_url: registration.first_aid_certificate_url,
      qualification_certificate_url: registration.qualification_certificates?.[0]?.url,

      // Status
      is_active: false,  // Set to false - admin must manually activate therapist
      address_verified: false,

      // Ratings
      rating: 0,
      total_reviews: 0,

      // Additional metadata
      service_radius_km: 10 // Default 10km radius - therapist can expand later
    };

    console.log(`🏥 Creating therapist profile...`);

    const { data: therapistProfile, error: profileError } = await supabase
      .from('therapist_profiles')
      .insert(therapistProfileData)
      .select()
      .single();

    if (profileError) {
      console.error('❌ Therapist profile creation failed:', profileError);

      // Rollback: Delete admin user and auth user
      await supabase.from('admin_users').delete().eq('id', adminUser.id);
      await supabase.auth.admin.deleteUser(authUser.user.id);

      throw new Error(`Failed to create therapist profile: ${profileError.message}`);
    }

    console.log(`✅ Therapist profile created: ${therapistProfile.id}`);

    // ===================================================
    // STEP 5: Link Services (therapist_services table)
    // ===================================================

    if (registration.therapies_offered && registration.therapies_offered.length > 0) {
      console.log(`💆 Linking ${registration.therapies_offered.length} services...`);

      // Get service IDs from service names/codes
      const { data: services, error: servicesError } = await supabase
        .from('services')
        .select('id, name')
        .in('name', registration.therapies_offered);

      if (!servicesError && services && services.length > 0) {
        const therapistServices = services.map(service => ({
          therapist_id: therapistProfile.id,
          service_id: service.id
        }));

        const { error: linkError } = await supabase
          .from('therapist_services')
          .insert(therapistServices);

        if (linkError) {
          console.error('⚠️ Warning: Failed to link services:', linkError);
          // Don't fail the enrollment, just warn
        } else {
          console.log(`✅ Linked ${therapistServices.length} services`);
        }
      }
    }

    // ===================================================
    // STEP 5.5: Create Availability Slots
    // ===================================================

    const availSchedule = registration.availability_schedule;

    if (Array.isArray(availSchedule) && availSchedule.length > 0) {
      console.log(`Creating ${availSchedule.length} availability slots...`);

      const availabilityRows = availSchedule.map(slot => ({
        therapist_id: therapistProfile.id,
        day_of_week: slot.day_of_week,
        start_time: slot.start_time,
        end_time: slot.end_time,
      }));

      const { error: availError } = await supabase
        .from('therapist_availability')
        .insert(availabilityRows);

      if (availError) {
        console.error('Warning: Failed to create availability:', availError);
        // Don't fail enrollment, just warn (admin can set manually)
      } else {
        console.log(`Linked ${availabilityRows.length} availability slots`);
      }
    } else {
      console.log('No availability data to transfer (old format or empty)');
    }

    // ===================================================
    // STEP 6: Update Registration Status
    // ===================================================

    console.log(`📝 Updating registration status to enrolled...`);

    const { error: updateError } = await supabase
      .from('therapist_registrations')
      .update({
        status: 'enrolled',
        enrolled_at: new Date().toISOString(),
        therapist_profile_id: therapistProfile.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', registrationId);

    if (updateError) {
      console.error('⚠️ Warning: Failed to update registration status:', updateError);
      // Don't fail enrollment, but log the warning
    }

    // ===================================================
    // STEP 7: Send Welcome Email
    // ===================================================

    console.log(`📧 Sending welcome email to: ${registration.email}`);

    try {
      // TODO: Implement email sending via your email service
      // For now, just log that we would send an email

      const welcomeEmailData = {
        to: registration.email,
        subject: 'Welcome to Rejuvenators Mobile Massage - Your Account is Ready!',
        html: `
          <h2>Welcome ${registration.first_name}!</h2>
          <p>Your therapist account has been successfully created.</p>

          <h3>Login Credentials:</h3>
          <p><strong>Email:</strong> ${registration.email}<br>
          <strong>Temporary Password:</strong> ${tempPassword}</p>

          <p><strong>Important:</strong> Please change your password immediately after logging in.</p>

          <h3>Next Steps:</h3>
          <ol>
            <li>Download the Therapist App from the App Store or Google Play</li>
            <li>Log in with the credentials above</li>
            <li>Complete your profile setup</li>
            <li>Review your availability settings</li>
            <li>Start accepting bookings!</li>
          </ol>

          <p>If you have any questions, please contact us at support@rejuvenators.com</p>

          <p>Welcome to the team!</p>
        `
      };

      console.log(`📧 Email prepared (actual sending not implemented yet)`);
      console.log(`   To: ${welcomeEmailData.to}`);
      console.log(`   Subject: ${welcomeEmailData.subject}`);

      // TODO: Uncomment when email service is set up
      // await sendEmail(welcomeEmailData);

    } catch (emailError) {
      console.error('⚠️ Warning: Failed to send welcome email:', emailError);
      // Don't fail enrollment due to email issues
    }

    // ===================================================
    // SUCCESS
    // ===================================================

    console.log(`✅ Enrollment complete for ${registration.first_name} ${registration.last_name}`);
    console.log(`   Therapist Profile ID: ${therapistProfile.id}`);
    console.log(`   Auth User ID: ${authUser.user.id}`);

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: true,
        message: 'Therapist enrolled successfully',
        therapistProfileId: therapistProfile.id,
        authUserId: authUser.user.id,
        tempPassword: tempPassword // NOTE: Only for admin display, don't store this
      }),
    };

  } catch (error) {
    console.error('❌ Enrollment error:', error);

    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: error.message || 'Enrollment failed'
      }),
    };
  }
};
