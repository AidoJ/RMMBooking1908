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
  Tabs,
  Table,
  Tag,
  Modal,
  Alert,
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
  KeyOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  CheckOutlined,
  EditOutlined,
  CloseOutlined,
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

interface ServiceRate {
  id?: string;
  therapist_id: string;
  service_id: string;
  service_name?: string;
  normal_rate: number;
  afterhours_rate: number;
  is_active: boolean;
  notes?: string;
}

// Combined interface for service with rate info
interface ServiceWithRate {
  service_id: string;
  service_name: string;
  service_description?: string;
  is_offered: boolean;
  has_custom_rate: boolean;
  rate_id?: string;
  normal_rate: number;
  afterhours_rate: number;
  default_normal_rate: number;
  default_afterhours_rate: number;
  is_active: boolean;
  notes?: string;
  is_editing?: boolean;
}

interface Availability {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

interface TimeOff {
  id?: string;
  start_date: string;
  end_date: string;
  reason?: string;
  status: string;
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
  const [timeOff, setTimeOff] = useState<TimeOff[]>([]);
  const [profileImage, setProfileImage] = useState<string>('');
  const [serviceAreaPolygon, setServiceAreaPolygon] = useState<Coordinate[] | null>(null);
  const [insuranceCertFile, setInsuranceCertFile] = useState<any[]>([]);
  const [firstAidCertFile, setFirstAidCertFile] = useState<any[]>([]);
  const [qualificationCertFile, setQualificationCertFile] = useState<any[]>([]);
  const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false);
  const [passwordForm] = Form.useForm();
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [syncWarnings, setSyncWarnings] = useState<{type: string; message: string; severity: 'error' | 'warning'}[]>([]);

  // Service-specific rates state
  const [serviceRates, setServiceRates] = useState<ServiceRate[]>([]);
  const [servicesWithRates, setServicesWithRates] = useState<ServiceWithRate[]>([]);
  const [isRateModalVisible, setIsRateModalVisible] = useState(false);
  const [editingRate, setEditingRate] = useState<ServiceRate | null>(null);
  const [rateForm] = Form.useForm();

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
      loadServiceRates();
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
      setUserId(therapistData.user_id || null);

      // Check for user sync issues
      const warnings: {type: string; message: string; severity: 'error' | 'warning'}[] = [];

      if (!therapistData.user_id) {
        warnings.push({
          type: 'missing_user',
          message: 'This therapist has no linked user account. They will not be able to login to the therapist app.',
          severity: 'error'
        });
      } else {
        // Check if user exists and has correct role
        const { data: userData, error: userError } = await supabaseClient
          .from('admin_users')
          .select('id, email, role')
          .eq('id', therapistData.user_id)
          .single();

        if (userError || !userData) {
          warnings.push({
            type: 'orphaned_user_id',
            message: `This therapist has user_id="${therapistData.user_id}" but this user account doesn't exist in the system.`,
            severity: 'error'
          });
        } else {
          setUserRole(userData.role);
          if (userData.role !== 'therapist') {
            warnings.push({
              type: 'role_mismatch',
              message: `Linked user account has role="${userData.role}" but should have role="therapist". Go to System Tools to fix this.`,
              severity: 'warning'
            });
          }
        }
      }

      setSyncWarnings(warnings);

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

      // Load time off
      const { data: timeOffData, error: timeOffError } = await supabaseClient
        .from('therapist_time_off')
        .select('*')
        .eq('therapist_id', id)
        .order('start_date', { ascending: false });

      if (timeOffError) throw timeOffError;
      setTimeOff(timeOffData || []);

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

