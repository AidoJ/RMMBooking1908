// Version: Admin Payments UI — Exceptions & Submitted Invoices — 2025-10-14T00:00:00Z
import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Typography,
  Row,
  Col,
  DatePicker,
  message,
  Modal,
  Form,
  Input,
  InputNumber,
  Tag,
  Statistic,
  Spin,
  Alert,
} from 'antd';
import {
  DollarOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  LeftOutlined,
  RightOutlined,
  ReloadOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { useGetIdentity } from '@refinedev/core';
import { UserIdentity, canAccess } from '../../utils/roleUtils';
import { RoleGuard } from '../../components/RoleGuard';
import { TherapistPaymentService, WeeklyPaymentData } from '../../services/therapistPaymentService';
import { supabaseClient } from '../../utility';
import dayjs, { Dayjs } from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear';

dayjs.extend(weekOfYear);

const { Title, Text } = Typography;

export const TherapistPaymentsList: React.FC = () => {
  const { data: identity } = useGetIdentity<UserIdentity>();
  
  // State management
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [currentWeek, setCurrentWeek] = useState<{ start: Date; end: Date }>(
    TherapistPaymentService.getCurrentWeek()
  );
  const [paymentData, setPaymentData] = useState<WeeklyPaymentData[]>([]);
  const [submittedInvoices, setSubmittedInvoices] = useState<any[]>([]);
  const [missingInvoices, setMissingInvoices] = useState<any[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<WeeklyPaymentData | null>(null);
  const [form] = Form.useForm();

  // Load payment data when component mounts or week changes
  useEffect(() => {
    loadPaymentData();
  }, [currentWeek]);

  const loadPaymentData = async () => {
    try {
      setLoading(true);
      const data = await TherapistPaymentService.getWeeklyPaymentData(
        currentWeek.start,
        currentWeek.end
      );
      setPaymentData(data);

      // New: Pull submitted invoices and exceptions for selected week
      const weekStartISO = new Date(currentWeek.start);
      const weekEndISO = new Date(currentWeek.end);
      const weekStartStr = weekStartISO.toISOString().slice(0, 10);
      const weekEndStr = weekEndISO.toISOString().slice(0, 10);

      // Submitted invoices from therapist_payments
      const { data: invoices, error: invErr } = await supabaseClient
        .from('therapist_payments')
        .select(`*, therapist_profiles:therapist_id(first_name,last_name)`) // role alias
        .gte('week_start_date', weekStartStr)
        .lte('week_end_date', weekEndStr)
        .order('submitted_at', { ascending: false });

      if (!invErr) {
        setSubmittedInvoices(
          (invoices || []).map((inv: any) => ({
            ...inv,
            therapist_name: `${inv.therapist_profiles?.first_name || ''} ${inv.therapist_profiles?.last_name || ''}`.trim(),
          }))
        );
      }

      // Exceptions: therapists with completed jobs in week but no submitted invoice
      const { data: completedBookings, error: cbErr } = await supabaseClient
        .from('bookings')
        .select(`therapist_id, therapist_fee, tip_amount, completion_timestamp, therapist_profiles(first_name,last_name)`) 
        .eq('status', 'completed')
        .gte('completion_timestamp', `${weekStartStr}T00:00:00`)
        .lte('completion_timestamp', `${weekEndStr}T23:59:59`);

      if (!cbErr) {
        const therapistsWithCompleted = new Map<string, { therapist_id: string; therapist_name: string; jobs: number; total: number }>();
        (completedBookings || []).forEach((b: any) => {
          if (!b?.therapist_id) return;
          const key = b.therapist_id as string;
          const name = `${b.therapist_profiles?.first_name || ''} ${b.therapist_profiles?.last_name || ''}`.trim();
          const current = therapistsWithCompleted.get(key) || { therapist_id: key, therapist_name: name, jobs: 0, total: 0 };
          current.jobs += 1;
          const fee = Number(b.therapist_fee || 0);
          const tip = Number(b.tip_amount || 0);
          current.total += fee + tip;
          therapistsWithCompleted.set(key, current);
        });

        const therapistsWithInvoices = new Set<string>((invoices || []).map((i: any) => i.therapist_id));
        const missing = Array.from(therapistsWithCompleted.values()).filter(t => !therapistsWithInvoices.has(t.therapist_id));
        setMissingInvoices(missing);
      }
    } catch (error: any) {
      console.error('Error loading payment data:', error);
      message.error('Failed to load payment data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newStart = new Date(currentWeek.start);
    const newEnd = new Date(currentWeek.end);
    
    if (direction === 'prev') {
      newStart.setDate(newStart.getDate() - 7);
      newEnd.setDate(newEnd.getDate() - 7);
    } else {
      newStart.setDate(newStart.getDate() + 7);
      newEnd.setDate(newEnd.getDate() + 7);
    }
    
    setCurrentWeek({ start: newStart, end: newEnd });
  };

  const goToCurrentWeek = () => {
    setCurrentWeek(TherapistPaymentService.getCurrentWeek());
  };

  const generateWeeklyPayments = async () => {
    try {
      setGenerating(true);
      const result = await TherapistPaymentService.generateWeeklyPaymentsForAllTherapists(
        currentWeek.start,
        currentWeek.end
      );

      if (result.success) {
        message.success(`Generated ${result.paymentIds.length} weekly payment records`);
        await loadPaymentData(); // Refresh the data
      } else {
        message.error(`Failed to generate some payments: ${result.errors.join(', ')}`);
        if (result.paymentIds.length > 0) {
          message.info(`Successfully generated ${result.paymentIds.length} payment records`);
          await loadPaymentData();
        }
      }
    } catch (error: any) {
      console.error('Error generating weekly payments:', error);
      message.error('Failed to generate weekly payments: ' + error.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleMarkAsPaid = (payment: WeeklyPaymentData) => {
    setSelectedPayment(payment);
    form.setFieldsValue({
      paid_amount: payment.total_fee,
      payment_date: dayjs(),
      invoice_number: '',
      payment_reference: '',
      notes: ''
    });
    setShowPaymentModal(true);
  };

  const processPayment = async () => {
    try {
      const values = await form.validateFields();
      
      if (!selectedPayment) return;

      const success = await TherapistPaymentService.markPaymentAsPaid(
        selectedPayment.therapist_id,
        new Date(selectedPayment.week_start_date),
        new Date(selectedPayment.week_end_date),
        {
          paid_amount: values.paid_amount,
          payment_date: values.payment_date.format('YYYY-MM-DD'),
          invoice_number: values.invoice_number,
          payment_reference: values.payment_reference,
          notes: values.notes
        }
      );

      if (success) {
        message.success(`Payment marked as paid for ${selectedPayment.therapist_name}`);
        setShowPaymentModal(false);
        setSelectedPayment(null);
        form.resetFields();
        await loadPaymentData();
      } else {
        message.error('Failed to process payment');
      }
    } catch (error: any) {
      console.error('Error processing payment:', error);
      message.error('Failed to process payment: ' + error.message);
    }
  };

  // Calculate summary statistics
  const stats = paymentData.reduce(
    (acc, payment) => ({
      totalTherapists: acc.totalTherapists + 1,
      totalAssignments: acc.totalAssignments + payment.total_assignments,
      totalHours: acc.totalHours + payment.total_hours,
      totalFees: acc.totalFees + payment.total_fee,
      pendingPayments: acc.pendingPayments + (payment.payment_status === 'pending' ? 1 : 0),
      paidPayments: acc.paidPayments + (payment.payment_status === 'paid' ? 1 : 0),
    }),
    {
      totalTherapists: 0,
      totalAssignments: 0,
      totalHours: 0,
      totalFees: 0,
      pendingPayments: 0,
      paidPayments: 0,
    }
  );

  const columns = [
    {
      title: 'Therapist',
      dataIndex: 'therapist_name',
      key: 'therapist_name',
      render: (name: string) => (
        <Text strong style={{ color: '#1890ff' }}>{name}</Text>
      ),
    },
    {
      title: 'Jobs',
      dataIndex: 'total_assignments',
      key: 'total_assignments',
      align: 'center' as const,
      render: (count: number) => (
        <Text strong>{count}</Text>
      ),
    },
    {
      title: 'Hours',
      dataIndex: 'total_hours',
      key: 'total_hours',
      align: 'center' as const,
      render: (hours: number) => (
        <Text>{hours.toFixed(1)}</Text>
      ),
    },
    {
      title: 'Total Fee',
      dataIndex: 'total_fee',
      key: 'total_fee',
      align: 'right' as const,
      render: (fee: number) => (
        <Text strong style={{ color: '#52c41a', fontSize: '16px' }}>
          ${fee.toFixed(2)}
        </Text>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'payment_status',
      key: 'payment_status',
      align: 'center' as const,
      render: (status: string, record: WeeklyPaymentData) => (
        <div>
          {status === 'paid' ? (
            <Tag color="success" icon={<CheckCircleOutlined />}>
              Paid {record.payment_date && `on ${dayjs(record.payment_date).format('MMM DD')}`}
            </Tag>
          ) : (
            <Tag color="orange" icon={<ClockCircleOutlined />}>
              Pending
            </Tag>
          )}
          {record.invoice_number && (
            <div style={{ marginTop: 4, fontSize: '12px', color: '#666' }}>
              {record.invoice_number}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      align: 'center' as const,
      render: (_: any, record: WeeklyPaymentData) => (
        <Space>
          {record.payment_status === 'pending' && (
            <Button
              type="primary"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleMarkAsPaid(record)}
              style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
            >
              Mark as Paid
            </Button>
          )}
          {record.payment_status === 'paid' && (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Processed
            </Text>
          )}
        </Space>
      ),
    },
  ];

  const weekStartStr = currentWeek.start.toLocaleDateString('en-AU', {
    month: 'short',
    day: 'numeric',
  });
  const weekEndStr = currentWeek.end.toLocaleDateString('en-AU', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <RoleGuard requiredRole="super_admin">
      <div style={{ padding: '24px' }}>
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <Title level={2}>💰 Therapist Payments</Title>
          <Text type="secondary">
            Manage weekly therapist payments and process direct deposits
          </Text>
        </div>

        {/* Week Navigation */}
        <Card style={{ marginBottom: '16px' }}>
          <Row justify="space-between" align="middle">
            <Col>
              <Space>
                <Button
                  icon={<LeftOutlined />}
                  onClick={() => navigateWeek('prev')}
                  disabled={loading || generating}
                >
                  Previous Week
                </Button>
                <Button
                  icon={<CalendarOutlined />}
                  onClick={goToCurrentWeek}
                  disabled={loading || generating}
                >
                  Current Week
                </Button>
                <Button
                  icon={<RightOutlined />}
                  onClick={() => navigateWeek('next')}
                  disabled={loading || generating}
                >
                  Next Week
                </Button>
              </Space>
            </Col>
            <Col>
              <Space>
                <Title level={4} style={{ margin: 0, color: '#1890ff' }}>
                  Week of {weekStartStr} - {weekEndStr}
                </Title>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={loadPaymentData}
                  disabled={loading || generating}
                >
                  Refresh
                </Button>
              </Space>
            </Col>
            <Col>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={generateWeeklyPayments}
                loading={generating}
                disabled={loading}
                size="large"
              >
                Generate Weekly Payments
              </Button>
            </Col>
          </Row>
        </Card>

        {/* Summary Statistics */
        }
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="Therapists"
                value={stats.totalTherapists}
                prefix={<DollarOutlined style={{ color: '#1890ff' }} />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Total Jobs"
                value={stats.totalAssignments}
                prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Total Hours"
                value={stats.totalHours}
                precision={1}
                prefix={<ClockCircleOutlined style={{ color: '#fa8c16' }} />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Total Fees"
                value={stats.totalFees}
                precision={2}
                prefix="$"
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
        </Row>

        {/* Payment Status Summary */}
        {paymentData.length > 0 && (
          <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
            <Col span={12}>
              <Card>
                <Statistic
                  title="Pending Payments"
                  value={stats.pendingPayments}
                  valueStyle={{ color: '#fa8c16' }}
                  prefix={<ClockCircleOutlined />}
                />
              </Card>
            </Col>
            <Col span={12}>
              <Card>
                <Statistic
                  title="Processed Payments"
                  value={stats.paidPayments}
                  valueStyle={{ color: '#52c41a' }}
                  prefix={<CheckCircleOutlined />}
                />
              </Card>
            </Col>
          </Row>
        )}

        {/* Exceptions: No Invoice Submitted */}
        <Card style={{ marginBottom: '16px' }}>
          <Title level={4} style={{ marginBottom: 8 }}>Exceptions: No Invoice Submitted</Title>
          {missingInvoices.length === 0 ? (
            <Alert type="success" message="All therapists with completed jobs have submitted invoices for this week." />
          ) : (
            <Table
              size="small"
              rowKey={(r) => r.therapist_id}
              dataSource={missingInvoices}
              pagination={false}
              columns={[
                { title: 'Therapist', dataIndex: 'therapist_name', key: 'therapist_name', render: (v: string) => <Text strong style={{ color: '#fa8c16' }}>{v}</Text> },
                { title: 'Jobs', dataIndex: 'jobs', key: 'jobs', align: 'center' as const },
                { title: 'Uninvoiced Total', dataIndex: 'total', key: 'total', align: 'right' as const, render: (amt: number) => `$${amt.toFixed(2)}` },
              ]}
            />
          )}
        </Card>

        {/* Submitted Invoices */}
        <Card style={{ marginBottom: '16px' }}>
          <Title level={4} style={{ marginBottom: 8 }}>Submitted Invoices</Title>
          {submittedInvoices.length === 0 ? (
            <Alert type="info" message="No invoices submitted for this week yet." />
          ) : (
            <Table
              size="small"
              rowKey={(r) => r.id}
              dataSource={submittedInvoices}
              pagination={false}
              columns={[
                { title: 'Therapist', dataIndex: 'therapist_name', key: 'therapist_name', render: (v: string) => <Text strong style={{ color: '#1890ff' }}>{v}</Text> },
                { title: 'Invoice #', dataIndex: 'invoice_number', key: 'invoice_number' },
                { title: 'Amount', dataIndex: 'invoice_amount', key: 'invoice_amount', align: 'right' as const, render: (v: number) => `$${Number(v || 0).toFixed(2)}` },
                { title: 'Parking', dataIndex: 'parking_amount', key: 'parking_amount', align: 'right' as const, render: (v: number) => v ? `$${Number(v).toFixed(2)}` : '-' },
                { title: 'Status', dataIndex: 'payment_status', key: 'payment_status', render: (s: string) => (
                  s === 'paid' ? <Tag color="success">Paid</Tag> : s === 'approved' ? <Tag color="blue">Approved</Tag> : s === 'pending' ? <Tag color="orange">Pending</Tag> : <Tag>{s}</Tag>
                ) },
              ]}
            />
          )}
        </Card>

        {/* Main Table */}
        <Card>
          {paymentData.length === 0 && !loading ? (
            <Alert
              message="No Payment Data"
              description={`No weekly payments found for ${weekStartStr} - ${weekEndStr}. Click "Generate Weekly Payments" to create payment records for therapists with completed assignments.`}
              type="info"
              showIcon
              action={
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={generateWeeklyPayments}
                  loading={generating}
                >
                  Generate Now
                </Button>
              }
            />
          ) : (
            <Table
              columns={columns}
              dataSource={paymentData}
              rowKey={(record) => `${record.therapist_id}-${record.week_start_date}`}
              loading={loading}
              pagination={false}
              size="middle"
            />
          )}
        </Card>

        {/* Payment Processing Modal */}
        <Modal
          title={`Process Payment - ${selectedPayment?.therapist_name}`}
          open={showPaymentModal}
          onOk={processPayment}
          onCancel={() => {
            setShowPaymentModal(false);
            setSelectedPayment(null);
            form.resetFields();
          }}
          confirmLoading={false}
          width={600}
        >
          {selectedPayment && (
            <div>
              <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#f0f8ff', borderRadius: '6px' }}>
                <Row gutter={[16, 8]}>
                  <Col span={12}>
                    <Text strong>Week:</Text> {dayjs(selectedPayment.week_start_date).format('MMM DD')} - {dayjs(selectedPayment.week_end_date).format('MMM DD, YYYY')}
                  </Col>
                  <Col span={12}>
                    <Text strong>Jobs:</Text> {selectedPayment.total_assignments}
                  </Col>
                  <Col span={12}>
                    <Text strong>Hours:</Text> {selectedPayment.total_hours.toFixed(1)}
                  </Col>
                  <Col span={12}>
                    <Text strong>Total Earned:</Text> <Text style={{ color: '#52c41a', fontWeight: 'bold' }}>${selectedPayment.total_fee.toFixed(2)}</Text>
                  </Col>
                </Row>
              </div>

              <Form form={form} layout="vertical">
                <Form.Item
                  name="paid_amount"
                  label="Amount Paid"
                  rules={[{ required: true, message: 'Please enter the payment amount' }]}
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    prefix="$"
                    precision={2}
                    min={0}
                  />
                </Form.Item>

                <Form.Item
                  name="payment_date"
                  label="Payment Date"
                  rules={[{ required: true, message: 'Please select the payment date' }]}
                >
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>

                <Form.Item
                  name="invoice_number"
                  label="Invoice/Reference Number"
                  rules={[{ required: true, message: 'Please enter the invoice or reference number' }]}
                >
                  <Input placeholder="e.g., INV-2024-1115 or DD-REF-001" />
                </Form.Item>

                <Form.Item
                  name="payment_reference"
                  label="Payment Reference (Optional)"
                >
                  <Input placeholder="Bank transfer reference or transaction ID" />
                </Form.Item>

                <Form.Item
                  name="notes"
                  label="Notes (Optional)"
                >
                  <Input.TextArea
                    rows={3}
                    placeholder="Any additional notes about this payment..."
                  />
                </Form.Item>
              </Form>
            </div>
          )}
        </Modal>
      </div>
    </RoleGuard>
  );
};