import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Select,
  TimePicker,
  Row,
  Col,
  Typography,
  Spin,
  message,
} from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { supabaseClient } from '../utility/supabaseClient';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

interface AvailabilitySlot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const Availability: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [therapistProfileId, setTherapistProfileId] = useState<string | null>(null);
  const [editingSlot, setEditingSlot] = useState<AvailabilitySlot | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  useEffect(() => {
    loadAvailability();
  }, []);

  const loadAvailability = async () => {
    try {
      setLoading(true);

      // Get therapist profile from localStorage
      const profileStr = localStorage.getItem('therapist_profile');
      if (!profileStr) {
        message.error('Please log in again');
        setLoading(false);
        return;
      }

      const profile = JSON.parse(profileStr);
      if (!profile || !profile.id) {
        console.error('Invalid therapist profile in localStorage');
        message.error('Please log in again');
        setLoading(false);
        return;
      }

      const profileData = { id: profile.id };
      setTherapistProfileId(profileData.id);

      // Load availability slots
      const { data, error } = await supabaseClient
        .from('therapist_availability')
        .select('*')
        .eq('therapist_id', profileData.id)
        .order('day_of_week')
        .order('start_time');

      if (error) throw error;

      setAvailability(data || []);
    } catch (error) {
      console.error('Error loading availability:', error);
      message.error('Failed to load availability');
    } finally {
      setLoading(false);
    }
  };

  const checkTimeOverlap = (
    dayOfWeek: number,
    startTime: string,
    endTime: string,
    excludeSlotId?: string
  ): { hasOverlap: boolean; conflictingSlot?: AvailabilitySlot } => {
    // Find all slots for the same day (excluding the slot being edited)
    const sameDaySlots = availability.filter(slot =>
      slot.day_of_week === dayOfWeek && slot.id !== excludeSlotId
    );

    // Convert times to minutes for easier comparison
    const toMinutes = (timeStr: string) => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + minutes;
    };

    const newStart = toMinutes(startTime);
    const newEnd = toMinutes(endTime);

    // Check if end time is before start time (invalid)
    if (newEnd <= newStart) {
      return { hasOverlap: true };
    }

    // Check for overlap with existing slots
    for (const slot of sameDaySlots) {
      const existingStart = toMinutes(slot.start_time);
      const existingEnd = toMinutes(slot.end_time);

      // Check if there's any overlap
      // Overlap occurs if: new start is before existing end AND new end is after existing start
      if (newStart < existingEnd && newEnd > existingStart) {
        return { hasOverlap: true, conflictingSlot: slot };
      }
    }

    return { hasOverlap: false };
  };

  const handleSubmit = async (values: any) => {
    if (!therapistProfileId) {
      message.error('Profile not found. Please complete your profile first.');
      return;
    }

    try {
      const startTime = values.start_time.format('HH:mm:ss');
      const endTime = values.end_time.format('HH:mm:ss');
      const dayOfWeek = values.day_of_week;

      // Check for overlapping time slots (exclude current slot if editing)
      const { hasOverlap, conflictingSlot } = checkTimeOverlap(
        dayOfWeek,
        startTime,
        endTime,
        isEditMode ? editingSlot?.id : undefined
      );

      if (hasOverlap) {
        if (conflictingSlot) {
          const conflictStart = dayjs(conflictingSlot.start_time, 'HH:mm:ss').format('h:mm A');
          const conflictEnd = dayjs(conflictingSlot.end_time, 'HH:mm:ss').format('h:mm A');
          message.error(
            `This time slot overlaps with an existing availability on ${dayNames[dayOfWeek]} from ${conflictStart} to ${conflictEnd}. Please choose a different time.`
          );
        } else {
          message.error('End time must be after start time.');
        }
        return;
      }

      if (isEditMode && editingSlot) {
        // Update existing availability
        const { data, error } = await supabaseClient
          .from('therapist_availability')
          .update({
            day_of_week: dayOfWeek,
            start_time: startTime,
            end_time: endTime
          })
          .eq('id', editingSlot.id)
          .select()
          .single();

        if (error) throw error;

        setAvailability(availability.map(slot =>
          slot.id === editingSlot.id ? data : slot
        ));
        message.success('Availability updated successfully!');
      } else {
        // Add new availability
        const availabilityData = {
          therapist_id: therapistProfileId,
          day_of_week: dayOfWeek,
          start_time: startTime,
          end_time: endTime
        };

        const { data, error } = await supabaseClient
          .from('therapist_availability')
          .insert([availabilityData])
          .select()
          .single();

        if (error) throw error;

        setAvailability([...availability, data]);
        message.success('Availability added successfully!');
      }

      setModalVisible(false);
      setIsEditMode(false);
      setEditingSlot(null);
      form.resetFields();
    } catch (error) {
      console.error('Error saving availability:', error);
      message.error('Failed to save availability');
    }
  };

  const handleEdit = (slot: AvailabilitySlot) => {
    setEditingSlot(slot);
    setIsEditMode(true);
    form.setFieldsValue({
      day_of_week: slot.day_of_week,
      start_time: dayjs(slot.start_time, 'HH:mm:ss'),
      end_time: dayjs(slot.end_time, 'HH:mm:ss')
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabaseClient
        .from('therapist_availability')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setAvailability(availability.filter(slot => slot.id !== id));
      message.success('Availability removed successfully!');
    } catch (error) {
      console.error('Error deleting availability:', error);
      message.error('Failed to remove availability');
    }
  };

  const columns = [
    {
      title: 'Day',
      dataIndex: 'day_of_week',
      key: 'day_of_week',
      render: (day: number) => dayNames[day],
      sorter: (a: AvailabilitySlot, b: AvailabilitySlot) => a.day_of_week - b.day_of_week,
    },
    {
      title: 'Start Time',
      dataIndex: 'start_time',
      key: 'start_time',
      render: (time: string) => dayjs(time, 'HH:mm:ss').format('h:mm A'),
    },
    {
      title: 'End Time',
      dataIndex: 'end_time',
      key: 'end_time',
      render: (time: string) => dayjs(time, 'HH:mm:ss').format('h:mm A'),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: AvailabilitySlot) => (
        <>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            style={{ marginRight: 8 }}
          >
            Edit
          </Button>
          <Button
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          >
            Remove
          </Button>
        </>
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
      <Title level={2}>Availability</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
        Set your weekly working hours. Customers can only book appointments during these times.
      </Text>

      {!therapistProfileId && (
        <Card style={{ marginBottom: 24, backgroundColor: '#fff7e6', borderColor: '#ffd591' }}>
          <Text type="warning">
            Please complete your profile first before setting availability
          </Text>
        </Card>
      )}

      <Card>
        <div style={{ marginBottom: 16 }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setIsEditMode(false);
              setEditingSlot(null);
              form.resetFields();
              setModalVisible(true);
            }}
            disabled={!therapistProfileId}
            size="large"
          >
            Add Availability
          </Button>
        </div>

        <Table
          dataSource={availability}
          columns={columns}
          rowKey="id"
          pagination={false}
        />
      </Card>

      <Modal
        title={isEditMode ? "Edit Availability" : "Add Availability"}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setIsEditMode(false);
          setEditingSlot(null);
          form.resetFields();
        }}
        footer={null}
        width={500}
      >
        <Form form={form} onFinish={handleSubmit} layout="vertical">
          <Form.Item
            label="Day of Week"
            name="day_of_week"
            rules={[{ required: true, message: 'Please select a day' }]}
          >
            <Select size="large">
              {dayNames.map((day, index) => (
                <Option key={index} value={index}>
                  {day}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Start Time"
                name="start_time"
                rules={[{ required: true, message: 'Please select start time' }]}
              >
                <TimePicker
                  format="h:mm A"
                  use12Hours
                  minuteStep={15}
                  size="large"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="End Time"
                name="end_time"
                rules={[{ required: true, message: 'Please select end time' }]}
              >
                <TimePicker
                  format="h:mm A"
                  use12Hours
                  minuteStep={15}
                  size="large"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item>
            <Button type="primary" htmlType="submit" size="large" block>
              {isEditMode ? "Update Availability" : "Add Availability"}
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
