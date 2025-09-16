// ENHANCED QUOTE FORM JAVASCRIPT - Mobile-First & Clean Architecture Integration
// Integrates with the new quotes table and quote_dates table

class QuoteFormManager {
  constructor() {
    this.eventStructure = 'single_day';
    this.multiDayDates = [];
    this.selectedService = null;
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Event structure selection
    document.querySelectorAll('input[name="eventStructure"]').forEach(input => {
      input.addEventListener('change', (e) => this.handleEventStructureChange(e.target.value));
    });

    // Multi-day management
    document.getElementById('numberOfDays')?.addEventListener('change', (e) => {
      this.generateMultiDayFields(parseInt(e.target.value));
    });

    document.getElementById('addEventDate')?.addEventListener('click', () => {
      this.addEventDateField();
    });

    // Auto-calculation listeners
    document.getElementById('totalSessions')?.addEventListener('input', () => this.calculateEstimate());
    document.getElementById('sessionDuration')?.addEventListener('change', () => this.calculateEstimate());
    document.getElementById('therapistsNeeded')?.addEventListener('change', () => this.calculateEstimate());

    // Submit handler
    document.getElementById('submitQuoteRequest')?.addEventListener('click', () => this.submitQuoteRequest());

    // Address autocomplete
    this.setupAddressAutocomplete();
  }

  handleEventStructureChange(structure) {
    this.eventStructure = structure;

    // Update UI
    document.querySelectorAll('.event-type-card').forEach(card => {
      card.classList.remove('active');
    });
    document.querySelector(`[data-type="${structure}"]`).classList.add('active');

    // Show/hide relevant fields
    const singleDayFields = document.getElementById('singleDayFields');
    const multiDayFields = document.getElementById('multiDayFields');
    const multiDaySessionsRow = document.getElementById('multiDaySessionsRow');

    if (structure === 'single_day') {
      singleDayFields.style.display = 'block';
      multiDayFields.style.display = 'none';
      multiDaySessionsRow.style.display = 'none';
    } else {
      singleDayFields.style.display = 'none';
      multiDayFields.style.display = 'block';
      multiDaySessionsRow.style.display = 'block';
    }

    this.calculateEstimate();
  }

  generateMultiDayFields(numberOfDays) {
    const container = document.getElementById('multiDayDates');
    container.innerHTML = '';
    this.multiDayDates = [];

    for (let i = 1; i <= numberOfDays; i++) {
      this.addEventDateField(i);
    }

    this.calculateSessionsPerDay();
  }

  addEventDateField(dayNumber = null) {
    const container = document.getElementById('multiDayDates');
    const dayNum = dayNumber || this.multiDayDates.length + 1;

    const dateRow = document.createElement('div');
    dateRow.className = 'multi-day-date-row';
    dateRow.innerHTML = `
      <div class="day-number">Day ${dayNum}</div>
      <div class="form-group">
        <label>Date *</label>
        <input type="date" class="event-date" data-day="${dayNum}" required />
      </div>
      <div class="form-group">
        <label>Start Time *</label>
        <input type="time" class="event-time" data-day="${dayNum}" required />
      </div>
      ${!dayNumber ? '<button type="button" class="remove-date-btn" onclick="quoteForm.removeEventDate(this)">Remove</button>' : ''}
    `;

    container.appendChild(dateRow);

    if (!dayNumber) {
      this.multiDayDates.push({ day: dayNum, date: '', time: '' });
    }

    this.calculateSessionsPerDay();
  }

  removeEventDate(button) {
    const row = button.closest('.multi-day-date-row');
    const dayNum = parseInt(row.querySelector('.event-date').dataset.day);

    row.remove();
    this.multiDayDates = this.multiDayDates.filter(d => d.day !== dayNum);

    // Renumber remaining days
    this.renumberDays();
    this.calculateSessionsPerDay();
  }

