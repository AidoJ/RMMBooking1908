import React, { useState, useEffect } from 'react';
import {
  Edit,
  useForm,
} from '@refinedev/antd';
import { useDelete, useGetIdentity } from '@refinedev/core';
import { useParams, useNavigate } from 'react-router';
import {
  Form,
  Input,
  Select,
  InputNumber,
  Radio,
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
  Typography,
} from 'antd';

const { Text } = Typography;
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
import { calculateQuoteTotalFromQuoteDates } from '../../services/quoteFinancialCalculation';
import GooglePlacesAutocomplete from '../../components/GooglePlacesAutocomplete';
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
  const { data: identity } = useGetIdentity<any>();
  const isSuperAdmin = identity?.role === 'super_admin';

  // State management
  const [availabilityStatus, setAvailabilityStatus] = useState<'unchecked' | 'checking' | 'available' | 'partial' | 'unavailable'>('unchecked');
  const [therapistAssignments, setTherapistAssignments] = useState<TherapistAssignment[]>([]);
  const [workflowStep, setWorkflowStep] = useState(2); // Current step in workflow
  const [expandedSections, setExpandedSections] = useState<string[]>(['customer', 'event', 'schedule']);
  const [diaryLocks, setDiaryLocks] = useState<{ [key: string]: boolean }>({});
  const [eventLatitude, setEventLatitude] = useState<number | null>(null);
  const [eventLongitude, setEventLongitude] = useState<number | null>(null);
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
    quoteDeclined: false,
    quoteDeclinedAt: null as string | null,
    therapistConfirmationsSent: false,
    therapistConfirmationsSentAt: null as string | null,
    invoiceSent: false,
    invoiceSentAt: null as string | null,
    receiptSent: false,
    receiptSentAt: null as string | null,
    assignmentsChanged: false, // Track if assignments modified after quote sent
  });

  const [taxRatePercentage, setTaxRatePercentage] = useState<number>(10.0); // Default to 10% if not loaded
  const [maxHoursPerTherapist, setMaxHoursPerTherapist] = useState<number>(6);
  const [serviceArrangement, setServiceArrangement] = useState<'split' | 'multiply'>('split');
  const [invoiceDueDays, setInvoiceDueDays] = useState<number>(14); // Default 14 days
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentDate, setPaymentDate] = useState<any>(dayjs());
  const [paymentReference, setPaymentReference] = useState<string>('');

  // Change tracking state for schedule edits
  const [originalQuoteDates, setOriginalQuoteDates] = useState<any[]>([]);
  const [currentQuoteDates, setCurrentQuoteDates] = useState<any[]>([]);
  const [hasScheduleChanges, setHasScheduleChanges] = useState(false);
  const [hasAnyChanges, setHasAnyChanges] = useState(false);
  const [scheduleChangeDetected, setScheduleChangeDetected] = useState(false);
  const [quoteVersion, setQuoteVersion] = useState<number>(1);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Notify and reset availability state when therapists_needed changes
  const handleFormValuesChange = (changedValues: any, allValues: any) => {
    // Mark as having unsaved changes
    setHasUnsavedChanges(true);
    
    if (Object.prototype.hasOwnProperty.call(changedValues, 'therapists_needed') ||
        Object.prototype.hasOwnProperty.call(changedValues, 'service_arrangement')) {
      message.warning('Therapists Needed changed. Save to update availability and assignments.');
      setAvailabilityStatus('unchecked');
      setWorkflowState(prev => ({
        ...prev,
        availabilityConfirmed: false,
        quoteSent: false,
      }));
    }
  };

  // Function to explicitly update quotes table fields
  const updateQuoteFields = async (fieldsToUpdate: any) => {
    console.log('💾 Explicitly updating quotes table with:', fieldsToUpdate);
    const { error } = await supabaseClient
      .from('quotes')
      .update(fieldsToUpdate)
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to update quote: ${error.message}`);
    }

    console.log('✅ Quote fields updated successfully');
  };

  const { formProps, saveButtonProps, queryResult, form } = useForm({
    redirect: false, // Stay on page after save
    meta: {
      select: '*,quote_dates(*),services:service_id(id,name,service_base_price)',
    },
    onMutationSuccess: async (data, variables, context, isAutoSave) => {
      if (!isAutoSave) {
        // If schedule changed on a sent quote, delete all bookings
        if (scheduleChangeDetected && (quotesData?.status === 'sent' || quotesData?.status === 'accepted')) {
          console.log('🗑️ Schedule changed on sent quote - deleting all bookings');
          await supabaseClient
            .from('bookings')
            .delete()
            .eq('parent_quote_id', id);

          message.info('All existing bookings deleted due to schedule change. Re-check availability and re-assign therapists.');
        }

        // Handle quote_dates updates if there are schedule changes
        if (hasScheduleChanges && currentQuoteDates.length > 0) {
          await handleQuoteDatesUpdate();
        }

        // **NEW: Explicitly update quote-level fields that might not be auto-saved by Refine**
        const quoteFieldsToUpdate: any = {};

        // Get current form values for critical fields
        const currentServiceArrangement = form?.getFieldValue('service_arrangement');
        const currentTherapistsNeeded = form?.getFieldValue('therapists_needed');

        // Check if these fields changed from original
        if (currentServiceArrangement && currentServiceArrangement !== quotesData?.service_arrangement) {
          quoteFieldsToUpdate.service_arrangement = currentServiceArrangement;
          console.log('📝 service_arrangement changed:', quotesData?.service_arrangement, '→', currentServiceArrangement);
        }

        if (currentTherapistsNeeded && currentTherapistsNeeded !== quotesData?.therapists_needed) {
          quoteFieldsToUpdate.therapists_needed = currentTherapistsNeeded;
          console.log('📝 therapists_needed changed:', quotesData?.therapists_needed, '→', currentTherapistsNeeded);
        }

        // Also include calculated fields that must be saved
        const calculatedFields = {
          total_amount: form?.getFieldValue('total_amount'),
          gst_amount: form?.getFieldValue('gst_amount'),
          final_amount: form?.getFieldValue('final_amount'),
          discount_amount: form?.getFieldValue('discount_amount'),
          duration_minutes: form?.getFieldValue('duration_minutes'),
          session_duration_minutes: form?.getFieldValue('session_duration_minutes'),
          total_sessions: form?.getFieldValue('total_sessions'),
        };

        // Only include calculated fields if they have values
        Object.entries(calculatedFields).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            quoteFieldsToUpdate[key] = value;
          }
        });

        // Explicitly update the quotes table if there are fields to update
        if (Object.keys(quoteFieldsToUpdate).length > 0) {
          try {
            await updateQuoteFields(quoteFieldsToUpdate);
          } catch (error) {
            message.error('Failed to save quote changes: ' + (error instanceof Error ? error.message : 'Unknown error'));
            return; // Don't proceed if save failed
          }
        }

        message.success('Quote updated successfully');
        // Reset change tracking after successful save
        setHasScheduleChanges(false);
        setHasAnyChanges(false);
        setScheduleChangeDetected(false);
        setHasUnsavedChanges(false);
        setOriginalQuoteDates([...currentQuoteDates]);

        // Refetch quote data to reload updated quote_dates from DB
        queryResult?.refetch();
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
            'quote_declined_at', 'invoice_sent_at', 'quote_valid_until'
          ];

          timestampFields.forEach(field => {
            if (transformedData[field]) {
              transformedData[field] = dayjs(transformedData[field]);
            }
          });

          // Payment dates are display-only (using Input not DatePicker), no conversion needed

          // Set hourly rate from service base price if available and not already set
          if (transformedData.services && transformedData.services.service_base_price && !transformedData.hourly_rate) {
            transformedData.hourly_rate = transformedData.services.service_base_price;
          }

          // Normalize therapists_needed to a number with fallback 1
          const tn = transformedData.therapists_needed;
          const coerced = typeof tn === 'string' ? parseInt(tn, 10) : (typeof tn === 'number' ? tn : undefined);
          transformedData.therapists_needed = Number.isFinite(coerced as number) && (coerced as number) > 0 ? (coerced as number) : 1;

          // Set the transformed data to the form
          form?.setFieldsValue(transformedData);
          // Ensure the field is explicitly set if missing
          if (!transformedData.therapists_needed) {
            form?.setFieldValue('therapists_needed', 1);
          }
        }
      }
    }
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

  // Watch for changes to auto-calculate session-related fields
  const expectedAttendees = Form.useWatch('expected_attendees', form);
  const numberOfEventDays = Form.useWatch('number_of_event_days', form);

  // Detect schedule changes (date/time/duration) and trigger reset
  useEffect(() => {
    if (!originalQuoteDates.length || !currentQuoteDates.length) return;

    // Check if any critical schedule field changed
    const hasChanges = currentQuoteDates.some((current: any, index: number) => {
      const original = originalQuoteDates[index];
      if (!original) return true; // New day added

      const currentDate = dayjs(current.event_date).format('YYYY-MM-DD');
      const originalDate = dayjs(original.event_date).format('YYYY-MM-DD');
      const currentStart = dayjs(current.start_time).format('HH:mm');
      const originalStart = dayjs(original.start_time).format('HH:mm');
      const currentFinish = dayjs(current.finish_time).format('HH:mm');
      const originalFinish = dayjs(original.finish_time).format('HH:mm');

      return currentDate !== originalDate ||
             currentStart !== originalStart ||
             currentFinish !== originalFinish ||
             current.duration_minutes !== original.duration_minutes;
    });

    if (hasChanges && (quotesData?.status === 'sent' || quotesData?.status === 'accepted')) {
      console.log('⚠️ Schedule change detected on sent quote');
      setScheduleChangeDetected(true);
      setHasScheduleChanges(true);
      
      // Clear assignments and reset availability
      setTherapistAssignments([]);
      setAvailabilityStatus('unchecked');
      setWorkflowState(prev => ({
        ...prev,
        availabilityConfirmed: false
      }));
      
      message.warning('⚠️ Schedule changed. Save changes, then re-check availability and re-assign therapists before re-sending quote.');
    }
  }, [currentQuoteDates, originalQuoteDates, quotesData?.status]);

  // Watch for financial calculation dependencies (moved up to avoid hoisting issues)
  const hourlyRate = Form.useWatch('hourly_rate', form);
  const singleEventDate = Form.useWatch('single_event_date', form);
  const quoteDates = Form.useWatch('quote_dates', form);
  const watchedTherapistsNeeded = Form.useWatch('therapists_needed', form);
  const watchedServiceArrangement = Form.useWatch('service_arrangement', form);

  // Calculate time validation based on event structure - updated for real-time calculations
  useEffect(() => {
    const updateTimeValidation = () => {
      // Get current form values (these will be auto-calculated)
      const totalSessions = expectedAttendees || form?.getFieldValue('total_sessions') || quotesData?.total_sessions || 0;
      const sessionDuration = form?.getFieldValue('session_duration_minutes') || quotesData?.session_duration_minutes || 0;

      let eventDuration = 0;

      if (quotesData?.event_structure === 'single_day') {
        // For single day: use duration_minutes field (unified structure)
        eventDuration = quotesData.duration_minutes || 0;
      } else if (quotesData?.event_structure === 'multi_day') {
        // For multi-day: sum all day durations from currentQuoteDates (real-time)
        eventDuration = currentQuoteDates.reduce((total: number, day: any) => {
          if (day.start_time && day.finish_time) {
            const startTime = typeof day.start_time === 'string' ? day.start_time :
              (dayjs.isDayjs(day.start_time) ? day.start_time.format('HH:mm:ss') : '');
            const finishTime = typeof day.finish_time === 'string' ? day.finish_time :
              (dayjs.isDayjs(day.finish_time) ? day.finish_time.format('HH:mm:ss') : '');

            if (startTime && finishTime) {
              return total + calculateDayDuration(startTime, finishTime);
            }
          }
          return total;
        }, 0);
      }

      // Get service arrangement details
      const therapistsNeeded = form?.getFieldValue('therapists_needed') || 1;
      const arrangement = form?.getFieldValue('service_arrangement') || serviceArrangement;
      
      // Calculate actual therapist time based on arrangement
      let totalTherapistDuration = eventDuration; // Base event duration from schedule
      let calculatedSessionDuration = 0;

      if (arrangement === 'multiply' && therapistsNeeded > 1) {
        // Multiply mode: total therapist-hours = base duration × therapists
        totalTherapistDuration = eventDuration * therapistsNeeded;
        // Session duration increases proportionally
        calculatedSessionDuration = totalSessions > 0 ? totalTherapistDuration / totalSessions : 0;
        
        console.log('🔢 MULTIPLY MODE CALCULATION:', {
          baseEventDuration: eventDuration,
          therapistsNeeded,
          totalTherapistDuration,
          totalSessions,
          calculatedSessionDuration
        });
      } else {
        // Split mode: duration stays the same
        totalTherapistDuration = eventDuration;
        calculatedSessionDuration = totalSessions > 0 ? eventDuration / totalSessions : 0;
        
        console.log('🔢 SPLIT MODE CALCULATION:', {
          eventDuration,
          totalSessions,
          calculatedSessionDuration
        });
      }

      // Service Duration equals total therapist duration
      const serviceDuration = totalTherapistDuration;
      const isValid = true; // Always valid since we're calculating it
      setTimeValidation({ eventDuration: totalTherapistDuration, serviceDuration, isValid });

      // Update form fields for database submission
      form.setFieldValue('duration_minutes', totalTherapistDuration);
      form.setFieldValue('session_duration_minutes', Math.round(calculatedSessionDuration));

      console.log('💾 Setting form fields:', {
        duration_minutes: totalTherapistDuration,
        session_duration_minutes: Math.round(calculatedSessionDuration)
      });
    };

    if (quotesData) {
      updateTimeValidation();
    }
  }, [quotesData, currentQuoteDates, expectedAttendees, form, serviceArrangement, watchedTherapistsNeeded, watchedServiceArrangement]);


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

    const fetchOps = async () => {
      await fetchTaxRate();
      try {
        const maxHours = await getSystemSetting('max_hours_per_therapist_per_day', 'integer', 6);
        setMaxHoursPerTherapist(maxHours && maxHours > 0 ? maxHours : 6);
      } catch (e) {
        setMaxHoursPerTherapist(6);
      }
      try {
        const dueDays = await getSystemSetting('invoice_due_days', 'integer', 14);
        setInvoiceDueDays(dueDays && dueDays > 0 ? dueDays : 14);
      } catch (e) {
        setInvoiceDueDays(14);
      }
    };

    fetchOps();
  }, []);

  // Load existing therapist assignments from bookings table
  useEffect(() => {
    const loadExistingAssignments = async () => {
      if (!id || !quotesData) return;

      try {
        const supabase = supabaseClient;

        // Query bookings with therapist profile data - specify the exact foreign key relationship
        const { data: bookingsData, error } = await supabase
          .from('bookings')
          .select(`
            booking_time,
            therapist_id,
            therapist_fee,
            duration_minutes,
            therapist_profiles!bookings_therapist_id_fkey(first_name, last_name, hourly_rate, afterhours_rate)
          `)
          .eq('parent_quote_id', id)
          .order('booking_time');

        if (error) {
          console.error('Error loading existing assignments:', error);
          return;
        }

        if (bookingsData && bookingsData.length > 0) {
          console.log('Found existing bookings:', bookingsData.length, 'for quote status:', quotesData?.status);

          // Transform to TherapistAssignment format
          const assignments: TherapistAssignment[] = bookingsData.map((booking: any) => {
            const date = booking.booking_time.split('T')[0]; // YYYY-MM-DD - direct string split to avoid timezone issues
            const bookingDateTime = new Date(booking.booking_time);
            const time = bookingDateTime.toTimeString().split(' ')[0]; // HH:MM:SS

            // Use the therapist's rates from their profile
            const hourlyRate = booking.therapist_profiles.hourly_rate || 0;
            const afterhoursRate = booking.therapist_profiles.afterhours_rate || 0;

            return {
              date,
              start_time: time,
              therapist_id: booking.therapist_id,
              therapist_name: `${booking.therapist_profiles.first_name} ${booking.therapist_profiles.last_name}`,
              hourly_rate: hourlyRate,
              afterhours_rate: afterhoursRate,
              is_override: false
            };
          });

          console.log('Transformed assignments:', assignments);
          setTherapistAssignments(assignments);
          setAvailabilityStatus('available');
          
          // Set appropriate workflow step based on quote status
          if (quotesData?.status === 'accepted' || quotesData?.status === 'confirmed') {
            setWorkflowStep(5); // Client has accepted
            setWorkflowState(prev => ({
              ...prev,
              availabilityConfirmed: true,
              quoteSent: true,
              quoteAccepted: true,
              quoteAcceptedAt: quotesData?.quote_accepted_at ? new Date(quotesData.quote_accepted_at).toLocaleDateString() : null
            }));
          } else if (quotesData?.status === 'declined') {
            setWorkflowStep(4); // Quote was declined
            setWorkflowState(prev => ({
              ...prev,
              availabilityConfirmed: true,
              quoteSent: true,
              quoteDeclined: true,
              quoteDeclinedAt: quotesData?.quote_declined_at ? new Date(quotesData.quote_declined_at).toLocaleDateString() : null
            }));
          } else if (quotesData?.status === 'sent') {
            setWorkflowStep(4); // Quote sent, waiting for response
            setWorkflowState(prev => ({
              ...prev,
              availabilityConfirmed: true,
              quoteSent: true,
              quoteSentAt: quotesData?.quote_sent_at ? new Date(quotesData.quote_sent_at).toLocaleDateString() : null
            }));
          } else {
            setWorkflowStep(3); // Has assignments but not sent yet
          }
        }
      } catch (error) {
        console.error('Error loading existing assignments:', error);
      }
    };

    loadExistingAssignments();
  }, [id, quotesData]);


  // State to store calculation breakdown for display
  const [calculationBreakdown, setCalculationBreakdown] = useState<string>('');

  // Auto-calculate Total Amount when financial dependencies change
  useEffect(() => {
    const calculateTotalAmount = async () => {
      // Only calculate if we have the required inputs
      if (!hourlyRate || timeValidation.eventDuration <= 0) {
        return;
      }

      try {
        // Extract event dates from the form
        const eventDates: string[] = [];

        if (quotesData?.event_structure === 'single_day') {
          if (singleEventDate) {
            eventDates.push(dayjs(singleEventDate).format('YYYY-MM-DD'));
          } else if (quotesData?.single_event_date) {
            eventDates.push(quotesData.single_event_date);
          }
        } else {
          // Multi-day event - extract from quote_dates or form data
          const quoteDateData = quoteDates || quotesData?.quote_dates;
          if (quoteDateData && Array.isArray(quoteDateData)) {
            quoteDateData.forEach((dateEntry: any) => {
              if (dateEntry.event_date) {
                eventDates.push(dateEntry.event_date);
              }
            });
          }
        }

        if (eventDates.length === 0) {
          console.warn('No event dates found for total amount calculation');
          return;
        }

        // Calculate total amount with weekend/after-hours uplift using per-day quote_dates
        const quoteDateData = quoteDates || quotesData?.quote_dates || [];
        const normalizedQuoteDates = (quoteDateData || []).map((d: any) => ({
          event_date: dayjs(d.event_date).format('YYYY-MM-DD'),
          start_time: d.start_time ? dayjs(d.start_time).format('HH:mm') : d.start_time,
          finish_time: d.finish_time ? dayjs(d.finish_time).format('HH:mm') : d.finish_time,
          duration_minutes: d.duration_minutes
        }));

        let result = await calculateQuoteTotalFromQuoteDates(
          hourlyRate,
          normalizedQuoteDates
        );

        // If arrangement is multiply, scale totals by therapists_needed
        const therapistsNeeded = form?.getFieldValue('therapists_needed') || 1;
        const arrangement = form?.getFieldValue('service_arrangement') || serviceArrangement;
        if (arrangement === 'multiply' && therapistsNeeded > 1) {
          result = {
            ...result,
            totalAmount: parseFloat((result.totalAmount * therapistsNeeded).toFixed(2)),
            calculationBreakdown: result.calculationBreakdown + `\nArrangement: Multiply × ${therapistsNeeded} therapist(s)`
          };
        }

        // Update the total_amount field and store breakdown
        console.log('🔄 Setting total_amount to:', result.totalAmount);

        // Force update the field with multiple approaches
        form?.setFieldValue('total_amount', result.totalAmount);
        form?.setFieldsValue({ total_amount: result.totalAmount });
        setCalculationBreakdown(result.calculationBreakdown);

        // Update display state to force re-render
        setTotalAmountDisplay(result.totalAmount);

        // Force form to re-render
        form?.validateFields(['total_amount']).catch(() => {});

        // Verify the field was actually set
        setTimeout(() => {
          const currentValue = form?.getFieldValue('total_amount');
          console.log('✅ Total amount field value after update:', currentValue);

          // If field is still empty, try one more time
          if (!currentValue || currentValue !== result.totalAmount) {
            console.log('🔄 Field value mismatch, forcing another update...');
            form?.setFieldValue('total_amount', result.totalAmount);
            form?.setFieldsValue({ total_amount: result.totalAmount });
          }
        }, 100);

        console.log('📊 Financial calculation:', {
          eventDuration: timeValidation.eventDuration,
          hourlyRate,
          eventDates,
          hasWeekendDays: result.hasWeekendDays,
          weekendUpliftPercentage: result.weekendUpliftPercentage,
          weekendUpliftAmount: result.weekendUpliftAmount,
          baseAmount: result.baseAmount,
          totalAmount: result.totalAmount,
          breakdown: result.calculationBreakdown
        });

      } catch (error) {
        console.error('Error calculating total amount:', error);
      }
    };

    calculateTotalAmount();
  }, [hourlyRate, timeValidation.eventDuration, singleEventDate, quoteDates, quotesData?.quote_dates, watchedServiceArrangement, watchedTherapistsNeeded, form]);

  // Watch for changes in total_amount and discount_amount to auto-calculate GST and final amount
  const totalAmount = Form.useWatch('total_amount', form);
  const discountAmount = Form.useWatch('discount_amount', form);

  // Force re-render of total amount field by watching it
  const [totalAmountDisplay, setTotalAmountDisplay] = useState<number | undefined>(totalAmount);

  // Auto-calculate GST and Final Amount when watched values change
  useEffect(() => {
    if (totalAmount != null && discountAmount != null) {
      // Final amount is total minus discount (GST-inclusive amount)
      const finalAmount = totalAmount - discountAmount;

      // Extract GST from GST-inclusive final amount (finalAmount ÷ 1.1 to get GST portion)
      const gstAmount = finalAmount > 0 ? finalAmount - (finalAmount / 1.1) : 0;

      // Update form fields
      form.setFieldValue('gst_amount', parseFloat(gstAmount.toFixed(2)));
      form.setFieldValue('final_amount', parseFloat(finalAmount.toFixed(2)));
    }
  }, [totalAmount, discountAmount, taxRatePercentage, form]);

  // Auto-calculate sessions based on Expected Attendees and Event Days
  useEffect(() => {
    if (expectedAttendees && numberOfEventDays) {
      // Phase 2b: Auto-calculate Sessions per Day
      const sessionsPerDay = Math.ceil(expectedAttendees / numberOfEventDays);

      // Update sessions count for each day in currentQuoteDates
      const newDates = currentQuoteDates.map(day => ({
        ...day,
        sessions_count: sessionsPerDay
      }));
      if (newDates.length > 0) {
        updateCurrentQuoteDates(newDates);
      }

      // Phase 2c: Set Total Sessions = Expected Attendees
      form.setFieldValue('total_sessions', expectedAttendees);

      // Update hidden form fields for database submission
      form.setFieldValue('sessions_per_day', sessionsPerDay);

      // Phase 2d: Auto-calculate Session Duration from schedule
      calculateSessionDuration();
    }
  }, [expectedAttendees, numberOfEventDays, form]);

  // Calculate session duration based on total event duration and total sessions
  const calculateSessionDuration = () => {
    const totalSessions = expectedAttendees || form.getFieldValue('total_sessions');
    if (!totalSessions || totalSessions === 0) return;

    // Calculate total event duration from currentQuoteDates
    let totalEventDurationMinutes = 0;
    currentQuoteDates.forEach(day => {
      if (day.start_time && day.finish_time) {
        const startTime = typeof day.start_time === 'string' ? day.start_time :
          (dayjs.isDayjs(day.start_time) ? day.start_time.format('HH:mm:ss') : '');
        const finishTime = typeof day.finish_time === 'string' ? day.finish_time :
          (dayjs.isDayjs(day.finish_time) ? day.finish_time.format('HH:mm:ss') : '');

        if (startTime && finishTime) {
          totalEventDurationMinutes += calculateDayDuration(startTime, finishTime);
        }
      }
    });

    if (totalEventDurationMinutes > 0) {
      const sessionDurationMinutes = totalEventDurationMinutes / totalSessions;
      form.setFieldValue('session_duration_minutes', sessionDurationMinutes);
    }
  };

  // Recalculate when schedule changes
  useEffect(() => {
    calculateSessionDuration();
  }, [currentQuoteDates, expectedAttendees]);

  // Ensure hourly rate is set from service base price when quote data loads
  useEffect(() => {
    if (quotesData?.services?.service_base_price) {
      const currentHourlyRate = form?.getFieldValue('hourly_rate');
      if (!currentHourlyRate) {
        form?.setFieldValue('hourly_rate', quotesData.services.service_base_price);
      }
    }
  }, [quotesData, form]);

  // Initialize original quote dates for change tracking
  useEffect(() => {
    if (quotesData?.quote_dates) {
      const originalDates = [...quotesData.quote_dates];
      setOriginalQuoteDates(originalDates);
      setCurrentQuoteDates(originalDates);
    }
  }, [quotesData]);

  // Load event coordinates when quote data loads
  useEffect(() => {
    if (quotesData) {
      setEventLatitude((quotesData as any).latitude || null);
      setEventLongitude((quotesData as any).longitude || null);
    }
  }, [quotesData]);

  // Helper function to calculate duration from start and end times
  const calculateDayDuration = (startTime: string, finishTime: string): number => {
    if (!startTime || !finishTime) return 0;
    const start = dayjs(`2000-01-01 ${startTime}`);
    const end = dayjs(`2000-01-01 ${finishTime}`);
    return end.diff(start, 'minute');
  };

  // Helper function to update current quote dates and detect changes
  const updateCurrentQuoteDates = (newDates: any[]) => {
    setCurrentQuoteDates(newDates);
    const hasChanges = JSON.stringify(originalQuoteDates) !== JSON.stringify(newDates);
    setHasScheduleChanges(hasChanges);
    setHasAnyChanges(hasChanges); // For now, just schedule changes
  };

  // Handle quote_dates table updates with smart upsert approach
  const handleQuoteDatesUpdate = async () => {
    if (!id) return;

    try {
      const supabase = supabaseClient;

      console.log('Starting quote dates update...');
      console.log('Original quote dates:', originalQuoteDates);
      console.log('Current quote dates:', currentQuoteDates);

      // Get existing quote_dates from database to compare
      const { data: existingQuoteDates, error: fetchError } = await supabase
        .from('quote_dates')
        .select('*')
        .eq('quote_id', id)
        .order('id');

      if (fetchError) {
        console.error('Error fetching existing quote dates:', fetchError);
        message.error('Failed to fetch existing schedule: ' + fetchError.message);
        return;
      }

      console.log('Existing quote dates from database:', existingQuoteDates);

      // Prepare current quote dates data
      const currentProcessedDates = currentQuoteDates.map((dateEntry, index) => {
        console.log(`Processing date entry ${index}:`, dateEntry);

        // Extract values from dayjs objects or use string values
        let eventDate = null;
        if (dateEntry.event_date) {
          if (dayjs.isDayjs(dateEntry.event_date)) {
            eventDate = dateEntry.event_date.format('YYYY-MM-DD');
          } else if (typeof dateEntry.event_date === 'string') {
            eventDate = dateEntry.event_date;
          } else if (dateEntry.event_date instanceof Date) {
            eventDate = dayjs(dateEntry.event_date).format('YYYY-MM-DD');
          }
        }

        let startTime = null;
        if (dateEntry.start_time) {
          if (dayjs.isDayjs(dateEntry.start_time)) {
            startTime = dateEntry.start_time.format('HH:mm:ss');
          } else if (typeof dateEntry.start_time === 'string') {
            startTime = dateEntry.start_time;
          }
        }

        let finishTime = null;
        if (dateEntry.finish_time) {
          if (dayjs.isDayjs(dateEntry.finish_time)) {
            finishTime = dateEntry.finish_time.format('HH:mm:ss');
          } else if (typeof dateEntry.finish_time === 'string') {
            finishTime = dateEntry.finish_time;
          }
        }

        // Calculate duration if both times are provided
        const durationMinutes = startTime && finishTime
          ? calculateDayDuration(startTime, finishTime)
          : (dateEntry.duration_minutes || 0);

        return {
          id: (dateEntry.id && !String(dateEntry.id).startsWith('temp-')) ? dateEntry.id : null, // Only preserve real database IDs
          quote_id: id, // Use the quote ID from the URL/form
          day_number: dateEntry.day_number || (index + 1), // Ensure day_number is included
          event_date: eventDate,
          start_time: startTime,
          finish_time: finishTime,
          duration_minutes: durationMinutes,
          sessions_count: dateEntry.sessions_count || 1,
        };
      }).filter(entry => entry.event_date && entry.event_date !== null);

      console.log('Processed current dates:', currentProcessedDates);

      if (currentProcessedDates.length === 0) {
        console.error('No valid quote dates to save!');
        message.error('No valid dates to save. Please ensure all dates are properly filled.');
        return;
      }

      // Smart update approach:
      // 1. Update existing records that have IDs
      // 2. Insert new records without IDs
      // 3. Delete records that are no longer in the current list

      const recordsToUpdate = currentProcessedDates.filter(entry => entry.id);
      const recordsToInsert = currentProcessedDates.filter(entry => !entry.id);
      const existingIds = (existingQuoteDates || []).map(item => item.id);
      const currentIds = recordsToUpdate.map(item => item.id);
      const idsToDelete = existingIds.filter(id => !currentIds.includes(id));

      console.log('Records to update:', recordsToUpdate);
      console.log('Records to insert:', recordsToInsert);
      console.log('IDs to delete:', idsToDelete);

      // Delete removed records
      if (idsToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('quote_dates')
          .delete()
          .in('id', idsToDelete);

        if (deleteError) {
          console.error('Error deleting removed quote dates:', deleteError);
          message.error('Failed to delete removed dates: ' + deleteError.message);
          return;
        }
        console.log('Deleted records with IDs:', idsToDelete);
      }

      // Update existing records
      for (const record of recordsToUpdate) {
        const { id: recordId, ...updateData } = record;
        const { error: updateError } = await supabase
          .from('quote_dates')
          .update(updateData)
          .eq('id', recordId);

        if (updateError) {
          console.error('Error updating quote date record:', updateError);
          message.error('Failed to update existing date: ' + updateError.message);
          return;
        }
        console.log('Updated record ID:', recordId);
      }

      // Insert new records
      if (recordsToInsert.length > 0) {
        const insertData = recordsToInsert.map(({ id, ...rest }) => rest); // Remove null id field
        const { error: insertError } = await supabase
          .from('quote_dates')
          .insert(insertData);

        if (insertError) {
          console.error('Error inserting new quote dates:', insertError);
          message.error('Failed to save new dates: ' + insertError.message);
          return;
        }
        console.log('Inserted new records:', insertData);
      }

      console.log('Quote dates updated successfully!');
      message.success('Schedule updated successfully');
    } catch (error) {
      console.error('Error updating quote dates:', error);
      message.error('Failed to update schedule: ' + (error as Error).message);
    }
  };

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

  // Format time for display - round to nearest minute to handle floating-point precision
  const formatMinutesToTime = (minutes: number) => {
    const totalMinutes = Math.round(minutes); // Round to nearest minute for clean display
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    if (hours === 0) return `${mins} minute${mins !== 1 ? 's' : ''}`;
    if (mins === 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
    return `${hours} hour${hours > 1 ? 's' : ''} ${mins} minute${mins !== 1 ? 's' : ''}`;
  };

  // Calculate therapists needed
  const calculateTherapistsNeeded = () => {
    const totalMinutes = (quotesData?.total_sessions || 0) * (quotesData?.session_duration_minutes || 0);
    const totalHours = totalMinutes / 60;
    return totalHours < 12 ? 1 : 2;
  };

  // Removed calculateFinishTime - using unified structure with quote_dates

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

    // CLEAN WORKFLOW: Just confirm in UI state, don't touch DB yet
    const now = new Date().toLocaleDateString();
    setWorkflowState(prev => ({
      ...prev,
      availabilityConfirmed: true,
      availabilityConfirmedAt: now
    }));

    message.success(`✅ Therapist Availability confirmed ${now}`);
    setWorkflowStep(4); // Move to "ready to send" step
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

      // Delete any existing bookings first (in case of re-send after changes)
      const { data: existingBookings } = await supabaseClient
        .from('bookings')
        .select('id')
        .eq('parent_quote_id', id);

      if (existingBookings && existingBookings.length > 0) {
        console.log('🗑️ Deleting', existingBookings.length, 'existing bookings before recreating...');
        await supabaseClient
          .from('bookings')
          .delete()
          .eq('parent_quote_id', id);
      }

      // Create pending bookings NOW (blocks therapist diaries)
      const currentArrangement = form?.getFieldValue('service_arrangement') || (quotesData as any)?.service_arrangement || 'split';
      const bookingResult = await createBookingsFromQuote(
        { ...(quotesData as any), service_arrangement: currentArrangement } as any,
        therapistAssignments
      );

      if (!bookingResult.success) {
        message.destroy();
        throw new Error(bookingResult.error || 'Failed to create bookings');
      }

      console.log('✅ Created', bookingResult.bookingIds?.length, 'pending bookings');

      // Fetch business_email from system settings for archive
      const businessEmail = await getSystemSetting('business_email', 'string', '');

      // Send official quote email (with BCC to business email for archive)
      const emailResult = await EmailService.sendEnhancedOfficialQuote(
        quotesData,
        therapistAssignments,
        bookingResult.bookingIds || [],
        businessEmail
      );

      if (!emailResult.success) {
        message.destroy();
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
        quoteSentAt: now,
        assignmentsChanged: false // Clear changed flag after sending
      }));

      message.destroy();
      message.success(`📧 Official Quote sent ${now}! Client will receive email with Accept/Decline options.`);
      setWorkflowStep(5);
      queryResult?.refetch();

    } catch (error) {
      message.destroy();
      console.error('Error sending quote:', error);
      message.error('Failed to send official quote: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleResendQuote = async () => {
    try {
      message.loading('Re-sending official quote...', 0);

      // Increment version
      const newVersion = quoteVersion + 1;
      setQuoteVersion(newVersion);

      // Delete all existing bookings and recreate with current assignments
      console.log('🗑️ Deleting all existing bookings for quote:', id);
      await supabaseClient
        .from('bookings')
        .delete()
        .eq('parent_quote_id', id);

      // Recreate bookings with current arrangement
      const currentArrangement = form?.getFieldValue('service_arrangement') || (quotesData as any)?.service_arrangement || 'split';
      const bookingResult = await createBookingsFromQuote(
        { ...(quotesData as any), service_arrangement: currentArrangement } as any,
        therapistAssignments
      );

      if (!bookingResult.success) {
        message.destroy();
        throw new Error(bookingResult.error || 'Failed to create bookings');
      }

      console.log('✅ Created', bookingResult.bookingIds?.length, 'bookings');

      // Reset quote status to 'sent' (in case it was accepted/confirmed)
      await supabaseClient
        .from('quotes')
        .update({
          status: 'sent',
          quote_sent_at: new Date().toISOString()
        })
        .eq('id', id);

      // Update bookings to pending (in case they were confirmed)
      await supabaseClient
        .from('bookings')
        .update({ status: 'pending' })
        .eq('parent_quote_id', id);

      // Fetch business_email from system settings for archive
      const businessEmail = await getSystemSetting('business_email', 'string', '');

      // Send official quote email with version (with BCC to business email for archive)
      const emailResult = await EmailService.sendEnhancedOfficialQuote(
        { ...quotesData, quote_version: newVersion },
        therapistAssignments,
        bookingResult.bookingIds || [],
        businessEmail
      );

      if (!emailResult.success) {
        throw new Error('Failed to re-send quote email');
      }

      // Reset workflow state to 'sent' (clear accepted/declined)
      setWorkflowState(prev => ({
        ...prev,
        assignmentsChanged: false,
        quoteAccepted: false,
        quoteDeclined: false
      }));

      message.destroy();
      message.success(`📧 Official Quote re-sent successfully (Rev ${newVersion}). Status reset to 'Sent' - awaiting client response.`);
      queryResult?.refetch();
    } catch (error) {
      message.destroy();
      message.error('Failed to re-send quote: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleMarkAccepted = async () => {
    Modal.confirm({
      title: '✅ Mark Quote as Accepted',
      content: 'This will update the quote status to Accepted and confirm all therapist bookings. Continue?',
      okText: 'Yes, Mark Accepted',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          message.loading('Updating quote status...', 0);

          // Update all bookings to confirmed
          await supabaseClient
            .from('bookings')
            .update({ status: 'confirmed' })
            .eq('parent_quote_id', id);

          // Update quote status
          await supabaseClient
            .from('quotes')
            .update({
              status: 'accepted',
              quote_accepted_at: new Date().toISOString()
            })
            .eq('id', id);

          const now = new Date().toLocaleDateString();
          setWorkflowState(prev => ({
            ...prev,
            quoteAccepted: true,
            quoteAcceptedAt: now
          }));

          message.destroy();
          message.success(`✅ Quote marked as Accepted ${now}. Therapist bookings confirmed.`);
          queryResult?.refetch();
        } catch (error) {
          message.destroy();
          message.error('Failed to mark quote as accepted');
        }
      }
    });
  };

  const handleMarkDeclined = async () => {
    Modal.confirm({
      title: '❌ Mark Quote as Declined',
      content: 'This will update the quote status to Declined and delete all bookings (unblocks therapist diaries). Continue?',
      okText: 'Yes, Mark Declined',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          message.loading('Updating quote status...', 0);

          // Delete all bookings to unblock therapist diaries
          const { error: deleteError } = await supabaseClient
            .from('bookings')
            .delete()
            .eq('parent_quote_id', id);

          if (deleteError) {
            console.error('Error deleting bookings:', deleteError);
            throw deleteError;
          }

          // Update quote status with timestamp
          const { error: updateError } = await supabaseClient
            .from('quotes')
            .update({
              status: 'declined',
              quote_declined_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', id);

          if (updateError) {
            console.error('Error updating quote status:', updateError);
            throw updateError;
          }

          const now = new Date().toLocaleDateString();
          setWorkflowState(prev => ({
            ...prev,
            quoteDeclined: true,
            quoteDeclinedAt: now
          }));

          message.destroy();
          message.success(`❌ Quote marked as Declined ${now}. All bookings deleted.`);
          queryResult?.refetch();
        } catch (error: any) {
          console.error('Error in handleMarkDeclined:', error);
          message.destroy();
          message.error(`Failed to mark quote as declined: ${error.message || 'Unknown error'}`);
        }
      }
    });
  };

  const handleMarkPaid = async () => {
    Modal.confirm({
      title: '💳 Mark as Paid',
      content: 'Mark this quote as paid? This will update the payment status.',
      okText: 'Yes, Mark Paid',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          message.loading('Updating payment status...', 0);

          await supabaseClient
            .from('quotes')
            .update({
              payment_status: 'paid',
              paid_date: new Date().toISOString()
            })
            .eq('id', id);

          message.destroy();
          message.success('💳 Quote marked as Paid');
          queryResult?.refetch();
        } catch (error) {
          message.destroy();
          message.error('Failed to mark as paid');
        }
      }
    });
  };

  const handleMarkInvoiced = async () => {
    Modal.confirm({
      title: '💰 Mark as Invoiced',
      content: 'Mark this quote as invoiced? This will generate an invoice number and set the payment due date.',
      okText: 'Yes, Mark Invoiced',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          message.loading('Updating invoice status...', 0);

          // Generate invoice number
          const invoiceNumber = `INV-${id}-${Date.now().toString().slice(-6)}`;
          
          // Calculate payment due date
          const dueDate = dayjs().add(invoiceDueDays, 'day').format('YYYY-MM-DD');

          await supabaseClient
            .from('quotes')
            .update({
              invoice_number: invoiceNumber,
              invoice_sent_at: new Date().toISOString(),
              payment_due_date: dueDate
            })
            .eq('id', id);

          const now = new Date().toLocaleDateString();
          setWorkflowState(prev => ({
            ...prev,
            invoiceSent: true,
            invoiceSentAt: now
          }));

          message.destroy();
          message.success(`💰 Quote marked as Invoiced. Invoice #${invoiceNumber}, Due: ${dayjs(dueDate).format('DD/MM/YYYY')}`);
          queryResult?.refetch();
        } catch (error) {
          message.destroy();
          message.error('Failed to mark as invoiced');
        }
      }
    });
  };

  const handleRecordPayment = async () => {
    try {
      message.loading('Recording payment...', 0);

      const updateData: any = {
        payment_status: 'paid',
        paid_amount: paymentAmount,
        paid_date: paymentDate.format('YYYY-MM-DD')
      };

      if (paymentReference) {
        updateData.notes = `Payment recorded: ${paymentReference}`;
      }

      await supabaseClient
        .from('quotes')
        .update(updateData)
        .eq('id', id);

      // Also update bookings payment status
      await supabaseClient
        .from('bookings')
        .update({ payment_status: 'paid' })
        .eq('parent_quote_id', id);

      message.destroy();
      message.success(`💳 Payment of $${paymentAmount.toFixed(2)} recorded successfully`);
      setShowRecordPaymentModal(false);
      queryResult?.refetch();
    } catch (error) {
      message.destroy();
      message.error('Failed to record payment');
    }
  };

  const handleSendTherapistConfirmations = async () => {
    try {
      message.loading('Sending confirmations to therapists...', 0);

      if (!therapistAssignments || therapistAssignments.length === 0) {
        message.destroy();
        message.error('No therapist assignments found');
        return;
      }

      // Group bookings by therapist
      const therapistGroups: Record<string, any[]> = {};
      for (const assignment of therapistAssignments) {
        if (!therapistGroups[assignment.therapist_id]) {
          therapistGroups[assignment.therapist_id] = [];
        }
        therapistGroups[assignment.therapist_id].push(assignment);
      }

      // Send email to each therapist
      for (const [therapistId, assignments] of Object.entries(therapistGroups)) {
        const firstAssignment = assignments[0];
        
        // Generate schedule HTML for this therapist
        const scheduleHTML = assignments.map(a => {
          const hours = (a.duration_minutes || 0) / 60;
          return `
            <div class="schedule-item">
              <div class="schedule-date">${dayjs(a.date).format('dddd, D MMMM YYYY')}</div>
              <div class="schedule-time">${a.start_time} - ${a.finish_time}</div>
              <div class="schedule-duration">${hours.toFixed(1)} hours</div>
            </div>
          `;
        }).join('');

        // Calculate total fee for this therapist
        const totalFee = assignments.reduce((sum, a) => sum + (a.therapist_fee || 0), 0);

        await EmailService.sendQuoteTherapistConfirmation({
          therapistEmail: firstAssignment.therapist_email || '',
          therapistName: firstAssignment.therapist_name || '',
          quoteReference: String(quotesData?.id || ''),
          clientName: quotesData?.corporate_contact_name || quotesData?.customer_name || '',
          companyName: quotesData?.business_name || '',
          serviceName: quotesData?.services?.name || 'Corporate Wellness Service',
          therapistScheduleHTML: scheduleHTML,
          therapistFee: totalFee.toFixed(2),
          eventAddress: quotesData?.event_address || '',
          parkingInfo: quotesData?.parking_details || 'Details to be confirmed',
          contactPerson: quotesData?.corporate_contact_name || quotesData?.customer_name || '',
          contactPhone: quotesData?.customer_phone || '',
          specialRequirements: quotesData?.special_requirements || ''
        });
      }

      const now = new Date().toLocaleDateString();
      setWorkflowState(prev => ({
        ...prev,
        therapistConfirmationsSent: true,
        therapistConfirmationsSentAt: now
      }));

      message.destroy();
      message.success(`📧 Booking confirmations sent to ${Object.keys(therapistGroups).length} therapist(s)`);
    } catch (error) {
      message.destroy();
      message.error('Failed to send therapist confirmations');
      console.error(error);
    }
  };

  const handleSendInvoice = async () => {
    try {
      message.loading('Sending invoice to client...', 0);

      // TODO: Implement EmailJS template "Official Client Invoice"
      await new Promise(resolve => setTimeout(resolve, 1000));

      const now = new Date().toLocaleDateString();
      setWorkflowState(prev => ({
        ...prev,
        invoiceSent: true,
        invoiceSentAt: now
      }));

      message.destroy();
      message.success(`💰 Official Invoice sent ${now}`);
    } catch (error) {
      message.destroy();
      message.error('Failed to send invoice');
    }
  };

  const handleSendReceipt = async () => {
    try {
      message.loading('Sending receipt to client...', 0);

      if (!quotesData) {
        message.destroy();
        message.error('Quote data not loaded');
        return;
      }

      // Generate receipt number
      const receiptNumber = `REC-${id}-${Date.now().toString().slice(-6)}`;

      // Format event dates
      const eventDates = currentQuoteDates
        .map(d => dayjs(d.event_date).format('D MMM YYYY'))
        .join(', ');

      // Calculate amounts
      const subtotal = quotesData.total_amount || 0;
      const discount = quotesData.discount_amount || 0;
      const gst = quotesData.gst_amount || 0;
      const totalAmount = quotesData.final_amount || 0;

      await EmailService.sendOfficialReceipt({
        clientEmail: quotesData.customer_email || '',
        clientName: quotesData.corporate_contact_name || quotesData.customer_name || '',
        receiptNumber: receiptNumber,
        receiptDate: dayjs().format('D MMMM YYYY'),
        paymentDate: quotesData.paid_date ? dayjs(quotesData.paid_date).format('D MMMM YYYY') : dayjs().format('D MMMM YYYY'),
        invoiceNumber: quotesData.invoice_number || 'N/A',
        quoteReference: String(quotesData.id || ''),
        companyName: quotesData.business_name || '',
        subtotal: subtotal.toFixed(2),
        discount: discount > 0 ? discount.toFixed(2) : undefined,
        gst: gst.toFixed(2),
        totalAmount: totalAmount.toFixed(2),
        amountPaid: (quotesData.paid_amount || totalAmount).toFixed(2),
        paymentMethod: quotesData.payment_method === 'bank_transfer' ? 'Bank Transfer' : 
                      quotesData.payment_method === 'card' ? 'Credit Card' : 'Invoice',
        paymentReference: quotesData.notes || undefined,
        serviceName: quotesData.services?.name || 'Corporate Wellness Service',
        eventDates: eventDates,
        eventAddress: quotesData.event_address || ''
      });

      const now = new Date().toLocaleDateString();
      setWorkflowState(prev => ({
        ...prev,
        receiptSent: true,
        receiptSentAt: now
      }));

      message.destroy();
      message.success(`📧 Receipt ${receiptNumber} sent successfully`);
    } catch (error) {
      message.destroy();
      message.error('Failed to send receipt');
      console.error(error);
    }
  };

  const handleSendUpdatedSchedule = async () => {
    try {
      message.loading('Sending updated schedule...', 0);

      // Increment version
      const newVersion = quoteVersion + 1;
      setQuoteVersion(newVersion);

      // Delete all existing bookings and recreate with current assignments
      console.log('🗑️ Deleting all existing bookings for quote:', id);
      await supabaseClient
        .from('bookings')
        .delete()
        .eq('parent_quote_id', id);

      // Recreate bookings with current arrangement as PENDING (not confirmed)
      const currentArrangement = form?.getFieldValue('service_arrangement') || (quotesData as any)?.service_arrangement || 'split';
      const bookingResult = await createBookingsFromQuote(
        { ...(quotesData as any), service_arrangement: currentArrangement } as any,
        therapistAssignments
      );

      if (!bookingResult.success) {
        message.destroy();
        throw new Error(bookingResult.error || 'Failed to create bookings');
      }

      console.log('✅ Created', bookingResult.bookingIds?.length, 'bookings with updated assignments');

      // Reset quote status to 'sent' (requires re-acceptance)
      await supabaseClient
        .from('quotes')
        .update({
          status: 'sent',
          quote_sent_at: new Date().toISOString()
        })
        .eq('id', id);

      // Fetch business_email from system settings for archive
      const businessEmail = await getSystemSetting('business_email', 'string', '');

      // TODO: Implement EmailJS template "Updated Schedule" (highlights changes)
      // For now, use the quote template with version (with BCC to business email for archive)
      const emailResult = await EmailService.sendEnhancedOfficialQuote(
        { ...quotesData, quote_version: newVersion },
        therapistAssignments,
        bookingResult.bookingIds || [],
        businessEmail
      );

      if (!emailResult.success) {
        throw new Error('Failed to send updated schedule email');
      }

      // Reset workflow state
      setWorkflowState(prev => ({
        ...prev,
        assignmentsChanged: false,
        quoteAccepted: false,
        quoteDeclined: false
      }));

      message.destroy();
      message.success(`📧 Updated Schedule sent (Rev ${newVersion}). Status reset to 'Sent' - client must re-accept.`);
      queryResult?.refetch();
    } catch (error) {
      message.destroy();
      message.error('Failed to send updated schedule');
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
    console.log('🎨 Rendering workflow alert, state:', {
      step: workflowStep,
      assignmentsChanged: workflowState.assignmentsChanged,
      quoteSent: workflowState.quoteSent,
      quoteAccepted: workflowState.quoteAccepted,
      quoteDeclined: workflowState.quoteDeclined
    });

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

    if (workflowStep === 4 && !workflowState.quoteSent) {
      return (
        <Alert
          message="Ready to Send Official Quote"
          description="Therapist assignments confirmed. You can now send the official quote to the customer."
          type="success"
          showIcon
          icon={<CheckCircleOutlined />}
          style={{ marginBottom: 16 }}
        />
      );
    }

    if (workflowState.quoteSent && !workflowState.quoteAccepted && !workflowState.quoteDeclined) {
      return (
        <Alert
          message={`📧 Official Quote Sent ${workflowState.quoteSentAt}`}
          description="Waiting for client response. Client will receive email with Accept/Decline options."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
      );
    }

    if (workflowState.quoteAccepted) {
      return (
        <Alert
          message={`✅ Quote Accepted ${workflowState.quoteAcceptedAt}`}
          description="Client has accepted the quote. Therapist calendars updated to confirmed bookings."
          type="success"
          showIcon
          icon={<CheckCircleOutlined />}
          style={{ marginBottom: 16 }}
        />
      );
    }

    if (workflowState.quoteDeclined) {
      return (
        <Alert
          message={`❌ Quote Declined ${workflowState.quoteDeclinedAt}`}
          description="Client has declined the quote. Therapist calendars have been unblocked."
          type="error"
          showIcon
          icon={<CloseCircleOutlined />}
          style={{ marginBottom: 16 }}
        />
      );
    }

    if (workflowState.assignmentsChanged && workflowState.quoteSent) {
      return (
        <Alert
          message="⚠️ Assignments Changed"
          description="Warning: You have changed the assignments for this quote. You must click 'Re-send Official Quote' OR 'Send Updated Schedule' to update bookings and notify client/therapists."
          type="warning"
          showIcon
          icon={<ExclamationCircleOutlined />}
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
      return (
        <Alert
          message="Unified Event Structure"
          description="This quote uses the unified event structure. Please use the Quote Dates section below to manage event timing for both single and multi-day events."
          type="info"
          showIcon
          style={{ margin: '16px 0' }}
        />
      );
    } else if (quotesData?.event_structure === 'multi_day') {
      return (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
            <Col span={4}>
              <Form.Item label="Number of Event Days" name="number_of_event_days">
                <InputNumber
                  min={1}
                  max={30}
                  style={{ width: '100%' }}
                  onChange={(value) => {
                    if (value && value !== currentQuoteDates.length) {
                      // Generate new array based on the number of days
                      const newDates = Array.from({length: value}, (_, index) => {
                        const existingDay = currentQuoteDates[index];
                        return existingDay || {
                          id: `temp-${index + 1}`,
                          day_number: index + 1,
                          event_date: null,
                          start_time: null,
                          finish_time: null,
                          duration_minutes: 0,
                          sessions_count: 0,
                          _isNew: true
                        };
                      });
                      updateCurrentQuoteDates(newDates);
                    }
                  }}
                />
              </Form.Item>
            </Col>
          </Row>

          {currentQuoteDates.length > 0 && (
            <Card title={`📅 Event Days (${currentQuoteDates.length} days)`} size="small">
              {currentQuoteDates.map((day, index) => (
                <Row key={day.id || index} gutter={[16, 8]} style={{ marginBottom: 16, padding: '16px', border: '1px solid #f0f0f0', borderRadius: '6px' }}>
                  <Col span={3}>
                    <strong>Day {day.day_number}</strong>
                  </Col>
                  <Col span={5}>
                    <DatePicker
                      placeholder="Select Date"
                      style={{ width: '100%' }}
                      value={day.event_date ? dayjs(day.event_date) : null}
                      onChange={(date, dateString) => {
                        const newDates = [...currentQuoteDates];
                        newDates[index] = { ...day, event_date: dateString };
                        updateCurrentQuoteDates(newDates);
                      }}
                    />
                  </Col>
                  <Col span={4}>
                    <TimePicker
                      placeholder="Start Time"
                      style={{ width: '100%' }}
                      format="HH:mm"
                      value={day.start_time ? dayjs(`2000-01-01 ${day.start_time}`) : null}
                      onChange={(time, timeString) => {
                        const timeStr = Array.isArray(timeString) ? timeString[0] : timeString;
                        const newDates = [...currentQuoteDates];
                        newDates[index] = { ...day, start_time: timeStr };
                        // Recalculate duration
                        if (newDates[index].finish_time && timeStr) {
                          const finishTime = newDates[index].finish_time;
                          if (typeof finishTime === 'string') {
                            newDates[index].duration_minutes = calculateDayDuration(timeStr, finishTime);
                          }
                        }
                        updateCurrentQuoteDates(newDates);
                      }}
                    />
                  </Col>
                  <Col span={4}>
                    <TimePicker
                      placeholder="Finish Time"
                      style={{ width: '100%' }}
                      format="HH:mm"
                      value={day.finish_time ? dayjs(`2000-01-01 ${day.finish_time}`) : null}
                      onChange={(time, timeString) => {
                        const timeStr = Array.isArray(timeString) ? timeString[0] : timeString;
                        const newDates = [...currentQuoteDates];
                        newDates[index] = { ...day, finish_time: timeStr };
                        // Recalculate duration
                        if (newDates[index].start_time && timeStr) {
                          const startTime = newDates[index].start_time;
                          if (typeof startTime === 'string') {
                            newDates[index].duration_minutes = calculateDayDuration(startTime, timeStr);
                          }
                        }
                        updateCurrentQuoteDates(newDates);
                      }}
                    />
                  </Col>
                  <Col span={4}>
                    <Input
                      readOnly
                      value={day.start_time && day.finish_time && typeof day.start_time === 'string' && typeof day.finish_time === 'string' ? formatMinutesToTime(calculateDayDuration(day.start_time, day.finish_time)) : 'Not calculated'}
                      style={{ backgroundColor: '#f5f5f5' }}
                    />
                  </Col>
                  <Col span={4}>
                    <InputNumber
                      placeholder="Sessions"
                      style={{ width: '100%' }}
                      min={0}
                      value={day.sessions_count || 0}
                      onChange={(value) => {
                        const newDates = [...currentQuoteDates];
                        newDates[index] = { ...day, sessions_count: value || 0 };
                        updateCurrentQuoteDates(newDates);
                      }}
                    />
                  </Col>
                </Row>
              ))}
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
      <>
        {/* Unsaved Changes Warning */}
        {hasUnsavedChanges && (
          <Alert
            message="⚠️ Unsaved Changes Detected"
            description="You have unsaved changes that will affect therapist availability and pricing. Please click 'Save Changes' before checking availability or sending quotes."
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            action={
              <Button 
                size="small" 
                type="primary" 
                onClick={() => {
                  form?.submit();
                }}
              >
                Save Now
              </Button>
            }
          />
        )}
        
        <QuoteAvailabilityChecker
          quoteId={id}
          eventLatitude={eventLatitude}
          eventLongitude={eventLongitude}
        onAvailabilityConfirmed={async (assignments) => {
          // NEW WORKFLOW: Don't create bookings yet, just confirm availability
          const now = new Date().toLocaleDateString();
          setTherapistAssignments(assignments);
          setAvailabilityStatus('available');
          setWorkflowStep(3);
          setWorkflowState(prev => ({
            ...prev,
            availabilityConfirmed: true,
            availabilityConfirmedAt: now
          }));

          message.success(`✅ Therapist Availability confirmed ${now}`);
        }}
        onAvailabilityDeclined={() => {
          setAvailabilityStatus('unavailable');
          message.warning('Quote declined due to therapist availability issues.');
        }}
        onAssignmentsChanged={() => {
          // Mark assignments as changed so "Send Updated Schedule" appears
          console.log('🔔 onAssignmentsChanged triggered in parent, setting assignmentsChanged = true');
          setWorkflowState(prev => {
            const newState = {
              ...prev,
              assignmentsChanged: true
            };
            console.log('📊 New workflow state:', newState);
            return newState;
          });
        }}
        existingAssignments={therapistAssignments}
      />
      </>
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
          <Form
            {...formProps}
            layout="vertical"
            onValuesChange={handleFormValuesChange}
            onFinish={async (values) => {
              // Ensure all calculated fields are included in the submission
              const submissionValues = {
                ...values,
                // Include calculated financial fields from form
                total_amount: form?.getFieldValue('total_amount'),
                gst_amount: form?.getFieldValue('gst_amount'),
                final_amount: form?.getFieldValue('final_amount'),
                // Include calculated duration fields
                duration_minutes: form?.getFieldValue('duration_minutes'),
                session_duration_minutes: form?.getFieldValue('session_duration_minutes'),
                sessions_per_day: form?.getFieldValue('sessions_per_day'),
                // Include form values that might be missing
                total_sessions: (values as any).total_sessions || form?.getFieldValue('total_sessions'),
                therapists_needed: (values as any).therapists_needed || form?.getFieldValue('therapists_needed'),
                service_arrangement: (values as any).service_arrangement || form?.getFieldValue('service_arrangement'),
                // Include geolocation coordinates from GooglePlacesAutocomplete
                latitude: eventLatitude ?? form?.getFieldValue('latitude'),
                longitude: eventLongitude ?? form?.getFieldValue('longitude'),
              };

              console.log('💾 Submitting quote with calculated values:', {
                total_amount: submissionValues.total_amount,
                gst_amount: submissionValues.gst_amount,
                final_amount: submissionValues.final_amount,
                duration_minutes: submissionValues.duration_minutes,
                session_duration_minutes: submissionValues.session_duration_minutes,
                total_sessions: submissionValues.total_sessions,
                therapists_needed: submissionValues.therapists_needed,
                service_arrangement: submissionValues.service_arrangement,
                latitude: submissionValues.latitude,
                longitude: submissionValues.longitude
              });

              // Verify values are correct before sending
              if (submissionValues.service_arrangement === 'multiply' && submissionValues.therapists_needed > 1) {
                console.log('🔍 MULTIPLY MODE - Verifying calculations before save...');
                console.log('   Expected duration_minutes to be multiplied by therapists_needed');
                console.log('   Expected session_duration_minutes to be multiplied by therapists_needed');
                console.log('   Expected total_amount to be multiplied by therapists_needed');
              }

              if (formProps?.onFinish) {
                return (formProps.onFinish as any)(submissionValues as any);
              }
              return undefined;
            }}
          >
            {/* Hidden calculated fields for database update */}
            <Form.Item name="sessions_per_day" style={{ display: 'none' }}>
              <InputNumber />
            </Form.Item>
            <Form.Item name="duration_minutes" style={{ display: 'none' }}>
              <InputNumber />
            </Form.Item>
            {/* Hidden geolocation fields from GooglePlacesAutocomplete */}
            <Form.Item name="latitude" style={{ display: 'none' }}>
              <InputNumber />
            </Form.Item>
            <Form.Item name="longitude" style={{ display: 'none' }}>
              <InputNumber />
            </Form.Item>

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
                      <GooglePlacesAutocomplete
                        value={form?.getFieldValue('event_location') || ''}
                        placeholder="Start typing the event address..."
                        onChange={(value) => {
                          form?.setFieldsValue({ event_location: value });
                        }}
                        onPlaceSelect={(place) => {
                          console.log('📍 Event location selected:', place);
                          form?.setFieldsValue({
                            event_location: place.address,
                            event_address: place.address,
                            latitude: place.lat,
                            longitude: place.lng
                          });
                          setEventLatitude(place.lat);
                          setEventLongitude(place.lng);
                        }}
                      />
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
                    <Form.Item label="Selected Service">
                      <Input
                        readOnly
                        disabled
                        value={quotesData?.services?.name || 'No service selected'}
                      />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={[16, 16]}>
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

                {/* Warning message for schedule changes */}
                {hasScheduleChanges && (
                  <Alert
                    message="⚠️ WARNING - You have changed the schedule..."
                    description="You must save these changes immediately to ensure that the Therapist Assignments are correctly loaded."
                    type="warning"
                    showIcon
                    style={{ marginBottom: 20 }}
                  />
                )}

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
                      <InputNumber
                        min={1}
                        step={0.1}
                        precision={1}
                        style={{ width: '100%' }}
                        placeholder="Auto-calculated from schedule"
                        addonAfter="min"
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="Therapists Needed" name="therapists_needed" rules={[{ required: true, message: 'Please specify number of therapists needed' }]}>
                      <InputNumber
                        min={1}
                        max={10}
                        style={{ width: '100%' }}
                        placeholder="Number of therapists"
                      />
                    </Form.Item>
                    <div style={{ color: '#8c8c8c', fontSize: '12px', marginTop: -8 }}>
                      Suggested: {Math.max(1, Math.ceil((timeValidation.eventDuration / 60) / Math.max(1, maxHoursPerTherapist)))} (based on max {maxHoursPerTherapist}h per day)
                    </div>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="Service Arrangement" name="service_arrangement" initialValue={serviceArrangement}>
                      <Radio.Group
                        onChange={(e) => {
                          setServiceArrangement(e.target.value);
                          form?.setFieldValue('service_arrangement', e.target.value);
                        }}
                      >
                        <Radio.Button value="split">Split Hours</Radio.Button>
                        <Radio.Button value="multiply">Multiply Hours</Radio.Button>
                      </Radio.Group>
                    </Form.Item>
                    <div style={{ color: '#8c8c8c', fontSize: '12px', marginTop: -8 }}>
                      Split: divide hours among therapists. Multiply: each therapist works full hours.
                    </div>
                  </Col>
                </Row>

                {/* Time Validation */}
                {renderTimeValidation()}
              </Panel>

              {/* Therapist Assignment */}
              <Panel header="👥 Therapist Availability & Assignment" key="availability">
                {/* Warning for schedule changes */}
                {scheduleChangeDetected && (
                  <Alert
                    message="⚠️ Schedule Changed"
                    description="Date/time/duration has changed. Save changes, then re-check availability and re-assign therapists before re-sending quote. All existing assignments have been cleared."
                    type="error"
                    showIcon
                    icon={<ExclamationCircleOutlined />}
                    style={{ marginBottom: 16 }}
                    closable
                    onClose={() => setScheduleChangeDetected(false)}
                  />
                )}

                {/* Warning for changed assignments */}
                {workflowState.assignmentsChanged && workflowState.quoteSent && (
                  <Alert
                    message="⚠️ Assignments Changed"
                    description="Warning: You have changed the assignments for this quote. You must click 'Re-send Official Quote' OR 'Send Updated Schedule' to update bookings and notify client/therapists."
                    type="warning"
                    showIcon
                    icon={<ExclamationCircleOutlined />}
                    style={{ marginBottom: 16 }}
                  />
                )}
                
                {renderTherapistAssignments()}
                
                {(() => {
                  const arr = form?.getFieldValue('service_arrangement') || serviceArrangement;
                  const tn = form?.getFieldValue('therapists_needed') || 1;
                  if (arr === 'multiply' && tn > 1) {
                    return (
                      <Alert
                        style={{ marginTop: 12 }}
                        message={`Multiply Hours selected: each of the ${tn} therapist(s) will be assigned the full day window and their fees will reflect full hours.`}
                        type="info"
                        showIcon
                      />
                    );
                  }
                  return null;
                })()}
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
                    <Form.Item
                      label="Total Amount"
                      name="total_amount"
                      rules={[{ required: true }]}
                      tooltip="Auto-calculated: Event Duration × Hourly Rate + Weekend Uplift (if applicable)"
                    >
                      <InputNumber
                        min={0}
                        precision={2}
                        style={{ width: '100%' }}
                        formatter={(value) => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                        readOnly
                        placeholder="Auto-calculated"
                        value={totalAmountDisplay || totalAmount}
                      />
                      {calculationBreakdown && (
                        <div style={{ marginTop: '4px', fontSize: '12px', color: '#666', whiteSpace: 'pre-line' }}>
                          {calculationBreakdown}
                        </div>
                      )}
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

                <Divider style={{ margin: '30px 0' }}>Payment Tracking</Divider>

                <Row gutter={[16, 16]}>
                  <Col span={8}>
                    <Form.Item label="Payment Status" name="payment_status">
                      <Select>
                        <Option value="pending">Pending</Option>
                        <Option value="paid">Paid</Option>
                        <Option value="overdue">Overdue</Option>
                        <Option value="refunded">Refunded</Option>
                      </Select>
                    </Form.Item>
                    {quotesData?.payment_status && (
                      <Tag color={
                        quotesData.payment_status === 'paid' ? 'green' :
                        quotesData.payment_status === 'overdue' ? 'red' :
                        quotesData.payment_status === 'refunded' ? 'orange' : 'blue'
                      } style={{ marginTop: -8 }}>
                        {quotesData.payment_status.toUpperCase()}
                      </Tag>
                    )}
                  </Col>
                  <Col span={8}>
                    <Form.Item label="Invoice Number" name="invoice_number">
                      <Input readOnly placeholder="Auto-generated" />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="Invoice Sent Date" name="invoice_sent_at">
                      <Input 
                        readOnly 
                        placeholder="Not sent yet"
                        value={quotesData?.invoice_sent_at ? dayjs(quotesData.invoice_sent_at).format('DD/MM/YYYY') : ''}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="Payment Due Date" name="payment_due_date">
                      <Input 
                        readOnly 
                        placeholder="Auto-set when invoiced"
                        value={quotesData?.payment_due_date ? dayjs(quotesData.payment_due_date).format('DD/MM/YYYY') : ''}
                      />
                    </Form.Item>
                    <small style={{ color: '#8c8c8c', fontSize: '12px', marginTop: -8, display: 'block' }}>
                      Auto-set to {invoiceDueDays} days after invoice sent
                    </small>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="Paid Amount" name="paid_amount">
                      <Input 
                        readOnly 
                        placeholder="$0.00"
                        value={quotesData?.paid_amount ? `$${quotesData.paid_amount.toFixed(2)}` : ''}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="Paid Date" name="paid_date">
                      <Input 
                        readOnly 
                        placeholder="Not paid yet"
                        value={quotesData?.paid_date ? dayjs(quotesData.paid_date).format('DD/MM/YYYY') : ''}
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                  <Col span={24}>
                    <Space>
                      <Button
                        type="primary"
                        icon={<DollarOutlined />}
                        onClick={() => {
                          setPaymentAmount(quotesData?.final_amount || 0);
                          setPaymentDate(dayjs());
                          setShowRecordPaymentModal(true);
                        }}
                        disabled={quotesData?.payment_status === 'paid'}
                      >
                        💳 Record Payment
                      </Button>
                      {quotesData?.payment_status === 'paid' && (
                        <Tag color="green" icon={<CheckCircleOutlined />}>
                          Payment Recorded: ${quotesData?.paid_amount?.toFixed(2)} on {dayjs(quotesData?.paid_date).format('DD/MM/YYYY')}
                        </Tag>
                      )}
                    </Space>
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
              <Space size="middle" wrap>
                <Button type="primary" size="large" htmlType="submit" {...saveButtonProps}>
                  💾 Save Changes
                </Button>

                {/* Send Official Quote (or Re-send) */}
                {!workflowState.quoteSent && (
                  <Button
                    type="primary"
                    size="large"
                    icon={<MailOutlined />}
                    onClick={handleSendOfficialQuote}
                    disabled={!workflowState.availabilityConfirmed || hasUnsavedChanges}
                    style={{
                      backgroundColor: '#007e8c',
                      borderColor: '#007e8c'
                    }}
                  >
                    📧 Send Official Quote
                  </Button>
                )}
                {workflowState.quoteSent && (
                  <Button
                    size="large"
                    icon={<MailOutlined />}
                    onClick={handleResendQuote}
                    disabled={hasUnsavedChanges}
                    style={{
                      opacity: hasUnsavedChanges ? 0.4 : 0.8
                    }}
                  >
                    🔄 Re-send Official Quote
                  </Button>
                )}

                {/* Therapist Confirmations (after quote accepted) */}
                {workflowState.quoteAccepted && !workflowState.therapistConfirmationsSent && (
                  <Button
                    type="primary"
                    size="large"
                    icon={<MailOutlined />}
                    onClick={handleSendTherapistConfirmations}
                    disabled={hasUnsavedChanges}
                  >
                    📧 Send Booking Confirmations to Therapists
                  </Button>
                )}

                {/* Invoice (after quote accepted) */}
                {workflowState.quoteAccepted && !workflowState.invoiceSent && (
                  <Button
                    type="primary"
                    size="large"
                    icon={<DollarOutlined />}
                    onClick={handleSendInvoice}
                    disabled={hasUnsavedChanges}
                  >
                    💰 Send Invoice to Client
                  </Button>
                )}
                {workflowState.invoiceSent && (
                  <Button
                    size="large"
                    icon={<DollarOutlined />}
                    onClick={handleSendInvoice}
                    style={{ opacity: 0.8 }}
                  >
                    🔄 Re-send Invoice to Client
                  </Button>
                )}

                {/* Receipt (after payment) */}
                {quotesData?.payment_status === 'paid' && !workflowState.receiptSent && (
                  <Button
                    type="primary"
                    size="large"
                    icon={<MailOutlined />}
                    onClick={handleSendReceipt}
                  >
                    📧 Send Receipt to Client
                  </Button>
                )}
                {workflowState.receiptSent && (
                  <Button
                    size="large"
                    icon={<MailOutlined />}
                    onClick={handleSendReceipt}
                    style={{ opacity: 0.8 }}
                  >
                    🔄 Re-send Receipt
                  </Button>
                )}

                {/* Updated Schedule (when assignments changed after sent) */}
                {workflowState.assignmentsChanged && workflowState.quoteSent && (
                  <Button
                    type="primary"
                    size="large"
                    danger
                    icon={<MailOutlined />}
                    onClick={handleSendUpdatedSchedule}
                  >
                    📧 Send Updated Schedule
                  </Button>
                )}

                <Divider style={{ margin: '20px 0' }} />

                {/* Manual Status Controls */}
                <div style={{ marginTop: 20 }}>
                  <Text strong style={{ display: 'block', marginBottom: 12, color: '#666' }}>Manual Status Controls:</Text>
                  <Space size="small" wrap>
                    {(isSuperAdmin || (workflowState.quoteSent && !workflowState.quoteAccepted && !workflowState.quoteDeclined)) && (
                      <>
                        <Button
                          size="middle"
                          type="default"
                          onClick={handleMarkAccepted}
                          style={{ borderColor: '#52c41a', color: '#52c41a' }}
                          disabled={workflowState.quoteAccepted || workflowState.quoteDeclined}
                        >
                          ✅ Mark as Accepted
                        </Button>
                        <Button
                          size="middle"
                          danger
                          onClick={handleMarkDeclined}
                          disabled={workflowState.quoteAccepted || workflowState.quoteDeclined}
                        >
                          ❌ Mark as Declined
                        </Button>
                      </>
                    )}
                    {(isSuperAdmin || (workflowState.quoteAccepted && !workflowState.invoiceSent)) && (
                      <Button
                        size="middle"
                        onClick={handleMarkInvoiced}
                        style={{ borderColor: '#fa8c16', color: '#fa8c16' }}
                        disabled={workflowState.invoiceSent || workflowState.quoteDeclined}
                      >
                        💰 Mark as Invoiced
                      </Button>
                    )}
                    {(isSuperAdmin || (workflowState.invoiceSent && quotesData?.payment_status !== 'paid')) && (
                      <Button
                        size="middle"
                        onClick={handleMarkPaid}
                        style={{ borderColor: '#1890ff', color: '#1890ff' }}
                        disabled={quotesData?.payment_status === 'paid' || workflowState.quoteDeclined}
                      >
                        💳 Mark as Paid
                      </Button>
                    )}
                  </Space>
                </div>
              </Space>
            </Card>
          </Form>
        </Col>

        <Col span={6}>
          {/* Sidebar */}
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
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
                  <span>{quotesData?.therapists_needed || form?.getFieldValue('therapists_needed') || 0} needed</span>
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

      {/* Record Payment Modal */}
      <Modal
        title="💳 Record Payment"
        open={showRecordPaymentModal}
        onOk={handleRecordPayment}
        onCancel={() => setShowRecordPaymentModal(false)}
        okText="Record Payment"
        cancelText="Cancel"
      >
        <div style={{ padding: '20px 0' }}>
          <Form layout="vertical">
            <Form.Item label="Payment Amount" required>
              <InputNumber
                value={paymentAmount}
                onChange={(value) => setPaymentAmount(value || 0)}
                min={0}
                precision={2}
                style={{ width: '100%' }}
                formatter={(value) => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={(value) => parseFloat(value?.replace(/\$\s?|(,*)/g, '') || '0')}
              />
              <small style={{ color: '#8c8c8c' }}>Total due: ${quotesData?.final_amount?.toFixed(2) || '0.00'}</small>
            </Form.Item>

            <Form.Item label="Payment Date" required>
              <DatePicker
                value={paymentDate}
                onChange={(date) => setPaymentDate(date)}
                style={{ width: '100%' }}
              />
            </Form.Item>

            <Form.Item label="Payment Reference / Notes">
              <Input.TextArea
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                rows={3}
                placeholder="e.g., Bank transfer ref, cheque number, transaction ID..."
              />
            </Form.Item>
          </Form>
        </div>
      </Modal>
    </div>
  );
};

export default EnhancedQuoteEdit;