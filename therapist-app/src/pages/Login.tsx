import React, { useState } from 'react';
import { Card, Form, Input, Button, message, Typography } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { supabaseClient } from '../utility/supabaseClient';

const { Title, Text } = Typography;

export const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);

  const handleLogin = async (values: { email: string; password: string }) => {
    try {
      setLoading(true);

      // Use Supabase Auth
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (error) throw error;

      if (!data.user) {
        throw new Error('No user data returned');
      }

      // Verify user is a therapist by checking therapist_profiles
      const { data: therapistProfile, error: profileError } = await supabaseClient
        .from('therapist_profiles')
        .select('*')
        .eq('user_id', data.user.id)
        .single();

      if (profileError || !therapistProfile) {
        await supabaseClient.auth.signOut();
        throw new Error('This account is not registered as a therapist');
      }

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
