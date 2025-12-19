import React, { useState } from 'react';
import { Card, Form, Input, Button, message, Typography, Alert } from 'antd';
import { MailOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router';
import { supabaseClient } from '../utility/supabaseClient';

const { Title, Text } = Typography;

export const ForgotPassword: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const handleSubmit = async (values: { email: string }) => {
    setLoading(true);

    try {
      const { error } = await supabaseClient.auth.resetPasswordForEmail(values.email, {
        redirectTo: `${window.location.origin}/therapist/reset-password`,
      });

      if (error) {
        console.error('Password reset error:', error);
        message.error(error.message || 'Failed to send reset email');
      } else {
        setSubmitted(true);
        message.success('Password reset instructions sent to your email');
      }
    } catch (error) {
      console.error('Password reset error:', error);
      message.error('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
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
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <Title level={2} style={{ fontFamily: "'Josefin Sans', sans-serif", color: '#007e8c' }}>
              Check Your Email
            </Title>
          </div>

          <Alert
            type="success"
            message="Reset Link Sent"
            description="If an account exists with this email, you will receive a password reset link shortly. The link will expire in 1 hour."
            showIcon
            style={{ marginBottom: 24 }}
          />

          <Button
            type="primary"
            block
            onClick={() => navigate('/therapist/login')}
            style={{ background: '#007e8c', borderColor: '#007e8c' }}
          >
            Back to Login
          </Button>
        </Card>
      </div>
    );
  }

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
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={2} style={{ fontFamily: "'Josefin Sans', sans-serif", color: '#007e8c' }}>
            Rejuvenators
          </Title>
          <Text type="secondary">Reset Your Password</Text>
        </div>

        <Text style={{ display: 'block', marginBottom: 24, textAlign: 'center' }}>
          Enter your email address and we'll send you a link to reset your password.
        </Text>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          size="large"
        >
          <Form.Item
            name="email"
            rules={[
              { required: true, message: 'Please enter your email' },
              { type: 'email', message: 'Please enter a valid email' }
            ]}
          >
            <Input
              prefix={<MailOutlined />}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={loading}
              style={{ background: '#007e8c', borderColor: '#007e8c' }}
            >
              Send Reset Link
            </Button>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'center' }}>
            <Button
              type="link"
              onClick={() => navigate('/therapist/login')}
            >
              Back to Login
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};
