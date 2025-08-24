import React, { useState, useEffect } from 'react';
import {
  Table,
  Card,
  Button,
  Input,
  Space,
  Tag,
  message,
  Switch,
  Tooltip,
  Select,
  Row,
  Col,
  Image,
  Typography,
  Statistic,
  Popconfirm
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  SearchOutlined,
  DollarOutlined,
  StarOutlined,
  EyeOutlined,
  DeleteOutlined,
  FileImageOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';
import { useGetIdentity, useNavigation } from '@refinedev/core';
import { RoleGuard } from '../../components/RoleGuard';
import { supabaseClient } from '../../utility';

const { Search } = Input;
const { Option } = Select;
const { Text, Title } = Typography;

interface Service {
  id: string;
  name: string;
  description?: string;
  short_description?: string;
  image_url?: string;
  image_alt?: string;
  is_active: boolean;
  sort_order: number;
  service_base_price: number;
  minimum_duration: number;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  popularity_score: number;
  total_bookings: number;
  average_rating: number;
  quote_only?: boolean;
}

interface ServiceWithCreator extends Service {
  creator?: {
    first_name: string;
    last_name: string;
  };
}

const ServiceList: React.FC = () => {
  const [services, setServices] = useState<ServiceWithCreator[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { data: identity } = useGetIdentity<any>();
  const { edit, create, show } = useNavigation();

  const canCreateServices = identity?.role === 'admin' || identity?.role === 'super_admin';
  const canEditServices = identity?.role === 'admin' || identity?.role === 'super_admin';
  const canDeleteServices = identity?.role === 'super_admin'; // Only super admin can delete

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabaseClient
        .from('services')
        .select(`
          *,
          creator:admin_users!services_created_by_fkey(first_name, last_name)
        `)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      setServices(data || []);
    } catch (error: any) {
      console.error('Error loading services:', error);
      message.error('Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabaseClient
        .from('services')
        .update({ 
          is_active: !currentStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      // Update local state
      setServices(services.map(service => 
        service.id === id 
          ? { ...service, is_active: !currentStatus }
          : service
      ));

      message.success(`Service ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
    } catch (error: any) {
      console.error('Error updating service status:', error);
      message.error('Failed to update service status');
    }
  };

  const handleToggleQuoteOnly = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabaseClient
        .from('services')
        .update({ 
          quote_only: !currentStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
      
      if (error) throw error;
      
      // Update local state
      setServices(services.map(service => 
        service.id === id 
          ? { ...service, quote_only: !currentStatus }
          : service
      ));
      
      message.success(`Service marked as ${!currentStatus ? 'Quote Only' : 'Regular Booking'} successfully`);
    } catch (error: any) {
      console.error('Error toggling quote only status:', error);
      message.error('Failed to update quote only status');
    }
  };

  const handleDeleteService = async (id: string) => {
    try {
      const { error } = await supabaseClient
        .from('services')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setServices(services.filter(service => service.id !== id));
      message.success('Service deleted successfully');
    } catch (error: any) {
      console.error('Error deleting service:', error);
      message.error('Failed to delete service');
    }
  };

  const getFilteredServices = () => {
    let filtered = services;

    // Filter by search text
    if (searchText) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter(service => 
        service.name.toLowerCase().includes(searchLower) ||
        service.description?.toLowerCase().includes(searchLower) ||
        service.short_description?.toLowerCase().includes(searchLower)
      );
    }

    // Filter by status
    if (statusFilter !== 'all') {
      const isActive = statusFilter === 'active';
      filtered = filtered.filter(service => service.is_active === isActive);
    }

    return filtered;
  };

  const columns = [
    {
      title: 'Service',
      key: 'service',
      render: (record: ServiceWithCreator) => (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ width: '40px', height: '40px', marginRight: '12px' }}>
            {record.image_url ? (
              <Image
                src={record.image_url}
                alt={record.image_alt || record.name}
                width={40}
                height={40}
                style={{ borderRadius: '6px', objectFit: 'cover' }}
                fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMIAAADDCAYAAADQvc6UAAABRWlDQ1BJQ0MgUHJvZmlsZQAAKJFjYGASSSwoyGFhYGDIzSspCnJ3UoiIjFJgf8LAwSDCIMogwMCcmFxc4BgQ4ANUwgCjUcG3awyMIPqyLsis7PPOq3QdDFcvjV3jOD1boQVTPQrgSkktTgbSf4A4LbmgqISBgTEFyFYuLykAsTuAbJEioKOA7DkgdjqEvQHEToKwj4DVhAQ5A9k3gGyB5IxEoBmML4BsnSQk8XQkNtReEOBxcfXxUQg1Mjc0dyHgXNJBSWpFCYh2zi+oLMpMzyhRcASGUqqCZ16yno6CkYGRAQMDKMwhqj/fAIcloxgHQqxAjIHBEugw5sUIsSQpBobtQPdLciLEVJYzMPBHMDBsayhILEqEO4DxG0txmrERhM29nYGBddr//5/DGRjYNRkY/l7////39v///y4Dmn+LgeHANwDrkl1AuO+pmgAAADhlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAAqACAAQAAAABAAAAwqADAAQAAAABAAAAwwAAAAD9b/HnAAAHlklEQVR4Ae3dP3Ik1RnG4W+FvRvYhIAI..."
                preview={false}
              />
            ) : (
              <div 
                style={{ 
                  width: '40px', 
                  height: '40px', 
                  backgroundColor: '#f5f5f5', 
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <FileImageOutlined style={{ fontSize: '16px', color: '#bbb' }} />
              </div>
            )}
          </div>
          <div>
            <Text strong style={{ fontSize: '14px' }}>{record.name}</Text>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
              <DollarOutlined style={{ marginRight: '4px' }} />${record.service_base_price}
              <span style={{ margin: '0 8px', color: '#d9d9d9' }}>•</span>
              <ClockCircleOutlined style={{ marginRight: '4px' }} />{record.minimum_duration}min
            </div>
          </div>
        </div>
      ),
      sorter: (a: ServiceWithCreator, b: ServiceWithCreator) => a.name.localeCompare(b.name),
    },
    {
      title: 'Performance',
      key: 'performance',
      width: 120,
      render: (record: ServiceWithCreator) => (
        <div>
          <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
            {record.total_bookings} bookings
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            <StarOutlined style={{ color: '#faad14', marginRight: '4px' }} />
            {record.average_rating > 0 ? record.average_rating.toFixed(1) : 'No rating'}
          </div>
        </div>
      ),
      sorter: (a: ServiceWithCreator, b: ServiceWithCreator) => b.total_bookings - a.total_bookings,
    },
    {
      title: 'Details',
      key: 'details',
      width: 150,
      render: (record: ServiceWithCreator) => (
        <div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            Order: {record.sort_order}
          </div>
          {record.created_at && (
            <div style={{ fontSize: '12px', color: '#999' }}>
              {new Date(record.created_at).toLocaleDateString()}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: 100,
      render: (record: ServiceWithCreator) => (
        <div>
          <Tag color={record.is_active ? 'green' : 'red'}>
            {record.is_active ? 'Active' : 'Inactive'}
          </Tag>
          {canEditServices && (
            <div style={{ marginTop: '4px' }}>
              <Switch
                size="small"
                checked={record.is_active}
                onChange={() => handleToggleActive(record.id, record.is_active)}
              />
            </div>
          )}
        </div>
      ),
      filters: [
        { text: 'Active', value: true },
        { text: 'Inactive', value: false },
      ],
      onFilter: (value: any, record: ServiceWithCreator) => record.is_active === value,
    },
    {
      title: 'Quote Only',
      key: 'quote_only',
      width: 120,
      render: (record: ServiceWithCreator) => (
        <div>
          <Tag color={record.quote_only ? 'purple' : 'blue'}>
            {record.quote_only ? 'Quote Only' : 'Regular'}
          </Tag>
          {canEditServices && (
            <div style={{ marginTop: '4px' }}>
              <Switch
                size="small"
                checked={record.quote_only || false}
                onChange={() => handleToggleQuoteOnly(record.id, record.quote_only || false)}
              />
            </div>
          )}
        </div>
      ),
      filters: [
        { text: 'Quote Only', value: true },
        { text: 'Regular Booking', value: false },
      ],
      onFilter: (value: any, record: ServiceWithCreator) => (record.quote_only || false) === value,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (record: ServiceWithCreator) => (
        <Space>
          <Tooltip title="View Details">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => show('services', record.id)}
            />
          </Tooltip>
          {canEditServices && (
            <Tooltip title="Edit Service">
              <Button
                type="text"
                icon={<EditOutlined />}
                onClick={() => edit('services', record.id)}
              />
            </Tooltip>
          )}
          {canDeleteServices && (
            <Popconfirm
              title="Delete Service"
              description="Are you sure you want to delete this service? This action cannot be undone."
              onConfirm={() => handleDeleteService(record.id)}
              okText="Yes, Delete"
              cancelText="Cancel"
              okButtonProps={{ danger: true }}
            >
              <Tooltip title="Delete Service">
                <Button
                  type="text"
                  icon={<DeleteOutlined />}
                />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  // Show access denied for therapists
  if (identity?.role === 'therapist') {
    return (
      <div style={{ padding: '24px' }}>
        <Card>
          <div style={{ textAlign: 'center', padding: '60px 24px' }}>
            <div style={{ fontSize: '64px', marginBottom: '24px' }}>🚫</div>
            <Title level={2} style={{ color: '#ff4d4f' }}>Access Denied</Title>
            <Text type="secondary" style={{ fontSize: '16px' }}>
              You don't have permission to access the Services management page.
            </Text>
            <div style={{ marginTop: '16px' }}>
              <Text type="secondary">
                Contact your administrator if you need access to this feature.
              </Text>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <RoleGuard requiredPermission="canViewServices">
      <div style={{ padding: '24px' }}>
        <Card>
          <div style={{ marginBottom: '24px' }}>
            <Row gutter={16} align="middle">
              <Col flex="auto">
                <Title level={2} style={{ margin: 0 }}>
                  Service Management
                </Title>
                <Text type="secondary">
                  Manage massage services, pricing, and availability
                </Text>
              </Col>
              <Col>
                {canCreateServices && (
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => create('services')}
                    size="large"
                  >
                    Add New Service
                  </Button>
                )}
              </Col>
            </Row>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <Row gutter={16}>
              <Col span={12}>
                <Search
                  placeholder="Search services by name or description..."
                  allowClear
                  enterButton={<SearchOutlined />}
                  size="large"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
              </Col>
              <Col span={6}>
                <Select
                  placeholder="Filter by status"
                  value={statusFilter}
                  onChange={setStatusFilter}
                  size="large"
                  style={{ width: '100%' }}
                >
                  <Option value="all">All Services</Option>
                  <Option value="active">Active Only</Option>
                  <Option value="inactive">Inactive Only</Option>
                </Select>
              </Col>
              <Col span={6}>
                <Button
                  onClick={loadServices}
                  size="large"
                  style={{ width: '100%' }}
                >
                  Refresh
                </Button>
              </Col>
            </Row>
          </div>

          {/* Summary Statistics */}
          <Row gutter={16} style={{ marginBottom: '24px' }}>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="Total Services"
                  value={services.length}
                  prefix={<span style={{ color: '#1890ff' }}>🛍️</span>}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="Active Services"
                  value={services.filter(s => s.is_active).length}
                  prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="Total Bookings"
                  value={services.reduce((sum, s) => sum + s.total_bookings, 0)}
                  prefix={<span style={{ color: '#fa8c16' }}>📋</span>}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="Avg Rating"
                  value={services.length > 0 
                    ? (services.reduce((sum, s) => sum + s.average_rating, 0) / services.length).toFixed(1)
                    : '0.0'
                  }
                  prefix={<StarOutlined style={{ color: '#faad14' }} />}
                />
              </Card>
            </Col>
          </Row>

          <Table
            dataSource={getFilteredServices()}
            columns={columns}
            rowKey="id"
            loading={loading}
            size="small"
            pagination={{
              total: getFilteredServices().length,
              pageSize: 15,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) =>
                `${range[0]}-${range[1]} of ${total} services`,
            }}
            scroll={{ x: 900 }}
          />
        </Card>
      </div>
    </RoleGuard>
  );
};

export default ServiceList;