import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Input,
  Select,
  Row,
  Col,
  Typography,
  message,
  Modal,
  Tag,
  Avatar,
  Statistic,
  Dropdown,
  Tooltip,
  DatePicker,
  Badge,
  Empty
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  ExportOutlined,
  UserOutlined,
  PhoneOutlined,
  MailOutlined,
  CalendarOutlined,
  TeamOutlined,
  UserAddOutlined,
  CrownOutlined,
  MoreOutlined,
  FilterOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { useGetIdentity, useNavigation } from '@refinedev/core';
import { RoleGuard } from '../../components/RoleGuard';
import { supabaseClient } from '../../utility';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;
const { confirm } = Modal;

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
  total_bookings?: number;
  latest_booking?: string;
  total_spent?: number;
}

interface CustomerStats {
  total_customers: number;
  active_customers: number;
  guest_customers: number;
  new_this_month: number;
}

const CustomerList: React.FC = () => {
  const { data: identity } = useGetIdentity<any>();
  const { create, edit, show } = useNavigation();
  
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<CustomerStats>({
    total_customers: 0,
    active_customers: 0,
    guest_customers: 0,
    new_this_month: 0
  });
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);
  
  const canCreateCustomers = identity?.role === 'admin' || identity?.role === 'super_admin';
  const canEditCustomers = identity?.role === 'admin' || identity?.role === 'super_admin';
  const canDeleteCustomers = identity?.role === 'super_admin';

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    filterCustomers();
  }, [customers, searchTerm, statusFilter, dateRange]);

  const loadCustomers = async () => {
    try {
      setLoading(true);

      // Load customers with booking statistics
      const { data: customersData, error: customersError } = await supabaseClient
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (customersError) throw customersError;

      console.log('Raw customers data:', customersData);
      console.log('Number of customers found:', customersData?.length || 0);

      // Get booking statistics for each customer (removed status filter to get all bookings)
      const { data: bookingStats, error: bookingError } = await supabaseClient
        .from('bookings')
        .select(`
          customer_id,
          created_at,
          price,
          status
        `);

      if (bookingError) throw bookingError;
      
      console.log('Booking stats data:', bookingStats);
      console.log('Number of bookings found:', bookingStats?.length || 0);

      // Process customers with booking data
      const customersWithStats = customersData?.map(customer => {
        const customerBookings = bookingStats?.filter(booking => booking.customer_id === customer.id) || [];
        // Only count confirmed/completed bookings for spending
        const confirmedBookings = customerBookings.filter(b => b.status === 'confirmed' || b.status === 'completed');
        const totalSpent = confirmedBookings.reduce((sum, booking) => sum + (parseFloat(booking.price) || 0), 0);
        const latestBooking = customerBookings.length > 0 
          ? dayjs(Math.max(...customerBookings.map(b => new Date(b.created_at).getTime()))).format('YYYY-MM-DD')
          : undefined;

        console.log(`Customer ${customer.first_name} ${customer.last_name}:`, {
          totalBookings: customerBookings.length,
          confirmedBookings: confirmedBookings.length,
          totalSpent,
          latestBooking
        });

        return {
          ...customer,
          total_bookings: customerBookings.length,
          latest_booking: latestBooking,
          total_spent: totalSpent
        };
      }) || [];

      console.log('Processed customers with stats:', customersWithStats);

      setCustomers(customersWithStats);
      calculateStats(customersWithStats);

    } catch (error: any) {
      console.error('Error loading customers:', error);
      console.error('Error details:', error.message, error.code, error.details);
      message.error(`Failed to load customers: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (customerData: Customer[]) => {
    const now = dayjs();
    const monthStart = now.startOf('month');
    
    const stats: CustomerStats = {
      total_customers: customerData.length,
      active_customers: customerData.filter(c => (c.total_bookings || 0) > 0).length,
      guest_customers: customerData.filter(c => c.is_guest).length,
      new_this_month: customerData.filter(c => dayjs(c.created_at).isAfter(monthStart)).length
    };
    
    setStats(stats);
  };

  const filterCustomers = () => {
    let filtered = customers;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(customer =>
        customer.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (customer.phone && customer.phone.includes(searchTerm)) ||
        (customer.customer_code && customer.customer_code.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Status filter
    if (statusFilter === 'active') {
      filtered = filtered.filter(customer => (customer.total_bookings || 0) > 0);
    } else if (statusFilter === 'inactive') {
      filtered = filtered.filter(customer => (customer.total_bookings || 0) === 0);
    } else if (statusFilter === 'guest') {
      filtered = filtered.filter(customer => customer.is_guest);
    } else if (statusFilter === 'registered') {
      filtered = filtered.filter(customer => !customer.is_guest);
    }

    // Date range filter
    if (dateRange && dateRange[0] && dateRange[1]) {
      filtered = filtered.filter(customer =>
        dayjs(customer.created_at).isAfter(dateRange[0]) &&
        dayjs(customer.created_at).isBefore(dateRange[1])
      );
    }

    setFilteredCustomers(filtered);
  };

  const handleDelete = async (id: string, customerName: string) => {
    if (!canDeleteCustomers) {
      message.error('You do not have permission to delete customers');
      return;
    }

    confirm({
      title: 'Delete Customer',
      content: `Are you sure you want to delete ${customerName}? This action cannot be undone.`,
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          const { error } = await supabaseClient
            .from('customers')
            .delete()
            .eq('id', id);

          if (error) throw error;

          message.success('Customer deleted successfully');
          setCustomers(customers.filter(customer => customer.id !== id));
        } catch (error: any) {
          console.error('Error deleting customer:', error);
          message.error('Failed to delete customer');
        }
      }
    });
  };

  const exportCustomers = () => {
    const csvContent = [
      ['Name', 'Email', 'Phone', 'Customer Code', 'Type', 'Total Bookings', 'Total Spent', 'Created Date'],
      ...filteredCustomers.map(customer => [
        `${customer.first_name} ${customer.last_name}`,
        customer.email,
        customer.phone || '',
        customer.customer_code || '',
        customer.is_guest ? 'Guest' : 'Registered',
        customer.total_bookings || 0,
        `$${(customer.total_spent || 0).toFixed(2)}`,
        dayjs(customer.created_at).format('YYYY-MM-DD')
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customers_${dayjs().format('YYYY-MM-DD')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const columns = [
    {
      title: 'Customer',
      key: 'customer',
      render: (_: any, record: Customer) => (
        <Space>
          <Avatar 
            size="large" 
            icon={<UserOutlined />}
            style={{ 
              backgroundColor: record.is_guest ? '#faad14' : '#1890ff',
              cursor: 'pointer'
            }}
            onClick={() => show('customers', record.id)}
          />
          <div>
            <div style={{ fontWeight: 'bold' }}>
              {record.first_name} {record.last_name}
              {record.is_guest && (
                <Tag color="gold" style={{ marginLeft: 8 }}>
                  <CrownOutlined /> Guest
                </Tag>
              )}
            </div>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {record.customer_code || 'No Code'}
            </Text>
          </div>
        </Space>
      )
    },
    {
      title: 'Contact',
      key: 'contact',
      render: (_: any, record: Customer) => (
        <div>
          <div style={{ marginBottom: 4 }}>
            <MailOutlined style={{ marginRight: 8, color: '#1890ff' }} />
            <Text copyable={{ text: record.email }}>{record.email}</Text>
          </div>
          {record.phone && (
            <div>
              <PhoneOutlined style={{ marginRight: 8, color: '#52c41a' }} />
              <Text copyable={{ text: record.phone }}>{record.phone}</Text>
            </div>
          )}
        </div>
      )
    },
    {
      title: 'Booking Activity',
      key: 'activity',
      render: (_: any, record: Customer) => (
        <div>
          <div style={{ marginBottom: 4 }}>
            <Badge 
              count={record.total_bookings || 0} 
              showZero 
              style={{ backgroundColor: record.total_bookings ? '#52c41a' : '#d9d9d9' }}
            />
            <Text style={{ marginLeft: 8 }}>Total Bookings</Text>
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            Spent: <Text strong>${(record.total_spent || 0).toFixed(2)}</Text>
          </div>
          {record.latest_booking && (
            <div style={{ fontSize: '12px', color: '#666' }}>
              Last: {record.latest_booking}
            </div>
          )}
        </div>
      )
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => (
        <div>
          <CalendarOutlined style={{ marginRight: 8, color: '#666' }} />
          {dayjs(date).format('MMM DD, YYYY')}
        </div>
      ),
      sorter: (a: Customer, b: Customer) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: Customer) => {
        const items = [
          {
            key: 'view',
            label: 'View Details',
            icon: <EyeOutlined />,
            onClick: () => show('customers', record.id)
          }
        ];

        if (canEditCustomers) {
          items.push({
            key: 'edit',
            label: 'Edit Customer',
            icon: <EditOutlined />,
            onClick: () => edit('customers', record.id)
          });
        }

        if (canDeleteCustomers) {
          items.push({
            key: 'delete',
            label: 'Delete Customer',
            icon: <DeleteOutlined />,
            onClick: () => handleDelete(record.id, `${record.first_name} ${record.last_name}`)
          });
        }

        return (
          <Space>
            <Tooltip title="View Details">
              <Button
                type="text"
                icon={<EyeOutlined />}
                onClick={() => show('customers', record.id)}
              />
            </Tooltip>
            {canEditCustomers && (
              <Tooltip title="Edit Customer">
                <Button
                  type="text"
                  icon={<EditOutlined />}
                  onClick={() => edit('customers', record.id)}
                />
              </Tooltip>
            )}
            {(canDeleteCustomers || items.length > 2) && (
              <Dropdown
                menu={{ items }}
                trigger={['click']}
                placement="bottomRight"
              >
                <Button type="text" icon={<MoreOutlined />} />
              </Dropdown>
            )}
          </Space>
        );
      }
    }
  ];

  return (
    <RoleGuard requiredPermission="canViewCustomers">
      <div style={{ padding: '24px' }}>
        {/* Header */}
        <Card style={{ marginBottom: '24px' }}>
          <Row justify="space-between" align="middle">
            <Col>
              <Title level={2} style={{ margin: 0 }}>
                <TeamOutlined style={{ marginRight: 16, color: '#1890ff' }} />
                Customer Management
              </Title>
              <Text type="secondary">Manage customer profiles and booking history</Text>
            </Col>
            <Col>
              <Space>
                <Button 
                  icon={<ReloadOutlined />} 
                  onClick={loadCustomers}
                  loading={loading}
                >
                  Refresh
                </Button>
                <Button
                  icon={<ExportOutlined />}
                  onClick={exportCustomers}
                  disabled={filteredCustomers.length === 0}
                >
                  Export CSV
                </Button>
                {canCreateCustomers && (
                  <Button
                    type="primary"
                    icon={<UserAddOutlined />}
                    onClick={() => create('customers')}
                    size="large"
                  >
                    Add Customer
                  </Button>
                )}
              </Space>
            </Col>
          </Row>
        </Card>

        {/* Statistics Cards */}
        <Row gutter={16} style={{ marginBottom: '24px' }}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Total Customers"
                value={stats.total_customers}
                prefix={<TeamOutlined style={{ color: '#1890ff' }} />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Active Customers"
                value={stats.active_customers}
                prefix={<UserOutlined style={{ color: '#52c41a' }} />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Guest Accounts"
                value={stats.guest_customers}
                prefix={<CrownOutlined style={{ color: '#faad14' }} />}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="New This Month"
                value={stats.new_this_month}
                prefix={<CalendarOutlined style={{ color: '#722ed1' }} />}
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
        </Row>

        {/* Filters */}
        <Card style={{ marginBottom: '24px' }}>
          <Row gutter={16} align="middle">
            <Col xs={24} sm={12} lg={8}>
              <Input
                placeholder="Search customers by name, email, phone, or customer code..."
                prefix={<SearchOutlined />}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                allowClear
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Select
                placeholder="Filter by status"
                style={{ width: '100%' }}
                value={statusFilter}
                onChange={setStatusFilter}
                allowClear
              >
                <Option value="all">All Customers</Option>
                <Option value="active">Active (Have Bookings)</Option>
                <Option value="inactive">Inactive (No Bookings)</Option>
                <Option value="registered">Registered</Option>
                <Option value="guest">Guest Accounts</Option>
              </Select>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <RangePicker
                placeholder={['Start Date', 'End Date']}
                style={{ width: '100%' }}
                value={dateRange}
                onChange={(dates) => setDateRange(dates)}
                allowClear
              />
            </Col>
            <Col xs={24} sm={12} lg={4}>
              <Text type="secondary">
                <FilterOutlined /> {filteredCustomers.length} of {customers.length} customers
              </Text>
            </Col>
          </Row>
        </Card>

        {/* Table */}
        <Card>
          <Table
            dataSource={filteredCustomers}
            columns={columns}
            loading={loading}
            rowKey="id"
            pagination={{
              total: filteredCustomers.length,
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => 
                `${range[0]}-${range[1]} of ${total} customers`,
            }}
            locale={{
              emptyText: filteredCustomers.length === 0 && customers.length > 0 ? (
                <Empty
                  description="No customers match your search criteria"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              ) : (
                <Empty
                  description="No customers found. Create your first customer to get started."
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              )
            }}
          />
        </Card>
      </div>
    </RoleGuard>
  );
};

export default CustomerList;