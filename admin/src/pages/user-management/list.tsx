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
  Popconfirm,
  Switch,
  Modal,
  Form
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  SearchOutlined,
  UserOutlined,
  MailOutlined,
  LockOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  KeyOutlined
} from '@ant-design/icons';
import { useGetIdentity } from '@refinedev/core';
import { RoleGuard } from '../../components/RoleGuard';
import AdminDataService from '../../services/adminDataService';

const { Search } = Input;
const { Option } = Select;
const { Text, Title } = Typography;

interface AdminUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: 'super_admin' | 'admin' | 'therapist';
  is_active: boolean;
  last_login?: string;
  created_at: string;
  failed_login_attempts?: number;
  locked_until?: string;
}

const UserManagementList: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [form] = Form.useForm();
  const { data: identity } = useGetIdentity<any>();

  const isSuperAdmin = identity?.role === 'super_admin';

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await AdminDataService.from('admin_users')
        .select('id, first_name, last_name, email, role, is_active, last_login, created_at, failed_login_attempts, locked_until')
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      setUsers(data || []);
    } catch (error: any) {
      console.error('Error loading users:', error);
      message.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await AdminDataService.from('admin_users')
        .update({ is_active: !currentStatus, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (error) {
        throw new Error(error.message);
      }

      setUsers(users.map(user =>
        user.id === userId ? { ...user, is_active: !currentStatus } : user
      ));
      message.success(`User ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
    } catch (error: any) {
      console.error('Error toggling user status:', error);
      message.error('Failed to update user status');
    }
  };

  const handleUnlockAccount = async (userId: string) => {
    try {
      const { error } = await AdminDataService.from('admin_users')
        .update({
          failed_login_attempts: 0,
          locked_until: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        throw new Error(error.message);
      }

      setUsers(users.map(user =>
        user.id === userId ? { ...user, failed_login_attempts: 0, locked_until: undefined } : user
      ));
      message.success('Account unlocked successfully');
    } catch (error: any) {
      console.error('Error unlocking account:', error);
      message.error('Failed to unlock account');
    }
  };

  const showCreateModal = () => {
    setSelectedUser(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const showEditModal = (user: AdminUser) => {
    setSelectedUser(user);
    form.setFieldsValue({
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      role: user.role,
      is_active: user.is_active
    });
    setIsModalVisible(true);
  };

  const handleSubmit = async (values: any) => {
    try {
      const token = localStorage.getItem('adminToken');

      if (selectedUser) {
        // Edit existing user - use Netlify function
        const response = await fetch('/.netlify/functions/user-management', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            action: 'update',
            data: {
              id: selectedUser.id,
              first_name: values.first_name,
              last_name: values.last_name,
              email: values.email,
              role: values.role,
              is_active: values.is_active
            }
          })
        });

        const result = await response.json();
        if (!result.success) throw new Error(result.error);
        message.success('User updated successfully');
      } else {
        // Create new user - use Netlify function with password hashing
        const response = await fetch('/.netlify/functions/user-management', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            action: 'create',
            data: {
              first_name: values.first_name,
              last_name: values.last_name,
              email: values.email,
              password: values.password,
              role: values.role
            }
          })
        });

        const result = await response.json();
        if (!result.success) throw new Error(result.error);
        message.success('User created successfully');
      }

      setIsModalVisible(false);
      form.resetFields();
      loadUsers();
    } catch (error: any) {
      console.error('Error saving user:', error);
      message.error(error.message || 'Failed to save user');
    }
  };

  const getFilteredUsers = () => {
    let filtered = users;

    if (searchText) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter(user =>
        `${user.first_name} ${user.last_name}`.toLowerCase().includes(searchLower) ||
        user.email.toLowerCase().includes(searchLower)
      );
    }

    if (roleFilter !== 'all') {
      filtered = filtered.filter(user => user.role === roleFilter);
    }

    if (statusFilter !== 'all') {
      const isActive = statusFilter === 'active';
      filtered = filtered.filter(user => user.is_active === isActive);
    }

    return filtered;
  };

  const isAccountLocked = (user: AdminUser) => {
    return user.locked_until && new Date(user.locked_until) > new Date();
  };

  const columns = [
    {
      title: 'User',
      key: 'user',
      render: (record: AdminUser) => (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Avatar
            size={48}
            icon={<UserOutlined />}
            style={{
              marginRight: '12px',
              backgroundColor: record.role === 'super_admin' ? '#722ed1' : record.role === 'admin' ? '#1890ff' : '#52c41a'
            }}
          />
          <div>
            <div>
              <Text strong style={{ fontSize: '14px' }}>
                {record.first_name} {record.last_name}
              </Text>
              {isAccountLocked(record) && (
                <LockOutlined
                  style={{ color: '#ff4d4f', marginLeft: '8px' }}
                  title="Account Locked"
                />
              )}
            </div>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
              <MailOutlined style={{ marginRight: '4px' }} />{record.email}
            </div>
          </div>
        </div>
      ),
      sorter: (a: AdminUser, b: AdminUser) =>
        `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`),
    },
    {
      title: 'Role',
      key: 'role',
      width: 150,
      render: (record: AdminUser) => {
        const roleConfig = {
          super_admin: { color: 'purple', label: 'Super Admin' },
          admin: { color: 'blue', label: 'Admin' },
          therapist: { color: 'green', label: 'Therapist' }
        };
        const config = roleConfig[record.role];
        return <Tag color={config.color}>{config.label}</Tag>;
      },
      sorter: (a: AdminUser, b: AdminUser) => a.role.localeCompare(b.role),
    },
    {
      title: 'Status',
      key: 'status',
      width: 120,
      render: (record: AdminUser) => (
        <div>
          <Tag color={record.is_active ? 'green' : 'red'} icon={record.is_active ? <CheckCircleOutlined /> : <CloseCircleOutlined />}>
            {record.is_active ? 'Active' : 'Inactive'}
          </Tag>
          {isAccountLocked(record) && (
            <Tag color="red" style={{ marginTop: '4px' }}>
              Locked
            </Tag>
          )}
          {record.failed_login_attempts > 0 && !isAccountLocked(record) && (
            <div style={{ fontSize: '11px', color: '#ff7875', marginTop: '4px' }}>
              {record.failed_login_attempts} failed attempts
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Last Login',
      key: 'last_login',
      width: 150,
      render: (record: AdminUser) => (
        <div style={{ fontSize: '12px' }}>
          {record.last_login ? (
            <>
              <div>{new Date(record.last_login).toLocaleDateString()}</div>
              <div style={{ color: '#999' }}>{new Date(record.last_login).toLocaleTimeString()}</div>
            </>
          ) : (
            <Text type="secondary">Never</Text>
          )}
        </div>
      ),
      sorter: (a: AdminUser, b: AdminUser) => {
        if (!a.last_login) return 1;
        if (!b.last_login) return -1;
        return new Date(b.last_login).getTime() - new Date(a.last_login).getTime();
      },
    },
    {
      title: 'Created',
      key: 'created_at',
      width: 120,
      render: (record: AdminUser) => (
        <div style={{ fontSize: '12px', color: '#666' }}>
          {new Date(record.created_at).toLocaleDateString()}
        </div>
      ),
      sorter: (a: AdminUser, b: AdminUser) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 180,
      render: (record: AdminUser) => (
        <Space>
          {isSuperAdmin && (
            <>
              <Tooltip title={record.is_active ? 'Deactivate' : 'Activate'}>
                <Switch
                  checked={record.is_active}
                  onChange={() => handleToggleActive(record.id, record.is_active)}
                  size="small"
                />
              </Tooltip>
              <Tooltip title="Edit User">
                <Button
                  type="text"
                  icon={<EditOutlined />}
                  onClick={() => showEditModal(record)}
                />
              </Tooltip>
              {isAccountLocked(record) && (
                <Tooltip title="Unlock Account">
                  <Button
                    type="text"
                    icon={<KeyOutlined />}
                    onClick={() => handleUnlockAccount(record.id)}
                  />
                </Tooltip>
              )}
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <RoleGuard requiredPermission="canManageUsers">
      <div style={{ padding: '24px' }}>
        <Card>
          <div style={{ marginBottom: '24px' }}>
            <Row gutter={16} align="middle">
              <Col flex="auto">
                <Title level={2} style={{ margin: 0 }}>
                  User Management
                </Title>
                <Text type="secondary">
                  Manage admin users and therapist accounts
                </Text>
              </Col>
              <Col>
                {isSuperAdmin && (
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={showCreateModal}
                    size="large"
                  >
                    Add New User
                  </Button>
                )}
              </Col>
            </Row>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <Row gutter={16}>
              <Col span={10}>
                <Search
                  placeholder="Search users by name or email..."
                  allowClear
                  enterButton={<SearchOutlined />}
                  size="large"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
              </Col>
              <Col span={4}>
                <Select
                  placeholder="Filter by role"
                  value={roleFilter}
                  onChange={setRoleFilter}
                  size="large"
                  style={{ width: '100%' }}
                >
                  <Option value="all">All Roles</Option>
                  <Option value="super_admin">Super Admin</Option>
                  <Option value="admin">Admin</Option>
                  <Option value="therapist">Therapist</Option>
                </Select>
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
              <Col span={6}>
                <Button
                  onClick={loadUsers}
                  size="large"
                  style={{ width: '100%' }}
                >
                  Refresh
                </Button>
              </Col>
            </Row>
          </div>

          <Row gutter={16} style={{ marginBottom: '24px' }}>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="Total Users"
                  value={users.length}
                  prefix={<UserOutlined style={{ color: '#1890ff' }} />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="Active Users"
                  value={users.filter(u => u.is_active).length}
                  prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="Super Admins"
                  value={users.filter(u => u.role === 'super_admin').length}
                  valueStyle={{ color: '#722ed1' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="Locked Accounts"
                  value={users.filter(u => isAccountLocked(u)).length}
                  valueStyle={{ color: '#ff4d4f' }}
                  prefix={<LockOutlined />}
                />
              </Card>
            </Col>
          </Row>

          <Table
            dataSource={getFilteredUsers()}
            columns={columns}
            rowKey="id"
            loading={loading}
            size="small"
            pagination={{
              total: getFilteredUsers().length,
              pageSize: 15,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) =>
                `${range[0]}-${range[1]} of ${total} users`,
            }}
          />
        </Card>

        <Modal
          title={selectedUser ? 'Edit User' : 'Create New User'}
          open={isModalVisible}
          onCancel={() => setIsModalVisible(false)}
          footer={null}
          width={600}
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
          >
            <Form.Item
              name="first_name"
              label="First Name"
              rules={[{ required: true, message: 'Please enter first name' }]}
            >
              <Input size="large" />
            </Form.Item>

            <Form.Item
              name="last_name"
              label="Last Name"
              rules={[{ required: true, message: 'Please enter last name' }]}
            >
              <Input size="large" />
            </Form.Item>

            <Form.Item
              name="email"
              label="Email"
              rules={[
                { required: true, message: 'Please enter email' },
                { type: 'email', message: 'Please enter a valid email' }
              ]}
            >
              <Input size="large" disabled={!!selectedUser} />
            </Form.Item>

            {!selectedUser && (
              <Form.Item
                name="password"
                label="Password"
                rules={[
                  { required: true, message: 'Please enter password' },
                  { min: 8, message: 'Password must be at least 8 characters' },
                  {
                    pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                    message: 'Password must contain uppercase, lowercase, and numbers'
                  }
                ]}
              >
                <Input.Password size="large" />
              </Form.Item>
            )}

            <Form.Item
              name="role"
              label="Role"
              rules={[{ required: true, message: 'Please select a role' }]}
            >
              <Select size="large">
                <Option value="admin">Admin</Option>
                <Option value="therapist">Therapist</Option>
                {isSuperAdmin && <Option value="super_admin">Super Admin</Option>}
              </Select>
            </Form.Item>

            {selectedUser && (
              <Form.Item
                name="is_active"
                label="Active Status"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            )}

            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" size="large">
                  {selectedUser ? 'Update User' : 'Create User'}
                </Button>
                <Button onClick={() => setIsModalVisible(false)} size="large">
                  Cancel
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </RoleGuard>
  );
};

export default UserManagementList;
