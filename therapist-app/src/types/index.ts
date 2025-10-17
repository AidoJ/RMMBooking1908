// Therapist Profile
export interface TherapistProfile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  bio?: string;
  profile_pic?: string;
  home_address?: string;
  latitude?: number;
  longitude?: number;
  service_radius_km?: number;
  service_area_polygon?: Array<{ lat: number; lng: number }>;
  is_active: boolean;
  gender?: string;
  years_experience?: number;
  rating?: number;
  total_reviews?: number;
  business_abn: string;
  address_verified?: boolean;
  created_at: string;
  updated_at: string;
}

// Booking
export interface Booking {
  id: string;
  booking_id?: string;
  customer_id: string;
  therapist_id: string;
  service_id: string;
  booking_time: string;
  status: string;
  client_update_status?: 'on_my_way' | 'arrived' | null;
  payment_status: string;
  price: number;
  therapist_fee: number;
  address: string;
  business_name?: string;
  room_number?: string;
  notes?: string;
  latitude?: number;
  longitude?: number;
  duration_minutes?: number;
  gender_preference?: string;
  parking?: string;
  first_name?: string;
  last_name?: string;
  customer_email?: string;
  customer_phone?: string;
  payment_intent_id?: string;
  created_at: string;
  updated_at: string;

  // Joined data
  customer_name?: string;
  service_name?: string;
  customer_details?: {
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
  };
  service_details?: {
    name: string;
    description?: string;
    service_base_price: number;
    minimum_duration: number;
  };
}

// Availability Slot
export interface AvailabilitySlot {
  id?: string;
  therapist_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  created_at?: string;
}

// Time Off
export interface TimeOff {
  id?: string;
  therapist_id: string;
  start_date: string;
  end_date: string;
  start_time?: string;
  end_time?: string;
  reason?: string;
  is_active: boolean;
  created_at?: string;
}

// Therapist Payment
export interface TherapistPayment {
  id: string;
  therapist_id: string;
  week_start_date: string;
  week_end_date: string;
  calculated_fees: number;
  therapist_invoice_number?: string;
  therapist_invoiced_fees: number;
  therapist_parking_amount: number;
  therapist_total_claimed: number;
  variance_fees: number;
  therapist_invoice_url?: string;
  parking_receipt_url?: string;
  therapist_notes?: string;
  admin_approved_fees?: number;
  admin_approved_parking?: number;
  admin_notes?: string;
  status: 'not_submitted' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'paid';
  submitted_at?: string;
  reviewed_at?: string;
  paid_at?: string;
  created_at: string;
  updated_at: string;
}

// User Context
export interface UserIdentity {
  id: string;
  email: string;
  role: string;
  therapist_profile?: TherapistProfile;
}
