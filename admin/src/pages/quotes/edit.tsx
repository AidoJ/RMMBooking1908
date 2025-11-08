import React, { useState, useEffect } from 'react';
import {
  Edit,
  useForm,
  useSelect,
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
import { createBookingsFromQuote } from '../../services/bookingCreationService';
import { EmailService } from '../../utils/emailService';
import { supabaseClient } from '../../utility';
import { getSystemSetting } from '../../utils/systemSettings';
import dayjs from 'dayjs';

const { TextArea } = Input;
const { Option } = Select;
const { TabPane } = Tabs;

export const QuoteEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('details');
  const [availabilityStatus, setAvailabilityStatus] = useState<'unchecked' | 'checking' | 'available' | 'partial' | 'unavailable'>('unchecked');
  const [therapistAssignments, setTherapistAssignments] = useState<TherapistAssignment[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [originalSessionData, setOriginalSessionData] = useState<{
    session_duration_minutes?: number;
    total_sessions?: number;
  }>({});

  const { formProps, saveButtonProps, queryResult, form } = useForm({
    meta: {
      select: '*,quote_dates(*),services:service_id(id,name,service_base_price)',
    },
    onMutationSuccess: (data, variables, context, isAutoSave) => {
      // Handle successful mutations (save/update)
      if (!isAutoSave) {
        message.success('Quote updated successfully');
      }
    },
    // Transform data when loading from database
    queryOptions: {
      onSuccess: (data) => {
        if (data?.data) {
          const transformedData = { ...data.data };
          
          // Convert date/time strings to dayjs objects for DatePicker/TimePicker
          // (removed single_event_date and single_start_time - using unified structure)
          
          // Convert quote_dates date/time fields to dayjs objects
          if (transformedData.quote_dates && Array.isArray(transformedData.quote_dates)) {
            transformedData.quote_dates = transformedData.quote_dates.map((dateEntry: any) => ({
              ...dateEntry,
              event_date: dateEntry.event_date ? dayjs(dateEntry.event_date) : null,
              start_time: dateEntry.start_time ? dayjs(`2000-01-01 ${dateEntry.start_time}`) : null,
              finish_time: dateEntry.finish_time ? dayjs(`2000-01-01 ${dateEntry.finish_time}`) : null,
            }));
          }
          
          // Convert other timestamp fields to dayjs objects if they exist
          const timestampFields = [
            'created_at', 'updated_at', 'quote_sent_at', 'quote_accepted_at', 
            'invoice_sent_at', 'payment_due_date', 'paid_date', 'quote_valid_until'
          ];
          
          timestampFields.forEach(field => {
            if (transformedData[field]) {
              transformedData[field] = dayjs(transformedData[field]);
            }
          });

          // Set hourly rate from service base price if available and not already set
          if (transformedData.services && transformedData.services.service_base_price && !transformedData.hourly_rate) {
            transformedData.hourly_rate = transformedData.services.service_base_price;
          }

          // Set the transformed data to the form
          form?.setFieldsValue(transformedData);
        }
      }
    }
  });

  const quotesData = queryResult?.data?.data;

  // Custom delete handler with cascade delete for bookings
  const { mutate: deleteQuote } = useDelete();

  const handleQuoteDelete = () => {
    Modal.confirm({
      title: 'Delete Quote',
      content: 'Are you sure you want to delete this quote? This will also delete all associated bookings and cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          message.loading('Deleting quote and associated bookings...', 0);

          // First delete associated bookings
          const { error: bookingsError } = await supabaseClient
            .from('bookings')
            .delete()
            .eq('parent_quote_id', id);

          if (bookingsError) {
            throw new Error(`Failed to delete associated bookings: ${bookingsError.message}`);
          }

          // Then delete the quote using Refine's delete mutation
          deleteQuote({
            resource: 'quotes',
            id: id!,
            successNotification: {
              message: 'Quote and all associated bookings deleted successfully',
              type: 'success',
            },
            errorNotification: {
              message: 'Failed to delete quote',
              type: 'error',
            },
          });

          message.destroy();
        } catch (error) {
          message.destroy();
          console.error('Error deleting quote:', error);
          message.error('Failed to delete quote: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
      },
    });
  };

  // Store original session data for change detection
  useEffect(() => {
    if (quotesData) {
      setOriginalSessionData({
        session_duration_minutes: quotesData.session_duration_minutes,
        total_sessions: quotesData.total_sessions,
      });

      // Trigger calculations when data loads to ensure service base price is applied
      setTimeout(() => {
        calculateFields();
      }, 100);
    }
  }, [quotesData]);

  // Load existing assignments from bookings table if quote has been sent
  useEffect(() => {
    const loadExistingAssignments = async () => {
      if (!quotesData || !id) return;

      // Only load from bookings if quote has been sent (has booking records)
      if (quotesData.status === 'sent' || quotesData.status === 'accepted' || quotesData.status === 'declined') {
        setLoadingAssignments(true);
        try {
          const { data: bookings, error } = await supabaseClient
            .from('bookings')
            .select(`
              id,
              therapist_id,
              booking_time,
              quote_day_number,
              duration_minutes,
              therapist_fee,
              therapist_profiles!therapist_id (
                id,
                first_name,
                last_name,
                hourly_rate,
                afterhours_rate
              )
            `)
            .eq('parent_quote_id', id)
            .order('booking_time');

          if (error) {
            throw error;
          }

          if (bookings && bookings.length > 0) {
            // Convert bookings to TherapistAssignment format
            const assignments: TherapistAssignment[] = bookings.map(booking => ({
              therapist_id: booking.therapist_id,
              date: booking.booking_time.split('T')[0], // Extract date part
              start_time: booking.booking_time.split('T')[1].substring(0, 8), // Extract time part
              duration_minutes: booking.duration_minutes,
              day_number: booking.quote_day_number,
              hourly_rate: booking.therapist_profiles ? (booking.therapist_profiles as any).hourly_rate : 0,
              afterhours_rate: booking.therapist_profiles ? (booking.therapist_profiles as any).afterhours_rate : 0,
              therapist_name: booking.therapist_profiles ?
                `${(booking.therapist_profiles as any).first_name} ${(booking.therapist_profiles as any).last_name}` :
                'Unknown Therapist',
              is_override: false,
              override_reason: ''
            }));

            setTherapistAssignments(assignments);
            setAvailabilityStatus('available');
          }
        } catch (error) {
          console.error('Error loading existing assignments:', error);
          message.error('Failed to load existing therapist assignments');
        } finally {
          setLoadingAssignments(false);
        }
      }
    };

    loadExistingAssignments();
  }, [quotesData, id]);

  // Handle form value changes
  const onValuesChange = (changedValues: any, allValues: any) => {
    // Trigger calculations for pricing fields
    if (changedValues.session_duration_minutes || changedValues.total_sessions ||
        changedValues.hourly_rate || changedValues.total_amount || changedValues.discount_amount) {
      setTimeout(() => {
        calculateFields();
      }, 0);
    }

    // Show warning when session fields change (affects duration and therapist assignments)
    if (changedValues.session_duration_minutes || changedValues.total_sessions) {
      message.warning('Warning: This will affect the Therapist assignments. Please check all details and ensure you refresh the availability and assignments before sending the quote to the client.');
    }
  };

  // Auto-calculate duration_minutes and pricing fields
  const calculateFields = () => {
    const values = form?.getFieldsValue() as any;
    if (!values) return;

    const sessionDuration = values.session_duration_minutes as number;
    const totalSessions = values.total_sessions as number;
    let hourlyRate = values.hourly_rate as number;
    const discountAmount = (values.discount_amount as number) || 0;

    // If no hourly rate is set, use service base price
    if (!hourlyRate && quotesData?.services?.service_base_price) {
      hourlyRate = quotesData.services.service_base_price;
      form?.setFieldValue('hourly_rate', hourlyRate);
    }

    // Calculate duration_minutes
    if (sessionDuration && totalSessions) {
      const durationMinutes = sessionDuration * totalSessions;
      form?.setFieldValue('duration_minutes', durationMinutes);

      // Auto-calculate Total Amount based on duration and hourly rate
      if (hourlyRate) {
        const totalHours = durationMinutes / 60;
        const totalAmount = totalHours * hourlyRate;
        form?.setFieldValue('total_amount', parseFloat(totalAmount.toFixed(2)));

        // Calculate final amount and GST
        const finalAmount = totalAmount - discountAmount;
        const gstAmount = finalAmount / 11; // GST = final_amount / 1.1 * 0.1 = final_amount / 11

        form?.setFieldsValue({
          gst_amount: parseFloat(gstAmount.toFixed(2)),
          final_amount: parseFloat(finalAmount.toFixed(2))
        });
      }
    } else if (values.total_amount !== undefined) {
      // Fallback: if total_amount is manually entered, calculate GST and final amount
      const totalAmount = values.total_amount as number;
      const finalAmount = totalAmount - discountAmount;
      const gstAmount = finalAmount / 11;

      form?.setFieldsValue({
        gst_amount: parseFloat(gstAmount.toFixed(2)),
        final_amount: parseFloat(finalAmount.toFixed(2))
      });
    }
  };


  const handleAvailabilityConfirmed = async (assignments: TherapistAssignment[]) => {
    try {
      setTherapistAssignments(assignments);
      setAvailabilityStatus('available');

      // Check if assignments have actually changed to avoid unnecessary updates
      const hasAssignmentChanges = !therapistAssignments ||
        assignments.length !== therapistAssignments.length ||
        assignments.some(newAssignment =>
          !therapistAssignments.some(existingAssignment =>
            existingAssignment.date === newAssignment.date &&
            existingAssignment.start_time === newAssignment.start_time &&
            existingAssignment.therapist_id === newAssignment.therapist_id
          )
        );

      // Only update bookings if quote has been sent AND assignments have changed
      if ((quotesData?.status === 'sent' || quotesData?.status === 'accepted' || quotesData?.status === 'declined') && hasAssignmentChanges) {
        message.loading('Updating therapist assignments...', 0);

        // First, delete existing booking records for this quote
        const { error: deleteError } = await supabaseClient
          .from('bookings')
          .delete()
          .eq('parent_quote_id', id);

        if (deleteError) {
          throw deleteError;
        }

        // Then create new booking records with updated assignments
        const bookingResult = await createBookingsFromQuote(quotesData as any, assignments);

        if (!bookingResult.success) {
          throw new Error(`Failed to update bookings: ${bookingResult.error}`);
        }

        message.destroy();
        message.success(`Therapist assignments updated! ${bookingResult.bookingIds?.length || 0} booking records updated.`);
      } else if ((quotesData?.status === 'sent' || quotesData?.status === 'accepted' || quotesData?.status === 'declined') && !hasAssignmentChanges) {
        // No changes detected - just acknowledge
        message.success('Therapist assignments confirmed - no changes detected.');
      } else {
        // For new quotes, just store in local state
        message.success('Therapist availability confirmed! Ready to send official quote.');
      }
    } catch (error) {
      message.destroy();
      console.error('Error saving therapist assignments:', error);
      message.error('Failed to save assignment changes: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
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
      // Validate that we have therapist assignments
      if (!therapistAssignments || therapistAssignments.length === 0) {
        message.error('No therapist assignments found. Please confirm availability first.');
        return;
      }

      // Check if quote has already been sent to prevent duplicate booking creation
      if (quotesData?.status === 'sent' || quotesData?.status === 'accepted' || quotesData?.status === 'declined') {
        message.loading('Resending quote...', 0);

        // Fetch business_email from system settings for archive
        const businessEmail = await getSystemSetting('business_email', 'string', '');

        // For already-sent quotes, just resend the email without creating new bookings (with BCC to business email for archive)
        const emailResult = await EmailService.sendEnhancedOfficialQuote(
          quotesData,
          therapistAssignments,
          [], // No new booking IDs needed for resend
          businessEmail
        );

        if (!emailResult.success) {
          message.destroy();
          throw new Error(`Failed to resend quote: ${emailResult.error}`);
        }

        message.destroy();
        message.success('Official quote resent successfully!');
        return;
      }

      message.loading('Creating bookings and sending quote...', 0);

      // Step 1: Create bookings from quote and therapist assignments (only for new quotes)
      if (!quotesData) {
        throw new Error('Quote data not available');
      }

      const bookingResult = await createBookingsFromQuote(quotesData as any, therapistAssignments);

      if (!bookingResult.success) {
        message.destroy();
        throw new Error(`Failed to create bookings: ${bookingResult.error}`);
      }

      console.log('Successfully created bookings:', bookingResult.bookingIds);

      // Step 2: Send enhanced official quote email
      const emailResult = await EmailService.sendEnhancedOfficialQuote(
        quotesData,
        therapistAssignments,
        bookingResult.bookingIds || []
      );

      if (!emailResult.success) {
        // Don't fail the entire process if email fails, but log it
        console.error('Email sending failed:', emailResult.error);
        message.warning('Bookings created successfully, but email sending failed. Please send manually.');
      }

      // Step 3: Update quote status to 'sent' and timestamp
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

      message.destroy();
      const emailStatus = emailResult.success ? '📧 Email sent!' : '⚠️ Email failed';
      message.success(`Official quote sent successfully! Created ${bookingResult.bookingIds?.length || 0} bookings. ${emailStatus}`);

      // Refresh the form data to show updated status
      queryResult?.refetch();

    } catch (error) {
      message.destroy();
      console.error('Error sending quote:', error);
      message.error('Failed to send official quote: ' + (error instanceof Error ? error.message : 'Unknown error'));
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
          message={
            quotesData?.status === 'sent' || quotesData?.status === 'accepted' || quotesData?.status === 'declined'
              ? "Quote Already Sent"
              : "Ready to Send Official Quote"
          }
          description={
            quotesData?.status === 'sent' || quotesData?.status === 'accepted' || quotesData?.status === 'declined'
              ? "This quote has already been sent. You can resend it or modify therapist assignments above if needed."
              : "Therapist availability confirmed. You can now send the official quote to the customer."
          }
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
              {quotesData?.status === 'sent' || quotesData?.status === 'accepted' || quotesData?.status === 'declined'
                ? "Resend Official Quote"
                : "Send Official Quote"
              }
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      );
    }

    return null;
  };

  const handleClose = () => {
    navigate('/quotes');
  };

  return (
    <Edit
      saveButtonProps={saveButtonProps}
      deleteButtonProps={{
        onClick: handleQuoteDelete,
      }}
      headerButtons={({ defaultButtons }) => (
        <>
          {defaultButtons}
          <Button
            type="default"
            onClick={handleClose}
          >
            Close
          </Button>
        </>
      )}
    >
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
                label="Event Type"
                name="event_type"
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Form.Item
                label="Selected Service"
                name={["services", "name"]}
              >
                <Input readOnly disabled />
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

        <Card title="Event Schedule & Timing" style={{ marginBottom: 16 }}>
          <Row gutter={[16, 16]}>
            <Col span={8}>
              <Form.Item
                label="Event Structure"
                name="event_structure"
                rules={[{ required: true, message: 'Please select event structure' }]}
              >
                <Select>
                  <Option value="single_day">Single Day Event</Option>
                  <Option value="multi_day">Multi-Day Event</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="Event Duration (Days)"
                name="number_of_event_days"
                rules={[{ required: true, message: 'Please specify number of event days' }]}
              >
                <InputNumber style={{ width: '100%' }} min={1} max={30} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="Total Duration (Minutes)"
                name="duration_minutes"
                rules={[{ required: true, message: 'Please specify total duration' }]}
              >
                <InputNumber style={{ width: '100%' }} min={1} placeholder="Duration in minutes" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={[16, 16]}>
            <Col span={6}>
              <Form.Item
                label="Number of Event Days"
                name="number_of_event_days"
                tooltip="For multi-day events only"
              >
                <InputNumber min={1} max={30} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                label="Session Duration (mins)"
                name="session_duration_minutes"
                rules={[{ required: true, message: 'Please enter session duration' }]}
              >
                <InputNumber min={15} max={180} step={15} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                label="Total Sessions"
                name="total_sessions"
                rules={[{ required: true, message: 'Please enter total sessions' }]}
              >
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            {/* Removed duplicate Therapists Needed to avoid conflicting bindings; use the one in Service Specifications */}
          </Row>
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Form.Item
                label="Sessions Per Day"
                name="sessions_per_day"
                tooltip="For multi-day events: average sessions per day"
              >
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Preferred Therapists"
                name="preferred_therapists"
                tooltip="Number of different therapists client prefers"
              >
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card title="Service Specifications" style={{ marginBottom: 16 }}>
          <Row gutter={[16, 16]}>
            <Col span={12}>
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
              existingAssignments={therapistAssignments}
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