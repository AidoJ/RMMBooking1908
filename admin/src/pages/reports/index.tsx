import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  DatePicker,
  Select,
  Space,
  Typography,
  Table,
  Tag,
  Spin,
  Button,
  Divider,
} from 'antd';
import {
  DollarOutlined,
  CalendarOutlined,
  UserOutlined,
  ShoppingOutlined,
  RiseOutlined,
  FallOutlined,
  DownloadOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { supabaseClient } from '../../utility';
import dayjs, { Dayjs } from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(isoWeek);

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

interface RevenueData {
  totalRevenue: number;
  totalBookings: number;
  completedBookings: number;
  averageBookingValue: number;
  totalTherapistFees: number;
  netProfit: number;
  revenueChange: number;
}

interface TherapistPerformance {
  id: string;
  name: string;
  completedJobs: number;
  totalHours: number;
  totalFees: number;
  averageHourlyRate: number;
  utilizationRate: number;
}

interface ServicePerformance {
  id: string;
  name: string;
  bookings: number;
  revenue: number;
  therapistFees: number;
  netProfit: number;
  averagePrice: number;
}

interface BookingAnalytics {
  dayOfWeek: string;
  count: number;
  revenue: number;
}

export const Reports: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().startOf('month'),
    dayjs().endOf('month'),
  ]);
  const [selectedTherapist, setSelectedTherapist] = useState<string>('all');
  const [selectedService, setSelectedService] = useState<string>('all');

  // Data states
  const [revenueData, setRevenueData] = useState<RevenueData | null>(null);
  const [therapistPerformance, setTherapistPerformance] = useState<TherapistPerformance[]>([]);
  const [servicePerformance, setServicePerformance] = useState<ServicePerformance[]>([]);
  const [bookingAnalytics, setBookingAnalytics] = useState<BookingAnalytics[]>([]);

  // Filter options
  const [therapists, setTherapists] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);

  useEffect(() => {
    loadFilterOptions();
  }, []);

  useEffect(() => {
    loadReports();
  }, [dateRange, selectedTherapist, selectedService]);

  const loadFilterOptions = async () => {
    try {
      // Load therapists
      const { data: therapistsData } = await supabaseClient
        .from('therapist_profiles')
        .select('id, first_name, last_name')
        .eq('is_active', true)
        .order('first_name');

      // Load services
      const { data: servicesData } = await supabaseClient
        .from('services')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      setTherapists(therapistsData || []);
      setServices(servicesData || []);
    } catch (error) {
      console.error('Error loading filter options:', error);
    }
  };

  const loadReports = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadRevenueDashboard(),
        loadTherapistPerformance(),
        loadServicePerformance(),
        loadBookingAnalytics(),
      ]);
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRevenueDashboard = async () => {
    try {
      const startDate = dateRange[0].format('YYYY-MM-DD');
      const endDate = dateRange[1].format('YYYY-MM-DD');

      let query = supabaseClient
        .from('bookings')
        .select('id, price, therapist_fee, status, booking_time, therapist_id, service_id')
        .gte('booking_time', startDate)
        .lte('booking_time', endDate + ' 23:59:59');

      if (selectedTherapist !== 'all') {
        query = query.eq('therapist_id', selectedTherapist);
      }

      if (selectedService !== 'all') {
        query = query.eq('service_id', selectedService);
      }

      const { data: bookings, error } = await query;

      if (error) throw error;

      const completed = bookings?.filter(b => b.status === 'completed') || [];
      const totalRevenue = completed.reduce((sum, b) => sum + (parseFloat(b.price?.toString() || '0')), 0);
      const totalTherapistFees = completed.reduce((sum, b) => sum + (parseFloat(b.therapist_fee?.toString() || '0')), 0);
      const netProfit = totalRevenue - totalTherapistFees;
      const averageBookingValue = completed.length > 0 ? totalRevenue / completed.length : 0;

      // Calculate previous period for comparison
      const daysDiff = dateRange[1].diff(dateRange[0], 'day');
      const prevStart = dateRange[0].subtract(daysDiff + 1, 'day');
      const prevEnd = dateRange[0].subtract(1, 'day');

      const { data: prevBookings } = await supabaseClient
        .from('bookings')
        .select('price')
        .eq('status', 'completed')
        .gte('booking_time', prevStart.format('YYYY-MM-DD'))
        .lte('booking_time', prevEnd.format('YYYY-MM-DD') + ' 23:59:59');

      const prevRevenue = prevBookings?.reduce((sum, b) => sum + (parseFloat(b.price?.toString() || '0')), 0) || 0;
      const revenueChange = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;

      setRevenueData({
        totalRevenue,
        totalBookings: bookings?.length || 0,
        completedBookings: completed.length,
        averageBookingValue,
        totalTherapistFees,
        netProfit,
        revenueChange,
      });
    } catch (error) {
      console.error('Error loading revenue dashboard:', error);
    }
  };

  const loadTherapistPerformance = async () => {
    try {
      const startDate = dateRange[0].format('YYYY-MM-DD');
      const endDate = dateRange[1].format('YYYY-MM-DD');

      const { data: bookings, error } = await supabaseClient
        .from('bookings')
        .select(`
          id,
          therapist_id,
          duration_minutes,
          therapist_fee,
          status,
          therapist_profiles!therapist_id (
            id,
            first_name,
            last_name
          )
        `)
        .eq('status', 'completed')
        .gte('booking_time', startDate)
        .lte('booking_time', endDate + ' 23:59:59');

      if (error) throw error;

      // Group by therapist
      const therapistMap = new Map<string, TherapistPerformance>();

      bookings?.forEach(booking => {
        const therapist = booking.therapist_profiles as any;
        if (!therapist) return;

        const therapistId = booking.therapist_id;
        const therapistName = `${therapist.first_name} ${therapist.last_name}`;

        if (!therapistMap.has(therapistId)) {
          therapistMap.set(therapistId, {
            id: therapistId,
            name: therapistName,
            completedJobs: 0,
            totalHours: 0,
            totalFees: 0,
            averageHourlyRate: 0,
            utilizationRate: 0,
          });
        }

        const perf = therapistMap.get(therapistId)!;
        perf.completedJobs += 1;
        perf.totalHours += (booking.duration_minutes || 0) / 60;
        perf.totalFees += parseFloat(booking.therapist_fee?.toString() || '0');
      });

      // Calculate averages
      therapistMap.forEach(perf => {
        if (perf.totalHours > 0) {
          perf.averageHourlyRate = perf.totalFees / perf.totalHours;
        }
        // Utilization rate would need available hours data - placeholder for now
        perf.utilizationRate = 0;
      });

      setTherapistPerformance(Array.from(therapistMap.values()).sort((a, b) => b.totalFees - a.totalFees));
    } catch (error) {
      console.error('Error loading therapist performance:', error);
    }
  };

  const loadServicePerformance = async () => {
    try {
      const startDate = dateRange[0].format('YYYY-MM-DD');
      const endDate = dateRange[1].format('YYYY-MM-DD');

      const { data: bookings, error } = await supabaseClient
        .from('bookings')
        .select(`
          id,
          service_id,
          price,
          therapist_fee,
          status,
          services!service_id (
            id,
            name
          )
        `)
        .eq('status', 'completed')
        .gte('booking_time', startDate)
        .lte('booking_time', endDate + ' 23:59:59');

      if (error) throw error;

      // Group by service
      const serviceMap = new Map<string, ServicePerformance>();

      bookings?.forEach(booking => {
        const service = booking.services as any;
        if (!service) return;

        const serviceId = booking.service_id;
        const serviceName = service.name;

        if (!serviceMap.has(serviceId)) {
          serviceMap.set(serviceId, {
            id: serviceId,
            name: serviceName,
            bookings: 0,
            revenue: 0,
            therapistFees: 0,
            netProfit: 0,
            averagePrice: 0,
          });
        }

        const perf = serviceMap.get(serviceId)!;
        perf.bookings += 1;
        perf.revenue += parseFloat(booking.price?.toString() || '0');
        perf.therapistFees += parseFloat(booking.therapist_fee?.toString() || '0');
      });

      // Calculate derived metrics
      serviceMap.forEach(perf => {
        perf.netProfit = perf.revenue - perf.therapistFees;
        perf.averagePrice = perf.bookings > 0 ? perf.revenue / perf.bookings : 0;
      });

      setServicePerformance(Array.from(serviceMap.values()).sort((a, b) => b.revenue - a.revenue));
    } catch (error) {
      console.error('Error loading service performance:', error);
    }
  };

  const loadBookingAnalytics = async () => {
    try {
      const startDate = dateRange[0].format('YYYY-MM-DD');
      const endDate = dateRange[1].format('YYYY-MM-DD');

      const { data: bookings, error } = await supabaseClient
        .from('bookings')
        .select('id, booking_time, price, status')
        .eq('status', 'completed')
        .gte('booking_time', startDate)
        .lte('booking_time', endDate + ' 23:59:59');

      if (error) throw error;

      // Group by day of week
      const dayMap = new Map<number, { count: number; revenue: number }>();
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

      bookings?.forEach(booking => {
        const dayOfWeek = dayjs(booking.booking_time).day();

        if (!dayMap.has(dayOfWeek)) {
          dayMap.set(dayOfWeek, { count: 0, revenue: 0 });
        }

        const data = dayMap.get(dayOfWeek)!;
        data.count += 1;
        data.revenue += parseFloat(booking.price?.toString() || '0');
      });

      const analytics: BookingAnalytics[] = [];
      days.forEach((dayName, index) => {
        const data = dayMap.get(index) || { count: 0, revenue: 0 };
        analytics.push({
          dayOfWeek: dayName,
          count: data.count,
          revenue: data.revenue,
        });
      });

      setBookingAnalytics(analytics);
    } catch (error) {
      console.error('Error loading booking analytics:', error);
    }
  };

  const therapistColumns = [
    {
      title: 'Therapist',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Jobs',
      dataIndex: 'completedJobs',
      key: 'jobs',
      align: 'center' as const,
    },
    {
      title: 'Hours',
      dataIndex: 'totalHours',
      key: 'hours',
      render: (hours: number) => hours.toFixed(1),
    },
    {
      title: 'Avg Hourly Rate',
      dataIndex: 'averageHourlyRate',
      key: 'avgRate',
      render: (rate: number) => `$${rate.toFixed(2)}`,
    },
    {
      title: 'Total Fees',
      dataIndex: 'totalFees',
      key: 'fees',
      render: (fees: number) => <Text strong style={{ color: '#52c41a' }}>${fees.toFixed(2)}</Text>,
    },
  ];

  const serviceColumns = [
    {
      title: 'Service',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Bookings',
      dataIndex: 'bookings',
      key: 'bookings',
      align: 'center' as const,
    },
    {
      title: 'Revenue',
      dataIndex: 'revenue',
      key: 'revenue',
      render: (revenue: number) => `$${revenue.toFixed(2)}`,
    },
    {
      title: 'Therapist Fees',
      dataIndex: 'therapistFees',
      key: 'fees',
      render: (fees: number) => `$${fees.toFixed(2)}`,
    },
    {
      title: 'Net Profit',
      dataIndex: 'netProfit',
      key: 'profit',
      render: (profit: number) => (
        <Text strong style={{ color: profit >= 0 ? '#52c41a' : '#ff4d4f' }}>
          ${profit.toFixed(2)}
        </Text>
      ),
    },
    {
      title: 'Avg Price',
      dataIndex: 'averagePrice',
      key: 'avgPrice',
      render: (price: number) => `$${price.toFixed(2)}`,
    },
  ];

  const analyticsColumns = [
    {
      title: 'Day',
      dataIndex: 'dayOfWeek',
      key: 'day',
    },
    {
      title: 'Bookings',
      dataIndex: 'count',
      key: 'count',
      align: 'center' as const,
      render: (count: number) => <Tag color="blue">{count}</Tag>,
    },
    {
      title: 'Revenue',
      dataIndex: 'revenue',
      key: 'revenue',
      render: (revenue: number) => `$${revenue.toFixed(2)}`,
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>Business Reports</Title>

      {/* Filter Bar */}
      <Card style={{ marginBottom: 24 }}>
        <Space wrap>
          <RangePicker
            value={dateRange}
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                setDateRange([dates[0], dates[1]]);
              }
            }}
            format="YYYY-MM-DD"
            presets={[
              { label: 'Today', value: [dayjs(), dayjs()] },
              { label: 'This Week', value: [dayjs().startOf('week'), dayjs().endOf('week')] },
              { label: 'This Month', value: [dayjs().startOf('month'), dayjs().endOf('month')] },
              { label: 'Last Month', value: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] },
            ]}
          />
          <Select
            style={{ width: 200 }}
            value={selectedTherapist}
            onChange={setSelectedTherapist}
            placeholder="All Therapists"
          >
            <Option value="all">All Therapists</Option>
            {therapists.map(t => (
              <Option key={t.id} value={t.id}>
                {t.first_name} {t.last_name}
              </Option>
            ))}
          </Select>
          <Select
            style={{ width: 200 }}
            value={selectedService}
            onChange={setSelectedService}
            placeholder="All Services"
          >
            <Option value="all">All Services</Option>
            {services.map(s => (
              <Option key={s.id} value={s.id}>
                {s.name}
              </Option>
            ))}
          </Select>
          <Button icon={<ReloadOutlined />} onClick={loadReports} loading={loading}>
            Refresh
          </Button>
        </Space>
      </Card>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <Spin size="large" />
        </div>
      ) : (
        <>
          {/* 1. Revenue Dashboard */}
          <Card title="Revenue Dashboard" style={{ marginBottom: 24 }}>
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} lg={8}>
                <Statistic
                  title="Total Revenue"
                  value={revenueData?.totalRevenue || 0}
                  precision={2}
                  prefix="$"
                  valueStyle={{ color: '#3f8600' }}
                  suffix={
                    revenueData && revenueData.revenueChange !== 0 ? (
                      <Tag color={revenueData.revenueChange > 0 ? 'green' : 'red'} style={{ marginLeft: 8 }}>
                        {revenueData.revenueChange > 0 ? <RiseOutlined /> : <FallOutlined />}
                        {Math.abs(revenueData.revenueChange).toFixed(1)}%
                      </Tag>
                    ) : undefined
                  }
                />
              </Col>
              <Col xs={24} sm={12} lg={8}>
                <Statistic
                  title="Completed Bookings"
                  value={revenueData?.completedBookings || 0}
                  prefix={<ShoppingOutlined />}
                  suffix={`/ ${revenueData?.totalBookings || 0}`}
                />
              </Col>
              <Col xs={24} sm={12} lg={8}>
                <Statistic
                  title="Average Booking Value"
                  value={revenueData?.averageBookingValue || 0}
                  precision={2}
                  prefix="$"
                />
              </Col>
              <Col xs={24} sm={12} lg={8}>
                <Statistic
                  title="Therapist Fees"
                  value={revenueData?.totalTherapistFees || 0}
                  precision={2}
                  prefix="$"
                  valueStyle={{ color: '#cf1322' }}
                />
              </Col>
              <Col xs={24} sm={12} lg={8}>
                <Statistic
                  title="Net Profit"
                  value={revenueData?.netProfit || 0}
                  precision={2}
                  prefix="$"
                  valueStyle={{ color: (revenueData?.netProfit || 0) >= 0 ? '#3f8600' : '#cf1322' }}
                />
              </Col>
              <Col xs={24} sm={12} lg={8}>
                <Statistic
                  title="Profit Margin"
                  value={revenueData && revenueData.totalRevenue > 0 ? ((revenueData.netProfit / revenueData.totalRevenue) * 100) : 0}
                  precision={1}
                  suffix="%"
                  valueStyle={{ color: '#1890ff' }}
                />
              </Col>
            </Row>
          </Card>

          {/* 2. Therapist Performance */}
          <Card
            title="Therapist Performance"
            style={{ marginBottom: 24 }}
            extra={<Button icon={<DownloadOutlined />} size="small">Export</Button>}
          >
            <Table
              dataSource={therapistPerformance}
              columns={therapistColumns}
              rowKey="id"
              pagination={false}
              locale={{ emptyText: 'No data for selected period' }}
            />
          </Card>

          {/* 3. Service Performance */}
          <Card
            title="Service Performance"
            style={{ marginBottom: 24 }}
            extra={<Button icon={<DownloadOutlined />} size="small">Export</Button>}
          >
            <Table
              dataSource={servicePerformance}
              columns={serviceColumns}
              rowKey="id"
              pagination={false}
              locale={{ emptyText: 'No data for selected period' }}
            />
          </Card>

          {/* 4. Booking Analytics */}
          <Card
            title="Booking Analytics - By Day of Week"
            style={{ marginBottom: 24 }}
          >
            <Table
              dataSource={bookingAnalytics}
              columns={analyticsColumns}
              rowKey="dayOfWeek"
              pagination={false}
              locale={{ emptyText: 'No data for selected period' }}
            />
          </Card>
        </>
      )}
    </div>
  );
};

export default Reports;
