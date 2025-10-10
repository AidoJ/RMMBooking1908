import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Row,
  Col,
  Button,
  Space,
  Typography,
  Select,
  Input,
  DatePicker,
  TimePicker,
  InputNumber,
  Switch,
  Divider,
  Alert,
  message,
  Spin,
  Avatar,
  Tag,
  Descriptions,
  Modal,
  Checkbox,
} from 'antd';
import {
  UserOutlined,
  PhoneOutlined,
  MailOutlined,
  EnvironmentOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  SaveOutlined,
  ArrowLeftOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { useGetIdentity, useNavigation } from '@refinedev/core';
import { useParams } from 'react-router';
import { supabaseClient } from '../../utility';
import { UserIdentity, canAccess, isTherapist, isAdmin } from '../../utils/roleUtils';
import { RoleGuard } from '../../components/RoleGuard';
import { calculateTherapistFee, FeeCalculationResult } from '../../services/feeCalculation';
import dayjs, { Dayjs } from 'dayjs';
import { EmailService, BookingData, TherapistData } from '../../utils/emailService';
import { SMSService } from '../../utils/smsService';
import { generateQuotePDF } from '../../utils/pdfGenerator';
import GooglePlacesAutocomplete from '../../components/GooglePlacesAutocomplete';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

// Interfaces - Copy all existing interfaces from edit.tsx
interface Booking {
  id: string;
  customer_id: string;
  therapist_id: string;
  service_id: string;
  booking_time: string;
  status: string;
  payment_status: string;
  price: number;
  therapist_fee: number;
  address: string;
  business_name?: string;
  notes?: string;
  latitude?: number;
  longitude?: number;
  duration_minutes?: number;
  gender_preference?: string;
  parking?: string;
  room_number?: string;
  booker_name?: string;
  booking_id?: string;
  customer_code?: string;
  first_name?: string;
  last_name?: string;
  customer_email?: string;
  customer_phone?: string;
  created_at: string;
  updated_at: string;
  booking_type?: string;
  discount_code?: string;
  gift_card_code?: string;
  payment_notes?: string;
  
  // Quote-specific fields
  event_type?: string;
  expected_attendees?: number;
  total_sessions?: number;
  preferred_therapists?: number;
  corporate_contact_name?: string;
  corporate_contact_email?: string;
  corporate_contact_phone?: string;
  po_number?: string;
  urgency?: string;
  setup_requirements?: string;
  special_requirements?: string;
  session_duration_minutes?: number;
  payment_method?: string;
  preferred_time_range?: string;
  quote_only?: string | boolean;
  discount_amount?: number;
  tax_rate_amount?: number;
  invoice_number?: string;
  invoice_date?: string;
  invoice_sent_at?: string;
  paid_date?: string;
  
  // Joined data
  customer_name?: string;
  therapist_name?: string;
  service_name?: string;
  customer_details?: {
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
    address?: string;
    notes?: string;
  };
  therapist_details?: {
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
    bio?: string;
    profile_pic?: string;
  };
  service_details?: {
    name: string;
    description?: string;
    service_base_price: number;
    minimum_duration: number;
    quote_only?: boolean;
  };
}

// Interface for tracking changes in summary
interface BookingChange {
  field: string;
  fieldLabel: string;
  originalValue: any;
  newValue: any;
  changeType: 'modified' | 'added' | 'removed';
  category: 'customer' | 'booking' | 'pricing' | 'location' | 'preferences';
}

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
}

interface Therapist {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  is_active: boolean;
  hourly_rate?: number;
}

interface TherapistAssignment {
  id: string;
  booking_id: string;
  therapist_id: string;
  status: 'assigned' | 'confirmed' | 'completed' | 'declined' | 'cancelled';
  assigned_at: string;
  confirmed_at?: string;
  notes?: string;
  therapist_fee?: number;
  hourly_rate?: number;
  hours_worked?: number;
  rate_type?: 'daytime' | 'afterhours' | 'weekend';
  therapist_details?: {
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
  };
}

interface Service {
  id: string;
  name: string;
  description?: string;
  short_description?: string;
  service_base_price: number;
  minimum_duration: number;
  quote_only?: boolean;
}

