import React, { useState, useEffect } from 'react';
import { Table, Select, DatePicker, Button, Space, message } from 'antd';
import { SearchOutlined, DownloadOutlined } from '@ant-design/icons';
import { supabaseClient } from '../../utility';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

interface CompletedJob {
  id: string;
  booking_id: string;
  booking_time: string;
  therapist_id: string;
  therapist_name: string;
  customer_name: string;
  duration_minutes: number;
  therapist_fee: number;
  payment_status: string;
}

const CompletedJobsTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState<CompletedJob[]>([]);
  const [therapists, setTherapists] = useState<any[]>([]);
  const [selectedTherapist, setSelectedTherapist] = useState<string>('all');
  const [dateRange, setDateRange] = useState<[string, string] | null>(null);

  useEffect(() => {
    loadTherapists();
    loadCompletedJobs();
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

  const loadCompletedJobs = async (therapistId?: string, start?: string, end?: string) => {
    try {
      setLoading(true);

      let query = supabaseClient
        .from('bookings')
        .select(`
          id,
          booking_id,
          booking_time,
          therapist_id,
          customer_name,
          duration_minutes,
          therapist_fee,
          therapist_profiles!inner(id, first_name, last_name)
        `)
        .eq('status', 'completed')
        .order('booking_time', { ascending: false });

      if (therapistId && therapistId !== 'all') {
        query = query.eq('therapist_id', therapistId);
      }

      if (start && end) {
        query = query.gte('booking_time', start).lte('booking_time', end + ' 23:59:59');
      }

      const { data, error } = await query;

      if (error) throw error;

      const formattedJobs = data?.map((job: any) => ({
        id: job.id,
        booking_id: job.booking_id,
        booking_time: job.booking_time,
        therapist_id: job.therapist_id,
        therapist_name: `${job.therapist_profiles.first_name} ${job.therapist_profiles.last_name}`,
        customer_name: job.customer_name,
        duration_minutes: job.duration_minutes,
        therapist_fee: parseFloat(job.therapist_fee || 0),
        payment_status: 'pending' // Will be enhanced with actual payment status
      })) || [];

      setJobs(formattedJobs);

    } catch (error) {
      console.error('Error loading completed jobs:', error);
      message.error('Failed to load completed jobs');
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = () => {
    loadCompletedJobs(
      selectedTherapist,
      dateRange ? dateRange[0] : undefined,
      dateRange ? dateRange[1] : undefined
    );
  };

  const columns = [
    {
      title: 'Date',
      dataIndex: 'booking_time',
      key: 'booking_time',
      render: (date: string) => dayjs(date).format('MMM D, YYYY'),
      width: 120
    },
    {
      title: 'Booking ID',
      dataIndex: 'booking_id',
      key: 'booking_id',
      width: 130
    },
    {
      title: 'Therapist',
      dataIndex: 'therapist_name',
      key: 'therapist_name',
      render: (name: string) => <strong style={{ color: '#1890ff' }}>{name}</strong>
    },
    {
      title: 'Client',
      dataIndex: 'customer_name',
      key: 'customer_name'
    },
    {
      title: 'Duration',
      dataIndex: 'duration_minutes',
      key: 'duration_minutes',
      align: 'center' as const,
      render: (mins: number) => `${mins} mins`,
      width: 100
    },
    {
      title: 'Fee',
      dataIndex: 'therapist_fee',
      key: 'therapist_fee',
      align: 'right' as const,
      render: (fee: number) => `$${fee.toFixed(2)}`,
      width: 100
    }
  ];

  return (
    <div>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
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

          <RangePicker
            onChange={(dates) => {
              if (dates) {
                setDateRange([dates[0]!.format('YYYY-MM-DD'), dates[1]!.format('YYYY-MM-DD')]);
              } else {
                setDateRange(null);
              }
            }}
          />

          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={handleFilter}
          >
            Filter
          </Button>

          <Button
            icon={<DownloadOutlined />}
            onClick={() => message.info('Export functionality coming soon')}
          >
            Export to CSV
          </Button>
        </div>

        <Table
          dataSource={jobs}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 50, showSizeChanger: true }}
          summary={(data) => (
            <Table.Summary fixed>
              <Table.Summary.Row style={{ fontWeight: 600 }}>
                <Table.Summary.Cell index={0} colSpan={5}>TOTAL</Table.Summary.Cell>
                <Table.Summary.Cell index={5} align="right">
                  ${data.reduce((sum, job) => sum + job.therapist_fee, 0).toFixed(2)}
                </Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
      </Space>
    </div>
  );
};

export default CompletedJobsTab;
