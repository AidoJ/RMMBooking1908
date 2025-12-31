const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ===================================================
// HELPER: SANITIZE DATA
// ===================================================
// Convert empty strings to null, especially important for dates
function sanitizeValue(value) {
  if (value === '' || value === undefined) {
    return null;
  }
  return value;
}

// Sanitize all string and date fields in an object
function sanitizeData(data) {
  const sanitized = {};
  for (const [key, value] of Object.entries(data)) {
    sanitized[key] = sanitizeValue(value);
  }
  return sanitized;
}

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
    // GET PDF URL (for download after submission)
    // ===================================================
    if (step === 'get-pdf-url') {
      if (!registrationId) {
        throw new Error('Registration ID required');
      }

      const { data: reg, error } = await supabase
        .from('therapist_registrations')
        .select('signed_agreement_pdf_url')
        .eq('id', registrationId)
        .single();

      if (error) throw error;

      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: true,
          pdfUrl: reg.signed_agreement_pdf_url
        }),
      };
    }

    // ===================================================
    // STEP-BY-STEP SAVE (DRAFT MODE)
    // ===================================================
    if (step && step !== 'submit' && step !== 'get-pdf-url') {
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
          email: formData.email,
          pdfUrl: result.signed_agreement_pdf_url
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

  // Map form fields based on step - SANITIZE ALL VALUES
  switch(step) {
    case 'step1': // Personal Information
      Object.assign(updateData, sanitizeData({
        first_name: formData.firstName,
        last_name: formData.lastName,
        date_of_birth: formData.dateOfBirth,
        email: formData.email,
        phone: formData.phone,
        street_address: formData.streetAddress,
        suburb: formData.suburb,
        city: formData.city,
        state: formData.state,
        postcode: formData.postcode,
        profile_photo_url: formData.profilePhotoUrl
      }));
      break;

    case 'step2': // Business Details
      Object.assign(updateData, sanitizeData({
        business_structure: formData.businessStructure,
        business_name: formData.businessName,
        company_name: formData.companyName,
        company_acn: formData.companyAcn,
        business_abn: formData.businessAbn,
        gst_registered: formData.gstRegistered,
        bank_account_name: formData.bankAccountName,
        bsb: formData.bsb,
        bank_account_number: formData.bankAccountNumber
      }));
      break;

    case 'step3': // Service Locations & Availability
      Object.assign(updateData, {
        service_cities: formData.serviceCities || [],
        delivery_locations: formData.deliveryLocations || [],
        availability_schedule: formData.availabilitySchedule || {},
        start_date: sanitizeValue(formData.startDate)
      });
      break;

    case 'step4': // Qualifications & Services
      Object.assign(updateData, {
        therapies_offered: formData.therapiesOffered || [],
        qualification_certificates: formData.qualificationCertificates || [],
        other_services: sanitizeValue(formData.otherServices)
      });
      break;

    case 'step5': // Insurance & Compliance
      Object.assign(updateData, {
        has_insurance: formData.hasInsurance || false,
        insurance_expiry_date: sanitizeValue(formData.insuranceExpiryDate),
        insurance_certificate_url: sanitizeValue(formData.insuranceCertificateUrl),
        has_first_aid: formData.hasFirstAid || false,
        first_aid_expiry_date: sanitizeValue(formData.firstAidExpiryDate),
        first_aid_certificate_url: sanitizeValue(formData.firstAidCertificateUrl),
        work_eligibility_confirmed: formData.workEligibilityConfirmed || false
      });
      break;

    case 'step6': // Agreement & Signature
      Object.assign(updateData, {
        agreement_read_confirmed: formData.agreementReadConfirmed || false,
        legal_advice_confirmed: formData.legalAdviceConfirmed || false,
        contractor_relationship_confirmed: formData.contractorRelationshipConfirmed || false,
        information_accurate_confirmed: formData.informationAccurateConfirmed || false,
        terms_accepted_confirmed: formData.termsAcceptedConfirmed || false,
        signature_data: sanitizeValue(formData.signatureData),
        signed_date: sanitizeValue(formData.signedDate),
        full_legal_name: sanitizeValue(formData.fullLegalName)
      });
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

  // Generate signed agreement PDF - WAIT for it to complete
  console.log(`📄 Generating signed agreement PDF...`);
  try {
    // Call the generate-signed-agreement function directly
    const generatePdf = require('./generate-signed-agreement');
    const pdfEvent = {
      httpMethod: 'POST',
      body: JSON.stringify({ registrationId })
    };

    const pdfResult = await generatePdf.handler(pdfEvent, {});
    console.log(`📄 PDF Result Status: ${pdfResult.statusCode}`);
    console.log(`📄 PDF Result Body: ${pdfResult.body}`);

    const pdfResponse = JSON.parse(pdfResult.body);

    if (pdfResponse.success && pdfResponse.pdfUrl) {
      console.log(`✅ Signed agreement PDF generated: ${pdfResponse.pdfUrl}`);
      // Update the data object with PDF URL
      data.signed_agreement_pdf_url = pdfResponse.pdfUrl;
    } else {
      console.error(`⚠️ PDF generation failed:`, pdfResponse.error || 'No PDF URL returned');
      console.error(`⚠️ Full response:`, JSON.stringify(pdfResponse));
      // Don't fail the submission if PDF fails - can regenerate later
    }
  } catch (pdfError) {
    console.error(`⚠️ Error generating PDF:`, pdfError.message);
    console.error(`⚠️ Stack:`, pdfError.stack);
    // Don't fail the submission
  }

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
  // Qualification certificates are optional - can be uploaded later

  // Step 5: Insurance & Compliance
  // Only require certificate if they answered YES to having it
  if (formData.hasInsurance === true && !formData.insuranceCertificateUrl) {
    errors.push('Please upload your insurance certificate or select "No"');
  }
  if (formData.hasFirstAid === true && !formData.firstAidCertificateUrl) {
    errors.push('Please upload your first aid certificate or select "No"');
  }
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
