// Remove ES module import for supabase. Use window.supabase instead.

// Step navigation logic for new booking form

// Admin mode detection from URL parameter
const urlParams = new URLSearchParams(window.location.search);
const isAdminMode = urlParams.get('admin') === 'true';
console.log('🔐 Admin mode:', isAdminMode);

// Store admin mode globally
window.isAdminMode = isAdminMode;

// Add this function at the very top-level scope so it is accessible everywhere
async function calculateTherapistFee(dateVal, timeVal, durationVal, therapistId) {
  if (!dateVal || !timeVal || !durationVal || !therapistId) {
    console.warn('calculateTherapistFee: Missing required parameters');
    return null;
  }

  try {
    // Fetch therapist-specific rates from database
    const { data: therapist, error } = await window.supabase
      .from('therapist_profiles')
      .select('hourly_rate, afterhours_rate, first_name, last_name')
      .eq('id', therapistId)
      .single();

    if (error || !therapist) {
      console.error('Failed to fetch therapist rates:', error);
      return null;
    }

    if (!therapist.hourly_rate || therapist.hourly_rate <= 0 || !therapist.afterhours_rate || therapist.afterhours_rate <= 0) {
      console.error(`Invalid rates for therapist ${therapist.first_name} ${therapist.last_name}`);
      return null;
    }

    const dayOfWeek = new Date(dateVal).getDay();
    const hour = parseInt(timeVal.split(':')[0], 10);

    // Determine if afterhours/weekend
    let isAfterhours = false;
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      isAfterhours = true;
    } else {
      if (window.businessOpeningHour !== undefined && window.businessClosingHour !== undefined) {
        if (hour < window.businessOpeningHour || hour >= window.businessClosingHour) {
          isAfterhours = true;
        }
      }
    }

    // Get appropriate hourly rate from THERAPIST PROFILE
    const hourlyRate = isAfterhours ? therapist.afterhours_rate : therapist.hourly_rate;
    if (!hourlyRate) return null;

    // Calculate base fee: hourly rate (this is the base fee, not multiplied by duration)
    let fee = hourlyRate;

    // Apply duration uplift percentage if available
    const duration = window.durationsCache.find(d => d.duration_minutes === Number(durationVal));
    if (duration && duration.uplift_percentage) {
      const durationUplift = hourlyRate * (Number(duration.uplift_percentage) / 100);
      fee += durationUplift;
    }

    return Math.round(fee * 100) / 100;
  } catch (error) {
    console.error('Error calculating therapist fee:', error);
    return null;
  }
}

// Initialize EmailJS when the script loads
(function() {
    // Wait for EmailJS to be available
    const initEmailJS = () => {
        if (typeof emailjs !== 'undefined') {
            emailjs.init(EMAILJS_PUBLIC_KEY);
            console.log('✅ EmailJS initialized successfully');
            return true;
        }
        return false;
    };
    
    // Try to initialize immediately
    if (!initEmailJS()) {
        // If not available, wait and try again
        setTimeout(initEmailJS, 1000);
    }
})();

// Email service functions are now defined in emailService.js
// This file uses window.EmailService from emailService.js

// Global showStep function - accessible from anywhere
function showStep(stepId) {
  console.log('🎯 showStep called with:', stepId, 'Stack trace:', new Error().stack);
  console.log('🎯 showStep function is working properly');
  const steps = Array.from(document.querySelectorAll('.step'));
  const progressSteps = Array.from(document.querySelectorAll('.progress-step'));

    steps.forEach(step => {
      step.classList.remove('active');
    });
    const current = document.getElementById(stepId);
    if (current) current.classList.add('active');
    
    // If returning to Step 1, check and restore address verification status
    if (stepId === 'step1') {
      const addressInput = document.getElementById('address');
      if (addressInput && addressInput.value.trim()) {
        if (isAddressVerified()) {
          updateAddressStatus('Great news, we have therapists available in your area. Choose your service next.', 'verified');
        } else {
          updateAddressStatus("Sorry... we don't have any therapists available in your area right now.", 'error');
        }
      }
    }

    // Update progress bar
    const idx = steps.findIndex(s => s.id === stepId);
    progressSteps.forEach((ps, i) => {
      if (i === idx) {
        ps.classList.add('active');
      } else {
        ps.classList.remove('active');
      }
    });

    // Update simple progress bar
    const totalSteps = steps.length;
    const progressPercent = (idx / (totalSteps - 1)) * 100;
    const progressFill = document.getElementById('progressFill');
    const progressIcon = document.getElementById('progressIcon');
    if (progressFill) progressFill.style.width = progressPercent + '%';
    if (progressIcon) progressIcon.style.left = progressPercent + '%';
  }

// Step 0: Booking Method Selection Functions
window.selectBookingMethod = function(method, element) {
  // Remove selected class from all options
  document.querySelectorAll('.booking-option').forEach(option => {
    option.classList.remove('selected');
  });
  
  // Add selected class to clicked option
  element.classList.add('selected');
  
  // Update description cards
  document.querySelectorAll('.description-card').forEach(card => {
    card.classList.remove('show');
  });
  
  const targetCard = document.querySelector(`.description-card.${method}`);
  if (targetCard) {
    targetCard.classList.add('show');
  }
  
  // Store booking method
  window.bookingMode = method;
  console.log('📋 Booking mode set to:', method);
};

window.proceedFromStep0 = function() {
  if (!window.bookingMode) {
    alert('Please select a booking method first.');
    return;
  }
  
  console.log('🚀 Proceeding from Step 0 with mode:', window.bookingMode);
  
  if (window.bookingMode === 'instant') {
    // Go to Step 1 (Address) for instant booking
    showStep('step1');
  } else if (window.bookingMode === 'quote') {
    // Go to Step 2 (Service Selection) for quote request
    console.log('🚀 Navigating to Step 2 for quote mode');
    showStep('step2');
    // Refresh services to apply quote-only filtering
    console.log('🔄 Refreshing services for quote mode');
    populateTherapyOptions();
  }
};

// Function to update address verification status
function updateAddressStatus(message, type = 'error') {
  const statusDiv = document.getElementById('address-autocomplete-status');
  if (statusDiv) {
    statusDiv.textContent = message;
    statusDiv.className = `address-status ${type}`;
    statusDiv.style.display = 'block'; // Ensure it's visible
    console.log('📍 Address status updated:', message, 'Type:', type);
  }
}

// Function to manually verify an address using geocoding
async function verifyAddressManually(address) {
  const addressInput = document.getElementById('address');
  const statusDiv = document.getElementById('address-autocomplete-status');
  
  if (!address.trim()) return;
  
  try {
    console.log('🔍 Attempting to geocode address manually:', address);
    
    // Show loading status
    updateAddressStatus('Checking therapist availability in your area...', 'loading');
    
    const geocoder = new google.maps.Geocoder();
    const result = await new Promise((resolve, reject) => {
      geocoder.geocode({ address: address }, (results, status) => {
        if (status === 'OK' && results[0]) {
          resolve(results[0]);
        } else {
          reject(new Error(`Geocoding failed: ${status}`));
        }
      });
    });
    
    if (result && result.geometry) {
      // Store coordinates
      addressInput.dataset.lat = result.geometry.location.lat();
      addressInput.dataset.lng = result.geometry.location.lng();
      addressInput.dataset.verified = 'true';
      
      console.log('✅ Address geocoded successfully:', {
        lat: addressInput.dataset.lat,
        lng: addressInput.dataset.lng,
        formatted: result.formatted_address
      });
      
      // Check therapist coverage (this will set the appropriate message)
      checkTherapistCoverageForAddress();
    }
  } catch (error) {
    console.log('❌ Manual geocoding failed:', error.message);
    addressInput.dataset.verified = 'false';
    updateAddressStatus("Sorry... we don't have any therapists available in your area right now.", 'error');
  }
}

// Function to check if address is verified
function isAddressVerified() {
  const addressInput = document.getElementById('address');
  const hasValue = addressInput.value.trim();
  const hasCoordinates = addressInput.dataset.lat && addressInput.dataset.lng;
  const isVerified = addressInput.dataset.verified === 'true';
  
  console.log('🔍 Address verification check:', {
    hasValue,
    hasCoordinates,
    isVerified,
    value: addressInput.value
  });
  
  return hasValue && (hasCoordinates || isVerified);
}

// Step 1 validation and continue function
window.validateAndContinueFromStep1 = function() {
  const addressInput = document.getElementById('address');
  
  if (!addressInput.value.trim()) {
    updateAddressStatus('Please enter and select an address.', 'error');
    return;
  }
  
  if (!isAddressVerified()) {
    updateAddressStatus('Please select an address from the dropdown or ensure it\'s properly verified.', 'error');
    return;
  }
  
  // Clear any error status and show verified
  updateAddressStatus('✅ Address verified', 'verified');
  
  console.log('🚀 Validating Step 1 - Address entered:', addressInput.value);
  
  if (window.bookingMode === 'instant') {
    console.log('🚀 Navigating to Step 2 for instant booking mode');
    showStep('step2');
    // Refresh services to apply instant booking filtering
    console.log('🔄 Refreshing services for instant booking mode');
    populateTherapyOptions();
  } else {
    // This shouldn't happen as quote mode goes directly to Step 2
    console.warn('⚠️ Unexpected booking mode in Step 1:', window.bookingMode);
    showStep('step2');
  }
};

// Step 2 validation and continue function
window.validateAndContinueFromStep2 = function() {
  const selectedService = document.querySelector('.service-card.selected');
  const selectedDuration = document.getElementById('duration').value;
  
  if (!selectedService) {
    alert('Please select a service first.');
    return;
  }
  
  // Only validate duration for instant booking mode
  if (window.bookingMode === 'instant' && !selectedDuration) {
    alert('Please select a duration.');
    return;
  }
  
  // Proceed to next step (Step 3: Gender)
  showStep('step3');
};

