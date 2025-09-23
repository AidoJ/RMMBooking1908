import React, { useState, useEffect } from 'react';
import {
  Edit,
  useForm,
} from '@refinedev/antd';
import { useDelete } from '@refinedev/core';
import { useParams, useNavigate } from 'react-router';
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
  Tag,
  message,
  Alert,
  Button,
  Space,
  Modal,
  Table,
  Collapse,
  Progress,
  Divider,
} from 'antd';
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
  MailOutlined,
  UserOutlined,
  CalendarOutlined,
  DollarOutlined,
  SettingOutlined,
  CaretRightOutlined,
  LockOutlined,
  UnlockOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { QuoteAvailabilityChecker, type TherapistAssignment } from '../../components/QuoteAvailabilityChecker';
import { createBookingsFromQuote } from '../../services/bookingCreationService';
import { EmailService } from '../../utils/emailService';
import { supabaseClient } from '../../utility';
import dayjs from 'dayjs';
import './enhanced-edit.css';

const { TextArea } = Input;
const { Option } = Select;
const { Panel } = Collapse;

interface WorkflowStep {
  key: string;
  title: string;
  status: 'completed' | 'active' | 'pending';
  description: string;
}

export const EnhancedQuoteEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // State management
  const [availabilityStatus, setAvailabilityStatus] = useState<'unchecked' | 'checking' | 'available' | 'partial' | 'unavailable'>('unchecked');
  const [therapistAssignments, setTherapistAssignments] = useState<TherapistAssignment[]>([]);
  const [workflowStep, setWorkflowStep] = useState(2); // Current step in workflow
  const [expandedSections, setExpandedSections] = useState<string[]>(['customer', 'event', 'schedule']);
  const [diaryLocks, setDiaryLocks] = useState<{ [key: string]: boolean }>({});
  const [timeValidation, setTimeValidation] = useState<{
    eventDuration: number;
    serviceDuration: number;
    isValid: boolean;
  }>({ eventDuration: 0, serviceDuration: 0, isValid: false });

  const { formProps, saveButtonProps, queryResult, form } = useForm({
    meta: {
      select: '*,quote_dates(*)',
    },
    onMutationSuccess: (data, variables, context, isAutoSave) => {
      if (!isAutoSave) {
        message.success('Quote updated successfully');
      }
    },
  });

  const quotesData = queryResult?.data?.data;
  const { mutate: deleteQuote } = useDelete();

  // Workflow steps configuration
  const workflowSteps: WorkflowStep[] = [
    { key: 'received', title: 'Quote Received', status: 'completed', description: 'Quote request received from client' },
    { key: 'availability', title: 'Check Availability', status: workflowStep >= 2 ? 'active' : 'pending', description: 'Check therapist availability' },
    { key: 'assign', title: 'Assign Therapists', status: workflowStep >= 3 ? 'active' : 'pending', description: 'Assign and confirm therapists' },
    { key: 'send', title: 'Send Quote', status: workflowStep >= 4 ? 'active' : 'pending', description: 'Send official quote to client' },
    { key: 'response', title: 'Client Response', status: workflowStep >= 5 ? 'active' : 'pending', description: 'Wait for client acceptance' },
    { key: 'complete', title: 'Job Complete', status: workflowStep >= 6 ? 'active' : 'pending', description: 'Execute and complete job' },
  ];

  // Calculate time validation
  useEffect(() => {
    if (quotesData) {
      const eventStart = quotesData.single_start_time;
      const eventEnd = quotesData.single_finish_time;
      const totalSessions = quotesData.total_sessions || 0;
      const sessionDuration = quotesData.session_duration_minutes || 0;

      let eventDuration = 0;
      if (eventStart && eventEnd) {
        const start = dayjs(`2000-01-01 ${eventStart}`);
        const end = dayjs(`2000-01-01 ${eventEnd}`);
        eventDuration = end.diff(start, 'minute');
      }

      const serviceDuration = totalSessions * sessionDuration;
      const isValid = eventDuration === serviceDuration;

      setTimeValidation({ eventDuration, serviceDuration, isValid });
    }
  }, [quotesData]);

  // Get status color and text
  const getStatusInfo = (status: string) => {
    const statusMap = {
      'new': { color: '#ffc107', text: 'New', icon: '📝' },
      'availability_checking': { color: '#007bff', text: 'Checking Availability', icon: '🔍' },
      'availability_confirmed': { color: '#28a745', text: 'Available', icon: '✅' },
      'sent': { color: '#6c757d', text: 'Sent', icon: '📧' },
      'accepted': { color: '#20c997', text: 'Accepted', icon: '👍' },
      'declined': { color: '#dc3545', text: 'Declined', icon: '👎' },
    };
    return statusMap[status as keyof typeof statusMap] || statusMap.new;
  };

  // Format time for display
  const formatMinutesToTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins} minutes`;
    if (mins === 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
    return `${hours} hour${hours > 1 ? 's' : ''} ${mins} minutes`;
  };

  // Calculate therapists needed
  const calculateTherapistsNeeded = () => {
    const totalMinutes = (quotesData?.total_sessions || 0) * (quotesData?.session_duration_minutes || 0);
    const totalHours = totalMinutes / 60;
    return totalHours < 5 ? 1 : 2;
  };

  // Handle section toggle
  const handleSectionToggle = (section: string) => {
    setExpandedSections(prev =>
      prev.includes(section)
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  // Handle diary slot locking
  const handleDiaryLock = (assignmentId: string, locked: boolean) => {
    setDiaryLocks(prev => ({ ...prev, [assignmentId]: locked }));
    message.success(locked ? 'Diary slot locked' : 'Diary slot unlocked');
  };

  // Workflow handlers
  const handleCheckAvailability = async () => {
    setAvailabilityStatus('checking');
    message.loading('Checking therapist availability...', 0);

    // Simulate availability check
    setTimeout(() => {
      setAvailabilityStatus('available');
      message.destroy();
      message.success('Availability confirmed! Therapists are available for requested dates.');
      setWorkflowStep(3);
    }, 2000);
  };

  const handleConfirmAssignments = async () => {
    if (therapistAssignments.length === 0) {
      message.error('Please assign therapists before confirming');
      return;
    }

    message.success('Therapist assignments confirmed! Ready to send official quote.');
    setWorkflowStep(4);
  };

  const handleSendOfficialQuote = async () => {
    if (therapistAssignments.length === 0) {
      message.error('No therapist assignments found. Please confirm availability first.');
      return;
    }

    try {
      message.loading('Creating bookings and sending quote...', 0);

      // Create bookings
      const bookingResult = await createBookingsFromQuote(quotesData as any, therapistAssignments);

      if (!bookingResult.success) {
        throw new Error(`Failed to create bookings: ${bookingResult.error}`);
      }

      // Update quote status
      const { error } = await supabaseClient
        .from('quotes')
        .update({
          status: 'sent',
          quote_sent_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      message.destroy();
      message.success(`Official quote sent! Created ${bookingResult.bookingIds?.length || 0} bookings.`);
      setWorkflowStep(5);
      queryResult?.refetch();

    } catch (error) {
      message.destroy();
      console.error('Error sending quote:', error);
      message.error('Failed to send official quote: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const renderWorkflowProgress = () => (
    <Card className="workflow-progress-card" title="📋 Workflow Progress">
      <div className="workflow-steps">
        {workflowSteps.map((step, index) => (
          <div key={step.key} className={`workflow-step ${step.status}`}>
            <div className="step-connector" />
            <div className="step-indicator">
              {step.status === 'completed' ? (
                <CheckCircleOutlined />
              ) : step.status === 'active' ? (
                <span className="step-number">{index + 1}</span>
              ) : (
                <span className="step-number pending">{index + 1}</span>
              )}
            </div>
            <div className="step-content">
              <div className="step-title">{step.title}</div>
              <div className="step-description">{step.description}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );

  const renderWorkflowAlert = () => {
    if (workflowStep === 2) {
      return (
        <Alert
          message="Action Required: Check Therapist Availability"
          description="Before proceeding, you must check therapist availability for all requested dates and times."
          type="warning"
          showIcon
          icon={<ExclamationCircleOutlined />}
          action={
            <Button type="primary" size="small" onClick={handleCheckAvailability}>
              🔍 Check Availability Now
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      );
    }

    if (workflowStep === 3 && availabilityStatus === 'available') {
      return (
        <Alert
          message="Ready to Confirm Therapist Assignments"
          description="Availability confirmed. Please review and confirm the therapist assignments below."
          type="info"
          showIcon
          icon={<CheckCircleOutlined />}
          action={
            <Button type="primary" size="small" onClick={handleConfirmAssignments}>
              ✓ Confirm Assignments
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      );
    }

    if (workflowStep === 4) {
      return (
        <Alert
          message="Ready to Send Official Quote"
          description="Therapist assignments confirmed. You can now send the official quote to the customer."
          type="success"
          showIcon
          icon={<CheckCircleOutlined />}
          action={
            <Button type="primary" size="small" icon={<MailOutlined />} onClick={handleSendOfficialQuote}>
              📧 Send Official Quote
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      );
    }

    return null;
  };

  const renderTimeValidation = () => (
    <Card className="time-validation-card" title="⏱️ Time Validation">
      <Row gutter={[16, 16]}>
        <Col span={8}>
          <div className="validation-item">
            <div className="validation-label">Event Schedule Duration:</div>
            <div className="validation-value">{formatMinutesToTime(timeValidation.eventDuration)}</div>
          </div>
        </Col>
        <Col span={8}>
          <div className="validation-item">
            <div className="validation-label">Service Requirements:</div>
            <div className="validation-value">{formatMinutesToTime(timeValidation.serviceDuration)}</div>
          </div>
        </Col>
        <Col span={8}>
          <div className="validation-item">
            <div className="validation-label">Validation Status:</div>
            <div className={`validation-status ${timeValidation.isValid ? 'valid' : 'invalid'}`}>
              {timeValidation.isValid ? '✓ Times Match' : '❌ Times Don\'t Match'}
            </div>
          </div>
        </Col>
      </Row>
      {timeValidation.isValid && (
        <div className="validation-summary">
          <strong>Total Validated Duration: {formatMinutesToTime(timeValidation.eventDuration)}</strong>
        </div>
      )}
    </Card>
  );

  const renderTherapistAssignments = () => {
    const columns = [
      {
        title: 'Assignment',
        dataIndex: 'assignment',
        key: 'assignment',
        render: (_: any, __: any, index: number) => <strong>Assignment {index + 1}</strong>,
      },
      {
        title: 'Therapist',
        dataIndex: 'therapist_name',
        key: 'therapist_name',
        render: (name: string) => (
          <Select
            style={{ minWidth: 140 }}
            placeholder="Select Therapist..."
            value={name}
            onChange={(value) => {
              // Handle therapist selection
              message.info(`Therapist ${value} selected`);
            }}
          >
            <Option value="Emma Wilson">Emma Wilson</Option>
            <Option value="James Chen">James Chen</Option>
            <Option value="Maria Santos">Maria Santos</Option>
            <Option value="David Kim">David Kim</Option>
          </Select>
        ),
      },
      {
        title: 'Time Slot',
        dataIndex: 'time_slot',
        key: 'time_slot',
        render: () => '09:00 - 13:00', // This would come from data
      },
      {
        title: 'Rate',
        dataIndex: 'hourly_rate',
        key: 'hourly_rate',
        render: (rate: number) => <span className="rate-display">${rate}/hr</span>,
      },
      {
        title: 'Diary Status',
        dataIndex: 'status',
        key: 'status',
        render: () => <Tag color="green">✓ Available</Tag>,
      },
      {
        title: 'Actions',
        key: 'actions',
        render: (_: any, record: any, index: number) => {
          const isLocked = diaryLocks[`assignment-${index}`];
          return (
            <Button
              size="small"
              icon={isLocked ? <LockOutlined /> : <UnlockOutlined />}
              onClick={() => handleDiaryLock(`assignment-${index}`, !isLocked)}
              type={isLocked ? 'primary' : 'default'}
            >
              {isLocked ? 'Locked' : 'Lock Slot'}
            </Button>
          );
        },
      },
    ];

    const mockAssignments = [
      { therapist_name: 'Emma Wilson', hourly_rate: 85 },
      { therapist_name: 'James Chen', hourly_rate: 85 },
    ];

    return (
      <Card title="👥 Therapist Availability & Assignment">
        <div className="availability-summary">
          <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
            <Col span={6}>
              <div className="summary-stat">
                <div className="stat-number">{calculateTherapistsNeeded()}</div>
                <div className="stat-label">Therapists Required</div>
              </div>
            </Col>
            <Col span={6}>
              <div className="summary-stat">
                <div className="stat-number">5</div>
                <div className="stat-label">Available</div>
              </div>
            </Col>
            <Col span={6}>
              <div className="summary-stat">
                <div className="stat-number">100%</div>
                <div className="stat-label">Can Fulfill</div>
              </div>
            </Col>
            <Col span={6}>
              <div className="summary-stat">
                <div className="stat-number">0</div>
                <div className="stat-label">Conflicts</div>
              </div>
            </Col>
          </Row>
        </div>

        <Table
          columns={columns}
          dataSource={mockAssignments}
          pagination={false}
          size="small"
          rowKey={(_, index) => `assignment-${index}`}
        />

        <div className="assignment-actions" style={{ marginTop: 16 }}>
          <Space>
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={handleCheckAvailability}
              loading={availabilityStatus === 'checking'}
            >
              🔍 Check Availability
            </Button>
            <Button
              type="default"
              icon={<CheckCircleOutlined />}
              onClick={handleConfirmAssignments}
              disabled={availabilityStatus !== 'available'}
            >
              ✓ Confirm Assignments
            </Button>
            <Button type="default">
              🔄 Suggest Alternatives
            </Button>
          </Space>
        </div>
      </Card>
    );
  };

  const statusInfo = getStatusInfo(quotesData?.status || 'new');

  return (
    <div className="enhanced-quote-edit">
      {/* Header */}
      <Card className="quote-header-card">
        <Row justify="space-between" align="middle">
          <Col>
            <Space size="large">
              <div className="quote-id-badge">QRM-{id}</div>
              <h1 style={{ margin: 0 }}>Quote Management</h1>
            </Space>
          </Col>
          <Col>
            <Space>
              <Tag color={statusInfo.color} className="status-tag">
                {statusInfo.icon} {statusInfo.text}
              </Tag>
              <span className="last-updated">
                Updated: {dayjs(quotesData?.updated_at).fromNow()}
              </span>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Workflow Progress */}
      {renderWorkflowProgress()}

      {/* Workflow Alert */}
      {renderWorkflowAlert()}

      <Row gutter={[20, 20]}>
        <Col span={18}>
          {/* Main Content */}
          <Form {...formProps} layout="vertical">
            <Collapse
              ghost
              expandIcon={({ isActive }) => <CaretRightOutlined rotate={isActive ? 90 : 0} />}
              activeKey={expandedSections}
              onChange={setExpandedSections}
            >
              {/* Customer Information */}
              <Panel header="👤 Customer Information" key="customer">
                <Row gutter={[16, 16]}>
                  <Col span={12}>
                    <Form.Item label="Customer Name" name="customer_name" rules={[{ required: true }]}>
                      <Input readOnly />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="Company Name" name="company_name">
                      <Input readOnly />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="Email" name="customer_email" rules={[{ required: true, type: 'email' }]}>
                      <Input readOnly />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="Phone" name="customer_phone" rules={[{ required: true }]}>
                      <Input readOnly />
                    </Form.Item>
                  </Col>
                </Row>
              </Panel>

              {/* Event Details */}
              <Panel header="🎯 Event Details" key="event">
                <Row gutter={[16, 16]}>
                  <Col span={24}>
                    <Form.Item label="Event Location" name="event_location" rules={[{ required: true }]}>
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="Event Type" name="event_type">
                      <Select>
                        <Option value="corporate_wellness">Corporate Wellness</Option>
                        <Option value="team_building">Team Building</Option>
                        <Option value="conference">Conference</Option>
                        <Option value="other">Other</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="Expected Attendees" name="expected_attendees">
                      <InputNumber min={1} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>
              </Panel>

              {/* Event Schedule */}
              <Panel header="📅 Event Schedule & Time Validation" key="schedule">
                <Row gutter={[16, 16]}>
                  <Col span={8}>
                    <Form.Item label="Event Date" name="single_event_date" rules={[{ required: true }]}>
                      <DatePicker style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="Start Time" name="single_start_time" rules={[{ required: true }]}>
                      <TimePicker style={{ width: '100%' }} format="HH:mm" />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="Finish Time" name="single_finish_time" rules={[{ required: true }]}>
                      <TimePicker style={{ width: '100%' }} format="HH:mm" />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="Total Sessions" name="total_sessions" rules={[{ required: true }]}>
                      <InputNumber min={1} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="Session Duration" name="session_duration_minutes" rules={[{ required: true }]}>
                      <Select>
                        <Option value={15}>15 minutes</Option>
                        <Option value={20}>20 minutes</Option>
                        <Option value={30}>30 minutes</Option>
                        <Option value={60}>60 minutes</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="Therapists Needed" name="therapists_needed">
                      <InputNumber
                        value={calculateTherapistsNeeded()}
                        readOnly
                        style={{ width: '100%', backgroundColor: '#e8f4f5', fontWeight: 600 }}
                      />
                      <small style={{ color: '#007e8c' }}>Auto-calculated: ≥5 hours = 2 therapists</small>
                    </Form.Item>
                  </Col>
                </Row>
                {renderTimeValidation()}
              </Panel>

              {/* Therapist Assignment */}
              <Panel header="👥 Therapist Availability & Assignment" key="availability">
                {renderTherapistAssignments()}
              </Panel>

              {/* Financial Details */}
              <Panel header="💰 Financial Details" key="financial">
                <Row gutter={[16, 16]}>
                  <Col span={8}>
                    <Form.Item label="Hourly Rate" name="hourly_rate" rules={[{ required: true }]}>
                      <InputNumber
                        min={0}
                        precision={2}
                        style={{ width: '100%' }}
                        formatter={(value) => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="Total Amount" name="total_amount" rules={[{ required: true }]}>
                      <InputNumber
                        min={0}
                        precision={2}
                        style={{ width: '100%' }}
                        formatter={(value) => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                        readOnly
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="Therapist Fees" name="total_therapist_fees">
                      <InputNumber
                        min={0}
                        precision={2}
                        style={{ width: '100%' }}
                        formatter={(value) => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="Discount Amount" name="discount_amount">
                      <InputNumber
                        min={0}
                        precision={2}
                        style={{ width: '100%' }}
                        formatter={(value) => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="GST (10%)" name="gst_amount">
                      <InputNumber
                        min={0}
                        precision={2}
                        style={{ width: '100%' }}
                        formatter={(value) => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                        readOnly
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="Final Amount" name="final_amount">
                      <InputNumber
                        min={0}
                        precision={2}
                        style={{ width: '100%', backgroundColor: '#e8f4f5', fontWeight: 600 }}
                        formatter={(value) => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                        readOnly
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </Panel>

              {/* Business Requirements */}
              <Panel header="💼 Business Requirements" key="business">
                <Row gutter={[16, 16]}>
                  <Col span={12}>
                    <Form.Item label="Payment Method" name="payment_method" rules={[{ required: true }]}>
                      <Select>
                        <Option value="card">Credit Card</Option>
                        <Option value="bank_transfer">Bank Transfer/EFT</Option>
                      </Select>
                      <small style={{ color: '#6c757d' }}>Note: Invoice option removed per business requirements</small>
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="Timeline" name="urgency" rules={[{ required: true }]}>
                      <Select>
                        <Option value="flexible">Flexible timing</Option>
                        <Option value="within_week">Within 1 week</Option>
                        <Option value="within_3_days">Within 3 days</Option>
                        <Option value="urgent_24h">Urgent (24 hours)</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="Setup Requirements" name="setup_requirements">
                      <TextArea rows={3} placeholder="e.g., Tables provided, private rooms needed..." />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="Special Requirements" name="special_requirements">
                      <TextArea rows={3} placeholder="Any special requests or notes..." />
                    </Form.Item>
                  </Col>
                </Row>
              </Panel>
            </Collapse>

            {/* Main Action Buttons */}
            <Card style={{ marginTop: 20 }}>
              <Space size="middle">
                <Button type="primary" size="large" htmlType="submit" {...saveButtonProps}>
                  💾 Save Changes
                </Button>
                <Button
                  type="primary"
                  size="large"
                  icon={<MailOutlined />}
                  onClick={handleSendOfficialQuote}
                  disabled={workflowStep < 4}
                >
                  📧 Send Official Quote
                </Button>
                <Button size="large">
                  📋 Preview Quote
                </Button>
                <Button danger size="large">
                  ❌ Decline Quote
                </Button>
              </Space>
            </Card>
          </Form>
        </Col>

        <Col span={6}>
          {/* Sidebar */}
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            {/* Quick Actions */}
            <Card title="⚡ Quick Actions" size="small">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Button block icon={<MailOutlined />}>📧 Email Customer</Button>
                <Button block>📱 SMS Customer</Button>
                <Button block>📄 Generate PDF</Button>
                <Button block>📅 View Calendar</Button>
                <Button block>📊 View Analytics</Button>
                <Button block onClick={() => navigate('/quotes')}>🔙 Back to List</Button>
              </Space>
            </Card>

            {/* Quote Summary */}
            <Card title="📋 Quote Summary" size="small">
              <div className="summary-items">
                <div className="summary-item">
                  <span>Duration:</span>
                  <span>{formatMinutesToTime(timeValidation.eventDuration)}</span>
                </div>
                <div className="summary-item">
                  <span>Sessions:</span>
                  <span>{quotesData?.total_sessions || 0} × {quotesData?.session_duration_minutes || 0} min</span>
                </div>
                <div className="summary-item">
                  <span>Therapists:</span>
                  <span>{calculateTherapistsNeeded()} needed</span>
                </div>
                <div className="summary-item">
                  <span>Base Amount:</span>
                  <span>${quotesData?.total_amount?.toFixed(2) || '0.00'}</span>
                </div>
                <div className="summary-item">
                  <span>GST (10%):</span>
                  <span>${quotesData?.gst_amount?.toFixed(2) || '0.00'}</span>
                </div>
                <Divider style={{ margin: '12px 0' }} />
                <div className="summary-item total">
                  <span><strong>Total Amount:</strong></span>
                  <span><strong>${quotesData?.final_amount?.toFixed(2) || '0.00'}</strong></span>
                </div>
              </div>
            </Card>

            {/* Activity Log */}
            <Card title="📝 Activity Log" size="small">
              <div className="activity-items">
                <div className="activity-item">
                  <strong>2 hours ago</strong><br />
                  Quote request received from customer
                </div>
                <div className="activity-item">
                  <strong>1 hour ago</strong><br />
                  Admin started availability check
                </div>
                <div className="activity-item">
                  <strong>Now</strong><br />
                  Reviewing quote details
                </div>
              </div>
            </Card>
          </Space>
        </Col>
      </Row>
    </div>
  );
};

export default EnhancedQuoteEdit;