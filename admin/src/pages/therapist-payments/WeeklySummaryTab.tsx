import React, { useState } from 'react';
import { DatePicker, Button, Table, Card, Descriptions, Space, message, Tag, Divider, Modal, Form, Input, InputNumber, Upload, Select } from 'antd';
import { SearchOutlined, DollarOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons';
import { supabaseClient } from '../../utility';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(isoWeek);

const { TextArea } = Input;
const { Option } = Select;

interface DailyBreakdown {
  date: string;
  jobs: number;
  base_fee: number;
  extras: number;
  daily_total: number;
  booking_ids: string[];
}

interface WeeklySummary {
  therapist_id: string;
  therapist_name: string;
  week_start: string;
  week_end: string;
  total_jobs: number;
  base_fees: number;
  parking: number;
  total_payment: number;
  daily_breakdown: DailyBreakdown[];
  // Invoice tracking
  invoice_status: string | null;
  therapist_invoiced_fees: number | null;
  admin_approved_fees: number | null;
  admin_approved_parking: number | null;
  paid_amount: number | null;
  paid_date: string | null;
  variance_fees: number | null;
}

const WeeklySummaryTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(dayjs().startOf('isoWeek'));
  const [summaries, setSummaries] = useState<WeeklySummary[]>([]);
  const [manualEntryModalVisible, setManualEntryModalVisible] = useState(false);
  const [selectedSummary, setSelectedSummary] = useState<WeeklySummary | null>(null);
  const [manualForm] = Form.useForm();

  const loadWeeklySummary = async () => {
    try {
      setLoading(true);

      // Ensure we always use Monday as week start, regardless of DatePicker behavior
      const weekStart = selectedWeek.startOf('isoWeek').format('YYYY-MM-DD');
      const weekEnd = selectedWeek.startOf('isoWeek').add(6, 'day').format('YYYY-MM-DD');

      // Get all completed bookings for the selected week
      const { data: bookings, error: bookingsError } = await supabaseClient
        .from('bookings')
        .select(`
          id,
          booking_id,
          booking_time,
          therapist_id,
          therapist_fee,
          therapist_profiles!bookings_therapist_id_fkey(id, first_name, last_name)
        `)
        .eq('status', 'completed')
        .gte('booking_time', weekStart)
        .lte('booking_time', weekEnd + ' 23:59:59');

      if (bookingsError) throw bookingsError;

      // Get invoice data for parking amounts and payment status
      const { data: invoices, error: invoicesError} = await supabaseClient
        .from('therapist_payments')
        .select('therapist_id, status, therapist_invoiced_fees, therapist_parking_amount, admin_approved_fees, admin_approved_parking, paid_amount, paid_date, variance_fees')
        .eq('week_start_date', weekStart)
        .eq('week_end_date', weekEnd);

      if (invoicesError) throw invoicesError;

      // Group by therapist
      const therapistMap = new Map<string, WeeklySummary>();

      bookings?.forEach((booking: any) => {
        const therapistId = booking.therapist_id;
        const bookingDate = dayjs(booking.booking_time).format('YYYY-MM-DD');

        if (!therapistMap.has(therapistId)) {
          therapistMap.set(therapistId, {
            therapist_id: therapistId,
            therapist_name: `${booking.therapist_profiles.first_name} ${booking.therapist_profiles.last_name}`,
            week_start: weekStart,
            week_end: weekEnd,
            total_jobs: 0,
            base_fees: 0,
            parking: 0,
            total_payment: 0,
            daily_breakdown: [],
            invoice_status: null,
            therapist_invoiced_fees: null,
            admin_approved_fees: null,
            admin_approved_parking: null,
            paid_amount: null,
            paid_date: null,
            variance_fees: null
          });
        }

        const summary = therapistMap.get(therapistId)!;
        summary.total_jobs += 1;
        summary.base_fees += parseFloat(booking.therapist_fee || 0);

        // Update daily breakdown
        let dayRecord = summary.daily_breakdown.find(d => d.date === bookingDate);
        if (!dayRecord) {
          dayRecord = {
            date: bookingDate,
            jobs: 0,
            base_fee: 0,
            extras: 0,
            daily_total: 0,
            booking_ids: []
          };
          summary.daily_breakdown.push(dayRecord);
        }
        dayRecord.jobs += 1;
        dayRecord.base_fee += parseFloat(booking.therapist_fee || 0);
        dayRecord.booking_ids.push(booking.booking_id);
      });

      // Add invoice and payment data
      invoices?.forEach((invoice: any) => {
        const summary = therapistMap.get(invoice.therapist_id);
        if (summary) {
          summary.parking = parseFloat(invoice.admin_approved_parking || invoice.therapist_parking_amount || 0);
          summary.invoice_status = invoice.status;
          summary.therapist_invoiced_fees = invoice.therapist_invoiced_fees ? parseFloat(invoice.therapist_invoiced_fees) : null;
          summary.admin_approved_fees = invoice.admin_approved_fees ? parseFloat(invoice.admin_approved_fees) : null;
          summary.admin_approved_parking = invoice.admin_approved_parking ? parseFloat(invoice.admin_approved_parking) : null;
          summary.paid_amount = invoice.paid_amount ? parseFloat(invoice.paid_amount) : null;
          summary.paid_date = invoice.paid_date;
          summary.variance_fees = invoice.variance_fees ? parseFloat(invoice.variance_fees) : null;
        }
      });

      // Calculate totals and sort daily breakdowns
      const summariesArray = Array.from(therapistMap.values()).map(s => {
        s.daily_breakdown.sort((a, b) => a.date.localeCompare(b.date));
        s.daily_breakdown.forEach(day => {
          day.daily_total = day.base_fee + day.extras;
        });
        s.total_payment = s.base_fees + s.parking;
        return s;
      });

      setSummaries(summariesArray);

    } catch (error) {
      console.error('Error loading weekly summary:', error);
      message.error('Failed to load weekly summary');
    } finally {
      setLoading(false);
    }
  };

  const handleManualEntry = (summary: WeeklySummary) => {
    setSelectedSummary(summary);
    manualForm.setFieldsValue({
      therapist_id: summary.therapist_id,
      week_start_date: dayjs(summary.week_start),
      week_end_date: dayjs(summary.week_end),
      invoiced_fees: summary.base_fees,
      parking_amount: summary.parking || 0,
      invoice_number: '',
      notes: '',
      status: 'submitted'
    });
    setManualEntryModalVisible(true);
  };

  const handleSubmitManualEntry = async (values: any) => {
    if (!selectedSummary) return;

    try {
      setLoading(true);

      const weekStart = values.week_start_date.format('YYYY-MM-DD');
      const weekEnd = values.week_end_date.format('YYYY-MM-DD');

      // Upload invoice file if present
      let invoiceUrl = null;
      if (values.invoice_upload?.fileList?.[0]?.originFileObj) {
        const file = values.invoice_upload.fileList[0].originFileObj;
        const fileExt = file.name.split('.').pop();
        const fileName = `${selectedSummary.therapist_id}_${weekStart}_invoice.${fileExt}`;
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
        const fileName = `${selectedSummary.therapist_id}_${weekStart}_parking.${fileExt}`;
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
          therapist_id: selectedSummary.therapist_id,
          week_start_date: weekStart,
          week_end_date: weekEnd,
          calculated_fees: selectedSummary.base_fees,
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
      loadWeeklySummary();
    } catch (error) {
      console.error('Error creating manual invoice:', error);
      message.error('Failed to create invoice');
    } finally {
      setLoading(false);
    }
  };

  const dailyBreakdownColumns = [
    {
      title: 'Day',
      dataIndex: 'date',
      key: 'date',
      render: (date: string) => dayjs(date).format('dddd, MMM D')
    },
    {
      title: 'Jobs',
      dataIndex: 'jobs',
      key: 'jobs',
      align: 'center' as const
    },
    {
      title: 'Booking IDs',
      dataIndex: 'booking_ids',
      key: 'booking_ids',
      render: (ids: string[]) => (
        <div style={{ fontSize: '11px', lineHeight: '1.4' }}>
          {ids.join(', ')}
        </div>
      )
    },
    {
      title: 'Base Fee',
      dataIndex: 'base_fee',
      key: 'base_fee',
      align: 'right' as const,
      render: (amount: number) => `$${amount.toFixed(2)}`
    },
    {
      title: 'Daily Total',
      dataIndex: 'daily_total',
      key: 'daily_total',
      align: 'right' as const,
      render: (amount: number) => `$${amount.toFixed(2)}`
    }
  ];

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span>Week Starting:</span>
          <DatePicker
            value={selectedWeek}
            onChange={(date) => date && setSelectedWeek(date)}
            picker="week"
            format="MMM D, YYYY"
          />
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={loadWeeklySummary}
          >
            Load Week
          </Button>
        </div>

        {summaries.map((summary) => (
          <Card
            key={summary.therapist_id}
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '18px', color: '#1890ff' }}>
                  {summary.therapist_name} - Week {dayjs(summary.week_start).format('MMM D')} - {dayjs(summary.week_end).format('MMM D, YYYY')}
                </span>
                {!summary.invoice_status && (
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => handleManualEntry(summary)}
                    style={{ background: '#00a99d', borderColor: '#00a99d' }}
                  >
                    Manual Invoice Entry
                  </Button>
                )}
              </div>
            }
            style={{ background: '#fafafa' }}
          >
            <Descriptions bordered column={2} style={{ marginBottom: 20 }}>
              <Descriptions.Item label="Total Jobs Completed">
                <strong>{summary.total_jobs} bookings</strong>
              </Descriptions.Item>
              <Descriptions.Item label="System Calculated Fees">
                <strong>${summary.base_fees.toFixed(2)}</strong>
              </Descriptions.Item>

              {summary.invoice_status ? (
                <>
                  <Descriptions.Item label="Invoice Status">
                    {summary.invoice_status === 'not_submitted' && <Tag color="default">Not Submitted</Tag>}
                    {summary.invoice_status === 'submitted' && <Tag color="orange">Submitted</Tag>}
                    {summary.invoice_status === 'approved' && <Tag color="green">Approved</Tag>}
                    {summary.invoice_status === 'paid' && <Tag color="blue">Paid</Tag>}
                  </Descriptions.Item>
                  <Descriptions.Item label="Therapist Invoiced">
                    <strong>${(summary.therapist_invoiced_fees || 0).toFixed(2)}</strong>
                    {summary.variance_fees !== null && summary.variance_fees !== 0 && (
                      <span style={{ color: summary.variance_fees > 0 ? '#f5222d' : '#52c41a', marginLeft: 8 }}>
                        ({summary.variance_fees > 0 ? '+' : ''}${summary.variance_fees.toFixed(2)} variance)
                      </span>
                    )}
                  </Descriptions.Item>

                  {(summary.invoice_status === 'approved' || summary.invoice_status === 'paid') && (
                    <>
                      <Descriptions.Item label="Admin Approved Fees">
                        <strong>${(summary.admin_approved_fees || 0).toFixed(2)}</strong>
                      </Descriptions.Item>
                      <Descriptions.Item label="Admin Approved Parking">
                        <strong>${(summary.admin_approved_parking || 0).toFixed(2)}</strong>
                      </Descriptions.Item>
                    </>
                  )}

                  {summary.invoice_status === 'paid' && (
                    <>
                      <Descriptions.Item label="Paid Amount">
                        <strong style={{ color: '#52c41a' }}>${(summary.paid_amount || 0).toFixed(2)}</strong>
                      </Descriptions.Item>
                      <Descriptions.Item label="Paid Date">
                        <strong>{summary.paid_date ? dayjs(summary.paid_date).format('MMM D, YYYY') : '-'}</strong>
                      </Descriptions.Item>
                    </>
                  )}
                </>
              ) : (
                <>
                  <Descriptions.Item label="Invoice Status">
                    <Tag color="default">Not Submitted</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Parking Reimbursements">
                    <strong>${summary.parking.toFixed(2)}</strong>
                  </Descriptions.Item>
                </>
              )}
            </Descriptions>

            <h4 style={{ marginTop: 20 }}>Daily Breakdown</h4>
            <Table
              dataSource={summary.daily_breakdown}
              columns={dailyBreakdownColumns}
              rowKey="date"
              pagination={false}
              size="small"
              summary={(data) => (
                <Table.Summary.Row style={{ fontWeight: 600, background: '#f0f0f0' }}>
                  <Table.Summary.Cell index={0}>Week Total</Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="center">
                    {data.reduce((sum, day) => sum + day.jobs, 0)}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2} align="right">
                    ${data.reduce((sum, day) => sum + day.base_fee, 0).toFixed(2)}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={3} align="right">
                    ${data.reduce((sum, day) => sum + day.daily_total, 0).toFixed(2)}
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              )}
            />
          </Card>
        ))}

        {summaries.length === 0 && !loading && (
          <Card>
            <p style={{ textAlign: 'center', color: '#999', padding: '40px 0' }}>
              No data found for the selected week. Please select a week and click "Load Week".
            </p>
          </Card>
        )}
      </Space>

      {/* Manual Entry Modal */}
      <Modal
        title={<span style={{ fontSize: '18px', fontWeight: 600 }}>Manual Invoice Entry</span>}
        open={manualEntryModalVisible}
        onCancel={() => {
          setManualEntryModalVisible(false);
          manualForm.resetFields();
        }}
        onOk={() => manualForm.submit()}
        okText="Create Invoice"
        okButtonProps={{
          style: { background: '#00a99d', borderColor: '#00a99d', fontWeight: 500 }
        }}
        width={700}
      >
        {selectedSummary && (
          <Form
            form={manualForm}
            layout="vertical"
            onFinish={handleSubmitManualEntry}
          >
            <Form.Item name="therapist_id" hidden>
              <Input />
            </Form.Item>

            <Form.Item label={<span style={{ color: '#d32f2f' }}>* Therapist</span>}>
              <div style={{
                padding: '8px 12px',
                background: '#f5f5f5',
                border: '1px solid #d9d9d9',
                borderRadius: '6px',
                fontSize: '16px',
                color: '#1890ff',
                fontWeight: 500
              }}>
                {selectedSummary.therapist_name}
              </div>
            </Form.Item>

            <div style={{ marginBottom: 24 }}>
              <div style={{
                fontSize: '16px',
                color: '#1890ff',
                fontWeight: 500,
                marginBottom: 16
              }}>
                Week {dayjs(selectedSummary.week_start).format('MMM D')} - {dayjs(selectedSummary.week_end).format('MMM D, YYYY')}
              </div>

              <div style={{
                background: '#f5f5f5',
                padding: '16px',
                borderRadius: '6px',
                display: 'flex',
                justifyContent: 'space-between'
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#666', fontSize: '14px', marginBottom: 4 }}>System Calculated Fees</div>
                  <div style={{ fontSize: '18px', fontWeight: 600 }}>${selectedSummary.base_fees.toFixed(2)}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#666', fontSize: '14px', marginBottom: 4 }}>Parking Reimbursements</div>
                  <div style={{ fontSize: '18px', fontWeight: 600 }}>${(selectedSummary.parking || 0).toFixed(2)}</div>
                </div>
              </div>
            </div>

            <Form.Item name="week_start_date" hidden>
              <DatePicker />
            </Form.Item>

            <Form.Item name="week_end_date" hidden>
              <DatePicker />
            </Form.Item>

            <Form.Item
              label="Invoice Number"
              name="invoice_number"
            >
              <Input placeholder="e.g., INV-2025-001" />
            </Form.Item>

            <Space style={{ width: '100%', marginBottom: 16 }} size="middle">
              <Form.Item
                label={<span style={{ color: '#d32f2f' }}>* Invoiced Fees</span>}
                name="invoiced_fees"
                rules={[{ required: true, message: 'Please enter fees' }]}
                style={{ marginBottom: 0, flex: 1 }}
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
                style={{ marginBottom: 0, flex: 1 }}
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
              label={
                <span>
                  Invoice Upload (PDF or Image)
                  <span style={{ marginLeft: 4, color: '#999', fontWeight: 400 }}>ⓘ</span>
                </span>
              }
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
              label={
                <span>
                  Parking Receipt Upload
                  <span style={{ marginLeft: 4, color: '#999', fontWeight: 400 }}>ⓘ</span>
                </span>
              }
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
              label={<span style={{ color: '#d32f2f' }}>* Status</span>}
              name="status"
              rules={[{ required: true }]}
            >
              <Select>
                <Option value="submitted">Submitted (requires approval)</Option>
                <Option value="approved">Approved (ready for payment)</Option>
              </Select>
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
};

export default WeeklySummaryTab;
