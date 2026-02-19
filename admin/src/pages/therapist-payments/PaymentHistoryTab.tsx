import React, { useState, useEffect } from 'react';
import { Table, Select, Button, Tag, Space, Modal, Form, Input, InputNumber, DatePicker, message, Image, Descriptions, Collapse, Checkbox } from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, DollarOutlined, FileImageOutlined, DownloadOutlined, ExpandOutlined, MailOutlined, SendOutlined } from '@ant-design/icons';
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
  calculated_fees: number;
  therapist_invoiced_fees: number;
  therapist_parking_amount: number;
  therapist_total_claimed: number;
  variance_fees: number;
  therapist_notes: string;
  admin_approved_fees: number;
  admin_approved_parking: number;
  admin_total_approved: number;
  admin_notes: string;
  reviewed_at: string;
  paid_amount: number;
  paid_date: string;
  eft_reference: string;
  payment_notes: string;
  status: string;
  therapist_invoice_url: string | null;
  parking_receipt_url: string | null;
  bookings: BookingDetail[];
}

const PaymentHistoryTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [therapists, setTherapists] = useState<any[]>([]);
  const [selectedTherapist, setSelectedTherapist] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [recordPaymentModalVisible, setRecordPaymentModalVisible] = useState(false);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(null);
  const [form] = Form.useForm();
  const [fileUrls, setFileUrls] = useState<Record<string, { invoice?: string; receipt?: string; loading?: boolean }>>({});

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
          id,
          therapist_id,
          week_start_date,
          week_end_date,
          therapist_invoice_number,
          therapist_invoice_date,
          calculated_fees,
          therapist_invoiced_fees,
          therapist_parking_amount,
          therapist_total_claimed,
          variance_fees,
          therapist_notes,
          admin_approved_fees,
          admin_approved_parking,
          admin_total_approved,
          admin_notes,
          reviewed_at,
          paid_amount,
          paid_date,
          eft_reference,
          payment_notes,
          status,
          processed_at,
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
          calculated_fees: parseFloat(payment.calculated_fees || 0),
          therapist_invoiced_fees: parseFloat(payment.therapist_invoiced_fees || 0),
          therapist_parking_amount: parseFloat(payment.therapist_parking_amount || 0),
          therapist_total_claimed: parseFloat(payment.therapist_total_claimed || 0),
          variance_fees: parseFloat(payment.variance_fees || 0),
          therapist_notes: payment.therapist_notes,
          admin_approved_fees: parseFloat(payment.admin_approved_fees || 0),
          admin_approved_parking: parseFloat(payment.admin_approved_parking || 0),
          admin_total_approved: parseFloat(payment.admin_total_approved || 0),
          admin_notes: payment.admin_notes,
          reviewed_at: payment.reviewed_at,
          paid_amount: parseFloat(payment.paid_amount || 0),
          paid_date: payment.paid_date,
          eft_reference: payment.eft_reference,
          payment_notes: payment.payment_notes,
          status: payment.status,
          therapist_invoice_url: null,
          parking_receipt_url: null,
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

  // Load file URLs on demand when a row is expanded
  const loadFileUrls = async (paymentId: string) => {
    if (fileUrls[paymentId] && !fileUrls[paymentId].loading) return; // Already loaded

    setFileUrls(prev => ({ ...prev, [paymentId]: { loading: true } }));

    try {
      // Fetch just the file path columns for this specific payment
      const { data, error } = await supabaseClient
        .from('therapist_payments')
        .select('therapist_invoice_url, parking_receipt_url')
        .eq('id', paymentId)
        .single();

      if (error || !data) {
        setFileUrls(prev => ({ ...prev, [paymentId]: { loading: false } }));
        return;
      }

      const urls: { invoice?: string; receipt?: string; invoiceType?: string; receiptType?: string; loading: boolean } = { loading: false };

      const getFileType = (storedValue: string): string => {
        if (storedValue.startsWith('data:application/pdf')) return 'pdf';
        if (storedValue.startsWith('data:image/')) return 'image';
        if (storedValue.endsWith('.pdf')) return 'pdf';
        return 'image';
      };

      const resolveFileUrl = async (storedValue: string | null): Promise<{ url?: string; type?: string }> => {
        if (!storedValue) return {};
        const type = getFileType(storedValue);
        if (storedValue.startsWith('data:')) return { url: storedValue, type };
        if (storedValue.startsWith('invoices/') || storedValue.startsWith('receipts/')) {
          try {
            const { realSupabaseClient } = await import('../../utility/supabaseClient');
            const { data: { session } } = await realSupabaseClient.auth.getSession();
            if (!session) return {};
            const resp = await fetch(`/.netlify/functions/get-signed-url?path=${encodeURIComponent(storedValue)}`, {
              headers: { 'Authorization': `Bearer ${session.access_token}` }
            });
            const result = await resp.json();
            return { url: result.url || undefined, type };
          } catch {
            return {};
          }
        }
        return { url: storedValue, type };
      };

      const invoiceResult = await resolveFileUrl(data.therapist_invoice_url);
      const receiptResult = await resolveFileUrl(data.parking_receipt_url);
      urls.invoice = invoiceResult.url;
      urls.invoiceType = invoiceResult.type;
      urls.receipt = receiptResult.url;
      urls.receiptType = receiptResult.type;

      setFileUrls(prev => ({ ...prev, [paymentId]: urls }));
    } catch (err) {
      console.error('Error loading file URLs:', err);
      setFileUrls(prev => ({ ...prev, [paymentId]: { loading: false } }));
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

  // Resend payment confirmation email
  const handleResendEmail = async (record: PaymentRecord) => {
    if (!record.therapist_email) {
      message.error('No therapist email found');
      return;
    }

    try {
      const emailResult = await EmailService.sendTherapistPaymentConfirmation({
        therapistEmail: record.therapist_email,
        therapistName: record.therapist_name,
        paymentDate: dayjs(record.paid_date).format('DD MMMM YYYY'),
        eftReference: record.eft_reference || '',
        weekPeriod: `${dayjs(record.week_start).format('D MMM')} - ${dayjs(record.week_ending).format('D MMM YYYY')}`,
        invoiceNumber: record.invoice_number || '',
        bookings: record.bookings,
        totalFees: record.admin_approved_fees,
        parkingAmount: record.admin_approved_parking,
        totalPaid: record.paid_amount,
        paymentNotes: record.payment_notes
      });

      if (emailResult.success) {
        message.success('Payment confirmation email resent successfully');
      } else {
        message.error('Failed to resend email: ' + (emailResult.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error resending email:', error);
      message.error('Failed to resend email');
    }
  };

  // Send invoice to Xero
  const handleSendToXero = async (record: PaymentRecord) => {
    try {
      message.loading({ content: 'Sending invoice to Xero...', key: 'xero' });

      // Fetch the actual invoice file data for this payment
      const { data: paymentData, error: fetchError } = await supabaseClient
        .from('therapist_payments')
        .select('therapist_invoice_url')
        .eq('id', record.id)
        .single();

      if (fetchError || !paymentData?.therapist_invoice_url) {
        message.error({ content: 'No invoice file available to send', key: 'xero' });
        return;
      }

      let invoiceFileBase64 = paymentData.therapist_invoice_url;

      // If it's a storage path, we need to download it and convert to base64 for Xero
      if (!invoiceFileBase64.startsWith('data:') && (invoiceFileBase64.startsWith('invoices/') || invoiceFileBase64.startsWith('receipts/'))) {
        const { realSupabaseClient } = await import('../../utility/supabaseClient');
        const { data: { session } } = await realSupabaseClient.auth.getSession();
        if (!session) {
          message.error({ content: 'Session expired', key: 'xero' });
          return;
        }
        const resp = await fetch(`/.netlify/functions/get-signed-url?path=${encodeURIComponent(invoiceFileBase64)}`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        const urlResult = await resp.json();
        if (urlResult.url) {
          // Fetch the file and convert to base64
          const fileResp = await fetch(urlResult.url);
          const blob = await fileResp.blob();
          invoiceFileBase64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
        }
      }

      const response = await fetch('/.netlify/functions/send-to-xero', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          therapist_name: record.therapist_name,
          invoice_number: record.invoice_number || '',
          invoice_date: record.invoice_date ? dayjs(record.invoice_date).format('DD/MM/YYYY') : '',
          total_amount: record.admin_total_approved,
          invoice_file_base64: invoiceFileBase64,
          week_period: `${dayjs(record.week_start).format('D MMM')} - ${dayjs(record.week_ending).format('D MMM YYYY')}`
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.message || 'Failed to send to Xero');
      }

      message.success({ content: 'Invoice sent to Xero successfully!', key: 'xero' });
    } catch (error: any) {
      console.error('Error sending to Xero:', error);
      message.error({ content: error.message || 'Failed to send invoice to Xero', key: 'xero' });
    }
  };

  // Download file helper function - properly handles base64 data URLs
  const downloadFile = async (dataUrl: string, filename: string) => {
    try {
      if (!dataUrl) {
        message.error('No file data available');
        return;
      }

      // If it's a base64 data URL, convert to blob properly
      if (dataUrl.startsWith('data:')) {
        // Extract the base64 content and mime type
        const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          const mimeType = matches[1];
          const base64Data = matches[2];

          // Decode base64 to binary
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: mimeType });

          // Create download link
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          // Clean up
          setTimeout(() => window.URL.revokeObjectURL(url), 100);
          message.success('File downloaded successfully');
        } else {
          message.error('Invalid file format');
        }
      } else {
        // For regular URLs, open in new tab (download attribute doesn't work cross-origin)
        window.open(dataUrl, '_blank');
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      message.error('Failed to download file');
    }
  };

  // Check if string is a valid image URL
  const isValidImageUrl = (url: string | null | undefined) => {
    if (!url) return false;
    if (typeof url !== 'string') return false;
    const trimmedUrl = url.trim();
    if (!trimmedUrl || trimmedUrl === 'null' || trimmedUrl === 'undefined') return false;
    // Accept any non-empty string URL (data URLs, http/https URLs, or Supabase storage URLs)
    return trimmedUrl.length > 0;
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

    // Detect file extension from data URL or default to png
    const getFileExtension = (url: string | null): string => {
      if (!url) return 'png';
      if (url.startsWith('data:')) {
        // Handle both image and application (PDF) types
        const match = url.match(/data:(\w+)\/(\w+);/);
        if (match) {
          const type = match[1]; // 'image' or 'application'
          const subtype = match[2]; // 'png', 'jpeg', 'pdf', etc.
          if (type === 'application' && subtype === 'pdf') return 'pdf';
          return subtype === 'jpeg' ? 'jpg' : subtype;
        }
        return 'png';
      }
      // For regular URLs, try to extract extension
      const match = url.match(/\.(\w+)(?:\?|$)/);
      return match ? match[1] : 'png';
    };
    
    const invoiceExt = getFileExtension(record.therapist_invoice_url);
    const receiptExt = getFileExtension(record.parking_receipt_url);
    const invoiceFilename = `Invoice_${record.therapist_name.replace(/\s+/g, '_')}_${dayjs(record.week_ending).format('YYYY-MM-DD')}.${invoiceExt}`;
    const receiptFilename = `ParkingReceipt_${record.therapist_name.replace(/\s+/g, '_')}_${dayjs(record.week_ending).format('YYYY-MM-DD')}.${receiptExt}`;

    const files = fileUrls[record.id] as any;
    const invoiceUrl = files?.invoice;
    const receiptUrl = files?.receipt;
    const invoiceType = files?.invoiceType;
    const receiptType = files?.receiptType;
    const filesLoading = files?.loading;

    return (
      <div style={{ padding: '16px', background: '#fafafa' }}>
        <div style={{ display: 'flex', gap: '24px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {filesLoading && (
            <div style={{ color: '#999', fontStyle: 'italic' }}>Loading files...</div>
          )}

          {!filesLoading && !files && (
            <div style={{ color: '#999', fontStyle: 'italic' }}>
              No invoice or receipt files uploaded
            </div>
          )}

          {/* Invoice */}
          {invoiceUrl && (
            <div style={{ flex: 1, minWidth: '300px' }}>
              <h4 style={{ marginBottom: '8px', color: '#007e8c' }}>
                <FileImageOutlined /> Submitted Invoice
              </h4>
              <div style={{ border: '1px solid #d9d9d9', borderRadius: '4px', padding: '8px', background: '#fff' }}>
                {invoiceType === 'pdf' ? (
                  <iframe src={invoiceUrl} style={{ width: '100%', height: '300px', border: 'none' }} title="Invoice PDF" />
                ) : (
                  <Image
                    src={invoiceUrl}
                    alt="Invoice"
                    style={{ maxWidth: '100%', maxHeight: '200px', objectFit: 'contain' }}
                  />
                )}
                <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                  <Button
                    size="small"
                    icon={<DownloadOutlined />}
                    onClick={() => downloadFile(invoiceUrl, invoiceFilename)}
                  >
                    Download
                  </Button>
                  <Button
                    size="small"
                    icon={<EyeOutlined />}
                    onClick={() => window.open(invoiceUrl, '_blank')}
                  >
                    Open in New Tab
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Parking Receipt */}
          {receiptUrl && (
            <div style={{ flex: 1, minWidth: '300px' }}>
              <h4 style={{ marginBottom: '8px', color: '#007e8c' }}>
                <FileImageOutlined /> Parking Receipt
              </h4>
              <div style={{ border: '1px solid #d9d9d9', borderRadius: '4px', padding: '8px', background: '#fff' }}>
                {receiptType === 'pdf' ? (
                  <iframe src={receiptUrl} style={{ width: '100%', height: '300px', border: 'none' }} title="Receipt PDF" />
                ) : (
                  <Image
                    src={receiptUrl}
                    alt="Parking Receipt"
                    style={{ maxWidth: '100%', maxHeight: '200px', objectFit: 'contain' }}
                  />
                )}
                <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                  <Button
                    size="small"
                    icon={<DownloadOutlined />}
                    onClick={() => downloadFile(receiptUrl, receiptFilename)}
                  >
                    Download
                  </Button>
                  <Button
                    size="small"
                    icon={<EyeOutlined />}
                    onClick={() => window.open(receiptUrl, '_blank')}
                  >
                    Open in New Tab
                  </Button>
                </div>
              </div>
            </div>
          )}

          {!filesLoading && files && !invoiceUrl && !receiptUrl && (
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
      width: 300,
      render: (_: any, record: PaymentRecord) => (
        <Space>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedPayment(record);
              setReviewModalVisible(true);
              loadFileUrls(record.id);
            }}
          >
            Review
          </Button>
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
            <>
              <Button
                size="small"
                icon={<MailOutlined />}
                onClick={() => handleResendEmail(record)}
                title="Resend payment confirmation email"
              >
                Resend
              </Button>
              <Button
                size="small"
                icon={<SendOutlined />}
                onClick={() => handleSendToXero(record)}
                title="Send invoice to Xero"
                style={{ background: '#13c2c2', borderColor: '#13c2c2', color: 'white' }}
              >
                Xero
              </Button>
            </>
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
            onExpand: (expanded, record) => {
              if (expanded) {
                loadFileUrls(record.id);
              }
            },
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

      {/* Review Invoice Modal */}
      <Modal
        title="Invoice Review"
        open={reviewModalVisible}
        onCancel={() => setReviewModalVisible(false)}
        footer={null}
        width={900}
        destroyOnClose
      >
        {selectedPayment && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* Status Banner */}
            <div style={{ textAlign: 'center', padding: '12px', background: '#f5f5f5', borderRadius: '8px' }}>
              <Tag color={selectedPayment.status === 'paid' ? 'green' : 'blue'} style={{ fontSize: '14px', padding: '4px 12px' }}>
                {selectedPayment.status.toUpperCase()}
              </Tag>
            </div>

            {/* Therapist Submission */}
            <Descriptions bordered column={2} size="small" title="Therapist Submission">
              <Descriptions.Item label="Therapist">
                <strong style={{ color: '#007e8c' }}>{selectedPayment.therapist_name}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="Week">
                {dayjs(selectedPayment.week_start).format('MMM D')} - {dayjs(selectedPayment.week_ending).format('MMM D, YYYY')}
              </Descriptions.Item>
              <Descriptions.Item label="Invoice #">
                {selectedPayment.invoice_number || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Invoice Date">
                {selectedPayment.invoice_date ? dayjs(selectedPayment.invoice_date).format('MMM D, YYYY') : 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Calculated Fees">
                ${selectedPayment.calculated_fees.toFixed(2)}
              </Descriptions.Item>
              <Descriptions.Item label="Invoiced Fees">
                ${selectedPayment.therapist_invoiced_fees.toFixed(2)}
              </Descriptions.Item>
              <Descriptions.Item label="Variance" span={2}>
                <span style={{
                  color: selectedPayment.variance_fees === 0 ? 'inherit' :
                         selectedPayment.variance_fees > 0 ? '#f5222d' : '#52c41a',
                  fontWeight: 600
                }}>
                  {selectedPayment.variance_fees > 0 ? '+' : ''}${selectedPayment.variance_fees.toFixed(2)}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="Parking Claimed">
                ${selectedPayment.therapist_parking_amount.toFixed(2)}
              </Descriptions.Item>
              <Descriptions.Item label="Total Claimed">
                <strong>${selectedPayment.therapist_total_claimed.toFixed(2)}</strong>
              </Descriptions.Item>
              {selectedPayment.therapist_notes && (
                <Descriptions.Item label="Therapist Notes" span={2}>
                  {selectedPayment.therapist_notes}
                </Descriptions.Item>
              )}
            </Descriptions>

            {/* Admin Approval */}
            <Descriptions bordered column={2} size="small" title="Admin Approval">
              <Descriptions.Item label="Approved Fees">
                ${selectedPayment.admin_approved_fees.toFixed(2)}
              </Descriptions.Item>
              <Descriptions.Item label="Approved Parking">
                ${selectedPayment.admin_approved_parking.toFixed(2)}
              </Descriptions.Item>
              <Descriptions.Item label="Total Approved" span={2}>
                <strong style={{ color: '#007e8c', fontSize: '16px' }}>
                  ${selectedPayment.admin_total_approved.toFixed(2)}
                </strong>
              </Descriptions.Item>
              {selectedPayment.reviewed_at && (
                <Descriptions.Item label="Reviewed At" span={2}>
                  {dayjs(selectedPayment.reviewed_at).format('MMM D, YYYY h:mm A')}
                </Descriptions.Item>
              )}
              {selectedPayment.admin_notes && (
                <Descriptions.Item label="Admin Notes" span={2}>
                  {selectedPayment.admin_notes}
                </Descriptions.Item>
              )}
            </Descriptions>

            {/* Payment Details (if paid) */}
            {selectedPayment.status === 'paid' && (
              <Descriptions bordered column={2} size="small" title="Payment Details">
                <Descriptions.Item label="Paid Amount">
                  <strong style={{ color: '#52c41a' }}>${selectedPayment.paid_amount.toFixed(2)}</strong>
                </Descriptions.Item>
                <Descriptions.Item label="Paid Date">
                  {selectedPayment.paid_date ? dayjs(selectedPayment.paid_date).format('MMM D, YYYY') : 'N/A'}
                </Descriptions.Item>
                {selectedPayment.eft_reference && (
                  <Descriptions.Item label="EFT Reference" span={2}>
                    {selectedPayment.eft_reference}
                  </Descriptions.Item>
                )}
                {selectedPayment.payment_notes && (
                  <Descriptions.Item label="Payment Notes" span={2}>
                    {selectedPayment.payment_notes}
                  </Descriptions.Item>
                )}
              </Descriptions>
            )}

            {/* Invoice & Receipt Files */}
            {(() => {
              const files = fileUrls[selectedPayment.id] as any;
              if (files?.loading) {
                return <div style={{ textAlign: 'center', padding: '20px' }}>Loading files...</div>;
              }
              return (
                <>
                  {files?.invoice && (
                    <div>
                      <h4>Invoice Document</h4>
                      {files.invoiceType === 'pdf' ? (
                        <div style={{ border: '1px solid #d9d9d9', borderRadius: '4px' }}>
                          <iframe src={files.invoice} style={{ width: '100%', height: '500px', border: 'none' }} title="Invoice PDF" />
                          <div style={{ padding: '8px', textAlign: 'center' }}>
                            <Button type="link" onClick={() => window.open(files.invoice, '_blank')}>Open PDF in new tab</Button>
                          </div>
                        </div>
                      ) : (
                        <Image src={files.invoice} alt="Invoice" style={{ maxWidth: '100%' }} />
                      )}
                    </div>
                  )}
                  {files?.receipt && (
                    <div>
                      <h4>Parking Receipt</h4>
                      {files.receiptType === 'pdf' ? (
                        <div style={{ border: '1px solid #d9d9d9', borderRadius: '4px' }}>
                          <iframe src={files.receipt} style={{ width: '100%', height: '500px', border: 'none' }} title="Receipt PDF" />
                          <div style={{ padding: '8px', textAlign: 'center' }}>
                            <Button type="link" onClick={() => window.open(files.receipt, '_blank')}>Open PDF in new tab</Button>
                          </div>
                        </div>
                      ) : (
                        <Image src={files.receipt} alt="Parking Receipt" style={{ maxWidth: '100%' }} />
                      )}
                    </div>
                  )}
                  {files && !files.invoice && !files.receipt && (
                    <div style={{ color: '#999', fontStyle: 'italic' }}>No files uploaded</div>
                  )}
                </>
              );
            })()}

            {/* Completed Bookings */}
            <div>
              <h4 style={{ color: '#007e8c' }}>Completed Bookings ({selectedPayment.bookings.length})</h4>
              {selectedPayment.bookings.length > 0 ? (
                <Table
                  dataSource={selectedPayment.bookings}
                  columns={[
                    { title: 'Job #', dataIndex: 'booking_id', key: 'booking_id', width: 120, render: (id: string) => <Tag color="blue">{id}</Tag> },
                    { title: 'Date & Time', dataIndex: 'booking_time', key: 'booking_time', width: 180, render: (date: string) => dayjs(date).format('ddd, MMM D h:mm A') },
                    { title: 'Service', dataIndex: 'service_name', key: 'service_name' },
                    { title: 'Customer', dataIndex: 'customer_name', key: 'customer_name' },
                    { title: 'Fee', dataIndex: 'therapist_fee', key: 'therapist_fee', align: 'right' as const, render: (fee: number) => <strong>${fee.toFixed(2)}</strong> },
                  ]}
                  rowKey="booking_id"
                  size="small"
                  pagination={false}
                  summary={(pageData) => {
                    const total = pageData.reduce((sum, b) => sum + b.therapist_fee, 0);
                    return (
                      <Table.Summary.Row>
                        <Table.Summary.Cell index={0} colSpan={4} align="right"><strong>Total:</strong></Table.Summary.Cell>
                        <Table.Summary.Cell index={1} align="right"><strong style={{ color: '#007e8c' }}>${total.toFixed(2)}</strong></Table.Summary.Cell>
                      </Table.Summary.Row>
                    );
                  }}
                />
              ) : (
                <div style={{ color: '#999', fontStyle: 'italic' }}>No completed bookings found</div>
              )}
            </div>
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default PaymentHistoryTab;