document.addEventListener('DOMContentLoaded', function () {
  console.log('🚀 DOMContentLoaded event fired');
  
  // Initialize booking mode as undefined - no method selected yet
  window.bookingMode = undefined;
  console.log('📋 Initial booking mode:', window.bookingMode);
  
  const steps = Array.from(document.querySelectorAll('.step'));
  const progressSteps = Array.from(document.querySelectorAll('.progress-step'));

  console.log('📋 Found steps:', steps.length);
  console.log('📋 Found progress steps:', progressSteps.length);

  // Initialize with Step 0 active
  console.log('🎯 About to call showStep("step0")');
  showStep('step0');

  // Initialize admin mode UI if in admin mode
  if (window.isAdminMode) {
    console.log('🔐 Initializing admin mode UI...');
    const adminPaymentSelector = document.getElementById('adminPaymentMethodSelector');
    if (adminPaymentSelector) {
      adminPaymentSelector.style.display = 'block';
    }

    // Add payment method change listener
    const paymentMethodSelect = document.getElementById('paymentMethod');
    if (paymentMethodSelect) {
      paymentMethodSelect.addEventListener('change', function() {
        const selectedMethod = this.value;
        console.log('💳 Payment method changed to:', selectedMethod);

        const cardContainer = document.querySelector('.card-input-container');
        const authorizeBtn = document.getElementById('authorizeCardBtn');
        const proceedBtn = document.getElementById('proceedToSummaryBtn');

        if (selectedMethod === 'card') {
          // Show Stripe card elements for credit card
          if (cardContainer) cardContainer.style.display = 'block';
          if (authorizeBtn) authorizeBtn.parentElement.style.display = 'block';

          // Reset card authorization
          window.cardAuthorized = false;
          if (proceedBtn) {
            proceedBtn.disabled = true;
            proceedBtn.style.opacity = '0.5';
            proceedBtn.style.cursor = 'not-allowed';
          }
        } else {
          // Hide Stripe card elements for bank_transfer or invoice
          if (cardContainer) cardContainer.style.display = 'none';
          if (authorizeBtn) authorizeBtn.parentElement.style.display = 'none';

          // Enable proceed button directly (no card authorization needed)
          if (proceedBtn) {
            proceedBtn.disabled = false;
            proceedBtn.style.opacity = '1';
            proceedBtn.style.cursor = 'pointer';
          }

          // Set card authorized flag (bypasses card check)
          window.cardAuthorized = true;
        }
      });
    }
  }

  // Disable past dates on the date picker and clear any default value
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-11
  const dd = String(today.getDate()).padStart(2, '0');
  const dateInput = document.getElementById('date');
  dateInput.setAttribute('min', `${yyyy}-${mm}-${dd}`);
  dateInput.value = ''; // Clear any default value

  // Initial state: Step 0 is already shown above
  
  // Load all data in parallel for better performance
  console.log('🔄 Loading initial data...');
  
  // Show loading indicator
  const loadingDiv = document.createElement('div');
  loadingDiv.id = 'loading-indicator';
  loadingDiv.innerHTML = `
    <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(255,255,255,0.9); z-index: 9999; display: flex; align-items: center; justify-content: center;">
      <div style="text-align: center;">
        <div class="egg-timer" style="font-size: 2rem; margin-bottom: 1rem;">⏳</div>
        <div>Loading booking system...</div>
      </div>
    </div>
  `;
  document.body.appendChild(loadingDiv);
  
  // Add timeout and retry logic for network issues
  const loadDataWithRetry = async (loadFunction, maxRetries = 3) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await loadFunction();
      } catch (error) {
        console.warn(`Attempt ${attempt} failed:`, error.message);
        if (attempt === maxRetries) {
          console.error(`Failed after ${maxRetries} attempts:`, error);
          return null;
        }
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  };
  
  Promise.all([
    loadDataWithRetry(fetchPricingData),
    loadDataWithRetry(fetchSettings)
  ]).then((results) => {
    console.log('✅ Settings and pricing data loaded successfully');
    
    // Check if any data failed to load
    const failedLoads = results.filter(result => result === null).length;
    if (failedLoads > 0) {
      console.warn(`⚠️ ${failedLoads} data sources failed to load. Application will continue with available data.`);
      
      // Show a user-friendly message
      const warningDiv = document.createElement('div');
      warningDiv.style.cssText = `
        position: fixed; top: 10px; right: 10px; 
        background: #fff3cd; border: 1px solid #ffeaa7; 
        padding: 10px; border-radius: 5px; z-index: 10000;
        max-width: 300px; font-size: 14px;
      `;
      warningDiv.innerHTML = `
        <strong>⚠️ Connection Warning</strong><br>
        Some data couldn't be loaded. Please check your internet connection and refresh the page.
      `;
      document.body.appendChild(warningDiv);
      
      // Remove warning after 10 seconds
      setTimeout(() => {
        if (warningDiv.parentNode) {
          warningDiv.parentNode.removeChild(warningDiv);
        }
      }, 10000);
    }

    setupPriceListeners();
    setupRecurringBookingListeners();

    // Remove loading indicator
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
      loadingIndicator.remove();
    }
  }).catch(error => {
    console.error('❌ Error loading initial data:', error);
    
    // Show error message to user
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: #f8d7da; border: 1px solid #f5c6cb; 
      padding: 20px; border-radius: 5px; z-index: 10000;
      max-width: 400px; text-align: center;
    `;
    errorDiv.innerHTML = `
      <h3>⚠️ Connection Error</h3>
      <p>Unable to connect to the booking system. This might be due to:</p>
      <ul style="text-align: left; margin: 10px 0;">
        <li>Internet connection issues</li>
        <li>Temporary server maintenance</li>
        <li>Network restrictions</li>
      </ul>
      <button onclick="location.reload()" style="background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">
        Try Again
      </button>
    `;
    document.body.appendChild(errorDiv);
    
    // Remove loading indicator
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
      loadingIndicator.remove();
    }
  });

  // Next buttons
  document.querySelectorAll('.btn.next').forEach(btn => {
    btn.addEventListener('click', function () {
      const currentStepId = btn.closest('.step').id;
      if (validateStep(currentStepId)) {
        const nextId = btn.getAttribute('data-next');
        if (nextId) showStep(nextId);
      }
    });
  });

  // Prev buttons
  document.querySelectorAll('.btn.prev').forEach(btn => {
    btn.addEventListener('click', function () {
      const prevId = btn.getAttribute('data-prev');
      if (prevId) showStep(prevId);
    });
  });

  // Progress bar navigation
  document.querySelectorAll('.progress-step').forEach((stepEl, idx) => {
    stepEl.style.cursor = 'pointer';
    stepEl.addEventListener('click', function () {
      const targetStep = 'step' + (idx + 1);
      const currentStepIdx = steps.findIndex(s => s.classList.contains('active'));
      if (idx <= currentStepIdx) {
        // Always allow backward navigation
        showStep(targetStep);
      } else {
        // Only allow forward navigation if all previous steps are valid
        let canAdvance = true;
        for (let i = 0; i <= idx - 1; i++) {
          if (!validateStep('step' + (i + 1))) {
            canAdvance = false;
            showStep('step' + (i + 1));
            break;
          }
        }
        if (canAdvance) showStep(targetStep);
      }
    });
  });

  function validateStep(stepId) {
    // Clear previous errors
    const currentStep = document.getElementById(stepId);
    currentStep.querySelectorAll('.error-message').forEach(el => el.remove());

    let isValid = true;
    switch (stepId) {
      case 'step1': // Address
        if (!document.getElementById('address').value) {
          isValid = false;
          updateAddressStatus('Please enter and select an address.', 'error');
        } else if (!isAddressVerified()) {
          isValid = false;
          updateAddressStatus('Please select an address from the dropdown or ensure it\'s properly verified.', 'error');
        } else {
          updateAddressStatus('✅ Address verified', 'verified');
        }
        const bookingType = document.querySelector('input[name="bookingType"]:checked')?.value;
        if (bookingType === 'Corporate Event/Office' && !document.getElementById('businessName').value) {
          isValid = false;
          showError(document.getElementById('businessName'), 'Please enter the business name.');
        }
        break;
      case 'step2': // Service & Duration
        if (!window.selectedServiceId) {
          isValid = false;
          showError(document.getElementById('servicesGrid'), 'Please select a service.');
        }
        if (!document.getElementById('duration').value) {
          isValid = false;
          showError(document.getElementById('duration'), 'Please select a duration.');
        } else {
          // Check if selected duration is disabled (below minimum)
          const durationSelect = document.getElementById('duration');
          const selectedOption = durationSelect.selectedOptions[0];
          if (selectedOption && selectedOption.disabled) {
            isValid = false;
            showError(document.getElementById('duration'), 'This duration is below the minimum for the selected service.');
          }
        }
        break;
      case 'step4': // Date & Time
        if (!document.getElementById('date').value) {
          isValid = false;
          showError(document.getElementById('date'), 'Please select a date.');
        }
        if (!document.getElementById('time').value) {
          isValid = false;
          showError(document.getElementById('timeSlotsContainer'), 'Please select an available time slot.');
        }
        break;
      case 'step5': // Therapist
        if (!document.querySelector('input[name="therapistId"]:checked')) {
          isValid = false;
          showError(document.getElementById('therapistSelection'), 'Please select a therapist.');
        }
        break;
      case 'step6': // Customer Details
        const firstName = document.getElementById('customerFirstName');
        const lastName = document.getElementById('customerLastName');
        const email = document.getElementById('customerEmail');
        const phone = document.getElementById('customerPhone');
        
        if (!firstName?.value) {
          isValid = false;
          showError(firstName || document.getElementById('customerFirstName'), 'Please enter your first name.');
        }
        if (!lastName?.value) {
          isValid = false;
          showError(lastName || document.getElementById('customerLastName'), 'Please enter your last name.');
        }
        if (!email?.value) {
          isValid = false;
          showError(email || document.getElementById('customerEmail'), 'Please enter your email address.');
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
          isValid = false;
          showError(email, 'Please enter a valid email address.');
        }
        if (!phone?.value) {
          isValid = false;
          showError(phone || document.getElementById('customerPhone'), 'Please enter your phone number.');
        }
        break;
      case 'step7': // Room Details & Notes
        
        // Check terms acceptance
        const termsAccept = document.getElementById('termsAcceptance');
        if (!termsAccept?.value || termsAccept.value !== 'yes') {
          isValid = false;
          showError(termsAccept || document.getElementById('termsAcceptance'), 'Please accept the Terms & Conditions to continue.');
        }
        break;
      case 'step8': // Payment
        // Check if card has been authorized (or if using non-card payment in admin mode)
        const selectedPaymentMethod = window.isAdminMode
          ? (document.getElementById('paymentMethod')?.value || 'card')
          : 'card';

        // Only require card authorization if payment method is 'card'
        if (selectedPaymentMethod === 'card' && !cardAuthorized) {
          isValid = false;
          const statusDiv = document.getElementById('cardAuthStatus');
          if (statusDiv) {
            statusDiv.innerHTML = `
              <div style="background: #fef2f2; border: 2px solid #fecaca; color: #991b1b;">
                <div style="font-size: 16px; font-weight: 600;">⚠️ Please authorize your card first</div>
                <div style="font-size: 14px; margin-top: 4px;">Click the "Authorise Card" button to secure your payment method.</div>
              </div>
            `;
            statusDiv.style.display = 'block';
          }
        } else if (selectedPaymentMethod !== 'card') {
          // For non-card payments, ensure cardAuthorized is set (bypass validation)
          console.log('✅ Non-card payment method selected, bypassing card authorization');
          window.cardAuthorized = true;
        }
        break;
    }
    return isValid;
  }

  function showError(inputElement, message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    // Insert after the input element or its parent if it's a container
    const parent = inputElement.parentElement;
    if (parent.classList.contains('form-group') || parent.classList.contains('step-content') || parent.id === 'therapistSelection' || parent.id === 'timeSlotsContainer') {
       inputElement.insertAdjacentElement('afterend', errorDiv);
    } else {
       parent.insertAdjacentElement('afterend', errorDiv);
    }
  }

  // Get duration label with descriptive names
  window.getDurationLabel = function getDurationLabel(minutes) {
    const labels = {
      60: '60 min — Essential',
      75: '75 min — Signature (most popular)',
      90: '90 min — Bliss',
      120: '120 min — Ultimate',
      180: '180 (group events only)',
      240: '240 (group events only)',
      300: '300 (group events only)'
    };
    return labels[minutes] || `${minutes} minutes`;
  };

  // Fetch and populate services and durations from Supabase
  window.populateTherapyOptions = async function populateTherapyOptions() {
    try {
    // Fetch services
    const { data: services, error: serviceError } = await window.supabase
      .from('services')
      .select('id, name, service_base_price, minimum_duration, is_active, quote_only, image_url, image_alt, short_description')
      .eq('is_active', true)
      .order('sort_order');
    console.log('Supabase services:', services, 'Error:', serviceError);
      
    const servicesGrid = document.getElementById('servicesGrid');
    if (servicesGrid) {
      servicesGrid.innerHTML = '';
        if (services && services.length > 0) {
        
        // Filter services based on booking mode
        let filteredServices = services;
        console.log('📋 Current booking mode:', window.bookingMode);
        console.log('📋 Sample service quote_only values:', services.slice(0, 3).map(s => ({name: s.name, quote_only: s.quote_only, type: typeof s.quote_only})));
        
        if (window.bookingMode === 'quote') {
          filteredServices = services.filter(service => service.quote_only === true || service.quote_only === 'true');
          console.log('📋 Filtering for quote mode. Total quote services:', filteredServices.length);
        } else if (window.bookingMode === 'instant') {
          filteredServices = services.filter(service => service.quote_only === false || service.quote_only === 'false');
          console.log('📋 Filtering for instant booking mode. Total instant services:', filteredServices.length);
        } else {
          console.log('📋 No booking mode set, showing all services');
        }
        
        filteredServices.forEach((service, index) => {
          console.log('📋 Loading service:', service.name, 'ID:', service.id, 'minimum_duration:', service.minimum_duration);
          
          const serviceCard = document.createElement('div');
          serviceCard.className = 'service-card';
          serviceCard.dataset.serviceId = service.id;
          serviceCard.dataset.minimumDuration = service.minimum_duration || 60;
          serviceCard.dataset.quoteOnly = service.quote_only || false;
          
          // Hide services beyond the first 4 initially
          if (index >= 4) {
            serviceCard.classList.add('hidden');
          }
          
          // Create service icon
          const serviceIcon = document.createElement('div');
          serviceIcon.className = 'service-icon';
          
          if (service.image_url) {
            const img = document.createElement('img');
            img.src = service.image_url;
            img.alt = service.image_alt || service.name;
            img.className = 'service-icon';
            serviceIcon.appendChild(img);
          } else {
            // Fallback to emoji based on service name
            const emoji = getServiceEmoji(service.name);
            serviceIcon.textContent = emoji;
          }
          
          // Create service info
          const serviceInfo = document.createElement('div');
          serviceInfo.className = 'service-info';
          
          const serviceName = document.createElement('div');
          serviceName.className = 'service-name';
          serviceName.textContent = service.name;
          
          const serviceDesc = document.createElement('div');
          serviceDesc.className = 'service-desc';
          serviceDesc.textContent = service.short_description || service.quote_description || service.description || 'Professional wellness service';
          
          serviceInfo.appendChild(serviceName);
          serviceInfo.appendChild(serviceDesc);
          
          serviceCard.appendChild(serviceIcon);
          serviceCard.appendChild(serviceInfo);
          
          // Add click handler
          serviceCard.addEventListener('click', () => selectServiceCard(serviceCard, service));
          
          servicesGrid.appendChild(serviceCard);
          console.log('💾 Created service card for:', service.name);
        });
        
        // Show "Show More" button if there are more than 4 filtered services
        if (filteredServices.length > 4) {
          const showMoreBtn = document.getElementById('showMoreBtn');
          if (showMoreBtn) {
            showMoreBtn.style.display = 'block';
            showMoreBtn.textContent = `+ View All Services (${filteredServices.length - 4} more)`;
          }
        }
        
        // Show/hide duration field based on booking mode
        const durationField = document.getElementById('durationField');
        if (durationField) {
          if (window.bookingMode === 'quote') {
            durationField.style.display = 'none';
            console.log('📋 Hiding duration field for quote mode');
          } else if (window.bookingMode === 'instant') {
            durationField.style.display = 'block';
            console.log('📋 Showing duration field for instant booking mode');
          }
        }
        } else {
          // Add fallback options if no data loaded
          const fallbackServices = [
            { id: '1', name: 'Relaxation Massage', service_base_price: 80 },
            { id: '2', name: 'Deep Tissue Massage', service_base_price: 90 },
            { id: '3', name: 'Sports Massage', service_base_price: 100 }
          ];
          fallbackServices.forEach(service => {
            const opt = document.createElement('option');
            opt.value = service.id;
            opt.textContent = service.name;
            serviceSelect.appendChild(opt);
          });
          console.warn('⚠️ Using fallback services due to connection issues');
        }
      }
      
    // Fetch durations
    const { data: durations, error: durationError } = await window.supabase
      .from('duration_pricing')
      .select('id, duration_minutes, uplift_percentage, is_active')
      .eq('is_active', true)
      .order('sort_order');
    console.log('Supabase durations:', durations, 'Error:', durationError);
      
    const durationSelect = document.getElementById('duration');
    if (durationSelect) {
      durationSelect.innerHTML = '<option value="">Select duration...</option>';
        if (durations && durations.length > 0) {
        durations.forEach(duration => {
          const opt = document.createElement('option');
          opt.value = duration.duration_minutes;
            opt.textContent = getDurationLabel(duration.duration_minutes);
          durationSelect.appendChild(opt);
        });
        } else {
          // Add fallback options if no data loaded
          const fallbackDurations = [
            { id: '1', duration_minutes: 30 },
            { id: '2', duration_minutes: 60 },
            { id: '3', duration_minutes: 90 }
          ];
          fallbackDurations.forEach(duration => {
            const opt = document.createElement('option');
            opt.value = duration.duration_minutes;
            opt.textContent = getDurationLabel(duration.duration_minutes);
            durationSelect.appendChild(opt);
          });
          console.warn('⚠️ Using fallback durations due to connection issues');
        }
      }
    } catch (error) {
      console.error('❌ Error populating therapy options:', error);
      // Add basic fallback options
      const serviceSelect = document.getElementById('service');
      const durationSelect = document.getElementById('duration');
      
      if (serviceSelect) {
        serviceSelect.innerHTML = `
          <option value="">Select a service...</option>
          <option value="1">Relaxation Massage</option>
          <option value="2">Deep Tissue Massage</option>
          <option value="3">Sports Massage</option>
        `;
      }
      
      if (durationSelect) {
        durationSelect.innerHTML = `
          <option value="">Select duration...</option>
          <option value="30">30 minutes</option>
          <option value="60">60 minutes</option>
          <option value="90">90 minutes</option>
        `;
      }
    }
  };

  window.servicesCache = [];
  window.durationsCache = [];
  window.timePricingRulesCache = [];
  window.businessOpeningHour = undefined;
  window.businessClosingHour = undefined;
  window.beforeServiceBuffer = undefined;
  window.afterServiceBuffer = undefined;
  window.minBookingAdvanceHours = undefined;
  window.therapistDaytimeRate = undefined;
  window.therapistAfterhoursRate = undefined;

console.log('Globals:', {
  businessOpeningHour: window.businessOpeningHour,
  businessClosingHour: window.businessClosingHour,
  beforeServiceBuffer: window.beforeServiceBuffer,
  afterServiceBuffer: window.afterServiceBuffer,
  minBookingAdvanceHours: window.minBookingAdvanceHours
});

  async function fetchPricingData() {
    try {
    // Fetch services
    const { data: services } = await window.supabase
      .from('services')
      .select('id, name, service_base_price, minimum_duration, is_active, image_url, image_alt, short_description')
      .eq('is_active', true)
      .order('sort_order');
    window.servicesCache = services || [];

    // Fetch durations
    const { data: durations } = await window.supabase
      .from('duration_pricing')
      .select('id, duration_minutes, uplift_percentage, is_active')
      .eq('is_active', true)
      .order('sort_order');
    window.durationsCache = durations || [];

    // Fetch time pricing rules
    const { data: timeRules } = await window.supabase
      .from('time_pricing_rules')
      .select('id, day_of_week, start_time, end_time, uplift_percentage, is_active, label')
      .eq('is_active', true)
      .order('sort_order');
    window.timePricingRulesCache = timeRules || [];
    } catch (error) {
      console.error('❌ Error fetching pricing data:', error);
      // Use fallback data
      window.servicesCache = [
        { id: '1', name: 'Relaxation Massage', service_base_price: 80 },
        { id: '2', name: 'Deep Tissue Massage', service_base_price: 90 },
        { id: '3', name: 'Sports Massage', service_base_price: 100 }
      ];
      window.durationsCache = [
        { id: '1', duration_minutes: 30, uplift_percentage: 0 },
        { id: '2', duration_minutes: 60, uplift_percentage: 0 },
        { id: '3', duration_minutes: 90, uplift_percentage: 25 }
      ];
      window.timePricingRulesCache = [];
    }
  }

  async function fetchSettings() {
    try {
    const { data: settings } = await window.supabase
      .from('system_settings')
      .select('key, value');
    if (settings) {
      for (const s of settings) {
        if (s.key === 'business_opening_time') window.businessOpeningHour = Number(s.value);
        if (s.key === 'business_closing_time') window.businessClosingHour = Number(s.value);
        if (s.key === 'before_service_buffer_time') window.beforeServiceBuffer = Number(s.value);
        if (s.key === 'after_service_buffer_time') window.afterServiceBuffer = Number(s.value);
        if (s.key === 'min_booking_advance_hours') window.minBookingAdvanceHours = Number(s.value);
        if (s.key === 'therapist_daytime_hourly_rate') window.therapistDaytimeRate = Number(s.value);
        if (s.key === 'therapist_afterhours_hourly_rate') window.therapistAfterhoursRate = Number(s.value);
        if (s.key === 'therapist_response_timeout_minutes') window.therapistResponseTimeoutMinutes = Number(s.value);
      }
      }
    } catch (error) {
      console.error('❌ Error fetching settings:', error);
      // Use fallback settings
      window.businessOpeningHour = 9;
      window.businessClosingHour = 17;
      window.beforeServiceBuffer = 15;
      window.afterServiceBuffer = 15;
      window.minBookingAdvanceHours = 2;
      window.therapistDaytimeRate = 45;
      window.therapistAfterhoursRate = 55;
      window.therapistResponseTimeoutMinutes = 3; // Default 3 minutes
    }
  }

  function calculatePrice() {
    // Get service data from card selection (new method) or fallback to dropdown (old method)
    const serviceId = window.selectedServiceId || document.getElementById('service')?.value;
    const durationVal = document.getElementById('duration').value;
    const dateVal = document.getElementById('date').value;
    const timeVal = document.getElementById('time').value;
    
    console.log('💰 calculatePrice called with:', { serviceId, durationVal, dateVal, timeVal });
    
    if (!serviceId || !durationVal || !dateVal || !timeVal) {
      console.log('💰 Missing required data for price calculation');
      return;
    }

    // Get base price - use stored service or find in cache
    const service = window.selectedService || window.servicesCache.find(s => s.id === serviceId);
    if (!service) {
      console.log('💰 Service not found:', serviceId);
      return;
    }
    let price = Number(service.service_base_price);
    let breakdown = [`Hourly Rate: $${price.toFixed(2)}`];

    // Get duration uplift
    const duration = window.durationsCache.find(d => d.duration_minutes === Number(durationVal));
    if (duration && duration.uplift_percentage) {
      const durationUplift = price * (Number(duration.uplift_percentage) / 100);
      price += durationUplift;
      breakdown.push(`Extended Session Rate (${duration.uplift_percentage}%): +$${durationUplift.toFixed(2)}`);
    }

    // Get day of week and time
    const dayOfWeek = new Date(dateVal).getDay(); // 0=Sunday, 6=Saturday
    // Find matching time pricing rule from table
    let timeUplift = 0;
    for (const rule of window.timePricingRulesCache) {
      if (Number(rule.day_of_week) === dayOfWeek) {
        if (timeVal >= rule.start_time && timeVal < rule.end_time) {
          timeUplift = Number(rule.uplift_percentage);
          break;
        }
      }
    }
    if (timeUplift) {
      const timeUpliftAmount = price * (timeUplift / 100);
      price += timeUpliftAmount;
      breakdown.push(`Weekend/Afterhours Rate (${timeUplift}%): +$${timeUpliftAmount.toFixed(2)}`);
    }

    // Store gross price for discount calculations
    window.grossPrice = price;
    
    // Apply discounts if available
    let finalPrice = price;
    let discountAmount = 0;
    
    // Check for applied discount
    if (window.appliedDiscount) {
      if (window.appliedDiscount.discount_type === 'percentage') {
        discountAmount = (price * window.appliedDiscount.discount_value) / 100;
      } else if (window.appliedDiscount.discount_type === 'fixed_amount') {
        discountAmount = Math.min(window.appliedDiscount.discount_value, price);
      }
      finalPrice = price - discountAmount;
      breakdown.push(`Discount (${window.appliedDiscount.code}): -$${discountAmount.toFixed(2)}`);
    }
    
    // Apply gift card if available
    let giftCardAmount = 0;
    if (window.appliedGiftCard) {
      giftCardAmount = Math.min(window.appliedGiftCard.current_balance, finalPrice);
      finalPrice = finalPrice - giftCardAmount;
      breakdown.push(`Gift Card (${window.appliedGiftCard.code}): -$${giftCardAmount.toFixed(2)}`);
    }
    
    // Show GST as percentage breakdown only (already included in price)
    const gstAmount = finalPrice / 11 * 1; // GST component of final price
    breakdown.push(`GST (10%): $${gstAmount.toFixed(2)}`);
    
    // Update price display
    document.getElementById('priceAmount').textContent = finalPrice.toFixed(2);
    
    // Generate new aligned pricing breakdown
    const priceBreakdown = document.getElementById('priceBreakdown');
    priceBreakdown.innerHTML = breakdown.map(item => {
      const isPositive = item.includes('+');
      const isNegative = item.includes('-');
      const isDiscount = item.includes('Discount') || item.includes('Gift Card');
      
      let className = '';
      if (isPositive && !isDiscount) className = 'positive';
      if (isNegative || isDiscount) className = 'negative';
      
      // Extract label and value
      const parts = item.split(':');
      const label = parts[0].trim();
      const value = parts[1] ? parts[1].trim() : '';
      
      return `
        <div class="pricing-item ${className}">
          <span class="label">${label}</span>
          <span class="value">${value}</span>
        </div>
      `;
    }).join('');

    // Show discount section after price is calculated
    const discountSection = document.getElementById('discountSection');
    if (discountSection && price > 0) {
      discountSection.style.display = 'block';
    }

    // Update recurring price display if enabled
    if (window.recurringBooking && window.recurringBooking.enabled) {
      updateRecurringPriceDisplay();
    }
  }

  // Update price when relevant fields change
  function setupPriceListeners() {
    ['service', 'duration', 'date', 'time'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', calculatePrice);
      }
    });
    
    // Add discount button listener - SIMPLE
    const promoBtn = document.getElementById('applyPromoBtn');
    if (promoBtn) {
      promoBtn.addEventListener('click', async function() {
        const input = document.getElementById('promoCode');
        const code = input.value.trim().toUpperCase();
        
        if (!code) return;
        
        try {
          const { data, error } = await window.supabase
            .from('discount_codes')
            .select('*')
            .eq('code', code)
            .eq('is_active', true)
            .single();
          
          if (!error && data) {
            window.appliedDiscount = data;
            calculatePrice(); // This will now include the discount
            document.getElementById('promoStatus').innerHTML = '<span style="color: green;">✅ Discount applied! <button type="button" onclick="removeDiscount()" style="margin-left: 8px; padding: 2px 8px; background: #dc3545; color: white; border: none; border-radius: 3px; cursor: pointer;">Remove</button></span>';
            document.getElementById('promoStatus').style.display = 'block';
            this.textContent = 'Applied';
            input.disabled = true;
          } else {
            document.getElementById('promoStatus').innerHTML = '<span style="color: red;">Invalid code</span>';
            document.getElementById('promoStatus').style.display = 'block';
          }
        } catch (error) {
          console.error('Discount error:', error);
        }
      });
    }
    
    // Add gift card button listener
    const giftCardBtn = document.getElementById('applyGiftCardBtn');
    if (giftCardBtn) {
      giftCardBtn.addEventListener('click', async function() {
        const input = document.getElementById('giftCard');
        const code = input.value.trim().toUpperCase();
        
        if (!code) return;
        
        try {
          const { data, error } = await window.supabase
            .from('gift_cards')
            .select('*')
            .eq('code', code)
            .eq('is_active', true)
            .single();
          
          if (!error && data && data.current_balance > 0) {
            window.appliedGiftCard = data;
            calculatePrice(); // This will now include the gift card
            document.getElementById('giftCardStatus').innerHTML = '<span style="color: green;">✅ Gift card applied! <button type="button" onclick="removeGiftCard()" style="margin-left: 8px; padding: 2px 8px; background: #dc3545; color: white; border: none; border-radius: 3px; cursor: pointer;">Remove</button></span>';
            document.getElementById('giftCardStatus').style.display = 'block';
            this.textContent = 'Applied';
            input.disabled = true;
          } else {
            document.getElementById('giftCardStatus').innerHTML = '<span style="color: red;">Invalid or expired gift card</span>';
            document.getElementById('giftCardStatus').style.display = 'block';
          }
        } catch (error) {
          console.error('Gift card error:', error);
        }
      });
    }
    
    // Service selection is now handled by card clicks, no dropdown event listener needed
    
    // Add acknowledgement dropdown listeners
    const termsAck = document.getElementById('termsAcceptance');
      
    if (termsAck) {
      termsAck.addEventListener('change', function() {
        if (this.value === 'no') {
          if (confirm('Are you sure you want to cancel this booking?')) {
            window.location.href = 'https://rejuvenators.com';
          } else {
            this.value = '';
          }
        }
      });
    }
  }
  
  // Remove discount function - make global
  window.removeDiscount = function() {
    window.appliedDiscount = null;
    document.getElementById('promoCode').disabled = false;
    document.getElementById('promoCode').value = '';
    document.getElementById('applyPromoBtn').textContent = 'Apply';
    document.getElementById('promoStatus').style.display = 'none';
    calculatePrice();
  }
  
  // Remove gift card function - make global
  window.removeGiftCard = function() {
    window.appliedGiftCard = null;
    document.getElementById('giftCard').disabled = false;
    document.getElementById('giftCard').value = '';
    document.getElementById('applyGiftCardBtn').textContent = 'Apply';
    document.getElementById('giftCardStatus').style.display = 'none';
    calculatePrice();
  }

  // ========== RECURRING BOOKING FUNCTIONALITY ==========

  // Initialize recurring booking state
  window.recurringBooking = {
    enabled: false,
    frequency: 'weekly',
    customInterval: 3,
    count: 6,
    dates: []
  };

  // Setup recurring booking listeners
  function setupRecurringBookingListeners() {
    const recurringToggle = document.getElementById('recurringToggle');
    const recurringOptions = document.getElementById('recurringOptions');
    const recurringFrequency = document.getElementById('recurringFrequency');
    const customIntervalGroup = document.getElementById('customIntervalGroup');
    const customInterval = document.getElementById('customInterval');
    const recurringCount = document.getElementById('recurringCount');

    if (!recurringToggle) {
      console.log('⚠️ Recurring toggle not found');
      return;
    }

    // Toggle recurring options visibility
    recurringToggle.addEventListener('change', function() {
      window.recurringBooking.enabled = this.checked;
      recurringOptions.style.display = this.checked ? 'block' : 'none';

      if (this.checked) {
        updateRecurringPreview();
      } else {
        // Reset to single booking price display
        calculatePrice();
      }
    });

    // Show/hide custom interval field based on frequency selection
    recurringFrequency.addEventListener('change', function() {
      customIntervalGroup.style.display = this.value === 'custom' ? 'block' : 'none';
      window.recurringBooking.frequency = this.value;
      updateRecurringPreview();
    });

    // Update preview when custom interval changes
    customInterval.addEventListener('change', function() {
      window.recurringBooking.customInterval = parseInt(this.value) || 3;
      updateRecurringPreview();
    });

    // Update preview when occurrence count changes
    recurringCount.addEventListener('change', function() {
      window.recurringBooking.count = parseInt(this.value) || 6;
      updateRecurringPreview();
    });

    // Update recurring preview when date changes
    const dateInput = document.getElementById('date');
    if (dateInput) {
      dateInput.addEventListener('change', function() {
        if (window.recurringBooking.enabled) {
          updateRecurringPreview();
        }
      });
    }

    console.log('✅ Recurring booking listeners setup complete');
  }

  // Generate recurring dates based on frequency
  // Note: This generates REPEAT dates only (not including the initial booking date)
  function generateRecurringDates(startDate, frequency, customInterval, count) {
    const dates = [];
    const start = new Date(startDate);

    // Validate start date
    if (isNaN(start.getTime())) {
      return dates;
    }

    // Generate repeat dates (starting from first repeat, NOT including initial date)
    for (let i = 0; i < count; i++) {
      const nextDate = new Date(start);
      const repeatNumber = i + 1; // First repeat is 1, second is 2, etc.

      switch(frequency) {
        case 'daily':
          nextDate.setDate(nextDate.getDate() + repeatNumber);
          break;
        case 'weekly':
          nextDate.setDate(nextDate.getDate() + (7 * repeatNumber));
          break;
        case 'biweekly':
          nextDate.setDate(nextDate.getDate() + (14 * repeatNumber));
          break;
        case 'monthly':
          nextDate.setDate(nextDate.getDate() + (28 * repeatNumber)); // 4 weeks
          break;
        case 'custom':
          nextDate.setDate(nextDate.getDate() + (customInterval * repeatNumber));
          break;
      }

      dates.push(nextDate);
    }

    return dates;
  }

  // Format date for display
  function formatDateForDisplay(date) {
    const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-AU', options);
  }

  // Update recurring preview - make global so HTML onclick can call it
  window.updateRecurringPreview = function() {
    const dateInput = document.getElementById('date');
    const timeInput = document.getElementById('time');
    const recurringDatesList = document.getElementById('recurringDatesList');
    const recurringPreview = document.getElementById('recurringPreview');

    if (!dateInput || !dateInput.value) {
      recurringDatesList.innerHTML = '<p style="color: #666; font-style: italic;">Please select a date first</p>';
      return;
    }

    const selectedDate = dateInput.value;
    const selectedTime = timeInput.value || 'Time not selected';
    const frequency = document.getElementById('recurringFrequency').value;
    const customInterval = parseInt(document.getElementById('customInterval').value) || 3;
    const count = parseInt(document.getElementById('recurringCount').value) || 6;

    // Generate dates
    const dates = generateRecurringDates(selectedDate, frequency, customInterval, count);
    window.recurringBooking.dates = dates;
    window.recurringBooking.frequency = frequency;
    window.recurringBooking.customInterval = customInterval;
    window.recurringBooking.count = count;

    // Display dates (initial booking + repeats)
    if (dates.length > 0) {
      let html = '<ul style="margin: 0; padding-left: 20px;">';
      // Show initial booking first
      const initialDate = new Date(selectedDate);
      html += `<li style="margin-bottom: 4px;"><strong>Initial booking:</strong> ${formatDateForDisplay(initialDate)} at ${selectedTime}</li>`;
      // Then show repeats
      dates.forEach((date, index) => {
        html += `<li style="margin-bottom: 4px;"><strong>Repeat ${index + 1}:</strong> ${formatDateForDisplay(date)} at ${selectedTime}</li>`;
      });
      html += '</ul>';
      html += `<p style="margin-top: 10px; font-weight: 600; color: #007e8c;">Total: ${dates.length + 1} sessions (1 initial + ${dates.length} repeats)</p>`;
      recurringDatesList.innerHTML = html;

      // Show preview section
      recurringPreview.style.display = 'block';

      // Update price display to show per-session pricing
      updateRecurringPriceDisplay();
    } else {
      recurringDatesList.innerHTML = '<p style="color: #dc2626;">Unable to generate dates. Please check your selections.</p>';
    }
  }

  // Update price display for recurring bookings
  function updateRecurringPriceDisplay() {
    if (!window.recurringBooking.enabled) {
      return;
    }

    // Get current price (already calculated by calculatePrice)
    const priceAmountEl = document.getElementById('priceAmount');
    const priceDisplayEl = document.getElementById('priceDisplay');

    if (!priceAmountEl || !priceDisplayEl) {
      return;
    }

    const sessionPrice = priceAmountEl.textContent;
    const count = window.recurringBooking.count;
    const totalPrice = (parseFloat(sessionPrice) * count).toFixed(2);

    // Update the price header to clarify this is per-session
    const priceHeader = priceDisplayEl.querySelector('.price-header');
    if (priceHeader) {
      priceHeader.innerHTML = `
        <strong>Estimated Session Price: $<span id="priceAmount">${sessionPrice}</span></strong>
        <div style="font-size: 14px; color: #666; margin-top: 8px;">
          ${count} sessions × $${sessionPrice} = $${totalPrice} total (charged per session as confirmed)
        </div>
        <div style="font-size: 13px; color: #007e8c; margin-top: 4px; font-style: italic;">
          💳 Each session charged separately after therapist confirms
        </div>
      `;
    }
  }

  // Call setupRecurringBookingListeners after DOMContentLoaded
  // We'll add this at the end of the initialization

  // ========== END RECURRING BOOKING FUNCTIONALITY ==========

  // Helper function to get emoji for service
  function getServiceEmoji(serviceName) {
    const name = serviceName.toLowerCase();
    if (name.includes('stress') || name.includes('relaxation')) return '🧘‍♀️';
    if (name.includes('sports')) return '🏃‍♂️';
    if (name.includes('deep tissue')) return '💪';
    if (name.includes('remedial')) return '🏥';
    if (name.includes('aroma')) return '🌸';
    if (name.includes('escapade')) return '✨';
    if (name.includes('ultimate') || name.includes('indulgence')) return '👑';
    if (name.includes('couple')) return '💕';
    if (name.includes('group') || name.includes('event')) return '👥';
    if (name.includes('corporate') || name.includes('office')) return '🏢';
    return '💆‍♀️'; // Default massage emoji
  }

  // Select service card
  function selectServiceCard(card, service) {
    // Remove selected class from all service cards
    document.querySelectorAll('.service-card').forEach(c => c.classList.remove('selected'));

    // Add selected class to clicked card
    card.classList.add('selected');

    // Get service data
    const serviceId = service.id;
    const minimumDuration = parseInt(card.dataset.minimumDuration);
    const quoteOnly = service.quote_only === true || service.quote_only === 'true';

    // Store selected service globally for use in other functions
    window.selectedService = service;
    window.selectedServiceId = serviceId;

    console.log('📋 Service selected:', service.name, 'quote_only:', service.quote_only, 'parsed:', quoteOnly);

    if (quoteOnly) {
      // This is a quote-only service, show quote form
      console.log('📋 Showing quote form for quote-only service');
      showQuoteForm(service);
    } else {
      // Regular service, show minimum duration and update duration options
      showMinimumDuration(minimumDuration);
      updateDurationOptions(minimumDuration);

      // Clear duration selection if invalid - FIX: use DOM element instead of undefined variable
      const currentDuration = document.getElementById('duration').value;
      if (currentDuration && parseInt(currentDuration) < minimumDuration) {
        document.getElementById('duration').value = '';
      }
    }
  }

  // Toggle services visibility (global function for onclick)
  window.toggleServices = function() {
    const hiddenServices = document.querySelectorAll('.service-card.hidden');
    const showMoreBtn = document.getElementById('showMoreBtn');
    
    if (hiddenServices.length > 0) {
      // Show all services
      hiddenServices.forEach(service => {
        service.classList.remove('hidden');
      });
      showMoreBtn.textContent = '- Show Fewer Services';
    } else {
      // Hide services beyond first 4
      const allServices = document.querySelectorAll('.service-card');
      allServices.forEach((service, index) => {
        if (index >= 4) {
          service.classList.add('hidden');
          service.classList.remove('selected');
        }
      });
      showMoreBtn.textContent = '+ View All Services';
      
      // If a hidden service was selected, clear selection
      const selectedCard = document.querySelector('.service-card.selected');
      if (selectedCard && selectedCard.classList.contains('hidden')) {
        document.getElementById('minimumDurationInfo').classList.remove('show');
        document.getElementById('duration').value = '';
      }
    }
  };

  // Handle service selection and detect quote-only services (legacy function for dropdown)
  function handleServiceSelection() {
    const serviceSelect = document.getElementById('service');
    const selectedOption = serviceSelect.selectedOptions[0];
    
    if (selectedOption && selectedOption.dataset.quoteOnly === 'true') {
      // This is a quote-only service, show quote form
      showQuoteForm(selectedOption);
    } else if (selectedOption && selectedOption.value) {
      // Regular service, get minimum duration from service data and update UI
      const serviceId = selectedOption.value;
      console.log('🔍 Looking for service ID:', serviceId);
      console.log('📋 Services cache:', window.servicesCache);
      const service = window.servicesCache.find(s => s.id === serviceId);
      console.log('🎯 Found service:', service);
      
      if (service && service.minimum_duration) {
        console.log('✅ Service has minimum_duration:', service.minimum_duration);
        showMinimumDuration(service.minimum_duration);
        updateDurationOptions(service.minimum_duration);
      } else {
        console.log('❌ Service has no minimum_duration');
        hideMinimumDuration();
        resetDurationOptions();
      }
      
      // Make sure we're not in quote mode
      window.bookingMode = 'booking';
    } else {
      hideMinimumDuration();
      resetDurationOptions();
    }
  }

  // Show minimum duration info
  function showMinimumDuration(minimumDuration) {
    const infoDiv = document.getElementById('minimumDurationInfo');
    const textSpan = document.getElementById('minimumDurationText');
    
    if (infoDiv && textSpan) {
      textSpan.textContent = `${minimumDuration} minutes minimum required`;
      infoDiv.style.display = 'block';
    }
  }

  // Hide minimum duration info
  function hideMinimumDuration() {
    const infoDiv = document.getElementById('minimumDurationInfo');
    if (infoDiv) {
      infoDiv.style.display = 'none';
    }
  }

  // Reset duration options to show all
  function resetDurationOptions() {
    const durationSelect = document.getElementById('duration');
    if (!durationSelect || !window.durationsCache) return;

    durationSelect.innerHTML = '<option value="">Select duration...</option>';
    window.durationsCache.forEach(duration => {
      const opt = document.createElement('option');
      opt.value = duration.duration_minutes;
      opt.textContent = getDurationLabel(duration.duration_minutes);
      durationSelect.appendChild(opt);
    });
  }

  // Update duration options based on service minimum duration
  function updateDurationOptions(minimumDuration) {
    const durationSelect = document.getElementById('duration');
    if (!durationSelect || !window.durationsCache) return;

    const minimumDurationNum = parseInt(minimumDuration);

    // Clear current options
    durationSelect.innerHTML = '<option value="">Select duration...</option>';

    // Add duration options, hiding those below minimum
    window.durationsCache.forEach(duration => {
      const durationMinutes = duration.duration_minutes;
      const opt = document.createElement('option');
      opt.value = durationMinutes;
      opt.textContent = getDurationLabel(durationMinutes);

      // Hide options below minimum duration
      if (durationMinutes < minimumDurationNum) {
        opt.style.display = 'none';
      }

      durationSelect.appendChild(opt);
    });
  }
  
  // Show the enhanced quote form for quote-only services
  function showQuoteForm(serviceData) {
    console.log('📋 showQuoteForm called with:', serviceData);
    
    // Use the new enhanced quote form
    if (typeof showEnhancedQuoteForm === 'function') {
      // Convert service object to serviceOption format for compatibility
      const serviceOption = {
        value: serviceData.id,
        textContent: serviceData.name,
        dataset: {
          serviceName: serviceData.name,
          serviceDescription: serviceData.short_description || serviceData.description
        }
      };
      showEnhancedQuoteForm(serviceOption);
      return;
    }

    // Fallback to old quote form if enhanced not available
    window.bookingMode = 'quote';
    
    // Populate service info
    const serviceInfo = document.getElementById('selectedServiceInfo');
    if (serviceInfo) {
      serviceInfo.innerHTML = `
        <h4>${serviceOption.dataset.serviceName}</h4>
        <p>${serviceOption.dataset.serviceDescription}</p>
        <div class="quote-badge">Quote Required</div>
      `;
    }
    
    // Set minimum date for quote
    const quoteDate = document.getElementById('quoteDate');
    if (quoteDate) {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      quoteDate.setAttribute('min', `${yyyy}-${mm}-${dd}`);
    }
    
    // Show quote step instead of continuing normal flow
    showStep('quoteStep');
    
    // Initialize quote address autocomplete
    initQuoteAddressAutocomplete();
    
    // Setup quote form event listeners
    setupQuoteFormListeners();
  }
  
  // Initialize Google Places autocomplete for quote address
  function initQuoteAddressAutocomplete() {
    if (window.google && window.google.maps && window.google.maps.places) {
      const quoteAddressInput = document.getElementById('quoteAddress');
      if (quoteAddressInput) {
        const autocomplete = new google.maps.places.Autocomplete(quoteAddressInput);
        autocomplete.setFields(['formatted_address', 'geometry']);
        
        autocomplete.addListener('place_changed', function() {
          const place = autocomplete.getPlace();
          if (place.geometry) {
            quoteAddressInput.dataset.lat = place.geometry.location.lat();
            quoteAddressInput.dataset.lng = place.geometry.location.lng();
            checkQuoteAddressRadius(place.geometry.location.lat(), place.geometry.location.lng());
          }
        });
      }
    }
  }
  
  // Check if quote address is within service radius
  function checkQuoteAddressRadius(lat, lng) {
    const statusDiv = document.getElementById('quote-address-status');
    if (!statusDiv) return;
    
    // Use the same radius check as regular bookings
    // This would typically check against therapist locations
    statusDiv.innerHTML = '<span style="color: green;">✓ Address is within our service area</span>';
  }
  
  // Setup quote form event listeners
  function setupQuoteFormListeners() {
    // Quote form submission
    const submitQuoteBtn = document.getElementById('submitQuoteBtn');
    if (submitQuoteBtn) {
      submitQuoteBtn.addEventListener('click', handleQuoteSubmission);
    }
    
    // Dynamic estimate calculation
    const estimateFields = ['quoteNumMassages', 'quoteMassageDuration', 'quoteUrgency', 'quoteTherapists'];
    estimateFields.forEach(fieldId => {
      const field = document.getElementById(fieldId);
      if (field) {
        field.addEventListener('change', calculateQuoteEstimate);
      }
    });
  }
  
  // Calculate quote estimate
  function calculateQuoteEstimate() {
    const numMassages = parseInt(document.getElementById('quoteNumMassages')?.value || 0);
    const duration = parseInt(document.getElementById('quoteMassageDuration')?.value || 0);
    const urgency = document.getElementById('quoteUrgency')?.value || 'flexible';
    
    if (numMassages > 0 && duration > 0) {
      // Calculate total minutes
      const totalMinutes = numMassages * duration;
      
      // Step 1: Base calculation using service rate from services table ($160/hour)
      const totalHours = totalMinutes / 60;
      let totalEstimate = totalHours * 160; // $160 from services.service_base_price
      
      // Step 2: Apply weekend/afterhours uplift (BEFORE discounts)
      const selectedDate = document.getElementById('quoteDate').value;
      if (selectedDate) {
        const dayOfWeek = new Date(selectedDate).getDay(); // 0=Sunday, 6=Saturday
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        
        if (isWeekend) {
          // Apply 25% weekend uplift from system_settings
          totalEstimate *= 1.25;
        }
      }
      
      // Step 3: Apply volume discounts (AFTER uplift)
      if (totalMinutes >= 240) {
        totalEstimate *= 0.9; // 10% discount for 240+ minutes
      } else if (totalMinutes >= 180) {
        totalEstimate *= 0.95; // 5% discount for 180+ minutes
      }
      
      // Step 4: Apply minimum based on 120-minute rule (before urgency)
      const minimumMinutes = 120;
      const minimumHours = minimumMinutes / 60; // 2 hours
      let minimumPrice = minimumHours * 160; // 2 × $160 = $320
      
      // Apply same uplifts to minimum price
      if (selectedDate) {
        const dayOfWeek = new Date(selectedDate).getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        if (isWeekend) {
          minimumPrice *= 1.25; // Weekend minimum = $320 × 1.25 = $400
        }
      }
      
      // Apply minimum if calculated price is below it
      if (totalEstimate < minimumPrice) {
        totalEstimate = minimumPrice;
      }
      
      // Calculate range: base price (flexible) to urgency price
      const basePrice = Math.round(totalEstimate); // Base price without urgency
      
      // Apply urgency multiplier for max estimate
      const urgencyMultipliers = {
        'flexible': 1.0,
        'within_week': 1.1,
        'within_3_days': 1.25,
        'urgent_24h': 1.5
      };
      const urgencyMultiplier = urgencyMultipliers[urgency] || 1.0;
      const urgencyPrice = Math.round(totalEstimate * urgencyMultiplier);
      
      // Range: base price to urgency price
      let minEstimate = basePrice;
      let maxEstimate = urgencyPrice;
      
      const estimateDiv = document.getElementById('quoteEstimate');
      const amountSpan = document.getElementById('estimateAmount');
      
      if (estimateDiv && amountSpan) {
        // Show validation message if under 120 minutes
        if (totalMinutes < 120) {
          amountSpan.innerHTML = `<span style="color: #ff6b35;">⚠️ Minimum 120 minutes required (Current: ${totalMinutes} minutes)</span>`;
          estimateDiv.style.display = 'block';
        } else {
          amountSpan.textContent = `$${minEstimate} - $${maxEstimate}`;
          estimateDiv.style.display = 'block';
        }
      }
    }
  }
  
  // Handle quote form submission
  async function handleQuoteSubmission(event) {
    event.preventDefault();
    
    // Validate required fields
    if (!validateQuoteForm()) {
      return;
    }
    
    const submitBtn = document.getElementById('submitQuoteBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting Quote Request...';
    
    try {
      // Generate quote ID
      const quoteId = await generateSequentialQuoteId();
      
      // Collect quote data
      const quoteData = collectQuoteFormData();
      quoteData.booking_id = quoteId; // Add the generated quote ID
      
      // Submit to database
      const { data, error } = await window.supabase
        .from('bookings')
        .insert(quoteData)
        .select();
      
      if (error) throw error;
      
      // Send confirmation email to customer
      await sendQuoteConfirmationEmail(quoteData, data[0]);
      
      // Show success message
      showQuoteSuccess(data && data[0] ? data[0] : { id: 'quote-submitted' });
      
    } catch (error) {
      console.error('Error submitting quote:', error);
      showQuoteError('Failed to submit quote request. Please try again.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Request Quote';
    }
  }
  
  // Validate quote form
  function validateQuoteForm() {
    const requiredFields = [
      { id: 'quoteContactName', label: 'Contact Name' },
      { id: 'quoteEmail', label: 'Email Address' },
      { id: 'quotePhone', label: 'Phone Number' },
      { id: 'quoteAddress', label: 'Event Address' },
      { id: 'quoteDate', label: 'Preferred Date' },
      { id: 'quoteTimeRange', label: 'Time Range' },
      { id: 'quoteNumMassages', label: 'Number of Massages' },
      { id: 'quoteMassageDuration', label: 'Massage Duration' },
      { id: 'quoteUrgency', label: 'Timeline' },
      { id: 'quotePaymentMethod', label: 'Payment Method' }
    ];
    
    let isValid = true;
    
    // Clear previous errors
    document.querySelectorAll('.quote-error').forEach(el => el.remove());
    
    requiredFields.forEach(field => {
      const element = document.getElementById(field.id);
      if (!element || !element.value.trim()) {
        showQuoteFieldError(element, `${field.label} is required`);
        isValid = false;
      }
    });
    
    // Email validation
    const email = document.getElementById('quoteEmail');
    if (email && email.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
      showQuoteFieldError(email, 'Please enter a valid email address');
      isValid = false;
    }
    
    return isValid;
  }
  
  // Show field-specific error
  function showQuoteFieldError(field, message) {
    if (!field) return;
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'quote-error';
    errorDiv.textContent = message;
    errorDiv.style.fontSize = '0.875rem';
    errorDiv.style.marginTop = '4px';
    
    field.insertAdjacentElement('afterend', errorDiv);
  }
  
  // Map payment method values to database values
  function mapPaymentMethod(value) {
    const mapping = {
      'credit_card': 'card',
      'invoice': 'invoice', 
      'bank_transfer': 'bank_transfer'
    };
    return mapping[value] || 'card';
  }
  
  // Collect quote form data
  function collectQuoteFormData() {
    const serviceSelect = document.getElementById('service');
    const selectedOption = serviceSelect.selectedOptions[0];
    
    return {
      // Basic booking fields
      service_id: selectedOption.value,
      booking_time: new Date(document.getElementById('quoteDate').value + 'T12:00:00').toISOString(),
      address: document.getElementById('quoteAddress').value,
      latitude: document.getElementById('quoteAddress').dataset.lat,
      longitude: document.getElementById('quoteAddress').dataset.lng,
      
      // Status and type
      status: 'quote_requested',
      payment_status: 'pending',
      quote_only: true,
      
      // Quote-specific fields
      number_of_massages: parseInt(document.getElementById('quoteNumMassages').value),
      duration_per_massage: parseInt(document.getElementById('quoteMassageDuration').value),
      preferred_therapists: parseInt(document.getElementById('quoteTherapists').value || 0),
      business_name: document.getElementById('quoteCompanyName').value, // Fixed: use business_name not company_name
      event_type: document.getElementById('quoteEventType').value,
      expected_attendees: parseInt(document.getElementById('quoteAttendees').value || 0),
      
      // Calculate and save the price
      price: calculateFinalQuotePrice(),
      
      // Contact info
      corporate_contact_name: document.getElementById('quoteContactName').value,
      corporate_contact_email: document.getElementById('quoteEmail').value,
      corporate_contact_phone: document.getElementById('quotePhone').value,
      
      // Payment and logistics - map to database values
      payment_method: mapPaymentMethod(document.getElementById('quotePaymentMethod').value),
      po_number: document.getElementById('quotePONumber').value,
      urgency: document.getElementById('quoteUrgency').value,
      setup_requirements: document.getElementById('quoteSetupRequirements').value,
      special_requirements: document.getElementById('quoteSpecialRequirements').value,
      
      // Metadata
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }
  
  // Calculate final quote price for database storage
  function calculateFinalQuotePrice() {
    const numMassages = parseInt(document.getElementById('quoteNumMassages')?.value || 0);
    const duration = parseInt(document.getElementById('quoteMassageDuration')?.value || 0);
    
    if (numMassages <= 0 || duration <= 0) return 0;
    
    // Step 1: Base calculation
    const totalMinutes = numMassages * duration;
    const totalHours = totalMinutes / 60;
    let totalPrice = totalHours * 160; // $160 service rate
    
    // Step 2: Weekend uplift
    const selectedDate = document.getElementById('quoteDate').value;
    if (selectedDate) {
      const dayOfWeek = new Date(selectedDate).getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      if (isWeekend) {
        totalPrice *= 1.25; // 25% weekend uplift
      }
    }
    
    // Step 3: Volume discounts
    if (totalMinutes >= 240) {
      totalPrice *= 0.9; // 10% discount
    } else if (totalMinutes >= 180) {
      totalPrice *= 0.95; // 5% discount
    }
    
    // Step 4: Minimum price check
    const minimumMinutes = 120;
    const minimumHours = minimumMinutes / 60;
    let minimumPrice = minimumHours * 160; // $320 base minimum
    
    if (selectedDate) {
      const dayOfWeek = new Date(selectedDate).getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      if (isWeekend) {
        minimumPrice *= 1.25; // $400 weekend minimum
      }
    }
    
    if (totalPrice < minimumPrice) {
      totalPrice = minimumPrice;
    }
    
    return Math.round(totalPrice * 100) / 100; // Round to 2 decimal places
  }
  
  // Send quote confirmation email
  async function sendQuoteConfirmationEmail(quoteData, quoteRecord) {
    try {
      // Prepare email template data
      const emailData = {
        to_email: quoteData.corporate_contact_email,
        to_name: quoteData.corporate_contact_name,
        contact_name: quoteData.corporate_contact_name,
        business_name: quoteData.business_name || 'Not specified',
        contact_email: quoteData.corporate_contact_email,
        contact_phone: quoteData.corporate_contact_phone,
        event_address: quoteData.address,
        event_date: new Date(quoteData.booking_time).toLocaleDateString('en-AU', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        event_type: quoteData.event_type || 'Corporate Event',
        expected_attendees: quoteData.expected_attendees || 'Not specified',
        number_of_massages: quoteData.number_of_massages,
        duration_per_massage: quoteData.duration_per_massage,
        total_duration: `${Math.floor((quoteData.number_of_massages * quoteData.duration_per_massage) / 60)}h ${(quoteData.number_of_massages * quoteData.duration_per_massage) % 60}m`,
        preferred_therapists: quoteData.preferred_therapists || 'Let us recommend',
        urgency: formatUrgency(quoteData.urgency),
        payment_method: formatPaymentMethod(quoteData.payment_method),
        po_number: quoteData.po_number || 'Not provided',
        setup_requirements: quoteData.setup_requirements || 'None specified',
        special_requirements: quoteData.special_requirements || 'None specified',
        quote_reference: quoteRecord ? quoteRecord.booking_id : 'QR' + Date.now().toString().substring(-6),

        // Add estimate investment range
        estimate_investment_min: `$${calculateQuoteEstimateRange(quoteData).min}`,
        estimate_investment_max: `$${calculateQuoteEstimateRange(quoteData).max}`,
        estimate_investment_range: `$${calculateQuoteEstimateRange(quoteData).min} - $${calculateQuoteEstimateRange(quoteData).max}`
      };

      // Send email using EmailJS
      const result = await emailjs.send(
        'service_puww2kb', // EmailJS service ID
        'template_dyah74g', // Quote confirmation template ID
        emailData
      );

      console.log('Quote confirmation email sent:', result);
    } catch (error) {
      console.error('Error sending quote confirmation email:', error);
      // Don't throw error - we don't want to fail the quote submission if email fails
    }
  }

  // Calculate quote estimate range for email (extracted from calculateQuoteEstimate)
  function calculateQuoteEstimateRange(quoteData) {
    const numMassages = parseInt(quoteData.number_of_massages || 0);
    const durationPerMassage = parseInt(quoteData.duration_per_massage || 0);

    if (numMassages <= 0 || durationPerMassage <= 0) {
      return { min: 0, max: 0 };
    }

    const totalMinutes = numMassages * durationPerMassage;

    // Step 1: Get service base price from services cache or use fallback
    let serviceBasePrice = 160; // Fallback price

    // Try to get actual service base price from cached services data
    if (window.servicesCache && window.servicesCache.length > 0) {
      // For quotes, typically use the first available service or a specific quote service
      const quoteService = window.servicesCache.find(s => s.quote_only) || window.servicesCache[0];
      if (quoteService && quoteService.service_base_price) {
        serviceBasePrice = Number(quoteService.service_base_price);
      }
    }

    // Calculate base estimate using actual service price
    const totalHours = totalMinutes / 60;
    let totalEstimate = totalHours * serviceBasePrice;

    // Step 2: Apply weekend/afterhours uplift (BEFORE discounts)
    // Note: For email we'll use a conservative estimate without specific date/time uplifts

    // Step 3: Minimum price check (for quotes only - 2 hours minimum)
    const minimumMinutes = 120;
    const minimumHours = minimumMinutes / 60;
    let minimumPrice = minimumHours * serviceBasePrice; // 2 hours × actual service base price

    // Apply minimum if calculated price is below it
    if (totalEstimate < minimumPrice) {
      totalEstimate = minimumPrice;
    }

    // Calculate range: base price (flexible) to urgency price
    const basePrice = Math.round(totalEstimate); // Base price without urgency

    // Apply urgency multiplier for max estimate
    const urgencyMultipliers = {
      'flexible': 1.0,
      'within_week': 1.1,
      'within_3_days': 1.25,
      'urgent_24h': 1.5
    };

    const urgencyMultiplier = urgencyMultipliers[quoteData.urgency] || 1.0;
    const urgencyPrice = Math.round(totalEstimate * urgencyMultiplier);

    return {
      min: basePrice,
      max: urgencyPrice
    };
  }

  // Helper functions for email formatting
  function formatUrgency(urgency) {
    const urgencyMap = {
      'flexible': 'Flexible timing',
      'within_week': 'Within 1 week',
      'within_3_days': 'Within 3 days',
      'urgent_24h': 'Urgent (within 24 hours)'
    };
    return urgencyMap[urgency] || urgency;
  }

  function formatPaymentMethod(method) {
    const methodMap = {
      'credit_card': 'Credit Card',
      'invoice': 'Invoice (Net 30)',
      'bank_transfer': 'Bank Transfer/EFT'
    };
    return methodMap[method] || method;
  }
  
  // Show quote success
  function showQuoteSuccess(quoteRecord) {
    const quoteEmail = document.getElementById('quoteEmail')?.value || '';
    const referenceId = quoteRecord && quoteRecord.booking_id ? quoteRecord.booking_id : 'QUOTE-' + Date.now().toString().substring(-6);
    
    const successDiv = document.createElement('div');
    successDiv.className = 'quote-success';
    successDiv.innerHTML = `
      <h3>✅ Quote Request Submitted Successfully!</h3>
      <p>Thank you for your interest. We'll review your requirements and send you a detailed quote within 2 business hours.</p>
      <p><strong>Reference ID:</strong> ${referenceId}</p>
      <p>A confirmation email will be sent to ${quoteEmail}</p>
    `;
    
    const submitBtn = document.getElementById('submitQuoteBtn');
    submitBtn.parentNode.insertBefore(successDiv, submitBtn);
    submitBtn.style.display = 'none';
  }
  
  // Show quote error
  function showQuoteError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'quote-error';
    errorDiv.innerHTML = `<h3>❌ Error</h3><p>${message}</p>`;
    
    const submitBtn = document.getElementById('submitQuoteBtn');
    submitBtn.parentNode.insertBefore(errorDiv, submitBtn);
  }

  // Duplicate initialization removed - already handled in main DOMContentLoaded

  // Initialize Google Places Autocomplete
  console.log('🔍 Checking Google Maps API availability...');
  console.log('Google object available:', !!window.google);
  console.log('Google Maps available:', !!(window.google && window.google.maps));
  console.log('Places API available:', !!(window.google && window.google.maps && window.google.maps.places));
  
  // Simple initialization - try immediately, then on window load if needed
  if (window.google && window.google.maps && window.google.maps.places) {
    console.log('✅ Google Maps API ready, initializing autocomplete...');
    initAutocomplete();
  } else {
    console.log('⏳ Google Maps API not ready, waiting for window load...');
    window.addEventListener('load', function () {
      console.log('🔄 Window loaded, checking Google Maps again...');
      if (window.google && window.google.maps && window.google.maps.places) {
        console.log('✅ Google Maps API now ready, initializing autocomplete...');
        initAutocomplete();
      } else {
        console.error('❌ Google Maps API still not available after window load');
        // Remove status message
      }
    });
  }

  // Business Name field logic removed - booking type now handled in Step 0
});

// Google Places Autocomplete for Address
let autocompleteInitialized = false;
let coverageCheckTimeout = null;

function initAutocomplete() {
  // Prevent multiple initializations
  if (autocompleteInitialized) {
    console.log('⚠️ Autocomplete already initialized, skipping...');
    return;
  }

  const addressInput = document.getElementById('address');
  const statusDiv = document.getElementById('address-autocomplete-status');
  
  console.log('🔍 Initializing Google Maps Autocomplete...');
  console.log('Address input found:', !!addressInput);
  console.log('Google Maps available:', !!(window.google && window.google.maps));
  console.log('Places API available:', !!(window.google && window.google.maps && window.google.maps.places));
  
  if (!addressInput) {
    console.error('❌ Address input element not found');
    return;
  }
  
  if (!window.google) {
    console.error('❌ Google Maps API not loaded');
    return;
  }
  
  if (!window.google.maps) {
    console.error('❌ Google Maps library not available');
    return;
  }
  
  if (!window.google.maps.places) {
    console.error('❌ Google Places API not available');
    return;
  }
  
  try {
    // Use a session token for better prediction quality
    const sessionToken = new google.maps.places.AutocompleteSessionToken();
    console.log('✅ Session token created');
    
    const autocomplete = new google.maps.places.Autocomplete(addressInput, {
      // types: ['geocode'], // Removed to allow hotels, POIs, etc.
      componentRestrictions: { country: 'au' },
      sessionToken: sessionToken
    });
    console.log('✅ Autocomplete instance created');
    
    autocomplete.addListener('place_changed', function () {
      console.log('📍 Place selection triggered');
      const place = autocomplete.getPlace();
      console.log('Selected place:', place);

      if (place && place.geometry) {
        let cleanAddress = place.formatted_address || addressInput.value;

        // Only use place.name as business name if it's actually a business/establishment
        // Exclude residential addresses (street_address, premise, subpremise)
        let businessName = '';
        const types = place.types || [];
        const isResidential = types.some(type =>
          ['street_address', 'premise', 'subpremise', 'route'].includes(type)
        );
        const isBusiness = types.some(type =>
          ['lodging', 'hotel', 'establishment', 'point_of_interest', 'hospital', 'shopping_mall', 'store'].includes(type)
        );

        // Only set business name if it's a business and not a residential address
        if (isBusiness && !isResidential && place.name) {
          businessName = place.name;
        }

        // If the formatted address starts with the business name, remove it
        if (businessName && cleanAddress.startsWith(businessName)) {
          cleanAddress = cleanAddress.substring(businessName.length).replace(/^[,\s]+/, '');
        }

        const selected = {
          name: businessName,
          address: cleanAddress,
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng()
        };
        addressInput.value = selected.address;
        addressInput.dataset.lat = selected.lat;
        addressInput.dataset.lng = selected.lng;
        addressInput.dataset.businessName = selected.name;
        addressInput.dataset.verified = 'true';

        // Store business name globally as backup
        window.selectedBusinessName = selected.name;

        console.log('✅ Address selected:', selected);

        // Show debug message on page
        if (statusDiv) {
          statusDiv.innerHTML = `<small style="color: #666;">🔍 DEBUG: Selected "${selected.name}" at (${selected.lat.toFixed(4)}, ${selected.lng.toFixed(4)}). Checking coverage in 500ms...</small>`;
          statusDiv.className = 'status-message';
          statusDiv.style.display = 'block';
        }

        // Clear any pending coverage checks
        clearTimeout(coverageCheckTimeout);

        // Debounce coverage check to ensure coordinates are properly set
        coverageCheckTimeout = setTimeout(() => {
          console.log('🕐 Debounce delay complete, running coverage check...');
          checkTherapistCoverageForAddress();
        }, 500); // 500ms delay to ensure everything is set
      } else {
        console.warn('⚠️ Place selected but no geometry available');
        if (statusDiv) {
          statusDiv.innerHTML = '<small style="color: #f59e0b;">⚠️ DEBUG: No location data available for this selection. Please try another address.</small>';
          statusDiv.className = 'status-message';
          statusDiv.style.display = 'block';
        }
      }
    });
    
    console.log('✅ Google Maps Autocomplete initialized successfully');
    autocompleteInitialized = true;
    
  } catch (error) {
    console.error('❌ Error initializing Google Maps Autocomplete:', error);
    
    // Fallback: Allow manual address entry
    console.log('🔄 Setting up manual address entry fallback...');
    
    // Add manual address validation
    addressInput.addEventListener('blur', function() {
      if (addressInput.value.trim()) {
        console.log('📝 Manual address entered:', addressInput.value);
        
        // Check if we have coordinates (from autocomplete)
        if (addressInput.dataset.lat && addressInput.dataset.lng) {
          addressInput.dataset.verified = 'true';
          // Check therapist coverage (this will set the appropriate message)
          checkTherapistCoverageForAddress();
        } else {
          // Try to geocode the address manually to see if it's valid
          verifyAddressManually(addressInput.value.trim());
        }
      } else {
        // Clear status when address is empty
        const statusDiv = document.getElementById('address-autocomplete-status');
        if (statusDiv) {
          statusDiv.className = 'status-message';
          statusDiv.style.display = 'none';
        }
        addressInput.dataset.verified = 'false';
      }
    });
  }
}

// Add this function to check therapist geolocation coverage after address selection
async function checkTherapistCoverageForAddress() {
  const addressInput = document.getElementById('address');
  const address = addressInput.value;
  const statusDiv = document.getElementById('address-autocomplete-status');
  if (!address) return;

  // Get coordinates from autocomplete or geocode manually
  let lat = addressInput.dataset.lat ? Number(addressInput.dataset.lat) : null;
  let lng = addressInput.dataset.lng ? Number(addressInput.dataset.lng) : null;

  // Validate coordinates exist before proceeding
  if (!lat || !lng) {
    console.log('⏳ DEBUG: No coordinates available yet. Lat:', lat, 'Lng:', lng);
    if (statusDiv) {
      statusDiv.innerHTML = '<small style="color: #f59e0b;">⏳ DEBUG: Waiting for location coordinates... Please select from dropdown.</small>';
      statusDiv.className = 'status-message';
      statusDiv.style.display = 'block';
    }
    return; // Exit early - wait for user to select from dropdown
  }

  console.log('✅ DEBUG: Coordinates validated:', { lat, lng });

  // Show checking status
  if (statusDiv) {
    statusDiv.innerHTML = `<small style="color: #3b82f6;">🔄 DEBUG: Checking therapist coverage at (${lat.toFixed(4)}, ${lng.toFixed(4)})...</small>`;
    statusDiv.className = 'status-message';
    statusDiv.style.display = 'block';
  }
  // Fetch all active therapists with lat/lng, service_radius_km, and service_area_polygon
  let { data, error } = await window.supabase
    .from('therapist_profiles')
    .select('id, latitude, longitude, service_radius_km, service_area_polygon, is_active')
    .eq('is_active', true);

  console.log('🔍 Checking therapist coverage for coordinates:', { lat, lng });
  console.log('📊 Found therapists:', data?.length || 0);

  if (!data || data.length === 0) {
    console.log('❌ No active therapists found in database');
    updateAddressStatus("Sorry... we don't have any therapists available in your area right now.", 'error');
    disableContinueFromAddress();
    return;
  }

  // Point-in-polygon check using ray-casting algorithm
  function isPointInPolygon(point, polygon) {
    if (!polygon || polygon.length < 3) return false;

    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].lng, yi = polygon[i].lat;
      const xj = polygon[j].lng, yj = polygon[j].lat;

      const intersect = ((yi > point.lat) !== (yj > point.lat))
        && (point.lng < (xj - xi) * (point.lat - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  // Haversine formula for distance calculation
  function getDistanceKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  const covered = data.some(t => {
    if (t.latitude == null || t.longitude == null) {
      console.log('⚠️ Therapist missing location data:', t.id);
      return false;
    }

    // Check polygon first if it exists
    if (t.service_area_polygon && Array.isArray(t.service_area_polygon) && t.service_area_polygon.length >= 3) {
      const inPolygon = isPointInPolygon({ lat, lng }, t.service_area_polygon);
      console.log(`📍 Therapist ${t.id}: polygon check = ${inPolygon}`);
      if (inPolygon) return true;
    }

    // Fall back to radius check
    if (t.service_radius_km != null) {
      const dist = getDistanceKm(lat, lng, t.latitude, t.longitude);
      console.log(`📍 Therapist ${t.id}: distance ${dist.toFixed(2)}km, radius ${t.service_radius_km}km`);
      return dist <= t.service_radius_km;
    }

    return false;
  });
  
  console.log('✅ Coverage check result:', covered);

  if (!covered) {
    const statusDiv = document.getElementById('address-autocomplete-status');
    if (statusDiv) {
      statusDiv.innerHTML = `<small style="color: #ef4444;">❌ DEBUG: No therapists available (checked ${data?.length || 0} therapists)</small><br>Sorry... we don't have any therapists available in your area right now.`;
      statusDiv.className = 'status-message error';
      statusDiv.style.display = 'block';
    }
    updateAddressStatus("Sorry... we don't have any therapists available in your area right now.", 'error');
    disableContinueFromAddress();
  } else {
    const statusDiv = document.getElementById('address-autocomplete-status');
    const businessName = window.selectedBusinessName || '';
    if (statusDiv) {
      statusDiv.innerHTML = `<small style="color: #10b981;">✅ DEBUG: Coverage confirmed! Business: "${businessName}"</small><br>Great news, we have therapists available in your area. Choose your service next.`;
      statusDiv.className = 'status-message verified';
      statusDiv.style.display = 'block';
    }
    updateAddressStatus('Great news, we have therapists available in your area. Choose your service next.', 'verified');
    enableContinueFromAddress();
  }
}

