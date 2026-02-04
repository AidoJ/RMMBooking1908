/**
 * Booking Reschedule Function - Self-Service Interactive Page
 *
 * Serves an interactive HTML page that allows clients to reschedule their bookings.
 * - Select new date/time
 * - Choose different therapist (optional) - filtered by service area
 * - See price comparison
 * - Process payment via Stripe Elements if price increases
 * - Process reschedule via client-reschedule API
 *
 * Policy: Can reschedule up to 3 hours before appointment, max 2 times.
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Generate the interactive reschedule page
function generateInteractiveHTML(booking, token, rescheduleCount) {
  const bookingDate = new Date(booking.booking_time);
  const formattedDate = bookingDate.toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const formattedTime = bookingDate.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
  const therapistName = booking.therapist_profiles
    ? `${booking.therapist_profiles.first_name} ${booking.therapist_profiles.last_name}`
    : 'To be assigned';
  const remainingReschedules = 2 - (rescheduleCount || 0);

  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reschedule Booking - Rejuvenators Mobile Massage</title>
    <script src="https://js.stripe.com/v3/"></script>
    <style>
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
        .container { max-width: 700px; margin: 30px auto; background-color: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background: linear-gradient(135deg, #007e8c, #005f6b); color: white; padding: 30px 20px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { padding: 25px; }

        .current-booking { background-color: #f8f9fa; padding: 20px; border-radius: 10px; margin-bottom: 25px; border: 1px solid #e9ecef; }
        .current-booking h3 { margin: 0 0 15px 0; color: #333; font-size: 16px; }
        .booking-detail { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
        .booking-detail:last-child { border-bottom: none; }
        .booking-detail .label { color: #666; }
        .booking-detail .value { font-weight: 600; color: #333; }

        .remaining-badge { display: inline-block; background: #e8f4f5; color: #007e8c; padding: 6px 12px; border-radius: 20px; font-size: 13px; margin-top: 10px; }

        .step { margin-bottom: 25px; }
        .step-header { display: flex; align-items: center; margin-bottom: 15px; }
        .step-number { width: 30px; height: 30px; background: #007e8c; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; margin-right: 12px; }
        .step-title { font-size: 16px; font-weight: 600; color: #333; }

        .form-group { margin-bottom: 15px; }
        .form-group label { display: block; margin-bottom: 8px; font-weight: 500; color: #555; }

        input[type="date"], select { width: 100%; padding: 12px 15px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 16px; transition: border-color 0.2s; }
        input[type="date"]:focus, select:focus { outline: none; border-color: #007e8c; }

        .time-slots { display: grid; grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); gap: 10px; margin-top: 10px; }
        .time-slot { padding: 12px; text-align: center; border: 2px solid #e0e0e0; border-radius: 8px; cursor: pointer; transition: all 0.2s; font-weight: 500; }
        .time-slot:hover { border-color: #007e8c; background: #f0f9fa; }
        .time-slot.selected { background: #007e8c; color: white; border-color: #007e8c; }
        .time-slot.disabled { opacity: 0.4; cursor: not-allowed; background: #f5f5f5; }

        .therapist-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; margin-top: 10px; }
        .therapist-card { padding: 15px; text-align: center; border: 2px solid #e0e0e0; border-radius: 10px; cursor: pointer; transition: all 0.2s; }
        .therapist-card:hover { border-color: #007e8c; transform: translateY(-2px); }
        .therapist-card.selected { background: #e8f4f5; border-color: #007e8c; }
        .therapist-card .name { font-weight: 600; margin-top: 8px; }
        .therapist-card .badge { font-size: 12px; color: #666; }
        .therapist-card.current .badge { color: #28a745; }

        .price-comparison { background: linear-gradient(135deg, #f8f9fa, #e9ecef); padding: 20px; border-radius: 10px; margin: 20px 0; }
        .price-row { display: flex; justify-content: space-between; padding: 10px 0; }
        .price-row.total { border-top: 2px solid #dee2e6; margin-top: 10px; padding-top: 15px; font-weight: bold; font-size: 18px; }
        .price-row .amount { font-weight: 600; }
        .price-row .amount.positive { color: #dc3545; }
        .price-row .amount.negative { color: #28a745; }
        .price-row .amount.zero { color: #666; }

        .price-note { background: #fff3cd; color: #856404; padding: 12px 15px; border-radius: 8px; margin-top: 15px; font-size: 14px; }
        .price-note.info { background: #e8f4f5; color: #007e8c; }

        /* Payment section */
        .payment-section { background: #f8fafc; border: 2px solid #cbd5e1; border-radius: 10px; padding: 20px; margin: 20px 0; }
        .payment-section h4 { margin: 0 0 15px 0; color: #374151; }
        .payment-section p { color: #6b7280; font-size: 14px; margin-bottom: 16px; }
        #stripe-card-element { padding: 12px 14px; border: 2px solid #e5e7eb; border-radius: 6px; background: white; }
        .card-errors { color: #dc3545; font-size: 14px; margin-top: 10px; }
        .payment-success { background: #d4edda; color: #155724; padding: 12px; border-radius: 8px; margin-top: 15px; text-align: center; font-weight: 600; }

        .btn { display: block; width: 100%; padding: 16px; border: none; border-radius: 10px; font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.2s; text-align: center; }
        .btn-primary { background: #007e8c; color: white; }
        .btn-primary:hover { background: #006570; }
        .btn-primary:disabled { background: #ccc; cursor: not-allowed; }
        .btn-payment { background: #0891b2; color: white; margin-bottom: 10px; }
        .btn-payment:hover { background: #0e7490; }
        .btn-secondary { background: #f8f9fa; color: #333; border: 2px solid #dee2e6; margin-top: 10px; text-decoration: none; }
        .btn-secondary:hover { background: #e9ecef; }

        .loading { display: none; align-items: center; justify-content: center; padding: 20px; }
        .loading.active { display: flex; }
        .spinner { width: 24px; height: 24px; border: 3px solid #e0e0e0; border-top-color: #007e8c; border-radius: 50%; animation: spin 0.8s linear infinite; margin-right: 12px; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .message { padding: 15px; border-radius: 8px; margin: 15px 0; display: none; }
        .message.error { background: #f8d7da; color: #721c24; display: block; }
        .message.success { background: #d4edda; color: #155724; display: block; }

        .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; font-size: 14px; border-top: 1px solid #eee; }

        .hidden { display: none !important; }

        /* Success page styles */
        .success-container { text-align: center; padding: 40px 20px; }
        .success-icon { font-size: 64px; margin-bottom: 20px; }
        .success-title { font-size: 24px; color: #28a745; margin-bottom: 15px; }
        .success-details { background: #f8f9fa; padding: 20px; border-radius: 10px; text-align: left; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📅 Reschedule Your Booking</h1>
        </div>

        <div class="content" id="mainContent">
            <!-- Current Booking Details -->
            <div class="current-booking">
                <h3>Current Booking</h3>
                <div class="booking-detail">
                    <span class="label">Booking ID</span>
                    <span class="value">${booking.booking_id}</span>
                </div>
                <div class="booking-detail">
                    <span class="label">Service</span>
                    <span class="value">${booking.services?.name || 'Massage'}</span>
                </div>
                <div class="booking-detail">
                    <span class="label">Duration</span>
                    <span class="value">${booking.duration_minutes} minutes</span>
                </div>
                <div class="booking-detail">
                    <span class="label">Date & Time</span>
                    <span class="value">${formattedDate} at ${formattedTime}</span>
                </div>
                <div class="booking-detail">
                    <span class="label">Therapist</span>
                    <span class="value">${therapistName}</span>
                </div>
                <div class="booking-detail">
                    <span class="label">Location</span>
                    <span class="value">${booking.address || 'N/A'}</span>
                </div>
                <div class="booking-detail">
                    <span class="label">Current Price</span>
                    <span class="value">$${(booking.client_fee || booking.price || 0).toFixed(2)}</span>
                </div>
                <div class="remaining-badge">
                    ${remainingReschedules} reschedule${remainingReschedules !== 1 ? 's' : ''} remaining
                </div>
            </div>

            <!-- Step 1: Select Date -->
            <div class="step">
                <div class="step-header">
                    <div class="step-number">1</div>
                    <div class="step-title">Select New Date</div>
                </div>
                <div class="form-group">
                    <input type="date" id="newDate" min="${new Date().toISOString().split('T')[0]}" />
                </div>
            </div>

            <!-- Step 2: Select Time -->
            <div class="step" id="timeStep">
                <div class="step-header">
                    <div class="step-number">2</div>
                    <div class="step-title">Select New Time</div>
                </div>
                <div class="loading" id="timeLoading">
                    <div class="spinner"></div>
                    <span>Loading available times...</span>
                </div>
                <div class="time-slots" id="timeSlots"></div>
                <p id="noTimesMessage" class="hidden" style="color: #666; text-align: center; padding: 20px;">
                    No available times for this date. Please select a different date.
                </p>
            </div>

            <!-- Step 3: Select Therapist (Optional) -->
            <div class="step" id="therapistStep">
                <div class="step-header">
                    <div class="step-number">3</div>
                    <div class="step-title">Choose Therapist (Optional)</div>
                </div>
                <p style="color: #666; font-size: 14px; margin-bottom: 15px;">
                    You can keep your current therapist or choose a different available therapist.
                </p>
                <div class="loading" id="therapistLoading">
                    <div class="spinner"></div>
                    <span>Loading available therapists...</span>
                </div>
                <div class="therapist-cards" id="therapistCards"></div>
            </div>

            <!-- Price Comparison -->
            <div class="price-comparison" id="priceComparison">
                <div class="price-row">
                    <span>Original Price</span>
                    <span class="amount">$${(booking.client_fee || booking.price || 0).toFixed(2)}</span>
                </div>
                <div class="price-row">
                    <span>New Price</span>
                    <span class="amount" id="newPriceDisplay">$${(booking.client_fee || booking.price || 0).toFixed(2)}</span>
                </div>
                <div class="price-row total">
                    <span>Difference</span>
                    <span class="amount zero" id="priceDifferenceDisplay">$0.00</span>
                </div>
                <div class="price-note info hidden" id="priceNote">
                    Additional payment will be charged to your card.
                </div>
            </div>

            <!-- Payment Section (shown when price increases) -->
            <div class="payment-section hidden" id="paymentSection">
                <h4>💳 Payment Required</h4>
                <p>The new time has a higher price. Please enter your card details to authorize the additional payment.</p>
                <div id="stripe-card-element"></div>
                <div class="card-errors" id="cardErrors"></div>
                <div class="payment-success hidden" id="paymentSuccess">
                    ✅ Payment authorized successfully!
                </div>
                <button class="btn btn-payment" id="authorizePaymentBtn" style="margin-top: 15px;">
                    Authorize Payment
                </button>
            </div>

            <!-- Error Message -->
            <div class="message" id="errorMessage"></div>

            <!-- Submit Button -->
            <button class="btn btn-primary" id="submitBtn" disabled>
                Confirm Reschedule
            </button>
            <a href="https://rejuvenators.com" class="btn btn-secondary">Cancel</a>

            <!-- Loading overlay for submission -->
            <div class="loading" id="submitLoading" style="margin-top: 20px;">
                <div class="spinner"></div>
                <span>Processing your reschedule...</span>
            </div>
        </div>

        <!-- Success Page (hidden initially) -->
        <div class="content hidden" id="successContent">
            <div class="success-container">
                <div class="success-icon">⏳</div>
                <h2 class="success-title" style="color: #007e8c;">Reschedule Request Submitted</h2>
                <p>Your reschedule request has been sent to the therapist for confirmation.</p>
                <div class="success-details" id="successDetails"></div>
                <div style="background: #fff3cd; color: #856404; padding: 15px; border-radius: 8px; margin-top: 20px;">
                    <strong>What happens next?</strong><br>
                    The therapist will review your request and confirm availability. You'll receive an SMS and email once confirmed.
                </div>
                <p style="color: #666; margin-top: 15px;">
                    Your original booking remains active until the reschedule is confirmed.
                </p>
                <a href="https://rejuvenators.com" class="btn btn-primary" style="margin-top: 20px;">
                    Return to Website
                </a>
            </div>
        </div>

        <div class="footer">
            <p>Questions? Call us at <a href="tel:1300302542" style="color: #007e8c;">1300 302 542</a></p>
        </div>
    </div>

    <script>
        // State
        const token = '${token}';
        const bookingId = '${booking.id}';
        const currentTherapistId = '${booking.therapist_id || ''}';
        const serviceId = '${booking.service_id}';
        const durationMinutes = ${booking.duration_minutes};
        const genderPreference = '${booking.gender_preference || 'any'}';
        const originalPrice = ${booking.client_fee || booking.price || 0};
        const originalBookingTime = '${booking.booking_time}';
        const bookingTimezone = '${booking.booking_timezone || 'Australia/Brisbane'}';
        const bookingLat = ${booking.latitude || 'null'};
        const bookingLng = ${booking.longitude || 'null'};

        let selectedDate = null;
        let selectedTime = null;
        let selectedTherapistId = currentTherapistId;
        let availableTherapists = [];
        let newPrice = originalPrice;
        let priceDifference = 0;
        let therapistAvailability = {};

        // Stripe
        let stripe = null;
        let cardElement = null;
        let paymentAuthorized = false;
        let paymentIntentClientSecret = null;
        let paymentIntentId = null;

        const API_BASE = '/.netlify/functions';

        // Elements
        const dateInput = document.getElementById('newDate');
        const timeSlotsContainer = document.getElementById('timeSlots');
        const timeLoading = document.getElementById('timeLoading');
        const noTimesMessage = document.getElementById('noTimesMessage');
        const therapistCardsContainer = document.getElementById('therapistCards');
        const therapistLoading = document.getElementById('therapistLoading');
        const submitBtn = document.getElementById('submitBtn');
        const submitLoading = document.getElementById('submitLoading');
        const errorMessage = document.getElementById('errorMessage');
        const newPriceDisplay = document.getElementById('newPriceDisplay');
        const priceDifferenceDisplay = document.getElementById('priceDifferenceDisplay');
        const priceNote = document.getElementById('priceNote');
        const paymentSection = document.getElementById('paymentSection');
        const cardErrors = document.getElementById('cardErrors');
        const paymentSuccess = document.getElementById('paymentSuccess');
        const authorizePaymentBtn = document.getElementById('authorizePaymentBtn');

        // Initialize Stripe
        async function initStripe() {
            try {
                const response = await fetch(API_BASE + '/get-stripe-key');
                const data = await response.json();
                if (data.publishableKey) {
                    stripe = Stripe(data.publishableKey);
                    const elements = stripe.elements();
                    cardElement = elements.create('card', {
                        style: {
                            base: {
                                fontSize: '16px',
                                color: '#333',
                                fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
                                '::placeholder': { color: '#aab7c4' }
                            }
                        }
                    });
                    cardElement.mount('#stripe-card-element');
                    cardElement.on('change', (event) => {
                        cardErrors.textContent = event.error ? event.error.message : '';
                    });
                    console.log('✅ Stripe initialized');
                }
            } catch (error) {
                console.error('Failed to initialize Stripe:', error);
            }
        }

        // Date change handler
        dateInput.addEventListener('change', async (e) => {
            selectedDate = e.target.value;
            selectedTime = null;
            selectedTherapistId = currentTherapistId;
            paymentAuthorized = false;
            paymentSuccess.classList.add('hidden');

            if (!selectedDate) return;

            // Load available time slots
            await loadAvailableSlots();
        });

        // Load available time slots for selected date
        async function loadAvailableSlots() {
            timeLoading.classList.add('active');
            timeSlotsContainer.innerHTML = '';
            noTimesMessage.classList.add('hidden');
            therapistCardsContainer.innerHTML = '';

            if (!bookingLat || !bookingLng) {
                showError('Booking location not found. Please contact us to reschedule.');
                timeLoading.classList.remove('active');
                return;
            }

            try {
                // Fetch therapist availability for this date with location filtering
                const url = \`\${API_BASE}/get-available-slots?date=\${selectedDate}&service_id=\${serviceId}&duration=\${durationMinutes}&gender=\${genderPreference}&booking_id=\${bookingId}&latitude=\${bookingLat}&longitude=\${bookingLng}\`;
                console.log('Fetching slots:', url);

                const response = await fetch(url);
                const data = await response.json();

                if (data.error) {
                    throw new Error(data.error);
                }

                therapistAvailability = data.therapistAvailability || {};
                availableTherapists = data.therapists || [];

                console.log('Available therapists:', availableTherapists.length);
                console.log('Therapist availability:', therapistAvailability);

                // Get all unique time slots
                const allSlots = new Set();
                Object.values(therapistAvailability).forEach(slots => {
                    slots.forEach(slot => allSlots.add(slot));
                });

                const sortedSlots = Array.from(allSlots).sort();

                if (sortedSlots.length === 0) {
                    noTimesMessage.classList.remove('hidden');
                } else {
                    sortedSlots.forEach(slot => {
                        const slotEl = document.createElement('div');
                        slotEl.className = 'time-slot';
                        slotEl.textContent = slot;
                        slotEl.addEventListener('click', () => selectTimeSlot(slot, slotEl));
                        timeSlotsContainer.appendChild(slotEl);
                    });
                }
            } catch (error) {
                console.error('Error loading slots:', error);
                showError('Failed to load available times. Please try again.');
            } finally {
                timeLoading.classList.remove('active');
            }
        }

        // Select time slot
        function selectTimeSlot(time, element) {
            // Remove previous selection
            document.querySelectorAll('.time-slot.selected').forEach(el => el.classList.remove('selected'));
            element.classList.add('selected');
            selectedTime = time;
            paymentAuthorized = false;
            paymentSuccess.classList.add('hidden');

            // Update therapist cards based on availability for this slot
            updateTherapistCards();
            updatePrice();
            validateForm();
        }

        // Update therapist cards
        function updateTherapistCards() {
            therapistCardsContainer.innerHTML = '';

            if (!selectedTime) return;

            // Filter therapists available for selected time
            const availableForTime = availableTherapists.filter(t => {
                const slots = therapistAvailability[t.id] || [];
                return slots.includes(selectedTime);
            });

            console.log('Therapists available for', selectedTime, ':', availableForTime.length);

            availableForTime.forEach(therapist => {
                const card = document.createElement('div');
                const isCurrent = therapist.id === currentTherapistId;
                const isSelected = therapist.id === selectedTherapistId;

                card.className = 'therapist-card' + (isSelected ? ' selected' : '') + (isCurrent ? ' current' : '');
                card.innerHTML = \`
                    <div class="name">\${therapist.first_name} \${therapist.last_name}</div>
                    <div class="badge">\${isCurrent ? '✓ Current' : 'Available'}</div>
                \`;
                card.addEventListener('click', () => selectTherapist(therapist.id, card));
                therapistCardsContainer.appendChild(card);
            });

            // If current therapist not available, auto-select first available
            if (!availableForTime.find(t => t.id === selectedTherapistId) && availableForTime.length > 0) {
                selectedTherapistId = availableForTime[0].id;
                const firstCard = therapistCardsContainer.querySelector('.therapist-card');
                if (firstCard) firstCard.classList.add('selected');
            }
        }

        // Select therapist
        function selectTherapist(therapistId, element) {
            document.querySelectorAll('.therapist-card.selected').forEach(el => el.classList.remove('selected'));
            element.classList.add('selected');
            selectedTherapistId = therapistId;
            validateForm();
        }

        // Update price display
        async function updatePrice() {
            if (!selectedDate || !selectedTime) return;

            try {
                const dateTime = \`\${selectedDate}T\${selectedTime}:00\`;
                // Use reschedule mode: pass original_price and original_booking_time
                // This calculates only the time-based uplift difference
                const url = \`\${API_BASE}/calculate-price?booking_time=\${encodeURIComponent(dateTime)}&original_price=\${originalPrice}&original_booking_time=\${encodeURIComponent(originalBookingTime)}\`;
                console.log('Calculating reschedule price:', url);
                const response = await fetch(url);
                const data = await response.json();

                if (data.price !== undefined) {
                    newPrice = data.price;
                    priceDifference = data.priceDifference || 0;
                    console.log('Price calculation result:', { newPrice, priceDifference, breakdown: data.breakdown });

                    newPriceDisplay.textContent = '$' + newPrice.toFixed(2);

                    if (priceDifference > 0) {
                        priceDifferenceDisplay.textContent = '+$' + priceDifference.toFixed(2);
                        priceDifferenceDisplay.className = 'amount positive';
                        priceNote.classList.remove('hidden');
                        priceNote.textContent = 'Additional $' + priceDifference.toFixed(2) + ' payment required.';
                        priceNote.className = 'price-note';

                        // Show payment section
                        paymentSection.classList.remove('hidden');
                        paymentAuthorized = false;
                        paymentSuccess.classList.add('hidden');
                    } else if (priceDifference < 0) {
                        priceDifferenceDisplay.textContent = '-$' + Math.abs(priceDifference).toFixed(2);
                        priceDifferenceDisplay.className = 'amount negative';
                        priceNote.classList.remove('hidden');
                        priceNote.textContent = 'The new time is cheaper, but no refund will be issued.';
                        priceNote.className = 'price-note info';

                        // Hide payment section
                        paymentSection.classList.add('hidden');
                        paymentAuthorized = false;
                    } else {
                        priceDifferenceDisplay.textContent = '$0.00';
                        priceDifferenceDisplay.className = 'amount zero';
                        priceNote.classList.add('hidden');

                        // Hide payment section
                        paymentSection.classList.add('hidden');
                        paymentAuthorized = false;
                    }

                    validateForm();
                }
            } catch (error) {
                console.error('Error calculating price:', error);
            }
        }

        // Authorize payment
        authorizePaymentBtn.addEventListener('click', async () => {
            if (!stripe || !cardElement) {
                showError('Payment system not ready. Please refresh the page.');
                return;
            }

            authorizePaymentBtn.disabled = true;
            authorizePaymentBtn.textContent = 'Processing...';
            cardErrors.textContent = '';

            try {
                // Step 1: Create payment intent
                const response = await fetch(API_BASE + '/create-payment-intent', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        amount: priceDifference,
                        currency: 'aud',
                        bookingData: {
                            booking_id: '${booking.booking_id}',
                            customer_email: '${booking.customer_email || ''}',
                            service_name: '${booking.services?.name || 'Massage'}',
                            booking_time: selectedDate + 'T' + selectedTime + ':00',
                            additional_payment: true,
                            reschedule: true
                        }
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to create payment');
                }

                const { client_secret } = await response.json();
                paymentIntentClientSecret = client_secret;

                // Step 2: Confirm card payment
                const { error, paymentIntent } = await stripe.confirmCardPayment(client_secret, {
                    payment_method: {
                        card: cardElement,
                        billing_details: {
                            name: '${(booking.first_name || '') + ' ' + (booking.last_name || '')}',
                            email: '${booking.customer_email || ''}'
                        }
                    }
                });

                if (error) {
                    throw new Error(error.message);
                }

                if (paymentIntent.status === 'requires_capture') {
                    paymentAuthorized = true;
                    paymentIntentId = paymentIntent.id; // Store payment intent ID for capture
                    paymentSuccess.classList.remove('hidden');
                    authorizePaymentBtn.classList.add('hidden');
                    validateForm();
                    console.log('✅ Payment authorized:', paymentIntent.id);
                } else {
                    throw new Error('Payment authorization failed. Status: ' + paymentIntent.status);
                }

            } catch (error) {
                console.error('Payment error:', error);
                cardErrors.textContent = error.message;
            } finally {
                authorizePaymentBtn.disabled = false;
                authorizePaymentBtn.textContent = 'Authorize Payment';
            }
        });

        // Validate form
        function validateForm() {
            const hasSelection = selectedDate && selectedTime && selectedTherapistId;
            const paymentOk = priceDifference <= 0 || paymentAuthorized;
            submitBtn.disabled = !(hasSelection && paymentOk);
        }

        // Show error message
        function showError(message) {
            errorMessage.textContent = message;
            errorMessage.className = 'message error';
        }

        // Hide error message
        function hideError() {
            errorMessage.className = 'message';
        }

        // Submit reschedule
        submitBtn.addEventListener('click', async () => {
            hideError();
            submitBtn.disabled = true;
            submitLoading.classList.add('active');

            try {
                const newBookingTime = \`\${selectedDate}T\${selectedTime}:00\`;

                const response = await fetch(\`\${API_BASE}/client-reschedule\`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        token: token,
                        new_booking_time: newBookingTime,
                        new_therapist_id: selectedTherapistId,
                        payment_intent_id: paymentIntentId,
                        payment_intent_client_secret: paymentIntentClientSecret
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || data.message || 'Failed to reschedule');
                }

                // Show success page
                showSuccessPage(data);

            } catch (error) {
                console.error('Reschedule error:', error);
                showError(error.message || 'Failed to reschedule. Please try again or contact us.');
                submitBtn.disabled = false;
            } finally {
                submitLoading.classList.remove('active');
            }
        });

        // Show success page
        function showSuccessPage(data) {
            document.getElementById('mainContent').classList.add('hidden');
            document.getElementById('successContent').classList.remove('hidden');

            const booking = data.booking;
            const newDate = new Date(booking.new_booking_time);

            document.getElementById('successDetails').innerHTML = \`
                <div class="booking-detail">
                    <span class="label">Booking ID</span>
                    <span class="value">\${booking.booking_id}</span>
                </div>
                <div class="booking-detail">
                    <span class="label">Status</span>
                    <span class="value" style="color: #856404;">Pending Confirmation</span>
                </div>
                <div class="booking-detail">
                    <span class="label">Requested Date & Time</span>
                    <span class="value">\${newDate.toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} at \${newDate.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div class="booking-detail">
                    <span class="label">Requested Therapist</span>
                    <span class="value">\${booking.new_therapist}</span>
                </div>
                <div class="booking-detail">
                    <span class="label">Price</span>
                    <span class="value">$\${booking.new_price.toFixed(2)}</span>
                </div>
                \${booking.price_difference > 0 ? \`
                <div class="booking-detail">
                    <span class="label">Additional Payment</span>
                    <span class="value" style="color: #856404;">$\${booking.price_difference.toFixed(2)} (authorized, pending capture)</span>
                </div>
                \` : ''}
            \`;
        }

        // Initialize
        initStripe();
    </script>
</body>
</html>`;
}

function generateErrorHTML(title, message) {
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - Rejuvenators Mobile Massage</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 50px auto; background-color: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background: linear-gradient(135deg, #007e8c, #005f6b); color: white; padding: 30px 20px; text-align: center; }
        .content { padding: 30px 20px; }
        .error { background-color: #f8d7da; color: #721c24; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc3545; }
        .error h2 { margin-top: 0; }
        .contact-box { background-color: #e8f4f5; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
        .contact-box a { color: #007e8c; font-weight: bold; font-size: 18px; }
        .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; font-size: 14px; }
        .btn { display: inline-block; padding: 12px 24px; background-color: #007e8c; color: white; text-decoration: none; border-radius: 8px; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Rejuvenators Mobile Massage</h1>
        </div>
        <div class="content">
            <div class="error">
                <h2>❌ ${title}</h2>
                <p>${message}</p>
            </div>
            <div class="contact-box">
                <p>Need help? Contact us:</p>
                <p><a href="tel:1300302542">1300 302 542</a></p>
                <p><a href="mailto:info@rejuvenators.com">info@rejuvenators.com</a></p>
            </div>
            <p style="text-align: center;">
                <a href="https://rejuvenators.com" class="btn">Return to Website</a>
            </p>
        </div>
        <div class="footer">
            <p>Thank you for choosing Rejuvenators Mobile Massage</p>
        </div>
    </div>
</body>
</html>`;
}

function generateLimitReachedHTML(booking) {
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reschedule Limit Reached - Rejuvenators Mobile Massage</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 50px auto; background-color: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background: linear-gradient(135deg, #007e8c, #005f6b); color: white; padding: 30px 20px; text-align: center; }
        .content { padding: 30px 20px; }
        .warning { background-color: #fff3cd; color: #856404; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107; }
        .warning h2 { margin-top: 0; }
        .booking-info { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .contact-box { background-color: #28a745; color: white; padding: 25px; border-radius: 8px; margin: 20px 0; text-align: center; }
        .contact-box a { color: white; font-size: 20px; }
        .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; font-size: 14px; }
        .btn { display: inline-block; padding: 12px 24px; background-color: #007e8c; color: white; text-decoration: none; border-radius: 8px; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📅 Reschedule Request</h1>
        </div>
        <div class="content">
            <div class="warning">
                <h2>⚠️ Reschedule Limit Reached</h2>
                <p>This booking has already been rescheduled 2 times, which is the maximum allowed for self-service rescheduling.</p>
                <p>Please contact us directly to make any further changes to your appointment.</p>
            </div>
            <div class="booking-info">
                <p><strong>Booking ID:</strong> ${booking.booking_id}</p>
                <p><strong>Current Date:</strong> ${new Date(booking.booking_time).toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
            <div class="contact-box">
                <h3 style="margin-top: 0;">📞 Contact Us</h3>
                <p><a href="tel:1300302542">1300 302 542</a></p>
                <p><a href="mailto:info@rejuvenators.com?subject=Reschedule%20Booking%20${booking.booking_id}">info@rejuvenators.com</a></p>
            </div>
            <p style="text-align: center;">
                <a href="https://rejuvenators.com" class="btn">Return to Website</a>
            </p>
        </div>
        <div class="footer">
            <p>Thank you for choosing Rejuvenators Mobile Massage</p>
        </div>
    </div>
</body>
</html>`;
}

exports.handler = async (event, context) => {
  const headers = {
    'Content-Type': 'text/html',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  console.log(`📅 Booking reschedule request: ${event.httpMethod} with token: ${event.queryStringParameters?.token}`);

  try {
    const token = event.queryStringParameters?.token;

    if (!token) {
      return {
        statusCode: 400,
        headers,
        body: generateErrorHTML('Invalid Request', 'No reschedule token provided. Please use the link from your confirmation email.')
      };
    }

    // Look up booking by reschedule token - include lat/lng for location filtering
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        services (id, name, service_base_price),
        therapist_profiles!bookings_therapist_id_fkey (id, first_name, last_name, email, phone)
      `)
      .eq('reschedule_token', token)
      .single();

    if (bookingError || !booking) {
      console.error('Booking lookup error:', bookingError);
      return {
        statusCode: 404,
        headers,
        body: generateErrorHTML('Booking Not Found', 'This reschedule link is invalid or has expired. Please contact us if you need assistance.')
      };
    }

    // Check if already cancelled
    if (booking.status === 'cancelled' || booking.status === 'client_cancelled') {
      return {
        statusCode: 400,
        headers,
        body: generateErrorHTML('Booking Cancelled', 'This booking has been cancelled and cannot be rescheduled.')
      };
    }

    // Check if booking is completed
    if (booking.status === 'completed') {
      return {
        statusCode: 400,
        headers,
        body: generateErrorHTML('Booking Completed', 'This booking has already been completed and cannot be rescheduled.')
      };
    }

    // Calculate time until booking
    const now = new Date();
    const bookingTime = new Date(booking.booking_time);
    const hoursUntil = (bookingTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Check 3-hour window
    if (hoursUntil < 3) {
      return {
        statusCode: 400,
        headers,
        body: generateErrorHTML(
          'Cannot Reschedule',
          'Your booking is in less than 3 hours. Per our policy, appointments cannot be rescheduled within 3 hours of the scheduled time. Please call us at 1300 302 542 for emergency assistance.'
        )
      };
    }

    // Check reschedule limit
    const rescheduleCount = booking.reschedule_count || 0;
    if (rescheduleCount >= 2) {
      return {
        statusCode: 400,
        headers,
        body: generateLimitReachedHTML(booking)
      };
    }

    // Verify booking has location data
    if (!booking.latitude || !booking.longitude) {
      console.warn('⚠️ Booking missing location data:', booking.id);
      return {
        statusCode: 400,
        headers,
        body: generateErrorHTML(
          'Cannot Reschedule Online',
          'This booking does not have location data required for online rescheduling. Please call us at 1300 302 542 to reschedule your appointment.'
        )
      };
    }

    // All checks passed - show interactive reschedule page
    return {
      statusCode: 200,
      headers,
      body: generateInteractiveHTML(booking, token, rescheduleCount)
    };

  } catch (error) {
    console.error('Reschedule page error:', error);
    return {
      statusCode: 500,
      headers,
      body: generateErrorHTML('Error', 'An unexpected error occurred. Please contact us at 1300 302 542 for assistance.')
    };
  }
};
