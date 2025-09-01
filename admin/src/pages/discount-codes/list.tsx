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
  Tooltip
} from 'antd';
import {
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  ReloadOutlined,
  PercentageOutlined,
  DollarOutlined,
  CalendarOutlined
} from '@ant-design/icons';
import { useNavigation } from '@refinedev/core';
import { supabaseClient } from '../../utility';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Search } = Input;
const { Option } = Select;
const { confirm } = Modal;

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

const DiscountCodesList: React.FC = () => {
  const [discountCodes, setDiscountCodes] = useState<DiscountCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { edit, create, show } = useNavigation();

  // Fetch discount codes
  const fetchDiscountCodes = async () => {
    setLoading(true);
    try {
      let query = supabaseClient
        .from('discount_codes')
        .select('*')
        .order('created_at', { ascending: false });

      if (statusFilter === 'active') {
        query = query.eq('is_active', true);
      } else if (statusFilter === 'inactive') {
        query = query.eq('is_active', false);
      }

      if (searchText) {
        query = query.or(`code.ilike.%${searchText}%,description.ilike.%${searchText}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setDiscountCodes(data || []);
    } catch (error) {
      console.error('Error fetching discount codes:', error);
      message.error('Failed to fetch discount codes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiscountCodes();
  }, [searchText, statusFilter]);

  // Delete discount code
  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabaseClient
        .from('discount_codes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      message.success('Discount code deleted successfully');
      fetchDiscountCodes();
    } catch (error) {
      console.error('Error deleting discount code:', error);
      message.error('Failed to delete discount code');
    }
  };

  // Toggle active status
  const toggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabaseClient
        .from('discount_codes')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;
      message.success(`Discount code ${!currentStatus ? 'activated' : 'deactivated'}`);
      fetchDiscountCodes();
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
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: 'Type',
      dataIndex: 'discount_type',
      key: 'discount_type',
      render: (type: string) => (
        <Tag color={type === 'percentage' ? 'blue' : 'green'}>
          {type === 'percentage' ? 'Percentage' : 'Fixed Amount'}
        </Tag>
      ),
    },
    {
      title: 'Value',
      dataIndex: 'discount_value',
      key: 'discount_value',
      render: (value: number, record: DiscountCode) => (
        <Text>
          {record.discount_type === 'percentage' ? `${value}%` : `$${value}`}
        </Text>
      ),
    },
    {
      title: 'Usage',
      key: 'usage',
      render: (record: DiscountCode) => (
        <Text>
          {record.usage_count} / {record.usage_limit || '∞'}
        </Text>
      ),
    },
    {
      title: 'Valid Until',
      dataIndex: 'valid_until',
      key: 'valid_until',
      render: (date: string) => date ? dayjs(date).format('DD/MM/YYYY') : 'No expiry',
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record: DiscountCode) => (
        <Space size="middle">
          <Tooltip title="View Details">
            <Button 
              type="link" 
              icon={<EyeOutlined />}
              onClick={() => show('discount_codes', record.id)}
            />
          </Tooltip>
          <Tooltip title="Edit">
            <Button 
              type="link" 
              icon={<EditOutlined />}
              onClick={() => edit('discount_codes', record.id)}
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
                title: 'Delete Discount Code',
                content: 'Are you sure you want to delete this discount code?',
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
    total: discountCodes.length,
    active: discountCodes.filter(code => code.is_active).length,
    expired: discountCodes.filter(code => 
      code.valid_until && dayjs(code.valid_until).isBefore(dayjs())
    ).length,
    overUsed: discountCodes.filter(code => 
      code.usage_limit && code.usage_count >= code.usage_limit
    ).length,
  };

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={2}>Discount Codes</Title>
        </Col>
        <Col>
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={() => create('discount_codes')}
          >
            Create New Code
          </Button>
        </Col>
      </Row>

      {/* Statistics Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic 
              title="Total Codes" 
              value={stats.total}
              prefix={<PercentageOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="Active Codes" 
              value={stats.active}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="Expired" 
              value={stats.expired}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="Usage Limit Reached" 
              value={stats.overUsed}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={12}>
            <Search
              placeholder="Search codes or descriptions"
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
              <Option value="all">All Codes</Option>
              <Option value="active">Active Only</Option>
              <Option value="inactive">Inactive Only</Option>
            </Select>
          </Col>
          <Col span={6}>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={fetchDiscountCodes}
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
          dataSource={discountCodes}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => 
              `${range[0]}-${range[1]} of ${total} discount codes`,
          }}
        />
      </Card>
    </div>
  );
};

export default DiscountCodesList;