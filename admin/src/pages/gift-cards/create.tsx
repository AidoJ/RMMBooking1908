import React from 'react';
import {
  Form,
  Input,
  InputNumber,
  DatePicker,
  Switch,
  Button,
  Card,
  Typography,
  Row,
  Col,
  message,
  Space,
  Divider,
} from 'antd';
import { ArrowLeftOutlined, SaveOutlined, GiftOutlined } from '@ant-design/icons';
import { useNavigation } from '@refinedev/core';
import { supabaseClient } from '../../utility';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

const GiftCardsCreate: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = React.useState(false);
  const { list } = useNavigation();

  const generateCode = () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'GC-';
    for (let i = 0; i < 8; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    form.setFieldValue('code', result);
  };

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const giftCardData = {
        code: values.code.toUpperCase(),
        initial_balance: values.initial_balance,
        current_balance: values.initial_balance,
        purchaser_name: values.purchaser_name || null,
        purchaser_email: values.purchaser_email || null,
        recipient_name: values.recipient_name || null,
        recipient_email: values.recipient_email || null,
        message: values.message || null,
        expires_at: values.expires_at ? values.expires_at.toISOString() : null,
        is_active: values.is_active ?? true,
      };

      const { error } = await supabaseClient
        .from('gift_cards')
        .insert([giftCardData]);

      if (error) throw error;

      message.success('Gift card created successfully');
      list('gift_cards');
    } catch (error) {
      console.error('Error creating gift card:', error);
      message.error('Failed to create gift card');
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
              onClick={() => list('gift_cards')}
            >
              Back to Gift Cards
            </Button>
            <Title level={2} style={{ margin: 0 }}>Create New Gift Card</Title>
          </Space>
        </Col>
      </Row>

      <Card>
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{
            is_active: true,
          }}
        >
          {/* Gift Card Details */}
          <Title level={4}>
            <GiftOutlined /> Gift Card Details
          </Title>
          
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item
                label="Gift Card Code"
                name="code"
                rules={[
                  { required: true, message: 'Please enter gift card code' },
                  { min: 5, message: 'Code must be at least 5 characters' },
                  { max: 30, message: 'Code must be less than 30 characters' }
                ]}
                extra={
                  <Button type="link" onClick={generateCode} style={{ padding: 0 }}>
                    Generate Random Code
                  </Button>
                }
              >
                <Input 
                  placeholder="Enter gift card code"
                  style={{ textTransform: 'uppercase' }}
                  onChange={(e) => e.target.value = e.target.value.toUpperCase()}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Initial Balance"
                name="initial_balance"
                rules={[
                  { required: true, message: 'Please enter initial balance' },
                  { type: 'number', min: 1, message: 'Balance must be at least $1' }
                ]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={1}
                  max={10000}
                  precision={2}
                  placeholder="Enter amount"
                  addonBefore="$"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="Expiry Date (Optional)"
            name="expires_at"
          >
            <DatePicker
              style={{ width: '100%' }}
              showTime
              format="DD/MM/YYYY HH:mm"
              placeholder="Select expiry date (leave empty for no expiry)"
              disabledDate={(current) => current && current < dayjs().startOf('day')}
            />
          </Form.Item>

          <Divider />

          {/* Purchaser Information */}
          <Title level={4}>Purchaser Information</Title>
          
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item
                label="Purchaser Name"
                name="purchaser_name"
              >
                <Input placeholder="Enter purchaser's name" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Purchaser Email"
                name="purchaser_email"
                rules={[
                  { type: 'email', message: 'Please enter valid email address' }
                ]}
              >
                <Input placeholder="Enter purchaser's email" />
              </Form.Item>
            </Col>
          </Row>

          <Divider />

          {/* Recipient Information */}
          <Title level={4}>Recipient Information</Title>
          
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item
                label="Recipient Name"
                name="recipient_name"
              >
                <Input placeholder="Enter recipient's name" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Recipient Email"
                name="recipient_email"
                rules={[
                  { type: 'email', message: 'Please enter valid email address' }
                ]}
              >
                <Input placeholder="Enter recipient's email" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="Personal Message"
            name="message"
          >
            <TextArea
              rows={4}
              placeholder="Enter a personal message for the recipient (optional)"
              maxLength={500}
              showCount
            />
          </Form.Item>

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
                size="large"
              >
                Create Gift Card
              </Button>
              <Button size="large" onClick={() => list('gift_cards')}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default GiftCardsCreate;