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

  const handleLogout = () => {
    // Clear therapist session
    localStorage.removeItem('therapistToken');
    localStorage.removeItem('therapistUser');
    // Force page reload to login page
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
          background: 'linear-gradient(135deg, #007e8c 0%, #1FBFBF 100%)',
          padding: '16px 16px',
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
          <div style={{
            width: '50px',
            height: '50px',
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            color: 'white',
            fontWeight: 'bold',
            flexShrink: 0
          }}>
            <span style={{ transform: 'rotate(-20deg)', display: 'inline-block', fontSize: '16px' }}>///</span>
            <span style={{ fontSize: '32px' }}>Ó</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <Text strong style={{
              color: 'white',
              fontSize: '20px',
              letterSpacing: '1.5px',
              lineHeight: '1.2',
              margin: 0
            }}>
              REJUVENATORS<sup style={{ fontSize: '10px' }}>®</sup>
            </Text>
            <Text style={{
              color: 'white',
              fontSize: '14px',
              fontStyle: 'italic',
              fontWeight: 300,
              lineHeight: '1.2',
              margin: 0
            }}>
              Therapist Portal
            </Text>
          </div>
        </div>

        {/* Hamburger Menu */}
        <MenuOutlined
          style={{ fontSize: '24px', color: 'white', cursor: 'pointer' }}
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
