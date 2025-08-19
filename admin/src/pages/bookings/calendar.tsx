import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Select,
  Button,
  Space,
  Typography,
  Tag,
  Avatar,
  Drawer,
  Form,
  Input,
  DatePicker,
  TimePicker,
  Modal,
  message,
  Tooltip,
  Switch,
  Divider,
  Badge,
} from 'antd';
import {
  CalendarOutlined,
  PlusOutlined,
  UserOutlined,
  EnvironmentOutlined,
  PhoneOutlined,
  DollarOutlined,
  ClockCircleOutlined,
  FilterOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useGetIdentity } from '@refinedev/core';
import { supabaseClient } from '../../utility';
import { UserIdentity, canAccess, isTherapist, isAdmin } from '../../utils/roleUtils';
import { RoleGuard } from '../../components/RoleGuard';
import dayjs, { Dayjs } from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

// Interfaces
interface Therapist {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  is_active: boolean;
  profile_pic?: string;
}

interface BookingEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  status: string;
  therapist_id: string;
  customer_name: string;
  service_name: string;
  price: number;
  address: string;
  phone?: string;
  notes?: string;
  backgroundColor: string;
  borderColor: string;
}

interface CalendarDay {
  date: Dayjs;
  bookings: BookingEvent[];
  isToday: boolean;
  isSelected: boolean;
}

