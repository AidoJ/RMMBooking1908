import React, { useState, useEffect } from 'react';
import {
  Table,
  Card,
  Space,
  Button,
  Tag,
  Typography,
  Row,
  Col,
  Input,
  Select,
  DatePicker,
  Tooltip,
  Dropdown,
  message,
  Modal,
  Statistic,
  Spin
} from 'antd';
import {
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  ReloadOutlined,
  MoreOutlined,
  ExportOutlined,
  CalendarOutlined,
  DollarOutlined,
  CheckCircleOutlined,
  MailOutlined,
  PhoneOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  SwapOutlined,
  FileTextOutlined,
  FormOutlined,
  UndoOutlined
} from '@ant-design/icons';
import { useGetIdentity, useNavigation } from '@refinedev/core';
import { useNavigate } from 'react-router';
import { supabaseClient } from '../../utility';
import dayjs, { Dayjs } from 'dayjs';
import { formatBookingDateTime } from '../../utils/timezoneHelpers';

// Import role utilities and components
import { UserIdentity, canAccess, isTherapist, isAdmin } from '../../utils/roleUtils';

const { Title, Text } = Typography;
const { Search } = Input;
const { RangePicker } = DatePicker;
const { Option } = Select;
const { confirm } = Modal;

interface BookingSummaryStats {
  total: number;
  completed: number;
  confirmed: number;
  pending: number;
  cancelled: number;
  totalRevenue: number;
  totalFees: number;
}

interface BookingFilters {
  search: string;
  status: string;
  payment_status: string;
  therapist_id: string;
  service_id: string;
  date_range: [Dayjs, Dayjs] | null;
  booking_type: string;
}

interface BookingRecord {
  id: string;
  booking_id?: string;
  customer_id?: string;
  therapist_id?: string;
  service_id?: string;
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
  address?: string;
  business_name?: string;
  notes?: string;
  payment_intent_id?: string;
  created_at: string;
  updated_at: string;
  first_name?: string;
  last_name?: string;
  booker_name?: string;
  customer_email?: string;
  customer_phone?: string;
  booking_type?: string;
  customers?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
  };
  therapist_profiles?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
  };
  services?: {
    id: string;
    name: string;
    description?: string;
    service_base_price: number;
    quote_only?: boolean;
  };
}

