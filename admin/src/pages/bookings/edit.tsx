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

interface Service {
  id: string;
  name: string;
  description?: string;
  service_base_price: number;
  minimum_duration: number;
  is_active: boolean;
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

  const userRole = identity?.role;

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
          customers!inner(first_name, last_name, email, phone, address, notes),
          therapist_profiles!bookings_therapist_id_fkey(first_name, last_name, email, phone, bio, profile_pic),
          services!inner(name, description, service_base_price, minimum_duration)
        `)
        .eq('id', id)
        .single();

      if (bookingError) throw bookingError;

      const transformedBooking: Booking = {
        ...bookingData,
        customer_name: `${bookingData.customers.first_name} ${bookingData.customers.last_name}`,
        therapist_name: `${bookingData.therapist_profiles.first_name} ${bookingData.therapist_profiles.last_name}`,
        service_name: bookingData.services.name,
        customer_details: bookingData.customers,
        therapist_details: bookingData.therapist_profiles,
        service_details: bookingData.services,
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
        notes: bookingData.notes,
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
        duration_minutes: bookingData.duration_minutes || bookingData.services.minimum_duration,
        gender_preference: bookingData.gender_preference,
        parking: bookingData.parking,
        room_number: bookingData.room_number,
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
        .select('id, name, description, service_base_price, minimum_duration, is_active')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error('Error fetching services:', error);
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
      
      // Prepare booking data for email service
      const emailBookingData: BookingData = {
        id: booking.id,
        booking_id: booking.booking_id,
        customer_name: booking.customer_name,
        customer_email: booking.customer_details?.email,
        customer_phone: booking.customer_details?.phone,
        therapist_name: booking.therapist_name,
        therapist_email: booking.therapist_details?.email,
        service_name: booking.service_name,
        booking_time: booking.booking_time,
        address: booking.address,
        business_name: booking.business_name,
        duration_minutes: booking.duration_minutes,
        price: booking.price,
        therapist_fee: booking.therapist_fee,
        notes: booking.notes,
        room_number: booking.room_number
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
              <Title level={3} style={{ margin: 0 }}>
                Edit Booking #{booking.booking_id || booking.id.slice(0, 8)}
              </Title>
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
                    ${booking.price.toFixed(2)}
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
                <Row gutter={[16, 16]}>
                  {/* Customer Details */}
                  <Col span={8}>
                    <Form.Item
                      name="customer_first_name"
                      label="Customer First Name"
                      rules={[{ required: true, message: 'Please enter first name' }]}
                    >
                      <Input placeholder="First name" />
                    </Form.Item>
                  </Col>
                  
                  <Col span={8}>
                    <Form.Item
                      name="customer_last_name"
                      label="Customer Last Name"
                      rules={[{ required: true, message: 'Please enter last name' }]}
                    >
                      <Input placeholder="Last name" />
                    </Form.Item>
                  </Col>
                  
                  <Col span={8}>
                    <Form.Item
                      name="customer_email"
                      label="Customer Email"
                      rules={[
                        { required: true, message: 'Please enter email' },
                        { type: 'email', message: 'Please enter a valid email' }
                      ]}
                    >
                      <Input placeholder="customer@email.com" />
                    </Form.Item>
                  </Col>
                  
                  <Col span={12}>
                    <Form.Item
                      name="customer_phone"
                      label="Customer Phone"
                    >
                      <Input placeholder="Phone number (optional)" />
                    </Form.Item>
                  </Col>

                  {/* Therapist Selection */}
                  <Col span={12}>
                    <Form.Item
                      name="therapist_id"
                      label="Therapist"
                      rules={[{ required: true, message: 'Please select a therapist' }]}
                    >
                      <Select
                        placeholder="Select therapist"
                        showSearch
                        optionFilterProp="children"
                        filterOption={(input, option) =>
                          (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
                        }
                      >
                        {therapists.map(therapist => (
                          <Option key={therapist.id} value={therapist.id}>
                            {therapist.first_name} {therapist.last_name}
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>

                  {/* Service Selection */}
                  <Col span={12}>
                    <Form.Item
                      name="service_id"
                      label="Service"
                      rules={[{ required: true, message: 'Please select a service' }]}
                    >
                      <Select
                        placeholder="Select service"
                        onChange={handleServiceChange}
                        showSearch
                        optionFilterProp="children"
                        filterOption={(input, option) =>
                          (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
                        }
                      >
                        {services.map(service => (
                          <Option key={service.id} value={service.id}>
                            {service.name} (${service.service_base_price})
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>

                  {/* Duration */}
                  <Col span={12}>
                    <Form.Item
                      name="duration_minutes"
                      label="Duration (minutes)"
                      rules={[{ required: true, message: 'Please enter duration' }]}
                    >
                      <InputNumber
                        min={15}
                        max={240}
                        step={15}
                        style={{ width: '100%' }}
                        placeholder="Duration in minutes"
                      />
                    </Form.Item>
                  </Col>

                  {/* Date and Time */}
                  <Col span={12}>
                    <Form.Item
                      name="booking_time"
                      label="Date & Time"
                      rules={[{ required: true, message: 'Please select date and time' }]}
                    >
                      <DatePicker
                        showTime={{ format: 'HH:mm' }}
                        format="YYYY-MM-DD HH:mm"
                        style={{ width: '100%' }}
                        placeholder="Select date and time"
                      />
                    </Form.Item>
                  </Col>

                  {/* Delivery Address */}
                  <Col span={12}>
                    <Form.Item
                      name="address"
                      label="Delivery Address"
                      rules={[{ required: true, message: 'Please enter delivery address' }]}
                    >
                      <Input placeholder="Massage delivery address" />
                    </Form.Item>
                  </Col>

                  {/* Business Name */}
                  <Col span={12}>
                    <Form.Item
                      name="business_name"
                      label="Hotel/Business Name"
                    >
                      <Input placeholder="Hotel or business name (optional)" />
                    </Form.Item>
                  </Col>

                  {/* Super Admin Only - Pricing */}
                  {userRole === 'super_admin' && (
                    <>
                      {/* Price */}
                      <Col span={6}>
                        <Form.Item
                          name="price"
                          label="Price (Super Admin Only)"
                        >
                          <InputNumber
                            prefix="$"
                            min={0}
                            step={0.01}
                            style={{ width: '100%' }}
                            placeholder="0.00"
                          />
                        </Form.Item>
                      </Col>

                      {/* Therapist Fee */}
                      <Col span={6}>
                        <Form.Item
                          name="therapist_fee"
                          label="Therapist Fee (Super Admin Only)"
                        >
                          <InputNumber
                            prefix="$"
                            min={0}
                            step={0.01}
                            style={{ width: '100%' }}
                            placeholder="0.00"
                          />
                        </Form.Item>
                      </Col>
                    </>
                  )}

                  {/* Gender Preference */}
                  <Col span={8}>
                    <Form.Item
                      name="gender_preference"
                      label="Gender Preference"
                    >
                      <Select placeholder="Select preference" allowClear>
                        <Option value="male">Male</Option>
                        <Option value="female">Female</Option>
                        <Option value="no_preference">No Preference</Option>
                      </Select>
                    </Form.Item>
                  </Col>

                  {/* Room Number */}
                  <Col span={8}>
                    <Form.Item
                      name="room_number"
                      label="Room Number"
                    >
                      <Input placeholder="Room number" />
                    </Form.Item>
                  </Col>

                  {/* Parking */}
                  <Col span={8}>
                    <Form.Item
                      name="parking"
                      label="Parking"
                    >
                      <Select placeholder="Select parking option" allowClear>
                        <Option value="available">Available</Option>
                        <Option value="street">Street Parking</Option>
                        <Option value="none">No Parking</Option>
                      </Select>
                    </Form.Item>
                  </Col>

                  {/* Notes */}
                  <Col span={24}>
                    <Form.Item
                      name="notes"
                      label="Notes"
                    >
                      <TextArea
                        rows={4}
                        placeholder="Additional notes about the booking..."
                      />
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