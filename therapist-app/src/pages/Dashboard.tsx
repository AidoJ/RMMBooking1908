import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Button, List, Typography, Space, Tag, Spin, Empty } from 'antd';
import {
  CalendarOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  FileTextOutlined,
  UserOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { supabaseClient } from '../utility/supabaseClient';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';

const { Title, Text } = Typography;

dayjs.extend(isoWeek);

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    todayJobs: 0,
    weekJobs: 0,
    todayEarnings: 0,
    weekEarnings: 0,
  });
  const [todayBookings, setTodayBookings] = useState<any[]>([]);
  const [upcomingBookings, setUpcomingBookings] = useState<any[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Get user data from localStorage
      const userStr = localStorage.getItem('therapistUser');
      if (!userStr) {
        setLoading(false);
        return;
      }

      const userData = JSON.parse(userStr);
      const userId = userData.user_id || userData.id;

      // Get therapist profile
      const { data: profile, error: profileError } = await supabaseClient
        .from('therapist_profiles')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (profileError || !profile) {
        console.error('Profile error:', profileError);
        setLoading(false);
        return;
      }

      // Calculate date ranges
      const today = dayjs();
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
        .in('status', ['confirmed', 'completed'])
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
        .in('status', ['confirmed'])
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

      setStats({
        todayJobs: todayBookingsData.length,
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
      case 'confirmed':
        return 'blue';
      case 'completed':
        return 'green';
      default:
        return 'default';
    }
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
      {/* Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #007e8c 0%, #1FBFBF 100%)',
        padding: '32px 24px',
        borderRadius: '12px',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px'
      }}>
        <div style={{
          width: '80px',
          height: '80px',
          background: 'rgba(255, 255, 255, 0.2)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '40px',
          color: 'white',
          fontWeight: 'bold'
        }}>
          <span style={{ transform: 'rotate(-20deg)', display: 'inline-block' }}>///</span>
          <span style={{ fontSize: '50px' }}>Ó</span>
        </div>
        <div>
          <Title level={1} style={{ color: 'white', margin: 0, fontSize: '36px', letterSpacing: '2px' }}>
            REJUVENATORS<sup style={{ fontSize: '16px' }}>®</sup>
          </Title>
          <Title level={2} style={{ color: 'white', margin: 0, fontStyle: 'italic', fontWeight: 300, fontSize: '24px' }}>
            Therapist Portal
          </Title>
        </div>
      </div>

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
                      <Tag color={getStatusColor(booking.status)}>
                        {booking.status}
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
                      <Tag color="blue">Confirmed</Tag>
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