  const loadServiceRates = async () => {
    if (!id) return;

    try {
      const { data, error } = await supabaseClient
        .from('therapist_service_rates')
        .select(`
          id,
          therapist_id,
          service_id,
          normal_rate,
          afterhours_rate,
          is_active,
          notes,
          services (name)
        `)
        .eq('therapist_id', id)
        .eq('is_active', true)
        .order('services(name)', { ascending: true });

      if (error) throw error;

      // Map the data to include service name
      const ratesWithNames = (data || []).map((rate: any) => ({
        id: rate.id,
        therapist_id: rate.therapist_id,
        service_id: rate.service_id,
        service_name: rate.services?.name || 'Unknown Service',
        normal_rate: rate.normal_rate,
        afterhours_rate: rate.afterhours_rate,
        is_active: rate.is_active,
        notes: rate.notes
      }));

      setServiceRates(ratesWithNames);

      // Also load the combined services with rates view
      loadServicesWithRates();
    } catch (error: any) {
      console.error('Error loading service rates:', error);
      message.error('Failed to load service rates');
    }
  };

  // Load ALL services and show which ones therapist offers with their rates
  const loadServicesWithRates = async () => {
    if (!id) return;

    try {
      // Get default rates from therapist profile
      const defaultNormalRate = form.getFieldValue('hourly_rate') || 0;
      const defaultAfterhoursRate = form.getFieldValue('afterhours_rate') || 0;

      // Load ALL services
      const { data: allServicesData, error: allServicesError } = await supabaseClient
        .from('services')
        .select('id, name, description')
        .eq('is_active', true)
        .order('name');

      if (allServicesError) throw allServicesError;

      // Load therapist's assigned services
      const { data: therapistServices, error: servicesError } = await supabaseClient
        .from('therapist_services')
        .select('service_id')
        .eq('therapist_id', id);

      if (servicesError) throw servicesError;

      const therapistServiceIds = new Set((therapistServices || []).map((ts: any) => ts.service_id));

      // Load existing service rates
      const { data: existingRates, error: ratesError } = await supabaseClient
        .from('therapist_service_rates')
        .select('*')
        .eq('therapist_id', id)
        .eq('is_active', true);

      if (ratesError) throw ratesError;

      // Merge ALL services with their assignment status and rates
      const merged: ServiceWithRate[] = (allServicesData || []).map((service: any) => {
        const isOffered = therapistServiceIds.has(service.id);
        const existingRate = existingRates?.find(r => r.service_id === service.id);

        return {
          service_id: service.id,
          service_name: service.name || 'Unknown Service',
          service_description: service.description || '',
          is_offered: isOffered,
          has_custom_rate: !!existingRate,
          rate_id: existingRate?.id,
          normal_rate: existingRate?.normal_rate || defaultNormalRate,
          afterhours_rate: existingRate?.afterhours_rate || defaultAfterhoursRate,
          default_normal_rate: defaultNormalRate,
          default_afterhours_rate: defaultAfterhoursRate,
          is_active: existingRate?.is_active || false,
          notes: existingRate?.notes || '',
          is_editing: false
        };
      });

      setServicesWithRates(merged);
    } catch (error: any) {
      console.error('Error loading services with rates:', error);
      message.error('Failed to load services with rates');
    }
  };

  const handleAddServiceRate = () => {
    setEditingRate(null);
    rateForm.resetFields();
    setIsRateModalVisible(true);
  };

  const handleEditServiceRate = (rate: ServiceRate) => {
    setEditingRate(rate);
    rateForm.setFieldsValue({
      service_id: rate.service_id,
      normal_rate: rate.normal_rate,
      afterhours_rate: rate.afterhours_rate,
      notes: rate.notes
    });
    setIsRateModalVisible(true);
  };

  const handleDeleteServiceRate = async (rateId: string) => {
    try {
      const { error } = await supabaseClient
        .from('therapist_service_rates')
        .update({ is_active: false })
        .eq('id', rateId);

      if (error) throw error;

      message.success('Service rate removed successfully');
      loadServiceRates();
    } catch (error: any) {
      console.error('Error deleting service rate:', error);
      message.error('Failed to remove service rate');
    }
  };

