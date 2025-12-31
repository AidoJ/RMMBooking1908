// Registration Form JavaScript
// ===========================================

// State
let currentStep = 1;
let registrationId = null;
let formData = {
    qualificationCertificates: [],
    profilePhotoUrl: null,
    insuranceCertificateUrl: null,
    firstAidCertificateUrl: null,
    signatureData: null
};
let autoSaveTimeout = null;

// Signature canvas context
let signaturePad = null;
let isDrawing = false;
let lastX = 0;
let lastY = 0;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeForm();
    setupEventListeners();
    setupBusinessStructureToggle();
    setupInsuranceToggle();
    setupFirstAidToggle();
    setupFileUploads();
    setupSignaturePad();
    loadServices();
    loadAgreement();
    restoreDraft();
});

// ===================================================
// INITIALIZATION
// ===================================================

function initializeForm() {
    // Set today's date for signed date
    document.getElementById('signedDate').value = new Date().toISOString().split('T')[0];
    updateProgressLine();
}

function setupEventListeners() {
    // Navigation
    document.getElementById('nextBtn').addEventListener('click', nextStep);
    document.getElementById('prevBtn').addEventListener('click', prevStep);
    document.getElementById('submitBtn').addEventListener('click', submitForm);

    // Auto-save on input
    document.querySelectorAll('input, select, textarea').forEach(input => {
        input.addEventListener('change', scheduleAutoSave);
        input.addEventListener('input', scheduleAutoSave);
    });

    // "Not Available" checkbox logic
    document.querySelectorAll('input[value="not-available"]').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
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

// ===================================================
// BUSINESS STRUCTURE TOGGLE
// ===================================================

function setupBusinessStructureToggle() {
    const radios = document.querySelectorAll('input[name="businessStructure"]');

    radios.forEach(radio => {
        radio.addEventListener('change', function() {
            const businessNameGroup = document.getElementById('businessNameGroup');
            const companyFields = document.getElementById('companyFields');
            const companyName = document.getElementById('companyName');
            const companyAcn = document.getElementById('companyAcn');

            if (this.value === 'sole_trader') {
                businessNameGroup.style.display = 'block';
                companyFields.style.display = 'none';
                companyName.removeAttribute('required');
                companyAcn.removeAttribute('required');
            } else {
                businessNameGroup.style.display = 'none';
                companyFields.style.display = 'block';
                companyName.setAttribute('required', 'required');
                companyAcn.setAttribute('required', 'required');
            }
        });
    });
}

// ===================================================
// INSURANCE & FIRST AID TOGGLES
// ===================================================

function setupInsuranceToggle() {
    const radios = document.querySelectorAll('input[name="hasInsurance"]');

    radios.forEach(radio => {
        radio.addEventListener('change', function() {
            const fields = document.getElementById('insuranceFields');
            const expiryDate = document.getElementById('insuranceExpiryDate');

            if (this.value === 'true') {
                fields.style.display = 'block';
                expiryDate.setAttribute('required', 'required');
            } else {
                fields.style.display = 'none';
                expiryDate.removeAttribute('required');
            }
        });
    });
}

function setupFirstAidToggle() {
    const radios = document.querySelectorAll('input[name="hasFirstAid"]');

    radios.forEach(radio => {
        radio.addEventListener('change', function() {
            const fields = document.getElementById('firstAidFields');
            const expiryDate = document.getElementById('firstAidExpiryDate');

            if (this.value === 'true') {
                fields.style.display = 'block';
                expiryDate.setAttribute('required', 'required');
            } else {
                fields.style.display = 'none';
                expiryDate.removeAttribute('required');
            }
        });
    });
}

// ===================================================
// LOAD SERVICES FROM DATABASE
// ===================================================

async function loadServices() {
    try {
        const response = await fetch(`${window.location.origin}/.netlify/functions/get-system-settings?key=active_services`);

        if (!response.ok) {
            throw new Error('Failed to load services');
        }

        const data = await response.json();
        const servicesListDiv = document.getElementById('therapiesOfferedList');

        // Fallback: If the API doesn't work, fetch directly from Supabase
        let services = [];

        // Try to get services from Supabase directly
        const supabaseUrl = 'https://dzclnjkjlmsivikojygv.supabase.co';
        const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6Y2xuamtqbG1zaXZpa29qeWd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjcyMzc3MTYsImV4cCI6MjA0MjgxMzcxNn0.Y5wbJ1CmCD4TDT-6RWzvEoHWnqmxwmFvJNNaT46DUZk';

        const servicesResponse = await fetch(`${supabaseUrl}/rest/v1/services?is_active=eq.true&select=id,name&order=sort_order,name`, {
            headers: {
                'apikey': supabaseAnonKey,
                'Authorization': `Bearer ${supabaseAnonKey}`
            }
        });

        if (servicesResponse.ok) {
            services = await servicesResponse.json();
        }

        // Clear loading message
        servicesListDiv.innerHTML = '';

        if (services.length === 0) {
            servicesListDiv.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 20px; color: #999;">No services available at this time.</div>';
            return;
        }

        // Create checkbox for each service
        services.forEach(service => {
            const label = document.createElement('label');
            label.className = 'checkbox-label';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.name = 'therapiesOffered';
            checkbox.value = service.name;

            const span = document.createElement('span');
            span.textContent = service.name;

            label.appendChild(checkbox);
            label.appendChild(span);
            servicesListDiv.appendChild(label);

            // Add change listener for auto-save
            checkbox.addEventListener('change', scheduleAutoSave);
        });

        console.log(`✅ Loaded ${services.length} services`);

    } catch (error) {
        console.error('Error loading services:', error);
        const servicesListDiv = document.getElementById('therapiesOfferedList');
        servicesListDiv.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 20px; color: #ff4d4f;">Failed to load services. Please refresh the page.</div>';
    }
}

// ===================================================
// FILE UPLOAD SETUP
// ===================================================

function setupFileUploads() {
    setupFileUpload('profilePhotoUpload', 'profilePhoto', 'profilePhotoPreview', false);
    setupFileUpload('qualificationsUpload', 'qualifications', 'qualificationsPreview', true);
    setupFileUpload('insuranceCertUpload', 'insuranceCert', 'insuranceCertPreview', false);
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
            handleFileUpload(this.files, inputId, preview);
        }
    });

    // Drag and drop
    uploadDiv.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadDiv.style.background = '#e8f4f5';
    });

    uploadDiv.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadDiv.style.background = '#f5f7fa';
    });

    uploadDiv.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadDiv.style.background = '#f5f7fa';

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            input.files = files;
            handleFileUpload(files, inputId, preview);
        }
    });
}

