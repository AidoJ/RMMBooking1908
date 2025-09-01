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
  Alert,
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  DeleteOutlined,
  GiftOutlined,
  UserOutlined,
  MailOutlined,
  CalendarOutlined,
  DollarOutlined,
  CreditCardOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  PhoneOutlined,
} from '@ant-design/icons';
import { useNavigation } from '@refinedev/core';
import { useParams } from 'react-router';
import { supabaseClient } from '../../utility';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;

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
  updated_at: string;
  // Payment fields
  payment_intent_id?: string;
  stripe_customer_id?: string;
  payment_method?: string;
  transaction_fee?: number;
  payment_date?: string;
  payment_status?: string;
  card_holder_name?: string;
  card_holder_email?: string;
  card_holder_phone?: string;
}

const GiftCardsShow: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [giftCard, setGiftCard] = useState<GiftCard | null>(null);
  const { list, edit } = useNavigation();
  const params = useParams();
  const id = params?.id as string;

  useEffect(() => {
    if (id) {
      fetchGiftCard();
    }
  }, [id]);

  const fetchGiftCard = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabaseClient
        .from('gift_cards')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setGiftCard(data);
    } catch (error) {
      console.error('Error fetching gift card:', error);
      message.error('Failed to fetch gift card');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      const { error } = await supabaseClient
        .from('gift_cards')
        .delete()
        .eq('id', id);

      if (error) throw error;
      message.success('Gift card deleted successfully');
      list('gift_cards');
    } catch (error) {
      console.error('Error deleting gift card:', error);
      message.error('Failed to delete gift card');
    }
  };

  if (loading) {
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

  const isExpired = giftCard.expires_at && dayjs(giftCard.expires_at).isBefore(dayjs());
  const isDepleted = giftCard.current_balance <= 0;
  const balanceUsed = giftCard.initial_balance - giftCard.current_balance;
  const usagePercentage = (balanceUsed / giftCard.initial_balance) * 100;

  const getStatus = () => {
    if (!giftCard.is_active) return { color: 'red', text: 'Inactive' };
    if (isExpired) return { color: 'red', text: 'Expired' };
    if (isDepleted) return { color: 'orange', text: 'Depleted' };
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
              onClick={() => list('gift_cards')}
            >
              Back to Gift Cards
            </Button>
            <Title level={2} style={{ margin: 0 }}>
              Gift Card Details
            </Title>
          </Space>
        </Col>
        <Col>
          <Space>
            <Button 
              type="primary"
              icon={<EditOutlined />}
              onClick={() => edit('gift_cards', giftCard.id)}
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

      {balanceUsed > 0 && (
        <Alert
          message="Usage Information"
          description={`This gift card has been used. $${balanceUsed.toFixed(2)} has been spent out of the original $${giftCard.initial_balance.toFixed(2)} balance.`}
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      <Row gutter={24}>
        {/* Main Details Card */}
        <Col span={16}>
          <Card title="Gift Card Information">
            <Descriptions column={1} bordered>
              <Descriptions.Item label="Gift Card Code">
                <Space>
                  <Text strong style={{ fontFamily: 'monospace', fontSize: '18px' }}>
                    {giftCard.code}
                  </Text>
                  <Tag color={status.color}>
                    {status.text}
                  </Tag>
                </Space>
              </Descriptions.Item>
              
              <Descriptions.Item label="Balance">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Space>
                    <Text strong style={{ fontSize: '16px', color: '#1890ff' }}>
                      ${giftCard.current_balance.toFixed(2)}
                    </Text>
                    <Text type="secondary">
                      / ${giftCard.initial_balance.toFixed(2)} original
                    </Text>
                  </Space>
                  <Progress 
                    percent={usagePercentage} 
                    status={isDepleted ? 'exception' : 'active'}
                    showInfo={false}
                    strokeColor={{
                      '0%': '#108ee9',
                      '100%': '#87d068',
                    }}
                  />
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    {usagePercentage.toFixed(1)}% used
                  </Text>
                </Space>
              </Descriptions.Item>
              
              <Descriptions.Item label="Expiry Date">
                <Space>
                  <CalendarOutlined />
                  {giftCard.expires_at 
                    ? dayjs(giftCard.expires_at).format('DD/MM/YYYY HH:mm')
                    : 'No expiry'}
                  {isExpired && <Tag color="red">EXPIRED</Tag>}
                </Space>
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card title="Personal Message" style={{ marginTop: 24 }}>
            {giftCard.message ? (
              <Paragraph
                style={{
                  background: '#f6ffed',
                  border: '1px solid #d9f7be',
                  padding: '16px',
                  borderRadius: '6px',
                  fontStyle: 'italic'
                }}
              >
                "{giftCard.message}"
              </Paragraph>
            ) : (
              <Text type="secondary">No personal message</Text>
            )}
          </Card>
        </Col>

        {/* Statistics and People Card */}
        <Col span={8}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Card title="Balance Statistics">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Statistic
                  title="Current Balance"
                  value={giftCard.current_balance}
                  prefix={<DollarOutlined />}
                  precision={2}
                  valueStyle={{ 
                    color: giftCard.current_balance > 0 ? '#3f8600' : '#cf1322' 
                  }}
                />
                
                <Divider style={{ margin: '12px 0' }} />
                
                <Statistic
                  title="Amount Used"
                  value={balanceUsed}
                  prefix={<DollarOutlined />}
                  precision={2}
                />
                
                <Divider style={{ margin: '12px 0' }} />
                
                <Statistic
                  title="Original Balance"
                  value={giftCard.initial_balance}
                  prefix={<DollarOutlined />}
                  precision={2}
                />
              </Space>
            </Card>

            <Card title="People">
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <Text strong>
                    <UserOutlined /> Purchaser
                  </Text>
                  <br />
                  <Text>{giftCard.purchaser_name || 'Not specified'}</Text>
                  {giftCard.purchaser_email && (
                    <>
                      <br />
                      <Text type="secondary">
                        <MailOutlined /> {giftCard.purchaser_email}
                      </Text>
                    </>
                  )}
                </div>
                
                <Divider style={{ margin: '12px 0' }} />
                
                <div>
                  <Text strong>
                    <GiftOutlined /> Recipient
                  </Text>
                  <br />
                  <Text>{giftCard.recipient_name || 'Not specified'}</Text>
                  {giftCard.recipient_email && (
                    <>
                      <br />
                      <Text type="secondary">
                        <MailOutlined /> {giftCard.recipient_email}
                      </Text>
                    </>
                  )}
                </div>
              </Space>
            </Card>

            <Card title="Payment Information">
              <Space direction="vertical" style={{ width: '100%' }}>
                {giftCard.payment_status && (
                  <>
                    <div>
                      <Text strong>Payment Status</Text>
                      <br />
                      {giftCard.payment_status === 'completed' && (
                        <Tag color="green" icon={<CheckCircleOutlined />}>
                          Payment Completed
                        </Tag>
                      )}
                      {giftCard.payment_status === 'failed' && (
                        <Tag color="red" icon={<CloseCircleOutlined />}>
                          Payment Failed
                        </Tag>
                      )}
                      {giftCard.payment_status === 'pending' && (
                        <Tag color="orange">Payment Pending</Tag>
                      )}
                    </div>
                    <Divider style={{ margin: '12px 0' }} />
                  </>
                )}
                
                {giftCard.card_holder_name && (
                  <>
                    <div>
                      <Text strong>
                        <CreditCardOutlined /> Card Holder
                      </Text>
                      <br />
                      <Text>{giftCard.card_holder_name}</Text>
                      {giftCard.card_holder_email && (
                        <>
                          <br />
                          <Text type="secondary">
                            <MailOutlined /> {giftCard.card_holder_email}
                          </Text>
                        </>
                      )}
                      {giftCard.card_holder_phone && (
                        <>
                          <br />
                          <Text type="secondary">
                            <PhoneOutlined /> {giftCard.card_holder_phone}
                          </Text>
                        </>
                      )}
                    </div>
                    <Divider style={{ margin: '12px 0' }} />
                  </>
                )}
                
                {giftCard.payment_method && (
                  <>
                    <div>
                      <Text type="secondary">Payment Method</Text>
                      <br />
                      <Text>{giftCard.payment_method}</Text>
                    </div>
                    <Divider style={{ margin: '12px 0' }} />
                  </>
                )}
                
                {giftCard.payment_date && (
                  <>
                    <div>
                      <Text type="secondary">Payment Date</Text>
                      <br />
                      <Text>{dayjs(giftCard.payment_date).format('DD/MM/YYYY HH:mm')}</Text>
                    </div>
                    <Divider style={{ margin: '12px 0' }} />
                  </>
                )}
                
                {giftCard.transaction_fee && (
                  <>
                    <div>
                      <Text type="secondary">Transaction Fee</Text>
                      <br />
                      <Text>${giftCard.transaction_fee.toFixed(2)}</Text>
                    </div>
                    <Divider style={{ margin: '12px 0' }} />
                  </>
                )}
                
                {giftCard.payment_intent_id && (
                  <div>
                    <Text type="secondary">Payment Intent ID</Text>
                    <br />
                    <Text style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                      {giftCard.payment_intent_id}
                    </Text>
                  </div>
                )}
              </Space>
            </Card>

            <Card title="Timeline">
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <Text type="secondary">Created</Text>
                  <br />
                  <Text>{dayjs(giftCard.created_at).format('DD/MM/YYYY HH:mm')}</Text>
                </div>
                <Divider style={{ margin: '12px 0' }} />
                <div>
                  <Text type="secondary">Last Updated</Text>
                  <br />
                  <Text>{dayjs(giftCard.updated_at).format('DD/MM/YYYY HH:mm')}</Text>
                </div>
              </Space>
            </Card>
          </Space>
        </Col>
      </Row>
    </div>
  );
};

export default GiftCardsShow;