export const EnhancedBookingList = () => {
  const { data: identity } = useGetIdentity<UserIdentity>();
  const { show, edit, create } = useNavigation();
  const navigate = useNavigate();
  
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [summaryStats, setSummaryStats] = useState<BookingSummaryStats>({
    total: 0,
    completed: 0,
    confirmed: 0,
    pending: 0,
    cancelled: 0,
    totalRevenue: 0,
    totalFees: 0
  });
  
  const [filters, setFilters] = useState<BookingFilters>({
    search: '',
    status: '',
    payment_status: '',
    therapist_id: '',
    service_id: '',
    date_range: null,
    booking_type: ''  // Default to empty, but add filter logic to exclude quotes
  });
  
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  });
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreReason, setRestoreReason] = useState('');
  const [bookingToRestore, setBookingToRestore] = useState<BookingRecord | null>(null);

  const userRole = identity?.role;

  useEffect(() => {
    if (identity) {
      fetchBookings();
    }
  }, [identity, filters, pagination.current, pagination.pageSize]);

  const fetchBookings = async () => {
    try {
      setLoading(true);

      // Get therapist ID for role-based filtering
      let therapistIdFilter: string | null = null;
      if (isTherapist(userRole) && identity?.id) {
        const { data: therapistProfile } = await supabaseClient
          .from('therapist_profiles')
          .select('id')
          .eq('user_id', identity.id)
          .single();

        if (therapistProfile) {
          therapistIdFilter = therapistProfile.id;
        }
      }

      // Helper function to apply common filters to a query
      const applyFilters = (q: any) => {
        // Role-based filtering
        if (therapistIdFilter) {
          q = q.eq('therapist_id', therapistIdFilter);
        }

        // Apply filters - only search bookings table fields (not joined tables)
        if (filters.search) {
          q = q.or(`customer_email.ilike.%${filters.search}%,address.ilike.%${filters.search}%,booking_id.ilike.%${filters.search}%`);
        }

        if (filters.status && filters.status !== 'all') {
          q = q.eq('status', filters.status);
        }

        if (filters.payment_status && filters.payment_status !== 'all') {
          q = q.eq('payment_status', filters.payment_status);
        }

        if (filters.therapist_id) {
          q = q.eq('therapist_id', filters.therapist_id);
        }

        if (filters.service_id) {
          q = q.eq('service_id', filters.service_id);
        }

        if (filters.date_range) {
          q = q
            .gte('booking_time', filters.date_range[0].startOf('day').toISOString())
            .lte('booking_time', filters.date_range[1].endOf('day').toISOString());
        }

        if (filters.booking_type && filters.booking_type !== 'all') {
          if (filters.booking_type === 'quotes') {
            q = q.like('booking_id', 'RQ%');
          } else if (filters.booking_type === 'bookings') {
            q = q.not('booking_id', 'like', 'RQ%');
          }
        }

        return q;
      };

      // Step 1: Separate count query (no joins)
      let countQuery = supabaseClient
        .from('bookings')
        .select('id', { count: 'exact', head: true });
      countQuery = applyFilters(countQuery);
      const { count } = await countQuery;

      // Step 2: Separate stats query (all matching bookings, no pagination)
      let statsQuery = supabaseClient
        .from('bookings')
        .select('status, price, therapist_fee');
      statsQuery = applyFilters(statsQuery);
      const { data: statsData } = await statsQuery;

      // Step 3: Main data query with joins (no count)
      let query = supabaseClient
        .from('bookings')
        .select(`
          *,
          customers(id, first_name, last_name, email, phone),
          therapist_profiles!bookings_therapist_id_fkey(id, first_name, last_name, email, phone),
          services(id, name, description, service_base_price, quote_only)
        `);

      query = applyFilters(query);

      // Apply pagination and ordering
      const { data, error } = await query
        .order('booking_time', { ascending: false })
        .range(
          (pagination.current - 1) * pagination.pageSize,
          pagination.current * pagination.pageSize - 1
        );

      console.log('Query executed successfully, got data:', data?.length, 'records, total count:', count);

      if (error) throw error;

      setBookings(data || []);
      setPagination(prev => {
        const newPagination = { ...prev, total: count || 0 };
        console.log('Setting pagination:', newPagination);
        return newPagination;
      });

      // Calculate summary statistics from ALL matching bookings (not just current page)
      calculateSummaryStats(statsData || []);

    } catch (error) {
      console.error('Error fetching bookings:', error);
      console.log('Error details:', JSON.stringify(error, null, 2));
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      message.error(`Failed to load bookings: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const calculateSummaryStats = (data: { status: string; price?: number; therapist_fee?: number }[]) => {
    const stats = data.reduce(
      (acc, booking) => {
        acc.total++;

        switch (booking.status) {
          case 'completed':
            acc.completed++;
            break;
          case 'confirmed':
            acc.confirmed++;
            break;
          case 'requested':
          case 'pending':
            acc.pending++;
            break;
          case 'cancelled':
          case 'declined':
            acc.cancelled++;
            break;
        }

        // Only count revenue/fees from completed bookings
        if (booking.status === 'completed') {
          acc.totalRevenue += parseFloat(booking.price?.toString() || '0') || 0;
          acc.totalFees += parseFloat(booking.therapist_fee?.toString() || '0') || 0;
        }

        return acc;
      },
      {
        total: 0,
        completed: 0,
        confirmed: 0,
        pending: 0,
        cancelled: 0,
        totalRevenue: 0,
        totalFees: 0
      }
    );

    setSummaryStats(stats);
  };

  const applyFilters = () => {
    setPagination(prev => ({ ...prev, current: 1 }));
    fetchBookings();
  };

  const handleStatusChange = async (bookingId: string, newStatus: string) => {
    try {
      const { error } = await supabaseClient
        .from('bookings')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', bookingId);

      if (error) throw error;

      message.success(`Booking status updated to ${newStatus}`);
      fetchBookings();
    } catch (error) {
      console.error('Error updating booking status:', error);
      message.error('Failed to update booking status');
    }
  };

  // Job completion with payment capture
  const handleCompleteJob = async (booking: BookingRecord) => {
    // Check if job can be completed based on booking type
    const isQuote = booking.booking_type === 'quote';
    const canComplete = booking.payment_status === 'authorized' || 
                       (isQuote && booking.status === 'invoiced');

    if (!canComplete) {
      if (isQuote) {
        message.error('Cannot complete quote job: Must be invoiced first');
      } else {
        message.error('Cannot complete job: No payment authorization found');
      }
      return;
    }

    try {
      const response = await fetch('/.netlify/functions/capture-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_intent_id: booking.payment_intent_id,
          booking_id: booking.booking_id || booking.id,
          completed_by: identity?.id || 'unknown'
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Payment capture failed');
      }

      message.success('Job completed and payment captured successfully!');
      fetchBookings();
    } catch (error) {
      console.error('Error completing job:', error);
      message.error(`Failed to complete job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Handle job failure with reason
  const handleFailureModal = (booking: BookingRecord) => {
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
        return handleJobFailure(booking, failureReason.trim());
      },
    });
  };

  // Job failure with payment release and notifications
  const handleJobFailure = async (booking: BookingRecord, reason: string) => {
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
      fetchBookings();

      // TODO: Send professional apology email to client and notification to admin

    } catch (error) {
      console.error('Error handling job failure:', error);
      message.error(`Failed to process failure: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleBulkDelete = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('Please select bookings to delete');
      return;
    }

    confirm({
      title: 'Delete Selected Bookings',
      content: `Are you sure you want to delete ${selectedRowKeys.length} booking(s)? This action cannot be undone.`,
      okText: 'Yes, Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          const { error } = await supabaseClient
            .from('bookings')
            .delete()
            .in('id', selectedRowKeys);

          if (error) throw error;

          message.success(`${selectedRowKeys.length} booking(s) deleted successfully`);
          setSelectedRowKeys([]);
          fetchBookings();
        } catch (error) {
          console.error('Error deleting bookings:', error);
          message.error('Failed to delete bookings');
        }
      }
    });
  };

  // Status color helper
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'green';
      case 'confirmed': return 'blue';
      case 'requested': return 'orange';
      case 'pending': return 'gold';
      case 'cancelled': return 'red';
      case 'declined': return 'red';
      case 'timeout_reassigned': return 'purple';
      case 'seeking_alternate': return 'orange';
      default: return 'default';
    }
  };

  // Status icon helper
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircleOutlined />;
      case 'confirmed': return <CalendarOutlined />;
      case 'requested': return <ClockCircleOutlined />;
      case 'pending': return <ClockCircleOutlined />;
      default: return <ExclamationCircleOutlined />;
    }
  };

  // Quote detection helper
  const isQuote = (record: BookingRecord) => {
    return record.services?.quote_only || record.booking_type === 'quote';
  };

  // Quote conversion handler
  const handleConvertToBooking = async (quoteId: string) => {
    try {
      const { error } = await supabaseClient
        .from('bookings')
        .update({
          booking_type: 'booking',
          status: 'confirmed',
          updated_at: new Date().toISOString()
        })
        .eq('id', quoteId);

      if (error) throw error;

      message.success('Quote converted to confirmed booking');
      fetchBookings();
    } catch (error) {
      console.error('Error converting quote to booking:', error);
      message.error('Failed to convert quote to booking');
    }
  };

  const handleRestoreBooking = async () => {
    if (!bookingToRestore) return;

    if (!restoreReason.trim()) {
      message.warning('Please provide a reason for restoring this booking');
      return;
    }

    try {
      setRestoring(true);

      const { error } = await supabaseClient
        .from('bookings')
        .update({
          status: 'confirmed',
          restored_at: new Date().toISOString(),
          restored_reason: restoreReason,
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingToRestore.id);

      if (error) throw error;

      message.success('Booking restored successfully');
      setShowRestoreModal(false);
      setRestoreReason('');
      setBookingToRestore(null);
      fetchBookings();
    } catch (error) {
      console.error('Error restoring booking:', error);
      message.error('Failed to restore booking');
    } finally {
      setRestoring(false);
    }
  };

  // Payment status color helper
  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'green';
      case 'pending': return 'orange';
      case 'refunded': return 'red';
      default: return 'default';
    }
  };

  // Status change menu items
  const statusMenuItems = [
    { key: 'confirmed', label: 'Confirm', icon: <CheckCircleOutlined /> },
    { key: 'completed', label: 'Complete', icon: <CheckCircleOutlined /> },
    { key: 'cancelled', label: 'Cancel', icon: <ExclamationCircleOutlined /> },
    { key: 'declined', label: 'Decline', icon: <ExclamationCircleOutlined /> }
  ];

  // Table columns with role-based differences
  const columns = [
    {
      title: 'Booking ID',
      dataIndex: 'booking_id',
      key: 'booking_id',
      width: 120,
      sorter: (a: BookingRecord, b: BookingRecord) => {
        const aId = a.booking_id || a.id.slice(0, 8);
        const bId = b.booking_id || b.id.slice(0, 8);
        return aId.localeCompare(bId);
      },
      render: (_: any, record: BookingRecord) => (
        <Text code>{record.booking_id || record.id.slice(0, 8)}</Text>
      ),
    },
    {
      title: 'Customer',
      key: 'customer',
      sorter: (a: BookingRecord, b: BookingRecord) => {
        const aName = a.customers 
          ? `${a.customers.first_name} ${a.customers.last_name}`
          : a.booker_name || `${a.first_name || ''} ${a.last_name || ''}`.trim() || 'Unknown Customer';
        const bName = b.customers 
          ? `${b.customers.first_name} ${b.customers.last_name}`
          : b.booker_name || `${b.first_name || ''} ${b.last_name || ''}`.trim() || 'Unknown Customer';
        return aName.localeCompare(bName);
      },
      render: (_: any, record: BookingRecord) => {
        const customerName = record.customers 
          ? `${record.customers.first_name} ${record.customers.last_name}`
          : record.booker_name || `${record.first_name || ''} ${record.last_name || ''}`.trim() || 'Unknown Customer';
        
        return (
          <Space direction="vertical" size="small">
            <Text strong>{customerName}</Text>
            <Space size="small">
              {(record.customers?.email || record.customer_email) && (
                <Tooltip title={record.customers?.email || record.customer_email}>
                  <MailOutlined style={{ color: '#1890ff' }} />
                </Tooltip>
              )}
              {(record.customers?.phone || record.customer_phone) && (
                <Tooltip title={record.customers?.phone || record.customer_phone}>
                  <PhoneOutlined style={{ color: '#52c41a' }} />
                </Tooltip>
              )}
            </Space>
          </Space>
        );
      },
    },
    {
      title: 'Company',
      dataIndex: 'business_name',
      key: 'business_name',
      render: (text: string) => (
        <Text style={{ fontSize: '13px' }}>
          {text || <span style={{ color: '#999', fontStyle: 'italic' }}>—</span>}
        </Text>
      ),
    },
    {
      title: 'Service',
      dataIndex: 'service_name',
      key: 'service_name',
      sorter: (a: BookingRecord, b: BookingRecord) => {
        const aService = a.services?.name || 'Unknown Service';
        const bService = b.services?.name || 'Unknown Service';
        return aService.localeCompare(bService);
      },
      render: (_: any, record: BookingRecord) => (
        <Space direction="vertical" size="small">
          <Text>{record.services?.name || 'Unknown Service'}</Text>
          {isQuote(record) && (
            <Tag color="purple" style={{ fontSize: '10px' }}>
              QUOTE REQUEST
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Therapist',
      dataIndex: 'therapist_name',
      key: 'therapist_name',
      sorter: (a: BookingRecord, b: BookingRecord) => {
        const aTherapist = a.therapist_profiles 
          ? `${a.therapist_profiles.first_name} ${a.therapist_profiles.last_name}`
          : 'Unassigned';
        const bTherapist = b.therapist_profiles 
          ? `${b.therapist_profiles.first_name} ${b.therapist_profiles.last_name}`
          : 'Unassigned';
        return aTherapist.localeCompare(bTherapist);
      },
      render: (_: any, record: BookingRecord) => (
        <Text>
          {record.therapist_profiles 
            ? `${record.therapist_profiles.first_name} ${record.therapist_profiles.last_name}`
            : 'Unassigned'}
        </Text>
      ),
    },
    {
      title: 'Date & Time',
      dataIndex: 'booking_time',
      key: 'booking_time',
      sorter: (a: BookingRecord, b: BookingRecord) => {
        return dayjs(a.booking_time).unix() - dayjs(b.booking_time).unix();
      },
      render: (time: string, record: BookingRecord) => {
        const timezone = record.booking_timezone || 'Australia/Brisbane';
        const formatted = formatBookingDateTime(time, timezone);
        return (
          <Space direction="vertical" size="small">
            <Text>{formatted.date}</Text>
            <Text type="secondary">{formatted.time}</Text>
          </Space>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      filters: [
        { text: 'Requested', value: 'requested' },
        { text: 'Pending', value: 'pending' },
        { text: 'Confirmed', value: 'confirmed' },
        { text: 'Completed', value: 'completed' },
        { text: 'Cancelled', value: 'cancelled' },
        { text: 'Declined', value: 'declined' },
      ],
      onFilter: (value: any, record: BookingRecord) => record.status === value,
      sorter: (a: BookingRecord, b: BookingRecord) => a.status.localeCompare(b.status),
      render: (status: string) => (
        <Tag color={getStatusColor(status)} icon={getStatusIcon(status)}>
          {status.replace('_', ' ').toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Payment',
      dataIndex: 'payment_status',
      key: 'payment_status',
      filters: [
        { text: 'Pending', value: 'pending' },
        { text: 'Paid', value: 'paid' },
        { text: 'Refunded', value: 'refunded' },
      ],
      onFilter: (value: any, record: BookingRecord) => record.payment_status === value,
      sorter: (a: BookingRecord, b: BookingRecord) => a.payment_status.localeCompare(b.payment_status),
      render: (status: string) => (
        <Tag color={getPaymentStatusColor(status)}>
          {status.toUpperCase()}
        </Tag>
      ),
    },
    // ROLE-BASED COLUMN: Show "Fees" for therapists, "Price" for admins
    {
      title: isTherapist(userRole) ? 'Fees' : 'Price',
      dataIndex: isTherapist(userRole) ? 'therapist_fee' : 'price',
      key: isTherapist(userRole) ? 'therapist_fee' : 'price',
      sorter: (a: BookingRecord, b: BookingRecord) => {
        const aAmount = isTherapist(userRole) ? (a.therapist_fee || 0) : (a.price || 0);
        const bAmount = isTherapist(userRole) ? (b.therapist_fee || 0) : (b.price || 0);
        return aAmount - bAmount;
      },
      render: (amount: number, record: BookingRecord) => {
        // Show enhanced pricing for admins when discount/gift card was applied  
        const hasDiscounts = (record.discount_amount && record.discount_amount > 0) || 
                            (record.gift_card_amount && record.gift_card_amount > 0);
        
        if (!isTherapist(userRole) && hasDiscounts && record.net_price) {
          return (
            <Tooltip 
              title={
                <div>
                  <div>Subtotal: ${record.price?.toFixed(2)}</div>
                  {record.discount_amount && record.discount_amount > 0 && (
                    <div style={{ color: '#52c41a' }}>
                      Discount ({record.discount_code}): -${record.discount_amount.toFixed(2)}
                    </div>
                  )}
                  {record.gift_card_amount && record.gift_card_amount > 0 && (
                    <div style={{ color: '#1890ff' }}>
                      Gift Card ({record.gift_card_code}): -${record.gift_card_amount.toFixed(2)}
                    </div>
                  )}
                  {record.tax_rate_amount && (
                    <div>GST (10%): ${record.tax_rate_amount.toFixed(2)}</div>
                  )}
                  <div style={{ marginTop: '4px', fontWeight: 'bold' }}>
                    Final Total: ${record.net_price.toFixed(2)}
                  </div>
                </div>
              }
            >
              <div>
                <Text strong style={{ color: '#52c41a' }}>
                  ${record.net_price.toFixed(2)}
                </Text>
                <br />
                <Text type="secondary" style={{ fontSize: '11px' }}>
                  {record.discount_amount && record.discount_amount > 0 && '🏷️ '}
                  {record.gift_card_amount && record.gift_card_amount > 0 && '💳 '}
                  Discounted
                </Text>
              </div>
            </Tooltip>
          );
        }
        
        // Standard display for therapists or bookings without discounts
        return (
          <Text strong style={{ color: '#52c41a' }}>
            ${amount?.toFixed(2) || '0.00'}
          </Text>
        );
      },
    },
    // ADMIN-ONLY COLUMN: Show separate "Therapist Fee" column for admins (not therapists)
    ...(isAdmin(userRole) && !isTherapist(userRole) ? [{
      title: 'Therapist Fee',
      dataIndex: 'therapist_fee',
      key: 'therapist_fee',
      sorter: (a: BookingRecord, b: BookingRecord) => (a.therapist_fee || 0) - (b.therapist_fee || 0),
      render: (fee: number) => (
        <Text style={{ color: '#fa541c' }}>
          {fee ? `$${fee.toFixed(2)}` : '-'}
        </Text>
      ),
    }] : []),
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: BookingRecord) => (
        <Space>
          <Tooltip title="View Details">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => show('bookings', record.id)}
            />
          </Tooltip>
          
          {/* Quote-specific actions */}
          {isQuote(record) && (canAccess(userRole, 'canEditAllBookings') || userRole === 'super_admin') && (
            <>
              <Tooltip title="Generate Quote PDF">
                <Button
                  type="text"
                  icon={<FileTextOutlined />}
                  onClick={() => {
                    // TODO: Implement quote PDF generation
                    message.info('Quote PDF generation coming soon');
                  }}
                />
              </Tooltip>
              {record.status === 'requested' && (
                <Tooltip title="Convert to Confirmed Booking">
                  <Button
                    type="text"
                    icon={<SwapOutlined />}
                    style={{ color: '#52c41a' }}
                    onClick={() => handleConvertToBooking(record.id)}
                  />
                </Tooltip>
              )}
            </>
          )}

          {/* Restore Booking Button - Only show for cancelled bookings */}
          {record.status === 'cancelled' && (canAccess(userRole, 'canEditAllBookings') || userRole === 'super_admin') && (
            <Tooltip title="Restore Booking">
              <Button
                type="text"
                icon={<UndoOutlined />}
                style={{ color: '#52c41a' }}
                onClick={() => {
                  setBookingToRestore(record);
                  setShowRestoreModal(true);
                }}
              />
            </Tooltip>
          )}

          {/* Edit Booking Button - Disabled for cancelled bookings */}
          {(canAccess(userRole, 'canEditAllBookings') || userRole === 'super_admin') && (
            <Tooltip title={record.status === 'cancelled' ? "Cannot edit cancelled booking" : (isQuote(record) ? "Edit Quote" : "Edit Booking")}>
              <Button
                type="text"
                icon={<FormOutlined />}
                style={{ color: record.status === 'cancelled' ? '#d9d9d9' : '#1890ff' }}
                disabled={record.status === 'cancelled'}
                onClick={() => {
                  navigate(`/bookings/edit-platform/${record.id}`);
                }}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys);
    },
  };

  return (
    <div style={{ padding: 24 }}>
      {/* Debug info - remove after testing */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{ marginBottom: 16, padding: 8, backgroundColor: '#f0f0f0', fontSize: '12px' }}>
          Debug: Role = {userRole}, Identity = {JSON.stringify(identity)}, Can View All Bookings = {canAccess(userRole, 'canViewAllBookings').toString()}
        </div>
      )}

      {/* Show access denied only if explicitly not allowed AND not super_admin */}
      {!canAccess(userRole, 'canViewAllBookings') && userRole !== 'super_admin' ? (
        <div style={{ padding: 24, textAlign: 'center' }}>
          <Title level={3}>Access Denied</Title>
          <Text>You don't have permission to access this page.</Text>
        </div>
      ) : (
        <>
          {/* Header */}
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col span={12}>
              <Title level={3}>Bookings</Title>
            </Col>
            <Col span={12} style={{ textAlign: 'right' }}>
              <Space>
                <Button 
                  icon={<ReloadOutlined />} 
                  onClick={fetchBookings}
                  loading={loading}
                >
                  Refresh
                </Button>
                {(canAccess(userRole, 'canCreateBookings') || userRole === 'super_admin') && (
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => {
                      // Open booking platform with admin mode parameter
                      // Use production URL in production, local for development
                      const bookingUrl = process.env.NODE_ENV === 'production'
                        ? 'https://booking.rejuvenators.com?admin=true'
                        : 'http://localhost:8080?admin=true';
                      window.open(bookingUrl, '_blank');
                    }}
                  >
                    Create New Booking (Admin)
                  </Button>
                )}
              </Space>
            </Col>
          </Row>

        {/* Summary Statistics - ROLE-BASED */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="Total Bookings"
                value={summaryStats.total}
                prefix={<CalendarOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Completed"
                value={summaryStats.completed}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Confirmed"
                value={summaryStats.confirmed}
                prefix={<CalendarOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title={isTherapist(userRole) ? "Total Fees" : "Revenue"}
                value={isTherapist(userRole) ? summaryStats.totalFees : summaryStats.totalRevenue}
                prefix={<DollarOutlined />}
                precision={2}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
        </Row>

        {/* Filters */}
        <Card style={{ marginBottom: 16 }}>
          <Row gutter={[16, 16]} align="middle">
            <Col span={6}>
              <Search
                placeholder="Search bookings..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                onSearch={() => applyFilters()}
                allowClear
              />
            </Col>
            <Col span={4}>
              <Select
                placeholder="Status"
                value={filters.status}
                onChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
                style={{ width: '100%' }}
                allowClear
              >
                <Option value="all">All Status</Option>
                <Option value="requested">Requested</Option>
                <Option value="pending">Pending</Option>
                <Option value="confirmed">Confirmed</Option>
                <Option value="completed">Completed</Option>
                <Option value="cancelled">Cancelled</Option>
                <Option value="declined">Declined</Option>
              </Select>
            </Col>
            <Col span={3}>
              <Select
                placeholder="Payment Status"
                value={filters.payment_status}
                onChange={(value) => setFilters(prev => ({ ...prev, payment_status: value }))}
                style={{ width: '100%' }}
                allowClear
              >
                <Option value="all">All Payment</Option>
                <Option value="pending">Pending</Option>
                <Option value="paid">Paid</Option>
                <Option value="refunded">Refunded</Option>
              </Select>
            </Col>
            <Col span={3}>
              <Select
                placeholder="Type"
                value={filters.booking_type}
                onChange={(value) => setFilters(prev => ({ ...prev, booking_type: value }))}
                style={{ width: '100%' }}
                allowClear
              >
                <Option value="all">All Types</Option>
                <Option value="bookings">Bookings</Option>
                <Option value="quotes">Quote Requests</Option>
              </Select>
            </Col>
            <Col span={5}>
              <RangePicker
                style={{ width: '100%' }}
                onChange={(dates) => setFilters(prev => ({ 
                  ...prev, 
                  date_range: dates ? [dates[0]!, dates[1]!] : null 
                }))}
              />
            </Col>
            <Col span={4}>
              <Space>
                <Button onClick={applyFilters} type="primary">
                  Apply Filters
                </Button>
                <Button onClick={() => {
                  setFilters({
                    search: '',
                    status: '',
                    payment_status: '',
                    therapist_id: '',
                    service_id: '',
                    date_range: null,
                    booking_type: ''
                  });
                  setPagination(prev => ({ ...prev, current: 1 }));
                }}>
                  Clear
                </Button>
              </Space>
            </Col>
          </Row>
        </Card>

        {/* Bulk Actions */}
        {selectedRowKeys.length > 0 && (canAccess(userRole, 'canEditAllBookings') || userRole === 'super_admin') && (
          <Card style={{ marginBottom: 16 }}>
            <Space>
              <Text>Selected {selectedRowKeys.length} booking(s)</Text>
              <Button 
                danger 
                icon={<DeleteOutlined />}
                onClick={handleBulkDelete}
              >
                Delete Selected
              </Button>
            </Space>
          </Card>
        )}

        {/* Bookings Table */}
        <Card>
          <Table
            rowKey="id"
            columns={columns}
            dataSource={bookings}
            loading={loading}
            pagination={{
              ...pagination,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => 
                `${range[0]}-${range[1]} of ${total} bookings`,
              onChange: (page, pageSize) => {
                setPagination(prev => ({ 
                  ...prev, 
                  current: page, 
                  pageSize: pageSize || 20 
                }));
              }
            }}
            rowSelection={rowSelection}
            scroll={{ x: 1200 }}
          />
        </Card>

        {/* Restore Booking Modal */}
        <Modal
          title="🔄 Restore Booking"
          open={showRestoreModal}
          onOk={handleRestoreBooking}
          onCancel={() => {
            setShowRestoreModal(false);
            setRestoreReason('');
            setBookingToRestore(null);
          }}
          confirmLoading={restoring}
          okText="Restore Booking"
          cancelText="Cancel"
          okButtonProps={{ style: { background: '#52c41a', borderColor: '#52c41a' } }}
          width={550}
        >
          <div style={{ padding: '16px 0' }}>
            <p style={{ marginBottom: '20px', fontSize: '15px' }}>
              Are you sure you want to restore this cancelled booking?
            </p>

            {bookingToRestore && (
              <>
                {/* Booking Details Card */}
                <div style={{
                  background: '#f0fdf4',
                  border: '2px solid #86efac',
                  borderRadius: '8px',
                  padding: '16px',
                  marginBottom: '20px'
                }}>
                  <h4 style={{ color: '#15803d', fontSize: '16px', marginBottom: '12px', fontWeight: 600 }}>
                    📋 Booking Details
                  </h4>
                  <div style={{ fontSize: '14px', color: '#166534', lineHeight: '1.8' }}>
                    <p><strong>Booking ID:</strong> {bookingToRestore.booking_id || bookingToRestore.id}</p>
                    <p><strong>Customer:</strong> {bookingToRestore.customer_name}</p>
                    <p><strong>Service:</strong> {bookingToRestore.service_name}</p>
                    <p><strong>Date:</strong> {new Date(bookingToRestore.booking_time).toLocaleDateString('en-AU', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}</p>
                  </div>
                </div>

                {/* Cancellation Info */}
                {bookingToRestore.cancellation_reason && (
                  <div style={{
                    background: '#fef2f2',
                    border: '2px solid #fecaca',
                    borderRadius: '8px',
                    padding: '16px',
                    marginBottom: '20px'
                  }}>
                    <h4 style={{ color: '#991b1b', fontSize: '14px', marginBottom: '8px', fontWeight: 600 }}>
                      Previous Cancellation Reason:
                    </h4>
                    <p style={{ fontSize: '13px', color: '#7f1d1d', margin: 0 }}>
                      {bookingToRestore.cancellation_reason}
                    </p>
                  </div>
                )}

                {/* Restore Reason Input */}
                <div>
                  <p style={{ fontWeight: 600, marginBottom: '8px', color: '#374151' }}>
                    Restore Reason <span style={{ color: '#dc2626' }}>*</span>
                  </p>
                  <Input.TextArea
                    value={restoreReason}
                    onChange={(e) => setRestoreReason(e.target.value)}
                    placeholder="Enter reason for restoring this booking..."
                    rows={4}
                    maxLength={500}
                    showCount
                  />
                  <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
                    E.g., "Customer requested to reinstate", "Cancellation made in error", etc.
                  </p>
                </div>
              </>
            )}
          </div>
        </Modal>
        </>
      )}
    </div>
  );
};
