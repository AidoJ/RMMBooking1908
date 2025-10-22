import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Button, Typography, Space, message, Select } from 'antd';
import { EyeOutlined, EnvironmentOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { supabaseClient } from '../utility/supabaseClient';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

export const Bookings: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    loadBookings();
  }, [statusFilter]);

  const loadBookings = async () => {
    try {
      setLoading(true);

      // Get user data from localStorage
      const userStr = localStorage.getItem('therapistUser');
      if (!userStr) {
        message.error('Please log in again');
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

      // Build query
      let query = supabaseClient
        .from('bookings')
        .select(`
          *,
          services(name)
        `)
        .eq('therapist_id', profile.id)
        .order('booking_time', { ascending: false });

      // Apply status filter
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Bookings error:', error);
        message.error('Failed to load bookings');
        return;
      }

      // Process bookings data
      const bookingsData = (data || []).map((b: any) => ({
        ...b,
        customer_name: b.booker_name || `${b.first_name || ''} ${b.last_name || ''}`.trim() || 'Guest',
        service_name: b.services?.name || 'Unknown Service',
      }));

      setBookings(bookingsData);
    } catch (error) {
      console.error('Error loading bookings:', error);
      message.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      requested: 'orange',
      pending: 'orange',
      confirmed: 'blue',
      completed: 'green',
      cancelled: 'red',
      declined: 'red',
    };
    return colors[status] || 'default';
  };

  const columns = [
    {
      title: 'Booking ID',
      dataIndex: 'id',
      key: 'id',
      render: (id: string) => (
        <Text strong style={{ fontFamily: 'monospace', fontSize: '12px' }}>
          {id.substring(0, 8)}
        </Text>
      ),
      width: 100,
    },
    {
      title: 'Date & Time',
      dataIndex: 'booking_time',
      key: 'booking_time',
      render: (date: string) => (
        <Space direction="vertical" size={0}>
          <Text strong>{dayjs(date).format('MMM DD, YYYY')}</Text>
          <Text type="secondary">{dayjs(date).format('h:mm A')}</Text>
        </Space>
      ),
      sorter: (a: any, b: any) => dayjs(a.booking_time).unix() - dayjs(b.booking_time).unix(),
    },
    {
      title: 'Customer',
      dataIndex: 'customer_name',
      key: 'customer_name',
      render: (name: string) => <Text>{name}</Text>,
    },
    {
      title: 'Service',
      dataIndex: 'service_name',
      key: 'service_name',
    },
    {
      title: 'Location',
      dataIndex: 'address',
      key: 'address',
      render: (address: string) => (
        <Space size="small">
          <EnvironmentOutlined />
          <Text ellipsis style={{ maxWidth: 200 }}>
            {address?.split(',')[0] || 'No address'}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Duration',
      dataIndex: 'duration_minutes',
      key: 'duration_minutes',
      render: (minutes: number) => (
        <Space size="small">
          <ClockCircleOutlined />
          <Text>{minutes || 60} min</Text>
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>
          {status.toUpperCase()}
        </Tag>
      ),
      filters: [
        { text: 'Requested', value: 'requested' },
        { text: 'Pending', value: 'pending' },
        { text: 'Confirmed', value: 'confirmed' },
        { text: 'Completed', value: 'completed' },
        { text: 'Cancelled', value: 'cancelled' },
        { text: 'Declined', value: 'declined' },
      ],
      onFilter: (value: any, record: any) => record.status === value,
    },
    {
      title: 'Fee',
      dataIndex: 'therapist_fee',
      key: 'therapist_fee',
      render: (fee: number) => (
        <Text strong style={{ color: '#52c41a' }}>
          ${parseFloat(fee?.toString() || '0').toFixed(2)}
        </Text>
      ),
      sorter: (a: any, b: any) => (a.therapist_fee || 0) - (b.therapist_fee || 0),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Button
          type="primary"
          icon={<EyeOutlined />}
          onClick={() => navigate(`/booking/${record.id}`)}
          size="small"
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>
          My Bookings
        </Title>
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          style={{ width: 150 }}
          size="large"
        >
          <Option value="all">All Statuses</Option>
          <Option value="confirmed">Confirmed</Option>
          <Option value="completed">Completed</Option>
          <Option value="requested">Requested</Option>
           <Option value="pending">Pending</Option>
          <Option value="cancelled">Cancelled</Option>
        </Select>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={bookings}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 20,
            showTotal: (total) => `Total ${total} bookings`,
          }}
          scroll={{ x: 1000 }}
        />
      </Card>
    </div>
  );
};
