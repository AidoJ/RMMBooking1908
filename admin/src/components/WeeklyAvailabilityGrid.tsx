import React, { useMemo } from 'react';
import {
  Row,
  Col,
  Button,
  Checkbox,
  TimePicker,
  Space,
  Tooltip,
  message,
  Popconfirm,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  CopyOutlined,
  ClearOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

interface Availability {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

interface WeeklyAvailabilityGridProps {
  availability: Availability[];
  onChange: (availability: Availability[]) => void;
  disabled?: boolean;
}

const DAYS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

const DEFAULT_START = '09:00';
const DEFAULT_END = '17:00';

const WeeklyAvailabilityGrid: React.FC<WeeklyAvailabilityGridProps> = ({
  availability,
  onChange,
  disabled = false,
}) => {
  // Group availability by day
  const slotsByDay = useMemo(() => {
    const grouped: Record<number, Availability[]> = {};
    for (let d = 0; d <= 6; d++) grouped[d] = [];
    availability.forEach(slot => {
      grouped[slot.day_of_week].push(slot);
    });
    // Sort slots within each day by start time
    for (let d = 0; d <= 6; d++) {
      grouped[d].sort((a, b) => a.start_time.localeCompare(b.start_time));
    }
    return grouped;
  }, [availability]);

  // Convert time string to minutes for comparison
  const toMinutes = (timeStr: string): number => {
    const [hours, minutes] = timeStr.substring(0, 5).split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Check for overlap between slots on the same day
  const checkTimeOverlap = (
    dayOfWeek: number,
    startTime: string,
    endTime: string,
    excludeSlotIndex?: number
  ): boolean => {
    const sameDaySlots = slotsByDay[dayOfWeek].filter((_, idx) => idx !== excludeSlotIndex);
    const newStart = toMinutes(startTime);
    const newEnd = toMinutes(endTime);

    if (newEnd <= newStart) return true;

    for (const slot of sameDaySlots) {
      const existingStart = toMinutes(slot.start_time);
      const existingEnd = toMinutes(slot.end_time);
      if (newStart < existingEnd && newEnd > existingStart) {
        return true;
      }
    }
    return false;
  };

  // Toggle day availability - adds default slot or removes all slots
  const toggleDayAvailable = (day: number) => {
    if (disabled) return;

    const hasSlots = slotsByDay[day].length > 0;

    if (hasSlots) {
      // Remove all slots for this day
      const newAvailability = availability.filter(slot => slot.day_of_week !== day);
      onChange(newAvailability);
    } else {
      // Add default slot for this day
      const newSlot: Availability = {
        day_of_week: day,
        start_time: DEFAULT_START,
        end_time: DEFAULT_END,
      };
      onChange([...availability, newSlot]);
    }
  };

  // Update a specific slot's time
  const updateSlotTime = (
    day: number,
    slotIndex: number,
    field: 'start_time' | 'end_time',
    value: dayjs.Dayjs | null
  ) => {
    if (disabled || !value) return;

    const timeString = value.format('HH:mm');
    const daySlots = [...slotsByDay[day]];
    const currentSlot = daySlots[slotIndex];

    const newStartTime = field === 'start_time' ? timeString : currentSlot.start_time;
    const newEndTime = field === 'end_time' ? timeString : currentSlot.end_time;

    // Validate times
    if (toMinutes(newEndTime) <= toMinutes(newStartTime)) {
      message.error('End time must be after start time');
      return;
    }

    // Check for overlap
    if (checkTimeOverlap(day, newStartTime, newEndTime, slotIndex)) {
      message.error('This time slot overlaps with another slot on the same day');
      return;
    }

    // Update the slot
    const updatedSlot = { ...currentSlot, [field]: timeString };

    // Rebuild availability array
    const newAvailability = availability.map(slot => {
      if (slot.day_of_week === day) {
        const dayIndex = slotsByDay[day].indexOf(slot);
        if (dayIndex === slotIndex) {
          return updatedSlot;
        }
      }
      return slot;
    });

    onChange(newAvailability);
  };

  // Add a new slot to a day
  const addSlotToDay = (day: number) => {
    if (disabled) return;

    const daySlots = slotsByDay[day];
    let newStart = DEFAULT_START;
    let newEnd = DEFAULT_END;

    if (daySlots.length > 0) {
      // Find the last slot's end time and start 1 hour after
      const lastSlot = daySlots[daySlots.length - 1];
      const lastEndMinutes = toMinutes(lastSlot.end_time);
      const newStartMinutes = lastEndMinutes + 60; // 1 hour gap

      if (newStartMinutes >= 24 * 60 - 60) {
        message.error('Cannot add more slots - not enough time in the day');
        return;
      }

      const newEndMinutes = Math.min(newStartMinutes + 240, 24 * 60 - 15); // 4 hours or until 23:45

      newStart = `${String(Math.floor(newStartMinutes / 60)).padStart(2, '0')}:${String(newStartMinutes % 60).padStart(2, '0')}`;
      newEnd = `${String(Math.floor(newEndMinutes / 60)).padStart(2, '0')}:${String(newEndMinutes % 60).padStart(2, '0')}`;
    }

    // Validate no overlap
    if (checkTimeOverlap(day, newStart, newEnd)) {
      message.error('Unable to add slot - would overlap with existing times');
      return;
    }

    const newSlot: Availability = {
      day_of_week: day,
      start_time: newStart,
      end_time: newEnd,
    };

    onChange([...availability, newSlot]);
  };

  // Remove a specific slot
  const removeSlot = (day: number, slotIndex: number) => {
    if (disabled) return;

    const slotToRemove = slotsByDay[day][slotIndex];
    const newAvailability = availability.filter(slot => slot !== slotToRemove);
    onChange(newAvailability);
  };

  // Copy Monday slots to all weekdays (Tue-Fri)
  const copyMondayToWeekdays = () => {
    if (disabled) return;

    const mondaySlots = slotsByDay[1];
    if (mondaySlots.length === 0) {
      message.warning('Monday has no availability slots to copy');
      return;
    }

    // Keep Sunday (0), Monday (1), and Saturday (6) slots unchanged
    // Replace Tuesday (2) through Friday (5) with Monday's pattern
    const preservedSlots = availability.filter(
      slot => slot.day_of_week === 0 || slot.day_of_week === 1 || slot.day_of_week === 6
    );

    // Create copies of Monday slots for each weekday
    const copiedSlots: Availability[] = [];
    for (let day = 2; day <= 5; day++) {
      mondaySlots.forEach(slot => {
        copiedSlots.push({
          day_of_week: day,
          start_time: slot.start_time,
          end_time: slot.end_time,
        });
      });
    }

    onChange([...preservedSlots, ...copiedSlots]);
    message.success('Monday availability copied to Tuesday through Friday');
  };

  // Clear all availability
  const clearAll = () => {
    if (disabled) return;
    onChange([]);
    message.success('All availability cleared');
  };

  // Render a time slot row
  const renderSlot = (day: number, slot: Availability, slotIndex: number, isOnlySlot: boolean) => {
    return (
      <Space key={slotIndex} size="small" style={{ marginBottom: 4 }}>
        <TimePicker
          value={dayjs(slot.start_time.substring(0, 5), 'HH:mm')}
          format="h:mm A"
          use12Hours
          minuteStep={15}
          size="small"
          disabled={disabled}
          onChange={(value) => updateSlotTime(day, slotIndex, 'start_time', value)}
          style={{ width: 100 }}
          allowClear={false}
        />
        <span style={{ color: '#666' }}>-</span>
        <TimePicker
          value={dayjs(slot.end_time.substring(0, 5), 'HH:mm')}
          format="h:mm A"
          use12Hours
          minuteStep={15}
          size="small"
          disabled={disabled}
          onChange={(value) => updateSlotTime(day, slotIndex, 'end_time', value)}
          style={{ width: 100 }}
          allowClear={false}
        />
        <Tooltip title="Remove this time slot">
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            disabled={disabled}
            onClick={() => removeSlot(day, slotIndex)}
          />
        </Tooltip>
      </Space>
    );
  };

  return (
    <div>
      {/* Action buttons */}
      <Space style={{ marginBottom: 16 }}>
        <Tooltip title="Copy Monday's schedule to Tuesday through Friday">
          <Button
            icon={<CopyOutlined />}
            onClick={copyMondayToWeekdays}
            disabled={disabled || slotsByDay[1].length === 0}
          >
            Copy Mon → Weekdays
          </Button>
        </Tooltip>
        <Popconfirm
          title="Clear all availability?"
          description="This will remove all availability slots for all days."
          onConfirm={clearAll}
          okText="Clear All"
          cancelText="Cancel"
          disabled={disabled || availability.length === 0}
        >
          <Button
            icon={<ClearOutlined />}
            danger
            disabled={disabled || availability.length === 0}
          >
            Clear All
          </Button>
        </Popconfirm>
      </Space>

      {/* Grid of days */}
      <div style={{
        border: '1px solid #d9d9d9',
        borderRadius: 8,
        overflow: 'hidden',
      }}>
        {/* Header row */}
        <Row
          style={{
            background: '#fafafa',
            borderBottom: '1px solid #d9d9d9',
            padding: '8px 12px',
            fontWeight: 600,
          }}
        >
          <Col span={4}>Day</Col>
          <Col span={3} style={{ textAlign: 'center' }}>Available</Col>
          <Col span={15}>Time Slots</Col>
          <Col span={2} style={{ textAlign: 'center' }}>Add</Col>
        </Row>

        {/* Day rows */}
        {DAYS.map(({ value: day, label }) => {
          const daySlots = slotsByDay[day];
          const isAvailable = daySlots.length > 0;
          const isWeekend = day === 0 || day === 6;

          return (
            <Row
              key={day}
              style={{
                padding: '10px 12px',
                borderBottom: day < 6 ? '1px solid #f0f0f0' : undefined,
                background: isWeekend ? '#fafafa' : undefined,
                alignItems: 'flex-start',
              }}
            >
              <Col span={4} style={{ fontWeight: 500, paddingTop: 4 }}>
                {label}
              </Col>
              <Col span={3} style={{ textAlign: 'center', paddingTop: 4 }}>
                <Checkbox
                  checked={isAvailable}
                  disabled={disabled}
                  onChange={() => toggleDayAvailable(day)}
                />
              </Col>
              <Col span={15}>
                {isAvailable ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {daySlots.map((slot, idx) => renderSlot(day, slot, idx, daySlots.length === 1))}
                  </div>
                ) : (
                  <span style={{ color: '#999', fontStyle: 'italic', paddingTop: 4, display: 'inline-block' }}>
                    Not available
                  </span>
                )}
              </Col>
              <Col span={2} style={{ textAlign: 'center' }}>
                {isAvailable && (
                  <Tooltip title="Add another time slot (split shift)">
                    <Button
                      type="text"
                      size="small"
                      icon={<PlusOutlined />}
                      disabled={disabled}
                      onClick={() => addSlotToDay(day)}
                    />
                  </Tooltip>
                )}
              </Col>
            </Row>
          );
        })}
      </div>

      {/* Help text */}
      <div style={{ marginTop: 12, color: '#666', fontSize: 13 }}>
        <strong>Tip:</strong> Check the box to mark a day as available, then adjust the times.
        Use the + button to add split shifts (e.g., morning and evening slots).
      </div>
    </div>
  );
};

export default WeeklyAvailabilityGrid;
