// =====================================================
// THERAPIST REGISTRATION FORM - JavaScript
// =====================================================

// Configuration
const NETLIFY_FUNCTION_URL = '/.netlify/functions/therapist-registration-submit';
const UPLOAD_FUNCTION_URL = '/.netlify/functions/therapist-registration-upload';
const AGREEMENT_FUNCTION_URL = '/.netlify/functions/therapist-registration-agreement';

// State
let currentStep = 1;
let registrationId = null;
let formData = {};
let signaturePad = null;
let autoSaveTimeout = null;

// =====================================================
// INITIALIZATION
// =====================================================

document.addEventListener('DOMContentLoaded', () => {
  initializeForm();
  initializeSignaturePad();
  loadActiveAgreement();
  setupEventListeners();
  setupBusinessStructureToggle();
  setupInsuranceToggle();
  setupFirstAidToggle();
  setupFileUploads();
  restoreDraftIfExists();
});

// =====================================================
// FORM INITIALIZATION
// =====================================================

function initializeForm() {
  // Set today's date for signed date
  document.getElementById('signedDate').value = new Date().toISOString().split('T')[0];

  // Update progress line
  updateProgressLine();
}

// =====================================================
// EVENT LISTENERS
// =====================================================

function setupEventListeners() {
  // Navigation buttons
  document.getElementById('nextBtn').addEventListener('click', nextStep);
  document.getElementById('prevBtn').addEventListener('click', prevStep);
  document.getElementById('submitBtn').addEventListener('click', submitForm);

  // Form inputs - trigger auto-save
  document.querySelectorAll('input, select, textarea').forEach(input => {
    input.addEventListener('change', () => {
      scheduleAutoSave();
    });
  });

  // "Not Available" checkboxes logic
  document.querySelectorAll('input[type="checkbox"][value="not-available"]').forEach(checkbox => {
    checkbox.addEventListener('change', function() {
      const day = this.name;
      const row = this.closest('tr');
      const otherCheckboxes = row.querySelectorAll('input[type="checkbox"]:not([value="not-available"])');

      if (this.checked) {
        otherCheckboxes.forEach(cb => {
          cb.checked = false;
          cb.disabled = true;
        });
      } else {
        otherCheckboxes.forEach(cb => {
          cb.disabled = false;
        });
      }
    });
  });
}

// =====================================================
// BUSINESS STRUCTURE TOGGLE
// =====================================================

function setupBusinessStructureToggle() {
  const soleTradertRadio = document.getElementById('soleTrader');
  const ptyLtdRadio = document.getElementById('ptyLtd');

  soleTradertRadio.addEventListener('change', function() {
    if (this.checked) {
      document.getElementById('businessNameGroup').style.display = 'block';
      document.getElementById('companyNameGroup').style.display = 'none';
      document.getElementById('companyAcnGroup').style.display = 'none';

      // Remove required from company fields
      document.getElementById('companyName').removeAttribute('required');
      document.getElementById('companyAcn').removeAttribute('required');
    }
  });

  ptyLtdRadio.addEventListener('change', function() {
    if (this.checked) {
      document.getElementById('businessNameGroup').style.display = 'none';
      document.getElementById('companyNameGroup').style.display = 'block';
      document.getElementById('companyAcnGroup').style.display = 'block';

      // Add required to company fields
      document.getElementById('companyName').setAttribute('required', 'required');
      document.getElementById('companyAcn').setAttribute('required', 'required');
    }
  });
}

// =====================================================
// INSURANCE & FIRST AID TOGGLES
// =====================================================

function setupInsuranceToggle() {
  const insuranceYes = document.getElementById('insuranceYes');
  const insuranceNo = document.getElementById('insuranceNo');

  insuranceYes.addEventListener('change', function() {
    if (this.checked) {
      document.getElementById('insuranceFields').style.display = 'block';
      document.getElementById('insuranceExpiryDate').setAttribute('required', 'required');
    }
  });

  insuranceNo.addEventListener('change', function() {
    if (this.checked) {
      document.getElementById('insuranceFields').style.display = 'none';
      document.getElementById('insuranceExpiryDate').removeAttribute('required');
    }
  });
}

function setupFirstAidToggle() {
  const firstAidYes = document.getElementById('firstAidYes');
  const firstAidNo = document.getElementById('firstAidNo');

  firstAidYes.addEventListener('change', function() {
    if (this.checked) {
      document.getElementById('firstAidFields').style.display = 'block';
      document.getElementById('firstAidExpiryDate').setAttribute('required', 'required');
    }
  });

  firstAidNo.addEventListener('change', function() {
    if (this.checked) {
      document.getElementById('firstAidFields').style.display = 'none';
      document.getElementById('firstAidExpiryDate').removeAttribute('required');
    }
  });
}

