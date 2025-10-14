import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { MobileLayout } from './components/MobileLayout';

// Pages
import { LoginPage } from './pages/LoginPage';
import { Dashboard } from './pages/Dashboard';
import { JobCompletion } from './pages/JobCompletion';
import { WeeklyEarnings } from './pages/WeeklyEarnings';
import { InvoiceSubmission } from './pages/InvoiceSubmission';
import { Calendar } from './pages/Calendar';
import { Profile } from './pages/Profile';
import { ServiceArea } from './pages/ServiceArea';

// Mobile-first theme configuration
const mobileTheme = {
  algorithm: theme.defaultAlgorithm,
  token: {
    colorPrimary: '#1890ff',
    borderRadius: 8,
    fontSize: 16,
    sizeUnit: 4,
    sizeStep: 4,
  },
  components: {
    Button: {
      controlHeight: 48,
      fontSize: 16,
    },
    Input: {
      controlHeight: 48,
      fontSize: 16,
    },
    Card: {
      borderRadius: 12,
    },
  },
};

function App() {
  return (
    <ConfigProvider theme={mobileTheme}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            
            {/* Protected routes with mobile layout */}
            <Route path="/" element={
              <ProtectedRoute>
                <MobileLayout />
              </ProtectedRoute>
            }>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="complete-job" element={<JobCompletion />} />
              <Route path="earnings" element={<WeeklyEarnings />} />
              <Route path="invoice" element={<InvoiceSubmission />} />
              <Route path="calendar" element={<Calendar />} />
              <Route path="profile" element={<Profile />} />
              <Route path="service-area" element={<ServiceArea />} />
            </Route>
            
            {/* Catch all route */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;

