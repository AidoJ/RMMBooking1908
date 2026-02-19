import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Descriptions,
  Space,
  Tag,
  message,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Row,
  Col,
  Typography,
  Divider,
  Image,
  Timeline,
  Alert,
  Spin,
  Popconfirm
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  UserAddOutlined,
  EditOutlined,
  FileTextOutlined,
  PhoneOutlined,
  MailOutlined,
  EnvironmentOutlined,
  SafetyCertificateOutlined,
  BankOutlined,
  CalendarOutlined,
  DownloadOutlined
} from '@ant-design/icons';
import { useGetIdentity, useNavigation, useShow } from '@refinedev/core';
import { RoleGuard } from '../../components/RoleGuard';
import { supabaseClient } from '../../utility';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

function formatTime(time: string): string {
  if (!time) return '';
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
}

interface TherapistRegistration {
  id: string;
  // Step 1: Personal Info
  first_name: string;
  last_name: string;
  date_of_birth: string;
  email: string;
  phone: string;
  street_address: string;
  suburb: string;
  city: string;
  state: string;
  postcode: string;
  profile_photo_url?: string;

  // Step 2: Business Details
  business_structure: string;
  business_name?: string;
  company_name?: string;
  company_acn?: string;
  business_abn: string;
  gst_registered: boolean;
  bank_account_name: string;
  bsb: string;
  bank_account_number: string;

  // Step 3: Service & Availability
  service_cities: string[];
  delivery_locations: string[];
  availability_schedule: Record<string, string[]> | Array<{ day_of_week: number; start_time: string; end_time: string }>;
  start_date?: string;

  // Step 4: Qualifications
  therapies_offered: string[];
  qualification_certificates: Array<{ url: string; filename: string }>;

  // Step 5: Insurance
  has_insurance: boolean;
  insurance_expiry_date?: string;
  insurance_certificate_url?: string;
  has_first_aid: boolean;
  first_aid_expiry_date?: string;
  first_aid_certificate_url?: string;
  work_eligibility_confirmed: boolean;

  // Step 6: Agreement
  agreement_read_confirmed: boolean;
  legal_advice_confirmed: boolean;
  contractor_relationship_confirmed: boolean;
  information_accurate_confirmed: boolean;
  terms_accepted_confirmed: boolean;
  signature_data?: string;
  signed_date?: string;
  full_legal_name?: string;
  agreement_version?: string;
  agreement_pdf_url?: string;

  // Workflow
  status: string;
  recruitment_status?: string;
  first_interview_scheduled_at?: string;
  first_interview_completed_at?: string;
  first_interview_notes?: string;
  second_interview_scheduled_at?: string;
  second_interview_completed_at?: string;
  second_interview_notes?: string;
  recruitment_notes?: string;

  submitted_at?: string;
  reviewed_at?: string;
  review_notes?: string;
  approved_at?: string;
  rejected_at?: string;
  rejection_reason?: string;
  enrolled_at?: string;
  therapist_profile_id?: string;

  created_at: string;
  updated_at: string;
}

