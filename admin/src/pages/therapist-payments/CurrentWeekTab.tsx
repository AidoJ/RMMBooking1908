import React, { useState, useEffect } from 'react';
import { Table, Button, Tag, message, Alert, Space, Statistic, Row, Col, Card } from 'antd';
import { CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { supabaseClient } from '../../utility';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(isoWeek);

interface WeeklyTherapistSummary {
  therapist_id: string;
  therapist_name: string;
  jobs_count: number;
  calculated_fees: number;
  parking_amount: number;
  total_due: number;
  has_pending_items: boolean;
  invoice_status: string;
}

const CurrentWeekTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [summaries, setSummaries] = useState<WeeklyTherapistSummary[]>([]);
  const [weekStart, setWeekStart] = useState<string>('');
  const [weekEnd, setWeekEnd] = useState<string>('');
  const [totalStats, setTotalStats] = useState({
    totalJobs: 0,
    totalFees: 0,
    totalDue: 0
  });

  useEffect(() => {
    // Calculate current week (Monday to Sunday)
    const today = dayjs();
    const monday = today.startOf('isoWeek');
    const sunday = monday.add(6, 'day');

    setWeekStart(monday.format('YYYY-MM-DD'));
    setWeekEnd(sunday.format('YYYY-MM-DD'));

    loadCurrentWeekSummary(monday.format('YYYY-MM-DD'), sunday.format('YYYY-MM-DD'));
  }, []);

  const loadCurrentWeekSummary = async (start: string, end: string) => {
    try {
      setLoading(true);

      // Get all completed bookings for current week
      const { data: bookings, error: bookingsError } = await supabaseClient
        .from('bookings')
        .select(`
          id,
          booking_id,
          therapist_id,
          therapist_fee,
          booking_time,
          therapist_profiles!inner(id, first_name, last_name)
        `)
        .eq('status', 'completed')
        .gte('booking_time', start)
        .lte('booking_time', end + ' 23:59:59');

      if (bookingsError) throw bookingsError;

      // Group by therapist
      const therapistMap = new Map<string, WeeklyTherapistSummary>();

      bookings?.forEach((booking: any) => {
        const therapistId = booking.therapist_id;
        const therapistName = `${booking.therapist_profiles.first_name} ${booking.therapist_profiles.last_name}`;

        if (!therapistMap.has(therapistId)) {
          therapistMap.set(therapistId, {
            therapist_id: therapistId,
            therapist_name: therapistName,
            jobs_count: 0,
            calculated_fees: 0,
            parking_amount: 0,
            total_due: 0,
            has_pending_items: false,
            invoice_status: 'not_submitted'
          });
        }

        const summary = therapistMap.get(therapistId)!;
        summary.jobs_count += 1;
        summary.calculated_fees += parseFloat(booking.therapist_fee || 0);
      });

      // Check for submitted invoices
      const { data: invoices, error: invoicesError } = await supabaseClient
        .from('therapist_payments')
        .select('therapist_id, status, therapist_parking_amount, admin_approved_parking')
        .eq('week_start_date', start)
        .eq('week_end_date', end);

      if (invoicesError) throw invoicesError;

      // Update summaries with invoice data
      invoices?.forEach((invoice: any) => {
        const summary = therapistMap.get(invoice.therapist_id);
        if (summary) {
          summary.invoice_status = invoice.status;
          summary.parking_amount = parseFloat(invoice.admin_approved_parking || invoice.therapist_parking_amount || 0);
          summary.has_pending_items = invoice.status === 'submitted' || invoice.status === 'under_review';
        }
      });

      // Calculate totals and update each summary
      const summariesArray = Array.from(therapistMap.values()).map(s => ({
        ...s,
        total_due: s.calculated_fees + s.parking_amount
      }));

      setSummaries(summariesArray);

      // Calculate overall stats
      const stats = summariesArray.reduce((acc, s) => ({
        totalJobs: acc.totalJobs + s.jobs_count,
        totalFees: acc.totalFees + s.calculated_fees,
        totalDue: acc.totalDue + s.total_due
      }), { totalJobs: 0, totalFees: 0, totalDue: 0 });

      setTotalStats(stats);

    } catch (error) {
      console.error('Error loading current week summary:', error);
      message.error('Failed to load current week summary');
    } finally {
      setLoading(false);
    }
  };

  const handleProcessAllPayments = () => {
    message.info('Process all payments functionality coming soon');
  };

  const columns = [
    {
      title: 'Therapist',
      dataIndex: 'therapist_name',
      key: 'therapist_name',
      render: (name: string) => <strong style={{ color: '#1890ff' }}>{name}</strong>
    },
    {
      title: 'Jobs',
      dataIndex: 'jobs_count',
      key: 'jobs_count',
      align: 'center' as const,
      width: 80
    },
    {
      title: 'Base Fees',
      dataIndex: 'calculated_fees',
      key: 'calculated_fees',
      align: 'right' as const,
      render: (amount: number) => `$${amount.toFixed(2)}`
    },
    {
      title: 'Parking',
      dataIndex: 'parking_amount',
      key: 'parking_amount',
      align: 'right' as const,
      render: (amount: number) => amount > 0 ? `$${amount.toFixed(2)}` : '-'
    },
    {
      title: 'Total Due',
      dataIndex: 'total_due',
      key: 'total_due',
      align: 'right' as const,
      render: (amount: number) => <strong>${amount.toFixed(2)}</strong>
    },
    {
      title: 'Status',
      dataIndex: 'invoice_status',
      key: 'invoice_status',
      align: 'center' as const,
      render: (status: string, record: WeeklyTherapistSummary) => {
        if (status === 'not_submitted') {
          return <Tag color="default">Not Submitted</Tag>;
        } else if (status === 'submitted' || status === 'under_review') {
          return (
            <Tag color="orange" icon={<ExclamationCircleOutlined />}>
              {record.has_pending_items ? 'Review Needed' : 'Submitted'}
            </Tag>
          );
        } else if (status === 'approved') {
          return <Tag color="green" icon={<CheckCircleOutlined />}>Ready</Tag>;
        } else if (status === 'paid') {
          return <Tag color="blue">Paid</Tag>;
        }
        return <Tag>{status}</Tag>;
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'center' as const,
      render: (_: any, record: WeeklyTherapistSummary) => (
        <Button type="primary" size="small">
          View Details
        </Button>
      )
    }
  ];

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Alert
          message={`Current Week: ${dayjs(weekStart).format('MMM D')} - ${dayjs(weekEnd).format('MMM D, YYYY')} (Payment: ${dayjs(weekEnd).add(3, 'day').format('ddd, MMM D')})`}
          description="Payments will be processed on Wednesday following the week ending Sunday. Review and approve all pending items before processing."
          type="info"
          showIcon
        />

        <Row gutter={16}>
          <Col span={8}>
            <Card>
              <Statistic
                title="Total Jobs"
                value={totalStats.totalJobs}
                prefix={<CheckCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="Total Base Fees"
                value={totalStats.totalFees}
                precision={2}
                prefix="$"
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="Total Amount Due"
                value={totalStats.totalDue}
                precision={2}
                prefix="$"
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
        </Row>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Therapist Summary</h3>
          <Button
            type="primary"
            size="large"
            onClick={handleProcessAllPayments}
            disabled={summaries.length === 0}
          >
            Process All Payments
          </Button>
        </div>

        <Table
          dataSource={summaries}
          columns={columns}
          rowKey="therapist_id"
          loading={loading}
          pagination={false}
          footer={() => (
            <div style={{ fontWeight: 600, textAlign: 'right' }}>
              TOTAL: {summaries.length} Therapist(s) | {totalStats.totalJobs} Jobs | ${totalStats.totalDue.toFixed(2)}
            </div>
          )}
        />
      </Space>
    </div>
  );
};

export default CurrentWeekTab;
