import React, { useState, useEffect } from 'react';
import {
  Card,
  Typography,
  message,
  Spin,
  Table,
  Button,
  Tag,
  Modal,
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
  EyeOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  DollarOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

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
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Get therapist profile from localStorage
      const profileStr = localStorage.getItem('therapist_profile');
      if (!profileStr) {
        message.error('Please log in again');
        setLoading(false);
        return;
      }

      const profile = JSON.parse(profileStr);
      if (!profile || !profile.id) {
        console.error('Invalid therapist profile in localStorage');
        message.error('Please log in again');
        setLoading(false);
        return;
      }

      setTherapistId(profile.id);

      // Load invoices
      await loadInvoices(profile.id);
    } catch (error) {
      console.error('Error loading data:', error);
      message.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadInvoices = async (_therapistId: string) => {
    try {
      // Get JWT token
      const token = localStorage.getItem('therapistToken');
      if (!token) {
        throw new Error('Not authenticated. Please log in again.');
      }

      // Retrieve invoices via Netlify function (bypasses RLS with service role)
      const response = await fetch('/.netlify/functions/therapist-get-invoices', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to fetch invoices');
      }

      setInvoices(result.data || []);
    } catch (error: any) {
      console.error('Error loading invoices:', error);
      message.error(error.message || 'Failed to load invoices');
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
        message="Invoice Tracking"
        description="This page shows all invoices you have submitted. To submit new invoices for completed weeks, please visit the 'My Earnings' page. Invoices are typically reviewed within 2-3 business days, and payments are processed on Wednesdays following approval."
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      {/* Invoices Table */}
      <Card title="Submitted Invoices">
        <Table
          dataSource={invoices}
          columns={invoiceColumns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20 }}
          locale={{ emptyText: 'No invoices submitted yet. Visit My Earnings to submit invoices for completed weeks.' }}
        />
      </Card>

      {/* View Invoice Modal */}
      <Modal
        title="Invoice Details"
        open={viewModalVisible}
        onCancel={() => setViewModalVisible(false)}
        footer={null}
        width="100%"
        style={{ maxWidth: '900px', top: 20 }}
        destroyOnClose
        zIndex={1000}
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
                <Space wrap>
                  {selectedInvoice.booking_ids.split(',').map((id, index) => (
                    <Text key={index} strong style={{ fontSize: '12px', color: '#007e8c', letterSpacing: '0.5px' }}>
                      {id.trim()}
                    </Text>
                  ))}
                </Space>
              </div>
            )}
          </Space>
        )}
      </Modal>
    </div>
  );
};
