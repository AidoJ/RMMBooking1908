import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Typography,
  Row,
  Col,
  Button,
  Space,
  Tag,
  Statistic,
  DatePicker,
  Select,
  Modal,
  Form,
  Input,
  message,
  Spin,
  Alert,
  Divider,
  Tabs
} from 'antd';
import {
  DollarOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  FileTextOutlined,
  SendOutlined,
  DownloadOutlined,
  ReloadOutlined,
  UserOutlined
} from '@ant-design/icons';
import { useGetIdentity } from '@refinedev/core';
import { supabaseClient } from '../../utility';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;
const { TabPane } = Tabs;

interface TherapistInvoice {
  id: string;
  therapist_id: string;
  therapist_name: string;
  week_start_date: string;
  week_end_date: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  total_bookings: number;
  total_service_fees: number;
  total_tips: number;
  total_amount: number;
  payment_status: 'pending' | 'approved' | 'paid' | 'rejected';
  payment_method: string;
  payment_reference?: string;
  payment_date?: string;
  submitted_at: string;
  approved_by?: string;
  approved_at?: string;
  paid_by?: string;
  paid_at?: string;
}

interface InvoiceItem {
  id: string;
  booking_id: string;
  service_date: string;
  service_duration_minutes: number;
  service_fee: number;
  tip_amount: number;
  total_line_amount: number;
  booking_reference: string;
}

