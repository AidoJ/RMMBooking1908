import { Dashboard } from "./pages/dashboard";
import { Authenticated, Refine } from "@refinedev/core";
import { DevtoolsPanel, DevtoolsProvider } from "@refinedev/devtools";
import { RefineKbar, RefineKbarProvider } from "@refinedev/kbar";

import {
  AuthPage,
  ErrorComponent,
  ThemedLayoutV2,
  ThemedSiderV2,
  useNotificationProvider,
} from "@refinedev/antd";
import "@refinedev/antd/dist/reset.css";

import routerBindings, {
  CatchAllNavigate,
  DocumentTitleHandler,
  NavigateToResource,
  UnsavedChangesNotifier,
} from "@refinedev/react-router";
import { dataProvider, liveProvider } from "@refinedev/supabase";
import { App as AntdApp } from "antd";
import { BrowserRouter, Outlet, Route, Routes, useParams } from "react-router";
import authProvider from "./authProvider";
import { Header } from "./components/header";
import { ColorModeContextProvider } from "./contexts/color-mode";
import { supabaseClient } from "./utility";

// Import the booking management components
import { EnhancedBookingList } from "./pages/bookings/list";
import { CalendarBookingManagement } from "./pages/bookings/calendar";
import { BookingShow } from "./pages/bookings/show";
import TherapistProfileManagement from "./pages/therapists/profile";

// Wrapper component to get the ID from route params
const BookingShowWrapper = () => {
  const { id } = useParams();
  return <BookingShow id={id || ''} />;
};

// Simple placeholder components for features we haven't built yet
const BookingEdit = () => <div style={{padding: 24}}><h1>Edit Booking</h1><p>Edit booking form will go here</p></div>;

const TherapistList = () => <div style={{padding: 24}}><h1>Therapist Management</h1><p>Admin therapist list will go here</p></div>;
const TherapistShow = () => <div style={{padding: 24}}><h1>Therapist Details</h1><p>Therapist details will go here</p></div>;
const TherapistEdit = () => <div style={{padding: 24}}><h1>Edit Therapist</h1><p>Admin edit therapist will go here</p></div>;
const TherapistCreate = () => <div style={{padding: 24}}><h1>Add New Therapist</h1><p>Create new therapist account will go here</p></div>;

const CustomerList = () => <div style={{padding: 24}}><h1>Customer Management</h1><p>Customer list and management will go here</p></div>;
const CustomerShow = () => <div style={{padding: 24}}><h1>Customer Details</h1><p>Customer profile and booking history will go here</p></div>;
const CustomerEdit = () => <div style={{padding: 24}}><h1>Edit Customer</h1><p>Edit customer information will go here</p></div>;

const ServiceList = () => <div style={{padding: 24}}><h1>Service Management</h1><p>Massage services list will go here</p></div>;
const ServiceShow = () => <div style={{padding: 24}}><h1>Service Details</h1><p>Service details will go here</p></div>;
const ServiceEdit = () => <div style={{padding: 24}}><h1>Edit Service</h1><p>Edit service details will go here</p></div>;
const ServiceCreate = () => <div style={{padding: 24}}><h1>Add New Service</h1><p>Create new massage service will go here</p></div>;

// Super Admin only pages
const SystemSettings = () => <div style={{padding: 24}}><h1>System Settings</h1><p>System configuration will go here</p></div>;
const UserManagement = () => <div style={{padding: 24}}><h1>User Management</h1><p>Manage admin users and therapist accounts</p></div>;
const ActivityLogs = () => <div style={{padding: 24}}><h1>Activity Logs</h1><p>System activity monitoring will go here</p></div>;
const Reports = () => <div style={{padding: 24}}><h1>Business Reports</h1><p>Analytics and business reports will go here</p></div>;

