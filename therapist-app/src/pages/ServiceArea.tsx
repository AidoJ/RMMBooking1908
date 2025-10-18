import React, { useState, useEffect } from 'react';
import { Typography, message, Spin, Card, Alert } from 'antd';
import { supabaseClient } from '../utility/supabaseClient';
import ServiceAreaPolygonEditor from '../components/ServiceAreaPolygonEditor';

const { Title } = Typography;

interface Coordinate {
  lat: number;
  lng: number;
}

export const ServiceArea: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [therapistId, setTherapistId] = useState<string | null>(null);
  const [homeAddress, setHomeAddress] = useState<string>('');
  const [latitude, setLatitude] = useState<number | undefined>(undefined);
  const [longitude, setLongitude] = useState<number | undefined>(undefined);
  const [serviceRadius, setServiceRadius] = useState<number>(10);
  const [serviceAreaPolygon, setServiceAreaPolygon] = useState<Coordinate[] | null>(null);

  useEffect(() => {
    loadServiceArea();
  }, []);

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
        .select('id, home_address, latitude, longitude, service_radius_km, service_area_polygon')
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
        setHomeAddress(profile.home_address || '');
        setLatitude(profile.latitude);
        setLongitude(profile.longitude);
        setServiceRadius(profile.service_radius_km || 10);
        setServiceAreaPolygon(profile.service_area_polygon || null);
      }
    } catch (error: any) {
      console.error('Error loading service area:', error);
      message.error('Failed to load service area');
    } finally {
      setLoading(false);
    }
  };

  const handlePolygonChange = async (polygon: Coordinate[] | null) => {
    if (!therapistId) {
      message.error('Therapist ID not found');
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabaseClient
        .from('therapist_profiles')
        .update({ service_area_polygon: polygon })
        .eq('id', therapistId);

      if (error) {
        console.error('Error updating service area:', error);
        message.error(`Failed to save service area: ${error.message}`);
        throw error;
      }

      setServiceAreaPolygon(polygon);
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

  if (!latitude || !longitude) {
    return (
      <div>
        <Title level={2}>Service Area</Title>
        <Card>
          <Alert
            message="Home Address Required"
            description="You need to set your home address in your profile before defining a service area. Please go to Profile page and add your home address."
            type="warning"
            showIcon
            style={{ marginBottom: '16px' }}
          />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <Title level={2}>Service Area</Title>

      <Card style={{ marginBottom: '24px' }}>
        <Alert
          message="Current Home Address"
          description={homeAddress || 'No address set'}
          type="info"
          showIcon
        />
      </Card>

      <ServiceAreaPolygonEditor
        centerLat={latitude}
        centerLng={longitude}
        serviceRadiusKm={serviceRadius}
        existingPolygon={serviceAreaPolygon || undefined}
        onPolygonChange={handlePolygonChange}
      />
    </div>
  );
};
