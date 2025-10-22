import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  DatePicker,
  TimePicker,
  Input,
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
const { TextArea } = Input;
const { RangePicker } = DatePicker;

interface TimeOff {
  id: string;
  start_date: string;
  end_date: string;
  start_time?: string;
  end_time?: string;
  reason?: string;
  is_active: boolean;
}

export const TimeOff: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<TimeOff | null>(null);
  const [timeOff, setTimeOff] = useState<TimeOff[]>([]);
  const [therapistProfileId, setTherapistProfileId] = useState<string | null>(null);

  useEffect(() => {
    loadTimeOff();
  }, []);

  const loadTimeOff = async () => {
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

      // Load time off periods
      const { data, error } = await supabaseClient
        .from('therapist_time_off')
        .select('*')
        .eq('therapist_id', profileData.id)
        .eq('is_active', true)
        .order('start_date');

      if (error) throw error;

      setTimeOff(data || []);
    } catch (error) {
      console.error('Error loading time off:', error);
      message.error('Failed to load time off');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values: any) => {
    if (!therapistProfileId) {
      message.error('Profile not found. Please complete your profile first.');
      return;
    }

    try {
      const timeOffData = {
        therapist_id: therapistProfileId,
        start_date: values.dates[0].format('YYYY-MM-DD'),
        end_date: values.dates[1].format('YYYY-MM-DD'),
        start_time: values.start_time?.format('HH:mm:ss'),
        end_time: values.end_time?.format('HH:mm:ss'),
        reason: values.reason,
        is_active: true
      };

      if (editingRecord) {
        // Update existing record
        const { data, error } = await supabaseClient
          .from('therapist_time_off')
          .update(timeOffData)
          .eq('id', editingRecord.id)
          .select()
          .single();

        if (error) throw error;

        setTimeOff(timeOff.map(item => item.id === editingRecord.id ? data : item));
        message.success('Time off updated successfully!');
      } else {
        // Insert new record
        const { data, error } = await supabaseClient
          .from('therapist_time_off')
          .insert([timeOffData])
          .select()
          .single();

        if (error) throw error;

        setTimeOff([...timeOff, data]);
        message.success('Time off added successfully!');
      }

      setModalVisible(false);
      setEditingRecord(null);
      form.resetFields();
    } catch (error) {
      console.error('Error saving time off:', error);
      message.error(editingRecord ? 'Failed to update time off' : 'Failed to add time off');
    }
  };

  const handleEdit = (record: TimeOff) => {
    setEditingRecord(record);
    form.setFieldsValue({
      dates: [dayjs(record.start_date), dayjs(record.end_date)],
      start_time: record.start_time ? dayjs(record.start_time, 'HH:mm:ss') : undefined,
      end_time: record.end_time ? dayjs(record.end_time, 'HH:mm:ss') : undefined,
      reason: record.reason
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabaseClient
        .from('therapist_time_off')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;

      setTimeOff(timeOff.filter(item => item.id !== id));
      message.success('Time off removed successfully!');
    } catch (error) {
      console.error('Error deleting time off:', error);
      message.error('Failed to remove time off');
    }
  };

  const columns = [
    {
      title: 'Start Date',
      dataIndex: 'start_date',
      key: 'start_date',
      render: (date: string) => dayjs(date).format('MMM DD, YYYY'),
    },
    {
      title: 'End Date',
      dataIndex: 'end_date',
      key: 'end_date',
      render: (date: string) => dayjs(date).format('MMM DD, YYYY'),
    },
    {
      title: 'Time',
      key: 'time',
      render: (_: any, record: TimeOff) => {
        if (record.start_time && record.end_time) {
          return `${dayjs(record.start_time, 'HH:mm:ss').format('h:mm A')} - ${dayjs(record.end_time, 'HH:mm:ss').format('h:mm A')}`;
        }
        return 'All Day';
      },
    },
    {
      title: 'Reason',
      dataIndex: 'reason',
      key: 'reason',
      render: (reason: string) => reason || '-',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: TimeOff) => (
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
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
        </div>
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
      <Title level={2}>Time Off</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
        Manage your time off periods. You won't receive bookings during these times.
      </Text>

      {!therapistProfileId && (
        <Card style={{ marginBottom: 24, backgroundColor: '#fff7e6', borderColor: '#ffd591' }}>
          <Text type="warning">
            Please complete your profile first before managing time off
          </Text>
        </Card>
      )}

      <Card>
        <div style={{ marginBottom: 16 }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingRecord(null);
              form.resetFields();
              setModalVisible(true);
            }}
            disabled={!therapistProfileId}
            size="large"
          >
            Add Time Off
          </Button>
        </div>

        <Table
          dataSource={timeOff}
          columns={columns}
          rowKey="id"
          pagination={false}
        />
      </Card>

      <Modal
        title={editingRecord ? "Edit Time Off" : "Add Time Off"}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingRecord(null);
          form.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form form={form} onFinish={handleSubmit} layout="vertical">
          <Form.Item
            label="Date Range"
            name="dates"
            rules={[{ required: true, message: 'Please select date range' }]}
          >
            <RangePicker size="large" style={{ width: '100%' }} />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Start Time (Optional)" name="start_time">
                <TimePicker
                  format="h:mm A"
                  use12Hours
                  minuteStep={15}
                  size="large"
                  placeholder="All day if empty"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="End Time (Optional)" name="end_time">
                <TimePicker
                  format="h:mm A"
                  use12Hours
                  minuteStep={15}
                  size="large"
                  placeholder="All day if empty"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Reason (Optional)" name="reason">
            <TextArea rows={3} placeholder="Vacation, personal, etc." />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" size="large" block>
              {editingRecord ? 'Update Time Off' : 'Add Time Off'}
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
