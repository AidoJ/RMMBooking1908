import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Form,
  Input,
  InputNumber,
  Select,
  message,
  Spin,
  Typography,
  Row,
  Col,
  Space,
  Divider,
  Modal,
  Upload,
  Image,
  Tag,
  Alert
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  CameraOutlined,
  DollarOutlined,
  ClockCircleOutlined,
  UserOutlined,
  PhoneOutlined,
  EnvironmentOutlined,
  WarningOutlined
} from '@ant-design/icons';
import { useGetIdentity } from '@refinedev/core';
import { supabaseClient } from '../../utility';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

interface Booking {
  id: string;
  booking_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  business_name: string;
  address: string;
  booking_time: string;
  duration_minutes: number;
  service_name: string;
  therapist_fee: number;
  status: string;
  notes?: string;
}

interface CompletionForm {
  tip_amount: number;
  completion_notes: string;
  completion_photo?: string;
}

const TherapistCompletion: React.FC = () => {
  const { data: identity } = useGetIdentity<any>();
  const [form] = Form.useForm<CompletionForm>();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [currentBooking, setCurrentBooking] = useState<Booking | null>(null);
  const [photoFile, setPhotoFile] = useState<any>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Emergency cancellation reasons
  const cancelReasons = [
    'Customer not available',
    'Customer cancelled at location',
    'Safety concerns',
    'Equipment failure',
    'Personal emergency',
    'Location access issues',
    'Customer behavior concerns',
    'Other'
  ];

  useEffect(() => {
    if (identity?.therapist_id) {
      loadCurrentBooking();
    }
  }, [identity]);

  const loadCurrentBooking = async () => {
    try {
      setLoading(true);
      
      // Get therapist profile ID
      const { data: therapistProfile } = await supabaseClient
        .from('therapist_profiles')
        .select('id')
        .eq('user_id', identity.id)
        .single();

      if (!therapistProfile) {
        message.error('Therapist profile not found');
        return;
      }

      // Find current or upcoming booking for today
      const today = dayjs().format('YYYY-MM-DD');
      const { data: booking, error } = await supabaseClient
        .from('bookings')
        .select(`
          *,
          services(name),
          customers(first_name, last_name, email, phone)
        `)
        .eq('therapist_id', therapistProfile.id)
        .in('status', ['confirmed', 'pending'])
        .gte('booking_time', `${today}T00:00:00`)
        .lte('booking_time', `${today}T23:59:59`)
        .order('booking_time', { ascending: true })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      if (booking) {
        setCurrentBooking({
          id: booking.id,
          booking_id: booking.booking_id,
          customer_name: `${booking.customers?.first_name || booking.first_name} ${booking.customers?.last_name || booking.last_name}`,
          customer_email: booking.customers?.email || booking.customer_email,
          customer_phone: booking.customers?.phone || booking.customer_phone,
          business_name: booking.business_name,
          address: booking.address,
          booking_time: booking.booking_time,
          duration_minutes: booking.duration_minutes,
          service_name: booking.services?.name || 'Massage Service',
          therapist_fee: booking.therapist_fee,
          status: booking.status,
          notes: booking.notes
        });
      }
    } catch (error) {
      console.error('Error loading current booking:', error);
      message.error('Failed to load current booking');
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = (info: any) => {
    if (info.file.status === 'done') {
      setPhotoFile(info.file);
      form.setFieldsValue({ completion_photo: info.file.response?.url });
    }
  };

  const handleCompleteJob = async (values: CompletionForm) => {
    if (!currentBooking) return;

    try {
      setSubmitting(true);

      const completionData = {
        status: 'completed',
        completion_timestamp: new Date().toISOString(),
        completed_by_therapist_id: identity.therapist_id,
        tip_amount: values.tip_amount || 0,
        completion_notes: values.completion_notes,
        completion_photo_url: values.completion_photo,
        updated_at: new Date().toISOString()
      };

      // Update booking
      const { error: updateError } = await supabaseClient
        .from('bookings')
        .update(completionData)
        .eq('id', currentBooking.id);

      if (updateError) throw updateError;

      // Add to status history
      const { error: historyError } = await supabaseClient
        .from('booking_status_history')
        .insert({
          booking_id: currentBooking.id,
          status: 'completed',
          changed_by: identity.id,
          changed_at: new Date().toISOString(),
          notes: `Job completed by therapist. Tip: $${values.tip_amount || 0}. ${values.completion_notes || ''}`
        });

      if (historyError) throw historyError;

      message.success('Job completed successfully!');
      
      // Trigger post-completion communications
      await triggerPostCompletionCommunications();

      // Refresh booking data
      await loadCurrentBooking();
      form.resetFields();

    } catch (error) {
      console.error('Error completing job:', error);
      message.error('Failed to complete job');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmergencyCancel = async () => {
    if (!currentBooking || !cancelReason) return;

    try {
      setSubmitting(true);

      const cancelData = {
        status: 'cancelled',
        updated_at: new Date().toISOString()
      };

      // Update booking
      const { error: updateError } = await supabaseClient
        .from('bookings')
        .update(cancelData)
        .eq('id', currentBooking.id);

      if (updateError) throw updateError;

      // Add to status history
      const { error: historyError } = await supabaseClient
        .from('booking_status_history')
        .insert({
          booking_id: currentBooking.id,
          status: 'cancelled',
          changed_by: identity.id,
          changed_at: new Date().toISOString(),
          notes: `Emergency cancellation by therapist: ${cancelReason}`
        });

      if (historyError) throw historyError;

      message.success('Booking cancelled successfully');
      setShowCancelModal(false);
      setCancelReason('');
      
      // Refresh booking data
      await loadCurrentBooking();

    } catch (error) {
      console.error('Error cancelling booking:', error);
      message.error('Failed to cancel booking');
    } finally {
      setSubmitting(false);
    }
  };

  const triggerPostCompletionCommunications = async () => {
    try {
      // Call Netlify function to send completion communications
      const response = await fetch('/.netlify/functions/post-completion-communications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: currentBooking?.booking_id,
          customer_email: currentBooking?.customer_email,
          customer_name: currentBooking?.customer_name,
          therapist_name: `${identity?.first_name} ${identity?.last_name}`
        })
      });

      if (!response.ok) {
        console.error('Failed to trigger post-completion communications');
      }
    } catch (error) {
      console.error('Error triggering communications:', error);
    }
  };

  const generateWeeklyInvoice = async () => {
    try {
      setLoading(true);
      
      const weekStart = dayjs().startOf('week').add(1, 'day').format('YYYY-MM-DD'); // Monday
      const weekEnd = dayjs().endOf('week').add(1, 'day').format('YYYY-MM-DD'); // Sunday

      const { data, error } = await supabaseClient
        .rpc('generate_weekly_invoice', {
          p_therapist_id: identity.therapist_id,
          p_week_start: weekStart,
          p_week_end: weekEnd
        });

      if (error) throw error;

      message.success('Weekly invoice generated successfully!');
      
    } catch (error) {
      console.error('Error generating invoice:', error);
      message.error('Failed to generate weekly invoice');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <Spin size="large" />
        <div style={{ marginTop: '16px' }}>
          <Text>Loading current booking...</Text>
        </div>
      </div>
    );
  }

  if (!currentBooking) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <Card>
          <Title level={3}>No Active Bookings</Title>
          <Paragraph>
            You don't have any confirmed bookings for today.
          </Paragraph>
          <Button type="primary" onClick={loadCurrentBooking}>
            Refresh
          </Button>
        </Card>
      </div>
    );
  }

  const isBookingTime = dayjs().isAfter(dayjs(currentBooking.booking_time).subtract(15, 'minutes'));
  const canComplete = currentBooking.status === 'confirmed' && isBookingTime;

  return (
    <div style={{ padding: '16px', maxWidth: '500px', margin: '0 auto' }}>
      <Title level={2}>Job Completion</Title>
      
      {/* Booking Details */}
      <Card style={{ marginBottom: '16px' }}>
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <div>
            <Text strong>Booking #{currentBooking.booking_id}</Text>
            <Tag color={canComplete ? 'green' : 'orange'} style={{ marginLeft: '8px' }}>
              {currentBooking.status}
            </Tag>
          </div>
          
          <div>
            <UserOutlined /> <Text strong>{currentBooking.customer_name}</Text>
          </div>
          
          <div>
            <PhoneOutlined /> <Text>{currentBooking.customer_phone}</Text>
          </div>
          
          <div>
            <EnvironmentOutlined /> <Text>{currentBooking.business_name}</Text>
          </div>
          
          <div>
            <Text>{currentBooking.address}</Text>
          </div>
          
          <div>
            <ClockCircleOutlined /> <Text>
              {dayjs(currentBooking.booking_time).format('ddd, MMM D, YYYY [at] h:mm A')}
            </Text>
          </div>
          
          <div>
            <Text>Duration: {currentBooking.duration_minutes} minutes</Text>
          </div>
          
          <div>
            <DollarOutlined /> <Text strong>
              Service Fee: ${currentBooking.therapist_fee.toFixed(2)}
            </Text>
          </div>
        </Space>
      </Card>

      {!canComplete && (
        <Alert
          message="Booking Not Ready"
          description="You can only complete this booking 15 minutes before the scheduled time."
          type="info"
          style={{ marginBottom: '16px' }}
        />
      )}

      {/* Completion Form */}
      <Card>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCompleteJob}
          disabled={!canComplete || submitting}
        >
          <Title level={4}>Complete Job</Title>
          
          <Form.Item
            label="Tip Amount (Optional)"
            name="tip_amount"
            extra="Enter the tip amount received from the customer"
          >
            <InputNumber
              prefix="$"
              min={0}
              max={1000}
              step={0.50}
              style={{ width: '100%' }}
              placeholder="0.00"
            />
          </Form.Item>

          <Form.Item
            label="Completion Notes"
            name="completion_notes"
            extra="Add any notes about the service provided"
          >
            <TextArea
              rows={3}
              placeholder="Service completed successfully. Customer was very satisfied..."
            />
          </Form.Item>

          <Form.Item
            label="Service Photo (Optional)"
            name="completion_photo"
            extra="Upload a photo of the completed service setup"
          >
            <Upload
              name="photo"
              listType="picture-card"
              showUploadList={true}
              onChange={handlePhotoUpload}
              beforeUpload={() => false} // Prevent auto upload
              accept="image/*"
            >
              <div>
                <CameraOutlined />
                <div style={{ marginTop: 8 }}>Upload</div>
              </div>
            </Upload>
          </Form.Item>

          <Form.Item>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button
                type="primary"
                htmlType="submit"
                icon={<CheckCircleOutlined />}
                loading={submitting}
                size="large"
                block
              >
                Complete Job
              </Button>
              
              <Button
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => setShowCancelModal(true)}
                disabled={submitting}
                size="large"
                block
              >
                Emergency Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      {/* Weekly Invoice Generation */}
      <Card style={{ marginTop: '16px' }}>
        <Title level={4}>Weekly Invoice</Title>
        <Paragraph>
          Generate your weekly invoice for payment processing.
        </Paragraph>
        <Button
          type="default"
          onClick={generateWeeklyInvoice}
          loading={loading}
          block
        >
          Generate Weekly Invoice
        </Button>
      </Card>

      {/* Emergency Cancel Modal */}
      <Modal
        title="Emergency Cancellation"
        open={showCancelModal}
        onOk={handleEmergencyCancel}
        onCancel={() => {
          setShowCancelModal(false);
          setCancelReason('');
        }}
        okText="Cancel Booking"
        cancelText="Keep Booking"
        okButtonProps={{ danger: true }}
        confirmLoading={submitting}
      >
        <Alert
          message="Emergency Cancellation"
          description="This will cancel the booking immediately. Please select a reason:"
          type="warning"
          style={{ marginBottom: '16px' }}
        />
        
        <Select
          style={{ width: '100%' }}
          placeholder="Select cancellation reason"
          value={cancelReason}
          onChange={setCancelReason}
        >
          {cancelReasons.map(reason => (
            <Option key={reason} value={reason}>{reason}</Option>
          ))}
        </Select>
      </Modal>
    </div>
  );
};

export default TherapistCompletion;

