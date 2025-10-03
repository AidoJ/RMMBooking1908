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
  Divider
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

        <Row gutter={24}>
          {/* Left Column - Personal Info */}
          <Col span={8}>
            <Card title="Personal Information" style={{ marginBottom: '24px' }}>
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <Avatar
                  size={120}
                  src={therapist.profile_pic}
                  icon={<UserOutlined />}
                  style={{ marginBottom: '16px' }}
                />
                <div>
                  <Title level={3} style={{ margin: 0 }}>
                    {therapist.first_name} {therapist.last_name}
                  </Title>
                  <Space>
                    <Tag color={therapist.is_active ? 'green' : 'red'}>
                      {therapist.is_active ? 'Active' : 'Inactive'}
                    </Tag>
                    {therapist.address_verified && (
                      <Tag color="blue" icon={<CheckCircleOutlined />}>
                        Verified
                      </Tag>
                    )}
                  </Space>
                </div>
              </div>

              <Descriptions column={1} size="small">
                <Descriptions.Item label="Email" span={1}>
                  <Space>
                    <MailOutlined />
                    {therapist.email}
                  </Space>
                </Descriptions.Item>
                {therapist.phone && (
                  <Descriptions.Item label="Phone" span={1}>
                    <Space>
                      <PhoneOutlined />
                      {therapist.phone}
                    </Space>
                  </Descriptions.Item>
                )}
                <Descriptions.Item label="Gender" span={1}>
                  {therapist.gender || 'Not specified'}
                </Descriptions.Item>
                <Descriptions.Item label="Experience" span={1}>
                  {therapist.years_experience ? `${therapist.years_experience} years` : 'Not specified'}
                </Descriptions.Item>
                <Descriptions.Item label="Business ABN" span={1}>
                  {therapist.business_abn || 'Not provided'}
                </Descriptions.Item>
                <Descriptions.Item label="Account Created" span={1}>
                  {new Date(therapist.created_at).toLocaleDateString()}
                </Descriptions.Item>
                <Descriptions.Item label="Last Updated" span={1}>
                  {new Date(therapist.updated_at).toLocaleDateString()}
                </Descriptions.Item>
                {therapist.user?.last_login && (
                  <Descriptions.Item label="Last Login" span={1}>
                    {new Date(therapist.user.last_login).toLocaleDateString()}
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>

            {/* Performance Stats */}
            <Card title="Performance Overview">
              <Row gutter={16}>
                <Col span={12}>
                  <Statistic
                    title="Rating"
                    value={therapist.rating}
                    precision={1}
                    prefix={<StarOutlined style={{ color: '#faad14' }} />}
                    suffix={`/ 5.0`}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="Reviews"
                    value={therapist.total_reviews}
                    prefix={<span style={{ color: '#1890ff' }}>💬</span>}
                  />
                </Col>
              </Row>
              <div style={{ marginTop: '16px' }}>
                <Rate disabled allowHalf value={therapist.rating} />
              </div>
            </Card>
          </Col>

          {/* Right Column - Details */}
          <Col span={16}>
            {/* Bio */}
            {therapist.bio && (
              <Card title="Biography" style={{ marginBottom: '24px' }}>
                <Paragraph>{therapist.bio}</Paragraph>
              </Card>
            )}

            {/* Location & Service Area */}
            <Card title="Location & Service Area" style={{ marginBottom: '24px' }}>
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
              </Descriptions>
            </Card>

            {/* Services Offered */}
            <Card title="Services Offered" style={{ marginBottom: '24px' }}>
              {services.length > 0 ? (
                <Row gutter={[16, 16]}>
                  {services.map(service => (
                    <Col span={12} key={service.id}>
                      <Card size="small">
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
            </Card>

            {/* Availability Schedule */}
            <Card title="Availability Schedule" style={{ marginBottom: '24px' }}>
              {availability.length > 0 ? (
                <Row gutter={[16, 8]}>
                  {availability.map(avail => (
                    <Col span={12} key={avail.id}>
                      <div style={{ 
                        padding: '8px 12px', 
                        border: '1px solid #d9d9d9', 
                        borderRadius: '6px',
                        fontSize: '12px'
                      }}>
                        <Text strong>{getDayName(avail.day_of_week)}</Text>
                        <br />
                        <Space>
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
            </Card>

            {/* Recent Bookings */}
            <Card title="Recent Bookings">
              <Table
                dataSource={recentBookings}
                columns={bookingColumns}
                rowKey="id"
                size="small"
                pagination={{
                  pageSize: 5,
                  total: recentBookings.length,
                  showSizeChanger: false,
                }}
                locale={{
                  emptyText: 'No recent bookings'
                }}
              />
            </Card>
          </Col>
        </Row>
      </div>
    </RoleGuard>
  );
};

export default TherapistShow;