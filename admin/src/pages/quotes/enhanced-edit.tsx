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
import { getSystemSetting } from '../../utils/systemSettings';
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

  // Stage 1: Button state management
  const [workflowState, setWorkflowState] = useState({
    availabilityConfirmed: false,
    availabilityConfirmedAt: null as string | null,
    quoteSent: false,
    quoteSentAt: null as string | null,
    quoteAccepted: false,
    quoteAcceptedAt: null as string | null,
    invoiceSent: false,
    invoiceSentAt: null as string | null,
    receiptSent: false,
    receiptSentAt: null as string | null,
  });

  const [taxRatePercentage, setTaxRatePercentage] = useState<number>(10.0); // Default to 10% if not loaded

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
    { key: 'availability', title: 'Check Availability', status: workflowStep >= 2 ? (availabilityStatus === 'available' ? 'completed' : 'active') : 'pending', description: 'Check therapist availability' },
    { key: 'assign', title: 'Assign Therapists', status: workflowStep >= 3 ? (workflowStep > 3 ? 'completed' : 'active') : 'pending', description: 'Assign and confirm therapists' },
    { key: 'send', title: 'Send Quote', status: workflowStep >= 4 ? 'active' : 'pending', description: 'Send official quote to client' },
    { key: 'response', title: 'Client Response', status: workflowStep >= 5 ? 'active' : 'pending', description: 'Wait for client acceptance' },
    { key: 'complete', title: 'Job Complete', status: workflowStep >= 6 ? 'active' : 'pending', description: 'Execute and complete job' },
  ];

  // Calculate time validation based on event structure
  useEffect(() => {
    if (quotesData) {
      const totalSessions = quotesData.total_sessions || 0;
      const sessionDuration = quotesData.session_duration_minutes || 0;
      const serviceDuration = totalSessions * sessionDuration;

      let eventDuration = 0;

      if (quotesData.event_structure === 'single_day') {
        // For single day: calculate finish time from start time + total duration
        const eventStart = quotesData.single_start_time;
        if (eventStart) {
          // Calculate expected finish time
          const start = dayjs(`2000-01-01 ${eventStart}`);
          const expectedEnd = start.add(serviceDuration, 'minute');
          eventDuration = serviceDuration; // For single day, event duration should match service duration
        }
      } else if (quotesData.event_structure === 'multi_day' && quotesData.quote_dates) {
        // For multi-day: sum all day durations from quote_dates
        eventDuration = quotesData.quote_dates.reduce((total: number, day: any) => {
          if (day.start_time && day.finish_time) {
            const start = dayjs(`2000-01-01 ${day.start_time}`);
            const end = dayjs(`2000-01-01 ${day.finish_time}`);
            return total + end.diff(start, 'minute');
          }
          return total;
        }, 0);
      }

      const isValid = eventDuration === serviceDuration;
      setTimeValidation({ eventDuration, serviceDuration, isValid });
    }
  }, [quotesData]);

  // Fetch tax rate from system settings
  useEffect(() => {
    const fetchTaxRate = async () => {
      try {
        const taxRate = await getSystemSetting('tax_rate_percentage', 'decimal', 10.0);
        setTaxRatePercentage(taxRate);
      } catch (error) {
        console.error('Error fetching tax rate from system settings:', error);
        // Keep default 10% if fetch fails
      }
    };

    fetchTaxRate();
  }, []);

  // Load existing therapist assignments from bookings table
  useEffect(() => {
    const loadExistingAssignments = async () => {
      if (!id || !quotesData) return;

      try {
        const supabase = supabaseClient;

        // Query bookings with therapist profile data
        const { data: bookingsData, error } = await supabase
          .from('bookings')
          .select(`
            booking_time,
            therapist_id,
            therapist_fee,
            therapist_profiles!inner(first_name, last_name)
          `)
          .eq('parent_quote_id', id)
          .order('booking_time');

        if (error) {
          console.error('Error loading existing assignments:', error);
          return;
        }

        if (bookingsData && bookingsData.length > 0) {
          console.log('Found existing bookings:', bookingsData.length);

          // Transform to TherapistAssignment format
          const assignments: TherapistAssignment[] = bookingsData.map((booking: any) => {
            const bookingDateTime = new Date(booking.booking_time);
            const date = bookingDateTime.toISOString().split('T')[0]; // YYYY-MM-DD
            const time = bookingDateTime.toTimeString().split(' ')[0]; // HH:MM:SS

            return {
              date,
              start_time: time,
              therapist_id: booking.therapist_id,
              therapist_name: `${booking.therapist_profiles.first_name} ${booking.therapist_profiles.last_name}`,
              hourly_rate: booking.therapist_fee,
              is_override: false
            };
          });

          console.log('Transformed assignments:', assignments);
          setTherapistAssignments(assignments);
          setAvailabilityStatus('available');
          setWorkflowStep(3); // Move to therapist assignment step
        }
      } catch (error) {
        console.error('Error loading existing assignments:', error);
      }
    };

    loadExistingAssignments();
  }, [id, quotesData]);

  // Watch for changes in total_amount and discount_amount to auto-calculate GST and final amount
  const totalAmount = Form.useWatch('total_amount', form);
  const discountAmount = Form.useWatch('discount_amount', form);

  // Auto-calculate GST and Final Amount when watched values change
  useEffect(() => {
    if (totalAmount != null && discountAmount != null) {
      // Calculate the subtotal after discount
      const subtotal = totalAmount - discountAmount;

      // Calculate GST on subtotal using system setting (only if subtotal is positive)
      const gstAmount = subtotal > 0 ? subtotal * (taxRatePercentage / 100) : 0;

      // Calculate final amount (subtotal + GST)
      const finalAmount = subtotal + gstAmount;

      // Update form fields
      form.setFieldValue('gst_amount', parseFloat(gstAmount.toFixed(2)));
      form.setFieldValue('final_amount', parseFloat(finalAmount.toFixed(2)));
    }
  }, [totalAmount, discountAmount, taxRatePercentage, form]);

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

  // Calculate finish time for single day events
  const calculateFinishTime = () => {
    if (!quotesData?.single_start_time || !quotesData?.total_sessions || !quotesData?.session_duration_minutes) {
      return null;
    }
    const totalMinutes = quotesData.total_sessions * quotesData.session_duration_minutes;
    const startTime = dayjs(`2000-01-01 ${quotesData.single_start_time}`);
    const finishTime = startTime.add(totalMinutes, 'minute');
    return finishTime.format('HH:mm');
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
    setWorkflowStep(2);
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
    if (!workflowState.availabilityConfirmed) {
      message.error('Please confirm therapist availability first.');
      return;
    }

    if (workflowState.quoteSent) {
      message.warning('Official quote has already been sent.');
      return;
    }

    try {
      message.loading('Sending official quote...', 0);

      // Send official quote email (bookings already created in availability confirmation)
      const emailResult = await EmailService.sendEnhancedOfficialQuote(
        quotesData,
        therapistAssignments,
        [] // BookingIds - we'll get these from the database as they were created during availability confirmation
      );

      if (!emailResult.success) {
        throw new Error('Failed to send quote email');
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

      // Update workflow state
      const now = new Date().toLocaleDateString();
      setWorkflowState(prev => ({
        ...prev,
        quoteSent: true,
        quoteSentAt: now
      }));

      message.destroy();
      message.success(`✅ Official quote sent ${now}! Client will receive email with Accept/Decline options.`);
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
          description="Scroll down to the 'Therapist Availability & Assignment' section to check availability for all requested dates and times."
          type="warning"
          showIcon
          icon={<ExclamationCircleOutlined />}
          style={{ marginBottom: 16 }}
        />
      );
    }

    if (workflowStep === 3 && availabilityStatus === 'available') {
      return (
        <Alert
          message="Therapist Assignments Confirmed"
          description="Availability checked and therapists assigned. You can now send the official quote to the customer."
          type="success"
          showIcon
          icon={<CheckCircleOutlined />}
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

  // Stage 1: Workflow status messages
  const renderWorkflowMessages = () => (
    <Card title="📋 Workflow Status" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {workflowState.availabilityConfirmed && (
          <div style={{ padding: 8, background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 4 }}>
            ✅ <strong>Therapist availability confirmed</strong> {workflowState.availabilityConfirmedAt}
            <div style={{ fontSize: 12, color: '#52c41a', marginTop: 4 }}>
              Therapist calendars updated with pending bookings
            </div>
          </div>
        )}

        {workflowState.quoteSent && (
          <div style={{ padding: 8, background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 4 }}>
            ✅ <strong>Official quote sent</strong> {workflowState.quoteSentAt}
            <div style={{ fontSize: 12, color: '#52c41a', marginTop: 4 }}>
              Client will receive email with Accept/Decline options
            </div>
          </div>
        )}

        {workflowState.quoteAccepted && (
          <div style={{ padding: 8, background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 4 }}>
            ✅ <strong>Quote accepted by client</strong> {workflowState.quoteAcceptedAt}
            <div style={{ fontSize: 12, color: '#52c41a', marginTop: 4 }}>
              Therapist calendars updated to confirmed bookings
            </div>
          </div>
        )}

        {workflowState.invoiceSent && (
          <div style={{ padding: 8, background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 4 }}>
            ✅ <strong>Official invoice sent</strong> {workflowState.invoiceSentAt}
          </div>
        )}

        {workflowState.receiptSent && (
          <div style={{ padding: 8, background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 4 }}>
            ✅ <strong>Official receipt sent</strong> {workflowState.receiptSentAt}
          </div>
        )}
      </div>
    </Card>
  );

  const renderEventScheduleFields = () => {
    if (quotesData?.event_structure === 'single_day') {
      const calculatedFinishTime = calculateFinishTime();

      return (
        <>
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
              <div className="form-group">
                <label className="form-label">Calculated Finish Time</label>
                <Input
                  value={calculatedFinishTime || 'Not available'}
                  readOnly
                  style={{ backgroundColor: '#f0f0f0', fontWeight: 600 }}
                />
                <small style={{ color: '#007e8c', fontSize: '12px' }}>
                  Auto-calculated from start time + total duration
                </small>
              </div>
            </Col>
          </Row>
        </>
      );
    } else if (quotesData?.event_structure === 'multi_day') {
      return (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
            <Col span={8}>
              <Form.Item label="Number of Event Days" name="number_of_event_days">
                <InputNumber min={1} max={30} style={{ width: '100%' }} readOnly />
              </Form.Item>
            </Col>
          </Row>

          {quotesData.quote_dates && quotesData.quote_dates.length > 0 && (
            <Card title={`📅 Event Days (${quotesData.quote_dates.length} days)`} size="small">
              <Table
                dataSource={quotesData.quote_dates}
                pagination={false}
                size="small"
                rowKey="id"
                columns={[
                  {
                    title: 'Day',
                    dataIndex: 'day_number',
                    key: 'day_number',
                    render: (dayNum: number) => <strong>Day {dayNum}</strong>,
                    width: 80,
                  },
                  {
                    title: 'Date',
                    dataIndex: 'event_date',
                    key: 'event_date',
                    render: (date: string) => dayjs(date).format('MMM DD, YYYY'),
                  },
                  {
                    title: 'Start Time',
                    dataIndex: 'start_time',
                    key: 'start_time',
                    render: (time: string) => dayjs(`2000-01-01 ${time}`).format('HH:mm'),
                  },
                  {
                    title: 'Finish Time',
                    dataIndex: 'finish_time',
                    key: 'finish_time',
                    render: (time: string) => time ? dayjs(`2000-01-01 ${time}`).format('HH:mm') : 'Not set',
                  },
                  {
                    title: 'Duration',
                    key: 'duration',
                    render: (_: any, record: any) => {
                      if (record.start_time && record.finish_time) {
                        const start = dayjs(`2000-01-01 ${record.start_time}`);
                        const end = dayjs(`2000-01-01 ${record.finish_time}`);
                        const duration = end.diff(start, 'minute');
                        return formatMinutesToTime(duration);
                      }
                      return 'Not calculated';
                    },
                  },
                  {
                    title: 'Sessions',
                    dataIndex: 'sessions_count',
                    key: 'sessions_count',
                    render: (count: number) => count || 'Not set',
                  },
                ]}
              />
            </Card>
          )}
        </>
      );
    }

    return (
      <Alert
        message="Event Structure Not Recognized"
        description="Unable to determine if this is a single day or multi-day event."
        type="warning"
        showIcon
      />
    );
  };

  const renderTimeValidation = () => (
    <Card className="time-validation-card" title="⏱️ Time Validation" style={{ marginTop: 20 }}>
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
      {!timeValidation.isValid && timeValidation.serviceDuration > 0 && (
        <Alert
          message="Time Mismatch Detected"
          description={`The event schedule duration (${formatMinutesToTime(timeValidation.eventDuration)}) does not match the service requirements (${formatMinutesToTime(timeValidation.serviceDuration)}). Please review the schedule.`}
          type="warning"
          showIcon
          style={{ marginTop: 16 }}
        />
      )}
    </Card>
  );

  const renderTherapistAssignments = () => {
    if (!id) {
      return (
        <Card title="👥 Therapist Availability & Assignment">
          <Alert
            message="Quote ID Required"
            description="Unable to check therapist availability without a valid quote ID."
            type="warning"
            showIcon
          />
        </Card>
      );
    }

    return (
      <QuoteAvailabilityChecker
        quoteId={id}
        onAvailabilityConfirmed={async (assignments) => {
          try {
            // Create pending bookings immediately
            const bookingResult = await createBookingsFromQuote(quotesData as any, assignments);

            if (!bookingResult.success) {
              throw new Error(`Failed to create bookings: ${bookingResult.error}`);
            }

            // Update workflow state
            const now = new Date().toLocaleDateString();
            setTherapistAssignments(assignments);
            setAvailabilityStatus('available');
            setWorkflowStep(3);
            setWorkflowState(prev => ({
              ...prev,
              availabilityConfirmed: true,
              availabilityConfirmedAt: now
            }));

            message.success(`✅ Therapist availability confirmed ${now}! ${bookingResult.bookingIds?.length} pending bookings created.`);
          } catch (error) {
            console.error('Error confirming availability:', error);
            message.error('Failed to confirm availability and create bookings.');
          }
        }}
        onAvailabilityDeclined={() => {
          setAvailabilityStatus('unavailable');
          message.warning('Quote declined due to therapist availability issues.');
        }}
        existingAssignments={therapistAssignments}
      />
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

      {/* Stage 1: Workflow Status Messages */}
      {renderWorkflowMessages()}

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
                <div style={{ marginBottom: 20 }}>
                  <Tag color={quotesData?.event_structure === 'single_day' ? 'blue' : 'green'} style={{ fontSize: '14px', padding: '4px 12px' }}>
                    {quotesData?.event_structure === 'single_day' ? '📅 Single Day Event' : '🗓️ Multi-Day Event'}
                  </Tag>
                </div>

                {/* Dynamic Event Schedule Fields */}
                {renderEventScheduleFields()}

                {/* Service Specifications */}
                <Row gutter={[16, 16]} style={{ marginTop: 20 }}>
                  <Col span={8}>
                    <Form.Item label="Total Sessions" name="total_sessions" rules={[{ required: true }]}>
                      <InputNumber min={1} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="Session Duration" name="session_duration_minutes" rules={[{ required: true }]}>
                      <Select>
                        <Option value={5}>5 minutes</Option>
                        <Option value={10}>10 minutes</Option>
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
                      <small style={{ color: '#007e8c', fontSize: '12px' }}>Auto-calculated: &lt;5 hours = 1, ≥5 hours = 2 therapists</small>
                    </Form.Item>
                  </Col>
                </Row>

                {/* Time Validation */}
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
                    <Form.Item label={`GST (${taxRatePercentage}%)`} name="gst_amount">
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
                  disabled={!workflowState.availabilityConfirmed || workflowState.quoteSent}
                  style={{
                    color: '#ffffff',
                    opacity: workflowState.quoteSent ? 0.6 : 1,
                    backgroundColor: workflowState.quoteSent ? '#d9d9d9' : '#007e8c',
                    borderColor: workflowState.quoteSent ? '#d9d9d9' : '#007e8c'
                  }}
                >
                  {workflowState.quoteSent ? '✅ Quote Sent' : '📧 Send Official Quote'}
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
                  <span>GST ({taxRatePercentage}%):</span>
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