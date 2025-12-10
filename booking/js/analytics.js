/**
 * Google Analytics 4 Event Tracking for Booking Funnel
 * Tracks user progression through booking steps to identify drop-off points
 */

// Initialize dataLayer if it doesn't exist
window.dataLayer = window.dataLayer || [];

/**
 * Push event to Google Tag Manager dataLayer
 * @param {string} eventName - Name of the event
 * @param {object} eventParams - Additional event parameters
 */
function trackEvent(eventName, eventParams = {}) {
  try {
    window.dataLayer.push({
      event: eventName,
      ...eventParams
    });
    console.log('📊 Analytics Event:', eventName, eventParams);
  } catch (error) {
    console.error('Failed to track event:', eventName, error);
  }
}

/**
 * Track booking funnel step progression
 * @param {number} stepNumber - Current step number (0-10)
 * @param {string} stepName - Human-readable step name
 * @param {object} additionalData - Extra context data
 */
function trackBookingStep(stepNumber, stepName, additionalData = {}) {
  trackEvent('booking_step_view', {
    step_number: stepNumber,
    step_name: stepName,
    booking_type: window.bookingType || 'unknown',
    ...additionalData
  });
}

/**
 * Track step completion (when user clicks Continue/Next)
 * @param {number} stepNumber - Completed step number
 * @param {string} stepName - Human-readable step name
 * @param {object} additionalData - Extra context data
 */
function trackStepComplete(stepNumber, stepName, additionalData = {}) {
  trackEvent('booking_step_complete', {
    step_number: stepNumber,
    step_name: stepName,
    booking_type: window.bookingType || 'unknown',
    ...additionalData
  });
}

/**
 * Track when user goes back to a previous step (potential abandonment signal)
 * @param {number} fromStep - Step user is leaving
 * @param {number} toStep - Step user is going to
 */
function trackStepBack(fromStep, toStep) {
  trackEvent('booking_step_back', {
    from_step: fromStep,
    to_step: toStep,
    booking_type: window.bookingType || 'unknown'
  });
}

/**
 * Track booking method selection (instant vs quote)
 * @param {string} bookingType - 'instant' or 'quote'
 */
function trackBookingTypeSelection(bookingType) {
  trackEvent('booking_type_selected', {
    booking_type: bookingType
  });
}

/**
 * Track service/therapy selection
 * @param {string} serviceName - Selected service name
 * @param {number} duration - Service duration in minutes
 */
function trackServiceSelection(serviceName, duration) {
  trackEvent('service_selected', {
    service_name: serviceName,
    service_duration: duration,
    booking_type: window.bookingType || 'unknown'
  });
}

/**
 * Track therapist selection
 * @param {string} therapistId - Selected therapist ID
 * @param {string} therapistName - Selected therapist name
 */
function trackTherapistSelection(therapistId, therapistName) {
  trackEvent('therapist_selected', {
    therapist_id: therapistId,
    therapist_name: therapistName,
    booking_type: window.bookingType || 'unknown'
  });
}

/**
 * Track payment initiation
 * @param {number} amount - Payment amount
 */
function trackPaymentInitiated(amount) {
  trackEvent('begin_checkout', {
    value: amount,
    currency: 'AUD',
    booking_type: window.bookingType || 'unknown'
  });
}

/**
 * Track successful booking completion
 * @param {string} bookingId - Booking ID
 * @param {number} amount - Total amount
 * @param {object} bookingDetails - Full booking details
 */
function trackBookingComplete(bookingId, amount, bookingDetails = {}) {
  trackEvent('purchase', {
    transaction_id: bookingId,
    value: amount,
    currency: 'AUD',
    booking_type: window.bookingType || 'unknown',
    ...bookingDetails
  });
}

/**
 * Track booking errors/failures
 * @param {string} errorType - Type of error
 * @param {string} errorMessage - Error message
 * @param {number} stepNumber - Step where error occurred
 */
function trackBookingError(errorType, errorMessage, stepNumber) {
  trackEvent('booking_error', {
    error_type: errorType,
    error_message: errorMessage,
    step_number: stepNumber,
    booking_type: window.bookingType || 'unknown'
  });
}

/**
 * Track form field interactions (for drop-off analysis)
 * @param {string} fieldName - Form field name
 * @param {string} action - 'focus', 'blur', 'error'
 */
function trackFieldInteraction(fieldName, action) {
  trackEvent('form_field_interaction', {
    field_name: fieldName,
    action: action,
    booking_type: window.bookingType || 'unknown'
  });
}

/**
 * Track address validation results
 * @param {boolean} success - Whether address validated successfully
 * @param {boolean} coverage - Whether area has therapist coverage
 */
function trackAddressValidation(success, coverage) {
  trackEvent('address_validated', {
    validation_success: success,
    has_coverage: coverage,
    booking_type: window.bookingType || 'unknown'
  });
}

/**
 * Track quote request submission
 * @param {string} quoteId - Quote request ID
 * @param {object} quoteDetails - Quote details
 */
function trackQuoteRequest(quoteId, quoteDetails = {}) {
  trackEvent('quote_requested', {
    quote_id: quoteId,
    ...quoteDetails
  });
}

// Export functions to global scope
window.analyticsTracker = {
  trackEvent,
  trackBookingStep,
  trackStepComplete,
  trackStepBack,
  trackBookingTypeSelection,
  trackServiceSelection,
  trackTherapistSelection,
  trackPaymentInitiated,
  trackBookingComplete,
  trackBookingError,
  trackFieldInteraction,
  trackAddressValidation,
  trackQuoteRequest
};

// Track page load
window.addEventListener('DOMContentLoaded', () => {
  trackEvent('booking_page_load', {
    referrer: document.referrer,
    url: window.location.href
  });
});