function disableContinueFromAddress() {
  const btn = document.querySelector('#step1 .btn.next');
  if (btn) btn.disabled = true;
}
function enableContinueFromAddress() {
  const btn = document.querySelector('#step1 .btn.next');
  if (btn) btn.disabled = false;
}

// Add this function to check therapist gender availability after gender selection
async function checkTherapistGenderAvailability() {
  const genderVal = document.querySelector('input[name="genderPref"]:checked')?.value;
  const addressInput = document.getElementById('address');
  const lat = addressInput.dataset.lat ? Number(addressInput.dataset.lat) : null;
  const lng = addressInput.dataset.lng ? Number(addressInput.dataset.lng) : null;
  const statusDiv = document.getElementById('gender-availability-status');
  if (!genderVal || !lat || !lng) return;
  // Fetch all active therapists with lat/lng, gender, service_radius_km, and service_area_polygon
  let { data, error } = await window.supabase
    .from('therapist_profiles')
    .select('id, latitude, longitude, service_radius_km, service_area_polygon, is_active, gender')
    .eq('is_active', true);

  console.log('🔍 Checking gender availability for coordinates:', { lat, lng, gender: genderVal });
  console.log('📊 Found therapists:', data?.length || 0);

  if (!data || data.length === 0) {
    console.log('❌ No active therapists found in database');
    statusDiv.textContent = 'Sorry, we do not have any therapists available.';
    disableContinueFromGender();
    return;
  }

  // Point-in-polygon check using ray-casting algorithm
  function isPointInPolygon(point, polygon) {
    if (!polygon || polygon.length < 3) return false;

    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].lng, yi = polygon[i].lat;
      const xj = polygon[j].lng, yj = polygon[j].lat;

      const intersect = ((yi > point.lat) !== (yj > point.lat))
        && (point.lng < (xj - xi) * (point.lat - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  // Haversine formula for distance calculation
  function getDistanceKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // Filter therapists by geolocation (polygon first, then radius fallback)
  const coveredTherapists = data.filter(t => {
    if (t.latitude == null || t.longitude == null) {
      console.log('⚠️ Therapist missing location data:', t.id);
      return false;
    }

    // Check polygon first if it exists
    if (t.service_area_polygon && Array.isArray(t.service_area_polygon) && t.service_area_polygon.length >= 3) {
      const inPolygon = isPointInPolygon({ lat, lng }, t.service_area_polygon);
      console.log(`📍 Therapist ${t.id} (${t.gender}): polygon check = ${inPolygon}`);
      if (inPolygon) return true;
    }

    // Fall back to radius check
    if (t.service_radius_km != null) {
      const dist = getDistanceKm(lat, lng, t.latitude, t.longitude);
      console.log(`📍 Therapist ${t.id} (${t.gender}): distance ${dist.toFixed(2)}km, radius ${t.service_radius_km}km`);
      return dist <= t.service_radius_km;
    }

    return false;
  });
  
  console.log('✅ Therapists in coverage area:', coveredTherapists.length);
  
  // Filter by gender (if not 'any')
  let genderedTherapists = coveredTherapists;
  if (genderVal !== 'any') {
    genderedTherapists = coveredTherapists.filter(t => t.gender === genderVal);
    console.log(`✅ Therapists matching gender preference (${genderVal}):`, genderedTherapists.length);
  }
  
  if (genderedTherapists.length === 0) {
    console.log('❌ No therapists available for selected criteria');
    statusDiv.textContent = 'Sorry, we do not have any therapists available for your preferences.';
    disableContinueFromGender();
  } else {
    console.log('✅ Therapists available for booking');
    statusDiv.textContent = '';
    enableContinueFromGender();
  }
}

function disableContinueFromGender() {
  const btn = document.querySelector('#step3 .btn.next');
  if (btn) btn.disabled = true;
}
function enableContinueFromGender() {
  const btn = document.querySelector('#step3 .btn.next');
  if (btn) btn.disabled = false;
}

// Add a status div to the gender step if not present
const genderStep = document.getElementById('step3');
if (genderStep && !document.getElementById('gender-availability-status')) {
  const statusDiv = document.createElement('div');
  statusDiv.id = 'gender-availability-status';
  statusDiv.style.color = '#b00';
  statusDiv.style.fontSize = '0.95rem';
  statusDiv.style.marginTop = '0.3rem';
  genderStep.querySelector('.step-content').appendChild(statusDiv);
}
// Listen for gender change
const genderRadios = document.querySelectorAll('input[name="genderPref"]');
genderRadios.forEach(radio => radio.addEventListener('change', checkTherapistGenderAvailability));

// Listen for address change or autocomplete selection
const addressInput = document.getElementById('address');
addressInput.addEventListener('blur', checkTherapistCoverageForAddress);
// If using autocomplete, also set lat/lng as data attributes on addressInput

// Helper: get available time slots for a therapist on a given day
async function getAvailableSlotsForTherapist(therapist, date, durationMinutes) {
  if (
    window.businessOpeningHour === undefined ||
    window.businessClosingHour === undefined ||
    window.beforeServiceBuffer === undefined ||
    window.afterServiceBuffer === undefined ||
    window.minBookingAdvanceHours === undefined
  ) {
    console.warn('Business hours, buffer times, or advance booking hours are not set! Check system_settings and fetchSettings().');
    return [];
  }
  console.log('getAvailableSlotsForTherapist called for therapist:', therapist, 'date:', date, 'duration:', durationMinutes);
  // 1. Get working hours for the day
  const dayOfWeek = new Date(date).getDay();
  const { data: availabilities } = await window.supabase
    .from('therapist_availability')
    .select('start_time, end_time')
    .eq('therapist_id', therapist.id)
    .eq('day_of_week', dayOfWeek);
  if (!availabilities || availabilities.length === 0) return [];
  const { start_time, end_time } = availabilities[0];

  // 2. Get existing bookings for the day
  const { data: bookings } = await window.supabase
    .from('bookings')
    .select('booking_time, service_id')
    .eq('therapist_id', therapist.id)
    .gte('booking_time', date + 'T00:00:00')
    .lt('booking_time', date + 'T23:59:59');

  // 3. Build all possible slots (hourly, businessOpeningHour to businessClosingHour)
  const slots = [];
  for (let hour = window.businessOpeningHour; hour <= window.businessClosingHour; hour++) {
    const slotStart = `${hour.toString().padStart(2, '0')}:00`;
    // Check if slot is within working hours
    if (slotStart < start_time || slotStart >= end_time) continue;
    // Check for overlap with existing bookings (including before/after buffer)
    const slotStartDate = new Date(date + 'T' + slotStart);
    const slotEndDate = new Date(slotStartDate.getTime() + durationMinutes * 60000 + window.afterServiceBuffer * 60000);
    let overlaps = false;
    for (const booking of bookings || []) {
      const bookingStart = new Date(booking.booking_time);
      // Get buffer for this booking's service
      let bookingBufferBefore = window.beforeServiceBuffer;
      let bookingBufferAfter = window.afterServiceBuffer;
      if (booking.service_id && window.servicesCache) {
        const svc = window.servicesCache.find(s => s.id === booking.service_id);
        if (svc && svc.buffer_time) bookingBufferAfter = Number(svc.buffer_time);
      }
      const bookingEnd = new Date(bookingStart.getTime() + durationMinutes * 60000 + bookingBufferAfter * 60000);
      const bookingStartWithBuffer = new Date(bookingStart.getTime() - bookingBufferBefore * 60000);
      if (
        (slotStartDate < bookingEnd && slotEndDate > bookingStartWithBuffer)
      ) {
        overlaps = true;
        break;
      }
    }
    if (!overlaps) slots.push(slotStart);
  }
  return slots;
}

// Render time slots as buttons instead of dropdown
function renderTimeSlots(slots, selectedSlot) {
  const container = document.getElementById('timeSlotsContainer');
  if (!container) return;
  container.innerHTML = '';
  if (!slots.length) {
    // Show helpful message prompting user to select a different day
    container.innerHTML = `
      <div style="
        padding: 20px;
        background: #fef2f2;
        border: 2px solid #fecaca;
        border-radius: 8px;
        text-align: center;
        margin: 16px 0;
      ">
        <div style="font-size: 18px; margin-bottom: 8px;">⚠️</div>
        <div style="color: #991b1b; font-weight: 600; font-size: 16px; margin-bottom: 8px;">
          No available time slots for this date
        </div>
        <div style="color: #b91c1c; font-size: 14px;">
          Please try selecting a different date, or contact us for assistance.
        </div>
      </div>
    `;
    return;
  }
  slots.forEach(slot => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'time-slot-btn' + (slot === selectedSlot ? ' selected' : '');
    btn.textContent = slot;
    btn.onclick = () => {
      const timeInput = document.getElementById('time');
      timeInput.value = slot;
      // Manually dispatch a 'change' event so that listeners (like calculatePrice and updateTherapistSelection) will fire
      timeInput.dispatchEvent(new Event('change'));

      renderTimeSlots(slots, slot);
      // Therapist selection update is now handled by the 'change' event listener on the #time input
    };
    container.appendChild(btn);
  });
}

// Add a hidden input for time value
if (!document.getElementById('time')) {
  const timeInput = document.createElement('input');
  timeInput.type = 'hidden';
  timeInput.id = 'time';
  document.querySelector('#timeSlotsContainer').parentNode.appendChild(timeInput);
}

// Update updateAvailableTimeSlots to use renderTimeSlots
async function updateAvailableTimeSlots() {
  const container = document.getElementById('timeSlotsContainer');
  const dateVal = document.getElementById('date').value;
  if (container) {
    if (dateVal) {
      container.innerHTML = `<div class="spinner-container"><svg class="egg-timer" width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg"><g><ellipse cx="20" cy="12" rx="10" ry="6" stroke="#00729B" stroke-width="3"/><ellipse cx="20" cy="28" rx="10" ry="6" stroke="#00729B" stroke-width="3"/><path d="M10 12 Q20 20 30 12" stroke="#00729B" stroke-width="3" fill="none"><animateTransform attributeName="transform" type="rotate" from="0 20 20" to="360 20 20" dur="1.2s" repeatCount="indefinite"/></path></g></svg></div>`;
    } else {
      container.innerHTML = '';
    }
  }
  console.log('updateAvailableTimeSlots called, globals:', {
    businessOpeningHour: window.businessOpeningHour,
    businessClosingHour: window.businessClosingHour,
    beforeServiceBuffer: window.beforeServiceBuffer,
    afterServiceBuffer: window.afterServiceBuffer,
    minBookingAdvanceHours: window.minBookingAdvanceHours
  });
  if (
    window.businessOpeningHour === undefined ||
    window.businessClosingHour === undefined ||
    window.beforeServiceBuffer === undefined ||
    window.afterServiceBuffer === undefined ||
    window.minBookingAdvanceHours === undefined
  ) {
    console.warn('Business hours or buffer times are not set! Waiting for settings to load.');
    return;
  }
  // Define these variables first - updated for card-based selection:
  const serviceId = window.selectedServiceId || document.getElementById('service')?.value;
  const durationVal = document.getElementById('duration').value;
  const genderVal = document.querySelector('input[name="genderPref"]:checked')?.value;
  // Now log them:
  console.log('Selected serviceId:', serviceId, 'Selected genderVal:', genderVal);
  if (!serviceId || !durationVal || !dateVal || !genderVal) return;

  // 1. Get buffer_time for selected service (not used here, but could be for after buffer)
  const durationMinutes = Number(durationVal);

  // 2. Get all therapists who match service and gender (with location data)
  const { data: therapistLinks } = await window.supabase
    .from('therapist_services')
    .select('therapist_id, therapist:therapist_id (id, gender, is_active, latitude, longitude, service_radius_km, service_area_polygon)')
    .eq('service_id', serviceId);
  console.log('Raw therapistLinks from Supabase:', therapistLinks);
  let therapists = (therapistLinks || []).map(row => row.therapist).filter(t => t && t.is_active);
  if (genderVal !== 'any') therapists = therapists.filter(t => t.gender === genderVal);

  // Filter by location (polygon first, then radius fallback)
  const addressInput = document.getElementById('address');
  const customerLat = addressInput.dataset.lat ? Number(addressInput.dataset.lat) : null;
  const customerLng = addressInput.dataset.lng ? Number(addressInput.dataset.lng) : null;

  if (customerLat && customerLng) {
    // Point-in-polygon check
    function isPointInPolygon(point, polygon) {
      if (!polygon || polygon.length < 3) return false;
      let inside = false;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].lng, yi = polygon[i].lat;
        const xj = polygon[j].lng, yj = polygon[j].lat;
        const intersect = ((yi > point.lat) !== (yj > point.lat))
          && (point.lng < (xj - xi) * (point.lat - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
      }
      return inside;
    }

    // Distance calculation
    function getDistanceKm(lat1, lng1, lat2, lng2) {
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    }

    therapists = therapists.filter(t => {
      if (!t.latitude || !t.longitude) return false;

      // Check polygon first
      if (t.service_area_polygon && Array.isArray(t.service_area_polygon) && t.service_area_polygon.length >= 3) {
        const inPolygon = isPointInPolygon({ lat: customerLat, lng: customerLng }, t.service_area_polygon);
        console.log(`📍 Time slot filter - Therapist ${t.id}: polygon check = ${inPolygon}`);
        if (inPolygon) return true;
      }

      // Fallback to radius
      if (t.service_radius_km != null) {
        const dist = getDistanceKm(customerLat, customerLng, t.latitude, t.longitude);
        console.log(`📍 Time slot filter - Therapist ${t.id}: distance ${dist.toFixed(2)}km, radius ${t.service_radius_km}km`);
        return dist <= t.service_radius_km;
      }

      return false;
    });
  }

  // Deduplicate therapists to avoid redundant checks
  const uniqueTherapists = [...new Map(therapists.map(t => [t.id, t])).values()];
  console.log('Therapists after filtering & deduplication:', uniqueTherapists);

  // 3. For each therapist, get available slots
  let allSlots = [];
  for (const therapist of uniqueTherapists) {
    const slots = await getAvailableSlotsForTherapist(therapist, dateVal, durationMinutes);
    allSlots = allSlots.concat(slots);
  }
  console.log('All slots before deduplication:', allSlots);
  // 4. Deduplicate and sort
  const uniqueSlots = Array.from(new Set(allSlots)).sort();
  console.log('Unique available slots:', uniqueSlots);

  // 5. Filter out past slots if the selected date is today
  const today = new Date();
  const selectedDate = new Date(dateVal + 'T00:00:00'); // Use T00:00:00 to avoid timezone issues
  let finalSlots = uniqueSlots;

  if (selectedDate.getFullYear() === today.getFullYear() &&
    selectedDate.getMonth() === today.getMonth() &&
    selectedDate.getDate() === today.getDate()) {
    
    const now = new Date();
    now.setHours(now.getHours() + (window.minBookingAdvanceHours || 0));
    
    let earliestBookingHour = now.getHours();
    // If there are any minutes, round up to the next hour
    if (now.getMinutes() > 0 || now.getSeconds() > 0 || now.getMilliseconds() > 0) {
        earliestBookingHour++;
    }

    finalSlots = uniqueSlots.filter(slot => {
        const slotHour = parseInt(slot.split(':')[0], 10);
        return slotHour >= earliestBookingHour;
    });
    console.log(`Today's slots filtered. Earliest hour: ${earliestBookingHour}. Final slots:`, finalSlots);
  }

  // 6. Update time slots as buttons
  const timeInput = document.getElementById('time');
  if (finalSlots.length === 0) {
    renderTimeSlots([], '');
    timeInput.value = '';
    // Remove red error messages - just leave container empty
  } else {
    renderTimeSlots(finalSlots, timeInput.value);
  }
}

// Add this function to update the therapist selection UI
async function updateTherapistSelection() {
  const serviceId = window.selectedServiceId || document.getElementById('service')?.value;
  const durationVal = document.getElementById('duration').value;
  const dateVal = document.getElementById('date').value;
  const timeVal = document.getElementById('time').value;
  const genderVal = document.querySelector('input[name="genderPref"]:checked')?.value;
  const therapistSelectionDiv = document.getElementById('therapistSelection');
  therapistSelectionDiv.innerHTML = '';
  if (!serviceId || !durationVal || !dateVal || !timeVal || !genderVal) return;

  // Get all therapists who match service and gender (with location data)
  const { data: therapistLinks } = await window.supabase
    .from('therapist_services')
    .select(`
      therapist_id,
      therapist_profiles!therapist_id (id, first_name, last_name, gender, is_active, profile_pic, latitude, longitude, service_radius_km, service_area_polygon)
    `)
    .eq('service_id', serviceId);
  let therapists = (therapistLinks || []).map(row => ({
    ...row.therapist_profiles
  })).filter(t => t && t.is_active);
  if (genderVal !== 'any') therapists = therapists.filter(t => t.gender === genderVal);

  // Filter by location (polygon first, then radius fallback)
  const addressInput = document.getElementById('address');
  const customerLat = addressInput.dataset.lat ? Number(addressInput.dataset.lat) : null;
  const customerLng = addressInput.dataset.lng ? Number(addressInput.dataset.lng) : null;

  if (customerLat && customerLng) {
    // Point-in-polygon check
    function isPointInPolygon(point, polygon) {
      if (!polygon || polygon.length < 3) return false;
      let inside = false;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].lng, yi = polygon[i].lat;
        const xj = polygon[j].lng, yj = polygon[j].lat;
        const intersect = ((yi > point.lat) !== (yj > point.lat))
          && (point.lng < (xj - xi) * (point.lat - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
      }
      return inside;
    }

    // Distance calculation
    function getDistanceKm(lat1, lng1, lat2, lng2) {
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    }

    therapists = therapists.filter(t => {
      if (!t.latitude || !t.longitude) return false;

      // Check polygon first
      if (t.service_area_polygon && Array.isArray(t.service_area_polygon) && t.service_area_polygon.length >= 3) {
        const inPolygon = isPointInPolygon({ lat: customerLat, lng: customerLng }, t.service_area_polygon);
        console.log(`📍 Therapist selection filter - Therapist ${t.id}: polygon check = ${inPolygon}`);
        if (inPolygon) return true;
      }

      // Fallback to radius
      if (t.service_radius_km != null) {
        const dist = getDistanceKm(customerLat, customerLng, t.latitude, t.longitude);
        console.log(`📍 Therapist selection filter - Therapist ${t.id}: distance ${dist.toFixed(2)}km, radius ${t.service_radius_km}km`);
        return dist <= t.service_radius_km;
      }

      return false;
    });
  }

  // Deduplicate therapists by id (fix for triplicates)
  const uniqueTherapists = Object.values(therapists.reduce((acc, t) => {
    if (t && t.id) acc[t.id] = t;
    return acc;
  }, {}));

  // For each therapist, check if they are available for the selected slot
  const availableTherapists = [];
  for (const therapist of uniqueTherapists) {
    const slots = await getAvailableSlotsForTherapist(therapist, dateVal, Number(durationVal));
    if (slots.includes(timeVal)) {
      availableTherapists.push(therapist);
    }
  }

  if (availableTherapists.length === 0) {
    therapistSelectionDiv.innerHTML = '<p>No therapists available for this slot.</p>';
    return;
  }

  // Render therapists as cards with images and bios
  availableTherapists.forEach(t => {
    const card = document.createElement('div');
    card.className = 'therapist-card';
    card.dataset.therapistId = t.id;
    
    card.innerHTML = `
      <div class="therapist-info">
        <div class="therapist-image">
          <img src="${t.profile_pic || '/images/default-therapist.svg'}"
               alt="${t.first_name} ${t.last_name}"
               class="therapist-profile-pic"
               onerror="this.src='/images/default-therapist.svg'">
        </div>
        <div class="therapist-details">
          <div class="therapist-name">
            <span>${t.first_name} ${t.last_name}</span>
            <button type="button" class="read-more-btn" onclick="toggleTherapistBio('${t.id}')">Read More</button>
          </div>
          <div class="therapist-bio" id="bio-${t.id}"></div>
        </div>
        <input type="radio" name="therapistId" value="${t.id}" data-name="${t.first_name} ${t.last_name}" style="position: absolute; opacity: 0; pointer-events: none;">
      </div>
    `;
    
    // Add click handler for the entire card
    card.addEventListener('click', function(e) {
      if (e.target.classList.contains('read-more-btn')) return; // Don't trigger selection when clicking read more
      
      // Remove selection from other cards
      document.querySelectorAll('.therapist-card').forEach(c => c.classList.remove('selected'));
      
      // Select this card
      this.classList.add('selected');
      
      // Check the radio button
      const radio = this.querySelector('input[type="radio"]');
      radio.checked = true;
    });
    
    therapistSelectionDiv.appendChild(card);
  });
}

// Listen for changes to service, duration, date, gender
['service', 'duration', 'date'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('change', updateAvailableTimeSlots);
});
document.querySelectorAll('input[name="genderPref"]').forEach(el => {
  el.addEventListener('change', updateAvailableTimeSlots);
});

