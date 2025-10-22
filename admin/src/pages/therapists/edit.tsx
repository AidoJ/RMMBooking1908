import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Select,
  Switch,
  Button,
  Row,
  Col,
  Typography,
  message,
  Space,
  InputNumber,
  Upload,
  Avatar,
  Spin,
  Divider,
  TimePicker,
  Checkbox,
  DatePicker,
} from 'antd';
import {
  SaveOutlined,
  ArrowLeftOutlined,
  UserOutlined,
  UploadOutlined,
  PlusOutlined,
  DeleteOutlined,
  EnvironmentOutlined,
  BankOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router';
import { useGetIdentity } from '@refinedev/core';
import { RoleGuard } from '../../components/RoleGuard';
import { supabaseClient } from '../../utility';
import { useAddressGeocoding } from '../../hooks/useAddressGeocoding';
import ServiceAreaPolygonEditor from '../../components/ServiceAreaPolygonEditor';
import dayjs from 'dayjs';

const { Title } = Typography;
const { Option } = Select;
const { TextArea } = Input;

interface Service {
  id: string;
  name: string;
  description?: string;
}

interface Availability {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

interface Coordinate {
  lat: number;
  lng: number;
}

interface TherapistFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  bio?: string;
  profile_pic?: string;
  home_address?: string;
  service_radius_km?: number;
  service_area_polygon?: Coordinate[];
  is_active: boolean;
  gender?: string;
  years_experience?: number;
  business_abn: string;
  address_verified: boolean;
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

const TherapistEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: identity } = useGetIdentity<any>();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [therapist, setTherapist] = useState<TherapistFormData | null>(null);
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [profileImage, setProfileImage] = useState<string>('');
  const [serviceAreaPolygon, setServiceAreaPolygon] = useState<Coordinate[] | null>(null);
  const [insuranceCertFile, setInsuranceCertFile] = useState<any[]>([]);
  const [firstAidCertFile, setFirstAidCertFile] = useState<any[]>([]);
  const [qualificationCertFile, setQualificationCertFile] = useState<any[]>([]);

  const canEditTherapists = identity?.role === 'admin' || identity?.role === 'super_admin';
  const isSuperAdmin = identity?.role === 'super_admin';

  // Geocoding hook for address verification
  const {
    isGeocoding,
    geocodeResult,
    geocodeError,
    addressVerified,
    geocodeAddress,
    setupAutocomplete,
    coordinateFields
  } = useAddressGeocoding({
    onGeocodeSuccess: (result) => {
      form.setFieldsValue({
        latitude: result.lat,
        longitude: result.lng,
        address_verified: true
      });
    },
    onAddressChange: (address) => {
      // Update the form field with the full formatted address
      form.setFieldsValue({
        home_address: address
      });
    }
  });

  useEffect(() => {
    if (id) {
      loadTherapistData();
      loadAllServices();
    }
  }, [id]);

  // Set up address autocomplete after form is rendered
  useEffect(() => {
    const setupAddressField = async () => {
      const addressInput = document.getElementById('home_address') as HTMLInputElement;
      if (addressInput) {
        await setupAutocomplete(addressInput);
      }
    };

    // Delay to ensure form is rendered
    const timer = setTimeout(setupAddressField, 500);
    return () => clearTimeout(timer);
  }, [therapist, setupAutocomplete]);

  const loadTherapistData = async () => {
    try {
      setLoading(true);

      // Load therapist profile
      const { data: therapistData, error: therapistError } = await supabaseClient
        .from('therapist_profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (therapistError) throw therapistError;

      setTherapist(therapistData);
      setProfileImage(therapistData.profile_pic || '');

      // Load polygon data if available
      if (therapistData.service_area_polygon) {
        setServiceAreaPolygon(therapistData.service_area_polygon);
      }

      // Convert date fields to dayjs objects for the form
      const formData = {
        ...therapistData,
        insurance_expiry_date: therapistData.insurance_expiry_date ? dayjs(therapistData.insurance_expiry_date) : undefined,
        first_aid_expiry_date: therapistData.first_aid_expiry_date ? dayjs(therapistData.first_aid_expiry_date) : undefined,
      };

      form.setFieldsValue(formData);

      // Load certificate files
      if (therapistData.insurance_certificate_url) {
        setInsuranceCertFile([{
          uid: '1',
          name: 'insurance_certificate.pdf',
          status: 'done',
          url: therapistData.insurance_certificate_url
        }]);
      }

      if (therapistData.first_aid_certificate_url) {
        setFirstAidCertFile([{
          uid: '1',
          name: 'first_aid_certificate.pdf',
          status: 'done',
          url: therapistData.first_aid_certificate_url
        }]);
      }

      if (therapistData.qualification_certificate_url) {
        setQualificationCertFile([{
          uid: '1',
          name: 'qualification_certificate.pdf',
          status: 'done',
          url: therapistData.qualification_certificate_url
        }]);
      }

      // Load therapist services
      const { data: servicesData, error: servicesError } = await supabaseClient
        .from('therapist_services')
        .select('service_id')
        .eq('therapist_id', id);

      if (servicesError) throw servicesError;
      setSelectedServices(servicesData?.map(ts => ts.service_id) || []);

      // Load availability
      const { data: availabilityData, error: availabilityError } = await supabaseClient
        .from('therapist_availability')
        .select('*')
        .eq('therapist_id', id)
        .order('day_of_week', { ascending: true });

      if (availabilityError) throw availabilityError;
      setAvailability(availabilityData || []);

    } catch (error: any) {
      console.error('Error loading therapist data:', error);
      message.error('Failed to load therapist data');
    } finally {
      setLoading(false);
    }
  };

  const loadAllServices = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('services')
        .select('id, name, description')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;
      setAllServices(data || []);
    } catch (error: any) {
      console.error('Error loading services:', error);
      message.error('Failed to load services');
    }
  };

  const handleImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setProfileImage(base64);
      form.setFieldValue('profile_pic', base64);
    };
    reader.readAsDataURL(file);
    return false; // Prevent auto upload
  };

  const handleCertificateUpload = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const addAvailabilitySlot = () => {
    setAvailability([...availability, {
      day_of_week: 1,
      start_time: '09:00',
      end_time: '17:00'
    }]);
  };

  const removeAvailabilitySlot = (index: number) => {
    setAvailability(availability.filter((_, i) => i !== index));
  };

  const updateAvailabilitySlot = (index: number, field: keyof Availability, value: any) => {
    const updated = [...availability];
    updated[index] = { ...updated[index], [field]: value };
    setAvailability(updated);
  };

  const handleSubmit = async (values: TherapistFormData) => {
    if (!canEditTherapists) {
      message.error('You do not have permission to edit therapists');
      return;
    }

    try {
      setSaving(true);

      // Handle certificate file uploads
      let insuranceCertUrl = therapist?.insurance_certificate_url;
      let firstAidCertUrl = therapist?.first_aid_certificate_url;
      let qualificationCertUrl = therapist?.qualification_certificate_url;

      if (insuranceCertFile.length > 0 && insuranceCertFile[0].originFileObj) {
        insuranceCertUrl = await handleCertificateUpload(insuranceCertFile[0].originFileObj);
      }

      if (firstAidCertFile.length > 0 && firstAidCertFile[0].originFileObj) {
        firstAidCertUrl = await handleCertificateUpload(firstAidCertFile[0].originFileObj);
      }

      if (qualificationCertFile.length > 0 && qualificationCertFile[0].originFileObj) {
        qualificationCertUrl = await handleCertificateUpload(qualificationCertFile[0].originFileObj);
      }

      // Update therapist profile with coordinates and polygon
      const { error: updateError } = await supabaseClient
        .from('therapist_profiles')
        .update({
          ...values,
          profile_pic: profileImage,
          insurance_certificate_url: insuranceCertUrl,
          first_aid_certificate_url: firstAidCertUrl,
          qualification_certificate_url: qualificationCertUrl,
          // Convert dayjs objects back to strings for database
          insurance_expiry_date: values.insurance_expiry_date ? dayjs(values.insurance_expiry_date).format('YYYY-MM-DD') : null,
          first_aid_expiry_date: values.first_aid_expiry_date ? dayjs(values.first_aid_expiry_date).format('YYYY-MM-DD') : null,
          latitude: coordinateFields.latitude,
          longitude: coordinateFields.longitude,
          address_verified: coordinateFields.address_verified,
          service_area_polygon: serviceAreaPolygon,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (updateError) throw updateError;

      // Update services
      // First, remove all existing services
      const { error: deleteServicesError } = await supabaseClient
        .from('therapist_services')
        .delete()
        .eq('therapist_id', id);

      if (deleteServicesError) throw deleteServicesError;

      // Then add the selected services
      if (selectedServices.length > 0) {
        const serviceInserts = selectedServices.map(serviceId => ({
          therapist_id: id,
          service_id: serviceId
        }));

        const { error: insertServicesError } = await supabaseClient
          .from('therapist_services')
          .insert(serviceInserts);

        if (insertServicesError) throw insertServicesError;
      }

      // Update availability
      // First, remove all existing availability
      const { error: deleteAvailabilityError } = await supabaseClient
        .from('therapist_availability')
        .delete()
        .eq('therapist_id', id);

      if (deleteAvailabilityError) throw deleteAvailabilityError;

      // Then add the current availability
      if (availability.length > 0) {
        const availabilityInserts = availability.map(avail => ({
          therapist_id: id,
          day_of_week: avail.day_of_week,
          start_time: avail.start_time,
          end_time: avail.end_time
        }));

        const { error: insertAvailabilityError } = await supabaseClient
          .from('therapist_availability')
          .insert(availabilityInserts);

        if (insertAvailabilityError) throw insertAvailabilityError;
      }

      message.success('Therapist profile updated successfully');
      navigate('/therapists');

    } catch (error: any) {
      console.error('Error updating therapist:', error);
      message.error('Failed to update therapist profile');
    } finally {
      setSaving(false);
    }
  };

  const getDayName = (dayOfWeek: number): string => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayOfWeek] || 'Unknown';
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!canEditTherapists) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Title level={3}>Access Denied</Title>
        <p>You do not have permission to edit therapist profiles.</p>
      </div>
    );
  }

  return (
    <RoleGuard requiredPermission="canEditAllTherapists">
      <div style={{ padding: '24px' }}>
        {/* Header */}
        <Card style={{ marginBottom: '24px' }}>
          <Row gutter={24} align="middle">
            <Col>
              <Button 
                icon={<ArrowLeftOutlined />} 
                onClick={() => navigate('/therapists')}
              >
                Back to Therapists
              </Button>
            </Col>
            <Col flex="auto">
              <Title level={2} style={{ margin: 0 }}>
                Edit Therapist Profile
              </Title>
            </Col>
          </Row>
        </Card>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          size="large"
        >
          <Row gutter={24}>
            {/* Left Column */}
            <Col span={12}>
              <Card title="Personal Information" style={{ marginBottom: '24px' }}>
                {/* Profile Picture */}
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                  <Avatar
                    size={100}
                    src={profileImage}
                    icon={<UserOutlined />}
                    style={{ marginBottom: '16px' }}
                  />
                  <br />
                  <Upload
                    accept="image/*"
                    beforeUpload={handleImageUpload}
                    showUploadList={false}
                  >
                    <Button icon={<UploadOutlined />}>
                      Upload Photo
                    </Button>
                  </Upload>
                </div>

                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name="first_name"
                      label="First Name"
                      rules={[{ required: true, message: 'Please enter first name' }]}
                    >
                      <Input placeholder="Enter first name" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name="last_name"
                      label="Last Name"
                      rules={[{ required: true, message: 'Please enter last name' }]}
                    >
                      <Input placeholder="Enter last name" />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item
                  name="email"
                  label="Email"
                  rules={[
                    { required: true, message: 'Please enter email' },
                    { type: 'email', message: 'Please enter a valid email' }
                  ]}
                >
                  <Input placeholder="Enter email address" />
                </Form.Item>

                <Form.Item
                  name="phone"
                  label="Phone Number"
                >
                  <Input placeholder="Enter phone number" />
                </Form.Item>

                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name="gender"
                      label="Gender"
                    >
                      <Select placeholder="Select gender">
                        <Option value="male">Male</Option>
                        <Option value="female">Female</Option>
                        <Option value="other">Other</Option>
                        <Option value="prefer_not_to_say">Prefer not to say</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name="years_experience"
                      label="Years of Experience"
                    >
                      <InputNumber 
                        placeholder="Years"
                        min={0}
                        max={50}
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item
                  name="business_abn"
                  label="Business ABN"
                  rules={[
                    { required: true, message: 'Please enter business ABN' },
                    { pattern: /^\d{11}$/, message: 'ABN must be 11 digits' }
                  ]}
                >
                  <Input placeholder="Enter 11-digit ABN" maxLength={11} />
                </Form.Item>

                <Form.Item
                  name="bio"
                  label="Biography"
                >
                  <TextArea
                    rows={4}
                    placeholder="Enter therapist biography..."
                    maxLength={500}
                    showCount
                  />
                </Form.Item>

                <Divider orientation="left">Certificates</Divider>

                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item label="Insurance Expiry Date" name="insurance_expiry_date">
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
                    <Form.Item label="First Aid Expiry Date" name="first_aid_expiry_date">
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

                <Form.Item label="Bank Account Name" name="bank_account_name">
                  <Input prefix={<BankOutlined />} placeholder="Account holder name" />
                </Form.Item>

                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      label="BSB"
                      name="bsb"
                      rules={[{ pattern: /^\d{3}-?\d{3}$/, message: 'BSB must be in format XXX-XXX or XXXXXX' }]}
                    >
                      <Input placeholder="XXX-XXX" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="Bank Account Number" name="bank_account_number">
                      <Input placeholder="Account number" />
                    </Form.Item>
                  </Col>
                </Row>

                <Divider orientation="left">Hourly Rates</Divider>

                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item label="Hourly Rate" name="hourly_rate">
                      <InputNumber
                        prefix="$"
                        style={{ width: '100%' }}
                        min={0}
                        step={0.01}
                        disabled={!isSuperAdmin}
                        placeholder={isSuperAdmin ? "Enter hourly rate" : "Only editable by superadmin"}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="After Hours Rate" name="afterhours_rate">
                      <InputNumber
                        prefix="$"
                        style={{ width: '100%' }}
                        min={0}
                        step={0.01}
                        disabled={!isSuperAdmin}
                        placeholder={isSuperAdmin ? "Enter after hours rate" : "Only editable by superadmin"}
                      />
                    </Form.Item>
                  </Col>
                </Row>

                {!isSuperAdmin && (
                  <div style={{ padding: 12, backgroundColor: '#fff7e6', border: '1px solid #ffd591', borderRadius: 4, marginBottom: 16 }}>
                    <Typography.Text type="warning">
                      ⚠️ Only superadmin users can modify hourly rates
                    </Typography.Text>
                  </div>
                )}
              </Card>

              {/* Status & Verification */}
              <Card title="Status & Verification">
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name="is_active"
                      label="Active Status"
                      valuePropName="checked"
                    >
                      <Switch 
                        checkedChildren="Active" 
                        unCheckedChildren="Inactive"
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name="address_verified"
                      label="Address Verified"
                      valuePropName="checked"
                    >
                      <Switch 
                        checkedChildren="Verified" 
                        unCheckedChildren="Unverified"
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>
            </Col>

            {/* Right Column */}
            <Col span={12}>
              {/* Location & Service Area */}
              <Card title="Location & Service Area" style={{ marginBottom: '24px' }}>
                <Form.Item
                  name="home_address"
                  label="Home Address"
                  help={geocodeError ? <span style={{ color: '#ff4d4f' }}>{geocodeError}</span> : 
                        addressVerified ? <span style={{ color: '#52c41a' }}>✓ Address verified</span> : 
                        'Enter address for automatic verification'}
                >
                  <TextArea 
                    id="home_address"
                    rows={3} 
                    placeholder="Start typing address for autocomplete suggestions..."
                  />
                </Form.Item>

                <div style={{ marginBottom: '16px' }}>
                  <Button 
                    type="default"
                    loading={isGeocoding}
                    onClick={() => {
                      const address = form.getFieldValue('home_address');
                      if (address) {
                        geocodeAddress(address);
                      } else {
                        message.warning('Please enter an address first');
                      }
                    }}
                    icon={<EnvironmentOutlined />}
                    disabled={!form.getFieldValue('home_address')}
                  >
                    {isGeocoding ? 'Verifying...' : 'Verify Address'}
                  </Button>
                </div>

                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name="latitude"
                      label="Latitude"
                    >
                      <InputNumber 
                        placeholder="Auto-populated"
                        readOnly
                        style={{ width: '100%', backgroundColor: '#f5f5f5' }}
                        precision={6}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name="longitude"
                      label="Longitude"
                    >
                      <InputNumber 
                        placeholder="Auto-populated"
                        readOnly
                        style={{ width: '100%', backgroundColor: '#f5f5f5' }}
                        precision={6}
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item
                  name="service_radius_km"
                  label="Service Radius (km)"
                  help="Used as fallback when no polygon is defined"
                >
                  <InputNumber
                    placeholder="Radius in kilometers"
                    min={1}
                    max={100}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Card>

              {/* Service Area Polygon Editor */}
              <ServiceAreaPolygonEditor
                centerLat={coordinateFields.latitude}
                centerLng={coordinateFields.longitude}
                serviceRadiusKm={form.getFieldValue('service_radius_km') || 10}
                existingPolygon={serviceAreaPolygon || undefined}
                onPolygonChange={(polygon) => setServiceAreaPolygon(polygon)}
              />

              {/* Services */}
              <Card title="Services Offered" style={{ marginBottom: '24px' }}>
                <Checkbox.Group
                  value={selectedServices}
                  onChange={setSelectedServices}
                  style={{ width: '100%' }}
                >
                  <Row gutter={[16, 8]}>
                    {allServices.map(service => (
                      <Col span={24} key={service.id}>
                        <Checkbox value={service.id}>
                          <strong>{service.name}</strong>
                          {service.description && (
                            <div style={{ fontSize: '12px', color: '#666' }}>
                              {service.description}
                            </div>
                          )}
                        </Checkbox>
                      </Col>
                    ))}
                  </Row>
                </Checkbox.Group>
              </Card>

              {/* Availability Schedule */}
              <Card title="Availability Schedule">
                <div style={{ marginBottom: '16px' }}>
                  <Button 
                    type="dashed" 
                    icon={<PlusOutlined />}
                    onClick={addAvailabilitySlot}
                    block
                  >
                    Add Availability Slot
                  </Button>
                </div>

                {availability.map((avail, index) => (
                  <div key={index} style={{ marginBottom: '16px', padding: '12px', border: '1px solid #d9d9d9', borderRadius: '6px' }}>
                    <Row gutter={16} align="middle">
                      <Col span={8}>
                        <Select
                          value={avail.day_of_week}
                          onChange={(value) => updateAvailabilitySlot(index, 'day_of_week', value)}
                          style={{ width: '100%' }}
                        >
                          {[0, 1, 2, 3, 4, 5, 6].map(day => (
                            <Option key={day} value={day}>
                              {getDayName(day)}
                            </Option>
                          ))}
                        </Select>
                      </Col>
                      <Col span={6}>
                        <TimePicker
                          value={dayjs(avail.start_time, 'HH:mm')}
                          onChange={(time) => updateAvailabilitySlot(index, 'start_time', time?.format('HH:mm'))}
                          format="HH:mm"
                          style={{ width: '100%' }}
                        />
                      </Col>
                      <Col span={6}>
                        <TimePicker
                          value={dayjs(avail.end_time, 'HH:mm')}
                          onChange={(time) => updateAvailabilitySlot(index, 'end_time', time?.format('HH:mm'))}
                          format="HH:mm"
                          style={{ width: '100%' }}
                        />
                      </Col>
                      <Col span={4}>
                        <Button 
                          type="text" 
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => removeAvailabilitySlot(index)}
                        />
                      </Col>
                    </Row>
                  </div>
                ))}
              </Card>
            </Col>
          </Row>

          {/* Submit Buttons */}
          <Card style={{ marginTop: '24px' }}>
            <div style={{ textAlign: 'center' }}>
              <Space size="large">
                <Button 
                  size="large"
                  onClick={() => navigate('/therapists')}
                >
                  Cancel
                </Button>
                <Button 
                  type="primary"
                  size="large"
                  htmlType="submit"
                  icon={<SaveOutlined />}
                  loading={saving}
                >
                  Save Changes
                </Button>
              </Space>
            </div>
          </Card>
        </Form>
      </div>
    </RoleGuard>
  );
};

export default TherapistEdit;