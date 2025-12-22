import React, { useState, useEffect } from 'react';
import {
  Table,
  Card,
  Button,
  Input,
  Space,
  Tag,
  message,
  Select,
  Row,
  Col,
  Typography,
  Statistic,
  Tooltip,
  Badge,
  Modal
} from 'antd';
import {
  EyeOutlined,
  SearchOutlined,
  UserAddOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  CalendarOutlined
} from '@ant-design/icons';
import { useGetIdentity, useNavigation } from '@refinedev/core';
import { RoleGuard } from '../../components/RoleGuard';
import { supabaseClient } from '../../utility';
import dayjs from 'dayjs';

const { Search } = Input;
const { Option } = Select;
const { Text, Title } = Typography;

interface TherapistRegistration {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  status: string;
  recruitment_status?: string;
  business_structure: string;
  business_abn: string;
  service_cities: string[];
  therapies_offered: string[];
  has_insurance: boolean;
  has_first_aid: boolean;
  submitted_at?: string;
  created_at: string;
  updated_at: string;
  therapist_profile_id?: string;
}

const TherapistRegistrationList: React.FC = () => {
  const [registrations, setRegistrations] = useState<TherapistRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [recruitmentFilter, setRecruitmentFilter] = useState<string>('all');
  const [stats, setStats] = useState({
    total: 0,
    submitted: 0,
    underReview: 0,
    inRecruitment: 0,
    approved: 0,
    enrolled: 0
  });

  const { data: identity } = useGetIdentity<any>();
  const { show } = useNavigation();

  const canManageRegistrations = identity?.role === 'admin' || identity?.role === 'super_admin';

  useEffect(() => {
    loadRegistrations();
  }, []);

  const loadRegistrations = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabaseClient
        .from('therapist_registrations')
        .select('*')
        .order('submitted_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      setRegistrations(data || []);
      calculateStats(data || []);
    } catch (error: any) {
      console.error('Error loading registrations:', error);
      message.error('Failed to load registrations');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (data: TherapistRegistration[]) => {
    setStats({
      total: data.length,
      submitted: data.filter(r => r.status === 'submitted').length,
      underReview: data.filter(r => r.status === 'under_review').length,
      inRecruitment: data.filter(r => r.status === 'in_recruitment').length,
      approved: data.filter(r => r.status === 'approved').length,
      enrolled: data.filter(r => r.status === 'enrolled').length
    });
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'default',
      submitted: 'blue',
      under_review: 'orange',
      in_recruitment: 'purple',
      approved: 'green',
      rejected: 'red',
      enrolled: 'success'
    };
    return colors[status] || 'default';
  };

  const getRecruitmentColor = (status: string) => {
    const colors: Record<string, string> = {
      '1st_interview': 'blue',
      '2nd_interview': 'cyan',
      'accepted': 'green',
      'declined': 'red',
      'postponed': 'orange'
    };
    return colors[status] || 'default';
  };

  const formatRecruitmentStatus = (status: string) => {
    const labels: Record<string, string> = {
      '1st_interview': '1st Interview',
      '2nd_interview': '2nd Interview',
      'accepted': 'Accepted',
      'declined': 'Declined',
      'postponed': 'Postponed'
    };
    return labels[status] || status;
  };

  const filteredRegistrations = registrations.filter(reg => {
    const matchesSearch =
      reg.first_name.toLowerCase().includes(searchText.toLowerCase()) ||
      reg.last_name.toLowerCase().includes(searchText.toLowerCase()) ||
      reg.email.toLowerCase().includes(searchText.toLowerCase()) ||
      reg.phone?.includes(searchText);

    const matchesStatus = statusFilter === 'all' || reg.status === statusFilter;
    const matchesRecruitment = recruitmentFilter === 'all' || reg.recruitment_status === recruitmentFilter;

    return matchesSearch && matchesStatus && matchesRecruitment;
  });

  const columns = [
    {
      title: 'Name',
      key: 'name',
      render: (_: any, record: TherapistRegistration) => (
        <Space direction="vertical" size={0}>
          <Text strong>{`${record.first_name} ${record.last_name}`}</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.email}
          </Text>
        </Space>
      ),
      sorter: (a: TherapistRegistration, b: TherapistRegistration) =>
        a.first_name.localeCompare(b.first_name),
    },
    {
      title: 'Contact',
      dataIndex: 'phone',
      key: 'phone',
      render: (phone: string) => (
        <Text copyable>{phone}</Text>
      ),
    },
    {
      title: 'Business',
      key: 'business',
      render: (_: any, record: TherapistRegistration) => (
        <Space direction="vertical" size={0}>
          <Text>{record.business_structure === 'sole_trader' ? 'Sole Trader' : 'Pty Ltd'}</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>ABN: {record.business_abn}</Text>
        </Space>
      ),
    },
    {
      title: 'Services',
      key: 'services',
      render: (_: any, record: TherapistRegistration) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: '12px' }}>
            {record.service_cities?.join(', ') || 'N/A'}
          </Text>
          <Text type="secondary" style={{ fontSize: '11px' }}>
            {record.therapies_offered?.length || 0} therapies
          </Text>
        </Space>
      ),
    },
    {
      title: 'Compliance',
      key: 'compliance',
      align: 'center' as const,
      render: (_: any, record: TherapistRegistration) => (
        <Space>
          <Tooltip title={record.has_insurance ? 'Insurance: Yes' : 'Insurance: No'}>
            {record.has_insurance ? (
              <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />
            ) : (
              <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 18 }} />
            )}
          </Tooltip>
          <Tooltip title={record.has_first_aid ? 'First Aid: Yes' : 'First Aid: No'}>
            {record.has_first_aid ? (
              <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />
            ) : (
              <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 18 }} />
            )}
          </Tooltip>
        </Space>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      render: (_: any, record: TherapistRegistration) => (
        <Space direction="vertical" size={4}>
          <Tag color={getStatusColor(record.status)}>
            {record.status.replace('_', ' ').toUpperCase()}
          </Tag>
          {record.recruitment_status && (
            <Tag color={getRecruitmentColor(record.recruitment_status)} style={{ fontSize: '11px' }}>
              {formatRecruitmentStatus(record.recruitment_status)}
            </Tag>
          )}
        </Space>
      ),
      sorter: (a: TherapistRegistration, b: TherapistRegistration) =>
        a.status.localeCompare(b.status),
    },
    {
      title: 'Submitted',
      dataIndex: 'submitted_at',
      key: 'submitted_at',
      render: (date: string) => date ? dayjs(date).format('MMM D, YYYY') : '-',
      sorter: (a: TherapistRegistration, b: TherapistRegistration) => {
        if (!a.submitted_at) return 1;
        if (!b.submitted_at) return -1;
        return new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime();
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'center' as const,
      render: (_: any, record: TherapistRegistration) => (
        <Space>
          <Tooltip title="View Details">
            <Button
              type="link"
              icon={<EyeOutlined />}
              onClick={() => show('therapist-registrations', record.id)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <RoleGuard allowedRoles={['admin', 'super_admin']}>
      <div style={{ padding: '24px' }}>
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col span={24}>
            <Title level={2}>
              <UserAddOutlined style={{ marginRight: 8 }} />
              Therapist Registrations
            </Title>
          </Col>
        </Row>

        {/* Statistics */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} md={8} lg={4}>
            <Card>
              <Statistic
                title="Total Registrations"
                value={stats.total}
                prefix={<FileTextOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8} lg={4}>
            <Card>
              <Statistic
                title="Submitted"
                value={stats.submitted}
                prefix={<ClockCircleOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8} lg={4}>
            <Card>
              <Statistic
                title="Under Review"
                value={stats.underReview}
                prefix={<FileTextOutlined />}
                valueStyle={{ color: '#fa8c16' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8} lg={4}>
            <Card>
              <Statistic
                title="In Recruitment"
                value={stats.inRecruitment}
                prefix={<CalendarOutlined />}
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8} lg={4}>
            <Card>
              <Statistic
                title="Approved"
                value={stats.approved}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8} lg={4}>
            <Card>
              <Statistic
                title="Enrolled"
                value={stats.enrolled}
                prefix={<UserAddOutlined />}
                valueStyle={{ color: '#13c2c2' }}
              />
            </Card>
          </Col>
        </Row>

        {/* Filters */}
        <Card style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Search
                placeholder="Search by name, email, or phone"
                allowClear
                onSearch={(value) => setSearchText(value)}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ width: '100%' }}
              />
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Select
                style={{ width: '100%' }}
                placeholder="Filter by Status"
                value={statusFilter}
                onChange={(value) => setStatusFilter(value)}
              >
                <Option value="all">All Statuses</Option>
                <Option value="draft">Draft</Option>
                <Option value="submitted">Submitted</Option>
                <Option value="under_review">Under Review</Option>
                <Option value="in_recruitment">In Recruitment</Option>
                <Option value="approved">Approved</Option>
                <Option value="rejected">Rejected</Option>
                <Option value="enrolled">Enrolled</Option>
              </Select>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Select
                style={{ width: '100%' }}
                placeholder="Filter by Recruitment Status"
                value={recruitmentFilter}
                onChange={(value) => setRecruitmentFilter(value)}
              >
                <Option value="all">All Recruitment Statuses</Option>
                <Option value="1st_interview">1st Interview</Option>
                <Option value="2nd_interview">2nd Interview</Option>
                <Option value="accepted">Accepted</Option>
                <Option value="declined">Declined</Option>
                <Option value="postponed">Postponed</Option>
              </Select>
            </Col>
          </Row>
        </Card>

        {/* Table */}
        <Card>
          <Table
            dataSource={filteredRegistrations}
            columns={columns}
            rowKey="id"
            loading={loading}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} registrations`,
            }}
          />
        </Card>
      </div>
    </RoleGuard>
  );
};

export default TherapistRegistrationList;
