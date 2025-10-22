import React, { useState, useEffect, useRef } from 'react';
import { Card, Typography, message, Spin, Tag } from 'antd';
import { useNavigate } from 'react-router-dom';
import { supabaseClient } from '../utility/supabaseClient';
import dayjs from 'dayjs';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import './Calendar.css';

const { Title } = Typography;

interface Booking {
  id: string;
  booking_time: string;
  status: string;
  customer_name: string;
  service_name: string;
  address: string;
  therapist_fee: number;
  duration_minutes?: number;
}

export const Calendar: React.FC = () => {
  const navigate = useNavigate();
  const calendarRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<Booking[]>([]);

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

      // Get bookings for a wider range (3 months before and after current date)
      const rangeStart = dayjs().subtract(3, 'months').startOf('month').toISOString();
      const rangeEnd = dayjs().add(3, 'months').endOf('month').toISOString();

      const { data, error } = await supabaseClient
        .from('bookings')
        .select(`
          id,
          booking_time,
          status,
          address,
          therapist_fee,
          duration_minutes,
          booker_name,
          first_name,
          last_name,
          services(name)
        `)
        .eq('therapist_id', profile.id)
        .gte('booking_time', rangeStart)
        .lte('booking_time', rangeEnd)
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
        duration_minutes: b.duration_minutes || 60
      }));

      setBookings(bookingsData);
    } catch (error) {
      console.error('Error loading bookings:', error);
      message.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  // Convert bookings to FullCalendar events
  const events = bookings.map(booking => ({
    id: booking.id,
    title: `${booking.customer_name} - ${booking.service_name}`,
    start: booking.booking_time,
    end: dayjs(booking.booking_time).add(booking.duration_minutes || 60, 'minutes').toISOString(),
    backgroundColor: 'transparent',
    borderColor: '#d9d9d9',
    classNames: ['calendar-event-text-only'],
    extendedProps: {
      status: booking.status,
      customer_name: booking.customer_name,
      service_name: booking.service_name,
      address: booking.address,
      therapist_fee: booking.therapist_fee
    }
  }));

  const handleEventClick = (info: any) => {
    navigate(`/booking/${info.event.id}`);
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
      <Title level={2} style={{ marginBottom: 16 }}>
        My Schedule
      </Title>

      {/* Legend */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontWeight: 500 }}>Status Legend:</span>
          <Tag color="orange">Requested/Pending</Tag>
          <Tag color="blue">Confirmed</Tag>
          <Tag color="green">Completed</Tag>
          <Tag color="red">Cancelled/Declined</Tag>
        </div>
      </Card>

      {/* Calendar */}
      <Card>
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
          }}
          buttonText={{
            today: 'Today',
            month: 'Month',
            week: 'Week',
            day: 'Day'
          }}
          events={events}
          eventClick={handleEventClick}
          height="auto"
          slotMinTime="06:00:00"
          slotMaxTime="22:00:00"
          allDaySlot={false}
          nowIndicator={true}
          editable={false}
          selectable={false}
          eventTimeFormat={{
            hour: 'numeric',
            minute: '2-digit',
            meridiem: 'short'
          }}
          slotDuration="00:30:00"
          slotLabelInterval="01:00"
          slotLabelFormat={{
            hour: 'numeric',
            minute: '2-digit',
            meridiem: 'short'
          }}
          dayHeaderFormat={{
            weekday: 'short',
            month: 'numeric',
            day: 'numeric'
          }}
          eventContent={(eventInfo) => {
            const { event } = eventInfo;
            const { status, customer_name, service_name, therapist_fee } = event.extendedProps;

            // Color mapping for status text
            const getStatusTextColor = (status: string): string => {
              const colors: { [key: string]: string } = {
                requested: '#faad14',
                pending: '#faad14',
                confirmed: '#1890ff',
                completed: '#52c41a',
                cancelled: '#f5222d',
                declined: '#f5222d',
              };
              return colors[status] || '#8c8c8c';
            };

            return (
              <div style={{
                padding: '4px',
                overflow: 'hidden',
                cursor: 'pointer',
                fontSize: '11px',
                lineHeight: '1.3'
              }}>
                <div style={{ fontWeight: 600, color: getStatusTextColor(status) }}>{customer_name}</div>
                <div style={{ color: getStatusTextColor(status) }}>{service_name}</div>
                <div style={{ color: getStatusTextColor(status) }}>${parseFloat(therapist_fee).toFixed(2)}</div>
                <div style={{ fontSize: '10px', opacity: 0.9, fontWeight: 600, color: getStatusTextColor(status) }}>
                  {status.toUpperCase()}
                </div>
              </div>
            );
          }}
        />
      </Card>
    </div>
  );
};
