import React, { useState } from 'react';
import { Card, Form, Input, Button, message, Typography } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router';
import { supabaseClient } from '../utility/supabaseClient';

const { Title, Text, Link } = Typography;

export const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (values: { email: string; password: string }) => {
    try {
      setLoading(true);

      // Use Supabase Auth for authentication
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (error) {
        throw new Error(error.message || 'Authentication failed');
      }

      if (!data.user) {
        throw new Error('Login failed - no user returned');
      }

      // Fetch therapist_profiles record to get profile info
      console.log('🔍 Fetching profile for auth_id:', data.user.id);

      const { data: therapistProfile, error: profileError } = await supabaseClient
        .from('therapist_profiles')
        .select('*')
        .eq('auth_id', data.user.id)
        .single();

      console.log('Profile fetch result:', { therapistProfile, profileError });

      if (profileError || !therapistProfile) {
        console.error('❌ Failed to fetch therapist profile:', profileError);
        console.error('Auth ID was:', data.user.id);
        await supabaseClient.auth.signOut();
        throw new Error('Access denied - not a therapist user');
      }

      console.log('✅ Profile loaded:', therapistProfile.email);

      // Store therapist profile in localStorage for easy access
      localStorage.setItem('therapist_profile', JSON.stringify(therapistProfile));

      message.success('Welcome back!');
      // Force page reload to trigger auth check in App.tsx
      window.location.href = '/therapist/';
    } catch (error: any) {
      console.error('Login error:', error);
      message.error(error.message || 'Failed to log in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #007e8c 0%, #00a99d 100%)',
      }}
    >
      <Card style={{ width: '100%', maxWidth: 400, margin: '16px' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Title level={2} style={{ fontFamily: "'Josefin Sans', sans-serif", color: '#007e8c' }}>
            Rejuvenators
          </Title>
          <Text type="secondary">Therapist Portal</Text>
        </div>

        <Form onFinish={handleLogin} layout="vertical" size="large">
          <Form.Item
            name="email"
            rules={[
              { required: true, message: 'Please enter your email' },
              { type: 'email', message: 'Please enter a valid email' },
            ]}
          >
            <Input prefix={<UserOutlined />} placeholder="Email" />
          </Form.Item>

          <Form.Item name="password" rules={[{ required: true, message: 'Please enter your password' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="Password" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 16, textAlign: 'right' }}>
            <Link onClick={() => navigate('/forgot-password')} style={{ color: '#007e8c' }}>
              Forgot password?
            </Link>
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              style={{ background: '#007e8c', borderColor: '#007e8c' }}
            >
              Log In
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};
