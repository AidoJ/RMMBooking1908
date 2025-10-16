import React, { useState, useEffect } from 'react';
import { Table, Button, Tag, message, Modal, Form, Input, InputNumber, Image, Space, Descriptions } from 'antd';
import { CheckOutlined, CloseOutlined, EyeOutlined, DollarOutlined } from '@ant-design/icons';
import { supabaseClient } from '../../utility';
import dayjs from 'dayjs';

const { TextArea } = Input;

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
  const [form] = Form.useForm();

  useEffect(() => {
    loadPendingInvoices();
  }, []);

  const loadPendingInvoices = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabaseClient
        .from('therapist_payments')
        .select(`
          *,
          therapist_profiles(id, first_name, last_name)
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

  return (
    <div>
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
    </div>
  );
};

export default PendingInvoicesTab;