  const handleSaveServiceRate = async () => {
    try {
      const values = await rateForm.validateFields();

      if (editingRate?.id) {
        // Update existing rate
        const { error } = await supabaseClient
          .from('therapist_service_rates')
          .update({
            normal_rate: values.normal_rate,
            afterhours_rate: values.afterhours_rate,
            notes: values.notes
          })
          .eq('id', editingRate.id);

        if (error) {
          console.error('Update error details:', error);
          throw error;
        }
        message.success('Service rate updated successfully');
      } else {
        // Insert new rate
        const { data, error } = await supabaseClient
          .from('therapist_service_rates')
          .insert({
            therapist_id: id,
            service_id: values.service_id,
            normal_rate: values.normal_rate,
            afterhours_rate: values.afterhours_rate,
            notes: values.notes,
            is_active: true
          });

        if (error) {
          console.error('Insert error details:', error);
          console.error('Error message:', error.message);
          console.error('Error code:', error.code);
          console.error('Error details:', error.details);
          throw error;
        }
        message.success('Service rate added successfully');
      }

      setIsRateModalVisible(false);
      rateForm.resetFields();
      loadServiceRates();
    } catch (error: any) {
      console.error('Error saving service rate:', error);

      // Show detailed error message
      const errorMessage = error?.message || error?.details || 'Failed to save service rate';
      message.error(`Failed to save: ${errorMessage}`);
    }
  };

  // New inline editing handlers for services with rates
  const handleToggleCustomRate = async (service: ServiceWithRate) => {
    if (!id) return;

    try {
      if (service.has_custom_rate && service.rate_id) {
        // Deactivate custom rate
        const { error } = await supabaseClient
          .from('therapist_service_rates')
          .update({ is_active: false })
          .eq('id', service.rate_id);

        if (error) throw error;
        message.success('Custom rate removed');
      } else {
        // Check if an inactive record already exists
        const { data: existingRate } = await supabaseClient
          .from('therapist_service_rates')
          .select('id')
          .eq('therapist_id', id)
          .eq('service_id', service.service_id)
          .maybeSingle();

        if (existingRate) {
          // Reactivate existing rate
          const { error } = await supabaseClient
            .from('therapist_service_rates')
            .update({
              is_active: true,
              normal_rate: service.normal_rate,
              afterhours_rate: service.afterhours_rate,
              notes: service.notes || null
            })
            .eq('id', existingRate.id);

          if (error) throw error;
          message.success('Custom rate activated');
        } else {
          // Create new custom rate with current default values
          const { error } = await supabaseClient
            .from('therapist_service_rates')
            .insert({
              therapist_id: id,
              service_id: service.service_id,
              normal_rate: service.normal_rate,
              afterhours_rate: service.afterhours_rate,
              is_active: true,
              notes: service.notes || null
            });

          if (error) throw error;
          message.success('Custom rate activated');
        }
      }

      loadServiceRates();
    } catch (error: any) {
      console.error('Error toggling custom rate:', error);
      message.error('Failed to update custom rate');
    }
  };

  const handleToggleServiceOffered = async (service: ServiceWithRate) => {
    if (!id) return;

    try {
      if (service.is_offered) {
        // Remove service from therapist_services
        const { error } = await supabaseClient
          .from('therapist_services')
          .delete()
          .eq('therapist_id', id)
          .eq('service_id', service.service_id);

        if (error) throw error;
        message.success(`${service.service_name} removed from therapist services`);
      } else {
        // Add service to therapist_services
        const { error } = await supabaseClient
          .from('therapist_services')
          .insert({
            therapist_id: id,
            service_id: service.service_id
          });

        if (error) {
          // Check if it's a duplicate error (service already exists)
          if (error.message.includes('duplicate')) {
            message.info(`${service.service_name} is already assigned`);
          } else {
            throw error;
          }
        } else {
          message.success(`${service.service_name} added to therapist services`);
        }
      }

      // Wait for DB operation to complete before reloading
      await loadServicesWithRates();
    } catch (error: any) {
      console.error('Error toggling service offered:', error);
      message.error('Failed to update service');
    }
  };

  const handleUpdateServiceRate = (serviceId: string, field: string, value: any) => {
    setServicesWithRates(prev => prev.map(s =>
      s.service_id === serviceId ? { ...s, [field]: value } : s
    ));
  };

