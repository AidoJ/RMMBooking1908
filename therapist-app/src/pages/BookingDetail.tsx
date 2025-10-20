import React, { useState, useEffect } from 'react';
import {
  Card,
  Descriptions,
  Button,
  Typography,
  Space,
  Tag,
  Spin,
  Row,
  Col,
  Input,
  App,
} from 'antd';
import {
  ArrowLeftOutlined,
  EnvironmentOutlined,
  ClockCircleOutlined,
  UserOutlined,
  PhoneOutlined,
  MailOutlined,
  CarOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { supabaseClient } from '../utility/supabaseClient';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

export const BookingDetail: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { modal, message } = App.useApp();
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [booking, setBooking] = useState<any>(null);

  useEffect(() => {
    if (id) {
      loadBookingDetail();
    }
  }, [id]);

  const loadBookingDetail = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabaseClient
        .from('bookings')
        .select(`
          *,
          services(name, description),
          customers(first_name, last_name, email, phone)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      // Process booking data
      const bookingData = {
        ...data,
        customer_name: data.customers
          ? `${data.customers.first_name} ${data.customers.last_name}`
          : data.booker_name || `${data.first_name || ''} ${data.last_name || ''}`.trim() || 'Guest',
        customer_email: data.customers?.email || data.customer_email,
        customer_phone: data.customers?.phone || data.customer_phone,
        service_name: data.services?.name || 'Unknown Service',
        service_description: data.services?.description,
      };

      setBooking(bookingData);
    } catch (error) {
      console.error('Error loading booking:', error);
      message.error('Failed to load booking details');
    } finally {
      setLoading(false);
    }
  };

  const handleOnMyWay = () => {
    modal.confirm({
      title: 'On My Way',
      icon: <ExclamationCircleOutlined />,
      content: 'Please confirm you\'re on your way to this booking.',
      okText: 'Confirm',
      cancelText: 'Cancel',
      onOk: async () => {
        await updateClientStatus('on_my_way');
      },
    });
  };

  const handleArrived = () => {
    modal.confirm({
      title: 'I\'ve Arrived',
      icon: <ExclamationCircleOutlined />,
      content: 'Please confirm you have arrived at the location.',
      okText: 'Confirm',
      cancelText: 'Cancel',
      onOk: async () => {
        await updateClientStatus('arrived');
      },
    });
  };

  const handleCompleteJob = () => {
    modal.confirm({
      title: 'Complete Job',
      icon: <ExclamationCircleOutlined />,
      content: 'Please confirm job is now completed.',
      okText: 'Confirm',
      cancelText: 'Cancel',
      onOk: async () => {
        await updateBookingStatus('completed');
      },
    });
  };

  const handleCancelBooking = () => {
    let reasonText = '';

    modal.confirm({
      title: 'Cancel Booking',
      icon: <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
      content: (
        <div>
          <Text>Please provide a reason for cancellation:</Text>
          <TextArea
            rows={4}
            placeholder="Enter cancellation reason..."
            onChange={(e) => {
              reasonText = e.target.value;
            }}
            style={{ marginTop: 12 }}
          />
        </div>
      ),
      okText: 'Cancel Booking',
      okType: 'danger',
      cancelText: 'Go Back',
      onOk: async () => {
        if (!reasonText.trim()) {
          message.error('Cancellation reason is required');
          return Promise.reject();
        }
        await updateBookingStatus('cancelled', reasonText);
      },
    });
  };

  const handleAcceptBooking = () => {
    modal.confirm({
      title: 'Accept Booking',
      icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
      content: 'Are you sure you want to accept this booking? The client will be notified immediately.',
      okText: 'Yes, Accept',
      okType: 'primary',
      cancelText: 'Cancel',
      onOk: async () => {
        await acceptBooking();
      },
    });
  };

  const handleDeclineBooking = () => {
    modal.confirm({
      title: 'Decline Booking',
      icon: <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
      content: 'Are you sure you want to decline this booking? We will look for alternative therapists if the client requested a fallback.',
      okText: 'Yes, Decline',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        await declineBooking();
      },
    });
  };

  const acceptBooking = async () => {
    try {
      setUpdating(true);

      // Get therapist profile ID
      const userStr = localStorage.getItem('therapistUser');
      if (!userStr) {
        message.error('Session expired. Please log in again.');
        return;
      }

      const userData = JSON.parse(userStr);
      const userId = userData.user_id || userData.id;

      const { data: profile } = await supabaseClient
        .from('therapist_profiles')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (!profile) {
        message.error('Therapist profile not found');
        return;
      }

      // Call the same booking-response function that email buttons use
      const url = `/.netlify/functions/booking-response?action=accept&booking=${booking.booking_id}&therapist=${profile.id}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'text/html,application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to accept booking');
      }

      message.success('Booking accepted! Confirmation emails and SMS sent to you and the client.');

      // Reload booking details
      await loadBookingDetail();
    } catch (error: any) {
      console.error('Error accepting booking:', error);
      message.error(error?.message || 'Failed to accept booking');
    } finally {
      setUpdating(false);
    }
  };

  const declineBooking = async () => {
    try {
      setUpdating(true);

      // Get therapist profile ID
      const userStr = localStorage.getItem('therapistUser');
      if (!userStr) {
        message.error('Session expired. Please log in again.');
        return;
      }

      const userData = JSON.parse(userStr);
      const userId = userData.user_id || userData.id;

      const { data: profile } = await supabaseClient
        .from('therapist_profiles')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (!profile) {
        message.error('Therapist profile not found');
        return;
      }

      // Call the same booking-response function that email buttons use
      const url = `/.netlify/functions/booking-response?action=decline&booking=${booking.booking_id}&therapist=${profile.id}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'text/html,application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to decline booking');
      }

      if (booking.fallback_option === 'yes') {
        message.success('Booking declined. We will look for alternative therapists and notify the client.');
      } else {
        message.success('Booking declined. The client has been notified.');
      }

      // Reload booking details
      await loadBookingDetail();
    } catch (error: any) {
      console.error('Error declining booking:', error);
      message.error(error?.message || 'Failed to decline booking');
    } finally {
      setUpdating(false);
    }
  };

  const updateClientStatus = async (newClientStatus: string) => {
    try {
      setUpdating(true);

      console.log('Updating client_update_status to:', newClientStatus, 'for booking ID:', id);

      const { error } = await supabaseClient
        .from('bookings')
        .update({ client_update_status: newClientStatus })
        .eq('id', id);

      if (error) {
        console.error('Supabase error:', error);
        message.error(`Database error: ${error.message}`);
        throw error;
      }

      console.log('Update successful');
      message.success(`Status updated: ${newClientStatus.replace('_', ' ')}`);

      // Reload to get fresh data
      await loadBookingDetail();
    } catch (error: any) {
      console.error('Error updating client status:', error);
      message.error(error?.message || 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  const updateBookingStatus = async (newStatus: string, reason?: string) => {
    try {
      setUpdating(true);

      const updateData: any = { status: newStatus };
      if (reason) {
        updateData.cancellation_reason = reason;
      }

      console.log('Updating booking status to:', newStatus, 'with data:', updateData, 'for booking ID:', id);

      const { error } = await supabaseClient
        .from('bookings')
        .update(updateData)
        .eq('id', id);

      if (error) {
        console.error('Supabase error:', error);
        message.error(`Database error: ${error.message}`);
        throw error;
      }

      console.log('Update successful');
      message.success(`Booking ${newStatus}`);

      // Reload to get fresh data
      await loadBookingDetail();
    } catch (error: any) {
      console.error('Error updating booking status:', error);
      message.error(error?.message || 'Failed to update booking status');
    } finally {
      setUpdating(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      requested: 'orange',
      pending: 'orange',
      confirmed: 'blue',
      completed: 'green',
      cancelled: 'red',
      declined: 'red',
    };
    return colors[status] || 'default';
  };

  const openInMaps = () => {
    if (booking?.address) {
      const encodedAddress = encodeURIComponent(booking.address);
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!booking) {
    return (
      <Card>
        <Text>Booking not found</Text>
        <br />
        <Button onClick={() => navigate('/bookings')} style={{ marginTop: 16 }}>
          Back to Bookings
        </Button>
      </Card>
    );
  }

  const canUpdateStatus = ['confirmed'].includes(booking.status);
  const isRequested = booking.status === 'requested';

  return (
    <div>
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/bookings')}
        style={{ marginBottom: 16 }}
      >
        Back to Bookings
      </Button>

      <Title level={2}>Booking Details</Title>

      {/* Accept/Decline Actions - Only for Requested Status */}
      {isRequested && (
        <Card style={{ marginBottom: 24, background: '#fff7e6', borderColor: '#faad14' }}>
          <Text strong style={{ display: 'block', marginBottom: 16, color: '#faad14', fontSize: '16px' }}>
            ⏰ Booking Request - Please Respond:
          </Text>
          <Space size="middle" wrap>
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={handleAcceptBooking}
              loading={updating}
              size="large"
              style={{ background: '#52c41a', borderColor: '#52c41a' }}
            >
              Accept Booking
            </Button>
            <Button
              danger
              icon={<CloseCircleOutlined />}
              onClick={handleDeclineBooking}
              loading={updating}
              size="large"
            >
              Decline Booking
            </Button>
          </Space>
        </Card>
      )}

      {/* Status Actions - Only for Confirmed Status */}
      {canUpdateStatus && (
        <Card style={{ marginBottom: 24, background: '#f0f9ff' }}>
          <Text strong style={{ display: 'block', marginBottom: 16 }}>
            Update Booking Status:
          </Text>
          <Space size="middle" wrap>
            <Button
              type="primary"
              icon={<CarOutlined />}
              onClick={handleOnMyWay}
              loading={updating}
              size="large"
              style={{ background: '#1890ff', borderColor: '#1890ff' }}
            >
              On My Way
            </Button>
            <Button
              type="primary"
              icon={<EnvironmentOutlined />}
              onClick={handleArrived}
              loading={updating}
              size="large"
              style={{ background: '#faad14', borderColor: '#faad14' }}
            >
              I've Arrived
            </Button>
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={handleCompleteJob}
              loading={updating}
              size="large"
              style={{ background: '#52c41a', borderColor: '#52c41a' }}
            >
              Complete Job
            </Button>
            <Button
              danger
              icon={<CloseCircleOutlined />}
              onClick={handleCancelBooking}
              loading={updating}
              size="large"
            >
              Cancel
            </Button>
          </Space>
        </Card>
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          {/* Booking Information */}
          <Card title="Booking Information">
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Booking ID">
                <Text strong style={{ fontSize: '16px', color: '#007e8c', letterSpacing: '0.5px' }}>
                  {booking.booking_id || booking.id.substring(0, 8)}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="Date & Time">
                <Space direction="vertical" size={0}>
                  <Text strong>{dayjs(booking.booking_time).format('dddd, MMMM DD, YYYY')}</Text>
                  <Text>{dayjs(booking.booking_time).format('h:mm A')}</Text>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Service">
                <Text strong>{booking.service_name}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Duration">
                <Space size="small">
                  <ClockCircleOutlined />
                  <Text>{booking.duration_minutes || 60} minutes</Text>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={getStatusColor(booking.status)}>
                  {booking.status.toUpperCase()}
                </Tag>
              </Descriptions.Item>
              {booking.client_update_status && (
                <Descriptions.Item label="Client Update">
                  <Tag color="blue">
                    {booking.client_update_status.replace('_', ' ').toUpperCase()}
                  </Tag>
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Therapist Fee">
                <Text strong style={{ color: '#52c41a', fontSize: '16px' }}>
                  ${parseFloat(booking.therapist_fee?.toString() || '0').toFixed(2)}
                </Text>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          {/* Customer Information */}
          <Card title="Customer Information">
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Space>
                <UserOutlined style={{ fontSize: 18, color: '#007e8c' }} />
                <Text strong>{booking.customer_name}</Text>
              </Space>

              {booking.customer_phone && (
                <Space>
                  <PhoneOutlined style={{ fontSize: 18, color: '#007e8c' }} />
                  <a href={`tel:${booking.customer_phone}`}>{booking.customer_phone}</a>
                </Space>
              )}

              {booking.customer_email && (
                <Space>
                  <MailOutlined style={{ fontSize: 18, color: '#007e8c' }} />
                  <a href={`mailto:${booking.customer_email}`}>{booking.customer_email}</a>
                </Space>
              )}

              {booking.gender_preference && (
                <Space>
                  <UserOutlined style={{ fontSize: 18, color: '#007e8c' }} />
                  <Text>Preference: {booking.gender_preference}</Text>
                </Space>
              )}
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Location */}
      <Card title="Location" style={{ marginTop: 16 }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Space>
            <EnvironmentOutlined style={{ fontSize: 18, color: '#007e8c' }} />
            <Text strong>{booking.address}</Text>
          </Space>

          {booking.room_number && (
            <Space>
              <FileTextOutlined style={{ fontSize: 18, color: '#007e8c' }} />
              <Text>Room: {booking.room_number}</Text>
            </Space>
          )}

          {booking.parking && (
            <Space>
              <CarOutlined style={{ fontSize: 18, color: '#007e8c' }} />
              <Text>Parking: {booking.parking}</Text>
            </Space>
          )}

          <Button
            type="primary"
            icon={<EnvironmentOutlined />}
            onClick={openInMaps}
            size="large"
          >
            Open in Google Maps
          </Button>
        </Space>
      </Card>

      {/* Notes */}
      {booking.notes && (
        <Card title="Customer Notes" style={{ marginTop: 16 }}>
          <Paragraph>{booking.notes}</Paragraph>
        </Card>
      )}
    </div>
  );
};
