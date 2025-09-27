import React from 'react';
import {
  Show,
  DateField,
  EmailField,
  NumberField,
  TagField,
  TextField,
} from '@refinedev/antd';
import { useShow } from '@refinedev/core';
import {
  Card,
  Typography,
  Row,
  Col,
  Tag,
  Divider,
  Descriptions,
  Table,
  Space,
} from 'antd';
import {
  CalendarOutlined,
  MailOutlined,
  PhoneOutlined,
  DollarOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  SendOutlined,
  FileProtectOutlined,
  CreditCardOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

export const QuoteShow: React.FC = () => {
  const { queryResult } = useShow({
    meta: {
      select: '*,quote_dates(*)',
    },
  });

  const { data, isLoading } = queryResult;
  const record = data?.data;

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

  return (
    <Show isLoading={isLoading}>
      {record && (
        <div>
          {/* Header Card */}
          <Card style={{ marginBottom: 16 }}>
            <Row gutter={[16, 16]}>
              <Col span={18}>
                <Title level={3}>
                  Quote: {record.id}
                </Title>
                <Text type="secondary">
                  {record.company_name || record.customer_name || 'Unknown Client'}
                </Text>
              </Col>
              <Col span={6} style={{ textAlign: 'right' }}>
                <Tag
                  color={getStatusColor(record.status)}
                  icon={getStatusIcon(record.status)}
                  style={{ fontSize: '14px', padding: '4px 12px' }}
                >
                  {record.status?.toUpperCase()}
                </Tag>
                <div style={{ marginTop: 8 }}>
                  <Text strong style={{ fontSize: '20px', color: '#52c41a' }}>
                    ${(record.final_amount || record.total_amount || 0).toFixed(2)}
                  </Text>
                </div>
              </Col>
            </Row>
          </Card>

          <Row gutter={[16, 16]}>
            {/* Customer Information */}
            <Col span={12}>
              <Card title="Customer Information" size="small">
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="Company Name">
                    {record.company_name || 'N/A'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Contact Name">
                    {record.customer_name || 'N/A'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Email">
                    <EmailField value={record.customer_email} />
                  </Descriptions.Item>
                  <Descriptions.Item label="Phone">
                    {record.customer_phone || 'N/A'}
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            </Col>

            {/* Event Details */}
            <Col span={12}>
              <Card title="Event Details" size="small">
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="Event Structure">
                    <Tag color={record.event_structure === 'single_day' ? 'blue' : 'purple'}>
                      {record.event_structure === 'single_day' ? 'Single Day' : 'Multi-Day'}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Event Type">
                    {record.event_type || 'N/A'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Location">
                    {record.event_location || 'N/A'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Expected Attendees">
                    {record.expected_attendees || 'N/A'}
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            </Col>
          </Row>

          {/* Event Dates */}
          <Card title="Event Schedule" style={{ marginTop: 16 }}>
            {record.event_structure === 'single_day' ? (
              <Descriptions column={2}>
                <Descriptions.Item label="Event Duration">
                  <CalendarOutlined style={{ marginRight: 8 }} />
                  {record.number_of_event_days ? `${record.number_of_event_days} day(s)` : 'TBD'}
                </Descriptions.Item>
                <Descriptions.Item label="Total Duration">
                  {record.duration_minutes ? `${record.duration_minutes} minutes` : 'TBD'}
                </Descriptions.Item>
              </Descriptions>
            ) : (
              <Table
                dataSource={record.quote_dates || []}
                rowKey="id"
                pagination={false}
                size="small"
              >
                <Table.Column
                  title="Day"
                  dataIndex="day_number"
                  render={(value) => `Day ${value}`}
                />
                <Table.Column
                  title="Date"
                  dataIndex="event_date"
                  render={(value) => value ? dayjs(value).format('MMMM DD, YYYY') : 'Not set'}
                />
                <Table.Column
                  title="Start Time"
                  dataIndex="start_time"
                />
                <Table.Column
                  title="Sessions"
                  dataIndex="sessions_count"
                />
                <Table.Column
                  title="Notes"
                  dataIndex="notes"
                  render={(value) => value || '-'}
                />
              </Table>
            )}
          </Card>

          {/* Service Details */}
          <Card title="Service Details" style={{ marginTop: 16 }}>
            <Row gutter={[16, 16]}>
              <Col span={8}>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="Total Sessions">
                    {record.total_sessions}
                  </Descriptions.Item>
                  <Descriptions.Item label="Session Duration">
                    {record.session_duration_minutes} minutes
                  </Descriptions.Item>
                  <Descriptions.Item label="Therapists Needed">
                    {record.therapists_needed}
                  </Descriptions.Item>
                </Descriptions>
              </Col>
              <Col span={16}>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="Setup Requirements">
                    {record.setup_requirements || 'None specified'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Special Requirements">
                    {record.special_requirements || 'None specified'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Urgency">
                    <Tag>{record.urgency}</Tag>
                  </Descriptions.Item>
                </Descriptions>
              </Col>
            </Row>
          </Card>

          {/* Financial Details */}
          <Card title="Financial Details" style={{ marginTop: 16 }}>
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="Hourly Rate">
                    ${record.hourly_rate?.toFixed(2) || '0.00'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Total Amount">
                    ${record.total_amount?.toFixed(2) || '0.00'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Therapist Fees">
                    ${record.total_therapist_fees?.toFixed(2) || '0.00'}
                  </Descriptions.Item>
                </Descriptions>
              </Col>
              <Col span={12}>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="Discount Amount">
                    ${record.discount_amount?.toFixed(2) || '0.00'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Tax Amount">
                    ${record.tax_rate_amount?.toFixed(2) || '0.00'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Final Amount">
                    <Text strong style={{ fontSize: '16px', color: '#52c41a' }}>
                      ${record.final_amount?.toFixed(2) || '0.00'}
                    </Text>
                  </Descriptions.Item>
                </Descriptions>
              </Col>
            </Row>
          </Card>

          {/* Payment Information */}
          <Card title="Payment Information" style={{ marginTop: 16 }}>
            <Descriptions column={2} size="small">
              <Descriptions.Item label="Payment Method">
                <Tag>{record.payment_method}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Payment Status">
                <Tag color={record.payment_status === 'paid' ? 'success' : 'warning'}>
                  {record.payment_status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Invoice Number">
                {record.invoice_number || 'Not generated'}
              </Descriptions.Item>
              <Descriptions.Item label="PO Number">
                {record.po_number || 'N/A'}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {/* Timeline */}
          <Card title="Quote Timeline" style={{ marginTop: 16 }}>
            <Descriptions column={2} size="small">
              <Descriptions.Item label="Created">
                <DateField value={record.created_at} format="MMMM DD, YYYY HH:mm" />
              </Descriptions.Item>
              <Descriptions.Item label="Quote Sent">
                {record.quote_sent_at ? (
                  <DateField value={record.quote_sent_at} format="MMMM DD, YYYY HH:mm" />
                ) : (
                  'Not sent'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Quote Accepted">
                {record.quote_accepted_at ? (
                  <DateField value={record.quote_accepted_at} format="MMMM DD, YYYY HH:mm" />
                ) : (
                  'Not accepted'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Valid Until">
                {record.quote_valid_until ? (
                  <DateField value={record.quote_valid_until} format="MMMM DD, YYYY" />
                ) : (
                  'Not specified'
                )}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </div>
      )}
    </Show>
  );
};