async function handleFileUpload(files, fieldName, previewElement) {
    previewElement.innerHTML = '';
    previewElement.style.display = 'none';

    const uploadedUrls = [];

    for (let file of files) {
        try {
            showAutoSave(true, 'Uploading ' + file.name + '...');

            const formData = new FormData();
            formData.append('file', file);
            formData.append('fieldName', fieldName);

            const response = await fetch('/.netlify/functions/therapist-registration-upload', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                uploadedUrls.push({
                    url: result.url,
                    filename: file.name
                });

                // Show preview
                const fileItem = document.createElement('div');
                fileItem.className = 'file-preview-item';
                fileItem.innerHTML = `
                    <span class="file-icon">📄</span>
                    <span class="file-name">${file.name}</span>
                    <span class="file-remove" data-filename="${file.name}">×</span>
                `;
                previewElement.appendChild(fileItem);
                previewElement.style.display = 'block';

                // Add remove handler
                fileItem.querySelector('.file-remove').addEventListener('click', (e) => {
                    e.stopPropagation();
                    fileItem.remove();
                    if (previewElement.children.length === 0) {
                        previewElement.style.display = 'none';
                    }
                });
            } else {
                throw new Error(result.error || 'Upload failed');
            }
        } catch (error) {
            console.error('Upload error:', error);
            showAlert('Error uploading ' + file.name + ': ' + error.message, 'error');
        }
    }

    // Store URLs in formData
    if (fieldName === 'qualifications') {
        formData.qualificationCertificates = uploadedUrls;
    } else if (fieldName === 'profilePhoto') {
        formData.profilePhotoUrl = uploadedUrls[0]?.url;
    } else if (fieldName === 'insuranceCert') {
        formData.insuranceCertificateUrl = uploadedUrls[0]?.url;
    } else if (fieldName === 'firstAidCert') {
        formData.firstAidCertificateUrl = uploadedUrls[0]?.url;
    }

    showAutoSave(false);
    scheduleAutoSave();
}

