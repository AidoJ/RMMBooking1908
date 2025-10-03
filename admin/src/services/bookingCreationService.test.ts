// Test file for booking creation service
// This shows expected input/output for validation

import { createBookingsFromQuote } from './bookingCreationService';
import { TherapistAssignment } from '../components/QuoteAvailabilityChecker';

// Mock quote data - 2 days, 2 therapists, $2400 total
const mockQuoteData = {
  id: 'Q-12345',

  // Customer Info (Corporate)
  customer_name: 'John Smith',
  customer_email: 'john@personal.com',
  customer_phone: '+61400111222',
  company_name: 'ABC Corporation',
  corporate_contact_name: 'Jane Corporate',
  corporate_contact_email: 'jane@abccorp.com',
  corporate_contact_phone: '+61400333444',

  // Event Details
  event_location: '123 Business St, Sydney NSW 2000',
  event_name: 'Annual Company Wellness Day',
  event_type: 'corporate',
  latitude: -33.8688,
  longitude: 151.2093,

  // Financial
  total_amount: 2400.00,
  total_therapist_fees: 1800.00,
  discount_amount: 100.00,
  gst_amount: 209.09,
  final_amount: 2300.00,
  discount_code: 'CORP10',
  gift_card_code: null,
  gift_card_amount: 0,

  // Service Details
  duration_minutes: 900, // 15 hours total
  service_id: 'service-uuid-123',
  payment_method: 'invoice',

  // Additional Details
  po_number: 'PO-2024-001',
  setup_requirements: 'Quiet room with tables',
  special_requirements: 'Female therapists preferred',
  notes: 'VIP client - priority service'
};

// Mock therapist assignments - 2 days x 2 therapists = 4 bookings
const mockTherapistAssignments: TherapistAssignment[] = [
  // Day 1 - Sep 23
  {
    date: '2024-09-23',
    start_time: '10:00',
    therapist_id: 'kate-uuid-123',
    therapist_name: 'Kate Pascoe',
    hourly_rate: 90,
    is_override: false
  },
  {
    date: '2024-09-23',
    start_time: '10:00',
    therapist_id: 'john-uuid-456',
    therapist_name: 'John Smith',
    hourly_rate: 90,
    is_override: false
  },
  // Day 2 - Sep 24
  {
    date: '2024-09-24',
    start_time: '10:00',
    therapist_id: 'kate-uuid-123',
    therapist_name: 'Kate Pascoe',
    hourly_rate: 90,
    is_override: false
  },
  {
    date: '2024-09-24',
    start_time: '10:00',
    therapist_id: 'sarah-uuid-789',
    therapist_name: 'Sarah Johnson',
    hourly_rate: 90,
    is_override: true,
    override_reason: 'Client requested specifically'
  }
];

// Expected output for validation
const expectedBookingCalculations = {
  totalBookings: 4,
  pricePerBooking: 600.00,      // 2400 ÷ 4
  discountPerBooking: 25.00,    // 100 ÷ 4
  gstPerBooking: 52.27,         // 209.09 ÷ 4
  netPricePerBooking: 575.00,   // 600 - 25
  durationPerBooking: 225,      // 900 ÷ 4 minutes
  therapistFeePerBooking: 337.50 // (225 ÷ 60) × 90 = 3.75 × 90
};

// Expected customer info (should use corporate fields)
const expectedCustomerInfo = {
  customer_email: 'jane@abccorp.com',  // corporate_contact_email
  customer_phone: '+61400333444',      // corporate_contact_phone
  booker_name: 'Jane Corporate',       // corporate_contact_name
  business_name: 'ABC Corporation',
  first_name: 'Jane',
  last_name: 'Corporate'
};

// Expected booking structure
const expectedBookingFields = [
  'parent_quote_id',
  'quote_day_number',
  'therapist_id',
  'booking_time',
  'duration_minutes',
  'status',
  'price',
  'therapist_fee',
  'net_price',
  'discount_amount',
  'tax_rate_amount',
  'gift_card_amount',
  'customer_email',
  'customer_phone',
  'booker_name',
  'business_name',
  'first_name',
  'last_name',
  'discount_code',
  'gift_card_code',
  'booking_id',
  'payment_method',
  'payment_status',
  'address',
  'service_id',
  'booking_type',
  'service_acknowledgement',
  'terms_acceptance',
  'is_split_booking',
  'responding_therapist_id',
  'latitude',
  'longitude',
  'notes'
];

// Manual test function (to be run in console)
export const testBookingCreation = async () => {
  console.log('🧪 Testing Booking Creation Service');
  console.log('Input Quote:', mockQuoteData);
  console.log('Input Assignments:', mockTherapistAssignments);
  console.log('Expected Calculations:', expectedBookingCalculations);
  console.log('Expected Customer Info:', expectedCustomerInfo);

  try {
    const result = await createBookingsFromQuote(mockQuoteData, mockTherapistAssignments);

    if (result.success) {
      console.log('✅ Booking creation succeeded');
      console.log('Created booking IDs:', result.bookingIds);
    } else {
      console.log('❌ Booking creation failed:', result.error);
    }

    return result;

  } catch (error) {
    console.error('❌ Test failed with error:', error);
    return { success: false, error: String(error) };
  }
};

// Export for testing
export {
  mockQuoteData,
  mockTherapistAssignments,
  expectedBookingCalculations,
  expectedCustomerInfo,
  expectedBookingFields
};