  renumberDays() {
    const dateRows = document.querySelectorAll('.multi-day-date-row');
    dateRows.forEach((row, index) => {
      const dayNum = index + 1;
      row.querySelector('.day-number').textContent = `Day ${dayNum}`;
      row.querySelector('.event-date').dataset.day = dayNum;
      row.querySelector('.event-time').dataset.day = dayNum;
    });

    // Update multiDayDates array
    this.multiDayDates.forEach((date, index) => {
      date.day = index + 1;
    });
  }

  calculateSessionsPerDay() {
    if (this.eventStructure === 'multi_day') {
      const totalSessions = parseInt(document.getElementById('totalSessions')?.value) || 0;
      const numberOfDays = this.multiDayDates.length || 1;
      const sessionsPerDay = Math.ceil(totalSessions / numberOfDays);

      const sessionsPerDayField = document.getElementById('sessionsPerDay');
      if (sessionsPerDayField) {
        sessionsPerDayField.value = sessionsPerDay;
        sessionsPerDayField.readOnly = true;
      }
    }
  }

  calculateEstimate() {
    const totalSessions = parseInt(document.getElementById('totalSessions')?.value) || 0;
    const sessionDuration = parseInt(document.getElementById('sessionDuration')?.value) || 0;
    const therapistsNeeded = parseInt(document.getElementById('therapistsNeeded')?.value) || 1;

    // Update display elements
    document.getElementById('estimateSessions').textContent = totalSessions || '-';
    document.getElementById('estimateDuration').textContent = sessionDuration ? `${sessionDuration} min` : '-';
    document.getElementById('estimateTherapists').textContent = therapistsNeeded || '-';

    // Calculate price estimate (simplified - will be refined server-side)
    if (totalSessions && sessionDuration) {
      const baseRate = 160; // Base hourly rate from system settings
      const totalHours = (totalSessions * sessionDuration) / 60;
      const baseCost = totalHours * baseRate;

      const lowEstimate = Math.round(baseCost * 0.8);
      const highEstimate = Math.round(baseCost * 1.2);

      document.getElementById('estimateRange').textContent = `$${lowEstimate} - $${highEstimate}`;
    } else {
      document.getElementById('estimateRange').textContent = 'Enter details above';
    }

    this.calculateSessionsPerDay();
  }

