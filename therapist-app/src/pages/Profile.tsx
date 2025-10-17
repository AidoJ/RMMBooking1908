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
  message,
  Spin,
  Typography,
  Upload,
} from 'antd';
import {
  UserOutlined,
  SaveOutlined,
  CameraOutlined,
  PhoneOutlined,
  MailOutlined,
} from '@ant-design/icons';
import { supabaseClient } from '../utility/supabaseClient';

const { Title } = Typography;
const { TextArea } = Input;
const { Option } = Select;

interface TherapistProfile {
  id?: string;
  user_id?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  bio?: string;
  profile_pic?: string;
  gender?: string;
  years_experience?: number;
  business_abn: string;
}

export const Profile: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [profile, setProfile] = useState<TherapistProfile | null>(null);
  const [fileList, setFileList] = useState<any[]>([]);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setInitialLoading(true);

      // Get user data from localStorage
      const userStr = localStorage.getItem('therapistUser');
      if (!userStr) {
        message.error('Please log in again');
        return;
      }

      const userData = JSON.parse(userStr);
      const userId = userData.user_id || userData.id;

      const { data, error } = await supabaseClient
        .from('therapist_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
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
      }
    } catch (error: any) {
      console.error('Error loading profile:', error);
      message.error('Failed to load profile');
    } finally {
      setInitialLoading(false);
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
        profile_pic: profilePicUrl,
      };

      const userStr = localStorage.getItem('therapistUser');
      if (!userStr) {
        message.error('Please log in again');
        return;
      }

      const userData = JSON.parse(userStr);
      const userId = userData.user_id || userData.id;

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
          user_id: userId
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

      // Update localStorage with new profile data
      const updatedUser = { ...userData, ...savedProfile };
      localStorage.setItem('therapistUser', JSON.stringify(updatedUser));

    } catch (error: any) {
      console.error('Error saving profile:', error);
      message.error('Failed to save profile');
    } finally {
      setLoading(false);
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

  if (initialLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <Title level={2}>My Profile</Title>

      <Card>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            gender: 'prefer_not_to_say',
          }}
        >
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

          <Row gutter={16}>
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

          <Row gutter={16}>
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

          <Row gutter={16}>
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

          <div style={{ textAlign: 'right' }}>
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
      </Card>
    </div>
  );
};
