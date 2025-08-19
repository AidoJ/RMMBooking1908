import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Select,
  Button,
  Row,
  Col,
  InputNumber,
  Switch,
  message,
  Spin,
  Typography,
  Space,
  Upload,
  Tabs,
  TimePicker,
  DatePicker,
  Table,
  Modal
} from 'antd';
import {
  UserOutlined,
  SaveOutlined,
  ArrowLeftOutlined,
  CameraOutlined,
  EnvironmentOutlined,
  PhoneOutlined,
  MailOutlined,
  PlusOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import { useGetIdentity } from '@refinedev/core';
import { useParams, useNavigate } from 'react-router';
import { supabaseClient } from '../../utility';
import dayjs from 'dayjs';

const { Title } = Typography;
const { TextArea } = Input;
const { Option } = Select;
const { TabPane } = Tabs;
const { RangePicker } = DatePicker;

interface TherapistProfile {
  id?: string;
  user_id?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  bio?: string;
  profile_pic?: string;
  home_address?: string;
  latitude?: number;
  longitude?: number;
  service_radius_km?: number;
  is_active: boolean;
  gender?: string;
  years_experience?: number;
  rating?: number;
  total_reviews?: number;
  business_abn: string;
  address_verified?: boolean;
}

interface AvailabilitySlot {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

interface TimeOff {
  id?: string;
  start_date: string;
  end_date: string;
  start_time?: string;
  end_time?: string;
  reason?: string;
  is_active: boolean;
}

const TherapistProfileManagement: React.FC = () => {
  const [form] = Form.useForm();
  const [availabilityForm] = Form.useForm();
  const [timeOffForm] = Form.useForm();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: identity } = useGetIdentity<any>();
  
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(!!id);
  const [profile, setProfile] = useState<TherapistProfile | null>(null);
  const [fileList, setFileList] = useState<any[]>([]);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [timeOff, setTimeOff] = useState<TimeOff[]>([]);
  const [availabilityModalVisible, setAvailabilityModalVisible] = useState(false);
  const [timeOffModalVisible, setTimeOffModalVisible] = useState(false);

  const isAdmin = identity?.role === 'admin' || identity?.role === 'super_admin';
  const isTherapist = identity?.role === 'therapist';

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  useEffect(() => {
    if (id) {
      // Admin editing a specific therapist by ID
      loadProfileById(id);
    } else if (isTherapist && identity?.id) {
      // Therapist editing their own profile - lookup by user_id
      loadProfileByUserId(identity.id);
    } else {
      setInitialLoading(false);
    }
    loadGoogleMaps();
  }, [id, identity]);

  const loadGoogleMaps = () => {
    if (!(window as any).google) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&libraries=places`;
      script.onload = () => {
        setupAddressAutocomplete();
      };
      document.head.appendChild(script);
    } else {
      setupAddressAutocomplete();
    }
  };

  const setupAddressAutocomplete = () => {
    setTimeout(() => {
      const addressInput = document.getElementById('home_address');
      if (!addressInput || !(window as any).google) return;

      const autocomplete = new (window as any).google.maps.places.Autocomplete(addressInput, {
        types: ['address'],
        componentRestrictions: { country: 'AU' },
        fields: ['address_components', 'formatted_address', 'geometry']
      });

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (place.geometry) {
          form.setFieldsValue({
            home_address: place.formatted_address,
            latitude: place.geometry.location.lat(),
            longitude: place.geometry.location.lng(),
            address_verified: true
          });
          message.success('Address verified and coordinates saved!');
        }
      });
    }, 100);
  };

  const loadProfileById = async (profileId: string) => {
    try {
      setInitialLoading(true);

      const { data, error } = await supabaseClient
        .from('therapist_profiles')
        .select('*')
        .eq('id', profileId)
        .single();

      if (error) throw error;

      setProfile(data);
      form.setFieldsValue(data);

      if (data.profile_pic) {
        setFileList([{
          uid: '1',
          name: 'profile.jpg',
          status: 'done',
          url: data.profile_pic
        }]);
      }

      await loadAvailability(data.id);
      await loadTimeOff(data.id);

    } catch (error: any) {
      console.error('Error loading profile:', error);
      message.error('Failed to load profile');
    } finally {
      setInitialLoading(false);
    }
  };

  const loadProfileByUserId = async (userId: string) => {
    try {
      setInitialLoading(true);

      const { data, error } = await supabaseClient
        .from('therapist_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          console.log('No existing profile found for user - creating new profile');
          setInitialLoading(false);
          return;
        }
        throw error;
      }

      setProfile(data);
      form.setFieldsValue(data);

      if (data.profile_pic) {
        setFileList([{
          uid: '1',
          name: 'profile.jpg',
          status: 'done',
          url: data.profile_pic
        }]);
      }

      await loadAvailability(data.id);
      await loadTimeOff(data.id);

    } catch (error: any) {
      console.error('Error loading profile:', error);
      message.error('Failed to load profile');
    } finally {
      setInitialLoading(false);
    }
  };

  const loadAvailability = async (therapistId: string) => {
    try {
      const { data, error } = await supabaseClient
        .from('therapist_availability')
        .select('*')
        .eq('therapist_id', therapistId)
        .order('day_of_week');

      if (error) throw error;
      setAvailability(data || []);
    } catch (error) {
      console.error('Error loading availability:', error);
    }
  };

  const loadTimeOff = async (therapistId: string) => {
    try {
      const { data, error } = await supabaseClient
        .from('therapist_time_off')
        .select('*')
        .eq('therapist_id', therapistId)
        .eq('is_active', true)
        .order('start_date');

      if (error) throw error;
      setTimeOff(data || []);
    } catch (error) {
      console.error('Error loading time off:', error);
    }
  };

  const handleImageUpload = async (file: any) => {
    try {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    } catch (error) {
      console.error('Error processing image:', error);
      throw error;
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      setLoading(true);

      let profilePicUrl = values.profile_pic;

      if (fileList.length > 0 && fileList[0].originFileObj) {
        profilePicUrl = await handleImageUpload(fileList[0].originFileObj);
      }

      const profileData = {
        ...values,
        profile_pic: profilePicUrl
      };

      let savedProfile;

      if (profile?.id) {
        const { data, error } = await supabaseClient
          .from('therapist_profiles')
          .update(profileData)
          .eq('id', profile.id)
          .select()
          .single();

        if (error) throw error;
        savedProfile = data;
      } else {
        const newProfileData = {
          ...profileData,
          user_id: identity?.id
        };

        const { data, error } = await supabaseClient
          .from('therapist_profiles')
          .insert([newProfileData])
          .select()
          .single();

        if (error) throw error;
        savedProfile = data;
      }

      message.success(`Profile ${profile?.id ? 'updated' : 'created'} successfully!`);
      setProfile(savedProfile);

      if (profileData.latitude && profileData.longitude) {
        message.success('Location coordinates saved for proximity matching!');
      }

    } catch (error: any) {
      console.error('Error saving profile:', error);
      message.error('Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAvailability = async (values: any) => {
    if (!profile?.id) {
      message.error('Please save the profile first before adding availability');
      return;
    }

    try {
      const availabilityData = {
        therapist_id: profile.id,
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
      setAvailabilityModalVisible(false);
      availabilityForm.resetFields();
      message.success('Availability added successfully!');
    } catch (error) {
      console.error('Error adding availability:', error);
      message.error('Failed to add availability');
    }
  };

  const handleDeleteAvailability = async (id: string) => {
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

  const handleAddTimeOff = async (values: any) => {
    if (!profile?.id) {
      message.error('Please save the profile first before adding time off');
      return;
    }

    try {
      const timeOffData = {
        therapist_id: profile.id,
        start_date: values.dates[0].format('YYYY-MM-DD'),
        end_date: values.dates[1].format('YYYY-MM-DD'),
        start_time: values.start_time?.format('HH:mm:ss'),
        end_time: values.end_time?.format('HH:mm:ss'),
        reason: values.reason,
        is_active: true
      };

      const { data, error } = await supabaseClient
        .from('therapist_time_off')
        .insert([timeOffData])
        .select()
        .single();

      if (error) throw error;

      setTimeOff([...timeOff, data]);
      setTimeOffModalVisible(false);
      timeOffForm.resetFields();
      message.success('Time off added successfully!');
    } catch (error) {
      console.error('Error adding time off:', error);
      message.error('Failed to add time off');
    }
  };

  const handleDeleteTimeOff = async (id: string) => {
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

  const handleBack = () => {
    if (isAdmin && id) {
      navigate('/therapists');
    } else {
      navigate('/dashboard');
    }
  };

  const uploadProps = {
    name: 'file',
    listType: 'picture-card' as const,
    fileList: fileList,
    beforeUpload: () => false,
    onChange: ({ fileList: newFileList }: any) => {
      setFileList(newFileList);
    },
    onPreview: (file: any) => {
      const src = file.url || file.preview;
      if (src) {
        const imgWindow = window.open(src);
        imgWindow?.document.write(`<img src="${src}" style="width: 100%;" />`);
      }
    }
  };

  const availabilityColumns = [
    {
      title: 'Day',
      dataIndex: 'day_of_week',
      key: 'day_of_week',
      render: (day: number) => dayNames[day]
    },
    {
      title: 'Start Time',
      dataIndex: 'start_time',
      key: 'start_time',
      render: (time: string) => dayjs(time, 'HH:mm:ss').format('h:mm A')
    },
    {
      title: 'End Time',
      dataIndex: 'end_time',
      key: 'end_time',
      render: (time: string) => dayjs(time, 'HH:mm:ss').format('h:mm A')
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: AvailabilitySlot) => (
        <Button 
          danger 
          size="small" 
          icon={<DeleteOutlined />}
          onClick={() => handleDeleteAvailability(record.id!)}
        >
          Remove
        </Button>
      )
    }
  ];

  const timeOffColumns = [
    {
      title: 'Start Date',
      dataIndex: 'start_date',
      key: 'start_date',
      render: (date: string) => dayjs(date).format('MMM DD, YYYY')
    },
    {
      title: 'End Date',
      dataIndex: 'end_date',
      key: 'end_date',
      render: (date: string) => dayjs(date).format('MMM DD, YYYY')
    },
    {
      title: 'Time',
      key: 'time',
      render: (_: any, record: TimeOff) => {
        if (record.start_time && record.end_time) {
          return `${dayjs(record.start_time, 'HH:mm:ss').format('h:mm A')} - ${dayjs(record.end_time, 'HH:mm:ss').format('h:mm A')}`;
        }
        return 'All Day';
      }
    },
    {
      title: 'Reason',
      dataIndex: 'reason',
      key: 'reason'
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: TimeOff) => (
        <Button 
          danger 
          size="small" 
          icon={<DeleteOutlined />}
          onClick={() => handleDeleteTimeOff(record.id!)}
        >
          Remove
        </Button>
      )
    }
  ];

  if (initialLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Button 
              icon={<ArrowLeftOutlined />} 
              onClick={handleBack}
              style={{ marginBottom: '16px' }}
            >
              Back
            </Button>
            <Title level={2} style={{ margin: 0 }}>
              {profile?.id ? 'Edit Therapist Profile' : 'Create Therapist Profile'}
            </Title>
          </div>

          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={{
              is_active: true,
              service_radius_km: 50,
              gender: 'prefer_not_to_say',
              rating: 0,
              total_reviews: 0,
              address_verified: false
            }}
          >
            <Tabs defaultActiveKey="personal">
              <TabPane tab="Personal Info" key="personal">
                <Row gutter={24}>
                  <Col span={24} style={{ textAlign: 'center', marginBottom: 24 }}>
                    <Form.Item label="Profile Photo">
                      <Upload {...uploadProps}>
                        {fileList.length >= 1 ? null : (
                          <div>
                            <CameraOutlined style={{ fontSize: 24, marginBottom: 8 }} />
                            <div>Upload Photo</div>
                          </div>
                        )}
                      </Upload>
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={24}>
                  <Col span={12}>
                    <Form.Item
                      label="First Name"
                      name="first_name"
                      rules={[{ required: true, message: 'Please enter first name' }]}
                    >
                      <Input prefix={<UserOutlined />} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      label="Last Name"
                      name="last_name"
                      rules={[{ required: true, message: 'Please enter last name' }]}
                    >
                      <Input />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={24}>
                  <Col span={12}>
                    <Form.Item
                      label="Email"
                      name="email"
                      rules={[
                        { required: true, message: 'Please enter email' },
                        { type: 'email', message: 'Please enter valid email' }
                      ]}
                    >
                      <Input prefix={<MailOutlined />} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="Phone" name="phone">
                      <Input prefix={<PhoneOutlined />} />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={24}>
                  <Col span={12}>
                    <Form.Item label="Gender" name="gender">
                      <Select>
                        <Option value="male">Male</Option>
                        <Option value="female">Female</Option>
                        <Option value="other">Other</Option>
                        <Option value="prefer_not_to_say">Prefer not to say</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="Years of Experience" name="years_experience">
                      <InputNumber min={0} max={50} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item
                  label="Business ABN"
                  name="business_abn"
                  rules={[
                    { required: true, message: 'Please enter business ABN' },
                    { pattern: /^\d{11}$/, message: 'ABN must be exactly 11 digits' }
                  ]}
                >
                  <Input placeholder="11 digit ABN number" />
                </Form.Item>

                <Form.Item label="Bio" name="bio">
                  <TextArea 
                    rows={4} 
                    placeholder="Tell customers about yourself, your specialties, and your approach to massage therapy..." 
                  />
                </Form.Item>

                <Form.Item label="Active Status" name="is_active" valuePropName="checked">
                  <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
                </Form.Item>
              </TabPane>

              <TabPane tab="Location & Service Area" key="location">
                <Form.Item 
                  label="Home Address" 
                  name="home_address"
                  help="Start typing your address and select from the dropdown for automatic location verification"
                >
                  <Input 
                    id="home_address"
                    prefix={<EnvironmentOutlined />}
                    placeholder="Start typing your address..."
                    onFocus={setupAddressAutocomplete}
                  />
                </Form.Item>

                <Row gutter={24}>
                  <Col span={8}>
                    <Form.Item label="Latitude" name="latitude">
                      <InputNumber 
                        style={{ width: '100%' }} 
                        step={0.000001}
                        precision={6}
                        disabled
                        placeholder="Auto-filled"
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="Longitude" name="longitude">
                      <InputNumber 
                        style={{ width: '100%' }} 
                        step={0.000001}
                        precision={6}
                        disabled
                        placeholder="Auto-filled"
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="Service Radius (km)" name="service_radius_km">
                      <InputNumber min={1} max={200} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item label="Address Verified" name="address_verified" valuePropName="checked">
                  <Switch 
                    checkedChildren="Verified" 
                    unCheckedChildren="Not Verified"
                    disabled
                  />
                </Form.Item>
              </TabPane>

              <TabPane tab="Availability" key="availability">
                <div style={{ marginBottom: 16 }}>
                  <Button 
                    type="primary" 
                    icon={<PlusOutlined />}
                    onClick={() => setAvailabilityModalVisible(true)}
                    disabled={!profile?.id}
                  >
                    Add Availability
                  </Button>
                  {!profile?.id && (
                    <div style={{ marginTop: 8, color: '#999' }}>
                      Please save the profile first before adding availability
                    </div>
                  )}
                </div>
                
                <Table 
                  dataSource={availability} 
                  columns={availabilityColumns}
                  rowKey="id"
                  pagination={false}
                />
              </TabPane>

              <TabPane tab="Time Off" key="timeoff">
                <div style={{ marginBottom: 16 }}>
                  <Button 
                    type="primary" 
                    icon={<PlusOutlined />}
                    onClick={() => setTimeOffModalVisible(true)}
                    disabled={!profile?.id}
                  >
                    Add Time Off
                  </Button>
                  {!profile?.id && (
                    <div style={{ marginTop: 8, color: '#999' }}>
                      Please save the profile first before adding time off
                    </div>
                  )}
                </div>
                
                <Table 
                  dataSource={timeOff} 
                  columns={timeOffColumns}
                  rowKey="id"
                  pagination={false}
                />
              </TabPane>

              <TabPane tab="Performance" key="performance">
                <Row gutter={24}>
                  <Col span={12}>
                    <Form.Item label="Rating" name="rating">
                      <InputNumber 
                        min={0} 
                        max={5} 
                        step={0.1}
                        style={{ width: '100%' }}
                        disabled
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="Total Reviews" name="total_reviews">
                      <InputNumber 
                        min={0}
                        style={{ width: '100%' }}
                        disabled
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </TabPane>
            </Tabs>

            <div style={{ marginTop: '32px', textAlign: 'right' }}>
              <Button size="large" style={{ marginRight: '8px' }} onClick={handleBack}>
                Cancel
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                loading={loading}
                icon={<SaveOutlined />}
              >
                {profile?.id ? 'Save Changes' : 'Create Profile'}
              </Button>
            </div>
          </Form>
        </Space>
      </Card>

      <Modal
        title="Add Availability"
        open={availabilityModalVisible}
        onCancel={() => setAvailabilityModalVisible(false)}
        footer={null}
      >
        <Form form={availabilityForm} onFinish={handleAddAvailability} layout="vertical">
          <Form.Item
            label="Day of Week"
            name="day_of_week"
            rules={[{ required: true, message: 'Please select a day' }]}
          >
            <Select>
              {dayNames.map((day, index) => (
                <Option key={index} value={index}>{day}</Option>
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
                <TimePicker format="HH:mm" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="End Time"
                name="end_time"
                rules={[{ required: true, message: 'Please select end time' }]}
              >
                <TimePicker format="HH:mm" />
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item>
            <Button type="primary" htmlType="submit">
              Add Availability
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Add Time Off"
        open={timeOffModalVisible}
        onCancel={() => setTimeOffModalVisible(false)}
        footer={null}
      >
        <Form form={timeOffForm} onFinish={handleAddTimeOff} layout="vertical">
          <Form.Item
            label="Date Range"
            name="dates"
            rules={[{ required: true, message: 'Please select date range' }]}
          >
            <RangePicker />
          </Form.Item>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Start Time (Optional)" name="start_time">
                <TimePicker format="HH:mm" placeholder="All day if empty" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="End Time (Optional)" name="end_time">
                <TimePicker format="HH:mm" placeholder="All day if empty" />
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item label="Reason" name="reason">
            <TextArea rows={3} placeholder="Reason for time off (optional)" />
          </Form.Item>
          
          <Form.Item>
            <Button type="primary" htmlType="submit">
              Add Time Off
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TherapistProfileManagement;
