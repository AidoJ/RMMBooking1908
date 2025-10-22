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
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
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

  useEffect(() => {
    loadAvailability();
  }, []);

  const loadAvailability = async () => {
    try {
      setLoading(true);

      // Get user data from localStorage
      const userStr = localStorage.getItem('therapistUser');
      if (!userStr) {
        message.error('Please log in again');
        return;
      }

      const userData = JSON.parse(userStr);
      const userId = userData.user_id || userData.id;

      // Get therapist profile first
      const { data: profileData, error: profileError } = await supabaseClient
        .from('therapist_profiles')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (profileError) {
        if (profileError.code === 'PGRST116') {
          message.warning('Please complete your profile first');
          setLoading(false);
          return;
        }
        throw profileError;
      }

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

  const handleAdd = async (values: any) => {
    if (!therapistProfileId) {
      message.error('Profile not found. Please complete your profile first.');
      return;
    }

    try {
      const availabilityData = {
        therapist_id: therapistProfileId,
        day_of_week: values.day_of_week,
        start_time: values.start_time.format('HH:mm:ss'),
        end_time: values.end_time.format('HH:mm:ss')
      };

      const { data, error } = await supabaseClient
        .from('therapist_availability')
        .insert([availabilityData])
        .select()
        .single();

      if (error) throw error;

      setAvailability([...availability, data]);
      setModalVisible(false);
      form.resetFields();
      message.success('Availability added successfully!');
    } catch (error) {
      console.error('Error adding availability:', error);
      message.error('Failed to add availability');
    }
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
        <Button
          danger
          size="small"
          icon={<DeleteOutlined />}
          onClick={() => handleDelete(record.id)}
        >
          Remove
        </Button>
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
            onClick={() => setModalVisible(true)}
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
        title="Add Availability"
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        footer={null}
        width={500}
      >
        <Form form={form} onFinish={handleAdd} layout="vertical">
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
              Add Availability
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
