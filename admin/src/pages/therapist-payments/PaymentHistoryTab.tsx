import React, { useState, useEffect } from 'react';
import { Table, Select, Button, Tag, Space, Modal, Form, Input, InputNumber, DatePicker, message, Image, Descriptions, Collapse, Checkbox } from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, DollarOutlined, FileImageOutlined, DownloadOutlined, ExpandOutlined, MailOutlined } from '@ant-design/icons';
import { supabaseClient } from '../../utility';
import { EmailService } from '../../utils/emailService';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;
const { Panel } = Collapse;

interface BookingDetail {
  booking_id: string;
  booking_time: string;
  service_name: string;
  customer_name: string;
  therapist_fee: number;
  status: string;
}

interface PaymentRecord {
  id: string;
  therapist_id: string;
  therapist_name: string;
  therapist_email: string;
  week_start: string;
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
  therapist_invoice_url: string;
  parking_receipt_url: string;
  bookings: BookingDetail[];
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
          therapist_profiles!therapist_payments_therapist_id_fkey(id, first_name, last_name, email)
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

      // Fetch bookings for each payment period
      const formattedPayments = await Promise.all((data || []).map(async (payment: any) => {
        // Fetch bookings for this week
        const { data: bookingsData } = await supabaseClient
          .from('bookings')
          .select(`
            booking_id,
            booking_time,
            therapist_fee,
            status,
            services(name),
            customers(first_name, last_name)
          `)
          .eq('therapist_id', payment.therapist_id)
          .eq('status', 'completed')
          .gte('booking_time', payment.week_start_date)
          .lte('booking_time', payment.week_end_date + ' 23:59:59')
          .order('booking_time', { ascending: true });

        const bookings: BookingDetail[] = (bookingsData || []).map((b: any) => ({
          booking_id: b.booking_id,
          booking_time: b.booking_time,
          service_name: b.services?.name || 'Unknown Service',
          customer_name: b.customers ? `${b.customers.first_name} ${b.customers.last_name}` : 'Unknown',
          therapist_fee: parseFloat(b.therapist_fee || 0),
          status: b.status
        }));

        return {
          id: payment.id,
          therapist_id: payment.therapist_id,
          therapist_name: `${payment.therapist_profiles.first_name} ${payment.therapist_profiles.last_name}`,
          therapist_email: payment.therapist_profiles.email,
          week_start: payment.week_start_date,
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
          status: payment.status,
          therapist_invoice_url: payment.therapist_invoice_url,
          parking_receipt_url: payment.parking_receipt_url,
          bookings
        };
      }));

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

      // Send confirmation email if checkbox is checked
      if (values.send_confirmation_email && selectedPayment.therapist_email) {
        try {
          const emailResult = await EmailService.sendTherapistPaymentConfirmation({
            therapistEmail: selectedPayment.therapist_email,
            therapistName: selectedPayment.therapist_name,
            paymentDate: values.paid_date.format('DD MMMM YYYY'),
            eftReference: values.eft_reference,
            weekPeriod: `${dayjs(selectedPayment.week_start).format('D MMM')} - ${dayjs(selectedPayment.week_ending).format('D MMM YYYY')}`,
            invoiceNumber: selectedPayment.invoice_number || '',
            bookings: selectedPayment.bookings,
            totalFees: selectedPayment.admin_approved_fees,
            parkingAmount: selectedPayment.admin_approved_parking,
            totalPaid: values.paid_amount,
            paymentNotes: values.payment_notes
          });

          if (emailResult.success) {
            message.success('Payment recorded and confirmation email sent');
          } else {
            message.warning('Payment recorded but email failed to send');
          }
        } catch (emailError) {
          console.error('Error sending confirmation email:', emailError);
          message.warning('Payment recorded but email failed to send');
        }
      } else {
        message.success('Payment recorded successfully');
      }