// =====================================================
// FILE UPLOAD HANDLERS
// =====================================================

function setupFileUploads() {
  // Profile Photo
  setupFileUpload('profilePhotoUpload', 'profilePhoto', 'profilePhotoPreview', false);

  // Qualifications (multiple)
  setupFileUpload('qualificationsUpload', 'qualifications', 'qualificationsPreview', true);

  // Insurance Certificate
  setupFileUpload('insuranceCertUpload', 'insuranceCert', 'insuranceCertPreview', false);

  // First Aid Certificate
  setupFileUpload('firstAidCertUpload', 'firstAidCert', 'firstAidCertPreview', false);
}

function setupFileUpload(uploadDivId, inputId, previewId, multiple) {
  const uploadDiv = document.getElementById(uploadDivId);
  const input = document.getElementById(inputId);
  const preview = document.getElementById(previewId);

  // Click to upload
  uploadDiv.addEventListener('click', () => input.click());

  // File selection
  input.addEventListener('change', function() {
    if (this.files.length > 0) {
      const fileNames = Array.from(this.files).map(f => f.name).join(', ');
      preview.querySelector('.file-preview-name').textContent = fileNames;
      preview.classList.add('visible');

      // Upload to Supabase Storage
      uploadFiles(this.files, inputId);
    }
  });

  // Drag and drop
  uploadDiv.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadDiv.style.borderColor = '#667eea';
    uploadDiv.style.background = '#f0f2ff';
  });

  uploadDiv.addEventListener('dragleave', (e) => {
    e.preventDefault();
    uploadDiv.style.borderColor = '#ddd';
    uploadDiv.style.background = '#f8f9fa';
  });

  uploadDiv.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadDiv.style.borderColor = '#ddd';
    uploadDiv.style.background = '#f8f9fa';

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      input.files = files;
      const fileNames = Array.from(files).map(f => f.name).join(', ');
      preview.querySelector('.file-preview-name').textContent = fileNames;
      preview.classList.add('visible');

      // Upload to Supabase Storage
      uploadFiles(files, inputId);
    }
  });
}

// =====================================================
// FILE UPLOAD VIA NETLIFY FUNCTION
// =====================================================

async function uploadFiles(files, fieldName) {
  const uploadedUrls = [];

  for (let file of files) {
    try {
      // Create FormData for file upload
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);
      formDataUpload.append('fieldName', fieldName);

      const response = await fetch(UPLOAD_FUNCTION_URL, {
        method: 'POST',
        body: formDataUpload
      });

      const result = await response.json();

      if (result.success) {
        uploadedUrls.push({
          url: result.url,
          filename: file.name
        });
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      showAlert('Error uploading file: ' + file.name, 'error');
      continue;
    }
  }

  // Store URLs in form data
  if (fieldName === 'qualifications') {
    formData.qualificationCertificates = uploadedUrls;
  } else if (fieldName === 'profilePhoto') {
    formData.profilePhotoUrl = uploadedUrls[0]?.url;
  } else if (fieldName === 'insuranceCert') {
    formData.insuranceCertificateUrl = uploadedUrls[0]?.url;
  } else if (fieldName === 'firstAidCert') {
    formData.firstAidCertificateUrl = uploadedUrls[0]?.url;
  }

  scheduleAutoSave();
}

// =====================================================
// SIGNATURE PAD
// =====================================================

function initializeSignaturePad() {
  const canvas = document.getElementById('signaturePad');
  const ctx = canvas.getContext('2d');

  let isDrawing = false;
  let lastX = 0;
  let lastY = 0;

  canvas.addEventListener('mousedown', (e) => {
    isDrawing = true;
    [lastX, lastY] = [e.offsetX, e.offsetY];
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!isDrawing) return;
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(e.offsetX, e.offsetY);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
    [lastX, lastY] = [e.offsetX, e.offsetY];
  });

  canvas.addEventListener('mouseup', () => {
    isDrawing = false;
    formData.signatureData = canvas.toDataURL();
    scheduleAutoSave();
  });

  canvas.addEventListener('mouseleave', () => {
    isDrawing = false;
  });

  // Touch events for mobile
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    isDrawing = true;
    lastX = touch.clientX - rect.left;
    lastY = touch.clientY - rect.top;
  });

  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!isDrawing) return;
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();

    lastX = x;
    lastY = y;
  });

  canvas.addEventListener('touchend', () => {
    isDrawing = false;
    formData.signatureData = canvas.toDataURL();
    scheduleAutoSave();
  });

  // Clear button
  document.getElementById('clearSignature').addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    formData.signatureData = null;
  });
}

