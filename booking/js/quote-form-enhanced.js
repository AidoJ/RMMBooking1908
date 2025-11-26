// ENHANCED QUOTE FORM JAVASCRIPT - Complete Implementation with Time Validation & Pricing
// Integrates with quotes table and quote_dates table per business requirements

class QuoteFormManager {
  constructor() {
    this.eventStructure = 'multi_day'; // Always use unified multi-day structure
    this.multiDayDates = [];
    this.selectedService = null;
    this.detectedTimezone = null; // Store detected timezone
    this.setupEventListeners();
    this.initializeUnifiedForm();
  }

  // Detect Australian timezone from coordinates
  detectTimezoneFromCoords(lat, lng) {
    if (!lat || !lng) {
      console.warn('⚠️ No coordinates provided for timezone detection');
      return 'Australia/Sydney';
    }

    // Western Australia (Perth - no DST)
    if (lng >= 112.5 && lng < 129) return 'Australia/Perth';

    // Northern Territory (Darwin - no DST)
    if (lat > -26 && lng >= 129 && lng < 138) return 'Australia/Darwin';

    // South Australia (Adelaide - has DST)
    if (lat <= -26 && lng >= 129 && lng < 141) return 'Australia/Adelaide';

    // Queensland (Brisbane - no DST)
    if (lat > -29 && lng >= 138 && lng < 154) return 'Australia/Brisbane';

    // Victoria (Melbourne - has DST)
    if (lat <= -34 && lng >= 141 && lng < 150) return 'Australia/Melbourne';

    // Tasmania (Hobart - has DST)
    if (lat <= -40) return 'Australia/Hobart';

    // NSW/ACT (Sydney - has DST) - default for eastern Australia
    if (lng >= 141) return 'Australia/Sydney';

    console.warn('⚠️ Could not determine timezone, defaulting to Sydney');
    return 'Australia/Sydney';
  }

  // Get timezone display name
  getTimezoneDisplayName(timezone) {
    const timezoneNames = {
      'Australia/Perth': 'Perth (AWST, UTC+8, no DST)',
      'Australia/Adelaide': 'Adelaide (ACST/ACDT, UTC+9:30/+10:30)',
      'Australia/Darwin': 'Darwin (ACST, UTC+9:30, no DST)',
      'Australia/Brisbane': 'Brisbane (AEST, UTC+10, no DST)',
      'Australia/Sydney': 'Sydney (AEST/AEDT, UTC+10/+11)',
      'Australia/Melbourne': 'Melbourne (AEST/AEDT, UTC+10/+11)',
      'Australia/Hobart': 'Hobart (AEST/AEDT, UTC+10/+11)'
    };
    return timezoneNames[timezone] || timezone;
  }

  // Get timezone abbreviation (considers current date for DST)
  getTimezoneAbbreviation(timezone, date = new Date()) {
    const month = date.getMonth(); // 0-11
    // October (9) to March (2) is summer in Australia (DST period)
    const isDST = month >= 9 || month <= 2;

    const abbreviations = {
      'Australia/Perth': 'AWST', // No DST
      'Australia/Darwin': 'ACST', // No DST
      'Australia/Brisbane': 'AEST', // No DST
      'Australia/Adelaide': isDST ? 'ACDT' : 'ACST',
      'Australia/Sydney': isDST ? 'AEDT' : 'AEST',
      'Australia/Melbourne': isDST ? 'AEDT' : 'AEST',
      'Australia/Hobart': isDST ? 'AEDT' : 'AEST'
    };

    return abbreviations[timezone] || '';
  }

  // Show timezone notification
  showTimezoneNotification(timezone) {
    const container = document.getElementById('quoteTimezoneNotification');
    if (!container) return;

    const displayName = this.getTimezoneDisplayName(timezone);
    const abbreviation = this.getTimezoneAbbreviation(timezone);

    container.innerHTML = `
      <div style="
        background-color: #e6f7ff;
        border: 1px solid #91d5ff;
        border-radius: 4px;
        padding: 12px 16px;
        margin: 12px 0;
        display: flex;
        align-items: center;
        gap: 8px;
      ">
        <span style="font-size: 18px;">🕐</span>
        <div>
          <strong>Timezone Detected:</strong> ${displayName}
          <br>
          <small style="color: #666;">All event times will be interpreted as ${abbreviation}</small>
        </div>
      </div>
    `;
    container.style.display = 'block';
  }

