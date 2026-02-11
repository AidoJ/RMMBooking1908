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
  EyeOutlined,
  FileTextOutlined
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
  confirmedRevenue: number;
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
  pendingBookingsColor?: string;
  pendingBookingsWeeks?: number;
  draftQuotes: number;
  draftQuotesColor?: string;
  sentQuotes: number;
  sentQuotesColor?: string;
  sentQuotesWeeks?: number;
}

interface RecentBooking {
  id: string;
  booking_id: string;
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
    start: dayjs().startOf('year'),
    end: dayjs().endOf('year')
  });
  const [selectedPreset, setSelectedPreset] = useState('currentYear');

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

  const getPendingBookingColor = (bookingTime: string): { color: string; weeks: number } => {
    const weeksUntil = dayjs(bookingTime).diff(dayjs(), 'week');
    if (weeksUntil < 4) return { color: '#ff4d4f', weeks: weeksUntil }; // Red
    if (weeksUntil <= 8) return { color: '#faad14', weeks: weeksUntil }; // Amber
    return { color: '#52c41a', weeks: weeksUntil }; // Green
  };

  const getDraftQuoteColor = (createdDate: string): string => {
    const daysOld = dayjs().diff(dayjs(createdDate), 'day');
    if (daysOld > 1) return '#ff4d4f'; // Red - older than 1 day
    return '#52c41a'; // Green - within 1 day
  };

  const getSentQuoteColor = (eventDate: string): { color: string; weeks: number } => {
    const weeksUntil = dayjs(eventDate).diff(dayjs(), 'week');
    if (weeksUntil < 4) return { color: '#ff4d4f', weeks: weeksUntil }; // Red - urgent
    if (weeksUntil <= 8) return { color: '#faad14', weeks: weeksUntil }; // Amber
    return { color: '#52c41a', weeks: weeksUntil }; // Green - plenty of time
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Get therapist profile ID if user is a therapist
      let therapistProfileId: string | null = null;
      if (isTherapist(userRole) && identity?.id) {
        const { data: therapistProfile } = await supabaseClient
          .from('therapist_profiles')
          .select('id')
          .eq('user_id', identity.id)
          .single();

        if (therapistProfile) {
          therapistProfileId = therapistProfile.id;
        }
      }

      // Step 1: Get total count of matching bookings for stats
      let countQuery = supabaseClient
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .gte('booking_time', dateRange.start.toISOString())
        .lte('booking_time', dateRange.end.toISOString());

      if (therapistProfileId) {
        countQuery = countQuery.eq('therapist_id', therapistProfileId);
      }

      const { count: totalCount } = await countQuery;

      // Step 2: Fetch ALL bookings for stats calculation (no pagination limit)
      // Use a high limit to ensure we get all records
      let bookingsQuery = supabaseClient
        .from('bookings')
        .select(`
          *,
          therapist_profiles!bookings_therapist_id_fkey(first_name, last_name),
          customers(first_name, last_name),
          services(name)
        `)
        .gte('booking_time', dateRange.start.toISOString())
        .lte('booking_time', dateRange.end.toISOString())
        .order('booking_time', { ascending: false })
        .limit(10000); // Ensure we get all records for accurate stats

      if (therapistProfileId) {
        bookingsQuery = bookingsQuery.eq('therapist_id', therapistProfileId);
      }

      const { data: bookings, error } = await bookingsQuery;

      if (error) {
        console.error('Error fetching bookings:', error);
        return;
      }

      // Calculate statistics for the selected date range
      const completedBookings = bookings?.filter(b => b.status === 'completed') || [];
      const confirmedBookings = bookings?.filter(b => b.status === 'confirmed') || [];
      const pendingBookings = bookings?.filter(b => b.status === 'pending') || [];
      const cancelledBookings = bookings?.filter(b => b.status === 'cancelled') || [];

      // Calculate revenue (only from completed bookings)
      const totalRevenue = completedBookings.reduce((sum, b) => sum + (parseFloat(b.price?.toString() || '0') || 0), 0);

      // Calculate revenue from confirmed bookings (upcoming revenue)
      const confirmedRevenue = confirmedBookings.reduce((sum, b) => sum + (parseFloat(b.price?.toString() || '0') || 0), 0);

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

      // Calculate pending bookings color based on earliest pending booking
      let pendingBookingsColor = '#52c41a'; // Default green
      let pendingBookingsWeeks = 0;
      if (pendingBookings.length > 0) {
        // Find the earliest pending booking
        const earliestPending = pendingBookings.reduce((earliest, booking) => {
          return dayjs(booking.booking_time).isBefore(dayjs(earliest.booking_time)) ? booking : earliest;
        });
        const colorData = getPendingBookingColor(earliestPending.booking_time);
        pendingBookingsColor = colorData.color;
        pendingBookingsWeeks = colorData.weeks;
      }

      // Fetch draft quotes (admin only)
      let draftQuotes = 0;
      let draftQuotesColor = '#52c41a';
      if (canAccess(userRole, 'canViewAllTherapists')) {
        const { data: drafts } = await supabaseClient
          .from('quotes')
          .select('id, created_at')
          .eq('status', 'draft');

        draftQuotes = drafts?.length || 0;

        if (drafts && drafts.length > 0) {
          // Find oldest draft
          const oldestDraft = drafts.reduce((oldest, quote) => {
            return dayjs(quote.created_at).isBefore(dayjs(oldest.created_at)) ? quote : oldest;
          });
          draftQuotesColor = getDraftQuoteColor(oldestDraft.created_at);
        }
      }

      // Fetch sent quotes with event dates (admin only)
      let sentQuotes = 0;
      let sentQuotesColor = '#52c41a';
      let sentQuotesWeeks = 0;
      if (canAccess(userRole, 'canViewAllTherapists')) {
        const { data: sentQuotesData } = await supabaseClient
          .from('quotes')
          .select(`
            id,
            quote_dates!inner(quote_id, event_date)
          `)
          .eq('status', 'sent');

        if (sentQuotesData && sentQuotesData.length > 0) {
          // Get unique quote IDs
          const uniqueQuoteIds = [...new Set(sentQuotesData.map(q => q.id))];
          sentQuotes = uniqueQuoteIds.length;

          // Find earliest event date across all sent quotes
          const allEventDates = sentQuotesData
            .flatMap(q => q.quote_dates)
            .filter(qd => qd && qd.event_date)
            .map(qd => qd.event_date);

          if (allEventDates.length > 0) {
            const earliestEventDate = allEventDates.reduce((earliest, date) => {
              return dayjs(date).isBefore(dayjs(earliest)) ? date : earliest;
            });
            const colorData = getSentQuoteColor(earliestEventDate);
            sentQuotesColor = colorData.color;
            sentQuotesWeeks = colorData.weeks;
          }
        }
      }

      const dashboardStats: BookingStats = {
        totalBookings: bookings?.length || 0,
        totalRevenue,
        confirmedRevenue,
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
        conversionRate,
        pendingBookingsColor,
        pendingBookingsWeeks,
        draftQuotes,
        draftQuotesColor,
        sentQuotes,
        sentQuotesColor,
        sentQuotesWeeks
      };

      // Prepare recent bookings (sorted by most recent) - increased from 10 to 50
      const recent = bookings
        ?.sort((a, b) => dayjs(b.booking_time).unix() - dayjs(a.booking_time).unix())
        .slice(0, 50)
        .map(booking => ({
          id: booking.id,
          booking_id: booking.booking_id || booking.id.slice(0, 8),
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

  // Table columns for recent bookings - ROLE-BASED with sorting
  const columns = [
    {
      title: 'Booking ID',
      dataIndex: 'booking_id',
      key: 'booking_id',
      width: 120,
      sorter: (a: RecentBooking, b: RecentBooking) => a.booking_id.localeCompare(b.booking_id),
      render: (booking_id: string) => <Text code>{booking_id}</Text>
    },
    {
      title: 'Customer',
      dataIndex: 'customer_name',
      key: 'customer_name',
      sorter: (a: RecentBooking, b: RecentBooking) => a.customer_name.localeCompare(b.customer_name),
      render: (name: string) => <Text strong>{name}</Text>
    },
    {
      title: 'Therapist',
      dataIndex: 'therapist_name',
      key: 'therapist_name',
      sorter: (a: RecentBooking, b: RecentBooking) => a.therapist_name.localeCompare(b.therapist_name)
    },
    {
      title: 'Service',
      dataIndex: 'service_name',
      key: 'service_name',
      sorter: (a: RecentBooking, b: RecentBooking) => a.service_name.localeCompare(b.service_name)
    },
    {
      title: 'Date & Time',
      dataIndex: 'booking_time',
      key: 'booking_time',
      sorter: (a: RecentBooking, b: RecentBooking) => dayjs(a.booking_time).unix() - dayjs(b.booking_time).unix(),
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
      sorter: (a: RecentBooking, b: RecentBooking) => a.status.localeCompare(b.status),
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
    ...(isAdmin(userRole) && !isTherapist(userRole) ? [{
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
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ marginBottom: 8 }}>
          {isTherapist(userRole)
            ? `Welcome back, ${identity?.first_name || identity?.name || 'Therapist'}!`
            : `Rejuvenators Dashboard - ${getRoleName(userRole)}`
          }
        </Title>
        <Text type="secondary">
          {isTherapist(userRole)
            ? "Here's an overview of your bookings and performance"
            : "Overview of your booking business"
          }
        </Text>
        <div style={{ marginTop: 8 }}>
          <Text strong>Period: </Text>
          <Text>{getDateRangeLabel()}</Text>
        </div>
      </div>

      {/* Date Range Selector - Mobile Responsive */}
      <Card size="small" style={{ marginBottom: 24 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
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
            <Space direction="vertical" style={{ width: '100%', marginTop: 4 }} size="small">
              <RangePicker
                value={selectedPreset === 'custom' ? [dateRange.start, dateRange.end] : null}
                onChange={handleCustomDateRange}
                style={{ width: '100%' }}
              />
              <Button
                icon={<ReloadOutlined />}
                onClick={fetchDashboardData}
                loading={loading}
                block
              >
                Refresh
              </Button>
            </Space>
          </div>
        </Space>
      </Card>

      {/* Quick Actions - Mobile Responsive */}
      <Card title="Quick Actions" style={{ marginBottom: 24 }}>
        <Row gutter={[12, 12]}>
          <Col xs={12} sm={6}>
            <div
              onClick={() => { window.location.href = '/admin/calendar'; }}
              style={{
                height: 'auto',
                padding: '20px 16px',
                backgroundColor: '#005f6b',
                color: 'white',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 500
              }}
            >
              <CalendarOutlined style={{ fontSize: '24px' }} />
              <CalendarOutlined style={{ fontSize: '24px' }} />
              <span>Calendar</span>
            </div>
          </Col>
          <Col xs={12} sm={6}>
            <div
              onClick={() => { window.location.href = '/admin/bookings'; }}
              style={{
                height: 'auto',
                padding: '20px 16px',
                backgroundColor: '#e07a5f',
                color: 'white',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 500
              }}
            >
              <FileTextOutlined style={{ fontSize: '24px' }} />
              <FileTextOutlined style={{ fontSize: '24px' }} />
              <span>Bookings</span>
            </div>
          </Col>
          <Col xs={12} sm={6}>
            <div
              onClick={() => { window.location.href = '/admin/quotes'; }}
              style={{
                height: 'auto',
                padding: '20px 16px',
                backgroundColor: '#d4a843',
                color: 'white',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 500
              }}
            >
              <DollarOutlined style={{ fontSize: '24px' }} />
              <DollarOutlined style={{ fontSize: '24px' }} />
              <span>Quotes</span>
            </div>
          </Col>
          <Col xs={12} sm={6}>
            <div
              onClick={() => { window.location.href = '/admin/therapist-payments'; }}
              style={{
                height: 'auto',
                padding: '20px 16px',
                backgroundColor: '#5f7bc7',
                color: 'white',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 500
              }}
            >
              <TeamOutlined style={{ fontSize: '24px' }} />
              <TeamOutlined style={{ fontSize: '24px' }} />
              <span>Therapist Payments</span>
            </div>
          </Col>
        </Row>
      </Card>

      {/* Key Statistics - Role-based display */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={12} md={6}>
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
            <Col xs={12} sm={12} md={6}>
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
            <Col xs={12} sm={12} md={6}>
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
            <Col xs={12} sm={12} md={6}>
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
          // ADMIN VIEW: Show revenue and average
          <>
            <Col xs={12} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Completed Revenue"
                  value={stats?.totalRevenue || 0}
                  prefix={<DollarOutlined />}
                  precision={2}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Confirmed Revenue"
                  value={stats?.confirmedRevenue || 0}
                  prefix={<DollarOutlined />}
                  precision={2}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={12} md={6}>
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
            <Col xs={12} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Pending Bookings"
                  value={stats?.pendingBookings || 0}
                  prefix={<ClockCircleOutlined />}
                  valueStyle={{ color: stats?.pendingBookingsColor || '#faad14' }}
                  suffix={stats?.pendingBookings ? `(${stats?.pendingBookingsWeeks}w)` : ''}
                />
              </Card>
            </Col>
          </>
        )}
      </Row>

      {/* Second row for therapists - Fees Declined */}
      {isTherapist(userRole) && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={12} sm={12} md={6}>
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

      {/* Admin-specific Statistics */}
      {isAdmin(userRole) && (
        <>
          {/* Therapist Fees and Margins */}
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col xs={12} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Active Therapists"
                  value={stats?.activeTherapists || 0}
                  prefix={<UserOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={12} md={6}>
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
            <Col xs={12} sm={12} md={6}>
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
            <Col xs={12} sm={12} md={6}>
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

          {/* Quote Statistics */}
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} md={12}>
              <Card>
                <Statistic
                  title="Draft Quotes"
                  value={stats?.draftQuotes || 0}
                  prefix={<FileTextOutlined />}
                  valueStyle={{ color: stats?.draftQuotesColor || '#52c41a' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={12}>
              <Card>
                <Statistic
                  title="Sent Quotes"
                  value={stats?.sentQuotes || 0}
                  prefix={<FileTextOutlined />}
                  valueStyle={{ color: stats?.sentQuotesColor || '#52c41a' }}
                  suffix={stats?.sentQuotes ? `(${stats?.sentQuotesWeeks}w)` : ''}
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
