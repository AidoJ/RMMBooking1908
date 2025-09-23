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
    document.getElementById('numberOfServices')?.addEventListener('input', () => this.calculateEstimate());
    document.getElementById('durationPerService')?.addEventListener('change', () => this.calculateEstimate());
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
        <label>Event Date *</label>
        <input type="date" class="event-date" data-day="${dayNum}" required />
      </div>
      <div class="form-group">
        <label>Event Start Time *</label>
        <input type="time" class="event-start-time" data-day="${dayNum}" required />
      </div>
      <div class="form-group">
        <label>Event Finish Time *</label>
        <input type="time" class="event-finish-time" data-day="${dayNum}" required />
      </div>
      ${!dayNumber ? '<button type="button" class="remove-date-btn" onclick="quoteForm.removeEventDate(this)">Remove</button>' : ''}
    `;

    container.appendChild(dateRow);

    if (!dayNumber) {
      this.multiDayDates.push({ day: dayNum, date: '', startTime: '', finishTime: '' });
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
      row.querySelector('.event-start-time').dataset.day = dayNum;
      row.querySelector('.event-finish-time').dataset.day = dayNum;
    });

    // Update multiDayDates array
    this.multiDayDates.forEach((date, index) => {
      date.day = index + 1;
    });
  }

  calculateSessionsPerDay() {
    console.log('calculateSessionsPerDay called, eventStructure:', this.eventStructure);

    if (this.eventStructure === 'multi_day') {
      const numberOfServices = parseInt(document.getElementById('numberOfServices')?.value) || 0;

      // Count actual date input fields instead of relying on multiDayDates array
      const dateInputs = document.querySelectorAll('.event-date');
      const numberOfDays = Math.max(dateInputs.length, 1); // At least 1 day

      const averageSessionsPerDay = Math.round((numberOfServices / numberOfDays) * 100) / 100; // Round to 2 decimal places

      console.log(`Sessions calculation: ${numberOfServices} services ÷ ${numberOfDays} days (${dateInputs.length} date inputs) = ${averageSessionsPerDay}`);

      const sessionsPerDayField = document.getElementById('sessionsPerDay');
      if (sessionsPerDayField) {
        console.log('Setting sessionsPerDay field to:', averageSessionsPerDay);
        sessionsPerDayField.value = averageSessionsPerDay;
        sessionsPerDayField.readOnly = true;
      } else {
        console.error('sessionsPerDay field not found!');
      }
    } else {
      console.log('Not multi-day event, skipping sessions per day calculation');
    }
  }

  calculateEstimate() {
    const numberOfServices = parseInt(document.getElementById('numberOfServices')?.value) || 0;
    const durationPerService = parseInt(document.getElementById('durationPerService')?.value) || 0;
    const therapistsNeeded = parseInt(document.getElementById('therapistsNeeded')?.value) || 1;

    // Update display elements
    document.getElementById('estimateSessions').textContent = numberOfServices || '-';
    document.getElementById('estimateDuration').textContent = durationPerService ? `${durationPerService} min` : '-';
    document.getElementById('estimateTherapists').textContent = therapistsNeeded || '-';

    // Calculate price estimate using proper business rules
    if (numberOfServices && durationPerService) {
      this.calculateAccurateEstimate(numberOfServices, durationPerService);
    } else {
      document.getElementById('estimatePrice').textContent = 'Enter details above';
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
      console.log('🔍 Event structure check:', {
        eventStructure: this.eventStructure,
        multiDayDatesLength: this.multiDayDates.length,
        multiDayDates: this.multiDayDates
      });

      if (this.eventStructure === 'multi_day') {
        console.log('✅ Multi-day event detected, calling saveQuoteDates...');
        await this.saveQuoteDates(quoteId);
      } else {
        console.log('ℹ️ Single day event, skipping quote_dates');
      }

      // Send confirmation email
      await this.sendQuoteConfirmationEmail(quoteData);

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
      'numberOfServices', 'durationPerService', 'paymentMethod', 'urgency'
    ];

    // Add structure-specific required fields
    if (this.eventStructure === 'single_day') {
      required.push('singleEventDate', 'singleStartTime');
    } else {
      // Validate multi-day dates
      const dateInputs = document.querySelectorAll('.event-date');
      const startTimeInputs = document.querySelectorAll('.event-start-time');

      if (dateInputs.length === 0) {
        alert('Please add at least one event date');
        return false;
      }

      for (let i = 0; i < dateInputs.length; i++) {
        if (!dateInputs[i].value || !startTimeInputs[i].value) {
          alert(`Please complete Day ${i + 1} date and start time`);
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
    const locationInput = document.getElementById('eventLocation');
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
      event_location: locationInput.value.trim(),
      event_type: document.getElementById('eventType').value || null,
      company_name: document.getElementById('companyName').value.trim() || null,

      // Location coordinates
      latitude: parseFloat(locationInput.dataset.lat) || null,
      longitude: parseFloat(locationInput.dataset.lng) || null,

      // Service specifications (aligned with database schema)
      total_sessions: parseInt(document.getElementById('numberOfServices').value) || 0,
      session_duration_minutes: parseInt(document.getElementById('durationPerService').value) || 0,
      therapists_needed: parseInt(document.getElementById('therapistsNeeded').value) || 1,
      expected_attendees: parseInt(document.getElementById('expectedAttendees').value) || null,

      // Business requirements
      payment_method: document.getElementById('paymentMethod').value || 'invoice',
      urgency: document.getElementById('urgency').value || 'flexible',
      po_number: document.getElementById('poNumber').value.trim() || null,

      // Requirements
      setup_requirements: document.getElementById('setupRequirements').value.trim() || null,
      special_requirements: document.getElementById('specialRequirements').value.trim() || null,

      // Financial fields (all required NOT NULL fields)
      hourly_rate: 160.00,
      total_amount: this.calculateTotalAmount(),
      total_therapist_fees: this.calculateTherapistFees(),
      discount_amount: 0.00,
      tax_rate_amount: 0.00,
      final_amount: this.calculateTotalAmount(), // Will be calculated properly later

      // Status fields
      payment_status: 'pending',

      // Service reference
      service_id: this.selectedService?.id || null
    };

    // Add structure-specific fields
    if (this.eventStructure === 'single_day') {
      data.single_event_date = document.getElementById('singleEventDate').value;
      data.single_start_time = document.getElementById('singleStartTime').value;
      data.sessions_per_day = data.total_sessions;
    } else {
      // Count actual date input fields for multi-day events
      const dateInputs = document.querySelectorAll('.event-date');
      const numberOfDays = Math.max(dateInputs.length, 1);
      data.number_of_event_days = numberOfDays;
      data.sessions_per_day = Math.ceil(data.total_sessions / numberOfDays);
    }

    return data;
  }

  async calculateAccurateEstimate(numberOfServices, durationPerService) {
    try {
      // 1. Check minimum 2 hours requirement
      const totalMinutes = numberOfServices * durationPerService;
      if (totalMinutes < 120) {
        document.getElementById('estimatePrice').innerHTML =
          '<span style="color: #dc3545; font-weight: bold;">⚠️ Quote request must be at least 120 minutes to proceed</span>';
        return;
      }

      // 2. Get base rate from selected service
      const serviceBaseRate = await this.getServiceBaseRate();
      if (!serviceBaseRate) {
        document.getElementById('estimatePrice').textContent = 'Select a service to see estimate';
        return;
      }

      // 3. Calculate total hours
      const totalHours = totalMinutes / 60;
      let baseCost = totalHours * serviceBaseRate;

      // 4. Apply weekend uplifts for dates
      const weekendMultiplier = await this.getWeekendMultiplier();
      baseCost *= weekendMultiplier;

      // 5. Apply urgency premium if needed
      const urgencyMultiplier = this.getUrgencyMultiplier();
      baseCost *= urgencyMultiplier;

      // 6. Create variance of 0.90 to 1.10
      const finalEstimate = Math.round(baseCost);

      document.getElementById('estimatePrice').textContent = `$${finalEstimate}`;

    } catch (error) {
      console.error('Error calculating estimate:', error);
      document.getElementById('estimatePrice').textContent = 'Unable to calculate estimate';
    }
  }

  async getServiceBaseRate() {
    // Get the base rate from the selected service
    if (!this.selectedService?.id) {
      // If no specific service selected, get default base price
      try {
        const { data: services, error } = await window.supabase
          .from('services')
          .select('service_base_price, base_quote_price')
          .eq('is_active', true)
          .limit(1);

        if (!error && services.length > 0) {
          // Use base_quote_price if available, otherwise service_base_price
          return services[0].base_quote_price || services[0].service_base_price || 150;
        }
      } catch (error) {
        console.error('Error fetching default service rate:', error);
      }
      return 150; // Business default rate
    }

    try {
      const { data: service, error } = await window.supabase
        .from('services')
        .select('service_base_price, base_quote_price')
        .eq('id', this.selectedService.id)
        .single();

      if (error) {
        console.error('Error fetching service rate:', error);
        return 150; // Business default rate
      }

      // Use base_quote_price if available for quotes, otherwise service_base_price
      return service.base_quote_price || service.service_base_price || 150;
    } catch (error) {
      console.error('Error getting service base rate:', error);
      return 150; // Business default rate
    }
  }

  async getWeekendMultiplier() {
    try {
      const eventDates = this.getEventDates();
      console.log('Event dates for weekend check:', eventDates);

      if (eventDates.length === 0) {
        return 1.0; // No dates, no uplift
      }

      // For multi-day events, we need to pro-rate the pricing
      if (this.eventStructure === 'multi_day' && eventDates.length > 1) {
        return await this.getMultiDayWeekendMultiplier(eventDates);
      } else {
        // Single day - apply full weekend uplift if weekend
        return await this.getSingleDayWeekendMultiplier(eventDates[0]);
      }
    } catch (error) {
      console.error('Error getting weekend multiplier:', error);
      return 1.0;
    }
  }

  async getSingleDayWeekendMultiplier(dateStr) {
    if (!dateStr) return 1.0;

    const date = new Date(dateStr);
    const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
    console.log(`Single day: ${dateStr}, Day of week: ${dayOfWeek}`);

    if (dayOfWeek === 0 || dayOfWeek === 6) {
      // Weekend date - get normal hours uplift (08:00-18:00)
      const { data: pricingRule, error } = await window.supabase
        .from('time_pricing_rules')
        .select('uplift_percentage')
        .eq('day_of_week', dayOfWeek.toString())
        .eq('start_time', '08:00:00')
        .eq('end_time', '18:00:00')
        .eq('is_active', true)
        .single();

      if (!error && pricingRule) {
        const upliftPercent = parseFloat(pricingRule.uplift_percentage);
        const multiplier = 1 + (upliftPercent / 100); // Convert 25.00 to 1.25
        console.log(`Weekend uplift: ${upliftPercent}% = ${multiplier}x multiplier`);
        return multiplier;
      } else {
        console.error('Error fetching weekend pricing rule:', error);
        return 1.0;
      }
    }

    return 1.0; // Weekday, no uplift
  }

  async getMultiDayWeekendMultiplier(eventDates) {
    console.log('Calculating pro-rated multi-day weekend multiplier');

    let totalMultiplier = 0;
    const totalDays = eventDates.length;

    for (const dateStr of eventDates) {
      if (!dateStr) {
        totalMultiplier += 1.0; // Empty date = weekday rate
        continue;
      }

      const date = new Date(dateStr);
      const dayOfWeek = date.getDay();
      console.log(`Multi-day date: ${dateStr}, Day of week: ${dayOfWeek}`);

      if (dayOfWeek === 0 || dayOfWeek === 6) {
        // Weekend date - get normal hours uplift
        const { data: pricingRule, error } = await window.supabase
          .from('time_pricing_rules')
          .select('uplift_percentage')
          .eq('day_of_week', dayOfWeek.toString())
          .eq('start_time', '08:00:00')
          .eq('end_time', '18:00:00')
          .eq('is_active', true)
          .single();

        if (!error && pricingRule) {
          const upliftPercent = parseFloat(pricingRule.uplift_percentage);
          const dayMultiplier = 1 + (upliftPercent / 100);
          totalMultiplier += dayMultiplier;
          console.log(`Weekend day: ${upliftPercent}% uplift = ${dayMultiplier}x`);
        } else {
          totalMultiplier += 1.0; // Fallback to no uplift
          console.error(`Error fetching weekend pricing for ${dateStr}:`, error);
        }
      } else {
        totalMultiplier += 1.0; // Weekday, no uplift
        console.log(`Weekday: no uplift = 1.0x`);
      }
    }

    // Calculate average multiplier across all days
    const averageMultiplier = totalMultiplier / totalDays;
    console.log(`Multi-day average multiplier: ${averageMultiplier} (${totalMultiplier} total / ${totalDays} days)`);

    return averageMultiplier;
  }

  getEventDates() {
    const dates = [];

    if (this.eventStructure === 'single_day') {
      const singleDate = document.getElementById('singleEventDate')?.value;
      console.log('Single day date:', singleDate);
      if (singleDate) dates.push(singleDate);
    } else {
      // Multi-day: get all date inputs
      const dateInputs = document.querySelectorAll('.event-date');
      console.log('Multi-day date inputs found:', dateInputs.length);
      dateInputs.forEach((input, index) => {
        console.log(`Date input ${index}:`, input.value);
        if (input.value) dates.push(input.value);
      });
    }

    console.log('All collected dates:', dates);
    return dates;
  }

  getUrgencyMultiplier() {
    const urgency = document.getElementById('urgency')?.value;

    // Apply 10% premium for urgent requests (less than 3 days)
    if (urgency === 'within_3_days' || urgency === 'urgent_24h') {
      return 1.10; // 10% uplift
    }

    return 1.0; // No urgency premium
  }

  async calculateTotalAmount() {
    const numberOfServices = parseInt(document.getElementById('numberOfServices')?.value) || 0;
    const durationPerService = parseInt(document.getElementById('durationPerService')?.value) || 0;

    if (numberOfServices <= 0 || durationPerService <= 0) {
      return 0.00;
    }

    const totalMinutes = numberOfServices * durationPerService;
    const totalHours = totalMinutes / 60;

    // Get base rate from services table
    const baseRate = await this.getServiceBaseRate();

    // Base calculation: Total Duration (Minutes/60) × Base Price for Service
    let amount = totalHours * baseRate;

    // Note: Weekend uplifts are applied in the display estimate function
    // For database storage, we keep the base amount

    return Math.round(amount * 100) / 100; // Ensure 2 decimal places
  }

  calculateTherapistFees() {
    const totalAmount = this.calculateTotalAmount();
    if (totalAmount <= 0) {
      return 0.00;
    }
    // Simplified calculation - 56% of total amount
    return Math.round(totalAmount * 0.56 * 100) / 100;
  }

  async saveQuoteToDatabase(quoteData) {
    console.log('Attempting to save quote data:', quoteData);

    const { data, error } = await window.supabase
      .from('quotes')
      .insert(quoteData)
      .select('id')
      .single();

    if (error) {
      console.error('Database error details:', error);
      console.error('Quote data that failed:', quoteData);
      throw new Error(`Failed to save quote request: ${error.message || error.hint || 'Unknown database error'}`);
    }

    console.log('Quote saved successfully:', data);
    return data;
  }

  async saveQuoteDates(quoteId) {
    console.log('🔍 saveQuoteDates called with quoteId:', quoteId);

    // First, update the quote record with the correct number of days
    const dateRows = document.querySelectorAll('.multi-day-date-row');
    console.log('🔍 Found date rows:', dateRows.length);

    // Update the quote with the actual number of event days
    if (dateRows.length > 0) {
      console.log('📝 Updating quote with number_of_event_days:', dateRows.length);
      const { error: updateError } = await window.supabase
        .from('quotes')
        .update({ number_of_event_days: dateRows.length })
        .eq('id', quoteId);

      if (updateError) {
        console.error('Error updating quote event days:', updateError);
        throw new Error('Failed to update quote event days');
      }
    }

    const quoteDates = [];

    dateRows.forEach((row, index) => {
      const dateInput = row.querySelector('.event-date');
      const startTimeInput = row.querySelector('.event-start-time');
      const finishTimeInput = row.querySelector('.event-finish-time');

      console.log(`🔍 Row ${index}:`, {
        dateValue: dateInput?.value,
        startTimeValue: startTimeInput?.value,
        finishTimeValue: finishTimeInput?.value
      });

      if (dateInput && startTimeInput && dateInput.value && startTimeInput.value) {
        // Calculate sessions per day for this quote
        const numberOfServices = parseInt(document.getElementById('numberOfServices')?.value) || 0;
        const sessionsThisDay = Math.ceil(numberOfServices / Math.max(dateRows.length, 1));

        const quoteDate = {
          quote_id: quoteId,
          event_date: dateInput.value,
          start_time: startTimeInput.value,
          finish_time: finishTimeInput?.value || null,
          day_number: index + 1,
          sessions_count: sessionsThisDay,
          duration_minutes: parseInt(document.getElementById('durationPerService')?.value) || 0
        };
        quoteDates.push(quoteDate);
        console.log('✅ Added quote date:', quoteDate);
      }
    });

    console.log('🔍 Total quote dates to save:', quoteDates.length);

    if (quoteDates.length > 0) {
      console.log('💾 Saving quote dates to database...');
      const { data, error } = await window.supabase
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

  async sendQuoteConfirmationEmail(quoteData) {
    try {
      console.log('📧 Sending quote confirmation email...');

      // Prepare email data matching the enhanced template
      const emailData = {
        to_email: quoteData.customer_email,
        to_name: quoteData.customer_name,
        customer_name: quoteData.customer_name,
        customer_email: quoteData.customer_email,
        customer_phone: quoteData.customer_phone,
        company_name: quoteData.company_name || 'Not provided',

        // Quote reference
        quote_id: quoteData.id,

        // Event structure and details
        event_structure: quoteData.event_structure,
        event_structure_display: quoteData.event_structure === 'single_day' ? 'Single Day Event' : 'Multi-Day Event',
        event_name: quoteData.event_name || 'Corporate Wellness Event',
        event_type: quoteData.event_type || 'Not specified',
        event_location: quoteData.event_location,
        expected_attendees: quoteData.expected_attendees || 'Not specified',

        // Event dates (formatted based on structure)
        event_dates: this.formatEventDates(quoteData),

        // Session specifications
        total_sessions: quoteData.total_sessions,
        session_duration_minutes: quoteData.session_duration_minutes,
        sessions_per_day: quoteData.sessions_per_day,
        therapists_needed: quoteData.therapists_needed,

        // Business requirements
        payment_method: this.formatPaymentMethod(quoteData.payment_method),
        urgency: this.formatUrgency(quoteData.urgency),
        po_number: quoteData.po_number || 'Not provided',

        // Special requirements
        setup_requirements: quoteData.setup_requirements || 'None specified',
        special_requirements: quoteData.special_requirements || 'None specified',

        // Price estimate
        estimated_price_range: this.formatPriceRange(quoteData.total_amount)
      };

      console.log('📧 Quote email template data:', emailData);

      // Send email using EmailJS (assuming EmailService is available)
      if (window.EmailService && typeof window.EmailService.sendQuoteConfirmationEmail === 'function') {
        const result = await window.EmailService.sendQuoteConfirmationEmail(emailData);
        console.log('✅ Quote confirmation email sent:', result);
      } else {
        console.log('⚠️ EmailService not available, skipping email');
      }

    } catch (error) {
      console.error('❌ Error sending quote confirmation email:', error);
      // Don't throw error - email failure shouldn't stop quote submission
    }
  }

  formatEventDates(quoteData) {
    if (quoteData.event_structure === 'single_day') {
      const date = quoteData.single_event_date;
      const time = quoteData.single_start_time;
      return `${date} at ${time}`;
    } else {
      // For multi-day, we'd need to fetch from quote_dates table
      // For now, show the number of days
      const days = quoteData.number_of_event_days || 'multiple';
      return `${days} day event (dates to be confirmed)`;
    }
  }

  formatPaymentMethod(method) {
    const methods = {
      'invoice': 'Invoice (Net 30)',
      'card': 'Credit Card',
      'bank_transfer': 'Bank Transfer/EFT'
    };
    return methods[method] || method;
  }

  formatUrgency(urgency) {
    const urgencies = {
      'flexible': 'Flexible timing',
      'within_week': 'Within 1 week',
      'within_3_days': 'Within 3 days',
      'urgent_24h': 'Urgent (24 hours)'
    };
    return urgencies[urgency] || urgency;
  }

  formatPriceRange(totalAmount) {
    if (!totalAmount || totalAmount <= 0) {
      return 'To be calculated';
    }
    const lowEstimate = Math.round(totalAmount * 0.8);
    const highEstimate = Math.round(totalAmount * 1.2);
    return `$${lowEstimate} - $${highEstimate}`;
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