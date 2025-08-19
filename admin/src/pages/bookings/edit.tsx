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
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showTherapistModal, setShowTherapistModal] = useState(false);

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
        fetchCustomers(),
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
          therapist_profiles!inner(first_name, last_name, email, phone, bio, profile_pic),
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

      // Set form values
      form.setFieldsValue({
        customer_id: bookingData.customer_id,
        therapist_id: bookingData.therapist_id,
        service_id: bookingData.service_id,
        booking_time: dayjs(bookingData.booking_time),
        status: bookingData.status,
        payment_status: bookingData.payment_status,
        price: bookingData.price,
        therapist_fee: bookingData.therapist_fee,
        address: bookingData.address,
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

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('customers')
        .select('id, first_name, last_name, email, phone, address')
        .order('first_name');

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
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

  const handleSubmit = async (values: any) => {
    if (!booking) return;

    setSaving(true);
    try {
      const updateData = {
        customer_id: values.customer_id,
        therapist_id: values.therapist_id,
        service_id: values.service_id,
        booking_time: values.booking_time.format('YYYY-MM-DD HH:mm:ss'),
        status: values.status,
        payment_status: values.payment_status,
        price: values.price,
        therapist_fee: values.therapist_fee,
        address: values.address,
        notes: values.notes,
        duration_minutes: values.duration_minutes,
        gender_preference: values.gender_preference,
        parking: values.parking,
        room_number: values.room_number,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabaseClient
        .from('bookings')
        .update(updateData)
        .eq('id', booking.id);

      if (error) throw error;

      // Add to status history if status changed
      if (values.status !== booking.status) {
        await supabaseClient
          .from('booking_status_history')
          .insert({
            booking_id: booking.id,
            status: values.status,
            changed_by: identity?.id,
            notes: `Status changed to ${values.status}`,
          });
      }

      message.success('Booking updated successfully');
      show('bookings', booking.id);
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
    <RoleGuard requiredRole="admin">
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
                  {/* Customer Selection */}
                  <Col span={12}>
                    <Form.Item
                      name="customer_id"
                      label="Customer"
                      rules={[{ required: true, message: 'Please select a customer' }]}
                    >
                      <Select
                        placeholder="Select customer"
                        showSearch
                        optionFilterProp="children"
                        filterOption={(input, option) =>
                          (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
                        }
                      >
                        {customers.map(customer => (
                          <Option key={customer.id} value={customer.id}>
                            {customer.first_name} {customer.last_name} ({customer.email})
                          </Option>
                        ))}
                      </Select>
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

                  {/* Address */}
                  <Col span={12}>
                    <Form.Item
                      name="address"
                      label="Address"
                      rules={[{ required: true, message: 'Please enter address' }]}
                    >
                      <Input placeholder="Service address" />
                    </Form.Item>
                  </Col>

                  {/* Status */}
                  <Col span={8}>
                    <Form.Item
                      name="status"
                      label="Status"
                      rules={[{ required: true, message: 'Please select status' }]}
                    >
                      <Select placeholder="Select status">
                        <Option value="requested">Requested</Option>
                        <Option value="confirmed">Confirmed</Option>
                        <Option value="completed">Completed</Option>
                        <Option value="cancelled">Cancelled</Option>
                        <Option value="declined">Declined</Option>
                      </Select>
                    </Form.Item>
                  </Col>

                  {/* Payment Status */}
                  <Col span={8}>
                    <Form.Item
                      name="payment_status"
                      label="Payment Status"
                      rules={[{ required: true, message: 'Please select payment status' }]}
                    >
                      <Select placeholder="Select payment status">
                        <Option value="pending">Pending</Option>
                        <Option value="paid">Paid</Option>
                        <Option value="refunded">Refunded</Option>
                      </Select>
                    </Form.Item>
                  </Col>

                  {/* Price */}
                  <Col span={8}>
                    <Form.Item
                      name="price"
                      label="Price"
                      rules={[{ required: true, message: 'Please enter price' }]}
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
                  <Col span={8}>
                    <Form.Item
                      name="therapist_fee"
                      label="Therapist Fee"
                      rules={[{ required: true, message: 'Please enter therapist fee' }]}
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
      </div>
    </RoleGuard>
  );
}; 