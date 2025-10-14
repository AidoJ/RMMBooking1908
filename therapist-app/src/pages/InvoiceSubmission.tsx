import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  InputNumber,
  Button,
  Upload,
  message,
  Typography,
  Space,
  Divider,
  Table,
  Tag,
  Row,
  Col,
  Alert,
  Modal,
  Spin
} from 'antd';
import {
  FileTextOutlined,
  UploadOutlined,
  DollarOutlined,
  PlusOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface WeeklyEarning {
  booking_id: string;
  service_date: string;
  service_fee: number;
  tip_amount: number;
  total_amount: number;
  customer_name: string;
  business_name: string;
}

interface InvoiceForm {
  invoice_number: string;
  invoice_amount: number;
  parking_amount: number;
  invoice_pdf?: string;
  parking_receipt?: string;
}

const InvoiceSubmission: React.FC = () => {
  const { user } = useAuth();
  const [form] = Form.useForm<InvoiceForm>();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [weeklyEarnings, setWeeklyEarnings] = useState<WeeklyEarning[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [invoiceFile, setInvoiceFile] = useState<any>(null);
  const [parkingFile, setParkingFile] = useState<any>(null);

  useEffect(() => {
    if (user?.therapist_id) {
      loadWeeklyEarnings();
    }
  }, [user]);

  const loadWeeklyEarnings = async () => {
    try {
      setLoading(true);
      
      const weekStart = dayjs().startOf('week').add(1, 'day').format('YYYY-MM-DD'); // Monday
      const weekEnd = dayjs().endOf('week').add(1, 'day').format('YYYY-MM-DD'); // Sunday

      const response = await fetch('/.netlify/functions/get-weekly-earnings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          therapist_id: user?.therapist_id,
          week_start: weekStart,
          week_end: weekEnd
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setWeeklyEarnings(result.earnings || []);
        
        // Auto-calculate total amount
        const totalEarnings = result.earnings?.reduce((sum: number, earning: WeeklyEarning) => 
          sum + earning.total_amount, 0) || 0;
        
        form.setFieldsValue({
          invoice_amount: totalEarnings
        });
      }
    } catch (error) {
      console.error('Error loading weekly earnings:', error);
      message.error('Failed to load weekly earnings');
    } finally {
      setLoading(false);
    }
  };

  const handleInvoiceUpload = (info: any) => {
    if (info.file.status === 'done') {
      setInvoiceFile(info.file);
      form.setFieldsValue({ invoice_pdf: info.file.response?.url });
    }
  };

  const handleParkingUpload = (info: any) => {
    if (info.file.status === 'done') {
      setParkingFile(info.file);
      form.setFieldsValue({ parking_receipt: info.file.response?.url });
    }
  };

  const calculateTotal = () => {
    const earnings = weeklyEarnings.reduce((sum, earning) => sum + earning.total_amount, 0);
    const parking = form.getFieldValue('parking_amount') || 0;
    return earnings + parking;
  };

  const handleSubmitInvoice = async (values: InvoiceForm) => {
    try {
      setSubmitting(true);

      const invoiceData = {
        therapist_id: user?.therapist_id,
        invoice_number: values.invoice_number,
        invoice_amount: values.invoice_amount,
        parking_amount: values.parking_amount || 0,
        invoice_pdf: values.invoice_pdf,
        parking_receipt: values.parking_receipt,
        booking_ids: weeklyEarnings.map(earning => earning.booking_id)
      };

      const response = await fetch('/.netlify/functions/submit-therapist-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoiceData)
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to submit invoice');
      }

      message.success('Invoice submitted successfully!');
      form.resetFields();
      setInvoiceFile(null);
      setParkingFile(null);
      
      // Refresh earnings
      await loadWeeklyEarnings();

    } catch (error) {
      console.error('Error submitting invoice:', error);
      message.error('Failed to submit invoice');
    } finally {
      setSubmitting(false);
    }
  };

  const earningsColumns = [
    {
      title: 'Date',
      dataIndex: 'service_date',
      key: 'service_date',
      render: (date: string) => dayjs(date).format('MMM DD')
    },
    {
      title: 'Booking #',
      dataIndex: 'booking_id',
      key: 'booking_id',
      render: (id: string) => <Text code>{id}</Text>
    },
    {
      title: 'Customer',
      dataIndex: 'customer_name',
      key: 'customer_name'
    },
    {
      title: 'Location',
      dataIndex: 'business_name',
      key: 'business_name'
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
      dataIndex: 'total_amount',
      key: 'total_amount',
      render: (total: number) => <Text strong>${total.toFixed(2)}</Text>
    }
  ];

  const totalEarnings = weeklyEarnings.reduce((sum, earning) => sum + earning.total_amount, 0);
  const parkingAmount = form.getFieldValue('parking_amount') || 0;
  const grandTotal = totalEarnings + parkingAmount;

  return (
    <div style={{ padding: '16px', maxWidth: '800px', margin: '0 auto' }}>
      <Title level={2}>Submit Invoice</Title>
      
      {/* Weekly Earnings Summary */}
      <Card style={{ marginBottom: '16px' }}>
        <Title level={4}>This Week's Earnings</Title>
        <Row gutter={16}>
          <Col xs={24} sm={8}>
            <div style={{ textAlign: 'center' }}>
              <Text type="secondary">Jobs Completed</Text>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1890ff' }}>
                {weeklyEarnings.length}
              </div>
            </div>
          </Col>
          <Col xs={24} sm={8}>
            <div style={{ textAlign: 'center' }}>
              <Text type="secondary">Service Fees</Text>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#52c41a' }}>
                ${totalEarnings.toFixed(2)}
              </div>
            </div>
          </Col>
          <Col xs={24} sm={8}>
            <div style={{ textAlign: 'center' }}>
              <Text type="secondary">Total Tips</Text>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#fa8c16' }}>
                ${weeklyEarnings.reduce((sum, earning) => sum + earning.tip_amount, 0).toFixed(2)}
              </div>
            </div>
          </Col>
        </Row>
      </Card>

      {/* Earnings Details Table */}
      <Card style={{ marginBottom: '16px' }}>
        <Title level={4}>Job Details</Title>
        <Table
          dataSource={weeklyEarnings}
          columns={earningsColumns}
          rowKey="booking_id"
          pagination={false}
          size="small"
          loading={loading}
        />
      </Card>

      {/* Invoice Submission Form */}
      <Card>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmitInvoice}
          disabled={submitting}
        >
          <Title level={4}>Invoice Details</Title>
          
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Your Invoice Number"
                name="invoice_number"
                rules={[{ required: true, message: 'Please enter your invoice number' }]}
              >
                <Input placeholder="e.g., INV-2025-001" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                label="Invoice Amount"
                name="invoice_amount"
                rules={[{ required: true, message: 'Please enter invoice amount' }]}
              >
                <InputNumber
                  prefix="$"
                  min={0}
                  step={0.01}
                  style={{ width: '100%' }}
                  placeholder="0.00"
                />
              </Form.Item>
            </Col>
          </Row>

          <Divider />

          <Title level={5}>Expenses</Title>
          
          <Form.Item
            label="Parking Amount"
            name="parking_amount"
            extra="Enter parking fees if applicable"
          >
            <InputNumber
              prefix="$"
              min={0}
              step={0.01}
              style={{ width: '100%' }}
              placeholder="0.00"
            />
          </Form.Item>

          <Divider />

          <Title level={5}>File Uploads</Title>
          
          <Form.Item
            label="Upload Your Invoice (PDF)"
            name="invoice_pdf"
            rules={[{ required: true, message: 'Please upload your invoice' }]}
          >
            <Upload
              name="invoice"
              listType="text"
              showUploadList={true}
              onChange={handleInvoiceUpload}
              beforeUpload={() => false}
              accept=".pdf"
            >
              <Button icon={<UploadOutlined />}>
                Choose Invoice PDF
              </Button>
            </Upload>
          </Form.Item>

          <Form.Item
            label="Parking Receipt (Optional)"
            name="parking_receipt"
            extra="Upload parking receipt if you're claiming parking expenses"
          >
            <Upload
              name="parking"
              listType="picture-card"
              showUploadList={true}
              onChange={handleParkingUpload}
              beforeUpload={() => false}
              accept="image/*"
            >
              <div>
                <PlusOutlined />
                <div style={{ marginTop: 8 }}>Upload Receipt</div>
              </div>
            </Upload>
          </Form.Item>

          {/* Total Calculation */}
          <Alert
            message="Invoice Total"
            description={
              <div>
                <div>Service Fees: ${totalEarnings.toFixed(2)}</div>
                {parkingAmount > 0 && <div>Parking: ${parkingAmount.toFixed(2)}</div>}
                <Divider style={{ margin: '8px 0' }} />
                <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                  Total: ${grandTotal.toFixed(2)}
                </div>
              </div>
            }
            type="info"
            icon={<InfoCircleOutlined />}
            style={{ marginBottom: '16px' }}
          />

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                icon={<CheckCircleOutlined />}
                loading={submitting}
                size="large"
              >
                Submit Invoice
              </Button>
              
              <Button
                onClick={() => setShowPreview(true)}
                disabled={submitting}
                size="large"
              >
                Preview
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      {/* Preview Modal */}
      <Modal
        title="Invoice Preview"
        open={showPreview}
        onCancel={() => setShowPreview(false)}
        footer={null}
        width={600}
      >
        <div style={{ padding: '16px' }}>
          <Title level={4}>Invoice Summary</Title>
          
          <div style={{ marginBottom: '16px' }}>
            <Text strong>Invoice #: </Text>
            <Text>{form.getFieldValue('invoice_number') || 'Not specified'}</Text>
          </div>
          
          <div style={{ marginBottom: '16px' }}>
            <Text strong>Week: </Text>
            <Text>{dayjs().startOf('week').add(1, 'day').format('MMM DD')} - {dayjs().endOf('week').add(1, 'day').format('MMM DD, YYYY')}</Text>
          </div>
          
          <Table
            dataSource={weeklyEarnings}
            columns={earningsColumns}
            rowKey="booking_id"
            pagination={false}
            size="small"
            summary={() => (
              <Table.Summary>
                <Table.Summary.Row>
                  <Table.Summary.Cell colSpan={5}>
                    <Text strong>Subtotal</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell>
                    <Text strong>${totalEarnings.toFixed(2)}</Text>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
                {parkingAmount > 0 && (
                  <Table.Summary.Row>
                    <Table.Summary.Cell colSpan={5}>
                      <Text strong>Parking</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell>
                      <Text strong>${parkingAmount.toFixed(2)}</Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                )}
                <Table.Summary.Row>
                  <Table.Summary.Cell colSpan={5}>
                    <Text strong>Total</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell>
                    <Text strong style={{ fontSize: '16px' }}>${grandTotal.toFixed(2)}</Text>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            )}
          />
        </div>
      </Modal>
    </div>
  );
};

export default InvoiceSubmission;

