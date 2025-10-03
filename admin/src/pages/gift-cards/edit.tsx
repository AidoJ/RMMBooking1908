import React, { useEffect, useState } from 'react';
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
  Spin,
  Divider,
  Alert,
} from 'antd';
import { ArrowLeftOutlined, SaveOutlined, GiftOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useNavigation } from '@refinedev/core';
import { useParams } from 'react-router';
import { supabaseClient } from '../../utility';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface GiftCard {
  id: string;
  code: string;
  initial_balance: number;
  current_balance: number;
  purchaser_name?: string;
  purchaser_email?: string;
  recipient_name?: string;
  recipient_email?: string;
  message?: string;
  expires_at?: string;
  is_active: boolean;
  created_at: string;
}

const GiftCardsEdit: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [giftCard, setGiftCard] = useState<GiftCard | null>(null);
  const { list } = useNavigation();
  const params = useParams();
  const id = params?.id as string;

  useEffect(() => {
    if (id) {
      fetchGiftCard();
    }
  }, [id]);

  const fetchGiftCard = async () => {
    setFetchLoading(true);
    try {
      const { data, error } = await supabaseClient
        .from('gift_cards')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      setGiftCard(data);
      
      // Set form values
      form.setFieldsValue({
        code: data.code,
        initial_balance: data.initial_balance,
        current_balance: data.current_balance,
        purchaser_name: data.purchaser_name,
        purchaser_email: data.purchaser_email,
        recipient_name: data.recipient_name,
        recipient_email: data.recipient_email,
        message: data.message,
        expires_at: data.expires_at ? dayjs(data.expires_at) : null,
        is_active: data.is_active,
      });
    } catch (error) {
      console.error('Error fetching gift card:', error);
      message.error('Failed to fetch gift card');
    } finally {
      setFetchLoading(false);
    }
  };

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const giftCardData = {
        code: values.code.toUpperCase(),
        initial_balance: values.initial_balance,
        current_balance: values.current_balance,
        purchaser_name: values.purchaser_name || null,
        purchaser_email: values.purchaser_email || null,
        recipient_name: values.recipient_name || null,
        recipient_email: values.recipient_email || null,
        message: values.message || null,
        expires_at: values.expires_at ? values.expires_at.toISOString() : null,
        is_active: values.is_active ?? true,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabaseClient
        .from('gift_cards')
        .update(giftCardData)
        .eq('id', id);

      if (error) throw error;

      message.success('Gift card updated successfully');
      list('gift_cards');
    } catch (error) {
      console.error('Error updating gift card:', error);
      message.error('Failed to update gift card');
    } finally {
      setLoading(false);
    }
  };

  if (fetchLoading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>Loading gift card...</div>
      </div>
    );
  }

  if (!giftCard) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Title level={4}>Gift card not found</Title>
        <Button onClick={() => list('gift_cards')}>
          Back to Gift Cards
        </Button>
      </div>
    );
  }

  const balanceUsed = giftCard.initial_balance - giftCard.current_balance;

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
            <Title level={2} style={{ margin: 0 }}>Edit Gift Card</Title>
          </Space>
        </Col>
      </Row>

      {balanceUsed > 0 && (
        <Alert
          message="Balance Information"
          description={`This gift card has been used. $${balanceUsed.toFixed(2)} has already been spent from the original balance.`}
          type="info"
          icon={<InfoCircleOutlined />}
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      <Card>
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
        >
          {/* Gift Card Details */}
          <Title level={4}>
            <GiftOutlined /> Gift Card Details
          </Title>
          
          <Row gutter={24}>
            <Col span={8}>
              <Form.Item
                label="Gift Card Code"
                name="code"
                rules={[
                  { required: true, message: 'Please enter gift card code' },
                  { min: 5, message: 'Code must be at least 5 characters' },
                  { max: 30, message: 'Code must be less than 30 characters' }
                ]}
              >
                <Input 
                  placeholder="Enter gift card code"
                  style={{ textTransform: 'uppercase' }}
                  onChange={(e) => e.target.value = e.target.value.toUpperCase()}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
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
            <Col span={8}>
              <Form.Item
                label="Current Balance"
                name="current_balance"
                rules={[
                  { required: true, message: 'Please enter current balance' },
                  { type: 'number', min: 0, message: 'Balance cannot be negative' }
                ]}
                tooltip="You can adjust this to add or remove balance"
              >
                <Form.Item shouldUpdate>
                  {() => {
                    const initialBalance = form.getFieldValue('initial_balance');
                    return (
                      <InputNumber
                        style={{ width: '100%' }}
                        min={0}
                        max={initialBalance || 10000}
                        precision={2}
                        placeholder="Enter amount"
                        addonBefore="$"
                      />
                    );
                  }}
                </Form.Item>
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

          <Form.Item>
            <Space>
              <Button 
                type="primary" 
                htmlType="submit"
                loading={loading}
                icon={<SaveOutlined />}
                size="large"
              >
                Update Gift Card
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

export default GiftCardsEdit;