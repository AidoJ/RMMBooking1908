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
  App,
  Spin,
  Typography,
  Upload,
  DatePicker,
  Divider,
} from 'antd';
import {
  UserOutlined,
  SaveOutlined,
  CameraOutlined,
  PhoneOutlined,
  MailOutlined,
  UploadOutlined,
  BankOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
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
  insurance_expiry_date?: string;
  insurance_certificate_url?: string;
  first_aid_expiry_date?: string;
  first_aid_certificate_url?: string;
  qualification_certificate_url?: string;
  bank_account_name?: string;
  bsb?: string;
  bank_account_number?: string;
  hourly_rate?: number;
  afterhours_rate?: number;
}

export const Profile: React.FC = () => {
  const { message } = App.useApp(); // Use v5-correct message API
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [profile, setProfile] = useState<TherapistProfile | null>(null);
  const [fileList, setFileList] = useState<any[]>([]);
  const [insuranceCertFile, setInsuranceCertFile] = useState<any[]>([]);
  const [firstAidCertFile, setFirstAidCertFile] = useState<any[]>([]);
  const [qualificationCertFile, setQualificationCertFile] = useState<any[]>([]);

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

        // Convert date fields to dayjs objects for the form
        const formData = {
          ...data,
          insurance_expiry_date: data.insurance_expiry_date ? dayjs(data.insurance_expiry_date) : undefined,
          first_aid_expiry_date: data.first_aid_expiry_date ? dayjs(data.first_aid_expiry_date) : undefined,
        };

        form.setFieldsValue(formData);

        if (data.profile_pic) {
          setFileList([{
            uid: '1',
            name: 'profile.jpg',
            status: 'done',
            url: data.profile_pic
          }]);
        }

        if (data.insurance_certificate_url) {
          setInsuranceCertFile([{
            uid: '1',
            name: 'insurance_certificate.pdf',
            status: 'done',
            url: data.insurance_certificate_url
          }]);
        }

        if (data.first_aid_certificate_url) {
          setFirstAidCertFile([{
            uid: '1',
            name: 'first_aid_certificate.pdf',
            status: 'done',
            url: data.first_aid_certificate_url
          }]);
        }

        if (data.qualification_certificate_url) {
          setQualificationCertFile([{
            uid: '1',
            name: 'qualification_certificate.pdf',
            status: 'done',
            url: data.qualification_certificate_url
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
      let insuranceCertUrl = values.insurance_certificate_url;
      let firstAidCertUrl = values.first_aid_certificate_url;
      let qualificationCertUrl = values.qualification_certificate_url;

      // Handle profile picture upload
      if (fileList.length > 0 && fileList[0].originFileObj) {
        profilePicUrl = await handleImageUpload(fileList[0].originFileObj);
      }

      // Handle insurance certificate upload
      if (insuranceCertFile.length > 0 && insuranceCertFile[0].originFileObj) {
        insuranceCertUrl = await handleImageUpload(insuranceCertFile[0].originFileObj);
      }

      // Handle first aid certificate upload
      if (firstAidCertFile.length > 0 && firstAidCertFile[0].originFileObj) {
        firstAidCertUrl = await handleImageUpload(firstAidCertFile[0].originFileObj);
      }

      // Handle qualification certificate upload
      if (qualificationCertFile.length > 0 && qualificationCertFile[0].originFileObj) {
        qualificationCertUrl = await handleImageUpload(qualificationCertFile[0].originFileObj);
      }

      const profileData = {
        ...values,
        profile_pic: profilePicUrl,
        insurance_certificate_url: insuranceCertUrl,
        first_aid_certificate_url: firstAidCertUrl,
        qualification_certificate_url: qualificationCertUrl,
        // Convert dayjs objects back to strings for database
        insurance_expiry_date: values.insurance_expiry_date ? values.insurance_expiry_date.format('YYYY-MM-DD') : null,
        first_aid_expiry_date: values.first_aid_expiry_date ? values.first_aid_expiry_date.format('YYYY-MM-DD') : null,
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

      setProfile(savedProfile);

      // Update localStorage with new profile data
      const updatedUser = { ...userData, ...savedProfile };
      localStorage.setItem('therapistUser', JSON.stringify(updatedUser));

      // Show success message with longer duration
      message.success({
        content: 'Your profile has been updated successfully!',
        duration: 3,
      });

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
          onFinishFailed={({ errorFields }) => {
            if (errorFields && errorFields.length > 0) {
              form.scrollToField(errorFields[0].name);
              message.error('Please fix the highlighted fields before saving.');
            }
          }}
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
              { pattern: /^\d{11}$/, message: 'ABN must be exactly 11 digits (no spaces)' }
            ]}
            help="Enter 11 digits only, no spaces or dashes"
          >
            <Input placeholder="12345678901" maxLength={11} />
          </Form.Item>

          <Form.Item label="Bio" name="bio">
            <TextArea
              rows={4}
              placeholder="Tell customers about yourself, your specialties, and your approach to massage therapy..."
            />
          </Form.Item>

          <Divider orientation="left">Certificates & Compliance</Divider>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Insurance Expiry Date"
                name="insurance_expiry_date"
              >
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Insurance Certificate">
                <Upload
                  listType="text"
                  fileList={insuranceCertFile}
                  beforeUpload={() => false}
                  onChange={({ fileList }) => setInsuranceCertFile(fileList)}
                  maxCount={1}
                  accept=".pdf,.jpg,.jpeg,.png"
                >
                  <Button icon={<UploadOutlined />}>Upload Certificate</Button>
                </Upload>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="First Aid Expiry Date"
                name="first_aid_expiry_date"
              >
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="First Aid Certificate">
                <Upload
                  listType="text"
                  fileList={firstAidCertFile}
                  beforeUpload={() => false}
                  onChange={({ fileList }) => setFirstAidCertFile(fileList)}
                  maxCount={1}
                  accept=".pdf,.jpg,.jpeg,.png"
                >
                  <Button icon={<UploadOutlined />}>Upload Certificate</Button>
                </Upload>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Therapist Qualification Certificate">
            <Upload
              listType="text"
              fileList={qualificationCertFile}
              beforeUpload={() => false}
              onChange={({ fileList }) => setQualificationCertFile(fileList)}
              maxCount={1}
              accept=".pdf,.jpg,.jpeg,.png"
            >
              <Button icon={<UploadOutlined />}>Upload Certificate</Button>
            </Upload>
          </Form.Item>

          <Divider orientation="left">Banking Details</Divider>

          <Form.Item
            label="Bank Account Name"
            name="bank_account_name"
          >
            <Input prefix={<BankOutlined />} placeholder="Account holder name" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="BSB"
                name="bsb"
                rules={[
                  { pattern: /^\d{3}-?\d{3}$/, message: 'BSB must be in format XXX-XXX or XXXXXX' }
                ]}
              >
                <Input placeholder="XXX-XXX" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Bank Account Number"
                name="bank_account_number"
              >
                <Input placeholder="Account number" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">Hourly Rates</Divider>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Hourly Rate" name="hourly_rate">
                <InputNumber
                  prefix={<DollarOutlined />}
                  style={{ width: '100%' }}
                  min={0}
                  step={0.01}
                  disabled
                  placeholder="Set by admin"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="After Hours Rate" name="afterhours_rate">
                <InputNumber
                  prefix={<DollarOutlined />}
                  style={{ width: '100%' }}
                  min={0}
                  step={0.01}
                  disabled
                  placeholder="Set by admin"
                />
              </Form.Item>
            </Col>
          </Row>

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