// Listen for changes to the time dropdown to update therapist selection
const timeSelect = document.getElementById('time');
timeSelect.addEventListener('change', updateTherapistSelection); 

// Also clear the error if the user changes date, duration, or gender
['service', 'duration', 'date'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('change', function() {
    const err = document.getElementById('time-availability-error');
    if (err) err.textContent = '';
  });
});
document.querySelectorAll('input[name="genderPref"]').forEach(el => {
  el.addEventListener('change', function() {
    const err = document.getElementById('time-availability-error');
    if (err) err.textContent = '';
  });
}); 

// Toggle therapist bio visibility
async function toggleTherapistBio(therapistId) {
  const card = document.querySelector(`[data-therapist-id="${therapistId}"]`);
  const bio = document.getElementById(`bio-${therapistId}`);
  const readMoreBtn = card.querySelector('.read-more-btn');
  
  if (card.classList.contains('expanded')) {
    // Collapse
    card.classList.remove('expanded');
    bio.classList.remove('expanded');
    readMoreBtn.textContent = 'Read More';
  } else {
    // Expand - fetch bio only
    try {
      const { data: therapistData } = await window.supabase
        .from('therapist_profiles')
        .select('bio')
        .eq('id', therapistId)
        .single();
      
      const bioText = therapistData?.bio || 'No bio available';
      
      // Update bio content
      bio.innerHTML = `<p>${bioText}</p>`;
      
      // Expand the card
      card.classList.add('expanded');
      bio.classList.add('expanded');
      readMoreBtn.textContent = 'Show Less';
      
    } catch (error) {
      console.error('Error fetching therapist bio:', error);
      bio.innerHTML = '<p>Error loading bio</p>';
      card.classList.add('expanded');
      bio.classList.add('expanded');
      readMoreBtn.textContent = 'Show Less';
    }
  }
}