  setupEventListeners() {
    // Number of days management (unified approach)
    document.getElementById('numberOfDays')?.addEventListener('change', (e) => {
      this.generateMultiDayFields(parseInt(e.target.value));
    });

    document.getElementById('addEventDate')?.addEventListener('click', () => {
      this.addEventDateField();
    });

    // Auto-populate service sessions from attendees (UX improvement)
    document.getElementById('expectedAttendees')?.addEventListener('input', (e) => {
      const attendees = parseInt(e.target.value) || 0;
      const numberOfServicesField = document.getElementById('numberOfServices');
      if (attendees > 0 && numberOfServicesField) {
        // Auto-populate but allow user to edit
        numberOfServicesField.value = attendees;
        // Trigger validation/calculation
        this.validateAndCalculate();
      }
    });

    // Real-time calculation listeners
    document.getElementById('numberOfServices')?.addEventListener('input', () => this.validateAndCalculate());
    // Note: durationPerService is now a calculated field, no need for change listener

    // Submit handler
    document.getElementById('submitQuoteRequest')?.addEventListener('click', () => this.submitQuoteRequest());

    // Address autocomplete
    this.setupAddressAutocomplete();
  }

  initializeUnifiedForm() {
    // Always show multi-day fields and hide single day fields
    const multiDayFields = document.getElementById('multiDayFields');
    const singleDayFields = document.getElementById('singleDayFields');

    if (multiDayFields) {
      multiDayFields.classList.add('active');
    }

    if (singleDayFields) {
      singleDayFields.style.display = 'none';
    }

    // Initialize with 1 day by default (unified single day handling)
    const numberOfDaysInput = document.getElementById('numberOfDays');
    if (numberOfDaysInput && !numberOfDaysInput.value) {
      numberOfDaysInput.value = 1;
      this.generateMultiDayFields(1);
    }
  }

  handleEventStructureChange(structure) {
    // Always use unified multi-day structure
    this.eventStructure = 'multi_day';

    // Always show multi-day fields
    const multiDayFields = document.getElementById('multiDayFields');
    multiDayFields.classList.add('active');

    // Hide single day fields (deprecated)
    const singleDayFields = document.getElementById('singleDayFields');
    if (singleDayFields) {
      singleDayFields.style.display = 'none';
    }

    this.validateAndCalculate();
  }

  generateMultiDayFields(numberOfDays) {
    const container = document.getElementById('multiDayDates');
    container.innerHTML = '';
    this.multiDayDates = [];

    for (let i = 1; i <= numberOfDays; i++) {
      this.addEventDateField(i);
    }

    this.validateAndCalculate();
  }

  addEventDateField(dayNumber = null) {
    const container = document.getElementById('multiDayDates');
    // Calculate next day number based on existing date rows, not multiDayDates array
    const existingRows = document.querySelectorAll('.multi-day-date-row');
    const dayNum = dayNumber || existingRows.length + 1;

    const dateRow = document.createElement('div');
    dateRow.className = 'multi-day-date-row';
    dateRow.innerHTML = `
      <div class="day-number">Day ${dayNum}</div>
      <div class="date-time-grid">
        <div class="form-group">
          <label>Event Date *</label>
          <input type="date" class="event-date" data-day="${dayNum}" required />
          <div class="date-validation-message" id="date-validation-${dayNum}" style="display: none; color: red; font-size: 12px; margin-top: 4px;"></div>
        </div>
        <div class="form-group">
          <label>Event Start Time *</label>
          <input type="time" class="event-start-time" data-day="${dayNum}" step="900" required />
          <div class="time-validation-message" id="time-validation-${dayNum}" style="display: none; color: red; font-size: 12px; margin-top: 4px;"></div>
        </div>
        <div class="form-group">
          <label>Event Finish Time *</label>
          <input type="time" class="event-finish-time" data-day="${dayNum}" step="900" required />
        </div>
      </div>
      ${!dayNumber ? '<button type="button" class="remove-day-btn" onclick="quoteForm.removeEventDate(this)">Remove Day</button>' : ''}
    `;

    container.appendChild(dateRow);

    // Add event listeners for date and time validation
    const dateInput = dateRow.querySelector('.event-date');
    const startTimeInput = dateRow.querySelector('.event-start-time');
    const finishTimeInput = dateRow.querySelector('.event-finish-time');

    // Set up date restrictions and smart defaults
    this.setupDateInput(dateInput, dayNum);
    this.setupTimeInputs(startTimeInput, finishTimeInput, dayNum);

    // Add change listeners
    dateInput.addEventListener('change', () => {
      this.updateSequentialDateRestrictions(dayNum);
      this.validateAndCalculate();
    });
    startTimeInput.addEventListener('change', () => {
      this.updateFinishTimeDefault(dayNum);
      this.validateAndCalculate();
    });
    finishTimeInput.addEventListener('change', () => this.validateAndCalculate());

    if (!dayNumber) {
      this.multiDayDates.push({ day: dayNum, date: '', startTime: '', finishTime: '' });
    }

    this.validateAndCalculate();
  }

