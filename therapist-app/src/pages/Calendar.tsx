import React, { useState, useEffect } from 'react';
import { Calendar as AntCalendar, Badge, Card, Typography, List, Space, Tag, message, Spin, Empty } from 'antd';
import { ClockCircleOutlined, EnvironmentOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { supabaseClient } from '../utility/supabaseClient';
import dayjs, { Dayjs } from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';

const { Title, Text } = Typography;

dayjs.extend(isoWeek);

interface Booking {
  id: string;
  booking_time: string;
  status: string;
  customer_name: string;
  service_name: string;
  address: string;
  therapist_fee: number;
}

export const Calendar: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs());

  useEffect(() => {
    loadBookings();
  }, []);

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

      // Get bookings for current month (we'll filter by selected date in UI)
      const monthStart = dayjs().startOf('month').subtract(7, 'days').toISOString();
      const monthEnd = dayjs().endOf('month').add(7, 'days').toISOString();

      const { data, error } = await supabaseClient
        .from('bookings')
        .select(`
          id,
          booking_time,
          status,
          address,
          therapist_fee,
          booker_name,
          first_name,
          last_name,
          services(name)
        `)
        .eq('therapist_id', profile.id)
        .gte('booking_time', monthStart)
        .lte('booking_time', monthEnd)
        .order('booking_time');

      if (error) {
        console.error('Bookings error:', error);
        message.error('Failed to load bookings');
        return;
      }

      // Process bookings data
      const bookingsData = (data || []).map((b: any) => ({
        id: b.id,
        booking_time: b.booking_time,
        status: b.status,
        customer_name: b.booker_name || `${b.first_name || ''} ${b.last_name || ''}`.trim() || 'Guest',
        service_name: b.services?.name || 'Unknown Service',
        address: b.address,
        therapist_fee: b.therapist_fee || 0,
      }));

      setBookings(bookingsData);
    } catch (error) {
      console.error('Error loading bookings:', error);
      message.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  const getBookingsForDate = (date: Dayjs) => {
    return bookings.filter((booking) =>
      dayjs(booking.booking_time).isSame(date, 'day')
    );
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

  const getStatusBadge = (status: string) => {
    const statusMap: { [key: string]: 'success' | 'processing' | 'default' | 'error' | 'warning' } = {
      completed: 'success',
      confirmed: 'processing',
      requested: 'warning',
      pending: 'warning',
      cancelled: 'error',
      declined: 'error',
    };
    return statusMap[status] || 'default';
  };

  const dateCellRender = (date: Dayjs) => {
    const dayBookings = getBookingsForDate(date);

    if (dayBookings.length === 0) return null;

    return (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {dayBookings.slice(0, 3).map((booking) => (
          <li key={booking.id} style={{ marginBottom: 2 }}>
            <Badge
              status={getStatusBadge(booking.status)}
              text={
                <Text
                  style={{
                    fontSize: '12px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: 'block',
                    maxWidth: '100px',
                  }}
                  onClick={() => navigate(`/booking/${booking.id}`)}
                >
                  {dayjs(booking.booking_time).format('h:mm A')} - {booking.customer_name}
                </Text>
              }
            />
          </li>
        ))}
        {dayBookings.length > 3 && (
          <li>
            <Text type="secondary" style={{ fontSize: '11px' }}>
              +{dayBookings.length - 3} more
            </Text>
          </li>
        )}
      </ul>
    );
  };

  const onDateSelect = (date: Dayjs) => {
    setSelectedDate(date);
  };

  const selectedDateBookings = getBookingsForDate(selectedDate);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <Title level={2} style={{ marginBottom: 24 }}>
        My Schedule
      </Title>

      <Card style={{ marginBottom: 24 }}>
        <AntCalendar
          onSelect={onDateSelect}
          cellRender={dateCellRender}
        />
      </Card>

      <Card
        title={
          <Space>
            <Text strong>Bookings for {selectedDate.format('MMMM DD, YYYY')}</Text>
            {selectedDateBookings.length > 0 && (
              <Tag color="blue">{selectedDateBookings.length} booking{selectedDateBookings.length !== 1 ? 's' : ''}</Tag>
            )}
          </Space>
        }
      >
        {selectedDateBookings.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No bookings on this day"
          />
        ) : (
          <List
            dataSource={selectedDateBookings}
            renderItem={(booking) => (
              <List.Item
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/booking/${booking.id}`)}
              >
                <List.Item.Meta
                  avatar={
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        background: '#007e8c',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                      }}
                    >
                      <UserOutlined style={{ fontSize: 20 }} />
                    </div>
                  }
                  title={
                    <Space>
                      <Text strong>{booking.customer_name}</Text>
                      <Tag color={getStatusColor(booking.status)}>
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
    </div>
  );
};
