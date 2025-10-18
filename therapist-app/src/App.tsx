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
import { Earnings } from './pages/Earnings';
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
          colorPrimary: '#007e8c',
          fontFamily: "'Josefin Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
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
                    <Route path="/invoices" element={<Invoices />} />
                    <Route path="/earnings" element={<Earnings />} />
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