// ===================================================
// SIGNATURE PAD
// ===================================================

function setupSignaturePad() {
    const canvas = document.getElementById('signaturePad');
    const ctx = canvas.getContext('2d');

    // Mouse events
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', stopDrawing);

    // Touch events
    canvas.addEventListener('touchstart', handleTouchStart);
    canvas.addEventListener('touchmove', handleTouchMove);
    canvas.addEventListener('touchend', stopDrawing);

    function startDrawing(e) {
        isDrawing = true;
        [lastX, lastY] = [e.offsetX, e.offsetY];
    }

    function draw(e) {
        if (!isDrawing) return;

        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(e.offsetX, e.offsetY);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.stroke();

        [lastX, lastY] = [e.offsetX, e.offsetY];
    }

    function stopDrawing() {
        if (isDrawing) {
            isDrawing = false;
            formData.signatureData = canvas.toDataURL();
            scheduleAutoSave();
        }
    }

    function handleTouchStart(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        isDrawing = true;
        lastX = touch.clientX - rect.left;
        lastY = touch.clientY - rect.top;
    }

    function handleTouchMove(e) {
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
    }

    // Clear button
    document.getElementById('clearSignature').addEventListener('click', () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        formData.signatureData = null;
    });
}

// ===================================================
// LOAD AGREEMENT
// ===================================================

async function loadAgreement() {
    try {
        const response = await fetch('/.netlify/functions/therapist-registration-agreement');
        const result = await response.json();

        if (result.success && result.agreement) {
            const agreement = result.agreement;

            // Display FULL agreement HTML
            document.getElementById('agreementContent').innerHTML = agreement.content_html;

            // Set PDF download link
            if (agreement.content_pdf_url) {
                const downloadLink = document.getElementById('downloadPdf');
                downloadLink.href = agreement.content_pdf_url;
                downloadLink.style.display = 'inline-block';
            }

            // Store agreement reference
            formData.agreementTemplateId = agreement.id;
            formData.agreementVersion = agreement.version;
            formData.agreementPdfUrl = agreement.content_pdf_url;
        } else {
            throw new Error(result.error || 'No agreement found');
        }
    } catch (error) {
        console.error('Error loading agreement:', error);
        document.getElementById('agreementContent').innerHTML =
            '<p style="text-align: center; padding: 40px; color: #e74c3c;">Error loading agreement. Please refresh the page.</p>';
    }
}

// ===================================================
// NAVIGATION
// ===================================================

function nextStep() {
    if (!validateStep(currentStep)) {
        return;
    }

    collectStepData(currentStep);
    saveDraft();

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
    const progressLine = document.getElementById('progressFill');
    const percentage = ((currentStep - 1) / 5) * 100;
    progressLine.style.width = percentage + '%';
}

// ===================================================
// VALIDATION
// ===================================================