  removeEventDate(button) {
    const row = button.closest('.multi-day-date-row');
    const dayNum = parseInt(row.querySelector('.event-date').dataset.day);

    row.remove();
    this.multiDayDates = this.multiDayDates.filter(d => d.day !== dayNum);

    // Renumber remaining days
    this.renumberDays();
    this.validateAndCalculate();
  }

  renumberDays() {
    const dateRows = document.querySelectorAll('.multi-day-date-row');
    dateRows.forEach((row, index) => {
      const dayNum = index + 1;
      row.querySelector('.day-number').textContent = `Day ${dayNum}`;
      row.querySelector('.event-date').dataset.day = dayNum;
      row.querySelector('.event-start-time').dataset.day = dayNum;
      row.querySelector('.event-finish-time').dataset.day = dayNum;
      // Update validation message IDs
      const dateValidationMsg = row.querySelector('.date-validation-message');
      const timeValidationMsg = row.querySelector('.time-validation-message');
      if (dateValidationMsg) dateValidationMsg.id = `date-validation-${dayNum}`;
      if (timeValidationMsg) timeValidationMsg.id = `time-validation-${dayNum}`;
    });

    // Update multiDayDates array
    this.multiDayDates.forEach((date, index) => {
      date.day = index + 1;
    });

    // Update date restrictions after renumbering
    this.updateAllDateRestrictions();
  }

  // NEW: Setup date input with restrictions and smart defaults
  setupDateInput(dateInput, dayNum) {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    if (dayNum === 1) {
      // Day 1: Cannot be before today
      dateInput.setAttribute('min', todayStr);
    } else {
      // Day 2+: Get previous day's date to set minimum
      const previousDateInput = document.querySelector(`.event-date[data-day="${dayNum - 1}"]`);
      if (previousDateInput && previousDateInput.value) {
        const previousDate = new Date(previousDateInput.value);
        previousDate.setDate(previousDate.getDate() + 1);
        const minDate = previousDate.toISOString().split('T')[0];
        dateInput.setAttribute('min', minDate);
        
        // Set smart default: previous day + 1
        dateInput.value = minDate;
      } else {
        // Fallback to today if previous day not set
        dateInput.setAttribute('min', todayStr);
      }
    }
  }

  // NEW: Setup time inputs with smart defaults
  setupTimeInputs(startTimeInput, finishTimeInput, dayNum) {
    // No default for start time - user must select
    // Finish time will be auto-populated when start time is selected
  }

  // NEW: Update finish time default when start time changes
  updateFinishTimeDefault(dayNum) {
    const startTimeInput = document.querySelector(`.event-start-time[data-day="${dayNum}"]`);
    const finishTimeInput = document.querySelector(`.event-finish-time[data-day="${dayNum}"]`);
    
    if (startTimeInput && finishTimeInput && startTimeInput.value) {
      const startTime = startTimeInput.value;
      const [hours, minutes] = startTime.split(':').map(Number);
      
      // Add 1 hour to start time
      const finishDate = new Date();
      finishDate.setHours(hours + 1, minutes, 0, 0);
      
      // Format as HH:MM
      const finishTime = `${finishDate.getHours().toString().padStart(2, '0')}:${finishDate.getMinutes().toString().padStart(2, '0')}`;
      
      finishTimeInput.value = finishTime;
    }
  }

  // NEW: Update sequential date restrictions when any date changes
  updateSequentialDateRestrictions(changedDayNum) {
    const changedDateInput = document.querySelector(`.event-date[data-day="${changedDayNum}"]`);
    if (!changedDateInput || !changedDateInput.value) return;

    const changedDate = new Date(changedDateInput.value);
    const nextDate = new Date(changedDate);
    nextDate.setDate(nextDate.getDate() + 1);
    const nextDateStr = nextDate.toISOString().split('T')[0];

    // Update all subsequent days
    const allDateInputs = document.querySelectorAll('.event-date');
    allDateInputs.forEach(input => {
      const dayNum = parseInt(input.dataset.day);
      if (dayNum > changedDayNum) {
        input.setAttribute('min', nextDateStr);
        
        // Update smart default if current value is invalid
        if (!input.value || input.value < nextDateStr) {
          input.value = nextDateStr;
        }
      }
    });
  }

