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
  Modal,
  Divider,
  List,
  Image,
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
  MedicineBoxOutlined,
  EyeOutlined,
  FormOutlined,
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
  const [intakeForm, setIntakeForm] = useState<any>(null);
  const [showFullIntakeForm, setShowFullIntakeForm] = useState(false);
  const [therapistNotes, setTherapistNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

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
      setTherapistNotes(data.therapist_notes || '');

      // Load intake form if exists
      const { data: intakeData } = await supabaseClient
        .from('client_intake_forms')
        .select('*')
        .eq('booking_id', id)
        .maybeSingle();

      setIntakeForm(intakeData);
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

      // First update the database
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

      // Then send notifications to customer via Netlify function
      try {
        const notificationUrl = `/.netlify/functions/therapist-status-update?booking=${id}&status=${newClientStatus}`;
        const notificationResponse = await fetch(notificationUrl, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });

        if (notificationResponse.ok) {
          console.log('✅ Customer notification sent');
          message.success(`Status updated: ${newClientStatus.replace('_', ' ')}. Customer has been notified via email and SMS.`);
        } else {
          console.warn('⚠️ Notification failed but status updated');
          message.success(`Status updated: ${newClientStatus.replace('_', ' ')}`);
        }
      } catch (notificationError) {
        console.error('❌ Error sending notification:', notificationError);
        message.success(`Status updated: ${newClientStatus.replace('_', ' ')}`);
      }

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

      // If completing the job, schedule a review request for 60 minutes later
      if (newStatus === 'completed') {
        try {
          const scheduleUrl = `/.netlify/functions/schedule-review-request?booking=${id}`;
          const scheduleResponse = await fetch(scheduleUrl, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
          });

          if (scheduleResponse.ok) {
            console.log('✅ Review request scheduled for 60 minutes from now');
          } else {
            console.warn('⚠️ Failed to schedule review request, but job marked complete');
          }
        } catch (scheduleError) {
          console.error('❌ Error scheduling review request:', scheduleError);
          // Don't fail the whole operation if scheduling fails
        }
      }

      // Reload to get fresh data
      await loadBookingDetail();
    } catch (error: any) {
      console.error('Error updating booking status:', error);
      message.error(error?.message || 'Failed to update booking status');
    } finally {
      setUpdating(false);
    }
  };

  const saveTherapistNotes = async () => {
    try {
      setSavingNotes(true);

      const { error } = await supabaseClient
        .from('bookings')
        .update({ therapist_notes: therapistNotes })
        .eq('id', id);

      if (error) {
        console.error('Error saving notes:', error);
        message.error('Failed to save notes');
        throw error;
      }

      message.success('Notes saved successfully');
      await loadBookingDetail();
    } catch (error: any) {
      console.error('Error saving therapist notes:', error);
      message.error(error?.message || 'Failed to save notes');
    } finally {
      setSavingNotes(false);
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

  // Check if booking date/time allows status updates
  const bookingDateTime = dayjs(booking.booking_time);
  const now = dayjs();
  const hoursUntilBooking = bookingDateTime.diff(now, 'hour', true);

  // Allow status updates starting 2 hours before the booking time
  const canUpdateBasedOnTime = hoursUntilBooking <= 2;
  const isFutureBooking = hoursUntilBooking > 2;

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
        <Card style={{ marginBottom: 24, background: isFutureBooking ? '#fff7e6' : '#f0f9ff', borderColor: isFutureBooking ? '#faad14' : undefined }}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>
            Update Booking Status:
          </Text>
          {isFutureBooking && (
            <Text type="warning" style={{ display: 'block', marginBottom: 16, fontSize: '13px' }}>
              ⏰ Status updates will be available 2 hours before the booking time ({bookingDateTime.format('MMM DD, YYYY [at] h:mm A')})
            </Text>
          )}
          {!isFutureBooking && canUpdateBasedOnTime && (
            <Text type="success" style={{ display: 'block', marginBottom: 16, fontSize: '13px' }}>
              ✓ You can now update the booking status
            </Text>
          )}
          <Space size="middle" wrap>
            <Button
              type="primary"
              icon={<CarOutlined />}
              onClick={handleOnMyWay}
              loading={updating}
              disabled={isFutureBooking || booking.client_update_status === 'on_my_way' || booking.client_update_status === 'arrived'}
              size="large"
              style={{ background: '#1890ff', borderColor: '#1890ff' }}
              title={isFutureBooking ? 'Available 2 hours before booking time' : undefined}
            >
              {booking.client_update_status === 'on_my_way' || booking.client_update_status === 'arrived' ? '✓ On My Way Sent' : 'On My Way'}
            </Button>
            <Button
              type="primary"
              icon={<EnvironmentOutlined />}
              onClick={handleArrived}
              loading={updating}
              disabled={isFutureBooking || booking.client_update_status === 'arrived'}
              size="large"
              style={{ background: '#faad14', borderColor: '#faad14' }}
              title={isFutureBooking ? 'Available 2 hours before booking time' : undefined}
            >
              {booking.client_update_status === 'arrived' ? '✓ Arrived Sent' : 'I\'ve Arrived'}
            </Button>
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={handleCompleteJob}
              loading={updating}
              disabled={isFutureBooking}
              size="large"
              style={{ background: '#52c41a', borderColor: '#52c41a' }}
              title={isFutureBooking ? 'Available 2 hours before booking time' : undefined}
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
              <Descriptions.Item label="Booking Status">
                <Tag color={getStatusColor(booking.status)}>
                  {booking.status.toUpperCase()}
                </Tag>
              </Descriptions.Item>
              {booking.client_update_status && (
                <Descriptions.Item label="Last Client Update">
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

      {/* Therapist Notes */}
      <Card
        title={
          <Space>
            <FileTextOutlined />
            <span>Therapist Notes</span>
          </Space>
        }
        style={{ marginTop: 16 }}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Text type="secondary">Add your private notes about this booking (visible only to you)</Text>
          <TextArea
            rows={4}
            value={therapistNotes}
            onChange={(e) => setTherapistNotes(e.target.value)}
            placeholder="Enter notes about the client, session details, preferences, or any observations..."
            style={{ width: '100%' }}
          />
          <Button
            type="primary"
            onClick={saveTherapistNotes}
            loading={savingNotes}
            icon={<FileTextOutlined />}
          >
            Save Notes
          </Button>
        </Space>
      </Card>

      {/* Accommodation Details */}
      {(booking.business_name || booking.room_number || booking.booker_name) && (
        <Card title="Accommodation Details" style={{ marginTop: 16 }}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {booking.business_name && (
              <div>
                <Text type="secondary">Hotel Name:</Text>
                <br />
                <Text strong>{booking.business_name}</Text>
              </div>
            )}

            {booking.room_number && (
              <div>
                <Text type="secondary">Room Number:</Text>
                <br />
                <Text strong>{booking.room_number}</Text>
              </div>
            )}

            {booking.booker_name && (
              <div>
                <Text type="secondary">Name of person who booked the room:</Text>
                <br />
                <Text strong>{booking.booker_name}</Text>
              </div>
            )}

            {booking.notes && (
              <div>
                <Text type="secondary">Additional Notes:</Text>
                <br />
                <Paragraph style={{ marginBottom: 0 }}>{booking.notes}</Paragraph>
              </div>
            )}
          </Space>
        </Card>
      )}

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

      {/* Client Health Intake */}
      <Card
        title={
          <Space>
            <MedicineBoxOutlined />
            <span>Client Health Intake</span>
          </Space>
        }
        style={{ marginTop: 16 }}
      >
        {intakeForm && intakeForm.completed_at ? (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Tag color="success" icon={<CheckCircleOutlined />} style={{ fontSize: '14px', padding: '4px 12px' }}>
              Completed {dayjs(intakeForm.completed_at).format('MMM DD, YYYY [at] h:mm A')}
            </Tag>

            <Divider orientation="left" style={{ margin: '12px 0' }}>Health Concerns</Divider>

            {/* Show only "Yes" responses */}
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              {intakeForm.has_medications && (
                <div>
                  <Text strong style={{ color: '#007e8c' }}>• Medications:</Text>
                  <br />
                  <Text>{intakeForm.medications}</Text>
                </div>
              )}

              {intakeForm.has_allergies && (
                <div>
                  <Text strong style={{ color: '#007e8c' }}>• Allergies:</Text>
                  <br />
                  <Text>{intakeForm.allergies}</Text>
                </div>
              )}

              {intakeForm.is_pregnant && (
                <div>
                  <Text strong style={{ color: '#007e8c' }}>• Pregnancy:</Text>
                  <br />
                  <Text>{intakeForm.pregnancy_months} months</Text>
                  {intakeForm.pregnancy_due_date && <Text> (Due: {dayjs(intakeForm.pregnancy_due_date).format('MMM DD, YYYY')})</Text>}
                </div>
              )}

              {intakeForm.has_medical_supervision && (
                <div>
                  <Text strong style={{ color: '#007e8c' }}>• Medical Supervision:</Text>
                  <br />
                  <Text>{intakeForm.medical_supervision_details}</Text>
                </div>
              )}

              {intakeForm.has_broken_skin && (
                <div>
                  <Text strong style={{ color: '#007e8c' }}>• Broken Skin/Wounds:</Text>
                  <br />
                  <Text>{intakeForm.broken_skin_location}</Text>
                </div>
              )}

              {intakeForm.has_joint_replacement && (
                <div>
                  <Text strong style={{ color: '#007e8c' }}>• Joint Replacement:</Text>
                  <br />
                  <Text>{intakeForm.joint_replacement_details}</Text>
                </div>
              )}

              {intakeForm.has_recent_injuries && (
                <div>
                  <Text strong style={{ color: '#007e8c' }}>• Recent Injuries:</Text>
                  <br />
                  <Text>{intakeForm.recent_injuries}</Text>
                </div>
              )}

              {intakeForm.has_other_conditions && (
                <div>
                  <Text strong style={{ color: '#007e8c' }}>• Other Conditions:</Text>
                  <br />
                  <Text>{intakeForm.other_conditions}</Text>
                </div>
              )}

              {(!intakeForm.has_medications && !intakeForm.has_allergies && !intakeForm.is_pregnant &&
                !intakeForm.has_medical_supervision && !intakeForm.has_broken_skin &&
                !intakeForm.has_joint_replacement && !intakeForm.has_recent_injuries &&
                !intakeForm.has_other_conditions) && (
                <Text type="secondary">No health concerns reported</Text>
              )}
            </Space>

            {/* Medical Conditions */}
            {intakeForm.medical_conditions && intakeForm.medical_conditions.length > 0 && (
              <>
                <Divider orientation="left" style={{ margin: '12px 0' }}>Medical Conditions</Divider>
                <List
                  size="small"
                  dataSource={intakeForm.medical_conditions}
                  renderItem={(item: string) => (
                    <List.Item style={{ padding: '4px 0', border: 'none' }}>
                      <Text>• {item}</Text>
                    </List.Item>
                  )}
                />
              </>
            )}

            {/* Signature */}
            {intakeForm.signature_data && (
              <>
                <Divider orientation="left" style={{ margin: '12px 0' }}>Signature</Divider>
                <Image
                  src={intakeForm.signature_data}
                  alt="Client Signature"
                  style={{ maxWidth: 300, border: '1px solid #d9d9d9', borderRadius: 4 }}
                />
              </>
            )}

            <Button
              icon={<EyeOutlined />}
              onClick={() => setShowFullIntakeForm(true)}
              style={{ marginTop: 8 }}
            >
              View Full Form
            </Button>
          </Space>
        ) : (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Tag color="warning" style={{ fontSize: '14px', padding: '4px 12px' }}>
              Pending - Not yet completed
            </Tag>
            <Text type="secondary">
              Client has not completed their health intake form yet. You can complete it on their behalf if needed.
            </Text>
            <Button
              type="primary"
              icon={<FormOutlined />}
              onClick={() => window.open(`/therapist/clientintake?booking=${booking.id}`, '_blank')}
            >
              Complete Intake Form
            </Button>
          </Space>
        )}
      </Card>

      {/* Full Intake Form Modal */}
      <Modal
        title="Complete Health Intake Form"
        open={showFullIntakeForm}
        onCancel={() => setShowFullIntakeForm(false)}
        footer={[
          <Button key="close" onClick={() => setShowFullIntakeForm(false)}>
            Close
          </Button>
        ]}
        width={800}
      >
        {intakeForm && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Medications">
                {intakeForm.has_medications ? intakeForm.medications : 'No'}
              </Descriptions.Item>
              <Descriptions.Item label="Allergies">
                {intakeForm.has_allergies ? intakeForm.allergies : 'No'}
              </Descriptions.Item>
              <Descriptions.Item label="Pregnant">
                {intakeForm.is_pregnant ? `Yes - ${intakeForm.pregnancy_months} months` : 'No'}
              </Descriptions.Item>
              {intakeForm.is_pregnant && intakeForm.pregnancy_due_date && (
                <Descriptions.Item label="Due Date">
                  {dayjs(intakeForm.pregnancy_due_date).format('MMMM DD, YYYY')}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Medical Supervision">
                {intakeForm.has_medical_supervision ? intakeForm.medical_supervision_details : 'No'}
              </Descriptions.Item>
              <Descriptions.Item label="Medical Conditions">
                {intakeForm.medical_conditions && intakeForm.medical_conditions.length > 0
                  ? intakeForm.medical_conditions.join(', ')
                  : 'None'}
              </Descriptions.Item>
              <Descriptions.Item label="Broken Skin/Wounds">
                {intakeForm.has_broken_skin ? intakeForm.broken_skin_location : 'No'}
              </Descriptions.Item>
              <Descriptions.Item label="Joint Replacement">
                {intakeForm.has_joint_replacement ? intakeForm.joint_replacement_details : 'No'}
              </Descriptions.Item>
              <Descriptions.Item label="Recent Injuries">
                {intakeForm.has_recent_injuries ? intakeForm.recent_injuries : 'No'}
              </Descriptions.Item>
              <Descriptions.Item label="Other Conditions">
                {intakeForm.has_other_conditions ? intakeForm.other_conditions : 'No'}
              </Descriptions.Item>
              <Descriptions.Item label="Completed">
                {dayjs(intakeForm.completed_at).format('MMMM DD, YYYY [at] h:mm A')}
              </Descriptions.Item>
            </Descriptions>

            {intakeForm.signature_data && (
              <div>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>Signature:</Text>
                <Image
                  src={intakeForm.signature_data}
                  alt="Client Signature"
                  style={{ maxWidth: '100%', border: '1px solid #d9d9d9', borderRadius: 4 }}
                />
              </div>
            )}
          </Space>
        )}
      </Modal>
    </div>
  );
};
