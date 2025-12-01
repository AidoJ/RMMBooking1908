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
  Divider
} from 'antd';
import {
  SaveOutlined,
  ArrowLeftOutlined,
  PlusOutlined,
  DollarOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import { useGetIdentity, useNavigation } from '@refinedev/core';
import { RoleGuard } from '../../components/RoleGuard';
import adminDataService from '../../services/adminDataService';

const { Title } = Typography;
const { TextArea } = Input;

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

const ServiceCreate: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [fileList, setFileList] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const { data: identity } = useGetIdentity<any>();
  const { list } = useNavigation();

  useEffect(() => {
    loadCategories();
  }, []);

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
    try {
      setLoading(true);

      let imageUrl = values.image_url;

      // Handle image upload
      if (fileList.length > 0 && fileList[0].originFileObj) {
        imageUrl = await handleImageUpload(fileList[0].originFileObj) as string;
      }

      const serviceData = {
        ...values,
        image_url: imageUrl,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: identity?.id,
        popularity_score: 0,
        total_bookings: 0,
        average_rating: 0.0
      };

      const { data, error } = await adminDataService
        .from('services')
        .insert([serviceData])
        .select()
        .single();

      if (error) throw error;

      message.success('Service created successfully!');
      list('services');

    } catch (error: any) {
      console.error('Error creating service:', error);
      message.error('Failed to create service');
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

  return (
    <RoleGuard requiredPermission="canCreateServices">
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
                Create New Service
              </Title>
            </div>

            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              initialValues={{
                is_active: true,
                quote_only: false,
                sort_order: 0,
                service_base_price: 90.00,
                minimum_duration: 30
              }}
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
                      tooltip="When enabled, customers must request a quote instead of booking directly"
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
                      tooltip="Select existing category or type to create a new one"
                    >
                      <Select
                        showSearch
                        placeholder="Select or type category name..."
                        size="large"
                        allowClear
                        mode="tags"
                        maxTagCount={1}
                        filterOption={(inputValue, option) =>
                          (option?.children as string)?.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                        }
                      >
                        {categories.map(cat => (
                          <Select.Option key={cat} value={cat}>
                            {cat}
                          </Select.Option>
                        ))}
                      </Select>
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
                    Create Service
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

export default ServiceCreate;