  setupAddressAutocomplete() {
    const addressInput = document.getElementById('eventLocation');
    if (!addressInput || !window.google) return;

    const autocomplete = new google.maps.places.Autocomplete(addressInput, {
      types: ['address'],
      componentRestrictions: { country: 'AU' }
    });

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (place.geometry) {
        addressInput.dataset.lat = place.geometry.location.lat();
        addressInput.dataset.lng = place.geometry.location.lng();

        const statusDiv = document.getElementById('event-address-status');
        statusDiv.className = 'status-message success';
        statusDiv.textContent = '✓ Address verified';
        statusDiv.style.display = 'block';
      }
    });
  }

  async submitQuoteRequest() {
    const submitBtn = document.getElementById('submitQuoteRequest');
    const originalText = submitBtn.textContent;

    try {
      // Validate form
      if (!this.validateForm()) {
        return;
      }

      // Show loading state
      submitBtn.textContent = 'Submitting...';
      submitBtn.disabled = true;
      submitBtn.classList.add('loading');

      // Generate quote ID
      const quoteId = await this.generateQuoteId();

      // Prepare quote data
      const quoteData = this.collectQuoteData(quoteId);

      // Submit to quotes table
      await this.saveQuoteToDatabase(quoteData);

      // Handle multi-day dates if needed
      if (this.eventStructure === 'multi_day' && this.multiDayDates.length > 0) {
        await this.saveQuoteDates(quoteId);
      }

      // Show success
      this.showSuccessModal(quoteId);

    } catch (error) {
      console.error('Quote submission error:', error);
      alert('Sorry, there was an error submitting your quote request. Please try again.');
    } finally {
      // Reset button
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
      submitBtn.classList.remove('loading');
    }
  }

  validateForm() {
    const required = [
      'contactName', 'contactEmail', 'contactPhone', 'eventLocation',
      'totalSessions', 'sessionDuration', 'paymentMethod', 'urgency'
    ];

    // Add structure-specific required fields
    if (this.eventStructure === 'single_day') {
      required.push('singleEventDate', 'singleStartTime');
    } else {
      // Validate multi-day dates
      const dateInputs = document.querySelectorAll('.event-date');
      const timeInputs = document.querySelectorAll('.event-time');

      if (dateInputs.length === 0) {
        alert('Please add at least one event date');
        return false;
      }

      for (let i = 0; i < dateInputs.length; i++) {
        if (!dateInputs[i].value || !timeInputs[i].value) {
          alert(`Please complete Day ${i + 1} date and time`);
          return false;
        }
      }
    }

    // Check required fields
    for (const fieldId of required) {
      const field = document.getElementById(fieldId);
      if (!field || !field.value.trim()) {
        const label = document.querySelector(`label[for="${fieldId}"]`)?.textContent || fieldId;
        alert(`Please fill in: ${label}`);
        field?.focus();
        return false;
      }
    }

    // Validate email
    const email = document.getElementById('contactEmail').value;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      alert('Please enter a valid email address');
      document.getElementById('contactEmail').focus();
      return false;
    }

    // Validate address has coordinates
    const locationInput = document.getElementById('eventLocation');
    if (!locationInput.dataset.lat || !locationInput.dataset.lng) {
      alert('Please select a valid address from the dropdown suggestions');
      locationInput.focus();
      return false;
    }

    return true;
  }

  collectQuoteData(quoteId) {
    const data = {
      id: quoteId,
      event_structure: this.eventStructure,
      status: 'draft',

      // Contact information
      customer_name: document.getElementById('contactName').value.trim(),
      customer_email: document.getElementById('contactEmail').value.trim(),
      customer_phone: document.getElementById('contactPhone').value.trim(),

      // Event details
      event_name: document.getElementById('eventName').value.trim() || null,
      event_location: document.getElementById('eventLocation').value.trim(),
      event_type: document.getElementById('eventType').value || null,
      company_name: document.getElementById('companyName').value.trim() || null,

      // Session specifications
      total_sessions: parseInt(document.getElementById('totalSessions').value),
      session_duration_minutes: parseInt(document.getElementById('sessionDuration').value),
      therapists_needed: parseInt(document.getElementById('therapistsNeeded').value) || 1,
      expected_attendees: parseInt(document.getElementById('expectedAttendees').value) || null,

      // Business requirements
      payment_method: document.getElementById('paymentMethod').value,
      urgency: document.getElementById('urgency').value,
      po_number: document.getElementById('poNumber').value.trim() || null,

      // Requirements
      setup_requirements: document.getElementById('setupRequirements').value.trim() || null,
      special_requirements: document.getElementById('specialRequirements').value.trim() || null,

      // Pricing (estimated)
      hourly_rate: 160.00, // From system settings
      total_amount: this.calculateTotalAmount(),
      total_therapist_fees: this.calculateTherapistFees(),

      // Service reference
      service_id: this.selectedService?.id || null
    };

    // Add structure-specific fields
    if (this.eventStructure === 'single_day') {
      data.single_event_date = document.getElementById('singleEventDate').value;
      data.single_start_time = document.getElementById('singleStartTime').value;
      data.sessions_per_day = data.total_sessions;
    } else {
      data.number_of_event_days = this.multiDayDates.length;
      data.sessions_per_day = Math.ceil(data.total_sessions / this.multiDayDates.length);
    }

    return data;
  }

  calculateTotalAmount() {
    const totalSessions = parseInt(document.getElementById('totalSessions')?.value) || 0;
    const sessionDuration = parseInt(document.getElementById('sessionDuration')?.value) || 0;
    const hourlyRate = 160; // Base rate

    const totalHours = (totalSessions * sessionDuration) / 60;
    return Math.round(totalHours * hourlyRate * 100) / 100;
  }

  calculateTherapistFees() {
    // Simplified calculation - 56% of total amount
    return Math.round(this.calculateTotalAmount() * 0.56 * 100) / 100;
  }

  async saveQuoteToDatabase(quoteData) {
    const { data, error } = await window.supabase
      .from('quotes')
      .insert(quoteData)
      .select('id')
      .single();

    if (error) {
      console.error('Database error:', error);
      throw new Error('Failed to save quote request');
    }

    return data;
  }

  async saveQuoteDates(quoteId) {
    // Collect all multi-day dates
    const dateRows = document.querySelectorAll('.multi-day-date-row');
    const quoteDates = [];

    dateRows.forEach((row, index) => {
      const dateInput = row.querySelector('.event-date');
      const timeInput = row.querySelector('.event-time');

      if (dateInput.value && timeInput.value) {
        quoteDates.push({
          quote_id: quoteId,
          event_date: dateInput.value,
          start_time: timeInput.value,
          day_number: index + 1,
          sessions_count: Math.ceil(this.collectQuoteData(quoteId).total_sessions / dateRows.length)
        });
      }
    });

    if (quoteDates.length > 0) {
      const { error } = await window.supabase
        .from('quote_dates')
        .insert(quoteDates);

      if (error) {
        console.error('Quote dates error:', error);
        throw new Error('Failed to save event dates');
      }
    }
  }

  async generateQuoteId() {
    const now = new Date();
    const yearMonth = now.getFullYear().toString().slice(-2) + (now.getMonth() + 1).toString().padStart(2, '0');

    // Query for the last quote ID in the current month
    const { data: lastQuote, error } = await window.supabase
      .from('quotes')
      .select('id')
      .ilike('id', `Q-${yearMonth}%`)
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();

    let nextNumber = 1;
    if (lastQuote && lastQuote.id) {
      const lastNumber = parseInt(lastQuote.id.split('-')[2]) || 0;
      nextNumber = lastNumber + 1;
    }

    return `Q-${yearMonth}-${nextNumber.toString().padStart(3, '0')}`;
  }

  showSuccessModal(quoteId) {
    const modal = document.getElementById('quoteSuccessModal');
    const referenceSpan = document.getElementById('quoteReferenceNumber');

    referenceSpan.textContent = quoteId;
    modal.style.display = 'flex';
  }

  // Initialize with service information
  initializeWithService(serviceData) {
    this.selectedService = serviceData;

    // Update service banner
    document.getElementById('serviceTitle').textContent = serviceData.name;
    document.getElementById('serviceDescription').textContent =
      serviceData.quote_description || serviceData.description || 'Professional massage service for your event';
  }
}

