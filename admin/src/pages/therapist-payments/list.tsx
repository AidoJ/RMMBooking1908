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

        {/* Summary Statistics */}
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