      setRecordPaymentModalVisible(false);
      form.resetFields();
      loadPaymentHistory(selectedTherapist, selectedStatus);
    } catch (error) {
      console.error('Error recording payment:', error);
      message.error('Failed to record payment');
    }
  };

  // Expandable row content
  const expandedRowRender = (record: PaymentRecord) => {
    const bookingColumns = [
      {
        title: 'Job #',
        dataIndex: 'booking_id',
        key: 'booking_id',
        width: 120,
        render: (id: string) => <Tag color="blue">{id}</Tag>
      },
      {
        title: 'Date & Time',
        dataIndex: 'booking_time',
        key: 'booking_time',
        width: 180,
        render: (date: string) => dayjs(date).format('ddd, MMM D, YYYY h:mm A')
      },
      {
        title: 'Service',
        dataIndex: 'service_name',
        key: 'service_name',
      },
      {
        title: 'Customer',
        dataIndex: 'customer_name',
        key: 'customer_name',
      },
      {
        title: 'Fee',
        dataIndex: 'therapist_fee',
        key: 'therapist_fee',
        align: 'right' as const,
        render: (fee: number) => <strong>${fee.toFixed(2)}</strong>
      }
    ];

    return (
      <div style={{ padding: '16px', background: '#fafafa' }}>
        <div style={{ display: 'flex', gap: '24px', marginBottom: '16px' }}>
          {/* Invoice Image */}
          {record.therapist_invoice_url && (
            <div style={{ flex: 1 }}>
              <h4 style={{ marginBottom: '8px', color: '#007e8c' }}>
                <FileImageOutlined /> Submitted Invoice
              </h4>
              <Image
                src={record.therapist_invoice_url}
                alt="Invoice"
                style={{ maxWidth: '300px', maxHeight: '200px', objectFit: 'contain', border: '1px solid #d9d9d9', borderRadius: '4px' }}
                preview={{ mask: 'Click to view full size' }}
              />
            </div>
          )}

          {/* Parking Receipt */}
          {record.parking_receipt_url && (
            <div style={{ flex: 1 }}>
              <h4 style={{ marginBottom: '8px', color: '#007e8c' }}>
                <FileImageOutlined /> Parking Receipt
              </h4>
              <Image
                src={record.parking_receipt_url}
                alt="Parking Receipt"
                style={{ maxWidth: '300px', maxHeight: '200px', objectFit: 'contain', border: '1px solid #d9d9d9', borderRadius: '4px' }}
                preview={{ mask: 'Click to view full size' }}
              />
            </div>
          )}

          {!record.therapist_invoice_url && !record.parking_receipt_url && (
            <div style={{ color: '#999', fontStyle: 'italic' }}>
              No invoice or receipt files uploaded
            </div>
          )}
        </div>

        <h4 style={{ marginBottom: '8px', color: '#007e8c' }}>
          📋 Completed Bookings ({record.bookings.length})
        </h4>

        {record.bookings.length > 0 ? (
          <Table
            dataSource={record.bookings}
            columns={bookingColumns}
            rowKey="booking_id"
            size="small"
            pagination={false}
            style={{ marginBottom: '8px' }}
            summary={(pageData) => {
              const total = pageData.reduce((sum, b) => sum + b.therapist_fee, 0);
              return (
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={4} align="right">
                    <strong>Total Fees:</strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">
                    <strong style={{ color: '#007e8c' }}>${total.toFixed(2)}</strong>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              );
            }}
          />
        ) : (
          <div style={{ color: '#999', fontStyle: 'italic', padding: '8px 0' }}>
            No completed bookings found for this period
          </div>
        )}

        {record.payment_notes && (
          <div style={{ marginTop: '12px', padding: '8px 12px', background: '#fff', borderRadius: '4px', border: '1px solid #d9d9d9' }}>
            <strong>Payment Notes:</strong> {record.payment_notes}
          </div>
        )}
      </div>
    );
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
      render: (name: string) => <strong style={{ color: '#007e8c' }}>{name}</strong>
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
          expandable={{
            expandedRowRender,
            expandRowByClick: false,
            rowExpandable: () => true,
          }}
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

            {selectedPayment?.status !== 'paid' && (
              <Form.Item
                name="send_confirmation_email"
                valuePropName="checked"
                initialValue={true}
              >
                <Checkbox>
                  <Space>
                    <MailOutlined style={{ color: '#1a3a5c' }} />
                    Send payment confirmation email to therapist
                  </Space>
                </Checkbox>
              </Form.Item>
            )}
          </Form>
        )}
      </Modal>
    </div>
  );
};

export default PaymentHistoryTab;
