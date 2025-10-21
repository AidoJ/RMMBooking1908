// ===== CLIENT INTAKE FORM JAVASCRIPT =====

// Initialize Supabase
const SUPABASE_URL = 'https://hjrizhzogronmwqonmyt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhqcml6aHpvZ3Jvbm13cW9ubXl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA4NTc2NTgsImV4cCI6MjA0NjQzMzY1OH0.nWB7wg1Cc0Mu2UoHWyE5T-EFmFPJSujUvQXq6Hy5-_w';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Global variables
let bookingId = null;
let canvas = null;
let ctx = null;
let isDrawing = false;
let hasSignature = false;

// State for Yes/No fields
const formState = {
  pregnancy: false,
  medicalSupervision: false,
  brokenSkin: false,
  jointReplacement: false
};

// ===== INITIALIZATION =====

document.addEventListener('DOMContentLoaded', () => {
  // Get booking ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  bookingId = urlParams.get('booking');

  if (!bookingId) {
    showError('No booking ID provided. Please use the link from your confirmation email.');
    return;
  }

  // Initialize signature canvas
  initializeSignatureCanvas();

  // Setup Yes/No buttons
  setupYesNoButtons();

  // Load booking data and check if form already exists
  loadBookingData();

  // Setup form submission
  document.getElementById('intakeForm').addEventListener('submit', handleSubmit);
});

// ===== BOOKING DATA =====

async function loadBookingData() {
  try {
    // Check if form already submitted for this booking
    const { data: existingForm, error: formError } = await supabase
      .from('client_intake_forms')
      .select('*')
      .eq('booking_id', bookingId)
      .maybeSingle();

    if (formError && formError.code !== 'PGRST116') {
      throw formError;
    }

    if (existingForm && existingForm.completed_at) {
      showError('This intake form has already been completed. If you need to make changes, please contact us.');
      return;
    }

    // Fetch booking details
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (bookingError) {
      throw bookingError;
    }

    if (!booking) {
      showError('Booking not found. Please check your link and try again.');
      return;
    }

    // Display booking info
    document.getElementById('displayBookingId').textContent = booking.booking_id || bookingId;

    // If form exists but not completed, load the existing data
    if (existingForm) {
      loadExistingFormData(existingForm);
    }

    // Show form
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('formContent').style.display = 'block';

  } catch (error) {
    console.error('Error loading booking data:', error);
    showError('Failed to load booking information. Please try again later.');
  }
}

function loadExistingFormData(formData) {
  // Load text fields
  if (formData.medications) document.getElementById('medications').value = formData.medications;
  if (formData.allergies) document.getElementById('allergies').value = formData.allergies;

  // Load pregnancy data
  if (formData.is_pregnant) {
    setYesNoButton('pregnancy', 'yes');
    if (formData.pregnancy_months) document.getElementById('pregnancyMonths').value = formData.pregnancy_months;
    if (formData.pregnancy_due_date) document.getElementById('pregnancyDueDate').value = formData.pregnancy_due_date;
  }

  // Load medical supervision
  if (formData.has_medical_supervision) {
    setYesNoButton('medicalSupervision', 'yes');
    if (formData.medical_supervision_details) {
      document.getElementById('medicalSupervisionText').value = formData.medical_supervision_details;
    }
  }

  // Load medical conditions
  if (formData.medical_conditions && Array.isArray(formData.medical_conditions)) {
    formData.medical_conditions.forEach(condition => {
      const checkbox = document.querySelector(`input[name="medicalConditions"][value="${condition}"]`);
      if (checkbox) checkbox.checked = true;
    });
  }

  // Load broken skin
  if (formData.has_broken_skin) {
    setYesNoButton('brokenSkin', 'yes');
    if (formData.broken_skin_location) {
      document.getElementById('brokenSkinLocation').value = formData.broken_skin_location;
    }
  }

  // Load joint replacement
  if (formData.has_joint_replacement) {
    setYesNoButton('jointReplacement', 'yes');
    if (formData.joint_replacement_details) {
      document.getElementById('jointReplacementText').value = formData.joint_replacement_details;
    }
  }

  // Load other fields
  if (formData.recent_injuries) document.getElementById('recentInjuries').value = formData.recent_injuries;
  if (formData.other_conditions) document.getElementById('otherConditions').value = formData.other_conditions;
}

// ===== YES/NO BUTTONS =====

function setupYesNoButtons() {
  const buttons = document.querySelectorAll('.yes-no-btn');

  buttons.forEach(button => {
    button.addEventListener('click', function() {
      const field = this.dataset.field;
      const value = this.dataset.value;

      // Update button states
      const fieldButtons = document.querySelectorAll(`[data-field="${field}"]`);
      fieldButtons.forEach(btn => btn.classList.remove('active'));
      this.classList.add('active');

      // Update form state
      formState[field] = (value === 'yes');

      // Show/hide conditional sections
      toggleConditionalSection(field, value === 'yes');
    });
  });
}

function setYesNoButton(field, value) {
  const button = document.querySelector(`[data-field="${field}"][data-value="${value}"]`);
  if (button) {
    button.click();
  }
}

function toggleConditionalSection(field, show) {
  const sectionMap = {
    pregnancy: 'pregnancyDetails',
    medicalSupervision: 'medicalSupervisionDetails',
    brokenSkin: 'brokenSkinDetails',
    jointReplacement: 'jointReplacementDetails'
  };

  const sectionId = sectionMap[field];
  if (sectionId) {
    const section = document.getElementById(sectionId);
    section.style.display = show ? 'block' : 'none';

    // Clear fields if hiding
    if (!show) {
      const inputs = section.querySelectorAll('input, textarea');
      inputs.forEach(input => input.value = '');
    }
  }
}

