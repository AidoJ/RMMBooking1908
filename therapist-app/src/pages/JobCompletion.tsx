import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Form,
  Input,
  InputNumber,
  message,
  Spin,
  Typography,
  Space,
  Divider,
  Tag,
  Row,
  Col,
  Upload,
  Image,
  Modal,
  Select,
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
  WarningOutlined,
  PlusOutlined
} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
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

const JobCompletion: React.FC = () => {
  const { user } = useAuth();
  const [form] = Form.useForm<CompletionForm>();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [currentBooking, setCurrentBooking] = useState<Booking | null>(null);
  const [photoFile, setPhotoFile] = useState<any>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Quick tip buttons
  const quickTipAmounts = [5, 10, 15, 20, 25, 50];

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
    if (user?.therapist_id) {
      loadCurrentBooking();
    }
  }, [user]);

  const loadCurrentBooking = async () => {
    try {
      setLoading(true);
      
      // Find current or upcoming booking for today
      const today = dayjs().format('YYYY-MM-DD');
      const response = await fetch('/.netlify/functions/get-therapist-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          therapist_id: user?.therapist_id,
          date: today
        })
      });

      const result = await response.json();
      
      if (result.success && result.booking) {
        setCurrentBooking(result.booking);
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

  const handleQuickTip = (amount: number) => {
    form.setFieldsValue({ tip_amount: amount });
  };

  const handleCompleteJob = async (values: CompletionForm) => {
    if (!currentBooking) return;

    try {
      setSubmitting(true);

      const completionData = {
        booking_id: currentBooking.booking_id,
        tip_amount: values.tip_amount || 0,
        completion_notes: values.completion_notes,
        completion_photo: values.completion_photo,
        completed_by_therapist_id: user?.therapist_id
      };

      const response = await fetch('/.netlify/functions/complete-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(completionData)
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to complete job');
      }

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

      const response = await fetch('/.netlify/functions/cancel-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: currentBooking.booking_id,
          reason: cancelReason,
          cancelled_by_therapist_id: user?.therapist_id
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to cancel booking');
      }

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
      const response = await fetch('/.netlify/functions/post-completion-communications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: currentBooking?.booking_id,
          customer_email: currentBooking?.customer_email,
          customer_name: currentBooking?.customer_name,
          therapist_name: `${user?.first_name} ${user?.last_name}`
        })
      });

      if (!response.ok) {
        console.error('Failed to trigger post-completion communications');
      }
    } catch (error) {
      console.error('Error triggering communications:', error);
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
            <Space direction="vertical" style={{ width: '100%' }}>
              {/* Quick Tip Buttons */}
              <div>
                <Text type="secondary" style={{ fontSize: '12px' }}>Quick Select:</Text>
                <div style={{ marginTop: '4px' }}>
                  {quickTipAmounts.map(amount => (
                    <Button
                      key={amount}
                      size="small"
                      style={{ margin: '2px' }}
                      onClick={() => handleQuickTip(amount)}
                    >
                      ${amount}
                    </Button>
                  ))}
                </div>
              </div>
              
              <InputNumber
                prefix="$"
                min={0}
                max={1000}
                step={0.50}
                style={{ width: '100%' }}
                placeholder="0.00"
              />
            </Space>
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

export default JobCompletion;

