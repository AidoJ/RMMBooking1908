import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Form,
  Input,
  Button,
  Switch,
  InputNumber,
  Select,
  Typography,
  Space,
  message,
  Spin,
  Alert,
  Row,
  Col,
  Statistic,
  Modal,
  Tag,
  Tooltip,
  Tabs,
} from 'antd';
import {
  SaveOutlined,
  ReloadOutlined,
  SettingOutlined,
  EditOutlined,
  PlusOutlined,
  DeleteOutlined,
  EyeOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useGetIdentity } from '@refinedev/core';
import { RoleGuard } from '../../components/RoleGuard';
import { supabaseClient } from '../../utility';
import { UserIdentity } from '../../utils/roleUtils';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { TabPane } = Tabs;
const { Option } = Select;

// System setting interface matching your actual database structure
interface SystemSetting {
  id: string;
  key: string;
  value: string;
  updated_at: string;
  // Metadata fields (new)
  data_type?: string;
  category?: string;
  description?: string;
  is_sensitive?: boolean;
  created_at?: string;
}

interface EditModalData {
  visible: boolean;
  setting?: SystemSetting;
  isNew?: boolean;
}

const SystemSettings: React.FC = () => {
  const { data: identity } = useGetIdentity<UserIdentity>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [filteredSettings, setFilteredSettings] = useState<SystemSetting[]>([]);
  const [activeTab, setActiveTab] = useState('all');
  const [editModal, setEditModal] = useState<EditModalData>({ visible: false });
  const [form] = Form.useForm();
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    filterSettings();
  }, [settings, activeTab, searchTerm]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabaseClient
        .from('system_settings')
        .select('*')
        .order('key');

      if (error) throw error;

      setSettings(data || []);
      
    } catch (error: any) {
      console.error('Error loading settings:', error);
      message.error('Failed to load system settings');
    } finally {
      setLoading(false);
    }
  };

  const filterSettings = () => {
    let filtered = [...settings];

    // Filter by category
    if (activeTab !== 'all') {
      filtered = filtered.filter(setting => 
        (setting.category || 'general') === activeTab
      );
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(setting =>
        setting.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
        setting.value.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (setting.description || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredSettings(filtered);
  };

  // Smart input component based on data_type metadata
  const renderValueInput = (setting: SystemSetting, value: any, onChange: (value: any) => void) => {
    const dataType = setting.data_type || 'string';
    
    switch (dataType) {
      case 'boolean':
        return (
          <Switch 
            checked={value === 'true'} 
            onChange={(checked) => onChange(checked ? 'true' : 'false')}
          />
        );
      
      case 'integer':
        return (
          <InputNumber
            value={parseInt(value) || 0}
            onChange={(val) => onChange(val?.toString() || '0')}
            style={{ width: '100%' }}
          />
        );
      
      case 'decimal':
        return (
          <InputNumber
            value={parseFloat(value) || 0}
            precision={2}
            onChange={(val) => onChange(val?.toString() || '0')}
            style={{ width: '100%' }}
            formatter={(val) => {
              const numVal = parseFloat(val?.toString() || '0');
              return setting.key.includes('rate') && numVal < 1 
                ? `${(numVal * 100).toFixed(1)}%` 
                : val?.toString() || '0';
            }}
            parser={(val) => {
              if (setting.key.includes('rate') && val?.includes('%')) {
                return parseFloat(val.replace('%', '')) / 100;
              }
              return parseFloat(val?.replace(/[^\d.]/g, '') || '0');
            }}
          />
        );
      
      default:
        return setting.is_sensitive ? (
          <Input.Password 
            value={value} 
            onChange={(e) => onChange(e.target.value)}
            placeholder="Enter value..."
          />
        ) : (
          <Input 
            value={value} 
            onChange={(e) => onChange(e.target.value)}
            placeholder="Enter value..."
          />
        );
    }
  };

  const renderValueDisplay = (setting: SystemSetting) => {
    const { value, data_type, key, is_sensitive } = setting;
    
    if (is_sensitive && value) {
      return (
        <Tooltip title="Sensitive data hidden for security. Click edit to modify.">
          <Text type="secondary" style={{ fontSize: '16px' }}>••••••••</Text>
        </Tooltip>
      );
    }
    
    switch (data_type) {
      case 'boolean':
        return <Tag color={value === 'true' ? 'green' : 'red'}>{value.toUpperCase()}</Tag>;
      
      case 'decimal':
        if (key.includes('rate') && parseFloat(value) < 1) {
          return <Text>{(parseFloat(value) * 100).toFixed(1)}%</Text>;
        }
        if (key.includes('price') || key.includes('fee')) {
          return <Text style={{ color: '#52c41a' }}>$${parseFloat(value).toFixed(2)}</Text>;
        }
        return <Text>{parseFloat(value).toFixed(2)}</Text>;
      
      case 'integer':
        return <Text>{value}</Text>;
      
      default:
        return <Text>{value}</Text>;
    }
  };

  const handleEdit = (setting: SystemSetting) => {
    form.setFieldsValue({
      key: setting.key,
      value: setting.value,
      category: setting.category || 'general',
      data_type: setting.data_type || 'string',
      description: setting.description || '',
      is_sensitive: setting.is_sensitive || false,
    });
    setEditModal({ visible: true, setting, isNew: false });
  };

  const handleAdd = () => {
    form.resetFields();
    form.setFieldsValue({
      category: 'general',
      data_type: 'string',
      is_sensitive: false,
    });
    setEditModal({ visible: true, isNew: true });
  };

  const handleSave = async (values: any) => {
    try {
      setSaving(true);
      
      // CRITICAL: Always store the actual value in the 'value' field as text
      const settingData = {
        key: values.key,
        value: values.value.toString(), // NEVER change this - always text in value field
        category: values.category,
        data_type: values.data_type,
        description: values.description,
        is_sensitive: values.is_sensitive,
        updated_at: new Date().toISOString(),
      };

      if (editModal.isNew) {
        const settingDataWithCreatedAt = {
          ...settingData,
          created_at: new Date().toISOString(),
        };
        const { error } = await supabaseClient
          .from('system_settings')
          .insert(settingDataWithCreatedAt);
        
        if (error) throw error;
        message.success('Setting created successfully');
      } else {
        const { error } = await supabaseClient
          .from('system_settings')
          .update(settingData)
          .eq('id', editModal.setting!.id);
        
        if (error) throw error;
        message.success('Setting updated successfully');
      }

      setEditModal({ visible: false });
      loadSettings();
      
    } catch (error: any) {
      console.error('Error saving setting:', error);
      message.error('Failed to save setting');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (setting: SystemSetting) => {
    Modal.confirm({
      title: 'Delete Setting',
      content: `Are you sure you want to delete "${setting.key}"? This action cannot be undone.`,
      okType: 'danger',
      onOk: async () => {
        try {
          const { error } = await supabaseClient
            .from('system_settings')
            .delete()
            .eq('id', setting.id);
          
          if (error) throw error;
          message.success('Setting deleted successfully');
          loadSettings();
        } catch (error: any) {
          console.error('Error deleting setting:', error);
          message.error('Failed to delete setting');
        }
      },
    });
  };

  const getCategories = () => {
    const categories = new Set(settings.map(s => s.category || 'general'));
    return Array.from(categories).sort();
  };

  const getCategoryIcon = (category: string) => {
    const icons: { [key: string]: string } = {
      general: '⚙️',
      business: '🏢',
      pricing: '💰',
      booking: '📅',
      operations: '🚀',
      communication: '📱',
      integration: '🔗',
      features: '🧪',
    };
    return icons[category] || '📋';
  };

  const columns = [
    {
      title: 'Key',
      dataIndex: 'key',
      key: 'key',
      width: 250,
      render: (key: string, record: SystemSetting) => (
        <div>
          <Text code style={{ fontSize: '14px', fontWeight: 500 }}>{key}</Text>
          {record.description && (
            <div style={{ marginTop: '4px' }}>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {record.description}
              </Text>
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Value',
      dataIndex: 'value',
      key: 'value',
      width: 200,
      render: (_: any, record: SystemSetting) => renderValueDisplay(record),
    },
    {
      title: 'Type',
      dataIndex: 'data_type',
      key: 'data_type',
      width: 100,
      render: (type: string) => (
        <Tag color="blue">{type || 'string'}</Tag>
      ),
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: (category: string) => (
        <Tag color="green">
          {getCategoryIcon(category || 'general')} {category || 'general'}
        </Tag>
      ),
    },
    {
      title: 'Updated',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 120,
      render: (date: string) => (
        <Tooltip title={dayjs(date).format('YYYY-MM-DD HH:mm:ss')}>
          <Text>{dayjs(date).fromNow()}</Text>
        </Tooltip>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_: any, record: SystemSetting) => (
        <Space>
          <Tooltip title="Edit Setting">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Tooltip title="Delete Setting">
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <RoleGuard requiredPermission="canAccessSystemSettings">
      <div style={{ padding: '24px' }}>
        <div style={{ marginBottom: '24px' }}>
          <Row justify="space-between" align="middle">
            <Col>
              <Title level={2}>System Settings</Title>
              <Paragraph>
                Manage key-value system configuration. All values are stored as text in the database.
              </Paragraph>
            </Col>
            <Col>
              <Space>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={handleAdd}
                >
                  Add Setting
                </Button>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={loadSettings}
                >
                  Refresh
                </Button>
              </Space>
            </Col>
          </Row>
          
          {/* Statistics */}
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="Total Settings"
                  value={settings.length}
                  prefix={<SettingOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="Categories"
                  value={getCategories().length}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="Last Updated"
                  value={settings.length > 0 
                    ? dayjs(settings.reduce((latest, s) => s.updated_at > latest ? s.updated_at : latest, '')).fromNow()
                    : 'Never'
                  }
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Input.Search
                  placeholder="Search settings..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  allowClear
                />
              </Card>
            </Col>
          </Row>

          <Alert
            message="Database Structure"
            description="Settings are stored with key, value (always text), updated_at from your existing structure. New metadata fields (category, data_type, description) improve the admin interface but don't affect how your booking platform reads settings."
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
        </div>

        <Card>
          <Tabs activeKey={activeTab} onChange={setActiveTab}>
            <TabPane tab="All Settings" key="all" />
            {getCategories().map(category => (
              <TabPane 
                tab={`${getCategoryIcon(category)} ${category}`} 
                key={category} 
              />
            ))}
          </Tabs>

          <Table
            columns={columns}
            dataSource={filteredSettings}
            rowKey="id"
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} settings`,
            }}
            scroll={{ x: 1000 }}
          />
        </Card>

        {/* Edit/Add Modal */}
        <Modal
          title={editModal.isNew ? 'Add New Setting' : 'Edit Setting'}
          open={editModal.visible}
          onCancel={() => setEditModal({ visible: false })}
          footer={null}
          width={600}
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSave}
          >
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="Setting Key"
                  name="key"
                  rules={[{ required: true, message: 'Key is required' }]}
                >
                  <Input 
                    placeholder="e.g., max_booking_advance_days"
                    disabled={!editModal.isNew}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="Data Type"
                  name="data_type"
                  rules={[{ required: true, message: 'Data type is required' }]}
                >
                  <Select>
                    <Option value="string">String</Option>
                    <Option value="integer">Integer</Option>
                    <Option value="decimal">Decimal</Option>
                    <Option value="boolean">Boolean</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              label="Value"
              name="value"
              rules={[{ required: true, message: 'Value is required' }]}
              extra="This will be stored as text in the database regardless of data type"
            >
              <Input placeholder="Enter the setting value" />
            </Form.Item>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="Category"
                  name="category"
                >
                  <Select>
                    <Option value="general">General</Option>
                    <Option value="business">Business</Option>
                    <Option value="pricing">Pricing</Option>
                    <Option value="booking">Booking</Option>
                    <Option value="operations">Operations</Option>
                    <Option value="communication">Communication</Option>
                    <Option value="integration">Integration</Option>
                    <Option value="features">Features</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label={
                    <span>
                      Sensitive Data{' '}
                      <Tooltip title="When enabled, the value will be hidden with dots (••••) in the table view for security. Use this for API keys, passwords, tokens, etc.">
                        <InfoCircleOutlined style={{ color: '#1890ff' }} />
                      </Tooltip>
                    </span>
                  }
                  name="is_sensitive"
                  valuePropName="checked"
                  extra="Hide value in table view for security (API keys, passwords, etc.)"
                >
                  <Switch />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              label="Description"
              name="description"
            >
              <TextArea 
                rows={3} 
                placeholder="Optional description of what this setting controls"
              />
            </Form.Item>

            <div style={{ textAlign: 'right' }}>
              <Space>
                <Button onClick={() => setEditModal({ visible: false })}>
                  Cancel
                </Button>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  loading={saving}
                  icon={<SaveOutlined />}
                >
                  {editModal.isNew ? 'Create' : 'Update'} Setting
                </Button>
              </Space>
            </div>
          </Form>
        </Modal>
      </div>
    </RoleGuard>
  );
};

export default SystemSettings;