const TherapistRegistrationShow: React.FC = () => {
  const [registration, setRegistration] = useState<TherapistRegistration | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [recruitmentModalVisible, setRecruitmentModalVisible] = useState(false);
  const [enrolling, setEnrolling] = useState(false);

  const [statusForm] = Form.useForm();
  const [recruitmentForm] = Form.useForm();

  const { data: identity } = useGetIdentity<any>();
  const { list, push } = useNavigation();
  const { queryResult } = useShow<TherapistRegistration>();

  const canManage = identity?.role === 'admin' || identity?.role === 'super_admin';

  useEffect(() => {
    if (queryResult?.data?.data) {
      setRegistration(queryResult.data.data as TherapistRegistration);
      setLoading(false);
    }
  }, [queryResult]);

  const updateStatus = async (values: any) => {
    try {
      const updateData: any = {
        status: values.status,
        updated_at: new Date().toISOString()
      };

      if (values.status === 'approved') {
        updateData.approved_at = new Date().toISOString();
      } else if (values.status === 'rejected') {
        updateData.rejected_at = new Date().toISOString();
        updateData.rejection_reason = values.rejection_reason;
      }

      if (values.review_notes) {
        updateData.review_notes = values.review_notes;
        updateData.reviewed_at = new Date().toISOString();
      }

      const { error } = await supabaseClient
        .from('therapist_registrations')
        .update(updateData)
        .eq('id', registration!.id);

      if (error) throw error;

      message.success('Status updated successfully');
      setStatusModalVisible(false);
      queryResult?.refetch();
    } catch (error: any) {
      console.error('Error updating status:', error);
      message.error('Failed to update status');
    }
  };

  const updateRecruitment = async (values: any) => {
    try {
      const updateData: any = {
        recruitment_status: values.recruitment_status,
        updated_at: new Date().toISOString()
      };

      if (values.first_interview_scheduled_at) {
        updateData.first_interview_scheduled_at = values.first_interview_scheduled_at.toISOString();
      }
      if (values.first_interview_completed_at) {
        updateData.first_interview_completed_at = values.first_interview_completed_at.toISOString();
      }
      if (values.first_interview_notes) {
        updateData.first_interview_notes = values.first_interview_notes;
      }
      if (values.second_interview_scheduled_at) {
        updateData.second_interview_scheduled_at = values.second_interview_scheduled_at.toISOString();
      }
      if (values.second_interview_completed_at) {
        updateData.second_interview_completed_at = values.second_interview_completed_at.toISOString();
      }
      if (values.second_interview_notes) {
        updateData.second_interview_notes = values.second_interview_notes;
      }
      if (values.recruitment_notes) {
        updateData.recruitment_notes = values.recruitment_notes;
      }

      // Update main status if moving to recruitment
      if (values.recruitment_status && registration!.status !== 'in_recruitment') {
        updateData.status = 'in_recruitment';
      }

      const { error } = await supabaseClient
        .from('therapist_registrations')
        .update(updateData)
        .eq('id', registration!.id);

      if (error) throw error;

      message.success('Recruitment status updated successfully');
      setRecruitmentModalVisible(false);
      queryResult?.refetch();
    } catch (error: any) {
      console.error('Error updating recruitment:', error);
      message.error('Failed to update recruitment status');
    }
  };

  const enrollTherapist = async () => {
    try {
      setEnrolling(true);

      // Call the enrollment Netlify function
      const response = await fetch('/.netlify/functions/enroll-therapist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          registrationId: registration!.id
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Enrollment failed');
      }

      message.success('Therapist enrolled successfully!');
      queryResult?.refetch();

      // Optionally redirect to therapist profile
      if (result.therapistProfileId) {
        Modal.success({
          title: 'Enrollment Successful',
          content: 'Therapist has been enrolled and credentials have been sent via email.',
          onOk: () => {
            push(`/therapists/show/${result.therapistProfileId}`);
          }
        });
      }
    } catch (error: any) {
      console.error('Error enrolling therapist:', error);
      message.error(error.message || 'Failed to enroll therapist');
    } finally {
      setEnrolling(false);
    }
  };

  if (loading || !registration) {
    return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'default',
      submitted: 'blue',
      under_review: 'orange',
      in_recruitment: 'purple',
      approved: 'green',
      rejected: 'red',
      enrolled: 'success'
    };
    return colors[status] || 'default';
  };

  return (
    <RoleGuard allowedRoles={['admin', 'super_admin']}>
      <div style={{ padding: '24px' }}>
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Space style={{ marginBottom: 16 }}>
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={() => list('therapist_registrations')}
              >
                Back to List
              </Button>
            </Space>
          </Col>

          <Col span={24}>
            <Card>
              <Row justify="space-between" align="middle">
                <Col>
                  <Title level={2} style={{ marginBottom: 8 }}>
                    {registration.first_name} {registration.last_name}
                  </Title>
                  <Space>
                    <Tag color={getStatusColor(registration.status)} style={{ fontSize: 14 }}>
                      {registration.status.replace('_', ' ').toUpperCase()}
                    </Tag>
                    {registration.recruitment_status && (
                      <Tag color="purple" style={{ fontSize: 14 }}>
                        {registration.recruitment_status.replace('_', ' ')}
                      </Tag>
                    )}
                  </Space>
                </Col>
                <Col>
                  <Space>
                    <Button
                      type="primary"
                      icon={<EditOutlined />}
                      onClick={() => setStatusModalVisible(true)}
                      disabled={!canManage}
                    >
                      Update Status
                    </Button>
                    <Button
                      icon={<CalendarOutlined />}
                      onClick={() => setRecruitmentModalVisible(true)}
                      disabled={!canManage || registration.status === 'enrolled'}
                    >
                      Recruitment
                    </Button>
                    {registration.status === 'approved' && !registration.therapist_profile_id && (
                      <Popconfirm
                        title="Enroll this therapist?"
                        description="This will create a therapist profile and send credentials via email."
                        onConfirm={enrollTherapist}
                        okText="Yes, Enroll"
                        cancelText="Cancel"
                      >
                        <Button
                          type="primary"
                          icon={<UserAddOutlined />}
                          loading={enrolling}
                          disabled={!canManage}
                          style={{ background: '#52c41a' }}
                        >
                          Enroll Therapist
                        </Button>
                      </Popconfirm>
                    )}
                    {registration.therapist_profile_id && (
                      <Button
                        type="primary"
                        onClick={() => push(`/therapists/show/${registration.therapist_profile_id}`)}
                      >
                        View Therapist Profile
                      </Button>
                    )}
                  </Space>
                </Col>
              </Row>
            </Card>
          </Col>

          {/* Personal Information */}
          <Col xs={24} lg={12}>
            <Card title={<><FileTextOutlined /> Personal Information</>}>
              {registration.profile_photo_url && (
                <div style={{ marginBottom: 16, textAlign: 'center' }}>
                  <Image
                    src={registration.profile_photo_url}
                    alt="Profile"
                    width={120}
                    height={120}
                    style={{ borderRadius: '50%', objectFit: 'cover' }}
                  />
                </div>
              )}
              <Descriptions column={1} bordered size="small">
                <Descriptions.Item label="Full Name">
                  {registration.first_name} {registration.last_name}
                </Descriptions.Item>
                <Descriptions.Item label="Date of Birth">
                  {dayjs(registration.date_of_birth).format('MMMM D, YYYY')}
                </Descriptions.Item>
                <Descriptions.Item label={<><MailOutlined /> Email</>}>
                  <Text copyable>{registration.email}</Text>
                </Descriptions.Item>
                <Descriptions.Item label={<><PhoneOutlined /> Phone</>}>
                  <Text copyable>{registration.phone}</Text>
                </Descriptions.Item>
                <Descriptions.Item label={<><EnvironmentOutlined /> Address</>}>
                  {registration.street_address}<br />
                  {registration.suburb}, {registration.city} {registration.state} {registration.postcode}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>

          {/* Business Details */}
          <Col xs={24} lg={12}>
            <Card title={<><BankOutlined /> Business Details</>}>
              <Descriptions column={1} bordered size="small">
                <Descriptions.Item label="Structure">
                  {registration.business_structure === 'sole_trader' ? 'Sole Trader' : 'Pty Ltd Company'}
                </Descriptions.Item>
                {registration.business_name && (
                  <Descriptions.Item label="Business Name">
                    {registration.business_name}
                  </Descriptions.Item>
                )}
                {registration.company_name && (
                  <Descriptions.Item label="Company Name">
                    {registration.company_name}
                  </Descriptions.Item>
                )}
                {registration.company_acn && (
                  <Descriptions.Item label="ACN">
                    {registration.company_acn}
                  </Descriptions.Item>
                )}
                <Descriptions.Item label="ABN">
                  <Text copyable>{registration.business_abn}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="GST Registered">
                  {registration.gst_registered ? (
                    <Tag color="green">Yes</Tag>
                  ) : (
                    <Tag color="default">No</Tag>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Bank Account">
                  {registration.bank_account_name}<br />
                  BSB: {registration.bsb}<br />
                  Account: {registration.bank_account_number}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>

          {/* Service & Availability */}
          <Col xs={24} lg={12}>
            <Card title="Service Locations & Availability">
              <Descriptions column={1} bordered size="small">
                <Descriptions.Item label="Service Cities">
                  {registration.service_cities?.map(city => (
                    <Tag key={city}>{city}</Tag>
                  ))}
                </Descriptions.Item>
                <Descriptions.Item label="Delivery Locations">
                  {registration.delivery_locations?.map(loc => (
                    <Tag key={loc}>{loc}</Tag>
                  ))}
                </Descriptions.Item>
                <Descriptions.Item label="Availability">
                  {Array.isArray(registration.availability_schedule) ? (
                    (registration.availability_schedule as Array<{ day_of_week: number; start_time: string; end_time: string }>)
                      .sort((a, b) => a.day_of_week - b.day_of_week)
                      .map((slot, idx) => {
                        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                        return (
                          <div key={idx}>
                            <Text strong>{dayNames[slot.day_of_week]}: </Text>
                            <Text>{formatTime(slot.start_time)} - {formatTime(slot.end_time)}</Text>
                          </div>
                        );
                      })
                  ) : (
                    Object.entries(registration.availability_schedule || {}).map(([day, times]) => (
                      <div key={day}>
                        <Text strong>{day}: </Text>
                        <Text>{(times as string[]).join(', ')}</Text>
                      </div>
                    ))
                  )}
                </Descriptions.Item>
                {registration.start_date && (
                  <Descriptions.Item label="Preferred Start Date">
                    {dayjs(registration.start_date).format('MMMM D, YYYY')}
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>
          </Col>

          {/* Qualifications & Services */}
          <Col xs={24} lg={12}>
            <Card title="Qualifications & Services">
              <Descriptions column={1} bordered size="small">
                <Descriptions.Item label="Therapies Offered">
                  {registration.therapies_offered?.map(therapy => (
                    <Tag key={therapy} color="blue">{therapy}</Tag>
                  ))}
                </Descriptions.Item>
                <Descriptions.Item label="Certificates">
                  <Space direction="vertical">
                    {registration.qualification_certificates?.map((cert, idx) => (
                      <a key={idx} href={cert.url} target="_blank" rel="noopener noreferrer">
                        <DownloadOutlined /> {cert.filename}
                      </a>
                    ))}
                  </Space>
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>

          {/* Insurance & Compliance */}
          <Col xs={24}>
            <Card title={<><SafetyCertificateOutlined /> Insurance & Compliance</>}>
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Descriptions column={1} bordered size="small">
                    <Descriptions.Item label="Public Liability Insurance">
                      {registration.has_insurance ? (
                        <Tag color="green" icon={<CheckCircleOutlined />}>Yes</Tag>
                      ) : (
                        <Tag color="red" icon={<CloseCircleOutlined />}>No</Tag>
                      )}
                    </Descriptions.Item>
                    {registration.insurance_expiry_date && (
                      <Descriptions.Item label="Expiry Date">
                        {dayjs(registration.insurance_expiry_date).format('MMMM D, YYYY')}
                      </Descriptions.Item>
                    )}
                    {registration.insurance_certificate_url && (
                      <Descriptions.Item label="Certificate">
                        <a href={registration.insurance_certificate_url} target="_blank" rel="noopener noreferrer">
                          <DownloadOutlined /> View Certificate
                        </a>
                      </Descriptions.Item>
                    )}
                  </Descriptions>
                </Col>
                <Col xs={24} md={12}>
                  <Descriptions column={1} bordered size="small">
                    <Descriptions.Item label="First Aid Certification">
                      {registration.has_first_aid ? (
                        <Tag color="green" icon={<CheckCircleOutlined />}>Yes</Tag>
                      ) : (
                        <Tag color="red" icon={<CloseCircleOutlined />}>No</Tag>
                      )}
                    </Descriptions.Item>
                    {registration.first_aid_expiry_date && (
                      <Descriptions.Item label="Expiry Date">
                        {dayjs(registration.first_aid_expiry_date).format('MMMM D, YYYY')}
                      </Descriptions.Item>
                    )}
                    {registration.first_aid_certificate_url && (
                      <Descriptions.Item label="Certificate">
                        <a href={registration.first_aid_certificate_url} target="_blank" rel="noopener noreferrer">
                          <DownloadOutlined /> View Certificate
                        </a>
                      </Descriptions.Item>
                    )}
                  </Descriptions>
                </Col>
              </Row>
              <Divider />
              <Alert
                message="Work Eligibility"
                description={
                  registration.work_eligibility_confirmed
                    ? 'Confirmed eligible to work in Australia'
                    : 'Not confirmed'
                }
                type={registration.work_eligibility_confirmed ? 'success' : 'warning'}
                showIcon
              />
            </Card>
          </Col>

          {/* Agreement & Signature */}
          <Col xs={24}>
            <Card title="Agreement & Signature">
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Descriptions column={1} bordered size="small">
                    <Descriptions.Item label="Agreement Version">
                      {registration.agreement_version || 'N/A'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Signed Date">
                      {registration.signed_date ? dayjs(registration.signed_date).format('MMMM D, YYYY') : 'N/A'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Legal Name">
                      {registration.full_legal_name || 'N/A'}
                    </Descriptions.Item>
                    {registration.agreement_pdf_url && (
                      <Descriptions.Item label="Agreement PDF">
                        <a href={registration.agreement_pdf_url} target="_blank" rel="noopener noreferrer">
                          <DownloadOutlined /> View PDF
                        </a>
                      </Descriptions.Item>
                    )}
                  </Descriptions>
                </Col>
                <Col xs={24} md={12}>
                  {registration.signature_data && (
                    <div>
                      <Text strong>Digital Signature:</Text>
                      <div style={{ marginTop: 8, border: '1px solid #d9d9d9', padding: 8, borderRadius: 4 }}>
                        <Image src={registration.signature_data} alt="Signature" style={{ maxWidth: '100%' }} />
                      </div>
                    </div>
                  )}
                </Col>
              </Row>
              <Divider />
              <Space direction="vertical" style={{ width: '100%' }}>
                <Alert
                  type={registration.agreement_read_confirmed ? 'success' : 'error'}
                  message={registration.agreement_read_confirmed ? '✓ Agreement read and understood' : '✗ Agreement not confirmed'}
                  showIcon={false}
                />
                <Alert
                  type={registration.legal_advice_confirmed ? 'success' : 'error'}
                  message={registration.legal_advice_confirmed ? '✓ Legal advice acknowledged' : '✗ Legal advice not acknowledged'}
                  showIcon={false}
                />
                <Alert
                  type={registration.contractor_relationship_confirmed ? 'success' : 'error'}
                  message={registration.contractor_relationship_confirmed ? '✓ Contractor relationship understood' : '✗ Contractor relationship not understood'}
                  showIcon={false}
                />
                <Alert
                  type={registration.information_accurate_confirmed ? 'success' : 'error'}
                  message={registration.information_accurate_confirmed ? '✓ Information accuracy confirmed' : '✗ Information accuracy not confirmed'}
                  showIcon={false}
                />
                <Alert
                  type={registration.terms_accepted_confirmed ? 'success' : 'error'}
                  message={registration.terms_accepted_confirmed ? '✓ Terms and conditions accepted' : '✗ Terms not accepted'}
                  showIcon={false}
                />
              </Space>
            </Card>
          </Col>

          {/* Timeline */}
          <Col xs={24}>
            <Card title="Registration Timeline">
              <Timeline>
                <Timeline.Item color="blue">
                  Created: {dayjs(registration.created_at).format('MMM D, YYYY HH:mm')}
                </Timeline.Item>
                {registration.submitted_at && (
                  <Timeline.Item color="green">
                    Submitted: {dayjs(registration.submitted_at).format('MMM D, YYYY HH:mm')}
                  </Timeline.Item>
                )}
                {registration.reviewed_at && (
                  <Timeline.Item color="orange">
                    Reviewed: {dayjs(registration.reviewed_at).format('MMM D, YYYY HH:mm')}
                    {registration.review_notes && <div><Text type="secondary">{registration.review_notes}</Text></div>}
                  </Timeline.Item>
                )}
                {registration.first_interview_scheduled_at && (
                  <Timeline.Item color="purple">
                    1st Interview Scheduled: {dayjs(registration.first_interview_scheduled_at).format('MMM D, YYYY HH:mm')}
                  </Timeline.Item>
                )}
                {registration.first_interview_completed_at && (
                  <Timeline.Item color="purple">
                    1st Interview Completed: {dayjs(registration.first_interview_completed_at).format('MMM D, YYYY HH:mm')}
                    {registration.first_interview_notes && <div><Text type="secondary">{registration.first_interview_notes}</Text></div>}
                  </Timeline.Item>
                )}
                {registration.second_interview_scheduled_at && (
                  <Timeline.Item color="purple">
                    2nd Interview Scheduled: {dayjs(registration.second_interview_scheduled_at).format('MMM D, YYYY HH:mm')}
                  </Timeline.Item>
                )}
                {registration.second_interview_completed_at && (
                  <Timeline.Item color="purple">
                    2nd Interview Completed: {dayjs(registration.second_interview_completed_at).format('MMM D, YYYY HH:mm')}
                    {registration.second_interview_notes && <div><Text type="secondary">{registration.second_interview_notes}</Text></div>}
                  </Timeline.Item>
                )}
                {registration.approved_at && (
                  <Timeline.Item color="green">
                    Approved: {dayjs(registration.approved_at).format('MMM D, YYYY HH:mm')}
                  </Timeline.Item>
                )}
                {registration.rejected_at && (
                  <Timeline.Item color="red">
                    Rejected: {dayjs(registration.rejected_at).format('MMM D, YYYY HH:mm')}
                    {registration.rejection_reason && <div><Text type="secondary">{registration.rejection_reason}</Text></div>}
                  </Timeline.Item>
                )}
                {registration.enrolled_at && (
                  <Timeline.Item color="cyan">
                    Enrolled: {dayjs(registration.enrolled_at).format('MMM D, YYYY HH:mm')}
                  </Timeline.Item>
                )}
              </Timeline>
            </Card>
          </Col>
        </Row>

        {/* Status Update Modal */}
        <Modal
          title="Update Application Status"
          open={statusModalVisible}
          onCancel={() => setStatusModalVisible(false)}
          footer={null}
        >
          <Form form={statusForm} layout="vertical" onFinish={updateStatus}>
            <Form.Item
              name="status"
              label="Status"
              rules={[{ required: true, message: 'Please select a status' }]}
              initialValue={registration.status}
            >
              <Select>
                <Option value="draft">Draft</Option>
                <Option value="submitted">Submitted</Option>
                <Option value="under_review">Under Review</Option>
                <Option value="in_recruitment">In Recruitment</Option>
                <Option value="approved">Approved</Option>
                <Option value="rejected">Rejected</Option>
              </Select>
            </Form.Item>

            <Form.Item
              noStyle
              shouldUpdate={(prevValues, currentValues) => prevValues.status !== currentValues.status}
            >
              {({ getFieldValue }) =>
                getFieldValue('status') === 'rejected' ? (
                  <Form.Item
                    name="rejection_reason"
                    label="Rejection Reason"
                    rules={[{ required: true, message: 'Please provide a reason' }]}
                  >
                    <TextArea rows={4} placeholder="Explain why this application was rejected..." />
                  </Form.Item>
                ) : null
              }
            </Form.Item>

            <Form.Item name="review_notes" label="Review Notes">
              <TextArea rows={4} placeholder="Add any notes about this review..." />
            </Form.Item>

            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit">
                  Update Status
                </Button>
                <Button onClick={() => setStatusModalVisible(false)}>
                  Cancel
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>

        {/* Recruitment Modal */}
        <Modal
          title="Update Recruitment Status"
          open={recruitmentModalVisible}
          onCancel={() => setRecruitmentModalVisible(false)}
          footer={null}
          width={700}
        >
          <Form form={recruitmentForm} layout="vertical" onFinish={updateRecruitment}>
            <Form.Item
              name="recruitment_status"
              label="Recruitment Status"
              initialValue={registration.recruitment_status}
            >
              <Select>
                <Option value="1st_interview">1st Interview</Option>
                <Option value="2nd_interview">2nd Interview</Option>
                <Option value="accepted">Accepted</Option>
                <Option value="declined">Declined</Option>
                <Option value="postponed">Postponed</Option>
              </Select>
            </Form.Item>

            <Divider>1st Interview</Divider>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="first_interview_scheduled_at"
                  label="Scheduled At"
                  initialValue={registration.first_interview_scheduled_at ? dayjs(registration.first_interview_scheduled_at) : undefined}
                >
                  <DatePicker showTime style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="first_interview_completed_at"
                  label="Completed At"
                  initialValue={registration.first_interview_completed_at ? dayjs(registration.first_interview_completed_at) : undefined}
                >
                  <DatePicker showTime style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              name="first_interview_notes"
              label="Notes"
              initialValue={registration.first_interview_notes}
            >
              <TextArea rows={3} />
            </Form.Item>

            <Divider>2nd Interview</Divider>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="second_interview_scheduled_at"
                  label="Scheduled At"
                  initialValue={registration.second_interview_scheduled_at ? dayjs(registration.second_interview_scheduled_at) : undefined}
                >
                  <DatePicker showTime style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="second_interview_completed_at"
                  label="Completed At"
                  initialValue={registration.second_interview_completed_at ? dayjs(registration.second_interview_completed_at) : undefined}
                >
                  <DatePicker showTime style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              name="second_interview_notes"
              label="Notes"
              initialValue={registration.second_interview_notes}
            >
              <TextArea rows={3} />
            </Form.Item>

            <Divider>General Notes</Divider>

            <Form.Item
              name="recruitment_notes"
              label="Recruitment Notes"
              initialValue={registration.recruitment_notes}
            >
              <TextArea rows={4} />
            </Form.Item>

            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit">
                  Update Recruitment
                </Button>
                <Button onClick={() => setRecruitmentModalVisible(false)}>
                  Cancel
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </RoleGuard>
  );
};

export default TherapistRegistrationShow;
