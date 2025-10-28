import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Typography,
  Avatar,
  Tag,
  Descriptions,
  Statistic,
  Space,
  Button,
  Rate,
  Table,
  message,
  Spin,
  Divider,
  Tabs
} from 'antd';
import {
  UserOutlined,
  EditOutlined,
  PhoneOutlined,
  MailOutlined,
  EnvironmentOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  StarOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  ArrowLeftOutlined
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router';
import { useGetIdentity } from '@refinedev/core';
import { RoleGuard } from '../../components/RoleGuard';
import { supabaseClient } from '../../utility';

const { Title, Text, Paragraph } = Typography;

interface Service {
  id: string;
  name: string;
  description?: string;
  service_base_price: number;
  minimum_duration: number;
}

interface Booking {
  id: string;
  customer_name: string;
  service_name: string;
  booking_time: string;
  status: string;
  price: number;
  duration_minutes: number;
}

interface Availability {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

interface TimeOff {
  id: string;
  start_date: string;
  end_date: string;
  reason?: string;
  status: string;
}

interface TherapistProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  bio?: string;
  profile_pic?: string;
  home_address?: string;
  latitude?: number;
  longitude?: number;
  service_radius_km?: number;
  is_active: boolean;
  gender?: string;
  years_experience?: number;
  rating: number;
  total_reviews: number;
  business_abn: string;
  address_verified: boolean;
  created_at: string;
  updated_at: string;
  user?: {
    email: string;
    role: string;
    last_login?: string;
  };
}

const TherapistShow: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: identity } = useGetIdentity<any>();
  const [therapist, setTherapist] = useState<TherapistProfile | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [recentBookings, setRecentBookings] = useState<Booking[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [timeOff, setTimeOff] = useState<TimeOff[]>([]);
  const [loading, setLoading] = useState(true);

  const canEditTherapists = identity?.role === 'admin' || identity?.role === 'super_admin';

  useEffect(() => {
    if (id) {
      loadTherapistDetails();
    }
  }, [id]);

  const loadTherapistDetails = async () => {
    try {
      setLoading(true);

      // Load therapist profile with user info
      const { data: therapistData, error: therapistError } = await supabaseClient
        .from('therapist_profiles')
        .select(`
          *,
          user:admin_users!therapist_profiles_user_id_fkey(email, role, last_login)
        `)
        .eq('id', id)
        .single();

      if (therapistError) throw therapistError;
      setTherapist(therapistData);

      // Load therapist services
      const { data: servicesData, error: servicesError } = await supabaseClient
        .from('therapist_services')
        .select(`
          services!inner(
            id,
            name,
            description,
            service_base_price,
            minimum_duration
          )
        `)
        .eq('therapist_id', id);

      if (servicesError) throw servicesError;
      setServices(servicesData?.map(ts => ts.services).flat() || []);

      // Load recent bookings
      const { data: bookingsData, error: bookingsError } = await supabaseClient
        .from('bookings')
        .select(`
          id,
          booking_time,
          status,
          price,
          duration_minutes,
          customer_id,
          service_id
        `)
        .eq('therapist_id', id)
        .order('booking_time', { ascending: false })
        .limit(10);

      if (bookingsError) throw bookingsError;
      
      // Simple booking data without joins for now
      const formattedBookings = bookingsData?.map(booking => ({
        id: booking.id,
        customer_name: 'Customer', // Simplified for now
        service_name: 'Service', // Simplified for now
        booking_time: booking.booking_time,
        status: booking.status,
        price: booking.price,
        duration_minutes: booking.duration_minutes
      })) || [];
      setRecentBookings(formattedBookings);

      // Load availability
      const { data: availabilityData, error: availabilityError } = await supabaseClient
        .from('therapist_availability')
        .select('*')
        .eq('therapist_id', id)
        .order('day_of_week', { ascending: true });

      if (availabilityError) throw availabilityError;
      setAvailability(availabilityData || []);

      // Load time off
      const { data: timeOffData, error: timeOffError } = await supabaseClient
        .from('therapist_time_off')
        .select('*')
        .eq('therapist_id', id)
        .order('start_date', { ascending: false });

      if (timeOffError) throw timeOffError;
      setTimeOff(timeOffData || []);

    } catch (error: any) {
      console.error('Error loading therapist details:', error);
      message.error('Failed to load therapist details');
    } finally {
      setLoading(false);
    }
  };

  const getDayName = (dayOfWeek: number): string => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayOfWeek] || 'Unknown';
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed': return 'green';
      case 'confirmed': return 'blue';
      case 'requested': return 'orange';
      case 'cancelled': return 'red';
      default: return 'default';
    }
  };

  const bookingColumns = [
    {
      title: 'Customer',
      dataIndex: 'customer_name',
      key: 'customer_name',
    },
    {
      title: 'Service',
      dataIndex: 'service_name',
      key: 'service_name',
    },
    {
      title: 'Date & Time',
      dataIndex: 'booking_time',
      key: 'booking_time',
      render: (time: string) => new Date(time).toLocaleDateString() + ' ' + new Date(time).toLocaleTimeString(),
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
    },
    {
      title: 'Duration',
      dataIndex: 'duration_minutes',
      key: 'duration_minutes',
      render: (minutes: number) => `${minutes} min`,
    },
    {
      title: 'Price',
      dataIndex: 'price',
      key: 'price',
      render: (price: number) => `$${price?.toFixed(2) || '0.00'}`,
    },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!therapist) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Title level={3}>Therapist Not Found</Title>
        <Text>The requested therapist could not be found.</Text>
      </div>
    );
  }

  return (
    <RoleGuard requiredPermission="canViewAllTherapists">
      <div style={{ padding: '24px' }}>
        {/* Header */}
        <Card style={{ marginBottom: '24px' }}>
          <Row gutter={24} align="middle">
            <Col>
              <Button 
                icon={<ArrowLeftOutlined />} 
                onClick={() => navigate('/therapists')}
              >
                Back to Therapists
              </Button>
            </Col>
            <Col flex="auto">
              <Title level={2} style={{ margin: 0 }}>
                Therapist Profile Details
              </Title>
            </Col>
            <Col>
              {canEditTherapists && (
                <Button
                  type="primary"
                  icon={<EditOutlined />}
                  onClick={() => navigate(`/therapists/edit/${id}`)}
                >
                  Edit Profile
                </Button>
              )}
            </Col>
          </Row>
        </Card>

        {/* Profile Header Card */}
        <Card style={{ marginBottom: '24px' }}>
          <Row gutter={24} align="middle">
            <Col>
              <Avatar
                size={80}
                src={therapist.profile_pic}
                icon={<UserOutlined />}
              />
            </Col>
            <Col flex="auto">
              <Title level={3} style={{ margin: 0 }}>
                {therapist.first_name} {therapist.last_name}
              </Title>
              <Space style={{ marginTop: '8px' }}>
                <Tag color={therapist.is_active ? 'green' : 'red'}>
                  {therapist.is_active ? 'Active' : 'Inactive'}
                </Tag>
                {therapist.address_verified && (
                  <Tag color="blue" icon={<CheckCircleOutlined />}>
                    Verified
                  </Tag>
                )}
              </Space>
            </Col>
            <Col>
              <Space direction="vertical" size="small">
                <Statistic
                  title="Rating"
                  value={therapist.rating}
                  precision={1}
                  prefix={<StarOutlined style={{ color: '#faad14' }} />}
                  suffix="/ 5.0"
                />
                <Rate disabled allowHalf value={therapist.rating} style={{ fontSize: 14 }} />
              </Space>
            </Col>
            <Col>
              <Statistic
                title="Reviews"
                value={therapist.total_reviews}
              />
            </Col>
          </Row>
        </Card>

        {/* Tabbed Content */}
        <Card>
          <Tabs
            defaultActiveKey="bio"
            items={[
              {
                key: 'bio',
                label: 'Bio',
                children: (
                  <div>
                    <Row gutter={24}>
                      <Col span={12}>
                        <Descriptions title="Personal Information" column={1}>
                          <Descriptions.Item label="Email">
                            <Space>
                              <MailOutlined />
                              {therapist.email}
                            </Space>
                          </Descriptions.Item>
                          {therapist.phone && (
                            <Descriptions.Item label="Phone">
                              <Space>
                                <PhoneOutlined />
                                {therapist.phone}
                              </Space>
                            </Descriptions.Item>
                          )}
                          <Descriptions.Item label="Gender">
                            {therapist.gender || 'Not specified'}
                          </Descriptions.Item>
                          <Descriptions.Item label="Experience">
                            {therapist.years_experience ? `${therapist.years_experience} years` : 'Not specified'}
                          </Descriptions.Item>
                          <Descriptions.Item label="Business ABN">
                            {therapist.business_abn || 'Not provided'}
                          </Descriptions.Item>
                        </Descriptions>
                      </Col>
                      <Col span={12}>
                        <Descriptions title="Account Information" column={1}>
                          <Descriptions.Item label="Account Created">
                            {new Date(therapist.created_at).toLocaleDateString()}
                          </Descriptions.Item>
                          <Descriptions.Item label="Last Updated">
                            {new Date(therapist.updated_at).toLocaleDateString()}
                          </Descriptions.Item>
                          {therapist.user?.last_login && (
                            <Descriptions.Item label="Last Login">
                              {new Date(therapist.user.last_login).toLocaleDateString()}
                            </Descriptions.Item>
                          )}
                        </Descriptions>
                      </Col>
                    </Row>
                    {therapist.bio && (
                      <>
                        <Divider />
                        <div>
                          <Title level={5}>Biography</Title>
                          <Paragraph>{therapist.bio}</Paragraph>
                        </div>
                      </>
                    )}
                  </div>
                ),
              },
              {
                key: 'services',
                label: 'Services',
                children: (
                  <div>
                    {services.length > 0 ? (
                      <Row gutter={[16, 16]}>
                        {services.map(service => (
                          <Col span={12} key={service.id}>
                            <Card size="small" style={{ height: '100%' }}>
                              <Title level={5} style={{ margin: 0, marginBottom: '8px' }}>
                                {service.name}
                              </Title>
                              <Text type="secondary" style={{ fontSize: '12px' }}>
                                ${service.service_base_price} • {service.minimum_duration} min
                              </Text>
                              {service.description && (
                                <Paragraph
                                  style={{ marginTop: '8px', marginBottom: 0, fontSize: '12px' }}
                                  ellipsis={{ rows: 2 }}
                                >
                                  {service.description}
                                </Paragraph>
                              )}
                            </Card>
                          </Col>
                        ))}
                      </Row>
                    ) : (
                      <Text type="secondary">No services assigned</Text>
                    )}
                  </div>
                ),
              },
              {
                key: 'service-area',
                label: 'Service Area',
                children: (
                  <div>
                    <Descriptions column={2}>
                      <Descriptions.Item label="Home Address" span={2}>
                        <Space>
                          <EnvironmentOutlined />
                          {therapist.home_address || 'Not provided'}
                        </Space>
                      </Descriptions.Item>
                      <Descriptions.Item label="Service Radius">
                        {therapist.service_radius_km ? `${therapist.service_radius_km} km` : 'Not specified'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Address Verified">
                        {therapist.address_verified ? (
                          <Tag color="green" icon={<CheckCircleOutlined />}>Verified</Tag>
                        ) : (
                          <Tag color="red" icon={<CloseCircleOutlined />}>Unverified</Tag>
                        )}
                      </Descriptions.Item>
                      {therapist.latitude && therapist.longitude && (
                        <>
                          <Descriptions.Item label="Latitude">
                            {therapist.latitude}
                          </Descriptions.Item>
                          <Descriptions.Item label="Longitude">
                            {therapist.longitude}
                          </Descriptions.Item>
                        </>
                      )}
                    </Descriptions>
                  </div>
                ),
              },
              {
                key: 'availability',
                label: 'Availability',
                children: (
                  <div>
                    {availability.length > 0 ? (
                      <Row gutter={[16, 8]}>
                        {availability.map(avail => (
                          <Col span={12} key={avail.id}>
                            <div style={{
                              padding: '12px 16px',
                              border: '1px solid #d9d9d9',
                              borderRadius: '6px'
                            }}>
                              <Text strong>{getDayName(avail.day_of_week)}</Text>
                              <br />
                              <Space style={{ marginTop: '4px' }}>
                                <ClockCircleOutlined />
                                {avail.start_time} - {avail.end_time}
                              </Space>
                            </div>
                          </Col>
                        ))}
                      </Row>
                    ) : (
                      <Text type="secondary">No availability schedule set</Text>
                    )}
                  </div>
                ),
              },
              {
                key: 'time-off',
                label: 'Time Off',
                children: (
                  <div>
                    {timeOff.length > 0 ? (
                      <Table
                        dataSource={timeOff}
                        rowKey="id"
                        pagination={false}
                        columns={[
                          {
                            title: 'Start Date',
                            dataIndex: 'start_date',
                            key: 'start_date',
                            render: (date: string) => new Date(date).toLocaleDateString(),
                          },
                          {
                            title: 'End Date',
                            dataIndex: 'end_date',
                            key: 'end_date',
                            render: (date: string) => new Date(date).toLocaleDateString(),
                          },
                          {
                            title: 'Reason',
                            dataIndex: 'reason',
                            key: 'reason',
                            render: (reason: string) => reason || 'Not specified',
                          },
                          {
                            title: 'Status',
                            dataIndex: 'status',
                            key: 'status',
                            render: (status: string) => (
                              <Tag color={status === 'approved' ? 'green' : status === 'pending' ? 'orange' : 'red'}>
                                {status.toUpperCase()}
                              </Tag>
                            ),
                          },
                        ]}
                      />
                    ) : (
                      <Text type="secondary">No time off requests</Text>
                    )}
                  </div>
                ),
              },
            ]}
          />
        </Card>
      </div>
    </RoleGuard>
  );
};

export default TherapistShow;