// STRIPE INTEGRATION
let stripe, elements, card;
let STRIPE_PUBLISHABLE_KEY = null;
let cardAuthorized = false;
let authorizedPaymentIntentId = null;

// Fetch Stripe publishable key from environment
async function loadStripeKey() {
  try {
    const response = await fetch('/.netlify/functions/get-stripe-key');
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to load Stripe key');
    }
    
    STRIPE_PUBLISHABLE_KEY = data.publishableKey;
    return STRIPE_PUBLISHABLE_KEY;
  } catch (error) {
    console.error('❌ Error loading Stripe key:', error);
    throw error;
  }
}

async function mountStripeCardElement() {
  if (!window.Stripe) {
    return;
  }

  console.log('💳 Mounting Stripe card element...');

  // Clean up existing card element if it exists
  if (card) {
    console.log('🧹 Unmounting existing card element');
    try {
      card.unmount();
      card.destroy();
    } catch (e) {
      console.warn('Error unmounting card:', e);
    }
    card = null;
  }

  // Clear the container
  const cardContainer = document.getElementById('card-element');
  if (cardContainer) {
    cardContainer.innerHTML = '';
  }

  // Load Stripe key if not already loaded
  if (!STRIPE_PUBLISHABLE_KEY) {
    await loadStripeKey();
  }

  // Reuse Stripe instance, only create elements and card
  if (!stripe) {
    stripe = window.Stripe(STRIPE_PUBLISHABLE_KEY);
  }

  elements = stripe.elements();
  card = elements.create('card', {
    hidePostalCode: true,
    style: {
      base: {
        fontSize: '16px',
        color: '#333',
        fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
        '::placeholder': { color: '#888' },
      },
      invalid: { color: '#b00' }
    }
  });

  card.mount('#card-element');
  console.log('✅ Stripe card element mounted successfully');

  // Listen for card validation errors
  card.addEventListener('change', function(event) {
    const displayError = document.getElementById('card-errors');
    if (event.error) {
      displayError.textContent = event.error.message;
    } else {
      displayError.textContent = '';
    }
  });
}

