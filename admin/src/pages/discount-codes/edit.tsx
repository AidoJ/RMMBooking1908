import React, { useEffect, useState } from 'react';
import {
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  Switch,
  Button,
  Card,
  Typography,
  Row,
  Col,
  message,
  Space,
  Spin,
} from 'antd';
import { ArrowLeftOutlined, SaveOutlined, PercentageOutlined, DollarOutlined } from '@ant-design/icons';
import { useNavigation } from '@refinedev/core';
import { useParams } from 'react-router';
import { supabaseClient } from '../../utility';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;
const { TextArea } = Input;

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
}

const DiscountCodesEdit: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [discountCode, setDiscountCode] = useState<DiscountCode | null>(null);
  const { list } = useNavigation();
  const params = useParams();
  const id = params?.id as string;

  useEffect(() => {
    if (id) {
      fetchDiscountCode();
    }
  }, [id]);

  const fetchDiscountCode = async () => {
    setFetchLoading(true);
    try {
      const { data, error } = await supabaseClient
        .from('discount_codes')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      setDiscountCode(data);
      
      // Set form values
      form.setFieldsValue({
        code: data.code,
        description: data.description,
        discount_type: data.discount_type,
        discount_value: data.discount_value,
        minimum_order_amount: data.minimum_order_amount,
        maximum_discount_amount: data.maximum_discount_amount,
        usage_limit: data.usage_limit,
        validity_period: [
          dayjs(data.valid_from),
          data.valid_until ? dayjs(data.valid_until) : null
        ].filter(Boolean),
        is_active: data.is_active,
      });
    } catch (error) {
      console.error('Error fetching discount code:', error);
      message.error('Failed to fetch discount code');
    } finally {
      setFetchLoading(false);
    }
  };

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const discountData = {
        code: values.code.toUpperCase(),
        description: values.description,
        discount_type: values.discount_type,
        discount_value: values.discount_value,
        minimum_order_amount: values.minimum_order_amount || 0,
        maximum_discount_amount: values.maximum_discount_amount || null,
        usage_limit: values.usage_limit || null,
        valid_from: values.validity_period[0].toISOString(),
        valid_until: values.validity_period[1] ? values.validity_period[1].toISOString() : null,
        is_active: values.is_active ?? true,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabaseClient
        .from('discount_codes')
        .update(discountData)
        .eq('id', id);

      if (error) throw error;

      message.success('Discount code updated successfully');
      list('discount_codes');
    } catch (error) {
      console.error('Error updating discount code:', error);
      message.error('Failed to update discount code');
    } finally {
      setLoading(false);
    }
  };

  if (fetchLoading) {
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
            <Title level={2} style={{ margin: 0 }}>Edit Discount Code</Title>
          </Space>
        </Col>
      </Row>

      <Card>
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
        >
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item
                label="Discount Code"
                name="code"
                rules={[
                  { required: true, message: 'Please enter discount code' },
                  { min: 3, message: 'Code must be at least 3 characters' },
                  { max: 20, message: 'Code must be less than 20 characters' }
                ]}
              >
                <Input 
                  placeholder="Enter discount code"
                  style={{ textTransform: 'uppercase' }}
                  onChange={(e) => e.target.value = e.target.value.toUpperCase()}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Discount Type"
                name="discount_type"
                rules={[{ required: true, message: 'Please select discount type' }]}
              >
                <Select>
                  <Option value="percentage">
                    <Space>
                      <PercentageOutlined />
                      Percentage
                    </Space>
                  </Option>
                  <Option value="fixed_amount">
                    <Space>
                      <DollarOutlined />
                      Fixed Amount
                    </Space>
                  </Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="Description"
            name="description"
            rules={[{ required: true, message: 'Please enter description' }]}
          >
            <TextArea
              rows={3}
              placeholder="Describe what this discount code is for"
            />
          </Form.Item>

          <Row gutter={24}>
            <Col span={8}>
              <Form.Item
                label="Discount Value"
                name="discount_value"
                rules={[
                  { required: true, message: 'Please enter discount value' },
                  { type: 'number', min: 0.01, message: 'Value must be greater than 0' }
                ]}
              >
                <Form.Item shouldUpdate>
                  {() => {
                    const discountType = form.getFieldValue('discount_type');
                    return (
                      <InputNumber
                        style={{ width: '100%' }}
                        min={0.01}
                        max={discountType === 'percentage' ? 100 : 10000}
                        precision={2}
                        placeholder="Enter value"
                        addonAfter={discountType === 'percentage' ? '%' : '$'}
                      />
                    );
                  }}
                </Form.Item>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="Minimum Order Amount"
                name="minimum_order_amount"
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  precision={2}
                  placeholder="No minimum"
                  addonBefore="$"
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="Maximum Discount Amount"
                name="maximum_discount_amount"
                tooltip="Only applies to percentage discounts"
              >
                <Form.Item shouldUpdate>
                  {() => {
                    const discountType = form.getFieldValue('discount_type');
                    return (
                      <InputNumber
                        style={{ width: '100%' }}
                        min={0}
                        precision={2}
                        placeholder="No maximum"
                        addonBefore="$"
                        disabled={discountType === 'fixed_amount'}
                      />
                    );
                  }}
                </Form.Item>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col span={8}>
              <Form.Item
                label="Usage Limit"
                name="usage_limit"
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={1}
                  placeholder="Unlimited uses"
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Usage Count">
                <Input 
                  value={`${discountCode.usage_count} times used`} 
                  disabled 
                  style={{ color: '#666' }}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="Status"
                name="is_active"
                valuePropName="checked"
              >
                <Switch
                  checkedChildren="Active"
                  unCheckedChildren="Inactive"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="Validity Period"
            name="validity_period"
            rules={[{ required: true, message: 'Please select validity period' }]}
          >
            <RangePicker
              style={{ width: '100%' }}
              showTime
              format="DD/MM/YYYY HH:mm"
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button 
                type="primary" 
                htmlType="submit"
                loading={loading}
                icon={<SaveOutlined />}
              >
                Update Discount Code
              </Button>
              <Button onClick={() => list('discount_codes')}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default DiscountCodesEdit;