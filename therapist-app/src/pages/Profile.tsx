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
  LockOutlined,
  StarFilled,
  StarOutlined,
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
  timezone?: string;
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

interface TherapistReview {
  id: string;
  reviewer_name: string;
  rating: number;
  review_text: string;
  review_date: string;
  is_active: boolean;
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
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordForm] = Form.useForm();
  const [reviews, setReviews] = useState<TherapistReview[]>([]);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setInitialLoading(true);

      // Get therapist profile from localStorage
      const profileStr = localStorage.getItem('therapist_profile');
      if (!profileStr) {
        message.error('Please log in again');
        setInitialLoading(false);
        return;
      }

      const storedProfile = JSON.parse(profileStr);
      if (!storedProfile || !storedProfile.id) {
        message.error('Invalid therapist profile');
        setInitialLoading(false);
        return;
      }

      // Get latest profile data from database
      const { data, error } = await supabaseClient
        .from('therapist_profiles')
        .select('*')
        .eq('id', storedProfile.id)
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

        // Load reviews
        await loadReviews(data.id);
      }
    } catch (error: any) {
      console.error('Error loading profile:', error);
      message.error('Failed to load profile');
    } finally {
      setInitialLoading(false);
    }
  };

  const loadReviews = async (therapistId: string) => {
    try {
      const { data, error } = await supabaseClient
        .from('therapist_reviews')
        .select('*')
        .eq('therapist_id', therapistId)
        .eq('is_active', true)
        .order('review_date', { ascending: false });

      if (error) throw error;
      setReviews(data || []);
    } catch (error) {
      console.error('Error loading reviews:', error);
    }
  };

  const handleFileUploadToStorage = async (file: any, fieldName: string): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('fieldName', fieldName);

    const response = await fetch('/.netlify/functions/therapist-registration-upload', {
      method: 'POST',
      body: formData
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result?.error || 'File upload failed');
    }

    return result.url;
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
        profilePicUrl = await handleFileUploadToStorage(fileList[0].originFileObj, 'profilePhoto');
      }

      // Handle insurance certificate upload
      if (insuranceCertFile.length > 0 && insuranceCertFile[0].originFileObj) {
        insuranceCertUrl = await handleFileUploadToStorage(insuranceCertFile[0].originFileObj, 'insuranceCert');
      }

      // Handle first aid certificate upload
      if (firstAidCertFile.length > 0 && firstAidCertFile[0].originFileObj) {
        firstAidCertUrl = await handleFileUploadToStorage(firstAidCertFile[0].originFileObj, 'firstAidCert');
      }

      // Handle qualification certificate upload
      if (qualificationCertFile.length > 0 && qualificationCertFile[0].originFileObj) {
        qualificationCertUrl = await handleFileUploadToStorage(qualificationCertFile[0].originFileObj, 'qualifications');
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

      // Get therapist profile from localStorage
      const profileStr = localStorage.getItem('therapist_profile');
      if (!profileStr) {
        message.error('Please log in again');
        return;
      }

      const storedProfile = JSON.parse(profileStr);
      if (!storedProfile || !storedProfile.id) {
        message.error('Invalid therapist profile');
        return;
      }

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
        // If no profile.id, use stored profile id
        const newProfileData = {
          ...profileData,
          auth_id: storedProfile.auth_id || storedProfile.id
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

      // Update localStorage with new profile data (exclude large fields to avoid QuotaExceededError)
      const { profile_pic, insurance_certificate_url, first_aid_certificate_url, qualification_certificate_url, qualification_certificates, service_area_polygon, ...profileForStorage } = savedProfile as any;
      localStorage.setItem('therapist_profile', JSON.stringify(profileForStorage));

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

  const handlePasswordChange = async (values: any) => {
    try {
      setChangingPassword(true);

      // Get therapist profile from localStorage
      const profileStr = localStorage.getItem('therapist_profile');
      if (!profileStr) {
        message.error('Please log in again');
        return;
      }

      const profile = JSON.parse(profileStr);
      if (!profile || !profile.auth_id) {
        message.error('Invalid therapist profile');
        return;
      }

      // Get Supabase Auth session token
      const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
      if (sessionError || !session) {
        throw new Error('Not authenticated. Please log in again.');
      }

      // Call password update function
      const response = await fetch('/.netlify/functions/update-therapist-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          new_password: values.new_password
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update password');
      }

      message.success('Password updated successfully!');
      passwordForm.resetFields();
    } catch (error: any) {
      console.error('Error changing password:', error);
      message.error(error.message || 'Failed to change password');
    } finally {
      setChangingPassword(false);
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

          <Form.Item
            label="Timezone"
            name="timezone"
            rules={[{ required: true, message: 'Please select your service area timezone' }]}
            help="Select the timezone where you provide services (this helps with accurate scheduling)"
          >
            <Select placeholder="Select your service area timezone">
              <Option value="Australia/Perth">Australia/Perth (AWST, UTC+8, no DST)</Option>
              <Option value="Australia/Adelaide">Australia/Adelaide (ACST/ACDT, UTC+9:30/+10:30)</Option>
              <Option value="Australia/Darwin">Australia/Darwin (ACST, UTC+9:30, no DST)</Option>
              <Option value="Australia/Brisbane">Australia/Brisbane (AEST, UTC+10, no DST)</Option>
              <Option value="Australia/Sydney">Australia/Sydney (AEST/AEDT, UTC+10/+11)</Option>
              <Option value="Australia/Melbourne">Australia/Melbourne (AEST/AEDT, UTC+10/+11)</Option>
              <Option value="Australia/Hobart">Australia/Hobart (AEST/AEDT, UTC+10/+11)</Option>
            </Select>
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

      <Card title="Change Password" style={{ marginTop: 24 }}>
        <Form
          form={passwordForm}
          layout="vertical"
          onFinish={handlePasswordChange}
        >
          <Form.Item
            label="Current Password"
            name="current_password"
            rules={[{ required: true, message: 'Please enter your current password' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Enter current password" />
          </Form.Item>

          <Form.Item
            label="New Password"
            name="new_password"
            rules={[
              { required: true, message: 'Please enter new password' },
              { min: 8, message: 'Password must be at least 8 characters' },
              {
                pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                message: 'Password must contain uppercase, lowercase, and numbers'
              }
            ]}
            help="At least 8 characters, including uppercase, lowercase, and numbers"
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Enter new password" />
          </Form.Item>

          <Form.Item
            label="Confirm New Password"
            name="confirm_password"
            dependencies={['new_password']}
            rules={[
              { required: true, message: 'Please confirm your new password' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('new_password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Passwords do not match'));
                },
              }),
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Confirm new password" />
          </Form.Item>

          <div style={{ textAlign: 'right' }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={changingPassword}
              icon={<LockOutlined />}
            >
              Change Password
            </Button>
          </div>
        </Form>
      </Card>

      <Card
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>My Reviews</span>
            <span style={{ fontSize: 14, fontWeight: 'normal', color: '#666' }}>
              {reviews.length} review{reviews.length !== 1 ? 's' : ''}
            </span>
          </div>
        }
        style={{ marginTop: 24 }}
      >
        {reviews.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
            <StarOutlined style={{ fontSize: 48, marginBottom: 16 }} />
            <p>No reviews yet</p>
            <p style={{ fontSize: 12 }}>Reviews from Google that mention you will appear here</p>
          </div>
        ) : (
          <div>
            {reviews.map((review) => (
              <div
                key={review.id}
                style={{
                  padding: 16,
                  marginBottom: 16,
                  border: '1px solid #f0f0f0',
                  borderRadius: 8,
                  backgroundColor: '#fafafa'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontWeight: 'bold' }}>{review.reviewer_name}</span>
                  <span style={{ color: '#999', fontSize: 12 }}>
                    {dayjs(review.review_date).format('MMM DD, YYYY')}
                  </span>
                </div>
                <div style={{ marginBottom: 8, color: '#faad14' }}>
                  {[...Array(5)].map((_, i) => (
                    i < review.rating
                      ? <StarFilled key={i} />
                      : <StarOutlined key={i} style={{ color: '#d9d9d9' }} />
                  ))}
                </div>
                <p style={{ margin: 0, color: '#333' }}>{review.review_text}</p>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 16, padding: 12, backgroundColor: '#e6f7ff', border: '1px solid #91d5ff', borderRadius: 4 }}>
          <p style={{ margin: 0, fontSize: 12, color: '#666' }}>
            💡 Reviews are managed by the admin team. If you have a Google review that mentions you, please contact the admin to have it added to your profile.
          </p>
        </div>
      </Card>
    </div>
  );
};
