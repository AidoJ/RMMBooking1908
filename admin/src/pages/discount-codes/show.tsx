import React, { useEffect, useState } from 'react';
import {
  Card,
  Typography,
  Row,
  Col,
  Tag,
  Button,
  Space,
  Statistic,
  Descriptions,
  Progress,
  message,
  Spin,
  Divider,
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  DeleteOutlined,
  PercentageOutlined,
  DollarOutlined,
  CalendarOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useNavigation } from '@refinedev/core';
import { useParams } from 'react-router';
import { supabaseClient } from '../../utility';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

interface DiscountCode {
  id: string;
  code: string;
  description: string;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number;
  minimum_order_amount: number;
  maximum_discount_amount?: number;
  usage_limit?: number;
  usage_count: number;
  valid_from: string;
  valid_until?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const DiscountCodesShow: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [discountCode, setDiscountCode] = useState<DiscountCode | null>(null);
  const { list, edit } = useNavigation();
  const params = useParams();
  const id = params?.id as string;

  useEffect(() => {
    if (id) {
      fetchDiscountCode();
    }
  }, [id]);

  const fetchDiscountCode = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabaseClient
        .from('discount_codes')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setDiscountCode(data);
    } catch (error) {
      console.error('Error fetching discount code:', error);
      message.error('Failed to fetch discount code');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      const { error } = await supabaseClient
        .from('discount_codes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      message.success('Discount code deleted successfully');
      list('discount_codes');
    } catch (error) {
      console.error('Error deleting discount code:', error);
      message.error('Failed to delete discount code');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>Loading discount code...</div>
      </div>
    );
  }

  if (!discountCode) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Title level={4}>Discount code not found</Title>
        <Button onClick={() => list('discount_codes')}>
          Back to Discount Codes
        </Button>
      </div>
    );
  }

  const isExpired = discountCode.valid_until && dayjs(discountCode.valid_until).isBefore(dayjs());
  const isOverLimit = discountCode.usage_limit && discountCode.usage_count >= discountCode.usage_limit;
  const usagePercentage = discountCode.usage_limit 
    ? (discountCode.usage_count / discountCode.usage_limit) * 100 
    : 0;

  const getStatus = () => {
    if (!discountCode.is_active) return { color: 'red', text: 'Inactive' };
    if (isExpired) return { color: 'red', text: 'Expired' };
    if (isOverLimit) return { color: 'orange', text: 'Limit Reached' };
    return { color: 'green', text: 'Active' };
  };

  const status = getStatus();

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Space>
            <Button 
              type="text" 
              icon={<ArrowLeftOutlined />}
              onClick={() => list('discount_codes')}
            >
              Back to Discount Codes
            </Button>
            <Title level={2} style={{ margin: 0 }}>
              Discount Code Details
            </Title>
          </Space>
        </Col>
        <Col>
          <Space>
            <Button 
              type="primary"
              icon={<EditOutlined />}
              onClick={() => edit('discount_codes', discountCode.id)}
            >
              Edit
            </Button>
            <Button 
              danger
              icon={<DeleteOutlined />}
              onClick={handleDelete}
            >
              Delete
            </Button>
          </Space>
        </Col>
      </Row>

      <Row gutter={24}>
        {/* Main Details Card */}
        <Col span={16}>
          <Card title="Discount Code Information">
            <Descriptions column={1} bordered>
              <Descriptions.Item label="Code">
                <Text strong style={{ fontFamily: 'monospace', fontSize: '16px' }}>
                  {discountCode.code}
                </Text>
                <Tag color={status.color} style={{ marginLeft: 8 }}>
                  {status.text}
                </Tag>
              </Descriptions.Item>
              
              <Descriptions.Item label="Description">
                {discountCode.description}
              </Descriptions.Item>
              
              <Descriptions.Item label="Discount Type">
                <Tag color={discountCode.discount_type === 'percentage' ? 'blue' : 'green'}>
                  {discountCode.discount_type === 'percentage' ? (
                    <><PercentageOutlined /> Percentage</>
                  ) : (
                    <><DollarOutlined /> Fixed Amount</>
                  )}
                </Tag>
              </Descriptions.Item>
              
              <Descriptions.Item label="Discount Value">
                <Text strong style={{ fontSize: '16px' }}>
                  {discountCode.discount_type === 'percentage' 
                    ? `${discountCode.discount_value}%` 
                    : `$${discountCode.discount_value}`}
                </Text>
              </Descriptions.Item>
              
              <Descriptions.Item label="Minimum Order Amount">
                {discountCode.minimum_order_amount > 0 
                  ? `$${discountCode.minimum_order_amount}` 
                  : 'No minimum'}
              </Descriptions.Item>
              
              <Descriptions.Item label="Maximum Discount">
                {discountCode.maximum_discount_amount 
                  ? `$${discountCode.maximum_discount_amount}` 
                  : 'No maximum'}
              </Descriptions.Item>
              
              <Descriptions.Item label="Valid From">
                <Space>
                  <CalendarOutlined />
                  {dayjs(discountCode.valid_from).format('DD/MM/YYYY HH:mm')}
                </Space>
              </Descriptions.Item>
              
              <Descriptions.Item label="Valid Until">
                <Space>
                  <CalendarOutlined />
                  {discountCode.valid_until 
                    ? dayjs(discountCode.valid_until).format('DD/MM/YYYY HH:mm')
                    : 'No expiry'}
                </Space>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        {/* Statistics Card */}
        <Col span={8}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Card title="Usage Statistics">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Statistic
                  title="Times Used"
                  value={discountCode.usage_count}
                  prefix={<UserOutlined />}
                />
                
                <Divider style={{ margin: '12px 0' }} />
                
                <Statistic
                  title="Usage Limit"
                  value={discountCode.usage_limit || '∞'}
                  valueStyle={{ 
                    color: isOverLimit ? '#cf1322' : '#3f8600' 
                  }}
                />
                
                {discountCode.usage_limit && (
                  <>
                    <Divider style={{ margin: '12px 0' }} />
                    <div>
                      <Text type="secondary">Usage Progress</Text>
                      <Progress 
                        percent={usagePercentage} 
                        status={isOverLimit ? 'exception' : 'active'}
                        showInfo={true}
                        format={(percent) => `${discountCode.usage_count}/${discountCode.usage_limit}`}
                      />
                    </div>
                  </>
                )}
              </Space>
            </Card>

            <Card title="Timeline">
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <Text type="secondary">Created</Text>
                  <br />
                  <Text>{dayjs(discountCode.created_at).format('DD/MM/YYYY HH:mm')}</Text>
                </div>
                <Divider style={{ margin: '12px 0' }} />
                <div>
                  <Text type="secondary">Last Updated</Text>
                  <br />
                  <Text>{dayjs(discountCode.updated_at).format('DD/MM/YYYY HH:mm')}</Text>
                </div>
              </Space>
            </Card>
          </Space>
        </Col>
      </Row>
    </div>
  );
};

export default DiscountCodesShow;