function validateStep(step) {
    const stepContent = document.querySelector(`.step-content[data-step="${step}"]`);
    const requiredFields = stepContent.querySelectorAll('[required]');

    for (let field of requiredFields) {
        if (field.type === 'checkbox' && !field.checked) {
            // Check if it's part of a group
            const name = field.name;
            const group = document.querySelectorAll(`[name="${name}"]`);

            if (group.length > 1) {
                const anyChecked = Array.from(group).some(cb => cb.checked);
                if (!anyChecked) {
                    showAlert('Please select at least one option for: ' + field.closest('.form-group').querySelector('label').textContent, 'error');
                    field.focus();
                    return false;
                }
            } else {
                showAlert('This field is required: ' + field.closest('.checkbox-label').textContent, 'error');
                field.focus();
                return false;
            }
        } else if (field.type === 'radio') {
            const name = field.name;
            const group = document.querySelectorAll(`[name="${name}"]`);
            const anyChecked = Array.from(group).some(rb => rb.checked);

            if (!anyChecked) {
                showAlert('Please select an option for: ' + field.closest('.form-group').querySelector('label').textContent, 'error');
                return false;
            }
        } else if (!field.value) {
            showAlert('Please fill in: ' + field.closest('.form-group').querySelector('label').textContent, 'error');
            field.focus();
            return false;
        }
    }

    // Step-specific validation
    if (step === 3) {
        if (!checkAvailabilitySelected()) {
            showAlert('Please select your availability for at least one day', 'error');
            return false;
        }
    }

    if (step === 6) {
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

// ===================================================
// DATA COLLECTION
// ===================================================

// Helper function to safely get value from element
function safeGetValue(selector, isId = true) {
    const element = isId ? document.getElementById(selector) : document.querySelector(selector);
    return element ? element.value : '';
}

// Helper function to safely get checked radio value
function safeGetRadio(name) {
    const element = document.querySelector(`input[name="${name}"]:checked`);
    return element ? element.value : '';
}

// Helper function to safely get checkbox state
function safeGetCheckbox(id) {
    const element = document.getElementById(id);
    return element ? element.checked : false;
}

function collectStepData(step) {
    switch (step) {
        case 1:
            formData.firstName = safeGetValue('firstName');
            formData.lastName = safeGetValue('lastName');
            formData.dateOfBirth = safeGetValue('dateOfBirth');
            formData.email = safeGetValue('email');
            formData.phone = safeGetValue('phone');
            formData.streetAddress = safeGetValue('streetAddress');
            formData.suburb = safeGetValue('suburb');
            formData.city = safeGetValue('city');
            formData.state = safeGetValue('state');
            formData.postcode = safeGetValue('postcode');
            break;

        case 2:
            formData.businessStructure = safeGetRadio('businessStructure');
            formData.businessName = safeGetValue('businessName');
            formData.companyName = safeGetValue('companyName');
            formData.companyAcn = safeGetValue('companyAcn');
            formData.businessAbn = safeGetValue('businessAbn');
            formData.gstRegistered = safeGetRadio('gstRegistered') === 'true';
            formData.bankAccountName = safeGetValue('bankAccountName');
            formData.bsb = safeGetValue('bsb');
            formData.bankAccountNumber = safeGetValue('bankAccountNumber');
            break;

        case 3:
            formData.serviceCities = Array.from(document.querySelectorAll('input[name="serviceCities"]:checked'))
                .map(cb => cb.value);
            formData.deliveryLocations = Array.from(document.querySelectorAll('input[name="deliveryLocations"]:checked'))
                .map(cb => cb.value);
            formData.availabilitySchedule = collectAvailability();
            formData.startDate = safeGetValue('startDate');
            break;

        case 4:
            formData.therapiesOffered = Array.from(document.querySelectorAll('input[name="therapiesOffered"]:checked'))
                .map(cb => cb.value);
            formData.otherServices = safeGetValue('otherServices');
            break;

        case 5:
            formData.hasInsurance = safeGetRadio('hasInsurance') === 'true';
            formData.insuranceExpiryDate = safeGetValue('insuranceExpiryDate');
            formData.hasFirstAid = safeGetRadio('hasFirstAid') === 'true';
            formData.firstAidExpiryDate = safeGetValue('firstAidExpiryDate');
            formData.workEligibilityConfirmed = safeGetCheckbox('workEligibility');
            break;

        case 6:
            formData.agreementReadConfirmed = safeGetCheckbox('agreementRead');
            formData.legalAdviceConfirmed = safeGetCheckbox('legalAdvice');
            formData.contractorRelationshipConfirmed = safeGetCheckbox('contractorRelationship');
            formData.informationAccurateConfirmed = safeGetCheckbox('infoAccurate');
            formData.termsAcceptedConfirmed = safeGetCheckbox('termsAccepted');
            formData.signedDate = safeGetValue('signedDate');
            formData.fullLegalName = safeGetValue('fullLegalName');
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

// ===================================================
// AUTO-SAVE
// ===================================================

function scheduleAutoSave() {
    if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout);
    }

    autoSaveTimeout = setTimeout(() => {
        collectStepData(currentStep);
        saveDraft();
    }, 2000);
}

async function saveDraft() {
    try {
        showAutoSave(true, 'Saving...');

        const response = await fetch('/.netlify/functions/therapist-registration-submit', {
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
            showAutoSave(false);
        } else {
            console.error('Save failed:', result);
        }
    } catch (error) {
        console.error('Error saving draft:', error);
    }
}

function restoreDraft() {
    const savedId = localStorage.getItem('therapistRegistrationId');

    if (savedId && confirm('We found a saved registration draft. Would you like to continue where you left off?')) {
        registrationId = savedId;
        showAlert('Draft restored. Please review and continue.', 'info');
    } else {
        localStorage.removeItem('therapistRegistrationId');
    }
}

// ===================================================
// SUBMIT FORM
// ===================================================

async function submitForm(e) {
    e.preventDefault();

    if (!validateStep(6)) {
        return;
    }

    collectStepData(6);

    if (!confirm('Are you sure you want to submit your registration? Please ensure all information is accurate.')) {
        return;
    }

    try {
        document.getElementById('loadingOverlay').style.display = 'flex';

        console.log('=== FORM SUBMISSION DEBUG ===');
        console.log('Registration ID:', registrationId);
        console.log('Form Data:', JSON.stringify(formData, null, 2));

        const response = await fetch('/.netlify/functions/therapist-registration-submit', {
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

        console.log('Response status:', response.status);
        console.log('Response ok:', response.ok);

        let result;
        try {
            const text = await response.text();
            console.log('Response text:', text);
            result = JSON.parse(text);
        } catch (parseError) {
            console.error('Failed to parse response:', parseError);
            throw new Error('Invalid response from server');
        }

        console.log('Parsed result:', result);

        if (result.success) {
            localStorage.removeItem('therapistRegistrationId');
            showSuccessPage(result.pdfUrl);
        } else {
            // Log full error details
            console.error('=== VALIDATION FAILED ===');
            console.error('Errors:', result.errors);
            console.error('Error message:', result.error);

            if (result.errors && Array.isArray(result.errors)) {
                alert('Please fix the following errors:\n\n' + result.errors.join('\n'));
                throw new Error('Validation errors: ' + result.errors.join(', '));
            } else {
                throw new Error(result.error || 'Submission failed');
            }
        }
    } catch (error) {
        console.error('=== SUBMISSION ERROR ===');
        console.error('Error:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        document.getElementById('loadingOverlay').style.display = 'none';
        showAlert('Error submitting registration: ' + error.message, 'error');
    }
}

let signedAgreementPdfUrl = null;

function showSuccessPage(pdfUrl) {
    signedAgreementPdfUrl = pdfUrl;
    document.querySelector('.form-card').innerHTML = `
        <div style="text-align: center; padding: 60px 20px;">
            <div style="font-size: 80px; margin-bottom: 20px;">✅</div>
            <h2 style="color: #007e8c; margin-bottom: 15px; font-size: 32px;">Registration Submitted Successfully!</h2>
            <p style="color: #666; font-size: 18px; margin-bottom: 30px; max-width: 600px; margin-left: auto; margin-right: auto;">
                Thank you for your registration. We have received your application and will review it shortly.
            </p>

            <div style="background: #e8f4f5; border: 2px solid #007e8c; padding: 30px; border-radius: 12px; margin-bottom: 30px; max-width: 600px; margin-left: auto; margin-right: auto;">
                <h3 style="margin-bottom: 20px; color: #007e8c;">📄 Your Signed Agreement</h3>
                <p style="color: #2c3e50; margin-bottom: 25px;">
                    Your signed Independent Contractor Agreement is ready. Please download a copy for your records.
                </p>
                <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
                    <button id="downloadPdfBtn" onclick="downloadSignedAgreement()" style="display: inline-flex; align-items: center; gap: 10px; padding: 14px 28px; background: #007e8c; color: white; border: none; border-radius: 8px; font-weight: 600; font-size: 16px; cursor: pointer; transition: all 0.3s;">
                        📥 Download PDF
                    </button>
                    <button id="emailPdfBtn" onclick="emailSignedAgreement()" style="display: inline-flex; align-items: center; gap: 10px; padding: 14px 28px; background: white; color: #007e8c; border: 2px solid #007e8c; border-radius: 8px; font-weight: 600; font-size: 16px; cursor: pointer; transition: all 0.3s;">
                        📧 Email Me a Copy
                    </button>
                </div>
                <p id="pdfStatus" style="margin-top: 15px; font-size: 14px; color: #666;"></p>
            </div>

            <div style="background: #f5f7fa; padding: 40px; border-radius: 12px; margin-bottom: 30px; max-width: 600px; margin-left: auto; margin-right: auto;">
                <h3 style="margin-bottom: 20px; color: #007e8c;">What Happens Next?</h3>
                <ol style="text-align: left; line-height: 2; color: #2c3e50;">
                    <li><strong>Review Period:</strong> Our team will review your application within 5-7 business days</li>
                    <li><strong>Interview:</strong> If approved, we'll contact you to schedule interviews</li>
                    <li><strong>Onboarding:</strong> Upon final approval, you'll receive enrollment instructions and app access</li>
                    <li><strong>Training:</strong> Access to training materials and therapist resources</li>
                </ol>
            </div>
            <p style="color: #666; margin-bottom: 30px;">
                Questions? Contact us at <strong>recruitment@rejuvenators.com</strong>
            </p>
            <a href="/" style="display: inline-block; padding: 14px 32px; background: #007e8c; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; transition: all 0.3s;">
                Return to Home
            </a>
        </div>
    `;

    document.getElementById('loadingOverlay').style.display = 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ===================================================
// SIGNED AGREEMENT DOWNLOAD & EMAIL
// ===================================================
async function downloadSignedAgreement() {
    const btn = document.getElementById('downloadPdfBtn');
    const status = document.getElementById('pdfStatus');

    try {
        if (!signedAgreementPdfUrl) {
            throw new Error('PDF not available. Please refresh and try again.');
        }

        btn.disabled = true;
        btn.innerHTML = '⏳ Preparing download...';
        status.textContent = 'Please wait...';
        status.style.color = '#666';

        // Trigger download
        const link = document.createElement('a');
        link.href = signedAgreementPdfUrl;
        link.download = `Rejuvenators-Agreement-${formData.lastName}-${registrationId.substring(0, 8)}.pdf`;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        status.textContent = '✅ Download started! Check your downloads folder.';
        status.style.color = '#27ae60';
        btn.innerHTML = '📥 Download PDF';
    } catch (error) {
        console.error('Download error:', error);
        status.textContent = '❌ ' + error.message;
        status.style.color = '#e74c3c';
        btn.innerHTML = '📥 Download PDF';
    } finally {
        btn.disabled = false;
    }
}

async function emailSignedAgreement() {
    const btn = document.getElementById('emailPdfBtn');
    const status = document.getElementById('pdfStatus');

    try {
        btn.disabled = true;
        btn.innerHTML = '⏳ Sending email...';
        status.textContent = 'Please wait...';
        status.style.color = '#666';

        const response = await fetch(`/.netlify/functions/email-signed-agreement`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ registrationId: registrationId })
        });

        const result = await response.json();

        if (result.success) {
            status.textContent = `✅ Email sent to ${formData.email}! Check your inbox.`;
            status.style.color = '#27ae60';
            btn.innerHTML = '✓ Email Sent';
        } else {
            throw new Error(result.error || 'Failed to send email');
        }
    } catch (error) {
        console.error('Email error:', error);
        status.textContent = '❌ ' + error.message;
        status.style.color = '#e74c3c';
        btn.innerHTML = '📧 Email Me a Copy';
        btn.disabled = false;
    }
}

// ===================================================
// UI HELPERS
// ===================================================

function showAlert(message, type) {
    const alert = document.getElementById('alertMessage');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    alert.style.display = 'block';

    setTimeout(() => {
        alert.style.display = 'none';
    }, 5000);

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showAutoSave(saving, text = 'Saving...') {
    const indicator = document.getElementById('autoSaveIndicator');
    const saveText = document.getElementById('saveText');

    if (saving) {
        indicator.style.display = 'block';
        saveText.textContent = text;
    } else {
        saveText.textContent = '✓ Saved';
        setTimeout(() => {
            indicator.style.display = 'none';
        }, 2000);
    }
}