// Authorize card function - moved from step 9
async function authorizeCard() {
  const authorizeBtn = document.getElementById('authorizeCardBtn');
  const statusDiv = document.getElementById('cardAuthStatus');
  const proceedBtn = document.getElementById('proceedToSummaryBtn');

  if (!card) {
    alert('Payment form not ready. Please refresh the page.');
    return false;
  }

  // Disable button and show processing state
  authorizeBtn.disabled = true;
  authorizeBtn.textContent = 'Authorising Card...';
  statusDiv.style.display = 'none';

  try {
    // Gather customer details for billing
    const customerFirstName = document.getElementById('customerFirstName')?.value || '';
    const customerLastName = document.getElementById('customerLastName')?.value || '';
    const customerEmail = document.getElementById('customerEmail')?.value || '';
    const customerPhone = document.getElementById('customerPhone')?.value || '';
    const addressInput = document.getElementById('address');
    const price = document.getElementById('priceAmount').textContent ? parseFloat(document.getElementById('priceAmount').textContent) : null;

    if (!customerEmail || !customerFirstName || !customerLastName || !price) {
      throw new Error('Missing customer information. Please go back and complete all fields.');
    }

    // Step 1: Create payment intent (authorize card)
    console.log('💳 Step 1: Creating payment intent...');
    const authResponse = await fetch('/.netlify/functions/create-payment-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: price,
        currency: 'aud',
        bookingData: {
          customer_email: customerEmail,
          customer_name: `${customerFirstName} ${customerLastName}`,
          service_name: window.selectedService?.name || 'Massage Service',
        }
      })
    });

    if (!authResponse.ok) {
      const errorData = await authResponse.json();
      throw new Error(errorData.error || 'Failed to initialize payment');
    }

    const { client_secret, payment_intent_id } = await authResponse.json();

    // Step 2: Confirm card payment (authorize, don't charge)
    console.log('💳 Step 2: Confirming card payment...');
    const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(client_secret, {
      payment_method: {
        card: card,
        billing_details: {
          name: `${customerFirstName} ${customerLastName}`,
          email: customerEmail,
          phone: customerPhone,
          address: {
            line1: addressInput.value,
          }
        }
      }
    });

    if (stripeError) {
      console.error('❌ Card authorization failed:', stripeError);
      throw new Error(stripeError.message);
    }

    if (paymentIntent.status !== 'requires_capture') {
      throw new Error('Card authorization was not successful. Please try again.');
    }

    console.log('✅ Card authorized successfully:', paymentIntent.id);

    // Store authorization details
    cardAuthorized = true;
    authorizedPaymentIntentId = paymentIntent.id;

    // For recurring bookings, save payment method for future charges
    if (window.recurringBooking?.enabled) {
      console.log('🔄 Recurring booking detected - saving payment method for future charges');

      // Extract payment method from the payment intent
      const paymentMethodId = paymentIntent.payment_method;

      if (paymentMethodId) {
        // Store payment method ID globally for use in booking creation
        window.stripePaymentMethodId = paymentMethodId;
        console.log('✅ Payment method saved:', paymentMethodId);
      } else {
        console.warn('⚠️ Could not extract payment method from payment intent');
      }
    }

    // Update UI to show success
    authorizeBtn.style.display = 'none';
    statusDiv.innerHTML = `
      <div style="background: #f0fdf4; border: 2px solid #86efac; color: #166534;">
        <div style="font-size: 20px; margin-bottom: 8px;">✅</div>
        <div style="font-weight: 700; font-size: 18px; margin-bottom: 8px;">Card Secured Successfully!</div>
        <div style="font-size: 14px; color: #15803d;">
          Your card has been authorized. You won't be charged until a therapist accepts your booking.
        </div>
      </div>
    `;
    statusDiv.style.display = 'block';

    // Enable the "Proceed to Booking Request" button
    proceedBtn.disabled = false;
    proceedBtn.style.opacity = '1';
    proceedBtn.style.cursor = 'pointer';

    return true;

  } catch (error) {
    console.error('❌ Card authorization error:', error);
    
    // Show error status
    statusDiv.innerHTML = `
      <div style="background: #fef2f2; border: 2px solid #fecaca; color: #991b1b;">
        <div style="font-size: 20px; margin-bottom: 8px;">❌</div>
        <div style="font-weight: 700; font-size: 16px; margin-bottom: 8px;">Authorisation Failed</div>
        <div style="font-size: 14px; color: #b91c1c;">
          ${error.message}
        </div>
      </div>
    `;
    statusDiv.style.display = 'block';

    // Re-enable button to allow retry
    authorizeBtn.disabled = false;
    authorizeBtn.textContent = '🔒 Authorise Card';

    return false;
  }
}

