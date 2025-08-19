import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Col, 
  Row, 
  Statistic, 
  Table, 
  Tag, 
  Typography, 
  Spin,
  DatePicker,
  Select,
  Space,
  Button
} from 'antd';
import {
  DollarOutlined,
  CalendarOutlined,
  UserOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  PercentageOutlined,
  TeamOutlined,
  ReloadOutlined,
  EyeOutlined
} from '@ant-design/icons';
import { useGetIdentity, useNavigation } from '@refinedev/core';
import { supabaseClient } from '../../utility';
import dayjs, { Dayjs } from 'dayjs';

// Import role utilities
import { UserIdentity, canAccess, isSuperAdmin, isAdmin, isTherapist, getRoleName, getRoleColor } from '../../utils/roleUtils';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

interface BookingStats {
  totalBookings: number;
  totalRevenue: number;
  totalTherapistFees: number;
  feesConfirmed: number;
  feesCompleted: number;
  feesDeclined: number;
  totalNetMargin: number;
  activeTherapists: number;
  completedBookings: number;
  confirmedBookings: number;
  pendingBookings: number;
  cancelledBookings: number;
  averageBookingValue: number;
  averageFeeValue: number;
  conversionRate: number;
}

interface RecentBooking {
  id: string;
  customer_name: string;
  therapist_name: string;
  service_name: string;
  booking_time: string;
  status: string;
  price: number;
  therapist_fee: number;
}

interface DateRange {
  start: Dayjs;
  end: Dayjs;
}

// Date range presets
const datePresets = {
  today: { label: 'Today', type: 'day' },
  week: { label: 'Last 7 Days', type: 'week' },
  month: { label: 'Last 30 Days', type: 'month' },
  quarter: { label: 'Last 90 Days', type: 'quarter' },
  year: { label: 'Last 365 Days', type: 'year' },
  currentWeek: { label: 'This Week', type: 'week' },
  currentMonth: { label: 'This Month', type: 'month' },
  currentQuarter: { label: 'This Quarter', type: 'quarter' },
  currentYear: { label: 'This Year', type: 'year' }
};

