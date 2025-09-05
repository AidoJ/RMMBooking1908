import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Typography,
  Row,
  Col,
  DatePicker,
  message,
  Statistic,
  Spin,
  Alert,
  Tag,
  Button,
  Space,
} from 'antd';
import {
  DollarOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  LeftOutlined,
  RightOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useGetIdentity } from '@refinedev/core';
import { UserIdentity } from '../../utils/roleUtils';
import { RoleGuard } from '../../components/RoleGuard';
import { TherapistPaymentService, WeeklyPaymentData, JobBreakdownData } from '../../services/therapistPaymentService';
import { supabaseClient } from '../../utility';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

export const TherapistEarnings: React.FC = () => {
  const { data: identity } = useGetIdentity<UserIdentity>();
  
  // State management
  const [loading, setLoading] = useState(false);
  const [currentWeek, setCurrentWeek] = useState<{ start: Date; end: Date }>(
    TherapistPaymentService.getCurrentWeek()
  );
  const [paymentHistory, setPaymentHistory] = useState<WeeklyPaymentData[]>([]);
  const [currentWeekData, setCurrentWeekData] = useState<WeeklyPaymentData | null>(null);
  const [jobBreakdown, setJobBreakdown] = useState<JobBreakdownData[]>([]);

  // Load payment data when component mounts or week changes
  useEffect(() => {
    if (identity?.id) {
      loadPaymentData();
      loadPaymentHistory();
      loadJobBreakdown();
    }
  }, [identity?.id, currentWeek]);

  const loadPaymentData = async () => {
    if (!identity?.id) return;
    
    try {
      setLoading(true);
      
      // Get therapist profile ID (same as calendar)
      const { data: profileData } = await supabaseClient
        .from('therapist_profiles')
        .select('id')
        .eq('user_id', identity.id)
        .single();

      if (!profileData) return;

      const data = await TherapistPaymentService.getWeeklyPaymentData(
        currentWeek.start,
        currentWeek.end
      );
      
      // Find payment data using therapist profile id
      const myPayment = data.find(p => p.therapist_id === profileData.id);
      setCurrentWeekData(myPayment || null);
    } catch (error: any) {
      console.error('Error loading payment data:', error);
      message.error('Failed to load payment data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadPaymentHistory = async () => {
    if (!identity?.id) return;
    
    try {
      // Get therapist profile ID (same as calendar)
      const { data: profileData } = await supabaseClient
        .from('therapist_profiles')
        .select('id')
        .eq('user_id', identity.id)
        .single();

      if (!profileData) return;

      // Load last 12 weeks of payment history
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - (12 * 7)); // 12 weeks ago
      
      const history = await TherapistPaymentService.getTherapistPaymentHistory(
        profileData.id,
        startDate,
        endDate
      );
      setPaymentHistory(history);
    } catch (error: any) {
      console.error('Error loading payment history:', error);
      message.error('Failed to load payment history: ' + error.message);
    }
  };

  const loadJobBreakdown = async () => {
    if (!identity?.id) return;
    
    try {
      // Get therapist profile ID (same as calendar)
      const { data: profileData } = await supabaseClient
        .from('therapist_profiles')
        .select('id')
        .eq('user_id', identity.id)
        .single();

      if (!profileData) return;

      // Load last 30 days of job breakdown
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30); // Last 30 days
      
      const jobs = await TherapistPaymentService.getTherapistJobBreakdown(
        profileData.id,
        startDate,
        endDate,
        50
      );
      setJobBreakdown(jobs);
    } catch (error: any) {
      console.error('Error loading job breakdown:', error);
      message.error('Failed to load job breakdown: ' + error.message);
    }
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newStart = new Date(currentWeek.start);
    const newEnd = new Date(currentWeek.end);
    
    if (direction === 'prev') {
      newStart.setDate(newStart.getDate() - 7);
      newEnd.setDate(newEnd.getDate() - 7);
    } else {
      newStart.setDate(newStart.getDate() + 7);
      newEnd.setDate(newEnd.getDate() + 7);
    }
    
    setCurrentWeek({ start: newStart, end: newEnd });
  };

  const goToCurrentWeek = () => {
    setCurrentWeek(TherapistPaymentService.getCurrentWeek());
  };

  // Calculate summary statistics from payment history
  const stats = paymentHistory.reduce(
    (acc, payment) => ({
      totalWeeks: acc.totalWeeks + 1,
      totalAssignments: acc.totalAssignments + payment.total_assignments,
      totalHours: acc.totalHours + payment.total_hours,
      totalEarnings: acc.totalEarnings + payment.total_fee,
      pendingAmount: acc.pendingAmount + (payment.payment_status === 'pending' ? payment.total_fee : 0),
      paidAmount: acc.paidAmount + (payment.payment_status === 'paid' ? (payment.paid_amount || payment.total_fee) : 0),
    }),
    {
      totalWeeks: 0,
      totalAssignments: 0,
      totalHours: 0,
      totalEarnings: 0,
      pendingAmount: 0,
      paidAmount: 0,
    }
  );

  const columns = [
    {
      title: 'Week Period',
      key: 'week_period',
      render: (_: any, record: WeeklyPaymentData) => (
        <div>
          <Text strong>
            {dayjs(record.week_start_date).format('MMM DD')} - {dayjs(record.week_end_date).format('MMM DD, YYYY')}
          </Text>
        </div>
      ),
    },
    {
      title: 'Jobs',
      dataIndex: 'total_assignments',
      key: 'total_assignments',
      align: 'center' as const,
      render: (count: number) => (
        <Text strong>{count}</Text>
      ),
    },
    {
      title: 'Hours',
      dataIndex: 'total_hours',
      key: 'total_hours',
      align: 'center' as const,
      render: (hours: number) => (
        <Text>{hours.toFixed(1)}</Text>
      ),
    },
    {
      title: 'Total Earned',
      dataIndex: 'total_fee',
      key: 'total_fee',
      align: 'right' as const,
      render: (fee: number) => (
        <Text strong style={{ color: '#52c41a', fontSize: '16px' }}>
          ${fee.toFixed(2)}
        </Text>
      ),
    },
    {
      title: 'Payment Status',
      dataIndex: 'payment_status',
      key: 'payment_status',
      align: 'center' as const,
      render: (status: string, record: WeeklyPaymentData) => (
        <div>
          {status === 'paid' ? (
            <Tag color="success" icon={<CheckCircleOutlined />}>
              Paid {record.payment_date && `${dayjs(record.payment_date).format('MMM DD')}`}
            </Tag>
          ) : (
            <Tag color="orange" icon={<ClockCircleOutlined />}>
              Pending
            </Tag>
          )}
          {record.paid_amount && record.paid_amount !== record.total_fee && (
            <div style={{ marginTop: 4, fontSize: '12px', color: '#666' }}>
              Paid: ${record.paid_amount.toFixed(2)}
            </div>
          )}
        </div>
      ),
    },
  ];

  const jobBreakdownColumns = [
    {
      title: 'Job Number',
      dataIndex: 'job_number',
      key: 'job_number',
      render: (jobNumber: string, record: JobBreakdownData) => (
        <div>
          <Text strong>{jobNumber}</Text>
          <br />
          <Tag color={record.job_type === 'booking' ? 'blue' : 'green'}>
            {record.job_type === 'booking' ? 'RB' : 'RQ'}
          </Tag>
        </div>
      ),
    },
    {
      title: 'Date',
      dataIndex: 'booking_time',
      key: 'booking_time',
      render: (date: string) => (
        <Text>{dayjs(date).format('MMM DD, YYYY')}</Text>
      ),
    },
    {
      title: 'Customer',
      dataIndex: 'customer_name',
      key: 'customer_name',
      render: (name: string) => <Text>{name}</Text>,
    },
    {
      title: 'Service',
      dataIndex: 'service_name',
      key: 'service_name',
      render: (service: string) => <Text>{service}</Text>,
    },
    {
      title: 'Hours',
      dataIndex: 'hours_worked',
      key: 'hours_worked',
      align: 'center' as const,
      render: (hours: number) => (
        <Text>{hours ? hours.toFixed(1) : '-'}</Text>
      ),
    },
    {
      title: 'Fee',
      dataIndex: 'therapist_fee',
      key: 'therapist_fee',
      align: 'right' as const,
      render: (fee: number) => (
        <Text strong style={{ color: '#52c41a', fontSize: '14px' }}>
          ${fee.toFixed(2)}
        </Text>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      align: 'center' as const,
      render: (status: string) => {
        const color = status === 'completed' ? 'success' : 
                     status === 'confirmed' ? 'processing' : 'default';
        return <Tag color={color}>{status}</Tag>;
      },
    },
    {
      title: 'Payment Status',
      key: 'payment_info',
      align: 'center' as const,
      render: (_: any, record: JobBreakdownData) => (
        <div>
          {record.payment_status === 'paid' ? (
            <Tag color="success" icon={<CheckCircleOutlined />}>
              Paid
            </Tag>
          ) : (
            <Tag color="orange" icon={<ClockCircleOutlined />}>
              Pending
            </Tag>
          )}
          {record.invoice_number && (
            <div style={{ marginTop: 4, fontSize: '12px', color: '#666' }}>
              Inv: {record.invoice_number}
            </div>
          )}
          {record.paid_amount && (
            <div style={{ marginTop: 2, fontSize: '12px', color: '#52c41a' }}>
              ${record.paid_amount.toFixed(2)}
            </div>
          )}
          {record.payment_date && (
            <div style={{ marginTop: 2, fontSize: '12px', color: '#666' }}>
              {dayjs(record.payment_date).format('MMM DD')}
            </div>
          )}
        </div>
      ),
    },
  ];

  const weekStartStr = currentWeek.start.toLocaleDateString('en-AU', {
    month: 'short',
    day: 'numeric',
  });
  const weekEndStr = currentWeek.end.toLocaleDateString('en-AU', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <RoleGuard requiredRole="therapist">
      <div style={{ padding: '24px' }}>
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <Title level={2}>💰 My Earnings</Title>
          <Text type="secondary">
            View your weekly earnings, payment history, and current payment status
          </Text>
        </div>

        {/* Current Week Section */}
        <Card style={{ marginBottom: '24px' }}>
          <Row justify="space-between" align="middle" style={{ marginBottom: '16px' }}>
            <Col>
              <Space>
                <Button
                  icon={<LeftOutlined />}
                  onClick={() => navigateWeek('prev')}
                  disabled={loading}
                >
                  Previous Week
                </Button>
                <Button
                  icon={<CalendarOutlined />}
                  onClick={goToCurrentWeek}
                  disabled={loading}
                >
                  Current Week
                </Button>
                <Button
                  icon={<RightOutlined />}
                  onClick={() => navigateWeek('next')}
                  disabled={loading}
                >
                  Next Week
                </Button>
              </Space>
            </Col>
            <Col>
              <Space>
                <Title level={4} style={{ margin: 0, color: '#1890ff' }}>
                  Week of {weekStartStr} - {weekEndStr}
                </Title>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={loadPaymentData}
                  disabled={loading}
                >
                  Refresh
                </Button>
              </Space>
            </Col>
          </Row>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Spin size="large" />
            </div>
          ) : currentWeekData ? (
            <Row gutter={[16, 16]}>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="Jobs Completed"
                    value={currentWeekData.total_assignments}
                    prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="Hours Worked"
                    value={currentWeekData.total_hours}
                    precision={1}
                    prefix={<ClockCircleOutlined style={{ color: '#fa8c16' }} />}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="Total Earned"
                    value={currentWeekData.total_fee}
                    precision={2}
                    prefix="$"
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="Payment Status"
                    value={currentWeekData.payment_status === 'paid' ? 'Paid' : 'Pending'}
                    valueStyle={{ 
                      color: currentWeekData.payment_status === 'paid' ? '#52c41a' : '#fa8c16' 
                    }}
                    prefix={
                      currentWeekData.payment_status === 'paid' ? 
                      <CheckCircleOutlined /> : 
                      <ClockCircleOutlined />
                    }
                  />
                </Card>
              </Col>
            </Row>
          ) : (
            <Alert
              message="No Data for This Week"
              description={`No completed assignments found for ${weekStartStr} - ${weekEndStr}.`}
              type="info"
              showIcon
            />
          )}
        </Card>

        {/* Summary Statistics */}
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="Total Jobs (12 weeks)"
                value={stats.totalAssignments}
                prefix={<CheckCircleOutlined style={{ color: '#1890ff' }} />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Total Hours (12 weeks)"
                value={stats.totalHours}
                precision={1}
                prefix={<ClockCircleOutlined style={{ color: '#fa8c16' }} />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Pending Payments"
                value={stats.pendingAmount}
                precision={2}
                prefix="$"
                valueStyle={{ color: '#fa8c16' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Payments Received"
                value={stats.paidAmount}
                precision={2}
                prefix="$"
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
        </Row>

        {/* Payment History Table */}
        <Card>
          <Title level={4} style={{ marginBottom: '16px' }}>
            Payment History (Last 12 Weeks)
          </Title>
          
          {paymentHistory.length === 0 ? (
            <Alert
              message="No Payment History"
              description="No payment records found. Complete some assignments to see your earnings history here."
              type="info"
              showIcon
            />
          ) : (
            <Table
              columns={columns}
              dataSource={paymentHistory.sort((a, b) => 
                new Date(b.week_start_date).getTime() - new Date(a.week_start_date).getTime()
              )}
              rowKey={(record) => `${record.therapist_id}-${record.week_start_date}`}
              pagination={{ 
                pageSize: 10,
                showSizeChanger: false,
                showQuickJumper: true
              }}
              size="middle"
            />
          )}
        </Card>

        {/* Job Breakdown Table */}
        <Card style={{ marginTop: '24px' }}>
          <Title level={4} style={{ marginBottom: '16px' }}>
            📋 Recent Jobs (Last 30 Days)
          </Title>
          
          {jobBreakdown.length === 0 ? (
            <Alert
              message="No Recent Jobs"
              description="No completed jobs found in the last 30 days."
              type="info"
              showIcon
            />
          ) : (
            <Table
              columns={jobBreakdownColumns}
              dataSource={jobBreakdown}
              rowKey={(record) => `${record.job_type}-${record.id}`}
              pagination={{ 
                pageSize: 20,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} jobs`
              }}
              size="middle"
              scroll={{ x: 1000 }}
            />
          )}
        </Card>
      </div>
    </RoleGuard>
  );
};