const TherapistPayments: React.FC = () => {
  const { data: identity } = useGetIdentity<any>();
  const [loading, setLoading] = useState(false);
  const [invoices, setInvoices] = useState<TherapistInvoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<TherapistInvoice | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm] = Form.useForm();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(1, 'month'),
    dayjs()
  ]);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    loadInvoices();
  }, [dateRange, statusFilter]);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      
      let query = supabaseClient
        .from('therapist_weekly_invoices')
        .select(`
          *,
          therapist_profiles!inner(
            first_name,
            last_name
          )
        `)
        .gte('week_start_date', dateRange[0].format('YYYY-MM-DD'))
        .lte('week_end_date', dateRange[1].format('YYYY-MM-DD'))
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('payment_status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      const formattedInvoices = data?.map(invoice => ({
        ...invoice,
        therapist_name: `${(invoice.therapist_profiles as any).first_name} ${(invoice.therapist_profiles as any).last_name}`
      })) || [];

      setInvoices(formattedInvoices);

    } catch (error) {
      console.error('Error loading invoices:', error);
      message.error('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  const loadInvoiceItems = async (invoiceId: string) => {
    try {
      const { data, error } = await supabaseClient
        .from('therapist_invoice_items')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('service_date', { ascending: true });

      if (error) throw error;
      setInvoiceItems(data || []);

    } catch (error) {
      console.error('Error loading invoice items:', error);
      message.error('Failed to load invoice details');
    }
  };

  const handleViewInvoice = async (invoice: TherapistInvoice) => {
    setSelectedInvoice(invoice);
    await loadInvoiceItems(invoice.id);
    setShowInvoiceModal(true);
  };

  const handleApproveInvoice = async (invoiceId: string) => {
    try {
      const { error } = await supabaseClient
        .from('therapist_weekly_invoices')
        .update({
          payment_status: 'approved',
          approved_by: identity?.id,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', invoiceId);

      if (error) throw error;

      message.success('Invoice approved successfully');
      loadInvoices();

    } catch (error) {
      console.error('Error approving invoice:', error);
      message.error('Failed to approve invoice');
    }
  };

  const handleRejectInvoice = async (invoiceId: string, reason: string) => {
    try {
      const { error } = await supabaseClient
        .from('therapist_weekly_invoices')
        .update({
          payment_status: 'rejected',
          payment_notes: reason,
          updated_at: new Date().toISOString()
        })
        .eq('id', invoiceId);

      if (error) throw error;

      message.success('Invoice rejected');
      loadInvoices();

    } catch (error) {
      console.error('Error rejecting invoice:', error);
      message.error('Failed to reject invoice');
    }
  };

  const handleProcessPayment = async (values: any) => {
    if (!selectedInvoice) return;

    try {
      const { error } = await supabaseClient
        .from('therapist_weekly_invoices')
        .update({
          payment_status: 'paid',
          payment_reference: values.payment_reference,
          payment_date: values.payment_date,
          payment_notes: values.payment_notes,
          paid_by: identity?.id,
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedInvoice.id);

      if (error) throw error;

      message.success('Payment processed successfully');
      setShowPaymentModal(false);
      paymentForm.resetFields();
      loadInvoices();

    } catch (error) {
      console.error('Error processing payment:', error);
      message.error('Failed to process payment');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'orange';
      case 'approved': return 'blue';
      case 'paid': return 'green';
      case 'rejected': return 'red';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <ClockCircleOutlined />;
      case 'approved': return <CheckCircleOutlined />;
      case 'paid': return <CheckCircleOutlined />;
      case 'rejected': return <CheckCircleOutlined />;
      default: return null;
    }
  };

  const columns = [
    {
      title: 'Invoice #',
      dataIndex: 'invoice_number',
      key: 'invoice_number',
      render: (text: string, record: TherapistInvoice) => (
        <Text strong>{text}</Text>
      )
    },
    {
      title: 'Therapist',
      dataIndex: 'therapist_name',
      key: 'therapist_name'
    },
    {
      title: 'Week Period',
      key: 'week_period',
      render: (_: any, record: TherapistInvoice) => (
        <div>
          <Text>{dayjs(record.week_start_date).format('MMM DD')} - {dayjs(record.week_end_date).format('MMM DD, YYYY')}</Text>
        </div>
      )
    },
    {
      title: 'Bookings',
      dataIndex: 'total_bookings',
      key: 'total_bookings',
      align: 'center' as const,
      render: (count: number) => (
        <Text strong>{count}</Text>
      )
    },
    {
      title: 'Service Fees',
      dataIndex: 'total_service_fees',
      key: 'total_service_fees',
      align: 'right' as const,
      render: (amount: number) => (
        <Text>${amount.toFixed(2)}</Text>
      )
    },
    {
      title: 'Tips',
      dataIndex: 'total_tips',
      key: 'total_tips',
      align: 'right' as const,
      render: (amount: number) => (
        <Text style={{ color: '#52c41a' }}>${amount.toFixed(2)}</Text>
      )
    },
    {
      title: 'Total Amount',
      dataIndex: 'total_amount',
      key: 'total_amount',
      align: 'right' as const,
      render: (amount: number) => (
        <Text strong style={{ color: '#1890ff', fontSize: '16px' }}>
          ${amount.toFixed(2)}
        </Text>
      )
    },
    {
      title: 'Status',
      dataIndex: 'payment_status',
      key: 'payment_status',
      render: (status: string) => (
        <Tag color={getStatusColor(status)} icon={getStatusIcon(status)}>
          {status.toUpperCase()}
        </Tag>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: TherapistInvoice) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleViewInvoice(record)}
          >
            View
          </Button>
          
          {record.payment_status === 'pending' && (
            <>
              <Button
                type="link"
                icon={<CheckCircleOutlined />}
                onClick={() => handleApproveInvoice(record.id)}
              >
                Approve
              </Button>
              <Button
                type="link"
                danger
                onClick={() => {
                  Modal.confirm({
                    title: 'Reject Invoice',
                    content: 'Are you sure you want to reject this invoice?',
                    onOk: () => {
                      Modal.confirm({
                        title: 'Rejection Reason',
                        content: (
                          <Input.TextArea
                            placeholder="Enter reason for rejection..."
                            rows={3}
                            onChange={(e) => {
                              if (e.target.value) {
                                handleRejectInvoice(record.id, e.target.value);
                              }
                            }}
                          />
                        ),
                        onOk: () => {},
                        okText: 'Reject'
                      });
                    }
                  });
                }}
              >
                Reject
              </Button>
            </>
          )}
          
          {record.payment_status === 'approved' && (
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={() => {
                setSelectedInvoice(record);
                setShowPaymentModal(true);
              }}
            >
              Process Payment
            </Button>
          )}
        </Space>
      )
    }
  ];

  // Calculate summary statistics
  const stats = invoices.reduce(
    (acc, invoice) => ({
      totalInvoices: acc.totalInvoices + 1,
      totalAmount: acc.totalAmount + invoice.total_amount,
      pendingAmount: acc.pendingAmount + (invoice.payment_status === 'pending' ? invoice.total_amount : 0),
      approvedAmount: acc.approvedAmount + (invoice.payment_status === 'approved' ? invoice.total_amount : 0),
      paidAmount: acc.paidAmount + (invoice.payment_status === 'paid' ? invoice.total_amount : 0),
      totalBookings: acc.totalBookings + invoice.total_bookings,
      totalTips: acc.totalTips + invoice.total_tips
    }),
    {
      totalInvoices: 0,
      totalAmount: 0,
      pendingAmount: 0,
      approvedAmount: 0,
      paidAmount: 0,
      totalBookings: 0,
      totalTips: 0
    }
  );

  return (
    <div style={{ padding: '24px' }}>
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col flex="auto">
          <Title level={2}>Therapist Payments</Title>
          <Text type="secondary">Manage weekly therapist invoices and payments</Text>
        </Col>
        <Col>
          <Button
            icon={<ReloadOutlined />}
            onClick={loadInvoices}
            loading={loading}
          >
            Refresh
          </Button>
        </Col>
      </Row>

      {/* Summary Statistics */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Total Invoices"
              value={stats.totalInvoices}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Total Amount"
              value={stats.totalAmount}
              prefix={<DollarOutlined />}
              precision={2}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Pending Payments"
              value={stats.pendingAmount + stats.approvedAmount}
              prefix={<ClockCircleOutlined />}
              precision={2}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Total Tips"
              value={stats.totalTips}
              prefix={<DollarOutlined />}
              precision={2}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card style={{ marginBottom: '16px' }}>
        <Row gutter={16} align="middle">
          <Col>
            <Text strong>Date Range:</Text>
          </Col>
          <Col>
            <RangePicker
              value={dateRange}
              onChange={(dates) => dates && setDateRange(dates)}
            />
          </Col>
          <Col>
            <Text strong>Status:</Text>
          </Col>
          <Col>
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: 120 }}
            >
              <Option value="all">All</Option>
              <Option value="pending">Pending</Option>
              <Option value="approved">Approved</Option>
              <Option value="paid">Paid</Option>
              <Option value="rejected">Rejected</Option>
            </Select>
          </Col>
        </Row>
      </Card>

      {/* Invoices Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={invoices}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total, range) => 
              `${range[0]}-${range[1]} of ${total} invoices`
          }}
        />
      </Card>

      {/* Invoice Details Modal */}
      <Modal
        title={`Invoice Details - ${selectedInvoice?.invoice_number}`}
        open={showInvoiceModal}
        onCancel={() => setShowInvoiceModal(false)}
        width={800}
        footer={null}
      >
        {selectedInvoice && (
          <div>
            <Row gutter={16} style={{ marginBottom: '24px' }}>
              <Col span={12}>
                <Card size="small">
                  <Space direction="vertical" size="small">
                    <div><Text strong>Therapist:</Text> {selectedInvoice.therapist_name}</div>
                    <div><Text strong>Week:</Text> {dayjs(selectedInvoice.week_start_date).format('MMM DD')} - {dayjs(selectedInvoice.week_end_date).format('MMM DD, YYYY')}</div>
                    <div><Text strong>Invoice Date:</Text> {dayjs(selectedInvoice.invoice_date).format('MMM DD, YYYY')}</div>
                    <div><Text strong>Due Date:</Text> {dayjs(selectedInvoice.due_date).format('MMM DD, YYYY')}</div>
                  </Space>
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small">
                  <Space direction="vertical" size="small">
                    <div><Text strong>Total Bookings:</Text> {selectedInvoice.total_bookings}</div>
                    <div><Text strong>Service Fees:</Text> ${selectedInvoice.total_service_fees.toFixed(2)}</div>
                    <div><Text strong>Tips:</Text> ${selectedInvoice.total_tips.toFixed(2)}</div>
                    <div><Text strong>Total Amount:</Text> <Text style={{ color: '#1890ff', fontSize: '16px' }}>${selectedInvoice.total_amount.toFixed(2)}</Text></div>
                  </Space>
                </Card>
              </Col>
            </Row>

            <Divider />

            <Title level={4}>Service Details</Title>
            <Table
              dataSource={invoiceItems}
              rowKey="id"
              pagination={false}
              size="small"
              columns={[
                {
                  title: 'Date',
                  dataIndex: 'service_date',
                  key: 'service_date',
                  render: (date: string) => dayjs(date).format('MMM DD, YYYY')
                },
                {
                  title: 'Booking #',
                  dataIndex: 'booking_reference',
                  key: 'booking_reference'
                },
                {
                  title: 'Duration',
                  dataIndex: 'service_duration_minutes',
                  key: 'service_duration_minutes',
                  render: (minutes: number) => `${minutes} min`
                },
                {
                  title: 'Service Fee',
                  dataIndex: 'service_fee',
                  key: 'service_fee',
                  render: (fee: number) => `$${fee.toFixed(2)}`
                },
                {
                  title: 'Tip',
                  dataIndex: 'tip_amount',
                  key: 'tip_amount',
                  render: (tip: number) => tip > 0 ? `$${tip.toFixed(2)}` : '-'
                },
                {
                  title: 'Total',
                  dataIndex: 'total_line_amount',
                  key: 'total_line_amount',
                  render: (total: number) => <Text strong>${total.toFixed(2)}</Text>
                }
              ]}
            />
          </div>
        )}
      </Modal>

      {/* Payment Processing Modal */}
      <Modal
        title="Process Payment"
        open={showPaymentModal}
        onCancel={() => setShowPaymentModal(false)}
        footer={null}
      >
        <Form
          form={paymentForm}
          layout="vertical"
          onFinish={handleProcessPayment}
        >
          <Form.Item
            label="Payment Reference"
            name="payment_reference"
            rules={[{ required: true, message: 'Please enter payment reference' }]}
          >
            <Input placeholder="EFT reference number" />
          </Form.Item>

          <Form.Item
            label="Payment Date"
            name="payment_date"
            rules={[{ required: true, message: 'Please select payment date' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label="Payment Notes"
            name="payment_notes"
          >
            <Input.TextArea rows={3} placeholder="Additional notes..." />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                Process Payment
              </Button>
              <Button onClick={() => setShowPaymentModal(false)}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TherapistPayments;

