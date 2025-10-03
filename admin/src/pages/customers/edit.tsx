import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Row,
  Col,
  Typography,
  message,
  Space,
  Switch,
  Avatar,
  Spin,
  Alert,
  Divider
} from 'antd';
import {
  ArrowLeftOutlined,
  SaveOutlined,
  UserOutlined,
  MailOutlined,
  PhoneOutlined,
  EnvironmentOutlined,
  EditOutlined,
  CrownOutlined
} from '@ant-design/icons';
import { useGetIdentity, useNavigation } from '@refinedev/core';
import { useParams } from 'react-router';
import { RoleGuard } from '../../components/RoleGuard';
import { supabaseClient } from '../../utility';
import { useAddressGeocoding } from '../../hooks/useAddressGeocoding';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface CustomerFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  address?: string;
  notes?: string;
  customer_code?: string;
  is_guest: boolean;
}

const CustomerEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { data: identity } = useGetIdentity<any>();
  const { list, show } = useNavigation();
  const [form] = Form.useForm();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customer, setCustomer] = useState<CustomerFormData | null>(null);

  const canEditCustomers = identity?.role === 'admin' || identity?.role === 'super_admin';

  // Geocoding hook for address verification (optional for customers)
  const {
    isGeocoding,
    geocodeResult,
    geocodeError,
    addressVerified,
    geocodeAddress,
    setupAutocomplete
  } = useAddressGeocoding({
    onAddressChange: (address) => {
      // Update the form field with the full formatted address
      form.setFieldsValue({
        address: address
      });
    }
  });

  useEffect(() => {
    if (id) {
      loadCustomerData();
    }
  }, [id]);

  // Set up address autocomplete after customer data is loaded
  useEffect(() => {
    if (customer) {
      const setupAddressField = async () => {
        const addressInput = document.getElementById('address') as HTMLInputElement;
        if (addressInput) {
          await setupAutocomplete(addressInput);
        }
      };

      const timer = setTimeout(setupAddressField, 500);
      return () => clearTimeout(timer);
    }
  }, [customer, setupAutocomplete]);

  const loadCustomerData = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabaseClient
        .from('customers')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data) {
        setCustomer(data);
        form.setFieldsValue(data);
      }

    } catch (error: any) {
      console.error('Error loading customer:', error);
      message.error('Failed to load customer information');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values: CustomerFormData) => {
    if (!canEditCustomers) {
      message.error('You do not have permission to edit customers');
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabaseClient
        .from('customers')
        .update({
          ...values,
          // Ensure customer_code is set if empty
          customer_code: values.customer_code || generateCustomerCode(values.first_name, values.last_name)
        })
        .eq('id', id);

      if (error) throw error;

      message.success('Customer updated successfully');
      show('customers', id!);

    } catch (error: any) {
      console.error('Error updating customer:', error);
      if (error.code === '23505' && error.message.includes('email')) {
        message.error('This email address is already in use');
      } else {
        message.error('Failed to update customer');
      }
    } finally {
      setSaving(false);
    }
  };

  const generateCustomerCode = (firstName: string, lastName: string): string => {
    const timestamp = Date.now().toString().slice(-4);
    const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    return `${initials}${timestamp}`;
  };

  const handleBack = () => {
    show('customers', id!);
  };

  if (!canEditCustomers) {
    return (
      <div style={{ padding: '24px' }}>
        <Alert
          message="Access Denied"
          description="You don't have permission to edit customer information."
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
          description="The customer you're trying to edit doesn't exist or has been deleted."
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
    <RoleGuard requiredPermission="canEditCustomers">
      <div style={{ padding: '24px' }}>
        {/* Header */}
        <Card style={{ marginBottom: '24px' }}>
          <Row justify="space-between" align="middle">
            <Col>
              <Button 
                icon={<ArrowLeftOutlined />} 
                onClick={handleBack}
                style={{ marginBottom: '16px' }}
              >
                Back to Customer Details
              </Button>
              <Space align="center">
                <Avatar 
                  size={48} 
                  icon={<UserOutlined />}
                  style={{ 
                    backgroundColor: customer.is_guest ? '#faad14' : '#1890ff'
                  }}
                />
                <div>
                  <Title level={2} style={{ margin: 0 }}>
                    <EditOutlined style={{ marginRight: 8 }} />
                    Edit Customer
                  </Title>
                  <Text type="secondary">
                    Update customer information and settings
                  </Text>
                </div>
              </Space>
            </Col>
          </Row>
        </Card>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          size="large"
        >
          <Row gutter={24}>
            {/* Basic Information */}
            <Col xs={24} lg={12}>
              <Card title="Basic Information" style={{ marginBottom: '24px' }}>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name="first_name"
                      label="First Name"
                      rules={[
                        { required: true, message: 'Please enter first name' },
                        { max: 50, message: 'First name must be less than 50 characters' }
                      ]}
                    >
                      <Input 
                        prefix={<UserOutlined />}
                        placeholder="Enter first name" 
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name="last_name"
                      label="Last Name"
                      rules={[
                        { required: true, message: 'Please enter last name' },
                        { max: 50, message: 'Last name must be less than 50 characters' }
                      ]}
                    >
                      <Input placeholder="Enter last name" />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item
                  name="email"
                  label="Email Address"
                  rules={[
                    { required: true, message: 'Please enter email address' },
                    { type: 'email', message: 'Please enter a valid email address' }
                  ]}
                >
                  <Input 
                    prefix={<MailOutlined />}
                    placeholder="Enter email address"
                  />
                </Form.Item>

                <Form.Item
                  name="phone"
                  label="Phone Number"
                  rules={[
                    { pattern: /^[\+]?[\s\-\(\)]?[\d\s\-\(\)]{8,}$/, message: 'Please enter a valid phone number' }
                  ]}
                >
                  <Input 
                    prefix={<PhoneOutlined />}
                    placeholder="Enter phone number"
                  />
                </Form.Item>

                <Form.Item
                  name="customer_code"
                  label="Customer Code"
                  rules={[
                    { max: 20, message: 'Customer code must be less than 20 characters' }
                  ]}
                  help="Leave blank to auto-generate a unique code"
                >
                  <Input placeholder="Auto-generated if empty" />
                </Form.Item>
              </Card>
            </Col>

            {/* Address and Settings */}
            <Col xs={24} lg={12}>
              <Card title="Address & Settings" style={{ marginBottom: '24px' }}>
                <Form.Item 
                  name="address" 
                  label="Address"
                  help={geocodeError ? <span style={{ color: '#ff4d4f' }}>{geocodeError}</span> : 
                        addressVerified ? <span style={{ color: '#52c41a' }}>✓ Address verified</span> : 
                        'Start typing address for autocomplete suggestions (optional)'}
                >
                  <TextArea 
                    id="address"
                    rows={3} 
                    placeholder="Start typing address for autocomplete..."
                  />
                </Form.Item>

                {form.getFieldValue('address') && (
                  <div style={{ marginBottom: '16px' }}>
                    <Button 
                      type="default"
                      loading={isGeocoding}
                      onClick={() => {
                        const address = form.getFieldValue('address');
                        if (address) {
                          geocodeAddress(address);
                        } else {
                          message.warning('Please enter an address first');
                        }
                      }}
                      icon={<EnvironmentOutlined />}
                      size="small"
                    >
                      {isGeocoding ? 'Verifying...' : 'Verify Address'}
                    </Button>
                    <Text type="secondary" style={{ marginLeft: 8, fontSize: '12px' }}>
                      Optional - helps with service delivery planning
                    </Text>
                  </div>
                )}

                <Divider />

                <Form.Item
                  name="is_guest"
                  label="Account Type"
                  valuePropName="checked"
                  help="Guest accounts are for one-time customers without full registration"
                >
                  <Switch 
                    checkedChildren={
                      <span>
                        <CrownOutlined /> Guest
                      </span>
                    }
                    unCheckedChildren="Registered"
                  />
                </Form.Item>

                <Form.Item
                  name="notes"
                  label="Admin Notes"
                  help="Internal notes visible only to admin staff"
                >
                  <TextArea 
                    rows={4} 
                    placeholder="Add any internal notes about this customer..."
                    maxLength={1000}
                    showCount
                  />
                </Form.Item>
              </Card>
            </Col>
          </Row>

          {/* Actions */}
          <Card>
            <div style={{ textAlign: 'center' }}>
              <Space size="large">
                <Button 
                  size="large" 
                  onClick={handleBack}
                >
                  Cancel
                </Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  size="large"
                  loading={saving}
                  icon={<SaveOutlined />}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </Space>
            </div>
          </Card>
        </Form>
      </div>
    </RoleGuard>
  );
};

export default CustomerEdit;