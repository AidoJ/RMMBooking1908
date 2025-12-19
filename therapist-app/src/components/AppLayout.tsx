import React, { useState } from 'react';
import { Layout, Drawer, Menu, Avatar, Typography, Space } from 'antd';
import {
  MenuOutlined,
  DashboardOutlined,
  CalendarOutlined,
  UserOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  DollarOutlined,
  FileTextOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabaseClient } from '../utility/supabaseClient';

const { Header, Content } = Layout;
const { Text } = Typography;

interface AppLayoutProps {
  children: React.ReactNode;
  therapistName?: string;
  profilePic?: string;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children, therapistName, profilePic }) => {
  const [drawerVisible, setDrawerVisible] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    // Sign out from Supabase Auth
    await supabaseClient.auth.signOut();
    // Clear therapist profile from localStorage
    localStorage.removeItem('therapist_profile');
    // Redirect to login page
    window.location.href = '/therapist/login';
  };

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
    },
    {
      key: '/calendar',
      icon: <CalendarOutlined />,
      label: 'Calendar',
    },
    {
      key: '/bookings',
      icon: <FileTextOutlined />,
      label: 'My Bookings',
    },
    {
      key: '/profile',
      icon: <UserOutlined />,
      label: 'My Profile',
    },
    {
      key: '/services',
      icon: <FileTextOutlined />,
      label: 'My Services',
    },
    {
      key: '/availability',
      icon: <ClockCircleOutlined />,
      label: 'Availability',
    },
    {
      key: '/time-off',
      icon: <ClockCircleOutlined />,
      label: 'Time Off',
    },
    {
      key: '/service-area',
      icon: <EnvironmentOutlined />,
      label: 'Service Area',
    },
    {
      key: '/my-earnings',
      icon: <DollarOutlined />,
      label: 'My Earnings',
    },
    {
      key: '/invoices',
      icon: <FileTextOutlined />,
      label: 'Invoices',
    },
  ];

  const handleMenuClick = (key: string) => {
    navigate(key);
    setDrawerVisible(false);
  };

  return (
    <Layout style={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      <Header
        style={{
          background: '#007e8c',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          position: 'sticky',
          top: 0,
          zIndex: 1000,
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img
            src="/therapist/hand.png"
            alt="Rejuvenators Logo"
            style={{ width: '50px', height: '50px', objectFit: 'contain', flexShrink: 0 }}
          />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <Text strong style={{
              color: 'white',
              fontSize: 'clamp(16px, 4vw, 24px)',
              letterSpacing: '2px',
              lineHeight: '1.2',
              margin: 0,
              whiteSpace: 'nowrap'
            }}>
              REJUVENATORS<sup style={{ fontSize: '0.5em' }}>®</sup>
            </Text>
            <Text style={{
              color: 'white',
              fontSize: 'clamp(12px, 3vw, 16px)',
              fontStyle: 'italic',
              fontWeight: 300,
              lineHeight: '1.2',
              margin: 0,
              whiteSpace: 'nowrap'
            }}>
              Therapist Portal
            </Text>
          </div>
        </div>

        {/* Hamburger Menu */}
        <MenuOutlined
          style={{ fontSize: '24px', color: 'white', cursor: 'pointer', flexShrink: 0 }}
          onClick={() => setDrawerVisible(true)}
        />
      </Header>

      <Content style={{ padding: '16px' }}>
        {children}
      </Content>

      {/* Navigation Drawer */}
      <Drawer
        title={
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <Avatar
              size={64}
              src={profilePic}
              icon={<UserOutlined />}
              style={{ backgroundColor: '#007e8c' }}
            />
            <Text strong style={{ fontSize: '16px' }}>
              {therapistName || 'Therapist'}
            </Text>
          </Space>
        }
        placement="right"
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        width={280}
        zIndex={1050}
        styles={{
          header: {
            borderBottom: '1px solid #f0f0f0',
            paddingBottom: '16px',
          },
        }}
      >
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          onClick={({ key }) => handleMenuClick(key)}
          style={{ border: 'none' }}
          items={menuItems}
        />

        <div style={{ position: 'absolute', bottom: 16, left: 0, right: 0, padding: '0 24px' }}>
          <Menu
            mode="inline"
            style={{ border: 'none' }}
            items={[
              {
                key: 'logout',
                icon: <LogoutOutlined />,
                label: 'Logout',
                danger: true,
                onClick: handleLogout,
              },
            ]}
          />
        </div>
      </Drawer>
    </Layout>
  );
};
