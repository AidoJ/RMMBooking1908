import React, { useState, useEffect } from 'react';
import {
  Table,
  Card,
  Space,
  Button,
  Tag,
  Typography,
  Row,
  Col,
  Input,
  Select,
  message,
  Modal,
  Statistic,
  Spin,
  Tooltip,
  Progress
} from 'antd';
import {
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  ReloadOutlined,
  GiftOutlined,
  DollarOutlined,
  CalendarOutlined,
  UserOutlined,
  CreditCardOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';
import { useNavigation } from '@refinedev/core';
import { supabaseClient } from '../../utility';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Search } = Input;
const { Option } = Select;
const { confirm } = Modal;

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

const GiftCardsList: React.FC = () => {
  const [giftCards, setGiftCards] = useState<GiftCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { edit, create, show } = useNavigation();

  // Fetch gift cards
  const fetchGiftCards = async () => {
    setLoading(true);
    try {
      let query = supabaseClient
        .from('gift_cards')
        .select('*')
        .order('created_at', { ascending: false });

      if (statusFilter === 'active') {
        query = query.eq('is_active', true).gt('current_balance', 0);
      } else if (statusFilter === 'inactive') {
        query = query.eq('is_active', false);
      } else if (statusFilter === 'depleted') {
        query = query.eq('current_balance', 0);
      }

      if (searchText) {
        query = query.or(`code.ilike.%${searchText}%,purchaser_name.ilike.%${searchText}%,recipient_name.ilike.%${searchText}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setGiftCards(data || []);
    } catch (error) {
      console.error('Error fetching gift cards:', error);
      message.error('Failed to fetch gift cards');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGiftCards();
  }, [searchText, statusFilter]);

  // Delete gift card
  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabaseClient
        .from('gift_cards')
        .delete()
        .eq('id', id);

      if (error) throw error;
      message.success('Gift card deleted successfully');
      fetchGiftCards();
    } catch (error) {
      console.error('Error deleting gift card:', error);
      message.error('Failed to delete gift card');
    }
  };

  // Toggle active status
  const toggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabaseClient
        .from('gift_cards')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;
      message.success(`Gift card ${!currentStatus ? 'activated' : 'deactivated'}`);
      fetchGiftCards();
    } catch (error) {
      console.error('Error updating status:', error);
      message.error('Failed to update status');
    }
  };

  const columns = [
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
      render: (code: string) => (
        <Text strong style={{ fontFamily: 'monospace' }}>{code}</Text>
      ),
    },
    {
      title: 'Balance',
      key: 'balance',
      render: (record: GiftCard) => {
        const percentage = (record.current_balance / record.initial_balance) * 100;
        return (
          <div>
            <Text strong>${record.current_balance.toFixed(2)} / ${record.initial_balance.toFixed(2)}</Text>
            <Progress 
              percent={percentage} 
              size="small" 
              status={percentage > 0 ? 'active' : 'exception'}
              showInfo={false}
            />
          </div>
        );
      },
    },
    {
      title: 'Purchaser',
      key: 'purchaser',
      render: (record: GiftCard) => (
        <div>
          <Text>{record.purchaser_name || 'N/A'}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.purchaser_email}
          </Text>
        </div>
      ),
    },
    {
      title: 'Recipient',
      key: 'recipient',
      render: (record: GiftCard) => (
        <div>
          <Text>{record.recipient_name || 'N/A'}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.recipient_email}
          </Text>
        </div>
      ),
    },
    {
      title: 'Expires',
      dataIndex: 'expires_at',
      key: 'expires_at',
      render: (date: string) => {
        if (!date) return 'No expiry';
        const isExpired = dayjs(date).isBefore(dayjs());
        return (
          <Text type={isExpired ? 'danger' : 'secondary'}>
            {dayjs(date).format('DD/MM/YYYY')}
          </Text>
        );
      },
    },
    {
      title: 'Payment Status',
      key: 'payment_status',
      render: (record: GiftCard) => {
        if (record.payment_status === 'completed') {
          return (
            <div>
              <Tag color="green" icon={<CheckCircleOutlined />}>Paid</Tag>
              <br />
              <Text type="secondary" style={{ fontSize: '11px' }}>
                {record.payment_method || 'Card payment'}
              </Text>
            </div>
          );
        } else if (record.payment_status === 'failed') {
          return <Tag color="red" icon={<CloseCircleOutlined />}>Failed</Tag>;
        } else if (record.payment_status === 'pending') {
          return <Tag color="orange">Pending</Tag>;
        } else {
          return <Tag color="gray">Unknown</Tag>;
        }
      },
    },
    {
      title: 'Status',
      key: 'status',
      render: (record: GiftCard) => {
        if (!record.is_active) return <Tag color="red">Inactive</Tag>;
        if (record.current_balance <= 0) return <Tag color="orange">Depleted</Tag>;
        if (record.expires_at && dayjs(record.expires_at).isBefore(dayjs())) {
          return <Tag color="red">Expired</Tag>;
        }
        return <Tag color="green">Active</Tag>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record: GiftCard) => (
        <Space size="middle">
          <Tooltip title="View Details">
            <Button 
              type="link" 
              icon={<EyeOutlined />}
              onClick={() => show('gift_cards', record.id)}
            />
          </Tooltip>
          <Tooltip title="Edit">
            <Button 
              type="link" 
              icon={<EditOutlined />}
              onClick={() => edit('gift_cards', record.id)}
            />
          </Tooltip>
          <Tooltip title={record.is_active ? 'Deactivate' : 'Activate'}>
            <Button 
              type="link"
              onClick={() => toggleStatus(record.id, record.is_active)}
            >
              {record.is_active ? 'Deactivate' : 'Activate'}
            </Button>
          </Tooltip>
          <Tooltip title="Delete">
            <Button 
              type="link" 
              danger
              icon={<DeleteOutlined />}
              onClick={() => confirm({
                title: 'Delete Gift Card',
                content: 'Are you sure you want to delete this gift card?',
                onOk: () => handleDelete(record.id)
              })}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // Calculate statistics
  const stats = {
    total: giftCards.length,
    active: giftCards.filter(card => 
      card.is_active && 
      card.current_balance > 0 && 
      (!card.expires_at || dayjs(card.expires_at).isAfter(dayjs()))
    ).length,
    depleted: giftCards.filter(card => card.current_balance <= 0).length,
    expired: giftCards.filter(card => 
      card.expires_at && dayjs(card.expires_at).isBefore(dayjs())
    ).length,
  };

  // Calculate total values
  const totalValue = giftCards.reduce((sum, card) => sum + card.initial_balance, 0);
  const remainingValue = giftCards.reduce((sum, card) => sum + card.current_balance, 0);

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={2}>Gift Cards</Title>
        </Col>
        <Col>
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={() => create('gift_cards')}
          >
            Create New Gift Card
          </Button>
        </Col>
      </Row>

      {/* Statistics Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic 
              title="Total Cards" 
              value={stats.total}
              prefix={<GiftOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="Active Cards" 
              value={stats.active}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="Total Value" 
              value={totalValue}
              prefix="$"
              precision={2}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="Remaining Value" 
              value={remainingValue}
              prefix="$"
              precision={2}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={12}>
            <Search
              placeholder="Search codes, purchaser, or recipient"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: '100%' }}
            />
          </Col>
          <Col span={6}>
            <Select
              placeholder="Filter by status"
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: '100%' }}
            >
              <Option value="all">All Cards</Option>
              <Option value="active">Active Only</Option>
              <Option value="inactive">Inactive</Option>
              <Option value="depleted">Depleted</Option>
            </Select>
          </Col>
          <Col span={6}>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={fetchGiftCards}
            >
              Refresh
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={giftCards}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => 
              `${range[0]}-${range[1]} of ${total} gift cards`,
          }}
        />
      </Card>
    </div>
  );
};

export default GiftCardsList;