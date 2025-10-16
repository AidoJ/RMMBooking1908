import React, { useState, useEffect } from 'react';
import { Table, Button, Tag, message, Modal, Form, Input, InputNumber, Image, Space, Descriptions, DatePicker, Select, Upload } from 'antd';
import { CheckOutlined, CloseOutlined, EyeOutlined, DollarOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons';
import { supabaseClient } from '../../utility';
import dayjs from 'dayjs';

const { TextArea } = Input;
const { Option } = Select;

interface PendingInvoice {
  id: string;
  therapist_id: string;
  therapist_name: string;
  week_start_date: string;
  week_end_date: string;
  calculated_fees: number;
  therapist_invoiced_fees: number;
  therapist_parking_amount: number;
  therapist_total_claimed: number;
  variance_fees: number;
  therapist_invoice_url: string;
  parking_receipt_url: string;
  therapist_notes: string;
  submitted_at: string;
  status: string;
}

const PendingInvoicesTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [invoices, setInvoices] = useState<PendingInvoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<PendingInvoice | null>(null);
  const [approveModalVisible, setApproveModalVisible] = useState(false);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [manualEntryModalVisible, setManualEntryModalVisible] = useState(false);
  const [therapists, setTherapists] = useState<any[]>([]);
  const [form] = Form.useForm();
  const [manualForm] = Form.useForm();

  useEffect(() => {
    loadPendingInvoices();
    loadTherapists();
  }, []);

  const loadTherapists = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('therapist_profiles')
        .select('id, first_name, last_name')
        .eq('is_active', true)
        .order('first_name');

      if (error) throw error;
      setTherapists(data || []);
    } catch (error) {
      console.error('Error loading therapists:', error);
    }
  };

  const loadPendingInvoices = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabaseClient
        .from('therapist_payments')
        .select(`
          *,
          therapist_profiles!therapist_payments_therapist_id_fkey(id, first_name, last_name)
        `)
        .in('status', ['submitted', 'under_review'])
        .order('submitted_at', { ascending: false });

      if (error) throw error;

      const formattedInvoices = data?.map((inv: any) => ({
        id: inv.id,
        therapist_id: inv.therapist_id,
        therapist_name: `${inv.therapist_profiles.first_name} ${inv.therapist_profiles.last_name}`,
        week_start_date: inv.week_start_date,
        week_end_date: inv.week_end_date,
        calculated_fees: parseFloat(inv.calculated_fees || 0),
        therapist_invoiced_fees: parseFloat(inv.therapist_invoiced_fees || 0),
        therapist_parking_amount: parseFloat(inv.therapist_parking_amount || 0),
        therapist_total_claimed: parseFloat(inv.therapist_total_claimed || 0),
        variance_fees: parseFloat(inv.variance_fees || 0),
        therapist_invoice_url: inv.therapist_invoice_url,
        parking_receipt_url: inv.parking_receipt_url,
        therapist_notes: inv.therapist_notes,
        submitted_at: inv.submitted_at,
        status: inv.status
      })) || [];

      setInvoices(formattedInvoices);

    } catch (error) {
      console.error('Error loading pending invoices:', error);
      message.error('Failed to load pending invoices');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (invoice: PendingInvoice) => {
    setSelectedInvoice(invoice);
    setViewModalVisible(true);
  };

  const handleApprove = (invoice: PendingInvoice) => {
    setSelectedInvoice(invoice);
    form.setFieldsValue({
      admin_approved_fees: invoice.therapist_invoiced_fees,
      admin_approved_parking: invoice.therapist_parking_amount,
      admin_notes: ''
    });
    setApproveModalVisible(true);
  };

  const handleReject = async (invoice: PendingInvoice) => {
    Modal.confirm({
      title: 'Reject Invoice',
      content: (
        <div>
          <p>Are you sure you want to reject this invoice?</p>
          <p><strong>{invoice.therapist_name}</strong></p>
          <p>Week: {dayjs(invoice.week_start_date).format('MMM D')} - {dayjs(invoice.week_end_date).format('MMM D, YYYY')}</p>
        </div>
      ),
      okText: 'Reject',
      okType: 'danger',
      onOk: async () => {
        try {
          const { error } = await supabaseClient
            .from('therapist_payments')
            .update({ status: 'rejected' })
            .eq('id', invoice.id);

          if (error) throw error;

          message.success('Invoice rejected');
          loadPendingInvoices();
        } catch (error) {
          console.error('Error rejecting invoice:', error);
          message.error('Failed to reject invoice');
        }
      }
    });
  };

  const handleSubmitApproval = async (values: any) => {
    if (!selectedInvoice) return;

    try {
      const { error } = await supabaseClient
        .from('therapist_payments')
        .update({
          admin_approved_fees: values.admin_approved_fees,
          admin_approved_parking: values.admin_approved_parking,
          admin_notes: values.admin_notes,
          status: 'approved',
          reviewed_at: new Date().toISOString()
        })
        .eq('id', selectedInvoice.id);

      if (error) throw error;

      message.success('Invoice approved successfully');
      setApproveModalVisible(false);
      form.resetFields();
      loadPendingInvoices();
    } catch (error) {
      console.error('Error approving invoice:', error);
      message.error('Failed to approve invoice');
    }
  };

  const columns = [
    {
      title: 'Submitted',
      dataIndex: 'submitted_at',
      key: 'submitted_at',
      render: (date: string) => dayjs(date).format('MMM D, YYYY h:mm A'),
      width: 180
    },
    {
      title: 'Therapist',
      dataIndex: 'therapist_name',
      key: 'therapist_name',
      render: (name: string) => <strong style={{ color: '#1890ff' }}>{name}</strong>
    },
    {
      title: 'Week',
      key: 'week',
      render: (_: any, record: PendingInvoice) => (
        <span>
          {dayjs(record.week_start_date).format('MMM D')} - {dayjs(record.week_end_date).format('MMM D')}
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
      title: 'Parking',
      dataIndex: 'therapist_parking_amount',
      key: 'therapist_parking_amount',
      align: 'right' as const,
      render: (amount: number) => `$${amount.toFixed(2)}`
    },
    {
      title: 'Total',
      dataIndex: 'therapist_total_claimed',
      key: 'therapist_total_claimed',
      align: 'right' as const,
      render: (amount: number) => <strong>${amount.toFixed(2)}</strong>
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'center' as const,
      width: 250,
      render: (_: any, record: PendingInvoice) => (
        <Space>
          <Button
            icon={<EyeOutlined />}
            size="small"
            onClick={() => handleViewDetails(record)}
          >
            View
          </Button>
          <Button
            type="primary"
            icon={<CheckOutlined />}
            size="small"
            onClick={() => handleApprove(record)}
          >
            Approve
          </Button>
          <Button
            danger
            icon={<CloseOutlined />}
            size="small"
            onClick={() => handleReject(record)}
          >
            Reject
          </Button>
        </Space>
      )
    }
  ];

  const handleManualEntry = () => {
    manualForm.resetFields();
    setManualEntryModalVisible(true);
  };

  const handleSubmitManualEntry = async (values: any) => {
    try {
      setLoading(true);

      // Get completed bookings for the week to calculate fees
      const weekStart = values.week_start_date.format('YYYY-MM-DD');
      const weekEnd = values.week_end_date.format('YYYY-MM-DD');

      const { data: bookings, error: bookingsError } = await supabaseClient
        .from('bookings')
        .select('therapist_fee')
        .eq('therapist_id', values.therapist_id)
        .eq('status', 'completed')
        .gte('booking_time', weekStart)
        .lte('booking_time', weekEnd + ' 23:59:59');

      if (bookingsError) throw bookingsError;

      const calculatedFees = bookings?.reduce((sum, b) => sum + parseFloat(b.therapist_fee || '0'), 0) || 0;

      // Upload invoice file if present
      let invoiceUrl = null;
      if (values.invoice_upload?.fileList?.[0]?.originFileObj) {
        const file = values.invoice_upload.fileList[0].originFileObj;
        const fileExt = file.name.split('.').pop();
        const fileName = `${values.therapist_id}_${weekStart}_invoice.${fileExt}`;
        const filePath = `therapist-invoices/${fileName}`;

        const { error: uploadError } = await supabaseClient.storage
          .from('invoices')
          .upload(filePath, file, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabaseClient.storage
          .from('invoices')
          .getPublicUrl(filePath);

        invoiceUrl = urlData.publicUrl;
      }

      // Upload parking receipt if present
      let receiptUrl = null;
      if (values.parking_receipt_upload?.fileList?.[0]?.originFileObj) {
        const file = values.parking_receipt_upload.fileList[0].originFileObj;
        const fileExt = file.name.split('.').pop();
        const fileName = `${values.therapist_id}_${weekStart}_parking.${fileExt}`;
        const filePath = `parking-receipts/${fileName}`;

        const { error: uploadError } = await supabaseClient.storage
          .from('invoices')
          .upload(filePath, file, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabaseClient.storage
          .from('invoices')
          .getPublicUrl(filePath);

        receiptUrl = urlData.publicUrl;
      }

      // Create invoice record
      const { error: insertError } = await supabaseClient
        .from('therapist_payments')
        .insert({
          therapist_id: values.therapist_id,
          week_start_date: weekStart,
          week_end_date: weekEnd,
          calculated_fees: calculatedFees,
          therapist_invoice_number: values.invoice_number || null,
          therapist_invoiced_fees: values.invoiced_fees,
          therapist_parking_amount: values.parking_amount || 0,
          therapist_invoice_url: invoiceUrl,
          parking_receipt_url: receiptUrl,
          therapist_notes: values.notes || 'Manually entered by admin',
          submitted_at: new Date().toISOString(),
          status: values.status
        });

      if (insertError) throw insertError;

      message.success('Invoice created successfully');
      setManualEntryModalVisible(false);
      manualForm.resetFields();
      loadPendingInvoices();
    } catch (error) {
      console.error('Error creating manual invoice:', error);
      message.error('Failed to create invoice');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Pending Invoices</h3>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleManualEntry}
        >
          Manual Invoice Entry
        </Button>
      </div>

      <Table
        dataSource={invoices}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
      />

      {/* View Details Modal */}
      <Modal
        title="Invoice Details"
        open={viewModalVisible}
        onCancel={() => setViewModalVisible(false)}
        footer={null}
        width={800}
      >
        {selectedInvoice && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Descriptions bordered column={2}>
              <Descriptions.Item label="Therapist">{selectedInvoice.therapist_name}</Descriptions.Item>
              <Descriptions.Item label="Week">
                {dayjs(selectedInvoice.week_start_date).format('MMM D')} - {dayjs(selectedInvoice.week_end_date).format('MMM D, YYYY')}
              </Descriptions.Item>
              <Descriptions.Item label="Calculated Fees">${selectedInvoice.calculated_fees.toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="Invoiced Fees">${selectedInvoice.therapist_invoiced_fees.toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="Variance" span={2}>
                <span style={{ color: selectedInvoice.variance_fees === 0 ? 'inherit' : selectedInvoice.variance_fees > 0 ? '#f5222d' : '#52c41a', fontWeight: 600 }}>
                  {selectedInvoice.variance_fees > 0 ? '+' : ''}${selectedInvoice.variance_fees.toFixed(2)}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="Parking">${selectedInvoice.therapist_parking_amount.toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="Total Claimed">${selectedInvoice.therapist_total_claimed.toFixed(2)}</Descriptions.Item>
              {selectedInvoice.therapist_notes && (
                <Descriptions.Item label="Notes" span={2}>{selectedInvoice.therapist_notes}</Descriptions.Item>
              )}
            </Descriptions>

            {selectedInvoice.therapist_invoice_url && (
              <div>
                <h4>Invoice</h4>
                <Image src={selectedInvoice.therapist_invoice_url} alt="Invoice" style={{ maxWidth: '100%' }} />
              </div>
            )}

            {selectedInvoice.parking_receipt_url && (
              <div>
                <h4>Parking Receipt</h4>
                <Image src={selectedInvoice.parking_receipt_url} alt="Parking Receipt" style={{ maxWidth: '100%' }} />
              </div>
            )}
          </Space>
        )}
      </Modal>

      {/* Approve Modal */}
      <Modal
        title="Approve Invoice"
        open={approveModalVisible}
        onCancel={() => {
          setApproveModalVisible(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        okText="Approve & Process"
        width={600}
      >
        {selectedInvoice && (
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmitApproval}
          >
            <Descriptions bordered column={1} size="small" style={{ marginBottom: 24 }}>
              <Descriptions.Item label="Therapist">{selectedInvoice.therapist_name}</Descriptions.Item>
              <Descriptions.Item label="Week">
                {dayjs(selectedInvoice.week_start_date).format('MMM D')} - {dayjs(selectedInvoice.week_end_date).format('MMM D, YYYY')}
              </Descriptions.Item>
            </Descriptions>

            <Form.Item
              label="Approved Fees"
              name="admin_approved_fees"
              rules={[{ required: true, message: 'Please enter approved fees' }]}
            >
              <InputNumber
                prefix={<DollarOutlined />}
                style={{ width: '100%' }}
                precision={2}
                min={0}
              />
            </Form.Item>

            <Form.Item
              label="Approved Parking"
              name="admin_approved_parking"
              rules={[{ required: true, message: 'Please enter approved parking' }]}
            >
              <InputNumber
                prefix={<DollarOutlined />}
                style={{ width: '100%' }}
                precision={2}
                min={0}
              />
            </Form.Item>

            <Form.Item
              label="Admin Notes"
              name="admin_notes"
            >
              <TextArea rows={3} placeholder="Any notes about this approval..." />
            </Form.Item>
          </Form>
        )}
      </Modal>

      {/* Manual Entry Modal */}
      <Modal
        title="Manual Invoice Entry"
        open={manualEntryModalVisible}
        onCancel={() => {
          setManualEntryModalVisible(false);
          manualForm.resetFields();
        }}
        onOk={() => manualForm.submit()}
        okText="Create Invoice"
        width={700}
      >
        <Form
          form={manualForm}
          layout="vertical"
          onFinish={handleSubmitManualEntry}
        >
          <Form.Item
            label="Therapist"
            name="therapist_id"
            rules={[{ required: true, message: 'Please select a therapist' }]}
          >
            <Select placeholder="Select therapist" showSearch filterOption={(input, option) =>
              (option?.children as string).toLowerCase().includes(input.toLowerCase())
            }>
              {therapists.map(t => (
                <Option key={t.id} value={t.id}>
                  {t.first_name} {t.last_name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Space style={{ width: '100%' }} size="middle">
            <Form.Item
              label="Week Start (Monday)"
              name="week_start_date"
              rules={[{ required: true, message: 'Please select week start' }]}
              style={{ width: '100%' }}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item
              label="Week End (Sunday)"
              name="week_end_date"
              rules={[{ required: true, message: 'Please select week end' }]}
              style={{ width: '100%' }}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Space>

          <Form.Item
            label="Invoice Number"
            name="invoice_number"
          >
            <Input placeholder="e.g., INV-2025-001" />
          </Form.Item>

          <Space style={{ width: '100%' }} size="middle">
            <Form.Item
              label="Invoiced Fees"
              name="invoiced_fees"
              rules={[{ required: true, message: 'Please enter fees' }]}
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
            >
              <InputNumber
                prefix={<DollarOutlined />}
                style={{ width: '100%' }}
                precision={2}
                min={0}
                placeholder="0.00"
              />
            </Form.Item>
          </Space>

          <Form.Item
            label="Invoice Upload (PDF or Image)"
            name="invoice_upload"
            tooltip="Optional: Upload scanned invoice or photo"
          >
            <Upload
              maxCount={1}
              beforeUpload={() => false}
              listType="picture"
            >
              <Button icon={<UploadOutlined />}>Click to Upload Invoice</Button>
            </Upload>
          </Form.Item>

          <Form.Item
            label="Parking Receipt Upload"
            name="parking_receipt_upload"
            tooltip="Optional: Upload parking receipt if applicable"
          >
            <Upload
              maxCount={1}
              beforeUpload={() => false}
              listType="picture"
            >
              <Button icon={<UploadOutlined />}>Click to Upload Receipt</Button>
            </Upload>
          </Form.Item>

          <Form.Item
            label="Notes"
            name="notes"
          >
            <TextArea rows={3} placeholder="Reason for manual entry (e.g., emailed invoice, app failure)" />
          </Form.Item>

          <Form.Item
            label="Status"
            name="status"
            initialValue="submitted"
            rules={[{ required: true }]}
          >
            <Select>
              <Option value="submitted">Submitted (requires approval)</Option>
              <Option value="approved">Approved (ready for payment)</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PendingInvoicesTab;
