import React, { useState, useEffect } from 'react';
import { Table, Select, Button, Tag, Space, Modal, Form, Input, InputNumber, DatePicker, message } from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, DollarOutlined } from '@ant-design/icons';
import { supabaseClient } from '../../utility';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

interface PaymentRecord {
  id: string;
  therapist_id: string;
  therapist_name: string;
  week_ending: string;
  invoice_number: string;
  invoice_date: string;
  admin_approved_fees: number;
  admin_approved_parking: number;
  admin_total_approved: number;
  paid_amount: number;
  paid_date: string;
  eft_reference: string;
  payment_notes: string;
  status: string;
}

const PaymentHistoryTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [therapists, setTherapists] = useState<any[]>([]);
  const [selectedTherapist, setSelectedTherapist] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [recordPaymentModalVisible, setRecordPaymentModalVisible] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadTherapists();
    loadPaymentHistory();
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

  const loadPaymentHistory = async (therapistId?: string, status?: string) => {
    try {
      setLoading(true);

      let query = supabaseClient
        .from('therapist_payments')
        .select(`
          *,
          therapist_profiles!therapist_payments_therapist_id_fkey(id, first_name, last_name)
        `)
        .in('status', ['approved', 'paid'])
        .order('week_end_date', { ascending: false });

      if (therapistId && therapistId !== 'all') {
        query = query.eq('therapist_id', therapistId);
      }

      if (status && status !== 'all') {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) throw error;

      const formattedPayments = data?.map((payment: any) => ({
        id: payment.id,
        therapist_id: payment.therapist_id,
        therapist_name: `${payment.therapist_profiles.first_name} ${payment.therapist_profiles.last_name}`,
        week_ending: payment.week_end_date,
        invoice_number: payment.therapist_invoice_number,
        invoice_date: payment.therapist_invoice_date,
        admin_approved_fees: parseFloat(payment.admin_approved_fees || 0),
        admin_approved_parking: parseFloat(payment.admin_approved_parking || 0),
        admin_total_approved: parseFloat(payment.admin_total_approved || 0),
        paid_amount: parseFloat(payment.paid_amount || 0),
        paid_date: payment.paid_date,
        eft_reference: payment.eft_reference,
        payment_notes: payment.payment_notes,
        status: payment.status
      })) || [];

      setPayments(formattedPayments);

    } catch (error) {
      console.error('Error loading payment history:', error);
      message.error('Failed to load payment history');
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = () => {
    loadPaymentHistory(selectedTherapist, selectedStatus);
  };

  const handleRecordPayment = (payment: PaymentRecord) => {
    setSelectedPayment(payment);
    form.setFieldsValue({
      paid_amount: payment.admin_total_approved,
      paid_date: payment.paid_date ? dayjs(payment.paid_date) : dayjs(),
      eft_reference: payment.eft_reference || '',
      payment_notes: payment.payment_notes || ''
    });
    setRecordPaymentModalVisible(true);
  };

  const handleSubmitPayment = async (values: any) => {
    if (!selectedPayment) return;

    try {
      const { error } = await supabaseClient
        .from('therapist_payments')
        .update({
          paid_amount: values.paid_amount,
          paid_date: values.paid_date.format('YYYY-MM-DD'),
          eft_reference: values.eft_reference,
          payment_notes: values.payment_notes,
          status: 'paid',
          processed_at: new Date().toISOString()
        })
        .eq('id', selectedPayment.id);

      if (error) throw error;

      message.success('Payment recorded successfully');
      setRecordPaymentModalVisible(false);
      form.resetFields();
      loadPaymentHistory(selectedTherapist, selectedStatus);
    } catch (error) {
      console.error('Error recording payment:', error);
      message.error('Failed to record payment');
    }
  };

  const columns = [
    {
      title: 'Week Ending',
      dataIndex: 'week_ending',
      key: 'week_ending',
      render: (date: string) => dayjs(date).format('MMM D, YYYY'),
      width: 130
    },
    {
      title: 'Therapist',
      dataIndex: 'therapist_name',
      key: 'therapist_name',
      render: (name: string) => <strong style={{ color: '#1890ff' }}>{name}</strong>
    },
    {
      title: 'Invoice Date',
      dataIndex: 'invoice_date',
      key: 'invoice_date',
      render: (date: string) => date ? dayjs(date).format('MMM D, YYYY') : '-',
      width: 130
    },
    {
      title: 'Invoice #',
      dataIndex: 'invoice_number',
      key: 'invoice_number',
      width: 150
    },
    {
      title: 'Approved Amount',
      dataIndex: 'admin_total_approved',
      key: 'admin_total_approved',
      align: 'right' as const,
      render: (amount: number) => `$${amount.toFixed(2)}`,
      width: 130
    },
    {
      title: 'Paid Date',
      dataIndex: 'paid_date',
      key: 'paid_date',
      render: (date: string) => date ? dayjs(date).format('MMM D, YYYY') : '-',
      width: 130
    },
    {
      title: 'EFT Reference',
      dataIndex: 'eft_reference',
      key: 'eft_reference',
      width: 150
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      align: 'center' as const,
      width: 100,
      render: (status: string) => (
        <Tag color={status === 'paid' ? 'green' : 'blue'}>
          {status.toUpperCase()}
        </Tag>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'center' as const,
      width: 120,
      render: (_: any, record: PaymentRecord) => (
        <Space>
          {record.status === 'approved' && (
            <Button
              type="primary"
              size="small"
              icon={<DollarOutlined />}
              onClick={() => handleRecordPayment(record)}
            >
              Pay
            </Button>
          )}
          {record.status === 'paid' && (
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleRecordPayment(record)}
            >
              View
            </Button>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <Space>
            <Select
              style={{ width: 200 }}
              placeholder="All Therapists"
              value={selectedTherapist}
              onChange={setSelectedTherapist}
            >
              <Option value="all">All Therapists</Option>
              {therapists.map(t => (
                <Option key={t.id} value={t.id}>
                  {t.first_name} {t.last_name}
                </Option>
              ))}
            </Select>

            <Select
              style={{ width: 150 }}
              placeholder="Status"
              value={selectedStatus}
              onChange={setSelectedStatus}
            >
              <Option value="all">All Status</Option>
              <Option value="approved">Approved</Option>
              <Option value="paid">Paid</Option>
            </Select>

            <Button type="primary" onClick={handleFilter}>
              Filter
            </Button>
          </Space>
        </div>

        <Table
          dataSource={payments}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20, showSizeChanger: true }}
        />
      </Space>

      {/* Record Payment Modal */}
      <Modal
        title="Record Payment"
        open={recordPaymentModalVisible}
        onCancel={() => {
          setRecordPaymentModalVisible(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        okText={selectedPayment?.status === 'paid' ? 'Update' : 'Record Payment'}
        width={600}
      >
        {selectedPayment && (
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmitPayment}
          >
            <div style={{ marginBottom: 16, padding: 12, background: '#f0f0f0', borderRadius: 4 }}>
              <strong>{selectedPayment.therapist_name}</strong>
              <div>Week ending: {dayjs(selectedPayment.week_ending).format('MMM D, YYYY')}</div>
              <div>Approved amount: ${selectedPayment.admin_total_approved.toFixed(2)}</div>
            </div>

            <Form.Item
              label="Paid Amount"
              name="paid_amount"
              rules={[{ required: true, message: 'Please enter paid amount' }]}
            >
              <InputNumber
                prefix={<DollarOutlined />}
                style={{ width: '100%' }}
                precision={2}
                min={0}
              />
            </Form.Item>

            <Form.Item
              label="Paid Date"
              name="paid_date"
              rules={[{ required: true, message: 'Please select paid date' }]}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item
              label="EFT Reference"
              name="eft_reference"
              rules={[{ required: true, message: 'Please enter EFT reference' }]}
            >
              <Input placeholder="EFT2510230456" />
            </Form.Item>

            <Form.Item
              label="Payment Notes"
              name="payment_notes"
            >
              <TextArea rows={3} placeholder="Any notes about this payment..." />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
};

export default PaymentHistoryTab;
