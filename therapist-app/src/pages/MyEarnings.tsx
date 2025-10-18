import React, { useState, useEffect } from 'react';
import {
  Card,
  Typography,
  Spin,
  Button,
  Space,
  Statistic,
  Row,
  Col,
  Table,
  Tag,
  Modal,
  Form,
  Input,
  Upload,
  message as antdMessage,
  App,
  Descriptions,
} from 'antd';
import {
  DollarOutlined,
  CalendarOutlined,
  FileTextOutlined,
  UploadOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { supabaseClient } from '../utility/supabaseClient';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(isoWeek);

const { Title, Text } = Typography;
const { TextArea } = Input;

interface WeeklySummary {
  week_start: string;
  week_end: string;
  jobs_count: number;
  total_fees: number;
  booking_ids: string[];
  invoice_status?: 'submitted' | 'under_review' | 'approved' | 'paid' | null;
  invoice_id?: string;
}

interface DailyBreakdown {
  date: string;
  jobs: number;
  base_fee: number;
  daily_total: number;
  booking_ids: string[];
}

export const MyEarnings: React.FC = () => {
  const { modal } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [therapistId, setTherapistId] = useState<string | null>(null);
  const [weeklySummaries, setWeeklySummaries] = useState<WeeklySummary[]>([]);
  const [totalEarningsThisMonth, setTotalEarningsThisMonth] = useState(0);
  const [totalJobsCompleted, setTotalJobsCompleted] = useState(0);
  const [submitModalVisible, setSubmitModalVisible] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<WeeklySummary | null>(null);
  const [invoiceFile, setInvoiceFile] = useState<string | null>(null);
  const [dailyBreakdown, setDailyBreakdown] = useState<DailyBreakdown[]>([]);
  const [breakdownModalVisible, setBreakdownModalVisible] = useState(false);

  useEffect(() => {
    loadEarningsData();
  }, []);

  const loadEarningsData = async () => {
    try {
      setLoading(true);

      // Get therapist profile
      const userStr = localStorage.getItem('therapistUser');
      if (!userStr) {
        antdMessage.error('Please log in again');
        return;
      }

      const userData = JSON.parse(userStr);
      const userId = userData.user_id || userData.id;

      const { data: profile, error: profileError } = await supabaseClient
        .from('therapist_profiles')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (profileError) throw profileError;
      if (!profile) {
        antdMessage.error('Profile not found');
        return;
      }

      setTherapistId(profile.id);

      // Query completed bookings from last 12 weeks
      const startDate = dayjs().subtract(12, 'weeks').startOf('isoWeek').format('YYYY-MM-DD');

      const { data: bookings, error: bookingsError } = await supabaseClient
        .from('bookings')
        .select('id, booking_id, booking_time, therapist_fee')
        .eq('therapist_id', profile.id)
        .eq('status', 'completed')
        .gte('booking_time', startDate)
        .order('booking_time', { ascending: false });

      if (bookingsError) throw bookingsError;

      // Group bookings by week (Monday to Sunday)
      const weekMap = new Map<string, WeeklySummary>();

      bookings?.forEach((booking) => {
        const bookingDate = dayjs(booking.booking_time);
        const weekStart = bookingDate.startOf('isoWeek');
        const weekEnd = weekStart.add(6, 'day');
        const weekKey = weekStart.format('YYYY-MM-DD');

        if (!weekMap.has(weekKey)) {
          weekMap.set(weekKey, {
            week_start: weekStart.format('YYYY-MM-DD'),
            week_end: weekEnd.format('YYYY-MM-DD'),
            jobs_count: 0,
            total_fees: 0,
            booking_ids: [],
          });
        }

        const week = weekMap.get(weekKey)!;
        week.jobs_count += 1;
        week.total_fees += parseFloat(booking.therapist_fee?.toString() || '0');
        week.booking_ids.push(booking.booking_id);
      });

      const summaries = Array.from(weekMap.values()).sort(
        (a, b) => new Date(b.week_start).getTime() - new Date(a.week_start).getTime()
      );

      // Check for existing invoices for each week
      if (summaries.length > 0) {
        const { data: invoices, error: invoicesError } = await supabaseClient
          .from('therapist_payments')
          .select('week_start_date, week_end_date, status, id')
          .eq('therapist_id', profile.id);

        if (invoicesError) throw invoicesError;

        // Match invoices to weeks
        summaries.forEach((summary) => {
          const invoice = invoices?.find(
            (inv) =>
              inv.week_start_date === summary.week_start &&
              inv.week_end_date === summary.week_end
          );
          if (invoice) {
            summary.invoice_status = invoice.status;
            summary.invoice_id = invoice.id;
          }
        });
      }

      setWeeklySummaries(summaries);

      // Calculate this month's totals
      const monthStart = dayjs().startOf('month').format('YYYY-MM-DD');
      const monthSummaries = summaries.filter((s) => s.week_start >= monthStart);
      const monthTotal = monthSummaries.reduce((sum, s) => sum + s.total_fees, 0);
      const monthJobs = monthSummaries.reduce((sum, s) => sum + s.jobs_count, 0);

      setTotalEarningsThisMonth(monthTotal);
      setTotalJobsCompleted(monthJobs);
    } catch (error: any) {
      console.error('Error loading earnings:', error);
      antdMessage.error('Failed to load earnings data');
    } finally {
      setLoading(false);
    }
  };

  const handleViewBreakdown = async (week: WeeklySummary) => {
    try {
      // Query bookings for this specific week
      const { data: bookings, error } = await supabaseClient
        .from('bookings')
        .select('booking_id, booking_time, therapist_fee')
        .eq('therapist_id', therapistId)
        .eq('status', 'completed')
        .gte('booking_time', week.week_start)
        .lte('booking_time', week.week_end + ' 23:59:59')
        .order('booking_time');

      if (error) throw error;

      // Group by day
      const dayMap = new Map<string, DailyBreakdown>();

      bookings?.forEach((booking) => {
        const date = dayjs(booking.booking_time).format('YYYY-MM-DD');

        if (!dayMap.has(date)) {
          dayMap.set(date, {
            date,
            jobs: 0,
            base_fee: 0,
            daily_total: 0,
            booking_ids: [],
          });
        }

        const day = dayMap.get(date)!;
        day.jobs += 1;
        const fee = parseFloat(booking.therapist_fee || '0');
        day.base_fee += fee;
        day.daily_total += fee;
        day.booking_ids.push(booking.booking_id);
      });

      const breakdown = Array.from(dayMap.values()).sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      setDailyBreakdown(breakdown);
      setSelectedWeek(week);
      setBreakdownModalVisible(true);
    } catch (error: any) {
      console.error('Error loading breakdown:', error);
      antdMessage.error('Failed to load daily breakdown');
    }
  };

  const handleSubmitInvoice = (week: WeeklySummary) => {
    setSelectedWeek(week);
    form.resetFields();
    setInvoiceFile(null);
    setSubmitModalVisible(true);
  };

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setInvoiceFile(base64);
    };
    reader.readAsDataURL(file);
    return false; // Prevent auto upload
  };

  const handleInvoiceSubmit = async (values: any) => {
    if (!selectedWeek || !therapistId) return;

    try {
      setSubmitting(true);

      const invoiceData = {
        therapist_id: therapistId,
        week_start_date: selectedWeek.week_start,
        week_end_date: selectedWeek.week_end,
        total_amount: selectedWeek.total_fees,
        jobs_count: selectedWeek.jobs_count,
        booking_ids: selectedWeek.booking_ids,
        status: 'submitted' as const,
        invoice_number: values.invoice_number,
        notes: values.notes || null,
        invoice_file: invoiceFile || null,
        submitted_at: new Date().toISOString(),
      };

      const { error } = await supabaseClient
        .from('therapist_payments')
        .insert([invoiceData]);

      if (error) throw error;

      antdMessage.success('Invoice submitted successfully!');
      setSubmitModalVisible(false);
      loadEarningsData(); // Reload to update status
    } catch (error: any) {
      console.error('Error submitting invoice:', error);
      antdMessage.error('Failed to submit invoice');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusTag = (status?: string | null) => {
    if (!status) return null;

    const statusConfig: Record<string, { color: string; text: string }> = {
      submitted: { color: 'blue', text: 'Submitted' },
      under_review: { color: 'orange', text: 'Under Review' },
      approved: { color: 'green', text: 'Approved' },
      paid: { color: 'success', text: 'Paid' },
    };

    const config = statusConfig[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const columns = [
    {
      title: 'Week',
      dataIndex: 'week_start',
      key: 'week',
      render: (_: any, record: WeeklySummary) => (
        <Space direction="vertical" size={0}>
          <Text strong>{dayjs(record.week_start).format('MMM DD')} - {dayjs(record.week_end).format('MMM DD, YYYY')}</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {dayjs(record.week_start).format('dddd')} to {dayjs(record.week_end).format('dddd')}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Jobs',
      dataIndex: 'jobs_count',
      key: 'jobs',
      align: 'center' as const,
      render: (count: number) => <Text strong>{count}</Text>,
    },
    {
      title: 'Total Earnings',
      dataIndex: 'total_fees',
      key: 'earnings',
      render: (amount: number) => (
        <Text strong style={{ color: '#52c41a', fontSize: '16px' }}>
          ${amount.toFixed(2)}
        </Text>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'invoice_status',
      key: 'status',
      render: (status: string | null, record: WeeklySummary) => {
        if (status) {
          return getStatusTag(status);
        }
        // Check if week is complete (Sunday has passed)
        const weekEnded = dayjs(record.week_end).isBefore(dayjs(), 'day');
        return weekEnded ? (
          <Tag color="default">Ready to Submit</Tag>
        ) : (
          <Tag color="processing">In Progress</Tag>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: WeeklySummary) => {
        const weekEnded = dayjs(record.week_end).isBefore(dayjs(), 'day');
        const hasInvoice = !!record.invoice_status;

        return (
          <Space>
            <Button
              size="small"
              icon={<CalendarOutlined />}
              onClick={() => handleViewBreakdown(record)}
            >
              View Breakdown
            </Button>
            {weekEnded && !hasInvoice && (
              <Button
                type="primary"
                size="small"
                icon={<FileTextOutlined />}
                onClick={() => handleSubmitInvoice(record)}
              >
                Submit Invoice
              </Button>
            )}
          </Space>
        );
      },
    },
  ];

  const dailyColumns = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      render: (date: string) => (
        <Space direction="vertical" size={0}>
          <Text strong>{dayjs(date).format('dddd')}</Text>
          <Text type="secondary">{dayjs(date).format('MMM DD, YYYY')}</Text>
        </Space>
      ),
    },
    {
      title: 'Jobs',
      dataIndex: 'jobs',
      key: 'jobs',
      align: 'center' as const,
    },
    {
      title: 'Booking IDs',
      dataIndex: 'booking_ids',
      key: 'booking_ids',
      render: (ids: string[]) => (
        <Space direction="vertical" size={0}>
          {ids.map((id) => (
            <Text key={id} code style={{ fontSize: '11px' }}>
              {id}
            </Text>
          ))}
        </Space>
      ),
    },
    {
      title: 'Base Fee',
      dataIndex: 'base_fee',
      key: 'base_fee',
      render: (amount: number) => <Text>${amount.toFixed(2)}</Text>,
    },
    {
      title: 'Daily Total',
      dataIndex: 'daily_total',
      key: 'daily_total',
      render: (amount: number) => (
        <Text strong style={{ color: '#52c41a' }}>
          ${amount.toFixed(2)}
        </Text>
      ),
    },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <Title level={2}>My Earnings</Title>

      {/* Summary Statistics */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12}>
          <Card>
            <Statistic
              title="Total Earnings This Month"
              value={totalEarningsThisMonth}
              precision={2}
              prefix="$"
              valueStyle={{ color: '#52c41a' }}
              suffix={<DollarOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card>
            <Statistic
              title="Total Jobs Completed This Month"
              value={totalJobsCompleted}
              valueStyle={{ color: '#007e8c' }}
              suffix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Weekly Summaries Table */}
      <Card title="Weekly Earnings Summary">
        <Table
          dataSource={weeklySummaries}
          columns={columns}
          rowKey="week_start"
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: 'No earnings data available' }}
        />
      </Card>

      {/* Submit Invoice Modal */}
      <Modal
        title="Submit Invoice"
        open={submitModalVisible}
        onCancel={() => setSubmitModalVisible(false)}
        footer={null}
        width={600}
      >
        {selectedWeek && (
          <>
            <Descriptions bordered column={1} size="small" style={{ marginBottom: 24 }}>
              <Descriptions.Item label="Week">
                {dayjs(selectedWeek.week_start).format('MMM DD')} - {dayjs(selectedWeek.week_end).format('MMM DD, YYYY')}
              </Descriptions.Item>
              <Descriptions.Item label="Total Jobs">{selectedWeek.jobs_count}</Descriptions.Item>
              <Descriptions.Item label="Total Amount">
                <Text strong style={{ color: '#52c41a', fontSize: '16px' }}>
                  ${selectedWeek.total_fees.toFixed(2)}
                </Text>
              </Descriptions.Item>
            </Descriptions>

            <Form form={form} layout="vertical" onFinish={handleInvoiceSubmit}>
              <Form.Item
                name="invoice_number"
                label="Invoice Number"
                rules={[{ required: true, message: 'Please enter invoice number' }]}
              >
                <Input placeholder="e.g., INV-2024-001" />
              </Form.Item>

              <Form.Item name="notes" label="Notes (Optional)">
                <TextArea rows={3} placeholder="Additional notes or comments..." />
              </Form.Item>

              <Form.Item label="Upload Invoice (Optional)">
                <Upload
                  beforeUpload={handleFileUpload}
                  maxCount={1}
                  accept=".pdf,.jpg,.jpeg,.png"
                  onRemove={() => setInvoiceFile(null)}
                >
                  <Button icon={<UploadOutlined />}>Select File</Button>
                </Upload>
                <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                  Accepted formats: PDF, JPG, PNG
                </Text>
              </Form.Item>

              <Form.Item>
                <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                  <Button onClick={() => setSubmitModalVisible(false)}>Cancel</Button>
                  <Button type="primary" htmlType="submit" loading={submitting}>
                    Submit Invoice
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>

      {/* Daily Breakdown Modal */}
      <Modal
        title={
          selectedWeek
            ? `Daily Breakdown: ${dayjs(selectedWeek.week_start).format('MMM DD')} - ${dayjs(selectedWeek.week_end).format('MMM DD, YYYY')}`
            : 'Daily Breakdown'
        }
        open={breakdownModalVisible}
        onCancel={() => setBreakdownModalVisible(false)}
        footer={null}
        width={800}
      >
        <Table
          dataSource={dailyBreakdown}
          columns={dailyColumns}
          rowKey="date"
          pagination={false}
          summary={(data) => {
            const totalJobs = data.reduce((sum, item) => sum + item.jobs, 0);
            const totalAmount = data.reduce((sum, item) => sum + item.daily_total, 0);

            return (
              <Table.Summary.Row style={{ backgroundColor: '#fafafa' }}>
                <Table.Summary.Cell index={0}>
                  <Text strong>TOTAL</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="center">
                  <Text strong>{totalJobs}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={2}></Table.Summary.Cell>
                <Table.Summary.Cell index={3}></Table.Summary.Cell>
                <Table.Summary.Cell index={4}>
                  <Text strong style={{ color: '#52c41a', fontSize: '16px' }}>
                    ${totalAmount.toFixed(2)}
                  </Text>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            );
          }}
        />
      </Modal>
    </div>
  );
};
