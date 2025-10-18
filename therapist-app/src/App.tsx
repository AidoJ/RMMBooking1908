import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, Spin, App as AntApp } from 'antd';
import { AppLayout } from './components/AppLayout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Calendar } from './pages/Calendar';
import { Bookings } from './pages/Bookings';
import { BookingDetail } from './pages/BookingDetail';
import { Profile } from './pages/Profile';
import { Services } from './pages/Services';
import { Availability } from './pages/Availability';
import { TimeOff } from './pages/TimeOff';
import { ServiceArea } from './pages/ServiceArea';
import { Invoices } from './pages/Invoices';
import { MyEarnings } from './pages/MyEarnings';
import type { UserIdentity } from './types';

function App() {
  const [user, setUser] = useState<UserIdentity | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for stored therapist session (using localStorage like admin panel)
    const checkAuth = () => {
      const token = localStorage.getItem('therapistToken');
      const userStr = localStorage.getItem('therapistUser');

      if (token && userStr) {
        try {
          const therapistData = JSON.parse(userStr);
          setUser({
            id: therapistData.user_id || therapistData.id,
            email: therapistData.email,
            role: 'therapist',
            therapist_profile: therapistData,
          });
        } catch (error) {
          console.error('Error parsing user data:', error);
          // Clear invalid data
          localStorage.removeItem('therapistToken');
          localStorage.removeItem('therapistUser');
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <ConfigProvider
      theme={{
        token: {
          // Primary brand color
          colorPrimary: '#007e8c',

          // Color palette from tealpalette.png
          colorSuccess: '#1FBFBF', // Teal accent
          colorInfo: '#5F7BC7', // Blue-purple
          colorWarning: '#C74BC7', // Magenta-pink
          colorError: '#C74BC7', // Magenta-pink for errors

          // Link colors
          colorLink: '#007e8c',
          colorLinkHover: '#1FBFBF',
          colorLinkActive: '#005f6b',

          // Text colors
          colorText: '#2c3e50',
          colorTextSecondary: '#5F7BC7',
          colorTextTertiary: '#95a5a6',

          // Background colors
          colorBgContainer: '#ffffff',
          colorBgElevated: '#ffffff',
          colorBgLayout: '#f0f8f9', // Very light teal background

          // Border colors
          colorBorder: '#d4e9ec',
          colorBorderSecondary: '#e8f4f5',

          // Typography
          fontFamily: "'Josefin Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          fontSize: 14,
          fontSizeHeading1: 32,
          fontSizeHeading2: 28,
          fontSizeHeading3: 22,

          // Border radius
          borderRadius: 8,
          borderRadiusLG: 12,
          borderRadiusSM: 6,

          // Spacing
          padding: 16,
          paddingLG: 24,
          paddingSM: 12,
          paddingXS: 8,

          // Control heights
          controlHeight: 40,
          controlHeightLG: 48,
          controlHeightSM: 32,

          // Box shadows
          boxShadow: '0 2px 8px rgba(0, 126, 140, 0.08)',
          boxShadowSecondary: '0 4px 16px rgba(0, 126, 140, 0.12)',
        },
        components: {
          Button: {
            colorPrimary: '#007e8c',
            colorPrimaryHover: '#1FBFBF',
            colorPrimaryActive: '#005f6b',
            primaryShadow: '0 2px 8px rgba(0, 126, 140, 0.2)',
          },
          Card: {
            colorBorderSecondary: '#d4e9ec',
            boxShadowTertiary: '0 2px 12px rgba(0, 126, 140, 0.06)',
          },
          Table: {
            colorBgContainer: '#ffffff',
            colorFillAlter: '#f0f8f9',
            headerBg: '#e0f2f4',
            headerColor: '#007e8c',
          },
          Tag: {
            colorSuccess: '#1FBFBF',
            colorInfo: '#5F7BC7',
            colorWarning: '#C74BC7',
          },
          Statistic: {
            colorTextHeading: '#007e8c',
          },
          Menu: {
            itemActiveBg: '#e0f2f4',
            itemSelectedBg: '#d4e9ec',
            itemSelectedColor: '#007e8c',
            itemHoverBg: '#f0f8f9',
            itemHoverColor: '#1FBFBF',
          },
          Input: {
            colorBorder: '#d4e9ec',
            colorPrimaryHover: '#1FBFBF',
            activeShadow: '0 0 0 2px rgba(0, 126, 140, 0.1)',
          },
          Select: {
            colorBorder: '#d4e9ec',
            colorPrimaryHover: '#1FBFBF',
          },
        },
      }}
    >
      <AntApp>
        <BrowserRouter basename="/therapist">
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />

          <Route
            path="/*"
            element={
              user ? (
                <AppLayout
                  therapistName={`${user.therapist_profile?.first_name} ${user.therapist_profile?.last_name}`}
                  profilePic={user.therapist_profile?.profile_pic}
                >
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/calendar" element={<Calendar />} />
                    <Route path="/bookings" element={<Bookings />} />
                    <Route path="/booking/:id" element={<BookingDetail />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/services" element={<Services />} />
                    <Route path="/availability" element={<Availability />} />
                    <Route path="/time-off" element={<TimeOff />} />
                    <Route path="/service-area" element={<ServiceArea />} />
                    <Route path="/my-earnings" element={<MyEarnings />} />
                    <Route path="/invoices" element={<Invoices />} />
                    <Route path="*" element={<Navigate to="/" />} />
                  </Routes>
                </AppLayout>
              ) : (
                <Navigate to="/login" />
              )
            }
          />
        </Routes>
      </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  );
}

export default App;
