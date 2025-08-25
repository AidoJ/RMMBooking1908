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
} from '@ant-design/icons';
import { useGetIdentity, useNavigation } from '@refinedev/core';
import { useParams } from 'react-router';
import { supabaseClient } from '../../utility';
import { UserIdentity, canAccess, isTherapist, isAdmin } from '../../utils/roleUtils';
import { RoleGuard } from '../../components/RoleGuard';
import { calculateTherapistFee, FeeCalculationResult } from '../../services/feeCalculation';
import dayjs, { Dayjs } from 'dayjs';
import { EmailService, BookingData, TherapistData } from '../../utils/emailService';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

// Interfaces
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
  number_of_massages?: number;
  preferred_therapists?: number;
  corporate_contact_name?: string;
  corporate_contact_email?: string;
  corporate_contact_phone?: string;
  po_number?: string;
  urgency?: string;
  setup_requirements?: string;
  special_requirements?: string;
  duration_per_massage?: number;
  payment_method?: string;
  preferred_time_range?: string;
  
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
  address?: string;
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
  is_active: boolean;
  quote_only?: boolean;
}

export const BookingEdit: React.FC = () => {
  const { data: identity } = useGetIdentity<UserIdentity>();
  const { list, show } = useNavigation();
  const { id } = useParams();
  const [form] = Form.useForm();
  
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
  const [notificationOptions, setNotificationOptions] = useState({
    notifyCustomer: true,
    notifyTherapist: true,
    sendEmail: true,
    sendSMS: false
  });
  const [customDuration, setCustomDuration] = useState(false);

  const userRole = identity?.role;

  // Quote detection helper
  const isQuote = (booking: Booking) => {
    return booking.service_details?.quote_only || booking.booking_type === 'quote';
  };

  useEffect(() => {
    if (id) {
      initializeData();
    }
  }, [id]);

  const initializeData = async () => {
    try {
      await Promise.all([
        fetchBookingDetails(),
        fetchTherapists(),
        fetchServices(),
        fetchTherapistAssignments(),
      ]);
    } catch (error) {
      console.error('Error initializing data:', error);
      message.error('Failed to load booking data');
    }
  };

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
          : 'Unassigned',
        service_name: bookingData.services?.name || 'Unknown Service',
        customer_details: bookingData.customers || null,
        therapist_details: bookingData.therapist_profiles || null,
        service_details: bookingData.services || null,
      };

      setBooking(transformedBooking);
      setSelectedService(bookingData.services);
      
      // Store original data for change detection
      setOriginalBookingData({
        customer_first_name: bookingData.customers?.first_name || '',
        customer_last_name: bookingData.customers?.last_name || '',
        customer_email: bookingData.customers?.email || '',
        customer_phone: bookingData.customers?.phone || '',
        therapist_id: bookingData.therapist_id,
        service_id: bookingData.service_id,
        booking_time: dayjs(bookingData.booking_time).format('YYYY-MM-DD HH:mm:ss'),
        address: bookingData.address,
        business_name: bookingData.business_name,
        duration_minutes: bookingData.duration_minutes,
        room_number: bookingData.room_number,
        notes: bookingData.notes,
        
        // Quote-specific fields for change detection
        event_type: bookingData.event_type,
        expected_attendees: bookingData.expected_attendees,
        number_of_massages: bookingData.number_of_massages,
        preferred_therapists: bookingData.preferred_therapists,
        corporate_contact_name: bookingData.corporate_contact_name,
        corporate_contact_email: bookingData.corporate_contact_email,
        corporate_contact_phone: bookingData.corporate_contact_phone,
        po_number: bookingData.po_number,
        urgency: bookingData.urgency,
        setup_requirements: bookingData.setup_requirements,
        special_requirements: bookingData.special_requirements,
        duration_per_massage: bookingData.duration_per_massage,
        payment_method: bookingData.payment_method,
        preferred_time_range: bookingData.preferred_time_range,
      });

      // Set form values
      form.setFieldsValue({
        customer_first_name: bookingData.customers?.first_name || '',
        customer_last_name: bookingData.customers?.last_name || '', 
        customer_email: bookingData.customers?.email || '',
        customer_phone: bookingData.customers?.phone || '',
        therapist_id: bookingData.therapist_id,
        service_id: bookingData.service_id,
        booking_time: dayjs(bookingData.booking_time),
        status: bookingData.status,
        payment_status: bookingData.payment_status,
        price: bookingData.price,
        therapist_fee: bookingData.therapist_fee,
        address: bookingData.address,
        business_name: bookingData.business_name,
        notes: bookingData.notes,
        duration_minutes: bookingData.duration_minutes || bookingData.services?.minimum_duration || 60,
        gender_preference: bookingData.gender_preference,
        parking: bookingData.parking,
        room_number: bookingData.room_number,
        
        // Quote-specific fields
        event_type: bookingData.event_type,
        expected_attendees: bookingData.expected_attendees,
        number_of_massages: bookingData.number_of_massages,
        preferred_therapists: bookingData.preferred_therapists,
        corporate_contact_name: bookingData.corporate_contact_name,
        corporate_contact_email: bookingData.corporate_contact_email,
        corporate_contact_phone: bookingData.corporate_contact_phone,
        po_number: bookingData.po_number,
        urgency: bookingData.urgency,
        setup_requirements: bookingData.setup_requirements,
        special_requirements: bookingData.special_requirements,
        duration_per_massage: bookingData.duration_per_massage,
        payment_method: bookingData.payment_method,
        preferred_time_range: bookingData.preferred_time_range,
      });
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

  const handleServiceChange = (serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    setSelectedService(service || null);
    
    if (service) {
      form.setFieldsValue({
        price: service.service_base_price,
        duration_minutes: service.minimum_duration,
      });
    }
  };

  // Handle therapist assignments
  const handleTherapistAssignmentChange = async (therapistIds: string[]) => {
    if (!booking) return;
    
    setSelectedTherapistIds(therapistIds);
    
    // Find added and removed therapists
    const currentIds = therapistAssignments.map(a => a.therapist_id);
    const toAdd = therapistIds.filter(id => !currentIds.includes(id));
    const toRemove = currentIds.filter(id => !therapistIds.includes(id));
    
    try {
      // Add new assignments
      if (toAdd.length > 0) {
        const newAssignments = toAdd.map(therapistId => ({
          booking_id: booking.id,
          therapist_id: therapistId,
          status: 'assigned' as const,
          assigned_at: new Date().toISOString()
        }));
        
        const { error: addError } = await supabaseClient
          .from('booking_therapist_assignments')
          .insert(newAssignments);
          
        if (addError) throw addError;
      }
      
      // Remove assignments
      if (toRemove.length > 0) {
        const { error: removeError } = await supabaseClient
          .from('booking_therapist_assignments')
          .delete()
          .eq('booking_id', booking.id)
          .in('therapist_id', toRemove);
          
        if (removeError) throw removeError;
      }
      
      // Refresh assignments and recalculate fees
      await fetchTherapistAssignments();
      await recalculateTherapistFees();
      
      if (toAdd.length > 0 || toRemove.length > 0) {
        message.success('Therapist assignments updated successfully');
      }
      
    } catch (error) {
      console.error('Error updating therapist assignments:', error);
      message.error('Failed to update therapist assignments');
      // Revert the UI change
      setSelectedTherapistIds(currentIds);
    }
  };

  // Calculate and update therapist fees
  const recalculateTherapistFees = async () => {
    if (!booking || therapistAssignments.length === 0) return;
    
    try {
      const bookingDate = dayjs(booking.booking_time).format('YYYY-MM-DD');
      const bookingTime = dayjs(booking.booking_time).format('HH:mm');
      const therapistCount = therapistAssignments.length;
      
      // For quotes: total duration = attendees × duration_per_massage
      // For regular bookings: use duration_minutes
      let totalDuration;
      if (isQuote(booking)) {
        const attendees = booking.expected_attendees || booking.number_of_massages || 1;
        const durationPerMassage = booking.duration_per_massage || booking.duration_minutes || 30;
        totalDuration = attendees * durationPerMassage;
        console.log(`Quote fee calculation: ${attendees} attendees × ${durationPerMassage} min/massage = ${totalDuration} total minutes`);
      } else {
        totalDuration = booking.duration_minutes || 60;
        console.log(`Regular booking duration: ${totalDuration} minutes`);
      }
      
      console.log(`Fee calculation inputs: date=${bookingDate}, time=${bookingTime}, totalDuration=${totalDuration}, therapistCount=${therapistCount}`);
      
      // Calculate fee for one therapist (total work divided by therapist count)
      const feeCalculation = await calculateTherapistFee(
        bookingDate,
        bookingTime,
        totalDuration,
        therapistCount
      );
      
      console.log('Fee calculation result:', feeCalculation);
      
      // Update all assignments with the calculated fees
      const updates = therapistAssignments.map(assignment => ({
        id: assignment.id,
        therapist_fee: feeCalculation.therapistFee,
        hourly_rate: feeCalculation.hourlyRate,
        hours_worked: feeCalculation.hoursWorked,
        rate_type: feeCalculation.rateType
      }));
      
      for (const update of updates) {
        const { error } = await supabaseClient
          .from('booking_therapist_assignments')
          .update({
            therapist_fee: update.therapist_fee,
            hourly_rate: update.hourly_rate,
            hours_worked: update.hours_worked,
            rate_type: update.rate_type
          })
          .eq('id', update.id);
          
        if (error) throw error;
      }
      
      // Refresh the assignments to show updated fees
      await fetchTherapistAssignments();
      
    } catch (error) {
      console.error('Error calculating therapist fees:', error);
      message.warning('Fee calculation failed - please check system settings');
    }
  };

  // Update assignment status
  const updateAssignmentStatus = async (assignmentId: string, newStatus: string) => {
    try {
      const { error } = await supabaseClient
        .from('booking_therapist_assignments')
        .update({ 
          status: newStatus,
          confirmed_at: newStatus === 'confirmed' ? new Date().toISOString() : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', assignmentId);

      if (error) throw error;

      message.success(`Assignment status updated to ${newStatus}`);
      await fetchTherapistAssignments();
    } catch (error) {
      console.error('Error updating assignment status:', error);
      message.error('Failed to update assignment status');
    }
  };

  // Detect what changed and create human-readable change descriptions
  const detectChanges = (originalData: any, newValues: any): string[] => {
    const changes: string[] = [];
    
    // Customer info changes
    if (originalData.customer_first_name !== newValues.customer_first_name || 
        originalData.customer_last_name !== newValues.customer_last_name) {
      changes.push('Customer name updated');
    }
    if (originalData.customer_email !== newValues.customer_email) {
      changes.push('Customer email updated');
    }
    if (originalData.customer_phone !== newValues.customer_phone) {
      changes.push('Customer phone updated');
    }
    
    // Therapist change
    if (originalData.therapist_id !== newValues.therapist_id) {
      const oldTherapist = therapists.find(t => t.id === originalData.therapist_id);
      const newTherapist = therapists.find(t => t.id === newValues.therapist_id);
      changes.push(`Therapist changed from ${oldTherapist?.first_name} ${oldTherapist?.last_name} → ${newTherapist?.first_name} ${newTherapist?.last_name}`);
    }
    
    // Service change
    if (originalData.service_id !== newValues.service_id) {
      changes.push('Service updated');
    }
    
    // Date/Time change
    const newBookingTime = newValues.booking_time.format('YYYY-MM-DD HH:mm:ss');
    if (originalData.booking_time !== newBookingTime) {
      changes.push('Date/time updated');
    }
    
    // Delivery address change
    if (originalData.address !== newValues.address) {
      changes.push('Delivery address updated');
    }
    
    // Duration change
    if (originalData.duration_minutes !== newValues.duration_minutes) {
      changes.push('Duration updated');
    }
    
    // Room number change
    if (originalData.room_number !== newValues.room_number) {
      changes.push('Room number updated');
    }
    
    // Business name change
    if (originalData.business_name !== newValues.business_name) {
      changes.push('Hotel/business name updated');
    }
    
    return changes;
  };

  const handleSubmit = async (values: any) => {
    if (!booking) return;

    setSaving(true);
    try {
      // First update customer information
      if (booking.customer_details) {
        const { error: customerError } = await supabaseClient
          .from('customers')
          .update({
            first_name: values.customer_first_name,
            last_name: values.customer_last_name,
            email: values.customer_email,
            phone: values.customer_phone,
          })
          .eq('id', booking.customer_id);

        if (customerError) throw customerError;
      }

      const updateData: any = {
        therapist_id: values.therapist_id,
        service_id: values.service_id,
        booking_time: values.booking_time.format('YYYY-MM-DD HH:mm:ss'),
        address: values.address,
        business_name: values.business_name,
        notes: values.notes,
        duration_minutes: values.duration_minutes,
        gender_preference: values.gender_preference,
        parking: values.parking,
        room_number: values.room_number,
        updated_at: new Date().toISOString(),
        
        // Quote-specific fields
        event_type: values.event_type,
        expected_attendees: values.expected_attendees,
        number_of_massages: values.number_of_massages,
        preferred_therapists: values.preferred_therapists,
        corporate_contact_name: values.corporate_contact_name,
        corporate_contact_email: values.corporate_contact_email,
        corporate_contact_phone: values.corporate_contact_phone,
        po_number: values.po_number,
        urgency: values.urgency,
        setup_requirements: values.setup_requirements,
        special_requirements: values.special_requirements,
        duration_per_massage: values.duration_per_massage,
        payment_method: values.payment_method,
        preferred_time_range: values.preferred_time_range,
      };

      // Only super admins can update pricing
      if (userRole === 'super_admin') {
        updateData.price = values.price;
        updateData.therapist_fee = values.therapist_fee;
      }

      const { error } = await supabaseClient
        .from('bookings')
        .update(updateData)
        .eq('id', booking.id);

      if (error) throw error;

      // Recalculate therapist fees if date/time/duration changed
      if (therapistAssignments.length > 0) {
        const dateChanged = dayjs(booking.booking_time).format('YYYY-MM-DD') !== dayjs(values.booking_time).format('YYYY-MM-DD');
        const timeChanged = dayjs(booking.booking_time).format('HH:mm') !== values.booking_time.format('HH:mm');
        const durationChanged = booking.duration_minutes !== values.duration_minutes;
        
        if (dateChanged || timeChanged || durationChanged) {
          await recalculateTherapistFees();
        }
      }

      // Detect changes and show notification modal
      const changes = detectChanges(originalBookingData, values);
      
      if (changes.length > 0) {
        setDetectedChanges(changes);
        setShowNotificationModal(true);
        message.success('Booking updated successfully! Review notification options.');
      } else {
        message.success('Booking updated successfully');
        show('bookings', booking.id);
      }
    } catch (error) {
      console.error('Error updating booking:', error);
      message.error('Failed to update booking');
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      requested: 'orange',
      confirmed: 'blue',
      completed: 'green',
      cancelled: 'red',
      declined: 'red',
      timeout_reassigned: 'purple',
      seeking_alternate: 'orange',
    };
    return colors[status] || 'default';
  };

  const getPaymentStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      pending: 'orange',
      paid: 'green',
      refunded: 'red',
    };
    return colors[status] || 'default';
  };

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>Loading booking details...</div>
      </div>
    );
  }

  const handleSendNotifications = async () => {
    if (!booking || !originalBookingData) return;
    
    setSendingNotifications(true);
    try {
      const results: any[] = [];
      
      // Get the current form values (updated data) instead of old booking state
      const currentFormValues = form.getFieldsValue();
      const currentTherapist = therapists.find(t => t.id === currentFormValues.therapist_id);
      const currentService = services.find(s => s.id === currentFormValues.service_id);
      
      // Prepare booking data for email service using updated form values
      const emailBookingData: BookingData = {
        id: booking.id,
        booking_id: booking.booking_id,
        customer_name: `${currentFormValues.customer_first_name} ${currentFormValues.customer_last_name}`,
        customer_email: currentFormValues.customer_email,
        customer_phone: currentFormValues.customer_phone,
        therapist_name: currentTherapist ? `${currentTherapist.first_name} ${currentTherapist.last_name}` : booking.therapist_name,
        therapist_email: currentTherapist?.email || booking.therapist_details?.email,
        service_name: currentService?.name || booking.service_name,
        booking_time: currentFormValues.booking_time.format('YYYY-MM-DD HH:mm:ss'),
        address: currentFormValues.address,
        business_name: currentFormValues.business_name,
        duration_minutes: currentFormValues.duration_minutes,
        price: currentFormValues.price,
        therapist_fee: currentFormValues.therapist_fee,
        notes: currentFormValues.notes,
        room_number: currentFormValues.room_number
      };
      
      // Check if this is a therapist reassignment
      const isTherapistReassignment = detectedChanges.some(change => 
        change.includes('Therapist changed from')
      );
      
      if (isTherapistReassignment && notificationOptions.notifyTherapist) {
        // Handle therapist reassignment notifications
        const oldTherapist = therapists.find(t => t.id === originalBookingData.therapist_id);
        const newTherapist = therapists.find(t => t.id === form.getFieldValue('therapist_id'));
        
        if (oldTherapist && newTherapist) {
          // Notify old therapist
          const oldTherapistResult = await EmailService.sendReassignmentToOldTherapist(
            emailBookingData, 
            oldTherapist as TherapistData, 
            newTherapist as TherapistData
          );
          results.push({ type: 'Old Therapist', ...oldTherapistResult });
          
          // Notify new therapist
          const newTherapistResult = await EmailService.sendReassignmentToNewTherapist(
            emailBookingData, 
            newTherapist as TherapistData, 
            oldTherapist as TherapistData
          );
          results.push({ type: 'New Therapist', ...newTherapistResult });
        }
      } else {
        // Handle regular update notifications
        if (notificationOptions.notifyCustomer && notificationOptions.sendEmail) {
          const customerResult = await EmailService.sendBookingUpdateToCustomer(
            emailBookingData, 
            detectedChanges
          );
          results.push({ type: 'Customer', ...customerResult });
        }
        
        if (notificationOptions.notifyTherapist && notificationOptions.sendEmail) {
          const currentTherapist = therapists.find(t => t.id === form.getFieldValue('therapist_id'));
          if (currentTherapist) {
            const therapistResult = await EmailService.sendBookingUpdateToTherapist(
              emailBookingData, 
              currentTherapist as TherapistData, 
              detectedChanges
            );
            results.push({ type: 'Therapist', ...therapistResult });
          }
        }
      }
      
      // Display results
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;
      
      if (successCount > 0) {
        message.success(`Successfully sent ${successCount} notification${successCount > 1 ? 's' : ''}!`);
      }
      
      if (failureCount > 0) {
        message.error(`Failed to send ${failureCount} notification${failureCount > 1 ? 's' : ''}. Please try again.`);
        console.error('Notification failures:', results.filter(r => !r.success));
      }
      
      setShowNotificationModal(false);
      show('bookings', booking.id);
      
    } catch (error) {
      console.error('Error sending notifications:', error);
      message.error('Failed to send notifications. Please try again.');
    } finally {
      setSendingNotifications(false);
    }
  };

  if (!booking) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          message="Booking Not Found"
          description="The booking you're trying to edit doesn't exist or has been deleted."
          type="error"
          showIcon
        />
      </div>
    );
  }

  return (
    <RoleGuard requiredPermission="canEditAllBookings">
      <div style={{ padding: 24 }}>
        {/* Header */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col span={12}>
            <Space>
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={() => show('bookings', booking.id)}
              >
                Back to Booking
              </Button>
              <Space>
                <Title level={3} style={{ margin: 0 }}>
                  Edit {isQuote(booking) ? 'Quote Request' : 'Booking'} #{booking.booking_id || booking.id.slice(0, 8)}
                </Title>
                {isQuote(booking) && (
                  <Tag color="purple">QUOTE REQUEST</Tag>
                )}
              </Space>
            </Space>
          </Col>
          <Col span={12} style={{ textAlign: 'right' }}>
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={initializeData}
                loading={loading}
              >
                Refresh
              </Button>
            </Space>
          </Col>
        </Row>

        {/* Information Alert */}
        <Alert
          message="Safe Booking Edit"
          description="This form allows editing of booking details, scheduling, and service assignments. Status and payment changes should be made using action buttons in the booking details view."
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Row gutter={[16, 16]}>
          {/* Current Booking Info */}
          <Col span={8}>
            <Card title="Current Booking Info" style={{ marginBottom: 16 }}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Status">
                  <Tag color={getStatusColor(booking.status)}>
                    {booking.status.replace('_', ' ').toUpperCase()}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Payment">
                  <Tag color={getPaymentStatusColor(booking.payment_status)}>
                    {booking.payment_status.toUpperCase()}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Customer">
                  <Text strong>{booking.customer_name}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Therapist">
                  <Text strong>{booking.therapist_name}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Service">
                  <Text strong>{booking.service_name}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Date & Time">
                  <Text>{dayjs(booking.booking_time).format('MMM DD, YYYY HH:mm')}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Price">
                  <Text strong style={{ color: '#52c41a' }}>
                    ${booking.price ? booking.price.toFixed(2) : '0.00'}
                  </Text>
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>

          {/* Edit Form */}
          <Col span={16}>
            <Card title="Edit Booking Details">
              <Form
                form={form}
                layout="vertical"
                onFinish={handleSubmit}
                initialValues={{
                  status: 'requested',
                  payment_status: 'pending',
                }}
              >
                <Row gutter={[12, 8]}>
                  <Col span={8}>
                    {booking && isQuote(booking) ? (
                      <Form.Item label="Assigned Therapists" required>
                        <Select
                          mode="multiple"
                          placeholder="Select therapists for this event"
                          value={selectedTherapistIds}
                          onChange={handleTherapistAssignmentChange}
                          showSearch
                          optionFilterProp="children"
                          maxTagCount={2}
                          maxTagTextLength={15}
                        >
                          {therapists.map(therapist => (
                            <Option key={therapist.id} value={therapist.id}>
                              {therapist.first_name} {therapist.last_name}
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
                    ) : (
                      <Form.Item name="therapist_id" label="Therapist" rules={[{ required: true }]}>
                        <Select placeholder="Select therapist" showSearch optionFilterProp="children">
                          {therapists.map(therapist => (
                            <Option key={therapist.id} value={therapist.id}>
                              {therapist.first_name} {therapist.last_name}
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
                    )}
                  </Col>
                  <Col span={8}>
                    <Form.Item name="service_id" label="Service" rules={[{ required: true }]}>
                      <Select placeholder="Select service" onChange={handleServiceChange} showSearch>
                        {services.map(service => (
                          <Option key={service.id} value={service.id}>
                            {service.name} (${service.service_base_price})
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>

                  {/* Date and Time */}
                  <Col span={12}>
                    <Form.Item name="booking_time" label="Date & Time" rules={[{ required: true }]}>
                      <DatePicker
                        showTime={{ format: 'HH:mm' }}
                        format="YYYY-MM-DD HH:mm"
                        style={{ width: '100%' }}
                        placeholder="Select date and time"
                      />
                    </Form.Item>
                  </Col>
                  
                  {/* Duration - different field based on booking type */}
                  {booking && !isQuote(booking) ? (
                    <Col span={12}>
                      <Form.Item name="duration_minutes" label="Total Duration (minutes)" rules={[{ required: true }]}>
                        <InputNumber min={15} max={240} step={15} style={{ width: '100%' }} placeholder="Total duration" />
                      </Form.Item>
                    </Col>
                  ) : (
                    <Col span={12}>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        Duration calculated from: Number of massages × Duration per massage
                      </Text>
                    </Col>
                  )}

                  {/* Regular booking fields - only show for non-quotes */}
                  {!isQuote(booking) && (
                    <>
                      <Col span={12}>
                        <Form.Item name="address" label="Address" rules={[{ required: true }]}>
                          <Input placeholder="Delivery address" />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item name="business_name" label="Business Name">
                          <Input placeholder="Hotel or business name" />
                        </Form.Item>
                      </Col>
                    </>
                  )}

                  {/* Quote-specific fields - show only for quotes */}
                  {booking && isQuote(booking) && (
                    <>
                      {/* Contact Information Section */}
                      <Col span={24}>
                        <Card style={{ marginBottom: '16px' }}>
                          <Title level={4} style={{ marginBottom: '16px', color: '#1890ff' }}>
                            👤 Contact Information
                          </Title>
                          <Row gutter={[16, 8]}>
                            <Col span={12}>
                              <Form.Item name="corporate_contact_name" label="Contact Name" rules={[{ required: true }]}>
                                <Input placeholder="Full name" />
                              </Form.Item>
                            </Col>
                            <Col span={12}>
                              <Form.Item name="business_name" label="Company Name">
                                <Input placeholder="Company name" />
                              </Form.Item>
                            </Col>
                            <Col span={12}>
                              <Form.Item name="corporate_contact_email" label="Email Address" rules={[{ required: true, type: 'email' }]}>
                                <Input placeholder="email@company.com" />
                              </Form.Item>
                            </Col>
                            <Col span={12}>
                              <Form.Item name="corporate_contact_phone" label="Phone Number" rules={[{ required: true }]}>
                                <Input placeholder="Phone number" />
                              </Form.Item>
                            </Col>
                          </Row>
                        </Card>
                      </Col>

                      {/* Event Details Section */}
                      <Col span={24}>
                        <Card style={{ marginBottom: '16px' }}>
                          <Title level={4} style={{ marginBottom: '16px', color: '#1890ff' }}>
                            📅 Event Details
                          </Title>
                          <Row gutter={[16, 8]}>
                            <Col span={24}>
                              <Form.Item name="address" label="Event Address" rules={[{ required: true }]}>
                                <Input placeholder="Start typing the event address..." />
                              </Form.Item>
                            </Col>
                            <Col span={12}>
                              <Form.Item name="event_type" label="Event Type">
                                <Select placeholder="Select event type..." allowClear>
                                  <Option value="corporate_wellness">Corporate Wellness Day</Option>
                                  <Option value="team_building">Team Building Event</Option>
                                  <Option value="client_entertainment">Client Entertainment</Option>
                                  <Option value="conference">Conference/Trade Show</Option>
                                  <Option value="employee_appreciation">Employee Appreciation</Option>
                                  <Option value="other">Other</Option>
                                </Select>
                              </Form.Item>
                            </Col>
                            <Col span={12}>
                              <Form.Item name="expected_attendees" label="Expected Attendees">
                                <InputNumber min={1} max={500} placeholder="Number of people" style={{ width: '100%' }} />
                              </Form.Item>
                            </Col>
                            <Col span={12}>
                              <Form.Item name="booking_time" label="Preferred Date" rules={[{ required: true }]}>
                                <DatePicker
                                  format="YYYY-MM-DD"
                                  style={{ width: '100%' }}
                                  placeholder="Select preferred date"
                                />
                              </Form.Item>
                            </Col>
                            <Col span={12}>
                              <Form.Item name="preferred_time_range" label="Preferred Time Range" rules={[{ required: true }]}>
                                <Select placeholder="Select time range...">
                                  <Option value="morning">Morning (9:00 AM - 12:00 PM)</Option>
                                  <Option value="afternoon">Afternoon (12:00 PM - 5:00 PM)</Option>
                                  <Option value="evening">Evening (5:00 PM - 8:00 PM)</Option>
                                  <Option value="all_day">All Day Event</Option>
                                  <Option value="custom">Custom Time Range</Option>
                                </Select>
                              </Form.Item>
                            </Col>
                          </Row>
                        </Card>
                      </Col>

                      {/* Massage Requirements Section */}
                      <Col span={24}>
                        <Card style={{ marginBottom: '16px' }}>
                          <Title level={4} style={{ marginBottom: '16px', color: '#1890ff' }}>
                            💆‍♀️ Massage Requirements
                          </Title>
                          <Row gutter={[16, 8]}>
                            <Col span={8}>
                              <Form.Item name="number_of_massages" label="Number of Massages" rules={[{ required: true }]}>
                                <InputNumber min={1} max={50} placeholder="How many massages needed" style={{ width: '100%' }} />
                              </Form.Item>
                            </Col>
                            <Col span={8}>
                              <Form.Item name="duration_per_massage" label="Duration per Massage" rules={[{ required: true }]}>
                                <Select 
                                  placeholder="Select duration..."
                                  onChange={(value) => setCustomDuration(value === 'custom')}
                                >
                                  <Option value={30}>30 minutes</Option>
                                  <Option value={45}>45 minutes</Option>
                                  <Option value={60}>60 minutes</Option>
                                  <Option value={75}>75 minutes</Option>
                                  <Option value={90}>90 minutes</Option>
                                  <Option value="custom">Custom...</Option>
                                </Select>
                              </Form.Item>
                            </Col>
                            {customDuration && (
                              <Col span={8}>
                                <Form.Item name="duration_per_massage" label="Custom Duration (min)" rules={[{ required: true }]}>
                                  <InputNumber min={5} max={120} placeholder="Minutes" style={{ width: '100%' }} />
                                </Form.Item>
                              </Col>
                            )}
                            <Col span={8}>
                              <Form.Item name="preferred_therapists" label="Preferred Number of Therapists">
                                <Select placeholder="Let us recommend..." allowClear>
                                  <Option value={1}>1 Therapist</Option>
                                  <Option value={2}>2 Therapists</Option>
                                  <Option value={3}>3 Therapists</Option>
                                  <Option value={4}>4 Therapists</Option>
                                  <Option value={5}>5+ Therapists</Option>
                                </Select>
                              </Form.Item>
                            </Col>
                            <Col span={8}>
                              <Form.Item name="urgency" label="Timeline" rules={[{ required: true }]}>
                                <Select placeholder="Timeline">
                                  <Option value="flexible">Flexible timing</Option>
                                  <Option value="within_week">Within 1 week</Option>
                                  <Option value="within_3_days">Within 3 days</Option>
                                  <Option value="urgent_24h">Urgent (within 24 hours)</Option>
                                </Select>
                              </Form.Item>
                            </Col>
                            
                            {/* Show calculated total duration */}
                            <Col span={24}>
                              <Form.Item shouldUpdate>
                                {() => {
                                  const numMassages = form.getFieldValue('number_of_massages') || 0;
                                  const durationPerMassage = form.getFieldValue('duration_per_massage') || 0;
                                  const totalMinutes = numMassages * durationPerMassage;
                                  const hours = Math.floor(totalMinutes / 60);
                                  const minutes = totalMinutes % 60;
                                  
                                  return totalMinutes > 0 ? (
                                    <Alert
                                      message={`Total Event Duration: ${totalMinutes} minutes${hours > 0 ? ` (${hours}h ${minutes}m)` : ''}`}
                                      type="info"
                                      icon={<span>📊</span>}
                                      style={{ backgroundColor: '#e6f4ff' }}
                                    />
                                  ) : null;
                                }}
                              </Form.Item>
                            </Col>
                          </Row>
                        </Card>
                      </Col>

                      {/* Payment & Setup Section */}
                      <Col span={24}>
                        <Card style={{ marginBottom: '16px' }}>
                          <Title level={4} style={{ marginBottom: '16px', color: '#1890ff' }}>
                            💳 Payment & Setup
                          </Title>
                          <Row gutter={[16, 8]}>
                            <Col span={8}>
                              <Form.Item name="payment_method" label="Preferred Payment Method" rules={[{ required: true }]}>
                                <Select placeholder="Payment method">
                                  <Option value="credit_card">Credit Card</Option>
                                  <Option value="invoice">Invoice (Net 30)</Option>
                                  <Option value="bank_transfer">Bank Transfer/EFT</Option>
                                </Select>
                              </Form.Item>
                            </Col>
                            <Col span={8}>
                              <Form.Item name="po_number" label="PO Number (if applicable)">
                                <Input placeholder="Purchase order number" />
                              </Form.Item>
                            </Col>
                            <Col span={24}>
                              <Row gutter={[16, 8]}>
                                <Col span={12}>
                                  <Form.Item name="setup_requirements" label="Setup Requirements">
                                    <Input.TextArea rows={3} placeholder="e.g., Changing rooms needed, tables provided, music preferences, privacy requirements..." />
                                  </Form.Item>
                                </Col>
                                <Col span={12}>
                                  <Form.Item name="special_requirements" label="Special Requirements or Notes">
                                    <Input.TextArea rows={3} placeholder="Any special requests, accessibility needs, dietary restrictions for therapists, etc." />
                                  </Form.Item>
                                </Col>
                              </Row>
                            </Col>
                          </Row>
                        </Card>
                      </Col>

                      {/* Price Field - Prominent Display for Super Admins */}
                      {userRole === 'super_admin' && (
                        <Col span={24}>
                          <Card style={{ backgroundColor: '#f0f8ff', border: '2px solid #1890ff', marginBottom: '16px' }}>
                            <Title level={4} style={{ marginBottom: '16px', color: '#1890ff' }}>
                              💰 Pricing
                            </Title>
                            <Form.Item name="price" label={<span style={{ fontSize: '16px', fontWeight: 'bold', color: '#1890ff' }}>Total Price ($)</span>}>
                              <InputNumber 
                                min={0} 
                                step={0.01} 
                                style={{ width: '300px', fontSize: '18px', fontWeight: 'bold' }} 
                                placeholder="0.00"
                                size="large"
                              />
                            </Form.Item>
                          </Card>
                        </Col>
                      )}
                      
                      {/* Therapist Assignments & Fees */}
                      {therapistAssignments.length > 0 && (
                        <Col span={24}>
                          <Form.Item label="Therapist Assignments & Fees">
                            <div style={{ border: '1px solid #d9d9d9', borderRadius: '6px', padding: '12px' }}>
                              {/* Fee Summary Header */}
                              {booking && (
                                <div style={{ 
                                  backgroundColor: '#f8f9fa', 
                                  padding: '8px 12px', 
                                  borderRadius: '4px', 
                                  marginBottom: '12px',
                                  fontSize: '13px'
                                }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>📅 {dayjs(booking.booking_time).format('ddd, MMM D, YYYY')}</span>
                                    <span>🕒 {dayjs(booking.booking_time).format('HH:mm')}</span>
                                    <span>⏱️ {(() => {
                                      if (isQuote(booking)) {
                                        const attendees = booking.expected_attendees || booking.number_of_massages || 1;
                                        const durationPerMassage = booking.duration_per_massage || booking.duration_minutes || 30;
                                        return attendees * durationPerMassage;
                                      }
                                      return booking.duration_minutes || 0;
                                    })()} min</span>
                                  </div>
                                  <div style={{ marginTop: '4px', fontSize: '12px', color: '#666' }}>
                                    Rate: {therapistAssignments[0]?.rate_type === 'weekend' ? 'Weekend' : 
                                           therapistAssignments[0]?.rate_type === 'afterhours' ? 'After Hours' : 'Business Hours'} 
                                    ({therapistAssignments[0]?.hourly_rate ? `$${therapistAssignments[0].hourly_rate}/hour` : 'Calculating...'})
                                  </div>
                                </div>
                              )}
                              
                              {/* Individual Therapist Assignments */}
                              {therapistAssignments.map((assignment) => (
                                <div key={assignment.id} style={{ 
                                  border: '1px solid #e8e8e8',
                                  borderRadius: '6px',
                                  padding: '12px',
                                  marginBottom: '8px',
                                  backgroundColor: '#fafafa'
                                }}>
                                  <div style={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    alignItems: 'center',
                                    marginBottom: '8px'
                                  }}>
                                    <span>
                                      <strong>
                                        {assignment.therapist_details?.first_name} {assignment.therapist_details?.last_name}
                                      </strong>
                                    </span>
                                    <Space>
                                      <Tag color={
                                        assignment.status === 'confirmed' ? 'green' :
                                        assignment.status === 'assigned' ? 'blue' :
                                        assignment.status === 'declined' ? 'red' :
                                        assignment.status === 'completed' ? 'purple' : 'default'
                                      }>
                                        {assignment.status.toUpperCase()}
                                      </Tag>
                                      <Select
                                        size="small"
                                        value={assignment.status}
                                        onChange={(value) => updateAssignmentStatus(assignment.id, value)}
                                        style={{ width: 100 }}
                                      >
                                        <Option value="assigned">Assigned</Option>
                                        <Option value="confirmed">Confirmed</Option>
                                        <Option value="declined">Declined</Option>
                                        <Option value="completed">Completed</Option>
                                        <Option value="cancelled">Cancelled</Option>
                                      </Select>
                                    </Space>
                                  </div>
                                  
                                  {/* Fee Information */}
                                  {(assignment.therapist_fee || assignment.hours_worked || assignment.hourly_rate) && (
                                    <div style={{ 
                                      display: 'flex', 
                                      justifyContent: 'space-between', 
                                      fontSize: '13px',
                                      backgroundColor: '#fff',
                                      padding: '8px',
                                      borderRadius: '4px',
                                      border: '1px solid #e8e8e8'
                                    }}>
                                      <span>
                                        {assignment.hours_worked ? `${assignment.hours_worked}h` : '0h'} × 
                                        ${assignment.hourly_rate ? assignment.hourly_rate : '0'}/hr
                                        {assignment.rate_type && (
                                          <span style={{ fontSize: '11px', color: '#666', marginLeft: '4px' }}>
                                            ({assignment.rate_type})
                                          </span>
                                        )}
                                      </span>
                                      <span style={{ fontWeight: 'bold', color: '#52c41a' }}>
                                        = ${assignment.therapist_fee ? assignment.therapist_fee.toFixed(2) : '0.00'}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              ))}
                              
                              {/* Total Fee Summary */}
                              <div style={{ 
                                marginTop: '12px', 
                                padding: '12px', 
                                backgroundColor: '#f0f8ff', 
                                borderRadius: '6px', 
                                border: '1px solid #1890ff' 
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                                  <span><strong>Total Therapist Fees:</strong></span>
                                  <span style={{ fontWeight: 'bold', color: '#1890ff' }}>
                                    ${therapistAssignments.reduce((sum, a) => sum + (a.therapist_fee || 0), 0).toFixed(2)}
                                  </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginTop: '4px' }}>
                                  <span><strong>Customer Payment:</strong></span>
                                  <span>${(booking?.price || 0).toFixed(2)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginTop: '4px' }}>
                                  <span><strong>Business Margin:</strong></span>
                                  {(() => {
                                    const customerPayment = booking?.price || 0;
                                    const totalFees = therapistAssignments.reduce((sum, a) => sum + (a.therapist_fee || 0), 0);
                                    const margin = customerPayment - totalFees;
                                    const marginPercent = customerPayment > 0 ? (margin / customerPayment) * 100 : 0;
                                    return (
                                      <span style={{ color: margin >= 0 ? '#52c41a' : '#ff4d4f' }}>
                                        ${margin.toFixed(2)} ({marginPercent.toFixed(1)}%)
                                      </span>
                                    );
                                  })()}
                                </div>
                                <div style={{ marginTop: '8px' }}>
                                  <Space>
                                    <Button 
                                      size="small" 
                                      onClick={recalculateTherapistFees}
                                      icon={<ReloadOutlined />}
                                      type="primary"
                                    >
                                      Recalculate Fees
                                    </Button>
                                    {isQuote(booking) && (
                                      <Text style={{ fontSize: '11px', color: '#666' }}>
                                        Attendees: {booking.expected_attendees || booking.number_of_massages || 1}, 
                                        Duration/massage: {booking.duration_per_massage || booking.duration_minutes || 30}min
                                      </Text>
                                    )}
                                  </Space>
                                </div>
                              </div>
                            </div>
                          </Form.Item>
                        </Col>
                      )}
                    </>
                  )}

                  {/* Additional Details */}
                  <Col span={24}><Divider style={{ margin: '12px 0' }}><Text strong>Additional Details</Text></Divider></Col>

                  {/* Notes */}
                  <Col span={24}>
                    <Form.Item name="notes" label="Notes">
                      <TextArea rows={3} placeholder="Additional notes..." />
                    </Form.Item>
                  </Col>
                </Row>

                <Divider />

                {/* Action Buttons */}
                <Row gutter={[16, 16]}>
                  <Col span={24} style={{ textAlign: 'right' }}>
                    <Space>
                      <Button
                        onClick={() => show('bookings', booking.id)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="primary"
                        icon={<SaveOutlined />}
                        htmlType="submit"
                        loading={saving}
                      >
                        Save Changes
                      </Button>
                    </Space>
                  </Col>
                </Row>
              </Form>
            </Card>
          </Col>
        </Row>

        {/* Notification Modal */}
        <Modal
          title="📤 Send Booking Update Notifications"
          open={showNotificationModal}
          onCancel={() => {
            setShowNotificationModal(false);
            show('bookings', booking.id);
          }}
          width={600}
          footer={null}
        >
          <div style={{ marginBottom: 16 }}>
            <Alert
              message="✅ Booking Updated Successfully!"
              type="success"
              showIcon
              style={{ marginBottom: 16 }}
            />
            
            <Title level={5}>📝 Changes detected:</Title>
            <ul style={{ marginBottom: 20 }}>
              {detectedChanges.map((change, index) => (
                <li key={index} style={{ marginBottom: 4 }}>
                  <Text>• {change}</Text>
                </li>
              ))}
            </ul>
          </div>

          <Form layout="vertical">
            <Form.Item label="📤 Send notifications to:">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Checkbox
                  checked={notificationOptions.notifyCustomer && notificationOptions.notifyTherapist}
                  indeterminate={notificationOptions.notifyCustomer !== notificationOptions.notifyTherapist}
                  onChange={(e: any) => {
                    const checked = e.target.checked;
                    setNotificationOptions(prev => ({
                      ...prev,
                      notifyCustomer: checked,
                      notifyTherapist: checked
                    }));
                  }}
                >
                  <Text strong>Notify all parties (Customer + Therapist)</Text>
                </Checkbox>
                <Checkbox
                  checked={notificationOptions.notifyCustomer}
                  onChange={(e: any) => setNotificationOptions(prev => ({...prev, notifyCustomer: e.target.checked}))}
                  style={{ marginLeft: 20 }}
                >
                  <Text>Customer</Text>
                </Checkbox>
                <Checkbox
                  checked={notificationOptions.notifyTherapist}
                  onChange={(e: any) => setNotificationOptions(prev => ({...prev, notifyTherapist: e.target.checked}))}
                  style={{ marginLeft: 20 }}
                >
                  <Text>Therapist</Text>
                </Checkbox>
              </Space>
            </Form.Item>

            <Form.Item label="📧 Delivery method:">
              <Space>
                <Checkbox
                  checked={notificationOptions.sendEmail}
                  onChange={(e: any) => setNotificationOptions(prev => ({...prev, sendEmail: e.target.checked}))}
                >
                  Email
                </Checkbox>
                <Checkbox
                  checked={notificationOptions.sendSMS}
                  onChange={(e: any) => setNotificationOptions(prev => ({...prev, sendSMS: e.target.checked}))}
                  disabled
                >
                  SMS (Coming Soon)
                </Checkbox>
              </Space>
            </Form.Item>

            <div style={{ textAlign: 'right', marginTop: 20 }}>
              <Space>
                <Button onClick={() => {
                  setShowNotificationModal(false);
                  show('bookings', booking.id);
                }}>
                  Skip Notifications
                </Button>
                <Button 
                  type="primary" 
                  loading={sendingNotifications}
                  disabled={!notificationOptions.sendEmail || (!notificationOptions.notifyCustomer && !notificationOptions.notifyTherapist)}
                  onClick={handleSendNotifications}
                >
                  Send Notifications
                </Button>
              </Space>
            </div>
          </Form>
        </Modal>
      </div>
    </RoleGuard>
  );
}; 