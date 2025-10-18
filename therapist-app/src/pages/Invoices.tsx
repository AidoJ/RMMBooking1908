import React, { useState, useEffect } from 'react';
import {
  Card,
  Typography,
  message,
  Spin,
  Tabs,
  Table,
  Button,
  Tag,
  Modal,
  Form,
  InputNumber,
  Input,
  Upload,
  Space,
  Descriptions,
  Image,
  Alert,
  Statistic,
  Row,
  Col
} from 'antd';
import {
  FileTextOutlined,
  DollarOutlined,
  UploadOutlined,
  PlusOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';
import { supabaseClient } from '../utility/supabaseClient';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(isoWeek);

const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { TextArea } = Input;

interface WeeklySummary {
  week_start: string;
  week_end: string;
  booking_count: number;
  total_fees: number;
  booking_ids: string[];
  bookings: any[];
}

interface Invoice {
  id: string;
  week_start_date: string;
  week_end_date: string;
  calculated_fees: number;
  booking_count: number;
  booking_ids: string;
  therapist_invoice_number: string;
  therapist_invoice_date: string;
  therapist_invoice_url: string;
  therapist_invoiced_fees: number;
  therapist_parking_amount: number;
  therapist_total_claimed: number;
  therapist_notes: string;
  submitted_at: string;
  variance_fees: number;
  admin_approved_fees: number;
  admin_approved_parking: number;
  admin_total_approved: number;
  admin_notes: string;
  reviewed_at: string;
  paid_amount: number;
  paid_date: string;
  eft_reference: string;
  status: string;
  parking_receipt_url: string;
}

export const Invoices: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [therapistId, setTherapistId] = useState<string | null>(null);
  const [weeklySummaries, setWeeklySummaries] = useState<WeeklySummary[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [submitModalVisible, setSubmitModalVisible] = useState(false);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<WeeklySummary | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Get user data from localStorage
      const userStr = localStorage.getItem('therapistUser');
      if (!userStr) {
        message.error('Please log in again');
        return;
      }

      const userData = JSON.parse(userStr);
      const userId = userData.user_id || userData.id;

      // Get therapist profile
      const { data: profile, error: profileError } = await supabaseClient
        .from('therapist_profiles')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (profileError || !profile) {
        console.error('Profile error:', profileError);
        return;
      }

      setTherapistId(profile.id);

      // Load weekly summaries and invoices
      await Promise.all([
        loadWeeklySummaries(profile.id),
        loadInvoices(profile.id)
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      message.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadWeeklySummaries = async (therapistId: string) => {
    try {
      // Get completed bookings from last 12 weeks
      const startDate = dayjs().subtract(12, 'weeks').startOf('isoWeek').format('YYYY-MM-DD');

      const { data: bookings, error } = await supabaseClient
        .from('bookings')
        .select(`
          id,
          booking_id,
          booking_time,
          status,
          therapist_fee,
          booker_name,
          first_name,
          last_name,
          services(name)
        `)
        .eq('therapist_id', therapistId)
        .eq('status', 'completed')
        .gte('booking_time', startDate)
        .order('booking_time');

      if (error) throw error;

      // Group bookings by week (Monday to Sunday)
      const weekMap = new Map<string, WeeklySummary>();

      bookings?.forEach((booking) => {
        const bookingDate = dayjs(booking.booking_time);
        const weekStart = bookingDate.startOf('isoWeek'); // Monday
        const weekEnd = bookingDate.endOf('isoWeek'); // Sunday
        const weekKey = weekStart.format('YYYY-MM-DD');

        if (!weekMap.has(weekKey)) {
          weekMap.set(weekKey, {
            week_start: weekStart.format('YYYY-MM-DD'),
            week_end: weekEnd.format('YYYY-MM-DD'),
            booking_count: 0,
            total_fees: 0,
            booking_ids: [],
            bookings: []
          });
        }

        const week = weekMap.get(weekKey)!;
        week.booking_count++;
        week.total_fees += parseFloat(booking.therapist_fee || '0');
        week.booking_ids.push(booking.booking_id);
        week.bookings.push(booking);
      });

      // Convert to array and sort by date descending
      const summaries = Array.from(weekMap.values())
        .sort((a, b) => dayjs(b.week_start).unix() - dayjs(a.week_start).unix());

      setWeeklySummaries(summaries);
    } catch (error) {
      console.error('Error loading weekly summaries:', error);
      message.error('Failed to load weekly summaries');
    }
  };

  const loadInvoices = async (therapistId: string) => {
    try {
      const { data, error } = await supabaseClient
        .from('therapist_payments')
        .select('*')
        .eq('therapist_id', therapistId)
        .order('week_start_date', { ascending: false });

      if (error) throw error;

      setInvoices(data || []);
    } catch (error) {
      console.error('Error loading invoices:', error);
      message.error('Failed to load invoices');
    }
  };

  const handleSubmitInvoice = (week: WeeklySummary) => {
    // Check if week has ended
    if (dayjs().isBefore(dayjs(week.week_end).endOf('day'))) {
      message.warning('You can only submit invoices after the week has ended (Sunday midnight)');
      return;
    }

    // Check if invoice already exists for this week
    const existingInvoice = invoices.find(
      inv => inv.week_start_date === week.week_start && inv.week_end_date === week.week_end
    );

    if (existingInvoice) {
      message.warning('Invoice already submitted for this week');
      return;
    }

    setSelectedWeek(week);
    form.setFieldsValue({
      invoiced_fees: week.total_fees,
      parking_amount: 0,
      invoice_number: '',
      notes: ''
    });
    setSubmitModalVisible(true);
  };

  const convertFileToBase64 = (file: any): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFormSubmit = async (values: any) => {
    if (!therapistId || !selectedWeek) return;

    try {
      setLoading(true);

      // Convert invoice file to base64 if present
      let invoiceUrl = null;
      if (values.invoice_upload?.fileList?.[0]?.originFileObj) {
        const file = values.invoice_upload.fileList[0].originFileObj;
        invoiceUrl = await convertFileToBase64(file);
      }

      // Convert parking receipt to base64 if present
      let receiptUrl = null;
      if (values.parking_receipt_upload?.fileList?.[0]?.originFileObj) {
        const file = values.parking_receipt_upload.fileList[0].originFileObj;
        receiptUrl = await convertFileToBase64(file);
      }

      const invoiceData = {
        therapist_id: therapistId,
        week_start_date: selectedWeek.week_start,
        week_end_date: selectedWeek.week_end,
        calculated_fees: selectedWeek.total_fees,
        booking_count: selectedWeek.booking_count,
        booking_ids: selectedWeek.booking_ids.join(','),
        therapist_invoice_number: values.invoice_number || null,
        therapist_invoice_date: dayjs().format('YYYY-MM-DD'),
        therapist_invoice_url: invoiceUrl,
        therapist_invoiced_fees: values.invoiced_fees,
        therapist_parking_amount: values.parking_amount || 0,
        parking_receipt_url: receiptUrl,
        therapist_notes: values.notes || null,
        submitted_at: new Date().toISOString(),
        status: 'submitted'
      };

      const { error } = await supabaseClient
        .from('therapist_payments')
        .insert(invoiceData);

      if (error) throw error;

      message.success('Invoice submitted successfully!');
      setSubmitModalVisible(false);
      form.resetFields();
      loadInvoices(therapistId);
    } catch (error: any) {
      console.error('Error submitting invoice:', error);
      message.error(error.message || 'Failed to submit invoice');
    } finally {
      setLoading(false);
    }
  };

  const handleViewInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setViewModalVisible(true);
  };

  const getStatusTag = (status: string) => {
    const statusConfig: any = {
      draft: { color: 'default', icon: <FileTextOutlined /> },
      submitted: { color: 'blue', icon: <ClockCircleOutlined /> },
      under_review: { color: 'orange', icon: <ExclamationCircleOutlined /> },
      approved: { color: 'green', icon: <CheckCircleOutlined /> },
      paid: { color: 'green', icon: <CheckCircleOutlined /> },
      disputed: { color: 'red', icon: <WarningOutlined /> },
      rejected: { color: 'red', icon: <CloseCircleOutlined /> }
    };

    const config = statusConfig[status] || { color: 'default', icon: null };

    return (
      <Tag color={config.color} icon={config.icon}>
        {status.toUpperCase().replace('_', ' ')}
      </Tag>
    );
  };

  const weeklySummaryColumns = [
    {
      title: 'Week',
      key: 'week',
      render: (_: any, record: WeeklySummary) => (
        <div>
          <Text strong>{dayjs(record.week_start).format('MMM D')} - {dayjs(record.week_end).format('MMM D, YYYY')}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {dayjs(record.week_start).format('ddd MMM D')} to {dayjs(record.week_end).format('ddd MMM D')}
          </Text>
        </div>
      )
    },
    {
      title: 'Bookings',
      dataIndex: 'booking_count',
      key: 'booking_count',
      align: 'center' as const,
      render: (count: number) => <Tag color="blue">{count} jobs</Tag>
    },
    {
      title: 'Total Fees',
      dataIndex: 'total_fees',
      key: 'total_fees',
      align: 'right' as const,
      render: (fees: number) => <Text strong style={{ fontSize: '16px', color: '#007e8c' }}>${fees.toFixed(2)}</Text>
    },
    {
      title: 'Status',
      key: 'status',
      align: 'center' as const,
      render: (_: any, record: WeeklySummary) => {
        const invoice = invoices.find(
          inv => inv.week_start_date === record.week_start && inv.week_end_date === record.week_end
        );

        if (invoice) {
          return getStatusTag(invoice.status);
        }

        const weekEnded = dayjs().isAfter(dayjs(record.week_end).endOf('day'));
        if (!weekEnded) {
          return <Tag color="default">Week In Progress</Tag>;
        }

        return <Tag color="orange">Ready to Submit</Tag>;
      }
    },
    {
      title: 'Action',
      key: 'action',
      align: 'center' as const,
      render: (_: any, record: WeeklySummary) => {
        const invoice = invoices.find(
          inv => inv.week_start_date === record.week_start && inv.week_end_date === record.week_end
        );

        if (invoice) {
          return (
            <Button
              type="link"
              icon={<EyeOutlined />}
              onClick={() => handleViewInvoice(invoice)}
            >
              View Invoice
            </Button>
          );
        }

        const weekEnded = dayjs().isAfter(dayjs(record.week_end).endOf('day'));
        if (!weekEnded) {
          return <Text type="secondary">Wait until week ends</Text>;
        }

        return (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => handleSubmitInvoice(record)}
          >
            Submit Invoice
          </Button>
        );
      }
    }
  ];

  const invoiceColumns = [
    {
      title: 'Submitted',
      dataIndex: 'submitted_at',
      key: 'submitted_at',
      render: (date: string) => dayjs(date).format('MMM D, YYYY h:mm A'),
      width: 160
    },
    {
      title: 'Week',
      key: 'week',
      render: (_: any, record: Invoice) => (
        <span>
          {dayjs(record.week_start_date).format('MMM D')} - {dayjs(record.week_end_date).format('MMM D, YYYY')}
        </span>
      )
    },
    {
      title: 'Calculated',
      dataIndex: 'calculated_fees',
      key: 'calculated_fees',
      align: 'right' as const,
      render: (amount: number) => `$${amount.toFixed(2)}`
    },
    {
      title: 'Invoiced',
      dataIndex: 'therapist_invoiced_fees',
      key: 'therapist_invoiced_fees',
      align: 'right' as const,
      render: (amount: number) => `$${amount.toFixed(2)}`
    },
    {
      title: 'Variance',
      dataIndex: 'variance_fees',
      key: 'variance_fees',
      align: 'right' as const,
      render: (amount: number) => {
        if (amount === 0) return <span>-</span>;
        const color = amount > 0 ? '#f5222d' : '#52c41a';
        return <span style={{ color, fontWeight: 600 }}>{amount > 0 ? '+' : ''}${amount.toFixed(2)}</span>;
      }
    },
    {
      title: 'Total Claimed',
      dataIndex: 'therapist_total_claimed',
      key: 'therapist_total_claimed',
      align: 'right' as const,
      render: (amount: number) => <strong>${amount.toFixed(2)}</strong>
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      align: 'center' as const,
      render: (status: string) => getStatusTag(status)
    },
    {
      title: 'Action',
      key: 'action',
      align: 'center' as const,
      render: (_: any, record: Invoice) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => handleViewInvoice(record)}
        >
          View Details
        </Button>
      )
    }
  ];

  if (loading && !therapistId) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

  // Calculate summary statistics
  const pendingInvoices = invoices.filter(inv => inv.status === 'submitted' || inv.status === 'under_review').length;
  const approvedAmount = invoices
    .filter(inv => inv.status === 'approved' || inv.status === 'paid')
    .reduce((sum, inv) => sum + (inv.admin_total_approved || 0), 0);
  const paidAmount = invoices
    .filter(inv => inv.status === 'paid')
    .reduce((sum, inv) => sum + (inv.paid_amount || 0), 0);

  return (
    <div>
      <Title level={2} style={{ marginBottom: 24 }}>
        <FileTextOutlined /> My Invoices
      </Title>

      {/* Summary Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Pending Invoices"
              value={pendingInvoices}
              prefix={<ClockCircleOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Approved (This Period)"
              value={approvedAmount}
              precision={2}
              prefix={<DollarOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Paid (All Time)"
              value={paidAmount}
              precision={2}
              prefix={<CheckCircleOutlined style={{ color: '#007e8c' }} />}
              valueStyle={{ color: '#007e8c' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Info Alert */}
      <Alert
        message="Invoice Submission Process"
        description="Submit your invoice after each week ends (Sunday midnight). Include your calculated fees, any parking expenses with receipts, and upload your invoice. Payments are processed on Wednesdays following week completion."
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      {/* Tabs */}
      <Card>
        <Tabs defaultActiveKey="weekly-summary">
          <TabPane tab="Weekly Summary" key="weekly-summary">
            <Table
              dataSource={weeklySummaries}
              columns={weeklySummaryColumns}
              rowKey={(record) => record.week_start}
              loading={loading}
              pagination={{ pageSize: 10 }}
            />
          </TabPane>

          <TabPane tab="Submitted Invoices" key="submitted-invoices">
            <Table
              dataSource={invoices}
              columns={invoiceColumns}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 20 }}
            />
          </TabPane>
        </Tabs>
      </Card>

      {/* Submit Invoice Modal */}
      <Modal
        title="Submit Invoice"
        open={submitModalVisible}
        onCancel={() => {
          setSubmitModalVisible(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        okText="Submit Invoice"
        width={700}
        confirmLoading={loading}
      >
        {selectedWeek && (
          <Form
            form={form}
            layout="vertical"
            onFinish={handleFormSubmit}
          >
            <Alert
              message={`Week: ${dayjs(selectedWeek.week_start).format('MMM D')} - ${dayjs(selectedWeek.week_end).format('MMM D, YYYY')}`}
              description={`${selectedWeek.booking_count} completed jobs | Calculated fees: $${selectedWeek.total_fees.toFixed(2)}`}
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />

            <Form.Item
              label="Invoice Number"
              name="invoice_number"
              help="Your personal invoice number (optional)"
            >
              <Input placeholder="e.g., INV-2025-001" />
            </Form.Item>

            <Form.Item
              label="Invoiced Fees"
              name="invoiced_fees"
              rules={[{ required: true, message: 'Please enter invoiced fees' }]}
              help="This should match the calculated fees unless you have adjustments (explain in notes)"
            >
              <InputNumber
                prefix={<DollarOutlined />}
                style={{ width: '100%' }}
                precision={2}
                min={0}
                placeholder="0.00"
              />
            </Form.Item>

            <Form.Item
              label="Parking Amount"
              name="parking_amount"
              help="Total parking expenses for the week (attach receipt below)"
            >
              <InputNumber
                prefix={<DollarOutlined />}
                style={{ width: '100%' }}
                precision={2}
                min={0}
                placeholder="0.00"
              />
            </Form.Item>

            <Form.Item
              label="Invoice Upload (PDF or Image)"
              name="invoice_upload"
              help="Upload your completed invoice document"
            >
              <Upload
                maxCount={1}
                beforeUpload={() => false}
                listType="picture"
                accept="image/*,.pdf"
              >
                <Button icon={<UploadOutlined />}>Click to Upload Invoice</Button>
              </Upload>
            </Form.Item>

            <Form.Item
              label="Parking Receipt Upload"
              name="parking_receipt_upload"
              help="Upload parking receipt if claiming parking expenses"
            >
              <Upload
                maxCount={1}
                beforeUpload={() => false}
                listType="picture"
                accept="image/*,.pdf"
              >
                <Button icon={<UploadOutlined />}>Click to Upload Receipt</Button>
              </Upload>
            </Form.Item>

            <Form.Item
              label="Notes"
              name="notes"
              help="Explain any variance between calculated and invoiced fees, or other notes"
            >
              <TextArea rows={3} placeholder="Optional notes about this invoice..." />
            </Form.Item>
          </Form>
        )}
      </Modal>

      {/* View Invoice Modal */}
      <Modal
        title="Invoice Details"
        open={viewModalVisible}
        onCancel={() => setViewModalVisible(false)}
        footer={null}
        width={900}
      >
        {selectedInvoice && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* Status Banner */}
            <div style={{ textAlign: 'center', padding: '16px', background: '#f5f5f5', borderRadius: '8px' }}>
              <Text type="secondary">Invoice Status</Text>
              <br />
              {getStatusTag(selectedInvoice.status)}
            </div>

            {/* Invoice Details */}
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="Week" span={2}>
                {dayjs(selectedInvoice.week_start_date).format('MMM D')} - {dayjs(selectedInvoice.week_end_date).format('MMM D, YYYY')}
              </Descriptions.Item>
              <Descriptions.Item label="Submitted">
                {dayjs(selectedInvoice.submitted_at).format('MMM D, YYYY h:mm A')}
              </Descriptions.Item>
              <Descriptions.Item label="Invoice Number">
                {selectedInvoice.therapist_invoice_number || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Calculated Fees">
                ${selectedInvoice.calculated_fees.toFixed(2)}
              </Descriptions.Item>
              <Descriptions.Item label="Invoiced Fees">
                ${selectedInvoice.therapist_invoiced_fees.toFixed(2)}
              </Descriptions.Item>
              <Descriptions.Item label="Variance" span={2}>
                <span style={{
                  color: selectedInvoice.variance_fees === 0 ? 'inherit' :
                         selectedInvoice.variance_fees > 0 ? '#f5222d' : '#52c41a',
                  fontWeight: 600
                }}>
                  {selectedInvoice.variance_fees > 0 ? '+' : ''}${selectedInvoice.variance_fees.toFixed(2)}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="Parking">
                ${selectedInvoice.therapist_parking_amount?.toFixed(2) || '0.00'}
              </Descriptions.Item>
              <Descriptions.Item label="Total Claimed">
                <strong>${selectedInvoice.therapist_total_claimed.toFixed(2)}</strong>
              </Descriptions.Item>
              {selectedInvoice.therapist_notes && (
                <Descriptions.Item label="Your Notes" span={2}>
                  {selectedInvoice.therapist_notes}
                </Descriptions.Item>
              )}
            </Descriptions>

            {/* Admin Approval Section */}
            {(selectedInvoice.status === 'approved' || selectedInvoice.status === 'paid') && (
              <>
                <Descriptions bordered column={2} size="small" title="Admin Approval">
                  <Descriptions.Item label="Approved Fees">
                    ${selectedInvoice.admin_approved_fees?.toFixed(2) || '0.00'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Approved Parking">
                    ${selectedInvoice.admin_approved_parking?.toFixed(2) || '0.00'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Total Approved" span={2}>
                    <strong>${selectedInvoice.admin_total_approved?.toFixed(2) || '0.00'}</strong>
                  </Descriptions.Item>
                  {selectedInvoice.reviewed_at && (
                    <Descriptions.Item label="Reviewed At" span={2}>
                      {dayjs(selectedInvoice.reviewed_at).format('MMM D, YYYY h:mm A')}
                    </Descriptions.Item>
                  )}
                  {selectedInvoice.admin_notes && (
                    <Descriptions.Item label="Admin Notes" span={2}>
                      {selectedInvoice.admin_notes}
                    </Descriptions.Item>
                  )}
                </Descriptions>
              </>
            )}

            {/* Payment Section */}
            {selectedInvoice.status === 'paid' && (
              <Descriptions bordered column={2} size="small" title="Payment Details">
                <Descriptions.Item label="Paid Amount">
                  <strong style={{ color: '#52c41a' }}>${selectedInvoice.paid_amount?.toFixed(2) || '0.00'}</strong>
                </Descriptions.Item>
                <Descriptions.Item label="Paid Date">
                  {selectedInvoice.paid_date ? dayjs(selectedInvoice.paid_date).format('MMM D, YYYY') : 'N/A'}
                </Descriptions.Item>
                {selectedInvoice.eft_reference && (
                  <Descriptions.Item label="EFT Reference" span={2}>
                    {selectedInvoice.eft_reference}
                  </Descriptions.Item>
                )}
              </Descriptions>
            )}

            {/* Invoice Document */}
            {selectedInvoice.therapist_invoice_url && (
              <div>
                <h4>Invoice Document</h4>
                <Image
                  src={selectedInvoice.therapist_invoice_url}
                  alt="Invoice"
                  style={{ maxWidth: '100%' }}
                />
              </div>
            )}

            {/* Parking Receipt */}
            {selectedInvoice.parking_receipt_url && (
              <div>
                <h4>Parking Receipt</h4>
                <Image
                  src={selectedInvoice.parking_receipt_url}
                  alt="Parking Receipt"
                  style={{ maxWidth: '100%' }}
                />
              </div>
            )}

            {/* Booking IDs */}
            {selectedInvoice.booking_ids && (
              <div>
                <h4>Included Bookings ({selectedInvoice.booking_count} jobs)</h4>
                <Text code style={{ fontSize: '11px' }}>
                  {selectedInvoice.booking_ids}
                </Text>
              </div>
            )}
          </Space>
        )}
      </Modal>
    </div>
  );
};
