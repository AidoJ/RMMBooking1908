import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  InputNumber,
  Button,
  Row,
  Col,
  Switch,
  Select,
  AutoComplete,
  message,
  Typography,
  Space,
  Upload,
  Divider,
  Spin,
  Statistic
} from 'antd';
import {
  SaveOutlined,
  ArrowLeftOutlined,
  PlusOutlined,
  DollarOutlined,
  ClockCircleOutlined,
  StarOutlined
} from '@ant-design/icons';
import { useGetIdentity, useNavigation } from '@refinedev/core';
import { useParams } from 'react-router';
import { RoleGuard } from '../../components/RoleGuard';
import adminDataService from '../../services/adminDataService';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface Service {
  id: string;
  name: string;
  description?: string;
  short_description?: string;
  image_url?: string;
  image_alt?: string;
  is_active: boolean;
  sort_order: number;
  service_base_price: number;
  minimum_duration: number;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  popularity_score: number;
  total_bookings: number;
  average_rating: number;
  quote_only?: boolean;
  category?: string;
}

interface ServiceFormData {
  name: string;
  description?: string;
  short_description?: string;
  image_url?: string;
  image_alt?: string;
  is_active: boolean;
  sort_order: number;
  service_base_price: number;
  minimum_duration: number;
  quote_only: boolean;
  category: string;
}