export const BookingEditPlatform: React.FC = () => {
  const { data: identity } = useGetIdentity<UserIdentity>();
  const { list, show } = useNavigation();
  const { id } = useParams();
  const [form] = Form.useForm();
  
  // State - Copy all existing state from edit.tsx
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [therapistAssignments, setTherapistAssignments] = useState<TherapistAssignment[]>([]);
  const [selectedTherapistIds, setSelectedTherapistIds] = useState<string[]>([]);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showTherapistModal, setShowTherapistModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [detectedChanges, setDetectedChanges] = useState<string[]>([]);
  const [originalBookingData, setOriginalBookingData] = useState<any>(null);
  const [sendingNotifications, setSendingNotifications] = useState(false);
  const [taxRate, setTaxRate] = useState<number>(10.00); // Default fallback
  const [estimatePrice, setEstimatePrice] = useState<number>(0);
  const [gstAmount, setGstAmount] = useState<number>(0);
  const [finalQuotePrice, setFinalQuotePrice] = useState<number>(0);
  const [notificationOptions, setNotificationOptions] = useState({
    notifyCustomer: true,
    notifyTherapist: true,
    sendEmail: true,
    sendSMS: true
  });
  const [customDuration, setCustomDuration] = useState(false);
  const [showSendEmailModal, setShowSendEmailModal] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  // New state for hybrid platform
  const [activeStep, setActiveStep] = useState('customer');
  const [completedSteps, setCompletedSteps] = useState<string[]>(['customer', 'address']);

  // Address verification state
  const [addressVerified, setAddressVerified] = useState(false);
  const [addressStatus, setAddressStatus] = useState('');
  const [addressCoordinates, setAddressCoordinates] = useState<{lat: number, lng: number} | null>(null);
  const [showQuickActions, setShowQuickActions] = useState(true);

  const userRole = identity?.role;

  // Quote detection helper - match server-side logic
  const isQuote = (booking: Booking) => {
    return booking.service_details?.quote_only || booking.booking_type === 'quote';
  };

  // Business settings state
  const [businessSettings, setBusinessSettings] = useState({
    businessOpeningHour: undefined as number | undefined,
    businessClosingHour: undefined as number | undefined,
    beforeServiceBuffer: undefined as number | undefined,
    afterServiceBuffer: undefined as number | undefined,
    minBookingAdvanceHours: undefined as number | undefined,
    therapistDaytimeRate: undefined as number | undefined,
    therapistAfterhoursRate: undefined as number | undefined
  });

  // Available time slots state
  const [availableTimeSlots, setAvailableTimeSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Available therapists for selected time slot
  const [availableTherapists, setAvailableTherapists] = useState<Therapist[]>([]);
  const [loadingTherapists, setLoadingTherapists] = useState(false);

  // Pricing data caches - EXACTLY like frontend
  const [servicesCache, setServicesCache] = useState<any[]>([]);
  const [durationsCache, setDurationsCache] = useState<any[]>([]);
  const [timePricingRulesCache, setTimePricingRulesCache] = useState<any[]>([]);
  const [pricingDataLoaded, setPricingDataLoaded] = useState(false);

  // Current vs Estimated pricing
  const [originalBooking, setOriginalBooking] = useState<Booking | null>(null);
  const [currentPricing, setCurrentPricing] = useState<any>(null);
  const [estimatedPricing, setEstimatedPricing] = useState<any>(null);
  const [priceDelta, setPriceDelta] = useState(0);

  // Discount and Gift Card verification
  const [appliedDiscount, setAppliedDiscount] = useState<any>(null);
  const [appliedGiftCard, setAppliedGiftCard] = useState<any>(null);
  const [discountInput, setDiscountInput] = useState('');
  const [giftCardInput, setGiftCardInput] = useState('');
  const [discountStatus, setDiscountStatus] = useState('');
  const [giftCardStatus, setGiftCardStatus] = useState('');

  // Stripe payment processing
  const [stripeLoaded, setStripeLoaded] = useState(false);
  const [stripeElements, setStripeElements] = useState<any>(null);
  const [stripeCard, setStripeCard] = useState<any>(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // Summary modal state
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryChanges, setSummaryChanges] = useState<any[]>([]);
  const [proceedingWithChanges, setProceedingWithChanges] = useState(false);

  // Therapist fee calculations
  const [therapistFeeBreakdown, setTherapistFeeBreakdown] = useState({
    baseRate: 0,
    afterHoursUplift: 0,
    weekendUplift: 0,
    durationMultiplier: 1,
    totalFee: 0
  });

  const [businessSummary, setBusinessSummary] = useState({
    customerPayment: 0,
    therapistFee: 0,
    netProfit: 0
  });

  useEffect(() => {
    if (id) {
      fetchBookingDetails();
      fetchTherapists();
      fetchServices();
      fetchTherapistAssignments();
      fetchBusinessSettings(); // Load business settings
      fetchPricingData(); // Load pricing data for calculator
    }
  }, [id]);

  // Update time slots when date, service, duration, or gender changes - EXACTLY like frontend
  useEffect(() => {
    updateAvailableTimeSlots();
  }, [booking?.booking_time, selectedService, booking?.duration_minutes, booking?.gender_preference, businessSettings]);

  // Calculate therapist fees when booking, therapist, or business settings change
  useEffect(() => {
    calculateTherapistFees();
  }, [booking?.therapist_id, booking?.duration_minutes, booking?.booking_time, businessSettings, therapists]);

  // Update business summary when therapist fees or customer payment changes
  useEffect(() => {
    updateBusinessSummary();
  }, [therapistFeeBreakdown.totalFee, booking?.service_id, booking?.duration_minutes]);

  // Update available therapists when time slot is selected
  useEffect(() => {
    updateAvailableTherapists();
  }, [booking?.booking_time, booking?.service_id, booking?.gender_preference, booking?.duration_minutes]);

  // Calculate Current vs Estimated pricing and delta
  useEffect(() => {
    if (pricingDataLoaded && originalBooking) {
      const current = calculateCurrentPrice();
      const estimated = calculatePrice();
      
      setCurrentPricing(current);
      setEstimatedPricing(estimated);
      
      if (current && estimated) {
        const delta = estimated.finalPrice - current.finalPrice;
        setPriceDelta(delta);
        console.log('💰 Price delta:', {
          current: current.finalPrice,
          estimated: estimated.finalPrice,
          delta: delta.toFixed(2)
        });
      }
    }
  }, [pricingDataLoaded, originalBooking, booking?.service_id, booking?.duration_minutes, booking?.booking_time, appliedDiscount, appliedGiftCard]);

  // Mount Stripe when payment method is card and delta > 0
  useEffect(() => {
    if (priceDelta > 0 && booking?.payment_method === 'card') {
      if (!stripeLoaded) {
        mountStripeCardElement();
      }
    } else {
      // Reset if conditions no longer met
      if (stripeLoaded) {
        setStripeLoaded(false);
      }
    }
  }, [priceDelta, booking?.payment_method]);

  // Fetch pricing data - EXACTLY like frontend
  const fetchPricingData = async () => {
    try {
      console.log('💰 Fetching pricing data...');
      
      // Fetch services
      const { data: services } = await supabaseClient
        .from('services')
        .select('id, name, service_base_price, minimum_duration, is_active, image_url, image_alt, short_description')
        .eq('is_active', true)
        .order('sort_order');
      setServicesCache(services || []);

      // Fetch durations
      const { data: durations } = await supabaseClient
        .from('duration_pricing')
        .select('id, duration_minutes, uplift_percentage, is_active')
        .eq('is_active', true)
        .order('sort_order');
      setDurationsCache(durations || []);

      // Fetch time pricing rules
      const { data: timeRules } = await supabaseClient
        .from('time_pricing_rules')
        .select('id, day_of_week, start_time, end_time, uplift_percentage, is_active, label')
        .eq('is_active', true)
        .order('sort_order');
      setTimePricingRulesCache(timeRules || []);

      console.log('✅ Pricing data loaded:', {
        services: services?.length || 0,
        durations: durations?.length || 0,
        timeRules: timeRules?.length || 0
      });
      
      setPricingDataLoaded(true);
    } catch (error) {
      console.error('❌ Error fetching pricing data:', error);
      // Use fallback data like frontend
      setServicesCache([
        { id: '1', name: 'Relaxation Massage', service_base_price: 80 },
        { id: '2', name: 'Deep Tissue Massage', service_base_price: 90 },
        { id: '3', name: 'Sports Massage', service_base_price: 100 }
      ]);
      setDurationsCache([
        { id: '1', duration_minutes: 30, uplift_percentage: 0 },
        { id: '2', duration_minutes: 60, uplift_percentage: 0 },
        { id: '3', duration_minutes: 90, uplift_percentage: 25 }
      ]);
      setTimePricingRulesCache([]);
      setPricingDataLoaded(true);
    }
  };

  // Copy all existing data fetching functions from edit.tsx
  const fetchBookingDetails = async () => {
    try {
      const { data: bookingData, error: bookingError } = await supabaseClient
        .from('bookings')
        .select(`
          *,
          customers(first_name, last_name, email, phone, address, notes),
          therapist_profiles!bookings_therapist_id_fkey(first_name, last_name, email, phone, bio, profile_pic),
          services(name, description, service_base_price, minimum_duration, quote_only)
        `)
        .eq('id', id)
        .single();

      if (bookingError) throw bookingError;

      console.log('Raw booking data from database:', bookingData);
      console.log('business_name value:', bookingData.business_name);
      console.log('price value:', bookingData.price);
      
      const transformedBooking: Booking = {
        ...bookingData,
        customer_name: bookingData.customers 
          ? `${bookingData.customers.first_name} ${bookingData.customers.last_name}`
          : 'Unknown Customer',
        therapist_name: bookingData.therapist_profiles 
          ? `${bookingData.therapist_profiles.first_name} ${bookingData.therapist_profiles.last_name}`
          : 'No Therapist Assigned',
        service_name: bookingData.services?.name || 'Unknown Service',
        customer_details: bookingData.customers,
        therapist_details: bookingData.therapist_profiles,
        service_details: bookingData.services,
      };

      setBooking(transformedBooking);
      setOriginalBookingData(transformedBooking);
      setOriginalBooking(transformedBooking); // Store original for Current pricing

      // Populate form with existing data
      form.setFieldsValue({
        business_name: bookingData.business_name || '',
        address: bookingData.address || '',
        room_number: bookingData.room_number || '',
        parking: bookingData.parking || '',
        notes: bookingData.notes || '',
        booking_time: bookingData.booking_time ? dayjs(bookingData.booking_time) : null,
        duration_minutes: bookingData.duration_minutes || 60,
        service_id: bookingData.service_id || '',
        therapist_id: bookingData.therapist_id || '',
        gender_preference: bookingData.gender_preference || 'any',
        status: bookingData.status || 'requested',
        payment_status: bookingData.payment_status || 'pending',
        payment_method: bookingData.payment_method || 'card',
        discount_amount: bookingData.discount_amount || 0,
        tax_rate_amount: bookingData.tax_rate_amount || 0,
      });

      // Initialize pricing calculations
      initializePricing(bookingData);
    } catch (error) {
      console.error('Error fetching booking details:', error);
      message.error('Failed to load booking details');
    } finally {
      setLoading(false);
    }
  };

  const fetchTherapists = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('therapist_profiles')
        .select('id, first_name, last_name, email, phone, is_active, hourly_rate')
        .eq('is_active', true)
        .order('first_name');

      if (error) throw error;
      console.log('🔍 Fetched therapists:', data?.length || 0, 'therapists');
      setTherapists(data || []);
    } catch (error) {
      console.error('Error fetching therapists:', error);
    }
  };

  const fetchServices = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('services')
        .select('id, name, description, short_description, service_base_price, minimum_duration, is_active, quote_only')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error('Error fetching services:', error);
    }
  };

  const fetchTherapistAssignments = async () => {
    // Since the booking already has therapist_id, we don't need a separate assignments table
    // The therapist data is already loaded with the booking via therapist_profiles!bookings_therapist_id_fkey
    console.log('✅ Therapist assignment data loaded from booking relationship');
    setTherapistAssignments([]);
  };

  // Copy all existing helper functions from edit.tsx
  const handleServiceChange = (serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    setSelectedService(service || null);
    
    if (service) {
      form.setFieldsValue({
        service_id: serviceId,
        duration_minutes: service.minimum_duration
      });
      // Update the booking state to reflect the change
      setBooking(prev => prev ? { ...prev, service_id: serviceId } : null);
    }
  };

  const handleDurationChange = (duration: number) => {
    form.setFieldsValue({ duration_minutes: duration });
    // Update the booking state to reflect the change
    setBooking(prev => prev ? { ...prev, duration_minutes: duration } : null);
  };

  const initializePricing = (bookingData: any) => {
    const basePrice = bookingData.service_details?.service_base_price || 0;
    const duration = bookingData.duration_minutes || 60;
    const discountAmount = bookingData.discount_amount || 0;
    
    // Calculate pricing
    const durationMultiplier = duration / 60;
    const subtotal = basePrice * durationMultiplier;
    const discount = discountAmount;
    const afterDiscount = subtotal - discount;
    const gst = afterDiscount * (taxRate / 100);
    const total = afterDiscount + gst;
    
    setEstimatePrice(subtotal);
    setAppliedDiscount(discount);
    setGstAmount(gst);
    setFinalQuotePrice(total);
  };

  // Copy all existing save and update functions from edit.tsx
  const handleSave = async () => {
    try {
      setSaving(true);
      const values = await form.validateFields();
      
      const updateData = {
        business_name: values.business_name,
        address: values.address,
        room_number: values.room_number,
        parking: values.parking,
        notes: values.notes,
        booking_time: values.booking_time?.toISOString(),
        duration_minutes: values.duration_minutes,
        service_id: values.service_id,
        therapist_id: values.therapist_id,
        gender_preference: values.gender_preference,
        status: values.status,
        payment_status: values.payment_status,
        payment_method: values.payment_method,
        discount_amount: values.discount_amount || 0,
        tax_rate_amount: values.tax_rate_amount || 0,
      };

      const { error } = await supabaseClient
        .from('bookings')
        .update(updateData)
        .eq('id', booking!.id);

      if (error) throw error;

      message.success('Booking updated successfully');
      
      // Refresh booking data
      await fetchBookingDetails();
    } catch (error) {
      console.error('Error updating booking:', error);
      message.error('Failed to update booking');
    } finally {
      setSaving(false);
    }
  };

  // Load business settings from database - EXACTLY like frontend
  const fetchBusinessSettings = async () => {
    try {
      console.log('🔧 Loading business settings...');
      const { data: settings } = await supabaseClient
        .from('system_settings')
        .select('key, value');
      
      if (settings) {
        const newSettings = { ...businessSettings };
        for (const s of settings) {
          if (s.key === 'business_opening_time') newSettings.businessOpeningHour = Number(s.value);
          if (s.key === 'business_closing_time') newSettings.businessClosingHour = Number(s.value);
          if (s.key === 'before_service_buffer_time') newSettings.beforeServiceBuffer = Number(s.value);
          if (s.key === 'after_service_buffer_time') newSettings.afterServiceBuffer = Number(s.value);
          if (s.key === 'min_booking_advance_hours') newSettings.minBookingAdvanceHours = Number(s.value);
          if (s.key === 'therapist_daytime_hourly_rate') newSettings.therapistDaytimeRate = Number(s.value);
          if (s.key === 'therapist_afterhours_hourly_rate') newSettings.therapistAfterhoursRate = Number(s.value);
        }
        setBusinessSettings(newSettings);
        console.log('✅ Business settings loaded:', newSettings);
      }
    } catch (error) {
      console.error('❌ Error fetching business settings:', error);
      // Use fallback settings - EXACTLY like frontend
      setBusinessSettings({
        businessOpeningHour: 9,
        businessClosingHour: 17,
        beforeServiceBuffer: 15,
        afterServiceBuffer: 15,
        minBookingAdvanceHours: 2,
        therapistDaytimeRate: 45,
        therapistAfterhoursRate: 55
      });
    }
  };

  // Get available time slots for a therapist on a given day - EXACTLY like frontend
  const getAvailableSlotsForTherapist = async (therapist: any, date: string, durationMinutes: number, currentBookingId?: string) => {
    if (
      businessSettings.businessOpeningHour === undefined ||
      businessSettings.businessClosingHour === undefined ||
      businessSettings.beforeServiceBuffer === undefined ||
      businessSettings.afterServiceBuffer === undefined ||
      businessSettings.minBookingAdvanceHours === undefined
    ) {
      console.warn('Business hours, buffer times, or advance booking hours are not set! Check system_settings.');
      return [];
    }

    console.log('getAvailableSlotsForTherapist called for therapist:', therapist, 'date:', date, 'duration:', durationMinutes);

    // 1. Get working hours for the day
    const dayOfWeek = new Date(date).getDay();
    const { data: availabilities } = await supabaseClient
      .from('therapist_availability')
      .select('start_time, end_time')
      .eq('therapist_id', therapist.id)
      .eq('day_of_week', dayOfWeek);

    if (!availabilities || availabilities.length === 0) return [];
    const { start_time, end_time } = availabilities[0];

    // 2. Get existing bookings for the day (excluding current booking if editing)
    let bookingsQuery = supabaseClient
      .from('bookings')
      .select('booking_time, service_id')
      .eq('therapist_id', therapist.id)
      .gte('booking_time', date + 'T00:00:00')
      .lt('booking_time', date + 'T23:59:59');
    
    // Exclude current booking if editing same-day time/duration changes
    if (currentBookingId && currentBookingId.trim() && currentBookingId !== 'undefined') {
      bookingsQuery = bookingsQuery.neq('id', currentBookingId);
      console.log('🔄 Excluding current booking from availability check:', currentBookingId);
    }
    
    const { data: bookings } = await bookingsQuery;

    // 3. Build all possible slots (hourly, businessOpeningHour to businessClosingHour)
    const slots = [];
    for (let hour = businessSettings.businessOpeningHour!; hour <= businessSettings.businessClosingHour!; hour++) {
      const slotStart = `${hour.toString().padStart(2, '0')}:00`;
      // Check if slot is within working hours
      if (slotStart < start_time || slotStart >= end_time) continue;
      
      // Check for overlap with existing bookings (including before/after buffer)
      const slotStartDate = new Date(date + 'T' + slotStart);
      const slotEndDate = new Date(slotStartDate.getTime() + durationMinutes * 60000 + businessSettings.afterServiceBuffer! * 60000);
      let overlaps = false;
      
      for (const booking of bookings || []) {
        const bookingStart = new Date(booking.booking_time);
        // Get buffer for this booking's service
        let bookingBufferBefore = businessSettings.beforeServiceBuffer!;
        let bookingBufferAfter = businessSettings.afterServiceBuffer!;
        
        // Check if service has custom buffer time
        if (booking.service_id && services.length > 0) {
          const svc = services.find(s => s.id === booking.service_id);
          if (svc && (svc as any).buffer_time) bookingBufferAfter = Number((svc as any).buffer_time);
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
  };

  // Update available therapists for selected time slot - EXACTLY like frontend
  const updateAvailableTherapists = async () => {
    if (!booking?.booking_time || !booking?.service_id || !booking?.gender_preference || !booking?.duration_minutes) {
      setAvailableTherapists([]);
      return;
    }

    try {
      setLoadingTherapists(true);
      console.log('🔍 Updating available therapists for selected time slot...');

      const dateVal = dayjs(booking.booking_time).format('YYYY-MM-DD');
      const timeVal = dayjs(booking.booking_time).format('HH:mm');
      const serviceId = booking.service_id;
      const genderVal = booking.gender_preference;
      const durationVal = booking.duration_minutes;

      console.log('📅 Filtering therapists for:', { dateVal, timeVal, serviceId, genderVal, durationVal });

      // Get therapists who provide this service
      const { data: therapistLinks } = await supabaseClient
        .from('therapist_services')
        .select(`
          therapist_id,
          therapist_profiles!therapist_id (id, first_name, last_name, gender, is_active, profile_pic)
        `)
        .eq('service_id', serviceId);

      let candidateTherapists = (therapistLinks || [])
        .map(row => ({
          ...row.therapist_profiles
        }))
        .filter((t: any) => t && t.is_active);

      // Filter by gender preference
      if (genderVal !== 'any') {
        candidateTherapists = candidateTherapists.filter((t: any) => t.gender === genderVal);
      }

      // Deduplicate therapists
      const uniqueTherapists = Object.values(candidateTherapists.reduce((acc: any, t: any) => {
        if (t && t.id) acc[t.id] = t;
        return acc;
      }, {}));

      console.log('📊 Found', uniqueTherapists.length, 'therapists matching service and gender');

      // For each therapist, check if they are available for the selected slot
      const availableTherapists = [];
      for (const therapist of uniqueTherapists) {
        const slots = await getAvailableSlotsForTherapist(therapist, dateVal, durationVal, booking?.id);
        if (slots.includes(timeVal)) {
          availableTherapists.push(therapist);
        }
      }

      console.log('✅ Found', availableTherapists.length, 'therapists available for selected time slot');
      console.log('🔍 Available therapists:', availableTherapists);
      console.log('🔍 All therapists fallback:', therapists.length);
      setAvailableTherapists(availableTherapists as Therapist[]);

    } catch (error) {
      console.error('❌ Error updating available therapists:', error);
      setAvailableTherapists([]);
    } finally {
      setLoadingTherapists(false);
    }
  };

  // Update available time slots - EXACTLY like frontend
  const updateAvailableTimeSlots = async () => {
    const dateVal = booking?.booking_time ? dayjs(booking.booking_time).format('YYYY-MM-DD') : null;
    
    if (!dateVal) {
      setAvailableTimeSlots([]);
      return;
    }

    setLoadingSlots(true);
    console.log('updateAvailableTimeSlots called, globals:', businessSettings);

    if (
      businessSettings.businessOpeningHour === undefined ||
      businessSettings.businessClosingHour === undefined ||
      businessSettings.beforeServiceBuffer === undefined ||
      businessSettings.afterServiceBuffer === undefined ||
      businessSettings.minBookingAdvanceHours === undefined
    ) {
      console.warn('Business hours or buffer times are not set! Waiting for settings to load.');
      setLoadingSlots(false);
      return;
    }

    // Define these variables first - updated for card-based selection:
    const serviceId = selectedService?.id || booking?.service_id;
    const durationVal = booking?.duration_minutes;
    const genderVal = booking?.gender_preference || 'any';

    console.log('Selected serviceId:', serviceId, 'Selected genderVal:', genderVal);
    if (!serviceId || !durationVal || !dateVal || !genderVal) {
      setLoadingSlots(false);
      return;
    }

    // 1. Get buffer_time for selected service (not used here, but could be for after buffer)
    const durationMinutes = Number(durationVal);

    // 2. Get all therapists who match service and gender
    const { data: therapistLinks } = await supabaseClient
      .from('therapist_services')
      .select('therapist_id, therapist:therapist_id (id, gender, is_active)')
      .eq('service_id', serviceId);

    console.log('Raw therapistLinks from Supabase:', therapistLinks);
    let therapists = (therapistLinks || []).map((row: any) => row.therapist).filter((t: any) => t && t.is_active);
    if (genderVal !== 'any') therapists = therapists.filter((t: any) => t.gender === genderVal);

    // Deduplicate therapists to avoid redundant checks
    const uniqueTherapists = [...new Map(therapists.map((t: any) => [t.id, t])).values()];
    console.log('Therapists after filtering & deduplication:', uniqueTherapists);

    // 3. For each therapist, get available slots
    let allSlots: string[] = [];
    for (const therapist of uniqueTherapists) {
      const slots = await getAvailableSlotsForTherapist(therapist, dateVal, durationMinutes, booking?.id);
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
      now.setHours(now.getHours() + (businessSettings.minBookingAdvanceHours || 0));

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

    setAvailableTimeSlots(finalSlots);
    setLoadingSlots(false);
  };

  // Address verification functions
  const checkTherapistCoverageForAddress = async (address: string, lat?: number, lng?: number) => {
    if (!address.trim()) {
      setAddressStatus('');
      setAddressVerified(false);
      return;
    }

    try {
      let coordinates = { lat: lat || 0, lng: lng || 0 };
      
      // If no coordinates provided, try to geocode using Google Maps API
      if (!lat || !lng) {
        console.log('🔍 Geocoding address manually:', address);
        
        if (!window.google?.maps?.Geocoder) {
          console.error('❌ Google Maps Geocoder not available');
          setAddressStatus('Google Maps API not loaded');
          setAddressVerified(false);
          return;
        }

        try {
          const geocoder = new window.google.maps.Geocoder();
          const result = await new Promise<any>((resolve, reject) => {
            geocoder.geocode(
              { 
                address: address, 
                componentRestrictions: { country: 'au' } 
              }, 
              (results: any[], status: string) => {
                if (status === 'OK' && results && results[0]) {
                  resolve(results[0]);
                } else {
                  reject(new Error('Geocoding failed'));
                }
              }
            );
          });

          if (result.geometry) {
            coordinates = {
              lat: result.geometry.location.lat(),
              lng: result.geometry.location.lng()
            };
            console.log('✅ Address geocoded successfully:', coordinates);
          }
        } catch (geocodingError) {
          console.error('❌ Geocoding failed:', geocodingError);
          setAddressStatus('Unable to verify address location. Please try selecting from the dropdown suggestions.');
          setAddressVerified(false);
          return;
        }
      }

      setAddressCoordinates(coordinates);

      // Now check therapist coverage using real coordinates - EXACTLY like frontend
      console.log('🔍 Checking therapist coverage for coordinates:', coordinates);
      
      const { data, error } = await supabaseClient
        .from('therapist_profiles')
        .select('id, latitude, longitude, service_radius_km, is_active')
        .eq('is_active', true);

      if (error) {
        console.error('❌ Error fetching therapists:', error);
        setAddressStatus('Error checking therapist availability');
        setAddressVerified(false);
        return;
      }

      console.log('📊 Found therapists:', data?.length || 0);

      if (!data || data.length === 0) {
        console.log('❌ No active therapists found in database');
        setAddressStatus("Sorry... we don't have any therapists available in your area right now.");
        setAddressVerified(false);
        return;
      }

      // Haversine formula for distance calculation - EXACTLY like frontend
      function getDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
        const R = 6371; // Earth's radius in kilometers
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      }

      // Check if any therapist covers this location - EXACTLY like frontend
      const covered = data.some(t => {
        if (t.latitude == null || t.longitude == null || t.service_radius_km == null) {
          console.log('⚠️ Therapist missing location data:', t.id);
          return false;
        }
        const dist = getDistanceKm(coordinates.lat, coordinates.lng, t.latitude, t.longitude);
        console.log(`📍 Therapist ${t.id}: distance ${dist.toFixed(2)}km, radius ${t.service_radius_km}km`);
        return dist <= t.service_radius_km;
      });

      console.log('✅ Coverage check result:', covered);

      if (!covered) {
        setAddressStatus("Sorry... we don't have any therapists available in your area right now.");
        setAddressVerified(false);
      } else {
        setAddressStatus('Great News we have therapists available in your area');
        setAddressVerified(true);
      }
    } catch (error) {
      console.error('Address verification error:', error);
      setAddressStatus('Error verifying address');
      setAddressVerified(false);
    }
  };

  // Step navigation functions
  const handleStepChange = (stepId: string) => {
    setActiveStep(stepId);
  };

  const markStepCompleted = (stepId: string) => {
    if (!completedSteps.includes(stepId)) {
      setCompletedSteps(prev => [...prev, stepId]);
    }
  };

  const canNavigateToStep = (stepId: string) => {
    const stepOrder = ['customer', 'address', 'service', 'gender', 'datetime', 'therapist', 'payment'];
    const currentIndex = stepOrder.indexOf(activeStep);
    const targetIndex = stepOrder.indexOf(stepId);
    
    // Can navigate to previous steps or next step if current is completed
    return targetIndex <= currentIndex || completedSteps.includes(activeStep);
  };

  // Load Stripe key and initialize - EXACTLY like frontend
  const [stripeInstanceRef, setStripeInstanceRef] = useState<any>(null);
  const loadStripeKey = async () => {
    try {
      const response = await fetch('/.netlify/functions/get-stripe-key');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load Stripe key');
      }
      
      return data.publishableKey;
    } catch (error) {
      console.error('❌ Error loading Stripe key:', error);
      throw error;
    }
  };

  // Mount Stripe card element - EXACTLY like booking platform
  const mountStripeCardElement = async () => {
    if (!(window as any).Stripe) {
      console.error('Stripe.js not loaded');
      setTimeout(mountStripeCardElement, 500); // Retry if Stripe not loaded yet
      return;
    }

    // Prevent multiple simultaneous mounts
    if (stripeLoaded) {
      console.log('⚠️ Stripe already loaded, skipping mount');
      return;
    }

    try {
      console.log('💳 Mounting Stripe card element...');

      // Clean up existing card element if it exists
      if (stripeCard) {
        console.log('🧹 Unmounting existing card element');
        try {
          stripeCard.unmount();
          stripeCard.destroy();
        } catch (e) {
          console.warn('Error unmounting card:', e);
        }
      }

      // Reuse Stripe instance if it exists, otherwise create new one
      let stripeInstance = stripeInstanceRef;
      if (!stripeInstance) {
        const publishableKey = await loadStripeKey();
        stripeInstance = (window as any).Stripe(publishableKey);
        setStripeInstanceRef(stripeInstance);
      }

      const elements = stripeInstance.elements();

      // Create card element exactly like frontend
      const cardElement = elements.create('card', {
        style: {
          base: {
            fontSize: '16px',
            color: '#333',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            '::placeholder': { color: '#888' },
          },
          invalid: { color: '#dc2626' }
        }
      });

      // Wait for DOM element to exist, then mount
      const checkAndMount = () => {
        const cardContainer = document.getElementById('stripe-card-element');
        if (cardContainer) {
          // Ensure the container is empty before mounting to avoid child nodes warning
          cardContainer.innerHTML = '';
          cardElement.mount('#stripe-card-element');

          // Only set state AFTER successful mount
          setStripeElements(elements);
          setStripeCard(cardElement);
          setStripeLoaded(true);
          console.log('✅ Stripe card element mounted successfully');
        } else {
          console.log('⏳ Waiting for card element container...');
          setTimeout(checkAndMount, 100);
        }
      };

      checkAndMount();
    } catch (error) {
      console.error('Error mounting Stripe:', error);
      message.error('Failed to load payment form');
    }
  };

  // Process additional payment via Stripe
  const processAdditionalPayment = async () => {
    if (!stripeCard || !booking) {
      message.error('Payment form not ready');
      return false;
    }

    setProcessingPayment(true);

    try {
      // Step 1: Create payment intent for additional charge
      const authorizationData = {
        amount: priceDelta,
        currency: 'aud',
        bookingData: {
          booking_id: booking.booking_id,
          customer_email: booking.customer_email,
          service_name: services.find(s => s.id === booking.service_id)?.name,
          booking_time: booking.booking_time,
          additional_payment: true
        }
      };

      const authResponse = await fetch('/.netlify/functions/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authorizationData)
      });

      if (!authResponse.ok) {
        const errorData = await authResponse.json();
        throw new Error(`Payment authorization failed: ${errorData.error || 'Unknown error'}`);
      }

      const { client_secret } = await authResponse.json();

      // Step 2: Confirm card payment with the SAME Stripe instance used to create the Element
      const stripe = stripeInstanceRef;
      if (!stripe) {
        throw new Error('Stripe is not initialized');
      }
      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(client_secret, {
        payment_method: {
          card: stripeCard,
          billing_details: {
            name: `${booking.first_name} ${booking.last_name}`,
            email: booking.customer_email,
            phone: booking.customer_phone,
          }
        }
      });

      if (stripeError) {
        throw new Error(stripeError.message);
      }

      if (paymentIntent.status === 'requires_capture') {
        message.success('✅ Additional payment authorized successfully');
        setPaymentSuccess(true);
        return true;
      } else {
        throw new Error('Payment authorization failed');
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      message.error(error.message || 'Payment failed');
      return false;
    } finally {
      setProcessingPayment(false);
    }
  };

  // Apply discount code - EXACTLY like frontend
  const applyDiscount = async () => {
    const code = discountInput.trim().toUpperCase();
    if (!code) return;

    try {
      const { data, error } = await supabaseClient
        .from('discount_codes')
        .select('*')
        .eq('code', code)
        .eq('is_active', true)
        .single();

      if (!error && data) {
        setAppliedDiscount(data);
        setDiscountStatus('applied');
        message.success('✅ Discount applied!');
      } else {
        setDiscountStatus('invalid');
        message.error('Invalid discount code');
      }
    } catch (error) {
      console.error('Discount error:', error);
      setDiscountStatus('invalid');
      message.error('Error applying discount');
    }
  };

  // Remove discount
  const removeDiscount = () => {
    setAppliedDiscount(null);
    setDiscountInput('');
    setDiscountStatus('');
    message.info('Discount removed');
  };

  // Apply gift card - EXACTLY like frontend
  const applyGiftCard = async () => {
    const code = giftCardInput.trim().toUpperCase();
    if (!code) return;

    try {
      const { data, error } = await supabaseClient
        .from('gift_cards')
        .select('*')
        .eq('code', code)
        .eq('is_active', true)
        .single();

      if (!error && data && data.current_balance > 0) {
        setAppliedGiftCard(data);
        setGiftCardStatus('applied');
        message.success('✅ Gift card applied!');
      } else {
        setGiftCardStatus('invalid');
        message.error('Invalid or expired gift card');
      }
    } catch (error) {
      console.error('Gift card error:', error);
      setGiftCardStatus('invalid');
      message.error('Error applying gift card');
    }
  };

  // Remove gift card
  const removeGiftCard = () => {
    setAppliedGiftCard(null);
    setGiftCardInput('');
    setGiftCardStatus('');
    message.info('Gift card removed');
  };

  // Calculate Current pricing from original DB booking - USE DB PRICE FIELD
  const calculateCurrentPrice = () => {
    if (!originalBooking) {
      return null;
    }

    // Use the actual price from the DB, not recalculate
    const dbPrice = Number(originalBooking.price) || 0;
    const gstAmount = dbPrice / 11;

    console.log('💰 Current Price from DB:', {
      bookingId: originalBooking.id,
      dbPrice,
      gstAmount,
      discountCode: originalBooking.discount_code,
      giftCardCode: originalBooking.gift_card_code
    });

    return {
      basePrice: dbPrice,
      durationUplift: 0,
      timeUplift: 0,
      discountAmount: 0,
      giftCardAmount: 0,
      gstAmount,
      finalPrice: dbPrice,
      breakdown: []
    };
  };

  // Calculate Estimated pricing from current form selections - EXACTLY like frontend
  const calculatePrice = () => {
    if (!booking?.service_id || !booking?.duration_minutes || !booking?.booking_time) {
      console.log('💰 Missing required data for price calculation');
      return null;
    }

    console.log('💰 calculatePrice called with:', { 
      serviceId: booking.service_id, 
      duration: booking.duration_minutes, 
      date: booking.booking_time 
    });

    // Check if time/duration changed from original booking
    const originalTime = originalBooking ? dayjs(originalBooking.booking_time).format('YYYY-MM-DD HH:mm') : null;
    const newTime = dayjs(booking.booking_time).format('YYYY-MM-DD HH:mm');
    const originalDuration = originalBooking?.duration_minutes;
    const newDuration = booking.duration_minutes;
    
    const timeChanged = originalTime !== newTime;
    const durationChanged = originalDuration !== newDuration;
    
    console.log('🔍 Change detection:', {
      originalTime,
      newTime,
      timeChanged,
      originalDuration,
      newDuration,
      durationChanged
    });

    // If no time or duration changes, return original price
    if (!timeChanged && !durationChanged) {
      console.log('💰 No time/duration changes detected, returning original price');
      const originalPrice = Number(originalBooking?.price) || 0;
      return {
        basePrice: originalPrice,
        durationUplift: 0,
        timeUplift: 0,
        revisedPrice: originalPrice,
        discountAmount: 0,
        giftCardAmount: 0,
        gstAmount: originalPrice / 11,
        finalPrice: originalPrice,
        breakdown: [`Original Price: $${originalPrice.toFixed(2)}`]
      };
    }

    // Get service data from cache
    const service = servicesCache.find(s => s.id === booking.service_id);
    if (!service) {
      console.log('💰 Service not found:', booking.service_id);
      return null;
    }

    let price = Number(service.service_base_price);
    let breakdown = [`Hourly Rate: $${price.toFixed(2)}`];

    // Get duration uplift
    const duration = durationsCache.find(d => d.duration_minutes === Number(booking.duration_minutes));
    if (duration && duration.uplift_percentage) {
      const durationUplift = price * (Number(duration.uplift_percentage) / 100);
      price += durationUplift;
      breakdown.push(`Time Uplift (${duration.uplift_percentage}%): +$${durationUplift.toFixed(2)}`);
    }

    // Get day of week and time for NEW booking
    const bookingTime = dayjs(booking.booking_time);
    const dayOfWeek = bookingTime.day(); // 0=Sunday, 6=Saturday
    const timeVal = bookingTime.format('HH:mm');

    // Find matching time pricing rule for NEW booking
    let newTimeUplift = 0;
    for (const rule of timePricingRulesCache) {
      if (Number(rule.day_of_week) === dayOfWeek) {
        if (timeVal >= rule.start_time && timeVal < rule.end_time) {
          newTimeUplift = Number(rule.uplift_percentage);
          break;
        }
      }
    }

    // Calculate ORIGINAL booking's time uplift for delta calculation
    let originalTimeUplift = 0;
    if (originalBooking?.booking_time) {
      const originalBookingTime = dayjs(originalBooking.booking_time);
      const originalDayOfWeek = originalBookingTime.day();
      const originalTimeVal = originalBookingTime.format('HH:mm');

      for (const rule of timePricingRulesCache) {
        if (Number(rule.day_of_week) === originalDayOfWeek) {
          if (originalTimeVal >= rule.start_time && originalTimeVal < rule.end_time) {
            originalTimeUplift = Number(rule.uplift_percentage);
            break;
          }
        }
      }
    }

    // Calculate the DIFFERENCE between original and new time uplifts
    const timeUpliftDifference = newTimeUplift - originalTimeUplift;
    
    // Only apply the DIFFERENCE in time uplift
    if (timeUpliftDifference !== 0) {
      const timeUpliftAmount = price * (timeUpliftDifference / 100);
      price += timeUpliftAmount;
      
      if (timeUpliftDifference > 0) {
        breakdown.push(`Weekend/Afterhours Uplift (+${timeUpliftDifference}%): +$${timeUpliftAmount.toFixed(2)}`);
      } else {
        breakdown.push(`Weekend/Afterhours Adjustment (${timeUpliftDifference}%): $${timeUpliftAmount.toFixed(2)}`);
      }
    }

    console.log('💰 Time uplift calculation:', {
      original: { day: originalBooking?.booking_time ? dayjs(originalBooking.booking_time).day() : 'N/A', uplift: originalTimeUplift },
      new: { day: dayOfWeek, uplift: newTimeUplift },
      difference: timeUpliftDifference
    });

    // Revised Price = Base + Uplifts (before discounts)
    const revisedPrice = price;

    // Apply VERIFIED discounts only
    let discountAmount = 0;
    if (appliedDiscount) {
      if (appliedDiscount.discount_type === 'percentage') {
        discountAmount = (revisedPrice * appliedDiscount.discount_value) / 100;
      } else if (appliedDiscount.discount_type === 'fixed_amount') {
        discountAmount = Math.min(appliedDiscount.discount_value, revisedPrice);
      }
      breakdown.push(`Discount (${appliedDiscount.code}): -$${discountAmount.toFixed(2)}`);
    }
    
    // Apply VERIFIED gift card only
    let giftCardAmount = 0;
    if (appliedGiftCard) {
      giftCardAmount = Math.min(appliedGiftCard.current_balance, revisedPrice - discountAmount);
      breakdown.push(`Gift Card (${appliedGiftCard.code}): -$${giftCardAmount.toFixed(2)}`);
    }
    
    // Net Price = Revised Price - Discount - Gift Card (GST inclusive)
    const netPrice = revisedPrice - discountAmount - giftCardAmount;
    
    // GST is component within Net Price
    const gstAmount = netPrice / 11;

    console.log('💰 Price calculation result:', {
      basePrice: service.service_base_price,
      durationUplift: duration?.uplift_percentage || 0,
      timeUplift: newTimeUplift,
      revisedPrice,
      discountAmount,
      giftCardAmount,
      netPrice,
      gstAmount,
      breakdown
    });

    return {
      basePrice: service.service_base_price,
      durationUplift: duration?.uplift_percentage || 0,
      timeUplift: newTimeUplift,
      revisedPrice,
      discountAmount,
      giftCardAmount,
      netPrice,
      gstAmount,
      finalPrice: netPrice,
      breakdown
    };
  };

  // Therapist fee calculation functions
  const calculateTherapistFees = () => {
    // Mirror FE: only compute when we have service, duration, date/time
    if (!booking || !booking.booking_time || !booking.duration_minutes) {
      setTherapistFeeBreakdown({
        baseRate: 0,
        afterHoursUplift: 0,
        weekendUplift: 0,
        durationMultiplier: 1,
        totalFee: 0
      });
      return;
    }
    // FE logic: determine after-hours/weekend
    const bookingTime = dayjs(booking.booking_time);
    const dayOfWeek = bookingTime.day();
    const hour = bookingTime.hour();
    const opening = businessSettings.businessOpeningHour ?? 9;
    const closing = businessSettings.businessClosingHour ?? 17;
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isAfterHours = isWeekend || hour < opening || hour >= closing;

    // Choose hourly rate based on after-hours (from settings)
    const daytimeRate = businessSettings.therapistDaytimeRate ?? 45;
    const afterhoursRate = businessSettings.therapistAfterhoursRate ?? 55;
    const hourlyRate = isAfterHours ? afterhoursRate : daytimeRate;

    // Duration uplift from duration_pricing (percentage applied to hourly rate)
    const duration = Number(booking.duration_minutes);
    const durationRule = durationsCache.find((d: any) => Number(d.duration_minutes) === duration);
    const upliftPct = durationRule?.uplift_percentage ? Number(durationRule.uplift_percentage) : 0;
    const durationUpliftAmount = hourlyRate * (upliftPct / 100);

    // FE rule: therapist fee is hourly rate plus duration uplift (not multiplied by hours)
    const fee = Math.round((hourlyRate + durationUpliftAmount) * 100) / 100;

    setTherapistFeeBreakdown({
      baseRate: hourlyRate,
      afterHoursUplift: 0, // incorporated by selecting afterhoursRate
      weekendUplift: 0,    // FE does not add separate weekend uplift beyond rate
      durationMultiplier: 1,
      totalFee: fee
    });

    console.log('💰 Therapist fee (FE parity):', {
      isWeekend,
      isAfterHours,
      opening,
      closing,
      hour,
      daytimeRate,
      afterhoursRate,
      hourlyRate,
      upliftPct,
      durationUpliftAmount,
      fee
    });
  };

  const updateBusinessSummary = () => {
    if (!booking) {
      setBusinessSummary({
        customerPayment: 0,
        therapistFee: 0,
        netProfit: 0
      });
      return;
    }

    // Get customer payment (use existing pricing logic)
    const service = services.find(s => s.id === booking.service_id);
    const basePrice = service?.service_base_price || 0;
    const duration = booking.duration_minutes || 60;
    const durationMultiplier = duration / 60;
    const customerPayment = basePrice * durationMultiplier;

    const therapistFee = therapistFeeBreakdown.totalFee;
    const netProfit = customerPayment - therapistFee;

    setBusinessSummary({
      customerPayment,
      therapistFee,
      netProfit
    });

    console.log('📊 Business summary:', {
      customerPayment,
      therapistFee,
      netProfit
    });
  };

  // Change detection function for summary
  const detectDetailedChanges = (original: Booking, current: Booking): BookingChange[] => {
    const changes: BookingChange[] = [];

    // Customer details changes
    if (original.customer_details && current.customer_details) {
      if (current.customer_details.first_name !== original.customer_details.first_name) {
        changes.push({
          field: 'customer_first_name',
          fieldLabel: 'First Name',
          originalValue: original.customer_details.first_name,
          newValue: current.customer_details.first_name,
          changeType: 'modified',
          category: 'customer'
        });
      }
      if (current.customer_details.last_name !== original.customer_details.last_name) {
        changes.push({
          field: 'customer_last_name',
          fieldLabel: 'Last Name',
          originalValue: original.customer_details.last_name,
          newValue: current.customer_details.last_name,
          changeType: 'modified',
          category: 'customer'
        });
      }
      if (current.customer_details.email !== original.customer_details.email) {
        changes.push({
          field: 'customer_email',
          fieldLabel: 'Email',
          originalValue: original.customer_details.email,
          newValue: current.customer_details.email,
          changeType: 'modified',
          category: 'customer'
        });
      }
      if (current.customer_details.phone !== original.customer_details.phone) {
        changes.push({
          field: 'customer_phone',
          fieldLabel: 'Phone',
          originalValue: original.customer_details.phone,
          newValue: current.customer_details.phone,
          changeType: 'modified',
          category: 'customer'
        });
      }
    }

    // Booking details changes
    if (current.service_id !== original.service_id) {
      const originalService = services.find(s => s.id === original.service_id);
      const newService = services.find(s => s.id === current.service_id);
      changes.push({
        field: 'service_id',
        fieldLabel: 'Service',
        originalValue: originalService?.name || 'Unknown',
        newValue: newService?.name || 'Unknown',
        changeType: 'modified',
        category: 'booking'
      });
    }

    if (current.duration_minutes !== original.duration_minutes) {
      changes.push({
        field: 'duration_minutes',
        fieldLabel: 'Duration',
        originalValue: `${original.duration_minutes || 0} minutes`,
        newValue: `${current.duration_minutes || 0} minutes`,
        changeType: 'modified',
        category: 'booking'
      });
    }

    if (current.booking_time && dayjs(current.booking_time).format('YYYY-MM-DD HH:mm') !== dayjs(original.booking_time).format('YYYY-MM-DD HH:mm')) {
      changes.push({
        field: 'booking_time',
        fieldLabel: 'Date & Time',
        originalValue: dayjs(original.booking_time).format('ddd, MMM D, YYYY [at] h:mm A'),
        newValue: dayjs(current.booking_time).format('ddd, MMM D, YYYY [at] h:mm A'),
        changeType: 'modified',
        category: 'booking'
      });
    }

    if (current.therapist_id !== original.therapist_id) {
      // Use therapist names from the booking objects (already loaded with the booking)
      const originalTherapistName = original.therapist_name ||
        (original.therapist_details ? `${original.therapist_details.first_name} ${original.therapist_details.last_name}` : 'No Therapist');
      const currentTherapistName = current.therapist_name ||
        (current.therapist_details ? `${current.therapist_details.first_name} ${current.therapist_details.last_name}` : 'No Therapist');

      changes.push({
        field: 'therapist_id',
        fieldLabel: 'Therapist',
        originalValue: originalTherapistName,
        newValue: currentTherapistName,
        changeType: 'modified',
        category: 'booking'
      });
    }

    // Location changes
    if (current.address !== original.address) {
      changes.push({
        field: 'address',
        fieldLabel: 'Address',
        originalValue: original.address || 'Not specified',
        newValue: current.address || 'Not specified',
        changeType: 'modified',
        category: 'location'
      });
    }

    if (current.business_name !== original.business_name) {
      changes.push({
        field: 'business_name',
        fieldLabel: 'Business/Hotel Name',
        originalValue: original.business_name || 'Not specified',
        newValue: current.business_name || 'Not specified',
        changeType: 'modified',
        category: 'location'
      });
    }

    if (current.room_number !== original.room_number) {
      changes.push({
        field: 'room_number',
        fieldLabel: 'Room Number',
        originalValue: original.room_number || 'Not specified',
        newValue: current.room_number || 'Not specified',
        changeType: 'modified',
        category: 'location'
      });
    }

    // Pricing changes - calculate the actual price difference
    if (current.price !== original.price) {
      const originalPrice = Number(original.price) || 0;
      const newPrice = Number(current.price) || 0;
      const priceDifference = newPrice - originalPrice;
      
      changes.push({
        field: 'price',
        fieldLabel: 'Your Service Fees',
        originalValue: `$${originalPrice.toFixed(2)}`,
        newValue: `$${newPrice.toFixed(2)}`,
        changeType: 'modified',
        category: 'pricing'
      });

      // Add breakdown of price changes if there are uplifts
      if (priceDifference !== 0) {
        // Check if duration changed
        if (current.duration_minutes !== original.duration_minutes) {
          const originalDuration = Number(original.duration_minutes) || 0;
          const newDuration = Number(current.duration_minutes) || 0;
          const durationDiff = newDuration - originalDuration;
          
          if (durationDiff > 0 && originalDuration > 0) {
            const durationUplift = (durationDiff / originalDuration) * 100;
            const upliftAmount = (originalPrice * durationUplift) / 100;
            changes.push({
              field: 'duration_uplift',
              fieldLabel: `Time Uplift ${durationUplift.toFixed(0)}%`,
              originalValue: `$0.00`,
              newValue: `$${upliftAmount.toFixed(2)}`,
              changeType: 'modified',
              category: 'pricing'
            });
          }
        }

        // Check if time-based uplift changed
        const originalTime = original.booking_time ? dayjs(original.booking_time) : null;
        const newTime = current.booking_time ? dayjs(current.booking_time) : null;
        
        if (originalTime && newTime) {
          const originalDay = originalTime.day();
          const newDay = newTime.day();
          const originalTimeStr = originalTime.format('HH:mm');
          const newTimeStr = newTime.format('HH:mm');
          
          // Check if weekend/after-hours status changed
          const originalIsWeekend = originalDay === 0 || originalDay === 6;
          const newIsWeekend = newDay === 0 || newDay === 6;
          const originalIsAfterHours = originalTimeStr >= '18:00';
          const newIsAfterHours = newTimeStr >= '18:00';
          
          if (originalIsWeekend !== newIsWeekend || originalIsAfterHours !== newIsAfterHours) {
            let upliftLabel = '';
            if (newIsWeekend && newIsAfterHours) {
              upliftLabel = 'Weekend After Hours Uplift';
            } else if (newIsWeekend) {
              upliftLabel = 'Weekend Uplift';
            } else if (newIsAfterHours) {
              upliftLabel = 'After Hours Uplift';
            }
            
            if (upliftLabel) {
              changes.push({
                field: 'time_uplift',
                fieldLabel: upliftLabel,
                originalValue: `$0.00`,
                newValue: `$${(priceDifference * 0.1).toFixed(2)}`, // Approximate uplift amount
                changeType: 'modified',
                category: 'pricing'
              });
            }
          }
        }
      }
    }

    // Preferences changes
    if (current.gender_preference !== original.gender_preference) {
      changes.push({
        field: 'gender_preference',
        fieldLabel: 'Gender Preference',
        originalValue: original.gender_preference || 'No preference',
        newValue: current.gender_preference || 'No preference',
        changeType: 'modified',
        category: 'preferences'
      });
    }

    if (current.notes !== original.notes) {
      changes.push({
        field: 'notes',
        fieldLabel: 'Notes',
        originalValue: original.notes || 'No notes',
        newValue: current.notes || 'No notes',
        changeType: 'modified',
        category: 'preferences'
      });
    }

    return changes;
  };

  // Check if there are any changes (not just price changes)
  const hasAnyChanges = () => {
    if (!originalBooking || !booking) return false;
    
    const changes = detectDetailedChanges(originalBooking, booking);
    return changes.length > 0;
  };

  // Handle show summary
  const handleShowSummary = () => {
    if (!originalBooking || !booking) return;
    
    const changes = detectDetailedChanges(originalBooking, booking);
    setSummaryChanges(changes);
    setShowSummaryModal(true);
  };

  // Handle proceed with changes
  const handleProceedWithChanges = async () => {
    if (!booking || !originalBooking) return;

    setProceedingWithChanges(true);

    try {
      const formValues = form.getFieldsValue();

      // Debug logging
      console.log('🔍 Form values:', formValues);
      console.log('🔍 Current booking state:', booking);
      console.log('🔍 Therapist fee breakdown:', therapistFeeBreakdown);
      console.log('🔍 Business summary:', businessSummary);

      // 1. Update customer information if changed
      if (originalBooking.customer_details) {
        const customerChanges = summaryChanges.filter(change => change.category === 'customer');
        if (customerChanges.length > 0) {
          const { error: customerError } = await supabaseClient
            .from('customers')
            .update({
              first_name: formValues.customer_first_name,
              last_name: formValues.customer_last_name,
              email: formValues.customer_email,
              phone: formValues.customer_phone,
            })
            .eq('id', booking.customer_id);

          if (customerError) throw customerError;
        }
      }

      // 2. Update booking record
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      // Core booking fields - use state values for calculated fields
      if (formValues.therapist_id) updateData.therapist_id = formValues.therapist_id;
      if (formValues.service_id) updateData.service_id = formValues.service_id;

      // Handle booking_time safely
      if (formValues.booking_time) {
        updateData.booking_time = dayjs(formValues.booking_time).format('YYYY-MM-DD HH:mm:ss');
      }

      if ('address' in formValues) updateData.address = formValues.address;
      if ('business_name' in formValues) updateData.business_name = formValues.business_name;
      if ('notes' in formValues) updateData.notes = formValues.notes;
      if ('gender_preference' in formValues) updateData.gender_preference = formValues.gender_preference;
      if ('room_number' in formValues) updateData.room_number = formValues.room_number;
      if ('parking' in formValues) updateData.parking = formValues.parking;

      // Use state values for duration, price, and therapist fee (not form values)
      if ('duration_minutes' in formValues || booking.duration_minutes !== originalBooking.duration_minutes) {
        updateData.duration_minutes = booking.duration_minutes;
      }

      // Always update calculated values from state
      updateData.price = businessSummary.customerPayment;
      updateData.therapist_fee = therapistFeeBreakdown.totalFee;

      console.log('🔍 Update data being sent:', updateData);

      const { error: bookingError } = await supabaseClient
        .from('bookings')
        .update(updateData)
        .eq('id', booking.id);

      if (bookingError) {
        console.error('❌ Database update error:', bookingError);
        throw bookingError;
      }

      console.log('✅ Database updated successfully');

      // 3. Send notifications
      await sendUpdateNotifications(summaryChanges);

      // 4. Success feedback
      message.success('✅ Booking updated successfully! Notifications sent to relevant parties.');
      setShowSummaryModal(false);

      // 5. Refresh booking data
      await fetchBookingDetails();

    } catch (error: any) {
      console.error('❌ Error updating booking:', error);
      message.error('Failed to update booking: ' + error.message);
    } finally {
      setProceedingWithChanges(false);
    }
  };

  // Send update notifications
  const sendUpdateNotifications = async (changes: BookingChange[]) => {
    if (!booking || !originalBooking) return;

    try {
      const formValues = form.getFieldsValue();
      const therapistChanged = changes.some(change => change.field === 'therapist_id');
      
      // Prepare booking data for emails
      const bookingData: BookingData = {
        id: booking.id,
        customer_name: `${formValues.customer_first_name || ''} ${formValues.customer_last_name || ''}`.trim(),
        customer_email: formValues.customer_email || '',
        customer_phone: formValues.customer_phone || '',
        therapist_name: booking.therapist_name || 'No Therapist Assigned',
        therapist_email: booking.therapist_details?.email || '',
        service_name: booking.service_name || 'Unknown Service',
        booking_time: formValues.booking_time ? dayjs(formValues.booking_time).format('YYYY-MM-DD HH:mm:ss') : booking.booking_time,
        duration_minutes: formValues.duration_minutes || booking.duration_minutes || 60,
        address: formValues.address || booking.address,
        business_name: formValues.business_name || booking.business_name,
        room_number: formValues.room_number || booking.room_number,
        price: formValues.price || booking.price,
        booking_id: booking.booking_id || booking.id,
        created_at: booking.created_at
      };

      // Send customer notification using admin-specific function
      const customerResult = await EmailService.sendAdminEditCustomerNotification(bookingData, changes);
      console.log('Customer email result:', customerResult);

      if (therapistChanged) {
        // Therapist was changed - send notifications to both original and new therapist
        const originalTherapist = therapists.find(t => t.id === originalBooking.therapist_id);
        const newTherapist = therapists.find(t => t.id === formValues.therapist_id);

        if (originalTherapist && newTherapist) {
          const originalTherapistData: TherapistData = {
            id: originalTherapist.id,
            first_name: originalTherapist.first_name,
            last_name: originalTherapist.last_name,
            email: originalTherapist.email,
            phone: originalTherapist.phone || ''
          };

          const newTherapistData: TherapistData = {
            id: newTherapist.id,
            first_name: newTherapist.first_name,
            last_name: newTherapist.last_name,
            email: newTherapist.email,
            phone: newTherapist.phone || ''
          };
          
          // Send reassignment notification to original therapist
          const reassignmentResult = await EmailService.sendAdminEditTherapistReassignmentOriginal(
            bookingData, 
            originalTherapistData, 
            newTherapistData
          );
          console.log('Original therapist reassignment email result:', reassignmentResult);
          
          // Send assignment notification to new therapist with fee
          const newTherapistFee = therapistFeeBreakdown.totalFee;
          const assignmentResult = await EmailService.sendAdminEditTherapistReassignmentNew(
            bookingData, 
            newTherapistData,
            newTherapistFee
          );
          console.log('New therapist assignment email result:', assignmentResult);
        }
      } else {
        // Therapist unchanged - send update to existing therapist
        const currentTherapist = therapists.find(t => t.id === formValues.therapist_id);
        if (currentTherapist) {
          const therapistData: TherapistData = {
            id: currentTherapist.id,
            first_name: currentTherapist.first_name,
            last_name: currentTherapist.last_name,
            email: currentTherapist.email,
            phone: currentTherapist.phone || ''
          };
          
          const therapistFee = therapistFeeBreakdown.totalFee;
          const updateResult = await EmailService.sendAdminEditTherapistNotification(
            bookingData, 
            therapistData, 
            changes,
            therapistFee
          );
          console.log('Therapist update email result:', updateResult);
        }
      }

    } catch (error: any) {
      console.error('Error sending notifications:', error);
      // Don't throw error here - booking was saved successfully
      message.warning('Booking updated successfully, but some notifications may not have been sent.');
    }
  };

  // Copy all existing notification and communication functions from edit.tsx
  const handleSendNotification = async () => {
    if (!booking) return;

    try {
      setSendingNotifications(true);
      
      const bookingData: BookingData = {
        id: booking.id,
        customer_name: booking.customer_name || 'Unknown Customer',
        customer_email: booking.customer_details?.email || booking.customer_email || '',
        customer_phone: booking.customer_details?.phone || booking.customer_phone || '',
        therapist_name: booking.therapist_name || 'No Therapist Assigned',
        therapist_email: booking.therapist_details?.email || '',
        service_name: booking.service_name || 'Unknown Service',
        booking_time: booking.booking_time,
        duration_minutes: booking.duration_minutes || 60,
        address: booking.address || '',
        business_name: booking.business_name || '',
        room_number: booking.room_number || '',
        notes: booking.notes || '',
        price: booking.price || 0,
        therapist_fee: booking.therapist_fee || 0,
      };

      if (notificationOptions.sendEmail) {
        await EmailService.sendBookingUpdateToCustomer(bookingData, detectedChanges);
        if (booking.therapist_details) {
          const therapistData: TherapistData = {
            id: booking.therapist_id,
            first_name: booking.therapist_details.first_name || '',
            last_name: booking.therapist_details.last_name || '',
            email: booking.therapist_details.email || '',
            phone: booking.therapist_details.phone || '',
          };
          await EmailService.sendBookingUpdateToTherapist(bookingData, therapistData, detectedChanges);
        }
      }

      if (notificationOptions.sendSMS) {
        // Use existing SMS methods
        if (booking.therapist_details) {
          await SMSService.sendBookingUpdateToCustomer(booking, booking.therapist_details, 'confirmed');
        }
      }

      message.success('Notifications sent successfully');
      setShowNotificationModal(false);
    } catch (error) {
      console.error('Error sending notifications:', error);
      message.error('Failed to send notifications');
    } finally {
      setSendingNotifications(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <Text type="danger">Booking not found</Text>
      </div>
    );
  }

  return (
    <RoleGuard requiredPermission="canEditAllBookings">
      <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #007e8c 0%, #005f6b 100%)',
          color: 'white',
          padding: '24px',
          borderRadius: '12px',
          marginBottom: '16px',
          boxShadow: '0 4px 12px rgba(0, 126, 140, 0.15)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <Title level={2} style={{ color: 'white', margin: 0, fontSize: '28px' }}>
              🏥 Admin Booking Management Platform
            </Title>
            <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: '16px' }}>
              Booking ID: {booking.booking_id || booking.id}
            </Text>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Button 
              style={{ 
                border: '2px solid rgba(255,255,255,0.3)', 
                background: 'rgba(255,255,255,0.1)', 
                color: 'white' 
              }}
            >
              📊 View History
            </Button>
            <Button 
              style={{ 
                border: '2px solid rgba(255,255,255,0.3)', 
                background: 'rgba(255,255,255,0.1)', 
                color: 'white' 
              }}
            >
              📧 Send Email
            </Button>
            <Button 
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSave}
              loading={saving}
              style={{ background: '#007e8c', borderColor: '#007e8c' }}
            >
              💾 Save Changes
            </Button>
          </div>
        </div>

        {/* Admin Alert */}
        <Alert
          message="Admin Mode: Full editing capabilities enabled"
          description="All changes will be logged and notifications sent automatically."
          type="info"
          showIcon
          style={{
            marginBottom: '20px',
            background: 'linear-gradient(135deg, #e0f7fa 0%, #b2ebf2 100%)',
            border: '1px solid #007e8c'
          }}
          action={
            <Button size="small" type="text">
              Dismiss
            </Button>
          }
        />

        {/* Main Content */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '24px' }}>
          {/* Left Panel - Booking Platform Steps */}
          <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
            {/* Progress Bar */}
            <div style={{ background: '#f8fafc', padding: '20px', borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
                {['customer', 'address', 'service', 'gender', 'datetime', 'therapist', 'details', 'payment'].map((step, index) => (
                  <div 
                    key={step}
                    style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      position: 'relative', 
                      flex: 1,
                      cursor: canNavigateToStep(step) ? 'pointer' : 'not-allowed'
                    }}
                    onClick={() => canNavigateToStep(step) && handleStepChange(step)}
                  >
                    {index < 7 && (
                      <div style={{
                        position: 'absolute',
                        top: '15px',
                        left: 'calc(50% + 15px)',
                        right: 'calc(-50% + 15px)',
                        height: '2px',
                        background: completedSteps.includes(step) || activeStep === step ? '#007e8c' : '#e5e7eb',
                        zIndex: 1
                      }} />
                    )}
                    <div style={{
                      width: '30px',
                      height: '30px',
                      borderRadius: '50%',
                      background: completedSteps.includes(step) ? '#007e8c' : activeStep === step ? '#007e8c' : '#e5e7eb',
                      color: completedSteps.includes(step) || activeStep === step ? 'white' : '#6b7280',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 600,
                      fontSize: '14px',
                      position: 'relative',
                      zIndex: 2,
                      transition: 'all 0.3s'
                    }}>
                      {completedSteps.includes(step) ? '✓' : index + 1}
                    </div>
                    <div style={{
                      marginTop: '8px',
                      fontSize: '12px',
                      fontWeight: (activeStep === step || completedSteps.includes(step)) ? 600 : 500,
                      color: (activeStep === step || completedSteps.includes(step)) ? '#007e8c' : '#6b7280',
                      textAlign: 'center',
                      textTransform: 'capitalize'
                    }}>
                      {step === 'datetime' ? 'Date/Time' : step}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Step Content */}
            <div style={{ padding: '32px' }}>
              {/* Customer Step */}
              {activeStep === 'customer' && (
                <div>
                  <div style={{ marginBottom: '24px' }}>
                    <Title level={2} style={{ fontSize: '24px', fontWeight: 600, color: '#1f2937', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      👤 Customer Details
                    </Title>
                    <Text style={{ color: '#6b7280', fontSize: '16px' }}>Review and update customer information</Text>
                  </div>
                  
                  <Row gutter={16}>
                    <Col span={12}>
                      <div style={{ marginBottom: '20px' }}>
                        <Text strong style={{ color: '#374151', marginBottom: '8px', display: 'block' }}>First Name</Text>
                        <Input 
                          value={booking.customer_details?.first_name || ''} 
                          placeholder="First Name"
                          style={{ padding: '12px 16px', border: '2px solid #e5e7eb', borderRadius: '8px' }}
                          onChange={(e) => {
                            form.setFieldsValue({ 'customer_details.first_name': e.target.value });
                            setBooking(prev => prev ? { 
                              ...prev, 
                              customer_details: { 
                                ...prev.customer_details, 
                                first_name: e.target.value || '',
                                last_name: prev.customer_details?.last_name || '',
                                email: prev.customer_details?.email || '',
                                phone: prev.customer_details?.phone || '',
                                address: prev.customer_details?.address || '',
                                notes: prev.customer_details?.notes || ''
                              } 
                            } : null);
                          }}
                        />
                      </div>
                    </Col>
                    <Col span={12}>
                      <div style={{ marginBottom: '20px' }}>
                        <Text strong style={{ color: '#374151', marginBottom: '8px', display: 'block' }}>Last Name</Text>
                        <Input 
                          value={booking.customer_details?.last_name || ''} 
                          placeholder="Last Name"
                          style={{ padding: '12px 16px', border: '2px solid #e5e7eb', borderRadius: '8px' }}
                          onChange={(e) => {
                            form.setFieldsValue({ 'customer_details.last_name': e.target.value });
                            setBooking(prev => prev ? { 
                              ...prev, 
                              customer_details: { 
                                ...prev.customer_details, 
                                first_name: prev.customer_details?.first_name || '',
                                last_name: e.target.value || '',
                                email: prev.customer_details?.email || '',
                                phone: prev.customer_details?.phone || '',
                                address: prev.customer_details?.address || '',
                                notes: prev.customer_details?.notes || ''
                              } 
                            } : null);
                          }}
                        />
                      </div>
                    </Col>
                  </Row>

                  <Row gutter={16}>
                    <Col span={12}>
                      <div style={{ marginBottom: '20px' }}>
                        <Text strong style={{ color: '#374151', marginBottom: '8px', display: 'block' }}>Email</Text>
                        <Input 
                          type="email"
                          value={booking.customer_details?.email || ''} 
                          placeholder="Email Address"
                          style={{ padding: '12px 16px', border: '2px solid #e5e7eb', borderRadius: '8px' }}
                          onChange={(e) => {
                            form.setFieldsValue({ 'customer_details.email': e.target.value });
                            setBooking(prev => prev ? { 
                              ...prev, 
                              customer_details: { 
                                ...prev.customer_details, 
                                first_name: prev.customer_details?.first_name || '',
                                last_name: prev.customer_details?.last_name || '',
                                email: e.target.value || '',
                                phone: prev.customer_details?.phone || '',
                                address: prev.customer_details?.address || '',
                                notes: prev.customer_details?.notes || ''
                              } 
                            } : null);
                          }}
                        />
                      </div>
                    </Col>
                    <Col span={12}>
                      <div style={{ marginBottom: '20px' }}>
                        <Text strong style={{ color: '#374151', marginBottom: '8px', display: 'block' }}>Phone</Text>
                        <Input 
                          type="tel"
                          value={booking.customer_details?.phone || ''} 
                          placeholder="Phone Number"
                          style={{ padding: '12px 16px', border: '2px solid #e5e7eb', borderRadius: '8px' }}
                          onChange={(e) => {
                            form.setFieldsValue({ 'customer_details.phone': e.target.value });
                            setBooking(prev => prev ? { 
                              ...prev, 
                              customer_details: { 
                                ...prev.customer_details, 
                                first_name: prev.customer_details?.first_name || '',
                                last_name: prev.customer_details?.last_name || '',
                                email: prev.customer_details?.email || '',
                                phone: e.target.value || '',
                                address: prev.customer_details?.address || '',
                                notes: prev.customer_details?.notes || ''
                              } 
                            } : null);
                          }}
                        />
                      </div>
                    </Col>
                  </Row>

                  <div style={{ marginBottom: '20px' }}>
                    <Text strong style={{ color: '#374151', marginBottom: '8px', display: 'block' }}>Business Name</Text>
                    <Input 
                      value={booking.business_name || ''} 
                      placeholder="Business Name (Optional)"
                      style={{ padding: '12px 16px', border: '2px solid #e5e7eb', borderRadius: '8px' }}
                      onChange={(e) => {
                        form.setFieldsValue({ business_name: e.target.value });
                        setBooking(prev => prev ? { ...prev, business_name: e.target.value } : null);
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '32px', paddingTop: '24px', borderTop: '1px solid #e5e7eb' }}>
                    <Button style={{ background: '#f3f4f6', color: '#374151', border: '2px solid #e5e7eb', borderRadius: '8px', fontWeight: 600, fontSize: '16px' }}>
                      ← Back
                    </Button>
                    <Button 
                      type="primary"
                      style={{ background: '#007e8c', borderColor: '#007e8c', borderRadius: '8px', fontWeight: 600, fontSize: '16px' }}
                      onClick={() => {
                        markStepCompleted('customer');
                        handleStepChange('address');
                      }}
                    >
                      Continue →
                    </Button>
                  </div>
                </div>
              )}

              {/* Address Step */}
              {activeStep === 'address' && (
                <div>
                  <div style={{ marginBottom: '24px' }}>
                    <Title level={2} style={{ fontSize: '24px', fontWeight: 600, color: '#1f2937', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      📍 Location Details
                    </Title>
                    <Text style={{ color: '#6b7280', fontSize: '16px' }}>Review and update booking location information</Text>
                  </div>
                  
                  <div style={{ marginBottom: '20px' }}>
                    <Text strong style={{ color: '#374151', marginBottom: '8px', display: 'block' }}>Address</Text>
                    <GooglePlacesAutocomplete
                      value={booking.address || ''} 
                      placeholder="Start typing your address..."
                      style={{ padding: '12px 16px', border: '2px solid #e5e7eb', borderRadius: '8px' }}
                      onChange={(value) => {
                        form.setFieldsValue({ address: value });
                        setBooking(prev => prev ? { ...prev, address: value } : null);
                      }}
                      onPlaceSelect={(place) => {
                        console.log('📍 Place selected:', place);
                        // Update booking with the selected place
                        setBooking(prev => prev ? { 
                          ...prev, 
                          address: place.address,
                          // Store coordinates for later use
                          latitude: place.lat,
                          longitude: place.lng
                        } : null);
                        
                        // Trigger address verification with real coordinates
                        checkTherapistCoverageForAddress(place.address, place.lat, place.lng);
                      }}
                    />
                    {addressStatus && (
                      <div style={{ 
                        marginTop: '8px', 
                        padding: '8px 12px', 
                        borderRadius: '6px',
                        background: addressVerified ? '#f0fdf4' : '#fef2f2',
                        border: `1px solid ${addressVerified ? '#bbf7d0' : '#fecaca'}`,
                        color: addressVerified ? '#166534' : '#dc2626',
                        fontSize: '14px'
                      }}>
                        {addressStatus}
                      </div>
                    )}
                  </div>

                  <Row gutter={16}>
                    <Col span={12}>
                      <div style={{ marginBottom: '20px' }}>
                        <Text strong style={{ color: '#374151', marginBottom: '8px', display: 'block' }}>Room Details</Text>
                        <Input 
                          value={booking.room_number || ''} 
                          placeholder="Room number or details"
                          style={{ padding: '12px 16px', border: '2px solid #e5e7eb', borderRadius: '8px' }}
                          onChange={(e) => {
                            form.setFieldsValue({ room_number: e.target.value });
                            setBooking(prev => prev ? { ...prev, room_number: e.target.value } : null);
                          }}
                        />
                      </div>
                    </Col>
                    <Col span={12}>
                      <div style={{ marginBottom: '20px' }}>
                        <Text strong style={{ color: '#374151', marginBottom: '8px', display: 'block' }}>Parking</Text>
                        <Select 
                          value={booking.parking || 'free'}
                          style={{ width: '100%' }}
                          size="large"
                          onChange={(value) => {
                            form.setFieldsValue({ parking: value });
                            setBooking(prev => prev ? { ...prev, parking: value } : null);
                          }}
                        >
                          <Option value="free">Free Parking Available</Option>
                          <Option value="paid">Paid Parking Required</Option>
                          <Option value="unknown">Unknown</Option>
                        </Select>
                      </div>
                    </Col>
                  </Row>

                  <div style={{ marginBottom: '20px' }}>
                    <Text strong style={{ color: '#374151', marginBottom: '8px', display: 'block' }}>Special Notes</Text>
                    <Input.TextArea 
                      value={booking.notes || ''} 
                      placeholder="Any special instructions or notes for this location"
                      rows={3}
                      style={{ padding: '12px 16px', border: '2px solid #e5e7eb', borderRadius: '8px' }}
                      onChange={(e) => {
                        form.setFieldsValue({ notes: e.target.value });
                        setBooking(prev => prev ? { ...prev, notes: e.target.value } : null);
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '32px', paddingTop: '24px', borderTop: '1px solid #e5e7eb' }}>
                    <Button 
                      style={{ background: '#f3f4f6', color: '#374151', border: '2px solid #e5e7eb', borderRadius: '8px', fontWeight: 600, fontSize: '16px' }}
                      onClick={() => handleStepChange('customer')}
                    >
                      ← Back
                    </Button>
                    <Button 
                      type="primary"
                      style={{ 
                        background: '#007e8c', 
                        borderColor: '#007e8c', 
                        borderRadius: '8px', 
                        fontWeight: 600, 
                        fontSize: '16px' 
                      }}
                      onClick={() => {
                        markStepCompleted('address');
                        handleStepChange('service');
                      }}
                    >
                      {!addressVerified && booking.address?.trim() ? 'Verify Address First' : 'Continue →'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Service Step */}
              {activeStep === 'service' && (
                <div>
                  <div style={{ marginBottom: '24px' }}>
                    <Title level={2} style={{ fontSize: '24px', fontWeight: 600, color: '#1f2937', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      🛠️ Service & Duration
                    </Title>
                    <Text style={{ color: '#6b7280', fontSize: '16px' }}>Select the type of service and duration. Admin can modify pricing and availability.</Text>
                  </div>
                  
                  <div style={{ marginBottom: '20px' }}>
                    <Text strong style={{ color: '#374151', marginBottom: '16px', display: 'block' }}>Service Type</Text>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', margin: '20px 0' }}>
                      {services.map((service) => (
                        <div 
                          key={service.id}
                          style={{
                            border: service.id === booking.service_id ? '2px solid #007e8c' : '2px solid #e5e7eb',
                            borderRadius: '12px',
                            padding: '20px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            background: service.id === booking.service_id ? '#e0f7fa' : 'white'
                          }}
                          onClick={() => handleServiceChange(service.id)}
                        >
                          <Title level={4} style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', marginBottom: '8px' }}>
                            {service.name}
                          </Title>
                          {service.short_description && (
                            <Text style={{ color: '#6b7280', marginBottom: '12px', display: 'block' }}>
                              {service.short_description}
                            </Text>
                          )}
                          <div style={{ fontSize: '20px', fontWeight: 700, color: '#007e8c' }}>
                            ${service.service_base_price}/hour
                          </div>
                          <div style={{ marginTop: '8px', padding: '4px 12px', background: '#e0f7fa', color: '#007e8c', borderRadius: '20px', fontSize: '12px', fontWeight: 600, display: 'inline-block' }}>
                            🔧 Admin: Can modify price
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginBottom: '20px' }}>
                    <Text strong style={{ color: '#374151', marginBottom: '16px', display: 'block' }}>Duration</Text>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '12px', margin: '16px 0' }}>
                      {[60, 90, 120].map((duration) => (
                        <div 
                          key={duration}
                          style={{
                            border: booking.duration_minutes === duration ? '2px solid #007e8c' : '2px solid #e5e7eb',
                            borderRadius: '8px',
                            padding: '16px',
                            textAlign: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            background: booking.duration_minutes === duration ? '#e0f7fa' : 'white'
                          }}
                          onClick={() => handleDurationChange(duration)}
                        >
                          <Title level={4} style={{ fontSize: '16px', color: '#1f2937', marginBottom: '4px' }}>
                            {duration} mins
                          </Title>
                          <Text style={{ fontSize: '14px', color: '#007e8c', fontWeight: 600 }}>
                            ${(() => {
                              const currentService = selectedService || services.find(s => s.id === booking.service_id);
                              return currentService ? (currentService.service_base_price * (duration / 60)).toFixed(0) : '0';
                            })()}
                          </Text>
                          {duration > 60 && (
                            <div style={{ marginTop: '8px', padding: '2px 8px', background: '#e0f7fa', color: '#007e8c', borderRadius: '20px', fontSize: '10px', fontWeight: 600, display: 'inline-block' }}>
                              +${(() => {
                                const currentService = selectedService || services.find(s => s.id === booking.service_id);
                                if (!currentService) return '0';
                                const basePrice = currentService.service_base_price;
                                const durationPrice = currentService.service_base_price * (duration / 60);
                                return (durationPrice - basePrice).toFixed(0);
                              })()} uplift
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Pricing preview note on Services step */}
                  <div style={{
                    margin: '12px 0 20px 0',
                    padding: '12px',
                    background: '#f9fafb',
                    border: '1px dashed #cbd5e1',
                    borderRadius: '8px',
                    color: '#475569',
                    fontSize: '14px'
                  }}>
                    Pricing preview updates after selecting date/time. Full live calculation is shown on Payment.
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '32px', paddingTop: '24px', borderTop: '1px solid #e5e7eb' }}>
                    <Button 
                      style={{ background: '#f3f4f6', color: '#374151', border: '2px solid #e5e7eb', borderRadius: '8px', fontWeight: 600, fontSize: '16px' }}
                      onClick={() => handleStepChange('address')}
                    >
                      ← Back
                    </Button>
                    <Button 
                      type="primary"
                      style={{ background: '#007e8c', borderColor: '#007e8c', borderRadius: '8px', fontWeight: 600, fontSize: '16px' }}
                      onClick={() => {
                        markStepCompleted('service');
                        handleStepChange('gender');
                      }}
                    >
                      Continue →
                    </Button>
                  </div>
                </div>
              )}

              {/* Gender Step */}
              {activeStep === 'gender' && (
                <div>
                  <div style={{ marginBottom: '24px' }}>
                    <Title level={2} style={{ fontSize: '24px', fontWeight: 600, color: '#1f2937', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      🧑‍🤝‍🧑 Gender Preferences
                    </Title>
                    <Text style={{ color: '#6b7280', fontSize: '16px' }}>Let us know your therapist gender preference and fallback option</Text>
                  </div>
                  
                  <div style={{ marginBottom: '20px' }}>
                    <Text strong style={{ color: '#374151', marginBottom: '16px', display: 'block' }}>Do you have a therapist gender preference?</Text>
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                      {[
                        { value: 'any', label: "Don't mind, just want a great massage", icon: '🤝' },
                        { value: 'female', label: 'Female', icon: '👩' },
                        { value: 'male', label: 'Male', icon: '👨' }
                      ].map((option) => (
                        <div 
                          key={option.value}
                          style={{
                            border: booking.gender_preference === option.value ? '2px solid #007e8c' : '2px solid #e5e7eb',
                            borderRadius: '8px',
                            padding: '16px 20px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            background: booking.gender_preference === option.value ? '#e0f7fa' : 'white',
                            flex: '1',
                            minWidth: '200px',
                            textAlign: 'center'
                          }}
                          onClick={() => {
                            form.setFieldsValue({ gender_preference: option.value });
                            setBooking(prev => prev ? { ...prev, gender_preference: option.value } : null);
                          }}
                        >
                          <div style={{ fontSize: '24px', marginBottom: '8px' }}>{option.icon}</div>
                          <div style={{ fontWeight: 600, color: '#1f2937' }}>{option.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginBottom: '20px' }}>
                    <Text strong style={{ color: '#374151', marginBottom: '16px', display: 'block' }}>
                      If your selected therapist is not available, would you like us to look for a similar therapist for you?
                    </Text>
                    <div style={{ display: 'flex', gap: '16px' }}>
                      {[
                        { value: 'yes', label: 'Yes, happy to accept a similar therapist' },
                        { value: 'no', label: 'No – I will request a different time with the same therapist' }
                      ].map((option) => (
                        <div 
                          key={option.value}
                          style={{
                            border: '2px solid #e5e7eb',
                            borderRadius: '8px',
                            padding: '12px 16px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            background: 'white',
                            flex: '1',
                            textAlign: 'center'
                          }}
                          onClick={() => {
                            // Handle fallback preference
                          }}
                        >
                          <div style={{ fontWeight: 500, color: '#1f2937' }}>{option.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '32px', paddingTop: '24px', borderTop: '1px solid #e5e7eb' }}>
                    <Button 
                      style={{ background: '#f3f4f6', color: '#374151', border: '2px solid #e5e7eb', borderRadius: '8px', fontWeight: 600, fontSize: '16px' }}
                      onClick={() => handleStepChange('service')}
                    >
                      ← Back
                    </Button>
                    <Button 
                      type="primary"
                      style={{ background: '#007e8c', borderColor: '#007e8c', borderRadius: '8px', fontWeight: 600, fontSize: '16px' }}
                      onClick={() => {
                        markStepCompleted('gender');
                        handleStepChange('datetime');
                      }}
                    >
                      Continue →
                    </Button>
                  </div>
                </div>
              )}

              {/* Date/Time Step */}
              {activeStep === 'datetime' && (
                <div>
                  <div style={{ marginBottom: '24px' }}>
                    <Title level={2} style={{ fontSize: '24px', fontWeight: 600, color: '#1f2937', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      🗓️ Date & Time
                    </Title>
                    <Text style={{ color: '#6b7280', fontSize: '16px' }}>Choose when you'd like your massage. Admin can modify availability and pricing.</Text>
                  </div>
                  
                  <Row gutter={16}>
                    <Col span={12}>
                      <div style={{ marginBottom: '20px' }}>
                        <Text strong style={{ color: '#374151', marginBottom: '8px', display: 'block' }}>Date</Text>
                        <DatePicker 
                          value={booking.booking_time ? dayjs(booking.booking_time) : null}
                          style={{ width: '100%', padding: '12px 16px', border: '2px solid #e5e7eb', borderRadius: '8px' }}
                          onChange={(date) => {
                            if (date) {
                              form.setFieldsValue({ booking_time: date });
                              setBooking(prev => prev ? { ...prev, booking_time: date.toISOString() } : null);
                            }
                          }}
                        />
                      </div>
                    </Col>
                    <Col span={12}>
                      <div style={{ marginBottom: '20px' }}>
                        <Text strong style={{ color: '#374151', marginBottom: '8px', display: 'block' }}>Duration</Text>
                        <div style={{ padding: '12px 16px', border: '2px solid #e5e7eb', borderRadius: '8px', background: '#f9f9f9' }}>
                          {booking.duration_minutes || 60} minutes
                        </div>
                      </div>
                    </Col>
                  </Row>

                  <div style={{ marginBottom: '20px' }}>
                    <Text strong style={{ color: '#374151', marginBottom: '16px', display: 'block' }}>Available Time Slots</Text>
                    
                    {loadingSlots ? (
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'center', 
                        alignItems: 'center', 
                        padding: '40px',
                        border: '2px solid #e5e7eb',
                        borderRadius: '8px',
                        background: '#f9f9f9'
                      }}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ 
                            width: '40px', 
                            height: '40px', 
                            border: '3px solid #e5e7eb',
                            borderTop: '3px solid #007e8c',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite',
                            margin: '0 auto 16px'
                          }}></div>
                          <Text style={{ color: '#6b7280' }}>Loading available slots...</Text>
                        </div>
                      </div>
                    ) : availableTimeSlots.length > 0 ? (
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', 
                        gap: '8px',
                        margin: '16px 0'
                      }}>
                        {availableTimeSlots.map((time) => {
                          const isSelected = booking.booking_time ? dayjs(booking.booking_time).format('HH:mm') === time : false;
                          const hour = parseInt(time.split(':')[0]);
                          const isWeekend = booking.booking_time ? dayjs(booking.booking_time).day() === 0 || dayjs(booking.booking_time).day() === 6 : false;
                          const isAfterHours = isWeekend || hour >= 18; // After 18:00 or weekend
                          
                          return (
                            <div 
                              key={time}
                              style={{
                                padding: '12px 8px',
                                border: isSelected ? '2px solid #007e8c' : '2px solid #e5e7eb',
                                borderRadius: '6px',
                                textAlign: 'center',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: '500',
                                transition: 'all 0.2s',
                                background: isSelected ? '#007e8c' : isAfterHours ? '#fef3c7' : '#dcfce7',
                                color: isSelected ? 'white' : isAfterHours ? '#92400e' : '#166534'
                              }}
                              onClick={() => {
                                const currentDate = booking.booking_time ? dayjs(booking.booking_time) : dayjs();
                                const newDateTime = currentDate.hour(parseInt(time.split(':')[0])).minute(parseInt(time.split(':')[1]));
                                form.setFieldsValue({ booking_time: newDateTime });
                                setBooking(prev => prev ? { ...prev, booking_time: newDateTime.toISOString() } : null);
                              }}
                            >
                              {time}
                              {isAfterHours && (
                                <div style={{ fontSize: '10px', marginTop: '2px' }}>🌙</div>
                              )}
                              {isWeekend && (
                                <div style={{ fontSize: '10px', marginTop: '2px' }}>📅</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : booking.booking_time ? (
                      <div style={{ 
                        padding: '20px',
                        border: '2px solid #fee2e2',
                        borderRadius: '8px',
                        background: '#fef2f2',
                        textAlign: 'center'
                      }}>
                        <Text style={{ color: '#991b1b', fontSize: '16px', fontWeight: '500' }}>
                          No available time slots for this date
                        </Text>
                        <Text style={{ color: '#6b7280', fontSize: '14px', marginTop: '8px', display: 'block' }}>
                          Try selecting a different date or service
                        </Text>
                      </div>
                    ) : (
                      <div style={{ 
                        padding: '20px',
                        border: '2px solid #e5e7eb',
                        borderRadius: '8px',
                        background: '#f9f9f9',
                        textAlign: 'center'
                      }}>
                        <Text style={{ color: '#6b7280', fontSize: '16px' }}>
                          Please select a date to see available time slots
                        </Text>
                      </div>
                    )}
                    <div style={{ marginTop: '12px', fontSize: '12px', color: '#6b7280' }}>
                      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <div style={{ width: '12px', height: '12px', background: '#dcfce7', borderRadius: '2px' }}></div>
                          <span>Available</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <div style={{ width: '12px', height: '12px', background: '#fef3c7', borderRadius: '2px' }}></div>
                          <span>After Hours (+$20)</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <div style={{ width: '12px', height: '12px', background: '#fee2e2', borderRadius: '2px' }}></div>
                          <span>Unavailable</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '32px', paddingTop: '24px', borderTop: '1px solid #e5e7eb' }}>
                    <Button 
                      style={{ background: '#f3f4f6', color: '#374151', border: '2px solid #e5e7eb', borderRadius: '8px', fontWeight: 600, fontSize: '16px' }}
                      onClick={() => handleStepChange('gender')}
                    >
                      ← Back
                    </Button>
                    <Button 
                      type="primary"
                      style={{ background: '#007e8c', borderColor: '#007e8c', borderRadius: '8px', fontWeight: 600, fontSize: '16px' }}
                      onClick={() => {
                        markStepCompleted('datetime');
                        handleStepChange('therapist');
                      }}
                    >
                      Continue →
                    </Button>
                  </div>
                </div>
              )}

              {/* Therapist Step */}
              {activeStep === 'therapist' && (
                <div>
                  <div style={{ marginBottom: '24px' }}>
                    <Title level={2} style={{ fontSize: '24px', fontWeight: 600, color: '#1f2937', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      👨‍⚕️ Therapist Selection
                    </Title>
                    <Text style={{ color: '#6b7280', fontSize: '16px' }}>Choose your preferred therapist. Admin can reassign and modify availability.</Text>
                  </div>
                  
                  <div style={{ marginBottom: '20px' }}>
                    <Text strong style={{ color: '#374151', marginBottom: '16px', display: 'block' }}>Available Therapists</Text>
                    
                    {loadingTherapists ? (
                      <div style={{ textAlign: 'center', padding: '40px' }}>
                        <Spin size="large" />
                        <div style={{ marginTop: '16px', color: '#6b7280' }}>Finding available therapists...</div>
                      </div>
                    ) : availableTherapists.length === 0 ? (
                      <div style={{ 
                        padding: '20px', 
                        border: '2px solid #e5e7eb', 
                        borderRadius: '8px', 
                        background: '#f9f9f9', 
                        textAlign: 'center' 
                      }}>
                        <Text style={{ color: '#6b7280', fontSize: '16px' }}>
                          No therapists available for the selected time slot. Please try a different time or date.
                        </Text>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px', margin: '16px 0' }}>
                        {(availableTherapists.length > 0 ? availableTherapists : therapists).map((therapist) => {
                          const isSelected = booking.therapist_id === therapist.id;
                          const hourlyRate = therapist.hourly_rate || 45;
                        
                        return (
                          <div 
                            key={therapist.id}
                            style={{
                              border: isSelected ? '2px solid #007e8c' : '2px solid #e5e7eb',
                              borderRadius: '12px',
                              padding: '20px',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              background: isSelected ? '#e0f7fa' : 'white',
                              opacity: 1
                            }}
                            onClick={() => {
                              form.setFieldsValue({ therapist_id: therapist.id });
                              setBooking(prev => prev ? { 
                                ...prev, 
                                therapist_id: therapist.id,
                                therapist_name: `${therapist.first_name} ${therapist.last_name}`,
                                therapist_details: {
                                  first_name: therapist.first_name,
                                  last_name: therapist.last_name,
                                  email: therapist.email,
                                  phone: therapist.phone
                                }
                              } : null);
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                              <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '50%',
                                background: '#007e8c',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 600,
                                fontSize: '18px'
                              }}>
                                {therapist.first_name.charAt(0)}{therapist.last_name.charAt(0)}
                              </div>
                              <div>
                                <div style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937' }}>
                                  {therapist.first_name} {therapist.last_name}
                                </div>
                                <div style={{ color: '#6b7280', fontSize: '14px' }}>
                                  {therapist.email}
                                </div>
                              </div>
                            </div>
                            

                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              <div style={{ 
                                padding: '4px 8px', 
                                background: '#dcfce7', 
                                color: '#166534',
                                borderRadius: '12px',
                                fontSize: '12px',
                                fontWeight: 600
                              }}>
                                ✅ Available for Selected Time
                              </div>
                              {isSelected && (
                                <div style={{ 
                                  padding: '4px 8px', 
                                  background: '#e0f7fa', 
                                  color: '#007e8c',
                                  borderRadius: '12px',
                                  fontSize: '12px',
                                  fontWeight: 600
                                }}>
                                  🔧 Admin: Can reassign
                                </div>
                              )}
                            </div>
                          </div>
                        );
                        })}
                      </div>
                    )}
                    
                    <div style={{ marginTop: '16px', padding: '12px', background: '#f0fdfa', borderRadius: '8px', fontSize: '14px' }}>
                      <strong>🔧 Admin Tools:</strong> Click any therapist to reassign. Availability is updated in real-time based on existing bookings.
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '32px', paddingTop: '24px', borderTop: '1px solid #e5e7eb' }}>
                    <Button 
                      style={{ background: '#f3f4f6', color: '#374151', border: '2px solid #e5e7eb', borderRadius: '8px', fontWeight: 600, fontSize: '16px' }}
                      onClick={() => handleStepChange('datetime')}
                    >
                      ← Back
                    </Button>
                    <Button 
                      type="primary"
                      style={{ background: '#007e8c', borderColor: '#007e8c', borderRadius: '8px', fontWeight: 600, fontSize: '16px' }}
                      onClick={() => {
                        markStepCompleted('therapist');
                        handleStepChange('payment');
                      }}
                    >
                      Continue →
                    </Button>
                  </div>
                </div>
              )}


              {/* Payment Step */}
              {activeStep === 'payment' && (
                <div>
                  <div style={{ marginBottom: '24px' }}>
                    <Title level={2} style={{ fontSize: '24px', fontWeight: 600, color: '#1f2937', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      💳 Payment & Confirmation
                    </Title>
                    <Text style={{ color: '#6b7280', fontSize: '16px' }}>Review pricing and payment details. Admin can apply discounts and modify payment status.</Text>
                  </div>

                  {/* Current vs Estimated Pricing Panels - Side by Side */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                    
                    {/* Current Booking Panel */}
                    <div style={{
                      background: '#f8fafc',
                      border: '2px solid #cbd5e1',
                      borderRadius: '12px',
                      padding: '20px'
                    }}>
                      <div style={{ fontSize: '16px', fontWeight: 600, color: '#0891b2', marginBottom: '20px' }}>
                        Current Booking
                      </div>
                      {currentPricing ? (
                        <div style={{ display: 'grid', gap: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0', fontSize: '15px', color: '#475569' }}>
                            <span>Current Price</span>
                            <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '18px' }}>${currentPricing.finalPrice.toFixed(2)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0', fontSize: '14px', color: '#64748b' }}>
                            <span>GST (10%)</span>
                            <span style={{ fontWeight: 600, color: '#475569' }}>${currentPricing.gstAmount.toFixed(2)}</span>
                          </div>
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', color: '#94a3b8', padding: '20px', fontSize: '14px' }}>
                          Loading original pricing...
                        </div>
                      )}
                    </div>

                    {/* Revised Booking Panel */}
                    <div style={{
                      background: 'linear-gradient(135deg, #f0fdfa 0%, #e0f7fa 100%)',
                      border: '2px solid #0891b2',
                      borderRadius: '12px',
                      padding: '20px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <div style={{ fontSize: '16px', fontWeight: 600, color: '#0891b2' }}>
                          Revised Booking
                        </div>
                        {estimatedPricing && (
                          <div style={{ fontSize: '18px', fontWeight: 700, color: '#0891b2' }}>
                            Revised Price: ${estimatedPricing.revisedPrice.toFixed(2)}
                          </div>
                        )}
                      </div>
                      {estimatedPricing ? (
                        <div style={{ display: 'grid', gap: '10px' }}>
                          {estimatedPricing.basePrice && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0', fontSize: '14px', color: '#0f766e' }}>
                              <span>Hourly Rate</span>
                              <span style={{ fontWeight: 600, color: '#115e59' }}>${estimatedPricing.basePrice.toFixed(2)}</span>
                            </div>
                          )}
                          {estimatedPricing.basePrice && estimatedPricing.durationUplift > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0', fontSize: '14px', color: '#0f766e' }}>
                              <span>Time Uplift ({estimatedPricing.durationUplift}%)</span>
                              <span style={{ fontWeight: 600, color: '#059669' }}>+${(estimatedPricing.basePrice * (estimatedPricing.durationUplift / 100)).toFixed(2)}</span>
                            </div>
                          )}
                          {estimatedPricing.basePrice && estimatedPricing.timeUplift > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0', fontSize: '14px', color: '#0f766e' }}>
                              <span>Weekend/Afterhours Uplift ({estimatedPricing.timeUplift}%)</span>
                              <span style={{ fontWeight: 600, color: '#059669' }}>+${(estimatedPricing.basePrice * (estimatedPricing.timeUplift / 100)).toFixed(2)}</span>
                            </div>
                          )}
                          {estimatedPricing.discountAmount > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0', fontSize: '14px', color: '#0f766e' }}>
                              <span>Discount {booking?.discount_code ? `(${booking.discount_code})` : ''}</span>
                              <span style={{ fontWeight: 600, color: '#dc2626' }}>-${estimatedPricing.discountAmount.toFixed(2)}</span>
                            </div>
                          )}
                          {estimatedPricing.giftCardAmount > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0', fontSize: '14px', color: '#0f766e' }}>
                              <span>Gift Card {booking?.gift_card_code ? `(${booking.gift_card_code})` : ''}</span>
                              <span style={{ fontWeight: 600, color: '#dc2626' }}>-${estimatedPricing.giftCardAmount.toFixed(2)}</span>
                            </div>
                          )}
                          {estimatedPricing.netPrice !== undefined && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0', fontSize: '14px', color: '#0f766e', fontWeight: 600 }}>
                              <span>Net Price</span>
                              <span style={{ fontWeight: 700, color: '#0891b2' }}>${estimatedPricing.netPrice.toFixed(2)}</span>
                            </div>
                          )}
                          {estimatedPricing.gstAmount !== undefined && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0', fontSize: '14px', color: '#64748b' }}>
                              <span>GST (10%)</span>
                              <span style={{ fontWeight: 600, color: '#475569' }}>${estimatedPricing.gstAmount.toFixed(2)}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', color: '#5eead4', padding: '20px', fontSize: '14px' }}>
                          Select service, duration, and date/time to see estimated pricing
                        </div>
                      )}

                      {/* Discount & Gift Card fields under Revised panel - EXACTLY like frontend */}
                      <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '2px solid #5eead4' }}>
                        <Text strong style={{ color: '#0891b2', marginBottom: '16px', display: 'block', fontSize: '15px' }}>🎁 Apply Discounts & Gift Cards</Text>
                        
                        <div style={{ marginBottom: '14px' }}>
                          <Text style={{ color: '#0f766e', fontSize: '13px', marginBottom: '6px', display: 'block', fontWeight: 500 }}>Promo Code</Text>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <Input 
                              value={discountInput}
                              placeholder="Enter promo code"
                              disabled={discountStatus === 'applied'}
                              style={{ padding: '10px 14px', border: '2px solid #99f6e4', borderRadius: '6px', fontSize: '14px', flex: 1 }}
                              onChange={(e) => setDiscountInput(e.target.value)}
                              onPressEnter={applyDiscount}
                            />
                            {discountStatus !== 'applied' ? (
                              <Button 
                                type="primary" 
                                onClick={applyDiscount}
                                style={{ background: '#0891b2', borderColor: '#0891b2' }}
                              >
                                Apply
                              </Button>
                            ) : (
                              <Button 
                                danger
                                onClick={removeDiscount}
                              >
                                Remove
                              </Button>
                            )}
                          </div>
                          {discountStatus === 'applied' && (
                            <Text style={{ color: '#059669', fontSize: '13px', marginTop: '4px', display: 'block' }}>
                              ✅ Discount applied!
                            </Text>
                          )}
                        </div>

                        <div>
                          <Text style={{ color: '#0f766e', fontSize: '13px', marginBottom: '6px', display: 'block', fontWeight: 500 }}>Gift Card</Text>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <Input 
                              value={giftCardInput}
                              placeholder="Enter gift card code"
                              disabled={giftCardStatus === 'applied'}
                              style={{ padding: '10px 14px', border: '2px solid #99f6e4', borderRadius: '6px', fontSize: '14px', flex: 1 }}
                              onChange={(e) => setGiftCardInput(e.target.value)}
                              onPressEnter={applyGiftCard}
                            />
                            {giftCardStatus !== 'applied' ? (
                              <Button 
                                type="primary" 
                                onClick={applyGiftCard}
                                style={{ background: '#0891b2', borderColor: '#0891b2' }}
                              >
                                Apply
                              </Button>
                            ) : (
                              <Button 
                                danger
                                onClick={removeGiftCard}
                              >
                                Remove
                              </Button>
                            )}
                          </div>
                          {giftCardStatus === 'applied' && (
                            <Text style={{ color: '#059669', fontSize: '13px', marginTop: '4px', display: 'block' }}>
                              ✅ Gift card applied!
                            </Text>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Price Delta Banner */}
                  {currentPricing && estimatedPricing && (
                    <div style={{
                      padding: '16px',
                      marginBottom: '24px',
                      borderRadius: '8px',
                      background: priceDelta !== 0 ? '#dc2626' : '#f0fdf4',
                      border: `2px solid ${priceDelta !== 0 ? '#991b1b' : '#10b981'}`,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <Text strong style={{ fontSize: '16px', fontWeight: 700, color: priceDelta !== 0 ? '#ffffff' : '#065f46' }}>
                          {priceDelta > 0 ? '⚠️ Additional Payment Required' : priceDelta < 0 ? '💰 Price Decrease - Refund Required' : '✅ No Price Change'}
                        </Text>
                        {priceDelta !== 0 && (
                          <div style={{ marginTop: '4px', fontSize: '14px', fontWeight: 600, color: '#ffffff' }}>
                            Delta: {priceDelta > 0 ? '+' : ''}${priceDelta.toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Payment Method - Show only when additional payment required */}
                  {priceDelta > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                      <Text strong style={{ color: '#374151', marginBottom: '8px', display: 'block' }}>Payment Method</Text>
                      <Select 
                        value={booking.payment_method || undefined}
                        placeholder="Select payment method"
                        style={{ width: '100%' }}
                        size="large"
                        onChange={(value) => {
                          form.setFieldsValue({ payment_method: value });
                          setBooking(prev => prev ? { ...prev, payment_method: value } : null);
                        }}
                      >
                        <Option value="card">Credit/Debit Card</Option>
                        <Option value="bank_transfer">Bank Transfer (EFT)</Option>
                      </Select>
                    </div>
                  )}

                  {/* Credit Card Fields - Stripe Element */}
                  {priceDelta > 0 && booking.payment_method === 'card' && (
                    <div style={{ 
                      marginBottom: '20px', 
                      padding: '20px', 
                      background: '#f8fafc', 
                      border: '2px solid #cbd5e1', 
                      borderRadius: '8px' 
                    }}>
                      <Text strong style={{ color: '#374151', marginBottom: '12px', display: 'block' }}>💳 Credit Card Details</Text>
                      <Text style={{ color: '#6b7280', fontSize: '14px', marginBottom: '16px', display: 'block' }}>
                        Additional payment required: ${priceDelta.toFixed(2)}
                      </Text>
                      
                      <div style={{ marginBottom: '12px' }}>
                        <Text style={{ color: '#374151', fontSize: '13px', marginBottom: '6px', display: 'block' }}>Card Information</Text>
                        <div 
                          id="stripe-card-element"
                          style={{ 
                            padding: '12px 14px', 
                            border: '2px solid #e5e7eb', 
                            borderRadius: '6px',
                            background: 'white'
                          }}
                        ></div>
                      </div>

                      {paymentSuccess && (
                        <div style={{ 
                          padding: '12px', 
                          background: '#f0fdf4', 
                          border: '1px solid #86efac', 
                          borderRadius: '6px',
                          color: '#166534',
                          fontSize: '14px',
                          marginBottom: '16px'
                        }}>
                          ✅ Payment authorized successfully! You can now save changes.
                        </div>
                      )}

                      {(hasAnyChanges() || priceDelta < 0) && (
                        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                          <Button
                            type="primary"
                            size="large"
                            icon={<FileTextOutlined />}
                            onClick={handleShowSummary}
                            style={{
                              background: '#059669',
                              borderColor: '#059669',
                              borderRadius: '8px',
                              fontWeight: 600,
                              fontSize: '16px',
                              height: '48px',
                              paddingLeft: '24px',
                              paddingRight: '24px'
                            }}
                          >
                            📋 Show Summary of Changes
                          </Button>
                        </div>
                      )}

                      {!paymentSuccess && (
                        <Button 
                          type="primary"
                          size="large"
                          loading={processingPayment}
                          onClick={processAdditionalPayment}
                          style={{ 
                            width: '100%', 
                            marginTop: '12px',
                            background: '#0891b2', 
                            borderColor: '#0891b2',
                            fontWeight: 600
                          }}
                        >
                          {processingPayment ? 'Processing Payment...' : `Authorize Payment $${priceDelta.toFixed(2)}`}
                        </Button>
                      )}
                    </div>
                  )}

                  {/* EFT Note - Show when bank_transfer selected */}
                  {priceDelta > 0 && booking.payment_method === 'bank_transfer' && (
                    <div style={{ 
                      marginBottom: '20px', 
                      padding: '16px', 
                      background: '#eff6ff', 
                      border: '2px solid #3b82f6', 
                      borderRadius: '8px' 
                    }}>
                      <Text style={{ color: '#1e40af', fontSize: '14px' }}>
                        ℹ️ Bank transfer selected. Manually update Payment Status to "Payment Received" after confirming payment.
                      </Text>
                    </div>
                  )}

                  {/* Show Summary Button for non-payment changes */}
                  {priceDelta === 0 && hasAnyChanges() && (
                    <div style={{ 
                      marginBottom: '20px', 
                      padding: '20px', 
                      background: '#f8fafc', 
                      border: '2px solid #059669', 
                      borderRadius: '8px',
                      textAlign: 'center'
                    }}>
                      <Text strong style={{ color: '#059669', marginBottom: '16px', display: 'block', fontSize: '16px' }}>
                        ✅ Changes Detected - No Payment Required
                      </Text>
                      <Button 
                        type="primary"
                        size="large"
                        icon={<FileTextOutlined />}
                        onClick={handleShowSummary}
                        style={{ 
                          background: '#059669', 
                          borderColor: '#059669', 
                          borderRadius: '8px', 
                          fontWeight: 600, 
                          fontSize: '16px',
                          height: '48px',
                          paddingLeft: '24px',
                          paddingRight: '24px'
                        }}
                      >
                        📋 Show Summary of Changes
                      </Button>
                    </div>
                  )}

                  <div style={{ marginBottom: '20px' }}>
                    <Text strong style={{ color: '#374151', marginBottom: '8px', display: 'block' }}>Payment Status</Text>
                    <Select 
                      value={booking.payment_status || 'pending'}
                      style={{ width: '100%' }}
                      size="large"
                      onChange={(value) => {
                        form.setFieldsValue({ payment_status: value });
                        setBooking(prev => prev ? { ...prev, payment_status: value } : null);
                      }}
                    >
                      <Option value="pending">Pending Payment</Option>
                      <Option value="paid">Payment Received</Option>
                      <Option value="partial">Partial Payment</Option>
                      <Option value="refunded">Refunded</Option>
                    </Select>
                  </div>

                  {/* Refund Prompt - Show when 'refunded' selected */}
                  {booking.payment_status === 'refunded' && (
                    <div style={{ 
                      marginBottom: '20px', 
                      padding: '16px', 
                      background: '#fef3c7', 
                      border: '2px solid #f59e0b', 
                      borderRadius: '8px' 
                    }}>
                      <Text strong style={{ color: '#92400e', fontSize: '14px', display: 'block', marginBottom: '8px' }}>
                        ⚠️ Refund Processing Required
                      </Text>
                      <Text style={{ color: '#78350f', fontSize: '13px' }}>
                        Please add the Stripe refund ID and refund details in the Payment Notes field below.
                      </Text>
                    </div>
                  )}

                  {/* Payment Notes - Show when payment_status is 'paid' or 'refunded' */}
                  {(booking.payment_status === 'paid' || booking.payment_status === 'refunded') && (
                    <div style={{ marginBottom: '20px' }}>
                      <Text strong style={{ color: '#374151', marginBottom: '8px', display: 'block' }}>
                        Payment Notes {booking.payment_status === 'refunded' && <span style={{ color: '#dc2626' }}>*</span>}
                      </Text>
                      <Input.TextArea 
                        value={booking.payment_notes || ''}
                        placeholder={booking.payment_status === 'refunded' 
                          ? "Enter Stripe refund ID and refund details..." 
                          : "Enter payment details..."}
                        rows={3}
                        style={{ padding: '12px 16px', border: '2px solid #e5e7eb', borderRadius: '8px' }}
                        onChange={(e) => {
                          form.setFieldsValue({ payment_notes: e.target.value });
                          setBooking(prev => prev ? { ...prev, payment_notes: e.target.value } : null);
                        }}
                      />
                    </div>
                  )}


                  {/* Therapist Fee Breakdown Section */}
                  <div style={{ 
                    marginBottom: '24px', 
                    padding: '20px', 
                    background: '#f8fafc', 
                    border: '1px solid #e2e8f0', 
                    borderRadius: '12px' 
                  }}>
                    <Title level={4} style={{ color: '#1e293b', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      💰 Therapist Fee Breakdown
                    </Title>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                      <div>
                        <Text style={{ color: '#64748b', fontSize: '14px' }}>Base Rate</Text>
                        <Text strong style={{ color: '#1e293b', fontSize: '16px' }}>
                          ${therapistFeeBreakdown.baseRate.toFixed(2)}
                        </Text>
                      </div>
                      <div>
                        <Text style={{ color: '#64748b', fontSize: '14px' }}>Duration</Text>
                        <Text strong style={{ color: '#1e293b', fontSize: '16px' }}>
                          {therapistFeeBreakdown.durationMultiplier}x
                        </Text>
                      </div>
                    </div>

                    {therapistFeeBreakdown.afterHoursUplift > 0 && (
                      <div style={{ marginBottom: '8px' }}>
                        <Text style={{ color: '#64748b', fontSize: '14px' }}>After-hours Uplift</Text>
                        <Text strong style={{ color: '#dc2626', fontSize: '16px' }}>
                          +${therapistFeeBreakdown.afterHoursUplift.toFixed(2)}
                        </Text>
                      </div>
                    )}

                    {therapistFeeBreakdown.weekendUplift > 0 && (
                      <div style={{ marginBottom: '8px' }}>
                        <Text style={{ color: '#64748b', fontSize: '14px' }}>Weekend Uplift</Text>
                        <Text strong style={{ color: '#dc2626', fontSize: '16px' }}>
                          +${therapistFeeBreakdown.weekendUplift.toFixed(2)}
                        </Text>
                      </div>
                    )}

                    <div style={{ 
                      paddingTop: '12px', 
                      borderTop: '2px solid #e2e8f0', 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center' 
                    }}>
                      <Text strong style={{ color: '#1e293b', fontSize: '18px' }}>Total Therapist Fee</Text>
                      <Text strong style={{ color: '#007e8c', fontSize: '20px' }}>
                        ${therapistFeeBreakdown.totalFee.toFixed(2)}
                      </Text>
                    </div>
                  </div>

                  {/* Business Summary Section */}
                  <div style={{ 
                    marginBottom: '24px', 
                    padding: '20px', 
                    background: '#f0f9ff', 
                    border: '1px solid #0ea5e9', 
                    borderRadius: '12px' 
                  }}>
                    <Title level={4} style={{ color: '#0c4a6e', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      📊 Business Summary
                    </Title>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '12px' }}>
                      <div>
                        <Text style={{ color: '#0369a1', fontSize: '14px' }}>Customer Payment</Text>
                        <Text strong style={{ color: '#0c4a6e', fontSize: '16px' }}>
                          ${businessSummary.customerPayment.toFixed(2)}
                        </Text>
                      </div>
                      <div>
                        <Text style={{ color: '#0369a1', fontSize: '14px' }}>Therapist Fee</Text>
                        <Text strong style={{ color: '#0c4a6e', fontSize: '16px' }}>
                          ${businessSummary.therapistFee.toFixed(2)}
                        </Text>
                      </div>
                    </div>

                    <div style={{ 
                      paddingTop: '12px', 
                      borderTop: '2px solid #0ea5e9', 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center' 
                    }}>
                      <Text strong style={{ color: '#0c4a6e', fontSize: '18px' }}>Net Profit</Text>
                      <Text strong style={{ 
                        color: businessSummary.netProfit >= 0 ? '#059669' : '#dc2626', 
                        fontSize: '20px' 
                      }}>
                        ${businessSummary.netProfit.toFixed(2)}
                      </Text>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '32px', paddingTop: '24px', borderTop: '1px solid #e5e7eb' }}>
                    <Button 
                      style={{ background: '#f3f4f6', color: '#374151', border: '2px solid #e5e7eb', borderRadius: '8px', fontWeight: 600, fontSize: '16px' }}
                      onClick={() => handleStepChange('therapist')}
                    >
                      ← Back
                    </Button>
                    <Button 
                      type="primary"
                      loading={saving}
                      disabled={
                        // Gate Save based on payment requirements
                        (priceDelta > 0 && booking.payment_method === 'card' && !paymentSuccess) ||
                        (priceDelta > 0 && !booking.payment_method) ||
                        (booking.payment_status === 'refunded' && !booking.payment_notes?.trim())
                      }
                      style={{ background: '#007e8c', borderColor: '#007e8c', borderRadius: '8px', fontWeight: 600, fontSize: '16px' }}
                      onClick={handleSave}
                    >
                      💾 Save All Changes
                    </Button>
                  </div>
                </div>
              )}

              {/* Placeholder for other steps */}
              {!['customer', 'address', 'service', 'gender', 'datetime', 'therapist', 'details', 'payment'].includes(activeStep) && (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <Text type="secondary">
                    {activeStep.charAt(0).toUpperCase() + activeStep.slice(1)} step will be implemented next
                  </Text>
                  <br />
                  <Text type="secondary">
                    Current step: {activeStep}
                  </Text>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Admin Sidebar (Placeholder for now) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <Card 
              title="⚡ Quick Actions" 
              style={{ borderRadius: '12px' }}
              bodyStyle={{ padding: '20px' }}
            >
              <div style={{ display: 'grid', gap: '12px' }}>
                <Button block style={{ textAlign: 'left' }}>
                  📅 Reschedule
                </Button>
                <Button block style={{ textAlign: 'left' }}>
                  💳 Mark as Paid
                </Button>
                <Button block style={{ textAlign: 'left' }}>
                  ✅ Confirm Booking
                </Button>
                <Button block style={{ textAlign: 'left' }}>
                  ❌ Cancel Booking
                </Button>
                <Button block style={{ textAlign: 'left' }}>
                  👨‍⚕️ Reassign Therapist
                </Button>
                <Button block style={{ textAlign: 'left' }}>
                  📧 Send Notification
                </Button>
                <Button block style={{ textAlign: 'left' }}>
                  🧾 Generate Invoice
                </Button>
                <Button block style={{ textAlign: 'left' }}>
                  💰 Apply Discount
                </Button>
              </div>
            </Card>

            <Card 
              title="📊 Status Management" 
              style={{ borderRadius: '12px' }}
              bodyStyle={{ padding: '20px' }}
            >
              <div style={{ display: 'grid', gap: '8px' }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px', 
                  padding: '12px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}>
                  <div style={{ 
                    width: '12px', 
                    height: '12px', 
                    borderRadius: '50%', 
                    background: booking.status === 'requested' ? '#f59e0b' : '#e5e7eb' 
                  }} />
                  <span>Requested</span>
                </div>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px', 
                  padding: '12px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}>
                  <div style={{ 
                    width: '12px', 
                    height: '12px', 
                    borderRadius: '50%', 
                    background: booking.status === 'confirmed' ? '#10b981' : '#e5e7eb' 
                  }} />
                  <span>Confirmed</span>
                </div>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px', 
                  padding: '12px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}>
                  <div style={{ 
                    width: '12px', 
                    height: '12px', 
                    borderRadius: '50%', 
                    background: booking.status === 'completed' ? '#3b82f6' : '#e5e7eb' 
                  }} />
                  <span>Completed</span>
                </div>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px', 
                  padding: '12px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}>
                  <div style={{ 
                    width: '12px', 
                    height: '12px', 
                    borderRadius: '50%', 
                    background: booking.status === 'cancelled' ? '#ef4444' : '#e5e7eb' 
                  }} />
                  <span>Cancelled</span>
                </div>
              </div>
            </Card>

            <Card 
              title="📋 Booking Info" 
              style={{ borderRadius: '12px' }}
              bodyStyle={{ padding: '20px' }}
            >
              <div style={{ fontSize: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <span style={{ fontWeight: '500', color: '#6b7280' }}>Booking ID:</span>
                  <span style={{ color: '#1f2937' }}>{booking.booking_id || booking.id}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <span style={{ fontWeight: '500', color: '#6b7280' }}>Customer:</span>
                  <span style={{ color: '#1f2937' }}>{booking.customer_name || 'Unknown'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <span style={{ fontWeight: '500', color: '#6b7280' }}>Therapist:</span>
                  <span style={{ color: '#1f2937' }}>{booking.therapist_name || 'Unassigned'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <span style={{ fontWeight: '500', color: '#6b7280' }}>Date:</span>
                  <span style={{ color: '#1f2937' }}>{dayjs(booking.booking_time).format('MMM DD, YYYY')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <span style={{ fontWeight: '500', color: '#6b7280' }}>Time:</span>
                  <span style={{ color: '#1f2937' }}>{dayjs(booking.booking_time).format('h:mm A')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <span style={{ fontWeight: '500', color: '#6b7280' }}>Duration:</span>
                  <span style={{ color: '#1f2937' }}>{booking.duration_minutes || 60} minutes</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                  <span style={{ fontWeight: '500', color: '#6b7280' }}>Created:</span>
                  <span style={{ color: '#1f2937' }}>{dayjs(booking.created_at).format('MMM DD, YYYY')}</span>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Summary Modal */}
        <Modal
          title={
            <div style={{
              textAlign: 'center',
              padding: '16px 0 8px 0',
              borderBottom: '2px solid #7234FE'
            }}>
              <h2 style={{
                margin: '0',
                fontSize: '24px',
                fontWeight: '700',
                color: '#7234FE',
                letterSpacing: '0.5px'
              }}>
                BOOKING SUMMARY CHANGES
              </h2>
              <p style={{
                margin: '8px 0 0 0',
                fontSize: '14px',
                color: '#7234FE',
                fontWeight: '400'
              }}>
                Review these booking detail changes before confirming
              </p>
            </div>
          }
          open={showSummaryModal}
          onCancel={() => setShowSummaryModal(false)}
          width={700}
          footer={null}
          style={{ top: 40 }}
          bodyStyle={{ padding: '24px' }}
        >
          {summaryChanges.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
              <Text>No changes detected</Text>
            </div>
          ) : (
            <div style={{
              background: '#ffffff',
              padding: '24px',
              borderRadius: '12px',
              border: '3px solid #007e8c',
              marginBottom: '24px'
            }}>
              <h3 style={{
                margin: '0 0 20px 0',
                color: '#1f2937',
                fontSize: '20px',
                fontWeight: '600'
              }}>
                Booking Details
              </h3>

              <div style={{ marginBottom: '16px' }}>
                <p style={{ margin: '4px 0', fontSize: '15px', color: '#374151' }}>
                  <strong>Booking ID:</strong> {booking.booking_id || 'N/A'}
                </p>
                <p style={{ margin: '4px 0', fontSize: '15px', color: '#374151' }}>
                  <strong>Address:</strong> {booking.address}
                </p>
                <p style={{ margin: '4px 0', fontSize: '15px', color: '#374151' }}>
                  <strong>Service:</strong> {booking.service_name}
                </p>
              </div>

              {summaryChanges.map((change, index) => (
                <div key={index} style={{
                  marginBottom: '12px',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  backgroundColor: '#f1eafe',
                  border: '2px solid #7234fe'
                }}>
                  <p style={{
                    margin: '0',
                    fontSize: '15px',
                    lineHeight: '1.6'
                  }}>
                    <strong style={{ color: '#7234fe' }}>* {change.fieldLabel}:</strong>{' '}
                    <span style={{ color: '#374151' }}>{change.newValue}</span>
                    {change.originalValue && (
                      <span style={{ color: '#6b7280', fontSize: '14px' }}>
                        {' '}– was {change.originalValue}
                      </span>
                    )}
                  </p>
                </div>
              ))}

              {/* Pricing section - only show purple box if price changed */}
              {originalBooking && originalBooking.price !== businessSummary.customerPayment ? (
                <div style={{
                  marginTop: '20px',
                  padding: '16px',
                  backgroundColor: '#f1eafe',
                  border: '2px solid #7234fe',
                  borderRadius: '8px'
                }}>
                  {estimatedPricing && estimatedPricing.basePrice ? (
                    <>
                      <p style={{ margin: '4px 0', fontSize: '15px', color: '#374151' }}>
                        <strong>Hourly Rate:</strong> ${estimatedPricing.basePrice.toFixed(2)}
                      </p>
                      {estimatedPricing.durationUplift > 0 && (
                        <p style={{ margin: '4px 0', fontSize: '15px', color: '#374151' }}>
                          <strong>Time Uplift ({estimatedPricing.durationUplift}%)</strong>
                          <span style={{ marginLeft: '12px' }}>: ${(estimatedPricing.basePrice * (estimatedPricing.durationUplift / 100)).toFixed(2)}</span>
                        </p>
                      )}
                      {estimatedPricing.timeUplift > 0 && (
                        <p style={{ margin: '4px 0', fontSize: '15px', color: '#374151' }}>
                          <strong>Weekend/Afterhours Uplift ({estimatedPricing.timeUplift}%)</strong>
                          <span style={{ marginLeft: '12px' }}>: ${(estimatedPricing.basePrice * (estimatedPricing.timeUplift / 100)).toFixed(2)}</span>
                        </p>
                      )}
                      {estimatedPricing.netPrice !== undefined && (
                        <p style={{ margin: '4px 0', fontSize: '15px', color: '#374151', fontWeight: 600 }}>
                          <strong>Net Price:</strong> ${estimatedPricing.netPrice.toFixed(2)}
                        </p>
                      )}
                      {estimatedPricing.gstAmount !== undefined && (
                        <p style={{ margin: '4px 0', fontSize: '15px', color: '#374151' }}>
                          <strong>GST (10%)</strong>
                          <span style={{ marginLeft: '12px' }}>: ${estimatedPricing.gstAmount.toFixed(2)}</span>
                        </p>
                      )}
                      <p style={{ margin: '4px 0', fontSize: '14px', color: '#6b7280', fontStyle: 'italic' }}>
                        was ${originalBooking.price?.toFixed(2)}
                      </p>
                    </>
                  ) : (
                    <p style={{ margin: '4px 0', fontSize: '15px', color: '#374151' }}>
                      <strong>Your Service Fees:</strong> ${businessSummary.customerPayment?.toFixed(2) || '0.00'}
                      <span style={{ color: '#6b7280', fontSize: '14px' }}> was ${originalBooking.price?.toFixed(2)}</span>
                    </p>
                  )}
                </div>
              ) : (
                <div style={{
                  marginTop: '16px',
                  padding: '12px',
                  backgroundColor: '#ffffff',
                  border: 'none'
                }}>
                  <p style={{ margin: '4px 0', fontSize: '14px', color: '#6b7280' }}>
                    <strong>Price:</strong> ${businessSummary.customerPayment?.toFixed(2) || originalBooking?.price?.toFixed(2) || '0.00'}
                  </p>
                </div>
              )}

              <div style={{
                marginTop: '16px',
                padding: '12px',
                backgroundColor: '#ffffff',
                border: 'none'
              }}>
                <p style={{ margin: '4px 0', fontSize: '14px', color: '#6b7280' }}>
                  <strong>Therapist Gender Preference:</strong> {booking.gender_preference || 'any'}
                </p>
                <p style={{ margin: '4px 0', fontSize: '14px', color: '#6b7280' }}>
                  <strong>Date & Time:</strong> {dayjs(booking.booking_time).format('YYYY-MM-DD [at] HH:mm')}
                </p>
                <p style={{ margin: '4px 0', fontSize: '14px', color: '#6b7280' }}>
                  <strong>Parking:</strong> {booking.parking || 'N/A'}
                </p>
                <p style={{ margin: '4px 0', fontSize: '14px', color: '#6b7280' }}>
                  <strong>Room Number:</strong> {booking.room_number || 'N/A'}
                </p>
                <p style={{ margin: '4px 0', fontSize: '14px', color: '#6b7280' }}>
                  <strong>Therapist:</strong> {booking.therapist_name || 'Unassigned'}
                </p>
                <p style={{ margin: '4px 0', fontSize: '14px', color: '#6b7280' }}>
                  <strong>Name:</strong> {booking.first_name} {booking.last_name}
                </p>
                <p style={{ margin: '4px 0', fontSize: '14px', color: '#6b7280' }}>
                  <strong>Email:</strong> {booking.customer_email}
                </p>
                <p style={{ margin: '4px 0', fontSize: '14px', color: '#6b7280' }}>
                  <strong>Phone:</strong> {booking.customer_phone}
                </p>
                {booking.room_number && (
                  <p style={{ margin: '4px 0', fontSize: '14px', color: '#6b7280' }}>
                    <strong>Room Number:</strong> {booking.room_number}
                  </p>
                )}
                {booking.booker_name && (
                  <p style={{ margin: '4px 0', fontSize: '14px', color: '#6b7280' }}>
                    <strong>Booker Name:</strong> {booking.booker_name}
                  </p>
                )}
                {booking.notes && (
                  <p style={{ margin: '4px 0', fontSize: '14px', color: '#6b7280' }}>
                    <strong>Notes:</strong> {booking.notes}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '16px'
          }}>
            <Button
              size="large"
              onClick={() => setShowSummaryModal(false)}
              style={{
                flex: '1',
                background: '#fee2e2',
                color: '#991b1b',
                border: '3px solid #dc2626',
                borderRadius: '12px',
                fontWeight: '700',
                fontSize: '16px',
                height: '56px'
              }}
            >
              Cancel Changes
            </Button>

            <Button
              type="primary"
              size="large"
              loading={proceedingWithChanges}
              onClick={handleProceedWithChanges}
              style={{
                flex: '1',
                background: '#f9f5ff',
                color: '#7234FE',
                border: '3px solid #7234FE',
                borderRadius: '12px',
                fontWeight: '700',
                fontSize: '16px',
                height: '56px'
              }}
            >
              {proceedingWithChanges ? 'Processing...' : 'Confirm Changes and Save'}
            </Button>
          </div>
        </Modal>

        {/* Hidden Form for Data Management */}
        <Form form={form} layout="vertical" style={{ display: 'none' }}>
          {/* This form will be populated with existing data and used for updates */}
        </Form>
      </div>
    </RoleGuard>
  );
};
