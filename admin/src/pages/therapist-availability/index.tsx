import React, { useState, useEffect } from 'react';
import {
  Card,
  Typography,
  Select,
  Button,
  Space,
  Spin,
  Tag,
  Tooltip,
  message,
  Badge,
} from 'antd';
import {
  LeftOutlined,
  RightOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { supabaseClient } from '../../utility';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(isoWeek);

const { Title, Text } = Typography;
const { Option } = Select;

interface Therapist {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  is_active: boolean;
  home_address?: string;
}

interface AvailabilitySlot {
  day_of_week: number;
  start_time: string;
  end_time: string;
}

interface TimeOff {
  start_date: string;
  end_date: string;
}

interface Booking {
  booking_time: string;
  duration_minutes: number;
}

interface TherapistAvailability {
  therapist: Therapist;
  availability: AvailabilitySlot[];
  timeOff: TimeOff[];
  bookings: Booking[];
}

// Extract city from home_address (first part before comma)
const extractCity = (address?: string): string => {
  if (!address) return '';
  const parts = address.split(',');
  return parts[0]?.trim() || '';
};

const TherapistAvailabilityOverview: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [weekStart, setWeekStart] = useState(dayjs().startOf('isoWeek'));
  const [cities, setCities] = useState<string[]>([]);
  const [therapistData, setTherapistData] = useState<TherapistAvailability[]>([]);

  useEffect(() => {
    loadCities();
  }, []);

  useEffect(() => {
    loadAvailabilityData();
  }, [selectedCity, weekStart]);

  const loadCities = async () => {
    try {
      // Get unique cities from therapist home addresses
      const { data, error } = await supabaseClient
        .from('therapist_profiles')
        .select('home_address')
        .eq('is_active', true);

      if (error) throw error;

      const allCities = new Set<string>();
      data?.forEach((t: any) => {
        const city = extractCity(t.home_address);
        if (city) {
          allCities.add(city);
        }
      });

      setCities(Array.from(allCities).sort());
    } catch (error) {
      console.error('Error loading cities:', error);
    }
  };

  const loadAvailabilityData = async () => {
    try {
      setLoading(true);

      const weekEnd = weekStart.add(6, 'day');

      // Load therapists with their home addresses
      const { data: therapists, error: therapistError } = await supabaseClient
        .from('therapist_profiles')
        .select('id, first_name, last_name, email, phone, is_active, home_address')
        .eq('is_active', true)
        .order('first_name');

      if (therapistError) throw therapistError;

      // Filter by city if selected
      let filteredTherapists = therapists || [];
      if (selectedCity !== 'all') {
        filteredTherapists = filteredTherapists.filter((t: any) => {
          const city = extractCity(t.home_address);
          return city === selectedCity;
        });
      }

      // Load availability, time off, and bookings for each therapist
      const availabilityPromises = filteredTherapists.map(async (therapist: any) => {
        // Get availability slots
        const { data: availabilityData } = await supabaseClient
          .from('therapist_availability')
          .select('day_of_week, start_time, end_time')
          .eq('therapist_id', therapist.id);

        // Get time off for this week
        const { data: timeOffData } = await supabaseClient
          .from('therapist_time_off')
          .select('start_date, end_date')
          .eq('therapist_id', therapist.id)
          .lte('start_date', weekEnd.format('YYYY-MM-DD'))
          .gte('end_date', weekStart.format('YYYY-MM-DD'));

        // Get bookings for this week
        const { data: bookingsData } = await supabaseClient
          .from('bookings')
          .select('booking_time, duration_minutes')
          .eq('therapist_id', therapist.id)
          .in('status', ['confirmed', 'pending'])
          .gte('booking_time', weekStart.format('YYYY-MM-DD'))
          .lte('booking_time', weekEnd.add(1, 'day').format('YYYY-MM-DD'));

        return {
          therapist,
          availability: availabilityData || [],
          timeOff: timeOffData || [],
          bookings: bookingsData || [],
        };
      });

      const results = await Promise.all(availabilityPromises);
      setTherapistData(results);
    } catch (error) {
      console.error('Error loading availability data:', error);
      message.error('Failed to load availability data');
    } finally {
      setLoading(false);
    }
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    setWeekStart((current) =>
      direction === 'prev' ? current.subtract(1, 'week') : current.add(1, 'week')
    );
  };

  const goToToday = () => {
    setWeekStart(dayjs().startOf('isoWeek'));
  };

  // Get days of the week
  const weekDays = Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day'));

  // Check if therapist is available on a specific day
  const getDayStatus = (data: TherapistAvailability, day: dayjs.Dayjs) => {
    const dayOfWeek = day.day(); // 0 = Sunday, 1 = Monday, etc.
    const dateStr = day.format('YYYY-MM-DD');

    // Check if on time off
    const isOnTimeOff = data.timeOff.some((to) => {
      const start = dayjs(to.start_date);
      const end = dayjs(to.end_date);
      return day.isSame(start, 'day') || day.isSame(end, 'day') ||
        (day.isAfter(start, 'day') && day.isBefore(end, 'day'));
    });

    if (isOnTimeOff) {
      return { status: 'off', label: 'Time Off', color: '#ff4d4f' };
    }

    // Check availability slots for this day
    const daySlots = data.availability.filter((slot) => slot.day_of_week === dayOfWeek);

    if (daySlots.length === 0) {
      return { status: 'unavailable', label: 'Not Available', color: '#d9d9d9' };
    }

    // Count bookings for this day
    const dayBookings = data.bookings.filter((b) =>
      dayjs(b.booking_time).format('YYYY-MM-DD') === dateStr
    );

    // Get availability time range
    const startTime = daySlots.reduce((earliest, slot) =>
      slot.start_time < earliest ? slot.start_time : earliest, '23:59');
    const endTime = daySlots.reduce((latest, slot) =>
      slot.end_time > latest ? slot.end_time : latest, '00:00');

    const timeRange = `${startTime.substring(0, 5)} - ${endTime.substring(0, 5)}`;

    if (dayBookings.length > 0) {
      return {
        status: 'partial',
        label: timeRange,
        bookings: dayBookings.length,
        color: '#1890ff',
      };
    }

    return {
      status: 'available',
      label: timeRange,
      bookings: 0,
      color: '#52c41a',
    };
  };

  // Calculate summary for each day
  const getDaySummary = (day: dayjs.Dayjs) => {
    let available = 0;
    let unavailable = 0;
    let onTimeOff = 0;

    therapistData.forEach((data) => {
      const status = getDayStatus(data, day);
      if (status.status === 'available' || status.status === 'partial') available++;
      else if (status.status === 'off') onTimeOff++;
      else unavailable++;
    });

    return { available, unavailable, onTimeOff };
  };

  return (
    <div>
      <Title level={2}>
        <CalendarOutlined style={{ marginRight: 8 }} />
        Therapist Availability Overview
      </Title>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap style={{ marginBottom: 16 }}>
          <Select
            style={{ width: 200 }}
            placeholder="Filter by Location"
            value={selectedCity}
            onChange={setSelectedCity}
          >
            <Option value="all">All Locations</Option>
            {cities.map((city) => (
              <Option key={city} value={city}>
                {city}
              </Option>
            ))}
          </Select>

          <Button onClick={() => navigateWeek('prev')} icon={<LeftOutlined />}>
            Prev Week
          </Button>
          <Button onClick={goToToday}>Today</Button>
          <Button onClick={() => navigateWeek('next')}>
            Next Week <RightOutlined />
          </Button>

          <Text strong style={{ marginLeft: 16 }}>
            {weekStart.format('MMM D')} - {weekStart.add(6, 'day').format('MMM D, YYYY')}
          </Text>
        </Space>

        {/* Legend */}
        <Space style={{ marginBottom: 16 }}>
          <Tag color="green"><CheckCircleOutlined /> Available</Tag>
          <Tag color="blue"><ClockCircleOutlined /> Has Bookings</Tag>
          <Tag color="red"><CloseCircleOutlined /> Time Off</Tag>
          <Tag color="default">Not Available</Tag>
        </Space>
      </Card>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 50 }}>
          <Spin size="large" />
        </div>
      ) : (
        <Card>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
              <thead>
                <tr style={{ backgroundColor: '#fafafa' }}>
                  <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '2px solid #f0f0f0', width: 180 }}>
                    Therapist
                  </th>
                  {weekDays.map((day) => (
                    <th
                      key={day.format('YYYY-MM-DD')}
                      style={{
                        padding: '12px 8px',
                        textAlign: 'center',
                        borderBottom: '2px solid #f0f0f0',
                        backgroundColor: day.isSame(dayjs(), 'day') ? '#e6f7ff' : undefined,
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{day.format('ddd')}</div>
                      <div style={{ fontSize: 12, color: '#666' }}>{day.format('MMM D')}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Summary Row */}
                <tr style={{ backgroundColor: '#f5f5f5' }}>
                  <td style={{ padding: '8px', fontWeight: 600, borderBottom: '1px solid #f0f0f0' }}>
                    Available Therapists
                  </td>
                  {weekDays.map((day) => {
                    const summary = getDaySummary(day);
                    return (
                      <td
                        key={`summary-${day.format('YYYY-MM-DD')}`}
                        style={{
                          padding: '8px',
                          textAlign: 'center',
                          borderBottom: '1px solid #f0f0f0',
                        }}
                      >
                        <Tag color="green">{summary.available}</Tag>
                      </td>
                    );
                  })}
                </tr>

                {/* Therapist Rows */}
                {therapistData.map((data) => (
                  <tr key={data.therapist.id}>
                    <td style={{ padding: '8px', borderBottom: '1px solid #f0f0f0' }}>
                      <div style={{ fontWeight: 500 }}>
                        {data.therapist.first_name} {data.therapist.last_name}
                      </div>
                      <div style={{ fontSize: 11, color: '#888' }}>
                        {extractCity(data.therapist.home_address) || 'No location set'}
                      </div>
                    </td>
                    {weekDays.map((day) => {
                      const dayStatus = getDayStatus(data, day);
                      return (
                        <td
                          key={`${data.therapist.id}-${day.format('YYYY-MM-DD')}`}
                          style={{
                            padding: '8px',
                            textAlign: 'center',
                            borderBottom: '1px solid #f0f0f0',
                            backgroundColor:
                              dayStatus.status === 'available' ? '#f6ffed' :
                              dayStatus.status === 'partial' ? '#e6f7ff' :
                              dayStatus.status === 'off' ? '#fff1f0' : '#fafafa',
                          }}
                        >
                          <Tooltip title={dayStatus.label}>
                            {dayStatus.status === 'available' && (
                              <div>
                                <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 16 }} />
                                <div style={{ fontSize: 10, color: '#52c41a' }}>
                                  {dayStatus.label}
                                </div>
                              </div>
                            )}
                            {dayStatus.status === 'partial' && (
                              <div>
                                <Badge count={dayStatus.bookings} size="small">
                                  <ClockCircleOutlined style={{ color: '#1890ff', fontSize: 16 }} />
                                </Badge>
                                <div style={{ fontSize: 10, color: '#1890ff' }}>
                                  {dayStatus.label}
                                </div>
                              </div>
                            )}
                            {dayStatus.status === 'off' && (
                              <div>
                                <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 16 }} />
                                <div style={{ fontSize: 10, color: '#ff4d4f' }}>
                                  Time Off
                                </div>
                              </div>
                            )}
                            {dayStatus.status === 'unavailable' && (
                              <div>
                                <span style={{ color: '#d9d9d9' }}>-</span>
                              </div>
                            )}
                          </Tooltip>
                        </td>
                      );
                    })}
                  </tr>
                ))}

                {therapistData.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: 24, color: '#999' }}>
                      No therapists found for the selected location
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

export default TherapistAvailabilityOverview;
