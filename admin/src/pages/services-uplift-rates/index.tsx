import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Form,
  Input,
  Button,
  InputNumber,
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
  Switch,
  TimePicker,
  Select,
} from 'antd';
import {
  SaveOutlined,
  ReloadOutlined,
  DollarOutlined,
  EditOutlined,
  PlusOutlined,
  DeleteOutlined,
  InfoCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { useGetIdentity } from '@refinedev/core';
import { RoleGuard } from '../../components/RoleGuard';
import { supabaseClient } from '../../utility';
import { UserIdentity } from '../../utils/roleUtils';
import dayjs, { Dayjs } from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

interface TimePricingRule {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  uplift_percentage: number;
  label?: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

interface EditModalData {
  visible: boolean;
  rule?: TimePricingRule;
  isNew?: boolean;
}

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const ServicesUpliftRates: React.FC = () => {
  const { data: identity } = useGetIdentity<UserIdentity>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rules, setRules] = useState<TimePricingRule[]>([]);
  const [editModal, setEditModal] = useState<EditModalData>({ visible: false });
  const [form] = Form.useForm();

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabaseClient
        .from('time_pricing_rules')
        .select('*')
        .order('sort_order')
        .order('day_of_week')
        .order('start_time');

      if (error) throw error;

      setRules(data || []);

    } catch (error: any) {
      console.error('Error loading pricing rules:', error);
      message.error('Failed to load pricing rules');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (rule: TimePricingRule) => {
    form.setFieldsValue({
      day_of_week: rule.day_of_week,
      start_time: dayjs(rule.start_time, 'HH:mm:ss'),
      end_time: dayjs(rule.end_time, 'HH:mm:ss'),
      uplift_percentage: rule.uplift_percentage,
      label: rule.label,
      is_active: rule.is_active,
      sort_order: rule.sort_order,
    });
    setEditModal({ visible: true, rule, isNew: false });
  };

  const handleAdd = () => {
    form.resetFields();
    form.setFieldsValue({
      day_of_week: 0,
      uplift_percentage: 0,
      is_active: true,
      sort_order: rules.length,
    });
    setEditModal({ visible: true, isNew: true });
  };

  const handleSave = async (values: any) => {
    try {
      setSaving(true);

      const ruleData = {
        day_of_week: values.day_of_week,
        start_time: values.start_time.format('HH:mm:ss'),
        end_time: values.end_time.format('HH:mm:ss'),
        uplift_percentage: values.uplift_percentage,
        label: values.label,
        is_active: values.is_active,
        sort_order: values.sort_order,
      };

      if (editModal.isNew) {
        const ruleDataWithCreatedAt = {
          ...ruleData,
          created_at: new Date().toISOString(),
        };
        const { error } = await supabaseClient
          .from('time_pricing_rules')
          .insert(ruleDataWithCreatedAt);

        if (error) throw error;
        message.success('Pricing rule created successfully');
      } else {
        const { error } = await supabaseClient
          .from('time_pricing_rules')
          .update(ruleData)
          .eq('id', editModal.rule!.id);

        if (error) throw error;
        message.success('Pricing rule updated successfully');
      }

      setEditModal({ visible: false });
      loadRules();

    } catch (error: any) {
      console.error('Error saving pricing rule:', error);
      message.error('Failed to save pricing rule');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (rule: TimePricingRule) => {
    Modal.confirm({
      title: 'Delete Pricing Rule',
      content: `Are you sure you want to delete the pricing rule "${rule.label || dayNames[rule.day_of_week]}"? This action cannot be undone.`,
      okType: 'danger',
      onOk: async () => {
        try {
          const { error } = await supabaseClient
            .from('time_pricing_rules')
            .delete()
            .eq('id', rule.id);

          if (error) throw error;
          message.success('Pricing rule deleted successfully');
          loadRules();
        } catch (error: any) {
          console.error('Error deleting pricing rule:', error);
          message.error('Failed to delete pricing rule');
        }
      },
    });
  };

  const columns = [
    {
      title: 'Label',
      dataIndex: 'label',
      key: 'label',
      width: 200,
      render: (label: string, record: TimePricingRule) => (
        <div>
          <Text strong style={{ fontSize: '14px' }}>
            {label || `${dayNames[record.day_of_week]} Uplift`}
          </Text>
          {!record.is_active && (
            <Tag color="red" style={{ marginLeft: 8 }}>INACTIVE</Tag>
          )}
        </div>
      ),
    },
    {
      title: 'Day of Week',
      dataIndex: 'day_of_week',
      key: 'day_of_week',
      width: 120,
      render: (day: number) => (
        <Tag color="blue">{dayNames[day]}</Tag>
      ),
    },
    {
      title: 'Time Range',
      key: 'time_range',
      width: 180,
      render: (_: any, record: TimePricingRule) => (
        <Text>
          {dayjs(record.start_time, 'HH:mm:ss').format('h:mm A')} - {dayjs(record.end_time, 'HH:mm:ss').format('h:mm A')}
        </Text>
      ),
    },
    {
      title: 'Uplift %',
      dataIndex: 'uplift_percentage',
      key: 'uplift_percentage',
      width: 120,
      render: (percentage: number) => (
        <Tag color={percentage > 0 ? 'green' : 'default'} style={{ fontSize: '14px' }}>
          {percentage}%
        </Tag>
      ),
    },
    {
      title: 'Order',
      dataIndex: 'sort_order',
      key: 'sort_order',
      width: 80,
      render: (order: number) => <Text>{order}</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'red'}>
          {active ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_: any, record: TimePricingRule) => (
        <Space>
          <Tooltip title="Edit Rule">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Tooltip title="Delete Rule">
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
              <Title level={2}>Services Uplift Rates</Title>
              <Paragraph>
                Manage time-based pricing uplift rates for services. These rates are applied based on the day of week and time of day the service is booked.
              </Paragraph>
            </Col>
            <Col>
              <Space>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={handleAdd}
                >
                  Add Pricing Rule
                </Button>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={loadRules}
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
                  title="Total Rules"
                  value={rules.length}
                  prefix={<ClockCircleOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="Active Rules"
                  value={rules.filter(r => r.is_active).length}
                  prefix={<DollarOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="Average Uplift"
                  value={rules.length > 0
                    ? (rules.reduce((sum, r) => sum + Number(r.uplift_percentage), 0) / rules.length).toFixed(1)
                    : 0
                  }
                  suffix="%"
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="Highest Uplift"
                  value={rules.length > 0
                    ? Math.max(...rules.map(r => Number(r.uplift_percentage)))
                    : 0
                  }
                  suffix="%"
                  valueStyle={{ color: '#cf1322' }}
                />
              </Card>
            </Col>
          </Row>

          <Alert
            message="How It Works"
            description="Uplift percentages are applied as a percentage increase to the base service price. For example, a 20% uplift on a $100 service would result in a $120 charge. Rules are applied based on the day of week and time range of the booking."
            type="info"
            showIcon
            icon={<InfoCircleOutlined />}
            style={{ marginBottom: 16 }}
          />
        </div>

        <Card>
          <Table
            columns={columns}
            dataSource={rules}
            rowKey="id"
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} rules`,
            }}
          />
        </Card>

        {/* Edit/Add Modal */}
        <Modal
          title={editModal.isNew ? 'Add New Pricing Rule' : 'Edit Pricing Rule'}
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
            <Form.Item
              label="Label"
              name="label"
              extra="Optional descriptive name for this rule (e.g., 'Weekend Evening Premium')"
            >
              <Input placeholder="e.g., After Hours Premium" />
            </Form.Item>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="Day of Week"
                  name="day_of_week"
                  rules={[{ required: true, message: 'Day of week is required' }]}
                >
                  <Select>
                    {dayNames.map((day, index) => (
                      <Option key={index} value={index}>{day}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="Uplift Percentage"
                  name="uplift_percentage"
                  rules={[
                    { required: true, message: 'Uplift percentage is required' },
                    { type: 'number', min: 0, max: 100, message: 'Must be between 0 and 100%' }
                  ]}
                >
                  <InputNumber
                    min={0}
                    max={100}
                    step={1}
                    precision={0}
                    style={{ width: '100%' }}
                    formatter={(value) => `${value}%`}
                    parser={(value) => Number(value?.replace('%', '') || 0)}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="Start Time"
                  name="start_time"
                  rules={[{ required: true, message: 'Start time is required' }]}
                >
                  <TimePicker
                    format="h:mm A"
                    use12Hours
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="End Time"
                  name="end_time"
                  rules={[{ required: true, message: 'End time is required' }]}
                >
                  <TimePicker
                    format="h:mm A"
                    use12Hours
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="Sort Order"
                  name="sort_order"
                  extra="Lower numbers appear first"
                  rules={[{ required: true, message: 'Sort order is required' }]}
                >
                  <InputNumber
                    min={0}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="Active"
                  name="is_active"
                  valuePropName="checked"
                  extra="Only active rules are applied"
                >
                  <Switch />
                </Form.Item>
              </Col>
            </Row>

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
                  {editModal.isNew ? 'Create' : 'Update'} Rule
                </Button>
              </Space>
            </div>
          </Form>
        </Modal>
      </div>
    </RoleGuard>
  );
};

export default ServicesUpliftRates;
