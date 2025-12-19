import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Button, List, Typography, Space, Tag, Spin, Empty, Alert } from 'antd';
import {
  CalendarOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  FileTextOutlined,
  UserOutlined,
  DollarOutlined,
  ExclamationCircleOutlined,
  ClockCircleFilled,
  SafetyCertificateOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { supabaseClient } from '../utility/supabaseClient';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';

const { Text } = Typography;

dayjs.extend(isoWeek);

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    todayJobs: 0,
    requestedJobs: 0,
    pendingJobs: 0,
    weekJobs: 0,
    todayEarnings: 0,
    weekEarnings: 0,
  });
  const [todayBookings, setTodayBookings] = useState<any[]>([]);
  const [upcomingBookings, setUpcomingBookings] = useState<any[]>([]);
  const [certificateStatus, setCertificateStatus] = useState({
    insurance: 'ok',
    firstAid: 'ok',
    insuranceExpiry: null as string | null,
    firstAidExpiry: null as string | null,
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Get therapist profile from localStorage
      const profileStr = localStorage.getItem('therapist_profile');
      if (!profileStr) {
        setLoading(false);
        return;
      }

      const profile = JSON.parse(profileStr);
      if (!profile || !profile.id) {
        console.error('Invalid therapist profile in localStorage');
        setLoading(false);
        return;
      }

      // Get updated certificate dates from database
      const { data: profileData, error: profileError } = await supabaseClient
        .from('therapist_profiles')
        .select('id, insurance_expiry_date, first_aid_expiry_date')
        .eq('id', profile.id)
        .single();

      if (!profileError && profileData) {
        // Update profile with latest certificate dates
        profile.insurance_expiry_date = profileData.insurance_expiry_date;
        profile.first_aid_expiry_date = profileData.first_aid_expiry_date;
      }

      // Check certificate expiry status
      const today = dayjs();
      const oneMonthFromNow = today.add(1, 'month');

      const checkCertStatus = (expiryDate: string | null) => {
        if (!expiryDate) return 'missing';
        const expiry = dayjs(expiryDate);
        if (expiry.isBefore(today)) return 'expired';
        if (expiry.isBefore(oneMonthFromNow)) return 'expiring';
        return 'ok';
      };

      setCertificateStatus({
        insurance: checkCertStatus(profile.insurance_expiry_date),
        firstAid: checkCertStatus(profile.first_aid_expiry_date),
        insuranceExpiry: profile.insurance_expiry_date,
        firstAidExpiry: profile.first_aid_expiry_date,
      });

      // Calculate date ranges
      const todayStart = today.startOf('day').toISOString();
      const todayEnd = today.endOf('day').toISOString();
      const weekStart = today.startOf('isoWeek').toISOString();
      const weekEnd = today.endOf('isoWeek').toISOString();

      // Get today's bookings
      const { data: todayData, error: todayError } = await supabaseClient
        .from('bookings')
        .select(`
          *,
          services(name)
        `)
        .eq('therapist_id', profile.id)
        .gte('booking_time', todayStart)
        .lte('booking_time', todayEnd)
        .in('status', ['requested', 'confirmed', 'completed'])
        .order('booking_time');

      if (todayError) {
        console.error('Today bookings error:', todayError);
      }

      // Get upcoming bookings (next 7 days, excluding today)
      const tomorrowStart = today.add(1, 'day').startOf('day').toISOString();
      const nextWeekEnd = today.add(7, 'day').endOf('day').toISOString();

      const { data: upcomingData, error: upcomingError } = await supabaseClient
        .from('bookings')
        .select(`
          *,
          services(name)
        `)
        .eq('therapist_id', profile.id)
        .gte('booking_time', tomorrowStart)
        .lte('booking_time', nextWeekEnd)
        .in('status', ['requested', 'confirmed'])
        .order('booking_time')
        .limit(5);

      if (upcomingError) {
        console.error('Upcoming bookings error:', upcomingError);
      }

      // Get this week's bookings for stats
      const { data: weekData, error: weekError } = await supabaseClient
        .from('bookings')
        .select('id, therapist_fee, booking_time, status')
        .eq('therapist_id', profile.id)
        .gte('booking_time', weekStart)
        .lte('booking_time', weekEnd);

      if (weekError) {
        console.error('Week data error:', weekError);
      }

      // Get ALL pending bookings for stats (no date filter)
      const { data: pendingData, error: pendingError } = await supabaseClient
        .from('bookings')
        .select('id')
        .eq('therapist_id', profile.id)
        .eq('status', 'pending');

      if (pendingError) {
        console.error('Pending bookings error:', pendingError);
      }

      // Process bookings data
      const todayBookingsData = (todayData || []).map((b: any) => ({
        ...b,
        customer_name: b.booker_name || `${b.first_name || ''} ${b.last_name || ''}`.trim() || 'Guest',
        service_name: b.services?.name || 'Unknown Service',
      }));

      const upcomingBookingsData = (upcomingData || []).map((b: any) => ({
        ...b,
        customer_name: b.booker_name || `${b.first_name || ''} ${b.last_name || ''}`.trim() || 'Guest',
        service_name: b.services?.name || 'Unknown Service',
      }));

      setTodayBookings(todayBookingsData);
      setUpcomingBookings(upcomingBookingsData);

      // Calculate stats
      const todayCompleted = (weekData || []).filter(
        (b: any) => b.status === 'completed' && dayjs(b.booking_time).isSame(today, 'day')
      );

      const weekCompleted = (weekData || []).filter((b: any) => b.status === 'completed');

      // Count requested jobs from today and upcoming bookings
      const requestedCount = [...todayBookingsData, ...upcomingBookingsData].filter(
        (b: any) => b.status === 'requested'
      ).length;

      // Count pending jobs (quoted jobs awaiting client acceptance) - ALL pending, no date filter
      const pendingCount = pendingData?.length || 0;

      setStats({
        todayJobs: todayBookingsData.length,
        requestedJobs: requestedCount,
        pendingJobs: pendingCount,
        weekJobs: weekData?.length || 0,
        todayEarnings: todayCompleted.reduce((sum: number, b: any) => sum + parseFloat(b.therapist_fee || '0'), 0),
        weekEarnings: weekCompleted.reduce((sum: number, b: any) => sum + parseFloat(b.therapist_fee || '0'), 0),
      });
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'requested':
        return 'warning'; // Yellow background
      case 'confirmed':
        return 'blue';
      case 'completed':
        return 'green';
      default:
        return 'default';
    }
  };

  const getStatusStyle = (status: string) => {
    if (status === 'requested') {
      return {
        backgroundColor: '#FFD700',
        color: '#000',
        fontWeight: 'bold',
        border: '1px solid #FFA500'
      };
    }
    return {};
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      {/* Stats Grid */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="Today's Jobs"
              value={stats.todayJobs}
              prefix={<CalendarOutlined />}
              valueStyle={{ color: '#007e8c', fontSize: '24px' }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card style={{ borderColor: '#FFD700', borderWidth: '2px' }}>
            <Statistic
              title="Requested Jobs"
              value={stats.requestedJobs}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: '#FFD700', fontSize: '24px', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card style={{ borderColor: '#ff7875', borderWidth: '2px' }}>
            <Statistic
              title="Pending Jobs"
              value={stats.pendingJobs}
              prefix={<ClockCircleFilled />}
              valueStyle={{ color: '#ff7875', fontSize: '24px' }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="This Week"
              value={stats.weekJobs}
              prefix={<CalendarOutlined />}
              valueStyle={{ color: '#00a99d', fontSize: '24px' }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="Today's Earnings"
              value={stats.todayEarnings}
              precision={2}
              prefix="$"
              valueStyle={{ color: '#52c41a', fontSize: '24px' }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="Week's Earnings"
              value={stats.weekEarnings}
              precision={2}
              prefix="$"
              valueStyle={{ color: '#52c41a', fontSize: '24px' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Quick Actions */}
      <Card title="Quick Actions" style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={6}>
            <Button
              type="primary"
              icon={<CalendarOutlined />}
              onClick={() => navigate('/calendar')}
              block
              size="large"
              style={{ background: '#007e8c', borderColor: '#007e8c' }}
            >
              Calendar
            </Button>
          </Col>
          <Col xs={12} sm={6}>
            <Button
              type="primary"
              icon={<FileTextOutlined />}
              onClick={() => navigate('/my-earnings')}
              block
              size="large"
              style={{ background: '#1FBFBF', borderColor: '#1FBFBF' }}
            >
              My Earnings
            </Button>
          </Col>
          <Col xs={12} sm={6}>
            <Button
              type="primary"
              icon={<FileTextOutlined />}
              onClick={() => navigate('/bookings')}
              block
              size="large"
              style={{ background: '#5F7BC7', borderColor: '#5F7BC7' }}
            >
              My Bookings
            </Button>
          </Col>
          <Col xs={12} sm={6}>
            <Button
              type="primary"
              icon={<DollarOutlined />}
              onClick={() => navigate('/invoices')}
              block
              size="large"
              style={{ background: '#C74BC7', borderColor: '#C74BC7' }}
            >
              Invoices
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Certificate Status */}
      <Card
        title={
          <Space>
            <SafetyCertificateOutlined />
            <span>Certificate Status</span>
          </Space>
        }
        style={{ marginBottom: 24 }}
        extra={
          <Button type="link" onClick={() => navigate('/profile')}>
            Update
          </Button>
        }
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12}>
            <div style={{
              padding: '16px',
              borderRadius: '8px',
              border: `2px solid ${
                certificateStatus.insurance === 'ok' ? '#52c41a' :
                certificateStatus.insurance === 'expiring' ? '#faad14' : '#ff4d4f'
              }`,
              background: certificateStatus.insurance === 'ok' ? '#f6ffed' :
                certificateStatus.insurance === 'expiring' ? '#fffbe6' : '#fff2f0'
            }}>
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <Space>
                  {certificateStatus.insurance === 'ok' && <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 20 }} />}
                  {certificateStatus.insurance === 'expiring' && <WarningOutlined style={{ color: '#faad14', fontSize: 20 }} />}
                  {certificateStatus.insurance === 'expired' && <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 20 }} />}
                  {certificateStatus.insurance === 'missing' && <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 20 }} />}
                  <Text strong style={{ fontSize: 16 }}>Insurance Certificate</Text>
                </Space>
                {certificateStatus.insuranceExpiry ? (
                  <Text type="secondary">
                    Expires: {dayjs(certificateStatus.insuranceExpiry).format('DD/MM/YYYY')}
                  </Text>
                ) : (
                  <Text type="danger">Not uploaded</Text>
                )}
                {certificateStatus.insurance === 'expiring' && (
                  <Alert message="Expires within 30 days" type="warning" showIcon style={{ marginTop: 8 }} />
                )}
                {certificateStatus.insurance === 'expired' && (
                  <Alert message="Certificate expired!" type="error" showIcon style={{ marginTop: 8 }} />
                )}
              </Space>
            </div>
          </Col>
          <Col xs={24} sm={12}>
            <div style={{
              padding: '16px',
              borderRadius: '8px',
              border: `2px solid ${
                certificateStatus.firstAid === 'ok' ? '#52c41a' :
                certificateStatus.firstAid === 'expiring' ? '#faad14' : '#ff4d4f'
              }`,
              background: certificateStatus.firstAid === 'ok' ? '#f6ffed' :
                certificateStatus.firstAid === 'expiring' ? '#fffbe6' : '#fff2f0'
            }}>
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <Space>
                  {certificateStatus.firstAid === 'ok' && <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 20 }} />}
                  {certificateStatus.firstAid === 'expiring' && <WarningOutlined style={{ color: '#faad14', fontSize: 20 }} />}
                  {certificateStatus.firstAid === 'expired' && <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 20 }} />}
                  {certificateStatus.firstAid === 'missing' && <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 20 }} />}
                  <Text strong style={{ fontSize: 16 }}>First Aid Certificate</Text>
                </Space>
                {certificateStatus.firstAidExpiry ? (
                  <Text type="secondary">
                    Expires: {dayjs(certificateStatus.firstAidExpiry).format('DD/MM/YYYY')}
                  </Text>
                ) : (
                  <Text type="danger">Not uploaded</Text>
                )}
                {certificateStatus.firstAid === 'expiring' && (
                  <Alert message="Expires within 30 days" type="warning" showIcon style={{ marginTop: 8 }} />
                )}
                {certificateStatus.firstAid === 'expired' && (
                  <Alert message="Certificate expired!" type="error" showIcon style={{ marginTop: 8 }} />
                )}
              </Space>
            </div>
          </Col>
        </Row>
      </Card>

      {/* Today's Bookings */}
      <Card title="Today's Bookings" style={{ marginBottom: 24 }}>
        {todayBookings.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No bookings scheduled for today"
          />
        ) : (
          <List
            dataSource={todayBookings}
            renderItem={(booking) => (
              <List.Item
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/booking/${booking.id}`)}
              >
                <List.Item.Meta
                  avatar={
                    <div style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: '#007e8c',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white'
                    }}>
                      <UserOutlined style={{ fontSize: 20 }} />
                    </div>
                  }
                  title={
                    <Space>
                      <Text strong>{booking.customer_name}</Text>
                      <Tag color={getStatusColor(booking.status)} style={getStatusStyle(booking.status)}>
                        {booking.status.toUpperCase()}
                      </Tag>
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={0}>
                      <Text>{booking.service_name}</Text>
                      <Space size="large">
                        <Space size="small">
                          <ClockCircleOutlined />
                          <Text type="secondary">{dayjs(booking.booking_time).format('h:mm A')}</Text>
                        </Space>
                        <Space size="small">
                          <EnvironmentOutlined />
                          <Text type="secondary">{booking.address?.split(',')[0] || 'No address'}</Text>
                        </Space>
                      </Space>
                    </Space>
                  }
                />
                <div>
                  <Text strong style={{ color: '#52c41a', fontSize: '16px' }}>
                    ${parseFloat(booking.therapist_fee?.toString() || '0').toFixed(2)}
                  </Text>
                </div>
              </List.Item>
            )}
          />
        )}
      </Card>

      {/* Upcoming Bookings */}
      <Card title="Upcoming Bookings">
        {upcomingBookings.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No upcoming bookings"
          />
        ) : (
          <List
            dataSource={upcomingBookings}
            renderItem={(booking) => (
              <List.Item
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/booking/${booking.id}`)}
              >
                <List.Item.Meta
                  avatar={
                    <div style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: '#00a99d',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white'
                    }}>
                      <CalendarOutlined style={{ fontSize: 20 }} />
                    </div>
                  }
                  title={
                    <Space>
                      <Text strong>{booking.customer_name}</Text>
                      <Tag color={getStatusColor(booking.status)} style={getStatusStyle(booking.status)}>
                        {booking.status.toUpperCase()}
                      </Tag>
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={0}>
                      <Text>{booking.service_name}</Text>
                      <Space size="large">
                        <Space size="small">
                          <CalendarOutlined />
                          <Text type="secondary">{dayjs(booking.booking_time).format('MMM DD, YYYY')}</Text>
                        </Space>
                        <Space size="small">
                          <ClockCircleOutlined />
                          <Text type="secondary">{dayjs(booking.booking_time).format('h:mm A')}</Text>
                        </Space>
                      </Space>
                    </Space>
                  }
                />
                <div>
                  <Text strong style={{ color: '#52c41a', fontSize: '16px' }}>
                    ${parseFloat(booking.therapist_fee?.toString() || '0').toFixed(2)}
                  </Text>
                </div>
              </List.Item>
            )}
          />
        )}
      </Card>
    </div>
  );
};