  const handleSaveServiceWithRate = async (service: ServiceWithRate) => {
    if (!id) return;

    try {
      // STEP 1: Ensure service is in therapist_services table first
      if (!service.is_offered) {
        const { error: serviceError } = await supabaseClient
          .from('therapist_services')
          .insert({
            therapist_id: id,
            service_id: service.service_id
          });

        if (serviceError) {
          // Check if it's a duplicate error (service already exists)
          if (!serviceError.message.includes('duplicate')) {
            throw serviceError;
          }
        }
      }

      // STEP 2: Save the rate
      if (service.rate_id) {
        // Update existing rate
        const { error } = await supabaseClient
          .from('therapist_service_rates')
          .update({
            normal_rate: service.normal_rate,
            afterhours_rate: service.afterhours_rate,
            notes: service.notes || null,
            is_active: true
          })
          .eq('id', service.rate_id);

        if (error) throw error;
        message.success('Rate updated successfully');
      } else {
        // Check if an inactive rate already exists for this service
        const { data: existingRate } = await supabaseClient
          .from('therapist_service_rates')
          .select('id')
          .eq('therapist_id', id)
          .eq('service_id', service.service_id)
          .maybeSingle();

        if (existingRate) {
          // Update existing rate
          const { error } = await supabaseClient
            .from('therapist_service_rates')
            .update({
              normal_rate: service.normal_rate,
              afterhours_rate: service.afterhours_rate,
              notes: service.notes || null,
              is_active: true
            })
            .eq('id', existingRate.id);

          if (error) throw error;
          message.success('Rate updated successfully');
        } else {
          // Create new rate
          const { error } = await supabaseClient
            .from('therapist_service_rates')
            .insert({
              therapist_id: id,
              service_id: service.service_id,
              normal_rate: service.normal_rate,
              afterhours_rate: service.afterhours_rate,
              notes: service.notes || null,
              is_active: true
            });

          if (error) throw error;
          message.success('Custom rate created successfully');
        }
      }

      loadServicesWithRates();
    } catch (error: any) {
      console.error('Error saving service rate:', error);
      message.error('Failed to save rate');
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

  const handleResetPassword = async (values: any) => {
    try {
      if (!userId) {
        message.error('No user account linked to this therapist');
        return;
      }

      const token = localStorage.getItem('adminToken');

      const response = await fetch('/.netlify/functions/user-management', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'reset-password',
          data: {
            id: userId,
            newPassword: values.newPassword
          }
        })
      });

      const result = await response.json();
      if (!result.success) throw new Error(result.error);

      setIsPasswordModalVisible(false);
      passwordForm.resetFields();
      message.success('Password reset successfully');
    } catch (error: any) {
      console.error('Error resetting password:', error);
      message.error(error.message || 'Failed to reset password');
    }
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

  const addTimeOffSlot = () => {
    setTimeOff([...timeOff, {
      start_date: dayjs().format('YYYY-MM-DD'),
      end_date: dayjs().add(1, 'day').format('YYYY-MM-DD'),
      reason: '',
      status: 'pending'
    }]);
  };

  const removeTimeOffSlot = (index: number) => {
    setTimeOff(timeOff.filter((_, i) => i !== index));
  };