// Mount Stripe card when Step 8 is shown
function observeStep8Mount() {
  const step8 = document.getElementById('step8');
  const observer = new MutationObserver(() => {
    if (step8.classList.contains('active') && !document.querySelector('#card-element iframe')) {
      mountStripeCardElement();
    }
  });
  observer.observe(step8, { attributes: true, attributeFilter: ['class'] });
}
observeStep8Mount();

// Add event listener for authorize card button
document.addEventListener('DOMContentLoaded', function() {
  const authorizeBtn = document.getElementById('authorizeCardBtn');
  if (authorizeBtn) {
    authorizeBtn.addEventListener('click', function(e) {
      e.preventDefault();
      authorizeCard();
    });
  }
});

// Populate booking summary in Step 9
async function populateBookingSummary() {
  const summaryDiv = document.getElementById('bookingSummaryDetails');
  if (!summaryDiv) return;
  
  // Generate booking ID if not already generated
  if (!window.lastBookingId) {
    window.lastBookingId = await generateSequentialBookingId();
  }
  
  // Gather details
  const addressInput = document.getElementById('address');

  // Get business name from Google Places
  let businessName = addressInput.dataset.businessName || window.selectedBusinessName || '';

  // Determine booking type based on presence of business name
  let bookingType;
  if (businessName) {
    bookingType = 'Hotel/Accommodation';
  } else {
    bookingType = 'In-home';
  }

  let businessLabel = businessName ? 'Hotel Name' : '';

  console.log('📍 DEBUG: Business name:', businessName, '| Booking type:', bookingType);
  const address = addressInput.value;
  const service = window.selectedService?.name || 'Selected Service';
  const duration = document.getElementById('duration').value;
  const gender = document.querySelector('input[name="genderPref"]:checked')?.value || '';
  const date = document.getElementById('date').value;
  const time = document.getElementById('time').value;
  const parking = document.getElementById('parking').value;
  const therapist = document.querySelector('input[name="therapistId"]:checked')?.dataset?.name || '';
  const therapistId = document.querySelector('input[name="therapistId"]:checked')?.value || '';
  const customerName = (document.getElementById('customerFirstName')?.value || '') + ' ' + (document.getElementById('customerLastName')?.value || '');
  const customerEmail = document.getElementById('customerEmail')?.value || '';
  const customerPhone = document.getElementById('customerPhone')?.value || '';
  const roomNumber = document.getElementById('roomNumber')?.value || '';
  const bookerName = document.getElementById('bookerName')?.value || '';
  const notes = document.getElementById('notes')?.value || '';
  const price = document.getElementById('priceAmount').textContent;
  const priceBreakdown = document.getElementById('priceBreakdown').innerHTML;

  // Debug: Log therapist selection
  console.log('🔍 Therapist selection debug:', {
    selectedRadio: document.querySelector('input[name="therapistId"]:checked'),
    therapistName: therapist,
    therapistId: therapistId,
    allTherapistRadios: document.querySelectorAll('input[name="therapistId"]')
  });

  // Calculate therapist fee (async call with therapist-specific rates)
  const therapist_fee = await calculateTherapistFee(date, time, duration, therapistId);
  const therapist_fee_display = therapist_fee ? `$${therapist_fee.toFixed(2)}` : 'N/A';
  // Get customer_id and booking_id if available
  const customer_id = window.lastBookingCustomerId || '';
  const booking_id = window.lastBookingId || '';
  const customer_code = window.lastCustomerCode || '';

  // Check for recurring booking
  const isRecurring = window.recurringBooking?.enabled || false;
  const recurringSessionsHTML = isRecurring ? generateRecurringSessionsHTML() : '';

  summaryDiv.innerHTML = `
    <h3>Booking Details</h3>
    ${booking_id ? `<p><strong>Booking ID:</strong> ${booking_id}</p>` : ''}
    ${customer_code ? `<p><strong>Customer Code:</strong> ${customer_code}</p>` : ''}
    ${businessName ? `<p><strong>${businessLabel}:</strong> ${businessName}</p>` : ''}
    <p><strong>Address:</strong> ${address}</p>
    <p><strong>Service:</strong> ${service}</p>
    <p><strong>Duration:</strong> ${window.getDurationLabel(parseInt(duration))}</p>
    <p><strong>Therapist Gender Preference:</strong> ${gender}</p>
    <p><strong>Date & Time:</strong> ${date} at ${time}</p>
    ${recurringSessionsHTML}
    <p><strong>Parking:</strong> ${parking}</p>
    <p><strong>Therapist:</strong> ${therapist || 'Not selected'}</p>
    <p><strong>Name:</strong> ${customerName}</p>
    <p><strong>Email:</strong> ${customerEmail}</p>
    <p><strong>Phone:</strong> ${customerPhone}</p>
    <p><strong>Room Number:</strong> ${roomNumber}</p>
    <p><strong>Booker Name:</strong> ${bookerName}</p>
    <p><strong>Notes:</strong> ${notes}</p>
    <p><strong>Your Service fees:</strong> $${price}</p>
    ${priceBreakdown ? `<div style="margin-left: 20px; font-size: 0.9em; color: #666;">${priceBreakdown}</div>` : ''}
    ${generatePricingSummaryHTML()}
      `;
}

