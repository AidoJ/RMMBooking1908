import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Button,
  Typography,
  Spin,
  message,
  Space,
} from 'antd';
import { PlusOutlined, DeleteOutlined, SaveOutlined } from '@ant-design/icons';
import { supabaseClient } from '../utility/supabaseClient';

const { Title, Text } = Typography;

interface Service {
  id: string;
  name: string;
  description?: string;
  short_description?: string;
  service_base_price?: number;
  minimum_duration?: number;
  is_active: boolean;
}

interface TherapistService {
  id: string;
  service_id: string;
  services: Service;
}

export const Services: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [therapistServices, setTherapistServices] = useState<TherapistService[]>([]);
  const [originalServices, setOriginalServices] = useState<TherapistService[]>([]); // Track original state
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [therapistProfileId, setTherapistProfileId] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
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

      // Load therapist's current services
      const { data: therapistServicesData, error: therapistError } = await supabaseClient
        .from('therapist_services')
        .select(`
          id,
          service_id,
          services:service_id(id, name, description, short_description, service_base_price, minimum_duration, is_active)
        `)
        .eq('therapist_id', profileData.id);

      if (therapistError) throw therapistError;

      // Load all available services
      const { data: allServicesData, error: allServicesError } = await supabaseClient
        .from('services')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')
        .order('name');

      if (allServicesError) throw allServicesError;

      const services = (therapistServicesData || []) as any;
      setTherapistServices(services);
      setOriginalServices(services); // Store original state
      setAllServices(allServicesData || []);
      setHasChanges(false);
    } catch (error) {
      console.error('Error loading services:', error);
      message.error('Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  const handleAddService = (serviceId: string) => {
    if (!therapistProfileId) {
      message.error('Profile not found. Please complete your profile first.');
      return;
    }

    // Find the service to add
    const serviceToAdd = allServices.find(s => s.id === serviceId);
    if (!serviceToAdd) return;

    // Create temporary therapist service object
    const tempTherapistService: TherapistService = {
      id: `temp-${Date.now()}`, // Temporary ID
      service_id: serviceId,
      services: serviceToAdd
    };

    setTherapistServices([...therapistServices, tempTherapistService]);
    setHasChanges(true);
  };

  const handleRemoveService = (therapistServiceId: string) => {
    setTherapistServices(therapistServices.filter(ts => ts.id !== therapistServiceId));
    setHasChanges(true);
  };

  const handleSaveChanges = async () => {
    if (!therapistProfileId) {
      message.error('Profile not found');
      return;
    }

    try {
      setSaving(true);

      // Determine which services to add and remove
      const originalServiceIds = originalServices.map(ts => ts.service_id);
      const currentServiceIds = therapistServices.map(ts => ts.service_id);

      const servicesToAdd = currentServiceIds.filter(id => !originalServiceIds.includes(id));
      const servicesToRemove = originalServices.filter(
        ts => !currentServiceIds.includes(ts.service_id)
      );

      // Remove services
      for (const ts of servicesToRemove) {
        const { error } = await supabaseClient
          .from('therapist_services')
          .delete()
          .eq('id', ts.id);

        if (error) throw error;
      }

      // Add new services
      if (servicesToAdd.length > 0) {
        const { error } = await supabaseClient
          .from('therapist_services')
          .insert(
            servicesToAdd.map(serviceId => ({
              therapist_id: therapistProfileId,
              service_id: serviceId
            }))
          );

        if (error) throw error;
      }

      message.success('Services updated successfully!');

      // Reload services to get actual IDs
      await loadServices();
    } catch (error) {
      console.error('Error saving services:', error);
      message.error('Failed to save services');
    } finally {
      setSaving(false);
    }
  };

  const availableServices = allServices.filter(
    service => !therapistServices.some(ts => ts.service_id === service.id)
  );

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <Title level={2}>My Services</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
        Select which services you can provide to customers. These will be available for booking.
      </Text>

      {!therapistProfileId && (
        <Card style={{ marginBottom: 24, backgroundColor: '#fff7e6', borderColor: '#ffd591' }}>
          <Text type="warning">
            Please complete your profile first before managing services
          </Text>
        </Card>
      )}

      <Row gutter={24}>
        <Col xs={24} lg={12}>
          <Card title="Available Services" style={{ height: '600px', overflowY: 'auto' }}>
            {availableServices.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
                <Text>All available services have been added</Text>
              </div>
            ) : (
              <div>
                {availableServices.map(service => (
                  <div
                    key={service.id}
                    style={{
                      marginBottom: 12,
                      padding: 16,
                      border: '1px solid #d9d9d9',
                      borderRadius: 8,
                      backgroundColor: '#fafafa',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <Text strong style={{ fontSize: '16px', display: 'block', marginBottom: 8 }}>
                          {service.name}
                        </Text>
                        {service.short_description && (
                          <Text type="secondary" style={{ fontSize: '14px', display: 'block', marginBottom: 8 }}>
                            {service.short_description}
                          </Text>
                        )}
                        {service.service_base_price && (
                          <Text style={{ fontSize: '14px', color: '#007e8c', fontWeight: 500 }}>
                            ${service.service_base_price} base price
                          </Text>
                        )}
                      </div>
                      <Button
                        type="primary"
                        size="large"
                        icon={<PlusOutlined />}
                        onClick={() => handleAddService(service.id)}
                        disabled={!therapistProfileId}
                        style={{ marginLeft: 16 }}
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="My Services" style={{ height: '600px', overflowY: 'auto' }}>
            {therapistServices.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
                <Text>No services selected. Add services from the available list.</Text>
              </div>
            ) : (
              <div>
                {therapistServices.map(therapistService => (
                  <div
                    key={therapistService.id}
                    style={{
                      marginBottom: 12,
                      padding: 16,
                      border: '1px solid #52c41a',
                      borderRadius: 8,
                      backgroundColor: '#f6ffed',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <Text strong style={{ fontSize: '16px', display: 'block', marginBottom: 8 }}>
                          {therapistService.services.name}
                        </Text>
                        {therapistService.services.short_description && (
                          <Text type="secondary" style={{ fontSize: '14px', display: 'block', marginBottom: 8 }}>
                            {therapistService.services.short_description}
                          </Text>
                        )}
                        {therapistService.services.service_base_price && (
                          <Text style={{ fontSize: '14px', color: '#007e8c', fontWeight: 500 }}>
                            ${therapistService.services.service_base_price} base price
                          </Text>
                        )}
                      </div>
                      <Button
                        danger
                        size="large"
                        icon={<DeleteOutlined />}
                        onClick={() => handleRemoveService(therapistService.id)}
                        style={{ marginLeft: 16 }}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {hasChanges && (
        <Card style={{ marginTop: 24, textAlign: 'center', backgroundColor: '#fff7e6', borderColor: '#ffa940' }}>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Text strong>You have unsaved changes</Text>
            <Button
              type="primary"
              size="large"
              icon={<SaveOutlined />}
              onClick={handleSaveChanges}
              loading={saving}
              style={{ minWidth: 200 }}
            >
              Save Changes
            </Button>
          </Space>
        </Card>
      )}

      <Card style={{ marginTop: 24, backgroundColor: '#f0f0f0' }}>
        <Text type="secondary" style={{ fontSize: '14px' }}>
          💡 <strong>Note:</strong> These services will be available for customers to book with you.
          Make sure you are qualified and comfortable providing each selected service.
        </Text>
      </Card>
    </div>
  );
};