  // NEW: Update all date restrictions (used when removing days)
  updateAllDateRestrictions() {
    const allDateInputs = document.querySelectorAll('.event-date');
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    allDateInputs.forEach(input => {
      const dayNum = parseInt(input.dataset.day);
      
      if (dayNum === 1) {
        input.setAttribute('min', todayStr);
      } else {
        const previousDateInput = document.querySelector(`.event-date[data-day="${dayNum - 1}"]`);
        if (previousDateInput && previousDateInput.value) {
          const previousDate = new Date(previousDateInput.value);
          previousDate.setDate(previousDate.getDate() + 1);
          const minDate = previousDate.toISOString().split('T')[0];
          input.setAttribute('min', minDate);
        } else {
          input.setAttribute('min', todayStr);
        }
      }
    });
  }

  // NEW: Validate dates and times with visual feedback
  validateDatesAndTimes() {
    const dateInputs = document.querySelectorAll('.event-date');
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    let hasErrors = false;

    // Clear previous validation messages
    document.querySelectorAll('.date-validation-message, .time-validation-message').forEach(msg => {
      msg.style.display = 'none';
      msg.textContent = '';
    });

    // Remove error classes
    document.querySelectorAll('.event-date, .event-start-time, .event-finish-time').forEach(input => {
      input.classList.remove('validation-error');
    });

    dateInputs.forEach((dateInput, index) => {
      const dayNum = parseInt(dateInput.dataset.day);
      const dateValidationMsg = document.getElementById(`date-validation-${dayNum}`);
      const startTimeInput = document.querySelector(`.event-start-time[data-day="${dayNum}"]`);
      const finishTimeInput = document.querySelector(`.event-finish-time[data-day="${dayNum}"]`);
      const timeValidationMsg = document.getElementById(`time-validation-${dayNum}`);

      // Validate date
      if (dateInput.value) {
        if (dateInput.value < todayStr) {
          dateValidationMsg.textContent = 'Date cannot be in the past';
          dateValidationMsg.style.display = 'block';
          dateInput.classList.add('validation-error');
          hasErrors = true;
        } else if (dayNum > 1) {
          // Check if date is before previous day
          const previousDateInput = document.querySelector(`.event-date[data-day="${dayNum - 1}"]`);
          if (previousDateInput && previousDateInput.value && dateInput.value <= previousDateInput.value) {
            dateValidationMsg.textContent = `Date must be after Day ${dayNum - 1}`;
            dateValidationMsg.style.display = 'block';
            dateInput.classList.add('validation-error');
            hasErrors = true;
          }
        }
      }

      // Validate times
      if (startTimeInput && finishTimeInput && startTimeInput.value && finishTimeInput.value) {
        const startTime = startTimeInput.value;
        const finishTime = finishTimeInput.value;
        
        if (finishTime <= startTime) {
          timeValidationMsg.textContent = 'Finish time must be after start time';
          timeValidationMsg.style.display = 'block';
          startTimeInput.classList.add('validation-error');
          finishTimeInput.classList.add('validation-error');
          hasErrors = true;
        }
      }
    });

    return !hasErrors;
  }

  // CORE BUSINESS LOGIC: Time Validation & Calculation
  validateAndCalculate() {
    console.log('🔍 Starting time validation and calculation...');

    // NEW: Validate dates and times first
    this.validateDatesAndTimes();

    // Calculate event schedule time
    const eventScheduleMinutes = this.calculateEventScheduleTime();

    // Calculate service requirements time
    const serviceRequirementsMinutes = this.calculateServiceRequirementsTime();

    // Update display
    document.getElementById('eventScheduleTime').textContent =
      eventScheduleMinutes > 0 ? `${eventScheduleMinutes} minutes` : '-';

    document.getElementById('serviceRequirementsTime').textContent =
      serviceRequirementsMinutes > 0 ? `${serviceRequirementsMinutes} minutes` : '-';

    // Calculate and update average service duration (Event Schedule Time ÷ Total Sessions)
    this.updateAverageServiceDuration(eventScheduleMinutes);

    // Validate times match
    const validationMessage = document.getElementById('timeValidationMessage');

    if (eventScheduleMinutes > 0 && serviceRequirementsMinutes > 0) {
      if (eventScheduleMinutes === serviceRequirementsMinutes) {
        // Times match - valid!
        document.getElementById('totalValidatedTime').textContent = `${eventScheduleMinutes} minutes`;
        validationMessage.className = 'validation-message success';
        validationMessage.textContent = '✅ Event schedule and service requirements match perfectly!';
        validationMessage.style.display = 'block';

        // Calculate pricing
        this.calculatePricing(eventScheduleMinutes);

      } else {
        // Times don't match - show error
        document.getElementById('totalValidatedTime').textContent = 'Times do not match';
        validationMessage.className = 'validation-message error';
        validationMessage.textContent = 'The number of sessions compared to the requested times above do not match. Either increase your dates/times above or reduce your number of sessions or durations.';
        validationMessage.style.display = 'block';

        // Clear pricing
        document.getElementById('estimatePrice').textContent = 'Fix time mismatch above';
      }
    } else {
      // Not enough data yet
      document.getElementById('totalValidatedTime').textContent = '-';
      validationMessage.style.display = 'none';
      document.getElementById('estimatePrice').textContent = 'Enter details above';
    }

    // Update session display
    const numberOfServices = parseInt(document.getElementById('numberOfServices')?.value) || 0;
    const durationPerService = parseInt(document.getElementById('durationPerService')?.value) || 0;

    document.getElementById('estimateSessions').textContent = numberOfServices || '-';
    document.getElementById('estimateDuration').textContent =
      durationPerService ? `${durationPerService} min` : '-';
  }

