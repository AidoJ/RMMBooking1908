import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, message, Typography, Alert } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router';
import { supabaseClient } from '../utility/supabaseClient';

const { Title, Text } = Typography;

export const ResetPassword: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    // Check if user arrived via password reset link
    const checkSession = async () => {
      const { data: { session }, error } = await supabaseClient.auth.getSession();

      if (error) {
        console.error('Session error:', error);
        setError('Invalid or expired reset link');
        return;
      }

      if (session) {
        setHasSession(true);
      } else {
        setError('Invalid or expired reset link. Please request a new password reset.');
      }
    };

    checkSession();
  }, []);

  const handleSubmit = async (values: { password: string; confirmPassword: string }) => {
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabaseClient.auth.updateUser({
        password: values.password
      });

      if (error) {
        setError(error.message || 'Failed to reset password');
        message.error(error.message || 'Failed to reset password');
      } else {
        setSuccess(true);
        message.success('Password reset successful');

        // Sign out and redirect to login after 3 seconds
        setTimeout(async () => {
          await supabaseClient.auth.signOut();
          navigate('/therapist/login');
        }, 3000);
      }
    } catch (error) {
      console.error('Password reset error:', error);
      setError('An error occurred. Please try again.');
      message.error('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
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
              Password Reset Successful
            </Title>
          </div>

          <Alert
            type="success"
            message="Your password has been reset"
            description="You can now log in with your new password. Redirecting to login page..."
            showIcon
            style={{ marginBottom: 24 }}
          />

          <Button
            type="primary"
            block
            onClick={() => navigate('/therapist/login')}
            style={{ background: '#007e8c', borderColor: '#007e8c' }}
          >
            Go to Login
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
          <Text type="secondary">Set New Password</Text>
        </div>

        {error && (
          <Alert
            type="error"
            message="Error"
            description={error}
            showIcon
            style={{ marginBottom: 24 }}
            closable
            onClose={() => setError(null)}
          />
        )}

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          size="large"
          disabled={!hasSession}
        >
          <Form.Item
            name="password"
            label="New Password"
            rules={[
              { required: true, message: 'Please enter your new password' },
              { min: 8, message: 'Password must be at least 8 characters' },
              {
                pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/,
                message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
              }
            ]}
            hasFeedback
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Enter new password"
              autoComplete="new-password"
            />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="Confirm Password"
            dependencies={['password']}
            hasFeedback
            rules={[
              { required: true, message: 'Please confirm your password' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Passwords do not match'));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Confirm new password"
              autoComplete="new-password"
            />
          </Form.Item>

          <Alert
            type="info"
            message="Password Requirements"
            description={
              <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
                <li>At least 8 characters long</li>
                <li>Contains at least one uppercase letter (A-Z)</li>
                <li>Contains at least one lowercase letter (a-z)</li>
                <li>Contains at least one number (0-9)</li>
              </ul>
            }
            style={{ marginBottom: 24 }}
          />

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={loading}
              disabled={!hasSession}
              style={{ background: '#007e8c', borderColor: '#007e8c' }}
            >
              Reset Password
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