// ===== SIGNATURE CANVAS =====

function initializeSignatureCanvas() {
  canvas = document.getElementById('signatureCanvas');
  ctx = canvas.getContext('2d');

  // Set canvas size
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Setup drawing
  canvas.addEventListener('mousedown', startDrawing);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDrawing);
  canvas.addEventListener('mouseout', stopDrawing);

  // Touch events for mobile
  canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
  canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
  canvas.addEventListener('touchend', stopDrawing);

  // Clear button
  document.getElementById('clearSignature').addEventListener('click', clearSignature);

  // Configure drawing style
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;

  // Reset drawing style after resize
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

function startDrawing(e) {
  isDrawing = true;
  hasSignature = true;
  const rect = canvas.getBoundingClientRect();
  ctx.beginPath();
  ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
}

function draw(e) {
  if (!isDrawing) return;
  const rect = canvas.getBoundingClientRect();
  ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
  ctx.stroke();
}

function stopDrawing() {
  isDrawing = false;
}

function handleTouchStart(e) {
  e.preventDefault();
  const touch = e.touches[0];
  const rect = canvas.getBoundingClientRect();
  isDrawing = true;
  hasSignature = true;
  ctx.beginPath();
  ctx.moveTo(touch.clientX - rect.left, touch.clientY - rect.top);
}

function handleTouchMove(e) {
  if (!isDrawing) return;
  e.preventDefault();
  const touch = e.touches[0];
  const rect = canvas.getBoundingClientRect();
  ctx.lineTo(touch.clientX - rect.left, touch.clientY - rect.top);
  ctx.stroke();
}

function clearSignature() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  hasSignature = false;
}

function getSignatureData() {
  if (!hasSignature) return null;
  return canvas.toDataURL('image/png');
}

// ===== FORM VALIDATION =====

function validateForm() {
  const errors = [];

  // Check required text fields
  const medications = document.getElementById('medications').value.trim();
  const allergies = document.getElementById('allergies').value.trim();
  const recentInjuries = document.getElementById('recentInjuries').value.trim();
  const otherConditions = document.getElementById('otherConditions').value.trim();

  if (!medications) errors.push('Please answer the medications question');
  if (!allergies) errors.push('Please answer the allergies question');
  if (!recentInjuries) errors.push('Please answer the recent injuries question');
  if (!otherConditions) errors.push('Please answer the other conditions question');

  // Check conditional fields
  if (formState.pregnancy) {
    const months = document.getElementById('pregnancyMonths').value;
    if (!months) errors.push('Please specify pregnancy months');
  }

  if (formState.medicalSupervision) {
    const details = document.getElementById('medicalSupervisionText').value.trim();
    if (!details) errors.push('Please describe your medical supervision');
  }

  if (formState.brokenSkin) {
    const location = document.getElementById('brokenSkinLocation').value.trim();
    if (!location) errors.push('Please specify the location of broken skin');
  }

  if (formState.jointReplacement) {
    const joints = document.getElementById('jointReplacementText').value.trim();
    if (!joints) errors.push('Please specify which joints were replaced');
  }

  // Check signature
  if (!hasSignature) {
    errors.push('Please provide your signature');
  }

  return errors;
}

// ===== FORM SUBMISSION =====

async function handleSubmit(e) {
  e.preventDefault();

  // Validate
  const errors = validateForm();
  if (errors.length > 0) {
    alert('Please complete all required fields:\n\n' + errors.join('\n'));
    return;
  }

  // Disable submit button
  const submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting...';

  try {
    // Collect medical conditions
    const medicalConditions = Array.from(
      document.querySelectorAll('input[name="medicalConditions"]:checked')
    ).map(cb => cb.value);

    // Prepare form data
    const formData = {
      booking_id: bookingId,
      medications: document.getElementById('medications').value.trim(),
      allergies: document.getElementById('allergies').value.trim(),
      is_pregnant: formState.pregnancy,
      pregnancy_months: formState.pregnancy ? parseInt(document.getElementById('pregnancyMonths').value) || null : null,
      pregnancy_due_date: formState.pregnancy ? document.getElementById('pregnancyDueDate').value || null : null,
      has_medical_supervision: formState.medicalSupervision,
      medical_supervision_details: formState.medicalSupervision ? document.getElementById('medicalSupervisionText').value.trim() : null,
      medical_conditions: medicalConditions,
      has_broken_skin: formState.brokenSkin,
      broken_skin_location: formState.brokenSkin ? document.getElementById('brokenSkinLocation').value.trim() : null,
      has_joint_replacement: formState.jointReplacement,
      joint_replacement_details: formState.jointReplacement ? document.getElementById('jointReplacementText').value.trim() : null,
      recent_injuries: document.getElementById('recentInjuries').value.trim(),
      other_conditions: document.getElementById('otherConditions').value.trim(),
      signature_data: getSignatureData(),
      completed_at: new Date().toISOString()
    };

    // Insert or update form
    const { data, error } = await supabase
      .from('client_intake_forms')
      .upsert(formData, {
        onConflict: 'booking_id'
      })
      .select();

    if (error) {
      throw error;
    }

    console.log('Form submitted successfully:', data);

    // Show success message
    document.getElementById('formContent').style.display = 'none';
    document.getElementById('successMessage').style.display = 'block';

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

  } catch (error) {
    console.error('Error submitting form:', error);
    alert('There was an error submitting your form. Please try again or contact us for assistance.');

    // Re-enable submit button
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Health Intake Form';
  }
}

// ===== UTILITY FUNCTIONS =====

function showError(message) {
  document.getElementById('loadingState').style.display = 'none';
  document.getElementById('errorState').style.display = 'block';
  document.getElementById('errorMessage').textContent = message;
}