// =====================================================
// LOAD ACTIVE AGREEMENT VIA NETLIFY FUNCTION
// =====================================================

async function loadActiveAgreement() {
  try {
    const response = await fetch(AGREEMENT_FUNCTION_URL);
    const result = await response.json();

    if (result.success && result.agreement) {
      const agreement = result.agreement;
      displayAgreement(agreement);

      // Store agreement reference
      formData.agreementTemplateId = agreement.id;
      formData.agreementVersion = agreement.version;
      formData.agreementPdfUrl = agreement.content_pdf_url;
    } else {
      throw new Error(result.error || 'No active agreement found');
    }
  } catch (error) {
    console.error('Error loading agreement:', error);
    showAlert('Error loading agreement template', 'error');
  }
}

function displayAgreement(agreement) {
  const container = document.getElementById('agreementContainer');

  const html = `
    <div class="agreement-box">
      <div class="agreement-header">
        📋 ${agreement.title} (${agreement.version})
      </div>
      <div class="agreement-content">
        ${agreement.content_html}
      </div>
      <div class="agreement-actions">
        <a href="${agreement.content_pdf_url}" target="_blank" download>
          📥 Download Full PDF Agreement
        </a>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

// =====================================================
// NAVIGATION
// =====================================================

function nextStep() {
  // Validate current step
  if (!validateStep(currentStep)) {
    return;
  }

  // Collect data from current step
  collectStepData(currentStep);

  // Save draft
  saveDraft();

  // Move to next step
  if (currentStep < 6) {
    currentStep++;
    showStep(currentStep);
  }
}

function prevStep() {
  if (currentStep > 1) {
    currentStep--;
    showStep(currentStep);
  }
}

function showStep(step) {
  // Hide all steps
  document.querySelectorAll('.step-content').forEach(content => {
    content.classList.remove('active');
  });

  // Show current step
  document.querySelector(`.step-content[data-step="${step}"]`).classList.add('active');

  // Update progress indicator
  document.querySelectorAll('.step').forEach((stepEl, index) => {
    const stepNum = index + 1;
    if (stepNum < step) {
      stepEl.classList.add('completed');
      stepEl.classList.remove('active');
    } else if (stepNum === step) {
      stepEl.classList.add('active');
      stepEl.classList.remove('completed');
    } else {
      stepEl.classList.remove('active', 'completed');
    }
  });

  updateProgressLine();

  // Update navigation buttons
  document.getElementById('prevBtn').style.display = step === 1 ? 'none' : 'block';
  document.getElementById('nextBtn').style.display = step === 6 ? 'none' : 'block';
  document.getElementById('submitBtn').style.display = step === 6 ? 'block' : 'none';

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateProgressLine() {
  const progressLine = document.getElementById('progressLine');
  const percentage = ((currentStep - 1) / 5) * 100;
  progressLine.style.width = percentage + '%';
}

// =====================================================
// VALIDATION
// =====================================================

function validateStep(step) {
  const stepContent = document.querySelector(`.step-content[data-step="${step}"]`);
  const requiredFields = stepContent.querySelectorAll('[required]');

  for (let field of requiredFields) {
    if (!field.value && field.type !== 'checkbox' && field.type !== 'radio') {
      showAlert('Please fill in all required fields', 'error');
      field.focus();
      return false;
    }

    if (field.type === 'checkbox' && field.hasAttribute('required') && !field.checked) {
      // Check if it's part of a group
      const name = field.name;
      const group = document.querySelectorAll(`[name="${name}"]`);

      if (group.length > 1) {
        // Checkbox group - at least one must be checked
        const anyChecked = Array.from(group).some(cb => cb.checked);
        if (!anyChecked) {
          showAlert('Please select at least one option for: ' + field.closest('.form-group').querySelector('label').textContent, 'error');
          return false;
        }
      } else {
        // Single checkbox - must be checked
        showAlert('Please check: ' + field.closest('.checkbox-item').querySelector('label').textContent, 'error');
        return false;
      }
    }

    if (field.type === 'radio') {
      const name = field.name;
      const group = document.querySelectorAll(`[name="${name}"]`);
      const anyChecked = Array.from(group).some(rb => rb.checked);

      if (!anyChecked) {
        showAlert('Please select an option for: ' + field.closest('.form-group').querySelector('label').textContent, 'error');
        return false;
      }
    }
  }

  // Step-specific validation
  if (step === 3) {
    // Check availability
    const hasAvailability = checkAvailabilitySelected();
    if (!hasAvailability) {
      showAlert('Please select your availability for at least one day', 'error');
      return false;
    }
  }

  if (step === 6) {
    // Check signature
    if (!formData.signatureData) {
      showAlert('Please provide your signature', 'error');
      return false;
    }
  }

  return true;
}

function checkAvailabilitySelected() {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  for (let day of days) {
    const checkboxes = document.querySelectorAll(`input[name="${day}"]:checked`);
    if (checkboxes.length > 0) {
      return true;
    }
  }

  return false;
}

// =====================================================
// DATA COLLECTION
// =====================================================

function collectStepData(step) {
  switch (step) {
    case 1: // Personal Information
      formData.firstName = document.getElementById('firstName').value;
      formData.lastName = document.getElementById('lastName').value;
      formData.dateOfBirth = document.getElementById('dateOfBirth').value;
      formData.email = document.getElementById('email').value;
      formData.phone = document.getElementById('phone').value;
      formData.streetAddress = document.getElementById('streetAddress').value;
      formData.suburb = document.getElementById('suburb').value;
      formData.city = document.getElementById('city').value;
      formData.state = document.getElementById('state').value;
      formData.postcode = document.getElementById('postcode').value;
      break;

    case 2: // Business Details
      formData.businessStructure = document.querySelector('input[name="businessStructure"]:checked').value;
      formData.businessName = document.getElementById('businessName').value;
      formData.companyName = document.getElementById('companyName').value;
      formData.companyAcn = document.getElementById('companyAcn').value;
      formData.businessAbn = document.getElementById('businessAbn').value;
      formData.gstRegistered = document.querySelector('input[name="gstRegistered"]:checked').value === 'true';
      formData.bankAccountName = document.getElementById('bankAccountName').value;
      formData.bsb = document.getElementById('bsb').value;
      formData.bankAccountNumber = document.getElementById('bankAccountNumber').value;
      break;

    case 3: // Service & Availability
      formData.serviceCities = Array.from(document.querySelectorAll('input[name="serviceCities"]:checked'))
        .map(cb => cb.value);
      formData.deliveryLocations = Array.from(document.querySelectorAll('input[name="deliveryLocations"]:checked'))
        .map(cb => cb.value);
      formData.availabilitySchedule = collectAvailability();
      formData.startDate = document.getElementById('startDate').value;
      break;

    case 4: // Qualifications
      formData.therapiesOffered = Array.from(document.querySelectorAll('input[name="therapiesOffered"]:checked'))
        .map(cb => cb.value);
      // qualificationCertificates already set during upload
      break;

    case 5: // Insurance
      formData.hasInsurance = document.querySelector('input[name="hasInsurance"]:checked').value === 'true';
      formData.insuranceExpiryDate = document.getElementById('insuranceExpiryDate').value;
      // insuranceCertificateUrl already set during upload
      formData.hasFirstAid = document.querySelector('input[name="hasFirstAid"]:checked').value === 'true';
      formData.firstAidExpiryDate = document.getElementById('firstAidExpiryDate').value;
      // firstAidCertificateUrl already set during upload
      formData.workEligibilityConfirmed = document.getElementById('workEligibility').checked;
      break;

    case 6: // Agreement
      formData.agreementReadConfirmed = document.getElementById('agreementRead').checked;
      formData.legalAdviceConfirmed = document.getElementById('legalAdvice').checked;
      formData.contractorRelationshipConfirmed = document.getElementById('contractorRelationship').checked;
      formData.informationAccurateConfirmed = document.getElementById('infoAccurate').checked;
      formData.termsAcceptedConfirmed = document.getElementById('termsAccepted').checked;
      // signatureData already set during drawing
      formData.signedDate = document.getElementById('signedDate').value;
      formData.fullLegalName = document.getElementById('fullLegalName').value;
      break;
  }
}

function collectAvailability() {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const schedule = {};

  days.forEach(day => {
    const checked = Array.from(document.querySelectorAll(`input[name="${day}"]:checked`))
      .map(cb => cb.value)
      .filter(val => val !== 'not-available');

    if (checked.length > 0) {
      schedule[day] = checked;
    }
  });

  return schedule;
}

// =====================================================
// AUTO-SAVE DRAFT
// =====================================================

function scheduleAutoSave() {
  // Clear existing timeout
  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout);
  }

  // Set new timeout (save after 2 seconds of inactivity)
  autoSaveTimeout = setTimeout(() => {
    collectStepData(currentStep);
    saveDraft();
  }, 2000);
}

async function saveDraft() {
  try {
    showAutoSaveIndicator(true);

    const response = await fetch(NETLIFY_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        step: `step${currentStep}`,
        registrationId: registrationId,
        formData: formData
      })
    });

    const result = await response.json();

    if (result.success) {
      if (!registrationId) {
        registrationId = result.registrationId;
        localStorage.setItem('therapistRegistrationId', registrationId);
      }

      showAutoSaveIndicator(false, true);
    } else {
      console.error('Save failed:', result);
      showAutoSaveIndicator(false, false);
    }
  } catch (error) {
    console.error('Error saving draft:', error);
    showAutoSaveIndicator(false, false);
  }
}

function showAutoSaveIndicator(saving, success = false) {
  const indicator = document.getElementById('autoSaveIndicator');
  const icon = document.getElementById('saveIcon');
  const text = document.getElementById('saveText');

  if (saving) {
    indicator.classList.add('visible');
    icon.className = 'save-icon';
    text.textContent = 'Saving...';
  } else if (success) {
    icon.className = 'save-icon saved';
    icon.textContent = '✓';
    text.textContent = 'Saved';

    setTimeout(() => {
      indicator.classList.remove('visible');
    }, 2000);
  } else {
    indicator.classList.remove('visible');
  }
}

// =====================================================
// RESTORE DRAFT
// =====================================================

function restoreDraftIfExists() {
  const savedId = localStorage.getItem('therapistRegistrationId');

  if (savedId) {
    if (confirm('We found a saved registration draft. Would you like to continue where you left off?')) {
      registrationId = savedId;
      // TODO: Load saved data from backend
      showAlert('Draft restored. Please review and continue.', 'info');
    } else {
      localStorage.removeItem('therapistRegistrationId');
    }
  }
}

// =====================================================
// SUBMIT FORM
// =====================================================

async function submitForm(e) {
  e.preventDefault();

  // Final validation
  if (!validateStep(6)) {
    return;
  }

  // Collect final step data
  collectStepData(6);

  // Confirm submission
  if (!confirm('Are you sure you want to submit your registration? Please ensure all information is accurate.')) {
    return;
  }

  try {
    // Show loading
    document.getElementById('loadingIndicator').classList.add('visible');
    document.getElementById('registrationForm').style.display = 'none';

    const response = await fetch(NETLIFY_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        step: 'submit',
        registrationId: registrationId,
        formData: formData
      })
    });

    const result = await response.json();

    if (result.success) {
      // Clear saved draft
      localStorage.removeItem('therapistRegistrationId');

      // Show success message
      showSuccessPage(result);
    } else {
      throw new Error(result.error || 'Submission failed');
    }
  } catch (error) {
    console.error('Submission error:', error);
    document.getElementById('loadingIndicator').classList.remove('visible');
    document.getElementById('registrationForm').style.display = 'block';
    showAlert('Error submitting registration: ' + error.message, 'error');
  }
}

function showSuccessPage(result) {
  const formContent = document.querySelector('.form-content');

  formContent.innerHTML = `
    <div style="text-align: center; padding: 60px 20px;">
      <div style="font-size: 80px; margin-bottom: 20px;">✅</div>
      <h2 style="color: #4caf50; margin-bottom: 15px;">Registration Submitted Successfully!</h2>
      <p style="color: #666; font-size: 16px; margin-bottom: 30px;">
        Thank you for your registration. We have received your application and will review it shortly.
      </p>
      <div style="background: #f8f9fa; padding: 30px; border-radius: 8px; margin-bottom: 30px;">
        <h3 style="margin-bottom: 15px;">What Happens Next?</h3>
        <ol style="text-align: left; max-width: 500px; margin: 0 auto; line-height: 1.8;">
          <li>Our team will review your application</li>
          <li>We'll contact you to schedule interviews if suitable</li>
          <li>Upon approval, you'll receive enrollment instructions</li>
          <li>You'll get access to the Therapist App and training materials</li>
        </ol>
      </div>
      <p style="color: #666;">
        A confirmation email has been sent to <strong>${result.email}</strong>
      </p>
      <a href="/" style="display: inline-block; margin-top: 30px; padding: 14px 32px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">
        Return to Home
      </a>
    </div>
  `;
}

// =====================================================
// ALERT MESSAGES
// =====================================================

function showAlert(message, type) {
  const alert = document.getElementById('alertMessage');
  alert.className = `alert alert-${type} visible`;
  alert.textContent = message;

  // Auto-hide after 5 seconds
  setTimeout(() => {
    alert.classList.remove('visible');
  }, 5000);

  // Scroll to top to show alert
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
