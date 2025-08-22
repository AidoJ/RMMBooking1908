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
  UserAddOutlined,
  CrownOutlined
} from '@ant-design/icons';
import { useGetIdentity, useNavigation } from '@refinedev/core';
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

const CustomerCreate: React.FC = () => {
  const { data: identity } = useGetIdentity<any>();
  const { list } = useNavigation();
  const [form] = Form.useForm();
  
  const [saving, setSaving] = useState(false);

  const canCreateCustomers = identity?.role === 'admin' || identity?.role === 'super_admin';

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

  // Set up address autocomplete after form is rendered
  useEffect(() => {
    const setupAddressField = async () => {
      const addressInput = document.getElementById('address') as HTMLInputElement;
      if (addressInput) {
        await setupAutocomplete(addressInput);
      }
    };

    const timer = setTimeout(setupAddressField, 500);
    return () => clearTimeout(timer);
  }, [setupAutocomplete]);

  const handleSubmit = async (values: CustomerFormData) => {
    if (!canCreateCustomers) {
      message.error('You do not have permission to create customers');
      return;
    }

    try {
      setSaving(true);

      // Generate customer code if not provided
      const customerCode = values.customer_code || generateCustomerCode(values.first_name, values.last_name);

      const { data, error } = await supabaseClient
        .from('customers')
        .insert([{
          ...values,
          customer_code: customerCode,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;

      message.success('Customer created successfully');
      // Navigate to the new customer's detail page
      if (data) {
        list('customers');
      }

    } catch (error: any) {
      console.error('Error creating customer:', error);
      if (error.code === '23505') {
        if (error.message.includes('email')) {
          message.error('A customer with this email address already exists');
        } else if (error.message.includes('customer_code')) {
          message.error('This customer code is already in use');
        } else {
          message.error('A customer with this information already exists');
        }
      } else {
        message.error('Failed to create customer');
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
    list('customers');
  };

  if (!canCreateCustomers) {
    return (
      <div style={{ padding: '24px' }}>
        <Alert
          message="Access Denied"
          description="You don't have permission to create new customers."
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
    <RoleGuard requiredPermission="canCreateCustomers">
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
                Back to Customers
              </Button>
              <Space align="center">
                <Avatar 
                  size={48} 
                  icon={<UserAddOutlined />}
                  style={{ backgroundColor: '#1890ff' }}
                />
                <div>
                  <Title level={2} style={{ margin: 0 }}>
                    Create New Customer
                  </Title>
                  <Text type="secondary">
                    Add a new customer to the system
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
          initialValues={{
            is_guest: false
          }}
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
                        { max: 50, message: 'First name must be less than 50 characters' },
                        { pattern: /^[a-zA-Z\s'-]+$/, message: 'First name can only contain letters, spaces, hyphens and apostrophes' }
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
                        { max: 50, message: 'Last name must be less than 50 characters' },
                        { pattern: /^[a-zA-Z\s'-]+$/, message: 'Last name can only contain letters, spaces, hyphens and apostrophes' }
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
                    { type: 'email', message: 'Please enter a valid email address' },
                    { max: 100, message: 'Email must be less than 100 characters' }
                  ]}
                >
                  <Input 
                    prefix={<MailOutlined />}
                    placeholder="Enter email address"
                    autoComplete="email"
                  />
                </Form.Item>

                <Form.Item
                  name="phone"
                  label="Phone Number (Optional)"
                  rules={[
                    { pattern: /^[\+]?[\s\-\(\)]?[\d\s\-\(\)]{8,}$/, message: 'Please enter a valid phone number' },
                    { max: 20, message: 'Phone number must be less than 20 characters' }
                  ]}
                >
                  <Input 
                    prefix={<PhoneOutlined />}
                    placeholder="Enter phone number"
                    autoComplete="tel"
                  />
                </Form.Item>

                <Form.Item
                  name="customer_code"
                  label="Customer Code (Optional)"
                  rules={[
                    { max: 20, message: 'Customer code must be less than 20 characters' },
                    { pattern: /^[A-Z0-9]+$/, message: 'Customer code must contain only uppercase letters and numbers' }
                  ]}
                  help="Leave blank to auto-generate a unique code (e.g., JD1234)"
                >
                  <Input 
                    placeholder="Auto-generated if empty"
                    style={{ textTransform: 'uppercase' }}
                    onChange={(e) => {
                      const upperValue = e.target.value.toUpperCase();
                      form.setFieldsValue({ customer_code: upperValue });
                    }}
                  />
                </Form.Item>
              </Card>
            </Col>

            {/* Address and Settings */}
            <Col xs={24} lg={12}>
              <Card title="Address & Settings" style={{ marginBottom: '24px' }}>
                <Form.Item 
                  name="address" 
                  label="Address (Optional)"
                  help={geocodeError ? <span style={{ color: '#ff4d4f' }}>{geocodeError}</span> : 
                        addressVerified ? <span style={{ color: '#52c41a' }}>✓ Address verified</span> : 
                        'Start typing address for autocomplete suggestions'}
                  rules={[
                    { max: 500, message: 'Address must be less than 500 characters' }
                  ]}
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
                  label="Admin Notes (Optional)"
                  help="Internal notes visible only to admin staff"
                  rules={[
                    { max: 1000, message: 'Notes must be less than 1000 characters' }
                  ]}
                >
                  <TextArea 
                    rows={4} 
                    placeholder="Add any internal notes about this customer..."
                    maxLength={1000}
                    showCount
                  />
                </Form.Item>
              </Card>

              {/* Info Card */}
              <Card>
                <Alert
                  message="Customer Creation"
                  description={
                    <div>
                      <p>• Customer code will be auto-generated if not provided</p>
                      <p>• Email addresses must be unique in the system</p>
                      <p>• Address geocoding helps with service delivery planning</p>
                      <p>• Guest accounts are for one-time bookings</p>
                    </div>
                  }
                  type="info"
                  showIcon
                />
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
                  {saving ? 'Creating...' : 'Create Customer'}
                </Button>
              </Space>
            </div>
          </Card>
        </Form>
      </div>
    </RoleGuard>
  );
};

export default CustomerCreate;