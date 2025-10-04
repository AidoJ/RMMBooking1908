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
  Timeline,
  Descriptions,
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
  SaveOutlined,
  ArrowLeftOutlined,
  ReloadOutlined,
  MessageOutlined,
  SwapOutlined,
  FileTextOutlined,
  CloseCircleOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import { useGetIdentity, useNavigation, useParams } from '@refinedev/core';
import { supabaseClient } from '../../utility';
import { UserIdentity, canAccess, isTherapist, isAdmin } from '../../utils/roleUtils';
import { RoleGuard } from '../../components/RoleGuard';
import dayjs, { Dayjs } from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;
const { Option } = Select;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

interface Booking {
  id: string;
  booking_id: string;
  customer_id: string;
  therapist_id?: string;
  service_id: string;
  booking_time: string;
  status: string;
  payment_status: string;
  price: number;
  therapist_fee: number;
  discount_amount?: number;
  gift_card_amount?: number;
  tax_rate_amount?: number;
  net_price?: number;
  address: string;
  business_name?: string;
  notes?: string;
  room_number?: string;
  gender_preference?: string;
  duration_minutes?: number;
  booking_type?: string;
  payment_intent_id?: string;
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
    quote_only?: boolean;
  };
}

interface StatusHistory {
  id: string;
  booking_id: string;
  status: string;
  changed_at: string;
  changed_by?: string;
  notes?: string;
  changed_by_name?: string;
}

interface BookingFormData {
  // Customer
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
}

