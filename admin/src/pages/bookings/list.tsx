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
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { useGetIdentity, useNavigation } from '@refinedev/core';
import { supabaseClient } from '../../utility';
import dayjs, { Dayjs } from 'dayjs';

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
  address?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  first_name?: string;
  last_name?: string;
  booker_name?: string;
  customer_email?: string;
  customer_phone?: string;
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
  };
}

export const EnhancedBookingList = () => {
  const { data: identity } = useGetIdentity<UserIdentity>();
  const { show, edit, create } = useNavigation();
  
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
    date_range: null
  });
  
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  });

  const userRole = identity?.role;

  useEffect(() => {
    if (identity) {
      fetchBookings();
    }
  }, [identity, filters, pagination.current, pagination.pageSize]);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      
      // Build query with joins - FIXED: Specify exact therapist relationship
      let query = supabaseClient
        .from('bookings')
        .select(`
          *,
          customers(id, first_name, last_name, email, phone),
          therapist_profiles!bookings_therapist_id_fkey(id, first_name, last_name, email, phone),
          services(id, name, description, service_base_price)
        `, { count: 'exact' });

      // Role-based filtering: if therapist, only show their bookings
      if (isTherapist(userRole) && identity?.id) {
        const { data: therapistProfile } = await supabaseClient
          .from('therapist_profiles')
          .select('id')
          .eq('user_id', identity.id)
          .single();
        
        if (therapistProfile) {
          query = query.eq('therapist_id', therapistProfile.id);
        }
      }

      // Apply filters
      if (filters.search) {
        // Search across multiple fields - note: this is simplified, you might want to use full-text search
        query = query.or(`first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,booker_name.ilike.%${filters.search}%,customer_email.ilike.%${filters.search}%,address.ilike.%${filters.search}%`);
      }

      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters.payment_status && filters.payment_status !== 'all') {
        query = query.eq('payment_status', filters.payment_status);
      }

      if (filters.therapist_id) {
        query = query.eq('therapist_id', filters.therapist_id);
      }

      if (filters.service_id) {
        query = query.eq('service_id', filters.service_id);
      }

      if (filters.date_range) {
        query = query
          .gte('booking_time', filters.date_range[0].startOf('day').toISOString())
          .lte('booking_time', filters.date_range[1].endOf('day').toISOString());
      }

      // Apply pagination and ordering
      const { data, error, count } = await query
        .order('booking_time', { ascending: false })
        .range(
          (pagination.current - 1) * pagination.pageSize,
          pagination.current * pagination.pageSize - 1
        );

      console.log('Query executed successfully, got data:', data?.length, 'records');

      if (error) throw error;

      setBookings(data || []);
      setPagination(prev => ({ ...prev, total: count || 0 }));

      // Calculate summary statistics
      calculateSummaryStats(data || []);

    } catch (error) {
      console.error('Error fetching bookings:', error);
      console.log('Error details:', JSON.stringify(error, null, 2));
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      message.error(`Failed to load bookings: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const calculateSummaryStats = (data: BookingRecord[]) => {
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
      default: return <ExclamationCircleOutlined />;
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
      title: 'Customer',
      key: 'customer',
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
      title: 'Service',
      dataIndex: 'service_name',
      key: 'service_name',
      render: (_: any, record: BookingRecord) => (
        <Text>{record.services?.name || 'Unknown Service'}</Text>
      ),
    },
    {
      title: 'Therapist',
      dataIndex: 'therapist_name',
      key: 'therapist_name',
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
      render: (time: string) => (
        <Space direction="vertical" size="small">
          <Text>{dayjs(time).format('MMM DD, YYYY')}</Text>
          <Text type="secondary">{dayjs(time).format('HH:mm')}</Text>
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
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
      render: (amount: number) => (
        <Text strong style={{ color: '#52c41a' }}>
          ${amount?.toFixed(2) || '0.00'}
        </Text>
      ),
    },
    // ADMIN-ONLY COLUMN: Show separate "Therapist Fee" column for admins (not therapists)
    ...(canAccess(userRole, 'canViewAllEarnings') && !isTherapist(userRole) ? [{
      title: 'Therapist Fee',
      dataIndex: 'therapist_fee',
      key: 'therapist_fee',
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
          <Tooltip title="Edit Booking">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => edit('bookings', record.id)}
            />
          </Tooltip>
          {(canAccess(userRole, 'canEditAllBookings') || userRole === 'super_admin') && (
            <Dropdown
              menu={{
                items: statusMenuItems.map(item => ({
                  ...item,
                  onClick: () => handleStatusChange(record.id, item.key),
                  disabled: record.status === item.key,
                })),
              }}
            >
              <Button type="text" icon={<MoreOutlined />} />
            </Dropdown>
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
                    href="https://your-booking-platform-url.com"
                    target="_blank"
                  >
                    New Booking
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
                <Option value="confirmed">Confirmed</Option>
                <Option value="completed">Completed</Option>
                <Option value="cancelled">Cancelled</Option>
                <Option value="declined">Declined</Option>
              </Select>
            </Col>
            <Col span={4}>
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
            <Col span={6}>
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
                    date_range: null
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
        </>
      )}
    </div>
  );
};
