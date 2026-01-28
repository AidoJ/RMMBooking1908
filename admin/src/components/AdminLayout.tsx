import React, { useState } from 'react';
import { Layout, Drawer, Menu, Avatar, Typography, Space } from 'antd';
import {
  MenuOutlined,
  DashboardOutlined,
  CalendarOutlined,
  UserOutlined,
  TeamOutlined,
  SettingOutlined,
  FileTextOutlined,
  LogoutOutlined,
  DollarOutlined,
  TagOutlined,
  GiftOutlined,
  BarChartOutlined,
  AuditOutlined,
  ScheduleOutlined,
  MoneyCollectOutlined,
  ToolOutlined,
  MailOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router';
import { useLogout, useGetIdentity } from '@refinedev/core';

const { Header, Content } = Layout;
const { Text } = Typography;

interface AdminLayoutProps {
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const [drawerVisible, setDrawerVisible] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { mutate: logout } = useLogout();
  const { data: identity } = useGetIdentity();

  const handleLogout = () => {
    logout();
  };

  // Menu items matching the reordered navigation with submenus
  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
    },
    {
      key: '/bookings',
      icon: <FileTextOutlined />,
      label: 'Bookings',
    },
    {
      key: '/quotes',
      icon: <DollarOutlined />,
      label: 'Quotes',
    },
    {
      key: '/calendar',
      icon: <CalendarOutlined />,
      label: 'Calendar',
    },
    {
      key: 'services-group',
      icon: <ScheduleOutlined />,
      label: 'Services',
      children: [
        {
          key: '/services',
          icon: <ScheduleOutlined />,
          label: 'Service List',
        },
        {
          key: '/services-uplift-rates',
          icon: <MoneyCollectOutlined />,
          label: 'Uplift Rates',
        },
      ],
    },
    {
      key: 'therapists-group',
      icon: <UserOutlined />,
      label: 'Therapists',
      children: [
        {
          key: '/therapists',
          icon: <UserOutlined />,
          label: 'Therapist List',
        },
        {
          key: '/therapist-registrations',
          icon: <FileTextOutlined />,
          label: 'Registrations',
        },
        {
          key: '/therapist-payments',
          icon: <DollarOutlined />,
          label: 'Payments',
        },
        {
          key: '/therapist-availability',
          icon: <CalendarOutlined />,
          label: 'Availability Overview',
        },
      ],
    },
    {
      key: '/customers',
      icon: <TeamOutlined />,
      label: 'Customers',
    },
    {
      key: '/discount-codes',
      icon: <TagOutlined />,
      label: 'Discount Codes',
    },
    {
      key: '/gift-cards',
      icon: <GiftOutlined />,
      label: 'Gift Cards',
    },
    {
      key: '/reports',
      icon: <BarChartOutlined />,
      label: 'Reports',
    },
    {
      key: '/communications',
      icon: <MailOutlined />,
      label: 'Communications',
    },
    {
      key: 'system-group',
      icon: <SettingOutlined />,
      label: 'System',
      children: [
        {
          key: '/system-settings',
          icon: <SettingOutlined />,
          label: 'System Settings',
        },
        {
          key: '/user-management',
          icon: <TeamOutlined />,
          label: 'User Management',
        },
        {
          key: '/activity-logs',
          icon: <AuditOutlined />,
          label: 'Activity Logs',
        },
        {
          key: '/system-tools',
          icon: <ToolOutlined />,
          label: 'System Tools',
        },
      ],
    },
  ];

  const handleMenuClick = (key: string) => {
    navigate(key);
    setDrawerVisible(false);
  };

  // Get current path for menu selection (handles submenus)
  const getCurrentPath = () => {
    const path = location.pathname;

    // Check all menu items including children
    for (const item of menuItems) {
      if (item.children) {
        // Check children items
        for (const child of item.children) {
          if (child.key === '/') {
            if (path === '/') return child.key;
          } else if (path.startsWith(child.key)) {
            return child.key;
          }
        }
      } else {
        if (item.key === '/') {
          if (path === '/') return item.key;
        } else if (path.startsWith(item.key)) {
          return item.key;
        }
      }
    }
    return '/';
  };

  // Get open submenu keys based on current path
  const getOpenKeys = () => {
    const path = location.pathname;
    const openKeys: string[] = [];

    for (const item of menuItems) {
      if (item.children) {
        for (const child of item.children) {
          if (path.startsWith(child.key)) {
            openKeys.push(item.key);
            break;
          }
        }
      }
    }
    return openKeys;
  };

  return (
    <Layout style={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      {/* Mobile-First Sticky Header */}
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
          height: '64px',
        }}
      >
        {/* Hamburger Menu + User Info (Left Side) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
          {/* Hamburger Icon */}
          <MenuOutlined
            style={{
              fontSize: '24px',
              color: 'white',
              cursor: 'pointer',
              flexShrink: 0
            }}
            onClick={() => setDrawerVisible(true)}
          />

          {/* User Avatar */}
          <Avatar
            size="small"
            style={{ backgroundColor: '#00a99d' }}
            icon={<UserOutlined />}
          />

          {/* Username (hidden on very small screens) */}
          <Text
            style={{
              color: 'white',
              fontSize: '14px',
            }}
            className="admin-username"
          >
            {identity?.name || 'Admin'}
          </Text>
        </div>

        {/* Logo and Brand (Right Side) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flex: 1,
          minWidth: 0,
          justifyContent: 'flex-end'
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            overflow: 'hidden',
            textAlign: 'right'
          }}>
            <Text
              strong
              style={{
                color: 'white',
                fontSize: 'clamp(14px, 3.5vw, 20px)',
                letterSpacing: '1.5px',
                lineHeight: '1.2',
                margin: 0,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              REJUVENATORS<sup style={{ fontSize: '0.5em' }}>®</sup>
            </Text>
            <Text
              style={{
                color: 'white',
                fontSize: 'clamp(11px, 2.5vw, 14px)',
                fontStyle: 'italic',
                fontWeight: 300,
                lineHeight: '1.2',
                margin: 0,
                whiteSpace: 'nowrap',
                opacity: 0.9
              }}
            >
              Admin Panel
            </Text>
          </div>
          <img
            src="/admin/hand.png"
            alt="Rejuvenators Logo"
            style={{
              width: '50px',
              height: '50px',
              objectFit: 'contain',
              flexShrink: 0
            }}
          />
        </div>
      </Header>

      {/* Main Content Area */}
      <Content
        style={{
          padding: '16px',
          maxWidth: '100%',
          width: '100%',
        }}
      >
        {children}
      </Content>

      {/* Navigation Drawer (Slides from Left) */}
      <Drawer
        title={
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <Avatar
              size={64}
              style={{ backgroundColor: '#007e8c' }}
              icon={<UserOutlined />}
            />
            <div>
              <Text strong style={{ fontSize: '16px', display: 'block' }}>
                {identity?.name || 'Admin User'}
              </Text>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {identity?.role || 'Administrator'}
              </Text>
            </div>
          </Space>
        }
        placement="left"
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        width={280}
        zIndex={1050}
        styles={{
          header: {
            borderBottom: '1px solid #f0f0f0',
            paddingBottom: '16px',
          },
          body: {
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
          },
        }}
      >
        {/* Main Menu */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <Menu
            mode="inline"
            selectedKeys={[getCurrentPath()]}
            defaultOpenKeys={getOpenKeys()}
            onClick={({ key }) => handleMenuClick(key)}
            style={{
              border: 'none',
              padding: '8px 0'
            }}
            items={menuItems}
          />
        </div>

        {/* Logout Button (Fixed at Bottom) */}
        <div style={{
          borderTop: '1px solid #f0f0f0',
          padding: '16px',
          backgroundColor: '#fafafa'
        }}>
          <Menu
            mode="inline"
            style={{ border: 'none', backgroundColor: 'transparent' }}
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

      {/* Custom CSS for responsive adjustments */}
      <style>{`
        /* Show username on larger screens */
        @media (max-width: 479px) {
          .admin-username {
            display: none !important;
          }
        }

        /* Responsive content padding */}
        @media (min-width: 768px) {
          .ant-layout-content {
            padding: 24px !important;
          }
        }

        /* Smooth transitions */}
        .ant-drawer-content-wrapper {
          transition: transform 0.3s ease;
        }

        /* Touch-friendly menu items */}
        .ant-menu-item {
          height: 48px !important;
          line-height: 48px !important;
          margin: 4px 0 !important;
        }

        .ant-menu-item-icon {
          font-size: 18px !important;
        }

        /* Selected menu item styling */}
        .ant-menu-item-selected {
          background-color: #e6f7ff !important;
          border-left: 3px solid #007e8c !important;
        }

        /* Drawer title styling */}
        .ant-drawer-header-title {
          flex-direction: column !important;
          align-items: flex-start !important;
        }
      `}</style>
    </Layout>
  );
};