// Initialize quote form when page loads
let quoteForm;
document.addEventListener('DOMContentLoaded', () => {
  quoteForm = new QuoteFormManager();
});

// Function to show quote form (called from main booking.js)
function showEnhancedQuoteForm(serviceOption) {
  window.bookingMode = 'quote';

  // Initialize quote form with service data
  if (quoteForm) {
    quoteForm.initializeWithService({
      id: serviceOption.value,
      name: serviceOption.textContent,
      description: serviceOption.dataset.serviceDescription,
      quote_description: serviceOption.dataset.serviceDescription
    });
  }

  // Hide all steps and show quote step
  document.querySelectorAll('.step').forEach(step => step.classList.remove('active'));
  document.getElementById('quoteStep').classList.add('active');

  // Update progress bar to show quote mode
  const progressBar = document.querySelector('.progress-container');
  if (progressBar) {
    progressBar.style.display = 'none'; // Hide normal progress for quote mode
  }
}

// Reset function
function resetToServiceSelection() {
  window.bookingMode = 'booking';

  // Show service selection step
  document.querySelectorAll('.step').forEach(step => step.classList.remove('active'));
  document.getElementById('step2').classList.add('active');

  // Show progress bar again
  const progressBar = document.querySelector('.progress-container');
  if (progressBar) {
    progressBar.style.display = 'block';
  }

  // Clear service selection
  document.getElementById('service').selectedIndex = 0;
}