export const AdminBookingEdit: React.FC = () => {
  const { data: identity } = useGetIdentity<UserIdentity>();
  const { list } = useNavigation();
  const { id } = useParams();
  
  const [form] = Form.useForm<BookingFormData>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  
  // Data states
  const [booking, setBooking] = useState<Booking | null>(null);
  const [statusHistory, setStatusHistory] = useState<StatusHistory[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [therapists, setTherapists] = useState<any[]>([]);
  
  // UI states
  const [pricingBreakdown, setPricingBreakdown] = useState({
    basePrice: 0,
    timeUplift: 0,
    weekendUplift: 0,
    subtotal: 0,
    discount: 0,
    gst: 0,
    total: 0,
  });

  const userRole = identity?.role;

  useEffect(() => {
    if (id && canAccess(userRole, 'canEditAllBookings')) {
      fetchBookingDetails();
      fetchSupportingData();
    }
  }, [id, identity]);

  useEffect(() => {
    // Watch form changes to update pricing
    updatePricing();
  }, [form.getFieldsValue()]);

  const fetchBookingDetails = async () => {
    setLoading(true);
    try {
      // Fetch booking with joined data
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

      // Transform the data
      const transformedBooking: Booking = {
        ...bookingData,
        customer_name: bookingData.customers 
          ? `${bookingData.customers.first_name || ''} ${bookingData.customers.last_name || ''}`.trim()
          : 'Unknown Customer',
        therapist_name: bookingData.therapist_profiles 
          ? `${bookingData.therapist_profiles.first_name || ''} ${bookingData.therapist_profiles.last_name || ''}`.trim()
          : 'Unassigned',
        service_name: bookingData.services?.name || 'Unknown Service',
        customer_details: bookingData.customers || null,
        therapist_details: bookingData.therapist_profiles || null,
        service_details: bookingData.services || null,
      };

      setBooking(transformedBooking);

      // Populate form
      const bookingDateTime = dayjs(transformedBooking.booking_time);
      form.setFieldsValue({
        first_name: transformedBooking.customer_details?.first_name || '',
        last_name: transformedBooking.customer_details?.last_name || '',
        email: transformedBooking.customer_details?.email || '',
        phone: transformedBooking.customer_details?.phone || '',
        business_name: transformedBooking.business_name || '',
        address: transformedBooking.address || '',
        room_number: transformedBooking.room_number || '',
        notes: transformedBooking.notes || '',
        booking_date: bookingDateTime,
        booking_time: bookingDateTime,
        duration_minutes: transformedBooking.duration_minutes || 60,
        therapist_id: transformedBooking.therapist_id || '',
        gender_preference: transformedBooking.gender_preference || 'any',
        service_id: transformedBooking.service_id || '',
        base_price: transformedBooking.service_details?.service_base_price || 0,
        payment_status: transformedBooking.payment_status || 'pending',
      });

      // Fetch status history
      const { data: historyData, error: historyError } = await supabaseClient
        .from('booking_status_history')
        .select('*')
        .eq('booking_id', id)
        .order('changed_at', { ascending: false });

      if (historyError) {
        console.warn('Status history not available:', historyError);
        setStatusHistory([]);
      } else {
        const transformedHistory = (historyData || []).map((item: any) => ({
          ...item,
          changed_by_name: item.changed_by || 'System',
        }));
        setStatusHistory(transformedHistory);
      }

    } catch (error) {
      console.error('Error fetching booking details:', error);
      message.error('Failed to load booking details');
    } finally {
      setLoading(false);
    }
  };

  const fetchSupportingData = async () => {
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

    } catch (error) {
      console.error('Error fetching supporting data:', error);
    }
  };

  const updatePricing = () => {
    const values = form.getFieldsValue();
    if (!values.service_id || !values.duration_minutes) {
      return;
    }

    const service = services.find(s => s.id === values.service_id);
    const basePrice = service?.service_base_price || booking?.service_details?.service_base_price || 0;
    
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

  const handleSaveChanges = async () => {
    if (!booking) return;

    setSaving(true);
    try {
      const values = await form.validateFields();
      
      // Combine date and time
      const bookingDateTime = values.booking_date
        .hour(values.booking_time.hour())
        .minute(values.booking_time.minute())
        .second(0)
        .millisecond(0)
        .toISOString();

      // Update booking
      const { error: bookingError } = await supabaseClient
        .from('bookings')
        .update({
          therapist_id: values.therapist_id,
          service_id: values.service_id,
          booking_time: bookingDateTime,
          duration_minutes: values.duration_minutes,
          gender_preference: values.gender_preference,
          business_name: values.business_name,
          room_number: values.room_number,
          notes: values.notes,
          payment_status: values.payment_status,
          price: pricingBreakdown.total,
          updated_at: new Date().toISOString(),
          updated_by: identity?.id,
        })
        .eq('id', booking.id);

      if (bookingError) throw bookingError;

      // Update customer details if needed
      if (booking.customer_id) {
        const { error: customerError } = await supabaseClient
          .from('customers')
          .update({
            first_name: values.first_name,
            last_name: values.last_name,
            email: values.email,
            phone: values.phone,
            business_name: values.business_name,
            address: values.address,
            notes: values.notes,
          })
          .eq('id', booking.customer_id);

        if (customerError) throw customerError;
      }

      message.success('Booking updated successfully');
      fetchBookingDetails();

    } catch (error) {
      console.error('Error saving changes:', error);
      message.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!booking) return;

    setUpdating(true);
    try {
      // Update booking status
      const { error: bookingError } = await supabaseClient
        .from('bookings')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString(),
          updated_by: identity?.id,
        })
        .eq('id', booking.id);

      if (bookingError) throw bookingError;

      // Add to status history
      const { error: historyError } = await supabaseClient
        .from('booking_status_history')
        .insert({
          booking_id: booking.id,
          status: newStatus,
          changed_by: identity?.id,
          notes: `Status changed to ${newStatus} by admin`,
        });

      if (historyError) throw historyError;

      message.success(`Booking status updated to ${newStatus}`);
      fetchBookingDetails();
    } catch (error) {
      console.error('Error updating booking status:', error);
      message.error('Failed to update booking status');
    } finally {
      setUpdating(false);
    }
  };

  const handlePaymentStatusChange = async (newPaymentStatus: string) => {
    if (!booking) return;

    setUpdating(true);
    try {
      const { error } = await supabaseClient
        .from('bookings')
        .update({ 
          payment_status: newPaymentStatus,
          updated_at: new Date().toISOString(),
          updated_by: identity?.id,
        })
        .eq('id', booking.id);

      if (error) throw error;

      message.success(`Payment status updated to ${newPaymentStatus}`);
      fetchBookingDetails();
    } catch (error) {
      console.error('Error updating payment status:', error);
      message.error('Failed to update payment status');
    } finally {
      setUpdating(false);
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
      authorized: 'blue',
      captured: 'green',
      paid: 'green',
      refunded: 'red',
      cancelled: 'red',
    };
    return colors[status] || 'default';
  };

  if (!canAccess(userRole, 'canEditAllBookings')) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Title level={3}>Access Denied</Title>
        <Text>You don't have permission to edit bookings.</Text>
      </div>
    );
  }

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
          description="The booking you're looking for doesn't exist or has been deleted."
          type="error"
          showIcon
        />
      </div>
    );
  }

  const isQuote = booking.service_details?.quote_only || booking.booking_type === 'quote';

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
              <Title level={3} style={{ margin: 0 }}>
                {isQuote ? 'Edit Quote Request' : 'Edit Booking'} #{booking.booking_id}
              </Title>
              <Space>
                <Tag color={getStatusColor(booking.status)}>
                  {booking.status.replace('_', ' ').toUpperCase()}
                </Tag>
                {!isQuote && (
                  <Tag color={getPaymentStatusColor(booking.payment_status)}>
                    {booking.payment_status.toUpperCase()}
                  </Tag>
                )}
                {isQuote && (
                  <Tag color="purple">QUOTE REQUEST</Tag>
                )}
              </Space>
            </div>
          </Space>
        </Col>
        <Col span={12} style={{ textAlign: 'right' }}>
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchBookingDetails}
              loading={loading}
            >
              Refresh
            </Button>
            <Button
              type="primary"
              icon={<MessageOutlined />}
              onClick={() => message.info('Email functionality coming soon')}
            >
              Send Email
            </Button>
            <Button
              type="primary"
              icon={<MessageOutlined />}
              onClick={() => message.info('SMS functionality coming soon')}
            >
              Send SMS
            </Button>
          </Space>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* Main Content */}
        <Col span={16}>
          <Card>
            <Alert
              message="Safe Editing"
              description="Changes are saved automatically. Use action buttons on the right for status and payment changes."
              type="info"
              showIcon
              style={{ marginBottom: 24 }}
            />

            <Tabs 
              activeKey={activeTab} 
              onChange={setActiveTab}
              items={[
                {
                  key: 'details',
                  label: '📋 Details',
                  children: (
                    <div>
                      <Row gutter={[16, 16]}>
                        <Col span={12}>
                          <Form.Item
                            label="Full Name"
                            name="first_name"
                          >
                            <Input placeholder="Customer name" />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item
                            label="Email"
                            name="email"
                          >
                            <Input placeholder="Email address" />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Row gutter={[16, 16]}>
                        <Col span={12}>
                          <Form.Item
                            label="Phone"
                            name="phone"
                          >
                            <Input placeholder="Phone number" />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item
                            label="Business Name"
                            name="business_name"
                          >
                            <Input placeholder="Business name (optional)" />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Form.Item
                        label="Address"
                        name="address"
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
                            label="Date"
                            name="booking_date"
                          >
                            <DatePicker style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item
                            label="Start Time"
                            name="booking_time"
                          >
                            <TimePicker style={{ width: '100%' }} format="HH:mm" />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Row gutter={[16, 16]}>
                        <Col span={12}>
                          <Form.Item
                            label="Duration"
                            name="duration_minutes"
                          >
                            <Select>
                              <Option value={60}>60 minutes</Option>
                              <Option value={90}>90 minutes</Option>
                              <Option value={120}>120 minutes</Option>
                              <Option value={180}>180 minutes</Option>
                            </Select>
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item
                            label="End Time"
                            name="end_time"
                          >
                            <Input 
                              value={form.getFieldValue('booking_time') && form.getFieldValue('duration_minutes') ? 
                                dayjs(form.getFieldValue('booking_time'))
                                  .add(form.getFieldValue('duration_minutes'), 'minutes')
                                  .format('HH:mm') : ''
                              }
                              readOnly 
                            />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Form.Item
                        label="Assigned Therapist"
                        name="therapist_id"
                      >
                        <Select placeholder="Select therapist...">
                          <Option value="">Unassigned</Option>
                          {therapists.map(therapist => (
                            <Option key={therapist.id} value={therapist.id}>
                              {therapist.first_name} {therapist.last_name}
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>

                      <Row gutter={[16, 16]}>
                        <Col span={12}>
                          <Form.Item
                            label="Gender Preference"
                            name="gender_preference"
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
                        label="Service Type"
                        name="service_id"
                      >
                        <Select placeholder="Select service...">
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
                            label="Base Price"
                            name="base_price"
                          >
                            <InputNumber 
                              style={{ width: '100%' }}
                              formatter={value => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                              parser={value => value!.replace(/\$\s?|(,*)/g, '')}
                            />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item
                            label="Uplift %"
                            name="time_uplift_percent"
                            initialValue={0}
                          >
                            <InputNumber 
                              style={{ width: '100%' }}
                              min={0}
                              max={100}
                              formatter={value => `${value}%`}
                              parser={value => value!.replace('%', '')}
                            />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Form.Item
                        label="Equipment Required"
                        name="equipment_required"
                      >
                        <TextArea placeholder="List any special equipment needed" rows={3} />
                      </Form.Item>

                      <Row gutter={[16, 16]}>
                        <Col span={12}>
                          <Form.Item
                            label="Setup Time"
                            name="setup_time"
                            initialValue={15}
                          >
                            <InputNumber min={0} style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item
                            label="Cleanup Time"
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
                  key: 'communication',
                  label: '💬 Communication',
                  children: (
                    <div>
                      <Card title="Communication History" style={{ marginBottom: 24 }}>
                        <Space direction="vertical" style={{ width: '100%' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Last Email Sent:</span>
                            <span>Jan 10, 2025 - Booking Confirmation</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Last SMS Sent:</span>
                            <span>Jan 10, 2025 - Reminder</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Customer Response:</span>
                            <span>Confirmed via email</span>
                          </div>
                        </Space>
                      </Card>

                      <Card title="Quick Communication">
                        <Form.Item
                          label="Message Template"
                          name="message_template"
                        >
                          <Select placeholder="Select template...">
                            <Option value="reminder">Booking Reminder</Option>
                            <Option value="confirmation">Booking Confirmation</Option>
                            <Option value="reschedule">Reschedule Request</Option>
                            <Option value="cancellation">Cancellation Notice</Option>
                          </Select>
                        </Form.Item>

                        <Form.Item
                          label="Custom Message"
                          name="custom_message"
                        >
                          <TextArea placeholder="Type your message here..." rows={4} />
                        </Form.Item>

                        <Space>
                          <Button 
                            type="primary" 
                            icon={<MessageOutlined />}
                            onClick={() => message.info('Email functionality coming soon')}
                          >
                            Send Email
                          </Button>
                          <Button 
                            type="primary" 
                            icon={<MessageOutlined />}
                            onClick={() => message.info('SMS functionality coming soon')}
                          >
                            Send SMS
                          </Button>
                        </Space>
                      </Card>
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
                Cancel Changes
              </Button>
              <Button 
                type="primary" 
                icon={<SaveOutlined />}
                loading={saving}
                onClick={handleSaveChanges}
              >
                Save All Changes
              </Button>
            </div>
          </Card>
        </Col>

        {/* Right Panel */}
        <Col span={8}>
          {/* Financial Summary */}
          <Card 
            title="Financial Summary" 
            style={{ marginBottom: 16 }}
            headStyle={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}
          >
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'white', marginBottom: 5 }}>
                ${booking.price?.toFixed(2) || '0.00'}
              </div>
              <div style={{ fontSize: 14, opacity: 0.9 }}>
                {booking.therapist_fee ? 
                  `Therapist Fee: $${booking.therapist_fee.toFixed(2)}` : 
                  'Base pricing'
                }
              </div>
            </div>
          </Card>

          {/* Quick Actions */}
          <Card title="Quick Actions" style={{ marginBottom: 16 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button 
                block 
                icon={<CheckCircleOutlined />}
                onClick={() => handleStatusChange('confirmed')}
                disabled={booking.status === 'confirmed' || booking.status === 'completed'}
                loading={updating}
              >
                Confirm Booking
              </Button>
              <Button 
                block 
                icon={<DollarOutlined />}
                onClick={() => handlePaymentStatusChange('paid')}
                disabled={booking.payment_status === 'paid'}
                loading={updating}
              >
                Mark as Paid
              </Button>
              <Button 
                block 
                icon={<CalendarOutlined />}
                onClick={() => message.info('Reschedule functionality coming soon')}
              >
                Reschedule
              </Button>
              <Button 
                block 
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => handleStatusChange('cancelled')}
                disabled={booking.status === 'cancelled' || booking.status === 'completed'}
                loading={updating}
              >
                Cancel Booking
              </Button>
            </Space>
          </Card>

          {/* Status Management */}
          <Card title="Status Management" style={{ marginBottom: 16 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button 
                block 
                icon={<CheckCircleOutlined />}
                onClick={() => handleStatusChange('completed')}
                disabled={booking.status === 'completed'}
                loading={updating}
                style={{ backgroundColor: '#52c41a', borderColor: '#52c41a', color: 'white' }}
              >
                Complete Job
              </Button>
              <Button 
                block 
                icon={<ClockCircleOutlined />}
                onClick={() => handleStatusChange('in_progress')}
                disabled={booking.status === 'in_progress'}
                loading={updating}
              >
                In Progress
              </Button>
              <Button 
                block 
                icon={<ExclamationCircleOutlined />}
                onClick={() => handleStatusChange('on_hold')}
                disabled={booking.status === 'on_hold'}
                loading={updating}
                style={{ backgroundColor: '#fa8c16', borderColor: '#fa8c16', color: 'white' }}
              >
                On Hold
              </Button>
              {isQuote && (
                <Button 
                  block 
                  icon={<SwapOutlined />}
                  onClick={() => handleStatusChange('confirmed')}
                  disabled={booking.status === 'confirmed'}
                  loading={updating}
                  style={{ backgroundColor: '#722ed1', borderColor: '#722ed1', color: 'white' }}
                >
                  Convert to Quote
                </Button>
              )}
            </Space>
          </Card>

          {/* Payment Actions */}
          {!isQuote && (
            <Card title="Payment Actions" style={{ marginBottom: 16 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Button 
                  block 
                  icon={<DollarOutlined />}
                  onClick={() => handlePaymentStatusChange('authorized')}
                  disabled={booking.payment_status === 'authorized' || booking.payment_status === 'paid'}
                  loading={updating}
                >
                  Authorize Payment
                </Button>
                <Button 
                  block 
                  icon={<CheckCircleOutlined />}
                  onClick={() => handlePaymentStatusChange('paid')}
                  disabled={booking.payment_status === 'paid'}
                  loading={updating}
                  style={{ backgroundColor: '#52c41a', borderColor: '#52c41a', color: 'white' }}
                >
                  Mark as Paid
                </Button>
                <Button 
                  block 
                  icon={<ExclamationCircleOutlined />}
                  onClick={() => handlePaymentStatusChange('refunded')}
                  disabled={booking.payment_status === 'refunded'}
                  loading={updating}
                  style={{ backgroundColor: '#fa8c16', borderColor: '#fa8c16', color: 'white' }}
                >
                  Refund
                </Button>
                <Button 
                  block 
                  icon={<FileTextOutlined />}
                  onClick={() => message.info('Invoice generation coming soon')}
                >
                  Generate Invoice
                </Button>
              </Space>
            </Card>
          )}

          {/* Booking Information */}
          <Card title="Booking Info" style={{ marginBottom: 16 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Created:</span>
                <span>{dayjs(booking.created_at).format('MMM DD, YYYY')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Last Updated:</span>
                <span>{dayjs(booking.updated_at).format('MMM DD, YYYY')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Source:</span>
                <span>Website Booking</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Priority:</span>
                <span>Normal</span>
              </div>
            </Space>
          </Card>

          {/* Status History */}
          <Card title="Status History">
            <Timeline size="small">
              {statusHistory.map((item, index) => (
                <Timeline.Item
                  key={item.id}
                  color={getStatusColor(item.status)}
                  dot={index === 0 ? <CheckCircleOutlined /> : undefined}
                >
                  <Space direction="vertical" size="small">
                    <Text strong>
                      {item.status.replace('_', ' ').toUpperCase()}
                    </Text>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {dayjs(item.changed_at).format('MMM DD, YYYY HH:mm')}
                    </Text>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      by {item.changed_by_name}
                    </Text>
                    {item.notes && (
                      <Text style={{ fontSize: '12px' }}>
                        {item.notes}
                      </Text>
                    )}
                  </Space>
                </Timeline.Item>
              ))}
              {statusHistory.length === 0 && (
                <Text type="secondary">No status changes recorded</Text>
              )}
            </Timeline>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