function App() {
  return (
    <BrowserRouter basename="/admin">
      <RefineKbarProvider>
        <ColorModeContextProvider>
          <AntdApp>
            <DevtoolsProvider>
              <Refine
                dataProvider={dataProvider(supabaseClient)}
                liveProvider={liveProvider(supabaseClient)}
                authProvider={authProvider}
                routerProvider={routerBindings}
                notificationProvider={useNotificationProvider}
                resources={[
                  {
                    name: "dashboard",
                    list: "/",
                    meta: {
                      label: "Dashboard",
                      icon: "🏠",
                    },
                  },
                  {
                    name: "bookings",
                    list: "/bookings",
                    show: "/bookings/show/:id",
                    edit: "/bookings/edit/:id",
                    meta: {
                      canDelete: true,
                      label: "Bookings",
                      icon: "📋",
                    },
                  },
                  {
                    name: "therapist_profiles",
                    list: "/therapists",
                    show: "/therapists/show/:id",
                    edit: "/therapists/edit/:id",
                    create: "/therapists/create",
                    meta: {
                      canDelete: true,
                      label: "Therapists",
                      icon: "👨‍⚕️",
                    },
                  },
                  // Therapist-only profile management resource
                  {
                    name: "my-profile",
                    list: "/my-profile",
                    meta: {
                      label: "My Profile",
                      icon: "👤",
                    },
                  },
                  {
                    name: "customers",
                    list: "/customers",
                    show: "/customers/show/:id",
                    edit: "/customers/edit/:id",
                    meta: {
                      canDelete: true,
                      label: "Customers",
                      icon: "👥",
                    },
                  },
                  {
                    name: "services",
                    list: "/services",
                    show: "/services/show/:id",
                    edit: "/services/edit/:id",
                    create: "/services/create",
                    meta: {
                      canDelete: true,
                      label: "Services",
                      icon: "💆‍♀️",
                    },
                  },
                  {
                    name: "reports",
                    list: "/reports",
                    meta: {
                      label: "Reports",
                      icon: "📊",
                    },
                  },
                  {
                    name: "system-settings",
                    list: "/system-settings",
                    meta: {
                      label: "System Settings",
                      icon: "⚙️",
                    },
                  },
                  {
                    name: "user-management",
                    list: "/user-management",
                    meta: {
                      label: "User Management",
                      icon: "👤",
                    },
                  },
                  {
                    name: "activity-logs",
                    list: "/activity-logs",
                    meta: {
                      label: "Activity Logs",
                      icon: "📝",
                    },
                  },
                ]}
                options={{
                  syncWithLocation: true,
                  warnWhenUnsavedChanges: true,
                  useNewQueryKeys: true,
                  projectId: "KzRnmo-KKZ8aE-7jCGlj",
                }}
              >
                <Routes>
                  <Route
                    element={
                      <Authenticated
                        key="authenticated-inner"
                        fallback={<CatchAllNavigate to="/login" />}
                      >
                        <ThemedLayoutV2
                          Header={Header}
                          Sider={(props) => <ThemedSiderV2 {...props} fixed />}
                        >
                          <Outlet />
                        </ThemedLayoutV2>
                      </Authenticated>
                    }
                  >
                    {/* Dashboard */}
                    <Route index element={<Dashboard />} />
                    
                    {/* Booking Management */}
                    <Route path="/bookings">
                      <Route index element={<EnhancedBookingList />} />
                      <Route path="calendar" element={<CalendarBookingManagement />} />
                      <Route path="edit/:id" element={<BookingEdit />} />
                      <Route path="show/:id" element={<BookingShowWrapper />} />
                    </Route>
                    
                    {/* Therapist Management (Admin) */}
                    <Route path="/therapists">
                      <Route index element={<TherapistList />} />
                      <Route path="create" element={<TherapistCreate />} />
                      <Route path="edit/:id" element={<TherapistEdit />} />
                      <Route path="show/:id" element={<TherapistShow />} />
                    </Route>
                    
                    {/* Therapist Profile Management (Therapist-only) */}
                    <Route path="/my-profile" element={<TherapistProfileManagement />} />
                    
                    {/* Customer Management */}
                    <Route path="/customers">
                      <Route index element={<CustomerList />} />
                      <Route path="edit/:id" element={<CustomerEdit />} />
                      <Route path="show/:id" element={<CustomerShow />} />
                    </Route>
                    
                    {/* Service Management */}
                    <Route path="/services">
                      <Route index element={<ServiceList />} />
                      <Route path="create" element={<ServiceCreate />} />
                      <Route path="edit/:id" element={<ServiceEdit />} />
                      <Route path="show/:id" element={<ServiceShow />} />
                    </Route>
                    
                    {/* Reports */}
                    <Route path="/reports" element={<Reports />} />
                    
                    {/* System Settings (Super Admin Only) */}
                    <Route path="/system-settings" element={<SystemSettings />} />
                    
                    {/* User Management (Super Admin Only) */}
                    <Route path="/user-management" element={<UserManagement />} />
                    
                    {/* Activity Logs (Super Admin Only) */}
                    <Route path="/activity-logs" element={<ActivityLogs />} />
                    
                    <Route path="*" element={<ErrorComponent />} />
                  </Route>
                  
                  <Route
                    element={
                      <Authenticated
                        key="authenticated-outer"
                        fallback={<Outlet />}
                      >
                        <NavigateToResource />
                      </Authenticated>
                    }
                  >
                    <Route
                      path="/login"
                      element={
                        <AuthPage
                          type="login"
                          title="Rejuvenators Admin Panel"
                          formProps={{
                            initialValues: {
                              email: "admin@rejuvenators.com",
                              password: "admin123",
                            },
                          }}
                        />
                      }
                    />
                  </Route>
                </Routes>

                <RefineKbar />
                <UnsavedChangesNotifier />
                <DocumentTitleHandler />
              </Refine>
              <DevtoolsPanel />
            </DevtoolsProvider>
          </AntdApp>
        </ColorModeContextProvider>
      </RefineKbarProvider>
    </BrowserRouter>
  );
}

export default App;