export const CalendarBookingManagement: React.FC = () => {
  const { data: identity } = useGetIdentity<UserIdentity>();
  const [loading, setLoading] = useState(true);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [selectedTherapistId, setSelectedTherapistId] = useState<string>('all');
  const [currentDate, setCurrentDate] = useState(dayjs());
  const [calendarView, setCalendarView] = useState<'week' | 'day'>('week');
  const [bookings, setBookings] = useState<BookingEvent[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<BookingEvent | null>(null);
  const [showBookingDrawer, setShowBookingDrawer] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  const userRole = identity?.role;

  useEffect(() => {
    if (identity) {
      initializeData();
    }
  }, [identity]);

  useEffect(() => {
    if (therapists.length > 0) {
      fetchBookings();
    }
  }, [selectedTherapistId, currentDate, therapists]);

  const initializeData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchTherapists(),
      ]);
    } catch (error) {
      console.error('Error initializing calendar data:', error);
      message.error('Failed to load calendar data');
    } finally {
      setLoading(false);
    }
  };

  const fetchTherapists = async () => {
    try {
      let query = supabaseClient
        .from('therapist_profiles')
        .select('*')
        .eq('is_active', true);

      // If therapist, only get their own profile
      if (isTherapist(userRole) && identity?.id) {
        query = query.eq('user_id', identity.id);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      
      setTherapists(data || []);
      
      // Auto-select therapist if they're logged in as therapist
      if (isTherapist(userRole) && data && data.length > 0) {
        setSelectedTherapistId(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching therapists:', error);
    }
  };

  const fetchBookings = async () => {
    try {
      const startOfWeek = currentDate.startOf('week');
      const endOfWeek = currentDate.endOf('week');
      
      let query = supabaseClient
        .from('bookings')
        .select(`
          *,
          therapist_profiles!bookings_therapist_id_fkey(first_name, last_name),
          customers(first_name, last_name, phone),
          services(name)
        `)
        .gte('booking_time', startOfWeek.toISOString())
        .lte('booking_time', endOfWeek.toISOString());

      // Filter by therapist if selected
      if (selectedTherapistId !== 'all') {
        query = query.eq('therapist_id', selectedTherapistId);
      }

      const { data, error } = await query;
      
      if (error) throw error;

      // Transform bookings into calendar events
      const events: BookingEvent[] = (data || []).map(booking => {
        const startTime = dayjs(booking.booking_time);
        const duration = booking.duration_minutes || 60;
        const endTime = startTime.add(duration, 'minute');
        
        const customerName = booking.customers 
          ? `${booking.customers.first_name} ${booking.customers.last_name}`
          : booking.booker_name || `${booking.first_name || ''} ${booking.last_name || ''}`.trim() || 'Unknown Customer';

        return {
          id: booking.id,
          title: `${customerName} - ${booking.services?.name || 'Service'}`,
          start: startTime.toISOString(),
          end: endTime.toISOString(),
          status: booking.status,
          therapist_id: booking.therapist_id,
          customer_name: customerName,
          service_name: booking.services?.name || 'Unknown Service',
          price: parseFloat(booking.price) || 0,
          address: booking.address || '',
          phone: booking.customers?.phone || booking.customer_phone || '',
          notes: booking.notes || '',
          backgroundColor: getStatusColor(booking.status),
          borderColor: getStatusColor(booking.status),
        };
      });

      setBookings(events);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      message.error('Failed to load bookings');
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed': return '#52c41a';
      case 'confirmed': return '#1890ff';
      case 'requested': return '#fa8c16';
      case 'cancelled': return '#ff4d4f';
      case 'declined': return '#ff4d4f';
      default: return '#d9d9d9';
    }
  };

  const getStatusTag = (status: string) => {
    const colors = {
      completed: 'green',
      confirmed: 'blue',
      requested: 'orange',
      cancelled: 'red',
      declined: 'red',
    };
    
    return (
      <Tag color={colors[status as keyof typeof colors] || 'default'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Tag>
    );
  };

  const generateWeekDays = (): CalendarDay[] => {
    const startOfWeek = currentDate.startOf('week');
    const days: CalendarDay[] = [];
    
    for (let i = 0; i < 7; i++) {
      const date = startOfWeek.add(i, 'day');
      const dayBookings = bookings.filter(booking => 
        dayjs(booking.start).isSame(date, 'day')
      );
      
      days.push({
        date,
        bookings: dayBookings,
        isToday: date.isSame(dayjs(), 'day'),
        isSelected: date.isSame(currentDate, 'day'),
      });
    }
    
    return days;
  };

  const handleBookingClick = (booking: BookingEvent) => {
    setSelectedBooking(booking);
    setShowBookingDrawer(true);
  };

  const handlePrevWeek = () => {
    setCurrentDate(currentDate.subtract(1, 'week'));
  };

  const handleNextWeek = () => {
    setCurrentDate(currentDate.add(1, 'week'));
  };

  const handleToday = () => {
    setCurrentDate(dayjs());
  };

  const weekDays = generateWeekDays();

  return (
    <RoleGuard requiredPermission="canViewBookingCalendar">
      <div style={{ padding: 24 }}>
        {/* Header */}
        <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
          <Col>
            <Title level={2} style={{ margin: 0 }}>
              {isTherapist(userRole) ? 'My Schedule' : 'Booking Calendar'}
            </Title>
            <Text type="secondary">
              {isTherapist(userRole) 
                ? 'Manage your appointments and availability'
                : 'View and manage all therapist bookings'
              }
            </Text>
          </Col>
          <Col>
            <Space>
              {canAccess(userRole, 'canCreateBookings') && (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setShowCreateModal(true)}
                >
                  New Booking
                </Button>
              )}
            </Space>
          </Col>
        </Row>

        {/* Controls */}
        <Card style={{ marginBottom: 24 }}>
          <Row gutter={16} align="middle">
            <Col>
              <Space>
                <Button onClick={handlePrevWeek}>← Previous</Button>
                <Button onClick={handleToday}>Today</Button>
                <Button onClick={handleNextWeek}>Next →</Button>
              </Space>
            </Col>
            <Col>
              <Title level={4} style={{ margin: 0 }}>
                {currentDate.format('MMMM YYYY')}
              </Title>
            </Col>
            <Col flex="auto" />
            {canAccess(userRole, 'canViewAllTherapists') && (
              <Col>
                <Space>
                  <Text>Therapist:</Text>
                  <Select
                    value={selectedTherapistId}
                    onChange={setSelectedTherapistId}
                    style={{ width: 200 }}
                  >
                    <Option value="all">All Therapists</Option>
                    {therapists.map(therapist => (
                      <Option key={therapist.id} value={therapist.id}>
                        {therapist.first_name} {therapist.last_name}
                      </Option>
                    ))}
                  </Select>
                </Space>
              </Col>
            )}
          </Row>
        </Card>

        {/* Calendar Grid */}
        <Card>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, backgroundColor: '#f0f0f0' }}>
            {/* Day Headers */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div
                key={day}
                style={{
                  padding: '12px 8px',
                  backgroundColor: '#fafafa',
                  textAlign: 'center',
                  fontWeight: 'bold',
                  borderBottom: '2px solid #e8e8e8'
                }}
              >
                {day}
              </div>
            ))}
            
            {/* Calendar Days */}
            {weekDays.map(day => (
              <div
                key={day.date.format('YYYY-MM-DD')}
                style={{
                  minHeight: 400,
                  backgroundColor: day.isToday ? '#e6f7ff' : '#fff',
                  border: day.isSelected ? '2px solid #1890ff' : '1px solid #e8e8e8',
                  padding: 8,
                  position: 'relative',
                }}
              >
                {/* Date Header */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: 8,
                  paddingBottom: 4,
                  borderBottom: '1px solid #f0f0f0'
                }}>
                  <Text strong={day.isToday}>
                    {day.date.format('D')}
                  </Text>
                  {day.bookings.length > 0 && (
                    <Badge count={day.bookings.length} size="small" />
                  )}
                </div>
                
                {/* Bookings */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {day.bookings.map(booking => (
                    <Tooltip
                      key={booking.id}
                      title={`${booking.customer_name} - ${booking.service_name} at ${dayjs(booking.start).format('h:mm A')}`}
                    >
                      <div
                        onClick={() => handleBookingClick(booking)}
                        style={{
                          backgroundColor: booking.backgroundColor,
                          color: 'white',
                          padding: '4px 6px',
                          borderRadius: 4,
                          fontSize: '11px',
                          cursor: 'pointer',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          opacity: booking.status === 'cancelled' ? 0.6 : 1,
                        }}
                      >
                        <div style={{ fontWeight: 'bold' }}>
                          {dayjs(booking.start).format('h:mm A')}
                        </div>
                        <div>{booking.customer_name}</div>
                      </div>
                    </Tooltip>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Booking Details Drawer */}
        <Drawer
          title="Booking Details"
          placement="right"
          width={400}
          open={showBookingDrawer}
          onClose={() => setShowBookingDrawer(false)}
         extra={
  <Space>
    {(canAccess(userRole, 'canEditAllBookings') || canAccess(userRole, 'canEditOwnBookings')) && (
      <Button 
        type="primary"
        onClick={() => window.open(`/bookings/edit/${selectedBooking?.id}`, '_self')}
      >
        Edit
      </Button>
    )}
              {canAccess(userRole, 'canDeleteBookings') && (
                <Button danger>Cancel</Button>
              )}
            </Space>
          }
        >
          {selectedBooking && (
            <div>
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                {/* Status */}
                <div>
                  <Text strong>Status:</Text>
                  <div style={{ marginTop: 4 }}>
                    {getStatusTag(selectedBooking.status)}
                  </div>
                </div>

                {/* Customer Info */}
                <div>
                  <Text strong>Customer:</Text>
                  <div style={{ marginTop: 4 }}>
                    <Space direction="vertical" size="small">
                      <div>
                        <UserOutlined style={{ marginRight: 8 }} />
                        {selectedBooking.customer_name}
                      </div>
                      {selectedBooking.phone && (
                        <div>
                          <PhoneOutlined style={{ marginRight: 8 }} />
                          {selectedBooking.phone}
                        </div>
                      )}
                    </Space>
                  </div>
                </div>

                {/* Appointment Details */}
                <div>
                  <Text strong>Appointment:</Text>
                  <div style={{ marginTop: 4 }}>
                    <Space direction="vertical" size="small">
                      <div>
                        <CalendarOutlined style={{ marginRight: 8 }} />
                        {dayjs(selectedBooking.start).format('dddd, MMMM D, YYYY')}
                      </div>
                      <div>
                        <ClockCircleOutlined style={{ marginRight: 8 }} />
                        {dayjs(selectedBooking.start).format('h:mm A')} - {dayjs(selectedBooking.end).format('h:mm A')}
                      </div>
                      <div>
                        <DollarOutlined style={{ marginRight: 8 }} />
                        ${selectedBooking.price.toFixed(2)}
                      </div>
                    </Space>
                  </div>
                </div>

                {/* Service */}
                <div>
                  <Text strong>Service:</Text>
                  <div style={{ marginTop: 4 }}>
                    {selectedBooking.service_name}
                  </div>
                </div>

                {/* Location */}
                {selectedBooking.address && (
                  <div>
                    <Text strong>Location:</Text>
                    <div style={{ marginTop: 4 }}>
                      <EnvironmentOutlined style={{ marginRight: 8 }} />
                      {selectedBooking.address}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {selectedBooking.notes && (
                  <div>
                    <Text strong>Notes:</Text>
                    <div style={{ marginTop: 4 }}>
                      {selectedBooking.notes}
                    </div>
                  </div>
                )}
              </Space>
            </div>
          )}
        </Drawer>

        {/* Create Booking Modal */}
        <Modal
          title="Create New Booking"
          open={showCreateModal}
          onCancel={() => setShowCreateModal(false)}
          footer={null}
          width={600}
        >
          <Text>New booking form will go here...</Text>
        </Modal>
      </div>
    </RoleGuard>
  );
};
