import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Radio,
  Select,
  Space,
  Typography,
  message,
  Modal,
  Table,
  Tag,
  Spin,
  Alert,
  Divider,
} from 'antd';
import {
  MailOutlined,
  SendOutlined,
  UserOutlined,
  TeamOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { RoleGuard } from '../../components/RoleGuard';
import { supabaseClient, realSupabaseClient } from '../../utility';
import { useGetIdentity } from '@refinedev/core';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface Therapist {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  is_active: boolean;
}

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  email_subscribed: boolean;
}

interface Broadcast {
  id: string;
  subject: string;
  recipient_type: string;
  total_recipients: number;
  status: string;
  sent_at: string;
  sent_by: string;
}

const Communications: React.FC = () => {
  const [form] = Form.useForm();
  const { data: identity } = useGetIdentity<any>();

  const [recipientType, setRecipientType] = useState<string>('all_therapists');
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [recipientCount, setRecipientCount] = useState(0);

  useEffect(() => {
    loadBroadcastHistory();
    loadRecipients();
  }, []);

  useEffect(() => {
    calculateRecipientCount();
  }, [recipientType, selectedRecipients, therapists, customers]);

  const loadRecipients = async () => {
    setLoadingData(true);
    try {
      // Load therapists
      const { data: therapistData, error: therapistError } = await supabaseClient
        .from('therapist_profiles')
        .select('id, first_name, last_name, email, is_active')
        .eq('is_active', true)
        .order('first_name');

      if (therapistError) throw therapistError;
      setTherapists(therapistData || []);

      // Load customers (only subscribed)
      const { data: customerData, error: customerError } = await supabaseClient
        .from('customers')
        .select('id, first_name, last_name, email, email_subscribed')
        .eq('email_subscribed', true)
        .order('first_name');

      if (customerError) throw customerError;
      setCustomers(customerData || []);

    } catch (error: any) {
      console.error('Error loading recipients:', error);
      message.error('Failed to load recipients');
    } finally {
      setLoadingData(false);
    }
  };

  const loadBroadcastHistory = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('email_broadcasts')
        .select('id, subject, recipient_type, total_recipients, status, sent_at, sent_by')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setBroadcasts(data || []);
    } catch (error: any) {
      console.error('Error loading broadcast history:', error);
    }
  };

  const calculateRecipientCount = () => {
    let count = 0;

    if (recipientType === 'all_therapists') {
      count = therapists.length;
    } else if (recipientType === 'all_customers') {
      count = customers.length;
    } else if (recipientType === 'individual_therapists' || recipientType === 'individual_customers') {
      count = selectedRecipients.length;
    }

    setRecipientCount(count);
  };

  const handleRecipientTypeChange = (value: string) => {
    setRecipientType(value);
    setSelectedRecipients([]);
    form.setFieldsValue({ recipients: [] });
  };

  const handleSend = async (values: any) => {
    if (recipientCount === 0) {
      message.warning('Please select at least one recipient');
      return;
    }

    Modal.confirm({
      title: 'Send Broadcast Email?',
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <p>You are about to send this email to <strong>{recipientCount} recipient(s)</strong>.</p>
          <p><strong>Subject:</strong> {values.subject}</p>
          <p>Are you sure you want to proceed?</p>
        </div>
      ),
      okText: 'Send Email',
      okType: 'primary',
      cancelText: 'Cancel',
      onOk: async () => {
        await sendBroadcast(values);
      },
    });
  };

  const sendBroadcast = async (values: any) => {
    setLoading(true);
    try {
      // Get Supabase Auth session token
      const { data: { session } } = await realSupabaseClient.auth.getSession();

      if (!session?.access_token) {
        message.error('Not authenticated - please log in again');
        return;
      }

      const response = await fetch('/.netlify/functions/send-broadcast-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          subject: values.subject,
          body: values.body,
          recipientType: recipientType,
          recipientIds: recipientType.startsWith('individual') ? selectedRecipients : null
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to send broadcast');
      }

      message.success(`Email broadcast sent to ${recipientCount} recipients!`);
      form.resetFields();
      setSelectedRecipients([]);
      loadBroadcastHistory();

    } catch (error: any) {
      console.error('Error sending broadcast:', error);
      message.error(error.message || 'Failed to send broadcast email');
    } finally {
      setLoading(false);
    }
  };

  const recipientOptions =
    recipientType === 'individual_therapists'
      ? therapists.map(t => ({
          label: `${t.first_name} ${t.last_name} (${t.email})`,
          value: t.id
        }))
      : recipientType === 'individual_customers'
      ? customers.map(c => ({
          label: `${c.first_name} ${c.last_name} (${c.email})`,
          value: c.id
        }))
      : [];

  const broadcastColumns = [
    {
      title: 'Date',
      dataIndex: 'sent_at',
      key: 'sent_at',
      render: (date: string) => date ? new Date(date).toLocaleString() : '-',
      width: 180,
    },
    {
      title: 'Subject',
      dataIndex: 'subject',
      key: 'subject',
    },
    {
      title: 'Recipients',
      dataIndex: 'recipient_type',
      key: 'recipient_type',
      render: (type: string, record: Broadcast) => (
        <Space>
          <Tag>{type.replace('_', ' ').toUpperCase()}</Tag>
          <Text type="secondary">({record.total_recipients})</Text>
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colors: Record<string, string> = {
          sent: 'green',
          sending: 'blue',
          failed: 'red',
          draft: 'gray',
        };
        return <Tag color={colors[status] || 'default'}>{status.toUpperCase()}</Tag>;
      },
    },
  ];

  return (
    <RoleGuard requiredPermission="canManageUsers">
      <div style={{ padding: '24px' }}>
        <Card>
          <Title level={2}>
            <MailOutlined /> Communications
          </Title>
          <Paragraph type="secondary">
            Send broadcast emails to therapists and customers
          </Paragraph>

          <Divider />

          <Form
            form={form}
            layout="vertical"
            onFinish={handleSend}
            initialValues={{ recipientType: 'all_therapists' }}
          >
            {/* Recipient Selection */}
            <Card title="Select Recipients" style={{ marginBottom: 24 }}>
              <Form.Item
                name="recipientType"
                label="Send To"
                rules={[{ required: true }]}
              >
                <Radio.Group onChange={(e) => handleRecipientTypeChange(e.target.value)} value={recipientType}>
                  <Space direction="vertical">
                    <Radio value="all_therapists">
                      <Space>
                        <TeamOutlined />
                        All Active Therapists ({therapists.length})
                      </Space>
                    </Radio>
                    <Radio value="all_customers">
                      <Space>
                        <UserOutlined />
                        All Subscribed Customers ({customers.length})
                      </Space>
                    </Radio>
                    <Radio value="individual_therapists">
                      <Space>
                        <TeamOutlined />
                        Select Individual Therapists
                      </Space>
                    </Radio>
                    <Radio value="individual_customers">
                      <Space>
                        <UserOutlined />
                        Select Individual Customers
                      </Space>
                    </Radio>
                  </Space>
                </Radio.Group>
              </Form.Item>

              {(recipientType === 'individual_therapists' || recipientType === 'individual_customers') && (
                <Form.Item
                  name="recipients"
                  label="Choose Recipients"
                  rules={[{ required: true, message: 'Please select at least one recipient' }]}
                >
                  <Select
                    mode="multiple"
                    placeholder="Select recipients..."
                    options={recipientOptions}
                    onChange={setSelectedRecipients}
                    loading={loadingData}
                    showSearch
                    filterOption={(input, option) =>
                      (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              )}

              <Alert
                message={`${recipientCount} recipient(s) selected`}
                type={recipientCount > 0 ? 'info' : 'warning'}
                showIcon
              />
            </Card>

            {/* Email Composer */}
            <Card title="Compose Email" style={{ marginBottom: 24 }}>
              <Form.Item
                name="subject"
                label="Subject"
                rules={[{ required: true, message: 'Please enter email subject' }]}
              >
                <Input size="large" placeholder="Enter email subject..." />
              </Form.Item>

              <Form.Item
                name="body"
                label="Message"
                rules={[{ required: true, message: 'Please enter email message' }]}
              >
                <TextArea
                  rows={12}
                  placeholder="Type your message here...&#10;&#10;You can use these variables:&#10;{{first_name}} - Recipient's first name&#10;{{last_name}} - Recipient's last name&#10;{{email}} - Recipient's email"
                  style={{ fontFamily: 'monospace' }}
                />
              </Form.Item>

              <Alert
                message="Email Variables"
                description="Use {{first_name}}, {{last_name}}, and {{email}} in your message to personalize emails for each recipient."
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SendOutlined />}
                  size="large"
                  loading={loading}
                  disabled={recipientCount === 0}
                >
                  Send Email to {recipientCount} Recipient(s)
                </Button>
              </Form.Item>
            </Card>
          </Form>

          {/* Broadcast History */}
          <Card title="Recent Broadcasts" style={{ marginTop: 24 }}>
            <Table
              dataSource={broadcasts}
              columns={broadcastColumns}
              rowKey="id"
              pagination={{ pageSize: 10 }}
              loading={loadingData}
            />
          </Card>
        </Card>
      </div>
    </RoleGuard>
  );
};

export default Communications;