  calculateEventScheduleTime() {
    console.log('📅 Calculating event schedule time using unified structure');

    // Always use unified multi-day structure
    let totalMinutes = 0;

    const dateRows = document.querySelectorAll('.multi-day-date-row');
    console.log('Date rows found:', dateRows.length);

    dateRows.forEach((row, index) => {
      const startTime = row.querySelector('.event-start-time')?.value;
      const finishTime = row.querySelector('.event-finish-time')?.value;

      console.log(`Day ${index + 1} times:`, { startTime, finishTime });

      if (startTime && finishTime) {
        const start = new Date(`1970-01-01T${startTime}:00`);
        const finish = new Date(`1970-01-01T${finishTime}:00`);

        const diffMs = finish - start;
        const dayMinutes = Math.max(0, diffMs / (1000 * 60));

        console.log(`Day ${index + 1} minutes:`, dayMinutes);
        totalMinutes += dayMinutes;
      }
    });

    console.log('Total event schedule time:', totalMinutes);
    return totalMinutes;
  }

  calculateServiceRequirementsTime() {
    // Since durationPerService is now calculated, we should use the event schedule time
    // The service requirements should match the event schedule when properly calculated
    const numberOfServices = parseInt(document.getElementById('numberOfServices')?.value) || 0;

    if (numberOfServices <= 0) {
      console.log('Service requirements: No services specified');
      return 0;
    }

    // Get the calculated event schedule time
    const eventScheduleMinutes = this.calculateEventScheduleTime();

    console.log('Service requirements based on event schedule:', { numberOfServices, eventScheduleMinutes });

    return eventScheduleMinutes;
  }

  // UX IMPROVEMENT: Auto-calculate average service duration
  updateAverageServiceDuration(eventScheduleMinutes) {
    const numberOfServices = parseInt(document.getElementById('numberOfServices')?.value) || 0;
    const durationField = document.getElementById('durationPerService');

    if (eventScheduleMinutes > 0 && numberOfServices > 0 && durationField) {
      const averageDuration = Math.round(eventScheduleMinutes / numberOfServices);
      durationField.value = averageDuration;
      console.log('📊 Auto-calculated average service duration:', averageDuration, 'minutes');
    } else if (durationField) {
      durationField.value = '';
    }
  }

  async calculatePricing(validatedMinutes) {
    console.log('💰 Calculating pricing for', validatedMinutes, 'minutes');

    // Check minimum 2 hours requirement
    if (validatedMinutes < 120) {
      document.getElementById('estimatePrice').innerHTML =
        '<span style="color: #dc3545; font-weight: bold;">⚠️ Quote request must be at least 120 minutes to proceed</span>';
      return;
    }

    try {
      // Get base rate from services
      const serviceBaseRate = await this.getServiceBaseRate();
      console.log('Service base rate:', serviceBaseRate);

      // Calculate base amount: Total Duration (Minutes/60) × Base Price for Service
      const totalHours = validatedMinutes / 60;
      let baseAmount = totalHours * serviceBaseRate;

      console.log('Base calculation:', { totalHours, baseAmount });

      // Apply weekend uplifts based on selected dates
      const weekendMultiplier = await this.getWeekendMultiplier();
      const finalAmount = baseAmount * weekendMultiplier;

      console.log('Final pricing:', { baseAmount, weekendMultiplier, finalAmount });

      // Display as range: 90% to 110% of calculated price
      const lowEstimate = Math.round(finalAmount * 0.9);
      const highEstimate = Math.round(finalAmount * 1.1);
      document.getElementById('estimatePrice').textContent = `$${lowEstimate} - $${highEstimate}`;

      // Store the actual calculated amount for database save (not displayed)
      document.getElementById('estimatePrice').dataset.actualAmount = Math.round(finalAmount);

    } catch (error) {
      console.error('Error calculating pricing:', error);
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
          .select('service_base_price')
          .eq('is_active', true)
          .limit(1);

        if (!error && services.length > 0) {
          // Use base_quote_price if available, otherwise service_base_price
          return services[0].service_base_price;
        }
      } catch (error) {
        console.error('Error fetching default service rate:', error);
      }
      return null; // No fallback - let it fail properly
    }

