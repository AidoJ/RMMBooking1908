import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Button, List, Typography, Space, Tag, Spin } from 'antd';
import {
  CalendarOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  FileTextOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { supabaseClient } from '../services/supabaseClient';
import type { Booking } from '../types';
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
  const [todayBookings, setTodayBookings] = useState<Booking[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Get current user and therapist profile
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabaseClient
        .from('therapist_profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!profile) return;

      // Calculate date ranges
      const today = dayjs().format('YYYY-MM-DD');
      const weekStart = dayjs().startOf('isoWeek').format('YYYY-MM-DD');
      const weekEnd = dayjs().endOf('isoWeek').format('YYYY-MM-DD');

      // Get today's bookings
      const { data: todayData } = await supabaseClient
        .from('bookings')
        .select(`
          *,
          customers(first_name, last_name, phone),
          services(name)
        `)
        .eq('therapist_id', profile.id)
        .gte('booking_time', today + ' 00:00:00')
        .lte('booking_time', today + ' 23:59:59')
        .in('status', ['confirmed', 'on_my_way', 'arrived'])
        .order('booking_time');

      const todayBookingsData = (todayData || []).map((b: any) => ({
        ...b,
        customer_name: b.customers
          ? `${b.customers.first_name} ${b.customers.last_name}`
          : `${b.first_name || ''} ${b.last_name || ''}`.trim(),
        service_name: b.services?.name || 'Unknown Service',
      }));

      setTodayBookings(todayBookingsData);

      // Get this week's completed jobs for earnings
      const { data: weekData } = await supabaseClient
        .from('bookings')
        .select('id, therapist_fee, booking_time, status')
        .eq('therapist_id', profile.id)
        .gte('booking_time', weekStart)
        .lte('booking_time', weekEnd + ' 23:59:59');

      // Calculate stats
      const todayCompleted = weekData?.filter(
        (b) => b.status === 'completed' && dayjs(b.booking_time).isSame(today, 'day')
      ) || [];

      const weekCompleted = weekData?.filter((b) => b.status === 'completed') || [];

      setStats({
        todayJobs: todayBookingsData.length,
        weekJobs: weekData?.length || 0,
        todayEarnings: todayCompleted.reduce((sum, b) => sum + parseFloat(b.therapist_fee || '0'), 0),
        weekEarnings: weekCompleted.reduce((sum, b) => sum + parseFloat(b.therapist_fee || '0'), 0),
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
      case 'on_my_way':
        return 'orange';
      case 'arrived':
        return 'green';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'on_my_way':
        return 'On My Way';
      case 'arrived':
        return 'Arrived';
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <Title level={2} style={{ marginBottom: 24, fontFamily: "'Josefin Sans', sans-serif" }}>
        Dashboard
      </Title>

      {/* Stats Grid */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={12} md={6}>
          <Card>
            <Statistic
              title="Today's Jobs"
              value={stats.todayJobs}
              prefix={<CalendarOutlined style={{ color: '#007e8c' }} />}
              valueStyle={{ color: '#007e8c' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card>
            <Statistic
              title="This Week"
              value={stats.weekJobs}
              prefix={<CalendarOutlined style={{ color: '#00a99d' }} />}
              valueStyle={{ color: '#00a99d' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card>
            <Statistic
              title="Today's $"
              value={stats.todayEarnings}
              precision={2}
              prefix="$"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card>
            <Statistic
              title="Week's $"
              value={stats.weekEarnings}
              precision={2}
              prefix="$"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Quick Actions */}
      <Card title="Quick Actions" style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={12} md={6}>
            <Button
              type="primary"
              icon={<CalendarOutlined />}
              onClick={() => navigate('/schedule')}
              block
              size="large"
              style={{ background: '#007e8c', borderColor: '#007e8c' }}
            >
              Schedule
            </Button>
          </Col>
          <Col xs={12} sm={12} md={6}>
            <Button
              type="primary"
              icon={<FileTextOutlined />}
              onClick={() => navigate('/invoices')}
              block
              size="large"
              style={{ background: '#00a99d', borderColor: '#00a99d' }}
            >
              Invoice
            </Button>
          </Col>
          <Col xs={12} sm={12} md={6}>
            <Button
              type="default"
              icon={<ClockCircleOutlined />}
              onClick={() => navigate('/availability')}
              block
              size="large"
            >
              Availability
            </Button>
          </Col>
          <Col xs={12} sm={12} md={6}>
            <Button
              type="default"
              icon={<EnvironmentOutlined />}
              onClick={() => navigate('/service-area')}
              block
              size="large"
            >
              Service Area
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Earnings Summary */}
      <Card
        style={{
          marginBottom: 24,
          background: 'linear-gradient(135deg, #007e8c 0%, #00a99d 100%)',
          color: 'white',
        }}
      >
        <Row>
          <Col span={12}>
            <Statistic
              title={<span style={{ color: 'white' }}>Today's Earnings</span>}
              value={stats.todayEarnings}
              precision={2}
              prefix="$"
              valueStyle={{ color: 'white' }}
            />
          </Col>
          <Col span={12}>
            <Statistic
              title={<span style={{ color: 'white' }}>This Week's Earnings</span>}
              value={stats.weekEarnings}
              precision={2}
              prefix="$"
              valueStyle={{ color: 'white' }}
            />
          </Col>
        </Row>
      </Card>

      {/* Today's Bookings */}
      <Card title="Today's Bookings">
        {todayBookings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px', color: '#999' }}>
            <CalendarOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
            <div>No bookings scheduled for today</div>
          </div>
        ) : (
          <List
            dataSource={todayBookings}
            renderItem={(booking) => (
              <List.Item
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/booking/${booking.id}`)}
              >
                <List.Item.Meta
                  avatar={<UserOutlined style={{ fontSize: '24px', color: '#007e8c' }} />}
                  title={
                    <Space>
                      <Text strong>{booking.customer_name}</Text>
                      <Tag color={getStatusColor(booking.client_update_status || booking.status)}>
                        {getStatusLabel(booking.client_update_status || booking.status)}
                      </Tag>
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size="small">
                      <Text>{booking.service_name}</Text>
                      <Space>
                        <ClockCircleOutlined />
                        <Text>{dayjs(booking.booking_time).format('h:mm A')}</Text>
                        <EnvironmentOutlined />
                        <Text>{booking.address?.split(',')[0] || 'No address'}</Text>
                      </Space>
                    </Space>
                  }
                />
                <div>
                  <Text strong style={{ color: '#52c41a' }}>
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
