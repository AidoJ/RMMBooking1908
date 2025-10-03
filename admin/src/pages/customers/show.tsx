import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Typography,
  Space,
  Button,
  Avatar,
  Descriptions,
  Tag,
  Table,
  message,
  Spin,
  Divider,
  Badge,
  Tooltip,
  Empty,
  Alert
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  UserOutlined,
  PhoneOutlined,
  MailOutlined,
  EnvironmentOutlined,
  CalendarOutlined,
  DollarOutlined,
  CrownOutlined,
  BookOutlined,
  StarOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';
import { useGetIdentity, useNavigation } from '@refinedev/core';
import { useParams } from 'react-router';
import { RoleGuard } from '../../components/RoleGuard';
import { supabaseClient } from '../../utility';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  address?: string;
  notes?: string;
  customer_code?: string;
  is_guest: boolean;
  created_at: string;
}

interface Booking {
  id: string;
  service_name: string;
  therapist_name: string;
  booking_date: string;
  booking_time: string;
  duration: number;
  status: string;
  total_price: string;
  customer_rating?: number;
  customer_feedback?: string;
  created_at: string;
}

interface CustomerStats {
  total_bookings: number;
  completed_bookings: number;
  cancelled_bookings: number;
  total_spent: number;
  average_rating_given: number;
  first_booking_date?: string;
  latest_booking_date?: string;
}