    try {
      const { data: service, error } = await window.supabase
        .from('services')
        .select('service_base_price')
        .eq('id', this.selectedService.id)
        .single();

      if (error) {
        console.error('Error fetching service rate:', error);
        return null; // No fallback - let it fail properly
      }

      // Use service_base_price
      return service.service_base_price;
    } catch (error) {
      console.error('Error getting service base rate:', error);
      return null; // No fallback - let it fail properly
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
        .eq('day_of_week', dayOfWeek)
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
          .eq('day_of_week', dayOfWeek)
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

    // Always use unified multi-day structure
    const dateInputs = document.querySelectorAll('.event-date');
    console.log('Date inputs found:', dateInputs.length);
    dateInputs.forEach((input, index) => {
      console.log(`Date input ${index}:`, input.value);
      if (input.value) dates.push(input.value);
    });

    console.log('All collected dates:', dates);
    return dates;
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
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();

        addressInput.dataset.lat = lat;
        addressInput.dataset.lng = lng;

        const statusDiv = document.getElementById('event-address-status');
        statusDiv.className = 'address-status success';
        statusDiv.textContent = '✓ Address verified';
        statusDiv.style.display = 'block';

        // Detect and display timezone
        this.detectedTimezone = this.detectTimezoneFromCoords(lat, lng);
        console.log(`🕐 Detected timezone: ${this.detectedTimezone} for quote event at (${lat}, ${lng})`);
        this.showTimezoneNotification(this.detectedTimezone);
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

      // Handle quote dates for all events (unified structure)
      await this.saveQuoteDates(quoteId);

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
    // NEW: First check date and time validation
    if (!this.validateDatesAndTimes()) {
      alert('Please fix the date and time validation errors before submitting.');
      return false;
    }

    // Check time validation
    const validationMessage = document.getElementById('timeValidationMessage');
    if (!validationMessage.classList.contains('success')) {
      alert('Please ensure your event schedule times match your service requirements.');
      return false;
    }

    const required = [
      'contactName', 'contactEmail', 'contactPhone', 'eventLocation',
      'numberOfServices', 'durationPerService', 'paymentMethod'
    ];

    // Validate unified event date/time fields
    const dateInputs = document.querySelectorAll('.event-date');
    const startTimeInputs = document.querySelectorAll('.event-start-time');
    const finishTimeInputs = document.querySelectorAll('.event-finish-time');

    if (dateInputs.length === 0) {
      alert('Please add at least one event date');
      return false;
    }

    for (let i = 0; i < dateInputs.length; i++) {
      if (!dateInputs[i].value || !startTimeInputs[i].value || !finishTimeInputs[i].value) {
        alert(`Please complete Day ${i + 1} date, start time, and finish time`);
        return false;
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
      event_location: locationInput.value.trim(),
      event_type: document.getElementById('eventType').value || null,
      company_name: document.getElementById('companyName').value.trim() || null,

      // Location coordinates and timezone
      latitude: parseFloat(locationInput.dataset.lat) || null,
      longitude: parseFloat(locationInput.dataset.lng) || null,
      event_timezone: this.detectedTimezone || 'Australia/Sydney', // Store detected timezone

      // Service specifications (aligned with database schema)
      total_sessions: parseInt(document.getElementById('numberOfServices').value) || 0,
      session_duration_minutes: parseInt(document.getElementById('durationPerService').value) || 0,
      expected_attendees: parseInt(document.getElementById('expectedAttendees').value) || null,

      // Duration - capture the Total Validated Time that's calculated in validation
      duration_minutes: this.calculateEventScheduleTime(),

      // Calculate therapists needed based on total time
      therapists_needed: this.calculateTherapistsNeeded(),

      // Business requirements
      payment_method: document.getElementById('paymentMethod').value || 'card',

      // Requirements - merged into single field
      setup_requirements: null, // Deprecated - merged with special_requirements
      special_requirements: document.getElementById('specialRequirements').value.trim() || null,

      // Financial fields - basic values for database
      hourly_rate: 0, // Will be set from service_base_price in saveQuoteToDatabase
      total_amount: this.calculateBasicAmount(),
      total_therapist_fees: 0.00, // Will be calculated by admin, not client
      discount_amount: 0.00,
      tax_rate_amount: 0.00,
      final_amount: this.calculateBasicAmount(),

      // Status fields
      payment_status: 'pending',

      // Service reference
      service_id: this.selectedService?.id || null
    };

    // Add unified event fields
    const dateInputs = document.querySelectorAll('.event-date');
    const numberOfDays = Math.max(dateInputs.length, 1);
    data.number_of_event_days = numberOfDays;
    data.sessions_per_day = Math.ceil(data.total_sessions / numberOfDays);

    return data;
  }

  calculateBasicAmount() {
    // Get the actual calculated amount (stored as data attribute, not the displayed range)
    const estimatePriceElement = document.getElementById('estimatePrice');
    if (estimatePriceElement && estimatePriceElement.dataset.actualAmount) {
      const actualAmount = parseFloat(estimatePriceElement.dataset.actualAmount);
      if (!isNaN(actualAmount)) {
        return actualAmount;
      }
    }

    // Fallback if estimate not available
    return 0.00;
  }

  calculateTherapistsNeeded() {
    const numberOfServices = parseInt(document.getElementById('numberOfServices')?.value) || 0;
    const durationPerService = parseInt(document.getElementById('durationPerService')?.value) || 0;

    if (numberOfServices <= 0 || durationPerService <= 0) {
      return 1; // Default to 1 therapist if no data
    }

    const totalMinutes = numberOfServices * durationPerService;
    const totalHours = totalMinutes / 60;

    // Business logic: If total time < 12 hours → 1 therapist, if ≥ 12 hours → 2 therapists
    return totalHours < 12 ? 1 : 2;
  }

  // Helper function to calculate duration from start and finish times
  calculateDayDuration(startTime, finishTime) {
    if (!startTime || !finishTime) return 0;

    // Create Date objects for the same day with the given times
    const start = new Date(`2000-01-01 ${startTime}`);
    const end = new Date(`2000-01-01 ${finishTime}`);

    // Calculate difference in minutes
    const diffMilliseconds = end.getTime() - start.getTime();
    const diffMinutes = Math.round(diffMilliseconds / (1000 * 60));

    return diffMinutes > 0 ? diffMinutes : 0;
  }

  async saveQuoteToDatabase(quoteData) {
    console.log('Attempting to save quote data:', quoteData);

    // Lookup service_base_price and set hourly_rate
    if (quoteData.service_id) {
      const { data: serviceData, error: serviceError } = await window.supabase
        .from('services')
        .select('service_base_price')
        .eq('id', quoteData.service_id)
        .single();

      if (!serviceError && serviceData) {
        quoteData.hourly_rate = serviceData.service_base_price;
        console.log(`Set hourly_rate to ${serviceData.service_base_price} from service ${quoteData.service_id}`);
      } else {
        console.warn('Could not lookup service_base_price:', serviceError);
      }
    }

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

    const quoteDates = [];

    // Handle all events using unified multi-day structure
    const dateRows = document.querySelectorAll('.multi-day-date-row');
    console.log('🔍 Found date rows:', dateRows.length);

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

      dateRows.forEach((row, index) => {
        const dateInput = row.querySelector('.event-date');
        const startTimeInput = row.querySelector('.event-start-time');
        const finishTimeInput = row.querySelector('.event-finish-time');

        if (dateInput && startTimeInput && dateInput.value && startTimeInput.value) {
          // Calculate sessions per day for this quote
          const numberOfServices = parseInt(document.getElementById('numberOfServices')?.value) || 0;
          const sessionsThisDay = Math.ceil(numberOfServices / Math.max(dateRows.length, 1));

          // Calculate actual duration from start/finish times instead of session duration
          const calculatedDuration = this.calculateDayDuration(startTimeInput.value, finishTimeInput?.value);

          const quoteDate = {
            quote_id: quoteId,
            event_date: dateInput.value,
            start_time: startTimeInput.value,
            finish_time: finishTimeInput?.value || null,
            day_number: index + 1,
            sessions_count: sessionsThisDay,
            duration_minutes: calculatedDuration
          };
          quoteDates.push(quoteDate);
          console.log('✅ Added quote date:', quoteDate);
        }
      });
    }

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
        event_type: quoteData.event_type || 'Not specified',
        event_location: quoteData.event_location,
        expected_attendees: quoteData.expected_attendees || 'Not specified',

        // Event dates
        event_dates: this.formatEventDates(quoteData),

        // Session specifications
        total_sessions: quoteData.total_sessions,
        session_duration_minutes: quoteData.session_duration_minutes,
        sessions_per_day: quoteData.sessions_per_day,

        // Total event duration - using the validated time calculation
        total_event_duration: quoteData.duration_minutes,

        // Therapists needed
        therapists_needed: quoteData.therapists_needed,

        // Business requirements
        payment_method: this.formatPaymentMethod(quoteData.payment_method),

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
      const days = quoteData.number_of_event_days || 'multiple';
      return `${days} day event (dates to be confirmed)`;
    }
  }

  formatPaymentMethod(method) {
    const methods = {
      'card': 'Credit Card',
      'bank_transfer': 'Bank Transfer/EFT'
    };
    return methods[method] || method;
  }

  formatPriceRange(totalAmount) {
    if (!totalAmount || totalAmount <= 0) {
      return 'To be calculated';
    }
    const lowEstimate = Math.round(totalAmount * 0.9);
    const highEstimate = Math.round(totalAmount * 1.1);
    return `$${lowEstimate} - $${highEstimate}`;
  }

  showSuccessModal(quoteId) {
    // For now, show simple alert - replace with modal later
    alert(`Quote request submitted successfully! Reference: ${quoteId}\n\nWe'll review your request and send you a detailed quote within 24 hours.`);
  }

  // Initialize with service information
  initializeWithService(serviceData) {
    this.selectedService = serviceData;
    console.log('Initialized with service:', serviceData);
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

  // Clear service selection (updated for card-based system)
  const serviceDropdown = document.getElementById('service');
  if (serviceDropdown) {
    serviceDropdown.selectedIndex = 0;
  }

  // Clear card-based service selection
  document.querySelectorAll('.service-card').forEach(card => {
    card.classList.remove('selected');
  });

  // Clear all quote form data
  clearQuoteFormData();
}

