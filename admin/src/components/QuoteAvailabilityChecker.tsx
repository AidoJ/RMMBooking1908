import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Table,
  Tag,
  Alert,
  Space,
  Tooltip,
  Typography,
  Row,
  Col,
  Spin,
  Modal,
  Select,
  message,
  Badge,
  Divider,
} from 'antd';
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  UserOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  TeamOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import {
  checkQuoteAvailability,
  suggestAlternatives,
  type QuoteAvailabilityResult,
  type DayAvailability,
  type TherapistAvailability,
} from '../services/availabilityService';
import dayjs from 'dayjs';

const { Text, Title } = Typography;
const { Option } = Select;

interface QuoteAvailabilityCheckerProps {
  quoteId: string;
  onAvailabilityConfirmed: (assignments: TherapistAssignment[]) => void;
  onAvailabilityDeclined: () => void;
}

export interface TherapistAssignment {
  date: string;
  start_time: string;
  therapist_id: string;
  therapist_name: string;
  hourly_rate: number;
  is_override: boolean;
  override_reason?: string;
}

export const QuoteAvailabilityChecker: React.FC<QuoteAvailabilityCheckerProps> = ({
  quoteId,
  onAvailabilityConfirmed,
  onAvailabilityDeclined,
}) => {
  const [loading, setLoading] = useState(false);
  const [availability, setAvailability] = useState<QuoteAvailabilityResult | null>(null);
  const [assignments, setAssignments] = useState<TherapistAssignment[]>([]);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideSelection, setOverrideSelection] = useState<{
    date: string;
    therapist: TherapistAvailability;
  } | null>(null);
  const [overrideReason, setOverrideReason] = useState('');

  useEffect(() => {
    if (quoteId) {
      checkAvailability();
    }
  }, [quoteId]);

  const checkAvailability = async () => {
    setLoading(true);
    try {
      const result = await checkQuoteAvailability(quoteId);
      setAvailability(result);

      // Initialize assignments for available slots
      const initialAssignments: TherapistAssignment[] = [];
      result.days.forEach(day => {
        if (day.can_fulfill) {
          const availableTherapists = day.available_therapists.filter(t => t.is_available);
          for (let i = 0; i < day.therapists_required && i < availableTherapists.length; i++) {
            const therapist = availableTherapists[i];
            initialAssignments.push({
              date: day.date,
              start_time: day.start_time,
              therapist_id: therapist.therapist_id,
              therapist_name: therapist.therapist_name,
              hourly_rate: therapist.hourly_rate,
              is_override: false,
            });
          }
        }
      });
      setAssignments(initialAssignments);
    } catch (error) {
      console.error('Error checking availability:', error);
      message.error('Failed to check therapist availability');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: 'available' | 'partial' | 'unavailable') => {
    switch (status) {
      case 'available':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'partial':
        return <ExclamationCircleOutlined style={{ color: '#faad14' }} />;
      case 'unavailable':
        return <CloseCircleOutlined style={{ color: '#f5222d' }} />;
    }
  };

  const getStatusColor = (status: 'available' | 'partial' | 'unavailable') => {
    switch (status) {
      case 'available':
        return 'success';
      case 'partial':
        return 'warning';
      case 'unavailable':
        return 'error';
    }
  };

  const handleTherapistAssignment = (
    date: string,
    startTime: string,
    therapistId: string,
    slot: number
  ) => {
    const day = availability?.days.find(d => d.date === date && d.start_time === startTime);
    if (!day) return;

    const therapist = day.available_therapists.find(t => t.therapist_id === therapistId);
    if (!therapist) return;

    const newAssignments = [...assignments];
    const existingIndex = newAssignments.findIndex(
      a => a.date === date && a.start_time === startTime
    );

    const assignment: TherapistAssignment = {
      date,
      start_time: startTime,
      therapist_id: therapist.therapist_id,
      therapist_name: therapist.therapist_name,
      hourly_rate: therapist.hourly_rate,
      is_override: !therapist.is_available,
    };

    if (existingIndex >= 0) {
      newAssignments[existingIndex] = assignment;
    } else {
      newAssignments.push(assignment);
    }

    setAssignments(newAssignments);
  };

  const handleOverrideRequest = (date: string, therapist: TherapistAvailability) => {
    setOverrideSelection({ date, therapist });
    setShowOverrideModal(true);
  };

  const confirmOverride = () => {
    if (!overrideSelection || !overrideReason.trim()) {
      message.error('Please provide a reason for the override');
      return;
    }

    const { date, therapist } = overrideSelection;
    const day = availability?.days.find(d => d.date === date);
    if (!day) return;

    const assignment: TherapistAssignment = {
      date,
      start_time: day.start_time,
      therapist_id: therapist.therapist_id,
      therapist_name: therapist.therapist_name,
      hourly_rate: therapist.hourly_rate,
      is_override: true,
      override_reason: overrideReason,
    };

    const newAssignments = [...assignments];
    const existingIndex = newAssignments.findIndex(
      a => a.date === date && a.start_time === day.start_time
    );

    if (existingIndex >= 0) {
      newAssignments[existingIndex] = assignment;
    } else {
      newAssignments.push(assignment);
    }

    setAssignments(newAssignments);
    setShowOverrideModal(false);
    setOverrideSelection(null);
    setOverrideReason('');
    message.success('Override assignment confirmed');
  };

  const canConfirmAvailability = () => {
    if (!availability) return false;

    // Check if all days have required assignments
    return availability.days.every(day => {
      const dayAssignments = assignments.filter(
        a => a.date === day.date && a.start_time === day.start_time
      );
      return dayAssignments.length >= day.therapists_required;
    });
  };

  // Create columns factory that includes day context
  const createTherapistColumns = (currentDay: DayAvailability) => [
    {
      title: 'Therapist',
      dataIndex: 'therapist_name',
      key: 'therapist_name',
      render: (name: string, therapist: TherapistAvailability) => (
        <Space>
          <UserOutlined />
          <div>
            <div><Text strong>{name}</Text></div>
            <div><Text type="secondary" style={{ fontSize: 11 }}>
              {therapist.gender} • ⭐ {therapist.rating.toFixed(1)}
            </Text></div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Rate',
      dataIndex: 'hourly_rate',
      key: 'hourly_rate',
      render: (rate: number, therapist: TherapistAvailability) => (
        <div>
          <Text strong>${rate}/hr</Text>
          {therapist.is_afterhours && (
            <div><Tag color="orange">After Hours</Tag></div>
          )}
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'is_available',
      key: 'is_available',
      render: (available: boolean, therapist: TherapistAvailability) => (
        <div>
          {available ? (
            <Tag color="green" icon={<CheckCircleOutlined />}>Available</Tag>
          ) : (
            <Tooltip title={therapist.conflict_reason}>
              <Tag color="red" icon={<CloseCircleOutlined />}>
                {therapist.conflict_reason || 'Unavailable'}
              </Tag>
            </Tooltip>
          )}
        </div>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, therapist: TherapistAvailability) => (
        <Space>
          {therapist.is_available ? (
            <Button
              type="primary"
              size="small"
              onClick={() => handleTherapistAssignment(
                currentDay.date,
                currentDay.start_time,
                therapist.therapist_id,
                0
              )}
            >
              Assign
            </Button>
          ) : (
            <Button
              type="dashed"
              size="small"
              icon={<WarningOutlined />}
              onClick={() => handleOverrideRequest(currentDay.date, therapist)}
            >
              Override
            </Button>
          )}
        </Space>
      ),
    },
  ];

  if (loading) {
    return (
      <Card title="Checking Therapist Availability">
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>
            <Text>Checking therapist availability for all requested dates...</Text>
          </div>
        </div>
      </Card>
    );
  }

  if (!availability) {
    return (
      <Card title="Therapist Availability">
        <Alert
          message="Unable to check availability"
          description="Please ensure quote details are complete and try again."
          type="error"
          action={
            <Button onClick={checkAvailability} icon={<ReloadOutlined />}>
              Retry
            </Button>
          }
        />
      </Card>
    );
  }

  return (
    <div>
      {/* Summary Card */}
      <Card title="Availability Summary" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col span={6}>
            <Badge
              status={availability.overall_status === 'available' ? 'success' :
                     availability.overall_status === 'partial' ? 'warning' : 'error'}
              text={
                <Text strong>
                  {availability.overall_status === 'available' ? 'Fully Available' :
                   availability.overall_status === 'partial' ? 'Partially Available' : 'Unavailable'}
                </Text>
              }
            />
          </Col>
          <Col span={6}>
            <Text type="secondary">
              <CalendarOutlined /> {availability.summary.total_days} days
            </Text>
          </Col>
          <Col span={6}>
            <Text type="secondary">
              <CheckCircleOutlined style={{ color: '#52c41a' }} /> {availability.summary.available_days} available
            </Text>
          </Col>
          <Col span={6}>
            <Text type="secondary">
              <CloseCircleOutlined style={{ color: '#f5222d' }} /> {availability.summary.unavailable_days} conflicts
            </Text>
          </Col>
        </Row>

        {!availability.can_fulfill_completely && (
          <Alert
            style={{ marginTop: 16 }}
            message="Availability Issues Detected"
            description="Some dates have therapist conflicts. Review each day below and consider overrides or alternative dates."
            type="warning"
            showIcon
          />
        )}
      </Card>

      {/* Day-by-Day Availability */}
      {availability.days.map((day, index) => (
        <Card
          key={`${day.date}-${day.start_time}`}
          title={
            <Space>
              {getStatusIcon(day.status)}
              <span>
                {dayjs(day.date).format('MMMM DD, YYYY')} at {day.start_time}
              </span>
              <Tag color={getStatusColor(day.status)}>
                {day.therapists_available}/{day.therapists_required} therapists
              </Tag>
            </Space>
          }
          style={{ marginBottom: 16 }}
          extra={
            <Space>
              <TeamOutlined />
              <Text>Need {day.therapists_required} therapist(s)</Text>
            </Space>
          }
        >
          <Table
            dataSource={day.available_therapists}
            columns={createTherapistColumns(day)}
            rowKey="therapist_id"
            pagination={false}
            size="small"
          />

          {day.status !== 'available' && (
            <Alert
              style={{ marginTop: 12 }}
              message={`${day.therapists_required - day.therapists_available} therapist(s) needed`}
              description="Consider using override assignments or contacting client for alternative dates."
              type="warning"
              showIcon
            />
          )}
        </Card>
      ))}

      {/* Current Assignments */}
      {assignments.length > 0 && (
        <Card title="Current Assignments" style={{ marginBottom: 16 }}>
          {assignments.map((assignment, index) => (
            <div key={index} style={{ marginBottom: 8 }}>
              <Space>
                <CalendarOutlined />
                <Text>{dayjs(assignment.date).format('MMM DD')}</Text>
                <ClockCircleOutlined />
                <Text>{assignment.start_time}</Text>
                <UserOutlined />
                <Text strong>{assignment.therapist_name}</Text>
                <Text type="secondary">${assignment.hourly_rate}/hr</Text>
                {assignment.is_override && (
                  <Tag color="orange" icon={<WarningOutlined />}>
                    Override
                  </Tag>
                )}
              </Space>
            </div>
          ))}
        </Card>
      )}

      {/* Action Buttons */}
      <Card>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Button onClick={checkAvailability} icon={<ReloadOutlined />}>
              Refresh Availability
            </Button>
          </Space>
          <Space>
            <Button
              type="default"
              danger
              onClick={onAvailabilityDeclined}
            >
              Decline Quote
            </Button>
            <Button
              type="primary"
              disabled={!canConfirmAvailability()}
              onClick={() => onAvailabilityConfirmed(assignments)}
            >
              Confirm Availability & Send Quote
            </Button>
          </Space>
        </Space>
      </Card>

      {/* Override Modal */}
      <Modal
        title="Override Therapist Assignment"
        open={showOverrideModal}
        onOk={confirmOverride}
        onCancel={() => {
          setShowOverrideModal(false);
          setOverrideSelection(null);
          setOverrideReason('');
        }}
        okText="Confirm Override"
        cancelText="Cancel"
      >
        {overrideSelection && (
          <div>
            <Alert
              message="This therapist is not normally available"
              description={`${overrideSelection.therapist.therapist_name} has a conflict: ${overrideSelection.therapist.conflict_reason}`}
              type="warning"
              style={{ marginBottom: 16 }}
            />

            <div style={{ marginBottom: 16 }}>
              <Text strong>Reason for override:</Text>
              <Select
                style={{ width: '100%', marginTop: 8 }}
                placeholder="Select reason or type custom reason"
                value={overrideReason}
                onChange={setOverrideReason}
                mode="tags"
                maxTagCount={1}
              >
                <Option value="Called therapist - agreed to work">Called therapist - agreed to work</Option>
                <Option value="Client flexible with timing">Client flexible with timing</Option>
                <Option value="Emergency booking">Emergency booking</Option>
                <Option value="Therapist requested overtime">Therapist requested overtime</Option>
              </Select>
            </div>

            <Alert
              message="This will assign the therapist despite the conflict"
              type="info"
            />
          </div>
        )}
      </Modal>
    </div>
  );
};