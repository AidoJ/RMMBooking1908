import React, { useState, useEffect } from 'react';
import {
  Table,
  Card,
  Button,
  Input,
  Space,
  Tag,
  message,
  Avatar,
  Tooltip,
  Select,
  Row,
  Col,
  Typography,
  Statistic,
  Rate,
  Popconfirm,
  Modal
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  SearchOutlined,
  EyeOutlined,
  DeleteOutlined,
  UserOutlined,
  PhoneOutlined,
  MailOutlined,
  EnvironmentOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  StarOutlined
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
  short_description?: string;
}

interface TherapistProfile {
  id: string;
  user_id?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  profile_pic?: string;
  home_address?: string;
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
  services?: Service[];
  total_bookings?: number;
}

const TherapistList: React.FC = () => {
  const [therapists, setTherapists] = useState<TherapistProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [genderFilter, setGenderFilter] = useState<string>('all');
  const { data: identity } = useGetIdentity<any>();
  const { edit, create, show } = useNavigation();

  const canCreateTherapists = identity?.role === 'admin' || identity?.role === 'super_admin';
  const canEditTherapists = identity?.role === 'admin' || identity?.role === 'super_admin';
  const canDeleteTherapists = identity?.role === 'super_admin';

  useEffect(() => {
    loadTherapists();
  }, []);

  const loadTherapists = async () => {
    try {
      setLoading(true);
      
      // First get therapists with their basic info
      const { data: therapistData, error: therapistError } = await supabaseClient
        .from('therapist_profiles')
        .select('*')
        .order('first_name', { ascending: true });

      if (therapistError) throw therapistError;

      // Then get their services
      const { data: servicesData, error: servicesError } = await supabaseClient
        .from('therapist_services')
        .select(`
          therapist_id,
          services!inner(id, name, short_description)
        `);

      if (servicesError) throw servicesError;

      // Get booking counts for each therapist
      const { data: bookingData, error: bookingError } = await supabaseClient
        .from('bookings')
        .select('therapist_id')
        .eq('status', 'completed');

      if (bookingError) throw bookingError;

      // Process the data
      const therapistsWithServices = therapistData?.map(therapist => {
        // Get services for this therapist
        const therapistServices = servicesData?.filter(
          ts => ts.therapist_id === therapist.id
        ).map(ts => ts.services) || [];

        // Get booking count for this therapist
        const totalBookings = bookingData?.filter(
          booking => booking.therapist_id === therapist.id
        ).length || 0;

        return {
          ...therapist,
          services: therapistServices,
          total_bookings: totalBookings
        };
      }) || [];

      setTherapists(therapistsWithServices);
    } catch (error: any) {
      console.error('Error loading therapists:', error);
      message.error('Failed to load therapists');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTherapist = async (id: string) => {
    try {
      // Find the therapist to check if they have a linked user account
      const therapist = therapists.find(t => t.id === id);
      if (!therapist) {
        message.error('Therapist not found');
        return;
      }

      // If therapist has a linked user account, show modal to ask about deleting it
      if (therapist.user_id) {
        Modal.confirm({
          title: 'Delete Therapist and User Account?',
          content: (
            <div>
              <p>This therapist has a linked user account.</p>
              <p><strong>Do you want to delete both the therapist profile AND the user account?</strong></p>
              <ul style={{ marginTop: 12 }}>
                <li><strong>Delete Both:</strong> Removes therapist profile and user login access</li>
                <li><strong>Delete Therapist Only:</strong> Removes therapist profile but keeps user account (they can still login but won't have therapist access)</li>
              </ul>
            </div>
          ),
          okText: 'Delete Both',
          cancelText: 'Delete Therapist Only',
          okButtonProps: { danger: true },
          cancelButtonProps: { danger: true },
          onOk: async () => {
            // Delete both therapist profile AND user account
            await deleteTherapistAndUser(id, therapist.user_id);
          },
          onCancel: async () => {
            // Delete only therapist profile
            await deleteTherapistOnly(id);
          }
        });
      } else {
        // No user account linked, just delete therapist
        Modal.confirm({
          title: 'Delete Therapist?',
          content: `Are you sure you want to delete ${therapist.first_name} ${therapist.last_name}? This therapist has no linked user account.`,
          okText: 'Yes, Delete',
          cancelText: 'Cancel',
          okButtonProps: { danger: true },
          onOk: async () => {
            await deleteTherapistOnly(id);
          }
        });
      }
    } catch (error: any) {
      console.error('Error in handleDeleteTherapist:', error);
      message.error('Failed to process deletion');
    }
  };

  const deleteTherapistOnly = async (therapistId: string) => {
    try {
      const { error } = await supabaseClient
        .from('therapist_profiles')
        .delete()
        .eq('id', therapistId);

      if (error) throw error;

      setTherapists(therapists.filter(t => t.id !== therapistId));
      message.success('Therapist profile deleted successfully');
    } catch (error: any) {
      console.error('Error deleting therapist:', error);
      message.error('Failed to delete therapist profile');
    }
  };

  const deleteTherapistAndUser = async (therapistId: string, userId: string) => {
    try {
      // Delete therapist profile first
      const { error: therapistError } = await supabaseClient
        .from('therapist_profiles')
        .delete()
        .eq('id', therapistId);

      if (therapistError) throw therapistError;

      // Then delete user account
      const { error: userError } = await supabaseClient
        .from('admin_users')
        .delete()
        .eq('id', userId);

      if (userError) {
        console.error('Error deleting user account:', userError);
        message.warning('Therapist profile deleted, but failed to delete user account');
      } else {
        message.success('Therapist profile and user account deleted successfully');
      }

      setTherapists(therapists.filter(t => t.id !== therapistId));
    } catch (error: any) {
      console.error('Error deleting therapist and user:', error);
      message.error('Failed to delete therapist and user');
    }
  };

  const getFilteredTherapists = () => {
    let filtered = therapists;

    // Filter by search text
    if (searchText) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter(therapist => 
        `${therapist.first_name} ${therapist.last_name}`.toLowerCase().includes(searchLower) ||
        therapist.email.toLowerCase().includes(searchLower) ||
        therapist.phone?.toLowerCase().includes(searchLower) ||
        therapist.services?.some(service => 
          service.name.toLowerCase().includes(searchLower)
        )
      );
    }

    // Filter by status
    if (statusFilter !== 'all') {
      const isActive = statusFilter === 'active';
      filtered = filtered.filter(therapist => therapist.is_active === isActive);
    }

    // Filter by gender
    if (genderFilter !== 'all') {
      filtered = filtered.filter(therapist => therapist.gender === genderFilter);
    }

    return filtered;
  };

  const columns = [
    {
      title: 'Therapist',
      key: 'therapist',
      render: (record: TherapistProfile) => (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Avatar
            size={48}
            src={record.profile_pic}
            icon={<UserOutlined />}
            style={{ marginRight: '12px' }}
          />
          <div>
            <div>
              <Text strong style={{ fontSize: '14px' }}>
                {record.first_name} {record.last_name}
              </Text>
              {record.address_verified && (
                <CheckCircleOutlined 
                  style={{ color: '#52c41a', marginLeft: '8px' }} 
                  title="Address Verified"
                />
              )}
            </div>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
              <MailOutlined style={{ marginRight: '4px' }} />{record.email}
            </div>
            {record.phone && (
              <div style={{ fontSize: '12px', color: '#666' }}>
                <PhoneOutlined style={{ marginRight: '4px' }} />{record.phone}
              </div>
            )}
          </div>
        </div>
      ),
      sorter: (a: TherapistProfile, b: TherapistProfile) => 
        `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`),
    },
    {
      title: 'Services Offered',
      key: 'services',
      width: 200,
      render: (record: TherapistProfile) => (
        <div>
          {record.services?.length ? (
            <Space direction="vertical" size={2}>
              {record.services.slice(0, 3).map(service => (
                <Tag key={service.id} color="blue" style={{ margin: 0 }}>
                  {service.name}
                </Tag>
              ))}
              {record.services.length > 3 && (
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  +{record.services.length - 3} more
                </Text>
              )}
            </Space>
          ) : (
            <Text type="secondary" style={{ fontSize: '12px' }}>No services assigned</Text>
          )}
        </div>
      ),
    },
    {
      title: 'Performance',
      key: 'performance',
      width: 120,
      render: (record: TherapistProfile) => (
        <div>
          <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
            {record.total_bookings || 0} bookings
          </div>
          <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
            <Rate
              disabled
              allowHalf
              value={record.rating}
              style={{ fontSize: '12px' }}
            />
            <span style={{ marginLeft: '4px' }}>
              ({record.total_reviews})
            </span>
          </div>
          {record.years_experience && (
            <div style={{ fontSize: '12px', color: '#666' }}>
              {record.years_experience} years exp.
            </div>
          )}
        </div>
      ),
      sorter: (a: TherapistProfile, b: TherapistProfile) => 
        (b.total_bookings || 0) - (a.total_bookings || 0),
    },
    {
      title: 'Location & Coverage',
      key: 'location',
      width: 150,
      render: (record: TherapistProfile) => (
        <div>
          {record.home_address && (
            <div style={{ fontSize: '12px', color: '#666' }}>
              <EnvironmentOutlined style={{ marginRight: '4px' }} />
              {record.home_address.split(',')[0]}
            </div>
          )}
          {record.service_radius_km && (
            <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
              Radius: {record.service_radius_km}km
            </div>
          )}
          {record.gender && (
            <Tag color="purple" style={{ marginTop: '4px', fontSize: '10px' }}>
              {record.gender}
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: 100,
      render: (record: TherapistProfile) => (
        <div>
          <Tag color={record.is_active ? 'green' : 'red'}>
            {record.is_active ? 'Active' : 'Inactive'}
          </Tag>
          <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
            {new Date(record.created_at).toLocaleDateString()}
          </div>
        </div>
      ),
      filters: [
        { text: 'Active', value: true },
        { text: 'Inactive', value: false },
      ],
      onFilter: (value: any, record: TherapistProfile) => record.is_active === value,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (record: TherapistProfile) => (
        <Space>
          <Tooltip title="View Details">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => show('therapist_profiles', record.id)}
            />
          </Tooltip>
          {canEditTherapists && (
            <Tooltip title="Edit Therapist">
              <Button
                type="text"
                icon={<EditOutlined />}
                onClick={() => edit('therapist_profiles', record.id)}
              />
            </Tooltip>
          )}
          {canDeleteTherapists && (
            <Popconfirm
              title="Delete Therapist"
              description="Are you sure you want to delete this therapist? This action cannot be undone."
              onConfirm={() => handleDeleteTherapist(record.id)}
              okText="Yes, Delete"
              cancelText="Cancel"
              okButtonProps={{ danger: true }}
            >
              <Tooltip title="Delete Therapist">
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

  return (
    <RoleGuard requiredPermission="canViewAllTherapists">
      <div style={{ padding: '24px' }}>
        <Card>
          <div style={{ marginBottom: '24px' }}>
            <Row gutter={16} align="middle">
              <Col flex="auto">
                <Title level={2} style={{ margin: 0 }}>
                  Therapist Management
                </Title>
                <Text type="secondary">
                  Manage therapist profiles, services, and performance
                </Text>
              </Col>
              <Col>
                {canCreateTherapists && (
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => create('therapist_profiles')}
                    size="large"
                  >
                    Add New Therapist
                  </Button>
                )}
              </Col>
            </Row>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <Row gutter={16}>
              <Col span={10}>
                <Search
                  placeholder="Search therapists by name, email, phone, or services..."
                  allowClear
                  enterButton={<SearchOutlined />}
                  size="large"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
              </Col>
              <Col span={4}>
                <Select
                  placeholder="Filter by status"
                  value={statusFilter}
                  onChange={setStatusFilter}
                  size="large"
                  style={{ width: '100%' }}
                >
                  <Option value="all">All Status</Option>
                  <Option value="active">Active Only</Option>
                  <Option value="inactive">Inactive Only</Option>
                </Select>
              </Col>
              <Col span={4}>
                <Select
                  placeholder="Filter by gender"
                  value={genderFilter}
                  onChange={setGenderFilter}
                  size="large"
                  style={{ width: '100%' }}
                >
                  <Option value="all">All Genders</Option>
                  <Option value="male">Male</Option>
                  <Option value="female">Female</Option>
                  <Option value="other">Other</Option>
                </Select>
              </Col>
              <Col span={6}>
                <Button
                  onClick={loadTherapists}
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
                  title="Total Therapists"
                  value={therapists.length}
                  prefix={<UserOutlined style={{ color: '#1890ff' }} />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="Active Therapists"
                  value={therapists.filter(t => t.is_active).length}
                  prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="Total Completed Bookings"
                  value={therapists.reduce((sum, t) => sum + (t.total_bookings || 0), 0)}
                  prefix={<span style={{ color: '#fa8c16' }}>📋</span>}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="Avg Rating"
                  value={therapists.length > 0 
                    ? (therapists.reduce((sum, t) => sum + t.rating, 0) / therapists.length).toFixed(1)
                    : '0.0'
                  }
                  prefix={<StarOutlined style={{ color: '#faad14' }} />}
                />
              </Card>
            </Col>
          </Row>

          <Table
            dataSource={getFilteredTherapists()}
            columns={columns}
            rowKey="id"
            loading={loading}
            size="small"
            pagination={{
              total: getFilteredTherapists().length,
              pageSize: 15,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) =>
                `${range[0]}-${range[1]} of ${total} therapists`,
            }}
            scroll={{ x: 1000 }}
          />
        </Card>
      </div>
    </RoleGuard>
  );
};

export default TherapistList;