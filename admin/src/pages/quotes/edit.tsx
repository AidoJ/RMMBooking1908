import React, { useState, useEffect } from 'react';
import {
  Edit,
  useForm,
  useSelect,
} from '@refinedev/antd';
import { useParams } from 'react-router';
import {
  Form,
  Input,
  Select,
  InputNumber,
  DatePicker,
  TimePicker,
  Card,
  Row,
  Col,
  Divider,
  Tag,
  message,
  Alert,
  Button,
  Space,
  Modal,
  Tabs,
} from 'antd';
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
  MailOutlined,
} from '@ant-design/icons';
import { QuoteAvailabilityChecker, type TherapistAssignment } from '../../components/QuoteAvailabilityChecker';
import { supabaseClient } from '../../utility';
import dayjs from 'dayjs';

const { TextArea } = Input;
const { Option } = Select;
const { TabPane } = Tabs;

export const QuoteEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState('details');
  const [availabilityStatus, setAvailabilityStatus] = useState<'unchecked' | 'checking' | 'available' | 'partial' | 'unavailable'>('unchecked');
  const [therapistAssignments, setTherapistAssignments] = useState<TherapistAssignment[]>([]);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [originalSessionData, setOriginalSessionData] = useState<{
    session_duration_minutes?: number;
    total_sessions?: number;
  }>({});

  const { formProps, saveButtonProps, queryResult, form } = useForm({
    meta: {
      select: '*,quote_dates(*)',
    },
  });

  const quotesData = queryResult?.data?.data;

  // Store original session data for change detection
  useEffect(() => {
    if (quotesData) {
      setOriginalSessionData({
        session_duration_minutes: quotesData.session_duration_minutes,
        total_sessions: quotesData.total_sessions,
      });
    }
  }, [quotesData]);

  // Handle form value changes
  const onValuesChange = (changedValues: any, allValues: any) => {
    // Trigger calculations for pricing fields
    if (changedValues.session_duration_minutes || changedValues.total_sessions ||
        changedValues.total_amount || changedValues.discount_amount) {
      setTimeout(() => {
        calculateFields();
      }, 0);
    }

    // Check for session changes that affect availability
    if (changedValues.session_duration_minutes || changedValues.total_sessions) {
      setTimeout(() => {
        checkSessionDetailsChanged();
      }, 0);
    }
  };

  // Auto-calculate duration_minutes and pricing fields
  const calculateFields = () => {
    const values = form?.getFieldsValue() as any;
    if (!values) return;

    const sessionDuration = values.session_duration_minutes as number;
    const totalSessions = values.total_sessions as number;
    const totalAmount = values.total_amount as number;
    const discountAmount = (values.discount_amount as number) || 0;

    // Calculate duration_minutes
    if (sessionDuration && totalSessions) {
      const durationMinutes = sessionDuration * totalSessions;
      form?.setFieldValue('duration_minutes', durationMinutes);
    }

    // Calculate pricing with GST
    if (totalAmount !== undefined) {
      const subtotal = totalAmount - discountAmount;
      const gstAmount = subtotal / 11; // GST = subtotal / 1.1 * 0.1 = subtotal / 11
      const finalAmount = subtotal;

      form?.setFieldsValue({
        gst_amount: parseFloat(gstAmount.toFixed(2)),
        final_amount: parseFloat(finalAmount.toFixed(2))
      });
    }
  };

  // Check if session details changed (affects availability)
  const checkSessionDetailsChanged = () => {
    const currentValues = form?.getFieldsValue() as any;
    if (!currentValues || !originalSessionData.session_duration_minutes) return;

    const sessionChanged =
      (currentValues.session_duration_minutes as number) !== originalSessionData.session_duration_minutes ||
      (currentValues.total_sessions as number) !== originalSessionData.total_sessions;

    console.log('Checking session changes:', {
      current: {
        duration: currentValues.session_duration_minutes,
        sessions: currentValues.total_sessions
      },
      original: originalSessionData,
      sessionChanged,
      availabilityStatus
    });

    if (sessionChanged) {
      // If there are any changes and we had previous assignments or confirmed availability
      if (availabilityStatus !== 'unchecked' || therapistAssignments.length > 0) {
        setAvailabilityStatus('unchecked');
        setTherapistAssignments([]);
        message.warning('Session details changed - please re-check therapist availability');
      }
    }
  };

  const handleAvailabilityConfirmed = (assignments: TherapistAssignment[]) => {
    setTherapistAssignments(assignments);
    setAvailabilityStatus('available');
    message.success('Therapist availability confirmed! Ready to send official quote.');
    // TODO: Create tentative bookings
  };

  const handleAvailabilityDeclined = () => {
    setShowDeclineModal(true);
  };

  const sendDeclineEmail = async () => {
    try {
      // TODO: Send professional decline email
      message.success('Decline email sent to customer');
      setShowDeclineModal(false);
      // TODO: Update quote status to 'availability_declined'
    } catch (error) {
      message.error('Failed to send decline email');
    }
  };

  const sendOfficialQuote = async () => {
    try {
      // Update quote status to 'sent' and timestamp
      const { error } = await supabaseClient
        .from('quotes')
        .update({
          status: 'sent',
          quote_sent_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) {
        throw error;
      }

      // TODO: Generate PDF, send email, create tentative bookings
      message.success('Official quote sent successfully!');

      // Refresh the form data to show updated status
      queryResult?.refetch();

    } catch (error) {
      console.error('Error sending quote:', error);
      message.error('Failed to send official quote');
    }
  };

  const getStatusAlert = () => {
    const status = quotesData?.status;

    if (status === 'new') {
      return (
        <Alert
          message="Availability Check Required"
          description="Before sending an official quote, you must check therapist availability for all requested dates."
          type="warning"
          showIcon
          icon={<ExclamationCircleOutlined />}
          action={
            <Button
              size="small"
              onClick={() => setActiveTab('availability')}
            >
              Check Availability
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      );
    }

    if (availabilityStatus === 'available') {
      return (
        <Alert
          message="Ready to Send Official Quote"
          description="Therapist availability confirmed. You can now send the official quote to the customer."
          type="success"
          showIcon
          icon={<CheckCircleOutlined />}
          action={
            <Button
              type="primary"
              size="small"
              icon={<MailOutlined />}
              onClick={sendOfficialQuote}
            >
              Send Official Quote
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      );
    }

    return null;
  };

  return (
    <Edit saveButtonProps={saveButtonProps}>
      {getStatusAlert()}

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="Quote Details" key="details">
          <Form {...formProps} layout="vertical" onValuesChange={onValuesChange}>
            <Card title="Quote Information" style={{ marginBottom: 16 }}>
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Form.Item
                    label="Quote ID"
                    name="id"
                  >
                    <Input disabled />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="Status"
                    name="status"
                    rules={[{ required: true, message: 'Please select a status' }]}
                  >
                    <Select>
                      <Option value="new">New</Option>
                      <Option value="availability_checking">Checking Availability</Option>
                      <Option value="availability_confirmed">Availability Confirmed</Option>
                      <Option value="availability_declined">Availability Declined</Option>
                      <Option value="sent">Sent</Option>
                      <Option value="accepted">Accepted</Option>
                      <Option value="declined">Declined</Option>
                      <Option value="invoiced">Invoiced</Option>
                      <Option value="paid">Paid</Option>
                      <Option value="completed">Completed</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
            </Card>

        <Card title="Customer Information" style={{ marginBottom: 16 }}>
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Form.Item
                label="Company Name"
                name="company_name"
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Customer Name"
                name="customer_name"
                rules={[{ required: true, message: 'Please enter customer name' }]}
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Form.Item
                label="Email"
                name="customer_email"
                rules={[
                  { required: true, message: 'Please enter email' },
                  { type: 'email', message: 'Please enter a valid email' }
                ]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Phone"
                name="customer_phone"
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card title="Event Details" style={{ marginBottom: 16 }}>
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Form.Item
                label="Event Structure"
                name="event_structure"
                rules={[{ required: true, message: 'Please select event structure' }]}
              >
                <Select disabled>
                  <Option value="single_day">Single Day</Option>
                  <Option value="multi_day">Multi-Day</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Event Name"
                name="event_name"
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <Form.Item
                label="Event Location"
                name="event_location"
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={[16, 16]}>
            <Col span={8}>
              <Form.Item
                label="Expected Attendees"
                name="expected_attendees"
              >
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="Urgency"
                name="urgency"
              >
                <Select>
                  <Option value="flexible">Flexible</Option>
                  <Option value="within_week">Within 1 Week</Option>
                  <Option value="within_3_days">Within 3 Days</Option>
                  <Option value="urgent_24h">Urgent (24h)</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="Payment Method"
                name="payment_method"
              >
                <Select>
                  <Option value="card">Credit Card</Option>
                  <Option value="invoice">Invoice</Option>
                  <Option value="bank_transfer">Bank Transfer</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card title="Service Specifications" style={{ marginBottom: 16 }}>
          <Row gutter={[16, 16]}>
            <Col span={6}>
              <Form.Item
                label="Total Sessions"
                name="total_sessions"
                rules={[{ required: true, message: 'Please enter total sessions' }]}
              >
                <InputNumber
                  min={1}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                label="Session Duration (minutes)"
                name="session_duration_minutes"
                rules={[{ required: true, message: 'Please enter session duration' }]}
              >
                <InputNumber
                  min={1}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                label="Total Duration (minutes)"
                name="duration_minutes"
              >
                <InputNumber
                  style={{ width: '100%' }}
                  disabled
                  formatter={(value) => `${value} mins`}
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                label="Therapists Needed"
                name="therapists_needed"
                rules={[{ required: true, message: 'Please enter number of therapists' }]}
              >
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card title="Financial Details" style={{ marginBottom: 16 }}>
          <Row gutter={[16, 16]}>
            <Col span={8}>
              <Form.Item
                label="Hourly Rate ($)"
                name="hourly_rate"
                rules={[{ required: true, message: 'Please enter hourly rate' }]}
              >
                <InputNumber
                  min={0}
                  precision={2}
                  style={{ width: '100%' }}
                  formatter={(value) => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="Total Amount ($)"
                name="total_amount"
                rules={[{ required: true, message: 'Please enter total amount' }]}
              >
                <InputNumber
                  min={0}
                  precision={2}
                  style={{ width: '100%' }}
                  formatter={(value) => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="Therapist Fees ($)"
                name="total_therapist_fees"
                rules={[{ required: true, message: 'Please enter therapist fees' }]}
              >
                <InputNumber
                  min={0}
                  precision={2}
                  style={{ width: '100%' }}
                  formatter={(value) => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={[16, 16]}>
            <Col span={8}>
              <Form.Item
                label="Discount Amount ($)"
                name="discount_amount"
              >
                <InputNumber
                  min={0}
                  precision={2}
                  style={{ width: '100%' }}
                  formatter={(value) => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="GST (10%)"
                name="gst_amount"
              >
                <InputNumber
                  min={0}
                  precision={2}
                  style={{ width: '100%' }}
                  formatter={(value) => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  disabled
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="Final Amount ($)"
                name="final_amount"
              >
                <InputNumber
                  min={0}
                  precision={2}
                  style={{ width: '100%' }}
                  formatter={(value) => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  disabled
                />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card title="Requirements" style={{ marginBottom: 16 }}>
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Form.Item
                label="Setup Requirements"
                name="setup_requirements"
              >
                <TextArea rows={3} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Special Requirements"
                name="special_requirements"
              >
                <TextArea rows={3} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Form.Item
                label="Discount Code"
                name="discount_code"
              >
                <Input
                  placeholder="Enter discount code"
                  onBlur={async (e) => {
                    const code = e.target.value;
                    if (code) {
                      // TODO: Validate discount code against database
                      message.info('Discount code validation not implemented yet');
                    }
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="PO Number"
                name="po_number"
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>
        </Card>

            <Card title="Notes">
              <Form.Item
                label="Internal Notes"
                name="notes"
              >
                <TextArea rows={4} />
              </Form.Item>
            </Card>
          </Form>
        </TabPane>

        <TabPane tab="Therapist Availability" key="availability">
          {id && (
            <QuoteAvailabilityChecker
              quoteId={id}
              onAvailabilityConfirmed={handleAvailabilityConfirmed}
              onAvailabilityDeclined={handleAvailabilityDeclined}
            />
          )}
        </TabPane>
      </Tabs>

      {/* Decline Quote Modal */}
      <Modal
        title="Decline Quote Request"
        open={showDeclineModal}
        onOk={sendDeclineEmail}
        onCancel={() => setShowDeclineModal(false)}
        okText="Send Decline Email"
        cancelText="Cancel"
        okType="danger"
      >
        <Alert
          message="This will decline the quote request"
          description="A professional email will be sent to the customer explaining that we cannot fulfill their request for the specified dates/times."
          type="warning"
          style={{ marginBottom: 16 }}
        />

        <div>
          <p><strong>Email Template Preview:</strong></p>
          <div style={{
            background: '#f5f5f5',
            padding: '12px',
            borderRadius: '4px',
            fontSize: '12px',
            fontStyle: 'italic'
          }}>
            "Thank you for your quote request. Unfortunately, we don't have therapist availability for your requested dates/times. We'd love to help you find alternative dates that work. Please call us to discuss options."
          </div>
        </div>
      </Modal>
    </Edit>
  );
};