const ServiceEdit: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [service, setService] = useState<Service | null>(null);
  const [fileList, setFileList] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const { id } = useParams<{ id: string }>();
  const { data: identity } = useGetIdentity<any>();
  const { list } = useNavigation();

  useEffect(() => {
    loadCategories();
    if (id) {
      loadService(id);
    }
  }, [id]);

  const loadCategories = async () => {
    try {
      const { data, error } = await adminDataService
        .from('services')
        .select('category')
        .not('category', 'is', null);

      if (error) throw error;

      // Get unique categories
      const uniqueCategories = [...new Set(data.map(s => s.category))].filter(Boolean) as string[];
      setCategories(uniqueCategories.sort());

    } catch (error) {
      console.error('Error loading categories:', error);
      // Fallback to default categories
      setCategories(['Massage', 'Alternative Therapies', 'Group Events', 'Corporate Events']);
    }
  };

  const loadService = async (serviceId: string) => {
    try {
      setInitialLoading(true);

      const { data, error } = await adminDataService
        .from('services')
        .select('*')
        .eq('id', serviceId)
        .single();

      if (error) throw error;

      setService(data);
      form.setFieldsValue(data);

      if (data.image_url) {
        setFileList([{
          uid: '1',
          name: 'service-image.jpg',
          status: 'done',
          url: data.image_url
        }]);
      }

    } catch (error: any) {
      console.error('Error loading service:', error);
      message.error('Failed to load service');
    } finally {
      setInitialLoading(false);
    }
  };

  const handleImageUpload = async (file: any) => {
    try {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    } catch (error) {
      console.error('Error processing image:', error);
      throw error;
    }
  };

  const handleSubmit = async (values: ServiceFormData) => {
    if (!service) return;

    try {
      setLoading(true);

      let imageUrl = values.image_url;

      // Handle image upload
      if (fileList.length > 0 && fileList[0].originFileObj) {
        imageUrl = await handleImageUpload(fileList[0].originFileObj) as string;
      }

      // Only send fields that exist in the form - preserve existing quote fields
      const serviceData = {
        name: values.name,
        description: values.description,
        short_description: values.short_description,
        image_url: imageUrl,
        image_alt: values.image_alt,
        is_active: values.is_active,
        sort_order: values.sort_order,
        service_base_price: values.service_base_price,
        minimum_duration: values.minimum_duration,
        quote_only: values.quote_only,
        category: values.category,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await adminDataService
        .from('services')
        .update(serviceData)
        .eq('id', service.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating service:', error);
        throw error;
      }

      if (!data) {
        throw new Error('Update failed - no data returned');
      }

      message.success('Service updated successfully!');
      setService(data);

    } catch (error: any) {
      console.error('Error updating service:', error);
      message.error('Failed to update service');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    list('services');
  };

  const uploadProps = {
    name: 'file',
    listType: 'picture-card' as const,
    fileList: fileList,
    beforeUpload: () => false,
    onChange: ({ fileList: newFileList }: any) => {
      setFileList(newFileList);
    },
    onPreview: (file: any) => {
      const src = file.url || file.preview;
      if (src) {
        const imgWindow = window.open(src);
        imgWindow?.document.write(`<img src="${src}" style="width: 100%;" />`);
      }
    }
  };

  if (initialLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!service) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Text type="danger">Service not found</Text>
      </div>
    );
  }

  return (
    <RoleGuard requiredPermission="canEditServices">
      <div style={{ padding: '24px' }}>
        <Card>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div>
              <Button 
                icon={<ArrowLeftOutlined />} 
                onClick={handleBack}
                style={{ marginBottom: '16px' }}
              >
                Back to Services
              </Button>
              <Title level={2} style={{ margin: 0 }}>
                Edit Service
              </Title>
            </div>

            {/* Performance Statistics */}
            <Row gutter={16}>
              <Col span={6}>
                <Card size="small">
                  <Statistic
                    title="Total Bookings"
                    value={service.total_bookings}
                    prefix={<span style={{ color: '#1890ff' }}>📋</span>}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic
                    title="Average Rating"
                    value={service.average_rating > 0 ? service.average_rating.toFixed(1) : 'No rating'}
                    prefix={<StarOutlined style={{ color: '#faad14' }} />}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic
                    title="Popularity Score"
                    value={service.popularity_score}
                    prefix={<span style={{ color: '#52c41a' }}>📈</span>}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    Created: {service.created_at ? new Date(service.created_at).toLocaleDateString() : 'Unknown'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    Updated: {service.updated_at ? new Date(service.updated_at).toLocaleDateString() : 'Unknown'}
                  </div>
                </Card>
              </Col>
            </Row>

            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
            >
              <Row gutter={24}>
                <Col span={16}>
                  <Card title="Basic Information" size="small">
                    <Form.Item
                      label="Service Name"
                      name="name"
                      rules={[
                        { required: true, message: 'Please enter service name' },
                        { min: 2, message: 'Service name must be at least 2 characters' }
                      ]}
                    >
                      <Input 
                        placeholder="e.g., Deep Tissue Massage"
                        size="large"
                      />
                    </Form.Item>

                    <Form.Item
                      label="Short Description"
                      name="short_description"
                      help="Brief description for service cards and lists (recommended)"
                    >
                      <Input 
                        placeholder="e.g., Therapeutic massage targeting muscle tension"
                        maxLength={100}
                        showCount
                      />
                    </Form.Item>

                    <Form.Item
                      label="Full Description"
                      name="description"
                      help="Detailed description for service details page"
                    >
                      <TextArea
                        rows={4}
                        placeholder="Detailed description of the service, benefits, what customers can expect..."
                        maxLength={1000}
                        showCount
                      />
                    </Form.Item>
                  </Card>

                  <Card title="Pricing & Duration" size="small" style={{ marginTop: '16px' }}>
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item
                          label="Base Price"
                          name="service_base_price"
                          rules={[
                            { required: true, message: 'Please enter base price' },
                            { type: 'number', min: 0, message: 'Price must be positive' }
                          ]}
                        >
                          <InputNumber
                            prefix={<DollarOutlined />}
                            style={{ width: '100%' }}
                            min={0}
                            step={5}
                            precision={2}
                            size="large"
                          />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item
                          label="Minimum Duration (minutes)"
                          name="minimum_duration"
                          rules={[
                            { required: true, message: 'Please enter minimum duration' },
                            { type: 'number', min: 15, message: 'Duration must be at least 15 minutes' }
                          ]}
                        >
                          <InputNumber
                            prefix={<ClockCircleOutlined />}
                            style={{ width: '100%' }}
                            min={15}
                            step={15}
                            size="large"
                          />
                        </Form.Item>
                      </Col>
                    </Row>
                  </Card>
                </Col>

                <Col span={8}>
                  <Card title="Service Image" size="small">
                    <Form.Item
                      label="Upload Image"
                      help="Recommended size: 400x300px"
                    >
                      <Upload {...uploadProps}>
                        {fileList.length >= 1 ? null : (
                          <div>
                            <PlusOutlined style={{ fontSize: 24, marginBottom: 8 }} />
                            <div>Upload Image</div>
                          </div>
                        )}
                      </Upload>
                    </Form.Item>

                    <Form.Item
                      label="Image Alt Text"
                      name="image_alt"
                      help="Accessibility description for the image"
                    >
                      <Input placeholder="Describe the image for screen readers" />
                    </Form.Item>

                    <Divider />

                    <Form.Item
                      label="Sort Order"
                      name="sort_order"
                      help="Lower numbers appear first in lists"
                    >
                      <InputNumber
                        style={{ width: '100%' }}
                        min={0}
                        step={1}
                      />
                    </Form.Item>

                    <Form.Item
                      label="Active Status"
                      name="is_active"
                      valuePropName="checked"
                    >
                      <Switch
                        checkedChildren="Active"
                        unCheckedChildren="Inactive"
                      />
                    </Form.Item>
                    <Form.Item
                      label="Quote Only Service"
                      name="quote_only"
                      valuePropName="checked"
                      tooltip="When enabled, this service will require customers to request a quote instead of booking directly"
                    >
                      <Switch
                        checkedChildren="Quote Only"
                        unCheckedChildren="Regular Booking"
                      />
                    </Form.Item>

                    <Divider />

                    <Form.Item
                      label="Service Category"
                      name="category"
                      rules={[{ required: true, message: 'Please select or enter a category' }]}
                      tooltip="Type to create new or select existing category"
                    >
                      <AutoComplete
                        placeholder="Type category name..."
                        size="large"
                        options={categories.map(cat => ({ value: cat }))}
                        filterOption={(inputValue, option) =>
                          option!.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                        }
                      />
                    </Form.Item>
                  </Card>
                </Col>
              </Row>

              <div style={{ marginTop: '32px', textAlign: 'right' }}>
                <Space>
                  <Button size="large" onClick={handleBack}>
                    Cancel
                  </Button>
                  <Button
                    type="primary"
                    htmlType="submit"
                    size="large"
                    loading={loading}
                    icon={<SaveOutlined />}
                  >
                    Save Changes
                  </Button>
                </Space>
              </div>
            </Form>
          </Space>
        </Card>
      </div>
    </RoleGuard>
  );
};

export default ServiceEdit;