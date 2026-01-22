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
  App,
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
  DeleteOutlined,
  EditOutlined,
  FileOutlined,
  UploadOutlined,
  BankOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import { useGetIdentity } from '@refinedev/core';
import { useParams, useNavigate } from 'react-router';
import { supabaseClient } from '../../utility';
import { useAddressGeocoding } from '../../hooks/useAddressGeocoding';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
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
  const { message } = App.useApp(); // Use v5-correct message API
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
  const [editingAvailability, setEditingAvailability] = useState<AvailabilitySlot | null>(null);
  const [timeOffModalVisible, setTimeOffModalVisible] = useState(false);
  const [therapistServices, setTherapistServices] = useState<any[]>([]);
  const [allServices, setAllServices] = useState<any[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [insuranceCertFile, setInsuranceCertFile] = useState<any[]>([]);
  const [firstAidCertFile, setFirstAidCertFile] = useState<any[]>([]);
  const [qualificationCertFile, setQualificationCertFile] = useState<any[]>([]);

  const isAdmin = identity?.role === 'admin' || identity?.role === 'super_admin';
  const isSuperAdmin = identity?.role === 'super_admin';
  const isTherapist = identity?.role === 'therapist';

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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
      // Admin editing a specific therapist by ID
      loadProfileById(id);
    } else if (isTherapist && identity?.id) {
      // Therapist editing their own profile - lookup by user_id
      loadProfileByUserId(identity.id);
    } else {
      setInitialLoading(false);
    }
  }, [id, identity]);

  // Enhanced autocomplete setup for tabbed interface
  const [autocompleteSetup, setAutocompleteSetup] = useState(false);
  const [currentActiveTab, setCurrentActiveTab] = useState('personal');

  useEffect(() => {
    const setupAddressField = async () => {
      const addressInput = document.getElementById('home_address') as HTMLInputElement;
      
      if (addressInput && addressInput.offsetParent !== null && !autocompleteSetup) {
        console.log('Setting up autocomplete for My Profile address field');
        try {
          await setupAutocomplete(addressInput);
          setAutocompleteSetup(true);
          console.log('Autocomplete setup completed for My Profile');
        } catch (error) {
          console.error('Error setting up autocomplete:', error);
        }
      }
    };

    // Only try to set up autocomplete if we're on the location tab
    if (currentActiveTab === 'location') {
      const timer = setTimeout(setupAddressField, 100);
      return () => clearTimeout(timer);
    }
  }, [currentActiveTab, profile, setupAutocomplete, autocompleteSetup]);

  // Handle tab changes to set up autocomplete when location tab becomes active
  const handleTabChange = (activeKey: string) => {
    setCurrentActiveTab(activeKey);
    
    // Reset autocomplete setup when switching away from location tab
    if (activeKey !== 'location' && autocompleteSetup) {
      setAutocompleteSetup(false);
    }
  };

  // Initial check if location tab is active on page load
  useEffect(() => {
    // Check if we should start on the location tab (e.g., URL fragment)
    const hash = window.location.hash;
    if (hash === '#location') {
      setCurrentActiveTab('location');
    }
  }, []);

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

      await loadAvailability(data.id);
      await loadTimeOff(data.id);
      await loadTherapistServices(data.id);

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

      await loadAvailability(data.id);
      await loadTimeOff(data.id);
      await loadTherapistServices(data.id);

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

  const loadTherapistServices = async (therapistId: string) => {
    try {
      setServicesLoading(true);

      // Load therapist's current services
      const { data: therapistServicesData, error: therapistError } = await supabaseClient
        .from('therapist_services')
        .select(`
          id,
          service_id,
          services!inner(id, name, description, short_description, service_base_price, minimum_duration, is_active)
        `)
        .eq('therapist_id', therapistId);

      if (therapistError) throw therapistError;

      // Load all available services
      const { data: allServicesData, error: allServicesError } = await supabaseClient
        .from('services')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')
        .order('name');

      if (allServicesError) throw allServicesError;

      setTherapistServices(therapistServicesData || []);
      setAllServices(allServicesData || []);
    } catch (error) {
      console.error('Error loading services:', error);
      message.error('Failed to load services');
    } finally {
      setServicesLoading(false);
    }
  };

  const handleAddService = async (serviceId: string) => {
    if (!profile?.id) {
      message.error('Please save the profile first before adding services');
      return;
    }

    try {
      const { data, error } = await supabaseClient
        .from('therapist_services')
        .insert([{
          therapist_id: profile.id,
          service_id: serviceId
        }])
        .select(`
          id,
          service_id,
          services!inner(id, name, description, short_description, service_base_price, minimum_duration, is_active)
        `)
        .single();

      if (error) throw error;

      setTherapistServices([...therapistServices, data]);
      message.success('Service added successfully!');
    } catch (error) {
      console.error('Error adding service:', error);
      message.error('Failed to add service');
    }
  };

  const handleRemoveService = async (therapistServiceId: string) => {
    try {
      const { error } = await supabaseClient
        .from('therapist_services')
        .delete()
        .eq('id', therapistServiceId);

      if (error) throw error;

      setTherapistServices(therapistServices.filter(ts => ts.id !== therapistServiceId));
      message.success('Service removed successfully!');
    } catch (error) {
      console.error('Error removing service:', error);
      message.error('Failed to remove service');
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
        latitude: coordinateFields.latitude || values.latitude,
        longitude: coordinateFields.longitude || values.longitude,
        address_verified: coordinateFields.address_verified || values.address_verified
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

      setProfile(savedProfile);

      // Show success message with longer duration
      message.success({
        content: `Profile ${profile?.id ? 'updated' : 'created'} successfully!`,
        duration: 3,
      });

      if (profileData.latitude && profileData.longitude) {
        message.success({
          content: 'Location coordinates saved for proximity matching!',
          duration: 3,
        });
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

      if (editingAvailability) {
        // Update existing availability
        const { data, error } = await supabaseClient
          .from('therapist_availability')
          .update({
            day_of_week: values.day_of_week,
            start_time: values.start_time.format('HH:mm:ss'),
            end_time: values.end_time.format('HH:mm:ss')
          })
          .eq('id', editingAvailability.id)
          .select()
          .single();

        if (error) throw error;

        setAvailability(availability.map(slot =>
          slot.id === editingAvailability.id ? data : slot
        ));
        message.success('Availability updated successfully!');
      } else {
        // Add new availability
        const { data, error } = await supabaseClient
          .from('therapist_availability')
          .insert([availabilityData])
          .select()
          .single();

        if (error) throw error;

        setAvailability([...availability, data]);
        message.success('Availability added successfully!');
      }

      setAvailabilityModalVisible(false);
      setEditingAvailability(null);
      availabilityForm.resetFields();
    } catch (error) {
      console.error('Error saving availability:', error);
      message.error('Failed to save availability');
    }
  };

  const handleEditAvailability = (slot: AvailabilitySlot) => {
    setEditingAvailability(slot);
    availabilityForm.setFieldsValue({
      day_of_week: slot.day_of_week,
      start_time: dayjs(slot.start_time, 'HH:mm:ss'),
      end_time: dayjs(slot.end_time, 'HH:mm:ss')
    });
    setAvailabilityModalVisible(true);
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
      // Admin editing a specific therapist - go back to therapists list
      navigate('/therapists');
    } else {
      // Therapist editing their own profile - go back to dashboard (root)
      navigate('/');
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
        <>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEditAvailability(record)}
            style={{ marginRight: 8 }}
          >
            Edit
          </Button>
          <Button
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteAvailability(record.id!)}
          >
            Remove
          </Button>
        </>
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
            onFinishFailed={({ errorFields }) => {
              if (errorFields && errorFields.length > 0) {
                form.scrollToField(errorFields[0].name);
                message.error('Please fix the highlighted fields before saving.');
              }
            }}
            initialValues={{
              is_active: true,
              service_radius_km: 50,
              gender: 'prefer_not_to_say',
              rating: 0,
              total_reviews: 0,
              address_verified: false
            }}
          >
            <Tabs defaultActiveKey="personal" onChange={handleTabChange}>
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
                    <Text type="warning">
                      ⚠️ Only superadmin users can modify hourly rates
                    </Text>
                  </div>
                )}

                <Form.Item label="Active Status" name="is_active" valuePropName="checked">
                  <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
                </Form.Item>
              </TabPane>

              <TabPane tab="Location & Service Area" key="location">
                <Form.Item 
                  label="Home Address" 
                  name="home_address"
                  help={geocodeError ? <span style={{ color: '#ff4d4f' }}>{geocodeError}</span> : 
                        addressVerified ? <span style={{ color: '#52c41a' }}>✓ Address verified</span> : 
                        'Start typing your address and select from the dropdown for automatic location verification'}
                >
                  <Input 
                    id="home_address"
                    prefix={<EnvironmentOutlined />}
                    placeholder="Start typing your address..."
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
                    onClick={() => {
                      setEditingAvailability(null);
                      availabilityForm.resetFields();
                      setAvailabilityModalVisible(true);
                    }}
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

              <TabPane tab="Services" key="services">
                <div style={{ marginBottom: 16 }}>
                  <h3>Services Offered</h3>
                  <p style={{ color: '#666', marginBottom: 16 }}>
                    Select which services this therapist can provide to customers.
                  </p>
                  
                  {!profile?.id && (
                    <div style={{ marginBottom: 16, padding: 16, backgroundColor: '#fff7e6', border: '1px solid #ffd591', borderRadius: 4 }}>
                      <Text type="warning">
                        Please save the profile first before managing services
                      </Text>
                    </div>
                  )}
                </div>

                <Row gutter={24}>
                  <Col span={12}>
                    <Card title="Available Services" size="small" style={{ height: '400px', overflowY: 'auto' }}>
                      {servicesLoading ? (
                        <div style={{ textAlign: 'center', padding: 20 }}>
                          <Spin />
                        </div>
                      ) : (
                        <div>
                          {allServices
                            .filter(service => !therapistServices.some(ts => ts.service_id === service.id))
                            .map(service => (
                              <div key={service.id} style={{ 
                                marginBottom: 8, 
                                padding: 12, 
                                border: '1px solid #d9d9d9', 
                                borderRadius: 4,
                                backgroundColor: '#fafafa'
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div>
                                    <Text strong>{service.name}</Text>
                                    {service.short_description && (
                                      <div style={{ fontSize: '12px', color: '#999', marginTop: 4 }}>
                                        {service.short_description}
                                      </div>
                                    )}
                                  </div>
                                  <Button
                                    type="primary"
                                    size="small"
                                    icon={<PlusOutlined />}
                                    onClick={() => handleAddService(service.id)}
                                    disabled={!profile?.id}
                                  >
                                    Add
                                  </Button>
                                </div>
                              </div>
                            ))}
                          
                          {allServices.filter(service => !therapistServices.some(ts => ts.service_id === service.id)).length === 0 && (
                            <div style={{ textAlign: 'center', padding: 20, color: '#999' }}>
                              All available services have been added
                            </div>
                          )}
                        </div>
                      )}
                    </Card>
                  </Col>

                  <Col span={12}>
                    <Card title="Therapist's Services" size="small" style={{ height: '400px', overflowY: 'auto' }}>
                      {servicesLoading ? (
                        <div style={{ textAlign: 'center', padding: 20 }}>
                          <Spin />
                        </div>
                      ) : (
                        <div>
                          {therapistServices.map(therapistService => (
                            <div key={therapistService.id} style={{ 
                              marginBottom: 8, 
                              padding: 12, 
                              border: '1px solid #52c41a', 
                              borderRadius: 4,
                              backgroundColor: '#f6ffed'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                  <Text strong>{therapistService.services.name}</Text>
                                  {therapistService.services.short_description && (
                                    <div style={{ fontSize: '12px', color: '#999', marginTop: 4 }}>
                                      {therapistService.services.short_description}
                                    </div>
                                  )}
                                </div>
                                <Button
                                  danger
                                  size="small"
                                  icon={<DeleteOutlined />}
                                  onClick={() => handleRemoveService(therapistService.id)}
                                >
                                  Remove
                                </Button>
                              </div>
                            </div>
                          ))}
                          
                          {therapistServices.length === 0 && (
                            <div style={{ textAlign: 'center', padding: 20, color: '#999' }}>
                              No services selected. Add services from the available list.
                            </div>
                          )}
                        </div>
                      )}
                    </Card>
                  </Col>
                </Row>

                <div style={{ marginTop: 16, padding: 12, backgroundColor: '#f0f0f0', borderRadius: 4 }}>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    💡 <strong>Note:</strong> These services will be available for customers to book with this therapist. 
                    Make sure the therapist is qualified and comfortable providing each selected service.
                  </Text>
                </div>
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
        title={editingAvailability ? "Edit Availability" : "Add Availability"}
        open={availabilityModalVisible}
        onCancel={() => {
          setAvailabilityModalVisible(false);
          setEditingAvailability(null);
          availabilityForm.resetFields();
        }}
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
              {editingAvailability ? "Update Availability" : "Add Availability"}
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