// Helper function to clear all quote form fields
function clearQuoteFormData() {
  // Clear contact information
  document.getElementById('contactName').value = '';
  document.getElementById('contactEmail').value = '';
  document.getElementById('contactPhone').value = '';
  document.getElementById('companyName').value = '';

  // Clear event details
  document.getElementById('eventLocation').value = '';
  document.getElementById('eventLocation').removeAttribute('data-lat');
  document.getElementById('eventLocation').removeAttribute('data-lng');
  document.getElementById('eventType').selectedIndex = 0;
  document.getElementById('expectedAttendees').value = '';

  // Clear service specifications
  document.getElementById('numberOfServices').value = '';
  document.getElementById('durationPerService').value = '';

  // Clear payment method
  document.getElementById('paymentMethod').selectedIndex = 0;

  // Clear special requirements
  document.getElementById('specialRequirements').value = '';

  // Clear number of days dropdown
  document.getElementById('numberOfDays').selectedIndex = 0;

  // Clear all multi-day date fields
  const multiDayContainer = document.getElementById('multiDayDates');
  if (multiDayContainer) {
    multiDayContainer.innerHTML = '';
  }

  // Reset multiDayDates array in quote form manager
  if (window.quoteForm) {
    window.quoteForm.multiDayDates = [];
  }

  // Clear calculation displays
  document.getElementById('eventScheduleTime').textContent = '-';
  document.getElementById('serviceRequirementsTime').textContent = '-';
  document.getElementById('totalValidatedTime').textContent = '-';
  document.getElementById('estimateSessions').textContent = '-';
  document.getElementById('estimateDuration').textContent = '-';
  document.getElementById('estimatePrice').textContent = 'Enter details above';
  document.getElementById('estimatePrice').removeAttribute('data-actualAmount');

  // Hide validation message
  const validationMessage = document.getElementById('timeValidationMessage');
  if (validationMessage) {
    validationMessage.style.display = 'none';
  }

  // Clear address status
  const addressStatus = document.getElementById('event-address-status');
  if (addressStatus) {
    addressStatus.textContent = '';
    addressStatus.className = 'address-status';
    addressStatus.style.display = 'none';
  }
}