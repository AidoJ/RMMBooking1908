import React, { useState } from 'react';
import {
  List,
  useTable,
  getDefaultSortOrder,
  FilterDropdown,
  useSelect,
  EmailField,
  DateField,
  NumberField,
  TagField,
  EditButton,
  ShowButton,
} from '@refinedev/antd';
import { useNavigation } from '@refinedev/core';
import {
  Table,
  Space,
  Select,
  Button,
  Card,
  Statistic,
  Row,
  Col,
  Tag,
  Typography,
  Input,
  DatePicker,
  Tooltip,
  Badge,
} from 'antd';
import {
  EyeOutlined,
  EditOutlined,
  MailOutlined,
  DollarOutlined,
  CalendarOutlined,
  FilterOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import type { IResourceComponentsProps } from '@refinedev/core';
import { UserIdentity, canAccess } from '../../utils/roleUtils';
import { useGetIdentity } from '@refinedev/core';
import dayjs from 'dayjs';

const { Text, Title } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

export const QuotesList: React.FC<IResourceComponentsProps> = () => {
  const { data: identity } = useGetIdentity<UserIdentity>();
  const { show } = useNavigation();
  
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  const { tableProps, searchFormProps, filters, sorters } = useTable({
    resource: 'bookings',
    filters: {
      permanent: [
        {
          field: 'quote_only',
          operator: 'eq' as const,
          value: true  // Try boolean true instead of string
        },
        {
          field: 'business_name',
          operator: 'nnull' as const,  // Not null - quotes should have business names
          value: null
        }
      ]
    },
    onSearch: (params: any) => {
      const filters = [];
      
      if (params.business_name) {
        filters.push({
          field: 'business_name',
          operator: 'contains' as const,
          value: params.business_name,
        });
      }
      
      if (params.corporate_contact_name) {
        filters.push({
          field: 'corporate_contact_name',
          operator: 'contains' as const,
          value: params.corporate_contact_name,
        });
      }
      
      if (params.status && params.status.length > 0) {
        filters.push({
          field: 'status',
          operator: 'in' as const,
          value: params.status,
        });
      }
      
      if (params.dateRange && params.dateRange.length === 2) {
        filters.push({
          field: 'created_at',
          operator: 'gte' as const,
          value: params.dateRange[0].startOf('day').toISOString(),
        });
        filters.push({
          field: 'created_at',
          operator: 'lte' as const,
          value: params.dateRange[1].endOf('day').toISOString(),
        });
      }
      
      return filters;
    },
    initialSorter: [
      {
        field: 'created_at',
        order: 'desc',
      },
    ],
    syncWithLocation: true,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'requested':
      case 'quote_requested':
        return 'orange';
      case 'confirmed':
        return 'green';
      case 'declined':
        return 'red';
      case 'cancelled':
        return 'red';
      default:
        return 'blue';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'requested':
      case 'quote_requested':
        return 'Pending';
      case 'confirmed':
        return 'Accepted';
      case 'declined':
        return 'Declined';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status?.charAt(0).toUpperCase() + status?.slice(1);
    }
  };

  // Calculate statistics
  const quotes = tableProps.dataSource || [];
  const totalQuotes = quotes.length;
  const pendingQuotes = quotes.filter(q => ['requested', 'quote_requested'].includes(q.status)).length;
  const acceptedQuotes = quotes.filter(q => q.status === 'confirmed').length;
  const declinedQuotes = quotes.filter(q => q.status === 'declined').length;
  const totalValue = quotes.reduce((sum, q) => sum + (q.price || 0), 0);
  const acceptedValue = quotes.filter(q => q.status === 'confirmed').reduce((sum, q) => sum + (q.price || 0), 0);

  return (
    <div style={{ padding: '24px' }}>
      {/* Statistics Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Quotes"
              value={totalQuotes}
              prefix={<MailOutlined style={{ color: '#1890ff' }} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Pending"
              value={pendingQuotes}
              prefix={<Badge status="processing" />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Accepted"
              value={acceptedQuotes}
              prefix={<Badge status="success" />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Declined"
              value={declinedQuotes}
              prefix={<Badge status="error" />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 0]} style={{ marginBottom: 24 }}>
        <Col span={12}>
          <Card>
            <Statistic
              title="Total Quote Value"
              value={totalValue}
              precision={2}
              prefix="$"
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card>
            <Statistic
              title="Accepted Quote Value"
              value={acceptedValue}
              precision={2}
              prefix="$"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Main Table */}
      <List
        title={<Title level={3}>📋 Quote Requests</Title>}
        resource="bookings"
        headerButtons={() => (
          <Space>
            <Button
              type="primary"
              icon={<FilterOutlined />}
              onClick={() => {
                // Toggle advanced filters
              }}
            >
              Advanced Filters
            </Button>
          </Space>
        )}
      >
        {/* Search Form */}
        <Card style={{ marginBottom: 16 }}>
          <Row gutter={[16, 16]}>
            <Col span={6}>
              <Input
                placeholder="Search by company name"
                prefix={<SearchOutlined />}
                allowClear
                onChange={(e) => {
                  // Handle search
                }}
              />
            </Col>
            <Col span={6}>
              <Input
                placeholder="Search by contact name"
                prefix={<SearchOutlined />}
                allowClear
              />
            </Col>
            <Col span={6}>
              <Select
                mode="multiple"
                placeholder="Filter by status"
                style={{ width: '100%' }}
                allowClear
                value={statusFilter}
                onChange={setStatusFilter}
              >
                <Option value="requested">Pending</Option>
                <Option value="confirmed">Accepted</Option>
                <Option value="declined">Declined</Option>
                <Option value="cancelled">Cancelled</Option>
              </Select>
            </Col>
            <Col span={6}>
              <RangePicker
                style={{ width: '100%' }}
                placeholder={['Start Date', 'End Date']}
                value={dateRange}
                onChange={(dates) => setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)}
              />
            </Col>
          </Row>
        </Card>

        <Table
          {...tableProps}
          rowKey="id"
          scroll={{ x: 1200 }}
          size="middle"
        >
          <Table.Column
            dataIndex="business_name"
            title="Company"
            render={(value) => (
              <Text strong style={{ color: '#1890ff' }}>
                {value || 'Not specified'}
              </Text>
            )}
            sorter
          />
          
          <Table.Column
            dataIndex="corporate_contact_name"
            title="Contact"
            render={(value, record: any) => (
              <div>
                <div><Text strong>{value}</Text></div>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {record.corporate_contact_email}
                  </Text>
                </div>
              </div>
            )}
          />

          <Table.Column
            dataIndex="event_type"
            title="Event Type"
            render={(value) => (
              <Tag color="blue">{value || 'Corporate Event'}</Tag>
            )}
          />

          <Table.Column
            dataIndex="expected_attendees"
            title="Attendees"
            render={(value, record: any) => (
              <div style={{ textAlign: 'center' }}>
                <div><Text strong>{value || 'N/A'}</Text></div>
                <div>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {record.number_of_massages || 0} massages
                  </Text>
                </div>
              </div>
            )}
            width={100}
          />

          <Table.Column
            dataIndex="booking_time"
            title="Event Date"
            render={(value) => (
              <div>
                <div><CalendarOutlined /> {dayjs(value).format('MMM DD, YYYY')}</div>
                <div>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {dayjs(value).format('dddd')}
                  </Text>
                </div>
              </div>
            )}
            sorter
            defaultSortOrder={getDefaultSortOrder('booking_time', sorters)}
          />

          <Table.Column
            dataIndex="price"
            title="Quote Amount"
            render={(value) => (
              <div style={{ textAlign: 'right' }}>
                <Text strong style={{ color: '#52c41a', fontSize: 16 }}>
                  ${(value || 0).toFixed(2)}
                </Text>
              </div>
            )}
            sorter
            width={120}
          />

          <Table.Column
            dataIndex="status"
            title="Status"
            render={(value) => (
              <Tag color={getStatusColor(value)}>
                {getStatusText(value)}
              </Tag>
            )}
            filterDropdown={(props) => (
              <FilterDropdown {...props}>
                <Select
                  style={{ minWidth: 200 }}
                  mode="multiple"
                  placeholder="Select status"
                  value={props.selectedKeys}
                  onChange={props.setSelectedKeys}
                >
                  <Option value="requested">Pending</Option>
                  <Option value="confirmed">Accepted</Option>
                  <Option value="declined">Declined</Option>
                  <Option value="cancelled">Cancelled</Option>
                </Select>
              </FilterDropdown>
            )}
            width={100}
          />

          <Table.Column
            dataIndex="created_at"
            title="Requested"
            render={(value) => (
              <Tooltip title={dayjs(value).format('YYYY-MM-DD HH:mm:ss')}>
                <Text type="secondary">
                  {dayjs(value).format('MMM DD')}
                </Text>
              </Tooltip>
            )}
            sorter
            defaultSortOrder={getDefaultSortOrder('created_at', sorters)}
            width={80}
          />

          <Table.Column
            title="Actions"
            dataIndex="actions"
            render={(_, record: any) => (
              <Space size="small">
                <Tooltip title="View Details">
                  <Button
                    type="text"
                    size="small"
                    icon={<EyeOutlined />}
                    onClick={() => show('bookings', record.id)}
                  />
                </Tooltip>
                <Tooltip title="Edit Quote">
                  <EditButton
                    hideText
                    size="small"
                    recordItemId={record.id}
                    resource="bookings"
                  />
                </Tooltip>
              </Space>
            )}
            width={100}
            fixed="right"
          />
        </Table>
      </List>
    </div>
  );
};