const CustomerShow: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { data: identity } = useGetIdentity<any>();
  const { list, edit } = useNavigation();
  
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [stats, setStats] = useState<CustomerStats>({
    total_bookings: 0,
    completed_bookings: 0,
    cancelled_bookings: 0,
    total_spent: 0,
    average_rating_given: 0
  });

  const canEditCustomers = identity?.role === 'admin' || identity?.role === 'super_admin';

  useEffect(() => {
    if (id) {
      loadCustomerData();
    }
  }, [id]);

  const loadCustomerData = async () => {
    try {
      setLoading(true);

      // Load customer data
      const { data: customerData, error: customerError } = await supabaseClient
        .from('customers')
        .select('*')
        .eq('id', id)
        .single();

      if (customerError) throw customerError;

      // Load booking history with related data
      const { data: bookingData, error: bookingError } = await supabaseClient
        .from('bookings')
        .select(`
          id,
          booking_date,
          booking_time,
          duration,
          status,
          price,
          customer_rating,
          customer_feedback,
          created_at,
          services!inner(name),
          therapist_profiles!inner(first_name, last_name)
        `)
        .eq('customer_id', id)
        .order('booking_date', { ascending: false });

      if (bookingError) throw bookingError;

      // Process booking data
      const processedBookings: Booking[] = bookingData?.map(booking => ({
        id: booking.id,
        service_name: (booking.services as any)?.name || 'Unknown Service',
        therapist_name: `${(booking.therapist_profiles as any)?.first_name || ''} ${(booking.therapist_profiles as any)?.last_name || ''}`.trim(),
        booking_date: booking.booking_date,
        booking_time: booking.booking_time,
        duration: booking.duration,
        status: booking.status,
        total_price: booking.price,
        customer_rating: booking.customer_rating,
        customer_feedback: booking.customer_feedback,
        created_at: booking.created_at
      })) || [];

      // Calculate statistics
      const totalSpent = processedBookings.reduce((sum, booking) => sum + parseFloat(booking.total_price), 0);
      const completedBookings = processedBookings.filter(b => b.status === 'completed');
      const cancelledBookings = processedBookings.filter(b => b.status === 'cancelled');
      const ratingsGiven = processedBookings.filter(b => b.customer_rating && b.customer_rating > 0);
      const averageRating = ratingsGiven.length > 0 
        ? ratingsGiven.reduce((sum, b) => sum + (b.customer_rating || 0), 0) / ratingsGiven.length 
        : 0;

      const customerStats: CustomerStats = {
        total_bookings: processedBookings.length,
        completed_bookings: completedBookings.length,
        cancelled_bookings: cancelledBookings.length,
        total_spent: totalSpent,
        average_rating_given: averageRating,
        first_booking_date: processedBookings.length > 0 
          ? processedBookings[processedBookings.length - 1].booking_date 
          : undefined,
        latest_booking_date: processedBookings.length > 0 
          ? processedBookings[0].booking_date 
          : undefined
      };

      setCustomer(customerData);
      setBookings(processedBookings);
      setStats(customerStats);

    } catch (error: any) {
      console.error('Error loading customer data:', error);
      message.error('Failed to load customer information');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
      case 'completed':
        return 'success';
      case 'cancelled':
        return 'error';
      case 'pending':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
      case 'completed':
        return <CheckCircleOutlined />;
      case 'cancelled':
        return <CloseCircleOutlined />;
      case 'pending':
        return <ClockCircleOutlined />;
      default:
        return <ExclamationCircleOutlined />;
    }
  };

  const bookingColumns = [
    {
      title: 'Service',
      dataIndex: 'service_name',
      key: 'service_name',
      render: (service: string) => (
        <Text strong>{service}</Text>
      )
    },
    {
      title: 'Therapist',
      dataIndex: 'therapist_name',
      key: 'therapist_name'
    },
    {
      title: 'Date & Time',
      key: 'datetime',
      render: (_: any, record: Booking) => (
        <div>
          <div><CalendarOutlined /> {dayjs(record.booking_date).format('MMM DD, YYYY')}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            <ClockCircleOutlined /> {record.booking_time} ({record.duration}min)
          </div>
        </div>
      )
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={getStatusColor(status)} icon={getStatusIcon(status)}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Tag>
      )
    },
    {
      title: 'Price',
      dataIndex: 'total_price',
      key: 'total_price',
      render: (price: string) => (
        <Text strong style={{ color: '#52c41a' }}>
          <DollarOutlined />${parseFloat(price).toFixed(2)}
        </Text>
      )
    },
    {
      title: 'Rating',
      dataIndex: 'customer_rating',
      key: 'customer_rating',
      render: (rating: number) => (
        rating ? (
          <div>
            <StarOutlined style={{ color: '#faad14' }} /> {rating}/5
          </div>
        ) : (
          <Text type="secondary">Not rated</Text>
        )
      )
    }
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div style={{ padding: '24px' }}>
        <Alert
          message="Customer Not Found"
          description="The customer you're looking for doesn't exist or has been deleted."
          type="error"
          showIcon
          action={
            <Button size="small" onClick={() => list('customers')}>
              Back to Customers
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <RoleGuard requiredPermission="canViewCustomers">
      <div style={{ padding: '24px' }}>
        {/* Header */}
        <Card style={{ marginBottom: '24px' }}>
          <Row justify="space-between" align="middle">
            <Col>
              <Button 
                icon={<ArrowLeftOutlined />} 
                onClick={() => list('customers')}
                style={{ marginBottom: '16px' }}
              >
                Back to Customers
              </Button>
              <Space align="center">
                <Avatar 
                  size={64} 
                  icon={<UserOutlined />}
                  style={{ 
                    backgroundColor: customer.is_guest ? '#faad14' : '#1890ff',
                    fontSize: '24px'
                  }}
                />
                <div>
                  <Title level={2} style={{ margin: 0 }}>
                    {customer.first_name} {customer.last_name}
                    {customer.is_guest && (
                      <Tag color="gold" style={{ marginLeft: 12 }}>
                        <CrownOutlined /> Guest Account
                      </Tag>
                    )}
                  </Title>
                  <Text type="secondary">
                    Customer Code: {customer.customer_code || 'Not assigned'}
                  </Text>
                </div>
              </Space>
            </Col>
            <Col>
              {canEditCustomers && (
                <Button
                  type="primary"
                  icon={<EditOutlined />}
                  onClick={() => edit('customers', customer.id)}
                  size="large"
                >
                  Edit Customer
                </Button>
              )}
            </Col>
          </Row>
        </Card>

        <Row gutter={24}>
          {/* Customer Information */}
          <Col xs={24} lg={8}>
            <Card title="Customer Information" style={{ marginBottom: '24px' }}>
              <Descriptions column={1} size="small">
                <Descriptions.Item 
                  label={<><MailOutlined /> Email</>}
                >
                  <Text copyable={{ text: customer.email }}>{customer.email}</Text>
                </Descriptions.Item>
                {customer.phone && (
                  <Descriptions.Item 
                    label={<><PhoneOutlined /> Phone</>}
                  >
                    <Text copyable={{ text: customer.phone }}>{customer.phone}</Text>
                  </Descriptions.Item>
                )}
                {customer.address && (
                  <Descriptions.Item 
                    label={<><EnvironmentOutlined /> Address</>}
                  >
                    {customer.address}
                  </Descriptions.Item>
                )}
                <Descriptions.Item 
                  label={<><CalendarOutlined /> Joined</>}
                >
                  {dayjs(customer.created_at).format('MMMM DD, YYYY')}
                </Descriptions.Item>
                <Descriptions.Item label="Account Type">
                  <Tag color={customer.is_guest ? 'gold' : 'blue'}>
                    {customer.is_guest ? 'Guest' : 'Registered'}
                  </Tag>
                </Descriptions.Item>
              </Descriptions>

              {customer.notes && (
                <>
                  <Divider />
                  <div>
                    <Text strong>Admin Notes:</Text>
                    <div style={{ 
                      marginTop: 8, 
                      padding: 12, 
                      backgroundColor: '#f5f5f5', 
                      borderRadius: 4 
                    }}>
                      <Text>{customer.notes}</Text>
                    </div>
                  </div>
                </>
              )}
            </Card>

            {/* Quick Statistics */}
            <Card title="Quick Stats">
              <Row gutter={16}>
                <Col span={12}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1890ff' }}>
                      {stats.total_bookings}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>Total Bookings</div>
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#52c41a' }}>
                      ${stats.total_spent.toFixed(2)}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>Total Spent</div>
                  </div>
                </Col>
              </Row>
              <Divider />
              <Row gutter={16}>
                <Col span={12}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#52c41a' }}>
                      {stats.completed_bookings}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>Completed</div>
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#f5222d' }}>
                      {stats.cancelled_bookings}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>Cancelled</div>
                  </div>
                </Col>
              </Row>
              {stats.average_rating_given > 0 && (
                <>
                  <Divider />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#faad14' }}>
                      <StarOutlined /> {stats.average_rating_given.toFixed(1)}/5
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>Average Rating Given</div>
                  </div>
                </>
              )}
            </Card>
          </Col>

          {/* Booking History */}
          <Col xs={24} lg={16}>
            <Card 
              title={
                <Space>
                  <BookOutlined />
                  Booking History ({stats.total_bookings})
                </Space>
              }
            >
              {bookings.length > 0 ? (
                <Table
                  dataSource={bookings}
                  columns={bookingColumns}
                  rowKey="id"
                  pagination={{
                    pageSize: 10,
                    showSizeChanger: false,
                    showTotal: (total, range) => 
                      `${range[0]}-${range[1]} of ${total} bookings`
                  }}
                  expandable={{
                    expandedRowRender: (record: Booking) => (
                      record.customer_feedback ? (
                        <div style={{ padding: 16, backgroundColor: '#f9f9f9' }}>
                          <Text strong>Customer Feedback:</Text>
                          <div style={{ marginTop: 8 }}>
                            <Text>{record.customer_feedback}</Text>
                          </div>
                        </div>
                      ) : null
                    ),
                    rowExpandable: (record: Booking) => !!record.customer_feedback,
                  }}
                />
              ) : (
                <Empty
                  description="No booking history found"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                >
                  <Text type="secondary">
                    This customer hasn't made any bookings yet.
                  </Text>
                </Empty>
              )}
            </Card>
          </Col>
        </Row>
      </div>
    </RoleGuard>
  );
};

export default CustomerShow;