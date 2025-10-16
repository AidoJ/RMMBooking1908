import React, { useState } from 'react';
import { DatePicker, Button, Table, Card, Descriptions, Space, message } from 'antd';
import { SearchOutlined, DollarOutlined } from '@ant-design/icons';
import { supabaseClient } from '../../utility';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(isoWeek);

interface DailyBreakdown {
  date: string;
  jobs: number;
  base_fee: number;
  extras: number;
  daily_total: number;
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
}

const WeeklySummaryTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(dayjs().startOf('isoWeek'));
  const [summaries, setSummaries] = useState<WeeklySummary[]>([]);

  const loadWeeklySummary = async () => {
    try {
      setLoading(true);

      const weekStart = selectedWeek.format('YYYY-MM-DD');
      const weekEnd = selectedWeek.add(6, 'day').format('YYYY-MM-DD');

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

      // Get invoice data for parking amounts
      const { data: invoices, error: invoicesError } = await supabaseClient
        .from('therapist_payments')
        .select('therapist_id, therapist_parking_amount, admin_approved_parking')
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
            daily_breakdown: []
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
            daily_total: 0
          };
          summary.daily_breakdown.push(dayRecord);
        }
        dayRecord.jobs += 1;
        dayRecord.base_fee += parseFloat(booking.therapist_fee || 0);
      });

      // Add parking amounts from invoices
      invoices?.forEach((invoice: any) => {
        const summary = therapistMap.get(invoice.therapist_id);
        if (summary) {
          summary.parking = parseFloat(invoice.admin_approved_parking || invoice.therapist_parking_amount || 0);
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
                <Button
                  type="primary"
                  icon={<DollarOutlined />}
                  onClick={() => message.info('Record payment functionality coming soon')}
                >
                  Record Payment
                </Button>
              </div>
            }
            style={{ background: '#fafafa' }}
          >
            <Descriptions bordered column={2} style={{ marginBottom: 20 }}>
              <Descriptions.Item label="Total Jobs Completed">
                <strong>{summary.total_jobs} bookings</strong>
              </Descriptions.Item>
              <Descriptions.Item label="Base Therapist Fees">
                <strong>${summary.base_fees.toFixed(2)}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="Parking Reimbursements">
                <strong>${summary.parking.toFixed(2)}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="TOTAL PAYMENT DUE">
                <strong style={{ color: '#52c41a', fontSize: '18px' }}>${summary.total_payment.toFixed(2)}</strong>
              </Descriptions.Item>
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
    </div>
  );
};

export default WeeklySummaryTab;
