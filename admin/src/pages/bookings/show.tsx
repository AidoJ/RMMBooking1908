import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Typography,
  Tag,
  Button,
  Space,
  Descriptions,
  Divider,
  Timeline,
  Modal,
  message,
  Tooltip,
  Avatar,
  Badge,
  Statistic,
  Alert,
  Input,
} from 'antd';
import {
  UserOutlined,
  PhoneOutlined,
  MailOutlined,
  EnvironmentOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  HistoryOutlined,
  MoreOutlined,
  ArrowLeftOutlined,
  ReloadOutlined,
  PhoneOutlined as PhoneIcon,
  MessageOutlined,
  SwapOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { useGetIdentity, useNavigation, useShow } from '@refinedev/core';
import { supabaseClient } from '../../utility';
import { UserIdentity, canAccess, isTherapist, isAdmin } from '../../utils/roleUtils';
import { RoleGuard } from '../../components/RoleGuard';
import dayjs, { Dayjs } from 'dayjs';

const { Title, Text, Paragraph } = Typography;

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
  // New pricing fields
  discount_amount?: number;
  gift_card_amount?: number;
  tax_rate_amount?: number;
  net_price?: number;
  discount_code?: string;
  gift_card_code?: string;
  service_acknowledgement?: boolean;
  terms_acceptance?: boolean;
  // Existing fields
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
  therapist_response_time?: string;
  responding_therapist_id?: string;
  payment_intent_id?: string;
  created_at: string;
  updated_at: string;
  booking_type?: string;
  
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

interface BookingShowProps {
  id: string;
}

export const BookingShow: React.FC<BookingShowProps> = ({ id }) => {
  const { data: identity } = useGetIdentity<UserIdentity>();
  const { edit, list } = useNavigation();
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [statusHistory, setStatusHistory] = useState<StatusHistory[]>([]);
  const [updating, setUpdating] = useState(false);

  const userRole = identity?.role;

  // Quote detection helper
  const isQuote = (booking: Booking) => {
    return booking.service_details?.quote_only || booking.booking_type === 'quote';
  };

  useEffect(() => {
    if (id) {
      fetchBookingDetails();
    }
  }, [id]);

  const fetchBookingDetails = async () => {
    setLoading(true);
    try {
      // Fetch booking with joined data (using left joins to be more forgiving)
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

      // Transform the data (with null checks)
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

      // Fetch status history (without admin_users join since relationship doesn't exist)
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

  // Quote conversion handler
  const handleConvertToBooking = async () => {
    if (!booking) return;

    setUpdating(true);
    try {
      const { error } = await supabaseClient
        .from('bookings')
        .update({ 
          booking_type: 'booking',
          status: 'confirmed',
          updated_at: new Date().toISOString() 
        })
        .eq('id', booking.id);

      if (error) throw error;

      // Add to status history
      const { error: historyError } = await supabaseClient
        .from('booking_status_history')
        .insert({
          booking_id: booking.id,
          status: 'confirmed',
          changed_by: identity?.id,
          notes: 'Quote converted to confirmed booking',
        });

      if (historyError) throw historyError;

      message.success('Quote converted to confirmed booking');
      fetchBookingDetails();
    } catch (error) {
      console.error('Error converting quote to booking:', error);
      message.error('Failed to convert quote to booking');
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

  const handleStatusChange = async (newStatus: string) => {
    if (!booking) return;

    setUpdating(true);
    try {
      // Update booking status
      const { error: bookingError } = await supabaseClient
        .from('bookings')
        .update({ status: newStatus })
        .eq('id', booking.id);

      if (bookingError) throw bookingError;

      // Add to status history
      const { error: historyError } = await supabaseClient
        .from('booking_status_history')
        .insert({
          booking_id: booking.id,
          status: newStatus,
          changed_by: identity?.id,
          notes: `Status changed to ${newStatus}`,
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
        .update({ payment_status: newPaymentStatus })
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

  const handleCompleteJob = async () => {
    if (!booking) {
      message.error('Cannot complete job: No booking data found');
      return;
    }

    // Check if job can be completed based on booking type
    const isQuoteBooking = isQuote(booking);
    const canComplete = booking.payment_status === 'authorized' || 
                       (isQuoteBooking && booking.status === 'invoiced');

    if (!canComplete) {
      if (isQuoteBooking) {
        message.error('Cannot complete quote job: Must be invoiced first');
      } else {
        message.error('Cannot complete job: No payment authorization found');
      }
      return;
    }

    setUpdating(true);
    try {
      if (booking.payment_intent_id) {
        // Call our secure backend to capture payment via Stripe
        const response = await fetch('/.netlify/functions/capture-payment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            payment_intent_id: booking.payment_intent_id,
            booking_id: booking.booking_id,
            completed_by: identity?.id || 'unknown'
          })
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Payment capture failed');
        }

        message.success('Job completed and payment captured successfully!');
      } else if (booking.payment_status === 'authorized') {
        // Manual authorization - just mark as completed and paid
        const { error: bookingError } = await supabaseClient
          .from('bookings')
          .update({ 
            status: 'completed',
            payment_status: 'paid',
            completed_at: new Date().toISOString(),
            completed_by: identity?.id || 'unknown',
            updated_at: new Date().toISOString()
          })
          .eq('id', booking.id);

        if (bookingError) throw bookingError;

        // Add to status history
        const { error: historyError } = await supabaseClient
          .from('booking_status_history')
          .insert({
            booking_id: booking.id,
            status: 'completed',
            changed_by: identity?.id,
            changed_at: new Date().toISOString(),
            notes: `Job completed manually by ${identity?.email || 'unknown'}`,
          });

        if (historyError) throw historyError;

        message.success('Job completed successfully!');
      }
      
      fetchBookingDetails();
    } catch (error) {
      console.error('Error completing job:', error);
      message.error(`Failed to complete job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setUpdating(false);
    }
  };

  // Handle job failure with reason modal
  const handleFailureModal = () => {
    let failureReason = '';

    Modal.confirm({
      title: 'Unable to Complete Booking',
      content: (
        <div style={{ margin: '16px 0' }}>
          <Text style={{ marginBottom: 8, display: 'block' }}>
            Please provide the reason why this booking could not be completed:
          </Text>
          <Input.TextArea
            placeholder="e.g., Car breakdown, Emergency, Client unavailable, etc."
            onChange={(e) => { failureReason = e.target.value; }}
            rows={3}
            style={{ marginTop: 8 }}
          />
        </div>
      ),
      okText: 'Cancel Booking & Release Payment',
      cancelText: 'Go Back',
      okType: 'danger',
      onOk: async () => {
        if (!failureReason.trim()) {
          message.error('Please provide a reason for the failure');
          return Promise.reject();
        }
        return handleJobFailure(failureReason.trim());
      },
    });
  };

  // Job failure with payment release and notifications
  const handleJobFailure = async (reason: string) => {
    if (!booking) return;

    setUpdating(true);
    try {
      // Release payment authorization
      if (booking.payment_intent_id) {
        const response = await fetch('/.netlify/functions/cancel-payment-authorization', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            payment_intent_id: booking.payment_intent_id,
            booking_id: booking.booking_id || booking.id,
            cancelled_by: identity?.id || 'unknown',
            reason: `Job failed to complete: ${reason}`
          })
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || 'Payment release failed');
        }
      } else {
        // If no payment intent, just update status
        const { error } = await supabaseClient
          .from('bookings')
          .update({ 
            status: 'failed',
            failure_reason: reason,
            updated_at: new Date().toISOString() 
          })
          .eq('id', booking.id);

        if (error) throw error;
      }

      message.success('Booking marked as failed and payment released');
      fetchBookingDetails();

      // TODO: Send professional apology email to client and notification to admin

    } catch (error) {
      console.error('Error handling job failure:', error);
      message.error(`Failed to process failure: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setUpdating(false);
    }
  };

  const handleCancelBooking = async (reason: string) => {
    if (!booking || !booking.payment_intent_id) {
      message.error('Cannot cancel booking: No payment authorization found');
      return;
    }

    setUpdating(true);
    try {
      // Call our secure backend to release payment authorization
      const response = await fetch('/.netlify/functions/cancel-payment-authorization', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payment_intent_id: booking.payment_intent_id,
          booking_id: booking.booking_id,
          cancelled_by: identity?.id || 'unknown',
          reason: reason || 'Cancelled by admin'
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Cancellation failed');
      }

      message.success('Booking cancelled and payment authorization released');
      fetchBookingDetails();
    } catch (error) {
      console.error('Error cancelling booking:', error);
      message.error(`Failed to cancel booking: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setUpdating(false);
    }
  };


  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <div>Loading booking details...</div>
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

  // Check if user can access this specific booking
  const canAccessBooking = () => {
    if (!userRole || !identity) return false;
    
    // Admins and super admins can view all bookings
    if (canAccess(userRole, 'canViewAllBookings')) {
      return true;
    }
    
    // Therapists and customers can view their own bookings
    if (canAccess(userRole, 'canViewOwnBookings')) {
      // For now, allow access - we'll add specific ownership checks later
      return true;
    }
    
    return false;
  };

  if (!canAccessBooking()) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Title level={3}>Access Denied</Title>
        <Text>You don't have permission to access this page.</Text>
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
              <Space>
                <Title level={3} style={{ margin: 0 }}>
                  {isQuote(booking) ? 'Quote Request' : 'Booking'} #{booking.booking_id || booking.id.slice(0, 8)}
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
                onClick={fetchBookingDetails}
                loading={loading}
              >
                Refresh
              </Button>
            </Space>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          {/* Main Booking Information */}
          <Col span={16}>
            <Card title={isQuote(booking) ? "Quote Request Details" : "Booking Details"} style={{ marginBottom: 16 }}>
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Statistic
                    title="Status"
                    value={booking.status.replace('_', ' ').toUpperCase()}
                    valueStyle={{ color: getStatusColor(booking.status) }}
                    prefix={
                      <Tag color={getStatusColor(booking.status)}>
                        {booking.status.replace('_', ' ').toUpperCase()}
                      </Tag>
                    }
                  />
                </Col>
                {!isQuote(booking) && (
                  <Col span={12}>
                    <Statistic
                      title="Payment Status"
                      value={booking.payment_status.toUpperCase()}
                      valueStyle={{ color: getPaymentStatusColor(booking.payment_status) }}
                      prefix={
                        <Tag color={getPaymentStatusColor(booking.payment_status)}>
                          {booking.payment_status.toUpperCase()}
                        </Tag>
                      }
                    />
                  </Col>
                )}
              </Row>

              <Divider />

              <Descriptions column={2} size="small">
                <Descriptions.Item label="Service">
                  <Text strong>{booking.service_name}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Duration">
                  <Text>{booking.duration_minutes || booking.service_details?.minimum_duration || 60} minutes</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Date">
                  <Text>{dayjs(booking.booking_time).format('dddd, MMMM DD, YYYY')}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Time">
                  <Text>{dayjs(booking.booking_time).format('HH:mm')}</Text>
                </Descriptions.Item>
                {!isTherapist(userRole) && !isQuote(booking) && (
                  <Descriptions.Item label="Price">
                    {/* Enhanced pricing display for admins */}
                    {!isTherapist(userRole) && ((booking.discount_amount && booking.discount_amount > 0) || (booking.gift_card_amount && booking.gift_card_amount > 0)) && booking.net_price ? (
                      <div>
                        <Text strong style={{ color: '#52c41a', fontSize: '16px' }}>
                          ${booking.net_price.toFixed(2)}
                        </Text>
                        <div style={{ marginTop: '8px', fontSize: '12px' }}>
                          <div>Subtotal: ${booking.price.toFixed(2)}</div>
                          {booking.discount_amount && booking.discount_amount > 0 && (
                            <div style={{ color: '#52c41a' }}>
                              Discount ({booking.discount_code}): -${booking.discount_amount.toFixed(2)}
                            </div>
                          )}
                          {booking.gift_card_amount && booking.gift_card_amount > 0 && (
                            <div style={{ color: '#1890ff' }}>
                              Gift Card ({booking.gift_card_code}): -${booking.gift_card_amount.toFixed(2)}
                            </div>
                          )}
                          {booking.tax_rate_amount && booking.tax_rate_amount > 0 && (
                            <div>GST (10%): ${booking.tax_rate_amount.toFixed(2)}</div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <Text strong style={{ color: '#52c41a' }}>
                        ${booking.price ? booking.price.toFixed(2) : '0.00'}
                      </Text>
                    )}
                  </Descriptions.Item>
                )}
                {isQuote(booking) && (
                  <Descriptions.Item label="Estimated Price">
                    <Text style={{ color: '#fa8c16' }}>
                      ${booking.price ? booking.price.toFixed(2) : 'TBD'}
                    </Text>
                  </Descriptions.Item>
                )}
                {!isQuote(booking) && (
                  <Descriptions.Item label="Therapist Fee">
                    <Text>${booking.therapist_fee ? booking.therapist_fee.toFixed(2) : '0.00'}</Text>
                  </Descriptions.Item>
                )}
                {!isTherapist(userRole) && !isQuote(booking) && booking.payment_intent_id && (
                  <Descriptions.Item label="Payment Authorization" span={2}>
                    <Text code>{booking.payment_intent_id}</Text>
                    <Text type="secondary" style={{ marginLeft: 8 }}>
                      {booking.payment_status === 'authorized' ? '(Funds held - not charged)' : 
                       booking.payment_status === 'paid' ? '(Payment completed)' : 
                       booking.payment_status === 'cancelled' ? '(Authorization released)' : ''}
                    </Text>
                  </Descriptions.Item>
                )}
                <Descriptions.Item label="Address" span={2}>
                  <Text>{booking.address || 'No address provided'}</Text>
                </Descriptions.Item>
                {booking.business_name && (
                  <Descriptions.Item label="Hotel/Business Name" span={2}>
                    <Text strong>{booking.business_name}</Text>
                  </Descriptions.Item>
                )}
                {booking.notes && (
                  <Descriptions.Item label="Notes" span={2}>
                    <Text>{booking.notes}</Text>
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>

            {/* Customer Information */}
            <Card title="Customer Information" style={{ marginBottom: 16 }}>
              <Row gutter={[16, 16]} align="middle">
                <Col span={4}>
                  <Avatar size={64} icon={<UserOutlined />} />
                </Col>
                <Col span={20}>
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="Name">
                      <Text strong>{booking.customer_name}</Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="Email">
                      <Space>
                        <MailOutlined />
                        <Text>{booking.customer_email}</Text>
                      </Space>
                    </Descriptions.Item>
                    <Descriptions.Item label="Phone">
                      <Space>
                        <PhoneOutlined />
                        <Text>{booking.customer_phone || 'No phone provided'}</Text>
                      </Space>
                    </Descriptions.Item>
                    {booking.customer_details?.address && (
                      <Descriptions.Item label="Address">
                        <Space>
                          <EnvironmentOutlined />
                          <Text>{booking.customer_details.address}</Text>
                        </Space>
                      </Descriptions.Item>
                    )}
                  </Descriptions>
                </Col>
              </Row>
            </Card>

            {/* Therapist Information - Only show to non-therapists */}
            {!isTherapist(userRole) && (
              <Card title="Therapist Information" style={{ marginBottom: 16 }}>
                <Row gutter={[16, 16]} align="middle">
                  <Col span={4}>
                    <Avatar 
                      size={64} 
                      src={booking.therapist_details?.profile_pic}
                      icon={<UserOutlined />} 
                    />
                  </Col>
                  <Col span={20}>
                    <Descriptions column={1} size="small">
                      <Descriptions.Item label="Name">
                        <Text strong>{booking.therapist_name}</Text>
                      </Descriptions.Item>
                      <Descriptions.Item label="Email">
                        <Space>
                          <MailOutlined />
                          <Text>{booking.therapist_details?.email}</Text>
                        </Space>
                      </Descriptions.Item>
                      <Descriptions.Item label="Phone">
                        <Space>
                          <PhoneOutlined />
                          <Text>{booking.therapist_details?.phone || 'No phone provided'}</Text>
                        </Space>
                      </Descriptions.Item>
                      {booking.therapist_details?.bio && (
                        <Descriptions.Item label="Bio">
                          <Text>{booking.therapist_details.bio}</Text>
                        </Descriptions.Item>
                      )}
                    </Descriptions>
                  </Col>
                </Row>
              </Card>
            )}
          </Col>

          {/* Sidebar Actions and History */}
          <Col span={8}>
            {/* Quick Actions */}
            <Card title={isQuote(booking) ? "Quote Actions" : "Quick Actions"} style={{ marginBottom: 16 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                
                {/* Quote-specific actions */}
                {isQuote(booking) && (
                  <>
                    <Button
                      type="primary"
                      icon={<FileTextOutlined />}
                      onClick={() => {
                        // TODO: Implement quote PDF generation
                        message.info('Quote PDF generation coming soon');
                      }}
                      loading={updating}
                      block
                      style={{ backgroundColor: '#722ed1', borderColor: '#722ed1' }}
                    >
                      Generate Quote PDF
                    </Button>
                    {booking.status === 'requested' && (
                      <Button
                        type="primary"
                        icon={<SwapOutlined />}
                        onClick={handleConvertToBooking}
                        loading={updating}
                        block
                        style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                      >
                        Convert to Confirmed Booking
                      </Button>
                    )}
                  </>
                )}

                {/* Regular booking actions */}
                {!isQuote(booking) && (
                  <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    onClick={() => handleStatusChange('confirmed')}
                    disabled={booking.status === 'confirmed' || booking.status === 'completed'}
                    loading={updating}
                    block
                  >
                    Confirm Booking
                  </Button>
                )}
                
                {/* Job Completion Buttons - Show for confirmed bookings */}
                {booking.status === 'confirmed' && (
                  <>
                    <Button
                      type="primary"
                      icon={<CheckCircleOutlined />}
                      onClick={handleCompleteJob}
                      loading={updating}
                      style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                      block
                    >
                      Complete Job
                    </Button>
                    <Button
                      danger
                      icon={<ExclamationCircleOutlined />}
                      onClick={handleFailureModal}
                      loading={updating}
                      block
                    >
                      Unable to Complete
                    </Button>
                  </>
                )}
                
{canAccess(userRole, 'canEditAllBookings') && (
                  <Button
                    icon={<CheckCircleOutlined />}
                    onClick={() => handleStatusChange('completed')}
                    disabled={booking.status === 'completed' || booking.payment_status === 'authorized'}
                    loading={updating}
                    block
                  >
                    Mark Complete (No Payment)
                  </Button>
                )}
                
{/* Enhanced Cancel with Payment Release */}
                {canAccess(userRole, 'canEditAllBookings') && (
                  <Button
                    danger
                    icon={<CloseCircleOutlined />}
                    onClick={() => {
                      if (booking.payment_intent_id) {
                        handleCancelBooking('Cancelled by admin');
                      } else {
                        handleStatusChange('cancelled');
                      }
                    }}
                    disabled={booking.status === 'cancelled' || booking.status === 'completed'}
                    loading={updating}
                    block
                  >
                    {booking.payment_intent_id ? 'Cancel & Release Payment' : 'Cancel Booking'}
                  </Button>
                )}
                
              </Space>
            </Card>

            {/* Payment Actions - Only show to non-therapists and non-quotes */}
            {!isTherapist(userRole) && !isQuote(booking) && (
              <Card title="Payment Status" style={{ marginBottom: 16 }}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    onClick={() => handlePaymentStatusChange('authorized')}
                    disabled={booking.payment_status === 'authorized' || booking.payment_status === 'paid'}
                    loading={updating}
                    block
                    style={{ backgroundColor: '#1890ff', borderColor: '#1890ff' }}
                  >
                    Mark as Authorized
                  </Button>
                  <Button
                    type="primary"
                    onClick={() => handlePaymentStatusChange('paid')}
                    disabled={booking.payment_status === 'paid'}
                    loading={updating}
                    block
                    style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                  >
                    Mark as Paid
                  </Button>
                  <Button
                    onClick={() => handlePaymentStatusChange('pending')}
                    disabled={booking.payment_status === 'pending' || booking.payment_status === 'paid'}
                    loading={updating}
                    block
                  >
                    Mark as Pending
                  </Button>
                  <Button
                    danger
                    onClick={() => handlePaymentStatusChange('refunded')}
                    disabled={booking.payment_status === 'refunded'}
                    loading={updating}
                    block
                  >
                    Mark as Refunded
                  </Button>
                </Space>
              </Card>
            )}

            {/* Status History */}
            <Card title="Status History">
              <Timeline>
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