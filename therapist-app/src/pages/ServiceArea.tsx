import React, { useState, useEffect } from 'react';
import {
  Typography,
  message,
  Spin,
  Card,
  Form,
  Input,
  Button,
  InputNumber,
  Row,
  Col,
} from 'antd';
import { EnvironmentOutlined, SaveOutlined } from '@ant-design/icons';
import { supabaseClient } from '../utility/supabaseClient';
import ServiceAreaPolygonEditor from '../components/ServiceAreaPolygonEditor';
import { useAddressGeocoding } from '../hooks/useAddressGeocoding';

const { Title } = Typography;
const { TextArea } = Input;

interface Coordinate {
  lat: number;
  lng: number;
}

export const ServiceArea: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [therapistId, setTherapistId] = useState<string | null>(null);
  const [serviceAreaPolygon, setServiceAreaPolygon] = useState<Coordinate[] | null>(null);

  // Geocoding hook for address verification
  const {
    isGeocoding,
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
      form.setFieldsValue({
        home_address: address
      });
    }
  });

  useEffect(() => {
    loadServiceArea();
  }, []);

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
  }, [loading, setupAutocomplete]);

  const loadServiceArea = async () => {
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

      // Get therapist profile
      const { data: profile, error } = await supabaseClient
        .from('therapist_profiles')
        .select('id, home_address, latitude, longitude, service_radius_km, service_area_polygon, address_verified')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          message.error('Profile not found. Please complete your profile first.');
        } else {
          throw error;
        }
        return;
      }

      if (profile) {
        setTherapistId(profile.id);
        setServiceAreaPolygon(profile.service_area_polygon || null);
        form.setFieldsValue({
          home_address: profile.home_address || '',
          latitude: profile.latitude,
          longitude: profile.longitude,
          service_radius_km: profile.service_radius_km || 10,
          address_verified: profile.address_verified || false
        });
      }
    } catch (error: any) {
      console.error('Error loading service area:', error);
      message.error('Failed to load service area');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values: any) => {
    if (!therapistId) {
      message.error('Therapist ID not found');
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabaseClient
        .from('therapist_profiles')
        .update({
          home_address: values.home_address,
          latitude: coordinateFields.latitude || values.latitude,
          longitude: coordinateFields.longitude || values.longitude,
          service_radius_km: values.service_radius_km,
          address_verified: coordinateFields.address_verified || values.address_verified,
          service_area_polygon: serviceAreaPolygon
        })
        .eq('id', therapistId);

      if (error) {
        console.error('Error updating service area:', error);
        message.error(`Failed to save service area: ${error.message}`);
        throw error;
      }

      message.success('Service area saved successfully!');
    } catch (error: any) {
      console.error('Error saving service area:', error);
      message.error(error?.message || 'Failed to save service area');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <Title level={2}>Service Area</Title>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          service_radius_km: 10
        }}
      >
        <Card title="Location & Service Area" style={{ marginBottom: '24px' }}>
          <Form.Item
            name="home_address"
            label="Home Address"
            help={geocodeError ? <span style={{ color: '#ff4d4f' }}>{geocodeError}</span> :
                  addressVerified ? <span style={{ color: '#52c41a' }}>✓ Address verified</span> :
                  'Enter address for automatic verification'}
            rules={[{ required: true, message: 'Please enter your home address' }]}
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
            rules={[{ required: true, message: 'Please enter service radius' }]}
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
          centerLat={coordinateFields.latitude || form.getFieldValue('latitude')}
          centerLng={coordinateFields.longitude || form.getFieldValue('longitude')}
          serviceRadiusKm={form.getFieldValue('service_radius_km') || 10}
          existingPolygon={serviceAreaPolygon || undefined}
          onPolygonChange={(polygon) => setServiceAreaPolygon(polygon)}
        />

        {/* Submit Button */}
        <Card>
          <div style={{ textAlign: 'center' }}>
            <Button
              type="primary"
              size="large"
              htmlType="submit"
              icon={<SaveOutlined />}
              loading={saving}
            >
              Save Service Area
            </Button>
          </div>
        </Card>
      </Form>
    </div>
  );
};
