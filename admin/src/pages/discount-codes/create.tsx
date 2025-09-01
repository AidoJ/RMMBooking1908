import React from 'react';
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
} from 'antd';
import { ArrowLeftOutlined, SaveOutlined, PercentageOutlined, DollarOutlined } from '@ant-design/icons';
import { useNavigation } from '@refinedev/core';
import { supabaseClient } from '../../utility';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;
const { TextArea } = Input;

const DiscountCodesCreate: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = React.useState(false);
  const { list } = useNavigation();

  const generateCode = () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    form.setFieldValue('code', result);
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
        usage_count: 0,
        valid_from: values.validity_period[0].toISOString(),
        valid_until: values.validity_period[1] ? values.validity_period[1].toISOString() : null,
        is_active: values.is_active ?? true,
      };

      const { error } = await supabaseClient
        .from('discount_codes')
        .insert([discountData]);

      if (error) throw error;

      message.success('Discount code created successfully');
      list('discount_codes');
    } catch (error) {
      console.error('Error creating discount code:', error);
      message.error('Failed to create discount code');
    } finally {
      setLoading(false);
    }
  };

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
            <Title level={2} style={{ margin: 0 }}>Create New Discount Code</Title>
          </Space>
        </Col>
      </Row>

      <Card>
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{
            discount_type: 'percentage',
            minimum_order_amount: 0,
            is_active: true,
            validity_period: [dayjs(), dayjs().add(30, 'days')]
          }}
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
                extra={
                  <Button type="link" onClick={generateCode} style={{ padding: 0 }}>
                    Generate Random Code
                  </Button>
                }
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
                <InputNumber
                  style={{ width: '100%' }}
                  min={0.01}
                  max={Form.useWatch('discount_type', form) === 'percentage' ? 100 : 10000}
                  precision={2}
                  placeholder="Enter value"
                  addonAfter={Form.useWatch('discount_type', form) === 'percentage' ? '%' : '$'}
                />
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
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  precision={2}
                  placeholder="No maximum"
                  addonBefore="$"
                  disabled={Form.useWatch('discount_type', form) === 'fixed_amount'}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col span={12}>
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
            <Col span={12}>
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
            </Col>
          </Row>

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

          <Form.Item>
            <Space>
              <Button 
                type="primary" 
                htmlType="submit"
                loading={loading}
                icon={<SaveOutlined />}
              >
                Create Discount Code
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

export default DiscountCodesCreate;