import React, { useState } from 'react';
import {
  List,
  useTable,
  getDefaultSortOrder,
  FilterDropdown,
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
  Modal,
  message,
  Divider,
} from 'antd';
import {
  EyeOutlined,
  EditOutlined,
  MailOutlined,
  DollarOutlined,
  CalendarOutlined,
  FilterOutlined,
  SearchOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  SendOutlined,
  FileProtectOutlined,
  CreditCardOutlined,
} from '@ant-design/icons';
import type { IResourceComponentsProps } from '@refinedev/core';
import { UserIdentity, canAccess } from '../../utils/roleUtils';
import { useGetIdentity } from '@refinedev/core';
import { supabaseClient } from '../../utility';
import dayjs from 'dayjs';

const { Text, Title } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

export const QuotesList: React.FC<IResourceComponentsProps> = () => {
  const { data: identity } = useGetIdentity<UserIdentity>();
  const { show } = useNavigation();
  
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const { tableProps, searchFormProps, filters, sorters } = useTable({
    resource: 'quotes',
    meta: {
      select: '*,quote_dates(*)',  // Include related quote_dates for multi-day events
    },
    onSearch: (params: any) => {
      const filters = [];

      if (params.company_name) {
        filters.push({
          field: 'company_name',
          operator: 'contains' as const,
          value: params.company_name,
        });
      }

      if (params.customer_name) {
        filters.push({
          field: 'customer_name',
          operator: 'contains' as const,
          value: params.customer_name,
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

  const handleBulkDelete = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('Please select quotes to delete');
      return;
    }

    Modal.confirm({
      title: 'Delete Selected Quotes',
      icon: <ExclamationCircleOutlined />,
      content: `Are you sure you want to delete ${selectedRowKeys.length} selected quote(s)? This action cannot be undone.`,
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          setDeleteLoading(true);

          const { error } = await supabaseClient
            .from('quotes')
            .delete()
            .in('id', selectedRowKeys);

          if (error) throw error;

          message.success(`Successfully deleted ${selectedRowKeys.length} quote(s)`);
          setSelectedRowKeys([]);

          // Refresh the table
          tableProps.dataSource?.length && window.location.reload();

        } catch (error: any) {
          console.error('Error deleting quotes:', error);
          message.error('Failed to delete quotes: ' + error.message);
        } finally {
          setDeleteLoading(false);
        }
      },
    });
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys);
    },
  };

  // Quote status functions based on PDF requirements: New → Sent → Accepted/Declined → Invoiced → Paid → Completed
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'default';
      case 'sent':
        return 'processing';
      case 'accepted':
        return 'success';
      case 'declined':
        return 'error';
      case 'invoiced':
        return 'warning';
      case 'paid':
        return 'success';
      case 'completed':
        return 'green';
      default:
        return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'new':
        return 'New';
      case 'sent':
        return 'Sent';
      case 'accepted':
        return 'Accepted';
      case 'declined':
        return 'Declined';
      case 'invoiced':
        return 'Invoiced';
      case 'paid':
        return 'Paid';
      case 'completed':
        return 'Completed';
      default:
        return status?.charAt(0).toUpperCase() + status?.slice(1);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'new':
        return <FileTextOutlined />;
      case 'sent':
        return <SendOutlined />;
      case 'accepted':
        return <CheckCircleOutlined />;
      case 'declined':
        return <CloseCircleOutlined />;
      case 'invoiced':
        return <FileProtectOutlined />;
      case 'paid':
        return <CreditCardOutlined />;
      case 'completed':
        return <CheckCircleOutlined />;
      default:
        return <ClockCircleOutlined />;
    }
  };

  // Calculate statistics based on PDF status flow
  const quotes = tableProps.dataSource || [];
  const totalQuotes = quotes.length;
  const newQuotes = quotes.filter(q => q.status === 'new').length;
  const sentQuotes = quotes.filter(q => q.status === 'sent').length;
  const acceptedQuotes = quotes.filter(q => q.status === 'accepted').length;
  const declinedQuotes = quotes.filter(q => q.status === 'declined').length;
  const invoicedQuotes = quotes.filter(q => q.status === 'invoiced').length;
  const paidQuotes = quotes.filter(q => q.status === 'paid').length;
  const completedQuotes = quotes.filter(q => q.status === 'completed').length;
  const totalValue = quotes.reduce((sum, q) => sum + (q.final_amount || q.total_amount || 0), 0);
  const acceptedValue = quotes.filter(q => ['accepted', 'invoiced', 'paid', 'completed'].includes(q.status)).reduce((sum, q) => sum + (q.final_amount || q.total_amount || 0), 0);

  return (
    <div style={{ padding: '24px' }}>
      {/* Statistics Cards - Based on PDF Status Flow */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={4}>
          <Card>
            <Statistic
              title="Total Quotes"
              value={totalQuotes}
              prefix={<MailOutlined style={{ color: '#1890ff' }} />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="New"
              value={newQuotes}
              prefix={<FileTextOutlined style={{ color: '#d9d9d9' }} />}
              valueStyle={{ color: '#8c8c8c' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="Sent"
              value={sentQuotes}
              prefix={<SendOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="Accepted"
              value={acceptedQuotes}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="Paid"
              value={paidQuotes}
              prefix={<CreditCardOutlined style={{ color: '#722ed1' }} />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="Completed"
              value={completedQuotes}
              prefix={<CheckCircleOutlined style={{ color: '#389e0d' }} />}
              valueStyle={{ color: '#389e0d' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 0]} style={{ marginBottom: 24 }}>
        <Col span={8}>
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
        <Col span={8}>
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
        <Col span={8}>
          <Card>
            <Statistic
              title="Declined"
              value={declinedQuotes}
              prefix={<CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
              valueStyle={{ color: '#ff4d4f' }}
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
                <Option value="new">New</Option>
                <Option value="sent">Sent</Option>
                <Option value="accepted">Accepted</Option>
                <Option value="declined">Declined</Option>
                <Option value="invoiced">Invoiced</Option>
                <Option value="paid">Paid</Option>
                <Option value="completed">Completed</Option>
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

        <div style={{ marginBottom: 16 }}>
          <Space>
            <Button
              type="primary"
              danger
              icon={<DeleteOutlined />}
              onClick={handleBulkDelete}
              disabled={selectedRowKeys.length === 0}
              loading={deleteLoading}
            >
              Delete Selected ({selectedRowKeys.length})
            </Button>
          </Space>
        </div>

        <Table
          {...tableProps}
          rowKey="id"
          rowSelection={rowSelection}
          scroll={{ x: 1200 }}
          size="middle"
        >
          <Table.Column
            dataIndex="company_name"
            title="Business Name"
            render={(value) => (
              <Text strong style={{ color: '#1890ff' }}>
                {value || 'Not specified'}
              </Text>
            )}
            sorter
          />
          
          <Table.Column
            dataIndex="id"
            title="Quote Number"
            render={(value) => (
              <Text strong style={{ color: '#52c41a', fontFamily: 'monospace' }}>
                {value || 'N/A'}
              </Text>
            )}
            sorter
          />

          <Table.Column
            dataIndex="event_structure"
            title="Event Type"
            render={(value, record: any) => (
              <div>
                <Tag color={value === 'single_day' ? 'blue' : 'purple'}>
                  {value === 'single_day' ? 'Single Day' : 'Multi-Day'}
                </Tag>
                {value === 'multi_day' && record.number_of_event_days && (
                  <div><Text type="secondary" style={{ fontSize: 11 }}>
                    {record.number_of_event_days} days
                  </Text></div>
                )}
              </div>
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
                    {record.total_sessions || 0} sessions
                  </Text>
                </div>
              </div>
            )}
            width={100}
          />

          <Table.Column
            dataIndex="quote_dates"
            title="Service Start Date"
            render={(value, record: any) => {
              // Use quote_dates for all events (unified structure)
              let displayDate = null;
              if (record.quote_dates?.length > 0) {
                displayDate = record.quote_dates[0]?.event_date;
              }

              return displayDate ? (
                <div>
                  <div><CalendarOutlined /> {dayjs(displayDate).format('MMM DD, YYYY')}</div>
                  <div>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {dayjs(displayDate).format('dddd')}
                    </Text>
                  </div>
                </div>
              ) : (
                <Text type="secondary">Date TBD</Text>
              );
            }}
            sorter
            defaultSortOrder={getDefaultSortOrder('quote_dates', sorters)}
          />

          <Table.Column
            dataIndex="final_amount"
            title="Estimate Value"
            render={(value, record: any) => {
              const finalAmount = value || record.total_amount || 0;
              return (
                <div style={{ textAlign: 'right' }}>
                  <Text strong style={{ color: '#52c41a', fontSize: 16 }}>
                    ${finalAmount.toFixed(2)}
                  </Text>
                  {record.discount_amount > 0 && (
                    <div>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        (${record.discount_amount} discount)
                      </Text>
                    </div>
                  )}
                </div>
              );
            }}
            sorter
            width={120}
          />

          <Table.Column
            dataIndex="status"
            title="Status"
            render={(value) => (
              <Tag color={getStatusColor(value)} icon={getStatusIcon(value)}>
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
                  <Option value="new">New</Option>
                  <Option value="sent">Sent</Option>
                  <Option value="accepted">Accepted</Option>
                  <Option value="declined">Declined</Option>
                  <Option value="invoiced">Invoiced</Option>
                  <Option value="paid">Paid</Option>
                  <Option value="completed">Completed</Option>
                </Select>
              </FilterDropdown>
            )}
            width={100}
          />

          <Table.Column
            dataIndex="created_at"
            title="Requested"
            render={(value) => value ? (
              <Tooltip title={dayjs(value).format('YYYY-MM-DD HH:mm:ss')}>
                <Text type="secondary">
                  {dayjs(value).format('MMM DD')}
                </Text>
              </Tooltip>
            ) : (
              <Text type="secondary">Not set</Text>
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
                    onClick={() => show('quotes', record.id)}
                  />
                </Tooltip>
                <Tooltip title="Edit Quote">
                  <EditButton
                    hideText
                    size="small"
                    recordItemId={record.id}
                    resource="quotes"
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