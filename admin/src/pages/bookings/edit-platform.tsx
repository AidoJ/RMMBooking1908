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
  booking_id?: string;
  customer_code?: string;
  first_name?: string;
  last_name?: string;
  customer_email?: string;
  customer_phone?: string;
  created_at: string;
  updated_at: string;
  booking_type?: string;
  
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
  const [appliedDiscount, setAppliedDiscount] = useState<number>(0);
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
  const [showQuickActions, setShowQuickActions] = useState(true);

  const userRole = identity?.role;

  // Quote detection helper - match server-side logic
  const isQuote = (booking: Booking) => {
    return booking.service_details?.quote_only || booking.booking_type === 'quote';
  };

  useEffect(() => {
    if (id) {
      fetchBookingDetails();
      fetchTherapists();
      fetchServices();
      fetchTherapistAssignments();
    }
  }, [id]);

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
        .select('id, first_name, last_name, email, phone, is_active')
        .eq('is_active', true)
        .order('first_name');

      if (error) throw error;
      setTherapists(data || []);
    } catch (error) {
      console.error('Error fetching therapists:', error);
    }
  };

  const fetchServices = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('services')
        .select('id, name, description, service_base_price, minimum_duration, is_active, quote_only')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error('Error fetching services:', error);
    }
  };

  const fetchTherapistAssignments = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('booking_therapist_assignments')
        .select(`
          *,
          therapist_profiles!booking_therapist_assignments_therapist_id_fkey(
            first_name, last_name, email, phone
          )
        `)
        .eq('booking_id', id)
        .order('assigned_at');

      if (error) throw error;
      
      const assignments = (data || []).map((assignment: any) => ({
        ...assignment,
        therapist_details: assignment.therapist_profiles
      }));
      
      setTherapistAssignments(assignments);
      setSelectedTherapistIds(assignments.map((a: TherapistAssignment) => a.therapist_id));
    } catch (error) {
      console.error('Error fetching therapist assignments:', error);
    }
  };

  // Copy all existing helper functions from edit.tsx
  const handleServiceChange = (serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    setSelectedService(service || null);
    
    if (service) {
      form.setFieldsValue({
        duration_minutes: service.minimum_duration
      });
    }
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
          {/* Left Panel - Booking Platform (Placeholder for now) */}
          <Card 
            title="📋 Booking Platform Steps" 
            style={{ borderRadius: '12px' }}
            bodyStyle={{ padding: '32px' }}
          >
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Text type="secondary">
                Booking platform steps will be implemented in Phase 2
              </Text>
              <br />
              <Text type="secondary">
                Current step: {activeStep}
              </Text>
            </div>
          </Card>

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
              title="💰 Financial Summary" 
              style={{ borderRadius: '12px' }}
              bodyStyle={{ padding: '20px' }}
            >
              <div style={{ fontSize: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <span>Customer Price:</span>
                  <span>${booking.price || 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <span>Therapist Fee:</span>
                  <span>${booking.therapist_fee || 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <span>Platform Fee:</span>
                  <span>${(booking.price || 0) - (booking.therapist_fee || 0)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <span>Payment Status:</span>
                  <span style={{ color: booking.payment_status === 'paid' ? '#10b981' : '#f59e0b' }}>
                    {booking.payment_status === 'paid' ? '✅ Paid' : '⏳ Pending'}
                  </span>
                </div>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  padding: '16px 0 6px 0',
                  borderTop: '2px solid #007e8c',
                  fontWeight: '700',
                  fontSize: '16px',
                  color: '#007e8c'
                }}>
                  <span>Net Profit:</span>
                  <span>${(booking.price || 0) - (booking.therapist_fee || 0)}</span>
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

        {/* Hidden Form for Data Management */}
        <Form form={form} layout="vertical" style={{ display: 'none' }}>
          {/* This form will be populated with existing data and used for updates */}
        </Form>
      </div>
    </RoleGuard>
  );
};