  const updateTimeOffSlot = (index: number, field: keyof TimeOff, value: any) => {
    const updated = [...timeOff];
    updated[index] = { ...updated[index], [field]: value };
    setTimeOff(updated);
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

      // Check if email has changed
      const emailChanged = therapist?.email !== values.email;

      // Update therapist profile with coordinates and polygon
      const { data: updatedTherapist, error: updateError } = await supabaseClient
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
        .eq('id', id)
        .select('user_id')
        .single();

      if (updateError) throw updateError;

      // If email changed, also update the admin_users table
      if (emailChanged && updatedTherapist?.user_id) {
        const { error: userUpdateError } = await supabaseClient
          .from('admin_users')
          .update({ email: values.email })
          .eq('id', updatedTherapist.user_id);

        if (userUpdateError) {
          console.error('Failed to update user email:', userUpdateError);
          message.warning('Therapist profile updated but user account email sync failed');
        }
      }

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

      // Update time off
      // First, remove all existing time off
      const { error: deleteTimeOffError } = await supabaseClient
        .from('therapist_time_off')
        .delete()
        .eq('therapist_id', id);

      if (deleteTimeOffError) throw deleteTimeOffError;

      // Then add the current time off
      if (timeOff.length > 0) {
        const timeOffInserts = timeOff.map(to => ({
          therapist_id: id,
          start_date: to.start_date,
          end_date: to.end_date,
          reason: to.reason,
          status: to.status
        }));

        const { error: insertTimeOffError } = await supabaseClient
          .from('therapist_time_off')
          .insert(timeOffInserts);

        if (insertTimeOffError) throw insertTimeOffError;
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
            {userId && (
              <Col>
                <Button
                  type="primary"
                  icon={<KeyOutlined />}
                  onClick={() => setIsPasswordModalVisible(true)}
                >
                  Reset Password
                </Button>
              </Col>
            )}
          </Row>
        </Card>

        {/* User Sync Warnings */}
        {syncWarnings.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            {syncWarnings.map((warning, index) => (
              <Alert
                key={index}
                message={warning.severity === 'error' ? 'User Sync Error' : 'User Sync Warning'}
                description={warning.message}
                type={warning.severity === 'error' ? 'error' : 'warning'}
                showIcon
                icon={warning.severity === 'error' ? <ExclamationCircleOutlined /> : <WarningOutlined />}
                style={{ marginBottom: index < syncWarnings.length - 1 ? '12px' : 0 }}
                action={
                  <Space direction="vertical">
                    <Button
                      size="small"
                      onClick={() => navigate('/system-tools')}
                    >
                      Go to System Tools
                    </Button>
                  </Space>
                }
              />
            ))}
          </div>
        )}

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          size="large"
        >
          {/* Profile Header */}
          <Card style={{ marginBottom: '24px' }}>
            <div style={{ textAlign: 'center' }}>
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
          </Card>

          {/* Tabbed Form Content */}
          <Card>
            <Tabs
              defaultActiveKey="bio"
              items={[
                {
                  key: 'bio',
                  label: 'Bio',
                  children: (
                    <div>
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

                      <Form.Item name="phone" label="Phone Number">
                        <Input placeholder="Enter phone number" />
                      </Form.Item>

                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item name="gender" label="Gender">
                            <Select placeholder="Select gender">
                              <Option value="male">Male</Option>
                              <Option value="female">Female</Option>
                              <Option value="other">Other</Option>
                              <Option value="prefer_not_to_say">Prefer not to say</Option>
                            </Select>
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="years_experience" label="Years of Experience">
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

                      <Form.Item name="bio" label="Biography">
                        <TextArea
                          rows={6}
                          placeholder="Enter therapist biography..."
                          maxLength={2000}
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
                          <Form.Item
                            label="Hourly Rate"
                            name="hourly_rate"
                            rules={[
                              { required: true, message: 'Hourly rate is required' },
                              { type: 'number', min: 0.01, message: 'Must be greater than $0' }
                            ]}
                          >
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
                          <Form.Item
                            label="After Hours Rate"
                            name="afterhours_rate"
                            rules={[
                              { required: true, message: 'After hours rate is required' },
                              { type: 'number', min: 0.01, message: 'Must be greater than $0' }
                            ]}
                          >
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

                      <Alert
                        message="Service-Specific Rates"
                        description="Service-specific rates can now be managed in the 'Services & Rates' tab above."
                        type="info"
                        showIcon
                        style={{ marginBottom: 16 }}
                      />

                      <Divider orientation="left">Status & Verification</Divider>

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
                    </div>
                  ),
                },
                {
                  key: 'services',
                  label: 'Services & Rates',
                  children: (
                    <div>

                      <Alert
                        message="Manage Services & Rates"
                        description="Check 'Offered' to enable a service for this therapist. Toggle 'Custom Rate' to override default rates for specific services. Unchecked services use profile default rates."
                        type="info"
                        showIcon
                        style={{ marginBottom: 16 }}
                      />

                      {!isSuperAdmin && (
                        <Alert
                          message="Restricted Access"
                          description="Only superadmin users can modify services and rates"
                          type="warning"
                          showIcon
                          style={{ marginBottom: 16 }}
                        />
                      )}

                      <Table
                        dataSource={servicesWithRates}
                        rowKey="service_id"
                        pagination={false}
                        size="small"
                        locale={{ emptyText: 'No services available in the system.' }}
                        columns={[
                          {
                            title: 'Offered',
                            dataIndex: 'is_offered',
                            key: 'offered',
                            width: 80,
                            align: 'center',
                            render: (isOffered: boolean, record: ServiceWithRate) => (
                              <Checkbox
                                checked={isOffered}
                                onChange={() => handleToggleServiceOffered(record)}
                                disabled={!canEditTherapists}
                              />
                            ),
                          },
                          {
                            title: 'Custom Rate',
                            dataIndex: 'has_custom_rate',
                            key: 'custom_rate',
                            width: 100,
                            align: 'center',
                            render: (hasCustom: boolean, record: ServiceWithRate) => (
                              <Switch
                                checked={hasCustom}
                                onChange={() => handleToggleCustomRate(record)}
                                disabled={!isSuperAdmin || !record.is_offered}
                                checkedChildren={<CheckOutlined />}
                                unCheckedChildren={<CloseOutlined />}
                              />
                            ),
                          },
                          {
                            title: 'Service',
                            dataIndex: 'service_name',
                            key: 'service_name',
                            render: (name: string) => (
                              <div style={{ fontWeight: 500 }}>{name}</div>
                            ),
                          },
                          {
                            title: 'Normal Rate',
                            dataIndex: 'normal_rate',
                            key: 'normal_rate',
                            width: 130,
                            render: (rate: number, record: ServiceWithRate) => (
                              <InputNumber
                                value={rate}
                                onChange={(value) => handleUpdateServiceRate(record.service_id, 'normal_rate', value || 0)}
                                prefix="$"
                                suffix="/hr"
                                min={0}
                                step={1}
                                disabled={!isSuperAdmin || !record.is_offered}
                                style={{
                                  width: '100%',
                                  color: record.has_custom_rate ? '#000' : '#999'
                                }}
                              />
                            ),
                          },
                          {
                            title: 'After Hours Rate',
                            dataIndex: 'afterhours_rate',
                            key: 'afterhours_rate',
                            width: 150,
                            render: (rate: number, record: ServiceWithRate) => (
                              <InputNumber
                                value={rate}
                                onChange={(value) => handleUpdateServiceRate(record.service_id, 'afterhours_rate', value || 0)}
                                prefix="$"
                                suffix="/hr"
                                min={0}
                                step={1}
                                disabled={!isSuperAdmin || !record.is_offered}
                                style={{
                                  width: '100%',
                                  color: record.has_custom_rate ? '#000' : '#999'
                                }}
                              />
                            ),
                          },
                          {
                            title: 'Notes',
                            dataIndex: 'notes',
                            key: 'notes',
                            render: (notes: string, record: ServiceWithRate) => (
                              <Input
                                value={notes}
                                onChange={(e) => handleUpdateServiceRate(record.service_id, 'notes', e.target.value)}
                                placeholder="e.g. Higher rate for specialized certification"
                                disabled={!isSuperAdmin || !record.is_offered}
                              />
                            ),
                          },
                          {
                            title: 'Actions',
                            key: 'actions',
                            width: 100,
                            align: 'center',
                            render: (_: any, record: ServiceWithRate) => (
                              <Space>
                                {isSuperAdmin && record.is_offered && (
                                  <Button
                                    type="primary"
                                    size="small"
                                    icon={<SaveOutlined />}
                                    onClick={() => handleSaveServiceWithRate(record)}
                                    disabled={!record.has_custom_rate &&
                                      record.normal_rate === record.default_normal_rate &&
                                      record.afterhours_rate === record.default_afterhours_rate}
                                  >
                                    Save
                                  </Button>
                                )}
                              </Space>
                            ),
                          },
                        ]}
                      />
                    </div>
                  ),
                },
                {
                  key: 'service-area',
                  label: 'Service Area',
                  children: (
                    <div>
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

                      <Form.Item
                        name="timezone"
                        label="Timezone"
                        rules={[{ required: true, message: 'Please select a timezone' }]}
                        help="Select the timezone for this therapist's service area (where they deliver services)"
                      >
                        <Select placeholder="Select timezone">
                          <Option value="Australia/Perth">Australia/Perth (AWST, UTC+8, no DST)</Option>
                          <Option value="Australia/Adelaide">Australia/Adelaide (ACST/ACDT, UTC+9:30/+10:30)</Option>
                          <Option value="Australia/Darwin">Australia/Darwin (ACST, UTC+9:30, no DST)</Option>
                          <Option value="Australia/Brisbane">Australia/Brisbane (AEST, UTC+10, no DST)</Option>
                          <Option value="Australia/Sydney">Australia/Sydney (AEST/AEDT, UTC+10/+11)</Option>
                          <Option value="Australia/Melbourne">Australia/Melbourne (AEST/AEDT, UTC+10/+11)</Option>
                          <Option value="Australia/Hobart">Australia/Hobart (AEST/AEDT, UTC+10/+11)</Option>
                        </Select>
                      </Form.Item>

                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item name="latitude" label="Latitude">
                            <InputNumber
                              placeholder="Auto-populated"
                              readOnly
                              style={{ width: '100%', backgroundColor: '#f5f5f5' }}
                              precision={6}
                            />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="longitude" label="Longitude">
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

                      <Divider orientation="left">Service Area Polygon</Divider>

                      <ServiceAreaPolygonEditor
                        centerLat={coordinateFields.latitude}
                        centerLng={coordinateFields.longitude}
                        serviceRadiusKm={form.getFieldValue('service_radius_km') || 10}
                        existingPolygon={serviceAreaPolygon || undefined}
                        onPolygonChange={(polygon) => setServiceAreaPolygon(polygon)}
                      />
                    </div>
                  ),
                },
                {
                  key: 'availability',
                  label: 'Availability',
                  children: (
                    <div>
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
                    </div>
                  ),
                },
                {
                  key: 'time-off',
                  label: 'Time Off',
                  children: (
                    <div>
                      <div style={{ marginBottom: '16px' }}>
                        <Button
                          type="dashed"
                          icon={<PlusOutlined />}
                          onClick={addTimeOffSlot}
                          block
                        >
                          Add Time Off Period
                        </Button>
                      </div>

                      {timeOff.map((to, index) => (
                        <div key={index} style={{ marginBottom: '16px', padding: '12px', border: '1px solid #d9d9d9', borderRadius: '6px' }}>
                          <Row gutter={16} align="middle">
                            <Col span={6}>
                              <DatePicker
                                value={dayjs(to.start_date)}
                                onChange={(date) => updateTimeOffSlot(index, 'start_date', date?.format('YYYY-MM-DD'))}
                                format="DD/MM/YYYY"
                                style={{ width: '100%' }}
                                placeholder="Start Date"
                              />
                            </Col>
                            <Col span={6}>
                              <DatePicker
                                value={dayjs(to.end_date)}
                                onChange={(date) => updateTimeOffSlot(index, 'end_date', date?.format('YYYY-MM-DD'))}
                                format="DD/MM/YYYY"
                                style={{ width: '100%' }}
                                placeholder="End Date"
                              />
                            </Col>
                            <Col span={6}>
                              <Input
                                value={to.reason}
                                onChange={(e) => updateTimeOffSlot(index, 'reason', e.target.value)}
                                placeholder="Reason (optional)"
                              />
                            </Col>
                            <Col span={4}>
                              <Select
                                value={to.status}
                                onChange={(value) => updateTimeOffSlot(index, 'status', value)}
                                style={{ width: '100%' }}
                              >
                                <Option value="pending">Pending</Option>
                                <Option value="approved">Approved</Option>
                                <Option value="rejected">Rejected</Option>
                              </Select>
                            </Col>
                            <Col span={2}>
                              <Button
                                type="text"
                                danger
                                icon={<DeleteOutlined />}
                                onClick={() => removeTimeOffSlot(index)}
                              />
                            </Col>
                          </Row>
                        </div>
                      ))}
                    </div>
                  ),
                },
              ]}
            />
          </Card>

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

        {/* Password Reset Modal */}
        <Modal
          title={`Reset Password for ${therapist?.first_name} ${therapist?.last_name}`}
          open={isPasswordModalVisible}
          onCancel={() => {
            setIsPasswordModalVisible(false);
            passwordForm.resetFields();
          }}
          footer={null}
          width={500}
        >
          <Form
            form={passwordForm}
            layout="vertical"
            onFinish={handleResetPassword}
          >
            <Form.Item
              name="newPassword"
              label="New Password"
              rules={[
                { required: true, message: 'Please enter new password' },
                { min: 8, message: 'Password must be at least 8 characters' },
                {
                  pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                  message: 'Password must contain uppercase, lowercase, and numbers'
                }
              ]}
            >
              <Input.Password size="large" placeholder="Enter new password" />
            </Form.Item>

            <Form.Item
              name="confirmPassword"
              label="Confirm Password"
              dependencies={['newPassword']}
              rules={[
                { required: true, message: 'Please confirm password' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('newPassword') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('Passwords do not match'));
                  },
                }),
              ]}
            >
              <Input.Password size="large" placeholder="Confirm new password" />
            </Form.Item>

            <Form.Item>
              <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                <Button onClick={() => {
                  setIsPasswordModalVisible(false);
                  passwordForm.resetFields();
                }}>
                  Cancel
                </Button>
                <Button type="primary" htmlType="submit">
                  Reset Password
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>

        {/* Service Rate Add/Edit Modal */}
        <Modal
          title={editingRate ? 'Edit Service Rate' : 'Add Service Rate'}
          open={isRateModalVisible}
          onOk={handleSaveServiceRate}
          onCancel={() => {
            setIsRateModalVisible(false);
            rateForm.resetFields();
          }}
          okText="Save"
          cancelText="Cancel"
        >
          <Form
            form={rateForm}
            layout="vertical"
          >
            <Form.Item
              label="Service"
              name="service_id"
              rules={[{ required: true, message: 'Please select a service' }]}
            >
              <Select
                placeholder="Select a service"
                disabled={!!editingRate}
                showSearch
                filterOption={(input, option) =>
                  (option?.children as string).toLowerCase().includes(input.toLowerCase())
                }
              >
                {allServices
                  .filter(service =>
                    // Don't show services that already have rates (unless editing)
                    editingRate?.service_id === service.id ||
                    !serviceRates.find(sr => sr.service_id === service.id)
                  )
                  .map(service => (
                    <Option key={service.id} value={service.id}>
                      {service.name}
                    </Option>
                  ))}
              </Select>
            </Form.Item>

            <Form.Item
              label="Normal Hours Rate (per hour)"
              name="normal_rate"
              rules={[
                { required: true, message: 'Please enter normal rate' },
                { type: 'number', min: 0.01, message: 'Rate must be greater than $0' }
              ]}
            >
              <InputNumber
                prefix="$"
                style={{ width: '100%' }}
                min={0}
                step={0.01}
                placeholder="e.g., 95.00"
              />
            </Form.Item>

            <Form.Item
              label="After Hours Rate (per hour)"
              name="afterhours_rate"
              rules={[
                { required: true, message: 'Please enter after hours rate' },
                { type: 'number', min: 0.01, message: 'Rate must be greater than $0' }
              ]}
            >
              <InputNumber
                prefix="$"
                style={{ width: '100%' }}
                min={0}
                step={0.01}
                placeholder="e.g., 110.00"
              />
            </Form.Item>

            <Form.Item
              label="Notes (Optional)"
              name="notes"
            >
              <TextArea
                rows={3}
                placeholder="e.g., Higher rate due to specialized certification"
              />
            </Form.Item>

            <Alert
              message="Rate Information"
              description="These rates will be used instead of the default hourly rates when this therapist performs this specific service. Weekends and after-hours will use the after hours rate."
              type="info"
              showIcon
            />
          </Form>
        </Modal>
      </div>
    </RoleGuard>
  );
};

export default TherapistEdit;