export const Dashboard = () => {
  const { data: identity } = useGetIdentity<UserIdentity>();
  const { show } = useNavigation();
  const [stats, setStats] = useState<BookingStats | null>(null);
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>({
    start: dayjs().startOf('month'),
    end: dayjs().endOf('month')
  });
  const [selectedPreset, setSelectedPreset] = useState('currentMonth');

  const userRole = identity?.role;

  useEffect(() => {
    if (identity) {
      fetchDashboardData();
    }
  }, [identity, dateRange]);

  const handlePresetChange = (preset: string) => {
    setSelectedPreset(preset);
    const now = dayjs();
    let newRange: DateRange;
    
    switch (preset) {
      case 'today':
        newRange = {
          start: now.startOf('day'),
          end: now.endOf('day')
        };
        break;
      case 'week':
        newRange = {
          start: now.subtract(7, 'days').startOf('day'),
          end: now.endOf('day')
        };
        break;
      case 'month':
        newRange = {
          start: now.subtract(30, 'days').startOf('day'),
          end: now.endOf('day')
        };
        break;
      case 'quarter':
        newRange = {
          start: now.subtract(90, 'days').startOf('day'),
          end: now.endOf('day')
        };
        break;
      case 'year':
        newRange = {
          start: now.subtract(365, 'days').startOf('day'),
          end: now.endOf('day')
        };
        break;
      case 'currentWeek':
        newRange = {
          start: now.startOf('week'),
          end: now.endOf('week')
        };
        break;
      case 'currentMonth':
        newRange = {
          start: now.startOf('month'),
          end: now.endOf('month')
        };
        break;
      case 'currentQuarter':
        const quarterStart = now.startOf('month').subtract((now.month() % 3), 'month');
        const quarterEnd = quarterStart.add(2, 'month').endOf('month');
        newRange = {
          start: quarterStart,
          end: quarterEnd
        };
        break;
      case 'currentYear':
        newRange = {
          start: now.startOf('year'),
          end: now.endOf('year')
        };
        break;
      default:
        newRange = {
          start: now.startOf('month'),
          end: now.endOf('month')
        };
    }
    
    setDateRange(newRange);
  };

  const handleCustomDateRange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    if (dates && dates[0] && dates[1]) {
      setDateRange({
        start: dates[0].startOf('day'),
        end: dates[1].endOf('day')
      });
      setSelectedPreset('custom');
    }
  };

  const calculateMargin = (revenue: number, therapistFees: number): number => {
    if (revenue === 0) return 0;
    return ((revenue - therapistFees) / revenue) * 100;
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Build base query with role-based filtering - FIXED: Specify exact therapist relationship
      let bookingsQuery = supabaseClient
        .from('bookings')
        .select(`
          *,
          therapist_profiles!bookings_therapist_id_fkey(first_name, last_name),
          customers(first_name, last_name),
          services(name)
        `)
        .gte('booking_time', dateRange.start.toISOString())
        .lte('booking_time', dateRange.end.toISOString());

      // If therapist, only show their bookings
      if (isTherapist(userRole) && identity?.id) {
        // Get therapist profile ID first
        const { data: therapistProfile } = await supabaseClient
          .from('therapist_profiles')
          .select('id')
          .eq('user_id', identity.id)
          .single();
        
        if (therapistProfile) {
          bookingsQuery = bookingsQuery.eq('therapist_id', therapistProfile.id);
        }
      }

      const { data: bookings, error } = await bookingsQuery;

      if (error) {
        console.error('Error fetching bookings:', error);
        return;
      }

      // Calculate statistics for the selected date range
      const completedBookings = bookings?.filter(b => b.status === 'completed') || [];
      const confirmedBookings = bookings?.filter(b => b.status === 'confirmed') || [];
      const pendingBookings = bookings?.filter(b => b.status === 'requested') || [];
      const cancelledBookings = bookings?.filter(b => b.status === 'cancelled') || [];

      // Calculate revenue (only from completed bookings)
      const totalRevenue = completedBookings.reduce((sum, b) => sum + (parseFloat(b.price?.toString() || '0') || 0), 0);

      // Calculate therapist fees (only from completed bookings)
      const totalTherapistFees = completedBookings.reduce((sum, b) => sum + (parseFloat(b.therapist_fee?.toString() || '0') || 0), 0);

      // Calculate additional metrics
      const totalNetMargin = calculateMargin(totalRevenue, totalTherapistFees);
      
      // Calculate average booking value (revenue-based for admin, fee-based for therapist)
      const averageBookingValue = completedBookings.length > 0 
        ? totalRevenue / completedBookings.length 
        : 0;
        
      // Calculate average fee value (therapist fees / completed bookings)
      const averageFeeValue = completedBookings.length > 0 
        ? totalTherapistFees / completedBookings.length 
        : 0;
        
      const conversionRate = bookings && bookings.length > 0 
        ? (completedBookings.length / bookings.length) * 100 
        : 0;

      // Get active therapists count (admin only)
      let activeTherapists = 0;
      if (canAccess(userRole, 'canViewAllTherapists')) {
        const { data: therapists } = await supabaseClient
          .from('therapist_profiles')
          .select('id')
          .eq('is_active', true);
        activeTherapists = therapists?.length || 0;
      }

      // Calculate therapist fees by status
      const feesConfirmed = confirmedBookings.reduce((sum, b) => sum + (parseFloat(b.therapist_fee?.toString() || '0') || 0), 0);
      const feesCompleted = completedBookings.reduce((sum, b) => sum + (parseFloat(b.therapist_fee?.toString() || '0') || 0), 0);
      const feesDeclined = (bookings?.filter(b => b.status === 'declined') || []).reduce((sum, b) => sum + (parseFloat(b.therapist_fee?.toString() || '0') || 0), 0);

      const dashboardStats: BookingStats = {
        totalBookings: bookings?.length || 0,
        totalRevenue,
        totalTherapistFees,
        feesConfirmed,
        feesCompleted, 
        feesDeclined,
        totalNetMargin,
        activeTherapists,
        completedBookings: completedBookings.length,
        confirmedBookings: confirmedBookings.length,
        pendingBookings: pendingBookings.length,
        cancelledBookings: cancelledBookings.length,
        averageBookingValue,
        averageFeeValue,
        conversionRate
      };

      // Prepare recent bookings (sorted by most recent) - increased from 10 to 50
      const recent = bookings
        ?.sort((a, b) => dayjs(b.booking_time).unix() - dayjs(a.booking_time).unix())
        .slice(0, 50)
        .map(booking => ({
          id: booking.id,
          customer_name: booking.customers 
            ? `${booking.customers.first_name} ${booking.customers.last_name}`
            : booking.first_name && booking.last_name 
              ? `${booking.first_name} ${booking.last_name}`
              : booking.booker_name || 'Unknown Customer',
          therapist_name: booking.therapist_profiles 
            ? `${booking.therapist_profiles.first_name} ${booking.therapist_profiles.last_name}`
            : 'Unassigned',
          service_name: booking.services?.name || 'Unknown Service',
          booking_time: booking.booking_time,
          status: booking.status,
          price: parseFloat(booking.price) || 0,
          therapist_fee: parseFloat(booking.therapist_fee) || 0
        })) || [];

      setStats(dashboardStats);
      setRecentBookings(recent);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'green';
      case 'confirmed': return 'blue';
      case 'requested': return 'orange';
      case 'cancelled': return 'red';
      case 'declined': return 'red';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircleOutlined />;
      case 'confirmed': return <CalendarOutlined />;
      case 'requested': return <ClockCircleOutlined />;
      default: return <ExclamationCircleOutlined />;
    }
  };

  // Table columns for recent bookings - ROLE-BASED
  const columns = [
    {
      title: 'Customer',
      dataIndex: 'customer_name',
      key: 'customer_name',
      render: (name: string) => <Text strong>{name}</Text>
    },
    {
      title: 'Therapist',
      dataIndex: 'therapist_name',
      key: 'therapist_name'
    },
    {
      title: 'Service',
      dataIndex: 'service_name',
      key: 'service_name'
    },
    {
      title: 'Date & Time',
      dataIndex: 'booking_time',
      key: 'booking_time',
      render: (time: string) => (
        <div>
          <div>{dayjs(time).format('MMM DD, YYYY')}</div>
          <Text type="secondary">{dayjs(time).format('h:mm A')}</Text>
        </div>
      )
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={getStatusColor(status)} icon={getStatusIcon(status)}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Tag>
      )
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
      )
    },
    // Only show separate therapist fee column for admins (not therapists)
    ...(canAccess(userRole, 'canViewAllEarnings') && !isTherapist(userRole) ? [{
      title: 'Therapist Fee',
      dataIndex: 'therapist_fee',
      key: 'therapist_fee',
      render: (fee: number) => fee ? `$${fee.toFixed(2)}` : '-'
    }] : []),
    // Add View button for all users
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: RecentBooking) => (
        <Button
          type="text"
          icon={<EyeOutlined />}
          onClick={() => show('bookings', record.id)}
          title="View Details"
        >
          View
        </Button>
      )
    }
  ];

  const getDateRangeLabel = () => {
    if (selectedPreset !== 'custom') {
      return datePresets[selectedPreset as keyof typeof datePresets]?.label || 'Custom Range';
    }
    return `${dateRange.start.format('MMM DD, YYYY')} - ${dateRange.end.format('MMM DD, YYYY')}`;
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!identity) {
    return <div>Loading...</div>;
  }

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <Title level={2}>
              {isTherapist(userRole) 
                ? `Welcome back, ${identity?.first_name || identity?.name || 'Therapist'}!`
                : `Rejuvenators Dashboard - ${getRoleName(userRole)}`
              }
            </Title>
            <Text type="secondary">
              {isTherapist(userRole) 
                ? "Here's an overview of your bookings and performance"
                : "Overview of your massage booking business"
              }
            </Text>
            <div style={{ marginTop: 8 }}>
              <Text strong>Period: </Text>
              <Text>{getDateRangeLabel()}</Text>
            </div>
          </div>
          <Card size="small" style={{ minWidth: 400 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text strong>Quick Select:</Text>
                <Select 
                  value={selectedPreset}
                  onChange={handlePresetChange}
                  style={{ width: '100%', marginTop: 4 }}
                >
                  {Object.entries(datePresets).map(([key, preset]) => (
                    <Option key={key} value={key}>{preset.label}</Option>
                  ))}
                </Select>
              </div>
              <div>
                <Text strong>Custom Range:</Text>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <RangePicker
                    value={selectedPreset === 'custom' ? [dateRange.start, dateRange.end] : null}
                    onChange={handleCustomDateRange}
                    style={{ flex: 1 }}
                  />
                  <Button 
                    icon={<ReloadOutlined />} 
                    onClick={fetchDashboardData}
                    loading={loading}
                  >
                    Refresh
                  </Button>
                </div>
              </div>
            </Space>
          </Card>
        </div>
      </div>

      {/* Key Statistics - Role-based display */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Bookings"
              value={stats?.totalBookings || 0}
              prefix={<CalendarOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        
        {/* THERAPIST VIEW: Show separate fee categories */}
        {isTherapist(userRole) ? (
          <>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Fees Confirmed"
                  value={stats?.feesConfirmed || 0}
                  prefix={<DollarOutlined />}
                  precision={2}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Fees Completed"
                  value={stats?.feesCompleted || 0}
                  prefix={<DollarOutlined />}
                  precision={2}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Your Completed"
                  value={stats?.completedBookings || 0}
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: '#722ed1' }}
                />
              </Card>
            </Col>
          </>
        ) : (
          // ADMIN VIEW: Show revenue and average (unchanged)
          <>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Total Revenue"
                  value={stats?.totalRevenue || 0}
                  prefix={<DollarOutlined />}
                  precision={2}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Avg Booking Value"
                  value={stats?.averageBookingValue || 0}
                  prefix={<DollarOutlined />}
                  precision={2}
                  valueStyle={{ color: '#722ed1' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title={canAccess(userRole, 'canViewAllTherapists') ? "Active Therapists" : "Your Completed"}
                  value={canAccess(userRole, 'canViewAllTherapists') ? stats?.activeTherapists || 0 : stats?.completedBookings || 0}
                  prefix={canAccess(userRole, 'canViewAllTherapists') ? <UserOutlined /> : <CheckCircleOutlined />}
                  valueStyle={{ color: '#722ed1' }}
                />
              </Card>
            </Col>
          </>
        )}
      </Row>

      {/* Second row for therapists - Fees Declined */}
      {isTherapist(userRole) && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="Fees Declined"
                value={stats?.feesDeclined || 0}
                prefix={<DollarOutlined />}
                precision={2}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Avg Fee Value"
                value={stats?.averageFeeValue || 0}
                prefix={<DollarOutlined />}
                precision={2}
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Total Fees"
                value={stats?.totalTherapistFees || 0}
                prefix={<DollarOutlined />}
                precision={2}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Conversion Rate"
                value={stats?.conversionRate || 0}
                prefix={<PercentageOutlined />}
                precision={1}
                suffix="%"
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Admin-specific Statistics - UNCHANGED (admin view only) */}
      {canAccess(userRole, 'canViewAllEarnings') && (
        <>
          {/* Therapist Fees and Margins */}
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={8}>
              <Card>
                <Statistic
                  title="Total Therapist Fees"
                  value={stats?.totalTherapistFees || 0}
                  prefix={<TeamOutlined />}
                  precision={2}
                  valueStyle={{ color: '#fa541c' }}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic
                  title="Net Margin"
                  value={stats?.totalNetMargin || 0}
                  prefix={<PercentageOutlined />}
                  precision={1}
                  suffix="%"
                  valueStyle={{ 
                    color: (stats?.totalNetMargin || 0) >= 50 
                      ? '#52c41a' 
                      : (stats?.totalNetMargin || 0) >= 30 
                        ? '#faad14' 
                        : '#ff4d4f'
                  }}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic
                  title="Conversion Rate"
                  value={stats?.conversionRate || 0}
                  prefix={<PercentageOutlined />}
                  precision={1}
                  suffix="%"
                  valueStyle={{ color: '#722ed1' }}
                />
              </Card>
            </Col>
          </Row>
        </>
      )}

      {/* Recent Bookings */}
      <Card 
        title="Recent Bookings" 
        extra={
          <Button size="small" onClick={fetchDashboardData}>
            Refresh
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={recentBookings}
          rowKey="id"
          pagination={{ 
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: ['5', '10', '20', '50'],
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} bookings`
          }}
          size="small"
        />
      </Card>
    </div>
  );
};
