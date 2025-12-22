const { createClient } = require('@supabase/supabase-js');

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
    const data = JSON.parse(event.body);
    const { step, registrationId, formData } = data;

    console.log(`📝 Registration ${step} for ID: ${registrationId || 'new'}`);

    // ===================================================
    // STEP-BY-STEP SAVE (DRAFT MODE)
    // ===================================================
    if (step && step !== 'submit') {
      // Save draft at each step
      const result = await saveDraft(registrationId, step, formData);

      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: true,
          registrationId: result.id,
          step,
          message: 'Progress saved'
        }),
      };
    }

    // ===================================================
    // FINAL SUBMISSION
    // ===================================================
    if (step === 'submit') {
      // Validate all required fields
      const validation = validateRegistration(formData);
      if (!validation.valid) {
        return {
          statusCode: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            success: false,
            errors: validation.errors
          }),
        };
      }

      // Submit registration
      const result = await submitRegistration(registrationId, formData);

      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: true,
          registrationId: result.id,
          message: 'Registration submitted successfully',
          email: formData.email
        }),
      };
    }

    // Invalid request
    return {
      statusCode: 400,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Invalid request' }),
    };

  } catch (error) {
    console.error('❌ Registration error:', error);

    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: error.message || 'Registration failed'
      }),
    };
  }
};

// ===================================================
// SAVE DRAFT FUNCTION
// ===================================================
async function saveDraft(registrationId, step, formData) {
  const updateData = {
    status: 'draft',
    updated_at: new Date().toISOString()
  };

  // Map form fields based on step
  switch(step) {
    case 'step1': // Personal Information
      updateData.first_name = formData.firstName;
      updateData.last_name = formData.lastName;
      updateData.date_of_birth = formData.dateOfBirth;
      updateData.email = formData.email;
      updateData.phone = formData.phone;
      updateData.street_address = formData.streetAddress;
      updateData.suburb = formData.suburb;
      updateData.city = formData.city;
      updateData.state = formData.state;
      updateData.postcode = formData.postcode;
      updateData.profile_photo_url = formData.profilePhotoUrl;
      break;

    case 'step2': // Business Details
      updateData.business_structure = formData.businessStructure;
      updateData.business_name = formData.businessName;
      updateData.company_name = formData.companyName;
      updateData.company_acn = formData.companyAcn;
      updateData.business_abn = formData.businessAbn;
      updateData.gst_registered = formData.gstRegistered;
      updateData.bank_account_name = formData.bankAccountName;
      updateData.bsb = formData.bsb;
      updateData.bank_account_number = formData.bankAccountNumber;
      break;

    case 'step3': // Service Locations & Availability
      updateData.service_cities = formData.serviceCities;
      updateData.delivery_locations = formData.deliveryLocations;
      updateData.availability_schedule = formData.availabilitySchedule;
      updateData.start_date = formData.startDate;
      break;

    case 'step4': // Qualifications & Services
      updateData.therapies_offered = formData.therapiesOffered;
      updateData.qualification_certificates = formData.qualificationCertificates;
      break;

    case 'step5': // Insurance & Compliance
      updateData.has_insurance = formData.hasInsurance;
      updateData.insurance_expiry_date = formData.insuranceExpiryDate;
      updateData.insurance_certificate_url = formData.insuranceCertificateUrl;
      updateData.has_first_aid = formData.hasFirstAid;
      updateData.first_aid_expiry_date = formData.firstAidExpiryDate;
      updateData.first_aid_certificate_url = formData.firstAidCertificateUrl;
      updateData.work_eligibility_confirmed = formData.workEligibilityConfirmed;
      break;

    case 'step6': // Agreement & Signature
      updateData.agreement_read_confirmed = formData.agreementReadConfirmed;
      updateData.legal_advice_confirmed = formData.legalAdviceConfirmed;
      updateData.contractor_relationship_confirmed = formData.contractorRelationshipConfirmed;
      updateData.information_accurate_confirmed = formData.informationAccurateConfirmed;
      updateData.terms_accepted_confirmed = formData.termsAcceptedConfirmed;
      updateData.signature_data = formData.signatureData;
      updateData.signed_date = formData.signedDate;
      updateData.full_legal_name = formData.fullLegalName;
      break;
  }

  // Update existing or insert new
  if (registrationId) {
    const { data, error } = await supabase
      .from('therapist_registrations')
      .update(updateData)
      .eq('id', registrationId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase
      .from('therapist_registrations')
      .insert(updateData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

// ===================================================
// SUBMIT REGISTRATION FUNCTION
// ===================================================
async function submitRegistration(registrationId, formData) {
  const submitData = {
    status: 'submitted',
    submitted_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('therapist_registrations')
    .update(submitData)
    .eq('id', registrationId)
    .select()
    .single();

  if (error) throw error;

  // TODO: Send email notification to admin
  // TODO: Send confirmation email to applicant

  return data;
}

// ===================================================
// VALIDATION FUNCTION
// ===================================================
function validateRegistration(formData) {
  const errors = [];

  // Step 1: Personal Information
  if (!formData.firstName) errors.push('First name is required');
  if (!formData.lastName) errors.push('Last name is required');
  if (!formData.dateOfBirth) errors.push('Date of birth is required');
  if (!formData.email) errors.push('Email is required');
  if (!formData.phone) errors.push('Phone is required');
  if (!formData.streetAddress) errors.push('Street address is required');
  if (!formData.suburb) errors.push('Suburb is required');
  if (!formData.city) errors.push('City is required');
  if (!formData.state) errors.push('State is required');
  if (!formData.postcode) errors.push('Postcode is required');

  // Step 2: Business Details
  if (!formData.businessStructure) errors.push('Business structure is required');
  if (!formData.businessAbn) errors.push('ABN is required');
  if (!formData.bankAccountName) errors.push('Bank account name is required');
  if (!formData.bsb) errors.push('BSB is required');
  if (!formData.bankAccountNumber) errors.push('Bank account number is required');

  // Step 3: Service Locations & Availability
  if (!formData.serviceCities || formData.serviceCities.length === 0) {
    errors.push('At least one service city is required');
  }
  if (!formData.deliveryLocations || formData.deliveryLocations.length === 0) {
    errors.push('At least one delivery location is required');
  }

  // Step 4: Qualifications & Services
  if (!formData.therapiesOffered || formData.therapiesOffered.length === 0) {
    errors.push('At least one therapy must be selected');
  }
  if (!formData.qualificationCertificates || formData.qualificationCertificates.length === 0) {
    errors.push('At least one qualification certificate is required');
  }

  // Step 5: Insurance & Compliance
  if (!formData.hasInsurance) errors.push('Insurance is required');
  if (!formData.insuranceCertificateUrl) errors.push('Insurance certificate is required');
  if (!formData.hasFirstAid) errors.push('First aid certification is required');
  if (!formData.firstAidCertificateUrl) errors.push('First aid certificate is required');
  if (!formData.workEligibilityConfirmed) errors.push('Work eligibility confirmation is required');

  // Step 6: Agreement & Signature
  if (!formData.agreementReadConfirmed) errors.push('Agreement must be read');
  if (!formData.legalAdviceConfirmed) errors.push('Legal advice acknowledgment required');
  if (!formData.contractorRelationshipConfirmed) errors.push('Contractor relationship acknowledgment required');
  if (!formData.informationAccurateConfirmed) errors.push('Information accuracy confirmation required');
  if (!formData.termsAcceptedConfirmed) errors.push('Terms acceptance required');
  if (!formData.signatureData) errors.push('Signature is required');

  return {
    valid: errors.length === 0,
    errors
  };
}
