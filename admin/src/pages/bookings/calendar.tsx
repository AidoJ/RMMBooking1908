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
import { useGetIdentity, useNavigation } from '@refinedev/core';
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
  therapist_name?: string;
  customer_name: string;
  service_name: string;
  price: number;
  therapist_fee?: number;
  address: string;
  business_name?: string;
  room_number?: string;
  phone?: string;
  notes?: string;
  backgroundColor: string;
  borderColor: string;
  duration_minutes: number;
  startTime: dayjs.Dayjs;
  endTime: dayjs.Dayjs;
}

interface CalendarDay {
  date: Dayjs;
  bookings: BookingEvent[];
  isToday: boolean;
  isSelected: boolean;
}

export const CalendarBookingManagement: React.FC = () => {
  const { data: identity } = useGetIdentity<UserIdentity>();
  const { edit } = useNavigation();
  const [loading, setLoading] = useState(true);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [selectedTherapistId, setSelectedTherapistId] = useState<string>('all');
  const [currentDate, setCurrentDate] = useState(dayjs());
  const [calendarView, setCalendarView] = useState<'week' | 'day' | 'schedule' | 'month'>('schedule');
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
  }, [selectedTherapistId, currentDate, therapists, calendarView]);

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
      let startDate, endDate;

      if (calendarView === 'week') {
        startDate = dayjs(currentDate).startOf('week');
        endDate = dayjs(currentDate).endOf('week');
      } else if (calendarView === 'month') {
        // For month view, use PADDED grid range (first Sunday to last Saturday)
        const monthStart = dayjs(currentDate).startOf('month');
        const monthEnd = dayjs(currentDate).endOf('month');
        startDate = dayjs(monthStart).startOf('week');
        endDate = dayjs(monthEnd).endOf('week');
      } else {
        // For schedule and day views, fetch current day and surrounding days for context
        startDate = dayjs(currentDate).subtract(1, 'day').startOf('day');
        endDate = dayjs(currentDate).add(1, 'day').endOf('day');
      }

      // Fetch bookings where EITHER the parent booking OR any occurrence falls in date range
      // We need to fetch a wider range and filter client-side because Supabase doesn't support
      // OR conditions across parent and child tables easily
      let query = supabaseClient
        .from('bookings')
        .select(`
          *,
          therapist_profiles!bookings_therapist_id_fkey(first_name, last_name),
          customers(first_name, last_name, phone),
          services(name),
          booking_occurrences(*)
        `)
        // Fetch all bookings - we'll filter by occurrence dates client-side
        .gte('booking_time', dayjs(startDate).subtract(6, 'month').toISOString()) // Fetch wider range
        .lte('booking_time', dayjs(endDate).add(6, 'month').toISOString());

      // Role-based filtering
      if (isTherapist(userRole) && identity?.id) {
        // Therapists only see their own bookings
        query = query.eq('therapist_id', identity.id);
      } else if (selectedTherapistId !== 'all') {
        // Admins can filter by specific therapist
        query = query.eq('therapist_id', selectedTherapistId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Transform bookings into calendar events
      const events: BookingEvent[] = [];

      (data || []).forEach(booking => {
        const customerName = booking.customers
          ? `${booking.customers.first_name} ${booking.customers.last_name}`
          : booking.booker_name || `${booking.first_name || ''} ${booking.last_name || ''}`.trim() || 'Unknown Customer';

        const therapistName = booking.therapist_profiles
          ? `${booking.therapist_profiles.first_name} ${booking.therapist_profiles.last_name}`
          : 'Unassigned';

        const duration = booking.duration_minutes || 60;
        const isRecurring = booking.booking_occurrences && booking.booking_occurrences.length > 0;

        // For recurring bookings, ONLY show occurrences (not parent booking)
        if (isRecurring) {
          // Add "Initial booking" event from parent booking date
          const initialStartTime = dayjs(booking.booking_time);
          const initialEndTime = initialStartTime.add(duration, 'minute');

          events.push({
            id: booking.id, // Use parent ID so clicking works
            title: `${customerName} - ${booking.services?.name || 'Service'} (Initial)`,
            start: initialStartTime.toISOString(),
            end: initialEndTime.toISOString(),
            status: booking.status,
            therapist_id: booking.therapist_id,
            therapist_name: therapistName,
            customer_name: customerName,
            service_name: booking.services?.name || 'Unknown Service',
            price: parseFloat(booking.price) || 0,
            therapist_fee: parseFloat(booking.therapist_fee) || 0,
            address: booking.address || '',
            business_name: booking.business_name || '',
            room_number: booking.room_number || '',
            phone: booking.customers?.phone || booking.customer_phone || '',
            notes: booking.notes || '',
            backgroundColor: getTherapistColor(booking.therapist_id),
            borderColor: getTherapistColor(booking.therapist_id),
            duration_minutes: duration,
            startTime: initialStartTime,
            endTime: initialEndTime,
          });

          // Add repeat events from occurrences
          booking.booking_occurrences.forEach((occurrence: any) => {
            const occStartTime = dayjs(`${occurrence.occurrence_date}T${occurrence.occurrence_time}`);
            const occEndTime = occStartTime.add(duration, 'minute');

            events.push({
              id: booking.id, // Use parent ID so clicking navigates to booking details
              title: `${customerName} - ${booking.services?.name || 'Service'} (Repeat ${occurrence.occurrence_number})`,
              start: occStartTime.toISOString(),
              end: occEndTime.toISOString(),
              status: booking.status,
              therapist_id: booking.therapist_id,
              therapist_name: therapistName,
              customer_name: customerName,
              service_name: booking.services?.name || 'Unknown Service',
              price: parseFloat(booking.price) || 0,
              therapist_fee: parseFloat(booking.therapist_fee) || 0,
              address: booking.address || '',
              business_name: booking.business_name || '',
              room_number: booking.room_number || '',
              phone: booking.customers?.phone || booking.customer_phone || '',
              notes: booking.notes || '',
              backgroundColor: getTherapistColor(booking.therapist_id),
              borderColor: getTherapistColor(booking.therapist_id),
              duration_minutes: duration,
              startTime: occStartTime,
              endTime: occEndTime,
            });
          });
        } else {
          // Non-recurring booking - show normally
          const startTime = dayjs(booking.booking_time);
          const endTime = startTime.add(duration, 'minute');

          events.push({
            id: booking.id,
            title: `${customerName} - ${booking.services?.name || 'Service'}`,
            start: startTime.toISOString(),
            end: endTime.toISOString(),
            status: booking.status,
            therapist_id: booking.therapist_id,
            therapist_name: therapistName,
            customer_name: customerName,
            service_name: booking.services?.name || 'Unknown Service',
            price: parseFloat(booking.price) || 0,
            therapist_fee: parseFloat(booking.therapist_fee) || 0,
            address: booking.address || '',
            business_name: booking.business_name || '',
            room_number: booking.room_number || '',
            phone: booking.customers?.phone || booking.customer_phone || '',
            notes: booking.notes || '',
            backgroundColor: getTherapistColor(booking.therapist_id),
            borderColor: getTherapistColor(booking.therapist_id),
            duration_minutes: duration,
            startTime: startTime,
            endTime: endTime,
          });
        }
      });

      // Filter events to only those within the current view's date range
      const filteredEvents = events.filter(event => {
        const eventDate = dayjs(event.start);
        return eventDate.isSameOrAfter(startDate, 'day') && eventDate.isSameOrBefore(endDate, 'day');
      });

      setBookings(filteredEvents);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      message.error('Failed to load bookings');
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed': return '#007e8c';       // Teal
      case 'confirmed': return '#B75DD9';       // Purple
      case 'requested': return '#ff7900';       // Orange (pending)
      case 'cancelled': return '#c02000';       // Red
      case 'declined': return '#c02000';        // Red
      default: return '#e0e0e0';                // Light gray
    }
  };

  const getTherapistColor = (therapistId: string): string => {
    // Predefined color palette for therapists
    const therapistColors = [
      '#1890ff', // Blue
      '#52c41a', // Green
      '#fa8c16', // Orange
      '#eb2f96', // Magenta
      '#722ed1', // Purple
      '#13c2c2', // Cyan
      '#f5222d', // Red
      '#a0d911', // Lime
      '#fa541c', // Volcano
      '#2f54eb', // Geek Blue
      '#b37feb', // Purple Light
      '#40a9ff', // Blue Light
    ];

    // Create a simple hash of the therapist ID to get consistent color assignment
    let hash = 0;
    for (let i = 0; i < therapistId.length; i++) {
      const char = therapistId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    const colorIndex = Math.abs(hash) % therapistColors.length;
    return therapistColors[colorIndex];
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
    const days: CalendarDay[] = [];

    if (calendarView === 'month') {
      // Generate full month grid (including padding days from prev/next month)
      const startOfMonth = dayjs(currentDate).startOf('month');
      const endOfMonth = dayjs(currentDate).endOf('month');
      const startDate = dayjs(startOfMonth).startOf('week'); // Start from Sunday of first week
      const endDate = dayjs(endOfMonth).endOf('week'); // End on Saturday of last week

      let currentDay = dayjs(startDate);
      while (currentDay.isSameOrBefore(endDate)) {
        const dayBookings = bookings.filter(booking =>
          dayjs(booking.start).isSame(currentDay, 'day')
        );

        days.push({
          date: currentDay,
          bookings: dayBookings,
          isToday: currentDay.isSame(dayjs(), 'day'),
          isSelected: currentDay.isSame(currentDate, 'day'),
        });

        currentDay = currentDay.add(1, 'day');
      }
    } else {
      // Week view - generate 7 days
      const startOfWeek = dayjs(currentDate).startOf('week');

      for (let i = 0; i < 7; i++) {
        const date = dayjs(startOfWeek).add(i, 'day');
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
    }

    return days;
  };

  const handleBookingClick = (booking: BookingEvent) => {
    setSelectedBooking(booking);
    setShowBookingDrawer(true);
  };

  const handlePrev = () => {
    if (calendarView === 'week') {
      setCurrentDate(dayjs(currentDate).subtract(1, 'week'));
    } else if (calendarView === 'month') {
      setCurrentDate(dayjs(currentDate).subtract(1, 'month'));
    } else {
      // For schedule and day views, move by day
      setCurrentDate(dayjs(currentDate).subtract(1, 'day'));
    }
  };

  const handleNext = () => {
    if (calendarView === 'week') {
      setCurrentDate(dayjs(currentDate).add(1, 'week'));
    } else if (calendarView === 'month') {
      setCurrentDate(dayjs(currentDate).add(1, 'month'));
    } else {
      // For schedule and day views, move by day
      setCurrentDate(dayjs(currentDate).add(1, 'day'));
    }
  };

  const handleToday = () => {
    setCurrentDate(dayjs());
  };

  const weekDays = generateWeekDays();

  // Generate time slots for schedule view (8 AM to 8 PM in 30-minute intervals)
  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 8; hour <= 20; hour++) {
      slots.push(`${hour}:00`);
      if (hour < 20) {
        slots.push(`${hour}:30`);
      }
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  const renderScheduleView = () => {
    const today = currentDate;
    const dayBookings = bookings.filter(booking =>
      dayjs(booking.start).isSame(today, 'day')
    );

    return (
      <div style={{ display: 'flex', height: '600px', overflow: 'auto' }}>
        {/* Time column */}
        <div style={{ width: '80px', borderRight: '1px solid #e8e8e8' }}>
          <div style={{ height: '40px', borderBottom: '1px solid #e8e8e8' }}></div>
          {timeSlots.map(time => (
            <div
              key={time}
              style={{
                height: '30px',
                padding: '5px',
                fontSize: '12px',
                borderBottom: '1px solid #f0f0f0',
                textAlign: 'right',
                paddingRight: '8px',
                color: '#666'
              }}
            >
              {time.endsWith(':00') ? dayjs(`2023-01-01 ${time}`).format('h A') : ''}
            </div>
          ))}
        </div>

        {/* Schedule column */}
        <div style={{ flex: 1, position: 'relative' }}>
          {/* Date header */}
          <div style={{
            height: '40px',
            borderBottom: '2px solid #e8e8e8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            backgroundColor: today.isSame(dayjs(), 'day') ? '#e6f7ff' : '#fafafa'
          }}>
            {today.format('dddd, MMMM D')}
          </div>

          {/* Time grid */}
          <div style={{ position: 'relative' }}>
            {timeSlots.map((time, index) => (
              <div
                key={time}
                style={{
                  height: '30px',
                  borderBottom: time.endsWith(':00') ? '1px solid #e8e8e8' : '1px solid #f5f5f5',
                  backgroundColor: time.endsWith(':00') ? '#fafafa' : 'transparent'
                }}
              />
            ))}

            {/* Bookings overlay */}
            {dayBookings.map((booking, bookingIndex) => {
              const startTime = dayjs(booking.start);
              const endTime = dayjs(booking.end);

              // Calculate position
              const startHour = startTime.hour();
              const startMinute = startTime.minute();
              const duration = endTime.diff(startTime, 'minute');

              // Skip bookings outside our time range
              if (startHour < 8 || startHour >= 21) return null;

              const startPosition = ((startHour - 8) * 60 + startMinute) / 30 * 30; // 30px per 30min slot
              const height = (duration / 30) * 30; // 30px per 30min

              // Find overlapping bookings to calculate horizontal positioning
              const overlappingBookings = dayBookings.filter(otherBooking => {
                const otherStart = dayjs(otherBooking.start);
                const otherEnd = dayjs(otherBooking.end);
                return (
                  (startTime.isBefore(otherEnd) && endTime.isAfter(otherStart)) ||
                  (startTime.isSame(otherStart) && endTime.isSame(otherEnd))
                );
              });

              const overlapIndex = overlappingBookings.findIndex(b => b.id === booking.id);
              const totalOverlapping = overlappingBookings.length;

              // Calculate width and left position for side-by-side display
              const columnWidth = totalOverlapping > 1 ? `calc((100% - 8px) / ${totalOverlapping})` : 'calc(100% - 8px)';
              const leftOffset = totalOverlapping > 1 ? `calc(4px + ((100% - 8px) / ${totalOverlapping}) * ${overlapIndex})` : '4px';

              return (
                <div
                  key={booking.id}
                  onClick={() => handleBookingClick(booking)}
                  style={{
                    position: 'absolute',
                    top: `${startPosition}px`,
                    left: leftOffset,
                    width: columnWidth,
                    height: `${height}px`,
                    backgroundColor: booking.backgroundColor,
                    color: 'white',
                    padding: '4px 6px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    border: `2px solid ${booking.borderColor}`,
                    overflow: 'hidden',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    opacity: booking.status === 'cancelled' ? 0.6 : 1,
                    zIndex: 10
                  }}
                  title={`${booking.therapist_name} - ${booking.service_name}`}
                >
                  <div style={{ fontWeight: 'bold', marginBottom: '2px', fontSize: '10px' }}>
                    {startTime.format('h:mm A')}
                  </div>
                  <div style={{ fontSize: '10px' }}>
                    {booking.therapist_name}
                  </div>
                  <div style={{ fontSize: '9px', opacity: 0.9 }}>
                    {booking.service_name}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    return (
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
                  title={`${booking.therapist_name} - ${booking.service_name} at ${dayjs(booking.start).format('h:mm A')}`}
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
                    <div>{booking.therapist_name}</div>
                  </div>
                </Tooltip>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderMonthView = () => {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, backgroundColor: '#f0f0f0' }}>
        {/* Day Headers */}
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div
            key={day}
            style={{
              padding: '8px',
              backgroundColor: '#fafafa',
              textAlign: 'center',
              fontWeight: 'bold',
              borderBottom: '2px solid #e8e8e8',
              fontSize: '12px'
            }}
          >
            {day}
          </div>
        ))}

        {/* Calendar Days */}
        {weekDays.map(day => {
          const isCurrentMonth = day.date.month() === currentDate.month();

          return (
            <div
              key={day.date.format('YYYY-MM-DD')}
              style={{
                minHeight: 120,
                backgroundColor: day.isToday ? '#e6f7ff' : (isCurrentMonth ? '#fff' : '#fafafa'),
                border: day.isSelected ? '2px solid #1890ff' : '1px solid #e8e8e8',
                padding: 6,
                position: 'relative',
                opacity: isCurrentMonth ? 1 : 0.6,
              }}
            >
              {/* Date Header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 4,
                paddingBottom: 2,
                borderBottom: '1px solid #f0f0f0'
              }}>
                <Text strong={day.isToday} style={{ fontSize: '13px' }}>
                  {day.date.format('D')}
                </Text>
                {day.bookings.length > 0 && (
                  <Badge count={day.bookings.length} size="small" />
                )}
              </div>

              {/* Bookings */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {day.bookings.slice(0, 3).map(booking => (
                  <Tooltip
                    key={booking.id}
                    title={`${booking.therapist_name} - ${booking.service_name} at ${dayjs(booking.start).format('h:mm A')}`}
                  >
                    <div
                      onClick={() => handleBookingClick(booking)}
                      style={{
                        backgroundColor: booking.backgroundColor,
                        color: 'white',
                        padding: '2px 4px',
                        borderRadius: 3,
                        fontSize: '10px',
                        cursor: 'pointer',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        opacity: booking.status === 'cancelled' ? 0.6 : 1,
                      }}
                    >
                      {dayjs(booking.start).format('h:mm A')} {booking.customer_name.split(' ')[0]}
                    </div>
                  </Tooltip>
                ))}
                {day.bookings.length > 3 && (
                  <div style={{ fontSize: '9px', color: '#999', textAlign: 'center' }}>
                    +{day.bookings.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

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
                  onClick={() => window.open('https://rmmbook.netlify.app/', '_blank')}
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
                <Button onClick={handlePrev}>← Previous</Button>
                <Button onClick={handleToday}>Today</Button>
                <Button onClick={handleNext}>Next →</Button>
              </Space>
            </Col>
            <Col>
              <Title level={4} style={{ margin: 0 }}>
                {currentDate.format('MMMM YYYY')}
              </Title>
            </Col>
            <Col>
              <Space>
                <Text>View:</Text>
                <Select
                  value={calendarView}
                  onChange={setCalendarView}
                  style={{ width: 120 }}
                >
                  <Option value="schedule">Schedule</Option>
                  <Option value="day">Day</Option>
                  <Option value="week">Week</Option>
                  <Option value="month">Month</Option>
                </Select>
              </Space>
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

        {/* Calendar Content */}
        <Card>
          {calendarView === 'schedule' && renderScheduleView()}
          {calendarView === 'day' && renderScheduleView()}
          {calendarView === 'week' && renderWeekView()}
          {calendarView === 'month' && renderMonthView()}
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
        onClick={() => edit('bookings', selectedBooking?.id || '')}
      >
        Edit
      </Button>
    )}
              {(canAccess(userRole, 'canDeleteBookings') || 
                (isTherapist(userRole) && selectedBooking?.therapist_id === identity?.id)) && (
                <Button 
                  danger
                  onClick={() => {
                    Modal.confirm({
                      title: 'Cancel Booking',
                      content: 'Are you sure you want to cancel this booking? This action cannot be undone.',
                      okText: 'Yes, Cancel',
                      cancelText: 'No, Keep Booking',
                      okType: 'danger',
                      onOk: async () => {
                        try {
                          const { error } = await supabaseClient
                            .from('bookings')
                            .update({ status: 'cancelled' })
                            .eq('id', selectedBooking?.id);
                          
                          if (error) throw error;
                          
                          message.success('Booking cancelled successfully');
                          setShowBookingDrawer(false);
                          fetchBookings(); // Refresh the calendar
                        } catch (error) {
                          console.error('Error cancelling booking:', error);
                          message.error('Failed to cancel booking');
                        }
                      }
                    });
                  }}
                >
                  Cancel
                </Button>
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
                        Therapist Fee: ${selectedBooking.therapist_fee ? selectedBooking.therapist_fee.toFixed(2) : '0.00'}
                      </div>
                      {/* Only show total price to admins */}
                      {!isTherapist(userRole) && (
                        <div>
                          <DollarOutlined style={{ marginRight: 8 }} />
                          Total Price: ${selectedBooking.price ? selectedBooking.price.toFixed(2) : '0.00'}
                        </div>
                      )}
                    </Space>
                  </div>
                </div>

                {/* Therapist */}
                {selectedBooking.therapist_name && (
                  <div>
                    <Text strong>Therapist:</Text>
                    <div style={{ marginTop: 4 }}>
                      <Space>
                        <TeamOutlined style={{ marginRight: 8 }} />
                        {selectedBooking.therapist_name}
                      </Space>
                    </div>
                  </div>
                )}

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
                    <Text strong>Delivery Address:</Text>
                    <div style={{ marginTop: 4 }}>
                      <EnvironmentOutlined style={{ marginRight: 8 }} />
                      {selectedBooking.address}
                    </div>
                  </div>
                )}

                {/* Business & Room */}
                <div>
                  <Text strong>Business & Room:</Text>
                  <div style={{ marginTop: 4 }}>
                    <Space direction="vertical" size="small">
                      <div>🏨 Business: {selectedBooking.business_name || 'Not specified'}</div>
                      <div>🚪 Room: {selectedBooking.room_number || 'Not specified'}</div>
                    </Space>
                  </div>
                </div>

                {/* Duration */}
                <div>
                  <Text strong>Duration:</Text>
                  <div style={{ marginTop: 4 }}>
                    ⏱️ {Math.round((new Date(selectedBooking.end).getTime() - new Date(selectedBooking.start).getTime()) / (1000 * 60))} minutes
                  </div>
                </div>

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
