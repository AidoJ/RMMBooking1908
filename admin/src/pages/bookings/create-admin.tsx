import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Typography,
  Tag,
  Button,
  Space,
  Tabs,
  Form,
  Input,
  Select,
  DatePicker,
  TimePicker,
  InputNumber,
  message,
  Divider,
  Alert,
  Statistic,
  Tooltip,
  Avatar,
  Badge,
  Spin,
  Modal,
  Input as AntInput,
} from 'antd';
import {
  UserOutlined,
  PhoneOutlined,
  MailOutlined,
  EnvironmentOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  PlusOutlined,
  SearchOutlined,
  ArrowLeftOutlined,
  ReloadOutlined,
  MessageOutlined,
} from '@ant-design/icons';
import { useGetIdentity, useNavigation } from '@refinedev/core';
import { supabaseClient } from '../../utility';
import { UserIdentity, canAccess, isTherapist, isAdmin } from '../../utils/roleUtils';
import { RoleGuard } from '../../components/RoleGuard';
import dayjs, { Dayjs } from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;
const { Option } = Select;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  business_name?: string;
  address?: string;
}

interface Service {
  id: string;
  name: string;
  service_base_price: number;
  minimum_duration: number;
  description?: string;
}

interface Therapist {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  gender: string;
  is_active: boolean;
}

interface SystemSettings {
  businessOpeningHour: number;
  businessClosingHour: number;
  beforeServiceBuffer: number;
  afterServiceBuffer: number;
  minBookingAdvanceHours: number;
}

interface BookingFormData {
  // Customer
  customer_id?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  business_name?: string;
  address: string;
  room_number?: string;
  access_instructions?: string;
  notes?: string;
  
  // Scheduling
  booking_date: Dayjs;
  booking_time: Dayjs;
  duration_minutes: number;
  therapist_id?: string;
  gender_preference: string;
  
  // Services
  service_id: string;
  base_price: number;
  time_uplift_percent: number;
  weekend_uplift_percent: number;
  discount_percent: number;
  
  // Billing
  payment_method: string;
  payment_status: string;
  initial_status: string;
  priority_level: string;
}

