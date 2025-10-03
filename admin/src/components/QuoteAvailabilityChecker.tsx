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
  DeleteOutlined,
} from '@ant-design/icons';
import {
  checkQuoteAvailability,
  suggestAlternatives,
  type QuoteAvailabilityResult,
  type DayAvailability,
  type TherapistAvailability,
} from '../services/availabilityService';
import { supabaseClient } from '../utility';
import dayjs from 'dayjs';

const { Text, Title } = Typography;
const { Option } = Select;

interface QuoteAvailabilityCheckerProps {
  quoteId: string;
  onAvailabilityConfirmed: (assignments: TherapistAssignment[]) => void;
  onAvailabilityDeclined: () => void;
  existingAssignments?: TherapistAssignment[]; // For loading existing assignments from sent quotes
  onAssignmentsChanged?: () => void; // Callback when assignments modified after quote sent
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
  existingAssignments,
  onAssignmentsChanged,
}) => {
  const [loading, setLoading] = useState(false);
  const [availability, setAvailability] = useState<QuoteAvailabilityResult | null>(null);
  const [assignments, setAssignments] = useState<TherapistAssignment[]>([]);
  const [availabilityConfirmed, setAvailabilityConfirmed] = useState(false);
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

  // Load existing assignments if provided
  useEffect(() => {
    if (existingAssignments && existingAssignments.length > 0) {
      console.log('Loading existing assignments:', existingAssignments);
      setAssignments(existingAssignments);
    }
  }, [existingAssignments]);

  const checkAvailability = async () => {
    setLoading(true);
    try {
      const result = await checkQuoteAvailability(quoteId);
      setAvailability(result);

      // Only reset assignments if there are no existing assignments to preserve
      if (!existingAssignments || existingAssignments.length === 0) {
        // Don't auto-assign therapists - let admin manually select them
        setAssignments([]);
      }
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
      a => a.date === date && a.start_time === startTime && a.therapist_id === therapist.therapist_id
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
    
    // Reset confirmation state when adding new assignment to allow re-confirmation
    const quoteStatus = (availability?.quote as any)?.status;
    console.log('🔍 Assignment added, quote status:', quoteStatus, 'callback exists:', !!onAssignmentsChanged);
    
    // Always reset confirmation when assignments change
    setAvailabilityConfirmed(false);
    
    if (quoteStatus === 'sent' || quoteStatus === 'accepted') {
      if (onAssignmentsChanged) {
        console.log('📢 Triggering onAssignmentsChanged callback');
        onAssignmentsChanged();
      } else {
        console.warn('⚠️ onAssignmentsChanged callback not provided');
      }
    }
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
      a => a.date === date && a.start_time === day.start_time && a.therapist_id === therapist.therapist_id
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
    
    // Always reset confirmation when assignments change
    setAvailabilityConfirmed(false);
    
    // Reset confirmation state when override assignment added
    const quoteStatus = (availability?.quote as any)?.status;
    console.log('🔍 Override added, quote status:', quoteStatus, 'callback exists:', !!onAssignmentsChanged);
    
    if (quoteStatus === 'sent' || quoteStatus === 'accepted') {
      if (onAssignmentsChanged) {
        console.log('📢 Triggering onAssignmentsChanged callback');
        onAssignmentsChanged();
      }
    }
  };

  const handleRemoveAssignment = async (assignmentToRemove: TherapistAssignment) => {
    // Show confirmation modal with warning
    Modal.confirm({
      title: '⚠️ Remove Assignment',
      content: (
        <div>
          <p>Are you sure you want to remove this assignment?</p>
          <p><strong>{assignmentToRemove.therapist_name}</strong> on <strong>{dayjs(assignmentToRemove.date).format('MMM DD, YYYY')}</strong> at <strong>{assignmentToRemove.start_time}</strong></p>
          {existingAssignments && existingAssignments.length > 0 && (
            <Alert
              message="This will delete the therapist's booking from the database and redistribute time slots among remaining therapists (if Split arrangement)."
              type="warning"
              showIcon
              style={{ marginTop: 12 }}
            />
          )}
        </div>
      ),
      okText: 'Yes, Remove',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          // Remove from local state
          const newAssignments = assignments.filter(
            assignment => !(
              assignment.date === assignmentToRemove.date &&
              assignment.start_time === assignmentToRemove.start_time &&
              assignment.therapist_id === assignmentToRemove.therapist_id
            )
          );
          setAssignments(newAssignments);

          // Always reset confirmation when assignments change
          setAvailabilityConfirmed(false);

          // If this quote has been sent, mark as changed
          const quoteStatus = (availability?.quote as any)?.status;
          console.log('🔍 Assignment removed, quote status:', quoteStatus, 'callback exists:', !!onAssignmentsChanged);
          
          if (quoteStatus === 'sent' || quoteStatus === 'accepted') {
            message.success('Assignment removed. Re-send quote or send updated schedule to sync changes.');
            
            // Trigger assignments changed callback
            if (onAssignmentsChanged) {
              console.log('📢 Triggering onAssignmentsChanged callback');
              onAssignmentsChanged();
            } else {
              console.warn('⚠️ onAssignmentsChanged callback not provided');
            }
          } else {
            message.success('Therapist assignment removed');
          }
    } catch (error) {
      message.destroy();
      console.error('Error removing assignment:', error);
      message.error('Failed to remove assignment: ' + (error instanceof Error ? error.message : 'Unknown error'));

          // Revert local state change on error
          setAssignments(assignments);
        }
      }
    });
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
      render: (_: any, therapist: TherapistAvailability) => {
        // Check if this therapist is already assigned for this day/time
        const isAssigned = assignments.some(
          assignment => assignment.date === currentDay.date &&
                       assignment.start_time === currentDay.start_time &&
                       assignment.therapist_id === therapist.therapist_id
        );

        return (
          <Space>
            {isAssigned ? (
              <Button
                type="default"
                danger
                size="small"
                icon={<DeleteOutlined />}
                onClick={() => {
                  const assignmentToRemove = assignments.find(
                    assignment => assignment.date === currentDay.date &&
                                 assignment.start_time === currentDay.start_time &&
                                 assignment.therapist_id === therapist.therapist_id
                  );
                  if (assignmentToRemove) {
                    handleRemoveAssignment(assignmentToRemove);
                  }
                }}
              >
                Remove
              </Button>
            ) : therapist.is_available ? (
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
        );
      },
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
          {assignments.map((assignment, index) => {
            // Use day-specific duration instead of average duration
            const dayInfo = availability?.days.find(d => d.date === assignment.date);
            const dayDurationMinutes = dayInfo?.duration_minutes || 0;
            const therapistsPerDay = assignments.filter(a => a.date === assignment.date).length || 1;

            // Duration per therapist for this specific day (respect arrangement)
            const serviceArrangement = (availability?.quote as any)?.service_arrangement || 'split';
            const durationPerTherapistMinutes = (serviceArrangement === 'multiply')
              ? dayDurationMinutes
              : (dayDurationMinutes / Math.max(1, therapistsPerDay));
            const hours = durationPerTherapistMinutes / 60;
            const totalFee = hours * assignment.hourly_rate;

            return (
              <div key={index} style={{ marginBottom: 12, padding: '12px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
                <Row gutter={[16, 8]}>
                  <Col span={12}>
                    <Space>
                      <CalendarOutlined />
                      <Text strong>{dayjs(assignment.date).format('MMM DD')}</Text>
                      <ClockCircleOutlined />
                      <Text>{assignment.start_time}</Text>
                    </Space>
                  </Col>
                  <Col span={12}>
                    <Space>
                      <UserOutlined />
                      <Text strong>{assignment.therapist_name}</Text>
                      {assignment.is_override && (
                        <Tag color="orange" icon={<WarningOutlined />}>
                          Override
                        </Tag>
                      )}
                    </Space>
                  </Col>
                  <Col span={12}>
                    <Text type="secondary">
                      Duration: <Text strong>{hours.toFixed(1)} hours</Text>
                    </Text>
                  </Col>
                  <Col span={10}>
                    <Text type="secondary">
                      Rate: <Text strong>${assignment.hourly_rate}/hr</Text> = <Text strong style={{ color: '#52c41a' }}>${totalFee.toFixed(2)}</Text>
                    </Text>
                  </Col>
                  <Col span={2} style={{ textAlign: 'right' }}>
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => handleRemoveAssignment(assignment)}
                      title="Remove this assignment"
                    />
                  </Col>
                </Row>
              </div>
            );
          })}

          {/* Assignment Summary */}
          <Divider />
          <Row>
            <Col span={12}>
              <Text strong>Total Assignments: {assignments.length}</Text>
            </Col>
            <Col span={12} style={{ textAlign: 'right' }}>
              <Text strong style={{ color: '#52c41a', fontSize: '16px' }}>
                Total Therapist Fees: ${assignments.reduce((total, assignment) => {
                  const dayInfo = availability?.days.find(d => d.date === assignment.date);
                  const dayDurationMinutes = dayInfo?.duration_minutes || 0;
                  const therapistsPerDay = assignments.filter(a => a.date === assignment.date).length || 1;
                  const serviceArrangement = (availability?.quote as any)?.service_arrangement || 'split';
                  const durationPerTherapistMinutes = (serviceArrangement === 'multiply')
                    ? dayDurationMinutes
                    : (dayDurationMinutes / Math.max(1, therapistsPerDay));
                  const hours = durationPerTherapistMinutes / 60;
                  return total + (hours * assignment.hourly_rate);
                }, 0).toFixed(2)}
              </Text>
            </Col>
          </Row>
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
            <Tooltip
              title={canConfirmAvailability()
                ? "Click to confirm therapist assignments and create pending bookings"
                : "Please assign all required therapists before confirming"}
            >
              <Button
                type="primary"
                disabled={!canConfirmAvailability() || availabilityConfirmed}
                onClick={() => {
                  setAvailabilityConfirmed(true);
                  onAvailabilityConfirmed(assignments);
                }}
                style={{
                  color: '#ffffff',
                  backgroundColor: availabilityConfirmed ? '#d9d9d9' : (canConfirmAvailability() ? '#007e8c' : undefined),
                  borderColor: availabilityConfirmed ? '#d9d9d9' : (canConfirmAvailability() ? '#007e8c' : undefined)
                }}
              >
                {availabilityConfirmed ? '✓ Assignments Confirmed' : 'Confirm Therapist Assignments'}
              </Button>
            </Tooltip>
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