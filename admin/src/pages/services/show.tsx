import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Row,
  Col,
  Typography,
  Space,
  Tag,
  Image,
  Descriptions,
  Statistic,
  Spin,
  Divider
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  DollarOutlined,
  ClockCircleOutlined,
  StarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileImageOutlined,
  UserOutlined
} from '@ant-design/icons';
import { useGetIdentity, useNavigation } from '@refinedev/core';
import { useParams } from 'react-router';
import { RoleGuard } from '../../components/RoleGuard';
import { supabaseClient } from '../../utility';

const { Title, Text, Paragraph } = Typography;

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
}

interface ServiceWithCreator extends Service {
  creator?: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

const ServiceShow: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [service, setService] = useState<ServiceWithCreator | null>(null);
  const { id } = useParams<{ id: string }>();
  const { data: identity } = useGetIdentity<any>();
  const { list, edit } = useNavigation();

  const canEditServices = identity?.role === 'admin' || identity?.role === 'super_admin';

  useEffect(() => {
    if (id) {
      loadService(id);
    }
  }, [id]);

  const loadService = async (serviceId: string) => {
    try {
      setLoading(true);

      const { data, error } = await supabaseClient
        .from('services')
        .select(`
          *,
          creator:admin_users!services_created_by_fkey(first_name, last_name, email)
        `)
        .eq('id', serviceId)
        .single();

      if (error) throw error;
      setService(data);

    } catch (error: any) {
      console.error('Error loading service:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    list('services');
  };

  if (loading) {
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
    <RoleGuard requiredPermission="canViewServices">
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
              <Row justify="space-between" align="middle">
                <Col>
                  <Title level={2} style={{ margin: 0 }}>
                    {service.name}
                  </Title>
                  <Space style={{ marginTop: '8px' }}>
                    <Tag color={service.is_active ? 'green' : 'red'}>
                      {service.is_active ? (
                        <>
                          <CheckCircleOutlined /> Active
                        </>
                      ) : (
                        <>
                          <CloseCircleOutlined /> Inactive
                        </>
                      )}
                    </Tag>
                    <Tag color="blue">
                      <DollarOutlined /> ${service.service_base_price}
                    </Tag>
                    <Tag color="green">
                      <ClockCircleOutlined /> {service.minimum_duration}min
                    </Tag>
                  </Space>
                </Col>
                <Col>
                  {canEditServices && (
                    <Button
                      type="primary"
                      icon={<EditOutlined />}
                      onClick={() => edit('services', service.id)}
                      size="large"
                    >
                      Edit Service
                    </Button>
                  )}
                </Col>
              </Row>
            </div>

            <Row gutter={24}>
              <Col span={16}>
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                  {/* Service Image */}
                  <Card title="Service Image" size="small">
                    <div style={{ textAlign: 'center' }}>
                      {service.image_url ? (
                        <Image
                          src={service.image_url}
                          alt={service.image_alt || service.name}
                          style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '8px' }}
                        />
                      ) : (
                        <div 
                          style={{ 
                            width: '100%', 
                            height: '200px', 
                            backgroundColor: '#f0f0f0', 
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexDirection: 'column'
                          }}
                        >
                          <FileImageOutlined style={{ fontSize: '48px', color: '#999', marginBottom: '16px' }} />
                          <Text type="secondary">No image uploaded</Text>
                        </div>
                      )}
                    </div>
                  </Card>

                  {/* Description */}
                  <Card title="Description" size="small">
                    {service.short_description && (
                      <div style={{ marginBottom: '16px' }}>
                        <Text strong>Short Description:</Text>
                        <Paragraph style={{ marginTop: '8px', fontSize: '16px' }}>
                          {service.short_description}
                        </Paragraph>
                      </div>
                    )}
                    
                    {service.description ? (
                      <div>
                        <Text strong>Full Description:</Text>
                        <Paragraph style={{ marginTop: '8px' }}>
                          {service.description}
                        </Paragraph>
                      </div>
                    ) : (
                      <Text type="secondary">No detailed description provided</Text>
                    )}
                  </Card>
                </Space>
              </Col>

              <Col span={8}>
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                  {/* Performance Statistics */}
                  <Card title="Performance" size="small">
                    <Row gutter={16}>
                      <Col span={12}>
                        <Statistic
                          title="Total Bookings"
                          value={service.total_bookings}
                          prefix={<span style={{ color: '#1890ff' }}>📋</span>}
                        />
                      </Col>
                      <Col span={12}>
                        <Statistic
                          title="Avg Rating"
                          value={service.average_rating > 0 ? service.average_rating.toFixed(1) : 'No rating'}
                          prefix={<StarOutlined style={{ color: '#faad14' }} />}
                        />
                      </Col>
                    </Row>
                    <Divider />
                    <Statistic
                      title="Popularity Score"
                      value={service.popularity_score}
                      prefix={<span style={{ color: '#52c41a' }}>📈</span>}
                    />
                  </Card>

                  {/* Service Details */}
                  <Card title="Service Details" size="small">
                    <Descriptions column={1} size="small">
                      <Descriptions.Item label="Base Price">
                        <Space>
                          <DollarOutlined style={{ color: '#1890ff' }} />
                          <Text strong>${service.service_base_price}</Text>
                        </Space>
                      </Descriptions.Item>
                      <Descriptions.Item label="Minimum Duration">
                        <Space>
                          <ClockCircleOutlined style={{ color: '#52c41a' }} />
                          <Text>{service.minimum_duration} minutes</Text>
                        </Space>
                      </Descriptions.Item>
                      <Descriptions.Item label="Sort Order">
                        {service.sort_order}
                      </Descriptions.Item>
                      <Descriptions.Item label="Status">
                        <Tag color={service.is_active ? 'green' : 'red'}>
                          {service.is_active ? 'Active' : 'Inactive'}
                        </Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="Booking Type">
                        <Tag color={service.quote_only ? 'purple' : 'blue'}>
                          {service.quote_only ? 'Quote Only' : 'Regular Booking'}
                        </Tag>
                      </Descriptions.Item>
                    </Descriptions>
                  </Card>

                  {/* Audit Information */}
                  <Card title="Audit Information" size="small">
                    <Descriptions column={1} size="small">
                      {service.creator && (
                        <Descriptions.Item label="Created By">
                          <Space>
                            <UserOutlined style={{ color: '#666' }} />
                            <Text>
                              {service.creator.first_name} {service.creator.last_name}
                            </Text>
                          </Space>
                          <div style={{ fontSize: '12px', color: '#999' }}>
                            {service.creator.email}
                          </div>
                        </Descriptions.Item>
                      )}
                      {service.created_at && (
                        <Descriptions.Item label="Created">
                          {new Date(service.created_at).toLocaleString()}
                        </Descriptions.Item>
                      )}
                      {service.updated_at && (
                        <Descriptions.Item label="Last Updated">
                          {new Date(service.updated_at).toLocaleString()}
                        </Descriptions.Item>
                      )}
                    </Descriptions>
                  </Card>
                </Space>
              </Col>
            </Row>
          </Space>
        </Card>
      </div>
    </RoleGuard>
  );
};

export default ServiceShow;