export const AdminBookingCreate: React.FC = () => {
  const { data: identity } = useGetIdentity<UserIdentity>();
  const { list } = useNavigation();
  
  const [form] = Form.useForm<BookingFormData>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('customer');
  
  // Data states
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  
  // UI states
  const [customerSearchVisible, setCustomerSearchVisible] = useState(false);
  const [customerSearchResults, setCustomerSearchResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [pricingBreakdown, setPricingBreakdown] = useState({
    basePrice: 0,
    timeUplift: 0,
    weekendUplift: 0,
    subtotal: 0,
    discount: 0,
    gst: 0,
    total: 0,
  });
  
  // Validation states
  const [validationStatus, setValidationStatus] = useState({
    customer: false,
    scheduling: false,
    services: false,
    billing: false,
  });

  const userRole = identity?.role;

  useEffect(() => {
    if (identity && canAccess(userRole, 'canCreateBookings')) {
      fetchInitialData();
    }
  }, [identity]);

  useEffect(() => {
    // Watch form changes to update pricing and validation
    const subscription = form.getFieldsValue();
    updatePricing();
    updateValidationStatus();
  }, [form.getFieldsValue()]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // Fetch services
      const { data: servicesData, error: servicesError } = await supabaseClient
        .from('services')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (servicesError) throw servicesError;
      setServices(servicesData || []);

      // Fetch therapists
      const { data: therapistsData, error: therapistsError } = await supabaseClient
        .from('therapist_profiles')
        .select('*')
        .eq('is_active', true)
        .order('first_name');

      if (therapistsError) throw therapistsError;
      setTherapists(therapistsData || []);

      // Fetch system settings
      const { data: settingsData, error: settingsError } = await supabaseClient
        .from('system_settings')
        .select('*');

      if (settingsError) throw settingsError;
      
      const settings: SystemSettings = {
        businessOpeningHour: 9,
        businessClosingHour: 18,
        beforeServiceBuffer: 15,
        afterServiceBuffer: 15,
        minBookingAdvanceHours: 2,
      };

      if (settingsData && settingsData.length > 0) {
        const settingsRow = settingsData[0];
        settings.businessOpeningHour = settingsRow.business_opening_hour || 9;
        settings.businessClosingHour = settingsRow.business_closing_hour || 18;
        settings.beforeServiceBuffer = settingsRow.before_service_buffer || 15;
        settings.afterServiceBuffer = settingsRow.after_service_buffer || 15;
        settings.minBookingAdvanceHours = settingsRow.min_booking_advance_hours || 2;
      }

      setSystemSettings(settings);

    } catch (error) {
      console.error('Error fetching initial data:', error);
      message.error('Failed to load initial data');
    } finally {
      setLoading(false);
    }
  };

  const searchCustomers = async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setCustomerSearchResults([]);
      return;
    }

    try {
      const { data, error } = await supabaseClient
        .from('customers')
        .select('*')
        .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`)
        .limit(10);

      if (error) throw error;
      setCustomerSearchResults(data || []);
    } catch (error) {
      console.error('Error searching customers:', error);
      message.error('Failed to search customers');
    }
  };

  const selectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    form.setFieldsValue({
      customer_id: customer.id,
      first_name: customer.first_name,
      last_name: customer.last_name,
      email: customer.email,
      phone: customer.phone || '',
      business_name: customer.business_name || '',
      address: customer.address || '',
    });
    setCustomerSearchVisible(false);
    setCustomerSearchResults([]);
    updateValidationStatus();
  };

  const updatePricing = () => {
    const values = form.getFieldsValue();
    if (!values.service_id || !values.duration_minutes) {
      setPricingBreakdown({
        basePrice: 0,
        timeUplift: 0,
        weekendUplift: 0,
        subtotal: 0,
        discount: 0,
        gst: 0,
        total: 0,
      });
      return;
    }

    const service = services.find(s => s.id === values.service_id);
    const basePrice = service?.service_base_price || 0;
    
    // Calculate time uplift (extended duration)
    const timeUplift = basePrice * ((values.time_uplift_percent || 0) / 100);
    
    // Calculate weekend/afterhours uplift
    const weekendUplift = basePrice * ((values.weekend_uplift_percent || 0) / 100);
    
    const subtotal = basePrice + timeUplift + weekendUplift;
    const discount = subtotal * ((values.discount_percent || 0) / 100);
    const afterDiscount = subtotal - discount;
    const gst = afterDiscount * 0.1;
    const total = afterDiscount + gst;

    setPricingBreakdown({
      basePrice,
      timeUplift,
      weekendUplift,
      subtotal,
      discount,
      gst,
      total,
    });
  };

  const updateValidationStatus = () => {
    const values = form.getFieldsValue();
    
    const customerValid = !!(values.first_name && values.last_name && values.email && values.phone && values.address);
    const schedulingValid = !!(values.booking_date && values.booking_time && values.duration_minutes);
    const servicesValid = !!(values.service_id);
    const billingValid = !!(values.payment_method && values.payment_status && pricingBreakdown.total > 0);

    setValidationStatus({
      customer: customerValid,
      scheduling: schedulingValid,
      services: servicesValid,
      billing: billingValid,
    });
  };

  const handleServiceChange = (serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    if (service) {
      form.setFieldsValue({
        base_price: service.service_base_price,
        duration_minutes: service.minimum_duration,
      });
      updatePricing();
    }
  };

  const handleCreateBooking = async () => {
    const allValid = Object.values(validationStatus).every(Boolean);
    if (!allValid) {
      message.error('Please complete all required fields before creating the booking');
      return;
    }

    const values = await form.validateFields();
    setSaving(true);

    try {
      // Create customer if not selected from existing
      let customerId = values.customer_id;
      if (!customerId) {
        const { data: customerData, error: customerError } = await supabaseClient
          .from('customers')
          .insert({
            first_name: values.first_name,
            last_name: values.last_name,
            email: values.email,
            phone: values.phone,
            business_name: values.business_name,
            address: values.address,
          })
          .select()
          .single();

        if (customerError) throw customerError;
        customerId = customerData.id;
      }

      // Generate booking ID (RB + YYMM + ###)
      const now = new Date();
      const year = now.getFullYear().toString().slice(-2);
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      
      const { count } = await supabaseClient
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .like('booking_id', `RB${year}${month}%`);
      
      const bookingNumber = (count || 0) + 1;
      const bookingId = `RB${year}${month}${bookingNumber.toString().padStart(3, '0')}`;

      // Combine date and time
      const bookingDateTime = values.booking_date
        .hour(values.booking_time.hour())
        .minute(values.booking_time.minute())
        .second(0)
        .millisecond(0)
        .toISOString();

      // Create booking
      const { data: bookingData, error: bookingError } = await supabaseClient
        .from('bookings')
        .insert({
          booking_id: bookingId,
          customer_id: customerId,
          therapist_id: values.therapist_id,
          service_id: values.service_id,
          booking_time: bookingDateTime,
          duration_minutes: values.duration_minutes,
          status: values.initial_status || 'confirmed',
          payment_status: values.payment_status || 'pending',
          price: pricingBreakdown.total,
          therapist_fee: pricingBreakdown.total * 0.7, // Default 70% to therapist
          address: values.address,
          business_name: values.business_name,
          room_number: values.room_number,
          notes: values.notes,
          gender_preference: values.gender_preference,
          booking_type: 'booking',
          created_by: identity?.id,
          updated_by: identity?.id,
        })
        .select()
        .single();

      if (bookingError) throw bookingError;

      // Add to status history
      await supabaseClient
        .from('booking_status_history')
        .insert({
          booking_id: bookingData.id,
          status: values.initial_status || 'confirmed',
          changed_by: identity?.id,
          notes: 'Booking created manually by admin',
        });

      message.success(`Manual booking created successfully! Booking ID: ${bookingId}`);
      
      // Reset form
      form.resetFields();
      setSelectedCustomer(null);
      setActiveTab('customer');

    } catch (error) {
      console.error('Error creating booking:', error);
      message.error('Failed to create booking');
    } finally {
      setSaving(false);
    }
  };

  if (!canAccess(userRole, 'canCreateBookings')) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Title level={3}>Access Denied</Title>
        <Text>You don't have permission to create manual bookings.</Text>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>Loading booking creation form...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={12}>
          <Space>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => list('bookings')}
            >
              Back to Bookings
            </Button>
            <div>
              <Title level={3} style={{ margin: 0 }}>Create Manual Booking</Title>
              <Tag color="orange">NEW BOOKING</Tag>
              <Tag color="blue">MANUAL CREATION</Tag>
            </div>
          </Space>
        </Col>
        <Col span={12} style={{ textAlign: 'right' }}>
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => form.resetFields()}
            >
              Reset Form
            </Button>
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={() => setCustomerSearchVisible(true)}
            >
              Find Customer
            </Button>
          </Space>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* Main Content */}
        <Col span={16}>
          <Card>
            <Tabs 
              activeKey={activeTab} 
              onChange={setActiveTab}
              items={[
                {
                  key: 'customer',
                  label: '👤 Customer',
                  children: (
                    <div>
                      <Alert
                        message="Quick Start"
                        description="Search for existing customers or create a new customer profile. All fields are required for new bookings."
                        type="info"
                        showIcon
                        style={{ marginBottom: 24 }}
                      />

                      {/* Customer Search Modal */}
                      <Modal
                        title="Search Existing Customer"
                        open={customerSearchVisible}
                        onCancel={() => setCustomerSearchVisible(false)}
                        footer={null}
                        width={600}
                      >
                        <Input.Search
                          placeholder="Type name, email, or phone..."
                          onSearch={searchCustomers}
                          style={{ marginBottom: 16 }}
                        />
                        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                          {customerSearchResults.map(customer => (
                            <Card
                              key={customer.id}
                              size="small"
                              style={{ marginBottom: 8, cursor: 'pointer' }}
                              onClick={() => selectCustomer(customer)}
                              hoverable
                            >
                              <Space direction="vertical" size="small">
                                <Text strong>{customer.first_name} {customer.last_name}</Text>
                                <Space size="small">
                                  <MailOutlined />
                                  <Text>{customer.email}</Text>
                                </Space>
                                {customer.phone && (
                                  <Space size="small">
                                    <PhoneOutlined />
                                    <Text>{customer.phone}</Text>
                                  </Space>
                                )}
                              </Space>
                            </Card>
                          ))}
                        </div>
                      </Modal>

                      <Row gutter={[16, 16]}>
                        <Col span={12}>
                          <Form.Item
                            label="Full Name *"
                            name="first_name"
                            rules={[{ required: true, message: 'Please enter first name' }]}
                          >
                            <Input placeholder="First name" />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item
                            label="Last Name *"
                            name="last_name"
                            rules={[{ required: true, message: 'Please enter last name' }]}
                          >
                            <Input placeholder="Last name" />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Row gutter={[16, 16]}>
                        <Col span={12}>
                          <Form.Item
                            label="Email *"
                            name="email"
                            rules={[
                              { required: true, message: 'Please enter email' },
                              { type: 'email', message: 'Please enter valid email' }
                            ]}
                          >
                            <Input placeholder="Email address" />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item
                            label="Phone *"
                            name="phone"
                            rules={[{ required: true, message: 'Please enter phone' }]}
                          >
                            <Input placeholder="Phone number" />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Form.Item
                        label="Business Name"
                        name="business_name"
                      >
                        <Input placeholder="Business name (optional)" />
                      </Form.Item>

                      <Form.Item
                        label="Address *"
                        name="address"
                        rules={[{ required: true, message: 'Please enter address' }]}
                      >
                        <TextArea placeholder="Service address" rows={3} />
                      </Form.Item>

                      <Row gutter={[16, 16]}>
                        <Col span={12}>
                          <Form.Item
                            label="Room Details"
                            name="room_number"
                          >
                            <Input placeholder="Room/area details" />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item
                            label="Access Instructions"
                            name="access_instructions"
                          >
                            <Input placeholder="Access instructions" />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Form.Item
                        label="Notes & Special Requests"
                        name="notes"
                      >
                        <TextArea placeholder="Any special requirements or notes" rows={3} />
                      </Form.Item>
                    </div>
                  ),
                },
                {
                  key: 'scheduling',
                  label: '📅 Scheduling',
                  children: (
                    <div>
                      <Row gutter={[16, 16]}>
                        <Col span={12}>
                          <Form.Item
                            label="Service Date *"
                            name="booking_date"
                            rules={[{ required: true, message: 'Please select date' }]}
                          >
                            <DatePicker style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item
                            label="Start Time *"
                            name="booking_time"
                            rules={[{ required: true, message: 'Please select time' }]}
                          >
                            <TimePicker style={{ width: '100%' }} format="HH:mm" />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Row gutter={[16, 16]}>
                        <Col span={12}>
                          <Form.Item
                            label="Duration *"
                            name="duration_minutes"
                            rules={[{ required: true, message: 'Please select duration' }]}
                          >
                            <Select placeholder="Select duration...">
                              <Option value={60}>60 minutes</Option>
                              <Option value={90}>90 minutes</Option>
                              <Option value={120}>120 minutes</Option>
                              <Option value={180}>180 minutes</Option>
                            </Select>
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item
                            label="Assigned Therapist"
                            name="therapist_id"
                          >
                            <Select placeholder="Select therapist...">
                              <Option value="">Auto-assign based on availability</Option>
                              {therapists.map(therapist => (
                                <Option key={therapist.id} value={therapist.id}>
                                  {therapist.first_name} {therapist.last_name} - {therapist.gender}
                                </Option>
                              ))}
                            </Select>
                          </Form.Item>
                        </Col>
                      </Row>

                      <Row gutter={[16, 16]}>
                        <Col span={12}>
                          <Form.Item
                            label="Gender Preference"
                            name="gender_preference"
                            initialValue="any"
                          >
                            <Select>
                              <Option value="any">No Preference</Option>
                              <Option value="female">Female</Option>
                              <Option value="male">Male</Option>
                            </Select>
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item
                            label="Backup Option"
                            name="backup_option"
                            initialValue="auto"
                          >
                            <Select>
                              <Option value="auto">Auto-assign</Option>
                              <Option value="manual">Manual selection</Option>
                            </Select>
                          </Form.Item>
                        </Col>
                      </Row>
                    </div>
                  ),
                },
                {
                  key: 'services',
                  label: '🛠️ Services',
                  children: (
                    <div>
                      <Form.Item
                        label="Service Type *"
                        name="service_id"
                        rules={[{ required: true, message: 'Please select service' }]}
                      >
                        <Select 
                          placeholder="Select service..."
                          onChange={handleServiceChange}
                        >
                          {services.map(service => (
                            <Option key={service.id} value={service.id}>
                              {service.name} - ${service.service_base_price}
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>

                      <Row gutter={[16, 16]}>
                        <Col span={12}>
                          <Form.Item
                            label="Time Uplift %"
                            name="time_uplift_percent"
                            initialValue={0}
                          >
                            <Select>
                              <Option value={0}>Standard (0%)</Option>
                              <Option value={25}>Extended (25%)</Option>
                              <Option value={50}>Premium (50%)</Option>
                              <Option value={100}>VIP (100%)</Option>
                            </Select>
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item
                            label="Weekend/Afterhours Uplift"
                            name="weekend_uplift_percent"
                            initialValue={0}
                          >
                            <Select>
                              <Option value={0}>Standard hours (0%)</Option>
                              <Option value={25}>Weekend (25%)</Option>
                              <Option value={50}>After hours (50%)</Option>
                              <Option value={75}>Weekend + After hours (75%)</Option>
                            </Select>
                          </Form.Item>
                        </Col>
                      </Row>

                      <Form.Item
                        label="Special Discount %"
                        name="discount_percent"
                        initialValue={0}
                      >
                        <InputNumber
                          min={0}
                          max={100}
                          style={{ width: '100%' }}
                          placeholder="Discount percentage"
                        />
                      </Form.Item>

                      <Form.Item
                        label="Equipment Required"
                        name="equipment_required"
                      >
                        <TextArea placeholder="List any special equipment needed" rows={3} />
                      </Form.Item>

                      <Row gutter={[16, 16]}>
                        <Col span={12}>
                          <Form.Item
                            label="Setup Time (minutes)"
                            name="setup_time"
                            initialValue={15}
                          >
                            <InputNumber min={0} style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item
                            label="Cleanup Time (minutes)"
                            name="cleanup_time"
                            initialValue={10}
                          >
                            <InputNumber min={0} style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                      </Row>
                    </div>
                  ),
                },
                {
                  key: 'billing',
                  label: '💰 Billing',
                  children: (
                    <div>
                      <Card title="Pricing Calculator" style={{ marginBottom: 24 }}>
                        <Row gutter={[16, 8]}>
                          <Col span={12}>Base Service:</Col>
                          <Col span={12} style={{ textAlign: 'right' }}>
                            ${pricingBreakdown.basePrice.toFixed(2)}
                          </Col>
                          <Col span={12}>Time Uplift:</Col>
                          <Col span={12} style={{ textAlign: 'right' }}>
                            ${pricingBreakdown.timeUplift.toFixed(2)}
                          </Col>
                          <Col span={12}>Weekend/Afterhours:</Col>
                          <Col span={12} style={{ textAlign: 'right' }}>
                            ${pricingBreakdown.weekendUplift.toFixed(2)}
                          </Col>
                          <Col span={12}>Subtotal:</Col>
                          <Col span={12} style={{ textAlign: 'right' }}>
                            ${pricingBreakdown.subtotal.toFixed(2)}
                          </Col>
                          <Col span={12}>Discount:</Col>
                          <Col span={12} style={{ textAlign: 'right', color: '#52c41a' }}>
                            -${pricingBreakdown.discount.toFixed(2)}
                          </Col>
                          <Col span={12}>GST (10%):</Col>
                          <Col span={12} style={{ textAlign: 'right' }}>
                            ${pricingBreakdown.gst.toFixed(2)}
                          </Col>
                          <Divider />
                          <Col span={12}>
                            <Text strong style={{ fontSize: 16 }}>Total Amount:</Text>
                          </Col>
                          <Col span={12} style={{ textAlign: 'right' }}>
                            <Text strong style={{ fontSize: 16, color: '#1890ff' }}>
                              ${pricingBreakdown.total.toFixed(2)}
                            </Text>
                          </Col>
                        </Row>
                      </Card>

                      <Row gutter={[16, 16]}>
                        <Col span={12}>
                          <Form.Item
                            label="Payment Method"
                            name="payment_method"
                            initialValue="credit_card"
                          >
                            <Select>
                              <Option value="credit_card">Credit Card</Option>
                              <Option value="bank_transfer">Bank Transfer</Option>
                              <Option value="cash">Cash on Service</Option>
                              <Option value="invoice">Invoice (Corporate)</Option>
                              <Option value="gift_card">Gift Card</Option>
                            </Select>
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item
                            label="Payment Status"
                            name="payment_status"
                            initialValue="pending"
                          >
                            <Select>
                              <Option value="pending">Pending</Option>
                              <Option value="authorized">Authorized</Option>
                              <Option value="paid">Paid</Option>
                              <Option value="partially_paid">Partially Paid</Option>
                            </Select>
                          </Form.Item>
                        </Col>
                      </Row>

                      <Row gutter={[16, 16]}>
                        <Col span={12}>
                          <Form.Item
                            label="Initial Status"
                            name="initial_status"
                            initialValue="confirmed"
                          >
                            <Select>
                              <Option value="requested">Requested</Option>
                              <Option value="confirmed">Confirmed</Option>
                              <Option value="in_progress">In Progress</Option>
                              <Option value="completed">Completed</Option>
                            </Select>
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item
                            label="Priority Level"
                            name="priority_level"
                            initialValue="normal"
                          >
                            <Select>
                              <Option value="normal">Normal</Option>
                              <Option value="high">High</Option>
                              <Option value="urgent">Urgent</Option>
                            </Select>
                          </Form.Item>
                        </Col>
                      </Row>

                      <Form.Item
                        label="Billing Notes"
                        name="billing_notes"
                      >
                        <TextArea placeholder="Any special billing instructions or notes" rows={3} />
                      </Form.Item>
                    </div>
                  ),
                },
              ]}
            />
            
            {/* Save Actions */}
            <div style={{ 
              background: '#fafafa', 
              padding: 20, 
              borderTop: '1px solid #e8e8e8',
              display: 'flex',
              gap: 10,
              justifyContent: 'flex-end'
            }}>
              <Button onClick={() => list('bookings')}>
                Cancel
              </Button>
              <Button 
                type="primary" 
                icon={<PlusOutlined />}
                loading={saving}
                onClick={handleCreateBooking}
                disabled={!Object.values(validationStatus).every(Boolean)}
              >
                Create Booking
              </Button>
            </div>
          </Card>
        </Col>

        {/* Right Panel */}
        <Col span={8}>
          {/* Booking Preview */}
          <Card 
            title="Booking Preview" 
            style={{ marginBottom: 16 }}
            headStyle={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}
          >
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#1890ff', marginBottom: 5 }}>
                ${pricingBreakdown.total.toFixed(2)}
              </div>
              <div style={{ fontSize: 14, opacity: 0.8 }}>
                {form.getFieldValue('service_id') ? 
                  `${form.getFieldValue('duration_minutes') || 0} minutes • ${services.find(s => s.id === form.getFieldValue('service_id'))?.name || 'No service selected'}` : 
                  'Complete form to see preview'
                }
              </div>
            </div>
          </Card>

          {/* Validation Checklist */}
          <Card title="Validation Checklist" style={{ marginBottom: 16 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Customer Info:</span>
                <span style={{ color: validationStatus.customer ? '#52c41a' : '#ff4d4f' }}>
                  {validationStatus.customer ? '✅ Complete' : '❌ Incomplete'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Scheduling:</span>
                <span style={{ color: validationStatus.scheduling ? '#52c41a' : '#ff4d4f' }}>
                  {validationStatus.scheduling ? '✅ Complete' : '❌ Incomplete'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Service:</span>
                <span style={{ color: validationStatus.services ? '#52c41a' : '#ff4d4f' }}>
                  {validationStatus.services ? '✅ Complete' : '❌ Incomplete'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Billing:</span>
                <span style={{ color: validationStatus.billing ? '#52c41a' : '#ff4d4f' }}>
                  {validationStatus.billing ? '✅ Complete' : '❌ Incomplete'}
                </span>
              </div>
              <Divider />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                <span>Ready to Create:</span>
                <span style={{ color: Object.values(validationStatus).every(Boolean) ? '#52c41a' : '#ff4d4f' }}>
                  {Object.values(validationStatus).every(Boolean) ? '✅ Yes' : '❌ No'}
                </span>
              </div>
            </Space>
          </Card>

          {/* Quick Actions */}
          <Card title="Quick Actions" style={{ marginBottom: 16 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button 
                block 
                icon={<CalendarOutlined />}
                onClick={() => setActiveTab('scheduling')}
              >
                Check Availability
              </Button>
              <Button 
                block 
                icon={<UserOutlined />}
                onClick={() => setActiveTab('scheduling')}
              >
                Auto-Assign Therapist
              </Button>
              <Button 
                block 
                icon={<DollarOutlined />}
                onClick={() => setActiveTab('billing')}
              >
                Calculate Optimal Pricing
              </Button>
            </Space>
          </Card>

          {/* Recent Bookings Reference */}
          <Card title="Recent Similar Bookings">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>RB2510009:</span>
                <span>$150 - Deep Tissue</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>RB2510008:</span>
                <span>$120 - Sports Massage</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>RB2510007:</span>
                <span>$180 - Couples</span>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