// Generate recurring sessions HTML for booking summary
function generateRecurringSessionsHTML() {
  if (!window.recurringBooking?.enabled || !window.recurringBooking?.dates) {
    return '';
  }

  const dates = window.recurringBooking.dates;
  const count = window.recurringBooking.count;
  const time = document.getElementById('time').value;

  let html = '<div style="background-color: #e3f2fd; padding: 15px; margin: 15px 0; border-radius: 8px; border-left: 4px solid #2196F3;">';
  html += '<h4 style="color: #1976D2; margin-top: 0; margin-bottom: 10px; font-size: 16px;">🔄 Recurring Booking Series</h4>';
  html += `<p style="margin: 5px 0; color: #1565C0; font-weight: 600;">Total Sessions: ${count}</p>`;
  html += '<div style="background-color: #ffffff; padding: 12px; margin-top: 12px; border-radius: 6px;">';
  html += '<h5 style="color: #1976D2; margin-top: 0; margin-bottom: 8px; font-size: 14px;">📅 All Scheduled Sessions:</h5>';
  html += '<ul style="margin: 0; padding-left: 20px; color: #1565C0; font-size: 13px; line-height: 1.8;">';

  dates.forEach((date, index) => {
    const sessionDate = new Date(date);
    const formattedDate = sessionDate.toLocaleDateString('en-AU', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    html += `<li>Session ${index + 1}: ${formattedDate} at ${time}</li>`;
  });

  html += '</ul></div></div>';
  return html;
}

// Generate pricing summary HTML for booking summary
function generatePricingSummaryHTML() {
  const finalPricing = window.pricingState?.finalPricing;
  const appliedDiscount = window.pricingState?.appliedDiscount;
  const appliedGiftCard = window.pricingState?.appliedGiftCard;
  
  if (!finalPricing || (finalPricing.discountAmount === 0 && finalPricing.giftCardAmount === 0)) {
    return '';
  }
  
  let html = '<div style="margin-top: 15px; padding: 15px; background: #f8f9fa; border-left: 3px solid #007e8c; border-radius: 5px;">';
  html += '<h4 style="margin: 0 0 10px 0; color: #007e8c;">Final Pricing Breakdown</h4>';
  
  html += `<div style="display: flex; justify-content: space-between; margin-bottom: 5px;">`;
  html += `<span>Subtotal:</span><span>$${finalPricing.grossPrice.toFixed(2)}</span></div>`;
  
  if (finalPricing.discountAmount > 0) {
    html += `<div style="display: flex; justify-content: space-between; margin-bottom: 5px; color: #10b981;">`;
    html += `<span>Discount (${appliedDiscount.code}):</span><span>-$${finalPricing.discountAmount.toFixed(2)}</span></div>`;
  }
  
  if (finalPricing.giftCardAmount > 0) {
    html += `<div style="display: flex; justify-content: space-between; margin-bottom: 5px; color: #007e8c;">`;
    html += `<span>Gift Card (${appliedGiftCard.code}):</span><span>-$${finalPricing.giftCardAmount.toFixed(2)}</span></div>`;
  }
  
  html += `<div style="display: flex; justify-content: space-between; margin-bottom: 10px;">`;
  html += `<span>GST (10%):</span><span>$${finalPricing.taxAmount.toFixed(2)}</span></div>`;
  
  html += `<hr style="border: 1px solid #ddd; margin: 10px 0;">`;
  html += `<div style="display: flex; justify-content: space-between; font-weight: bold; color: #007e8c; font-size: 1.1em;">`;
  html += `<span>Total Amount:</span><span>$${finalPricing.netPrice.toFixed(2)}</span></div>`;
  
  html += '</div>';
  return html;
}
// Show summary when entering Step 9
const step9 = document.getElementById('step9');
const observer9 = new MutationObserver(() => {
  if (step9.classList.contains('active')) {
    populateBookingSummary().catch(error => {
      console.error('Error populating booking summary:', error);
    });
  }
});
observer9.observe(step9, { attributes: true, attributeFilter: ['class'] });

// Handle booking confirmation on Step 10
const step10 = document.getElementById('step10');
let bookingConfirmationData = null; // Store confirmation data globally

const observer10 = new MutationObserver(() => {
  if (step10.classList.contains('active')) {
    // Show loading/warning message first, then transition to success after delay
    const loadingDiv = document.getElementById('confirmationLoading');
    const successDiv = document.getElementById('confirmationSuccess');
    const detailsDiv = document.getElementById('confirmationDetails');

    // Show loading/warning message immediately
    if (loadingDiv) loadingDiv.style.display = 'block';
    if (successDiv) successDiv.style.display = 'none';
    if (detailsDiv) detailsDiv.style.display = 'none';
    
    // After 5 seconds, hide loading and show success messages
    setTimeout(() => {
      if (loadingDiv) loadingDiv.style.display = 'none';
      if (successDiv) successDiv.style.display = 'block';

      // Update progress bar to 100%
      const progressFill = document.getElementById('progressFill');
      const progressIcon = document.getElementById('progressIcon');
      if (progressFill) progressFill.style.width = '100%';
      if (progressIcon) progressIcon.style.left = '100%';

      // Display confirmation messages
      const messagesDiv = document.getElementById('confirmationMessages');
      if (messagesDiv && bookingConfirmationData) {
        let messagesHTML = '';

        if (bookingConfirmationData.therapistEmailSent) {
          messagesHTML = `
            <p><strong>✓</strong> Card authorized - no charge yet</p>
            <p><strong>✓</strong> Confirmation email sent to you</p>
            <p><strong>✓</strong> Request sent to your selected therapist</p>
            <p style="margin-top: 1rem;">Payment will only be taken when your therapist completes the service.</p>
            <p><strong>You will receive an update within 60 minutes.</strong></p>
          `;
        } else if (bookingConfirmationData.success) {
          messagesHTML = `
            <p><strong>✓</strong> Card authorized - no charge yet</p>
            <p style="margin-top: 1rem;">Payment will only be taken when your therapist completes the service.</p>
            <p>You will receive a confirmation email shortly.</p>
          `;
        } else {
          messagesHTML = `
            <p><strong>✓</strong> Card authorized - no charge yet</p>
            <p style="margin-top: 1rem;">Payment will only be taken when your therapist completes the service.</p>
            <p>However, there was an issue sending email notifications. We will contact you directly.</p>
          `;
        }

        messagesDiv.innerHTML = messagesHTML;
      }
    }, 5000); // 5 second delay
  }
});
observer10.observe(step10, { attributes: true, attributeFilter: ['class'] });

// Helper to generate customer_code
async function generateCustomerCode(surname) {
  if (!surname || surname.length < 1) return null;
  
  // Query for existing CUST codes to find the next number
  const { data: existing, error } = await window.supabase
    .from('customers')
    .select('customer_code')
    .ilike('customer_code', 'CUST%');
  
  let maxNum = 0;
  if (existing && existing.length > 0) {
    existing.forEach(row => {
      const match = row.customer_code && row.customer_code.match(/CUST(\d{4})$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });
  }
  
  const nextNum = (maxNum + 1).toString().padStart(4, '0');
  return `CUST${nextNum}`;
}

// Helper to generate sequential booking ID
async function generateSequentialBookingId() {
  try {
    // Get current year and month
    const now = new Date();
    const year = String(now.getFullYear()).slice(-2); // Get last 2 digits of year
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const yearMonth = `${year}${month}`;
    
    // Query for the last booking ID in the current month
    const { data: lastBooking, error } = await window.supabase
      .from('bookings')
      .select('booking_id')
      .ilike('booking_id', `RB${yearMonth}%`)
      .order('booking_id', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (error) {
      console.error('Error fetching last booking ID:', error);
      // Fallback to first booking of the month
      return `RB${yearMonth}001`;
    }
    
    let nextNumber = 1;
    
    if (lastBooking && lastBooking.booking_id) {
      // Extract the base number from the last booking ID
      // Handle formats: RB2511001, RB2511001002, RB2511001-1
      const bookingId = lastBooking.booking_id;

      // Remove prefix RB and year/month to get the base number part
      const withoutPrefix = bookingId.substring(6); // Remove "RB2511"

      // Extract just the base number (before any hyphen or additional digits)
      const baseMatch = withoutPrefix.match(/^(\d{3})/);
      if (baseMatch) {
        nextNumber = parseInt(baseMatch[1], 10) + 1;
      }
    }
    
    // Format the new booking ID
    const bookingId = `RB${yearMonth}${String(nextNumber).padStart(3, '0')}`;
    console.log('Generated booking ID:', bookingId);
    return bookingId;
    
  } catch (error) {
    console.error('Error generating booking ID:', error);
    // Fallback booking ID
    const now = new Date();
    const year = String(now.getFullYear()).slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `RB${year}${month}001`;
  }
}

// Helper to generate sequential quote ID
async function generateSequentialQuoteId() {
  try {
    // Get current year and month
    const now = new Date();
    const year = String(now.getFullYear()).slice(-2); // Get last 2 digits of year
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const yearMonth = `${year}${month}`;
    
    // Query for the last quote ID in the current month
    const { data: lastQuote, error } = await window.supabase
      .from('bookings')
      .select('booking_id')
      .eq('quote_only', true)
      .ilike('booking_id', `RQ${yearMonth}%`)
      .order('booking_id', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (error) {
      console.error('Error fetching last quote ID:', error);
      // Fallback to first quote of the month
      return `RQ${yearMonth}001`;
    }
    
    let nextNumber = 1;
    
    if (lastQuote && lastQuote.booking_id) {
      // Extract the number from the last quote ID
      const match = lastQuote.booking_id.match(/RQ\d{4}(\d{3})$/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }
    
    // Format the new quote ID
    const quoteId = `RQ${yearMonth}${String(nextNumber).padStart(3, '0')}`;
    console.log('Generated quote ID:', quoteId);
    return quoteId;
    
  } catch (error) {
    console.error('Error generating quote ID:', error);
    // Fallback quote ID
    const now = new Date();
    const year = String(now.getFullYear()).slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `RQ${year}${month}001`;
  }
}

// Add customer registration logic
// Add customer registration logic - Uses Netlify function to bypass RLS
async function getOrCreateCustomerId(firstName, lastName, email, phone, isGuest = false) {
  if (!email) return null;
  
  console.log('🔍 Getting or creating customer via Netlify function...');
  
  try {
    // Use Netlify function to create/get customer (bypasses RLS)
    const response = await fetch('/.netlify/functions/create-customer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: firstName,
        lastName: lastName,
        email: email,
        phone: phone,
        isGuest: isGuest
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Error from create-customer function:', errorData);
      alert('There was an error with your customer details. Please try again.');
      return null;
    }

    const result = await response.json();
    
    if (result.success && result.customer_id) {
      window.lastCustomerCode = result.customer_code || '';
      console.log(result.is_new ? '✅ New customer created:' : '✅ Existing customer found:', result.customer_code);
      return result.customer_id;
    } else {
      console.error('❌ Failed to get customer ID:', result);
      return null;
    }
    
  } catch (error) {
    console.error('❌ Error in getOrCreateCustomerId:', error);
    alert('There was an error with your customer details. Please try again.');
    return null;
  }
}


// Show customer_code in Customer Details step after registration
const customerDetailsStep = document.getElementById('step6');
if (customerDetailsStep) {
  const observerCust = new MutationObserver(() => {
    if (customerDetailsStep.classList.contains('active')) {
      const codeDiv = document.getElementById('customerCodeDisplay');
      if (window.lastCustomerCode) {
        if (codeDiv) {
          codeDiv.textContent = `Here is your User ID: ${window.lastCustomerCode}`;
        } else {
          const newDiv = document.createElement('div');
          newDiv.id = 'customerCodeDisplay';
          newDiv.style = 'font-size:1.05rem; color:#007e8c; margin-top:8px; margin-bottom:8px; font-weight:600;';
          newDiv.textContent = `Here is your User ID: ${window.lastCustomerCode}`;
          customerDetailsStep.querySelector('.step-content').appendChild(newDiv);
        }
      } else if (codeDiv) {
        codeDiv.remove();
      }
    }
  });
  observerCust.observe(customerDetailsStep, { attributes: true, attributeFilter: ['class'] });
}

// Email-first customer lookup logic
const customerEmailInput = document.getElementById('customerEmail');
const customerLookupResult = document.getElementById('customerLookupResult');
const customerInfo = document.getElementById('customerInfo');
const registrationOption = document.getElementById('registrationOption');
const customerFirstNameInput = document.getElementById('customerFirstName');
const customerLastNameInput = document.getElementById('customerLastName');
const customerPhoneInput = document.getElementById('customerPhone');
const emailStatus = document.getElementById('emailStatus');

if (customerEmailInput) {
  customerEmailInput.addEventListener('blur', async function () {
    const email = customerEmailInput.value.trim();
    if (!email) {
      hideCustomerLookup();
      return;
    }
    
    // Show loading status
    emailStatus.innerHTML = '<span style="color:#007e8c;">⏳ Checking email...</span>';
    
    try {
      // Use Netlify function for customer lookup (bypasses RLS)
      const response = await fetch('/.netlify/functions/customer-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email })
      });

      if (!response.ok) {
        throw new Error('Failed to check customer');
      }

      const result = await response.json();
      
      if (result.found && result.customer) {
        // Existing customer found
        showExistingCustomer(result.customer);
      } else {
        // New customer
        showNewCustomer();
      }
    } catch (error) {
      console.error('Error in customer lookup:', error);
      emailStatus.innerHTML = '<span style="color:#d32f2f;">❌ Error checking email</span>';
    }
  });
}

function showExistingCustomer(customer) {
  // Auto-fill the form fields
  if (customerFirstNameInput) customerFirstNameInput.value = customer.first_name || '';
  if (customerLastNameInput) customerLastNameInput.value = customer.last_name || '';
  if (customerPhoneInput) customerPhoneInput.value = customer.phone || '';
  
  // Show welcome message WITHOUT customer ID
  customerLookupResult.style.display = 'block';
  customerInfo.innerHTML = `
    <div>Welcome back, ${customer.first_name || 'Valued Customer'}!</div>
  `;
  
  // Hide registration option for existing customers
  registrationOption.style.display = 'none';
  
  // Update status
  emailStatus.innerHTML = '<span style="color:#4caf50;">✅ Customer found</span>';
  
  console.log('✅ Existing customer loaded:', customer);
}

function showNewCustomer() {
  // Clear form fields
  if (customerFirstNameInput) customerFirstNameInput.value = '';
  if (customerLastNameInput) customerLastNameInput.value = '';
  if (customerPhoneInput) customerPhoneInput.value = '';
  
  // Hide welcome message
  customerLookupResult.style.display = 'none';
  
  // Show registration option
  registrationOption.style.display = 'block';
  
  // Update status
  emailStatus.innerHTML = '<span style="color:#ff9800;">🆕 New customer</span>';
  
  console.log('🆕 New customer detected');
}

function hideCustomerLookup() {
  customerLookupResult.style.display = 'none';
  registrationOption.style.display = 'none';
  emailStatus.innerHTML = '';
}

// Send booking notifications via EmailJS AND SMS
async function sendBookingNotifications(bookingData, bookingId) {
  console.log('📧📱 Starting enhanced email + SMS notifications...', { bookingData, bookingId });
  
  try {
    // Prepare email data with ALL required fields for the template
    const emailData = {
      ...bookingData,
      booking_id: bookingId,
      first_name: bookingData.first_name || '',
      last_name: bookingData.last_name || '',
      customer_name: `${bookingData.first_name || ''} ${bookingData.last_name || ''}`.trim(),
      customer_email: bookingData.customer_email,
      customer_phone: bookingData.customer_phone,
      service_name: bookingData.service_name || 'Massage Service',
      therapist_name: bookingData.therapist_name || 'Available Therapist',
      booking_date: bookingData.booking_date || new Date().toISOString().split('T')[0],
      booking_time: bookingData.booking_time || '09:00',
      total_price: bookingData.price ? `$${bookingData.price.toFixed(2)}` : 'N/A',
      address: bookingData.address || 'N/A',
      business_name: bookingData.business_name || '',
      room_number: bookingData.room_number || '',
      gender_preference: bookingData.gender_preference || 'No preference',
      parking: bookingData.parking || 'N/A',
      booker_name: bookingData.booker_name || '',
      notes: bookingData.notes || '',
      duration_minutes: bookingData.duration_minutes,
      // Recurring booking fields - use series_bookings if available (new model)
      is_recurring: bookingData.is_recurring || false,
      series_bookings: bookingData.series_bookings || null, // NEW: array of all bookings in series
      recurring_dates: bookingData.recurring_dates || null, // Legacy for old bookings
      total_occurrences: bookingData.total_occurrences || null,
      recurring_frequency: bookingData.recurring_frequency || null,
      recurring_count: bookingData.total_occurrences || null // Alias for emailService.js
    };
    
    // Send client confirmation email (existing)
    console.log('📧 Sending client confirmation email...');
    const clientEmailResult = await window.EmailService.sendBookingRequestReceived(emailData);
    
    // NEW: Send SMS confirmation to customer
    let customerSMSResult = { success: false };
    if (bookingData.customer_phone) {
      console.log('📱 Sending customer confirmation SMS...');
      const formattedPhone = formatPhoneNumber(bookingData.customer_phone);
      if (formattedPhone) {
        customerSMSResult = await sendCustomerBookingConfirmationSMS(
          formattedPhone,
          emailData.customer_name,
          bookingId
        );
      }
    }
    
    // Send therapist request email (existing)
    console.log('📧 Sending therapist request email...');
    let therapistEmailResult = { success: false, error: 'No therapist data available' };
    
    if (bookingData.therapist_id) {
      try {
        // Fetch therapist data from Supabase
        const { data: therapistData, error: therapistError } = await window.supabase
          .from('therapist_profiles')
          .select('id, first_name, last_name, email')
          .eq('id', bookingData.therapist_id)
          .single();
        
        if (therapistData && !therapistError) {
          console.log('📧 Therapist data found:', therapistData);
          
          therapistEmailResult = await window.EmailService.sendTherapistBookingRequest(
            emailData, 
            therapistData, 
            window.therapistResponseTimeoutMinutes || 3
          );
        } else {
          console.error('❌ Error fetching therapist data:', therapistError);
          therapistEmailResult = { success: false, error: 'Could not fetch therapist data' };
        }
      } catch (error) {
        console.error('❌ Error sending therapist email:', error);
        therapistEmailResult = { success: false, error: error.message };
      }
    }
    
    // Return combined results
    const results = {
      success: clientEmailResult.success,
      clientEmail: clientEmailResult,
      customerSMS: customerSMSResult,
      therapistEmail: therapistEmailResult,
      therapistEmailSent: therapistEmailResult.success
    };
    
    console.log('📧📱 Email + SMS notification results:', results);
    return results;
    
  } catch (error) {
    console.error('❌ Error in sendBookingNotifications:', error);
    return { success: false, error: error.message };
  }
}

// NEW: Send SMS confirmation to customer when booking is received
async function sendCustomerBookingConfirmationSMS(customerPhone, customerName, bookingId) {
  try {
    const message = `Hi ${customerName}! Your massage booking ${bookingId} has been received. We're finding you a therapist now. You'll get updates via SMS! - Rejuvenators`;
    
    console.log('📱 Sending booking confirmation SMS to:', customerPhone);
    
    const response = await fetch('/.netlify/functions/send-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: customerPhone,
        message: message
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Customer SMS sent successfully');
      return { success: true, sid: result.sid };
    } else {
      console.error('❌ Customer SMS failed:', result.error);
      return { success: false, error: result.error };
    }
    
  } catch (error) {
    console.error('❌ Error sending customer SMS:', error);
    return { success: false, error: error.message };
  }
}

// NEW: Format phone number for SMS (Australian format)
function formatPhoneNumber(phone) {
  if (!phone) return null;
  
  // Remove all non-digits
  const cleaned = phone.replace(/\D/g, '');
  
  // Add Australian country code if missing
  if (cleaned.length === 10 && cleaned.startsWith('0')) {
    return '+61' + cleaned.substring(1); // Remove leading 0, add +61
  } else if (cleaned.length === 9) {
    return '+61' + cleaned; // Add +61
  } else if (cleaned.length === 12 && cleaned.startsWith('61')) {
    return '+' + cleaned; // Add +
  } else if (cleaned.startsWith('+61')) {
    return cleaned; // Already formatted
  }
  
  return phone; // Return as-is if unsure
}

  // Auto-advance removed - users now use Continue button to review address first

// Booking submission logic with secure payment processing
document.addEventListener('DOMContentLoaded', function() {
const confirmBtn = document.querySelector('#step9 .btn.next.primary');
if (confirmBtn) {
  confirmBtn.addEventListener('click', async function (e) {
    e.preventDefault();
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Processing Payment...';
      
      try {
    // Gather all booking details
    const addressInput = document.getElementById('address');

    // Get business name from Google Places
    let businessName = addressInput.dataset.businessName || window.selectedBusinessName || '';

    // Determine booking type based on presence of business name
    let bookingType;
    if (businessName) {
      bookingType = 'Hotel/Accommodation';
    } else {
      bookingType = 'In-home';
    }

    console.log('📍 DEBUG (booking creation): Business name:', businessName, '| Booking type:', bookingType);
        
        const lat = addressInput.dataset.lat ? Number(addressInput.dataset.lat) : null;
        const lng = addressInput.dataset.lng ? Number(addressInput.dataset.lng) : null;
    const serviceId = window.selectedServiceId || document.getElementById('service')?.value;
        const duration = document.getElementById('duration').value;
        const genderPref = document.querySelector('input[name="genderPref"]:checked')?.value;
        const fallbackOption = document.querySelector('input[name="fallbackOption"]:checked')?.value;
    const date = document.getElementById('date').value;
    const time = document.getElementById('time').value;
        const therapistId = document.querySelector('input[name="therapistId"]:checked')?.value;
    const parking = document.getElementById('parking').value;
        
        // Get customer details
        const customerFirstName = document.getElementById('customerFirstName')?.value || '';
        const customerLastName = document.getElementById('customerLastName')?.value || '';
        const customerEmail = document.getElementById('customerEmail')?.value || '';
        const customerPhone = document.getElementById('customerPhone')?.value || '';
        const roomNumber = document.getElementById('roomNumber')?.value || '';
        const bookerName = document.getElementById('bookerName')?.value || '';
        const notes = document.getElementById('notes')?.value || '';
    const price = document.getElementById('priceAmount').textContent ? parseFloat(document.getElementById('priceAmount').textContent) : null;

    // Calculate therapist fee (async call with therapist-specific rates)
        const therapist_fee = (await calculateTherapistFee(date, time, duration, therapistId)) || 0;
        
    // Compose booking_time as ISO string
    const booking_time = date && time ? `${date}T${time}:00` : null;
        
    // Registration option
    const registerOption = document.querySelector('input[name="registerOption"]:checked')?.value;
    let customer_id = null;
        
    if (registerOption === 'yes') {
          customer_id = await getOrCreateCustomerId(customerFirstName, customerLastName, customerEmail, customerPhone, false);
        } else {
          // Create guest customer
          customer_id = await getOrCreateCustomerId(customerFirstName, customerLastName, customerEmail, customerPhone, true);
        }
        
        // Get service name for email
        const serviceName = window.selectedService?.name || 'Massage Service';
        
        // Get therapist name for email
        const therapistRadio = document.querySelector('input[name="therapistId"]:checked');
        const therapistName = therapistRadio?.dataset?.name || 'Available Therapist';
        
    // Validate acknowledgement dropdowns
    
    const termsAck = document.getElementById('termsAcceptance');
        
    if (termsAck.value !== 'yes') {
      alert('Please read and accept the Terms & Conditions.');
      return;
    }

    // Get simple pricing information
    const discountCode = window.appliedDiscount?.code || null;
    const giftCardCode = window.appliedGiftCard?.code || null;

    // Get the final calculated price from the display
    const finalPrice = parseFloat(document.getElementById('priceAmount').textContent) || price;
    const netPrice = finalPrice;

    // Calculate discount amount
    let discountAmount = 0;
    if (window.appliedDiscount) {
      if (window.appliedDiscount.discount_type === 'percentage') {
        discountAmount = (price * window.appliedDiscount.discount_value) / 100;
      } else if (window.appliedDiscount.discount_type === 'fixed_amount') {
        discountAmount = Math.min(window.appliedDiscount.discount_value, price);
      }
    }

    // Calculate gift card amount
    let giftCardAmount = 0;
    if (window.appliedGiftCard) {
      const priceAfterDiscount = price - discountAmount;
      giftCardAmount = Math.min(window.appliedGiftCard.current_balance, priceAfterDiscount);
    }

    // Calculate GST (10% of final price)
    const taxRateAmount = netPrice / 11 * 1; // GST component of final price

    // Build payload
    const payload = {
      address: addressInput.value,
      booking_type: bookingType,
      business_name: businessName,
      latitude: lat,
      longitude: lng,
      service_id: serviceId,
      duration_minutes: duration,
      gender_preference: genderPref,
      fallback_option: fallbackOption,
      booking_time,
      parking,
      therapist_id: therapistId,
      first_name: customerFirstName,
      last_name: customerLastName,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      room_number: roomNumber,
      booker_name: bookerName,
      notes,
      price,
      therapist_fee,
      // Pricing fields
      net_price: netPrice,
      discount_code: discountCode,
      gift_card_code: giftCardCode,
      discount_amount: discountAmount,
      gift_card_amount: giftCardAmount,
      tax_rate_amount: taxRateAmount,
      // Acknowledgement fields
            terms_acceptance: document.getElementById('termsAcceptance').value === 'yes',
      status: 'requested',
      payment_status: 'pending',
      // Payment method - get from admin selector if in admin mode, otherwise default to 'card'
      payment_method: window.isAdminMode
        ? (document.getElementById('paymentMethod')?.value || 'card')
        : 'card',
      // Recurring booking fields
      is_recurring: window.recurringBooking?.enabled || false,
      recurring_frequency: window.recurringBooking?.enabled ? window.recurringBooking.frequency : null,
      total_occurrences: window.recurringBooking?.enabled ? (window.recurringBooking.count + 1) : 1, // count = repeats, so total = count + 1 (initial)
      recurring_dates: window.recurringBooking?.enabled ? window.recurringBooking.dates : null // dates array contains ONLY repeat dates (not initial)
    };
        
        // Generate booking ID BEFORE inserting
        const bookingIdFormatted = await generateSequentialBookingId();
        window.lastBookingId = bookingIdFormatted;
        
    if (customer_id) payload.customer_id = customer_id;
    if (window.lastCustomerCode) payload.customer_code = window.lastCustomerCode;
        payload.booking_id = bookingIdFormatted; // Add booking ID to payload
        
    window.lastBookingCustomerId = customer_id || '';

        // Check if using card payment method
        const selectedPaymentMethod = payload.payment_method || 'card';

        if (selectedPaymentMethod === 'card') {
          // Card payment - require authorization
          if (!cardAuthorized || !authorizedPaymentIntentId) {
            throw new Error('Card authorization missing. Please go back to the payment step.');
          }

          console.log('✅ Using pre-authorized card:', authorizedPaymentIntentId);

          // Create booking with card authorized (payment pending)
          confirmBtn.textContent = 'Creating Booking Request...';
          payload.payment_status = 'authorized'; // Card authorized, payment pending
          payload.status = 'requested'; // Waiting for therapist acceptance
          payload.payment_intent_id = authorizedPaymentIntentId;

          // For recurring bookings, include payment method for future charges
          if (window.recurringBooking?.enabled && window.stripePaymentMethodId) {
            payload.stripe_payment_method_id = window.stripePaymentMethodId;
            console.log('🔄 Including payment method for recurring bookings:', window.stripePaymentMethodId);
          }
        } else {
          // Bank transfer or invoice - no card authorization needed
          console.log('✅ Using non-card payment method:', selectedPaymentMethod);
          confirmBtn.textContent = 'Creating Booking Request...';
          payload.payment_status = 'pending'; // Payment pending (will be paid via bank transfer or invoice)
          payload.status = 'requested'; // Waiting for therapist acceptance
          // No payment_intent_id for non-card payments
        }
        
        // Insert booking using Netlify function (bypasses RLS)
        console.log('📝 Creating booking via Netlify function...');
        const bookingResponse = await fetch('/.netlify/functions/create-booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!bookingResponse.ok) {
          const errorData = await bookingResponse.json();
          console.error('❌ Error from create-booking function:', errorData);
          alert('There was an error submitting your booking. Please try again.\n' + (errorData.error || ''));
          confirmBtn.disabled = false;
          confirmBtn.textContent = 'Confirm and Request Booking';
          return;
        }

        const bookingResult = await bookingResponse.json();
        console.log('Booking creation result:', bookingResult);
        
        if (!bookingResult.success) {
          console.error('❌ Booking creation failed:', bookingResult);
          alert('There was an error submitting your booking. Please try again.');
          confirmBtn.disabled = false;
          confirmBtn.textContent = 'Confirm and Request Booking';
          return;
        }

        const data = [bookingResult.booking];
        const error = null;

    if (!data || data.length === 0) {
      // Remove status message
      disableContinueFromAddress();
      return;
    }

        console.log('✅ Booking created with booking_id:', bookingIdFormatted, 'and customer_code:', window.lastCustomerCode);

   // Send enhanced email notifications (client + therapist)
    console.log('📧 Starting enhanced email notifications...');
    const emailData = {
      ...payload,
      service_name: serviceName,
      therapist_name: therapistName,
      booking_date: date,
      booking_time: time,
      // Include series data for recurring bookings
      series_bookings: bookingResult.series || null
    };
    const emailResult = await sendBookingNotifications(emailData, bookingIdFormatted);
    console.log('📧 Enhanced email notification result:', emailResult);
    
    // Store confirmation data for Step 10 display
    bookingConfirmationData = emailResult;

    // Move to confirmation step (no alert needed - Step 10 will display messages)
    showStep('step10');

    // If in admin mode, close window and return to admin panel after showing success message
    if (window.isAdminMode) {
      console.log('🔐 Admin mode - closing booking window in 3 seconds...');

      // Add a message to the confirmation page
      setTimeout(() => {
        const step10 = document.getElementById('step10');
        if (step10) {
          const returnMessage = document.createElement('div');
          returnMessage.style.cssText = 'background: #f0fdf4; border: 2px solid #86efac; color: #166534; padding: 16px; border-radius: 8px; margin-top: 20px; text-align: center;';
          returnMessage.innerHTML = `
            <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">✅ Returning to Admin Panel...</div>
            <div style="font-size: 14px;">This window will close automatically.</div>
          `;
          step10.appendChild(returnMessage);
        }

        // Close the window after 2 more seconds
        setTimeout(() => {
          // If window was opened by another window (window.opener exists), close it
          if (window.opener) {
            window.opener.focus(); // Focus on the admin panel
            window.close();
          } else {
            // Otherwise try to go back in history or close
            if (window.history.length > 1) {
              window.history.back();
            } else {
              window.close();
            }
          }
        }, 2000);
      }, 3000); // Wait 3 seconds to show success message first
    }
        
      } catch (error) {
        console.error('❌ Error in booking submission:', error);
        alert('There was an error submitting your booking. Please try again.');
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Confirm and Request Booking';
      }
    });
  }
});
