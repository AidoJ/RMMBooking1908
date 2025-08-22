import React, { useState, useEffect } from 'react';
import {
  Card,
  Tabs,
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
  Divider,
  Alert,
  Row,
  Col,
} from 'antd';
import {
  SaveOutlined,
  ReloadOutlined,
  SettingOutlined,
  DollarOutlined,
  CalendarOutlined,
  CarOutlined,
  PhoneOutlined,
  ApiOutlined,
  ExperimentOutlined,
  LockOutlined,
} from '@ant-design/icons';
import { useGetIdentity } from '@refinedev/core';
import { RoleGuard } from '../../components/RoleGuard';
import { supabaseClient } from '../../utility';
import { UserIdentity } from '../../utils/roleUtils';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { TabPane } = Tabs;
const { Option } = Select;

// Setting data types and validation
interface SystemSetting {
  id?: string;
  key: string;
  value: string;
  category: string;
  data_type: string;
  description: string;
  is_sensitive?: boolean;
  updated_at?: string;
}

interface SettingFormValues {
  [key: string]: any;
}

const SystemSettings: React.FC = () => {
  const { data: identity } = useGetIdentity<UserIdentity>();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [activeTab, setActiveTab] = useState('business');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabaseClient
        .from('system_settings')
        .select('*')
        .order('key');

      if (error) throw error;

      setSettings(data || []);
      
      // Transform settings for form
      const formValues: SettingFormValues = {};
      (data || []).forEach((setting: SystemSetting) => {
        const value = parseSettingValue(setting.value, setting.data_type);
        formValues[setting.key] = value;
      });
      
      form.setFieldsValue(formValues);
      
    } catch (error: any) {
      console.error('Error loading settings:', error);
      message.error('Failed to load system settings');
    } finally {
      setLoading(false);
    }
  };

  const parseSettingValue = (value: string, dataType: string) => {
    if (!value) return '';
    
    switch (dataType) {
      case 'boolean':
        return value === 'true';
      case 'integer':
        return parseInt(value);
      case 'decimal':
        return parseFloat(value);
      default:
        return value;
    }
  };

  const formatSettingValue = (value: any, dataType: string): string => {
    if (value === undefined || value === null) return '';
    
    switch (dataType) {
      case 'boolean':
        return value.toString();
      case 'integer':
      case 'decimal':
        return value.toString();
      default:
        return String(value);
    }
  };

  const handleSave = async (values: SettingFormValues) => {
    try {
      setSaving(true);
      
      // Prepare updates for each changed setting
      const updates = Object.keys(values).map(key => {
        const setting = settings.find(s => s.key === key);
        if (!setting) return null;
        
        const formattedValue = formatSettingValue(values[key], setting.data_type);
        
        return {
          id: setting.id,
          key: setting.key,
          value: formattedValue,
          updated_at: new Date().toISOString(),
        };
      }).filter(Boolean);

      // Update settings in database
      for (const update of updates) {
        const { error } = await supabaseClient
          .from('system_settings')
          .update({
            value: update!.value,
            updated_at: update!.updated_at,
          })
          .eq('key', update!.key);

        if (error) throw error;
      }

      message.success('System settings updated successfully');
      loadSettings(); // Reload to ensure data consistency
      
    } catch (error: any) {
      console.error('Error saving settings:', error);
      message.error('Failed to save system settings');
    } finally {
      setSaving(false);
    }
  };

  const initializeDefaultSettings = async () => {
    const defaultSettings: Omit<SystemSetting, 'id' | 'updated_at'>[] = [
      // Business Configuration
      { key: 'company_name', value: 'Rejuvenators Mobile Massage', category: 'business', data_type: 'string', description: 'Company display name' },
      { key: 'company_email', value: 'info@rejuvenators.com', category: 'business', data_type: 'email', description: 'Primary business email' },
      { key: 'company_phone', value: '+61 XXX XXX XXX', category: 'business', data_type: 'phone', description: 'Business contact number' },
      { key: 'business_timezone', value: 'Australia/Sydney', category: 'business', data_type: 'string', description: 'Default timezone' },
      { key: 'default_currency', value: 'AUD', category: 'business', data_type: 'string', description: 'Default currency code' },
      
      // Pricing Configuration
      { key: 'global_service_base_price', value: '90.00', category: 'pricing', data_type: 'decimal', description: 'Global default service price' },
      { key: 'platform_commission_rate', value: '0.15', category: 'pricing', data_type: 'decimal', description: 'Platform commission percentage' },
      { key: 'payment_processing_fee', value: '0.029', category: 'pricing', data_type: 'decimal', description: 'Stripe processing fee' },
      { key: 'gst_rate', value: '0.10', category: 'pricing', data_type: 'decimal', description: 'GST rate for Australian services' },
      { key: 'late_cancellation_fee', value: '25.00', category: 'pricing', data_type: 'decimal', description: 'Late cancellation penalty' },
      
      // Booking Management
      { key: 'max_booking_advance_days', value: '30', category: 'booking', data_type: 'integer', description: 'Maximum days to book ahead' },
      { key: 'min_cancellation_hours', value: '24', category: 'booking', data_type: 'integer', description: 'Free cancellation deadline' },
      { key: 'auto_confirm_bookings', value: 'false', category: 'booking', data_type: 'boolean', description: 'Auto-confirm new bookings' },
      { key: 'require_payment_authorization', value: 'true', category: 'booking', data_type: 'boolean', description: 'Require payment upfront' },
      { key: 'max_daily_bookings_per_therapist', value: '8', category: 'booking', data_type: 'integer', description: 'Daily booking limit per therapist' },
      { key: 'therapist_response_timeout_minutes', value: '30', category: 'booking', data_type: 'integer', description: 'Minutes for therapist to respond' },
      
      // Operations
      { key: 'default_service_radius_km', value: '25', category: 'operations', data_type: 'integer', description: 'Default therapist service radius' },
      { key: 'max_service_radius_km', value: '50', category: 'operations', data_type: 'integer', description: 'Maximum allowed service radius' },
      { key: 'travel_time_buffer_minutes', value: '15', category: 'operations', data_type: 'integer', description: 'Travel time between bookings' },
      { key: 'setup_cleanup_time_minutes', value: '10', category: 'operations', data_type: 'integer', description: 'Setup and cleanup time' },
      { key: 'minimum_booking_duration', value: '30', category: 'operations', data_type: 'integer', description: 'Minimum service duration' },
      
      // Communications
      { key: 'sms_notifications_enabled', value: 'true', category: 'communication', data_type: 'boolean', description: 'Enable SMS notifications' },
      { key: 'email_notifications_enabled', value: 'true', category: 'communication', data_type: 'boolean', description: 'Enable email notifications' },
      { key: 'booking_confirmation_timeout_hours', value: '2', category: 'communication', data_type: 'integer', description: 'Customer confirmation deadline' },
      { key: 'reminder_sms_hours_before', value: '4', category: 'communication', data_type: 'integer', description: 'Hours before service for reminder' },
      
      // Integrations (Sensitive)
      { key: 'stripe_publishable_key', value: '', category: 'integration', data_type: 'string', description: 'Stripe publishable key', is_sensitive: false },
      { key: 'stripe_secret_key', value: '', category: 'integration', data_type: 'string', description: 'Stripe secret key', is_sensitive: true },
      { key: 'twilio_account_sid', value: '', category: 'integration', data_type: 'string', description: 'Twilio Account SID', is_sensitive: true },
      { key: 'twilio_auth_token', value: '', category: 'integration', data_type: 'string', description: 'Twilio Auth Token', is_sensitive: true },
      { key: 'twilio_phone_number', value: '', category: 'integration', data_type: 'string', description: 'Twilio SMS phone number', is_sensitive: false },
      { key: 'google_maps_api_key', value: '', category: 'integration', data_type: 'string', description: 'Google Maps API Key', is_sensitive: true },
      { key: 'emailjs_service_id', value: '', category: 'integration', data_type: 'string', description: 'EmailJS Service ID', is_sensitive: false },
      { key: 'emailjs_template_id', value: '', category: 'integration', data_type: 'string', description: 'EmailJS Template ID', is_sensitive: false },
      { key: 'emailjs_public_key', value: '', category: 'integration', data_type: 'string', description: 'EmailJS Public Key', is_sensitive: false },
      
      // Feature Flags
      { key: 'enable_guest_bookings', value: 'true', category: 'features', data_type: 'boolean', description: 'Allow guest bookings without registration' },
      { key: 'enable_online_payments', value: 'true', category: 'features', data_type: 'boolean', description: 'Process payments online via Stripe' },
      { key: 'enable_sms_confirmations', value: 'true', category: 'features', data_type: 'boolean', description: 'Send SMS booking confirmations' },
      { key: 'enable_therapist_ratings', value: 'true', category: 'features', data_type: 'boolean', description: 'Customer rating system for therapists' },
      { key: 'enable_automatic_matching', value: 'false', category: 'features', data_type: 'boolean', description: 'Auto-assign therapists to bookings' },
      { key: 'enable_weekend_bookings', value: 'true', category: 'features', data_type: 'boolean', description: 'Allow weekend service bookings' },
      { key: 'enable_therapist_selection', value: 'true', category: 'features', data_type: 'boolean', description: 'Allow customers to choose specific therapists' },
      { key: 'enable_address_geocoding', value: 'true', category: 'features', data_type: 'boolean', description: 'Verify and geocode customer addresses' },
    ];

    try {
      for (const setting of defaultSettings) {
        const { error } = await supabaseClient
          .from('system_settings')
          .upsert(setting, { onConflict: 'key' });
        
        if (error) throw error;
      }
      
      message.success('Default settings initialized');
      loadSettings();
    } catch (error: any) {
      console.error('Error initializing settings:', error);
      message.error('Failed to initialize default settings');
    }
  };

  const renderBusinessSettings = () => (
    <Card title={<><SettingOutlined /> Business Profile</>}>
      <Row gutter={24}>
        <Col span={12}>
          <Form.Item
            label="Company Name"
            name="company_name"
            rules={[{ required: true, message: 'Company name is required' }]}
          >
            <Input placeholder="Enter company name" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            label="Business Email"
            name="company_email"
            rules={[
              { required: true, message: 'Business email is required' },
              { type: 'email', message: 'Please enter a valid email' }
            ]}
          >
            <Input placeholder="Enter business email" />
          </Form.Item>
        </Col>
      </Row>
      
      <Row gutter={24}>
        <Col span={12}>
          <Form.Item
            label="Business Phone"
            name="company_phone"
            rules={[{ required: true, message: 'Business phone is required' }]}
          >
            <Input placeholder="Enter business phone" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            label="Default Currency"
            name="default_currency"
            rules={[{ required: true, message: 'Currency is required' }]}
          >
            <Select placeholder="Select currency">
              <Option value="AUD">AUD - Australian Dollar</Option>
              <Option value="USD">USD - US Dollar</Option>
              <Option value="EUR">EUR - Euro</Option>
              <Option value="GBP">GBP - British Pound</Option>
            </Select>
          </Form.Item>
        </Col>
      </Row>
      
      <Form.Item
        label="Business Timezone"
        name="business_timezone"
        rules={[{ required: true, message: 'Timezone is required' }]}
      >
        <Select placeholder="Select timezone">
          <Option value="Australia/Sydney">Australia/Sydney</Option>
          <Option value="Australia/Melbourne">Australia/Melbourne</Option>
          <Option value="Australia/Brisbane">Australia/Brisbane</Option>
          <Option value="Australia/Adelaide">Australia/Adelaide</Option>
          <Option value="Australia/Perth">Australia/Perth</Option>
        </Select>
      </Form.Item>
    </Card>
  );

  const renderPricingSettings = () => (
    <Card title={<><DollarOutlined /> Pricing & Payments</>}>
      <Row gutter={24}>
        <Col span={12}>
          <Form.Item
            label="Global Service Base Price"
            name="global_service_base_price"
            rules={[{ required: true, message: 'Base price is required' }]}
            extra="Default price for all services (can be overridden per service)"
          >
            <InputNumber
              min={0}
              precision={2}
              style={{ width: '100%' }}
              formatter={(value) => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(value) => parseFloat(value!.replace(/\$\s?|(,*)/g, '') || '0') as any}
            />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            label="Late Cancellation Fee"
            name="late_cancellation_fee"
            rules={[{ required: true, message: 'Cancellation fee is required' }]}
            extra="Fee charged for cancellations within the minimum notice period"
          >
            <InputNumber
              min={0}
              precision={2}
              style={{ width: '100%' }}
              formatter={(value) => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(value) => parseFloat(value!.replace(/\$\s?|(,*)/g, '') || '0') as any}
            />
          </Form.Item>
        </Col>
      </Row>
      
      <Row gutter={24}>
        <Col span={12}>
          <Form.Item
            label="Platform Commission Rate"
            name="platform_commission_rate"
            rules={[{ required: true, message: 'Commission rate is required' }]}
            extra="Percentage taken by platform from each booking"
          >
            <InputNumber
              min={0}
              max={1}
              precision={3}
              style={{ width: '100%' }}
              formatter={(value) => `${((value || 0) * 100).toFixed(1)}%`}
              parser={(value) => (parseFloat(value!.replace('%', '') || '0') / 100) as any}
            />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            label="Payment Processing Fee"
            name="payment_processing_fee"
            rules={[{ required: true, message: 'Processing fee is required' }]}
            extra="Stripe processing fee percentage"
          >
            <InputNumber
              min={0}
              max={1}
              precision={3}
              style={{ width: '100%' }}
              formatter={(value) => `${((value || 0) * 100).toFixed(1)}%`}
              parser={(value) => (parseFloat(value!.replace('%', '') || '0') / 100) as any}
            />
          </Form.Item>
        </Col>
      </Row>
      
      <Form.Item
        label="GST Rate"
        name="gst_rate"
        rules={[{ required: true, message: 'GST rate is required' }]}
        extra="Goods and Services Tax rate for Australian services"
      >
        <InputNumber
          min={0}
          max={1}
          precision={2}
          style={{ width: '50%' }}
          formatter={(value) => `${((value || 0) * 100).toFixed(0)}%`}
          parser={(value) => (parseFloat(value!.replace('%', '') || '0') / 100) as any}
        />
      </Form.Item>
    </Card>
  );

  const renderBookingSettings = () => (
    <Card title={<><CalendarOutlined /> Booking Management</>}>
      <Row gutter={24}>
        <Col span={12}>
          <Form.Item
            label="Maximum Advance Booking (Days)"
            name="max_booking_advance_days"
            rules={[{ required: true, message: 'Max advance days is required' }]}
            extra="How far in advance customers can book services"
          >
            <InputNumber min={1} max={365} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            label="Minimum Cancellation Notice (Hours)"
            name="min_cancellation_hours"
            rules={[{ required: true, message: 'Min cancellation hours is required' }]}
            extra="Minimum hours before service for free cancellation"
          >
            <InputNumber min={1} max={168} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>
      
      <Row gutter={24}>
        <Col span={12}>
          <Form.Item
            label="Max Daily Bookings per Therapist"
            name="max_daily_bookings_per_therapist"
            rules={[{ required: true, message: 'Max daily bookings is required' }]}
            extra="Maximum number of bookings a therapist can have per day"
          >
            <InputNumber min={1} max={20} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            label="Therapist Response Timeout (Minutes)"
            name="therapist_response_timeout_minutes"
            rules={[{ required: true, message: 'Response timeout is required' }]}
            extra="Minutes therapist has to respond to booking request"
          >
            <InputNumber min={5} max={480} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>
      
      <Row gutter={24}>
        <Col span={12}>
          <Form.Item
            label="Auto-confirm Bookings"
            name="auto_confirm_bookings"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            Automatically confirm bookings without therapist approval
          </Text>
        </Col>
        <Col span={12}>
          <Form.Item
            label="Require Payment Authorization"
            name="require_payment_authorization"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            Require payment authorization before confirming booking
          </Text>
        </Col>
      </Row>
    </Card>
  );

  const renderOperationsSettings = () => (
    <Card title={<><CarOutlined /> Operations & Service Delivery</>}>
      <Row gutter={24}>
        <Col span={12}>
          <Form.Item
            label="Default Service Radius (km)"
            name="default_service_radius_km"
            rules={[{ required: true, message: 'Default service radius is required' }]}
            extra="Default radius for new therapists"
          >
            <InputNumber min={1} max={100} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            label="Maximum Service Radius (km)"
            name="max_service_radius_km"
            rules={[{ required: true, message: 'Max service radius is required' }]}
            extra="Maximum allowed service radius"
          >
            <InputNumber min={1} max={200} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>
      
      <Row gutter={24}>
        <Col span={12}>
          <Form.Item
            label="Travel Time Buffer (Minutes)"
            name="travel_time_buffer_minutes"
            rules={[{ required: true, message: 'Travel time buffer is required' }]}
            extra="Time allocated between bookings for travel"
          >
            <InputNumber min={5} max={60} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            label="Setup & Cleanup Time (Minutes)"
            name="setup_cleanup_time_minutes"
            rules={[{ required: true, message: 'Setup/cleanup time is required' }]}
            extra="Time allocated for service preparation and cleanup"
          >
            <InputNumber min={5} max={30} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>
      
      <Form.Item
        label="Minimum Booking Duration (Minutes)"
        name="minimum_booking_duration"
        rules={[{ required: true, message: 'Minimum duration is required' }]}
        extra="Minimum service duration allowed for bookings"
      >
        <InputNumber min={15} max={120} style={{ width: '50%' }} />
      </Form.Item>
    </Card>
  );

  const renderCommunicationSettings = () => (
    <Card title={<><PhoneOutlined /> Communications</>}>
      <Row gutter={24}>
        <Col span={12}>
          <Form.Item
            label="SMS Notifications"
            name="sms_notifications_enabled"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            Enable SMS notifications for booking updates
          </Text>
        </Col>
        <Col span={12}>
          <Form.Item
            label="Email Notifications"
            name="email_notifications_enabled"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            Enable email notifications for booking updates
          </Text>
        </Col>
      </Row>
      
      <Row gutter={24}>
        <Col span={12}>
          <Form.Item
            label="Booking Confirmation Timeout (Hours)"
            name="booking_confirmation_timeout_hours"
            rules={[{ required: true, message: 'Confirmation timeout is required' }]}
            extra="Hours customer has to confirm booking"
          >
            <InputNumber min={1} max={72} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            label="Reminder SMS Hours Before Service"
            name="reminder_sms_hours_before"
            rules={[{ required: true, message: 'Reminder timing is required' }]}
            extra="Hours before service to send reminder SMS"
          >
            <InputNumber min={1} max={48} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>
    </Card>
  );

  const renderIntegrationSettings = () => (
    <Card title={<><ApiOutlined /> Integration Settings</>} style={{ marginBottom: 16 }}>
      <Alert
        message="Sensitive Information"
        description="API keys and tokens are sensitive data. Only enter production values if you're confident about the security of this environment."
        type="warning"
        showIcon
        style={{ marginBottom: 24 }}
      />
      
      {/* Stripe Payment Integration */}
      <Card type="inner" title="💳 Stripe Payment Processing" style={{ marginBottom: 16 }}>
        <Row gutter={24}>
          <Col span={12}>
            <Form.Item
              label="Publishable Key"
              name="stripe_publishable_key"
              extra="Stripe public key (pk_live_... or pk_test_...)"
            >
              <Input placeholder="pk_live_..." />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="Secret Key"
              name="stripe_secret_key"
              extra="Stripe secret key (sk_live_... or sk_test_...)"
            >
              <Input.Password placeholder="sk_live_..." />
            </Form.Item>
          </Col>
        </Row>
      </Card>

      {/* Twilio SMS Integration */}
      <Card type="inner" title="📱 Twilio SMS Service" style={{ marginBottom: 16 }}>
        <Row gutter={24}>
          <Col span={8}>
            <Form.Item
              label="Account SID"
              name="twilio_account_sid"
              extra="Twilio Account SID"
            >
              <Input.Password placeholder="AC..." />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              label="Auth Token"
              name="twilio_auth_token"
              extra="Twilio Auth Token"
            >
              <Input.Password placeholder="Auth token..." />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              label="Phone Number"
              name="twilio_phone_number"
              extra="Twilio SMS phone number"
            >
              <Input placeholder="+61XXXXXXXXX" />
            </Form.Item>
          </Col>
        </Row>
      </Card>

      {/* Google Maps Integration */}
      <Card type="inner" title="🗺️ Google Maps API" style={{ marginBottom: 16 }}>
        <Form.Item
          label="Google Maps API Key"
          name="google_maps_api_key"
          extra="Required for address geocoding and maps functionality"
        >
          <Input.Password placeholder="AIza..." />
        </Form.Item>
      </Card>

      {/* EmailJS Integration */}
      <Card type="inner" title="📧 EmailJS Service">
        <Row gutter={24}>
          <Col span={8}>
            <Form.Item
              label="Service ID"
              name="emailjs_service_id"
              extra="EmailJS Service ID"
            >
              <Input placeholder="service_..." />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              label="Template ID"
              name="emailjs_template_id"
              extra="EmailJS Template ID"
            >
              <Input placeholder="template_..." />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              label="Public Key"
              name="emailjs_public_key"
              extra="EmailJS Public Key"
            >
              <Input placeholder="Public key..." />
            </Form.Item>
          </Col>
        </Row>
      </Card>
    </Card>
  );

  const renderFeatureFlags = () => (
    <Card title={<><ExperimentOutlined /> Feature Flags</>}>
      <Paragraph>
        Enable or disable platform features. Changes take effect immediately across the system.
      </Paragraph>
      
      {/* Core Features */}
      <Card type="inner" title="Core Platform Features" style={{ marginBottom: 16 }}>
        <Row gutter={24}>
          <Col span={12}>
            <Form.Item
              label="Guest Bookings"
              name="enable_guest_bookings"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Allow customers to book without creating an account
            </Text>
          </Col>
          <Col span={12}>
            <Form.Item
              label="Online Payments"
              name="enable_online_payments"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Process payments online via Stripe integration
            </Text>
          </Col>
        </Row>
        
        <Row gutter={24}>
          <Col span={12}>
            <Form.Item
              label="Weekend Bookings"
              name="enable_weekend_bookings"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Allow services on Saturday and Sunday
            </Text>
          </Col>
          <Col span={12}>
            <Form.Item
              label="Therapist Selection"
              name="enable_therapist_selection"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Allow customers to choose specific therapists
            </Text>
          </Col>
        </Row>
      </Card>

      {/* Communication Features */}
      <Card type="inner" title="Communication Features" style={{ marginBottom: 16 }}>
        <Row gutter={24}>
          <Col span={12}>
            <Form.Item
              label="SMS Confirmations"
              name="enable_sms_confirmations"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Send SMS notifications for booking confirmations
            </Text>
          </Col>
          <Col span={12}>
            <Form.Item
              label="Address Geocoding"
              name="enable_address_geocoding"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Verify and geocode customer addresses using Google Maps
            </Text>
          </Col>
        </Row>
      </Card>

      {/* Advanced Features */}
      <Card type="inner" title="Advanced Features">
        <Row gutter={24}>
          <Col span={12}>
            <Form.Item
              label="Therapist Ratings"
              name="enable_therapist_ratings"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Allow customers to rate and review therapists
            </Text>
          </Col>
          <Col span={12}>
            <Form.Item
              label="Automatic Matching"
              name="enable_automatic_matching"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Automatically assign available therapists to bookings
            </Text>
          </Col>
        </Row>
      </Card>
    </Card>
  );

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
          <Title level={2}>System Settings</Title>
          <Paragraph>
            Configure global system settings and business rules. These settings affect the entire platform.
          </Paragraph>
          
          {settings.length === 0 && (
            <Alert
              message="No Settings Found"
              description="Initialize default system settings to get started."
              type="warning"
              action={
                <Button size="small" onClick={initializeDefaultSettings}>
                  Initialize Default Settings
                </Button>
              }
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          size="large"
        >
          <Tabs activeKey={activeTab} onChange={setActiveTab}>
            <TabPane tab={<><SettingOutlined /> Business</>} key="business">
              {renderBusinessSettings()}
            </TabPane>
            
            <TabPane tab={<><DollarOutlined /> Pricing</>} key="pricing">
              {renderPricingSettings()}
            </TabPane>
            
            <TabPane tab={<><CalendarOutlined /> Bookings</>} key="bookings">
              {renderBookingSettings()}
            </TabPane>
            
            <TabPane tab={<><CarOutlined /> Operations</>} key="operations">
              {renderOperationsSettings()}
            </TabPane>
            
            <TabPane tab={<><PhoneOutlined /> Communications</>} key="communications">
              {renderCommunicationSettings()}
            </TabPane>
            
            <TabPane tab={<><ApiOutlined /> Integrations</>} key="integrations">
              {renderIntegrationSettings()}
            </TabPane>
            
            <TabPane tab={<><ExperimentOutlined /> Features</>} key="features">
              {renderFeatureFlags()}
            </TabPane>
          </Tabs>

          <Card style={{ marginTop: 24 }}>
            <div style={{ textAlign: 'center' }}>
              <Space size="large">
                <Button
                  size="large"
                  icon={<ReloadOutlined />}
                  onClick={loadSettings}
                >
                  Reset Changes
                </Button>
                <Button
                  type="primary"
                  size="large"
                  htmlType="submit"
                  icon={<SaveOutlined />}
                  loading={saving}
                >
                  Save Settings
                </Button>
              </Space>
            </div>
          </Card>
        </Form>
      </div>
    </RoleGuard>
  );
};

export default SystemSettings;