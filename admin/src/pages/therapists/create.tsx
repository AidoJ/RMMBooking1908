import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Select,
  Switch,
  Button,
  Row,
  Col,
  Typography,
  message,
  Space,
  InputNumber,
  Upload,
  Avatar,
  Steps
} from 'antd';
import {
  ArrowLeftOutlined,
  UserOutlined,
  UploadOutlined,
  UserAddOutlined,
  EnvironmentOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router';
import { useGetIdentity } from '@refinedev/core';
import { RoleGuard } from '../../components/RoleGuard';
import { supabaseClient } from '../../utility';
import { useAddressGeocoding } from '../../hooks/useAddressGeocoding';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const { Step } = Steps;

interface TherapistFormData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string;
  bio?: string;
  home_address?: string;
  service_radius_km?: number;
  is_active: boolean;
  gender?: string;
  years_experience?: number;
  business_abn: string;
  address_verified: boolean;
}

const TherapistCreate: React.FC = () => {
  const navigate = useNavigate();
  const { data: identity } = useGetIdentity<any>();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [profileImage, setProfileImage] = useState<string>('');

  const canCreateTherapists = identity?.role === 'admin' || identity?.role === 'super_admin';

  // Geocoding hook for address verification
  const {
    isGeocoding,
    geocodeResult,
    geocodeError,
    addressVerified,
    geocodeAddress,
    setupAutocomplete,
    coordinateFields
  } = useAddressGeocoding({
    onGeocodeSuccess: (result) => {
      form.setFieldsValue({
        latitude: result.lat,
        longitude: result.lng,
        address_verified: true
      });
    },
    onAddressChange: (address) => {
      // Update the form field with the full formatted address
      form.setFieldsValue({
        home_address: address
      });
    }
  });

  // Set up address autocomplete after form is rendered
  useEffect(() => {
    const setupAddressField = async () => {
      const addressInput = document.getElementById('home_address') as HTMLInputElement;
      if (addressInput) {
        await setupAutocomplete(addressInput);
      }
    };

    // Delay to ensure form is rendered
    const timer = setTimeout(setupAddressField, 500);
    return () => clearTimeout(timer);
  }, [setupAutocomplete]);

  const [uploadingImage, setUploadingImage] = useState(false);

  const handleImageUpload = async (file: File) => {
    try {
      setUploadingImage(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fieldName', 'profilePhoto');

      const response = await fetch('/.netlify/functions/therapist-registration-upload', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result?.error || 'Photo upload failed');
      }

      setProfileImage(result.url);
      message.success('Photo uploaded');
    } catch (error: any) {
      console.error('Error uploading photo:', error);
      message.error('Failed to upload photo: ' + error.message);
    } finally {
      setUploadingImage(false);
    }
    return false;
  };

  const handleSubmit = async (values: TherapistFormData) => {
    if (!canCreateTherapists) {
      message.error('You do not have permission to create therapists');
      return;
    }

    try {
      setSaving(true);

      // First create the admin user account
      const { data: userData, error: userError } = await supabaseClient
        .from('admin_users')
        .insert({
          email: values.email,
          password: values.password,
          first_name: values.first_name,
          last_name: values.last_name,
          role: 'therapist',
          is_active: true,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (userError) throw userError;

      // Then create the therapist profile with coordinates
      const { error: therapistError } = await supabaseClient
        .from('therapist_profiles')
        .insert({
          user_id: userData.id,
          first_name: values.first_name,
          last_name: values.last_name,
          email: values.email,
          phone: values.phone,
          bio: values.bio,
          profile_pic: profileImage,
          home_address: values.home_address,
          latitude: coordinateFields.latitude,
          longitude: coordinateFields.longitude,
          service_radius_km: values.service_radius_km,
          is_active: values.is_active,
          gender: values.gender,
          years_experience: values.years_experience,
          business_abn: values.business_abn,
          address_verified: coordinateFields.address_verified,
          rating: 0.0,
          total_reviews: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (therapistError) throw therapistError;

      message.success('Therapist account created successfully');
      navigate('/therapists');

    } catch (error: any) {
      console.error('Error creating therapist:', error);
      message.error('Failed to create therapist account');
    } finally {
      setSaving(false);
    }
  };

  if (!canCreateTherapists) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Title level={3}>Access Denied</Title>
        <p>You do not have permission to create therapist accounts.</p>
      </div>
    );
  }

  return (
    <RoleGuard requiredPermission="canCreateTherapists">
      <div style={{ padding: '24px' }}>
        <Card style={{ marginBottom: '24px' }}>
          <Row gutter={24} align="middle">
            <Col>
              <Button 
                icon={<ArrowLeftOutlined />} 
                onClick={() => navigate('/therapists')}
              >
                Back to Therapists
              </Button>
            </Col>
            <Col flex="auto">
              <Title level={2} style={{ margin: 0 }}>
                Create New Therapist Account
              </Title>
            </Col>
          </Row>
        </Card>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          size="large"
          initialValues={{
            is_active: true,
            address_verified: false,
            service_radius_km: 25
          }}
        >
          <Row gutter={24}>
            <Col span={12}>
              <Card title="Account Information" style={{ marginBottom: '24px' }}>
                <Form.Item
                  name="email"
                  label="Email Address"
                  rules={[
                    { required: true, message: 'Please enter email address' },
                    { type: 'email', message: 'Please enter a valid email' }
                  ]}
                >
                  <Input placeholder="Enter email address" />
                </Form.Item>

                <Form.Item
                  name="password"
                  label="Password"
                  rules={[
                    { required: true, message: 'Please enter password' },
                    { min: 6, message: 'Password must be at least 6 characters' }
                  ]}
                >
                  <Input.Password placeholder="Enter password" />
                </Form.Item>

                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                  <Avatar
                    size={80}
                    src={profileImage}
                    icon={<UserOutlined />}
                    style={{ marginBottom: '16px' }}
                  />
                  <br />
                  <Upload
                    accept="image/*"
                    beforeUpload={handleImageUpload}
                    showUploadList={false}
                  >
                    <Button icon={<UploadOutlined />} loading={uploadingImage}>
                      {uploadingImage ? 'Uploading...' : 'Upload Photo'}
                    </Button>
                  </Upload>
                </div>
              </Card>
            </Col>

            <Col span={12}>
              <Card title="Personal Information" style={{ marginBottom: '24px' }}>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name="first_name"
                      label="First Name"
                      rules={[{ required: true, message: 'Please enter first name' }]}
                    >
                      <Input placeholder="Enter first name" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name="last_name"
                      label="Last Name"
                      rules={[{ required: true, message: 'Please enter last name' }]}
                    >
                      <Input placeholder="Enter last name" />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item name="phone" label="Phone Number">
                  <Input placeholder="Enter phone number" />
                </Form.Item>

                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="gender" label="Gender">
                      <Select placeholder="Select gender">
                        <Option value="male">Male</Option>
                        <Option value="female">Female</Option>
                        <Option value="other">Other</Option>
                        <Option value="prefer_not_to_say">Prefer not to say</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="years_experience" label="Years of Experience">
                      <InputNumber 
                        placeholder="Years"
                        min={0}
                        max={50}
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col span={12}>
              <Card title="Business Information" style={{ marginBottom: '24px' }}>
                <Form.Item
                  name="business_abn"
                  label="Business ABN"
                  rules={[
                    { required: true, message: 'Please enter business ABN' },
                    { pattern: /^\d{11}$/, message: 'ABN must be 11 digits' }
                  ]}
                >
                  <Input placeholder="Enter 11-digit ABN" maxLength={11} />
                </Form.Item>

                <Form.Item name="bio" label="Biography">
                  <TextArea 
                    rows={4} 
                    placeholder="Enter therapist biography..."
                    maxLength={500}
                    showCount
                  />
                </Form.Item>

                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name="is_active"
                      label="Active Status"
                      valuePropName="checked"
                    >
                      <Switch 
                        checkedChildren="Active" 
                        unCheckedChildren="Inactive"
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name="address_verified"
                      label="Address Verified"
                      valuePropName="checked"
                    >
                      <Switch 
                        checkedChildren="Verified" 
                        unCheckedChildren="Unverified"
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>
            </Col>

            <Col span={12}>
              <Card title="Location & Service Area" style={{ marginBottom: '24px' }}>
                <Form.Item 
                  name="home_address" 
                  label="Home Address"
                  help={geocodeError ? <span style={{ color: '#ff4d4f' }}>{geocodeError}</span> : 
                        addressVerified ? <span style={{ color: '#52c41a' }}>✓ Address verified</span> : 
                        'Enter address for automatic verification'}
                >
                  <TextArea 
                    id="home_address"
                    rows={3} 
                    placeholder="Start typing address for autocomplete suggestions..."
                  />
                </Form.Item>

                <div style={{ marginBottom: '16px' }}>
                  <Button 
                    type="default"
                    loading={isGeocoding}
                    onClick={() => {
                      const address = form.getFieldValue('home_address');
                      if (address) {
                        geocodeAddress(address);
                      } else {
                        message.warning('Please enter an address first');
                      }
                    }}
                    icon={<EnvironmentOutlined />}
                    disabled={!form.getFieldValue('home_address')}
                  >
                    {isGeocoding ? 'Verifying...' : 'Verify Address'}
                  </Button>
                </div>

                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="latitude" label="Latitude">
                      <InputNumber 
                        placeholder="Auto-populated"
                        readOnly
                        style={{ width: '100%', backgroundColor: '#f5f5f5' }}
                        precision={6}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="longitude" label="Longitude">
                      <InputNumber 
                        placeholder="Auto-populated"
                        readOnly
                        style={{ width: '100%', backgroundColor: '#f5f5f5' }}
                        precision={6}
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item name="service_radius_km" label="Service Radius (km)">
                  <InputNumber 
                    placeholder="Radius in kilometers"
                    min={1}
                    max={100}
                    style={{ width: '100%' }}
                  />
                </Form.Item>

                <div style={{ padding: '16px', backgroundColor: '#f6f6f6', borderRadius: '8px' }}>
                  <Text type="secondary">
                    <strong>Note:</strong> The therapist can edit their profile, manage services, and set availability after account creation.
                  </Text>
                </div>
              </Card>
            </Col>
          </Row>

          <Card>
            <div style={{ textAlign: 'center' }}>
              <Space size="large">
                <Button 
                  size="large"
                  onClick={() => navigate('/therapists')}
                >
                  Cancel
                </Button>
                <Button 
                  type="primary"
                  size="large"
                  htmlType="submit"
                  icon={<UserAddOutlined />}
                  loading={saving}
                >
                  Create Therapist Account
                </Button>
              </Space>
            </div>
          </Card>
        </Form>
      </div>
    </RoleGuard>
  );
};

export default TherapistCreate;
